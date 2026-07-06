/* ============================================================================
   B.1 -- Win celebration + announcement (URS-107…URS-114). Win-transition
   detection is a pure function over successive polls' LiveMatch[] (§B1.2 of
   the LIVE-SCORES-BLUEPRINT addendum B) so it is fully unit-testable without a
   DOM or network. The overlay/queue/DOM rendering below is a small,
   framework-free controller in the same module-owned-DOM-string style as
   scoreboard.ts (no second card component, no second live region).
============================================================================ */
import type { LiveMatch, LiveMatchState } from "./types";
import { formatScore } from "../bracket/model";
import { CELEBRATION_MS, CELEBRATION_MAX_VISIBLE } from "./endpoints";

/** What a celebration card needs to render (URS-109). `nodeNum`/`drawId` are
 * populated only when the match maps to a bracket node (URS-108) and enable
 * the optional spotlight tie-in (URS-128/B1.6); absent for unbound wins,
 * which still celebrate using feed names only. */
export interface CelebrationData {
  id: string;
  winnerName: string;
  opponentName: string;
  detail: string;
  scoreText: string;
  seed?: number;
  iso?: string;
}

/* -------------------------- Win-transition detection ----------------------- */

interface SeenState {
  seeded: boolean;
  celebrated: Set<string>;
  prev: Map<string, LiveMatchState>;
}

function newSeenState(): SeenState {
  return { seeded: false, celebrated: new Set(), prev: new Map() };
}

let seen: SeenState = newSeenState();

/** Reset internal detection state -- call between test cases (mirrors
 * resetScoreboardDiffState) so one test's baseline doesn't leak into the
 * next. */
export function resetCelebrateState(): void {
  seen = newSeenState();
}

function hasDecidedWinner(m: LiveMatch): boolean {
  return m.players.some((p) => p.winner === true);
}

function toCelebrationData(m: LiveMatch): CelebrationData {
  const winnerIdx = m.players.findIndex((p) => p.winner === true);
  const winner = winnerIdx === 0 ? m.players[0] : m.players[1];
  const opponent = winnerIdx === 0 ? m.players[1] : m.players[0];
  return {
    id: m.id,
    winnerName: winner?.displayName ?? "",
    opponentName: opponent?.displayName ?? "",
    detail: m.detail,
    scoreText: formatScore(m.sets),
    seed: winner?.seed,
    iso: winner?.iso,
  };
}

/** Call once per successful poll with that poll's full LiveMatch[] (both
 * draws). Returns the wins to celebrate now, already deduped in the order
 * they were discovered. The FIRST call only seeds the "seen state" baseline
 * and returns [] -- matches already `post` when the page opened MUST NOT
 * replay as celebrations (URS-107.1). A match already celebrated never
 * re-fires even if the feed keeps re-listing it `post` (URS-107.2). If the
 * feed never produces a real "in"->"post" transition (down/off-season/
 * non-Wimbledon -- `matches` stays [] or unchanged), nothing is returned
 * (URS-107.3). */
export function detectWins(matches: LiveMatch[]): CelebrationData[] {
  const wins: CelebrationData[] = [];

  if (!seen.seeded) {
    for (const m of matches) seen.prev.set(m.id, m.state);
    seen.seeded = true;
    return wins;
  }

  for (const m of matches) {
    const before = seen.prev.get(m.id);
    const finishedNow =
      m.state === "post" && before !== "post" && !seen.celebrated.has(m.id) && hasDecidedWinner(m);
    if (finishedNow) {
      seen.celebrated.add(m.id);
      wins.push(toCelebrationData(m));
    }
    seen.prev.set(m.id, m.state);
  }

  return wins;
}

/* ------------------------------ Overlay + queue ----------------------------- */

function escapeHTML(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FLAG_BUCKET = "h40";
function flagURL(iso?: string): string {
  if (!iso) return "";
  return `https://flagcdn.com/${FLAG_BUCKET}/${iso}.png`;
}

/** Concise polite-announcement text for one win (URS-112), e.g.
 * "Kostyuk wins, def. Świątek 6–3, 7–5". */
export function celebrationAnnouncement(c: CelebrationData): string {
  const def = c.opponentName ? `, def. ${c.opponentName}` : "";
  const score = c.scoreText ? ` ${c.scoreText}` : "";
  return `${c.winnerName} wins${def}${score}`.trim();
}

function cardHTML(c: CelebrationData): string {
  const seedLabel = c.seed != null ? ` <span class="cel-seed">(${c.seed})</span>` : "";
  const flagSrc = flagURL(c.iso);
  const flagImg = flagSrc
    ? `<img class="cel-flag" src="${flagSrc}" alt="" loading="lazy" decoding="async" width="24" height="24"/>`
    : "";
  const detail = c.detail ? `<div class="cel-detail">${escapeHTML(c.detail)}</div>` : "";
  const opponent = c.opponentName
    ? ` <span class="cel-def">def. ${escapeHTML(c.opponentName)}</span>`
    : "";
  const score = c.scoreText ? `<div class="cel-score">${escapeHTML(c.scoreText)}</div>` : "";
  return `
    <div class="celebration-card" role="status" data-match-id="${escapeHTML(c.id)}">
      <span class="cel-confetti" aria-hidden="true"></span>
      <button type="button" class="cel-close" aria-label="Dismiss celebration">&times;</button>
      <div class="cel-body">
        ${flagImg}
        <div class="cel-text">
          <div class="cel-headline">${escapeHTML(c.winnerName)} wins!${seedLabel}</div>
          <div class="cel-sub">${opponent}</div>
          ${detail}
          ${score}
        </div>
      </div>
    </div>`;
}

export interface CelebrationController {
  enqueue(win: CelebrationData): void;
  /** Clear all timers/queued state -- call on teardown (URS-114/URS-104). */
  destroy(): void;
}

interface ActiveCard {
  data: CelebrationData;
  el: HTMLElement;
  timer: ReturnType<typeof setTimeout>;
}

/** Create the celebration controller mounted at `rootEl` (the
 * `#celebration-root` container). `announce` is called once per win with a
 * concise polite message (URS-112) -- the caller routes this into the single
 * shared aria-live region (no second live region, URS-127). If `rootEl` is
 * null the controller no-ops (single dev warn), never throwing (URS-114). */
export function createCelebrationController(
  rootEl: HTMLElement | null,
  announce: (text: string) => void,
): CelebrationController {
  if (!rootEl) {
    console.warn("live: #celebration-root mount point missing -- celebrations disabled");
    return { enqueue: () => {}, destroy: () => {} };
  }

  const queue: CelebrationData[] = [];
  const active: ActiveCard[] = [];
  let overflowCount = 0;
  let overflowEl: HTMLElement | null = null;

  function renderOverflow(): void {
    if (overflowCount <= 0) {
      overflowEl?.remove();
      overflowEl = null;
      return;
    }
    if (!overflowEl) {
      overflowEl = document.createElement("div");
      overflowEl.className = "celebration-overflow";
      rootEl!.appendChild(overflowEl);
    }
    overflowEl.textContent = `+${overflowCount} more result${overflowCount === 1 ? "" : "s"}`;
  }

  function dismiss(card: ActiveCard): void {
    clearTimeout(card.timer);
    card.el.remove();
    const idx = active.indexOf(card);
    if (idx >= 0) active.splice(idx, 1);
    playNext();
  }

  function playNext(): void {
    if (active.length >= CELEBRATION_MAX_VISIBLE) return;
    const next = queue.shift();
    if (!next) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = cardHTML(next);
    const el = wrap.firstElementChild as HTMLElement;
    rootEl!.appendChild(el);

    // `card` needs to exist before the timer closure is created (the timer
    // dismisses this exact card), so build it as a mutable holder first, then
    // freeze its fields in one shot.
    const card = { data: next, el, timer: undefined } as unknown as ActiveCard;
    card.timer = setTimeout(() => dismiss(card), CELEBRATION_MS);
    active.push(card);

    const closeBtn = el.querySelector<HTMLButtonElement>(".cel-close");
    closeBtn?.addEventListener("click", () => dismiss(card));

    // Keep the "+N more" note in sync with what's still waiting in the queue.
    overflowCount = queue.length;
    renderOverflow();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    const front = active[0];
    if (front) dismiss(front);
  }
  document.addEventListener("keydown", onKeydown);

  return {
    enqueue(win: CelebrationData): void {
      queue.push(win);
      announce(celebrationAnnouncement(win));
      playNext();
      // playNext() only updates the overflow note when it actually dequeues a
      // card; if the stack is already at CELEBRATION_MAX_VISIBLE it returns
      // early, so recompute here too -- this is the only path that keeps
      // "+N more" accurate when several wins land while the stack is full
      // (URS-111.3).
      overflowCount = queue.length;
      renderOverflow();
    },
    destroy(): void {
      for (const card of [...active]) {
        clearTimeout(card.timer);
        card.el.remove();
      }
      active.length = 0;
      queue.length = 0;
      overflowEl?.remove();
      overflowEl = null;
      document.removeEventListener("keydown", onKeydown);
    },
  };
}

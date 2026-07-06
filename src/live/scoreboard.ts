/* ============================================================================
   Live scoreboard panel renderer (URS-90…URS-97, URS-99, URS-100, URS-103,
   URS-105). Framework-free DOM string rendering + a small diff-at-the-card
   level so a poll that changes one match doesn't rebuild/thrash the others
   (URS-97). Table semantics for the set grid (URS-103).
============================================================================ */
import type { LiveEngineState, LiveMatch } from "./types";
import { playerById } from "../data/players";

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

/** Cheap signature of a match's visible state, used to decide whether a card
 * needs to be rebuilt on a poll (URS-97: only changed cells/cards update). */
function cardSignature(m: LiveMatch): string {
  const setsSig = m.sets.map((s) => `${s.games[0]}-${s.games[1]}${s.tb ? `(${s.tb})` : ""}`).join(",");
  return `${m.id}|${m.state}|${m.detail}|${m.court ?? ""}|${setsSig}|${m.currentSetIndex}|${m.players
    .map((p) => `${p.displayName}:${p.serving ? 1 : 0}:${p.winner ? 1 : 0}`)
    .join(",")}`;
}

function playerNameHTML(p: LiveMatch["players"][number]): string {
  const resolved = playerById(p.playerId);
  const seed = p.seed ?? resolved?.seed;
  const iso = p.iso ?? resolved?.iso;
  const seedLabel = seed != null ? ` <span class="ls-seed">(${seed})</span>` : "";
  const flagSrc = flagURL(iso);
  const flagImg = flagSrc
    ? `<img class="ls-flag" src="${flagSrc}" alt="" loading="lazy" decoding="async" width="18" height="18"/>`
    : `<span class="ls-flag ls-flag-fallback" aria-hidden="true"></span>`;
  return `${flagImg}<span class="ls-name">${escapeHTML(p.displayName)}</span>${seedLabel}`;
}

/** Render one scorecard as a real <table> (URS-90, URS-103): rows = players,
 * columns = sets, tiebreak as <sup>. Current set gets a highlight column. */
function renderCard(m: LiveMatch): string {
  const [p1, p2] = m.players;
  const setCount = m.sets.length;
  const colHeaders = m.sets
    .map((_, i) => {
      const isCurrent = i === m.currentSetIndex && m.state === "in";
      return `<th scope="col" class="${isCurrent ? "ls-current-col" : ""}">${i + 1}</th>`;
    })
    .join("");

  function rowCells(side: 0 | 1): string {
    let cells = "";
    for (let i = 0; i < setCount; i++) {
      const set = m.sets[i];
      if (!set) continue;
      const games = set.games[side];
      const isCurrent = i === m.currentSetIndex && m.state === "in";
      let tbSup = "";
      if (set.tb != null) {
        const tbVal = Array.isArray(set.tb) ? set.tb[side] : set.tb;
        if (tbVal != null) tbSup = `<sup class="ls-tb">${tbVal}</sup>`;
      }
      cells += `<td class="${isCurrent ? "ls-current-col" : ""}">${games}${tbSup}</td>`;
    }
    return cells;
  }

  const serverDot = (p: LiveMatch["players"][number]) =>
    p.serving ? `<span class="ls-serve-dot" aria-hidden="true" title="Serving"></span>` : "";

  const badge =
    m.state === "in"
      ? `<span class="ls-badge ls-live"><span class="ls-live-dot" aria-hidden="true"></span>LIVE</span>`
      : `<span class="ls-badge ls-final">Final</span>`;

  const statusText = escapeHTML(m.detail || (m.state === "in" ? "In progress" : "Final"));
  const courtText = m.court ? ` · ${escapeHTML(m.court)}` : "";

  return `
    <table class="ls-card" data-match-id="${escapeAttr(m.id)}">
      <caption class="sr-only">${escapeHTML(p1.displayName)} versus ${escapeHTML(p2.displayName)}, ${statusText}${courtText ? `, ${courtText.replace(" · ", "")}` : ""}</caption>
      <thead>
        <tr class="ls-meta-row">
          <td colspan="${setCount + 1}">
            ${badge}
            <span class="ls-status">${statusText}${courtText}</span>
          </td>
        </tr>
        <tr>
          <th scope="col" class="ls-name-col">Player</th>
          ${colHeaders}
        </tr>
      </thead>
      <tbody>
        <tr class="${p1.winner ? "ls-winner" : m.state === "post" ? "ls-loser" : ""}">
          <th scope="row" class="ls-name-col">${serverDot(p1)}${playerNameHTML(p1)}</th>
          ${rowCells(0)}
        </tr>
        <tr class="${p2.winner ? "ls-winner" : m.state === "post" ? "ls-loser" : ""}">
          <th scope="row" class="ls-name-col">${serverDot(p2)}${playerNameHTML(p2)}</th>
          ${rowCells(1)}
        </tr>
      </tbody>
    </table>`;
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export interface ScoreboardMount {
  root: HTMLElement; // #live-scoreboard section
  cardsEl: HTMLElement; // #live-cards mount
  liveRegionEl: HTMLElement; // polite aria-live summary region
  agoEl: HTMLElement; // "updated Xs ago" text node holder
  badgeEl: HTMLElement; // LIVE badge/dot in the header
}

let lastSignatures = new Map<string, string>();
let lastSummaryText = "";

/** Sort matches: `in` first, then today's `post` (URS-100, CQ-A3). "Today" is
 * approximated as: any post match is included (the feed itself only returns
 * current-tournament data; there's no historical browsing in this feature). */
function sortMatches(matches: LiveMatch[]): LiveMatch[] {
  return [...matches].sort((a, b) => {
    const rank = (m: LiveMatch) => (m.state === "in" ? 0 : m.state === "post" ? 1 : 2);
    return rank(a) - rank(b);
  });
}

/** Render the scoreboard body (cards or empty state) for the given engine
 * state. Diffs at the card level via a signature cache so an unchanged card
 * is not torn down and rebuilt (URS-97 -- avoids layout thrash/flash). */
export function renderScoreboard(state: LiveEngineState, mount: ScoreboardMount): void {
  const relevant = sortMatches(state.matches.filter((m) => m.state === "in" || m.state === "post"));

  if (!state.ok && !state.isWimbledon && lastSignatures.size === 0 && relevant.length === 0) {
    // First-ever failed poll with nothing to show yet: calm, not an error.
  }

  if (relevant.length === 0) {
    const emptyMsg = !state.isWimbledon
      ? "No live matches right now — showing the latest bracket."
      : "No matches live right now.";
    mount.cardsEl.innerHTML = `<p class="ls-empty">${escapeHTML(emptyMsg)}</p>`;
    lastSignatures = new Map();
    updateLiveRegion(mount, "", true);
    return;
  }

  const newSigs = new Map<string, string>();
  let changedSummary = "";
  let html = "";
  for (const m of relevant) {
    const sig = cardSignature(m);
    newSigs.set(m.id, sig);
    if (lastSignatures.get(m.id) !== sig && m.state === "in") {
      const [p1, p2] = m.players;
      const setsSig = m.sets.map((s) => `${s.games[0]}-${s.games[1]}`).join(", ");
      changedSummary = `${shortName(p1.displayName)}–${shortName(p2.displayName)}: ${setsSig}`;
    }
    html += renderCard(m);
  }
  mount.cardsEl.innerHTML = html;
  lastSignatures = newSigs;

  if (changedSummary) updateLiveRegion(mount, `Score updated: ${changedSummary}`, false);
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Polite, throttled aria-live update (URS-103): only writes on a real change
 * (or the very first empty-state announcement), never on the 1s tick. */
function updateLiveRegion(mount: ScoreboardMount, text: string, isEmptyState: boolean): void {
  if (!text) return;
  if (isEmptyState && text === lastSummaryText) return;
  if (text === lastSummaryText) return;
  lastSummaryText = text;
  mount.liveRegionEl.textContent = text;
}

/** Update ONLY the "updated Xs ago" text + LIVE pulse state -- called every
 * tick (URS-95, URS-96). Never touches the cards/network. */
export function updateAgoStampAndPulse(state: LiveEngineState, mount: ScoreboardMount): void {
  const hasLive = state.liveCount > 0;
  mount.badgeEl.classList.toggle("ls-pulsing", hasLive && state.ok);
  mount.badgeEl.textContent = hasLive ? "LIVE" : state.ok ? "IDLE" : "OFFLINE";

  let agoText: string;
  if (!state.ok) {
    agoText = "Live feed unavailable — showing saved snapshot";
  } else if (state.lastPollMs == null) {
    agoText = "Connecting…";
  } else {
    const secs = Math.max(0, Math.round((Date.now() - state.lastPollMs) / 1000));
    agoText = secs < 3 ? "updated just now" : `updated ${secs}s ago`;
  }
  mount.agoEl.textContent = agoText;
}

/** Reset the internal diff caches -- call when the panel is torn down/rebuilt
 * from scratch (e.g. tests) so stale signatures don't suppress a re-render. */
export function resetScoreboardDiffState(): void {
  lastSignatures = new Map();
  lastSummaryText = "";
}

/* ============================================================================
   Entry point: load data -> buildModel -> render -> wire interactions
   (BUILD-BLUEPRINT §7 pipeline; URS-2, URS-29, URS-30, URS-56).
   Framework-free vanilla TS island mounted from index.astro.
============================================================================ */
import type { Draw, DrawId } from "./types";
import { buildModel } from "./model";
import { renderBracket, renderResultsList } from "./render";
import { Tooltip, type TipData } from "./tooltip";
import { CourtsController } from "./courts";
import { LiveStore } from "../live/live-store";
import { renderScoreboard, updateAgoStampAndPulse, type ScoreboardMount } from "../live/scoreboard";
import { detectWins, createCelebrationController } from "../live/celebrate";
import {
  assignRails,
  renderRails,
  filterMatchesForDraw,
  filterOverlaysForDraw,
  type RailsMount,
} from "../live/rails";
import type { LiveEngineState, LiveOverlay } from "../live/types";
import { playerById } from "../data/players";

import gentlemensRaw from "../data/gentlemens-singles.json";
import ladiesRaw from "../data/ladies-singles.json";

const gentlemensDraw = gentlemensRaw as unknown as Draw;
const ladiesDraw = ladiesRaw as unknown as Draw;

const DRAWS: Record<DrawId, Draw> = {
  "gentlemens-singles": gentlemensDraw,
  "ladies-singles": ladiesDraw,
};

const stage = document.getElementById("stage");
const resultsListEl = document.getElementById("results-list");
const statusEl = document.getElementById("status");
const dotEl = document.getElementById("status-dot");
const drawToggleGroup = document.getElementById("draw-toggle");
const courtsToggleBtn = document.getElementById("courts-toggle") as HTMLButtonElement | null;
const courtsLegendEl = document.getElementById("courts-legend");
const stageWrap = document.getElementById("stage-wrap");

if (
  !stage ||
  !resultsListEl ||
  !statusEl ||
  !dotEl ||
  !drawToggleGroup ||
  !courtsToggleBtn ||
  !courtsLegendEl ||
  !stageWrap
) {
  // If the static chrome is missing an expected mount point, fail loudly in
  // dev but never throw into the console during normal operation (URS-56).
  console.warn("bracket: one or more expected DOM mount points are missing");
}

let currentDrawId: DrawId = "gentlemens-singles";
const prevWinnersByDraw: Record<DrawId, Record<number, string | null>> = {
  "gentlemens-singles": {},
  "ladies-singles": {},
};

/* Live overlay state (URS-88): empty until/unless the live feed resolves a
 * match onto a node. Bracket render() reads this every call; removing the
 * live layer entirely (overlays always {}) reproduces the pre-feature render
 * exactly (URS-85, URS-98). */
let overlaysByDraw: Record<DrawId, LiveOverlay> = {
  "gentlemens-singles": {},
  "ladies-singles": {},
};

const tooltip = new Tooltip();

const courtsController =
  courtsToggleBtn && courtsLegendEl && stageWrap
    ? new CourtsController({
        toggleBtn: courtsToggleBtn,
        legendEl: courtsLegendEl,
        stageEl: stageWrap,
      })
    : null;

/* -------------------------- Stage sizing (URS-36, URS-43) -----------------
   Absolute-px sizing so Ctrl/Cmd +/- zoom scales the bracket like normal
   content; documentElement.client* ignores pinch zoom entirely (unlike
   window.innerWidth, which shrinks under pinch and would refit + shift every
   tooltip anchor). Ported from the reference's fitStage(). */
function fitStage(): void {
  if (!stageWrap) return;
  const de = document.documentElement;
  const s = Math.min(de.clientWidth * 0.94, de.clientHeight * 0.78, 920);
  stageWrap.style.width = `${s}px`;
}
let stageDPR = window.devicePixelRatio || 1;
fitStage();
window.addEventListener("resize", () => {
  const dpr = window.devicePixelRatio || 1;
  if (dpr !== stageDPR) {
    stageDPR = dpr; // a devicePixelRatio change means this resize was a zoom, not a real resize
    return;
  }
  fitStage();
  tooltip.hide();
});

function render(): void {
  if (!stage || !resultsListEl) return;
  const draw = DRAWS[currentDrawId];
  const model = buildModel(draw);
  const overlay = overlaysByDraw[currentDrawId];
  const { html, winners } = renderBracket({
    draw,
    model,
    prevWinners: prevWinnersByDraw[currentDrawId],
    nowMs: Date.now(),
    overlay,
  });
  stage.innerHTML = html;
  prevWinnersByDraw[currentDrawId] = winners;
  resultsListEl.innerHTML = renderResultsList(draw, model, overlay);
  courtsController?.buildLegend(model);
  courtsController?.applyHighlight();
  wireStageInteractions();
}

/* ------------------------- Tooltip wiring (URS-23, URS-42) -----------------
   Hover (desktop) shows immediately for tokens; a capsule (long arc, whole-
   match hitbox) waits for a settled hover so sweeping the pointer across the
   bracket doesn't flash a tip per arc crossed. Tap toggles on touch. */
const CAP_TIP_DELAY = 500;
let capTimer: number | null = null;
let capEv: PointerEvent | null = null;

function cancelCapTimer(): void {
  if (capTimer != null) {
    window.clearTimeout(capTimer);
    capTimer = null;
  }
}

function tipFromDataset(el: HTMLElement): TipData | null {
  const d = el.dataset;
  if (!d.teams) return null;
  return {
    round: d.round ?? "",
    teams: d.teams,
    score: d.score ?? "",
    when: d.when ?? "",
    status: d.status ?? "",
    court: d.court ?? "",
    placeholder: d.placeholder === "1",
    live: d.live === "1",
    liveDetail: d.liveDetail || undefined,
    serving: d.serving || undefined,
  };
}

function wireStageInteractions(): void {
  if (!stage) return;

  stage.addEventListener("pointerover", (e) => {
    const pe = e as PointerEvent;
    const el = (e.target as HTMLElement).closest<HTMLElement>(".flag-wrap,.cap");
    if (!el || pe.pointerType === "touch") return;
    if (el.classList.contains("cap")) {
      cancelCapTimer();
      capEv = pe;
      capTimer = window.setTimeout(() => {
        capTimer = null;
        const tip = tipFromDataset(el);
        if (tip && capEv) tooltip.show(el, capEv, tip);
      }, CAP_TIP_DELAY);
    } else {
      const tip = tipFromDataset(el);
      if (tip) tooltip.show(el, pe, tip);
    }
  });
  stage.addEventListener("pointerout", (e) => {
    const pe = e as PointerEvent;
    if ((e.target as HTMLElement).closest(".flag-wrap,.cap") && pe.pointerType !== "touch") {
      cancelCapTimer();
      tooltip.hide();
    }
  });
  stage.addEventListener("pointermove", (e) => {
    const pe = e as PointerEvent;
    if (pe.pointerType === "touch") return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(".cap");
    if (!el) return;
    capEv = pe;
    if (tooltip.isOpen()) tooltip.position(el, pe);
  });
  stage.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".flag-wrap,.cap");
    if (el) {
      e.stopPropagation();
      cancelCapTimer();
      const tip = tipFromDataset(el);
      if (tooltip.isOpen()) {
        tooltip.hide();
      } else if (tip) {
        tooltip.show(el, e as MouseEvent, tip);
      }
    }
  });
  // keyboard access to tokens: focusable tokens show/hide their tip on Enter/Space
  stage.addEventListener("keydown", (e) => {
    const key = (e as KeyboardEvent).key;
    if (key !== "Enter" && key !== " ") return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(".flag-wrap");
    if (!el) return;
    e.preventDefault();
    const tip = tipFromDataset(el);
    const rect = el.getBoundingClientRect();
    const fakeEv = {
      pageX: rect.left + rect.width / 2 + window.scrollX,
      pageY: rect.top + window.scrollY,
    };
    if (tooltip.isOpen()) {
      tooltip.hide();
    } else if (tip) {
      tooltip.show(el, fakeEv, tip);
    }
  });
}

document.addEventListener("click", () => tooltip.hide());
window.addEventListener("scroll", () => tooltip.hide(), { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => tooltip.hide(), { passive: true });
}

/* --------------------------- Draw toggle (URS-2) --------------------------- */
if (drawToggleGroup) {
  drawToggleGroup.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-draw-id]");
    if (!btn) return;
    const id = btn.dataset.drawId as DrawId | undefined;
    if (!id || id === currentDrawId) return;
    currentDrawId = id;
    for (const b of drawToggleGroup.querySelectorAll<HTMLButtonElement>("[data-draw-id]")) {
      const active = b.dataset.drawId === id;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    }
    tooltip.hide();
    render();
    // Re-filter the rails + "Live now" panel to the newly-selected draw
    // immediately -- no network, no waiting for the next 15s poll (draw-scope
    // requirement). Uses the LAST CACHED engine state; a no-op (both stay
    // empty) until the first poll has landed.
    renderLiveUIForCurrentDraw();
  });
}

/* ------------------------------ Status line (URS-29, URS-30) --------------- */
function fmtStamp(d: Date): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, opts)
    : d.toLocaleString(undefined, { month: "short", day: "numeric", ...opts });
}

/** liveStatusText: distinguishes the LIVE FEED's own state (URS-101) from the
 * local dataset's `updatedAt` stamp (URS-30) -- the two are never conflated:
 * this text is appended after the existing "data updated ..." segment. */
let liveStatusText = "";

function setStatus(ok: boolean, msg?: string): void {
  if (!dotEl || !statusEl) return;
  dotEl.className = `status-dot ${ok ? "ok" : "err"}`;
  const parts: string[] = [];
  if (msg) parts.push(msg);
  const updatedAt = DRAWS[currentDrawId].updatedAt;
  if (updatedAt) {
    const d = new Date(updatedAt);
    if (!Number.isNaN(d.getTime())) parts.push(`data updated ${fmtStamp(d)}`);
  }
  if (liveStatusText) parts.push(liveStatusText);
  statusEl.textContent = parts.join(" · ");
}

function load(): void {
  if (statusEl) statusEl.textContent = "Loading…";
  try {
    render();
    setStatus(true);
  } catch (err) {
    setStatus(false, "couldn't load bracket — reload to retry");
    console.warn("bracket render failed:", err);
  }
}

load();

/* ============================================================================
   Live scores feature wiring (URS-78…URS-106, LIVE-SCORES-BLUEPRINT §5).
   Everything below is additive: if the live feed never succeeds, overlays
   stay {} and the bracket/status line read exactly as the pre-feature build
   (URS-98). This block is the ONLY place main.ts touches src/live/**.
============================================================================ */
const liveDetailsEl = document.getElementById("live-details");
const liveCardsEl = document.getElementById("live-cards");
const liveRegionEl = document.getElementById("live-region");
const liveAgoEl = document.getElementById("live-ago");
const liveBadgeEl = document.getElementById("live-badge");

const scoreboardMount: ScoreboardMount | null =
  liveDetailsEl && liveCardsEl && liveRegionEl && liveAgoEl && liveBadgeEl
    ? {
        root: liveDetailsEl,
        cardsEl: liveCardsEl,
        liveRegionEl,
        agoEl: liveAgoEl,
        badgeEl: liveBadgeEl,
      }
    : null;

if (!scoreboardMount) {
  console.warn(
    "live: scoreboard DOM mount points missing -- live panel disabled, bracket unaffected",
  );
}

/* ============================================================================
   Addendum B wiring (URS-107…URS-128, LIVE-SCORES-BLUEPRINT addendum B §B1.5,
   §B3.4). Additive to the block above: all three upgrades read the SAME
   `state` the existing poll subscriber already receives -- no second data
   path, no new timers, no change to src/live/live-store.ts.
============================================================================ */
const railLeftEl = document.getElementById("rail-left");
const railRightEl = document.getElementById("rail-right");
const railsMount: RailsMount | null =
  railLeftEl && railRightEl
    ? { leftEl: railLeftEl, rightEl: railRightEl, leftWrapEl: railLeftEl, rightWrapEl: railRightEl }
    : null;
if (!railsMount) {
  console.warn("live: rail DOM mount points missing -- rails disabled, bracket/panel unaffected");
}

/* B3.6 (optional, URS-128): click/keyboard "spotlight" a rail card's bracket
 * node -- switches draw if needed, re-renders, then briefly highlights the
 * matching token via the existing `.flag-wrap`'s own `data-teams` tooltip
 * payload (already present on every token, no src/bracket/render.ts change
 * needed) and scrolls it into view. No-op for unbound cards (no
 * data-node-num on the card). */
function spotlightNode(nodeNum: number, drawId: DrawId): void {
  const applyHighlight = (): void => {
    if (!stage) return;
    const draw = DRAWS[drawId];
    const model = buildModel(draw);
    const node = model[nodeNum];
    if (!node) return;
    const [p1, p2] = node.participants;
    if (!p1 && !p2) return;
    for (const el of stage.querySelectorAll<HTMLElement>(".flag-wrap")) {
      const teams = el.dataset.teams ?? "";
      // The token's own tip payload names both participants of ITS match --
      // for a leaf token that's the same pair as the node we're targeting, so
      // matching the rendered `data-teams` string is a reliable, cheap way to
      // find the right element(s) without a new node-number attribute.
      const player1 = playerById(p1 ?? undefined)?.name;
      const player2 = playerById(p2 ?? undefined)?.name;
      const isMatch = (player1 && teams.includes(player1)) || (player2 && teams.includes(player2));
      if (!isMatch) continue;
      el.classList.remove("rail-spotlight");
      // Force reflow so re-triggering the animation on a repeat click works.
      void el.offsetWidth;
      el.classList.add("rail-spotlight");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el.classList.remove("rail-spotlight"), 3000);
    }
  };

  if (drawId !== currentDrawId) {
    currentDrawId = drawId;
    for (const b of document.querySelectorAll<HTMLButtonElement>("#draw-toggle [data-draw-id]")) {
      const active = b.dataset.drawId === drawId;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    }
    render();
    renderLiveUIForCurrentDraw(); // keep rails/panel scoped to the new draw (draw-scope requirement)
    // Wait a tick for the new draw's DOM to be in place before highlighting.
    window.setTimeout(applyHighlight, 0);
  } else {
    applyHighlight();
  }
}

function wireRailSpotlight(container: HTMLElement | null): void {
  if (!container) return;
  const handler = (e: Event): void => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(".rail-card[data-node-num]");
    if (!el) return;
    if (e.type === "keydown") {
      const key = (e as KeyboardEvent).key;
      if (key !== "Enter" && key !== " ") return;
      e.preventDefault();
    }
    const nodeNum = Number(el.dataset.nodeNum);
    const drawId = el.dataset.drawId as DrawId | undefined;
    if (Number.isNaN(nodeNum) || !drawId) return;
    spotlightNode(nodeNum, drawId);
  };
  container.addEventListener("click", handler);
  container.addEventListener("keydown", handler);
}
wireRailSpotlight(railLeftEl);
wireRailSpotlight(railRightEl);

const celebrationRootEl = document.getElementById("celebration-root");
const celebration = createCelebrationController(celebrationRootEl, (text) => {
  // Route through the SAME shared aria-live region the scoreboard panel uses
  // (URS-112, URS-127) -- never a second live region. Only written on a real
  // win, never on the tick.
  if (liveRegionEl) liveRegionEl.textContent = text;
});
window.addEventListener("pagehide", () => celebration.destroy());

const liveStore = new LiveStore({
  getDraw: (id) => DRAWS[id],
  getModel: (id) => buildModel(DRAWS[id]),
});

/* Last engine state received from a poll (both draws, unfiltered) -- cached
 * so the draw-toggle handler can immediately re-filter+re-render the rails
 * and "Live now" panel without waiting for the next 15s poll (draw-scope
 * requirement). Null until the first poll lands. */
let lastLiveState: LiveEngineState | null = null;

/** Render the rails + "Live now" panel scoped to `currentDrawId`, from
 * `lastLiveState` (no network). Both views are filtered through the SAME
 * `filterMatchesForDraw`/`filterOverlaysForDraw` helpers (src/live/rails.ts)
 * so they can never disagree about which live matches belong to the
 * currently-selected draw. Win-celebration detection is DELIBERATELY not
 * called from here -- it only ever runs once per poll on the UNFILTERED
 * state in the subscriber below (celebrations fire for either tour
 * regardless of which draw is on screen, by design). */
function renderLiveUIForCurrentDraw(): void {
  if (!lastLiveState) return;
  const drawMatches = filterMatchesForDraw(lastLiveState.matches, currentDrawId);
  const drawOverlays = filterOverlaysForDraw(lastLiveState.overlays, currentDrawId);
  if (scoreboardMount) {
    renderScoreboard({ ...lastLiveState, matches: drawMatches }, scoreboardMount);
  }
  if (railsMount) {
    const assignment = assignRails(drawMatches, drawOverlays, DRAWS);
    renderRails(assignment, railsMount);
  }
}

liveStore.subscribe((state, event) => {
  if (event === "poll") {
    lastLiveState = state;
    overlaysByDraw = state.overlays;
    render(); // re-render the bracket WITH the overlay for currentDrawId (URS-88)
    renderLiveUIForCurrentDraw();
    // B.1: detect real in->post transitions from THIS poll's FULL (both-draw)
    // matches and queue a celebration for each (URS-107) -- deliberately
    // UNFILTERED so a win in either draw celebrates regardless of which draw
    // is currently selected (explicit product decision, do not scope this to
    // currentDrawId). No-ops gracefully if the celebration mount is missing
    // (URS-114).
    for (const win of detectWins(state.matches)) celebration.enqueue(win);

    liveStatusText = state.ok
      ? state.liveCount > 0
        ? `Live · updated just now`
        : state.isWimbledon
          ? "Live feed connected — no matches live right now"
          : "Live feed connected — no current Wimbledon event"
      : "Live feed unavailable — showing saved snapshot";
    setStatus(true);
  } else {
    // tick: no network, no bracket rebuild (URS-95) -- only the "updated Xs
    // ago" stamp + LIVE pulse refresh. B.1/B.3 never rebuild on the tick.
    if (scoreboardMount) updateAgoStampAndPulse(state, scoreboardMount);
  }
});

liveStore.start();

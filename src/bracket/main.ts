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
  const { html, winners } = renderBracket({
    draw,
    model,
    prevWinners: prevWinnersByDraw[currentDrawId],
    nowMs: Date.now(),
  });
  stage.innerHTML = html;
  prevWinnersByDraw[currentDrawId] = winners;
  resultsListEl.innerHTML = renderResultsList(draw, model);
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
  });
}

/* ------------------------------ Status line (URS-29, URS-30) --------------- */
function fmtStamp(d: Date): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, opts)
    : d.toLocaleString(undefined, { month: "short", day: "numeric", ...opts });
}

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

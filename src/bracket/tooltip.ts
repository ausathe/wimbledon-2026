/* ============================================================================
   Custom hover/tap tooltip (URS-23, URS-24, URS-43, URS-44). Ported from the
   reference's showTip/positionTip/hideTip: document-coordinate positioning +
   visualViewport clamping so pinch-zoom never strands the tip off-screen.
============================================================================ */

export interface TipData {
  round: string;
  teams: string;
  score: string;
  when: string;
  status: string;
  court: string;
  placeholder: boolean;
  /** True when this match currently has live-feed coverage (URS-93). */
  live?: boolean;
  /** status.type.detail from the feed, e.g. "5th Set" (URS-93). */
  liveDetail?: string;
  /** Resolved server name, if the feed provided possession (URS-90, URS-93). */
  serving?: string;
}

function escapeHTML(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class Tooltip {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "tooltip";
    this.el.setAttribute("role", "status");
    document.body.appendChild(this.el);
  }

  show(anchorEl: HTMLElement, ev: { pageX: number; pageY: number }, tip: TipData): void {
    let scoreHTML: string;
    if (tip.score) {
      const liveTag =
        tip.status === "live"
          ? `<div class="tt-live-tag"><span class="live-dot" aria-hidden="true"></span>Live${
              tip.liveDetail ? ` · ${escapeHTML(tip.liveDetail)}` : ""
            }</div>`
          : "";
      const servingTag =
        tip.live && tip.serving
          ? `<div class="tt-serving"><span class="serve-dot" aria-hidden="true"></span>${escapeHTML(
              tip.serving,
            )} serving</div>`
          : "";
      scoreHTML = liveTag + `<div class="tt-score">${escapeHTML(tip.score)}</div>` + servingTag;
    } else if (tip.status === "live") {
      scoreHTML =
        `<div class="tt-score live"><span class="live-dot" aria-hidden="true"></span>Live${
          tip.liveDetail ? ` · ${escapeHTML(tip.liveDetail)}` : ""
        }</div>` + (tip.when ? `<div class="tt-soon">Started · ${escapeHTML(tip.when)}</div>` : "");
    } else {
      const ahead = tip.status === "deck" ? "On court next" : tip.status === "soon" ? "Today" : "";
      scoreHTML =
        `<div class="tt-score pending">${escapeHTML(tip.when || "Not played yet")}</div>` +
        (ahead ? `<div class="tt-soon">${ahead}</div>` : "");
    }
    this.el.innerHTML =
      (tip.round ? `<div class="tt-round">${escapeHTML(tip.round)}</div>` : "") +
      `<div class="tt-teams">${escapeHTML(tip.teams)}</div>` +
      scoreHTML +
      (tip.court ? `<div class="tt-court">${escapeHTML(tip.court)}</div>` : "") +
      (tip.live
        ? `<div class="tt-live-credit">Live via ESPN (unofficial)</div>`
        : tip.placeholder
          ? `<div class="tt-placeholder">Illustrative placeholder</div>`
          : "");
    this.position(anchorEl, ev);
    this.el.classList.add("on");
  }

  /* Positioned in document coordinates (pageX/Y, rect + scroll), never `fixed`:
     on a pinch-zoomed phone the visual and layout viewports disagree, and
     document coordinates are the one space every engine agrees on (URS-43). */
  position(anchorEl: HTMLElement | null, ev: { pageX: number; pageY: number }): void {
    const isCapsule = anchorEl?.classList.contains("cap") ?? false;
    const rect = !isCapsule && anchorEl ? anchorEl.getBoundingClientRect() : null;
    const ax = rect ? rect.left + rect.width / 2 + window.scrollX : ev.pageX;
    const top = rect ? rect.top + window.scrollY : ev.pageY;
    const bottom = rect ? rect.bottom + window.scrollY : ev.pageY;

    const vv = window.visualViewport;
    const vLeft = vv ? vv.pageLeft : window.scrollX;
    const vTop = vv ? vv.pageTop : window.scrollY;
    const vW = vv ? vv.width : window.innerWidth;

    // counter-scale under pinch zoom so the tip keeps its unzoomed on-screen size
    const tts = vv && vv.scale > 1 ? 1 / vv.scale : 1;
    this.el.style.setProperty("--tts", String(tts));

    const cx = Math.min(Math.max(ax, vLeft + 8), vLeft + vW - 8);
    const flip = top - vTop < 110 * tts; // near the visible top edge -> flip below (URS-44)
    this.el.classList.toggle("below", flip);
    this.el.style.left = `${cx}px`;
    this.el.style.top = `${flip ? bottom : top}px`;
  }

  hide(): void {
    this.el.classList.remove("on");
  }

  isOpen(): boolean {
    return this.el.classList.contains("on");
  }
}

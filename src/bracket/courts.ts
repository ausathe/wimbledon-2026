/* ============================================================================
   "Show courts" toggle + legend + spotlight (URS-12…URS-18). Ported from the
   reference's venue toggle/legend/applyVenueHL, "venue" -> "court".
============================================================================ */
import { COURTS_BY_ID, courtName } from "../data/courts";
import type { ResolvedModel } from "./types";

export interface CourtsUI {
  toggleBtn: HTMLButtonElement;
  legendEl: HTMLElement;
  stageEl: HTMLElement;
}

export class CourtsController {
  private on = false;
  private pinned = new Set<string>();
  private hoverId: string | null = null;
  private legendHTML = "";

  constructor(private ui: CourtsUI) {
    this.wire();
  }

  isOn(): boolean {
    return this.on;
  }

  private wire(): void {
    this.ui.toggleBtn.addEventListener("click", () => {
      this.on = !this.on;
      if (!this.on) {
        this.pinned.clear();
        this.hoverId = null;
      }
      this.ui.toggleBtn.classList.toggle("on", this.on);
      this.ui.toggleBtn.setAttribute("aria-pressed", String(this.on));
      this.ui.toggleBtn.textContent = this.on ? "Hide courts" : "Show courts";
      this.ui.legendEl.classList.toggle("on", this.on);
      this.applyHighlight();
    });

    this.ui.legendEl.addEventListener("pointerover", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".court-pill");
      const pe = e as PointerEvent;
      if (btn && pe.pointerType !== "touch") {
        this.hoverId = btn.dataset.courtId ?? null;
        this.applyHighlight();
      }
    });
    this.ui.legendEl.addEventListener("pointerout", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".court-pill");
      const pe = e as PointerEvent;
      if (btn && pe.pointerType !== "touch") {
        this.hoverId = null;
        this.applyHighlight();
      }
    });
    this.ui.legendEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".court-pill");
      if (!btn) return;
      const id = btn.dataset.courtId;
      if (!id) return;
      const me = e as MouseEvent;
      if (me.ctrlKey || me.metaKey || me.shiftKey) {
        this.pinned.has(id) ? this.pinned.delete(id) : this.pinned.add(id);
      } else if (this.pinned.size === 1 && this.pinned.has(id)) {
        this.pinned.clear();
      } else {
        this.pinned = new Set([id]);
      }
      this.applyHighlight();
    });
    // keyboard: Enter/Space on a focused pill behaves like a click (URS-47)
    this.ui.legendEl.addEventListener("keydown", (e) => {
      const key = (e as KeyboardEvent).key;
      if (key !== "Enter" && key !== " ") return;
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".court-pill");
      if (!btn) return;
      e.preventDefault();
      btn.click();
    });
  }

  /** Rebuild the legend pills from the current model (one pill per court that
   * hosts >=1 match in this draw), each with a match count (URS-13). */
  buildLegend(model: ResolvedModel): void {
    const counts: Record<string, number> = {};
    for (const node of Object.values(model)) {
      if (node.courtId) counts[node.courtId] = (counts[node.courtId] ?? 0) + 1;
    }
    for (const id of [...this.pinned]) if (!counts[id]) this.pinned.delete(id);

    const ids = Object.keys(counts).sort((a, b) => courtName(a).localeCompare(courtName(b)));
    let html = "";
    for (const id of ids) {
      const tier = COURTS_BY_ID[id]?.tier ?? "";
      const cap = COURTS_BY_ID[id]?.capacity;
      const capLabel = cap ? ` · ${cap.toLocaleString()} seats` : "";
      html +=
        `<button type="button" class="court-pill ${tier}" data-court-id="${id}" ` +
        `role="option" aria-selected="false" tabindex="0" ` +
        `title="${courtName(id)}${capLabel} — click to spotlight, Ctrl/Cmd-click to add">` +
        `${courtName(id)}<span class="n">${counts[id]}</span></button>`;
    }
    if (html !== this.legendHTML) {
      this.ui.legendEl.innerHTML = html;
      this.legendHTML = html;
    }
  }

  /** Toggle the CSS state classes that drive the spotlight (URS-15…URS-17). */
  applyHighlight(): void {
    const sel = new Set<string>(this.on ? this.pinned : []);
    if (this.on && this.hoverId) sel.add(this.hoverId);
    this.ui.stageEl.classList.toggle("courts-on", this.on);
    this.ui.stageEl.classList.toggle("cfilter", sel.size > 0);
    for (const el of this.ui.stageEl.querySelectorAll<HTMLElement>("[data-court-id]")) {
      const hit = sel.has(el.dataset.courtId ?? "");
      el.classList.toggle("chit", hit);
    }
    for (const btn of this.ui.legendEl.querySelectorAll<HTMLElement>(".court-pill")) {
      const selected = this.on && this.pinned.has(btn.dataset.courtId ?? "");
      btn.classList.toggle("sel", selected);
      btn.setAttribute("aria-selected", String(selected));
    }
  }
}

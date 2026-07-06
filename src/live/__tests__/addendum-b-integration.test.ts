import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assignRails, resetRailsDiffState } from "../rails";
import { detectWins, resetCelebrateState, createCelebrationController } from "../celebrate";
import { buildModel } from "../../bracket/model";
import type { Draw, DrawId } from "../../bracket/types";
import type { LiveMatch, LiveOverlay } from "../types";
import gentlemensRaw from "../../data/gentlemens-singles.json";
import ladiesRaw from "../../data/ladies-singles.json";
import atpFixture from "../fixtures/espn-atp-sample.json";
import { espnToLiveMatches } from "../adapter";
import { enrichMatches, matchLiveToNodes } from "../reconcile";

const gentlemensDraw = gentlemensRaw as unknown as Draw;
const ladiesDraw = ladiesRaw as unknown as Draw;
const DRAWS: Record<DrawId, Draw> = {
  "gentlemens-singles": gentlemensDraw,
  "ladies-singles": ladiesDraw,
};

const css = readFileSync(fileURLToPath(new URL("../../styles/live.css", import.meta.url)), "utf-8");

/* ============================================================================
   Panel <-> rails reconciliation (URS-125, URS-126). The actual show/hide is a
   pure CSS breakpoint (no JS branching -- both the panel and the rails are
   ALWAYS rendered into the DOM from the SAME LiveEngineState; only the
   stylesheet decides which is visible at a given viewport width). This suite
   verifies (a) the single stylesheet contract that guarantees "never both
   visible" exists and is wired to the documented constant, and (b) that both
   the rails assignment and the panel's own data source (state.matches) are
   fed from literally the same reconciled data with no second data path.
============================================================================ */
describe("Panel <-> rails reconciliation (URS-125, URS-126) -- one live UI per breakpoint", () => {
  it("live.css declares the breakpoint pairing that hides the panel when rails show, and vice versa", () => {
    // Wide: rails visible, panel hidden.
    const wideBlockMatch = css.match(/@media \(min-width: 1180px\) \{([\s\S]*?)\n\}/);
    expect(wideBlockMatch).toBeTruthy();
    const wideBlock = wideBlockMatch![1] ?? "";
    expect(wideBlock).toMatch(/\.rail\s*\{[^}]*display:\s*flex/);
    expect(wideBlock).toMatch(/#live-scoreboard\s*\{[^}]*display:\s*none/);

    // Narrow: rails hidden, panel shown.
    const narrowBlockMatch = css.match(/@media \(max-width: 1179\.98px\) \{([\s\S]*?)\n\}/);
    expect(narrowBlockMatch).toBeTruthy();
    const narrowBlock = narrowBlockMatch![1] ?? "";
    expect(narrowBlock).toMatch(/\.rail\s*\{[^}]*display:\s*none/);
    expect(narrowBlock).toMatch(/#live-scoreboard\s*\{[^}]*display:\s*block/);
  });

  it("the breakpoint mirrors the documented RAILS_MIN_WIDTH_PX constant (URS-126)", async () => {
    const { RAILS_MIN_WIDTH_PX } = await import("../endpoints");
    expect(RAILS_MIN_WIDTH_PX).toBe(1180);
  });

  it("rails.ts's assignment and the panel's `in` matches are derived from the SAME reconciled LiveMatch[] -- no second data path", () => {
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay } = matchLiveToNodes(enriched, gentlemensDraw, model);
    const overlaysByDraw: Record<DrawId, LiveOverlay> = {
      "gentlemens-singles": overlay,
      "ladies-singles": {},
    };

    // The panel would show `in` matches from `enriched` directly (as
    // live-store.ts does); the rails derive from the exact same array plus
    // the exact same overlay -- verify both "views" agree on which matches
    // are `in`.
    const inMatches = enriched.filter((m) => m.state === "in");
    const { left, right } = assignRails(enriched, overlaysByDraw, DRAWS);
    const railMatchIds = new Set([...left, ...right].map((c) => c.match.id));
    for (const m of inMatches) {
      expect(railMatchIds.has(m.id)).toBe(true);
    }
    // And the rails never include a non-'in' match.
    for (const card of [...left, ...right]) {
      expect(card.match.state).toBe("in");
    }
  });
});

/* ============================================================================
   Reduced-motion behaviour (URS-113, URS-118) -- the animated vs static
   fallback is implemented purely in CSS (no JS branch to unit test directly),
   so this suite verifies the STYLESHEET CONTRACT: every animation this
   addendum introduces has a matching `prefers-reduced-motion: reduce` rule
   that disables it, per URS-113/URS-118's binding requirement.
============================================================================ */
describe("Reduced-motion CSS contract (URS-113, URS-118)", () => {
  const reducedMotionBlocks = [
    ...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g),
  ].map((m) => m[1] ?? "");
  const allReducedMotionCSS = reducedMotionBlocks.join("\n");

  it("B.2 pulse ring: animation is disabled under reduced-motion (URS-118)", () => {
    expect(css).toMatch(
      /\.flag-wrap\.live:not\(\.win\):not\(\.eliminated\)::after\s*\{[^}]*animation:\s*live-pulse-ring/,
    );
    expect(allReducedMotionCSS).toMatch(
      /\.flag-wrap\.live:not\(\.win\):not\(\.eliminated\)::after\s*\{[^}]*animation:\s*none/,
    );
  });

  it("B.1 celebration confetti + pop are fully suppressed under reduced-motion (URS-113), banner still renders", () => {
    expect(allReducedMotionCSS).toMatch(/\.celebration-card\s*\{[^}]*animation:\s*none/);
    expect(allReducedMotionCSS).toMatch(
      /\.cel-confetti\s*\{[^}]*(display:\s*none|animation:\s*none)/,
    );
    // The card element itself is not display:none anywhere -- content must
    // still render (only the animation/particles are suppressed).
    expect(css).not.toMatch(/\.celebration-card\s*\{[^}]*display:\s*none/);
  });
});

/* ============================================================================
   Feed-down / off-season degradation across all three upgrades (B0.2,
   URS-129.4): with an EMPTY matches array (what live-store.ts publishes on
   total failure / non-Wimbledon), none of the three upgrades produce
   anything.
============================================================================ */
describe("Shared degradation (B0.2): empty engine state -> nothing fires/appears", () => {
  beforeEach(() => {
    resetCelebrateState();
    resetRailsDiffState();
  });

  it("detectWins on an empty matches array never fires a celebration", () => {
    expect(detectWins([])).toEqual([]);
    expect(detectWins([])).toEqual([]);
  });

  it("assignRails on empty matches + empty overlays yields empty rails", () => {
    const emptyOverlays: Record<DrawId, LiveOverlay> = {
      "gentlemens-singles": {},
      "ladies-singles": {},
    };
    const result = assignRails([], emptyOverlays, DRAWS);
    expect(result.left).toEqual([]);
    expect(result.right).toEqual([]);
    expect(result.unplaced).toEqual([]);
  });

  it("createCelebrationController no-ops gracefully with a missing mount point (URS-114)", () => {
    const announcements: string[] = [];
    const controller = createCelebrationController(null, (t) => announcements.push(t));
    expect(() =>
      controller.enqueue({
        id: "x",
        winnerName: "Someone",
        opponentName: "",
        detail: "",
        scoreText: "",
      }),
    ).not.toThrow();
    expect(() => controller.destroy()).not.toThrow();
    // No-op means it must not have tried to announce either (nothing to show).
    expect(announcements).toEqual([]);
  });
});

// Keep the imported LiveMatch type referenced so a future refactor that drops
// unused imports doesn't silently break this file's type-checking coverage.
void (null as unknown as LiveMatch);

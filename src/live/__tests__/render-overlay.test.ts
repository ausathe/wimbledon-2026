import { describe, it, expect } from "vitest";
import { buildModel } from "../../bracket/model";
import { renderBracket, renderResultsList } from "../../bracket/render";
import { matchLiveToNodes, enrichMatches } from "../reconcile";
import { espnToLiveMatches } from "../adapter";
import type { Draw } from "../../bracket/types";
import type { LiveOverlay } from "../types";
import gentlemensRaw from "../../data/gentlemens-singles.json";
import atpFixture from "../fixtures/espn-atp-sample.json";

const gentlemensDraw = gentlemensRaw as unknown as Draw;

/** URS-85, URS-88: removing/omitting the overlay must reproduce the EXACT
 * pre-feature render -- this is the core regression guard for the merge hook. */
describe("renderBracket overlay merge hook (URS-85, URS-88, URS-89, URS-93)", () => {
  it("produces identical output whether overlay is omitted, undefined, or {}", () => {
    const model = buildModel(gentlemensDraw);
    const base = { draw: gentlemensDraw, model, prevWinners: {}, nowMs: Date.now() };
    const a = renderBracket(base);
    const b = renderBracket({ ...base, overlay: undefined });
    const c = renderBracket({ ...base, overlay: {} });
    expect(a.html).toBe(b.html);
    expect(a.html).toBe(c.html);
  });

  it("overlays a live 'in' match's score onto its bracket node and forces the live status class", () => {
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay } = matchLiveToNodes(enriched, gentlemensDraw, model);

    expect(overlay[17]).toBeDefined(); // Sinner vs Mochizuki, live, R16

    const withoutOverlay = renderBracket({
      draw: gentlemensDraw,
      model,
      prevWinners: {},
      nowMs: Date.now(),
    });
    const withOverlay = renderBracket({
      draw: gentlemensDraw,
      model,
      prevWinners: {},
      nowMs: Date.now(),
      overlay,
    });

    // The overlaid render must differ (live class/score present) while the
    // non-overlaid render is unaffected.
    expect(withOverlay.html).not.toBe(withoutOverlay.html);
    expect(withOverlay.html).toContain(" live");
    expect(withOverlay.html).toContain('data-live="1"');
  });

  it("reflects a live 'post' winner even if the local snapshot had that node pending", () => {
    // Construct a minimal draw where node 1 is NOT yet decided locally, then
    // overlay a live 'post' result onto it (URS-89 second sentence).
    const draw: Draw = {
      id: "gentlemens-singles",
      label: "Gentlemen's Singles",
      bestOf: 5,
      rootNum: 3,
      children: { 3: [1, 2] },
      matches: [
        { num: 1, p1: "g-sinner", p2: "g-brooksby" }, // no score locally -> pending
        { num: 2, p1: "g-zverev", p2: "g-lehecka", score: [{ games: [6, 4] }, { games: [6, 4] }] },
      ],
      placeholder: false,
    };
    const model = buildModel(draw);
    expect(model[1]?.winner).toBeNull();

    const overlay: LiveOverlay = {
      1: {
        state: "post",
        sets: [{ games: [6, 3] }, { games: [6, 2] }],
        currentSetIndex: -1,
        detail: "Final",
        winnerPlayerId: "g-sinner",
      },
    };
    const result = renderBracket({ draw, model, prevWinners: {}, nowMs: Date.now(), overlay });
    // Sinner's leaf token should now render with the "win" class (decided by
    // the live overlay, not the local snapshot) and carry the live data-*
    // attributes reflecting the overlaid "post" result (URS-89).
    expect(result.html).toContain('class="flag-wrap r0 win"');
    expect(result.html).toContain('alt="Jannik Sinner (IT)"');
    expect(result.html).toContain('data-score="6–3, 6–2"');
    expect(result.html).toContain('data-live="1"');
  });

  it("renderResultsList text alternative stays consistent with the overlay (URS-48, URS-93)", () => {
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay } = matchLiveToNodes(enriched, gentlemensDraw, model);

    const withOverlay = renderResultsList(gentlemensDraw, model, overlay);
    const withoutOverlay = renderResultsList(gentlemensDraw, model);
    expect(withOverlay).toContain("(live)");
    expect(withoutOverlay).not.toContain("(live)");
  });
});

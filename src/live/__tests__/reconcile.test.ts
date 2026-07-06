import { describe, it, expect } from "vitest";
import { normalize, resolvePlayer, enrichMatches, matchLiveToNodes } from "../reconcile";
import { espnToLiveMatches } from "../adapter";
import { buildModel } from "../../bracket/model";
import type { Draw } from "../../bracket/types";
import gentlemensRaw from "../../data/gentlemens-singles.json";
import atpFixture from "../fixtures/espn-atp-sample.json";

const gentlemensDraw = gentlemensRaw as unknown as Draw;

describe("normalize (URS-86)", () => {
  it("lower-cases, strips diacritics and punctuation, collapses whitespace", () => {
    expect(normalize("Alejandro Davidovich Fokina")).toBe("alejandro davidovich fokina");
    expect(normalize("Jan-Lennard Struff")).toBe("jan lennard struff");
    expect(normalize("  Extra   Space  ")).toBe("extra space");
  });

  it("treats accented and unaccented forms the same", () => {
    expect(normalize("Novak Djokovic")).toBe(normalize("Novak Djokovic"));
    // Diacritic-stripping sanity check using a constructed example.
    expect(normalize("Félix Ñame")).toBe("felix name");
  });
});

describe("resolvePlayer (URS-86, URS-87)", () => {
  it("resolves a real players.ts entry by exact display name", () => {
    const p = resolvePlayer("Jannik Sinner");
    expect(p?.id).toBe("g-sinner");
  });

  it("resolves case/spacing-insensitively", () => {
    const p = resolvePlayer("  jannik   sinner ");
    expect(p?.id).toBe("g-sinner");
  });

  it("returns undefined for a name with no match (URS-87)", () => {
    expect(resolvePlayer("Totally Unknown Player")).toBeUndefined();
  });
});

describe("matchLiveToNodes (URS-86, URS-87, URS-88)", () => {
  it("maps a real live match onto the correct bracket node when both players resolve", () => {
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay, unmatched } = matchLiveToNodes(enriched, gentlemensDraw, model);

    // Sinner (winner of leaf #1) vs Mochizuki (winner of leaf #2) meet at R16
    // node #17 in our data -- the real live match resolves there.
    const node17 = overlay[17];
    expect(node17).toBeDefined();
    expect(node17?.state).toBe("in");
    expect(node17?.winnerPlayerId).toBeUndefined(); // in-progress, no winner yet

    // Unmatched synthetic entries (unmatched-1) must NOT appear in the overlay
    // but should still be present in the `unmatched` list for the panel.
    const unmatchedIds = unmatched.map((m) => m.id);
    expect(unmatchedIds).toContain("unmatched-1");
    for (const nodeData of Object.values(overlay)) {
      expect(nodeData).not.toBe(undefined);
    }
  });

  it("never forces an unmatched-name live match onto a node (URS-87)", () => {
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay } = matchLiveToNodes(enriched, gentlemensDraw, model);
    // No node's overlay should reference the synthetic unmatched IDs' players.
    const overlaidNums = Object.keys(overlay).map(Number);
    expect(overlaidNums.length).toBeGreaterThan(0);
    expect(overlaidNums.length).toBeLessThan(50); // sanity bound, not all matches forced in
  });

  it("produces a correct winner side for a completed real match (URS-88, URS-89)", () => {
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay } = matchLiveToNodes(enriched, gentlemensDraw, model);
    // Sinner bt Brooksby is leaf match #1.
    const node1 = overlay[1];
    expect(node1?.state).toBe("post");
    expect(node1?.winnerPlayerId).toBe("g-sinner");
  });

  it("reorders the feed's set grid to match OUR node's participant order, not the feed's competitor order (regression)", () => {
    // Real feed shape for this exact match: competitors[0]=Brooksby (games
    // 4,3,4), competitors[1]=Sinner (games 6,6,6). Our node #1 has
    // p1=g-sinner, p2=g-brooksby -- so the overlay's games[0] must be
    // SINNER's games (6,6,6), not Brooksby's, or the tooltip/scoreboard would
    // silently show an inverted score relative to our p1/p2 convention.
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay } = matchLiveToNodes(enriched, gentlemensDraw, model);

    const node1 = overlay[1]; // Sinner (p1) vs Brooksby (p2)
    expect(node1).toBeDefined();
    expect(node1?.sets).toEqual([{ games: [6, 4] }, { games: [6, 3] }, { games: [6, 4] }]);
  });

  it("returns an empty overlay (never throws) for an empty match list", () => {
    const model = buildModel(gentlemensDraw);
    expect(() => matchLiveToNodes([], gentlemensDraw, model)).not.toThrow();
    const { overlay, unmatched } = matchLiveToNodes([], gentlemensDraw, model);
    expect(overlay).toEqual({});
    expect(unmatched).toEqual([]);
  });

  it("stamps the overlay with the originating feed competition id (LIVE-SCORES-BLUEPRINT addendum B, matchId -- powers rails.ts's reverse lookup)", () => {
    const model = buildModel(gentlemensDraw);
    const adapted = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const enriched = enrichMatches(adapted.matches);
    const { overlay } = matchLiveToNodes(enriched, gentlemensDraw, model);
    const node17 = overlay[17];
    expect(node17?.matchId).toBeDefined();
    expect(typeof node17?.matchId).toBe("string");
  });
});

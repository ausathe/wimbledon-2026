import { describe, it, expect } from "vitest";
import { assignRails, filterMatchesForDraw, filterOverlaysForDraw } from "../rails";
import { detectWins, resetCelebrateState } from "../celebrate";
import type { Draw, DrawId } from "../../bracket/types";
import type { LiveMatch, LiveOverlay } from "../types";
import gentlemensRaw from "../../data/gentlemens-singles.json";
import ladiesRaw from "../../data/ladies-singles.json";

const gentlemensDraw = gentlemensRaw as unknown as Draw;
const ladiesDraw = ladiesRaw as unknown as Draw;
const DRAWS: Record<DrawId, Draw> = {
  "gentlemens-singles": gentlemensDraw,
  "ladies-singles": ladiesDraw,
};

/* Draw-scope requirement: the persistent rails AND the "Live now" panel must
 * show ONLY the currently-selected draw's live matches (men's-only on the
 * Gentlemen's page, women's-only on the Ladies' page), and switching the
 * toggle must re-filter immediately from the last cached poll. Win
 * celebrations are explicitly OUT of scope and must stay unfiltered
 * (confirmed client decision) -- covered at the bottom of this file. */

function makeMatch(overrides: Partial<LiveMatch> & Pick<LiveMatch, "id" | "drawKind">): LiveMatch {
  return {
    state: "in",
    detail: "3rd Set",
    players: [
      { displayName: "P1", normalizedKey: "p1" },
      { displayName: "P2", normalizedKey: "p2" },
    ],
    sets: [{ games: [6, 4] }],
    currentSetIndex: 0,
    ...overrides,
  };
}

function overlayFor(drawId: DrawId, nodeNum: number, matchId: string): Record<DrawId, LiveOverlay> {
  const overlays: Record<DrawId, LiveOverlay> = {
    "gentlemens-singles": {},
    "ladies-singles": {},
  };
  overlays[drawId] = {
    [nodeNum]: {
      state: "in",
      sets: [{ games: [6, 4] }],
      currentSetIndex: 0,
      detail: "3rd Set",
      matchId,
    },
  };
  return overlays;
}

describe("filterMatchesForDraw -- draw-scoping helper shared by rails + panel", () => {
  it("keeps only matches whose drawKind equals the requested draw", () => {
    const mensMatch = makeMatch({ id: "mens-1", drawKind: "gentlemens-singles" });
    const womensMatch = makeMatch({ id: "womens-1", drawKind: "ladies-singles" });
    const mixed = [mensMatch, womensMatch];

    expect(filterMatchesForDraw(mixed, "gentlemens-singles")).toEqual([mensMatch]);
    expect(filterMatchesForDraw(mixed, "ladies-singles")).toEqual([womensMatch]);
  });

  it("an unplaced (unmatched) men's match does not leak into the ladies' filtered view", () => {
    // "Unplaced" just means no overlay node -- filterMatchesForDraw only cares
    // about drawKind, so an unbound men's match still must not appear once
    // filtered to ladies-singles.
    const unplacedMens = makeMatch({ id: "unplaced-mens", drawKind: "gentlemens-singles" });
    const filtered = filterMatchesForDraw([unplacedMens], "ladies-singles");
    expect(filtered).toEqual([]);
  });

  it("returns [] for an empty input, never throws", () => {
    expect(filterMatchesForDraw([], "gentlemens-singles")).toEqual([]);
  });
});

describe("filterOverlaysForDraw -- zeroes out the non-active draw's overlay slot", () => {
  it("keeps the active draw's overlay untouched and empties the other", () => {
    const overlays = overlayFor("gentlemens-singles", 1, "m1");
    const filtered = filterOverlaysForDraw(overlays, "gentlemens-singles");
    expect(filtered["gentlemens-singles"]).toEqual(overlays["gentlemens-singles"]);
    expect(filtered["ladies-singles"]).toEqual({});
  });

  it("empties the requested draw's slot too if a different draw is active", () => {
    const overlays = overlayFor("gentlemens-singles", 1, "m1");
    const filtered = filterOverlaysForDraw(overlays, "ladies-singles");
    expect(filtered["gentlemens-singles"]).toEqual({});
    expect(filtered["ladies-singles"]).toEqual({});
  });
});

describe("Rails scoped to the active draw via filterMatchesForDraw/filterOverlaysForDraw", () => {
  it("Gentlemen's draw selected: rails contain ONLY men's matches, even with a mixed live set", () => {
    const mens = makeMatch({ id: "mens-16", drawKind: "gentlemens-singles" });
    const womens = makeMatch({ id: "womens-16", drawKind: "ladies-singles" });
    const overlays: Record<DrawId, LiveOverlay> = {
      "gentlemens-singles": {
        16: { state: "in", sets: [], currentSetIndex: 0, detail: "", matchId: "mens-16" },
      },
      "ladies-singles": {
        16: { state: "in", sets: [], currentSetIndex: 0, detail: "", matchId: "womens-16" },
      },
    };

    const drawMatches = filterMatchesForDraw([mens, womens], "gentlemens-singles");
    const drawOverlays = filterOverlaysForDraw(overlays, "gentlemens-singles");
    const { left, right, unplaced } = assignRails(drawMatches, drawOverlays, DRAWS);
    const allIds = [...left, ...right, ...unplaced].map((c) => c.match.id);

    expect(allIds).toContain("mens-16");
    expect(allIds).not.toContain("womens-16");
  });

  it("Ladies' draw selected: rails contain ONLY women's matches, even with a mixed live set", () => {
    const mens = makeMatch({ id: "mens-16", drawKind: "gentlemens-singles" });
    const womens = makeMatch({ id: "womens-16", drawKind: "ladies-singles" });
    const overlays: Record<DrawId, LiveOverlay> = {
      "gentlemens-singles": {
        16: { state: "in", sets: [], currentSetIndex: 0, detail: "", matchId: "mens-16" },
      },
      "ladies-singles": {
        16: { state: "in", sets: [], currentSetIndex: 0, detail: "", matchId: "womens-16" },
      },
    };

    const drawMatches = filterMatchesForDraw([mens, womens], "ladies-singles");
    const drawOverlays = filterOverlaysForDraw(overlays, "ladies-singles");
    const { left, right, unplaced } = assignRails(drawMatches, drawOverlays, DRAWS);
    const allIds = [...left, ...right, ...unplaced].map((c) => c.match.id);

    expect(allIds).toContain("womens-16");
    expect(allIds).not.toContain("mens-16");
  });

  it("an unplaced (unbound) men's match does not leak onto the ladies' rails", () => {
    const unplacedMens = makeMatch({ id: "unplaced-mens", drawKind: "gentlemens-singles" });
    const womens = makeMatch({ id: "womens-16", drawKind: "ladies-singles" });
    const overlays = overlayFor("ladies-singles", 16, "womens-16");

    const drawMatches = filterMatchesForDraw([unplacedMens, womens], "ladies-singles");
    const drawOverlays = filterOverlaysForDraw(overlays, "ladies-singles");
    const { unplaced, right } = assignRails(drawMatches, drawOverlays, DRAWS);

    expect(unplaced.map((c) => c.match.id)).not.toContain("unplaced-mens");
    expect([...right].map((c) => c.match.id)).not.toContain("unplaced-mens");
  });
});

describe("Win celebrations stay UNFILTERED across draws (explicit client decision -- out of scope)", () => {
  it("detectWins returns wins for BOTH tours from a single mixed poll, unfiltered by draw", () => {
    resetCelebrateState();
    const mensLive = makeMatch({ id: "mens-1", drawKind: "gentlemens-singles", state: "in" });
    const womensLive = makeMatch({ id: "womens-1", drawKind: "ladies-singles", state: "in" });
    // Seed baseline (first call never celebrates -- URS-107.1).
    detectWins([mensLive, womensLive]);

    const mensFinished = makeMatch({
      id: "mens-1",
      drawKind: "gentlemens-singles",
      state: "post",
      players: [
        { displayName: "Men Winner", normalizedKey: "men winner", winner: true },
        { displayName: "Men Loser", normalizedKey: "men loser", winner: false },
      ],
    });
    const womensFinished = makeMatch({
      id: "womens-1",
      drawKind: "ladies-singles",
      state: "post",
      players: [
        { displayName: "Women Winner", normalizedKey: "women winner", winner: true },
        { displayName: "Women Loser", normalizedKey: "women loser", winner: false },
      ],
    });

    const wins = detectWins([mensFinished, womensFinished]);
    const winnerNames = wins.map((w) => w.winnerName);
    expect(winnerNames).toContain("Men Winner");
    expect(winnerNames).toContain("Women Winner");
  });
});

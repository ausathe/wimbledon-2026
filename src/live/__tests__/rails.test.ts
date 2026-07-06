import { describe, it, expect } from "vitest";
import { assignRails, resetRailsDiffState } from "../rails";
import { buildGeometry } from "../../bracket/layout";
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

/* node 1 (Sinner vs Brooksby, leaf) -- angleOf(1) = -11.25 (LEFT half).
 * node 16 (Zverev vs Giron, leaf) -- angleOf(16) = +168.75 (RIGHT half).
 * Verified directly against buildGeometry(gentlemensDraw) during build. */
function inMatch(overrides: Partial<LiveMatch> & Pick<LiveMatch, "id">): LiveMatch {
  return {
    drawKind: "gentlemens-singles",
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

describe("assignRails (URS-120…URS-124) -- angle-split, ordering, unbound bucket", () => {
  it("URS-121: assigns a node with a NEGATIVE angle to the LEFT rail", () => {
    const m = inMatch({ id: "left-node-1" });
    const overlays = overlayFor("gentlemens-singles", 1, "left-node-1");
    const { left, right } = assignRails([m], overlays, DRAWS);
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(0);
    expect(left[0]?.side).toBe("left");
    expect(left[0]?.angle).toBeLessThan(0);
  });

  it("URS-121: assigns a node with a NON-NEGATIVE angle to the RIGHT rail", () => {
    const m = inMatch({ id: "right-node-16" });
    const overlays = overlayFor("gentlemens-singles", 16, "right-node-16");
    const { left, right } = assignRails([m], overlays, DRAWS);
    expect(right).toHaveLength(1);
    expect(left).toHaveLength(0);
    expect(right[0]?.side).toBe("right");
    expect(right[0]?.angle).toBeGreaterThanOrEqual(0);
  });

  it("URS-121: orders left-rail cards top-to-bottom by the node's actual screen-Y (not insertion order)", () => {
    // node 1 (angle -11.25) vs node 25 (angle -45) -- both left-side; feed
    // them in REVERSE screen-Y order and assert assignRails re-sorts them.
    const geo = buildGeometry(gentlemensDraw);
    const y1 = geo.pt(geo.radius[geo.levelOf[1]!]!, geo.angleOf(1))[1];
    const y25 = geo.pt(geo.radius[geo.levelOf[25]!]!, geo.angleOf(25))[1];
    expect(y1).not.toBe(y25); // sanity: fixture actually differentiates them

    const mNode1 = inMatch({ id: "node-1" });
    const mNode25 = inMatch({ id: "node-25" });
    const overlays: Record<DrawId, LiveOverlay> = {
      "gentlemens-singles": {
        1: { state: "in", sets: [], currentSetIndex: 0, detail: "", matchId: "node-1" },
        25: { state: "in", sets: [], currentSetIndex: 0, detail: "", matchId: "node-25" },
      },
      "ladies-singles": {},
    };
    // Feed in the opposite order from their expected sorted (top-to-bottom) order.
    const feedOrder = y1 < y25 ? [mNode25, mNode1] : [mNode1, mNode25];
    const { left } = assignRails(feedOrder, overlays, DRAWS);
    expect(left).toHaveLength(2);
    const expectedFirst = y1 < y25 ? "node-1" : "node-25";
    expect(left[0]?.match.id).toBe(expectedFirst);
  });

  it("URS-121.1: an unbound (no-overlay) live match gets a deterministic placement, appended below matched right cards", () => {
    const boundRight = inMatch({ id: "bound-16" });
    const unbound = inMatch({
      id: "zzz-unbound",
      players: [
        { displayName: "Outside Player A", normalizedKey: "outside a" },
        { displayName: "Outside Player B", normalizedKey: "outside b" },
      ],
    });
    const overlays = overlayFor("gentlemens-singles", 16, "bound-16");
    const { right, unplaced } = assignRails([boundRight, unbound], overlays, DRAWS);
    expect(unplaced).toHaveLength(1);
    expect(unplaced[0]?.match.id).toBe("zzz-unbound");
    // Unbound appended AFTER the matched right cards.
    expect(right[right.length - 1]?.match.id).toBe("zzz-unbound");
    expect(right[0]?.match.id).toBe("bound-16");
  });

  it("URS-121.1: unbound matches are ordered deterministically by feed id (stable across polls)", () => {
    const u1 = inMatch({ id: "bbb" });
    const u2 = inMatch({ id: "aaa" });
    const overlays: Record<DrawId, LiveOverlay> = {
      "gentlemens-singles": {},
      "ladies-singles": {},
    };
    const { unplaced } = assignRails([u1, u2], overlays, DRAWS);
    expect(unplaced.map((c) => c.match.id)).toEqual(["aaa", "bbb"]);
  });

  it("only includes 'in' matches -- 'post'/'pre' matches never appear on a rail", () => {
    const done = inMatch({ id: "done-1", state: "post" });
    const upcoming = inMatch({ id: "pre-1", state: "pre" });
    const overlays = overlayFor("gentlemens-singles", 1, "done-1");
    const { left, right, unplaced } = assignRails([done, upcoming], overlays, DRAWS);
    expect(left).toHaveLength(0);
    expect(right).toHaveLength(0);
    expect(unplaced).toHaveLength(0);
  });

  it("empty engine state (no live matches) produces empty rails (URS-124)", () => {
    const { left, right, unplaced } = assignRails(
      [],
      { "gentlemens-singles": {}, "ladies-singles": {} },
      DRAWS,
    );
    expect(left).toEqual([]);
    expect(right).toEqual([]);
    expect(unplaced).toEqual([]);
  });
});

describe("resetRailsDiffState", () => {
  it("is callable without throwing (test isolation helper)", () => {
    expect(() => resetRailsDiffState()).not.toThrow();
  });
});

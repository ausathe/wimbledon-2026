import { describe, it, expect } from "vitest";
import { espnToLiveMatches } from "../adapter";
import atpFixture from "../fixtures/espn-atp-sample.json";
import wtaFixture from "../fixtures/espn-wta-sample.json";
import nonWimbledonFixture from "../fixtures/espn-non-wimbledon.json";
import emptyEventsFixture from "../fixtures/espn-empty-events.json";
import noLiveFixture from "../fixtures/espn-wimbledon-no-live.json";
import malformedRootFixture from "../fixtures/espn-malformed-root.json";
import bothGroupingsFixture from "../fixtures/espn-both-groupings.json";

describe("espnToLiveMatches (URS-81..84)", () => {
  it("parses real in/post matches from the ATP fixture and skips malformed ones (URS-83)", () => {
    const result = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    expect(result.isWimbledon).toBe(true);
    expect(result.groupingFound).toBe(true);

    // 3 real 'in' + 2 real 'post' + 1 'pre' + 1 unmatched-but-well-formed 'in' = 7 valid matches.
    // The 4 synthetic "bad-*" entries and the doubles competition must be skipped.
    const ids = result.matches.map((m) => m.id);
    expect(ids).not.toContain("bad-1");
    expect(ids).not.toContain("bad-2");
    expect(ids).not.toContain("bad-4");
    expect(ids).not.toContain("doubles-1");

    // bad-3 has ONE malformed set index (non-numeric value at index 0 for
    // player one) but a valid pair at index 1 -- URS-83 requires skipping
    // only the malformed set index, not the whole match: the match still
    // parses, with sets[] containing just the one valid pair.
    const bad3 = result.matches.find((m) => m.id === "bad-3");
    expect(bad3).toBeDefined();
    expect(bad3?.sets).toEqual([{ games: [4, 6] }]);

    const live = result.matches.filter((m) => m.state === "in");
    expect(live.length).toBeGreaterThanOrEqual(3);

    const sinnerMatch = result.matches.find((m) =>
      m.players.some((p) => p.displayName === "Jannik Sinner"),
    );
    expect(sinnerMatch).toBeDefined();
  });

  it("assembles a correct SetScore grid with tiebreak pairs (URS-84)", () => {
    const result = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const hurkaczStruff = result.matches.find((m) => m.id === "177488");
    expect(hurkaczStruff).toBeDefined();
    expect(hurkaczStruff?.state).toBe("in");
    expect(hurkaczStruff?.detail).toBe("4th Set");
    expect(hurkaczStruff?.court).toBe("No. 2 Court");
    // competitors[0] = Struff (away), competitors[1] = Hurkacz (home) -> games[0]=Struff, games[1]=Hurkacz
    expect(hurkaczStruff?.sets[0]).toEqual({ games: [3, 6] });
    expect(hurkaczStruff?.sets[1]).toEqual({ games: [6, 7], tb: [5, 7] });
    expect(hurkaczStruff?.sets[2]).toEqual({ games: [7, 6], tb: [7, 2] });
    expect(hurkaczStruff?.sets[3]).toEqual({ games: [6, 5] });
    expect(hurkaczStruff?.currentSetIndex).toBe(hurkaczStruff!.sets.length - 1);
  });

  it("marks the server via possession (URS-90)", () => {
    const result = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const sinnerMatch = result.matches.find((m) => m.id === "177476");
    const sinner = sinnerMatch?.players.find((p) => p.displayName === "Jannik Sinner");
    const mochizuki = sinnerMatch?.players.find((p) => p.displayName === "Shintaro Mochizuki");
    expect(sinner?.serving).toBe(true);
    expect(mochizuki?.serving).toBe(false);
  });

  it("marks the winner side for a post match (URS-84)", () => {
    const result = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    const finalMatch = result.matches.find((m) => m.id === "177478");
    const sinner = finalMatch?.players.find((p) => p.displayName === "Jannik Sinner");
    const brooksby = finalMatch?.players.find((p) => p.displayName === "Jenson Brooksby");
    expect(sinner?.winner).toBe(true);
    expect(brooksby?.winner).toBe(false);
    expect(finalMatch?.state).toBe("post");
    expect(finalMatch?.currentSetIndex).toBe(-1);
  });

  it("ignores doubles groupings entirely (URS-82)", () => {
    const result = espnToLiveMatches(atpFixture, "gentlemens-singles", "men");
    expect(result.matches.some((m) => m.id === "doubles-1")).toBe(false);
  });

  it("regression: does not cross-match 'Women's Singles' when filtering for 'men' (both live endpoints return the FULL tournament payload, including both singles groupings, in every response)", () => {
    // Real-world discovery: the ATP and WTA scoreboard URLs both return every
    // grouping (Men's Singles, Women's Singles, + doubles) in each response.
    // A naive substring check for "men's singles" would also match inside
    // "wo-MEN'S SINGLES", silently duplicating the women's draw into the
    // men's drawKind (and the men's -- via a parallel bug -- into women's).
    const menResult = espnToLiveMatches(wtaFixture, "gentlemens-singles", "men");
    expect(menResult.matches).toEqual([]); // wtaFixture only HAS a Women's Singles grouping

    const womenResultFromAtp = espnToLiveMatches(atpFixture, "ladies-singles", "women");
    expect(womenResultFromAtp.matches).toEqual([]); // atpFixture only has a Men's Singles grouping
  });

  it("regression: a single payload containing BOTH singles groupings is filtered correctly by gender (the real-world shape)", () => {
    const menResult = espnToLiveMatches(bothGroupingsFixture, "gentlemens-singles", "men");
    expect(menResult.matches.map((m) => m.id)).toEqual(["men-1"]);

    const womenResult = espnToLiveMatches(bothGroupingsFixture, "ladies-singles", "women");
    expect(womenResult.matches.map((m) => m.id)).toEqual(["women-1"]);
  });

  it("parses the WTA fixture's singles grouping, ignoring the empty doubles grouping (URS-82)", () => {
    const result = espnToLiveMatches(wtaFixture, "ladies-singles", "women");
    expect(result.isWimbledon).toBe(true);
    expect(result.groupingFound).toBe(true);
    expect(result.matches.length).toBe(2);
    const pegulaMatch = result.matches.find((m) =>
      m.players.some((p) => p.displayName === "Jessica Pegula"),
    );
    expect(pegulaMatch?.state).toBe("post");
  });

  it("degrades to no live data for a non-Wimbledon event (URS-81, URS-99)", () => {
    const result = espnToLiveMatches(nonWimbledonFixture, "gentlemens-singles", "men");
    expect(result.isWimbledon).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it("degrades to no live data when events[] is empty (off-season, URS-99)", () => {
    const result = espnToLiveMatches(emptyEventsFixture, "gentlemens-singles", "men");
    expect(result.isWimbledon).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it("reports isWimbledon=true with zero live matches distinctly (URS-100)", () => {
    const result = espnToLiveMatches(noLiveFixture, "gentlemens-singles", "men");
    expect(result.isWimbledon).toBe(true);
    expect(result.groupingFound).toBe(true);
    // The only competition is 'pre' -- parseable but not 'in'/'post', so it IS
    // included as a match (pre state is valid) but contributes to liveCount=0
    // at the store layer, not here.
    expect(result.matches.every((m) => m.state === "pre")).toBe(true);
  });

  it("never throws on a grossly malformed root payload (URS-83, URS-98)", () => {
    expect(() => espnToLiveMatches(malformedRootFixture, "gentlemens-singles", "men")).not.toThrow();
    const result = espnToLiveMatches(malformedRootFixture, "gentlemens-singles", "men");
    expect(result.matches).toEqual([]);
    expect(result.isWimbledon).toBe(false);
  });

  it("never throws on primitive/null/undefined input (URS-83, URS-98)", () => {
    for (const bad of [null, undefined, "a string", 42, [], true]) {
      expect(() => espnToLiveMatches(bad, "gentlemens-singles", "men")).not.toThrow();
    }
  });
});

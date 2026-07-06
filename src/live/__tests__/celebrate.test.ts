import { describe, it, expect, beforeEach } from "vitest";
import { detectWins, resetCelebrateState, celebrationAnnouncement } from "../celebrate";
import type { LiveMatch } from "../types";

/* Builds a minimal LiveMatch for detectWins() fixture purposes (URS-107…
 * URS-109). detectWins() is a pure function over LiveMatch[], so these
 * lightweight fixtures exercise it without needing raw ESPN JSON or the
 * network -- fully unit-testable per the addendum B build order. */
function match(overrides: Partial<LiveMatch> & Pick<LiveMatch, "id" | "state">): LiveMatch {
  return {
    drawKind: "gentlemens-singles",
    detail: "3rd Set",
    players: [
      {
        displayName: "Jannik Sinner",
        normalizedKey: "jannik sinner",
        playerId: "g-sinner",
        winner: undefined,
      },
      {
        displayName: "Shintaro Mochizuki",
        normalizedKey: "shintaro mochizuki",
        playerId: "g-mochizuki",
        winner: undefined,
      },
    ],
    sets: [{ games: [6, 3] }, { games: [6, 4] }],
    currentSetIndex: -1,
    ...overrides,
  };
}

function withWinner(m: LiveMatch, side: 0 | 1): LiveMatch {
  const players = [...m.players] as LiveMatch["players"];
  players[side] = { ...players[side], winner: true };
  players[side === 0 ? 1 : 0] = { ...players[side === 0 ? 1 : 0], winner: false };
  return { ...m, players };
}

describe("detectWins (URS-107…URS-109) -- win-transition detection", () => {
  beforeEach(() => resetCelebrateState());

  it("URS-107.1: does NOT celebrate a match that is already 'post' on the first poll (no historical replay)", () => {
    const already = withWinner(match({ id: "m1", state: "post" }), 0);
    const wins = detectWins([already]);
    expect(wins).toEqual([]);
    // Subsequent poll with the same still-post match: still nothing.
    const wins2 = detectWins([already]);
    expect(wins2).toEqual([]);
  });

  it("fires exactly once when a match transitions in -> post on a LATER poll", () => {
    const inProgress = match({ id: "m2", state: "in" });
    // First poll: seed baseline only.
    expect(detectWins([inProgress])).toEqual([]);

    // Second poll: same match now finished.
    const finished = withWinner({ ...inProgress, state: "post" }, 0);
    const wins = detectWins([finished]);
    expect(wins).toHaveLength(1);
    expect(wins[0]?.winnerName).toBe("Jannik Sinner");
    expect(wins[0]?.opponentName).toBe("Shintaro Mochizuki");
  });

  it("URS-107.2: dedupes -- does not re-fire for a match that keeps re-appearing as 'post'", () => {
    const inProgress = match({ id: "m3", state: "in" });
    detectWins([inProgress]); // seed
    const finished = withWinner({ ...inProgress, state: "post" }, 1);
    const firstWins = detectWins([finished]);
    expect(firstWins).toHaveLength(1);

    // Poll 3, 4, 5... the feed keeps listing it post -- must not re-fire.
    expect(detectWins([finished])).toEqual([]);
    expect(detectWins([finished])).toEqual([]);
  });

  it("URS-111.3: queues multiple simultaneous completions in one poll", () => {
    const a = match({ id: "a", state: "in" });
    const b = match({
      id: "b",
      state: "in",
      players: [
        { displayName: "Hubert Hurkacz", normalizedKey: "hubert hurkacz", playerId: "g-hurkacz" },
        {
          displayName: "Jan-Lennard Struff",
          normalizedKey: "jan-lennard struff",
          playerId: "g-struff",
        },
      ],
    });
    detectWins([a, b]); // seed both

    const aDone = withWinner({ ...a, state: "post" }, 0);
    const bDone = withWinner({ ...b, state: "post" }, 1);
    const wins = detectWins([aDone, bDone]);
    expect(wins).toHaveLength(2);
    expect(wins.map((w) => w.winnerName)).toEqual(["Jannik Sinner", "Jan-Lennard Struff"]);
  });

  it("does not celebrate an 'in'->'post' transition with no decided winner (malformed/no winner flag)", () => {
    const inProgress = match({ id: "m4", state: "in" });
    detectWins([inProgress]);
    // 'post' but neither player carries winner:true -- degenerate/partial feed data.
    const noWinner = { ...inProgress, state: "post" as const };
    expect(detectWins([noWinner])).toEqual([]);
  });

  it("URS-107.3: feed-down / empty poll produces no fabricated completions", () => {
    detectWins([]); // seed with nothing
    expect(detectWins([])).toEqual([]);
  });

  it("does not fire for a match still 'in' (no transition yet)", () => {
    const inProgress = match({ id: "m5", state: "in" });
    detectWins([inProgress]);
    expect(detectWins([inProgress])).toEqual([]);
  });
});

describe("celebrationAnnouncement (URS-112) -- concise aria-live text", () => {
  it("includes winner, opponent, and score", () => {
    const text = celebrationAnnouncement({
      id: "x",
      winnerName: "Kostyuk",
      opponentName: "Świątek",
      detail: "Quarter-final",
      scoreText: "6–3, 7–5",
    });
    expect(text).toBe("Kostyuk wins, def. Świątek 6–3, 7–5");
  });

  it("degrades gracefully with no opponent/score (unbound/partial data)", () => {
    const text = celebrationAnnouncement({
      id: "y",
      winnerName: "Some Player",
      opponentName: "",
      detail: "",
      scoreText: "",
    });
    expect(text).toBe("Some Player wins");
  });
});

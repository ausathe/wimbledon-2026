import { describe, it, expect, beforeEach } from "vitest";
import { renderScoreboard, updateAgoStampAndPulse, resetScoreboardDiffState, type ScoreboardMount } from "../scoreboard";
import type { LiveEngineState, LiveMatch } from "../types";

/* JSDOM-free DOM shim: these tests only need element-like objects with the
   handful of properties scoreboard.ts touches (innerHTML/textContent/
   classList), so a tiny stub is enough to keep this fixture-testable without
   pulling in a browser environment (per the build's testability note). */
function makeEl(): HTMLElement {
  const classes = new Set<string>();
  return {
    innerHTML: "",
    textContent: "",
    classList: {
      toggle: (cls: string, force?: boolean) => {
        const on = force ?? !classes.has(cls);
        if (on) classes.add(cls);
        else classes.delete(cls);
      },
      contains: (cls: string) => classes.has(cls),
    },
  } as unknown as HTMLElement;
}

function makeMount(): ScoreboardMount {
  return {
    root: makeEl(),
    cardsEl: makeEl(),
    liveRegionEl: makeEl(),
    agoEl: makeEl(),
    badgeEl: makeEl(),
  };
}

function baseState(overrides: Partial<LiveEngineState> = {}): LiveEngineState {
  return {
    ok: true,
    isWimbledon: true,
    lastPollMs: Date.now(),
    matches: [],
    overlays: { "gentlemens-singles": {}, "ladies-singles": {} },
    liveCount: 0,
    unmatchedCount: 0,
    ...overrides,
  };
}

function makeMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: "m1",
    drawKind: "gentlemens-singles",
    state: "in",
    detail: "2nd Set",
    court: "Centre Court",
    players: [
      { displayName: "Player A", normalizedKey: "player a", serving: true },
      { displayName: "Player B", normalizedKey: "player b", serving: false },
    ],
    sets: [{ games: [6, 3] }, { games: [2, 1] }],
    currentSetIndex: 1,
    ...overrides,
  };
}

describe("renderScoreboard (URS-90, URS-99, URS-100)", () => {
  beforeEach(() => resetScoreboardDiffState());

  it("shows the off-season empty state distinctly (URS-99)", () => {
    const mount = makeMount();
    renderScoreboard(baseState({ isWimbledon: false, matches: [] }), mount);
    expect(mount.cardsEl.innerHTML).toContain("showing the latest bracket");
  });

  it("shows the 'no matches live right now' state when Wimbledon but zero live/post (URS-100)", () => {
    const mount = makeMount();
    renderScoreboard(baseState({ isWimbledon: true, matches: [] }), mount);
    expect(mount.cardsEl.innerHTML).toContain("No matches live right now");
  });

  it("renders a live match as a table with a LIVE badge and tiebreak superscript", () => {
    const mount = makeMount();
    const match = makeMatch({ sets: [{ games: [7, 6], tb: [7, 4] }, { games: [2, 1] }] });
    renderScoreboard(baseState({ matches: [match] }), mount);
    expect(mount.cardsEl.innerHTML).toContain("<table");
    expect(mount.cardsEl.innerHTML).toContain("ls-live");
    expect(mount.cardsEl.innerHTML).toContain("LIVE");
    expect(mount.cardsEl.innerHTML).toContain('<sup class="ls-tb">4</sup>');
  });

  it("sorts 'in' matches before today's 'post' matches (URS-100, CQ-A3)", () => {
    const mount = makeMount();
    const post = makeMatch({ id: "post1", state: "post", players: [
      { displayName: "Winner Guy", normalizedKey: "winner guy", winner: true },
      { displayName: "Loser Guy", normalizedKey: "loser guy", winner: false },
    ] });
    const live = makeMatch({ id: "live1" });
    renderScoreboard(baseState({ matches: [post, live] }), mount);
    const html = mount.cardsEl.innerHTML;
    expect(html.indexOf("live1")).toBeLessThan(html.indexOf("post1"));
  });

  it("marks the server with a dot when the feed provides possession", () => {
    const mount = makeMount();
    renderScoreboard(baseState({ matches: [makeMatch()] }), mount);
    expect(mount.cardsEl.innerHTML).toContain("ls-serve-dot");
  });

  it("never throws on an empty players/sets shape", () => {
    const mount = makeMount();
    const weird = makeMatch({ sets: [] });
    expect(() => renderScoreboard(baseState({ matches: [weird] }), mount)).not.toThrow();
  });

  it("updates the aria-live region only on a real score change, not every render", () => {
    const mount = makeMount();
    const m1 = makeMatch({ sets: [{ games: [6, 3] }] });
    renderScoreboard(baseState({ matches: [m1] }), mount);
    const firstAnnouncement = mount.liveRegionEl.textContent;
    expect(firstAnnouncement).not.toBe("");

    // Re-render with the SAME data -- must not re-announce (still throttled).
    mount.liveRegionEl.textContent = "";
    renderScoreboard(baseState({ matches: [m1] }), mount);
    expect(mount.liveRegionEl.textContent).toBe("");

    // Now a real change -- must announce again.
    const m2 = makeMatch({ sets: [{ games: [6, 3] }, { games: [1, 0] }] });
    renderScoreboard(baseState({ matches: [m2] }), mount);
    expect(mount.liveRegionEl.textContent).not.toBe("");
  });
});

describe("updateAgoStampAndPulse (URS-95, URS-96, URS-101)", () => {
  it("shows 'Live feed unavailable' text when not ok, without pulsing", () => {
    const mount = makeMount();
    updateAgoStampAndPulse(baseState({ ok: false, liveCount: 0 }), mount);
    expect(mount.agoEl.textContent).toContain("unavailable");
    expect(mount.badgeEl.classList.contains("ls-pulsing")).toBe(false);
  });

  it("pulses only when ok AND liveCount > 0 (URS-100 last sentence)", () => {
    const mount = makeMount();
    updateAgoStampAndPulse(baseState({ ok: true, liveCount: 0 }), mount);
    expect(mount.badgeEl.classList.contains("ls-pulsing")).toBe(false);

    updateAgoStampAndPulse(baseState({ ok: true, liveCount: 2 }), mount);
    expect(mount.badgeEl.classList.contains("ls-pulsing")).toBe(true);
  });

  it("never touches cardsEl/liveRegionEl (tick must not rebuild cards, URS-95)", () => {
    const mount = makeMount();
    mount.cardsEl.innerHTML = "<p>sentinel</p>";
    updateAgoStampAndPulse(baseState({ liveCount: 1 }), mount);
    expect(mount.cardsEl.innerHTML).toBe("<p>sentinel</p>");
  });
});

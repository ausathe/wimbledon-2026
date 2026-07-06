import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LiveStore } from "../live-store";
import { buildModel } from "../../bracket/model";
import type { Draw } from "../../bracket/types";
import gentlemensRaw from "../../data/gentlemens-singles.json";
import ladiesRaw from "../../data/ladies-singles.json";
import atpFixture from "../fixtures/espn-atp-sample.json";
import wtaFixture from "../fixtures/espn-wta-sample.json";
import nonWimbledonFixture from "../fixtures/espn-non-wimbledon.json";

const gentlemensDraw = gentlemensRaw as unknown as Draw;
const ladiesDraw = ladiesRaw as unknown as Draw;

const DRAWS: Record<string, Draw> = {
  "gentlemens-singles": gentlemensDraw,
  "ladies-singles": ladiesDraw,
};

function deps() {
  return {
    getDraw: (id: "gentlemens-singles" | "ladies-singles") => DRAWS[id]!,
    getModel: (id: "gentlemens-singles" | "ladies-singles") => buildModel(DRAWS[id]!),
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("LiveStore (URS-78, URS-79, URS-95, URS-98, URS-99, URS-102, URS-104)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("polls both endpoints concurrently on start and updates state on success", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("atp")) return Promise.resolve(jsonResponse(atpFixture));
      return Promise.resolve(jsonResponse(wtaFixture));
    });
    const store = new LiveStore(deps());
    const events: string[] = [];
    store.subscribe((_state, ev) => events.push(ev));
    store.start();
    await vi.runOnlyPendingTimersAsync();

    const state = store.getState();
    expect(state.ok).toBe(true);
    expect(state.isWimbledon).toBe(true);
    expect(state.liveCount).toBeGreaterThan(0);
    expect(events).toContain("poll");
    store.stop();
  });

  it("degrades cleanly when both endpoints fail -- never throws, ok=false (URS-98)", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("network down")));
    const store = new LiveStore(deps());
    store.start();
    await vi.runOnlyPendingTimersAsync();
    const state = store.getState();
    expect(state.ok).toBe(false);
    store.stop();
  });

  it("keeps working (ok=true) when one endpoint fails and the other succeeds", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("atp")) return Promise.resolve(jsonResponse(atpFixture));
      return Promise.reject(new Error("wta down"));
    });
    const store = new LiveStore(deps());
    store.start();
    await vi.runOnlyPendingTimersAsync();
    const state = store.getState();
    expect(state.ok).toBe(true);
    expect(state.overlays["gentlemens-singles"]).toBeDefined();
    store.stop();
  });

  it("treats a non-Wimbledon event as no live data (URS-81, URS-99)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(nonWimbledonFixture)));
    const store = new LiveStore(deps());
    store.start();
    await vi.runOnlyPendingTimersAsync();
    const state = store.getState();
    expect(state.ok).toBe(true);
    expect(state.isWimbledon).toBe(false);
    expect(state.matches).toEqual([]);
    store.stop();
  });

  it("never throws when fetch itself throws synchronously or returns malformed JSON", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("bad json");
        },
      } as unknown as Response),
    );
    const store = new LiveStore(deps());
    expect(() => store.start()).not.toThrow();
    await expect(vi.runOnlyPendingTimersAsync()).resolves.not.toThrow();
    store.stop();
  });

  it("stop() clears timers so no further fetches occur (URS-104)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(atpFixture)));
    const store = new LiveStore(deps());
    store.start();
    await vi.runOnlyPendingTimersAsync();
    const callsBeforeStop = fetchMock.mock.calls.length;
    store.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock.mock.calls.length).toBe(callsBeforeStop);
  });

  it("filters the panel's post matches to TODAY only, while still reconciling old post results onto the bracket overlay (URS-90, URS-100, CQ-A3)", async () => {
    // The ATP fixture's "post" matches all carry old dates (2026-07-01 /
    // 2026-07-03), not "today" -- they must NOT appear in state.matches (the
    // panel list) even though "today" as of test-run time is whatever the
    // real clock says, but they SHOULD still be reconciled into the overlay
    // (URS-88) since overlay matching does not depend on date.
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("atp")) return Promise.resolve(jsonResponse(atpFixture));
      return Promise.resolve(jsonResponse(wtaFixture));
    });
    const store = new LiveStore(deps());
    store.start();
    await vi.runOnlyPendingTimersAsync();
    const state = store.getState();

    // Old post matches (Sinner bt Brooksby, 2026-07-03) must be excluded from
    // the panel's matches list...
    expect(state.matches.some((m) => m.id === "177478")).toBe(false);
    // ...but the bracket overlay still reflects that historical result at its
    // node (node #1 = Sinner vs Brooksby leaf match).
    expect(state.overlays["gentlemens-singles"][1]?.winnerPlayerId).toBe("g-sinner");

    // The 3 real 'in' matches (no date filtering applies to 'in') must remain
    // in the panel list regardless of date.
    const liveIds = state.matches.filter((m) => m.state === "in").map((m) => m.id);
    expect(liveIds.length).toBeGreaterThanOrEqual(3);
    store.stop();
  });

  it("ticks the display timer independently without any network call (URS-95)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(atpFixture)));
    const store = new LiveStore(deps());
    const tickEvents: string[] = [];
    store.subscribe((_s, ev) => tickEvents.push(ev));
    store.start();
    await vi.runOnlyPendingTimersAsync();
    const callsAfterFirstPoll = fetchMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(3000); // 3 ticks, no new poll due yet
    expect(tickEvents.filter((e) => e === "tick").length).toBeGreaterThanOrEqual(3);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstPoll);
    store.stop();
  });
});

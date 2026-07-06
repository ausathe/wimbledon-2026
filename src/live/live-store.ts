/* ============================================================================
   The poll+tick engine (URS-78, URS-79, URS-95, URS-98, URS-99, URS-100,
   URS-102, URS-104). Framework-free, DOM-light (only document/visibility
   listeners), fully torn-down on stop(). Two independent timers:
     - poll timer (POLL_MS, backs off to BACKOFF_MAX_MS on failure): fetches
       both endpoints, adapts, reconciles, updates state, notifies "poll".
     - tick timer (TICK_MS): no network; notifies "tick" only.
============================================================================ */
import type { Draw, DrawId, ResolvedModel } from "../bracket/types";
import { ATP_URL, WTA_URL, POLL_MS, TICK_MS, FETCH_TIMEOUT_MS, BACKOFF_MAX_MS } from "./endpoints";
import { fetchScoreboard } from "./fetch";
import { espnToLiveMatches } from "./adapter";
import { enrichMatches, matchLiveToNodes } from "./reconcile";
import type { LiveEngineState, LiveMatch, LiveOverlay, LiveSubscriber } from "./types";

function emptyOverlays(): Record<DrawId, LiveOverlay> {
  return { "gentlemens-singles": {}, "ladies-singles": {} };
}

/** De-duplicate by LiveMatch.id, keeping the first occurrence (defense in
 * depth against a feed shape that lists the same competition more than once
 * across the two endpoint responses). */
function dedupeById(matches: LiveMatch[]): LiveMatch[] {
  const seen = new Set<string>();
  const out: LiveMatch[] = [];
  for (const m of matches) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/** True if `dateIso` falls on the same UTC calendar day as right now (URS-100,
 * CQ-A3: "today's post results", not the whole tournament's history -- the
 * feed returns every round played so far). Absent/unparseable date -> false
 * (degrade by omitting rather than guessing, URS-83 style defensiveness). */
function isFromToday(dateIso: string | undefined): boolean {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function initialState(): LiveEngineState {
  return {
    ok: false,
    isWimbledon: false,
    lastPollMs: null,
    matches: [],
    overlays: emptyOverlays(),
    liveCount: 0,
    unmatchedCount: 0,
  };
}

export interface LiveStoreDeps {
  /** Supplies the current resolved model for a draw (so reconciliation always
   * runs against the CURRENT bracket data, not a stale snapshot). Injected so
   * this module stays framework-free/testable (BUILD-BLUEPRINT §12 style). */
  getDraw: (id: DrawId) => Draw;
  getModel: (id: DrawId) => ResolvedModel;
}

export class LiveStore {
  private state: LiveEngineState = initialState();
  private subscribers = new Set<LiveSubscriber>();
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private currentBackoffMs = POLL_MS;
  private inFlight = false;
  private stopped = true;
  private visibilityHandler = (): void => this.onVisibilityChange();
  private teardownHandler = (): void => this.stop();

  constructor(private deps: LiveStoreDeps) {}

  getState(): LiveEngineState {
    return this.state;
  }

  subscribe(cb: LiveSubscriber): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify(event: "poll" | "tick"): void {
    for (const cb of this.subscribers) {
      try {
        cb(this.state, event);
      } catch (err) {
        // A subscriber's own render bug must never take down the engine
        // (extends URS-56/URS-98 -- the live layer must never throw upward).
        console.warn("live: subscriber threw", err);
      }
    }
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.visibilityHandler);
      document.addEventListener("pagehide", this.teardownHandler);
      window.addEventListener?.("beforeunload", this.teardownHandler);
    }
    this.scheduleTick();
    void this.poll(); // immediate first poll (URS-78); doesn't block first paint (async)
    this.schedulePoll(this.currentBackoffMs);
  }

  /** Clears both timers and marks the engine stopped (URS-104). Safe to call
   * multiple times. */
  stop(): void {
    this.stopped = true;
    if (this.pollTimer != null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.tickTimer != null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      document.removeEventListener("pagehide", this.teardownHandler);
      window.removeEventListener?.("beforeunload", this.teardownHandler);
    }
  }

  private onVisibilityChange(): void {
    if (typeof document === "undefined") return;
    if (document.hidden) {
      // Pause the poll timer while hidden (URS-104); tick can keep running
      // harmlessly (no network), but we stop it too to avoid pointless work.
      if (this.pollTimer != null) {
        clearTimeout(this.pollTimer);
        this.pollTimer = null;
      }
      if (this.tickTimer != null) {
        clearInterval(this.tickTimer);
        this.tickTimer = null;
      }
    } else if (!this.stopped) {
      this.scheduleTick();
      void this.poll(); // immediate poll on regaining focus
    }
  }

  private scheduleTick(): void {
    if (this.tickTimer != null) return;
    this.tickTimer = setInterval(() => this.notify("tick"), TICK_MS);
  }

  private schedulePoll(delayMs: number): void {
    if (this.stopped) return;
    if (this.pollTimer != null) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      void this.poll().finally(() => {
        if (!this.stopped) this.schedulePoll(this.currentBackoffMs);
      });
    }, delayMs);
  }

  /** One poll cycle: fetch both endpoints concurrently (URS-80), adapt,
   * reconcile, update state, notify "poll". Never throws (URS-98). */
  private async poll(): Promise<void> {
    if (this.inFlight) return; // guard against overlap if a slow poll is still running
    this.inFlight = true;
    try {
      const [atpRes, wtaRes] = await Promise.allSettled([
        fetchScoreboard(ATP_URL, FETCH_TIMEOUT_MS),
        fetchScoreboard(WTA_URL, FETCH_TIMEOUT_MS),
      ]);

      const atp = atpRes.status === "fulfilled" ? atpRes.value : { ok: false, error: "rejected" };
      const wta = wtaRes.status === "fulfilled" ? wtaRes.value : { ok: false, error: "rejected" };

      const bothFailed = !atp.ok && !wta.ok;
      if (bothFailed) {
        this.consecutiveFailures++;
        this.currentBackoffMs = Math.min(POLL_MS * 2 ** this.consecutiveFailures, BACKOFF_MAX_MS);
        console.warn(`live: poll failed (both endpoints) -- ${atp.error} / ${wta.error}`);
        this.state = {
          ...this.state,
          ok: false,
          // Deliberately keep the previous matches/overlays/isWimbledon so a
          // transient blip doesn't blank an already-live scoreboard; the
          // status line still reflects failure via `ok: false` (URS-101).
        };
        this.notify("poll");
        return;
      }

      // At least one endpoint responded -- reset backoff (URS-102).
      this.consecutiveFailures = 0;
      this.currentBackoffMs = POLL_MS;

      const atpAdapt = atp.ok
        ? espnToLiveMatches(atp.json, "gentlemens-singles", "men")
        : { matches: [], isWimbledon: false, groupingFound: false };
      const wtaAdapt = wta.ok
        ? espnToLiveMatches(wta.json, "ladies-singles", "women")
        : { matches: [], isWimbledon: false, groupingFound: false };

      if (!atp.ok) console.warn(`live: ATP poll failed -- ${atp.error}`);
      if (!wta.ok) console.warn(`live: WTA poll failed -- ${wta.error}`);

      const isWimbledon = atpAdapt.isWimbledon || wtaAdapt.isWimbledon;
      // Reconcile against the FULL parsed set (every round, any date) so the
      // bracket overlay (URS-88) can match a live/completed node regardless
      // of when it was played. The ESPN feed returns the whole tournament's
      // history, not just today's -- reconciliation must see all of it.
      // De-duplicate by competition id (defense in depth): both live
      // endpoints have been observed to return the SAME full tournament
      // payload (every grouping, not gender-scoped), so a future feed change
      // reintroducing cross-listing must not silently double-render a match.
      const allMatches: LiveMatch[] = dedupeById(
        enrichMatches([...atpAdapt.matches, ...wtaAdapt.matches]),
      );

      let unmatchedCount = 0;
      const overlays = emptyOverlays();
      if (isWimbledon) {
        for (const drawId of Object.keys(overlays) as DrawId[]) {
          const draw = this.deps.getDraw(drawId);
          const model = this.deps.getModel(drawId);
          const { overlay, unmatchedCount: n } = matchLiveToNodes(allMatches, draw, model);
          overlays[drawId] = overlay;
          unmatchedCount += n;
        }
      }

      // The SCOREBOARD PANEL, though, must only ever show `in` matches plus
      // TODAY's `post` results (URS-90, URS-100, CQ-A3) -- the feed's `post`
      // list spans the whole tournament, and showing weeks of history would
      // both misrepresent "Live now" and blow up the DOM (hundreds of cards).
      const panelMatches = allMatches.filter((m) => m.state === "in" || isFromToday(m.dateIso));

      const liveCount = allMatches.filter((m) => m.state === "in").length;

      this.state = {
        ok: true,
        isWimbledon,
        lastPollMs: Date.now(),
        matches: panelMatches,
        overlays,
        liveCount,
        unmatchedCount,
      };
      this.notify("poll");
    } catch (err) {
      // Belt-and-braces: nothing above should throw, but guarantee the engine
      // itself never propagates an exception (URS-98).
      console.warn("live: unexpected poll error", err);
      this.state = { ...this.state, ok: false };
      this.notify("poll");
    } finally {
      this.inFlight = false;
    }
  }
}

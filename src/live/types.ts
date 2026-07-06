/* ============================================================================
   Internal live-feature types (LIVE-SCORES-BLUEPRINT §3). Reuses the existing
   bracket's SetScore shape so score formatting stays single-sourced in
   src/bracket/model.ts (URS-84).
============================================================================ */
import type { DrawId, SetScore } from "../bracket/types";

export type LiveMatchState = "in" | "post" | "pre";

/** Reuse the bracket's own DrawId values -- one live overlay per draw. */
export type DrawKind = DrawId;

export interface LivePlayer {
  /** Raw display name exactly as the feed sent it, e.g. "Carlos Alcaraz". */
  displayName: string;
  /** normalize(displayName) -- used for matching (URS-86). */
  normalizedKey: string;
  /** Resolved players.ts id, if this name matched unambiguously (URS-87). */
  playerId?: string;
  seed?: number;
  iso?: string;
  shortCode?: string;
  /** True when the feed reports this player currently holding serve. */
  serving?: boolean;
  /** true/false/undefined mirroring the feed's competitor.winner. */
  winner?: boolean;
}

export interface LiveMatch {
  /** Stable id for the feed competition (used for diffing/keys). */
  id: string;
  drawKind: DrawKind;
  state: LiveMatchState;
  /** status.type.detail, e.g. "5th Set", "Final". */
  detail: string;
  court?: string;
  players: [LivePlayer, LivePlayer];
  sets: SetScore;
  /** Index into `sets` that is the live/current set; -1 if none (post/pre). */
  currentSetIndex: number;
  /** ISO 8601 competition date/time from the feed, if present. Used to filter
   * the scoreboard's `post` matches down to "today's results" (URS-100,
   * CQ-A3) -- the feed returns the WHOLE tournament's completed matches, not
   * just today's, so this field is required to avoid showing weeks of
   * history in the panel. */
  dateIso?: string;
}

/** What gets overlaid onto a matched bracket node (URS-88). */
export interface LiveNodeData {
  state: LiveMatchState;
  sets: SetScore;
  currentSetIndex: number;
  detail: string;
  court?: string;
  /** Resolved player id of the winning side, if state is "post" and known. */
  winnerPlayerId?: string;
  /** Resolved player id of the server, if the feed provided possession. */
  servingPlayerId?: string;
}

/** nodeNum -> live data, for one draw. Empty object = no live coverage. */
export type LiveOverlay = Record<number, LiveNodeData>;

export interface LiveEngineState {
  /** True if the most recent poll attempt completed without total failure. */
  ok: boolean;
  /** True when events[0] resolved to Wimbledon on the most recent successful poll. */
  isWimbledon: boolean;
  /** Date.now() of the last SUCCESSFUL poll; null before the first success. */
  lastPollMs: number | null;
  /** All parsed matches (both draws), in | post-today, for the scoreboard panel. */
  matches: LiveMatch[];
  overlays: Record<DrawKind, LiveOverlay>;
  /** Count of matches with state === "in" across both draws. */
  liveCount: number;
  /** Count of unmatched (unresolvable-name) live/post matches, for dev bookkeeping. */
  unmatchedCount: number;
}

export type LiveSubscriberEvent = "poll" | "tick";
export type LiveSubscriber = (state: LiveEngineState, event: LiveSubscriberEvent) => void;

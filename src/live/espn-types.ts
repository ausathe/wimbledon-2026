/* ============================================================================
   Minimal TS interfaces for the ESPN tennis scoreboard payload -- ONLY the
   fields this build relies on (LIVE-SCORES-BLUEPRINT §0 / §A.0). Every field is
   optional/nullable: real-world payloads vary and the adapter must be total
   and defensive (URS-83), never assuming a field is present.

   Verified against a real captured payload from
   https://site.api.espn.com/apis/site/v2/sports/tennis/{atp,wta}/scoreboard
   on 2026-07-05 (see src/live/fixtures/espn-*-sample.json).
============================================================================ */

export interface EspnLinescore {
  value?: unknown; // games in that set for THIS competitor -- verify numeric at parse time
  tiebreak?: unknown; // optional tiebreak point count for THIS competitor
  winner?: unknown; // optional set-level winner flag
}

export interface EspnAthlete {
  displayName?: unknown;
}

export interface EspnCompetitor {
  id?: unknown;
  order?: unknown;
  homeAway?: unknown;
  /** Server flag: field name has varied historically ("possession" seen in the
   * wild); "active" checked as a fallback per the blueprint. */
  possession?: unknown;
  active?: unknown;
  winner?: unknown;
  athlete?: EspnAthlete;
  linescores?: unknown;
}

export interface EspnStatusType {
  state?: unknown; // "in" | "post" | "pre"
  detail?: unknown;
  shortDetail?: unknown;
}

export interface EspnStatus {
  type?: EspnStatusType;
}

export interface EspnVenue {
  fullName?: unknown;
  court?: unknown;
}

export interface EspnCompetition {
  id?: unknown;
  date?: unknown;
  status?: EspnStatus;
  venue?: EspnVenue;
  competitors?: unknown;
  situation?: unknown;
}

export interface EspnGrouping {
  grouping?: {
    id?: unknown;
    slug?: unknown;
    displayName?: unknown;
  };
  competitions?: unknown;
}

export interface EspnEvent {
  id?: unknown;
  name?: unknown;
  groupings?: unknown;
}

export interface EspnScoreboardRoot {
  events?: unknown;
}

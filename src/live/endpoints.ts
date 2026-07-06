/* ============================================================================
   Live-feed constants (LIVE-SCORES-BLUEPRINT §0, §6). Each value justified in
   place so the cadence choices are reviewable, not magic numbers.
============================================================================ */

/** Free, keyless, CORS-open ESPN public tennis scoreboards (URS-78, §A.0). */
export const ATP_URL = "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard";
export const WTA_URL = "https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard";

/** Network re-poll interval (URS-79): fresh within a quarter-minute while
 * staying gentle on an unofficial free feed. Point-level data isn't available
 * anyway (§A.0), so sub-5s polling would be pure abuse for no benefit.
 * Polling faster than this is a FAIL per URS-79. */
export const POLL_MS = 15_000;

/** Display tick (URS-95): "updated Xs ago" + LIVE pulse liveness, fully
 * separate from the network timer -- this timer NEVER fetches. */
export const TICK_MS = 1_000;

/** Per-request abort timeout (URS-80): a hung request on one draw must not
 * stall the other draw or the tick loop. */
export const FETCH_TIMEOUT_MS = 8_000;

/** Backoff cap on consecutive poll failures (URS-102): widen up to this, never
 * retry in a tight loop; resumes POLL_MS on the next success. */
export const BACKOFF_MAX_MS = 60_000;

/* ============================================================================
   Addendum B constants (URS-111.2, URS-111.3, URS-126).
============================================================================ */

/** Win-celebration banner auto-dismiss duration (URS-111.2). */
export const CELEBRATION_MS = 6_000;

/** Max celebration cards stacked/visible at once before collapsing the
 * remainder into a single "+N more results" note (URS-111.3). */
export const CELEBRATION_MAX_VISIBLE = 3;

/** Viewport width at/above which the persistent left/right rails replace the
 * "Live now" panel (URS-125, URS-126). Mirrored in live.css's media query. */
export const RAILS_MIN_WIDTH_PX = 1180;

/* ============================================================================
   Per-match status cues (URS-25), tennis-tuned windows (BUILD-BLUEPRINT §7.3):
   - live: from scheduled start until +4h (best-of-5 can run long; no exact
     end time is known ahead of a result).
   - deck ("on court next"): within ~2h before scheduled start.
   - soon ("today"): scheduled the same calendar day, viewer-local.
   Only matches with both participants known and no result yet may be
   highlighted (mirrors the reference's matchStatus contract).
============================================================================ */
import type { MatchStatus, ResolvedNode } from "./types";
import { scheduledInstant } from "./time";

const LIVE_MS = 4 * 60 * 60000; // 4h
const DECK_MS = 2 * 60 * 60000; // 2h
const SOON_MS = 24 * 60 * 60000; // same day-ish window (24h ahead)

export function matchStatus(node: ResolvedNode | undefined, nowMs: number): MatchStatus {
  if (!node) return "";
  if (node.score && node.score.length > 0) return ""; // already has a result -> finished
  const [p1, p2] = node.participants;
  if (!p1 || !p2) return ""; // participants not decided yet
  const start = scheduledInstant(node.date, node.time);
  if (!start) return "";
  const diff = start.getTime() - nowMs; // ms until start (<0 = under way)
  if (diff <= 0) return nowMs < start.getTime() + LIVE_MS ? "live" : "";
  if (diff <= DECK_MS) return "deck";
  return diff <= SOON_MS ? "soon" : "";
}

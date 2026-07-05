/* ============================================================================
   Round names + feeder-code labels (URS-8, URS-9). Ported from the reference's
   roundName/sideLabel, adapted to the data-driven level map (URS-11) and
   tennis round names.
============================================================================ */
import type { Draw, ResolvedModel } from "./types";
import { isLeaf } from "./model";
import { playerById } from "../data/players";

/** Tennis round name for a ring level, given the Final's level (maxLevel).
 * level 1 (outermost match ring) name depends on how many levels exist so the
 * default R32 scope reads "Round of 32" while a future deeper draw can extend
 * outward with "Round of 64"/"Round of 128" (URS-8, URS-11) without a rewrite. */
const ROUND_NAMES_FROM_FINAL = [
  "Final",
  "Semi-final",
  "Quarter-final",
  "Round of 16",
  "Round of 32",
  "Round of 64",
  "Round of 128",
];

export function roundName(level: number, maxLevel: number): string {
  const distanceFromFinal = maxLevel - level;
  return ROUND_NAMES_FROM_FINAL[distanceFromFinal] ?? `Round of ${2 ** (distanceFromFinal + 1)}`;
}

export function championRoundName(): string {
  return "Champion";
}

/** Label for one side (slot 0|1) of a match: the player's name if decided,
 * the feeder matchup's short codes ("ALC/DJO") if both feeders are known,
 * else "TBD" (URS-9). */
export function sideLabel(draw: Draw, model: ResolvedModel, num: number, slot: 0 | 1): string {
  const playerId = model[num]?.participants[slot];
  if (playerId) return playerById(playerId)?.name ?? playerId;
  if (isLeaf(draw, num)) return "TBD";
  const feederNum = draw.children[num]?.[slot];
  const feeder = feederNum != null ? model[feederNum] : undefined;
  const [f1, f2] = feeder?.participants ?? [null, null];
  if (f1 && f2) {
    const c1 = playerById(f1)?.shortCode ?? f1.slice(0, 3).toUpperCase();
    const c2 = playerById(f2)?.shortCode ?? f2.slice(0, 3).toUpperCase();
    return `${c1}/${c2}`;
  }
  return "TBD";
}

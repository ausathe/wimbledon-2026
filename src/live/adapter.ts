/* ============================================================================
   ESPN JSON -> LiveMatch[] (URS-81, URS-82, URS-83, URS-84). Pure, total,
   defensive, framework-free, and fixture-testable (no network inside this
   module). Every field access is guarded; a malformed competition is skipped,
   never thrown (URS-83).
============================================================================ */
import type { SetGames, SetScore } from "../bracket/types";
import type { DrawKind, LiveMatch, LiveMatchState, LivePlayer } from "./types";
import type {
  EspnCompetition,
  EspnCompetitor,
  EspnGrouping,
  EspnScoreboardRoot,
} from "./espn-types";

/** Result of adapting one endpoint's payload: the parsed matches plus whether
 * the gate conditions (URS-81, URS-82) were satisfied, so the store can tell
 * "off-season / wrong event" apart from "Wimbledon but nothing live". */
export interface AdaptResult {
  matches: LiveMatch[];
  isWimbledon: boolean;
  /** true if the target singles grouping was found for this draw (even if it
   * had zero competitions) -- absent/renamed groupings degrade gracefully
   * (URS-82) without being confused for "no event at all". */
  groupingFound: boolean;
}

const EMPTY_RESULT: AdaptResult = { matches: [], isWimbledon: false, groupingFound: false };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/** Grouping-name matcher (URS-82): singles only, correct gender, ignore
 * doubles/mixed. `genderWord` is "men" for the ATP endpoint, "women" for WTA.
 *
 * IMPORTANT (regression guard): both the ATP and WTA scoreboard endpoints
 * return the SAME full tournament payload -- every grouping ("Men's Singles",
 * "Women's Singles", + doubles) is present in BOTH responses (verified
 * against the live feed during this build). A naive substring check for
 * "men's singles" would also match inside "wo-MEN'S SINGLES", double-parsing
 * the women's draw into the men's drawKind (and vice-versa via a similarly
 * careless women-check) -- this is exactly why the check below anchors on
 * word-boundary-safe patterns and is mutually exclusive by construction. */
function isTargetSinglesGrouping(displayName: string, genderWord: "men" | "women"): boolean {
  const n = displayName.toLowerCase().trim();
  if (!/singles/.test(n)) return false;
  if (/doubles/.test(n)) return false;
  const isWomens = /^women'?s\b/.test(n);
  const isMens = /^men'?s\b/.test(n);
  if (genderWord === "women") return isWomens;
  return isMens && !isWomens;
}

/** Build the paired SetScore from two competitors' linescores arrays, skipping
 * any set index whose value is non-numeric on either side (URS-83). Returns
 * the set grid plus the index of the last set that has ANY data (used as a
 * best-effort "current set" fallback when state isn't "in"). */
function zipLinescores(c0: unknown, c1: unknown): SetScore {
  const ls0 = Array.isArray(c0) ? c0 : [];
  const ls1 = Array.isArray(c1) ? c1 : [];
  const len = Math.max(ls0.length, ls1.length);
  const sets: SetScore = [];
  for (let i = 0; i < len; i++) {
    const s0 = isRecord(ls0[i]) ? ls0[i] : undefined;
    const s1 = isRecord(ls1[i]) ? ls1[i] : undefined;
    const v0 = asFiniteNumber(s0?.value);
    const v1 = asFiniteNumber(s1?.value);
    if (v0 == null || v1 == null) continue; // skip malformed set index, keep parsing (URS-83)
    const tb0 = asFiniteNumber(s0?.tiebreak);
    const tb1 = asFiniteNumber(s1?.tiebreak);
    const set: SetGames = { games: [v0, v1] };
    if (tb0 != null || tb1 != null) {
      set.tb = [tb0 ?? 0, tb1 ?? 0];
    }
    sets.push(set);
  }
  return sets;
}

function parsePlayer(c: EspnCompetitor): LivePlayer | null {
  const name = asString(c.athlete?.displayName);
  if (!name || !name.trim()) return null;
  const serving = asBool(c.possession) ?? asBool(c.active);
  const winner = asBool(c.winner);
  return {
    displayName: name,
    normalizedKey: "", // filled in by reconcile.ts (kept blank here to avoid a layering dependency)
    serving,
    winner,
  };
}

function parseState(v: unknown): LiveMatchState | null {
  if (v === "in" || v === "post" || v === "pre") return v;
  return null;
}

/** Parse a single competition into a LiveMatch, or null if it's malformed
 * beyond repair (URS-83): missing status/state, competitors.length !== 2, or
 * either player's name is unavailable. */
function parseCompetition(raw: unknown, drawKind: DrawKind): LiveMatch | null {
  if (!isRecord(raw)) return null;
  const c = raw as EspnCompetition;
  const state = parseState(c.status?.type?.state);
  if (!state) return null;

  const competitors = Array.isArray(c.competitors) ? c.competitors : [];
  if (competitors.length !== 2) return null;
  const [rawA, rawB] = competitors;
  if (!isRecord(rawA) || !isRecord(rawB)) return null;

  const playerA = parsePlayer(rawA as EspnCompetitor);
  const playerB = parsePlayer(rawB as EspnCompetitor);
  if (!playerA || !playerB) return null;

  const sets = zipLinescores(
    (rawA as EspnCompetitor).linescores,
    (rawB as EspnCompetitor).linescores,
  );
  const currentSetIndex = state === "in" ? sets.length - 1 : -1;

  const detail = asString(c.status?.type?.detail) ?? asString(c.status?.type?.shortDetail) ?? "";
  const court = asString(c.venue?.court);
  const dateIso = asString(c.date);
  const id = asString(c.id) ?? `${playerA.displayName}-${playerB.displayName}-${dateIso ?? ""}`;

  return {
    id,
    drawKind,
    state,
    detail,
    court,
    players: [playerA, playerB],
    sets,
    currentSetIndex,
    dateIso,
  };
}

/** Adapt one endpoint's full JSON payload into LiveMatch[] for one draw
 * (URS-81…URS-84). `genderWord` picks the correct singles grouping for this
 * endpoint ("men" for ATP, "women" for WTA). Total and defensive: any
 * unexpected shape degrades to an empty/flagged result, never throws. */
export function espnToLiveMatches(
  json: unknown,
  drawKind: DrawKind,
  genderWord: "men" | "women",
): AdaptResult {
  if (!isRecord(json)) return EMPTY_RESULT;
  const root = json as EspnScoreboardRoot;
  const events = Array.isArray(root.events) ? root.events : [];
  const ev = events[0];
  if (!isRecord(ev)) return EMPTY_RESULT;

  // Wimbledon gate (URS-81): only ever treat this payload as live Wimbledon
  // data when events[0].name mentions Wimbledon, case-insensitive.
  const eventName = asString(ev.name) ?? "";
  const isWimbledon = /wimbledon/i.test(eventName);
  if (!isWimbledon) return { matches: [], isWimbledon: false, groupingFound: false };

  const groupings = Array.isArray(ev.groupings) ? ev.groupings : [];
  let groupingFound = false;
  const matches: LiveMatch[] = [];
  for (const g of groupings) {
    if (!isRecord(g)) continue;
    const grouping = g as EspnGrouping;
    const displayName = asString(grouping.grouping?.displayName) ?? "";
    if (!isTargetSinglesGrouping(displayName, genderWord)) continue;
    groupingFound = true;
    const competitions = Array.isArray(grouping.competitions) ? grouping.competitions : [];
    for (const comp of competitions) {
      const m = parseCompetition(comp, drawKind);
      if (m) matches.push(m);
    }
  }

  return { matches, isWimbledon: true, groupingFound };
}

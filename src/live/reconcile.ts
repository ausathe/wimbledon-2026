/* ============================================================================
   Feed <-> bracket reconciliation (URS-86, URS-87, URS-88). Normalized-name
   matching against players.ts, plus a small alias map for known ESPN-vs-ours
   display-name mismatches. Pure/testable: takes LiveMatch[] + a Draw's
   resolved model and returns a LiveOverlay, never touching the DOM or network.
============================================================================ */
import type { Draw, Player, ResolvedModel, SetScore } from "../bracket/types";
import type { LiveMatch, LiveNodeData, LiveOverlay, LivePlayer } from "./types";
import { ALL_PLAYERS } from "../data/players";

/** Normalize a display name for matching (URS-86): lower-case, strip
 * diacritics, collapse whitespace/punctuation. "Alejandro Davidovich Fokina"
 * and "Alejandro DAVIDOVICH-FOKINA" both normalize the same way. */
export function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Known ESPN-vs-ours display-name mismatches (URS-86). Keyed by the
 * NORMALIZED ESPN name -> our players.ts normalized name. Extend this map as
 * URS-87 bookkeeping (console.warn) surfaces new unmatched names in prod. */
const ALIASES: Record<string, string> = {
  // (placeholder for future real-world mismatches -- our current dataset's
  // display names already match ESPN's athlete.displayName convention for the
  // R32 subset probed during this build, e.g. "Alejandro Davidovich Fokina",
  // "Felix Auger-Aliassime", "Jan-Lennard Struff" all normalize identically.)
};

let playerIndex: Map<string, Player> | null = null;

function getPlayerIndex(): Map<string, Player> {
  if (playerIndex) return playerIndex;
  const map = new Map<string, Player>();
  for (const p of ALL_PLAYERS) {
    map.set(normalize(p.name), p);
  }
  playerIndex = map;
  return map;
}

/** Resolve one feed display name to our modelled Player, or undefined if it
 * doesn't resolve unambiguously (URS-86, URS-87). */
export function resolvePlayer(displayName: string): Player | undefined {
  const key = normalize(displayName);
  const index = getPlayerIndex();
  const direct = index.get(key);
  if (direct) return direct;
  const aliasKey = ALIASES[key];
  if (aliasKey) return index.get(aliasKey);
  return undefined;
}

function enrichPlayer(lp: LivePlayer): LivePlayer {
  const normalizedKey = normalize(lp.displayName);
  const resolved = resolvePlayer(lp.displayName);
  return {
    ...lp,
    normalizedKey,
    playerId: resolved?.id,
    seed: resolved?.seed,
    iso: resolved?.iso,
    shortCode: resolved?.shortCode,
  };
}

/** Enrich every player on every match with normalized keys + resolved
 * players.ts fields (URS-86). Pure -- does not mutate the input array. */
export function enrichMatches(matches: LiveMatch[]): LiveMatch[] {
  return matches.map((m) => ({
    ...m,
    players: [enrichPlayer(m.players[0]), enrichPlayer(m.players[1])],
  }));
}

/** Dev-only, once-per-unique-pair warning (URS-87): never thrown, and kept out
 * of the hot path's control flow so this module stays pure/test-friendly
 * regardless of how `import.meta.env` is (or isn't) defined by the runner. */
const warnedPairs = new Set<string>();
function warnUnmatched(nameA: string, nameB: string, drawId: string): void {
  let isDev = false;
  try {
    // Guarded: import.meta.env only exists under Vite/Astro; plain Node test
    // runners may not define it, so this must never throw.
    isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    isDev = false;
  }
  if (!isDev) return;
  const key = `${drawId}:${nameA}|${nameB}`;
  if (warnedPairs.has(key)) return;
  warnedPairs.add(key);
  console.warn(
    `live: unmatched player name(s) -- "${nameA}" / "${nameB}" (draw: ${drawId}). ` +
      `Extend the alias map in src/live/reconcile.ts if this is a known player.`,
  );
}

export interface ReconcileResult {
  overlay: LiveOverlay;
  /** Matches whose players did NOT both resolve unambiguously to a modelled
   * node -- still shown in the panel (URS-87), just not forced onto the
   * bracket. */
  unmatched: LiveMatch[];
  /** Count of distinct unmatched display names, for dev bookkeeping. */
  unmatchedCount: number;
}

/** Find the node in `model` whose two participants are exactly {idA, idB}, in
 * either order. Searches leaves and inner nodes alike (a live match may map
 * to any round). Returns undefined if zero or more than one node matches
 * (ambiguous -- treat as unmatched per URS-87, never force it). */
function findNodeForPair(model: ResolvedModel, idA: string, idB: string): number | undefined {
  let found: number | undefined;
  for (const node of Object.values(model)) {
    const [p1, p2] = node.participants;
    if (!p1 || !p2) continue;
    const isPair = (p1 === idA && p2 === idB) || (p1 === idB && p2 === idA);
    if (isPair) {
      if (found != null) return undefined; // ambiguous: more than one match -> don't force either
      found = node.num;
    }
  }
  return found;
}

/** Reorder a feed-ordered SetScore (games[0]=feed competitor 0, games[1]=feed
 * competitor 1) so games[0]/games[1] instead line up with our bracket node's
 * participant order [p1, p2] (URS-84, URS-88). The feed's competitor order is
 * unrelated to our data's p1/p2 order (it varies by home/away, not by our
 * dataset), so every set's games (and paired tiebreak) must be swapped
 * whenever the feed's side 0 corresponds to our node's participant[1]. */
function reorderSets(sets: SetScore, feedSideMatchesP1: boolean): SetScore {
  if (feedSideMatchesP1) return sets;
  return sets.map((set) => ({
    games: [set.games[1], set.games[0]],
    ...(set.tb != null
      ? { tb: Array.isArray(set.tb) ? ([set.tb[1], set.tb[0]] as [number, number]) : set.tb }
      : {}),
  }));
}

/** Match this draw's enriched LiveMatch[] against the resolved bracket model,
 * producing a LiveOverlay keyed by node number (URS-86, URS-88). Only matches
 * for `drawKind` are considered; call once per draw. */
export function matchLiveToNodes(
  matches: LiveMatch[],
  draw: Draw,
  model: ResolvedModel,
): ReconcileResult {
  const overlay: LiveOverlay = {};
  const unmatched: LiveMatch[] = [];
  let unmatchedCount = 0;

  for (const m of matches) {
    if (m.drawKind !== draw.id) continue;
    const [pA, pB] = m.players;
    const idA = pA.playerId;
    const idB = pB.playerId;
    if (!idA || !idB) {
      unmatched.push(m);
      unmatchedCount++;
      warnUnmatched(pA.displayName, pB.displayName, draw.id);
      continue;
    }
    const nodeNum = findNodeForPair(model, idA, idB);
    if (nodeNum == null) {
      unmatched.push(m);
      unmatchedCount++;
      continue;
    }
    // The feed's competitor order (idA/idB) is independent of our node's
    // participant order -- reorder the set grid to match participants[0/1]
    // so games[0] always means "our node's first slot's games" (URS-84,
    // URS-88). Without this, a live overlay can silently print a swapped
    // score relative to the local snapshot's p1/p2 convention.
    const node = model[nodeNum];
    const feedSideMatchesP1 = node?.participants[0] === idA;
    const sets = reorderSets(m.sets, feedSideMatchesP1);

    const winnerSide = m.players.findIndex((p) => p.winner === true);
    const servingSide = m.players.findIndex((p) => p.serving === true);
    const data: LiveNodeData = {
      state: m.state,
      sets,
      currentSetIndex: m.currentSetIndex,
      detail: m.detail,
      court: m.court,
      winnerPlayerId: winnerSide === 0 ? idA : winnerSide === 1 ? idB : undefined,
      servingPlayerId: servingSide === 0 ? idA : servingSide === 1 ? idB : undefined,
      matchId: m.id,
    };
    overlay[nodeNum] = data;
  }

  return { overlay, unmatched, unmatchedCount };
}

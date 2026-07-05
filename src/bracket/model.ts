/* ============================================================================
   Static bracket skeleton + winner propagation (URS-3). Node numbering for the
   default R32-onward scope (URS-10): leaves 1..16 (R32, 32 outer players),
   R16 17..24, quarter-finals 25..28, semi-finals 29..30, Final 31 (root).
   Reference: reference site's ROOT/CHILDREN/PARENT/levelOf, ported and made
   data-driven from Draw.children rather than hard-coded (URS-11 stretch: ring
   count derives from skeleton depth, not a magic constant).
============================================================================ */
import type { Draw, Match, ResolvedModel, ResolvedNode, SetScore } from "./types";

/** Reverse of Draw.children: match num -> its parent match num (undefined at root). */
export function buildParentMap(draw: Draw): Record<number, number> {
  const parent: Record<number, number> = {};
  for (const [p, kids] of Object.entries(draw.children)) {
    for (const c of kids) parent[c] = Number(p);
  }
  return parent;
}

/** All node numbers in the skeleton: every leaf (referenced but never a parent) +
 * every parent key, deduped. Derived from the data, not hard-coded (URS-11). */
export function allNodeNums(draw: Draw): number[] {
  const nodeSet = new Set<number>();
  for (const [p, kids] of Object.entries(draw.children)) {
    nodeSet.add(Number(p));
    for (const c of kids) nodeSet.add(c);
  }
  // leaves are nodes that never appear as a parent key
  const leaves = [...nodeSet].filter((n) => !(n in draw.children));
  const inner = Object.keys(draw.children).map(Number);
  // outer ring first (leaves), then inward round by round via level
  return [...leaves.sort((a, b) => a - b), ...inner.sort((a, b) => a - b)];
}

/** true if `num` is a leaf (outermost rendered round: has players, not children). */
export function isLeaf(draw: Draw, num: number): boolean {
  return !(num in draw.children);
}

/** Ring level: leaves = 1 (outer match ring; player tokens sit at level 0),
 * increasing inward to the Final. Derived by recursing down the children map
 * (depth-to-leaf) so ring count is driven by skeleton depth, not a hard-coded
 * constant (URS-11) — a deeper/shallower tree just produces more/fewer levels. */
export function buildLevelMap(draw: Draw): Record<number, number> {
  const level: Record<number, number> = {};
  function depthFromLeaf(num: number): number {
    if (num in level) return level[num]!;
    if (isLeaf(draw, num)) return (level[num] = 1);
    const [c1, c2] = draw.children[num]!;
    const lvl = Math.max(depthFromLeaf(c1), depthFromLeaf(c2)) + 1;
    return (level[num] = lvl);
  }
  for (const num of allNodeNums(draw)) depthFromLeaf(num);
  return level;
}

function matchByNum(draw: Draw): Record<number, Match> {
  const map: Record<number, Match> = {};
  for (const m of draw.matches) map[m.num] = m;
  return map;
}

/** Count sets won per side from a tennis SetScore (URS-24 scoring, replaces the
 * reference's football goal-comparison winnerIndex). A set is won by whoever
 * has more games in that set's `games` tuple. */
function setsWon(score: SetScore): [number, number] {
  let a = 0;
  let b = 0;
  for (const set of score) {
    const [ga, gb] = set.games;
    if (ga > gb) a++;
    else if (gb > ga) b++;
  }
  return [a, b];
}

/** Winner slot (0|1) from a tennis score, or null if undecided/no score. The
 * winning side is whoever reaches ceil(bestOf/2) sets; if the recorded score
 * doesn't yet reach that (partial data), we still return the side with more
 * sets won, so genuinely partial/inconsistent placeholder data degrades to
 * "undecided" rather than throwing (URS-32). */
function winnerSlot(score: SetScore | undefined): 0 | 1 | null {
  if (!score || score.length === 0) return null;
  const [a, b] = setsWon(score);
  if (a === b) return null;
  return a > b ? 0 : 1;
}

/** Tennis set score formatted like `6-4, 3-6, 7-6(5), 6-2` (URS-24). En-dash
 * between games, tiebreak point count in parens when present. */
export function formatScore(score: SetScore | undefined): string {
  if (!score || score.length === 0) return "";
  return score
    .map((set) => {
      const [ga, gb] = set.games;
      const tb = set.tb;
      let tbLabel = "";
      if (tb != null) {
        // tb may be a single loser-point-count number or a [winner,loser] pair
        const loserPoints = Array.isArray(tb) ? Math.min(tb[0], tb[1]) : tb;
        tbLabel = `(${loserPoints})`;
      }
      return `${ga}–${gb}${tbLabel}`;
    })
    .join(", ");
}

/** Build the resolved model: for every node, compute its two participants and
 * winner. Inner-node participants = winners of its children, propagated
 * inward exactly as the skeleton dictates (URS-3) — never stored redundantly. */
export function buildModel(draw: Draw): ResolvedModel {
  const matches = matchByNum(draw);
  const model: ResolvedModel = {};
  const winnerCache: Record<number, string | null> = {};

  function participantsOf(num: number): [string | null, string | null] {
    if (isLeaf(draw, num)) {
      const m = matches[num];
      return [m?.p1 ?? null, m?.p2 ?? null];
    }
    const [c1, c2] = draw.children[num]!;
    return [winnerOf(c1), winnerOf(c2)];
  }

  function winnerOf(num: number): string | null {
    if (num in winnerCache) return winnerCache[num]!;
    const m = matches[num];
    const participants = participantsOf(num);
    let w: string | null = null;
    if (m?.winner) {
      // explicit override wins (data model allows it; normally absent)
      w = m.winner;
    } else {
      const slot = winnerSlot(m?.score);
      if (slot != null) w = participants[slot];
    }
    winnerCache[num] = w;
    return w;
  }

  for (const num of allNodeNums(draw)) {
    const m = matches[num];
    const participants = participantsOf(num);
    const node: ResolvedNode = {
      num,
      participants,
      winner: winnerOf(num),
      score: m?.score,
      courtId: m?.courtId,
      date: m?.date,
      time: m?.time,
    };
    model[num] = node;
  }
  return model;
}

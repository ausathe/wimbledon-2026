/* ============================================================================
   Polar geometry (BUILD-BLUEPRINT §6). Ported from the reference's pt/angleOf/
   connectorPath/capsulePath math, made data-driven off Draw.children + the
   level map (URS-11) instead of a hard-coded 32-leaf constant, so a later
   "full draw" mode is reachable without rewriting the geometry.
============================================================================ */
import type { Draw } from "./types";
import { allNodeNums, buildLevelMap, isLeaf } from "./model";

export const CX = 500;
export const CY = 500;

/** One outer token slot: which leaf match, and which side (0|1) of it. */
export interface FlagSlot {
  num: number;
  slot: 0 | 1;
}

export interface BracketGeometry {
  /** Highest level number (the Final / root). */
  maxLevel: number;
  /** level -> radius (viewBox units). 0 = outer tokens ring. */
  radius: Record<number, number>;
  levelOf: Record<number, number>;
  /** 32 outer slots in tree DFS order (left semicircle = first half). */
  flagOrder: FlagSlot[];
  angleOf: (num: number) => number;
  flagAngle: (i: number) => number;
  childFlagAngle: (num: number, slot: 0 | 1) => number;
  pt: (radius: number, angDeg: number) => [number, number];
  connectorPath: (num: number) => string;
  capsulePath: (num: number) => string;
  capsuleStrokeWidth: (num: number) => number;
}

/** Build all layout functions/tables for one draw's skeleton. Radii step evenly
 * from the outer ring (index 0) inward to the centre (Final, radius 0) — the
 * ring count is `maxLevel`, derived from the skeleton depth (URS-11), not a
 * hard-coded constant, so this also supports a deeper "full draw" tree. */
export function buildGeometry(draw: Draw): BracketGeometry {
  const levelOf = buildLevelMap(draw);
  const maxLevel = Math.max(...Object.values(levelOf));

  // Radius per level: level 0 (outer tokens) = OUTER_R, decreasing evenly to 0
  // at the Final (level = maxLevel). Matches the reference's RADIUS table shape
  // (430/344/260/178/98/0 for 5 inner levels) while staying level-count-agnostic.
  const OUTER_R = 430;
  const radius: Record<number, number> = {};
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const t = lvl / maxLevel; // 0 at outer tokens, 1 at final
    // Slight ease so outer rings have more room (visually matches reference
    // spacing 430,344,260,178,98,0 better than a pure linear ramp).
    radius[lvl] = Math.round(OUTER_R * Math.pow(1 - t, 1.08));
  }
  radius[maxLevel] = 0; // exact centre for the Final

  const leafNums = allNodeNums(draw)
    .filter((n) => isLeaf(draw, n))
    .sort((a, b) => a - b);
  const outerCount = leafNums.length * 2; // 32 for the default R32 scope
  const STEP = 360 / outerCount;

  // Outer slots in tree DFS order (first-child subtree first), matching the
  // reference's dfsFlags: this is what makes the left semicircle = first half.
  function dfs(num: number): FlagSlot[] {
    if (isLeaf(draw, num)) {
      return [
        { num, slot: 0 },
        { num, slot: 1 },
      ];
    }
    const [a, b] = draw.children[num]!;
    return [...dfs(a), ...dfs(b)];
  }
  const flagOrder = dfs(draw.rootNum);

  function flagAngle(i: number): number {
    const half = outerCount / 2;
    return i < half ? -(i + 0.5) * STEP : (i - half + 0.5) * STEP;
  }

  const angleMemo: Record<number, number> = {};
  function angleOf(num: number): number {
    if (num in angleMemo) return angleMemo[num]!;
    let a: number;
    if (isLeaf(draw, num)) {
      const idx: number[] = [];
      flagOrder.forEach((f, i) => {
        if (f.num === num) idx.push(i);
      });
      a = (flagAngle(idx[0]!) + flagAngle(idx[1]!)) / 2;
    } else {
      const [c1, c2] = draw.children[num]!;
      a = (angleOf(c1) + angleOf(c2)) / 2;
    }
    angleMemo[num] = a;
    return a;
  }

  function childFlagAngle(num: number, slot: 0 | 1): number {
    let target = -1;
    for (let i = 0; i < flagOrder.length; i++) {
      const f = flagOrder[i]!;
      if (f.num === num && f.slot === slot) {
        target = i;
        break;
      }
    }
    return flagAngle(target);
  }

  function pt(r: number, angDeg: number): [number, number] {
    const rad = (angDeg * Math.PI) / 180;
    return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)];
  }

  function connectorPath(num: number): string {
    const lvl = levelOf[num]!;
    const Rc = radius[lvl - 1]!;
    const Rp = radius[lvl]!;
    const [a1, a2] = isLeaf(draw, num)
      ? [childFlagAngle(num, 0), childFlagAngle(num, 1)]
      : [angleOf(draw.children[num]![0]), angleOf(draw.children[num]![1])];
    const ap = angleOf(num);
    const A1 = pt(Rp, a1);
    const A2 = pt(Rp, a2);
    const C1 = pt(Rc, a1);
    const C2 = pt(Rc, a2);
    const P = pt(Rp, ap);
    // quadratic control point so the curve passes exactly through the parent node P
    const ctrl: [number, number] = [
      2 * P[0] - 0.5 * (A1[0] + A2[0]),
      2 * P[1] - 0.5 * (A1[1] + A2[1]),
    ];
    return `M${C1[0]} ${C1[1]} L${A1[0]} ${A1[1]} Q${ctrl[0]} ${ctrl[1]} ${A2[0]} ${A2[1]} L${C2[0]} ${C2[1]}`;
  }

  const CAP_W: Record<number, number> = {};
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    // taper the capsule stroke width from 82 (outermost match ring) to ~64 (final)
    const t = (lvl - 1) / Math.max(1, maxLevel - 1);
    CAP_W[lvl] = Math.round(82 - 18 * t);
  }
  function capsuleStrokeWidth(num: number): number {
    return CAP_W[levelOf[num]!] ?? 64;
  }

  function capsulePath(num: number): string {
    const lvl = levelOf[num]!;
    const R = radius[lvl - 1]!;
    if (num === draw.rootNum) {
      const [c1, c2] = draw.children[num]!;
      const [x1, y1] = pt(R, angleOf(c1));
      const [x2, y2] = pt(R, angleOf(c2));
      return `M${x1} ${y1} L${x2} ${y2}`;
    }
    const [a1, a2] = isLeaf(draw, num)
      ? [childFlagAngle(num, 0), childFlagAngle(num, 1)]
      : [angleOf(draw.children[num]![0]), angleOf(draw.children[num]![1])];
    const [x1, y1] = pt(R, a1);
    const [x2, y2] = pt(R, a2);
    return `M${x1} ${y1} A ${R} ${R} 0 0 ${a2 >= a1 ? 1 : 0} ${x2} ${y2}`;
  }

  return {
    maxLevel,
    radius,
    levelOf,
    flagOrder,
    angleOf,
    flagAngle,
    childFlagAngle,
    pt,
    connectorPath,
    capsulePath,
    capsuleStrokeWidth,
  };
}

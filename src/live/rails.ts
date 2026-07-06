/* ============================================================================
   B.3 -- Persistent left/right active-match rails (URS-120…URS-128). Pure
   assignment logic (`assignRails`) is fully unit-testable: it takes the
   engine's LiveMatch[] + the per-draw overlays/draws and returns left/right/
   unplaced buckets, using ONLY `layout.ts`'s existing `angleOf`/`pt` geometry
   -- no new src/bracket/** logic (B0, URS-121). Rendering reuses
   scoreboard.ts's `renderCard` for visual + a11y parity (URS-122, URS-127).
============================================================================ */
import type { Draw, DrawId } from "../bracket/types";
import { buildGeometry } from "../bracket/layout";
import { renderCard } from "./scoreboard";
import type { LiveMatch, LiveOverlay } from "./types";

/** Scope a poll's full (both-draw) LiveMatch[] down to ONE draw, by
 * `drawKind` (URS-131-ish: draw-scoped rails/panel). Shared by main.ts for
 * BOTH the rails (`assignRails`) and the "Live now" panel (`renderScoreboard`)
 * so the two views can never disagree about which matches belong to the
 * currently-selected draw. Pure/total: an empty/mismatched `drawId` just
 * yields an empty array, never throws. Does NOT affect win-celebration
 * detection (`detectWins`), which is deliberately called with the
 * UNFILTERED `state.matches` so it keeps firing for either tour regardless
 * of which draw is on screen (explicit product decision -- see main.ts). */
export function filterMatchesForDraw(matches: LiveMatch[], drawId: DrawId): LiveMatch[] {
  return matches.filter((m) => m.drawKind === drawId);
}

/** Scope the full per-draw overlay map down to just the active draw, with the
 * OTHER draw's slot zeroed out -- kept as a `Record<DrawId, LiveOverlay>` (not
 * a bare `LiveOverlay`) because `assignRails`'s node reverse-lookup expects
 * that shape. This is what prevents an unplaced match belonging to the other
 * draw from leaking onto the active draw's rail (an unbound match has no
 * overlay entry either way, but this keeps the two filters symmetric and the
 * overlay argument honest about "what's visible right now"). */
export function filterOverlaysForDraw(
  overlaysByDraw: Record<DrawId, LiveOverlay>,
  drawId: DrawId,
): Record<DrawId, LiveOverlay> {
  const result = {} as Record<DrawId, LiveOverlay>;
  for (const id of Object.keys(overlaysByDraw) as DrawId[]) {
    result[id] = id === drawId ? overlaysByDraw[id] : {};
  }
  return result;
}

export type RailSide = "left" | "right";

export interface RailCard {
  match: LiveMatch;
  side: RailSide;
  /** Node angle in degrees (layout.ts convention: negative = left semicircle,
   * >=0 = right). `Infinity` for unbound matches (no angle -- URS-121.1). */
  angle: number;
  nodeNum?: number;
  drawId?: DrawId;
}

export interface RailAssignment {
  left: RailCard[];
  right: RailCard[];
  /** Live matches that don't map to any bracket node (URS-121.1) -- included
   * here AND already appended into `right` (in the same deterministic order)
   * per the default placement rule; exposed separately for tests/inspection. */
  unplaced: RailCard[];
}

/** Reverse-lookup: given a match id, find which draw/node it's overlaid onto
 * (if any). O(n) over the small overlay maps -- these are at most a few dozen
 * entries, called once per poll, so this is not a hot-path concern. */
function findNodeForMatch(
  matchId: string,
  overlaysByDraw: Record<DrawId, LiveOverlay>,
): { drawId: DrawId; nodeNum: number } | undefined {
  for (const drawId of Object.keys(overlaysByDraw) as DrawId[]) {
    const overlay = overlaysByDraw[drawId];
    for (const [numStr, data] of Object.entries(overlay)) {
      if (data.matchId === matchId) {
        return { drawId, nodeNum: Number(numStr) };
      }
    }
  }
  return undefined;
}

/** Assign every `in` match to a rail (URS-120, URS-121). Matched matches are
 * split left/right by the sign of their node's `angleOf()` and ordered
 * top-to-bottom by the node's actual screen-Y (`geo.pt(radius, angle)[1]`) --
 * this sidesteps angle-wrap ambiguity at ±180° and matches the node's real
 * vertical position on the ring exactly. Unbound matches (URS-121.1) get a
 * deterministic (feed-id-sorted) placement appended below the matched right
 * cards, never dropped and never forced onto an arbitrary node. */
export function assignRails(
  liveMatches: LiveMatch[],
  overlaysByDraw: Record<DrawId, LiveOverlay>,
  drawsById: Record<DrawId, Draw>,
): RailAssignment {
  const left: RailCard[] = [];
  const right: RailCard[] = [];
  const unplaced: RailCard[] = [];

  for (const m of liveMatches) {
    if (m.state !== "in") continue;
    const loc = findNodeForMatch(m.id, overlaysByDraw);
    if (!loc) {
      unplaced.push({ match: m, side: "right", angle: Infinity });
      continue;
    }
    const draw = drawsById[loc.drawId];
    if (!draw) {
      unplaced.push({ match: m, side: "right", angle: Infinity });
      continue;
    }
    const geo = buildGeometry(draw);
    const angle = geo.angleOf(loc.nodeNum);
    const side: RailSide = angle < 0 ? "left" : "right";
    const card: RailCard = { match: m, side, angle, nodeNum: loc.nodeNum, drawId: loc.drawId };
    (side === "left" ? left : right).push(card);
  }

  function screenY(card: RailCard): number {
    if (!card.drawId || card.nodeNum == null) return Number.POSITIVE_INFINITY;
    const geo = buildGeometry(drawsById[card.drawId]!);
    const lvl = geo.levelOf[card.nodeNum]!;
    return geo.pt(geo.radius[lvl]!, card.angle)[1];
  }

  left.sort((a, b) => screenY(a) - screenY(b));
  right.sort((a, b) => screenY(a) - screenY(b));
  // Deterministic order for unbound matches so cards don't jump between polls
  // (URS-121.1) -- sorted by the stable feed competition id.
  unplaced.sort((a, b) => a.match.id.localeCompare(b.match.id));

  // Default placement rule: unbound matches appended BELOW the matched right
  // rail cards (URS-121.1) -- never a second data path, always visible.
  right.push(...unplaced);

  return { left, right, unplaced };
}

/* ------------------------------- Rendering ---------------------------------- */

function railCardWrap(card: RailCard): string {
  const spotlightAttrs =
    card.nodeNum != null && card.drawId
      ? ` data-node-num="${card.nodeNum}" data-draw-id="${card.drawId}" tabindex="0" role="button" aria-label="Show ${card.match.players[0]?.displayName ?? ""} versus ${card.match.players[1]?.displayName ?? ""} on the bracket"`
      : "";
  return `<div class="rail-card"${spotlightAttrs}>${renderCard(card.match)}</div>`;
}

function unplacedHeadingHTML(): string {
  return `<div class="rail-unplaced-heading">Unplaced live matches</div>`;
}

/** Render one side's cards, cheap-signature-diffed at the card level (reusing
 * scoreboard.ts's `renderCard`, whose HTML already varies with the match's
 * data -- rebuilding a `.rail-card` per side is acceptably cheap since a rail
 * holds at most a handful of `in` matches; only fired on `poll`, never the 1s
 * tick, URS-122). */
export function renderRailSide(cards: RailCard[], unplacedStartsAt: number): string {
  if (cards.length === 0) return `<p class="rail-empty">No live matches on this side.</p>`;
  let html = "";
  cards.forEach((card, i) => {
    if (i === unplacedStartsAt && unplacedStartsAt > 0 && unplacedStartsAt < cards.length) {
      html += unplacedHeadingHTML();
    }
    html += railCardWrap(card);
  });
  return html;
}

export interface RailsMount {
  leftEl: HTMLElement;
  rightEl: HTMLElement;
  leftWrapEl: HTMLElement; // <aside> wrapping left (for empty-state hide)
  rightWrapEl: HTMLElement; // <aside> wrapping right
}

let lastLeftIds = "";
let lastRightIds = "";

/** Render both rails from the assignment (URS-120…URS-124). Hides each
 * `<aside>` wrapper when it holds zero cards (calm empty state, URS-124) --
 * both wrappers hidden when there are zero live matches at all. Diffs at the
 * "which card ids, in which order" level so an unchanged rail isn't torn
 * down and rebuilt every poll. */
export function renderRails(assignment: RailAssignment, mount: RailsMount): void {
  const leftIds = assignment.left.map((c) => c.match.id).join(",");
  const rightIds = assignment.right.map((c) => c.match.id).join(",");

  const rightMatchedCount = assignment.right.length - assignment.unplaced.length;

  if (leftIds !== lastLeftIds) {
    mount.leftEl.innerHTML = renderRailSide(assignment.left, -1);
    lastLeftIds = leftIds;
  }
  if (rightIds !== lastRightIds) {
    mount.rightEl.innerHTML = renderRailSide(assignment.right, rightMatchedCount);
    lastRightIds = rightIds;
  }

  mount.leftWrapEl.style.display = assignment.left.length > 0 ? "" : "none";
  mount.rightWrapEl.style.display = assignment.right.length > 0 ? "" : "none";
}

/** Reset the internal diff cache -- call when the rails are torn down/rebuilt
 * from scratch (e.g. tests) so stale ids don't suppress a re-render. */
export function resetRailsDiffState(): void {
  lastLeftIds = "";
  lastRightIds = "";
}

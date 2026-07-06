/* ============================================================================
   SVG + HTML token overlay rendering (URS-1, URS-4…URS-9, URS-26, URS-27).
   Ported from the reference's render(): SVG lines/dots/trophy assembled as a
   string, HTML <img>/<div> flag tokens absolutely positioned over it so
   circular clipping is trivial. Diffs the previous winner set to decide which
   tokens get the "pop" reveal animation (URS-27).
============================================================================ */
import type { Draw, ResolvedModel, ResolvedNode } from "./types";
import { buildGeometry } from "./layout";
import { formatScore } from "./model";
import { roundName, sideLabel } from "./labels";
import { matchStatus } from "./status";
import { formatScheduled } from "./time";
import { playerById } from "../data/players";
import { courtName, courtTierClass } from "../data/courts";
import type { TipData } from "./tooltip";
import type { LiveNodeData, LiveOverlay } from "../live/types";

/* ============================================================================
   Live overlay merge hook (URS-88, URS-89, URS-93) -- the ONLY place
   src/bracket/** reads live data. `effectiveNode` produces a node-shaped view
   with live score/winner/court substituted when the feed covers this node;
   otherwise it returns the local node completely unchanged. Removing the
   `overlay` argument (or passing `undefined`/`{}`) makes every call a no-op,
   which is what restores the exact pre-feature render (URS-85).
============================================================================ */
export interface EffectiveNode extends ResolvedNode {
  /** True when this node's data currently comes from the live feed and the
   * feed reports the match in progress (URS-89) -- forces the "live" status
   * cue regardless of the clock heuristic. */
  liveInProgress: boolean;
  /** True when ANY live data (in or post) is overlaid on this node -- used to
   * enrich the tooltip (URS-93) even for a live "post" result. */
  hasLiveCoverage: boolean;
  /** status.type.detail from the feed, e.g. "5th Set" (URS-90, URS-93). */
  liveDetail?: string;
  /** Resolved player id of the server, if the feed provided possession. */
  servingPlayerId?: string;
}

function effectiveNode(node: ResolvedNode | undefined, live: LiveNodeData | undefined): EffectiveNode | undefined {
  if (!node) return undefined;
  if (!live || (live.state !== "in" && live.state !== "post")) {
    return { ...node, liveInProgress: false, hasLiveCoverage: false };
  }
  const liveInProgress = live.state === "in";
  // Precedence (URS-88): live "in"/"post" data drives score+winner; if the
  // live grid is empty (e.g. pre-serve), keep the local score rather than
  // blanking a previously-known result.
  const score = live.sets.length > 0 ? live.sets : node.score;
  const winner = live.state === "post" && live.winnerPlayerId ? live.winnerPlayerId : node.winner;
  return {
    ...node,
    score,
    winner,
    courtId: live.court ?? node.courtId,
    liveInProgress,
    hasLiveCoverage: true,
    liveDetail: live.detail,
    servingPlayerId: live.servingPlayerId,
  };
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

interface FlagRenderInfo {
  x: number;
  y: number;
  playerId: string;
  cls: string;
  courtId?: string;
  tip: TipData;
}

/** Everything render() needs from the outside world, injected so this module
 * stays pure/testable and framework-free (BUILD-BLUEPRINT §12). `overlay` is
 * optional and defaults to empty -- omitting it entirely reproduces the exact
 * pre-feature render (URS-85, URS-88). */
export interface RenderContext {
  draw: Draw;
  model: ResolvedModel;
  prevWinners: Record<number, string | null>;
  nowMs: number;
  overlay?: LiveOverlay;
}

export interface RenderResult {
  html: string;
  winners: Record<number, string | null>;
}

function tipFor(
  draw: Draw,
  model: ResolvedModel,
  num: number,
  maxLevel: number,
  overlay: LiveOverlay | undefined,
  overrideRound?: string,
): TipData {
  const node = effectiveNode(model[num], overlay?.[num]);
  const level = buildGeometry(draw).levelOf[num]!;
  const teams = `${sideLabel(draw, model, num, 0)} vs ${sideLabel(draw, model, num, 1)}`;
  const score = formatScore(node?.score);
  // Live-forcing (URS-89): a node with live "in" coverage always reads as
  // live regardless of the clock heuristic; otherwise fall back to it as-is.
  const status = node?.liveInProgress ? "live" : matchStatus(node, Date.now());
  const servingPlayer = node?.servingPlayerId ? playerById(node.servingPlayerId) : undefined;
  return {
    round: overrideRound ?? roundName(level, maxLevel),
    teams,
    score,
    when: score ? "" : formatScheduled(node?.date, node?.time),
    status,
    court: courtName(node?.courtId),
    placeholder: draw.placeholder,
    live: !!node?.hasLiveCoverage,
    liveDetail: node?.liveDetail,
    serving: servingPlayer?.name,
  };
}

function tipAttrs(tip: TipData, courtId?: string): string {
  return (
    `data-round="${escapeAttr(tip.round)}" data-teams="${escapeAttr(tip.teams)}" ` +
    `data-score="${escapeAttr(tip.score)}" data-when="${escapeAttr(tip.when)}" ` +
    `data-status="${escapeAttr(tip.status)}" data-court="${escapeAttr(tip.court)}" ` +
    `data-placeholder="${tip.placeholder ? "1" : ""}" ` +
    `data-live="${tip.live ? "1" : ""}" data-live-detail="${escapeAttr(tip.liveDetail ?? "")}" ` +
    `data-serving="${escapeAttr(tip.serving ?? "")}" ` +
    `data-court-id="${escapeAttr(courtId ?? "")}"`
  );
}

function trophySVG(cx: number, cy: number, courtId?: string): string {
  return `<g class="trophy" data-court-id="${escapeAttr(courtId ?? "")}" transform="translate(${cx},${cy})" fill="var(--line)">
    <path d="M-16,-26 h32 v8 a16,18 0 0 1 -32,0 z" />
    <path d="M-22,-24 a8,8 0 0 0 8,8 v-4 a4,4 0 0 1 -4,-4 z" />
    <path d="M22,-24 a8,8 0 0 1 -8,8 v-4 a4,4 0 0 0 4,-4 z" />
    <rect x="-4" y="-6" width="8" height="12"/>
    <rect x="-12" y="6" width="24" height="5" rx="2"/>
    <rect x="-16" y="11" width="32" height="6" rx="2"/>
  </g>`;
}

const FLAG_WIDTH_BUCKET = "h80"; // flagcdn height-bucket for the small circular tokens (URS-54)
const CHAMP_WIDTH_BUCKET = "h240";

function flagURL(iso: string | undefined, bucket: string): string {
  if (!iso) return "";
  return `https://flagcdn.com/${bucket}/${iso}.png`;
}

/** Render one draw's bracket into an SVG + token-overlay HTML string, and
 * report which nodes newly resolved a winner (for the pop animation + the
 * caller's prevWinners bookkeeping) (URS-27). */
export function renderBracket(ctx: RenderContext): RenderResult {
  const { draw, model, prevWinners, overlay } = ctx;
  const geo = buildGeometry(draw);
  const maxLevel = geo.maxLevel;
  const newWinners: Record<number, string | null> = {};
  const flags: FlagRenderInfo[] = [];

  // Outer ring: the two players of every leaf match (URS-4).
  for (const f of geo.flagOrder) {
    const node = effectiveNode(model[f.num], overlay?.[f.num]);
    const playerId = node?.participants[f.slot];
    if (!playerId) continue; // URS-7: undecided outer slot renders as a dot elsewhere? -- leaves always have both known in our data, but guard anyway
    const [x, y] = geo.pt(geo.radius[0]!, geo.flagAngle(geo.flagOrder.indexOf(f)));
    const win = node?.winner;
    const eliminated = !!win && win !== playerId;
    const tip = tipFor(draw, model, f.num, maxLevel, overlay);
    const status = node?.liveInProgress ? "live" : matchStatus(node, ctx.nowMs);
    const statusCls = status ? ` ${status}` : "";
    flags.push({
      x,
      y,
      playerId,
      cls: `r0${eliminated ? " eliminated" : win === playerId ? " win" : ""}${statusCls}`,
      courtId: node?.courtId,
      tip,
    });
  }

  let conns = "";
  let dots = "";
  let caps = "";
  const parentOf: Record<number, number> = {};
  for (const [p, kids] of Object.entries(draw.children)) {
    for (const c of kids) parentOf[c] = Number(p);
  }

  const allNums = Object.keys(geo.levelOf).map(Number);
  for (const num of allNums) {
    const lvl = geo.levelOf[num]!;
    const node = effectiveNode(model[num], overlay?.[num]);
    const courtIdAttr = `data-court-id="${escapeAttr(node?.courtId ?? "")}"`;
    const capTip = tipFor(draw, model, num, maxLevel, overlay);
    caps += `<path class="cap${courtTierClass(node?.courtId)}" ${tipAttrs(capTip, node?.courtId)} stroke-width="${geo.capsuleStrokeWidth(num)}" d="${geo.capsulePath(num)}"/>`;
    if (lvl <= maxLevel - 1) {
      conns += `<path class="conn" ${courtIdAttr} d="${geo.connectorPath(num)}"/>`;
    }
    if (num === draw.rootNum) continue; // Final handled at centre
    const ang = geo.angleOf(num);
    const [x, y] = geo.pt(geo.radius[lvl]!, ang);
    const w = node?.winner;
    if (w) {
      newWinners[num] = w;
      const pop = prevWinners[num] !== w ? " pop" : "";
      const nextNum = parentOf[num];
      const tip =
        nextNum != null
          ? tipFor(draw, model, nextNum, maxLevel, overlay)
          : tipFor(draw, model, num, maxLevel, overlay);
      const nextEffective = nextNum != null ? effectiveNode(model[nextNum], overlay?.[nextNum]) : undefined;
      const advanced = nextNum != null && nextEffective?.winner === w ? " win" : "";
      const status = nextEffective?.liveInProgress ? "live" : matchStatus(nextEffective, ctx.nowMs);
      const statusCls = status ? ` ${status}` : "";
      flags.push({
        x,
        y,
        playerId: w,
        cls: `r${lvl}${advanced}${pop}${statusCls}`,
        courtId: node?.courtId,
        tip,
      });
    } else {
      dots += `<circle class="dot" ${courtIdAttr} cx="${x}" cy="${y}" r="4"/>`;
    }
  }

  // Final / centre (URS-5).
  const finalNode = effectiveNode(model[draw.rootNum], overlay?.[draw.rootNum]);
  const finalCourtAttr = `data-court-id="${escapeAttr(finalNode?.courtId ?? "")}"`;
  const [sfA, sfB] = draw.children[draw.rootNum] ?? [];
  let center = "";
  if (sfA != null && sfB != null) {
    const p1 = geo.pt(geo.radius[maxLevel - 1]!, geo.angleOf(sfA));
    const p2 = geo.pt(geo.radius[maxLevel - 1]!, geo.angleOf(sfB));
    center += `<line class="center-line" ${finalCourtAttr} x1="${geo.pt(0, 0)[0]}" y1="${geo.pt(0, 0)[1]}" x2="${p1[0]}" y2="${p1[1]}"/>`;
    center += `<line class="center-line" ${finalCourtAttr} x1="${geo.pt(0, 0)[0]}" y1="${geo.pt(0, 0)[1]}" x2="${p2[0]}" y2="${p2[1]}"/>`;
  }
  let champFlag: FlagRenderInfo | null = null;
  if (finalNode?.winner) {
    newWinners[draw.rootNum] = finalNode.winner;
    const pop = prevWinners[draw.rootNum] !== finalNode.winner ? " pop" : "";
    const tip = tipFor(draw, model, draw.rootNum, maxLevel, overlay, "Champion");
    const [cx, cy] = geo.pt(0, 0);
    champFlag = {
      x: cx,
      y: cy,
      playerId: finalNode.winner,
      cls: `champ${pop}`,
      courtId: finalNode.courtId,
      tip,
    };
  } else {
    const [cx, cy] = geo.pt(0, 0);
    center += trophySVG(cx, cy, finalNode?.courtId);
  }

  // The SVG (connectors/dots/trophy/capsules) is purely decorative structure;
  // the tokens (with alt text) plus the visually-hidden results list (URS-48)
  // carry the actual meaning, so the SVG itself is aria-hidden (not role=img,
  // which would conflict with hidden and duplicate the stage-wrap's own label).
  const svg = `<svg viewBox="0 0 1000 1000" aria-hidden="true">${caps}${conns}${center}${dots}</svg>`;
  const allFlags = champFlag ? [...flags, champFlag] : flags;
  let tokenHTML = "";
  for (const fl of allFlags) {
    const player = playerById(fl.playerId);
    const bucket = fl.cls.includes("champ") ? CHAMP_WIDTH_BUCKET : FLAG_WIDTH_BUCKET;
    const src = flagURL(player?.iso, bucket);
    const left = ((fl.x / 1000) * 100).toFixed(3);
    const top = ((fl.y / 1000) * 100).toFixed(3);
    const data = tipAttrs(fl.tip, fl.courtId);
    const name = player?.name ?? fl.playerId;
    const nationality = player?.iso ? player.iso.toUpperCase() : "unknown nationality";
    const alt = `${name} (${nationality})`; // URS-49: meaningful alt text, never "flag"
    const seedBadge =
      player?.seed != null
        ? `<span class="seed-badge" aria-hidden="true">${player.seed}</span>`
        : "";
    const codeBadge = `<span class="code-badge" aria-hidden="true">${escapeAttr(player?.shortCode ?? "")}</span>`;
    // data-* (tooltip payload) lives on the .flag-wrap itself in BOTH branches:
    // main.ts's pointerover/click handlers do closest(".flag-wrap,.cap") and
    // read .dataset off that element, so the tip data must not live only on
    // the inner <img> (a real bug caught by golden-path testing: hover/tap
    // silently did nothing because dataset was empty on the wrapper).
    if (src) {
      tokenHTML += `<div class="flag-wrap ${fl.cls}" ${data} tabindex="0" role="button" style="left:${left}%;top:${top}%">
        <img class="flag-img" src="${src}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async"
          onerror="this.removeAttribute('src');this.closest('.flag-wrap').classList.add('flag-fallback')"/>
        ${seedBadge}${codeBadge}
      </div>`;
    } else {
      tokenHTML += `<div class="flag-wrap flag-fallback ${fl.cls}" ${data} tabindex="0" role="button" style="left:${left}%;top:${top}%">
        <span class="sr-only">${escapeAttr(alt)}</span>${seedBadge}${codeBadge}
      </div>`;
    }
  }

  return { html: svg + tokenHTML, winners: newWinners };
}

/** Visually-hidden results list for assistive tech (URS-48): round -> match ->
 * players (with seeds) -> score/schedule, kept in sync with the model.
 * `overlay` is optional (URS-85): omitting it reproduces the pre-feature text
 * exactly; when present, a node's live score/winner (URS-89) is reflected here
 * too so screen-reader users see the same live data as sighted users. */
export function renderResultsList(draw: Draw, model: ResolvedModel, overlay?: LiveOverlay): string {
  const geo = buildGeometry(draw);
  const maxLevel = geo.maxLevel;
  const byLevel: Record<number, number[]> = {};
  for (const [numStr, lvl] of Object.entries(geo.levelOf)) {
    const num = Number(numStr);
    (byLevel[lvl] ??= []).push(num);
  }
  let html = `<h2 class="sr-only">${escapeAttr(draw.label)} — results (text alternative to the bracket)</h2>`;
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const nums = (byLevel[lvl] ?? []).sort((a, b) => a - b);
    html += `<h3>${escapeAttr(roundName(lvl, maxLevel))}</h3><ul>`;
    for (const num of nums) {
      const node = effectiveNode(model[num], overlay?.[num]);
      const p1 = sideLabel(draw, model, num, 0);
      const p2 = sideLabel(draw, model, num, 1);
      const player1 = playerById(node?.participants[0] ?? undefined);
      const player2 = playerById(node?.participants[1] ?? undefined);
      const seed1 = player1?.seed ? ` (seed ${player1.seed})` : "";
      const seed2 = player2?.seed ? ` (seed ${player2.seed})` : "";
      const score = formatScore(node?.score);
      const liveNote = node?.liveInProgress ? " (live)" : "";
      const scoreLabel = score
        ? `Result: ${score}${liveNote}${node?.winner ? `, winner ${playerById(node.winner)?.name ?? node.winner}` : ""}`
        : `Not yet played — ${formatScheduled(node?.date, node?.time)}`;
      const court = courtName(node?.courtId);
      html += `<li>${escapeAttr(p1)}${seed1} vs ${escapeAttr(p2)}${seed2}. ${escapeAttr(scoreLabel)}${
        court ? `. Court: ${escapeAttr(court)}` : ""
      }.</li>`;
    }
    html += "</ul>";
  }
  const champion = effectiveNode(model[draw.rootNum], overlay?.[draw.rootNum])?.winner;
  html += `<h3>${championRoundName()}</h3><p>${
    champion ? escapeAttr(playerById(champion)?.name ?? champion) : "Not yet decided"
  }</p>`;
  return html;
}

function championRoundName(): string {
  return "Champion";
}

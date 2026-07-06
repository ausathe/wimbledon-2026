# LIVE-SCORES-BLUEPRINT — Wimbledon 2026 live scoring feature

**Project slug:** `wimbledon-2026`
**Audience:** developer-agent (build) + test-agent (verify)
**Requirements:** `docs/URS.md` addendum A — **URS-78…URS-106**. Reference every claim by id.
**Prerequisite:** the existing bracket (URS-1…URS-77, `BUILD-BLUEPRINT.md`) is built and shipped.
This document is *additive* — it does not restate the base build. It augments it.

> This is a MAJOR FEATURE on the existing site, not a redesign. Do not touch `src/bracket/**`
> render/layout/model internals except at the single documented merge point (URS-85, §4.4). The
> local-data path (URS-30) must keep working with the live layer disabled.

---

## 0. The verified data source (do NOT re-probe — build to this)

The orchestrator has already verified the source and its exact capabilities. Build to these facts:

- **Endpoints (free, keyless, CORS `Access-Control-Allow-Origin: *`, fetch directly from the
  browser on a static site):**
  - Men: `https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard`
  - Women: `https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard`
- **Response shape you may rely on:**
  ```
  root.events[0]                       // current tournament
    .name                              // e.g. "Wimbledon"  -> gate on this (URS-81)
    .groupings[]                       // draws
      .[grouping].name                 // "Men's Singles" / "Women's Singles" (+ doubles: ignore)
      .competitions[]                  // matches in that draw
        .status.type.state             // "in" | "post" | "pre"
        .status.type.detail            // "5th Set", "Final", ...
        .status.type.shortDetail       // short form
        .situation                     // optional, best-effort only
        .competitors[]                 // EXACTLY 2
          .athlete.displayName         // "Carlos Alcaraz"
          .winner                      // bool | null
          .possession / .active        // server flag (name varies; check both) — optional
          .linescores[]                // per-set scores
            .value                     // games in that set for THIS competitor (number)
            .tiebreak                  // optional tiebreak point count for THIS competitor
            .winner                    // optional, set-level winner flag
        .venue / .court                // best-effort court name if present
  ```
- **HONEST capability:** set-by-set games + tiebreak point counts + current-set + server + state +
  round/detail, live. **NOT available:** live game point score (0/15/30/40/deuce/adv). The
  point-by-point summary endpoint returned HTTP 400 / not openly accessible. **Do not build or
  claim a point ticker** (URS-91). If a payload happens to carry point data, treat it strictly as
  best-effort/optional.

**A set's `games` tuple is assembled by pairing the two competitors' `linescores[i].value`:**
competitor[0].linescores[i].value → `games[0]`, competitor[1].linescores[i].value → `games[1]`.
`tb` is `[competitor[0].linescores[i].tiebreak, competitor[1].linescores[i].tiebreak]` when either
tiebreak field is present. This is exactly the existing `SetGames` shape — reuse it (URS-84).

---

## 1. Design principle: OVERLAY, don't rewrite

The existing bracket is a pure pipeline: `Draw (local JSON)` → `buildModel(draw)` → `ResolvedModel`
→ `renderBracket()`. **Do not feed live data into the JSON or `buildModel`.** Instead build a
**live overlay** computed in parallel and merged at render time, keyed by node number. This keeps:

- the local snapshot as the always-present fallback (URS-98) — remove the overlay and you get the
  exact pre-feature render (URS-85, URS-88);
- `src/bracket/**` untouched except one merge hook;
- score formatting/scoring logic single-sourced in `model.ts` (`formatScore`, set-win derivation),
  because the overlay reuses the same `SetScore` type (URS-84).

```
                 ┌───────────────── existing (unchanged) ─────────────────┐
  local JSON ──▶ buildModel(draw) ──▶ ResolvedModel ──▶ renderBracket() ──▶ DOM
                                            ▲                    ▲
                                            │ merge (URS-88)     │ enrich tooltip (URS-93)
  ESPN feed ──▶ fetch+parse ──▶ LiveMatch[] ──▶ reconcile ──▶ LiveOverlay {nodeNum: LiveNodeData}
     (new src/live/**)                              (name match, URS-86)         │
                                                                                 ▼
                                                              LiveScoreboard panel (URS-90)
```

---

## 2. New folder structure (all new code under `src/live/**`)

```
src/live/
├── espn-types.ts        minimal TS interfaces for the ESPN payload we consume (§0 shape)
├── endpoints.ts         the two URLs + constants (POLL_MS, TICK_MS, FETCH_TIMEOUT_MS, BACKOFF_*)
├── fetch.ts             fetchScoreboard(url): concurrent fetch w/ AbortController timeout (URS-80)
├── adapter.ts           espnToLiveMatches(json, drawKind): ESPN JSON -> LiveMatch[]  (URS-82..84)
├── reconcile.ts         name normalization + alias map; matchLiveToNodes(live, draw, model)
│                        -> LiveOverlay; unmatched bookkeeping (URS-86, URS-87)
├── live-store.ts        the poll+tick engine: two timers, backoff, visibility pause, state +
│                        subscriber callbacks (URS-78,79,95,98,102,104). Framework-free.
├── scoreboard.ts        renders the live scoreboard panel DOM from LiveMatch[] (URS-90..97,103)
└── types.ts             LiveMatch, LiveNodeData, LiveOverlay, LiveState, LiveStatusKind
```

Astro shell additions:
```
src/components/LiveScoreboard.astro   static container + <section aria-label="Live scores"> mount
src/pages/index.astro                 mount the panel (placement per URS-92 / CQ-A1)
src/styles/live.css                   scoped styles for the panel — reuse tokens.css vars (URS-94)
```

`src/bracket/main.ts` gains a small wiring block (see §5). No other `src/bracket/**` file changes
except the single tooltip-enrichment hook (§4.5) and passing the overlay into `render()` (§4.4).

---

## 3. Internal types (`src/live/types.ts`)

```ts
import type { SetScore } from "../bracket/types";

export type LiveState = "in" | "post" | "pre";
export type DrawKind = "gentlemens-singles" | "ladies-singles"; // reuse DrawId values

export interface LivePlayer {
  displayName: string;        // raw from feed, e.g. "Carlos Alcaraz"
  normalizedKey: string;      // normalize(displayName) for matching (URS-86)
  playerId?: string;          // resolved players.ts id if matched, else undefined (URS-87)
  seed?: number;              // from players.ts when resolved
  iso?: string;               // from players.ts when resolved (for flag in the panel)
  serving?: boolean;          // server indicator when feed provides it (URS-90)
  winner?: boolean;
}

export interface LiveMatch {
  drawKind: DrawKind;
  state: LiveState;
  detail: string;             // status.type.detail ("5th Set"), for round/status text
  court?: string;             // best-effort court name from feed
  players: [LivePlayer, LivePlayer];
  sets: SetScore;             // reuse existing SetGames[]; each set a paired games tuple (+tb)
  currentSetIndex: number;    // which sets[] column is live (in-progress); -1 if none/post
  raw?: unknown;              // keep the source competition for debugging (dev only)
}

/** What gets overlaid onto a matched bracket node (URS-88). */
export interface LiveNodeData {
  state: LiveState;
  sets: SetScore;
  currentSetIndex: number;
  winnerPlayerId?: string;    // resolved id of the winning side, if post
  serving?: string;           // resolved id of server, if any
}

/** nodeNum -> live data, for the current draw only. Empty = no live coverage. */
export type LiveOverlay = Record<number, LiveNodeData>;

export interface LiveState_Engine {
  ok: boolean;                // last poll succeeded
  isWimbledon: boolean;       // events[0] is Wimbledon (URS-81)
  lastPollMs: number | null;  // Date.now() of last SUCCESSFUL poll (for "updated Xs ago")
  matches: LiveMatch[];       // all parsed live/post matches across both draws
  overlays: Record<DrawKind, LiveOverlay>;
  liveCount: number;          // matches with state === "in"
}
```

---

## 4. Module responsibilities

### 4.1 `fetch.ts` (URS-80, URS-98)
- `fetchScoreboard(url, signal)`: `fetch(url, {signal})`, `AbortController` with `FETCH_TIMEOUT_MS`
  (8000). Throw on non-2xx. Callers catch — never let a rejection escape to `unhandledrejection`.
- The store calls both endpoints with `Promise.allSettled` so one failing draw doesn't kill the
  other (URS-80). A fully-failed poll (both rejected) → degrade (URS-98).

### 4.2 `adapter.ts` (URS-81, URS-82, URS-83, URS-84)
- `espnToLiveMatches(json, drawKind): LiveMatch[]`:
  1. `const ev = json?.events?.[0]`. If no `ev` → return `[]` and signal `isWimbledon=false`.
  2. **Wimbledon gate (URS-81):** `if (!/wimbledon/i.test(ev.name ?? "")) return []` and flag
     not-Wimbledon (store treats as no live data → local fallback).
  3. Pick the **singles** grouping by name (`/singles/i` AND matches the draw's gender — men's for
     atp, women's for wta; ignore `/doubles/i`). Missing → `[]` (URS-82).
  4. For each `competition`: guard `competitors.length === 2`; read `status.type.state`; build the
     two `LivePlayer`s from `athlete.displayName` (+ `winner`, server flag from `possession` ||
     `active`); build `sets` by zipping `competitors[0].linescores[i]` with `[1].linescores[i]`
     into `{games:[v0,v1], tb?:[t0,t1]}` — skip a set index if `value` is non-numeric.
     `currentSetIndex` = last set index while `state==="in"` (else -1).
  5. **Every field access defensive (URS-83):** optional chaining + type guards; a bad competition
     is `continue`d, not thrown; other competitions still parse.
- Keep a thin `espn-types.ts` describing only the fields in §0 (all optional) so the adapter is
  typed without `any` (project convention: no bare `any`).

### 4.3 `reconcile.ts` (URS-86, URS-87)
- `normalize(name)`: `name.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase()
  .replace(/[^a-z0-9]+/g," ").trim()` — strips accents (Fokina, Müller), punctuation, casing.
- Build a `Map<normalizedKey, Player>` from `players.ts` **once**, plus an **alias map** for known
  ESPN-vs-ours display mismatches (e.g. "Alex de Minaur" ↔ "Alex De Minaur", "Felix
  Auger-Aliassime" ↔ "Felix Auger Aliassime", initials-first orderings). Start the alias map small;
  extend it when URS-87 bookkeeping logs an unmatched name.
- `resolvePlayer(displayName): Player | undefined` — normalized lookup, then alias lookup.
- `matchLiveToNodes(matches, draw, model): LiveOverlay`:
  - For each `LiveMatch` in this draw, resolve both players to ids. If either fails → this match is
    **unmatched**: do NOT overlay (URS-87); increment an unmatched counter; `console.warn` once
    (dev) with the raw name. Still keep it for the panel (labelled, no flag).
  - If both resolve, find the node in `model` whose `participants` (as a set) equals the two ids.
    Search all nodes (leaves and inner). If exactly one node matches → build `LiveNodeData` and add
    to overlay under that `num`. Zero or ambiguous → treat as unmatched (do not force).
  - Winner side → `winnerPlayerId`; server flag → `serving` (resolved id).

### 4.4 The merge hook (URS-88, URS-89) — the ONLY `render.ts`/`main.ts` change to the pipeline
- `render()` in `main.ts` currently does `buildModel(draw)` → `renderBracket({draw, model, ...})`.
  Add an optional `overlay: LiveOverlay` param threaded into `renderBracket`. Inside `render.ts`,
  **before** reading a node's `score`/`winner`/status, apply the overlay for that `num` if present:
  - if `overlay[num]` exists and its `state==="in"` or `post`: use `overlay[num].sets` as the
    node's `score` for token/tooltip; if `state==="in"`, force the **live** status cue (URS-89)
    regardless of the clock heuristic; if `post` with `winnerPlayerId`, treat as decided (winner
    highlight / loser dim, URS-26).
  - else fall back to the existing local `node.score`/`matchStatus(...)` exactly as today.
  - Implement this as a tiny helper `effectiveNode(node, overlay[num])` so the change is one
    localized function, not a scatter of conditionals (keeps `render.ts` diff small and reviewable).
- `status.ts` is unchanged; the overlay's live-forcing lives at the merge helper, not in the clock
  heuristic. Nodes with no overlay keep the URS-25 clock behaviour (URS-89 last sentence).

### 4.5 Tooltip enrichment (URS-93)
- `tipFor()` in `render.ts` builds `TipData` from the (now effective) node — so once the overlay
  drives `score`/`status`, the existing tooltip already shows live sets + "Live". Minimal extra:
  add an optional `serving` name and a `live: boolean` to `TipData` so `tooltip.ts` can render a
  server marker and a live label. Do NOT create a second tooltip system.

### 4.6 `live-store.ts` — the engine (URS-78, URS-79, URS-95, URS-98, URS-102, URS-104)
- Holds `LiveState_Engine`; exposes `subscribe(cb)`, `start()`, `stop()`.
- **Two timers, separate (URS-95):**
  - **poll timer** every `POLL_MS` (15000): fetch both endpoints concurrently, adapt, reconcile
    both overlays, update state, fire subscribers. On success reset backoff + `lastPollMs=now`.
  - **tick timer** every `TICK_MS` (1000): does **no network**; fires a lightweight "tick"
    subscriber event so the UI can update "updated Xs ago" and keep the pulse alive.
- **Backoff (URS-102):** on consecutive poll failures, multiply the effective poll delay
  (15s → 30s → 60s cap); reset to 15s on first success. Never a tight retry loop.
- **Visibility (URS-104):** on `document.hidden` pause the poll timer (keep or pause the tick —
  pausing both when hidden is fine); resume + immediate poll on `visibilitychange` to visible.
- **Teardown (URS-104):** `stop()` clears both timers and aborts any in-flight fetch; wire to
  `pagehide`/`beforeunload`.
- **Degradation (URS-98, URS-99, URS-101):** a failed/empty/non-Wimbledon poll sets
  `ok=false`/`isWimbledon=false`, empties overlays, and notifies subscribers — the bracket re-render
  then simply has no overlay and shows local data. No throw, `console.warn` at most once per failed
  poll.

### 4.7 `scoreboard.ts` + `LiveScoreboard.astro` (URS-90…URS-97, URS-99, URS-100, URS-103, URS-105)
- Static Astro shell: a `<section id="live-scoreboard" aria-label="Live scores">` with a header row
  (title "Live now", LIVE badge, "updated Xs ago" stamp, ESPN-source credit line — URS-105), a
  polite `aria-live` region (`aria-live="polite" aria-atomic="false"`) for change summaries
  (URS-103), and a `<div id="live-cards">` mount. Collapsible (details/summary or a toggle button
  with `aria-expanded`).
- `scoreboard.ts` `renderScoreboard(state)`:
  - Sort: `in` matches first, then today's `post` (URS-100, CQ-A3). Empty/off-season → the calm
    empty state string (URS-99/URS-100) — never an error.
  - Each **scorecard** is a small table (real `<table>`/`<caption>` or `role="table"` w/ row/col
    headers) so it's screen-reader legible (URS-103): rows = players (name + seed + flag when
    resolved), columns = sets; each cell the games, tiebreak as `<sup>` (URS-90). Current set column
    gets a highlight class (URS-90). Server marker (dot) on the serving player's row when known.
    LIVE badge for `in`, final result for `post`.
  - **Honesty (URS-91, URS-105):** header/footer copy says "live set & game scores via ESPN's
    public feed — unofficial, may differ from official scoring." No "point-by-point". No 0/15/30/40.
- **Tick vs poll updates (URS-95, URS-97):** the 1s tick only updates the "updated Xs ago" text and
  keeps the pulse; a real poll diff re-renders cards. Diff at the card level — only rebuild a card
  whose data changed (compare a cheap signature) to avoid layout thrash (URS-97). Reuse the "pop"
  transition vocabulary from `bracket.css` for changed cells.
- **aria-live throttling (URS-103):** on a poll that changed a score line, set the live region text
  to a concise summary (e.g. "Alcaraz–Sinner: 6–4, 3–2 (set 2)"), at most once per poll, only when
  something actually changed. Never write to it on the 1s tick.

---

## 5. Wiring in `main.ts` (small, additive)

```
import { LiveStore } from "../live/live-store";
import { renderScoreboard, mountScoreboard } from "../live/scoreboard";

const live = new LiveStore();
let overlays = { "gentlemens-singles": {}, "ladies-singles": {} };

live.subscribe((state, kind) => {
  if (kind === "poll") {
    overlays = state.overlays;
    render();                       // re-render bracket WITH overlay for currentDrawId
    renderScoreboard(state);        // re-render panel
    setLiveStatus(state);           // footer status dot honesty (URS-101)
  } else { // "tick"
    updateAgoStampAndPulse(state);  // no network, no bracket rebuild (URS-95)
  }
});
live.start();
```
- `render()` (existing) gains one arg: pass `overlays[currentDrawId]` into `renderBracket`.
- Everything degrades: if `live` never succeeds, `overlays` stays `{}` and the bracket renders
  exactly as pre-feature (URS-98).

---

## 6. Constants (`endpoints.ts`) — justify each (URS-79, URS-80, URS-95, URS-102)

```
POLL_MS          = 15_000   // network re-poll: fresh within 15s, gentle on a free unofficial feed;
                            // sub-second is pointless (no point-level data) and abusive. (URS-79)
TICK_MS          = 1_000    // display tick: "updated Xs ago" + pulse liveness. (URS-95)
FETCH_TIMEOUT_MS = 8_000    // per-request abort so a hung draw can't stall the loop. (URS-80)
BACKOFF_MAX_MS   = 60_000   // failure backoff cap. (URS-102)
ATP_URL / WTA_URL = (the two endpoints in §0)
```

---

## 7. Styling notes (`live.css`) — on-brand, reuse tokens (URS-94, URS-96, URS-103)

- Use existing `--green/--purple/--gold/--bg/--ink/--muted` from `tokens.css`. No new palette.
- LIVE badge/pulse: green or purple dot with a pulsing ring; **must** honor
  `@media (prefers-reduced-motion: reduce)` → static "LIVE" label, no animation (URS-103).
- Cards: reuse existing card/pill radii + spacing. Serif for the "Live now" heading, sans for
  scores/labels (URS-94). Current-set column highlight = a subtle gold/green tint, AA on ivory.
- Verify every text/badge pairing for WCAG AA on `--bg` (extends URS-45).
- Mobile: cards in a horizontally-scrollable strip or stacked accordion; panel collapsible so it
  never crowds the bracket (URS-92).

---

## 8. Degradation test matrix (what test-agent will exercise — URS-98…URS-101, URS-106)

| Condition | Expected (must not throw / no console errors) |
|---|---|
| Both endpoints blocked / offline | Local snapshot render intact; status "feed unavailable — showing saved snapshot"; no pulse |
| One endpoint fails, other ok | Working draw shows live; failed draw falls back to local; no throw |
| `events[0]` not Wimbledon / off-season | Calm empty state; local bracket; `isWimbledon=false`; no pulse (URS-99) |
| Wimbledon but zero `in` matches | "No matches live right now" (+ today's `post`); no pulse (URS-100) |
| Malformed JSON / missing groupings / competitors≠2 | Bad items skipped; valid items shown; no throw (URS-83) |
| Live player not in our R32 subset / unmatchable name | Not forced onto a node; may show in panel labelled; warn once (URS-87) |
| 429 / repeated failures | Backoff widens to 60s cap; resumes 15s on success; no tight loop (URS-102) |
| Tab hidden | Poll pauses; resumes + immediate poll on focus; timers cleaned on unload (URS-104) |
| `prefers-reduced-motion` | Pulse animation off; static LIVE label; score updates still apply (URS-103) |

---

## 9. Build order (recommended)

1. **Types + endpoints + fetch** (`live/types.ts`, `espn-types.ts`, `endpoints.ts`, `fetch.ts`);
   log a raw payload once in dev to confirm the §0 shape against the live feed. (URS-78, URS-80)
2. **Adapter** `espnToLiveMatches` with the Wimbledon gate + singles-grouping select + defensive
   set-zip; unit-sanity against a captured payload. (URS-81…URS-84)
3. **Reconcile** — normalize + alias map + `matchLiveToNodes`; verify names in `players.ts` resolve
   (log unmatched). (URS-86, URS-87)
4. **live-store** — two timers, allSettled poll, backoff, visibility, teardown, subscribers.
   (URS-79, URS-95, URS-98, URS-102, URS-104)
5. **Merge hook** — `effectiveNode` in `render.ts` + thread `overlay` through `renderBracket` +
   `main.ts` wiring; confirm removing the overlay = pre-feature render. (URS-88, URS-89)
6. **Tooltip enrichment** — `serving`/`live` on `TipData`. (URS-93)
7. **Scoreboard panel** — Astro shell + `scoreboard.ts` table cards, tiebreak superscripts,
   current-set highlight, server marker, LIVE badge, empty states, ESPN credit. (URS-90…URS-92,
   URS-99, URS-100, URS-105)
8. **Every-second tick** — "updated Xs ago" + pulse; wire tick vs poll separation. (URS-95, URS-96)
9. **a11y pass** — `aria-live` polite throttle, table semantics, keyboard, reduced-motion pulse
   off. (URS-103)
10. **Degradation pass** — walk the §8 matrix (block host, offline, off-season simulate). (URS-98…101)
11. **Perf/quality** — Lighthouse ≥90 ×4 with polling active, no console errors, no thrash, timer/
    abort cleanup, hidden-tab pause. (URS-104)
12. **Honesty/labelling** — ESPN-source credit, no point-by-point claim, fan disclaimer intact.
    (URS-91, URS-105)
13. **Hand to test-agent** against URS-78…URS-106 (definition of done URS-106).

---

## 10. Guardrails (do / don't)

- **Do** keep all live logic in `src/live/**`; the only `src/bracket/**` edits are the
  `effectiveNode` merge helper (§4.4) and `TipData` fields (§4.5).
- **Do** reuse `SetScore`/`formatScore`/the flag token treatment/tokens — no parallel score
  formatter, no new palette.
- **Don't** mutate the bundled JSON or `buildModel` output — overlay only (URS-88).
- **Don't** poll faster than 15s, poll on the 1s tick, or retry in a tight loop (URS-79, URS-102).
- **Don't** claim point-by-point or present ESPN data as official (URS-91, URS-105).
- **Don't** let any feed error throw, blank the bracket, or spam the console (URS-98, URS-56).

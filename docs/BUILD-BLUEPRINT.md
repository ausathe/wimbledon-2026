# BUILD-BLUEPRINT — Wimbledon 2026 Circular Bracket

**Project slug:** `wimbledon-2026`
**Audience:** developer-agent (build) + test-agent (verify)
**Source of truth for requirements:** `docs/URS.md` — reference every claim by its `URS-n` id.
**Reference site studied:** `https://shadymccoy.github.io/WC26/` (vanilla static single-file
circular World Cup bracket).

---

## 1. Shared contract for the pipeline

- **Requirement language:** every commit, defect, and test result references requirements by
  `URS-n` id. Dev and test never describe a feature in prose without its id.
- **Definition of done:** URS-74…URS-77. Test-agent issues GREEN only when every MUST passes,
  every SHOULD passes or has design sign-off, zero blocking defects, no console errors, dev
  server/static build runs clean, responsive + a11y + Lighthouse ≥90 verified.
- **When a requirement itself looks wrong or impossible:** stop and escalate to design-agent
  (via orchestrator). Do not silently reinterpret a URS.

---

## 2. Stack decision + rationale

### 2.1 Chosen stack

**Astro (static output) + TypeScript, with the bracket as a single self-contained client
`<script>` / vanilla TS module. Styling via scoped CSS + CSS custom properties (design tokens).
No UI framework runtime shipped. Deployed static to GitHub Pages via GitHub Actions.**

### 2.2 Why (against the studio stack table)

- The studio table maps **"Marketing / content / interactive-island static site"** → **Astro**,
  and this is exactly that: one content-heavy static page with a single rich interactive island
  (the bracket). Astro ships **near-zero JS** by default (URS-53, URS-52) and produces a pure
  static bundle deployable to Pages (URS-63, URS-64), matching the reference's hosting model.
- The reference is one vanilla `index.html`. We deliberately keep the **bracket logic vanilla
  TS** (no React/Vue for the SVG island) — it's DOM/SVG math, and a framework would only add
  runtime weight against URS-52/53. Astro gives us: TS, component structure for the static
  chrome (header/footer/legend markup), asset handling, base-path config for the `/wimbledon-2026/`
  Pages subpath (URS-64), and easy OG/meta/SEO (URS-57…URS-59).
- **Tailwind is NOT used here.** The design is a small, bespoke, token-driven visual system
  (radial SVG + a handful of controls); hand-authored scoped CSS with custom properties is
  lighter and closer to the reference than pulling in Tailwind. (Studio default is Tailwind
  "unless the project has a reason not to" — this is the reason: minimal surface, custom SVG
  visual, want to match the reference's featherweight footprint.)
- **shadcn/Radix not used** — no React, and the control set (two toggles + pills + tooltip) is
  small and custom; we build accessible controls directly (URS-47).

### 2.3 Acceptable alternative (if Astro proves friction)

A **single hand-authored `index.html` + `main.ts` bundled with Vite** (or even no bundler,
mirroring the reference 1:1) is an acceptable fallback that still satisfies every URS. If the
developer finds Astro's island model adds ceremony without payoff for a single-page app, they
MAY drop to Vite-vanilla-TS — but must still deliver TS, tokens, a11y, SEO meta, and the Pages
deploy. Escalate the choice change in the PR description; do not change the URS.

---

## 3. Folder structure

```
projects/wimbledon-2026/
├── CLAUDE.md                  project stack/scripts/conventions (dev writes/maintains)
├── package.json
├── astro.config.mjs           site + base "/wimbledon-2026/" for Pages
├── tsconfig.json
├── .github/workflows/deploy.yml   build + deploy to Pages (URS-65)
├── docs/
│   ├── URS.md                 (this spec — do not edit during build; escalate instead)
│   └── BUILD-BLUEPRINT.md
├── public/
│   ├── favicon.svg
│   └── og-image.png           social share image (URS-58)
└── src/
    ├── pages/
    │   └── index.astro        page shell: <head> meta/OG/SEO, header, main stage, footer
    ├── components/
    │   ├── Header.astro       title, 139th, dates, draw toggle markup
    │   ├── CourtsControl.astro  "Show courts" button + legend container
    │   └── Footer.astro       source credits + fan/unofficial disclaimer (URS-70,73)
    ├── styles/
    │   └── tokens.css         :root design tokens (colors, radii, fonts) — URS-33
    ├── bracket/               the interactive island (vanilla TS, framework-free)
    │   ├── main.ts            entry: load data → buildModel → render → wire interactions
    │   ├── model.ts           skeleton (CHILDREN/PARENT), buildModel, winner propagation
    │   ├── layout.ts          polar geometry: radius/angle per node, connector + capsule paths
    │   ├── render.ts          SVG + flag/token overlay, diff/pop animation
    │   ├── tooltip.ts         custom hover/tap tooltip incl. pinch-zoom-safe positioning
    │   ├── courts.ts          courts toggle, legend build, spotlight logic
    │   ├── status.ts          live/on-court-next/today windows from viewer clock
    │   ├── time.ts            local-time formatting of schedule (viewer time zone)
    │   └── types.ts           Draw, MatchNode, Player, Court types
    └── data/
        ├── players.ts         player → { name, iso, seed?, shortCode } lookup (URS-31)
        ├── courts.ts          court list: name, tier, capacity (URS-67)
        ├── gentlemens-singles.json   placeholder draw+results+schedule (URS-40,66,69)
        └── ladies-singles.json       placeholder draw+results+schedule
```

Keep geometry/interaction code **data-agnostic**: swapping the JSON files or the `players.ts`
lookup must be the only change needed to load real 2026 data (URS-31).

---

## 4. Route / page map

Single route: **`/`** (`index.astro`). No other pages. Draw switching (Gentlemen's ↔ Ladies')
is client-side re-render, not a route change (URS-2). This is a single-page app by design,
matching the reference.

---

## 5. Data model (types.ts)

```ts
type Tier = "roofed" | "open"; // court tier for tint (URS-18)
interface Court {
  id: string;
  name: string;
  tier: Tier;
  capacity?: number;
}

interface Player {
  id: string; // stable key used in the draw JSON
  name: string; // "Carlos Alcaraz"
  iso: string; // "es"  -> flagcdn (URS-20)
  shortCode: string; // "ALC" -> feeder labels & token badge (URS-9,21)
  seed?: number; // 1..32 where seeded (URS-22)
}

// A tennis set score, e.g. [[6,4],[3,6],[7,6]] with optional tiebreak detail.
type SetScore = { games: [number, number]; tb?: number }[];

interface Match {
  num: number; // node id in the skeleton
  p1?: string;
  p2?: string; // player ids for leaf matches (outer ring)
  score?: SetScore; // present => played (URS-24 tennis scores)
  winner?: string; // OPTIONAL override; normally derived from score
  courtId?: string; // -> Court (URS-19)
  date?: string; // "2026-07-01"
  time?: string; // "13:00 UTC+1" or "" (order-of-play, may be absent)
}

interface Draw {
  id: "gentlemens-singles" | "ladies-singles";
  label: string; // "Gentlemen's Singles"
  bestOf: 3 | 5; // format (URS-68)
  rootNum: number; // Final node id
  children: Record<number, [number, number]>; // skeleton (URS-3)
  matches: Match[]; // sparse: leaves carry players, all carry court/schedule
  placeholder: boolean; // true for 2026 illustrative data (URS-40)
  updatedAt?: string; // dataset timestamp for the status line (URS-30)
}
```

**Winner derivation (URS-3):** compute winner of a leaf from `score` (more sets won); inner-node
participants = winners of children, propagated inward exactly as the reference's `buildModel`.
Undecided side → dot (URS-7); feeder-code label when both feeders known (URS-9).

**Score → winner for tennis:** count sets won (a set is won by the side with more games in that
set, respecting the recorded games); the player who reaches `ceil(bestOf/2)` sets wins. This
replaces the reference's football `winnerIndex` (goal comparison).

---

## 6. Geometry (layout.ts) — reuse the reference's math, adapted

The reference's polar layout is directly reusable and should be ported, not reinvented:

- Rings by level: level 0 = outer tokens, increasing inward to the Final at centre. For the
  **default R32 scope (URS-10)** there are 5 match levels (R32→R16→QF→SF→F) + level-0 tokens,
  i.e. the same ring count as the reference. Radii per level configurable (`RADIUS` map).
- Outer tokens placed by DFS order of the skeleton (team1-subtree first) → left semicircle =
  first 16, right = last 16, matching the reference's `dfsFlags`/`flagAngle`.
- Match angle = mean of children angles (memoised), same as reference `angleOf`.
- Connectors = quadratic curve through the parent point (`connectorPath`), tokens = `pt(radius,
angle)` on `viewBox 0 0 1000 1000`.
- **Court capsules** = the reference's "stadium crescent": a thick round-capped arc along the
  child ring between a match's two participants, `pointer-events:stroke` as the tooltip hitbox
  (URS-14, URS-15). Port `capsulePath` + `CAP_W`.
- **Make ring count data-driven** so URS-11 (full-128 stretch) is reachable without a rewrite:
  derive levels from the skeleton depth rather than hard-coding 89–104 like the reference.

Keep `fitStage()` (absolute-px sizing so Ctrl+/- zoom scales the bracket as content, ignoring
pinch-zoom via `documentElement.client*`) — URS-36, URS-43.

---

## 7. Rendering & interactions (map each to the reference)

| Reference behaviour                                            | Port to                      | URS             |
| -------------------------------------------------------------- | ---------------------------- | --------------- |
| SVG lines/dots/trophy + HTML circular flags overlay            | `render.ts`                  | URS-1,4,20      |
| Champion at centre (gold ring, larger) / trophy when undecided | `render.ts`                  | URS-5           |
| Eliminated grey / winner gold ring                             | `render.ts`                  | URS-26          |
| Pop animation on newly-advanced winners (diff vs prev)         | `render.ts`                  | URS-27          |
| Custom tooltip, hover + tap, pinch-safe, viewport-clamped      | `tooltip.ts`                 | URS-23,24,43,44 |
| Feeder-code label for undecided side (`ALC/DJO`)               | `model.ts`/`render.ts`       | URS-9           |
| soon/deck/live status from viewer clock                        | `status.ts`                  | URS-25          |
| "Show venues" → "Show courts" toggle + legend + spotlight      | `courts.ts`                  | URS-12…URS-18   |
| ground/tint → court/tier tint                                  | `courts.ts`,`data/courts.ts` | URS-18          |
| status dot + "data updated" stamp                              | `main.ts`                    | URS-29,30       |

**Tennis-specific changes from the reference (do NOT copy football verbatim):**

1. **Scores** are tennis set scores, not `a–b` goals (URS-24). Tooltip renders e.g.
   `6–4, 3–6, 7–6(5), 6–2`.
2. **Two players can share a nation** — flag alone is ambiguous. Add name (tooltip) + short
   code / seed badge on/near the token (URS-21, URS-22). This is the single biggest deviation
   from the reference and must not be skipped.
3. **Status windows** tuned for tennis: matches are long and start times are often
   order-of-play ("not before" / follow-on), so:
   - `live` window: from scheduled start until **+4h** (best-of-5 can run long); if no `time`,
     a match may be `today` but not `live`/`deck`.
   - `deck` (on court next): within **~2h** before scheduled start.
   - `soon` (today): scheduled same calendar day (viewer local).
     Only both-players-known + no-result matches highlight (URS-25).
4. **No third-place match** — omit the reference's match-103 special case entirely.
5. **Two draws** (Gentlemen's / Ladies') via a toggle that re-runs buildModel+render (URS-2).
6. **Palette** is Wimbledon green/purple/gold on ivory, not WC host-nation colours (URS-33).
   Live halo = green or purple pulse (pick for AA contrast on ivory), not football red.

**Accessibility additions the reference lacks — required here (URS-48):** in addition to the
SVG, emit a **visually-hidden results list/table** per draw (round → match → players → score),
kept in sync with the model, so screen-reader users get the draw non-visually. Bracket stage
gets an `aria-label` (URS-46); toggles expose `aria-pressed` (URS-47); tokens/`img` get
`alt="{player name} ({country})"` (URS-49).

---

## 8. Design tokens (tokens.css) — starting values

```
--bg:      #f4f1e8;   /* ivory ground (Wimbledon-elegant, close to reference paper) */
--ink:     #17321f;   /* deep green-black text */
--green:   #006747;   /* Wimbledon green */
--purple:  #4B2E83;   /* Wimbledon purple */
--gold:    #b9975b;   /* champion / highlight accent */
--live:    #006747;   /* live pulse (green) — verify AA on --bg; else use --purple */
--muted:   #6b7c70;
--line:    #2a3a2f;   /* connector strokes */
```

Verify every text/UI pairing against `--bg` for **AA** (URS-45) before shipping; adjust shades
if any pairing fails (e.g. `--muted` on ivory). Title/headings: a refined serif (e.g. a
system/Google serif like "Playfair Display" or "Source Serif"); UI/labels: a clean sans
(system stack or "Inter"). Load web fonts efficiently (preconnect + `font-display:swap`) or use
a system serif stack to protect Lighthouse (URS-52).

---

## 9. Content / data to author (placeholder, clearly labelled — URS-40,66,69)

- **courts.ts** — real courts (URS-67): Centre Court (roofed, 14,979), No.1 Court (roofed,
  12,000), No.2 Court (open, 4,000), No.3 Court (open, 2,000), Court 12 (open), Court 18 (open).
- **players.ts** — a plausible set of real, currently-relevant players with correct nationality
  ISO + short code, seeded 1..32. Seeds/draw are **illustrative** — mark the draw `placeholder:
true`. Do NOT present any result as a claimed real 2026 outcome (URS-69).
- **Two draw JSONs** — internally-consistent R32 skeletons that resolve to a single champion,
  with some matches "played" (scores), some pending (dots), a few scheduled today/soon to
  exercise status cues, and court assignments spread across the six courts to exercise the
  spotlight.
- **Placeholder banner** — visible "Illustrative placeholder draw — not the official 2026 draw"
  (URS-40), plus `placeholder` reflected in tooltips if practical.
- **Stable facts** surfaced in header/footer: 139th Championships, 29 Jun–12 Jul 2026, All
  England Club, grass, best-of-5/3 (URS-34, URS-68).

---

## 10. SEO / meta / social (index.astro `<head>`) — URS-57…URS-59

- `<title>`: e.g. `Wimbledon 2026 Bracket (Unofficial Fan Site)`.
- `meta description`: unofficial fan interactive circular bracket for The Championships 2026.
- OG + Twitter card: title, description, `og:image` = `/og-image.png`.
- `favicon.svg`, `lang="en"`, charset, viewport.
- No structured data claiming official status (URS-60, URS-71).

---

## 11. Deployment (URS-63…URS-65)

- `astro.config.mjs`: `site: 'https://<user>.github.io'`, `base: '/wimbledon-2026/'` so asset
  paths resolve on the Pages subpath. All internal asset refs must respect `import.meta.env.BASE_URL`.
- `.github/workflows/deploy.yml`: on push to `main`, `npm ci && npm run build`, upload `dist/`,
  deploy via `actions/deploy-pages`. Document the toggle in project `CLAUDE.md`.
- `npm run build` MUST produce a fully static `dist/` (URS-64). No SSR adapter.

---

## 12. Coding conventions (developer MUST follow)

- **Language:** TypeScript everywhere (`strict: true`). No `any` in committed code without a
  `// reason` comment.
- **Formatting/lint:** Prettier + ESLint (Astro + TS configs). Run before "done". CI-clean.
- **Naming:** files `kebab-case`; components `PascalCase.astro`; TS symbols `camelCase`, types
  `PascalCase`. Data keys match the JSON exactly (as the reference keeps ISO keyed on feed
  strings).
- **Structure:** keep `bracket/` pure and framework-free; Astro components only render static
  chrome + mount the island. No business logic in `.astro` files.
- **No console noise:** no `console.log` in committed code; `console.warn` only on genuine
  degraded-data paths (mirrors the reference). Zero errors is a release gate (URS-56).
- **Comments:** explain the _why_ for non-obvious geometry/viewport math (the reference is an
  excellent model for comment density — port its rationale where you port its code).
- **Commits/PRs:** reference `URS-n` ids for what each change satisfies.

---

## 13. Build order (recommended sequence)

1. **Scaffold Astro + TS + tokens + Pages config** (`base` path, deploy workflow stub). Verify
   `npm run dev` and `npm run build` produce a static page. (URS-63,64)
2. **Types + data** — `types.ts`, `courts.ts`, `players.ts`, one placeholder draw JSON (R32).
   (URS-66,67)
3. **Model + layout** — skeleton, winner propagation, polar geometry, connector/capsule paths;
   render a static bracket with tokens/dots/trophy. (URS-1…URS-8)
4. **Tokens/flags + champion/eliminated styling + pop animation.** (URS-4,5,20,26,27)
5. **Custom tooltip** (hover/tap, tennis scores, local-time schedule, pinch-safe, clamped).
   (URS-23,24,43,44)
6. **Status cues** (live/deck/soon, tennis-tuned). (URS-25)
7. **Courts toggle + legend + spotlight + tier tint.** (URS-12…URS-18)
8. **Second draw + draw toggle**; wire re-render. (URS-2)
9. **Placeholder banner, header facts, footer credits + fan disclaimer.** (URS-34,40,70,73)
10. **Accessibility pass** — landmarks, hidden results list, keyboard, focus, reduced-motion,
    alt text, contrast audit. (URS-45…URS-51)
11. **SEO/meta/OG, favicon, og-image.** (URS-57…URS-59)
12. **Responsive pass** (mobile/tablet/desktop), touch check, no console errors. (URS-41,42,56)
13. **Lighthouse ≥90 ×4**, fix regressions. (URS-52)
14. **Hand to test-agent** against URS ids.

---

## 14. Known deviations from the reference (intentional, for test-agent context)

- Data is **local/bundled**, not a live GitHub feed (no 2026 feed exists) — URS-30. Adapter
  boundary preserved for later swap — URS-31.
- **Tennis scoring, two players per nation, two draws, no third-place match, Wimbledon
  palette** — all deliberate translations (URS-24, URS-21, URS-2, URS-33).
- **Added a11y results list** the reference lacks — URS-48.
- **Placeholder labelling** the reference doesn't need (its data is real/live) — URS-40.

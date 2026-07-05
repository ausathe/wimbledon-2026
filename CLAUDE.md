# Wimbledon 2026 — Circular Bracket (unofficial fan site)

A static, single-page interactive **circular radial bracket** for The Championships, Wimbledon
2026 (Gentlemen's & Ladies' Singles). Modelled on the World Cup 2026 reference bracket
(`https://shadymccoy.github.io/WC26/`), translated to tennis. **Unofficial fan project — not
affiliated with the AELTC / Wimbledon / ATP / WTA / ITF.**

## Specs (source of truth)
- `docs/URS.md` — numbered requirements (`URS-n`). The contract; test-agent verifies against it.
- `docs/BUILD-BLUEPRINT.md` — stack rationale, folder map, data model, build order, conventions.
Reference everything by `URS-n` id. If a requirement looks wrong, escalate to design-agent —
don't reinterpret it silently.

## Stack
- **Astro (static output) + TypeScript** — near-zero JS, static bundle for GitHub Pages.
- Bracket = a **framework-free vanilla-TS island** (SVG polar geometry + HTML token overlay).
- Styling: scoped CSS + CSS custom-property design tokens (`src/styles/tokens.css`). No Tailwind
  here (bespoke minimal visual — see blueprint §2.2). No React/shadcn.
- Data: local bundled JSON/TS (`src/data/`) — no live results API (no 2026 feed exists yet),
  behind a single adapter so a real feed can be swapped in later.

## Scripts
- `npm install` — install dependencies (first run).
- `npm run dev` — local dev server at `http://localhost:4321/wimbledon-2026/` (note the base
  path); click the golden path before calling anything done.
- `npm run build` — runs `astro check` then `astro build`; produces fully static `dist/` for
  Pages (HTML + one JS island ~31KB / ~10KB gzip + one CSS file + favicon + og-image).
- `npm run preview` — serves the built `dist/` at `http://localhost:4321/wimbledon-2026/` (or pass
  `--port`) so you can smoke-test the production bundle before deploying.
- `npm run lint` — ESLint (TS + Astro configs); must be clean before "done".
- `npm run format` — Prettier write (`.ts`, `.astro`, `.css`, `.json`); does not touch `docs/` or
  the root studio `CLAUDE.md`.

## Project structure (as built)
- `src/pages/index.astro` — page shell: `<head>` SEO/OG meta, header, bracket stage, courts
  control, visually-hidden results list, footer; mounts `src/bracket/main.ts` as a plain
  `<script>` (Astro auto-bundles/hashes it — no framework runtime).
- `src/bracket/` — framework-free vanilla TS: `types.ts` (data model), `model.ts` (skeleton +
  tennis winner derivation from set scores), `layout.ts` (polar geometry, data-driven ring count),
  `render.ts` (SVG + HTML token overlay + a11y results list), `tooltip.ts` (custom tooltip,
  pinch-safe), `courts.ts` (show-courts toggle/legend/spotlight), `status.ts` (live/deck/soon
  windows), `time.ts` (local-time formatting), `labels.ts` (round names + feeder-code labels),
  `main.ts` (entry point wiring it all together).
- `src/data/` — `players.ts` (32 seeded players per draw, placeholder), `courts.ts` (real
  Wimbledon show courts), `gentlemens-singles.json` / `ladies-singles.json` (placeholder R32
  draws — skeleton, scores, schedule, court assignments).
- `src/components/` — `Header.astro`, `CourtsControl.astro`, `Footer.astro` (static chrome only,
  no business logic per blueprint §12).
- `src/styles/` — `tokens.css` (design tokens, AA-checked), `global.css` (page chrome),
  `bracket.css` (stage/tokens/tooltip/capsule/spotlight/status/reduced-motion rules).

## Deploy
- GitHub Pages via `.github/workflows/deploy.yml`: on push to `main`, runs `npm ci && npm run
  build` in `projects/wimbledon-2026/`, uploads `dist/` as the Pages artifact, deploys with
  `actions/deploy-pages`. Enable once: repo Settings → Pages → Source = "GitHub Actions".
- `astro.config.mjs` sets `site: 'https://<user>.github.io'` (placeholder `example.github.io` —
  **update this to the real GitHub username/org before deploying**) and
  `base: '/wimbledon-2026/'`; every asset reference respects `import.meta.env.BASE_URL` /
  Astro's own base handling (verified in the built `dist/index.html`).

## Swapping in real 2026 data (URS-31)
Once the real 2026 draw/seeds/order-of-play publish, only these files need to change — no
geometry/render/interaction code touches this:
1. `src/data/players.ts` — replace/extend the `GENTLEMENS_PLAYERS` / `LADIES_PLAYERS` arrays
   (keep each player's `id` stable if a draw JSON already references it, or update both together).
   Each entry needs `id`, `name`, `iso` (flagcdn country code), `shortCode`, optional `seed`.
2. `src/data/gentlemens-singles.json` / `ladies-singles.json` — replace `matches[]` entries with
   the real leaf pairings (`p1`/`p2` = player ids), real `score`/`date`/`time`/`courtId` for played
   rounds, and set `"placeholder": false` once the data is genuinely official (also consider
   updating/removing the placeholder banner copy in `Header.astro` at that point). The `children`
   skeleton (match-number tree) only needs to change if you alter the draw scope (e.g. to full 128
   — see URS-11/BUILD-BLUEPRINT §6 for how ring count is derived from skeleton depth, not
   hard-coded).
3. `src/data/courts.ts` — already the real 6 AELTC show courts; only touch if court list changes.
No code in `src/bracket/` should need edits for a routine data refresh.

## Conventions
- TS `strict`; kebab-case files, PascalCase components/types, camelCase symbols.
- Keep `src/bracket/` pure/data-agnostic — swapping `src/data/` is the only change to load real
  2026 data.
- Zero console errors is a release gate. Serif for titles, sans for UI; Wimbledon green/purple/
  gold on ivory (verify WCAG AA).

## Definition of done
Every URS MUST passes (SHOULDs pass or signed off), both draws render, golden path works on
desktop + touch, responsive at mobile/tablet/desktop, a11y + reduced-motion pass, Lighthouse
≥90 ×4, no console errors, placeholder data clearly labelled, fan disclaimer present. Test-agent
issues GREEN — not the developer.

## Data status
2026 draw/seeds/results/order-of-play are **illustrative placeholders**, clearly labelled in UI
(URS-40). Stable facts are real: All England Club, grass, 139th Championships, 29 Jun–12 Jul
2026, 128 singles draw, best-of-5 (Gentlemen's) / best-of-3 (Ladies').

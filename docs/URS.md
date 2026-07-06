# URS — Wimbledon 2026 Circular Bracket (fan site)

**Project:** wimbledon-2026
**Document:** User Requirements Specification
**Status:** Draft for build (v1)
**Author:** design-agent
**Date:** 2026-07-05

## 0. Preamble

### 0.1 What this is
A single-page, static, client-side web app that renders the **Gentlemen's and Ladies'
Singles knockout draws of The Championships, Wimbledon 2026** as an interactive **circular
radial bracket**, modelled closely on the reference fan site
`https://shadymccoy.github.io/WC26/` (a World Cup 2026 circular bracket). This is the tennis
equivalent: the same "shape" (radial SVG bracket, flag/photo overlays, venue spotlight,
custom score tooltips, live/soon status cues, diff-animated re-render) translated from
football groups/stadiums/national-teams to tennis **draw / courts / seeded players**.

### 0.2 Concept translation (reference → this build)
| World Cup reference | Wimbledon 2026 equivalent |
|---|---|
| 32-team knockout, Round of 32 → Final | 128-player singles draw. **Reference renders the last 32 (Round of 4 / "R32" = the round of 32 players).** See §1.4 for the draw-scope decision. |
| National team flags (flagcdn) | Player **country flags** (flagcdn) as the primary token; optional player avatar/initials |
| Group stage → knockout | Seeding + draw sections (top/bottom halves, quarters) |
| Stadiums (16 host venues, 3 nations) | **Show courts** (Centre Court, No.1, No.2, No.3, Court 12, Court 18) |
| Host-nation tint (MX/US/CA) | Court-tier tint (roofed show court / open show court) |
| Third-place play-off (outside the tree) | Not applicable — omit (no third-place match at Wimbledon) |
| Two host nations' colours | Wimbledon **green + purple** brand palette |
| "Trophy" glyph at centre | Wimbledon trophy glyph (Gentlemen's cup / Ladies' Venus Rosewater dish) |

### 0.3 Legal / branding constraint (binding)
This is an **unofficial, fan-made** project. It MUST NOT imply official affiliation with,
endorsement by, or licensing from The All England Lawn Tennis Club (AELTC), Wimbledon, the
ATP, the WTA, or the ITF. See URS-70…URS-73.

### 0.4 Data-availability note
As of the spec date, the 2026 singles **draw, seeds, order of play, and results are not
final/published in a stable machine-readable feed**. Unlike the reference (which consumes a
live openfootball JSON feed), this build ships with a **local, versioned placeholder dataset**
that the site reads at load. All unknown 2026 data MUST be clearly marked as placeholder in
the UI (URS-40) and be swappable without code changes (URS-31). Stable facts (venue, courts,
dates, format, edition = 139th) are used as real data.

### 0.5 How to read this document
Requirements are atomic and testable. Each has an id `URS-n`. "MUST" = mandatory, "SHOULD" =
strongly preferred (failure requires design sign-off), "MAY" = optional. The test-agent
verifies every MUST and SHOULD by id.

---

## 1. Functional requirements — bracket & draw

- **URS-1** The app MUST render a **circular radial bracket** as inline SVG: rounds arranged
  as concentric rings, outermost ring = earliest rendered round, centre = the Final /
  champion. Rendering MUST be programmatic from a data model, not hand-placed markup.

- **URS-2** The app MUST support **two independent draws — Gentlemen's Singles and Ladies'
  Singles** — selectable via a control (tab/toggle). Switching draws MUST re-render the
  bracket for the selected draw without a full page reload.

- **URS-3** Each draw MUST render the knockout tree such that every match node has exactly two
  child slots, and a winner propagates inward to become a participant of its parent match.
  Winner propagation MUST be computed from the data (results overlaid on a fixed skeleton),
  not stored redundantly.

- **URS-4** The **outermost ring** MUST show the participants of that round as circular tokens
  (country flag by default; see URS-20). A match's winner MUST also appear as a token on the
  next ring inward, continuing to the centre.

- **URS-5** The **centre** MUST show either the Final's trophy glyph (when the champion is
  undecided) or the **champion token** (when decided), visually distinguished (gold ring +
  larger size), mirroring the reference's champion treatment.

- **URS-6** Connector lines/curves MUST join each pair of child slots to their parent node,
  following the radial geometry (curved connectors passing through the parent point), matching
  the reference's connector style.

- **URS-7** For any match whose participant is not yet decided, the app MUST render an
  undecided marker (a dot on the ring) instead of a token, exactly as the reference renders
  pending nodes.

- **URS-8** Round labelling MUST use correct tennis round names for the rendered rings:
  `Round of 32`, `Round of 16`, `Quarter-final`, `Semi-final`, `Final` (and `Champion` at
  centre). If the extended-scope draw (URS-1.4) is chosen, add `Round of 128`, `Round of 64`.

- **URS-9** When a match participant is undecided but both feeder participants are known, an
  undecided side SHOULD be labelled by its feeder matchup using player short codes
  (e.g. `ALC/DJO`), mirroring the reference's `PAR/FRA` behaviour. Otherwise it reads `TBD`.

### 1.4 Draw-scope decision (defaulted, flagged for client)
The reference renders a **32-slot** radial bracket. A full 128-draw radial bracket has 128
outer tokens, which is legible on desktop but cramped on mobile.
- **URS-10 (DEFAULT)** The build MUST render the **Round of 32 onward** as the default,
  primary radial bracket (32 outer tokens → Final), directly matching the reference's density
  and legibility. This is the shipped default unless the client chooses otherwise (see
  Clarifying Question CQ-1).
- **URS-11 (SHOULD, stretch)** The app SHOULD structure the data model and layout so the ring
  count is data-driven, allowing a later "full draw (128)" mode without rearchitecting. If
  full-draw mode is enabled, mobile MUST remain usable (pan/zoom acceptable).

---

## 2. Functional requirements — courts / venue spotlight (translation of the WC "venues" feature)

- **URS-12** The app MUST provide a **"Show courts" toggle** button (equivalent to the
  reference's "Show venues"). Default state OFF. Toggling ON reveals a court legend and the
  per-match court capsules; toggling OFF hides them and clears any selection.

- **URS-13** When courts are shown, the app MUST render a **court legend**: one pill per show
  court that hosts at least one match in the current draw, each pill showing the court name and
  a count of matches at that court.

- **URS-14** Each match node MUST carry a **court capsule** (an arc/lozenge behind its two
  participant slots) that is hidden until "Show courts" is ON, matching the reference's
  crescent behaviour.

- **URS-15** Hovering (desktop) or tapping (touch) a court pill MUST **spotlight** that court's
  matches: their capsules + tokens brighten while all other bracket elements fade. This
  mirrors the reference's `.vfilter` spotlight exactly.

- **URS-16** Court selection MUST support: plain click = replace selection with one court;
  Ctrl/Cmd/Shift-click = toggle a court in/out of a **multi-selection**; clicking the only
  pinned court = unpin. On desktop, hovering a pill previews its spotlight. (Same interaction
  model as the reference.)

- **URS-17** With courts ON and nothing selected, **all** capsules MUST be visible at a base
  opacity ("no court selected" reads the same as "all selected"), matching the reference.

- **URS-18** Court pills SHOULD carry a subtle tint by **court tier** (e.g. roofed show courts
  — Centre Court, No.1 Court — one tint; open show courts another), the tennis analogue of the
  reference's host-nation tint. Tiers are defined in §Content/Data.

- **URS-19** The court assigned to a match is the tennis analogue of the WC "ground". Where the
  2026 court assignment is unknown, it MUST come from the placeholder dataset and be treated as
  placeholder data (URS-40).

---

## 3. Functional requirements — tokens, tooltips, status

- **URS-20** Player tokens MUST render the player's **country flag** (via a flag CDN, keyed by
  ISO 3166-1 alpha-2) as the default visual, circular-clipped, matching the reference's flag
  treatment. On flag load error the app MUST fall back to a neutral circle so the bracket never
  gaps (as the reference does).

- **URS-21 (SHOULD)** Because two players can share a nation (unlike national teams), a token
  SHOULD additionally disambiguate the player — e.g. the player's short code/initials or seed
  number rendered on/adjacent to the token, or the player name surfaced in the tooltip
  (URS-24). Flag-only tokens with no name anywhere is a FAIL.

- **URS-22** Seeded players MUST have their **seed number** available in the UI (tooltip at
  minimum; on-token badge SHOULD). The champion token MUST be visually distinct per URS-5.

- **URS-23** The app MUST provide a **custom tooltip** (not the native title) that appears on
  hover (desktop) and tap (touch), toggling on tap and dismissing on outside tap/scroll, exactly
  as the reference does.

- **URS-24** The tooltip for a match MUST show: round name, the two participants (player names,
  with seeds where seeded), the **score** if the match is complete, or the **scheduled
  date/time in the viewer's local time zone** if not yet played, and the **court**. Score
  format MUST use tennis set scores (e.g. `6–4, 3–6, 7–6(5), 6–2`), NOT football goal scores.

- **URS-25** The app MUST compute per-match **status** cues from the viewer's clock, mirroring
  the reference's soon/deck/live system, adapted to tennis:
  - `live` — match is currently in progress (scheduled start passed, no final result yet):
    pulsing green/purple halo + a "Live" tooltip state.
  - `on court next` (deck) — imminent (within a short window before scheduled start).
  - `today` (soon) — scheduled today (wider window).
  Only matches with both participants known and no result yet may be highlighted. Tennis
  matches are long and often lack exact start times (follow-on order of play); the live/soon
  windows MUST be tuned for tennis, not football (see BUILD-BLUEPRINT for defaults).

- **URS-26** A completed match token that LOST MUST be visually de-emphasised (greyscale/dim),
  and the WINNER token highlighted, matching the reference's eliminated/win treatment.

- **URS-27** When results change between renders (data refresh), newly-advanced winners MUST
  animate in with a "pop" transition, matching the reference's diff animation. If the site is
  static single-load with no refresh (see URS-30), this applies to the initial reveal.

---

## 4. Functional requirements — data, loading, refresh

- **URS-28** All draw/seed/result/court/schedule data MUST live in a **structured data
  file(s)** (JSON or typed module) separate from rendering logic. Editing data MUST NOT require
  touching layout/render code.

- **URS-29** On load, the app MUST show a **loading state**, then render, then show a **status
  line** indicating success or a friendly error ("couldn't load — reload to retry"), mirroring
  the reference's status dot + message.

- **URS-30 (DEFAULT)** Because no live 2026 feed is available, the app ships reading a **local
  bundled dataset** (no external results API). It MUST still be architected behind a single
  data-adapter function so a live feed can be swapped in later without touching render code
  (matching the reference's `fetchResults()` → `normalize()` → `buildModel()` pipeline). A
  "last updated" stamp SHOULD reflect the dataset's own timestamp.

- **URS-31** Swapping in real 2026 data (draw, seeds, results, order of play, court
  assignments) MUST be possible by editing only the dataset file(s) and the player→ISO/seed
  lookups — no changes to geometry or interaction code.

- **URS-32** The app MUST degrade gracefully on partial data: unknown player→flag mapping →
  neutral token; unknown court → still render, no spotlight tint; missing score → pending
  state. No data gap may throw or blank the bracket (same resilience contract as the reference).

---

## 5. UI / UX requirements

- **URS-33** Visual direction MUST evoke **Wimbledon**: primary palette Wimbledon **green**
  (dark ivy `#006747`-family) and **purple** (`#4B2E83`-family) on a soft **cream/ivory**
  ground (the reference uses warm paper `#f2ede1`; keep a light, elegant, editorial feel).
  Accent for champion/highlight = a **gold** analogous to the reference's `--gold`. Typography
  SHOULD be a refined serif for the title/headings (Wimbledon's editorial character) with a
  clean sans for UI/labels. Exact tokens in BUILD-BLUEPRINT.

- **URS-34** The header MUST show the site title ("Wimbledon 2026" or "The Championships 2026 —
  unofficial") and MUST include the **139th Championships** framing and the **dates
  (29 June – 12 July 2026)** somewhere visible (header or sub-header).

- **URS-35** Layout MUST be a centred, single-column, single-page composition: header →
  draw toggle → circular bracket stage → courts control/legend → footer, matching the
  reference's vertical rhythm.

- **URS-36** The bracket stage MUST be a **square, responsive** area sized to fit the viewport
  (min of width/height-based caps), scaling with browser zoom like content (not glued to the
  viewport), matching the reference's `fitStage()` behaviour.

- **URS-37** All interactive controls (draw toggle, courts toggle, court pills, tokens) MUST
  have clear hover/focus/active states and be operable, mirroring reference affordances.

- **URS-38** Motion MUST be purposeful (token pop, spotlight fades, tooltip transitions) and
  MUST respect `prefers-reduced-motion` (disable/greatly reduce non-essential animation).

- **URS-39** The footer MUST credit data/flag sources and MUST carry the unofficial/fan
  disclaimer (URS-70).

- **URS-40** Any data that is a **2026 placeholder** (draw, seeds, results, order of play, court
  assignments where not yet real) MUST be clearly marked as placeholder in the UI — e.g. a
  visible "Illustrative placeholder draw — not the official 2026 draw" banner/badge, and/or a
  per-tooltip note. A reasonable viewer MUST NOT mistake placeholder results for real 2026
  results.

---

## 6. Responsive & device support

- **URS-41** The app MUST be usable and correctly laid out on **mobile (≤480px), tablet
  (768px), and desktop (≥1024px)**. The bracket MUST remain legible or offer pan/zoom on the
  smallest target.
- **URS-42** Touch interactions (tap token → tooltip, tap court pill → spotlight, tap outside →
  dismiss) MUST work on touch devices, and MUST NOT depend on hover.
- **URS-43** Pinch-zoom MUST not break tooltip positioning or strand tooltips off-screen
  (the reference solves this with document-coordinate + visualViewport handling; equivalent
  robustness required).
- **URS-44** The tooltip MUST stay within the visible viewport (clamped horizontally, flips
  below the token when near the top edge), as the reference does.

---

## 7. Accessibility (target: WCAG 2.1 AA)

- **URS-45** All text and meaningful UI MUST meet **WCAG AA contrast** (≥4.5:1 normal text,
  ≥3:1 large text/UI) against its background — verify the green/purple/gold-on-cream palette.
- **URS-46** The app MUST use **semantic HTML** landmarks (`header`, `main`, `footer`) and the
  bracket stage MUST have an accessible label describing it.
- **URS-47** Controls (draw toggle, courts toggle, court pills) MUST be **keyboard operable**
  (Tab focus, Enter/Space activate) with visible focus indicators, and expose correct ARIA
  state (`aria-pressed` for toggles, selected state for pills).
- **URS-48 (SHOULD)** The bracket data SHOULD be available to assistive tech in a non-visual
  form — e.g. a visually-hidden but readable results table/list, or ARIA on nodes — so the draw
  is not purely a visual SVG. A screen-reader user SHOULD be able to learn who plays/beat whom.
- **URS-49** Flag/photo tokens MUST have meaningful `alt`/label text (player name +
  nationality), not empty or "flag".
- **URS-50** Non-essential motion MUST honour `prefers-reduced-motion` (see URS-38).
- **URS-51** Colour MUST NOT be the **only** means of conveying status (live/eliminated/winner)
  — pair it with a shape, ring, label, or tooltip text.

---

## 8. Performance

- **URS-52** The production build MUST target **Lighthouse ≥90** on Performance, Accessibility,
  Best Practices, and SEO (studio quality bar).
- **URS-53** The app MUST ship **near-zero unnecessary client JS** beyond what the interactive
  bracket needs; no heavy framework runtime shipped for a static page unless justified
  (see BUILD-BLUEPRINT stack rationale).
- **URS-54** Flag images MUST be lazy-loaded and appropriately sized (as the reference does via
  flagcdn width buckets); no full-resolution image where a small circle is shown.
- **URS-55** First load MUST render the bracket without waiting on any third-party API for
  core content (data is bundled/local per URS-30); flag CDN images may load progressively with
  graceful fallback.
- **URS-56** No console errors or unhandled promise rejections during load or normal
  interaction (studio "definition of done").

---

## 9. SEO & metadata

- **URS-57** The page MUST have a descriptive `<title>` and `meta description` making clear it
  is an **unofficial fan** Wimbledon 2026 bracket.
- **URS-58** The page MUST include Open Graph / Twitter card tags (title, description, image)
  for shareable link previews.
- **URS-59** The page MUST include a favicon and appropriate `lang`, viewport, and charset meta.
- **URS-60 (SHOULD)** Metadata and any structured data MUST NOT claim official status or use
  protected marks in a way implying affiliation (ties to URS-70).

---

## 10. Browser support

- **URS-61** MUST work on current stable **Chrome, Firefox, Safari (desktop + iOS), and Edge**
  (latest two major versions). Uses modern baseline JS/CSS (SVG, flexbox, CSS custom
  properties, `visualViewport`); no IE support required.
- **URS-62** MUST NOT rely on any single-browser-only API without a graceful fallback
  (`visualViewport` usage MUST degrade as the reference's does).

---

## 11. Hosting / deployment

- **URS-63** The site MUST be deployable as a **static site to GitHub Pages** (matching the
  reference's hosting model) — no server runtime, no serverless functions required for core
  function.
- **URS-64** If a build step is used, the produced output MUST be a fully static bundle
  (HTML/CSS/JS/assets) served from a CDN/Pages with correct base-path handling for a project
  subpath (e.g. `/wimbledon-2026/`).
- **URS-65** A single command MUST build the production bundle, and the repo MUST be
  configurable to auto-deploy to Pages (GitHub Actions acceptable), documented in the project
  CLAUDE.md.

---

## 12. Content requirements (data the site must contain)

- **URS-66** The dataset MUST include, for each rendered draw (Gentlemen's & Ladies' Singles):
  the bracket skeleton (match → children), participants for the outermost rendered round
  (player name, nationality ISO, seed if seeded), and per-match: court assignment, scheduled
  date/time (where known), and result/score (where "played" in the placeholder narrative).
- **URS-67** The **court list** MUST use real Wimbledon show courts with correct names and tier
  (roofed vs open), from this stable set: **Centre Court** (~15,000, roofed), **No.1 Court**
  (~12,000, roofed), **No.2 Court** (~4,000, open), **No.3 Court** (~2,000, open), **Court 12**
  (open), **Court 18** (open). Capacities MAY be shown in the legend/tooltip.
- **URS-68** Stable factual content MUST be accurate: venue = **All England Lawn Tennis and
  Croquet Club, Wimbledon, London**; surface = **grass**; edition = **139th**; main-draw dates
  = **29 June – 12 July 2026**; singles draw = **128**; format = **best-of-5 sets
  (Gentlemen's) / best-of-3 sets (Ladies')**; final-set tie-break at 6–6.
- **URS-69** Placeholder 2026 competitive data (specific seeds, draw, results, order of play)
  MUST be plausible and internally consistent (a real 128/32 bracket that resolves to one
  champion), and MUST be labelled placeholder per URS-40. It MUST NOT fabricate a claimed real
  outcome presented as fact.

---

## 13. Legal / branding (binding)

- **URS-70** The site MUST display a clear **unofficial / fan-made disclaimer** in the footer,
  e.g. "Unofficial fan project. Not affiliated with, endorsed by, or sponsored by the AELTC,
  The Championships, Wimbledon, the ATP, WTA or ITF." Visible without interaction.
- **URS-71** The site MUST NOT use official Wimbledon logos, the "Wimbledon" wordmark styled as
  the official brand, official crest/roundel, or trademarked imagery in a way that implies
  authorisation. Generic descriptive use of the words ("Wimbledon", "The Championships") for
  identification is acceptable; imitation of official brand assets is not.
- **URS-72** Player likenesses: if player **photos** are used (beyond flags), they MUST be
  either omitted for v1 or clearly attributed/licensed; the DEFAULT for v1 is **flags +
  names/initials only, no player photographs** (avoids rights issues). See CQ-3.
- **URS-73** Third-party data/flag/image sources MUST be **credited** in the footer (e.g.
  flagcdn), matching the reference's attribution.

---

## 14. Definition of done (exit criteria — test-agent GREEN)

- **URS-74** Every MUST requirement above PASSES; every SHOULD PASSES or has written design
  sign-off.
- **URS-75** The dev server / built static site runs with **no console errors**, renders both
  draws, and the golden path works: switch draw → hover/tap tokens → toggle courts → spotlight
  a court → dismiss — on desktop and on a touch/mobile viewport.
- **URS-76** Responsive verified at mobile/tablet/desktop; accessibility checks (contrast,
  keyboard, reduced-motion, semantic landmarks) pass; Lighthouse ≥90 across the four categories.
- **URS-77** Placeholder data is unmistakably labelled; the fan/unofficial disclaimer is
  present; no protected-mark misuse.

---

## Appendix A — Open clarifying questions (for the client, via orchestrator)

- **CQ-1 (draw scope):** Ship the **Round-of-32 radial bracket** (matches the reference's
  density, cleanest on mobile) as default — or attempt the **full 128 draw** radial view
  (impressive on desktop, needs pan/zoom on mobile)? *Default assumed: R32.*
- **CQ-2 (draws shown):** Both **Gentlemen's & Ladies' Singles** (assumed). Also want
  **Doubles** draws? *Default: singles only for v1.*
- **CQ-3 (tokens):** Flags + names/initials only (assumed, avoids photo rights) — or player
  **photos/avatars** (needs sourcing/licensing)? *Default: flags + names, no photos.*
- **CQ-4 (data realism):** Ship an **illustrative placeholder** draw/results clearly marked as
  such (assumed) — or wait to populate with the **real** 2026 draw/seeds once published?
  *Default: labelled placeholder now, swappable later.*
- **CQ-5 (title/wordmark):** Preferred site title given the unofficial constraint — e.g.
  "Wimbledon 2026 — Unofficial Bracket" vs "The Championships 2026 (fan)"? *Default: a title
  that reads clearly as unofficial.*

---

# Feature addendum A — Live scores (URS-78…URS-104)

**Status:** Draft for build (v1) — appended 2026-07-05 by design-agent.
**Scope:** a *major feature* layered onto the existing, shipped bracket. URS-1…URS-77 remain in
force and unchanged. This addendum adds live-score fetching, a live scoreboard UI, live-driven
status, and the degradation contract. Everything below is verified against a REAL data source
(see §A.0); the developer MUST NOT assume feed capabilities beyond what is listed.

## A.0 Data source (verified, binding — design to this truth, not to assumptions)

- **Source:** the free, keyless, CORS-enabled ESPN public tennis scoreboard API. No backend, no
  serverless proxy, no API key, no paid tier — the site stays a pure static GitHub Pages build
  (this constraint is FIXED; do not reopen it).
  - Men: `https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard`
  - Women: `https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard`
- **Response shape (the only fields the build may rely on):** `events[0]` = current tournament
  (`events[0].name`, e.g. "Wimbledon"); `events[0].groupings[]` = draws; select the grouping whose
  name is the singles draw ("Men's Singles" / "Women's Singles"), ignore doubles. Each grouping
  has `competitions[]` (matches). Each competition exposes: `status.type.state`
  (`in` | `post` | `pre`), `status.type.detail` / `status.type.shortDetail` (e.g. "5th Set"),
  optional `situation`, and `competitors[]` (exactly 2), each with `athlete.displayName`,
  `winner` (bool | null), a server/possession flag (`possession` / `active`), and **`linescores[]`**
  = per-set scores `{ value, tiebreak?, winner? }`.
- **What the feed HONESTLY provides:** set-by-set game scores incl. tiebreak point counts, a
  current-set indicator, server, match state, round/detail text, and (best-effort) court —
  updating live.
- **What the feed does NOT reliably provide:** the live *game* point score (0/15/30/40/deuce/adv).
  The point-by-point summary endpoint is not openly accessible. **This feature MUST NOT claim or
  imply a live point ticker.** If point data happens to appear in a payload, it MAY be shown as
  clearly best-effort, never as a required/guaranteed field.

## A.1 Functional — fetch, poll, parse

- **URS-78** On initial load (after the existing local-data render per URS-29/URS-30), the app
  MUST attempt a client-side `fetch` of **both** scoreboard endpoints (ATP + WTA) directly from
  the browser. No proxy, no key. The bracket MUST already be usable from local data before the
  first live response arrives (live data augments; it MUST NOT block first paint — extends URS-55).

- **URS-79** The app MUST re-poll both endpoints on a fixed interval of **15 seconds** (the
  `POLL_MS` constant). This is the justified cadence: it keeps set/game scores current within a
  quarter-minute while staying well clear of hammering an unofficial free endpoint (a game rarely
  completes faster; per-point granularity is unavailable anyway per §A.0). The value MUST be a
  single named constant so it can be tuned. Polling **≤5s or a per-second network poll is a FAIL**
  (abuse of a free feed; also unnecessary given no point-level data).

- **URS-80** The two endpoints MUST be fetched **concurrently** each poll, each with a **request
  timeout** (`FETCH_TIMEOUT_MS`, default 8s, via `AbortController`). A slow/hung request MUST NOT
  stall the other draw or the tick loop.

- **URS-81** The app MUST select the current Wimbledon event defensively: use `events[0]`, and
  **only** treat its data as Wimbledon-live when `events[0].name` (or equivalent tournament field)
  contains "Wimbledon" (case-insensitive). If the current event is a different tournament or
  off-season (no relevant event), the app MUST treat live data as **absent** and fall back to
  local data (URS-95) — it MUST NOT render another tournament's scores onto the Wimbledon bracket.

- **URS-82** The parser MUST select, per endpoint, the **singles** grouping only (men's/women's
  singles by grouping name), and MUST ignore doubles groupings. Missing/renamed groupings MUST
  degrade to "no live data for this draw", never throw (extends URS-32).

- **URS-83** Parsing MUST be total and defensive: any missing/`null`/unexpected field
  (`competitors` not length 2, absent `linescores`, non-numeric `value`, absent `status`) MUST be
  skipped for that match without throwing and without discarding other valid matches. A malformed
  payload MUST NOT blank or break the bracket (extends URS-32/URS-56).

## A.2 Data model — ESPN → internal live model (adapter)

- **URS-84** A dedicated adapter MUST transform each competition into an internal `LiveMatch`
  record carrying: both players (as parsed display names + normalized keys), per-set game scores
  with optional tiebreak point counts, which set is current, who is serving (if given), match
  state (`in` | `post` | `pre`), round/detail text, court (if given), and a `winner` side (if
  given). The adapter MUST reuse the existing `SetGames` / `SetScore` shape (`{ games:[a,b],
  tb?:[a,b]|number }`) for the set grid so the bracket's existing `formatScore` and scoring logic
  stay the single source of truth for score formatting (URS-24). The ESPN `linescores[i].value`
  pairs across the two competitors form each set's `games` tuple; `tiebreak` populates `tb`;
  `winner` on a competitor's final set / `status` populates the winner side.

- **URS-85** The adapter MUST live in its own module tree (`src/live/**`) and MUST NOT modify
  `src/bracket/**` render/layout/model internals except at the one documented merge point
  (URS-88). The existing local-data path (URS-30) MUST remain fully functional with the live
  modules removed/disabled.

## A.3 Reconciliation — feed ↔ existing bracket

- **URS-86** The app MUST match feed players to our modelled players by **normalized name**:
  lower-case, strip diacritics/accents, collapse whitespace and punctuation, compare against each
  `players.ts` entry's `name` (and a small alias map for known display-name mismatches). A live
  match maps to a bracket node when **both** of its players resolve to the two participants of
  exactly one node in the current draw's resolved model.

- **URS-87** A live match whose players do **not** both resolve to a modelled node (e.g. a player
  outside our R32 subset, or a name we can't match) MUST NOT corrupt the bracket. It MAY still be
  shown in the standalone live scoreboard (URS-90) labelled as such, but MUST NOT be forced onto a
  bracket node. Unmatched-name events MUST be counted/logged (dev `console.warn` only) so the
  alias map can be extended — never thrown (extends URS-56).

- **URS-88** When a live match maps to a bracket node, the app MUST **overlay** (not overwrite)
  live data onto that node for rendering: the merge is a render-time layer keyed by node number,
  never a mutation of the bundled JSON. Precedence: for a node that is `in` (live) or `post` with
  fresher data than the local snapshot, the live set-grid, live status, and live winner drive the
  token/tooltip; if live data is absent for a node, the existing local snapshot value is used
  unchanged. Removing the live layer MUST return the exact pre-feature rendering.

- **URS-89** Live-driven bracket status: a node that the feed reports `state==="in"` MUST show the
  existing **live** cue (URS-25 pulsing halo + "Live" tooltip state), regardless of the
  clock-window heuristic. A node the feed reports `state==="post"` with a winner MUST reflect that
  result (winner highlighted, loser de-emphasised per URS-26) even if the local snapshot had it
  pending. The clock-based `status.ts` heuristic (URS-25) remains the fallback for nodes with no
  live-feed coverage.

## A.4 UI — the live scoreboard ("standard tennis scoresheet")

- **URS-90** The app MUST render a **live scoreboard** presenting a standard tennis scoresheet for
  each ongoing (`in`) match in the two singles draws, and for **recently completed** (`post`)
  matches from the current day's feed. Each scorecard MUST show, at minimum:
  - both players' **names** (seed where we know it from `players.ts`; nationality flag where the
    player resolves to a modelled player — reuse the flag token treatment for consistency);
  - a **set-by-set game grid**: one column per set, the two players as rows, each cell the games
    won; a completed-set tiebreak rendered as a **superscript** point count (e.g. `7⁴` for 7–6(4))
    — the standard scoresheet convention;
  - the **current set highlighted** (visually distinct column) for `in` matches;
  - a **server indicator** (e.g. a dot/marker on the serving player's row) when the feed provides
    possession; absent gracefully when it doesn't;
  - **match status / round / court**: round or `status.detail` text (e.g. "5th Set", "Final"),
    court name when available, and a clear **LIVE** badge for `in` matches / final result for
    `post`.

- **URS-91** The scoreboard MUST NOT claim a live 0/15/30/40 game-point ticker (it is not
  available — §A.0). Copy MUST describe what is shown honestly ("live set & game scores"), not
  "point-by-point". Any incidental point data (URS-83) shown MUST be visibly best-effort.

- **URS-92 (placement — defaulted, see CQ-A1)** The live scoreboard MUST be placed as a **panel/
  rail** in the single-page layout, positioned **directly below the header / above or beside the
  bracket stage** on desktop (a side rail on wide viewports, a stacked panel that collapses to a
  horizontally-scrollable strip / accordion on mobile). It MUST NOT overlap or crowd the bracket
  stage, and MUST preserve the existing centred vertical rhythm (URS-35). Default: a collapsible
  "Live now" panel above the bracket; the bracket remains the primary element.

- **URS-93** In addition to the scoreboard panel, the existing **custom tooltip** (URS-23/URS-24)
  MUST be enriched for a bracket node that has live coverage: show the live set grid + "Live"
  state + server (if any) instead of only the local score/schedule. This reuses the tooltip's
  existing `TipData` path; no second tooltip system.

- **URS-94** The scoreboard MUST be **on-brand** and consistent with the existing design system:
  Wimbledon green/purple/gold on ivory, existing tokens (`tokens.css`), serif for headings / sans
  for scores and labels, existing card/pill radii and spacing. It MUST NOT introduce a new visual
  language.

## A.5 Update cadence — "every second"

- **URS-95** The **display** MUST tick every **1 second** (`TICK_MS`) independently of the 15s
  network poll: a live "**updated Xs ago**" relative stamp MUST increment each second, and the
  LIVE pulse/animation MUST read as continuously alive. The network re-poll (URS-79) and the 1s
  display tick MUST be two separate timers; the second-tick MUST NOT trigger a network request.

- **URS-96** There MUST be a clear, persistent **LIVE indicator** while ≥1 match is `in`: a
  pulsing dot/badge (green or purple, AA-contrast on ivory) plus the text "LIVE" and the
  "updated Xs ago" stamp. When a poll succeeds the stamp resets to "updated just now / 0s".

- **URS-97** On each successful poll the scoreboard and any overlaid bracket nodes MUST re-render
  with a smooth diff (reuse the existing "pop"/transition vocabulary, URS-27) — a set/game score
  change MUST NOT cause a full-page or full-bracket layout thrash or a visible flash. Only changed
  cells/nodes should visibly update.

## A.6 Graceful degradation (critical — the site must never break)

- **URS-98** If **either or both** endpoints are unreachable, time out, return non-2xx, are
  rate-limited (429), CORS-fail, or return unparseable JSON, the app MUST continue running on the
  existing **local snapshot data** with the full pre-feature experience intact (URS-1…URS-77). No
  error may throw, blank the bracket, or spam the console (dev `console.warn` at most, once per
  failing poll — not per match).

- **URS-99** When there is **no current Wimbledon event** (off-season, or `events[0]` is another
  tournament — URS-81), the app MUST behave exactly as the local-only build: the live scoreboard
  MUST show a calm empty state ("No live matches right now — showing the latest bracket"), NOT an
  error, and the bracket MUST render from local data.

- **URS-100** When the feed is reachable and it IS Wimbledon but **zero singles matches are `in`**,
  the scoreboard MUST show a "**No matches live right now**" state and MAY show the most recent
  `post` results of the day. The LIVE indicator MUST NOT pulse when nothing is live.

- **URS-101** The live status line (the existing footer status dot, URS-29) MUST reflect live
  state honestly: e.g. "Live · updated Xs ago" on success, "Live feed unavailable — showing saved
  snapshot" on failure. It MUST distinguish *live feed* state from the local dataset's own
  `updatedAt` stamp (URS-30) without conflating them.

- **URS-102** Repeated poll failures MUST NOT escalate resource use: on consecutive failures the
  app SHOULD apply a simple backoff (e.g. widen the interval up to a cap, e.g. 60s) and resume the
  normal 15s cadence once a poll succeeds. It MUST NOT retry in a tight loop.

## A.7 Accessibility

- **URS-103** The live scoreboard MUST be accessible: it MUST be a semantic region with an
  accessible name (e.g. `<section aria-label="Live scores">`); score changes MUST be announced via
  a **polite** `aria-live` region that is **not spammy** — announce at most a concise summary on a
  meaningful change (e.g. "Alcaraz breaks, leads 5–4 in the third" is out of scope for point data;
  a set/score-line summary or "score updated" throttled to real changes is required), NOT a raw
  re-read every second. The 1s "updated Xs ago" ticker MUST NOT be in an assertive live region.
  The scoreboard MUST be keyboard-reachable and readable by a screen reader (the set grid MUST have
  proper table semantics or equivalent labelled structure, not a bare div grid). Reduced-motion
  (URS-38/URS-50) MUST disable the LIVE pulse animation (replace with a static "LIVE" label).

## A.8 Performance / quality

- **URS-104** The feature MUST hold the existing quality bar: Lighthouse ≥90 ×4 (URS-52) with
  polling active; **no console errors** or unhandled promise rejections during load, polling,
  degradation, or teardown (URS-56); no memory/timer leaks — all intervals and `AbortController`s
  MUST be cleared on page hide/unload, and polling SHOULD pause when the tab is hidden
  (`document.visibilitychange` / `hidden`) and resume on focus, to avoid needless background
  fetches. No layout thrash from polling (URS-97).

## A.9 Labelling / honesty (binding, extends URS-70…URS-73)

- **URS-105** The live data MUST be labelled as **real but unofficial**, crediting the source: a
  visible note such as "Live scores via ESPN's public feed — unofficial, may lag or differ from
  official Wimbledon scoring." The existing fan/unofficial disclaimer (URS-70) stays. The site MUST
  NOT present live data as official Wimbledon data, and MUST NOT claim point-by-point (URS-91).

## A.10 Definition of done — live-scores feature (test-agent GREEN for this addendum)

- **URS-106** Every MUST in URS-78…URS-105 PASSES; every SHOULD PASSES or has written design
  sign-off. Specifically verified:
  1. With the live feed reachable and Wimbledon in progress: ongoing singles matches appear in the
     scoreboard with a correct set-by-set grid (tiebreak superscripts), current set highlighted,
     server where given, LIVE badge, and the "updated Xs ago" stamp ticking each second; matched
     matches also drive the bracket node's live status/score and tooltip.
  2. With the feed **blocked/offline** (simulate: block the ESPN host / offline): the site runs on
     local snapshot data with zero errors, a calm "feed unavailable — showing saved snapshot"
     status, and the full URS-1…URS-77 experience intact.
  3. With the feed reachable but **no live matches** (or a non-Wimbledon event): a calm empty
     state, no pulsing LIVE indicator, bracket from local data.
  4. Responsive (mobile/tablet/desktop), keyboard + screen-reader operable scoreboard,
     reduced-motion disables the pulse, Lighthouse ≥90 ×4, no console errors, timers/aborts cleaned
     up on unload and paused when hidden.
  5. Honest labelling present: unofficial ESPN-source credit, no point-by-point claim, fan
     disclaimer intact.

## Appendix A-live — Open clarifying questions (for the client, via orchestrator)

- **CQ-A1 (scoreboard placement):** Default = a collapsible **"Live now" panel above the bracket**
  (side rail on wide screens). Alternative = a persistent **side rail beside the bracket** on
  desktop only, or **tooltip-only** (no separate panel). *Default assumed: panel above / rail
  beside.*
- **CQ-A2 (drive bracket tokens live vs panel-only):** Default = **both** — matched live matches
  drive the bracket node's status/score/tooltip (URS-88/URS-89) *and* appear in the panel.
  Alternative = **panel-only** (leave the bracket entirely on local snapshot data, show live only
  in the scoreboard). Driving the bracket live is the more impressive, coherent option and is the
  default; panel-only is simpler/safer if the client prefers the bracket to stay a stable snapshot.
  *Default assumed: drive both.*
- **CQ-A3 (recently-completed matches):** Default = the scoreboard shows `in` matches plus that
  **day's** `post` results. Alternative = `in`-only. *Default assumed: include today's completed.*

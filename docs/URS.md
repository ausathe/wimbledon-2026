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

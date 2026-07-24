---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md
  - _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md
  - project-brief-wc2026-analytics.md
---

# wc-stats - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for wc-stats, decomposing the requirements from the PRD (+ addendum), the Architecture Spine, the UX design contract (DESIGN.md + EXPERIENCE.md), and the project brief into implementable stories.

Structure directive (from PRD, architecture AD-1, and kickoff instruction): **two decoupled epics** — Epic 1 = extraction & precompute pipeline (Python → static JSON), Epic 2 = static web app (Next.js, consumes JSON). The versioned JSON artifact schema (`/contract`) is the only interface; no Epic 2 story may depend on pipeline internals.

## Requirements Inventory

### Functional Requirements

**Epic 1 — Extraction & Precompute Pipeline (Python, offline)**

FR-1: Batch ingestion of all PMSR PDFs in a configured input directory, producing a run manifest with a terminal per-report status (extracted / failed / skipped-unchanged); idempotent re-runs produce byte-identical artifacts with no redundant re-extraction.
FR-2: Text-anchored page discovery — every target page located by whitespace-normalized text search on section anchors, never by page index; a missing anchor fails loud with report ID + anchor text.
FR-3: Domain A extraction — teams, score, stage/group, venue, date, kickoff, lineups (starters + subs with number, position, goal/sub/card minutes), formations; missing fields fail validation for that report.
FR-4: Domain B extraction — full Key Statistics block per team per match (possession, xG, shots/on-target, passes & completion %, line breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered); values numeric-typed, parse failures fail loud.
FR-5: Domain C extraction — Phases of Play %, Line Height / Team Length in meters (in/out of possession), Defensive Block distribution (high/mid/low) per team per match; block percentages sum to ~100%.
FR-6: Domain E extraction — goalkeeper involvement timeline, distribution (feet/hands/throw), goal prevention (save %, intervention types), aerial control per goalkeeper per match; internally consistent category counts.
FR-7: Domain F extraction — free kicks, penalties, corners (by side and style), throw-ins per team per match; corner counts by side sum to total.
FR-8: Domain G extraction — per-player in-possession, out-of-possession, and physical data (distance by Speed Zones 1–5, high-speed runs, sprints, top speed) for every player with minutes; player rows join to Domain A lineups by stable identity, unmatched rows fail loud.
FR-9: Pitch-frame detection & coordinate normalization — largest sub-page rectangle = pitch frame; marker positions normalized against the full pitch rectangle to true 0–100 Pitch Coordinates; reproduces spike ground truth.
FR-10: Per-page-type marker parsing (shots, crosses, defensive pressure, offers/movement to receive) with per-type shape/size tuning and legend-row exclusion; reference report yields exactly 16 shot markers with 2/2/8/3/1 outcome distribution.
FR-11: Exact-RGB outcome mapping with assert-on-unknown — unknown color aborts that report's extraction with RGB + page; circle-geometry checks prevent the known dark-blue table-header collision.
FR-12: Marker–event linking — each shot marker linked to its tabular event row (time, player, body part, xG) via digit-glyph proximity; unlinked markers retained + flagged, never dropped; 100% link rate required by Self-Validation.
FR-13: Passing-network extraction — player-to-player pass matrix per team per match as edges with player endpoints and positive-integer volumes; every edge references lineup players.
FR-14: Per-report Self-Validation — exact shot-marker count match vs. tabular attempts table + 100% marker–event link rate; binary pass/fail recorded in manifest; no tolerance bands; batch continues on failure.
FR-15: Early template-consistency verification mode — extraction + Self-Validation on a stratified sample (≥1 report per venue AND ≥1 per matchday round) with a per-report deviation summary sufficient to localize a template revision.
FR-16: Batch run report — per-report status, Self-Validation results, warnings (unlinked markers, near-miss parses), aggregate counts; failures identifiable from the summary alone.
FR-17: Normalized data model — all domains normalized into the Tournament → Stage → Match → {Team, Player} spine with stable IDs (ID = URL slug, AD-3); player identity resolved deterministically across all 104 matches.
FR-18: Per-match Bundle generation — one JSON Match Bundle per match containing all seven domains; each ≤ 500 KB gzip -9; breach fails the build.
FR-19: Tournament Index generation — results/standings by stage/group (with pipeline-computed rank incl. FIFA tiebreakers), leaderboards, aggregated Team Profiles and Player Profiles; every value reproducible from Match Bundles.
FR-20: Versioned artifact schema — machine-readable JSON Schema contract in `/contract`, one global schemaVersion; App detects mismatch at build time and fails the build.
FR-35: Momentum-timeline extraction — possession/momentum time series per match covering full match duration, or the report is flagged in the manifest with reason (OQ-5; bundle key required, series or `null`).

**Epic 2 — Static Web App (Next.js/React)**

FR-21: Hero Layer — score, scorers with minutes, stage context, story stats (possession, shots, xG, distance, top speed) readable in ~15s on a 390px viewport within first-viewport-plus-one-scroll, no horizontal scroll.
FR-22: Tactical Layer — Momentum Timeline, shot maps + xG, Pass Networks, Phases-of-Play comparison, pressing & Defensive Blocks, set plays (plus receiving/defensive-action maps and goalkeeping per EXPERIENCE contract); every section renders when data exists, explicit empty state otherwise.
FR-23: Expert Layer — full per-player tables (in-possession, out-of-possession, physical) on the same page; every Domain G field reachable without leaving the match page.
FR-24: True-coordinate pitch visualizations — shot maps, cross maps, Pass Networks rendered from 0–100 Pitch Coordinates; rendered maps spot-check-match the source PDF layout.
FR-25: Results & standings — full results and standings by stage/group; all 104 matches reachable; every result links to its Match Dashboard.
FR-26: Leaderboards — tournament leaderboards over team and player metrics (incl. physical), client-side sortable with no network beyond the initially loaded Tournament Index.
FR-27: Player Profile page — aggregated + per-match data, physical profile, cross-match trend visualizations; per-match values link to the matches behind them; aggregates equal the correct aggregation of per-match values.
FR-28: Team Profile page — tournament-wide tactical identity (Line Heights, Defensive Block distribution, pressing tendencies, Phases of Play, formation usage) with per-match breakdowns.
FR-29: Two-entity comparison — two players, two teams, or two matches side by side, entirely client-side, shareable via URL query params.
FR-30: Externalized UI copy — all user-facing strings (incl. aria/meta) in Locale files; hardcoded strings caught mechanically (lint gate).
FR-31: Language default & toggle — Spanish first render with no stored preference; toggle to English persists client-side across visits (localStorage with try/catch fallback).
FR-32: Tactical-terminology policy — every tactical term carries an explicit per-term decision (translate / jargon / tooltip) in the `es` Locale per the EXPERIENCE.md policy table; no fallthrough to raw keys or silent English.
FR-33: Full static export — every match/player/team route pre-rendered; no server functions, API routes, or runtime env dependencies; deployable on Netlify free tier as-is.
FR-34: Client-side data loading within budget — each route loads only its needed artifacts; all filtering/sorting/comparison client-side within §5 performance budgets.

### NonFunctional Requirements

NFR-1: Performance budgets — Lighthouse mobile ≥ 90 on Match Dashboard and Tournament Hub; per-route JSON payload ≤ 500 KB compressed (gzip -9 over canonical bytes, measured by the Pipeline; Hub = tournament.json + leaderboards.json combined; architecture may tighten but not loosen without a logged decision).
NFR-2: Accessibility — WCAG 2.1 AA intent: semantic structure, keyboard navigation, contrast, text alternatives for all data visualizations (reachable data table per chart is the text alternative of record).
NFR-3: Responsive — mobile-first for Hero Layer and Hub (390px reference); Tactical/Expert/Comparison may be desktop-optimized but must remain fully usable on mobile (layout changes, never data removal).
NFR-4: Shareability — stable, human-readable URLs for every match, player, team; meaningful `<title>`/OG meta for link previews.
NFR-5: Browser support — current evergreen browsers only (latest two majors, desktop and mobile); no legacy/polyfill burden.
NFR-6: Pipeline reproducibility — deterministic artifacts given same PDFs + code (canonical serialization: sorted keys, fixed precision, UTF-8, LF); full batch re-runnable end-to-end on a dev machine.
NFR-7: Language discipline — code, comments, artifacts, docs in English; user-facing copy only via Locales.
NFR-8: Cost — $0 infrastructure; Netlify free tier static only; no paid services in the delivery path (SM-4).
NFR-9: Privacy — no accounts, no auth, no PII, no analytics/telemetry in MVP; language/theme preference client-side only.
NFR-10: Attribution — visible data-source/attribution statement on every route and inside every pitch panel (wording per EXPERIENCE.md, OQ-3).

### Additional Requirements

**From the Architecture Spine (binding for story design):**

- AR-1 (AD-1): Hard two-system boundary — `/data` + `/contract` are the only interface; no shared code, no cross-imports; Pipeline emits nothing presentational.
- AR-2 (AD-2): Contract mechanics — JSON Schemas in `/contract` authored in the draft-07-compatible subset of 2020-12; App consumes **generated** TypeScript types (`json-schema-to-typescript` 15.x); the contract's first task is a one-schema codegen spike proving fidelity; `schemaVersion` is one global integer in `/contract/version.json`, stamped into every artifact, asserted by the App build; open vocabularies are closed schema enums.
- AR-3 (AD-3): One identity — entity IDs are the URL slugs (lowercase ASCII kebab, accent-stripped); stage enum codes; deterministic player-identity resolution in canonical match-ID order with a committed slug registry; an ID once emitted never changes (post-publish check).
- AR-4 (AD-4): Exact artifact set — `data/matches/{match-id}.json` (all 7 domains + contracted `storyStats` per team + required `momentum` key (series or `null`, never omitted/`[]`) + knockout score shape from v1) and `data/index/` (`tournament.json`, `leaderboards.json`, `team-profiles/`, `player-profiles/`); `tournament.json` entity lists are the route manifest with a pipeline-asserted bijection; standings carry explicit pipeline-computed `rank`; budget breaches fail the run, never resolved by dropping fields.
- AR-5 (AD-5): Aggregation lives only in Pipeline precompute — the App never sums/averages/derives cross-match values; user-initiated re-ordering only; single-bundle single-surface carve-out (e.g. match heatmap zone density); comparison renders precomputed values verbatim, presentation geometry only.
- AR-6 (AD-6): One pitch-coordinate frame — 0–100 full-pitch floats oriented to the acting team's attack direction (x=100 at opponent goal line, y=0 attacker's left); explicit `teamId` per event; per-family acting-team semantics pinned in schema; own goals flagged and excluded from shot maps; shootout attempts in `ShootoutAttempt`, never `ShotEvent`; App renders coordinates as-is (affine viewport transforms only).
- AR-7 (AD-7): Artifacts are raw and locale-neutral — unformatted numerics, ISO 8601 dates (venue-local with UTC offset), enum codes; all formatting/mapping in the App's locale layer via `Intl`.
- AR-8 (AD-8): Fail loud, validate per report, deterministic output — per-report failures abort that report, never the batch; manifest is the record of truth; typed exception per failure class; no marker dedup; Self-Validation binary and never loosened (SM-C1).
- AR-9 (AD-9): Two-phase pipeline — pure per-report Extract (`PDF → Extraction Record` in `work/extracted/`, zero cross-report knowledge) then global Precompute (identity, aggregation, emit); marker parser family shares one core filter-chain module; shape/circle-geometry filter mandatory and runs **before** color keying.
- AR-10 (AD-10): App state rules — URL + localStorage (`wcstats.locale`, `wcstats.theme`, try/catch with in-memory fallback) + ephemeral component state only; no state library, no client cache; React Context only for locale and theme; same-origin fetch of static `/data`.
- AR-11 (AD-11): Rendering split — build-time filesystem reads (`generateStaticParams` from the route manifest) for static params, `<title>`/OG meta, and pre-rendered Hero content from `storyStats`; client fetch for everything below the Hero; no inlining full bundles; `output: 'export'`, `images: { unoptimized: true }`; fonts (Archivo + Inter) self-hosted via `next/font`, zero external requests.
- AR-12 (AD-12): i18n enforcement — typed locale dictionaries (`locales/es.ts` canonical, `en.ts` type-mirrored, `t()` accessor); ESLint gate (`react/jsx-no-literals` + `no-restricted-syntax` covering aria/title/meta) wired into the build chain; one inline head script sets `<html lang>` + locale class + theme class before first paint; string swap once post-hydration.
- AR-13 (AD-13): Deployment & gates — monorepo (`pipeline/`, `app/`, `contract/`, `data/`); artifacts committed; App build copies `/data` into export output; Netlify build chain = ESLint (`--max-warnings 0`) → typecheck → schema-version assert → `next build` on Node 24; pytest dev-machine only; no functions/middleware/env/analytics.
- AR-14 (AD-14): Contract bootstrap sequencing — Epic 1's first deliverable is the complete v1 schema set + committed fixture artifacts (`data/fixtures/`: ≥1 full Match Bundle + one of every index artifact, covering group match, ET+shootout knockout, own goal, `momentum: null`); Epic 2 builds against fixtures and signs off v1 against a per-surface data-needs checklist before Epic 1 proceeds past the sample set; thereafter contract changes flow Epic 2 → request, Epic 1 → implement, version bump + fixtures regenerated in the same commit.
- AR-15 (Stack pins): Python 3.13+, pymupdf 1.28.x, pdfplumber 0.11.x, pytest 8.x, Node 24 LTS, Next.js 16.2.x, React 19.2, TypeScript 6.0.x, Tailwind 4.3.x, shadcn CLI (Tailwind v4 registry, vendored components), d3 7.9.x, recharts 3.x, json-schema-to-typescript 15.x; pinned `requirements.txt` via pip (no `uv`), npm with committed lockfile.
- AR-16 (Testing conventions): pytest for pipeline; `spike/mex_rsa.pdf` (16 markers, 2/2/8/3/1) is a permanent ground-truth fixture — counts/distribution only (spike's printed coordinates are in a transposed frame vs AD-6 and must not be lifted as expected values). App test harness details (vitest/Playwright/Lighthouse CI) are the epic's tooling call; the budgets they assert are fixed.
- AR-17 (Deferred, story-relevant): momentum series concrete shape lands after first Domain B/C extraction look via AD-14 change flow; heatmap zone-grid evaluated during Epic 2's first heatmap story; SQLite fallback only on demonstrated client-side failure; Netlify account-model check recorded at deploy.

### UX Design Requirements

From DESIGN.md + EXPERIENCE.md (first-class inputs; specifics binding):

- UX-DR1: Design-token implementation — full DESIGN.md token set (canvas/ink dark-canonical + `-light` variants, brand accents, data-viz palette incl. shot outcomes, edge-weight ramp, heat ramp, result chips, pitch colors, focus-ring-on-pitch) mapped onto shadcn CSS variables per the mapping table; Tailwind 4-based spacing + named tokens (gutters, tile-gap 12px, section-gap 48px, layer-gap 64px); radii scale; tonal elevation (no shadows except true overlays).
- UX-DR2: Typography system — Archivo (display/numeric: display-score 44px, display-stat, stat-value, headline) + Inter (title, body, table-numeric, stat-label, label-caps, caption), self-hosted via `next/font`; **tabular numerals mandatory** in every aligned numeric context; no type below 11px; ramp survives 200% zoom without horizontal scroll in the Hero.
- UX-DR3: Theme system — dark canonical, light derived; system-aware default with persisted manual override (`wcstats.theme`); pre-paint head script sets theme class; pitch panels theme-invariant (deep green in both themes, hairline border on dark only).
- UX-DR4: Site header — slim sticky bar: wordmark → `/`, header search, language toggle (`ES | EN` segmented pill), theme toggle; no primary nav; on `<md` search collapses to icon button opening a full-width sheet.
- UX-DR5: Header search — client-side typeahead over the Tournament Index (players, teams, matches); shadcn Command combobox semantics (`role="combobox"`, arrow keys, Enter navigates, Esc closes); accent/case-insensitive matching via `Intl.Collator('es', {sensitivity:'base'})`; empty-result state with link to `/`. (Logged scope addition beyond PRD FRs.)
- UX-DR6: Layer section shell — wraps every Tactical/Expert section; `≥lg` Tactical expanded, `<lg` header + one-line summary expanding in place (Accordion semantics, `aria-expanded`, focus moves to revealed heading); Expert shell collapsed by default at all widths, expands in place; anchor navigation auto-expands; expansion lazy-mounts the viz.
- UX-DR7: Stat tile — value + uppercase label; head-to-head tiles accent the leading side **plus** ▲ leader glyph and «líder»/"leader" in the accessible name (never color-only); glossary triggers inside labels.
- UX-DR8: Momentum Timeline — recharts on raised surface; team-accent area fills at 60% opacity around a reserved ink midline gutter; goal markers on the axis (shot-goal token + ring, in tab order, announce scorer + minute); minute cursor with `role="slider"` semantics, arrow keys ±1 min, tap-to-position (no drag); empty state when series absent.
- UX-DR9: Pitch panels (shot map, cross map, receiving/defensive-action maps, pass network, heatmap) — markers at true 0–100 coordinates, never displaced; detail popover per marker (player, minute, xG, outcome); overlap clusters → list popover with z-order cycling and full keyboard equivalence; Voronoi hit-area partitioning with ≥44px areas and cluster collapse; pass-network node isolation (tap/Enter toggles, Esc clears, `aria-pressed`, focus-ring-on-pitch selection ring); every panel carries "Ver los datos / View data" opening the equivalent data table, plus a permanent in-panel attribution caption.
- UX-DR10: Shot-outcome encoding — five outcomes with dedicated tokens AND mandatory shape dual-encoding (filled circle + ring / filled circle / hollow circle / filled square / hollow square); marker size may scale with xG; one meaning per color per viz; receiving/defensive markers use team accents with shape encoding (hollow diamond / filled diamond / filled triangle).
- UX-DR11: Two-team encoding — app-owned Team A/B accents (never real federation colors); hue alone never distinguishes teams: direct series labels always, dashed stroke/pattern fill for Team B where geometry allows; viz-neutral for "neither team"; single-series charts use viz-single.
- UX-DR12: Data table (sortable) — client-side sort on any column head (click/Enter/Space, `aria-sort`, polite live-region announcements); `Intl.Collator('es', {sensitivity:'base'})` for text sort; stated default sort per table; sticky header (+ sticky player column in Expert tables); `scroll-padding-top`; `<md` Hub sort via DropdownMenu; sorting never loses row focus; zebra striping never.
- UX-DR13: Empty-state panel — occupies the missing section's slot (dashed border, headline + explanation), never silent absence or layout collapse; ruled copy per State Patterns (incl. dedicated momentum-missing case that keeps header + anchor).
- UX-DR14: State patterns — pre-rendered shell + layout-shaped skeletons on cold load (`aria-busy`, polite "Datos cargados." announcement, Hero prioritized); bundle fetch failure → inline retry panel, shell/nav stay usable; static 404; invalid comparison params keep the valid side.
- UX-DR15: Interaction primitives — tap = act (no hover-only info); ≥44×44px touch targets (invisible hit areas for small markers); keyboard: reading-order tab, Enter/Space activate, Esc closes topmost, arrow-key roving tabindex marker-to-marker ordered by minute; vertical page scroll only (horizontal only inside wide containers with affordance); banned: infinite scroll, carousels, drag, modal stacks >1, scroll-jacking, autoplay motion.
- UX-DR16: Accessibility floor — every viz has a reachable same-numbers data-table alternative (defined schemas: heatmap zone table, event logs for marker maps); `role="figure"` + localized one-sentence `aria-label`; focusable markers expose localized name/role/value; all aria strings are locale keys; skip-link; no traps; `prefers-reduced-motion` disables all animation; `<html lang>` tracks locale; 200% zoom / 320px reflow (data tables keep internal-scroll exception).
- UX-DR17: Responsive collapse rules — per the Responsive table: team tabs + vertical half-pitch (attacking goal up) for maps on `<md`; pass-network low-quintile edge hiding with "Mostrar todos los pases" toggle; Expert column-group tabs (En posesión / Sin posesión / Físico) with sticky player column; comparison stacks with sticky mini-header; Hub tables "Más columnas" disclosure; Spanish text-expansion handling (two-line labels, ruled abbreviations with full term in tooltip/aria-label).
- UX-DR18: Progressive Disclosure Contract — one page, one route, one bundle; normative layer assignment (Hero: Domain A + story stats, exactly one sub-disclosure = compact lineups/formations; Tactical: fixed section order key-stats → momentum → shot maps → pass networks → offers → movement → defensive actions → phases → pressing → set plays → goalkeeping; Expert: Domain G tables + full event logs doubling as viz alternatives); stable deep-link anchors for every section; 15-second hero test at 390px as acceptance; profiles/Hub apply the same grammar at smaller scale.
- UX-DR19: i18n content — `es` canonical / `en` type-mirrored locale files; full per-term policy table implemented verbatim (incl. abbreviations like "VEL. MÁX.", stage names with dieciseisavos, result letters V/E/D vs W/D/L, positions, LatAm register: arquero/atajada/al arco); `Intl.NumberFormat`/`DateTimeFormat` (`es-CO`/`en`), venue-local kickoff times; tuteo, no exclamation marks, canonical control strings ("Ver los datos"); language toggle announces via polite live region.
- UX-DR20: Glossary — `/glossary` route (both languages) + glossary tooltip component (dotted cyan underline trigger; hoverable, persistent, Esc-dismissible per 1.4.13; counterpart-language subtitle; "Ver en el glosario" deep link; terms marked once per section).
- UX-DR21: Attribution — persistent footer line on every route + in-panel caption on every pitch panel + full `/about` statement (methodology, xG used as-is, independence disclaimer); ruled es/en wording from EXPERIENCE.md.
- UX-DR22: Routes & cross-links — IA table routes (`/`, `/matches/{slug}`, `/players/{slug}`, `/teams/{slug}`, `/compare`, `/glossary`, `/about`, `/404`); mandatory cross-links (result rows → match, per-match profile values → anchored match section, match header teams → team profiles, lineup names → player profiles, "Comparar" actions deep-link with `a` pre-filled); comparison URL scheme `/compare?type=&a=&b=`; language not in URL (single-tree i18n, consequences logged); meaningful `<title>`/OG per route.
- UX-DR23: Comparison surface — type selector + two Command search-selects over the Tournament Index; URL-synced, swap-sides control; mirrored stat rows around shared centered labels; identical scales/axes per side; entity accent top-borders only; empty/partial/invalid states ruled.

### FR Coverage Map

FR-1: Epic 1 — Batch ingestion with run manifest, idempotent re-runs
FR-2: Epic 1 — Text-anchored page discovery, fail-loud missing anchors
FR-3: Epic 1 — Domain A (metadata & result) extraction
FR-4: Epic 1 — Domain B (comparative team stats) extraction
FR-5: Epic 1 — Domain C (tactical identity) extraction
FR-6: Epic 1 — Domain E (goalkeeping) extraction
FR-7: Epic 1 — Domain F (set plays) extraction
FR-8: Epic 1 — Domain G (individual player data) extraction
FR-9: Epic 1 — Pitch-frame detection & 0–100 coordinate normalization
FR-10: Epic 1 — Per-page-type marker parser family with legend-row exclusion
FR-11: Epic 1 — Exact-RGB outcome mapping, assert-on-unknown
FR-12: Epic 1 — Marker–event linking via digit-glyph proximity (gates all spatial joins)
FR-13: Epic 1 — Passing-network extraction
FR-14: Epic 1 — Per-report Self-Validation (binary, no tolerance)
FR-15: Epic 1 — Early template-consistency verification (venue × matchday sample)
FR-16: Epic 1 — Batch run report
FR-17: Epic 1 — Normalized data model with stable IDs / identity resolution
FR-18: Epic 1 — Per-match Bundle generation within payload budget
FR-19: Epic 1 — Tournament Index generation (standings, leaderboards, profiles)
FR-20: Epic 1 — Versioned artifact schema (`/contract`, schemaVersion)
FR-35: Epic 1 — Momentum-timeline extraction (series or flagged `null`)
FR-21: Epic 2 — Hero Layer (15-second match story on mobile)
FR-22: Epic 2 — Tactical Layer sections with explicit empty states
FR-23: Epic 2 — Expert Layer per-player tables, one-page rule
FR-24: Epic 2 — True-coordinate pitch visualizations
FR-25: Epic 2 — Results & standings (Tournament Hub)
FR-26: Epic 2 — Client-side sortable leaderboards
FR-27: Epic 2 — Player Profile page
FR-28: Epic 2 — Team Profile page
FR-29: Epic 2 — Two-entity Comparison Mode
FR-30: Epic 2 — Externalized UI copy with mechanical enforcement
FR-31: Epic 2 — Spanish default + persistent English toggle
FR-32: Epic 2 — Per-term tactical-terminology policy
FR-33: Epic 2 — Full static export on Netlify free tier
FR-34: Epic 2 — Per-route client-side data loading within budgets

All 35 FRs are covered; no FR is unassigned.

## Epic List

### Epic 1: Complete Tournament Dataset — Extraction & Precompute Pipeline

Juan (the builder) can turn all 104 PMSR PDFs into a complete, validated, versioned static JSON artifact set — Match Bundles, Tournament Indices, and the `/contract` schema — with every report self-validated (exact marker counts, 100% link rate), every failure documented in the run manifest, and byte-identical deterministic re-runs (UJ-5). The artifact set is the entire contract with Epic 2 and is independently valuable as the liberated dataset itself.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-35
**Key constraints:** AR-1..AR-9, AR-14 (contract + fixtures first), AR-15..AR-17, NFR-1 (payload budget), NFR-6, NFR-7
**Sequencing (de-risking, per PRD §8.1):** contract bootstrap (AD-14) → template-consistency verification (FR-15) and marker–event linking (FR-12) early — they carry the two highest technical risks and gate everything spatial.

### Epic 2: Match & Tournament Analytics Web App

Fans and analysts can use the full product: Mariana reads any match's story in ~15 seconds on her phone in Spanish (UJ-1, UJ-4); Diego drills into tactical and expert depth on the same page, compares teams/players/matches tournament-wide, and cites the app in English (UJ-2, UJ-3). Delivered as a fully static, free, accessible Next.js app on Netlify — consuming only the Epic 1 artifact contract (fixtures until real artifacts land, per AD-14), never pipeline internals.

**FRs covered:** FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34
**Key constraints:** AR-1, AR-2 (generated types), AR-5..AR-7, AR-10..AR-13, NFR-1..NFR-5, NFR-8..NFR-10, UX-DR1..UX-DR23
**Sequencing:** i18n scaffolding (FR-30..32 structure) and the design-token/theme foundation land in the earliest UI story — never retrofitted; progressive disclosure (Hero → Tactical → Expert) built layer-out per the UX contract.

**Dependency note:** Epic 2 depends only on the `/contract` schema + fixtures (available at Epic 1's first deliverable, AD-14), so the epics build in parallel after that bootstrap. Epic 2's v1 sign-off checklist gates Epic 1 proceeding past the sample set; thereafter contract changes flow Epic 2 → request, Epic 1 → implement.

## Epic 1: Complete Tournament Dataset — Extraction & Precompute Pipeline

Juan (the builder) can turn all 104 PMSR PDFs into a complete, validated, versioned static JSON artifact set — Match Bundles, Tournament Indices, and the `/contract` schema — with every report self-validated, every failure documented in the run manifest, and byte-identical deterministic re-runs. Story order encodes the de-risking priorities: contract bootstrap first (AD-14), then the template-consistency gate (FR-15) and marker–event linking (FR-12) before broad extraction. Every extraction story carries its per-report self-validation / consistency check — correctness is designed in, never asserted after the fact (AD-8, SM-C1).

### Story 1.1: Contract v1 Schemas, Fixtures & Type-Generation Spike

As the builder,
I want the complete v1 artifact schema set in `/contract` with committed fixtures and a proven TypeScript codegen path,
So that both epics build against a single versioned contract from day one and Epic 2 is never blocked on the pipeline.

**Acceptance Criteria:**

**Given** the monorepo seed (`contract/`, `pipeline/`, `data/`, `app/`, `spike/` per the Structural Seed)
**When** the v1 schema set is authored
**Then** every artifact shape has a JSON Schema in `/contract` — Match Bundle (all 7 domains, per-team `storyStats`, required `momentum` key typed series-or-`null`, knockout score shape: `scoreAfter90`/`scoreAfterET`/`shootoutScore`/`winnerTeamId`/`decidedBy`, and every Domain D event table incl. `PassNetworkNode`, `ReceivingEvent`, `DefensiveActionEvent`, `ShootoutAttempt`), `tournament.json`, `leaderboards.json`, team-profile, and player-profile
**And** schemas use the draft-07-compatible subset of 2020-12 (no `prefixItems`/`unevaluatedProperties`/`dependentSchemas`), open vocabularies are closed enums, per-field numeric precision is fixed, and `/contract/version.json` declares `schemaVersion: 1`.

**Given** the codegen spike (AD-2)
**When** `json-schema-to-typescript` 15.x runs against one representative schema
**Then** the generated types round-trip the schema faithfully (or the tool is swapped via a logged decision), and a scripted step emits all types plus a generated `SCHEMA_VERSION` constant.

**Given** fixture authoring
**When** `data/fixtures/` is committed
**Then** it contains at least one full Match Bundle and one instance of every index artifact, all schema-validated, hand-checked, stamped `schemaVersion: 1`
**And** fixtures cover the edge shapes: a group match, a knockout decided by extra time + shootout, a match with an own goal (`ownGoal: true`), and a bundle with `momentum: null`
**And** all IDs follow AD-3 (lowercase ASCII kebab slugs, stage enum codes, `{surname}-{givenName}-{teamCode}` players).

### Story 1.2: Batch Ingestion, Run Manifest & Text-Anchored Page Discovery

As the pipeline operator,
I want to run the batch over a directory of PMSR PDFs with per-report status tracking and text-anchored page location,
So that every report is processed reliably regardless of page order and re-runs are cheap and deterministic (UJ-5).

**Acceptance Criteria:**

**Given** a configured input directory of PMSR PDFs
**When** a batch run executes
**Then** the run manifest lists exactly one entry per PDF with a terminal status (extracted / failed / skipped-unchanged)
**And** a per-report failure lands as a typed exception in the manifest and never aborts the batch (AD-8).

**Given** a completed run with unchanged inputs and code
**When** the batch is re-run
**Then** unchanged reports are skipped via idempotence keys on (PDF content hash, code version) and all outputs are byte-identical (FR-1, NFR-6).

**Given** any report
**When** target pages are located
**Then** location uses whitespace-normalized text search on section anchors, never page indices — a shuffled/offset report still resolves
**And** a missing anchor fails that report loud with report ID + anchor text, never a silent skip (FR-2).

**Given** the two-phase staging rule (AD-9)
**When** a report's extraction completes
**Then** a pure per-report Extraction Record is persisted to `work/extracted/{match-id}.json` (raw domains + self-validation result) with zero cross-report knowledge.

### Story 1.3: Shots Pitch-Map Parser with Marker-Count Self-Validation

As the builder,
I want the spike's shots parser productionized into the shared core filter-chain module with exact-RGB outcome mapping and marker-count self-validation,
So that the highest-value spatial extraction is trustworthy for every report and the recipe is reusable by every other map parser.

**Acceptance Criteria:**

**Given** a shots map page
**When** the parser runs
**Then** the pitch frame is detected as the largest sub-page rectangle and marker positions are normalized against the **full** pitch rectangle to 0–100 coordinates in the AD-6 frame (explicit `teamId`, x=100 at opponent's goal line, y=0 attacker's left) (FR-9)
**And** the filter chain runs in the mandatory order: pitch-frame detect → circle-geometry/shape filter → legend-row exclusion (≥4 distinct legend colors at identical y) → exact-RGB outcome keying (AD-9)
**And** the dark-blue table-header collision produces zero false markers because geometry runs before color.

**Given** the permanent ground-truth fixture `spike/mex_rsa.pdf`
**When** the parser runs under pytest
**Then** exactly 16 shot markers are found with the 2 goal / 2 on-target / 8 off-target / 3 blocked / 1 incomplete distribution (counts/distribution only — the spike's printed coordinates are a transposed frame and are not expected values) (FR-10, AR-16).

**Given** a marker with an off-palette color
**When** outcome keying runs
**Then** that report's extraction aborts with the RGB value and page in the error — never a silently dropped marker (FR-11)
**And** overlapping markers are never deduped — each source drawing is one event (AD-8).

**Given** the tabular attempts table on the same report
**When** Self-Validation runs
**Then** the extracted marker count is compared exactly (binary pass/fail, no tolerance) and recorded in the manifest with both counts on mismatch (FR-14, count check)
**And** own goals are flagged `ownGoal: true` and shootout attempts (where a shootout page exists) land in `ShootoutAttempt`, never `ShotEvent` (AD-6).

### Story 1.4: Template-Consistency Verification Across the Venue × Matchday Sample

As the builder,
I want a verification mode that runs extraction + available self-validation on a stratified sample of reports,
So that a silent mid-tournament template revision — the project's top extraction risk — is caught before any full-batch output is trusted (FR-15).

**Acceptance Criteria:**

**Given** the 104-report corpus
**When** verification mode selects its sample
**Then** the sample is the union of two covers — at least one report per venue AND at least one per matchday round — with one report allowed to satisfy both.

**Given** the sample
**When** verification runs (discovery + all extractors implemented so far + Self-Validation)
**Then** a per-report deviation summary lists missing anchors, unknown RGB values, and count mismatches, sufficient to localize any template revision to a venue or matchday
**And** every deviation is recorded in the manifest with report ID and specifics; a clean run is recorded as the gate result.

**Given** later parser/extractor stories
**When** each lands
**Then** verification mode is re-runnable cheaply against the same sample (idempotent re-run semantics), and each subsequent extraction story re-runs this gate as part of its acceptance.

### Story 1.5: Marker–Event Linking via Digit-Glyph Proximity

As the builder,
I want every shot marker linked to its tabular event row by matching nearby digit glyphs,
So that spatial events carry time, player, body part, and xG — unlocking every spatial join in the product.

**Acceptance Criteria:**

**Given** a shots page with parsed markers and `get_text("words")` digit glyphs
**When** linking runs
**Then** every linked shot exposes time, player, body part, and xG joined from the tabular event rows (FR-12).

**Given** a marker that cannot be linked
**When** the report is processed
**Then** the marker is retained with coordinates and outcome, flagged in the run manifest, and that report's Self-Validation fails — the link-rate requirement is 100%, never loosened (SM-C1)
**And** Self-Validation is now the full binary check: exact marker count AND 100% link rate (FR-14, complete).

**Given** the reference report
**When** linking runs under pytest
**Then** 16/16 markers link to their event rows with correct player/minute/xG values.

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs with linking active
**Then** per-report link rates are recorded in the deviation summary.

### Story 1.6: Domain A Extraction — Metadata, Lineups & Formations

As the builder,
I want teams, score, stage/group, venue, date, kickoff, full lineups, and formations extracted for every match,
So that every other domain has its identity backbone and the App can render match headers and lineups (FR-3).

**Acceptance Criteria:**

**Given** a PMSR report
**When** Domain A extraction runs
**Then** the Extraction Record contains teams, score, stage/group, venue, date, kickoff, formations, and lineups — starters + substitutes each with number, position, and goal/sub/card minutes — per the addendum §6 inventory
**And** any missing field fails validation for that report, loud, with the field named.

**Given** raw values
**When** they are recorded
**Then** stage maps to the AD-3 enum codes, positions to `gk|df|mf|fw`, kickoff to ISO 8601 venue-local time with UTC offset, and proper names pass through as-is in English (AD-7).

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** Domain A anchors and field completeness are part of the deviation summary.

### Story 1.7: Domains B & C Extraction — Key Statistics & Tactical Identity

As the builder,
I want the full Key Statistics block and tactical-identity measures extracted per team per match,
So that head-to-head stats, story stats, and team tactical identity are available to every downstream surface (FR-4, FR-5).

**Acceptance Criteria:**

**Given** a report's Key Statistics pages
**When** Domain B extraction runs
**Then** both teams carry the complete block per the addendum §6 inventory (possession, xG, shots/on-target, passes & completion %, line breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered), all numeric-typed
**And** any value that fails to parse as its expected type fails that report loud.

**Given** the tactical-identity pages
**When** Domain C extraction runs
**Then** both teams carry Phases of Play percentages, Line Height / Team Length in meters (in and out of possession), and Defensive Block distribution
**And** the self-consistency check records pass/fail: block percentages per team sum to ~100%, meter values numeric.

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** B/C anchors, types, and consistency checks appear in the deviation summary.

### Story 1.8: Momentum-Series Extraction (OQ-5 Resolution)

As the builder,
I want the momentum/possession time series located, extracted, and its shape landed in the contract,
So that the App's Momentum Timeline (FR-22) has its Epic 1 counterpart and the gap can never be silently dropped (FR-35).

**Acceptance Criteria:**

**Given** the Domain B/C pages
**When** the source investigation completes
**Then** the PMSR page and data shape feeding the momentum series are identified and documented (resolving OQ-5).

**Given** the resolved series shape
**When** the contract is updated
**Then** the change flows through AD-14: schema updated, `schemaVersion` bumped, fixtures regenerated in the same commit.

**Given** any match
**When** extraction runs
**Then** the Extraction Record's momentum value is either a series covering the full match duration or `null` with the reason flagged in the manifest — never omitted, never `[]` (AD-4).

### Story 1.9: Domains E & F Extraction — Goalkeeping & Set Plays

As the builder,
I want goalkeeper and set-play data extracted per match,
So that the Tactical Layer's goalkeeping and set-play sections have complete data (FR-6, FR-7).

**Acceptance Criteria:**

**Given** a report
**When** Domain E extraction runs
**Then** every goalkeeper with minutes in Domain A has a record: involvement timeline, distribution (feet/hands/throw), goal prevention (save %, intervention types), aerial control
**And** the self-consistency check records pass/fail: distribution category counts sum to total distributions.

**Given** a report
**When** Domain F extraction runs
**Then** both teams carry free kicks, penalties, corners (by side and style), and throw-ins
**And** the self-consistency check records pass/fail: corner counts by side sum to the team's total corners.

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** E/F anchors and consistency checks appear in the deviation summary.

### Story 1.10: Domain G Extraction — Per-Player Performance & Physical Data

As the builder,
I want every player's in-possession, out-of-possession, and physical data extracted per match,
So that Expert tables, player profiles, and physical leaderboards have their source data (FR-8).

**Acceptance Criteria:**

**Given** a report
**When** Domain G extraction runs
**Then** every player with minutes carries the full addendum §6 inventory: in possession (passes, %, switches, line breaks, ball progressions, take-ons, step-ins, attempts, goals), out of possession (tackles, blocks, interceptions, pressing, duels, clearances, recoveries), physical (distance by speed zones 1–5, high-speed runs, sprints, top speed).

**Given** a player row
**When** it is joined to the Domain A lineup
**Then** the join uses within-report name identity and an unmatched row fails that report loud (cross-report resolution is Story 1.15's concern).

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** Domain G anchors and join integrity appear in the deviation summary.

### Story 1.11: Crosses Map Parser

As the builder,
I want the crosses pitch map parsed with the shared filter-chain recipe tuned for cross markers,
So that cross events carry true coordinates, types, and outcomes (FR-10).

**Acceptance Criteria:**

**Given** a crosses map page
**When** the parser runs
**Then** it reuses the core filter-chain module with per-type shape/size tuning, legend-row exclusion, and exact-RGB outcome keying (assert-on-unknown, FR-11 semantics)
**And** `CrossEvent` rows carry 0–100 AD-6 coordinates, `teamId`, and schema-enum types/outcomes.

**Given** the report's tabular cross totals
**When** Self-Validation runs
**Then** the extracted cross-marker count is cross-checked against the tabular total and recorded binary pass/fail in the manifest.

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** cross-map deviations appear in the summary.

### Story 1.12: Defensive-Actions Map Parser

As the builder,
I want the defensive pressure/actions map parsed with the shared recipe,
So that defensive actions carry true coordinates for the App's defensive-action maps (FR-10).

**Acceptance Criteria:**

**Given** a defensive-actions map page
**When** the parser runs
**Then** it reuses the core filter chain with per-type marker tuning and legend exclusion, asserting on unknown RGB
**And** `DefensiveActionEvent` rows carry 0–100 coordinates with `teamId` = the **defending** team per AD-6's pinned semantics.

**Given** any tabular count for the family present on the page
**When** Self-Validation runs
**Then** the marker count is cross-checked where a tabular counterpart exists, and the check result (or its documented absence) is recorded in the manifest.

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** defensive-map deviations appear in the summary.

### Story 1.13: Offers & Movement to Receive Parsers

As the builder,
I want the two receiving-map families parsed with the shared recipe,
So that offers and movements to receive carry true coordinates typed per family (FR-10).

**Acceptance Criteria:**

**Given** the offers-to-receive and movement-to-receive map pages
**When** the parsers run
**Then** both reuse the core filter chain with per-type tuning and legend exclusion, asserting on unknown RGB
**And** `ReceivingEvent` rows carry `type: offer | movement`, 0–100 coordinates, and `teamId` = the **receiving** player's team (AD-6).

**Given** any tabular counterpart on the pages
**When** Self-Validation runs
**Then** counts are cross-checked where available and recorded (or their absence documented) in the manifest.

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** receiving-map deviations appear in the summary.

### Story 1.14: Pass-Network Extraction — Nodes & Edges

As the builder,
I want the player-to-player pass matrix and node positions extracted per team per match,
So that the App can render pass networks from true data (FR-13).

**Acceptance Criteria:**

**Given** a pass-network page
**When** extraction runs
**Then** `PassNetworkEdge` rows carry two player endpoints and positive-integer volumes, and every endpoint references a player in that team's Domain A lineup — an unmatched endpoint fails the report loud
**And** `PassNetworkNode` rows carry player ID + x/y in the AD-6 frame, extracted from the page — never derived from edges.

**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** pass-network anchors and join integrity appear in the deviation summary.

### Story 1.15: Cross-Match Identity Resolution & Normalized Spine

As the builder,
I want all Extraction Records normalized into the data-model spine with stable IDs and deterministic player-identity resolution,
So that a player appearing in N matches has exactly one ID that is also their stable URL slug (FR-17).

**Acceptance Criteria:**

**Given** all Extraction Records
**When** precompute runs
**Then** records are consumed in canonical order (ascending match ID) and identity resolves deterministically: normalized (lowercase, accent-stripped) name + team, collisions broken by first-seen shirt number (OQ-4)
**And** every entity gets exactly one AD-3 ID/slug (match `m73-mexico-argentina`, team `mexico`, player `{surname}-{givenName}-{teamCode}`), referenced consistently by all per-match rows and aggregates.

**Given** the committed slug registry (override map in `pipeline/`)
**When** a run would change a previously emitted ID (diffed against committed `/data`)
**Then** the run fails unless a pinning entry exists — an ID, once emitted, never changes.

**Given** ambiguous cases (accents, duplicate names, squad-number changes)
**When** resolution runs
**Then** each is resolvable via a registry entry and the resolution is covered by pytest cases.

### Story 1.16: Match Bundle Emission — Canonical Serialization, Version Stamp & Budget Gate

As the builder,
I want one schema-valid Match Bundle emitted per match with canonical serialization and an enforced payload budget,
So that the App's per-route contract holds for every match (FR-18, FR-20).

**Acceptance Criteria:**

**Given** a normalized match
**When** emission runs
**Then** `data/matches/{match-id}.json` contains all seven domains, the per-team `storyStats` block, the required `momentum` key (series or `null`), and the knockout score shape
**And** the bundle validates against the `/contract` schema and carries the stamped `schemaVersion`.

**Given** serialization
**When** any artifact is written
**Then** output is canonical — sorted keys, per-field fixed precision, UTF-8, LF — and values are locale-neutral (raw numerics, ISO 8601 dates, enum codes; no display strings) (AD-7, AD-8)
**And** re-runs are byte-identical.

**Given** the payload budget
**When** the pipeline measures each bundle (gzip -9 over canonical bytes)
**Then** any bundle > 500 KB fails the run — resolved by splitting or a logged budget decision, never by dropping fields (SM-C2).

### Story 1.17: Tournament Index — Results, Standings & Leaderboards

As the builder,
I want `tournament.json` and `leaderboards.json` precomputed,
So that the Hub renders results, standings, and leaderboards verbatim with zero client-side aggregation (FR-19, AD-5).

**Acceptance Criteria:**

**Given** all normalized matches
**When** index generation runs
**Then** `tournament.json` carries results and standings by stage/group with an explicit pipeline-computed `rank` per row implementing the full FIFA tiebreaker cascade, plus the entity lists (matches, teams, players) that serve as the App's route manifest and search source
**And** `leaderboards.json` carries team and player leaderboards (including physical metrics: top speed, sprints) with canonical default order and closed metric-code enums.

**Given** the route-manifest bijection rule (AD-4)
**When** the run completes
**Then** the pipeline asserts one profile artifact per listed entity — empty sections allowed, absence not.

**Given** the Hub payload budget
**When** measured
**Then** `tournament.json` + `leaderboards.json` combined ≤ 500 KB gzip -9, else the run fails.

**Given** reproducibility (FR-19)
**When** pytest runs
**Then** every standings and leaderboard value is asserted reproducible from the underlying Match Bundles.

### Story 1.18: Team & Player Profile Artifacts

As the builder,
I want per-entity profile artifacts precomputed,
So that Team and Player Profile pages render aggregated identities and trends verbatim (FR-19, AD-5).

**Acceptance Criteria:**

**Given** all normalized matches
**When** profile generation runs
**Then** `data/index/team-profiles/{team-id}.json` carries the tournament-wide tactical identity — line heights, defensive-block distribution, pressing tendencies, phases of play, formation usage — with per-match breakdowns
**And** `data/index/player-profiles/{player-id}.json` carries totals/averages per metric semantics, per-match series, the physical profile (speed zones, high-speed runs, sprints, top speed), and cross-match trends.

**Given** the budget and bijection gates
**When** the run completes
**Then** each profile artifact ≤ 500 KB gzip -9 and exactly one artifact exists per manifest-listed entity.

**Given** reproducibility
**When** pytest runs
**Then** every profile aggregate is asserted reproducible from the entity's Match Bundles (sum/max/average per metric as appropriate).

### Story 1.19: Full-Batch Run, Batch Report & 104/104 Acceptance

As the pipeline operator,
I want the full 104-report batch executed with a self-sufficient batch report and every artifact committed,
So that the complete, validated dataset exists and SM-1 is met — or every residual failure is individually documented (FR-16).

**Acceptance Criteria:**

**Given** the full corpus
**When** the batch runs end-to-end (extract → validate → precompute → emit)
**Then** the manifest carries exactly 104 terminal entries and the batch summary reports per-report status, Self-Validation results, warnings (unlinked markers, near-miss parses), and aggregate counts
**And** from the summary alone a reader can identify every failed report and why, without opening logs or artifacts.

**Given** the SM-1 target
**When** the run completes
**Then** 104/104 reports pass Self-Validation, or each residual failure is individually documented with its cause — with checks never weakened to get there (SM-C1).

**Given** the completed run
**When** artifacts are finalized
**Then** `/data` (matches + indices) is committed, replacing fixtures as Epic 2's data source, with fixtures retained for tests
**And** a full re-run from the same inputs reproduces the committed artifacts byte-identically (NFR-6).

## Epic 2: Match & Tournament Analytics Web App

Fans and analysts can use the full product: Mariana reads any match's story in ~15 seconds on her phone in Spanish (UJ-1, UJ-4); Diego drills into tactical and expert depth on the same page, compares teams/players/matches tournament-wide, and cites the app in English (UJ-2, UJ-3). The app consumes only the `/contract` schema + fixtures (then real `/data`), never pipeline internals (AD-1). i18n and the token/theme foundation are structural from the first story — retrofitting is a known failure mode. Until Story 1.19 lands, every story builds and tests against `data/fixtures/` (AD-14).

### Story 2.1: Static App Scaffold with Design Tokens, i18n Structure & Build Gates

As the builder,
I want a deployable Next.js static-export scaffold with the full token/theme system, typed locale dictionaries, generated contract types, and the complete build-gate chain,
So that every subsequent story inherits i18n, theming, and contract safety mechanically instead of retrofitting them (FR-30, FR-33 foundation).

**Acceptance Criteria:**

**Given** the `app/` workspace
**When** the scaffold is created
**Then** Next.js 16.2.x is configured with `output: 'export'` and `images: { unoptimized: true }`, Tailwind 4.3.x + vendored shadcn components, and Archivo + Inter self-hosted via `next/font` with zero external requests (AR-11, AR-15)
**And** the full DESIGN.md token set is implemented: shadcn CSS-variable mapping (dark canonical `:root`/`.dark`, light variants), data-viz palette tokens, typography ramp with mandatory `tabular-nums` utilities, spacing/radii tokens, tonal elevation (UX-DR1, UX-DR2).

**Given** the i18n structure (AD-12)
**When** the locale layer is created
**Then** `locales/es.ts` (canonical) and `locales/en.ts` (type-mirrored — a missing key is a compile error) exist with the `t()` accessor, and `Intl`-based number/date formatting helpers (`es-CO`/`en`) are the only formatting path (FR-30, UX-DR19)
**And** the ESLint gate (`react/jsx-no-literals` with `noStrings` + attribute coverage for aria/title, plus `no-restricted-syntax` for metadata strings) fails the build on any hardcoded user-facing string.

**Given** the contract (AD-2)
**When** the build chain runs
**Then** TypeScript types + the `SCHEMA_VERSION` constant are generated from `/contract` (never hand-written mirrors), and `npm run build` = ESLint (`--max-warnings 0`) → typecheck → schema-version assert against every artifact read → `next build` on Node 24 (AR-13)
**And** the build copies `/data` (fixtures for now) into the export output and the site deploys to Netlify free tier as-is — no functions, middleware, env vars, or analytics (FR-33, NFR-8, NFR-9).

### Story 2.2: Site Chrome — Header, Language & Theme Toggles, Footer & 404

As Mariana or Diego,
I want a persistent header with language and theme controls, an attribution footer, and a helpful 404,
So that I can use the site in my language and theme from the very first page (FR-31).

**Acceptance Criteria:**

**Given** any route
**When** the page renders
**Then** the slim sticky site header shows wordmark → `/`, the header-search slot, the `ES | EN` segmented language toggle, and the theme toggle, in that order; the attribution footer renders the ruled es/en wording with the `/about` link, not dismissible (UX-DR4, UX-DR21).

**Given** a first-time visitor with no stored preference
**When** any page loads
**Then** first render is Spanish and the theme follows `prefers-color-scheme` (dark canonical)
**And** one inline head script sets `<html lang>` + locale class + theme class before first paint; the string swap runs once, post-hydration, with no hydration mismatch (AR-12, UX-DR3).

**Given** a visitor who toggles language or theme
**When** they reload or revisit
**Then** the choice persists via `wcstats.locale` / `wcstats.theme` behind try/catch with in-memory fallback (private-mode still works per session), the language toggle announces via a polite live region, and `<html lang>` updates (FR-31, AR-10).

**Given** an unknown URL
**When** it is requested
**Then** the static 404 renders "Esta página no existe. ¿Buscabas un partido?" with links home (UX-DR14).

### Story 2.3: Contract v1 Per-Surface Sign-Off

As the builder,
I want the v1 contract verified against every surface's concrete data needs,
So that Epic 1 can proceed past the sample set without breaking contract changes later (AD-14 gate).

**Acceptance Criteria:**

**Given** the fixtures and the v1 schemas
**When** the per-surface data-needs checklist is walked
**Then** each surface's fields are confirmed present and sufficient: Hero build-time fields (score, scorers+minutes, stage, `storyStats`), `<title>`/OG composition fields, search/typeahead entity fields in `tournament.json`, comparison fields for all three entity types, and every Tactical/Expert section's data slice
**And** each checklist item records pass or a filed contract-change request.

**Given** any gap found
**When** it is resolved
**Then** the change flows Epic 2 → request, Epic 1 → implement, with a logged decision, `schemaVersion` bump, and regenerated fixtures in the same commit
**And** sign-off is recorded in the document/repo before Epic 1 proceeds past extraction of the sample set.

### Story 2.4: Match Route & Hero Layer

As Mariana,
I want to open a shared match link and read the match's story in ~15 seconds on my phone,
So that I know what happened without paging through a PDF (FR-21, UJ-1).

**Acceptance Criteria:**

**Given** the route manifest in `tournament.json`
**When** the app builds
**Then** `/matches/{match-slug}` is pre-rendered for exactly the listed matches via `generateStaticParams` (filesystem reads at build time), each with meaningful `<title>`/OG meta (teams + score + stage) (AR-11, NFR-4, UX-DR22).

**Given** a 390px viewport
**When** the page loads
**Then** the pre-rendered Hero shows the scoreline (`display-score`, once per page), scorers with minutes, the stage-context chip, and the five Story Stats tiles within first-viewport-plus-one-scroll with zero horizontal scrolling — comprehensible in ~15 seconds (FR-21, SM-2, UX-DR18)
**And** the Hero contains exactly one sub-disclosure: the compact lineups/formations disclosure, with lineup player names linking to Player Profiles and header team names to Team Profiles (UX-DR22)
**And** own-goal scorers attribute to the benefiting team per AD-6, and knockout matches show the `decidedBy` result shape (ET/shootout).

**Given** the runtime data path
**When** the client loads the bundle
**Then** below-Hero regions show layout-shaped skeletons with `aria-busy` and a polite "Datos cargados." announcement; a fetch failure shows the inline retry panel with shell and nav usable (UX-DR14)
**And** the route loads only its own Match Bundle (FR-34).

### Story 2.5: Tactical Layer Shell, Key Statistics & Empty-State Pattern

As Diego,
I want the Tactical Layer's section scaffolding with the head-to-head Key Statistics block and a ruled empty-state pattern,
So that every tactical section has its place, its anchor, and an honest absence state (FR-22 foundation).

**Acceptance Criteria:**

**Given** the Match Dashboard
**When** the Tactical Layer renders
**Then** layer section shells exist for the full normative order (key-stats → momentum → shot-maps → pass-networks → offers-to-receive → movement-to-receive → defensive-actions → phases → pressing → set-plays → goalkeeping) each with its stable anchor; `≥lg` renders Tactical sections expanded, `<lg` renders header + one-line summary expanding in place with Accordion semantics (`aria-expanded`, focus to revealed heading); anchor navigation auto-expands; expansion lazy-mounts content (UX-DR6, UX-DR18)
**And** the layer-gap/section-gap rhythm from DESIGN.md separates layers and sections.

**Given** the Key Statistics section (`#key-stats`)
**When** it renders from Domain B data
**Then** head-to-head stat tiles show both teams' full Key Statistics block; the leading side carries the team accent **plus** the ▲ glyph and «líder»/"leader" in the accessible name — never color-only (UX-DR7, UX-DR11)
**And** at `<md` tiles render as a single column of paired tiles, compact enough that UJ-1's single scroll still reaches the momentum slot.

**Given** a section whose data is missing from the bundle
**When** it renders
**Then** the empty-state panel occupies the section's slot with the ruled copy ("Sin datos de {sección} para este partido…"), never silent absence or layout collapse (FR-22, UX-DR13).

### Story 2.6: Momentum Timeline

As Mariana,
I want the match's momentum arc right after the key stats,
So that one scroll shows me how the match swung (FR-22, UJ-1).

**Acceptance Criteria:**

**Given** a bundle with a momentum series
**When** `#momentum` renders
**Then** the recharts timeline shows team-accent area fills at 60% opacity around the reserved ink midline gutter, goal markers on the axis in the shot-goal token + ring (in tab order, announcing scorer + minute), and axis labels in tabular caption type (UX-DR8)
**And** the minute cursor is a `role="slider"` (`aria-valuemin/max`, `aria-valuetext` announcing minute + both teams' values), arrow keys move ±1 minute, and pointer users tap-to-position — no drag (UX-DR15).

**Given** `momentum: null`
**When** the section renders
**Then** the dedicated empty state shows "La línea de momentum no está disponible para este partido." with the header and anchor preserved (UX-DR13).

**Given** the data-table rule
**When** the user activates "Ver los datos"
**Then** the underlying series renders as a real `<table>` in place (NFR-2).

### Story 2.7: Pitch-Panel Infrastructure with Shot & Cross Maps

As Diego,
I want shot and cross maps at true source coordinates with full popover, keyboard, and data-table access,
So that I can study and screenshot every attempt exactly as the source recorded it (FR-24, UJ-2).

**Acceptance Criteria:**

**Given** the shared pitch-panel component
**When** any pitch viz renders
**Then** it draws the theme-invariant deep-green pitch (stripes, lines, hairline border on dark only, `rounded.lg`, internal padding), places events by `teamId` at true 0–100 coordinates with affine viewport transforms only — never rewriting stored values (AR-6)
**And** every panel carries its title, legend, the permanent in-panel attribution caption, and a "Ver los datos / View data" control opening the equivalent real `<table>` (UX-DR9, UX-DR21, NFR-2).

**Given** the shot map (`#shot-maps`)
**When** it renders
**Then** markers use the five-outcome encoding — color token AND shape dual-encoding (filled circle + ring / filled circle / hollow circle / filled square / hollow square) — sized by xG, with own goals excluded and shootout attempts never plotted (UX-DR10, AR-6)
**And** the rendered layout spot-check-matches the source PDF for the fixture match (SM-3).

> **FD-1 (Story 2.3 sign-off, 2026-07-23) amends the two xG mentions above:** per-shot xG does not exist in the source PDFs (`ShotEvent.expectedGoals` is `null` in contract v1 — team totals only), so markers render at UNIFORM size and the detail popover/event log OMITS the xG row while the field is `null`. The nullable slot stays as the forward-compatible landing zone. See `contract/README.md` → "Story 2.3 sign-off (v1)".

**Given** marker interaction
**When** a user taps, hovers, or focuses a marker
**Then** a detail popover shows player, minute, xG, outcome; hit areas partition by nearest marker (Voronoi) at ≥44px; colliding hit areas collapse to a cluster list popover with z-order cycling, Enter/arrow-key equivalence, and overlapping markers never displaced (UX-DR9, UX-DR15)
**And** the SVG is `aria-hidden` except focusable markers exposing localized name/role/value; the panel is a `role="figure"` with a localized one-sentence `aria-label`; arrow keys rove marker-to-marker ordered by minute (UX-DR16).

**Given** a `<md` viewport
**When** shot/cross maps render
**Then** one team shows at a time via team tabs on a vertical half-pitch (attacking goal up), positions unchanged, hit areas ≥44px (UX-DR17)
**And** the cross map renders with the same infrastructure from `CrossEvent` data.

### Story 2.8: Pass-Network Visualization

As Diego,
I want each team's passing network on the pitch with player-level isolation,
So that I can see structure and dependencies in each team's circulation (FR-22, FR-24).

**Acceptance Criteria:**

**Given** the pass-network section (`#pass-networks`)
**When** it renders
**Then** nodes sit at extracted `PassNetworkNode` positions (team accent, size = pass involvement) and edges use the five-stop edge-weight ramp dual-encoded with stroke width (UX-DR9)
**And** tap/focus on a node highlights that player's edges and dims the rest with the `focus-ring-on-pitch` selection ring and `aria-pressed`; Enter toggles isolation, second tap or Esc clears.

**Given** a `<md` viewport
**When** the network renders
**Then** team tabs show one vertical full pitch; edges below the lowest weight quintile are hidden by default behind the "Mostrar todos los pases" toggle — data one toggle away, never deleted (SM-C2, UX-DR17).

**Given** the data-table rule
**When** "Ver los datos" is activated
**Then** the full pass matrix renders as a sortable table (UX-DR16).

### Story 2.9: Receiving & Defensive-Action Maps (+ Heatmap Decision)

As Diego,
I want offers-to-receive, movement-to-receive, and defensive-action maps,
So that the full PMSR marker taxonomy — unavailable anywhere else — is visible (FR-22).

**Acceptance Criteria:**

**Given** the three sections (`#offers-to-receive`, `#movement-to-receive`, `#defensive-actions`)
**When** they render from `ReceivingEvent` / `DefensiveActionEvent` data
**Then** each reuses the pitch-panel infrastructure with team-accent markers shape-encoded per DESIGN (hollow diamond = offer, filled diamond = movement, filled triangle = defensive action) — team encoding only, never mixed with outcome encoding (UX-DR10)
**And** popovers, cluster handling, keyboard access, `<md` team-tab vertical pitch, and per-map event-log tables via "Ver los datos" all follow the established patterns (UX-DR9, UX-DR16, UX-DR17).

**Given** the deferred heatmap decision (spine Deferred list)
**When** this story is implemented
**Then** the match-heatmap question is evaluated against fixtures: if surfaced, it is client-derived from the bundle's Domain D events under AD-5's single-surface carve-out with the monotonic heat ramp and a zone-table alternative; if deferred, the decision and rationale are logged — no pipeline-emitted grid without an AD-14 change request.

### Story 2.10: Phases, Pressing & Blocks, Set Plays & Goalkeeping Sections

As Diego,
I want the remaining tactical sections — phases of play, pressing & defensive blocks, set plays, and goalkeeping,
So that the Tactical Layer covers every domain the PMSR offers (FR-22).

**Acceptance Criteria:**

**Given** Domain C data
**When** `#phases` and `#pressing` render
**Then** comparative recharts distributions show phases of play, line heights/team length (meters), and defensive-block distribution with team accents, direct series labels, and dashed/pattern Team B encoding — never hue-only (UX-DR11)
**And** exact percentages and values are reachable via each chart's data table.

**Given** Domain F data
**When** `#set-plays` renders
**Then** counts by type, side, and style display per team with locale-mapped category labels from enum codes (AR-7).

**Given** Domain E data
**When** `#goalkeeping` renders
**Then** each goalkeeper's involvement, distribution, goal prevention, and aerial control summary displays with the LatAm register labels (arquero, atajada) from the locale files (UX-DR19)
**And** all four sections show the ruled empty state when their data is absent (FR-22).

### Story 2.11: Expert Layer — Per-Player Tables & Event Logs

As Diego,
I want every per-player metric and full event log on the match page,
So that I can drill to complete depth without leaving the page (FR-23, UJ-2).

**Acceptance Criteria:**

**Given** the Expert Layer shell (`#expert`, EXPERTO/EXPERT pill)
**When** it is expanded (collapsed by default at all widths, expands in place)
**Then** per-player tables expose every Domain G field from the bundle — in-possession, out-of-possession, physical — with no "lite" versions (FR-23, SM-C2)
**And** full event logs render: shot log, cross log, pass matrix, receiving log, defensive-actions log — the same tables that serve as the viz data-table alternatives (UX-DR18).

**Given** the sortable data-table component
**When** any table renders
**Then** every column sorts client-side (click/Enter/Space, `aria-sort`, polite announcements), text sorts via `Intl.Collator('es', {sensitivity:'base'})`, default sort is stated, headers are sticky with `scroll-padding-top`, and sorting never loses row focus (UX-DR12)
**And** numeric cells right-align in tabular figures with `Intl` formatting per locale (UX-DR2, UX-DR19).

**Given** a `<md` viewport
**When** Expert tables render
**Then** column groups tab as En posesión / Sin posesión / Físico with a sticky player column and horizontal scroll inside the table container only — every field remains reachable (UX-DR17).

### Story 2.12: Tournament Hub — Results & Standings

As Mariana,
I want full results and standings by stage and group,
So that I can find any match and see how the tournament unfolded (FR-25, UJ-4 entry).

**Acceptance Criteria:**

**Given** `tournament.json`
**When** `/` renders
**Then** results and standings display by stage/group in artifact order with the pipeline's explicit `rank` rendered verbatim — no client-side recomputation (AR-5)
**And** all 104 matches are reachable from the results listing, every result row links to its Match Dashboard, and standings rows link to Team Profiles (UX-DR22).

**Given** result chips
**When** they render
**Then** each shows fill + letter (V/E/D es, W/D/L en) — never color-only — inside the linked row (UX-DR7 family, UX-DR19).

**Given** a `<md` viewport
**When** Hub tables render
**Then** fewer default columns show behind a "Más columnas" disclosure with sort still available on all columns via the sort menu (UX-DR17)
**And** the Hub loads only `tournament.json` + `leaderboards.json` within the combined 500 KB budget (FR-34).

### Story 2.13: Tournament Leaderboards

As Mariana,
I want sortable tournament leaderboards including physical metrics,
So that I can settle who was fastest in under a minute on my phone (FR-26, UJ-4).

**Acceptance Criteria:**

**Given** `leaderboards.json`
**When** the Líderes del torneo surface renders
**Then** team and player leaderboards display with top-3 teaser rows at hero altitude and full sortable tables beneath, values formatted per locale (`36,8 km/h`) (UX-DR18, UX-DR19)
**And** sorting and filtering are instant and client-side — zero network beyond the initially loaded index (FR-26).

**Given** metric labels
**When** they render
**Then** each metric code maps to its locale label with ruled abbreviations at narrow widths ("VEL. MÁX.") carrying the full term in tooltip and `aria-label` (UX-DR17, UX-DR19)
**And** every player row links to that Player Profile (UX-DR22).

### Story 2.14: Header Search

As Mariana or Diego,
I want to find any player, team, or match from the header,
So that navigation never requires knowing a URL (UX-DR5).

**Acceptance Criteria:**

**Given** the header search input
**When** the user types
**Then** a client-side typeahead over `tournament.json` entities (players, teams, matches) shows results with matched-substring highlight and entity-type labels, with accent/case-insensitive matching via `Intl.Collator('es', {sensitivity:'base'})` — no network beyond the already-loaded index.

**Given** combobox semantics
**When** the user navigates results
**Then** `role="combobox"` + listbox applies: arrow keys move the active option, Enter navigates to the entity route, Esc closes and returns focus; empty results show "Sin resultados para «{query}»." with a link to `/`.

**Given** a `<md` viewport
**When** search is invoked
**Then** the input collapses to an icon button opening a full-width sheet with identical semantics (UX-DR4).

### Story 2.15: Player Profile

As Diego,
I want any player's aggregated stats, physical profile, per-match series, and trends,
So that I can track a player across the whole tournament (FR-27).

**Acceptance Criteria:**

**Given** `player-profiles/{player-id}.json`
**When** `/players/{player-slug}` renders
**Then** headline aggregates lead (hero altitude), cross-match trend charts follow (recharts, `viz-single` series), and full per-match tables close (profile disclosure grammar) — all values verbatim from the artifact, aggregation never client-side (AR-5, UX-DR18)
**And** the physical profile shows speed zones 1–5, high-speed runs, sprints, and top speed.

**Given** per-match rows
**When** the user taps any value
**Then** it navigates to that Match Dashboard anchored to the relevant section, auto-expanding it (UX-DR22)
**And** a "Comparar" action deep-links `/compare?type=players&a={slug}` (FR-29 entry).

**Given** the build
**When** routes generate
**Then** every player in the route manifest pre-renders with name + team `<title>`/OG meta (NFR-4).

### Story 2.16: Team Profile

As Diego,
I want a team's tournament-wide tactical identity with per-match breakdowns,
So that I can read how a team actually plays before a final (FR-28, UJ-3).

**Acceptance Criteria:**

**Given** `team-profiles/{team-id}.json`
**When** `/teams/{team-slug}` renders
**Then** the tournament-wide identity displays: line heights, defensive-block distribution, pressing tendencies, phases of play, and formation usage, with per-match breakdown tables whose rows link to their Match Dashboards
**And** all values render verbatim from the artifact (AR-5), single-entity charts use `viz-single` (UX-DR11), form strings use result chips (UX-DR22).

**Given** entry points
**When** a user arrives from standings, a match header, or search
**Then** the route resolves for every manifest-listed team, pre-rendered with name + record `<title>`/OG meta (NFR-4)
**And** "Comparar equipo" deep-links `/compare?type=teams&a={slug}`.

### Story 2.17: Comparison Mode

As Diego,
I want two players, teams, or matches side by side with a shareable URL,
So that one composite view replaces manual notes across a dozen PDFs (FR-29, UJ-3).

**Acceptance Criteria:**

**Given** `/compare`
**When** the shell loads
**Then** the type selector (Jugadores/Equipos/Partidos) + two Command search-selects over the Tournament Index render; selections update `?type=&a=&b=` (URL is the only comparison state, AR-10) and fetch exactly the two entities' bundles/index slices (FR-34)
**And** a swap-sides control exchanges A/B.

**Given** two selected entities
**When** the comparison renders
**Then** mirrored stat rows share centered labels with entity-accent top-borders only; each side's precomputed values render verbatim — shared axis domains and leader-accent determination are the only client derivations, never displayed cross-entity numbers (AR-5, UX-DR23)
**And** vizzes render per entity with identical scales; at `<md` sections stack A above B with a sticky mini-header naming whose viz is on screen (UX-DR17).

**Given** partial or invalid params
**When** the page loads
**Then** the picker-first empty state ("Elige dos {…} para comparar."), single-column partial state, and invalid-slug state ("No encontramos {slug}…", valid side preserved, invalid param dropped) all behave per State Patterns (UX-DR14)
**And** a pasted comparison URL reproduces the same comparison (UJ-3 climax).

### Story 2.18: Glossary, About & Terminology Completion

As Mariana,
I want tactical terms explained in my language and the data source clearly stated,
So that the app teaches rather than intimidates, and every screenshot credits its source (FR-32, OQ-1, OQ-3).

**Acceptance Criteria:**

**Given** the locale files
**When** the terminology pass completes
**Then** every row of the EXPERIENCE.md per-term policy table is implemented verbatim (translate/jargon/tooltip decisions, abbreviations, stage names, result letters, positions, LatAm register), every tactical term has an explicit `es` entry with no raw-key fallthrough, and new terms discovered during content work get their own logged row (FR-32)
**And** the provisional terms (step-in → irrupción, offers-to-receive wording) are verified against the PMSR definitions and finalized.

**Given** the glossary tooltip component
**When** a marked term is tapped/hovered/focused
**Then** the definition popover opens (hoverable, persistent, Esc-dismissible per 1.4.13, Tab-reachable glossary link), shows the counterpart-language subtitle, and terms are marked once per section (UX-DR20)
**And** `/glossary` renders the full term list in both languages with `#term` anchors.

**Given** `/about`
**When** it renders
**Then** it carries the full attribution statement, methodology note (xG used as-is, never recomputed), and independence disclaimer per the ruled wording, linked from the footer on every route (UX-DR21, NFR-10).

### Story 2.19: Performance & Accessibility Hardening, Real-Data Swap & Launch

As the builder,
I want the budgets, accessibility floor, and real-artifact behavior verified end to end,
So that the product ships on the real dataset meeting every gate it promised (FR-34, SM-4, SM-5).

**Acceptance Criteria:**

**Given** the committed real `/data` from Story 1.19
**When** the app builds against it
**Then** all routes pre-render from the real route manifest, the schema-version assert passes, and spot-checked shot/cross maps match the source PDFs on ≥10 matches (SM-3).

**Given** the performance budgets
**When** measured on the production build
**Then** Lighthouse mobile ≥ 90 on Match Dashboard and Tournament Hub and every route's JSON payload respects the pipeline-measured 500 KB budgets — with density moved behind disclosure, never deleted, if tuning is needed (NFR-1, SM-C2).

**Given** the accessibility floor
**When** audited
**Then** WCAG 2.1 AA checks pass: every viz has its reachable data-table alternative, focus is visible everywhere (`focus-ring-on-pitch` on pitch in both themes), keyboard-only traversal completes every flow (UJ-1..4), `prefers-reduced-motion` disables all animation, 200% zoom holds the single-column Hero, reflow holds to 320px, and a Spanish screen-reader spot-check resolves the `lang="en"` span decisions (NFR-2, UX-DR16).

**Given** launch
**When** the site deploys
**Then** Netlify publishes `app/out` via the AD-13 chain at $0/month, the Netlify account bandwidth model is confirmed and logged (spine Deferred), and the repo + live URL are publishable as the portfolio piece (SM-4, SM-6).

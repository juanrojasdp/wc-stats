# Source extraction — PRD + addendum + project brief

Extracted 2026-07-21 by subagent for the UX fast-path run. Sources:

- `_bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md`
- `_bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md`
- `project-brief-wc2026-analytics.md`

## Product summary

A free, open, fully static web app that liberates FIFA's 2026 World Cup data — currently locked inside 104 dense ~52-page infographic PDFs (Post-Match Summary Reports, "PMSRs") — into clean, layered, accessible dashboards for every match, plus tournament-wide leaderboards, team tactical identities, and player profiles. One shared data model serves two audiences (casual fans and tactical analysts) through progressive disclosure. Built by a solo developer (Juan) as a passion/portfolio project; the tournament is complete so the dataset is frozen, a one-time Python pipeline precomputes everything to static JSON, and the app runs with zero backend and $0 infrastructure (Netlify free tier).

## Personas / audiences

- **Primary A — Casual fan** (persona name in journeys: **Mariana**, casual fan in Bogotá). Goals: score, scorers, and a handful of intuitive stats (possession, shots, xG, distance, top speed) "framed as a story," in seconds. **Mobile-first, low tolerance for density.** Reads in Spanish. Entry often via shared link on phone (bus, family dinner contexts).
- **Primary B — Tactical analyst / hobbyist** (persona name in journeys: **Diego**, tactics blogger). Goals: study how a team actually plays — line heights, pressing, phases, line breaks, passing networks, per-player event and physical data — and compare matches/teams/players across the tournament. **Wants and tolerates density.** Uses desktop; switches UI to English; screenshots visualizations and cites the app as source (social JTBD: "credible, source-grounded material I can cite in threads, blogs, and videos").
- **Builder (contextual)** — Juan: portfolio piece demonstrating data engineering, visualization, and football analytics craft (mostly non-UX; touches UJ-5).
- Both audiences are served by one layered UI (Hero → Tactical → Expert) over one shared data model. "Nobody gets a dumbed-down app and nobody gets an impenetrable one." No audience gets a separate app.
- **Non-users (v1):** bettors/fantasy players (need predictive/live data); professional club analysts (need Opta/StatsBomb-grade event feeds); users of other leagues/tournaments.

## Functional requirements relevant to UX

**Information architecture (Epic 2 preamble):** four top-level surfaces — Tournament Hub (home `[ASSUMPTION]`), Match Dashboard (one per match), Player Profile, Team Profile — plus Comparison Mode reachable from hub and profiles. Every surface is a pre-rendered static route; all interactivity (filtering, sorting, layer expansion, comparison, language) is client-side.

**Match Dashboard — Progressive Disclosure (§4.6).** Section order (from brief, restated in PRD): header (score, goals, lineups, formations) → head-to-head key stats → possession/momentum timeline → shot maps + xG → passing networks → phases-of-play comparison → pressing & defensive blocks → set plays.

- **FR-21 Hero Layer:** score, scorers with minutes, stage context, story stats (possession, shots, xG, distance, top speed) readable within ~15 seconds on mobile. Testable consequence: on a 390px-wide viewport, score/scorers/story stats render within the first viewport-and-one-scroll, no horizontal scrolling.
- **FR-22 Tactical Layer:** expand/scroll into Momentum Timeline, shot maps with xG, Pass Networks, Phases-of-Play comparison, pressing & Defensive Blocks, set plays. Missing-data sections must show an **explicit empty state, never a silent absence**.
- **FR-23 Expert Layer:** full per-player tables (in-possession, out-of-possession, physical) on the same page without leaving it; every Domain G field must be reachable on the match page.
- **FR-24 True-coordinate pitch visualizations:** shot maps, cross maps, Pass Networks render from true 0–100 pitch coordinates, not zone approximations; rendered shot map must visually match the source PDF's marker layout.

**Tournament Hub (§4.7).**

- **FR-25 Results & standings:** browse full results and standings by stage and group; navigate from any result to its Match Dashboard; all 104 matches reachable.
- **FR-26 Leaderboards:** view and client-side sort tournament leaderboards over team and player metrics (including physical metrics like top speed and sprints); sorting/filtering require no network requests beyond the initially loaded Tournament Index.

**Player Profile (§4.8).**

- **FR-27:** aggregated tournament stats, per-match series, physical profile (Speed Zones, high-speed runs, sprints, top speed), cross-match trend visualizations; navigate to the matches behind any per-match value.

**Team Profile (§4.9).**

- **FR-28:** tournament-wide tactical identity — Line Heights, Defensive Block distribution, pressing tendencies, Phases of Play, formation usage — with per-match breakdowns.

**Comparison Mode (§4.10).**

- **FR-29:** select two players, two teams, or two matches; view stats and key visualizations side by side, entirely client-side. Out of scope: 3+ entities, custom metric builders (Post-MVP).

**i18n (§4.11).**

- **FR-30:** all UI strings externalized to Locale files; no hardcoded user-facing strings (mechanically enforced).
- **FR-31:** Spanish default; toggle to English; choice persists client-side across visits `[ASSUMPTION: persistence is beyond brief]`.
- **FR-32:** per-term tactical-terminology policy (translate / keep English jargon / English + glossary tooltip) resolved term-by-term during UX/content work (OQ-1).

**Static delivery (§4.12).**

- **FR-33:** full Next.js static export, every match/player/team route pre-rendered, Netlify free tier.
- **FR-34:** each route loads only its needed artifacts (its Match Bundle or Tournament Index slice); all filtering/sorting/comparison client-side within §5 budgets.

**Pipeline FRs (FR-1..20, FR-35)** are Epic 1 (extraction) — mostly non-UX, but note: FR-35 momentum-timeline extraction feeds the App's FR-22 Momentum Timeline and its source page/data shape is unresolved (OQ-5); FR-18 caps every Match Bundle at ≤500 KB compressed, which bounds what a match page can show without splitting.

## Visualizations & data

**Named visualization types:**

- Shot maps with xG (true pitch coordinates), cross maps
- Pass Networks (player-to-player pass matrix rendered as a pitch graph; edges with player endpoints and volumes)
- Heatmaps (named in tech selections as a d3 pitch-based visualization)
- Momentum Timeline (possession/momentum over the course of the match — source PMSR page under investigation, OQ-5)
- Phases-of-play comparison; pressing & defensive-block visuals; head-to-head key stats; leaderboards (sortable tables); cross-match trend visualizations (Player Profile); side-by-side comparison views

**Libraries (from brief; architecture confirms, does not re-litigate):**

- **d3** for pitch-based visualizations (shot maps, pass networks, heatmaps)
- **recharts** for tabular/statistical charts
- Next.js (static export) + React; hosting on Netlify free tier

**Data model / granularity:**

- Spine: Tournament → Stage → Match → {Team, Player}, with `MatchTeamStats`, `MatchPlayerStats`, and event tables (`ShotEvent`, `CrossEvent`, `PassNetworkEdge`, `SetPlay`, `GoalkeeperStats`). Coordinates live in the event tables, normalized 0–100 full-pitch.
- Seven Data Domains per match (normative field inventory, addendum §6):
  - **A. Metadata & result:** teams, score, stage/group, venue, date, kickoff; lineups (starters + subs with number, position, goal/sub/card minutes); formations.
  - **B. Comparative team stats (Key Statistics block):** possession, xG, shots (on target), passes (complete) & completion %, line breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered.
  - **C. Tactical identity:** phases of play (in/out of possession %), line height & team length (in/out of possession, in meters), defensive blocks (high/mid/low).
  - **D. Spatial events:** shots (log + map), crosses (locations/zones/types), passing networks, offering to receive, movement to receive, defensive actions — with true pitch coordinates.
  - **E. Goalkeeping:** involvement timeline, distribution (feet/hands/throw), goal prevention (save %, intervention types), aerial control.
  - **F. Set plays:** free kicks, penalties, corners (by side/style), throw-ins.
  - **G. Individual player data:** in possession (passes, %, switches, line breaks, ball progressions, take-ons, step-ins, attempts, goals); out of possession (tackles, blocks, interceptions, pressing, duels, clearances, recoveries); physical (distance by speed zones 1–5, high-speed runs, sprints, top speed).
- Tournament Indices: results/standings by stage/group, leaderboards, aggregated Team Profiles and Player Profiles.
- Scale: a few thousand player rows, tens of thousands of pass edges tournament-wide — comfortably client-side as JSON. SQLite fallback is a contingency only.
- xG is FIFA's value used as-is, never recomputed.

**Static-site / no-backend constraint:** full static export; no backend, database, auth, server functions, or API routes; one JSON Match Bundle per match plus Tournament Index slices; each route loads only what it needs; all dynamism client-side; Netlify free tier is the only delivery path (100 GB/mo bandwidth is the only scaling ceiling; payload budgets are the mitigation).

## Non-functional constraints affecting UX

- **Performance:** Lighthouse mobile performance ≥ 90 on Match Dashboard and Tournament Hub; per-route JSON payload ≤ 500 KB compressed; Hero Layer content visible fast on mid-range mobile. `[ASSUMPTION: numbers are proposed defaults; architecture may tighten but not loosen without a logged decision.]`
- **Accessibility:** WCAG 2.1 AA intent — semantic structure, keyboard navigation, contrast, and text alternatives for data visualizations (at minimum, underlying data tables reachable for every chart). `[ASSUMPTION: AA as target; brief said only "accessible".]`
- **Responsive:** mobile-first for Hero Layer and Tournament Hub; Tactical/Expert Layers and Comparison may be desktop-optimized but must remain usable on mobile. Hero test viewport: 390px wide. No native mobile app — responsive web only.
- **Shareability/SEO:** every match, player, team has a stable, human-readable URL suitable for sharing; pages carry meaningful titles/meta for link previews (UJ-1 entry path is a shared link).
- **Browser support:** current evergreen browsers; no legacy burden.
- **Privacy:** no accounts, no auth, no PII; language preference persists client-side only; no analytics/telemetry in MVP `[ASSUMPTION]`.
- **Counter-metric SM-C2 (Depth preservation):** never delete analyst-facing depth to improve readability/performance scores — density belongs behind Progressive Disclosure, not removed.
- Offline: not specified in sources.

## i18n / language

- **Two independent language axes — do not conflate:** project language (docs, code, artifacts) is English; **user-facing UI defaults to Spanish with a persistent toggle to English** (`es` default, `en` at MVP).
- i18n is a UI-copy axis only: source data (team, player, venue names) arrives from the PDFs in English and is displayed as-is.
- All UI strings externalized to Locale files from day one — "retrofitting is a known failure mode" (FR-30); violations caught mechanically.
- Toggle persistence: cross-visit, client-side storage (FR-31; `[ASSUMPTION]` beyond brief's default + toggle).
- **Open question OQ-1 — tactical-terminology translation policy:** for each specialized term (examples given: "line breaks", "build up", "counter-press"), decide per-term whether to translate to Spanish, keep as accepted English jargon, or show English with a glossary/tooltip. Resolved term-by-term in the `es` Locale files during the UX/content pass; owner Juan. FR-32's testable consequence: every tactical term has an explicit `es` entry — no fallthrough to raw keys or silent English defaults.
- Persona alignment: Mariana reads in Spanish on mobile; Diego switches to English to match his blog's terminology.

## Branding / visual identity hints

- No colors, mood boards, tone guidelines, or visual references are stated for the App itself. Not specified in sources beyond the following adjacent facts:
  - PMSR source-PDF marker colors (extraction keys, not app branding): green=goal, light blue=on target, amber=off target, purple=blocked, dark blue=incomplete.
  - Descriptive adjectives for the product: "clean, layered, accessible dashboards"; differentiation is "completeness, cross-match aggregation, and polish."
  - IP constraint: data is FIFA-sourced; MVP displays data **free with attribution**; a visible attribution/data-source statement is required (wording and placement TBD in the UX pass — OQ-3). No selling of data in MVP; no statements about FIFA marks/logos usage beyond the ToU-review gate (OQ-2).

## Journeys / scenarios

(Quoted persona names verbatim; from PRD §2.3.)

- **UJ-1. "Mariana catches up on last night's match from her phone."** Casual fan in Bogotá, half-watched the match, opens match page from a shared link on the bus. Hero Layer fills her viewport: score, scorers with minutes, story stats — in Spanish, readable in under ~15 seconds. One scroll shows the momentum timeline; she gets the arc and closes the tab satisfied. **Edge case:** a match she doesn't remember — the header's stage/group context (e.g. "Octavos de final") orients her immediately.
- **UJ-2. "Diego dissects a knockout match for his tactics blog."** Desktop; scrolls past Hero into Tactical Layer (shot maps with xG, passing networks, phases-of-play, pressing/defensive-block data); expands Expert Layer for per-player tables (line breaks by player, speed-zone distances, duels). Switches UI to English, screenshots two visualizations, cites the app. Value lands on finding a number (opponent's mid-block share) unavailable anywhere else short of the PDF.
- **UJ-3. "Diego compares two teams' tactical identity before a final."** Opens Comparison mode, picks both finalists as teams, reads tournament-wide identities side by side: line heights, block distribution, pressing tendencies, formation usage. Climax: one composite view replacing manual notes across a dozen PDFs.
- **UJ-4. "Mariana settles a family argument about who was fastest."** Opens Tournament Hub leaderboards, sorts by top speed, shows the phone around the table. Resolution in under a minute, in Spanish, on mobile.
- **UJ-5. "Juan re-runs the pipeline after a parser fix."** (Builder journey, non-UX: idempotent pipeline re-run.)

## Open questions & explicit notes for UX

- **OQ-1** — Tactical-terminology translation policy (per-term: translate / keep English jargon / tooltip-glossary) for the Spanish Locale. Owner: Juan, **during the UX/content pass**; resolved in Locale files (FR-32).
- **OQ-3** — Attribution wording & placement: what the data-source statement says and where it lives. **Owner: UX pass.** (Requirement is presence, not copy — §6.2 `[ASSUMPTION]`.)
- **OQ-5** — Momentum timeline source: which PMSR page/domain feeds the possession/momentum timeline and its extraction shape is unconfirmed. UX impact: the Momentum Timeline (FR-22, first-scroll element in UJ-1) has an unresolved data shape; FR-35 exists so the gap can't be silently dropped, and a Match Bundle may be flagged if the series is missing (empty-state case).
- **OQ-2** (FIFA ToU review, gates monetization) and **OQ-4** (player-identity edge cases — accents, duplicate names, squad-number changes) are owned by Juan/architecture, not UX, but OQ-4 may surface in how player names display/disambiguate.
- Explicit empty-state requirement (FR-22): any Tactical section with missing data shows an explicit empty state, never a silent absence.
- `[NOTE FOR PM]` (not UX): tactical-similarity search is the most differentiating Post-MVP item; revisit as v2 anchor.

## Anything else UX-load-bearing

- **Progressive Disclosure is the core design pattern and a named contract:** Hero → Tactical → Expert on one page, one data model; drilling to full depth happens **without leaving the page** (FR-23, UJ-2). Counter-metrics SM-C1/SM-C2 forbid trading away either correctness or analyst depth for polish/readability scores.
- **Success metrics with direct UX acceptance criteria:** SM-2 Hero readability (~15 s on mobile, informal hallway tests); SM-3 positional fidelity (rendered maps spot-check-match source PDFs on ≥10 matches); SM-5 performance budgets.
- **The 500 KB compressed per-route payload budget (FR-18/FR-34)** constrains how much a single match page can carry — exceeding it forces a deliberate split or budget decision, which is a UX/IA decision point.
- **Navigation cross-links are required, not optional:** results → Match Dashboard (FR-25); Player Profile per-match values → the matches behind them (FR-27); Comparison Mode reachable from hub and profiles.
- **Entities/scale for IA:** 104 matches, group + knockout stages ("Octavos de final" example), a few thousand players, 48-team-era teams; stage/group context belongs in the match header (UJ-1 edge case).
- **Overlapping markers** (e.g., shots in the six-yard box) are expected in source data — fine for positions; a rendering consideration for shot maps.
- **Out of scope for UX to design around:** no accounts/saved views/social features, no live data, no 3+ entity comparison, no custom metric builders, no monetization surfaces in MVP (nothing may assume monetization).
- Glossary (§3 of PRD) provides canonical vocabulary the UX spec should reuse: Hero/Tactical/Expert Layer, Story Stats, Momentum Timeline, Comparison Mode, Locale, Pitch Coordinates, Phases of Play, Line Break, Defensive Block, Line Height/Team Length, Pass Network, Speed Zones, xG.

---
title: World Cup 2026 Match Analytics Dashboard
status: final
created: 2026-07-21
updated: 2026-07-21
---

# PRD: World Cup 2026 Match Analytics Dashboard

## 0. Document Purpose

This PRD is for the solo builder (Juan) and the downstream BMad workflow owners (UX, architecture, epics & stories). It is seeded from `project-brief-wc2026-analytics.md`, which includes validated spike findings; this document builds on that brief and does not duplicate its technical appendices — implementation-level detail extracted from the brief lives in `addendum.md` alongside this file. Vocabulary is anchored in the Glossary (§3); features are grouped under two deliberately decoupled epics with globally numbered FRs; inferences made without confirmation are tagged inline as `[ASSUMPTION]` and indexed in §11. The competitive-landscape statements in §1 come not from the brief but from a web research pass conducted 2026-07-21 (digest logged in this run's memlog); they are point-in-time observations. Project artifacts, including this document and all code, are in English; the product's user-facing language is a separate axis (Spanish default — see FR-30..32).

## 1. Vision

FIFA publishes an extraordinarily rich dataset for every 2026 World Cup match — possession phases, line breaks, pressing intensity, line heights, per-player physical data, and the true pitch coordinates of shots, crosses, and passes — but locks it inside 104 dense, ~52-page infographic PDFs (the Post-Match Summary Reports, or PMSRs). The data is technically public and practically unusable: unreadable on mobile, unsearchable, and impossible to compare across matches, teams, or players.

This project turns that frozen dataset into a free, open, fully static web app: clean, layered, accessible dashboards for every match, plus a tournament-wide view — leaderboards, team tactical identities, and player profiles aggregated across all 104 matches. Adjacent projects surface fragments of this data (scraped per-player feeds, physical-data leaderboards, parsing toolkits), but no product — FIFA's own included — offers the full PMSR tactical taxonomy (phases of play, line heights in meters, block distribution, line breaks, offers to receive) tournament-wide and interactively; mainstream stats platforms stop at conventional event stats. The differentiation is completeness, cross-match aggregation, and polish, not mere access. Because the tournament is complete, a one-time Python pipeline extracts and precomputes everything to static JSON, and the app runs with zero backend and zero infrastructure cost.

One shared data model serves two audiences through progressive disclosure: a casual fan reads a match's story in seconds on their phone; a tactical analyst drills into phases of play, pressing structures, and per-player physical data without leaving the page. Nobody gets a dumbed-down app and nobody gets an impenetrable one.

## 2. Target User

### 2.1 Jobs To Be Done

- **Casual fan (functional):** "Tell me what happened in this match — score, scorers, and the story in a few intuitive numbers — on my phone, in seconds."
- **Tactical analyst / hobbyist (functional):** "Let me study how a team actually plays — line heights, pressing, phases, line breaks — and compare matches, teams, and players across the tournament."
- **Analyst (social):** "Give me credible, source-grounded material I can cite in threads, blogs, and videos."
- **Builder (contextual):** "Produce a portfolio piece that demonstrates data engineering, visualization, and football analytics craft end to end."

### 2.2 Non-Users (v1)

- Bettors and fantasy players needing predictive or live data — the dataset is historical and frozen.
- Professional club analysts needing raw event feeds (Opta/StatsBomb-grade granularity) — this is bounded by what the PMSR contains.
- Users of leagues or tournaments other than the 2026 World Cup.

### 2.3 Key User Journeys

- **UJ-1. Mariana catches up on last night's match from her phone.**
  Mariana, a casual fan in Bogotá, half-watched the match at a family dinner. On the bus she opens the match page from a shared link. The Hero Layer fills her viewport: score, scorers with minutes, and a handful of story stats (possession, shots, xG, distance, top speed) — in Spanish, readable in under ~15 seconds. She scrolls once, sees the momentum timeline, gets the arc of the match, and closes the tab satisfied. **Edge case:** the link is to a match she doesn't remember; the header's stage/group context (e.g. "Octavos de final") orients her immediately.

- **UJ-2. Diego dissects a knockout match for his tactics blog.**
  Diego, a hobbyist analyst, opens the same match page on desktop. He scrolls past the Hero Layer into the Tactical Layer: shot maps with xG, passing networks, phases-of-play comparison, pressing and defensive-block data. He expands the Expert Layer for per-player tables — line breaks by player, speed-zone distances, duels. He switches the UI to English to match his blog's terminology, screenshots two visualizations, and cites the app as source. Value lands when he finds a number (opponent's mid-block share) he could not have gotten anywhere else short of paging through the PDF.

- **UJ-3. Diego compares two teams' tactical identity before a final.**
  Before writing a final preview, Diego opens Comparison mode, picks both finalists as teams, and reads their tournament-wide identities side by side: line heights, block distribution, pressing tendencies, formation usage. The climax is one composite view replacing what previously required manual notes across a dozen PDFs.

- **UJ-4. Mariana settles a family argument about who was fastest.**
  Someone claims a fullback was "the fastest player in the tournament." Mariana opens the Tournament Hub leaderboards, sorts by top speed, and shows the phone around the table. Resolution in under a minute, in Spanish, on mobile.

- **UJ-5. Juan re-runs the pipeline after a parser fix.** *(builder journey, lighter)*
  Juan fixes a marker-parser edge case and re-runs the batch; the pipeline is idempotent, re-extracts affected reports, re-validates all 104, and regenerates artifacts without manual cleanup.

## 3. Glossary

- **PMSR** — Post-Match Summary Report: FIFA's per-match infographic PDF (~52 pages; header falsely claims 8). The sole data source. 104 exist; the set is frozen.
- **Data Domain** — one of the 7 extraction categories inventoried in the brief (A: metadata & result, B: comparative team stats, C: tactical identity, D: spatial events, E: goalkeeping, F: set plays, G: individual player data).
- **Match Bundle** — the per-match static JSON artifact the Pipeline produces and the App consumes; contains all extracted domains for one match.
- **Tournament Index** — precomputed cross-match JSON artifacts: results, standings, leaderboards, and aggregated Team Profile / Player Profile data.
- **Pipeline** — the offline Python extraction & precompute system (Epic 1). Runs locally, one-time batch, idempotent.
- **App** — the static Next.js/React web application (Epic 2). Consumes Match Bundles and Tournament Indices; no backend.
- **Spatial Event** — an event with true pitch coordinates extracted from vector primitives: shots, crosses, pass-network edges, defensive actions, offers/movements to receive.
- **Marker** — a vector glyph on a PMSR pitch map representing one Spatial Event; per-page-type shape/size, color-coded by outcome.
- **Pitch Coordinates** — Marker positions normalized to a 0–100 full-pitch frame (against the full pitch rectangle, which extends beyond the visible clip).
- **Marker–Event Linking** — matching a Marker to its tabular event row (time, player, body part, xG) via digit-glyph proximity; gates all spatial joins.
- **Self-Validation** — the per-report correctness check: exact match of extracted Marker count against the tabular attempts table, plus a 100% Marker–Event Linking rate. Binary pass/fail; no tolerance bands.
- **Story Stats** — the Hero Layer's small intuitive stat set: possession, shots, xG, distance covered, top speed.
- **Momentum Timeline** — the match-course visualization of possession/momentum over time on the Match Dashboard; source PMSR page under investigation (OQ-5).
- **Text-Anchored Discovery** — locating target PDF pages by whitespace-normalized text search, never by page index.
- **Hero Layer** — the top disclosure layer of a match dashboard: score, scorers, story stats; readable in ~15 seconds, mobile-first.
- **Tactical Layer** — the middle disclosure layer: timelines, shot maps, passing networks, phases of play, pressing/blocks, set plays.
- **Expert Layer** — the deepest disclosure layer: full per-player event and physical tables.
- **Progressive Disclosure** — the layered UI pattern (Hero → Tactical → Expert) serving both audiences from one data model on one page.
- **Phases of Play** — PMSR in/out-of-possession phase percentages (Data Domain C).
- **Line Break** — a PMSR-defined pass or carry beating an opposition line; appears in team and player stats.
- **Defensive Block** — PMSR classification of defensive shape height: high / mid / low.
- **Line Height / Team Length** — PMSR measurements in meters, in and out of possession.
- **Pass Network** — the player-to-player pass matrix rendered as a pitch graph.
- **Speed Zones** — PMSR physical bands 1–5 for distance covered; with high-speed runs, sprints, and top speed they form a player's physical profile.
- **xG** — expected goals as provided by FIFA in the PMSR; used as-is, never recomputed.
- **Locale** — an externalized UI-copy file per language; `es` (default) and `en` at MVP.
- **Comparison Mode** — the App surface rendering two players, two teams, or two matches side by side.

## 4. Features

Features are grouped under the two decoupled epics. The contract between them is the artifact set (Match Bundles + Tournament Indices + schema); the App never depends on the Pipeline's internals, and the Pipeline knows nothing about rendering.

---

### Epic 1 — Extraction & Precompute Pipeline (Python, offline)

### 4.1 Report Ingestion & Page Discovery

**Description:** The Pipeline takes a local directory of 104 PMSR PDFs and orchestrates per-report extraction. Page targeting is by Text-Anchored Discovery — the spike proved page indices are unusable (headers claim 8 pages; reports run ~52 with section-divider cards and no assumable order). Runs are idempotent for dev convenience (realizes UJ-5). `[ASSUMPTION: all 104 PDFs are already in Juan's possession or trivially downloadable; acquiring them is not a Pipeline feature.]`

**Functional Requirements:**

#### FR-1: Batch ingestion with run manifest
The Pipeline can process all PMSR PDFs found in a configured input directory in one batch run, producing a run manifest recording per-report status (extracted / failed / skipped-unchanged).

**Consequences (testable):**
- A full run over 104 PDFs terminates with a manifest listing exactly 104 entries, each with a terminal status.
- Re-running without input or code changes performs no redundant re-extraction and produces byte-identical artifacts. `[ASSUMPTION: idempotence is implemented as content-hash or timestamp change detection — mechanism is architecture's call.]` `[ASSUMPTION: byte-identical determinism is adopted as an engineering standard beyond the brief's "idempotent"; relax deliberately if a dependency makes it costly.]`

#### FR-2: Text-anchored page discovery
The Pipeline locates every target page by whitespace-normalized text search on section titles/anchors, never by page index.

**Consequences (testable):**
- Given a report with shuffled or offset page order, target pages are still found.
- A missing anchor fails loud with the report ID and anchor text; it is never silently skipped.

### 4.2 Tabular Extraction (Data Domains A, B, C, E, F, G)

**Description:** Extracts all non-spatial domains from tabular regions: metadata & result, comparative team stats, tactical identity, goalkeeping, set plays, and individual player data (including the physical profile). The full field inventory per domain is reproduced in `addendum.md` §6 and is normative for coverage — FR-3..8 are testable against that inventory, not against a summary.

**Functional Requirements:**

#### FR-3: Metadata & result extraction (Domain A)
The Pipeline extracts teams, score, stage/group, venue, date, kickoff, lineups (starters + substitutes with number, position, and goal/sub/card minutes), and formations for every match.

**Consequences (testable):**
- Every Match Bundle contains a complete Domain A record; any missing field fails validation for that report.

#### FR-4: Comparative team stats extraction (Domain B)
The Pipeline extracts the full Key Statistics block per team per match (possession, xG, shots and on-target, passes/completion, Line Breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered).

**Consequences (testable):**
- Both teams' Domain B records are present and numeric-typed; a value that fails to parse as its expected type fails loud.

#### FR-5: Tactical identity extraction (Domain C)
The Pipeline extracts Phases of Play percentages, Line Height / Team Length in meters (in and out of possession), and Defensive Block distribution (high/mid/low) per team per match.

**Consequences (testable):**
- Both teams' Domain C records are present per match; meter values are numeric, and Defensive Block percentages per team sum to ~100%.

#### FR-6: Goalkeeping extraction (Domain E)
The Pipeline extracts goalkeeper involvement timeline, distribution (feet/hands/throw), goal prevention (save %, intervention types), and aerial control per goalkeeper per match.

**Consequences (testable):**
- Every goalkeeper with minutes in Domain A has a Domain E record; distribution category counts are internally consistent (categories sum to total distributions).

#### FR-7: Set-play extraction (Domain F)
The Pipeline extracts free kicks, penalties, corners (by side and style), and throw-ins per team per match.

**Consequences (testable):**
- Both teams' Domain F records are present per match; corner counts by side sum to the team's total corners.

#### FR-8: Individual player data extraction (Domain G)
The Pipeline extracts per-player in-possession, out-of-possession, and physical data (distance by Speed Zones 1–5, high-speed runs, sprints, top speed) for every player with minutes in every match.

**Consequences (testable):**
- Player rows join to Domain A lineups by a stable player identity; an unmatched player row fails loud. `[ASSUMPTION: player names are consistent within a report; cross-report identity resolution is handled in precompute (FR-19) and may need normalization (accents, name order).]`

#### FR-35: Momentum-timeline extraction
The Pipeline extracts the time-series data feeding the Momentum Timeline (possession/momentum over the course of the match). The exact source page and data shape are under investigation (OQ-5); this FR exists so the App-side FR-22 has an Epic 1 counterpart and the gap cannot be silently dropped.

**Consequences (testable):**
- Every Match Bundle contains a momentum/possession time series covering the full match duration, or the report is flagged in the manifest with the reason.

### 4.3 Spatial Extraction (Data Domain D)

**Description:** Extracts Spatial Events from vector pitch maps — the technically hardest and highest-value part of the Pipeline, validated GREEN by the spike. Marker parsing is a family of per-page-type parsers (shots, crosses, defensive pressure, offers/movement to receive) sharing a core recipe; the exact geometry, filter chain, and RGB keys are recorded in `addendum.md` and are binding for architecture.

**Functional Requirements:**

#### FR-9: Pitch-frame detection & coordinate normalization
The Pipeline detects the pitch frame on each map page (largest sub-page rectangle) and normalizes Marker positions against the full pitch rectangle to true 0–100 Pitch Coordinates.

**Consequences (testable):**
- Spike ground truth reproduces: known sample goals land inside/at the edge of the box when re-rendered from extracted coordinates.

#### FR-10: Per-page-type marker parsing
The Pipeline parses Markers on each supported map type (shots, crosses, defensive pressure, offers/movement to receive) with per-type shape/size tuning, applying legend-row exclusion so legend glyphs are never counted as events.

**Consequences (testable):**
- On the spike's reference report, the shots parser finds exactly 16 markers with the known 2/2/8/3/1 outcome distribution.
- Legend rows (horizontal rows of circles with ≥4 distinct legend colors at identical y) are excluded on every map type.

#### FR-11: Exact-RGB outcome mapping with assert-on-unknown
The Pipeline maps Marker colors to outcomes by exact RGB key and fails loud on any unknown color — never silently dropping a Marker.

**Consequences (testable):**
- An injected off-palette marker color aborts that report's extraction with the RGB value and page in the error.
- The known dark-blue collision (table-header rectangles reuse the "incomplete" color) does not produce false Markers, because circle-geometry checks remain in the filter chain.

#### FR-12: Marker–event linking
The Pipeline links each shot Marker to its tabular event row (time, player, body part, xG) by matching digit glyphs near the Marker. This is the hardest extraction sub-task and gates all spatial joins; it is scheduled early (see the ordering note in §8.1).

**Consequences (testable):**
- Every linked shot exposes time, player, and xG.
- An unlinked Marker is never dropped: it is retained with coordinates and outcome, flagged in the run manifest, and fails that report's Self-Validation (see FR-14 — the link-rate requirement is 100%; any report below it is a documented failure, per SM-C1 never resolved by loosening the check).

#### FR-13: Passing-network extraction
The Pipeline extracts the player-to-player pass matrix per team per match as Pass Network edges with player endpoints and volumes.

**Consequences (testable):**
- Every edge references two players present in that team's Domain A lineup; edge volumes are positive integers.

### 4.4 Validation & Run QA

**Description:** Correctness is designed in, not asserted after the fact. Every report carries a free correctness signal (Self-Validation), the batch produces an auditable run report, and template consistency is verified early because a silent mid-tournament template revision is the project's top extraction risk.

**Functional Requirements:**

#### FR-14: Per-report Self-Validation
The Pipeline runs Self-Validation for every report — exact shot-Marker count match against the tabular attempts table, plus a 100% Marker–event link rate (FR-12) — and records binary pass/fail in the manifest. No tolerance bands.

**Consequences (testable):**
- A count mismatch or any unlinked Marker marks the report failed with the specifics (both counts / unlinked-marker list) in the manifest; the batch continues to other reports.

#### FR-15: Early template-consistency verification
The Pipeline supports a verification mode that runs extraction + Self-Validation on a sampled subset and reports template deviations before the full batch is trusted. The sample is the union of two covers: at least one report from every venue, and at least one from every matchday round; one report may satisfy both covers.

**Consequences (testable):**
- The sample run outputs a per-report deviation summary (missing anchors, unknown colors, count mismatches) sufficient to localize a template revision to a venue or matchday.

#### FR-16: Batch run report
The Pipeline emits a batch summary covering per-report status, Self-Validation results, warnings (unlinked Markers, near-miss parses), and aggregate counts.

**Consequences (testable):**
- From the summary alone, a reader can identify every failed report and the reason for its failure without opening logs or artifacts.

### 4.5 Precompute & Artifact Generation

**Description:** Normalizes extraction output into the data-model spine (Tournament → Stage → Match → {Team, Player} with event tables; detail in `addendum.md`) and emits the static artifact set that is the entire contract with the App. JSON-first; a bundled read-only SQLite fallback exists as a documented contingency, not an MVP deliverable.

**Functional Requirements:**

#### FR-17: Normalized data model
The Pipeline normalizes all extracted domains into the spine with stable IDs for matches, teams, and players, resolving player identity across all 104 matches.

**Consequences (testable):**
- A player appearing in N matches has exactly one player ID; per-match rows and aggregates reference it consistently.

#### FR-18: Per-match Bundle generation
The Pipeline generates one Match Bundle (JSON) per match containing all seven domains.

**Consequences (testable):**
- Every Match Bundle compresses to within the §5 per-route payload budget (≤ 500 KB); a bundle exceeding it fails the build, forcing a deliberate split or budget decision.

#### FR-19: Tournament Index generation
The Pipeline precomputes Tournament Indices: results and standings by stage/group, leaderboards over team and player stats, aggregated Team Profiles (tactical identity across matches: line heights, blocks, pressing tendencies, formation usage), and aggregated Player Profiles (totals, per-match series, physical profile, cross-match trends).

**Consequences (testable):**
- Every leaderboard value is reproducible from the underlying Match Bundles (precompute adds no data the bundles don't contain).

#### FR-20: Versioned artifact schema
Artifacts carry a schema version, and the schema is documented machine-readably as the Pipeline↔App contract.

**Consequences (testable):**
- The App can detect a schema-version mismatch at build time and fail the build rather than render wrong data.

---

### Epic 2 — Static Web App (Next.js/React)

**Information architecture:** four top-level surfaces — Tournament Hub (home), Match Dashboard (one per match), Player Profile, Team Profile — plus Comparison Mode reachable from hub and profiles. Every surface is a pre-rendered static route; all interactivity (filtering, sorting, layer expansion, comparison, language) is client-side. `[ASSUMPTION: Tournament Hub is the home page; the brief implies but does not state it.]`

### 4.6 Match Dashboard with Progressive Disclosure

**Description:** One page per match serving both audiences through Progressive Disclosure: Hero Layer answers "what happened" in ~15 seconds (realizes UJ-1); Tactical and Expert Layers deliver full depth on the same page with no navigation away (realizes UJ-2). Section order follows the brief: header (score, goals, lineups, formations) → head-to-head key stats → possession/momentum timeline → shot maps + xG → passing networks → phases-of-play comparison → pressing & defensive blocks → set plays.

**Functional Requirements:**

#### FR-21: Hero Layer
A visitor can read a match's story — score, scorers with minutes, stage context, and a small set of story stats (possession, shots, xG, distance, top speed) — within ~15 seconds on a mobile viewport. Realizes UJ-1.

**Consequences (testable):**
- On a 390px-wide viewport, score, scorers, and story stats render within the first viewport-and-one-scroll without horizontal scrolling.

#### FR-22: Tactical Layer
A visitor can expand or scroll into the Tactical Layer: Momentum Timeline (fed by FR-35), shot maps with xG, Pass Networks, Phases-of-Play comparison, pressing & Defensive Blocks, and set plays. Realizes UJ-2.

**Consequences (testable):**
- Every listed section renders when its data exists in the Match Bundle; a section with missing data shows an explicit empty state, never a silent absence.

#### FR-23: Expert Layer
A visitor can drill into full per-player tables (in-possession, out-of-possession, physical) for the match without leaving the page. Realizes UJ-2.

**Consequences (testable):**
- Every Domain G field extracted by FR-8 is reachable on the match page.

#### FR-24: True-coordinate pitch visualizations
Shot maps, cross maps, and Pass Networks render from Pitch Coordinates — true positions, not zone approximations.

**Consequences (testable):**
- A rendered shot map visually matches the source PDF's marker layout for spot-checked matches.

### 4.7 Tournament Hub

**Description:** The tournament-wide view that doesn't exist anywhere else: results, standings, and aggregated leaderboards over all 104 matches. Realizes UJ-4.

**Functional Requirements:**

#### FR-25: Results & standings
A visitor can browse full results and standings by stage and group, and navigate from any result to its Match Dashboard.

**Consequences (testable):**
- All 104 matches are reachable from the results listing; every group's standings are consistent with its listed results.

#### FR-26: Leaderboards
A visitor can view and client-side sort tournament leaderboards over team and player metrics (including physical metrics such as top speed and sprints). Realizes UJ-4.

**Consequences (testable):**
- Sorting and filtering require no network requests beyond the initially loaded Tournament Index.

### 4.8 Player Profile

**Description:** One page per player: aggregated tournament stats, per-match series, physical profile (Speed Zones, high-speed runs, sprints, top speed), and cross-match trends.

**Functional Requirements:**

#### FR-27: Player Profile page
A visitor can view any player's aggregated and per-match data, physical profile, and cross-match trend visualizations, and navigate to the matches behind any per-match value.

**Consequences (testable):**
- Aggregated values equal the correct aggregation (sum, max, or average as appropriate per metric) of that player's per-match values across their Match Bundles.

### 4.9 Team Profile

**Description:** One page per team: tactical identity across the tournament — the analyst-facing aggregation of Domain C plus pressing tendencies and formation usage. Realizes UJ-3.

**Functional Requirements:**

#### FR-28: Team Profile page
A visitor can view a team's tournament-wide tactical identity: Line Heights, Defensive Block distribution, pressing tendencies, Phases of Play, and formation usage, with per-match breakdowns.

**Consequences (testable):**
- Every profile value is reproducible from that team's Match Bundles (mirrors FR-19's precompute guarantee on the rendering side).

### 4.10 Comparison Mode

**Description:** Side-by-side comparison of two players, two teams, or two matches — the analyst's cross-match tooling. Realizes UJ-3.

**Functional Requirements:**

#### FR-29: Two-entity comparison
A visitor can select two players, two teams, or two matches and view their stats and key visualizations side by side, entirely client-side.

**Consequences (testable):**
- Any two entities of the same type are selectable; rendering the comparison requires no artifacts beyond the two entities' bundles/index slices.

**Out of Scope:**
- Three-plus-entity comparison; custom metric builders (Post-MVP).

### 4.11 Internationalization (Spanish default, English toggle)

**Description:** The App's user-facing language defaults to Spanish with a persistent toggle to English. This is a UI-copy axis only: source data (team, player, venue names) arrives from the PDFs in English and is displayed as-is; code and artifacts stay in English. i18n is structural from day one — retrofitting is a known failure mode.

**Functional Requirements:**

#### FR-30: Externalized UI copy
All user-facing UI strings live in Locale files; no hardcoded user-facing strings anywhere in the App.

**Consequences (testable):**
- A build-time or lint check fails on hardcoded user-facing strings. `[ASSUMPTION: enforcement mechanism (lint rule vs. i18n-library convention) is architecture's call; the requirement is that violations are caught mechanically, not by review.]`

#### FR-31: Language default & toggle
The App renders in Spanish by default; a visitor can switch to English and the choice persists client-side across visits. `[ASSUMPTION: cross-visit persistence (client storage) is an addition beyond the brief, which specifies only default + toggle.]`

**Consequences (testable):**
- With no stored preference, first render is Spanish; after toggling to English, a page reload renders English.

#### FR-32: Tactical-terminology policy
Each specialized tactical term (e.g. "line breaks", "build up", "counter-press") carries a per-term decision in the Locale files: translated, kept as English jargon, or English with a glossary tooltip. The policy is a UI-copy decision resolved term-by-term during UX/content work (Open Question OQ-1), not a blanket rule.

**Consequences (testable):**
- Every tactical term in the term list has an explicit entry in the `es` Locale — no fallthrough to a raw key or silent English default outside the per-term decisions.

### 4.12 Static Delivery & Client-Side Interactivity

**Description:** The App is a full static export deployed on Netlify's free tier: no backend, no database, no auth, no server-side rendering at request time. All dynamism is client-side over the static artifact set.

**Functional Requirements:**

#### FR-33: Full static export
The App builds to a fully static site (Next.js static export) with every match, player, and team route pre-rendered, deployable on Netlify free tier as-is.

**Consequences (testable):**
- The production build contains no server functions, API routes, or runtime environment dependencies.

#### FR-34: Client-side data loading within budget
Each route loads only the artifacts it needs (its Match Bundle or the relevant Tournament Index slice), and all filtering/sorting/comparison runs client-side within the performance budgets in §5.

## 5. Cross-Cutting NFRs

- **Performance budgets:** Hero Layer content visible fast on mid-range mobile — Lighthouse mobile performance ≥ 90 on Match Dashboard and Tournament Hub; per-route JSON payload ≤ 500 KB compressed. `[ASSUMPTION: concrete numbers proposed here as defaults; architecture may tighten but not loosen without a logged decision.]`
- **Accessibility:** WCAG 2.1 AA intent — semantic structure, keyboard navigation, contrast, and text alternatives for data visualizations (at minimum, underlying data tables reachable for every chart). `[ASSUMPTION: AA as target; brief says "accessible" without a standard.]`
- **Responsive:** mobile-first for Hero Layer and Hub; Tactical/Expert Layers and Comparison may be desktop-optimized but must remain usable on mobile.
- **Shareability:** every match, player, and team has a stable, human-readable URL suitable for sharing (UJ-1 entry path); pages carry meaningful titles/meta for link previews.
- **Browser support:** current evergreen browsers; no legacy support burden.
- **Pipeline reproducibility:** given the same PDFs and code, artifacts are deterministic; the full batch is re-runnable end-to-end on a developer machine.
- **Language discipline:** code, comments, artifacts, and BMad documents in English; user-facing copy only via Locales (FR-30).

## 6. Constraints and Guardrails

### 6.1 Cost
- **Passion project: free to users, $0 infrastructure budget.** Netlify free tier, static only. No paid services anywhere in the delivery path. Any feature that requires a backend is out of scope by construction.
- Netlify free-tier bandwidth (100 GB/mo) is the only scaling ceiling; payload budgets (§5) are the mitigation. `[ASSUMPTION: expected traffic fits free tier; no mitigation plan needed at MVP.]`

### 6.2 IP / Licensing
- Data originates from FIFA's public PMSR PDFs. MVP displays data free with attribution — the safer ground per the brief's risk analysis. No selling of data or derived datasets in MVP.
- Any Post-MVP monetization (data pack, tips) is **gated on a FIFA Terms-of-Use review** (OQ-2). Nothing in the MVP architecture may assume monetization.
- The App carries a visible attribution/data-source statement. `[ASSUMPTION: wording TBD during UX; requirement is presence, not copy.]`

### 6.3 Privacy
- No accounts, no auth, no PII collected. Language preference persists client-side only (FR-31).
- No analytics/telemetry in MVP. `[ASSUMPTION: brief is silent; privacy-respecting analytics could be added later without architectural impact.]`

## 7. Non-Goals (Explicit)

Carried verbatim in intent from the brief's deliberate out-of-scope list — do not reintroduce:

- **No live or progressive ingestion, no scheduling.** The tournament is complete; the Pipeline is a one-time batch (idempotent re-runs are a dev convenience, not an ingestion feature).
- **No production backend, database, or authentication.** Structurally excluded — the $0 static architecture (§6.1) is built on their absence, so reintroducing them is an architecture change, not a feature request.
- **No user accounts, saved views, or social features** (v1 exclusion; would require revisiting the no-backend constraint).
- **No native mobile app.** Responsive web only (v1 exclusion).
- **No predictive modeling and no xG recomputation.** FIFA's provided values are displayed as-is.
- **No monetization features in MVP.** Deferred Post-MVP and gated on OQ-2.
- **Not a general football-analytics platform.** One tournament, one frozen dataset, one source format.

## 8. MVP Scope

### 8.1 In Scope

- **Epic 1:** Pipeline covering all 7 Data Domains, tabular and spatial (FR-1..16, FR-35), plus precompute and the versioned artifact set (FR-17..20).
- **Epic 2:** Match Dashboard with all three disclosure layers (FR-21..24), Tournament Hub (FR-25..26), Player Profile (FR-27), Team Profile (FR-28), Comparison Mode (FR-29), i18n es/en (FR-30..32), static delivery (FR-33..34).
- **Ordering note (de-risking):** the first implementation tasks after kickoff are FR-15 (template-consistency sample run) and FR-12 (Marker–event linking), because they carry the two highest technical risks and gate everything spatial.

### 8.2 Out of Scope for MVP

- **Downloadable data pack** (Gumroad/Lemon Squeezy) — Post-MVP, gated on OQ-2.
- **Tip jar / GitHub Sponsors** — Post-MVP; trivial to add, no reason to gate MVP on it.
- **Custom composite metrics & tactical-similarity search** — Post-MVP analytics depth. `[NOTE FOR PM: tactical-similarity search is the most differentiating Post-MVP item; revisit as v2 anchor.]`
- **SQLite fallback artifact** — contingency only; build if client-side JSON demonstrably fails on cross-cutting queries (decision recorded in addendum).
- Everything in §7 Non-Goals — structural exclusions hold by construction; v1 exclusions hold absent a deliberate future scope decision.

## 9. Success Metrics

**Primary**
- **SM-1: Extraction completeness** — 104/104 matches extracted with Self-Validation passing. Target: 100%, with any residual failures individually documented and explained. Validates FR-1..16.
- **SM-2: Hero readability** — a first-time visitor gets score, scorers, and story on mobile in ~15 seconds (proxy: FR-21's viewport consequence + informal hallway tests). Validates FR-21.
- **SM-3: Positional fidelity** — rendered shot/cross maps spot-check-match the source PDFs on a sample of ≥10 matches. Validates FR-9..12, FR-24.
- **SM-4: Zero cost** — $0/month infrastructure at launch and after. Validates FR-33.

**Secondary**
- **SM-5: Performance budget adherence** — Lighthouse mobile ≥ 90 on Hub and Match Dashboard; payloads within §5 budgets. Validates FR-34.
- **SM-6: Portfolio outcome** — the project is publishable as a portfolio piece (public repo + live URL + write-up). Validates the builder JTBD; intentionally informal.

**Counter-metrics (do not optimize)**
- **SM-C1: Validation integrity** — never weaken Self-Validation (exact marker-count match, 100% link rate) or extraction asserts to reach SM-1's 100%. A documented failure beats a silently wrong extraction. Counterbalances SM-1.
- **SM-C2: Depth preservation** — never delete analyst-facing depth to improve SM-2/SM-5; density belongs behind Progressive Disclosure, not removed. Counterbalances SM-2, SM-5.

## 10. Open Questions

1. **OQ-1 — Tactical-terminology translation policy:** per-term decision (translate / keep English jargon / tooltip-glossary) for the Spanish Locale. Owner: Juan, during UX/content pass; resolved in Locale files (FR-32).
2. **OQ-2 — FIFA Terms-of-Use review:** required before any Post-MVP monetization; also confirms the free-with-attribution posture. Owner: Juan; revisit before any data-pack work. *(Not legal advice.)*
3. **OQ-3 — Attribution wording & placement:** what the data-source statement says and where it lives (§6.2). Owner: UX pass.
4. **OQ-4 — Player identity edge cases:** how cross-report name normalization handles accents, duplicate names, and squad-number changes (FR-17). Owner: architecture/data-model design.
5. **OQ-5 — Momentum timeline source:** confirm which PMSR page/domain feeds the possession/momentum timeline (it spans Domains B/C) and its extraction shape. Owner: first extraction spike on Domain B/C pages.

## 11. Assumptions Index

- §1 — Competitive-landscape statements are point-in-time (research pass, 2026-07-21), not brief-sourced.
- §4.1 — All 104 PMSR PDFs are in hand; acquisition is not a feature.
- §4.1 (FR-1) — Idempotence mechanism (hashing vs. timestamps) left to architecture.
- §4.1 (FR-1) — Byte-identical determinism adopted as an engineering standard beyond the brief's "idempotent".
- §4.2 (FR-8) — Player names consistent within a report; cross-report normalization handled in precompute (see OQ-4).
- Epic 2 preamble — Tournament Hub is the home page.
- §4.11 (FR-30) — Hardcoded-string enforcement mechanism left to architecture; mechanical enforcement is the requirement.
- §4.11 (FR-31) — Cross-visit language persistence is an addition beyond the brief's default + toggle.
- §5 — Performance numbers (Lighthouse ≥ 90, ≤ 500 KB/route) proposed as defaults, not user-confirmed.
- §5 — WCAG 2.1 AA as the accessibility target.
- §6.1 — Expected traffic fits Netlify free tier without mitigation.
- §6.2 — Attribution statement wording deferred to UX (OQ-3).
- §6.3 — No analytics/telemetry in MVP.

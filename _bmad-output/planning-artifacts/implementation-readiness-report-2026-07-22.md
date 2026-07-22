---
stepsCompleted: [step-01-document-discovery, step-02-prd-analysis, step-03-epic-coverage-validation, step-04-ux-alignment, step-05-epic-quality-review, step-06-final-assessment]
documentsIncluded:
  - _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md
  - _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md
  - _bmad-output/planning-artifacts/epics.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-22
**Project:** wc-stats

## Document Inventory

| Document Type | File | Size | Last Modified |
|---|---|---|---|
| PRD | `prds/prd-wc-stats-2026-07-21/prd.md` | 38.5 KB | 2026-07-21 |
| PRD Addendum | `prds/prd-wc-stats-2026-07-21/addendum.md` | 6.1 KB | 2026-07-21 |
| Architecture | `architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md` | 27.6 KB | 2026-07-21 |
| UX Design | `ux-designs/ux-wc-stats-2026-07-21/DESIGN.md` | 27.9 KB | 2026-07-21 |
| UX Experience | `ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md` | 42.4 KB | 2026-07-21 |
| Epics & Stories | `epics.md` | 80.2 KB | 2026-07-22 |

**Duplicates:** None — each document type exists in exactly one authoritative version. Review/reconcile working files present in artifact folders are not assessment inputs.

**Missing documents:** None — all four required document types are present.

**Assessment focus areas (per user):** JSON artifact schema as sole contract between epics; normalized 0–100 coordinate model flowing from architecture into extraction stories; i18n (es default / en toggle) in both UX and early Epic 2 stories; template-validation de-risking story sequenced early in Epic 1.

## PRD Analysis

PRD is globally numbered FR-1..FR-35 (FR-35 lives in §4.2 as the Epic 1 counterpart to FR-22's Momentum Timeline). Epic 1 = Pipeline (FR-1..20, FR-35); Epic 2 = App (FR-21..34).

### Functional Requirements

**Epic 1 — Extraction & Precompute Pipeline (Python, offline)**

- **FR-1: Batch ingestion with run manifest** — Process all PMSR PDFs in a configured input directory in one batch run, producing a run manifest recording per-report status (extracted / failed / skipped-unchanged). Idempotent re-runs; byte-identical artifacts.
- **FR-2: Text-anchored page discovery** — Locate every target page by whitespace-normalized text search on section titles/anchors, never by page index. Missing anchor fails loud with report ID and anchor text.
- **FR-3: Metadata & result extraction (Domain A)** — Teams, score, stage/group, venue, date, kickoff, lineups (starters + substitutes with number, position, goal/sub/card minutes), and formations for every match.
- **FR-4: Comparative team stats extraction (Domain B)** — Full Key Statistics block per team per match (possession, xG, shots and on-target, passes/completion, Line Breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered).
- **FR-5: Tactical identity extraction (Domain C)** — Phases of Play percentages, Line Height / Team Length in meters (in and out of possession), Defensive Block distribution (high/mid/low) per team per match.
- **FR-6: Goalkeeping extraction (Domain E)** — Goalkeeper involvement timeline, distribution (feet/hands/throw), goal prevention (save %, intervention types), aerial control per goalkeeper per match.
- **FR-7: Set-play extraction (Domain F)** — Free kicks, penalties, corners (by side and style), throw-ins per team per match.
- **FR-8: Individual player data extraction (Domain G)** — Per-player in-possession, out-of-possession, and physical data (distance by Speed Zones 1–5, high-speed runs, sprints, top speed) for every player with minutes in every match; rows join to Domain A lineups by stable player identity.
- **FR-9: Pitch-frame detection & coordinate normalization** — Detect pitch frame on each map page (largest sub-page rectangle) and normalize Marker positions against the full pitch rectangle to true 0–100 Pitch Coordinates.
- **FR-10: Per-page-type marker parsing** — Parse Markers on each supported map type (shots, crosses, defensive pressure, offers/movement to receive) with per-type shape/size tuning, applying legend-row exclusion.
- **FR-11: Exact-RGB outcome mapping with assert-on-unknown** — Map Marker colors to outcomes by exact RGB key; fail loud on any unknown color, never silently dropping a Marker; circle-geometry checks guard the known dark-blue collision.
- **FR-12: Marker–event linking** — Link each shot Marker to its tabular event row (time, player, body part, xG) by digit-glyph proximity. Hardest sub-task; gates all spatial joins; scheduled early (§8.1). Unlinked Markers retained + flagged, never dropped; any unlinked Marker fails Self-Validation.
- **FR-13: Passing-network extraction** — Player-to-player pass matrix per team per match as Pass Network edges with player endpoints and volumes; edges reference Domain A lineup players.
- **FR-14: Per-report Self-Validation** — Exact shot-Marker count match against tabular attempts table + 100% Marker–event link rate; binary pass/fail in manifest; no tolerance bands.
- **FR-15: Early template-consistency verification** — Verification mode running extraction + Self-Validation on a sampled subset (≥1 report per venue AND ≥1 per matchday round) reporting template deviations before the full batch is trusted.
- **FR-16: Batch run report** — Batch summary covering per-report status, Self-Validation results, warnings, aggregate counts; failures identifiable from summary alone.
- **FR-17: Normalized data model** — Normalize all extracted domains into the spine (Tournament → Stage → Match → {Team, Player}) with stable IDs for matches, teams, players; player identity resolved across all 104 matches.
- **FR-18: Per-match Bundle generation** — One Match Bundle (JSON) per match containing all seven domains; compresses to ≤ 500 KB or fails the build.
- **FR-19: Tournament Index generation** — Precompute results/standings by stage/group, leaderboards, aggregated Team Profiles, aggregated Player Profiles; every value reproducible from Match Bundles.
- **FR-20: Versioned artifact schema** — Artifacts carry a schema version; schema documented machine-readably as the Pipeline↔App contract; App detects mismatch at build time and fails build.
- **FR-35: Momentum-timeline extraction** — Extract the time-series feeding the Momentum Timeline (possession/momentum over the match). Source page/shape under investigation (OQ-5); exists so App-side FR-22 has an Epic 1 counterpart; missing series flagged in manifest with reason.

**Epic 2 — Static Web App (Next.js/React)**

- **FR-21: Hero Layer** — Score, scorers with minutes, stage context, story stats (possession, shots, xG, distance, top speed) readable in ~15 seconds on a 390px mobile viewport within first viewport-and-one-scroll. Realizes UJ-1.
- **FR-22: Tactical Layer** — Momentum Timeline (fed by FR-35), shot maps with xG, Pass Networks, Phases-of-Play comparison, pressing & Defensive Blocks, set plays; missing data shows explicit empty state. Realizes UJ-2.
- **FR-23: Expert Layer** — Full per-player tables (in-possession, out-of-possession, physical) for the match without leaving the page; every Domain G field reachable. Realizes UJ-2.
- **FR-24: True-coordinate pitch visualizations** — Shot maps, cross maps, Pass Networks render from Pitch Coordinates (true positions, not zone approximations); visually match source PDF for spot-checked matches.
- **FR-25: Results & standings** — Browse full results and standings by stage and group; navigate from any result to its Match Dashboard; all 104 matches reachable.
- **FR-26: Leaderboards** — View and client-side sort tournament leaderboards over team and player metrics (incl. physical); no network requests beyond initially loaded Tournament Index. Realizes UJ-4.
- **FR-27: Player Profile page** — Aggregated + per-match data, physical profile, cross-match trend visualizations; navigate to matches behind any per-match value; aggregates equal correct aggregation of per-match values.
- **FR-28: Team Profile page** — Tournament-wide tactical identity: Line Heights, Defensive Block distribution, pressing tendencies, Phases of Play, formation usage, with per-match breakdowns. Realizes UJ-3.
- **FR-29: Two-entity comparison** — Select two players, two teams, or two matches; view stats and key visualizations side by side, entirely client-side. Out of scope: 3+ entities, custom metric builders.
- **FR-30: Externalized UI copy** — All user-facing UI strings in Locale files; no hardcoded user-facing strings; violations caught mechanically (build-time or lint check).
- **FR-31: Language default & toggle** — Spanish by default; visitor can switch to English; choice persists client-side across visits.
- **FR-32: Tactical-terminology policy** — Each specialized tactical term carries a per-term decision in Locale files (translated / English jargon / tooltip-glossary); every term has an explicit `es` entry, no fallthrough.
- **FR-33: Full static export** — Fully static site (Next.js static export), every match/player/team route pre-rendered, deployable on Netlify free tier; no server functions, API routes, or runtime env dependencies.
- **FR-34: Client-side data loading within budget** — Each route loads only the artifacts it needs; all filtering/sorting/comparison client-side within §5 performance budgets.

**Total FRs: 35** (FR-1..FR-35, globally numbered across both epics)

### Non-Functional Requirements

PRD §5 states NFRs as named bullets (not numbered); numbered here for traceability:

- **NFR-1 (Performance):** Lighthouse mobile performance ≥ 90 on Match Dashboard and Tournament Hub; per-route JSON payload ≤ 500 KB compressed; Hero Layer content visible fast on mid-range mobile. Architecture may tighten but not loosen without a logged decision.
- **NFR-2 (Accessibility):** WCAG 2.1 AA intent — semantic structure, keyboard navigation, contrast, text alternatives for data visualizations (at minimum, underlying data tables reachable for every chart).
- **NFR-3 (Responsive):** Mobile-first for Hero Layer and Hub; Tactical/Expert Layers and Comparison may be desktop-optimized but must remain usable on mobile.
- **NFR-4 (Shareability):** Every match, player, and team has a stable, human-readable URL; pages carry meaningful titles/meta for link previews.
- **NFR-5 (Browser support):** Current evergreen browsers only.
- **NFR-6 (Pipeline reproducibility):** Same PDFs + code → deterministic artifacts; full batch re-runnable end-to-end on a developer machine.
- **NFR-7 (Language discipline):** Code, comments, artifacts, BMad documents in English; user-facing copy only via Locales.

### Additional Requirements & Constraints

- **Cost (§6.1):** $0 infrastructure; Netlify free tier, static only; features requiring a backend are out of scope by construction; 100 GB/mo bandwidth ceiling mitigated by payload budgets.
- **IP/Licensing (§6.2):** Free with attribution; visible attribution/data-source statement required (wording TBD, OQ-3); monetization gated on FIFA ToU review (OQ-2).
- **Privacy (§6.3):** No accounts, no auth, no PII; language preference client-side only; no analytics/telemetry in MVP.
- **Non-Goals (§7):** No live ingestion/scheduling; no backend/DB/auth; no accounts/saved views/social; no native app; no predictive modeling or xG recomputation; no MVP monetization; not a general football-analytics platform.
- **MVP ordering note (§8.1):** First implementation tasks after kickoff are FR-15 (template-consistency sample run) and FR-12 (Marker–event linking) — the two highest technical risks, gating everything spatial.
- **Addendum bindings:** Spike findings (marker geometry, RGB keys, filter chain, full-rect normalization) binding for architecture; tech selections (Python/pymupdf/pdfplumber; Next.js/React/d3/recharts; Netlify) confirmed-not-relitigated; Domain field inventory (addendum §6) is normative for FR-3..8, FR-10, FR-13 coverage testing.
- **Open Questions:** OQ-1 terminology policy (→ FR-32, UX/content pass); OQ-2 FIFA ToU (Post-MVP gate); OQ-3 attribution wording (UX); OQ-4 player identity edge cases (→ FR-17, architecture); OQ-5 momentum timeline source (→ FR-35, first Domain B/C spike).

### PRD Completeness Assessment

Strong PRD: globally numbered FRs each with testable consequences; NFRs concrete and measurable; explicit non-goals, counter-metrics (SM-C1, SM-C2), an assumptions index, and open questions each with an owner and a landing FR. The two-epic decoupling with the artifact set as sole contract is stated explicitly in §4 preamble and reinforced by FR-20. Notable structural care: FR-35 exists purely to prevent the FR-22 momentum-timeline dependency from being silently dropped, and the §8.1 ordering note pre-sequences the two de-risking tasks (FR-15, FR-12). No unnumbered or orphan requirements found.

## Epic Coverage Validation

The epics document carries its own Requirements Inventory (all 35 FRs restated with architecture/UX enrichment), an explicit FR Coverage Map, and 10 NFRs (PRD's 7 plus NFR-8 Cost, NFR-9 Privacy, NFR-10 Attribution — promotions of PRD §6 constraints, correctly traceable). Coverage was verified independently story-by-story, not just against the epics' own claim.

### Coverage Matrix

| FR | Requirement (short) | Epic Coverage | Status |
|---|---|---|---|
| FR-1 | Batch ingestion + run manifest, idempotent | Epic 1 — Story 1.2 | ✓ Covered |
| FR-2 | Text-anchored page discovery | Epic 1 — Story 1.2 | ✓ Covered |
| FR-3 | Domain A extraction | Epic 1 — Story 1.6 | ✓ Covered |
| FR-4 | Domain B extraction | Epic 1 — Story 1.7 | ✓ Covered |
| FR-5 | Domain C extraction | Epic 1 — Story 1.7 | ✓ Covered |
| FR-6 | Domain E extraction | Epic 1 — Story 1.9 | ✓ Covered |
| FR-7 | Domain F extraction | Epic 1 — Story 1.9 | ✓ Covered |
| FR-8 | Domain G extraction | Epic 1 — Story 1.10 | ✓ Covered |
| FR-9 | Pitch-frame detection & 0–100 normalization | Epic 1 — Story 1.3 | ✓ Covered |
| FR-10 | Per-page-type marker parser family | Epic 1 — Stories 1.3, 1.11, 1.12, 1.13 | ✓ Covered |
| FR-11 | Exact-RGB mapping, assert-on-unknown | Epic 1 — Story 1.3 (semantics reused 1.11–1.13) | ✓ Covered |
| FR-12 | Marker–event linking | Epic 1 — Story 1.5 | ✓ Covered |
| FR-13 | Passing-network extraction | Epic 1 — Story 1.14 | ✓ Covered |
| FR-14 | Per-report Self-Validation | Epic 1 — Story 1.3 (count) + 1.5 (link rate, complete) | ✓ Covered |
| FR-15 | Early template-consistency verification | Epic 1 — Story 1.4 (+ re-run gate in 1.5–1.14 ACs) | ✓ Covered |
| FR-16 | Batch run report | Epic 1 — Story 1.19 | ✓ Covered |
| FR-17 | Normalized data model, stable IDs | Epic 1 — Story 1.15 | ✓ Covered |
| FR-18 | Match Bundle generation + budget | Epic 1 — Story 1.16 | ✓ Covered |
| FR-19 | Tournament Index generation | Epic 1 — Stories 1.17, 1.18 | ✓ Covered |
| FR-20 | Versioned artifact schema | Epic 1 — Stories 1.1, 1.16 (App-side assert: 2.1) | ✓ Covered |
| FR-35 | Momentum-timeline extraction | Epic 1 — Story 1.8 | ✓ Covered |
| FR-21 | Hero Layer | Epic 2 — Story 2.4 | ✓ Covered |
| FR-22 | Tactical Layer | Epic 2 — Stories 2.5, 2.6, 2.7, 2.8, 2.9, 2.10 | ✓ Covered |
| FR-23 | Expert Layer | Epic 2 — Story 2.11 | ✓ Covered |
| FR-24 | True-coordinate pitch visualizations | Epic 2 — Stories 2.7, 2.8 | ✓ Covered |
| FR-25 | Results & standings | Epic 2 — Story 2.12 | ✓ Covered |
| FR-26 | Leaderboards | Epic 2 — Story 2.13 | ✓ Covered |
| FR-27 | Player Profile page | Epic 2 — Story 2.15 | ✓ Covered |
| FR-28 | Team Profile page | Epic 2 — Story 2.16 | ✓ Covered |
| FR-29 | Two-entity comparison | Epic 2 — Story 2.17 | ✓ Covered |
| FR-30 | Externalized UI copy, mechanical enforcement | Epic 2 — Story 2.1 | ✓ Covered |
| FR-31 | Language default & toggle | Epic 2 — Story 2.2 | ✓ Covered |
| FR-32 | Tactical-terminology policy | Epic 2 — Story 2.18 (structure from 2.1) | ✓ Covered |
| FR-33 | Full static export | Epic 2 — Stories 2.1, 2.19 | ✓ Covered |
| FR-34 | Client-side data loading within budget | Epic 2 — Stories 2.4, 2.12, 2.17, 2.19 | ✓ Covered |

### Missing Requirements

**None.** Every PRD FR traces to at least one story with acceptance criteria that operationalize the FR's testable consequences.

**Scope present in epics but not in PRD FRs (checked in reverse direction):**
- Story 2.14 Header Search (UX-DR5) — explicitly logged in the UX requirements list as a "scope addition beyond PRD FRs." Deliberate, sourced from UX contract, not scope creep.
- Story 2.3 Contract v1 Per-Surface Sign-Off — process story implementing architecture AD-14's gate; no PRD FR maps to it by design.
- Story 2.19 includes theme system (dark/light) from UX-DR3 — beyond PRD (PRD mentions only language persistence) but traceable to the UX contract and covered by epics NFR-9 wording ("language/theme preference client-side only").

### Coverage Statistics

- Total PRD FRs: 35
- FRs covered in epics: 35
- Coverage: **100%** (35/35)
- Reverse-direction check: 3 epic-level additions, all deliberately logged and traceable to UX/architecture contracts — no unexplained scope.

## UX Alignment Assessment

### UX Document Status

**Found** — two-part UX contract: `DESIGN.md` (visual identity: tokens, palette, typography, components) + `EXPERIENCE.md` (behavior: IA, component patterns, state patterns, interaction primitives, accessibility floor, key flows, progressive disclosure contract, i18n & terminology). Both `status: final`, both listing the PRD + addendum as sources.

### UX ↔ PRD Alignment

- **Full FR traceability:** EXPERIENCE.md closes with an explicit traceability table mapping every App FR (FR-21..34) to the sections that specify it. Verified accurate on spot-checks (FR-21 → Progressive Disclosure Contract + UJ-1; FR-31 → language toggle + Locale bootstrap; FR-24 → Visualization Layering + pitch panel).
- **User journeys:** UJ-1..UJ-4 each have a Key Flow with climax and failure paths matching the PRD's journey narratives; UJ-5 (pipeline) is explicitly and correctly excluded as having no App surface.
- **Open questions owned by UX are resolved:** OQ-1 (terminology) → full per-term policy table with rationale per row; OQ-3 (attribution) → concrete es/en wording and three-point placement (footer, in-panel caption, /about).
- **i18n (focus area):** es default / en toggle fully specified — Locale bootstrap mechanism, `wcstats.locale` persistence with try/catch fallback, `<html lang>` pre-paint script, per-term policy, es-CO formatting conventions, and honest logged consequences (Spanish-only SEO/share cards, post-hydration string swap flash).
- **UX additions beyond PRD, all logged as assumptions:** header search, theme system (dark canonical/light), comparison URL scheme, single-tree i18n (no `/en/` routes), slug formats, sticky header. Each is flagged `[ASSUMPTION]` inline — the PRD's discipline of tagging inferences carries through.
- **PRD §4.6 section-order deviation, logged:** EXPERIENCE inserts the three Domain D marker maps (offers/movement/defensive actions) after Pass Networks and appends goalkeeping — both flagged as logged decisions with payload-budget justification (data already ships in bundles per FR-10). The epics (Story 2.5) follow the EXPERIENCE order, so the chain is consistent.

### UX ↔ Architecture Alignment

- **Architecture consumed UX as a source:** the spine's frontmatter lists both UX files, and the alignment is structural, not incidental — AD-10 encodes the UX state rules (`wcstats.locale`/`wcstats.theme` keys, try/catch fallback verbatim from EXPERIENCE); AD-11 encodes the pre-rendered-Hero contract and self-hosted fonts (Archivo + Inter from DESIGN); AD-12 encodes the locale bootstrap head-script and per-term policy table by reference.
- **Coordinate model (focus area):** AD-6's 0–100 full-pitch frame with explicit `teamId` directly supports UX pitch-panel behavior — the App renders coordinates as-is, and the UX mobile vertical half-pitch is covered by AD-6's explicit affine-transform allowance. No re-normalization ambiguity anywhere in the chain.
- **Hero 15-second test supported:** AD-4's contracted per-team `storyStats` block exists specifically so AD-11 can pre-render the Hero at build time — architecture provides exactly what the UX acceptance test needs.
- **Empty states supported:** AD-4's required `momentum` key (series or `null`, never omitted) maps 1:1 to the UX dedicated momentum empty state.
- **Performance budgets consistent and sharpened:** UX states ≤500 KB/route and Lighthouse ≥90; architecture pins measurement (gzip -9 over canonical bytes, measured by Pipeline) and closes the Hub loophole (tournament.json + leaderboards.json combined ≤ 500 KB, since the Hub loads both).
- **Header search supported:** client-side typeahead over `tournament.json` entities; architecture covers field sufficiency via the AD-14 per-surface sign-off checklist (search/typeahead fields explicitly listed).
- **Accessibility floor supported:** the data-table-per-viz rule appears in the architecture's Consistency Conventions as the text alternative of record.

### Alignment Issues

No blocking misalignments. Two minor, non-blocking observations:

1. **Netlify bandwidth assumption drift (informational):** PRD §6.1 assumes 100 GB/mo free-tier bandwidth; architecture AD-13 notes new accounts are credit-based (~15 GB/mo effective) and documents portable fallbacks (Cloudflare Pages/GitHub Pages) plus a deploy-time account-model check (spine Deferred, picked up by Story 2.19). Handled — but the PRD assumption is now known-stale.
2. **FR-31 persistence nuance:** PRD requires cross-visit persistence; UX's private-mode fallback is session-only (in-memory). This is a deliberate, logged graceful degradation when storage is unavailable, not a gap.

### Warnings

None. UX documentation is present, final, complete for all user-facing FRs, and demonstrably consumed by both the architecture and the epics.

## Epic Quality Review

Standards applied: user-value epics (no technical milestones), epic independence (Epic N never requires Epic N+1), no forward story dependencies, adequate sizing, testable Given/When/Then ACs, greenfield setup coverage.

### Epic Structure

**Epic 1 — "Complete Tournament Dataset":** The user is the builder/operator (Juan), which is legitimate here, not a disguised technical milestone: the PRD names the builder as an audience (JTBD §2.1, UJ-5), and the epic's deliverable — the complete validated dataset — is independently valuable as the liberated dataset itself, not merely plumbing for Epic 2. Goal states a user outcome with concrete quality bars (104/104 self-validated, byte-identical re-runs). **Pass.**

**Epic 2 — "Match & Tournament Analytics Web App":** Fully user-centric (Mariana/Diego outcomes, UJ-1..4). **Pass.**

**Epic independence:** Epic 1 stands alone completely. Epic 2 consumes only Epic 1's *first deliverable* (contract + fixtures, Story 1.1) until launch hardening (Story 2.19) consumes Story 1.19's real data — a backward dependency, correctly sequenced. No Epic N → Epic N+1 dependency exists. **Pass.**

**Deliberate cross-epic interlock (noted, not a violation):** Story 2.3 (contract sign-off) gates Epic 1 proceeding *past the sample set* per AD-14. This is a bidirectional process gate, not a functional forward dependency — but it means the epics must be **interleaved, not run strictly sequentially**: 1.1 → (2.1..2.3 in parallel with 1.2..1.5) → 2.3 sign-off → 1.6+. Sprint planning must encode this or Epic 1 stalls waiting on a gate nobody scheduled.

### Story Dependency Analysis

All 19 Epic 1 stories and 19 Epic 2 stories were checked pairwise against their Givens and ACs:

- **No forward dependencies found.** Every story's Givens reference only prior-story outputs (1.2 uses 1.1's seed; 1.3 uses 1.2's discovery; 1.5 completes 1.4's partial gate; 1.15 consumes 1.6–1.14's Extraction Records; 2.4+ use 2.1's scaffold and fixtures; 2.19 uses 1.19's committed `/data`).
- **The FR-15 gate re-run pattern is well-handled:** Story 1.4 honestly scopes verification to "all extractors implemented so far," and each subsequent extraction story (1.5–1.14) carries an AC re-running the gate — the gate strengthens incrementally instead of pretending completeness it can't have yet.
- **De-risking sequencing (focus area) verified:** PRD §8.1 orders FR-15 and FR-12 first-after-kickoff. Story order honors it as tightly as prerequisites allow: 1.1 contract (AD-14 mandate) → 1.2 ingestion/discovery (prerequisite for any verification) → 1.3 shots parser (gives the gate something to verify) → **1.4 template-consistency (FR-15)** → **1.5 marker–event linking (FR-12)** — both de-risking stories land before all broad extraction (1.6–1.14). **Pass.**
- **Coordinate model (focus area) verified:** the AD-6 frame (0–100, explicit `teamId`, x=100 at opponent goal, y=0 attacker's left) appears operationally in extraction ACs — 1.3 (shots), 1.11 (crosses), 1.12 (defensive, `teamId` = defending team), 1.13 (receiving, `teamId` = receiver's team), 1.14 (nodes) — and the App-side render-as-is rule in 2.7. The frame flows from architecture into stories with per-family semantics intact. **Pass.**
- **i18n early sequencing (focus area) verified:** FR-30 structure + lint gate + typed dictionaries land in Story 2.1 (first Epic 2 story); FR-31 toggle/persistence in 2.2 (second); FR-32 terminology completes in 2.18 with structure never retrofitted. Matches the UX contract and the epics' own "never retrofitted" directive. **Pass.**
- **Contract-as-sole-interface (focus area) verified:** Story 1.1 authors it, 2.1 consumes generated types only, 2.3 signs it off, 1.8 exercises the AD-14 change flow for the momentum shape, 1.16 stamps and validates. No story on either side references the other epic's internals. **Pass.**

### Acceptance Criteria Review

Uniformly strong: proper Given/When/Then, concrete and testable (exact counts — "16 markers, 2/2/8/3/1", exact budgets — "≤ 500 KB gzip -9", exact viewport — 390px), and error/edge paths are first-class (fail-loud ACs, empty states, invalid comparison params, private-mode storage fallback, own-goal/shootout edge shapes). Counter-metric discipline (SM-C1/SM-C2) is embedded directly in ACs rather than left as prose. No vague or unmeasurable criteria found.

### Special Implementation Checks

- **Upfront schema creation (analog of the "all tables upfront" anti-pattern):** Story 1.1 authors the *entire* v1 schema set before any extractor beyond the spike exists. This deviates from the "create when needed" default but is a justified, architecture-mandated deviation (AD-14) whose purpose is unblocking Epic 2 — and it is properly hedged: the AD-14 change flow, the planned momentum bump (1.8), and the sign-off gate (2.3) all anticipate schema revision. **Accepted with rationale.**
- **Starter template:** none specified by architecture (a Structural Seed layout instead) — no template story required. However, see Minor #2 below on seed ownership.
- **Greenfield coverage:** pipeline setup in 1.1–1.2, app scaffold + full CI/deploy chain in 2.1 (Netlify deployable from the first story — early pipeline, good), pytest harness established by 1.3's ACs. **Pass.**

### Findings by Severity

#### 🔴 Critical Violations

None.

#### 🟠 Major Issues

None.

#### 🟡 Minor Concerns

1. **Cross-epic gate needs explicit scheduling:** the 2.3 ↔ Epic 1 interlock (above) is sound but only works if sprint planning interleaves the epics. Recommendation: make the dependency explicit in sprint planning (2.3 blocks 1.6+).
2. **Monorepo seed ownership is implicit:** Story 1.1's Given assumes the monorepo seed (`contract/`, `pipeline/`, `data/`, `app/`, `spike/`) exists, but no story explicitly creates it. Recommendation: fold repo bootstrap (directory seed, git init, pinned `requirements.txt`/lockfile scaffolding) into Story 1.1's tasks during story preparation.
3. **Three dense stories:** 2.1 (tokens + i18n + codegen + build gates), 2.7 (pitch-panel infrastructure + shot map + cross map + full a11y), and 1.3 (parser productionization + normalization + RGB mapping + self-validation) each bundle multiple concerns. Cohesive and acceptable for a solo builder, but they are the likeliest candidates to split if any proves oversized during story prep.
4. **Process stories use builder-as-user:** 2.3 (sign-off) and several Epic 1 stories are "As the builder." Consistent with the PRD's builder JTBD; noted for transparency, no action needed.

## Summary and Recommendations

### Overall Readiness Status

## ✅ READY

This is an unusually well-aligned artifact set. All 35 FRs trace from PRD through architecture and UX into stories with operationalized, testable acceptance criteria; zero critical or major issues were found. The four cross-artifact alignment concerns designated as assessment focus areas all verified clean:

1. **JSON artifact schema as sole inter-epic contract** — stated in PRD §4, enforced by architecture AD-1/AD-2/AD-14, implemented by Stories 1.1 (author), 2.1 (generated types only), 2.3 (sign-off gate), 1.8 (change flow), 1.16 (stamp + validate). No story on either side touches the other epic's internals.
2. **Normalized 0–100 coordinate model** — defined once in AD-6 (full-pitch floats, explicit `teamId`, per-family acting-team semantics) and present operationally in every spatial extraction story (1.3, 1.11–1.14) and the App's render-as-is rule (2.7).
3. **i18n (es default / en toggle)** — fully specified in UX (Locale bootstrap, per-term policy table, es-CO conventions) and structurally front-loaded in Epic 2: Story 2.1 (typed dictionaries + lint gate), 2.2 (toggle + persistence), 2.18 (terminology completion). Never retrofitted.
4. **Template-validation de-risking sequenced early** — Story 1.4 (FR-15) lands immediately after its minimum prerequisites (contract, discovery, one parser) and before all broad extraction, with the gate re-run by every subsequent extraction story. Marker–event linking (FR-12, Story 1.5) follows directly, honoring PRD §8.1.

### Critical Issues Requiring Immediate Action

None.

### Recommended Next Steps

1. **Encode the cross-epic interlock in sprint planning:** when running sprint planning, make Story 2.3 an explicit blocker of Stories 1.6+ and schedule the bootstrap interleave (1.1 → {2.1–2.3 ∥ 1.2–1.5} → 2.3 → 1.6+). This is the one structural fact a naive epic-by-epic execution would miss.
2. **Assign monorepo-seed creation to Story 1.1:** during story preparation (create-story), add explicit tasks for the repo bootstrap (directory seed per the Structural Seed, git init, pinned `requirements.txt`, npm lockfile scaffolding) so the seed Story 1.1 assumes actually gets built.
3. **Watch the three dense stories during story prep:** 2.1, 2.7, and 1.3 bundle multiple concerns; split them if context or session limits bite (natural seams: 2.1 tokens vs. build gates; 2.7 infrastructure vs. cross map; 1.3 parser vs. self-validation wiring).
4. **Optional PRD hygiene:** update the PRD §6.1 Netlify bandwidth assumption (100 GB/mo → credit-based ~15 GB/mo effective per AD-13) to keep the document honest; the architecture already mitigates with portable fallback hosts and Story 2.19's deploy-time check.

### Final Note

This assessment identified **6 issues** across **3 categories** (4 minor epic-quality concerns, 2 informational UX/PRD alignment observations) — and **0 critical, 0 major**. Nothing blocks Phase 4. The recommended next steps are refinements to carry into sprint planning and story preparation, not preconditions; you may proceed to implementation as-is.

---

**Assessment date:** 2026-07-22
**Assessor:** BMad Implementation Readiness workflow (facilitated by Claude, reviewed with Juan)

# Project Brief: World Cup 2026 Match Analytics Dashboard

> Seed document for BMad (Analyst → PM → Architect flow). Intended to be read by Claude Code as the project's starting context. Status of spatial-data feasibility: **validated (spike GREEN)**.

---

## Executive Summary

A free, open, fully static web app that turns FIFA's public **Post-Match Summary Report (PMSR)** PDFs from the 2026 World Cup — 104 dense infographic reports, ~52 pages each — into clean, layered, accessible dashboards.

The app serves two audiences from the same data model via **progressive disclosure**: casual fans (headline stats and match story) and tactical analysts (deep event, positional, and per-player data). Because the tournament is complete, the dataset is **frozen**, enabling a **one-time batch extraction pipeline** that precomputes everything to **static JSON**. Hosted on Netlify's free tier with **zero backend and zero infrastructure cost**.

---

## Problem Statement

FIFA publishes an extraordinarily rich dataset per match — possession phases, line breaks, pressing intensity, defensive blocks, per-player physical and on/off-ball data, and the pitch coordinates of shots, passes, and crosses. But it is locked inside ~52-page infographic PDFs, one per match.

The format is technically public yet practically inaccessible:
- Unreadable on mobile and impossible to search.
- No way to compare two matches, two teams' tactical identity, or track a player across the tournament.
- Impenetrable to anyone unwilling to page through a full PDF per game.

There is currently no tournament-wide view: no leaderboards, no aggregated team/player profiles, no comparison tooling. The value is all there — it's just trapped in an unusable container.

---

## Proposed Solution

A two-part system with a hard separation between data and presentation:

1. **Offline extraction & precompute pipeline (Python).** Parses all 104 PMSR PDFs — both tabular data and vector/positional data — into a normalized structured dataset, then precomputes per-match bundles and tournament-wide aggregations to static JSON.
2. **Static web app (Next.js / React).** Renders match dashboards, a tournament hub, and player/team profiles from the JSON, with all filtering, sorting, and comparison done client-side.

Because the data never changes, there is **no runtime backend, no production database, and no hosting cost**. The pipeline runs once (idempotently, for dev convenience), produces artifacts, and the app consumes them.

---

## Target Users

- **Primary A — Casual fan.** Wants score, scorers, and a handful of intuitive stats (possession, shots, xG, distance, top speed) framed as a story. Mobile-first, low tolerance for density.
- **Primary B — Tactical analyst / hobbyist.** Wants phases of play, line heights, pressing, line breaks, passing networks, per-player event and physical data, and cross-match comparison. Wants and tolerates density.

Both are served through a **layered UI** (hero → tactical → expert) over one shared data model. No audience gets a separate app.

---

## Goals & Success Metrics

- A visitor can read a match's story in under ~15 seconds (hero layer) and drill to full depth without leaving the page.
- All 104 matches extracted, each passing its built-in self-validation (marker-count cross-check against the tabular attempts table).
- Tournament-wide leaderboards plus per-team and per-player profiles aggregated across all matches.
- Positional fidelity: shot / pass / cross maps reconstructed from true pitch coordinates, not approximations.
- **$0 infrastructure cost**; fully static on Netlify free tier.

---

## MVP Scope

### In scope

- **Extraction pipeline** covering all 7 data domains (see Appendix A), tabular **and** vector/positional.
- **Match dashboard:** header (score, goals, lineups, formations) → head-to-head key stats → possession / momentum timeline → shot maps + xG → passing networks → phases-of-play comparison → pressing & defensive blocks → set plays.
- **Tournament hub:** results, standings, aggregated leaderboards.
- **Player profile:** per-match and aggregated individual data, physical profile (speed zones, sprints, top speed), cross-match trends.
- **Team profile:** tactical identity across the tournament (line heights, blocks, pressing tendencies, formation usage).
- **Comparison mode:** two players, two teams, or two matches side by side.
- **Layered progressive disclosure** serving both audiences from one data model.
- **Bilingual UI (i18n):** Spanish as the default user-facing language, with a toggle to English. All UI copy externalized to locale files from day one — no hardcoded strings. See Constraints for the language-axis distinction.

### Out of scope (explicit)

- Progressive / live ingestion and scheduling — the tournament is complete; this is a **one-time batch**.
- Any production backend, database, or authentication.
- User accounts, saved views, social features.
- Native mobile app (responsive web only).
- Predictive modeling or xG recomputation — use FIFA's provided values as-is.
- Monetization features (deferred to Post-MVP).

---

## Post-MVP Vision

- **Structured dataset as a downloadable data pack** (Gumroad / Lemon Squeezy — no infra, third party handles payment and delivery). **Contingent on FIFA Terms-of-Use review** (see Risks).
- **Tip jar / GitHub Sponsors** for a passion-project support model.
- Deeper analytics: custom composite metrics, tactical-similarity search across teams.
- **Career leverage** is an explicit intended outcome: this is a portfolio piece combining data engineering, visualization, and football analytics.

---

## Technical Considerations

### Extraction (offline, Python)

- **Libraries:** `pymupdf` (fitz) for vector primitives and coordinates; `pdfplumber` for tabular regions.
- **Feasibility is validated, not assumed** — the spike returned GREEN (see Appendix B). Pitch maps are vector primitives; coordinates are fully recoverable.
- **Page discovery MUST be text-anchored, never index-based.** The PDF header claims 8 pages but reports are actually ~52 pages, with section-divider cards and no assumable order. The spike confirmed whitespace-normalized text search locates target pages reliably.
- **Coordinate normalization** against the *full* pitch rectangle (which extends beyond the clipped visible view) yields true 0–100 full-pitch coordinates.
- **Marker parsing is a family of per-page-type parsers**, not one parser. Shots, crosses, pressure, and offers use different marker shapes/sizes, but share a core recipe: largest sub-page rectangle = pitch frame → filtered filled shapes → legend-row exclusion (drop any horizontal row of circles showing ≥4 distinct legend colors at identical y).
- **Color → outcome mapping is keyed on exact RGB.** Assert on unknown colors (fail loud; never silently drop). Known collision: the "incomplete" dark blue is reused for table-header rectangles — keep circle-geometry checks in the filter.
- **Marker → event-row linking** (shot number → time / player / body part / xG) requires matching digit glyphs from `get_text("words")` by proximity. This is the **hardest extraction sub-task** and gates all spatial joins.
- **Free per-report validation:** extracted marker count vs. the tabular attempts table gives a correctness signal for every match.

### Data model & precompute

- Normalized spine: **Tournament → Stage → Match → {Team, Player}** with `MatchTeamStats`, `MatchPlayerStats`, and event tables (`ShotEvent`, `CrossEvent`, `PassNetworkEdge`, `SetPlay`, `GoalkeeperStats`). Coordinates live in the event tables.
- **Output:** one JSON bundle per match plus aggregated tournament indices. Scale (a few thousand player rows, tens of thousands of pass edges across the whole tournament) is comfortably client-side.
- **Optional fallback:** bundled read-only SQLite if cross-cutting queries outgrow JSON. JSON-first.

### App

- **Next.js** (static export) / **React**.
- **d3** for pitch-based visualizations (shot maps, pass networks, heatmaps); **recharts** for tabular / statistical charts.
- **Netlify** free tier, static build, no backend.

### Suggested epic split (for BMad)

Keep these as two decoupled epics so they don't bleed into each other:
1. **Extraction & precompute** (Python, offline, produces JSON artifacts).
2. **Web app** (static front end, consumes JSON).

---

## Constraints & Assumptions

- Passion project: **free to users, $0 infrastructure budget, static hosting only**.
- Tournament data is **complete and frozen** — no live or incremental requirements.
- Vector extraction feasibility is **VALIDATED (spike GREEN)**.
- The template is programmatically generated and consistent across reports — high confidence, with an explicit early verification task (see Risks).
- **Two independent language axes — do not conflate them:**
  - *Project language (English):* this document, all downstream BMad artifacts (PRD, architecture, stories), source code, comments, and developer interaction with Claude Code remain in **English**. Do not translate the project to Spanish.
  - *User-facing UI language (Spanish default, English toggle):* the rendered app defaults to **Spanish**, switchable to English via i18n. Source data (team, player, venue names) arrives from the PDFs in English.

---

## Risks & Open Questions

- **Template revision mid-tournament** could silently break extraction. → Validate one report per venue / matchday early. **Highest-priority de-risking task after MVP kickoff.**
- **Marker → event-number linking** via glyph proximity is non-trivial and gates time / player / xG joins on spatial events.
- **Per-page-type marker tuning** needed for non-shot maps (crosses, pressure, offers).
- **Exact-RGB color keys** are brittle to any palette change → assert-and-fail, never drop.
- **FIFA Terms of Use / IP:** public ≠ freely reusable commercially. Displaying data free with attribution is safer ground than selling derived datasets. Requires review before any Post-MVP monetization. *(Not legal advice.)*
- **Overlapping markers** (six-yard box) are fine for positions; dedup only matters if counting.
- **Tactical-terminology translation (open question):** decide per-term whether specialized labels (e.g. "line breaks", "build up", "counter-press") are translated to Spanish, kept in English as accepted jargon, or shown with a glossary/tooltip. Source data stays English; this is a UI-copy decision that should be resolved in the i18n locale files.

---

## Appendix A — Data Domains (extraction inventory)

- **A. Metadata & result** — teams, score, stage/group, venue, date, kickoff; lineups (starters + subs with number, position, goal/sub/card minutes); formations.
- **B. Comparative team stats** — the *Key Statistics* block: possession, xG, shots (on target), passes (complete) & completion %, line breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered.
- **C. Tactical identity** — phases of play (in/out of possession %), line height & team length (in/out of possession, in meters), defensive blocks (high/mid/low).
- **D. Spatial events** — shots (log + map), crosses (locations/zones/types), passing networks (player-to-player matrix), offering to receive, movement to receive, defensive actions.
- **E. Goalkeeping** — involvement timeline, distribution (feet/hands/throw), goal prevention (save %, intervention types), aerial control.
- **F. Set plays** — free kicks, penalties, corners (by side/style), throw-ins.
- **G. Individual player data** — in possession (passes, %, switches, line breaks, ball progressions, take-ons, step-ins, attempts, goals), out of possession (tackles, blocks, interceptions, pressing, duels, clearances, recoveries), physical (distance by speed zones 1–5, high-speed runs, sprints, top speed).

---

## Appendix B — Validated Spike Findings

- **Verdict: GREEN.** Pitch maps are vector primitives; coordinates fully recoverable with `pymupdf`.
- **Two independent proofs:** (1) census — analytic pages carry hundreds of vector paths and typically 1 raster image (background texture); (2) ground truth — extractor found exactly 16 shot markers with a 2 goal / 2 on-target / 8 off-target / 3 blocked / 1 incomplete distribution, matching the tabular breakdown on the first stable run.
- **Page reality:** ~52 pages (header falsely claims 8). Shots page auto-detected by text search, not index.
- **Marker geometry:** 11.25×11.25 pt filled Bézier circles (white stroke, 32 curve segments) — machine-identifiable.
- **Legend colors → outcome** map on exact RGB (green=goal, light blue=on target, amber=off target, purple=blocked, dark blue=incomplete).
- **Pitch frame** extends below the visible clip; normalizing against the full rect gives true full-pitch 0–100 coordinates (sample goals landed inside/edge of the box, as the render confirmed).
- **Winning filter chain:** largest sub-page rectangle → small filled circles → distinct-color-row legend exclusion. Template-generic.

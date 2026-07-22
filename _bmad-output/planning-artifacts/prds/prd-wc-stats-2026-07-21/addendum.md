# PRD Addendum — World Cup 2026 Match Analytics Dashboard

Technical depth extracted from `project-brief-wc2026-analytics.md` that belongs in downstream artifacts (architecture, UX spec, epics) rather than the PRD proper. Binding where marked; otherwise validated starting points.

## 1. Validated spike findings (binding ground truth for architecture)

- **Verdict GREEN.** Pitch maps are vector primitives; coordinates fully recoverable with `pymupdf`.
- Two independent proofs: (1) census — analytic pages carry hundreds of vector paths and typically 1 raster image (background texture); (2) ground truth — extractor found exactly **16 shot markers** with a **2 goal / 2 on-target / 8 off-target / 3 blocked / 1 incomplete** distribution, matching the tabular breakdown on the first stable run.
- **Page reality:** ~52 pages per report; the PDF header falsely claims 8. Target pages auto-detected by whitespace-normalized text search, never by index.
- **Marker geometry (shots):** 11.25×11.25 pt filled Bézier circles, white stroke, 32 curve segments — machine-identifiable.
- **Legend colors → outcome, keyed on exact RGB:** green=goal, light blue=on target, amber=off target, purple=blocked, dark blue=incomplete. Known collision: the "incomplete" dark blue is reused for table-header rectangles — circle-geometry checks must stay in the filter.
- **Pitch frame** extends below the visible clip; normalizing against the **full** rect gives true full-pitch 0–100 coordinates (sample goals landed inside or at the edge of the box on re-render).
- **Winning filter chain (template-generic):** largest sub-page rectangle = pitch frame → small filled circles → legend-row exclusion (drop any horizontal row of circles showing ≥4 distinct legend colors at identical y).
- Marker parsing is a **family of per-page-type parsers** (shots, crosses, pressure, offers use different marker shapes/sizes) sharing the core recipe above.
- **Marker → event-row linking** requires matching digit glyphs from `get_text("words")` by proximity — hardest extraction sub-task; gates all spatial joins.
- Overlapping markers (e.g., in the six-yard box) are fine for positions; dedup only matters if counting.

## 2. Technology selections (from brief; architecture confirms, does not re-litigate without reason)

- **Pipeline:** Python; `pymupdf` (fitz) for vector primitives and coordinates; `pdfplumber` for tabular regions.
- **App:** Next.js (static export) + React; **d3** for pitch-based visualizations (shot maps, pass networks, heatmaps); **recharts** for tabular/statistical charts.
- **Hosting:** Netlify free tier, static build, no backend.

## 3. Data model spine (starting point for architecture)

- Normalized spine: **Tournament → Stage → Match → {Team, Player}** with `MatchTeamStats`, `MatchPlayerStats`, and event tables (`ShotEvent`, `CrossEvent`, `PassNetworkEdge`, `SetPlay`, `GoalkeeperStats`). Coordinates live in the event tables.
- **Scale estimate:** a few thousand player rows, tens of thousands of pass edges tournament-wide — comfortably client-side as JSON.
- **SQLite contingency:** bundled read-only SQLite only if cross-cutting queries outgrow JSON. JSON-first; the trigger is demonstrated client-side failure, not preference.

## 4. Post-MVP notes (context for future planning; all gated on PRD OQ-2 where monetization-related)

- **Data pack channel options:** Gumroad / Lemon Squeezy — no infra, third party handles payment and delivery.
- **Support model:** tip jar / GitHub Sponsors.
- **Analytics depth:** custom composite metrics; tactical-similarity search across teams (most differentiating v2 candidate).
- **Career leverage** is an explicit intended outcome: a portfolio piece combining data engineering, visualization, and football analytics.

## 5. Risk register detail (source: brief)

| Risk | Mitigation | Where it landed in the PRD |
|---|---|---|
| Template revision mid-tournament silently breaks extraction | Validate one report per venue/matchday early; highest-priority de-risking task | FR-15; §8.1 ordering note |
| Marker–event linking is non-trivial and gates spatial joins | Schedule early; flag unlinked markers, never drop | FR-12; §8.1 ordering note |
| Per-page-type marker tuning for non-shot maps | Parser family with shared recipe | FR-10 |
| Exact-RGB brittleness to palette change | Assert-and-fail, never silently drop | FR-11; SM-C1 |
| FIFA ToU / IP: public ≠ freely reusable commercially | Free-with-attribution MVP; ToU review gates monetization | §6.2; OQ-2 |

## 6. Data Domain field inventory (normative for PRD FR-3..8, FR-10, FR-13; source: brief Appendix A)

Extraction coverage is tested against this inventory, not against the PRD's summaries.

- **A. Metadata & result** — teams, score, stage/group, venue, date, kickoff; lineups (starters + subs with number, position, goal/sub/card minutes); formations.
- **B. Comparative team stats** — the *Key Statistics* block: possession, xG, shots (on target), passes (complete) & completion %, line breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered.
- **C. Tactical identity** — phases of play (in/out of possession %), line height & team length (in/out of possession, in meters), defensive blocks (high/mid/low).
- **D. Spatial events** — shots (log + map), crosses (locations/zones/types), passing networks (player-to-player matrix), offering to receive, movement to receive, defensive actions.
- **E. Goalkeeping** — involvement timeline, distribution (feet/hands/throw), goal prevention (save %, intervention types), aerial control.
- **F. Set plays** — free kicks, penalties, corners (by side/style), throw-ins.
- **G. Individual player data** — in possession (passes, %, switches, line breaks, ball progressions, take-ons, step-ins, attempts, goals), out of possession (tackles, blocks, interceptions, pressing, duels, clearances, recoveries), physical (distance by speed zones 1–5, high-speed runs, sprints, top speed).

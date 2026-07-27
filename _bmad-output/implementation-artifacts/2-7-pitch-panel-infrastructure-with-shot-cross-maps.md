---
baseline_commit: f8ca7ee9267a656576195b1a37614e4308162799
---

# Story 2.7: Pitch-Panel Infrastructure with Shot & Cross Maps

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Diego,
I want shot and cross maps at true source coordinates with full popover, keyboard, and data-table access,
so that I can study and screenshot every attempt exactly as the source recorded it (FR-24, UJ-2).

## Acceptance Criteria

1. **Given** the shared pitch-panel component
   **When** any pitch viz renders
   **Then** it draws the theme-invariant deep-green pitch (stripes, lines, hairline border on dark only, `rounded.lg`, internal padding), places events by `teamId` at true 0–100 coordinates with affine viewport transforms only — never rewriting stored values (AR-6)
   **And** every panel carries its title, legend, the permanent in-panel attribution caption, and a "Ver los datos / View data" control opening the equivalent real `<table>` (UX-DR9, UX-DR21, NFR-2).

2. **Given** the shot map (`#shot-maps`)
   **When** it renders
   **Then** markers use the five-outcome encoding — color token AND shape dual-encoding (filled circle + ring / filled circle / hollow circle / filled square / hollow square) — at **uniform size** (see FD-1 below), with own goals excluded and shootout attempts never plotted (UX-DR10, AR-6)
   **And** the rendered layout spot-check-matches the source PDF for the fixture match (SM-3).

   > **FD-1 (Story 2.3 sign-off, 2026-07-23) amends AC 2 and AC 3's xG clauses:** per-shot xG does not exist in the source PDFs (`ShotEvent.expectedGoals` is `null` in contract v1 — team totals only), so markers render at UNIFORM size and the detail popover / event log OMITS the xG row while the field is `null`. The nullable slot stays as the forward-compatible landing zone. See `contract/README.md` → "Story 2.3 sign-off (v1)".

3. **Given** marker interaction
   **When** a user taps, hovers, or focuses a marker
   **Then** a detail popover shows player, minute, xG (omitted while `null` — FD-1), outcome; hit areas partition by nearest marker (Voronoi) at ≥44px; colliding hit areas collapse to a cluster list popover with z-order cycling, Enter/arrow-key equivalence, and overlapping markers never displaced (UX-DR9, UX-DR15)
   **And** the SVG's decorative content is `aria-hidden` while focusable markers expose localized name/role/value; the panel is a `role="figure"` with a localized one-sentence `aria-label`; arrow keys rove marker-to-marker ordered by minute (UX-DR16).

4. **Given** a `<md` viewport
   **When** shot/cross maps render
   **Then** one team shows at a time via team tabs on a vertical half-pitch (attacking goal up), positions unchanged, hit areas ≥44px (UX-DR17)
   **And** the cross map renders with the same infrastructure from `CrossEvent` data.

## Tasks / Subtasks

- [x] **Task 1: Dependency + lint-seam groundwork (AC: 1, 3)**
  - [x] 1.1 `npm install d3-delaunay@6.0.4` and `npm install -D @types/d3-delaunay@6.0.4` in `app/`. This is the ONLY new runtime dependency. It is the exact Voronoi module bundled inside the architecture's pinned `d3@7.9.0` (d3 7.9.0 depends on `d3-delaunay ^6.0.1`), so the AR stack pin is honoured without shipping the ~90 KB-gzip monolith on a ≤500 KB-per-route budget. Do **not** install the full `d3` package, `d3-scale`, or `d3-selection`. Commit the updated `package-lock.json` (AD-13: locked trees underwrite reproducible builds).
  - [x] 1.2 The projections are plain arithmetic in `pitch-geometry.ts` (Task 2) — do **not** pull `d3-scale` in for two linear maps, and do **not** let d3 touch the DOM. **React owns every SVG node**; d3 is used for geometry math only. `d3.select().append()` anywhere in this story is a review failure: it fights React's reconciler, breaks lazy unmount, and makes the whole viz untestable in the node-only harness.
  - [x] 1.3 `app/eslint.config.mjs`: add `"src/viz/**/*.{ts,tsx}"` to the `files` array of the client-import seam block (the one currently scoped to `src/components/**`). A new top-level source directory that is not in that list silently escapes the `t()` / `build-data` bar — the exact residual gap filed by the 2.2 and 2.4 reviews. One-line change; no other rule edits.
  - [x] 1.4 `app/src/lib/eslint-gate.test.ts`: add one regression fixture proving the seam covers the new directory — lint `import { t } from "@/lib/i18n";` at `filePath: "src/viz/__gate_probe__.ts"` and assert `no-restricted-imports` fires (mirror the existing `src/components` seam fixtures; note their `filePath` convention and reuse it).

- [x] **Task 2: `pitch-geometry.ts` — the AD-6 → screen affine map (AC: 1, 4)**
  - [x] 2.1 Create `app/src/viz/pitch-geometry.ts` (pure: no React, no DOM, no `t()`, no locale). This module is the load-bearing one — AR-6 is the single invariant most likely to be silently violated, and a transposed or mirrored frame passes every unit test that only checks "a number came out".
  - [x] 2.2 Constants: `PITCH_LENGTH_M = 105`, `PITCH_WIDTH_M = 68`. The 0–100 frame is **non-uniform** (x=100 spans 105 m, y=100 spans 68 m), so aspect ratio must come from metres, never from the 0–100 numbers.
  - [x] 2.3 `export type PitchOrientation = "horizontal" | "vertical"`. `horizontal` = attack left→right, attacked goal at the RIGHT edge (`≥md`, matching the desktop mockup's 246×318 viewBox). `vertical` = attacking goal UP (`<md`, UX-DR17) — which is also the source PDF's own drawing orientation (`pipeline/markers/shots.py` docstring: "the PMSR map is rendered vertically, attack up the page").
  - [x] 2.4 `export interface PitchExtent { xMin: number }` — the frame's x floor: `50` for the half pitch, `0` for the full pitch. `export function pitchExtentFor(points: {x: number}[]): PitchExtent` returns `{xMin: 50}` only when **every** point has `x >= 50`, else `{xMin: 0}`. Rationale (ruled decision 3): every shot and cross in all three fixtures sits in the attacking half (shots x 70.34–98.71, crosses x 60.38–94.80) and both mockups draw half pitches — but a long-range shot at x=45 in real data must never be clipped, displaced, or dropped. The panel silently widens to a full pitch instead. **Never clamp a coordinate to the extent.**
  - [x] 2.5 `export function panelSize(orientation, extent, widthPx): { width: number; height: number }` — `horizontal`: `height = width * PITCH_WIDTH_M / ((100 - xMin)/100 * PITCH_LENGTH_M)`; `vertical`: `height = width * ((100 - xMin)/100 * PITCH_LENGTH_M) / PITCH_WIDTH_M`. Half pitch horizontal → 318/246 ≈ 1.293, exactly the mockup's ratio.
  - [x] 2.6 `export function project(orientation, extent, size, padPx): (x: number, y: number) => { cx: number; cy: number }` — the affine map, in **CSS px**, with `padPx` of internal padding on every side (DESIGN: "pitch drawings keep an internal padding of at least `{spacing.tile-gap}`" → `padPx = 12`).
    - `horizontal`: `cx = pad + (x - xMin)/(100 - xMin) * innerW`, `cy = pad + (y/100) * innerH`.
    - `vertical`: `cx = pad + (y/100) * innerW`, `cy = pad + (100 - x)/(100 - xMin) * innerH`.
    Both are rotate+scale+translate only — legal under AR-6. Derivation, so nobody "fixes" it later: AD-6 puts x=100 at the attacked goal and y=0 on the **attacker's left**. A player attacking up the page has their left hand toward page-left, so y=0 is page-left in the source frame; rotating that 90° clockwise into the horizontal layout sends page-left to the TOP, hence `cy` grows with y. The mockup corroborates: MEX's two goal markers sit right of the penalty-area edge and vertically inside the box.
  - [x] 2.7 `export function pitchMarkings(orientation, extent, size, padPx): PitchMarkings` — the drawable geometry as **data** (arrays of rects, lines, circles, arcs in px), never JSX: outer boundary, mow stripes, halfway line (full pitch only), centre circle + spot (full pitch only), penalty area, six-yard box, penalty spot, penalty arc, goal. Derive every dimension from FIFA metres (penalty area 16.5 m deep × 40.32 m wide; six-yard 5.5 × 18.32; penalty spot 11 m from goal line; arc radius 9.15 m; centre circle 9.15 m; goal 7.32 m) through the same `project`, so the markings and the markers can never disagree. Three mow stripes on a half pitch matches the mockup; keep stripe count derived from the extent (6 across a full pitch).
  - [x] 2.8 Tests `app/src/viz/pitch-geometry.test.ts`: x=100 lands at the attacked-goal edge in BOTH orientations (right edge / top edge); y=0 lands at the attacker's-left edge (top / left); the halfway boundary lands on the opposite edge; the map is affine (three collinear source points stay collinear and preserve their ratio; the midpoint of two points maps to the midpoint of their images); `pitchExtentFor` returns the full pitch as soon as one point has x<50 and returns the half pitch on all three fixtures' shots and crosses; aspect ratio equals 68/52.5 for the horizontal half pitch; `project` is pure (input objects are not mutated). Assert literals for at least one hand-computed point per orientation — a test that re-derives the formula proves nothing (2.4 review lesson).

- [x] **Task 3: `marker-layout.ts` — ordering, clustering, Voronoi (AC: 3)**
  - [x] 3.1 Create `app/src/viz/marker-layout.ts` (pure). Everything AC 3 is really about lives here so it is testable in the node-only harness (there is **no jsdom** by the deliberate 2.2 decision — do not add it).
  - [x] 3.2 `export const MIN_HIT_PX = 44` (UX-DR15's touch floor).
  - [x] 3.3 `export function orderByMinute<T extends { at: MinuteStamp }>(events: T[]): T[]` — stable sort by `(at.minute, at.stoppageMinute ?? 0)`, ties keep artifact order. This ordering is the roving-tabindex order (UX-DR16) and the data table's default sort. m002 carries three stoppage-minute shots — use it as the fixture that proves `45+3` sorts after `45` and before `46`.
  - [x] 3.4 `export function clusterMarkers(points: {cx,cy}[], minDistPx = MIN_HIT_PX): number[][]` — single-link clustering: two markers whose centres are closer than `minDistPx` land in one cluster, transitively. Returns arrays of indices into the input, each ordered by the input's own order (i.e. by minute). This is UX-DR9's "markers whose ≥44px hit areas would collide are treated as one cluster **even when visually separate**". **Markers are never moved** — clustering changes only the hit target, never a `cx`/`cy`.
  - [x] 3.5 `export function hitCells(clusterPoints: {cx,cy}[], bounds: [x0,y0,x1,y1]): (string|null)[]` — Voronoi cell paths via `Delaunay.from(points, p => p.cx, p => p.cy).voronoi(bounds)`, one SVG path string per cluster. Special-case `n === 0` (return `[]`) and `n === 1` (return the bounds rectangle as a path) rather than trusting d3-delaunay's degenerate behaviour; a fully collinear point set is the other degenerate case — cover it with a test rather than discovering it in the browser.
  - [x] 3.6 Why the cells satisfy "≥44px areas" without inflation, stated in a comment so nobody adds a fudge factor: cluster representatives are ≥44 px apart by construction (anything closer merged), so every Voronoi cell extends ≥22 px toward each neighbour, i.e. ≥44 px across. Inflating cells would make them overlap and break "a touch never silently lands on the wrong event".
  - [x] 3.7 A cluster's representative point is the centroid of its members (used for the Voronoi seed and for popover placement); members keep their own true positions for drawing.
  - [x] 3.8 Tests `app/src/viz/marker-layout.test.ts`: ordering incl. stoppage minutes and ties; clustering at exactly 43.9/44.0/44.1 px; transitive chaining (A–B 30 px, B–C 30 px, A–C 60 px → one cluster of three); `n = 0, 1, 2` and four collinear points all produce one cell per cluster with no throw; cell count always equals cluster count; a property test that every pair of cluster representatives is ≥ `MIN_HIT_PX` apart. Use m001's Mexico shots (two real near-pairs: 78.5/41.5 with 79.4/41.9, and 86.8/30.3 with 88.2/33.9 and 89.0/34.4) as a fixture-backed clustering case.

- [x] **Task 4: `shot-map-model.ts` and `cross-map-model.ts` — event → marker model (AC: 2, 4)**
  - [x] 4.1 Create `app/src/viz/marker-model.ts` with the shared, viz-agnostic marker shape that `PitchPanel` consumes and that 2.8/2.9 will also produce:
    ```ts
    export type MarkerShape = "circle-filled-ring" | "circle-filled" | "circle-hollow"
                            | "square-filled" | "square-hollow";

    /** A popover / accessible-name field. Numbers carry their format tag; the
     *  component is the only thing that may call @/lib/format, because only it
     *  has the locale (identical split to Story 2.5's KEY_STAT_FORMAT). */
    export type MarkerValue =
      | { kind: "text"; value: string }              // proper nouns: player names, team names
      | { kind: "key"; value: DictionaryKey }        // enum codes already resolved to a key
      | { kind: "number"; value: number; digits: 0 | 1 | 2 };

    export interface MarkerDetailRow { labelKey: DictionaryKey; value: MarkerValue }

    export interface PitchMarker {
      key: string;                  // stable React key: `${kind}-${artifactIndex}`
      x: number; y: number;         // AD-6 0–100, VERBATIM from the artifact — never adjusted
      shape: MarkerShape;
      colorVar: string;             // a CSS custom property name, e.g. "--shot-goal"
      /** Accessible name pieces, composed by the component in locale order:
       *  `${t(prefixKey)} ${playerName}, ${t("viz.shotMap.minutePrefix")} ${minuteLabel}, ${t(outcomeKey)}`
       *  → es "Tiro de Brian GUTIERREZ, minuto 3, bloqueado". `minuteLabel` comes
       *  from formatGoalMinute(at) — "3′" / "45+3′". The xG clause EXPERIENCE's
       *  example shows is OMITTED while expectedGoals is null (FD-1). */
      namePrefixKey: DictionaryKey;
      subjectName: string | null;   // null → the component renders viz.table.unknown
      minuteLabel: string | null;
      qualifierKey: DictionaryKey;  // outcome (shots) / completed-state (crosses)
      detail: MarkerDetailRow[];    // popover rows, in display order
    }

    /** Which state a whole event table is in, for the panel-level branch. */
    export type PanelDataState = "absent" | "zero" | "ready";
    export function panelDataState<T>(table: T[] | null): PanelDataState;
    ```
    Keep it locale-free: models return **dictionary keys and raw values**, components resolve them. Same contract as `tactical-sections.ts` (Story 2.5 Task 1.5) — and the only reason any of this is testable in a node-only harness.
  - [x] 4.1a Popover / detail rows, ruled so both maps stay consistent. **Shot:** player, minute, outcome — and xG **only when `expectedGoals !== null`** (FD-1: the row is omitted, not rendered empty and not rendered as "—", because a dash implies a value the source never had). **Cross:** player, minute, delivery type, completed. Coordinates do **not** appear in the popover (they are in the data table, per EXPERIENCE's Expert-altitude column list) — the popover is the human reading, the table is the record.
  - [x] 4.2 `export const MARKER_RADIUS_PX = 6`, `SQUARE_SIDE_PX = 11`, `HOLLOW_STROKE_PX = 2`, `GOAL_RING_STROKE_PX = 1.5`. Uniform, per FD-1. DESIGN allows ~8–14 px marks; these land at 12 px / 11 px. No xG sizing — the field is `null` on every shot in every fixture and in every real report.
  - [x] 4.3 `app/src/viz/shot-map-model.ts`:
    - `export const SHOT_OUTCOME_ENCODING: Record<ShotOutcome, { shape: MarkerShape; colorVar: string }>` — a **`Record` over the generated union**, so a contract enum change is a compile error rather than a silently unstyled marker. Values verbatim from DESIGN's table: `goal` → `circle-filled-ring` + `--shot-goal`; `on-target` → `circle-filled` + `--shot-on-target`; `off-target` → `circle-hollow` + `--shot-off-target`; `blocked` → `square-filled` + `--shot-blocked`; `incomplete` → `square-hollow` + `--shot-incomplete`.
    - `export function shotMarkers(shots: ShotEvent[], teamId: string): PitchMarker[]` — filter to `teamId`, **drop `ownGoal === true`** (AR-6: own goals are excluded from shot-map rendering), then `orderByMinute`. `events.shootoutAttempts` is not read by this module at all — it is a different table by AR-6, and m074 carries 9 of them as the proof fixture.
    - `export function shotLogRows(shots: ShotEvent[], home, away): ShotLogRow[]` — **includes own goals** (AR-6 verbatim: own goals are "present in log and scorer list — excluded from shot-map rendering"), ordered by minute then home-before-away. Columns: team, player, minute, x, y, outcome, and xG **only if any row has a non-null `expectedGoals`** (FD-1: the column is omitted entirely while every value is `null` — an all-empty column is noise, and the nullable slot stays forward-compatible).
    - `export function shotFigureCounts(markers)` → `{ shots: markers.length, goals: count of goal-outcome markers }` for the figure summary. **Do not** use `keyStatistics[side].goals` here: m074's Germany has `goals: 1` (the benefiting-team scoreline value for GOMEZ's own goal) and **zero** goal markers on its map — an aria-label reading "1 gol" over a map with no green marker is exactly the kind of quiet lie FR-22 exists to prevent. The figure summary describes the figure. (`keyStatistics[side].expectedGoals` IS used, verbatim, for the team-xG chip — team totals are real.)
    - `export function hasExcludedOwnGoals(shots, teamId): boolean` — drives the panel's honesty note (Task 6.7).
  - [x] 4.4 `app/src/viz/cross-map-model.ts`:
    - `export const CROSS_COMPLETED_ENCODING: Record<"completed" | "attempted", { shape: MarkerShape; colorVar: string }>` — `completed` → `circle-filled` + the acting team's accent var; `attempted` → `circle-hollow` + the same accent var (ruled decision 4: crosses carry the **team accent**, with completion dual-encoded by fill, not the shot-outcome hues).
    - `export function crossMarkers(crosses: CrossEvent[], teamId: string, accentVar: string): PitchMarker[]`, `export function crossLogRows(...)` — columns: team, player, minute, x, y, delivery type, completed.
    - **Defensive field handling, mandatory:** `CrossEvent.playerId` / `playerName` / `at` / `deliveryType` are `required` in the schema but **unfulfillable from the source page** — the crosses section prints per-player delivery *aggregates* with no per-event rows and no ordinal glyphs, so Story 1.11 stages `delivery_type: null` and 1.16's emission is blocked pending an AD-14 decision that will likely make them nullable (`deferred-work.md` → "Filed by Story 1.11 implementation"). **The fixtures' per-event `deliveryType`/`playerId` values are handcrafted samples, not extractable data.** The bundle reaches this code as an unvalidated `as`-cast, so: read those four fields through a nullish guard and render the locale-provided `viz.table.unknown` em-dash placeholder when absent; never `undefined.minute`, never a formatter throw. Order-by-minute must tolerate a missing `at` (sort such rows last, stably).
  - [x] 4.5 Tests `app/src/viz/shot-map-model.test.ts` / `cross-map-model.test.ts` (read the three fixtures with `node:fs`, the way `tactical-sections.test.ts` and `build-data.ts` do):
    - `SHOT_OUTCOME_ENCODING` has exactly one entry per `ShotOutcome` value and five distinct `colorVar`s;
    - m001: Mexico → 16 markers with the distribution **2 goal / 2 on-target / 8 off-target / 3 blocked / 1 incomplete**, South Africa → 3 (this is Story 1.3's permanent ground truth for `spike/mex_rsa.pdf`, "16 markers, 2/2/8/3/1", so a regression here is a regression against the source PDF itself);
    - m074: Paraguay → **7** markers from 8 shot rows (the GOMEZ own goal excluded) while `shotLogRows` returns all 8; Germany → 21 markers and **0** goal markers despite `keyStatistics.home.goals === 1`;
    - marker `x`/`y` are `===` the artifact values (identity, not approximate) for a sampled row — the AR-6 "never rewriting stored values" guard;
    - the xG column is absent on all three fixtures and appears once a constructed row carries a non-null `expectedGoals`;
    - `shootoutAttempts` never appears in any marker or log row on m074;
    - a constructed cross with `deliveryType: null` / missing `at` produces a placeholder row and does not throw;
    - **fixture reality, recorded not depended upon:** `keyStatistics[side].shots` equals the rendered marker count and `keyStatistics[side].crosses` equals the plotted cross count on all six team-innings across the three fixtures. Assert it as a *documented observation* with a comment saying the panel does not rely on the equality (the pipeline owns count validation; the App must not fail loud on a divergence it cannot fix).

- [x] **Task 5: `use-element-width.ts` — measured layout (AC: 1, 3, 4)**
  - [x] 5.1 Create `app/src/lib/use-element-width.ts` (`"use client"`). A `ResizeObserver`-backed hook returning the observed content-box width in CSS px, with the same defensive posture as `use-media-query.ts`: guard `ResizeObserver` existence in a try/catch, unobserve on cleanup, and take an initial fallback width so the first paint is close.
  - [x] 5.2 Why measured rather than a fixed viewBox (ruled decision 5): the ≥44 px hit floor and the marker radius are **CSS px** obligations. A viewBox that scales with the container makes 1 unit ≠ 1 px at unknown ratios, so a 44-unit threshold silently becomes 31 px on a 288 px-wide phone. Measuring once and doing all layout arithmetic in px makes the floor exact at every width and keeps markers a constant, legible size instead of shrinking on the smallest screens. The SVG therefore renders `width={W} height={H} viewBox={"0 0 W H"}` — one unit is one px, by construction.
  - [x] 5.3 Recompute markers/clusters/cells with `useMemo` keyed on `(width, orientation, extent, markers)`. ≤120 markers per panel (m074's 72 crosses is the corpus-scale worst case in the fixtures) — no virtualization, no throttling beyond what ResizeObserver already gives.

- [x] **Task 6: `PitchPanel.tsx` — the reusable panel 2.8 and 2.9 build on (AC: 1, 3, 4)**
  - [x] 6.1 Create `app/src/components/PitchPanel.tsx` (`"use client"`, `useT()`). This is the story's reuse deliverable — design the props before the pixels, and keep every shot/cross specific decision **out** of it.
    ```ts
    interface PitchPanelSide {
      teamCode: string;                       // uppercased, the direct label (UX-DR11)
      accent: "a" | "b";                      // Team A = home (viz-team-a), B = away
      markers: PitchMarker[];                 // [] renders the pitch + a zero-content line
      metaLine: string;                       // already-resolved chip text ("xG 1,78 · 16 tiros")
      figureSummary: string;                  // already-resolved one-sentence aria-label
      zeroLine: string;                       // already-resolved copy for markers.length === 0
    }
    interface PitchPanelProps {
      title: string;                          // resolved; rendered as <h3>
      sides: [PitchPanelSide, PitchPanelSide];
      legend: { shape: MarkerShape; colorVar: string; label: string }[];
      note?: string | null;                   // e.g. the own-goals-excluded line
      dataTable: ReactNode;                   // the "Ver los datos" region content
      underlay?: (project: Projection, size: Size) => ReactNode;  // 2.8's edges; unused here
    }
    ```
    Every string crossing this boundary is **already resolved** — the same reason `EmptyStatePanel` takes resolved `headline`/`explanation`: `label`, `caption`, `text`, `description` and `title` are gated prop names, so a literal there is a lint error and a `t()` call at the call site is the only clean path. `underlay` is a one-line forward seam for the pass network — build no other speculative machinery for 2.8/2.9. **Whole-table absence is not this component's problem**: `ShotMapsSection` decides whether a `PitchPanel` renders at all (Task 8.2), so `PitchPanel` only ever handles "this side has zero markers".
  - [x] 6.2 Layout: `≥md` renders both sides side by side (`grid-cols-2`, `gap-gutter-desktop`), each with its own SVG in `horizontal` orientation. `<md` renders a team selector plus ONE side in `vertical` orientation. Breakpoint via the existing `MD_MEDIA_QUERY` from `@/lib/use-media-query` — do not add a new constant. Ruled decision 6: EXPERIENCE's Responsive table names only `≥lg` and `<md`; `md`–`lg` is undefined there, and two half pitches fit comfortably at 768 px inside the route's `max-w-6xl`, so the split lands at `md`, reusing the breakpoint Key Statistics already uses.
  - [x] 6.3 Team selector at `<md`: the **vendored `ToggleGroup` / `ToggleGroupItem`** (`@/components/ui/toggle-group`), `type="single"`, with the two team codes. Radix renders it as `role="radiogroup"` + `role="radio"` with roving focus and arrow keys already — the same primitive and the same semantics as the site header's `ES | EN` toggle, so the page keeps one selector grammar. Do **not** vendor Radix `Tabs` (ruled decision 7). Each panel owns its own selection state; two panels in one section do not sync (self-contained is what makes the component reusable).
  - [x] 6.4 Panel chrome, `{components.pitch-panel}` verbatim: `bg-pitch-surface`, `rounded-lg`, `p-tile-gap`+ internal padding, **`border border-hairline` in the dark theme only** (DESIGN Elevation: the green-vs-charcoal edge computes 1.55:1; in light the canvas is the edge at 11.35:1). Implement the theme condition in CSS, not JS — a `dark:` variant or a `:root:not(.dark)` rule — never by reading the theme in React. Flat: no shadow.
  - [x] 6.5 Panel structure, and the aria rule that AC 3's literal wording would break:
    ```
    <section>                                   {/* the panel */}
      <h3 class="type-title">{title}</h3>
      <div class="pitch-panel">                 {/* bg-pitch-surface, rounded-lg, padding, dark:border */}
        <div class="grid md:grid-cols-2">       {/* <md: the ToggleGroup + ONE side */}
          <figure role="figure" aria-label={side.figureSummary}>
            <div> team code (accent, type-label-caps) + meta chips (type-caption) </div>
            <div class="relative">              {/* popover positioning context */}
              <svg width={W} height={H} viewBox="0 0 W H">
                <g aria-hidden="true"> pitch surface, stripes, markings, underlay </g>
                <g aria-hidden="true"> Voronoi hit cells — fill="transparent", pointer-events="all" </g>
                <g> focusable markers — pointer-events="none" </g>
              </svg>
              {popover}
            </div>
          </figure>
          … second side at ≥md …
        </div>
        <div> legend row </div>
        {note ? <p class="type-caption text-ink-secondary">{note}</p> : null}
        <div class="panel-foot border-t"> ViewDataDisclosure + attribution caption </div>
      </div>
    </section>
    ```
    - **Do not put `aria-hidden` on the root `<svg>`.** AC 3 says "the SVG is `aria-hidden` except focusable markers", but an `aria-hidden` subtree containing tabbable elements is an axe `aria-hidden-focus` violation and hides the markers from the very users the clause exists for. The intent is satisfied by hiding the decorative subtrees and exposing only the marker group (ruled decision 8).
    - **`role="figure"` sits on each half-pitch, not on the panel**, matching the desktop mockup (both of its `role="figure"` elements are the per-team SVGs) and EXPERIENCE's own example label, which names one team: "Mapa de tiros: México 14 tiros, 2 goles". A panel-level figure could not carry a one-sentence summary of two teams without inventing a sentence the spec never wrote. At `<md` only one figure is mounted at a time.
    - **Heading level is `<h3>`.** The page's hierarchy is sr-only `<h1>` (Hero) → one `<h2>` per Tactical section (`TacticalSection` owns it) → panel titles. The team code is a label, never a heading.
  - [x] 6.6 Interaction split — pointer and keyboard use different layers on purpose:
    - **Voronoi cells** are pointer-only: `aria-hidden`, no `tabIndex`, `onPointerDown`/`onClick` open the cluster's popover; a repeat click on the same cell cycles the stack's z-order (pointer redundancy per EXPERIENCE, and the only thing that gives a mouse user access to a hidden marker under another).
    - **Markers** are keyboard-only targets: `<g role="button" tabIndex={roving} aria-label={composed} class="focus-on-pitch" pointer-events="none">`. `pointer-events="none"` guarantees a click always resolves through the cell layer, so pointer and keyboard can never disagree about which cluster was hit. Add `aria-haspopup="dialog"` + `aria-expanded` **only on markers in a multi-marker cluster** — those are the ones that open a real dialog; a single marker's popover is `aria-hidden` (Task 6.7), and advertising `aria-expanded` for content assistive tech cannot reach is worse than saying nothing.
    - Roving tabindex per side: exactly one marker has `tabIndex={0}` (the first by minute), the rest `-1`; `ArrowRight`/`ArrowDown` next, `ArrowLeft`/`ArrowUp` previous, `Home`/`End` to the ends, no wrap. `Enter`/`Space` opens the popover for that marker's cluster.
  - [x] 6.7 Popovers — two variants, ruled decision 9:
    - **Single-marker cluster:** a visual-only panel (`aria-hidden="true"`) on `--surface-overlay` with `rounded-sm`, the DESIGN overlay shadow, showing the detail rows. It is `aria-hidden` **because its exact content is already the focused marker's accessible name** — announcing it twice is noise, and it needs no focus move.
    - **Multi-marker cluster:** a real `role="dialog"` with a localized `aria-label` and a `<ul>` of the stacked events; opening from a marker puts focus on that marker's own list item; `ArrowUp`/`ArrowDown` move between items and bring the corresponding marker to the front of the stack; `Esc` closes and returns focus to the marker that opened it (UX-DR15: Esc closes the topmost). One popover open per panel at a time — never a stack (UX-DR15 bans modal stacks > 1).
    - Positioned absolutely at the cluster centroid inside the `relative` wrapper, clamped so it never leaves the panel box. No positioning library, no Radix Popover: anchoring to an SVG child through Radix's collision machinery costs more than it saves here, and the panel is its own containing block.
    - Hover opens the single-marker variant (`onPointerEnter` on the cell, **guarded to `event.pointerType === "mouse"`** so a touch does not fire hover-then-tap and flicker the popover); leaving closes it. Touch and keyboard are the equal paths (UX-DR15: no hover-only information).
  - [x] 6.8 Focus ring on the pitch: add ONE utility to `app/src/app/globals.css` — `@utility focus-on-pitch { &:focus-visible { outline-color: var(--focus-ring-on-pitch); } }`. The global `:focus-visible` rule still supplies the 2 px outline and offset; this only recolours it to the near-white the pitch requires in **both** themes (the light `--ring` cyan computes 2.28:1 on the pitch). Never `outline-none` — that regression has cost a patch in two prior reviews.
  - [x] 6.9 Panel foot: `border-t` hairline, then the "Ver los datos / View data" disclosure control and the **permanent** attribution caption `type-caption text-ink-secondary` reading `viz.attribution` ("Datos: FIFA PMSR · wc-stats"). The caption is never conditional and never behind a disclosure — it must survive a screenshot (UX-DR21, UJ-2 step 5).
  - [x] 6.10 Legend row above the foot: one entry per encoding value, each a small inline SVG swatch plus its localized label, `type-caption`, wrapping at narrow widths. Export **one** `MarkerShapeGlyph({ shape, colorVar, radius })` from `PitchPanel.tsx` (or a sibling module) and use it for both the on-pitch markers and the legend swatches — the mockup hand-writes the swatch SVG a second time and that is exactly how a legend drifts out of sync with the map it explains. Do **not** ship the mockup's "Tamaño del marcador = xG" note — FD-1 removed xG sizing.
  - [x] 6.11 A side with `markers.length === 0` still renders its pitch, plus the resolved `zeroLine` as a `type-caption` line: `[]` means "the page was present and listed nothing", which is a fact about the match, not a missing section. This is Story 2.5's null-vs-`[]` rule and the ruling already recorded in `deferred-work.md` for `LineupsDisclosure` — "whoever picks it up should render a zero-content line inside the disclosure, not an `EmptyStatePanel`". Drawing the empty pitch also keeps the two sides the same height at `≥md`.

- [x] **Task 7: `ViewDataDisclosure.tsx` — the shared data-table alternative (AC: 1)**
  - [x] 7.1 Create `app/src/components/ViewDataDisclosure.tsx` (`"use client"`). A `<button aria-expanded aria-controls>` labelled `viz.viewData` / `viz.hideData` revealing a lazily-mounted region containing the caller's `<table>`. Mirror `KeyStatisticsSection`'s existing disclosure exactly: build the label key in a variable (`{t(cond ? "a" : "b")}` trips the i18n gate), and set `aria-controls` **only while the region is mounted** (a static one dangles in the collapsed default state — patched twice already).
  - [x] 7.2 The table itself is the caller's: a real `<table>` with `<caption>` stating the default order ("Ordenado por minuto." / "Sorted by minute."), `<thead>` with `<th scope="col">`, numeric cells right-aligned in `type-table-numeric` (tabular figures), hairline row dividers, **no zebra striping** (`{components.data-table}`). Coordinates render as two columns through `formatDecimal(v, locale, 2)` — the artifact's own precision, so the table is a faithful record of what the map plotted. Own-goal rows carry the existing `match.hero.ownGoal` suffix "(a.g.)" beside the outcome, which is how a reader reconciles an 8-row Paraguay log against 7 Paraguay markers. Wide at 390 px: the table scrolls **inside its own container** (`overflow-x-auto`), never the page (UX-DR16's data-table exception). Not sortable in this story — Story 2.11 owns `aria-sort`, the collator sort and the Expert-layer instance of these same logs. Say so in a comment so 2.11 knows where to plug in.
  - [x] 7.3 One "Ver los datos" per **panel**, not per side: the table carries a Team column and covers both teams, matching the mockup's single `panel-foot` beneath the two half pitches.

- [x] **Task 8: `ShotMapsSection.tsx` — the `#shot-maps` content (AC: 2, 4)**
  - [x] 8.1 Create `app/src/components/ShotMapsSection.tsx` (`"use client"`, `useT()` + `useLocale()`). Props are narrow and explicit — never the whole bundle (Story 2.5 Task 5.1 precedent):
    ```ts
    { shots: Shots; crosses: Crosses;
      home: { teamId: string; teamCode: string; name: string };
      away: { teamId: string; teamCode: string; name: string };
      teamXg: { home: number; away: number } }   // keyStatistics[side].expectedGoals, verbatim
    ```
    `name` is required because the figure summary names the team in words ("Mapa de tiros: México, 16 tiros, 2 goles") while the on-pitch label is the code; both come from `metadata.{home,away}Team` and are locale-neutral proper nouns that pass through untranslated (AD-7). `teamXg` is passed pre-extracted rather than handing down `keyStatistics`, so this component can never reach for a Domain B field it has no business rendering.
  - [x] 8.2 Renders **two** panel slots stacked with `mt-section-gap`: the shot map, then the cross map (ruled decision 1: the cross map lives inside `#shot-maps`; the registry stays at eleven sections). Each slot branches on `panelDataState` of its own table: `"absent"` (the table is `null`) renders `EmptyStatePanel` in the slot with a headline naming **that panel** — compose it with the shared helper around `tactical.empty.headlineBefore/After` and the panel's own title, so a crosses-less report reads "Sin datos de Mapa de centros para este partido." while the shot map renders normally (ruled decision 2). `"zero"` and `"ready"` both render the `PitchPanel`; the per-side zero case is Task 6.11's.
  - [x] 8.2a Extract `TacticalLayer`'s local `emptyHeadline(title)` into a shared helper exported next to `EmptyStatePanel` and have **both** call sites use it. Two independent copies of the same composition will diverge the first time the copy changes, and the 2.5 review already spent a decision getting this wording right.
  - [x] 8.3 Team A = home = `--viz-team-a`; Team B = away = `--viz-team-b`. Each half-pitch carries its team code as a **direct label** in the accent — which is what satisfies UX-DR11 here: the two teams are never in one chart (separate half-pitches at `≥md`, tabs at `<md`), so hue is never the sole distinguisher and no dashed/pattern Team-B treatment is needed. Say that in a comment; a reviewer will ask.
  - [x] 8.4 Each team's events render in **that team's own attacking frame** — both maps draw the attacked goal at the right (`≥md`) / top (`<md`). Do **not** mirror the away team's coordinates onto a shared pitch; AD-6 coordinates are already per-acting-team, and mirroring would be the "re-normalization" the invariant bans. The two half-pitches are two figures, not one pitch.
  - [x] 8.5 A shot or cross whose `teamId` matches neither `home.teamId` nor `away.teamId` **throws**, naming the offending id — a silent drop is exactly the class of finding prior reviews flagged (`groupScorers`, `composeMatchTitle`). `TacticalErrorBoundary` already contains the blast radius.
  - [x] 8.6 Panel meta chips and figure summaries, composed as **variables** from locale fragments (`t()` has no interpolation, and a template literal in a gated prop is a lint error — build the string, then pass the identifier):
    - shot chip: `xG {formatDecimal(teamXg[side], locale, 2)} · {formatInteger(markerCount, locale)} {t("viz.shotMap.shots")}` → es "xG 1,78 · 16 tiros" (the mockup's `.meta`, minus the xG-sizing claim). The `·` is a module const or a locale entry, never a bare literal.
    - cross chip: `{n} {t("viz.crossMap.crosses")} · {m} {t("viz.crossMap.completed")}`.
    - figure summary: `{t("viz.shotMap.figurePrefix")} {team.name}, {shots} {t(...shots)}, {goals} {t(...goals)}` → es "Mapa de tiros: México, 16 tiros, 2 goles", matching EXPERIENCE's own worked example. Counts come from `shotFigureCounts` (ruled decision 12), never from `keyStatistics.goals`.
  - [x] 8.7 The own-goal honesty note: when `hasExcludedOwnGoals` is true for either side, the shot panel renders `viz.shotMap.ownGoalsExcluded` as a `type-caption` note ("Los autogoles no se dibujan en el mapa; aparecen en la tabla."). m074 is the fixture that exercises it, and without the note Germany's map shows zero goal markers under a scoreline that says otherwise.
  - [x] 8.8 `app/src/components/TacticalLayer.tsx`: replace exactly one line of the dispatch — `case "shot-maps"` returns `<ShotMapsSection …/>` instead of `<PendingSectionPanel/>`. Nothing else in that file changes.

- [x] **Task 9: The `events.crosses` registry ruling (AC: 2, 4) — closes Story 2.5 review decision D7**
  - [x] 9.1 `app/src/lib/tactical-sections.ts`, `sectionDataState`: `shot-maps` becomes `events.shots !== null || events.crosses !== null ? "ready" : "empty"`. Ruled decision 2: the section is silent-absent only when **both** its tables are missing; when exactly one is missing the section is `ready` and the missing panel names its own absence with `EmptyStatePanel` in the panel slot (Task 6.11). A whole-section empty state for a report that carries crosses but no shots would hide present data, which is the FR-22 failure mode inverted.
  - [x] 9.2 Update the docblock above the predicate to record the ruling, and update `app/src/lib/tactical-sections.test.ts` — its existing constructed-bundle assertion `events.shots = null → "empty"` **is now wrong and will fail**. Replace it with the four-way truth table: `(shots, crosses)` = (`[]`,`[]`) → ready, (`null`,`[]`) → ready, (`[]`,`null`) → ready, (`null`,`null`) → empty. Keep every other section's assertions untouched.
  - [x] 9.3 Strike the `deferred-work.md` entry "**`events.crosses` is nullable and now ingested, but no section's data-state predicate reads it**" (under "Deferred from: code review of 2-5-…") with the ruling and a pointer to this story, in the same `~~strikethrough~~ — **RESOLVED by Story 2.7**` form the file already uses.

- [x] **Task 10: Locale entries (AC: all)**
  - [x] 10.1 `es.ts` (canonical) first, then `en.ts` (typed mirror — a missing key is a compile error). New `viz.*` namespace:
    - `viz.attribution` — es "Datos: FIFA PMSR · wc-stats" / en "Data: FIFA PMSR · wc-stats" (EXPERIENCE's ruled in-panel short form, verbatim).
    - `viz.viewData` "Ver los datos" / "View data"; `viz.hideData` "Ocultar los datos" / "Hide data" — `viz.viewData` is the one canonical control string (Voice & Tone: no ad-hoc variants).
    - `viz.teamSelector` (the radiogroup's `aria-label`) "Equipo" / "Team".
    - `viz.table.caption` "Ordenado por minuto." / "Sorted by minute."; column heads `viz.table.{team,player,minute,x,y,outcome,xg,delivery,completed}`; `viz.table.unknown` "—" (the placeholder for absent cross fields); `viz.table.yes` / `viz.table.no` for the completed column.
    - `viz.cluster.dialogLabel` "Eventos en este punto" / "Events at this point"; `viz.cluster.countBefore` / `.countAfter` if the count needs composing.
    - `viz.shotMap.title` "Mapa de tiros" / "Shot map"; `viz.shotMap.markerPrefix` "Tiro de" / "Shot by"; `viz.shotMap.minutePrefix` "minuto" / "minute"; `viz.shotMap.shots` "tiros" / "shots"; `viz.shotMap.goals` "goles" / "goals"; `viz.shotMap.xg` "xG" (both); `viz.shotMap.figurePrefix` "Mapa de tiros:" / "Shot map:"; `viz.shotMap.zero` "El informe no registra tiros para este equipo." / EN mirror; `viz.shotMap.ownGoalsExcluded` "Los autogoles no se dibujan en el mapa; aparecen en la tabla." / "Own goals are not drawn on the map; they appear in the table."
    - `viz.crossMap.title` "Mapa de centros" / "Cross map"; `viz.crossMap.markerPrefix` "Centro de" / "Cross by"; `viz.crossMap.crosses` "centros" / "crosses"; `viz.crossMap.completed` "Completado" / "Completed"; `viz.crossMap.attempted` "Intentado" / "Attempted"; `viz.crossMap.figurePrefix` "Mapa de centros:" / "Cross map:"; `viz.crossMap.zero` EN/ES mirror.
  - [x] 10.2 Fill the reserved-and-still-empty `enums.shotOutcome` namespace with exactly five entries, keyed by the `ShotOutcome` codes, verbatim from the ruled i18n table row ("shot outcomes (legend + log headers)"): `goal` "Gol"/"Goal", `on-target` "Al arco"/"On target", `off-target` "Desviado"/"Off target", `blocked` "Bloqueado"/"Blocked", `incomplete` "Incompleto"/"Incomplete". **Do not** add `ShotOutcomeDetail` labels — see Task 10.4.
  - [x] 10.3 Add `enums.crossDelivery`, one entry per `CrossDeliveryType` (six). These are new terms with no row in EXPERIENCE's per-term table; decided here under its Spanish-first tie-breaker and recorded in this story's ruled decisions (decision 10): `inswing` "Cerrado"/"Inswinging", `outswing` "Abierto"/"Outswinging", `driven` "Tenso"/"Driven", `lofted` "Bombeado"/"Lofted", `cutback` "Atrás"/"Cutback", `push-cross` "Empujado"/"Push cross". Short forms because they sit in a table column; the column head names the dimension ("Tipo de centro").
  - [x] 10.4 **CS-1 clearance, stated so review does not re-open it:** `deferred-work.md` binds "stories 2.7/2.13/2.18 build their label/legend/locale maps against the post-CS-1 24-value enum". This story maps **`ShotOutcome` only** — the stable five-value marker enum — and never `ShotOutcomeDetail`, whose 22→24 extension is CS-1's payload. Both the marker encoding and the log's Outcome column read `outcome`, which AD-14 decision CR-2 explicitly makes authoritative for marker encoding ("the App treats `outcome` as authoritative, never derived from `outcomeDetail`"). So this story is CS-1-proof; the detail labels belong to 2.11/2.13/2.18.
  - [x] 10.5 Update the two Story 2.5 entries the section now outgrows: `tactical.sections.shot-maps.title` → es "Mapa de tiros y centros" / en "Shot & cross maps", and `.summary` → es "Desde dónde llegaron los tiros y los centros de cada equipo." / en mirror. Ruled decision 11: the old title "Mapa de tiros y xG" promises a per-shot xG that FD-1 established does not exist, and the section now carries two maps.
  - [x] 10.6 Gate reality (2.1/2.2/2.4/2.5 reviews all paid for this): every user-facing string including every `aria-label` goes through `useT()`; `{t(cond ? "k1" : "k2")}` fails — build keys in a helper; `·`, `—`, `▸` and every separator glyph is a module const or a locale entry, never a bare JSX literal; the gated prop names are `aria-label|aria-description|aria-placeholder|aria-roledescription|aria-braillelabel|aria-valuetext|title|alt|placeholder|label|message|text|description|caption|heading|tooltip` on **any** element including your own components — note `label` and `caption` are gated, so a `PitchPanel` prop named `title` must receive an identifier, never a literal.

- [x] **Task 11: Tests (AC: all)**
  - [x] 11.1 The pure suites from Tasks 2.8, 3.8 and 4.5, in `app/src/viz/*.test.ts` (node env — the harness has **no jsdom** by the deliberate 2.2 decision; do not add it, do not add Testing Library). Add `panelDataState` to the marker-model tests: `null` → `"absent"`, `[]` → `"zero"`, non-empty → `"ready"` — the three-way branch Task 8.2 dispatches on, and the reason the partial-absence path has a test at all in a harness that cannot render.
  - [x] 11.2 `app/src/lib/i18n.test.ts`: assert `enums.shotOutcome` has exactly one entry per `ShotOutcome` and `enums.crossDelivery` one per `CrossDeliveryType`, resolvable in **both** locales (loop ids × `["es","en"]` through `t()` — this catches a missed `en` mirror even though the type system also would). Follow the existing `enums.metric` assertion's shape.
  - [x] 11.3 `app/src/lib/tactical-sections.test.ts`: the Task 9.2 truth table, plus the existing suite unchanged and green.
  - [x] 11.4 `app/src/lib/eslint-gate.test.ts`: the Task 1.4 `src/viz/**` seam fixture.
  - [x] 11.5 `app/src/app/matches/static-output.test.ts`: no new assertions needed — its AR-11 absence guard already loops all eleven section ids and must stay green (the Tactical Layer is client-only, so no pitch markup may appear in `out/`). Re-run it; if it goes red, something moved the layer to the build-time path, which is the one change this story must not make.
  - [x] 11.6 All existing tests stay green. Baseline **measured at `f8ca7ee` while this story was written: 138 passed / 10 files** (`npm test`, 12.4 s), `npm run build` green. Re-confirm before you start and record both figures.

- [x] **Task 12: Verify (AC: all)**
  - [x] 12.1 `npm run build` (lint `--max-warnings 0` → tsc → schema assert → next build → copy-data) then `npm test`, in that order — the static-output tests read `out/`.
  - [x] 12.2 Browser over a static server rooted at `app/out/` (`python -m http.server 8765 --directory app/out`; `/data/*` 404s under `next dev` — do not add dev rewrites). Note `trailingSlash: true`, so deep links are `/matches/{slug}/#shot-maps`.
  - [x] 12.3 **SM-3 spot check — the AC 2 clause with real ground truth.** `spike/mex_rsa.pdf` *is* the m001 source report, and `spike/shots_ref.png` / `spike/shots_overlay.png` are rendered references from the Story 1.3 spike. Open `/matches/m001-mexico-south-africa/#shot-maps` and compare Mexico's map against the PDF's shots page: **16 markers, 2 goal / 2 on-target / 8 off-target / 3 blocked / 1 incomplete** (Story 1.3's permanent ground truth), same relative layout, same side of the pitch, no mirroring, no transposition. Compare at `<md` first — the vertical, attacking-goal-up orientation is the source's own drawing orientation, so it is a direct visual overlay. Record the comparison in the Debug Log; a transposed frame is the single highest-risk defect in this story and it passes every unit test that only checks that a number came out.
  - [x] 12.4 At **≥1024 px** on m001: both panels render two half pitches side by side; hairline border visible on the pitch in dark theme and absent in light; legend shows five outcome entries with matching swatch shapes; attribution caption visible in both panels; no horizontal page scroll.
  - [x] 12.5 **Cluster behaviour, m001 Mexico** (the fixture has real near-pairs at x/y 78.5/41.5 + 79.4/41.9, and 86.8/30.3 + 88.2/33.9 + 89.0/34.4): tapping the cluster opens the list popover; repeat taps cycle the z-order; the individual markers stay exactly where they are drawn (screenshot before/after and confirm no displacement). Then keyboard: Tab into the figure, arrow through all 16 markers in minute order, Enter opens the popover with focus on the matching list item, arrows move within it, Esc closes and returns focus to the marker.
  - [x] 12.6 Measure a hit area: pick two adjacent Voronoi cells and confirm each measures ≥44 CSS px across at 390 px width. Record the measurement.
  - [x] 12.7 At **390 px**: team tabs render, one vertical half pitch at a time with the attacking goal **up**, arrow keys move between the two team options, positions unchanged from the `≥md` rendering (same 0–100 values, different projection), zero horizontal scrolling. Probe **320 px** too (WCAG 1.4.10 reflow floor — the page passes there today and must keep passing). The known 195 px (200 % zoom) overflow is filed for Story 2.19 and owned by header + Hero + key-stats; **do not** let the pitch panels join that list — a panel is width-fluid and has no excuse.
  - [x] 12.8 **m074** (`ownGoal: true`, 9 shootout attempts, 72 crosses): Germany's map shows 21 markers and **zero** green goal markers; the own-goal note renders; the shot log shows 8 Paraguay rows against 7 Paraguay markers; no shootout attempt appears anywhere. **m002**: three stoppage-minute shots order correctly (`45+3` between `45` and `46`) in both the roving order and the table.
  - [x] 12.9 "Ver los datos" on each panel: opens a real `<table>` in place with a caption stating the minute order; the xG column is **absent**; numbers are tabular and right-aligned; toggling collapses it and `aria-controls` disappears with the region.
  - [x] 12.10 Toggle **EN** after load: panel titles, legend labels, outcome labels, delivery-type labels, column heads, popover rows, every marker `aria-label`, the figure `aria-label`, the note and the attribution all swap; coordinates reformat (`70,87` → `70.87`). Toggle **light theme**: the pitch stays deep green, the pitch border disappears, the focus ring on a marker stays the near-white `focus-ring-on-pitch` (not cyan) — this is the DESIGN clause the light theme exists to break.
  - [x] 12.11 `prefers-reduced-motion: reduce` (Chrome DevTools rendering pane): nothing in the panels animates. Nothing in this story should add motion in the first place — verify rather than assume.

## Dev Notes

### What this story is, in one line

The **reusable pitch-panel infrastructure** — coordinate projection, pitch drawing, Voronoi hit partitioning, cluster popovers, keyboard roving, the data-table alternative and the attribution caption — proven by its **first two consumers**, the shot map and the cross map, both mounted in `#shot-maps`. Stories 2.8 (pass network) and 2.9 (receiving / defensive-action maps) build on what you ship here; every shot-specific decision that leaks into `PitchPanel` becomes their problem.

### The three facts that shape every design choice below

1. **AR-6 is the invariant most likely to break silently.** The App may apply affine viewport transforms (rotate, scale, translate, crop) and nothing else. A transposed or mirrored frame renders a plausible map that passes every arithmetic test and fails the SM-3 spot check — which is why Task 12.3 compares against `spike/mex_rsa.pdf` (the actual m001 report) rather than against another number the code produced.
2. **The harness has no jsdom** (deliberate 2.2 decision, restated by 2.5). Nothing rendered can be unit-tested. Therefore *all* the logic — projection, ordering, clustering, Voronoi, the encoding maps, the log rows, the figure counts — lives in pure modules under `app/src/viz/` with real tests, and the components stay thin. This is the same split that made `tactical-sections.ts` / `buildSectionPlans` the tested heart of Story 2.5, and the 2.5 review's headline patch was precisely "the logic AC 1 is about was the one part with no test".
3. **The Tactical Layer is client-only (AR-11).** No pitch markup exists in `out/`; static-output tests can only assert its *absence*. Deep links already work through `TacticalLayer`'s mount-time hash read — do not add a second mechanism. Content lazy-mounts on expand, which is exactly why `TacticalSection` chose lazy mount over `hidden`: "the pitch panels 2.7–2.9 will mount d3 and must not pay for 9 hidden vizzes."

### Contract shapes (fixture-verified, quote-accurate)

- `ShotEvent` = `{ teamId, playerId, playerName, at: MinuteStamp, x, y, outcome, outcomeDetail, bodyPart, deliveryType, expectedGoals, ownGoal }`. `expectedGoals` is `ShotExpectedGoals = ExpectedGoals | null` and is **`null` on every shot in every fixture** — and in every real report (FD-1).
- `ShotOutcome` = `"goal" | "on-target" | "off-target" | "blocked" | "incomplete"` — the five-value marker enum, stable, **not** touched by CS-1. Schema comment names the source RGBs: `(0.00,0.50,0.00)=goal, (0.36,0.61,0.84)=on-target, (0.96,0.74,0.00)=off-target, (0.70,0.53,1.00)=blocked, (0.18,0.30,1.00)=incomplete`.
- `CrossEvent` = `{ teamId, playerId, playerName, at, x, y, deliveryType, completed }`. `CrossDeliveryType` = `inswing | outswing | driven | lofted | cutback | push-cross`.
- `EventTables` schema `$comment`, verbatim: "Every table is a flat array carrying an explicit `teamId` per row, so one shape serves both the pitch panel and the accessibility data table — there are no 'lite' variants… An empty array means zero events of that kind; **null means the report does not carry that data at all**."
- `ShotEvent`'s own `$comment`: "Shoot-out attempts never appear here — they would break marker-count self-validation and **Story 2.7 never plots them**."
- `MinuteStamp` = `{ minute, stoppageMinute: number | null }`. `formatGoalMinute(at)` in `@/lib/match-hero` already renders `"8′"` / `"90+2′"` — **import it, do not re-implement it.**

**Fixture reality (all three bundles, measured while writing this story):**

| Bundle | shots | crosses | notable |
|---|---|---|---|
| m001 mexico–south-africa | 19 (MEX 16, RSA 3) | 21 | MEX distribution **2/2/8/3/1** = Story 1.3's ground truth for `spike/mex_rsa.pdf`; two real marker near-pairs |
| m002 korea-republic–czechia | 22 | 32 | **3 stoppage-minute shots** — the only fixture that exercises `45+3` ordering; `momentum: null` |
| m074 germany–paraguay | 29 | 72 | **1 own-goal shot** (GOMEZ, teamId `paraguay`, outcome `goal`); **9 shootout attempts**; largest cross set |

- Shot x-range across all fixtures: **70.34–98.71**; cross x-range **60.38–94.80** — every event is in the attacking half, which is why the half pitch is the default and why `pitchExtentFor` exists rather than a hardcoded `xMin = 50`.
- No two shots in any fixture share an exact coordinate, so **overlap is a clustering problem, not a duplicate-point problem** — but AD-8 guarantees the pipeline never dedupes coincident markers, so `n` identical points must not crash the Voronoi (Task 3.5).
- `keyStatistics[side].shots` equals the own-goal-excluded marker count on all six team-innings, and `keyStatistics[side].crosses` equals the plotted cross count on all six. Record it; do not depend on it.
- **The trap this table exists to prevent:** m074 Germany has `keyStatistics.home.goals === 1` and **zero** goal markers, because Germany's only goal was Paraguay's own goal, which AD-6 attributes to the benefiting team in the scorer list and **excludes from the shot map**. Any figure summary built from `keyStatistics.goals` ships a visible lie.

### Existing code you build on (do not reinvent)

- `src/components/EmptyStatePanel.tsx` — `EmptyStatePanel` (absent data) and `PendingSectionPanel` (data present, view not shipped). Task 8.8 deletes this section's `PendingSectionPanel` line; Task 6.11 reuses `EmptyStatePanel` for a per-panel absence. Props are **already-resolved strings** (`headline`/`explanation` are deliberately outside the i18n gate's reserved prop names).
- `src/components/TacticalLayer.tsx` — the dispatch switch, one line per section, with a `default` that throws. Also holds `emptyHeadline(title)`, which composes AC 3's section-named copy around `tactical.empty.headlineBefore/After`. If you need the same composition for a panel-level absence, **extract that helper next to `EmptyStatePanel` and have both call it** — two copies of the same composition will diverge.
- `src/components/TacticalSection.tsx` — the shell, its lazy mount and its focus contract. Do not touch it.
- `src/components/ui/toggle-group.tsx` — vendored Radix `ToggleGroup`; `type="single"` gives `role="radiogroup"` / `role="radio"` + roving focus + arrow keys for free. `SiteHeader` is the usage precedent.
- `src/lib/use-media-query.ts` — `useMediaQuery`, `MD_MEDIA_QUERY`, `LG_MEDIA_QUERY` (declared in **rem**, matching Tailwind 4's own breakpoints; do not add a px one). `useSyncExternalStore`-based so the first client render is already at the right breakpoint.
- `src/lib/format.ts` — `formatDecimal / formatInteger / formatPercent / formatDate / formatKickoff / compareText`. The only formatting path; all fail loud on non-finite input. **Never pre-sanitize, never `toFixed`.** A `null` xG must be branched on before it reaches a formatter.
- `src/lib/match-hero.ts` — `formatGoalMinute(at)`, `resolveLeader`. Import; never copy, never "generalize".
- `src/lib/i18n-provider.tsx` — `useT()` / `useLocale()`, mandatory under `src/components/**` (and, after Task 1.3, `src/viz/**`). `t()` has **no interpolation** and takes a statically-typed dot path.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge). Hand-rolled template-literal `className`s were patched in the 2.4 review; use `cn()`.
- Tokens already in `globals.css`: `--pitch-surface / --pitch-stripe / --pitch-line / --focus-ring-on-pitch` (theme-invariant, defined outside the light/dark blocks), `--shot-goal / -on-target / -off-target / -blocked / -incomplete` (with `-light` variants swapped automatically by the theme class), `--viz-team-a / -b`, `--color-*` Tailwind bridges for all of them; `type-title / type-caption / type-table-numeric / type-label-caps / type-headline`; spacing `tile-gap 12 / section-gap 48 / layer-gap 64 / gutter-desktop 24`; radii `sm/md/lg`. **The only CSS addition this story makes is Task 6.8's `focus-on-pitch` utility** — no new tokens, no new colors.
- `radix-ui` is already a dependency, so a vendored Popover/Tabs is *possible* — deliberately not doing either (ruled decisions 7 and 9).

### Ruled decisions (spec gaps closed by this story — flag in review if any looks wrong)

1. **The cross map lives inside `#shot-maps` as a second panel; the registry stays at eleven sections.** EXPERIENCE's normative Tactical order lists "shot maps + xG" and never names a cross section, but epic 2.7's AC 4 requires the cross map. A twelfth anchor would contradict the "full normative order" Story 2.5 declared complete and that 2.8–2.10 iterate. *Rejected alternative:* a `#cross-maps` section (breaks the declared-complete registry and the PRD §4.6 order).
2. **`#shot-maps` is `empty` only when `shots` AND `crosses` are both `null`.** Closes Story 2.5 review decision D7, deferred to this story with the reason "2.7 owns shot/cross maps and should rule". A single missing table names its own absence inside the panel; the section keeps its heading, anchor and the data it does have. *Rejected alternative:* keying the section on `shots` alone (a crosses-only report would render a section-wide "the official report does not include this section" over data that is sitting in the bundle — FR-22 inverted).
3. **Half pitch by default, full pitch the moment any event has `x < 50`.** All six fixture team-innings are entirely in the attacking half and both mockups draw half pitches; a long-range attempt in real data must never be clipped, clamped or dropped (AD-8's spirit, AR-6's letter). The extent is computed from the data, per panel side. *Rejected alternative:* a fixed `xMin = 50` with clamping — that is coordinate rewriting, which AR-6 bans outright.
4. **Cross markers carry the acting team's accent with completion dual-encoded by fill (filled = completed, hollow 2 px stroke = not), not the shot-outcome hues.** DESIGN's five-outcome table is written for "shot maps and cross maps", but crosses have a two-value outcome that the five hues do not model. Borrowing two shot hues would put one hex on two meanings inside a single section where both panels are often on screen at once — the exact collision DESIGN's "hex values are unique per meaning" rule exists to prevent. Team-accent + shape is the grammar DESIGN already rules for the other Domain D marker maps (2.9), so this also keeps 2.9 consistent with 2.7. The source's own legend (orange = attempted, blue = completed, per Story 1.11's corpus finding) is honoured in *structure* — two values, dual-encoded — not in hue. *Rejected alternative:* `--shot-on-target` = completed / `--shot-off-target` = attempted (defensible, and closer to the source's colours, but breaks hue uniqueness across the section).
5. **Layout arithmetic in measured CSS px, not in a scaling viewBox.** The ≥44 px hit floor and the marker radius are CSS-px obligations; a viewBox that scales with the container turns a 44-unit threshold into 31 px on a 288 px phone — silently, in exactly the viewport the floor protects. `ResizeObserver` + `viewBox="0 0 W H"` makes one unit one px by construction. *Rejected alternative:* a fixed viewBox sized to the smallest expected rendering (fragile: it encodes an assumption about container widths that a future layout change invalidates without any test noticing).
6. **The side-by-side / tabs split lands at `md`, not `lg`.** EXPERIENCE's Responsive table specifies `≥lg` and `<md` and leaves `md`–`lg` undefined; two half pitches fit at 768 px inside the route's `max-w-6xl`, and `MD_MEDIA_QUERY` already exists for Key Statistics. One breakpoint constant, one behaviour.
7. **Vendored `ToggleGroup` for the team selector, not a vendored Radix `Tabs`.** It already ships radiogroup semantics with roving focus and arrow keys, it is the same primitive as the header's `ES | EN` control, and it adds no new vendored component — the same reasoning that chose a native `<button aria-expanded>` over a vendored Accordion in Story 2.5 (ruled decision 6). "Team tabs" in the AC names the *affordance*, not the ARIA role. *Rejected alternative:* real `role="tab"`/`tabpanel` semantics (more code, a second selector grammar on one page, no user-visible gain for a two-option switch).
8. **The root `<svg>` is not `aria-hidden`; its decorative subtrees are.** AC 3's literal wording ("the SVG is `aria-hidden` except focusable markers") describes an impossible element: `aria-hidden` containing tabbable descendants is an axe `aria-hidden-focus` violation and would hide the markers from screen-reader users entirely. Pitch, stripes, markings and hit cells are `aria-hidden`; the marker group is exposed; the `<figure>` carries `role="figure"` + the one-sentence `aria-label`. Intent honoured, mechanism corrected.
9. **Two popover variants: a single-marker panel that is `aria-hidden`, and a cluster `role="dialog"` that is not.** A single marker's popover content *is* its focused marker's accessible name, so exposing both announces everything twice and needs a focus move for no gain. A cluster popover is genuinely new content with a navigable list, so it is a real non-modal dialog with focus management and Esc-to-close. Hand-positioned inside the panel's own containing block — no Radix Popover, whose collision/anchor machinery is built for DOM triggers, not SVG children. *Rejected alternative:* one uniform dialog for both (double announcement on every single marker, which is the overwhelmingly common case).
10. **Six new `CrossDeliveryType` labels decided here, Spanish-first, short-form.** EXPERIENCE's per-term table has no rows for them and says new terms get decided under the same tie-breaker and land in the locale files. Short adjectives ("Cerrado / Abierto / Tenso / Bombeado / Atrás / Empujado") because they live in a table column whose head already names the dimension; the long forms ("centro cerrado") would wrap at 390 px, and Spanish already runs 20–30 % longer than English there.
11. **`tactical.sections.shot-maps.title` becomes "Mapa de tiros y centros" / "Shot & cross maps".** The Story 2.5 title promises xG that FD-1 established does not exist per shot, and the section now carries two maps. The summary line follows.
12. **The figure summary and panel chips count rendered markers; only team xG comes from `keyStatistics`.** Counting the marks you drew is describing your own figure — AD-5's narrow carve-out covers within-match, single-surface, non-Hero derivations explicitly. Reading `keyStatistics.goals` instead would render "1 gol" over m074 Germany's goal-less map. Team xG (`expectedGoals`) is a real artifact total and renders verbatim.

**AD-5 clearance (pre-empting the obvious review question):** nothing here derives a cross-match value. Coordinates render verbatim; team xG renders verbatim; the only computed numbers are counts of the marks this panel itself drew and the geometric layout of those marks — presentation geometry, on exactly one surface, never Hero-critical.

### Prior-story intelligence you must not re-learn the hard way

From the 2.1 / 2.2 / 2.4 / 2.5 reviews (each cost a patch round):

- `outline-none` anywhere kills the global `:focus-visible` ring — the compiled utility beats the `@layer base` rule. Never. Recolour with `outline-color`, as Task 6.8 does.
- `min-h-11` belongs on the interactive element, not on a wrapper.
- Arbitrary type sizes (`text-[13px]`) are rejected on sight; `globals.css` is the single token source.
- `aria-controls` must not reference an element that does not exist — set it only while the region is mounted. Patched twice (`TacticalSection`, `KeyStatisticsSection`); do not make it three.
- Hand-rolled `className` template literals ship dangling separators and skip tailwind-merge — use `cn()`.
- Tests that restate the function under test prove nothing. Assert literals and structure.
- Silent-discard branches get flagged: an unknown `teamId`, an unknown `ShotOutcome`, an unmapped `CrossDeliveryType` must throw with the offending value, not vanish.
- `skipIf`-style test guards must key on the coarse artifact (`out/`) and then assert the specific one exists, or a partial export reports green.
- The i18n gate cannot see inside a template literal assigned to a variable — that is a hole, not a licence: route separator glyphs through the locale layer or module consts anyway.
- Do **not** re-derive breakpoints in px (the 2.5 review patched exactly that px-vs-rem desync).

### Boundaries — do NOT build (later stories own these)

Pass networks, node isolation, the edge-weight ramp (2.8); receiving / movement-to-receive / defensive-action maps and the heatmap decision (2.9) — though both inherit `PitchPanel`, so leave the seam clean and build nothing speculative beyond the `underlay` prop; phases / pressing / set-plays / goalkeeping (2.10); **sortable** tables, `aria-sort`, the collator sort and the Expert-layer event logs (2.11) — this story ships a plain, minute-ordered table and says where 2.11 plugs in; the momentum timeline (2.6); glossary tooltips on any term in this section (2.18 marks the whole layer at once — a dotted underline with no popover behind it is a broken promise); the real-data swap and Lighthouse/axe hardening (2.19). Do not add jsdom, Testing Library, a state library, a client cache, a new Context, or any runtime dependency beyond `d3-delaunay`. Do not touch `pipeline/**`, `contract/**`, `data/**`, the layout/providers/bootstrap/storage/format modules, or the vendored `ui/*` components. Do not move the Tactical Layer to the build-time path.

### Coordination & hygiene

- Story **1.10** is in review and pipeline stories are in dev in other sessions; the working tree carries their uncommitted `pipeline/` changes. This story touches `app/` only. **Never `git add -A`** — stage `app/`, `_bmad-output/implementation-artifacts/2-7-*.md`, `deferred-work.md` and `sprint-status.yaml` explicitly (2.3 review lesson, restated by 2.5).
- **The full-corpus pipeline batch exits 1 by design from Story 1.12 onward** (ruled 2026-07-25): the clean baseline is `extracted 104 / failed 0 / self-validation-failed 2` (`PMSR-M19-ARG-V-ALG`, `PMSR-M58-TUN-V-NED`). Nothing in this story runs it — recorded only so a stray red exit code is not mistaken for your doing.
- CS-1 (the 2.3 sign-off change-set) will bump `schemaVersion` 1→2 and regenerate fixtures + types before Story 1.16. Task 10.4 explains why this story is immune, but never hardcode `SCHEMA_VERSION` or any enum; if the bump lands mid-story, run `npm run generate:types` and continue.
- Data source stays `data/fixtures/` until 1.19 (AD-14). Both `DATA_ROOT`s flip together in 2.19 — do not touch either.
- Test baseline at `f8ca7ee` (Story 1.12's code-review commit, which landed while this story was being written): **138 passed / 10 files**, `npm run build` green. Stories 1.10 (in review) and the pipeline README/checks edits sit uncommitted in the working tree — none of them touch `app/`.

### Latest-tech notes (verified against npm, 2026-07-26)

- `d3-delaunay@6.0.4` is the current release and is exactly the Voronoi module inside the architecture's pinned `d3@7.9.0` (which is itself still the latest d3). `@types/d3-delaunay@6.0.4` supplies the types (the package ships none). It is ESM-only — fine under Next 16.
- Latest `d3@7.9.0` / `d3-scale@4.0.2` are deliberately **not** installed (Task 1.1); record the decision in the completion notes so a future reader does not "fix" the missing dependency.
- `Delaunay.from(points, fx, fy)` + `.voronoi([x0, y0, x1, y1])` + `voronoi.renderCell(i)` gives an SVG path string per point. `renderCell` writes into a path context; the no-argument form returns a string. Degenerate inputs (n ≤ 1, all-collinear) are the documented rough edges — Task 3.5 special-cases them rather than trusting them.
- Pinned app stack unchanged: Next 16.2.11 / React 19.2.8 / TypeScript 6.0.x / Tailwind 4.3.x / vitest 3.2.7 / radix-ui 1.6.5. `next build` does not lint — the npm `build` chain is the gate. Under `output: 'export'` there is no server boundary below the Hero; client-only is the design, not a limitation.
- `ResizeObserver` is baseline in every supported evergreen browser (PRD: latest two majors of Chrome/Edge/Firefox/Safari); guard it anyway, the way `use-media-query.ts` guards `matchMedia`, so a throw degrades instead of blanking the route.

### Project Structure Notes

- **CREATE:** `app/src/viz/pitch-geometry.ts` + `.test.ts`; `app/src/viz/marker-layout.ts` + `.test.ts`; `app/src/viz/marker-model.ts`; `app/src/viz/shot-map-model.ts` + `.test.ts`; `app/src/viz/cross-map-model.ts` + `.test.ts`; `app/src/lib/use-element-width.ts`; `app/src/components/PitchPanel.tsx`; `app/src/components/ViewDataDisclosure.tsx`; `app/src/components/ShotMapsSection.tsx`.
- `app/src/viz/` is the architecture's own structural seed (`app/src/viz/ # d3 pitch visualizations + recharts charts`) and this story is the first to create it — which is why Task 1.3 extends the ESLint client-import seam to cover it.
- **UPDATE:** `app/src/components/TacticalLayer.tsx` (one dispatch line); `app/src/lib/tactical-sections.ts` + `.test.ts` (the `shot-maps` predicate); `app/src/locales/es.ts` + `en.ts`; `app/src/app/globals.css` (the `focus-on-pitch` utility only); `app/eslint.config.mjs` (one `files` entry); `app/src/lib/eslint-gate.test.ts`; `app/src/lib/i18n.test.ts`; `app/package.json` + `package-lock.json`; `_bmad-output/implementation-artifacts/deferred-work.md` (strike the D7 entry).
- Naming: PascalCase component files in `src/components/`; kebab-case pure modules in `src/viz/` and `src/lib/`. Client route bodies live in `src/components/`, never colocated under `src/app/` (that path escapes the i18n import seam — a known deferred gap; do not trigger it).

### References

- Epics: story spec + FR/NFR/UX-DR/AR texts — `_bmad-output/planning-artifacts/epics.md` (Story 2.7 at ~line 747; FR-24 line 53; NFR-2 line 68; AR-6 line 87; UX-DR9 line 112, UX-DR10 line 113, UX-DR11 line 114, UX-DR15 line 118, UX-DR16 line 119, UX-DR17 line 120, UX-DR21 line 124; the FD-1 amendment note at line 765)
- Architecture: `.../architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md` (**AD-6 verbatim** — the load-bearing invariant; AD-5 aggregation carve-out; AD-7 enums/units; AD-10 state rules; AD-11 rendering split; AD-12 i18n; AD-13 locked trees; AD-14 fixtures; Stack table's d3 7.9.x pin; Structural Seed's `app/src/viz/`)
- UX: `.../ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md` (Component Patterns → **Pitch panel**, Data table; Interaction Primitives; Accessibility Floor; Responsive & Platform table; Visualization Layering; i18n & Terminology → shot outcomes row + **Attribution OQ-3 in-panel short form**), `DESIGN.md` (`{components.pitch-panel}`, `{components.data-table}`, Data-visualization palette → **shot-outcome table with the mandatory shape column**, Focus on the pitch, Two-team contrast pair, Elevation & Depth → pitch border rule, Shapes → internal padding), `mockups/key-match-dashboard-desktop.html` lines 283–382 (**the 5-outcome shot map: two half-pitches in one panel, shared legend, one panel-foot with "Ver los datos" + attribution**), `mockups/key-match-dashboard-mobile.html` line 326 (the collapsed `#shot-maps` shell). Mocks illustrate; spines win on conflict.
- Contract/fixtures: `app/src/lib/contract/contract-types.d.ts` (`ShotEvent`, `ShotOutcome`, `CrossEvent`, `CrossDeliveryType`, `EventTables`, `MinuteStamp`); `contract/match-bundle.schema.json`; `contract/README.md` → "Story 2.3 sign-off (v1)" (FD-1, CR-1, CR-2); `data/fixtures/matches/{m001-mexico-south-africa,m002-korea-republic-czechia,m074-germany-paraguay}.json`
- Source ground truth for SM-3: `spike/mex_rsa.pdf` (= the m001 report), `spike/shots_ref.png`, `spike/shots_overlay.png`; `pipeline/markers/shots.py` module docstring (the AD-6 normalization formulas and the transposition trap it defends against)
- Prior stories: `2-5-tactical-layer-shell-key-statistics-empty-state-pattern.md` (the shell, the empty-state pattern, ruled decisions 1–10, the review's decision D7 deferred here), `2-4-match-route-hero-layer.md`, `2-3-contract-v1-per-surface-sign-off.md` (FD-1's origin); `_bmad-output/implementation-artifacts/deferred-work.md` (D7 entry to strike; the Story 1.11 `CrossEvent` unfulfillable-fields blocker; CS-1's Epic-2 binding; the 195 px reflow item owned by 2.19)
- App code: `app/src/components/{TacticalLayer,TacticalSection,EmptyStatePanel,KeyStatisticsSection,MatchBundleRegion,SiteHeader}.tsx`, `app/src/components/ui/toggle-group.tsx`, `app/src/lib/{tactical-sections,use-media-query,format,match-hero,i18n,i18n-provider,utils}.ts`, `app/src/app/globals.css`, `app/eslint.config.mjs`, `app/vitest.config.ts`

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context)

### Debug Log References

**Baseline re-confirmed at `f8ca7ee` before starting (Task 11.6):** `npm test` -> **138 passed / 10 files** (8.85 s); `npm run build` green. Both figures match the story's measured baseline exactly.

**Task 1 red-state note.** The `src/viz/**` seam fixtures (Task 1.4) were not run against a reverted config; the red state is already proven by the *existing, passing* sibling assertion `direct t() stays legal outside src/components`, which asserts `toEqual([])` for `src/app/__seam_probe__.tsx`. That is the identical mechanism -- a directory absent from the seam's `files` list produces zero `no-restricted-imports` errors. Every other module in this story was written test-first with the red run observed (`pitch-geometry`, `marker-layout`, both map models all failed to resolve their import before implementation).

**Task 12.3 -- SM-3 spot check (the highest-risk defect in this story).** Verified at `<md` against Story 1.3's permanent ground truth for `spike/mex_rsa.pdf` (= the m001 report). Measured in the live DOM at a 386 px viewport:

- **16 markers**, distribution **Gol 2 / Al arco 2 / Desviado 8 / Bloqueado 3 / Incompleto 1** -- exactly `2/2/8/3/1`.
- **Orientation is the source's own**: penalty area flush to the panel's TOP edge (`y = 12`, depth 68.4 px, width 171.4 px across), six-yard box nested inside it, goal mouth hanging OUTSIDE the goal line at `y = 8` in the padding. Attacking goal is up the page.
- **The projection was checked numerically against the artifact, not against another number the code produced.** Raul JIMENEZ, minute 4, artifact `x = 95.28 / y = 32.00` -> rendered at `translate(104.5, 32.5)`; hand-derivation `cx = 12 + (32.00/100) * 289 = 104.5`, `cy = 12 + ((100-95.28)/50) * 217.7 = 32.5`. Exact. No transposition, no mirroring.

**Tasks 12.4-12.7, 12.10, 12.11 -- measured, not eyeballed.** Over a static server rooted at `app/out` (`python -m http.server 8765`), `trailingSlash: true` deep links:

- `>=lg` (1920 px): both panels render two half-pitches side by side; four `role="figure"` elements with the correct one-sentence labels; the root `<svg>` carries `aria-hidden = null` (ruled decision 8 holds); exactly one `tabindex="0"` marker per figure; the attribution caption is present in BOTH panels.
- **Theme border rule:** dark -> panel `border-top-color: rgb(42,49,56)` (`--border-hairline`); light -> `rgba(0,0,0,0)` at the same 1 px width, so the box never shifts. Pitch surface `rgb(11,61,46)` in both.
- **Hit-area floor (12.6):** at 1920 px the smallest Voronoi cell measures 98 x 117.9 px; at 386 px the smallest measures **135.2 x 104.1 px**. Both far above the 44 px floor. Cell count drops 12 -> 4 between the two widths, which is the clustering doing its job in CSS px -- the exact behaviour a scaling viewBox would have silently broken.
- **Reflow (12.7):** at a 316 px client width, `scrollWidth === clientWidth` -- zero horizontal scroll, and the section's own furthest-right edge is 305.1 px. Below ~305 px a `type-stat-value` tile in Key Statistics overflows by 7 px; a full-document sweep confirmed **no `#shot-maps` element ever appears in the overflow list**. That tile is Story 2.5 code and belongs to the 2.19 item already on the ledger -- the pitch panels did not join it.
- **Locale swap (12.10):** titles, figure labels, meta chips, legend labels, outcome labels, delivery labels, column heads, caption, marker `aria-label`s, the note and the attribution all swap live; coordinates reformat `76,11` -> `76.11`. Verified on an already-open data table.
- **Reduced motion (12.11):** a sweep of every element in `#shot-maps` found `animationName: none` and no transitions anywhere, and `getAnimations({subtree:true})` returned 0. Nothing to kill -- verified rather than assumed.

**Task 12.5 -- cluster and keyboard behaviour, m001 Mexico.** Roving order by minute (3', 4', 8', 12' ...), `End` -> 66' (the last), a further `ArrowRight` stays put (no wrap), `Home` -> 3'. `Enter` on the minute-8 goal opened `role="dialog"` labelled "Eventos en este punto" with **3** stacked events, focus landing on that marker's own list item; `ArrowDown` moved to the 29' blocked attempt; `Esc` closed it and returned focus to the opening marker. **The marker's `transform` was byte-identical before and after** (`translate(307.764..., 287.817...)`) -- overlapping markers are never displaced. Repeat pointer clicks on the cell cycled the z-order through all three members and wrapped (8' -> 29' -> 66' -> 8').

**Hover guard.** React synthesises `onPointerEnter` from `pointerover`/`pointerout`, so the first probe (dispatching `pointerenter` directly) was inert and its result meaningless; re-run against the real events: `pointerType: "touch"` does **not** open the popover, `"mouse"` does, and it opens the `aria-hidden="true"` visual variant with no `role` (ruled decision 9) carrying "Player / Minute / Outcome" and **no xG row** (FD-1). `pointerout` closes it.

**Task 12.8 -- m074 and m002.** m074: Germany renders **21 markers and ZERO goal markers**, and its figure summary reads "0 goles" while `keyStatistics.home.goals === 1` -- the quiet lie FR-22 exists to prevent, prevented. Paraguay reads "1 gol" (singular). The own-goal note renders. The shot log carries 29 rows = 21 GER + **8 PAR against 7 PAR markers**, with the GOMEZ row reading `Gol (a.g.)`. No shoot-out attempt appears anywhere (the 9 are absent from both map and log). m002: the roving order ends `... 79', 90+3'`, and the table tail is `87', 90+2', 90+3' (KOR), 90+3' (CZE)` -- stoppage minutes order correctly AND the 90+3 tie breaks home-before-away.

**Task 12.9 -- data table.** `aria-controls` is **absent** while collapsed and present (resolving to a real element) while expanded; the label swaps "Ver los datos" <-> "Ocultar los datos"; caption "Ordenado por minuto."; 6 column heads with `scope="col"`, numerics right-aligned; **the xG column is absent**; 19 rows covering both teams; the region carries `overflow-x: auto`.

**One test expectation corrected during development** (the code was right): `shotFigureCounts(shotMarkers(m074, "paraguay"))` was asserted as `{shots: 7, goals: 2}`. Paraguay's eight rows carry two `outcome: "goal"` attempts, one of which IS the own goal, so dropping it leaves 7 markers and **1** goal marker. The assertion was corrected to `{shots: 7, goals: 1}` and sharpened to state why.

**Console:** no errors, no hydration warnings, no i18n misses on any of the three routes.

### Completion Notes List

**What shipped.** The reusable pitch-panel infrastructure -- `app/src/viz/` (the architecture's own structural seed, created here), the AD-6 -> screen affine map, Voronoi hit partitioning, cluster popovers, keyboard roving, the data-table alternative and the permanent attribution caption -- proven by its first two consumers, the shot map and the cross map, both mounted in `#shot-maps`.

**The testability split is the story's spine.** The harness has no jsdom, so nothing rendered can be unit-tested. All the logic therefore lives in pure modules under `src/viz/` with real tests (**90 of the 99 new tests**), and the components stay thin: projection, ordering, clustering, Voronoi, the encoding maps, the log rows and the figure counts are all asserted against literals and against the fixtures. Suite **138 -> 237 passed** (10 -> 14 files); `npm run build` green.

**Ruled decisions: all twelve implemented as written**, with three deliberate departures recorded below.

1. **`clusterMarkers` runs a second, centroid-stabilisation pass** (beyond the story's single-link description). Task 3.6 asks for a comment stating that cluster representatives are ">=44 px apart by construction", and Task 3.8 asks for a property test asserting exactly that. Single-link clustering alone does **not** give that guarantee: a ring of markers chained at 43 px around a lone marker at its centre puts the ring's centroid on top of the centre marker, even though every cross-cluster pair is >=44 px apart. Rather than ship a comment and a property test that are both false in the general case, `clusterMarkers` merges clusters whose representatives collide until the set is stable (it converges -- every pass strictly reduces the cluster count). The adversarial ring is a named test case. Markers are still never moved; only the hit target changes.

2. **`CROSS_COMPLETED_ENCODING` is split into a static `CROSS_COMPLETED_SHAPE` record plus a `crossCompletedEncoding(accentVar)` function.** Task 4.4 pins the type as `Record<"completed"|"attempted", {shape, colorVar}>`, but ruled decision 4 makes the colour the **acting team's accent**, which is per side -- a frozen table cannot hold it. The split keeps the two states exhaustive at compile time (which is what the `Record` was for) while being honest that the hue is a parameter.

3. **Four locale counter keys beyond Task 10.1's list** -- `viz.shotMap.shotsOne` / `goalsOne`, `viz.crossMap.crossesOne`, and `viz.crossMap.completedCount`. `t()` has no interpolation and no plural machinery, so a single "goles" renders **"1 goles"** over m074 Paraguay's map, and the chip form `{m} {t("viz.crossMap.completed")}` renders "9 Completado". Both are visible copy defects in both languages. The counter helper picks a key by count; the capitalised `viz.crossMap.completed` is kept verbatim for the legend and the marker qualifier, where Task 10.2's ruled Title-case is correct.

**The cross legend carries four entries, not two** (`MEX - Completado`, `MEX - Intentado`, `RSA - ...`). Completion is dual-encoded by fill while the hue is the acting team's accent, so a two-entry legend could only show one team's colour, and a swatch painted in a hue no marker on the panel uses is its own small lie. Legend entries already wrap at narrow widths (Task 6.10).

**FD-1 applied throughout, and the forward slot is live code.** Uniform marker size, no xG sizing, no xG row in the popover and no xG column in the log while every `expectedGoals` is `null` -- with tests proving the row and the column both **appear** the moment a constructed shot carries a value. The nullable slot is a landing zone, not dead code.

**CS-1-proof by construction (Task 10.4).** This story maps `ShotOutcome` -- the stable five-value marker enum -- and never `ShotOutcomeDetail`, whose 22->24 extension is CS-1's payload. `enums.shotOutcome` has exactly five entries and a test asserts `enums` carries no `shotOutcomeDetail` namespace. Nothing here needs to change when CS-1 lands.

**Closed 2.5 review decision D7 (Task 9).** `sectionDataState(bundle, "shot-maps")` now reads BOTH tables: the section is `empty` only when `events.shots` AND `events.crosses` are both `null`. 2.5's `shots = null -> "empty"` assertion was replaced by the four-way truth table, and the ledger entry is struck with the ruling.

**Dependency decision, recorded so nobody "fixes" it later.** `d3-delaunay@6.0.4` is the ONLY new runtime dependency -- exactly the Voronoi module inside the architecture's pinned `d3@7.9.0` (which itself depends on `d3-delaunay ^6.0.1`). The full `d3` monolith, `d3-scale` and `d3-selection` are **deliberately not installed**: the projections are two linear maps of plain arithmetic, and the ~90 KB-gzip monolith does not belong on a <=500 KB-per-route budget. **React owns every SVG node**; d3 is used for geometry math only and never touches the DOM. `package-lock.json` is committed (AD-13). The 12 `npm audit` findings are pre-existing eslint/next toolchain issues -- `d3-delaunay` and its single transitive dep `delaunator@5.1.0` are not implicated.

**Two lint findings fixed rather than suppressed.** `react-hooks/set-state-in-effect` correctly flagged both of the component's `useEffect` + `setState` pairs. The roving index is now clamped at read time, and the "close a popover whose figure unmounted" case is derived at render (`visibleOpen`) instead of synced -- the team selector additionally clears it outright so a popover cannot resurrect on switching back.

**Observations for review, not defects.**

- **Panel size at `>=lg`.** The route is a single `max-w-6xl` column, so each half-pitch measures ~527 x 683 px -- roughly twice the desktop mockup's 246 x 318, where the shot map shares a two-column `.pitchrow` with the pass network. This is the honest consequence of a width-fluid panel (which the story mandates), and it is what keeps the 44 px floor generous. If a reviewer wants the mockup's density, a `max-width` on the figure is the one-line change -- but that is a design call, not a defect.
- **The half pitch draws no centre-circle arc.** Task 2.7 rules the centre circle and halfway line "full pitch only"; the desktop mockup does draw the half-circle bulging in from the left edge. Spec over mock, per the story's own "Mocks illustrate; spines win on conflict".
- **Marker accessible names read "..., Bloqueado" with the enum's Title-case**, where the story's illustrative prose shows lowercase "bloqueado". Task 10.2 pins those five labels verbatim as legend/column strings; lower-casing them in code would be a locale-sensitive transform of ruled copy. Screen readers do not announce capitalisation.
- **`#shot-maps` renders a heading `<button aria-expanded>` at `>=lg`**, which reads against Story 2.5's sprint note ("at >=lg the nine collapsible sections render in the NON-collapsible presentation"). Confirmed **pre-existing and not caused by this story**: `#pass-networks` behaves identically, and `buildSectionPlans` sets `collapsible` width-independently. `TacticalSection` is on this story's do-not-touch list, so it is flagged here rather than changed.
- **m002's stoppage-time shots are at 90+2 / 90+3**, not the story's illustrative "45+3". Same property, asserted against the fixture's real values in both the unit test and the browser pass.

**Coordination.** `app/` only -- `pipeline/` changes from the in-flight 1-10 and the README/checks edits were never staged (no `git add -A`). Nothing in this story runs the full-corpus batch.

### File List

**Created**

- `app/src/viz/pitch-geometry.ts`
- `app/src/viz/pitch-geometry.test.ts`
- `app/src/viz/marker-layout.ts`
- `app/src/viz/marker-layout.test.ts`
- `app/src/viz/marker-model.ts`
- `app/src/viz/shot-map-model.ts`
- `app/src/viz/shot-map-model.test.ts`
- `app/src/viz/cross-map-model.ts`
- `app/src/viz/cross-map-model.test.ts`
- `app/src/lib/use-element-width.ts`
- `app/src/components/PitchPanel.tsx`
- `app/src/components/ViewDataDisclosure.tsx`
- `app/src/components/ShotMapsSection.tsx`

**Modified**

- `app/src/components/TacticalLayer.tsx` (the `shot-maps` dispatch case; `emptyHeadline` now the shared hook)
- `app/src/components/EmptyStatePanel.tsx` (extracted `useEmptyHeadline`)
- `app/src/lib/tactical-sections.ts` (the `shot-maps` data-state predicate + its docblock)
- `app/src/lib/tactical-sections.test.ts` (four-way truth table; the empty-section plan fixture now nulls both tables)
- `app/src/lib/i18n.test.ts` (`enums.shotOutcome` / `enums.crossDelivery` completeness in both locales)
- `app/src/lib/eslint-gate.test.ts` (three `src/viz/**` seam fixtures)
- `app/src/locales/es.ts` (the `viz.*` namespace; `enums.shotOutcome` filled; `enums.crossDelivery` added; `tactical.sections.shot-maps` title + summary)
- `app/src/locales/en.ts` (typed mirror of all of the above)
- `app/src/app/globals.css` (the `focus-on-pitch` utility only)
- `app/eslint.config.mjs` (one `files` entry: `src/viz/**`)
- `app/package.json`, `app/package-lock.json` (`d3-delaunay@6.0.4`, `@types/d3-delaunay@6.0.4`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (D7 entry struck as RESOLVED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-7-pitch-panel-infrastructure-with-shot-cross-maps.md`

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-26 | Story 2.7 context created — reusable pitch-panel infrastructure (`app/src/viz/`, d3-delaunay Voronoi, measured-px layout) with shot + cross maps as its first two consumers. Twelve ruled decisions, incl. the cross map inside `#shot-maps`, the both-null `shot-maps` predicate (closes 2.5 review decision D7), team-accent cross encoding, and the corrected `aria-hidden` mechanism. Status backlog → ready-for-dev. |
| 2026-07-26 | Story 2.7 implemented — `app/src/viz/` created (pitch geometry, marker layout with d3-delaunay Voronoi, shot/cross marker models), measured-px `PitchPanel` with cluster popovers + keyboard roving, `ViewDataDisclosure`, `ShotMapsSection` mounted at `#shot-maps`. Closes 2.5 review decision D7 (`shot-maps` reads both tables). Suite 138 → 237; build chain green; SM-3 spot check reproduces Story 1.3’s 2/2/8/3/1 ground truth. Status ready-for-dev → review. |

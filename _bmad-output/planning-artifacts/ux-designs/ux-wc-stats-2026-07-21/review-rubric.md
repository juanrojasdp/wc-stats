# Spine Pair Review — wc-stats

## Overall verdict

A disciplined, extraction-ready pair: canonical DESIGN.md shape, all EXPERIENCE.md defaults present, every `{token}` reference in both files resolves, all four app-side UJs are covered verbatim with protagonists/climaxes/failure paths, and the stated contrast claims check out arithmetically where checked (pitch-line 3.62:1 vs claimed ≈3.6:1; ink 17.3:1 vs claimed ≥15:1). No critical findings. The gaps cluster at the seams of the data-viz palette (one high: goal markers illegible on the light-theme Momentum Timeline; heat ramp violates its own monotonic-lightness rule) and at a handful of small surfaces that are named but never specified (result chip anatomy, site header, a dangling "search" capability, a Hero-contract self-contradiction). All are targeted fixes; none require restructuring.

## 1. Flow coverage — strong

Extracted UJ-1..UJ-5 from prd.md §2.3 (the only journey-shaped requirements in the sources; the brief seeds the same set). UJ-1 through UJ-4 each have a Key Flow in EXPERIENCE.md with the PRD's title verbatim, a named protagonist, numbered steps, a bolded climax beat, and a failure path (UJ-4's is explicitly argued as non-critical, which is acceptable). UJ-1's edge case (unremembered match → stage-context chip) is carried into step 2. UJ-5 is the builder/pipeline journey and correctly has no UX flow.

### Findings
- **low** UJ-5 (pipeline re-run) is omitted without saying so; a consumer extracting "every UJ" from the sources hits a silent gap (EXPERIENCE.md → Key Flows; prd.md §2.3 UJ-5). *Fix:* one line under Key Flows: "UJ-5 is a pipeline journey (Epic 1); no App surface."

## 2. Token completeness — adequate

Extracted all 47 color tokens, 10 typography roles, 4 radii, 5 named spacing tokens, and 8 component token groups from DESIGN.md frontmatter, plus every `{path.to.token}` reference in the prose of both files (including EXPERIENCE.md's `{typography.display-score}`, `{components.comparison-column}`, `{colors.shot-goal}`). Every reference resolves to a defined token; every color has a hex; light/dark pairing is systematic for canvas/ink/accents/team/result tokens, and the theme-invariant pitch deliberately needs none. Contrast targets are stated for the load-bearing combinations and the checkable claims verify.

### Findings
- **high** `shot-goal` has no light-canvas variant, but the Momentum Timeline — rendered on theme-aware `{colors.surface-raised}`, not the theme-invariant pitch — uses it for goal markers. On light `surface-raised-light` (#FFFFFF) the lime is 1.28:1 — invisible. The momentum spec switches team fills to `-light` variants but is silent on goal markers (DESIGN.md → Colors → Data-visualization palette → "Momentum Timeline"; frontmatter `shot-goal`). Downstream code mirrors the spine and ships an illegible light-theme chart. *Fix:* add `shot-goal-light` (or specify markers use the theme's `ink-primary` with lime ring on light) and name it in the momentum spec.
- **medium** The heatmap ramp claims "monotonic in lightness so intensity reads without color perception," but heat-4 `#E4EF52` (L≈0.79) is *lighter* than the terminal heat-5 `#F5B63C` (L≈0.53) — the ramp reverses at the top, exactly where intensity peaks (DESIGN.md → Colors → "Heatmap ramp"; frontmatter `heat-4`/`heat-5`). *Fix:* make heat-5 the lightest stop (e.g., swap 4/5 or replace the amber terminal) or drop the monotonicity claim and add a non-hue cue.
- **medium** The momentum spec violates DESIGN.md's own Don't ("Mix team encoding and outcome encoding in one chart"): goal markers use `{colors.shot-goal}` (#C3F53C) in a chart whose team encoding uses `{colors.viz-team-a}` — the identical hex. A Team-B goal marker reads as a Team-A element (DESIGN.md → Colors → "Momentum Timeline" vs. Do's and Don'ts row 5). *Fix:* neutral/ink goal markers on the momentum axis, or per-team markers using the team accents with a shape cue.
- **medium** The palette is declared "normative for every d3 and recharts view," yet single-series charts (Player Profile cross-match trends, Hub leaderboard charts) have no assigned series token — only the two-team pair, neutral, outcomes, edges, heat, results exist (DESIGN.md → Data-visualization palette; EXPERIENCE.md → Visualization Layering "Profile trends"). Downstream must guess the trend-line color. *Fix:* declare the single-entity series color (e.g., "single-series charts use `viz-team-a` / `-light`") or add a `viz-single` token.
- **low** `accent-cyan-ink` (#062226) is defined but never referenced in either file; cyan is never specified as a fill (DESIGN.md frontmatter line 31). *Fix:* remove, or document the cyan-fill case it serves.
- **low** The shadcn mapping table uses literal `#FFFFFF` for light `--primary-foreground` instead of a token, the only raw hex outside frontmatter (DESIGN.md → Colors → shadcn CSS-variable mapping). *Fix:* tokenize (e.g., `surface-raised-light`) or leave with a comment; cosmetic.

## 3. Component coverage — adequate

Extracted every component name used anywhere in both files. The core twelve (stat tile, layer section shell, pitch panel, data table, comparison column, comparison entity picker, language toggle, theme toggle, glossary tooltip, empty-state panel, Momentum Timeline, attribution footer) each have a DESIGN.md.Components visual row AND an EXPERIENCE.md Component Patterns behavioral row with real rules — names match exactly across all four sections. shadcn inheritance (Skeleton, Tabs, Button, Command, Accordion) is properly declared rather than restated. The misses are peripheral components that are named but specified nowhere.

### Findings
- **medium** Result chips have color tokens (`result-win/draw/loss` + light), a shape rule (`rounded.full`), and a letter-pairing rule, but no DESIGN.md.Components row (filled pill vs. outline? letter color? — letter-on-fill contrast is unverifiable without it) and no EXPERIENCE.md row (static? linked to the match?) (DESIGN.md → Colors "Result chips" / Shapes; used in Hub standings). *Fix:* add a `result-chip` row to both files (one line each suffices).
- **medium** The site header is load-bearing on every route (logo→`/`, language toggle, theme toggle) but never specified as a component: composition, nav links (how are `/glossary`, `/compare` reached other than footer/profile actions?), sticky behavior, mobile treatment (EXPERIENCE.md → IA "header logo", Component Patterns "Site header" appears only as a *location*). *Fix:* add a Site header row to Component Patterns (contents + order + sticky rule) and, if it has visual deltas, to DESIGN.md.Components.
- **low** The Hero "stage context chip" (UJ-1 step 2) has no visual spec — the only chip spec is result chips (EXPERIENCE.md → UJ-1; DESIGN.md → Components). *Fix:* one clause in the stat-tile or layer-shell row, or reuse `label-caps` pill explicitly.
- **low** The mobile Hub "sort menu" ("sort still on all columns via sort menu") has no behavioral spec beyond the phrase — trigger, a11y semantics unstated (EXPERIENCE.md → Responsive & Platform, Hub row). *Fix:* one line in the data-table row (e.g., shadcn DropdownMenu, mirrors `aria-sort`).

## 4. State coverage — strong

Walked all eight IA surfaces. Covered: cold load (all, skeleton-shaped), missing Tactical section, missing momentum series (OQ-5, anchor-preserving), empty comparison, partial comparison, invalid comparison params, unknown route/404, bundle fetch failure with retry, focus-visible everywhere. Offline is explicitly declared out of scope (correct per sources); permission-denied is structurally N/A (no auth). Invalid entity slugs on static export correctly collapse into the 404 case. Locale-flash-on-load is handled (read before first paint).

### Findings
- **low** Empty states are scoped to the Match Dashboard (FR-22); Profile and Comparison surfaces can also have missing sections (e.g., a one-match player's trend chart, a keeper-less Domain E block) and only inherit treatment via the "same grammar" sentence — inference, not commitment (EXPERIENCE.md → Component Patterns "Empty-state panel"; Progressive Disclosure Contract last ¶). *Fix:* extend the empty-state-panel Use column to "any missing section on any surface."

## 5. Visual reference coverage — strong

Workspace contains only `imports/`, which is empty; no `mockups/` or `wireframes/` folders exist. No orphans possible, no references to nonexistent files in either spine. Spines-win-on-conflict is stated once, in the EXPERIENCE.md header note ("Spines win on conflict with any mock or wireframe"). Vacuously but properly satisfied.

### Findings
- None.

## 6. Bloat & overspecification — strong

Both files are lean for the product's surface area. DESIGN.md prose carries editorial voice where the examples license it (Brand & Style, per-color stories) and tables everywhere else. EXPERIENCE.md is table-dominant; no persona restatement, no FR prose restatement (budgets appear once, one line, as constraints that shape behavior — earning their keep). The i18n per-term table is not bloat: it is the OQ-1/FR-32 resolution the PRD explicitly assigns to the UX pass. The Requirements traceability table is consumer-serving (gate/architecture aid), not ceremony. `Intl.NumberFormat('es-CO')` is a borderline implementation detail but functions as a commitment that prevents hand-formatting drift — acceptable.

### Findings
- None.

## 7. Inheritance discipline — adequate

All three `sources` paths resolve on disk. UJ titles verbatim from prd.md §2.3. Glossary vocabulary (Story Stats, Momentum Timeline, Hero/Tactical/Expert Layer, Match Bundle, Tournament Index, Pass Network, Defensive Block, Speed Zones, PMSR) used identically to PRD §3; Story Stats composition matches exactly (possession, shots, xG, distance, top speed). Tactical section order matches PRD §4.6 with the one deviation (goalkeeping appended) properly tagged `[ASSUMPTION]`. FR references spot-check correct (FR-18 budget, FR-24 coordinates, FR-32 policy). Component names identical across all sections of both files; EXPERIENCE token references resolve to DESIGN tokens by name. Assumptions are consistently tagged inline, matching PRD discipline.

### Findings
- **medium** Player/Team Profile "Reached from" columns name "search" as an entry path, but no search surface, component, or FR exists anywhere — the PRD has no search requirement and EXPERIENCE.md specifies none (EXPERIENCE.md → IA rows `/players/…`, `/teams/…`). A story-writer will either invent a search feature or dead-end. *Fix:* delete "search" from both rows, or spec it (e.g., "comparison picker's Command index reused in header") — deleting is the source-faithful move.
- **low** The deep-link anchor list omits the head-to-head Key Statistics section, though the contract says "every section has an anchor" and Key Statistics is the first named Tactical section (EXPERIENCE.md → IA "Deep-link anchors" vs. Progressive Disclosure Contract Tactical row). *Fix:* add `#key-stats` to the list.

## 8. Shape fit — strong

DESIGN.md body sections are in exact canonical order (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts), none omitted. Frontmatter conforms to spec types (flat kebab-case colors with quoted hex, nested typography, rounded/spacing/components maps, `{path}` refs). EXPERIENCE.md has all eight required defaults; Responsive & Platform is present as required for a breakpointed product. The four invented sections all earn their place: Progressive Disclosure Contract (the product's core mechanism, marked normative), Visualization Layering (a data-viz product needs the per-altitude matrix), i18n & Terminology (discharges OQ-1/OQ-3/FR-30..32), Requirements traceability (gate aid).

### Findings
- **medium** Hero Layer contract self-contradicts: "nothing collapsible — it is simply *there*" in the same row that places "lineups & formations in a compact disclosure" — a disclosure is collapsible (EXPERIENCE.md → Progressive Disclosure Contract, Hero row). A story-writer cannot tell whether lineups may collapse, and FR-21's 15-second test depends on the answer. *Fix:* rephrase to "nothing collapsible except the lineups/formations disclosure" or move lineups to the Tactical Layer.
- **low** Key Flows sits mid-document with three invented sections after it; both shape examples read flows-last as the narrative capstone (EXPERIENCE.md section order). Cosmetic — extraction is unaffected. *Fix:* optional reorder.

## Mechanical notes

- All three `sources` frontmatter paths resolve (prd.md, addendum.md, project-brief-wc2026-analytics.md verified on disk).
- Zero unresolved `{path.to.token}` references in either file; zero references to nonexistent components, sections, or files.
- Frontmatter complete on both spines (name, description, status, updated; sources on EXPERIENCE.md as required; DESIGN.md correctly carries none, matching the examples).
- **Markdown table breakage:** EXPERIENCE.md → Component Patterns, Language toggle row contains an unescaped pipe inside a code span (`` `ES | EN` ``). In GFM, pipes inside code spans in tables still delimit cells — this row parses as four columns and will render/extract broken. Escape it (`ES \| EN`) or write "ES/EN". Same string is safe in DESIGN.md (not in a table).
- Naming is otherwise exact across files: `Layer section shell`/`layer-shell`, `Momentum Timeline`, `Pitch panel`/`pitch-panel`, etc. — frontmatter keys and prose names map 1:1.
- Stated contrast claims that were spot-checked all verify: pitch-line 3.62:1 (claimed ≈3.6), ink-primary 17.3:1 (≥15), ink-secondary 8.6:1 (≥7), accents 14.8/11.3/6.6/5.0:1 (≥4.5), shot markers and edge-weight-1 ≥3:1 vs. pitch. The two failures found (shot-goal on light canvas 1.28:1; heat-4>heat-5 lightness inversion) are logged in §2.

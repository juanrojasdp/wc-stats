# Validation Report — wc-stats

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md`
- **Run at:** 2026-07-21 (validation pass during Create/Finalize)

## Overall verdict

A disciplined, extraction-ready pair: canonical DESIGN.md shape, all EXPERIENCE.md defaults present, every `{token}` reference in both files resolves, all four app-side UJs are covered verbatim with protagonists/climaxes/failure paths, and the stated contrast claims check out arithmetically where checked (pitch-line 3.62:1 vs claimed ≈3.6:1; ink 17.3:1 vs claimed ≥15:1). No critical findings from the rubric walk. The gaps cluster at the seams of the data-viz palette (goal markers illegible on the light-theme Momentum Timeline at 1.28:1; the heat ramp violates its own monotonic-lightness rule) and at a handful of small surfaces that are named but never specified (result chip anatomy, site header, a dangling "search" capability, a Hero-contract self-contradiction). All are targeted fixes; none require restructuring.

The accessibility and i18n reviewers shift that picture: between them they surface four criticals the rubric walk did not. Computed from the declared hexes, the heatmap's lowest step lands at 1.94:1 on the pitch and the light-theme focus ring at 2.28:1 on the theme-invariant pitch surface — blinding keyboard focus on every pitch viz in light mode — so the spines fail a WCAG 2.1 AA audit as written. On the i18n side, "pérdida forzada" semantically inverts the forced-turnover metric on the exact surface Diego screenshots, and the no-flash language-toggle promise contradicts the pre-rendered-Spanish render model without owning a mechanism. Both reviewers judge every fix token- or sentence-level; neither asks for restructuring, but the i18n reviewer's gate verdict is explicit: fail as-is, approvable after fixes. The two reconciliation passes (`reconcile-prd.md`, `reconcile-project-brief.md`) independently corroborate the dangling "search" reference and the Hero "nothing collapsible" contradiction, and add two parent-attention items outside the reviewers' scope: the missing "incomplete" shot outcome (binding addendum ground truth vs. DESIGN's four-outcome encoding) and the momentum-first narrative contradicting the §4.6 section order the same document reproduces. After deduplication: 4 critical, 11 high, 28 medium, 23 low.

## Category verdicts

- Flow coverage — strong
- Token completeness — adequate
- Component coverage — adequate
- State coverage — strong
- Visual reference coverage — strong
- Bloat & overspecification — strong
- Inheritance discipline — adequate
- Shape fit — strong

## Findings by severity

### Critical (4)

**[Accessibility]** — Heatmap heat-1 on pitch fails non-text contrast (DESIGN → Heatmap ramp; EXPERIENCE → Visualization Layering)
heat-1 `#2E6B50` on pitch-surface `#0B3D2E` computes to **1.94:1** — fails WCAG 1.4.11 non-text 3:1 for the lowest visible intensity band of a core Tactical viz. Low-intensity zones will be imperceptible to low-vision users, silently converting "low activity" into "no data."
Fix: Lighten heat-1 to ≥3:1 vs #0B3D2E (e.g. ≈#3E7F60 territory) or raise the transparent-below threshold so the first rendered step is heat-2 (3.11:1) — and state the verified ratio.

**[Accessibility]** — Light-theme focus ring blinded on the pitch (DESIGN → shadcn CSS-variable mapping + "The pitch is sacred ground"; EXPERIENCE → State Patterns → Focus)
`--ring` maps to accent-cyan-light `#0E7490`, which computes to **2.28:1** against the theme-invariant pitch-surface `#0B3D2E` — fails 1.4.11/2.4.7 for every focusable d3 marker, node, and cluster in light mode. DESIGN's claim "lime and cyan are also ≥3:1 … against both canvases and the pitch" is true only for the dark cyan.
Fix: One sentence: focus indicators rendered on the pitch surface always use dark-canonical accent-cyan #3DDBE8 (7.26:1 vs pitch) regardless of theme — consistent with the pitch being theme-invariant.

**[i18n]** — "forced turnover → pérdida forzada" inverts the metric's perspective (EXPERIENCE → i18n table; pressing/Defensive Blocks surface)
FIFA-style forced turnovers are credited to the team that *forces* the loss — a defensive/pressing achievement. "Pérdidas forzadas" as a stat label on a team's pressing section or leaderboard reads as that team's own giveaways — the exact opposite meaning, on the surface Diego screenshots. Spanish analytics media renders this from the recovering side.
Fix: "recuperaciones forzadas" (or "pérdidas forzadas al rival" where the losing-side framing is genuinely intended); never bare "pérdidas forzadas" for the forcing team's count.

**[i18n]** — The no-flash promise contradicts the render model (EXPERIENCE → Component Patterns language toggle vs. IA pre-rendered Spanish HTML)
Locale is "read before first paint to avoid flash" — but every route is pre-rendered Spanish HTML. For a persisted-EN user, either a Spanish flash (FOUC) before the client-side swap, or a blocking inline script rewrites strings pre-paint — and either way React hydration will mismatch (server text ≠ client text), which in Next static export means hydration errors or a deliberate two-pass render. The spec asserts the outcome without owning the mechanism.
Fix: Specify the mechanism: (a) accept one-frame Spanish flash for EN users and say so, or (b) inline script sets `<html lang>` + a locale class pre-paint and all strings render client-side post-hydration with the skeleton covering the gap. Log the choice.

### High (11)

**[Token completeness]** — shot-goal has no light-canvas variant; goal markers invisible on light-theme Momentum Timeline (DESIGN → Momentum Timeline spec; frontmatter `shot-goal`)
The Momentum Timeline renders on theme-aware `{colors.surface-raised}`, not the theme-invariant pitch. On light surface-raised-light (#FFFFFF) the lime is **1.28:1** — invisible. The momentum spec switches team fills to `-light` variants but is silent on goal markers; downstream code mirrors the spine and ships an illegible light-theme chart.
Fix: Add `shot-goal-light` (or specify markers use the theme's ink-primary with lime ring on light) and name it in the momentum spec.

**[Token completeness + Accessibility]** — Heatmap ramp is not "monotonic in lightness" as claimed; reversal at peak intensity (DESIGN → Heatmap ramp; frontmatter `heat-4`/`heat-5`)
Computed relative luminance runs 0.117 → 0.218 → 0.462 → 0.788 → **0.532** — heat-5 `#F5B63C` (amber) is darker than heat-4 `#E4EF52`, so the ramp reverses exactly where intensity peaks. Under achromatopsia/grayscale or deuteranopia, peak-intensity zones read as *less* intense than heat-4 zones, inverting the story; this also breaks the 1.4.1 redundancy the spec relies on. (Rubric: medium; Accessibility: high — consolidated at high.)
Fix: Make heat-5 the lightest stop (swap 4/5 or replace the amber terminal with a near-white yellow) or drop the monotonicity claim and add a non-hue cue; re-verify computed luminance ordering.

**[Token completeness + Accessibility]** — One color, two meanings in the Momentum Timeline: shot-goal, accent-lime, and viz-team-a are the same hex (DESIGN → Momentum Timeline vs. Do's and Don'ts row 5)
Goal markers use `{colors.shot-goal}` #C3F53C in a chart whose team-A encoding uses `{colors.viz-team-a}` — the identical hex — violating DESIGN's own Don't ("Mix team encoding and outcome encoding in one chart") and the palette's normative "one color means one thing per visualization." A Team-B goal marker reads as a Team-A element. (Rubric: medium; Accessibility: high — consolidated at high.)
Fix: Neutral/ink goal markers on the momentum axis, or per-team markers using the team accents with a shape cue; note the token-aliasing hazard.

**[Accessibility]** — Leading-value encoding is color-only, a 1.4.1 fail on the core 15-second path (DESIGN → Stat tile; EXPERIENCE → UJ-3 step 4, Comparison column)
"Leading side's value takes the team accent; trailing side stays ink-primary" encodes who leads by color alone on the Hero head-to-head tiles and Comparison Mode.
Fix: Add a non-color leader cue (▲ glyph, weight bump, or "líder" affix in the accessible name) to every accented leading value.

**[Accessibility]** — Team A vs Team B is hue-only (DESIGN → Two-team contrast pair; EXPERIENCE → Visualization Layering)
viz-team-a vs viz-team-b computes **1.32:1** (dark) and **1.07:1** (light variants) — near-identical lightness, distinguishable only by hue. Phases-of-Play, pressing, and Defensive Blocks comparative charts specify no direct labels, pattern, or ordering rule — legend-by-hue alone fails 1.4.1 for deuteranopic users (lime-green vs teal is risky) and grayscale.
Fix: Mandate direct series labels (team name/code at bar or line end) on every two-team recharts view, and/or a pattern/dash differential for team B.

**[Accessibility]** — Momentum scrub is pointer-only and "tap-drag" contradicts the spec's own drag ban (EXPERIENCE → Momentum Timeline; Responsive table; Interaction Primitives)
No arrow-key scrub is specified, so per-minute values are not keyboard-operable (2.1.1); only goal markers are focusable. "Tap-drag" contradicts Interaction Primitives' "**Banned:** … drag interactions in v1." At mobile, the reduced-height strip also makes the fine-grained 90+-minute scrub unlandable for motor-impaired users — the same fix resolves both.
Fix: Make the scrubber a focusable slider (`role="slider"`, arrow keys = ±1 minute, aria-valuetext = minute + values) and resolve the drag contradiction (tap-to-position also works, for touch too).

**[i18n]** — Shot-outcome legend labels absent from the terminology table (DESIGN → shot-outcome encoding, English only)
Goal / On target / Off target / Blocked render on the product's signature surface and need ruled-on Spanish with a LatAm decision: "on target" is "al arco" in LatAm broadcast ("a puerta" is peninsular).
Fix: Add rows — gol / al arco / desviado / bloqueado — and mirror them in the legend spec and the "Ver los datos" table headers.

**[i18n]** — Goalkeeping domain has zero terminology coverage, including "portero" vs "arquero" (EXPERIENCE → Tactical `#goalkeeping`, Domain E)
The single most audience-sensitive word on the site: "arquero" is the LatAm/Colombian term. Also missing: atajada (the spec's own aria example already says "atajado"), salidas, distribución, mano a mano.
Fix: Add a goalkeeping block to the table; recommend "arquero" and "atajadas" for the LatAm register, section label "Arqueros" or "Portería" (decide once).

**[i18n]** — No date/month rendering rule anywhere in either spine (EXPERIENCE → Voice and Tone; Hub renders 104 match dates)
Numbers are specified, dates are not. es-CO dates are "21 de julio de 2026", lowercase months; `Intl.DateTimeFormat('es-CO')` should be mandated exactly as `Intl.NumberFormat` is.
Fix: Add a date-format rule beside the number rule, with one worked example per locale (and a decision on kickoff-time/timezone display across the three host countries).

**[i18n]** — Single-tree i18n consequences unowned: no EN SEO, Spanish share cards for EN users (EXPERIENCE → IA [ASSUMPTION])
English content is invisible to search engines (no `/en/` URLs, no hreflang), and every link Diego shares after switching to EN produces a Spanish link preview (og:title/description are the pre-rendered Spanish).
Fix: Explicitly accept and log the tradeoffs (no EN SEO, es-only share cards), and confirm no hreflang is emitted (a lone self-referencing one is worse than none).

**[i18n]** — Text expansion unaddressed at the tightest layouts (DESIGN → `stat-label`/`label-caps`; 390px tile grid)
Spanish runs ~20–30% longer, and labels are 11px ALL-CAPS with 0.08em tracking in 12px-gap tiles at 390px. "VELOCIDAD MÁXIMA" vs "TOP SPEED"; "CARRERAS A ALTA VELOCIDAD" as a column head will not fit. No wrap/truncate/abbreviation rule exists in either spine.
Fix: Add a label-overflow rule (two-line wrap allowed in tiles; ruled abbreviations for column heads, e.g. "VEL. MÁX.", with the full term in the header tooltip/aria-label).

### Medium (28)

**[Token completeness]** — No single-series chart token (DESIGN → Data-visualization palette; EXPERIENCE → Visualization Layering "Profile trends")
The palette is "normative for every d3 and recharts view," yet single-series charts (Player Profile cross-match trends, Hub leaderboard charts) have no assigned series token. Downstream must guess the trend-line color.
Fix: Declare the single-entity series color (e.g., "single-series charts use viz-team-a / -light") or add a `viz-single` token.

**[Component coverage + Accessibility]** — Result chip has no component row, and the obvious dark-theme letter color fails contrast (DESIGN → Colors "Result chips" / Shapes; Hub standings)
Chips have color tokens, a shape rule, and a letter-pairing rule, but no DESIGN.md Components row and no EXPERIENCE.md row. Computed: ink-primary `#F2F5F7` on the chip fills is 1.62 (win), 2.72 (draw), 2.60 (loss) — all hard 4.5:1 text fails; `surface-base` #0E1114 as letter color passes all three (10.68 / 6.35 / 6.66); light theme with white text passes (5.36–5.61).
Fix: Add a `result-chip` row to both files (one line each), specifying dark-theme chip text = surface-base (or near-black), light-theme = #FFFFFF, with computed ratios.

**[Component coverage]** — Site header never specified as a component (EXPERIENCE → IA "header logo"; Component Patterns)
Load-bearing on every route (logo→`/`, language toggle, theme toggle) but never specified: composition, nav links (how are `/glossary` and `/compare` reached other than footer/profile actions?), sticky behavior, mobile treatment.
Fix: Add a Site header row to Component Patterns (contents + order + sticky rule) and, if it has visual deltas, to DESIGN.md Components.

**[Inheritance discipline]** — Dangling "search" reference (EXPERIENCE → IA rows `/players/…`, `/teams/…`; also flagged by the project-brief reconciliation)
"Reached from" columns name "search" as an entry path, but no search surface, component, or FR exists anywhere. A story-writer will either invent a search feature or dead-end.
Fix: Delete "search" from both rows, or spec it (e.g., "comparison picker's Command index reused in header") — deleting is the source-faithful move.

**[Shape fit]** — Hero contract self-contradicts: "nothing collapsible" vs. lineups "in a compact disclosure" (EXPERIENCE → Progressive Disclosure Contract, Hero row; also flagged by both reconciliations)
A disclosure is collapsible. A story-writer cannot tell whether lineups may collapse, and FR-21's 15-second test depends on the answer.
Fix: Rephrase to "nothing collapsible except the lineups/formations disclosure" or move lineups to the Tactical Layer.

**[Accessibility]** — ink-muted "tertiary" text below 4.5:1 everywhere (DESIGN → Canvas & ink)
`#6B757F` computes 4.04 on base, 3.69 on raised, **3.30 on overlay**. "Tertiary" is not "disabled": real content in ink-muted at body sizes is an AA text fail.
Fix: Restrict ink-muted to disabled states and ≥3:1 non-text glyphs explicitly; move tertiary text to ink-secondary.

**[Accessibility]** — Momentum midline vanishes inside team A's area (DESIGN → Momentum Timeline spec)
viz-neutral `#8C979F` over the composited team-A 60% fill (#7E9E30) computes to **1.03:1** — the zero-reference that gives the areas meaning disappears.
Fix: Draw the midline in ink-primary (or add a 1px ink-primary casing), or render areas only up to a gap around the axis.

**[Accessibility]** — Pass-network selection state is color/contrast-only (EXPERIENCE → Pitch panel)
Node focus "highlights that player's edges, dims the rest" — no specified non-color cue for the selected node itself.
Fix: Specify a selection ring/stroke change on the focused node plus the aria state.

**[Accessibility]** — Cluster z-order cycling is tap-only (EXPERIENCE → Pitch panel)
Neither keyboard cycling nor the cluster popover's internal arrow-key navigation is specified.
Fix: Enter on a cluster opens the list popover with focus on the first item and arrow-key navigation; z-cycling is a pointer redundancy, not the only path.

**[Accessibility + i18n]** — Stat-tile glossary trigger under-specified: focusability and discoverability (EXPERIENCE → Stat tile; glossary tooltip trigger style)
"Tapping a tile with a glossary term in its label opens the glossary tooltip" — but the tile is otherwise "static display"; a non-focusable tap target is a 2.1.1 fail. The i18n review adds the discoverability half: Story Stats tile labels (posesión, xG, distancia) *are* the tactical terms, so the dotted-underline trigger styling should visibly apply inside tile labels.
Fix: Make the glossary term within the label the focusable trigger (consistent with the dotted-underline spec), not the whole tile; one sentence confirming the trigger styling applies inside tile labels.

**[Accessibility]** — Language switch has no status announcement (EXPERIENCE → Language toggle)
The toggle swaps every string client-side and sets `<html lang>`, but no live-region announcement or focus management is specified — a silently rewritten page (4.1.3).
Fix: Polite live-region announcement ("Idioma: Español" / "Language: English") on toggle.

**[Accessibility]** — Heatmap data-table equivalence is unverifiable (EXPERIENCE → Visualization Layering)
"Every viz has its data-table alternative," but no tabular form is defined for the heatmap; "genuinely equivalent" cannot be audited.
Fix: Specify the heatmap alternative (e.g., zone-by-zone table: pitch third × channel × intensity %) like the other logs.

**[Accessibility]** — Reflow specced at 390px/200% — WCAG 1.4.10 requires 320 CSS px (EXPERIENCE → Accessibility Floor; DESIGN → Layout)
Pitch panels, paired stat tiles, and the comparison stack are unverified at 320px; the Hero acceptance test would pass while the AA audit fails.
Fix: Extend the reflow requirement to 320px for all non-data-table content.

**[Accessibility]** — Hit-area collision on dense shot maps (EXPERIENCE → Interaction Primitives; FR-24)
Markers draw at ~8–14px with ≥44px invisible hit areas; the cluster popover only covers *visually* overlapping markers. Two markers 20px apart have massively overlapping targets with no disambiguation — touch users get the wrong shot.
Fix: Define hit-area partition (Voronoi) and/or extend the cluster-list pattern to any markers whose hit areas collide, not only visual overlaps.

**[Accessibility]** — Glossary tooltip missing hoverable/persistent guarantees (EXPERIENCE → Glossary tooltip)
Hoverable (pointer can move onto the content — it contains a "Ver en el glosario" link) and persistent are not specified; a hover tooltip with an interactive link that vanishes on pointer-leave is a classic 1.4.13 + 2.1.1 fail.
Fix: Remains open while pointer or focus is within trigger or panel; dismissible via Esc without moving focus; the link is reachable by Tab from the trigger.

**[i18n]** — "carrera de alta velocidad" is a calque (i18n table)
Spanish physical-performance reporting says "carrera **a** alta velocidad".
Fix: "carreras a alta velocidad" (plural in table/label contexts).

**[i18n]** — "altura de línea" reads like typography (i18n table; UJ-3 step 3)
Nobody says it bare; broadcast/analytics usage is "altura de la línea (defensiva)".
Fix: "altura de la línea defensiva", short label "altura de la línea".

**[i18n]** — "step-in → irrupción" is a made-up label (i18n table [ASSUMPTION])
Matches neither community's vocabulary. Defender-steps-out-to-press is "salto" (saltar a presionar); carrying into the block is "conducción (al interior)".
Fix: Resolve the PMSR definition before the content pass; candidate map: defender-steps-out → "salto"; ball-carry-entry → "conducción interior".

**[i18n]** — "pressing" has no row in the table (Progressive Disclosure Contract; UJ-2 step 2)
Used as a section concept but unruled — exactly what the Spanish-first policy must rule on.
Fix: Add a row; recommend translate → "presión" (section label "Presión y bloques defensivos"), consistent with "contrapresión".

**[i18n]** — Stage names uncovered, including the new round of 32 (UJ-1 shows only "Octavos de final")
The round of 32's Spanish is the awkward-but-real "dieciseisavos de final" (Spanish media already uses it). Also: fase de grupos, cuartos de final, semifinal, tercer puesto, final.
Fix: Enumerate all stage strings in the locale files/table.

**[i18n]** — Standings/leaderboard scaffolding absent (DESIGN covers only the G/E/P result chips)
Column abbreviations (PJ, G, E, P, GF, GC, DG, Pts), position names (arquero/defensa/mediocampista/delantero), lineup labels (titulares/suplentes, alineaciones, formación).
Fix: Add a "table & roster labels" block.

**[i18n]** — Key Statistics block terms unruled; offside is a genuine LatAm decision (EXPERIENCE → Key Statistics; UJ-2 "duels")
Corner ("tiro de esquina"), offside ("posición adelantada"/"fuera de lugar" vs peninsular "fuera de juego"), faltas, duelos, "cross/cross map" → "centros / mapa de centros".
Fix: Add rows; recommend "posición adelantada" for the target register.

**[i18n]** — Aria example "atajado" invents a fifth shot outcome (EXPERIENCE → Accessibility Floor vs. DESIGN shot taxonomy)
"Tiro de {player}, minuto 63, xG 0,08, atajado" uses an outcome that does not exist in Goal/On target/Off target/Blocked (a saved shot is "on target").
Fix: Align the aria vocabulary to the four ruled outcomes ("al arco") or add "saved" to the taxonomy deliberately.

**[i18n]** — "Clasificaciones" collides with standings (UJ-4 step 2; Hub carries FR-25 standings + FR-26 leaderboards)
In LatAm Spanish "la clasificación" *is* the league table — one word pointing at two different surfaces.
Fix: Standings → "Tabla de posiciones", leaderboards → "Líderes del torneo" (or "Líderes").

**[i18n]** — Empty-state copy "no incluye esta página" reads as a broken web page (State Patterns)
"Página" means the PDF page, but in a web UI it reads as *this web page doesn't exist* — alarming next to working content.
Fix: "El informe oficial no incluye esta sección."

**[i18n]** — Text sorting lacks `Intl.Collator('es')` (Component Patterns, data table sort)
Default string compare missorts Á/É/Ñ (Ñíguez, Álvarez sort after Z).
Fix: Mandate `Intl.Collator('es', {sensitivity:'base'})` for all text sorts, same normative style as the `Intl.NumberFormat` rule.

**[i18n]** — No localStorage-unavailable fallback (Component Patterns, `wcstats.locale`/`wcstats.theme`)
Safari private mode / blocked storage has no specified fallback.
Fix: try/catch wrapper; fall back to in-memory es default; toggle still works for the session.

**[i18n]** — Diego's bilingual bridge is missing from the glossary (i18n table; UJ-2; `/glossary`)
Terms ruled "translate" surface only the Spanish term in the ES UI; UJ-2 has Diego toggling the whole site to EN just to recover blog-standard terminology. Spanish-first stands — but the glossary should carry the mapping.
Fix: Every glossary tooltip and `/glossary` entry shows the counterpart term as a subtitle ("salida de balón — en: build-up"); zero cost to Mariana, removes Diego's toggle dance.

### Low (23)

**[Flow coverage]** — UJ-5 omitted without saying so (EXPERIENCE → Key Flows; prd.md §2.3 UJ-5)
A consumer extracting "every UJ" from the sources hits a silent gap.
Fix: One line under Key Flows: "UJ-5 is a pipeline journey (Epic 1); no App surface."

**[Token completeness]** — `accent-cyan-ink` defined but never referenced (DESIGN frontmatter line 31)
Cyan is never specified as a fill.
Fix: Remove, or document the cyan-fill case it serves.

**[Token completeness]** — Literal `#FFFFFF` in shadcn mapping (DESIGN → shadcn CSS-variable mapping)
The only raw hex outside frontmatter.
Fix: Tokenize (e.g., `surface-raised-light`) or leave with a comment; cosmetic.

**[Component coverage]** — Hero "stage context chip" has no visual spec (EXPERIENCE → UJ-1; DESIGN → Components)
The only chip spec is result chips.
Fix: One clause in the stat-tile or layer-shell row, or reuse the `label-caps` pill explicitly.

**[Component coverage]** — Mobile Hub "sort menu" has no behavioral spec (EXPERIENCE → Responsive & Platform, Hub row)
Trigger and a11y semantics unstated.
Fix: One line in the data-table row (e.g., shadcn DropdownMenu, mirrors `aria-sort`).

**[State coverage]** — Empty states scoped to Match Dashboard only (EXPERIENCE → Empty-state panel; Progressive Disclosure Contract last ¶)
Profile and Comparison surfaces can also have missing sections and only inherit treatment via the "same grammar" sentence — inference, not commitment.
Fix: Extend the empty-state-panel Use column to "any missing section on any surface."

**[Inheritance discipline]** — Deep-link anchor list omits `#key-stats` (EXPERIENCE → IA anchors vs. Progressive Disclosure Contract; also flagged by the PRD reconciliation)
The contract says "every section has an anchor" and Key Statistics is the first named Tactical section.
Fix: Add `#key-stats` to the list.

**[Shape fit]** — Key Flows sits mid-document (EXPERIENCE section order)
Both shape examples read flows-last as the narrative capstone. Cosmetic — extraction is unaffected.
Fix: Optional reorder.

**[Accessibility]** — Asserted contrast claims overstate (DESIGN → Canvas & ink)
ink-secondary-light on surface-overlay-light computes 6.65, not the claimed "≥7:1" (passes AA regardless); ink-primary on surface-overlay is 14.13, not "≥15:1".
Fix: Restate claims as computed, or scope them to surface-base only.

**[Accessibility]** — Pitch panel vs dark canvas is 1.55:1 with no border (DESIGN → Elevation & Depth)
Decorative boundary, not an AA fail, but low-vision users lose the panel edge.
Fix: Permit the hairline border on pitch panels in dark theme.

**[Accessibility]** — Pass-network "second tap clears" has no keyboard equivalent (EXPERIENCE → Pitch panel)
Enter toggles? Esc clears? Unstated.
Fix: Enter toggles isolation on the focused node; Esc clears.

**[Accessibility]** — Async bundle load has no `aria-busy`/loading announcement (EXPERIENCE → State Patterns → Cold route load)
SR users may read a half-populated page with no status.
Fix: `aria-busy` on loading regions + polite "Datos cargados" when the bundle lands.

**[Accessibility]** — Sticky headers can occlude the focused row (EXPERIENCE → Expert tables)
No scroll-margin/focus-into-view rule specified.
Fix: Note scroll-padding equal to sticky-header height.

**[Accessibility]** — Retained-English jargon vs Spanish TTS; blanket "no per-element lang" asserted, not tested (EXPERIENCE → Accessibility Floor)
Headings embedding retained-English terms (e.g. "Línea de momentum") will be pronounced by es-MX/es-ES TTS engines.
Fix: Keep the assumption but add an acceptance note: spot-check jargon terms with a Spanish screen-reader voice; add `lang="en"` spans only where pronunciation is unintelligible.

**[Accessibility]** — Aria strings specified in Spanish only (EXPERIENCE → Accessibility Floor, marker accessible-name pattern)
EN variants of aria strings are implied but not stated as locale-file entries.
Fix: One line: all aria-label/aria-valuetext strings are locale-file keys under FR-30, never hardcoded.

**[i18n]** — "ruptura de línea": real usage is plural (i18n table)
"Rupturas/roturas de líneas", "pases que rompen líneas"; FIFA's own Spanish EFI materials use the plural.
Fix: "rupturas de líneas" in labels.

**[i18n]** — "longitud del equipo" is slightly lab-speak (i18n table)
Broadcast Spanish says a team is "largo/corto".
Fix: Acceptable as-is; "largo del equipo" is the more colloquial alternative — pick one and note it.

**[i18n]** — "fases de juego" → more common form is "fases del juego" (i18n table)
Minor register correction.
Fix: "fases del juego".

**[i18n]** — "balón parado" vs Colombian "pelota quieta" (i18n table)
Keeping the neutral "balón parado" is defensible under "no regionalisms."
Fix: Log the decision so it isn't relitigated.

**[i18n]** — Canonical control string drift: "Ver los datos" (Voice and Tone vs. Component Patterns)
"Ver los datos de este gráfico" vs "Ver los datos / View data" — two canonical forms invite ad-hoc copies.
Fix: Pick one (the short control string) and make the Voice example match.

**[i18n]** — Flow narratives use English terms the table has ruled Spanish (UJ-2, UJ-3, layer table)
The spine is the document implementers copy labels from.
Fix: One sentence noting section labels come from the i18n table, and/or use the es labels in the layer-order list.

**[i18n]** — "En posesión / Sin posesión" tabs vs broadcast "Con balón / Sin balón" (Responsive table, Expert column-group tabs)
Fine as-is, but should be ruled, not ad-hoc.
Fix: Optional swap; if kept, add the pair to the terminology table.

**[i18n]** — RAE prescribes a space before % (Voice and Tone)
Number formatting is otherwise consistent everywhere checked (`xG 1,24`, `10,4 km`, `36,8 km/h`, aria "xG 0,08" — all es-CO comma). "62%" is fine for UI.
Fix: Log it as a deliberate choice so locale QA doesn't churn on it.

## Mechanical notes

- **Markdown table breakage:** EXPERIENCE.md → Component Patterns, Language toggle row contains an unescaped pipe inside a code span (`` `ES | EN` ``). In GFM the row parses as four columns and will render/extract broken. Escape it (`ES \| EN`) or write "ES/EN". Same string is safe in DESIGN.md (not in a table).
- All three `sources` frontmatter paths resolve on disk; zero unresolved `{path.to.token}` references; frontmatter complete on both spines; naming maps 1:1 across files.
- Spot-checked contrast claims that verify: pitch-line 3.62:1 (claimed ≈3.6), ink-primary 17.3:1 (≥15), ink-secondary 8.6:1 (≥7), accents 14.8/11.3/6.6/5.0:1 (≥4.5), shot markers 5.75–9.56 and edge-weight-1 3.83 vs. pitch (≥3:1), momentum 60%-opacity team fills 5.62 / 4.48 vs. the card.
- Reconciliation context (not reviewer findings): `reconcile-prd.md` and `reconcile-project-brief.md` both conclude "clean enough to finalize" with parent-attention items — the missing "incomplete" shot outcome (addendum §1 / brief Appendix B vs. DESIGN's four-outcome encoding), the momentum-first vs. §4.6 order contradiction (C1), and a defer-or-include decision on Domain D's offers/movement-to-receive and defensive-action visualizations.

## Reviewer files

- `review-rubric.md`
- `review-accessibility.md`
- `review-i18n.md`

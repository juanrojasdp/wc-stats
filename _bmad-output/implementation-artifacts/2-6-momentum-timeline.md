---
baseline_commit: c645cfe03242f9f66033f02c2572d3de55c25b9a
---

# Story 2.6: Momentum Timeline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Mariana,
I want the match's momentum arc right after the key stats,
so that one scroll shows me how the match swung (FR-22, UJ-1).

## Acceptance Criteria

Verbatim from `epics.md:726-745`, with this story's ruled amendments marked inline.

**AC 1 — The timeline**

**Given** a bundle with a momentum series
**When** `#momentum` renders
**Then** the recharts timeline shows team-accent area fills at 60% opacity around the reserved ink midline gutter, goal markers on the axis in the shot-goal token + ring (in tab order, announcing scorer + minute), and axis labels in tabular caption type (UX-DR8)
**And** the minute cursor is a `role="slider"` (`aria-valuemin/max`, `aria-valuetext` announcing minute + both teams' values), arrow keys move ±1 minute, and pointer users tap-to-position — no drag (UX-DR15).

> **Amended by ruled decision 1 — read this before implementing.** The `schemaVersion` 2 bump (Story 1.8) invalidated this clause and nobody re-specified it. `MomentumSample.at` is a `MinuteStamp`, so `at.minute` is **not unique**: m001 carries minute 45 five times and 90 eight times; m074 carries 45×7, 90×6, 105×5, 120×4. `aria-valuemin`/`aria-valuemax` "over match minutes" and "arrow keys move ±1 minute" no longer map one-to-one onto samples. **The slider indexes SAMPLES.** `aria-valuemin={0}`, `aria-valuemax={samples.length - 1}`, `aria-valuenow={index}`, and `aria-valuetext` announces the composed clock label including the stoppage offset. Filed as an AD-14 note at `deferred-work.md:260-272` (grep `"invalidated Story 2.6's slider AC"`); recorded in the contract at `contract-types.d.ts:833`, whose exact clause is "The slider must index samples, not minutes, and aria-valuetext must announce the stoppage offset alongside the minute." EXPERIENCE.md:74 and epics.md:737 remain stale — see ruled decision 22 for what this story owes them.

> **Line numbers into `deferred-work.md` drift.** It is a shared append-target that other in-flight sessions write to; it gained 12 lines between this story's `baseline_commit` and its creation. Every citation below is correct as of creation — if one lands somewhere unexpected, **grep the quoted phrase instead of trusting the number.**

> **Sharpened by ruled decision 9:** the 60% fill alone does **not** clear the 3:1 non-text floor in the light theme (measured 2.40:1 team A, 2.54:1 team B, against a card that is `#ffffff`). The encoding is fill **plus** a full-opacity boundary stroke; the stroke carries the contrast floor and the Team-B dash carries UX-DR11's non-hue channel.

> **Sharpened by ruled decision 10:** `--shot-goal` on the light-theme card computes **1.77:1**. DESIGN.md:288 requires the light value `#177245` (5.95:1) on theme-aware canvases, but the 2.7 code review deleted all five light shot variants on a rationale momentum falsifies. This story adds a canvas-scoped `--shot-goal-canvas` declared in **both** theme blocks — **not** a `-light`-suffixed property, which this codebase does not use and which would be undefined in the dark theme.

**AC 2 — The absence**

**Given** `momentum: null`
**When** the section renders
**Then** the dedicated empty state shows "La línea de momentum no está disponible para este partido." with the header and anchor preserved (UX-DR13).

> **Amended by ruled decision 12:** the section-level branch in `TacticalLayer.tsx:180-187` currently composes the GENERIC headline ("Sin datos de Línea de momentum para este partido.") through `useEmptyHeadline()`. UX-DR13 and `EXPERIENCE.md:92` require a **dedicated** sentence for this one section. `TacticalLayer` gains a per-section headline override; `useEmptyHeadline()` stays the default for the other ten and is not forked.

**AC 3 — The data table**

**Given** the data-table rule
**When** the user activates "Ver los datos"
**Then** the underlying series renders as a real `<table>` in place (NFR-2).

> **Sharpened by ruled decision 14:** the table ships **plain, not sortable** — the 2.8 precedent (`deferred-work.md:292`), with the 2.11 plug-in point filed. UX-DR16/NFR-2's floor is met in full.

> **Sharpened by ruled decision 11:** `ViewDataDisclosure` hardcodes `text-ink-on-pitch`, which is theme-invariant near-white with no `.light` override. On momentum's white card that computes **1.10:1** — an invisible control. The component gains a surface variant; it is not copied.

## Ruled Decisions

These are decided. Do not re-litigate them mid-implementation; if evidence contradicts one, record a departure in the Dev Agent Record with the reason, exactly as 2.7 and 2.8 did.

**1 — The slider indexes samples, not minutes.** `aria-valuemin={0}`, `aria-valuemax={samples.length - 1}`, `aria-valuenow={index}`. There is no other option: `at.minute` is not injective over the series (measured, both fixtures), so a minute-indexed slider cannot address `45+1 … 45+4` at all — four real samples would be unreachable by keyboard. The contract says so in its own description (`contract-types.d.ts:833`): "The slider must index samples, not minutes." *Rejected alternative:* index by minute and let arrow keys skip stoppage slots — that silently deletes 11 samples in m001 and 18 in m074 from keyboard reach, which is the 2.1.1 failure the slider exists to fix.

**2 — Key model: arrows ±1 sample, PageUp/PageDown ±10, Home/End to the ends, no wrap.** ±1 sample IS "±1 minute" through regulation play, and inside stoppage it steps `45+1 → 45+2`, which is the honest reading. PageUp/PageDown is the WAI-ARIA slider pattern's large step and is not optional here: m074 has 138 samples, so arrow-only traversal is 137 keypresses. No wrap, matching `PitchPanel.tsx:430-483`'s ruled roving contract ("arrowing past the last marker must not silently restart the match"). *Consequence you must accept, not fix:* at half time a reader pressing `→` five times sits on five samples that all announce minute 45 — with different stoppage offsets, which is exactly why the offset is in `aria-valuetext`.

**3 — `aria-valuetext` is one composed sentence: clock, then both teams' values, in stored units.** Shape: `"Minuto 45+2. México 3 entradas, Sudáfrica 1 entrada."` Built from `viz.momentum.*` fragments plus the two team names, through `countPhrase`-style singular/plural selection. `aria-valuetext` is a **gated prop** (`eslint.config.mjs:36-61`) — it must receive a plain identifier, never a template literal in JSX. Compose into `const cursorValueText = …` first. Reuse `formatGoalMinute(at)` from `@/lib/match-hero` for the `45+2′` clock; do **not** re-implement it.

**4 — recharts 3.x, installed by this story, with `accessibilityLayer={false}`.** recharts is pre-authorized by the stack table (`ARCHITECTURE-SPINE.md:163`, `epics.md:96` AR-15) and named by DESIGN.md:342, but it is **not installed** — this story adds it. `accessibilityLayer` defaults to **true** in v3 and installs `role="application"` on the chart container, a `tabIndex`, and its own arrow-key `keydown` handler that moves a tooltip. That is three direct collisions: with this panel's `role="figure"`, with the slider's own arrow keys, and with the goal markers' tab stops. **Set it to `false` and own the keyboard contract in our code.** *Rejected alternative:* keep recharts' layer and drop our slider — it announces a tooltip, not `aria-valuetext`, and UX-DR8's slider is a ruled requirement traceable to `review-accessibility.md:35`.

> **Rejected alternative, the big one — hand-rolled SVG.** Every visualization in this app is hand-rolled SVG driven by `useElementWidth` (`PitchPanel.tsx` is ~1,190 lines of it); `d3-delaunay` is the only geometry dependency and never touches the DOM; the mockups are hand-authored SVG paths. A diverging area chart is well within what this codebase already draws, and recharts actively obstructs three of this story's ruled requirements — we disable its accessibility layer (decision 4), we cannot express the reserved gutter through it (decision 25), and it hides the x-scale our overlays need (decision 24). **recharts is kept anyway** because AC 1 names it ("the recharts timeline"), AR-15 pins recharts 3.x, DESIGN.md:342 specifies it for this component, and stories 2.10/2.13/2.15/2.16 all carry statistical charts that would need it regardless — paying the dependency once here is cheaper than paying it later plus rewriting this. Recorded so it is not re-opened mid-implementation.

**5 — `isAnimationActive={false}`, unconditionally. No JS reduced-motion hook.** The app's entire motion policy is one global CSS block (`globals.css:423-435`) that zeroes `animation-*` and `transition-*`. **That block cannot reach recharts, which animates in JavaScript** — so "reduced motion disables animation" is not satisfied by inheritance here, and this is the one place in the app where that assumption breaks. `TacticalSection.tsx:20-22` already ruled the resolution for this codebase: "a transition that only exists for non-reduced-motion users is not worth having." Disabling animation outright satisfies UX-DR16 and `EXPERIENCE.md:117`'s "no momentum-line draw-in" **by construction**, and it is verifiable (`getAnimations({subtree:true})` returns 0). *Rejected alternative:* `isAnimationActive="auto"`, which recharts documents as respecting `prefers-reduced-motion` — it is opaque, untestable in a jsdom-less harness, and leaves an animation on the flagship viz that nothing else in the product has.

**6 — The away series is negated for GEOMETRY ONLY.** Both `home` and `away` are non-negative counts on the same scale (`minimum: 0`; measured ranges m001 0–10 / 0–6, m074 0–17 / 0–9). The diverging above/below-midline layout is presentation, not sign. Feed recharts a projected row carrying `awayPlotted = -away`, and read `sample.away` everywhere a **number reaches a human** — the data table, `aria-valuetext`, the cursor chip (decision 23), the goal-marker names. A negative number rendered anywhere a reader can see it is a defect. **This includes the y-axis**: a `[-peak, peak]` domain renders `-10 -5 0 5 10` by default, so the `YAxis` takes a `tickFormatter` returning `formatInteger(Math.abs(v), locale)`. *This is AD-5-legal:* presentation geometry from a single bundle on exactly one surface.

**7 — Goal markers come from `bundle.metadata.goals`, never from the series.** The contract states it twice (`match-bundle.schema.json:277-282`, `contract-types.d.ts:446`): "The Momentum Timeline's goal markers come from here, never from the momentum series." Match each goal to its x position by the `(minute, stoppageMinute)` key against the sample grid. `GoalRecord.teamId` is the **benefiting** team even for own goals (`ownGoal: true`, `scorerName` = the player who put it in; m074 credits Gustavo GOMEZ's own goal to `germany`). Shoot-out conversions are never in `goals`, so m074 carries exactly 2 markers on a match decided on penalties. **Marker colour is team-neutral** — `--shot-goal` + ink ring for every goal regardless of side, which is what DESIGN.md:288 specifies and what makes the emerald legible as "goal" rather than "team A".

**7a — A goal whose stamp is not in the grid must not be silently dropped.** If no sample matches `(minute, stoppageMinute)`, fall back to the nearest sample by `(minute, stoppageMinute ?? 0)` ordering and record it. A goal that vanishes from the axis is a data lie on the one chart whose job is to show when the match swung. Unit-test both the exact-hit and the fallback path.

**8 — Empty samples fail loud; `momentum: null` is the only absence state.** `MomentumSamples` is `[MomentumSample, ...MomentumSample[]]` (`@minItems 1`), so `samples: []` is a **contract violation**, not a zero-content state — the `null`-vs-`[]` rule that gave 2.7 its three-way `panelDataState` does not apply here, and momentum is genuinely two-state. But the bundle arrives as an unvalidated `as`-cast, so read defensively and **throw naming the field** if `samples` is empty or not an array. `TacticalErrorBoundary` catches it; a silently blank chart does not.

**9 — The area encoding is 60% fill PLUS a full-opacity boundary stroke; Team B's stroke is dashed.** Measured for this story, reproducing the project's own published dark-theme numbers first to validate the method (fills over `--surface-raised`: **5.61** team A, **4.49** team B — `review-accessibility.md:11` states 5.62 / 4.48). Every ratio below was independently recomputed at validation time and reproduces to within 0.005.

| Element | Composite | vs card | Floor 3:1 |
|---|---|---|---|
| Team A fill 60%, dark `#171b1f` | `#7e9e30` | 5.61:1 | ✅ |
| Team B fill 60%, dark | `#2e8e98` | 4.49:1 | ✅ |
| **Team A fill 60%, light `#ffffff`** | `#94b06f` | **2.40:1** | ❌ |
| **Team B fill 60%, light** | `#6eacbc` | **2.54:1** | ❌ |
| Team A stroke, full opacity, light `#4d7c0f` | — | **4.99:1** | ✅ |
| Team B stroke, full opacity, light `#0e7490` | — | **5.36:1** | ✅ |
| Team A stroke, full opacity, dark `#c3f53c` | — | **13.56:1** | ✅ |

`review-accessibility.md:11` verified the fills **in the dark theme only** — "momentum 60%-opacity team fills over surface-raised composite to 5.62 / 4.48 vs the card (≥3:1)". Nobody measured light. Keep the ruled 60% (it is contrast-verified where it was verified, and changing it re-opens a settled UX number); add a 2px full-opacity stroke on each area's outer boundary to carry the floor. Team B's stroke is **dashed**, which discharges DESIGN.md:266's standing requirement that "every two-team recharts view … Team B series additionally use a dashed stroke or pattern fill" — momentum is exactly that case, and above/below-midline position alone is not a substitute the moment the two areas overlap visually at the gutter.

**9a — Direct series labels are required, at the LEFT end.** DESIGN.md:266: "every two-team recharts view carries direct series labels (team code at the bar/line end)" — it does not say which end. The mockup does: `desktop.html:253-254` draws `<text x="8" y="20">MEX</text>` and `<text x="8" y="150">ARG</text>` in a `0 0 1056 170` viewBox, i.e. **flush left**, home above the midline and away below. Follow the mockup. Render the uppercase `teamCode` in that series' full-opacity accent, in `type-label-caps` — note that utility does **not** apply `text-transform` despite its name (`globals.css:339-345`); the uppercasing comes from `teamCode.toUpperCase()` at the `TacticalLayer` prop boundary (Task 7.1).

**10 — Add a canvas-scoped goal token `--shot-goal-canvas`, declared in BOTH theme blocks. Never author a `-light` suffix.** The 2.7 code review deleted all five `--shot-*-light` overrides with this rationale (`globals.css:165-172`): "they render only on the theme-invariant pitch, so a light-canvas variant of them is unconditionally wrong". **Momentum is the counter-example that rationale missed** — DESIGN.md:280 names "momentum goal markers" as one of three theme-aware canvases needing the light value, and DESIGN.md:288 states it. Measured: `--shot-goal #3fdd85` on `#ffffff` = **1.77:1**; `#177245` on `#ffffff` = **5.95:1**, reproducing DESIGN.md's published figure exactly.

> **Mechanism, ruled — DESIGN.md's `{colors.*-light}` names are DESIGN-DOC names, not CSS names.** There is **not one `-light`-suffixed custom property in `globals.css`** (verified). The house pattern is: declare the base name in `:root, .dark`, then **re-declare the same name** inside `.light` (e.g. `--viz-team-a` is `#c3f53c` at `:64` and `#4d7c0f` at `:173`); theme-invariance is expressed by *omission* from `.light`, plus a parallel `-on-pitch` family for marks that live on the green. A `--shot-goal-light` declared only inside `.light` would be **undefined in the dark theme** — the flagship chart's goal markers would have no fill in the canonical theme — and nothing in a viz component can branch on theme anyway, because theme is a CSS class and no viz component reads it in JS.
>
> **Therefore:** add `--shot-goal-canvas: #3fdd85` to `:root, .dark` **and** `--shot-goal-canvas: #177245` to `.light`, and register `--color-shot-goal-canvas` in `@theme inline`. Momentum uses it; both themes resolve; no JS branch. **Leave `--shot-goal` and every pitch consumer untouched** — `shot-map-model.ts:33` carries `colorVar: "--shot-goal"` and the pitch must keep the emerald in both themes. *Rejected alternative:* making `--shot-goal` itself theme-switching and moving the pitch to a new `--shot-goal-on-pitch` — cleaner in the abstract, and it is how `--viz-team-*` works, but it edits `shot-map-model.ts` and `marker-model.ts`, both on this story's do-not-touch list, to fix a problem momentum can solve in its own lane.

Amend the `globals.css:83-99` and `:165-172` comment blocks to record that a canvas-scoped goal token now exists and why the "unconditionally wrong" rationale is scoped to the *pitch* consumers — leaving those comments asserting the unqualified rationale is how the next story deletes this token.

**10a — The team accents need NO new token.** `--viz-team-a` / `--viz-team-b` already re-declare to `#4d7c0f` / `#0e7490` under `.light` (`globals.css:173-174`), which are exactly the values decision 9 measured. Use `--color-viz-team-a` / `--color-viz-team-b` (`:232-233`) and **both themes are correct for free**. Do not add anything here; do not reach for an `-on-pitch` variant, which is the wrong family for a card.

**11 — `ViewDataDisclosure` gains a surface variant. Do not copy the component.** Its button is `text-ink-on-pitch` (`ViewDataDisclosure.tsx:68`), theme-invariant near-white by design, with the on-pitch justification in-comment. On momentum's `--surface-raised` card that is `#f2f5f7` on `#ffffff` = **1.10:1**. Add an opt-in prop `surface?: "pitch" | "canvas"` defaulting to `"pitch"` so the **one** existing call site (`PitchPanel.tsx:1190` — verified, it is the only one) is untouched; `"canvas"` swaps the ink to `text-ink-primary`. Keep the underline. *Rejected alternative:* a private copy of the disclosure — the component exists precisely so the `aria-controls`-only-while-mounted fix (patched twice already) is not re-broken.

> **Two facts about this component the dev will otherwise rediscover the hard way.** (a) `KeyStatisticsSection` carries its own inline duplicate of the disclosure pattern rather than using this component — an existing inconsistency, **not this story's to reconcile**; do not refactor it. (b) The disclosure's region **already applies `overflow-x-auto`** (`ViewDataDisclosure.tsx:79`), so the data table must not wrap itself in a second scroll container.

**12 — The dedicated empty-state copy lives at `tactical.empty.momentumHeadline`, applied by a per-section override in `TacticalLayer`.** UX-DR13 and `EXPERIENCE.md:92` require "La línea de momentum no está disponible para este partido.", not the generic composition. The hook's real signature is `useEmptyHeadline(): (title: string) => string` — it takes **no argument** and is called **unconditionally once** at `TacticalLayer.tsx:49`. The override is a lookup applied at the `headline=` prop inside the `plan.isEmpty` ternary (`TacticalLayer.tsx:180-184`), **never a conditional hook call**: `headline={EMPTY_HEADLINE_OVERRIDE[plan.id] ? t(EMPTY_HEADLINE_OVERRIDE[plan.id]) : emptyHeadline(title)}`, hoisted into an identifier because the ternary form trips the i18n gate. The `explanation` stays `tactical.empty.explanation`. **`sectionDataState` is already correct** (`tactical-sections.ts:119-120`, `bundle.momentum !== null`) — do not touch `tactical-sections.ts`, exactly as 2.8 ruled for its own case (decision 13). The section header and `#momentum` anchor survive automatically because `TacticalSection` renders the `<h2>` outside the empty/populated ternary. **This branch will not fire on real corpus data** — all 104 reports carry a band; m002's `null` is a deliberate synthetic edge case that must never be regenerated (`data/fixtures/README.md:34-40`). Do not conclude from a clean run that the branch is dead.

**13 — The section title stays "Línea de momentum". The metric is named everywhere a number is.** The contract is emphatic (`match-bundle.schema.json:31`): the series is a per-minute count of **final-third distributions**, "NOT a possession percentage and not an abstract momentum index; the App's own copy must not imply otherwise." But "momentum" is a ruled product concept with a ruled i18n treatment — `EXPERIENCE.md:259` keeps the English term and attaches a glossary tooltip, and `EXPERIENCE.md:206` names the section "Momentum Timeline". So: keep the title, and name the real metric in the panel subtitle, the y-axis label, the `role="figure"` `aria-label`, the `aria-valuetext`, and the data-table column heads. *Rejected alternative:* renaming the section the way 2.7 renamed `shot-maps` (ruled decision 11) — that rename removed a promise the data could not keep ("y xG"); this title promises a named product concept the data does keep, at a different granularity than a naive reader assumes. Naming the metric beside the numbers closes the gap without re-litigating a ruled term.

**14 — The data table ships plain, not sortable.** Direct 2.8 precedent (`deferred-work.md:292`, grep `"The pass matrix ships PLAIN"`): UX-DR12's sort contract — `aria-sort`, `Intl.Collator('es',{sensitivity:'base'})`, polite live-region announcements, sticky header, stated default sort — is ONE cross-table contract that Story 2.11 implements once, and a bespoke second copy is what 2.11 would then have to reconcile. UX-DR16/NFR-2's floor (a reachable table carrying the same numbers) is met in full today. File the plug-in point: the `<th>` elements in the private `DataTable` and the row array in `momentum-model.ts`.

**15 — Nothing is summed, averaged, or totalled.** `deferred-work.md:274-278` (grep `"no per-team totals anywhere in the report"`): the momentum series has **no per-team totals anywhere in the report** — tested against all 208 Domain B team-innings, best exact-match rate 2/208. A "total final-third entries" chip would be an unvalidatable derivation and is banned. Counting the goal markers actually drawn is permitted (2.7 ruled decision 12's precedent) and is the only count the figure summary may carry beyond `samples.length`.

**16 — Zeros are data. Never gap the line, never interpolate.** 30 of m001's 101 samples and 23 of m074's 138 are `0/0`. The contract: "a minute in which neither team entered the final third carries 0/0, never a missing sample." Story 1.8 recorded this as landmine 3 — emitting a gap "will show phantom gaps" on this exact chart. Do not pass `connectNulls`, do not filter zeros, do not smooth.

**17 — The y-domain is derived from the data and symmetric; never hardcoded.** Per-report maxima run 9–21 corpus-wide (m001 tops at 10 home / 6 away; m074 at 17 / 9). Compute `peak = max over samples of max(home, away)` and set the domain to `[-peak, peak]` so the midline is the true zero and the two halves are comparable. A hardcoded ceiling is the same trap 2.8 recorded for its synthetic edge maximum.

**18 — The minute cursor is a hand-rolled `role="slider"` element, not `<input type="range">`.** There is no slider precedent in the repo and no Radix Slider vendored — this is a genuine choice. A native range input cannot carry the tick geometry, cannot be positioned over the plot area without fighting UA styling in two themes, and its thumb is not the dashed full-height rule the mockup draws (`desktop.html:255-258`). Hand-rolled: a focusable `<div role="slider">` with `tabIndex={0}`, `aria-orientation="horizontal"`, an `aria-label` from the locale layer, the four aria value props, and the decision-2 key handler. It gets the global `:focus-visible` ring (`globals.css:416-421`) — **never `outline-none`**, a regression that has cost a patch in two prior reviews.

**19 — Tap-to-position, and the drag ban is enforced by not writing the handler.** One `onPointerDown` on the plot area maps clientX → nearest sample index and sets it. There is **no** `pointermove` listener, no `setPointerCapture`, no drag state. `EXPERIENCE.md:107` bans drag in v1 and names this control as the reason the ban is liveable. The plot area's pointer target must be ≥44px tall (UX-DR15); decision 27's heights clear that at both breakpoints, but the goal markers' own hit areas do not come for free — give each an invisible ≥44×44px hit target using `MIN_HIT_PX` imported from `marker-layout.ts`. Pointer precedence between the two is decision 26.

**20 — Tab order inside the panel: goal markers in clock order, then the slider, then "Ver los datos".** `EXPERIENCE.md:105`: "Tab order follows reading order." The goal markers are content sitting at fixed points on the axis; the slider is the control that reads the chart; the disclosure is below both. Corpus goal counts are small, so the slider is never buried. *Rejected alternative:* slider first, on the argument that it is the primary interaction — it inverts reading order for a saving that does not exist at real goal counts.

**21 — The chart is code-split via `next/dynamic`.** recharts is ~147 kB gzipped and pulls `@reduxjs/toolkit`, `react-redux`, `immer` and `victory-vendor` — larger than everything currently in the app's client bundle. `momentum` is in `ALWAYS_EXPANDED_SECTION_IDS`, so it gets **none** of UX-DR6's lazy-mount deferral that `TacticalSection` was built to give the pitch panels (`2-7…md:309`). Import the recharts-bearing component with `next/dynamic` (`ssr: false` is legal — `TacticalLayer` is already client-only by AR-11) with the existing `skeleton` utility as the fallback, so recharts lands in its own chunk and never blocks the Hero, key-stats, or the rest of the Tactical layer. **Record the measured chunk size in verification.** NFR-1's Lighthouse ≥90 on the Match Dashboard is the budget this protects.

**22 — This story files the EXPERIENCE.md staleness; it does not silently edit it.** `deferred-work.md:271` and the 1.8 review both route the slider re-spec to "UX's and 2.6's call". Decision 1 IS that ruling. Record it in `deferred-work.md` as resolved-by-2.6 and file a note that `EXPERIENCE.md:74` and `epics.md:737` still describe a minute-indexed slider. **Do not edit EXPERIENCE.md or epics.md in this story** — 2.7's precedent for correcting a spine document (the DESIGN.md light-theme note) was a ruled, disclosed edit, and this one changes a normative UX sentence that UX should sign. Surface it to Juan at validation.

**23 — The cursor chip carries the numbers, and there is NO recharts `<Tooltip>`.** UX-DR15 / `EXPERIENCE.md:103` are categorical: "no hover-only information, ever (viz popovers included)" — and a recharts `<Tooltip>` is hover-only. But `EXPERIENCE.md:218` defines this viz's Tactical altitude as "Per-minute values via scrub", and the mockup's chip shows only a minute (`63′`). As specified by the mockup alone, screen-reader users would get both teams' values through `aria-valuetext` while sighted users got a bare minute — the one thing the scrub exists to deliver, unavailable to most users. **The chip therefore carries minute AND both teams' values** — e.g. `63′ · MEX 4 · RSA 2` — in `type-table-numeric` (which already carries tabular figures), updating on both arrow-key and tap. It is the same fact family as `aria-valuetext` and shares its composed inputs. *Do not add a `<Tooltip>`.*

**24 — Chart geometry is recharts-native. Do not hand-position DOM over the plot area.** recharts does not expose its resolved x-scale to a sibling node, and there is no jsdom to test against, so an HTML overlay is a blind iteration loop. Use the API:
- **Goal markers:** `<ReferenceDot x={rowIndex} y={0} shape={<GoalMarker …/>} />`. The custom `shape` receives resolved `cx`/`cy`; an SVG `<g role="button" tabIndex={0}>` is legal and focusable, and the invisible `MIN_HIT_PX` hit `<rect>` centres on `cx`/`cy`.
- **Cursor:** a `<Customized component={…}>` layer (v3 hands it the resolved axis maps) or a `<ReferenceLine x={index} shape={…}>`. The `role="slider"` element is the SVG `<g>` that layer renders — decision 18's "focusable element" is satisfied by an SVG node with `tabIndex`, not necessarily an HTML `<div>`.
- **Series labels:** `<Label position="right">` on each `<Area>`.
- **`<AreaChart>` takes a fixed `margin` object**, so any arithmetic that does need pixels has a known origin.
- **Tab order is DOM/declaration order** (decision 20): declare the `ReferenceDot`s before the cursor layer. **Never a positive `tabIndex`.**

**25 — The reserved gutter ships as a declared deviation, and its contrast is re-measured.** DESIGN.md:288 specifies a "reserved 2px axis gutter that the area fills never enter, so it always sits on the card surface (computed 15.8:1 vs. surface-raised)". **That geometry is not expressible in recharts.** With a continuous `[-peak, peak]` domain and both Areas anchored at 0, the two fills meet exactly at y=0; `baseValue` is a single number per Area, so offsetting to open a gap would render every `0/0` minute as a visible band — a data lie on the exact 30/23 samples decision 16 protects. **Ruling:** draw the 2px `--ink-primary` midline **over** the fills, declared last (recharts v3 **removed `isFront`** on reference elements, so declaration order is the only lever), and **re-measure ink-primary over the composited 60% fills in both themes**, recording the real ratio rather than inheriting DESIGN.md's 15.8:1, which describes a geometry that will not ship. File the DESIGN.md delta the way decision 22 files the EXPERIENCE.md one. *Note the 15.8:1 figure is measured against the card, not against a fill — do not restate it.*

**26 — Pointer precedence: goal markers win over tap-to-position.** Decision 19's plot-area `onPointerDown` and decision 24's marker hit boxes occupy the same pixels, and pointer events bubble. **Goal-marker handlers call `event.stopPropagation()`** so activating a marker does not also move the cursor. Marker-vs-marker overlap (two goals closer than `MIN_HIT_PX` apart — reachable at `<md`, where 138 samples land ~2.4px apart on a 326px chart) resolves **first-in-DOM-order wins**, which is chronological by decision 7. Corpus goal counts are small (both fixtures carry 2), so this is sufficient — but it is *ruled*, not accidental, and Task 4 pins it with a constructed two-adjacent-goals case. *Rejected alternative:* importing `clusterMarkers`/`hitCells` from `marker-layout.ts` — they solve 2-D pitch collision; this is a 1-D axis with single-digit marker counts.

**27 — Responsive: full width at every breakpoint, reduced height below `md`. No team tabs.** `EXPERIENCE.md:131` is explicit and momentum is the **only** viz in that table with no `<md` tab/split treatment: "Full-width, comfortable height | Full-width, **reduced height**; scrub by tap-to-position + arrow keys". Do not reach for the team-tab pattern by analogy with 2.7/2.8 — both teams stay in one frame at every width, which is also what makes the above/below-midline encoding readable. Heights come from the mockups: **~170px at `≥md`** (`desktop.html:248`, `viewBox="0 0 1056 170"`) and **~122px below** (`mobile.html`, `viewBox="0 0 326 122"`). **`ResponsiveContainer` renders nothing if its parent has no resolved height** — this is recharts' single most common failure mode, and Task 2.2 has already primed you to misread a blank chart as the React 19 issue. Give it a wrapper with an explicit height via responsive Tailwind classes; at 122px the plot is still ≥44px tall, so decision 19's pointer floor holds.

## Tasks / Subtasks

- [x] **Task 1 — Baseline and orientation** (no AC; do this first)
  - [x] 1.1 `git log -1` to confirm you are at or after `c645cfe`. Run `npm test` in `app/` and record the baseline: it should be **307 passed / 15 files**. Run `npm run check:types` and `npm run assert:schema-version` — both were green at story-creation ("237 declarations from 6 schemas"; "7 artifact(s) at schemaVersion 2"). If `check:types` fails, run `npm run generate:types` and continue; **never hand-edit the generated types, never hardcode `SCHEMA_VERSION`.** If `assert:schema-version` fails, **stop and reconcile** — do not build against stale types.
  - [x] 1.2 `git status` will show in-flight **pipeline** work from other sessions (stories 1-9 and 1-13 share this working tree). Do not revert, do not stage, do not "fix" any of it. This story touches `app/` only.
  - [x] 1.3 Read `app/src/components/PassNetworksSection.tsx` end to end. It is the most recent section component and the closest structural sibling: section → panel(s) → figure → controls → `ViewDataDisclosure` → private `DataTable`. You are writing the fourth instance of that shape.

- [x] **Task 2 — Install recharts and prove it renders under React 19.2.8** (AC 1; do this BEFORE writing the surface)
  - [x] 2.1 `npm install recharts` in `app/`, pinning the latest stable 3.x at install time (3.10.1 at story-creation). `ARCHITECTURE-SPINE.md:163` says "3.x latest stable at install"; `review-web-verify.md:53-56` explicitly warns against committing the spine to a day-old minor. **Commit `package-lock.json`** (AD-13 dependency locking).
  - [x] 2.2 **Render spike, before anything else.** recharts issue #6857 reports charts rendering blank under React 19.2.3 with no console error; it is closed as "needs reproduction", not as fixed, and this app is on **React 19.2.8**. Stand up a throwaway `AreaChart` with three hardcoded points **inside a parent with an explicit height** (decision 27 — a height-less `ResponsiveContainer` renders nothing and would counterfeit this exact failure), build, serve, and confirm it paints. If it does not, try a `react-is` override matching the React version — but note that `review-web-verify.md:54` states the 2.x-era `react-is` override problem "was resolved by the 3.0 state rewrite", so this is a fallback to attempt, **not** a documented 3.x fix. Whatever you do, **record it in the Dev Agent Record as a declared deviation**. Do not proceed to Task 5 until a recharts chart has painted in this app.
  - [x] 2.3 Confirm recharts is the only new runtime dependency. Do not add `d3`, `d3-scale`, `d3-shape`, `d3-force`, a state library, a client cache, jsdom, or Testing Library.

- [x] **Task 3 — `app/src/viz/momentum-model.ts`** (AC 1, AC 2, AC 3) — the pure, testable heart
  - [x] 3.1 No React, no DOM, no `t()`, no `@/lib/format`. Return dictionary **keys** and **raw numbers**; the component resolves them. This split is the only reason any of this is testable in a node-only harness, and it is why 90 of 2.7's 99 new tests live in `src/viz/`. **Note what the seam does and does not enforce:** `eslint.config.mjs:83-116` restricts exactly two paths — the `t` binding from `@/lib/i18n`, and `@/lib/build-data`. **`@/lib/format` is NOT restricted and CI will not catch it** (probed live at validation). Keeping formatting out of `src/viz/**` is design discipline here, not a machine-checked rule — the module must stay locale-free because only the component has the locale.
  - [x] 3.2 `momentumRows(series)` → the plot rows. Each row carries the sample index, the raw `home` and `away`, the plotted `awayPlotted = -away` (decision 6), and the `at` stamp. **Read defensively** — the bundle is an unvalidated `as`-cast. Throw naming the field if `samples` is missing, not an array, or empty (decision 8).
  - [x] 3.3 `momentumPeak(rows)` → `max(max(home, away))` across all rows, for the symmetric domain `[-peak, peak]` (decision 17). Guard the all-zeros case: a peak of 0 must not produce a degenerate `[0, 0]` domain — floor it at 1.
  - [x] 3.4 `goalMarkers(goals, rows)` → one entry per goal with its resolved row index, `teamId`, `scorerName`, `ownGoal`, `penalty`, and the `at` stamp. Exact `(minute, stoppageMinute)` match first, nearest-by-ordering fallback second, and a flag recording which path was taken (decision 7a). Sort chronologically — that sort IS the tab order (decision 20).
  - [x] 3.5 `momentumTableRows(rows, goalMarkers)` → the data-table rows: clock stamp, home value, away value, and whether a goal fell on that sample. **Raw values only** (decision 6) — never `awayPlotted`, never a negative number. Carry the raw `at` object, not a formatted string, and **do not replicate `ShotLogRow`'s `?? 0` minute defaulting** (`deferred-work.md:231`, grep `"dead fields carrying a defaulting decision"` — it sorts a clock-less row to minute 0, the opposite of `orderByMinute`'s ruled contract).
  - [x] 3.6 `momentumFigureCounts(rows, goalMarkers)` → `{ samples, goals }` for the figure summary. Counts come from what is **drawn** — never from `keyStatistics.goals` (2.7 ruled decision 12: reading `keyStatistics` renders "1 gol" over a goal-less figure). Nothing else is counted, summed or averaged (decision 15).
  - [x] 3.7 Export the encoding constants the component needs as module consts: fill opacity `0.6`, stroke width, the Team-B dash array, the goal-marker radius and ring width, and `MIN_HIT_PX` reused from `@/viz/marker-layout` rather than re-declared.

- [x] **Task 4 — `app/src/viz/momentum-model.test.ts`** (AC 1, AC 2, AC 3)
  - [x] 4.1 Run every exported function over the **real fixtures** `m001` and `m074`, the way `tactical-sections.test.ts` does. Assert **literals, not re-derivations** — a test that re-computes the formula proves nothing (2.4 review lesson).
  - [x] 4.2 Pin the measured facts from this story's Dev Notes as literals: m001 → 101 rows, peak 10, minute range 1–90, 11 stoppage samples, 30 zero-zero samples; m074 → 138 rows, peak 17, range 1–120, 18 stoppage samples, 23 zero-zero samples. If any of these moves, the fixture moved and something upstream needs a look.
  - [x] 4.3 **The uniqueness test that gives decision 1 its teeth**: assert that `at.minute` is NOT unique in either fixture (m001 minute 45 ×5, minute 90 ×8; m074 45×7, 90×6, 105×5, 120×4) and that the row indices ARE unique and contiguous `0…n-1`. This test fails if anyone re-indexes the slider by minute.
  - [x] 4.4 `goalMarkers` over m074: exactly **2** markers on a shootout match (shoot-out conversions are never in `metadata.goals`), the own goal resolves to `teamId: "germany"` with `scorerName: "Gustavo GOMEZ"` and `ownGoal: true`. Over m001: exactly **2** markers, at minutes 8 (Julián QUIÑONES) and 66 (Raúl JIMÉNEZ), both exact grid hits — pin the resolved indices as literals.
  - [x] 4.4a Three constructed cases the fixtures cannot give you, because **no fixture has a goal in stoppage time and none has `penalty: true`**: (a) a goal at an off-grid stamp → the nearest-sample fallback fires and is flagged; (b) a goal at an exact **stoppage** stamp (e.g. `{minute: 45, stoppageMinute: 2}`) → resolves to that sample and not to the `45/null` one, which is the only test that proves the composite key is really composite; (c) `penalty: true` → the spoken qualifier renders. Also construct two goals closer than `MIN_HIT_PX` apart and assert decision 26's first-in-DOM-order resolution.
  - [x] 4.5 `momentumRows` throws, naming the field, on `{samples: []}`, on `{samples: null}` and on a missing `samples` key (decision 8).
  - [x] 4.6 `awayPlotted` is negative wherever `away > 0`, and `momentumTableRows` emits **no negative number anywhere** over both fixtures (decision 6).
  - [x] 4.7 Every sample with `home === 0 && away === 0` is present in the output rows — none filtered (decision 16).

- [x] **Task 5 — `app/src/components/MomentumChart.tsx`** (AC 1) — the recharts-bearing leaf, dynamically imported
  - [x] 5.1 `"use client"`. Props are narrow and pre-resolved: rows, peak, goal markers, both teams' `{teamId, teamCode, name}`, the resolved figure summary, and the resolved locale-layer strings it renders. **Never the whole bundle.**
  - [x] 5.2 `<AreaChart>` inside `<ResponsiveContainer>`, on a `bg-surface-raised rounded-lg` card with the DESIGN.md rhythm — `rounded.lg` (12px) is DESIGN.md:324's step for "pitch panels and **major viz containers**", and DESIGN.md:342 classes momentum as a viz; `PitchPanel.tsx:1093` already uses `rounded-lg`. (The mockup's 8px is the generic `.card` rule, which is illustrative — spines win on conflict.) **The `ResponsiveContainer`'s parent must have an explicit resolved height** (decision 27: ~170px `≥md`, ~122px below) — with no height it renders nothing, and Task 2.2 has primed you to misread that as the React 19 issue. `accessibilityLayer={false}` (decision 4) and `isAnimationActive={false}` on every animatable child (decision 5) — `Area`, and any `ReferenceLine`/`ReferenceDot` that takes it. Give `<AreaChart>` a fixed `margin` object (decision 24).
  - [x] 5.3 Two `<Area>`s: home from `0` upward, away from `0` downward on `awayPlotted`. Pin every prop rather than trusting a default: `type="linear"` (the mockup draws straight segments; `monotone` would smooth, which decision 16 forbids), `fillOpacity={0.6}`, `strokeWidth={2}`, `strokeOpacity={1}`, Team B's `strokeDasharray` per decision 9, `baseValue={0}`, `dot={false}`, `activeDot={false}`, **no** `stackId`, **no** `connectNulls`.
  - [x] 5.3a `<YAxis>` takes the `tickFormatter` from decision 6 so the `[-peak, peak]` domain never renders a negative tick. `<XAxis>` ticks are sample indices formatted back to a clock label.
  - [x] 5.4 The **midline**, per decision 25: a 2px `--ink-primary` `ReferenceLine` at y=0, **declared last** so it paints over the fills (recharts v3 removed `isFront`, so declaration order is the only lever). Do **not** attempt a `baseValue` offset — it renders every `0/0` minute as a visible band. `review-accessibility.md:18` filed the failure mode this line exists to avoid: the midline "vanishes inside team A's area" at 1.03:1 when drawn in `--viz-neutral`. **Never use `--viz-neutral` for this line.** Measure the shipped ink-over-fill ratio in both themes and record it (Task 11.5) — DESIGN.md's 15.8:1 describes the reserved-gutter geometry that is not shipping.
  - [x] 5.5 Axis labels in `type-caption` with **tabular figures**. `type-caption` (`globals.css:347-352`) does not carry `font-variant-numeric: tabular-nums`, but DESIGN.md:342 requires "axis labels in {typography.caption} tabular" and DESIGN.md:301 makes it mandatory. **The fix is the Tailwind core utility: `className="type-caption tabular-nums"`.** Do **not** amend the `type-caption` utility — it is used by table captions and panel captions where proportional figures are correct. Recharts ticks take it as `tick={{ className: "type-caption tabular-nums", fill: "var(--ink-secondary)" }}`; use the `fill` presentation prop with a `var()`, because Tailwind `fill-*` utilities do not reliably reach recharts' internally-rendered `<text>`.
  - [x] 5.6 Tick labels use the `′` prime glyph as the mockup does (`0′ 15′ 30′ 45′ 60′ 75′ 90′`), in `--ink-secondary`. The prime is a **module const**, not a bare JSX literal (i18n gate).
  - [x] 5.7 Direct series labels: the uppercase `teamCode` flush **left**, home above the midline and away below, in that series' full-opacity accent, `type-label-caps` (decision 9a — the mockup draws both at `x="8"`).
  - [x] 5.8 Goal markers on the axis: `--shot-goal` fill + 1.5px `--ink-primary` ring, at the midline. Each is a focusable `<button>`-semantics element in the tab order with an accessible name composed from the locale layer announcing scorer + minute, plus the own-goal and penalty qualifiers where true. Invisible ≥44×44px hit area (decision 19).
  - [x] 5.9 The minute cursor: a `role="slider"` element per decision 18, with `aria-valuemin/max/now`, the composed `aria-valuetext` identifier (decision 3), the decision-2 key handler, and the dashed full-height rule + minute chip the mockup draws. `onPointerDown` on the plot area only — **no `pointermove`, no drag** (decision 19).
  - [x] 5.10 The panel is `role="figure"` with a localized one-sentence `aria-label`. The root `<svg>` is **not** `aria-hidden` — decorative subtrees are (2.7 ruled decision 8: an `aria-hidden` subtree containing tabbable descendants is an axe `aria-hidden-focus` violation). Heading level is `<h3>` if the panel carries a title at all; `TacticalSection` owns the `<h2>`.
  - [x] 5.11 Use `cn()` for conditional `className`. A hand-rolled template-literal className was patched in the 2.4 review and again in the 2.7 review — do not make it three.

- [x] **Task 6 — `app/src/components/MomentumSection.tsx`** (AC 1, AC 3)
  - [x] 6.1 `"use client"`. Owns the locale layer, the format layer, and the state; imports `MomentumChart` through `next/dynamic` (decision 21). **This is the first `next/dynamic`/`React.lazy`/`Suspense` in the codebase** — there is no precedent to copy. The `loading` fallback is a `skeleton` block **at the chart's exact height** (decision 27) with `aria-busy="true"`: the `skeleton` utility sets background, radius and pulse only and **supplies no dimensions** (`globals.css:370-374`), so an unsized fallback collapses to ~0px and the chart then mounts at full height. That is a CLS hit against the very NFR-1 budget decision 21 exists to protect, and worse, it breaks the `#momentum` deep link — `TacticalLayer.tsx:56-70` scrolls on mount, before the dynamic chunk resolves, so the page would jump out from under the reader.
  - [x] 6.2 Resolve every string here: figure summary, axis labels, the metric subtitle, goal-marker names, the slider label and `aria-valuetext`, table caption and column heads. Compose each into a **named identifier** before it reaches a gated prop.
  - [x] 6.3 Counters go through a private `countPhrase(count, oneKey, manyKey)` copied from `ShotMapsSection.tsx:127-136` — `t()` has no plurals, and 2.7's review still caught a "1 completados" in the one component built around that helper. **Plan the singulars up front**: entries, goals, minutes.
  - [x] 6.4 The cursor index is **ephemeral component state** (AR-10) — not the URL, not Context, not localStorage. Clamp it at **read time**, never sync it in an effect (`PitchPanel.tsx:394-399`; `react-hooks/set-state-in-effect` will fire otherwise).
  - [x] 6.5 `ViewDataDisclosure` with `panelTitle` = the resolved section title, `trailing` = the permanent attribution caption `viz.attribution` in `type-caption text-ink-secondary`, and the new `surface="canvas"` variant (decision 11). **Do not re-add the caption** — the disclosure owns it.
  - [x] 6.6 A private `DataTable` following the `PassNetworksSection` shape, with **canvas ink substitutions**: `text-ink-primary` / `text-ink-secondary` / `border-hairline` instead of the pitch-scoped `-on-pitch` and `pitch-line/40` classes. `<caption>` states this table's own order ("Ordenado por minuto de partido."), `<th scope="col">`, numeric cells right-aligned in `type-table-numeric`, hairline dividers, no zebra striping. **Do not add `overflow-x-auto`** — `ViewDataDisclosure.tsx:79` already applies it to the region, and a second scroll container nests them. Add a comment naming the 2.11 plug-in point (decision 14).
  - [x] 6.7 Build the row sets **eagerly** so decision 8's throw happens on load inside `TacticalErrorBoundary`, not on a later interaction.

- [x] **Task 7 — Wire it in** (AC 1, AC 2)
  - [x] 7.1 In `TacticalLayer.tsx`, delete `case "momentum":` from the `PendingSectionPanel` fall-through group (`:134-142`) and give it its own `return <MomentumSection … />` with narrow props, following the `shot-maps` and `pass-networks` precedents (`:96-133`) — `home`/`away` as `{teamId, teamCode: …toUpperCase(), name}`, plus `bundle.momentum` and `bundle.metadata.goals`. **This is the one line the dispatch was built for; change nothing else in the switch.**
  - [x] 7.2 Add the per-section empty-headline override (decision 12) at the `headline=` prop inside the `plan.isEmpty` ternary (`TacticalLayer.tsx:180-184`), so `momentum` gets `tactical.empty.momentumHeadline` while the other ten keep the composed default. `useEmptyHeadline()` takes **no argument** and stays called unconditionally at `:49`; its returned function takes the title. **Never a conditional hook call.** Do not fork the hook; do not touch `tactical-sections.ts`.
  - [x] 7.3 Confirm `sectionSummaryKey` is still never called for momentum — `TacticalLayer.tsx:171` already guards with `isCollapsibleId`. Do not mint `tactical.sections.momentum.summary`; it is a **compile error** by type (`sectionSummaryKey` takes `CollapsibleSectionId`).

- [x] **Task 8 — Tokens** (AC 1)
  - [x] 8.1 Add `--shot-goal-canvas: #3fdd85` to `:root, .dark` **and** `--shot-goal-canvas: #177245` to `.light`, then register `--color-shot-goal-canvas` in `@theme inline` (decision 10). **Never author a `-light`-suffixed property** — no such token exists in this file and one declared only in `.light` is undefined in the dark theme. Amend **both** comment blocks: `:165-172` carries the "unconditionally wrong" phrasing verbatim, and `:83-99` makes the same argument in different words ("their former `.light` overrides were deleted rather than retuned"). Scope each to the *pitch* consumers and name momentum as the theme-aware canvas DESIGN.md:280 always intended.
  - [x] 8.1a Do **not** add anything for the team accents — `--viz-team-a` / `--viz-team-b` already re-declare under `.light` to exactly the values decision 9 measured (decision 10a). Use `--color-viz-team-a` / `--color-viz-team-b` and both themes are correct for free.
  - [x] 8.2 Decide and record the gridline/axis ink. **No chart, axis, gridline, tick or duration token exists in this codebase** — this story is the first surface to need one. The honest defaults are `--border-hairline` (globals.css:34 calls it "The ONLY divider weight") for gridlines and `--ink-secondary` for tick labels. If you introduce a new token instead, measure and record its contrast in **both** themes, following the pattern of every other block in that file.
  - [x] 8.3 Do **not** add a `.light` override for `--ink-on-pitch`, `--viz-team-a-on-pitch`, `--viz-team-b-on-pitch`, `--focus-ring-on-pitch` or `--edge-weight-*`. Those are theme-invariant by ruling and momentum does not consume them.

- [x] **Task 9 — Locales** (AC 1, AC 2, AC 3)
  - [x] 9.1 `es.ts` is the source of truth; `en.ts` is typed `Dictionary`, so a missing or extra key is a compile error (an *unused* key is not — mint only what the table below consumes). Register: tuteo, neutral LatAm, no exclamation marks.
  - [x] 9.2 New `viz.momentum.*` namespace beside `viz.shotMap` / `viz.crossMap` / `viz.passNetwork`:

    | key | render site |
    |---|---|
    | `figurePrefix` | `role="figure"` aria-label lead-in |
    | `metricNote` | the panel subtitle naming what the numbers are (decision 13) |
    | `axisMinute` / `axisEntries` | x and y axis labels |
    | `cursorLabel` | the slider's `aria-label` |
    | `minutePrefix` | `aria-valuetext` clock lead-in |
    | `entries` / `entriesOne` | the metric counter, both forms |
    | `goals` / `goalsOne` | figure summary + goal counter |
    | `minutes` / `minutesOne` | figure summary sample counter |
    | `goalPrefix` | goal-marker accessible name lead-in ("Gol de") |
    | `ownGoal` | spoken own-goal qualifier |
    | `penalty` | spoken penalty qualifier |
    | `tableCaption` | the data table's own stated order |
    | `tableGoal` | the table's goal column head |

  - [x] 9.3 Add `tactical.empty.momentumHeadline` = "La línea de momentum no está disponible para este partido." (EN variant alongside). This is UX-DR13's ruled copy — quote it exactly.
  - [x] 9.4 Reuse, do not re-mint: `viz.attribution`, `viz.viewData`, `viz.hideData`, `viz.table.minute`, `tactical.empty.explanation`, `tactical.sections.momentum.title`. **Do not reuse `viz.table.caption`** — its value is "Ordenado por minuto." which is a different claim from this table's order.
  - [x] 9.5 Every separator glyph (`·`, `—`, `′`, `+`, `, `, `. `) is a module const, never a bare JSX literal.
  - [x] 9.6 If you add an enum→key map, add its exhaustiveness assertion to `src/lib/i18n.test.ts` the way `SHOT_OUTCOMES` and `CROSS_DELIVERY_TYPES` are covered.

- [x] **Task 10 — Ledger, docs and disclosure** (no AC)
  - [x] 10.1 In `deferred-work.md`, mark the AD-14 slider note (`:260-272`, grep `"invalidated Story 2.6's slider AC"`) **resolved by Story 2.6**, quoting decision 1's ruling. Add a new entry recording that `EXPERIENCE.md:74` and `epics.md:737` still describe a minute-indexed slider and need a UX sign-off (decision 22).
  - [x] 10.2 Add a ledger entry for the momentum data table's 2.11 sortability plug-in point (decision 14), naming the exact files and symbols, in the shape of `deferred-work.md:292`.
  - [x] 10.2a File the structural dependency 2.18 will hit: both mockups render the heading as `<h2>Línea de <span class="gloss">momentum</span></h2>`, but `TacticalSection` takes `title` as a plain `string` and renders it as a text child. The glossary tooltip (`EXPERIENCE.md:259`) therefore needs that prop to accept a `ReactNode`, or a per-section term-marking hook. Deferring the tooltip is correct; **file the dependency so 2.18 does not meet it cold.** Same entry covers `review-i18n.md:62`'s `lang="en"` pronunciation spot-check on "momentum".
  - [x] 10.3 Add a ledger entry recording that `--shot-goal-canvas` was added, why the 2.7 deletion rationale is correct for the pitch but did not survive contact with a theme-aware canvas, and that the remaining four `--shot-*` hues still have no off-pitch consumer (decision 10) — so the next story neither re-deletes this token nor re-litigates the other four.
  - [x] 10.4 **Staging discipline.** Never `git add -A`. Stage exactly: `app/`, this story file, `deferred-work.md`, `sprint-status.yaml`. The latter two are shared artifacts also being written by the in-flight 1-9/1-13 sessions — if your commit carries any of their lines, **disclose it in the Completion Notes**. 2.7's review ruled that an undisclosed co-commit "is how a reviewer loses the ability to tell which story changed what".

- [x] **Task 11 — Verification** (all ACs). The harness has **no jsdom** (`vitest.config.ts`, `environment: "node"`), so nothing rendered can be unit-tested. Both defects 2.7's review found were structurally invisible to a 237-test suite. Adopt 2.7's and 2.8's mitigation proactively.
  - [x] 11.1 Run the shipped pure functions over both real series fixtures and record: row counts, peaks, goal-marker indices and fallback flags, zero-sample counts, and the min/max of every emitted number.
  - [x] 11.2 **Serving mechanics:** `next dev` cannot serve `/data/fixtures` — only `copy-data` populates it into `out/`. Verify against the built static export via `python -m http.server` on `app/out/`. `trailingSlash: true`, so the deep link is `/matches/{slug}/#momentum`.
  - [x] 11.3 **Keyboard contract, live.** Tab reaches the goal markers in clock order, then the slider (decision 20). On the slider: `→`/`←` move ±1 sample; `PageUp`/`PageDown` ±10; `Home`/`End` to the ends; **no wrap** at either end. Read `aria-valuenow` and `aria-valuetext` at index 0, at **m001 index 45** (minute `45+1` — the minute-45 run occupies indices 44-48: `45/null, 45+1, 45+2, 45+3, 45+4`), and at the last index — confirm the stoppage offset is announced and that indices 44-48 announce five *different* values.
  - [x] 11.4 **Tap-to-position.** A tap at three positions across the plot lands the cursor on the nearest sample. Then confirm a press-and-drag moves **nothing** — that is the ban, verified, not assumed. Then tap **on a goal marker** and confirm the cursor does **not** move (decision 26).
  - [x] 11.4a **`<md` presentation** (decision 27): at 390px and 320px the chart is full-width with the reduced height, **both teams still in one frame** (no team tabs), the cursor chip is legible, and the plot's pointer target is still ≥44px tall.
  - [x] 11.5 **Light theme.** Toggle and re-measure: both area strokes, both fills, the goal marker, the axis ink, and the "Ver los datos" control. **Record the measured ratios against decisions 9, 10 and 11's stated values.** Additionally measure the **midline's ink-over-fill** ratio in both themes (decision 25) — DESIGN.md's 15.8:1 describes ink over the bare card, a geometry that is not shipping, so that number must be replaced with a measured one rather than inherited. 2.6 is the first consumer of a goal token on a canvas surface — the same position from which 2.7's light-theme disaster became visible.
  - [x] 11.6 **`prefers-reduced-motion`.** With the media feature emulated on AND off, `document.querySelector("#momentum").getAnimations({subtree:true})` returns **0** both times (decision 5). **Run this only after the `next/dynamic` chunk has resolved** — before that the subtree is a skeleton, whose pulse is a CSS animation and would give a false positive. If it returns non-zero on the mounted chart, an `isAnimationActive` was missed.
  - [x] 11.6a **200% zoom.** Not covered by 2.8's verification and a standing gap, but momentum is the first full-width continuous viz where axis ticks can collide: at 200% confirm the ticks stay legible and unoverlapped, or reduce the tick count responsively.
  - [x] 11.7 **Reflow.** `scrollWidth === clientWidth` at **320** and **390** CSS px, and `#momentum` must not appear in the overflow sweep. Chrome will not resize below ~500px — use a same-origin 320/390px iframe, the technique 2.8 recorded. The known **195px** overflow is pre-existing and 2.19's — do not attempt it.
  - [x] 11.8 **The empty branch, live.** Load m002 (`momentum: null`): `#momentum` keeps its `<h2>` and anchor, shows the dashed panel with the **dedicated** sentence "La línea de momentum no está disponible para este partido.", never collapses, and requires no tap at any width.
  - [x] 11.9 **EN toggle after load.** Every visible label, every `aria-label`, the `aria-valuetext`, the table caption and column heads swap, and number formatting swaps with them. No mixed-language page.
  - [x] 11.10 **Static-output guards stay green** — `src/app/static-output.test.ts` and `src/app/matches/static-output.test.ts` (the AR-11 absence guard over all eleven section ids). If the latter goes red, something moved the Tactical Layer to the build-time path, the one change this story must not make.
  - [x] 11.11 **Bundle.** Record the recharts chunk size from the `next build` output and confirm it is a separate chunk, not in the main client bundle (decision 21).
  - [x] 11.12 Full chain green: `npm test`, then `npm run build`. Report the new suite total against the **307 / 15 files** baseline, and confirm zero console errors on all three fixtures.

## Dev Notes

### What already exists — reuse it, do not rebuild it

| Need | Where it already is | Note |
|---|---|---|
| Section registry, order, anchor | `lib/tactical-sections.ts:16-41` | momentum is #2; the anchor id IS the section id |
| Never-collapses ruling | `lib/tactical-sections.ts:48` | `ALWAYS_EXPANDED_SECTION_IDS` — no summary key, ever |
| Empty predicate | `lib/tactical-sections.ts:119-120` | `bundle.momentum !== null` — **already correct, do not touch** |
| Section shell, `<h2>`, anchor, `aria-labelledby` | `components/TacticalSection.tsx:92,139-163` | renders outside the empty/populated ternary, so the header survives absence for free |
| Content dispatch | `components/TacticalLayer.tsx:86-148` | built so 2.6–2.10 each replace exactly one line |
| Empty-state panel | `components/EmptyStatePanel.tsx:40-48` | props are already-resolved strings, deliberately outside the gated prop-name set |
| Generic empty headline | `components/EmptyStatePanel.tsx:60-64` | `useEmptyHeadline()` — keep as the default for the other ten |
| "Ver los datos" + attribution | `components/ViewDataDisclosure.tsx` | needs the canvas variant (decision 11); **do not re-add the caption** |
| Data-table shape | `components/PassNetworksSection.tsx` private `DataTable` | duplicated by current convention; substitute canvas ink |
| Singular/plural counters | `components/ShotMapsSection.tsx:127-136` | `countPhrase` — copy it, `t()` has no plurals |
| `45+2′` clock label | `lib/match-hero.ts:68-77` | `formatGoalMinute(at)` — **import it, do not re-implement** |
| `(minute, stoppageMinute)` ordering | `viz/marker-layout.ts:20-55` | `orderByMinute`; `MomentumSample` structurally satisfies its constraint |
| 44px hit floor | `viz/marker-layout.ts` | `MIN_HIT_PX = 44` — import, do not re-declare |
| Measured width | `lib/use-element-width.ts` | callback ref + guarded ResizeObserver |
| Breakpoints | `lib/use-media-query.ts:28-31` | `LG_MEDIA_QUERY` / `MD_MEDIA_QUERY` in **rem**; never a new px query |
| Focus ring | `globals.css:416-421` | global `:focus-visible`; **never `outline-none`** |
| Skeleton | `globals.css:354-374` | the `skeleton` utility, for the dynamic-import fallback |

### The data, measured — not assumed

Read directly from the fixtures at story-creation time, all three at `schemaVersion: 2`.

| fixture | momentum | samples | minute range | home min/max | away min/max | 0/0 samples | stoppage samples | duplicate minutes |
|---|---|---|---|---|---|---|---|---|
| `m001-mexico-south-africa` | series | **101** | 1–90 | 0 / **10** | 0 / **6** | 30 | 11 (max `90+7`) | **45×5, 90×8** |
| `m002-korea-republic-czechia` | **`null`** | — | — | — | — | — | — | — |
| `m074-germany-paraguay` | series (ET) | **138** | 1–120 | 0 / **17** | 0 / **9** | 23 | 18 (max `120+3`) | **45×7, 90×6, 105×5, 120×4** |

First and last samples, verbatim:

```json
m001[0]   {"at":{"minute":1,"stoppageMinute":null},"away":0,"home":1}
m001[100] {"at":{"minute":90,"stoppageMinute":7},"away":0,"home":0}
m074[0]   {"at":{"minute":1,"stoppageMinute":null},"away":0,"home":2}
m074[137] {"at":{"minute":120,"stoppageMinute":3},"away":0,"home":0}
```

**Traps in this data:**

- **Slot 0 is match minute 1**, not 0. Do not assume a zero-indexed clock.
- **`at.minute` is not unique.** This is decision 1's whole basis. See the table above.
- **Zeros are real.** 30 of m001's samples and 23 of m074's are `0/0`. The contract: "a minute in which neither team entered the final third carries 0/0, never a missing sample."
- **Both values are non-negative.** The up/down layout is presentation (decision 6), not sign.
- **Peaks are per-report, 9–21 corpus-wide.** Never hardcode a domain (decision 17).
- **m002's `null` never occurs in real data.** All 104 reports carry a band; the `null` is a deliberate synthetic edge case (`data/fixtures/README.md:34-40`) and **must not be regenerated**. Story 1.8 recorded the corollary: "Do not conclude from a clean run that the branch is dead code."
- **The series is not possession.** It is a per-minute count of final-third distributions. The contract forbids copy that implies otherwise (decision 13).
- **There is no printed total to reconcile against** — best exact-match rate 2/208 team-innings. Do not invent one (decision 15).
- **m074 is the honesty fixture**: a shootout match whose `metadata.goals` carries exactly 2 entries, one of them an own goal credited to the *benefiting* team. The nine shoot-out attempts appear nowhere.
- **`ownGoal: true` is synthetic, exactly like m002's `null`.** The schema `$comment` (`match-bundle.schema.json:196-198`): "PMSR prints no own-goal marking anywhere in the 104-report corpus (verified 2026-07-22). v1 therefore always emits false." m074's own goal exists to cover the edge shape. Build the branch; do not conclude from a clean run that it is dead code.
- **`penalty: true` occurs in no fixture at all**, and **no fixture has a goal in stoppage time** — so the `(minute, stoppageMinute)` composite key is only ever exercised on its `null` branch by real data. Both branches need constructed tests (Task 4.4a) or they ship unverified.
- **Goal counts, measured:** m001 → 2 (minutes 8 and 66, both `stoppageMinute: null`, both `ownGoal: false`); m074 → 2 (minute 5 own goal → `germany`; minute 41 → `paraguay`).

### Contract shapes (fixture-verified, quote-accurate)

```ts
type Momentum = MomentumSeries | null;              // bundle.momentum — required key, never omitted
interface MomentumSeries { samples: MomentumSamples }   // an OBJECT, not an array — note the indirection
type MomentumSamples = [MomentumSample, ...MomentumSample[]];   // @minItems 1 → samples[0] needs no guard
interface MomentumSample { at: MinuteStamp; home: number; away: number }   // home/away integer, minimum 0
interface MinuteStamp { minute: number; stoppageMinute: number | null }    // 0-120 / 1-30 | null
interface GoalRecord {                              // bundle.metadata.goals[] — the goal markers' source
  teamId: TeamId;                                   // the BENEFITING team, even for own goals
  scorerPlayerId: PlayerId;
  scorerName: string;
  at: MinuteStamp;                                  // same shape as MomentumSample.at → matches by key
  ownGoal: boolean;
  penalty: boolean;                                 // in-play penalty only; shoot-outs are never goals
}
```

`series.samples` is the easiest thing in this story to get wrong from prose alone: `bundle.momentum` is an object wrapping the array, not the array.

### recharts — the new dependency

Researched at story-creation (2026-07-27).

- **Latest stable: 3.10.1.** `peerDependencies.react` is `^16.8 || ^17 || ^18 || ^19` — React 19 is supported. `sideEffects: false`, `engines.node >= 18` (this app pins Node ≥24).
- **Weight: ~562 kB minified / ~147 kB gzipped**, plus 11 direct dependencies (`@reduxjs/toolkit`, `react-redux`, `immer`, `es-toolkit`, `victory-vendor` (d3-scale/d3-shape), `decimal.js-light`, `reselect`, `eventemitter3`, `tiny-invariant`, `use-sync-external-store`, `clsx`). This is larger than everything currently in the app's client bundle — hence decision 21.
- **`accessibilityLayer` defaults to `true`** in v3 and adds `role="application"`, a chart-container `tabIndex`, and an arrow-key `keydown` listener that moves the tooltip. Three collisions with this story's ruled semantics. **Set it `false`** (decision 4).
- **`isAnimationActive`**: v3 documents `"auto"` as respecting `prefers-reduced-motion`. We do not use it — decision 5 disables animation outright, because the app's global CSS motion kill cannot reach JS animation and an opaque `"auto"` is untestable here.
- **Open risk:** recharts issue #6857 reports blank charts under React 19.2.3, closed as "needs reproduction" rather than fixed. This app runs **React 19.2.8**. Task 2.2 is a render spike that must pass before any of the surface is built; the documented workaround is a `react-is` override matching the React version.
- **v3 removed** `recharts-scale` and `react-smooth`, dropped `CategoricalChartState`, removed `alwaysShow` on Reference components and `isFront` on reference elements, and replaced `<Cell>` with `shape`/`content` props. Do not follow v2-era examples.

### Token and contrast rulings, measured for this story

Method validated by reproducing the project's own published dark-theme figures before trusting the light-theme ones: computed **5.61 / 4.49** for the 60% team fills over `--surface-raised`, against `review-accessibility.md:11`'s stated 5.62 / 4.48. (Those two figures are in the accessibility review, **not** in DESIGN.md — DESIGN.md publishes 15.8:1 for the midline and 9.80:1 for the goal marker, both of which also reproduce.)

- **The light theme was never measured for this surface.** `review-accessibility.md:11` verified the fills in dark only. Light computes **2.40:1** (team A) and **2.54:1** (team B) against a 3:1 non-text floor — decision 9's boundary stroke is the fix, at 4.99 / 5.36 light and 13.56 dark.
- **`--shot-goal` on the light card computes 1.77:1**; the light value `#177245` computes **5.95:1**, matching DESIGN.md:288 exactly. It ships as `--shot-goal-canvas`, declared in both theme blocks — decision 10.
- **`ViewDataDisclosure`'s `text-ink-on-pitch` on the light card computes 1.10:1** — decision 11.
- **The midline must be `--ink-primary`, never `--viz-neutral`.** `review-accessibility.md:18` measured `--viz-neutral` over the composited team-A fill at **1.03:1**; DESIGN.md:288 folded the fix in (ink-primary on a reserved 2px gutter) and states 15.8:1 vs. the card.
- **The goal marker is team-neutral by design.** DESIGN.md:288: its emerald "is distinct from both team accents, so a goal marker can never read as 'Team A.'" The old hue collision (`review-accessibility.md:28`, where `shot-goal` was the same hex as `viz-team-a`) **was fixed** by re-hueing `--shot-goal` to `#3fdd85`; do not re-open it by colouring markers per scoring side.
- **On-pitch tokens are not yours.** Momentum is a card, not the pitch. Use `--viz-team-a/-b`, `--ink-primary/-secondary`, `--border-hairline`, `--ring`. Never `--ink-on-pitch`, `--viz-team-*-on-pitch`, `--focus-ring-on-pitch`, `--pitch-*`, `--edge-weight-*`. Mixing the two families is the exact defect the 2.7 review spent its headline finding on.

### i18n gate — six prior reviews paid for these

- Gated prop names, on any element including your own components: `aria-label, aria-description, aria-placeholder, aria-roledescription, aria-braillelabel, `**`aria-valuetext`**`, title, alt, placeholder, label, message, text, description, caption, heading, tooltip`. **`aria-valuetext` is gated — this story's slider is the first consumer.**
- A gated prop must receive an **identifier**, never a literal or template literal.
- `t()` has **no interpolation** — compose into a named variable first.
- `{t(cond ? "a" : "b")}` **fails**; hoist to `const key: DictionaryKey = cond ? "a" : "b"`.
- `react/jsx-no-literals` with `noStrings: true` — every separator glyph is a module const.
- `src/viz/**` is inside the client-import seam: a `t()` call there is a lint error. (`@/lib/format` is **not** restricted — see Task 3.1.)
- Put the components in `src/components/`, **never** colocated under `src/app/` — that path escapes the i18n seam (a known deferred gap at `deferred-work.md:135`, grep `"import bar does not cover"`; do not trigger it).
- The gate is regression-tested through the real config in `src/lib/eslint-gate.test.ts`. Adding a bypass fails CI.

> **The gate does NOT reach recharts, and this story is where that matters most.** The selectors match a `Literal`/`TemplateLiteral` that is a **direct child** of the `JSXExpressionContainer` (`eslint.config.mjs:44-46`), plus operands of binary/logical/conditional expressions. recharts delivers text through **object-shaped props**: `<YAxis label={{ value: "…" }} />` puts the literal inside an `ObjectExpression`, so it **passes the gate silently** — and `value` is not a gated prop name at all, so `<Label value="…" />` is uncaught too. Every other surface in this app delivers text as JSX children, where `react/jsx-no-literals` does the work; this one does not. **Every recharts text value must be a pre-resolved identifier by discipline, not by enforcement. Grep both new components for string literals before you commit.**

> **`role="slider"` will fail the build before it is finished.** `jsx-a11y/role-has-required-aria-props` errors on `role="slider"` without `aria-valuenow`, and `npm run lint` runs `--max-warnings 0` as the **first** link of the build chain. Wire `aria-valuenow`/`min`/`max` in the same edit that introduces the role, or the chain goes red on a half-built control.

### Scope boundaries

**Touch:** `app/src/viz/momentum-model.ts` + `.test.ts` (new), `app/src/components/MomentumChart.tsx` + `MomentumSection.tsx` (new), `app/src/components/TacticalLayer.tsx` (the one dispatch line + the empty-headline override), `app/src/components/ViewDataDisclosure.tsx` (additive surface variant), `app/src/app/globals.css` (one token + two comment amendments), `app/src/locales/{es,en}.ts`, `app/package.json` + `package-lock.json`, this story file, `deferred-work.md`, `sprint-status.yaml`.

**Do not touch:** `app/src/lib/tactical-sections.ts` (the momentum predicate is correct — decision 12), `app/src/components/TacticalSection.tsx`, `app/src/components/PitchPanel.tsx`, `app/src/viz/pitch-geometry.ts` / `marker-layout.ts` / `marker-model.ts` / `shot-map-model.ts` / `cross-map-model.ts` / `pass-network-model.ts`, `app/src/lib/contract/**` (generated), `contract/**`, `data/**`, `pipeline/**`.

**Do not build here:** sortable tables (2.11), the glossary tooltip on "momentum" (2.18), receiving/defensive maps (2.9), phases/pressing/set-plays/goalkeeping (2.10), any Expert-layer per-player table (2.11).

**Do not add:** jsdom, Testing Library, a state library, a client cache, a new React Context, `d3` or any d3 sub-package, or any runtime dependency other than recharts.

**Do not "fix":** m002's `momentum: null`; the 195px reflow overflow (2.19's); `pitchMarkings`' one-ended goal furniture (`deferred-work.md:298`); the `PitchMarker.minutePrefixKey` naming drift (`deferred-work.md:296`); `KeyStatisticsSection`'s inline duplicate of the disclosure pattern; the in-flight pipeline changes in the working tree.

### Known-open items that are NOT this story's

- **Crossing a breakpoint drops focus to `<body>`** (`deferred-work.md:213`) — needs a ruling this story does not have. It cannot hit `#momentum` anyway: momentum never collapses.
- **Hash re-entry has three unhandled paths** (`deferred-work.md:215`) — one policy, not three point fixes.
- **`<title>`/OG stay Spanish after an EN toggle** (`deferred-work.md:147`).
- **No-JS visitors sit on a permanent skeleton** (`deferred-work.md:149`).
- **`ShotLogRow.minute`'s `?? 0` defaulting** (`deferred-work.md:231`) — 2.11's call. Do not replicate the pattern (Task 3.5).
- **The `src/app/**` client-import seam hole** (`deferred-work.md:135`) — do not trigger it by colocating a component.

### Project Structure Notes

Naming follows the registry key: `momentum` → `MomentumSection.tsx`. The chart leaf is split out as `MomentumChart.tsx` solely so `next/dynamic` has a module boundary to code-split on (decision 21) — all locale and format resolution stays in the section, and the chart receives resolved strings.

`src/viz/**` is pure logic — no React, no DOM, no `t()`, no `@/lib/format`. It returns `DictionaryKey`s and raw numbers; components resolve them. That split is the only reason any of this is testable in a node-only harness. Push every decision that can be a function into `momentum-model.ts` and keep both components thin. Tests are co-located as `<module>.test.ts`.

The suite baseline is **307 passed / 15 files**. `npm test` is not part of `npm run build`; CI runs it separately.

### References

- `_bmad-output/planning-artifacts/epics.md:726-745` (Story 2.6 ACs), `:111` (UX-DR8), `:114` (UX-DR11), `:116` (UX-DR13), `:118` (UX-DR15), `:119` (UX-DR16), `:96` (AR-15 stack pins), `:67` (NFR-1), `:68` (NFR-2)
- `.../ux-designs/ux-wc-stats-2026-07-21/DESIGN.md:288` (the momentum palette spec), `:342` (the component entry), `:266` (two-team rule + direct series labels), `:280` (theme-aware canvases use `-light`), `:301` (tabular figures mandatory), `:324` (radius assignment)
- `.../EXPERIENCE.md:74` (the Momentum Timeline pattern row — **now stale on the slider**, decision 22), `:92` (the dedicated empty-state copy), `:105-107` (keyboard grammar + drag ban), `:113-119` (the accessibility floor), `:199,206,218` (placement + altitude), `:259` (the "momentum" i18n ruling)
- `.../review-accessibility.md:11` (dark-theme fill ratios), `:18` (midline), `:28` (the hue collision, since fixed), `:35` (the slider's origin), `:55` (mobile scrub)
- `.../architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md:68` (AD-4 series-or-null), `:74` (AD-5), `:104` (AD-10 state), `:110` (AD-11 static/runtime split), `:122` (AD-13 build chain), `:128` (AD-14 flow), `:163` (recharts 3.x), `:140` (data-table pairing)
- `contract/match-bundle.schema.json:31-35` (the `momentum` key), `:311-332` (`MomentumSample`), `:333-349` (`MomentumSeries`), `:84-94` (`MinuteStamp`), `:174-207` (`GoalRecord`), `:277-282` (`goals`)
- `app/src/lib/contract/contract-types.d.ts:826-851` (generated momentum types), `:818-824` (`MinuteStamp`), `:445-448` (`Goals`)
- `data/fixtures/README.md:34-40` (m002's deliberate `null`), `:102-116` (m074's own goal)
- `_bmad-output/implementation-artifacts/deferred-work.md:260-272` (the AD-14 slider note this story resolves), `:274-278` (no totals), `:292` (the plain-table precedent), `:231` (`?? 0` defaulting), `:213,215` (open focus/hash items), `:135` (the `src/app/**` seam hole). **These line numbers drift** — the file is a shared append-target and gained 12 lines between this story's baseline commit and its creation. Grep the quoted phrases if a number lands wrong.
- `_bmad-output/implementation-artifacts/1-8-momentum-series-extraction-oq-5-resolution.md:203-207` (m002 ruling), `:259-261` (zeros and two-colour slots), `:473` (the review ruling that routes the slider re-spec here)
- `_bmad-output/implementation-artifacts/2-5-tactical-layer-shell-key-statistics-empty-state-pattern.md:228,236-237` (empty-state rulings), `:256` (what 2.5 left to 2.6)
- `_bmad-output/implementation-artifacts/2-7-pitch-panel-infrastructure-with-shot-cross-maps.md:308` (no jsdom), `:356-361` (aria-hidden and figure-count rulings), `:274` (the light-theme finding)
- `_bmad-output/implementation-artifacts/2-8-pass-network-visualization.md:336-340` (the on-pitch token rule), `:342-350` (the i18n gate), `:245` (staging discipline), `:251-255` (the verification shape)
- Web research (2026-07-27): recharts 3.10.1 npm metadata (peer deps, size), the recharts 3.0 migration guide, recharts issue #6857 (React 19.2.3 blank charts, closed "needs reproduction"), and the recharts accessibility wiki (`accessibilityLayer` adds `role="application"` + arrow-key handling). **This story adds one dependency: recharts.**

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`, via the `bmad-dev-story` workflow.

### Debug Log References

Baseline (Task 1.1), reproduced exactly as the story states: `git log -1` = `c645cfe`;
`npm test` **307 passed / 15 files**; `check:types` "generated output is up to date (237
declarations from 6 schemas)"; `assert:schema-version` "7 artifact(s) at schemaVersion 2".

**Task 2.2 — the recharts render spike PASSED; issue #6857 does NOT reproduce.** A throwaway
`AreaChart` at `src/app/spike-recharts/page.tsx` (three hardcoded points, explicit 600x200
parent) was built and served from the static export under React **19.2.8** with recharts
**3.10.1**. It painted: two real geometry paths (`M65,145L330,65L595,125L595,165L330,165L65,165Z`
and the curve), eight axis tick labels, a 600x200 `<svg>`, zero console messages. **No `react-is`
override was needed or added.** The spike page was deleted immediately afterwards.

**Fixture facts re-derived independently before any code was written** (Task 11.1) — every number
in the story's Dev Notes table reproduced exactly: m001 101 samples / peak 10 / range 1-90 /
home max 10 / away max 6 / 30 zero-zero / 11 stoppage / minute 45x5, 90x8; m074 138 / 17 / 1-120 /
17 / 9 / 23 / 18 / 45x7, 90x6, 105x5, 120x4; m002 `momentum: null`. Goal indices resolved:
m001 minute 8 -> row 7, minute 66 -> row 69; m074 minute 5 (own goal, `germany`) -> row 4,
minute 41 -> row 40. First/last samples byte-identical to the story's quoted JSON.

**One story-text correction:** the scorer names in the committed fixtures are ASCII-normalised —
`Julian QUINONES` and `Raul JIMENEZ`, not the accented `Julián QUIÑONES` / `Raúl JIMÉNEZ` the
story's Task 4.4 quotes. The tests pin the fixtures' actual values.

**Browser-verification hazard, recorded for the reviewer:** Turbopack reuses chunk FILENAMES
across builds in this project, so Chrome serves a stale `/_next/static/chunks/*.js` after a
rebuild. One verification round produced a false negative because of it. **Every browser check
below was taken after a hard reload (Ctrl+Shift+R).**

### Completion Notes List

Story 2.6 implemented: the Momentum Timeline, the project's **first recharts surface**, the
first `next/dynamic` code-split, and the first `role="slider"` in the codebase. All 27 ruled
decisions implemented as written except the two departures declared below.

**One new runtime dependency: `recharts@3.10.1`** (latest stable at install, per
`ARCHITECTURE-SPINE.md:163`), `package-lock.json` committed. Confirmed the only new one — no
`d3`, no state library, no jsdom, no Testing Library. `npm audit` attributes **zero** of the
tree's 12 pre-existing high-severity advisories to recharts (all are `eslint` / `next` / `sharp`
chains present before this story).

**AD-14 RESOLVED — decision 1 shipped and is now regression-pinned.** The slider indexes SAMPLES:
`aria-valuemin=0`, `aria-valuemax=samples.length-1`, `aria-valuenow=index`, and `aria-valuetext`
carries the composed clock including the stoppage offset. Verified live: m001 max `100`, index 45
announces "Minuto 45+1′"; m074 max `137`, End announces "Minuto 120+3′". A dedicated test suite
("the index space — decision 1's teeth") asserts `at.minute` is NOT injective on either fixture
while row indices ARE unique and contiguous — it fails if anyone re-indexes by minute.

**Keyboard contract verified with REAL key presses, not synthetic dispatch** (Task 11.3): 100
ArrowRight from index 0 land on exactly 100; 60 ArrowLeft back land on exactly 40 — **zero
presses dropped**. PageUp/PageDown move exactly +/-10 (5x PageDown from 137 -> 87) and clamp at 0.
Home/End reach both ends. **No wrap at either end**, confirmed at both. Tab order is exactly
decision 20, read out of the live DOM: goal marker (minute 8) -> goal marker (minute 66) ->
`role="slider"` -> "Ver los datos". No positive `tabIndex` anywhere.

**Decision 26 proven, not assumed** (Task 11.4). The goal marker's invisible hit target measures
exactly 44x44 px. A pointer-down at the hit box's EDGE — a pixel where tap-to-position would
compute index **12** — lands the cursor on the marker's own index **7**, so `stopPropagation`
demonstrably wins. **The drag ban is verified, not asserted**: a `pointerdown` at index 2 followed
by three `pointermove`s across the plot and a `pointerup` at the far right leaves the cursor on
index 2. Tap-to-position itself is exact: plot-left -> 0, mid -> 50, plot-right -> 100.

**Light theme re-measured live in the browser; every predicted figure reproduced exactly.**
Method validated first by reproducing the project's own published dark numbers: 60% team fills
**5.62 / 4.48** against `review-accessibility.md:11`'s stated 5.62 / 4.48, and the goal marker at
**9.80:1** against DESIGN.md's published 9.80.

| element | dark | light | floor |
|---|---|---|---|
| Team A fill 60% vs card | 5.62 | **2.41** | 3:1 ❌ light — why the stroke exists |
| Team B fill 60% vs card | 4.48 | **2.53** | 3:1 ❌ light |
| Team A stroke (full opacity) | 13.56 | 4.99 | ✅ both |
| Team B stroke (full opacity, dashed) | 10.30 | 5.36 | ✅ both |
| Goal marker, `--shot-goal-canvas` | 9.80 | **5.95** | ✅ both |
| Goal marker if `--shot-goal` had been used | 9.80 | **1.77** | ❌ — the defect avoided |
| Axis tick ink `--ink-secondary` | 7.87 | 7.61 | ✅ both |
| "Ver los datos", `surface="canvas"` | 15.81 | **17.67** | ✅ (was **1.10** on-pitch) |
| Midline ink over composited fill A | **2.81** | 7.32 | **❌ dark — see departure 2** |
| Midline ink over composited fill B | 3.53 | 6.97 | ✅ both |
| Midline ink vs bare card (DESIGN.md's 15.8, NOT the shipped geometry) | 15.81 | 17.67 | — |

**`<md` presentation (decision 27) measured at 390 and 320 CSS px** via same-origin iframes:
full width, plot height **122 px** (clears decision 19's 44 px pointer floor), **both teams in one
frame — no team tabs**, chip legible, x ticks thinned to 30-minute steps. **Zero tick-label
overlaps at 1280 / 640 / 390 / 320 px** (minimum gap 19 px at 320), which discharges Task 11.6a's
200%-zoom concern.

**Reflow (Task 11.7):** at 390 px `scrollWidth === clientWidth === 375`, no overflow at all. At
320 px there IS a 326-vs-305 overflow, and it is **proven pre-existing rather than assumed**:
m002, which carries `momentum: null` and renders no chart whatsoever, overflows to the identical
326 px with the identical Key Statistics tile as the offender. **`#momentum` never appears in the
overflow sweep at any width.**

**Animation (Task 11.6):** `document.querySelector("#momentum").getAnimations({subtree:true})`
returns **0** on the fully-mounted chart (`.recharts-wrapper` present, no skeleton). Run with
`prefers-reduced-motion` OFF, which is the STRICTLY HARDER case — reduced motion can only ever
remove animations, and `isAnimationActive={false}` is unconditional in the code, so the ON case
is 0 by construction.

**Empty branch (Task 11.8), live on m002:** `#momentum` keeps its `<h2>` and anchor, never
collapses (no disclosure button), shows the dashed panel, and carries the **dedicated** sentence —
asserted byte-equal to UX-DR13's ruled copy, "La línea de momentum no está disponible para este
partido." The other ten sections still compose the generic headline through the unforked
`useEmptyHeadline()`.

**EN toggle after load (Task 11.9):** every visible label, the figure `aria-label`, the slider
label, `aria-valuetext`, both marker names, the disclosure name, the table caption and all four
column heads swap. No mixed-language page. (The `<title>` staying Spanish is the known deferred
item at `deferred-work.md:147`, not this story's.)

**m074 is the honesty fixture and passes:** exactly **2** goal markers on a match decided on
penalties — none of the nine shoot-out conversions appears anywhere — and the own goal announces
"Gol de Gustavo GOMEZ, Minuto 5′ (en propia puerta)." credited to **germany**, the benefiting
team. Figure summary reads "138 minutos · 2 goles", counted from the marks drawn, never from
`keyStatistics`.

**Data table:** 101 rows (m001) / 138 (m074), **no negative number anywhere**, asserted both in
the suite and by regex over the live DOM. Nothing is summed, averaged or totalled (decision 15).

**Bundle (Task 11.11):** recharts lands in its own chunk — **337 kB raw / 99 kB gzipped**,
containing recharts and `MomentumChart` and nothing else. It is **absent from `/` and `/about`**.
**Disclosed limitation:** on match routes Next's static export emits it as an eager
`<script async>` rather than deferring the fetch until the Tactical layer mounts, so
`next/dynamic` buys route-level isolation (the Hero and Key Statistics are never blocked — `async`
does not block parsing or paint) but not on-demand loading, and m002 downloads it despite having
no chart. Decision 21's stated goal ("never blocks the Hero, key-stats, or the rest of the
Tactical layer") is met; "lands only when needed" is not. Worth a look in a bundle-budget story.

**Zero console messages on all three fixtures.**

#### Declared departures (2)

**1 — Activating a goal marker MOVES the cursor to that goal's sample.** Decision 26's sentence
reads "goal-marker handlers call `event.stopPropagation()` so activating a marker does not also
move the cursor". Shipped: the marker calls `stopPropagation()` (proven above — the edge-tap test)
AND sets the cursor to its own row index. **Reason:** decision 24 rules the marker to be
`role="button" tabIndex={0}`, and a control announced as a button that does nothing on
Enter/Space is an accessibility defect in its own right. Read in context — the decision is titled
"Pointer precedence: goal markers win over tap-to-position" — the prohibition is on the plot's
tap-to-position ALSO firing at that pixel, which is exactly what `stopPropagation` prevents;
jumping the scrub to the goal is the marker's own handler winning, not tap-to-position leaking
through. If the reviewer prefers the literal reading, the fix is one line (drop `onActivate`) plus
a role change from `button` to a non-interactive focusable.

**2 — The midline ships at 2.81:1 over team A's fill in the dark theme, below the 3:1 floor, and
is FILED rather than fixed.** Decision 25 commissioned this measurement precisely to replace
DESIGN.md's inherited 15.8:1 (which describes ink over the bare card — the reserved-gutter
geometry that is not shipping, and which reproduced at 15.81 exactly). The real shipped number
fails. **It is not fixable inside this story:** `--ink-primary` is already the lightest ink in the
dark theme, and substituting pure `#ffffff` reaches only **3.06:1**; clearing the floor requires
either lowering the ruled 60% fill opacity — decision 9 explicitly forbids re-opening that settled
UX number — or minting a dedicated midline token. A card-coloured backing band was evaluated and
**rejected on measurement**: at m074's peak of 17 on a 122 px `<md` plot one unit is 2.5 px, so
even a 4 px gutter would erase a 1-entry minute entirely — the data lie decision 16 exists to
prevent. Light theme passes comfortably (7.32 / 6.97). Filed to the ledger for UX/DESIGN.md with
the full measurement set. The same 2.81:1 applies to the goal marker's ink ring where it crosses
team A's fill.

#### Two defects found by verification and fixed in-story

**(a) recharts' automatic y-ticks are non-uniform and omit zero.** On m074 (peak 17, domain
`[-17, 17]`) recharts emitted `+17, +1, -8, -17` — four ticks, unevenly spaced, **with no zero
tick**, on the one chart whose entire encoding is above-or-below zero. Because decision 6 strips
the sign, they rendered as an unreadable `17 1 8 17`. m001 (peak 10) came out clean as
`10 5 0 5 10`, which is exactly how this would have shipped unnoticed by a green suite. Fixed
with an explicit `ticks` prop from a new pure `momentumYTicks(peak)` — symmetric, integer, always
includes 0 — pinned by a property test over peaks 1-40 plus both fixture literals. Now renders
`10 0 10` on m074. **Filed to the ledger**, because stories 2.10 / 2.13 / 2.15 / 2.16 all carry
recharts charts and will meet the same default.

**(b) `awayPlotted` was negative zero on every 0/0 sample.** A bare `-away` yields `-0` for
`away === 0`, and 30 of m001's samples and 23 of m074's are exactly that. It plots identically but
formats as `"-0"` the instant it reaches a formatter — the precise "a negative number anywhere a
reader can see it is a defect" rule decision 6 exists to enforce. Caught by the first test run;
normalised in the model and pinned with an `Object.is(-0)` assertion.

#### Robustness change worth a reviewer's eye

The chart's `onIndexChange` accepts a **functional updater**, and the key handler always uses it,
so a held-down arrow key cannot drop presses to React batching. This was prompted by a synthetic
same-tick burst of 44 dispatches advancing only 8 steps — **which I then established is a
measurement artifact, not a defect**: real key repeat is one press per frame and loses nothing
(100 real presses -> exactly 100, before and after the change). The change is kept because it is
strictly more correct, not because a real failure was reproduced.

#### Scope discipline

Touched `app/` + the two locale files + `globals.css` + this story file + the ledger + sprint
status, exactly as the story's Scope Boundaries allow. `tactical-sections.ts` untouched (the
momentum predicate was already correct); `TacticalSection.tsx`, `PitchPanel.tsx`, `marker-*.ts`,
`shot-map-model.ts`, `cross-map-model.ts`, `pass-network-model.ts`, `src/lib/contract/**`,
`contract/`, `data/`, `pipeline/` all untouched. `ViewDataDisclosure` changed **additively** — the
new `surface` prop defaults to `"pitch"`, so `PitchPanel.tsx:1190`, its one existing call site,
renders byte-identically. `KeyStatisticsSection`'s inline duplicate of the disclosure pattern was
deliberately NOT reconciled. `EXPERIENCE.md` and `epics.md` were NOT edited (decision 22); their
staleness is filed for UX sign-off.

**STAGING / CO-COMMIT DISCLOSURE.** The working tree is shared with in-flight stories 1-9, 1-13
and 2-8, which have `PitchPanel.tsx`, `TacticalLayer.tsx`, `marker-model.ts`, both locale files,
`PassNetworksSection.tsx`, `pass-network-model.ts{,.test.ts}` and both shared artifacts dirty.
Nothing was reverted, staged or "fixed" on their behalf, and `git add -A` was never used. My edits
to the two shared artifacts (`deferred-work.md`, `sprint-status.yaml`) are **append-only**; my
edits to `TacticalLayer.tsx` and the locale files are additive and confined to the momentum
dispatch case, the empty-headline override, and the new `viz.momentum.*` /
`tactical.empty.momentumHeadline` keys.

#### Suite

**307 passed / 15 files -> 358 passed / 16 files** (+51 tests, 44 of them in the new
`momentum-model.test.ts`; the remainder are pre-existing suites picking up the shared tree).
`npm run lint`, `npm run typecheck`, `npm run assert:schema-version`, `next build` and
`copy-data` all green. Both static-output guards green, including the AR-11 absence guard over
all eleven section ids.

### File List

**New**
- `app/src/viz/momentum-model.ts`
- `app/src/viz/momentum-model.test.ts`
- `app/src/components/MomentumChart.tsx`
- `app/src/components/MomentumSection.tsx`

**Modified**
- `app/src/components/TacticalLayer.tsx` (momentum dispatch case + the per-section empty-headline override)
- `app/src/components/ViewDataDisclosure.tsx` (additive `surface` prop, defaulting to `"pitch"`)
- `app/src/app/globals.css` (`--shot-goal-canvas` in both theme blocks, `--color-shot-goal-canvas`, two comment-block scope corrections)
- `app/src/locales/es.ts` (`viz.momentum.*`, `tactical.empty.momentumHeadline`)
- `app/src/locales/en.ts` (the typed mirror of both)
- `app/package.json`, `app/package-lock.json` (recharts 3.10.1)
- `_bmad-output/implementation-artifacts/2-6-momentum-timeline.md` (this file)
- `_bmad-output/implementation-artifacts/deferred-work.md` (AD-14 slider note resolved + 5 new entries)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Created then deleted** — `app/src/app/spike-recharts/page.tsx` (the Task 2.2 render spike).

## Change Log

| Date | Change |
|---|---|
| 2026-07-27 | Story created. Prerequisite verified at creation: `check:types` up to date (237 declarations / 6 schemas) and `assert:schema-version` green (7 artifacts at schemaVersion 2) against baseline `c645cfe`; suite baseline 307 passed / 15 files. |
| 2026-07-27 | Validation pass, two fresh-context agents. Five CRITICAL and nine MINOR findings applied. Headline fixes: the `--shot-goal-light` token mechanism was **unimplementable** (no `-light`-suffixed property exists in this codebase; one declared only in `.light` is undefined in the dark theme) and is replaced by `--shot-goal-canvas` declared in both blocks (decision 10, 10a); the `<md` presentation and the chart height were **entirely absent** and are now decision 27; the `[-peak, peak]` domain would have rendered negative y-ticks (decision 6); chart-overlay positioning had **no mechanism** and is now recharts-native (decision 24); the reserved gutter is **not expressible in recharts** and ships as a declared, re-measured deviation (decision 25); the cursor chip now carries the values so sighted users are not left with a bare minute, and no `<Tooltip>` ships (decision 23); pointer precedence between markers and tap-to-position is ruled (decision 26). Corrected: all twelve `deferred-work.md` citations (+12 line drift), both `2-8` citations, the `@/lib/format` lint claim (**not** enforced), `ViewDataDisclosure`'s call-site count (one, not two), the series-label end (left, per the mockup), the Team-B dark composite hex, the 5.62/4.48 attribution, and four other line references. Decision count 22 → 27. All fixture data and all ten contrast ratios independently reproduced and confirmed exact. |
| 2026-07-27 | Story implemented and moved to review. recharts 3.10.1 installed (the project's first chart library) and its render spike PASSED under React 19.2.8 — issue #6857 does not reproduce and no `react-is` override was needed. All 27 ruled decisions implemented, with 2 declared departures (marker activation moves the cursor; the dark-theme midline ships at 2.81:1 and is filed for a UX palette ruling rather than fixed in-story). Two defects found by verification and fixed: recharts' automatic y-ticks are non-uniform and omit zero on an un-nice domain (m074 rendered an unreadable "17 1 8 17"), now explicit symmetric ticks from a tested `momentumYTicks`; and `awayPlotted` was negative zero on the 53 corpus 0/0 samples. All ten contrast ratios re-measured live in both themes, reproducing every published figure exactly (fills 5.62/4.48 dark, 2.41/2.53 light; goal marker 5.95 via the new canvas token vs 1.77 with the pitch token; the disclosure 17.67 vs 1.10 before the surface variant). Keyboard, drag ban and pointer precedence verified with real input, not assumed. Suite 307/15 -> 358/16; full build chain green; zero console messages on all three fixtures. |

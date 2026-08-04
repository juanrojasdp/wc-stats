---
baseline_commit: 325dc2b
---

# Story 2.10: Phases, Pressing & Blocks, Set Plays & Goalkeeping Sections

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Diego,
I want the remaining tactical sections — phases of play, pressing & defensive blocks, set plays, and goalkeeping,
So that the Tactical Layer covers every domain the PMSR offers (FR-22).

> **This story CLOSES the Tactical Layer.** These are the last four `PendingSectionPanel`
> fall-throughs in `TacticalLayer.tsx`; after 2.10 all eleven sections render real content and
> `PendingSectionPanel` has zero call sites.
>
> **The epic's `#goalkeeping` AC is overturned on corpus-wide evidence and re-scoped in-story**
> (ruled decision 2, ruled by Juan at story creation). The 1.9 / 1.13 / 2.9 in-story re-scope
> precedent applies: `epics.md` is **not edited**; the ACs below are reproduced verbatim with
> BINDING reconciliations, and the divergence travels to downstream owners through
> `deferred-work.md`.

## Acceptance Criteria

The epic's ACs (`epics.md:823-835`) are reproduced **verbatim**, each followed by the **BINDING**
reconciliation the story-creation probe forced. Read both.

**AC 1 — Domain C**

**Given** Domain C data
**When** `#phases` and `#pressing` render
**Then** comparative recharts distributions show phases of play, line heights/team length (meters), and defensive-block distribution with team accents, direct series labels, and dashed/pattern Team B encoding — never hue-only (UX-DR11)
**And** exact percentages and values are reachable via each chart's data table.

> **BINDING.** Satisfied as written, with the split ruled by Juan (decision 4):
> **`#phases`** renders the Phases of Play page verbatim — the 8 `phasesInPossession` + 9
> `phasesOutOfPossession` percentages, comparative, both teams, as two recharts distributions.
> **`#pressing`** renders the four press rates **and** `defensiveBlockDistribution` (3), each as
> its own concept, plus `lineHeight` / `teamLength` (4 metre values per team). Seven of the nine
> out-of-possession rates therefore appear in both sections — deliberately, so that `#pressing`'s
> shipped and frozen copy (*"…e intensidad de la presión."*) is true. The duplication rides
> `match-bundle.schema.json`'s `DefensiveBlockDistribution` `$comment`, which sanctions the pattern
> by name: *"They are surfaced again here because Story 2.10's `#pressing` section renders block
> height as its own concept."*
> **These are NOT partitions.** Measured over 208 team-innings: in-possession sums run
> **84–149** (median 107, equal to 100 on 5); out-of-possession **73–97** (median 87.5, equal to
> 100 on **0**). Nothing may normalize them, stack them, or draw them as slices of a whole
> (`contract/README.md` §5; `InPossessionPhase`'s own **`description`** — it has no `$comment`, so
> do not grep for one).
> **The metres are the one part of Domain C with no real counterpart** — see decision 5. They
> render (Juan's ruling), no aggregation is invented, and the gap is filed to 1.16.

**AC 2 — Domain F**

**Given** Domain F data
**When** `#set-plays` renders
**Then** counts by type, side, and style display per team with locale-mapped category labels from enum codes (AR-7).

> **BINDING.** Satisfied, with two of the four breakdowns barred from any part-of-whole
> treatment (decision 6, ruled by Juan on measured evidence over 208 team-innings):
> `direct == directOnTarget + directOffTarget` — the relation the contract's `FreeKickCounts`
> `description` asserts *"holds across all six fixture team-innings"* — is **FALSE on 208/208**;
> corner delivery **STYLE** sums to `totalCorners` on only **96/208** (112 under, never over).
> Corner delivery **TYPE** (208/208), corner **SIDE** (208/208) and
> `totalSetPlays == freeKicks + corners + throwIns + penalties` (208/208) are corpus-true and may
> be presented as parts of their whole.

**AC 3 — Domain E**

**Given** Domain E data
**When** `#goalkeeping` renders
**Then** each goalkeeper's involvement, distribution, goal prevention, and aerial control summary displays with the LatAm register labels (arquero, atajada) from the locale files (UX-DR19)
**And** all four sections show the ruled empty state when their data is absent (FR-22).

> **BINDING — the "each goalkeeper's" clause is OVERTURNED, and the overturn is larger than
> `deferred-work.md`'s AD-14 (d) notice recorded.** Ruled by Juan at story creation (decision 2).
>
> **(a) The source is PER TEAM, not per goalkeeper.** Story 1.9 verified over 104 reports /
> 936 goalkeeping pages: all four page families are titled `{team}`, **no goalkeeper name appears
> on any of them**, and **7 of 208 team-innings used two keepers** while still printing one
> team-level block each. `#goalkeeping` therefore renders **one block per team**, with the
> goalkeeper name(s) carried as **context**, not as the keying identity.
>
> **(b) FIVE contract-required sub-blocks are `null` on 208/208 team-innings** — measured at
> story creation directly over the staged records, and NOT recorded in the AD-14 (d) notice:
> `distribution.feetTechniques`, `distribution.handsTechniques`, `distribution.throwTechniques`,
> `goalPrevention.byBodyType`, `aerialControl.crossesFacedCompleted`. They are raster donut-slice
> labels and an unvalidatable marker colour (Story 1.9, AD-14 (c)). **The fixtures populate all
> five**, because `data/fixtures/README.md` lists *"Domain E goalkeeping"* under **"Synthetic,
> deterministic, plausible"** *"in full, though the attempts faced and goals conceded are real"*.
>
> **(c) AC 3 is satisfied, not waived, re-expressed as:** all four summaries render per team;
> every panel whose data can never populate is behind a **presence gate** (decision 3) — the
> shipped FD-1 `showXg` / 2.9 `anyContestType` precedent — so the surface shows everything the
> fixtures carry today and degrades to the corpus-real field set at the 2.19 cutover with **no
> code change and no permanently-empty panel**.
>
> **BINDING on the empty-state clause.** `sectionDataState` already answers all four ids
> correctly and **this story changes it in no way** (see "What already exists"). `tacticalIdentity`
> and `setPlays` are **required, non-nullable** objects, so their empty branch is unreachable at
> contract v2 except through a truncated `as`-cast payload — which is exactly what the existing
> predicate exists to catch. `goalkeeping` is genuinely nullable and its empty state is live.
> The deliverable here is **assertions**, not new mechanism: pin all four branches in
> `tactical-sections.test.ts`. `goalkeeping: []` is **`ready`**, never empty — the schema says so
> verbatim (*"An empty array means the pages were present and listed no goalkeeper; null means
> there was nothing to read. The App renders those two states differently, so they must never be
> collapsed."*) — so the component owns a zero-content view.

## Ruled Decisions

These are decided. Do not re-litigate them mid-implementation; if evidence contradicts one,
record a departure in the Dev Agent Record with the reason, exactly as 2.6, 2.7, 2.8 and 2.9 did.

**1 — Scope: re-scope IN-STORY, on the 1.9 / 1.13 / 2.9 precedent. Ruled by Juan, 2026-08-03.**
`epics.md` is **not edited**. The ACs above are reproduced verbatim with BINDING reconciliations;
the divergence travels to downstream owners through `deferred-work.md` (Task 9).
**THIS STORY IS `app/` ONLY.** `pipeline/**`, `contract/**` and `data/**` are read-only.

**2 — `#goalkeeping` is TEAM-GROUPED, with the keeper list as context. Ruled by Juan.**
Group `bundle.goalkeeping` by `teamId` and render **one block per team**, in
`metadata.homeTeam` / `awayTeam` order (never array order). Each block's context label names the
keeper(s) who appear for that team.
**The two-keeper case is real and must be handled:** 7 of 208 team-innings (M21 home, M41 away,
M53 away, M62 away, M66 home, M88 home, M98 away). When a team has two records the block shows
**both keeper names** in the context label and renders **both records' panels, stacked and each
labelled by its keeper — never summed** (AD-5 forbids the App summing, and summing two keepers'
save percentages would be arithmetic nonsense). No fixture carries this shape; Task 5.8 requires a
constructed input.
*Rejected alternative:* one card per `GoalkeeperRecord` (contract-literal). It ships a surface
already proven dead — the 2.8 mistake made knowingly.
*Rejected alternative:* omit the five never-populatable panels outright. It is the strictest
reading of 2.9's decision 5, but it drops part of AC 3 on the data the App actually has today.

**3 — The five corpus-null fields are PRESENCE-GATED, not assumed. Ruled by Juan.**
A panel renders **only when its data is non-null**; when absent it is **omitted entirely**, never
rendered as a row of em dashes. Gate these five, each measured `null` on 208/208:

| Field | Panel it gates |
|---|---|
| `distribution.feetTechniques` | Kick-from-feet technique breakdown (6 values) |
| `distribution.handsTechniques` | Kick-from-hands technique breakdown (3 values) |
| `distribution.throwTechniques` | Throw technique breakdown (4 values) |
| `goalPrevention.byBodyType` | Intervention-by-body-part breakdown (5 values) |
| `aerialControl.crossesFacedCompleted` | The completed half of the crosses-faced pair |

**A closed gate must SAY SO — silent absence is the one thing FR-22 forbids.** The two precedents
cited above (`showXg`, `anyContestType`) hide a **column inside a table**, costing a reader one
field. This decision hides **five whole panels**, all five populated on 6/6 fixture keepers — so
the section the dev builds and the reviewer reviews is **not the section that ships** at the 2.19
cutover, and nothing on screen would explain the difference. That is silent absence at panel
granularity, against a project whose own failure-path doctrine is *"explicit empty state names
what's absent, so he trusts the rest."*
**RULED:** when **any** gate is closed, the goalkeeping block renders **one** ruled sentence, once,
naming why — the evidence is already written in the ledger (AD-14 (c): all five are raster
donut-slice labels or an unvalidatable marker colour). Mint it in both locales in Task 8.4. This is
neither five rows of em dashes (rightly banned) nor silence.
**Two consequences to handle explicitly, not by accident:**
- `crossesFacedAttempted` renders **alone** once its counterpart is gated. Give it its own label
  for that state — a value labelled as the *attempted half of a pair* with no counterpart reads as
  a **missing** number rather than an **absent** one.
- Decision 13 goes **vacuous** on real data: only the intervention-type breakdown survives, leaving
  `goalPrevention.totalInterventions` as a headline with no breakdown behind it. That is decision
  13's "implying a shared total" risk inverted, and the ruled sentence above is what covers it.

**These fields are declared NON-nullable in the generated types**, so a bare `x != null` will not
type-check cleanly. Do it once, explicitly, in the model, and cast the record **once** at the
model's entry point, with a comment carrying the 208/208 evidence and naming the successor
change-set. **Do not scatter casts through the components.**

**The five fields do NOT sit on `GoalkeeperRecord`** — they sit on three nested interfaces
(`GoalkeeperDistribution`, `GoalPrevention`, `AerialControl`), so the view is three widened types
composed into one. A flat interface cannot express it:

```ts
type Widen<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

interface CorpusNullableGoalkeeperRecord
  extends Omit<GoalkeeperRecord, "distribution" | "goalPrevention" | "aerialControl"> {
  distribution: Widen<GoalkeeperDistribution, "feetTechniques" | "handsTechniques" | "throwTechniques">;
  goalPrevention: Widen<GoalPrevention, "byBodyType">;
  aerialControl: Widen<AerialControl, "crossesFacedCompleted">;
}
```

`GoalkeeperRecord` is assignable to this (it only widens), so a plain `as` suffices — **no
`as unknown` double cast**. Bundles reach the App as `as`-cast unvalidated JSON, so the widened
view is the truthful one; this is the same legitimacy 2.9's Task 3.7 established.

**4 — The Domain C split: `#phases` = all 17, `#pressing` = press rates + blocks + metres.
Ruled by Juan.**
`#phases` renders `phasesInPossession` (8) and `phasesOutOfPossession` (9) — the Phases of Play
page verbatim, both teams, as two charts.
`#pressing` renders the **four press rates** (`highPress`, `midPress`, `lowPress`, `counterPress`)
**plus** `defensiveBlockDistribution` (3) **plus** `lineHeight` and `teamLength`.

**Why `#pressing` duplicates seven values rather than three.** The first draft gave `#pressing`
only the blocks and the metres — and that ships a section whose **shipped, frozen copy is false**.
`tactical.sections.pressing` reads *"Presión y bloques defensivos"* / *"Altura de la línea
defensiva e **intensidad de la presión**."* (en: *"Defensive line height and **pressing
intensity**."*), while all four press rates would have sat in `#phases`. The source keeps
`high-press` and `high-block` as **separate enum values**, so no reading collapses them. That
summary is also the **collapsed-shell copy at `<lg`** (`key-match-dashboard-mobile.html:350-353`),
so a phone reader hunting press intensity opens `#pressing`, finds line height and block shares,
and never opens `#phases`.
The duplication is defended by exactly the argument the contract already makes for the blocks —
`DefensiveBlockDistribution`'s `$comment`: *"They are surfaced again here because Story 2.10's
`#pressing` section renders block height as its own concept."* Pressing intensity is its own
concept on the same footing.
*Rejected alternative:* split the nine out-of-possession rates on a press/block boundary. It gives
`#pressing` a tidier identity but cuts one source page in two on a line the page does not draw.
*Rejected alternative:* re-mint the `#pressing` summary (and/or title) to match a blocks-only
section. It is the cheapest fix, but the title would still say *"Presión y…"* over content with no
press rates in it, and re-minting a section title that UX ruled by name in the terminology table
and that the mobile mockup renders verbatim is a UX call, not a dev one.

**5 — `lineHeight` / `teamLength` RENDER, and their provenance gap is FILED. Ruled by Juan.**
These four numbers per team are the **only** part of Domain C with no real counterpart, and this is
measured, not inferred:
- The 8 + 9 phases and `defensiveBlockDistribution` are **REAL** — every fixture value matches the
  staged record exactly, and `data/fixtures/README.md` lists *"All of Domain C phase percentages"*
  under **"Real, from the source reports"**.
- The metres are **not** in that list. The corpus prints **three panels per possession state with
  three measures each** (in possession: `build-up-low` / `build-up-mid` / `final-third-phase`;
  out of possession: `high-block-press` / `low-block` / `mid-block`), including **`team_width`,
  which the contract does not model at all**. `m001` home in-possession staged
  `line_height` is 19 / 39 / 54 against the fixture's single `44.4` — **it matches no panel and no
  mean of them.** Corpus ranges: `line_height` 10–71 m, `team_length` 13–51 m, `team_width` 28–60 m.
- Owner of the aggregation rule is **Story 1.16** (`deferred-work.md`, grep
  `"the line-height/team-length pages are per-phase panels"`).

**RULED: render the four contracted values exactly as the contract names them.** They are
`required`, non-nullable, and the App's job is to render what the bundle carries. **Invent no
aggregation, add no third measure, and write no copy claiming which phase they describe.** File the
gap to 1.16 (Task 9.2).
*Rejected alternative:* omit them until 1.16 rules. It drops a named clause of AC 1 and leaves a
required contracted field unrendered.

**6 — Set plays: the two false partitions are BARRED; the three true ones are used. Ruled by Juan.**
Measured over 208 team-innings at story creation:

| Relation | Corpus | Fixtures |
|---|---|---|
| `direct == directOnTarget + directOffTarget` | **0 / 208** (160 have `on+off == 0` while `direct > 0`) | 3/3 true |
| `direct + indirect == totalFreeKicks` | **208 / 208** | true |
| `sum(cornersByDeliveryStyle) == totalCorners` | **96 / 208** (112 under, 0 over) | 3/3 true |
| `sum(cornersByDeliveryType[*].total) == totalCorners` | **208 / 208** | true |
| `left + right == total`, per type and overall | **208 / 208** | true |
| `totalSetPlays == freeKicks + corners + throwIns + penalties` | **208 / 208** | true |

**The fixtures agree with the contract and disagree with the corpus by construction** —
`data/fixtures/README.md` lists *"Free-kick / corner breakdowns"* under Synthetic: *"the totals are
real; the splits beneath them are synthesised so that they add up to those totals."* A surface
validated only against fixtures ships a chart that is wrong on every real report.

**RULED:**
- The **four free-kick values render as four FLAT SIBLING rows.** No stack, no segmented bar, no
  part-of-whole geometry, **and no indentation or other containment cue** — indentation is the most
  conventional visual assertion of containment there is, and it would smuggle back exactly the
  claim this decision bans. On **160/208** team-innings the surface would otherwise read
  *"Tiro libre directo 7 / ⤷ Al arco 0 / ⤷ Desviado 0"*, which a reader parses as a rendering bug
  rather than as a source property — and which is **invisible in dev**, because the fixtures
  satisfy the relation 3/3.
- **The one TRUE free-kick partition (`direct + indirect == totalFreeKicks`, 208/208) is
  deliberately NOT drawn as a bar either.** Stated so a later reader does not read its absence as
  an oversight: a segmented bar over `{direct, indirect}` sitting beside two non-exhaustive
  subdivisions of one of its own segments is unreadable regardless of which geometry is correct.
  The relation is real, holds 208/208, and is simply not the thing this surface draws.
- **Corner delivery STYLE renders as four independent labelled counts**, same rule.
- **Corner delivery TYPE and corner SIDE may render as parts of `totalCorners`** — both hold
  208/208 — using decision 8's segmented-bar grammar. **Read the side split from
  `TeamSetPlays.cornersBySide`, which is a PRECOMPUTED contract field**, never by adding the three
  per-type `left`/`right` numbers: `contract/README.md` §14 exists to say so, and the field's own
  description states *"AD-5 forbids the App summing, so the team-level side split is its own field
  rather than three numbers the browser adds up out of cornersByDeliveryType."*
- Nothing anywhere adds two contract fields together and prints the result (AD-5).
- File the corpus-false `FreeKickCounts` `description` for correction in the successor change-set
  (Task 9.3). `/contract` is **not** edited by this story.

**7 — The involvement timeline is indexed by SAMPLE, never by minute. This is 2.6's decision 1,
and the same trap.**
`GoalkeeperInvolvementSample` is `{minute: Minute, involvements: Count}` — a **bare `Minute`**,
0–120, with **no stoppage field**. The corpus draws **95–145 slots per team-inning** (min 95,
median 102, max 145) and **2,506 of 21,764 corpus slots fall in stoppage time**, so on real data
many samples collide onto one minute — exactly the non-uniqueness Story 1.8's `schemaVersion: 2`
bump fixed for `MomentumSample.at` by making it a `MinuteStamp`, and exactly what invalidated
Story 2.6's original slider AC.
**The fixtures hide it completely:** m001/m002 carry 19 samples at minutes `0,5,10…90` and m074
carries 25 at `0,5…120` — evenly spaced, unique, and summing **exactly** to `totalInvolvements`.
**RULED:** the x-axis is the **sample index**; the minute is a *label* read off the sample, never
the key, never the domain, and never assumed unique. Ticks are chosen by index (decision 9).

**The shipped tick model you are told to copy is NOT directly implementable here, and the interim
behaviour is ruled rather than left to you.** `momentumTickIndices` emits a tick only at a row whose
minute is a multiple of the step **and is not a stoppage slot**, with a `seen` set added by review
patch *"so a later row carrying the SAME minute cannot emit a second tick at the same clock label"*.
Both mechanisms read `row.at.stoppageMinute`, **which this contract does not carry**. So:
- **Dedupe tick minutes by VALUE, first occurrence wins** — the half of `momentumTickIndices`' model
  that survives without a stoppage field, and the half that stops a repeated axis label.
- **Say what the axis is, once, in the axis `<Label>` and the `figureSummary`:** it plots the
  report's slots in order, and a stoppage slot carries the preceding regulation minute. One
  sentence, minted in both locales. Do **not** ship an unexplained axis whose labels repeat.

File the contract gap to 1.16 (Task 9.4): `GoalkeeperInvolvementSample.minute` needs to become a
`MinuteStamp` in the successor change-set, mirroring what 1.8 did for momentum — **never CS-1**.
**File it as a blocker for Story 2.19's real-data cutover, not as an open note**: the upstream data
already exists (`deferred-work.md`, grep `"The involvement clock's stamps are staged per slot"`,
filed at this story's own baseline and stating that *"Story 2.10 places this timeline from the
record alone"*), `MinuteStamp` already exists in the contract, and only the emit-boundary type is
missing. It is the difference between a truthful axis and a misleading one.

**8 — No categorical colour ramp exists, and none is invented. Categories are carried by order,
direct labels and hairline separators.**
DESIGN.md publishes exactly **two** ramps and **no general-purpose categorical palette**:
`--edge-weight-*` (:284) and `--heat-*` (:286) are five-stop and **on-pitch only** (DESIGN.md:282 —
theme-invariant, *"they render only on pitch-surface"*; 2.9 measured `heat-5` at **1.12:1** on the
light card, which is where all four of these sections live). The one five-value categorical palette
it does publish is the **shot-outcome** encoding (:270-278), which is scoped to shot outcomes by
name and cannot be borrowed — DESIGN.md:260 makes hex values unique per meaning precisely so that
cannot happen. Using the two team accents for categories would breach the same rule (*"a chart
never mixes team encoding with outcome encoding"*) and collide with decision 10.
**RULED**, taking 2.9's decision 15 verbatim as precedent:
- Every **category** dimension (free-kick types, corner styles, corner types, corner sides, GK
  distribution families and techniques, intervention types, body parts, aerial types, cross
  delivery types) is carried by **row/segment order + a direct text label + the value**, never by
  hue.
- Where a part-of-whole treatment is legal (decision 6's true relations), render **one horizontal
  bar per team filled in that team's own accent**, segmented by category with `border-hairline`
  separators and a **labelled value list beneath it as the text alternative** (the bar itself
  `aria-hidden`). This is `MovementToReceiveSection`'s shipped grammar — **copy the pattern, do not
  import from that file** (it is private, and 2.9's own note rules against cross-importing private
  section internals).
- **The bar's denominator is the SUM OF THE RENDERED SEGMENTS, not the contracted total.** 2.9
  could use its total safely because *"`total` is the SUM OF THE SIX CATEGORIES, so the rendered
  shares always sum to 100"*. Here the denominator would be `totalCorners`, a **separate contracted
  field** — and this story's headline finding is that one of the three obvious corner partitions is
  false on 112/208. Summing the segments makes the geometry self-consistent by construction;
  `totalCorners` is printed **verbatim** from the contract beside it. If the two disagree, the
  surface **shows both and normalizes neither** (AD-6 bans re-normalisation).
- **The share is geometry, and it is also printed** — `MovementToReceiveSection` prints it, so
  "copy the pattern" means printing a client-derived percentage. That is inside AD-5's carve-out
  (within-match, one bundle, one surface, never Hero-critical), and because it is printed it is a
  displayed number: decision 19 therefore requires it in the data table too.
- **Minimum rendered segment width** for any non-zero category, and a note in the Dev Record that
  the bar is therefore not pixel-proportional at the extremes (2.9's ruled treatment).

**9 — Explicit ticks on every axis. 2.10 is the story the 2.6 finding was filed against BY NAME.**
`deferred-work.md`, grep `"non-uniform and omit zero"`: recharts' automatic generator emitted
`+17, +1, -8, -17` on m074 — *"four ticks, unevenly spaced, **with no zero tick at all** on a chart
whose entire encoding is above-or-below the zero line"* — and the entry closes *"Recorded because
stories 2.10 / 2.13 / 2.15 / 2.16 all carry recharts statistical charts and will hit the same
default."*
**RULED:** every axis in this story supplies explicit `ticks` from a **pure, exported, unit-tested
function**, on the shipped `momentumYTicks(peak)` model:
- Percentage axes (`#phases`, `#pressing` blocks): domain `[0, niceMax]`, ticks always including
  **0** and the nice max, integer steps. Percentages here reach 149 in-possession corpus-wide, so
  **do not hardcode a 0–100 domain** — the max is data-driven and the sum is not 100.
- The involvement count axis: domain `[0, niceMax]`, ticks always including **0**.
- The involvement index axis: thinned tick indices, first and last always present, on
  `momentumTickIndices`' model.
Pin each with a property test over a range of inputs plus the fixture literals, as
`momentum-model.test.ts` does.

**10 — Team encoding: the THEME-AWARE canvas accents, plus BOTH non-hue channels UX-DR11 requires.**
All four sections are **cards on `--surface-raised`**, never the pitch. Use `--viz-team-a` /
`--viz-team-b` (which the `.light` block overrides at `globals.css:205-207`), **never** the
`-on-pitch` variants. 2.9 measured these on `--surface-raised`: dark **13.56 / 10.30**, light
**4.99 / 5.36** — both clear 4.5:1 in both themes. Re-measure anyway (Task 10.3).
UX-DR11 requires **two** things and the accessibility review is explicit that hue alone fails
(`review-accessibility.md:27` — the pair computes **1.32:1** dark and **1.07:1** light, and that
review names *"the recharts 'Phases-of-Play comparison,' pressing, and Defensive Blocks"* as the
surfaces that specify neither):
- **(a) Direct series labels — the team code at the bar end — on every two-team chart, always.**
  Not a legend. `MomentumChart`'s `SeriesLabelShape` is the shipped precedent for a direct label.
- **(b) Team B carries a second non-hue channel.** RULED: a diagonal-hatch `<pattern>` fill built
  from `--viz-team-b` over the bar, plus a solid `--viz-team-b` stroke; Team A is a solid fill.
  `MomentumChart` discharges the same rule with `TEAM_B_DASH_ARRAY = "6 3"` on a stroke, which a
  filled bar cannot use.
  **The hatch is drawn OVER A SOLID `--viz-team-b` GROUND, never over transparent gaps.** This is
  the difference between the browser call being a legibility question and a contrast question:
  transparent gaps let the card through and collapse the effective ratio, so the measured solid
  figures (10.30 dark / 5.36 light on `--surface-raised`) would transfer to neither option. With a
  solid ground they govern, and the hatch only adds texture.
  **Declared fallback, forced rather than optional:** if the hatch fails the **3:1 non-text floor**
  (WCAG 1.4.11, DESIGN's floor for every other mark) or is illegible at 320 px, ship a solid Team B
  fill with a **dashed `--viz-team-b` stroke outline** using the imported `TEAM_B_DASH_ARRAY`.
  Measure at Task 10.3, choose at Task 10.2, and **record which you shipped and why** — either
  discharges UX-DR11(b), but the choice is evidence-driven, not taste.
  **Scope: this rules SVG chart marks only.** Decision 8's segmented bars are CSS flex elements and
  an SVG `<pattern>` is unavailable to them. They discharge UX-DR11 through **per-team block
  placement plus the direct team-code label** instead — stated here so the dev does not have to
  derive it, and so nobody later reads their unpatterned Team B fill as an omission.

**11 — NO leader treatment anywhere in this story. Declared departure from UX-DR7.**
UX-DR7 scopes the ▲ / «líder» treatment to *"head-to-head stat tiles"*, and `resolveLeader`'s
contract is literally *"higher value leads"*. **Every value in these four sections is a descriptive
rate, count or distance where "higher" carries no ruled meaning.** A ▲ «líder» on *"longitud del
equipo 47 m vs 36 m"*, on *"balón largo 3% vs 6%"*, or on *"saques de banda 21 vs 26"* would invent
an editorial judgement the source does not make — the same class of over-claim decision 6 bars on
the sums and 2.9's decision 19 bars on its legend.
**The reasoning is STRUCTURAL, not semantic — stated precisely, because the semantic argument is
false by shipped precedent.** 2.9 applies `resolveLeader` to `offersMade` with the ▲ glyph and the
spoken «líder» (`receiving-model.ts`), and `KeyStatisticsSection` applies it across a block
containing `forcedTurnovers` and `crosses` — every bit as directionless as *"saques de banda 21 vs
26"*. So "higher carries no meaning" cannot be the reason without also re-opening 2.5 and 2.9.
**The real reason is that no head-to-head TILE SHAPE exists in this story.** UX-DR7 and DESIGN's
component spec both scope the treatment to the *stat tile* — two values facing each other across a
centred label — and there is no shared `StatTile` component to inherit it from
(`KeyStatisticsSection`'s is private).
**RULED, and made true rather than asserted:** every two-team value in this story renders as **two
per-team blocks in decision 17's grid**, never as a mirrored or centred-label tile pair — including
`#pressing`'s four metre values, which are the one place the story would otherwise build the very
shape it claims does not exist. Both teams' values are carried by the two accents **plus** the
direct team-code label (decision 10a), and nothing is marked as leading.
Do **not** import or re-implement `resolveLeader` in this story. File the departure for UX
sign-off (Task 9.5), asking the narrow question: *should a per-team block pair carry the leader
treatment that the stat tile carries?*

**12 — recharts is used for the three distributions and the timeline, in ONE new code-split leaf
module. Nothing else in this story uses a chart library.**
`epics.md:825` names recharts for `#phases` / `#pressing` explicitly. `EXPERIENCE.md:224-225` names
no chart for set plays (*"Counts by type/side/style"*) or goalkeeping (*"Involvement + distribution
summary"*), so `#set-plays` ships as tiles + value lists + bars with **no chart library at all**,
and `#goalkeeping` uses recharts **only** for the involvement timeline.
**RULED:** one new file `app/src/components/TacticalCharts.tsx`, the project's **second** recharts
importer, exporting exactly two components:
- `DistributionChart` — a horizontal grouped bar chart, N categories × 2 teams. Consumed **four**
  times: `#phases` in-possession (8), `#phases` out-of-possession (9), `#pressing` press rates (4),
  `#pressing` blocks (3).
- `InvolvementChart` — the per-team involvement timeline (decision 7's index axis).

Every rule `MomentumChart.tsx` establishes is **mandatory** here, and each has a named failure it
prevents (see "The recharts contract" in Dev Notes): `accessibilityLayer={false}`,
`isAnimationActive={false}`, explicit `ticks` and `domain` (never degenerate), colours as
`var(--token)` **presentation props** (Tailwind `fill-*` does not reliably reach recharts' internal
`<text>`), tick text via `{ className, fill }` objects, **no `<Tooltip>`** (hover-only, banned by
UX-DR15 / `EXPERIENCE.md:103`), no `<Legend>`, and a **parent with a resolved height** (a
height-less `ResponsiveContainer` parent renders nothing at all).
Each consuming section loads it with `next/dynamic` (`ssr: false`) behind a `skeleton` fallback at
the chart's exact height class, and imports back from it **`import type` only** — a value import
re-links recharts onto the critical path and defeats the split (`MomentumSection.tsx:6-13`).
**Layout is `layout="vertical"`** (recharts' name for horizontal bars): 17 categories with Spanish
labels cannot be read on a vertical axis at 320 px.

**The `dynamic()` call form, written out because the natural guess is broken.** `TacticalCharts.tsx`
has **no default export**, so `dynamic(() => import("@/components/TacticalCharts"))` resolves to a
module object, not a component. One wrapper per named export per consuming file
(`PhasesSection` declares `DistributionChart` **once** and renders it twice):

```tsx
const DistributionChart = dynamic(
  () => import("@/components/TacticalCharts").then((m) => m.DistributionChart),
  { ssr: false, loading: () => <ChartFallback /> }
);
```

The `loading` fallback needs `aria-busy="true"` **and an explicit height class** — the `skeleton`
utility sets background, radius and pulse only and *"supplies NO DIMENSIONS"*, so an unsized
fallback collapses to ~0 px and the chart then mounts at full height, which is a CLS hit against
the very budget the split protects (`MomentumSection.tsx:48-63`).

**Chart height is a function of category count, and the obvious workaround silently does not
compile.** `DistributionChart` is consumed at **3, 4, 8 and 9** categories × 2 series;
`momentum-model.ts`'s single `CHART_HEIGHT_CLASS = "h-[122px] md:h-[170px]"` would put 18 bars in
122 px. A runtime-interpolated `` className={`h-[${n * 22}px]`} `` is a class **Tailwind v4 never
generates** — silent zero height, and a height-less `ResponsiveContainer` parent renders nothing at
all, which is the exact failure mode named above.
**RULED:** export from `phases-model.ts` a pure
`distributionChartHeightClass(categoryCount: 3 | 4 | 8 | 9): string` returning one of four
**literal, statically-written** Tailwind classes (~26 px per category-pair plus axis margin), and
`INVOLVEMENT_CHART_HEIGHT_CLASS` from `goalkeeping-model.ts`. Each section's skeleton fallback
calls the same function, so fallback and chart heights cannot drift.
*Rejected alternative:* extend `MomentumChart.tsx`. It is shipped, reviewed, on the do-not-touch
list, and its module docblock states *"This module is the ONLY place recharts is imported"* — a
claim this story updates by adding a sibling, not by widening that file.

**13 — The two goal-prevention breakdowns have DIFFERENT denominators and must be labelled with
their own totals.**
The contract says so in `GoalPrevention.description`, verbatim: *"byInterventionType sums to
attemptsFaced (every attempt faced is categorised, including no-save-attempt), while byBodyType
sums to totalInterventions (only attempts the keeper actually intervened on have a body part) …
An App rendering the two panels side by side must label them with their own totals rather than
implying a shared one."*
**RULED:** each breakdown states its own total in its own label and in its data-table caption.
Note that `byBodyType` is decision 3's gated panel, so on real data only the intervention-type
breakdown ever renders — which makes the mislabelling risk live **only** on the fixtures, where it
is fully exercised.

**14 — `totalInvolvements` is printed VERBATIM and the timeline is never claimed to sum to it.**
Measured over 208 team-innings: `totalInvolvements − Σ(involvementTimeline)` runs **0…5**, is
**never negative**, and is **exactly 0 on only 59 of 208**. Story 1.9 ships the *bound*, not the
equality, and the ledger is explicit: *"Do not resolve it by making the numbers agree."*
**The fixtures make it look exact** — all six fixture keepers sum precisely to their total.
**RULED:** print `totalInvolvements` as the headline number, read verbatim. No copy, caption,
`figureSummary` or table footer may state or imply that the timeline adds up to it. **Never sum the
timeline** (AD-5 forbids it independently).

**Prose alone is not enough, because decision 19's own table STRUCTURALLY makes the claim.** A
table reading `Total: 47` above a column of per-slot counts that sum to 44 is the single most
likely place a reader adds a column, and a mismatch then reads as the app dropping data. Story 1.9
chose visibility over silence (*"records the observed delta … so the gap stays visible"*), and the
ledger's rule is *"do not resolve it by making the numbers agree"* — which forbids fixing the
numbers, **not** disclosing the gap.
**RULED:** the involvement disclosure carries **two tables, not one**: a summary table whose caption
states `totalInvolvements` is the figure the report **prints**, and the timeline table whose caption
states it is the chart the report **plots** and that the source does not guarantee the two agree.
That is disclosure, not a claim, and it is the only place in this story where a number and its
apparent breakdown legitimately disagree.
**The timeline table also carries a slot-index column**, because duplicate-minute rows are
otherwise indistinguishable (decision 7), and it needs its **own** caption key — decision 19's
`viz.table.caption` ("Ordenado por minuto.") is **false** here too: the order is sample index, the
minutes are not unique, and nothing in the contract guarantees the array is minute-sorted.

**15 — Every section is a card surface with theme-aware ink, `role="figure"` per team block, and
`figureSummary` as the prop name.**
This is the one place a light-theme contrast defect can still land, and 2.6 / 2.7 / 2.8 each found
one from the first-consumer position. `PitchPanel`'s ink classes (`text-ink-on-pitch`,
`border-pitch-line/40`) are **wrong** here — `--ink-on-pitch` (`#f2f5f7`) computes **1.09:1** on the
white card.
Follow `MomentumSection` / `OffersToReceiveSection`: `text-ink-primary`, `text-ink-secondary`,
`border-hairline`, `bg-surface-raised`, and `ViewDataDisclosure surface="canvas"`.
Per-team blocks are `<figure role="figure" aria-label={figureSummary} className="min-w-0 …">`.
**The prop may not be called `label`, `description`, `caption`, `title`, `text` or `heading`** —
all six are gated by the i18n `no-restricted-syntax` rule. Use `figureSummary`, the house name,
**including on `TacticalCharts`' own props**: `MomentumChart`'s `figureLabel` predates the house
naming and is not the model to copy (both are legal — the gate matches `^label$` exactly — but one
name per concept).
A team code is a **label** (`type-label-caps` + accent class), never a heading.

**16 — One frozen, ordered code list per enum, keyed by contract enum code (AD-7), with a key
builder each.**
The contract carries a closed enum for **every** category dimension in this story, and the object
properties are camelCase while the enum codes are kebab — so a mapping is mandatory, exactly as
2.9's decision 16 ruled for `OfferMovementType`. Export from the models, each typed over the
**generated union** so a contract enum change is a compile error:

| Enum (contract) | Values | Model | Exports |
|---|---|---|---|
| `InPossessionPhase` | 8 | `phases-model.ts` | `IN_POSSESSION_PHASES`, `IN_POSSESSION_PROPERTY`, `inPossessionPhaseKey` |
| `OutOfPossessionPhase` | 9 | `phases-model.ts` | `OUT_OF_POSSESSION_PHASES`, `OUT_OF_POSSESSION_PROPERTY`, `outOfPossessionPhaseKey` |
| `BlockLevel` | 3 | `phases-model.ts` | `BLOCK_LEVELS`, `blockLevelKey` |
| `FreeKickType` | 4 | `set-plays-model.ts` | `FREE_KICK_TYPES`, `FREE_KICK_PROPERTY`, `freeKickTypeKey` |
| `CornerDeliveryType` | 3 | `set-plays-model.ts` | `CORNER_DELIVERY_TYPES`, `CORNER_DELIVERY_PROPERTY`, `cornerDeliveryTypeKey` |
| `CornerDeliveryStyle` | 4 | `set-plays-model.ts` | `CORNER_DELIVERY_STYLES`, `cornerDeliveryStyleKey` |
| `PitchSide` | 2 | `set-plays-model.ts` | `PITCH_SIDES`, `pitchSideKey` |
| `DistributionType` | 3 | `goalkeeping-model.ts` | `DISTRIBUTION_TYPES`, `distributionTypeKey` |
| `FeetDistributionTechnique` | 6 | `goalkeeping-model.ts` | `FEET_TECHNIQUES`, `FEET_TECHNIQUE_PROPERTY`, `feetTechniqueKey` |
| `HandsDistributionTechnique` | 3 | `goalkeeping-model.ts` | `HANDS_TECHNIQUES`, `HANDS_TECHNIQUE_PROPERTY`, `handsTechniqueKey` |
| `ThrowDistributionTechnique` | 4 | `goalkeeping-model.ts` | `THROW_TECHNIQUES`, `THROW_TECHNIQUE_PROPERTY`, `throwTechniqueKey` |
| `InterventionType` | 5 | `goalkeeping-model.ts` | `INTERVENTION_TYPES`, `INTERVENTION_PROPERTY`, `interventionTypeKey` |
| `InterventionBodyType` | 5 | `goalkeeping-model.ts` | `INTERVENTION_BODY_TYPES`, `INTERVENTION_BODY_PROPERTY`, `interventionBodyTypeKey` |
| `AerialInterventionType` | 3 | `goalkeeping-model.ts` | `AERIAL_TYPES`, `AERIAL_PROPERTY`, `aerialTypeKey` |

`CrossDeliveryType` (6) already has `enums.crossDelivery.*` from Story 2.7 — **reuse it** for
`aerialControl.deliveryTypesFaced`; do not mint a second namespace. Its `CROSS_DELIVERY_TYPES`
list is already exported and already consumed by `i18n.test.ts`.
Every list drives an `i18n.test.ts` exhaustiveness assertion in **both** locales, on the shipped
template (Task 8.5).

**Two shipped mechanics you must copy exactly, both of which a 2.9 review patch exists for:**

- **A frozen list is a `Record`, never a bare array.** `readonly Enum[] = [...]` gives **no**
  compile-time exhaustiveness — *"an array stays assignable however many members the union
  gains, and the i18n exhaustiveness suite compares locale keys against this very array, so a
  widened enum would have slipped past both"* (`receiving-model.ts`, the review patch comment).
  The shipped shape, which you copy per enum:
  ```ts
  const IN_POSSESSION_ORDER: Record<InPossessionPhase, true> = { "build-up-unopposed": true, … };
  export const IN_POSSESSION_PHASES: readonly InPossessionPhase[] =
    Object.keys(IN_POSSESSION_ORDER) as InPossessionPhase[];
  ```
  `Object.keys` preserves insertion order for non-numeric string keys, so the schema's declaration
  order survives.
- **Every key builder ends in `as DictionaryKey`.** `DictionaryKey` is a literal union
  (`DotPaths<Dictionary>`, `lib/i18n.ts`), and a template-literal expression infers `string` — so
  without the cast every one of the fourteen builders is a `tsc --noEmit` error. Shipped form:
  ``return `enums.offerMovement.${code}` as DictionaryKey;``. **That cast is precisely why Task
  8.5's exhaustiveness test is mandatory rather than optional** — it is the only thing standing
  between a typo'd key and a runtime miss.

**17 — `<md`: stacked, both teams visible, no tabs. Same declared departure 2.9 took.**
`EXPERIENCE.md:125-135`'s Responsive table has **no row** for any of these four sections. It does
carry rows for pitch maps, Expert tables, comparison, Hub tables, the Momentum Timeline and
head-to-head Key Statistics — so the absence is specific, not a gap in the survey. Team tabs exist
to stop two 68 m-wide pitches from being unreadable side by side; **none of these four sections is
a pitch.**
**RULED:** at `<md` the two teams stack vertically, both visible, no tabs and no toggle; at `≥md`
they sit side by side. Pure CSS — `grid grid-cols-1 gap-tile-gap md:grid-cols-2`, exactly as
`OffersToReceiveSection` and `KeyStatisticsSection` do. **Do not use `useMediaQuery`** for this;
neither 2.9 section does.
The exception is **every `DistributionChart`** — `#phases`'s two and `#pressing`'s one. Those are
**category × 2 teams in ONE chart** rather than two per-team cards: they stack vertically at every
width, and the two teams are two series inside each chart, never two columns of the grid.
`#pressing`'s metre values and all of `#set-plays` and `#goalkeeping` follow the two-column rule.

**18 — Every model entry point returns early on an absent or zero-length slice. This is a
whole-layer safety requirement.**
There is **exactly one** error boundary in the Tactical stack and it wraps all eleven sections
(`MatchBundleRegion.tsx`, grep `<TacticalErrorBoundary>`). There is no per-section boundary
anywhere. A throw from any 2.10 model replaces every other section with one crashed panel — and
**this story adds four more surfaces behind it, on the deepest object graph in the contract**
(`GoalkeeperRecord` alone is 8 required fields over 5 nested objects).
`sectionDataState` gates on presence/`!== null` **only**, so `[]` is `ready` and your code runs.
Guard, each with its own test: `goalkeeping: []`; `goalkeeping` with records for one team only;
`goalkeeping` with **two** records for one team (decision 2); an `involvementTimeline` of `[]`;
`Math.max(...[])`; and division by `attemptsFaced === 0` (`savePercentage` is contracted separately,
so never re-derive it — but any percentage you *do* compute for a bar segment needs the guard).
Build every row set **eagerly**, outside the lazily-mounted disclosure, following every shipped
section: a bad `teamId` must name itself on load, not when a reader opens a table.
**The per-section boundary is NOT this story's to build** — pre-existing architecture, open and
unpatched. Re-file it with this story's added blast radius (Task 9.6); do not fix it here.

**19 — Each section's data table carries the SAME NUMBERS the surface displays.**
UX-DR16 and `ARCHITECTURE-SPINE.md:140` require *"a reachable data table rendering the same
artifact slice"*. Where a surface prints a team-level headline and a breakdown, the disclosure
carries **both** — 2.9's ruled decision 11. Each caption states its own content and its own order;
`viz.table.caption` is literally `"Ordenado por minuto."` and is a **false claim** on every table
in this story except the involvement timeline's. Mint caption keys per table.
Tables are **not sortable** — Story 2.11 owns `aria-sort`, the `Intl.Collator('es')` sort and the
Expert-layer instance. State it in a comment, as 2.6, 2.7, 2.8 and 2.9 all did.

**20 — `PendingSectionPanel` loses its last call site. Leave the component standing.**
After this story every `SectionId` dispatches to a real component, so `PendingSectionPanel` and its
`tactical.pending.*` keys have zero consumers. **Do not delete either** — `EmptyStatePanel.tsx` is
outside this story's touch list, the Expert Layer (2.11) may want the same shell, and deleting live
locale keys is a change three exhaustiveness tests would have to be reasoned about. Record the fact
and route the keep-or-delete call to 2.11 (Task 9.7).

## Tasks / Subtasks

- [x] **Task 1 — Baseline and orientation** (no AC)
  - [x] 1.1 `npm test` in `app/`. **The baseline has two legitimate values and you will see the
        lower one:** on a tree with no `app/out/`, **419 passed / 20 skipped (439) / 19 files**;
        after a build has populated `out/`, **439 passed / 19 files**. The 20 static-output tests
        are `describe.skipIf(!anyBuilt)`. 419 is **not** a broken baseline. Re-measure; do not
        inherit either number. `npm test` is **not** part of `npm run build`.
  - [x] 1.2 `npm run check:types` and `npm run assert:schema-version` — both green at story
        creation. If `check:types` fails, run `npm run generate:types` and continue; **never**
        hand-edit generated types. If `assert:schema-version` fails, **stop and reconcile**.
  - [x] 1.3 Confirm `npm run build` is green at HEAD (chain: `eslint . --max-warnings 0` →
        `tsc --noEmit` → `assert:schema-version` → `next build` → `copy-data`).
  - [x] 1.4 `git status`, and **re-derive it — do not trust the story's snapshot.** At the end of
        story creation `app/` had **nine** uncommitted files from a **2.9 code-review session**
        that started mid-creation, including `locales/{es,en}.ts` and `lib/i18n.test.ts`, which you
        also edit. `pipeline/**` is dirty from the 1-15 review. **`git add app/` is dangerous** —
        stage explicit paths only. Read Dev Notes → "Coordination & hygiene" **before your first
        edit**, not before your first commit.

- [x] **Task 2 — `app/src/viz/phases-model.ts`** (AC 1) — pure, testable, no React, no DOM, no
      `t()`, no `@/lib/format`. `src/viz/**` is inside the ESLint client-import seam: return
      `DictionaryKey`s and raw numbers only.
  - [x] 2.1 **Re-derive the non-partition before writing a renderer.** Over all three fixtures,
        assert that `sum(phasesInPossession)` and `sum(phasesOutOfPossession)` are **not** 100 for
        at least one team, and pin the fixture sums as literals. Ship it as a test, not a comment.
        This is the assertion that makes decision 4's "never normalize" mechanical.
  - [x] 2.2 Decision 16's exports for `InPossessionPhase`, `OutOfPossessionPhase` and `BlockLevel`,
        each with its camelCase-property map and key builder, typed over the generated union.
  - [x] 2.3 `phaseRows(tacticalIdentity, home, away)` → for each of the two phase families, an
        ordered array of `{code, labelKey, home, away}` in the frozen enum order. Raw percentage
        points, unformatted.
  - [x] 2.4 `blockRows(tacticalIdentity, home, away)` → the three `BlockLevel` rows, same shape,
        and `pressRows(...)` → decision 4's four press rates (`highPress`, `midPress`, `lowPress`,
        `counterPress`) as a frozen ordered subset of `OUT_OF_POSSESSION_PHASES`. Export the subset
        as its own `readonly OutOfPossessionPhase[]` derived from a `Record` (decision 16's shape)
        so it cannot silently drift from the nine.
  - [x] 2.5 `metreRows(tacticalIdentity, home, away)` → the four contracted values per team as
        `{measure: "lineHeight" | "teamLength", state: "inPossession" | "outOfPossession", home,
        away}`. Docblock carries decision 5's evidence in full — the corpus's three-panel shape,
        the unmodelled `team_width`, the fact that `m001`'s fixture `44.4` matches no staged panel,
        and the binding that this presentation is deleted or re-shaped when 1.16 rules.
  - [x] 2.6 `percentTicks(max: number): number[]` — decision 9's pure tick function for a
        `[0, niceMax]` percentage domain. **Always includes 0.** Property-test it over 1–160 (the
        corpus in-possession sum reaches 149, so a 0–100 assumption is corpus-false) plus the
        fixture literals, on `momentumYTicks`' test model.
  - [x] 2.7 `phases-model.test.ts` — all three fixtures, every time, following
        `shot-map-model.test.ts`'s structure (fixtures via `node:fs`, **not** `@/lib/build-data`,
        which the seam bars in `src/viz/**`).

- [x] **Task 3 — `app/src/viz/set-plays-model.ts`** (AC 2)
  - [x] 3.1 **Re-derive decision 6's two false partitions against the FIXTURES and assert they
        hold there.** This is the inverse of Task 2.1 and it is the point: a test that pins
        *"the fixtures satisfy `direct == on + off` on 3/3, and the corpus does not on 208/208"*
        is what stops a later reader from "fixing" the surface back to a stacked chart. Comment it
        with both numbers.
  - [x] 3.2 Decision 16's exports for `FreeKickType`, `CornerDeliveryType`, `CornerDeliveryStyle`
        and `PitchSide`.
  - [x] 3.3 `setPlayTotals(setPlays, home, away)` → the five contracted totals per team, raw.
  - [x] 3.4 `freeKickRows(...)` → the four `FreeKickType` values per team as **independent counts**,
        each flagged `subordinate: boolean` (true for the two `direct*` flags) so the component can
        indent them without any arithmetic. Docblock states decision 6 and the 0/208 measurement.
  - [x] 3.5 `cornerRows(...)` → three groups: **by side** — read verbatim from the precomputed
        `cornersBySide` (`TeamCornerSideCounts`), **never** summed out of the per-type splits
        (`contract/README.md` §14) — **by delivery type** (partition-legal, and carry each type's
        own `CornerSideCounts` left/right split), and **by style** (independent counts,
        `partition: false`). Each group carries an explicit `partition: boolean` field so the
        component cannot get it wrong by reading a variable name.
  - [x] 3.6 Segment shaping for decision 8's bars: for each partition-legal group, per team,
        `{code, count, share}` with `share = count / total` and `total === 0` yielding `share: 0`
        for every category plus a zero flag the component uses to render the zero line.
  - [x] 3.7 Team-totals rows for decision 19.
  - [x] 3.8 Zero-state guards with a test each: all five totals at 0; `totalCorners: 0` with every
        breakdown at 0 (reachable — corpus `total_corners` min is **0**).
  - [x] 3.9 `set-plays-model.test.ts` over all three fixtures.

- [x] **Task 4 — `app/src/viz/goalkeeping-model.ts`, part 1: shape and gates** (AC 3)
  - [x] 4.1 Decision 3's `CorpusNullableGoalkeeperRecord` view interface and the **single** entry
        cast, commented with the 208/208 evidence for each of the five fields and routed to the
        successor change-set by name.
  - [x] 4.2 Decision 16's exports for the eight Domain E enums. Reuse Story 2.7's
        `CROSS_DELIVERY_TYPES` / `crossDeliveryKey` for `deliveryTypesFaced` — **do not mint a
        second cross-delivery namespace.**
  - [x] 4.3 `goalkeepingByTeam(goalkeeping, home, away)` → decision 2's grouping: an ordered
        `[homeBlock, awayBlock]`, each `{teamId, teamCode, keeperNames: string[], records:
        GoalkeeperBlock[]}`. Home first, from `metadata`, **never array order**. Use `resolveSide`
        from `marker-model.ts` so a stray `teamId` fails loud in one place — its signature takes
        **four** arguments, `resolveSide(record.teamId, home, away, "goalkeeping")`, where the
        fourth names the offending table in the thrown message.
  - [x] 4.4 Presence predicates, one per gated panel, each returning a narrowed type:
        `hasFeetTechniques`, `hasHandsTechniques`, `hasThrowTechniques`, `hasBodyTypes`,
        `hasCrossesFacedCompleted`.

- [x] **Task 5 — `goalkeeping-model.ts`, part 2: the four summaries** (AC 3)
  - [x] 5.1 `involvementSeries(record)` → decision 7's index-keyed rows
        `{index, minute, involvements}`. **The minute is a label, never a key.** Docblock carries
        the 2,506/21,764 stoppage measurement and the 2.6 precedent.
  - [x] 5.2 `involvementTicks(count)` and `countTicks(max)` — decision 9's two pure tick functions,
        property-tested.
  - [x] 5.3 `distributionRows(record)` → `total` / `feet` / `hands` / `throw` as
        `CompletionCounts` triples + `lineBreaks`, plus the three **gated** technique groups.
  - [x] 5.4 `goalPreventionRows(record)` → `attemptsFaced`, `savePercentage` (read verbatim —
        **never re-derive it**), `totalInterventions`, the five intervention-type rows, and the
        **gated** five body-type rows. Decision 13: each breakdown carries **its own** denominator
        as data, so the component cannot imply a shared one.
  - [x] 5.5 `aerialRows(record)` → `totalInterventions`, the three `AerialInterventionType`
        `CompletionCounts`, `crossesFacedAttempted`, the **gated** `crossesFacedCompleted`, and the
        six `CrossDeliveryType` counts + total.
  - [x] 5.6 Team-totals / per-panel rows for decision 19's tables, one caption key per table.
  - [x] 5.7 Zero-state guards, each with its own test: `goalkeeping: []`; records for one team
        only; `involvementTimeline: []`; `attemptsFaced: 0`; every count at 0. Carry a
        `recordCount` on each team block so Task 7.7 can tell **"no record for this team"** from
        **"this keeper did nothing"** — see 7.7; the model must not collapse them.
  - [x] 5.8 **The two-keeper case (decision 2).** No fixture carries it — construct a record pair
        sharing one `teamId` and assert the block renders **two** keeper names and **two** panel
        sets, and that **nothing is summed across them**. Also construct a record with all five
        gated fields `null` — the corpus shape, which no fixture can produce — and assert every one
        of those panels is **absent**, not em-dashed. Both constructions need
        `as unknown as GoalkeeperRecord`; that cast is **authorised here and only here**, for the
        reason 2.9's Task 3.7 established (bundles reach the App as `as`-cast unvalidated JSON, so
        the test simulates the real path). Comment each cast with that reason.
  - [x] 5.9 `goalkeeping-model.test.ts` over all three fixtures plus the constructed inputs.

- [x] **Task 6 — `app/src/components/TacticalCharts.tsx`** (AC 1, AC 3) — decision 12's single new
      recharts leaf. `"use client"`.
  - [x] 6.1 `DistributionChart` — `layout="vertical"` grouped bars, N categories × 2 teams, every
        string arriving **pre-resolved** from the section (no `t()` in this module, following
        `MomentumChart`'s contract). Props include the resolved category labels, both series'
        values, both team codes, the explicit `ticks`, and the figure label.
  - [x] 6.2 Decision 10's two non-hue channels: direct team-code labels at the bar ends, and the
        Team B hatch `<pattern>` (or the declared dashed-stroke fallback). Build the `<pattern>` in
        a `<defs>` child with a **stable, unique id** — four `DistributionChart` instances mount on
        one page, so a hardcoded id collides. **Sanitize the id before it reaches SVG:**
        ``const patternId = `team-b-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;`` — React 19
        emits guillemet-delimited ids (`«r3»`), which are not valid XML `NCName` start characters
        and break `querySelector` / `getComputedStyle` debugging. This is the project's **first**
        `<defs>` / `<pattern>` / `url(#…)` reference; every shipped `useId()` call feeds an
        `id`/`aria-controls`, never an SVG functional-IRI, so there is no precedent to copy.
        If you take decision 10(b)'s dashed-stroke fallback instead, **import**
        `TEAM_B_DASH_ARRAY` from `momentum-model.ts` — that module is do-not-**edit**, not
        do-not-import; never re-declare the constant.
  - [x] 6.3 `InvolvementChart` — decision 7's index-keyed bar chart, explicit ticks on both axes,
        thinned index ticks with first and last always present.
  - [x] 6.4 The mandatory recharts props on **both** charts: `accessibilityLayer={false}`,
        `isAnimationActive={false}`, explicit `domain` floored so it is never degenerate, colours
        as `var(--token)` presentation props, tick text via `{ className: "type-caption
        tabular-nums", fill: "var(--ink-secondary)" }`, **no `<Tooltip>`**, **no `<Legend>`**,
        axis titles via `<Label>` (recharts' `name` prop feeds only the tooltip and legend
        payloads, which are both banned — so `name` reaches no surface at all, not even the
        accessibility tree).
  - [x] 6.5 A parent with a **resolved height class** and `ResponsiveContainer width="100%"
        height="100%"`. Export the height class from a **pure model module**, never from this file
        — a value import from here re-links recharts onto the critical path
        (`MomentumSection.tsx:6-13`). Use `useElementWidth(FALLBACK_WIDTH_PX)` if you need the
        width; it returns a **callback ref**, not an object ref.
  - [x] 6.6 **No unit tests here** — the harness has no jsdom. Everything assertable lives in the
        pure models (Tasks 2, 3, 5). Task 10.2's browser pass is the only verification this file
        gets, which is exactly why decisions 9 and 10 are pinned as pure functions upstream.

- [x] **Task 7 — The four section components** (AC 1, AC 2, AC 3)
  - [x] 7.1 `PhasesSection.tsx` — two `DistributionChart`s (in-possession 8, out-of-possession 9),
        each `dynamic()`-loaded with a skeleton fallback at the chart's height, each a
        `role="figure"` with its own `figureSummary`. A subtitle `<p className="type-stat-label
        text-ink-secondary">` states that these are **independent rates that do not sum to 100** —
        the single most important sentence on this surface. `TacticalSection` owns the `<h2>`; this
        component renders **no heading**.
  - [x] 7.2 `PressingSection.tsx` — **two** `DistributionChart`s (decision 4: the four press rates,
        then the three block levels — press first, matching the section title's own word order),
        plus the
        four metre values as **two per-team blocks in decision 17's grid** — never a mirrored or
        centred-label tile pair, which is the shape decision 11 rules out of this story.
        The metre unit is a **locale-layer label keyed by measure** (AD-7: *"Units are locale-layer
        metadata keyed by metric code, never artifact strings"*), following `KEY_STAT_UNIT`'s
        shipped shape. **The home for it already exists**: `enums.unit` in both locale files
        currently carries `km` only — add `m` there, plus a
        `Partial<Record<MetreMeasure, "m">>` map in `phases-model.ts`. Do not invent a new
        namespace and do not bake the unit into a label string.
  - [x] 7.3 `SetPlaysSection.tsx` — per-team blocks: the five totals, the four free-kick
        independent counts (decision 6, `direct*` visually subordinate), the corner side and
        delivery-type segmented bars with their labelled value lists (decision 8), and the four
        style counts as independent values. **No chart library.**
  - [x] 7.4 `GoalkeepingSection.tsx` — decision 2's per-team blocks with the keeper context label,
        the `InvolvementChart`, and the three summary panels, each gated per decision 3. Decision
        13's two denominators labelled separately. `totalInvolvements` verbatim (decision 14).
  - [x] 7.5 Every section: `ViewDataDisclosure panelTitle={t(sectionTitleKey(id))}
        surface="canvas" trailing={<p className="type-caption text-ink-secondary">
        {t("viz.attribution")}</p>}` wrapping the decision-19 tables. **Use the existing
        `tactical.sections.*.title` keys — do not mint `viz.*.title` keys for this.** The four are
        already distinct ("Fases del juego", "Presión y bloques defensivos", "Balón parado",
        "Arqueros"), which satisfies the requirement that the page never ships four
        indistinguishable "Ver los datos" buttons (a defect the 2.7 review already patched once).
        Two shipped sections disagree on this — `MomentumSection` uses `tactical.sections.*.title`,
        `MovementToReceiveSection` uses its own `viz.movement.title` — and this story follows the
        former, consistent with Task 8.4's instruction not to re-mint titles that already exist.
  - [x] 7.6 Data tables: a private `DataTable` copy per section is the **current convention** —
        `PassNetworksSection` says so explicitly and `MomentumSection` carries the canonical shape.
        Do **not** refactor `DataTable` out of any shipped file. Canvas ink only; **no
        `overflow-x-auto` of your own** — `ViewDataDisclosure`'s region already applies it and a
        second one nests scroll containers.
  - [x] 7.7 Zero-content views: each section renders a dedicated zero line when its slice is
        present but lists nothing — **never** an `EmptyStatePanel`, which belongs to the `null`
        branch and is rendered by `TacticalLayer` above you.
        **The trap, and it is the exact defect 2.9's own review patched:** `sectionDataState`
        returns `ready` whenever `goalkeeping !== null`, so a bundle with records for **one** team
        leaves the other team's block to you — and the natural implementation renders it with
        zeros (*"0 intervenciones · 0 atajadas · 0%"*), **a positive claim that the report recorded
        zero when the truth is that no record exists.** `OffersToReceiveSection` carries the ruling
        verbatim: *"'NO ROWS FOR THIS TEAM' IS NOT 'THIS TEAM MADE ZERO OFFERS'"*. A team with
        `recordCount === 0` renders a dedicated zero line **naming the absence**, never zeros.
        Pin it with a test.
  - [x] 7.8 Player/keeper names are **plain text, never links**. `/players/{slug}` does not exist
        in `src/app/`, so a link 404s in the static export; UX-DR22's cross-link rule is scoped to
        *lineup* names.
  - [x] 7.9 Not sortable (decision 19) — state it in a comment naming 2.11, as the four shipped
        sections do.

- [x] **Task 8 — Registration and locales** (all ACs)
  - [x] 8.1 `TacticalLayer.tsx` — replace the four-id `PendingSectionPanel` fall-through with four
        real cases. Follow the shipped prop-wiring pattern exactly: **narrow explicit props, never
        the whole bundle**; `SideRef` triples built from `bundle.metadata.{home,away}Team` with
        `.teamCode.toUpperCase()`. This is an **additive** change to the switch; touch nothing else
        in the file — **except** the now-orphaned `PendingSectionPanel` binding in the import on
        line 6, which you must delete in the same edit. **Nothing in the build chain catches a dead
        import**: `@typescript-eslint/no-unused-vars` is not in the flat config's active set and
        `tsconfig.json` sets no `noUnusedLocals`, so `eslint --max-warnings 0` exits 0 on it. 2.9
        shipped dead bindings and took a review finding for it. The component itself and its
        `tactical.pending.*` keys **stay** (decision 20); only the import goes.
  - [x] 8.2 **`tactical-sections.ts` needs NO change.** Confirm it, and say so in the Dev Record.
        The four predicates are already correct and already carry the right docblock.
  - [x] 8.3 `tactical-sections.test.ts` — **add only the two branches that are genuinely missing.**
        Already shipped and passing, so do not re-add them: `SECTION_IDS` order and
        `toHaveLength(11)`; all four ids in `COLLAPSIBLE_SECTION_IDS`; all four `ready` on all three
        fixtures; and — verbatim, in a test named *"treats an empty goalkeeping array as ready and
        null as empty"* — the `goalkeeping: []` → `ready` / `null` → `empty` pair. **Missing:**
        `tacticalIdentity` absent → `phases` **and** `pressing` both `empty`, and `setPlays` absent
        → `empty`. Patch them in with a `{ ...m001, tacticalIdentity: null as unknown as
        TacticalIdentityBlock }` spread; the existing `withEvents(...)` helper patches `events`
        only and will not reach either field.
  - [x] 8.4 `locales/{es,en}.ts` — `es.ts` is canonical; `en.ts` must mirror its key shape
        **exactly**, no empty leaves. New `viz.phases.*`, `viz.pressing.*`, `viz.setPlays.*`,
        `viz.goalkeeping.*` namespaces on the shipped per-viz pattern, plus the fourteen
        `enums.*` namespaces of decision 16, plus caption keys per table, plus the metre unit
        label. **The four section titles and summaries already exist in both locales** —
        `tactical.sections.{phases,pressing,set-plays,goalkeeping}.{title,summary}`, including
        `goalkeeping.title: "Arqueros"`. Do not re-mint or edit them.
  - [x] 8.5 `i18n.test.ts` — exhaustiveness over every new enum namespace in **both** locales,
        driven by Task 2.2 / 3.2 / 4.2's frozen ordered lists, on the shipped template
        (`Object.keys(es.enums.X).sort()` against the list, plus a per-code `t()` round-trip
        asserting the label is neither empty nor the key itself).
  - [x] 8.6 **Mint the missing Spanish terms** under `EXPERIENCE.md:278`'s procedure (*"New terms
        discovered during content work get their own row, decided under the same per-term
        Spanish-first tie-breaker"*), and record the full table in the Dev Record. **Ruled terms
        that already exist and must be used verbatim:** `presión` / section label *"Presión y
        bloques defensivos"*; `bloque alto / medio / bajo`; `altura de la línea defensiva` (short
        label `altura de la línea` — **not** bare *"altura de línea"*, which reads as typography);
        `longitud del equipo`; `fases del juego`; `salida de balón` (build-up); `contrapresión`;
        `balón parado`; `tiro de esquina`; `arquero` / section label *"Arqueros"*; `atajada`;
        `distribución`. **Terms with no ruled row — propose, use, and file:** free kick, throw-in,
        penalty, goal prevention, aerial control, involvement, delivery type, delivery style,
        line breaks, save percentage, attempts faced, plus decision 3's gate-disclosure sentence,
        decision 7's axis sentence and decision 14's two table captions.
        Prefer the LatAm register throughout (UX-DR19).
  - [x] 8.7 Counters need a **singular AND a plural** key — `t()` has no interpolation and no
        plural machinery, and *"1 tiros de esquina"* is a visible copy defect in both languages.
        Use the shipped `countPhrase(count, one, many)` helper shape.

- [x] **Task 9 — Ledger, docs and disclosure** (AC 1, AC 2, AC 3) — **every edit APPEND-ONLY**
  - [x] 9.1 File: the `#goalkeeping` re-scope in full — the per-team grouping, the **five**
        corpus-null required sub-blocks with their 208/208 measurement (AD-14 (d) recorded only the
        per-keeper half), the two-keeper handling, and the presence-gate mechanism. Owner:
        **Story 1.16**, which cannot emit any of the five and must not read their absence as an
        extraction defect.
  - [x] 9.2 File: `lineHeight` / `teamLength` render with **no defined provenance** — the corpus's
        three panels per state, the unmodelled `team_width`, and the measurement that the fixture's
        `44.4` matches no staged panel and no mean. Owner: **Story 1.16** (the aggregation rule).
        Extend, do not duplicate, the existing 1.7 entry (grep `"the line-height/team-length pages
        are per-phase panels"`).
  - [x] 9.3 File: the contract's `FreeKickCounts` `description` is **corpus-false on 208/208** and
        needs correcting in the successor change-set — **never CS-1**, which is already scoped.
        Record the corner-STYLE non-partition (96/208) beside it, and record which relations ARE
        corpus-true so a later reader does not over-correct.
  - [x] 9.4 File: `GoalkeeperInvolvementSample.minute` is a bare `Minute` and **cannot represent
        the corpus clock** — 95–145 slots per team-inning against a 0–120 integer, with 2,506 of
        21,764 slots in stoppage time, so minutes are **not unique** on real data. The fix is the
        one Story 1.8 already made for `MomentumSample.at`. Route to the successor change-set and
        note that this story has already indexed by sample, so no App change is owed when it lands.
  - [x] 9.5 File: decision 11's **declared departure from UX-DR7** — no leader treatment on any
        2.10 surface, resting on "no head-to-head tile shape exists here" and **not** on a semantic
        argument, which 2.5's and 2.9's shipped `resolveLeader` calls would contradict. Ask UX the
        narrow question: *should a per-team block pair carry the leader treatment the stat tile
        carries?* Owner: **UX**.
  - [x] 9.5a File: decision 4's **seven-value duplication** between `#phases` and `#pressing`, and
        why — the shipped `#pressing` summary promises pressing intensity and is the `<lg`
        collapsed-shell copy, so a blocks-only `#pressing` would ship false copy on the surface a
        phone reader reaches first. Record it so 2.16 (Team Profile, which renders the same Domain
        C block) inherits the ruling rather than re-deriving it, and so a reviewer does not read
        the duplication as an error.
  - [x] 9.6 Re-file the whole-layer error-boundary blast radius with this story's contribution:
        four more sections behind one boundary, over the deepest object graph in the contract, and
        the fact that **all eleven sections now render real content**, so the boundary's blast
        radius is finally complete rather than partly shells.
  - [x] 9.7 File: `PendingSectionPanel` and `tactical.pending.*` now have **zero call sites**
        (decision 20). Route the keep-or-delete call to **Story 2.11**.
  - [x] 9.7a File: the **nullability asymmetry** this story proved. `goalkeeping` and `players` are
        nullable; `tacticalIdentity` and `setPlays` are not — so FR-22's "explicit empty state names
        what's absent" is structurally reachable for only one of these four sections. A report
        lacking the Domain C or F pages fails the whole report under AD-8, so the reader loses the
        entire match rather than seeing a named empty section. Empirically moot (208/208 carry
        both), which is why it is a note and not a blocker. Owner: contract / **1.16**.
  - [x] 9.8 File: whichever of decision 10(b)'s two Team B encodings you shipped, and why —
        including the 320 px legibility observation that decided it. This is the first pattern-fill
        in the project and 2.13 / 2.15 / 2.16 / 2.17 will all face the same choice.
  - [x] 9.9 `_bmad-output/implementation-artifacts/sprint-status.yaml` — append the status line.
        **Never `git add -A`.** Stage exactly `app/`, this story file, and the two shared artifacts,
        both of which live at `_bmad-output/implementation-artifacts/` (not the repo root). If your
        commit carries any in-flight 1-15 lines, **disclose it in the Completion Notes**.

- [x] **Task 10 — Verification** (all ACs). The harness has **no jsdom**, so nothing rendered can
      be unit-tested. Both defects the 2.7 review found were in rendered code and were structurally
      invisible to a green suite. Adopt 2.7 / 2.8 / 2.9's mitigation proactively.
  - [x] 10.1 **Serving mechanics first.** `next dev` cannot serve `/data/fixtures`; only
        `copy-data` populates `out/`. Verify against `python -m http.server 8765 --directory
        app/out`. `trailingSlash: true`, so deep links are `/matches/{slug}/#anchor`. Turbopack
        reuses chunk filenames — hard-reload (Ctrl+Shift+R) before every browser check.
  - [x] 10.2 **Render and inspect all four sections**, at `≥lg` and `<md`, on all three fixtures,
        both themes. Specifically: the 17 phase bars' label legibility at 320 px (Spanish runs
        20–30% longer and the 11 px type floor is hard — `review-i18n.md:45`); **decision 10(b)'s
        hatch-vs-dash call, made in the browser and recorded**; the direct team-code bar labels;
        the zero tick present on every axis; the corner segmented bars' minimum segment width; the
        goalkeeping blocks with all five gated panels **present** (the fixtures populate them).
  - [x] 10.3 **Contrast, both themes, method validated first (the 2.6 method).** Reproduce a
        published figure before trusting a new one: `--viz-team-a` on `--surface-raised` must
        compute **13.56** dark / **4.99** light, and `--viz-team-b` **10.30** / **5.36**. Then
        measure: the Team B hatch/dash against the card, the hairline separators against both bar
        fills, the axis tick ink, the subtitle ink, and the "Ver los datos" control in the `canvas`
        variant. Record as a `| element | dark | light | floor |` table. **Light theme is where
        2.6, 2.7 and 2.8 each found a failure from the first-consumer position, and 2.10 is first
        for every Domain C/E/F surface.**
  - [x] 10.4 **Keyboard, live, with real key presses.** Tab through all four sections end to end.
        The charts carry **no** interactive nodes in this story (no cursor, no markers, no
        selection) — confirm that, and confirm no stray `tabIndex` or `role="application"` leaks
        from recharts (`accessibilityLayer={false}` is what prevents it). Each disclosure opens and
        closes; focus is never lost.
  - [x] 10.5 **Screen-reader / structural pass:** every team block announces as a figure with its
        localized summary; every chart is reachable as a table via "Ver los datos"; the bars'
        value lists are real text; the gated panels are **absent from the accessibility tree**, not
        present-and-empty. Verify by reading strings back from the live DOM in both locales, and
        state the method honestly (a live screen reader is not available in this harness).
  - [x] 10.6 **Reflow:** `scrollWidth === clientWidth` at **320** and **390** CSS px; none of the
        four new sections may join the overflow list. Chrome will not resize below ~500 px — use a
        same-origin 320/390 px iframe so `matchMedia` reflects the iframe viewport and
        `MD_MEDIA_QUERY` evaluates genuinely false. **A 5 px overflow at 320 px is PRE-EXISTING and
        proven to be Key Statistics' tile** (2.9 Task 9.6) — confirm your sections are not in the
        offenders list rather than trying to fix it. **The 195 px failure is 2.19's — do not
        attempt it.**
        **The measurement is VACUOUS unless you expand first.** `TacticalSection` lazy-mounts its
        children and `buildSectionPlans` opens collapsible sections only at `≥lg`, so at 320 px all
        four of your sections are collapsed shells with no content to overflow. **Expand all four,
        and open every `ViewDataDisclosure`, inside the iframe before measuring `scrollWidth`** —
        the 17-bar chart and the six-column tables are exactly what this check exists to catch.
  - [x] 10.7 **Reduced motion:** `getAnimations({subtree: true})` returns 0. Note that the global
        CSS kill switch does **not** reach recharts' JS-driven animation, which is why
        `isAnimationActive={false}` is hard-coded (Task 6.4).
  - [x] 10.8 **EN toggle after load** and **theme toggle after load**, on all three fixtures. No
        mixed-language page, no hardcoded string, no Spanish leakage under a regex sweep. Number
        formatting must follow the locale in the charts too — recharts labels are formatted by the
        section, not by recharts.
  - [x] 10.9 **Static-output guards:** both `src/app/static-output.test.ts` and
        `src/app/matches/static-output.test.ts` (the AR-11 absence guard over all eleven section
        ids) stay green. If the latter goes red, something moved the Tactical Layer to the
        build-time path — the one change this story must not make.
  - [x] 10.10 **Bundle check.** This story adds the project's second recharts importer. Record the
        `next build` route-size line for `/matches/[slug]` before and after, and confirm recharts
        did **not** land on the critical path (the `import type`-only rule of Task 6.5). If the
        first-load JS grew by anything resembling recharts' ~147 kB gzipped, the split is broken.
  - [x] 10.11 **Full chain green:** `npm run build`, **then** `npm test` (the static-output tests
        read `out/` and stay skipped until it exists). Report the new suite total against the
        post-build **439 / 19** baseline, and say whether the 2.9 review session's patches had
        landed by then.

## Dev Notes

### The measurements, and where they came from

Every figure below was measured at story creation over the **104 staged Extraction Records in
`work/extracted/`** (208 team-innings), the **three committed fixtures**, and the committed
schemas. `work/extracted/` is **gitignored staging** — it is evidence you can re-measure locally,
never a source you may read from `app/`. **Re-derive anything you intend to rely on.**

**Domain C (`#phases`, `#pressing`)**

| | corpus (208 team-innings) | fixtures |
|---|---|---|
| `sum(phasesInPossession)` | min **84**, median **107**, max **149**; ==100 on **5** | **98, 102, 106, 106, 108, 124** |
| `sum(phasesOutOfPossession)` | min **73**, median **87.5**, max **97**; ==100 on **0** | **78, 79, 80, 80, 83, 89** |
| `defensiveBlockDistribution == {highBlock, midBlock, lowBlock}` | **208 / 208** | 3/3 |
| panels printed per possession state | **3** (`build-up-low`/`build-up-mid`/`final-third-phase`; `high-block-press`/`low-block`/`mid-block`) | n/a — the contract carries one pair |
| measures per panel | **3**, including `team_width` (**unmodelled by the contract**) | n/a |
| `line_height` / `team_length` / `team_width` range | 10–71 / 13–51 / 28–60 m | single synthetic values |

The 8 + 9 phases and the block distribution are **REAL** in the fixtures and match the staged
records exactly. The four metre values are **not** — `data/fixtures/README.md`'s "Real" table lists
*"All of Domain C phase percentages (8 in-possession, 9 out-of-possession)"* and nothing else from
Domain C.

**Domain F (`#set-plays`)** — decision 6's table. Corpus totals per team-inning:
`totalSetPlays` 17/**35.5**/64, `totalFreeKicks` 4/13/27, `totalCorners` **0**/4/19, `totalThrowIns`
5/18/34, `totalPenalties` 0/0/2 (min/median/max). **`totalCorners` reaches 0**, so the all-zero
corner branch is live in real data (Task 3.8).

**Domain E (`#goalkeeping`)**

| | corpus (208 team-innings) | fixtures |
|---|---|---|
| `feetTechniques` / `handsTechniques` / `throwTechniques` | **null on 208/208 each** | populated on 6/6 |
| `byBodyType` | **null on 208/208** | populated on 6/6 |
| `crossesFacedCompleted` | **null on 208/208** | populated on 6/6 |
| goalkeepers per team-inning | **1 on 201, 2 on 7** | 1 on 6/6 |
| involvement slots | min **95**, median **102**, max **145** | **19** (m001, m002), **25** (m074) |
| slots in stoppage time | **2,506 of 21,764** | **0** |
| `totalInvolvements − Σ(timeline)` | **0…5**, never negative, ==0 on **59/208** | ==0 on 6/6 |
| team-innings with extra time | 18 | 1 (m074) |

The fixtures' timelines are 5-minute buckets (`0,5,10…90` / `…120`) — evenly spaced, minute-unique,
and summing exactly. **The corpus is none of those three things.** Build to decision 7 and decision
14, not to what you see on screen.

### The `#goalkeeping` contract, in one place

`bundle.goalkeeping` is `GoalkeeperRecord[] | null`, and the schema's own description is the rule
for the empty state: *"An empty array means the pages were present and listed no goalkeeper; null
means there was nothing to read. The App renders those two states differently, so they must never
be collapsed."*

```
GoalkeeperRecord  required: teamId, playerId, playerName, totalInvolvements,
                            involvementTimeline, distribution, goalPrevention, aerialControl
  involvementTimeline  GoalkeeperInvolvementSample[]   { minute: Minute 0-120, involvements: Count }
  distribution         total|feet|hands|throw : CompletionCounts { complete, incomplete, total }
                       feetTechniques (6) · handsTechniques (3) · throwTechniques (4)   ← GATED
                       lineBreaks : Count
  goalPrevention       attemptsFaced · savePercentage · totalInterventions
                       byInterventionType (5)     sums to attemptsFaced
                       byBodyType (5)             sums to totalInterventions            ← GATED
  aerialControl        totalInterventions · punches|claims|tippedPalmed : CompletionCounts
                       crossesFacedAttempted · crossesFacedCompleted                    ← GATED
                       deliveryTypesFaced : CrossDeliveryTypeCounts (6 + total)
```

`teamId` / `playerId` / `playerName` are `required` and **unfulfillable from the source** (Story
1.9, AD-14 (a)). They are populated in the fixtures and will be whatever Story 1.16 decides. This
story reads `teamId` (needed for grouping and correct on any emission) and `playerName` (as context
only) and **never keys anything on `playerId`**.

### The recharts contract — every rule has a named failure behind it

Taken from `MomentumChart.tsx`, the project's only shipped recharts consumer. These are not style
preferences:

- **`accessibilityLayer={false}`** — it defaults to **true** in v3 and installs `role="application"`
  on the container plus its own `tabIndex` and arrow-key handler. Three direct collisions with the
  `role="figure"` panel and the section's own keyboard contract.
- **`isAnimationActive={false}`** — the global `prefers-reduced-motion` CSS kill switch does not
  reach recharts' JS-driven animation.
- **Explicit `ticks` and `domain`** — decision 9. Also: *"a single-sample series is contract-legal
  and would otherwise give the degenerate domain `[0, 0]`, which recharts cannot scale."* Floor
  every domain.
- **Colours as `var(--token)` presentation props, not Tailwind utilities** — *"Tailwind `fill-*`
  utilities do not reliably reach recharts' internally-rendered `<text>`."*
- **Tick text via `{ className: "type-caption tabular-nums", fill: "var(--ink-secondary)" }`** —
  `type-caption` deliberately carries no `font-variant-numeric`, so the tabular half of DESIGN's
  mandatory pairing comes from the Tailwind utility.
- **No `<Tooltip>`** — hover-only, banned outright by UX-DR15 / `EXPERIENCE.md:103` (*"no
  hover-only information, ever"*). **No `<Legend>`** — decision 10(a) requires direct labels.
- **Axis titles via `<Label>`, never `name`** — *"recharts' `name` prop feeds the tooltip and legend
  payloads ONLY … so the axis titles previously reached no surface at all: not the screen, not the
  accessibility tree."*
- **The `ResponsiveContainer` parent MUST have a resolved height** — *"a height-less one renders
  nothing at all, which is recharts' single most common failure mode."*
- **Paint order is not declaration order** in recharts 3.4+ — `ReferenceDot` / `ReferenceLine` are
  portalled into z-indexed layers (`area=100, line=400, axis=500, scatter=600`). Declaration order
  still decides **within** one layer and is still DOM order, therefore **tab order**.
- **The i18n ESLint gate does not reach recharts**, because recharts delivers text through
  object-shaped props. Every text value in `TacticalCharts.tsx` must be a pre-resolved identifier
  **by discipline, not enforcement**.

### What already exists — reuse it, do not rebuild it

- **`sectionDataState` needs no change.** All four ids are already handled correctly, and the
  docblock already explains why the three required objects *"genuinely READ their field rather than
  returning a literal `\"ready\"`"*. This is the first Tactical story since 2.5 that touches
  `tactical-sections.ts` **not at all**. Add assertions (Task 8.3); change nothing.
- **All four section ids already exist** in `SectionId`, `SECTION_IDS`, `COLLAPSIBLE_SECTION_IDS`,
  and **both locale files with title and summary** — including the LatAm `"Arqueros"`. This story
  adds no ids and changes no order.
- **`TacticalLayer`'s empty-state override mechanism** (`EMPTY_HEADLINE_OVERRIDE` /
  `EMPTY_EXPLANATION_OVERRIDE`) exists and **this story needs neither.** The generic *"El informe
  oficial no incluye esta sección."* is **TRUE** for all four: a `null` `goalkeeping` means the
  report does not carry the goalkeeping pages, and the other three are only ever absent from a
  truncated payload. Do not add overrides you do not need — 2.9 added them because a Domain G
  absence is not a receiving absence, which does not apply here.
- **`ViewDataDisclosure`** gives you the canonical "Ver los datos" control, the `aria-controls`
  lifecycle, the internal scroll container and the `canvas` ink variant. Its `panelTitle`
  disambiguates the accessible name; its `trailing` slot holds the attribution caption where it
  survives a screenshot taken with the table closed.
- **`MomentumSection`'s private `DataTable`** is the canonical table shape (caption, `scope="col"`
  headers with a `numeric` flag, `border-hairline` rows, `type-table-numeric` right-aligned
  numeric cells). Copy it per section; do not extract it.
- **`@/lib/format`** is the only formatting path and **throws on non-finite input** — handle `null`
  before calling it. `formatPercent` takes **percent points** (62 → `"62%"`, no space in Spanish,
  a deliberate logged choice against RAE spacing).
- **`resolveSide`, `sideRank`** in `marker-model.ts` — the one place a stray `teamId` fails loud.
- **`CROSS_DELIVERY_TYPES` / `crossDeliveryKey`** and `enums.crossDelivery.*` from Story 2.7 —
  reuse for `deliveryTypesFaced`.
- **`countPhrase(count, one, many)`** is **NOT exported from anywhere** — it is a private
  four-line function redeclared identically in six shipped sections (`MomentumSection`,
  `ShotMapsSection`, `PassNetworksSection`, `OffersToReceiveSection`, `MovementToReceiveSection`,
  `DefensiveActionsSection`). Copy the body into each of your four; do not try to import it and do
  not extract it.
- **The generated-type name traps.** `contract-types.d.ts` carries tournament-level twins with
  near-identical names: `AggregateInPossessionPhases`, `AggregateLineHeight`, `AggregateTeamLength`
  are **not** this story's shapes. Import through `TeamTacticalIdentity`:
  `phasesInPossession: InPossessionPhases`, `phasesOutOfPossession: OutOfPossessionPhases`,
  `lineHeight` / `teamLength: PossessionSplitMetres`. In `TeamSetPlays`, `cornersBySide` is
  `TeamCornerSideCounts` while each `cornersByDeliveryType` member is `CornerSideCounts` —
  structurally identical, different names, and the wrong one still compiles.
- **`useElementWidth(fallbackPx)`** returns a **callback ref**, not an object ref.

### The i18n gate — six prior reviews paid for these

- `t()` has **no interpolation and no plural machinery**. Counters need a singular **and** a plural
  key.
- `{t(cond ? "a" : "b")}` **fails the gate**. Hoist the key into a `const … : DictionaryKey`.
- A **template literal inside a gated prop** fails the gate **even when every fragment is a `t()`
  call**. Hoist captions and composed labels into identifiers first.
- Separator glyphs and any `▲`/`▸`-class mark are **module consts**, never bare JSX literals.
- **16 prop names are gated** by `no-restricted-syntax`, and only when the attribute value is a
  literal: `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`,
  `aria-braillelabel`, `aria-valuetext`, `title`, `alt`, `placeholder`, `label`, `message`, `text`,
  `description`, `caption`, `heading`, `tooltip`. That is why the house names are `figureSummary`,
  `metaLine`, `zeroLine`, `headline`, `explanation`, `panelTitle`, `labelText`, `valueText`.
  **Name your new props from that set.**
- `en.ts` must mirror `es.ts`'s key shape **exactly**, with no empty leaves.
- `viz.table.caption` is literally `"Ordenado por minuto."` — legitimate for the involvement
  timeline's table, **false** for every other table in this story.

### Project Structure Notes

- `src/viz/**` is **pure**: no React, no DOM, no `t()`, no `@/lib/format`. It returns
  `DictionaryKey`s and raw numbers; components resolve them. That split is the only reason any of
  this is testable in a node-only harness.
- **Client route bodies live in `src/components/`, never colocated under `src/app/`** — that path
  escapes the i18n import seam (a known deferred gap; do not trigger it).
- PascalCase component files in `src/components/`; kebab-case pure modules in `src/viz/`. Tests
  co-located as `<module>.test.ts`.
- Naming follows the registry key: `phases` → `PhasesSection.tsx`, `set-plays` →
  `SetPlaysSection.tsx`, and so on.
- **Heading levels.** `TacticalSection` owns the section `<h2>` and puts `tabIndex={-1}` on it for
  the anchor-focus contract. Your components render **no heading at all** — the shipped precedent
  across `MomentumSection`, `OffersToReceiveSection` and `MovementToReceiveSection` is a subtitle
  `<p className="type-stat-label text-ink-secondary">`. `MomentumSection` words the ruling as
  *"would put a sentence that is not a section name into the page outline"*;
  `OffersToReceiveSection` restates it as *"a non-section-name into the page outline (MomentumSection's
  ruling)"*. A team code is a label, never a heading.
- The section `<section>` is already a **named region landmark** via `aria-labelledby`. Do not add
  `role="region"` to anything — that produced duplicate landmarks and an `axe` failure once already.

### Scope boundaries

**Touch:** `app/src/viz/phases-model.ts`, `set-plays-model.ts`, `goalkeeping-model.ts` (+ tests);
`app/src/components/TacticalCharts.tsx`; `app/src/components/PhasesSection.tsx`,
`PressingSection.tsx`, `SetPlaysSection.tsx`, `GoalkeepingSection.tsx`;
`app/src/components/TacticalLayer.tsx` (**four dispatch cases, additive only**);
`app/src/lib/tactical-sections.test.ts` (**assertions only — the module itself does not change**);
`app/src/locales/{es,en}.ts`; `app/src/lib/i18n.test.ts`; `deferred-work.md`; `sprint-status.yaml`;
this story file.

**Do not touch:** `pipeline/**` (a 1-15 session is writing it right now), `contract/**`, `data/**`,
`app/src/lib/contract/**` (generated), `app/src/lib/tactical-sections.ts` (**the source module** —
no predicate change is needed and none is authorised), `TacticalSection.tsx`,
`MatchBundleRegion.tsx`, `TacticalErrorBoundary.tsx`, `EmptyStatePanel.tsx`, `PitchPanel.tsx`,
`ShotMapsSection.tsx`, `PassNetworksSection.tsx`, `KeyStatisticsSection.tsx`,
`OffersToReceiveSection.tsx`, `MovementToReceiveSection.tsx`, `DefensiveActionsSection.tsx`,
`MomentumSection.tsx` / `MomentumChart.tsx`, `momentum-model.ts`, `marker-layout.ts`,
`pitch-geometry.ts`, the layout / providers / bootstrap / storage / format modules, and the
vendored `ui/*` components.

**Do not build here:** sortable tables, `aria-sort`, the collator sort, the Expert-layer tables and
logs (**2.11**); glossary tooltips (**2.18**); the real-data swap, Lighthouse/axe runs, the 195 px
reflow (**2.19**); the heatmap (2.9's decision 12, re-opened at 1.16); the mirrored goal furniture
(2.9's decision 9); a per-section error boundary (decision 18).

**Do not add:** jsdom, Testing Library, a state library, a client cache, a new React Context, or
**any** runtime dependency. recharts 3.10.1 is installed and is the only chart library.

**Do not "fix":** the `≥lg` heading `<button aria-expanded>` — correct, ruled and tested (2.5
review D1); `m002`'s `momentum: null`; the private `DataTable` copies; the
`PitchMarker.minutePrefixKey` naming drift; the 320 px Key Statistics overflow; the in-flight
pipeline changes in the working tree.

### Known-open items that are NOT this story's

- **The whole-layer error boundary.** Pre-existing architecture; re-file it (Task 9.6), do not
  rebuild it.
- **`tactical-sections.ts` classifies `momentum: undefined` as `"ready"`.** The `!== null` shape is
  worth auditing across all eleven predicates — but this story changes **no** predicate. Note that
  your four use truthiness (`bundle.tacticalIdentity ? …`) or `!== null` (`goalkeeping`), and the
  truthiness form already handles `undefined` correctly.
- **`ShotLogRow.minute`'s `?? 0`** contradicting `orderByMinute` → 2.11.
- **Breakpoint-crossing focus loss** and **hash re-entry's three unhandled paths** → deferred, both
  need rulings this story does not have.
- **CS-1** does not touch anything this story reads. Every AD-14 item this story files rides the
  **successor** change-set.

### Coordination & hygiene

**`app/` IS HOT AGAIN, and the state changed DURING story creation — re-derive it at Task 1.4
rather than trusting this paragraph.** Story 2.9's implementation is **committed** at `3cf4237`
(so the creation prompt's premise that 2.9 held uncommitted `app/` files was stale), but a **2.9
CODE-REVIEW session began writing `app/` while this story was being written**. Measured at the end
of story creation, HEAD `325dc2b`, uncommitted:

- **`app/` (9 files, the 2.9 review session):** `components/{DefensiveActionsSection,
  MovementToReceiveSection,OffersToReceiveSection}.tsx`, `lib/i18n.test.ts`,
  `locales/{es,en}.ts`, `viz/{defensive-actions-model.ts,defensive-actions-model.test.ts,
  marker-model.test.ts,receiving-model.ts,receiving-model.test.ts}`.
- **`pipeline/**` (the 1-15 review session)** — not your files.
- **Both shared artifacts**, plus `2-9-…md` and `1-15-…md`.

**Consequences, and they are not optional:**

- **`git add app/` is now DANGEROUS** — it would sweep another session's uncommitted 2.9 review
  patches into your commit. **Stage explicit file paths only**, from your own File List. Never
  `git add -A`, and never `git add app/`.
- **Three of those nine files are ones you also edit**: `locales/es.ts`, `locales/en.ts` and
  `lib/i18n.test.ts`. Expect them to move under you. **Every edit to them is APPEND-ONLY**, and
  cite by quoted anchor phrase, never by line number — the 2.6 drift lesson.
- **Re-run `npm test` after the 2.9 review session lands**, not only at Task 1.1: its patches touch
  `receiving-model.ts` and `defensive-actions-model.ts`, whose tests share your suite.
- **Every shared-artifact edit is APPEND-ONLY.** `deferred-work.md` was 537 lines at `325dc2b` and
  is **614** as of story creation — four sessions have appended to it inside two days.
- `deferred-work.md` line numbers **drift**. Every ledger citation in this story is a
  `grep "<quoted phrase>"`; if a number disagrees, trust the phrase.
- Co-commits have happened in **both** directions and both were caught by review. If your commit
  carries any in-flight 1-15 lines, **disclose it in the Completion Notes** — an undisclosed
  co-commit *"is how a reviewer loses the ability to tell which story changed what"*.
- Commit directly to `main` (solo repo); no feature branch, no PR.

### References

- `epics.md:823-835` — Story 2.10's ACs, reproduced verbatim above. `epics.md:100-126` — the
  UX-DR rules (they live in `epics.md`, **not** in DESIGN.md or EXPERIENCE.md): UX-DR2 (:105),
  UX-DR6 (:109), UX-DR7 (:110), UX-DR10 (:113), **UX-DR11 (:114)**, UX-DR12 (:115), UX-DR13 (:116),
  UX-DR15 (:118), UX-DR16 (:119), UX-DR17 (:120), UX-DR18 (:121), UX-DR19 (:122), UX-DR21 (:124).
- `contract/match-bundle.schema.json` — `TeamTacticalIdentity`, `InPossessionPhases` (the
  never-normalize `description`), `OutOfPossessionPhases`, `PossessionSplitMetres`,
  `DefensiveBlockDistribution` (the `$comment` naming this story), `TeamSetPlays`, `FreeKickCounts`
  (the corpus-false `description`), `GoalkeeperRecord`, `GoalPrevention` (the two-denominators
  `description`), `AerialControl`, `GoalkeeperInvolvementSample`.
- `contract/common.schema.json` — the fourteen enums of decision 16, and `Minute` / `StoppageMinute`.
- `contract/README.md` §5 (phases are independent rates, with the corpus sums), §6
  (`defensiveBlockDistribution` mirrors three phase values), **§14** (*"Corners carry a team-level
  side split"* — why `cornersBySide` is precomputed and must never be summed by the App); the
  Story 2.3 sign-off's
  PASS-with-note row naming this story: *"renderers in 2.10/2.16 must never sum, normalize, or pie
  these"*.
- `data/fixtures/README.md` — the Real vs Synthetic tables. Domain C phases **real**; Domain E
  goalkeeping **synthetic in full**; free-kick and corner **splits synthesised so that they add up
  to those totals**.
- `deferred-work.md` — grep `"AD-14 (d): re-scope notice for Story 2.10"`,
  `"GoalkeeperRecord\` is per-keeper"` (1.9 AD-14 (a)),
  `"three documented absences"` (1.9 AD-14 (c)),
  `"FreeKickCounts\`' nesting"` (1.9 AD-14 (b)),
  `"the line-height/team-length pages are per-phase panels"` (1.7),
  `"non-uniform and omit zero"` (2.6 — filed against **2.10 by name**),
  `"kills all eleven Tactical sections"` (2.8 review, open and unpatched),
  `"The involvement series consistently plots fewer involvements"` (1.9),
  `"The involvement clock's stamps are staged per slot"` (1.9 Decision 3),
  `"invalidated Story 2.6's slider AC"` (1.8 — decision 7's direct precedent).
- `DESIGN.md:260` (one meaning per colour per viz), `:266` (the two-team contrast pair, the Team B
  dash/pattern rule, and **"phases-of-play" named as a head-to-head family**), `:282` (heat and
  edge-weight ramps are theme-invariant and pitch-only), `:301` (tabular numerals mandatory),
  `:303` (11 px type floor), `:333` (stat tile + leader glyph), `:337` (data table, zebra striping
  never), `:340` (empty-state panel), `:342` (the Momentum Timeline as the only recharts component
  spec — **there is no DESIGN spec for a bar/distribution panel**).
- `EXPERIENCE.md:45` (anchors), `:91` (empty-state copy), `:113` (accessibility floor — every
  recharts viz has a data-table alternative), `:139` (Spanish expansion at 11 px ALL-CAPS),
  `:166` (UJ-2's climax is *"the opponent's mid-block share"* — this story's `#pressing`),
  `:174` (UJ-3's line heights and block distribution), `:206` (the eleven-section order; these four
  are positions 8–11), `:223-225` (the Visualization Layering rows), `:241`/`:243`-`:246`/`:255`/
  `:258`/`:261`-`:263`/`:268` (the ruled terms), `:278` (the procedure for minting new ones).
- `ARCHITECTURE-SPINE.md:70-74` (AD-5 and its narrow carve-out), `:82-86` (AD-7 — enum codes, and
  *"Units are locale-layer metadata keyed by metric code, never artifact strings"*), `:104` (AD-10),
  `:110` (AD-11), `:116` (AD-12), `:124-128` (AD-14), `:140` (the data-table Consistency
  Convention).
- `review-accessibility.md:27` — the finding that created UX-DR11's dash/pattern clause, naming
  *"the recharts 'Phases-of-Play comparison,' pressing, and Defensive Blocks"* as the surfaces that
  specify no direct labels or pattern rule. `:53` (320 px reflow).
- `review-i18n.md:11` (**critical** — `recuperaciones forzadas`, never bare *"pérdidas forzadas"*),
  `:13` (line height), `:17` (team length), `:26` (the whole goalkeeping domain had zero
  terminology coverage), `:45` (text expansion at 11 px).
- Mockups: `key-match-dashboard-mobile.html:346-361` gives the **collapsed-shell** headline and
  summary for all four sections. `key-match-dashboard-desktop.html` contains **none of the four** —
  there is **no expanded-state visual reference for any of these sections at any width**. Design
  them from the tokens and the shipped precedents; *"mocks illustrate, spines win on conflict."*
- `2-9-receiving-defensive-action-maps-heatmap-decision.md` — the in-story re-scope precedent, the
  card-section template, the frozen-enum-list pattern, the segmented-bar-without-a-ramp ruling, and
  the whole-layer-boundary guard discipline.
- `2-6-momentum-timeline.md` — the recharts precedent, the code-split, the explicit-tick fix, the
  `surface="canvas"` variant, and the index-not-minute ruling this story's decision 7 repeats.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5[1m])

### Debug Log References

Baseline (Task 1), **re-measured, not inherited**: `npm test` **447 passed / 19 files / 0 skipped**
— higher than the story's stated 419-or-439 because the 2.9 code-review session's tests had landed,
and 0 skipped because `app/out/` was already populated. `npm run check:types` green (237
declarations from 6 schemas), `npm run assert:schema-version` green (7 artifacts at schemaVersion
2), `npm run build` green at HEAD `163fa20`.

**The coordination warning was stale and re-deriving it mattered (Task 1.4).** The story predicted
nine uncommitted `app/` files from an in-flight 2.9 review session plus a dirty `pipeline/**`. Both
had landed — `2018885` (2.9 review) and `163fa20` (1.15 review) — so the working tree held only this
story file. `git add app/` was therefore never dangerous in this session, but explicit paths were
staged anyway: an unrelated `2-11-…md` appeared untracked mid-session from another session and is
**not** in this commit.

Final: **555 passed / 22 files**, `npm run build` green, `eslint . --max-warnings 0` clean
(including the i18n gate), `tsc --noEmit` clean.

### Completion Notes List

**What shipped.** All four remaining Tactical sections. `PendingSectionPanel` has zero call sites
and **all eleven sections now render real content** — the Tactical Layer is closed.

- **Three pure models** (`phases-model.ts`, `set-plays-model.ts`, `goalkeeping-model.ts`) + tests,
  **one recharts leaf** (`TacticalCharts.tsx`, the project's second recharts importer), **four
  section components**, four dispatch cases in `TacticalLayer.tsx`, and the locale layer.
- **+108 tests** (447 → 555). No regressions.

**Ruled decisions, as implemented.**

- **D2/D3 — `#goalkeeping`.** Team-grouped blocks ordered from `metadata`, keeper names as context,
  both records rendered and nothing summed for the two-keeper case (constructed input, since no
  fixture carries it). The five corpus-null fields are gated through **one** widened view type
  (`CorpusNullableGoalkeeperRecord`) cast **once** at the model entry point — no casts scattered
  through components. A closed gate omits its panel and the block says once that it did.
- **D4 — the Domain C split**, including the amendment: `#pressing` renders the four press rates as
  well as the blocks and metres. The duplication is pinned by a test asserting both sections print
  the *same* contract fields rather than recomputing.
- **D6 — set plays.** Four flat free-kick siblings, corner STYLE as independent counts, corner SIDE
  (from the precomputed `cornersBySide`) and corner TYPE as segmented bars whose denominator is the
  **sum of the rendered segments** with `totalCorners` printed verbatim beside it.
- **D7/D9/D14 — the involvement timeline.** Index-keyed axis, minute as a label deduped by value,
  explicit always-includes-zero ticks from pure property-tested functions, `totalInvolvements`
  printed verbatim, and the two-table disclosure.
- **D16 — fourteen frozen enum lists**, each a `Record` over the generated union (never a bare
  array), each with an `as DictionaryKey` key builder, each pinned by an i18n exhaustiveness
  assertion in both locales.

**Departures and judgement calls, all deliberate.**

1. **Tasks 3.4 and 7.3 say the two `direct*` free-kick rows are "visually subordinate" / indented;
   ruled decision 6 forbids exactly that** ("no indentation or other containment cue"), and the
   Change Log records the validation pass replacing the indent with flat rows. **Decision 6 wins** —
   the task text is pre-validation wording. The `subordinate: boolean` flag Task 3.4 asks for is
   still carried **as data** (the contract does claim the nesting), with a loud docblock at the
   point of temptation stating it must never become a containment cue, and the component renders
   four flat siblings.
2. **Decision 10(b) — the hatch ships, not the fallback**, decided in the browser as ruled and
   recorded in `deferred-work.md`. Method validated first by reproducing published figures exactly
   (team A **13.56** dark / **4.99** light, team B **10.30** / **5.36** on `--surface-raised`). The
   hatch stripe against its own ground measures **3.30 light / 1.53 dark** — but decision 10(b)
   states that with a *solid* ground "the measured solid figures … govern, and the hatch only adds
   texture", and WCAG 1.4.11's 3:1 floor governs the mark against its background (10.30 / 5.36,
   passing), not a mark's internal texture. The remaining test was legibility, and the hatch is
   clearly legible in both themes and at 320 px. **Recorded for the successor stories:** the
   declared dashed-stroke fallback **cannot work on a filled bar at all** (a dashed team-b stroke
   over a solid team-b fill is invisible — the same observation that made the hatch necessary), so a
   future story needing a fallback must rule a new mechanism.
3. **A wrapping category-axis tick was added** (`wrapAxisLabel`, pure and unit-tested). recharts
   renders an axis tick as one `<text>` with no wrapping and no truncation, so the longest Spanish
   label ("Salida de balón sin presión", 27 chars ≈ 140 px at the 11 px floor) would have run off a
   320 px SVG. Not in the task list; without it Task 10.2's legibility check fails.
4. **Task 10.10's "route-size line" could not be recorded as written** — this Next 16 / Turbopack
   build prints no size columns. The substantive claim was verified structurally instead: **no chunk
   containing recharts is referenced by the match page's initial HTML** (15 initial chunks, 855 KB
   uncompressed). **A first attempt at this check was vacuous** — it grepped for `victory-vendor`,
   a string absent from the whole bundle, so it would have "passed" no matter what; re-run with a
   marker that actually appears. That re-run surfaced a real finding, filed to the ledger: the two
   `dynamic()` entry points produced **two 300.4 KB recharts vendor chunks** instead of sharing one,
   so a reader opening both `#momentum` and `#phases` downloads recharts twice. Off the critical
   path, so the story's requirement holds; not fixed here because the remedy touches
   do-not-touch files.
5. **`app/out/` is a build artifact and is gitignored** — the verification ran against it but it is
   not in this commit.

**Verification (Task 10), all against `python -m http.server 8765 --directory app/out`.**

| Check | Result |
|---|---|
| Four sections render, all three fixtures, both themes | pass |
| Zero tick on **every** axis (the 2.6 finding, filed against 2.10 by name) | pass — incl. m074's extra-time axis `0…120` |
| No `<Tooltip>`, no `<Legend>`, no `role="application"` | pass, 0 of each |
| Focusable nodes inside the charts | **0** (the 24 `tabindex="-1"` nodes are recharts' own z-index layers) |
| `role="figure"` + localized summary per team block | 12 figures across the four sections |
| Running animations inside the four sections | **0** (4 elsewhere on the page, pre-existing) |
| EN toggle after load, Spanish-leakage regex sweep | pass, no leakage |
| Reflow 320 px, all four expanded **and every disclosure opened** | 7 px document overflow, **0 offenders from these sections** — both are the pre-existing stat tile (`97,1 RSA`), matching 2.9 Task 9.6 |
| Reflow 390 px, same procedure | `scrollWidth === clientWidth` (371), **0** offenders |
| Contrast, method validated by reproducing published figures first | all four published values reproduced exactly |
| Static-output guards (incl. the AR-11 absence guard over all eleven ids) | green |

**Honest limits.** No live screen reader is available in this harness — the structural pass read
roles, labels and strings back from the live DOM in both locales, which is not the same thing. The
`<md` checks used a same-origin 320/390 px iframe because Chrome will not resize below ~500 px;
`matchMedia` was confirmed genuinely false for both `md` and `lg` inside it. The 195 px reflow is
2.19's and was not attempted.

### File List

**Added**
- `app/src/viz/phases-model.ts`
- `app/src/viz/phases-model.test.ts`
- `app/src/viz/set-plays-model.ts`
- `app/src/viz/set-plays-model.test.ts`
- `app/src/viz/goalkeeping-model.ts`
- `app/src/viz/goalkeeping-model.test.ts`
- `app/src/components/TacticalCharts.tsx`
- `app/src/components/PhasesSection.tsx`
- `app/src/components/PressingSection.tsx`
- `app/src/components/SetPlaysSection.tsx`
- `app/src/components/GoalkeepingSection.tsx`

**Modified**
- `app/src/components/TacticalLayer.tsx` (four dispatch cases; dead `PendingSectionPanel` import removed)
- `app/src/locales/es.ts` (append-only: four `viz.*` namespaces, fourteen `enums.*` namespaces, `viz.table.*` columns, `enums.unit.m`)
- `app/src/locales/en.ts` (same, mirrored exactly)
- `app/src/lib/i18n.test.ts` (append-only: three exhaustiveness suites)
- `app/src/lib/tactical-sections.test.ts` (append-only: the two missing empty-branch assertions)
- `_bmad-output/implementation-artifacts/deferred-work.md` (append-only: ten entries)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-10-phases-pressing-blocks-set-plays-goalkeeping-sections.md`

**Unchanged, and confirmed so (Task 8.2):** `app/src/lib/tactical-sections.ts`. All four predicates
were already correct; no predicate change was needed or authorised. Assertions were added to its
test only.

**Minted Spanish terms (Task 8.6), under EXPERIENCE.md:278's procedure.** Ruled rows reused
verbatim: *presión*, *bloque alto/medio/bajo*, *altura de la línea defensiva*, *longitud del
equipo*, *fases del juego*, *salida de balón*, *contrapresión*, *balón parado*, *tiro de esquina*,
*arquero* / *Arqueros*, *atajada*, *distribución*. Newly minted: *tiro libre directo* / *directo al
arco* / *directo desviado* / *tiro libre indirecto* (self-standing, because the four render flat);
*saque de banda*, *penal*; *prevención de gol*; *juego aéreo*; *participación(es)*; *tipo de envío*
/ *estilo de envío*; *rupturas de líneas*; *% de atajadas*; *remates enfrentados*; *repliegue*
(out-of-possession `recovery`); *saque con el pie* / *saque de volea* / *saque con la mano*;
*despeje de puños* / *descuelgue* / *desvío con la mano*; *bote pronto*; plus decision 3's
gate-disclosure sentence, decision 7's axis sentence and decision 14's two table captions. Corner
delivery STYLE deliberately reuses Story 2.7's cross-delivery adjectives (*cerrado / abierto / tenso
/ bombeado*) so one delivery shape has one Spanish name across the app.

## Change Log

| Date | Change |
|---|---|
| 2026-08-03 | Story context created. Four rulings taken by Juan at creation: `#goalkeeping` re-scoped to team-grouped blocks with presence gates over five corpus-null required sub-blocks (decisions 2, 3); `lineHeight`/`teamLength` render with the provenance gap filed to 1.16 (decision 5); `#phases` takes all 17 phase rates and `#pressing` takes blocks + metres (decision 4); set plays bars the two corpus-false partitions and uses the three corpus-true ones (decision 6). Status backlog → ready-for-dev. |
| 2026-08-03 | Validation pass, three fresh-context subagents (evidence audit, checklist/implementability, adversarial decision review). ~180 factual claims audited: 3 corrected (fixture phase-sum ranges, `totalSetPlays` median, `contract/README.md` §13 → §14 and `cornersBySide` named), 8 imprecisions tightened. Seventeen implementability gaps closed, four of them build-breaking (the `Record`-not-array frozen-list shape, the `as DictionaryKey` cast on all fourteen key builders, the three-level nested `CorpusNullableGoalkeeperRecord` widening, and the `dynamic()` named-export call form). Eleven adversarial findings ruled: flat free-kick rows replace the containment-implying indent, the involvement axis gets a dedupe rule and a stated meaning, decision 14 gains a two-table disclosure, decision 3 gains a ruled gate-disclosure sentence, decision 11 is re-grounded structurally, decision 10(b) gains a solid ground and a 3:1 forcing floor, decision 8 gains a segment-sum denominator, and the "no record for this team" trap 2.9's review patched is pinned. **Decision 4 amended by Juan: `#pressing` also takes the four press rates**, because the shipped `<lg` collapsed-shell copy promises pressing intensity. Coordination section rewritten — a 2.9 code-review session began writing `app/` (nine files, including both locale files) during story creation, so `git add app/` is now unsafe. |
| 2026-08-04 | Implemented. Three pure models (`phases-model.ts`, `set-plays-model.ts`, `goalkeeping-model.ts`), one new recharts leaf (`TacticalCharts.tsx`, the project's second recharts importer), four section components, four `TacticalLayer` dispatch cases, and the locale layer (four `viz.*` + fourteen `enums.*` namespaces in both locales). Suite 447 → **555 passed / 22 files**, no regressions; build, lint and typecheck green. **All eleven Tactical sections now render real content and `PendingSectionPanel` has zero call sites** (component and keys kept, call routed to 2.11). Two documented departures: the two `direct*` free-kick rows render FLAT, since ruled decision 6 forbids the containment cue Tasks 3.4/7.3 still described (the `subordinate` flag is kept as data only); and a pure `wrapAxisLabel` helper was added because recharts does not wrap axis ticks, without which the 17 Spanish phase labels overrun a 320 px SVG. Decision 10(b) resolved in the browser: **the diagonal hatch ships**, on the decision's own reading that a solid ground makes the mark-vs-card figures (10.30 dark / 5.36 light, both reproduced exactly) govern — recorded alongside the finding that the declared dashed-stroke fallback cannot work on a filled bar at all. Reflow clean at 320 and 390 px with every section expanded and every disclosure open (the only 320 px overflow is the pre-existing stat tile). Ten entries appended to `deferred-work.md`, including the recharts vendor chunk being duplicated (300.4 KB x2) across the two `dynamic()` entry points — off the critical path, so the split holds. Status ready-for-dev → review. |

## Review Findings

Adversarial code review, 2026-08-04 — three parallel layers (Blind Hunter, Edge Case Hunter,
Acceptance Auditor) over the 2.10-scoped diff `163fa20..892766c` (19 files, +8370/-3; 6837 diff
lines under `app/`). The range is this story's own commit, deliberately **not** `325dc2b..HEAD`:
the baseline is two commits back and the intervening 1.15 and 2.9 review commits would have swept
~2,100 lines of `pipeline/` changes into scope. Every finding below was re-verified against the
shipped tree before triage; three were dropped as noise.

**The toolchain baseline was re-measured independently, not inherited from the Dev Record, and all
four green claims hold:** `npm test` 555 passed / 22 files, `check:types` up to date (237
declarations / 6 schemas), `eslint . --max-warnings 0` clean, `tsc --noEmit` clean. No finding
below is a build, lint or type failure.

**The Acceptance Auditor cleared the scope boundary and both declared departures.** No file on the
"Do not touch" list was modified; `tactical-sections.ts` is genuinely unchanged (Task 8.2);
`PendingSectionPanel` and `tactical.pending.*` survive with zero call sites (decision 20); Task 9's
ten ledger filings and the sprint-status line are present. The two declared departures are real as
described — the four free-kick rows render flat with `subordinate` carried as data only, and
`wrapAxisLabel` is pure and unit-tested. Decision 10(b)'s hatch ships over a solid ground with
`TEAM_B_DASH_ARRAY` correctly not imported.

Three layers converged independently on the empty-involvement-timeline string; three on the
skeleton-height drift; two on the dropped goalkeeping tables, the shared corner caption, and the
unconsumed metre-unit map.

**The headline finding is a decision-19 / AC-3 gap, not a crash:** `#goalkeeping` displays roughly
thirty numbers on screen and carries three tables behind "Ver los datos". The two caption keys the
story minted for the missing tables — `viz.goalkeeping.distributionCaption` and `aerialCaption` —
exist in both locales with **zero call sites**, which is the receipt that the work was planned and
dropped rather than reasoned away.

### Code-review session halted mid-patch — concurrent rewrite of `app/` (2026-08-04)

**Ruled by Juan: pause, keep what landed, re-review the rest later.**

Six patches were applied and then this session **stopped deliberately**, because a concurrent
session rewrote `app/` underneath it while the patches were being written. At the moment of the
halt the working tree carried **33 modified files and 16 untracked ones**, none of them this
review's: Stories **2.11a** (the sortable data-table contract), **2.11b**, **2.11c** and **2.18**
(glossary) are all in flight, with file mtimes still advancing during the session.

**The decisive change is 2.11a.** `DataTable` has been **extracted** into a shared
`app/src/components/DataTable.tsx` carrying a `TableColumn` / sort contract, and all ten sections
now import it. Story 2.10's Task 7.6 ruled the opposite (*"a private `DataTable` copy per section is
the **current convention**… do **not** refactor `DataTable` out of any shipped file"*), so this
review's dismissal of the nine-copies finding was correct against 2.10's spec and is now obsolete
against the tree. Nothing needs re-litigating; it simply means the table findings must be
re-derived, not re-argued.

**What that invalidates.** Every table-shaped finding below was written against private per-section
`DataTable` copies taking `caption` / `headers` props. That shape no longer exists — the sections
now build `columns: TableColumn<Row>[]`. Specifically **not applied, and requiring re-derivation
before anyone acts on them**:

- the `#goalkeeping` dropped-tables rebuild (the file has since been rewritten and already carries
  `summaryColumns` / `timelineColumns` / `preventionColumns`; whether the distribution and aerial
  tables are still missing is a fresh question);
- the two set-plays tables sharing `cornerCaption`;
- `viz.table.slot` naming two different quantities;
- the 1-decimal table-percentage fix (the `render` callbacks moved into the column definitions).

The remaining unapplied patches are **not** table-shaped and should still hold as written: the
keeper React key, `anyGateClosed`'s over-firing, the `zeroAll`/`zeroTimeline` string, the
`totalInvolvements` in `chartSummary`, the metre `unitKey`, the technique-panel labels, the
unlabelled `completionList` total, the partition-mismatch note, and the test order dependency.

**Verification at the halt, against the combined tree:** `npm test` **609 passed / 24 files**,
`tsc --noEmit` clean. The six applied patches are coherent with the concurrent work and broke
nothing. **Nothing was committed** — staging any of this would have produced exactly the
undisclosed co-commit the Coordination section warns about (*"how a reviewer loses the ability to
tell which story changed what"*).

**Owed before this story returns to `review`:** the remaining unapplied patches, the D1 browser
re-verification, and a fresh diff for the table findings once 2.11a/2.11b/2.11c/2.18 are committed
and the tree is stable.

**Second pass, same session (ruled by Juan): the HIGH finding was cleared.** With the concurrent
session idle and `goalkeeping-model.ts` / `set-plays-model.ts` confirmed untouched since HEAD, four
more patches were applied — the `#goalkeeping` disclosure rebuild plus the three model-only fixes.
The rebuild was written **against 2.11a's `TableColumn` contract**, not against the private
`DataTable` copy the finding originally described, and it is **additive**: four new tables beside
their three, no restructuring of the concurrent session's work. Verified on the combined tree —
`npm test` **627 passed / 24 files**, `tsc --noEmit` clean, `eslint . --max-warnings 0` clean.
**Still nothing committed.**

**THIRD PASS — all 21 patches are now applied.** Ruled by Juan: proceed despite the concurrent
session. Every remaining patch was applied against the CURRENT tree, re-reading each file
immediately before editing, and each table-shaped finding was re-derived against 2.11a's
`TableColumn` contract rather than the private `DataTable` the original finding described. Verified
on the combined tree: `npm test` **660 passed / 24 files**, `tsc --noEmit` clean,
`eslint . --max-warnings 0` clean. **Still nothing committed.**

**The browser pass has since been run** (see the verification section above): D1's legibility
re-check is discharged in both themes at 320 px, and every rendering change this review made — the
seven goalkeeping tables, the new on-screen strings, the per-instance skeletons, the `role="img"`
chart wrapper, the removed SVG axis title — was exercised against all three fixtures. One cosmetic
question is left open for UX (the `38.0%` trailing zero); it is not a defect.

### Code-review browser verification (2026-08-04)

Run against `python -m http.server 8765 --directory app/out` after a clean `npm run build`
(the full chain green: eslint → tsc → assert:schema-version → next build → copy-data). The `<md`
checks used a same-origin 320 px iframe, with `matchMedia` confirmed **genuinely false** for both
`md` and `lg` inside it (`innerWidth` 316). All three fixtures.

**D1 — the corrected hatch, discharged.** The pattern now renders `x1 = x2 = 3` in a 6×6
`userSpaceOnUse` tile at `strokeWidth 1.5`, so the stroke spans 2.25→3.75 and is **fully inside the
tile** — no clipping, and the texture is the declared width rather than half of it. Legibility was
re-judged in the browser at 320 px in **both** themes and the diagonal reads clearly in each
(light: dark stripes over the blue ground; dark: light stripes over cyan). All six `<pattern>` ids
are valid XML NCNames.

**Contrast, method validated first (the 2.6 method).** All four published figures reproduced
**exactly** before any new number was trusted: `--viz-team-a` on `--surface-raised` **13.56** dark /
**4.99** light, `--viz-team-b` **10.30** / **5.36**. The hatch stripe against its own ground measures
**1.53** dark / **3.30** light — unchanged by this patch, as expected, since the fix altered the
stripe's WIDTH and not its colour. Decision 10(b)'s governing measure remains the mark against the
card (10.30 / 5.36), which clears both the 4.5:1 and 3:1 floors.

| Check | Result |
|---|---|
| Goalkeeping disclosure tables | **7**, all seven captions distinct, on all three fixtures |
| Distribution / aerial table rows (m001) | 36 / 22 — the ~30 previously untabled numbers now render |
| Count-only rows | em dash in Completados/Incompletos, never `0` (28 of 36 rows on m074) |
| Set-plays captions | **4 distinct** — the shared `cornerCaption` is gone |
| Nested `role="figure"` | **0** on all three fixtures (2 team figures + 2 `role="img"` charts) |
| Chart accessible name | no longer carries `totalInvolvements` (decision 14) |
| Category-axis title painted in SVG | **none** — it rides an HTML `sr-only` span, where `sr-only` works |
| Zero tick present | **6 / 6 axes**, incl. m074's extra-time axis 0…120 |
| Focusable nodes in charts | **0** |
| `role="application"` / `<Tooltip>` / `<Legend>` | **0 / 0 / 0** |
| Running animations in the four sections | **0** |
| Own-denominator labels (decision 13) | live — "Por tipo de intervención sobre 2", "Por parte del cuerpo sobre 2" |
| EN toggle after load | clean; every new key mirrored, **0** Spanish leakage |
| Console errors | none |
| Reflow at 320 px, everything expanded and every disclosure open | doc overflow **7 px**, **0 genuine offenders** |

**On the reflow number.** 7 px matches the pre-existing figure the implementation recorded, and the
offender sweep returns zero once elements inside an `overflow-x` ancestor are excluded — the
disclosure supplies that scroll container by design. A naive sweep that ignores scroll ancestors
flags every wide table in **five sections this story never touched**, which is what confirms the
behaviour as the shipped norm rather than something this review introduced.

**One cosmetic consequence of the AC 1 precision fix, flagged rather than absorbed.** The
`#phases` / `#pressing` tables now format at 1 decimal to preserve `Percentage`'s contracted
`"x-decimals": 1`, so on today's fixtures — where every value is an integer — every cell reads
`38.0%` rather than `38%`. That is correct against AC 1 and invisible-to-wrong at the 2.19 cutover
if left at 0 decimals, but it is noisier on current data. **Open for a UX call:** suppress the
trailing zero per cell (`Number.isInteger(v) ? 0 : 1` decimals) if the noise is judged worse than
the asymmetry. `@/lib/format` is on the do-not-touch list, so this would be a component-level
conditional, not a format-layer change.

**Honest limits, unchanged.** No live screen reader is available in this harness — the structural
pass read roles, labels and strings back from the live DOM in both locales, which is not the same
thing. The 195 px reflow is 2.19's and was not attempted.

### Decisions needed

- [x] [Review][Decision] **RULED — fix the geometry and re-verify in the browser.** Ruled by Juan, 2026-08-04. The stripe is drawn at the tile centre (or mirrored at both edges) so the rendered texture is the declared 1.5 px, and Task 10.2’s legibility check is re-run at 320 px in both themes before the patch is considered closed. The reasoning: decision 10(b) ruled the hatch in on the argument that a solid ground makes the mark-vs-card figures govern and *“the hatch only adds texture”* — a half-strength texture is a weaker discharge of UX-DR11(b) than the decision intended, and the browser judgement was made against a mark nobody knew was clipped. Correcting the geometry restores what was ruled rather than overturning it. *Original finding:* **The Team B hatch stripe renders at half its declared width, and the mark Juan approved in the browser is the half-width one.** `TacticalCharts.tsx:314-321` (and the duplicate at `:483-490`) draws the pattern line at `x1=0, x2=0` with `strokeWidth={1.5}` inside a `userSpaceOnUse` tile of width 6. Half the 1.5 px stroke falls at negative x and is clipped by the tile; SVG pattern tiles do not wrap clipped content, and there is no compensating stroke at `x=6`. The rendered texture is therefore a ~0.75 px line every 6 px, not the intended 1.5. This is the entire UX-DR11(b) non-hue channel — hue alone measures 1.32:1 dark / 1.07:1 light between the two team accents — and decision 10(b) was resolved at Task 10.2 on a *legibility* judgement made against what actually painted. So the constant `HATCH_STROKE_PX = 1.5` misdescribes the shipped mark, but correcting the geometry changes the mark that was signed off. **Options: (a) fix the geometry (draw at `x = HATCH_TILE_PX / 2`, or add the mirror stroke) and re-verify legibility in the browser; (b) keep the shipped appearance and correct the constant to `0.75` with a comment recording why; (c) defer to the first successor story that needs the pattern (2.13 / 2.15 / 2.16 / 2.17).**

### Patches

- [x] [Review][Patch] ⟨from D1⟩ **Draw the Team B hatch stripe at its declared width and re-verify legibility** — move the pattern line off the tile edge (`x = HATCH_TILE_PX / 2`) or add the mirror stroke at `x = HATCH_TILE_PX`, in **both** copies of the `<defs>` block, so the ~0.75 px rendered stripe becomes the intended 1.5 px. Then re-run Task 10.2’s hatch check at 320 px in both themes and record the observation in the Dev Record beside the original decision-10(b) note. [app/src/components/TacticalCharts.tsx:314-321,483-490] **APPLIED 2026-08-04 (code only).** The stripe now draws at `x = HATCH_TILE_PX / 2` in both `<defs>` blocks, so the full 1.5 px falls inside the tile. **The browser half of this patch is NOT done** — Task 10.2’s 320 px legibility re-check in both themes is still owed and must run before this is called closed.
- [x] [Review][Patch] **`#goalkeeping`'s data disclosure omits most of the numbers the surface displays, and two minted captions prove the tables were dropped** — the disclosure carries exactly three tables (involvement summary, involvement timeline, intervention-type counts). On screen but in no table: the distribution families and their complete/incomplete triples, `lineBreaks`, all three gated technique panels, `attemptsFaced`, `savePercentage`, `totalInterventions`, `byBodyType`, the three aerial `CompletionCounts`, `crossesFacedAttempted`/`Completed`, and the six cross-delivery counts. Violates ruled decision 19 ("the SAME NUMBERS the surface displays"), AC 3 via UX-DR16 / `ARCHITECTURE-SPINE.md:140`, and `EXPERIENCE.md:113`'s accessibility floor. Task 5.6 is marked `[x]`. The model exports no distribution / aerial / prevention-headline row builders, and `viz.goalkeeping.distributionCaption` / `aerialCaption` were minted in both locales with zero call sites. [app/src/components/GoalkeepingSection.tsx:546-582] **APPLIED 2026-08-04.** Three new pure row builders in `goalkeeping-model.ts` — `distributionTableRows`, `aerialTableRows`, `preventionHeadlineRows` — plus `bodyTypeTableRows` kept separate so decision 13's two denominators are never implied to be shared. The disclosure now carries **seven** tables instead of three, built against 2.11a's `TableColumn` contract; `distributionCaption` and `aerialCaption` finally have call sites, and two new captions (`headlineCaption`, `bodyTypeCaption`) name their own denominators in both locales. One shared row shape carries both quantity kinds: `complete`/`incomplete` are `number | null`, where null means NO SUCH SPLIT EXISTS (rendered as an em dash), never zero. Gated rows are ABSENT, not em-dashed, so table and surface agree on corpus data too. Six new tests pin it, including the corpus shape and the two-keeper case.
- [x] [Review][Patch] **A keeper with an empty involvement timeline is told the match listed no goalkeepers** — `points.length === 0` renders `viz.goalkeeping.zeroAll` = *"El informe no lista arqueros para este partido."* inside a block that has just printed that keeper's name and involvement count and is about to print their distribution, save percentage and aerial numbers. It is the same string used at `:595` for the genuinely keeper-less match, where it is correct. The model has a dedicated test for this branch that cannot catch it, because the defect is in the component. Needs its own key in both locales. [app/src/components/GoalkeepingSection.tsx:257-258] **APPLIED 2026-08-04.** New `viz.goalkeeping.zeroTimeline` in both locales ("El informe no grafica intervalos para este arquero."). `zeroAll` stays where it is correct — section level.
- [x] [Review][Patch] **The `dynamic()` skeleton fallback is the wrong height on 2 of the 4 `DistributionChart` mounts, contradicting both files' own comments** — a `dynamic()` declared once cannot vary its fallback per instance. `PhasesSection.tsx:78` fixes the fallback at `IN_POSSESSION_HEIGHT` (`h-[302px]`), so the 9-category out-of-possession chart mounts behind a 30 px-short skeleton; `PressingSection.tsx:61` fixes it at `PRESS_HEIGHT` (`h-[182px]`) in front of the 3-category blocks chart (`h-[152px]`), 30 px tall. `PhasesSection.tsx:52-58` claims the fallback is "AT THE CHART'S EXACT HEIGHT" and `phases-model.ts` claims fallback and chart "cannot drift". A CLS hit against the budget the code-split exists to protect, and on the `#phases` deep link `TacticalLayer` scrolls on mount, before the chunk resolves. Needs two `dynamic()` handles per file, or a height-carrying fallback. [app/src/components/PhasesSection.tsx:78; app/src/components/PressingSection.tsx:61] **APPLIED 2026-08-04.** Both files now build one `dynamic()` handle per height — `InPossessionChart` / `OutOfPossessionChart` and `PressChart` / `BlockChart` — each with a fallback at its own height. Both handles share one chunk (`next/dynamic` dedupes on the import specifier), so the code-split is unaffected.
- [x] [Review][Patch] **`totalInvolvements` is embedded in the involvement chart's own `figureSummary`, which ruled decision 14 forbids verbatim** — decision 14: *"No copy, caption, `figureSummary` or table footer may state or imply that the timeline adds up to it."* `chartSummary` interpolates `involvementPhrase` (= `countPhrase(keeper.totalInvolvements, …)`) and is the `aria-label` of the `role="figure"` wrapping the timeline, so a screen-reader user is told the chart *is* "47 participaciones" — while on real data the plotted slots run 0-5 short (exactly 0 on only 59 of 208). The printed headline at `:252-254` is correct and required; the chart's own accessible name is the surface the decision names. [app/src/components/GoalkeepingSection.tsx:224-227] **APPLIED 2026-08-04.** `involvementPhrase` removed from `chartSummary`; the headline still prints the total verbatim, which is what decision 14 requires.
- [x] [Review][Patch] **Two different set-plays tables ship under one identical caption** — `:455` (corner counts by side / type / style with shares) and `:472` (per-type left / right / total) both pass `caption={cornerCaption}` = *"Tiros de esquina por lado, tipo y estilo de envío."*, which does not describe the second table. Violates decision 19's "each caption states its own content and its own order — mint caption keys per table", and two adjacent `<caption>` elements with identical text make the tables indistinguishable in a screen-reader table list. Same defect class the 2.7 review patched once already. [app/src/components/SetPlaysSection.tsx:455,472] **APPLIED 2026-08-04.** New `viz.setPlays.cornerTypeSideCaption` in both locales, naming the left/right split within each delivery type.
- [x] [Review][Patch] **A partition bar discloses its segment / total disagreement with the copy that denies the partition** — `segmentedBar` is called only for corner SIDE and corner TYPE, both corpus-true 208/208, but on `disagreesWithDeclaredTotal` it renders `viz.setPlays.cornerStyleNote` = *"Recuento independiente: puede no coincidir con el total de tiros de esquina."* "Independent count" is precisely what SIDE and TYPE are **not**. Decision 8 requires the surface to "show both and normalize neither", which needs its own sentence. Unreachable on fixtures (false 6/6), live on corpus. [app/src/components/SetPlaysSection.tsx:244-247] **APPLIED 2026-08-04.** New `viz.setPlays.cornerMismatchNote` states that the segments do not add up to the published total and that both are shown unadjusted (AD-6) — instead of the non-partition disclaimer, which denied the relation the bar draws.
- [x] [Review][Patch] **Nested `role="figure"` with two competing accessible names in every goalkeeper block** — `teamBlock` opens `<figure role="figure" aria-label={figureSummary}>` and the `InvolvementChart` rendered inside it opens a second one at `TacticalCharts.tsx:466-469`. The outer label ("Arqueros: México, Arquero, Raul RANGEL") does not function as a caption for the inner chart. Decision 15 requires the per-team block to be the figure, so the chart is the one that must give way — note `DistributionChart`'s own figure is correct in `#phases` / `#pressing`, where it is not nested. [app/src/components/GoalkeepingSection.tsx:435-439; app/src/components/TacticalCharts.tsx:466-469] **APPLIED 2026-08-04.** `InvolvementChart` renders `role="img"` instead of a second figure. `DistributionChart` keeps its figure — it is never nested.
- [x] [Review][Patch] **The `#phases` and `#pressing` data tables round percentages to whole numbers, discarding a contracted decimal** — both render `formatPercent(row.home, locale, 0)` while `common.schema.json:450-457` defines `Percentage` with `"x-decimals": 1`. AC 1 requires *"exact percentages and values are reachable via each chart's data table."* Every fixture value is an integer, so the loss is invisible in dev and appears only at the 2.19 cutover — the exact fixture-vs-corpus trap this story is built around. The same components already use 1 decimal for `savePercentage`, corner shares and metres. Axis ticks may stay at 0 decimals; the tables are what AC 1 names. [app/src/components/PhasesSection.tsx:229-230; app/src/components/PressingSection.tsx:250-251] **APPLIED 2026-08-04.** Both tables now format at 1 decimal, matching `Percentage`'s `"x-decimals": 1`. Axis ticks stay at 0 decimals — they are integers by construction.
- [x] [Review][Patch] **A two-keeper team whose records share `playerId` and `playerName` collapses to one panel through duplicate React keys** — the key is `keeper-${teamId}-${playerId}-${playerName}` with no index. `playerId` and `playerName` are `required` but **unfulfillable from the source** (Story 1.9, AD-14 (a)) and "will be whatever Story 1.16 decides" — a per-team placeholder is a live possibility. Two-keeper teams are real on 7 of 208 team-innings, and this lands squarely on ruled decision 2, which the story went to lengths to handle (both records rendered, nothing summed). React would drop the second keeper's panel and its table rows. One-line fix: add the record index. [app/src/viz/goalkeeping-model.ts:535] **APPLIED 2026-08-04.** The record index is now part of the key. The pre-existing test only varied `playerName`, so the true collision was never covered — a new constructed test asserts two records identical in every keyed field still survive as two panels and two row sets.
- [x] [Review][Patch] **`sr-only` on a recharts `<Label>` does not hide SVG text, so the category-axis title is likely painted over the wrapped phase labels** — Tailwind's `sr-only` works through `position:absolute` + `clip` + `width` / `height:1px`, none of which apply to an SVG `<text>`; recharts renders a position-less `Label` centred in the axis viewBox, i.e. on top of the `CategoryTick` `<tspan>`s at 96 px. This is the only SVG use of `sr-only` in the codebase (the other ~10 call sites are HTML `<span>`s), so there is no precedent that it works. The comment's stated intent is that the title is carried in the figure summary and the table header instead — so removing the `<Label>` outright matches the intent and is strictly safer either way. [app/src/components/TacticalCharts.tsx:363] **APPLIED 2026-08-04.** The SVG `<Label>` is removed; the axis title now rides an HTML `<span className="sr-only">` inside the figure, where `sr-only` genuinely works, so the locale key still reaches the accessibility tree.
- [x] [Review][Patch] **The three gated technique panels are headed with the same words as the family rows immediately above them, with different numbers** — `gatedPanel(...)` labels each breakdown with `enums.distributionType.{feet,hands,throw}` ("Saque con el pie" / "Saque de volea" / "Saque con la mano"), which `completionList` has already printed as family rows at `:292`. The reader sees "Saque con el pie 24 · Completados 20 · Incompletos 4" and then a second "Saque con el pie" heading over six technique counts. No "técnicas de…" qualifier exists in either locale. Live on all three fixtures. Mint under `EXPERIENCE.md:278`'s procedure. [app/src/components/GoalkeepingSection.tsx:303-305] **APPLIED 2026-08-04.** New `viz.goalkeeping.{feet,hands,throw}Techniques` in both locales ("Técnicas de saque con el pie", …), minted under EXPERIENCE.md:278 so the panel heading no longer repeats the family row above it.
- [x] [Review][Patch] **`completionList` prints an unlabelled leading number** — the row renders `{total} · Completados N · Incompletos M`, so the first figure has no label at all while both its siblings do, reading as a bare number of unstated meaning. `viz.goalkeeping.distributionTotal` ("Total") already exists and is used only as a *row* label inside the same list, which makes the omission read as an oversight rather than a shorthand. [app/src/components/GoalkeepingSection.tsx:172-182] **APPLIED 2026-08-04.** The total now carries `viz.table.total` like both its siblings.
- [x] [Review][Patch] **`viz.table.slot` labels two different quantities in two adjacent tables inside one disclosure** — `:493` uses it for the summary table's *count of plotted slots*; `:498` uses it for the timeline table's *slot index*. Both render "Intervalo". Ruled decision 14 split these into two tables precisely because they are different things, and decision 7 added the index column because duplicate-minute rows are otherwise indistinguishable. Needs a distinct `slotCount` key. [app/src/components/GoalkeepingSection.tsx:493,498] **APPLIED 2026-08-04.** New `viz.table.slotCount` ("Intervalos") for the count; `viz.table.slot` ("Intervalo") stays on the index column.
- [x] [Review][Patch] **`anyGateClosed` fires on `crossesFacedCompleted === null`, which hides no panel, so the gate sentence can claim omissions that did not happen** — the flag ORs in the crosses field, but that field only swaps the label to `crossesFacedAlone` (which already discloses the absence in words) and drops one `<dt>` / `<dd>` pair; no panel is removed. A record where only that field is null makes the block state *"…esos paneles no se muestran"* while every panel is on screen. All-or-nothing on corpus (all five null) and all-present on fixtures, so this is a mixed-record case only — but the flag should be scoped to the four panel gates. [app/src/viz/goalkeeping-model.ts:543-548; app/src/components/GoalkeepingSection.tsx:470-472] **APPLIED 2026-08-04.** The flag is scoped to the four gates that actually remove a panel. New test asserts a record whose only null is `crossesFacedCompleted` reports `anyGateClosed === false` while every panel is present.
- [x] [Review][Patch] **The metre unit is modelled per measure and then ignored, giving two sources of truth** — `phases-model.ts:264` puts `unitKey` on every `MetreRow`, `:275` exports `METRE_UNIT`, and `phases-model.test.ts` asserts both; the only consumer hardcodes `const metreUnit = t("enums.unit.m")` and never reads `row.unitKey`. Task 7.2 mandated exactly this AD-7 "units keyed by metric code" mechanism, so it currently exists only in the test: a future measure with a different unit would be modelled correctly, rendered in metres, and stay green. [app/src/components/PressingSection.tsx:139] **APPLIED 2026-08-04.** `PressingSection` reads `t(row.unitKey)`; the hardcoded `t("enums.unit.m")` is gone, so AD-7's keyed-by-metric-code mechanism is live rather than test-only.
- [x] [Review][Patch] **Dead exports and dead locale keys shipped with the story** — `phaseTableRows`, `PhaseTableRow`, `MetreTableRow` and `PhaseSide` (`phases-model.ts:524-541`) are referenced only by their own test; both sections build their tables from `phaseRows` per family. `viz.table.value` ("Valor" / "Value") was added to both locales and is read by nothing. `SideRef.teamId` is declared in all four new sections and populated by `TacticalLayer` for every one of them, and no section reads it. The story's own Task 8.1 records that **nothing in the build chain catches a dead binding** (`no-unused-vars` is not in the flat config's active set and `tsconfig.json` sets no `noUnusedLocals`), and 2.9 took a review finding for exactly this. [app/src/viz/phases-model.ts:524-541] **APPLIED 2026-08-04, with one deliberate exception.** `phaseTableRows`, `PhaseTableRow`, `MetreTableRow` and `PhaseSide` are deleted (the orphaned test was rewritten against `phaseRows`), and `viz.table.value` is removed from both locales. **`SideRef.teamId` is deliberately KEPT:** re-checked at patch time it is NOT dead — `GoalkeepingSection` and `SetPlaysSection` both pass their `SideRef` to a model expecting a `LogSide`, which reads `teamId`. Only `#phases` and `#pressing` do not, and narrowing the interface in two of four sections would break a uniform prop convention across the layer for no gain. The original finding overstated this.
- [x] [Review][Patch] **Two latent wrong-output paths in the axis-label wrapper** — (a) `wrapAxisLabel`'s truncation check compares `lines.join(" ")` against `label.replace(/\s+/g, " ")`, which preserves leading and trailing whitespace, so a label with edge whitespace gets an ellipsis appended although nothing was cut — falsely signalling truncated text; a `.trim()` fixes it. (b) `CategoryTick` keys its `<tspan>`s by line content, so a label wrapping to two identical lines yields duplicate React keys and one dropped `tspan`, rendering half the label. Both need curated-string inputs to trigger, hence low reachability — but both are one-line fixes on the story's own declared-departure helper. [app/src/viz/phases-model.ts:497-498; app/src/components/TacticalCharts.tsx:173-177] **APPLIED 2026-08-04.** `wrapAxisLabel` now trims before comparing lengths, and `CategoryTick` keys its `<tspan>`s by index.
- [x] [Review][Patch] **The chart height's category count is hardcoded at the call sites rather than read from the rows** — `distributionChartHeightClass(8)` / `(9)` / `(4)` / `(3)` are written as literals while the rows come from the frozen enum lists. If a phase or block enum gains a member, the height freezes at the old count, the bars crowd, and the function's own exhaustive throw never fires — the one guard that exists for this is bypassed by construction. [app/src/components/PhasesSection.tsx:48-49; app/src/components/PressingSection.tsx:48-49] **APPLIED 2026-08-04.** Both files derive their heights from the frozen enum lists — `IN_POSSESSION_PHASES` / `OUT_OF_POSSESSION_PHASES` / `PRESS_PHASES` / `BLOCK_LEVELS` — so an enum change moves the height with it and `distributionChartHeightClass`'s exhaustive throw is reachable again.
- [x] [Review][Patch] **`blockRows` is the one enum read that bypasses the module's own exhaustiveness discipline, and the cast is not even needed** — `team.defensiveBlockDistribution[code as keyof DefensiveBlockDistribution]`, while every other enum in the story routes through an explicit `Record<Enum, keyof Counts>` map (`IN_POSSESSION_PROPERTY`, `FREE_KICK_PROPERTY`, `INTERVENTION_PROPERTY`, …) specifically so a renamed field is a compile error. `BlockLevel` is `"high" | "mid" | "low"` and `DefensiveBlockDistribution` is `{high, mid, low}`, so the indexing compiles **without** the cast — deleting it both removes code and restores the compile-time guarantee. [app/src/viz/phases-model.ts:241] **APPLIED 2026-08-04.** The cast is gone; `DefensiveBlockDistribution` is no longer imported.
- [x] [Review][Patch] **A test asserts array-order independence and a sibling test then depends on array order** — the "ignores array order entirely" test establishes that home / away must come from `metadata`, never from array position; the `savePercentage` verbatim test then reads `records(bundle)[index === 0 ? 0 : 1].goalPrevention`, i.e. it assumes `goalkeeping[0]` is the home record. It passes only because the fixtures happen to be emitted home-first — the exact assumption the earlier test exists to forbid. It also softens its own assertion with `matching?.goalPrevention.savePercentage`, so a lookup miss compares `undefined` rather than failing loudly. [app/src/viz/goalkeeping-model.test.ts] **APPLIED 2026-08-04.** Sources are matched by `teamId` and `playerId` instead of array position, the row count is asserted, and the `matching?.` softening is replaced by an explicit `toBeDefined()` so a lookup miss fails loudly.

### Deferred

- [x] [Review][Defer] **A series whose values are all equal puts both direct team labels at the axis origin, overlapping** [app/src/components/TacticalCharts.tsx:229-237] — deferred, marginal reachability
- [x] [Review][Defer] **A denominator-labelled breakdown can contradict its own listed rows with no disclosure** [app/src/components/GoalkeepingSection.tsx:348-367] — deferred, needs a corpus measurement this story did not take

### Dismissed as noise (3)

- **`segmentedBar` throws at render inside a layer with one shared error boundary** — the throw can only fire on a broken model invariant (`segmentedBar` is called solely with the two `partition: true` groups), never from data. Throwing is the correct response to a violated invariant, and decision 18's guard requirement is about *data-driven* early returns at model entry points. The boundary's blast radius is already re-filed by Task 9.6.
- **A zero-segment bar renders "no corners" beside a non-zero declared total** — for corner SIDE and TYPE the segments sum to `totalCorners` on 208/208, so all-zero segments imply `totalCorners === 0`. Unreachable for the only two groups that reach `segmentedBar`.
- **`DataTable` is copy-pasted into four more files, bringing the repo to nine** — Task 7.6 rules this explicitly ("a private `DataTable` copy per section is the **current convention**… do **not** refactor `DataTable` out of any shipped file"). A reviewer does not overturn a ruled decision; 2.11 owns the cross-table sort contract that would motivate extraction.

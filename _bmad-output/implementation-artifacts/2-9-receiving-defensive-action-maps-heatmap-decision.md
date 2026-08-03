---
baseline_commit: dd3dfc3
---

# Story 2.9: Receiving & Defensive-Action Maps (+ Heatmap Decision)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Diego,
I want offers-to-receive, movement-to-receive, and defensive-action maps,
So that the full PMSR marker taxonomy — unavailable anywhere else — is visible (FR-22).

> **The epic's premise is overturned and the story statement is changed on corpus-wide evidence.**
> Two of the three "maps" are not maps: the receiving family carries **no per-event data of any
> kind** (Story 1.13, 104 reports / 416 pages). This story ships **one** pitch map
> (`#defensive-actions`) and **two aggregate surfaces** (`#offers-to-receive`,
> `#movement-to-receive`) built from a real, contracted, already-fixtured source. Everything
> else in the epic's story statement stands. Ruled by Juan at story creation — see ruled
> decision 1.

## Acceptance Criteria

The epic's ACs (`epics.md:804-813`) are reproduced **verbatim**, each followed by the
**BINDING** reconciliation the story-creation probe forced. Read both — the probe overturned the
epic's central premise and the reconciliation is what you build to. This is the 1.9 / 1.13
in-story re-scope precedent, applied to Epic 2 for the first time.

**AC 1 — The three sections**

**Given** the three sections (`#offers-to-receive`, `#movement-to-receive`, `#defensive-actions`)
**When** they render from `ReceivingEvent` / `DefensiveActionEvent` data
**Then** each reuses the pitch-panel infrastructure with team-accent markers shape-encoded per DESIGN (hollow diamond = offer, filled diamond = movement, filled triangle = defensive action) — team encoding only, never mixed with outcome encoding (UX-DR10)
**And** popovers, cluster handling, keyboard access, `<md` team-tab vertical pitch, and per-map event-log tables via "Ver los datos" all follow the established patterns (UX-DR9, UX-DR16, UX-DR17).

> **BINDING (probe-forced; corpus evidence in Dev Notes → "The premise overturn, measured").**
> `ReceivingEvent` is unfulfillable in **every one of its eight required fields**
> (`deferred-work.md`, grep `"unfulfillable in EVERY required field"`). `events.receiving` can
> only ever be `null`, so **no receiving marker is producible and none may be fabricated** — not
> from the 11 static decoration dots, and not by re-labelling Domain G aggregate rows as events.
> AC 1 is **satisfied, not waived**, re-expressed as:
>
> **(a)** `#defensive-actions` ships as a real pitch map on `PitchPanel`, with a **filled
> triangle** in the acting team's `-on-pitch` accent, and every pattern the AC lists — popovers,
> clustering, keyboard, `<md` team tabs + vertical pitch, and the event-log table behind "Ver los
> datos". It is built to the **corpus-real** field set, not to the fixture's (decision 5).
>
> **(b)** `#offers-to-receive` and `#movement-to-receive` ship as **per-team aggregate
> surfaces** off `bundle.players[].inPossession` — `totalOffers`, `offersReceived` and the
> six-value `offersByMovementType` split — each with a data table behind the same canonical "Ver
> los datos" control. They render **team encoding only**, so UX-DR10's "never mixed with outcome
> encoding" clause holds. They are **never** placed on a pitch and **never** rendered as events
> (decision 2).
>
> **(c) DECLARED DEPARTURES, three, each ruled below rather than left implicit:**
> **(c-i)** The **hollow-diamond / filled-diamond** half of UX-DR10 has **no surface** and the two
> shapes are deliberately **not** added to `MarkerShape` (decision 6). DESIGN.md:282 carries its
> own flag — `[ASSUMPTION: shape assignments proposed; the source PDF renders these families as
> distinct marker glyphs]` — and Story 1.13 falsified exactly that assumption.
> **(c-ii)** `EXPERIENCE.md:130` and UX-DR17 rule all three sections together as "team tabs, one
> vertical pitch". Two of the three are no longer pitches, so that row cannot apply to them;
> decision 17 rules their `<md` layout instead.
> **(c-iii)** `EXPERIENCE.md:221`'s "Receiving log table (player, minute, coordinates, type)" is
> unbuildable — there are no receiving events to log. The receiving sections' data tables are
> **aggregate** tables (decision 11), and the Expert-layer consequence is routed to 2.11 by name
> (Task 8.6).
>
> **(d)** The AD-14 consequences are **filed**, not fixed: `#defensive-actions` inherits an open
> emission blocker of its own (`DefensiveActionEvent.playerId`/`playerName`/`at`/`contestType`),
> and two of four `DefensiveActionType` values are unpopulatable. See Task 8.

**AC 2 — The heatmap decision**

**Given** the deferred heatmap decision (spine Deferred list)
**When** this story is implemented
**Then** the match-heatmap question is evaluated against fixtures: if surfaced, it is client-derived from the bundle's Domain D events under AD-5's single-surface carve-out with the monotonic heat ramp and a zone-table alternative; if deferred, the decision and rationale are logged — no pipeline-emitted grid without an AD-14 change request.

> **BINDING: the epic's second branch is taken — DEFERRED, with the rationale logged and the
> evidence measured** (ruled by Juan at story creation; decision 12, filed by Task 8.3).
> The ramp was evaluated, not skipped: `--heat-1..5` already ship, theme-invariant and on-pitch,
> with **zero consumers**, and the measured ratios and luminances reproduce DESIGN.md:286
> **exactly**. What is missing is an input, not a ramp. No pipeline-emitted grid is requested and
> `/contract` is untouched.

## Ruled Decisions

These are decided. Do not re-litigate them mid-implementation; if evidence contradicts one,
record a departure in the Dev Agent Record with the reason, exactly as 2.6, 2.7 and 2.8 did.

**1 — Scope: re-scope IN-STORY, on the 1.9 / 1.13 precedent. Ruled by Juan, 2026-08-03.**
`epics.md` is **not edited**. The ACs above are reproduced verbatim with BINDING reconciliations;
the divergence travels to downstream owners through `deferred-work.md` (Task 8). One pitch map,
two aggregate surfaces.
*Rejected alternative:* build all three as maps against the fixtures — the 2.8 precedent, and
precisely the outcome 2.8 now regrets: 1.14 proved `PassNetworkNode.x/y` unfulfillable **after**
2.8 shipped the node map, so that surface is already known-dead and 1.16 is bound to emit `null`
for it. Repeating that knowingly, on a family where the negative is already proven, would ship two
permanently-empty sections on purpose.
*Rejected alternative:* split the receiving sections into a later story — it would leave two of
the eleven Tactical sections as `PendingSectionPanel` shells indefinitely, when decision 2's
source is buildable today.

**2 — The two receiving sections read `bundle.players`, NOT `events.receiving`.**
`bundle.players[].inPossession` carries, **`required` in the contract**
(`contract/match-bundle.schema.json`, `PlayerInPossession.required`) and present in all three
fixtures: `totalOffers`, `offersReceived`, and `offersByMovementType` — the full six-value
`{inFront, inBetween, outToIn, inToOut, inBehind, noMovement}` split. This is Domain G, extracted
for real by **Story 1.10 (done)**, so unlike `events.receiving` it survives the 2.19 cutover as
real data.
**Two hard bans, both from the ledger and both non-negotiable.** These rows are **whole-match
per-player aggregates** with no `at`, no coordinates and no per-event identity. They must never
be rendered as events, and never placed on a pitch — `DESIGN.md:355` names "snap-to-zone" as a
prohibited transformation, and AD-8 forbids inventing per-event structure the source lacks.
*Rejected alternative:* the richer `domains.receiving` aggregates Story 1.13 stages (per-third,
per-shape, `most_offers`, the 15-cell grid, `top_ranked_players`). They are real and complete on
208/208 team-innings, but they live **only** in `work/extracted/`, which is **gitignored**, has
**no contracted destination** (`EventTables.required` is seven flat event arrays), and is read by
nothing in `app/`. Reaching them needs an AD-14 change plus a 1.16 emission path that does not
exist. Filed in Task 8.2 as the successor change-set candidate; not this story's dependency.

**3 — `sectionDataState`'s two receiving predicates change. This is a ruled exception to the
standing do-not-touch on `tactical-sections.ts`.**
Today `app/src/lib/tactical-sections.ts` (grep `case "offers-to-receive":`) reads:

```ts
case "offers-to-receive":
case "movement-to-receive":
  return events.receiving !== null ? "ready" : "empty";
```

Under decision 2 that predicate is **wrong in both directions**: it returns `"ready"` when
`receiving` is populated but `players` is `null` (the component mounts and throws — a whole-layer
outage, see decision 10), and `"empty"` when `receiving` is `null` but `players` is populated —
hiding data sitting in the bundle, the **FR-22 failure mode inverted**, the exact defect 2.7's
ruled decision 2 exists to prevent. It becomes:

```ts
case "offers-to-receive":
case "movement-to-receive":
  return bundle.players !== null ? "ready" : "empty";
```

`players` is `PlayerRecords | null`, so the empty branch is reachable. Precedent: 2.7 changed the
`shot-maps` predicate the same way and replaced 2.5's assertion with a four-way truth table. Do
the same here (Task 5.2). `#defensive-actions` keeps `events.defensiveActions !== null`
**unchanged**.

**4 — The empty-state copy for the two receiving sections must be overridden, or it ships a false
statement.**
Decision 3 makes them `"empty"` when `bundle.players === null`. `TacticalLayer` then renders the
generic `EmptyStatePanel`, whose explanation is literally **"El informe oficial no incluye esta
sección."** A Domain G absence is **not** a receiving-section absence — the report's receiving
pages may be perfectly present. Shipping that sentence would be the same dishonesty 2.5's ruled
decision 9 and `EmptyStatePanel`'s own docblock exist to prevent, and the mirror of the FR-22
inversion decision 3 cites as its own justification.
**RULED:** add both ids to `TacticalLayer`'s existing `EMPTY_HEADLINE_OVERRIDE` mechanism (grep
`EMPTY_HEADLINE_OVERRIDE`, the `momentum` precedent) **and** a parallel explanation override, with
copy that names the real absence — the per-player data, not the section. Mint the keys in Task 7.
If the shipped mechanism covers headlines only, extending it is an additive `TacticalLayer` change
and is in scope.

**5 — The defensive-actions map is built to the CORPUS-real field set, not the fixture's.**
The fixtures are actively misleading here and will train you into a defect. Measured across all
three: `at` and `playerName` are populated on **100%** of rows, and `block` +
`possession-contest` account for **44% / 47% / 55%** of markers. The corpus: `contest_type` is
`null` on **20,169 / 20,169** events; `playerId`/`playerName`/`at` have **no carrier at all**
(`deferred-work.md`, grep ``"`DefensiveActionEvent` requires"``); and `block` / `possession-contest`
are **aggregate panels with no coordinates anywhere in the corpus** (grep `"only two of four"`),
so only `forced-turnover` and `possession-regain` can ever be plotted. Therefore:
- **No static ENCODING table over the enum.** The 2.7 `SHOT_OUTCOME_ENCODING` pattern (a frozen
  `Record<Enum, {shape, colorVar}>`) is **wrong here** — it would assert a visual treatment for
  two values that can never appear. *(This ban is on encoding tables only. A frozen **ordered
  code list** for labelling and sort order is required, not forbidden — see decision 16.)*
- **No feature may depend on player identity or the clock.** No grouping by player, no minute
  filter, no "top actor" line. `orderByMinute` already sorts clock-less rows last and stably —
  that is the roving order and the table's default sort, and it must stay correct when every `at`
  is absent.
- Any count chip in `metaLine` enumerates **only the types actually present**, never a fixed four.
- Pin all of it with a constructed test event carrying `contestType: null`, `actionType:
  "possession-regain"`, and the minimum shape the corpus can produce. No fixture can produce it.

**6 — Add `triangle-filled` to `MarkerShape`. Do NOT add the two diamond shapes.**
`MarkerShape` (grep `export type MarkerShape` in `app/src/viz/marker-model.ts`) has five members
and **no diamond and no triangle**. Add exactly one: `"triangle-filled"`. The two diamonds have no
consumer under decision 1, and an unused member of a closed union — carrying a legend swatch
nobody renders — is dead code. Adding them later is trivially safe: `MarkerShapeGlyph`'s `default`
branch assigns to `const unexpected: never`, so a future member without a case is a **compile
error**, not a silent gap. File the diamond half of UX-DR10 as superseded-pending-UX (Task 8.1).
*Rejected alternative:* add all three now for DESIGN fidelity — two would be unreachable code with
no call site and no test that could exercise them.

**7 — Triangle geometry, specified here because DESIGN specifies none.**
DESIGN.md gives no size, stroke width or fill opacity for these families — only the `~8–14 px`
band (`EXPERIENCE.md:104`) and the shot family's precedent (circle Ø12, square 11×11).
Rule: an **apex-up equilateral triangle whose bounding-box height equals the circle's diameter**.
With `r = marker.radius ?? MARKER_RADIUS_PX` and `scale = radius / MARKER_RADIUS_PX` (the existing
`MarkerShapeGlyph` contract), the circumradius is `R = r * TRIANGLE_CIRCUMRADIUS_RATIO` where
**`TRIANGLE_CIRCUMRADIUS_RATIO = 4 / 3`** — an equilateral triangle's height is `1.5·R`, so
`R = 4r/3` gives height `2r`, exactly the circle's diameter. At `r = 6` the box is
**13.86 × 12.00 px**, both axes inside the band. Vertices at `-90°, 30°, 150°`:
`(0, -R)`, `(R·√3/2, R/2)`, `(-R·√3/2, R/2)` → `(0, -8)`, `(6.928, 4)`, `(-6.928, 4)`.
Their centroid is the origin, so the glyph anchors on the marker position like every other shape.
Filled, no stroke.
*Rejected alternative:* equal-**area** with the circle, which needs `R = r·√(4π/(3√3)) =
1.55512·r` and yields a **16.16 × 14.00 px** glyph — outside DESIGN's band and visibly the largest
marker in the project. The ruled form is 74% of the circle's area (83.1 vs 113.1 px²), deliberately:
an apex-up triangle reads heavier than its area at equal extent. Verify in the browser (Task 9.2).
**The apex points up in BOTH orientations** — it is an event-family glyph, not a direction cue, and
rotating it with the pitch would invent a semantics the source does not have.

**8 — Team encoding only, using the `-on-pitch` accents, in both themes.**
Marker `colorVar` is `--viz-team-a-on-pitch` / `--viz-team-b-on-pitch`, matching the shipped
`ACCENT_VAR` maps in `ShotMapsSection.tsx` and `PassNetworksSection.tsx` (grep
`--viz-team-a-on-pitch`). Never the canvas variants: the pitch is theme-invariant
(`DESIGN.md:219, 264`) and `--viz-team-a/-b` in the light theme fall far below the 3:1 non-text
floor on the green. Measured at story creation, reproducing DESIGN.md:282 exactly:
**9.56:1** and **7.26:1** vs `--pitch-surface`, and **8.46 / 6.43** vs `--pitch-stripe` (the
stripe figure is not in DESIGN; measured here because markers land on it).
Team identity is carried by the **two separate figures and each figure's direct `teamCode`
label**, never by hue — the accents are only 1.32:1 apart in lightness
(`review-accessibility.md:27`). `PitchPanel` already renders that label; do not remove it.

**9 — The full pitch is automatic. The one-ended goal furniture is RULED here and IMPLEMENTED
elsewhere.**
Measured on all three fixtures: defensive-action `x` spans **8.3–64.3**, so `pitchExtentFor`
returns `{xMin: 0}` on its own and the halfway line, centre circle and centre spot arrive for
free. **There is no `extent` prop to pass** — `PitchPanel` computes one internally from both sides
pooled. Do not try to hardcode or override it.
`pitchMarkings` builds `penaltyArea`, `sixYardBox`, `penaltySpot`, `penaltyArc` and `goal`
**unconditionally at the attacked end only**, so every full pitch has a bare defending half. The
ledger routes this to whoever owns the next full-pitch surface — grep `"Whoever owns the next
full-pitch surface"` and `"should rule it"`. Both entries ask this story to **rule** it, not to
build it.
**RULED: yes — the furniture should be mirrored at the defending end.** **IMPLEMENTATION IS NOT
IN THIS STORY**, and that is a deliberate boundary, not an oversight: `pitchMarkings` returns a
flat single-valued record whose fields `PitchDrawing` renders **by name**, so mirroring requires
new fields on the `PitchMarkings` interface **and** new elements inside `PitchPanel` — which
collides with this story's "one switch case, additive only" boundary on that file. It also needs
two non-projective steps (the `goal` depth offset is direction-dependent px, and `penaltyArc`'s
angle range must be reflected, not projected) and would visibly change Story 2.8's already-shipped
figures. Record the ruling in the ledger (Task 8.4) with the implementation notes above, and route
it to the story that next owns `pitch-geometry.ts` and `PitchPanel.tsx` together.
*Rejected alternative:* implement it here — three files, a shipped-surface change, and a
re-verification of another story's output, all to fix `aria-hidden` decoration with no data
riding it.

**10 — Every model entry point returns early on a zero-length or absent slice. This is a
whole-layer safety requirement, not a nicety.**
There is **exactly one** error boundary in the Tactical stack and it wraps all eleven sections
(`MatchBundleRegion.tsx`, grep `<TacticalErrorBoundary>`). There is no per-section boundary
anywhere. A throw from any 2.9 model replaces Key Statistics, Momentum, Shot Maps, Pass Networks
and the seven shells with one crashed panel. This has already happened once: `passNetworkNodes:
[]` with a populated edge table reached the components as `"ready"` and threw (grep
`"took ALL ELEVEN Tactical sections down"` in `pass-network-model.ts`).
`sectionDataState` gates on `!== null` **only**, so `[]` is `"ready"` and your code runs.
Guard, explicitly and with a test each: an empty `players` array; a `players` array with no rows
for one `teamId`; an empty `defensiveActions` array; `Math.min(...[])`; and division by
`totalOffers === 0` — **81 of 3,289 corpus player rows have `total_offers == 0`**, so the
percentage branch is live in real data even though **no fixture exercises it** (0 of 96 fixture
rows), which is why Task 2.6 requires a constructed input.
Build the log rows **eagerly**, outside the lazily-mounted disclosure, following the shipped
sections: a bad `teamId` should name itself on load, not when a reader opens the table.
**The per-section boundary itself is NOT this story's to build** — pre-existing architecture at
the head of `deferred-work.md` (grep `"kills all eleven Tactical sections"`). Re-file it with this
story's added blast radius (Task 8.5); do not fix it here.

**11 — Each aggregate surface's data table must carry the SAME NUMBERS the surface displays.**
UX-DR16 and `ARCHITECTURE-SPINE.md:140` require "a reachable data table rendering the same
artifact slice". A per-player table alone does **not** satisfy that for a team-level tile or bar —
a reader would have to sum 16 rows to recover the printed number. Each disclosure therefore
carries **both**: a team-totals row (a `<tfoot>`, or a small two-row team table above the player
table) with exactly the values the tiles/bar display, **and** the per-player breakdown. Each
caption states its own content and its own order.

**12 — The heatmap is DEFERRED, with the rationale logged (AC 2's second branch). Ruled by Juan.**
Evaluated against the fixtures and the tokens, not skipped. What Task 8.3 must record:
- The ramp is **ready and unused**. `--heat-1..5` ship in the theme-invariant `:root` block with
  Tailwind bridges and **zero consumers** anywhere in `app/src`.
- Its published properties **hold**. Computed relative luminance
  `0.2668 / 0.3659 / 0.4619 / 0.6454 / 0.8857` — strictly monotonic, every step ≥1.23× —
  reproducing DESIGN.md:286's stated `0.267 → 0.886`. Contrast vs `--pitch-surface`
  `3.68 / 4.83 / 5.95 / 8.08 / 10.87`, reproducing DESIGN.md:286 **exactly**; vs `--pitch-stripe`
  `3.26 / 4.28 / 5.27 / 7.15 / 9.63`, so the lowest stop clears 3:1 on the stripe too — a figure
  DESIGN does not state.
- **What is missing is an input, not a ramp.** Every candidate Domain D family is under an
  unresolved AD-14 emission blocker: `ReceivingEvent` (unfulfillable entirely), `CrossEvent`
  (four required fields), `DefensiveActionEvent` (four required fields). A heatmap built now would
  bin **synthetic fixture coordinates** and would have no real input at the 2.19 cutover.
- The zone-grid schema is an open assumption — `EXPERIENCE.md:113`'s "pitch third × channel,
  intensity % per zone" carries `[ASSUMPTION: zone-grid schema]`, and `ARCHITECTURE-SPINE.md:234`
  defers the shape outright. Ruling it is a UX call this story does not have.
- AD-5's "exactly one surface" clause needs a profile/comparison decision 2.9 cannot take alone.
- **If a heatmap swatch ever renders on a card it must not use these tokens bare:** measured on the
  light `--surface-raised`, `heat-4` is **1.51:1** and `heat-5` **1.12:1**. On-pitch only, exactly
  as DESIGN.md:282 states.
No AD-14 change request is filed and `/contract` is untouched.
**Owner and trigger, named rather than left floating:** re-open at **Story 1.16**, whose emission
decides whether any Domain D family reaches the App with real coordinates. Task 8.3 routes it
there by name.

**13 — Aggregate roll-ups invoke AD-5's single-surface carve-out, with a DECLARED reading of
"exactly one surface".**
Summing per-player `totalOffers` into a team total is a client-side derivation. AD-5 states
**three** conditions and all three hold: it is **within-match**, from **one** bundle; it appears
on exactly one surface (see the declared reading below); and it is **never Hero-critical** (the
Hero is build-time from `storyStats`, AD-11). A fourth constraint is self-imposed here, not AD-5
text: it derives over that bundle's own values without rewriting any of them (AD-6 bans
re-normalisation).
**Declared reading of the "exactly one surface" condition:** the roll-up is computed **once**, in one model
function, and consumed by two sections of **one page**. This story reads "exactly one surface" as
one rendered surface — the match dashboard — not one section. It must not be repeated in the Hero,
in profiles, in comparison, or in any artifact. Stated here rather than assumed, so a reviewer can
disagree with the reading instead of discovering it.
**The evidence that makes this more than a legal reading:** measured over all 104 staged records,
the per-team roll-up reproduces the receiving page's **own printed headline** exactly — offers
made `min 69 / median 333 / max 634` and received `20 / 119.5 / 247`, identical to
`domains.receiving.offers.*.total_offers_made` / `.total_offers_received`. The derivation lands on
the number the page this story was meant to render prints for itself; Story 1.13 already proved it
reconciles on 208/208 team-innings.
**Binding forward:** if Story 1.16 ever emits a team-level offers block, the App switches to
reading it verbatim and this derivation is deleted. Say so in the model's docblock.

**14 — The six-way movement split may be shown as a proportion, because it is a measured
partition — and the dev must re-measure before trusting that.**
Measured over all 104 records / **3,289 player rows**: `sum(offers_by_movement_type) ==
total_offers` with a delta histogram of exactly `{0: 3289}`. **Zero mismatches.**
This is deliberately unlike two ledgered traps you will otherwise assume apply: 1.13's `by_phase`
totals are **independent, not slices** (`−48..+314`, grep `"never sum them"`), and Domain C's
phases carry a "never normalize, never pie" `$comment`. **Re-derive the partition yourself (Task
2.1) before rendering a proportion.** If it ever fails, fall back to six paired absolute values
and never a normalized bar.
Include **`no-movement`**. It is 24.9% of all corpus offers — the ledger's "the movement map
prints only FIVE types" note (grep `"has six values; the movement map prints exactly FIVE"`)
constrains the *movement page's grid*, not Domain G, the one source carrying the sixth value.
Rendering five would hide a quarter of the data.

**15 — The proportion bar: one bar per team in that team's accent; categories carried by order,
direct labels and hairline separators. No second hue, no chart library.**
There is **no six-value categorical ramp in DESIGN.md**. The available ramps are the wrong length
and the wrong canvas: `--heat-*` and `--edge-weight-*` are five-stop and **on-pitch only**
(decision 12 measured `heat-5` at 1.12:1 on the light card, which is where these sections live).
Using the two team accents for categories would collide with decision 8 and breach DESIGN.md:260's
"a chart never mixes team encoding with outcome encoding".
**RULED:** each team gets one horizontal bar filled in its own `--viz-team-a` / `--viz-team-b`
(the theme-aware canvas variants — these are cards, not the pitch), segmented by category in the
frozen order of decision 16, with `--border-hairline` separators between segments. Category
identity is carried by a **labelled value list beneath the bar** (category name + count + share),
never by hue and never by an in-segment label. That value list is also the bar's text alternative.
**Minimum segment width:** the two smallest corpus categories are `out-to-in` at **2.3%** and
`in-to-out` at **3.1%** of all offers, which at 320 CSS px on a ~296 px bar are **~7–9 px** — a
label cannot go inside them (DESIGN.md:303 sets a hard 11 px type floor) and a sub-pixel segment
would vanish. Enforce a minimum rendered segment width for any non-zero category and note in the
Dev Record that the bar is therefore not pixel-proportional at the extremes.
*Rejected alternative:* a recharts bar chart — it would add a second theme-aware canvas, inherit
the tick defect 2.6 found live and filed against 2.10/2.13/2.15/2.16 (automatic y-ticks are
non-uniform and **omit zero** on an un-nice domain), and buy no readability over six labelled
values. **No new runtime dependency; recharts is installed but is not used here.**

**16 — One frozen, ordered code list per enum. This is what the ban in decision 5 does NOT cover.**
`OfferMovementCounts`'s properties are camelCase (`inFront`, `inBetween`, `outToIn`, `inToOut`,
`inBehind`, `noMovement`) while `OfferMovementType`'s codes are kebab (`in-front`, `in-between`,
`out-to-in`, `in-to-out`, `in-behind`, `no-movement`). AD-7 keys locale labels by **enum code**, so
a mapping is mandatory. Export from `receiving-model.ts`:
`OFFER_MOVEMENT_TYPES: readonly OfferMovementType[]` in the schema's declaration order, and
`OFFER_MOVEMENT_PROPERTY: Record<OfferMovementType, keyof OfferMovementCounts>`. Export from
`defensive-actions-model.ts`: `DEFENSIVE_ACTION_TYPES: readonly DefensiveActionType[]` in the
schema's declaration order. Both typed as `Record`/array over the **generated union**, so a
contract enum change is a compile error. Add matching key-builder functions
(`offerMovementKey(code)`, `defensiveActionKey(code)`) on the shipped `shotOutcomeKey` /
`crossDeliveryKey` pattern — the `i18n.test.ts` exhaustiveness template consumes exactly these.

**17 — `<md` for the two card sections: stacked, no team tabs. Declared departure from
`EXPERIENCE.md:130` / UX-DR17.**
That row rules "team tabs, one vertical pitch" for all three sections; it presumes pitches. Team
tabs exist to stop two 68 m-wide pitches from being unreadable side by side — a constraint two
stacked value lists do not have, and tabs would hide one team's numbers behind a control for no
gain. **RULED:** at `<md`, both card sections render the two teams **stacked vertically, both
visible, no tabs, no toggle**. At `≥md` they sit side by side. `#defensive-actions` keeps
`PitchPanel`'s shipped tab behaviour untouched. Declared in AC 1 (c-ii).

**18 — No selection / pinning on any 2.9 surface. Pass `selection` undefined.**
Pinning exists to isolate a node's *relationships*; there are no edges and no relationships on
this map, so there is nothing to isolate. `PitchPanel` with `selection` absent is byte-identical
to its pre-2.8 behaviour: no `aria-pressed`, no dimming, no selection ring. Consequence to record
rather than assume: the deferred item "a selected marker forced to the front can outrank the
cluster's described front member" (grep `"outrank the cluster's described front member"`) is **not
reachable from this story** and stays deferred.

**19 — The `#defensive-actions` legend is ONE ENTRY PER TEAM. `actionType` is not a visual
channel.**
Decision 6 adds exactly one shape and decision 8 rules team-only colour, so `forced-turnover` and
`possession-regain` are **visually identical on the map**. A per-type legend would therefore claim
a distinction the map does not draw — the same class of lie decision 5 exists to prevent,
inverted. Compare the shipped cross legend, where shape genuinely carries completion inside the
team accent.
**RULED:** the legend is one `kind: "mark"` entry per team — `triangle-filled` in that team's
`-on-pitch` accent, labelled with the team code and the section's noun. `actionType` reaches the
reader through the marker's **accessible name** (the qualifier clause), the **popover**, and the
**log table column** — three non-visual carriers, none of which over-claims.
*Rejected alternative:* a second visual channel (e.g. hollow vs filled triangle) to separate the
two plottable types — it would contradict UX-DR10's "filled triangle = defensive action" and
decision 6's one-shape ruling, and it is a UX call this story does not have. File it (Task 8.1)
alongside the diamond question so both land in one UX decision.

**20 — `contestType` is a WHOLE-COLUMN decision, on the FD-1 precedent.**
The shipped precedent is column-level omission when every value is null (grep `showXg` in
`ShotMapsSection.tsx`). On corpus-real data `contest_type` is null on **20,169 / 20,169**, so a
per-cell em dash would ship a column of 20,169 em dashes.
**RULED:** the log table's contest-type column renders **only when `anyContestType(rows)`** is
true; otherwise the column is absent entirely. Independently, the **popover** omits its
contest-type row whenever that marker's value is null. Both pinned by tests.

**21 — The receiving surfaces sit on a CARD, not the pitch. Use theme-aware ink.**
This is the one place a light-theme contrast defect can still land in this story, and it is where
2.6's failure came from. `PitchPanel`'s table cell classes (`text-ink-on-pitch`,
`border-pitch-line/40`) are **wrong** on a card — `--ink-on-pitch` computes **1.10:1** on the
white card. Follow `MomentumSection`'s table classes instead (`text-ink-primary`, hairline
borders) and pass `ViewDataDisclosure surface="canvas"`. `#defensive-actions` uses `PitchPanel`
and therefore the default `surface="pitch"`; do not pass `surface` there.
Measured for the aggregate surfaces' team accents on `--surface-raised`: dark **13.56 / 10.30**,
light **4.99 / 5.36** — both clear 4.5:1 in both themes. Confirm live anyway (Task 9.3).

**22 — The two card surfaces are `role="figure"` with a localized `aria-label`, supplied by the
section.**
`PitchPanel` provides this automatically, which is why `#defensive-actions` needs nothing — but
the two aggregate surfaces do not go through it. The shipped non-`PitchPanel` precedent is
`MomentumChart`'s `role="figure" aria-label={figureLabel}`, composed in `MomentumSection`.
Each team's block on each card section carries its own `role="figure"` and a one-sentence
localized summary naming the team and its headline numbers. **The prop may not be called `label`,
`description`, `caption`, `title`, `text` or `heading`** — all six are gated by the i18n ESLint
rule. Use the house naming: `figureSummary`.

**23 — Head-to-head values carry the ruled leader treatment (UX-DR7), built locally.**
Two teams' offers side by side is a head-to-head pair, so the leading value takes the team accent
**plus** the non-colour leader cue (the ▲ glyph and the spoken leader word in the accessible
name) — colour alone never encodes who leads. Reuse `resolveLeader` from `@/lib/match-hero`
(already the AD-5-legal "leader-accent determination between two displayed values" and already
imported by `tactical-sections.ts`); **never re-implement it.** The shipped `StatPairTile` in
`KeyStatisticsSection` is private — build a local presentation, and do **not** refactor or import
from that file.

## Tasks / Subtasks

- [x] **Task 1 — Baseline and orientation** (no AC)
  - [x] 1.1 `npm test` in `app/`. Expected **364 passed / 16 files**, green. Re-measure; do not
        inherit the number. `npm test` is **not** part of `npm run build`.
  - [x] 1.2 `npm run check:types` and `npm run assert:schema-version` — both green at story
        creation. If `check:types` fails, run `npm run generate:types` and continue; **never**
        hand-edit generated types. If `assert:schema-version` fails, **stop and reconcile**.
  - [x] 1.3 Confirm `npm run build` is green at HEAD (chain: `eslint . --max-warnings 0` →
        `tsc --noEmit` → `assert:schema-version` → `next build` → `copy-data`).
  - [x] 1.4 `git status`: the tree is shared with in-flight **1-9** and **1-15** pipeline
        sessions. `app/` is clean at `dd3dfc3`; `pipeline/**` and the two shared artifacts are
        not. Read Dev Notes → "Coordination & hygiene" before your first commit.

- [x] **Task 2 — `app/src/viz/receiving-model.ts`** (AC 1b) — pure, testable, no React, no DOM,
      no `t()`, no `@/lib/format`. `src/viz/**` is inside the ESLint client-import seam: return
      `DictionaryKey`s and raw numbers only.
  - [x] 2.1 **Re-derive decision 14's partition before writing a renderer.** Over all three
        fixtures assert `sum(offersByMovementType) === totalOffers` for every player. Ship it as a
        test, not a comment. If it fails, stop and re-read decision 14.
  - [x] 2.2 Decision 16's two exports: `OFFER_MOVEMENT_TYPES` and `OFFER_MOVEMENT_PROPERTY`, plus
        `offerMovementKey(code)`. Typed over the generated union so a contract change is a
        compile error.
  - [x] 2.3 `offersSummary(players, home, away)` → per-team `{teamId, teamCode, offersMade,
        offersReceived, receivedPct, playerCount, leader…}` using `resolveLeader` (decision 23).
        Docblock states decision 13's conditions **and its declared reading**, plus the "delete
        this if 1.16 emits a team block" binding. `receivedPct` is `null` when `offersMade === 0`
        — never `NaN`, never `0`.
  - [x] 2.4 `offersRows(players, home, away)` → per-player rows `{playerId, playerName,
        shirtNumber, teamCode, offersMade, offersReceived, receivedPct}`, default order **team
        then shirt number**. Mint a caption key stating that order — `viz.table.caption` is
        literally "Ordenado por minuto." and would be a false claim on clock-less rows.
  - [x] 2.5 `movementSplit(players, home, away)` → per team, the six categories in
        `OFFER_MOVEMENT_TYPES` order, each `{code, count, share}`. `share` is `count / total`;
        `total === 0` yields `share: 0` for every category plus a flag the component uses to
        render the zero line instead of a bar.
  - [x] 2.6 `movementRows(...)` → per-player six-column rows, same default order as 2.4.
  - [x] 2.7 **Team-totals rows for decision 11**: a `teamTotalsRow` shape per section carrying
        exactly the values the tiles and the bar display, so each disclosure can render them
        alongside the per-player breakdown.
  - [x] 2.8 Zero-state guards per decision 10, each with its own test: `players: []`; a team with
        no rows; **and a CONSTRUCTED player row with `totalOffers: 0`** — no fixture carries one
        (0 of 96), so the `receivedPct` zero-divisor branch is otherwise untested while being live
        on 81 of 3,289 real rows. Use `resolveSide` from `marker-model.ts` so a stray `teamId`
        fails loud in one place.
  - [x] 2.9 `receiving-model.test.ts` — all three fixtures, every time, following
        `shot-map-model.test.ts`'s structure (fixtures via `node:fs`, not `@/lib/build-data`,
        which the seam bars in `src/viz/**`).

- [x] **Task 3 — `app/src/viz/defensive-actions-model.ts`** (AC 1a)
  - [x] 3.1 `DEFENSIVE_ACTION_TYPES` + `defensiveActionKey(code)` per decision 16.
  - [x] 3.2 `defensiveMarkers(events, home, away)` → `PitchMarker[]` per side.
        `shape: "triangle-filled"`, `colorVar` the side's `-on-pitch` accent,
        `key: \`defensive-${artifactIndex}\`` (into the **artifact** array — data, not layout),
        `x`/`y` **verbatim**, never clamped.
  - [x] 3.3 Accessible-name pieces per `markerName`'s three-clause contract (grep `function
        markerName` in `PitchPanel.tsx`): `namePrefixKey` = `viz.defensiveActions.markerPrefix`;
        `subjectName` the player name **or `null`** (→ spoken `viz.marker.unknownPlayer`);
        `minutePrefixKey` = `viz.defensiveActions.minutePrefix`; `minuteLabel` the formatted stamp
        **or `null`** (→ `viz.marker.unknownMinute`); `qualifierKey` = `defensiveActionKey(code)`
        — the action type's only visual-free carrier under decision 19. Unlike 2.8, these events
        **do** carry a real clock in the contract, so the middle clause is used for its actual
        purpose; do not repeat 2.8's positional overload.
  - [x] 3.4 **`detail` rows — the UX-DR9 popover, specified.** In order: team, player, minute,
        action type, contest type. Player and minute use `{kind:"key", value:"viz.table.unknown"}`
        when absent (the popover is visual, so the em dash is right there — unlike the spoken
        name, which uses the words). **The contest-type row is omitted entirely when null**
        (decision 20). Rule the all-unknown case explicitly: on corpus-real data the popover shows
        team + action type + two em dashes — assert exactly that in a test, so nobody later reads
        it as a bug.
  - [x] 3.5 `defensiveLegend(sides)` → one entry per team per decision 19:
        `{kind: "mark", shape: "triangle-filled", colorVar: <side accent>, label: <team code +
        noun>}`. Assert in a test that the legend length equals the number of sides with markers,
        **never** the number of action types present.
  - [x] 3.6 `defensiveRows(...)` → log rows `{teamCode, playerName, minuteLabel, x, y,
        actionTypeKey, contestTypeKey}` plus `anyContestType(rows)` for decision 20's column gate.
        Default order `orderByMinute` (imported, never re-implemented).
  - [x] 3.7 A constructed test event with `playerName` absent, `at` absent and `contestType: null`
        — the corpus shape no fixture can produce (decision 5). **This shape is not constructible
        through the types**: `DefensiveActionEvent` declares `playerName: string` and
        `at: MinuteStamp`, both required and non-nullable, so the test must go through an explicit
        `as unknown as DefensiveActionEvent` cast. That is **authorised here and only here**, and
        it is legitimate: bundles reach the App as `as`-cast unvalidated JSON, which is exactly
        the path this test simulates. Comment the cast with that reason. Assert the marker name degrades to
        the two spoken placeholders, the popover omits the contest row, and `anyContestType`
        returns false so the column disappears.
  - [x] 3.8 Zero-state guard: `defensiveActions: []` returns `[]` markers, `[]` rows and an empty
        legend, with no throw.

- [x] **Task 4 — `MarkerShape` gains `triangle-filled`** (AC 1a)
  - [x] 4.1 `marker-model.ts` — add `| "triangle-filled"` to the union; export
        `TRIANGLE_CIRCUMRADIUS_RATIO = 4 / 3` beside `MARKER_RADIUS_PX`; export a **pure**
        `trianglePoints(radius: number): [number, number][]` returning the three vertices of
        decision 7. The pure function exists so Task 4.3 is testable — the harness has no jsdom
        and vertices buried in JSX cannot be asserted.
  - [x] 4.2 `PitchPanel.tsx` `MarkerShapeGlyph` switch — add the case, consuming
        `trianglePoints`, respecting `scale`. **Additive only**: do not touch any other branch and
        do not touch the `never` default.
  - [x] 4.3 Property test over `trianglePoints`: bounding box is `R·√3` wide by `1.5·R` tall with
        `R = 4r/3` — i.e. **height exactly `2r`** — at `r = 6` and at a scaled radius; the
        centroid is the origin; the apex is at `(0, −R)`; and both axes fall inside DESIGN's
        8–14 px band at `r = 6`.

- [x] **Task 5 — Section registration** (AC 1)
  - [x] 5.1 `TacticalLayer.tsx` — split the three ids out of the `PendingSectionPanel`
        fall-through into three real cases. Follow the existing prop-wiring pattern: narrow
        explicit props, never the whole bundle; `SideRef` triples from
        `bundle.metadata.{home,away}Team` with `.teamCode.toUpperCase()`.
  - [x] 5.2 `tactical-sections.ts` — decision 3's predicate change, and **only** that. Replace
        the existing "flips both receiving sections together" assertion with a four-way truth
        table over `{players, events.receiving} × {null, [], populated}`, on the model of 2.7's
        `shot-maps` table. The existing `withEvents(...)` helper patches `events` only — you need
        a sibling helper that patches `players`. `#defensive-actions` assertions stay unchanged.
  - [x] 5.3 Decision 4's empty-state overrides for the two receiving ids, headline **and**
        explanation, wired in `TacticalLayer` beside the `momentum` precedent.
  - [x] 5.4 Confirm `SECTION_IDS` still has length 11 and the same order — the existing literal
        assertions must pass untouched.

- [x] **Task 6 — The three components** (AC 1)
  - [x] 6.1 `DefensiveActionsSection.tsx` — one `PitchPanel`, two sides, `legend` from Task 3.5,
        `dataTable` from 3.6 (with decision 20's column gate), **no `selection`**, **no
        `underlay`**. There is no `extent` prop — `PitchPanel` pools one internally from both
        sides, so the full pitch happens on its own. Section `<h2>` is owned by `TacticalSection`; the panel title is
        `<h3>`; the team code is a label, never a heading.
  - [x] 6.2 `OffersToReceiveSection.tsx` — per-team blocks (made / received / received-%) with
        decision 23's leader treatment, each a `role="figure"` with its own `figureSummary`
        (decision 22); stacked at `<md`, side by side at `≥md` (decision 17). Data table behind
        `ViewDataDisclosure surface="canvas"`, carrying **both** the team-totals row and the
        per-player rows (decision 11). Card ink per decision 21.
  - [x] 6.3 `MovementToReceiveSection.tsx` — decision 15's bar plus its labelled value list per
        team, each a `role="figure"` with its own `figureSummary`; same `<md` rule; same
        two-part data table.
  - [x] 6.4 `ViewDataDisclosure` requires a **`panelTitle`** — supply a distinct one per section
        so the page never ships indistinguishable "Ver los datos" buttons (a defect the 2.7 review
        already patched once). Also pass the permanent attribution caption via `trailing`, as
        `MomentumSection` does — UX-DR21 applies to the card surfaces too.
  - [x] 6.5 Zero-content views: each section renders a dedicated zero line when its slice is
        present but empty (`[]`, or every player at zero offers) — **never** an `EmptyStatePanel`,
        which belongs to the `null` branch and is rendered by `TacticalLayer` above you.
  - [x] 6.6 Data tables: a fourth (and fifth, sixth) private copy of the `DataTable` helper is the
        **current convention** — `PassNetworksSection` says so explicitly. Do not refactor
        `DataTable` out of `ShotMapsSection`. Each caption states its own content and order.
  - [x] 6.7 **Player names are plain text, never links.** `/players/{slug}` does not exist in
        `src/app/`, so a link 404s in the static export; UX-DR22's cross-link rule is scoped to
        *lineup* names. These are the project's first per-player tables keyed on `playerId` and
        Story 1.15 has just landed stable ids — the temptation is real, the route is not.
  - [x] 6.8 Not sortable. Story 2.11 owns `aria-sort`, the `Intl.Collator('es')` sort and the
        Expert-layer instance of these logs. State it in a comment, as 2.7 and 2.8 did.

- [x] **Task 7 — Locales** (AC 1) — `es.ts` is canonical; `en.ts` must mirror its key shape
      **exactly**, no empty leaves. Build the full key table in the story's Dev Record.
  - [x] 7.1 New namespaces `viz.offers.*`, `viz.movement.*`, `viz.defensiveActions.*`, each on the
        shipped per-viz pattern: `title`, `figurePrefix`, `markerPrefix` / `minutePrefix` (defensive
        only), `zero`, and counters with **singular AND plural** forms (`t()` has no plural
        machinery — "1 ofrecimientos" is a visible copy defect in both languages).
  - [x] 7.2 Caption keys for the four new tables (Tasks 2.4, 2.6, 2.7, 3.6), each stating its own
        order; `panelTitle` strings for Task 6.4; tile/value-list labels; the leader word for
        decision 23; the `figureSummary` fragments for decision 22.
  - [x] 7.3 Enum label namespaces keyed by contract code per AD-7: `OfferMovementType` (six) and
        `DefensiveActionType` (four — label all four even though two are unplottable; the log
        table and any future emission may carry them), plus `PossessionContestType` (six) for
        decision 20's column when present. LatAm register per UX-DR19.
  - [x] 7.4 Decision 4's two empty-state override strings (headline + explanation) naming the real
        absence.
  - [x] 7.5 Exhaustiveness tests on the shipped `i18n.test.ts` template: one label per enum value
        in **both** locales, driven by Task 2.2 / 3.1's frozen ordered lists.

- [x] **Task 8 — Ledger, docs and disclosure** (AC 1c, AC 1d, AC 2) — **every edit APPEND-ONLY**
  - [x] 8.1 File: UX-DR10's hollow-diamond / filled-diamond encoding has **no surface**, with
        DESIGN.md:282's own falsified `[ASSUMPTION]` quoted; and decision 19's open question
        (whether the two plottable defensive types deserve a second visual channel). Route both to
        UX as **one** decision.
  - [x] 8.2 File: the re-scope itself — what the two receiving sections now read, why, and that
        Story 1.13's richer `domains.receiving` aggregates remain the candidate input for a
        successor AD-14 change-set (never CS-1). Owner: **1.16**.
  - [x] 8.3 File: **the heatmap deferral**, decision 12 in full, including the measured ramp
        figures and the card-contrast warning, routed to **Story 1.16** by name. This is AC 2's
        deliverable.
  - [x] 8.4 File: decision 9's **ruling** — mirror the goal furniture — with the implementation
        notes (the `PitchMarkings` interface and `PitchDrawing` both need new fields/elements; the
        `goal` depth offset is direction-dependent px and must be reversed by hand; `penaltyArc`'s
        angle range must be reflected, not projected; and it will visibly change 2.8's shipped
        figures). Route to whichever story next owns `pitch-geometry.ts` and `PitchPanel.tsx`
        together, or to 2.19.
  - [x] 8.5 Re-file the whole-layer error-boundary blast radius with this story's contribution:
        three more eager-throw surfaces behind one boundary, on the densest marker family in the
        project.
  - [x] 8.6 File, routed to **Story 2.11** by name: `epics.md:848` and `EXPERIENCE.md:207` both
        require a **receiving log** in the Expert Layer. It is unbuildable — there are no receiving
        events — and the defensive-actions log will carry no player and no minute on real data.
        2.11's AC needs the same re-scope this story took.
  - [x] 8.7 Correct in place: `deferred-work.md`'s prediction that "Story 2.9 will do the same"
        (the positional overload of `minutePrefixKey`/`minuteLabel`) is **falsified** — Task 3.3
        uses the middle clause for a real clock. The rename remains routed to whoever touches all
        five files.
  - [x] 8.8 File: `#defensive-actions` legends per team, not per type, because two of four
        `DefensiveActionType` values are unpopulatable — so 1.16's emission must not be read as
        incomplete when only two types appear.
  - [x] 8.9 `sprint-status.yaml` — append the status line. **Never `git add -A`.** Stage exactly
        `app/`, this story file, `deferred-work.md`, `sprint-status.yaml`. If your commit carries
        any in-flight 1-9 / 1-15 lines, **disclose it in the Completion Notes**.

- [x] **Task 9 — Verification** (all ACs). The harness has **no jsdom**, so nothing rendered can
      be unit-tested. Both defects 2.7's review found were in `PitchPanel.tsx` and were
      structurally invisible to a green suite. Adopt 2.7's / 2.8's mitigation proactively.
  - [x] 9.1 **Cluster distribution, measured — do not assume.** Run the shipped pure functions
        over all three fixtures at **320 / 386 / 527 / 768 / 1920** px and record cluster counts,
        the smallest cluster hit-union, and the singleton share. **2.8's decision 6a shipped on a
        false premise** ("most clusters are singletons" — actually 4 of 22 at ≥lg). This story's
        map carries **30–59 markers per figure** in the fixtures against the pass network's 11 —
        and the **corpus is 2–3× denser again: min 62 / median 97 / max 153 per team-inning**
        over 208 innings, so the shipped fixture numbers are the floor, not the budget. Expect the
        dialog path to dominate, and say what happens at 153. Report the numbers; if the smallest hit union falls below 44 px,
        say so.
  - [x] 9.2 **Render and inspect all three new sections**, at `≥lg` and `<md`, on all three
        fixtures, both themes. Specifically: the triangle glyph's size and weight against a shot
        and a cross marker on the same page (decision 7's extent-vs-area trade-off is a visual
        call — confirm it); the two-entry per-team legend; the tiles and their leader glyph; the
        proportion bar and its value list, including the ~2.3% category's minimum segment width.
  - [x] 9.3 **Contrast, both themes, method validated first.** Reproduce a published figure before
        trusting a new one (the 2.6 method): `--viz-team-a-on-pitch` must compute **9.56** and
        `-b-on-pitch` **7.26** vs `--pitch-surface`. Then measure, on the **card**: the two team
        accents on `--surface-raised`, the bar fills and hairline separators, the tile ink, the
        leader glyph, and the "Ver los datos" control in the `canvas` variant. Record as a
        `| element | dark | light | floor |` table.
  - [x] 9.4 **Keyboard, live, with real key presses.** Roving in `orderByMinute` order with no
        wrap; `Enter` on a singleton opens the hover panel; `Enter` on a cluster opens the dialog
        with focus on its first item; arrows rove inside it; `Esc` closes and returns focus. With
        `selection` absent there is **no** pin state — confirm no `aria-pressed` is emitted
        anywhere on these figures. Then tab the two card sections end to end.
  - [x] 9.5 **Screen-reader pass on the two card surfaces**: each team block announces as a figure
        with its localized summary; the bar's value list is reachable as text; the leader is
        announced by word, not by colour.
  - [x] 9.6 **Reflow**: `scrollWidth === clientWidth` at **320** and **390** CSS px; none of the
        three new sections may join the overflow list, and the six-category bar plus its value
        list must not force horizontal scroll (data tables keep their internal-scroll exception).
        Chrome will not resize below ~500 px — use a same-origin 320/390 px iframe so `matchMedia`
        reflects the iframe viewport and `MD_MEDIA_QUERY` evaluates genuinely false. **The 195 px
        failure is pre-existing and 2.19's — do not attempt it.**
  - [x] 9.7 **Reduced motion**: add no animation or transition; verify
        `getAnimations({subtree: true})` returns 0.
  - [x] 9.8 **EN toggle after load** and **theme toggle after load**, on all three fixtures. No
        mixed-language page; no hardcoded string.
  - [x] 9.9 **Static-output guards**: both `src/app/static-output.test.ts` and
        `src/app/matches/static-output.test.ts` (the AR-11 absence guard over all eleven section
        ids) stay green. If the latter goes red, something moved the Tactical Layer to the
        build-time path — the one change this story must not make.
  - [x] 9.10 **Serving mechanics**: `next dev` cannot serve `/data/fixtures`; only `copy-data`
        populates `out/`. Verify against `python -m http.server 8765 --directory app/out`.
        `trailingSlash: true`, so deep links are `/matches/{slug}/#anchor`. Turbopack reuses chunk
        filenames — hard-reload (Ctrl+Shift+R) before every browser check.
  - [x] 9.11 **Full chain green**: `npm run build`, **then** `npm test` (the static-output tests
        read `out/`). Report the new suite total against the **364 / 16** baseline.

## Dev Notes

### The premise overturn, measured

Every figure below was measured at story creation against the ledger, the 104 staged Extraction
Records in `work/extracted/`, and the three committed fixtures. **Re-derive anything you intend to
rely on** — these are a map of the terrain, not a substitute for measuring it. The probe
overturning the story spec is the norm in this project, not the exception.

| The epic assumes | The corpus says |
|---|---|
| Three marker maps from `ReceivingEvent` / `DefensiveActionEvent` | One map. `ReceivingEvent` is unfulfillable in **all eight** required fields over 104 reports / 416 pages |
| "Offering to Receive {team}" is a marker scatter | 11 filled 8.229 pt circles per panel, **byte-identical between panels on 208/208** and identical across every team page — a static formation template with zero per-report information |
| "Movement to Receive {team}" is a marker scatter | **Zero** markers. It is a three-thirds bar chart |
| `DefensiveActionEvent` gives four spatial types | **Two.** `block` and `possession-contest` are aggregate panels with no coordinates anywhere in the corpus |
| Defensive events carry player, clock and contest type | `contest_type` is `null` on **20,169 / 20,169**; `playerId`/`playerName`/`at` have no carrier at all |

### The fixtures will train you into a defect

`data/fixtures/README.md` lists cross, receiving, pass-network and defensive-action events under
**"Synthetic, deterministic, plausible"**, and every pitch coordinate on every event as synthetic.
Measured, so you know exactly how far they diverge:

| | m001 | m002 | m074 |
|---|---|---|---|
| `receiving` events | 87 | 87 | 96 |
| `defensiveActions` events | 63 | 70 | 104 |
| …per team figure | 31 / 32 | 30 / 40 | 45 / 59 |
| `block` + `possession-contest` share | **44%** | **47%** | **55%** |
| rows with `at` populated | 100% | 100% | 100% |
| rows with `playerName` populated | 100% | 100% | 100% |
| `contestType` non-null | 11 / 63 | 14 / 70 | 35 / 104 |
| defensive `x` range | 9.6–64.2 | 8.3–64.1 | 9.4–64.3 |

The fixture even carries `movementType: "no-movement"` on receiving events — a value the movement
page never prints. **Build to decision 5's field set, not to what you see on screen.**

**And the fixtures under-state the density by 2–3×.** Corpus, over 208 team-innings / 20,169
events: **min 62 / median 97 / max 153** markers per team figure, against the fixtures' 30–59.
Everything that scales with marker count — clustering, the ≥44 px hit floor, the dialog-vs-popover
split, the log table's length — must be reasoned about at **153**, not at 59 (Task 9.1).

The `x` range is why decision 9 exists: every defensive figure is a **full pitch**.

### The source you actually build the receiving sections on

`bundle.players[]` — a flat array of `PlayerRecord`, `PlayerRecords | null`, 31 rows in m001. Each
row: `{playerId, playerName, shirtNumber, position, teamId, inPossession, outOfPossession,
physical}`. `inPossession` carries, all three `required`:

```
totalOffers          Count
offersReceived       Count
offersByMovementType OfferMovementCounts   // required: inFront, inBetween, outToIn,
                                           //           inToOut, inBehind, noMovement
```

Measured over all 104 staged records / **3,289 player rows**:

| | min | median | max |
|---|---|---|---|
| per-team offers made | **69** | **333** | **634** |
| per-team offers received | **20** | **119.5** | **247** |
| rows per team-inning | 13 | 16 | 17 |
| players with `total_offers == 0` | — | — | **81 of 3,289** |

`sum(offers_by_movement_type) == total_offers` on **3,289 / 3,289** rows, delta histogram exactly
`{0: 3289}`. Corpus category totals: `in_behind 18,426 · no_movement 17,576 · in_front 16,940 ·
in_between 13,840 · in_to_out 2,215 · out_to_in 1,634` — **`no_movement` is 24.9%** of all offers,
and the two smallest categories are **3.1%** and **2.3%** (decision 15's minimum-segment problem).

And the roll-up validation that makes decision 13 more than a legal reading: those per-team figures
— 69 / 333 / 634 and 20 / 119.5 / 247 — are **identical** to
`domains.receiving.offers.*.total_offers_made` and `.total_offers_received`, i.e. the receiving
page's own printed headline. Story 1.13 already proved this reconciles on 208/208 team-innings.

### What already exists — reuse it, do not rebuild it

- **`PitchPanel` gives `#defensive-actions` almost everything.** Supply `title`, exactly two
  `PitchPanelSide`s, `legend`, `dataTable`. You get for free: the shared per-panel extent, Voronoi
  hit cells, the ≥44 px floor, clustering, popovers, cluster dialogs, roving tabindex, the focus
  ring, `<md` team tabs, the orientation flip, the `role="figure"` wrappers, the
  `ViewDataDisclosure` and the permanent attribution caption.
  `PitchPanelSide` = `{teamCode, accent: "a" | "b", markers, metaLine, figureSummary, zeroLine}`,
  every string already resolved by the component.
  **The two card sections go through none of this** — decisions 17, 21 and 22 exist because they
  must supply the figure role, the ink and the responsive rule themselves.
- **All three section ids already exist** — in `SectionId`, `SECTION_IDS`,
  `COLLAPSIBLE_SECTION_IDS`, `sectionDataState`, and both locale files with **title and summary**.
  This story adds no ids and changes no order. The only registry edits are decision 3's predicate,
  decision 4's overrides and `TacticalLayer`'s dispatch.
- **`marker-layout.ts`** owns clustering (`MIN_HIT_PX = 44`), `hitCells`, and `orderByMinute` — the
  roving order **and** the table's default sort, in one place. Import it; never re-implement it.
- **`marker-model.ts`** already exports the panel-generic selection constants and `panelDataState`,
  `resolveSide`, `sideRank`.
- **`resolveLeader`** in `@/lib/match-hero` is the ruled UX-DR7 leader determination. Reuse it.
- **The `--heat-1..5` ramp** exists, tokenised and bridged into Tailwind, with zero consumers.
  Decision 12 leaves it that way.

### The i18n gate — six prior reviews paid for these

- `t()` has **no interpolation and no plural machinery**. Counters need a singular **and** a plural
  key; use the shipped `countPhrase(count, one, many)` helper shape.
- `{t(cond ? "a" : "b")}` **fails the gate**. Hoist the key into a `const … : DictionaryKey`.
- Separator glyphs are module consts, never bare JSX literals.
- **16 prop names are gated** by `no-restricted-syntax`, and only when the attribute value is a
  literal: `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`,
  `aria-braillelabel`, `aria-valuetext`, `title`, `alt`, `placeholder`, `label`, `message`,
  `text`, `description`, `caption`, `heading`, `tooltip` — those six `aria-*` names only, not
  every `aria-*`. `PitchPanelProps.title` exists happily because the rule fires on JSX attributes,
  not on interface members; the risk is the call site. That is
  why `PitchPanelSide` uses `metaLine` / `figureSummary` / `zeroLine` and `EmptyStatePanel` uses
  `headline` / `explanation`. **Name your new component props the same way** (decision 22).
- `en.ts` must mirror `es.ts`'s key shape **exactly**, with no empty leaves.
- `viz.table.caption` is literally `"Ordenado por minuto."` — legitimate for the defensive log,
  **false** for the receiving tables. Mint their own caption keys.

### Project Structure Notes

- `src/viz/**` is **pure**: no React, no DOM, no `t()`, no `@/lib/format`. It returns
  `DictionaryKey`s and raw numbers; components resolve them. That split is the only reason any of
  this is testable in a node-only harness.
- **Client route bodies live in `src/components/`, never colocated under `src/app/`** — that path
  escapes the i18n import seam (a known deferred gap; do not trigger it).
- PascalCase component files in `src/components/`; kebab-case pure modules in `src/viz/`. Tests
  co-located as `<module>.test.ts`.
- Naming follows the registry key: `offers-to-receive` → `OffersToReceiveSection.tsx`, and so on.
- **Heading levels.** `TacticalSection` owns the section `<h2>`. `#defensive-actions`'s panel title
  is an `<h3>` (supplied by `PitchPanel`). For the two card sections, the per-team blocks are
  `role="figure"` with an `aria-label`, **not** headings — the shipped `MomentumSection` precedent
  rules explicitly against promoting a non-section-name into the page outline. A team code is a
  label, never a heading.

### Scope boundaries

**Touch:** `app/src/viz/receiving-model.ts`, `defensive-actions-model.ts` (+ tests);
`app/src/components/OffersToReceiveSection.tsx`, `MovementToReceiveSection.tsx`,
`DefensiveActionsSection.tsx`; `app/src/viz/marker-model.ts` (one union member, two exports);
`app/src/components/PitchPanel.tsx` (**one switch case, additive only**);
`app/src/lib/tactical-sections.ts` + its test (**decision 3's ruled exception, that change only**);
`app/src/components/TacticalLayer.tsx` (three dispatch cases + decision 4's overrides);
`app/src/locales/{es,en}.ts`; `deferred-work.md`; `sprint-status.yaml`; this story file.

**Do not touch:** `pipeline/**` (two sessions are writing it right now), `contract/**`, `data/**`,
`app/src/lib/contract/**` (generated), **`app/src/viz/pitch-geometry.ts`** (decision 9 rules but
does not implement), `TacticalSection.tsx`, `MatchBundleRegion.tsx`, `TacticalErrorBoundary.tsx`,
`ShotMapsSection.tsx`, `PassNetworksSection.tsx`, `KeyStatisticsSection.tsx`, `MomentumSection.tsx`
/ `MomentumChart.tsx`, `marker-layout.ts`, the layout / providers / bootstrap / storage / format
modules, and the vendored `ui/*` components.

**Do not build here:** sortable tables, `aria-sort`, the collator sort, the Expert-layer logs
(**2.11**); phases / pressing / set-plays / goalkeeping (**2.10**); glossary tooltips (**2.18**);
the real-data swap, Lighthouse/axe runs, the 195 px reflow (**2.19**); the heatmap (decision 12);
the mirrored goal furniture (decision 9); a per-section error boundary (decision 10).

**Do not add:** jsdom, Testing Library, a state library, a client cache, a new React Context, or
**any** runtime dependency. recharts is installed but decision 15 forbids using it here.

**Do not "fix":** the `≥lg` heading `<button aria-expanded>` — correct, ruled and tested (2.5
review D1); `m002`'s `momentum: null`; the three private `DataTable` copies; the
`PitchMarker.minutePrefixKey` naming drift; the in-flight pipeline changes in the working tree.

### Known-open items that are NOT this story's

- **The whole-layer error boundary.** Pre-existing architecture; re-file it (Task 8.5), do not
  rebuild it.
- **`tactical-sections.ts` classifies `momentum: undefined` as "ready".** The `!== null` shape is
  worth auditing across all eleven predicates — but 2.9 changes **only** the two receiving cases.
- **`ShotLogRow.minute`'s `?? 0`** contradicting `orderByMinute` → 2.11.
- **Breakpoint-crossing focus loss** and **hash re-entry's three unhandled paths** → deferred,
  both need rulings this story does not have.
- **The selected-vs-fronted marker z-order** → not reachable from 2.9 (decision 18); stays
  deferred.
- **CS-1** does not touch anything this story reads.

### Coordination & hygiene

`pipeline/` is **hot**. Two sessions hold uncommitted work in this shared tree: **1-9** (review —
`domain_e.py`, `errors.py`, `extract_report.py`, `conftest.py`, `checks.py`, `README.md`, three
test modules) and **1-15** (review — the whole new `pipeline/precompute/` package plus two test
modules). `app/` is clean at `dd3dfc3`.

- **Never `git add -A`.** Stage exactly `app/`, this story file, `deferred-work.md`,
  `sprint-status.yaml`.
- **Every shared-artifact edit is APPEND-ONLY.**
- `deferred-work.md` line numbers **drift** — other sessions append to it while you work. Every
  ledger citation in this story is a `grep "<quoted phrase>"`; if a number disagrees, trust the
  phrase.
- Co-commits have happened in **both** directions and both were caught by review. If your commit
  carries any in-flight 1-9 / 1-15 lines, **disclose it in the Completion Notes** — an undisclosed
  co-commit "is how a reviewer loses the ability to tell which story changed what".
- Commit directly to `main` (solo repo); no feature branch, no PR.

### References

- `epics.md:798-813` — Story 2.9's ACs, reproduced verbatim above. `epics.md:848` — 2.11's
  receiving-log AC, now unbuildable (Task 8.6).
- `deferred-work.md` — grep `"unfulfillable in EVERY required field"` (1.13, the headline),
  `"only two of four"` (1.12), ``"`DefensiveActionEvent` requires"`` (1.12),
  `"has six values; the movement map prints exactly FIVE"` (1.13),
  `"never sum them"` (1.13, the non-partition trap),
  `"kills all eleven Tactical sections"` (2.8 review, open),
  `"Whoever owns the next full-pitch surface"` (2.8, ruled by decision 9),
  `"outrank the cluster's described front member"` (2.8 review, not reached),
  `"non-uniform and omit zero"` (2.6 review, dodged by decision 15),
  `"Story 2.9 will do the same"` (2.8, falsified — Task 8.7).
- `DESIGN.md:282` (the shape encoding **and** its falsified `[ASSUMPTION]`), `:219` / `:264` (the
  theme-invariant pitch), `:260` (one meaning per colour per viz), `:280` (shape encoding is
  mandatory), `:286` (the heat ramp), `:303` (11 px type floor), `:355` (snap-to-zone prohibited).
- `EXPERIENCE.md:45` (anchors), `:75` (pitch-panel contract), `:104` (≥44 px, ~8–14 px markers),
  `:113` (accessibility floor + the `[ASSUMPTION]` zone grid), `:119` (320 px reflow), `:130`
  (the responsive row this story departs from), `:206` (the eleven-section order), `:207` (the
  Expert-layer log list), `:221-222` (the Visualization Layering rows), `:272-274` (the three
  section names in Spanish).
- `ARCHITECTURE-SPINE.md:70-74` (AD-5 and its carve-out), `:76-80` (AD-6), `:124-128` (AD-14),
  `:140` (the data-table Consistency Convention), `:234` (the heatmap Deferred entry).
- `2-7-pitch-panel-infrastructure-with-shot-cross-maps.md` — `PitchPanel`'s contract, the
  light-theme disaster, the "second panel in one section" ruling, the per-panel extent amendment.
- `2-8-pass-network-visualization.md` — the second-consumer position, decision 6a's falsified
  premise, and the `[]`-throws incident.
- `2-6-momentum-timeline.md` — the non-`PitchPanel` figure precedent, the `surface="canvas"`
  variant, and the recharts tick defect.
- `1-13-offers-movement-to-receive-parsers.md` and
  `1-9-domains-e-f-extraction-goalkeeping-set-plays.md` — the **in-story re-scope precedent**.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`, via the `bmad-dev-story` workflow.

### Debug Log References

- Baseline (Task 1): `npm test` **364 passed / 16 files**; `npm run check:types` up to date (237 declarations from 6 schemas); `npm run assert:schema-version` green (7 artifacts at schemaVersion 2); `npm run build` green. `git status`: `app/` clean at HEAD `32fc131`, `pipeline/**` dirty with in-flight 1.9 / 1.15 work. (The story's frontmatter `baseline_commit` is `dd3dfc3` and was preserved unchanged; HEAD had since moved to `32fc131`, which carries no `app/` changes.)
- Cluster distribution (Task 9.1): measured with a temporary vitest harness over the shipped pure functions, then deleted. Figures in the Completion Notes.
- Contrast (Task 9.3): measured live in-page with the WCAG relative-luminance formula, method validated first by reproducing the project's published on-pitch numbers exactly.
- Final chain: `npm run build` green, then `npm test` **439 passed / 19 files**.

### Completion Notes List

**What shipped, against what the epic asked for.** The epic asks for three marker maps. The corpus supports one. `#defensive-actions` ships as a real `PitchPanel` map; `#offers-to-receive` and `#movement-to-receive` ship as per-team aggregate card surfaces off `bundle.players[].inPossession`. AC 1 is satisfied as re-expressed in its BINDING block, not waived; AC 2 takes its second branch (heatmap deferred, rationale logged in the ledger). All 23 ruled decisions implemented; three declared readings are recorded below.

**Task 2.1 — decision 14's partition RE-DERIVED before any renderer was written, as the story requires.** `sum(offersByMovementType) === totalOffers` on **96 / 96** fixture player rows across all three fixtures, zero mismatches. Shipped as a test, not a comment, with the row count asserted so a shrinking fixture cannot silently pass. The proportion bar is therefore stating something true; had it failed, the fallback was six paired absolute values and no normalized bar.

**The AD-5 roll-up reproduces the source page's own headline.** Per-team totals computed by `offersSummary` on m001: MEX 390 made / 196 received / 50.26%, RSA 396 / 162 / 40.91% — matching an independent count over the raw fixture JSON exactly, and the same relation Story 1.13 proved reconciles against `domains.receiving.offers.*` on 208/208 team-innings. The declared reading of AD-5's "exactly one surface" (one rendered surface — the match dashboard — not one section) is stated in `offersSummary`'s docblock, together with the binding that the derivation is **deleted** if Story 1.16 ever emits a team-level offers block.

**Triangle geometry verified in the browser, not just in the test.** The rendered `<polygon>` measures **13.86 × 12.00 px** with vertices exactly `(0, −8) (6.928, 4) (−6.928, 4)` — decision 7's ruled numbers, reproduced live. Measured beside the shot family on the same page: hollow circle 10×10, square 11×11. So the triangle is the widest glyph at equal height to the filled circle's diameter, which is the ruled equal-extent trade-off. **Visual call, confirmed:** it reads slightly heavier than the circles, exactly as decision 7 predicts and accepts; the rejected equal-area form (16.16 × 14.00) would have been outside DESIGN's band on both axes.

**Contrast, method validated first (the 2.6 method).** `--viz-team-a-on-pitch` computes **9.56** and `-b-on-pitch` **7.26** vs `--pitch-surface` — the story's published figures, reproduced exactly, in **both** themes (the pitch is theme-invariant, confirmed). Then measured on the card:

| element | dark | light | floor |
|---|---|---|---|
| `--viz-team-a` on `--surface-raised` | 13.56 | 4.99 | 4.5 |
| `--viz-team-b` on `--surface-raised` | 10.30 | 5.36 | 4.5 |
| hairline separator on team-A bar fill | 10.31 | 3.79 | 3 |
| hairline separator on team-B bar fill | 7.84 | 4.07 | 3 |
| `--ink-primary` (tile ink) on `--surface-raised` | 15.81 | 17.67 | 4.5 |
| `--ink-secondary` (labels) on `--surface-raised` | 7.87 | 7.61 | 4.5 |
| "Ver los datos", `surface="canvas"` | 17.30 | 16.44 | 4.5 |
| on-pitch accents vs `--pitch-stripe` | 8.46 / 6.43 | 8.46 / 6.43 | 3 |

Every value clears its floor in both themes. The leader glyph rides the team accent and so is covered by rows 1–2.

**Task 9.1 — cluster distribution measured, and it contradicts an assumption worth recording.** Over all three fixtures at 320 / 386 / 527 / 768 / 1920 px: the **dialog path dominates at every shipped width below 1920** (singleton share 0–42% at 320/386, 41–74% at 527, 31–70% at 768, 90–100% only at 1920). The smallest cluster hit-union measures **~59–131 px across** at every width and fixture, so the ≥44 px floor is never breached. **At 153 markers — the corpus max per team-inning, against the fixtures' 30–59 — the figure collapses to ONE cluster at 320 px** (5 at 386, 8–9 at 527/768, 31 at 1920, zero singletons anywhere). So at real density on a phone the surface is effectively a 153-item cluster dialog rather than a map. It stays usable (`ClusterPopover` clamps its height and scrolls internally), but it is filed to the ledger rather than left to be discovered at the 2.19 cutover.

**Keyboard, verified with real key presses.** `Home` lands on minute 2′ (the earliest event) — roving order is minute order. `Enter` on a clustered marker opens the dialog with focus on **that marker's own list item** ("Punto con 15 eventos"); `ArrowDown` roves inside it; `Escape` closes it and returns focus to the opening marker. **Zero `aria-pressed` attributes anywhere on either figure or inside the dialog**, confirming decision 18's "byte-identical to pre-2.8 behaviour" with `selection` absent. Exactly one tabbable marker per figure.

**Reflow.** At **390 px**: `scrollWidth === clientWidth === 375`, zero offending elements, all three sections expanded. At **320 px**: a 5 px overflow exists — and it is **PROVEN pre-existing, not this story's**. The two offending elements are `div.flex.flex-col.items-center.gap-0.5` and `span.type-stat-value`, both of which sit **outside all three new sections** (Key Statistics' tile — the same element Story 2.6 identified as the 320 px overflow source). None of the three new sections appears in the offenders list at either width. The 195 px failure was not attempted; it is 2.19's.

**`<md` confirmed live in a same-origin iframe** (Chrome will not resize below ~500 px): both card sections render **two figures, both visible, zero team tabs** — decision 17's declared departure from EXPERIENCE.md:130. `#defensive-actions` renders **one figure plus its two team tabs** on a vertical pitch, i.e. PitchPanel's shipped behaviour untouched.

**Reduced motion:** `getAnimations({subtree: true})` returns **0** inside the iframe, and the single animation on the top-level page is `claude-pulse` — the browser extension's own overlay, outside all three sections.

**EN toggle after load:** all three sections switch completely, with **zero Spanish leakage** under a regex sweep for eighteen Spanish fragments. Marker names switch too ("Defensive action by Brian GUTIERREZ, minute 4′, Possession contest"), and number formatting follows the locale (50,3% → 50.3%). Theme toggle after load likewise clean. **Zero console messages** on a full page load with all three sections mounted.

**All three fixtures exercised end to end**, including m002 (426/463 offers, 70 defensive actions) and m074, the densest (435/407 offers; 45/59 markers per figure; the contest-type column present because the fixture populates it, with em dashes on the null rows).

**THREE DECLARED READINGS, stated rather than assumed:**

1. **The count chip carries the TOTAL only** ("31 acciones"), not an enumeration of the action types present. Decision 5 bans a *fixed four*; this is the conservative side of that rule and it is required for coherence with decision 19 — enumerating types beside a legend that deliberately refuses to distinguish them would re-introduce the very distinction the map does not draw. The per-type breakdown reaches the reader through three non-visual carriers instead (accessible name, popover, log column). One line to change if the enumerating reading is preferred.
2. **`defensiveMarkers` takes `(events, home, away)` and returns both sides at once**, rather than the shipped `crossMarkers(crosses, teamId, colorVar)` per-team shape. This is Task 3.2's literal parameter list, and it is the safer form: partitioning through `resolveSide` means a stray `teamId` **names itself** instead of vanishing from both figures. The `-on-pitch` accent still comes from the component's own `ACCENT_VAR`, matching the shipped precedent.
3. **Task 8.7's "correct in place" was served by an APPENDED correction**, not by editing another story's paragraph. Task 8's own header rules every edit append-only and two pipeline sessions held the file open; the append-only property was verified programmatically (the post-edit file starts with the pre-edit bytes exactly).

**Two things NOT done, both deliberate and both filed:** the mirrored goal furniture (decision 9 — ruled "yes, mirror", implementation routed onward with its three implementation notes) and the per-section error boundary (decision 10 — pre-existing architecture, re-filed with this story's added blast radius).

**Task 9.5 — screen-reader pass, scope stated honestly.** Verified structurally rather than with a live screen reader (none is available in this harness): each team block exposes `role="figure"` with a complete localized `aria-label` (e.g. "Ofrecimientos para recibir: Mexico, 390 ofrecimientos, 196 recibidos, % recibido 50,3%"), the bar's value list is a real `<dl>` of text and the bar itself is `aria-hidden`, and the leader is announced by the word "líder"/"leader" in an `sr-only` span beside the ▲ glyph — never by colour alone. Every string was read back from the live DOM in both locales.

**COMMIT SCOPE / CO-COMMIT DISCLOSURE — this commit DOES carry in-flight lines, and here is exactly which.** Staged exactly `app/`, this story file, `deferred-work.md` and `sprint-status.yaml`. `git add -A` was never used, and **no `pipeline/**` file is included** — several were already staged in the shared index by the 1.9 session before this session began, so the commit was made with an explicit pathspec, which commits only the listed paths and leaves the rest of the index untouched.

The two SHARED ARTIFACTS unavoidably carry other sessions' uncommitted work, because they were already dirty in the worktree when this story started:

- **`deferred-work.md` (+36 / −6).** All 36 additions after the `## Filed by Story 2.9 implementation` heading are this story's, and the append-only property was verified programmatically (the post-edit file starts with the pre-edit bytes exactly). **The 6 deletions are NOT this story's** — they are Story 1.15's review session rewriting its own six entries in place to add `**Deferred:**` / `**Owner:**` clauses, and each deleted line has a superseding replacement in the same diff.
- **`sprint-status.yaml` (+209 / −2).** ~45 added lines are this story's status note plus its `development_status` flip to `review`. The remaining ~164 are **Story 1.15's status note**, and both deletions belong to other sessions: `1-9-…: review` → `in-progress` (the 1.15 review's ruled Decision 2) and `2-9-…: backlog` (superseded by this story's own progression through `ready-for-dev` → `in-progress` → `review`).

Nothing above the 2.9 heading in either artifact was edited by this story.

### File List

**New**

- `app/src/viz/receiving-model.ts`
- `app/src/viz/receiving-model.test.ts`
- `app/src/viz/defensive-actions-model.ts`
- `app/src/viz/defensive-actions-model.test.ts`
- `app/src/viz/marker-model.test.ts`
- `app/src/components/OffersToReceiveSection.tsx`
- `app/src/components/MovementToReceiveSection.tsx`
- `app/src/components/DefensiveActionsSection.tsx`

**Modified**

- `app/src/viz/marker-model.ts` — `MarkerShape` gains `triangle-filled`; adds `TRIANGLE_CIRCUMRADIUS_RATIO` and the pure `trianglePoints`.
- `app/src/components/PitchPanel.tsx` — one additive `MarkerShapeGlyph` case plus its import and one geometry const. No other branch touched.
- `app/src/lib/tactical-sections.ts` — ruled decision 3's predicate change, and only that.
- `app/src/lib/tactical-sections.test.ts` — the four-way truth table replacing the "flips both together" assertion.
- `app/src/components/TacticalLayer.tsx` — three dispatch cases, the two empty-state headline overrides and the new parallel explanation override.
- `app/src/locales/es.ts`, `app/src/locales/en.ts` — `viz.offers.*`, `viz.movement.*`, `viz.defensiveActions.*`, seven new `viz.table.*` columns, three new `enums.*` namespaces (six + four + six), and decision 4's two empty-state strings.
- `app/src/lib/i18n.test.ts` — exhaustiveness over the three new enums in both locales, plus the empty-state-override assertions.
- `_bmad-output/implementation-artifacts/deferred-work.md` — nine entries, APPEND-ONLY.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status line, APPEND-ONLY.
- `_bmad-output/implementation-artifacts/2-9-receiving-defensive-action-maps-heatmap-decision.md` — this file.

## Change Log

| Date | Change |
|---|---|
| 2026-08-03 | Story context created. Epic premise overturned and re-scoped in-story by Juan's ruling (decision 1); heatmap deferred with logged rationale (decision 12). Status backlog → ready-for-dev. |
| 2026-08-03 | Implemented. One pitch map (`#defensive-actions`) and two aggregate card surfaces (`#offers-to-receive`, `#movement-to-receive`); `MarkerShape` gains `triangle-filled` only; `sectionDataState`'s two receiving predicates moved to `bundle.players`; heatmap deferred and filed to Story 1.16 by name. Suite 364/16 → 439/19, full chain green. Nine ledger entries appended. Status → review. |

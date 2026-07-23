# `/contract` — the v1 artifact contract

`/data` + `/contract` are the **only** interface between the pipeline and the App (AD-1).
Nothing here imports from `pipeline/`, and nothing presentational — labels, colours, locale
strings, units-as-text — appears in a schema. Units live in the App's locale layer, keyed by
metric code (AD-7).

The schemas are the **single definition** (AD-2). The App consumes the *generated* types and
never a hand-written mirror.

```
version.json                    {"schemaVersion": 1} — the one global version declaration
common.schema.json              ids, closed vocabularies, coordinates, scalars, KnockoutScore
match-bundle.schema.json        one match, Domains A-G, storyStats, momentum
tournament.schema.json          standings + results + route manifest + search source
leaderboards.schema.json        ranked boards keyed by closed metric codes
team-profile.schema.json        tournament-wide tactical identity + per-match rows
player-profile.schema.json      aggregates + per-match series + physical + trends
scripts/generate-types.mjs      the ONLY thing allowed to produce TypeScript from these
generated/                      committed codegen output — the AD-2 spike's evidence
```

## Generating types

```
cd contract
npm install
npm run generate:types            # -> contract/generated/
npm run check:types               # fails if the committed output is stale (CI gate)
node scripts/generate-types.mjs ../app/src/lib/contract   # Story 2.1 re-points it here
```

> **`check:types` is the guard on AD-14 step 5.** It regenerates in memory and compares
> against the committed files, writing nothing. Without it the committed types could — and
> did — drift behind the schemas with the whole suite green, because every other check
> asserts *properties of* the generated file (no index signatures, no collision-suffixed
> names, the version integer) and a stale file satisfies all of them. Comment-only drift
> counts: the generated file is the only thing Epic 2 reads, so a stale JSDoc block is the
> contract saying something the schemas no longer say.
> `pipeline/tests/test_contract_schemas.py::test_the_committed_generated_types_still_match_the_schemas`
> runs the same check from pytest.

> **Story 2.1: do not write a second generator.** The Structural Seed places generated
> contract types under `app/src/lib/`. `app/` does not exist yet, so v1 writes them to
> `contract/generated/` and the output directory is a **parameter** of the script. Point the
> existing script at the new path; a second generator is two definitions of the same thing.

Python-side validation is `pipeline/validate/schema.py` (`validate_artifact`), backed by
`jsonschema[format]==4.26.0` + `referencing==0.37.0`.

---

## Numeric precision

Precision is **declared**, per field, with the custom keyword `x-decimals`. This table is the
record of "per-field numeric precision is fixed" (AC 2). The canonical serializer rounds to
these at emit time (Story 1.16); v1 declares them.

| Kind | `x-decimals` | Type | Where |
| --- | --- | --- | --- |
| Pitch coordinates `PitchX`, `PitchY` | 2 | `number` 0–100 | every spatial event |
| Expected goals | 2 | `number` ≥ 0 | Domain B, shots, profiles |
| Kilometres | 2 | `number` ≥ 0 | team distance covered, sprint distance |
| Momentum values | 2 | `number` | `MomentumSample.home` / `.away` |
| Percentages | 1 | `number` 0–100 | possession, completion %, phases, block share, save % |
| Metres | 1 | `number` ≥ 0 | line height, team length, per-player distances |
| km/h | 1 | `number` ≥ 0 | top speed |
| Counts, minutes, ranks, shirt numbers | 0 | `integer` | everywhere else |

### Why not `multipleOf`

`multipleOf` is the obvious reach for decimal precision and it is a trap. Validators
implement it as a floating-point modulo, and binary floating point makes `0.07 % 0.01 != 0`
for many perfectly legitimate values — you get false validation failures on correct data.
`x-decimals` is an unknown keyword: legal in JSON Schema, ignored by validators, ignored by
the codegen, and greppable. The enforcement is the serializer's job, not the validator's.

---

## Per-family `teamId` semantics (AD-6)

Every spatial event carries an explicit `teamId`, and what it *means* differs per family.
These are pinned in each `$def`'s `$comment` as well as here.

| Event family | `teamId` is |
| --- | --- |
| `ShotEvent` | the **shooting** player's team |
| `ShootoutAttempt` | the **taking** player's team |
| `CrossEvent` | the **crossing** player's team |
| `ReceivingEvent` | the **receiving** player's team |
| `DefensiveActionEvent` | the **defending** team |
| `PassNetworkNode` / `PassNetworkEdge` | the **passing** team |

**Own goals** are the one place this bites. The `ShotEvent` belongs to the player who put the
ball in — his own team — and carries `ownGoal: true`. The `GoalRecord` in
`metadata.goals` is credited to the team that **benefited**. Own goals are excluded from
shot-map rendering entirely, and are not listed in the scorer's `LineupEntry.goals`.

### The pitch frame

0–100 floats over the **full** pitch rectangle, oriented to the acting team's attack
direction: `x = 100` at the opponent's goal line, `y = 0` at the attacking team's left
touchline. Both teams' events therefore live in the same frame and never need flipping by the
App.

---

## Enum provenance

Every open vocabulary was closed by reading the real label text off **all 104 reports** in
`pmsr-corpus/` on 2026-07-22 — not off a sample. That matters: a label variant introduced
mid-tournament would sit in exactly the reports a 16-report sample skips.

Enums are closed **on purpose** (AD-2). A value the pipeline later meets that is not listed is
a *shape change*, which surfaces as a TypeScript compile error in the App. AD-8's
assert-on-unknown at extraction time is the designed safety net. That is the mechanism, not a
bug — do not "fix" it by opening an enum.

### Derived from the corpus

| Enum | Code ← verbatim source label | Source page |
| --- | --- | --- |
| `ShotOutcomeDetail` (22) | `on-target-goal` ← "On Target - Goal"; `on-target-saved` ← "On Target - Saved"; `on-target-defensive-event` ← "On Target - Defensive Event"; `on-target-goal-prevented` ← "On Target - Goal Prevented"; `off-target` ← "Off Target"; `off-target-saved` ← "Off Target - Saved"; `off-target-defensive-event` ← "Off Target - Defensive Event"; `off-target-player-on-ball-error` ← "Off Target - Player On Ball Error"; `deflected-off-target` ← "Deflected Off Target"; `deflected-off-target-saved`; `deflected-off-target-defensive-event`; `deflected-off-target-referee-event`; `deflected-on-target-goal`; `deflected-on-target-saved`; `deflected-on-target-defensive-event`; `deflected-on-target-goal-prevented`; `incomplete-blocked` ← "Incomplete - Blocked"; `incomplete-assist`; `incomplete-defensive-event`; `incomplete-foul-for` ← "Incomplete - Foul For"; `incomplete-player-on-ball-error`; `incomplete-referee-event` | `Attempts at Goal {team}` (event table) — first seen PMSR-M01 p14, M03 p14, M05 p14, M08 p16, M09 p14, M10 p17, M11 p14/16, M12 p14, M16 p14/16, M27 p14/15, M49 p16 |
| `BodyPart` (5) | `right-foot` ← "Right Foot"; `left-foot` ← "Left Foot"; `head` ← "Head"; `upper-body` ← "Upper Body"; `lower-body` ← "Lower Body" | same table — M01 p14, M02 p16, M06 p14 |
| `ShotDeliveryType` (10) | `pass` ← "Pass"; `cross` ← "Cross"; `corner` ← "Corner"; `free-kick` ← "Freekick"; `penalty` ← "Penalty"; `loose-ball` ← "Loose Ball"; `ball-progression` ← "Ball Progression"; `interception` ← "Interception"; `tackle` ← "Tackle"; `other` ← "Other" | same table — M01 p14, M02 p16, M08 p16, M09 p14 |
| `CrossDeliveryType` (6) | `inswing` ← "Inswing" / "In Swing"; `outswing` ← "Outswing" / "Out Swing"; `driven` ← "Driven"; `lofted` ← "Lofted"; `cutback` ← "Cutback"; `push-cross` ← "Push Cross" | `Crosses (Open Play) {team}` M01 p17; `Aerial Control {team}` M01 p35 |
| `DefensiveActionType` (4) | `forced-turnover` ← "Forced Turnovers"; `possession-regain` ← "Possession Regain"; `block` ← "Blocks"; `possession-contest` ← "Possession Contests" | `Defensive Actions {team}` legend — M01 p24 |
| `PossessionContestType` (6) | `pass` ← "Passes"; `attempt-at-goal` ← "Attempts at Goal"; `cross` ← "Crosses"; `clearance` ← "Clearances"; `physical-duel` ← "Physical Duels"; `aerial-duel` ← "Aerial Duels" | `Defensive Actions {team}` contest panel — M01 p24 |
| `OfferMovementType` (6) | `in-front` ← "In Front"; `in-between` ← "In Between"; `out-to-in` ← "Out to In"; `in-to-out` ← "In to Out"; `in-behind` ← "In Behind"; `no-movement` ← "No Movement" | `In Possession - Offers & Receptions {team}` — M01 p42 |
| `InPossessionPhase` (8) | `build-up-unopposed` ← "Build Up Unopposed"; `build-up-opposed`; `progression` ← "Progression"; `final-third` ← "Final Third"; `long-ball` ← "Long Ball"; `attacking-transition` ← "Attacking Transition"; `counter-attack` ← "Counter Attack"; `set-piece` ← "Set Piece" | `{home} Phases of Play {away}` — M01 p3 |
| `OutOfPossessionPhase` (9) | `high-press` ← "High Press"; `mid-press`; `low-press`; `high-block` ← "High Block"; `mid-block`; `low-block`; `recovery` ← "Recovery"; `defensive-transition` ← "Defensive Transition"; `counter-press` ← "Counter-press" | same page — M01 p3 |
| `FeetDistributionTechnique` (6) | `play-onto` ← "Play Onto"; `play-into`; `play-around`; `play-through`; `play-beyond`; `other` ← "Other" | `Goalkeeping Distribution {team}` — M01 p31 |
| `HandsDistributionTechnique` (3) | `side-kick` ← "Side Kick"; `from-hands` ← "From Hands"; `drop-kick` ← "Drop Kick" | same page — M01 p31 |
| `ThrowDistributionTechnique` (4) | `over-arm` ← "Over Arm"; `under-arm`; `side-arm`; `chest` ← "Chest" | same page — M01 p31 |
| `InterventionType` (5) | `save-and-retain` ← "Save & Retain"; `save-and-deflect` ← "Save & Deflect"; `deflect-and-retain` ← "Deflect & Retain"; `save-attempt` ← "Save Attempt"; `no-save-attempt` ← "No Save Attempt" | `Goal Prevention {team}` — M01 p33 |
| `InterventionBodyType` (5) | `head` ← "Head"; `hands` ← "Hands"; `upper-body` ← "Upper Body"; `lower-body` ← "Lower Body"; `feet` ← "Feet" | same page — M01 p33 |
| `AerialInterventionType` (3) | `punch` ← "Punches"; `claim` ← "Claims"; `tipped-palmed` ← "Tipped/Palmed" | `Aerial Control {team}` — M01 p35 |
| `FreeKickType` (4) | `direct` ← "Direct"; `direct-on-target` ← "Direct (on target)"; `direct-off-target` ← "Direct (off target)"; `indirect` ← "Indirect" | `Set Plays {team}` — M01 p38 |
| `CornerDeliveryType` (3) | `direct-to-area` ← "Direct to Area"; `short` ← "Short"; `edge-of-penalty-area` ← "Edge of Penalty Area" | same page — M01 p38 |
| `CornerDeliveryStyle` (4) | `inswing`; `outswing`; `driven`; `lofted` | same page — M01 p38 |
| `PitchSide` (2) | `left` ← "From Left Side"; `right` ← "From Right Side" | same page — M01 p38 |
| `Group` (12) | `a`–`l` ← "Group A" … "Group L" | cover line; all twelve observed across the corpus |

### Settled elsewhere, not re-derived

| Enum | Authority |
| --- | --- |
| `ShotOutcome` (5) | `spike/extract.py`'s exact-RGB → outcome map: `(0.00,0.50,0.00)` goal, `(0.36,0.61,0.84)` on-target, `(0.96,0.74,0.00)` off-target, `(0.70,0.53,1.00)` blocked, `(0.18,0.30,1.00)` incomplete |
| `Stage`, `MatchdayRound` | AD-3 and `pipeline.discover.rounds`. `third-place` is the corpus's "Bronze final" |
| `Position` | `gk\|df\|mf\|fw` — the lineup block's own codes |
| `DistributionType` | `feet\|hands\|throw` |
| `BlockLevel` | `high\|mid\|low` |
| `DecidedBy` | `regulation\|extra-time\|shootout` |
| `ReceivingEventType` | `offer\|movement` |
| `MetricCode` | Not printed anywhere. Derived from the Domain B and Domain G field names and kept **string-identical** to them, so a board's code names the artifact field it ranks |

### Verified against the shot markers

The 22-value `ShotOutcomeDetail` maps onto the 5-value `ShotOutcome` exactly, and the mapping
reconciles with Domain B in all six team-innings of the fixture matches: Mexico's 16 table
rows produce 2 goal + 2 on-target + 8 off-target + 3 blocked + 1 incomplete, and the page's
own marker legend prints exactly those counts. Same for the other five. This is the
marker-count self-validation Story 1.3 automates.

---

## Vocabularies that could NOT be closed

Per Task 2's rule, these are closed on what was observed and recorded here as AD-14
change-flow candidates.

- **`CardType`.** Not derivable from text at all — the lineup block renders cards as coloured
  glyphs and prints only a minute. Closed on the football-universal `yellow` /
  `second-yellow` / `red`. Story 1.6 must read the glyphs; a fourth value is a change request.
- **Cross zones.** The `Crosses (Open Play)` page has a "Cross Zones" panel, but it is a
  zoned pitch graphic carrying counts and **no zone labels**. No enum was invented for it.
  `CrossEvent` instead carries `x`/`y` in the AD-6 pitch frame, which is strictly more
  information than a zone code. If Story 2.7 or 2.9 wants zone aggregates, that is a change
  request — and it should ask for the zone *definition*, not just the counts.

---

## Where the contract is deliberately empty

Three shapes exist in the schema that PMSR does not carry. Each was verified against the full
corpus, each emits `null` in v1, and each is a change request rather than a gap to paper over.

| Field | Finding | Consequence for Epic 2 |
| --- | --- | --- |
| `ShotEvent.expectedGoals` | xG appears **only** as a team total on the Key Statistics page. The shots event table has no xG column, in any of the 104 reports. | Per-shot xG is `null`. A shot tooltip must not promise it. |
| `EventTables.shootoutAttempts` | PMSR prints only the aggregate cover line — `"(Switzerland win 4-3 on Penalties)"`. There is no per-attempt table anywhere, checked against all four shoot-out ties (M74, M75, M88, M96). | Real data emits `null`; the aggregate is in `knockoutScore.shootoutScore`. **The `m074` fixture carries attempt rows anyway**, per this story's fixture plan, so Epic 2 can build the surface — but it must handle `null`, because that is what production will send. |
| `GoalRecord.ownGoal` / `ShotEvent.ownGoal` | No own-goal wording exists anywhere in the corpus. | Real data emits `false` throughout. The `m074` fixture carries a synthetic own goal to exercise the shape. |

`null` and `[]` mean different things throughout the contract, and the App renders them
differently: `null` is "not in the report", `[]` is "zero events". Do not collapse them.

---

## Logged decisions

### 1. Match IDs are zero-padded to three digits

`m073-mexico-argentina`, not `m73-…`. AD-3 and the epics write the illustrative example
unpadded; this overrides that.

AD-3 requires precompute to consume Extraction Records in *"canonical order (ascending match
ID)"* and AD-8 requires byte-identical determinism. Unpadded, lexicographic order over 104
matches is `m1, m10, m100, m11, …` — wrong, and it mis-sorts `data/matches/` directory
listings too. Padding makes string order equal numeric order **by construction**, so no code
path can get canonical order wrong by forgetting to sort numerically. Since an ID once
emitted never changes, this had to be settled before anything was emitted.

### 2. Precision is declared with `x-decimals`, not `multipleOf`

See *Numeric precision* above. `multipleOf` fails on binary floating point.

### 3. `momentum`'s series shape is provisional; its **key** contract is final

`MomentumSeries` is `{samples: [{minute, home, away}]}` — what EXPERIENCE.md's Momentum
Timeline actually consumes (`aria-valuetext` announces the minute plus both teams' values).
The concrete shape lands in Story 1.8 (OQ-5 / AR-17) via the AD-14 change flow.

What is **final in v1**: `momentum` is a required key whose value is the series or JSON
`null`. Never omitted, never `[]`. Goal markers on the momentum axis come from Domain A's
scorer list, not from the series — they are not duplicated into it.

### 4. No tool swap — `json-schema-to-typescript@15.0.4` round-trips faithfully

AD-2 permits swapping to `json-schema-to-ts` or `quicktype` via a logged decision. **No swap
was needed.** The spike produces 231 declarations from the six schemas with zero index
signatures, zero collision-suffixed names, zero duplicate declarations, enums as string
literal unions, and correct `| null` on every nullable field.

Getting there required two fixes, both now guarded by tests so they cannot regress:

- **`$ref` nodes must not carry sibling keywords.** `{"$ref": X, "$comment": "..."}` is legal
  2020-12, but the tool treats it as a *new* schema rather than a reference and emits a
  duplicate type under a collision-suffixed name. The first generation produced `Metres1`
  through `Metres5`, `Count1`–`Count3` and `TeamScore1` this way. Annotations now live on the
  referenced `$def` or on the parent object's `description`.
  `test_no_ref_node_carries_sibling_keywords` enforces it.
- **`common.schema.json` needed a closed root.** As a pure `$defs` library it had no root
  `type`, so the tool emitted `export interface Common { [k: string]: unknown; }`. Its root is
  now the empty closed object.

The generator deduplicates declarations by name across the six compilations — each is
compiled with `declareExternallyReferenced`, so every file that references
`common.schema.json` re-emits all of it, and naive concatenation declares `Position` four
times. A repeat with a *different* body is a hard error, not a silent drop: that is a real
name collision. It also strips the tool's "This interface was referenced by `X`'s
JSON-Schema" stanza, which names one arbitrary referrer and differs per compiling file.

The generator **refuses to write** output containing an index signature or a
collision-suffixed name. `pipeline/tests/test_contract_schemas.py` re-asserts the same
properties against the committed output, which is what catches a generated file edited by
hand.

### 5. Phase percentages are independent rates, not a distribution

The Dev Notes anticipated that the Phases of Play values would sum to ~100% and that the
defensive block shares would too. **They do not.** Germany's eight in-possession values in
PMSR-M74 sum to 124; Mexico's nine out-of-possession values in PMSR-M01 sum to 80.

They are therefore modelled and documented as independent per-phase percentages. Nothing may
normalize them or render them as slices of a whole — a stacked bar over these values would be
straightforwardly wrong.

### 6. `defensiveBlockDistribution` mirrors three phase values, and a test holds them equal

`defensiveBlockDistribution.{high,mid,low}` and
`phasesOutOfPossession.{highBlock,midBlock,lowBlock}` are the **same three numbers** — the
Phases of Play page is the only source of either. The duplicate is kept because Story 2.10
renders block height as its own concept, but a duplicate that can drift is a hazard, so
`test_defensive_block_distribution_mirrors_the_three_block_phases` asserts the equality on
every fixture. The pipeline must emit them equal.

### 7. Stoppage time is two integers, never a display string

The corpus prints `"90+2"`. AD-7 forbids display strings in artifacts, so this is stored as
`minute: 90, stoppageMinute: 2`; ordering is by the pair. The App composes the label in its
locale layer. `stoppageMinute` is `null` outside stoppage time.

### 8. Key Statistics carries 19 fields per team, and possession has a third share

The Dev Notes listed 14 Domain B metrics; the page actually prints more, and compound rows
carry two numbers each. `"Total Passes (Complete)"` becomes `passes` + `passesCompleted`,
`"Defensive Pressures Applied (Direct Pressures)"` becomes `defensivePressures` +
`directPressures`, `"Attempts at Goal (On Target)"` becomes `shots` + `shotsOnTarget`, and
`"Zone 4 - Low Speed Sprinting: 20-25 km/h"` becomes `sprintDistance`. Splitting them rather
than storing the formatted string is what AD-7 requires.

Possession prints as **three** percentages — home / contested / away — which do sum to 100.
The contested share is a match-level value and cannot be derived from the two team values, so
it is stored once as `keyStatistics.contestedPossession`.

### 9. Optional sections are `null`-able, not merely empty

`null` and `[]` mean different things throughout the contract: an empty array is "the page was
there and listed nothing", `null` is "the report does not carry that data at all". The App
renders those as different states (EXPERIENCE.md's empty-state pattern), so collapsing them
loses information the surface needs.

v1 originally honoured the distinction for `momentum` and `events.shootoutAttempts` only. The
other eight optional sections — `events.shots`, `events.crosses`, `events.passNetworkNodes`,
`events.passNetworkEdges`, `events.receiving`, `events.defensiveActions`, `goalkeeping` and
`players` — were plain non-nullable arrays, so a match whose Defensive Actions page was
missing was indistinguishable from one with zero defensive actions.

All eight are now `anyOf: [<array>, {"type": "null"}]`. Done inside v1 rather than through the
change flow because it is still `schemaVersion` 1 and nothing consumes the contract yet: after
Story 2.1 the same change costs a version bump, regenerated fixtures and App churn.

### 10. `MetricCode` is scoped to the artifact field it ranks

The rule is that a code is string-identical to the field it names. `tackles` broke it — Domain
G has `tacklesMade` and `tacklesWon` and there was no `tackles` field anywhere, so a `tackles`
board named no source. It is now **`tacklesWon`**, the conventional leaderboard metric.

`distanceCovered` was overloaded: it is `Kilometres` on a team and the player equivalent is
`totalDistance` in `Metres`, so one code would have carried two units and broken AD-7's rule
that units live in the locale layer keyed by metric code. **`totalDistance` is now a separate
code** for the player scope.

`completedLineBreaks` (team, Domain B) and `lineBreaksCompleted` (player, Domain G) are
deliberately kept as two codes. They name one concept but two genuinely different artifact
fields, and renaming either would break the string-identical rule rather than restore it. The
rule is therefore stated as **scoped**: a team-scope board's code names a Domain B field, a
player-scope board's names a Domain G field.

`test_every_metric_code_names_a_real_artifact_field` walks all 31 codes against every
`properties` key in `/contract`.

### 11. Closed vocabularies are pinned to the objects that encode them

Fourteen enums are declared and documented here with corpus provenance but referenced by no
field, because the artifacts store each as a fixed camelCase object instead — `InterventionType`
as `byInterventionType`'s five keys, `CornerDeliveryStyle` as `cornersByDeliveryStyle`'s four,
and so on. The objects are the right shape for the App (fixed interfaces, not maps), so they
stay.

What was missing is the link. With nothing holding the two copies together, AD-2's mechanism —
"a value the pipeline meets that is not listed becomes a compile error" — did **not** hold for
any of these fourteen: a new source label would have had nowhere to go and would have been
dropped silently at extraction time.

`test_every_closed_vocabulary_matches_the_object_that_encodes_it` now asserts each enum's
values against the mirroring object's property names. The compile-error guarantee for these
vocabularies is provided by that test rather than by the type system; everywhere else it is
the generated union, as AD-2 describes.

### 12. Cross-field invariants are enforced in pytest, not with `if`/`then`

`if`/`then` is inside AD-2's permitted subset and is the obvious way to say "a `regulation`
tie has no `shootoutScore`". It cannot be used here: `json-schema-to-typescript` compiles an
`if`/`then` branch to an **open object**, reintroducing the `[k: string]: unknown` index
signature that the AD-2 codegen spike exists to prevent, and the `then` cannot be closed with
`additionalProperties: false` without also rejecting the object's sibling properties. This was
tried during the code review and the generator's own fidelity guard rejected it.

So the schema *documents* each invariant in its `description` and `pipeline/tests/` enforces
it. pytest is the gate either way. The invariants held this way:

| Invariant | Test |
| --- | --- |
| `decidedBy` matches the periods actually played | `test_knockout_score_agrees_with_decided_by` |
| `matchId` agrees with its filename, `matchNumber` and both team ids | `test_the_match_id_agrees_with_its_filename_and_its_own_metadata` |
| `stage` and `matchdayRound` describe the same match | `test_the_stage_and_matchday_round_describe_the_same_match` |
| `outcome` agrees with `outcomeDetail` | `test_shot_outcome_agrees_with_its_finer_outcome_detail` |
| Domain G player rows sum to the Domain B team totals | `test_domain_g_player_totals_reconcile_with_the_domain_b_team_totals` |
| Node `involvement` is at least its own incident edge volume | `test_every_pass_network_node_is_at_least_as_involved_as_its_own_edges` |
| Free-kick nesting and corner partitioning | `test_set_play_counts_are_internally_consistent` |

### 13. `ShotOutcomeDetail` carries its own map onto `ShotOutcome`

The 22 detail values map onto the 5 marker outcomes, and the mapping is **not derivable by
prefix**: `incomplete-blocked` maps to `blocked` while every other `incomplete-*` maps to
`incomplete`. A consumer deriving one from the other by string prefix is wrong on the entire
blocked family, and nothing stopped `{"outcome": "goal", "outcomeDetail": "off-target"}` from
validating at every layer.

The map is now declared machine-readably as `x-maps-to-outcome` on the `ShotOutcomeDetail`
`$def` — same custom-keyword convention as `x-decimals`: legal JSON Schema, ignored by
validators and by the codegen, greppable and testable. Nine of the 22 pairings are observed in
the corpus-derived fixtures and enforced against them; the remaining 13 follow the same rule
and are AD-14 change-flow candidates should real data contradict one.

### 14. Corners carry a team-level side split

`cornersByDeliveryType` splits corners by side *within each delivery type*, so rendering
"corners from the left" meant the browser adding three numbers — which AD-5 forbids outright
("the App never sums or averages"). `TeamSetPlays.cornersBySide` is now a precomputed field,
and `PitchSide` finally has a field that encodes it.

### 15. Precision is declared for the polymorphic metric-value slots

Five numeric slots carried no `x-decimals` at all: `LeaderboardValue`, `LeaderboardPerMatchValue`,
`AggregateMetricValue`, `PerNinety` and `TrendPointValue`. They are the slots whose correct
precision *varies by `metricCode`*, which is why they were skipped — and it left Story 1.16's
canonical serializer with no rounding rule for any leaderboard, aggregate or trend value.

Each now declares `x-decimals: 2`, the widest precision any metric uses, with a description
stating that the serializer **must** round to the precision of the source field named by
`metricCode` rather than to this default. `test_every_numeric_leaf_declares_its_precision`
walks every numeric schema in the contract so the next one cannot be forgotten.

### 16. Player-profile aggregation semantics live in the artifact, not in this file

FR-27 asked for the per-metric aggregation semantics (sum vs max vs average) to be documented
here. They are instead carried **per row**, as `AggregateMetric.aggregation`, typed by the
closed `AggregationSemantics` enum.

This is the better mechanism and is a deliberate departure: a table in a README cannot be read
by the App, cannot be validated, and drifts. A field on the row travels with the value, so the
App never has to guess and never re-aggregates (AD-5), and
`test_the_player_profile_aggregates_equal_their_own_aggregation` checks the artifact against
its own declared semantics. Recorded here because the story's Task 9 asked for the table.
---

## The AD-14 change flow

The contract is Epic 1's to own and Epic 2's to consume. When Epic 2 needs a shape that is not
here:

1. **Epic 2 requests** the change, naming the surface that needs it and the field it needs.
2. **Epic 1 implements** it in `/contract`.
3. **A logged decision** is added to this file — what changed and why.
4. **`schemaVersion` is bumped** in `contract/version.json`.
5. **Fixtures and generated types are regenerated in the same commit.** Not the next one.

Step 5 is the one that gets skipped under pressure, and skipping it is what makes a contract
stop being one. `pipeline/tests/test_fixtures.py` covers the fixture half, and
`test_the_committed_generated_types_still_match_the_schemas` (equivalently
`npm run check:types`) covers the generated half by regenerating and comparing.

> This claim used to be made and not kept. Only the *version integer* was checked, so the
> committed types drifted four JSDoc blocks behind the schemas with 256 tests green — and
> the stale text told App developers the phase percentages were shares summing to ~100%,
> which is exactly what logged decision 5 exists to forbid. Both halves are now enforced by
> regeneration rather than by inspection.

Story **2.3** is the formal sign-off gate on v1: it walks a per-surface data-needs checklist
against these schemas, and every gap it finds becomes a change request.

---

## Story 2.3 sign-off (v1)

**Date:** 2026-07-23 · **Walked at commit `e6cfa7e`** · **Overall outcome: SIGNED-OFF-WITH-CHANGE-REQUESTS**

The Story 1.1 per-surface data-needs checklist was walked in full against the six schemas,
the seven fixtures, EXPERIENCE.md/DESIGN.md and the epic 2.4–2.18 ACs. Full evidence table
(every verdict cites schema file:line + fixture branch) lives in the story record:
`_bmad-output/implementation-artifacts/2-3-contract-v1-per-surface-sign-off.md`.

**Per-surface verdicts (24 rows):**

- **PASS** — Hero (score/knockoutScore/stage/group; scorers+minutes incl. own-goal
  benefiting-team attribution; exactly five storyStats/team; lineups disclosure with
  mandatory `playerId`), search/typeahead (`EntityIndex` = corpus, AD-3 slug ids),
  `#key-stats` (19 fields/team + `contestedPossession`), cross maps, `#pass-networks`,
  offers/movement-to-receive, `#defensive-actions`, `#expert` (17+15+9 Domain G fields, no
  lite variants), Hub results/standings (explicit `rank`, `form[]`, match reachability),
  leaderboards, player profile, team profile, heatmap (confirmed out of contract scope).
- **PASS-with-note** — `<title>`/OG (pens suffix composes via a same-file build-time join to
  `knockoutResults[].knockoutScore` — no change needed); comparison (App aligns sides from
  `metadata.homeTeam`/`awayTeam` ordering; presentation logic under AD-5); `#momentum`
  (series shape PROVISIONAL until Story 1.8's AD-14 bump; the key contract is final);
  `#phases`/`#pressing` + `#set-plays` + `#goalkeeping` (non-partition semantics: independent
  rates, mirrored block values, nested free-kicks, overlapping corner views, dual GK
  denominators — renderers in 2.10/2.16 must never sum, normalize, or pie these); null/empty
  semantics (branch coverage gaps recorded as fixture request FR-1).
- **CHANGE-REQUEST** — `#shot-maps` only, two requests (below).

**Filed change requests (AD-14 step 1 — surface + field), batched as change-set CS-1:**

1. **CR-1** — surface: `#shot-maps` popover/log (Story 2.7) + Expert shot log (2.11); field:
   `common.schema.json#ShotOutcomeDetail` (via `ShotEvent.outcomeDetail`). Extend the closed
   enum with the two corpus-real bare values `incomplete` (31 rows) and `on-target` (3 rows),
   plus `x-maps-to-outcome` entries `incomplete → incomplete`, `on-target → on-target`
   (mirroring the existing bare `off-target`). Blocks Story 1.16 emission until landed.
2. **CR-2** — surface: `#shot-maps` marker/outcome consistency; field:
   `x-maps-to-outcome["deflected-on-target-defensive-event"]`. The corpus contradicts the
   declared `on-target` 10:1. Acknowledge the one-to-many rendering: this one entry becomes
   `["incomplete", "on-target"]` (majority first); the other 21 mappings stay exact; the
   outcome/detail pytest invariant relaxes to set-membership for array entries. The App
   treats `outcome` as authoritative for marker encoding and never derives it from
   `outcomeDetail`.

**Riding CS-1 (not themselves change requests):** the stale own-goal `$comment` correction
at `match-bundle.schema.json` (`GoalOwnGoal`) — Story 1.6 proved the corpus DOES mark own
goals; a `$comment` edit alone trips `check:types`, so it rides the bump.

**CS-1 landing rule:** one atomic commit — schema edits + logged decision 17 + `version.json`
1 → 2 + hand-edited fixtures re-pinned + BOTH regenerated type outputs
(`contract/generated/` and `app/src/lib/contract/`) — proven by
`pytest pipeline/tests/test_contract_schemas.py pipeline/tests/test_fixtures.py` and
`npm run check:types` in that same commit. Must land before Story 1.16 begins emission.

**Filed fixture request (no schema change, no version bump):** **FR-1**, routed to Story
1.18's fixture work — add coverage for the schema-guaranteed-but-unfixtured branches:
`goalkeeping: null`, `players: null`, `events.*: null` beyond `shootoutAttempts`, an empty
`[]` event array, `decidedBy: "extra-time"`, a zero-appearance player, `movementType: null`,
a `CardRecord`, and `penalty: true`. Fixture-only hand-edits validate against unchanged
schemas; the AD-14 flow triggers on shape changes, so no bump.

**Filed rendering decision FD-1 (binds Story 2.7/2.11):** per-shot xG does not exist in the
source (team totals only — see "Where the contract is deliberately empty"), so shot markers
render at uniform size and popovers/logs omit the xG row while `ShotEvent.expectedGoals` is
`null`. The nullable slot stays as the forward-compatible landing zone. This resolves the
EXPERIENCE.md/DESIGN.md/epic-2.7 xG-sizing conflict without a contract change.

**Gate consequence:** Epic 1 extraction past the AD-8 sample set (stories 1.7–1.15) is
**unblocked** by this sign-off. Story **1.16 is blocked-pending CS-1**. Fixture request FR-1
blocks nothing.

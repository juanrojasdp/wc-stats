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
node scripts/generate-types.mjs ../app/src/lib/contract   # Story 2.1 re-points it here
```

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
stop being one. `pipeline/tests/test_fixtures.py` and
`test_generated_schema_version_constant_agrees_with_version_json` fail the build if it is.

Story **2.3** is the formal sign-off gate on v1: it walks a per-surface data-needs checklist
against these schemas, and every gap it finds becomes a change request.

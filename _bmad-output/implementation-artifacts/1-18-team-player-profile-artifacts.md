---
baseline_commit: 74b1789
---

# Story 1.18: Team & Player Profile Artifacts

Status: done

## Story

As the builder,
I want per-entity profile artifacts precomputed,
So that Team and Player Profile pages render aggregated identities and trends verbatim (FR-19, AD-5).

> **Six things the story-creation probe established before any AC is read. Every figure below
> was re-derived at story-creation time over the 104 committed bundles in `data/matches/`.**
>
> 1. **Your contract surface was pre-cleared for you, and it is `shapeByPhase`.** CS-2 reshaped
>    `team-profile.schema.json`'s `AggregateLineHeight` / `AggregateTeamLength` — which aggregated
>    a shape the corpus never prints — specifically so this story would not inherit the blocker
>    that stopped 1.16 dead. `contract/version.json` reads `{"schemaVersion": 4}`; both profile
>    schemas carry `"const": 4`. **AC 1's phrase "line heights" is a stale surface phrase. The
>    schema is authoritative: three panels per possession state, three measures each.**
> 2. **209 of 1,248 pinned players never took the field.** Measured: 1,248 pinned player ids,
>    1,248 appear in some lineup, **1,039 have minutes in at least one match**. The zero-appearance
>    profile is not an edge case to be tolerated — it is **16.7% of your output**, and their
>    `name` / `position` / `shirtNumber` / `team` are reachable **only** from
>    `metadata.lineups.*`, never from Domain G. *(`test_fixtures.py`'s `assert rows` guard globs
>    `data/fixtures/index/**`, not `data/index/**`, so it does not gate emission — it gates the
>    FR-1 fixture you must add. Task 8.2 relaxes it for that reason, not to unblock the 209.)*
> 3. **The committed Mexico team-profile fixture is internally inconsistent and cannot pass a
>    self-reproducibility test.** Its `shapeByPhase` is a real mean over Mexico's **five** real
>    corpus matches (`buildUpLow.lineHeight` 19.4 = mean of the real 19/19/20/19/20) while its
>    `record.played` is **3** and its `matches[]` rows carry synthetic possession values
>    (64.3, 56.6 against the real 40.8, 46.5). It is a hybrid, not an acceptance target.
> 4. **`record.points` as the shipped test computes it is wrong on 19 of 48 teams.**
>    `test_the_team_profile_record_matches_its_own_per_match_rows` asserts
>    `points == won*3 + drawn` over **all** rows; the schema says *"`points` counts group-stage
>    points only; knockout ties award none."* Mexico: 12 by the test, **9** by the contract.
>    The fixture has three group rows only, so both readings agree there and the conflict is
>    invisible until real data.
> 5. **A goalkeeper's player profile has no goalkeeping data, and neither does a team profile.**
>    CS-2's ruling D2b made `GoalkeepingBlock` per-TEAM with the keeper list as context, because
>    no goalkeeper name appears on any of the four goalkeeping page families and 7 of 208
>    team-innings used two keepers. `team-profile.schema.json` has **no goalkeeping property at
>    all** and `additionalProperties: false`. Goalkeeping therefore appears in **no** profile
>    artifact. See §OPEN RULINGS R1.
> 6. **The join direction is settled by measurement, and only one direction is total.**
>    (match, player) pairs with minutes = **3,288** (2,288 starters + 1,000 substitute
>    appearances); Domain G rows = **3,289**. Every with-minutes pair has a Domain G row (0
>    exceptions); exactly one Domain G row has no minutes — `m092-mexico-england` /
>    `henderson-jordan-eng`, all zeros in every field. **Iterate lineups-with-minutes and join
>    Domain G. The reverse direction manufactures a phantom appearance.**

## Acceptance Criteria

The epic's ACs are reproduced verbatim, each followed by the binding reconciliation this
story's probe forced.

**1. Given** all normalized matches **When** profile generation runs **Then**
`data/index/team-profiles/{team-id}.json` carries the tournament-wide tactical identity — line
heights, defensive-block distribution, pressing tendencies, phases of play, formation usage —
with per-match breakdowns [Source: epics.md:576-578, `### Story 1.18: Team & Player Profile Artifacts`]

> **BINDING — the epic names five surfaces in prose; the schema names six required blocks, and
> the schema wins.**
>
> `AggregateTacticalIdentity` requires exactly: `phasesInPossession` (8 percentages),
> `phasesOutOfPossession` (9 percentages), `shapeByPhase`, `defensiveBlockDistribution` (3
> percentages), `possession`, `pressingIntensity`. `additionalProperties: false` — you may emit
> no more and no fewer.
>
> **"Line heights" maps to `shapeByPhase`, not to a `lineHeight` pair.** The shape is
> `shapeByPhase.inPossession.{buildUpLow, buildUpMid, finalThirdPhase}` and
> `shapeByPhase.outOfPossession.{highBlockPress, midBlock, lowBlock}`, each an
> `AggregateShapeMetrics` = `{lineHeight, teamLength, teamWidth}`, all `common#Metres`
> (x-decimals 1). **18 metre values per team.** The `$comment` on that node names this story:
> *"Story 1.18 owns team profiles and has emitted nothing yet, so this is corrected BEFORE it
> inherits the identical blocker that stopped Story 1.16 dead."*
>
> **"Pressing tendencies" is two distinct things and they are not the same number.** The four
> pressing *shares* live in `phasesOutOfPossession` (`highPress`, `midPress`, `lowPress`,
> `counterPress`, percentages); the pressing *intensity* is `pressingIntensity`, described as
> *"Mean defensive pressures applied per match"* — a count-valued mean sourced from
> `keyStatistics.{side}.defensivePressures`, x-decimals **1**, not a percentage. Mexico's real
> value is **213.0** (mean of 170, 265, 233, 215, 182).
>
> **Formation is not in `tacticalIdentity`.** It is read per match from
> `metadata.lineups.{home,away}.formation` and aggregated into `formationUsage[]`:
> `{formation, matches, share}`, **ordered by descending match count** (the schema description
> makes the order part of the contract, AD-4's "the App renders artifact order verbatim").
> `share` is a `Percentage` = `matches / record.played * 100`.
>
> **`group` is required and is null on knockout matches.** `metadata.group` carries the group
> letter on group-stage matches only. Read it from any group-stage row for that team; every
> team plays the group stage. Assert it resolves — a `null` group fails `common#Group`'s enum
> and the failure would surface as a schema violation pointing at the wrong place.

**2. And** `data/index/player-profiles/{player-id}.json` carries totals/averages per metric
semantics, per-match series, the physical profile (speed zones, high-speed runs, sprints, top
speed), and cross-match trends. [Source: epics.md:579]

> **BINDING — "per metric semantics" is the whole story. Rule it metric by metric. A blanket
> rule is wrong for at least four of the eighteen, and the reproducibility AC will not catch it
> if the test mirrors the implementation's own choice.**
>
> `AggregateMetric.metricCode` draws from `common#MetricCode`, a **closed 32-value enum**. The
> vocabulary is SCOPED by its own description: *"a code on a player-scope board names a Domain G
> field."* Checked field-by-field against a real bundle, exactly **18 of the 32 name a Domain G
> field** and are therefore legal on a player profile. The other 14 are team-scope only and are
> **schema-legal but semantically forbidden** here — nothing validates this, so it is yours.
>
> **Legal player-scope codes (18):** `ballProgressions`, `crossesCompleted`, `duelsWonAerial`,
> `duelsWonPhysical`, `goals`, `highSpeedRuns`, `interceptions`, `lineBreaksCompleted`,
> `passCompletion`, `passesCompleted`, `possessionRegains`, `sprints`, `stepIns`,
> `switchesOfPlay`, `tacklesWon`, `takeOns`, `topSpeed`, `totalDistance`.
>
> **Forbidden on a player profile (14, team-scope):** `completedLineBreaks`, `crosses`,
> `defensiveLineBreaks`, `defensivePressures`, `distanceCovered`, `expectedGoals`,
> `forcedTurnovers`, `passes`, `possession`, `receptionsInFinalThird`, `secondBalls`, `shots`,
> `shotsOnTarget`, `sprintDistance`.
>
> **`attemptsAtGoal` is NOT in the enum.** It is a required `PlayerMatchRow` column and cannot
> be an `aggregates[]` row. Do not invent a code — that is a CS bump.
>
> **THE PER-METRIC REDUCTION TABLE. This is the AC. Every row is pinned by its own test
> (Task 9.2); one parametrized test over a `REDUCTIONS` dict that the implementation also reads
> proves nothing.**
>
> | metricCode | source field on `players[i]` | contract type | reduction | `perNinety` | `value` places |
> |---|---|---|---|---|---|
> | `goals` | `inPossession.goals` | Count | **sum** | rate | 0 (int) |
> | `passesCompleted` | `inPossession.passesCompleted` | Count | **sum** | rate | 0 (int) |
> | `ballProgressions` | `inPossession.ballProgressions` | Count | **sum** | rate | 0 (int) |
> | `lineBreaksCompleted` | `inPossession.lineBreaksCompleted` | Count | **sum** | rate | 0 (int) |
> | `crossesCompleted` | `inPossession.crossesCompleted` | Count | **sum** | rate | 0 (int) |
> | `switchesOfPlay` | `inPossession.switchesOfPlay` | Count | **sum** | rate | 0 (int) |
> | `takeOns` | `inPossession.takeOns` | Count | **sum** | rate | 0 (int) |
> | `stepIns` | `inPossession.stepIns` | Count | **sum** | rate | 0 (int) |
> | `tacklesWon` | `outOfPossession.tacklesWon` | Count | **sum** | rate | 0 (int) |
> | `interceptions` | `outOfPossession.interceptions` | Count | **sum** | rate | 0 (int) |
> | `duelsWonAerial` | `outOfPossession.duelsWonAerial` | Count | **sum** | rate | 0 (int) |
> | `duelsWonPhysical` | `outOfPossession.duelsWonPhysical` | Count | **sum** | rate | 0 (int) |
> | `possessionRegains` | `outOfPossession.possessionRegains` | Count | **sum** | rate | 0 (int) |
> | `highSpeedRuns` | `physical.highSpeedRuns` | Count | **sum** | rate | 0 (int) |
> | `sprints` | `physical.sprints` | Count | **sum** | rate | 0 (int) |
> | `totalDistance` | `physical.totalDistance` | Metres | **sum** | rate | 1 |
> | `topSpeed` | `physical.topSpeed` | KmPerHour | **max** | **null** | 1 |
> | `passCompletion` | `inPossession.passCompletion` | Percentage | **average, WEIGHTED** — `Σ passesCompleted / Σ passesAttempted × 100` | **null** | 1 |
>
> **THE WEIGHTED AVERAGE DIVIDES BY ZERO ON 17 REAL PLAYERS.** Measured: **17 players who have
> minutes attempt 0 passes across every appearance** (`iglesias-borja-esp`, `rahman-baba-gha`,
> `ryan-mathew-aus`, `chalobah-trevoh-eng`, `arfsten-max-usa`, `balbuena-fabian-par`,
> `torres-felix-ecu`, `gomez-andres-col`, `gul-deniz-tur`, `alhashmi-alhussein-qat`,
> `ghedjemis-fares-alg`, … ), and **53 individual match rows** carry `passesAttempted: 0`.
> `AggregateMetric.value` is `"type": "number"` and is **not nullable**, so `null` is not
> available. **Ruled: `Σ passesAttempted == 0` ⇒ `passCompletion` value `0.0`, `aggregation:
> "average"`, `perNinety: null`.** Same rule for a per-match `PlayerMatchRow.passCompletion`
> (`common#Percentage`, also non-nullable) and for that metric's trend points. Test it by id.
>
> **The one weighted average, and why it is the one that will be got wrong.** A player's
> per-match `passCompletion` *is* `passesCompleted / passesAttempted`. The tournament figure
> that is reproducible from the bundles is therefore `Σ completed / Σ attempted`, **not the mean
> of the per-match percentages** — those weight a 12-pass cameo equally with a 90-pass shift.
> Measured on the committed fixture `quinones-julian-mex`: the unweighted mean of 90.3 / 82.9 /
> 73.9 is **82.4**, which is the number the fixture ships; the weighted value is
> `119/143 × 100` = **83.2**. **Emit 83.2.** The fixture is wrong and is regenerated under
> FR-1 (Task 8). `aggregation` still reads `"average"` — the enum has only `sum | max | average`
> and cannot express the denominator, which is exactly why the test must assert the arithmetic
> rather than the label.
>
> **`perNinety` — two rules, both easy to get wrong.**
> - *Which metrics get one:* the schema says *"Null when the metric is a maximum or a
>   percentage."* So `topSpeed` (max) and `passCompletion` (percentage) are `null`; the other
>   **16 are `value / appearances.minutesPlayed × 90`**.
> - *Precision:* **`perNinety` is 2 decimal places for EVERY metric, including the Count ones.**
>   It is not keyed to the source field's precision. Applying `Count`'s 0 places would round
>   `goals` per-90 to `0` and destroy the field. The committed fixture proves the rule:
>   `goals` value `1`, `perNinety` **`0.37`**; `passesCompleted` value `119`, `perNinety`
>   **`43.54`**. `PerNinety`'s own `x-decimals` is 2.
> - *Division by zero:* `minutesPlayed == 0` ⇒ `perNinety: null`. Nothing in the schema says so
>   (the ledger files this as an unconstrained pairing); rule it here and test it.
>
> **`physical` is not the aggregates block and reduces differently.** `PhysicalProfile`'s own
> description: *"Distances are the sums over matches played; topSpeed is the maximum, never a
> mean."* Eight fields **sum**; `topSpeed` is a **max**. `highSpeedRuns` and `sprints` are
> integer-typed — Story 1.10 parses them as float, asserts integral and narrows to `int` on all
> 3,289 rows; **do not re-litigate and do not round.**
>
> **`trends[]` and `aggregates[]` are both open sets and the schema fixes neither.** The story
> must rule the two lists so the App's surfaces are stable. See §OPEN RULINGS R2 for the
> recommended sets and Task 5.4.
>
> **Trend points follow the SOURCE FIELD's precision, not the slot's.** `TrendPointValue`
> declares `x-decimals: 2` for the same polymorphic reason `AggregateMetricValue` does. None of
> R2's six trend metrics is a 2-place metric: `goals` / `passesCompleted` / `ballProgressions`
> are Counts (0, emit `int`), `totalDistance` is Metres (1), `topSpeed` is KmPerHour (1),
> `passCompletion` is a Percentage (1). **A trend point for `passCompletion` is that match's own
> `players[i].inPossession.passCompletion` verbatim — never re-weighted, never cumulative.** The
> weighting rule applies to the tournament aggregate only; a trend is a series of match values.
>
> **`matches[]` is "one row per match with minutes"** (schema description) — **not** one row per
> Domain G row. That distinction is the entire Henderson case (premise 6).

**3. Given** the budget and bijection gates **When** the run completes **Then** each profile
artifact ≤ 500 KB gzip -9 and exactly one artifact exists per manifest-listed entity.
[Source: epics.md:581-583]

> **BINDING — the budget half is a solved problem you must not re-solve; the bijection half
> cannot be written as stated and must be agreed with 1.17 first.**
>
> **Budget.** `pipeline/precompute/budget.py` already ships `BUDGET_BYTES = 500_000`,
> `gzip_bytes(text)` (gzip -9 over the canonical string's UTF-8, `mtime=0`) and
> `over_budget(label, text) -> (label, gzip, raw) | None`. **Reuse it verbatim; AD-4 sets the
> identical 500 KB ceiling per profile artifact.** `over_budget` returns rather than raises
> *"so a caller can collect EVERY breach before failing"* — collect all, then raise
> `BudgetExceededError` naming each artifact with both byte counts, exit 1. Never truncate an
> array, never drop a nullable key, never lower precision to fit (SM-C2).
>
> **The gate will be trivially green and that is why it must be proven able to fail.** The
> largest Match Bundle is 14,251 gzip-9 bytes — 2.85% of the ceiling — and a profile is far
> smaller. Ship a **constructed** over-budget test that drives the gate red, per the
> `budget.py` docstring: *"A gate that cannot fail reads greener than no gate while proving
> strictly less."* A corpus assertion that is green by arithmetic does not satisfy this AC.
>
> **The bijection cannot be asserted as the AC words it, because the manifest is 1.17's output
> and 1.17 has not landed.** `tournament.json`'s entity lists are the route manifest (AD-4);
> `data/index/` does not exist at `74b1789`. `tournament.schema.json#/$defs/EntityIndex` says
> so itself: *"AR-4 asserts a bijection between these lists and the emitted profile artifacts;
> that assert runs against real /data in Story 1.17, not against fixtures."* And 1.17's own AC
> carries the same assert. **Two owners, one assertion.** Agree the direction explicitly before
> writing it — see §COORDINATION and §OPEN RULINGS R3. **Do not write an assertion that cannot
> run, and do not let "no manifest" read as "passed".** The `check_committed_data` precedent is
> binding: *"print that the second source is unavailable; never treat 'no baseline' as
> 'passed'."*
>
> **What 1.18 CAN assert unilaterally, and must:** the artifact set is exactly the registry's
> pinned namespace — **48 team profiles and 1,248 player profiles**, one file each, no orphans,
> no stale files. `pipeline/precompute/slug_registry.py` `PINS` is the immutability baseline
> from run one and needs no 1.17 input.

**4. Given** reproducibility **When** pytest runs **Then** every profile aggregate is asserted
reproducible from the entity's Match Bundles (sum/max/average per metric as appropriate).
[Source: epics.md:585-587]

> **BINDING — the shipped reproducibility test does not test the aggregates, and the anti-
> tautology rule is the whole difficulty here.**
>
> **What exists today is narrower than its name.**
> `test_fixtures.py::test_the_player_profile_aggregates_equal_their_own_aggregation` checks
> `physical.totalDistance` against the row sum, `physical.topSpeed` against the row max, and
> the four `appearances` identities. **It never reads `aggregates[]` at all.** Every declared
> `aggregation` semantic is untested today. That is the gap this AC closes.
>
> **The anti-tautology rule (the "1.10 rule"), quoted because it is the failure mode this AC
> invites:** *"Derive expected values from the parsed corpus, never restate the implementation.
> A test asserting `emit(x) == emit(x)` proves only that the function is the function."* 1.16
> took a review finding for exactly this — *"Both precision tests derive their expectation from
> the emitter's own key map, so neither can see the defect."*
>
> **Operationally, for this story:** the test must re-derive each aggregate from
> `data/matches/*.json` with a **reduction written independently in the test module**, not by
> importing the emitter's reduction table. A parametrized sweep over a shared `REDUCTIONS` dict
> that both sides read is the same defect wearing a different hat. **Eighteen player metrics ⇒
> eighteen named expectations**, plus the team side.
>
> **Mutation check (house rule, mandatory):** flipping `topSpeed` from `max` to `sum`, flipping
> `passCompletion` from weighted to unweighted, and applying `Count` precision to `perNinety`
> must **each** turn a test red. Report the red count.

## OPEN RULINGS NEEDED FROM JUAN

These are surfaced rather than assumed. **R1 and R3 are BLOCKING — they are not dev-agent
decidable.** R1 changes what Story 2.16 can render and may require a successor change-set; R3
requires agreement with an in-flight session that owns the other half of the assertion — Story
1.17's **DECISION D2** is the same question from the other side and is also awaiting Juan, so
rule them together or they will be ruled inconsistently. Get both ruled before Task 4 begins. R2, R4 and R5 carry recommendations the dev agent may proceed on,
recording the ruling and its rejected alternatives in the Dev Agent Record.

### R1 — What does a goalkeeper's player profile show?

**The problem.** CS-2 ruling D2b made `GoalkeepingBlock` per-TEAM with the keeper list carried
as context. Story 1.9 proved why: *"all four page families are titled `{team}`, no goalkeeper
name appears anywhere on any of them, and 7 of 208 team-innings used two goalkeepers"* while
still printing one team-level block each. 1.9's ruling is explicit: *"Do not infer a keeper,
not even on the 201 unambiguous innings: a shape that varies between reports is worse than one
that is honestly team-level everywhere."*

**The consequence nobody has stated out loud until now.** `player-profile.schema.json` has no
goalkeeping property. `team-profile.schema.json` **also** has no goalkeeping property, and both
are `additionalProperties: false`. **Goalkeeping data appears in no profile artifact at all.**
It is reachable only by opening the 104 Match Bundles.

**Recommended (A): a goalkeeper's profile is exactly the same shape as every other player's.**
Domain G covers goalkeepers — the real `rangel-raul-mex` row carries a full `inPossession`,
`outOfPossession` and `physical` block. A GK profile therefore shows passing, distance, top
speed and the rest, and shows **no** saves, distribution or goal-prevention numbers. Emit no
goalkeeping-shaped field and synthesize nothing. *Rejected: (B) attributing the team block to
whichever keeper started — 1.9 refused this on measurement and it is plainly wrong on the seven
two-keeper innings; (C) a CS-3 bump adding a team-level goalkeeping block to
`team-profile.schema.json` — defensible, but a change-set is a separate atomic commit with six
declarations and both type trees, and Epic 2's `### Story 2.3 sign-off (v1)` already recorded
**PASS** on both profile schemas as sufficient for 2.15/2.16.*

**What Juan is being asked:** confirm (A), or authorize (C) as a successor change-set so a team
profile can carry the team goalkeeping identity. Under (A), the Team Profile page will have no
goalkeeping section — worth knowing before 2.16 is designed.

### R2 — Which metrics go in `aggregates[]` and which in `trends[]`?

**The problem.** The schema fixes neither list. The committed fixture ships four aggregates
(`goals`, `passesCompleted`, `passCompletion`, `topSpeed`) and two trends (`passCompletion`,
`topSpeed`). A fixture is not a contract, and 2.15 renders *"headline aggregates lead (hero
altitude), cross-match trend charts follow"* — so both lists are a product decision that lands
in an artifact.

**Recommended:** `aggregates[]` = **all 18 legal player-scope codes**, in the enum's own
(alphabetical) order. Rationale: the profile is the analyst surface, `additionalProperties` does
not constrain array contents, the budget headroom is ~97%, and a *closed, total, ordered* list
is the one shape that never needs a later artifact change to add a metric the App wants.
`trends[]` = the **six** the App can chart meaningfully per match: `goals`, `passesCompleted`,
`passCompletion`, `ballProgressions`, `totalDistance`, `topSpeed`. *Rejected: mirroring the
fixture's four/two — it was hand-authored for schema coverage, not chosen; and a later addition
would be a silent artifact-shape change the App cannot detect.*

**And the corollary that Task 5.6 must obey, because "total" and "empty" cannot both be true.**
If `aggregates[]` is a closed, total, ordered list, it must be total on **all 1,248 files** —
otherwise the App still has to branch. **Recommended: a zero-appearance player carries all 18
rows with `value: 0` (or `0.0` at the metric's precision), `aggregation` as the table declares,
and `perNinety: null`; `trends[]` carries the six series with `points: []`; `matches[]` is `[]`.**
The only genuinely empty array is `matches`. *Rejected: `aggregates: []` / `trends: []` for the
209 — it re-introduces the branch the totality argument exists to remove, and 16.7% of files is
not an edge case the App may treat as one.*

### R3 — Who owns the bijection assert, 1.17 or 1.18?

See AC 3's binding block and §COORDINATION. **Story 1.17's story file now exists and carries the
mirror-image question as its DECISION D2, also unruled — one ruling must settle both.**
**Recommended:** **1.17 asserts against what 1.18 emits**, which is what 1.17's own D2
recommends (1.15's two-source pattern plus a red-by-design successor test). 1.17 owns the manifest and the manifest is the authority; an assert that lives with the
authority cannot go stale. 1.18 asserts the weaker, unilateral, always-runnable property — one
artifact per **registry-pinned** entity (48 + 1,248) — and prints an explicit
*"route-manifest bijection not asserted here; owned by Story 1.17"* line so the gap is visible
rather than silent. *Rejected: 1.18 reading `tournament.json` — it creates a run-order
dependency on an artifact that does not exist at `74b1789` and would make 1.18's suite red until
1.17 lands.*

### R4 — `TeamMatchBreakdown.result` on the four shootout matches

**Measured.** 9 of 104 matches are non-regulation: 5 `extra-time`, 4 `shootout`. On the five
extra-time matches `metadata.score` equals `scoreAfterET`, so `result` is unambiguous. On the
**four shootout matches** `metadata.score` is level (1-1, 1-1, 1-1, 0-0) while
`knockoutScore.winnerTeamId` names an advancer — `m074`, `m075`, `m088`, `m096`. That is **8
team-rows** where `result` has two defensible readings.

**Recommended:** `result` follows `metadata.score` ⇒ those 8 rows read **`draw`**. Rationale:
`MatchResult`'s description ties it to *"standings form sequences"*, and `TournamentRecord`'s
own description says *"knockout ties award none"* — which presupposes that a knockout tie is
recorded as a tie. Progression is already carried by `record.furthestStage`. *Rejected: deriving
`result` from `winnerTeamId` — it makes `record.drawn` disagree with the standings 1.17 emits
from the same field, and `test_leaderboard_rows_agree_with_the_profiles_and_standings_they_
duplicate` couples the two artifacts.*

### R5 — 1,248 player-profile filenames become permanent URLs the moment they commit

**Not a blocker; a timing warning.** Story 1.15 filed *"219 players / 856 lineup entries slug in
GIVEN-NAME-FIRST order, and the fix is an `OVERRIDES` data edit rather than a code change.
Owner: Juan / UX"*, framing the cost as *"cosmetic ordering on a URL"*. **This story turns those
slugs into committed filenames.** After that, AD-3's *"an ID, once emitted, never changes"* and
`check_pins` make an `OVERRIDES` edit a rename of committed artifacts and a broken URL, not a
cosmetic change. The 219 are a **per-team** printing convention: eight teams print all 26 players
in full caps and contribute 208 of them (`brazil`, `cabo-verde`, `egypt`, `iraq`, `jordan`,
`portugal`, `qatar`, `saudi-arabia`); 20 are mononyms needing no decision. **If the ordering
ruling is wanted, it should land before Task 7 commits 1,248 files.** `OVERRIDES` ships empty
precisely so it can land as data.

## Tasks / Subtasks

> **Sequencing.** Task 1 is a measurement pass with no code — every number in this file must be
> re-derived, not copied forward. Tasks 2–6 build; Task 7 emits; Tasks 8–9 are fixtures and
> tests; Task 10 is documentation, ledger and verification. **Nothing is written to `data/`
> until every artifact is built, validated, rounded and measured (Task 7.4).**

- [x] **Task 1: Re-derive the probe before writing any code** (no AC; do this first)
  - [x] 1.1 Confirm `contract/version.json` reads `{"schemaVersion": 4}` and that both
        `team-profile.schema.json` and `player-profile.schema.json` carry `"const": 4`.
  - [x] 1.2 Re-derive: 48 pinned teams, 1,248 pinned players, 104 pinned matches from
        `pipeline/precompute/slug_registry.py`. Re-derive the count of players with minutes in
        at least one match (**expect 1,039**) and therefore the zero-appearance count
        (**expect 209**).
  - [x] 1.3 Re-derive the join census over `data/matches/*.json`: (match, player) pairs with
        minutes (**expect 3,288 = 2,288 starters + 1,000 substitute appearances**), Domain G
        rows (**expect 3,289**), with-minutes-not-in-Domain-G (**expect 0**), and
        Domain-G-not-with-minutes (**expect exactly `('m092-mexico-england',
        'henderson-jordan-eng')`**). Confirm his row is all-zero in all three blocks.
  - [x] 1.4 Re-derive match length: `decidedBy in {extra-time, shootout}` ⇒ 120, else 90.
        Expect **9** matches at 120 (5 ET + 4 shootout), and **0** substitution stamps above
        minute 90 in a regulation match. Cross-check against `emit.periods_played`'s
        independently measured 95/9 split.
  - [x] 1.5 Re-derive Mexico's real five-match aggregates as the acceptance anchor:
        `possession` raw mean **48.18** ⇒ **emitted 48.2** (`Percentage` is x-decimals 1 — assert
        against the emitted precision, not the raw mean), `pressingIntensity` **213.0**,
        `shapeByPhase.inPossession.buildUpLow.lineHeight` **19.4**, formations
        `4-1-2-3 × 5`. Confirm these do **not** match the committed fixture (premise 3).
  - [x] 1.5a Re-derive the two zero-denominator populations: players with minutes whose total
        `passesAttempted` is 0 (**expect 17**) and per-match Domain G rows with
        `passesAttempted: 0` (**expect 53**).
  - [x] 1.5b Re-derive the identity-conflict census: players carrying more than one `position`
        across their lineup entries (**expect exactly 1 — `senesi-marcos-arg`, `mf` in
        `m019-argentina-algeria` where he was an unused substitute, `df` in seven others**) and
        players carrying more than one `shirtNumber` (**expect 0**).
  - [x] 1.5c Re-derive the formation-usage edges: teams whose rounded `share` values do not sum
        to 100.0 (**expect 3 — `qatar`, `curacao`, `ir-iran`, each 3 matches × 3 distinct
        formations ⇒ 33.3 × 3 = 99.9**) and teams with a tie at the top formation count
        (**expect 9**). Both branches are live; neither is defensive.
  - [x] 1.6 Re-derive the points conflict: teams whose all-rows `won*3+drawn` differs from
        group-stage-only points (**expect 19 of 48**; Mexico 12 vs 9).
  - [x] 1.7 Re-derive the MetricCode partition against a real bundle: 32 enum values, **18**
        naming a Domain G field, **14** team-scope only, **0** naming neither.
  - [x] Record every figure in the Dev Agent Record. A figure that does not reproduce is a
        finding, not a rounding difference.

- [x] **Task 2: Read the inputs and settle the source of truth** (AC: 1, 2, 4)
  - [x] 2.1 **Read `data/matches/*.json`, not `work/spine/`.** *Ruled:* the bundles are already
        camelCase, already contract-shaped, already schema-valid and already carry resolved ids.
        Reading the spine would require a **second** snake_case→camelCase mapper, and 1.16's
        binding rule is that *"the mapping happens at this boundary only"*. It also makes every
        `matches[]` row literally verbatim from the bundle, which is what AC 4 asks for.
        *Recorded alternative: emitting from `work/spine/` as 1.16 does. Rejected because it
        duplicates the mapping boundary and because `work/spine/` is gitignored staging, so no
        committed test could run against it.* **Consequence to state in the module docstring:
        profile emission runs AFTER `emit_bundles`, and `data/matches/` is its input.**
  - [x] 2.2 Add a `check_bundle_shape(bundle, where)` entry-point guard mirroring
        `emit.check_spine_shape`: assert the required top-level keys and the required
        `metadata` sub-paths at load, raising a typed error naming the missing path.
        1.16's review decision 3 ruled this pattern in — *"the emitter's bare-subscript spine
        reads — ADD THE ENTRY-POINT GUARD"* — and `check_total` is **not** a substitute: it only
        inspects dicts the mapper already built.
    - [x] 2.2a **`players` must be asserted PRESENT but not NON-NULL.**
          `match-bundle.schema.json` declares it *"Per-player Domain G records, **or null** when
          the report does not carry the per-player pages at all"*, and Task 8.1 orders a
          `players: null` fixture — so a guard that raises on null contradicts this story's own
          fixture work. **Ruled:** `players: null` is a legal bundle that contributes **zero**
          player match rows and zero team-level effect; every player in its lineups still gets a
          profile from the other matches, and a player whose only bundle is null-`players`
          becomes zero-appearance. Corpus today: 0 null, 0 empty — so this is a latent path,
          and it must be tested by construction, not by corpus.
  - [x] 2.2b **`EntityRef` is `{id, name}` with `additionalProperties: false` — it is NOT
        `TeamRef`.** `emit._team_ref` returns `{teamId, teamCode, name}` and is the wrong shape
        for `TeamMatchBreakdown.opponent` and `PlayerProfile.team`. Do not reuse it; write an
        `entity_ref(id, name)` helper and pin it in the public API. (Note also that two modules
        are named `records.py` — `pipeline/ingest/records.py` is the writer, and
        `pipeline/precompute/records.py` loads Extraction Records. You want the former.)
  - [x] 2.3 Read team codes from `slug_registry.TEAM_CODES` / the bundle's
        `metadata.{home,away}Team.teamCode`. **Never derive a team code** — six codes carry a
        letter absent from their slug (`cpv`, `cuw`, `mar`, `ksa`, `esp`, `sui`) and no
        first-three-letters rule produces `rsa` or `cod`.

- [x] **Task 3: Minutes played** (AC: 2, 4)
  - [x] 3.1 Implement `match_length(bundle) -> int`: `120` if
        `metadata.knockoutScore.decidedBy in ("extra-time", "shootout")` else `90`.
        *Ruled over `emit.periods_played`:* `decidedBy` is non-nullable while `momentum` is
        nullable by contract; both agree on 9/104, verified in Task 1.4.
  - [x] 3.2 Implement `minutes_played(entry, section, length) -> int`:
        starter with no `substitutedOff` ⇒ `length`; starter off at `m` ⇒ `m`; substitute on at
        `m` with no off ⇒ `length - m`; substitute on at `m1` and off at `m2` ⇒ `m2 - m1`
        (**4 such entries corpus-wide**); unused substitute ⇒ no row.
    - [x] 3.2a **The with-minutes predicate already exists and is ruled:
          `pipeline.extract.domain_g.has_minutes(entry, section) -> bool`** — *"A starter always
          did; a substitute did exactly when the lineup page stamped a sub-on minute."* Its
          docstring already carries the Henderson correction. `pipeline/extract/pass_network.py`
          imports it, so cross-package import is established precedent. **Reuse it rather than
          re-deriving the predicate**; `minutes_played` is the new part, the *whether* is not.
          If the camelCase bundle read makes it non-importable (it takes staged snake_case
          entries), say so explicitly and mirror its rule verbatim rather than inventing one.
  - [x] 3.3 **Ignore `stoppageMinute`.** Task 1.4 measures 0 substitution stamps above minute 90
        in a regulation match, so `minute` is already the clock minute inside the period and
        adding stoppage would push a total past `length`. State the ruling; test it.
  - [x] 3.4 Assert `0 <= minutes_played <= length` for every emitted row. A negative or
        over-length value is a `ProfileError`, never a clamp.

- [x] **Task 4: The team profile builder** (AC: 1, 4)
  - [x] 4.1 `build_team_profile(team_id, rows, entities) -> dict`. Rows are that team's matches
        in chronological order (ascending `matchId`, which is chronological by construction).
  - [x] 4.1a **The identity block — four required scalars the reduction table does not cover.**
        `teamId` = the slug (also the filename stem); `name` from
        `metadata.{home,away}Team.name` (a source proper name, passed through as-is per AD-7);
        `teamCode` from `metadata.{home,away}Team.teamCode` or `slug_registry.TEAM_CODES` —
        never derived (Task 2.3); `group` per Task 4.6. Assert `teamId` equals the filename stem
        and is pinned in `PINS["teams"]`.
  - [x] 4.2 `record`: `played = len(matches)`; `won`/`drawn`/`lost` from `result`;
        `goalsFor`/`goalsAgainst` summed from the rows; `goalDifference = goalsFor -
        goalsAgainst`; **`points = 3×wins + draws over GROUP-STAGE ROWS ONLY**` per the schema's
        *"`points` counts group-stage points only; knockout ties award none"*;
        `furthestStage` = the maximum stage under the order
        `group < r32 < r16 < qf < sf < third-place < final`.
    - [x] 4.2a **The stage order already exists — do not re-invent it.**
          `pipeline.discover.rounds.KNOCKOUT_ROUNDS` is
          `("r32", "r16", "qf", "sf", "third-place", "final")`, and `common#Stage`'s own
          description says *"Knockout codes are exactly `pipeline.discover.rounds.
          KNOCKOUT_ROUNDS`."* `furthestStage` order is therefore `("group",) + KNOCKOUT_ROUNDS`.
          **The `third-place` < `final` position is the trap** — a team in the third-place
          play-off did not reach the final, and the shipped tuple already encodes that. Import
          it; test both branches (exactly 1 match of each exists).
  - [x] 4.3 `tacticalIdentity`: mean over the team's matches, per leaf, x-decimals 1 —
        `phasesInPossession` (8), `phasesOutOfPossession` (9),
        `shapeByPhase.{inPossession,outOfPossession}.{3 panels}.{lineHeight,teamLength,teamWidth}`
        (18), `defensiveBlockDistribution` (3), `possession` (from
        `keyStatistics.{side}.possession`), `pressingIntensity` (from
        `keyStatistics.{side}.defensivePressures`). **40 leaves: 8 + 9 + 18 + 3 + 1 + 1.**
        Note `tacticalIdentity` in the bundle carries **neither** `possession` nor
        `defensivePressures` — both come from `keyStatistics.{side}`, and the side must be
        resolved because `tacticalIdentity` and `keyStatistics` are both keyed `home`/`away`,
        never by `teamId`.
    - [x] 4.3a **`possession` is an UNWEIGHTED mean over matches and that is deliberate.**
          `AggregateTacticalIdentity`'s description says *"match-count-weighted mean over the
          team's matches"*, and no possession-time denominator exists anywhere in the artifact
          set — unlike `passCompletion`, whose denominator (`passesAttempted`) does exist. This
          is the metric-by-metric ruling AC 2 demands: **the same word "average" means two
          different arithmetics in the two artifacts, and both are correct.** Say so in the
          docstring so a reviewer does not "unify" them.
    - [x] 4.3b `shapeByPhase` is *"not a partition and not aggregable across panels — each
          panel is its own measurement."* Never sum or mean across panels.
  - [x] 4.4 `formationUsage[]`: count starts per formation string, `share = matches/played×100`
        at `Percentage` precision (1 dp), **ordered by descending match count**.
    - [x] 4.4a **The tie-break is live on 9 of 48 teams** (`australia` 5-4-1×2 / 3-4-3×2,
          `brazil`, `switzerland`, `qatar`, `curacao`, …), not a defensive branch. **Ruled:**
          descending `matches`, then **ascending `formation` string**, so the order is total and
          deterministic across re-runs.
    - [x] 4.4b **Shares do not sum to 100 and that is arithmetic, not a defect.** Measured: 3
          teams (`qatar`, `curacao`, `ir-iran`) play 3 matches with 3 distinct formations ⇒
          `33.3 × 3 = 99.9`. **Ruled: do not allocate the residual and do not renormalize** —
          each `share` is the honest rounding of `matches/played`. Any test must carry the
          tolerance `abs(Σshare − 100) <= 0.1 × len(rows)`, never a bare `== 100`.
  - [x] 4.5 `matches[]` — `TeamMatchBreakdown`, 15 required fields, chronological:
        `matchId`, `stage`, `date` (all from `metadata`); `opponent` = `EntityRef`
        `{id, name}` built from the *other* side's `teamId`/`name` (Task 2.2b — **not**
        `TeamRef`); `isHome` = `True` iff this team is `metadata.homeTeam.teamId`;
        `result` derived from `metadata.score` under R4 (no bundle field carries a per-team
        result — say so, since "verbatim" does not derive); `goalsFor`/`goalsAgainst` from
        `metadata.score.{side, other}` (**ruled over `keyStatistics.{side}.goals`, which is
        identical on all 208 team-innings — pick one, state it, and pin the agreement in a
        test so a future divergence is a finding**); `formation` from
        `metadata.lineups.{side}.formation`; `possession`, `expectedGoals`, `shots`,
        `shotsOnTarget`, `passCompletion`, `distanceCovered` verbatim from
        `keyStatistics.{side}`.
  - [x] 4.6 `group` from a group-stage row (AC 1's binding block). Assert it resolves to a
        `common#Group` enum value.
  - [x] 4.7 **`emit.check_total` / `emit._def_properties` DO NOT WORK for profile artifacts, and
        this was reproduced by running the code, not inferred.** Both resolve `$def` names against
        the **match-bundle + common** documents only. Every profile `$def` raises:
        `_def_properties("TeamProfile")` → `KeyError: "no $def or titled subschema named
        'TeamProfile' in either contract document"`, and the same for `PlayerProfile`,
        `AggregateMetric`, `TournamentRecord`, `AggregateTacticalIdentity`, `FormationUsageRow`,
        `TeamMatchBreakdown`, `Appearances`, `PhysicalProfile`, `PlayerMatchRow`, `TrendSeries`,
        `TrendPoint`, `AggregateShapeMetrics` — **13 of 13**. Write a profile-scoped
        `check_total(obj, def_name, schema_name, where)` that takes the document too, and apply
        it to **every** emitted object, not only the top level — 1.16 took a review finding for
        exactly that omission. *Do not "fix" `emit._def_properties` to search a third document;
        `emit.py` is unchanged by design and 1.17 has its own `check_total` collision with
        `StandingsRow`.*

- [x] **Task 5: The player profile builder** (AC: 2, 4)
  - [x] 5.1 `build_player_profile(player_id, rows, entities) -> dict`. **Build match rows by
        iterating lineups-with-minutes and joining Domain G by `playerId`** (premise 6). Assert
        the join is total; a with-minutes entry with no Domain G row is a `ProfileError`.
        **This rule governs `matches[]` only — it is not the identity source. See 5.1a.**
  - [x] 5.1a **The identity block — five required scalars, and for 209 players Domain G cannot
        supply any of them.** `playerId` = the slug and the filename stem; `name`, `position`,
        `shirtNumber` and `team` come from the player's **lineup entries**
        (`metadata.lineups.{side}.{starters,substitutes}[]` plus
        `metadata.{side}Team.{teamId,name}`), which every one of the 1,248 has — including all
        209 who never played. `team` is an `EntityRef` `{id, name}`.
        - Measured, so the dev does not have to discover it: **`name` is identical between the
          lineup entry and the Domain G `playerName` on all 3,289 rows**, and **0 players carry
          two shirt numbers** — so both are unambiguous whichever source is used.
        - **`position` is NOT unambiguous, and exactly one player proves it.**
          `senesi-marcos-arg` is listed `mf` in `m019-argentina-algeria` — where he was an
          **unused substitute**, so he has no Domain G row there — and `df` in seven other
          matches. `player-profile.schema.json` requires a single scalar. **Ruled: `position`
          is the most frequent value across the player's lineup entries, ties broken by first
          chronological occurrence.** This yields `df` for Senesi. *Recorded alternatives:
          "first lineup entry" (yields `mf` — a wrong label sourced from a match he did not
          play) and "Domain G row" (correct for the 1,039, unavailable for the 209 — it cannot
          be the general rule). Do not let §Failure policy's assert-on-unknown raise here; a
          multi-position player is corpus-real, not a defect.*
  - [x] 5.2 `appearances`: `played = len(matches)`, `started = Σ started`,
        `substituteAppearances = played - started`, `minutesPlayed = Σ row minutes`. The four
        identities in `test_the_player_profile_aggregates_equal_their_own_aggregation` must hold
        by construction.
  - [x] 5.3 `physical`: eight fields **summed**, `topSpeed` **max**. `highSpeedRuns` and
        `sprints` stay `int`.
  - [x] 5.4 `aggregates[]` and `trends[]` per §OPEN RULINGS R2, reductions per AC 2's table.
        Each `AggregateMetric` carries `metricCode`, `value`, `aggregation`, `perNinety` — all
        four required.
  - [x] 5.5 `matches[]` — `PlayerMatchRow`, 16 required fields, chronological:
        `matchId`, `stage`, `date`, `opponent` (`EntityRef`) from `metadata`; `started` =
        whether the entry came from `starters`; `minutesPlayed` from Task 3.2; and the ten
        stat columns from that match's Domain G row —
        `goals`, `attemptsAtGoal`, `passesAttempted`, `passesCompleted`, `passCompletion`,
        `ballProgressions` from `players[i].inPossession.*`; `duelsWonAerial`,
        `duelsWonPhysical` from `players[i].outOfPossession.*`; `totalDistance`, `topSpeed`
        from `players[i].physical.*`. **`attemptsAtGoal` and `passesAttempted` are required
        columns that appear in no `metricCode` table in this file** — their source is named
        here and nowhere else.
  - [x] 5.6 **The zero-appearance shape (209 players).** Emit the file with
        `appearances: {played: 0, started: 0, substituteAppearances: 0, minutesPlayed: 0}`,
        `matches: []`, `physical` all zeros (`topSpeed: 0.0` — max over an empty set is
        undefined, so rule it to 0.0 rather than raise), and — per §OPEN RULINGS R2's totality
        corollary — **`aggregates[]` carrying all 18 rows with `value: 0` and `perNinety: null`,
        and `trends[]` carrying the six series with `points: []`.** The identity block comes
        from lineups (5.1a). AD-4 is explicit: *"empty sections allowed, absence not."* Ledger
        entry *"A zero-appearance squad member is schema-valid but fails the profile test"*
        names this story as where the case *"must be decided anyway"*. Record the ruling and the
        rejected alternatives (omitting the file — it breaks the bijection; emitting empty
        `aggregates`/`trends` — it breaks R2's totality claim on 16.7% of files).
  - [x] 5.7 **`m092-mexico-england` / `henderson-jordan-eng` renders as a real zero and must
        not crash.** His all-zero Domain G row in m092 carries no minutes, so under Task 5.1 he
        gets **no match row for m092** — the zero surfaces as the correct absence of an
        appearance, not as a zeroed appearance. He *does* have minutes in England's other
        matches, so his profile is otherwise ordinary. Pin all three facts in one named test:
        no m092 row, a non-empty profile, and no exception. **Do not prune him from the
        registry and do not special-case him by id.**

- [x] **Task 6: Serialization, precision and validation** (AC: 1, 2, 3)
  - [x] 6.1 **Reuse `pipeline.ingest.records.canonical_json` / `write_canonical`.** Sorted keys,
        UTF-8, LF, indent 2, atomic pid-suffixed temp + `os.replace` are all already enforced
        there. `newline=""` is load-bearing on Windows. **Do not hand-roll `json.dump`; do not
        mint a third serializer.** Check whether 1.17 has moved it somewhere shared and follow —
        do not fork (§COORDINATION).
  - [x] 6.2 Precision: `decimals_map("team-profile.schema.json")` and
        `decimals_map("player-profile.schema.json")`, then a **profile-scoped** key→`$def`
        binding. **Do not copy `emit._KEY_TO_DEF`** — 1.16's review found it defective: it binds
        `"home"`/`"away"` to `Count` and `round_bundle` passes a parent's binding down to any
        unrecognised key, so 29 percentages and metres inherited 0 places. Bind every numeric
        leaf explicitly; an unbound leaf must raise, never default.
    - [x] 6.2a **The polymorphic slots.** `AggregateMetricValue`, `TrendPointValue` and
          `PerNinety` all declare `x-decimals: 2`, which is *"the widest precision any metric
          uses"* — a placeholder, not the rule. `value` and trend points round to **the precision
          of the source field named by `metricCode`** (schema instruction, quoted in AC 2's
          table); `perNinety` rounds to **2 for every metric**. 1.16's story text routes this here
          by name: *"The five polymorphic slots that need `metricCode`-keyed rounding … That is
          1.17/1.18's problem."*
    - [x] 6.2b **`decimals_map` runs clean on both profile schemas but SILENTLY OMITS
          `PerNinety`. Reproduced by running the code.** Measured today:
          `decimals_map("team-profile.schema.json")` → 7 entries
          `{Count 0, ExpectedGoals 2, Kilometres 2, Metres 1, Percentage 1, PressingIntensity 1,
          TeamProfileGoalDifference 0}`; `decimals_map("player-profile.schema.json")` → 7 entries
          `{AggregateMetricValue 2, Count 0, KmPerHour 1, Metres 1, Percentage 1, ShirtNumber 0,
          TrendPointValue 2}`. **`PerNinety` is absent from the second map** because its
          `x-decimals: 2` sits inside an `anyOf` branch — the identical shape the bundle needed
          a special case for, pinned by
          `test_emit_serialize.py::test_stoppage_minute_declares_inside_its_anyof_branch`. An
          unbound `perNinety` leaf ships **unrounded 17-digit floats**, validates clean, and
          destroys byte-identity. Bind it explicitly and pin the omission in its own named test
          so the gap is documented rather than patched over.
    - [x] 6.2c `decimals_map` raises `AssertionError` on a vacuous walk and `walk_subschemas`
          does not resolve `$ref` — both profile schemas reach `common.schema.json` by `$ref`,
          so the cross-document hop applies exactly as it did for the bundle. Assert the map is
          non-trivial. *(Note 1.17 reports `decimals_map("tournament.schema.json")` raising and
          `decimals_map("leaderboards.schema.json")` omitting a slot — the profile schemas are
          in better shape than the index ones, but the `anyOf` gap is shared.)*
  - [x] 6.3 `schemaVersion` from `pipeline.validate.schema.schema_version()`. **Never a
        literal** — 1.16 landmine 4.
  - [x] 6.4 Validate every artifact with `validate_artifact(obj, "<schema>", instance_label=id)`
        **before** anything is written. It raises with every violation at once.
  - [x] 6.5 Budget: `over_budget(artifact_id, canonical_text)` for each of the 1,296 artifacts;
        collect all breaches, then raise.

- [x] **Task 7: Emission, CLI and the write path** (AC: 1, 2, 3)
  - [x] 7.1 `emit_profiles(data_dir=DEFAULT_DATA_DIR, dry_run=False, expect_teams=None,
        expect_players=None) -> list[Path]`, writing
        `data/index/team-profiles/{team-id}.json` and
        `data/index/player-profiles/{player-id}.json`.
  - [x] 7.2 CLI `python -m pipeline.precompute.<module>` copying `emit.py`'s `build_parser()` /
        `main(argv=None) -> int`, including `run.py`'s stdout/stderr
        `reconfigure(errors="replace")` — without it a PDF-derived name crashes a redirected
        Windows console and destroys the exit code. Exit contract: **0 clean, 1 a dataset
        finding, 2 the harness could not run.** Wrap `json.JSONDecodeError` (a `ValueError`) and
        `decimals_map`'s `AssertionError` so neither escapes as a traceback — 1.16 took a review
        finding for both.
  - [x] 7.3 **Order: build all → validate all → round all → measure all → THEN write.** 1.16's
        review found that *"a short or empty spine deletes committed bundles before the count
        check runs"*, reproduced twice. Two new namespaces triple that exposure.
  - [x] 7.4 **Make the profile write phase all-or-nothing. Ruled: write every artifact into a
        staged sibling directory, then swap** — not `.tmp` names renamed in a second pass, which
        leaves the namespace half-swapped for the duration of the second pass and reproduces the
        hazard in a smaller window. The named hazard is `check_committed_data` pinning a partial
        namespace as the immutability baseline, and 1,296 artifacts across two directories is a
        wider window than 1.16's 104.
    - [x] 7.4a **Do not claim the ledger entry unless you actually fix `emit_bundles`.** The
          entry *"An `OSError` mid-write leaves `data/matches/` partially populated with no
          rollback"* is about **`emit.py`'s loop**, and names *"Story 1.19's batch acceptance"*
          as the natural owner; §Project Structure Notes lists `emit.py` as **unchanged by
          design**. If the staged-swap helper is written so `emit_bundles` can adopt it, adopting
          it is an additive `emit.py` edit that must be declared in the File List and **then**
          the entry may be closed. Otherwise file a note that the profile namespaces are covered
          and the bundle namespace is not, and **leave the entry open with its existing owner**.
          Closing it without touching that loop closes it falsely.
  - [x] 7.5 Delete stale artifacts this run did not produce, **after** the successful write, for
        the same reason 1.16 sweeps.
  - [x] 7.6 **Count is not distinctness.** 1.16's review: *"Two spine files carrying the same
        `match_id` inflate the reported count and pass `--expect-matches`."* Assert distinct ids,
        not just a total.
  - [x] 7.7 Empty is never a pass: `if not built: raise ProfileError("no profile was built; an
        empty run is never a pass")`.
  - [x] 7.8 **The `/data` pinning baseline does not reach the profile namespaces, and the
        obvious fix breaks a named test. Read this whole item before editing anything.**
    - [x] 7.8a `identity.check_committed_data` globs **`data/matches/*.json` only**. Extending
          `COMMITTED_ID_KEYS` therefore gives the two new namespaces **zero** coverage — the
          *walker* is what must be widened, not just the key set. Widen it additively (a
          `dirs` or `globs` parameter defaulting to today's behaviour) so
          `test_precompute_spine.py`'s *"104 bundle(s), 89,358 id reference(s), all pinned"*
          expectation is not silently invalidated.
    - [x] 7.8b **Do not add `id` to `COMMITTED_ID_KEYS`.**
          `test_emit_bundles.py::test_the_committed_id_check_is_total_for_a_match_bundle`
          asserts `carried == set(COMMITTED_ID_KEYS)` over Match Bundles, and no Match Bundle
          carries an `id` key — adding it turns that test red for a reason that is not a defect.
          `EntityRef.id` is a plain slug under a key named `id`, and the same key names a team
          on `opponent` and a player nowhere — so a key-name-keyed map cannot classify it.
          **Ruled: give the profile artifacts their own artifact-scoped id-key map** (e.g.
          `PROFILE_ID_KEYS` with the instance paths `teamId`, `playerId`, `matches[].matchId`,
          `matches[].opponent.id`, `team.id`), leaving `COMMITTED_ID_KEYS` and its totality test
          untouched. *Rejected: one union map — it makes the bundle totality test unmaintainable
          and conflates two artifacts' namespaces.*
    - [x] 7.8c Ship the matching totality test **per artifact**, named for its artifact the way
          1.16 named its own, so the next change-set inherits the same tripwire.

- [x] **Task 8: Fixtures — deferred-work FR-1** (AC: 1, 2, 4)
  - [x] 8.1 FR-1 is *"routed to Story 1.18's fixture work; fixture-only, **NO `schemaVersion`
        bump**"*. Add coverage for: `goalkeeping: null`, `players: null`, `events.*: null`
        beyond `shootoutAttempts`, an empty `[]` event array, `decidedBy: "extra-time"`, a
        zero-appearance player, `movementType: null`, any `CardRecord`, `penalty: true`.
        Canonical serialization required; `test_fixtures.py` must be green.
  - [x] 8.2 **Relax `test_fixtures.py`'s two `assert fixture["matches"]` / `assert rows` guards**
        (locate by symbol — the ledger cites `:436` and `:549` for the same assertion and both
        have drifted). FR-1 explicitly *"includes the matching guard-test updates as part of its
        scope."* Replace with a guard that admits `played == 0` and still forbids a silently
        empty profile for a player who did play.
  - [x] 8.3 **Regenerate the Mexico team-profile fixture.** It is a hybrid today (premise 3) and
        cannot satisfy Task 9.3. Regenerate it as a real five-match aggregate, or re-scope it to
        three real matches — either way it must be self-consistent.
  - [x] 8.3a **THE FIXTURE CASCADE. Regenerating either profile fixture turns two other
        `test_fixtures.py` tests red, and neither fixture is named anywhere else in this story.**
    - `data/fixtures/index/leaderboards.json` pins **`mexico` possession `59.3`** and
      **`mexico` distanceCovered `315.0`** on its team boards, and
      `test_leaderboard_rows_agree_with_the_profiles_and_standings_they_duplicate` asserts
      `row["value"] == profile["tacticalIdentity"]["possession"]` and
      `row["value"] == player["physical"]["topSpeed"]`. Task 8.3 moves possession to **48.2**.
      **Regenerate `leaderboards.json` in the same change.**
    - `data/fixtures/index/tournament.json`'s `entities` block holds **1 team, 1 player, 3
      matches**, and `test_the_tournament_entity_index_resolves_to_the_artifacts_that_exist`
      asserts `on_disk_teams <= listed_teams` / `on_disk_players <= listed_players`. Task 8.1's
      zero-appearance-player fixture adds a new `player-profiles/*.json` stem ⇒ red unless the
      entity list is extended in the same change. FR-1's own text warns of exactly this: the
      new-fixture branch *"cascades into `tournament.json` entities/results (reachability
      bijection), profile per-match rows, and leaderboards `matchesPlayed` consistency tests."*
    - **Coordinate:** `tournament.json` and `leaderboards.json` are **1.17's artifacts in
      `data/index/`**, but these are the `data/fixtures/index/` copies. Editing the fixtures is
      in scope; editing `data/index/` is not. Say which you touched.
  - [x] 8.3b Other fixture-parametrized tests exposed by any lineup or bundle edit in Task 8.1 —
        check each before and after: `test_precompute_identity.py`'s
        `assert len({player_id …}) == 155` and its
        `"romero-gamarra-alejandro-par" in from_lineups - from_players` pin;
        `test_emit_bundles.py`'s `valid_builder` fixture, which loads the **m001 fixture** as
        the emitter's stand-in output for the whole write-path suite including the budget-breach
        case; `test_extract_report_domain_g.py`'s
        `test_the_ground_truth_physical_block_matches_the_committed_fixture` (8 fields plus a
        matched-player count) alongside the divergence pin named in 8.5; and
        `test_fixtures.py::test_the_fixture_set_is_present_and_complete`, whose `kinds` set and
        `_schema_for` mapping reject any new subdirectory under `index/`.
  - [x] 8.4 Regenerate the `quinones-julian-mex` player fixture: `passCompletion` becomes the
        weighted **83.2**, and the `physical` zone sum must satisfy `domain-g-zone-sum`
        (the fixtures break it on 79 of 96 rows today, worst drift 4.400 m; the check is
        corpus-verified at worst 0.200 m over 3,289 rows, so **the tolerance is right and the
        fixtures are wrong**). Run `domain-g-zone-sum` over regenerated fixtures as an
        acceptance gate.
  - [x] 8.5 **Two pins will turn red by design; retire them deliberately, do not "fix" them
        back.** (a) `test_extract_report_domain_g.py`'s pin on the `m001` fixture's
        `physical.totalDistance` divergence — *"the pin fails loudly if a fixture refresh
        corrects it"*, which is exactly what Task 8.4 does. (b)
        `test_set_play_counts_are_internally_consistent` asserts a relation CS-2 documented as
        corpus-false; *"when the fixtures are regenerated from real data (1.18/1.19) it turns
        red for a reason that is not a defect."*
  - [ ] 8.6 **Flip `>=` to `==` in
        `test_every_pass_network_node_is_at_least_as_involved_as_its_own_edges`.** Filed twice
        with `Owner: 1.18/1.19` (once by 1.16, once by CS-2) — **close both explicitly**; a sweep
        that answers one leaves the other open. The measurement is done: 3,289/3,289, 0
        mismatches. Do not flip before the regeneration — 38 of 66 fixture nodes go red.
  - [x] 8.7 **Counter-constraint: the five goalkeeping technique blocks stay POPULATED in
        fixtures and null in corpus output.** Story 2.10's presence gates need a populated
        branch. Do not "fix" the fixtures to match the corpus.
  - [x] 8.8 Verify the skip-on-null guard in `test_pass_network_edges_join_players_who_have_a_node`
        survives the refresh; do not re-introduce the unguarded read.
  - [x] 8.9 Do not author a self-loop pass edge into any regenerated fixture — the matrix
        diagonal is blank on 208/208, so a hand-authored bundle is the only vector that could
        create the unreachable App defect 1.14 closed.

- [x] **Task 9: Tests** (AC: 1, 2, 3, 4)
  - [x] 9.1 New module `pipeline/tests/test_emit_profiles.py`, following
        `test_emit_bundles.py`'s shape. Long sentence-like names. No markers (none are
        registered anywhere).
  - [x] 9.2 **Eighteen named player-metric expectations plus the team side**, each re-derived in
        the test module from `data/matches/*.json` (AC 4's binding block). Not one parametrized
        sweep over a table the emitter also reads.
  - [x] 9.3 Team reproducibility: `record` from its own rows (with **group-only points**),
        `tacticalIdentity` as the per-leaf mean over the team's own `matches[]`,
        `formationUsage` shares summing to 100 and ordered descending.
  - [x] 9.4 Determinism: emit twice into two directories, compare **bytes**, not parsed dicts.
        Assert no `\r\n`, UTF-8 decodable, trailing newline, and that no artifact carries a
        timestamp, an absolute path, a host name or a `code_version`.
  - [x] 9.5 Precision: derive the expectation **from the schema**, resolving each instance path
        through `$ref` to its `$def` independently of the emitter's key map. Collect `int` leaves
        as well as `float` — 1.16's review found that collecting `float` only made every
        wrongly-0-placed leaf invisible.
  - [x] 9.6 Budget: a **constructed** over-budget artifact drives the gate red; a corpus artifact
        reports no breach; `gzip_bytes` is reproducible; the unit is gzip, not raw bytes.
  - [x] 9.7 Bijection (as scoped by R3): exactly 48 team files and 1,248 player files, ids
        distinct, every filename equal to the id inside the file, every id pinned in the
        registry, no orphans.
  - [x] 9.8 The zero-appearance case, against a **real** one of the 209 as well as a constructed
        one: schema-clean, identity block populated from lineups, `matches: []`, 18 zeroed
        aggregates, six empty trend series, zeroed physical, `perNinety: null` throughout.
  - [x] 9.9 The Henderson case (Task 5.7), by id, with all three assertions.
  - [x] 9.9a The zero-denominator case by id: a player from the 17 with `Σ passesAttempted == 0`
        emits `passCompletion` `value: 0.0`, `perNinety: null`, and does not raise; a match row
        from the 53 emits `passCompletion: 0.0`.
  - [x] 9.9b `senesi-marcos-arg` resolves to a single `position` under Task 5.1a's rule, and the
        test states which value and why — a test that merely asserts "some position" would pass
        on the wrong one.
  - [x] 9.9c A constructed bundle with `players: null` contributes no rows and does not raise
        (Task 2.2a); the corpus carries none, so this is only ever a constructed test.
  - [x] 9.10 **Test `main()` itself, not just `emit_profiles`** — stage inputs under `tmp_path`,
        pass `--data-dir` **under `tmp_path` and never at the real tree**, assert each exit code
        (0/1/2), and assert `--dry-run` writes nothing. 1.15 shipped `run.main()` with zero tests
        and took a review finding; `test_precompute_run.py` is the retrofit to copy.
  - [x] 9.11 Corpus sweeps: every emitted artifact schema-valid, no snake_case key, no non-finite
        number, every numeric leaf respecting its declared precision, and the committed artifacts
        equal to what the emitter produces (the rebuild-and-compare test 1.16's review found
        missing — ship it from day one).
  - [x] 9.12 **Mutation check.** Report the red count for each: `topSpeed` max→sum;
        `passCompletion` weighted→unweighted; `perNinety` at metric precision instead of 2;
        `points` over all rows instead of group-only; a swapped home/away side.
  - [x] 9.13 Run the full suite: `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`.
        **~45 minutes — run it in the background, not in chunks that time out.** If you must
        chunk, state the arithmetic and make the tally reconcile exactly; 1.16 took a review
        finding for an off-by-one reconciliation.

- [x] **Task 10: Documentation, ledger and verification** (AC: all)
  - [x] 10.1 Append a `## Story 1.18 — Team & player profile emission` section to
        `pipeline/README.md`. **Append-only**; prove it programmatically.
  - [x] 10.2 Append `## Filed by Story 1.18 implementation (team & player profile emission,
        YYYY-MM-DD)` at the **end** of `deferred-work.md`, with `### Closed by this story` and
        `### Filed, not fixed` sub-sections. **The ledger mints no ids — do not invent a
        `DW-nn`.** Cite by quoted anchor phrase, never by line number. Never edit another
        story's paragraph; record corrections as appended corrections.
  - [x] 10.3 Close by appending, not by editing, citing each by its **quoted anchor phrase**
        (the ledger contains no ids of any form — the handles used during story creation were
        scratch, do not put them in the file):
        - *"A zero-appearance squad member is schema-valid but fails the profile test"*
        - *"Fixture request FR-1 (routed to Story 1.18's fixture work"*
        - *"No fixture exercises `decidedBy: \"extra-time\"`"* — covered by Task 8.1; it is a
          separate filing from FR-1 even though FR-1 folds it, so close it explicitly.
        - *"The `>=` to `==` tightening of"* (filed by 1.16) **and**
          *"still holds at `>=`, and CS-2 does not change that"* (re-filed by CS-2) —
          **two separate entries, one fix.** A sweep that closes one leaves the other open.
        - *"An `OSError` mid-write leaves `data/matches/` partially populated with no rollback."*
          — only under the condition in Task 7.4a.
        - **Do NOT "close"** *"`team-profile.schema.json` was reshaped in step, and it was not in
          the filed scope."* — it already reads *"Deferred: nothing … **Owner: none.**"* It is an
          informational note, and closing a no-owner note is ledger churn.
  - [x] 10.4 Update `sprint-status.yaml`: `1-18-team-player-profile-artifacts: review`.
        **Append-only, never `git add -A`.**
  - [x] 10.5 **This story registers no FR-15 gate check and writes no run-manifest entry.** Both
        contracts are per-report (AD-8); profile emission is corpus-level and all-or-nothing, so
        there is no per-entity terminal status to record. `epics.md` scopes the FR-15 convention
        to extraction stories and 1.15–1.18 all omit it correctly. Say so, so a reviewer does not
        read the omission as a miss.
  - [x] 10.6 Record every ruling from §OPEN RULINGS with its rejected alternatives.

  **Public API, pinned** (house precedent — every prior story pins its entry points):
  - `pipeline.precompute.profiles.build_team_profile(team_id, rows, entities) -> dict`
  - `pipeline.precompute.profiles.build_player_profile(player_id, rows, entities) -> dict`
  - `pipeline.precompute.profiles.match_length(bundle) -> int`
  - `pipeline.precompute.profiles.minutes_played(entry, section, length) -> int`
  - `pipeline.precompute.profiles.entity_ref(entity_id, name) -> dict`
  - `pipeline.precompute.profiles.check_bundle_shape(bundle, where) -> dict`
  - `pipeline.precompute.profiles.emit_profiles(data_dir, dry_run, expect_teams, expect_players) -> list[Path]`
  - `pipeline.precompute.profiles.main(argv=None) -> int`

  **Added in code review — five further public names that shipped and are imported by
  `test_emit_profiles.py`, pinned so they are covered by the same rule as the eight above:**
  - `pipeline.precompute.profiles.load_bundles(data_dir) -> list[dict]`
  - `pipeline.precompute.profiles.index_bundles(bundles) -> tuple[dict, dict]`
  - `pipeline.precompute.profiles.has_minutes(entry, section) -> bool`
  - `pipeline.precompute.profiles.precision_by_key(decimals) -> dict[str, int]`
  - `pipeline.precompute.profiles.per_ninety_places(decimals) -> int`

  **New typed errors, appended to `pipeline/precompute/errors.py`** (every prior story pins
  its new error classes; none of these exists today):
  - `ProfileError(PrecomputeError)` — `what = "profile emission failed"`
  - `ProfileValidationError(ProfileError)` — `what = "profile is schema-invalid"`
  Reuse the shipped `BudgetExceededError` and `UnmappedFieldError` rather than minting
  profile-specific twins.

### Review Findings

Code review 2026-08-06. Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance
Auditor) over the 1.18-scoped diff, plus a property sweep of the 1,296 emitted artifacts.
Every finding below was reproduced by running code, not inferred from reading.

**Verified correct and NOT re-litigated:** all 18 rows of AC 2's reduction table (re-derived
over 1,248 artifacts, 0 violations); the team side (40 leaves x 48 teams = 1,920, 0
violations); AC 4's anti-tautology fix is real (mutating the module in-process yields 848
violations of the topSpeed expectation and 897 of the passCompletion one, cleanly separated,
0/0 at baseline); all 20 landmines avoided; every ruling R1-R5 implemented as ruled; the
registry bijection, byte-identity, determinism, budget (1,543 gzip-9 bytes = 0.31%),
schema-validity and canonical-serialization properties all hold on all 1,296 artifacts;
82 tests pass in 8m40s.

> **CORRECTION, made during the fix and recorded rather than quietly dropped.** The decision
> item below (and the option Juan was offered) asserted that `tournament.json`'s Group A
> standings were part of the inconsistency, because they read `played: 3` against a profile
> reading `played: 5`. **That was wrong, and checking the contract is what showed it.**
> `StandingsRow` is *"One team's row in a **group table**"*, so its `played` counts
> group-stage matches only. Re-derived from the profile's own three group rows, the standings
> row reconciles **exactly** — `played 3, won 3, drawn 0, lost 0, goalsFor 6, goalsAgainst 0,
> goalDifference 6, points 9, form [win, win, win]`, every field. `tournament.json` was
> therefore NOT changed. Two different denominators, both correct — which is precisely why
> the leaderboard's was worth checking, and the leaderboard's was genuinely wrong.

- [x] [Review][Decision] **RESOLVED — Juan ruled: complete the cascade to the five-match
      world.** `leaderboards.json` regenerated so every Mexico/Quiñones row states the real
      five-match figures — `distanceCovered` 315.0 → **563.8** (`perMatch` 105.0 → 112.76),
      `matchesPlayed` 3 → **5** on all three rows, `possession` 48.2 and `topSpeed` 33.0
      confirmed against the profiles — and both boards re-ranked, which moved `mexico` to
      rank 1 on `distanceCovered`. `tournament.json` left untouched per the correction above.
      The coupling test was the reason this stayed invisible, so it was repaired too: it now
      compares `matchesPlayed` against the **profile** that owns the count (team profile on a
      team-scope board, player profile on a player-scope board) with the standings kept only
      as a lower bound, and it checks the `distanceCovered` board — the one that went stale
      precisely because nothing compared it. Original finding follows.
- [x] [Review][Decision] **The regenerated profile fixtures desynchronized the fixture index
      set, and the coupling test is green on exactly the property it exists to guard** —
      `team-profiles/mexico.json` is now a real 5-match aggregate (`played 5, won 4, lost 1,
      goalsFor 10, goalsAgainst 3, goalDifference 7, furthestStage "r16"`), but
      `tournament.json`'s Group A standings still read `played 3, won 3, goalsFor 6,
      goalDifference 6`, and `leaderboards.json` was patched on only the two scalars the
      coupling test reads. Measured: the possession row carries `value 48.2` (the 5-match
      mean) against `matchesPlayed 3`; the distanceCovered row carries `value 315.0 /
      perMatch 105.0`, which is neither the 5-match sum (**563.8**) nor the group-only
      3-match sum (**338.5**) — it is the pre-regeneration synthetic figure; the Quinones
      topSpeed row reads `matchesPlayed 3` against a profile with `played 5`. Task 8.3
      required "either way it must be self-consistent" and Task 8.3a ordered the cascade.
      `test_leaderboard_rows_agree_with_the_profiles_and_standings_they_duplicate` cannot
      see it because it compares `matchesPlayed` against the **standings**, never against
      the profile it is named for, and checks `value` on only two boards — so a five-match
      figure now sits against a three-match denominator inside the test whose docstring says
      it exists to stop "one match's figure presented as a tournament average".
      `data/fixtures/README.md` names this exact failure class ("a team profile claiming
      `furthestStage: \"r16\"` with three group matches") as already fixed. Task 8.3 allowed
      two remedies and they cascade very differently, so the direction is Juan's call:
      (a) regenerate the whole fixture index set to the 5-match world — touches
      `tournament.json` standings/knockoutResults and every affected `leaderboards.json`
      board, and those are 1.17's artifact shapes; or (b) re-scope `mexico.json` and
      `quinones-julian-mex.json` back to their three group matches, which Task 8.3 explicitly
      permits and which restores the previously-reconciled set with the smallest blast radius.

- [x] [Review][Patch] The write phase is all-or-nothing per namespace, not across the two, and a failed run leaves an un-gitignored `.staged` directory of hundreds of artifacts [pipeline/precompute/profiles.py:1192-1207, 1037-1064]
- [x] [Review][Patch] The test that claims to cover the failed-write hazard aborts during build and only compares the namespace that always survives [pipeline/tests/test_emit_profiles.py:1584]
- [x] [Review][Patch] `check_committed_data`'s "unavailable" gate cannot fire when one glob of several is empty, so a missing namespace reads as "all pinned" [pipeline/precompute/identity.py:574-581]
- [x] [Review][Patch] Untyped `KeyError` / `TypeError` / `UnicodeDecodeError` escape `main()` as tracebacks, inverting the 0/1/2 exit contract [pipeline/precompute/profiles.py:355-407, 1005-1013, 1259-1269]
- [x] [Review][Patch] A player listed twice in one match's lineups is silently double-counted — 120 minutes in a 90-minute match, doubled aggregates, two trend points for one match [pipeline/precompute/profiles.py:1017-1034]
- [x] [Review][Patch] Substitution-stamp anomalies are silently mishandled: an off-stamp with no on-stamp drops a real appearance, a starter carrying an on-stamp is credited the full match [pipeline/precompute/profiles.py:437-497]
- [x] [Review][Patch] `data/fixtures/README.md` is untouched and now asserts things that are false, including "Every cross-artifact number now reconciles" [data/fixtures/README.md]
- [x] [Review][Patch] The Dev Agent Record omits two figures that did not reproduce — `passCompletion` shipped 82.2 against the story's pinned 83.2, and `domain-g-zone-sum` fails 88 of 96 fixture rows against the stated 79 [story file, Dev Agent Record]
- [x] [Review][Patch] `max(..., default=0)` ships 1,672 one-decimal leaves as JSON integers across the 209 zero-appearance profiles, and the precision test cannot see it [pipeline/precompute/profiles.py:783; pipeline/tests/test_emit_profiles.py:1180]
- [x] [Review][Patch] Task 7.6's distinctness gate is structurally unreachable — `built` is keyed off dict iteration, so the duplicate branch cannot fire and ships no constructed red test [pipeline/precompute/profiles.py:1152-1156]
- [x] [Review][Patch] `main()` double-labels the baseline note: "profile baseline: committed /data baseline: 1296 profile(s)" [pipeline/precompute/profiles.py:1289]
- [x] [Review][Patch] Defensive-guard asymmetries: a team name divergence is silently accepted while a player's raises, a JSON boolean passes the substitution-minute check, and a null in a conflict set raises `TypeError` from inside the error path [pipeline/precompute/profiles.py:684, 466, 879]
- [x] [Review][Patch] The test module's `independent_join` fixture is less null-tolerant than the code it tests and would `KeyError` on the `players: null` branch this story added a fixture for [pipeline/tests/test_emit_profiles.py:142-159]
- [x] [Review][Patch] `attemptsAtGoal` and the six `TeamMatchBreakdown` `keyStatistics` columns are asserted nowhere — verified correct today, but a coarser precision binding would stay invisible [pipeline/tests/test_emit_profiles.py]
- [x] [Review][Patch] `aggregates[]` order is asserted alphabetical rather than against `common#MetricCode` itself, so a non-alphabetical enum reorder would silently break the stated contract [pipeline/tests/test_emit_profiles.py]
- [x] [Review][Patch] The pinned Public API list under-declares five shipped entry points used by the test module: `load_bundles`, `index_bundles`, `has_minutes`, `precision_by_key`, `per_ninety_places` [story file, Public API]

- [x] [Review][Defer] `test_emit_profiles.py` costs 8m40s on a suite already at ~45 minutes and documented as getting killed for length — ~10 full emit passes over the committed corpus [pipeline/tests/test_emit_profiles.py] — deferred, a coverage-vs-runtime tradeoff rather than a defect

## Dev Notes

### Mental model (read this first)

This story is **1.16 again, with a different reduction**. The emission machinery — canonical
writer, precision layer, budget gate, schema validation, typed errors, CLI shape, all-or-none
policy — is built, shipped and reviewed. **You are writing a reducer and a test suite, not an
emitter.** Almost every mistake available to you is a mistake 1.16 already made and had caught in
review; §Known landmines is that list, transposed.

The one genuinely new intellectual content is **per-metric aggregation semantics**, and it is
adversarial: the schema's `AggregationSemantics` enum (`sum | max | average`) is too coarse to
express the distinction that matters, the committed fixture ships the wrong arithmetic for the
one weighted metric, and the existing reproducibility test does not read `aggregates[]` at all.
A test that mirrors the implementation will be green on all three defects.

### Probe results (2026-08-06) — re-derive every number, do not copy it forward

Measured over the 104 committed bundles at `74b1789`.

| Fact | Measured |
|---|---|
| Contract version | `contract/version.json` = `{"schemaVersion": 4}`; both profile schemas `const: 4` |
| Pinned entities | 48 teams, 1,248 players, 104 matches |
| Players with minutes in ≥1 match | **1,039** |
| **Zero-appearance players** | **209** (16.7% of the player artifacts) |
| (match, player) pairs with minutes | **3,288** = 2,288 starters + 1,000 substitute appearances |
| Domain G rows | **3,289** |
| With-minutes pairs lacking a Domain G row | **0** |
| Domain G rows lacking minutes | **1** — `m092-mexico-england` / `henderson-jordan-eng`, all zero |
| Entries with both `substitutedOn` and `substitutedOff` | 4 |
| Substitution stamps carrying `stoppageMinute` | 122 |
| Substitution stamps above minute 90 in a regulation match | **0** |
| Matches at 120 minutes | **9** = 5 `extra-time` + 4 `shootout` (agrees with `periods_played`'s 95/9) |
| Shootout matches where `metadata.score` is level | **4** (`m074`, `m075`, `m088`, `m096`) ⇒ 8 ambiguous team-rows |
| Stage distribution | group 72, r32 16, r16 8, qf 4, sf 2, third-place 1, final 1 |
| Teams where all-rows points ≠ group-only points | **19 of 48** (Mexico 12 vs **9**) |
| MetricCode enum | 32 values — **18** name a Domain G field, **14** team-scope only, 0 neither |
| Mexico real 5-match `possession` mean | **48.18** (fixture says 59.3) |
| Mexico real 5-match `pressingIntensity` | **213.0** (fixture says 185.8) |
| Mexico real `buildUpLow.lineHeight` mean | **19.4** (fixture agrees — it is a 5-match mean) |
| Mexico `record.played` in the fixture | **3** (the fixture is a hybrid) |
| Largest Match Bundle, gzip -9 | 14,251 bytes = **2.85%** of the 500 KB ceiling |

### What already exists — do not reinvent any of this

| Need | Already shipped | Where |
|---|---|---|
| Canonical write (sorted keys, UTF-8, LF, atomic) | `canonical_json(obj)`, `write_canonical(obj, path)` | `pipeline/ingest/records.py` |
| Per-field precision | `decimals_map(schema_name)`, `round_to_precision(node, decimals)` | `pipeline/precompute/serialize.py` |
| Budget gate | `BUDGET_BYTES = 500_000`, `gzip_bytes(text)`, `over_budget(label, text)` | `pipeline/precompute/budget.py` |
| Schema validation, all violations at once | `validate_artifact(instance, schema_name, instance_label)` | `pipeline/validate/schema.py` |
| The version integer | `schema_version()` — cached, rejects a float, the only reader of `version.json` | `pipeline/validate/schema.py` |
| Schema tree walk for `x-decimals` | `walk_subschemas(node, pointer="")` | `pipeline/validate/schema.py` |
| Field-set totality | `check_total(obj, def_name, where)`, `_def_properties(name)` | `pipeline/precompute/emit.py` |
| Entry-point shape guard (pattern to copy) | `check_spine_shape(match_spine, where)` | `pipeline/precompute/emit.py` |
| Pinned ids, team codes | `PINS`, `TEAM_CODES`, `OVERRIDES` | `pipeline/precompute/slug_registry.py` |
| Id immutability + `/data` baseline | `check_pins`, `check_committed_data`, `COMMITTED_ID_KEYS`, `NULLABLE_ID_KEYS` | `pipeline/precompute/identity.py` |
| Typed errors | `PrecomputeError` and subclasses | `pipeline/precompute/errors.py` |
| The with-minutes predicate | `has_minutes(entry, section) -> bool` | `pipeline/extract/domain_g.py` |
| Stage ordering | `KNOCKOUT_ROUNDS`, `ROUNDS` | `pipeline/discover/rounds.py` |
| CLI shape, exit codes, `--dry-run` | `build_parser()`, `main(argv=None) -> int` | `pipeline/precompute/emit.py`, `run.py` |
| Input artifacts | 104 bundles | `data/matches/{match-id}.json` |

**And one thing you must NOT do:** `pipeline/validate/runner.py` carries a **second, inline
copy** of the canonical-write recipe (non-atomic). It is pre-existing and ledgered. Do not copy
it, and do not "unify" it here.

### Contract reality — read before coding

- **`team-profile.schema.json`** required: `schemaVersion`, `teamId`, `name`, `teamCode`,
  `group`, `record`, `tacticalIdentity`, `formationUsage`, `matches`. `$defs`:
  `AggregateShapeMetrics`, `TournamentRecord`, `AggregateTacticalIdentity`, `FormationUsageRow`,
  `TeamMatchBreakdown`. **No goalkeeping property; `additionalProperties: false`.**
- **`player-profile.schema.json`** required: `schemaVersion`, `playerId`, `name`, `team`,
  `position`, `shirtNumber`, `appearances`, `aggregates`, `physical`, `matches`, `trends`.
  `$defs`: `Appearances`, `AggregateMetric`, `PhysicalProfile`, `PlayerMatchRow`, `TrendPoint`,
  `TrendSeries`. **No `minItems` anywhere** — empty arrays are legal, which is what makes the
  zero-appearance shape possible.
- **Precision table** (`contract/README.md`, `## Numeric precision`): pitch coords 2, expected
  goals 2, kilometres 2, percentages 1, metres 1, km/h 1, counts/minutes/ranks/shirt numbers 0.
- **`x-decimals` is enforced by nothing but your serializer.** `multipleOf` appears zero times in
  `/contract`, deliberately. *"A bundle carrying 17-digit floats validates clean."*
- **Cross-field invariants go in pytest, never in the schema** — `if`/`then` compiles to an open
  object in the codegen and reintroduces the index signature AD-2 exists to prevent.
- **Bundle key paths you will read** (all camelCase, confirmed against a real bundle):
  `metadata.{matchNumber,date,kickoff,venue,stage,group,matchdayRound}`,
  `metadata.{homeTeam,awayTeam}.{teamId,teamCode,name}`, `metadata.score.{home,away}`,
  `metadata.knockoutScore.{decidedBy,scoreAfter90,scoreAfterET,shootoutScore,winnerTeamId}`,
  `metadata.lineups.{home,away}.{formation,starters[],substitutes[]}` with entry keys
  `{playerId,name,position,shirtNumber,substitutedOn,substitutedOff,cards[],goals[]}`,
  `keyStatistics.{home,away}.*` (19 fields), `players[].{playerId,playerName,teamId,position,
  shirtNumber,inPossession,outOfPossession,physical}`, `tacticalIdentity.{home,away}.*`.
  **`tacticalIdentity` is keyed `home`/`away`, not by `teamId`** — resolve the side.

### Failure & validation policy (AD-8, binding)

- **Typed exceptions only.** Append to `pipeline/precompute/errors.py` following the shipped
  `PrecomputeError` shape exactly — a `what` class attribute, `__init__(reason, report_id=None)`,
  message `f"[{where}] {self.what}: {reason}"`. **Never a bare `ValueError`**: the exit-code
  contract maps any `PipelineError` to 1 and anything untyped to 2, so a bare raise reports a
  dataset finding as a broken harness.
- **Collect, then raise.** Gather every schema violation, every unmapped field and every budget
  breach before failing. *"Aborting on the first turns one run into ten."* 1.16 took a review
  finding for letting two of those three classes propagate immediately.
- **Emit all or emit none**, and say so in the module docstring citing AD-4 and AD-8, so a
  reviewer does not read the corpus-level abort as an AD-8 violation.
- **Assert-on-unknown everywhere.** An unresolvable group, a with-minutes entry with no Domain G
  row, a formation string the pattern rejects, a duplicate id, a metric code outside the enum →
  loud, typed, with the offending values in `repr()`.
- **Never `null` where the schema says a number**, and never a display string anywhere (AD-7):
  raw numerics, ISO 8601 dates, enum codes. Units are locale-layer metadata keyed by metric code.

### Testing standards summary

pytest only (AR-16). Run `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests` from the
repo root — a bare `python -m pytest` fails on `pymupdf`. **There is no `pytest.ini`, no
`pyproject.toml`, no `setup.cfg` and no registered markers anywhere**; configuration is
conventional and `conftest.py`'s `sys.path.insert` is what makes `pipeline.*` importable.
Collection was **1,501** at 1.16's close (1,500 passed, 1 skipped). **The full suite takes ~45
minutes — run it in the background, not in chunks that time out.** Flat layout, one module per
production module. Long sentence-like test names. `clean_registry` is defined **locally** per
test module, never in `conftest.py`. Byte-identity is tested on **bytes**, not parsed dicts.
Probe scripts go to the session scratchpad, never the repo. Derive expected values from parsed
data, never restate the implementation. Every gate ships with a constructed failure that drives
it red. Measure your own pre-change baseline with attribution for every pre-existing failure —
the tree is shared and collection counts drift by design.

### Coordination — in-flight stories (respect strictly)

**Story 1.17 (`tournament.json` + `leaderboards.json`) shares `pipeline/precompute/` and
`data/index/`.** Output paths are disjoint — 1.17 writes two files at `data/index/`, you write
two directories beneath it — but the package is shared.

**Confirmed live.** `1-17-tournament-index-results-standings-leaderboards.md` landed (untracked)
during this story's creation and reads `ready-for-dev`. Its answers to our two open items are
already written down — **read them, do not re-negotiate them:**

- **The serializer is NOT moving.** 1.17's *"What already exists"* table pins
  `canonical_json(obj) -> str` and `write_canonical(obj, path) -> Path` at
  `pipeline/ingest/records.py` and repeats the rule *"Do not hand-roll `json.dump`. A second
  serializer is a second definition of canonical."* **Import it from where it is.** (1.17's
  Task 8.5 adds a `write_canonical(json.loads(text), target)` round-trip idiom *"so the measured
  bytes and the written bytes are provably the same serialization"* — worth copying.)
- **The bijection: 1.17 claims it, and its recommendation matches R3.** Its DECISION **D2**
  (*"When and where is the AD-4 bijection asserted, given profiles are 1.18's?"*) recommends
  Story 1.15's two-source pattern with *"a red-by-design successor test"*, and explicitly
  **rejects** moving the full bijection to 1.19 because that *"leaves AC 3 unowned in this story
  and contradicts the schema's own statement that the assert runs in 1.17."* **D2 is surfaced to
  Juan and left unruled** — so R3 is the same question from the other side. Ruling one rules
  both; do not let them be ruled differently.
- **1.17 appends to `budget.py`** (`over_budget_combined(label, texts)`, beside `over_budget`,
  same return-don't-raise contract). That file is read-only for you; expect it to change
  underneath you and do not conflict-resolve by reverting.
- **Module namespaces are disjoint:** 1.17 builds `pipeline/precompute/index.py`, you build
  `pipeline/precompute/profiles.py`. Both append typed errors to the same `errors.py` —
  append-only, and 1.17 already claims `RouteManifestError`.
- **Every shared-file edit is APPEND-ONLY**: `pipeline/README.md`, `deferred-work.md`,
  `sprint-status.yaml`, `pipeline/precompute/errors.py`, `pipeline/tests/test_fixtures.py`.
- **Never `git add -A`.** Stage your own paths by explicit path — the CS-2 precedent, and 2.11a
  and 2.18 before it. Verify in an isolated worktree if `pipeline/` goes dirty underneath you.
- **Cite shared artifacts by quoted anchor phrase, never by line number.**
- **The serializer: check before you build.** 1.16 established
  `pipeline.ingest.records.canonical_json` / `write_canonical` as the canonical writer.
  **Check whether 1.17 has moved it to a shared location and follow it there.** Do not mint a
  third serializer and do not fork the recipe. If 1.17 has not moved it, import it where it is.
- **The bijection assert has two claimants.** Resolve R3 with 1.17 explicitly before writing it.
- **1.17 also needs per-metric precision for polymorphic slots** (`LeaderboardValue` carries the
  identical note). If 1.17 builds a `metricCode`→precision helper, share it rather than
  duplicating — but only additively, and only if it lands first.
- **Epic 2 sessions:** do not touch `app/`, `contract/` or the generated type trees. This story
  needs no schema change and therefore no version bump (FR-1's explicit no-bump carve-out).

### Known landmines (live risks for this story)

1. **Copying `emit._KEY_TO_DEF`.** It was found defective in 1.16's review — 29 percentage and
   metre leaves inherited 0 places because unrecognised keys inherit a parent's binding. Build a
   profile-scoped table where every leaf is bound explicitly and an unbound leaf raises.
2. **Rounding `perNinety` to the source metric's precision.** `goals` per-90 becomes `0`. It is
   2 places for every metric. The fixture's `0.37` is the proof.
3. **Emitting the unweighted mean for `passCompletion`.** The committed fixture ships 82.4; the
   correct value is 83.2. Copying the fixture forward reproduces the defect and the shipped test
   will not see it.
4. **Computing `record.points` over all rows.** Wrong on 19 of 48 teams. The shipped
   `test_the_team_profile_record_matches_its_own_per_match_rows` asserts the wrong form and must
   be corrected in the same change.
5. **Iterating `players[]` to build match rows.** Manufactures a phantom appearance for
   `henderson-jordan-eng` in `m092`, breaking `played == started + substituteAppearances`.
   Iterate lineups-with-minutes.
6. **Dividing by zero on `passCompletion`.** 17 players with minutes attempt 0 passes across the
   whole tournament; 53 individual match rows attempt 0. `value` and `Percentage` are both
   non-nullable. Emit `0.0` (AC 2's binding block).
7. **Sourcing a player's identity block from Domain G.** It works for 1,039 players and produces
   a `KeyError` for the other 209. `name`, `position`, `shirtNumber` and `team` come from
   lineups (Task 5.1a). And `position` is genuinely ambiguous on `senesi-marcos-arg`.
8. **Reusing `emit._team_ref` for `opponent` / `team`.** It returns `TeamRef`
   `{teamId, teamCode, name}`; both slots need `EntityRef` `{id, name}` with
   `additionalProperties: false`. Schema-invalid on every row.
9. **Pruning or special-casing all-zero players.** Do not. *(The ledger's "43 all-zero
   pass-network nodes" entry does not reach this story: `events.passNetworkNodes` is `null` on
   104/104 bundles, neither profile schema carries a node, and the node rows live only in
   gitignored `work/spine/` — which Task 2.1 rules out as an input. The count itself is disputed
   between 1.15's and 1.17's re-derivations; do not restate it. Your live populations are the
   209 zero-appearance players and the one Henderson (match, player) pair — premises 2 and 6,
   not a third group.)*
10. **Treating "no manifest" as "bijection passed".** The `check_committed_data` precedent is
   explicit: print that the source is unavailable; never let absence read as a pass.
11. **A budget gate that cannot fail.** ~97% headroom. Ship the constructed red test.
12. **Writing before validating.** Two new namespaces, both committed, both feeding
   `check_committed_data`'s immutability baseline. Build → validate → round → measure → write.
10. **A non-atomic write loop.** An `OSError` on artifact 800 of 1,296 leaves a partial namespace
    pinned as the baseline. Task 7.4 owns this; the ledger routes it to *"whichever story next
    edits the emitter's write path."*
11. **Hardcoding `4`.** Read `schema_version()`. A bump is six declarations and a literal would
    be a seventh.
12. **A generic `re.sub` snake→camel mapper.** Forbidden by 1.16's rule; and Task 2.1 removes the
    need entirely by reading the already-camelCase bundles.
13. **`decimals_map`'s vacuity `AssertionError` and `json.JSONDecodeError` escaping as tracebacks
    through the CLI** — both are exit-code-2 impostors. 1.16 took a review finding for both.
14. **Assuming `tacticalIdentity` is keyed by `teamId`.** It is keyed `home`/`away`.
15. **Assuming `metadata.group` is present.** It is null on the 32 knockout matches.
16. **"Fixing" the fixtures' populated goalkeeping technique blocks to match the corpus's nulls.**
    Story 2.10's presence gates need the populated branch.
17. **Calling `emit.check_total` / `_def_properties` on a profile `$def`.** `KeyError` on all 13.
    Task 4.7 — build the profile-scoped equivalent.
18. **Trusting `decimals_map` to have bound `perNinety`.** It has not; the declaration is inside
    an `anyOf`. Unrounded floats that validate clean and break byte-identity. Task 6.2b.
19. **Regenerating a profile fixture without regenerating `leaderboards.json`.** Two
    `test_fixtures.py` tests go red for reasons that are not defects. Task 8.3a.
20. **Adding `id` to `COMMITTED_ID_KEYS`.** Turns 1.16's totality test red. Task 7.8b.

### Project Structure Notes

**New**
- `pipeline/precompute/profiles.py` — the two builders, the emitter, the CLI.
- `pipeline/tests/test_emit_profiles.py` — the story's own suite.
- `data/index/team-profiles/{team-id}.json` × 48 — emitted, committed (AD-13).
- `data/index/player-profiles/{player-id}.json` × 1,248 — emitted, committed (AD-13).

**Modified (additive / append-only only)**
- `pipeline/precompute/errors.py` — typed subclasses appended.
- `pipeline/precompute/identity.py` — `COMMITTED_ID_KEYS` extension (Task 7.8), additive.
- `pipeline/tests/test_fixtures.py` — guard relaxation (Task 8.2) and profile reproducibility.
- `pipeline/README.md`, `deferred-work.md`, `sprint-status.yaml`, this story file.
- `data/fixtures/**` — FR-1 regeneration (Task 8), **no `schemaVersion` bump**. This
  necessarily includes `data/fixtures/index/leaderboards.json` and
  `data/fixtures/index/tournament.json` (Task 8.3a's cascade), plus `data/fixtures/README.md`
  if its prose describes the fixture set. **The `data/index/` copies of those two files are
  1.17's and are out of scope.**
- `pipeline/tests/test_precompute_identity.py`, `test_emit_bundles.py`,
  `test_extract_report_domain_g.py` — only where a fixture regeneration forces it (Task 8.3b,
  8.5). Each such edit is a declared consequence, never an opportunistic change.

**Read-only — do not edit**
- `contract/**` — no shape change is in scope; FR-1 is explicitly fixture-only.
- `app/**` — Epic 2's tree (AD-1).
- `pipeline/extract/**`, `pipeline/markers/**`, `pipeline/discover/**`.
- `pipeline/ingest/records.py` — import it; do not change it.
- `pipeline/precompute/budget.py`, `serialize.py`, `slug_registry.py`.
- `pipeline/validate/**` — the FR-15 gate is per-report and out of scope (Task 10.5).

**Unchanged by design**
- `pipeline/precompute/emit.py` — unless Task 7.4's all-or-nothing helper is shared with
  `emit_bundles`, in which case the edit is additive and must be declared.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`, `### Story 1.18: Team & Player Profile Artifacts`] — the four ACs, verbatim.
- [Source: `epics.md`, `### Story 1.17: Tournament Index — Results, Standings & Leaderboards`] — the competing bijection AC.
- [Source: `epics.md`, `### Story 2.15: Player Profile` / `### Story 2.16: Team Profile`] — the consumer contract.
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md`, `## Invariants & Rules`] — AD-3 (ids are slugs, never change), AD-4 (artifact set, 500 KB per profile, route-manifest bijection), AD-5 (aggregation lives only in precompute), AD-7 (locale-neutral), AD-8 (fail loud, deterministic output), AD-9 (extract then precompute), AD-13 (`/data` is committed).
- [Source: `contract/team-profile.schema.json`, `$defs.AggregateTacticalIdentity`] — the six required blocks and `shapeByPhase`'s CS-2 `$comment` naming this story.
- [Source: `contract/player-profile.schema.json`, `$defs.AggregateMetric`] — *"Story 1.16's serializer MUST round to the precision of the source field named by metricCode."*
- [Source: `contract/common.schema.json`, `$defs.MetricCode`] — the closed 32-value enum and its scoping rule.
- [Source: `contract/README.md`, decision 16] — aggregation semantics live in the artifact, not the README.
- [Source: `_bmad-output/implementation-artifacts/cs-2-change-set-spec.md`, `### Two additions to the filed scope, both made deliberately`] — why `team-profile.schema.json` was reshaped for this story.
- [Source: `1-16-…-budget-gate.md`, AC 1 clause 3 BINDING] — the canonical writer, `x-decimals`, byte-identity, the budget unit.
- [Source: `1-15-…-normalized-spine.md`, the caps-run rule and the pinning rule] — id formation and immutability.
- [Source: `1-10-…-domain-g-extraction.md`] — the 41-field Domain G surface, the integral-count rule, the Henderson anomaly.
- [Source: `1-9-…-domains-e-f-extraction.md`, `§The premise is wrong`] — why goalkeeping is per-team.
- [Source: `deferred-work.md`, anchors *"Fixture request FR-1 (routed to Story 1.18's fixture work"*, *"A zero-appearance squad member is schema-valid but fails the profile test"*, *"The `>=` to `==` tightening of"*, *"still holds at `>=`, and CS-2 does not change that"*, *"An `OSError` mid-write leaves `data/matches/` partially populated with no rollback."*, *"No fixture exercises `decidedBy: \"extra-time\"`"*, *"`team-profile.schema.json` was reshaped in step, and it was not in the filed scope."*, *"219 players / 856 lineup entries slug in GIVEN-NAME-FIRST order"*] — the eight filings routing here plus the 1.15 slug-ordering warning behind R5.
- [Source: `pipeline/tests/test_fixtures.py`, `test_leaderboard_rows_agree_with_the_profiles_and_standings_they_duplicate` and `test_the_tournament_entity_index_resolves_to_the_artifacts_that_exist`] — the two tests Task 8.3a's cascade turns red.
- [Source: `pipeline/tests/test_emit_bundles.py`, `test_the_committed_id_check_is_total_for_a_match_bundle`] — the test Task 7.8b must not break.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context), `claude-opus-5[1m]`.

### Debug Log References

Probe and verification scripts ran from the session scratchpad, never the repo:
`probe_task1.py` (Task 1's full re-derivation), `anchors.py` (the acceptance anchors,
checked against built artifacts before anything was written), `regen_fixtures.py`
(Task 8.3/8.3a/8.4), `fr1_fixture.py` (Task 8.1) and `mutate.py` (Task 9.12).

Verification ran in an isolated git worktree at `C:/wt118` throughout. That was necessary
rather than fastidious: three commits landed in the shared tree during this
implementation — `ae207ed` (Story 1.17), Story 2.12's implementation and `29e90fb` (Story
2.12's review) — and `pipeline/precompute/{emit,serialize,budget,errors}.py` changed
underneath this story mid-run.

### Completion Notes List

**Every Task 1 figure re-derived and reproduced**, with two reconciliations recorded rather
than smoothed: `PINS` is `{kind: {source_key: slug}}` so the pinned id set is `.values()`
(209 zero-appearance players confirmed); and `passesAttempted == 0` holds on **53 Domain G
rows** but only **52 emitted match rows**, the 53rd being Henderson's m092 row, which
produces no `PlayerMatchRow` at all.

**TWO FURTHER FIGURES DID NOT REPRODUCE, and this section originally named a different pair,
so a reader of the story file alone would not have learned it.** Added in code review, under
this story's own rule that *"a figure that does not reproduce is a finding, not a rounding
difference"*:

* **Task 8.4 and landmine 3 pin `passCompletion` at `83.2`; the regenerated fixture ships
  `82.2`, and 82.2 is correct.** The story's 119/143 was measured against the OLD fixture's
  three synthetic match rows. Regenerated from the real corpus, Quiñones has five matches and
  Σ111/Σ135 = 82.222… ⇒ **82.2**. The weighted rule is unchanged and still the point — only
  the arithmetic's inputs moved. This was reconciled in `deferred-work.md` at implementation
  time but not here, while the Completion Notes claimed "two reconciliations recorded" and
  named the other two.
* **Task 8.4's `domain-g-zone-sum` gate fails 88 of 96 fixture rows, not the 79 the task
  states.** Re-measured with the shipped tolerance (`|totalDistance − Σzones| > 0.2`) over
  `data/fixtures/matches/*.json`. The figure is not a regression: the match-bundle fixtures
  were deliberately NOT regenerated (Story 2.10's presence gates need their populated
  goalkeeping technique blocks, and the Domain G ground-truth pins read m001's
  hand-transcribed physical block), so the count is simply higher than the story measured.
  The regenerated PROFILE fixture's own zones do reconcile, at 0.1 m drift.

**Emitted 1,296 artifacts** — 48 team profiles, 1,248 player profiles — all schema-valid,
all within budget (largest **1,543 gzip-9 bytes, 0.31% of the 500 KB ceiling**), byte-identical
across two independent emissions in two trees.

**Rulings taken by Juan and implemented:** R1 (A) — goalkeeping appears in no profile
artifact; a goalkeeper's profile is shaped exactly like every other player's. R2 — all 18
player-scope metrics in enum order plus six trend series, **total on all 1,248 files**
including the 209 who never played. R3 — Story 1.17 owns the route-manifest bijection; this
story asserts the registry-pinned 48 + 1,248 and `main` PRINTS
`route-manifest bijection not asserted here; owned by Story 1.17.` on every run.
R5 — proceed with today's slugs.

**Rulings taken by the dev agent, with rejected alternatives recorded:** R4 — `result`
follows `metadata.score`, so the 8 team-rows of the 4 shootout matches read `draw`
(*rejected: deriving from `winnerTeamId`, which would make `record.drawn` disagree with the
standings 1.17 emits from the same field*). `trends[]` ordering — the same enum
(alphabetical) order as `aggregates[]`, so one convention serves both lists (R2 enumerated
the set and left the order open). `position` — most frequent lineup value, ties broken by
first chronological occurrence, yielding `df` for `senesi-marcos-arg` (*rejected: "first
lineup entry", which yields `mf` from a match he did not play, and "the Domain G row", which
is unavailable for the 209*).

**THE MUTATION CHECK FOUND A REAL DEFECT IN THIS STORY'S OWN TEST SUITE, and that is the
single most important thing in these notes.** The first run reported **0 red on all five
mutations**. The cause was structural: the test fixtures loaded the COMMITTED artifacts from
`data/index/`, so mutating the emitter changed nothing the semantic assertions could see —
the eighteen named expectations were proving the committed FILES correct and saying nothing
about the emitter, with the whole emitter-to-artifact coupling resting on one byte-comparison
test. Fixed by building every profile in memory through the emitter (`built` fixture) and
checking the on-disk namespace separately (`committed_*` fixtures). Both properties are now
asserted and a mutation turns the NAMED test for the metric it breaks red.

**A second real defect was caught by the byte-comparison, in this story's own output.** The
mutation harness was killed mid-run and its `finally` restore did not complete, leaving the
`perNinety` mutation in `profiles.py`; 1,296 artifacts were then emitted with `perNinety`
rounded at the source metric's precision — `2.34` shipped as `2` — which is landmine 2
exactly, and it validates clean. The comparison against the independent worktree emission
caught it (1,019 of 1,296 differing), the line was restored, and re-emission returned
`1296 artifacts, 0 differ`. Mutations now run only in the worktree, and the harness verifies
its own restore.

**Full regression suite (Task 9.13): 1,527 passed, 181 skipped, 0 failed** in 35m48s, run
in the isolated worktree in the background rather than in chunks. This story contributes
**82 tests** in `pipeline/tests/test_emit_profiles.py`.

One test is deselected in the worktree run and it is a WORKTREE ARTEFACT, not a defect:
`test_contract_schemas.py::test_the_committed_generated_types_still_match_the_schemas`
shells out to `contract/scripts/generate-types.mjs`, whose `json-schema-to-typescript`
dependency lives in a gitignored `node_modules`, so a fresh worktree cannot run it. It
passes in the main tree (73/73), and `contract/` was not touched by this story.

The four failures the first full run surfaced were all triaged rather than assumed, and
three were real: the `globs` parameter formatted the "unavailable" message with the glob
instead of the directory (caught by the load-bearing negative that pins that exact string);
the fixture-reach count moved 155 -> 207 because FR-1's bundle brings two more squads in;
and Story 1.17's red-by-design successor test fired exactly as designed.

**Mutation red counts (Task 9.12), after the suite was fixed.** Each turns the NAMED test
for the rule it breaks red, not merely the byte comparison:

| Mutation | Red | Named test that catches it |
|---|---|---|
| `topSpeed` max -> sum | 2 | `test_the_top_speed_aggregate_is_the_corpus_MAXIMUM_and_never_a_sum` |
| `passCompletion` weighted -> unweighted | 2 | `test_the_pass_completion_aggregate_is_WEIGHTED_and_not_the_mean_of_the_percentages` |
| `perNinety` at the metric's own precision | 3 | `test_per_ninety_is_two_decimal_places_for_every_metric_including_the_counts` |
| `points` over all rows | 2 | `test_the_team_record_is_derivable_from_its_own_rows_with_GROUP_ONLY_points` |
| swapped home/away side | 6 | `test_every_tactical_identity_leaf_is_the_per_leaf_mean_over_the_teams_own_matches` |

**The fifth mutation exposed dead code in this module and it was deleted.** "Swapped
home/away side" first scored 0 red — not because the tests were weak, but because it was
mutating a `_side_of(bundle, team_id)` helper that **no caller ever used**: `index_bundles`
resolves the side by construction, iterating `("home", "away")` and filing each row under
that side's own team. A lookup helper nobody calls is worse than none, because it reads as
the place the rule lives and a reviewer checking "is the side resolved correctly?" would
find a correct-looking function and stop. Deleted, with the reason left in its place;
re-targeted at `index_bundles` the same mutation scores 6 red.

**A finding the story did not anticipate, measured and kept:** 75 substitutes are stamped at
exactly the closing minute of their match and therefore play **0 clock minutes** under Task
3.3's ignore-`stoppageMinute` ruling; 59 of the 75 carry a stoppage stamp and 16 do not, so
adding stoppage back would not remove the population — it would instead make
`{minute: 90, stoppageMinute: 2}` in a 90-minute match compute `−2`. **20 players total 0
minutes despite an appearance** and carry a null `perNinety` on every metric. No starter is
affected. Filed to the ledger with Story 2.15 named as owner for the copy ruling.

**Two of the story's "reproduced by running the code" premises were correct at the baseline
and were overtaken mid-implementation.** At `74b1789` `emit._def_properties` raised
`KeyError` on all 13 profile `$def`s and `decimals_map` silently omitted `PerNinety` — both
verified in a worktree at that exact commit. Story 1.17 (`ae207ed`) then landed the
`documents` parameter and the `anyOf` fix. The profile-scoped forks Tasks 4.7 and 6.2b
ordered were written against the baseline and then **retired** in favour of the shipped
functions, and the tripwires that detected the change were inverted into positive assertions
so a revert of either is loud. The 1,296 artifacts are byte-identical before and after.

**Task 7.8 widened the walker, not just the key set.** `check_committed_data` gained a
`globs` parameter (default byte-for-byte Story 1.15's behaviour, so
`test_precompute_spine.py`'s "104 bundle(s)" expectation is untouched) and `identity.py`
gained an artifact-scoped `PROFILE_ID_KEYS`. `COMMITTED_ID_KEYS` is unchanged, so 1.16's
totality test stays green. The profile namespaces now report
`1296 profile(s), 29264 id reference(s), all pinned`. Story 1.17 declined the same widening
on the grounds that a bare `id` "names a team or a player BY CONTEXT" — true across
`data/index/`, and false inside a profile, where `EntityRef` appears in two slots and both
name a team; that is asserted by its own test so the day a third slot names a player, the
map is wrong loudly.

**FR-1 is closed with all nine branches verified programmatically**, via one new fixture
bundle (`m082-belgium-senegal`, chosen by measurement as the only corpus match that is
`decidedBy: "extra-time"` AND carries a `penalty: true` goal AND carries cards) plus a
zero-appearance player profile (`acevedo-carlos-mex`, Mexico's backup keeper — who also
doubles as R1's evidence). The existing three match-bundle fixtures were deliberately NOT
regenerated: Story 2.10's presence gates need their populated goalkeeping technique blocks
and the Domain G ground-truth pins read m001's hand-transcribed physical block.

**ONE SUBTASK IS DELIBERATELY NOT DONE: Task 8.6, the `>=` to `==` flip.** Re-measured at
close: **38 of 66 fixture nodes still go red**, unchanged. The stated precondition ("lands
with the fixture regeneration") cannot be met by this story, because 1.18 regenerates the
PROFILE fixtures and must not regenerate the match-bundle fixtures. The deeper reason it may
never be met: `events.passNetworkNodes` is **null on 104/104 corpus bundles**, so the
invariant skips every real bundle and can only ever run against hand-authored fixtures whose
edge lists are a subset by construction. Both ledger entries were re-filed with the
precondition corrected and an owner named, rather than closed falsely.

**Not claimed, and stated so a reviewer does not read the omission as a miss:** the
`OSError` mid-write ledger entry stays OPEN with its existing owner — this story gives the
two PROFILE namespaces all-or-nothing writes via a staged-directory swap with rollback, but
that entry is about `emit.py`'s bundle loop and `emit.py` was not edited. This story
registers **no FR-15 gate check and writes no run-manifest entry**: both contracts are
per-report (AD-8) while profile emission is corpus-level and all-or-nothing.

**R3's hand-off completed, and the full AD-4 bijection now holds.** Story 1.17 shipped
`test_the_repository_has_no_committed_profiles_yet` as red-by-design "the moment Story 1.18
lands", with its docstring naming the work: *"delete this test, and assert the populated
bijection here instead."* Done. `check_route_manifest`'s populated branch — live but never
exercised on real data — now reports **`matches: 104 <-> 104`, `teams: 48 <-> 48`,
`players: 1248 <-> 1248`, bijection holds** in all three directions. That is R3 working as
ruled: the assert lives with the authority (1.17 owns `tournament.json`), 1.18 asserted only
the weaker unilateral property and PRINTED that the manifest bijection was not asserted
there, so the gap was visible for exactly as long as it existed.

**Unverified and disclosed:** registering `m082-belgium-senegal` in the fixture route
manifest creates a fourth pre-rendered app route — the first to exercise `players: null` and
`goalkeeping: null` in the App. The app suite was NOT run for it: `app/` is Epic 2's tree
(read-only for this story) and was occupied by two concurrent sessions throughout. No app
test asserts a page count and none references `m082`. Filed with an owner.

**Attribution defect, disclosed:** Story 1.17's commit `ae207ed` captured this story's
`ProfileError` and `ProfileValidationError` in `pipeline/precompute/errors.py`. Content
integrity verified — both classes are intact at HEAD — so it is an attribution defect only.
Recorded, not repaired, per the Story 1.14 review's ruling on `5344fac` and Story 2.18's
identical disclosure.

**The same capture happened twice more DURING this story's code review, and is recorded here
for the same reason.** Three commits from a concurrent Story 1.17 session landed while the
review was running — `5d251bb`, `1181a1a` and `119b707` — and between them they committed:

* `pipeline/tests/test_index_tournament.py`, which carries **this story's R3 hand-off** (1.17's
  red-by-design `test_the_repository_has_no_committed_profiles_yet` replaced by the real
  populated bijection). Verified intact at HEAD:
  `test_the_route_manifest_bijection_holds_against_the_committed_profiles` is present.
* `_bmad-output/implementation-artifacts/deferred-work.md`, including the
  `## Deferred from: code review of 1-18-team-player-profile-artifacts` section this review
  appended, committed under the message *"Story 1.17 code review: README, ledger and sprint
  status"*. Verified intact at HEAD.

**Content integrity confirmed in both cases; attribution only.** Not repaired, per the
standing precedent. The pattern is now consistent enough to be a process observation rather
than an incident: this tree has three sessions writing to shared ledger and test files, and a
sweeping `git add` in any of them captures whatever the others have staged in the working
tree. The 1,296 emitted artifacts under `data/index/{team,player}-profiles/` were NOT
captured and remain untracked and unstaged.

### File List

**New**
- `pipeline/precompute/profiles.py`
- `pipeline/tests/test_emit_profiles.py`
- `data/index/team-profiles/{team-id}.json` × 48
- `data/index/player-profiles/{player-id}.json` × 1,248
- `data/fixtures/matches/m082-belgium-senegal.json`
- `data/fixtures/index/player-profiles/acevedo-carlos-mex.json`

**Modified**
- `pipeline/precompute/errors.py` — `ProfileError`, `ProfileValidationError` appended
  (committed early by `ae207ed`; see the attribution note above)
- `pipeline/precompute/identity.py` — `PROFILE_ID_KEYS`, `PROFILE_BASELINE_UNAVAILABLE`, and
  `check_committed_data`'s additive `globs` / `id_keys` / `unavailable` / `noun` parameters
- `pipeline/tests/test_fixtures.py` — the two non-empty profile guards relaxed, the
  group-only `points` correction, the `players: null` re-scope, and one new skip-integrity test
- `pipeline/tests/test_precompute_identity.py` — two unguarded `doc.get("players", [])` reads,
  and the fixture-reach count 155 -> 207
- `pipeline/tests/test_index_tournament.py` — Story 1.17's red-by-design
  `test_the_repository_has_no_committed_profiles_yet` replaced by the REAL populated
  bijection, exactly as its own docstring instructed (R3's hand-off)
- `pipeline/README.md` — `## Story 1.18 — team & player profile emission` appended
- `data/fixtures/index/team-profiles/mexico.json` — regenerated as the real five-match aggregate
- `data/fixtures/index/player-profiles/quinones-julian-mex.json` — regenerated
- `data/fixtures/index/leaderboards.json` — the possession and topSpeed pins, ranks re-ordered
- `data/fixtures/index/tournament.json` — entities and knockoutResults extended
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — appended
- `_bmad-output/implementation-artifacts/1-18-team-player-profile-artifacts.md` — this file

**Unchanged by design:** `pipeline/precompute/emit.py`, `budget.py`, `serialize.py`,
`slug_registry.py`, `pipeline/ingest/records.py`, `contract/**`, `app/**`.

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story context created from baseline `74b1789` (verified HEAD). Contract verified at `schemaVersion` 4 before any schema was read. Probe measured against the 104 committed bundles: 1,248 pinned players of whom **209 never played**; 3,288 with-minutes (match, player) pairs = 2,288 starters + 1,000 sub appearances against 3,289 Domain G rows, the single orphan being `m092`/`henderson-jordan-eng`, all zero; 9 matches at 120 minutes; **19 of 48 teams** where the shipped `points` test disagrees with the schema's group-only rule; MetricCode's 32 values splitting **18 player-scope / 14 team-scope**. Five decisions surfaced for Juan, **R1 and R3 blocking**: R1 goalkeeping appears in *no* profile artifact (CS-2 D2b made the block per-team and neither profile schema has a slot); R2 the aggregate/trend rosters; R3 the bijection owner (Story 1.17's DECISION D2 is the same question from the other side, also unruled); R4 `result` on the 4 shootout matches; R5 the 1,248 slugs becoming permanent URLs. Validated by two fresh-context subagents against `checklist.md`; all 23 factual claims re-measured independently and reproduced, and every finding applied. That pass caught four defects that would have produced a wrong implementation, each re-verified by running the code: (1) the mandated weighted `passCompletion` **divides by zero on 17 real players and 53 match rows** and `value` is non-nullable — now ruled to `0.0`; (2) the identity block (`name`/`position`/`shirtNumber`/`team`) was unspecified and is reachable only from lineups for the 209, with `position` genuinely ambiguous on `senesi-marcos-arg`; (3) **`emit.check_total`/`_def_properties` raise `KeyError` on all 13 profile `$defs`** — they resolve against the bundle document only; (4) **`decimals_map` silently omits `PerNinety`** because its `x-decimals` sits inside an `anyOf`, shipping unrounded floats that validate clean. Also corrected: 35→**40** `tacticalIdentity` leaves; the Mexico possession anchor 48.18→**48.2** at emitted precision; the fixture cascade into `leaderboards.json` (pins `mexico 59.3`) and `tournament.json` entities; `COMMITTED_ID_KEYS` cannot absorb `id` without breaking 1.16's totality test; `emit._team_ref` is `TeamRef`, not the `EntityRef` both profile slots need; and the reusable `has_minutes` / `KNOCKOUT_ROUNDS` the first draft told the dev to re-derive. Story 1.17's file landed mid-run and confirmed the serializer is **not** moving from `pipeline/ingest/records.py`. |
| 2026-08-06 | Story 1.18 implemented; status ready-for-dev -> review. **1,296 artifacts emitted** (48 team + 1,248 player profiles), all schema-valid, largest **1,543 gzip-9 bytes = 0.31% of the 500 KB ceiling**, byte-identical across two independent emissions in two trees. Every Task 1 figure re-derived and reproduced, with two reconciliations recorded: `PINS` is keyed `{kind: {source_key: slug}}` so the pinned set is `.values()` (209 zero-appearance confirmed), and `passesAttempted == 0` holds on 53 Domain G rows but only **52 emitted match rows** (the 53rd is Henderson's m092, which produces no row). Juan ruled R1 (A) no goalkeeping in any profile, R2 all 18 aggregates + 6 trends total on all 1,248 files, R3 1.17 owns the bijection, R5 proceed with today's slugs; R4 and the trend ordering were dev-ruled with rejected alternatives recorded. **THE MUTATION CHECK FOUND A DEFECT IN THIS STORY'S OWN SUITE:** the first run scored 0 red on all five mutations because the fixtures read the COMMITTED artifacts, so the eighteen named expectations proved the files correct and said nothing about the emitter — the whole coupling rested on one byte-comparison. Fixed by building every profile in memory (`built`) and checking the on-disk namespace separately (`committed_*`). **A SECOND DEFECT WAS CAUGHT BY THE BYTE-COMPARISON, IN THIS STORY'S OWN OUTPUT:** the mutation harness was killed mid-run, its `finally` restore did not complete, and 1,296 artifacts were emitted with `perNinety` rounded at the source metric's precision — `2.34` shipped as `2`, landmine 2 exactly, and it validates clean. Caught at 1,019/1,296 differing, restored, re-emitted to 0 differing; mutations now run only in a worktree and the harness verifies its own restore. **NEW FINDING, measured and kept:** 75 substitutes stamped at the closing minute play 0 clock minutes under Task 3.3's ruling (59 carry a stoppage stamp, 16 do not, so adding it back would not remove them — it would make `{90, +2}` in a 90-minute match compute -2); **20 players total 0 minutes despite an appearance**; no starter affected; filed with 2.15 as owner. Tasks 4.7 and 6.2b's premises were CORRECT at `74b1789` (verified in a worktree at that commit) and were overtaken by 1.17's `ae207ed`; the forks were written, then **retired** in favour of the shipped functions, with their tripwires inverted into positive assertions and the artifacts byte-identical either way. Task 7.8 widened the *walker* (`globs`, default unchanged) plus an artifact-scoped `PROFILE_ID_KEYS`, reporting `1296 profile(s), 29264 id reference(s), all pinned`. FR-1 closed with all nine branches verified programmatically. **ONE SUBTASK DELIBERATELY NOT DONE — Task 8.6:** 38 of 66 fixture nodes still go red under `==`, and since `passNetworkNodes` is null on 104/104 corpus bundles the invariant can only ever run against hand-authored fixtures; both ledger entries re-filed with a corrected precondition rather than closed falsely. Disclosed: `ae207ed` captured this story's two error classes (attribution only, content intact, recorded not repaired), and the new fixture bundle adds a fourth app route that was NOT verified because `app/` was occupied by two concurrent sessions. |

---
baseline_commit: NO_VCS
---

# Story 1.1: Contract v1 Schemas, Fixtures & Type-Generation Spike

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the builder,
I want the complete v1 artifact schema set in `/contract` with committed fixtures and a proven TypeScript codegen path,
So that both epics build against a single versioned contract from day one and Epic 2 is never blocked on the pipeline (FR-20, AD-2, AD-14).

## Acceptance Criteria

1. **Given** the monorepo seed (`contract/`, `pipeline/`, `data/`, `app/`, `spike/` per the Structural Seed)
   **When** the v1 schema set is authored
   **Then** every artifact shape has a JSON Schema in `/contract` — Match Bundle (all 7 domains, per-team `storyStats`, required `momentum` key typed series-or-`null`, knockout score shape: `scoreAfter90`/`scoreAfterET`/`shootoutScore`/`winnerTeamId`/`decidedBy`, and every Domain D event table incl. `PassNetworkNode`, `ReceivingEvent`, `DefensiveActionEvent`, `ShootoutAttempt`), `tournament.json`, `leaderboards.json`, team-profile, and player-profile.

2. **And** schemas use the draft-07-compatible subset of 2020-12 (no `prefixItems`/`unevaluatedProperties`/`dependentSchemas`), open vocabularies are closed enums, per-field numeric precision is fixed, and `/contract/version.json` declares `schemaVersion: 1`.

3. **Given** the codegen spike (AD-2)
   **When** `json-schema-to-typescript` 15.x runs against one representative schema
   **Then** the generated types round-trip the schema faithfully (or the tool is swapped via a logged decision), and a scripted step emits all types plus a generated `SCHEMA_VERSION` constant.

4. **Given** fixture authoring
   **When** `data/fixtures/` is committed
   **Then** it contains at least one full Match Bundle and one instance of every index artifact, all schema-validated, hand-checked, stamped `schemaVersion: 1`.

5. **And** fixtures cover the edge shapes: a group match, a knockout decided by extra time + shootout, a match with an own goal (`ownGoal: true`), and a bundle with `momentum: null`.

6. **And** all IDs follow AD-3 (lowercase ASCII kebab slugs, stage enum codes, `{surname}-{givenName}-{teamCode}` players).

7. *(Carried gate, from Story 1.4 AC 3)* **Given** the existing template-consistency verification mode
   **When** this story lands
   **Then** `python -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` still exits 0 with a clean gate, proving no regression.

## Tasks / Subtasks

- [x] **Task 1: Seed the contract workspace** (AC: 1, 2)
  - [x] Create `contract/` and `data/fixtures/` (do NOT create `app/`, `data/matches/`, `data/index/`, `pipeline/extract/`, `pipeline/markers/`, `pipeline/ingest/`, `pipeline/precompute/` — later stories own those)
  - [x] Write `contract/version.json` = `{"schemaVersion": 1}` (exactly one key; this file is the single global version declaration per AD-2)
  - [x] Verify Node is available: `node --version` must report **24.x**. If Node is absent, install Node 24 LTS before Task 6 — record the version actually used in the Dev Agent Record.
  - [x] Create `.gitignore` at repo root covering `venv/`, `__pycache__/`, `.pytest_cache/`, `node_modules/`, `work/`. (There is no git repo yet — do NOT run `git init`; it is not in scope. Committing the file now means the repo is ready the moment git lands.)

- [x] **Task 2: Derive closed vocabularies from the real corpus** (AC: 2) — *do this BEFORE authoring schemas*
  - [x] For each vocabulary listed in **Dev Notes → Vocabulary derivation worklist**, read the actual label text off the relevant pages of 2–3 real reports in `pmsr-corpus/` using the existing discovery machinery (`pipeline.discover.anchors.ANCHOR_REGISTRY` + `pipeline.discover.text.PageTextIndex` + `page.get_text()`)
  - [x] Use a throwaway script written to `work/` or the scratchpad — **do not commit it into `pipeline/`** (it is exploration, not pipeline code)
  - [x] Sample across venues/rounds (pick reports the 1.4 gate already sampled — see `work/verification/verification-report.json` `sample[]`) so a mid-tournament label variant would show up — *widened to all 104 reports; see Completion Notes*
  - [x] Record every derived enum with its evidence (report ID + verbatim source label) in `contract/README.md`
  - [x] Where a vocabulary cannot be closed with confidence, close it on what was observed and note it in `contract/README.md` as an AD-14 change-flow candidate — AD-8's assert-on-unknown at extraction time is the designed safety net, not an open enum

- [x] **Task 3: Author `contract/common.schema.json`** (AC: 1, 2, 6)
  - [x] ID types with `pattern` regexes: `TeamId`, `PlayerId`, `MatchId`, `TeamCode` (see Dev Notes → ID formats)
  - [x] Enums: `Stage`, `Group`, `Position`, `ShotOutcome`, `DecidedBy`, `ReceivingEventType`, `BlockLevel`, `DistributionType`, `CardType`, plus every vocabulary derived in Task 2
  - [x] Coordinate types: `PitchX`, `PitchY` (`number`, `minimum: 0`, `maximum: 100`, `x-decimals: 2`)
  - [x] Shared scalar types: `Minute`, `Percentage`, `Metres`, `Kilometres`, `KmPerHour`, `ExpectedGoals`, `Count`
  - [x] `KnockoutScore` (`scoreAfter90`, `scoreAfterET`, `shootoutScore`, `winnerTeamId`, `decidedBy`)
  - [x] Every `$def` carries an explicit `title` (controls generated TS type names — see Dev Notes → Codegen gotchas)

- [x] **Task 4: Author `contract/match-bundle.schema.json`** (AC: 1, 2)
  - [x] Root envelope: `schemaVersion`, `matchId`, Domain A block, `storyStats` per team, `momentum` (required, series-or-`null`), and each domain block
  - [x] Domain A: teams (home/away with explicit ordering), score + `KnockoutScore`, stage/group, venue, date, kickoff (ISO 8601 venue-local with UTC offset), formations, lineups (starters + substitutes: shirt number, position, goal/sub/card minutes)
  - [x] Domain B: full Key Statistics block per team (13 metrics — full list in Dev Notes) — *19 fields; see Completion Notes*
  - [x] Domain C: phases of play, line height / team length in/out of possession (metres), defensive block distribution high/mid/low
  - [x] Domain D event tables as first-class `$defs`: `ShotEvent`, `ShootoutAttempt`, `CrossEvent`, `PassNetworkNode`, `PassNetworkEdge`, `ReceivingEvent`, `DefensiveActionEvent` — **all seven**, each with `teamId` and its per-family acting-team semantics documented in `$comment`
  - [x] Domain E: per-goalkeeper involvement timeline, distribution, goal prevention (save %, intervention types), aerial control
  - [x] Domain F: per team — free kicks, penalties, corners (by side and style), throw-ins
  - [x] Domain G: per-player in-possession / out-of-possession / physical (speed zones 1–5, high-speed runs, sprints, top speed)
  - [x] `additionalProperties: false` on every object; `required` lists complete

- [x] **Task 5: Author the four index schemas** (AC: 1, 2)
  - [x] `contract/tournament.schema.json` — stages, groups with standings rows carrying explicit `rank`, results, and the entity lists that serve as the App's route manifest and search source
  - [x] `contract/leaderboards.schema.json` — boards keyed by closed `metricCode` enum, ordered rows with `rank`
  - [x] `contract/team-profile.schema.json` — tactical identity + formation usage + per-match breakdowns
  - [x] `contract/player-profile.schema.json` — aggregates + per-match series + physical profile + trends
  - [x] Each references `common.schema.json` by relative `$ref`

- [x] **Task 6: Codegen spike + scripted generation** (AC: 3)
  - [x] `contract/package.json` (private, `"type": "module"`) pinning `json-schema-to-typescript@15.0.4`; `npm install`; commit `contract/package-lock.json`
  - [x] `contract/scripts/generate-types.mjs` — compiles every `*.schema.json`, writes `contract/generated/contract-types.d.ts` and `contract/generated/schema-version.ts` (`export const SCHEMA_VERSION = 1;` read from `version.json`, never hand-typed)
  - [x] `npm run generate:types` script wired in `contract/package.json`
  - [x] Run it; commit the generated output as the spike evidence
  - [x] **Prove round-trip fidelity** on one representative schema (use `match-bundle.schema.json` — it is the one that exercises nested `$defs`, cross-file `$ref`, enums, and nullable unions): assert generated types contain the expected enum unions, `| null` on nullable fields, no `[k: string]: unknown` index signatures, and no `Foo1`/`Foo2` collision-suffixed names
  - [x] If fidelity fails, swap to `json-schema-to-ts` or `quicktype` and record the swap as a logged decision in `contract/README.md` (AD-2 explicitly permits this) — *no swap needed; two schema-side fixes instead, both now test-guarded*

- [x] **Task 7: Author fixtures** (AC: 4, 5, 6)
  - [x] `data/fixtures/matches/` — three bundles (see Dev Notes → Fixture plan): group match with a momentum series; knockout ET+shootout with an own goal; group match with `momentum: null`
  - [x] `data/fixtures/index/tournament.json`, `leaderboards.json`, `team-profiles/{one}.json`, `player-profiles/{one}.json`
  - [x] Every fixture stamped `schemaVersion: 1` and canonically serialized (sorted keys, `indent=2`, UTF-8, LF — reuse the `_write` recipe from `pipeline/validate/runner.py`)
  - [x] Seed metadata/lineups/score from real reports in `pmsr-corpus/` so values are plausible and hand-checkable — *also Domains B, C, F, shots and physical data; see Completion Notes*
  - [x] `data/fixtures/README.md` documenting provenance, the deliberate partiality of the fixture world, and the AD-14 change-flow rule

- [x] **Task 8: Python-side schema validation + tests** (AC: 2, 4)
  - [x] Add `jsonschema[format]==4.26.0` and `referencing==0.37.0` to `pipeline/requirements.txt`; install into `pipeline/venv`
  - [x] `pipeline/validate/errors.py` — `SchemaValidationError(PipelineError)` following the `pipeline/discover/errors.py` pattern
  - [x] `pipeline/validate/schema.py` — loads `/contract` into a `referencing.Registry`, exposes `validate_artifact(instance, schema_name)`
  - [x] `pipeline/tests/test_contract_schemas.py` — every schema passes `Draft202012Validator.check_schema`; no banned keyword (`prefixItems`, `unevaluatedProperties`, `unevaluatedItems`, `dependentSchemas`, `dependentRequired`, `$dynamicRef`) appears anywhere; every object has `additionalProperties: false`; every `$def` has a `title`; `version.json` says `1`
  - [x] `pipeline/tests/test_fixtures.py` — every fixture validates against its schema; every fixture carries `schemaVersion == 1`; every ID matches its AD-3 pattern; edge-shape coverage asserted explicitly (a bundle with `momentum: null`, one with `decidedBy: "shootout"`, one with a shot carrying `ownGoal: true`); fixtures round-trip byte-identically through the canonical serializer
  - [x] `pipeline/tests/test_generated_types.py` *(or an assertion inside `test_contract_schemas.py`)* — `contract/generated/schema-version.ts` agrees with `version.json` — *four assertions inside `test_contract_schemas.py`*

- [x] **Task 9: `contract/README.md`** (AC: 2, 3)
  - [x] Per-field numeric precision table (the record of "precision is fixed")
  - [x] Per-family `teamId` acting-team semantics table
  - [x] Enum provenance table from Task 2 (value ← verbatim source label ← report ID)
  - [x] The AD-14 change-flow procedure: Epic 2 requests → Epic 1 implements → logged decision → `schemaVersion` bump → fixtures regenerated + types regenerated **in the same commit**
  - [x] Every logged decision this story makes (match-ID padding, precision mechanism, momentum provisional shape, any tool swap)

- [x] **Task 10: Re-run the 1.4 verification gate** (AC: 7)
  - [x] `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` → exit 0, gate `pass`
  - [x] Paste the verbatim console output into the Dev Agent Record

### Review Findings

Code review 2026-07-22 — three parallel layers (adversarial, edge-case, acceptance) plus verification of every claim against the code. 6 of 7 ACs verified satisfied; AC 3 partially violated (see the first patch item). AC 7's carried gate re-ran clean at exit 0.

**Decisions resolved** (Juan, 2026-07-22 — each is now a patch):

- [x] [Review][Patch] **Resolved: make all 8 nullable now**, before Epic 2 builds against the shape — it is still `schemaVersion` 1, so this is the cheapest moment it will ever be. Make `shots`, `crosses`, `passNetworkNodes`, `passNetworkEdges`, `receiving`, `defensiveActions`, `goalkeeping` and `players` `anyOf: [..., {"type": "null"}]`, regenerate fixtures and types in the same commit per AD-14, and add a test asserting the `null`/`[]` distinction is expressible on every optional section. `null` vs `[]` is promised corpus-wide but unimplemented for 8 of 9 optional sections — `match-bundle.schema.json:749` states "an empty array means zero events of that kind; null means the report does not carry that data at all", and `contract/README.md:183-184` repeats it as a corpus-wide rule ("Do not collapse them"). Only `shootoutAttempts` and `momentum` are actually nullable. `shots`, `crosses`, `passNetworkNodes`, `passNetworkEdges`, `receiving`, `defensiveActions`, `goalkeeping` and `players` are plain non-nullable arrays, so a match with a missing Defensive Actions page is indistinguishable from one with zero events — the exact case the "Empty states" checklist row requires the App to render differently. Options: (a) make all 8 nullable now, before Epic 2 builds against the shape — costs a fixture + type regeneration; (b) route through the AD-14 change flow after Story 2.3 sign-off; (c) narrow the documented promise to the two fields that honour it.
- [x] [Review][Patch] **Resolved: reconcile everything.** Regenerate the synthetic blocks so every cross-artifact number adds up, and add tests pinning the invariants (Domain G sums vs Domain B totals, node `involvement` ≥ incident edge volume, profile aggregates vs per-match rows, `furthestStage` vs `played` vs `len(matches)`, `matchesPlayed` agreement across artifacts). Story 2.3 signs off on these fixtures and Epic 2 builds roughly ten stories against them; a developer who spots an 8× discrepancy loses a day deciding whether it is their bug. Where a true weighted mean is not derivable — Mexico appears in only one of the three bundles — synthesize a consistent value and say so in `data/fixtures/README.md`. Five aggregates disagree across artifacts that Epic 2 renders side by side: Domain G per-player values are unreconciled with Domain B team totals by up to 8× in every fixture (m001 South Africa `shots: 3` vs player sum `attemptsAtGoal: 37`; `passes: 351` vs `837`); ~45% of pass-network nodes carry an `involvement` smaller than the sum of their own incident edge volumes, which is arithmetically impossible and inverts DESIGN.md's node-size/edge-weight encoding (`mbokazi-mbekezeli-rsa` involvement 12 vs incident volume 79); `team-profiles/mexico.json:85-122` `tacticalIdentity` is a byte-identical copy of m001's home block despite `team-profile.schema.json:96` declaring every value a match-count-weighted mean over three matches; `mexico.json:75` claims `furthestStage: "r16"` with `played: 3` and three group matches; and every one of the 32 `leaderboards.json` rows says `matchesPlayed: 1` while `tournament.json` and the profile both say 3. A true weighted mean is not derivable — Mexico appears in only one of the three bundles. Options: (a) regenerate the synthetic blocks so every cross-artifact number reconciles; (b) fix only what is derivable and document the rest as deliberately unreconciled in `data/fixtures/README.md`; (c) accept as-is and note that Epic 2 must not cross-check fixture numbers.
- [x] [Review][Patch] **Resolved: keep both representations, add tests pinning each enum's values to the corresponding object's property names.** Preserves the fixed-shape objects the App wants, removes the drift risk, keeps Task 2's corpus harvest and the provenance table truthful, and is the smallest change of the three options. Note in `contract/README.md` that for these vocabularies the AD-2 compile-error mechanism is provided by the test rather than by the type system. 14 closed vocabularies are declared, documented with corpus provenance, and generated into TypeScript — but referenced by zero fields — `InPossessionPhase`, `OutOfPossessionPhase`, `BlockLevel`, `DistributionType`, `FeetDistributionTechnique`, `HandsDistributionTechnique`, `ThrowDistributionTechnique`, `InterventionType`, `InterventionBodyType`, `AerialInterventionType`, `FreeKickType`, `CornerDeliveryType`, `CornerDeliveryStyle`, `PitchSide` (all `contract/common.schema.json`), plus dead `PhaseShare` at `team-profile.schema.json:83`. Each is duplicated as a fixed camelCase key set elsewhere (`CornerDeliveryStyle` ↔ `cornersByDeliveryStyle`'s four keys, `InterventionType` ↔ `byInterventionType`'s five) with nothing holding the two copies in sync. For these 14, AD-2's headline mechanism does not hold: a new source label produces silent data loss at extraction, not a TypeScript compile error, and the 20-row provenance table at `README.md:112-131` documents vocabularies the artifacts do not use. Options: (a) `$ref` them via `propertyNames`; (b) restructure those blocks as enum-keyed maps; (c) delete the unused enums and the provenance rows; (d) keep both and add a test pinning enum values to object keys.
- [x] [Review][Patch] **Resolved: apply sensible defaults, each recorded as a logged decision in `contract/README.md` for veto** — `tackles` → `tacklesWon` (the standard football leaderboard metric), unify on `lineBreaksCompleted`, and split `distanceCovered` into distinct team and player codes so no code carries two units. Add a test asserting every `MetricCode` value names a real field. `MetricCode` breaks the "string-identical to the artifact field" rule it states — `common.schema.json:309` and `README.md:144` both promise a board's code names the field it ranks. Verified sweep over every `properties` key in `/contract`: `tackles` matches nothing (Domain G has `tacklesMade` and `tacklesWon`). Also `completedLineBreaks` (team) and `lineBreaksCompleted` (player) name one concept two ways, and `distanceCovered` is `Kilometres` at team scope but the player equivalent is `totalDistance` in `Metres` — so one metric code would carry two units, which breaks AD-7's "units live in the locale layer keyed by metric code". Needs a product call on which field each code names.
- [x] [Review][Patch] **Resolved: keep the PDF ignored and amend AR-16.** The copyright reasoning holds and the repo may go public, so no copyrighted report enters git history. Anchor the pattern to `pmsr-corpus/*.pdf` so it stops silently swallowing unrelated PDFs, and make the missing-fixture path loud rather than a silent `pytest.skip` — a fixture that is absent must never read as a pass in CI. AR-16's "permanent ground-truth fixture" wording needs correcting to match. `.gitignore`'s unanchored `*.pdf` excludes `spike/mex_rsa.pdf`, the "permanent ground-truth fixture (AR-16)" — confirmed via `git check-ignore`: `.gitignore:15` ignores it. The file is 5.6 MB on disk so the suite passes locally, but on a fresh clone `conftest.py:26` hits its `pytest.skip` and every ground-truth test silently vanishes. The exclusion may be deliberate (the adjacent comment cites copyright and non-redistribution), in which case AR-16's "permanent fixture" wording is what needs correcting. Either the PDF is committed or AR-16 is amended — it cannot be both.

**Patches**:

- [x] [Review][Patch] Committed generated types are stale — not reproducible from the current schemas (AC 3; Task 6's "commit the generated output" box is falsely checked) [contract/generated/contract-types.d.ts:101,242,477,857]
- [x] [Review][Patch] Fix the stale "the eight/nine shares sum to approximately 100%" prose that logged decision #5 retracts — apply BEFORE regenerating types, or the regeneration propagates it [contract/common.schema.json:190,205]
- [x] [Review][Patch] `_in_name_map` is inverted: it skips every real subschema, so four "structural, not sampled" tests inspect 6 of 86 object schemas (measured). The `$ref`-sibling test — the specific guard against the `Metres1`–`Metres5` regression that already happened once — watches 43 of 437 nodes. With a corrected predicate the schemas are still fully clean, so no live defect is hidden; the safety net is simply off. `_NON_SCHEMA_CONTAINERS:44` is the dead fossil of the intended check [pipeline/tests/test_contract_schemas.py:55-61]
- [x] [Review][Patch] Nothing can detect generated-output drift — add a `--check` mode and wire it; `README.md:298-300` claims the tests already cover this and they do not [contract/scripts/generate-types.mjs]
- [x] [Review][Patch] m002 stores stoppage-time shots as raw minutes 92/93 in a regulation match, violating logged decision #7; `stoppageMinute` is `null` in all 775 minute stamps across the three bundles, so the integer branch the App's "90+2" label and marker ordering depend on is unexercised [data/fixtures/matches/m002-korea-republic-czechia.json /events/shots/19-21]
- [x] [Review][Patch] `physical.totalDistance` is 26496.6 but the per-match rows sum to 27590.0, against a schema that declares it the sum over matches played [data/fixtures/index/player-profiles/quinones-julian-mex.json:109]
- [x] [Review][Patch] m002's three possession shares sum to 100.1 (55.8 + 10.1 + 34.2), breaking the invariant `match-bundle.schema.json:392` and `README.md:281` both state as fact; m001 and m074 sum to exactly 100.0 so a spot check misses it [data/fixtures/matches/m002-korea-republic-czechia.json keyStatistics]
- [x] [Review][Patch] m074's shoot-out encodes an impossible final state — 8 kicks, Germany 3/4 and Paraguay 4/4, but Germany still had a fifth kick and could equalise; a ninth (missed) German kick is needed to make 3-4 terminal [data/fixtures/matches/m074-germany-paraguay.json events.shootoutAttempts]
- [x] [Review][Patch] The AD-3 ID test executes zero assertions on `leaderboards.json` — all seven key lookups return empty. 85 `EntityRef.id` values across the index fixtures (64 of them in leaderboards, 20 player slugs) are checked only against the loose team pattern, so `son-heungmin` without its team code validates and the App's player route resolves to nothing [pipeline/tests/test_fixtures.py:97-106]
- [x] [Review][Patch] `test_every_leaderboard_is_ranked_in_order_and_uses_a_closed_metric_code` never inspects `metricCode`, and its `rank == 1..n` assertion forbids the tied ranks `leaderboards.schema.json:25` mandates ("ties are represented honestly rather than implied by array order") — the topSpeed board already has four rows at 33.3 ranked 1,2,3,4. `higherIsBetter: false` appears in no fixture, so that sort branch is dead [pipeline/tests/test_fixtures.py:416-427]
- [x] [Review][Patch] `iter_violations` discards `anyOf` sub-errors and dumps the whole subtree — a bad `momentum.samples[0].minute` yields one 890-character message with no pointer to the field and no mention of the constraint, contradicting the module's own "one pass tells the whole story" docstring. `error.context` is never read. Affects every nullable field [pipeline/validate/schema.py:112-114]
- [x] [Review][Patch] The `ShotOutcome` ↔ `ShotOutcomeDetail` mapping exists only in prose, and the mapping implied by prefix is wrong — `incomplete-blocked` maps to `blocked` while every other `incomplete-*` maps to `incomplete`. `{"outcome": "goal", "outcomeDetail": "off-target"}` validates clean at every layer [contract/common.schema.json:92-126]
- [x] [Review][Patch] No cross-field guards anywhere: `matchId` is unconstrained against `matchNumber`, the team ids and its own filename (the entity test compares `p.stem`, never content); `stage: "final"` with `matchdayRound: "group-md1"` validates; `decidedBy: "regulation"` with a populated `shootoutScore` validates; `contestType` is documented as "present only when actionType is possession-contest" but nothing enforces it. `if`/`then` is in the permitted subset [contract/match-bundle.schema.json, pipeline/tests/test_fixtures.py]
- [x] [Review][Patch] `Formation`'s pattern caps at four segments, so a standard `4-1-2-1-2` diamond fails validation and aborts the entire bundle; it is also copy-pasted into three files instead of `$ref`'d, and only one copy carries the description and provenance [contract/match-bundle.schema.json:89, contract/team-profile.schema.json:212,261]
- [x] [Review][Patch] No team-level `cornersBySide`, so rendering "corners from the left" requires the browser to add three numbers — AD-5 forbids the App summing. `PitchSide` exists and is referenced nowhere [contract/match-bundle.schema.json:1072-1094]
- [x] [Review][Patch] `test_requirements_pin_every_dependency_exactly` is blind to every non-`==` line — `requests>=2.0` never enters the pin set and the suite stays green, despite AR-15 being the whole point of the test [pipeline/tests/test_workspace.py:23-49]
- [x] [Review][Patch] `rfc3339-validator` is unpinned, and `jsonschema` registers the `date-time` checker inside a suppressed `ImportError` — without it `kickoff: "not a time"` validates clean, the exact failure `schema.py:10-13` says must not happen. Pinning it is currently blocked by the sibling test asserting exactly five names [pipeline/requirements.txt:10]
- [x] [Review][Patch] `NaN`/`Infinity` pass validation, canonical round-trip and the budget test, then break the browser's `JSON.parse` — Python's `json` accepts and re-emits them byte-identically, and `jsonschema` accepts `float('nan')` against `{"type":"number","minimum":0,"maximum":100}` [pipeline/tests/test_fixtures.py:110-122]
- [x] [Review][Patch] Budget test measures 500 KiB against a limit documented as 500 KB — a 505,000-byte artifact passes a gate documented to reject it, and Story 1.16 hardens this into the enforcing gate [pipeline/tests/test_fixtures.py:134]
- [x] [Review][Patch] The collision-suffix guard rejects any type name ending in a digit — the contract already has `distanceZone1`–`distanceZone5` fields, so promoting one to a titled `$def` makes the generator refuse correct output and blame a collision that does not exist. The same regex is duplicated in the test [contract/scripts/generate-types.mjs:160, pipeline/tests/test_contract_schemas.py:193]
- [x] [Review][Patch] `stripCrossReferenceStanza` silently deletes real documentation — any description beginning "This interface was referenced by…" or "via the `x` \"…" loses its whole JSDoc block, and the husk-removal erases the trace [contract/scripts/generate-types.mjs:77-106]
- [x] [Review][Patch] `{"schemaVersion": 1.0}` splits the two readers of the single version source: Node's `Number.isInteger` accepts it and writes `SCHEMA_VERSION = 1`, Python's `isinstance(1.0, int)` rejects it with a bare `TypeError` instead of the documented "exactly one key" message [contract/scripts/generate-types.mjs:190, pipeline/validate/schema.py:67]
- [x] [Review][Patch] The Python ID gate is strictly weaker than the ECMA-262 dialect JSON Schema mandates — Python's `$` matches before a trailing newline, so `"mexico\n"` passes both the schema and the test regex while Node rejects it, and the value becomes a URL slug containing a newline [pipeline/tests/test_fixtures.py:27-29, contract/common.schema.json:14,28,35,503]
- [x] [Review][Patch] `GoalPrevention` is the only major `$def` in the file with no `description` and no `$comment`, and its two breakdown panels have different undocumented denominators — `byInterventionType` sums to `attemptsFaced`, `byBodyType` to `totalInterventions`, verified across all six fixture goalkeepers. Rendered side by side they show two totals that disagree with no explanation [contract/match-bundle.schema.json:895-943]
- [x] [Review][Patch] `FreeKickCounts` nests `direct = directOnTarget + directOffTarget` (holds in all six team-innings) but carries no `description`, unlike every sibling counts structure in the file which documents "the parts sum to the total" — a stacked chart over the four fields double-counts [contract/match-bundle.schema.json]
- [x] [Review][Patch] `data/fixtures/README.md:71` calls the own goal "the one deliberate departure from the source", but m074's eight shoot-out attempt rows are a second fabricated departure — `match-bundle.schema.json:769` says the corpus carries no attempt table and real data emits `null` — and the README's synthetic list never mentions them [data/fixtures/README.md:55-71]
- [x] [Review][Patch] `unreachableDefinitions: true` ships `export interface Common {}` — an empty interface TypeScript treats as assignable from almost anything — plus dead `PhaseShare`, both as part of Epic 2's public contract surface [contract/generated/contract-types.d.ts:125,918]
- [x] [Review][Patch] Test helpers raise opaque errors on valid input: `next(...)` without a default gives an uncaught `StopIteration` when a bundle has two own-goal records but one matching shot event, and `SCHEMA_FOR_INDEX[path.name]` raises `KeyError` for any new artifact under `index/` instead of a diagnosable message. `test_every_spatial_event_sits_inside_the_pitch_frame:316` has the mirror gap — it hard-codes five table names, so a sixth spatial table is silently unchecked [pipeline/tests/test_fixtures.py:44-51,225-227,316]
- [x] [Review][Patch] Task 9's box is checked but `contract/README.md` has no per-metric aggregation-semantics table; the semantics live per-row in `AggregateMetric.aggregation` instead. The mechanism is arguably better than the one FR-27 asked for — document that as a logged decision rather than leaving the gap silent [contract/README.md]
- [x] [Review][Patch] `!pmsr-corpus/manifest.csv` is a no-op — no preceding pattern ignores it, so the re-inclusion and its comment misdescribe what the file does [.gitignore:18-19]
- [x] [Review][Patch] Five polymorphic metric-value slots carried no `x-decimals`, so AC 2's "per-field numeric precision is fixed" did not hold for any leaderboard, aggregate or trend value and Story 1.16's serializer had no rounding rule for them. Each now declares its precision, with the metric-dependent caveat stated, and `test_every_numeric_leaf_declares_its_precision` walks every numeric schema so the next one cannot be missed [contract/leaderboards.schema.json:34,39, contract/player-profile.schema.json:80,85,179]

**Resolution — all 35 patches applied 2026-07-22.** Verification after the change set:

- Story 1.1's own suite: **202 passed, 1 skipped** (the skip is `spike/mex_rsa.pdf`, deliberately not committed — see the resolved `.gitignore` decision; under `CI` it fails instead of skipping). Up from 126 tests to 202.
- AC 7 carried gate re-run: `python -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` → **exit 0, GATE RESULT: PASS**, 0 deviations across 16 sampled reports.
- `npm run check:types` → up to date, 237 declarations from 6 schemas (was 231; the new nullable-array and `TeamCornerSideCounts` `$defs` account for the rise).
- Structural guards re-measured under the corrected predicate: **86 of 86** object schemas and **437 of 437** `$ref` nodes now inspected, against 6 and 43 before. The schemas were already clean under the corrected check, so the inverted predicate was hiding no live defect — only the guard itself.

Two deviations from the decisions as stated, both deliberate:

1. **`completedLineBreaks` / `lineBreaksCompleted` were NOT unified.** The agreed fix was to unify on one spelling, but both are real fields at different scopes — `completedLineBreaks` in `TeamKeyStatistics` (Domain B) and `lineBreaksCompleted` in `PlayerInPossession` (Domain G). Renaming either would have *broken* the string-identical rule it was meant to restore. The rule is instead stated as scoped, and `distanceCovered`/`totalDistance` is handled the same way. Logged as decision 10.
2. **Cross-field invariants are enforced in pytest, not with schema `if`/`then`.** `if`/`then` is inside AD-2's permitted subset, so it was tried first — and the generator's own fidelity guard rejected it: `json-schema-to-typescript` compiles an `if`/`then` branch to an open object and reintroduces the `[k: string]: unknown` index signature the AD-2 spike exists to prevent, and the `then` cannot be closed without rejecting the object's sibling properties. Logged as decision 12.

Not part of this story, but observed while verifying: the working tree also carries Story 1.2's in-flight work (`pipeline/ingest/`, four `test_ingest_*.py` files, uncommitted edits to `conftest.py` and `test_workspace.py`). Two of its tests fail — `test_a_team_name_with_no_usable_characters_is_a_failure_not_an_empty_slug` reproduces with only Story 1.2's own files loaded, and `test_code_version_is_stable_across_calls` passes in isolation and fails only in a full-suite run, i.e. a test-ordering interaction. Neither is caused by this change set; both were left alone.

**Deferred**:

- [x] [Review][Defer] `tournament.schema.json` has no `stages` collection although Task 5's subtask names it [contract/tournament.schema.json:27-38] — deferred, stage is carried per-match via the `Stage` enum and every per-surface checklist row is met; raise at Story 2.3 sign-off when the Hub's real needs are known
- [x] [Review][Defer] A zero-appearance squad member is schema-valid but fails `assert fixture["matches"]` [pipeline/tests/test_fixtures.py:436] — deferred, no such fixture exists and none is required until real profiles land in Story 1.18
- [x] [Review][Defer] No fixture exercises `decidedBy: "extra-time"` — the ET-decided branch (non-null `scoreAfterET`, null `shootoutScore`) is untested [data/fixtures/matches/] — deferred, AC 5 requires only ET+shootout, which m074 covers; a fourth bundle is Story 1.18's cost to bear

**Dismissed as noise** (recorded so a future review does not re-raise them):

- `FreeKickCounts` sub-counts "overlap their own total, 18 against `totalFreeKicks: 12`" — there is no `totalFreeKicks` field; the arithmetic claim is false. Verified `direct == directOnTarget + directOffTarget` in all six team-innings. Only the missing `description` survives, as a patch above.
- "Two tests hard-require fixture data production can never emit, and will fail when fixtures are replaced by real pipeline output" — `data/fixtures/` is a permanent world distinct from `data/matches/` and is never replaced. AC 5 mandates exactly those two assertions.

## Dev Notes

### Sequencing reality — read this first

- This is the **second** story to be implemented, not the first. Story **1.4** (template-consistency verification) ran first as a de-risking gate and is `done`. Everything it built is live and must not be broken.
- This story is **AD-14's contract bootstrap**: it is the gate that unblocks **all of Epic 2**. Story 2.1 cannot start until `/contract` + `data/fixtures/` exist. Getting a field wrong here costs a `schemaVersion` bump and a fixture regeneration later, so completeness matters more than speed.
- This story writes **no extractors and parses no PDFs into artifacts**. It reads the corpus only to *derive vocabularies and seed plausible fixture values* (Tasks 2 and 7). Extraction is Stories 1.2–1.14.
- Story **2.3** is the formal sign-off gate on this work: it walks a per-surface data-needs checklist against these schemas. Every gap it finds becomes a contract-change request. **Dev Notes → Per-surface data-needs checklist** below is that checklist, pre-computed — satisfy it now and 2.3 passes clean.

### Architecture guardrails (binding)

- **AD-1 (two-system boundary):** `/data` + `/contract` are the *only* interface. Nothing in `contract/` may import from `pipeline/`, and nothing presentational (labels, colours, locale strings, units-as-text) may appear in a schema. Units live in the App's locale layer keyed by metric code (AD-7).
- **AD-2 (contract mechanics):** schemas are the single definition. The App consumes **generated** types, never hand-written mirrors. `schemaVersion` is one global integer declared exactly once, in `/contract/version.json`. Open vocabularies are **closed schema enums** — so a value the pipeline later encounters that isn't in the enum is a *shape change*, which surfaces as a compile error in the App. That is the intended mechanism, not a bug.
- **AD-3 (one identity):** entity ID = URL slug. Lowercase ASCII kebab, accent-stripped. An ID once emitted never changes.
- **AD-4 (artifact set):** exactly these artifacts, no others. `momentum` is a **required** key whose value is the series or JSON `null` — never omitted, never `[]`. Standings carry an explicit pipeline-computed `rank`. Budget breaches are resolved by splitting artifacts or a logged decision, **never by dropping fields**.
- **AD-5 (aggregation only in precompute):** anything cross-match, and every distribution/percentage/total, is a field in the artifact. The App never sums or averages. If a surface needs a number, the schema must have a slot for it.
- **AD-6 (pitch frame):** 0–100 floats over the **full** pitch rectangle, oriented to the acting team's attack direction (x=100 at opponent's goal line, y=0 attacker's left). Every spatial event carries an explicit `teamId`. Per-family acting-team semantics are **pinned in the schema** (table below).
- **AD-7 (raw and locale-neutral):** unformatted numerics, ISO 8601 dates, enum codes. No display strings, no formatted numbers, no `es`/`en` anywhere in an artifact.
- **AD-8 (determinism):** canonical serialization — sorted keys, per-field fixed precision, UTF-8, LF. Fixtures must be byte-stable.
- **AD-13 / AR-15 (stack pins):** Node 24 LTS; `json-schema-to-typescript` 15.x. Python side: pip against pinned `pipeline/requirements.txt` — **never `uv`**.
- **Conventions:** JSON keys in `/contract` and `/data` are `camelCase`. Python stays `snake_case` internally and maps only at the emit boundary. `work/` internals stay `snake_case` (AD-9) — `pipeline/validate/deviations.py` already does this.

### What already exists (reuse, do not rediscover)

From Story 1.4 — all live, all green, all yours to build on:

| Module | What it gives you |
| --- | --- |
| `pipeline/errors.py` | `PipelineError` — base class for every typed pipeline exception |
| `pipeline/discover/errors.py` | The typed-exception pattern to copy: subclass, take structured args, set attributes, format a localizing message |
| `pipeline/discover/text.py` | `normalize()`, `page_text()`, `PageTextIndex` (pre-indexes every page once — **use this** for Task 2; naive per-anchor scans are ~18× slower) |
| `pipeline/discover/anchors.py` | `ANCHOR_REGISTRY` (30 specs → 47 resolved anchors) + `resolve_anchors(specs, home, away)`. This is your map of which page holds which domain — Task 2 depends on it |
| `pipeline/discover/probe.py` | `probe_report(path) -> ReportMeta` and `probe_corpus(dir)`. `ReportMeta` already carries `home_team`, `away_team`, `home_score`, `away_score`, `stage_text`, `group`, `match_date`, `kickoff`, `venue`, `matchday_round`, `shootout` — **this is your fixture Domain A seed, for free** |
| `pipeline/discover/rounds.py` | `KNOCKOUT_ROUNDS = ("r32","r16","qf","sf","third-place","final")` — already exactly AD-3's knockout stage codes |
| `pipeline/validate/runner.py` | `_write()` — the canonical serializer: `json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True) + "\n"`, written with `encoding="utf-8", newline=""`. **Reuse this recipe verbatim for fixtures.** The `newline=""` is what stops Windows CRLF translation from breaking byte-identical re-runs |
| `pipeline/validate/deviations.py` | `DeviationCategory` / `Deviation`. **Do not add a category in this story** — the four categories are baked into the manifest's `deviation_counts_by_category` keys and 1.4's gate output. Schema-validation deviations belong to Story 1.16 |
| `pipeline/tests/conftest.py` | `repo_root`, `mex_rsa_pdf`, `spike_corpus` session fixtures + the `sys.path` insert that makes `python -m pytest pipeline/tests` work from repo root |

**Corpus facts already established by 1.4's real gate run** (`work/verification/verification-report.json`): 104 reports, 16 venues, 9 matchday rounds, zero deviations, gate `pass`. Filenames are `PMSR-M{NN}-{HOME3}-V-{AWAY3}.pdf` — **the 3-letter team codes you need for `PlayerId` are right there in the filenames**. Four of the 104 reports carry a shoot-out cover line of the form `"(Paraguay win 3-4 on Penalties)"` — that is your real evidence for the knockout score shape, and `ReportMeta.shootout` already captures it.

**`spike/` is frozen — read it, never modify it.** `spike/extract.py` holds the exact-RGB → outcome map that pins the five-value `ShotOutcome` enum:

```python
(0.00, 0.50, 0.00): "goal"
(0.36, 0.61, 0.84): "on_target"
(0.96, 0.74, 0.00): "off_target"
(0.70, 0.53, 1.00): "blocked"
(0.18, 0.30, 1.00): "incomplete"
```

In the contract these become kebab enum codes: `goal | on-target | off-target | blocked | incomplete` (AD-6/AD-7).

### ID formats (AD-3) — exact patterns

| Type | Format | Example | `pattern` |
| --- | --- | --- | --- |
| `TeamId` | lowercase ASCII kebab, accent-stripped | `mexico`, `south-africa` | `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `TeamCode` | 3-letter lowercase (from PMSR filenames) | `mex`, `rsa` | `^[a-z]{3}$` |
| `MatchId` | `m{NNN}-{homeTeamId}-{awayTeamId}` | `m073-mexico-argentina` | `^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$` |
| `PlayerId` | `{surname}-{givenName}-{teamCode}`, name order as listed in the source lineup | `ramirez-julian-mex` | `^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$` |

> **Logged decision required — match-ID zero padding.** AD-3 and the epics both write the illustrative example as `m73-mexico-argentina` (unpadded). Use **three-digit zero padding** (`m073`) instead, and record it in `contract/README.md`. Rationale: AD-3 requires precompute to consume Extraction Records in *"canonical order (ascending match ID)"* and AD-8 requires byte-identical determinism. With unpadded IDs, lexicographic order over 104 matches is `m1, m10, m100, m11, …` — wrong, and it also mis-sorts `data/matches/` directory listings. Padding makes string order equal numeric order by construction, so no code path can get canonical order wrong. Because an ID once emitted never changes, this must be settled now, before anything is emitted. Flag it to Juan if you disagree — but do not ship unpadded.

### Numeric precision — how to express "precision is fixed" (AC 2)

**Do not use `multipleOf`.** JSON Schema's `multipleOf` is the obvious reach for decimal precision and it is a trap: validators implement it as float modulo, and binary floating point makes `0.07 % 0.01 != 0` for many legitimate values. You would get false validation failures on correct data.

Instead:

1. Annotate each numeric `$def` with a custom keyword **`x-decimals`** (an integer). Unknown keywords are legal in JSON Schema, ignored by validators, and ignored by the codegen tool — but they are greppable and machine-readable.
2. Record the same values in the precision table in `contract/README.md`. That table is the record of "precision is fixed".
3. The pipeline's canonical serializer (Story 1.16) rounds to `x-decimals` at emit; this story only needs the declarations and the table.

Suggested defaults — adjust to what the corpus actually prints, and record what you chose:

| Kind | `x-decimals` |
| --- | --- |
| Pitch coordinates (`PitchX`, `PitchY`) | 2 |
| xG | 2 |
| Percentages (possession, completion %, block share, phases) | 1 |
| Metres (line height, team length) | 1 |
| Kilometres (distance covered) | 2 |
| km/h (top speed) | 1 |
| Counts, minutes, shirt numbers | 0 (integers — use `"type": "integer"`) |

### Domain field inventory — author from this list, do not re-derive it

Sourced from PRD addendum §6 (verbatim inventory) and the epics' per-story acceptance criteria.

**Domain A — metadata, lineups, formations.** Teams (home/away, explicitly ordered — DESIGN.md's team-accent rule is *"home/first-listed team is A"*, so the ordering must be encoded, not inferred), score, `KnockoutScore`, stage (enum) + group (enum letter), venue, date, kickoff (ISO 8601 venue-local **with UTC offset**), formation per team (raw locale-neutral string, e.g. `"4-3-3"`), lineups: starters + substitutes each with shirt number, position (`gk|df|mf|fw`), and goal / substitution / card minutes. Goals need `ownGoal` and a scorer reference; own goals attribute to the **benefiting** team in the scorer list but are excluded from shot-map rendering (AD-6).

**Domain B — Key Statistics, per team.** possession, xG, shots, shots on target, passes, pass completion %, line breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered.

**Domain C — tactical identity, per team.** Phases of Play (in/out of possession %), line height (in/out of possession, metres), team length (in/out of possession, metres), defensive block distribution (`high`/`mid`/`low` shares — they sum to ~100%, so store all three, do not derive the third).

**Domain D — spatial events.** All seven tables, all with `teamId` and 0–100 coordinates:
- `ShotEvent` — `x`, `y`, `minute`, `playerId`, `bodyPart`, `xG`, `outcome` (5-value enum), `ownGoal` (boolean), `teamId`
- `ShootoutAttempt` — separate table; shootout attempts must **never** land in `ShotEvent` (they would break marker-count Self-Validation, and Story 2.7 never plots them)
- `CrossEvent` — `x`, `y`, `minute`, `playerId`, `teamId`, plus corpus-derived type/outcome enums
- `PassNetworkNode` — `playerId`, `x`, `y` (**extracted from the page, never derived from edges** — Story 1.14), `teamId`, and an involvement value (node size encodes pass involvement per DESIGN.md — a derived aggregate, so it must be a field)
- `PassNetworkEdge` — two player endpoints, positive-integer `volume`, `teamId`
- `ReceivingEvent` — `type: offer | movement`, `x`, `y`, `minute`, `playerId`, `teamId`
- `DefensiveActionEvent` — `x`, `y`, `minute`, `playerId`, `teamId`, plus a corpus-derived action-type enum

**Domain E — goalkeeping, per goalkeeper.** Involvement timeline, distribution (`feet|hands|throw`), goal prevention (save %, intervention types — corpus-derived enum), aerial control. Category counts must be internally consistent (they sum to total distributions), so store the categories *and* the total.

**Domain F — set plays, per team.** Free kicks, penalties, corners by side and by style (corpus-derived enums; side counts sum to total corners), throw-ins.

**Domain G — per player.** *In possession:* passes, pass %, switches, line breaks, ball progressions, take-ons, step-ins, attempts, goals. *Out of possession:* tackles, blocks, interceptions, pressing, duels, clearances, recoveries. *Physical:* distance by speed zones 1–5, high-speed runs, sprints, top speed.

**`storyStats` — per team, exactly five fields** (Hero Layer, FR-21, pre-rendered at build time per AD-11): `possession`, `shots`, `xG`, `distanceCovered`, `topSpeed`. All five are aggregates → AD-5 requires them precomputed and shipped, never summed in the browser. Story 2.4 renders exactly five tiles; do not add a sixth or drop one.

**`momentum` — required key, series or `null`.**

```jsonc
"momentum": {
  "$comment": "PROVISIONAL series shape (OQ-5 / AR-17). Concrete shape lands in Story 1.8 via the AD-14 change flow, with a schemaVersion bump and regenerated fixtures in the same commit. The KEY contract is final in v1: required, never omitted, never [], null triggers the App's empty state.",
  "anyOf": [{ "$ref": "#/$defs/MomentumSeries" }, { "type": "null" }]
}
```

`MomentumSeries` v1 provisional shape: `{ "samples": [{ "minute": int, "home": number, "away": number }] }`. This matches what EXPERIENCE.md's Momentum Timeline actually consumes (*"`aria-valuetext` announces minute + both teams' values"*). Goal markers on the momentum axis come from Domain A's scorer list, **not** from the series — do not duplicate them into `MomentumSeries`.

### Per-family acting-team semantics — pin these in `$comment` (AD-6)

| Event family | `teamId` means |
| --- | --- |
| `ShotEvent` | the **shooting** player's team (own goals flagged `ownGoal: true`, excluded from shot maps, attributed to the benefiting team in the scorer list) |
| `ShootoutAttempt` | the **taking** player's team |
| `CrossEvent` | the **crossing** player's team |
| `ReceivingEvent` | the **receiving** player's team |
| `DefensiveActionEvent` | the **defending** team |
| `PassNetworkNode` / `PassNetworkEdge` | the **passing** team |

### Index artifact contents

**`tournament.json`** — three jobs, all of them load-bearing:
1. *Results & standings* by stage/group, each standings row carrying an explicit pipeline-computed **`rank`** implementing the full FIFA tiebreaker cascade, plus the columns EXPERIENCE.md's i18n table names: played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points. Plus a per-team **form** sequence (ordered `win|draw|loss` results) — the Hub renders result chips from it, and it is a derived value, so it must be a field.
2. *Route manifest* — entity lists (matches, teams, players) that `generateStaticParams` reads at build time (AD-11). AR-4 asserts a bijection: one profile artifact per listed entity.
3. *Search + meta source* — the header typeahead runs entirely over this file, and `<title>`/OG are composed from it at build time. Per the IA: **match → teams + score + stage; player → name + team; team → name + tournament record.** So each entity row needs a display name, its slug, its type, and those meta fields — including a **team tournament-record** field (a derived aggregate). Missing any of these is exactly the kind of gap Story 2.3 would file a contract-change request for.

**`leaderboards.json`** — boards keyed by a **closed `metricCode` enum** (Story 2.13 maps each code to its locale label, so an unknown code is a compile error by design). Each board: scope (`team`|`player`), ordered rows with explicit `rank`, entity reference, and value. Rows must carry every column the App may show — the responsive rule hides columns behind a "Más columnas" disclosure, it never re-fetches.

**`team-profile.schema.json`** — tournament-wide tactical identity (line heights, defensive-block distribution, pressing tendencies, phases of play, **formation usage** as a derived distribution over formation strings) plus per-match breakdown rows, each carrying a `matchId` for the mandatory cross-link.

**`player-profile.schema.json`** — headline aggregates (with per-metric aggregation semantics: sum vs max vs average — FR-27 requires aggregates equal the correct aggregation, so the semantics must be documented per metric in `contract/README.md`), per-match series, physical profile (speed zones 1–5, high-speed runs, sprints, top speed), and cross-match trends. Per-match rows carry `matchId` so each value links back to its match.

### Per-surface data-needs checklist (pre-computed Story 2.3 sign-off)

Walk this before declaring the schemas done. Each row is a surface Epic 2 must render entirely from artifacts.

| Surface | Must be present in the contract |
| --- | --- |
| Hero | score, `KnockoutScore` (`decidedBy` drives the ET/shootout display), scorers with minute + `ownGoal`, stage + group, five `storyStats` per team |
| Lineups disclosure | starters + subs, shirt number, position, formation string, **`playerId` per lineup entry** (names link to Player Profiles) |
| `#key-stats` | all 13 Domain B metrics per team |
| `#momentum` | `momentum` series or explicit `null`; goal minutes + scorers from Domain A |
| `#shot-maps` | `ShotEvent`: player, minute, x, y, xG, outcome, teamId, ownGoal. `CrossEvent` likewise. **Minute is mandatory on every marker type** — roving-tabindex keyboard nav orders markers by minute |
| `#pass-networks` | `PassNetworkNode` (playerId, x, y, involvement) + `PassNetworkEdge` (endpoints, volume) |
| `#offers-to-receive` / `#movement-to-receive` | `ReceivingEvent` with `type` discriminator, player, minute, x, y, teamId |
| `#defensive-actions` | `DefensiveActionEvent` with player, minute, x, y, teamId, action type |
| `#phases`, `#pressing` | Domain C percentages per team |
| `#set-plays` | Domain F counts by type / side / style |
| `#goalkeeping` | Domain E per goalkeeper |
| `#expert` | every Domain G field, plus full event logs — the logs **are** the accessibility data-table alternative, so one event shape serves both the pitch panel and the table. No "lite" variants |
| Hub results/standings | rank, standings columns, form sequence, match slugs |
| Leaderboards | closed metric codes, ranked rows, all columns |
| Header search | entity name + slug + type, for players/teams/matches |
| `<title>`/OG | match: teams+score+stage · player: name+team · team: name+record |
| Comparison | no separate artifact — it fetches the same match/team/player artifacts and mirrors them. Requirement: those artifacts must be **self-sufficient and symmetric** |
| Empty states | each optional section must be distinguishably **absent** (`null`), not merely empty — the App shows a different state for "not in the report" vs "zero events" |

**Explicitly out of scope:** heatmap zone grids. Story 2.9 states no pipeline-emitted grid without an AD-14 change request; the match heatmap is client-derived under AD-5's single-surface carve-out. Do not add a heatmap schema.

### Vocabulary derivation worklist (Task 2)

Derive from the real corpus — these are named in the specs but never enumerated anywhere:

| Vocabulary | Where to look (anchor id from `ANCHOR_REGISTRY`) |
| --- | --- |
| Cross types / zones | `crosses` (`"Crosses (Open Play) {team}"`) |
| Defensive action types | `defensive-actions` (`"Defensive Actions {team}"`) |
| Corner side + style | `set-plays` (`"Set Plays {team}"`) |
| Set-play types | `set-plays` |
| GK intervention types | `gk-involvement` (`"Goalkeeping Involvement {home}"`) |
| Phases-of-Play category names | `phases-of-play` (`"{home} Phases of Play {away}"`) |
| Body part (shots) | `shots` (`"Attempts at Goal {team}"`) — the tabular event rows |
| Card types (yellow/red/second-yellow) | `lineups` (`"Match Summary - Teams"`) |
| Group letters | cover page — `probe.py`'s `_GROUP_RE` already extracts them (2026 format: 12 groups, expect A–L) |
| Leaderboard metric codes | **not** in the corpus — derive from the Domain B + Domain G metric sets you are already schematizing, and keep the code strings identical to the artifact field names |

Already settled, do not re-derive: `ShotOutcome` (from `spike/extract.py`), `Stage` (AD-3), `Position` (`gk|df|mf|fw`, Story 1.6), `DistributionType` (`feet|hands|throw`), `BlockLevel` (`high|mid|low`), `DecidedBy` (`regulation|extra-time|shootout`), `ReceivingEventType` (`offer|movement`).

### Fixture plan (Task 7)

Three Match Bundles + four index artifacts. Keep the fixture world **small but internally consistent**.

| Fixture | Edge shapes it covers |
| --- | --- |
| `data/fixtures/matches/m001-mexico-south-africa.json` | group match; `momentum` series present; `decidedBy: "regulation"` |
| `data/fixtures/matches/m0NN-{home}-{away}.json` | knockout: `decidedBy: "shootout"`, `scoreAfter90` + `scoreAfterET` + `shootoutScore` + `winnerTeamId` all populated; contains a `ShotEvent` with `ownGoal: true`; contains `ShootoutAttempt` rows |
| `data/fixtures/matches/m002-{home}-{away}.json` | group match with `momentum: null` |
| `data/fixtures/index/tournament.json` | one group's standings (with `rank` + form), the three fixture matches as results, entity lists |
| `data/fixtures/index/leaderboards.json` | at least one team board and one player board, ranked |
| `data/fixtures/index/team-profiles/{team-id}.json` | one full team profile |
| `data/fixtures/index/player-profiles/{player-id}.json` | one full player profile |

Rules:
- **"Full" means full.** A full Match Bundle carries all seven domains populated — 11 starters + ~7 substitutes per team, Domain G rows for every player with minutes, real-shaped Domain D event arrays. A skeleton bundle fails AC 4 and leaves Epic 2 building against a shape it cannot trust.
- **Seed from real reports.** Pull Domain A (teams, score, stage, group, venue, date, kickoff, shootout) straight out of `probe_report()` against the actual PDFs so the values are real and hand-checkable. Domain B–G values may be plausible synthetics — say so in `data/fixtures/README.md`.
- **Entity lists list exactly what has an artifact.** `tournament.json`'s entity lists name the 3 fixture matches, the 1 team with a profile, and the 1 player with a profile. Lineups and standings will reference players and teams that have no fixture profile — that is fine and intentional. Document it: AR-4's bijection assert is enforced against real `/data` in Story 1.17, not against fixtures.
- **Canonical bytes.** Sorted keys, `indent=2`, `ensure_ascii=False`, trailing newline, UTF-8, LF. A test asserts fixtures round-trip byte-identically.
- **Budget sanity check, not the budget gate.** Record each fixture's gzip -9 size in `data/fixtures/README.md` as an early read on the ≤ 500 KB per-artifact budget (AD-4). The enforcing gate — measured by the pipeline over canonical bytes, failing the run on breach — belongs to Story 1.16. Do not build it here. If a *fixture* already exceeds 500 KB, stop and raise it: that is a signal the real bundle shape will not fit, and it is far cheaper to learn now than at 1.16.

### Codegen gotchas (Task 6) — verified against `json-schema-to-typescript` 15.0.4

- **Current version is `15.0.4`** (released 2025-01-14; still `latest` as of today). Requires Node ≥16; we are on Node 24. It is a **CommonJS** package with no `exports` map — from an ESM script prefer `import * as jst from "json-schema-to-typescript"` rather than destructured named imports, to sidestep cjs-module-lexer edge cases.
- **Title every schema and every `$def`.** Type names come from `title` first, then the `$defs` key, then the input filename. Untitled schemas that resolve to the same name get silently suffixed `Foo1`, `Foo2`. A collision-suffixed name in the generated output is a *fidelity failure* — assert against it.
- **Pass `--additionalProperties false`.** When a schema omits `additionalProperties`, the tool defaults to `true` and emits `[k: string]: unknown;`, which silently defeats closed shapes. Belt and braces: also set `additionalProperties: false` explicitly on every object in the schemas.
- **`enum` compiles to a union of string literals by default** — `"goal" | "on-target" | ...`. That is exactly what AD-2 wants (adding a value becomes a compile error downstream). **Do not** add `tsEnumNames`, and leave `--enableConstEnums` alone.
- **`oneOf` and `anyOf` both compile to a plain TS union.** `oneOf`'s exclusivity is not representable in TypeScript and is silently lost. Prefer `anyOf` for nullable unions so nobody reads exclusivity into the generated types that isn't enforced.
- **Nullable:** `anyOf: [{...}, {"type": "null"}]` → `X | null`. This is the pattern for `momentum`, `scoreAfterET`, `shootoutScore`, `winnerTeamId`.
- **Validation-only keywords have no TS representation:** `pattern`, `minimum`, `maximum`, `x-decimals`, `format`. IDs will generate as plain `string`. That is expected — pattern enforcement is the Python validator's job, not the type system's.
- **Cross-file `$ref`** is resolved by `@apidevtools/json-schema-ref-parser` relative to `--cwd` / the input file. Give each schema an `$id` (e.g. `https://wc-stats.dev/contract/match-bundle.schema.json`) and use relative refs like `"common.schema.json#/$defs/TeamId"`. Keep the version out of the `$id` — `schemaVersion` bumps must not churn `$id`s.
- **`SCHEMA_VERSION` must be generated, never typed.** Read `version.json` in the script and emit `export const SCHEMA_VERSION = 1;`. Two hand-maintained copies of the version is precisely the drift AD-2 exists to prevent.
- **Fallbacks if the spike fails:** `json-schema-to-ts@3.1.1` (pure type inference, no codegen step — but wants schemas as `as const` TS objects, which would move schema ownership out of `/contract`; a poor fit here) or `quicktype@26.0.0` (multi-language, heavier, opinionated naming). Both are permitted by AD-2 **via a logged decision** — write it into `contract/README.md` if you swap.

### The draft-07-compatible subset of 2020-12 — the rule to follow

Set `"$schema": "https://json-schema.org/draft/2020-12/schema"` on every file, and use **`$defs`** (not `definitions`).

> Note a real subtlety: `$defs` was introduced in 2019-09, so a strict "draft-07-only" reading would say use `definitions`. **AD-2 explicitly settles this** — *"authored in the draft-07-compatible subset of 2020-12 (`$defs` allowed; `prefixItems`, `unevaluatedProperties`, `dependentSchemas` banned)"*. Follow AD-2. `json-schema-to-typescript` handles `$defs` fine. Do not "correct" this to `definitions`.

**Banned** (test for these in Task 8): `prefixItems`, `unevaluatedProperties`, `unevaluatedItems`, `dependentSchemas`, `dependentRequired`, `$dynamicRef`, `$dynamicAnchor`, `$recursiveRef`, `minContains`, `maxContains`.

**Safe:** `type`, `properties`, `required`, `additionalProperties`, `items` (single-schema form), `enum`, `const`, `$ref`, `$defs`, `title`, `description`, `$comment`, `anyOf`, `allOf`, `if`/`then`/`else`, `contains`, `propertyNames`, `pattern`, `minimum`/`maximum`, `minItems`/`maxItems`, `format`.

We have no tuple-typed arrays, so the `items`/`prefixItems` semantic break never bites — but if you reach for one, use a `$def`'d object instead of a tuple.

### Python validation stack (Task 8)

Pins verified current as of today:

- `jsonschema` **4.26.0** (released 2026-01-07, requires Python ≥3.10) — `Draft202012Validator` is the 2020-12 validator. Install the `[format]` extra so `format: "date-time"` / `"date"` are actually checked; format checking is **off by default** and must be opted into explicitly with `format_checker=Draft202012Validator.FORMAT_CHECKER`.
- `referencing` **0.37.0** (released 2025-10-13) — **`jsonschema.RefResolver` is deprecated; do not use it.** Cross-file `$ref` resolution goes through a `Registry`. Every pre-2023 tutorial and StackOverflow answer you will find shows the deprecated API.

Working pattern for loading `/contract`:

```python
import json
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

CONTRACT_DIR = Path(__file__).resolve().parents[2] / "contract"


def _registry() -> Registry:
    resources = []
    for path in sorted(CONTRACT_DIR.glob("*.schema.json")):
        contents = json.loads(path.read_text(encoding="utf-8"))
        resource = Resource.from_contents(contents, default_specification=DRAFT202012)
        # Register under the schema's own $id AND its bare filename, so both
        # absolute and relative $refs resolve.
        resources.append((contents["$id"], resource))
        resources.append((path.name, resource))
    return Registry().with_resources(resources)
```

`Draft202012Validator.check_schema(schema)` validates that a *schema document itself* is legal — use it in `test_contract_schemas.py`; it catches typos that would otherwise silently make a constraint a no-op.

No CVEs against `json-schema-to-typescript` or `jsonschema` as of today. (`check-jsonschema` had CVE-2024-53848, fixed in 0.30.0 — we are not adding that dependency; pytest is the gate.)

### Testing standards

- **Framework:** pytest 8.4.2, already pinned. Tests live in `pipeline/tests/`. There is no `pytest.ini`/`pyproject.toml` — config is implicit plus `conftest.py`'s `sys.path` insert. Do not add a config file for this story.
- **Run command (exact):**
  ```
  pipeline\venv\Scripts\python.exe -m pytest pipeline/tests
  ```
  A bare `python -m pytest` **fails** with `ModuleNotFoundError: No module named 'pymupdf'` — the venv is not on PATH by default. This is a documented, previously-hit gotcha.
- **Naming:** `test_<area>.py`; long descriptive function names that read as sentences (`test_every_object_in_the_contract_closes_additional_properties`). Each test file opens with a docstring naming the Task and AC it covers.
- **Style to match:** `from __future__ import annotations` as the first import in every module; modern type hints (`str | None`, `list[int]`); `@dataclass(frozen=True)` for value objects; absolute imports rooted at `pipeline.`; module docstrings that explain *why*, citing the specific failure they defend against.
- **The 130 existing tests must stay green.** Run the full suite, not just the new files.
- **Schema tests are structural, not sampled.** Walk every schema file and assert the invariants (banned keywords, closed objects, titled `$defs`) programmatically over the whole tree — a test that checks three hand-picked schemas will miss the fourth.

### Project Structure Notes

New in this story:

```text
wc-stats/
  .gitignore                              # NEW (repo-root; no git repo yet, but ready for one)
  contract/                               # NEW — Epic 1 owns, Epic 2 consumes (AD-1)
    version.json                          #   {"schemaVersion": 1}
    common.schema.json                    #   ids, enums, coordinates, scalars, KnockoutScore
    match-bundle.schema.json
    tournament.schema.json
    leaderboards.schema.json
    team-profile.schema.json
    player-profile.schema.json
    package.json                          #   private, "type": "module", json-schema-to-typescript@15.0.4
    package-lock.json                     #   committed (AR-15)
    scripts/generate-types.mjs
    generated/contract-types.d.ts         #   committed — the codegen spike's evidence
    generated/schema-version.ts           #   generated from version.json
    README.md                             #   precision table, teamId semantics, enum provenance, AD-14 flow
  data/                                   # NEW
    fixtures/
      README.md
      matches/*.json                      #   3 bundles
      index/tournament.json
      index/leaderboards.json
      index/team-profiles/*.json
      index/player-profiles/*.json
  pipeline/
    requirements.txt                      # MODIFIED — add jsonschema[format]==4.26.0, referencing==0.37.0
    validate/
      errors.py                           # NEW — SchemaValidationError(PipelineError)
      schema.py                           # NEW — contract loading + artifact validation
    tests/
      test_contract_schemas.py            # NEW
      test_fixtures.py                    # NEW
```

**Variance from the Structural Seed:** the seed places generated contract types under `app/src/lib/`. `app/` does not exist yet (Story 2.1 creates it), so this story writes them to `contract/generated/` and keeps the output directory a parameter of `generate-types.mjs`. Story 2.1 re-points the same script at `app/src/lib/contract/` — it must **not** write a second generator. Note this in `contract/README.md` so 2.1's implementer finds it.

**Do NOT create in this story:** `app/`, `data/matches/`, `data/index/`, `pipeline/extract/`, `pipeline/markers/`, `pipeline/ingest/`, `pipeline/precompute/`, the slug registry, or any locale file. Do not modify anything under `spike/` — it is frozen. Do not run `git init`.

**Open deferred items** (`_bmad-output/implementation-artifacts/deferred-work.md`): the two 1.4 findings — cover-line reconstruction thresholds and zero-width-character normalization — are **not** in this story's scope. Both need the extraction stories or real-corpus boundary evidence. Leave them deferred.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Contract v1 Schemas, Fixtures & Type-Generation Spike]
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — AR-2, AR-3, AR-4, AR-6, AR-7, AR-14, AR-15, AR-16, AR-17
- [Source: _bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md#AD-2] — contract mechanics, codegen spike, closed enums
- [Source: .../ARCHITECTURE-SPINE.md#AD-3] — identity, slug formats, canonical order
- [Source: .../ARCHITECTURE-SPINE.md#AD-4] — exact artifact set, momentum key rule, standings rank, budgets
- [Source: .../ARCHITECTURE-SPINE.md#AD-5] — aggregation only in precompute
- [Source: .../ARCHITECTURE-SPINE.md#AD-6] — pitch frame, per-family acting-team semantics
- [Source: .../ARCHITECTURE-SPINE.md#AD-14] — contract bootstrap, fixture edge shapes, change flow
- [Source: .../ARCHITECTURE-SPINE.md#Consistency Conventions] — camelCase keys, canonical serialization, dependency locking
- [Source: .../ARCHITECTURE-SPINE.md#Structural Seed]
- [Source: _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md#6] — Domain A–G field inventory
- [Source: _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md#FR-18, FR-19, FR-20, FR-21, FR-27, FR-35, OQ-4, OQ-5, SM-C2]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md#Progressive Disclosure Contract, Component Patterns, Accessibility Floor, State Patterns, IA]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md#Shot-outcome encoding, Two-team encoding, Pass-network edge weight ramp]
- [Source: _bmad-output/implementation-artifacts/1-4-template-consistency-verification-across-the-venue-matchday-sample.md] — established conventions, corpus facts, module inventory
- [Source: spike/extract.py] — exact-RGB → shot-outcome map (ground truth for `ShotOutcome`)
- [Source: work/verification/verification-report.json] — 104-report gate baseline and the 16-report sample list

## Dev Agent Record

### Agent Model Used

`claude-opus-4-8[1m]` (Opus 4.8, 1M context) via Claude Code.

Toolchain versions actually used:

- Node **v24.15.0**, npm **11.12.1** (AD-13 requires Node 24 LTS — satisfied, no install needed)
- `json-schema-to-typescript` **15.0.4** (pinned, `contract/package-lock.json` committed)
- Python **3.14.4** in `pipeline/venv`; `jsonschema` **4.26.0**, `referencing` **0.37.0**
- No git repository exists, so `baseline_commit` remains `NO_VCS` (`git rev-parse HEAD` exits 128). `git init` was **not** run — explicitly out of scope.

### Debug Log References

**Task 10 — AC 7 carried gate, verbatim console output:**

```
Template-consistency verification
=================================
corpus          : pmsr-corpus
reports found   : 104 (probed 104, probe failures 0)
checks run      : anchor-coverage, metadata-probe
sample size     : 16

Sample (report -> venue | matchday round | covers)
  PMSR-M01-MEX-V-RSA       Mexico City Stadium | group-md1 | round, venue
  PMSR-M02-KOR-V-CZE       Guadalajara Stadium | group-md1 | venue
  PMSR-M03-CAN-V-BIH       Toronto Stadium | group-md1 | venue
  PMSR-M05-HAI-V-SCO       Boston Stadium | group-md1 | venue
  PMSR-M08-QAT-V-SUI       San Francisco Bay Area Stadium | group-md1 | venue
  PMSR-M10-GER-V-CUW       Houston Stadium | group-md1 | venue
  PMSR-M100-ARG-V-SUI      Kansas City Stadium | qf | round, venue
  PMSR-M101-FRA-V-ESP      Dallas Stadium | sf | round, venue
  PMSR-M103-FRA-V-ENG      Miami Stadium | third-place | round, venue
  PMSR-M104-ESP-V-ARG      New York/New Jersey Stadium | final | round, venue
  PMSR-M12-SWE-V-TUN       Monterrey Stadium | group-md1 | venue
  PMSR-M16-BEL-V-EGY       Seattle Stadium | group-md1 | venue
  PMSR-M25-CZE-V-RSA       Atlanta Stadium | group-md2 | round, venue
  PMSR-M51-SUI-V-CAN       BC Place Vancouver | group-md3 | round, venue
  PMSR-M73-RSA-V-CAN       Los Angeles Stadium | r32 | round, venue
  PMSR-M89-PAR-V-FRA       Philadelphia Stadium | r16 | round, venue

Deviations by category
  missing-anchor   0
  unknown-rgb      0
  count-mismatch   0
  probe-failure    0

GATE RESULT: PASS (0 deviation(s) across 16 sampled report(s), 0 corpus gap(s))

manifest written to work/verification/verification-report.json
EXIT CODE = 0
```

**Test suite:** baseline before this story was 130 passed. Final: **256 passed** (126 added), 0 failed, 0 skipped.

**Codegen fidelity (AC 3):** 231 declarations from 6 schemas — 0 index signatures, 0 collision-suffixed names, 0 duplicate declarations, 15 `| null` unions, enums as string-literal unions.

### Completion Notes List

**Corpus findings that changed the design.** Four things the real 104-report corpus said that the Dev Notes' expectations did not:

1. **PMSR carries no per-shot xG.** xG appears only as a team total on the Key Statistics page; the shots event table has no xG column, in any of the 104 reports. `ShotEvent.expectedGoals` is therefore typed `ExpectedGoals | null` and v1 emits `null`. Logged as an AD-14 change-flow candidate. Story 2.7's shot tooltip must not promise per-shot xG.
2. **PMSR carries no shoot-out attempt table.** Only the aggregate cover line, e.g. `"(Switzerland win 4-3 on Penalties)"` — checked against all four shoot-out ties (M74, M75, M88, M96). `ShootoutAttempt` is still a first-class `$def` (AC 1 requires it) but `events.shootoutAttempts` is `array | null` and **real data will emit `null`**. The `m074` fixture carries attempt rows anyway, per the story's own Fixture plan, so Epic 2 can build the surface — flagged loudly in both READMEs that production sends `null`.
3. **PMSR marks no own goals anywhere.** `ownGoal` remains a schema field; real data emits `false`. The one `ownGoal: true` in `m074` is a deliberate synthetic edge shape, constructed so every real number still reconciles (see `data/fixtures/README.md`).
4. **Phase percentages are not a distribution.** The Dev Notes expected the Phases of Play values, and the defensive block shares, to sum to ~100%. They do not — Germany's eight in-possession values in M74 sum to 124, Mexico's nine out-of-possession values in M01 sum to 80. They are modelled and documented as independent per-phase rates. Rendering them as a stacked bar would be straightforwardly wrong.

**Task 2 was widened from the 16-report sample to all 104.** The story suggested 2–3 reports from the 1.4 sample. A mid-tournament label variant is exactly the thing that would sit in the 88 reports a sample skips, so the harvest walked every report. It found values the sample would have missed: `ShotOutcomeDetail` has **22** values, of which only 7 appear in M01 — `incomplete-foul-for` first appears in M27, `deflected-off-target-referee-event` in M49, `incomplete-referee-event` in M10. `ShotDeliveryType`'s `penalty`, `interception` and `tackle` likewise appear first in M08, M02 and M09.

**Two vocabularies could not be closed, both recorded as AD-14 candidates.** `CardType` is not derivable from text at all — cards are coloured glyphs with only a minute printed — so it is closed on the football-universal three values. **Cross zones** have a pitch panel with counts but no zone labels; rather than invent an enum, `CrossEvent` carries `x`/`y` in the AD-6 pitch frame, which is strictly more information. If Story 2.7/2.9 wants zone aggregates it should file a change request for the zone *definition*.

**Domain B is 19 fields per team, not 13.** The page prints more rows than the Dev Notes list, and compound rows carry two numbers each: `"Total Passes (Complete)"` → `passes` + `passesCompleted`, `"Defensive Pressures Applied (Direct Pressures)"` → `defensivePressures` + `directPressures`, `"Attempts at Goal (On Target)"` → `shots` + `shotsOnTarget`. Possession prints as **three** percentages (home / contested / away, summing to 100); the contested share cannot be derived from the other two and is stored once as `keyStatistics.contestedPossession`.

**Codegen spike: no tool swap needed, but two schema-side fixes were.** The first generation failed fidelity with 11 collision-suffixed names (`Metres1`–`Metres5`, `Count1`–`Count3`, `TeamScore1`, …) and one index signature. Causes and fixes:

- **`$ref` nodes carrying sibling keywords.** `{"$ref": X, "$comment": "..."}` is legal 2020-12, but `json-schema-to-typescript` treats it as a *new* schema rather than a reference and emits a duplicate under a suffixed name. All 14 such nodes were rewritten with the annotation moved to the referenced `$def` or the parent's `description`. `test_no_ref_node_carries_sibling_keywords` now prevents recurrence.
- **`common.schema.json` had no closed root.** As a pure `$defs` library it had no root `type`, so the tool emitted `export interface Common { [k: string]: unknown; }`. Its root is now the empty closed object.

The generator also had to **deduplicate declarations by name** across the six compilations — each is compiled with `declareExternallyReferenced`, so `Position` was declared four times and the concatenated output was not valid TypeScript. A repeat with a *different* body is a hard error, which is a genuine collision detector. It strips the tool's per-file "referenced by `X`" stanza first, otherwise identical declarations compare unequal. The generator **refuses to write** output with an index signature or a suffixed name, and the tests re-assert the same properties against the committed output to catch hand edits.

**Fixtures carry far more real data than the story required.** The story allowed Domain B–G to be plausible synthetics. In practice Domains **B and C in full**, **all shot events** (minute, player, outcome, outcome detail, body part, delivery type), **set-play totals**, **the whole Physical Data table**, and all of Domain A were read straight off the PDFs. This produced a real cross-check: the shot events reconcile with Domain B in all six team-innings — Mexico's 16 rows contain exactly 4 on-target, matching the printed `16 (4)`; likewise `3 (2)`, `15 (6)`, `7 (4)`, `21 (6)`, `7 (3)`. That is the marker-count self-validation Story 1.3 will automate, passing already. Synthetic: pitch coordinates (they live in vector graphics, not text — Stories 1.3/1.11–1.14), momentum, cross/receiving/pass-network/defensive events, Domain E, and Domain G in/out-of-possession.

**Budget signal for Story 1.16.** Largest fixture bundle is 197.4 KiB canonical / 16.0 KiB gzip -9 — about 40% of AD-4's 500 KB per-artifact budget, and it is the 120-minute match. Headroom is real but not vast, and Domain D event arrays dominate. `tournament.json` will grow by roughly two orders of magnitude against real data (12 groups, 104 results, every entity). Story 1.16 should treat the budget gate as load-bearing, not a formality. A test asserts no fixture exceeds 500 KB.

**`defensiveBlockDistribution` duplicates three phase values by design.** It and `phasesOutOfPossession.{highBlock,midBlock,lowBlock}` are the same three numbers from the same page. The duplicate is kept because Story 2.10 renders block height as its own concept, but a duplicate that can drift is a hazard, so `test_defensive_block_distribution_mirrors_the_three_block_phases` holds them equal on every fixture.

**Stoppage time is two integers, not a display string.** The corpus prints `"90+2"`; AD-7 forbids display strings in artifacts, so it is stored as `minute: 90, stoppageMinute: 2` and the App composes the label. Ordering — which the roving-tabindex marker navigation depends on — is by the pair.

**One pre-existing test was modified.** `pipeline/tests/test_workspace.py::test_requirements_pin_every_dependency_exactly` hard-codes the dependency set, which this story's mandated `jsonschema` + `referencing` additions necessarily change. Its pin-parsing regex also could not read an extras group, so `jsonschema[format]==4.26.0` was invisible to it; both were fixed.

**Scope respected.** No `app/`, `data/matches/`, `data/index/`, `pipeline/extract/`, `pipeline/markers/`, `pipeline/ingest/` or `pipeline/precompute/` created. `spike/` untouched. No `git init`. No new `DeviationCategory`. The two open 1.4 deferred items (cover-line reconstruction thresholds, zero-width-character normalization) were left deferred. All exploration scripts stayed in the scratchpad and none was committed into `pipeline/`.

### File List

**New — contract (11 files):**

- `contract/version.json`
- `contract/common.schema.json`
- `contract/match-bundle.schema.json`
- `contract/tournament.schema.json`
- `contract/leaderboards.schema.json`
- `contract/team-profile.schema.json`
- `contract/player-profile.schema.json`
- `contract/package.json`
- `contract/package-lock.json`
- `contract/scripts/generate-types.mjs`
- `contract/README.md`

**New — generated codegen output, committed as the AD-2 spike evidence (2 files):**

- `contract/generated/contract-types.d.ts`
- `contract/generated/schema-version.ts`

**New — fixtures (8 files):**

- `data/fixtures/README.md`
- `data/fixtures/matches/m001-mexico-south-africa.json`
- `data/fixtures/matches/m002-korea-republic-czechia.json`
- `data/fixtures/matches/m074-germany-paraguay.json`
- `data/fixtures/index/tournament.json`
- `data/fixtures/index/leaderboards.json`
- `data/fixtures/index/team-profiles/mexico.json`
- `data/fixtures/index/player-profiles/quinones-julian-mex.json`

**New — pipeline (4 files):**

- `pipeline/validate/errors.py`
- `pipeline/validate/schema.py`
- `pipeline/tests/test_contract_schemas.py`
- `pipeline/tests/test_fixtures.py`

**New — repo root (1 file):**

- `.gitignore`

**Modified (3 files):**

- `pipeline/requirements.txt` — added `jsonschema[format]==4.26.0`, `referencing==0.37.0`
- `pipeline/tests/test_workspace.py` — pin set updated for the two new dependencies; pin regex taught to read an extras group
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status `ready-for-dev` → `in-progress` → `review`

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-22 | Story created — context engine analysis across PRD + addendum, architecture spine, UX contract, full epics harvest, existing codebase, and web verification of the codegen/validation toolchain. |
| 2026-07-22 | Contract v1 implemented: 6 JSON Schemas + `version.json`; vocabularies closed against all 104 reports; codegen spike passed with `json-schema-to-typescript@15.0.4` (no tool swap); 7 fixtures authored from real corpus data; Python validation stack + 126 new tests; full suite 256 passed; 1.4 verification gate re-run clean (exit 0, gate PASS). |
| 2026-07-22 | Code review (3 parallel layers + verification): 5 decisions resolved, 35 patches applied, 3 items deferred, 2 dismissed. Committed types regenerated and a `--check` drift guard added; the inverted `_in_name_map` predicate fixed, restoring four structural guards from 6/86 objects to 86/86; eight optional sections made nullable; the fixture world fully reconciled across artifacts; `anyOf` validation diagnostics now name the offending field; 14 closed vocabularies pinned to the objects that encode them; 8 new logged decisions (9–16). Story suite 126 → 202 tests, AC 7 gate still exit 0. |

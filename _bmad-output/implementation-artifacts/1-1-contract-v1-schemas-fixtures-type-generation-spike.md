---
baseline_commit: NO_VCS
---

# Story 1.1: Contract v1 Schemas, Fixtures & Type-Generation Spike

Status: in-progress

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

- [ ] **Task 1: Seed the contract workspace** (AC: 1, 2)
  - [ ] Create `contract/` and `data/fixtures/` (do NOT create `app/`, `data/matches/`, `data/index/`, `pipeline/extract/`, `pipeline/markers/`, `pipeline/ingest/`, `pipeline/precompute/` — later stories own those)
  - [ ] Write `contract/version.json` = `{"schemaVersion": 1}` (exactly one key; this file is the single global version declaration per AD-2)
  - [ ] Verify Node is available: `node --version` must report **24.x**. If Node is absent, install Node 24 LTS before Task 6 — record the version actually used in the Dev Agent Record.
  - [ ] Create `.gitignore` at repo root covering `venv/`, `__pycache__/`, `.pytest_cache/`, `node_modules/`, `work/`. (There is no git repo yet — do NOT run `git init`; it is not in scope. Committing the file now means the repo is ready the moment git lands.)

- [ ] **Task 2: Derive closed vocabularies from the real corpus** (AC: 2) — *do this BEFORE authoring schemas*
  - [ ] For each vocabulary listed in **Dev Notes → Vocabulary derivation worklist**, read the actual label text off the relevant pages of 2–3 real reports in `pmsr-corpus/` using the existing discovery machinery (`pipeline.discover.anchors.ANCHOR_REGISTRY` + `pipeline.discover.text.PageTextIndex` + `page.get_text()`)
  - [ ] Use a throwaway script written to `work/` or the scratchpad — **do not commit it into `pipeline/`** (it is exploration, not pipeline code)
  - [ ] Sample across venues/rounds (pick reports the 1.4 gate already sampled — see `work/verification/verification-report.json` `sample[]`) so a mid-tournament label variant would show up
  - [ ] Record every derived enum with its evidence (report ID + verbatim source label) in `contract/README.md`
  - [ ] Where a vocabulary cannot be closed with confidence, close it on what was observed and note it in `contract/README.md` as an AD-14 change-flow candidate — AD-8's assert-on-unknown at extraction time is the designed safety net, not an open enum

- [ ] **Task 3: Author `contract/common.schema.json`** (AC: 1, 2, 6)
  - [ ] ID types with `pattern` regexes: `TeamId`, `PlayerId`, `MatchId`, `TeamCode` (see Dev Notes → ID formats)
  - [ ] Enums: `Stage`, `Group`, `Position`, `ShotOutcome`, `DecidedBy`, `ReceivingEventType`, `BlockLevel`, `DistributionType`, `CardType`, plus every vocabulary derived in Task 2
  - [ ] Coordinate types: `PitchX`, `PitchY` (`number`, `minimum: 0`, `maximum: 100`, `x-decimals: 2`)
  - [ ] Shared scalar types: `Minute`, `Percentage`, `Metres`, `Kilometres`, `KmPerHour`, `ExpectedGoals`, `Count`
  - [ ] `KnockoutScore` (`scoreAfter90`, `scoreAfterET`, `shootoutScore`, `winnerTeamId`, `decidedBy`)
  - [ ] Every `$def` carries an explicit `title` (controls generated TS type names — see Dev Notes → Codegen gotchas)

- [ ] **Task 4: Author `contract/match-bundle.schema.json`** (AC: 1, 2)
  - [ ] Root envelope: `schemaVersion`, `matchId`, Domain A block, `storyStats` per team, `momentum` (required, series-or-`null`), and each domain block
  - [ ] Domain A: teams (home/away with explicit ordering), score + `KnockoutScore`, stage/group, venue, date, kickoff (ISO 8601 venue-local with UTC offset), formations, lineups (starters + substitutes: shirt number, position, goal/sub/card minutes)
  - [ ] Domain B: full Key Statistics block per team (13 metrics — full list in Dev Notes)
  - [ ] Domain C: phases of play, line height / team length in/out of possession (metres), defensive block distribution high/mid/low
  - [ ] Domain D event tables as first-class `$defs`: `ShotEvent`, `ShootoutAttempt`, `CrossEvent`, `PassNetworkNode`, `PassNetworkEdge`, `ReceivingEvent`, `DefensiveActionEvent` — **all seven**, each with `teamId` and its per-family acting-team semantics documented in `$comment`
  - [ ] Domain E: per-goalkeeper involvement timeline, distribution, goal prevention (save %, intervention types), aerial control
  - [ ] Domain F: per team — free kicks, penalties, corners (by side and style), throw-ins
  - [ ] Domain G: per-player in-possession / out-of-possession / physical (speed zones 1–5, high-speed runs, sprints, top speed)
  - [ ] `additionalProperties: false` on every object; `required` lists complete

- [ ] **Task 5: Author the four index schemas** (AC: 1, 2)
  - [ ] `contract/tournament.schema.json` — stages, groups with standings rows carrying explicit `rank`, results, and the entity lists that serve as the App's route manifest and search source
  - [ ] `contract/leaderboards.schema.json` — boards keyed by closed `metricCode` enum, ordered rows with `rank`
  - [ ] `contract/team-profile.schema.json` — tactical identity + formation usage + per-match breakdowns
  - [ ] `contract/player-profile.schema.json` — aggregates + per-match series + physical profile + trends
  - [ ] Each references `common.schema.json` by relative `$ref`

- [ ] **Task 6: Codegen spike + scripted generation** (AC: 3)
  - [ ] `contract/package.json` (private, `"type": "module"`) pinning `json-schema-to-typescript@15.0.4`; `npm install`; commit `contract/package-lock.json`
  - [ ] `contract/scripts/generate-types.mjs` — compiles every `*.schema.json`, writes `contract/generated/contract-types.d.ts` and `contract/generated/schema-version.ts` (`export const SCHEMA_VERSION = 1;` read from `version.json`, never hand-typed)
  - [ ] `npm run generate:types` script wired in `contract/package.json`
  - [ ] Run it; commit the generated output as the spike evidence
  - [ ] **Prove round-trip fidelity** on one representative schema (use `match-bundle.schema.json` — it is the one that exercises nested `$defs`, cross-file `$ref`, enums, and nullable unions): assert generated types contain the expected enum unions, `| null` on nullable fields, no `[k: string]: unknown` index signatures, and no `Foo1`/`Foo2` collision-suffixed names
  - [ ] If fidelity fails, swap to `json-schema-to-ts` or `quicktype` and record the swap as a logged decision in `contract/README.md` (AD-2 explicitly permits this)

- [ ] **Task 7: Author fixtures** (AC: 4, 5, 6)
  - [ ] `data/fixtures/matches/` — three bundles (see Dev Notes → Fixture plan): group match with a momentum series; knockout ET+shootout with an own goal; group match with `momentum: null`
  - [ ] `data/fixtures/index/tournament.json`, `leaderboards.json`, `team-profiles/{one}.json`, `player-profiles/{one}.json`
  - [ ] Every fixture stamped `schemaVersion: 1` and canonically serialized (sorted keys, `indent=2`, UTF-8, LF — reuse the `_write` recipe from `pipeline/validate/runner.py`)
  - [ ] Seed metadata/lineups/score from real reports in `pmsr-corpus/` so values are plausible and hand-checkable
  - [ ] `data/fixtures/README.md` documenting provenance, the deliberate partiality of the fixture world, and the AD-14 change-flow rule

- [ ] **Task 8: Python-side schema validation + tests** (AC: 2, 4)
  - [ ] Add `jsonschema[format]==4.26.0` and `referencing==0.37.0` to `pipeline/requirements.txt`; install into `pipeline/venv`
  - [ ] `pipeline/validate/errors.py` — `SchemaValidationError(PipelineError)` following the `pipeline/discover/errors.py` pattern
  - [ ] `pipeline/validate/schema.py` — loads `/contract` into a `referencing.Registry`, exposes `validate_artifact(instance, schema_name)`
  - [ ] `pipeline/tests/test_contract_schemas.py` — every schema passes `Draft202012Validator.check_schema`; no banned keyword (`prefixItems`, `unevaluatedProperties`, `unevaluatedItems`, `dependentSchemas`, `dependentRequired`, `$dynamicRef`) appears anywhere; every object has `additionalProperties: false`; every `$def` has a `title`; `version.json` says `1`
  - [ ] `pipeline/tests/test_fixtures.py` — every fixture validates against its schema; every fixture carries `schemaVersion == 1`; every ID matches its AD-3 pattern; edge-shape coverage asserted explicitly (a bundle with `momentum: null`, one with `decidedBy: "shootout"`, one with a shot carrying `ownGoal: true`); fixtures round-trip byte-identically through the canonical serializer
  - [ ] `pipeline/tests/test_generated_types.py` *(or an assertion inside `test_contract_schemas.py`)* — `contract/generated/schema-version.ts` agrees with `version.json`

- [ ] **Task 9: `contract/README.md`** (AC: 2, 3)
  - [ ] Per-field numeric precision table (the record of "precision is fixed")
  - [ ] Per-family `teamId` acting-team semantics table
  - [ ] Enum provenance table from Task 2 (value ← verbatim source label ← report ID)
  - [ ] The AD-14 change-flow procedure: Epic 2 requests → Epic 1 implements → logged decision → `schemaVersion` bump → fixtures regenerated + types regenerated **in the same commit**
  - [ ] Every logged decision this story makes (match-ID padding, precision mechanism, momentum provisional shape, any tool swap)

- [ ] **Task 10: Re-run the 1.4 verification gate** (AC: 7)
  - [ ] `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` → exit 0, gate `pass`
  - [ ] Paste the verbatim console output into the Dev Agent Record

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-22 | Story created — context engine analysis across PRD + addendum, architecture spine, UX contract, full epics harvest, existing codebase, and web verification of the codegen/validation toolchain. |

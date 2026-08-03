---
baseline_commit: eec2397
---

# Story 1.15: Cross-Match Identity Resolution & Normalized Spine

Status: done

## Story

As the builder,
I want all Extraction Records normalized into the data-model spine with stable IDs and deterministic player-identity resolution,
So that a player appearing in N matches has exactly one ID that is also their stable URL slug (FR-17).

> **The epic's premise for this story is inverted, and the story-creation probe measured it over all 104 Extraction Records / 5,392 lineup entries / 1,248 distinct players.**
>
> The epic frames 1.15 around OQ-4's three ambiguous cases — **accents, duplicate names, squad-number changes**. **All three are corpus-EMPTY** (measured in AC 1's table; the finding is stated once there and cross-referenced everywhere else).
>
> **The real ambiguity is one the epic never names: splitting one printed name string into `{surname}` and `{givenName}`.** No record carries them separately, and the corpus prints names in at least four incompatible grammars — given-first `Raul RANGEL`, **surname-first `KIM Seunggyu`** (all 26 Korea Republic players), all-caps `GABRIEL MAGALHAES` where the boundary is unknowable, and mononyms `ALISSON` with no split at all.
>
> AC 1's canonical-order clause is already satisfied by shipped code. AC 2's ID minting is **two-thirds already built** (`pipeline/ingest/identity.py`). AC 3's pinning check is the load-bearing new deliverable and has **no `/data` baseline to diff against**, because `data/matches/` does not exist yet. AC 4 is re-scoped by the BINDING block below. Everything else in the epic's story statement stands.

## Acceptance Criteria

The epic's ACs are reproduced **verbatim**, each followed by the **binding reconciliation** the story-creation probe forced.

The epic prints **three** Given/When/Then blocks (`epics.md:508-519`; `:506` is the heading); the first block's `Then` and `And` clauses are numbered 1 and 2 here.

---

**1. Given** all Extraction Records **When** precompute runs **Then** records are consumed in canonical order (ascending match ID) and identity resolves deterministically: normalized (lowercase, accent-stripped) name + team, collisions broken by first-seen shirt number (OQ-4). [Source: epics.md:508-510]

> **BINDING — half of this AC is already satisfied by shipped code, and the other half's stated mechanism is never exercised.**
>
> **Canonical order is free and must not be re-implemented.** Every record already carries `match_id` in the three-digit padded form (`m001-mexico-south-africa` … `m104-spain-argentina`, 104/104, filename stem == `match_id` on 104/104), and lexicographic order over those stems **equals** numeric-ascending order — measured `True`. That padding was bought deliberately for exactly this AC (`contract/README.md` logged decision 1; `pipeline/ingest/identity.py:3-6`). A plain `sorted()` is the canonical order.
>
> **But you must consume the MANIFEST's `reports` list, not the directory listing.** `pipeline/ingest/batch.py:20-21` addresses this story by name — *"The manifest is the record of truth, not the directory listing: Story 1.15 must consume only the records this manifest names"* — and `pipeline/README.md:315-316` gives the reason: *"an orphan from a superseded run would otherwise enter the dataset as a phantom match."* `work/extracted/` may hold records no current PDF produced.
>
> **The stated resolution mechanism is corpus-vacuous — ship it as a standing assertion, never as a code path with a fixture.** Measured over 5,392 lineup entries — **this table is the single statement of the finding; the rest of the story refers back to it**:
>
> | OQ-4 ambiguous case (epic's words) | Corpus reality | What you build |
> |---|---|---|
> | accents | **0** of 1,247 distinct names carry any non-ASCII character. The full character inventory of every player name is `A-Z`, `a-z`, space, `-` (55 occurrences / 12 names), `.` (5 occurrences / 1 name: `Dayne ST. CLAIR`). **No apostrophe anywhere.** | Keep the NFKD→ASCII fold (required for the **three team names** `Curaçao`, `Türkiye`, `Côte d'Ivoire`), but **do not write a check asserting a non-zero accent-strip count** — it is 0 |
> | duplicate names | **0** collisions. 1,248 distinct `(team_id, normalized name)` keys == 1,248 distinct `(team, exact name)` pairs | An assertion that the count is 0, raising if it ever is not — **not** a first-seen-shirt tiebreak with a fixture pretending to exercise it |
> | squad-number changes | **0** players wear more than one shirt (distribution exactly `{1 shirt: 1248}`); **0** `(team, shirt)` pairs worn by two players; **0** duplicate `(side, shirt)` within a match | An assertion, as above |
>
> **Implement the first-seen-shirt tiebreak anyway** — AD-3 mandates it and a future corpus could exercise it — but the code path is dead on this corpus, so it must be reached by a **constructed** unit test, and no fixture may make it look corpus-real. Record in the Dev Agent Record that all three measured zero.
>
> **The one cross-team name repeat, for your test suite:** `Emiliano MARTINEZ` is **Argentina #23** (m019, m043, m070, m086, m095, m100, m102, m104) **and Uruguay #15** (m013, m037, m066). Two different people. Team is part of the key so this is not a collision — but drop the team code and `martinez-emiliano` becomes the corpus's **only** slug collision. Pin it with a test.

**2. And** every entity gets exactly one AD-3 ID/slug (match `m73-mexico-argentina`, team `mexico`, player `{surname}-{givenName}-{teamCode}`), referenced consistently by all per-match rows and aggregates. [Source: epics.md:511]

> **BINDING — this is the story's core deliverable, and two of the three ID kinds already exist.**
>
> **Do not re-mint match ids or team ids. Reuse the shipped functions.**
> - `pipeline.ingest.identity.team_slug(name) -> str` (`identity.py:52-69`) is the accent-stripping kebab slugger, already imported by six modules. Re-derived here: **48 teams → 48 slugs, 0 collisions.** **Your player slugger must be built on this same recipe**, not a reimplementation.
> - `team_id` is **already present in the records** at 25,764 of 26,180 team references, and `set(team_id) == set(team_slug(team names))` exactly. Only **416** references are display names needing conversion (`domains.match_metadata.teams.{home,away}` and its `metadata` duplicate).
> - `match_id` is already minted and validated at ingest (`identity.py:120-154`). The epic's example `m73-mexico-argentina` is **unpadded and fictional** — no Mexico-vs-Argentina match exists, and the real `m073` is `m073-south-africa-canada`. **The padding is already ruled** by `contract/README.md` logged decision 1 and enforced by the `^m[0-9]{3}-…` pattern. **Cite that decision; do not reopen it.**
> - **Never parse the match-id tail to recover home/away.** `m073-south-africa-canada` and `m052-bosnia-and-herzegovina-qatar` cannot be split by string rules — 9 of 48 team slugs contain a hyphen. Resolve teams from `domains.match_metadata.teams`.
>
> **`teamCode` has NO producer anywhere in the pipeline, and it is the trailing segment of every `PlayerId` — so it is on your critical path.** It exists only inside `report_id` (`PMSR-M01-MEX-V-RSA`, matching `^PMSR-M\d+-[A-Z0-9]+-V-[A-Z0-9]+$` on 104/104). Measured: **48 distinct codes ↔ 48 distinct teams, exactly 1:1** in both directions. **At least eight codes are not derivable from the printed name** — `KSA`, `CUW`, `CPV`, `RSA` (South Africa has no R), `ESP` (Spain has no E), `SUI` (Switzerland has no U), `MAR` (Morocco has no A), `COD` — which proves a lookup is mandatory. **Ruled: parse the pair out of `report_id`, assert the 1:1 mapping corpus-wide, and commit the resulting 48-row table into the slug registry** so a partial-corpus run still resolves a code instead of silently minting a two-segment player slug. *(Do not derive anything from `report_id`'s match number — it is 2-digit on 99 records and 3-digit on 5.)*
>
> **THE PLAYER SLUG RULE — ruled here, and validated against the committed fixtures rather than asserted.**
>
> No record carries surname and given name separately; `name` is one string. Case-signature over all 5,392 entries (`U` = all-caps token by `str.isupper()`, `u` = mixed):
>
> | signature | entries | example | what it means |
> |---|---|---|---|
> | `uU` | 4,191 | `Raul RANGEL` | given-first, caps surname |
> | `UU` | **707** | `GABRIEL MAGALHAES`, `ABDULLAH ALKHAIBARI` | all caps — boundary unknowable |
> | `uUU` | 168 | `Luc DE FOUGEROLLES`, `Dayne ST. CLAIR` | multi-token surname |
> | `U` | **107** | `ALISSON`, `MAURICIO`, `VOZINHA` | mononym — no split exists |
> | `uuU` | 81 | `Juan Jose CACERES` | multi-token given name |
> | `Uu` | **78** | `KIM Seunggyu`, `CASTROP Jens` | **surname FIRST** — all 26 Korea Republic players |
> | `uu` | **25** | `Weston McKENNIE`, `Scott McTOMINAY` | no all-caps token at all |
> | `UUU` / `uuUU` / `uUUU` / `uuuU` | 35 | `MOHAMMED ABU ALSHAMAT`, `Micky VAN DE VEN`, `El Hadji Malick DIOUF` | |
>
> **Ruled rule — the CAPS-RUN rule:** *the all-caps tokens are the surname, **wherever in the string they sit**; the remaining tokens are the given name in printed order; if there are no caps tokens, **or** no remainder, the name slugs **as listed**.* Then `kebab(surname)-kebab(given)-teamCode`, or `kebab(name)-teamCode` in the fallback. Task 3.3 gives the exact executable form — implement that, not this paraphrase.
>
> **The rule is validated, not asserted** — reproduce both in Task 1.4:
> - It reproduces **155 of 155** distinct player IDs across the committed `data/fixtures/matches/*.json` bundles — 96 in `players[].playerId` and 155 in `metadata.lineups.*[].playerId` — with **0 mismatches**. Those fixtures were hand-authored by Story 1.1 and signed off by Story 2.3, so they are the de-facto worked examples and the rule must not break them. **Walk the lineups, not just `players[]`**: `romero-gamarra-alejandro-par` (the 2-token-surname case) appears only in m074's `metadata.lineups.away.substitutes`.
> - Over the real corpus it yields **1,248 slugs for 1,248 distinct players — 0 collisions**, all passing `PlayerId`.
>
> **Uniqueness cannot discriminate between candidate rules — only the fixtures can.** Measured: the rejected last-token rule *also* yields 1,248 unique slugs with 0 collisions. A story that validated only on collision count would have shipped either rule. This is why Task 1.4's fixture reproduction is the acceptance check and the corpus count is not.
>
> **Worked examples**, all verified: `Raul RANGEL` → `rangel-raul-mex` · `KIM Seunggyu` → `kim-seunggyu-kor` · `ALISSON` → `alisson-bra` · `Alejandro ROMERO GAMARRA` → `romero-gamarra-alejandro-par` · `Juan Jose CACERES` → `caceres-juan-jose-par` · `Dayne ST. CLAIR` → `st-clair-dayne-can` · `GABRIEL MAGALHAES` → `gabriel-magalhaes-bra` (as-listed) · `Weston McKENNIE` → `weston-mckennie-usa` (as-listed).
>
> **The rule's known residual, declared not hidden: 856 entries / 219 distinct players slug in given-name-first order.** The `U`, `UU`, `UUU` and `uu` buckets take the as-listed fallback, so `abdallah-alfakhori-jor` sits beside `rangel-raul-mex` with the opposite component order. Every one is **unique, stable, deterministic** and passes the pattern — the cost is cosmetic ordering on a URL, not correctness. Fabricating a surname boundary inside `GABRIEL MAGALHAES` would be a guess, and AD-8 forbids guessing. **Every one is a candidate `OVERRIDES` entry (Task 4) if Juan wants a different slug; the mechanism exists precisely so this is a data edit, not a code change.** File the list (Task 7.3).
>
> **Contract patterns your IDs must satisfy** (`contract/common.schema.json:10-37`) — verified character-for-character:
>
> | `$def` | pattern |
> |---|---|
> | `TeamId` | `^[a-z0-9]+(-[a-z0-9]+)*$` |
> | `TeamCode` | `^[a-z]{3}$` |
> | `MatchId` | `^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$` |
> | `PlayerId` | `^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$` |
>
> Task 3.1 rules how to hold them — **two** constants, because the drift pin and the runtime gate need different forms. **`PlayerId` is a strict superset shape of `TeamId`**, so a player slug that lost its team code validates clean against the schema and produces a dead route; `test_fixtures.py:120-160` exists because that happened.
>
> **"Referenced consistently by all per-match rows" means all 25 name paths — 73,065 string occurrences.** Every one must gain an ID. The complete inventory, measured (nothing else in the corpus contains a player name; every value in these fields is a known lineup name, 0 unknowns):
>
> | count | path |
> |---|---|
> | 11,910 ×2 / 11,687 ×2 | `domains.pass_network.{home,away}.edges[].{from_name,to_name}` |
> | 2,571 | `domains.shots.shot_events[].player_name` |
> | 1,648 / 1,641 | `domains.player_stats.{away,home}[].name` |
> | 1,648 / 1,641 | `domains.pass_network.{away,home}.players[].name` |
> | 1,648 / 1,641 | `domains.crosses.cross_table_rows.{away,home}[].player_name` |
> | 1,648 / 1,641 | `domains.defensive_actions.regain_table_rows.{away,home}[].player_name` |
> | 1,648 / 1,641 | `domains.receiving.offers.{away,home}.table_rows[].player_name` |
> | 1,552 ×2 / 1,144 ×2 | `domains.match_metadata.lineups.{away,home}.{substitutes,starters}[].name` |
> | 520 ×2 | `domains.receiving.movement.{away,home}.top_ranked_players[].player_name` |
> | 108 / 107 | `domains.goalkeeping.{away,home}.goalkeepers[].name` |
> | 104 ×2 | `domains.receiving.offers.{away,home}.most_offers.player_name` |
>
> **23 of the 25 paths carry a `shirt_number` companion** (`from_shirt`/`to_shirt` on edges). **The two `receiving.offers.{side}.most_offers` paths carry none** — 208 occurrences, keys are `{player_name, position, value}` only — and must be resolved by verbatim name with no shirt corroboration available (Task 5.2). For the other 23, resolve on `(side, shirt_number)` and use the name as the **corroborating** key. That is the inverse of the extract-layer convention and is correct here for a reason: the extract layer had no cross-report anchor, and you do — `(team_id, shirt_number)` is globally unique on this corpus.
>
> **Three things you get for free and must not build:** goals (294), own-goals (14), cards (283), `substituted_on`/`substituted_off` (1,000 each) are **nested inside the owning lineup entry** and carry only a minute — resolving the entry resolves them. `set_plays`, `key_statistics`, `tactical_identity` and `momentum` carry **no player reference at all**. And `domains.goalkeeping.{side}.goalkeepers[]` (215 entries) duplicates name + shirt from Domain A — reconcile it to the **same** ID rather than resolving it independently.

**3. Given** the committed slug registry (override map in `pipeline/`) **When** a run would change a previously emitted ID (diffed against committed `/data`) **Then** the run fails unless a pinning entry exists — an ID, once emitted, never changes. [Source: epics.md:513-515]

> **BINDING — the story's load-bearing new deliverable, and its stated baseline does not exist yet.**
>
> **`data/matches/` does not exist.** `data/` contains only `data/fixtures/`. Inside `pipeline/` and `contract/` the single mention is prose at `contract/README.md:207`. **So "diffed against committed `/data`" has nothing to diff against on this run, and will have nothing until Story 1.16 emits.** Building only that check would ship a gate that cannot fail.
>
> **Ruled two-source design.** The registry is itself the immutability baseline from run one; the `/data` diff is a second source that engages the moment bundles exist:
> - **`PINS`** — the full minted set: every player, team and match id. A later run that would mint a *different* ID for the same key **fails loud**. This gives the AD-3 guarantee before `/data` exists.
> - **`OVERRIDES`** — the manual correction map AD-3 calls the "override map", applied **before** pinning. An override naming a key that resolves to nobody is itself a failure — a stale override is how a registry rots, silently.
> - **The `/data` diff** — when `data/matches/*.json` exists, read every `matchId`/`teamId`/`winnerTeamId`/`playerId`/`scorerPlayerId`/`fromPlayerId`/`toPlayerId` and assert set-containment against `PINS`. Absent `/data`, **print that the second source is unavailable; never treat "no baseline" as "passed"**.
>
> **The pin key is `(team_id, shirt_number)` — one form everywhere** (Task 4.1 fixes the serialization). AC 1's table, Task 3.4, Task 4.2 and the `identity-pinning` gate check all use exactly this key.
>
> **Registry format is RULED: a Python module, `pipeline/precompute/slug_registry.py`.** Not a style choice — `pipeline/ingest/fingerprint.py:35-39` carries an instruction addressed to this story by name:
> > *"AD-8 notes the code version 'includes the committed slug registry'. That registry is Story 1.15's artifact and does not exist yet. **It will only be picked up automatically if it is committed as Python** — a registry landing as `.json`, `.csv` or `.yaml` falls outside the source glob, and this module must be widened when 1.15 chooses its format."*
>
> A `.py` registry is fingerprinted by `code_version()` automatically, which is exactly what AD-8 requires. *(Recorded alternative: `.json` plus the one-line `EXTRA_FINGERPRINTED_FILES` widening at `fingerprint.py:58`. Rejected because it puts the AD-8 guarantee behind a step a future editor can forget, and the failure is silent.)*
>
> **The house precedent for how NOT to build the map:** `anchors[anchor.anchor_id] = …` (`extract_report.py:146` at `eec2397`) has no uniqueness check and silently overwrites; the duplicate-match-id handling at `batch.py:297-305` loses a collision fact from the manifest when three reports collide. Both are ledgered. **Assert uniqueness on insert, and name both colliding parties in the message.**

**4. Given** ambiguous cases (accents, duplicate names, squad-number changes) **When** resolution runs **Then** each is resolvable via a registry entry and the resolution is covered by pytest cases. [Source: epics.md:517-519]

> **BINDING (re-scoped by measurement — the three named cases are corpus-empty per AC 1's table; the mechanism is still built and still tested, against the ambiguity that actually exists).**
>
> | case | corpus count | test |
> |---|---|---|
> | accent in a player name | **0** | constructed unit test over the slug function (`Julián QUIÑONES` → `quinones-julian-mex`), plus the three real **team** names (`Curaçao`, `Türkiye`, `Côte d'Ivoire`), which are real and must be pinned |
> | duplicate normalized name within a team | **0** | constructed: two players, one team, same normalized name, different shirts → first-seen shirt wins, deterministic under either input order |
> | squad-number change | **0** | constructed: same player, two shirts across two matches → resolves to one ID |
> | **surname/given-name split** | **856 entries / 219 players take the as-listed fallback; 78 are surname-first; 707 all-caps** | **real corpus cases**, each pinned: `KIM Seunggyu`, `ALISSON`, `GABRIEL MAGALHAES`, `Weston McKENNIE`, `Alejandro ROMERO GAMARRA`, `Juan Jose CACERES`, `Dayne ST. CLAIR`, `Micky VAN DE VEN`, `El Hadji Malick DIOUF` |
> | **cross-team name repeat** | **1** (`Emiliano MARTINEZ`) | real, pinned — plus a test asserting the collision *does* occur when the team code is dropped |
> | **an `OVERRIDES` entry changes a slug** | n/a | constructed: override applied, pin follows the override, and an override naming a non-existent player fails loud |
>
> **Tautology is the failure mode here.** A test asserting `slug("Raul RANGEL") == "rangel-raul-mex"` and nothing else proves only that the function is the function. Derive expected values from the parsed corpus (the 1.10 rule, `1-10-…md:318`), and mutation-check per Task 8.3.

---

## Tasks / Subtasks

- [x] **Task 1: Re-derive the probe yourself before writing any resolution code** (no AC; do this first)
  - [x] 1.1 Measure your own baseline: run the suite (`pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`) and record pass/skip/fail **with attribution for every pre-existing failure**. Stories 1.9 (`in-progress`) and 1.14 (`review`) share this tree and **the tree is dirty** (see Coordination). Collection was **1,255** at story creation and **1,258** a few hours later — it drifts by design, so re-measure and do not treat a mismatch as a finding.
  - [x] 1.2 Write your own script (session scratchpad — `spike/` is read-only, AR-16) and re-derive **every pinned number** in Dev Notes → "Corpus sweep results". Record the figures verbatim in the Dev Agent Record. **Do not copy the tables forward unverified** (the 1.13/1.14 rule). If a number disagrees, your measurement wins and the disagreement is the finding.
  - [x] 1.3 Re-confirm the three corpus-empty negatives independently, because AC 4's re-scope rests on them: **0** non-ASCII characters in any player name, **0** normalized name+team collisions, **0** players with more than one shirt. If any is non-zero, **stop and escalate**.
  - [x] 1.4 Re-run the two validations of the caps-run rule: (a) it reproduces **155/155** distinct fixture player IDs — **walk `metadata.lineups.*[].playerId`, not only `players[].playerId`**, or the 2-token-surname case goes untested; (b) it yields **1,248 unique slugs for 1,248 players, 0 collisions**. **(a) is the acceptance check.** If (a) fails on even one ID, the rule is wrong and the fixtures are ground truth — **stop and escalate**.
  - [x] 1.5 Re-derive the `teamCode` table from `report_id` and assert the mapping is **1:1 in both directions over 48 teams and 48 codes**. A code serving two teams silently merges two squads into one namespace.
  - [x] 1.6 **Do not re-run the batch yet.** `code_version()` fingerprints all of `pipeline/**/*.py`, so every file Tasks 2–5 add re-invalidates all 104 records — a run now is discarded work. Confirm instead that `work/run-manifest.json` names 104 reports with 0 `failed` and 0 orphans, and record the current `code_version` prefix. The re-extract belongs at **Task 9.1, after the registry lands**.

- [x] **Task 2: `pipeline/precompute/` — the package** (AC: 1, 2)
  - [x] 2.1 Create `pipeline/precompute/__init__.py`. This is **the first module of AD-9's second phase** and the package docstring must say so: extract is per-report and pure; precompute is global, consumes all records in canonical order, and is the only phase that resolves identity. State that it takes **no `/contract` dependency** (AD-1) and that `work/` keys stay `snake_case`.
  - [x] 2.2 `pipeline/precompute/errors.py` — `PrecomputeError(PipelineError)` following the `ExtractError` shape exactly (`extract/errors.py:11-22`): a `what` **class attribute**, `__init__(reason, report_id=None)`, message `f"[{where}] {self.what}: {reason}"`. Typed subclasses, one per failure kind, **never overload and never a bare `ValueError`**: `PlayerSlugError`, `IdentityCollisionError`, `SlugRegistryError`, `SpineError`.
  - [x] 2.3 `pipeline/precompute/records.py` — `load_records(manifest_path, extracted_dir) -> list[dict]`, returning records in canonical order. Take entries whose `status` is `extracted` or `skipped-unchanged`; **read each entry's `record_path`, do not rebuild the path from `extracted_dir` + `match_id`** — the manifest names the file the run stands behind. Reuse `pipeline.ingest.records.read_record`.
    - **M19 and M58 ARE consumed. Ruled, not incidental.** Both carry `status: "extracted"` with `self_validation: "fail"`; the filter is on `status` **alone**. Their single failing check is `defensive-actions-marker-count`, which touches no lineup entry, no name path and no shirt number — the identity inputs are intact, and excluding them would drop two matches from the tournament over a source defect in an unrelated domain. **Never filter on `self_validation`.**
    - **`load_records` must NOT compare a record's `idempotence.code_version` to the live `code_version()`.** Committing `slug_registry.py` changes the live value by construction, so a precompute gating on it could never run after its own registry landed. Staleness is the *batch's* concern (`is_unchanged`), never precompute's. Say so in the docstring.
  - [x] 2.4 Reuse `pipeline.ingest.records.write_canonical` / `canonical_json` for every artifact this story writes — already documented as generic for *"any staging artifact"*. Do not hand-roll `json.dump`.
  - [x] 2.5 **`pipeline/precompute/run.py` — the CLI, following `pipeline/validate/verify.py` exactly.** Invoked `pipeline\venv\Scripts\python.exe -m pipeline.precompute.run`.

    | flag | meaning |
    |---|---|
    | `--manifest` | run manifest to consume (default `work/run-manifest.json`) |
    | `--extracted-dir` | where records are staged (default `work/extracted`) |
    | `--spine-dir` | where the spine is staged (default `work/spine`) |
    | `--data-dir` | committed bundles for AC 3's second source (default `data`) |
    | `--write-registry` | regenerate `slug_registry.py` instead of checking against it |
    | `--expect-records N` | assert the manifest names exactly N consumable records (use 104) |

    Exit codes match the house contract: `0` clean; `1` a pin would change / an override names nobody / a collision / an unresolved reference; `2` the harness could not run. **Print, never suppress, the "committed `/data` baseline unavailable" line.**

  **Public API, pinned (the `extract_domain_g` precedent — prior stories always pin the entry point):**
  - `pipeline.precompute.records.load_records(manifest_path, extracted_dir) -> list[dict]`
  - `pipeline.precompute.identity.team_codes(records) -> dict[str, str]`  (`team_id -> team_code`)
  - `pipeline.precompute.identity.player_slug(name: str, team_code: str) -> str`
  - `pipeline.precompute.identity.resolve_players(records, codes, registry) -> dict[tuple[str, int], str]`  (`(team_id, shirt_number) -> player_id`)
  - `pipeline.precompute.spine.build_spine(records, resolved, codes, rounds) -> dict`
  - `pipeline.precompute.spine.write_spine(spine, spine_dir) -> list[Path]`
  - `pipeline.precompute.slug_registry.{TEAM_CODES, PINS, OVERRIDES}`

- [x] **Task 3: Identity resolution** (AC: 1, 2)
  - [x] 3.1 `pipeline/precompute/identity.py`. Hold the patterns as **two** constants, because the drift pin and the runtime gate need different forms — the schema writes `$`, and a runtime gate must use `\Z`:
    ```python
    # Verbatim copies of contract/common.schema.json#/$defs — `$`, exactly as the schema
    # writes it. Only ever compared for equality; never compiled. (test_ingest_identity.py:147-159)
    SCHEMA_PATTERNS: dict[str, str] = {
        "TeamId":   r"^[a-z0-9]+(-[a-z0-9]+)*$",
        "TeamCode": r"^[a-z]{3}$",
        "MatchId":  r"^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$",
        "PlayerId": r"^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$",
    }
    # The runtime gates. `\Z`, not `$`: Python's `$` also matches before a trailing
    # newline, which ECMA-262 — the dialect JSON Schema mandates — rejects.
    # (test_fixtures.py:24-34; that defect shipped once already.)
    TEAM_ID_RE   = re.compile(SCHEMA_PATTERNS["TeamId"][:-1]   + r"\Z")
    TEAM_CODE_RE = re.compile(SCHEMA_PATTERNS["TeamCode"][:-1] + r"\Z")
    MATCH_ID_RE  = re.compile(SCHEMA_PATTERNS["MatchId"][:-1]  + r"\Z")
    PLAYER_ID_RE = re.compile(SCHEMA_PATTERNS["PlayerId"][:-1] + r"\Z")
    ```
    Do **not** `from pipeline.ingest.identity import MATCH_ID_RE` — the shipped one uses `$` and inherits the weaker form. **Import `team_slug` from `pipeline.ingest.identity`**; do not reimplement accent folding.
  - [x] 3.2 `team_codes(records) -> dict[str, str]` — parse `report_id` with an explicit `re.ASCII` pattern `^PMSR-M\d+-([A-Z0-9]+)-V-([A-Z0-9]+)$`, map each side's code to that side's `team_id`, assert 1:1 in both directions. A second code for a known team, or a second team for a known code → `IdentityCollisionError` naming both. Lowercase and assert `TEAM_CODE_RE`.
  - [x] 3.3 `player_slug(name, team_code) -> str` — the caps-run rule, exactly:
    ```python
    def _kebab(text: str) -> str:
        """team_slug's recipe applied to a name fragment. NOT team_slug itself:
        that one raises TeamSlugError, which is the wrong typed error here."""
        folded = unicodedata.normalize("NFKD", text)
        ascii_only = folded.encode("ascii", "ignore").decode("ascii").lower()
        return re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")

    def player_slug(name: str, team_code: str) -> str:
        tokens = name.split()                       # whitespace runs; no other separator
        caps = [t for t in tokens if t.isupper()]   # True for "ST.", False for "McKENNIE"
        rest = [t for t in tokens if not t.isupper()]
        if not caps or not rest:                    # mononym, all-caps, or no-caps -> as listed
            slug = f"{_kebab(name)}-{team_code}"
        else:
            slug = f"{_kebab(' '.join(caps))}-{_kebab(' '.join(rest))}-{team_code}"
        if not PLAYER_ID_RE.match(slug):
            raise PlayerSlugError(f"{name!r} with code {team_code!r} produced {slug!r}")
        return slug
    ```
    **Both branches append `-{team_code}`.** A two-segment slug validates clean as a `TeamId` and produces a dead route (`test_fixtures.py:120-160`).
    **Three points the corpus makes safe today but that must be stated, because a future corpus will not:** (a) caps tokens are a **filter over the token list, not a contiguous run** — measured 0 names with non-contiguous caps, so the two are indistinguishable here; the filter is the ruled form and it is what reproduces 155/155. (b) `str.isupper()` is `False` for a token with **no cased characters** (a bare `"2"`, a bare `"-"`), which would silently land in the given name; measured 0 such tokens. (c) `_kebab` collapses the hyphen, so `WAN-BISSAKA` → `wan-bissaka` and joining caps tokens with `" "`, `"-"` or `""` is indistinguishable — `" "` is the ruled form.
  - [x] 3.4 `resolve_players(records, codes, registry) -> dict[tuple[str, int], str]` — walk records in canonical order; key on **`(team_id, shirt_number)`**; mint the slug; apply `OVERRIDES` **before** pinning; assert the same key never resolves to two slugs and the same slug never serves two keys → `IdentityCollisionError` naming both parties, both shirts and both match ids. **First-seen wins** for the AD-3 tiebreak, which is what canonical order buys.
  - [x] 3.5 Carry the section name alongside every entry. **`has_minutes(entry, section)` cannot be answered by the entry dict alone** — starter-ness comes from the section it was read from (`domain_g.py:393-408`). Import `has_minutes` from `pipeline.extract.domain_g`; do not re-derive it.
  - [x] 3.6 Derive `matchday_round` with **`pipeline.discover.rounds.assign_matchday_rounds`** — it already implements the corpus-level rule and derives a group only when it holds all 6 fixtures. Reconstruct `ReportMeta` from the record's **top-level `metadata` block**, which is a near-exact serialization of the dataclass (`report_id`, `home_team`, `away_team`, `home_score`, `away_score`, `stage_text`, `group`, `match_date`, `kickoff`, `venue`, `shootout`, `probe_notes`); `match_date` needs `dt.date.fromisoformat()`.
    **This is the one place `metadata` is authoritative over `domains.match_metadata`**, and getting it wrong is fatal: `assign_matchday_rounds` needs `stage_text` (**absent** from `domains.match_metadata`), uppercase `group` (`domains` has `"a"`), and `kickoff` in `"H:MM"` form — `ReportMeta.kickoff_sort_key` does `int(kickoff.partition(":")[0])`, so the ISO form `"2026-06-11T13:00:00-06:00"` raises `ValueError` on the first sort. Everywhere else the Dev Notes rule stands.
    `assign_matchday_rounds` returns `(metas, problems)`; **any non-empty `problems` is a `PrecomputeError`, never a guess** — `matchdayRound` is `required` in both bundle schemas and its enum (`common.schema.json:51-64`) is exactly `rounds.ROUNDS`, so no mapping layer is needed.

- [x] **Task 4: The slug registry and the pinning check** (AC: 3)
  - [x] 4.1 `pipeline/precompute/slug_registry.py` — a Python module (ruled, AC 3) whose docstring states that it is fingerprinted by `code_version()` **because** it is Python, and that moving it to JSON requires the `EXTRA_FINGERPRINTED_FILES` widening at `fingerprint.py:58`. **The pin key is `(team_id, shirt_number)`**, serialized as `f"{team_id}#{shirt_number}"` so the module is a flat sorted literal a `git diff` reads cleanly:
    ```python
    TEAM_CODES: dict[str, str] = {"argentina": "arg", ...}          # team_id -> team_code, 48 entries
    PINS: dict[str, dict[str, str]] = {
        "players": {"argentina#23": "martinez-emiliano-arg", ...},  # f"{team_id}#{shirt}" -> player_id
        "teams":   {"argentina": "argentina", ...},                 # team_id -> team_id
        "matches": {"PMSR-M01-MEX-V-RSA": "m001-mexico-south-africa", ...},  # report_id -> match_id
    }
    OVERRIDES: dict[str, str] = {}                                  # f"{team_id}#{shirt}" -> player_id
    ```
    All four maps sorted by key. **`OVERRIDES` ships empty** — an empty override map is the correct state until Juan rules on Task 7.3's list. `team_id`, not `team_code`, is the key half because it is what every record already carries at 25,764 of 26,180 team references.
  - [x] 4.2 `check_pins(resolved, registry)` — every resolved ID whose key is already pinned must equal its pin, else `SlugRegistryError` naming the key, the pinned id and the newly minted one. A key **not** yet pinned is a new entity, normal on a growing corpus, and must not fail.
  - [x] 4.3 `check_overrides(resolved, registry)` — an override naming a key that resolves to nobody → `SlugRegistryError`.
  - [x] 4.4 `check_committed_data(pins, data_dir)` — when `data/matches/*.json` exists, read every `matchId`, `teamId`, `winnerTeamId`, `playerId`, `scorerPlayerId`, `fromPlayerId`, `toPlayerId` and assert set-containment against `PINS`. **When `data/matches/` is absent, print that the second source is unavailable — never return "passed".** Pin the absent-baseline branch with its own test.
  - [x] 4.5 The generated Python must be byte-identical across runs (sorted keys, fixed formatting, LF, trailing newline). Pin with a regenerate-and-compare `read_bytes()` test.
  - [x] 4.6 Commit the populated registry: 48 team codes, 48 team ids, 104 match ids, 1,248 player ids. **This is the act that makes the IDs immutable** — state the counts in your Completion Notes, and state that committing it changes `code_version()` and invalidates all 104 staged records (the fingerprint working as designed, not a defect).

- [x] **Task 5: The normalized spine** (AC: 2)
  - [x] 5.1 `pipeline/precompute/spine.py`. **The staged shape is RULED.** `work/` is `snake_case`; the camelCase mapping, `schemaVersion` stamping, budget and emission are all Story 1.16's. Model `entities.json` on the committed `data/fixtures/index/tournament.json` `entities` block, which is the shape 1.16 emits from:
    ```json
    {
      "spine_version": 1,
      "generated_by": "pipeline.precompute.spine",
      "code_version": "<code_version()>",
      "source_manifest": "work/run-manifest.json",
      "teams": [
        {"team_id": "mexico", "team_code": "mex", "name": "Mexico", "group": "a",
         "match_ids": ["m001-mexico-south-africa", "..."]}
      ],
      "players": [
        {"player_id": "rangel-raul-mex", "name": "Raul RANGEL", "team_id": "mexico",
         "team_code": "mex", "shirt_number": 1, "position": "gk",
         "match_ids": ["m001-mexico-south-africa"], "slug_source": "caps-run|as-listed|override"}
      ],
      "matches": [
        {"match_id": "m001-mexico-south-africa", "match_number": 1, "report_id": "PMSR-M01-MEX-V-RSA",
         "stage": "group", "group": "a", "matchday_round": "group-md1",
         "home_team_id": "mexico", "away_team_id": "south-africa",
         "venue": "Mexico City Stadium", "date": "2026-06-11",
         "kickoff": "2026-06-11T13:00:00-06:00",
         "score": {"home": 2, "away": 0, "shootout": null}}
      ]
    }
    ```
    `teams` sorted by `team_id`, `players` by `player_id`, `matches` by `match_id`. `slug_source` is diagnostic, not identity — it is what makes Task 7.3's filing a query rather than a re-derivation.
    `work/spine/matches/{match_id}.json` is **the Extraction Record's `domains` block, structurally unchanged, with an `*_id` field ADDED beside every name field**, plus a `spine` header `{"match_id", "report_id", "home_team_id", "away_team_id", "matchday_round"}`. No key removed, no list reordered, nothing deduped — a reader diffing a record against its spine file must see only additions.
  - [x] 5.2 Add ids at **all 25 name paths** and the **416** display-name team references. For the **23** shirt-bearing paths, resolve on `(side, shirt_number)` with the name as the corroborating key — a name disagreeing with the shirt's resolved player → `SpineError` naming both, with `repr()` on the name (the 1.10 landmine: a mis-inserted space breaks a join on a name that *looks* right). **For the two `receiving.offers.{side}.most_offers` paths — the only ones with no shirt — resolve on `(side, verbatim name)` against the lineup index for that match, exactly as the extract layer joins (`domain_g.py:411-478`).** Do not invent a shirt for it and do not skip it: it is a required 1.16 input.
  - [x] 5.3 **The spine ADDS ids; it never removes names.** `playerName` is `required` in eight `$defs` of `match-bundle.schema.json` (`ShotEvent`, `CrossEvent`, `PassNetworkNode`, `ReceivingEvent`, `DefensiveActionEvent`, `GoalkeeperRecord`, `PlayerRecord`, `ShootoutAttempt`) and every committed fixture row carries `playerId` **and** `playerName` side by side — a name-stripping spine cannot be emitted from. The exhaustiveness assertion is therefore the inverse: **walk the staged spine and assert every string value equal to a known player name has a resolved `*_player_id` sibling on the same object**, and every display team name a `team_id` sibling. An unresolved name → `SpineError` naming the JSON path. This is what makes the 25-path inventory self-maintaining: a path added by in-flight 1.9 or 1.14 fails loudly instead of passing through.
  - [x] 5.4 Preserve the nested references for free: goals, own-goals, cards and `substituted_on`/`substituted_off` live **inside** the lineup entry and carry only minutes. Do not restructure them. Reconcile `goalkeeping.{side}.goalkeepers[]` (215 entries) to the **same** player id.
  - [x] 5.5 Deterministic order everywhere (AD-8): entities sorted by id; per-match rows keep printed order; no dedup, ever.
  - [x] 5.6 **Out of scope, do not build:** the knockout score shape, `storyStats`, aggregation, leaderboards, profiles, budget measurement, camelCase mapping.
    **AC 2's "and aggregates" clause is explicitly deferred to Story 1.17.** No aggregate exists yet to reference an id, and building one here would smuggle 1.17's work into a story whose deliverable is the namespace. What 1.15 owes the clause is the guarantee that makes it cheap: **one id per entity, minted once, pinned.** State this in the Completion Notes so the deferral is a ruling, not an omission.
    Note for 1.16 in your filings that `domains.match_metadata.score.shootout` is an **unparsed prose string** on the 4 shootout matches — verbatim `'(Paraguay win 3-4 on Penalties)'` (m074), `'(Morocco win 2-3 on Penalties)'` (m075), `'(Egypt win 2-4 on Penalties)'` (m088), `'(Switzerland win 4-3 on Penalties)'` (m096) — and that `decidedBy` / `shootoutScore` need it decomposed.

- [x] **Task 6: FR-15 gate checks** (AC: 2, 3)
  - [x] 6.1 Two ids, ruled here: **`identity-completeness`** and **`identity-pinning`**. Register with `register_check` and **append** the docstring inventory entries at the reserved slot (`checks.py:81-82`, *"Later stories add, for example: 1.15 player identity resolution"*) — Story 1.10's review filed a patch for inserting out of registration order, so append, do not interleave.
    **Both checks are per-report by construction and neither reads a record or the spine.** Reuse `_domain_a_payload(doc, meta)` — never a ninth parse — and take both team codes from `meta.report_id` via the same pattern as Task 3.2, both team ids via `team_slug(meta.home_team/away_team)`.
    - `identity-completeness`: every lineup entry mints a slug passing `PLAYER_ID_RE`, no two entries on this report collide, and both `(team_id, code)` pairs agree with `TEAM_CODES`. Typed failure → `probe-failure` with `f"{type(exc).__name__}: {exc.reason}"`; an in-report collision → `count-mismatch`.
    - `identity-pinning`: for each entry look up `PINS["players"][f"{team_id}#{shirt}"]`; a pin differing from the minted slug → `count-mismatch` naming both. An **absent** pin is a new entity and emits nothing (Task 4.2's rule).
    **State plainly in both docstrings that the gate covers only the sampled reports.** The corpus-wide guarantee is `check_pins` inside the precompute CLI, not this gate — a reviewer reading "identity-pinning passed" as "all 104 pinned" is reading it wrong.
  - [x] 6.2 **Do not claim `offers-count-match`** — `test_checks_registry.py`'s deliberately unclaimed placeholder (`checks.py:67-69`); `register_check` raises on duplicates.
  - [x] 6.3 Resolve pages via `_domain_anchor_pages(doc, meta, …)`, never a hand-rolled `resolve_anchors` loop; reset the parse memo at the top of every gate test. **Deviation categories are frozen at four** — never add a fifth.
  - [x] 6.4 **Forced repair, guaranteed:** `test_runner.py:141-169` asserts the exact sorted `checks_run` literal; it goes from **27 to 29**, with the two new ids in sorted position between `goalkeeping-counts` and `marker-event-link-rate`. Do not tail-pin — 1.14's review flagged `ids[-3:]`-style assertions as breaking for the next appender.
  - [x] 6.5 **Self-Validation ids and gate ids are two different registries.** This story adds **no** Self-Validation check: those live inside per-report records and this story is corpus-level. If you find yourself adding one, you have put cross-report knowledge into the extract phase (AD-9).

- [x] **Task 7: File deferred work** (no AC)
  - [x] 7.1 Append a new section at the **end** of `deferred-work.md`: `## Filed by Story 1.15 implementation (cross-match identity resolution & normalized spine, YYYY-MM-DD)`. One bold-headline bullet per finding, each closing with a `Deferred:` reason and an explicit `Owner:`. **The ledger has no `DW-nn` ids** — do not invent one. Never delete or edit a prior entry.
  - [x] 7.2 **Close** the Story 1.10 filing this story resolves — the `PlayerRecord.playerId` scoping note (anchor phrase: *"identity that is stable *across* matches is Story 1.15's resolution"*). Strike its headline and append `— **RESOLVED by Story 1.15 (<date>): …**`, following the file's own convention.
  - [x] 7.3 File the **856 entries / 219 distinct players** that slug in as-listed order as an open item, **Owner: Juan / UX**, with the full list (query `slug_source` from the spine), because the fix is an `OVERRIDES` data edit and not a code change.
  - [x] 7.4 File for **Story 1.16**: the unparsed shootout prose (5.6); that `involvement` must come from the pass matrix, never Domain G (`pipeline/README.md:1195-1196`); and that `PassNetworkNode` nodes must be emitted **`null`, never `[]`** — 1.14's binding, which this story does not change.
  - [x] 7.5 **Cite by quoted anchor phrase, not line number.** Story 2.6's validation pass had to correct twelve `deferred-work.md` citations for a +12-line drift from concurrent sessions.

- [x] **Task 8: Tests** (AC: 1, 2, 3, 4)
  - [x] 8.1 Two new modules: `pipeline/tests/test_precompute_identity.py` (slug rule, team codes, resolution, collisions) and `pipeline/tests/test_precompute_spine.py` (registry, pinning, spine, determinism). Long sentence-like test names.
  - [x] 8.2 Every AC 4 row gets a test. **Write the `Emiliano MARTINEZ` cross-team test and the Korea Republic surname-first test first** — they are the two a plausible-but-wrong implementation passes everything else while failing.
  - [x] 8.3 **Mutation-check against the LAST-TOKEN rule, not trailing-caps.** Measured: a trailing-caps variant is **behaviourally identical** to the ruled rule on 5,392/5,392 entries (because `'Seunggyu'.isupper()` is `False`, `KIM Seunggyu` has no trailing caps run and takes the same fallback), so mutating to it proves nothing. The rule that genuinely differs is *"the last token is the surname"*: it differs on **1,009 entries** and inverts **all 26** Korea Republic players (`KIM Seunggyu` → `seunggyu-kim-kor`). Swap to it and assert the Korea Republic tests and the fixture-reproduction test go red. **Note that last-token also yields 1,248 unique slugs with 0 collisions** — so a collision-count assertion cannot detect the mutation, and only the fixture reproduction can.
  - [x] 8.4 **Two** pattern tests, not one. (a) drift: read `contract/common.schema.json` and assert `SCHEMA_PATTERNS[d] == schema["$defs"][d]["pattern"]` for all four. (b) dialect: assert each compiled RE **rejects** its own valid slug with a trailing `"\n"`, while `re.compile(SCHEMA_PATTERNS[d]).match(slug + "\n")` **accepts** it — which is precisely why the two constants differ.
  - [x] 8.5 Define `clean_registry` **locally** if any map is module-level mutable, following `test_checks_registry.py:20-25`, not in `conftest.py`.
  - [x] 8.6 Determinism: regenerate the registry and the spine twice; assert `read_bytes()` equality.
  - [x] 8.7 Assert the absent-`/data` branch of 4.4 explicitly, and assert it does **not** report success.
  - [x] 8.8 Do not build a fixture that makes any corpus-empty case look real. The constructed tests must be visibly constructed.

- [x] **Task 9: Verification** (no AC)
  - [x] 9.1 Full batch — **the command needs its flags; `--input-dir` is `required=True` and a bare invocation exits 2**:
    ```
    pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104
    ```
    **Assert the adjudicated baseline, not exit 0** — `extracted 104 / failed 0 / corpus_gaps 0 / orphan 0` with **exactly two** self-validation failures (`defensive-actions-marker-count` on `PMSR-M19-ARG-V-ALG` and `PMSR-M58-TUN-V-NED`), **exit 1 by design** (`pipeline/README.md:513-520`). A third failure re-opens the ruling; asserting exit 0 will make you "fix" a correctly-reported source defect.
  - [x] 9.2 Run `python -m pipeline.precompute.run --expect-records 104` twice; assert the staged spine and registry are byte-identical between runs, and that **104** records were consumed (so a future filter tightening cannot silently shrink the corpus).
  - [x] 9.3 FR-15 gate twice; both new ids in `checks_run`; two runs identical apart from `run_timestamp`.
  - [x] 9.4 Full suite green, with attribution for anything you did not cause.
  - [x] 9.5 Update `pipeline/README.md` (add the precompute phase, the CLI and the registry) and `sprint-status.yaml`. **Commit only this story's files. Never `git add -A`.** Commit directly to `main` (solo repo).

### Review Findings

Adversarial code review 2026-08-03 over `dd3dfc3..32fc131` (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Diffed from `dd3dfc3` rather than the frontmatter's `eec2397`, because Story 1.14's review patches landed in between and `dd3dfc3..HEAD` matches this story's File List exactly. 56 raw findings deduped to 38; 15 merged, 3 dismissed on verification. Every finding below was re-read against the code before rating — the reviewers' own severities were discarded.

**DECISION 1 — RULED: keep the raise, correct the documentation.** A tiebreak on a corpus measuring 0 name+team collisions can only ever fire on a defect, and quietly minting two ids out of one printed name is the unfalsifiable failure this package aborts to prevent — every id unique, every pattern satisfied, one route naming the wrong person. AC 1's BINDING block is the measurement-driven ruling and it wins; AC 4 rows 2–3 and Task 3.4 are re-scoped accordingly. Corrected in `identity.py`'s `resolve_players` docstring, `precompute/__init__.py`, `pipeline/README.md:1467`, and both test names (`..._is_broken_by_first_seen_shirt` → `..._raises_rather_than_tiebreaking`). The finding as filed: `resolve_players`' docstring says *"first seen wins … That is AD-3's tiebreak for two players who normalize to the same name within one team"* (`identity.py:256-258`), and the commit message, `__init__.py`, `pipeline/README.md` and two test **names** repeat it. The code does the opposite: two players on one team whose names mint one slug hit `by_slug` and raise `IdentityCollisionError` (`identity.py:298-310`). `test_CONSTRUCTED_a_duplicate_normalized_name_is_broken_by_first_seen_shirt` asserts `pytest.raises(IdentityCollisionError)`; so does `..._a_squad_number_change_across_matches_is_reported_not_merged`. AC 1's BINDING block demands exactly this raise (*"An assertion that the count is 0, raising if it ever is not — **not** a first-seen-shirt tiebreak"*), while AC 4 rows 2–3 and Task 3.4 demand the tiebreak (*"first-seen shirt wins"*, *"resolves to one ID"*, *"**First-seen wins** for the AD-3 tiebreak"*). Both cannot hold. Raising is the safer behaviour and is what shipped; what is not defensible is four documents and two test names asserting a mechanism that does not exist.

**DECISION 2 — RULED, then OVERTAKEN BY EVENTS; final state `done`.** Ruled: revert `1-9-…` to `in-progress`, because the board must describe committed reality and 1.9's `domain_e.py` (+602) was uncommitted. That was correct when ruled — `work/extracted/` was observed being re-staged by a concurrent batch mid-review (m048, m049, m056 rewritten between two precompute runs as 1.9's `involvement_clock` rename landed). **Story 1.9 then committed at `325dc2b` (2026-08-03 14:54:46), 14 seconds before this review's verification run began, and its story file is `Status: done`.** So the status is set to `done` here, matching 1.9's own file and its committed code.

**A real hazard surfaced by this, worth recording:** the `in-progress` value ended up committed by a *different* session — Story 2.9's `3cf4237`/`2018885` staged `sprint-status.yaml` from the working tree while this review's uncommitted edit sat in it. **An uncommitted edit to a shared-contention file is not private; a concurrent session's `git add` will carry it.** The story's Coordination section already names `sprint-status.yaml` as shared-contention and requires append-only edits; this is the mechanism by which a non-append edit escapes its author. The finding as filed: `32fc131` changes `sprint-status.yaml:232-233` from `1-9-…: in-progress` to `1-9-…: review`, but `pipeline/extract/domain_e.py` (+602 lines), `conftest.py`, `test_extract_domain_e.py` and `errors.py` remain dirty in the working tree. The commit message's `COMMIT SCOPE` note declares the `checks.py`/`README.md` seam contamination — it does **not** mention the status transition. The sprint board now says a story is ready for review when the code under review is not committed.

**DECISION 3 — RULED: refuse subset runs early and plainly.** Making `matchday_rounds` tolerant would stage a spine with `matchdayRound` missing or guessed, and that field is `required` by both bundle schemas — the failure would simply move into Story 1.16, later and further from its cause. Precompute is corpus-complete by construction and now says so: the error leads with "matchday rounds are not derivable for N of M record(s). Precompute runs over the COMPLETE corpus … a partial manifest cannot be precomputed", and points at `--expect-records` for an earlier, plainer failure. The finding as filed: `matchday_rounds` is called unconditionally (`run.py:136`) and `assign_matchday_rounds` emits a problem for every member of any group not holding all 6 fixtures; `identity.py:565` turns any non-empty `problems` into a `PrecomputeError`. A partial re-extract or a spike-sized corpus therefore dies with a wall of `group A holds 3 of 6 matches` rather than a record-count message, and `--expect-records` defaults to `None` so nothing catches it first. No test covers the group path — `make_record` hardcodes `"group": None, "stage_text": "Final - Match 104"`. Whether subset runs should be supported at all, or explicitly refused early, is a scoping call.

- [x] [Review][Patch] `identity-pinning` fires a false `count-mismatch` on every sampled report the moment a single `OVERRIDES` entry exists — the gate re-mints from the PDF and never consults `OVERRIDES`, while `resolve_players` applies it before pinning, so the pin is by definition not what the gate mints [pipeline/validate/checks.py:1873-1886]
- [x] [Review][Patch] An `OVERRIDES` value is never validated against `PlayerId` — the pattern gate runs inside `_player_slug_with_source` on the *derived* slug and the override replaces it afterwards; `check_overrides` validates only the key, so a malformed override is pinned, committed and staged into 104 spine files [pipeline/precompute/identity.py:296, :419-430]
- [x] [Review][Patch] Both new FR-15 gate checks ship with zero behavioural tests — only the `checks_run` id literal references them; nothing exercises the registry/report code disagreement, the in-report duplicate-slug branch, the `probe-failure` mapping or Task 4.2's absent-pin rule, against Task 6 and Task 8.1 [pipeline/validate/checks.py:1758-1897, pipeline/tests/test_runner.py:158-159]
- [x] [Review][Patch] `--write-registry` skips `check_pins` and `check_overrides` entirely and rewrites only the current run's pins, so regenerating over a shrunken corpus silently DELETES pins for absent entities — AD-3 immutability lost with no failure [pipeline/precompute/run.py:144-153]
- [x] [Review][Patch] A manifest naming zero consumable records prints `PRECOMPUTE RESULT: PASS`, stages an empty `entities.json`, and with `--write-registry` wipes the registry — `--expect-records` is the only guard and defaults to `None` [pipeline/precompute/run.py:125-133]
- [x] [Review][Patch] The documented exit-code contract is not implemented: every `load_records` failure maps to 2, so a genuine dataset finding (`manifest names match id … twice`) reads as "nothing was learned"; and `write_registry`/`write_spine` sit outside the `PipelineError` handler, so an unwritable staging directory — the docstring's own example of exit 2 — produces an uncaught `OSError` traceback instead [pipeline/precompute/run.py:110-117, :159-165, pipeline/precompute/records.py:95-99]
- [x] [Review][Patch] `run.main()` has zero tests — 173 lines covering three exit codes, the always-printed baseline note, the `--expect-records` gate and the write-vs-check branch, none of it verified; no test module imports `pipeline.precompute.run` [pipeline/precompute/run.py:100-169]
- [x] [Review][Patch] Task 4.5's byte-identity pin never covers the committed registry — both determinism tests render from a one-match synthetic corpus and compare two writes of the same text, so a change to `_kebab`/`team_slug` re-slugging hundreds of players passes the whole suite [pipeline/tests/test_precompute_spine.py:190-208]
- [x] [Review][Patch] The pinned four-argument `build_spine` emits `slug_source: null` for every player, and the API test pins that rather than flagging it — Task 5.1 requires `caps-run|as-listed|override` and Task 7.3's filing is defined as a query over it [pipeline/precompute/spine.py:286, :328, pipeline/tests/test_precompute_spine.py:527]
- [x] [Review][Patch] An override cannot rescue the one failure it exists to fix: `resolve_players` raises `PlayerSlugError` *before* the override lookup while `slug_sources` checks the override *first* — two functions, two orderings, one wrong [pipeline/precompute/identity.py:295-296 vs :337]
- [x] [Review][Patch] `write_registry` is not atomic despite its docstring's "atomically enough" — no temp file, no `os.replace`, while `pipeline/ingest/records.py:51` does it properly; an interrupted regeneration leaves an unparseable module that `checks.py` imports at load [pipeline/precompute/identity.py:662-675]
- [x] [Review][Patch] Untyped `KeyError`s leak from four call sites whose package rule is "one typed exception per failure kind" — `codes[team_id]` in `slug_sources` and `build_spine`, `resolved[(team_id, shirt)]` before `_match_index`'s typed guard, `rounds[match_id]`, and the unguarded `metadata[…]`/`mm[…]` reads; `run.py` catches only `PipelineError`, so each surfaces as a broken harness for what is a dataset finding [pipeline/precompute/identity.py:340, :550-559, pipeline/precompute/spine.py:306, :316, :342, :335-349]
- [x] [Review][Patch] `write_spine` never removes stale match files, so a second run over a shrunken corpus leaves orphan spine files behind — the exact phantom-match hazard `load_records` exists to prevent [pipeline/precompute/spine.py:370-378]
- [x] [Review][Patch] The team half of the exhaustiveness assertion is gated on `key in SIDES` in both the producer and the checker, so a display team name under any key other than literal `home`/`away` gets no `team_id` and raises nothing — the self-maintaining property holds only for player names [pipeline/precompute/spine.py:154, :261-267]
- [x] [Review][Patch] `_identity_team_context` does not gate the parsed code against `TEAM_CODE_RE` the way `team_codes` does, and `REPORT_ID_RE` accepts `[A-Z0-9]+`, so one malformed report id (`PMSR-M01-MEXX-V-RSA`) floods the localization histogram with ~52 identical `probe-failure` deviations [pipeline/validate/checks.py:1754 vs pipeline/precompute/identity.py:207]
- [x] [Review][Patch] `known_names` is accumulated corpus-wide and then applied to every match's spine — over-sensitive (any non-player string equal to one of 1,247 printed names raises on a sound record) and under-sensitive (a name path spelled differently from the lineup passes silently); the per-match lineup index `_match_index` already builds is the correct set [pipeline/precompute/spine.py:291, :355]
- [x] [Review][Patch] The relative-`record_path` fallback resolves to a nonexistent path — `Path(extracted_dir).parent / record_path` yields `work/work/extracted/…` for the `work/extracted/…` paths `batch.py:310` actually writes; the branch is reachable from any cwd but the repo root and both loader tests stage absolute paths, so it is never exercised [pipeline/precompute/records.py:103-104]
- [x] [Review][Patch] Manifest entries carrying a status outside `CONSUMABLE_STATUSES` are silently dropped, so matches can leave the corpus with only the optional `--expect-records` noticing [pipeline/precompute/records.py:76-80]
- [x] [Review][Patch] The acceptance check reads the team code out of the expected id (`player_id.rsplit("-", 1)[1]`), so it cannot detect a wrong `teamCode` — the component the story calls "on the critical path" and "not derivable"; separately `_fixture_player_ids` keys on `playerId`, so a second spelling of the same id's name is silently overwritten while the count stays 155 [pipeline/tests/test_precompute_identity.py:164-183, :215-218]
- [x] [Review][Patch] `test_CONSTRUCTED_resolution_is_deterministic_under_either_input_order` cannot fail — `resolve_players` returns `dict(sorted(...))` so equality is order-insensitive by construction, and both records carry the identical single entry, so first-seen has nothing to choose between [pipeline/tests/test_precompute_identity.py:507-518]
- [x] [Review][Patch] `test_the_spine_adds_ids_beside_every_name_and_removes_nothing` compares `(path, key)` sets only — no values, no list lengths, no ordering — so a future edit pruning the 43 all-zero pass-network nodes (explicitly forbidden) passes it unchanged, against the module docstring's "no list reordered, nothing deduped" [pipeline/tests/test_precompute_spine.py:342-365]
- [x] [Review][Patch] `entities.json` hardcodes `"source_manifest": "work/run-manifest.json"` while `--manifest` is a first-class flag and `build_spine` is never passed the path — Story 1.16 emits from this block [pipeline/precompute/spine.py:362]
- [x] [Review][Patch] The `clean_registry` fixture is defined with a docstring justifying it as load-bearing and is requested by zero tests, while `slug_registry.PINS`/`OVERRIDES` are module-level mutables imported directly by `checks.py` [pipeline/tests/test_precompute_spine.py:48-68]
- [x] [Review][Patch] AC 4 row 1's *real* half — the three accented team names `Curaçao`, `Türkiye`, `Côte d'Ivoire`, which the row says "are real and must be pinned" — has no assertion; they appear only inside a docstring [pipeline/tests/test_precompute_identity.py:480]
- [x] [Review][Patch] A `shirt_number` present but null or a string silently downgrades a shirt-bearing path to name-only resolution, skipping the name/shirt corroboration the 23-path rule exists for [pipeline/precompute/spine.py:177-178]
- [x] [Review][Patch] `bool` passes every `isinstance(shirt, int)` guard, so `True` aliases shirt 1 in the tuple key but pins as `team#True`; and the docstring's declared point (b) — an uncased token landing in the given name — is stated but not guarded, so `Raul RANGEL 7` would mint `rangel-raul-7-mex` and pass `PlayerId` [pipeline/precompute/identity.py:167-172, :288]
- [x] [Review][Patch] `check_committed_data` skips non-string id values, so a committed `playerId: null` or numeric is uncounted and the run reports "all pinned" [pipeline/precompute/identity.py:478]
- [x] [Review][Patch] `_check_identity_pinning` builds `pin_key(team_id, None)` for a non-integer shirt, the lookup misses, and the check passes vacuously [pipeline/validate/checks.py:1878-1881]
- [x] [Review][Patch] `REPORT_ID_RE` terminates with `$`, the exact laxity the module's own four ID gates use `\Z` to avoid [pipeline/precompute/identity.py:98]
- [x] [Review][Patch] Task 3.5's `has_minutes` import was never made though the task is marked `[x]` — the section is carried but `spine.py:333` is a no-op `_ = section` comment and nothing consumes it [pipeline/precompute/spine.py:333, pipeline/precompute/identity.py:236]
- [x] [Review][Patch] Task 7.1's per-entry format is not met and the File List miscounts: of the 8 appended `deferred-work.md` bullets, **3 carry no `Owner:` and 6 no `Deferred:` reason** (measured — the reviewer's 4/5 was wrong), while the File List declares 7 entries [_bmad-output/implementation-artifacts/deferred-work.md]
- [x] [Review][Patch] Task 7.3 filed per-team aggregates and a "queryable from the spine" pointer instead of the required full list of the 219 as-listed players, and the substitution is not recorded under "Deviations from the story" [_bmad-output/implementation-artifacts/deferred-work.md]
- [x] [Review][Patch] An object carrying both `name` and `player_name` would have its `player_id` silently overwritten by whichever `NAME_TO_ID_KEY` entry is applied last, with the exhaustiveness check still passing [pipeline/precompute/spine.py:139-150]
- [x] [Review][Patch] `_check_identity_completeness` skips the team-code agreement assertion entirely when a team is absent from the committed `TEAM_CODES`, rather than reporting the absence [pipeline/validate/checks.py:1799-1800]
- [x] [Review][Patch] The File List understates the commit: it describes `checks.py` and `pipeline/README.md` as carrying only this story's additions, omitting the ~6 lines of Story 1.9 goalkeeping-docstring text and ~50 lines of 1.9 README prose the commit message's `COMMIT SCOPE` note does declare [_bmad-output/implementation-artifacts/1-15-cross-match-identity-resolution-normalized-spine.md]

- [x] [Review][Defer] `pipeline/README.md` in this commit documents Story 1.9's involvement-clock work, including an eighth Self-Validation id `goalkeeping-involvement-clock` whose registering code (`pipeline/extract/domain_e.py`) is not committed [pipeline/README.md:1031-1108] — deferred: knowingly declared in the commit message's `COMMIT SCOPE` note as the lesser evil (omitting `checks.py` would have committed a 29-check registry against a file registering 27), and it resolves the moment Story 1.9 lands. **RESOLVED during this review: Story 1.9 committed at `325dc2b` (2026-08-03 14:54), registering the check in code. Ledger entry struck and closed.**

## Dev Notes

### Mental model (read this first)

Every prior Epic 1 story read a PDF. **This one reads none.** It is the first module of AD-9's second phase: a pure function from 104 Extraction Records to one resolved namespace. `pymupdf` appears in this story's production path only inside the two FR-15 gate checks, which are per-report by the gate's own contract.

Three things shape the work:

1. **Two-thirds of the ID minting is already built and shipped.** `team_slug`, `match_number_for` and `match_id_for` exist, are used by six modules, and are corpus-verified. Every record already carries its `match_id`. Writing a fresh slugger "for players" that quietly diverges from `team_slug`'s recipe is the easiest way to break the committed fixtures.
2. **The epic's stated hard part is empty, and the real hard part is unnamed.** See AC 1's table. Splitting `GABRIEL MAGALHAES` is the actual problem.
3. **The registry is the deliverable that outlives the code.** Once committed, AD-3's *"an ID once emitted never changes"* becomes true. Get the rule right before you pin 1,248 slugs.

The failure mode to guard against: this story is mostly plumbing, and plumbing invites confidence. But a wrong slug rule is **unfalsifiable downstream** — every ID unique, every ID matching the pattern, every route resolving, and the only symptom is that `/players/seunggyu-kim-kor` names the wrong half of a person. **Two different candidate rules both produce 1,248 collision-free slugs**, so no aggregate check can tell them apart. That is why Task 1.4's fixture reproduction is the proof.

### Scoping probe already performed (2026-08-03) — the premise re-scope

Run over all 104 Extraction Records in `work/extracted/`, i.e. exactly the input your precompute will receive. **Re-derive every number below (Task 1); do not copy it forward unverified.**

#### Identity inputs — what the corpus actually contains

| Measurement | Result |
|---|---|
| Extraction Records | **104**, filename stem == `match_id` on **104/104** |
| `match_id` zero padding | 3 digits on **104/104**; lexicographic order **==** numeric order |
| Distinct teams | **48**, appearing 208 times |
| Team slug collisions | **0** (48 → 48) |
| Team slugs containing a hyphen | **9** — `bosnia-and-herzegovina`, `cabo-verde`, `congo-dr`, `cote-d-ivoire`, `ir-iran`, `korea-republic`, `new-zealand`, `saudi-arabia`, `south-africa` |
| Team names needing more than lowercasing | **3** — `Curaçao`, `Türkiye`, `Côte d'Ivoire` |
| `report_id` → team codes | **48 codes ↔ 48 teams, exactly 1:1** in both directions |
| Codes not derivable from the printed name | **≥8** — `KSA`, `CUW`, `CPV`, `RSA`, `ESP`, `SUI`, `MAR`, `COD` |
| Lineup entries | **5,392** (2,288 starters + 3,104 substitutes); starters exactly 11 on 208/208 |
| Distinct players | **1,248** = 48 teams × exactly 26 |
| **Non-ASCII characters in player names** | **0** of 1,247 distinct names, 0 of 5,392 entries |
| Full character inventory of player names | **55 chars**: `A-Z`, `a-z`, space, `-` (55 occurrences / 12 names), `.` (5 / 1 name) — **no apostrophe** |
| **Normalized name+team collisions** | **0** |
| **Players wearing >1 shirt number** | **0** |
| `(team, shirt)` pairs worn by 2 players | **0** — so `(team_id, shirt_number)` is a globally unique key |
| Names appearing on 2 teams | **1** — `Emiliano MARTINEZ` (ARG #23, URU #15) |
| Per-player match counts | min 1, median 4.0, max 8 |
| Player-name string occurrences | **73,065** across **25** JSON paths (**23** carry a shirt companion) |
| Team references | **26,180** across 11 paths — only **416** are display names |

#### The slug rule — measured, with the losing alternative named correctly

| Rule | Fixture IDs reproduced | Corpus slugs | Differs from ruled rule |
|---|---|---|---|
| **Caps-run (ruled)** | **155 / 155, 0 mismatches** | **1,248 / 1,248, 0 collisions** | — |
| Trailing-caps | identical | identical | **0 / 5,392 — behaviourally the same rule on this corpus** |
| Last-token (rejected) | not run | 1,248 / 1,248, 0 collisions | **1,009 entries; inverts all 26 Korea Republic players** |

**Read that table carefully.** Collision count does not discriminate between the ruled rule and the rejected one — both are perfect. Only the fixture reproduction does. And "trailing caps" is not a distinct rule at all here: `'Seunggyu'.isupper()` is `False`, so `KIM Seunggyu` has no trailing caps run and falls through to the same as-listed branch. The caps-run form is preferred for **explicitness**, not for different corpus behaviour.

#### Cross-domain reconciliation — confirmed, with one inherited claim corrected

| Measurement | Result |
|---|---|
| Lineup entries | **5,392** = 3,288 with minutes + 2,104 without |
| Domain G rows | **3,289** |
| Pass-network node rows | **3,289** — the identical player set |
| Domain G rows not in that match's lineup | **0** |
| Pass-network endpoints not in lineup | **0** |
| Lineup entries with no Domain G / pass-network row | **2,103** (unused substitutes — correct, not a finding) |
| Reconciliation | **3,289 + 2,103 = 5,392**, zero orphans in either direction |

**M92 Jordan HENDERSON — a singleton in exactly one sense, and not in another.** He **is** the unique lineup entry that fails `has_minutes` yet carries a Domain G row (measured 1 of 1 across all 104 records); `domain_g.py:399-406` special-cases him with an all-zero-orphan admission and **that must not be removed**. He is **not** a pass-network anomaly: his node is one of **43** all-zero pass-network nodes corpus-wide (others include `m011` #19 Brian BROBBEY, `m088` #1 Mathew RYAN — a goalkeeper — and `m102` #15 Dan BURN), and the orphan count is 0 in every direction. **Do not prune all-zero nodes**; they must survive identity resolution.

#### Match metadata — already clean, nothing to normalize

| Field | Result |
|---|---|
| `stage` | maps to the ruled enum **perfectly** — `group` 72, `r32` 16, `r16` 8, `qf` 4, `sf` 2, `third-place` 1, `final` 1; 0 unmapped, 0 unused |
| `group` | `a`…`l`, 6 matches each = 72; `null` on all 32 knockout matches; non-null **iff** stage is `group` |
| `kickoff` | **104/104** full ISO 8601 with UTC offset — AD-7 already satisfied; no venue has two offsets, so no DST straddle |
| `venue` | **16** distinct, all kebab-unique, 0 collisions |
| `score.shootout` | **4** matches, an **unparsed prose string** — 1.16's problem, filed not built |

Use the `domains.match_metadata` copies, not the `metadata` ones — `metadata.kickoff` is time-only with no offset. **The one exception is Task 3.6's matchday-round derivation**, where `metadata` is authoritative and `domains.match_metadata` will crash the sort.

### What already exists — do not reinvent any of this

| Need | Already shipped | Where |
|---|---|---|
| Accent-stripping kebab slugger | `team_slug(name)`; raises `TeamSlugError` on empty | `pipeline/ingest/identity.py:52-69` |
| Match id, match number | `match_id_for`, `match_number_for`; already on every record | `pipeline/ingest/identity.py:82-154` |
| Canonical-order guarantee | three-digit padding, bought for this AC | `identity.py:3-6`, `contract/README.md` decision 1 |
| Record loading, canonical write | `read_record`, `record_path`, `write_canonical`, `canonical_json` | `pipeline/ingest/records.py:41-110` |
| "Did this player take the field" | `has_minutes(entry, section)` — **needs the section** | `pipeline/extract/domain_g.py:393-408` |
| Matchday-round derivation | `assign_matchday_rounds`, complete-group-only | `pipeline/discover/rounds.py` |
| CLI shape, exit codes | argparse, `0/1/2` | `pipeline/validate/verify.py` |
| Gate check registration, deviations | `register_check`, the four frozen categories | `checks.py:144-166`, `deviations.py:18-32` |
| The entity shape 1.16 emits from | `entities: {matches, players, teams}` | `data/fixtures/index/tournament.json` |

**And one function you must NOT reuse:** `pipeline/discover/text.py:27-42`'s `normalize()` is a **page-text** normalizer. Its own docstring: *"Nothing semantic is collapsed: no case folding, no accent stripping."* It is pinned by tests asserting `normalize("Türkiye") != normalize("Turkiye")`, and it passes zero-width spaces, soft hyphens and ligatures straight through. Using it for identity would be a silent, corpus-invisible defect.

### Contract reality — read before coding

`/contract` is **READ-ONLY**. Current `schemaVersion` is **2**.

- The four ID patterns are the shapes you must satisfy. `PlayerId` enforces *shape* only — it does not enforce that the last segment is a real team code, nor the `{surname}-{givenName}` composition. That composition lives only in the schema `description` and in AD-3 prose.
- `LineupEntry`'s description is binding: *"`playerId` is mandatory on every entry — EXPERIENCE.md links each lineup name to its Player Profile."*
- `playerName` is **`required`** in eight `$defs` — the spine adds ids beside names, never instead of them (Task 5.3).
- `matchdayRound` is **required** in `match-bundle.schema.json:222` and `tournament.schema.json:53`, and no extractor produces it (Task 3.6). Its enum (`common.schema.json:51-64`) is exactly `rounds.ROUNDS`, so no mapping layer is needed.
- There is **no `$comment` anywhere in the contract about identity, slugs or resolution.** The resolution algorithm exists only at `ARCHITECTURE-SPINE.md:62`.
- `EntityRef.id` uses the **loose** team pattern for teams, players *and* matches, so the schema layer cannot tell a malformed player slug from a valid team slug. That gap is covered only at the test layer (`test_fixtures.py:120-160`), and it exists because `son-heungmin` without its team code once validated clean and produced a dead route.

### Failure & validation policy (AD-8, binding)

- **Assert-on-unknown everywhere.** A name producing no slug, a slug failing its pattern, two players resolving to one id, a team with two codes, a pinned id that would change, an override naming nobody, a name that does not resolve → **loud**, typed, with the offending values in `repr()`.
- **One typed exception per failure kind.** Never overload, never a bare `ValueError`.
- **This story is corpus-level, so a failure is not per-report-recoverable in the AD-8 sense.** A collision is a defect in the dataset or the rule, and precompute must abort rather than emit a half-resolved namespace. Say so in the package docstring.
- **Deterministic output:** canonical serialization, no timestamps, no absolute paths, byte-identical re-runs.

### Testing standards summary

pytest only (AR-16). Run `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests` from the repo root — a bare `python -m pytest` fails on `pymupdf`. There is no `pytest.ini`/`pyproject.toml`; configuration is conventional. `spike/mex_rsa.pdf` is permanent ground truth and read-only. Probe scripts go to the session scratchpad, never the repo. Derive expected values from parsed data, never restate the implementation.

**Regression sweep, already done — do not re-derive it.** Only `test_runner.py::test_checks_run_are_recorded` breaks (exact 27-id list → 29). **No other test breaks:** `test_checks_registry.py` uses set-containment and sortedness, with negative prefix assertions on `offers-`/`movement-` only; `test_extract_report_domain_a.py:159` and `test_extract_report_domain_g.py:256` use `<=`; `test_workspace.py` imports named subpackages, not an exhaustive list. **No test pins a `code_version` literal or a record hash** — `test_ingest_fingerprint.py` builds throwaway trees and asserts self-consistency. So adding `pipeline/precompute/*.py` and committing a `.py` registry **breaks nothing in the suite**; the only consequence is a full 104-report re-extract (~2 min).

### Coordination — in-flight stories (respect strictly)

**The working tree is NOT clean, contrary to the story brief.** At story creation `HEAD` is **`eec2397`** (not `7f9b959`), and the tree carried **1,551 uncommitted insertions across 12 files**, growing to ~1,750 across 13 within hours — `pipeline/extract/domain_e.py` (+602), `conftest.py` (+240), `test_extract_domain_e.py` (+272), plus `errors.py`, `pass_network.py`, `extract_report.py`, `checks.py`, `README.md` and the pass-network test modules. **Re-measure the tree state yourself before you start and record what you found.**

- **Story 1.9 is `in-progress`** with Decision 3 / Task 3.11 ruled but unimplemented — the involvement slot → match-clock mapping, blocked on an extra-time tick collision (`'90+5'` and `'95'` both land on slot m46+49). `domains.goalkeeping.involvement_series` may gain clock structure while you work. **Your spine must not depend on the shape of any goalkeeping payload beyond `goalkeepers[]`**, the only part you touch.
- **Story 1.14 is `review`** — 19 review patches, all applied, status still `review`. `domains.pass_network` supplies 47,194 of your 73,065 name occurrences, so its shape is your largest single input. Do not edit `pass_network.py`.
- **Story 1.16 is BLOCKED pending CS-1** and must not be assumed to exist. Hand it filings, not calls.
- **CS-1 must not land while this story is in flight** — a `schemaVersion` bump re-pins fixtures and regenerates app types. If Juan wants CS-1 landed, coordinate the order.
- **Shared-contention files** — `pipeline/validate/checks.py`, `pipeline/tests/test_runner.py`, `pipeline/README.md`, `deferred-work.md`, `sprint-status.yaml`: every edit **additive / append-only**, never reorder existing entries.
- **Off-limits (no writes):** `/contract`, `/data`, `app/`, `spike/`, `pipeline/markers/`, `pipeline/extract/`, `pipeline/discover/`, `pipeline/ingest/`. `/data` and `data/fixtures/` are **read-only, not untouchable** — Task 4.4 reads `data/matches/*.json` and Task 1.4 reads the fixtures.
- `code_version()` fingerprints all of `pipeline/**/*.py`, so while another session saves files here every batch run invalidates all 104 records and long test runs can flake. Measure your own baseline and state it.

### Known landmines (live risks for this story)

1. **Writing a fresh player slugger that diverges from `team_slug`'s recipe.** The fixtures are the ground truth. Task 1.4 catches it; nothing else will.
2. **Validating the slug rule on collision count.** Two different rules both give 1,248/1,248. Only the fixture reproduction discriminates.
3. **Reading `work/extracted/` directly instead of the manifest.** Addressed to this story by name. An orphan becomes a phantom match.
4. **Shipping a registry as `.json` without widening `EXTRA_FINGERPRINTED_FILES`.** The AD-8 idempotence guarantee silently stops covering the registry.
5. **A pinning check with no baseline that reports success.** `data/matches/` does not exist; a naive `if not exists: return []` is a gate that cannot fail.
6. **Stripping names from the spine.** `playerName` is required in eight `$defs`; the spine adds, never replaces.
7. **Using `domains.match_metadata` for the matchday-round derivation.** It has no `stage_text`, lowercase `group`, and an ISO `kickoff` that raises `ValueError` in `kickoff_sort_key`.
8. **Assuming all 25 name paths carry a shirt.** `most_offers` does not.
9. **Filtering records on `self_validation`.** M19 and M58 are consumed.
10. **Building fixtures for the three corpus-empty OQ-4 cases** so they look exercised. They measure zero; say so.
11. **Tail-pinning assertions** (`ids[-2:]`, `warnings[-1]`) — flagged by 1.14's review.
12. **`offers-count-match`** — the reserved placeholder id. `register_check` raises on duplicates.
13. **Asserting the batch exits 0**, or running it without `--input-dir` (exits 2). The baseline is 104/0/2, exit 1.
14. **Removing `domain_g.py`'s all-zero-orphan admission** because "Henderson is one of 43". He is one of 43 *all-zero pass-network nodes*, but 1 of 1 no-minutes Domain G rows.

### Project Structure Notes

New: `pipeline/precompute/__init__.py`, `errors.py`, `identity.py`, `records.py`, `spine.py`, `slug_registry.py`, `run.py`; `pipeline/tests/test_precompute_identity.py`, `test_precompute_spine.py`.
Modified (additive / append-only): `pipeline/validate/checks.py`, `pipeline/tests/test_runner.py`, `pipeline/README.md`, `deferred-work.md`, `sprint-status.yaml`.
Staged output (`work/` is already gitignored — no `.gitignore` change needed): `work/spine/entities.json`, `work/spine/matches/{match_id}.json`.
Read-only inputs: `data/fixtures/`, `data/matches/` (when it exists), `contract/common.schema.json`.
Unchanged by design: `/contract`, `app/`, `spike/`, `pipeline/markers/`, `pipeline/extract/`, `pipeline/discover/`, `pipeline/ingest/`.

### References

- [Source: epics.md:508-519] — Story 1.15's three Given/When/Then blocks, reproduced above
- [Source: ARCHITECTURE-SPINE.md:58-62] — **AD-3**, the full resolution algorithm and the slug registry rule; the only place it exists
- [Source: ARCHITECTURE-SPINE.md:88-92] — AD-8, incl. *"code version — which includes the committed slug registry"*; [:94-98] AD-9's two-phase split; [:82-86] AD-7; [:124-128] AD-14
- [Source: ARCHITECTURE-SPINE.md:178] — the Structural Seed's `precompute/ # identity resolution (slug registry), normalization, aggregation, emit`
- [Source: contract/common.schema.json:10-37] — the four ID patterns; [:51-64] the `MatchdayRound` enum
- [Source: contract/README.md] — logged decision 1, "Match IDs are zero-padded to three digits"; the Story 2.3 sign-off (*"Epic 1 extraction past the AD-8 sample set (stories 1.7–1.15) is unblocked"*)
- [Source: contract/match-bundle.schema.json:222] and [tournament.schema.json:53] — `matchdayRound` is required
- [Source: pipeline/ingest/identity.py:1-18, 29-35, 52-69, 82-154] — the shipped slugger, the restate-and-pin precedent, and *"Player identity, the committed slug registry and the cross-match spine are Story 1.15's"*
- [Source: pipeline/ingest/fingerprint.py:35-39, 57-58] — the registry-format instruction addressed to this story
- [Source: pipeline/ingest/batch.py:20-21] — consume the manifest, not the directory listing; [:297-305] the lossy duplicate-match-id handling
- [Source: pipeline/ingest/records.py:41-110] — canonical write and record loading
- [Source: pipeline/ingest/extract_report.py:146] — the `anchors[…] = …` overwrite precedent (line 148 in the dirty tree)
- [Source: pipeline/extract/domain_g.py:393-408, 399-406, 411-478] — `has_minutes`, the Henderson admission, and the verbatim-name join this story generalizes
- [Source: pipeline/discover/rounds.py:1-34] — the matchday-round rule and its complete-group precondition
- [Source: pipeline/discover/text.py:27-42] — the normalizer that must **not** be used for identity
- [Source: pipeline/validate/verify.py] — the CLI shape and exit-code contract Task 2.5 copies
- [Source: pipeline/validate/checks.py:67-69, 81-82, 144-166] — the reserved placeholder, the reserved 1.15 docstring slot, the registry
- [Source: pipeline/README.md:90] — the batch invocation; [:118-128] staging conventions; [:315-316] the phantom-match rule; [:513-520] the ruled batch baseline; [:718-719] the section rule; [:1195-1196] the `involvement` directive
- [Source: pipeline/tests/test_fixtures.py:24-34] — the `\Z` rationale; [:120-160] the player-vs-team slug distinction
- [Source: pipeline/tests/test_runner.py:141-169] — the exact 27-id `checks_run` literal
- [Source: data/fixtures/README.md:7-10] — the fixtures are hand-authored committed artifacts, not build output
- [Source: data/fixtures/index/tournament.json] — the `entities` shape Task 5.1 models and 1.16 emits from
- [Source: deferred-work.md] — the 1.10 filing this story closes (anchor: *"identity that is stable *across* matches is Story 1.15's resolution"*); the re-extract prerequisite (*"the batch is re-run before Story 1.15 begins consuming records"*); the ruled baseline (*"The clean-run baseline is `extracted 104 / failed 0 / self-validation-failed 2`"*); the 1.14 edge filing (*"once Story 1.15 mints the player ids"*); the CS-1 coordination clause
- [Source: 1-10-…md:318] — derive expected values, never hardcode; [:414-424] the corrected reconciliation arithmetic
- [Source: 1-14-…md:33, 296-305, 324-325] — the verbatim-name join, the probe table, and the `PassNetworkEdge` fulfillability note
- [Source: EXPERIENCE.md:31-39] — the route table and the slug contract the App depends on

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context) — BMad `dev-story` workflow.

### Debug Log References

- Task 1 probe scripts: session scratchpad only, never the repo (AR-16). Two scripts — a
  full corpus sweep over all 104 Extraction Records, and a separate fixture-reproduction
  script that walks both `players[]` and `metadata.lineups.*[]`.
- Baseline suite run started before any edit, so its module imports predate every change
  in this story; see "Suite baseline" below for the attribution.

### Completion Notes List

#### Task 1 — every pinned number re-derived, and three disagreements found

Re-measured independently over all 104 records rather than copied forward. **Every
load-bearing figure in the Dev Notes reproduced exactly:** 104 records with filename stem
== `match_id` on 104/104; three-digit padding on 104/104 with lexicographic order proven
equal to numeric order; 48 teams → 48 slugs, 0 collisions; the 9 hyphenated slugs and the
3 names needing more than lowercasing, item for item; 48 codes ↔ 48 teams exactly 1:1;
5,392 lineup entries (2,288 starters + 3,104 substitutes) with exactly 11 starters on
208/208 team-innings; 1,248 distinct players = 48 × 26; 1,247 distinct names; 73,065
player-name occurrences across 25 paths; 25,764 `team_id` references; the full case-signature
table (4,191 / 707 / 168 / 107 / 81 / 78 / 25, plus 35 in the four long tails); 219
as-listed players / 856 entries; the reconciliation 3,288 with minutes + 2,104 without =
5,392, against 3,289 Domain G rows and 3,289 pass-network node rows; 16 venues; the stage
distribution 72/16/8/4/2/1/1; and the four shootout prose strings verbatim.

**Task 1.3 — all three corpus-empty negatives independently confirmed**, which is what AC
4's re-scope rests on: **0** non-ASCII characters in any of 1,247 distinct player names (the
full inventory is 55 characters: `A-Z`, `a-z`, space, 55 hyphens across 12 names, and 5
periods in the single name `Dayne ST. CLAIR` — **no apostrophe anywhere**); **0** normalized
name+team collisions (1,248 keys == 1,248 exact pairs); **0** players wearing more than one
shirt (distribution exactly `{1: 1248}`), **0** `(team, shirt)` pairs worn by two players,
and **0** duplicate `(match, side, shirt)`.

**Task 1.4 — THE ACCEPTANCE CHECK PASSES: 155 / 155 fixture player ids reproduced, 0
mismatches.** The story's warning about the walk is exactly right and was hit live: a first
pass keyed on objects carrying both `playerId` and `playerName` found only **96** ids,
because fixture *lineup* entries key the name as `name`, not `playerName`. Walking
`metadata.lineups.*[]` as well yields 155, of which **59 are unreachable from `players[]`** —
including `romero-gamarra-alejandro-par`, which exists in exactly one place in the whole
fixture set (`m074` `metadata.lineups.away.substitutes`). Corpus-wide the rule yields 1,248
slugs for 1,248 players, 0 collisions, all passing `PlayerId`.

The discrimination claim was re-verified rather than assumed: the rejected **last-token**
rule also yields 1,248 unique collision-free slugs, differs on **1,009 entries**, inverts
**26/26** Korea Republic players, and fails the fixture reproduction on **27** ids. The
**trailing-caps** variant differs on **0 / 5,392** — behaviourally the same rule here, so it
is useless as a mutation target, exactly as the story states.

**Three disagreements with the Dev Notes. My measurement wins in each; none changes a ruling.**

1. **"At least eight team codes are not derivable" — the count is 6 by the story's own test,
   and two of its named examples are wrong.** Six codes carry a letter absent from their
   team's slug: `cpv`, `cuw`, `mar`, `ksa`, `esp`, `sui`. The parentheticals "(South Africa
   has no R)" and `COD` are factually false — South Africa contains an `r`; Congo DR contains
   `c`, `o` and `d`. **The ruling is unaffected and over-determined:** no first-three-letters
   rule produces `rsa` (`sou`) or `cod` (`con`) either, so a committed lookup is still
   mandatory. Both halves are now pinned by a test so neither claim can drift back.
2. **The 416 display-name figure is right, but only when the top-level `metadata` block is
   counted.** Scanning `domains` alone gives 25,764 `team_id` + **208** display names.
   Adding `metadata.{home_team,away_team}` gives 416, and 25,764 + 416 = **26,180** exactly
   as stated. Worth stating precisely because the per-match spine mirrors `domains`, so only
   208 of the 416 are inside the artifact this story writes.
3. **The record's `metadata` block is NOT the near-exact `ReportMeta` serialization the Dev
   Notes describe.** It carries **no `report_id`** and **no `source_path`**, and carries an
   extra `match_number`. Since the matchday-round derivation is the one place `metadata` is
   authoritative, this is on the critical path: `report_id` is taken from the record's top
   level and `source_path` from `source_pdf`. Filed to the ledger.

**Task 1.6** — the batch was deliberately NOT re-run before the registry landed. Confirmed
instead from the manifest: 104 reports, `extracted 0 / skipped-unchanged 104 / failed 0`,
`corpus_gaps` 0, `orphan_record_paths` 0, and exactly the two ruled self-validation failures
(`PMSR-M19-ARG-V-ALG`, `PMSR-M58-TUN-V-NED`, both `defensive-actions-marker-count`).
`code_version` at that point: `f417cd0d9a78d097…`.

#### What was built

`pipeline/precompute/` — AD-9's second phase, the first pipeline module that reads no PDF.
Seven modules: `__init__`, `errors`, `records`, `identity`, `slug_registry` (generated),
`spine`, `run`. Every entry point in the story's pinned public API is honoured and is now
pinned by a test; `build_spine` gained one **optional trailing** parameter (`registry`,
supplying the diagnostic `slug_source`) and is still callable with the four positional
arguments the story declares.

**Identity.** Team codes parsed from `report_id` and asserted 1:1 in both directions.
Player slugs by the ruled caps-run rule, gated unconditionally against `PlayerId` on **both**
branches — the fallback appends the team code too, because a two-segment slug validates
clean as a `TeamId` and yields a dead route. Resolution keys on `(team_id, shirt_number)`,
walks records in canonical order so first-seen wins, applies `OVERRIDES` **before** pinning,
and raises `IdentityCollisionError` naming both parties, both shirts and both match ids.
`team_slug` is imported from `pipeline.ingest.identity`, never reimplemented; `_kebab` is
its recipe applied to a name fragment, separate only so the typed error is the right one.

**Patterns held as two constants**, as ruled: `SCHEMA_PATTERNS` (verbatim `$`, compared for
equality only) and the `\Z`-terminated runtime gates. Both are tested — a drift test against
`contract/common.schema.json`, and a dialect test asserting each compiled gate **rejects** its
own valid slug with a trailing newline while the schema literal accepts it. That second test
is the one that justifies having two constants at all.

**Registry.** `slug_registry.py`, generated, byte-identical across runs, all maps sorted:
**48 team codes, 48 team ids, 104 match ids, 1,248 player ids — 1,400 pinned ids**, with
`OVERRIDES` shipping **empty**. It is Python because `code_version()` fingerprints
`pipeline/**/*.py`; a test asserts the file is `.py`, is under the fingerprinted root, and is
*not* also listed in `EXTRA_FINGERPRINTED_FILES`. **Committing it changes `code_version()`
and invalidated all 104 staged records** — the fingerprint working as designed, and the
reason Task 9.1's re-extract comes after the registry rather than before.

**Pinning has two sources and the second one does not exist.** `check_pins` fails on a
pinned id that would change and stays silent on an absent pin (a new entity on a growing
corpus). `check_overrides` fails on an override naming nobody. `check_committed_data` reads
`data/matches/*.json` when present — and when absent returns the line *"committed /data
baseline unavailable … This is NOT a pass"*, which the CLI always prints. Both branches are
tested, plus a test asserting the repository still has no committed bundles, which goes red
by design when Story 1.16 lands and is the prompt to flip the primary assertion.

**Spine.** `entities.json` modelled on `data/fixtures/index/tournament.json`, plus one file
per match holding the record's `domains` block with ids **added** beside names — never
instead of them, because `playerName` is `required` in eight `$defs`. Verified on the real
corpus: **73,065 ids added across exactly 25 distinct paths**, matching the independently
measured 73,065 name occurrences across 25 paths one for one, with every original name
still present. The 23 shirt-bearing paths resolve on `(side, shirt_number)` with the name
corroborating; a disagreement raises with the name in `repr()`. The two shirt-less
`most_offers` paths resolve by verbatim name against the match's lineup index.

The exhaustiveness assertion is the **inverse** of a path list — walk the finished spine and
require an id sibling on every string equal to a known player name — so the inventory is
self-maintaining. **It is pinned non-vacuous**: a test plants a known name on a new domain
with no id sibling and asserts it fails, because an exhaustiveness check that has never
failed is not evidence. All-zero pass-network nodes are not pruned; `goalkeeping.goalkeepers[]`
is reconciled to the same id as the lineup rather than resolved independently.

**Gate checks.** `identity-completeness` and `identity-pinning`, registered and appended at
the reserved docstring slot in registration order. Both are per-report, reuse
`_domain_a_payload`'s memo rather than a ninth parse, take codes from `meta.report_id` and
ids from `team_slug`, and read **neither a record nor the spine** — which is what makes them
a genuine cross-check of the registry rather than a restatement. Both docstrings state
plainly that they cover only the sampled reports. `offers-count-match` was **not** claimed.

#### Deviations from the story, all deliberate and all small

- **`check_pins(resolved, pinned, kind)` rather than `check_pins(resolved, registry)`.** It
  serves all three id kinds (matches, players, teams), so it takes the specific pinned map
  and the kind name for the message instead of the whole registry. Not in the pinned public
  API, so no declared contract is broken.
- **`check_pins` / `check_overrides` / `check_committed_data` and the registry renderer live
  in `identity.py`, not in a module of their own.** The story's file list names exactly seven
  precompute modules and `slug_registry.py` is fully generated, so nothing hand-written can
  live there. Their tests live in `test_precompute_spine.py` per Task 8.1's grouping.
- **`build_spine` takes an optional trailing `registry`** (see above).

#### Deviations found by code review and declared retroactively (2026-08-03)

The three above were declared at implementation time. Story 1.15's code review found three
more that were not, and they are recorded here rather than left implicit:

- **The AD-3 first-seen tiebreak is NOT implemented.** `resolve_players` raises
  `IdentityCollisionError` on two players who mint one slug, which is what AC 1's binding
  block demands and the opposite of what AC 4 rows 2-3 and Task 3.4 describe. The
  Completion Notes above, the commit message, `__init__.py`, `pipeline/README.md` and two
  test names all said the tiebreak shipped. Ruled in favour of raising (Decision 1); every
  one of those statements is now corrected.
- **Task 7.3 filed per-team aggregates and a `slug_source` query pointer, not the full
  list of 219 players** the task asks for. Kept — the per-team residue counts plus a
  reproducible query are a better artifact for a UX ruling than 219 inlined slugs, and the
  list is one query away — but it is a substitution from the instruction and was not
  declared.
- **Task 3.5's `has_minutes` import was never made.** The section IS carried through
  `lineup_entries` as the task requires, but nothing in this story consumes it: no 1.15
  deliverable asks "did this player take the field". The dead `_ = section` line has been
  removed; the section remains available on every entry for the story that needs it.

#### AC 2's "and aggregates" clause — deferred to Story 1.17 as a ruling, not an omission

No aggregate exists yet to reference an id, and building one here would smuggle 1.17's work
into a story whose deliverable is the namespace itself. What 1.15 owes that clause is the
guarantee that makes it cheap, and that guarantee now holds: **one id per entity, minted
once, pinned, and immutable from this commit forward.**

#### Task 9 — verification results

**9.1 — full batch, asserted against the adjudicated baseline rather than against exit 0.**

```
pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104
```

`extracted 104 / failed 0 / skipped-unchanged 0`, `corpus_gaps 0`, `orphan_record_paths 0`,
and **exactly two** self-validation failures — `PMSR-M19-ARG-V-ALG` and `PMSR-M58-TUN-V-NED`,
both `defensive-actions-marker-count` (39 vs 40 and 33 vs 34 markers, both away
forced-turnover). **No third failure**, and none from precompute. **Exit 1, by design.**

All 104 were re-extracted rather than skipped, which is the AD-8 fingerprint working
exactly as predicted: committing `slug_registry.py` moved `code_version` from
`f417cd0d9a78d097…` to `e0296b63ec257246…`, invalidating every staged record. That is why
Task 1.6 deferred this run until after the registry landed — running it earlier would have
been discarded work.

**9.2 — precompute run twice, both `PRECOMPUTE RESULT: PASS`, exit 0.**

104 records consumed on both runs (`--expect-records 104` satisfied), 48 team codes, 1,248
players, 104 matches, 48 teams, `1400 pinned id(s), all held`. Staged into two separate
directories and compared: **105 files each, 0 byte-differing files**, SHA-256 over all 105
`05efcce5001e2d7f7969b8399656a8aa…`. The registry was then regenerated over the committed
one and compared as bytes: **identical, 65,420 bytes**, no CRLF anywhere, trailing newline
present. The "committed /data baseline unavailable … This is NOT a pass" line printed on
every run and was never suppressed.

**9.3 — FR-15 gate run twice, both `GATE RESULT: PASS`, 0 deviations across 16 sampled
reports, exit 0.** All four deviation categories zero (`missing-anchor`, `unknown-rgb`,
`count-mismatch`, `probe-failure`); categories remain frozen at four.

`checks_run` is **29**, up from 27, with both new ids present and in exact sorted position:
`… goalkeeping-counts, identity-completeness, identity-pinning, marker-event-link-rate …`.
The whole list is sorted. `offers-count-match` was not claimed.

The two manifests were diffed key by key: **the only differing top-level key is
`run_timestamp`.** With it removed the two documents are equal — sample selection, per-report
results, deviation counts and `checks_run` all identical.

**9.4 — full suite GREEN: 1,329 passed, 1 skipped, 0 failed** (exit 0, 48:51), over 1,330
collected. **Attribution is therefore trivial: nothing failed, so there is nothing
pre-existing to attribute.** The single skip is pre-existing and not in a file this story
touches.

**Task 1.1 — the pre-change baseline, reported honestly.** A full-suite run was started
before any edit and, after 2h30m wall-clock and ~46 minutes of accumulated CPU, had still
not finished; process inspection showed **at least three other pytest runs active in this
tree concurrently** (started 12:04:00, 12:04:33 and 12:06:49, one of them on a different
interpreter and a different test root), plus this story's own batch and gate runs. It was
retired rather than left competing for CPU with the authoritative run. The quantitative
baseline is established instead by collection: the tree now collects **1,330** tests, of
which **72** are this story's, so the pre-change tree collects **1,258** — which matches
exactly the figure the story itself recorded a few hours before this session began. This is
the concurrency hazard the Coordination section predicts, observed live.

**Suite delta: 1,258 -> 1,330 collected (+72), all green.** The only forced repair was the
one the story named — `test_runner.py`'s exact `checks_run` literal, 27 -> 29. Nothing else
in the suite broke, exactly as the story's regression sweep predicted.

### File List

**New — `pipeline/precompute/` (the whole package):**
- `pipeline/precompute/__init__.py`
- `pipeline/precompute/errors.py`
- `pipeline/precompute/records.py`
- `pipeline/precompute/identity.py`
- `pipeline/precompute/slug_registry.py` (GENERATED — 1,496 lines; 48 team codes + 1,400 pinned ids)
- `pipeline/precompute/spine.py`
- `pipeline/precompute/run.py`

**New — tests:**
- `pipeline/tests/test_precompute_identity.py` (40 tests)
- `pipeline/tests/test_precompute_spine.py` (32 tests)

**New — tests added by code review (2026-08-03), closing two zero-coverage gaps:**
- `pipeline/tests/test_precompute_run.py` — the CLI. `run.py` shipped with 173 lines of
  documented behaviour (three exit codes, the always-printed baseline note, the
  `--expect-records` gate, the write-vs-check branch) and no test module importing it.
- `pipeline/tests/test_checks_identity.py` — both FR-15 gate checks at their branches.
  Only the sorted `checks_run` id literal in `test_runner.py` referenced them, so nothing
  exercised the registry/report code disagreement, the in-report duplicate-slug branch,
  the `probe-failure` mapping or Task 4.2's absent-pin rule.

**Modified — additive / append-only, per the shared-contention rule:**
- `pipeline/validate/checks.py` — 6 imports, 2 check functions + 1 helper, 2 `register_check`
  calls appended at the end, and the reserved 1.15 docstring inventory slot filled in
  registration order (never interleaved). **Also carries ~6 lines of in-flight Story 1.9's
  goalkeeping docstring** (Decision 3's `InvolvementChartError` vs `InvolvementClockError`
  wording) — declared in the commit message's `COMMIT SCOPE` note but omitted from this list
  until Story 1.15's code review corrected it. Committing the file was unavoidable:
  omitting it would have committed a `checks_run` registry of 29 ids against a file
  registering 27.
- `pipeline/tests/test_runner.py` — the forced repair: the exact `checks_run` literal goes
  27 → 29, with both new ids in sorted position between `goalkeeping-counts` and
  `marker-event-link-rate` (not tail-pinned)
- `pipeline/README.md` — `precompute/` added to the Layout block, plus a new
  "Cross-match identity and the normalized spine — precompute (Story 1.15)" section.
  **Also carries ~50 lines of in-flight Story 1.9's involvement-clock prose**, including a
  `goalkeeping-involvement-clock` row that takes the Self-Validation inventory from seven
  ids to eight — an id the committed code does not register, because `domain_e.py` is not
  in this commit. Same `COMMIT SCOPE` declaration and same correction as `checks.py` above;
  filed to `deferred-work.md` by the code review, and it resolves when Story 1.9 lands.
- `_bmad-output/implementation-artifacts/deferred-work.md` — a new 1.15 section appended at
  the END (**8** entries, not 7 as this list originally said), and Story 1.10's
  `PlayerRecord.playerId` filing struck and closed
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions + note
- `_bmad-output/implementation-artifacts/1-15-cross-match-identity-resolution-normalized-spine.md`
  — this file (frontmatter `baseline_commit` preserved, checkboxes, Dev Agent Record,
  File List, Change Log, Status)

**Staged output (gitignored, not committed):**
- `work/spine/entities.json`
- `work/spine/matches/{match_id}.json` (104 files)

**Deliberately untouched:** `/contract`, `/data`, `app/`, `spike/`, `pipeline/markers/`,
`pipeline/extract/`, `pipeline/discover/`, `pipeline/ingest/` — all import-only. In
particular `pipeline/extract/domain_g.py`'s Henderson all-zero-orphan admission is intact,
and `pipeline/extract/pass_network.py` was not edited (in-flight Story 1.14).

## Change Log

| Date | Change |
|---|---|
| 2026-08-03 | Story 1.15 implemented. New `pipeline/precompute/` package — AD-9's second phase and the first pipeline module that reads no PDF. Cross-match identity resolution over all 104 Extraction Records: 48 team codes parsed from `report_id` and asserted 1:1, 1,248 player ids minted by the ruled caps-run rule with 0 collisions, 104 match ids and 48 team ids re-gated rather than re-minted. Committed `slug_registry.py` as Python (AD-8 fingerprinting) with **1,400 pinned ids** and an empty `OVERRIDES`. Two-source pinning: `PINS` from run one, plus a `/data` diff that prints "baseline unavailable — NOT a pass" until Story 1.16 emits. Normalized spine staged to `work/spine/`, adding **73,065 ids across exactly 25 name paths** without removing a single name. Two FR-15 gate checks registered (`identity-completeness`, `identity-pinning`); `checks_run` repaired 27 → 29. 72 new tests. |
| 2026-08-03 | Task 1 re-derived every pinned Dev Notes figure independently. The acceptance check passes: **155/155 committed fixture player ids reproduced, 0 mismatches**. All three OQ-4 ambiguous cases re-confirmed corpus-EMPTY (0 non-ASCII characters, 0 name+team collisions, 0 multi-shirt players). Three Dev Notes figures corrected: the non-derivable team-code count is 6 not "≥8" and its `RSA`/`COD` examples are wrong (ruling unaffected); the 416 display names require counting the top-level `metadata` block; and `metadata` carries neither `report_id` nor `source_path`. All three filed to `deferred-work.md`. |
| 2026-08-03 | Closed Story 1.10's `PlayerRecord.playerId` deferred-work filing — the cross-match namespace it was waiting on now exists, and the extract layer is unchanged. |
| 2026-08-03 | **Code review: 3 decisions ruled, 34 patches applied, 1 deferred.** The AD-3 first-seen tiebreak was claimed by four documents and two test names and implemented by none — ruled in favour of the raise the code actually does (AC 1's binding block), and every claim corrected. The commit's flip of Story 1.9 to `review` was reverted: 1.9's implementation is still uncommitted, and a concurrent batch was observed re-staging `work/extracted/` mid-review. Precompute now refuses partial corpora plainly instead of dying on group arithmetic. **Highest-severity patch: `identity-pinning` re-minted from the PDF and never consulted `OVERRIDES`, while `resolve_players` applies `OVERRIDES` before pinning — so the story's own advertised data-only fix for 219 as-listed players would have turned the gate red on every sampled report against a correct registry.** Also: `OVERRIDES` values are gated against `PlayerId` and applied before the gate so they can rescue an unsluggable name; `--write-registry` refuses to drop a pin; an empty manifest is a finding, not a PASS; exit 1 (finding) and exit 2 (broken harness) are now distinguished in both directions via a new `ManifestUnreadableError`; the spine's team-name exhaustiveness no longer skips every key but `home`/`away`; `known_names` is per-match rather than corpus-global; `write_spine` removes stale match files; `write_registry` is atomic. Two new test modules (`test_precompute_run.py`, `test_checks_identity.py`) close the CLI's and the gate checks' zero coverage, the committed registry is pinned by a regenerate-and-compare against its real bytes, and three tests that could not fail were rewritten. Re-verified: precompute PASS over a frozen 104-record snapshot, **105 files byte-identical across two runs**, `slug_source` 1,029 caps-run + 219 as-listed, FR-15 gate PASS with 0 deviations and `checks_run` 29 sorted. |

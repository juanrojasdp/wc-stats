---
baseline_commit: 74b1789
---

<!-- Baseline is 74b1789 (Story 1.16 code review: 4 decisions, patches, status done), NOT the
     CS-2 commit 04f886e the story request named. 04f886e is CS-2 + the 104-bundle emission;
     74b1789 is the review that patched it. Everything CS-2 landed is contained in the
     baseline; the review added `check_spine_shape`, the precision-binding fix and the
     committed-artifact drift test, all three of which this story must copy. Verified:
     `contract/version.json` reads `{"schemaVersion": 4}` and 04f886e is in `git log`. -->

# Story 1.17: Tournament Index — Results, Standings & Leaderboards

Status: review

## Story

As the builder,
I want `tournament.json` and `leaderboards.json` precomputed,
So that the Hub renders results, standings, and leaderboards verbatim with zero client-side aggregation (FR-19, AD-5).

> **Four things the story-creation probe measured that change the shape of this work. Read these before the ACs, because two of them make an AC unimplementable as written.**
>
> **1. The FIFA tiebreaker cascade is not specified anywhere in this repository.** Four places *bind* it — `contract/tournament.schema.json:101`, AD-4 (`ARCHITECTURE-SPINE.md:68`), FR-19 (`epics.md:44`) and this story's own AC (`epics.md:553`) — and not one of them defines it. The only text naming any criterion is a parenthetical inside a *critique* (`review-adversary.md:83`, `"head-to-head, fair play, drawing of lots"`), which is unordered, incomplete and describes what a naive builder would **miss**. Encoding it would be inventing the contract. **See DECISION D1 — this is not yours to decide.**
>
> **2. The corpus is the 48-team / 12-group 2026 format, and it answers the cascade question empirically.** Measured over the 104 committed bundles: 12 groups `a`–`l` × 6 matches = 72, then `r32` 16, `r16` 8, `qf` 4, `sf` 2, `third-place` 1, `final` 1. **Seven adjacent equal-points pairs exist and every one is separated by goal difference; ZERO within-group ties survive tier 2.** And `points → goal difference → goals scored` reproduces the tournament's actual outcome exactly — all 12 winners and 12 runners-up are in the real R32 field, and the computed best-8 third-placed teams are *precisely* the real 8. That is ground truth, not a synthetic fixture.
>
> **3. AC 3's bijection gate cannot pass at the end of this story's run.** It requires "one profile artifact per listed entity"; profile artifacts are Story **1.18**'s output and `data/index/team-profiles/` and `player-profiles/` do not exist. A gate written literally here fails on 100% of entities. **See DECISION D2** — the project has already solved this exact shape once, in 1.15.
>
> **4. Full-roster leaderboards BREACH the combined budget, and this is the only real budget risk in the story.** Measured: a realistic 36-board roster at full roster is 19,566 rows → **572,276 gzip-9 bytes**, and combined with `tournament.json` = **611,210 bytes against a 500,000 ceiling. FAIL.** Capping player boards at 100 rows (tie-extended) lands at **~115,000 combined** — better than four-fold headroom. `tournament.json` itself is never the problem: full-corpus it is 409,512 raw / **38,934 gzip-9**. **See DECISION D3.**
>
> Everything else in the epic's story statement stands. The 104 committed Match Bundles in `data/matches/` and the staged spine in `work/spine/` are your only inputs; `/contract` is read-only.

---

## Acceptance Criteria

The epic's ACs are reproduced **verbatim** (`epics.md:551-566` — four Given/When/Then blocks; `:549` is the label), each followed by the **binding reconciliation** the story-creation probe forced. Numbered clauses split the `Then`/`And` pairs.

---

**1. Given** all normalized matches **When** index generation runs **Then** `tournament.json` carries results and standings by stage/group with an explicit pipeline-computed `rank` per row implementing the full FIFA tiebreaker cascade, plus the entity lists (matches, teams, players) that serve as the App's route manifest and search source
**2. And** `leaderboards.json` carries team and player leaderboards (including physical metrics: top speed, sprints) with canonical default order and closed metric-code enums. [Source: epics.md:551-554]

> **BINDING — the AC is a summary; the SCHEMAS plus the two committed fixtures are the shape, and the AC under-describes them badly.**
>
> `contract/tournament.schema.json` requires **five** top-level keys, all mandatory: `schemaVersion`, `tournamentName`, `groups`, `knockoutResults`, `entities`. `additionalProperties: false` at every level. The AC mentions two of the five. Emit from the schema, not from the AC.
>
> **CS-2 did NOT change either schema's structure.** The complete diff to `tournament.schema.json` and `leaderboards.schema.json` in `04f886e` is one line each, `"const": 3` → `"const": 4`. CS-2's structural work landed in `match-bundle.schema.json` and `team-profile.schema.json`. **Do not go looking for new CS-2 fields here; there are none.** The shape is the original Story 1.1 shape, restamped.
>
> **The two committed fixtures are the worked shape**: `data/fixtures/index/tournament.json` (276 lines) and `data/fixtures/index/leaderboards.json` (477 lines), both `schemaVersion: 4`. **Use them for SHAPE ONLY, never as a target for CONTENT** — 1.16's landmine 16 applies verbatim: the fixtures are a hand-authored AD-14 bootstrap. The Mexico `record` says `played: 3` while Mexico appears in exactly one fixture match; that value is illustrative, not derived.
>
> **Required field sets, exact** (`additionalProperties: false` — an extra key is a hard failure):
>
> | `$def` | Required properties |
> |---|---|
> | `StandingsRow` | `rank, team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points, form` |
> | `GroupTable` | `group, standings, results` |
> | `MatchResultRow` | `matchId, matchNumber, stage, group, matchdayRound, date, kickoff, venue, homeTeam, awayTeam, score, knockoutScore` |
> | `MatchEntity` | `matchId, stage, homeTeam, awayTeam, score` — **five only**, no date/venue/group |
> | `TeamEntity` | `teamId, name, teamCode, group, record` |
> | `PlayerEntity` | `playerId, name, team, position` — **no shirt number**; `team` is an `EntityRef` |
> | `TeamRecord` | `played, won, drawn, lost, goalsFor, goalsAgainst` — **no points, no goalDifference** |
> | `EntityIndex` | `matches, teams, players` |
> | `Leaderboard` | `metricCode, scope, aggregation, higherIsBetter, rows` |
> | `LeaderboardRow` | `rank, entity, team, value, matchesPlayed, perMatch` |
>
> **`knockoutScore` is required on GROUP rows too.** The fixture's group rows carry `decidedBy: "regulation"`, `scoreAfterET: null`, `shootoutScore: null`, and `winnerTeamId` set — or `null` on a draw. **20 group ties are drawn** and carry `winnerTeamId: null`; that null is legal and `NULLABLE_ID_KEYS` already exempts it (`identity.py:510`). `group` is `null` on all 32 knockout rows and non-null iff `stage == "group"`.
>
> **Ordering is contract, declared in `description` prose and enforced by nothing** — no `minItems`, no `uniqueItems`, no ordering keyword anywhere in either file. You must enforce all of it in the emitter and pin each one with a test:
> - `groups` — *"One entry per group, ordered by group letter."*
> - `knockoutResults` — *"Every knockout tie, ordered by stage then match number."* Use `pipeline/discover/rounds.py:43` `KNOCKOUT_ROUNDS` for stage order; do not transcribe the enum.
> - `standings` — *"Rows in rank order."*
> - `form` — *"This team's results in chronological order."*
> - `rows` (leaderboards) — *"Rows in rank order."*
> - **`entities.matches` / `.teams` / `.players` have NO declared order.** AD-8 demands byte-identical re-runs, so you must fix one and state it. `work/spine/entities.json` is already sorted by `match_id` / `team_id` / `player_id` — **carry that order through and pin it.**
>
> **`rank` is competition ranking, and the fixture is the only thing that says so.** `common.schema.json`'s `Rank` says only "1-based, pipeline-computed". The committed fixture's `topSpeed` board runs `1,2,3,4,5,6,7,7,7,7,7,12,13,14,15,16,16,16,19,20` — ties share the lower rank and the next distinct value skips to its ordinal position (1,2,2,4 — **never** 1,2,2,3). `test_fixtures.py:608` pins it. **Within a tie, the fixture orders by ascending `entity.id`** (at 33.3: `anton-`, `jimenez-`, `mudau-`, `provod-`, `quinones-`; at 32.2: `alvarado-`, `ruediger-`, `thiaw-`). That is your determinism tiebreak — reproduce it and pin it, or re-runs are not byte-identical.
>
> **`MetricCode` is a closed 32-value enum** (`common.schema.json`), and the scope rule is **SCOPED**: a team-scope code names a `TeamKeyStatistics` field, a player-scope code names a Domain G field. I verified all 32 against a real bundle — **every one resolves, zero orphans**. `sprintDistance` and `distanceCovered` are **team-only**; `topSpeed`, `sprints`, `highSpeedRuns`, `totalDistance` are **player-only**. Four codes exist in both shapes: `ballProgressions`, `goals`, `passCompletion`, `passesCompleted`. (`contract/README.md:384` says "all 31 codes" — the enum holds **32**. The README is stale; the schema is the definition.)
>
> **`ownGoal: true` goals are credited to the BENEFITING TEAM while `scorerPlayerId` names the scorer** (`contract/README.md:95-98`; 14 own goals corpus-wide). A top-scorer board that does not exclude own goals credits the wrong player.

**3. Given** the route-manifest bijection rule (AD-4) **When** the run completes **Then** the pipeline asserts one profile artifact per listed entity — empty sections allowed, absence not. [Source: epics.md:556-558]

> **BINDING — as written this gate CANNOT PASS, because the artifacts it asserts against are Story 1.18's output. Do not write an assertion that cannot pass. See DECISION D2.**
>
> The rule is real and this story owns it — `contract/tournament.schema.json:231` names this story by name: *"AR-4 asserts a bijection between these lists and the emitted profile artifacts; **that assert runs against real `/data` in Story 1.17, not against fixtures.**"* Same statement at `data/fixtures/README.md:150-160` and `1-1-…md:397`.
>
> But `data/index/` **does not exist at all** at baseline, and `team-profiles/` / `player-profiles/` are emitted by Story 1.18 (`epics.md:578-579`). A literal `==` assertion here fails on every entity.
>
> **The project has solved this exact shape before and the precedent is binding.** Story 1.15 faced it when `data/matches/` did not yet exist (ledger, anchor phrase *"AC 3's second source cannot engage yet"*): *"A pinning check built only on that baseline would be a gate that cannot fail, which reads greener than no gate while proving strictly less."* Its answer was a two-source check that prints `committed /data baseline unavailable … This is NOT a pass`, plus `test_the_repository_has_no_committed_match_bundles_yet` that **goes red by design** when the successor lands. It worked exactly as intended and CS-2 closed it.
>
> **Copy that mechanism.** Whatever D2 rules, the gate must never report a silent pass.

**4. Given** the Hub payload budget **When** measured **Then** `tournament.json` + `leaderboards.json` combined ≤ 500 KB gzip -9, else the run fails. [Source: epics.md:560-562]

> **BINDING — the combined measurement DOES NOT EXIST, and at full roster this gate FAILS. See DECISION D3.**
>
> `pipeline/precompute/budget.py` exposes `gzip_bytes(text) -> int` and `over_budget(label, text) -> tuple|None` with `BUDGET_BYTES = 500_000` (**decimal**, deliberately). `over_budget` measures **exactly one string**; there is no combined-set API and no caller does it. AD-4's wording is *"`tournament.json` + `leaderboards.json` **combined** ≤ 500 KB (the Hub loads both)"* (`ARCHITECTURE-SPINE.md:68`).
>
> Two readings give different numbers: `gzip_bytes(a) + gzip_bytes(b)` (two HTTP responses, two gzip streams — what the Hub actually downloads) versus `gzip_bytes(a + b)` (one stream over a concatenation nobody transfers). **Rule it, do not let it default.**
>
> **Measured against the real corpus** (sum-of-gzips reading, `tournament.json` = 38,934 gzip-9 throughout):
>
> | Player-board cap | Hard cut: rows / combined | Tie-extended: rows / combined | Verdict |
> |---|---|---|---|
> | none (full roster) | 19,566 / **611,210** | 19,566 / **611,210** | **FAIL** |
> | 100 | 2,664 / 105,779 | 2,964 / 115,258 | PASS |
> | 50 | 1,764 / 76,304 | 1,983 / 82,551 | PASS |
> | 25 | 1,314 / 63,584 | 1,398 / 66,245 | PASS |
>
> **The two columns are not interchangeable, and only the right one is legal here.** A hard cut at N publishes an arbitrary subset of equals; this story requires extending to the end of the boundary tie group. **A 100-row tie-extended cap is ~2,964 rows / ~115,258 combined — 23% of ceiling.**
>
> **Treat the tie-extended figures as approximate and re-derive them.** An independent re-measurement of the same roster produced 2,965 rows / 116,381 combined — the count shifts by a row or two depending on exactly where the cap is tested relative to the tie boundary. That sensitivity is the point: **the tie-extension rule must be written down and pinned by a test**, not left to a loop's off-by-one. The verdict is insensitive to it; the byte count is not.
>
> Team boards are 48 rows each and never a factor. **`tournament.json` is never the problem**: full-corpus it is 409,512 raw / 38,934 gzip-9, 7.8% of the ceiling, with all 1,248 players listed. **Do not truncate the entity lists to "save budget"** — they are the route manifest and truncating them deletes routes.
>
> **SM-C2 forbids resolving a breach "by dropping fields", and this is not that** — a row cap drops *rows*, which neither AD-4 nor SM-C2 names. It is nonetheless a **logged budget decision**, which AD-4 explicitly permits. Log it.
>
> **A gate proven only green is the failure this project has shipped three times.** `budget.py`'s own docstring: *"A gate that cannot fail reads greener than no gate while proving strictly less."* Ship a **constructed** over-budget test that drives the combined gate red.

**5. Given** reproducibility (FR-19) **When** pytest runs **Then** every standings and leaderboard value is asserted reproducible from the underlying Match Bundles. [Source: epics.md:564-566]

> **BINDING — recompute from the bundles and assert equality; never compare the emitter to itself.**
>
> The governing rule, quoted in both predecessor stories: *"Derive expected values from the parsed corpus, never restate the implementation. A test asserting `emit(x) == emit(x)` proves only that the function is the function."* 1.16's review found **both** its precision tests deriving their expectation from the emitter's own key map.
>
> The closest shipped analogue to copy is `test_emit_bundles.py:1479` `test_corpus_story_stats_agree_with_the_key_statistics_they_summarize` — it recomputes `max(topSpeed)` over the bundle's own player rows and asserts equality, with the failing identity in the message.
>
> **The strongest available reproducibility test is ground truth, and it is free.** The 2026 format sends 12 winners + 12 runners-up + the 8 best third-placed teams to the R32. The R32 participants are in the corpus. **Assert that your computed standings reproduce the real R32 field** — I verified this passes: all 24 automatic qualifiers present, and the computed best-8 thirds match the real 8 exactly (`congo-dr, sweden, ecuador, ghana, bosnia-and-herzegovina, algeria, paraguay, senegal`). This test would catch a cascade error that every internal-consistency test would miss.
>
> **Cross-artifact agreement is an unstated AC and `test_fixtures.py:1061` already encodes it for fixtures** — it must hold for real `/data`: `LeaderboardRow.matchesPlayed` equals the team's `played` in standings; `aggregation == "max"` ⇒ `perMatch is None`; `aggregation == "sum"` ⇒ `abs(perMatch - value/matchesPlayed) < 0.05`. **Note the `matchesPlayed` rule needs a ruling for knockout teams — see D4.**

---

## DECISIONS REQUIRED FROM JUAN — surfaced with evidence, NOT yet ruled

**None of these has been ruled. Do not start the tasks they gate until they are.** Each carries the measurement and the recommended option; rejected alternatives are recorded so they are not re-litigated later.

| # | Question | Gates | Recommended |
|---|---|---|---|
| D1 | What IS the FIFA cascade, and what happens when it runs out? | Task 3.4, 7.2 | Tiers 1–3 (points, GD, goals scored) + a typed raise on exhaustion |
| D2 | When and where is the AD-4 bijection asserted, given profiles are 1.18's? | Task 5 | Story 1.15's two-source pattern, with a red-by-design successor test |
| D3 | Which combined measurement, and what caps the rows? | Task 3.6, 4, 7.2 | Sum of independently gzipped artifacts; 100-row cap on player boards |
| D4 | What does `played`/`matchesPlayed` count — and on a player row, whose matches? | Task 3, 3.6, 7.7 | `TeamRecord` = all matches; `matchesPlayed` = the **entity's own** appearances |
| D5 | Which metric codes get boards, at which scope, in what order? | Task 3.6, 9.1 | The 36-board family-grouped roster enumerated below |

### D1 — What IS the FIFA tiebreaker cascade, and what happens when it runs out?

**The problem.** Four binding sources demand "the full FIFA tiebreaker cascade" and none defines it. There is no regulations document in the repo (`docs/` does not exist; the PMSR PDFs are gitignored and are match reports, not rules). Searches for `tiebreak`, `fair play`, `drawing of lots`, `head-to-head`, `third-placed`, `reglamento`, `desempate` return nothing normative.

**The evidence.** Measured over the 104 committed bundles:

| Fact | Measurement |
|---|---|
| Adjacent equal-points pairs within groups | **7** |
| Of those, separated by goal difference | **7 of 7** |
| Within-group ties surviving (points, GD, goals scored) | **0** |
| `points → GD → GF` reproduces the real R32 field | **YES — 24/24 automatic qualifiers + 8/8 best thirds** |
| Cards available for a fair-play tier | yes, `metadata.lineups[].cards`, 283 corpus-wide |
| `StandingsRow` field for a disciplinary/tiebreaker reason | **none**, and `additionalProperties: false` |

So tiers beyond goal difference are **never exercised by this corpus** and cannot be pinned "with a test over real corpus standings" — only with constructed fixtures.

**Two further blockers.** *Drawing of lots is non-deterministic* and collides head-on with AD-8's byte-identical requirement; the project's precedent (1.15 decision 1) was to **raise rather than fake a tiebreak that cannot fire truthfully**. And *fair play is not computable from the contracted `StandingsRow`* — adding a field is an AD-14 change request.

**Recommended (Option A).** Implement tiers 1–3 — points, then goal difference, then goals scored — which are universally agreed, are what the corpus exercises, and reproduce the actual tournament outcome. **Raise a typed error if a tie survives tier 3**, naming the tied teams. On this corpus that branch never fires, so ship it with a *constructed* test that drives it red. Record in the Dev Agent Record that tiers 4+ are deliberately unimplemented and why.

- *Option B — Juan supplies the normative FIFA 2026 regulations text*, committed to the repo as a citable source, and the full cascade is encoded. Strictly better if the text is available; it is the only path that makes "full cascade" literally true.
- *Rejected — encoding the `review-adversary.md:83` parenthetical.* It is a critique of what a builder would miss, is unordered, omits goals-scored entirely, and would be exactly the "remembered version" failure.
- *Rejected — silently ordering by array position.* AD-5 forbids it and the App renders `rank` verbatim.

### D2 — When and where is the AD-4 bijection asserted?

**The problem.** AC 3 requires one profile artifact per listed entity; profiles are Story 1.18's. Written literally, the gate fails on 1,248 players and 48 teams.

**Recommended (Option A) — copy Story 1.15's two-source pattern exactly.** 1.17 emits the manifest and asserts the direction that *is* checkable today: **every artifact that exists on disk is listed** (`data/matches/` — all 104, checkable now). For the profile direction it prints `profile baseline unavailable — team-profiles/ and player-profiles/ do not exist; this is NOT a pass`, and ships `test_the_repository_has_no_committed_profiles_yet`, which **goes red by design the moment 1.18 lands** and is the prompt to make the populated branch primary. This is precedent, not invention, and it never reports a silent pass.

- *Option B — the full bijection moves to Story 1.19's batch acceptance* over the finished `/data`. Clean, but leaves AC 3 unowned in this story and contradicts the schema's own statement that the assert runs in 1.17.
- *Option C — a standalone `pipeline/validate` gate run after emit*, which is closest to AD-4's literal wording ("the Pipeline asserts"). Note `ARCHITECTURE-SPINE.md:177` files "budget + route-manifest asserts" under `validate/`, and 1.16 already departed from that for `budget.py` and recorded the departure.
- *Rejected — asserting the bijection now and marking the story blocked.* 1.18 cannot start without the manifest 1.17 produces.

### D3 — The combined budget: which measurement, and what caps the rows?

**The problem.** The measurement mode does not exist, and full-roster leaderboards breach the ceiling by 22%.

**Recommended.** (a) **Sum of independently gzipped artifacts** — `gzip_bytes(t) + gzip_bytes(l)` — because that is what the Hub actually downloads over two HTTP requests. (b) **Cap player boards at 100 rows** — see AC 4's measured table — which comfortably serves the UX, whose only stated need is "top-3 teaser rows at hero altitude and full sortable tables beneath" (`epics.md:891`). Team boards stay uncapped at 48 rows. (c) Log it as an AD-4 budget decision.

**These figures assume the 36-board roster D5 has not yet ruled. Re-measure after D5 lands.**

**The cap must not split a tie group.** Competition ranking means several entities can share the boundary rank; truncating mid-tie publishes an arbitrary subset of equals. Extend to the end of the tie group, and pin that with a test.

- *Rejected — capping the entity lists.* They are the route manifest; dropping entries deletes routes and breaks D2's bijection.
- *Rejected — fewer boards instead of fewer rows.* Board roster is a product decision (D5); rows are the measured lever.

### D4 — What does `played` / `matchesPlayed` count — and for a PLAYER row, whose matches?

**Two questions, and the second is the one that will silently corrupt 56% of player rows.**

**D4a — `TeamRecord.played`.** `tournament.json` carries **two** `played` fields with potentially different meanings: `StandingsRow.played` (a group table — necessarily group-only) and `TeamRecord.played`, described as *"A team's **tournament** record"*. **For 32 of 48 teams these differ** — Argentina played 3 group + 5 knockout = 8. The fixture does not disambiguate.

**D4b — `LeaderboardRow.matchesPlayed` on a PLAYER-scoped board: the entity's appearances, or its team's matches?** `test_fixtures.py:1061` reads `team_id = row["team"]["id"]` and asserts `row["matchesPlayed"] == played[team_id]` for **every** row, players included — and the fixture obeys it: all 20 rows of the `topSpeed` player board carry `matchesPlayed: 3`, which is their *team's* group matches, not their own appearances. **Measured on real data: 584 of 1,039 players (56%) have an appearance count that differs from their team's match count.** Copying the fixture rule divides an unused substitute and a full-tournament starter by the same denominator, so `perMatch` is wrong on 56% of player rows. Using the player's own `match_ids` breaks the pinned test.

**Recommended for D4b:** `matchesPlayed` is **the entity's own appearances** — `len(entity["match_ids"])` from `entities.json`, which is exactly what the field name says and the only reading under which `perMatch` means anything — and `test_fixtures.py:1061` is re-scoped to apply its team-equality assertion **only to team-scoped boards**. Note this is a *widening* of a shipped test's scope, not a weakening: the team-scope half keeps its exact assertion and the player half gains one it never had.

**Recommended for D4a (Option A).** `TeamRecord` = **all matches** — it backs the Team Profile `<title>`/OG "name + record", which would be wrong at 3 games for a finalist. Whatever is ruled, **state it in a docstring at every site**, because identically-named fields meaning different things is exactly the defect the 1.16 review named.

- *Option B — `TeamRecord` = group-only*, which keeps `test_fixtures.py:1061` unchanged and makes the two `played` fields agree by construction. **Rejected:** it publishes "P3 W3 D0 L0" as Argentina's tournament record on a route whose OG string is defined as *"name + tournament record"*, which is simply false, and it silently discards the knockout half of a knockout tournament.
- *Rejected — leaving the two fields to diverge undocumented.* They differ for 32 of 48 teams; an undocumented divergence is precisely how a reviewer of Epic 2 cannot tell whether a discrepancy on screen is their bug or ours (`data/fixtures/README.md:165-171` records that exact review finding against an earlier leaderboard/standings mismatch).

### D5 — Which metric codes get boards, at which scope, and in what board order?

**The problem.** Nothing anywhere specifies the board roster. AD-5 makes array order the App's default order, and there is no board `group`/`category` field — yet UJ-4 has Mariana "pick the physical board", implying a grouping the artifact cannot express. Story 2.13 is in backlog and will hardcode whatever ships.

**Note the UX/contract mismatch, and do not silently pick a reading.** UJ-4 step 3 is *"taps the 'Velocidad máxima' **column head**"*, which reads as one physical board with several metric columns. The contract's `Leaderboard` is **one board per metric with a single `value` column**. Under the shipped shape, "the physical board" = "the `topSpeed` board".

**Recommended (Option A) — the 36-board family-grouped roster below**, emitted in exactly this order so 2.13 can section it from `metricCode` alone without a board-group field. This is the roster D3's budget figures were measured against. All 32 codes are backed by real fields (verified), so the roster is a product choice, not a data constraint.

| Family | Team-scope boards (18) | Player-scope boards (18) |
|---|---|---|
| Physical | `distanceCovered`, `sprintDistance` | `topSpeed`, `sprints`, `highSpeedRuns`, `totalDistance` |
| Attacking | `goals`, `expectedGoals`, `shots`, `shotsOnTarget`, `crosses` | `goals`, `takeOns`, `stepIns`, `crossesCompleted` |
| Passing | `possession`, `passes`, `passesCompleted`, `passCompletion`, `ballProgressions`, `completedLineBreaks`, `receptionsInFinalThird` | `passesCompleted`, `passCompletion`, `ballProgressions`, `lineBreaksCompleted`, `switchesOfPlay` |
| Defending | `defensiveLineBreaks`, `defensivePressures`, `forcedTurnovers`, `secondBalls` | `tacklesWon`, `interceptions`, `possessionRegains`, `duelsWonAerial`, `duelsWonPhysical` |

- *Option B — all 32 codes at every scope they resolve at* (36 is already every code at every scope it legitimately has; this differs only if Juan wants codes duplicated across scopes where the units differ). **Rejected as the default:** `distanceCovered` is kilometres and `totalDistance` is metres, and the enum's own rule is *"No code carries two units"* — pairing them on one surface invites exactly the confusion the scoping rule exists to prevent.
- *Rejected — filing an AD-14 request for a board `group`/`category` field.* It would express UJ-4's "physical board" directly, but it is a contract change for a grouping that `metricCode` already determines, and Epic 2 has not raised it. Record the family mapping in `pipeline/README.md` instead so 2.13 inherits it.

---

## Tasks / Subtasks

> **Sequencing.** Task 1 first, always. **Task 3 is gated on D1/D4/D5, Task 4 on D3, Task 5 on D2, and Tasks 7.2/7.7 on D1/D3/D4. Tasks 2, 6, 8 and 9 are ungated** — Task 2 in particular can and should proceed immediately, because its three traps block everything and are independent of every ruling. Do not guess a gated decision. Nothing writes to `data/index/` until every gate has been evaluated (Task 8's collect-then-raise), because a partial `data/index/` becomes the pinning baseline exactly as landmine 20 describes.

- [x] **Task 1: Re-derive the probe before writing any generation code** (no AC; do this first)
  - [x] 1.1 Confirm the baseline: `contract/version.json` reads `{"schemaVersion": 4}`; `04f886e` and `74b1789` are both in `git log`; `data/matches/` holds 104 bundles; `data/index/` does not exist.
  - [x] 1.2 Re-measure the stage/group distribution from `data/matches/*.json`. Expect `group` 72, `r32` 16, `r16` 8, `qf` 4, `sf` 2, `third-place` 1, `final` 1; groups `a`–`l` × 6; `group` non-null **iff** `stage == "group"`.
  - [x] 1.3 Re-measure the tie landscape: equal-points pairs within each group, and whether any tie survives (points, GD, goals scored). **Do not copy my 7-and-zero forward — re-derive it.**
  - [x] 1.4 Re-run the ground-truth check: compute group standings, take the 12 winners + 12 runners-up + best-8 thirds, and compare against the actual R32 participants. This is your AC 5 anchor.
  - [x] 1.5 Re-measure the budget at your chosen board roster and cap, both readings (sum-of-gzips and gzip-of-concatenation), and record both numbers. **Measure the tie-extended row counts, not a hard cut** — AC 4's table gives both, and they differ by ~300 rows at a 100-row cap.
  - [x] 1.6 Verify all 32 `MetricCode` values resolve to a real field in a real bundle, and record the team/player scope split.

- [x] **Task 2: Resolve the serializer and precision traps BEFORE building anything** (AC: 1, 2)
  - [x] 2.1 **`decimals_map("tournament.schema.json")` RAISES `AssertionError` today.** Verified by running it. Its vacuity guard (`serialize.py:113-121`) assumes "only integer precisions ⇒ the `$ref` hop failed" — true for a Match Bundle, **false for `tournament.json`, which genuinely has no float field at all** (`Count`, `GoalDifference`, `Rank`, `ResultMatchNumber`, all `x-decimals: 0`). `main` maps `AssertionError` to **exit 2**, so a naive call fails the run as a broken harness. Parameterize the guard (e.g. `decimals_map(name, require_float=True)`, defaulting `True` so the bundle keeps its protection). **Do NOT wrap it in `try/except AssertionError`** — that re-opens the exact trap the guard exists to catch.
  - [x] 2.2 **`decimals_map("leaderboards.schema.json")` silently MISSES `LeaderboardPerMatchValue`.** It returns `{'Count': 0, 'Rank': 0, 'LeaderboardValue': 2}`. `perMatch`'s `x-decimals: 2` sits on an **untitled `anyOf` branch**, and the inline pass only records nodes carrying a `title`. Naive reuse leaves `perMatch` unrounded — it validates clean as `type: number`, and byte-identity then rests on float arithmetic. This is the same defect class as the 1.16 review's headline finding.
  - [x] 2.3 **`check_total` / `_def_properties` hardcode `match-bundle.schema.json`** (`emit.py:100-109`, `BUNDLE_SCHEMA` at `:72`), so `check_total(row, "StandingsRow", …)` raises `KeyError`. **Parameterize the document tuple; do not fork the function.** Keep its second loop — several contract objects are declared inline with a `title` rather than in `$defs`, and skipping that loop is how four objects went unasserted in 1.16.
  - [x] 2.4 Build a **`metricCode`-keyed** precision map for leaderboard `value`/`perMatch`. `contract/README.md:454-461` (decision 15) and `leaderboards.schema.json:35` both rule it: *"round to the precision of the source field named by `metricCode`, not to this default."* A key-only table cannot express this — `value` is polymorphic. Precisions: `Count` 0; `Percentage` 1 (`possession`, `passCompletion`); `KmPerHour` 1 (`topSpeed`); `Metres` 1 (`totalDistance`); `Kilometres` 2 (`distanceCovered`, `sprintDistance`); `ExpectedGoals` 2.
  - [x] 2.5 **Bind every leaf key explicitly. Never let a leaf inherit a parent's precision.** `round_bundle`'s docstring (`emit.py:1319-1340`) records that inheritance silently truncated 29 leaves (`lineHeight: 19.5 → 20`) while validating clean. `precision_by_key` (`emit.py:1424`) is bundle-specific and raises on unknown names — build your own small table, do not reuse it.

- [x] **Task 3: `pipeline/precompute/index.py` — the generation module** (AC: 1, 2) — *gated on D1, D4, D5*
  - [x] 3.1 Read input via `emit.load_spine(spine_dir)`, **not** `load_records`. It returns `(entities, matches)` and runs `check_spine_shape` on every **match** file (added by the 1.16 review, decision 3). **It does NOT guard `entities["players"]`** — `entities.json` gets only an `isinstance` check on `teams` and `matches`, and this story depends on `players` entirely. Extend the guard; do not let a bare `KeyError` escape an aggregator.
  - [x] 3.2 **Never mint an id.** `work/spine/entities.json` already carries every `team_id`, `player_id`, `match_id`, `team_code`, `match_number`, `matchday_round`, `group`, `stage`, `venue`, `date`, `kickoff`, `score`, and a `match_ids[]` per team and player. Re-deriving is the reinvention (`emit.py:640-642`) and a divergence would be unfalsifiable. **Do not parse the `m###` prefix** — `m052-bosnia-and-herzegovina-qatar` cannot be split by string rules.
  - [x] 3.3 **Strip the staging keys — at BOTH levels.** Top level: `entities.json` carries `spine_version`, `generated_by`, `code_version`, `source_manifest`; none may reach `data/index/` (`additionalProperties: false` rejects them, and `code_version` would break byte-identity across checkouts). **And per match: the spine's `score` is `{"home", "away", "shootout"}` while `common.schema.json`'s `TeamScore` is `additionalProperties: false, required ["home","away"]`.** Carrying `score` through verbatim fails validation on **every** `MatchResultRow`, `MatchEntity` and knockout row. Drop `shootout` — it decomposes into `knockoutScore`, exactly as `emit.build_metadata` does it (`emit.py:625-664`).
  - [x] 3.3a **Rule your source of truth and use it consistently.** Both `work/spine/` and the 104 committed bundles carry `score`, `matchNumber`, `venue`, `knockoutScore`. **The spine is the input** (it is what `emit.py` reads, and `data/matches/` is a downstream product of it); read bundles only for the per-player and per-team stat blocks the spine does not reshape. Two sources silently diverging is the unfalsifiable drift this story warns about everywhere else — state your choice in the module docstring.
  - [x] 3.4 Build the standings cascade per D1. Results derive from the **90-minute** score for group tables. Note `scoreAfter90` is itself a derivation (`metadata.goals` at `minute <= 90`, cross-checked against the cover score) — the cover prints one final score, *after* extra time when ET was played. Reuse `emit._knockout_score`, whose `winnerTeamId` is exactly the W/D/L input.
  - [x] 3.5 Build `form[]`: **group matches only** — `StandingsRow` is a group table and `test_fixtures.py:602` pins `len(form) == played`. `MatchResult` is exactly `["win","draw","loss"]`. **Order by `match_number` ascending and declare that key in the docstring**; AD-8 requires the ordering key to be stated, not implied. (Verified: `matchNumber`, `date`, `kickoff` and `matchdayRound` agree for every team, and no team plays two group matches on one date — so the key is unambiguous, but it must still be named.)
  - [x] 3.6 Build the leaderboards with competition ranking, ties ordered by ascending `entity.id`, per D3's cap, extended to the end of any boundary tie group.
  - [x] 3.6a **Player boards are populated from the 1,039 players who have a `players[]` performance block, NOT the 1,248 in the manifest.** The 209 lineup-only players have no Domain G row and cannot be ranked on any metric. This is *not* a contradiction of the entity list — `entities.players` lists 1,248 because it is the route manifest; a board ranks only what has data. **Team boards carry all 48.** Getting this wrong changes the row counts and the bytes.
  - [x] 3.7 **Write a local `_entity_ref(id, name) -> {"id", "name"}` helper — it does not exist yet.** `emit.py:249`'s `_team_ref` produces `{teamId, teamCode, name}` for `TeamRef`, a different shape; **do not reuse it.** Every team and player reference in *both* index artifacts is an `EntityRef` — `MatchResultRow.homeTeam`/`.awayTeam`, `MatchEntity.homeTeam`/`.awayTeam`, `StandingsRow.team`, `PlayerEntity.team`, `LeaderboardRow.entity` and `.team`. `TeamEntity` is the one exception: it carries flat `teamId`/`name`/`teamCode`, not a ref.
  **Public API, pinned** (the house precedent — every prior story pins its entry points):
  - `pipeline.precompute.index.build_tournament(entities, matches) -> dict`
  - `pipeline.precompute.index.build_leaderboards(entities, matches, bundles) -> dict`
  - `pipeline.precompute.index.emit_index(spine_dir, data_dir, *, expect_matches=None, dry_run=False) -> list[Path]`
  - `pipeline.precompute.index.build_parser() -> argparse.ArgumentParser`
  - `pipeline.precompute.index.main(argv: "list[str] | None" = None) -> int`
  - `pipeline.precompute.budget.over_budget_combined(label, texts) -> "tuple[str, int, int] | None"` — appended beside `over_budget`, same return-don't-raise contract

  **New typed errors, pinned** — append to `pipeline/precompute/errors.py` beside 1.15's and 1.16's, each subclassing `PrecomputeError` with the house `__init__(reason: str, report_id: str | None = None)` and a `what` class attribute. `BudgetExceededError`, `BundleValidationError` and `UnmappedFieldError` already exist from 1.16 — **reuse them, do not redefine**:
  - `IndexEmitError` — general index-emission failure (the default). **Do not name it `IndexError`**; that shadows a builtin.
  - `TiebreakUnresolvedError` — a standings tie survives the implemented cascade (D1).
  - `RouteManifestError` — the AD-4 bijection / entity-list gate failed. `errors.py:16` rules *"One exception per failure kind. Never overload one class for two kinds."*

- [x] **Task 4: The combined budget gate** (AC: 4) — *gated on D3*
  - [x] 4.1 Reuse `BUDGET_BYTES` and `gzip_bytes` from `pipeline/precompute/budget.py`. **Append** the combined function; do not redefine the constant. Mirror `over_budget`'s return-don't-raise contract so breaches are collected.
  - [x] 4.2 Raise `BudgetExceededError` naming **both** byte counts and the SM-C2 language. Do not "align" with `test_fixtures.py`'s raw-bytes tripwire — `budget.py:3-8` rules that explicitly.

- [x] **Task 5: The route-manifest / pinning gates** (AC: 3) — *gated on D2*
  - [x] 5.1 Implement D2's ruling. **Whatever D2 rules, the gate must never report a silent pass** — the unavailable branch prints `… this is NOT a pass`, and the successor test goes red by design when 1.18 lands.
  - [x] 5.2 **`check_committed_data` will not see your ids.** It globs `data_dir/"matches"/*.json` only, and `COMMITTED_ID_KEYS` (`identity.py:494-502`) is seven keys — `matchId, teamId, winnerTeamId, playerId, scorerPlayerId, fromPlayerId, toPlayerId`. **`EntityRef` uses a bare `"id"`**, which is in none of them, so every id in `data/index/` falls outside AD-3's immutability gate and the run still reports "all pinned". That is the gate-that-cannot-fail failure mode in the one place this project has been bitten three times. Either widen the walk (an out-of-scope edit to `identity.py` that must be **disclosed**, exactly as 1.16 disclosed `NULLABLE_ID_KEYS`) or write your own containment check over `data/index/`. **Do not let it fall through silently.** Adding a bare `"id"` to the map is ambiguous — it serves teams and players by context — so this is a design decision, not a copy-paste.
  - [x] 5.3 Write the totality test for your artifacts, modelled on `test_the_committed_id_check_is_total_for_a_match_bundle` (`test_emit_bundles.py:1499`): walk every key whose lowercased name ends in `id` and assert the covered set equals what your check walks.

- [x] **Task 6: The CLI** (AC: 1, 2, 3, 4)
  - [x] 6.1 The CLI lives **in `index.py`** — its own `build_parser()` and `main(argv) -> int`, pinned in Task 3's Public API — invoked as a third phase alongside `run` and `emit`. **`run.py` does not call `emit.py`** and will not call you; the phases are separate processes. Do not add a second module.
  - [x] 6.1a Flags, mirroring `emit.py`'s (`python -m pipeline.precompute.index`):

    | Flag | Meaning |
    |---|---|
    | `--spine-dir` | staged spine root, default `work/spine` |
    | `--data-dir` | artifact root, default `data` (writes `data/index/`) |
    | `--expect-matches N` | assert the match count **inside** the emit function, before the write and before any sweep |
    | `--dry-run` | build, validate, round and measure; write nothing; return the targets validated |
  - [x] 6.2 Exit contract, non-negotiable: `0` clean, `1` `PipelineError`, `2` `(OSError, AssertionError)`. Report malformed JSON as a harness failure — `json.JSONDecodeError` is a `ValueError` and would otherwise exit 1 with a traceback (1.16 patch 5).
  - [x] 6.3 Print `schemaVersion : {schema_version()}` in the banner. **Never hardcode `4`** — a literal would be a seventh declaration (landmine 4).

- [x] **Task 7: Tests** (AC: 1, 2, 3, 4, 5)
  - [x] 7.1 New modules `pipeline/tests/test_index_tournament.py` and `test_index_leaderboards.py`.
  - [x] 7.2 **Constructed tests that drive each gate RED** *(gated on D1, D3)*: the combined budget gate; a tie surviving the cascade (per D1); a precision leaf bound wrong; a truncation splitting a tie group. A gate proven only green would be the fourth gate-that-cannot-fail this project has shipped.
  - [x] 7.3 **Corpus tests**: byte-identity across two builds; LF/UTF-8/newline-terminated; no timestamp, path or `code_version` in the text; ordering of all six declared orders; competition-ranking correctness.
  - [x] 7.4 **AC 5 reproducibility**: recompute every standings and leaderboard value from the bundles and assert equality — never `emit(x) == emit(x)`. Include the R32 ground-truth test from 1.4.
  - [x] 7.5 **The committed-artifact drift test** — copy `test_the_committed_bundles_are_exactly_what_the_emitter_produces` (`test_emit_bundles.py:1530`) for `data/index/`. It compares **bytes, not parsed dicts**; a hand-edited committed artifact is invisible to a parsed comparison.
  - [x] 7.6 Test `main()` itself — all three exit codes — staging `--spine-dir`/`--data-dir` under `tmp_path`, **never at the real tree**.
  - [x] 7.7 Cross-artifact agreement per D4, extended from `test_fixtures.py:1061` to real `/data`.

- [x] **Task 8: Emission, orchestration and the all-or-none rule** (AC: 1, 2, 3, 4)
  - [x] 8.1 Order: **build → round → validate → serialize → measure → all gates → only then write.** Mirror `emit_bundles` (`emit.py:1544-1659`).
  - [x] 8.2 **Collect every failure, never abort on the first** — separate lists, separate typed raises, `sorted(...)[:10]` joined with `"; "` and `" …"` when truncated.
  - [x] 8.3 Emitting zero is a **FAIL** on both paths including dry run; dry run returns the targets it validated, not `[]`.
  - [x] 8.4 Validate with `validate_artifact(artifact, "tournament.schema.json", instance_label=…)` and the leaderboards equivalent, **before** the write.
  - [x] 8.5 Write with `write_canonical(json.loads(text), target)` from `pipeline/ingest/records.py` — the `json.loads(text)` round-trip is deliberate so the measured bytes and the written bytes are provably the same serialization.
  - [x] 8.6 Commit `data/index/` under AD-13. **Stage by explicit path; never `git add -A`.**

- [x] **Task 9: Documentation, ledger and verification** (AC: all)
  - [x] 9.1 Append to `pipeline/README.md` (append-only, prove it programmatically). Record the board roster, the cap and its measured numbers, the cascade tiers implemented and those deliberately not.
  - [x] 9.2 Append to `deferred-work.md` (append-only). Cite it **by quoted anchor phrase, never by line number** — Story 2.6 had to correct twelve citations after a twelve-line drift. **No `DW-nn` ids exist; do not invent one.**
  - [x] 9.3 Update `sprint-status.yaml` for this story key only.
  - [x] 9.3a **State the two negative scope declarations explicitly, because their absence reads as an omission**: this story adds no FR-15 gate check (`pipeline/validate/checks.py` reserves a *"1.16 bundle emission"* slot and none for 1.17), and no run-manifest entry.
  - [x] 9.4 Verify: `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests` — **~45 minutes; run it in the background, do not chunk it into runs that time out.** Record the collected/passed/failed counts. Do not report a sum in place of a run.

### Review Findings

<!-- Added post-implementation by the code-review workflow. -->

---

## Dev Notes

### Mental model (read this first)

1. **This story is a pure projection.** Every number it publishes already exists in `work/spine/entities.json` or the 104 committed bundles. It mints no ids, parses no PDFs and derives nothing the bundles do not contain (FR-19: *"precompute adds no data the bundles don't contain"*). Its entire job is to aggregate, order, rank, serialize and gate.
2. **`rank` is the one genuinely new judgement, and it is permanent.** AR-5/AD-5 make the App render it verbatim with no client-side recomputation, so every ordering decision lands here forever. That is why D1 exists and why it is not the dev agent's to decide.
3. **The schemas — not the AC — are the specification.** The AC names two of five required top-level keys. Emit from `contract/tournament.schema.json`, `contract/leaderboards.schema.json` and `contract/common.schema.json`, using the two committed fixtures for shape.

**The failure mode to guard against:** a gate that reports green while proving nothing. This project has shipped that defect three times (the pinning check with no baseline, the budget gate proven only on corpus data, the precision test that derived its expectation from the implementation). This story adds **four** new gates. Every one of them ships with a constructed test that drives it red.

### Probe results (2026-08-06) — re-derive every number, do not copy it forward

| Measurement | Value |
|---|---|
| Committed bundles | 104 |
| Stages | `group` 72, `r32` 16, `r16` 8, `qf` 4, `sf` 2, `third-place` 1, `final` 1 |
| Groups | `a`–`l`, 6 matches each; `group` non-null iff `stage == "group"` |
| Teams | 48 |
| Distinct players in lineups | **1,248** |
| Distinct players with a `players[]` performance block | **1,039** |
| Lineup-only players (no Domain G row) | **209** |
| All-zero `physical` rows | **1** — `m092`, `henderson-jordan-eng`, shirt 14 |
| Within-group equal-points pairs | 7; **all 7 separated by goal difference** |
| Within-group ties surviving (pts, GD, GF) | **0** |
| Ground truth: computed qualifiers vs real R32 | **exact match**, 24 automatic + 8 best thirds |
| `tournament.json` full corpus | 409,512 raw / **38,934 gzip-9** |
| Leaderboards at every cap | see AC 4's measured table — full roster **FAILS**, tie-extended 100-row cap passes at 23% of ceiling |
| Players eligible for a player board | **1,039** (those with a `players[]` block), not the 1,248 in the manifest |
| Players whose appearances ≠ their team's match count | **584 of 1,039 (56%)** — this is what makes D4b load-bearing |
| `MetricCode` values resolving to a real field | **32 of 32** |
| Drawn group ties (`winnerTeamId: null`) | 20 |
| `decidedBy` | 95 regulation, 5 extra-time, 4 shootout |

**The 209 lineup-only players are why AC 3 says "empty sections allowed, absence not."** They have no Domain G data, so Story 1.18 must still emit a near-empty profile for each. Do not filter them out of `entities.players`; a filtered manifest deletes 209 routes.

### What already exists — do not reinvent any of this

| Need | Already shipped | Where |
|---|---|---|
| Canonical JSON text | `canonical_json(obj) -> str` | `pipeline/ingest/records.py:41` |
| Atomic canonical write (LF-safe on Windows) | `write_canonical(obj, path) -> Path` | `pipeline/ingest/records.py:51` |
| gzip -9 measurement | `gzip_bytes(text) -> int`, `BUDGET_BYTES = 500_000` | `pipeline/precompute/budget.py:30,33` |
| Per-artifact budget check | `over_budget(label, text)` | `pipeline/precompute/budget.py:50` |
| Precision rounding | `round_to_precision(node, decimals)` | `pipeline/precompute/serialize.py:125` |
| Precision map from schema | `decimals_map(schema_name)` | `pipeline/precompute/serialize.py:56` |
| Schema validation (all violations at once) | `validate_artifact(obj, name, instance_label=)` | `pipeline/validate/schema.py:155` |
| The version stamp | `schema_version()` | `pipeline/validate/schema.py:55` |
| Spine load + shape guard | `load_spine(spine_dir)`, `check_spine_shape` | `pipeline/precompute/emit.py:1523,1503` |
| Knockout score / winner / decidedBy | `_knockout_score(match, codes, goals)` | `pipeline/precompute/emit.py:447` |
| Key-set totality assertion | `check_total(obj, def_name, where)` | `pipeline/precompute/emit.py:112` |
| Every id, already minted and pinned | `entities.json` teams/players/matches | `work/spine/entities.json` |
| Team codes (NOT derivable) | `TEAM_CODES` — 48 entries | `pipeline/precompute/slug_registry.py` |
| Knockout stage ordering | `KNOCKOUT_ROUNDS` | `pipeline/discover/rounds.py:43` |
| Typed errors | `EmitError`, `BudgetExceededError`, `BundleValidationError`, `UnmappedFieldError` | `pipeline/precompute/errors.py` |

**And the things you must NOT do:**
- **Do not hand-roll `json.dump`.** A second serializer is a second definition of canonical.
- **Do not copy `pipeline/validate/runner.py:241-256`**, which carries a second, non-atomic inline copy of the canonical-write recipe. It is pre-existing and ledgered. Do not "unify" it here either — that is a refactor of a shipped module outside this story.
- **Do not reuse `precision_by_key`** (`emit.py:1424`) — it validates against a ~140-entry bundle-specific table and would raise on the first bundle-only type name.
- **Do not derive a team code.** Six carry a letter their team's slug does not (`cpv`, `cuw`, `mar`, `ksa`, `esp`, `sui`), and no first-three-letters rule produces `rsa` or `cod` either.

### Contract reality — read before coding

`/contract` is **READ-ONLY** for this story. Current `schemaVersion` is **4**.

If anything here genuinely requires a shape change — a tiebreaker-reason field, a board grouping field, a third-place ranking table — it is an **AD-14 change request: Epic 2 raises, Epic 1 implements**, landed as **its own atomic commit with its own spec, before emission**. 1.16 broke that (CS-2 rode the emission commit) and took a review finding for it, disclosed precisely *"so the next AD-14 change-set is not planned from a precedent that looks like the rule was optional."* A bump is **six declarations** (`version.json` + five artifact `const`s) plus two generated type trees (`contract/` and `app/` — neither regenerates the other), re-pinned fixtures and the two hardcoded asserts in `test_contract_schemas.py`.

**There is no home in v4 for a third-placed-team ranking.** `tournament.json`'s top level is exactly `schemaVersion, tournamentName, groups, knockoutResults, entities`. The 2026 format's cross-group ranking of the 12 third-placed teams is therefore **out of scope** — not an omission to fix silently. (For the record, that table does contain a genuine tie: `ecuador` and `ghana` at 4 points / GD 0 / 2 goals scored, unresolved by tiers 1–3. Both advance, so it changes nothing.)

**Never edit a contract or JSON file through PowerShell `Get-Content`/`Set-Content`.** That round-trip baked a U+FFFD replacement character into `match-bundle.schema.json:504` and took a review finding. Use the edit tools.

### Failure & validation policy (AD-8, binding)

- **Assert on unknown.** One typed exception per failure kind; **never a bare `ValueError`**. The CLI maps `PipelineError` → 1 and untyped → 2, and overloading destroys that distinction.
- **Emit both artifacts or emit neither.** AD-8's "never abort the batch" governs per-report extract; emission has no per-report recovery, and a partial `data/index/` becomes the pinning baseline.
- **Delete stale artifacts, do not merely overwrite** — but sweep only *after* a successful write, and check counts *before* it (1.16 patch 3: a short spine deleted 54 committed bundles because the count check ran after the sweep).
- **Collect, then raise.** *"Aborting on the first turns one run into ten."*
- **Never resolve a discrepancy by making the numbers agree** (the standing 1.8/1.12 rule). Ship a bound, or raise.
- **Rule explicitly whether an empty list is a fact or a defect**, and declare it in code with a reason — never a fall-through. 1.16 decision 4 ruled that a zero-row `events.shots` is an extraction defect, not a fact about football.

### Testing standards summary

Run from the repo root:

```
pipeline\venv\Scripts\python.exe -m pytest pipeline/tests
```

A bare `python -m pytest` fails on `pymupdf`. There is no `pytest.ini`, `pyproject.toml` or `setup.cfg`; `conftest.py`'s `sys.path.insert` makes `pipeline.*` importable. **The full suite is ~45 minutes and a single foreground invocation gets killed in this environment — run it in the background.** Baseline at 1.16 review close: **1,501 collected, 1,500 passed, 1 skipped, 0 failed.**

Corpus fixtures are module-scope and read `work/spine/`, which is gitignored: they **skip locally and `pytest.fail` under `CI=1`**, because *"a skip is exactly how a missing input comes to read as a pass."*

**Naming:** long sentence-style test names, and a `CONSTRUCTED_` infix marks a constructed-not-corpus case (`test_precompute_identity.py:500,512,538,564,583,604`).

**The two-kind split is deliberate and must be preserved:** *constructed* tests drive each gate red; *corpus* tests run over the real staged spine. Mutation-check every test — each mutation must turn something red. Copy `test_a_key_bound_to_the_wrong_precision_is_caught` (`test_emit_bundles.py:795`), which monkeypatches the binding table and asserts the *precision test itself* goes red; that is the pattern that stops a test from passing by walking nothing.

### Coordination — in-flight stories (respect strictly)

**Story 1.16 is `done` as of `74b1789`** — the story request's warning that it is in-progress in `pipeline/` and `data/matches/` is stale, and the coordination hazard it described is gone. `data/matches/` is committed and stable; treat it as a read-only input.

**A concurrent session frequently dirties `app/`.** This story touches no `app/` file. Stage by explicit path and **never `git add -A`** — a sweeping stage from another session has captured uncommitted work in this repo before. Commit your own slices early.

**Shared files — edit APPEND-ONLY:**
- `pipeline/precompute/errors.py` — append typed subclasses beside 1.15's and 1.16's.
- `pipeline/precompute/budget.py` — append the combined function; do not redefine `BUDGET_BYTES`.
- `pipeline/tests/test_fixtures.py`
- `pipeline/README.md` — append-only, proven programmatically.
- `_bmad-output/implementation-artifacts/deferred-work.md` — append-only, proven programmatically.
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Out-of-scope edits that may prove necessary** (`serialize.py` for the vacuity guard, `emit.py` for `_def_properties`, `identity.py` for the id-key walk): make them minimal and **disclose each one in the Dev Agent Record**, exactly as 1.16 disclosed its `NULLABLE_ID_KEYS` edit to `identity.py`.

**Off-limits:** `app/`, `spike/`, `contract/**`, `data/fixtures/**`, `data/matches/**`, `pipeline/markers/`, `pipeline/extract/`, `pipeline/discover/`, `pipeline/ingest/`, and `pipeline/precompute/{spine,records,run,slug_registry}.py`.

### Known landmines (live risks for this story)

1. **`decimals_map("tournament.schema.json")` raises `AssertionError` → exit 2.** Verified. Task 2.1.
2. **`decimals_map("leaderboards.schema.json")` silently omits `LeaderboardPerMatchValue`**, leaving `perMatch` unrounded and byte-identity resting on float arithmetic. Task 2.2.
3. **`check_total` / `_def_properties` `KeyError` on `StandingsRow`.** Task 2.3.
4. **Precision inheritance.** Bind every leaf key explicitly; an unbound key must round nothing. This silently truncated 29 leaves in 1.16 and validated clean.
5. **`over_budget` cannot express the combined gate**, and full-roster leaderboards breach it by 22%. Tasks 4, D3.
6. **`check_committed_data` never looks at `data/index/`, and `EntityRef`'s bare `"id"` is in none of the seven `COMMITTED_ID_KEYS`** — the run will report "all pinned" while unpinned ids ship. Task 5.2.
7. **Writing a bijection assert that cannot pass.** D2.
8. **Hardcoding the version integer.** Read `schema_version()`.
9. **Truncating a leaderboard mid-tie**, publishing an arbitrary subset of equals.
10. **Treating the fixtures as a content target.** They are hand-authored; `m001`'s `physical.totalDistance` disagrees with the printed value on 30 of 31 players and the fixtures break `domain-g-zone-sum` on 79 of 96 rows. **Develop against `work/spine/` and `data/matches/`, never against `data/fixtures/`.**
11. **Emitting `[]` where a ruling says `null`, or vice versa.** `perMatch` is required-but-nullable — `null` must be *written*, not omitted.
12. **Asserting the batch exits 0.** `pipeline.ingest.batch` over the full corpus **exits 1 by design**; the clean baseline is `extracted 104 / failed 0 / self-validation-failed 2` (`PMSR-M19-ARG-V-ALG`, `PMSR-M58-TUN-V-NED`). **Never filter records on `self_validation`** — both are ruled consumed. `precompute.run` and `emit` exit 0 on a clean run.
13. **Crediting own goals to the scorer.** 14 corpus own goals are credited to the **benefiting team** while `scorerPlayerId` names the scorer.
14. **Ranking on the wrong passing number.** Domain G's `passes_completed` exceeds the pass-matrix row sum on **1,290 of 3,289 rows**. State which one a passing board ranks.
15. **Publishing a conversion rate.** `goals <= attemptsAtGoal` is **corpus-false on 4 reports** and the column's definition is unknown; a goals/shots ratio exceeds 100% for four players.
16. **Zero-contribution players topping a rate board.** **43 players corpus-wide have zero combined incoming and outgoing pass-network edge volume** — including `m092` #14 HENDERSON, `m011` #19 BROBBEY, `m088` #1 RYAN, `m102` #15 BURN. (They are *players with zero edge volume*, not "null nodes": `events.passNetworkNodes` is `null` in all 104 bundles by ruling, along with `crosses`, `defensiveActions` and `receiving`; only `passNetworkEdges` and `shots` carry rows.) There is **no `minutesPlayed` field in any bundle** — a minimum-minutes floor would have to be derived from `substitutedOn`/`substitutedOff`, so rule whether you want one at all. Note `perNinety` is Story **1.18**'s profile slot; `leaderboards.schema.json` has only `perMatch`, so the divide-by-zero hazard here is a zero-appearance entity, which D4b's ruling removes by construction. Separately, the Domain G row→lineup join has exactly **one** anomaly: `PMSR-M92-MEX-V-ENG` away #14 Jordan HENDERSON, an unused substitute (booked from the bench at 98', never played) who nonetheless has a printed all-zero row on all four families, so 3,289 rows meet 3,288 lineup entries with minutes. `domain_g.py:399-406` special-cases him and **that must not be removed**; 1.14 independently found his pass-matrix column all-zero too. **He is real, not a defect** — but `pipeline/README.md:734` names this story's risk directly: an orphan row carrying real numbers *"must not stage a phantom's stat line into the physical leaderboards."*
17. **Miscounting the reconciliation.** "3,289 joined" counts **rows**, not lineup entries; the complementary decomposition of the same 5,392 is `3,288 with minutes + 2,104 without`. Both `3,289 + 2,103` and `3,288 + 2,104` equal 5,392 and they count different things. Cite `pipeline/README.md:714-734` and `:1255-1257` — **not `deferred-work.md`, which never mentions this story.**
18. **Never mint an id, and never parse the `m###` prefix.** Every id already exists in `entities.json`; re-deriving is the reinvention (`emit.py:640-642`) and a divergence would be unfalsifiable. `m052-bosnia-and-herzegovina-qatar` cannot be split by string rules.
19. **Two `played` fields meaning different things.** D4.
20. **A partial write with no rollback.** An `OSError` mid-write leaves `data/index/` partially populated; the ledger routes the staged-directory fix to 1.19, but this story adds a second write path.

### Project Structure Notes

**New:**
- `pipeline/precompute/index.py`
- `pipeline/tests/test_index_tournament.py`
- `pipeline/tests/test_index_leaderboards.py`

**Modified (additive / append-only):**
- `pipeline/precompute/budget.py` (combined gate), `pipeline/precompute/errors.py` (typed subclasses)
- `pipeline/precompute/serialize.py`, `pipeline/precompute/emit.py`, `pipeline/precompute/identity.py` — **only** the minimal parameterizations in Tasks 2 and 5.2, each disclosed
- `pipeline/tests/test_fixtures.py`, `pipeline/README.md`, `deferred-work.md`, `sprint-status.yaml`

**Emitted and committed (AD-13):**
- `data/index/tournament.json`
- `data/index/leaderboards.json`

**Read-only inputs:** `work/spine/`, `data/matches/` (104 bundles), `contract/**`

**Unchanged by design:** `app/`, `spike/`, `data/fixtures/**`, `pipeline/{markers,extract,discover,ingest}/`, `pipeline/precompute/{spine,records,run,slug_registry}.py`

### References

- [Source: epics.md:543-566] — Story 1.17's four Given/When/Then blocks, reproduced verbatim above
- [Source: epics.md:44] — FR-19, *"with pipeline-computed rank incl. FIFA tiebreakers"* and *"every value reproducible from Match Bundles"*
- [Source: epics.md:85-86] — AR-4 and AR-5
- [Source: prd.md:241-245] — FR-19 and its testable consequence: *"precompute adds no data the bundles don't contain"*; [:301-305] FR-26, leaderboards incl. physical metrics; [:387] §5 per-route payload budget; [:452] **SM-C2**, depth preservation
- [Source: data/fixtures/README.md:150-160] — entity lists name only what has an artifact, and *"AR-4's bijection assert runs against real `/data` in Story 1.17, not against fixtures"*; [:165-171] the leaderboard/standings `matchesPlayed` mismatch a prior review caught
- [Source: ARCHITECTURE-SPINE.md:64-68] — AD-4: the exact artifact set, the route-manifest bijection, and the combined budget unit
- [Source: ARCHITECTURE-SPINE.md:70-74] — AD-5: aggregation only in precompute; *"user-initiated re-ordering only — canonical/default order always comes from the artifact"*
- [Source: ARCHITECTURE-SPINE.md:82-92] — AD-7 locale-neutral values, AD-8 canonical serialization and determinism
- [Source: contract/tournament.schema.json:5,101,231] — the file's three jobs; the `rank`/FIFA-cascade rule; `EntityIndex` naming this story as the bijection's owner
- [Source: contract/leaderboards.schema.json:5,35,43] — closed `metricCode` enum; the metric-dependent precision rule; `perMatch` nullable
- [Source: contract/common.schema.json] — `MetricCode` (32), `Rank`, `EntityRef`, `LeaderboardScope`, `AggregationSemantics`, `MatchResult`
- [Source: contract/README.md:454-461] — decision 15, the five polymorphic slots needing `metricCode`-keyed rounding
- [Source: data/fixtures/index/tournament.json] and [Source: data/fixtures/index/leaderboards.json] — the worked shapes; **shape only, never content**
- [Source: pipeline/README.md:714-734, 1255-1257] — the Domain G reconciliation and the Henderson anomaly
- [Source: pipeline/README.md:1584-1585] — *"AC 2's 'and aggregates' clause is explicitly deferred to Story 1.17"*
- [Source: _bmad-output/implementation-artifacts/cs-2-change-set-spec.md] — CS-2's scope, and the AD-14 atomic-commit correction
- [Source: 1-16-…md:116-146, 549-591] — the canonical writer binding, the precision rule, the failure policy, the 16 landmines
- [Source: 1-15-…md:298-299, 481, 751-756] — the spine's entity shape, and the "and aggregates" deferral as a ruling
- [Source: review-adversary.md:81-85] — H6, the origin of the `rank` rule; **the parenthetical is not a specification**
- [Source: EXPERIENCE.md:226, 265] — leaderboard altitudes (top-3 teaser + full table); the eight standings columns

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), via the `bmad-dev-story` workflow.

### Debug Log References

- Task 1 probe and the D3 budget re-measurement were run as throwaway scripts under the
  session scratchpad; every number they produced is reproduced by a committed test.
- `pipeline\venv\Scripts\python.exe -m pipeline.precompute.index --dry-run --expect-matches 104`
  (exit 0, nothing written), then the same without `--dry-run` (exit 0, two artifacts).

### Completion Notes List

**All five decisions were ruled by Juan before Task 3 began**, and Tasks 1 and 2 — which the
story marks ungated — were completed first so the rulings were taken against fresh
measurements rather than against the story's forwarded numbers.

**Every probe number in the story re-derived, and one did not hold.** Reproduced exactly:
104 bundles; stages 72/16/8/4/2/1/1; groups `a`-`l` × 6 with `group` non-null iff
`stage == "group"`; 48 teams / 1,248 manifest players / 1,039 with a performance block / 209
lineup-only; **7 adjacent equal-points pairs, all 7 separated by goal difference, zero ties
surviving points→GD→goals scored**; the computed 12 winners + 12 runners-up + best-8 thirds
**are** the real R32 field (24/24 and 8/8, best thirds `congo-dr, sweden, ecuador, ghana,
bosnia-and-herzegovina, algeria, paraguay, senegal`); 32/32 MetricCodes resolve with zero
orphans; 14 own goals; 20 drawn group ties; `decidedBy` 95/5/4; the `ecuador`/`ghana`
third-place tie is real and both advance.

**The correction is D4b's mechanism, and it was load-bearing.** The story recommended
`matchesPlayed = len(entity["match_ids"])` from `entities.json`. **That field is the
teamsheet, not appearances** — measured, it differs from the team's match count for only
**13** of 1,039 ranked players, and six players are on the sheet for 8 matches with a single
Domain G row (`thuram-marcus-fra`, `lo-celso-giovani-arg`, `zubimendi-martin-esp`,
`pubill-marc-esp`, `iglesias-borja-esp`, `palacios-exequiel-arg`). Taking it literally would
have divided one match's value by eight — the exact defect D4b exists to prevent. The
story's 584/56% figure is real and belongs to the **Domain G performance-row count**. Juan
ruled that count, and it makes `perMatch == value / matchesPlayed` true by construction.

**Rulings taken at dev level, recorded because they are not obvious from the code:**

1. **`perMatch` rounds to the SLOT's 2 places, not to the metric's source precision.** The
   schema says "precision is metric-dependent; see LeaderboardValue", but applying a count
   metric's 0 places to a rate publishes 1 for 5 goals in 8 matches and misses the shipped
   `abs(perMatch - value/matchesPlayed) < 0.05` invariant by 0.375. A rate is not a value in
   the source field's unit. Proven by a constructed test rather than asserted in a comment.
2. **`perMatch` on an `average` board is the value itself**, not `value / matchesPlayed`
   (which would publish 21.8% possession for a team that held 65.5% in three matches) and
   not `null` (which the contract reserves for metrics that are not rateable, naming
   `topSpeed`). The shipped fixture's one `average` board carries a non-null `perMatch`
   equal to its value.
3. **Percentage boards aggregate as an unweighted mean of the printed per-match values.** A
   weighted rate (`sum(completed)/sum(attempted)`) is computable and arguably truer, but it
   is none of `sum`, `max` or `average` and would be **misdeclared** under the closed
   `AggregationSemantics` enum. The honest, contract-expressible choice was taken.
4. **`identity.py` was NOT edited.** Task 5.2 offered widening `COMMITTED_ID_KEYS` or writing
   an own check, and flagged that a bare `"id"` entry there is ambiguous. It is: `EntityRef.id`
   names a team or a player by context. The index artifacts assert their own containment
   instead, with a context-carrying walk in which an unclassifiable `"id"` **raises**, plus
   the Task 5.3 totality test proving the walked set equals a naive every-key-ending-in-`id`
   walk (5,000+ sites). One fewer out-of-scope edit than the story anticipated.

**Out-of-scope edits, disclosed** (all three minimal, all three pinned by a test):

- `serialize.py` — `decimals_map(name, *, require_float=True)` parameterizes the vacuity
  guard; the guard stays armed by default and is opted out of at exactly one call site.
  **Not** wrapped in `try/except AssertionError`, which would have disarmed it forever.
- `serialize.py` — the inline pass now reads `_declared_places(node)` instead of
  `node.get("x-decimals")`, so a precision declared on an untitled `anyOf` branch is seen.
  **Measured: this adds exactly one name in the whole contract**
  (`LeaderboardPerMatchValue`), and both `match-bundle.schema.json` and
  `tournament.schema.json` are unchanged by it — so no committed Match Bundle moves a byte.
  `test_the_bundle_precision_map_is_unchanged_by_this_story` pins that.
- `emit.py` — `_def_properties(name, documents=())` and `check_total(..., documents=())`
  take the document tuple, defaulting to the bundle pair so every Story 1.16 call site is
  byte-for-byte unchanged. Parameterized, not forked: a copy tends to drop the inline-title
  loop, which is how four objects went unasserted in 1.16.

**Four gates ship, and every one of them has a constructed test that drives it RED** — the
project has shipped a gate-that-cannot-fail three times:

| gate | red-by-construction test |
|---|---|
| combined payload budget | two texts each under the ceiling whose sum is over it; **and** removing `PLAYER_ROW_CAP` on the real corpus |
| tiebreak cascade exhaustion | two rows equal on points, GD and goals scored |
| precision binding | re-binding a leaf to a different type must change the rounding |
| id containment / route manifest | an unpinned id, a null id, an orphan bundle, a listed match with no bundle, and the populated profile branch |

**D2's honest gate.** `check_route_manifest` asserts the direction that can run today (104
committed bundles ↔ 104 listed routes) and prints `This is NOT a pass.` twice for the
profile direction, which is Story 1.18's. `test_the_repository_has_no_committed_profiles_yet`
goes **red by design** when 1.18 lands, and the populated branch is already live and
exercised by a constructed test, so the successor does not inherit a gate nobody has run.

**Measured at emission:** `tournament.json` 409,524 raw / **39,137** gzip-9;
`leaderboards.json` 962,885 raw / **78,501** gzip-9; **combined 117,638 against a 500,000
ceiling — 23.5%**. 36 boards, 2,965 rows, tie-extended. Full-roster would be **610,341 —
FAIL**, and that failure is reproduced as a test rather than quoted.

**Negative scope, stated because its absence would read as an omission:** no FR-15 gate check
was added (`pipeline/validate/checks.py` reserves a "1.16 bundle emission" slot and none for
1.17) and no run-manifest entry (`run.py` does not call `emit.py` and does not call this
module; the three phases are separate processes).

**Concurrent-session disclosure.** `pipeline/precompute/errors.py` is co-mingled: a
concurrent Story 1.18 session added `ProfileError` and `ProfileValidationError` to it while
this story was appending `IndexEmitError`, `TiebreakUnresolvedError` and `RouteManifestError`.
Committing this story's slice necessarily carries those two classes, because `index.py` does
not import without the file. They are purely additive and their consumer
(`pipeline/precompute/profiles.py`) is deliberately **not** staged, so nothing in this commit
references them. Recorded rather than repaired, per this repo's precedent on commit 5344fac.
`git add -A` was never used; every path was staged explicitly. `app/` was not touched.

`data/fixtures/` was used for SHAPE only and never as a content target, and everything was
developed against `work/spine/` and `data/matches/`.

**Task 9.4 — the verification run, reported as run rather than as a sum.**

`pipeline\venv\Scripts\python.exe -m pytest pipeline/tests` (background, single
invocation): **1,588 passed, 4 failed, 1 skipped in 1:51:49**. The baseline at 1.16 review
close was 1,501 collected; this story contributes +93 across two new modules.

**All four failures were diagnosed to the shared working tree, not to this story, and all
four are green now.** The run took 112 minutes — roughly double the documented ~45 — because
two concurrent sessions were executing and WRITING to `pipeline/`, `data/fixtures/` and
`data/index/` throughout it.

| failure | cause | now |
|---|---|---|
| `test_fixtures::test_the_team_profile_record_matches_its_own_per_match_rows` | transient: the 1.18 session was mid-write on `data/fixtures/index/team-profiles/` | passes |
| `test_ingest_fingerprint::test_code_version_is_stable_across_calls` | transient: `pipeline/` changed mid-run (`profiles.py` appeared), so the memoized fingerprint no longer matched a re-read | passes |
| `test_index_tournament::test_the_repository_has_no_committed_profiles_yet` | **this story's red-by-design tripwire firing correctly** — see below | superseded |
| `test_index_tournament::test_the_cli_prints_the_profile_gap_rather_than_a_silent_pass` | same cause: the populated branch ran, so the pre-1.18 wording was no longer printed | fixed and passes |

**Verified in an isolated worktree at `ae207ed`** (junction to the real `work/spine`), which
is the house practice for exactly this contamination: **110 passed, 0 failed**, covering both
new modules and both non-1.17 failures above.

**D2's tripwire fired, and the mechanism worked end to end.** The concurrent Story 1.18
session emitted 48 team and 1,248 player profiles into the shared tree mid-run. That is
precisely the event the tripwire exists to announce. Better still, it let
`check_route_manifest`'s populated branch run against real successor output for the first
time, and **AC 3's full bijection HELD on all three namespaces**:

```
matches: 104 committed bundle(s) <-> 104 listed route(s) - bijection holds
teams:    48 profile(s)          <->  48 listed route(s) - bijection holds
players: 1248 profile(s)         <-> 1248 listed route(s) - bijection holds
```

The 1248↔1248 result independently confirms the decision **not** to filter the 209
lineup-only players out of `entities.players`: a filtered manifest would have failed this
bijection by 209 routes.

**Two concurrent-session outcomes, both ruled by Juan rather than taken unilaterally.** The
CLI test was rewritten to assert the invariant that actually matters — each namespace
reports a verdict, before OR after 1.18 — so it can no longer go red on a successor doing
the right thing. And the 1.18 session **edited this story's test file directly**, deleting
the tripwire and substituting
`test_the_route_manifest_bijection_holds_against_the_committed_profiles` under a "ruling R3"
that assigns the bijection assert to 1.17's file. Juan ruled: **keep their test, do not
overwrite a concurrent session's coordinated work.** So `pipeline/tests/test_index_tournament.py`
co-carries that replacement test, whose premise — profiles COMMITTED — is not yet true (1.18
has nothing staged; only this story's two artifacts are tracked under `data/index/`). It
passes today against their on-disk output and **their commit must land the profiles for it to
keep passing on a fresh clone.** Recorded, not repaired.

### File List

**New:**
- `pipeline/precompute/index.py`
- `pipeline/tests/test_index_tournament.py`
- `pipeline/tests/test_index_leaderboards.py`
- `data/index/tournament.json`
- `data/index/leaderboards.json`

**Modified:**
- `pipeline/precompute/serialize.py` — `decimals_map` vacuity-guard parameter; anyOf-aware inline precision pass
- `pipeline/precompute/emit.py` — `_def_properties` / `check_total` take a document tuple
- `pipeline/precompute/budget.py` — appended `over_budget_combined`
- `pipeline/precompute/errors.py` — appended `IndexEmitError`, `TiebreakUnresolvedError`, `RouteManifestError`
- `pipeline/README.md` — appended the Story 1.17 section (append-only proven programmatically)
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended five items (append-only proven programmatically)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-17-tournament-index-results-standings-leaderboards.md`

**Deliberately unchanged:** `contract/**`, `data/fixtures/**`, `data/matches/**`,
`pipeline/precompute/identity.py`, `pipeline/tests/test_fixtures.py`, `app/`, `spike/`.

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story context created. Baseline `74b1789` (not `04f886e` as requested — the 1.16 review is newer and contains CS-2 in full). Probe measured against the 104 committed bundles: the corpus is the 48-team/12-group 2026 format; 7 within-group equal-points pairs, all separated by goal difference, **zero** ties surviving tier 2; `points → GD → GF` reproduces the actual R32 field exactly (24 automatic qualifiers + the real 8 best thirds). Five decisions surfaced for Juan and **left unruled**: D1 the FIFA cascade (unspecified anywhere in-repo — four sources bind it, none defines it), D2 the AD-4 bijection ordering (1.18 owns the artifacts; 1.15's two-source precedent recommended), D3 the combined budget (measurement mode absent; full-roster leaderboards measured at 611,210 bytes against a 500,000 ceiling — **FAIL** — and 105,779 at a 100-row player cap), D4 `TeamRecord.played` semantics (differs from `StandingsRow.played` for 32 of 48 teams), D5 the board roster. Three traps reproduced by running the code: `decimals_map("tournament.schema.json")` raises `AssertionError`; `decimals_map("leaderboards.schema.json")` silently omits `LeaderboardPerMatchValue`; `check_total`/`_def_properties` `KeyError` on `StandingsRow`. Corrected three premises in the story request: CS-2 did **not** change either index schema structurally (one-line `const` bump each); Story 1.16 is `done`, not in-progress; the Domain G reconciliation is in `pipeline/README.md`, not `deferred-work.md`, which never mentions this story — and 43 all-zero pass-network nodes exist corpus-wide, not one. Validated by two fresh-context agents against `checklist.md` and against 1-15/1-16 house style; all findings applied. That pass independently re-verified ~30 citations, re-ran the three traps, and re-derived the budget arithmetic; it corrected the AC line ranges (`551-566`, label `:549`), reconciled the gate-that-cannot-fail count to three, resolved a CLI module contradiction against the Public API pin, added the D1–D5 index table, gave D4 and D5 their missing rejected alternatives, enumerated D5's 36-board roster so it is rulable, named the three new typed errors, and folded the Henderson section into landmines 16–18. The adversarial pass found **no fabrications** but four defects that would have produced a wrong implementation, all now fixed: (1) `matchesPlayed` on a PLAYER row was undefined and the fixture's rule uses the *team's* match count — **584 of 1,039 players (56%) differ**, so `perMatch` would have been wrong on more than half of every player board; D4 is now two questions and D4b is the load-bearing one. (2) The spine's `score` carries a third key `shootout` that `TeamScore`'s `additionalProperties: false` rejects — "carry it through verbatim" would have failed validation on every result row. (3) `_entity_ref` **does not exist**; the instruction read as "reuse the existing helper". (4) AC 4's cap table was hard-cut while the story mandates tie-extension, so the ordered re-measurement was unreconcilable; both columns are now given, with the tie-extended figures marked approximate because an independent re-run differed by one row. Also corrected: `ARCHITECTURE-SPINE.md:176`→`:177`, a binary-KiB figure in a decimal-budget story, "43 all-zero pass-network nodes"→43 players with zero edge volume (`passNetworkNodes` is `null` in all 104 bundles), `perNinety` is 1.18's slot not this one, and `load_spine` does **not** guard `entities["players"]`. |
| 2026-08-06 | Story implemented; status ready-for-dev → review. **All five decisions ruled by Juan before Task 3 began** (D1 tiers 1-3 + typed raise; D2 Story 1.15's two-source pattern; D3 sum-of-gzips + a 100-row tie-extended player cap; D4a `TeamRecord` = all matches; D4b `matchesPlayed` = the entity's own appearances; D5 the 36-board family-grouped roster), each taken against re-derived measurements rather than the story's forwarded numbers. **Every probe figure reproduced except one, and that one was overturned:** D4b's recommended mechanism, `len(entity["match_ids"])`, is the TEAMSHEET — it differs from the team's match count for only **13** of 1,039 ranked players, and six players sit on the sheet for 8 matches with a single Domain G row, so it would have divided one match's value by eight. The story's 584/56% figure is real and belongs to the **performance-row count**, which is what shipped. All three shipped-code traps cleared as specified: `decimals_map`'s vacuity guard is parameterized (still armed by default, opted out at one call site, never `try/except`); the inline precision pass is now anyOf-aware and **measured to add exactly one name in the whole contract**, leaving the Match Bundle and tournament maps untouched so no committed bundle moves a byte; `check_total`/`_def_properties` take a document tuple rather than being forked. `identity.py` was **not** edited — a bare `"id"` in `COMMITTED_ID_KEYS` would be ambiguous, so the index artifacts assert their own containment with a context-carrying walk that RAISES on an unclassifiable id, plus a totality test over 5,000+ id sites. Four gates ship and every one has a constructed test driving it red, including removing the row cap on the real corpus to reproduce the 610,341-byte breach. **Emitted: `tournament.json` 409,524 raw / 39,137 gzip-9, `leaderboards.json` 962,885 / 78,501, combined 117,638 against 500,000 — 23.5% of ceiling**, 36 boards / 2,965 rows. Three dev-level rulings recorded: `perMatch` takes the slot's 2 places (the metric's own precision breaks the shipped tolerance by 0.375 on count metrics, proven by test), `perMatch` on an average board is the value itself, and percentage boards use the unweighted mean because a weighted rate is none of the three `AggregationSemantics` values. `pipeline/README.md` and `deferred-work.md` appended with the append-only property proven programmatically (+13,756 and +3,406 bytes, prefixes byte-identical, no CRLF). Disclosed: `errors.py` is co-mingled with a concurrent Story 1.18 session's two additive classes, which this commit necessarily carries; their consumer is not staged. |

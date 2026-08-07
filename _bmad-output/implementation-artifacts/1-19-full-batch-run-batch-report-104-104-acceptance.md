---
baseline_commit: 12fad17
---

# Story 1.19: Full-Batch Run, Batch Report & 104/104 Acceptance

Status: ready-for-dev

## Story

As the pipeline operator,
I want the full 104-report batch executed with a self-sufficient batch report and every artifact committed,
So that the complete, validated dataset exists and SM-1 is met — or every residual failure is individually documented (FR-16).

> **Nine things the story-creation probe established at `12fad17` (verified HEAD). Do not
> re-derive them; do re-measure any figure you intend to assert.**
>
> 1. **THE ARTIFACTS ALREADY EXIST AND ARE TRACKED. This story is not a first emission.**
>    `git ls-files data/ | wc -l` → **1412**: 104 bundles (`data/matches/`, 1.16), 2 index
>    artifacts (`data/index/{tournament,leaderboards}.json`, 1.17), 1,248 player profiles + 48
>    team profiles (1.18), and 10 fixture files. `git status --short data/ pipeline/` is
>    **empty** — both trees are clean. Your ACs are the **end-to-end run, the report, the
>    acceptance and the reproducibility proof**, not a first write.
> 2. **THE BATCH EXITS 1 BY DESIGN AND HAS SINCE STORY 1.12. Never assert exit 0.** The ruled
>    clean-corpus baseline is `extracted 104 / failed 0 / corpus_gaps 0 / orphan_record_paths 0`
>    with **exactly two** self-validation failures, `PMSR-M19-ARG-V-ALG` and
>    `PMSR-M58-TUN-V-NED`. `failed_count` stays **0**. A verification step asserting a zero exit
>    code is, in the ruling's own words, *"now wrong"*.
>    [Source: `pipeline/README.md:516-523`; `deferred-work.md` anchor *"ACCEPTED — two corpus
>    pages draw one forced-turnover marker fewer than their own printed total"*]
> 3. **A THIRD self-validation failure is a real regression and re-opens the 1.12 ruling.** Your
>    run is the tripwire. Stories 1.9 and 1.14 each re-confirmed *"exactly 2, no third"*.
>    [Source: `1-9-…md:427-431`, `1-14-…md:224`]
> 4. **THE WARNINGS BLOCK PRINTS 728 LINES OF STRUCTURAL NOISE AND THAT IS AC 1's DIRECT
>    ANTAGONIST.** Every one of the 104 records carries the **same seven** absence warnings —
>    properties of the page family, not of any report — and `format_summary` prints one line per
>    report per warning. 104 × 7 = **728**. AC 1 requires a reader to identify every failure
>    *"without opening logs or artifacts"*. **This story rules the de-duplication.** See
>    §RULINGS TAKEN, D1.
> 5. **`code_version()` fingerprints ALL of `pipeline/**/*.py` (plus `requirements.txt`), and a
>    single docstring save invalidates all 104 staged records.** Stories 1.9 and 1.14 both hit
>    this mid-batch and both ruled it a **false alarm, not a determinism defect**. 1.14's first
>    skip-unchanged attempt showed 104 re-extracted with all 104 hashes changed because a
>    concurrent session saved `domain_e.py` at 21:40 mid-run. **The byte-identical re-run is an
>    acceptance condition and requires a quiet `pipeline/` tree.** Sequence it last.
>    [Source: `1-14-…md:496-498`, `1-9-…md:483-489`, `sprint-status.yaml:2016-2024`]
> 6. **A NAIVE ONE-PASS E2E RUN DEADLOCKS.** `check_route_manifest`'s profile direction is
>    **write-blocking** and runs before the first `write_canonical`, so with profiles on disk,
>    `index.py` refuses to emit `tournament.json` until a profile artifact exists for every
>    entity — but profiles are built *from* that manifest. The documented recourse is ugly
>    (empty both profile directories → run `index` → re-run `profiles`). The ledger says
>    **"Story 1.19 owns end-to-end orchestration, which is where the phase ordering should be
>    expressed."** [Source: `pipeline/precompute/index.py:1178-1212`; `deferred-work.md` anchor
>    *"the profile direction PRINTS that it could not run"*]
> 7. **TWO COMMITTED WRITE PATHS ARE STILL NOT ALL-OR-NOTHING, AND THAT DIRECTLY THREATENS
>    AC 3.** `emit_bundles` (→ `data/matches/`) and `emit_index` (→ `data/index/*.json`) write
>    per file with no rollback. An `OSError` on bundle 57 exits **2** — the code whose stated
>    meaning is *"nothing was learned"* — with 56 files written, the stale sweep skipped, and
>    the next `check_committed_data` **pinning that partial namespace as the AD-3 immutability
>    baseline**. 1.18 already shipped the fix pattern (`profiles._swap_directory`). Both entries
>    are routed to this story by name.
> 8. **THE APP-SIDE FIXTURES→`/data` FLIP IS STORY 2.19's, NOT YOURS.** AC 3's *"replaces
>    fixtures as Epic 2's data source"* means **you commit `/data`**; 2.19 flips both `DATA_ROOT`
>    constants. `data/fixtures/` is **retained** and no test suite is re-pointed.
>    **Do not touch `app/` at all** — 2-15 is in progress and 2-14/2-16 are in flight there.
> 9. **The `assert-schema-version.test.ts` premise routed here is STALE and you must say so
>    rather than act on it.** The ledger reconciled ownership to 1.19 on the reasoning that
>    *"Story 1.19's full batch run will multiply the tree again."* **It will not.** The tree is
>    already at its full 1,402 committed artifacts — 1.16/1.17/1.18 emitted them. Story 2.14
>    already raised all three `it`s to a 20 s budget and verified four consecutive full-suite
>    runs at 964/964. **Measure and record; do not edit `app/`.** See §OPEN RULINGS R4.

## Acceptance Criteria

The epic's ACs are reproduced verbatim, each followed by the binding reconciliation this story's
probe forced.

**1. Given** the full corpus **When** the batch runs end-to-end (extract → validate → precompute
→ emit) **Then** the manifest carries exactly 104 terminal entries and the batch summary reports
per-report status, Self-Validation results, warnings (unlinked markers, near-miss parses), and
aggregate counts **And** from the summary alone a reader can identify every failed report and why,
without opening logs or artifacts.
[Source: `epics.md:597-600`, `### Story 1.19`; FR-16 `prd.md:217-221`]

> **BINDING — five separate obligations hide in this AC. Take them one at a time.**
>
> **(a) "exactly 104 terminal entries" is already structurally enforced; the *assertion* is
> not.** `batch.py:333-338` raises `ValueError` unless every entry reaches one of
> `STATUSES = ("extracted", "failed", "skipped-unchanged")` — note the hyphen. `--expect-reports 104`
> gates the corpus size, but **only its mismatch path has ever been asserted by a test**
> (`deferred-work.md` anchor *"No test exercises the batch beyond three reports"*). Close the
> match path. Beware: `_corpus` (`pipeline/tests/test_ingest_batch.py:33`) indexes a
> five-element `TEAMS` list, so a synthetic corpus above 5 raises `IndexError` — widen `TEAMS`
> or assert the match path against the real run rather than a synthetic 104.
>
> **(b) "end-to-end" is FIVE CLIs, not one, and their order is forced.**
> `ingest.batch` → `precompute.run` → `precompute.emit` → `precompute.index` →
> `precompute.profiles`. `profiles` reads `data/matches/`, not `work/spine/`, so it must run
> after `emit`. And `index` **cannot run cleanly after `profiles` exists** unless you resolve
> the deadlock in §probe-6. Expressing that ordering is this story's named obligation.
>
> **(c) "warnings (unlinked markers, near-miss parses)" — three different mechanisms.**
> *Unlinked markers* reach the summary through the `shots-link-rate` branch of the
> **Self-validation failures** block (not the warnings block), rendering
> `{team}: {linked}/{total} markers linked; unlinked: {outcome}@({pdf_x},{pdf_y})`. The corpus
> currently links **2571/2571 (100%)**, so the expected result is that this branch never fires —
> confirm the figure, do not assume it. *Warnings* are the seven documented absences (§probe-4).
> ***"Near-miss parses" has no implementation and no ledger entry.*** The nearest real thing the
> pipeline produces is a **`specifics`-carried delta on a bounded (rather than equality) check**
> — 1.9's two goalkeeping bounded checks record `printed total − Σ(series) ∈ {0..5}` and a
> `feet` panel delta of `+1` on 18 / `+2` on 2 of 208 team-innings; 1.9-D3 records
> `PMSR-M88-AUS-V-EGY`'s ET1 drawn short at 14/15 slots. These **pass**, so they never reach the
> summary today. Task 3 rules how they surface.
>
> **(d) "from the summary ALONE … without opening logs or artifacts" is the testable
> consequence and it is measurable.** Today's summary is ~740 lines of which 728 are the same
> seven sentences repeated. That is the defect. The acceptance test is FR-16's own wording, and
> it is a property of `pipeline/ingest/batch.py:392` `format_summary` — **not** of
> `pipeline/validate/verify.py:57`, which is a different function with the same name.
>
> **(e) Two `format_summary` functions exist. Change the batch one.** `batch.py:392` renders the
> run manifest and is printed at `batch.py:579`. `verify.py:57` renders the FR-15 verification
> report and is consumed by `pipeline/tests/test_cli.py:174`. Touching the wrong one is a silent
> scope error.

**2. Given** the SM-1 target **When** the run completes **Then** 104/104 reports pass
Self-Validation, or each residual failure is individually documented with its cause — with checks
never weakened to get there (SM-C1).
[Source: `epics.md:602-604`; SM-1 `prd.md:441`; SM-C1 `prd.md:451`]

> **BINDING — the "or" branch is the expected outcome, not a failure mode. Write the story to
> land there.**
>
> SM-1 reads *"Target: 100%, **with any residual failures individually documented and
> explained**"*. SM-C1 is the hard gate, not SM-1: *"never weaken Self-Validation (exact
> marker-count match, 100% link rate) or extraction asserts to reach SM-1's 100%. **A documented
> failure beats a silently wrong extraction.**"*
>
> **The two residuals are already ruled, hand-verified, and their causes are written. Reproduce
> and document; do not re-derive and do not re-investigate.**
>
> | Report | check | team | family | drawn | page prints |
> |---|---|---|---|---|---|
> | `PMSR-M19-ARG-V-ALG` (`m019-argentina-algeria`) | `defensive-actions-marker-count` | `away` | `forced-turnover` | **39** | **40** |
> | `PMSR-M58-TUN-V-NED` (`m058-tunisia-netherlands`) | `defensive-actions-marker-count` | `away` | `forced-turnover` | **33** | **34** |
>
> **Cause, verbatim from the ruling:** *"two corpus pages draw one forced-turnover marker fewer
> than their own printed total … Verified not to be a parse defect: both pages were rendered and
> the dots counted by hand (39 and 33), every marker-sized circle on each page is accounted for
> (left panel + right panel + exactly the 7 bullet swatches), no marker sits outside the panels,
> there are no exactly-coincident pairs at threshold 0.0, and no drawing-anatomy variant hides a
> 40th marker (the only other marker-sized circles are the four stroke-only corner arcs per
> panel). The remaining 206 of 208 pages agree exactly."*
>
> **What SM-C1 forbids you from doing, explicitly:** loosening
> `defensive_actions_self_validation_block`'s equality (`pipeline/markers/defensive_actions.py:323-346`);
> adding a tolerance band; adding a known-discrepancy waiver or allowlist (**this option was
> considered and REJECTED in the 1.12 ruling — deviation categories are frozen at 4**); dropping
> the forced-turnover counterpart to take the documented-absence branch; or filtering these
> records out of precompute. **`pipeline/precompute/records.py:16-21` rules them CONSUMED** —
> the record filter is on `status` alone and **never** on `self_validation`, pinned by
> `test_precompute_spine.py:725-732`.
>
> **The tripwire.** If your run reports a **third** self-validation failure, that is a real
> regression and the 1.12 ruling re-opens (*"which would mean the discrepancy is systematic
> rather than two defective pages"*). Treat it as a finding, name the report and check, and stop
> — do not absorb it into the documented set.
>
> **No test pins "exactly 2, no third" today.** Exhaustively verified: no `expected_failures`,
> no allowlist, no waiver constant anywhere in `pipeline/`. The rule lives only as a manual
> convention in story Dev Notes and `pipeline/README.md:516-523`. Closing that gap is a
> candidate for this story (see Task 8.3) — as a **baseline assertion**, never a tolerance.

**3. Given** the completed run **When** artifacts are finalized **Then** `/data` (matches +
indices) is committed, replacing fixtures as Epic 2's data source, with fixtures retained for
tests **And** a full re-run from the same inputs reproduces the committed artifacts
byte-identically (NFR-6).
[Source: `epics.md:606-609`; NFR-6 `prd.md:392`; AD-13 `ARCHITECTURE-SPINE.md:122`]

> **BINDING — three sub-obligations, one of which is a trap that has bitten twice.**
>
> **(a) "committed" is already true; your job is to keep it true through a re-run.** 1,402
> artifacts are tracked. The risk is not writing them — it is a **partial** write becoming the
> pinned AD-3 baseline (§probe-7), or an aborted run's scratch directories being swept into a
> commit. `.gitignore:33-34` covers `data/index/*.staged/` and `data/index/*.previous.rollback/`
> for exactly that reason; read the comment in full — *"without this a sweeping `git add` after
> an aborted run would commit hundreds of orphan artifacts as though they were real — and
> `identity.check_committed_data` would then pin them as the AD-3 immutability baseline, which
> is expensive to undo."* **`data/matches/` has no such entry.** If you stage bundle writes,
> add one.
>
> **(b) "with fixtures retained for tests" — `data/fixtures/` STAYS.** Do not delete it, do not
> regenerate it, do not re-point any suite at real data. `test_fixtures.py` (47 tests)
> parametrizes over `data/fixtures/**`. 1.18 proved that regenerating match-bundle fixtures is
> actively harmful: Story 2.10's presence gates need their populated goalkeeping technique
> blocks and the Domain G ground-truth pins need m001's hand-transcribed physical block. **The
> app-side `DATA_ROOT` flip is 2.19's.**
>
> **(c) THE BYTE-IDENTICAL RE-RUN REQUIRES A QUIET `pipeline/` TREE — this is an acceptance
> condition, not an inconvenience.** `code_version()` = SHA-256 over every `pipeline/**/*.py`
> (excluding `tests/`, venvs, build trees, `__pycache__`) **plus `pipeline/requirements.txt`**,
> memoized once per process at `batch.py:258` before the loop. **A comment-only edit is
> enough.** Story 1.9's first attempt was invalidated by *"this story's own post-batch docstring
> rewrapping"*.
>
> **What "byte-identical" is asserted over — be precise:**
> - the **104 staged records** in `work/extracted/` — SHA-256 **on bytes**, not parsed dicts;
> - the **1,402 committed artifacts** under `data/` — the cleanest proof is that
>   `git status --short data/` is **empty** after the re-run;
> - the printed `code version` line must be **identical across both runs**.
>
> **What is NOT byte-identical and must not be asserted:** `work/run-manifest.json` carries
> `run_timestamp` (`batch.py:363`) — the one volatile field — and `work/` is gitignored anyway.
>
> **The refactors in Tasks 5 and 6 must be byte-neutral.** Bundles carry no timestamp, no
> absolute path, no `code_version`, no host name (1.16 landmine). A staged-directory rewrite of
> the write phase changes *when* bytes land, never *which* bytes. Prove it: emit into an
> independent tree and diff against `data/`, the shape `test_emit_profiles.py`'s Task 9.4
> two-tree comparison already established.
>
> **(d) The slug registry binds the whole run.** `check_pins`
> (`pipeline/precompute/identity.py:454-469`) fails the run on any of the 1,400 pinned ids that
> a re-run would mint differently: *"an id, once emitted, never changes (AD-3)"*. A full re-run
> **must not move any of the 1,248 player slugs** — that is a real assertion, not a formality.
> Do **not** edit `OVERRIDES` (it ships empty; the 219 given-name-first players are Juan/UX's
> unruled call and an edit would rename committed artifacts and break every affected URL). Do
> **not** run `--write-registry` — regenerating and committing `slug_registry.py` changes
> `code_version()` by construction and forces yet another full re-extract.

## RULINGS TAKEN BY THIS STORY

### D1 — The batch summary's "Warnings (non-fatal)" block IS de-duplicated. RULED: take it.

**Filed three times, deferred three times, always for the same reason. This story owns the batch
summary and 728 lines of structural noise is exactly what AC 1 forbids.**

- Story 1.12 (`deferred-work.md`, anchor *"so the batch summary prints 104 identical warning
  lines"*): *"a summary-level de-duplication (`"104 reports: <warning>"`) would fix the console
  without changing the manifest. **Deferred: touches `format_summary`'s shared rendering, which
  several stories' checks depend on.**"*
- Story 1.13 (anchor *"so the batch summary now prints 208 more warning lines"*): *"would now fix
  three warnings at once … **Still deferred for the same reason.**"*
- Story 1.14 (anchor *"A fourth family of absence warning now fires on every report"*): *"a record
  now carries **seven**, and the summary-level de-duplication … would now collapse **728 lines to
  seven**. **Still deferred for the same reason.**"*

**The stated blocker was measured and it does not hold.** All seven dependent tests were read.
Every one asserts `assert <WARNING_CONSTANT> in format_summary(manifest)` — a **substring** check
on the warning text. None asserts the `f"  {report_id}: {warning}"` prefix. None asserts a line
count.

| Test | file:line | Asserts | Survives the collapse? |
|---|---|---|---|
| `test_the_documented_absence_reaches_the_manifest_as_a_warning` | `test_ingest_batch.py:897` | `ABSENT_COUNTERPART_WARNING in format_summary(manifest)` | **Yes** |
| `test_the_two_receiving_absences_reach_the_manifest_as_warnings` | `:963-964` | two constants `in summary` | **Yes** |
| `test_the_node_positions_absence_reaches_the_manifest_as_a_warning` | `:1080` | `warning in format_summary(manifest)` | **Yes** |
| the four self-validation-failure renderers | `:836-837`, `:876-877`, `:935-937`, `:1123-1127` | the **Self-validation failures** block | **Untouched — different block** |
| `main()` + `capsys` console tests | `:463-464`, `:484-486`, `:1035-1038` | `"RUN RESULT: …"`, report ids, `"table lists 9"` | **Untouched** |

**THE RULING, and its exact bounds:**

1. **Change only lines 417-419** of `pipeline/ingest/batch.py` — the nested
   `for entry … for warning …` emitting `f"  {entry['report_id']}: {warning}"`. Invert the
   iteration from *entry → warnings* to *warning → count of entries carrying it*, preserving
   first-appearance order so the output is deterministic (never `set` iteration order).
2. **Emit the warning text VERBATIM.** No truncation, no elision, no reflow, no re-wrapping.
   Truncating is the one change that breaks the three tests above. Render as
   `  {n} report(s): {warning}` — singular/plural handled so a one-report fixture reads
   `1 report: …`.
3. **When a warning is carried by some but not all reports, name the reports.** A warning on
   ≤ 3 of the run's reports is genuinely per-report information and AC 1 requires it be
   identifiable; render those as today (`  {report_id}: {warning}`). Above that threshold, collapse
   with the count. Pick and document the threshold in the docstring; a bare count that hides
   *which* three reports differ would violate AC 1 in the other direction.
4. **The manifest is unchanged.** All three filings say so. Per-report `warnings` arrays keep one
   entry per report, mirrored at `batch.py:314-319`. This is a **rendering** change only.
5. **Do not touch** the "Failed reports", "Self-validation failures", "Orphan records" or
   "Corpus gaps" blocks, and do not touch `pipeline/validate/verify.py:57`.
6. **Ship a constructed failure that drives it red** (house rule): a synthetic manifest where two
   reports carry warning A and one carries warning B must render A collapsed and B named, and a
   mutation that drops the count must turn a test red.
7. **Update the doc-comments that describe the rendering:** `pipeline/markers/crosses.py:220`,
   `pipeline/markers/receiving.py:503`, and `pipeline/README.md:96-120` and `:513-523`.

**Expected effect, measured against the live manifest:** 728 warning lines → 7.

### D2 — The batch report of record is `format_summary`'s output; the acceptance record is this story file.

FR-16 says the Pipeline *"emits a batch summary"*. **Nothing in the PRD, addendum or
Architecture Spine specifies the summary's format, file path, or whether it is committed** — that
gap was verified exhaustively. AD-8 names only the **run manifest** as *"the single record of
truth"*, and it lives at `work/run-manifest.json`, in a gitignored tree.

**RULED:** the batch summary of record is the stdout of `python -m pipeline.ingest.batch`
(`print(format_summary(manifest))`, `batch.py:579`), and AC 1's self-sufficiency is a property of
that string. The **authoritative run's summary is captured verbatim into this story's Dev Agent
Record**, which is how every prior story recorded a batch run and is what a reader of the epic
will find. **Do not add a `.json` batch report under `data/`** — `app/scripts/assert-schema-version.mjs`
walks every `*.json` under `data/` and would fail the App build on a file carrying no
`schemaVersion`. Whether an additional committed copy is wanted is §OPEN RULINGS R1.

### D3 — Ledger items this story does NOT claim.

Stated up front so the Completion Notes do not over-claim, and because 1.18 took a task
explicitly forbidding opportunistic closure (*"Do not claim the ledger entry unless you actually
fix `emit_bundles`"*).

- **The `>=` → `==` pass-network tightening.** 1.18 proved the precondition is **unreachable**:
  `events.passNetworkNodes` is `null` on 104/104 corpus bundles, so the invariant skips on every
  real bundle and can only run against hand-authored fixtures whose edge lists are a subset by
  construction. 38 of 66 fixture nodes still go red under `==`. **Not 1.19's. Do not "fix" it by
  regenerating fixtures — 1.18 measured that it does not help.**
- **Everything routed to Story 2.19** — the `DATA_ROOT` flip, 104-at-scale App verification,
  Lighthouse, sort collation over real names, accent-insensitivity in the browser, cluster
  density at 320px, the header-search payload question.
- **The 219 given-name-first player slugs** (`OVERRIDES` data edit) — Owner: Juan / UX, and an
  edit would break AC 3's byte-identity and rename committed artifacts.
- **Renaming the two FR-15 gate check ids** (`identity-completeness`, `identity-pinning`) — a
  breaking change to the `checks_run` literal every gate consumer pins.

## OPEN RULINGS NEEDED FROM JUAN

Answer these before Task 7 (the authoritative run). Each carries a recommendation so the story is
not blocked; proceed on the recommendation if no answer comes.

### R1 — Is a copy of the batch summary committed as a repo artifact?

D2 rules the summary lives in stdout and in this story's Dev Agent Record. `work/` is gitignored;
`data/` is contract artifacts only and a stray `.json` there breaks the App's schema-version gate.
**Recommendation: no separate committed artifact.** The Dev Agent Record + `pipeline/README.md`'s
baseline paragraph is the durable record, consistent with every prior story. If Juan wants a
standalone file, `pipeline/BATCH-REPORT.md` is the only location that is committed, outside
`data/`, and invisible to the schema walker — but note it would then be regenerable output living
in a source tree.

### R2 — Does the summary gain a "Near-miss parses" section? (AC 1 names the category; nothing implements it.)

The pipeline's bounded (rather than equality) checks **pass** while recording an observed delta in
`specifics` on every report — 1.9's goalkeeping involvement/distribution pair, and 1.9-D3's short
ET1 on `PMSR-M88-AUS-V-EGY`. A passing check never reaches the summary today, so AC 1's
"near-miss parses" category has no output at all.
**Recommendation: add one aggregate line per bounded check with any non-zero delta**, e.g.
`goalkeeping-distribution-feet: 20/104 report(s) with a non-zero delta (max +2)` — cheap, satisfies
the AC, and adds ~3 lines rather than 104 each. **Do not** add per-report lines; that recreates
exactly the noise D1 removes. Alternative: rule that the documented-absence warning family already
discharges the category and record that reading in the Completion Notes.

### R3 — `_parse_rows`' silent row skip: take the raise now, or re-defer?

`pipeline/extract/pass_network.py:301-315` `continue`s on any body row carrying no shirt span and
no name span — a silent skip on a page family whose whole discipline is assert-on-unknown. The
ledger deferred it because *"turning the skip into a raise is a behaviour change on all 104 reports
and needs a full batch re-run to validate"* — **and this story has that re-run.** The second half is
unruled: raise **always**, or raise only when the skipped row carries digit spans?
**Recommendation: re-defer.** It is required by no AC, it is a second unruled decision, and each
production edit forces another full re-extract cycle before the byte-identity proof can start. If
Juan wants it taken, take the **conservative** form (raise only on digit spans) and sequence it
with the Task 6 edits so one re-extract covers both.

### R4 — `assert-schema-version.test.ts`: measure-and-report, or is the architectural question answered here?

The ledger reconciled ownership to 1.19 on a premise that is now false (§probe-9): the data tree is
already at full size and 2.14 already raised the per-test budget to 20 s with four consecutive
964/964 full-suite runs. The still-open question the reconciliation names is real, though:
*"whether a unit-test run should re-walk the entire emitted corpus at all."*
**Recommendation: measure `node scripts/assert-schema-version.mjs` against the post-run tree,
record the runtime and the artifact count in the Completion Notes, append a correction to the
ledger stating the "multiplies the tree again" premise was wrong, and route the scoped-walk
question to 2.19 with the measurement attached. Change no file under `app/`.**

### R5 — How is the phase-ordering deadlock resolved: orchestrator, or gate semantics?

Two shapes, and the ledger deliberately left the choice to this story.
**(a) An orchestrator** — a thin `pipeline/precompute/__main__`-style runner (or a documented
command sequence with the profile-directory dance encoded) that runs the five phases in a valid
order. Cheap; leaves the write-blocking gate's semantics untouched.
**(b) Relax the gate** — make the profile direction of `check_route_manifest` non-write-blocking
(warn-and-record on first emission, assert on the following `profiles` run). Cleaner end state;
reverses a gate's failure semantics, which 1.17's review said *"exceeds a review's remit"*.
**Recommendation: (a).** It is what "owns end-to-end orchestration" literally asks for, it cannot
weaken a gate (SM-C1's spirit), and it is byte-neutral by construction. Note 1.17 explicitly
**rejected** moving the bijection *assertion* to 1.19 — you inherit the **orchestration**, not the
assert.

## Tasks / Subtasks

> **Sequencing rule that governs the whole story, learned twice the hard way:** every
> `pipeline/**/*.py` edit re-invalidates all 104 staged records. **Land every production edit
> (Tasks 2–6) BEFORE the authoritative run (Task 7).** A batch run taken mid-edit is discarded
> work. [Source: `1-15-…md:166` *"Do not re-run the batch yet."*]

- [ ] **Task 1 — Baseline, environment, and the quiet-tree plan** (AC: 1, 2, 3)
  - [ ] 1.1 Confirm `git rev-parse HEAD` is `12fad17` and `git status --short data/ pipeline/` is empty. Record both.
  - [ ] 1.2 Record the pre-change baseline: `git ls-files data/ | wc -l` (expect 1412), the counts in `data/matches/` (104), `data/index/*.json` (2), `data/index/team-profiles/` (48), `data/index/player-profiles/` (1248), `data/fixtures/` (10). **Baselines drift by design — measure your own, do not copy these forward as assertions without re-measuring.**
  - [ ] 1.3 Record the current `work/run-manifest.json` state as the "before" reference: 104 entries, `counts_by_status`, `run` block, `code_version` (first 12 chars). Do **not** treat it as the acceptance artifact — Task 7 produces that.
  - [ ] 1.4 Create the isolated git worktree for verification (house practice since 1.17/1.18; three commits landed under 1.18 mid-run). Use a private port for anything served. **Expect one known worktree artefact:** `test_contract_schemas.py::test_the_committed_generated_types_still_match_the_schemas` fails in a fresh worktree because `json-schema-to-typescript` lives in a gitignored `node_modules`. It is not a finding.
  - [ ] 1.5 Write down the quiet-tree plan for Task 9 explicitly: which interval must be free of `pipeline/**/*.py` and `pipeline/requirements.txt` saves, and how you will evidence it (the printed `code version` line identical across both runs is the check).

- [ ] **Task 2 — De-duplicate the batch summary's warnings block** (AC: 1) — **implements §RULINGS D1**
  - [ ] 2.1 Read `pipeline/ingest/batch.py:392-499` in full before editing. Confirm you are in `ingest/batch.py`, not `validate/verify.py`.
  - [ ] 2.2 Replace lines 417-419 with the count-collapsed rendering. Preserve first-appearance order (deterministic; never `set` iteration). Emit warning text verbatim.
  - [ ] 2.3 Implement the ≤N-reports carve-out from D1.3 so a warning carried by a minority of reports still names them. Document the threshold in the docstring with its AC-1 rationale.
  - [ ] 2.4 Add tests: (i) the collapse renders `{n} report(s): {warning}` with the warning verbatim; (ii) a minority-carried warning still names its reports; (iii) **a constructed mutation that drops the count or truncates the text turns a test red**; (iv) the total summary line count for a synthetic 104-report manifest with 7 uniform warnings is 7 warning lines, not 728.
  - [ ] 2.5 Run the targeted chunk: `pipeline/tests/test_ingest_batch.py pipeline/tests/test_cli.py` (`test_cli.py` proves no cross-contamination with the other `format_summary`). All seven pre-existing dependents must stay green.
  - [ ] 2.6 Update `pipeline/markers/crosses.py:220`, `pipeline/markers/receiving.py:503`, and `pipeline/README.md:96-120` / `:513-523` so no doc-comment describes the old rendering.

- [ ] **Task 3 — Warning-category coverage in the summary** (AC: 1) — **gated on §OPEN RULINGS R2**
  - [ ] 3.1 Confirm the unlinked-marker path: verify the corpus still links **2571/2571 (100%)** and that `shots-link-rate` therefore never fires. State the measured figure; do not assume it.
  - [ ] 3.2 Prove the branch would fire if it should: a constructed manifest with an unlinked marker must render `{team}: {linked}/{total} markers linked; unlinked: {outcome}@({pdf_x},{pdf_y})` in the summary.
  - [ ] 3.3 Per R2's ruling, either add the aggregate near-miss section (one line per bounded check with any non-zero delta) or record in the Completion Notes the reading that the documented-absence family discharges the category. **Whichever you do, state it — silence on an AC-named category is a review finding.**

- [ ] **Task 4 — Assert "exactly 104 terminal entries"** (AC: 1)
  - [ ] 4.1 Close the ledger's `--expect-reports` gap (anchor *"No test exercises the batch beyond three reports"*): assert the **match** path, not only the mismatch path. Widening `TEAMS` in `test_ingest_batch.py:33` is the enabler if you build a synthetic 104-report corpus; otherwise assert against the real run and say so.
  - [ ] 4.2 Assert the manifest carries exactly 104 entries, every one at a terminal status from `STATUSES`, and that `counts_by_status` sums to 104.
  - [ ] 4.3 Note in the docstring (do not fix) the known lossy case: a **three-way** match-id collision erases one collision fact from the manifest (`batch.py:178-186`, `match_id_owner` is never reassigned). Two-way collisions are correct and are the realistic case. This is an existing ledgered item, not yours.

- [ ] **Task 5 — Express the end-to-end phase ordering** (AC: 1) — **gated on §OPEN RULINGS R5**
  - [ ] 5.1 Reproduce the deadlock first so the fix is measured against a real failure: with profiles on disk, run `precompute.index` and capture the `RouteManifestError`. Do not skip this — a fix for a failure you have not seen is a guess.
  - [ ] 5.2 Implement R5's chosen shape. If (a), the runner must invoke `ingest.batch` → `precompute.run` → `precompute.emit` → `precompute.index` → `precompute.profiles`, propagate each phase's exit code under the house contract (`0` clean / `1` a finding / `2` the harness could not run), and **never mask a phase's exit 1** — the batch's exit 1 is a true signal (§probe-2).
  - [ ] 5.3 The runner must not weaken any gate. `check_route_manifest`, `check_pins`, `check_committed_data`, the budget gates and the schema asserts all stay exactly as they are.
  - [ ] 5.4 Document the resolved ordering in `pipeline/README.md`, replacing the "empty the two profile directories" recourse paragraph with the real procedure.
  - [ ] 5.5 Tests: the ordering is exercised end-to-end (a small synthetic corpus is fine) and a constructed out-of-order invocation still fails loudly.

- [ ] **Task 6 — Make the two committed write paths all-or-nothing** (AC: 3) — closes the ledger entries anchored *"An `OSError` mid-write leaves `data/matches/` partially populated"* and *"A partial `data/index/` with no rollback, now on a second write path"*
  - [ ] 6.1 Reuse 1.18's shipped pattern — `pipeline/precompute/profiles.py:1152-1183` `_swap_directory` (retire-then-install with rollback). **Do not invent a second mechanism.** Consider lifting it to a shared helper rather than copying; if you copy, say why.
  - [ ] 6.2 `emit_bundles` (`pipeline/precompute/emit.py`): stage all 104 bundles beside the target and swap. Preserve the load-bearing ordering already documented at `emit.py:1568-1578` — `expect_matches` is checked inside `emit_bundles` because the stale sweep deletes every bundle this run did not produce.
  - [ ] 6.3 `emit_index` (`pipeline/precompute/index.py`): make the two `write_canonical` calls all-or-nothing so `tournament.json` and `leaderboards.json` can never disagree. Keep the stale sweep's non-recursive `data/index/*.json` glob — it must never reach `team-profiles/` or `player-profiles/`.
  - [ ] 6.4 Fix the exit-code lie the ledger names: an `OSError` after the filesystem was mutated must not print exit **2** (*"nothing was learned"*). With an all-or-nothing swap the filesystem genuinely is untouched on failure, so verify the mapping now tells the truth rather than merely re-labelling it.
  - [ ] 6.5 **Add the matching `.gitignore` entries** for any new scratch namespace under `data/matches/` (`data/matches/*.staged/`, `data/matches/*.previous.rollback/`), with a comment stating the same failure mode as `.gitignore:26-32`. This is not optional — a killed run plus a sweeping `git add` pins orphans as the AD-3 baseline.
  - [ ] 6.6 **Prove byte-neutrality**: emit into an independent tree and diff against the committed `data/`. Expected `0 differ` over 104 bundles and 2 index artifacts. Use the two-tree byte comparison shape `test_emit_profiles.py` already established.
  - [ ] 6.7 Tests: a constructed mid-write failure must leave the target namespace **completely untouched** and roll back; the success path must clean its scratch directories; a killed-run simulation must leave only ignored directories.

- [ ] **Task 7 — THE AUTHORITATIVE FULL RUN** (AC: 1, 2) — **run only after Tasks 2–6 have landed**
  - [ ] 7.1 Confirm the tree is quiet and record the `code_version` you are about to run at.
  - [ ] 7.2 Run the five phases **in the background** (long runs in this environment get killed). **To recover from a kill, RE-INVOKE — never `--force`.** Resume is structural: records already staged at the current `code_version` return `skipped-unchanged` and the run continues from where the kill stopped. `--force` throws away completed work.
  - [ ] 7.3 Capture the batch summary stdout **verbatim** to the session scratchpad (not the repo), and the exit code of every phase.
  - [ ] 7.4 Assert the ruled baseline — **not** exit 0: `extracted 104 / failed 0 / skipped-unchanged 0 / corpus_gaps 0 / orphan_record_paths 0`, `self_validation_fail_count == 2`, `failed_count == 0`, `RUN RESULT: FAIL`, exit **1**. Copy 1.15's precedent phrasing: *"full batch, asserted against the adjudicated baseline rather than against exit 0."*
  - [ ] 7.5 Record every downstream phase's headline: `precompute.run` (pins held, `1400 pinned id(s)`), `emit` (104 bundles, budget max), `index` (bijection all three directions, Hub combined vs 500,000), `profiles` (48 + 1,248, largest artifact). **Watch for `index.py:1499-1512`'s qualified headline** — `INDEX RESULT: PASS (N check(s) COULD NOT RUN)`. A qualified PASS is not a PASS; report it as-is.
  - [ ] 7.6 Re-measure and record the AD-4 budget figures against the real corpus. On any breach, **SM-C2 binds: split artifacts or log a decision, never drop fields, truncate an array, or lower a precision to fit.**

- [ ] **Task 8 — SM-1 acceptance record** (AC: 2)
  - [ ] 8.1 Document the two residual failures **individually, each with its cause**, in the Completion Notes: report id, match id, check, team, family, both counts, and the verbatim cause from §AC-2's binding block. This is the literal wording SM-1's "or" branch requires.
  - [ ] 8.2 State affirmatively that **no check was weakened** to reach the result, naming what was considered and rejected (tolerance band, waiver/allowlist, dropping the counterpart, filtering the records). SM-C1 is the hard gate.
  - [ ] 8.3 **The third-failure tripwire.** If the run reports exactly 2, say so explicitly (*"no third"*, the phrasing 1.9 and 1.14 both used). If it reports a third, **stop and treat it as a regression**: name the report and check, do not absorb it, and re-open the 1.12 ruling. Optionally close the automation gap with a **baseline assertion** over the real manifest — never a tolerance, never an allowlist (that mechanism was explicitly rejected).
  - [ ] 8.4 Confirm the ruled-consumed property still holds: both records reach precompute (`status`-only filter, `records.py:16-21`), so `m019-argentina-algeria` and `m058-tunisia-netherlands` are present in `data/matches/` and in the route manifest.

- [ ] **Task 9 — Byte-identical re-run on a quiet tree** (AC: 3, NFR-6)
  - [ ] 9.1 Snapshot SHA-256 of all 104 files in `work/extracted/` **on bytes**, and confirm `git status --short data/` is empty.
  - [ ] 9.2 **Verify the tree stayed quiet** across the interval — no `pipeline/**/*.py` or `requirements.txt` save by any session. Then re-run the full sequence without `--force`.
  - [ ] 9.3 Assert: `extracted 0 / skipped-unchanged 104`; all 104 record SHA-256s unchanged (**0 differences**); the printed `code version` line identical to Task 7's; `git status --short data/` still empty after every phase re-emits.
  - [ ] 9.4 If the first attempt shows 104 re-extracted with changed hashes, **that is the known false alarm, not a determinism defect** — identify which file was saved and when, wait for the tree to go quiet, and repeat. Record the incident honestly (both 1.9 and 1.14 did); a re-run on a moving tree proves nothing either way.
  - [ ] 9.5 Assert the pinning guarantee explicitly: `check_pins` held all 1,400 ids and **no player slug moved**; `check_committed_data` reports the populated baseline (`104 bundle(s), 89358 id reference(s), all pinned` and its index/profile counterparts) and **never** the "baseline unavailable … This is NOT a pass" branch.

- [ ] **Task 10 — Finalize `/data`; retain fixtures** (AC: 3)
  - [ ] 10.1 Verify `data/fixtures/` is untouched (10 tracked files) and that no test suite was re-pointed at real data.
  - [ ] 10.2 Verify no `.staged/` or `.previous.rollback/` directory survives anywhere under `data/`. Run `git status --short --ignored data/` and state the result.
  - [ ] 10.3 Confirm the committed artifact count is unchanged at 1,402 non-fixture artifacts (1,412 tracked under `data/`) — or, if it moved, explain exactly why before committing.
  - [ ] 10.4 **Stage by explicit path. Never `git add -A`.** A concurrent Epic 2 session is live in `app/` and `_bmad-output/`; a sweeping stage captures its files (and vice versa). Commit directly to `main` — solo repo, no branch, no PR. Disclose any co-committed in-flight state in a `COMMIT SCOPE` note in the message body.

- [ ] **Task 11 — Ledger triage** (AC: 1, 2, 3)
  - [ ] 11.1 Append a `## Filed by Story 1.19 implementation (…, YYYY-MM-DD)` section at the **end** of `deferred-work.md`, with `### Closed by this story` and `### Filed, not fixed` sub-sections. **APPEND-ONLY** — never edit another story's paragraph; corrections are appended as corrections. **Cite by quoted anchor phrase, never by line number. The ledger mints no ids — do not invent a `DW-nn`.**
  - [ ] 11.2 Close, with evidence, only what you actually fixed: the three `format_summary` warning-collapse filings (1.12/1.13/1.14); the `emit_bundles` and `emit_index` rollback entries (**only if** Task 6 actually changed those loops — 1.18's task explicitly forbids closing this falsely); the phase-ordering entry; `--expect-reports`'s match path.
  - [ ] 11.3 Close by measurement the items whose stated precondition was *"requires the real 104-report corpus"*: the cover-line threshold boundaries (`_LINE_TOLERANCE_PT = 3.0`, `_SPACE_GAP_PT = 1.0`) and the zero-width/format-character survival in `normalize`. Record what the corpus actually exhibits, or state plainly that 104/104 covers parse and the margin is unmeasured.
  - [ ] 11.4 Mark the combined-budget entries discharged (built by 1.17, first exercised at full corpus here).
  - [ ] 11.5 Append the `assert-schema-version` correction per R4 — the "multiplies the tree again" premise was wrong — with the measured runtime and artifact count.
  - [ ] 11.6 **Do NOT close** anything in §RULINGS D3. State explicitly that they remain open and why, so the omission is not read as a miss.

- [ ] **Task 12 — Regression suite, docs, status**
  - [ ] 12.1 Run the **full** `pipeline/tests` suite. **~45 minutes — run it in the background, not in chunks that time out.** If you must chunk, state the arithmetic and make the tally reconcile **exactly**: 1.16 took a review finding for an off-by-one, and *"off by one it substituted for nothing."* Note `test_emit_profiles.py` alone costs ~8m40s.
  - [ ] 12.2 Record collected / passed / failed / skipped with attribution for **every** pre-existing failure. Collection counts drift by design — do not treat a mismatch with this file as a finding. Do not report a sum in place of a run.
  - [ ] 12.3 Update `pipeline/README.md`: the batch console summary section, the baseline paragraph, the resolved phase ordering, and the reproducibility procedure.
  - [ ] 12.4 Update `sprint-status.yaml`: `1-19-full-batch-run-batch-report-104-104-acceptance: review`, `last_updated`, and an append-only dated log comment. Do not flip `epic-1` to `done` — that is a manual transition after the code review.
  - [ ] 12.5 Fill the Dev Agent Record: Agent Model Used, Debug Log References (scratchpad script names, worktree path, concurrency notes), Completion Notes List (bold-headline paragraphs, each a claim plus its evidence — including the **verbatim batch summary** per §RULINGS D2), File List (**New** / **Modified** / **Unchanged by design**), Change Log.

## Dev Notes

### Mental model (read this first)

Epic 1's last story is an **acceptance** story wearing a small amount of engineering. Four of its
five obligations are evidentiary — run it, report it, document the residuals, prove it repeats.
The engineering exists only where an AC has a filed defect standing against it:

- **AC 1 has a filed defect** — the 728-line warnings block. Fix it (D1).
- **AC 1 has a structural blocker** — the write-blocking bijection deadlock. Express the ordering.
- **AC 3 has a live hazard** — two non-atomic committed write paths that can pin a partial
  namespace as the AD-3 immutability baseline. Close them.

Everything else is measurement, honestly recorded. **The hardest engineering discipline in this
story is sequencing**: production edits first, authoritative run second, byte-identity proof last,
on a tree nobody is saving into.

### The exact command set (venv interpreter always; never bare `python`, never `uv`)

```
./pipeline/venv/Scripts/python.exe -m pipeline.ingest.batch     --input-dir pmsr-corpus --expect-reports 104
./pipeline/venv/Scripts/python.exe -m pipeline.precompute.run   --expect-records 104
./pipeline/venv/Scripts/python.exe -m pipeline.precompute.emit  --expect-matches 104
./pipeline/venv/Scripts/python.exe -m pipeline.precompute.index --expect-matches 104
./pipeline/venv/Scripts/python.exe -m pipeline.precompute.profiles --expect-teams 48 --expect-players 1248
./pipeline/venv/Scripts/python.exe -m pipeline.validate.verify  --input-dir pmsr-corpus --expect-reports 104   # FR-15 gate
./pipeline/venv/Scripts/python.exe -m pytest pipeline/tests
```

- `emit`, `index`, `profiles` accept `--dry-run` (validate + measure, write nothing). `batch` and
  `run` do not.
- **`profiles` must run after `emit`** — it reads `data/matches/`, not `work/spine/`.
- **There is no `--resume` flag and none is needed.** Plain re-invocation resumes; `--force`
  restarts from zero and discards completed work.
- **There is no single-report flag.** The only mechanism is a one-PDF `--input-dir` (a temp
  directory holding one `.pdf`), which is exactly how the M19/M58 deviation was proved.
- A bare `python -m pytest` without the venv fails with `ModuleNotFoundError: No module named
  'pymupdf'`.
- Recorded timings: cold all-104 extract ≈ **2 min**; warm re-run ≈ **3 s** (a skip reads the
  PDF's bytes to hash them but never re-parses); full pytest ≈ **45 min**.

### What already exists — do not reinvent any of this

| Thing | Where | Note |
|---|---|---|
| Batch summary renderer | `pipeline/ingest/batch.py:392-499` `format_summary` | Pure `dict → str`, no helpers, one caller (`:579`). **This is the one you change.** |
| FR-15 gate summary | `pipeline/validate/verify.py:57` | **Same name, different function. Do not touch.** |
| Run manifest | `work/run-manifest.json` (`DEFAULT_MANIFEST_PATH`, `batch.py:59`) | gitignored; 104 entries; `run_timestamp` is the only volatile field |
| Terminal statuses | `batch.py:63` `STATUSES = ("extracted", "failed", "skipped-unchanged")` | note the hyphen |
| Code fingerprint | `pipeline/ingest/fingerprint.py:132-139` `code_version()` | SHA-256 over `pipeline/**/*.py` (minus `tests/`, venvs, build, `__pycache__`) **+ `requirements.txt`**; path is hashed too, so a rename invalidates; empty-tree vacuity guard at `:113-119` |
| Idempotence comparison | `pipeline/precompute/records.py:113-135` `is_unchanged` | also gates on `RECORD_VERSION` |
| Self-validation aggregation | `pipeline/extract/__init__.py:32-41` | `"fail"` if any present check is not literally `"pass"`; `"not-applicable"` when there are no checks |
| The M19/M58 check | `pipeline/markers/defensive_actions.py:323-346` | families with `table is None` emit **no check** and travel as a warning instead |
| Link-rate check | `pipeline/markers/linking.py:325-359` | binary; `unlinked` carries pdf position + outcome |
| Slug registry | `pipeline/precompute/slug_registry.py` (1,496 lines, **generated**) | Python **for a load-bearing reason** — a `.json`/`.yaml` registry falls outside `code_version()`'s glob. `OVERRIDES` ships empty. |
| Pin enforcement | `pipeline/precompute/identity.py:454-469` `check_pins` | 1,400 pinned ids; raises `SlugRegistryError`, exit 1 |
| Committed-data pinning | `identity.py:545-649` `check_committed_data` | **never reads green on absence**; emptiness checked per-glob, not on the union |
| Directory-atomic swap | `pipeline/precompute/profiles.py:1152-1183` `_swap_directory` | **the pattern Task 6 reuses** |
| Atomic per-file write | `pipeline/ingest/records.py:51-71` `write_canonical` | `newline=""` is load-bearing on Windows |
| Canonical JSON | `records.py:41-43` | `sort_keys=True, indent=2, ensure_ascii=False` + trailing `\n` |
| Budget gates | `pipeline/precompute/budget.py` | `BUDGET_BYTES = 500_000`; `gzip.compress(..., compresslevel=9, mtime=0)` over the canonical string, **not** what shell `gzip -9` reports |
| Route-manifest bijection | `pipeline/precompute/index.py:1177-1270` | write-blocking profile direction — the deadlock |
| Rounding / precision | `pipeline/precompute/serialize.py` | *"Rounding is not cosmetic — it is what makes byte-identity possible."* No `multipleOf` exists in any schema; nothing else will catch you |

### Figures to reproduce (re-measure; do not copy forward as assertions)

| Measure | Value |
|---|---|
| Tracked files under `data/` | 1,412 (1,402 artifacts + 10 fixtures) |
| Bundles | 104, 17,887,538 bytes total; max **14,251** gzip-9 (`m082-belgium-senegal`) = **2.85%** of budget |
| Hub combined | `tournament.json` 39,137 + `leaderboards.json` 78,501 = **117,638 / 500,000 = 23.5%** (36 boards, 2,965 tie-extended rows, `PLAYER_ROW_CAP = 100`) |
| Profiles | 1,296; largest **1,543** gzip-9 = **0.31%** |
| Pinned ids | **1,400** (104 matches + 1,248 players + 48 teams) |
| Pinned id references | bundles 89,358 · index 1,608 · profiles 29,264 |
| Entities | 48 teams · 1,248 players (1,039 with a performance block, **209 lineup-only**) |
| Marker links | 2,571 / 2,571 = **100%** |
| Warnings per record | **7** → 728 summary lines today |
| Tests collected | ~1,733 (drifts by design) |

### Failure & validation policy (AD-8, binding)

- **Per-report failures abort that report, never the batch.** Every failure lands as a typed
  exception in the manifest (`error_type` + `error`) and the loop continues.
- **Exit-code contract, house-wide:** `0` clean · `1` a real finding · `2` the harness could not
  run. *"Never raise a bare `ValueError`"* — overloading destroys the distinction.
- **Self-Validation is binary with no tolerance bands, and is never loosened (SM-C1).**
- **A gate that cannot fail is worse than no gate**, because it reads green. `check_committed_data`
  encodes this; keep the property. `index.py:1499-1512`'s qualified `INDEX RESULT: PASS (N
  check(s) COULD NOT RUN)` exists for the same reason — never paper over it.
- **Unlinked markers are retained and flagged, never dropped. Overlapping markers are never
  deduped** — each source drawing is one event.
- **Budget breach → split, or a logged decision. Never drop a field, truncate an array, or lower a
  precision to fit (SM-C2).** `index.py` adds: never truncate `entities` — those are the route
  manifest.

### Testing standards summary

- pytest only (AR-16), flat layout at `pipeline/tests/` (46 files, one per production module).
  **No `pytest.ini`, no `pyproject.toml`, no `setup.cfg`, no registered markers** —
  `conftest.py`'s `sys.path.insert` is what makes `pipeline.*` importable. Chunking, if forced, is
  **by file path only**.
- **Full suite in the background, not chunks.** A single 45-minute foreground invocation is killed
  in this environment; chunking has its own failure mode (an off-by-one reconciliation was a
  review finding).
- **Derive expected values from parsed data; never restate the implementation.**
- **Every gate ships with a constructed failure that drives it red.** Mutation-check each new
  test — each mutation must turn something red.
- **Byte-identity is tested on bytes, not parsed dicts.**
- The two-kind split is deliberate: *constructed* tests drive gates red; *corpus* tests run over
  the real staged spine. Corpus fixtures are module-scope, read gitignored `work/spine/`, and
  **skip locally but `pytest.fail` under `CI=1`** — *"a skip is exactly how a missing input comes
  to read as a pass."*
- `spike/mex_rsa.pdf` (16 markers, 2/2/8/3/1) is a permanent ground-truth fixture; any parser
  change must keep it green. **Counts and distribution only** — its printed coordinates are in a
  transposed frame vs AD-6.
- Style: `from __future__ import annotations`, modern hints, `@dataclass(frozen=True)` where it
  fits, absolute imports rooted at `pipeline.`, module docstrings naming the failure defended
  against plus the Task/AC, long sentence-like test names, repo-root-relative paths only. Probe
  scripts go to the session scratchpad, **never the repo**.

### Coordination — in-flight stories (respect strictly)

- **`app/` is OFF LIMITS.** Story 2-15 is in progress; 2-14 and 2-16 are in flight. The session
  git status shows dirty files under `app/` and `_bmad-output/` that are not yours.
- **Never `git add -A`.** A concurrent session's sweeping stage can capture your files and vice
  versa. **Stage your own paths explicitly and commit your slice early.**
- **`deferred-work.md` and `sprint-status.yaml` are shared.** Append-only, at the end, in both.
- **Verify in an isolated worktree** — three commits landed in the shared tree during 1.18's
  implementation and changed `pipeline/precompute/*.py` underneath it mid-run.
- **A concurrent `pipeline/**/*.py` save silently invalidates your batch.** This is not
  hypothetical: it cost 1.9 and 1.14 a discarded run each. If Task 9 has to wait for a quiet
  window, wait.
- Windows/PowerShell hazards from project memory: PS 5.1 `Get-Content`/`Set-Content` round-trips
  mangle accents and em dashes — use the edit tools; scripted Python edits must open files in
  **binary** mode or a one-line change commits as a whole-file CRLF rewrite.

### Known landmines (live risks for this story)

1. **Two `format_summary`s.** `ingest/batch.py:392` is yours; `validate/verify.py:57` is not.
2. **Never assert exit 0 on the batch.** Asserting it will make you "fix" a correctly-reported
   source defect. Assert the adjudicated baseline.
3. **Never filter records on `self_validation`.** M19 and M58 are ruled consumed; filtering them
   drops two matches from the tournament over a source defect in an unrelated domain.
4. **The dedup must emit warning text verbatim.** Three tests assert the full string is a
   substring of the summary. Truncation breaks them; a `"104 reports: "` prefix does not.
5. **`--force` is not a resume.** It discards completed work. Re-invoke instead.
6. **Editing `format_summary` changes `code_version()`** and invalidates all 104 staged records.
   Every production edit does. Sequence the run last.
7. **The bijection deadlock will bite on the first re-run**, because profiles now exist on disk.
   It is a `RouteManifestError` before the first byte, not a silent failure — but a naive
   one-command E2E run stops there.
8. **A partial write pinned as the AD-3 baseline is expensive to undo** — an id, once emitted,
   never changes. This is why Task 6 exists and why `.gitignore` needs the matching entry.
9. **`schemaVersion` is never a literal.** One reader: `pipeline/validate/schema.py:54-77`.
   `contract/version.json` currently reads `{"schemaVersion": 4}`.
10. **Do not "unify" the second, non-atomic copy of the canonical-write recipe** at
    `pipeline/validate/runner.py:241-256`. It is pre-existing and ledgered.
11. **`work/` is gitignored and fully regenerable** — it is never the source of truth for anything
    shipped. Records are internal staging: `snake_case`, no `schemaVersion`. **camelCase binds only
    `/contract` and `/data`.**
12. **The known worktree artefact** (`test_contract_schemas.py::test_the_committed_generated_types_still_match_the_schemas`)
    fails in a fresh worktree and passes in the main tree. Not a finding.

### Project Structure Notes

`pipeline/` subpackages, per `pipeline/README.md:318-338` and AR-9: `discover/` (text-anchored
page discovery, anchor registry, corpus metadata probe) · `extract/` (per-domain tabular
extractors) · `ingest/` (**batch orchestration, run manifest, idempotence, per-report Extract,
CLI — where `format_summary` lives**) · `markers/` (shared filter chain + page-family parsers) ·
`precompute/` (**AD-9's second phase — identity, slug registry, spine, emit, index, profiles,
budget**) · `validate/` (check registry, sample selection, FR-15 verification runner, CLI) ·
`tests/`.

Declared departure, recorded so it is not read as a violation: `pipeline/precompute/budget.py`
sits in `precompute/`, not `validate/`, because it is a property of the bytes that module writes,
measured at the moment of writing. `ARCHITECTURE-SPINE.md:176` files budget asserts under
`validate/`; the departure is deliberate and ledgered with no action owed.

`data/` is the committed artifact tree (AD-13). `work/` is gitignored scratch. Nothing this story
writes belongs anywhere else.

### References

- Story definition and ACs — `_bmad-output/planning-artifacts/epics.md:589-609`
- FR-16 batch run report — `prds/prd-wc-stats-2026-07-21/prd.md:217-221`
- FR-1 batch ingestion + idempotence — `prd.md:98-103`
- FR-14 per-report Self-Validation — `prd.md:205-209`
- NFR-6 pipeline reproducibility — `prd.md:392`
- SM-1 / SM-C1 / SM-C2 — `prd.md:441`, `:451`, `:452`
- UJ-5 (re-run after a parser fix) — `prd.md:51-52`
- AD-3 one identity / an ID once emitted never changes — `architecture/…/ARCHITECTURE-SPINE.md:58-62`
- AD-4 exact artifact set, budget, route-manifest bijection — `ARCHITECTURE-SPINE.md:64-68`
- AD-8 fail loud, validate per report, deterministic output — `ARCHITECTURE-SPINE.md:88-92`
- AD-9 two-phase pipeline — `ARCHITECTURE-SPINE.md:94-98`
- AD-13 committed artifacts, build chain, pytest dev-machine only — `ARCHITECTURE-SPINE.md:118-122`
- AD-14 contract bootstrap, fixtures until real artifacts replace them — `ARCHITECTURE-SPINE.md:124-128`
- Epic 1 exit criteria — `epics.md:172`, `:190`
- M19/M58 ruling — `deferred-work.md`, anchor *"ACCEPTED — two corpus pages draw one forced-turnover marker fewer than their own printed total"*; `pipeline/README.md:516-523`; discovery at `1-12-…md:238-245`
- The three `format_summary` warning filings — `deferred-work.md`, anchors *"so the batch summary prints 104 identical warning lines"*, *"so the batch summary now prints 208 more warning lines"*, *"A fourth family of absence warning now fires on every report"*
- The two write-rollback filings — anchors *"An `OSError` mid-write leaves `data/matches/` partially populated"*, *"A partial `data/index/` with no rollback, now on a second write path"*
- Phase-ordering ownership — anchor *"the profile direction PRINTS that it could not run"*; `pipeline/precompute/index.py:1178-1212`
- `--expect-reports` coverage gap — anchor *"No test exercises the batch beyond three reports"*
- `code_version` false alarms — `1-14-…md:496-498`, `1-9-…md:483-489`, `sprint-status.yaml:2016-2024`, `:2480-2484`
- Slug registry pinning rule — `1-15-…md:121`, `pipeline/precompute/identity.py:454-469`, `slug_registry.py:1-28`
- `.gitignore` staged/rollback rationale — `.gitignore:26-34`
- Suite runtime and chunking rulings — `1-16-…md:361`, `:713-721`, `1-17-…md:318`, `:510`, `1-18-…md:844-847`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story context created; status backlog → ready-for-dev. |

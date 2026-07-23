---
baseline_commit: d85e67d1c0c1d06279733a7de8f2c83851288fd1
---

# Story 1.5: Marker–Event Linking via Digit-Glyph Proximity

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the builder,
I want every shot marker linked to its tabular event row by matching nearby digit glyphs,
So that spatial events carry time, player, body part, and xG — unlocking every spatial join in the product.

## Acceptance Criteria

1. **Given** a shots page with parsed markers and `get_text("words")` digit glyphs
   **When** linking runs
   **Then** every linked shot exposes time, player, body part, and xG joined from the tabular event rows (FR-12).

2. **Given** a marker that cannot be linked
   **When** the report is processed
   **Then** the marker is retained with coordinates and outcome, flagged in the run manifest, and that report's Self-Validation fails — the link-rate requirement is 100%, never loosened (SM-C1)
   **And** Self-Validation is now the full binary check: exact marker count AND 100% link rate (FR-14, complete).

3. **Given** the reference report
   **When** linking runs under pytest
   **Then** 16/16 markers link to their event rows with correct player/minute/xG values.

4. **Given** the venue × matchday sample
   **When** the FR-15 gate re-runs with linking active
   **Then** per-report link rates are recorded in the deviation summary.

> **xG note (binds AC 1 and 3):** the contract already resolved xG. `ShotEvent.expectedGoals` is nullable with this corpus-verified `$comment`: *"PMSR prints xG only as a team total on the Key Statistics page; the shots event table has no xG column (verified across all 104 reports, 2026-07-22). v1 therefore emits null per shot. A per-shot xG source is an AD-14 change request."* [Source: contract/match-bundle.schema.json#$defs/ShotEvent] The AC's "xG" is satisfied by emitting `expected_goals: null` on every linked shot per that logged decision. Do NOT hunt for an xG column; do NOT invent values; the ground-truth assertion for xG is that it is `null`.

## Tasks / Subtasks

- [x] Task 1: Read the seam files before writing any code (AC: all)
  - [x] Read fully: `pipeline/markers/shots.py`, `pipeline/markers/filter_chain.py`, `pipeline/markers/errors.py`, `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/validate/deviations.py`, `pipeline/tests/conftest.py` (the shots section of `make_report`), `pipeline/tests/test_markers_shots.py`, `pipeline/tests/test_ingest_record.py`
  - [x] Read the contract targets: `contract/match-bundle.schema.json` `$defs/ShotEvent`, `contract/common.schema.json` `$defs/{ShotOutcomeDetail, BodyPart, ShotDeliveryType, Minute, StoppageMinute, ShirtNumber}`
- [x] Task 2: Attempts-table row extraction — new module `pipeline/markers/attempts.py` (AC: 1)
  - [x] Rebuild table pages into visual rows exactly as `shots._table_lines` does (y-clustering, 3 pt tolerance, `get_text("words")`); move that helper into `attempts.py` and have `shots.py` import it from there rather than duplicating it (keep `shots.py`'s public behavior byte-identical)
  - [x] Segment columns by the header words' x-positions (`Time` | `Player` | `Outcome` | `Body Part` | `Delivery Type` — "Body Part" and "Delivery Type" are two words each; boundaries at the `Body` and `Delivery` x0s). Never split by token count — player names and compound outcomes are multi-word
  - [x] Per row extract: `time_raw` (int, the verbatim printed Time token), `shirt_number` (leading int token of the Player cell), `player_name` (remaining Player-cell words verbatim, e.g. `"Brian GUTIERREZ"` — no case-folding, no slugging; identity is Story 1.15's), `outcome_detail`, `body_part`, `delivery_type` (label → contract-enum mapping per Dev Notes; assert-on-unknown with a typed error)
  - [x] Multi-page tables (37/104 reports): parse each anchored table page below its own repeated header, concatenate rows in anchored page order; row ordinal = 1-based position in the concatenated list per side
  - [x] The row parser's row count must equal `_attempts_table_count`'s for the same pages — assert this internally (a divergence is a parser bug, typed error, never silently reconciled)
- [x] Task 3: Digit-glyph collection + proximity linking — new module `pipeline/markers/linking.py` (AC: 1, 2)
  - [x] Collect candidate glyphs from the map page's `get_text("words")`: words that fullmatch `\d+` under `re.ASCII`, inside the pitch rect, excluding the legend band (see Dev Notes probe findings — real labels sit ON their markers, center distance < 1 pt)
  - [x] Link: for each marker, nearest digit-word center; accept only within a tight threshold (probe supports ≤ the marker radius, 5.625 pt = half the 11.25 pt marker diameter — define the constant in `linking.py`; conftest's same-named `SHOTS_MARKER_RADIUS` is fixture-side only, never import test code into production. Nearest-vs-next margin is ≥ 9.5 pt on ground truth). Enforce bijection: each accepted ordinal used exactly once, ordinal ∈ 1..N (N = table row count). Any marker failing threshold, bijection, or range → **unlinked** (retained, flagged); never guessed, never dropped, never deduped
  - [x] Join: ordinal k → k-th attempts-table row (printed order, per side). There is NO number column in the table — the ordinal indexes row position (1.3's dev note guessed "shot number column"; the probe disproved it)
  - [x] Link-correctness cross-check: the linked row's `outcome_detail` must map to the marker's RGB `outcome` via the contract's `x-maps-to-outcome`; a mismatch makes that marker **unlinked** (it is evidence of a wrong join, not a tolerable variance)
  - [x] An unlinkable marker is per-marker data, not an exception: the report still extracts, the marker keeps coordinates + outcome with null joined fields, Self-Validation fails (AC 2). Typed exceptions are only for structural failures (unparseable table row, unknown label)
- [x] Task 4: Enrich the shots domain block in the Extraction Record (AC: 1, 2)
  - [x] In `parse_shots`'s event dicts add (snake_case, deterministic): `linked` (bool), `ordinal` (int | null), `time_raw` (int | null), `shirt_number` (int | null), `player_name` (str | null), `outcome_detail` (enum str | null), `body_part` (enum str | null), `delivery_type` (enum str | null), `expected_goals` (always `null` — see the xG note; present so Story 1.16's mapping is mechanical, the `own_goal: False` precedent)
  - [x] Keep the existing deterministic sort key and all existing fields untouched; unlinked markers carry `linked: false` + null joined fields
  - [x] Wire in `pipeline/ingest/extract_report.py` additively — enrich `domains["shots"]`, do not disturb `domains["match_metadata"]` (Story 1.6's, in review) or the check-append composition
- [x] Task 5: Complete Self-Validation (FR-14) + manifest flagging (AC: 2)
  - [x] Append per-team `shots-link-rate` checks beside `shots-marker-count` in the record's `self_validation.checks`: `{check, team, result, linked_count, marker_count, unlinked}` where `unlinked` lists each unlinked marker's identifying specifics (pdf position + outcome). Result `fail` iff any marker unlinked — binary, no tolerance (SM-C1)
  - [x] Keep the existing composition seam: checks append, `aggregate_self_validation` re-aggregates; the manifest mirrors `self_validation` + `self_validation_failures` (the unlinked-marker list must reach the manifest — FR-14's "specifics")
  - [x] Keep the self_validation block well-shaped (the `_self_validation_trustworthy` staged-record gate from 1.3's review must still recognize it)
- [x] Task 6: Register the FR-15 gate check (AC: 4)
  - [x] `pipeline/validate/checks.py`: register `marker-event-link-rate` append-only, category `count-mismatch` (pre-planned in that module's docstring; the 4 deviation categories are frozen — never add a 5th)
  - [x] Deviation specifics must carry the per-report link rate (e.g. `home: 15/16 markers linked` …) so a below-100% report's rate lands in the deviation summary. Do NOT change the runner, sample selection, or report format — the AC-3 seam from Story 1.4 guarantees checks plug in without format changes; a clean report (100% everywhere) emitting zero deviations is the correct reading of AC 4 — a deliberate narrowing (the deviation framework records only departures); state it in the Completion Notes so a reviewer doesn't flag AC 4 as unmet on a clean gate
- [x] Task 7: Tests (AC: 1, 2, 3, 4)
  - [x] New `pipeline/tests/test_markers_attempts.py` and `pipeline/tests/test_markers_linking.py` (one test module per source module, house convention)
  - [x] Extend `make_report` **additively** (new keyword params only — the factory is contended with in-review Story 1.6; never rewrite its body): draw ordinal digit labels centered on each synthetic marker (default on, matching the real layout) and full table rows (Time, shirt, name, outcome, body part, delivery). Params to displace/suppress labels, duplicate ordinals, and corrupt labels for negative tests. All existing 1.3/1.6 tests must stay green
  - [x] Fixture-evolution mechanics (the invariant above fails without these): (a) today's default rows are all `Off Target` while `DEFAULT_SHOTS_MARKERS` includes `goal`/`on-target` markers — once labels default on and the outcome cross-check runs, those markers would unlink and fail SV on every default report, breaking e.g. `test_ingest_batch`'s `self_validation == "pass"` assertions. The factory's default rows must derive row k's printed outcome label from marker k's outcome (reverse-map outcome → a compatible label, e.g. `goal` → "On Target - Goal"); (b) default rows are currently drawn as one text run at x=55 — the extended factory must place each cell at its header column x-position or Task 2's column segmentation misassigns words on synthetic fixtures
  - [x] Negative tests: unlinkable marker → retained + `linked: false` + SV fail + manifest flag; duplicate ordinal → both markers unlinked; outcome cross-check mismatch → unlinked; unknown outcome/body-part/delivery label → typed error; multi-page table ordinals continue across pages (`shots_table_pages={"home": [17, 9]}` reproduces the real overflow)
  - [x] Gate seam tests with the `clean_registry` fixture: link-rate deviation flows into the report; category is `count-mismatch`
  - [x] Ground truth (via the `mex_rsa_pdf` session fixture — auto-skip locally when absent, `pytest.fail` under CI; NEVER assert lifted coordinates, AR-16): home 16/16 + away 3/3 linked; spot-assert known rows — home ordinal 1 → (time 3, shirt 26, "Brian GUTIERREZ", `incomplete-blocked`→blocked, `right-foot`, `free-kick`), ordinal 3 → (time 8, "Julian QUINONES", `on-target-goal`→goal), ordinal 16 → (time 66, "Raul JIMENEZ", `on-target-goal`→goal, `head`, `cross`); away ordinal 1 → (time 37, "Lyle FOSTER", `off-target`, `head`, `pass`); every `expected_goals` is null
  - [x] `test_ingest_record.py` coordination: its comprehensions filter by `check["check"] == "shots-marker-count"`, so appended link-rate checks are already inert there — do NOT widen that filter (both check families carry `home`/`away` team keys, so a widened `{check["team"]: check}` dict would collide and its `["table_count"]` lookups would `KeyError`). Add *separate* assertions for the `shots-link-rate` checks, keyed independently
- [x] Task 8: Full verification + docs (AC: 2, 3, 4)
  - [x] Full suite green: `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`
  - [x] Full batch: `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104` — expect a cold full re-extract (~2 min; new module moves `code_version`, that is expected, not a defect). **All 104 Self-Validations must pass including link rate.** If any report links < 100%, that is the story's real work: iterate the heuristic (threshold, glyph filtering, bijection recovery) until it does, or document the failure per SM-C1 — never loosen the check, never drop a marker
  - [x] Re-run byte-identity: second run all skipped, `--force` byte-identical (compare `read_bytes()`, never parsed dicts)
  - [x] Gate: `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` — PASS expected; any deviation localized and explained
  - [x] `pipeline/README.md` (append-only) + `deferred-work.md` notes: (a) minute/stoppage mapping — the Time column prints first-half stoppage as plain cumulative minutes (ground truth prints `…46, 48, 45, 47…`; 48 precedes 45, so row order implies period); mapping `time_raw` → contract `MinuteStamp {minute, stoppageMinute}` needs period inference and is deferred to Story 1.16 with the ordinal/row-order context preserved in the record; (b) any label→enum pairing observed in the corpus beyond the fixtures' nine test-enforced ShotOutcomeDetail pairings (contract/README.md marks the other 13 as AD-14 candidates)

## Dev Notes

### Binding invariants (read before coding)

- **Never drop, never dedup, never guess.** An unlinkable marker is retained with coordinates + outcome, flagged, and fails that report's Self-Validation. Overlapping markers are never deduped — each source drawing is one event. 100% link rate is binary and never loosened (SM-C1, AD-8). A documented failure beats a silently wrong link.
- **Link failure is data; structural failure is a typed exception.** A marker that won't link → `linked: false`, SV fail, batch continues. An unparseable table row or unknown label → typed, report-scoped exception (assert-on-unknown, the `UnknownRgbError` precedent); the report fails loud, the batch continues.
- **Purity (AD-9):** linking runs inside `extract_report`'s pure function. No I/O beyond the open `pymupdf.Document`, no timestamps, no absolute paths, zero cross-report knowledge.
- **Determinism (AD-8):** every new record field is deterministic; 2-decimal rounding where floats appear; canonical serialization is handled by `records.write_record` — do not add volatile values. No new field may end in `.kickoff` (a timestamp-purity test whitelists that suffix).
- **`re.ASCII` on every `\d`** — fullwidth/Arabic-Indic digits otherwise pass `int()`. The whole feature is digit matching; this is not optional.
- **Never wrap per-marker/per-row loops in blanket `try/except`** — the #1 review anti-pattern (three stories running). Registry/mapping-table code runs outside guards and fails the run loudly.
- **Stay off Story 1.6's files** (in review, possibly active in another session): `pipeline/extract/**` and `pipeline/tests/test_extract_*.py` are untouchable; this story lives in `pipeline/markers/` (1.5 owns it — 1.6 was barred from it). Shared-file edits (`extract_report.py`, `checks.py`, `conftest.py`, `test_ingest_record.py`, `README.md`, `deferred-work.md`) are additive/append-only. Do not commit 1.6's untracked test files or the unrelated modified `data/fixtures/index/leaderboards.json` with this story's commit.

### Scoping probe findings (ground truth, 2026-07-23) — the heuristic is de-risked

A read-only probe of `spike/mex_rsa.pdf` using the shipped 1.3 modules settled the story's central unknowns. Re-derive, don't trust blindly — but design to these facts:

- **The digit glyphs are ordinal shot numbers 1..N printed ON the markers** (white text over the circle): home map has exactly digits `1`–`16` for 16 markers, away `1`–`3` for 3. Nearest digit-word center to each marker is **0.7–0.8 pt**; the next-nearest is **≥ 9.5 pt** (typically 20–120 pt). Nearest-with-threshold is robust here; the "hardest sub-task" risk concentrates in crowded six-yard-box reports elsewhere in the corpus — hence the bijection + cross-check safety nets.
- **The ordinal indexes the attempts table's printed row order** (per side; continues across the 37 two-page tables). There is no number column in the table.
- **End-to-end validation on ground truth passes:** marker `1` (blocked) ↔ row 1 "Incomplete - Blocked" → blocked ✓; marker `3` (goal) ↔ row 3 minute 8 Julian QUINONES "On Target - Goal" ✓; marker `16` (goal) ↔ row 16 minute 66 Raul JIMENEZ ✓; away 3/3 ✓.
- **Table row shape (home, real words):** `3 | 26 | Brian GUTIERREZ | Incomplete - Blocked | Right Foot | Freekick`. The hyphen in compound outcomes is a separate `-` word. Time values are plain ASCII ints corpus-wide (1.3's count heuristic keyed on that across all 104 reports).
- **Stoppage-time discovery:** home rows run `…41, 41, 46, 48, 45, 47, 51…` — first-half stoppage prints as plain cumulative minutes (48 = 45+3), and only row order reveals the period. Store `time_raw` verbatim; do not attempt the `MinuteStamp` split here (deferred note, Task 8).
- **Glyph collection is clean:** inside the pitch rect the only digit-words are the N ordinals; the legend band (`Goal On Target Off Target Blocked Incomplete`) contains no digits; page-header text (date/venue/kickoff `13:00`) sits outside the pitch rect and `13:00` doesn't fullmatch `\d+` anyway.

### Module placement

```
pipeline/markers/
  attempts.py     # NEW — attempts-table row extraction (columns via header x-positions)
  linking.py      # NEW — digit-glyph collection, proximity assignment, cross-check, enrichment
  shots.py        # UPDATE — factor out _table_lines for reuse; enrich event dicts via linking
  errors.py       # UPDATE — new typed error classes (see taxonomy)
pipeline/ingest/extract_report.py   # UPDATE — additive wiring only
pipeline/validate/checks.py         # UPDATE — register marker-event-link-rate, append-only
pipeline/tests/
  test_markers_attempts.py  # NEW
  test_markers_linking.py   # NEW
  conftest.py               # UPDATE — additive make_report params (contended with 1.6)
  test_markers_shots.py     # UPDATE — only if the _table_lines factor-out requires it
  test_ingest_record.py     # UPDATE — extend the team-carrying-check filter (1.6's pattern)
```

House style: `from __future__ import annotations` first; `str | None` unions; `@dataclass(frozen=True)`; absolute imports rooted `pipeline.`; module docstring names the failure it defends + Task/AC.

### Attempts-table row extraction

- Reuse the visual-row technique (`get_text("words")`, y-cluster at 3 pt — `_ROW_Y_TOLERANCE_PT`). Exactly one header row per page carrying Time/Player/Outcome; ambiguity or absence is `AttemptsTableError` (existing class). Do NOT import `pipeline/extract/lines.py` — that is 1.6's module; `markers/` keeps its own helper.
- **Column boundaries from header word x0s** (`Player`, `Outcome`, `Body`, `Delivery`); assign each row word to its column by x0. The Player cell = leading shirt-number int + name words verbatim (given name + UPPERCASE surname as printed; zero-width chars may survive normalization — a known deferred item; store verbatim).
- **Label → enum mappings (frozen dicts in `attempts.py`, the `SHOTS_RGB_TO_OUTCOME` precedent — literals, not schema imports, with a test cross-checking every value against the contract schema JSON):**
  - Outcome: kebab-case the words dropping ` - ` separators — `"On Target - Goal"` → `on-target-goal`, `"Deflected Off Target - Defensive Event"` → `deflected-off-target-defensive-event`. Target enum: the 22-value `ShotOutcomeDetail` closed set.
  - Body Part: `Right Foot`→`right-foot`, `Left Foot`→`left-foot`, `Head`→`head`, `Upper Body`→`upper-body`, `Lower Body`→`lower-body`.
  - Delivery: mechanical kebab-case **except** `Freekick`→`free-kick` (special case). Observed on ground truth: `Pass, Cross, Corner, Freekick, Loose Ball, Ball Progression, Other`; closed enum adds `penalty, interception, tackle`.
  - Any unmapped label → typed error with the label + page (never a silent skip, never a guess).

### Digit-glyph proximity linking

- Candidates: map-page words fullmatching `re.compile(r"\d+", re.ASCII)`, word-bbox center inside the pitch rect, above the legend band. Compare distances marker-center ↔ word-bbox center.
- Accept nearest iff distance ≤ threshold (start at `SHOTS_MARKER_RADIUS` = 5.625 pt; tune only with evidence). Then enforce: injective (no ordinal claimed twice), complete range (ordinal ≤ N rows). Violations demote the affected markers to unlinked — they do not abort the report.
- Cross-check every accepted link: `x-maps-to-outcome[outcome_detail] == marker.outcome` else unlinked. This is what turns "nearest glyph" into "correct link".
- If marker count ≠ table row count, the 1.3 count check already fails SV; linking still runs best-effort per-marker (a marker whose ordinal has a row can still link).

### Record & manifest shapes (snake_case — `work/` staging, never contract camelCase)

Enriched shot event (existing fields unchanged, additions shown):

```json
{
  "team_id": "mexico", "x": 85.1, "y": 42.0, "outcome": "goal", "own_goal": false,
  "linked": true, "ordinal": 3, "time_raw": 8, "shirt_number": 16,
  "player_name": "Julian QUINONES", "outcome_detail": "on-target-goal",
  "body_part": "right-foot", "delivery_type": "loose-ball", "expected_goals": null,
  "source": {"page_index": 13, "pdf_x": 191.25, "pdf_y": 193.5}
}
```

Unlinked: `"linked": false` and every joined field `null`. Self-validation check appended per team:

```json
{"check": "shots-link-rate", "team": "home", "result": "pass",
 "linked_count": 16, "marker_count": 16, "unlinked": []}
```

On fail, `unlinked` carries per-marker specifics (pdf position + outcome) and the manifest's `self_validation_failures` mirrors them (FR-14's manifest specifics). `playerId`/`at`/camelCase mapping is Story 1.15/1.16 territory — the record stores raw printed values only.

### Error taxonomy (one typed class per failure — reviewer-enforced)

Add to `pipeline/markers/errors.py`, subclassing `MarkerError`, carrying `report_id`, message `[{report_id}] …`: a class for unmappable table labels (label + page in message) and, if row-shape parsing can fail structurally, one for malformed attempt rows. Reuse `AttemptsTableError` for header problems. **No exception class for unlinkable markers** — that outcome is data (AC 2). Never bare `ValueError`; never one class for two failures.

### Verification-gate check (Story 1.4 seam — AC 4)

`register_check(Check("marker-event-link-rate", applies_to, run))` in `pipeline/validate/checks.py`, category `DeviationCategory.COUNT_MISMATCH` (the module docstring already reserves exactly this pairing). The runner, sample selection (16 reports, 16 venues × 9 rounds), and report format MUST NOT change — `test_runner.py::test_a_newly_registered_check_flows_into_the_report` guards the seam. Specifics format the rate: a below-100% report surfaces e.g. `home: 15/16 markers linked; unlinked: off-target@(234.0,230.2)`. Duplicate check ids raise; registration is append-only.

### Testing requirements

- pytest, `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests` (bare `python` lacks pymupdf).
- Ground truth via `mex_rsa_pdf`/`spike_corpus` fixtures ONLY (auto-skip locally with the fetch message, `pytest.fail` under CI). Counts, distributions, and now **table values** (player/minute/labels) are legitimate assertions; lifted *coordinates* are not (AR-16 transposed-frame trap).
- Derive expected values from what the factory drew — never hardcode a second literal (the `== 47` anti-pattern). `SHOTS_TABLE_HEADER`, `SHOTS_OUTCOME_RGB`, `DEFAULT_SHOTS_MARKERS` are exported for this.
- Byte-identity asserted on `read_bytes()`; synthetic fixtures must satisfy ALL live parsers (shots + Domain A + linking) — `make_report`'s default venue is real ("Mexico City Stadium") for exactly this reason; keep defaults compatible.
- No tautologies: the expected link count comes from the table/fixture spec, never from the linker's own output.

### Previous-story intelligence (1.2, 1.3, 1.4, 1.6 — review-enforced conventions)

- 1.3 left the landing zone ready: `source.{page_index, pdf_x, pdf_y}` persisted on every event *expressly for this story*; `counts` per side; events sorted `(team_id, page_index, pdf_y, pdf_x)` — keep that sort.
- 1.3 review: `_self_validation_trustworthy` disqualifies off-shape staged blocks → re-extract; keep the block well-shaped. Filter-chain robustness envelope is shots-tuned only (legend y-bucket drop, exact-bucket grouping, any-Bézier "circle") — noted in `deferred-work.md`; linking must not silently depend on tighter geometry than the chain guarantees.
- 1.2 review: `iterdir()` + sorted, never `glob`; `newline=""` on writes; exit codes 0/1/2; orphan-style failures fold into `run.result` without inflating `failed_count`.
- 1.4 review: loop-wide `try/except` collapsed 46 deviations into 1 — the categories are frozen at 4; empty corpus = fail; a gate PASS is sample-level (`unchecked_report_ids` lists the other 88).
- 1.6 (in review): appended its 6 checks beside 1.3's and re-aggregated — copy that composition exactly; it also repaired `test_ingest_record.py`'s team-key filter and `test_ingest_batch.py`'s venue — expect to touch the former the same way.
- Every Completion-Notes claim gets cross-checked against the suite in review (two false claims caught in 1.2). Write only what the tests prove.

### Git intelligence

One story = one squashed commit to `main` (memory: commit directly to main, no PRs; push as `juanrojasdp`). Subject `Story 1.5: <lowercase imperative>`; body with per-module breakdown, a `Discovery:` line (the stoppage-minute finding belongs there), `Verified:` with exact suite/batch/gate numbers, and a coordination note re 1.6 in-flight. Trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Adding any `pipeline/**/*.py` file moves `code_version` → full cold re-extract of 104 records (~2 min) is expected. Current suite baseline: 593 passed + 1 skipped (1.3 review point); 1.6's review may move it — re-baseline before claiming regressions.

### Project Structure Notes

- `pipeline/markers/` is this story's package per the Structural Seed: "parser family + shared core filter chain + **digit-glyph marker→event linking**". Do not put linking in `pipeline/extract/` (1.6's tabular package) or `pipeline/validate/` (checks only).
- No new dependencies: pymupdf 1.28.x covers `get_text("words")`. `pipeline/requirements.txt` unchanged (pinned pip, no uv).
- Anchors: consume `anchors["shots:home"|"shots:away"]` (`[map page, table page(s)]`, 0-based) from the record/`resolve_anchors` — never re-search text, never index pages.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5] — story + ACs verbatim
- [Source: _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md#FR-12,FR-14,FR-15,SM-1,SM-C1,§8.1] — linking, Self-Validation completion, gate, never-loosen
- [Source: _bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md#AD-6,AD-8,AD-9] — frame, fail-loud/no-dedup/binary-SV, purity + filter-chain family; Consistency Conventions (the spine's `link-failure` typed-exception convention applies to *structural* link-machinery failures only — an unlinkable marker is data per this story's taxonomy, never an exception; spike fixture rules)
- [Source: contract/match-bundle.schema.json#$defs/ShotEvent] — target shape; nullable `expectedGoals` with the corpus-verified no-xG-column `$comment`
- [Source: contract/common.schema.json#$defs/ShotOutcomeDetail] — 22-value enum + `x-maps-to-outcome` (mapping NOT prefix-derivable: `incomplete-blocked`→`blocked`); BodyPart, ShotDeliveryType (`Freekick`→`free-kick`), Minute/StoppageMinute ("90+2" semantics)
- [Source: pipeline/markers/shots.py] — `source` pdf-space block, `_table_lines`, `_attempts_table_count`, sort key, `self_validation_block`
- [Source: pipeline/ingest/extract_report.py] — the two seams (domains + appended checks), typed-error transparency rules
- [Source: pipeline/validate/checks.py] — registry contract; `marker-event-link-rate (count-mismatch)` pre-reserved in the docstring
- [Source: _bmad-output/implementation-artifacts/1-3-*.md#Dev-Notes,Dev-Agent-Record] — table heuristic, 37 two-page reports, transposition trap
- [Source: _bmad-output/implementation-artifacts/1-6-*.md] — shared-file coordination map (extract_report.py, checks.py, conftest.py, test_ingest_record.py)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — filter-chain envelope, zero-width chars, cover-line tolerances

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Implementation Plan

- `attempts.py` took `_table_lines` AND `_attempts_table_count` from `shots.py` (both, not just the story-named helper: the row parser's internal count assert would otherwise need a circular `attempts -> shots` import). `attempts_table_count` keeps the exact 1.3 header rule (Time/Player/Outcome presence, single header row) via `_header_y`; the stricter boundary validation (`_header_geometry`: exactly one `Player`/`Outcome`/`Body`/`Delivery` word, x-ordered) applies only to row parsing, so counting behavior is unchanged by the factor-out.
- Column assignment: word -> rightmost boundary with `x0 >= boundary - 1.0 pt` tolerance. Admission rule for attempt rows is shared verbatim between counter and parser (`_attempt_lines`), with the divergence assert kept as a defensive net.
- `linking.py`: glyph collection (fullmatch `\d+` under `re.ASCII`, bbox center inside pitch, legend band excluded within the marker radius of any `legend_row_ys` bucket) -> nearest-with-threshold (`SHOTS_MARKER_RADIUS = 5.625`) -> bijection (duplicate claims unlink ALL claimants; range 1..N) -> `x-maps-to-outcome` cross-check. `filter_chain.py` gained `legend_row_ys` (extracted from `exclude_legend_rows`, behavior identical) so linking and marker exclusion share one legend definition.
- Enrichment rides the existing event dicts via `event_fields(row)`; sort key untouched; `counts["table"]` now `len(rows)` (asserted equal to the 1.3 heuristic inside `parse_attempt_rows`).
- Self-Validation: `link_rate_checks` derives per-side checks from the events themselves (single source of truth); appended in `extract_report` between the marker-count and Domain A checks. Manifest mirroring needed no change (generic check-dict copy); `format_summary` gained an `unlinked`-aware rendering branch so a link-rate failure prints its rate instead of the shots-count template's `table lists None`.
- Fixture evolution: default ordinal labels ON, drawn as white fontsize-6 text centered on each marker; table cells at exported `SHOTS_TABLE_COLUMNS` x-positions; row k's outcome label derived from marker k via `SHOTS_OUTCOME_TO_LABEL` (goal->"On Target - Goal" etc.) so default fixtures always pass the cross-check.

### Debug Log References

- Baseline before changes: 592 passed + 1 skipped + 1 transient fail (`test_code_version_is_stable_across_calls` — memoized `code_version` vs. a concurrent session touching pipeline files mid-run; passes in isolation). Suite baseline moved from the story's stated 593+1 by the in-flight 1.6 review session.
- Concurrent-session coordination: `extract_report.py`, `checks.py` and `test_ingest_record.py` changed on disk mid-story (1.6 review: `domain_a_checks(payload)` signature, Domain A memo). All 1.5 edits re-applied against the current content; no 1.6 change reverted.
- Task 8 batch iterations (each diagnosed against the real PDFs before changing code): run 1 — 27 `UnknownLabelError` (bare `Incomplete`/`On Target` labels) + 17 link-failed; run 2 (labels mapped, greedy bijection) — 25 link-failed; run 3 (edge-marker reach + compatibility-as-constraint) — 20 link-failed; run 4 (merged-word readings, two-pass) — 2 link-failed (a reading-lock rigidity case and the both-colours detail); run 5 (char-interval conflicts + `DETAIL_COMPATIBLE_OUTCOMES`) — **PASS 104/104, 2571/2571 linked**.

### Completion Notes List

- AC 1: every linked shot exposes `time_raw`, `shirt_number`, `player_name`, `outcome_detail`, `body_part`, `delivery_type`, `ordinal` joined from the attempts table. `expected_goals` is `null` on every shot BY DESIGN — the contract's corpus-verified `$comment` (no xG column in the shots table); the ground-truth assertion for xG is that it is null.
- AC 2: an unlinkable marker is data — retained with coordinates + outcome, `linked: false`, null joined fields; per-team `shots-link-rate` check fails (binary, no tolerance), record still extracts, manifest mirrors the unlinked-marker specifics and the run fails without inflating `failed_count`. Verified end-to-end in `test_markers_linking.py` (extract_report + run_batch negative tests).
- AC 3: ground truth links 16/16 home + 3/3 away with clean ordinal bijections; spot-asserted joins — home ordinal 1 (time 3, shirt 26, Brian GUTIERREZ, incomplete-blocked->blocked, right-foot, free-kick), ordinal 3 (time 8, Julian QUINONES, on-target-goal->goal), ordinal 16 (time 66, Raul JIMENEZ, on-target-goal->goal, head, cross), away ordinal 1 (time 37, Lyle FOSTER, off-target, head, pass).
- AC 4 — deliberate narrowing, do not flag as unmet: a clean gate (100% linked everywhere) emits ZERO `marker-event-link-rate` deviations. The deviation framework records only departures; per-report link rates land in the deviation summary exactly when a report links below 100% (specifics format: `home: 1/2 markers linked; unlinked: goal@(x,y)`). Both directions are test-enforced (`test_a_link_rate_deviation_flows_into_the_gate_report`, `test_a_fully_linked_report_emits_no_link_rate_deviation`). Runner, sample selection and report format untouched.
- Coordination edits outside the story's own modules, all additive: `test_runner.py::test_checks_run_are_recorded` (new check id in the exact sorted list), `test_checks_registry.py::test_a_later_story_can_register_a_check_into_the_registry` (its example id WAS `marker-event-link-rate`, now genuinely registered — example moved to the unclaimed `crosses-count-match`), `test_ingest_record.py` (new independent `shots-link-rate` test; the existing `shots-marker-count` filters were NOT widened, per the story's collision warning), `batch.py::format_summary` (link-rate rendering branch).
- Label -> enum mappings are frozen literals in `attempts.py`, cross-checked by tests against `contract/common.schema.json`. THREE corpus discoveries diverge from the contract and are filed as AD-14 change requests in `deferred-work.md`: (1) bare `Incomplete` (31 rows) and bare `On Target` (3 rows) are real printed labels missing from the closed 22-value enum — mapped mechanically to `incomplete`/`on-target`; (2) `deflected-on-target-defensive-event` markers render in BOTH colours (10 incomplete + 1 on-target of 11 rows) — `DETAIL_TO_OUTCOME` keeps the contract's pairing, and the linking cross-check consults `DETAIL_COMPATIBLE_OUTCOMES`, which accepts either colour for exactly that one detail; (3) all 10 delivery labels observed, `Freekick`->`free-kick` confirmed corpus-wide (146 rows).
- The linking heuristic was iterated against the full corpus exactly as Task 8 prescribes (first run: 27 failed reports + 17 link-failed): (a) the two missing bare outcome labels caused all 27 `UnknownLabelError` failures; (b) independent per-marker nearest-glyph broke on overlapping six-yard-box markers — replaced with a greedy global bijection (nearest still-available glyph); (c) edge markers at `pdf_y == pitch.y0` lost their labels to the pitch-rect containment test — glyph collection now tests against the pitch expanded by the marker radius; (d) overlapping markers' labels merge into ONE extracted word ("34", "910", "1011", "1819"; 10 reports) — digit words are offered as their valid 1-2-digit partitions, two-pass (whole words first, split parts as rescue), claims on one word disjoint by char interval, split parts never contesting an assigned ordinal. The threshold itself (5.625 pt) never moved, the check was never loosened, and no marker was ever dropped.
- Final corpus state: **2571/2571 markers linked (100%) across all 104 reports; batch PASS; all Self-Validations pass; gate PASS with 0 deviations; re-run 104/104 skipped-unchanged; `--force` re-extract byte-identical (0 of 104 records differ by SHA-256).**

### File List

- `pipeline/markers/attempts.py` — NEW: visual-row helper (moved), row counter (moved), column-segmented row parser, frozen label->enum maps
- `pipeline/markers/linking.py` — NEW: digit-glyph collection, proximity linking with bijection + outcome cross-check, event enrichment, link-rate checks
- `pipeline/markers/shots.py` — table helpers factored out to `attempts.py`; linking wired into `parse_shots`; events enriched
- `pipeline/markers/filter_chain.py` — `legend_row_ys` extracted from `exclude_legend_rows` (behavior identical)
- `pipeline/markers/errors.py` — NEW `UnknownLabelError`, `AttemptRowError`
- `pipeline/ingest/extract_report.py` — `link_rate_checks` appended to Self-Validation (additive)
- `pipeline/ingest/batch.py` — `format_summary`: link-rate failure rendering branch (additive)
- `pipeline/validate/checks.py` — `marker-event-link-rate` check registered (append-only), docstring roster updated
- `pipeline/tests/conftest.py` — additive `make_report` params (`shots_ordinal_labels`, `shots_label_text`, `shots_label_offset`, `shots_table_cells`); default ordinal labels + column-positioned table cells; exports `SHOTS_TABLE_COLUMNS`, `SHOTS_OUTCOME_TO_LABEL`, `default_attempt_cells`
- `pipeline/tests/test_markers_attempts.py` — NEW (18 tests)
- `pipeline/tests/test_markers_linking.py` — NEW (31 tests)
- `pipeline/tests/test_markers_shots.py` — event-shape assertion widened to the enriched shape
- `pipeline/tests/test_ingest_record.py` — new independent `shots-link-rate` test
- `pipeline/tests/test_runner.py` — `checks_run` list gains `marker-event-link-rate`
- `pipeline/tests/test_checks_registry.py` — future-check example id moved off `marker-event-link-rate`
- `pipeline/README.md` — appended: linking semantics, stoppage-minute caveat, xG note
- `_bmad-output/implementation-artifacts/deferred-work.md` — Story 1.5 notes appended

## Change Log

- 2026-07-23: Story created (ultimate context engine analysis completed — comprehensive developer guide created). Scoping probe run against `spike/mex_rsa.pdf` settled the digit-glyph semantics (ordinals, on-marker labels, row-position join) before dev.
- 2026-07-23: Story implemented. `pipeline/markers/attempts.py` (row extraction, label->enum maps) + `pipeline/markers/linking.py` (glyph collection, two-pass bijective assignment, outcome cross-check, link-rate checks); shots events enriched; Self-Validation completed (marker count AND 100% link rate); `marker-event-link-rate` gate check registered. Heuristic iterated against the full corpus to 2571/2571 markers linked; three AD-14 contract discoveries filed (bare `Incomplete`/`On Target` labels; `deflected-on-target-defensive-event` renders in both marker colours). Batch 104/104 PASS, gate PASS 0 deviations, re-runs byte-identical.

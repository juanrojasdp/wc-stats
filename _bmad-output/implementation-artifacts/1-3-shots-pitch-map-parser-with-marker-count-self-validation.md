---
baseline_commit: 41f28e0a0ec6929603fa78713c67c8961c30cd51
---

# Story 1.3: Shots Pitch-Map Parser with Marker-Count Self-Validation

Status: done

## Story

As the builder,
I want the spike's shots parser productionized into the shared core filter-chain module with exact-RGB outcome mapping and marker-count self-validation,
So that the highest-value spatial extraction is trustworthy for every report and the recipe is reusable by every other map parser.

## Acceptance Criteria

1. **Filter chain + AD-6 normalization (FR-9, AD-9).** Given a shots map page, when the parser runs, the pitch frame is detected as the largest sub-page rectangle and marker positions are normalized against the **full** pitch rectangle to 0–100 coordinates in the AD-6 frame (explicit `team_id`, x=100 at opponent's goal line, y=0 attacker's left). The filter chain runs in the mandatory order: pitch-frame detect → circle-geometry/shape filter → legend-row exclusion (≥4 distinct legend colors at identical y) → exact-RGB outcome keying. The dark-blue table-header collision produces zero false markers because geometry runs before color.
2. **Ground-truth fixture (FR-10, AR-16).** Given the permanent fixture `spike/mex_rsa.pdf`, when the parser runs under pytest, exactly 16 shot markers are found on the Mexico (home) map with the distribution 2 goal / 2 on-target / 8 off-target / 3 blocked / 1 incomplete. Counts/distribution only — the spike's printed coordinates are in a transposed frame vs AD-6 and are **never** expected values. The test skips cleanly with a clear message when the PDF is absent (it is gitignored; `conftest.py` already handles this).
3. **Assert-on-unknown, never dedup (FR-11, AD-8).** Given a marker with an off-palette color, outcome keying aborts that report's extraction with the RGB value and page in the error — never a silently dropped marker. Overlapping markers are never deduped — each source drawing is one event.
4. **Marker-count Self-Validation (FR-14 count check, AD-6).** Given the tabular attempts table on the same report, the extracted marker count is compared exactly per team — binary pass/fail, no tolerance — and recorded in the manifest with both counts on mismatch. Own goals are flagged `own_goal: true` (PMSR marks none; see Dev Notes) and shootout attempts land in `ShootoutAttempt` semantics, never among shot events.
5. **Gate re-run (from Story 1.4's standing AC).** The venue × matchday template-consistency gate re-runs with the shots checks registered and the result is recorded: shots deviations (unknown-rgb, count-mismatch) appear in the deviation summary, localizable to venue/matchday.

## Tasks / Subtasks

- [x] Task 1: Create the `pipeline/markers/` package with the shared core filter chain (AC: 1, 3)
  - [x] `pipeline/markers/__init__.py`, `pipeline/markers/errors.py`, `pipeline/markers/filter_chain.py`
  - [x] Port the spike recipe (`spike/extract.py`) into `filter_chain.py` with the four stages as separately testable functions, composed in the mandatory order; tuning knobs live in a frozen `MarkerSpec` dataclass so Stories 1.11–1.13 reuse the module with per-type tuning only
  - [x] Typed exceptions (one per failure class, subclass `PipelineError`, carry `report_id`, message format `[{report_id}] …`): at minimum `PitchFrameError`, `UnknownRgbError` (must include the rounded RGB tuple + 0-based page index), `AttemptsTableError`, `ShotsPageLayoutError`
- [x] Task 2: Implement the shots parser `pipeline/markers/shots.py` on top of the chain (AC: 1, 2, 3)
  - [x] `parse_shots(doc, anchors, report_id, home_team, away_team) -> dict` — pure, no I/O beyond the open `pymupdf.Document`
  - [x] AD-6 normalization including the axis transposition (see Dev Notes — do NOT copy the spike's `nx`/`ny` lines)
  - [x] Emit snake_case shot events: `team_id`, `x`, `y` (0–100, rounded to 2 decimals), `outcome` (hyphenated enum values), `own_goal`, and a `source` block (`page_index`, `pdf_x`, `pdf_y` — Story 1.5 needs pdf-space positions for glyph proximity)
- [x] Task 3: Extract the expected attempts count from the tabular attempts table (AC: 4)
  - [x] Parse the event-table page (`anchors["shots:home"|"shots:away"][1]`) to count attempt rows; `re.ASCII` on digit classes; typed `AttemptsTableError` on unparseable — never default to the marker count (tautology)
- [x] Task 4: Wire into the extraction pipeline (AC: 1, 4)
  - [x] `pipeline/ingest/extract_report.py`: inside the open-document block, call `parse_shots`, populate `domains["shots"]` and replace `self_validation` (`result` flips to `pass`/`fail`; never left `not-applicable` once shots parse)
  - [x] `pipeline/ingest/batch.py`: mirror the record's `self_validation.result` into each manifest entry (including skipped-unchanged, read from the staged record); on `fail`, the entry also carries the failing checks with **both counts** (the AC requires both counts in the manifest on mismatch); fold any `fail` into `run.result` + exit code 1
- [x] Task 5: Register the two verification checks (AC: 5)
  - [x] In `pipeline/validate/checks.py`: `shots-parse` (parse failures / `UnknownRgbError` → `unknown-rgb` deviations) and `shots-count-match` (mismatch → `count-mismatch` deviation carrying both counts); runner, sample selection, and report format unchanged
- [x] Task 6: Tests (AC: 2, 3, 4)
  - [x] Ground truth: via existing `mex_rsa_pdf`/`spike_corpus` fixtures — 16 markers, 2/2/8/3/1 on the home map; both teams' self-validation passes end-to-end through `extract_report`; frame-orientation sanity (see Dev Notes); skip-clean behavior preserved
  - [x] Synthetic (extend `make_report` in `conftest.py` for multi-page shots + drawn vector content): dark-blue header-rect collision yields zero false markers; legend row excluded; overlapping markers both kept; unknown RGB aborts with RGB + page; count-mismatch produces `fail` with both counts; multi-page anchor handling
  - [x] Registry tests for both checks under the existing `clean_registry` fixture pattern
  - [x] Entire existing suite stays green (440 passed, 1 skipped baseline)
- [x] Task 7: Full-corpus run + gate re-run (AC: 4, 5)
  - [x] `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104` (all records re-extract — `code_version` moves; expected)
  - [x] `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`
  - [x] Record outcomes (104/104, self-validation results, gate result) in the Dev Agent Record; investigate any mismatch — never loosen the check (SM-C1)
- [x] Task 8: Documentation
  - [x] `pipeline/README.md`: add `markers/` to the layout section; document the shots domain block, manifest `self_validation` field, and the two new checks
  - [x] Append to `deferred-work.md` only with evidence from the full run (per its house rule)

### Review Findings

- [x] [Review][Decision] Off-shape staged `self_validation` block launders to `None` and the run passes — `_mirror_self_validation` maps any unrecognized/corrupt staged block to `None`; `self_validation_fail_count` counts only `"fail"`, so the run result stays `pass` (contra AD-8 fail-loud and the orphan precedent cited in the same file). A well-shaped `"fail"` whose `checks` is off-shape also yields `self_validation_failures: []`, violating the "both counts in the manifest on mismatch" contract. [pipeline/ingest/batch.py:154-172] (medium; blind+edge+auditor) — **Resolved 2026-07-23: re-extract.** `_self_validation_trustworthy` gates the skip decision; an off-shape block disqualifies the staged record (the `match_id` trust precedent) and the report re-extracts. Regression test added.
- [x] [Review][Patch] `format_summary` hardcodes the shots check shape — a failing Domain A check prints `[domain-a-…] None: None markers, table lists None` and its `specifics` are never shown [pipeline/ingest/batch.py:405-415] (medium) — fixed: shape-aware rendering falls back to the check's `specifics`
- [x] [Review][Patch] Claimed end-to-end ground-truth Self-Validation test does not exist — the real-PDF `extract_report` test never asserts `self_validation`; the ground-truth pass assertion bypasses `extract_report` [pipeline/tests/test_ingest_record.py:54-75, pipeline/tests/test_markers_shots.py:381-387] (medium) — fixed: the real-PDF `extract_report` test now asserts `result == "pass"` with 16/16 home, 3/3 away
- [x] [Review][Patch] `detect_pitch_frame` drops the spec's "stroked" constraint for stage 1 — a large fill-only band in the area window could win frame detection [pipeline/markers/filter_chain.py:90-105] (low) — fixed: fill-only drawings skipped; validated by full 104-report corpus re-run (PASS) + new synthetic test
- [x] [Review][Patch] Disclosed behavior "a legend containing an unknown color still reads as a legend" is untested — all legend tests use palette colors only [pipeline/tests/test_markers_filter_chain.py] (low) — fixed: off-palette-swatch legend test added
- [x] [Review][Patch] "Table-first ordering fails as `PitchFrameError`" is the docstring's safety argument for the ≥2-page revision but no test constructs a table-first section [pipeline/markers/shots.py:83, pipeline/tests/test_markers_shots.py] (low) — fixed: reversed-anchor test added
- [x] [Review][Patch] Dev Agent Record test-count breakdown does not match the diff (claims 26 parser / 6 batch-record; actual 24 / 9) [this file, Completion Notes] (low) — fixed: breakdown corrected in Completion Notes
- [x] [Review][Patch] README registered-checks inventory lists four checks while `checks.py` registers six [pipeline/README.md] (low) — fixed: Domain A pair added to the inventory
- [x] [Review][Patch] Both gate checks independently rebuild `PageTextIndex` and re-run `parse_shots` per sampled report — the naive-re-extraction lesson documented in `extract_report.py` [pipeline/validate/checks.py:137-153] (low) — fixed: one-slot per-document parse memo (value or exception replayed); regression test asserts one parse per document
- [x] [Review][Patch] Summary line labels a report-level tally "self-validation failure(s)" while the itemized list above it is check-level [pipeline/ingest/batch.py:434-437] (low) — fixed: "self-validation-failed report(s)"
- [x] [Review][Patch] Frozen-`MarkerSpec` test accepts any exception (`pytest.raises(Exception)`) so a typo'd attribute also passes [pipeline/tests/test_markers_filter_chain.py] (low) — fixed: asserts `dataclasses.FrozenInstanceError`
- [x] [Review][Patch] `emit_shots_pages` silently ignores `shots_table_rows` when `shots_table_pages` covers the same side [pipeline/tests/conftest.py] (low) — fixed: passing both for one side now raises
- [x] [Review][Defer] Filter-chain robustness envelope for reuse (1.11–1.13): legend y-bucket drops any real marker sharing the rounded y; legend grouping is exact-bucket with no tolerance clustering; circle filter accepts any all-Bézier filled shape in the size window [pipeline/markers/filter_chain.py:124-167] — deferred: empirically clean across the closed 104-report corpus and guarded loud by the count check; revisit when the chain is instantiated for crosses/defensive-actions/offers maps
- [x] [Review][Defer] Unknown-RGB keying aborts on the first miss, so the gate emits at most one `unknown-rgb` deviation per report and its specifics omit the team side [pipeline/markers/filter_chain.py:186, pipeline/validate/checks.py:165-174] — deferred: abort-first semantics accepted; zero unknown RGBs in the closed corpus
- [x] [Review][Defer] Timestamp guard exempts any record key ending `.kickoff` instead of the one exact path [pipeline/tests/test_ingest_record.py:111-118] — deferred, out of scope: Domain A (story 1-6) code

## Dev Notes

### Binding invariants (read before coding)

- **AD-9 (staging + shared module):** `extract_report` stays a pure `PDF → Extraction Record` function — no cross-report knowledge, no timestamps, no absolute paths, no writes inside the function. The filter chain is ONE shared core module; the shape/circle-geometry filter is **mandatory and runs before color keying** — the "incomplete" dark blue is reused by table-header rectangles, so color alone must never admit a marker.
- **AD-8 (fail loud):** unknown RGB aborts the report (typed exception → `failed` manifest entry; batch continues). Overlapping markers are never deduped. Self-Validation is binary — exact count, no tolerance, never loosened (SM-C1). A count mismatch is NOT an exception: the record is still written with `self_validation.result: "fail"` and both counts; the batch surfaces it (exit 1).
- **AD-6 (coordinate frame):** floats 0–100 over the FULL pitch rectangle, oriented to the acting team's attack direction: x=100 at the opponent's goal line, y=0 at the attacker's left touchline. Every event carries explicit `team_id` (= the shooting team). Shootout attempts never mix into shot events (they'd break the count check). Own goals: `own_goal` flag present on every event; PMSR marks no own goals anywhere (verified in Story 1.1 across the corpus), so real data emits `false` — the field exists so Story 1.16's contract mapping (`ownGoal`) is mechanical. Fixture m074's `ownGoal: true` is synthetic.
- **AR-16:** ground truth from `spike/mex_rsa.pdf` is **counts/distribution only**. The spike's printed coordinates are transposed vs AD-6 — never lift them as expected values, and never assert exact coordinates in tests.

### Module placement & shared filter-chain design (new package)

The Structural Seed reserves `pipeline/markers/` — "parser family + shared core filter chain + digit-glyph marker→event linking". Create it now; Story 1.5 (linking) and Stories 1.11–1.13 (crosses, defensive actions, offers/movement) extend it with per-type tuning only, so the chain's public surface must separate **recipe** (fixed order) from **tuning** (per-family values):

```python
@dataclass(frozen=True)
class MarkerSpec:
    marker_min_pt: float          # shots: 8.0
    marker_max_pt: float          # shots: 15.0  (real markers are 11.25×11.25 pt filled Bézier circles, white stroke)
    rgb_to_outcome: Mapping[tuple[float, float, float], str]
    legend_min_colors: int = 4    # legend row = ≥4 circles sharing one rounded-y with ≥4 distinct palette colors
```

Stage functions (each independently testable, composed in this order — the order is an invariant, not a style choice):

1. `detect_pitch_frame(page) -> pymupdf.Rect` — largest stroked `"re"` drawing with `10000 < area < 0.8 × page_area` (spike thresholds; keep as named module constants). Raises `PitchFrameError` if none qualifies. The pitch rect extends below the visible clip — that full rect IS the normalization basis.
2. `collect_candidate_markers(drawings, pitch, spec)` — filled drawings whose items are all `"c"` (Bézier circle segments), width/height within `[marker_min_pt, marker_max_pt]`, center inside the pitch rect. This geometry stage is what kills the dark-blue table-header collision (headers are `"re"` items, wrong size, and/or outside the pitch).
3. `exclude_legend_rows(candidates, spec)` — group by y rounded to 1 decimal; any group of ≥4 circles showing ≥`legend_min_colors` distinct palette colors is the legend and is dropped whole. (4+ distinct outcome colors at one identical y is implausible for real shots — spike-validated.)
4. `key_outcomes(markers, ...)` — round each fill RGB to 2 decimals and look up **exactly** in `rgb_to_outcome`; a miss raises `UnknownRgbError(report_id, rgb, page_index)`. Never filter by color before this stage; never drop.

No dedup anywhere in the chain — two markers at the same point are two events (six-yard-box pileups are real).

The shots palette (from `spike/extract.py`, frozen ground truth — note the record uses the contract's **hyphenated** enum values, not the spike's underscores):

```python
SHOTS_RGB_TO_OUTCOME = {
    (0.00, 0.50, 0.00): "goal",
    (0.36, 0.61, 0.84): "on-target",
    (0.96, 0.74, 0.00): "off-target",
    (0.70, 0.53, 1.00): "blocked",
    (0.18, 0.30, 1.00): "incomplete",
}
```

Use `import pymupdf` (the pipeline convention; only the frozen spike uses `import fitz`). Stdlib + pymupdf only — no new dependencies.

### The integration seam — files being modified (read them first)

- **`pipeline/ingest/extract_report.py` (UPDATE — the main seam).** Current state: pure `extract_report(path, content_hash=...)` builds the record inside `with pymupdf.open(path) as doc:`; `anchors` (`dict[anchor_id, list[int]]`, **0-based** page indices) and a `PageTextIndex` are already in scope; it returns `"domains": {}` and `"self_validation": {"result": "not-applicable", "checks": []}` — the docstring names these as the seams Stories 1.3+ plug into. This story: call the shots parser after anchors resolve, fill both blocks. Preserve: purity, metadata block, anchor map, warnings path, `RECORD_VERSION`. Do NOT wrap the new call in a broad `try/except` — let typed errors propagate to the batch loop, which already isolates per report.
- **`pipeline/ingest/batch.py` (UPDATE — manifest surfacing).** Current state: `run_batch` isolates one `try/except Exception` per PDF; `_entry()` produces `report_id, match_id, status, record_path, error_type, error, warnings`; `run.result` is `"pass"` only if `failed_count == 0 and not gaps and not orphans`; manifest written by CLI after the console summary. This story: add per-entry `self_validation` (mirrored from the record — for skipped-unchanged entries read it from the staged record, the same way `warnings` already flows), and fold any `fail` into `run.result` and exit code 1 without inflating `failed_count` (follow the orphan-records precedent: reported, run-level fail, not a per-report `failed` status). Keep `manifest_version` 1 — additive field. Preserve: summary-before-write ordering, `--force` byte-identity, empty-corpus-fails.
- **`pipeline/validate/checks.py` (UPDATE).** Current registry: `anchor-coverage`, `metadata-probe`; the header comment at `checks.py:15` already reserves `"1.3  shots-parse, shots-count-match (count-mismatch, unknown-rgb)"`, and `test_checks_registry.py:122` sketches a sample `shots-count-match` check. Register via `register_check(Check(check_id, applies_to, run))`; the runner/sample/report format **must not change**. Do NOT add a deviation category — `DeviationCategory.UNKNOWN_RGB` and `.COUNT_MISMATCH` (`pipeline/validate/deviations.py`) were created empty for this story.
- **`pipeline/tests/conftest.py` (UPDATE).** `mex_rsa_pdf` fixture already implements the AR-16 skip (skip locally with message, `pytest.fail` under `CI`); `spike_corpus` wraps `spike/` as a one-report corpus. `make_report` currently emits exactly ONE page per anchor — a known deferred-work gap because shots legitimately spans two pages (pitch map + event table). Extend it (or add a dedicated factory) to emit a two-page shots section with real vector content: a stroked pitch rectangle, filled Bézier circles (use `page.draw_circle` with fill), a legend row, and a dark-blue header rectangle on the table page.
- **Consume, don't reinvent:** `resolve_anchors`/`ANCHOR_REGISTRY` (the `shots` spec `"Attempts at Goal {team}"`, `per_team=True`, resolves to `shots:home`/`shots:away` — do not re-search text); `pipeline/ingest/identity.team_slug` for `team_id`; `pipeline/ingest/records.py` canonical serializer/atomic writes (`canonical_json`: `indent=2, ensure_ascii=False, sort_keys=True`, UTF-8, `newline=""`); `MissingAnchorError` from `pipeline/discover/errors.py`.

### Shots pages: what the anchors give you

Each team's `shots:{side}` anchor resolves to **two** 0-based pages, ascending: `[pitch-map page, event-table page]` (m001: home `[13, 14]`, away `[15, 16]`; corpus-verified — all 104 reports resolved all 47 anchors in Story 1.2's run). Assert `len == 2` with a typed `ShotsPageLayoutError` (a template revision could change this — fail loud, and the 1.4 gate will localize it). Pitch-frame detection failing on the map page is likewise a loud typed failure, never a skip.

### AD-6 normalization — the transposition trap (highest-risk detail in this story)

The spike computed `nx = 100·(cx−pitch.x0)/pitch.width` and `ny = 100·(cy−pitch.y0)/pitch.height` — that is (pitch-**width** fraction, pitch-**length** fraction): a **transposed** frame vs AD-6. The PMSR pitch map is rendered vertically with the attacking direction along the page's y axis (spike comment: "attack up"). AD-6 wants x along the attack direction and y across the pitch from the attacker's left. Expected mapping (derive and verify, don't trust this blindly):

- `x = 100 · (pitch.y1 − pdf_y) / pitch.height` — if the attacked goal is at the top of the page (smaller pdf y)
- `y = 100 · (pdf_x − pitch.x0) / pitch.width` — attacker facing "up" has the page-left touchline on their left

**Verify empirically before locking in:** (a) render an overlay like `spike/shots_overlay.png` and spot-check against the PDF (SM-3 fidelity gate); (b) the mex_rsa home map's 2 goal markers must land near the attacked goal — the spike confirmed the sample goals sit inside/at the edge of the box, so after correct normalization they must have x well above 50 (the box edge is ≈ x 83). A frame-orientation sanity assertion (e.g. both goal markers x > 66, all coordinates within [0, 100]) is a legitimate test — it checks orientation invariants, not lifted coordinate values, so it does not violate AR-16. **Never** assert exact x/y values. Confirm the away map uses the same orientation (each team's map is drawn from its own attacking perspective — check, don't assume). Round stored coordinates to 2 decimals (`PitchX`/`PitchY` fix `x-decimals: 2`; determinism per AD-8).

### Attempts-table count (the other half of Self-Validation)

The expected count comes from the tabular attempts table — the second anchored page per team. Count its attempt rows (numbered rows; the shot number column is what Story 1.5 will link against). Implementation guidance: parse via `get_text("words")` row clustering (the span-clustering technique in `pipeline/discover/probe.py::cover_lines` is the house pattern) or a digit-anchored line count over normalized page text — inspect the real table on `spike/mex_rsa.pdf` and document the chosen heuristic in the Dev Agent Record. Hard rules:

- `re.ASCII` on every digit class (fullwidth digits otherwise slip through `int()`).
- Unparseable table → typed `AttemptsTableError`, report fails loud. **Never** fall back to the marker count itself — that makes the check a tautology (a named reviewer theme).
- Cross-check for free: Story 1.1 verified all six fixture team-innings reconcile marker counts with the printed Key Statistics (`16 (4)`, `3 (2)`, …) — mex_rsa home must yield table count 16.
- Shootout reports: no per-attempt shootout table exists anywhere in the corpus (Story 1.1 verified), and shootout attempts must never appear among shot events. Emit `shootout_attempts: null` in the domain block. The count check itself is the guard: if a template variant ever drew shootout markers on the shots map, markers ≠ table rows and Self-Validation fails that report. During Task 7, eyeball one shootout report's result (e.g. m074 Germany–Paraguay) to confirm reconciliation.

### Record & manifest shapes (snake_case — `work/` staging, never contract camelCase)

`domains["shots"]` in the Extraction Record (field mapping to contract `ShotEvent` is Story 1.16's job; time/player/body-part/xG enrichment is Story 1.5's):

```jsonc
"shots": {
  "shot_events": [
    { "team_id": "mexico", "x": 87.31, "y": 44.12, "outcome": "goal", "own_goal": false,
      "source": { "page_index": 13, "pdf_x": 123.45, "pdf_y": 234.56 } }
  ],
  "shootout_attempts": null,
  "counts": {
    "home": { "markers": 16, "table": 16 },
    "away": { "markers": 3, "table": 3 }
  }
}
```

Keep `source` pdf-space values (2-decimal rounded) — Story 1.5's digit-glyph proximity linking operates in pdf space on the map page. Sort `shot_events` deterministically (e.g. by `team_id`, then `page_index`, then `pdf_y`, `pdf_x` — pick one order, document it; canonical serialization requires stable order, AD-8).

`self_validation` replaces the placeholder:

```jsonc
"self_validation": {
  "result": "pass",                       // "fail" if any check fails
  "checks": [
    { "check": "shots-marker-count", "team": "home", "result": "pass",
      "marker_count": 16, "table_count": 16 },
    { "check": "shots-marker-count", "team": "away", "result": "pass",
      "marker_count": 3, "table_count": 3 }
  ]
}
```

Both counts always present in the record's checks (recording them on pass costs nothing and aids the 1.4 deviation summary). Manifest entries gain `"self_validation": "pass" | "fail" | "not-applicable"` mirrored from the record, **plus**, on `fail`, a `self_validation_failures` list copying the failing check entries (with both counts) — the AC requires both counts to appear in the manifest itself on mismatch, not only in the record.

### Error taxonomy (one typed class per failure — reviewer-enforced)

New in `pipeline/markers/errors.py`, all subclassing `PipelineError`, all carrying `report_id`, message format `[{report_id}] …`:

| Exception | Raised when | Must carry |
| --- | --- | --- |
| `PitchFrameError` | no qualifying pitch rectangle on the map page | page index |
| `UnknownRgbError` | marker fill not in the exact-RGB palette | rounded RGB tuple + page index (the AC names both) |
| `AttemptsTableError` | attempts table unparseable / row count unrecoverable | page index |
| `ShotsPageLayoutError` | anchor page list ≠ 2 pages, or map/table pages not as expected | anchor id + page list |

Never a bare `ValueError`; never one class for two failure kinds. The batch already converts typed exceptions into `failed` manifest entries with `error_type` = class name.

### Verification-gate checks (Story 1.4 seam — AC 5)

Register two checks in the module-level registry (pattern: `Check(check_id, applies_to, run)` where `run(pdf: pymupdf.Document, meta: ReportMeta) -> list[Deviation]`):

- `shots-parse` — runs the parser; `UnknownRgbError` → `Deviation(..., category=UNKNOWN_RGB, specifics=rgb+page)`; other typed parse failures → their category (`missing-anchor` for anchor misses via existing semantics, else surface as the runner's isolated-check failure).
- `shots-count-match` — compares per-team counts; mismatch → `Deviation(..., category=COUNT_MISMATCH, specifics="home: parsed 15 markers, table lists 16")` style, one deviation per failing team.

Rules: no runner/sample/report-format changes; no new categories; never weaken a check to get green (`AnchorSpec.required` stays untouched — SM-C1). Use the `clean_registry` test fixture pattern when testing registration.

### Testing requirements

Command: `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests` (bare `python` lacks pymupdf). Baseline to preserve: **440 passed, 1 skipped**.

- **Ground truth (uses `mex_rsa_pdf`/`spike_corpus` fixtures — auto-skips when absent):** home map yields exactly 16 markers with distribution 2/2/8/3/1 (these literals ARE the spec's ground truth — the one place hardcoding is correct); full `extract_report` on the spike corpus produces `self_validation.result == "pass"` with both teams' counts matching; orientation sanity per the AD-6 section; no exact-coordinate assertions (AR-16).
- **Synthetic vector fixtures (always run):** build map pages with `pymupdf` shapes to cover every branch for real — the reviewer cross-checks claimed coverage: geometry-before-color (dark-blue `"re"` header rect + dark-blue circle outside pitch → zero false markers; dark-blue circle inside pitch at marker size → one `incomplete` marker), legend-row exclusion (4+ colors at one y dropped; 3-color row kept), overlap no-dedup (two same-point circles → two events), unknown-RGB abort (assert exception carries RGB + page), count-mismatch fail path (record written, `result: "fail"`, both counts present, batch exit 1, manifest entry surfaces it), multi-page anchor (`len != 2` → `ShotsPageLayoutError`), pass path end-to-end.
- **Derive, don't hardcode:** expected table counts in synthetic tests derive from what the factory drew, never a second literal.
- **Registry tests:** both checks registered once, duplicate-id rejected, deviations carry the right category.

### Previous-story intelligence (1.1, 1.2, 1.4 — review-enforced conventions)

- **The #1 flagged risk for this story** (named in 1.2's review): a blanket `try/except` around a loop relabels authoring bugs as data failures (one registry typo → 104 identical `failed` entries; 46 deviations collapsed to 1 in 1.4). Isolate per report / per marker; let `ValueError`/`KeyError` from registry resolution fail loud.
- House style: `from __future__ import annotations` first; `str | None`, `list[int]`; `@dataclass(frozen=True)`; absolute imports rooted at `pipeline.`; module docstring names the failure it defends against + Task/AC.
- Byte-identity asserted on `read_bytes()`, never parsed dicts; `--force` re-extraction must stay byte-identical.
- Host-independence: `iterdir()` + `suffix.lower()` (never `glob`), `newline=""` on writes, `re.ASCII` on `\d`.
- Assert domain membership/terminality, not tautologies (`len(a)==len(b)` style checks got patched out).
- `code_version` hashes all `pipeline/**/*.py` + `requirements.txt` — this story invalidates all 104 staged records; a cold full run (~2 min in 1.2, plus parsing cost) is expected, not a defect.
- Every claimed-tested branch must actually be tested — the Dev Agent Record is cross-checked against the suite.
- Vocabulary/variant harvesting needs the full corpus: `ShotOutcomeDetail` values first appear in M27/M49 — a 16-report sample provably misses variants, which is why Task 7 runs all 104 (any never-seen marker color surfaces as `UnknownRgbError` there, exactly as designed).

### Git intelligence

Latest commit `41f28e0` (Story 1.2) shows the established shape this story mirrors: one package per concern (`ingest/` ≈ 1,180 production lines) + one test module per source module (~1,640 test lines) + README section + story file + sprint-status update, single commit to `main`.

### Project Structure Notes

- New package `pipeline/markers/` matches the Structural Seed exactly ("parser family + shared core filter chain + digit-glyph marker→event linking" — linking arrives in 1.5, same package).
- No dedicated constants/config module exists; keep tuning constants in `pipeline/markers/` (they are marker-family concerns), palette + `MarkerSpec` exported for 1.11–1.13.
- `work/` stays gitignored/regenerable; nothing in this story touches `/contract`, `/data`, or `app/` (AD-1). No `schemaVersion` in work-staging records.
- Stack pinned in `pipeline/requirements.txt` (`pymupdf==1.28.0`, `pytest==8.4.2`; verified current 2026-07-21) — no additions, pip only, never `uv` (AR-15).

### References

- Story spec: `_bmad-output/planning-artifacts/epics.md` §Story 1.3 (lines 241–267); reuse contract for 1.11–1.13 at §Stories 1.11–1.13; 1.5 linking dependency at §Story 1.5
- Architecture: `_bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md` — AD-6 (frame), AD-8 (fail loud/determinism), AD-9 (staging + shared filter chain), Consistency Conventions (typed exceptions, pytest ground-truth row), Structural Seed (`pipeline/markers/`)
- Spike recipe (frozen ground truth): `spike/extract.py` (filter chain + RGB palette), `spike/census.py` (page discovery proof), `project-brief-wc2026-analytics.md` Appendix B (marker geometry: 11.25 pt Bézier circles; collision note) & Technical Considerations (filter-chain recipe, exact-RGB rule)
- Contract (target shapes for 1.16): `contract/match-bundle.schema.json` `$defs.ShotEvent` (515–563), `$defs.ShootoutAttempt` (571–594); `contract/common.schema.json` `PitchX`/`PitchY` (390–405), `ShotOutcome` (99–104), `ShotOutcomeDetail` + `x-maps-to-outcome` (105–157); `contract/README.md` §"Verified against the shot markers" (157–163)
- Integration seams: `pipeline/ingest/extract_report.py` (109–170), `pipeline/ingest/batch.py` (`_entry` 131, run result 309), `pipeline/discover/anchors.py` (shots spec :71, `resolve_anchors` :152), `pipeline/validate/checks.py` (:15 reservation, `register_check` :46), `pipeline/validate/deviations.py` (:8–:18), `pipeline/tests/conftest.py` (`mex_rsa_pdf` :23, `make_report` :60)
- Prior stories: `_bmad-output/implementation-artifacts/1-2-…md` (conventions + review patches), `1-4-…md` (gate + check registry), `1-1-…md` (schema findings: no per-shot xG, no own-goal markings, no shootout attempt table), `deferred-work.md` (multi-page shots fixture gap :27, zero-width chars in `normalize`)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code, 2026-07-23.

### Implementation Plan

- `pipeline/markers/` created per the Structural Seed: `errors.py` (typed taxonomy under a `MarkerError` base), `filter_chain.py` (four stage functions + frozen `MarkerSpec` separating recipe from tuning), `shots.py` (palette, `parse_shots`, `self_validation_block`, attempts-table counting).
- **Attempts-table heuristic (documented per Dev Notes):** rebuild the table page's `get_text("words")` into visual rows by y-clustering with a 3 pt tolerance (the `cover_lines` house pattern); require exactly one header row carrying the words `Time`/`Player`/`Outcome` (zero → `AttemptsTableError`, two+ → ambiguous, `AttemptsTableError`); count rows below the header whose leftmost word fullmatches `\d+` under `re.ASCII` (the Time column leads every attempt row; verified on the real table, where columns run Time | shirt | Player | Outcome | Body Part | Delivery Type). Zero rows is a valid count — the count-match check guards it. Never falls back to the marker count.
- **AD-6 normalization, verified empirically before locking in:** `x = 100·(pitch.y1 − pdf_y)/pitch.height`, `y = 100·(pdf_x − pitch.x0)/pitch.width`. On the ground-truth home map the two goal markers land at x ≈ 94.3 and 84.9 (box edge ≈ 83) and the away map's three attempts land at x ≈ 89/72/66 from its own attacking perspective — both maps attack "up" the page. Tests assert orientation invariants only (goals x > 66, all coordinates in [0,100]), never exact values (AR-16).
- Event sort order (documented): `team_id`, then `source.page_index`, then `pdf_y`, then `pdf_x`.
- Legend detection judges distinctness on rounded fill tuples rather than palette membership, so a legend containing an unknown color still reads as a legend instead of aborting the report before exclusion runs.

### Debug Log References

- **Task 7 discovery — the two-page assumption was wrong on the real corpus.** The first full batch run failed 37/104 reports with `ShotsPageLayoutError`: their shots anchor resolved to *three* pages. Inspection (M10 GER–CUW) showed the attempts table overflows onto a second table page when a team's attempts exceed ~17 rows (Germany's 26 attempts split 17 + 9; both table pages repeat the `Time Player Outcome…` header). The Dev Notes' "assert len == 2" was extrapolated from m001; the real layout is `[map page, table page(s)]`. Fix: `parse_shots` accepts ≥ 2 pages, treats `pages[0]` as the map and sums `_attempts_table_count` over `pages[1:]`. Verified before coding: M10 map markers = 26 = 17 + 9 summed rows. The Self-Validation count check itself stays exact and binary — nothing was loosened (SM-C1); a stray trailing anchored page without a table header fails loud as `AttemptsTableError`, a table-first ordering as `PitchFrameError`.
- **Fullwidth-digit test needed a CJK font.** Under the default font pymupdf renders `３５` as U+FFFD, which would have made the `re.ASCII` test vacuous; `fontname="japan"` puts real fullwidth digits into the text layer, where `\d+` matches without `re.ASCII` and is rejected with it.
- **Concurrent-tree effects (story 1-6 in flight in the same worktree, per the 1-2 precedent already recorded in deferred-work.md):** (a) `code_version` moved between corpus runs because story 1-6's `pipeline/extract/` files were landing concurrently — the re-extract instead of skip is the fingerprint working as designed, not an idempotence defect (the skip path is proven by `test_a_second_run_over_an_unchanged_corpus_skips_everything`); (b) `data/fixtures/index/leaderboards.json` acquired CRLF endings from concurrent git activity under `core.autocrlf=true` — restored to LF (content unchanged, `git diff` empty); (c) after story 1.3 reached its fully-green verification point (496 passed / 1 skipped), story 1-6 merged its Domain A extractor into `extract_report.py`/`checks.py`, and its committed venue table + lineup parser reject `make_report` synthetics (`UnknownVenueError: 'Test Stadium'`, `LineupParseError: … no STARTING header`) — that fixture work belongs to story 1-6 (its sprint note says it coordinates around in-flight 1-3) and red tests in `test_ingest_batch`/`test_ingest_record`/`test_extract_domain_a` under the current shared tree stem from it, not from this story; (d) `test_runner.py::test_checks_run_are_recorded` updated to the six currently-registered check ids (including 1-6's two) to keep the shared surface truthful.

### Completion Notes List

- **AC 1:** filter chain runs pitch-frame detect → circle-geometry → legend-row exclusion → exact-RGB keying, order fixed, geometry strictly before color; the dark-blue header rect, dark-blue circles outside the pitch, and wrong-size circles all produce zero false markers (synthetic vector tests); AD-6 frame with explicit `team_id`, full-pitch-rect normalization (the rect extends below the page clip and is used whole).
- **AC 2:** ground truth passes — 16 home markers, 2/2/8/3/1, via the `mex_rsa_pdf` fixture; end-to-end `extract_report` on the spike corpus yields `self_validation.result == "pass"` for both teams (16/16 and 3/3); skip-clean behavior preserved; no exact-coordinate assertions.
- **AC 3:** `UnknownRgbError` carries the rounded RGB tuple + 0-based page index and aborts the report (propagating as itself out of `extract_report` — the open-document block was restructured so the parser sits outside the page-reading `except`); overlapping markers are two events (tested at chain level and through the parser).
- **AC 4:** binary exact per-team comparison in `self_validation_block`; a mismatch writes the record with `result: "fail"` and both counts, mirrors into the manifest entry (`self_validation` + `self_validation_failures` with both counts, including for skipped-unchanged entries read from the staged record), fails the run (exit 1) without inflating `failed_count` (orphan precedent); `own_goal: false` on every real event; `shootout_attempts: null`; m074 (shootout, Germany–Paraguay) eyeballed: 21/21 and 7/7 reconcile, no shootout markers among shot events.
- **AC 5:** `shots-parse` (unknown-rgb) and `shots-count-match` (count-mismatch, both counts in specifics, one deviation per failing team) registered; runner/sample/report format untouched; no new deviation categories; both checks stay silent on a missing shots anchor (anchor-coverage owns it) and `shots-count-match` stays silent on a parse failure (one root cause, one finding).
- **Task 7 outcomes:** batch `--input-dir pmsr-corpus --expect-reports 104` → **104/104 extracted, 0 failed, 0 self-validation failures, 0 orphans, RUN RESULT: PASS** (after the multi-page-table fix; every one of the 104 reports reconciles marker count with its attempts table for both teams). Gate `verify --expect-reports 104` → **GATE RESULT: PASS, 0 deviations across the 16 sampled reports, 0 corpus gaps**, with the shots checks in `checks_run` — unknown-rgb and count-mismatch deviations are wired into the venue/matchday-localizable summary.
- **Tests:** at this story's verification point the full suite stood at **496 passed, 1 skipped** (baseline 440 + 1 preserved; net +56 from 59 new tests — 20 chain, 24 parser, 6 registry, 9 batch/record integration — minus the placeholder-seam tests the real-domain ones replaced; breakdown corrected during the 2026-07-23 review). Suite composition after story 1-6's concurrent merge is recorded under Debug Log.
- **Deferred-work ledger:** the "synthetic fixtures give every anchor exactly one page" entry marked RESOLVED with full-run evidence; no new deferrals from this story.

### File List

- `pipeline/markers/__init__.py` (new)
- `pipeline/markers/errors.py` (new)
- `pipeline/markers/filter_chain.py` (new)
- `pipeline/markers/shots.py` (new)
- `pipeline/ingest/extract_report.py` (modified — shots parser wired in; open-document block restructured so typed marker errors propagate as themselves)
- `pipeline/ingest/batch.py` (modified — `self_validation`/`self_validation_failures` manifest fields, run-result fold-in, summary section)
- `pipeline/validate/checks.py` (modified — `shots-parse` + `shots-count-match` registered)
- `pipeline/tests/conftest.py` (modified — `make_report` emits the real multi-page shots section with vector content; exported geometry constants)
- `pipeline/tests/test_markers_filter_chain.py` (new)
- `pipeline/tests/test_markers_shots.py` (new)
- `pipeline/tests/test_ingest_record.py` (modified — placeholder-seam tests replaced with real-domain tests; typed-error propagation test)
- `pipeline/tests/test_ingest_batch.py` (modified — Self-Validation manifest section)
- `pipeline/tests/test_checks_registry.py` (modified — shots-check tests; sample check id in the registration test renamed to avoid colliding with the now-real id)
- `pipeline/tests/test_runner.py` (modified — `checks_run` expectation updated to the current registry)
- `pipeline/README.md` (modified — `markers/` layout entry, shots domain + Self-Validation section, exit-code table, registered-checks list)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — multi-page fixture gap resolved with evidence)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status tracking)
- `_bmad-output/implementation-artifacts/1-3-shots-pitch-map-parser-with-marker-count-self-validation.md` (this file)
- `data/fixtures/index/leaderboards.json` (modified — CRLF→LF restoration only; content unchanged)

## Change Log

- 2026-07-23 — Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor): 1 decision resolved (off-shape staged Self-Validation → re-extract), 11 patches applied (stroked pitch-frame constraint restored, shape-aware failure summary, end-to-end ground-truth Self-Validation assertion, gate parse memo, 5 new tests, doc corrections), 3 items deferred to `deferred-work.md`, 6 findings dismissed on full-corpus evidence. Verification: suite 593 passed / 1 skipped; batch 104/104 RUN RESULT PASS; gate PASS, 0 deviations. Status → done.
- 2026-07-23 — Story 1.3 implemented: `pipeline/markers/` package (shared filter chain + shots parser), AD-6 normalization, marker-count Self-Validation wired through `extract_report`/`batch` manifest, `shots-parse`/`shots-count-match` gate checks, `make_report` multi-page shots fixtures. Task 7 full run 104/104 PASS with all Self-Validations passing; gate re-run PASS. Multi-page attempts-table layout discovered on the real corpus (37 reports) and handled by summing rows across table pages — count check unchanged. Status → review.

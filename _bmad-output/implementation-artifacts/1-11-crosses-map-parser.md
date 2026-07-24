---
baseline_commit: 0f39bd0cb8df90eb95ede70d500c9bde3552ad06
---

# Story 1.11: Crosses Map Parser

Status: done

## Story

As the builder,
I want the crosses pitch map parsed with the shared filter-chain recipe tuned for cross markers,
So that cross events carry true coordinates, types, and outcomes (FR-10).

## Acceptance Criteria

1. **Given** a crosses map page, **when** the parser runs, **then** it reuses the core filter-chain module with per-type shape/size tuning, legend-row exclusion, and exact-RGB outcome keying (assert-on-unknown, FR-11 semantics) **and** `CrossEvent` rows carry 0–100 AD-6 coordinates, `teamId`, and schema-enum types/outcomes. [Source: epics.md#Story-1.11]
2. **Given** the report's tabular cross totals, **when** Self-Validation runs, **then** the extracted cross-marker count is cross-checked against the tabular total and recorded binary pass/fail in the manifest. [Source: epics.md#Story-1.11]
3. **Given** the venue × matchday sample, **when** the FR-15 gate re-runs, **then** cross-map deviations appear in the summary. [Source: epics.md#Story-1.11]

## Tasks / Subtasks

- [x] Task 1: Probe the real crosses pages BEFORE writing parser code (AC: 1, 2)
  - [x] 1.1 On `spike/mex_rsa.pdf`, resolve the `crosses:home` / `crosses:away` anchors (`"Crosses (Open Play) {team}"`, `pipeline/discover/anchors.py:72` — already registered, resolves on all 104 reports per the 1.2 run) and record: how many pages each anchor spans (map only? map + table page(s) like shots?).
  - [x] 1.2 Characterize the cross MARKER drawing anatomy with a `page.get_drawings()` census (pattern: `spike/inspect_drawings.py`, but do NOT modify spike files): item types (`"c"` Bézier vs `"l"` line segments vs `"re"`), fill vs stroke, width/height ranges, distinct fill RGBs (rounded to 2 decimals) and their counts. The brief says cross markers differ in shape/size from shot circles — the current geometry stage only admits *filled all-Bézier* shapes, so this measurement decides Task 2's approach.
  - [x] 1.3 Characterize the legend row: swatch count (expected 2 if the legend is Complete/Incomplete — the shots default `legend_min_colors=4` would then NOT exclude it), whether it sits inside the pitch rect, its y-position, and label texts.
  - [x] 1.4 Characterize any tabular counterpart on the crosses page(s): header words and column set (Time / Player / Delivery Type / outcome column?), row count per team, and whether markers carry on-marker ordinal digit glyphs like shots.
  - [x] 1.5 Sanity-check by hand (not in code): marker counts vs the Key Statistics `Crosses` row (M01: home 13 / away 8 per the 1.7 story record) and vs the fixture `m001` crosses array. Record all probe findings verbatim in the Dev Agent Record before proceeding.
- [x] Task 2: `pipeline/markers/crosses.py` — parser on the shared filter chain (AC: 1)
  - [x] 2.1 Define `CROSSES_MARKER_SPEC = MarkerSpec(marker_min_pt=…, marker_max_pt=…, rgb_to_outcome=CROSSES_RGB_TO_OUTCOME, legend_min_colors=…)` from Task 1 measurements. The RGB→outcome map keys marker colors to the outcome dimension the page actually encodes (expected: `completed` True/False; see Dev Notes — contract has NO CrossOutcome enum).
  - [x] 2.2 `parse_crosses(doc, anchors, report_id, home_team, away_team)` composing the chain IN ORDER: `detect_pitch_frame` → `collect_candidate_markers` → `exclude_legend_rows` → `key_outcomes`. Geometry always before color. Never dedup overlapping markers.
  - [x] 2.3 IF Task 1 shows cross markers are NOT filled all-Bézier shapes (e.g. drawn from `"l"` line items): extend `filter_chain.py` ADDITIVELY — an optional shape-predicate/config knob on `MarkerSpec` or `collect_candidate_markers` whose default preserves current behavior exactly. Do NOT fork or duplicate the chain; do NOT reorder stages. Prove shots behavior unchanged: existing `test_markers_filter_chain.py` / `test_markers_shots.py` untouched and green, plus mex_rsa shots ground truth (16 markers, 2/2/8/3/1) still green.
  - [x] 2.4 AD-6 normalization — copy the shots formulas verbatim (`shots.py:114-115`): `x = round(100*(pitch.y1 - pdf_y)/pitch.height, 2)`, `y = round(100*(pdf_x - pitch.x0)/pitch.width, 2)`. Verify orientation invariants on real pages (crosses should originate in wide/advanced zones — most markers high-x or extreme-y); never lift spike-printed coordinates (transposed frame, AR-16).
  - [x] 2.5 Per-team loop over `(("home", home_team), ("away", away_team))`, `team_id = team_slug(team_name)` (crossing team per contract `$comment`); events sorted by `(team_id, page_index, pdf_y, pdf_x)`; each event carries `source: {page_index, pdf_x, pdf_y}`.
  - [x] 2.6 Typed errors: add `CrossesPageLayoutError` (and any crosses-specific analogues) to `pipeline/markers/errors.py` — never reuse `ShotsPageLayoutError`, never bare `ValueError`. `UnknownRgbError` (rgb + page, FR-11) comes free from `key_outcomes`.
- [x] Task 3: Tabular cross rows/total (AC: 2)
  - [x] 3.1 If the crosses anchor spans table page(s) (expected, since the contract's `CrossDeliveryType` provenance cites this page): count rows with the house pattern — y-cluster words at 3 pt tolerance, exactly one header row per table page (repeated header on overflow pages), count rows below header whose leftmost word `\d+`-fullmatches under `re.ASCII`. Treat `pages[1:]` as table pages and SUM across them (shots hit 37/104 two-page tables; assume crosses can overflow too). NEVER fall back to the marker count (tautology — a named 1.3 reviewer theme).
  - [x] 3.2 Parse delivery-type labels via a frozen literal label→enum map (`"Inswing"`/`"In Swing"` → `inswing`, etc., all 6 `CrossDeliveryType` codes), cross-checked against `contract/common.schema.json` by a test (the `attempts.py` precedent: `OUTCOME_LABEL_TO_DETAIL` / `DELIVERY_LABEL_TO_ENUM` — frozen literals, never schema imports). Unknown label → raise the EXISTING generic `UnknownLabelError` from `pipeline/markers/errors.py` (it already carries column/label/page/report — do not create a new class), never silent drop.
  - [x] 3.3 Return shape mirrors shots: `{"cross_events": [...], "counts": {side: {"markers": n, "table": m}}}` stored at `record["domains"]["crosses"]` (snake_case staging; camelCase only at 1.16 emission). Staged outcome field shape is PINNED: `MarkerSpec.rgb_to_outcome` values are internal keys (`"complete"`/`"incomplete"`, adjust to probe-confirmed legend labels) and each staged event carries **`completed: bool`** converted immediately after keying — contract-shaped at staging, so 1.16 emission stays mechanical. Do not stage a string outcome field alongside it.
  - [x] 3.4 Do NOT read `key_statistics` (Domain B, story 1.7's payload) anywhere in the parser — the Self-Validation counterpart is the crosses page's OWN table rows, self-contained (`shots-marker-count` precedent). A Domain-B-vs-crosses reconciliation, if ever wanted, is a cross-domain check in `extract_report.py` owned by the 1.7 pattern — out of scope here.
- [x] Task 4: Marker–row linking — conditional, decided by Task 1 (AC: 1)
  - [x] 4.1 IF markers carry ordinal digit glyphs AND the table prints one row per marker (the shots anatomy): reuse `pipeline/markers/linking.py` by parameterizing its shots-named knobs additively (marker radius per family; check id) WITHOUT changing shots outputs (`SHOTS_MARKER_RADIUS` stays; suite + batch prove byte-identical shots artifacts). Enrich cross events with `linked/ordinal/time_raw/shirt_number/player_name/delivery_type` and add a `crosses-link-rate` self-validation check mirroring `shots-link-rate` (binary, 100%). Unlinked markers retained + flagged, never dropped. Compatibility rule for the assignment constraint: table outcome column (if present) vs the marker's `completed` boolean — define it explicitly (the shots analogue is `DETAIL_COMPATIBLE_OUTCOMES`). Also decide and RECORD in the Dev Agent Record whether a gate-level link-rate check (the `marker-event-link-rate` analogue in `checks.py`) is registered or explicitly deferred.
  - [x] 4.2 IF NOT (no glyphs, or row↔marker correspondence ambiguous): skip linking entirely; stage parsed table rows verbatim under `domains["crosses"]["cross_table_rows"]` so later work has the raw material; events carry `delivery_type: None` (plus whatever RGB keying yields); file the emission-gap dev note (Dev Notes → AD-14 ledger): contract `CrossEvent` REQUIRES `playerId`/`playerName`/`at`/`deliveryType` per row — unfulfillable without a linking pass; flag for sprint planning before 1.16.
- [x] Task 5: Self-Validation wiring (AC: 2)
  - [x] 5.1 CONDITIONAL on Task 3 confirming a tabular counterpart (see Dev Notes → Self-Validation, last paragraph, for the no-table branch): `crosses_self_validation_block(counts)` emitting per-team checks `{"check": "crosses-marker-count", "team": side, "result": "pass"|"fail", "marker_count": n, "table_count": m}` — both counts ALWAYS present, exact/binary, no tolerance (SM-C1, AD-8). Keep the block well-shaped so `_self_validation_trustworthy` (batch skip-gate) recognizes it.
  - [x] 5.2 Wire into `pipeline/ingest/extract_report.py` at the two established seams ONLY: `parse_crosses(...)` call beside `parse_shots` (OUTSIDE the ProbeError handler, line ~168), `domains["crosses"]` entry, `self_validation["checks"].extend(...)` appended AFTER all existing appenders, then re-run `aggregate_self_validation`. Keep the diff strictly additive/append-only — story 1.7 is editing this same file in another session.
  - [x] 5.3 Manifest mirroring (`_mirror_self_validation`, fail-count, run result) is automatic — verify with a forced-mismatch test that the failing check lands in `entry["self_validation_failures"]` with both counts and the run fails without inflating `failed_count`.
  - [x] 5.4 Verify `format_summary` renders the new check via its generic count branch (`"marker_count" in check or "table_count" in check`); if Task 4.1 adds `crosses-link-rate`, add its own `format_summary` branch keyed on the EXACT check id (never key-sniffing — 1.5 review patch).
- [x] Task 6: FR-15 gate checks (AC: 3)
  - [x] 6.1 In `pipeline/validate/checks.py`: one-slot per-document crosses parse memo (copy the `_shots_parse_result`/`_parse_memo` pattern exactly — do not refactor the existing memos; both have OPEN deferred-work entries, copy-don't-extend). Resolve only `crosses:home`/`crosses:away` anchors.
  - [x] 6.2 `register_check` `crosses-parse` (catch `UnknownRgbError` → `unknown-rgb` deviation; other typed errors raise) and `crosses-count-match` (mismatch → `count-mismatch`, both counts in specifics, one deviation per failing team). Silent on missing anchor (anchor-coverage owns it); count-match silent on parse failure (one root cause, one finding). NO new deviation category — the 4-set is frozen.
  - [x] 6.3 Update the `checks.py` module docstring registry list (lines 9-21). Repoint the placeholder id in `test_checks_registry.py::test_a_later_story_can_register_a_check_into_the_registry` (~line 122) — it registers `crosses-count-match` as its "unclaimed" example and `register_check` raises on duplicates, so 1.11's import-time registration breaks that test; move it to a still-unclaimed id (e.g. `defensive-actions-count-match`).
  - [x] 6.4 Expect `test_runner.py`'s hardcoded sorted `checks_run` list to need the new ids (1.7 will also touch it — keep the edit minimal).
- [x] Task 7: Tests (all ACs)
  - [x] 7.1 Extend `conftest.py` `make_report` with an `emit_crosses_pages` helper mirroring `emit_shots_pages` (stroked pitch rect, markers per Task 1's real anatomy, legend row, optional table page(s), optional ordinal labels), plus crosses fixture constants. It MUST be default-on: once Task 5.2 wires `parse_crosses` into `extract_report`, every existing `make_report` consumer (test_ingest_record, test_ingest_batch, test_runner, Domain A tests…) hits the crosses anchor — an opt-in helper leaves them on auto-generated text-only pages and they all die in `PitchFrameError` (this is exactly why `emit_shots_pages` is default-on). Additive kwargs only — 1.7 also extends conftest.
  - [x] 7.2 `test_markers_crosses.py` (synthetic; derive expected values from what the factory drew — never a second literal): happy path both teams; geometry-before-color (a table-header rect in a marker palette color admits zero markers); legend exclusion at the crosses-tuned `legend_min_colors`; overlap no-dedup; `UnknownRgbError` abort carrying rgb + page; count-mismatch → SV fail with both counts; multi-page table sum; AD-6 range/orientation invariants; frozen delivery-label map vs `contract/common.schema.json`; fullwidth-digit rejection (needs `fontname="japan"`).
  - [x] 7.3 Ground truth: mex_rsa crosses counts/distribution asserted from Task 1 findings (counts + outcome distribution ONLY, never coordinates — AR-16); existing shots ground truth stays green.
  - [x] 7.4 `test_ingest_record.py`: add SEPARATE assertions filtered by `check["check"] == "crosses-marker-count"` — do NOT widen the existing `shots-marker-count` filter (both families carry `home`/`away` keys; a widened dict collides — 1.5 review note).
- [x] Task 8: Full verification + records (all ACs)
  - [x] 8.1 Suite green: `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`.
  - [x] 8.2 Full batch over all 104 PDFs: expect all-104 re-extract (code_version changed — correct, not a bug), 104/104 PASS, every `crosses-marker-count` check pass; then immediate re-run → 104/104 skipped-unchanged, byte-identical artifacts.
  - [x] 8.3 Re-run the FR-15 venue × matchday gate with the crosses checks registered; deviations (or 0) go into the summary; paste the gate result in the Dev Agent Record.
  - [x] 8.4 Update `pipeline/README.md` (parser family table), append any AD-14 findings to `deferred-work.md` (see Dev Notes list), record probe findings + discoveries in the Dev Agent Record, update sprint-status to review.

## Dev Notes

### Scope boundary — coordination with story 1.7 (in dev in another session)

- 1.11 lives in the **marker-parser family**: `pipeline/markers/` (new `crosses.py`, additive touches to `filter_chain.py`/`errors.py`/possibly `linking.py`) + the two extract seams + `validate/checks.py` + tests.
- **DO NOT touch** `pipeline/extract/` domain extractors: `domain_a.py`, `lines.py`, `venues.py`, `extract/errors.py`, and 1.7's new `domain_b.py`/`domain_c.py` + their tests. `extract/__init__.py` may be imported (`aggregate_self_validation`) but not modified.
- Shared-contention files (1.7 edits them too — keep every 1.11 edit additive/append-only, never reorder existing checks): `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py`, `test_runner.py`, `test_ingest_record.py`, `pipeline/README.md`, `deferred-work.md`.
- Also off-limits: `/contract` (see AD-14 notes below), `/data`, `app/`, `spike/` (read-only ground truth), `pipeline/validate/{runner,sample,deviations,verify}.py`.

### The filter chain — reuse contract (AD-9)

Shared module `pipeline/markers/filter_chain.py`; stage order is an INVARIANT (geometry strictly before color — the dark-blue table-header collision is the canonical reason):

1. `detect_pitch_frame(page, report_id) -> pymupdf.Rect` — largest **stroked** `"re"` drawing, `10000 < area < 0.8*page_area`. The stroked constraint is a 1.3 review patch — binding. The pitch rect extends below the visible clip; it is the normalization basis.
2. `collect_candidate_markers(drawings, pitch, spec)` — filled, all items `"c"`, width AND height in `[marker_min_pt, marker_max_pt]`, center inside pitch. Shots tuning: 8.0–15.0 pt (real shot circles are 11.25 pt filled Bézier with white stroke).
3. `legend_row_ys(candidates, spec)` / `exclude_legend_rows(candidates, spec)` — rounded-y buckets holding ≥ `legend_min_colors` distinct fills. Call the SHARED function in the production path (1.5 review patch restored it after an inlined copy went dead — don't re-inline).
4. `key_outcomes(markers, spec, report_id, page_index)` — exact lookup on RGB rounded to 2 decimals; miss raises `UnknownRgbError(rgb, page_index, report_id)`. Never nearest-color, never drop, never filter by color earlier.

Tuning seam: `MarkerSpec(marker_min_pt, marker_max_pt, rgb_to_outcome, legend_min_colors=4)` — frozen dataclass, exported for exactly this story. Supply crosses values; do not modify chain logic except the Task 2.3 additive shape knob if the probe demands it.

**Known robustness gaps flagged FOR this story** (deferred-work.md:41, "Filter-chain robustness envelope for reuse (Stories 1.11–1.13)"): (a) legend exclusion drops EVERY candidate in a legend y-bucket — a real marker sharing that rounded y vanishes and shows up as an unexplained count-mismatch; (b) legend grouping is exact rounded-bucket membership, no tolerance clustering; (c) the "circle" filter admits any filled all-Bézier shape in the size window — no circularity check. If mex_rsa or the corpus trips one of these on crosses pages, fix it in the shared chain (additively, shots-green) and note it; that's this story resolving its own pre-filed advisory.

### Contract reality vs the AC wording — read before coding outcomes

The AC says "exact-RGB **outcome** keying … schema-enum types/**outcomes**", but the signed-off contract (`match-bundle.schema.json:596-629`) defines:

- `CrossEvent` required: `teamId, playerId, playerName, at, x, y, deliveryType, completed`. `$comment`: "teamId is the CROSSING player's team."
- Outcome = **`completed: boolean`** — there is NO CrossOutcome enum, NO `x-maps-to-outcome` for crosses, and NO documented cross RGB legend anywhere in `/contract` or `/spike`.
- Type = `CrossDeliveryType` enum: `inswing, outswing, driven, lofted, cutback, push-cross` (provenance: label text on `Crosses (Open Play)` p17 + `Aerial Control` p35; "Inswing" and "In Swing" both normalize to the same code).
- Bundle location: `events.crosses`, `anyOf [CrossEvents, null]` (`null` = page absent — defensive only; the crosses anchor resolved on all 104 reports in the 1.2 run, and it's `required=True` in the registry).
- Fixture example row (`data/fixtures/matches/m001-mexico-south-africa.json:4-16`): `{at: {minute: 6, stoppageMinute: null}, completed: false, deliveryType: "driven", playerId: "mokoena-teboho-rsa", playerName: "Teboho MOKOENA", teamId: "south-africa", x: 66.15, y: 8.91}`.

So: RGB keying (FR-11 mechanics: exact lookup, assert-on-unknown) applies, but its target vocabulary is expected to be the two-state completed/incomplete legend, not a 5-color outcome family. The probe settles it. `Cross Zones` panel on the same page is deliberately NOT modeled (contract/README.md:175-179) — do not invent a zone enum; x/y only.

**Story 2.3 sign-off status:** crosses = PASS, zero pending change requests; CS-1 (shots CR-1/CR-2 + own-goal $comment) is shots-only and must not be conflated. Extraction 1.7–1.15 is UNBLOCKED; only 1.16 waits on CS-1. **Do not edit `/contract`.** Vocabulary gaps → dev notes for the AD-14 flow:

- **AD-14 note candidates (file in deferred-work.md if confirmed):** (1) how `completed` is keyed from the page (legend colors + labels — undocumented in-contract); (2) `CrossEvent` requires `playerId/playerName/at/deliveryType` per row, which needs a linking pass 1.11 may not deliver (Task 4.2 branch) — emission blocker to resolve before 1.16; (3) any legend label / delivery label / color observed in the corpus that the closed enums can't carry (the 1.5 precedent: bare `Incomplete`/`On Target` discoveries became CR-1).

### Self-Validation + manifest plumbing (AD-8, FR-14)

- Record shape: `record["self_validation"] = {"result", "checks": [...]}`; appender seam in `extract_report.py:181-189`; `aggregate_self_validation` from `pipeline/extract/__init__.py` recomputes the block result.
- Mismatch is NOT an exception: record still written with `result: "fail"` + both counts; batch surfaces run-level fail (exit 1) without inflating `failed_count` (orphan-records precedent).
- Check id conventions: record SV check = `crosses-marker-count` (mirrors `shots-marker-count`); gate checks = `crosses-parse` / `crosses-count-match` (mirror `shots-parse` / `shots-count-match`).
- Deviation categories are FROZEN at 4 (`missing-anchor`, `unknown-rgb`, `count-mismatch`, `probe-failure`) — crosses maps onto `unknown-rgb` + `count-mismatch`.
- The tabular counterpart for the count check is the crosses page's OWN table rows (`counts[side]["table"]`), NOT Key Statistics `crosses` (that scalar is Domain B / story 1.7 territory; 1.7's own `key-statistics-shots-reconciliation` precedent pins cross-domain reconciliation in `extract_report.py`, never inside a parser). If the probe finds NO table on the crosses pages, the AC's "tabular cross totals" has no in-family source — record the check as impossible-as-specified, file the dev note, and surface for decision rather than silently substituting Domain B (its extractor may not have landed yet in this worktree).

### Previous-story intelligence (1.3 + 1.5, distilled)

- **Multi-page tables:** shots assumed `[map, table]`, corpus delivered 3 pages on 37/104 reports (team >17 rows overflows; header repeats). Accept `pages[1:]` as table pages, sum rows, typed layout error on impossible shapes.
- **AD-6 transposition trap:** the spike's printed nx/ny are transposed vs AD-6. The resolved mapping is the shots formula pair (Task 2.4). Tests assert orientation INVARIANTS only, never lifted coordinates.
- **`re.ASCII` on every digit class** (fullwidth digits otherwise pass `int()`); the fullwidth test needs `fontname="japan"`.
- **No dedup ever** — two markers at one point = two events.
- **Unknown-RGB reporting is one-per-report and side-blind** (OPEN deferred item) — crosses inherits this behavior; don't try to fix it here unless trivial and shots-green.
- **Memo pattern:** the gate checks' one-slot `_parse_memo` keeps a strong ref to the last open Document and replays cached exceptions (two OPEN deferred entries). Copy the pattern verbatim for crosses; do not refactor.
- **`_word_readings` is capped at 8 digits**; linking's bijective assignment enforces ordinal ∈ 1..N with outcome-compatibility — if Task 4.1 activates, the crosses compatibility rule is completed-vs-table-outcome (define it explicitly; the shots analogue is `DETAIL_COMPATIBLE_OUTCOMES`).
- **Commit hygiene:** commit only 1.11's files; 19816fc's mixed-scope commit drew a review patch (commit-scope disclosure). Commit directly to main (solo repo).

### Project Structure Notes

- New: `pipeline/markers/crosses.py`, `pipeline/tests/test_markers_crosses.py`.
- Modified (additive): `pipeline/markers/errors.py`, possibly `pipeline/markers/filter_chain.py` (+ `linking.py` only under Task 4.1), `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py`, `test_checks_registry.py`, `test_runner.py`, `test_ingest_record.py`, `pipeline/README.md`, `deferred-work.md`.
- Records: `work/extracted/{match_id}.json`, snake_case staging, canonical JSON (sorted keys, LF, atomic replace). Adding `domains["crosses"]` needs no `RECORD_VERSION` bump (additive), but `code_version` change forces full re-extraction — expected.
- Python: `pipeline\venv\Scripts\python.exe` (no uv). Tests: plain pytest functions, synthetic-first, ground truth auto-skips locally when `spike/mex_rsa.pdf` absent / fails under CI.

### References

- Story spec: `_bmad-output/planning-artifacts/epics.md:420-439`
- Filter chain: `pipeline/markers/filter_chain.py` (MarkerSpec:43, detect_pitch_frame:80, collect_candidate_markers:112, legend_row_ys:150, exclude_legend_rows:167, key_outcomes:184)
- Shots template: `pipeline/markers/shots.py` (spec:50, parse:61, AD-6:114-115, SV block:158); table pattern: `pipeline/markers/attempts.py` (parse_attempt_rows:220, _attempt_lines:306)
- Errors: `pipeline/markers/errors.py`; extract seams: `pipeline/ingest/extract_report.py:168,181-189,204`; manifest: `pipeline/ingest/batch.py` (_mirror_self_validation:176, format_summary:392, SV-failure branch:429)
- Anchor: `pipeline/discover/anchors.py:72`; gate: `pipeline/validate/checks.py` (memo:146, registration:270); categories: `pipeline/validate/deviations.py:18`
- Contract: `contract/match-bundle.schema.json:596-629,781-821`; `contract/common.schema.json:181-186` (CrossDeliveryType), `390-405` (PitchX/Y); sign-off: `contract/README.md:446-514`; Cross Zones decision: `contract/README.md:175-179`; enum provenance: `contract/README.md:126`
- Architecture: ARCHITECTURE-SPINE.md AD-6 (acting team = crossing team; frame orientation), AD-8 (binary SV, fail loud), AD-9 (one chain, geometry before color), AR-16 (mex_rsa counts-only ground truth)
- Advisory: `deferred-work.md:41` (filter-chain robustness envelope, names this story)
- Prior stories: `1-3-shots-pitch-map-parser-...md`, `1-5-marker-event-linking-...md`; 1.7 scope/no-touch: `1-7-domains-b-c-...md`

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Task 1 Probe Findings (spike/mex_rsa.pdf + full-corpus census over all 104 reports / 208 crosses pages)

**1.1 Anchor span:** `crosses:home` = [17], `crosses:away` = [18] on mex_rsa; corpus census: **all 208 anchors span exactly ONE page** (no separate table page — unlike shots). The single page carries three columns: pitch map (x 18–277), Delivery Type bar chart + Attempted/Completed stat tiles + Most Crosses Attempted (x ~300–560), per-player delivery table (x ~585–940). Pitch frame is byte-identical on all 208 pages: `Rect(18.0, 108.75, 276.75, 478.9)` (same rect as shots pages).

**1.2 Marker anatomy:** cross markers ARE filled all-Bézier circles (16 `"c"` items), **7.39–7.40 pt** wide/high, white stroke, exactly two fill RGBs corpus-wide: **orange (0.96, 0.74, 0.0)** (2078 in-pitch) and **blue (0.18, 0.3, 1.0)** (538). No other filled all-`"c"` circle sizes inside the pitch except white pitch-furniture dots (1.85/3.7 pt) and the two 9.0 pt legend swatches. Each cross also draws a trajectory (`"qu"` curve + all-`"l"` arrowhead quad in the marker color) — rejected by the all-`"c"` rule; no chain shape-knob needed (Task 2.3 branch NOT taken). Two corpus quirks found and dispositioned:
- **Edge crosses (9 pages, 1 marker each):** a real marker's center sits ≤0.35 pt OUTSIDE the pitch rect (touchline/goal-line deliveries, e.g. center y 108.4 vs pitch.y0 108.75). Fix: additive `MarkerSpec.pitch_margin_pt` knob (default 0.0 → shots byte-identical), crosses uses 1.0 pt; normalized coords clamped to [0, 100] (max pre-clamp overshoot 100.1).
- **Two-tone double-draws (16 pages, 17 events):** one event drawn as an orange AND a blue marker at the BIT-IDENTICAL rect (dx=dy=0.000000, blue always later in draw order = on top). Real same-spot pairs always differ by ≥0.035 pt or share a color (M50/M82/M45/M08 verified). Collapse rule: exact-rect orange+blue pair → ONE `completed: true` event (decoding a two-tone glyph, NOT marker dedup — the no-dedup invariant is about distinct overlapping markers, which are preserved). With margin + collapse: **markers == table sum == panel Attempted on 208/208 pages; blue count == panel Completed on 208/208**.

**1.3 Legend:** exactly **2 swatches** (orange, blue), **9.0 pt**, strokeless (marker circles are stroked), centers (49.5, 284.2) and (165.8, 284.2) — **INSIDE the pitch rect** (the visible map occupies only the top of the frame; the Cross Locations legend and Cross Zones panel are drawn over the frame's clipped lower region), stable at y=284.2 on all 208 pages. Labels: "Attempted" / "Completed" (208/208). Excluded **geometrically** by the size window (9.0 > marker_max 8.5) — `legend_min_colors` stays at the default 4 (a 2-color legend row can never trigger row exclusion, and lowering it to 2 would nuke real orange+blue pairs sharing a rounded y, e.g. M50 dy=0.035); `exclude_legend_rows` is still called in the production path per the recipe.

**1.4 Tabular counterpart:** per-player AGGREGATE table (NOT per-event rows like shots): columns `# | Player | Inswing | Outswing | Driven | Lofted | Cutback | Push Cross | Total Attempted` (last two headers stacked over two lines: Push/Cross, Total/Attempted; header word multiset uniform on 208/208). One row per fielded player (15–16 rows), each row = shirt + name + 6 delivery counts + Total; **row Total == sum of the 6 delivery counts on every row corpus-wide**; **sum of Total column == panel Attempted on 208/208** → the Self-Validation table count is the SUM of the Total Attempted column. Two-line player names straddle the numeric row line at ±4.5 pt (name x-band ~600–730). Left-panel bar-chart values and Cross Zones digits share y-lines with table rows → row clustering must be x-restricted to the table region. **NO on-marker ordinal digit glyphs** (the only in-pitch words are the legend labels and Cross Zones counts) and no per-event rows → marker–row linking is impossible: **Task 4.2 branch (no linking)**; delivery type is per-player aggregate only, so events carry `delivery_type: None` and the parsed rows are staged under `cross_table_rows`.

**1.5 Hand sanity-check:** mex_rsa home: 10 markers (8 orange + 2 blue) == panel Attempted 10 / Completed 2 == table Total sum 10 (MONTES 1, REYES 2, QUINONES 1, GALLARDO 2, ALVARADO 2, VEGA 1, CHAVEZ 1). Away: 7 markers (7 orange + 0 blue) == panel 7/0 == table sum 7 (MOKOENA 1, MODIBA 2, MBOKAZI 2, RAYNERS 1, MUDAU 1). Key Statistics `Crosses` (home 13 / away 8) does NOT equal the open-play map counts (10/7) — this page is "Crosses (Open Play)" only; confirms Task 3.4 (never reconcile against Domain B here). Fixture `m001` crosses array is handcrafted sample data (MOKOENA row prints Outswing 1, fixture says driven) — not ground truth. Outcome semantics: **orange = attempted-not-completed, blue = completed** (`completed: bool`; internal RGB keys `"attempted"`/`"completed"` from the legend words). AD-6 orientation verified corpus-wide: all 2608 events land x 60.66–100 (advanced), 85.7% wide (y≤25 or y≥75), 100% advanced-or-wide.

### Debug Log References

- Probe scripts (scratchpad, not committed): anchor/drawing census on mex_rsa; full-corpus census (208 pages); coincident-pair anatomy probe; full parser dry-run (0 failures / 208 pages) — findings recorded verbatim above.
- RED confirmed before implementation: `test_markers_crosses.py` collection error (module absent), then 18 failures against the factory before `crosses.py`/`filter_chain.py` changes landed.
- Synthetic-page lesson: the real table's column x-positions assume a ~7 pt font; at fontsize 10 adjacent header words glue into one extracted word and glyph bbox tops drift > 3 pt — the crosses factory prints all table text at fontsize 7.

### Completion Notes List

- **Task 2** — `CROSSES_MARKER_SPEC = MarkerSpec(6.0, 8.5, CROSSES_RGB_TO_OUTCOME, legend_min_colors=4 (default), pitch_margin_pt=1.0)`. Chain composed in the mandatory order; `exclude_legend_rows` stays in the production path (no-op by construction: a 2-color palette can never reach 4 distinct fills at one y — the size window is the legend defense, see probe 1.3). **Task 2.3's shape-knob branch was NOT needed** (cross markers ARE filled all-Bézier circles); the additive chain change is instead `MarkerSpec.pitch_margin_pt` (default 0.0 → shots byte-identical, proven by untouched `test_markers_filter_chain.py`/`test_markers_shots.py` green + mex_rsa shots ground truth green + full batch), admitting the 9 corpus touchline crosses whose centers sit ≤0.35 pt outside the frame; their AD-6 coordinates clamp into [0,100] (max pre-clamp 100.1). **Two-tone collapse** (`_collapse_two_tone`, crosses.py): an attempted+completed pair at a BIT-IDENTICAL rect is one completed event (17 events / 16 pages corpus-wide; blue drawn on top; discriminator is exact float equality — real same-spot pairs differ ≥0.035 pt or share a color and are NEVER deduped, preserving the no-dedup invariant for distinct markers). Both quirks ledgered in deferred-work.md.
- **Task 3** — probe overturned the expected anatomy: the crosses section is ONE page per team (208/208; `CrossesPageLayoutError` on any other span — the "sum across table pages" instruction is unreachable by construction) and the table is a per-player delivery-AGGREGATE (# / Player / 6 delivery columns / Total Attempted), not per-event rows. The Self-Validation table count is therefore the SUM of the Total Attempted column (== printed Attempted panel on 208/208 pages; each row's Total == its delivery sum, enforced by `CrossesTableError`). Row admission is the house pattern (shared `table_lines`, 3 pt clusters, leading `\d+` fullmatch under `re.ASCII`) restricted to the table x-region derived from the header's own '#' position — the left panels print digits on the same y-lines as table rows. Header vocabulary/order validated against the frozen `CROSS_DELIVERY_LABEL_TO_ENUM` map before any row is read (unknown word → existing `UnknownLabelError`); the map carries the contract's "In Swing"/"Out Swing" variants and a test cross-checks its values against `contract/common.schema.json`. Staged `deliveries` keys are snake_case (`push_cross`) per the record snake-case rule; the kebab enum codes surface at 1.16 emission via the frozen map. Events carry `completed: bool` only — no string outcome staged. `key_statistics` is not read anywhere (M01 sanity check confirmed why: Domain B's 13/8 counts set-play crosses; this page's open-play counts are 10/7).
- **Task 4** — **4.2 branch taken** (probe: no ordinal glyphs on the 7.4 pt markers, no per-event rows — row↔marker correspondence is structurally absent). No linking pass; events carry `delivery_type: None`; the parsed aggregate rows are staged verbatim under `domains["crosses"]["cross_table_rows"]` per side. The emission-gap AD-14 note is filed in deferred-work.md ("Filed by Story 1.11"): contract `CrossEvent` requires `playerId/playerName/at/deliveryType` per row — unfulfillable from this page; flagged for sprint planning before 1.16. **Task 4.1 decision record:** no `crosses-link-rate` self-validation check and no gate-level link-rate analogue are registered — explicitly N/A rather than deferred, because no linking pass exists to measure; if a future template ever prints per-event cross rows, the check family arrives with that linking story.
- **Task 5** — `crosses_self_validation_block(counts)` emits the two per-team `crosses-marker-count` checks (both counts always present, exact/binary); appended in `extract_report.py` AFTER all existing appenders, then `aggregate_self_validation` re-runs. Wiring is strictly additive at the two seams (parse call beside `parse_shots`, `domains["crosses"]` entry, one `extend` line). Manifest mirroring verified by `test_a_crosses_mismatch_fails_the_run_with_both_counts_in_the_manifest`: the failing check lands in `entry["self_validation_failures"]` with both counts, run fails (exit 1) without inflating `failed_count`, and `format_summary`'s existing generic count branch renders it (no new branch needed; no link-rate check exists — 5.4's conditional not triggered).
- **Task 6** — `_crosses_memo`/`_crosses_parse_result`/`_crosses_parse_uncached` copy the `_parse_memo` pattern verbatim (appended at the end of checks.py; the pattern's two OPEN deferred entries inherited knowingly). `crosses-parse` (UnknownRgbError → `unknown-rgb`; other typed errors raise for the runner to isolate) and `crosses-count-match` (per-team `count-mismatch` with both counts; silent on missing anchor and on parse failure — one root cause, one finding). No new deviation category. Module docstring registry list updated; `test_checks_registry.py`'s placeholder repointed to `defensive-actions-count-match`; `test_runner.py`'s sorted `checks_run` list gained the two ids.
- **Task 7** — `emit_crosses_pages` in conftest is DEFAULT-ON for every `make_report` consumer (single real-anatomy page: stroked pitch, 7.4 pt stroked markers, 9.0 pt strokeless 2-swatch legend INSIDE the pitch, stacked-header aggregate table at the real x-positions, fontsize 7), with additive kwargs only (`crosses_markers/rows/two_tone/pages/legend/draw_pitch/header_replace/decorate`). 28 tests in `test_markers_crosses.py` (all expected values derived from factory constants): happy path, SV block shape, geometry-before-color (palette rect + palette arrowhead inert), 9 pt legend exclusion, 4-color marker-sized legend row excluded pre-keying, orange+blue same-y pair survives (legend_min_colors must NOT be 2), overlap no-dedup, two-tone collapse, UnknownRgbError with rgb+page, count-mismatch with both counts, multi-ROW table sum (the "multi-page table sum" item is N/A by probe — replaced by the multi-page → `CrossesPageLayoutError` test), two-line names, fullwidth-digit rejection (`fontname="japan"`), non-numeric tail / total≠sum / missing name / unknown header label / missing header word / missing header line errors, zero-cross page, missing anchor, AD-6 orientation + range, margin admit + clamp, beyond-margin exclusion, margin default 0.0 (shots spec unchanged), frozen map vs contract enum, mex_rsa ground truth (counts + distribution only, AR-16). `test_ingest_record.py` gained two crosses tests filtered by their own check id (never a widened shots filter).
- **Task 8** — Suite: **764 passed, 1 skipped, 0 failed** (all pre-existing tests untouched and green). Batch: **104/104 extracted, RUN RESULT: PASS**, all 208 `crosses-marker-count` checks pass, 2,608 cross events staged; immediate re-run **104/104 skipped-unchanged** with byte-identical records (aggregate SHA-256 over all 104 records identical before/after). Gate: see below. README parser-family docs updated; 3 AD-14 ledger entries filed + the 1.3 filter-chain advisory annotated with the crosses verification.
- **Commit-scope disclosure** (19816fc precedent): story 1.7 (Domains B & C) is in-flight in this same working tree and its uncommitted implementation is interleaved with 1.11's edits in the shared files (`extract_report.py`, `checks.py`, `conftest.py`, `test_runner.py`, `pipeline/README.md`) and is an import-dependency of them (`domain_b.py`/`domain_c.py` are untracked at 1.11 completion). A 1.11-only commit would leave main with unresolvable imports, so the 1.11 commit carries 1.7's in-flight working-tree state (and the 2.4 ready-for-dev context file another session created), disclosed in the commit message. The green evidence above (suite/batch/gate) covers the combined tree.

### FR-15 gate result (Task 8.3, run 2026-07-23)

```
checks run      : anchor-coverage, crosses-count-match, crosses-parse, domain-a-completeness,
                  domain-a-counts, domain-b-completeness, domain-b-counts, domain-c-completeness,
                  domain-c-counts, marker-event-link-rate, metadata-probe, shots-count-match, shots-parse
sample size     : 16
Deviations by category
  missing-anchor   0
  unknown-rgb      0
  count-mismatch   0
  probe-failure    0
GATE RESULT: PASS (0 deviation(s) across 16 sampled report(s), 0 corpus gap(s))
```

The sample includes PMSR-M05/M08/M12 — reports carrying the two-tone double-draw and edge-marker anatomies — all clean.

### File List

New:
- pipeline/markers/crosses.py
- pipeline/tests/test_markers_crosses.py
- _bmad-output/implementation-artifacts/1-11-crosses-map-parser.md

Modified:
- pipeline/markers/filter_chain.py (additive: `MarkerSpec.pitch_margin_pt`, default 0.0)
- pipeline/markers/errors.py (additive: `CrossesPageLayoutError`, `CrossesTableError`, `CrossesCoordinateError` [code review])
- pipeline/ingest/extract_report.py (shared with in-flight 1.7; 1.11 edits additive: import, parse call, `domains["crosses"]`, checks extend, docstring)
- pipeline/validate/checks.py (shared with in-flight 1.7; 1.11 edits appended: memo + 2 checks + docstring registry lines)
- pipeline/tests/conftest.py (shared; additive: crosses constants, `default_cross_rows`, `emit_crosses_pages` default-on, additive kwargs)
- pipeline/tests/test_runner.py (shared; `checks_run` list gained 2 ids)
- pipeline/tests/test_checks_registry.py (placeholder id repointed; crosses gate-check tests appended)
- pipeline/tests/test_ingest_record.py (2 crosses tests added; import widened)
- pipeline/tests/test_ingest_batch.py (1 crosses manifest-mirroring test added)
- pipeline/README.md (shared; gate-check list, layout line, "The crosses domain (Story 1.11)" section)
- _bmad-output/implementation-artifacts/deferred-work.md (3 entries filed; 1.3 advisory annotated)
- _bmad-output/implementation-artifacts/sprint-status.yaml (1-11 status + log line)

### Review Findings (Code Review 2026-07-24)

Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor: 0 AC/constraint violations — all 3 ACs and every Dev Notes constraint verified met. 1 decision-needed (resolved → patch applied), 0 defer, 13 dismissed (fail-loud, unreachable in the 208/208 corpus, or already ledgered).

- [x] [Review][Decision→Patch] Unconditional coordinate clamp could silently fabricate out-of-range coordinates (AD-8 tension) [pipeline/markers/crosses.py:171-172] — Both axes were clamped `min(100, max(0, …))` for every event. The spec sanctioned clamping the ≤0.1-normalized touchline overshoot (probe max 100.1), but the clamp was unconditional and unbounded: a marker normalizing to e.g. 103 or −5 (wrong/undersized pitch rect, orientation flip, or a panel glyph through the 1.0 pt margin) would be silently rewritten to a valid-looking boundary. The marker/table **count** check does not catch a mis-normalized *real* marker, so nothing failed — at odds with the module's fail-loud discipline. Flagged independently by Blind Hunter (B2, B12) + Edge Case Hunter (E7). **Resolution (option 2, 2026-07-24):** added `COORD_CLAMP_TOLERANCE=0.5` + a `_clamp_coord` helper that clamps only the sub-tolerance overshoot and raises the new typed `CrossesCoordinateError(axis, value, report_id, page_index)` beyond it. A 1.0 pt-margin marker on a correct frame overshoots by at most ~0.4 normalized, so the touchline case still clamps cleanly (existing `100.1`-pre-clamp test green) while a genuine mis-normalization now fails loud and is localized by the runner against `crosses-parse`. New unit test `test_clamp_coord_absorbs_touchline_overshoot_but_raises_beyond_tolerance`. Files: `crosses.py`, `markers/errors.py`, `ingest/extract_report.py` (docstring), `test_markers_crosses.py`. Verified: 170 passed (crosses + ingest_record/batch + checks_registry + runner).

Dismissed (verified non-issues, for the record): AD-6 transposition has no runtime detector (mitigated — probe verified orientation corpus-wide + orientation-invariant test); `pitch_margin_pt=1.0` vs 0.35 pt observed (1 pt reaches x≈277.75, nowhere near the x≥300 stat panels — safe headroom); thin 0.5 pt legend size gap, exact-float two-tone collapse, `_HEADER_BAND_PT`/x-band/name-tolerance constants (all corpus-tuned but fail loud via `CrossesTableError` or the count check — name gather has a 16 pt safety margin vs 22 pt row spacing); fullwidth-shirt row skip and zero-count blank cell (corpus prints explicit `0`; caught by count check when real markers exist — both tested); `counts["home"]`/`["away"]` KeyError and out-of-range `doc[page_index]` IndexError (unreachable — `parse_crosses` always populates both sides, anchor indices always in-range); `delivery_type: None` emission-shape untested (the 1.16 emission gap, already ledgered as AD-14).

## Change Log

- 2026-07-23: Story 1.11 implemented — crosses map parser on the shared filter chain (size window 6.0–8.5 pt, 2-color palette → `completed: bool`, additive `pitch_margin_pt` knob, two-tone collapse), per-player delivery table staged + summed for Self-Validation (`crosses-marker-count`), `crosses-parse`/`crosses-count-match` gate checks. Suite 764+1 green; batch 104/104 PASS (208/208 crosses checks pass, re-run byte-identical); gate PASS 0 deviations. 3 AD-14 notes filed (emission gap blocks 1.16's `events.crosses`; RGB legend provenance; two-tone anatomy). Status → review.

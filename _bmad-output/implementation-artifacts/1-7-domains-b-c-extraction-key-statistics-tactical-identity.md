---
baseline_commit: 22762560f7473985003c56891925eea7d0be84b4
---

# Story 1.7: Domains B & C Extraction — Key Statistics & Tactical Identity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the builder,
I want the full Key Statistics block and tactical-identity measures extracted per team per match,
so that head-to-head stats, story stats, and team tactical identity are available to every downstream surface (FR-4, FR-5).

## Acceptance Criteria

1. **Given** a report's Key Statistics pages
   **When** Domain B extraction runs
   **Then** both teams carry the complete block per the addendum §6 inventory (possession, xG, shots/on-target, passes & completion %, line breaks, receptions in final third, crosses, ball progressions, defensive pressures, forced turnovers, second balls, distance covered), all numeric-typed
   **And** any value that fails to parse as its expected type fails that report loud.

2. **Given** the tactical-identity pages
   **When** Domain C extraction runs
   **Then** both teams carry Phases of Play percentages, Line Height / Team Length in meters (in and out of possession), and Defensive Block distribution
   **And** the self-consistency check records pass/fail: possession three-way split sums to ~100%, meter values numeric and within pitch bounds. *(Corrected from the epic's "block percentages per team sum to ~100%" — that premise is contradicted by corpus-verified evidence; see Dev Notes §Spec correction. The block values are independent per-phase rates that do NOT sum to 100: reference report Mexico high 7 + mid 25 + low 11 = 43. The check that IS corpus-true — the Key Statistics possession row home + contested + away ≈ 100 — replaces it, alongside the AC's metre-numeric requirement. Verify both corpus-wide during implementation and record the evidence.)*

3. **Given** the venue × matchday sample
   **When** the FR-15 gate re-runs
   **Then** B/C anchors, types, and consistency checks appear in the deviation summary.

[Source: epics.md, Story 1.7, lines 336–356; FR-4 prd.md:124-128, FR-5 prd.md:130-134. Addendum §6 B/C inventory is normative. AC 2's sum-check correction is evidence-driven per SM-C1's own logic — a check must be binary AND true; sources: contract/match-bundle.schema.json `DefensiveBlockDistribution` description ("Independent rates, not a partition — they do not sum to 100"), `InPossessionPhases` description (corpus-verified: PMSR-M74 Germany's eight in-possession values sum to 124), and this story's page probe of spike/mex_rsa.pdf (blocks sum 43/49 per side).]

## Tasks / Subtasks

- [x] Task 1: Typed errors for B/C (AC: 1, 2)
  - [x] 1.1 UPDATE `pipeline/extract/errors.py` (append-only): add one typed class per new failure kind, subclassing `ExtractError`, each carrying `report_id` — suggested minimum: `StatisticsParseError` (Key Statistics page layout/row resists the grammar), `PhasesParseError` (Phases page), `LineHeightParseError` (line-height pages incl. panel/value-count deviations), `UnknownStatisticError` (a row label outside the closed row-label set of Task 2.3). REUSE existing classes where they fit: `MalformedFieldError` (present-but-wrong-type value — this is AC 1's "fails to parse as its expected type"; message MUST name the field and the raw text), `MissingFieldError` (row/field absent, names the field). One class per failure kind — never overload, never raise bare `ValueError` (1.6 review rule).

- [x] Task 2: Domain B parser — Key Statistics page (AC: 1)
  - [x] 2.1 NEW `pipeline/extract/domain_b.py` — entry point `extract_domain_b(doc, anchors, report_id, home_team, away_team) -> dict` (pure per AD-9: no filesystem writes, no timestamps, no absolute paths, no cross-report knowledge). Read the page via `anchors["key-statistics"]` (anchor text `"Match Summary - Key Statistics"`, page index 2 on mex_rsa) — never by page index. **Side verification:** unlike the phases/line-height anchors, this anchor text embeds no team names, so left=home is otherwise an assumption — the page prints both team names (home x=60, away x=722 on mex_rsa); assert the left/right printed names match the probed home/away or raise `StatisticsParseError` (forecloses a silent home/away stat swap under a template revision — AD-8's exact failure mode). Assert the anchor resolves to EXACTLY one page; more → `StatisticsParseError` (37/104 reports overflow the shots attempts table onto a second page, so multi-page sections are a real corpus behavior — if the gate/batch reveals Key Statistics also overflows somewhere, model it then, loud first).
  - [x] 2.2 Reconstruct visual rows with the existing `pipeline/extract/lines.py` helpers (`text_spans`, `group_rows`, `join_spans`) — do NOT re-derive span grouping. Row grammar (verified verbatim on mex_rsa, see Dev Notes §Raw page layout): each stat row prints home value spans on the left (x ≈ 84–110), the row label in the centre band (x ≈ 380–580), away value spans on the right (x ≈ 833–858) — but those x-bands are ONE report's geometry: classify spans relative to the row's own label span positions (left of label start = home, right of label end = away), not by hardcoded band constants. EXCEPTION — the Possession row prints three values positioned along a horizontal bar (home / contested / away, left-to-right order, x varies with the values); parse that row by left-to-right ordering of its %-spans.
  - [x] 2.3 Closed row-label set (whitespace-normalized match; labels split across spans — rejoin per row): `Goals`, `xG (Expected Goals)`, `Attempts at Goal (On Target)`, `Total Passes (Complete)`, `Pass Completion %`, `Completed Line Breaks`, `Defensive Line Breaks`, `Receptions in the Final Third`, `Crosses`, `Ball Progressions`, `Defensive Pressures Applied (Direct Pressures)`, `Forced Turnovers`, `Second Balls`, `Total Distance Covered`, `Zone 4 – Low Speed Sprinting: 20-25 km/h` (NB: en-dash U+2013 after "Zone 4" — normalize before matching, or match a robust prefix), plus the `Possession` bar block. **Row scoping:** the closed set applies only to STAT rows — rows below the team-names row that carry numeric value spans. The page's non-stat furniture (date/venue strip y≈13, title y≈32, score row y≈62, team names y≈70, the `Possession` section header y≈129, and the two `Total` labels inside the possession bar row) are delimiters/context, not candidates — feeding them to the closed set would raise on every report. Within scope: a row label that matches nothing in the set → `UnknownStatisticError`; a required label never found → `MissingFieldError` naming it. Never fuzzy-match (AD-8).
  - [x] 2.4 Numeric typing per field (AC 1 — the payload is raw and locale-neutral, AD-7; no display strings, no unit text): counts (`goals`, `shots`, `shots_on_target`, `passes`, `passes_completed`, `completed_line_breaks`, `defensive_line_breaks`, `receptions_in_final_third`, `crosses`, `ball_progressions`, `defensive_pressures`, `direct_pressures`, `forced_turnovers`, `second_balls`) parse as non-negative `int` — a decimal or non-numeric where an int is expected → `MalformedFieldError`; `possession`/`contested_possession`/`pass_completion` strip `%` → `float` 0–100; `expected_goals` → `float` ≥ 0 (away prints `0.1`, home `1.78` — precision varies, keep the parsed value raw); `distance_covered`/`sprint_distance` strip the ` km` suffix spans → `float` ≥ 0. Compound rows split into their two numbers: `16 (4)` → `shots=16, shots_on_target=4`; `547 (495)` → `passes, passes_completed`; `170 (26)` → `defensive_pressures, direct_pressures`. `re.ASCII` on every digit class (house rule). Payload shape (snake_case staging — NO `/contract` import, no camelCase): `{"home": {...19 keys...}, "away": {...}, "contested_possession": float}`.

- [x] Task 3: Domain C parser — Phases of Play page (AC: 2)
  - [x] 3.1 NEW `pipeline/extract/domain_c.py` — entry point `extract_domain_c(doc, anchors, report_id) -> dict` (pure, AD-9). Phases page via `anchors["phases-of-play"]` (anchor text `"{home} Phases of Play {away}"`, page index 3 on mex_rsa); assert exactly one page.
  - [x] 3.2 Page prints two sections headed `IN POSSESSION` (8 rows) and `OUT OF POSSESSION` (9 rows), both teams on the one page: per row, home % left of the centred label, away % right — but the % x-position VARIES with the value (it sits at the end of a bar; home `47%` prints at x=12, home `1%` at x=365). **Row scoping:** only %-bearing rows between/below the two section headers are phase rows; the headers themselves, the date strip, and the team-name row (y≈46) are delimiters, never label candidates. Classify per phase row: exactly one %-span left of the label's start and one right of the label's end; any other shape → `PhasesParseError` (test the tiny-value case — `0%`/`1%` bars end near the centre and both exist on the reference page). Closed label sets (normalized; `Counter-press` splits into three spans `Counter`/`-`/`press` — rejoin per row before matching): in-possession `Build Up Unopposed | Build Up Opposed | Progression | Final Third | Long Ball | Attacking Transition | Counter Attack | Set Piece`; out-of-possession `High Press | Mid Press | Low Press | High Block | Mid Block | Low Block | Recovery | Defensive Transition | Counter-press`. All 17 required per team; missing → `MissingFieldError`, unknown → `UnknownStatisticError`. Values int-percent on the page (`47%`) → store as `float` 0–100 (schema `Percentage` is x-decimals 1; keep raw parsed value).
  - [x] 3.3 Defensive Block distribution per team = a projection of the SAME three parsed values `high_block`/`mid_block`/`low_block` (the Phases page is their only source — contract `DefensiveBlockDistribution` $comment). Emit it in the payload as `defensive_block: {high, mid, low}` copied from the phase values at build time — never re-parsed, so the two views cannot disagree by construction.
  - [x] 3.4 Do NOT implement a "blocks sum to ~100" check — see AC 2's correction and Dev Notes §Spec correction. Do record (Task 5) the possession-sum and metre-bounds checks.

- [x] Task 4: Domain C parser — Line Height & Team Length pages (AC: 2)
  - [x] 4.1 Four pages per report via anchors `in-possession-line-height:home|:away` (`"In Possession Line Height & Team Length {team}"`, pages 5/6 on mex_rsa) and `defensive-line-height:home|:away` (`"Defensive Line Height & Team Length {team}"`, pages 26/27). Each anchor exactly one page; all four required.
  - [x] 4.2 Verified layout (Dev Notes §Raw page layout): each page carries THREE pitch panels in x-thirds, headed by phase labels at y≈142 — in-possession: `Build Up Low | Build Up Mid | Final Third Phase`; out-of-possession: `High Block / Press | Mid Block | Low Block` — and exactly NINE `NN m` values per page (three per panel, printed as a number span + `m` span at positions scattered over the pitch graphic). Values are integers metres on mex_rsa; parse numeric (`float`, since other reports may print decimals — verify corpus-wide and record), bound-check 0 < v ≤ 105 (pitch length) as a RECORDED consistency check, not a raise.
  - [x] 4.3 **Resolve the three-values-per-panel semantics before finalizing the payload shape** — this is this story's one genuine investigation (the 1.6 analogue of the minute-glyph work). The page draws each value beside a measurement graphic; probe `page.get_drawings()` (reference technique: `spike/extract.py` exact-RGB/vector classification; the corpus-scan scratchpad pattern from 1.6's Dev Agent Record) to associate each `NN m` text with its arrow/line and classify what each of the three measures per panel IS (plausibly line height, team length, and a third measure — identify it from the geometry: vertical vs horizontal extent, position relative to the pitch rect). Encode the classification as a closed, deterministic rule verified on all 104 reports; an unclassifiable value → `LineHeightParseError`, never a guess. Record the resolved semantics in the Dev Agent Record.
  - [x] 4.4 Payload stays RAW and per-phase (AD-7): `line_height_team_length: {"in_possession": {<panel-key>: {<classified-measure>: value, ...}, ...}, "out_of_possession": {...}}` with panel keys normalized kebab (`build-up-low`, `build-up-mid`, `final-third-phase`, `high-block-press`, `mid-block`, `low-block`). **Known contract gap, do not resolve here:** contract `PossessionSplitMetres` wants ONE `lineHeight` + ONE `teamLength` pair per possession state, but the page prints per-phase panels — the fixtures' single values (44.4 m etc.) are synthetic per `data/fixtures/README.md` ("real" list covers Domain C *phase percentages* only). File the shape mismatch as an AD-14 note in `deferred-work.md` (Story 1.16's emit must either aggregate per a defined rule or change the contract shape; either way it's a logged AD-14 decision with `schemaVersion` bump). `/contract` stays read-only.

- [x] Task 5: Self-validation checks — recorded, binary, appended (AC: 1, 2)
  - [x] 5.1 `domain_b_checks(payload, shots_counts=None) -> list[dict]` in `domain_b.py` (the optional arg feeds Task 5.4), `domain_c_checks(payload) -> list[dict]` in `domain_c.py` — same `{check, result, specifics}` dict shape as Domain A's; results exactly `"pass"`/`"fail"` (the aggregator treats anything else as fail).
  - [x] 5.2 Domain B recorded checks: `key-statistics-possession-sum` (home + contested + away within a fixed documented tolerance of 100 — the tolerance is DERIVABLE, not corpus luck: three values each rounded to 1 decimal drift at most ±0.15, so ±0.2 is principled; verify corpus-wide anyway; mex_rsa: 57.1+6.8+36.1 = 100.0 exact); `key-statistics-internal-consistency` (`shots_on_target <= shots`, `passes_completed <= passes`, `direct_pressures <= defensive_pressures`, and printed `pass_completion` within ±1.0 of `100*passes_completed/passes` — printed value is integer-rounded: 495/547 → 90, 290/351 → 83).
  - [x] 5.3 Domain C recorded checks: `tactical-metre-bounds` (every metre value 0 < v ≤ 105); phases values already type-checked at parse (a non-numeric raises — that's the AC's "meter values numeric" fail-loud half; the recorded half is the bounds check).
  - [x] 5.4 Recommended (cheap, high-value, mirrors 1.3's marker-vs-table design): `key-statistics-shots-reconciliation` — Domain B's `shots` vs the shots domain's counts (two independent sources of the same fact; fixture README verified `16 (4)` matches the 16 shot rows / 4 on-target on all six fixture team-innings). **Pin the comparison target: the attempts-TABLE row count (`shots["counts"][side]["table"]`), never the marker count** — markers vs table is already `shots-marker-count`'s check, and on the deliberate-mismatch test fixtures (markers=2, table=9) the two disagree; `pipeline/tests/test_ingest_batch.py:780-812` asserts EXACTLY ONE self-validation failure on those fixtures, so conftest's default Key Statistics `shots` value must derive from the attempts-table rows actually drawn (then reconciliation stays green there and those tests keep passing unmodified). Compute it in `extract_report.py` where both payloads are in hand via the Task 5.1 `shots_counts` arg — keep the parser itself single-source. In the gate, reuse the existing `_parse_memo` (shots) + the new Domain B memo — never a third parse.
  - [x] 5.5 SM-C1 discipline: checks are binary and never loosened. If the corpus contradicts a check (a tolerance genuinely exceeded, a bound breached), model the finding with evidence — widen only with a documented corpus-derived reason in the story record, or let it fail honestly.

- [x] Task 6: Wire into the Extraction Record (AC: 1, 2)
  - [x] 6.1 UPDATE `pipeline/ingest/extract_report.py` (minimal, additive — this is the highest-contention file; Story 1.5 already landed its linking wiring here): inside the existing `with doc:` block, after `extract_domain_a`, call `extract_domain_b(...)` and `extract_domain_c(...)`; add `domains["key_statistics"]` and `domains["tactical_identity"]`; APPEND `domain_b_checks(...)` + `domain_c_checks(...)` to `self_validation["checks"]` (never replace the list, never reorder others'); result re-aggregates via the existing `pipeline.extract.aggregate_self_validation` (package-seam function — import from `pipeline.extract`, NOT from `domain_a`). Typed errors propagate uncaught (the batch turns them into `failed` manifest entries); extend the docstring's error inventory.
  - [x] 6.2 Keep authoring bugs OUT of per-report guards (1.2/1.4 review rule): closed label sets and panel rules are module constants whose integrity fails the run loudly at import/first use, not as 104 identical per-report failures.
  - [x] 6.3 Purity: no new probe/cover parsing, no corpus-level facts, no timestamps. The B/C payloads come only from this report's own anchored pages.

- [x] Task 7: Register FR-15 gate checks (AC: 3)
  - [x] 7.1 UPDATE `pipeline/validate/checks.py` (append-only; runner/sample/deviations/verify MUST NOT change — the seam is guaranteed by `test_runner.py::test_a_newly_registered_check_flows_into_the_report`). Register `domain-b-completeness`, `domain-b-counts`, `domain-c-completeness`, `domain-c-counts`, mirroring the Domain A pair pattern exactly: one-slot payload memo per domain (same shape/justification as `_domain_a_memo` — the runner hands the same open doc to both checks; note the deferred-work item about runner-owned handoff and keep the established pattern rather than refactoring), missing-anchor → return `None` (anchor-coverage's finding, never double-reported), `applies_to=lambda meta: True`. **Known forced test repair (the ONE pre-existing test your registration necessarily breaks):** `pipeline/tests/test_runner.py:133::test_checks_run_are_recorded` hardcodes the exact sorted `checks_run` list — insert the four new ids in sorted position (after `domain-a-counts`) and document the repair per the 1.6 Completion-Notes pattern.
  - [x] 7.2 Closed deviation-category mapping (never a fifth category): parse/typing/completeness failures (`MalformedFieldError`, `MissingFieldError`, `UnknownStatisticError`, layout errors) → `probe-failure` with the typed class name prefixed in specifics (1.6 review patch pattern); failed recorded consistency checks (possession-sum, metre-bounds, internal-consistency, shots-reconciliation) → `count-mismatch`; anchors → existing `anchor-coverage` `missing-anchor`. This lands "B/C anchors, types, and consistency checks" in the deviation summary (AC 3).
  - [x] 7.3 Catch breadth: completeness checks catch `ExtractError` for their own findings but let a `ProbeError`/other `PipelineError` propagate ONCE to the runner (1.6 review patch: don't double-attribute); counts checks swallow `PipelineError` (completeness's finding) and run only over a successful payload.

- [x] Task 8: Tests (all ACs)
  - [x] 8.1 CRITICAL REGRESSION GUARD: `extract_report` will now run B/C parsers on EVERY report, so every existing synthetic report must carry parseable Key Statistics, Phases, and four line-height pages or the whole ingest suite goes red (exactly what happened when 1.3/1.6 landed — `make_report` gained shots + lineups pages). UPDATE `pipeline/tests/conftest.py` ADDITIVELY, following the 1.6 precedent: module-level draw helpers (`draw_key_statistics_page`, `draw_phases_page`, `draw_line_height_page`) + new `make_report` anchor special-cases beside the existing `lineups` one. **The anchor loop matches RESOLVED ids** (the existing shots special-case is literally `("shots:home", "shots:away")`), so per-team branches must use the suffixed forms — the six exact ids to handle: `key-statistics`, `phases-of-play`, `in-possession-line-height:home`, `in-possession-line-height:away`, `defensive-line-height:home`, `defensive-line-height:away` (a bare-id equality branch for a per-team spec never fires and the generic anchor-text-only page fails the whole suite undiagnosably). Add optional per-test override params defaulting to consistent values: the default B payload's `goals` must match the cover score, and its `shots` must derive from the attempts-table rows the default shots pages actually draw (Task 5.4's constraint). Do not edit existing helper bodies. Note `clean_registry` is NOT a conftest fixture — it is defined locally in `test_checks_registry.py:21` and `test_runner.py:18`; copy that local-fixture pattern into your new test file rather than promoting it into the shared conftest.
  - [x] 8.2 NEW test files per-module convention: `pipeline/tests/test_extract_domain_b.py`, `test_extract_domain_c.py`, `test_extract_report_domains_bc.py`. Cover: full parse of synthetic pages; every typed failure path on doctored pages (wrong-type value names field + raw text; unknown label; missing row; two %-spans one side of a phases label; wrong panel count; 8 or 10 metre values; out-of-bounds metre as recorded fail not raise); possession-row ordering parse; compound-row splits; unit-suffix stripping; en-dash label normalization; checks land in the right deviation categories under `clean_registry`; determinism (byte-identical `read_bytes()` on re-extract).
  - [x] 8.3 Real-PDF ground truth against `spike/mex_rsa.pdf` (fixture skips locally if absent, fails under CI) — expected values are in Dev Notes §Raw page layout and reconcile with the hand-transcribed m001 fixture: Mexico possession 57.1 / contested 6.8 / South Africa 36.1; xG 1.78 / 0.1; shots 16(4) / 3(2); passes 547(495) / 351(290); completion 90 / 83; distance 107.3 / 97.1 km; sprint 5.3 / 5.1 km; phases spot-checks (Mexico Build Up Unopposed 47, Counter-press 8; South Africa Mid Block 30); all four line-height pages parse with 9 in-bounds metre values each; all recorded checks pass.
  - [x] 8.4 Full suite green. Baseline at story creation: the 1.6-reviewed tree measured 593 passed + 1 skipped, but Story 1.5 is IN PROGRESS in another session and is actively changing `pipeline/markers/` + conftest — re-baseline with a fresh `pytest` run before starting, and keep every pre-existing test passing unmodified except the one named forced repair (Task 7.1's `test_checks_run_are_recorded`); any other repair to another story's test needs a documented cross-domain-composition reason — 1.6's Completion Notes show the pattern.

- [x] Task 9: Acceptance runs + record keeping (AC: 1, 2, 3)
  - [x] 9.1 Full batch: `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104` (new modules change `code_version` → all 104 re-extract, ~2 min). Target: 104/104 with populated `key_statistics` + `tactical_identity` and all recorded checks passing, or every failure a typed, named manifest entry to investigate. **Coordination caveat:** at story creation the full batch/gate is blocked by in-flight 1.5 label-mapping work (per sprint log). If that is still true, verify B/C with a targeted scratchpad sweep over all 104 PDFs (the 1.6-review technique: run just `extract_domain_b`/`_c` per report) and record honestly that full-batch green is pending 1.5 — do NOT patch marker/linking code to get green.
  - [x] 9.2 Gate re-run: `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`. The four new check ids appear in `checks_run`; B/C anchors, typing and consistency checks appear in the deviation summary (AC 3); re-runs byte-identical apart from `run_timestamp`.
  - [x] 9.3 **Momentum observation for Story 1.8 (note only, OUT of scope):** while on the B/C pages, record in the Dev Agent Record where the momentum/possession series actually lives. Story-creation probe evidence so far: NO page in mex_rsa contains the text "Momentum"; the report's only time-axis strip (`0 / 15 / 30 / 45 HT / 60 / 75 / 90 / FT`) prints at the FOOT OF THE LINEUPS PAGE (page 1) per 1.6's verified layout, suggesting the series is a vector chart there, not on any B/C page. Confirm/refute and note candidate vector content — a page number and a one-line description is enough; do NOT classify the drawings (that is 1.8's AC 1), do NOT extract, do NOT touch `/contract` (AD-4 already reserves the required `momentum` key; the shape lands via AD-14 in 1.8).
  - [x] 9.4 Update `pipeline/README.md` (append: Domain B/C record blocks, new checks). Append AD-14 note to `deferred-work.md`: line-height/team-length per-phase page shape vs contract `PossessionSplitMetres` single-pair shape (with the resolved panel semantics from Task 4.3). Fill the Dev Agent Record honestly — reviews cross-check every claim against the suite and have caught false ones twice.

### Review Findings

<!-- Code review 2026-07-23: 3 layers (Blind Hunter 13, Edge Case Hunter 7, Acceptance Auditor 5 raw findings) → deduped/triaged: 1 decision, 9 patch, 3 defer, 6 dismissed. -->

- [x] [Review][Decision→Patch] Digit-only furniture on the Key Statistics page hard-failed with a misleading message — **Resolved: skip value-only rows** (option b). `_split_stat_row` still consumes numeric spans from the edges, but an empty label now `continue`s instead of raising; a genuinely broken stat row is still caught loudly downstream, where the closed-set completeness walk raises `MissingFieldError` naming the absent required label (mirrors the phases parser). [pipeline/extract/domain_b.py:294-302]
- [x] [Review][Patch] `tactical-metre-bounds` accepted physically impossible team widths — added `PITCH_WIDTH_METRES = 68.0` and a per-measure bound map so `team_width` is bound by 68 while `line_height`/`team_length` keep 105. **Corpus-verified (SM-C1):** 104/104 sweep — `team_width` max 60.0 (0 breaches of 68), `line_height` max 71.0 (>68, correctly kept on the 105 axis), `team_length` max 51.0. [pipeline/extract/domain_c.py:515-547]
- [x] [Review][Patch] Synthetic default Key Statistics printed identical home/away values for 11 of 19 fields — now every field differs per side (the mex_rsa home/away reference rows: `completed_line_breaks` 105/57, `crosses` 13/8, `defensive_pressures` 170/306, …), so a left/right misclassification cannot pass the synthetic suite unseen. `direct_pressures ≤ defensive_pressures` holds on both sides; possession still sums 100.0. [pipeline/tests/conftest.py:309-343]
- [x] [Review][Patch] Possession-row routing keyed on ANY bare `Total` span — now routes to the possession grammar only when three combined percent spans OR every non-value span equals `Total`, so a split `Total Passes (Complete)`/`Total Distance Covered` label reaches its own row grammar; the degraded-bar path is preserved. [pipeline/extract/domain_b.py:271-289]
- [x] [Review][Patch] Possession-sum tolerance compared raw float arithmetic at the inclusive boundary — the drift is now rounded to 1 decimal before comparison (`round(abs(total - 100.0), 1) <= 0.2`), so the documented ±0.2 tolerance is the real tolerance, not float noise. [pipeline/extract/domain_b.py:371-388]
- [x] [Review][Patch] `_parse_value` silently fell through to the km grammar for any unrecognized `_RowSpec.kind` — added an explicit `if spec.kind == "km"` branch and a final `StatisticsParseError` for an unknown kind (authoring bug, loud at first use). [pipeline/extract/domain_b.py:144-155]
- [x] [Review][Patch] Domain B and C percent grammars disagreed on the space before `%` — C's `_PHASE_PERCENT_RE` now allows the optional space (`(\d+(?:\.\d+)?) ?%`), matching B and tolerating the spaced form the real template prints. [pipeline/extract/domain_c.py:51-54]
- [x] [Review][Patch] The four B/C gate-check docstrings overclaimed "propagate once" — corrected to state the contract holds for `PipelineError`, with the non-`PipelineError` double-attribution caveat named and pointed at the ledgered runner-owned handoff (behavior itself deferred). [pipeline/validate/checks.py:567-633]
- [x] [Review][Patch] The snake_case forced-repair whitelisted the six kebab panel keys RECORD-WIDE — added `_keys_except`, which exempts the panel keys only inside their own subtree (by object identity), so the same name reused elsewhere in staging is still guarded. [pipeline/tests/test_ingest_record.py]
- [x] [Review][Patch] En-dash normalization had no fixture-independent coverage — added `test_the_en_dash_zone_4_label_folds_to_a_closed_set_key`, feeding a raw U+2013 label through `_normalize_label` and asserting it folds to the closed-set key (runs without `spike/mex_rsa.pdf`). [pipeline/tests/test_extract_domain_b.py]
- [x] [Review][Defer] Non-`PipelineError` exceptions double-attribute across each domain's completeness/counts pair [pipeline/validate/checks.py:483-512] — deferred, pre-existing: byte-for-byte the Domain A memo/catch pattern (checks.py:335-343), copied per the story's "copy the pattern, don't extend its cleverness" instruction; only reachable by authoring bugs, which stay loud (twice). Ledgered with the memo debt.
- [x] [Review][Defer] Third and fourth verbatim copies of the `_check` dict helper (the Self-Validation check shape) across domain_a/b/c [pipeline/extract/domain_b.py:353, pipeline/extract/domain_c.py:519] — deferred, pre-existing shape: extraction into a shared module touches `domain_a.py` (out of this story's write scope); do it when a story next opens that file.
- [x] [Review][Defer] The gate rebuilds a full-document `PageTextIndex` per domain (shots, A, B, C — four builds over identical text) [pipeline/validate/checks.py:463] — deferred, pre-existing: extends the ledgered runner-owned parse-handoff item; the story bound "copy the memo pattern, don't refactor the runner".

Dismissed as noise/handled (6): `_domain_anchor_pages` early-`None` masking the registry `LookupError` (only when a report also misses a page — the bug still raises loudly on every other sampled report); gate skipping shots-reconciliation when shots fail to parse (documented by-design — reconciliation is impossible without the shots payload, and shots-parse owns that finding); team-names-row exact-equality fragility (loud, self-describing error, corpus-clean); both vertical brackets touching a goal line misclassifying as two `line_height`s (physically near-impossible, still fails loud naming the panel); `_split_stat_row` edges-inward classification vs Task 2.2's label-relative letter (disclosed in Completion Notes, pinned by test, honors the no-fixed-x-bands prohibition; the `n/a %`→`UnknownStatisticError` degradation is inherent — an unparseable value is indistinguishable from label text); deviation-category tests not under `clean_registry` (they never mutate the registry).

Note (commit hygiene, not a code finding): Story 1.11 crosses hunks are interleaved beyond `checks.py`/`conftest.py` — also in `pipeline/ingest/extract_report.py` and `pipeline/tests/test_ingest_record.py` — so a 1.7-only commit requires partial staging of four shared files.

**Resolution (2026-07-24):** all 10 patches applied (the decision resolved to "skip value-only rows"); 3 items deferred to `deferred-work.md`. Verified: full suite **765 passed, 1 skipped** (0 regressions); corpus width sweep 104/104 clean confirming the per-axis metre bounds. No unresolved high/medium findings → status **done**.

## Dev Notes

### Mental model (read this first)

Story 1.2 resolved all the anchors you need (`key-statistics`, `phases-of-play`, `in-possession-line-height:home/:away`, `defensive-line-height:home/:away` — all resolve on every one of the 104 reports). Story 1.6 established `pipeline/extract/` and the complete per-domain extractor convention: pure entry point, typed errors, closed corpus-enumerated maps, recorded self-validation checks appended at the record seam, paired gate checks, additive conftest synthesis. **You are the convention's first copy, not its second author** — pattern-match `domain_a.py`/`checks.py` deliberately; the reviewers will diff you against it. What's genuinely new here: (a) three tabular page grammars (stat rows with flanking values; bar-chart rows with floating value positions; pitch panels with scattered measure values); (b) one real investigation — classifying the three metre values per line-height panel from vector drawings; (c) the first evidence-backed AC correction (blocks don't sum to 100).

### Spec correction — the "~100% block sum" check (binding, evidence on file)

The epic AC and PRD FR-5 consequence say "Defensive Block percentages per team sum to ~100%". Written before Story 1.1 transcribed the real pages, this is factually wrong:

- `contract/match-bundle.schema.json` `DefensiveBlockDistribution` (line ~471): "Independent rates, not a partition — they do not sum to 100", and its $comment pins the three values as identical to `phasesOutOfPossession.highBlock/midBlock/lowBlock` with the Phases page their only source.
- `InPossessionPhases` description: corpus-verified, PMSR-M74 Germany's eight in-possession values sum to 124.
- This story's creation probe of `spike/mex_rsa.pdf`: Mexico blocks 7+25+11 = 43; South Africa 5+30+14 = 49. Nowhere near 100.

Shipping the check as written would fail ~104/104 and flood the gate with false `count-mismatch` deviations — the exact "silently wrong data" inversion AD-8 exists to prevent, in loud form. Per the 1.6 precedent ("if the corpus contradicts a check, model the notation — don't loosen the check to get green", and equally: don't ship a check that is wrong by construction), AC 2 is corrected at story creation: the recorded consistency checks are the possession three-way sum (corpus-true: prints home/contested/away to 1 decimal, sums 100.0 on the reference) and metre numeric/bounds. During implementation, verify both corpus-wide and record the evidence in the Dev Agent Record; if you find any report where blocks DO sum to ~100, surface it — the correction, like the check, must survive contact with all 104.

### What already exists — do NOT rebuild

- Anchors: `pipeline/discover/anchors.py::ANCHOR_REGISTRY` already contains every spec you need (see Mental model). NO new anchor specs required. `resolve_anchors` expands per-team specs to `:home`/`:away` ids; `extract_report` passes the resolved `anchors` dict (`anchor_id -> [page indices]`) into extractors.
- Visual-row reconstruction: `pipeline/extract/lines.py` (`TextSpan`, `VisualRow`, `text_spans`, `group_rows`, `join_spans`) — x-preserving, built by 1.6 exactly for "which side of the label is this span on" work. Reuse; do not adapt `probe.py` again.
- Record seam: `pipeline/ingest/extract_report.py` — `domains` dict + `self_validation["checks"]` append + `pipeline.extract.aggregate_self_validation` (package-level seam, moved out of `domain_a` by the 1.6 review precisely so 1.7+ wouldn't import a sibling domain).
- Gate seam: `pipeline/validate/checks.py` — `Check(check_id, applies_to, run)`, `register_check` (duplicate ids raise), closed `DeviationCategory` four-set enforced by `Deviation.__post_init__`, per-domain one-slot payload memo pattern (`_domain_a_memo`), missing-anchor → `None` convention. A raising check is recorded against its own id; the rest still run.
- Typed-error house: `pipeline/extract/errors.py` — `ExtractError(PipelineError)` base; existing `MissingFieldError`, `MalformedFieldError` (both name the field), `LineupParseError`, `UnknownPositionError`, `UnknownStageError`, `UnknownVenueError`, `UnknownMinuteGlyphError`, `LineupCountError`. Append yours beside them.
- Idempotence: `code_version` fingerprints `pipeline/**/*.py` — your new modules auto-invalidate all 104 staged records; cold re-run ~2 min, no `--force` needed.
- Test scaffolding: `conftest.py::make_report` synthesizes a full multi-anchor report (cover, lineups, shots pages with maps + attempts tables); `clean_registry`; `mex_rsa_pdf` fixture (local skip / CI fail); byte-identity assert pattern on `read_bytes()`.

### Extraction Record — current real shape and your additions

```
domains: {match_metadata: {...}, shots: {...}}      # after 1.6 + 1.3 (+1.5 link fields)
self_validation: {result, checks: [shots checks, link-rate checks, domain A checks]}
```

Add (snake_case, internal staging — no `/contract` dependency; contract `TeamKeyStatistics`/`KeyStatisticsBlock`/`TeamTacticalIdentity` are the emit-time field checklist for Story 1.16 only):

```
domains["key_statistics"] = {
  "home": {possession, goals, expected_goals, shots, shots_on_target, passes,
           passes_completed, pass_completion, completed_line_breaks,
           defensive_line_breaks, receptions_in_final_third, crosses,
           ball_progressions, defensive_pressures, direct_pressures,
           forced_turnovers, second_balls, distance_covered, sprint_distance},
  "away": {...same 19...},
  "contested_possession": float,          # match-level third share (contract-pinned)
}
domains["tactical_identity"] = {
  "home": {
    "phases_in_possession":  {build_up_unopposed, build_up_opposed, progression,
                              final_third, long_ball, attacking_transition,
                              counter_attack, set_piece},
    "phases_out_of_possession": {high_press, mid_press, low_press, high_block,
                              mid_block, low_block, recovery,
                              defensive_transition, counter_press},
    "defensive_block": {high, mid, low},  # projection of the same three parsed values
    "line_height_team_length": {"in_possession": {per-panel...}, "out_of_possession": {per-panel...}},
  },
  "away": {...},
}
```

### Raw page layout — verified verbatim on spike/mex_rsa.pdf (story-creation probe, 2026-07-23)

**Key Statistics (page 2, anchor `Match Summary - Key Statistics`).** One page, both teams. Landscape ~960×540. Header rows: date/venue/kickoff strip (y≈13), title (y≈32), score `2` / `0` (y≈62), team names `Mexico` (x=60) / `South Africa` (x=722) (y≈70). Then the stat rows at 21pt pitch:

```
y=129  'Possession'                                (centred section header)
y=147  'Total' 86 | 57.1%@345  6.8%@526  36.1%@646 | 'Total' 835   <- 3 values on the bar: home/contested/away, L-to-R
y=169  2@103   'Goals'                     0@851
y=190  1.78@97 'xG (Expected Goals)'       0.1@848                 <- label split: 'xG ' '(' 'Expected Goals' ')'
y=211  16@94 (4)@107  'Attempts at Goal (On Target)'   3@845 (2)@854
y=232  547@85 (495)@104 'Total Passes (Complete)'      351@833 (290)@852
y=253  90@94 %@109  'Pass Completion %'    83@843 %@858            <- value + '%' separate spans
y=274  105@97  'Completed Line Breaks'     57@849
y=295  10@100  'Defensive Line Breaks'     3@852
y=316  117@99  'Receptions in the Final Third'  36@848
y=337  13@101  'Crosses'                   8@851
y=358  23@100  'Ball Progressions'         8@851
y=379  170@88 (26)@107 'Defensive Pressures Applied (Direct Pressures)'  306@835 (45)@857
y=400  31@100  'Forced Turnovers'          32@849
y=421  56@99   'Second Balls'              45@848
y=442  107.3@86 ' km'@108  'Total Distance Covered'   97.1@838 ' km'@854
y=463  5.3@90 ' km'@104  'Zone 4 – Low Speed Sprinting: 20-25 km/h'  5.1@840 ' km'@852
```

Home value spans x≈84–110; labels x≈380–580; away x≈833–858 — EXCEPT the possession bar row. The Zone 4 label contains an en-dash (U+2013) and its `20-25 km/h` fragment splits across ~6 spans — whitespace-normalize the joined row text before matching. This row is the contract's `sprintDistance` ("the page's second distance row").

**Phases of Play (page 3, anchor `Mexico Phases of Play South Africa`).** One page, both teams. Section headers `IN POSSESSION` (y≈105) and `OUT OF POSSESSION` (y≈321) centred. 8 + 9 rows; per row home % LEFT of centred label, away % RIGHT, value x varies with the value (bar-end placement):

```
IN POSSESSION      home | away        OUT OF POSSESSION   home | away
Build Up Unopposed  47% | 43%         High Press            9% |  6%
Build Up Opposed    13% | 13%         Mid Press             3% |  3%
Progression         16% | 14%         Low Press             0% |  1%
Final Third         11% |  7%         High Block            7% |  5%
Long Ball            3% |  6%         Mid Block            25% | 30%
Attacking Transition 10% | 12%        Low Block            11% | 14%
Counter Attack       1% |  2%         Recovery              5% |  2%
Set Piece            5% |  5%         Defensive Transition 12% | 10%
                                      Counter-press         8% |  7%
```

(Blocks sum: Mexico 43, South Africa 49 — the §Spec correction evidence. These 17×2 values are hand-transcribed in the m001 fixture as `phasesInPossession`/`phasesOutOfPossession` and match exactly.)

**Line Height & Team Length (pages 5/6 in possession, 26/27 defensive; one page per team).** Three pitch panels in x-thirds with phase headers at y≈142 (`Build Up Low`@153 | `Build Up Mid`@439 | `Final Third Phase`@708; defensive pages: `High Block / Press`@134 | `Mid Block`@448 | `Low Block`@731), a `DIRECTION` caption per panel at y≈176, and exactly nine `NN m` values per page — three per panel, scattered over the pitch graphic (e.g. Mexico in-possession: Build Up Low 56/40/19 m, Build Up Mid 57/33/39 m, Final Third Phase 47/35/54 m). Which of the three numbers is line height vs team length vs the third measure is NOT decidable from text alone — Task 4.3's drawings investigation resolves it. The m001 fixture's single `lineHeight`/`teamLength` values (44.4/47.7/34.5/33.9) match NO printed value and are synthetic per the fixture README — do not treat them as ground truth for this page.

**Momentum (for Task 9.3's note only):** no "Momentum" text exists anywhere in mex_rsa; the only match-clock axis (`0/15/30/45 HT/60/75/90/FT`) prints at the foot of the LINEUPS page (page 1, per 1.6's verified layout). The B/C pages carry no time series.

### Normalization & typing rules (AC 1/2 — normative)

- All values raw and locale-neutral (AD-7): plain ints/floats, no `%`/`km`/`m` strings, no formatting, no display strings. Units are locale-layer metadata keyed by metric code — never artifact strings.
- Counts → `int` (a decimal where an int is expected is `MalformedFieldError`, not a rounding opportunity). Percentages → `float` on the 0–100 scale. xG → `float`. Distances: Domain B in km (`float`), Domain C in metres (`float`).
- `re.ASCII` on every digit class. Whitespace-normalize joined row text before label matching (same normalize discipline as `discover/text.py`).
- Closed label sets, assert-on-unknown (AD-8): unknown row label, unexpected extra row, missing required row, off-shape value — all loud typed failures naming the field and raw text. Never fuzzy-match, never default, never skip.
- Contract precision (emit-time reference, don't round in staging): Percentage x-decimals 1, Kilometres 2, Metres 1, ExpectedGoals 2. Keep the parsed raw value; canonical serialization already fixes representation.

### Failure & validation policy (AD-8, binding)

- Per-report failures abort that report with a typed error (report_id + field + specifics) and never the batch. All-or-nothing per domain payload — no partial B or C block ever stages.
- Type failures RAISE (AC 1's loud path). Consistency findings RECORD as binary check dicts (AC 2's pass/fail path) — a failed consistency check still stages the record so the gate can localize it (the 1.6 formation-sum precedent: recorded check, not raise, when the value parsed cleanly but the numbers disagree).
- Self-Validation stays binary, never loosened (SM-C1). Tolerances (possession-sum ±0.2, completion ±1.0, metre ≤105) are fixed documented constants verified corpus-wide — if the corpus busts one, that's evidence to record and a deliberate constant change, not a runtime fudge.

### Coordination — in-flight stories (respect strictly)

- **Story 1.5 (marker–event linking) is IN PROGRESS in another session** and owns `pipeline/markers/` entirely. Its wiring already sits in `extract_report.py` (`link_rate_checks` import) and `checks.py` (`marker-event-link-rate`). Do not create, import from, or modify anything under `pipeline/markers/`; keep your `extract_report.py`/`checks.py`/`conftest.py` diffs minimal and additive so either story lands cleanly in either order. The sprint log notes the full batch/gate is currently blocked by 1.5 label-mapping work — see Task 9.1's caveat; never "fix" marker code to unblock your acceptance run.
- **Story 2.2 (site chrome) went done during this story's creation** — regardless of its status, `app/`, `data/` (fixtures included), and everything Node-side stay untouched: they are simply out of this story's scope.
- **`/contract` is READ-ONLY.** It's your field checklist (`TeamKeyStatistics` etc.), not a dependency — no imports, no camelCase in staging, no `schemaVersion`. Schema gaps (the line-height per-phase shape) → AD-14 notes in `deferred-work.md`, following the three 1.6 examples there.
- **Out of scope:** momentum extraction and contract work (1.8); goalkeeping/set plays (1.9); per-player tables (1.10) — note the `individual-*` anchors cover superficially similar per-player stat pages; yours are ONLY `key-statistics`, `phases-of-play`, and the four line-height anchors; cross-match identity (1.15); bundle emission/camelCase/`storyStats`/budget (1.16).

### Previous story intelligence (1.6 + earlier reviews — anti-patterns that WILL be flagged)

- Ground-truth first: 1.6's implementation ran corpus-wide scratchpad scans BEFORE finalizing closed maps, and several of the story's assumptions were corrected by evidence (interleaved text → y-aligned table; footer formations → rotated side labels). Expect the same here: verify the row/panel grammar against more than mex_rsa early (a 104-report sweep of just your parsers is ~2 min and it caught 1.3's 37-report two-page surprise).
- Never wrap a per-report/per-check loop in blanket `try/except` — setup/registry integrity fails the run, not 104 reports.
- One typed exception class per failure kind; all carry `report_id`; message pattern `"[{report_id}] ...: {reason}"`; never overload an existing class for a new failure kind (a 1.6 Low finding).
- Byte-identity on `read_bytes()`, never parsed dicts. Canonical write recipe + `newline=""`. `iterdir()` + suffix check, sorted — never `glob`.
- No tautological asserts; derive expected counts from constants/registries, never hardcode magic numbers in tests.
- Gate checks: memoize the payload per doc; catch precisely (own findings only); prefix typed class names in specifics; never double-report an anchor miss.
- Every Completion-Notes claim gets cross-checked against the suite — two stories have had false claims caught. Count your tests, run the suite, paste real numbers.
- House style: `from __future__ import annotations`; modern hints; `@dataclass(frozen=True)` where it fits; absolute imports rooted at `pipeline.`; module docstrings naming the failure defended against + Task/AC; long sentence-like test names; repo-root-relative paths only.

### Known landmines (live risks for this story)

- `lines.py` inherits the 3.0pt line-tolerance / 1.0pt space-gap boundary risk (deferred-work item) — your stat rows are 21pt apart so grouping is safe, but the Zone 4 label's many small spans and the phases `Counter`/`-`/`press` split both depend on correct joining; add boundary tests for your grammars.
- Zero-width/format chars survive `normalize()` (U+200B, U+00AD, ligatures) — relevant to label matching; the en-dash in the Zone 4 label is confirmed real.
- Do not assume any anchor's page list has length 1 — assert it loud (`StatisticsParseError`/`PhasesParseError`/`LineHeightParseError`). The shots table two-page discovery is the cautionary tale.
- The value-x-varies-with-value bar layout (possession row, all phases rows) means fixed x-band classification silently misparses — classify relative to the label span positions per row, and test a phases row whose home value is tiny (bar end near centre, e.g. `0%`/`1%` — both exist on the reference page).
- `_parse_memo`/`_domain_a_memo` statefulness is a known deferred item — copy the pattern, don't extend its cleverness, don't refactor the runner.
- Editing any `pipeline/**/*.py` invalidates all 104 staged records (expected; ~2 min cold).

### Project Structure Notes

- NEW: `pipeline/extract/domain_b.py`, `pipeline/extract/domain_c.py`, `pipeline/tests/test_extract_domain_b.py`, `pipeline/tests/test_extract_domain_c.py`, `pipeline/tests/test_extract_report_domains_bc.py`.
- UPDATE (minimal/additive): `pipeline/extract/errors.py`, `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py` (additive helpers + anchor-loop branches only), `pipeline/README.md`, `_bmad-output/implementation-artifacts/deferred-work.md` (AD-14 note).
- DO NOT TOUCH: `pipeline/markers/` (1.5, in progress), `pipeline/extract/domain_a.py`/`lines.py`/`venues.py` (unless a review-grade reason forces it — document), `contract/`, `data/`, `app/`, `spike/` (frozen), `pipeline/validate/{runner,sample,deviations,verify}.py` (guaranteed seam), `pipeline/requirements.txt` (no new dependencies — everything here is pymupdf text/drawings + stdlib).
- Environment: Windows host; `pipeline\venv\Scripts\python.exe`; call `python`, never `python3`/`uv`. pymupdf==1.28.0 (`import pymupdf`), pytest==8.4.2. No linter — style by convention.

### Testing standards summary

pytest at `pipeline/tests/`; deterministic + offline; synthetic PDFs via pymupdf factories + `spike/mex_rsa.pdf` as the only real-PDF fixture (gitignored; local skip / CI fail); `clean_registry` for registration tests; byte-identity on real bytes. Re-baseline the suite count before starting (1.5 is moving it). Commands:
`pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`
`pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104`
`pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`

### References

- Story spec + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.7, lines 336–356); PRD FR-4 `prd.md:124-128`, FR-5 `prd.md:130-134`, FR-15 `prd.md:211-215`
- Field inventory (normative): `_bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md` §6 B/C
- Architecture: `ARCHITECTURE-SPINE.md` — AD-7 (raw locale-neutral), AD-8 (fail loud, binary checks), AD-9 (pure extract), AD-14 (contract change flow), Consistency Conventions, Structural Seed
- Contract field checklist (READ-ONLY): `contract/match-bundle.schema.json` — `TeamKeyStatistics:345` (19 fields + row-mapping description), `KeyStatisticsBlock:393` (contestedPossession rationale), `InPossessionPhases:406`, `OutOfPossessionPhases:432`, `PossessionSplitMetres:460`, `DefensiveBlockDistribution:471` ($comment: same numbers as the block phases), `TeamTacticalIdentity:484`; `contract/common.schema.json` — `Percentage:450`, `Count:436`, `Metres:458`, `Kilometres:465`, `ExpectedGoals:479`
- Fixture provenance (which numbers are real): `data/fixtures/README.md` — Domain B fully real, Domain C phase percentages real, line-height/team-length synthetic
- Pipeline seams: `pipeline/ingest/extract_report.py` (domains seam + append-checks pattern), `pipeline/extract/__init__.py::aggregate_self_validation`, `pipeline/extract/lines.py`, `pipeline/validate/checks.py` (Domain A pair + memo pattern, lines 307–432), `pipeline/discover/anchors.py:55-89` (the six B/C anchor specs)
- Prior stories: `1-6-*.md` (the extractor convention + review findings — read its Review Findings section in full), `1-3-*.md` (two-page table discovery), `1-2-*.md`/`1-4-*.md` (batch/gate patterns), `deferred-work.md` (AD-14 note format, live landmines)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Implementation Plan

1. Re-baseline the suite (1.5 landed since story creation: 663 passed + 1 skipped, not the story's 593).
2. Task 4.3 investigation FIRST (it decides the Domain C payload shape): probe `page.get_drawings()` on the mex_rsa line-height pages, derive a classification rule, verify it corpus-wide before writing any parser code.
3. Tasks 1→7 in story order: typed errors → `domain_b.py` → `domain_c.py` → checks → `extract_report.py` wiring → gate checks, pattern-matching `domain_a.py`/`checks.py` deliberately (the 1.6 convention's first copy).
4. Corpus-wide scratchpad sweep of both parsers over all 104 PDFs before wiring (1.6's ground-truth-first discipline).
5. Task 8: additive conftest draw-kits + `make_report` branches for the six resolved anchor ids; three new test files; full-suite regression.
6. Task 9: full batch + gate (unblocked — 1.5 went done during this story), README + ledger, record keeping.

### Debug Log References

- Line-height drawings probe + corpus sweep: scratchpad `probe_line_height.py`, `dump_gray.py`, `classify_line_height.py` — final sweep result: `104 reports, 0 with problems, 3744 values, 0 non-integer, 0 out of (0,105]`.
- Parser sweep over all 104 PDFs (pre-wiring): scratchpad `sweep_bc.py` — `104 reports, 0 extraction failures, 0 failed checks`.
- Momentum probe (Task 9.3): scratchpad `probe_momentum.py` — no "Momentum" text on any page; two-color vector bar band at the foot of the lineups page (page 1).

### Completion Notes List

- **Task 4.3 resolved — the three metre values per panel are line height, team length, and team WIDTH**, classified deterministically from the drawn measurement brackets: each printed value sits on its bracket's gray arrow badge (a ~24×15 pt 20-item vector glyph, fill RGB (0.42, 0.447, 0.502) constant corpus-wide); the badge's thin rail rects give the bracket orientation; a horizontal bracket spans the team block's x-extent → `team_width`; of the two vertical brackets per panel, the one whose extent reaches a pitch goal-line edge (±2 pt) measures own-goal-line-to-block-edge → `line_height`, the other spans the block → `team_length`. Verified on all 104 reports × 4 pages × 3 panels = 3,744 values: exactly one of each kind per panel, every printed value within 1.0 m of its measured extent at the 105 m × 68 m pitch scale, all values integers in (0, 105]. Payload key `team_width` is the third measure (the fixtures' single synthetic `lineHeight`/`teamLength` values match no printed value, as the fixture README records). AD-14 shape-mismatch note filed in deferred-work.md.
- **AC 2's corrected checks verified corpus-wide**: possession three-way sum within ±0.2 of 100 on all 104 reports (sweep: 0 failed checks; the tolerance is derivable — three 1-decimal roundings drift ≤ ±0.15); all 3,744 metre values numeric and within (0, 105]. No report's defensive blocks sum to ~100 (reference: 43/49) — the block-sum check stayed out, per the story's binding correction.
- **Domain B grammar**: stat rows classified relative to each row's own label span positions (never fixed x-bands); the possession bar row is identified by its three combined %-spans or its bare `Total` furniture spans (a degraded bar then fails inside the possession grammar, naming the real problem); a bare unit span (`%`/`km`) is consumed as value material only when its adjacent numeric span is consumed with it, which keeps the `Pass Completion %` label's own trailing `%` in the label (found against the real page: the label prints its `%` as a separate span). The left/right printed team names are asserted against the probed home/away (side-swap → `StatisticsParseError`).
- **Merged-span tolerance**: pymupdf merges adjacent same-font inserts, so synthetic fixture values arrive as single spans (`'16 (4)'`, `'90 %'`, `'56m'`) where the real pages print split spans. The parsers accept both forms (superset token grammars); real-corpus behavior is pinned by the mex_rsa ground-truth tests and the 104-report sweep.
- **A wholly non-numeric value** (e.g. `n/a %`) is indistinguishable from label text under relative classification and surfaces as `UnknownStatisticError` carrying the raw text — still loud, tested and documented; a wrong-shaped but recognizable value (`(83)` for a percentage) surfaces as `MalformedFieldError` naming the field and raw text (AC 1's path).
- **Checks**: `key-statistics-possession-sum` (±0.2 documented constant), `key-statistics-internal-consistency` (subset counts + completion ±1.0), `key-statistics-shots-reconciliation` (vs the attempts-TABLE count, computed at the `extract_report` seam via the `shots_counts` arg — parser stays single-source; the gate reuses `_shots_parse_result`'s memo, never a third parse), `tactical-metre-bounds` ((0, 105], recorded not raised). `defensive_block` is a build-time projection of the same three parsed block phases — the two views cannot disagree by construction.
- **Forced test repairs (2)**: `test_runner.py::test_checks_run_are_recorded` — the story-named repair, four new ids inserted in sorted position. `test_ingest_record.py::test_record_keys_are_snake_case` — Task 4.4 mandates kebab panel keys (`build-up-low`, …) which necessarily collide with 1.2's all-snake staging-key walk; the repair excludes exactly the line-height panel keys (they name page-family sections, same design as the kebab anchor ids the test already excluded) and the rule the test defends — no camelCase in staging — is untouched.
- **Momentum (Task 9.3, note only)**: confirmed — no "Momentum" text anywhere in mex_rsa; the only match-clock axis prints at the foot of the LINEUPS page (page 1), whose lower band (y≈380–520) carries a two-color vector bar series (49 fills of RGB (1.0, 0.24, 0.0), 42 of (0.7, 0.53, 1.0) on the reference) — a per-interval two-team bar chart, vector-only. Recorded in deferred-work.md for Story 1.8; nothing extracted.
- **Tests**: 63 new tests across `test_extract_domain_b.py` (26), `test_extract_domain_c.py` (22), `test_extract_report_domains_bc.py` (15), including real-PDF ground truth for both domains (skip-local/fail-CI fixture), every typed failure path on doctored pages, deviation-category routing, determinism byte-identity, and the Task 5.4 reconciliation-pins-to-table constraint on the deliberate-mismatch fixture shape.
- **Acceptance runs (Task 9, real numbers)**: suite re-baselined at 663 passed + 1 skipped before starting (1.5 had landed; the story's 593 figure was stale) → **726 passed + 1 skipped** after (663 + exactly the 63 new tests, zero regressions beyond the two documented repairs). Full batch: **104/104 extracted, RUN RESULT: PASS**, 0 failed, 0 self-validation failures, 0 orphans — every record populated with `key_statistics` + `tactical_identity` and 14 checks (the 4 new ones all passing corpus-wide). Gate: **GATE RESULT: PASS, 0 deviations** across the 16-report venue × matchday sample; `checks_run` carries the four new ids (`domain-b-completeness`, `domain-b-counts`, `domain-c-completeness`, `domain-c-counts`); two consecutive gate runs identical apart from `run_timestamp`. The story's 1.5 coordination caveat dissolved before acceptance: 1.5 went done (2571/2571 markers linked), so the full batch/gate ran unblocked — no marker/linking code was touched.

### File List

- `pipeline/extract/errors.py` — UPDATE (append-only): `StatisticsParseError`, `PhasesParseError`, `LineHeightParseError`, `UnknownStatisticError`
- `pipeline/extract/domain_b.py` — NEW: Key Statistics parser + `domain_b_checks`
- `pipeline/extract/domain_c.py` — NEW: Phases + line-height parser + `domain_c_checks`
- `pipeline/ingest/extract_report.py` — UPDATE (additive): B/C extraction inside the `with doc:` block, checks appended at the seam, domains dict + docstring error inventory
- `pipeline/validate/checks.py` — UPDATE (append-only): B/C payload memos, four gate checks registered; runner/sample/deviations/verify untouched
- `pipeline/tests/conftest.py` — UPDATE (additive): Key Statistics/Phases/Line-Height draw kits + constants, `default_key_statistics`, six resolved-anchor-id branches in `make_report`, table-row-derived default shots
- `pipeline/tests/test_extract_domain_b.py` — NEW (26 tests)
- `pipeline/tests/test_extract_domain_c.py` — NEW (22 tests)
- `pipeline/tests/test_extract_report_domains_bc.py` — NEW (15 tests)
- `pipeline/tests/test_runner.py` — UPDATE: the story-named forced repair (checks_run list)
- `pipeline/tests/test_ingest_record.py` — UPDATE: forced repair (kebab panel-key exclusion, documented)
- `pipeline/README.md` — UPDATE (append): Domains B & C record blocks + gate checks
- `_bmad-output/implementation-artifacts/deferred-work.md` — UPDATE (append): AD-14 line-height shape note + momentum scoping note

## Change Log

- 2026-07-23: Story context created (ultimate context engine analysis: epics + PRD/addendum + spine + contract + fixtures provenance + live code seams + real-PDF page probe of all six B/C pages; AC 2 sum-check corrected on corpus evidence).
- 2026-07-23: Story implemented — Domains B & C extractors (`domain_b.py`, `domain_c.py`), four typed errors, four recorded checks + four FR-15 gate checks, record-seam wiring, additive conftest page kits, 63 new tests, README + AD-14 ledger notes. Task 4.3 investigation resolved the three-per-panel semantics (line height / team length / team width) from bracket geometry, verified on all 3,744 corpus values. Two forced test repairs (checks_run list — story-named; snake-case walk vs Task 4.4's kebab panel keys — documented).

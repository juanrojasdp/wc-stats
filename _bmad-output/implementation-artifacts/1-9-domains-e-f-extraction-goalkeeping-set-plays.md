---
baseline_commit: 727963752706bf9a272fa1a35d6a229bf2921d23
---

# Story 1.9: Domains E & F Extraction — Goalkeeping & Set Plays

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the builder,
I want goalkeeper and set-play data extracted per match,
so that the Tactical Layer's goalkeeping and set-play sections have complete data (FR-6, FR-7).

## Acceptance Criteria

1. **Given** a report
   **When** Domain E extraction runs
   **Then** the goalkeeping payload carries, **per team**, the involvement timeline and total involvements, distribution (feet/hands/throw with complete/incomplete), goal prevention (attempts faced, save %, intervention types), and aerial control
   **And** the self-consistency check records pass/fail: distribution category counts sum to total distributions
   **And** every value is numeric-typed and raw/locale-neutral (AD-7); a value that fails to parse as its expected type fails that report loud.

   *Scoping re-ruled from corpus evidence (Juan, 2026-07-27; see Dev Notes §The premise is wrong). The epic's phrasing — "every goalkeeper with minutes in Domain A has a record" — is **unfulfillable**: all four goalkeeping pages are titled `{team}` and **no goalkeeper name appears anywhere on any of them**, while **7 of 208 team-innings used two goalkeepers**. Domain E is therefore staged **per team**, and the goalkeeper(s) with minutes are carried alongside from Domain A's lineups — one name on 201 team-innings, two on 7 — so the attribution question is recorded rather than silently guessed. The AD-14 consequences (the contract's per-keeper `GoalkeeperRecord`, and Story 2.10's "each goalkeeper's ... displays") are Task 8's filings.*

2. **Given** a report
   **When** Domain F extraction runs
   **Then** both teams carry free kicks, penalties, corners (by side and style), and throw-ins
   **And** the self-consistency check records pass/fail: corner counts by side sum to the team's total corners.

3. **Given** the venue × matchday sample
   **When** the FR-15 gate re-runs
   **Then** E/F anchors and consistency checks appear in the deviation summary.

4. **Given** a value the source page does not carry in an extractable form
   **When** extraction runs
   **Then** the absence is **documented** — staged as `null` with a per-report warning naming it — never silently omitted and never manufactured into a passing check (the Story 1.12 / 1.13 documented-absence branch). Three absences are already known and pinned in Dev Notes §Documented absences: the distribution **technique** breakdowns, the goal-prevention **intervention body type** breakdown, and the aerial **crosses-faced completed** count.

[Source: epics.md, Story 1.9, lines 378–398; FR-6/FR-7 `prd.md`. Addendum §6 Domains E and F are normative for coverage. AC 1's re-scope and AC 4 are evidence-driven per SM-C1's "a check must be binary AND true" discipline; all evidence in Dev Notes §Corpus sweep results, reproducible from `pmsr-corpus/` + `work/extracted/`.]

## Tasks / Subtasks

- [ ] Task 1: Typed errors for Domains E & F (AC: 1, 2)
  - [ ] 1.1 UPDATE `pipeline/extract/errors.py` (append-only): one class per failure kind, subclassing `ExtractError`, each carrying `report_id`:
    - `GoalkeepingPageParseError` — structural failure on any of the four goalkeeping page families (anchor resolves to ≠1 page; a required label row absent; a panel count other than four; a table row that does not yield its exact value count).
    - `SetPlaysParseError` — structural failure on the Set Plays page (anchor ≠1 page; a missing KPI label; a corners/free-kick table row that does not yield its exact value count).
    - `InvolvementChartError` — the involvement timeline's structure or scale cannot be established beyond doubt (y-axis labels absent or non-monotonic; a dot outside the plot box; a slot value not within tolerance of an integer; a negative value).
    REUSE where they fit: `MalformedFieldError` (present but wrong type — message MUST name the field and the raw text), `MissingFieldError` (a required field the page does not print). One class per failure kind — never overload, never raise bare `ValueError` (1.6 review rule). For the distribution panels' marker work, the shared chain's own `PitchFrameError` / `UnknownRgbError` travel as themselves (1.11/1.12 precedent) — do not wrap them.

- [ ] Task 2: Domain F parser — Set Plays (AC: 2)
  - [ ] 2.1 NEW `pipeline/extract/domain_f.py` — entry point `extract_domain_f(doc, anchors, report_id) -> dict` (pure per AD-9: no filesystem writes, no timestamps, no absolute paths, no cross-report knowledge).
  - [ ] 2.2 Read the two pages via the anchors Story 1.2 already registered — **no new `AnchorSpec`**: `set-plays:home`, `set-plays:away`. Assert each resolves to EXACTLY one page → else `SetPlaysParseError`. (Verified: 1 page on all 104 × 2 = 208, 0 multi-page, 0 missing.)
  - [ ] 2.3 Row grammar via `pipeline/extract/lines.py` (`text_spans`, `group_rows`, `join_spans`) — do NOT re-derive span grouping. **Label-anchored, never positional**: find each row by its joined label text, then read the integers in that row's known x band. The joined text is clean and stable — `'Direct to Area 3 0 3'`, `'Edge of Penalty Area 0 0 0'`, `'Direct (on target) 0'` — verified on 208/208 (Dev Notes §Raw page layout). All fourteen structural labels are present on 208/208.
  - [ ] 2.4 **The five KPI values print ABOVE their labels, and one value row is shared by two KPIs** (`'12 0'` sits above `'Total Free Kicks Total Penalties'`). Read each KPI as the integer in the label's own x band on the nearest row above it. Beware `'36 Delivery Type From Left Side Total'` — the Total-Set-Plays value shares a row with the Corners table header, so the KPI x band (x < 400) and the table x band (x > 500) must both be bounded.
  - [ ] 2.5 Exact value counts, asserted not assumed (AD-8): corners-by-delivery-type rows carry **3** integers each (left / right / total, x ≈ 765 / 837 / 909); corners-by-delivery-style rows carry **1** (x ≈ 909); free-kick rows carry **1** (x ≈ 422). Any other count → `SetPlaysParseError` naming the row and the tokens found. **Every set-plays page carries exactly 24 numeric words** (22 values + the two date tokens) on 208/208 — assert this as a page-level tripwire.
  - [ ] 2.6 Payload shape (snake_case staging — NO `/contract` import, no camelCase) in Dev Notes §Extraction Record additions. Store **printed values verbatim**; do not derive `corners_by_side` team totals into the record — the side sum is AC 2's *check*, and 1.16 owns the emit-time derivation.

- [ ] Task 3: Domain E parser — the four goalkeeping page families (AC: 1, 4)
  - [ ] 3.1 NEW `pipeline/extract/domain_e.py` — entry point `extract_domain_e(doc, anchors, lineups, report_id) -> dict`. `lineups` is Domain A's already-parsed `match_metadata["lineups"]` block, handed in by the record seam (the 1.10 precedent) — **do not re-parse the lineups page**. It supplies the `goalkeepers` list only; no page data is joined to it.
  - [ ] 3.2 Read the seven pages via existing anchors — **no new `AnchorSpec`**: `gk-involvement` (ONE page, both teams — deliberately not per-team), `gk-distribution:{home|away}`, `goal-prevention:{home|away}`, `aerial-control:{home|away}`. Assert each resolves to EXACTLY one page (verified 104 + 3×208 = 728 pages, all single).
  - [ ] 3.3 **Goal Prevention** — the authoritative source is the seven-column table at the page foot, fully in the text layer on 208/208. Locate it by its **header row** (`'Total Attempts on Goal Faced …'`), then take the first row below it whose integers at **x ≥ 460** number exactly seven. **Both bounds are load-bearing:** `PMSR-M38-ESP-V-KSA` home prints a stray pitch-marker ordinal `'1'` at x=275 on the table's own row (8 spans, not 7), and `PMSR-M34-ECU-V-CUW` away / `PMSR-M38` away each carry a *second* seven-digit row higher up the page (marker labels). Header-anchoring + the x bound resolves all three: **208/208**. Column order L→R: attempts faced · total interventions · save & retain · deflect & retain · save & deflect · save attempt · no save attempt.
  - [ ] 3.4 Goal Prevention KPIs: `Total Attempts on Goal Faced` (x ≈ 114) and `Save %` (x ≈ 318), both printed ABOVE their shared label row, same rule as Task 2.4. **`Save %` prints its number WITHOUT a `%` sign** (unlike Domain B/G) — do not require one. The KPI attempts-faced equals the table's first column on 208/208; assert it as a page-internal cross-check.
  - [ ] 3.5 **Ignore the two donut centre numbers on this page.** They are in the text layer and they are *not* trustworthy: on `PMSR-M01` the Intervention Type donut centre reads `4` while the table's attempts-faced, total-interventions and five-type sum are all `3`. The table is the single source. Do not stage the donut centres, do not check against them.
  - [ ] 3.6 **Aerial Control** — left side is KPI tiles in the text layer: `Total Interventions`, then three `{complete, <type>, incomplete}` triples for Punches / Claims / Tipped-Palmed. Right side carries the `Delivery Types Faced` table (Total · In Swing · Out Swing · Driven · Lofted · Cutback · Push) — seven integers in one row on 208/208, same header-anchored rule. `crossesFacedAttempted` is that table's `Total`; `crossesFacedCompleted` takes AC 4's absence branch (Dev Notes §Documented absences).
  - [ ] 3.7 **Goalkeeping Distribution** — this page is a **map page**, not a table (§The premise is wrong). Use the shared chain **read-only**: `detect_pitch_frames(page)` returns exactly **4** panels on 208/208, all of identical area (59,516.0 pt² each). Because they are equal-area, `detect_pitch_frame`'s `max()` would pick an arbitrary one — this is the Story 1.12 lesson verbatim, so use the plural accessor and map **panel → category by the printed panel title** (`Kick from Feet` / `Kick from Hands` / `Throw Distribution` / `Total Distributions`), text-anchored, **never positional** (AD-8).
  - [ ] 3.8 Within each panel, count the distribution origin markers with `collect_candidate_markers` under a `MarkerSpec` tuned for this family and a two-colour palette: `(0.18, 0.30, 1.00)` → `complete`, `(1.00, 0.00, 0.00)` → `incomplete`. Geometry before colour (AD-9); assert-on-unknown RGB. **Do not edit the chain** — `filter_chain.py` must not change (Story 1.13 is in flight in `pipeline/markers/`; see §Coordination); import it and instantiate a spec.
    **The exact spec is corpus-verified — use it as given:** `marker_min_pt=5.0`, `marker_max_pt=6.5` (real dots are 5.83 pt filled circles with a white stroke), and **`pitch_margin_pt=0.0`** — the default strict containment, which is load-bearing here. Every panel frame ends at `y1 = 406.5` on all 832 corpus panels while the `Complete`/`Incomplete` legend swatches sit at y ≈ 411, so strict containment excludes the legend **by geometry alone**. Any positive margin would admit two swatches per panel and inflate every count by 2. Consequently `legend_min_colors` never fires (a two-colour palette can never reach four distinct fills at one y) and **no legend-row exclusion is needed** — do not add one. Verified: with this spec, **0 off-palette markers are admitted on 208/208 pages**.
  - [ ] 3.9 The three donut centre numbers ARE reliable here and are the printed counterpart: exactly **4 real numbers** print on every distribution page (feet total, hands total, throw total, `Goalkeeper Line Breaks`) — 6 numeric words including the two date tokens, invariant on 208/208. Stage all four, and use the three totals as Task 5's printed cross-check against the marker counts.
  - [ ] 3.10 **Goalkeeping Involvement** — ONE page, both charts, keyed by the home team's anchor. Per chart: read the y-axis labels (single-digit spans at x < 35; the axis auto-scales, top label ∈ {2,3,4,5,6}) and fit `value = (y_of_zero_label − y) / unit` from the label pair; read one 3.0 pt dot per slot (21,764 of 21,764 corpus dots are exactly 3.0 pt wide). **Derive the scale from the printed labels, never from gridline spacing** — the gridline set includes lines the axis does not label, and a spacing-derived unit is wrong (measured during the probe). Slot values must round to non-negative integers; a dot further than the tolerance from an integer → `InvolvementChartError`. Two of 208 charts sit outside a 0.15 tolerance on the probe's naive label-centre fit — resolve those two before shipping a tolerance, and record the resolved bound and its evidence.
  - [ ] 3.11 Slot count is **per report** (95–111 regulation, 129–145 extra-time), exactly as Story 1.8 found for momentum — never hard-code 100. The x-tick labels (`0 5 … 45 HT 50 … 90 90+5`) print below each chart and are the only key to the slot → match-clock mapping. **Open question left to dev (Dev Notes §Open question).**
  - [ ] 3.12 `total_involvements` is printed per team (x > 780) on 104/104 — stage it verbatim. It is NOT the series sum (§Open question).

- [ ] Task 4: The goalkeeper attribution (AC: 1)
  - [ ] 4.1 From `lineups[side]`, collect every entry with `position == "gk"` that took the field — `has_minutes(entry) = starter or entry["substituted_on"] is not None`, the exact rule Story 1.10 proved corpus-wide. Stage them as `goalkeepers: [{name, shirt_number, substituted_on, substituted_off}]` in page order (starters first).
  - [ ] 4.2 **Do not join page data to a goalkeeper and do not infer one.** The pages carry no name; attributing a team block to the sole keeper would be an inference the source does not support, and would be plainly wrong on the 7 two-keeper innings. The list is *context recorded beside* the team block, not a key.
  - [ ] 4.3 Assert the list is non-empty for both sides → else `MissingFieldError` naming the side (a team-inning with no goalkeeper is impossible; 208/208 have ≥1). Do **not** assert exactly one — that is corpus-false on 7 (`PMSR-M21-GHA-V-PAN` home, `M41-NOR-V-SEN` away, `M53-CZE-V-MEX` away, `M62-SEN-V-IRQ` away, `M66-URU-V-ESP` home, `M88-AUS-V-EGY` home, `M98-ESP-V-BEL` away).

- [ ] Task 5: Self-validation checks — recorded, binary, appended (AC: 1, 2, 4)
  - [ ] 5.1 `domain_e_checks(payload) -> list[dict]` in `domain_e.py` and `domain_f_checks(payload) -> list[dict]` in `domain_f.py` — same `{check, result, specifics}` dict shape as Domains A/B/C/G via the `pipeline.extract.check_entry` seam (import from `pipeline.extract`, **never** from a sibling domain module). Results exactly `"pass"`/`"fail"`. Emit exactly **one dict per check id** covering both sides, `specifics` naming every offending side in a deterministic order, so re-runs are byte-identical.
  - [ ] 5.2 `goalkeeping-distribution-sum` — **AC 1's named check.** Per side: `feet.total + hands.total + throw.total == total.total`, EXACT. **Verified 208/208** against the marker counts; the `Total Distributions` panel is drawn as the union of the other three.
  - [ ] 5.3 `goalkeeping-distribution-printed` — per side and per panel: the marker count equals the panel's printed donut centre, EXACT. This is the genuine two-source cross-check (drawn markers vs printed total) and the strongest available signal that panel→category mapping did not slip.
  - [ ] 5.4 `goalkeeping-goal-prevention-sum` — per side: `save_and_retain + deflect_and_retain + save_and_deflect + save_attempt + no_save_attempt == attempts_faced`, EXACT. **Verified 208/208.** Do NOT check the five-type sum against `total_interventions` — that is corpus-FALSE on 207/208 (the contract's own `GoalPrevention` note says the two breakdowns have different denominators, and the corpus agrees). Do NOT check `total_interventions == attempts_faced − no_save_attempt` either — corpus-false on 183/208.
  - [ ] 5.5 `goalkeeping-aerial-sum` — per side: `Σ(six delivery types) == delivery_types_faced.total`, EXACT. **Verified 208/208.**
  - [ ] 5.6 `goalkeeping-involvement-bound` — per side: `Σ(series) <= total_involvements`. **Binary and corpus-TRUE on 208/208** (delta = printed − Σ ∈ {0,1,2,3,4,5}, exact on 59, mean 1.26, **never negative**). Ship the bound, not an equality: equality is corpus-false on 149/208 and manufacturing it would be exactly the fake reconciliation Stories 1.8 and 1.12 refused. Record the observed delta in `specifics` on every report so the gap stays visible rather than being absorbed.
  - [ ] 5.7 `set-plays-corner-sides` — **AC 2's named check.** Per side: `Σ(left over the three delivery types) + Σ(right) == total_corners`, EXACT. **Verified 208/208.** Also assert per row that `total == left + right` (208/208).
  - [ ] 5.8 `set-plays-totals` — per side, all EXACT and all verified 208/208: `total_free_kicks + total_penalties + total_corners + total_throw_ins == total_set_plays`; `direct + indirect == total_free_kicks`; `Σ(delivery-type row totals) == total_corners`. **Do NOT check `Σ(delivery style) == total_corners`** — corpus-false on 112/208, the style table is not a partition of corners. **Do NOT check `direct == direct_on_target + direct_off_target`** — corpus-false on **208/208** (see §Contract finding).
  - [ ] 5.9 SM-C1 discipline: checks are binary and never loosened. If the corpus contradicts a check, model the finding with evidence — widen only with a documented corpus-derived reason recorded in this story, or let it fail honestly. Every relation shipped above is already corpus-verified at 208/208; a failure in dev means the parser, not the check.

- [ ] Task 6: Wire into the Extraction Record (AC: 1, 2)
  - [ ] 6.1 UPDATE `pipeline/ingest/extract_report.py` (minimal, additive — the highest-contention file; Story 1.13 is in dev and Story 1.8 in review in other sessions, and both have already written into it). Inside the existing `with doc:` block, after `extract_domain_g`, call `extract_domain_e(doc, anchors, match_metadata["lineups"], report_id=...)` and `extract_domain_f(doc, anchors, report_id=...)`; add `domains["goalkeeping"]` and `domains["set_plays"]`; APPEND both check lists to `self_validation["checks"]` **after every existing appender** (never replace the list, never reorder others'); the result re-aggregates via the existing `pipeline.extract.aggregate_self_validation`. Extend the docstring's error inventory and the "Stories 1.9–1.14 keep plugging into the same two seams" note.
  - [ ] 6.2 Extend the `warnings` list with the documented-absence warnings (AC 4), following the 1.12/1.13 pattern already in that file — one warning per report per absence, never a non-`"pass"` check (the strictly binary aggregator would read that as a failure).
  - [ ] 6.3 Keep authoring bugs OUT of per-report guards (the 1.2/1.4 rule): column/label constants are module constants whose integrity fails the run loudly at import, as `domain_g._assert_column_integrity` does — not as 104 identical per-report failures blaming the corpus.
  - [ ] 6.4 Purity: no new probe/cover parsing, no corpus-level facts, no timestamps. The payloads come only from this report's own anchored pages plus the Domain A lineups already in the record.

- [ ] Task 7: Register FR-15 gate checks (AC: 3)
  - [ ] 7.1 UPDATE `pipeline/validate/checks.py` (append-only; `runner`/`sample`/`deviations`/`verify` MUST NOT change — the seam is guaranteed by `test_runner.py::test_a_newly_registered_check_flows_into_the_report`). Register **four** ids: `goalkeeping-completeness`, `goalkeeping-counts`, `set-plays-completeness`, `set-plays-counts`, mirroring the Domain B/C/G pairs exactly: a one-slot payload memo per domain (same shape and justification as `_domain_g_memo`; **copy the pattern, do not refactor the runner** — the runner-owned-handoff item is ledgered), missing-anchor → return `None` (anchor-coverage's finding, never double-reported), `applies_to=lambda meta: True`. E/F anchors already flow through the existing `anchor-coverage` check — do not add anchor coverage.
  - [ ] 7.2 Domain E's gate check needs Domain A's `lineups` for the goalkeeper list — reuse the existing `_domain_a_payload` memo, never a second parse. If it raises, skip only the parts that need it and run the rest (a Domain A failure is `domain-a-*`'s finding; re-reporting it under `goalkeeping-*` is the double-attribution the 1.6 review patched out). Document the skip in the check's docstring, as 1.7 and 1.10 did.
  - [ ] 7.3 Closed deviation-category mapping (never a fifth category): parse/typing/completeness failures (`GoalkeepingPageParseError`, `SetPlaysParseError`, `InvolvementChartError`, `MalformedFieldError`, `MissingFieldError`) → `probe-failure` with the typed class name prefixed in specifics (the 1.6 review patch pattern); an off-palette distribution marker → `unknown-rgb`; failed recorded consistency checks → `count-mismatch`; anchors → the existing `anchor-coverage` `missing-anchor`.
  - [ ] 7.4 Catch breadth: the completeness checks catch `ExtractError` for their own findings but let a `ProbeError`/other `PipelineError` propagate ONCE to the runner; the counts checks swallow `PipelineError` and run only over a successful payload.
  - [ ] 7.5 **Known forced test repair (the ONE pre-existing test your registration necessarily breaks):** `pipeline/tests/test_runner.py::test_checks_run_are_recorded` hardcodes the exact sorted `checks_run` list — insert `goalkeeping-completeness`, `goalkeeping-counts` after `domain-g-counts`, and `set-plays-completeness`, `set-plays-counts` after `receiving-parse`. Document the repair per the 1.7/1.10 Completion-Notes pattern.
  - [ ] 7.6 **Do NOT claim the id `offers-count-match`** — `test_checks_registry.py` uses it as its deliberately-unclaimed placeholder, and claiming it breaks that test (the same trap 1.12 moved there and 1.13 was warned about). The four ids above are collision-free.

- [ ] Task 8: Tests (all ACs)
  - [ ] 8.1 **CRITICAL REGRESSION GUARD:** `extract_report` will now run both parsers on EVERY report, so every existing synthetic report must carry nine parseable E/F pages or the whole ingest suite goes red — exactly what happened when 1.3, 1.6, 1.7 and 1.10 landed. UPDATE `pipeline/tests/conftest.py` **additively**, following the 1.7/1.10 precedent: module-level draw helpers (`draw_gk_involvement_page`, `draw_gk_distribution_page`, `draw_goal_prevention_page`, `draw_aerial_control_page`, `draw_set_plays_page`) + new `make_report` anchor special-cases beside the existing ones. **The anchor loop matches RESOLVED ids**, so per-team branches must use the suffixed forms — the nine exact ids: `gk-involvement` (bare — this spec is NOT `per_team`), `gk-distribution:home`, `gk-distribution:away`, `goal-prevention:home`, `goal-prevention:away`, `aerial-control:home`, `aerial-control:away`, `set-plays:home`, `set-plays:away`. A bare-id branch for a per-team spec never fires, and a suffixed branch for `gk-involvement` never fires — both leave a generic anchor-text-only page that fails the whole suite undiagnosably. Do not edit existing helper bodies.
  - [ ] 8.2 The synthetic defaults must satisfy **every** relation in Task 5 by construction — the distribution panel sums and printed centres, the goal-prevention five-type sum, the aerial delivery sum, the involvement bound, and all four set-play relations. `pipeline/tests/test_ingest_batch.py` asserts **exactly one** self-validation failure on the deliberate-mismatch fixtures, so any new check that fails on the defaults breaks that test. Derive the defaults from existing constants rather than inventing free numbers.
  - [ ] 8.3 NEW test files, per-module convention: `pipeline/tests/test_extract_domain_e.py`, `pipeline/tests/test_extract_domain_f.py`, `pipeline/tests/test_extract_report_domains_ef.py`. Cover: full parse of all five synthetic families; every typed failure path on doctored pages (anchor resolving to two pages; a missing KPI label; a corners row with the wrong integer count; a non-numeric token; an off-palette distribution marker → `UnknownRgbError`; a panel count other than four → `PitchFrameError`; a non-integral involvement slot → `InvolvementChartError`); **the two-goalkeeper case parses clean with two names and no finding** (AC 1's re-scope — pin it, it is the single easiest thing to get wrong); each recorded check's pass and fail branches; the checks land in the right deviation categories under `clean_registry` (a **local** fixture in `test_checks_registry.py`/`test_runner.py`, NOT a conftest fixture — copy the local pattern); determinism (byte-identical `read_bytes()` on re-extract).
  - [ ] 8.4 Real-PDF ground truth against `spike/mex_rsa.pdf` (the fixture skips locally if absent, fails under CI). `spike/mex_rsa.pdf` **is** the M01 report, so the expected values in Dev Notes §Raw page layout are ground truth: Mexico set plays `total_set_plays 36`, `total_free_kicks 12`, `total_penalties 0`, `total_corners 3`, `total_throw_ins 21`; free kicks `direct 11 / on-target 0 / off-target 0 / indirect 1`; corners by delivery type `direct-to-area 3/0/3`, `short 0/0/0`, `edge 0/0/0`; by style `inswing 1, outswing 2, driven 0, lofted 0`. Mexico goal prevention table `3 · 3 · 2 · 0 · 0 · 0 · 1`, KPIs `3` and `100`. Mexico aerial `total_interventions 1`, claims complete 0 / claims 1 / incomplete 0, delivery types faced `8 · 1 · 5 · 0 · 2 · 0 · 0`. Mexico distribution `feet 26 complete / 4 incomplete = 30`, `hands 0/0 = 0`, `throw 3/0 = 3`, `total 29/4 = 33`, line breaks `13`. Mexico involvement `total_involvements 37` with `Σ(series) == 37` (this report's home chart is one of the 59 exact ones); South Africa `total_involvements 67` with `Σ(series) == 64` — **assert the delta of 3, it is the honest corpus behaviour** and the regression guard for §Open question. Derive counts from the parsed payload, never hardcode magic numbers where a relation will do (1.6/1.7/1.10 review rule).
  - [ ] 8.5 Full suite green. **Re-baseline with a fresh `pytest` run before starting** — Story 1.13 is in dev and Story 1.8 in review in other sessions, and between them they are actively changing `pipeline/extract/`, `pipeline/markers/` and `conftest.py`. Do not trust a suite count quoted in any earlier story. Keep every pre-existing test passing unmodified except the one named forced repair (Task 7.5); any other repair to another story's test needs a documented cross-domain-composition reason.

- [ ] Task 9: Acceptance runs + record keeping (AC: 1, 2, 3, 4)
  - [ ] 9.1 Full batch: `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104` (the new modules change `code_version` → all 104 re-extract, ~2 min; no `--force` needed). **The clean-run baseline from Story 1.12 onward is `104 extracted / 0 failed / exactly 2 self-validation failures` (PMSR-M19-ARG-V-ALG and PMSR-M58-TUN-V-NED), and the run exits 1 by design.** Assert that baseline — never a zero exit code (ruled in the 1-12 review, sprint-status 2026-07-26).
  - [ ] 9.2 Gate re-run: `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`. The four new check ids appear in `checks_run`; E/F anchors and consistency checks appear in the deviation summary (AC 3); two consecutive gate runs identical apart from `run_timestamp`.
  - [ ] 9.3 Update `pipeline/README.md` (append: the two new record blocks, the four gate checks, the seven recorded checks, and the documented absences). Record the corpus evidence for every relation you ship in the Dev Agent Record — reviews cross-check every claim against the suite and have caught false ones twice.
  - [ ] 9.4 File AD-14 notes in `deferred-work.md` for what this story actually establishes. `/contract` stays **READ-ONLY**: Story 1.8's bump to `schemaVersion: 2` has already landed in the working tree and is under review, so the contract is neither yours to extend nor yours to ride. Every finding below is a **ledger filing for a future change-set**, not an edit. Four are already earned by the probe and need no new investigation:
    - **(a) `GoalkeeperRecord` is per-keeper; the source is per-team.** `teamId`/`playerId`/`playerName` and the whole per-goalkeeper shape are unfulfillable — no goalkeeping page names a keeper, and 7/208 team-innings used two. 1.16 emission needs an AD-14 decision. Do NOT ride Story 1.8's v2 bump, and do not open a v3.
    - **(b) `FreeKickCounts`' nesting `$comment` is corpus-false.** The schema asserts `direct == directOnTarget + directOffTarget` "holds across all six fixture team-innings"; it fails on **208/208** real team-innings (160 of them print `on + off == 0` while `direct > 0`). The `$comment` is wrong and a stacked chart built on it would be wrong; `direct + indirect == totalFreeKicks` **is** true 208/208.
    - **(c) The three documented absences** (AC 4) and their contract consequences: `GoalkeeperDistribution.feetTechniques`/`handsTechniques`/`throwTechniques`, `GoalPrevention.byBodyType`, `AerialControl.crossesFacedCompleted`.
    - **(d) Re-scope notice for Story 2.10**, whose AC reads "each goalkeeper's involvement, distribution, goal prevention, and aerial control summary displays" — that surface is per-team, not per-keeper.
    Do not invent notes beyond what you find.

## Dev Notes

### Mental model (read this first)

Story 1.6 established `pipeline/extract/` and the per-domain extractor convention; 1.7 was its first copy, 1.10 its third, 1.8 its fourth (and the first chart). **You are the convention's fifth instance, not its author** — pattern-match `domain_g.py` / `domain_b.py` / `checks.py` deliberately; reviewers will diff you against them.

What is genuinely different here:

- **Domain F is the easiest tabular page in the corpus.** Fully in the text layer, invariant at 24 numeric words and 14 structural labels on 208/208, with four independent arithmetic relations all true 208/208. Write it first — it de-risks the record seam and the gate registration before you touch anything hard.
- **Domain E is four different extraction problems wearing one domain's name.** One tabular page (goal prevention), one half-tabular page (aerial control), one **map** page (distribution — the shared marker chain), and one **chart** page (involvement — Story 1.8's momentum problem again). Budget accordingly.
- **The epic's AC 1 is wrong about the shape of the data**, and Juan re-ruled it at story creation. Read §The premise is wrong before writing a line.

### The premise is wrong — Domain E is per TEAM (binding)

The story-creation probe (2026-07-27, all 104 reports) overturned the epic's premise, exactly as 1.13's did:

| Epic assumption | Corpus reality |
| --- | --- |
| "every goalkeeper with minutes has a record" | **No goalkeeping page names a goalkeeper.** All four families are titled `{team}`; the involvement page prints `"{team} GK Involvement Timeline"` and a team `Total Involvements`. |
| one goalkeeper per team-inning | **7 of 208 used two** — and their pages still print one team-level block each. Verified on `PMSR-M53-CZE-V-MEX` away (Mexico, RANGEL off 78' / OCHOA on 78'): one chart, one total, no name. |
| Domain E is tabular | one table page, one half-table page, one **map** page, one **chart** page |

Ruled resolution (Juan, 2026-07-27): **re-scope inside the story**, per the 1.13 precedent — stage per team, carry the Domain A goalkeeper list beside the block so the attribution question is *recorded*, and file the AD-14 consequences (Task 9.4). Do not infer a keeper, not even on the 201 unambiguous innings: a shape that varies between reports is worse than one that is honestly team-level everywhere.

### Documented absences (AC 4) — stage `null` + one warning, never a check

Three contracted values are **not extractable** from the source pages. Each is the 1.12/1.13 documented-absence branch: `null` in the payload, one per-report warning naming it, and **no** self-validation check.

| Absent value | Why | Evidence |
| --- | --- | --- |
| Distribution **technique** breakdowns — `feetTechniques` (6), `handsTechniques` (3), `throwTechniques` (4) | The donut **slice** labels are inside raster images; only the donut **centre** total is in the text layer. Identical to 1.13's movement-donut finding. | Exactly **4** real numbers print on every distribution page (three panel totals + line breaks) on 208/208; 4–9 raster images per page carry the rest |
| Goal prevention **`byBodyType`** (head/hands/upper/lower/feet) | Same — the Intervention Body Type donut's slice values are raster; its centre is in text but is untrustworthy (§Task 3.5) | 208/208 |
| Aerial **`crossesFacedCompleted`** | The page prints `Delivery Types Faced` totals (= attempted) and draws the completed/attempted split only as marker colour on the Crosses Faced panel. Recoverable in principle by marker counting, but the panel is a *goal-mouth* crop, not a full pitch, and no printed counterpart exists to validate against — so it is out of scope here rather than guessed. | 208/208 |

Do **not** widen scope to chase these. Do **not** manufacture a check that silently passes because the value is `null`.

### Contract finding — `FreeKickCounts` is corpus-false (do not build on it)

`contract/match-bundle.schema.json`'s `FreeKickCounts` description states the four values are nested, with `direct == directOnTarget + directOffTarget`, "holds across all six fixture team-innings". Over the real corpus it is **false on 208 of 208 team-innings**; on 160 of them `directOnTarget + directOffTarget == 0` while `direct > 0`. The true relation is `direct + indirect == totalFreeKicks` (208/208). Stage all four printed values verbatim, check only the true relation, and file the finding (Task 9.4b). `/contract` stays read-only in this story.

### Corpus sweep results — pinned facts (story-creation sweep, 2026-07-27, all 104 reports)

Reproducible from `pmsr-corpus/` plus `work/extracted/*.json`. These are the facts the parsers may rely on; each is also the thing to assert loudly rather than assume.

**Structure**

| Fact | Evidence |
| --- | --- |
| Every E/F anchor resolves to **exactly one page** | `gk-involvement` 104/104; the other four families 208/208 each — 936 pages, 0 multi-page, 0 missing |
| `gk-involvement` is **one page for both teams**, not per-team | 2 `Total Involvements` label rows + 2 charts on 104/104 |
| `detect_pitch_frames` finds exactly **4** panels on every distribution page | 208/208, every panel **59,516.0 pt²** — equal-area, so `detect_pitch_frame`'s `max()` is unusable (the 1.12 lesson) |
| Distribution dots are **5.83 pt** filled circles, white stroke, two fills | `(0.18,0.30,1.00)` complete / `(1.00,0.00,0.00)` incomplete |
| Every distribution panel frame ends at **`y1 = 406.5`**, the legend swatches sit at y ≈ 411 | 832/832 panels — strict containment (`pitch_margin_pt=0.0`) excludes the legend by geometry; **0 off-palette markers admitted on 208/208** |
| Involvement dots are **3.0 pt** | 21,764 of 21,764 corpus dots |
| Set-plays pages carry exactly **24 numeric words** and all 14 structural labels | 208/208 |
| Goal-prevention 7-column table found by header-anchor + `x >= 460` | 208/208 (naive "a row of 7 digits" finds 0 on `M38` home and 2 on `M34`/`M38` away) |
| Goalkeepers with minutes per team-inning | **1 on 201, 2 on 7** (M21, M41, M53, M62, M66, M88, M98) |

**Relations — every one below is EXACT and true on 208/208 team-innings**

| Relation | Ship as |
| --- | --- |
| `feet.total + hands.total + throw.total == total.total` | `goalkeeping-distribution-sum` (AC 1) |
| panel marker count `==` printed donut centre | `goalkeeping-distribution-printed` |
| `Σ(5 intervention types) == attempts_faced` | `goalkeeping-goal-prevention-sum` |
| KPI attempts-faced `==` table attempts-faced | fold into the same check |
| `Σ(6 delivery types) == delivery_types_faced.total` | `goalkeeping-aerial-sum` |
| `Σleft + Σright == total_corners` | `set-plays-corner-sides` (AC 2) |
| per row, `total == left + right` | fold into the same check |
| `FK + PEN + COR + THR == total_set_plays` | `set-plays-totals` |
| `direct + indirect == total_free_kicks` | fold into the same check |
| `Σ(delivery-type row totals) == total_corners` | fold into the same check |
| `Σ(involvement series) <= total_involvements` | `goalkeeping-involvement-bound` |

**Relations that are corpus-FALSE — do NOT ship them as checks**

| Tempting relation | Reality |
| --- | --- |
| `direct == direct_on_target + direct_off_target` | false **208/208** (contract `$comment` is wrong — Task 9.4b) |
| `Σ(corner delivery style) == total_corners` | false on **112/208** — the style table is not a partition |
| `Σ(5 intervention types) == total_interventions` | false on **207/208** (different denominators, as the contract itself notes) |
| `total_interventions == attempts_faced − no_save_attempt` | false on **183/208** |
| `Σ(involvement series) == total_involvements` | false on **149/208** — ship the bound, not the equality |
| donut centre `==` anything on the goal-prevention page | `M01` prints centre `4` against a table of `3` |

### Open question left to dev — the involvement slot → match-clock mapping

The series is extractable and its values are integral; what is **not** settled is what each slot means and why the sum falls short of the printed total.

- Slots per chart vary per report: **95–111** regulation, **129–145** extra-time (the same per-report span behaviour Story 1.8 measured for momentum: 94–113 / 131–144). Never hard-code 100.
- The x-tick labels (`0 5 … 45 HT 50 … 90 90+5`) are the only key to the mapping, and — as in 1.8 — everything after half time shifts by that report's stoppage allotment.
- `printed total − Σ(series)` ∈ **{0,1,2,3,4,5}**, exact on 59/208, mean 1.26, and **never negative**. The chart consistently plots *fewer* involvements than the KPI counts. Cause unresolved: not axis clipping (the plotted maximum equals the axis top label exactly), not lost dots (dot count == slot count).
- Do **not** resolve this by making the numbers agree. Ship the bound (Task 5.6), record the delta in `specifics`, and report what you find. If you *do* resolve it, say so with evidence and the check can tighten.

The naive value fit carries a constant **−0.117** offset (the value-0 dot centre sits slightly above the `0` label's centre); rounding absorbs it, but derive the baseline from the label geometry properly rather than relying on that.

### Raw page layout — verified verbatim on spike/mex_rsa.pdf (= PMSR-M01)

All pages are landscape 960×540 with the same furniture: date/venue/kickoff strip (y≈13), section title at x=12, team name at x≈799. Page indices on the reference report: `gk-involvement` **30**; `gk-distribution` **31**/**32**; `goal-prevention` **33**/**34**; `aerial-control` **35**/**36**; `set-plays` **38**/**39**.

**Set Plays** (`Set Plays {team}`) — joined row text, Mexico:

```
y= 113.34 '36 Delivery Type From Left Side Total'   <- 36 = Total Set Plays (KPI x=228)
y= 140.34 'Direct to Area 3 0 3'                    <- left x=765, right x=837, total x=909
y= 151.79 'Total Set Plays'
y= 165.09 'Short 0 0 0'
y= 189.84 'Edge of Penalty Area 0 0 0'
y= 217.53 '12 0'                                    <- Total Free Kicks x=113 | Total Penalties x=347
y= 253.79 'Total Free Kicks Total Penalties'
y= 262.59 'Inswing 1'                               <- style values x=909
y= 287.34 'Outswing 2'
y= 312.09 'Driven 0'
y= 319.53 '3 21'                                    <- Total Corners x=117 | Total Throw Ins x=344
y= 336.84 'Lofted 0'
y= 355.79 'Total Corners Total Throw Ins'
y= 436.59 'Direct 11'                               <- free-kick values x=422
y= 461.34 'Direct (on target) 0'
y= 486.09 'Direct (off target) 0'
y= 510.84 'Indirect 1'
```

**Goal Prevention** (`Goal Prevention {team}`) — Mexico; note the header spans are per-glyph and the value row is the one below it:

```
y= 447.18 '3'@114  '100'@318      <- Total Attempts on Goal Faced | Save % (no '%' sign)
y= 481.45 (header, per-glyph: 'Total Attempts on Goal Faced' … 'No Save Attempt')
y= 508.59 '3'@508 '3'@604 '2'@675 '0'@733 '0'@793 '0'@850 '1'@911
```

**Aerial Control** (`Aerial Control {team}`) — Mexico: `Total Interventions 1`; Punches `0 / 0 / 0`, Claims `0 / 1 / 0`, Tipped/Palmed `0 / 0 / 0` (complete / type total / incomplete); `Delivery Types Faced` = Total `8`, In Swing `1`, Out Swing `5`, Driven `0`, Lofted `2`, Cutback `0`, Push `0`.

**Goalkeeping Distribution** (`Goalkeeping Distribution {team}`) — four panels left→right `Kick from Feet` / `Kick from Hands` / `Throw Distribution` / `Total Distributions`, panel band y≈100–410, panel titles at y≈96, `Complete`/`Incomplete` legend at y≈411, donut centres and `Goalkeeper Line Breaks` below. Mexico: printed centres `30` / `0` / `3`, line breaks `13`; marker counts `26+4` / `0+0` / `3+0`, total panel `29+4=33`.

**Goalkeeping Involvement** (`Goalkeeping Involvement {home}`) — one page, home chart on top. Mexico: y-axis labels `4 3 2 1 0` at x≈25 (y 171.44 → 233.20, unit 15.4403), 100 dots at x spacing 7.25, `Total Involvements 37` at x≈852. South Africa: same axis, 100 dots, printed `67`, Σ(series) `64`.

### Extraction Record — current real shape and your addition

```
domains: {match_metadata, shots, key_statistics, tactical_identity, crosses,
          defensive_actions, player_stats, momentum, receiving}
self_validation: {result, checks: [shots, link-rate, A, B, C, crosses,
                                   defensive-actions, G, momentum, receiving]}
```

Add (snake_case, internal staging — no `/contract` dependency; the contract's `GoalkeepingBlock`/`SetPlaysBlock` are the emit-time checklist for Story 1.16 only):

```
domains["goalkeeping"] = {
  "home": {
    "goalkeepers": [                       # from Domain A; 1 entry on 201 innings, 2 on 7
      {"name": str, "shirt_number": int,
       "substituted_on": {...}|None, "substituted_off": {...}|None},
    ],
    "total_involvements": int,
    "involvement_series": [int, ...],      # one non-negative int per plotted slot
    "distribution": {
      "feet":  {"complete": int, "incomplete": int, "total": int, "printed_total": int},
      "hands": {...}, "throw": {...}, "total": {...},
      "line_breaks": int,
      "feet_techniques": None,             # AC 4 documented absence (raster-only)
      "hands_techniques": None,
      "throw_techniques": None,
    },
    "goal_prevention": {
      "attempts_faced": int, "save_percentage": float, "total_interventions": int,
      "by_intervention_type": {"save_and_retain", "deflect_and_retain",
                               "save_and_deflect", "save_attempt", "no_save_attempt"},
      "by_body_type": None,                # AC 4 documented absence (raster-only)
    },
    "aerial_control": {
      "total_interventions": int,
      "punches": {"complete": int, "incomplete": int, "total": int},
      "claims": {...}, "tipped_palmed": {...},
      "crosses_faced_attempted": int,
      "crosses_faced_completed": None,     # AC 4 documented absence
      "delivery_types_faced": {"inswing","outswing","driven","lofted",
                               "cutback","push_cross","total"},
    },
  },
  "away": { ... },
}

domains["set_plays"] = {
  "home": {
    "total_set_plays": int, "total_free_kicks": int, "total_penalties": int,
    "total_corners": int, "total_throw_ins": int,
    "free_kicks": {"direct", "direct_on_target", "direct_off_target", "indirect"},
    "corners_by_delivery_type": {
      "direct_to_area":      {"left": int, "right": int, "total": int},
      "short":               {...},
      "edge_of_penalty_area":{...}},
    "corners_by_delivery_style": {"inswing", "outswing", "driven", "lofted"},
  },
  "away": { ... },
}
```

All keys are snake_case, so 1.2's `test_ingest_record.py::test_record_keys_are_snake_case` walk passes unmodified. If you find you need a repair there, your key naming is wrong, not the test.

### What already exists — do NOT rebuild

- **Anchors:** `pipeline/discover/anchors.py::ANCHOR_REGISTRY` already carries all five E/F specs — `gk-involvement` (**not** `per_team`), `gk-distribution`, `goal-prevention`, `aerial-control`, `set-plays` (the last four `per_team=True`). **No new `AnchorSpec`; do not touch that file** (it is a shared-contention file and adding to it widens the gate for every story).
- **Visual-row reconstruction:** `pipeline/extract/lines.py` (`TextSpan`, `VisualRow`, `text_spans`, `group_rows`, `join_spans`) — x-preserving. Reuse; do not adapt `probe.py`. Note `group_rows`' docstring warning about pre-filtering spans, and `domain_g._parse_family_page`'s header-`y` bounding technique — Task 3.3 is the same trick.
- **Shared marker chain (read-only):** `pipeline/markers/filter_chain.py` — `detect_pitch_frames` (the plural accessor Story 1.12 added for exactly this equal-area-panel case), `MarkerSpec`, `collect_candidate_markers`, `key_outcomes`, and the typed `PitchFrameError`/`UnknownRgbError`. **Instantiate a `MarkerSpec`; do not edit the chain** (§Coordination).
- **Record seam:** `pipeline/ingest/extract_report.py` — `domains` dict + `self_validation["checks"]` append + `pipeline.extract.aggregate_self_validation`, plus the `warnings.extend(...)` documented-absence pattern already used by 1.12/1.8/1.13.
- **Check-entry seam:** `pipeline.extract.check_entry` — the package-level helper extracted by Story 1.8 precisely so no story imports a sibling domain. Import from `pipeline.extract`.
- **Gate seam:** `pipeline/validate/checks.py` — `Check(check_id, applies_to, run)`, `register_check` (duplicate ids raise), the closed four-value `DeviationCategory`, the per-domain one-slot memo pattern, missing-anchor → `None`, `_failed_check_deviations`.
- **Typed-error house:** `pipeline/extract/errors.py` — `ExtractError(PipelineError)` base and thirteen siblings. Append yours beside them.
- **Test scaffolding:** `conftest.py::make_report` (cover, lineups, shots + attempts, Key Statistics, Phases, line-height, crosses, defensive actions, Domain G ×8, momentum, receiving); `clean_registry` (local fixture pattern, not conftest); `mex_rsa_pdf` fixture; the byte-identity assert pattern on `read_bytes()`.
- **Idempotence:** `code_version` fingerprints `pipeline/**/*.py`; your new modules auto-invalidate all 104 staged records (cold re-run ~2 min, no `--force`).

### Normalization & typing rules (AC 1, AC 2 — normative)

- Raw and locale-neutral (AD-7): plain ints/floats, no `%`/`m` strings, no formatting, no display strings. Units are locale-layer metadata keyed by metric code.
- Counts → `int`; a decimal where an int is expected is `MalformedFieldError`, not a rounding opportunity. `save_percentage` → `float` on the 0–100 scale (the page prints it **without** a `%` sign).
- `re.ASCII` on every digit class. Whitespace-normalize joined row text before any label matching (`discover/text.py` discipline; `join_spans` already `normalize()`s).
- Closed label sets, assert-on-unknown (AD-8): a wrong value count, a non-numeric token, a missing label, an unknown panel title — all loud typed failures naming the report, side and the raw text. Never fuzzy-match, never default, never skip a row.
- No marker dedup anywhere (AD-8): two distribution markers at the same point are two distributions. The printed donut centre is the arbiter, and it agrees with the undeduped count.
- Contract precision (emit-time reference — do **not** round in staging): `Count` integer, `Percentage` 1 decimal.

### Failure & validation policy (AD-8, binding)

- Per-report failures abort **that report**, never the batch; the manifest is the record of truth. Typed exception per failure class; the batch turns each into a `failed` entry.
- The payload is all-or-nothing per domain: no partial goalkeeping or set-plays block ever stages.
- Recorded consistency checks are **data, not exceptions** — a failed check still stages the record so the gate can localize it. Raised errors are for structure the parser cannot read; checks are for numbers that disagree.
- Self-Validation is binary and never loosened (SM-C1). Every relation in §Corpus sweep results is already true 208/208.
- Documented absences travel as `null` + a per-report **warning**, never as a non-`"pass"` check — the aggregator treats anything but the literal `"pass"` as a failure.

### Coordination — three sessions are in flight (binding)

| Area | Owner right now | Your rule |
| --- | --- | --- |
| `/contract` + `contract/generated/` | **Story 1.8** — bump to `schemaVersion: 2` already applied, story in **review** | **Do not touch.** Read the schemas for field names only (the v2 diff touched the momentum defs alone; every E/F shape this story cites is unchanged). File findings in `deferred-work.md`; do not ride the v2 bump, do not open a v3. |
| `pipeline/markers/*` | **Story 1.13** (receiving parsers, in-progress) | Read `filter_chain.py`; **edit nothing** under `pipeline/markers/`. Your `MarkerSpec` lives in `pipeline/extract/domain_e.py`. |
| `pipeline/extract/momentum.py` | Story 1.8 (in review) | Do not edit. Read it as the closest precedent for chart extraction — it is the same problem your involvement timeline solves. |
| `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py` | shared, append-only | Additive edits only, appended after every existing appender; never reorder or replace another story's entries. Re-read the file immediately before editing — it may have moved under you. |
| `pipeline/discover/anchors.py` | shared | **No change needed** — all five specs exist. |

Never `git add -A`. Stage only the files this story owns.

### Project Structure Notes

- `pipeline/extract/domain_e.py` and `pipeline/extract/domain_f.py` sit beside `domain_a/b/c/g.py` and `momentum.py`, per the architecture's Structural Seed (`extract/` = "per-domain extractors (tabular A,B,C,E,F,G + spatial D)"). Domain E's distribution panels are marker work done *by* an extractor, not a new member of the `markers/` parser family — the family owns pitch-map **event** parsing with coordinates; this page yields counts only, and its output is a domain block. `momentum.py` is the precedent for vector work living in `extract/`.
- Variance from the epic: AC 1 is re-scoped from per-goalkeeper to per-team, and AC 4 is added for the documented absences. Both are recorded above with corpus evidence and were ruled by Juan at story creation; `epics.md` is left unchanged, and the divergence is carried into `deferred-work.md` by Task 9.4 so 1.16 and 2.10 inherit it.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.9` — lines 378–398 (ACs), Story 2.10 lines 815–836 (downstream consumer)]
- [Source: `_bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md#6` — Domain E and F inventory (normative for coverage)]
- [Source: `.../architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md#AD-7` (raw/locale-neutral), `#AD-8` (fail loud, binary self-validation), `#AD-9` (pure per-report extract; shared filter chain, geometry before colour), `#AD-14` (contract change flow), `#Structural Seed`]
- [Source: `contract/match-bundle.schema.json#/$defs/GoalkeepingBlock`, `#/$defs/GoalPrevention`, `#/$defs/AerialControl`, `#/$defs/SetPlaysBlock`, `#/$defs/TeamSetPlays` — emit-time field checklist for Story 1.16, **not** an import]
- [Source: `contract/README.md` — enum → verbatim source-label maps with page provenance for `FeetDistributionTechnique`, `HandsDistributionTechnique`, `ThrowDistributionTechnique`, `InterventionType`, `InterventionBodyType`, `AerialInterventionType`, `FreeKickType`, `CornerDeliveryType`, `CornerDeliveryStyle`, `PitchSide`]
- [Source: `_bmad-output/implementation-artifacts/1-10-domain-g-extraction-per-player-performance-physical-data.md` — the extractor convention this story copies]
- [Source: `_bmad-output/implementation-artifacts/1-12-defensive-actions-map-parser.md` — equal-area multi-panel frames, title-anchored panel typing, documented-absence branch]
- [Source: `_bmad-output/implementation-artifacts/1-13-offers-movement-to-receive-parsers.md` — raster-only values, in-story re-scope precedent]
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` — 2026-07-26 ruling: the full-corpus batch exits 1 by design; baseline is 104 extracted / 0 failed / exactly 2 self-validation failures]
- Story-creation probe (2026-07-27): all 104 reports; reproducible from `pmsr-corpus/` + `work/extracted/`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

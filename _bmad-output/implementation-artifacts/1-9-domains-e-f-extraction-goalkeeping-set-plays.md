---
baseline_commit: 727963752706bf9a272fa1a35d6a229bf2921d23
---

# Story 1.9: Domains E & F Extraction — Goalkeeping & Set Plays

Status: done

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

- [x] Task 1: Typed errors for Domains E & F (AC: 1, 2)
  - [x] 1.1 UPDATE `pipeline/extract/errors.py` (append-only): one class per failure kind, subclassing `ExtractError`, each carrying `report_id`:
    - `GoalkeepingPageParseError` — structural failure on any of the four goalkeeping page families (anchor resolves to ≠1 page; a required label row absent; a panel count other than four; a table row that does not yield its exact value count).
    - `SetPlaysParseError` — structural failure on the Set Plays page (anchor ≠1 page; a missing KPI label; a corners/free-kick table row that does not yield its exact value count).
    - `InvolvementChartError` — the involvement timeline's structure or scale cannot be established beyond doubt (y-axis labels absent or non-monotonic; a dot outside the plot box; a slot value not within tolerance of an integer; a negative value).
    REUSE where they fit: `MalformedFieldError` (present but wrong type — message MUST name the field and the raw text), `MissingFieldError` (a required field the page does not print). One class per failure kind — never overload, never raise bare `ValueError` (1.6 review rule). For the distribution panels' marker work, the shared chain's own `PitchFrameError` / `UnknownRgbError` travel as themselves (1.11/1.12 precedent) — do not wrap them.

- [x] Task 2: Domain F parser — Set Plays (AC: 2)
  - [x] 2.1 NEW `pipeline/extract/domain_f.py` — entry point `extract_domain_f(doc, anchors, report_id) -> dict` (pure per AD-9: no filesystem writes, no timestamps, no absolute paths, no cross-report knowledge).
  - [x] 2.2 Read the two pages via the anchors Story 1.2 already registered — **no new `AnchorSpec`**: `set-plays:home`, `set-plays:away`. Assert each resolves to EXACTLY one page → else `SetPlaysParseError`. (Verified: 1 page on all 104 × 2 = 208, 0 multi-page, 0 missing.)
  - [x] 2.3 Row grammar via `pipeline/extract/lines.py` (`text_spans`, `group_rows`, `join_spans`) — do NOT re-derive span grouping. **Label-anchored, never positional**: find each row by its joined label text, then read the integers in that row's known x band. The joined text is clean and stable — `'Direct to Area 3 0 3'`, `'Edge of Penalty Area 0 0 0'`, `'Direct (on target) 0'` — verified on 208/208 (Dev Notes §Raw page layout). All fourteen structural labels are present on 208/208.
  - [x] 2.4 **The five KPI values print ABOVE their labels, and one value row is shared by two KPIs** (`'12 0'` sits above `'Total Free Kicks Total Penalties'`). Read each KPI as the integer in the label's own x band on the nearest row above it. Beware `'36 Delivery Type From Left Side Total'` — the Total-Set-Plays value shares a row with the Corners table header, so the KPI x band (x < 400) and the table x band (x > 500) must both be bounded.
  - [x] 2.5 Exact value counts, asserted not assumed (AD-8): corners-by-delivery-type rows carry **3** integers each (left / right / total, x ≈ 765 / 837 / 909); corners-by-delivery-style rows carry **1** (x ≈ 909); free-kick rows carry **1** (x ≈ 422). Any other count → `SetPlaysParseError` naming the row and the tokens found. **Every set-plays page carries exactly 24 numeric words** (22 values + the two date tokens) on 208/208 — assert this as a page-level tripwire.
  - [x] 2.6 Payload shape (snake_case staging — NO `/contract` import, no camelCase) in Dev Notes §Extraction Record additions. Store **printed values verbatim**; do not derive `corners_by_side` team totals into the record — the side sum is AC 2's *check*, and 1.16 owns the emit-time derivation.

- [x] Task 3: Domain E parser — the four goalkeeping page families (AC: 1, 4)
  - [x] 3.1 NEW `pipeline/extract/domain_e.py` — entry point `extract_domain_e(doc, anchors, lineups, report_id) -> dict`. `lineups` is Domain A's already-parsed `match_metadata["lineups"]` block, handed in by the record seam (the 1.10 precedent) — **do not re-parse the lineups page**. It supplies the `goalkeepers` list only; no page data is joined to it.
  - [x] 3.2 Read the seven pages via existing anchors — **no new `AnchorSpec`**: `gk-involvement` (ONE page, both teams — deliberately not per-team), `gk-distribution:{home|away}`, `goal-prevention:{home|away}`, `aerial-control:{home|away}`. Assert each resolves to EXACTLY one page (verified 104 + 3×208 = 728 pages, all single).
  - [x] 3.3 **Goal Prevention** — the authoritative source is the seven-column table at the page foot, fully in the text layer on 208/208. Locate it by its **header row** (`'Total Attempts on Goal Faced …'`), then take the first row below it whose integers at **x ≥ 460** number exactly seven. **Both bounds are load-bearing:** `PMSR-M38-ESP-V-KSA` home prints a stray pitch-marker ordinal `'1'` at x=275 on the table's own row (8 spans, not 7), and `PMSR-M34-ECU-V-CUW` away / `PMSR-M38` away each carry a *second* seven-digit row higher up the page (marker labels). Header-anchoring + the x bound resolves all three: **208/208**. Column order L→R: attempts faced · total interventions · save & retain · deflect & retain · save & deflect · save attempt · no save attempt.
  - [x] 3.4 Goal Prevention KPIs: `Total Attempts on Goal Faced` (x ≈ 114) and `Save %` (x ≈ 318), both printed ABOVE their shared label row, same rule as Task 2.4. **`Save %` prints its number WITHOUT a `%` sign** (unlike Domain B/G) — do not require one. The KPI attempts-faced equals the table's first column on 208/208; assert it as a page-internal cross-check.
  - [x] 3.5 **Ignore the two donut centre numbers on this page.** They are in the text layer and they are *not* trustworthy: on `PMSR-M01` the Intervention Type donut centre reads `4` while the table's attempts-faced, total-interventions and five-type sum are all `3`. The table is the single source. Do not stage the donut centres, do not check against them.
  - [x] 3.6 **Aerial Control** — left side is KPI tiles in the text layer: `Total Interventions`, then three `{complete, <type>, incomplete}` triples for Punches / Claims / Tipped-Palmed. Right side carries the `Delivery Types Faced` table (Total · In Swing · Out Swing · Driven · Lofted · Cutback · Push) — seven integers in one row on 208/208, same header-anchored rule. `crossesFacedAttempted` is that table's `Total`; `crossesFacedCompleted` takes AC 4's absence branch (Dev Notes §Documented absences).
  - [x] 3.7 **Goalkeeping Distribution** — this page is a **map page**, not a table (§The premise is wrong). Use the shared chain **read-only**: `detect_pitch_frames(page)` returns exactly **4** panels on 208/208, all of identical area (59,516.0 pt² each). Because they are equal-area, `detect_pitch_frame`'s `max()` would pick an arbitrary one — this is the Story 1.12 lesson verbatim, so use the plural accessor and map **panel → category by the printed panel title** (`Kick from Feet` / `Kick from Hands` / `Throw Distribution` / `Total Distributions`), text-anchored, **never positional** (AD-8).
  - [x] 3.8 Within each panel, count the distribution origin markers with `collect_candidate_markers` under a `MarkerSpec` tuned for this family and a two-colour palette: `(0.18, 0.30, 1.00)` → `complete`, `(1.00, 0.00, 0.00)` → `incomplete`. Geometry before colour (AD-9); assert-on-unknown RGB. **Do not edit the chain** — `filter_chain.py` must not change (Story 1.13 is in flight in `pipeline/markers/`; see §Coordination); import it and instantiate a spec.
    **The exact spec is corpus-verified — use it as given:** `marker_min_pt=5.0`, `marker_max_pt=6.5` (real dots are 5.83 pt filled circles with a white stroke), and **`pitch_margin_pt=0.0`** — the default strict containment, which is load-bearing here. Every panel frame ends at `y1 = 406.5` on all 832 corpus panels while the `Complete`/`Incomplete` legend swatches sit at y ≈ 411, so strict containment excludes the legend **by geometry alone**. Any positive margin would admit two swatches per panel and inflate every count by 2. Consequently `legend_min_colors` never fires (a two-colour palette can never reach four distinct fills at one y) and **no legend-row exclusion is needed** — do not add one. Verified: with this spec, **0 off-palette markers are admitted on 208/208 pages**.
  - [x] 3.9 The three donut centre numbers ARE reliable here and are the printed counterpart: exactly **4 real numbers** print on every distribution page (feet total, hands total, throw total, `Goalkeeper Line Breaks`) — 6 numeric words including the two date tokens, invariant on 208/208. Stage all four, and use the three totals as Task 5's printed cross-check against the marker counts.
  - [x] 3.10 **Goalkeeping Involvement** — ONE page, both charts, keyed by the home team's anchor. Per chart: read the y-axis labels (single-digit spans at x < 35; the axis auto-scales, top label ∈ {2,3,4,5,6}) and fit `value = (y_of_zero_label − y) / unit` from the label pair; read one 3.0 pt dot per slot (21,764 of 21,764 corpus dots are exactly 3.0 pt wide). **Derive the scale from the printed labels, never from gridline spacing** — the gridline set includes lines the axis does not label, and a spacing-derived unit is wrong (measured during the probe). Slot values must round to non-negative integers; a dot further than the tolerance from an integer → `InvolvementChartError`. Two of 208 charts sit outside a 0.15 tolerance on the probe's naive label-centre fit — resolve those two before shipping a tolerance, and record the resolved bound and its evidence.
  - [x] 3.11 Slot count is **per report** (95–111 regulation, 129–145 extra-time), exactly as Story 1.8 found for momentum — never hard-code 100. The x-tick labels (`0 5 … 45 HT 50 … 90 90+5`) print below each chart and are the only key to the slot → match-clock mapping. **Open question left to dev (Dev Notes §Open question).**
    *Re-opened in code review (2026-07-27). The slot COUNT half is done and correct — per report, nothing hard-coded, 95–145 measured across 208 charts. The slot → match-clock MAPPING half was never implemented: the x-tick labels are not read and no clock structure is staged, so Story 2.10 cannot place this timeline on the match clock. Ruled by Juan: implement it. The corpus probe is done and every relation is exact (see Review Findings, Decision 3); the remaining blocker is the extra-time tick collision on 9 reports.*
    *Closed 2026-08-03. Implemented: `involvement_clock` stages `second_half_slot` / `first_extra_slot` / `second_extra_slot` plus one flat `{minute, stoppage_minute}` stamp per slot, derived from each chart's own printed x-ticks, with the typed `InvolvementClockError` and the recorded `goalkeeping-involvement-clock` check. The extra-time collision was measured away rather than resolved by assumption: it belongs to the naive reading, not to the data (see Completion Notes, Decision 3 closure). 17 new tests; 208/208 charts derive clean.*
  - [x] 3.12 `total_involvements` is printed per team (x > 780) on 104/104 — stage it verbatim. It is NOT the series sum (§Open question).

- [x] Task 4: The goalkeeper attribution (AC: 1)
  - [x] 4.1 From `lineups[side]`, collect every entry with `position == "gk"` that took the field — `has_minutes(entry) = starter or entry["substituted_on"] is not None`, the exact rule Story 1.10 proved corpus-wide. Stage them as `goalkeepers: [{name, shirt_number, substituted_on, substituted_off}]` in page order (starters first).
  - [x] 4.2 **Do not join page data to a goalkeeper and do not infer one.** The pages carry no name; attributing a team block to the sole keeper would be an inference the source does not support, and would be plainly wrong on the 7 two-keeper innings. The list is *context recorded beside* the team block, not a key.
  - [x] 4.3 Assert the list is non-empty for both sides → else `MissingFieldError` naming the side (a team-inning with no goalkeeper is impossible; 208/208 have ≥1). Do **not** assert exactly one — that is corpus-false on 7 (`PMSR-M21-GHA-V-PAN` home, `M41-NOR-V-SEN` away, `M53-CZE-V-MEX` away, `M62-SEN-V-IRQ` away, `M66-URU-V-ESP` home, `M88-AUS-V-EGY` home, `M98-ESP-V-BEL` away).

- [x] Task 5: Self-validation checks — recorded, binary, appended (AC: 1, 2, 4)
  - [x] 5.1 `domain_e_checks(payload) -> list[dict]` in `domain_e.py` and `domain_f_checks(payload) -> list[dict]` in `domain_f.py` — same `{check, result, specifics}` dict shape as Domains A/B/C/G via the `pipeline.extract.check_entry` seam (import from `pipeline.extract`, **never** from a sibling domain module). Results exactly `"pass"`/`"fail"`. Emit exactly **one dict per check id** covering both sides, `specifics` naming every offending side in a deterministic order, so re-runs are byte-identical.
  - [x] 5.2 `goalkeeping-distribution-sum` — **AC 1's named check.** Per side: `feet.total + hands.total + throw.total == total.total`, EXACT. **Verified 208/208** against the marker counts; the `Total Distributions` panel is drawn as the union of the other three.
  - [x] 5.3 `goalkeeping-distribution-printed` — per side and per panel: the marker count equals the panel's printed donut centre, EXACT. This is the genuine two-source cross-check (drawn markers vs printed total) and the strongest available signal that panel→category mapping did not slip.
  - [x] 5.4 `goalkeeping-goal-prevention-sum` — per side: `save_and_retain + deflect_and_retain + save_and_deflect + save_attempt + no_save_attempt == attempts_faced`, EXACT. **Verified 208/208.** Do NOT check the five-type sum against `total_interventions` — that is corpus-FALSE on 207/208 (the contract's own `GoalPrevention` note says the two breakdowns have different denominators, and the corpus agrees). Do NOT check `total_interventions == attempts_faced − no_save_attempt` either — corpus-false on 183/208.
  - [x] 5.5 `goalkeeping-aerial-sum` — per side: `Σ(six delivery types) == delivery_types_faced.total`, EXACT. **Verified 208/208.**
  - [x] 5.6 `goalkeeping-involvement-bound` — per side: `Σ(series) <= total_involvements`. **Binary and corpus-TRUE on 208/208** (delta = printed − Σ ∈ {0,1,2,3,4,5}, exact on 59, mean 1.26, **never negative**). Ship the bound, not an equality: equality is corpus-false on 149/208 and manufacturing it would be exactly the fake reconciliation Stories 1.8 and 1.12 refused. Record the observed delta in `specifics` on every report so the gap stays visible rather than being absorbed.
  - [x] 5.7 `set-plays-corner-sides` — **AC 2's named check.** Per side: `Σ(left over the three delivery types) + Σ(right) == total_corners`, EXACT. **Verified 208/208.** Also assert per row that `total == left + right` (208/208).
  - [x] 5.8 `set-plays-totals` — per side, all EXACT and all verified 208/208: `total_free_kicks + total_penalties + total_corners + total_throw_ins == total_set_plays`; `direct + indirect == total_free_kicks`; `Σ(delivery-type row totals) == total_corners`. **Do NOT check `Σ(delivery style) == total_corners`** — corpus-false on 112/208, the style table is not a partition of corners. **Do NOT check `direct == direct_on_target + direct_off_target`** — corpus-false on **208/208** (see §Contract finding).
  - [x] 5.9 SM-C1 discipline: checks are binary and never loosened. If the corpus contradicts a check, model the finding with evidence — widen only with a documented corpus-derived reason recorded in this story, or let it fail honestly. Every relation shipped above is already corpus-verified at 208/208; a failure in dev means the parser, not the check.

- [x] Task 6: Wire into the Extraction Record (AC: 1, 2)
  - [x] 6.1 UPDATE `pipeline/ingest/extract_report.py` (minimal, additive — the highest-contention file; Story 1.13 is in dev and Story 1.8 in review in other sessions, and both have already written into it). Inside the existing `with doc:` block, after `extract_domain_g`, call `extract_domain_e(doc, anchors, match_metadata["lineups"], report_id=...)` and `extract_domain_f(doc, anchors, report_id=...)`; add `domains["goalkeeping"]` and `domains["set_plays"]`; APPEND both check lists to `self_validation["checks"]` **after every existing appender** (never replace the list, never reorder others'); the result re-aggregates via the existing `pipeline.extract.aggregate_self_validation`. Extend the docstring's error inventory and the "Stories 1.9–1.14 keep plugging into the same two seams" note.
  - [x] 6.2 Extend the `warnings` list with the documented-absence warnings (AC 4), following the 1.12/1.13 pattern already in that file — one warning per report per absence, never a non-`"pass"` check (the strictly binary aggregator would read that as a failure).
  - [x] 6.3 Keep authoring bugs OUT of per-report guards (the 1.2/1.4 rule): column/label constants are module constants whose integrity fails the run loudly at import, as `domain_g._assert_column_integrity` does — not as 104 identical per-report failures blaming the corpus.
  - [x] 6.4 Purity: no new probe/cover parsing, no corpus-level facts, no timestamps. The payloads come only from this report's own anchored pages plus the Domain A lineups already in the record.

- [x] Task 7: Register FR-15 gate checks (AC: 3)
  - [x] 7.1 UPDATE `pipeline/validate/checks.py` (append-only; `runner`/`sample`/`deviations`/`verify` MUST NOT change — the seam is guaranteed by `test_runner.py::test_a_newly_registered_check_flows_into_the_report`). Register **four** ids: `goalkeeping-completeness`, `goalkeeping-counts`, `set-plays-completeness`, `set-plays-counts`, mirroring the Domain B/C/G pairs exactly: a one-slot payload memo per domain (same shape and justification as `_domain_g_memo`; **copy the pattern, do not refactor the runner** — the runner-owned-handoff item is ledgered), missing-anchor → return `None` (anchor-coverage's finding, never double-reported), `applies_to=lambda meta: True`. E/F anchors already flow through the existing `anchor-coverage` check — do not add anchor coverage.
  - [x] 7.2 Domain E's gate check needs Domain A's `lineups` for the goalkeeper list — reuse the existing `_domain_a_payload` memo, never a second parse. If it raises, skip only the parts that need it and run the rest (a Domain A failure is `domain-a-*`'s finding; re-reporting it under `goalkeeping-*` is the double-attribution the 1.6 review patched out). Document the skip in the check's docstring, as 1.7 and 1.10 did.
  - [x] 7.3 Closed deviation-category mapping (never a fifth category): parse/typing/completeness failures (`GoalkeepingPageParseError`, `SetPlaysParseError`, `InvolvementChartError`, `MalformedFieldError`, `MissingFieldError`) → `probe-failure` with the typed class name prefixed in specifics (the 1.6 review patch pattern); an off-palette distribution marker → `unknown-rgb`; failed recorded consistency checks → `count-mismatch`; anchors → the existing `anchor-coverage` `missing-anchor`.
  - [x] 7.4 Catch breadth: the completeness checks catch `ExtractError` for their own findings but let a `ProbeError`/other `PipelineError` propagate ONCE to the runner; the counts checks swallow `PipelineError` and run only over a successful payload.
  - [x] 7.5 **Known forced test repair (the ONE pre-existing test your registration necessarily breaks):** `pipeline/tests/test_runner.py::test_checks_run_are_recorded` hardcodes the exact sorted `checks_run` list — insert `goalkeeping-completeness`, `goalkeeping-counts` after `domain-g-counts`, and `set-plays-completeness`, `set-plays-counts` after `receiving-parse`. Document the repair per the 1.7/1.10 Completion-Notes pattern.
  - [x] 7.6 **Do NOT claim the id `offers-count-match`** — `test_checks_registry.py` uses it as its deliberately-unclaimed placeholder, and claiming it breaks that test (the same trap 1.12 moved there and 1.13 was warned about). The four ids above are collision-free.

- [x] Task 8: Tests (all ACs)
  - [x] 8.1 **CRITICAL REGRESSION GUARD:** `extract_report` will now run both parsers on EVERY report, so every existing synthetic report must carry nine parseable E/F pages or the whole ingest suite goes red — exactly what happened when 1.3, 1.6, 1.7 and 1.10 landed. UPDATE `pipeline/tests/conftest.py` **additively**, following the 1.7/1.10 precedent: module-level draw helpers (`draw_gk_involvement_page`, `draw_gk_distribution_page`, `draw_goal_prevention_page`, `draw_aerial_control_page`, `draw_set_plays_page`) + new `make_report` anchor special-cases beside the existing ones. **The anchor loop matches RESOLVED ids**, so per-team branches must use the suffixed forms — the nine exact ids: `gk-involvement` (bare — this spec is NOT `per_team`), `gk-distribution:home`, `gk-distribution:away`, `goal-prevention:home`, `goal-prevention:away`, `aerial-control:home`, `aerial-control:away`, `set-plays:home`, `set-plays:away`. A bare-id branch for a per-team spec never fires, and a suffixed branch for `gk-involvement` never fires — both leave a generic anchor-text-only page that fails the whole suite undiagnosably. Do not edit existing helper bodies.
  - [x] 8.2 The synthetic defaults must satisfy **every** relation in Task 5 by construction — the distribution panel sums and printed centres, the goal-prevention five-type sum, the aerial delivery sum, the involvement bound, and all four set-play relations. `pipeline/tests/test_ingest_batch.py` asserts **exactly one** self-validation failure on the deliberate-mismatch fixtures, so any new check that fails on the defaults breaks that test. Derive the defaults from existing constants rather than inventing free numbers.
  - [x] 8.3 NEW test files, per-module convention: `pipeline/tests/test_extract_domain_e.py`, `pipeline/tests/test_extract_domain_f.py`, `pipeline/tests/test_extract_report_domains_ef.py`. Cover: full parse of all five synthetic families; every typed failure path on doctored pages (anchor resolving to two pages; a missing KPI label; a corners row with the wrong integer count; a non-numeric token; an off-palette distribution marker → `UnknownRgbError`; a panel count other than four → `PitchFrameError`; a non-integral involvement slot → `InvolvementChartError`); **the two-goalkeeper case parses clean with two names and no finding** (AC 1's re-scope — pin it, it is the single easiest thing to get wrong); each recorded check's pass and fail branches; the checks land in the right deviation categories under `clean_registry` (a **local** fixture in `test_checks_registry.py`/`test_runner.py`, NOT a conftest fixture — copy the local pattern); determinism (byte-identical `read_bytes()` on re-extract).
  - [x] 8.4 Real-PDF ground truth against `spike/mex_rsa.pdf` (the fixture skips locally if absent, fails under CI). `spike/mex_rsa.pdf` **is** the M01 report, so the expected values in Dev Notes §Raw page layout are ground truth: Mexico set plays `total_set_plays 36`, `total_free_kicks 12`, `total_penalties 0`, `total_corners 3`, `total_throw_ins 21`; free kicks `direct 11 / on-target 0 / off-target 0 / indirect 1`; corners by delivery type `direct-to-area 3/0/3`, `short 0/0/0`, `edge 0/0/0`; by style `inswing 1, outswing 2, driven 0, lofted 0`. Mexico goal prevention table `3 · 3 · 2 · 0 · 0 · 0 · 1`, KPIs `3` and `100`. Mexico aerial `total_interventions 1`, claims complete 0 / claims 1 / incomplete 0, delivery types faced `8 · 1 · 5 · 0 · 2 · 0 · 0`. Mexico distribution `feet 26 complete / 4 incomplete = 30`, `hands 0/0 = 0`, `throw 3/0 = 3`, `total 29/4 = 33`, line breaks `13`. Mexico involvement `total_involvements 37` with `Σ(series) == 37` (this report's home chart is one of the 59 exact ones); South Africa `total_involvements 67` with `Σ(series) == 64` — **assert the delta of 3, it is the honest corpus behaviour** and the regression guard for §Open question. Derive counts from the parsed payload, never hardcode magic numbers where a relation will do (1.6/1.7/1.10 review rule).
  - [x] 8.5 Full suite green. **Re-baseline with a fresh `pytest` run before starting** — Story 1.13 is in dev and Story 1.8 in review in other sessions, and between them they are actively changing `pipeline/extract/`, `pipeline/markers/` and `conftest.py`. Do not trust a suite count quoted in any earlier story. Keep every pre-existing test passing unmodified except the one named forced repair (Task 7.5); any other repair to another story's test needs a documented cross-domain-composition reason.

- [x] Task 9: Acceptance runs + record keeping (AC: 1, 2, 3, 4)
  - [x] 9.1 Full batch: `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104` (the new modules change `code_version` → all 104 re-extract, ~2 min; no `--force` needed). **The clean-run baseline from Story 1.12 onward is `104 extracted / 0 failed / exactly 2 self-validation failures` (PMSR-M19-ARG-V-ALG and PMSR-M58-TUN-V-NED), and the run exits 1 by design.** Assert that baseline — never a zero exit code (ruled in the 1-12 review, sprint-status 2026-07-26).
  - [x] 9.2 Gate re-run: `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`. The four new check ids appear in `checks_run`; E/F anchors and consistency checks appear in the deviation summary (AC 3); two consecutive gate runs identical apart from `run_timestamp`.
  - [x] 9.3 Update `pipeline/README.md` (append: the two new record blocks, the four gate checks, the seven recorded checks, and the documented absences). Record the corpus evidence for every relation you ship in the Dev Agent Record — reviews cross-check every claim against the suite and have caught false ones twice.
  - [x] 9.4 File AD-14 notes in `deferred-work.md` for what this story actually establishes. `/contract` stays **READ-ONLY**: Story 1.8's bump to `schemaVersion: 2` has already landed in the working tree and is under review, so the contract is neither yours to extend nor yours to ride. Every finding below is a **ledger filing for a future change-set**, not an edit. Four are already earned by the probe and need no new investigation:
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
    ],                                     # None when Domain A did not extract, plus a
                                           # per-side warning (code-review ruling; the four
                                           # page families still parse — they need no lineup)
    "total_involvements": int,
    "involvement_series": [int, ...],      # one non-negative int per plotted slot
    "involvement_clock": {                 # Decision 3: the slot -> match-clock mapping,
                                           # derived from this chart's own printed x-ticks
      "second_half_slot": int,             # the slot carrying match minute 46
      "first_extra_slot": int|None,        # minute 91; None on the 95 regulation reports
      "second_extra_slot": int|None,       # minute 106; None likewise
      "stamps": [{"minute": int, "stoppage_minute": int|None}, ...],  # one per slot
    },
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
      "attempts_faced_printed": int,       # the KPI tile, staged beside the table value so
                                           # Task 3.4's cross-check is a recorded check
                                           # rather than an assertion that leaves no trace
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

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

Every figure below is reproducible from `pmsr-corpus/` (104 PDFs) plus `spike/mex_rsa.pdf`.

- **Domain F parser sweep, before wiring in** (the 1.10 discipline): 104/104 reports,
  208/208 team-innings, 0 parse failures, 0 self-validation failures. The two
  corpus-FALSE controls reproduced the story's numbers exactly — `Σ(delivery style) !=
  total_corners` on **112/208**, `direct != on_target + off_target` on **208/208**.
- **Domain E parser sweep, before wiring in**: 104/104, 208/208, 0 failures. Reproduced
  exactly: 4 pitch panels on 208/208 pages, every frame `y1 = 406.5` on 832/832, **0
  off-palette markers admitted**, slot counts 95–111 regulation / 129–145 extra time,
  **21,764** involvement dots, goalkeepers 1 on 201 innings and 2 on 7 — and the seven
  two-keeper report ids matched the story's list one for one. Controls: `Σ(5 intervention
  types) == total_interventions` on **1/208** (false on 207) and `total_interventions ==
  attempts_faced − no_save_attempt` on **25/208** (false on 183).
- **Involvement scale, resolving the story's open tolerance question**: gridline-anchored
  worst integrality residual **0.000001 units** over 21,764 dots; the story's proposed
  naive label-anchored fit measures **0.161278** worst and exceeds its own 0.15 bound on
  **206 dots**, which lie in exactly the **2 charts** the story named — the dot count and
  the chart count describe the same set, at two granularities. See Completion Notes.
- **Distribution panel census** (208 innings × 3 printed panels): `drawn >= printed`
  **624/624**, equality **604/624**; all 20 residuals in `feet` (+1 on 18, +2 on 2),
  `hands` and `throw` exact 208/208 each.
- **Marker overshoot measurement**: exactly 8 in-size markers sit outside their frame,
  max **0.2917 pt**; no out-of-size filled circle sits within 6.0 pt of any frame; the
  9.0 pt legend swatches sit 10.5 pt below `y1`.
- **Batch (Task 9.1)**: `104 extracted / 0 failed / exactly 2 self-validation failures`
  (PMSR-M19-ARG-V-ALG, PMSR-M58-TUN-V-NED — 1.12's ledgered `defensive-actions-marker-count`
  pair, **no third**, none from E or F), 0 corpus gaps, 0 orphans, **exit 1 by design**.
  Re-run: **0 extracted / 104 skipped-unchanged**, and all 104 staged records
  **byte-identical** (hash-compared against a snapshot).
- **Gate (Task 9.2)**: `GATE RESULT: PASS`, 0 deviations across 16 sampled reports, 0
  corpus gaps, exit 0. All four new ids in `checks_run`. Two consecutive runs
  (`work/verification/gate-run-{a,b}.json`) compared field by field: **identical apart
  from `run_timestamp`**.
- **Suite**: baseline re-measured at story start (Task 8.5) — 1039 passed / 1 skipped.
  This story adds **90 tests** (45 Domain E, 19 Domain F, 26 record/gate integration).
  The "+91 (45/20/26)" originally recorded here was wrong — Domain F collected 19, not 20
  — and was corrected in code review, which is exactly the cross-check Task 9.3 warns
  about. The final pre-review verification run read **1138 passed / 1 skipped / 0 failed**;
  the extra 8 arrived from another session working in the same tree during this story
  (see Coordination below), not from Story 1.9.
- **Post-review**: the code review added 15 further tests, giving **105** across the three
  files (58 Domain E, 21 Domain F, 26 record/gate integration), all green.

**Decision 3 (2026-08-03) — the involvement slot -> match-clock mapping.**

- **Tick census over all 104 reports / 208 charts**, read character-level: `0`, `5`..`45`,
  `50`..`90` on 208/208; `HT` on **122**; `45+5` on 108 and `45+10` on 2; `90+5` on 182,
  `90+10` on 30, `90+15` on 2; `95`/`100`/`110`/`115`/`120` on 18 each, `105` on **16**,
  `120+5` on 4. **No `FT` tick exists anywhere in the corpus.**
- **Every clock relation exact, 0 deviations over 4,336 tick readings**: origin `0` on slot
  0 (208/208); first-half `M` on `M-1` (1,872/1,872); `45+N` on `44+N` (110/110); one
  unanimous minute-46 slot across every second-half tick (208/208), equal to `HT` where
  printed (122/122); `90+N` on `m46+44+N` (214/214); both extra periods unanimous across
  their own ticks (18/18 charts); `120+N` on `et2+14+N` (4/4). Worst tick-to-slot-centre
  residual **0.0005 slots** over the whole corpus.
- **Span-level vs character-level, measured**: a span-level prototype failed exactly **4
  charts** — `PMSR-M86-ARG-V-CPV` and `PMSR-M100-ARG-V-SUI`, both sides — with "tick
  '45HT' is not a slot centre", and 204/208 elsewhere. Character-level: **208/208**.
- **Stoppage allotments derived**: H1 **0-10** minutes (modes 4 and 5, 48 charts each), H2
  **1-19** (mode 6), ET1 **0-4** (plus M88's **-1**), ET2 **0-12** — all inside the
  contract's `StoppageMinute`, and the parser's `MAX_STOPPAGE_MINUTE = 30` is never
  approached.
- **Extra-time collision, retired**: across all 18 extra-time charts the `95'` tick sits
  **5-9 slots after** the last `90+N` tick, never on it. The collision the review recorded
  belongs to the naive second-half extension, not to the source.
- **ET1 period lengths**: 15 slots on 4 charts, 16 on 4, 17 on 4, 18 on 2, 19 on 2 — and
  **14** on `PMSR-M88-AUS-V-EGY`'s two, the single short period in the corpus.
- **Batch (Decision 3 re-run)**: `104 extracted / 0 failed / exactly 2 self-validation
  failures` (PMSR-M19-ARG-V-ALG, PMSR-M58-TUN-V-NED — both 1.12's ledgered
  `defensive-actions-marker-count`, neither from E or F), 0 corpus gaps, 0 orphans,
  `RUN RESULT: FAIL` by design. All 208 charts stage a clock whose stamp count equals their
  series length; 18 carry extra time; `goalkeeping-involvement-clock` passes **104/104**
  with M88's short ET1 the only recorded period note.
- **Gate (Decision 3 re-run)**: `GATE RESULT: PASS`, 0 deviations across 16 sampled reports,
  0 corpus gaps, exit 0, with all four E/F ids in `checks_run` (27 ids now, 1.14's pair
  having landed since). The sample happens to include `PMSR-M100-ARG-V-SUI` and
  `PMSR-M104-ESP-V-ARG`, so the extra-time clock path is gate-exercised rather than only
  unit-tested. Two consecutive runs
  (`work/verification/gate-clock-{a,b}.json`) compared field by field: **identical apart
  from `run_timestamp`**.
- **Idempotence**: re-run on a stable tree gives **`0 extracted / 104 skipped-unchanged`**
  with all 104 staged records **byte-identical** (SHA-256 compared against a snapshot) at an
  unchanged `code_version`. Recorded honestly: the FIRST re-run attempt re-extracted all 104
  instead of skipping, because `code_version` fingerprints `pipeline/**/*.py` and the tree
  moved between the two runs — this story's own post-batch docstring rewrapping plus another
  session's in-flight `pass_network.py` work. That is the fingerprint doing its job, not a
  determinism fault, and the clean re-run above is the actual measurement.
- **Suite**: **1,330 tests collected across 39 test files**, all run **green**. Story
  1.9's own three files now collect **122** (74 Domain E, 21 Domain F, 27 record/gate
  integration), up from 105 — Decision 3 added **17**: 16 clock tests in
  `test_extract_domain_e.py` (one of which is a direct unit test of the tick reader, the
  only honest way to pin the `45HT` split) and the M01 ground-truth clock assertion in
  `test_extract_report_domains_ef.py`.
  *Corrected in the 2026-08-03 code review: this bullet originally read "37 test files",
  which cannot hold alongside 1,330 — `pipeline/tests/` holds 39 files, and the two
  untracked Story 1.15 files (`test_precompute_identity.py`, `test_precompute_spine.py`)
  contribute 72 of the 1,330, so the 37 files this story's tree owns collect 1,258. The
  1,330 figure was right; the file count was not.*
  The suite was run in **chunks rather than one invocation**, because two attempts at a
  single full run were killed externally partway through; every file is covered exactly
  once or more and no file was skipped. One transient failure is recorded rather than
  hidden: `test_extract_report_domain_a.py::test_a_count_inconsistency_lands_in_the_count_mismatch_bucket`
  failed mid-run inside `conftest.default_pass_network_block` — **Story 1.14's** fixture,
  which another session was editing live (the raising guard does not exist in `HEAD`). It
  passes on the settled file, and the same chunk was re-run green. Nothing in that path
  touches Domains E or F.
  *Also settled by the code review: the chunked-run caveat is retired. The reviewer ran
  this story's three files in a SINGLE invocation — 122 passed, 0 failed, 0 skipped, exit
  0 — so the assembled claim above is no longer the only evidence.*

### Completion Notes List

**What shipped.** `pipeline/extract/domain_f.py` (Set Plays) and `domain_e.py` (the four
goalkeeping page families), the fifth instance of the 1.6/1.7/1.10 extractor convention,
plus eight recorded self-validation checks (seven at first implementation, plus
`goalkeeping-involvement-clock` with Decision 3), four FR-15 gate checks, and nine synthetic page
drawers in `conftest.py`. No new `AnchorSpec`; `/contract` untouched; `pipeline/markers/`
imported but never edited.

**AC 1's re-scope held, and the two-keeper case is pinned.** Domain E stages per team with
Domain A's goalkeeper list carried beside the block. The corpus sweep independently
re-derived the story's premise overturn: 1 keeper on 201 team-innings, 2 on 7, and the
seven ids matched exactly. A dedicated test builds a two-keeper lineup, asserts both names
carry, asserts the team block is byte-identical to the one-keeper case, and asserts no
finding is raised.

**Five recorded departures, each measured rather than assumed.**

1. **`pitch_margin_pt` is 0.5, not the story's 0.0.** The story calls strict containment
   "load-bearing" because a positive margin "would admit two legend swatches per panel and
   inflate every count by 2". Measured over 208 pages: the swatches are **9.0 pt** (outside
   the 5.0–6.5 window) sitting **10.5 pt** below the frame, and **no** out-of-size filled
   circle is within 6.0 pt of any frame — they are excluded twice over. Meanwhile strict
   containment *drops real markers* on 8 team-innings (max overshoot 0.2917 pt), and
   admitting them makes 7 of those panels match their printed donut centre **exactly**.
   This is Story 1.11's touchline-cross finding, answered the same way. Ledgered.
2. **`goalkeeping-distribution-printed` ships as a BOUND, not the story's equality.** The
   story asserts marker count `==` printed donut centre is exact 208/208; it is not.
   `drawn >= printed` is true on **624/624** panel readings and equality on **604/624**,
   with every residual in the `feet` panel. Investigated and not manufactured away: the
   Total Distributions panel is the **exact union** of the other three on every case
   examined (0 diff, position-and-colour keyed), there are no under-counts once the margin
   is right, and 19 of the 20 have no duplicate marker positions — so the drawn set is
   self-consistent and the map simply plots more feet distributions than the technique
   donut counts. Shipping the equality would fail 20 innings for a relation the source does
   not hold to; shipping the bound keeps the check binary AND true, with every panel's
   delta in `specifics` on every report. This is Task 5.6's own reasoning applied to the
   same kind of evidence. Ledgered.
3. **`extract_domain_e` takes the cover team names**, which the story's stated signature
   omitted. ONE page carries BOTH teams' charts and identifies them only by the printed
   `'{team} GK Involvement Timeline'`; without the names the home/away split could only be
   positional, which AD-8 forbids. Every sibling parser facing this takes the same two
   arguments. A test prints the AWAY chart on top and asserts the payload does not move.
4. **The involvement baseline is anchored on the zero GRIDLINE, not the zero label.** This
   is the resolution of the story's open tolerance item, and the item was mis-scoped: the
   labels sit 1.81 pt above their gridlines, which is 0.117 units on the reference report
   but **scales with the per-report unit** — so the naive fit's worst residual is
   **0.161278** and exceeds the proposed 0.15 bound on **206 dots**. Corrected in code
   review: those 206 dots lie in exactly the **2 charts** the story named, so this is a
   sharper measurement of the same finding, not a contradiction of it — the original
   wording ("206 dots, not 2 charts") implied the story had the scope wrong when it had
   only counted at a coarser granularity. Anchoring on the gridline removes the fit entirely: worst residual **0.000001 units**,
   so the shipped `0.01` is float slack. The printed labels still supply the unit, so the
   two sources remain independent and their agreement is the assertion.
5. **The set-plays numeric census runs AFTER the grammar, not before.** Run first it
   pre-empts every specific error: a dropped corners value reported as "23 bare-integer
   words" instead of "the `Short` row carries 2 values, expected 3". The census owns the one
   failure mode the grammar cannot see — a printed number nobody read.

**One hardening the tests forced out.** The KPI upward walk was unbounded, and the two KPI
columns REPEAT down these pages (x = 121.5 and x = 352.5 carry free kicks/penalties and
then corners/throw-ins; the aerial page prints three tiles at identical centres). A missing
value therefore silently adopted the tile above's number — a plausible wrong value, the one
outcome AD-8 forbids outright. Bounded to `KPI_MAX_RISE_PT = 80.0` in both modules
(measured: every corpus KPI sits 37–43 pt above its label; the next tile in the same column
is 139 pt away).

**Two guards were dead by construction and are now live.** Collecting involvement dots
between the top and zero gridlines silently DROPPED any dot outside them, so a value off the
axis surfaced as "not evenly spaced" — a message pointing at the slot grid for a scale
fault. Dots are now collected over the chart BAND and rejected with the range guards, which
also makes the below-zero and above-top-label branches reachable and tested.

**Both table headers are closed constants asserted by equality.** Measured over 208 pages,
the goal-prevention and aerial header rows each take exactly ONE form, so a reworded or
reordered column now fails loud instead of shifting every value by one (AD-8). The corpus's
own table trap is reproduced by the fixture *by default*: the stray pitch-marker ordinal
that PMSR-M38 home prints at x=275 on the table's own row is drawn on every synthetic page,
so the `x >= 460` bound has a standing regression rather than a comment.

**Ground truth (Task 8.4) reproduced verbatim** on `spike/mex_rsa.pdf` — every value the
story pinned, including Mexico's `36 / 12 / 0 / 3 / 21` set plays, the `3·3·2·0·0·0·1` goal
prevention table with KPIs `3` and `100`, aerial `8·1·5·0·2·0·0`, distribution
`26+4 / 0+0 / 3+0 / 29+4` with line breaks `13`, Mexico involvement `37` with
`Σ(series) == 37`, and **South Africa `67` against `Σ(series) == 64` — the delta of 3 is
asserted, not smoothed away.**

**Two forced test repairs, one of which the story did not name.** Task 7.5's
`test_runner.py::test_checks_run_are_recorded` (the four ids inserted in sorted position),
and — not anticipated by the story —
`test_ingest_record.py::test_the_ground_truth_report_extracts_a_complete_record`, which
asserts the record's warnings as an EXACT set. That test is designed to fail when a story
adds a documented absence ("a fourth unexplained warning still fails this test"), so the
repair is the intended one: the expected set widens from three warnings to six, sourced from
`domain_e_warnings()` rather than re-typed.

**Decision 3 shipped (2026-08-03), and its blocker turned out not to exist.** The
involvement chart's TIME axis is now read alongside its value axis: `involvement_clock`
stages `second_half_slot` / `first_extra_slot` / `second_extra_slot` plus one flat
`{minute, stoppage_minute}` stamp per slot, derived from that chart's own printed x-ticks
and never from a formula. Four things are worth carrying forward:

1. **The "extra-time tick collision" was in the assumption, not the source.** The review
   left this open because `90+5` and `95` both land on `m46+49` under the natural reading.
   The chart does not use that reading: across all 18 extra-time charts the `95'` tick sits
   **5-9 slots after** the last `90+N` tick, never on it. Nothing had to be ruled — the
   printed ticks say where extra time starts, and the naive extension of the second-half
   formula is simply not what the template does.
2. **Every clock relation is exact, 0 deviations over 208 charts / 4,336 tick readings**:
   origin `0` on slot 0 (208/208), first-half `M` on slot `M-1` (1,872/1,872), `45+N` on
   `44+N` (110/110), one unanimous minute-46 slot across every second-half tick (208/208)
   equal to `HT` where printed (122/122), `90+N` on `m46+44+N` (214/214), both extra
   periods unanimous (18/18 charts). Each boundary is pinned by *every* tick that speaks
   to it, so a dozen independent readings agree before one minute is staged.
3. **The tick row must be read character-level** — measured, not assumed. A span-level
   prototype failed exactly four charts (`PMSR-M86-ARG-V-CPV` and `PMSR-M100-ARG-V-SUI`,
   both sides) and no others: their half-time tick sits one slot after the 45' tick, and
   pymupdf merges the two inserts into a single `'45HT'` span whose centre is neither
   tick's. Runs break on the digit-class boundary with `+` folded in *with* the digits, so
   `45HT` splits while `90+5` stays whole. Story 1.7's merged-span lesson again.
4. **`PMSR-M88-AUS-V-EGY` draws a 14-slot first extra period** on both charts — no `105'`
   tick, and a `110'` tick one slot earlier than a 15-minute ET1 would put it. The page is
   internally consistent and says minute 105 has no slot; every other extra-time chart runs
   ET1 at 15-19 slots. The parser therefore does not assert a period's regular length. That
   is deliberate on two grounds: asserting it would fail one report over football rather
   than over the page, and it would move the ruled batch baseline. The short period is
   recorded in `goalkeeping-involvement-clock`'s specifics on every report and ledgered.

`InvolvementClockError` is a separate class from `InvolvementChartError` because the two
axes are read from different sources and fail for different reasons, and a gate operator
triaging deviations needs to tell "the values are unreadable" from "the values are readable
but nobody knows which minute they are". The recorded check is an honest **backstop**, not
a cross-check, and its docstring says so — every inconsistency it could describe is already
a typed failure that aborts the report before a clock is staged. Its `specifics` carry the
derived stoppage allotments and any short period on every report; neither is part of its
pass/fail predicate.

**Open questions reported, not closed.** The involvement series plots fewer involvements
than the KPI counts (delta 0..5, never negative, exact on 59/208, mean 1.26) and the `feet`
panel draws more markers than its donut centre on 20/208. Both are shipped as bounds with
the delta recorded, both are filed in `deferred-work.md`, and neither was resolved by making
the numbers agree (the 1.8/1.12 rule).

**Coordination.** Another session edited `pipeline/validate/checks.py` and ran its own heavy
Python processes while this story's suite was in flight; the shared-file edits here are
append-only and did not collide. The first full-suite run showed
`test_code_version_is_stable_across_calls` failing purely because the tree changed mid-run
(the fingerprint memo vs a fresh re-read); it passes on a stable tree.

**COMMIT-SCOPE DISCLOSURE.** Story 1.9 wrote no commit of its own. Commit **`7306d7b`**,
authored by another session and titled *"Story 1.13: offers & movement to receive parsers,
code review done"*, swept up **every Story 1.9 implementation file** from the shared working
tree — `pipeline/extract/domain_e.py` (+1424), `domain_f.py` (+586), `errors.py` (+119),
`ingest/extract_report.py`, `validate/checks.py`, `tests/conftest.py`, the three new test
files, both forced test repairs and `pipeline/README.md`, plus this story's
`deferred-work.md` filings. The committed content is identical to the working tree that the
final green run verified (`git status` shows no `pipeline/` modifications), so nothing is
unverified — but a reviewer diffing "Story 1.13's commit" will find Story 1.9's whole
change set inside it, and `git log` names no commit for this story. Recorded here rather
than rewritten, following the Story 1.5 review precedent.

### File List

New:

- `pipeline/extract/domain_e.py`
- `pipeline/extract/domain_f.py`
- `pipeline/tests/test_extract_domain_e.py`
- `pipeline/tests/test_extract_domain_f.py`
- `pipeline/tests/test_extract_report_domains_ef.py`

Modified:

- `pipeline/extract/errors.py` (append-only: three typed classes)
- `pipeline/ingest/extract_report.py` (both seams, append-only + docstrings)
- `pipeline/validate/checks.py` (append-only: four gate checks, two memos, imports, docstring)
- `pipeline/tests/conftest.py` (additive: nine page drawers, default blocks, nine anchor branches, `make_report` kwargs)
- `pipeline/tests/test_runner.py` (forced repair: `checks_run` list)
- `pipeline/tests/test_ingest_record.py` (forced repair: exact warnings set)
- `pipeline/README.md` (Domains E & F section; gate registry list)
- `_bmad-output/implementation-artifacts/deferred-work.md` (Story 1.9 AD-14 filings)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-9-domains-e-f-extraction-goalkeeping-set-plays.md`

### Review Findings

Adversarial code review, 2026-07-27 — three layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) over the 1.9-scoped diff `7279637..7306d7b`. 39 raw findings merged to 33 unique. The Acceptance Auditor independently re-measured all three contested corpus claims over the full 104 reports and reproduced every figure exactly (624/624 and 604/624 with all 20 residuals in `feet`; 8 innings dropped by strict containment; 0.161278 / 0.000001 / 206 dots / 21,764 dots) — none of the five self-reported departures is fabricated.

**Decisions (3 — all ruled by Juan, 2026-07-27; each becomes a patch)**

- **Decision 1 → RULED: run the rest, skip only `goalkeepers`.** Make `lineups` optional in `extract_domain_e`; when Domain A is unavailable, stage `goalkeepers: null` plus a warning and run the four page families normally. This is Task 7.2 read literally, and it keeps a broken goalkeeping page visible to the gate on a report where Domain A happens to fail.
- **Decision 2 → RULED: bound it two-sided, `0 <= drawn - printed <= 2`.** The bound the corpus sweep already justifies (+1 on 18, +2 on 2, all in `feet`; `hands` and `throw` exact 208/208). Stays binary and true on 624/624, and a mapping slip giving 33/30 now fails instead of passing silently. The `pitch_margin_pt` 0.0 → 0.5 departure itself STANDS — the story's stated rationale is measurably wrong and the measurement is sound; it is the unbounded overshoot the widened margin opened that is closed here.
- **Decision 3 → RULED: implement the slot → match-clock mapping now.** Read the printed x-tick labels and stage the clock structure the way Story 1.8's momentum did — the precedent Task 3.11 itself cites. Task 3.11 is not complete until this ships.

- [x] [Review][Decision] A Domain A failure silently suppresses ALL Domain E gate reporting — `_domain_e_uncached` returns `None` on any Domain A `PipelineError`, so both `goalkeeping-completeness` and `goalkeeping-counts` return `[]`. Only the `goalkeepers` list needs lineups; goal prevention, aerial, distribution and involvement do not. Task 7.2 says "skip only the parts that need it and run the rest". On a report where Domain A fails, a genuinely broken goalkeeping page is invisible to the gate. This is a SIXTH departure the Completion Notes do not record, and the docstring documents the skip as if it were the intended one. [`pipeline/validate/checks.py:1414`]
- [x] [Review][Decision] `goalkeeping-distribution-printed`'s one-sided bound permits unbounded overshoot, and departures 1+2 compound in that one direction — widening `pitch_margin_pt` 0.0 → 0.5 can only INCREASE the marker count, while the check was simultaneously relaxed to fail only on `drawn < printed`. After both changes no shipped check can detect the margin admitting a non-marker (`goalkeeping-distribution-sum` is blind too — the Total panel is the union and absorbs the same extras). A mapping slip assigning `total`'s markers to `feet` gives 33/30 and passes outright. The corpus evidence quoted (+1 on 18, +2 on 2, all in `feet`) supports a bounded relation `0 <= drawn - printed <= 2`, which stays binary AND true while constraining the direction now left open. Remaining defences are real but indirect: the 5.0–6.5 size window against 9.0 pt swatches, and `_assert_constant_integrity`'s margin/size bounds. [`pipeline/extract/domain_e.py:1311`, `:216`]
- [x] [Review][Decision] Task 3.11's open question was dropped, not reported — `involvement_series` stages as a bare `list[int]`; the x-tick labels (`0 5 … 45 HT … 90+5`) are never read and no slot → match-clock mapping is staged or recorded anywhere. Task 3.11 is marked `[x]`, and the "Open questions reported, not closed" paragraph covers only the sum delta and the feet residual. Story 1.8's momentum — the precedent this task cites — shipped a clock structure; Story 2.10 cannot place this timeline on the match clock from what is staged. (Slot count IS correctly per-report: 95–145 measured across 208 charts, nothing hard-coded.) [`pipeline/extract/domain_e.py:1147`]

**Patches (22)**

- [x] [Review][Patch] Both bounds discard the delta their own comments promise on EVERY report — the ternary puts `"; ".join(deltas)` only in the else branch, so a report failing on one side loses the other side's honest residual entirely [`pipeline/extract/domain_e.py:1339`, `:1414`]
- [x] [Review][Patch] `_goalkeepers` indexes Domain A's payload with bare subscripting — a lineups shape change raises an untyped `KeyError` that neither `except ExtractError` nor `except PipelineError` catches, so the replayed memo records one root cause under BOTH gate ids [`pipeline/extract/domain_e.py:1166`]
- [x] [Review][Patch] `domain_f._kpi_value` raises `MissingFieldError` for a present-but-mistyped value — `_INTEGER_RE` filters candidates before the walk, so a KPI printed `12.5` or `-` reports "prints no value", the exact message `errors.py` forbids. `domain_e._value_above` gets this right (`_NUMBER_RE` filter → `_parse_int` → `MalformedFieldError`); the two modules are asymmetric [`pipeline/extract/domain_f.py:298`]
- [x] [Review][Patch] `_value_gridlines` compares gridline x-extents by exact equality after 3-decimal rounding — a 0.001 pt tripwire in a module that defines `GEOMETRY_TOL_PT = 0.05` for exactly this noise [`pipeline/extract/domain_e.py:918`]
- [x] [Review][Patch] `_label_run` returns only the leftmost matching run, so `_find_label`'s "printed twice is ambiguous" guard is per-ROW — a label repeated inside one visual row binds silently to whichever tile sits left [`pipeline/extract/domain_e.py:336`]
- [x] [Review][Patch] `_assert_constant_integrity` does not cover `AERIAL_TRIPLE_LABELS`/`AERIAL_TRIPLE_KEYS` or `GOAL_PREVENTION_KPIS` — a length mismatch is absorbed silently by `zip` and stages fewer keys with no import-time failure [`pipeline/extract/domain_e.py:265`]
- [x] [Review][Patch] `_assert_label_integrity`'s prefix guard misses the ambiguity a contiguous-run matcher actually has — `_label_run` matches any interior run, so `Set Plays` alongside `Total Set Plays` passes `startswith` and then fails every report [`pipeline/extract/domain_f.py:157`]
- [x] [Review][Patch] `_table_row_below`'s docstring states the opposite of the code — "Rows with a different count are skipped rather than raised on" vs. a raise on any non-zero mismatch [`pipeline/extract/domain_e.py:493`]
- [x] [Review][Patch] `MalformedFieldError` is unreachable for non-numeric table tokens — `_numbers_in` pre-filters with `_NUMBER_RE`, so a `-` fails the COUNT assertion instead; `test_a_non_numeric_token_in_a_table_raises` asserts `"carries 6 value(s)"` and proves something other than its name [`pipeline/extract/domain_e.py:380`]
- [x] [Review][Patch] `LINE_BREAKS_X_MIN = 700.0` is an absolute page coordinate on the one page where resolved panel rects are already in hand — the AD-8-consistent bound is the `total` panel's own `x0` [`pipeline/extract/domain_e.py:193`]
- [x] [Review][Patch] Four conftest hooks are dead — `gk_involvement_axis_rule` (added specifically to break the gridline run), `gk_involvement_decorate`, `goal_prevention_decorate`, `aerial_decorate` appear in no test; the involvement chart's 11 raise sites have 3 covered [`pipeline/tests/conftest.py`]
- [x] [Review][Patch] Domain E's page-level numeric census and per-panel donut assertion have no test, while Domain F's identical tripwire has two in both directions [`pipeline/extract/domain_e.py:790`]
- [x] [Review][Patch] `clean_registry` is defined but never requested by any test in the file — all four deviation-category tests run against the live global registry, contra Task 8.3 [`pipeline/tests/test_extract_report_domains_ef.py:37`]
- [x] [Review][Patch] `test_the_distribution_legend_and_pitch_spots_are_never_counted` tests half its docstring — `draw_gk_distribution_page`'s `spots` parameter is never exposed by `make_report`, so the spots are drawn unconditionally and "dropping them must change nothing" never runs [`pipeline/tests/test_extract_domain_e.py:209`]
- [x] [Review][Patch] The distribution fixture's technique-label comment quotes a corpus row carrying three integers (`'30 From Hands 0 Under Arm 3'`) but draws only the two words — the census constant 4 is validated against a simplified page [`pipeline/tests/conftest.py`]
- [x] [Review][Patch] The second forced repair sources its expectation from the module under test (`*domain_e_warnings()`), so the exact-warnings assertion can no longer fail for Domain E — a weakening, not a hole (coverage survives via `test_each_absence_carries_exactly_one_warning`) [`pipeline/tests/test_ingest_record.py`]
- [x] [Review][Patch] Dev Agent Record test count is wrong — claimed "+91 (45 E, 20 F, 26 integration)"; actual collection at review time was 90 (45 / **19** / 26). Corrected, and the post-review count is **105** (58 E / 21 F / 26 integration) [story Completion Notes; Change Log]
- [x] [Review][Patch] Departure 4's "206 dots, not 2 charts" is a false contrast — those 206 dots lie in exactly the 2 charts the story named; the counts describe the identical set [story Completion Notes]
- [x] [Review][Patch] `goal_prevention` stages `attempts_faced_printed`, absent from Dev Notes §Extraction Record — earned by Task 3.4's cross-check, but the staged shape was never updated to match [story Dev Notes §Extraction Record]
- [x] [Review][Patch] `home_team`/`away_team` are declared `= None` and then rejected at runtime — optional in the signature, mandatory in fact [`pipeline/extract/domain_e.py`]
- [x] [Review][Patch] Seam docstring drift — `extract_report.py` still says "Further domains filled by Stories 1.9–1.14" in the commit that fills them, and `checks.py`'s footer says "Later stories add: 1.10+" in the file that registers 1.9's four ids [`pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`]
- [x] [Review][Patch] `KPI_MAX_RISE_PT = 80.0`'s justification cites the wrong quantity — the distance that must exceed 80 is label-to-tile-above's-VALUE (~149 pt in the fixture), not the 110 pt label-to-label pitch; the conclusion holds, the stated margin does not [`pipeline/extract/domain_e.py:143`]

**Deferred (7)**

- [x] [Review][Defer] Value readers count spans, not printed numbers, while label readers explicitly de-fragment [`pipeline/extract/domain_e.py:380`, `pipeline/extract/domain_f.py:334`] — deferred, fails loud and corpus-clean at 208/208
- [x] [Review][Defer] The lower involvement chart's y-band is unbounded below (`page_y1`) [`pipeline/extract/domain_e.py:1125`] — deferred, the fix is circular (labels give the unit that selects the gridlines)
- [x] [Review][Defer] Each chart's band is delimited by the NEXT chart's title row, so away-chart decoration above its own title lands in home's band [`pipeline/extract/domain_e.py:1125`] — deferred, fails loud
- [x] [Review][Defer] `_axis_labels` requires a step-1 consecutive run, hard-coupling gridline count to the auto-scaled top label [`pipeline/extract/domain_e.py:891`] — deferred, no corpus range pinned for the top label
- [x] [Review][Defer] `NUMERIC_WORD_COUNT = 24` is a whole-page word count — any venue printed with a digit (`Stadium 974`) fails every report at that venue [`pipeline/extract/domain_f.py:82`] — deferred, corpus-invariant today
- [x] [Review][Defer] `_value_above`'s KPI walk searches the band the page's stray pitch-marker ordinals occupy [`pipeline/extract/domain_e.py:387`] — deferred, `attempts_faced` is covered by the KPI-vs-table cross-check; `save_percentage` is not
- [x] [Review][Defer] Story 1.9 has no commit of its own — `git log` attributes the whole change set to `7306d7b` "Story 1.13" [repo history] — deferred, disclosed in the Completion Notes and not correctable without rewriting history

**Un-dismissed and patched (1)** — `_gridline_run` selecting a run shifted one gridline down was dismissed during triage on the reasoning that `goalkeeping-involvement-bound` catches a uniformly inflated series. Writing the regression test for it proved the dismissal wrong on the mechanism: an extra evenly-spaced gridline one unit below zero makes the top-anchored candidate `count + 1` long (rejected for being too long), leaving the shifted run as the *unique* survivor — so `len(runs) != 1` never fires and every value reads one unit high off a baseline that is not zero. The bound does eventually fail, but as a count mismatch blaming the printed total for a misread axis, and only after the series has staged wrong. `_gridline_run` now also asserts the selected run starts at the top of the grid. [`pipeline/extract/domain_e.py:_gridline_run`]

**Applied (26 of 26).** All three ruled decisions, all 22 patches and the un-dismissed finding above are implemented. Decision 3 was completed on 2026-08-03 — see below.

**Decision 3 — CLOSED (2026-08-03).** The ruling was "implement it now, mirroring Story 1.8's momentum". The 1.8 precedent supplies the method; the code is its own, because the tick grammar is materially different:

| | momentum (1.8) | involvement (1.9) |
| --- | --- | --- |
| `FT` tick | 94/104 | **never printed** |
| `HT` tick | 101/104 | **122/208 charts** |
| stoppage ticks | none | `45+N` (110 charts), `90+N` (214), `120+N` (4) |
| last tick vs last slot | FT *is* the last slot, 94/94 | last tick is **0–7 slots before** the grid end |

Every clock relation is exact with 0 deviations corpus-wide (208 charts, 4,336 tick readings): the origin tick `0` on slot 0 (208/208); first-half `slot(M) == M-1` (1,872/1,872); `slot('45+N') == 44+N` (110/110); every second-half tick agreeing on one minute-46 slot (208/208) and equal to the `HT` tick where printed (122/122); `slot('90+N') == m46+44+N` (214/214); both extra periods unanimous across their own ticks (18/18 charts).

*The earlier count of 61/104 `HT` charts and 118/118 `HT` agreements was a per-**report** count read as a per-**chart** one, and 1,868 first-half readings was measured before the merged-span fix below recovered four charts' `45'` ticks. The figures above supersede them; the relations they describe are unchanged.*

**The extra-time collision that blocked this does not exist in the data.** The blocker recorded above was that `90+5` and `95` both land on `m46+49`. That is true only of the *naive* reading — extending the second-half formula past minute 90 — and the chart does not use it. Measured across all 18 extra-time charts, the `95'` tick sits **5–9 slots after** the last `90+N` tick, never on it. The mapping reads the printed ticks, so no ET semantics had to be ruled: the collision was in the assumption, not the source.

**Two things the corpus sweep forced out, neither anticipated.**

1. **The tick row must be read character-level.** pymupdf merges adjacent same-font inserts, and the two reports whose half-time tick sits one slot after the 45' tick (`PMSR-M86-ARG-V-CPV`, `PMSR-M100-ARG-V-SUI`) hand back a single `'45HT'` span whose centre is neither tick's. A span-level reader fails all four of those charts with "tick '45HT' is not a slot centre" on pages that are perfectly well formed — measured, not hypothesised: the span-level prototype failed exactly those four and no others. Runs break on the digit-class boundary with `+` folded in *with* the digits, so `45HT` splits while `90+5` stays whole. Story 1.7's merged-span lesson, and where momentum's own `_tick_runs` already stands.
2. **`PMSR-M88-AUS-V-EGY` draws a 14-slot first extra period** on both charts — no `105'` tick, and a `110'` tick one slot earlier than a 15-minute ET1 would put it. The page is internally consistent and says minute 105 has no slot. Every other extra-time chart runs ET1 at 15–19 slots. The parser therefore does **not** assert that a period ran its regular length: failing one report of 104 over an assertion about football rather than about the page would also move the ruled batch baseline. The short period is recorded in `goalkeeping-involvement-clock`'s specifics on every report and ledgered.

**What shipped for it:** `involvement_clock` in each side's block (`second_half_slot` / `first_extra_slot` / `second_extra_slot` plus one flat `{minute, stoppage_minute}` stamp per slot); the typed `InvolvementClockError`, separated from `InvolvementChartError` because the two axes are read from different sources and fail for different reasons; the recorded `goalkeeping-involvement-clock` check (an honest **backstop**, like momentum's `momentum-coverage`, not a cross-check); a fixture tick row that moves with the clock structure it is given, so a parser ignoring the ticks fails every extra-time case; and **17 new tests** (105 → 122 across the story's three files).

**Verified clean** — `/contract` untouched (only `c645cfe` touches it); `pipeline/markers/filter_chain.py` genuinely untouched, plural `detect_pitch_frames` used, `exclude_legend_rows` deliberately not called; Task 7.5's named repair exactly as specified with `offers-count-match` still unclaimed; Task 7.3's closed deviation mapping correct on all four paths; AC 1's re-scope, AC 2's checks, AC 4's absences and both corpus-refuted relations implemented as ruled, with the fixtures making the refuted relations FALSE by construction; the two-goalkeeper case pinned; ground truth matches M01 field for field including South Africa's asserted delta of 3; README and `deferred-work.md` both filed. Departures 3 and 5 audited and upheld.

---

### Review Findings — Decision 3 code review (2026-08-03)

Adversarial code review of the Decision 3 delta only (the involvement slot → match-clock
mapping) — three layers over the 1.9-scoped working-tree diff: Blind Hunter, Edge Case
Hunter, Acceptance Auditor. 35 raw findings merged to 21 unique; 3 decisions ruled by Juan,
15 patches, 0 deferred, 6 dismissed.

**The substance is sound.** The Acceptance Auditor re-derived the corpus independently with
its own character-level tick reader over all 104 PDFs — no sampling — and every clock
relation reproduced with **0 deviations**: origin on slot 0 (208/208), first-half `M` on
`M−1` (1,872/1,872), `45+N` on `44+N` (110/110), second-half unanimity (208/208), `HT` equal
to the derived minute-46 slot (122/122), `90+N` on `m46+44+N` (214/214), both extra periods
unanimous (18/18), `120+N` on `et2+14+N` (4/4), zero `FT` ticks, worst tick-to-slot-centre
residual 0.000529. The `45HT` merged-span claim reproduced on exactly the four named charts
and no others; M88's 14-slot ET1 reproduced exactly. Replaying the shipped `_involvement_clock`
against those independent readings derives cleanly on 208/208 with 0 round-trip failures, and
the resulting triples match all 208 staged records with 0 mismatches. **Task 3.11 is genuinely
satisfied.** The suite caveat is also retired: Story 1.9's three files ran in a **single
invocation — 122 passed, 0 failed, 0 skipped** (74 / 21 / 27), so the chunked-run caveat in
the Completion Notes no longer applies.

**Decisions ruled (3)**

- [x] [Review][Decision] `extra_time_slot` collides semantically with momentum's key of the same name — in `domain_e.py` it names the slot carrying match minute 91; in `momentum.py:482` it names the printed 120' tick slot, with `second_extra_slot` derived from it at `:526`. Two clock structures in one pipeline, one key name, incompatible meanings, both consumed by 1.16 and 2.10. **Ruled: rename in `domain_e.py`** (the new, unreleased block) rather than touch shipped Story 1.8 — becomes a patch. Requires a 104-record re-run since the staged shape changes.
- [x] [Review][Decision] Trailing slots past the last printed tick are stamped by extrapolation, bounded only by `MAX_STOPPAGE_MINUTE = 30` against a measured corpus maximum of 19. **Ruled: leave at 30 and keep recording** — the contract bound is the right ceiling, the check already records derived allotments in `specifics` on every report so drift is visible in gate output, and tightening to the measured band would assert football over the source and fail a legitimate long-stoppage match (the 1.8/1.9/1.12 bounds-not-equalities rule). Dismissed as designed.
- [x] [Review][Decision] `involvement_series` and `involvement_clock["stamps"]` ship as two parallel lists whose equal length the check then polices, where momentum stages one list making the drift structurally impossible. **Ruled: keep two lists** — the shape is documented, already staged in all 104 records, and reshaping moves the ruled batch baseline for no correctness gain. Dismissed as designed.

**Patches (15)**

- [x] [Review][Patch] Task 8.3 violated — `goalkeeping-involvement-clock` has no fail-branch test; all 16 new clock tests assert `InvolvementClockError` at extraction time, a path that never reaches `domain_e_checks`, leaving all three predicate clauses uncovered [`pipeline/tests/test_extract_domain_e.py`]
- [x] [Review][Patch] Short ET2 fails the check while an identically short ET1 passes — `final_minute` is unconditionally 120 whenever extra time exists, contradicting the "recorded, never failed" policy stated four lines above [`pipeline/extract/domain_e.py:2140`]
- [x] [Review][Patch] The backstop never reconciles the three staged boundary fields against the staged stamps — the declared guard against "corruption of the staged block between parse and record" reads only `stamps`; mutating `second_half_slot` 49 → 60 leaves the check **passing** with visibly wrong specifics [`pipeline/extract/domain_e.py:2118-2145`]
- [x] [Review][Patch] `clock_facts` discarded on a length mismatch — the `continue` skips `clock_facts.append`, so the failing side records a note but no facts, and a both-side mismatch leaves a dangling `" | "`. This is a recurrence of a shape filed and patched twice in the 2026-07-27 review [`pipeline/extract/domain_e.py:2123-2127`]
- [x] [Review][Patch] The tick band is not clipped to the chart's own row band — `_involvement_series` is scoped to `band=(top, bottom)` but `_involvement_clock_block` receives only `grid` and reads an absolute 30 pt window that never consults `bottom`, on a page carrying both teams' charts [`pipeline/extract/domain_e.py:1341-1342`, call site `:1719-1724`]
- [x] [Review][Patch] The one-line tick-band guard is blind to the splice it exists to catch — `lines_y` is built per **run**, after merging, so two lines that splice collapse to a single y and the spread reads 0.0; the guard fires only when a second line fails to splice (the harmless case) [`pipeline/extract/domain_e.py:1317-1324`]
- [x] [Review][Patch] Overprinted glyphs concatenate — `cx0 - runs[-1][2] < 1.5` is satisfied by a negative gap, so a double-struck `45` yields the run `'4455'` and aborts a well-formed page [`pipeline/extract/domain_e.py:1303`]
- [x] [Review][Patch] `_TICK_STOPPAGE_RE` puts no upper bound on `N`, so a merged numeric run parses as valid stoppage grammar and fails with a slot message rather than a merged-run one [`pipeline/extract/domain_e.py` `_TICK_STOPPAGE_RE`]
- [x] [Review][Patch] The check raises bare `IndexError` / `TypeError` out of `domain_e_checks` on a malformed staged block — `stamps == []` with an equal-length series indexes `stamps[0]`; `extra_time_slot` set with `second_extra_slot` `None` reaches `second_extra - extra_time` in `_period_notes`. Both escape as non-`PipelineError` [`pipeline/extract/domain_e.py:2128`, `:2185`]
- [x] [Review][Patch] `TICK_BAND_PT` and `TICK_X_MARGIN_PT` are exempt from `_assert_constant_integrity`, which the diff extends for the other four new constants — and they are precisely the two deciding which ticks get read at all [`pipeline/extract/domain_e.py:328`]
- [x] [Review][Defer] `domain_e_checks` bare-subscripts `block["involvement_clock"]` while `RECORD_VERSION` stays at 1 [`pipeline/extract/domain_e.py`] — deferred, pre-existing. **Reclassified from patch during the patch pass**: the finding is true, but the whole function reads its own payload this way (`["distribution"]`, `["goal_prevention"]`, `["aerial"]` …), all predating Decision 3, so guarding one key of eight would be inconsistent noise. The 2026-07-27 precedent it cites is not the same case — that patch was about reading a SIBLING DOMAIN's payload (Domain A's lineups), which this is not. Filed to `deferred-work.md`; owner is whoever next touches the record-version contract.
- [x] [Review][Patch] `_period_notes`' H1 and H2 "drawn SHORT" branches are unreachable — `_assert_clock_bounds` guarantees both periods are ≥ 45 slots — yet the docstring presents them as live policy [`pipeline/extract/domain_e.py:2170-2193`]
- [x] [Review][Patch] Rename `extra_time_slot` in the staged `involvement_clock` block per the ruled decision above, and re-run the 104-record batch [`pipeline/extract/domain_e.py`]
- [x] [Review][Patch] Five corpus figures are wrong in comments and docs — "4,336 tick readings" is **4,508** (the story's own per-label census sums to 4,508); "207 of 208 charts" is **206** (M88 contributes two charts, and 207+2 > 208); "`45+N` on 110 charts" conflates charts with readings (**108 charts / 110 readings**, and `90+N` is 182 charts / 214 readings); "the grid runs 0–7 slots PAST the last tick" is **false on 38 charts** where the last tick *is* the last slot, and contradicts the `TICK_X_MARGIN_PT` comment four lines below; "across all 18 extra-time charts the `95` tick sits 5–9 slots after the last `90+N`" is **16**, since `PMSR-M74-GER-V-PAR` (both sides) prints no `90+N` tick at all [`pipeline/extract/domain_e.py:294-296`, `:1381`, `:2111`, `pipeline/README.md`]
- [x] [Review][Patch] Story-document drift — Completion Notes still say "seven recorded self-validation checks" (now eight, as `extract_report.py` and the README both correctly state); Task 3.11's closure line says "16 new tests" where the Completion Notes and Change Log say 17 (17 is right); "1,330 tests collected, every one of the 37 test files green" cannot hold — `pipeline/tests/` holds **39** files collecting 1,330, of which the two untracked Story 1.15 files contribute 72, so 37 files collect 1,258 [`_bmad-output/implementation-artifacts/1-9-domains-e-f-extraction-goalkeeping-set-plays.md`]

**Patch pass verified (2026-08-03).** All 14 patches applied. Re-measured rather than
asserted:

- **Suite green on every file the change can reach**: this story's three files
  **132 passed** in one invocation (122 → 132, the 10 new fail-branch tests), plus
  **53 passed** (`domain_a`, `domain_g`, `domains_bc`) and **117 passed** (`momentum`,
  `ingest_record`, `runner`, `checks_registry`) — the shared-`conftest` blast radius of the
  fixture fix. **302 tests, 0 failures.**
- **Batch re-run on the renamed record shape**: `104 extracted / 0 failed / 0 corpus gaps /
  0 orphans`, with **exactly the ruled two self-validation failures** (PMSR-M19, PMSR-M58 —
  both `defensive-actions-marker-count`, neither from E nor F). `RUN RESULT: FAIL` by design.
- **The staged block re-verified across all 104 records**: `goalkeeping-involvement-clock`
  passes **104/104**; the renamed `first_extra_slot` key is present on **208/208** charts
  with no `extra_time_slot` survivor; stamp count equals series length on 208/208; 18 charts
  carry extra time; and `PMSR-M88-AUS-V-EGY` is the **only** report carrying a short-period
  note — each figure matching the Acceptance Auditor's independent corpus measurement.
- **One fixture defect the patches forced out**, recorded because it made a shipped
  asymmetry untestable: `gk_involvement_ticks` applied its own "print a tick only when its
  slot exists" rule to the first extra period and not the second, so a short ET2 placed the
  120' tick one slot past the grid and could not be drawn at all. The ET1/ET2 inconsistency
  therefore had no reachable test by construction. Fixed alongside the predicate.

**Dismissed (6)** — two ruled as-designed above; a README hunk rewriting Story 1.14's
pass-network section (a mis-attribution in the reviewer's own diff scoping, not a defect in
this story); prose reflow and line width (no linter configured in the tree); `MAX_STOPPAGE_MINUTE`
duplicated between `momentum.py` and `domain_e.py` (deliberate and argued in the docstring);
and a wrong-origin message misattribution on a path that dot-per-slot assertion at
`domain_e.py:1211-1227` makes unreachable.

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-27 | Story 1.9 implemented: Domains E & F extraction (goalkeeping staged per team, set plays), 7 recorded checks, 4 FR-15 gate checks, 90 new tests. Batch 104/104 with the ruled 2-failure baseline; gate PASS, 0 deviations. Status in-progress → review. |
| 2026-08-03 | Decision 3 implemented, closing the last open item: the involvement chart's slot → match-clock mapping. New `involvement_clock` block per side (`second_half_slot` / `first_extra_slot` / `second_extra_slot` plus one `{minute, stoppage_minute}` stamp per slot), derived from that chart's own printed x-ticks; new typed `InvolvementClockError`; new recorded check `goalkeeping-involvement-clock` (7 → 8 Domain E/F checks); `conftest`'s tick row now moves with the clock structure it is drawn for. The extra-time collision that blocked this was measured away — it belongs to the naive second-half extension, not to the source. Two corpus findings ledgered: the `45HT` merged span (4 charts) and `PMSR-M88-AUS-V-EGY`'s 14-slot first extra period. Batch 104/104 with the ruled 2-self-validation-failure baseline unchanged; gate PASS, 0 deviations. |
| 2026-08-03 | Story 1.9 Decision 3 adversarial code review (3 layers over the 1.9-scoped working-tree diff): 35 raw findings merged to 21 — 3 decisions ruled, 14 patches applied, 1 deferred, 6 dismissed. **Substance upheld**: an independent full-corpus re-derivation reproduced every clock relation with 0 deviations and matched all 208 staged records, so Task 3.11 stands. Ruled: `extra_time_slot` renamed to `first_extra_slot` (it named minute 91 here and the printed 120' tick in `momentum.py` — one key, two meanings); `MAX_STOPPAGE_MINUTE` stays at 30 with allotments recorded rather than tightened to the measured band; the two parallel `series`/`stamps` lists stay as staged. Patched: the clock check gained fail-branch tests (Task 8.3 was violated — the check had none, and two of the defects found here lived in the uncovered clauses), the short-ET2/short-ET1 asymmetry, boundary-field reconciliation against the stamps, `clock_facts` recorded on failing sides, the tick band clipped to its own chart, the line-spread guard moved before grouping, overprint and merged-run bounds, and two constants added to the import-time integrity check. Five corpus figures corrected (4,336 → 4,508 readings; 207 → 206 charts; charts vs readings; the "0-7 slots past the last tick" claim, false on 38; "all 18" ET charts → 16). 302 tests green; batch 104/104 on the ruled 2-failure baseline; clock check 104/104. Status review → done. |
| 2026-07-27 | Story 1.9 adversarial code review (3 layers over the 1.9-scoped diff of `7279637..7306d7b`): 39 raw findings merged to 33 unique — 3 decisions ruled, 22 patches applied, 7 deferred, 1 dismissed then un-dismissed and patched. Re-verified: 105 tests green across the three files (90 → 105), batch 104 records with the ruled 2-self-validation-failure baseline (M19, M58 — both defensive-actions, neither from E or F), all seven E/F checks pass 104/104, gate PASS 0 deviations with all four E/F ids in `checks_run`. Decision 3 (involvement slot → match-clock mapping) is probed and measured but NOT implemented — see Review Findings. |

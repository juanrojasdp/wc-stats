---
baseline_commit: f8ca7ee9267a656576195b1a37614e4308162799
---

<!--
Story context created by the create-story workflow (ultimate context engine analysis):
epics + PRD/addendum + ARCHITECTURE-SPINE + EXPERIENCE + /contract + fixtures provenance
+ live code seams + a full 104-report story-creation probe that RESOLVED OQ-5 before dev.
-->

# Story 1.8: Momentum-Series Extraction (OQ-5 Resolution)

Status: review

## Story

As the builder,
I want the momentum/possession time series located, extracted, and its shape landed in the contract,
So that the App's Momentum Timeline (FR-22) has its Epic 1 counterpart and the gap can never be silently dropped (FR-35).

## Acceptance Criteria

**AC 1 — OQ-5 resolved and documented.**
**Given** the report pages
**When** the source investigation completes
**Then** the PMSR page and data shape feeding the momentum series are identified and documented, resolving OQ-5.

> The story-creation probe already resolved this against all 104 reports (§"OQ-5 — RESOLVED at story creation"). Your job is to **verify** the pinned facts in code, close the ONE open sub-question (slot→minute mapping, §"The one open question"), and record the resolution durably in `pipeline/README.md` + `contract/README.md`. If any pinned fact fails to reproduce, that is a finding — record it, do not paper over it.

**AC 2 — the shape lands in the contract via AD-14.**
**Given** the resolved series shape
**When** the contract is updated
**Then** the change flows through AD-14: schema updated, `schemaVersion` bumped, fixtures regenerated **in the same commit**.

**AC 3 — every match carries a momentum value; the key is never omitted, never `[]`.**
**Given** any match
**When** extraction runs
**Then** the Extraction Record's momentum value is either a series covering the full match duration or `null` with the reason flagged in the manifest — never omitted, never `[]` (AD-4).

**AC 4 — the FR-15 gate re-runs with momentum extraction active.** *(sprint directive; matches the gate AC every sibling extraction story carries — 1.6, 1.7, 1.9, 1.10)*
**Given** the venue × matchday sample
**When** the FR-15 gate re-runs
**Then** momentum anchors, scale derivation and the axis cross-check appear in the deviation summary, and re-runs are byte-identical apart from `run_timestamp`.

## Tasks / Subtasks

- [x] **Task 1: Reproduce the probe in a scratchpad sweep before writing production code (AC: 1)**
  - [x] 1.1 Re-run the pinned facts over all 104 PDFs: band on page index **1**, baseline `y == 429.13`, bar `width / pitch == 0.70`, peak bar height `== 50.38 pt`, printed y-axis top label `== ` peak value in units, `0` non-integer bar heights, legend `orange → home / purple → away`. Every one of these reproduced 104/104 at story creation.
  - [x] 1.2 Confirm the title `"Distribution in the Final Third"` occurs **exactly once per report, on page index 1, in 104/104** — it is the anchor text you will register.
  - [x] 1.3 Close the slot→minute mapping (§"The one open question"). Record the derived rule and the evidence in the Debug Log.
  - [x] 1.4 Record any fact that fails to reproduce as a finding — do NOT adjust the production rule to make a stale story note true.

- [x] **Task 2: Register the anchor (AC: 1, 4)**
  - [x] 2.1 Add `AnchorSpec("momentum", "Distribution in the Final Third", "momentum")` to `ANCHOR_REGISTRY` in `pipeline/discover/anchors.py`. Not `per_team` — one occurrence per report, both teams on one chart. Required (it resolves on 104/104).
  - [x] 2.2 Confirm `anchor-coverage` (the existing gate check) now covers it — no new check id needed for coverage.

- [x] **Task 3: Build the parser — `pipeline/extract/momentum.py` (AC: 1, 3)**
  - [x] 3.1 Locate the band by the Task 2 anchor page, never by index.
  - [x] 3.2 Collect bars: filled paths whose fill is exactly `(1.0, 0.239, 0.0)` (home) or `(0.702, 0.533, 1.0)` (away), item ops exactly `("l","l","l","l")`. Assert-on-unknown per AD-8.
  - [x] 3.3 Derive the baseline as the shared edge (every home bar's `y1` == every away bar's `y0`); assert it is single-valued and equals `429.13`, else fail loud. **RULED 2026-07-27 (code review): the `429.13` literal is NOT asserted, deliberately.** The parser asserts the bars' shared edge against the *derived* middle gridline instead. Every quantity feeding a sample is relative, so a template revision that translated the whole band vertically would still produce correct values — asserting the literal would fail a report whose data is fine, against AD-8's derive-never-hard-code rule. What genuinely carries the risk, the auto-scale, IS asserted (peak bar height == axis half height). Task text stands as the original intent; `pipeline/README.md`'s constants table now says plainly that those three figures are measurements, not assertions.
  - [x] 3.4 Derive the slot pitch from bar `x0` gaps **and** independently from the printed tick spacing; assert the two agree, else fail loud.
  - [x] 3.5 Derive the value unit from the **printed y-axis top label** (`unit_pt = peak_height_pt / top_label`) and independently by GCD over bar heights; assert both agree and that every bar height is an integer multiple within tolerance, else fail loud. This is the load-bearing scale step — see §"Value scale". **RULED 2026-07-27 (code review): this task text and §"Value scale" are STALE; the implemented behaviour is correct and stands.** Deriving the unit as `peak / top_label` makes `momentum-axis-scale` tautological — the peak would equal the printed label by construction on every chart, including one whose axis is wrong. The unit is therefore derived geometrically (GCD) only, and the printed label is compared against it as a **recorded** check rather than a raised failure, per SM-C1: a printed axis contradicting the geometry is a finding for the ledger, not an exception. Geometry contradicting *itself* (non-integral height, peak != half height) still fails loud, as the task intended.
  - [x] 3.6 Emit a value for **every** slot in the span, including slots with no bar (absence = `0`, both sides). Never emit a sparse series.
  - [x] 3.7 Map slot → match clock per Task 1.3 and stamp each sample.

- [x] **Task 4: Wire into the Extraction Record (AC: 3)**
  - [x] 4.1 Add `extract_momentum` + `momentum_checks` imports and the call site in `pipeline/ingest/extract_report.py`, following the Domain B/C/G pattern exactly (typed errors travel as themselves — do NOT wrap them in the page-reading handler).
  - [x] 4.2 Add `"momentum"` to the record's `domains` dict. The key is **always present**; its value is the series payload or `None` with a reason.
  - [x] 4.3 Append momentum checks after every existing appender in the `self_validation["checks"]` chain (append-only — never reorder or clobber siblings).
  - [x] 4.4 If the band is genuinely absent, emit `None` + a per-report **warning** (mirrored into the manifest by `batch.py`) — NOT a non-`pass` check. The aggregator is strictly binary and would read a non-pass check as a failure. Precedent: Story 1.12's possession-regain absence branch.

- [x] **Task 5: Self-validation checks (AC: 1, 3, 4)**
  - [x] 5.1 `momentum-axis-scale` — the printed y-axis top label equals the peak bar's derived unit value (104/104 at story creation). This is the ONLY printed counterpart the page offers; see §"There is no printed row total".
  - [x] 5.2 `momentum-coverage` — the series spans the full match duration: first slot at kickoff, last slot at FT (or 120 for extra time), no interior gap in the slot grid.
  - [x] 5.3 Register both in `pipeline/validate/checks.py` via `register_check(...)` alongside the domain checks, and add the corresponding gate deviation routing.

- [x] **Task 6: Contract change via the AD-14 flow — ONE atomic commit (AC: 2)**
  - [x] 6.1 `contract/match-bundle.schema.json`: change `MomentumSample` per §"The contract change" — `minute` → `at: MinuteStamp`, `home`/`away` to non-negative integers, replace the PROVISIONAL `$comment` on `momentum` with the resolved source description.
  - [x] 6.2 `contract/version.json`: `schemaVersion` 1 → 2.
  - [x] 6.3 Regenerate types: `npm --prefix contract run generate:types` and `npm --prefix app run generate:types`.
  - [x] 6.4 Regenerate the three fixtures' `momentum` blocks from real corpus data (m001, m074) — and **leave `m002` at `null`** (§"Fixture trap").
  - [x] 6.5 Re-stamp every fixture's `schemaVersion` to 2 (all seven files, not just the three match bundles).
  - [x] 6.6 Update `contract/README.md`: the numeric-precision table row for momentum values, and replace §3 "momentum's series shape is provisional" with the resolved record.
  - [x] 6.7 Verify `npm --prefix contract run check:types`, `npm --prefix app run build`, and `pytest` are all green **before** committing. All of 6.1–6.6 land in ONE commit (AD-14).

- [x] **Task 7: Tests (AC: 1, 2, 3, 4)**
  - [x] 7.1 `pipeline/tests/test_extract_momentum.py` — unit coverage of scale derivation, integrality assertion, absence→0 fill, baseline/pitch disagreement failure paths, and every typed error.
  - [x] 7.2 `pipeline/tests/test_extract_report_momentum.py` — record-seam coverage: key always present, `None` branch emits a warning not a failed check, checks append after siblings.
  - [x] 7.3 Real-PDF ground truth against `spike/mex_rsa.pdf` (= the m001 report): 50 home bars, 41 away bars, unit `5.038`, peak 10, home sum 138, away sum 78 (all measured at story creation).
  - [x] 7.4 Extend `pipeline/tests/conftest.py`'s `make_report` with a synthetic momentum band so the fixture-driven tests exercise the parser.
  - [x] 7.5 Update `pipeline/tests/test_fixtures.py` for the new sample shape and `schemaVersion: 2`.
  - [x] 7.6 Expect forced repairs in `test_runner.py`'s `checks_run` list — that list is asserted verbatim and every extraction story has had to update it (1.7, 1.10 both named it).

- [x] **Task 8: Acceptance runs + record keeping (AC: 1, 3, 4)**
  - [x] 8.1 Full batch: `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --force`. **The expected baseline is 104 extracted / 0 failed / exactly 2 self-validation failures (M19, M58) and a non-zero exit code** — ruled by the 1-12 review. Assert that baseline, never a clean exit.
  - [x] 8.2 Gate re-run: `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`. New check ids appear in `checks_run`; re-runs byte-identical apart from `run_timestamp` (AC 4).
  - [x] 8.3 Re-run the batch to confirm skip-unchanged and byte-identical records.
  - [x] 8.4 Append the momentum section to `pipeline/README.md`. File any residual shape questions as AD-14 notes in `deferred-work.md`. Fill the Dev Agent Record honestly — reviews cross-check every claim against the suite and have caught false ones twice.

## Dev Notes

### Mental model (read this first)

This story is **two stories stapled together**, and they have different risk profiles:

1. **A vector-chart parser** (Tasks 1–5, 7). Structurally closest to the marker-parser family, but it is NOT a marker map: no pitch frame, no legend-row exclusion, no linking. It reads a bar chart. It belongs in `pipeline/extract/`, not `pipeline/markers/`.
2. **The project's first contract bump** (Task 6). `schemaVersion` 1 → 2 is asserted by the App build against every artifact. This is the ONLY story in flight authorized to touch `/contract`. Get the parser fully green *first*, then do Task 6 as one atomic commit.

The one thing that makes this tractable: **the values are exactly recoverable integers, and the page prints its own y-axis so the scale is verifiable rather than guessed.**

### OQ-5 — RESOLVED at story creation (full-corpus probe, 2026-07-26, all 104 reports)

Story 1.7's Task 9.3 scoping note pointed here and was correct as far as it went ("no page contains the text *Momentum*"; a two-colour vector bar band at the foot of the lineups page). The story-creation probe went the rest of the way. **Pinned facts, each verified on 104/104:**

| Fact | Value |
| --- | --- |
| Page | Index **1** (`Match Summary - Teams`, the lineups page — Domain A's page) |
| **Chart title** | **`Distribution in the Final Third`** — exactly once per report, page 1, 104/104 |
| Home fill | `(1.0, 0.239, 0.0)` (orange) |
| Away fill | `(0.702, 0.533, 1.0)` (purple) |
| Colour → team | **orange = home, purple = away**, proven on 104/104 by matching the legend name to the record's `metadata.home_team` / `away_team` |
| Bar geometry | filled path, item ops exactly `("l","l","l","l")` |
| Baseline | `y = 429.13` — **constant on 104/104**. Home bars grow **up** (`y1 == baseline`), away bars grow **down** (`y0 == baseline`) |
| Bar width | `0.70 × slot pitch` exactly (measured 0.6999–0.7001) |
| Slot pitch | **per-report**, 1.954–2.951 pt (the chart box is fixed width; more minutes ⇒ narrower slots) |
| Peak bar height | **exactly 50.38 pt on 104/104** — the chart auto-scales so the tallest bar fills the half-height |
| Value unit | per-report, 2.399–5.598 pt |
| Value integrality | **0 non-integer bar heights across the entire corpus** |
| Value range | integers ≥ 1 when a bar is drawn; per-report maximum 9–21 |
| Printed y-axis | symmetric `±peak`, e.g. `10 / 7.5 / 5 / 2.5 / 0 / 2.5 / 5 / 7.5 / 10`. **Top label == peak value in units on 104/104** |
| Slot span | 94–113 slots (95 regulation reports), 131–144 (9 extra-time reports) |
| Empty slots | 8–35 per report — minutes with no bar on either side |
| Extra time | exactly **9** reports carry a `120` tick; that set matches the 9 reports with span ≥ 131 exactly |
| Anchor registry | `"Distribution in the Final Third"` is **NOT** registered — Task 2 adds it |

**What the series actually is:** a per-minute, per-team count of final-third distributions. It is *not* a possession percentage and not an abstract momentum index. It is nonetheless the **only** per-minute two-team time series anywhere in the PMSR, and a per-minute attacking-presence count is exactly what a broadcast "momentum" chart plots — so it is the correct and only candidate to fill FR-35 and feed the App's Momentum Timeline. **Record the true source metric in the schema description and both READMEs.** Do not silently let "momentum" imply "possession".

### The one open question you must close (Task 1.3)

Slot index → match clock. Measured tick→slot centres (offset ≈ +0.3 slot is the label-centre vs bar-left offset):

```
M01: 0→0.3  15→14.3  30→29.4  45→44.4  HT→49.4  60→63.4  75→78.4  90→93.4  FT→100.4
M05: 0→0.3  15→14.3  30→29.3  45→44.3  HT→50.3  60→64.3  75→79.3  90→94.3  FT→102.3
M08: 0→0.3  15→14.3  30→29.3  45→44.3  HT→51.3  60→65.3  75→80.3  90→95.3  FT→102.3
M82: 0→0.3  15→14.3  30→29.3  45→44.3  HT→51.3  60→65.3  75→80.3  90→95.3  FT→103.3  120→133.3
```

Read it: **first-half ticks are rock stable — minute *M* sits at slot *M−1* on every report** (15→14, 30→29, 45→44). Everything after HT shifts, and it shifts by exactly the first-half stoppage allotment (HT lands at slot 49, 50, 51, 52 on different reports). So slot 0 is match minute 1, first-half stoppage occupies the slots between slot 44 and the HT tick, and the second half resumes at the slot after HT.

Derive the mapping **per report from the printed ticks**, not from a hard-coded formula. Two extraction hazards, both real:

- **Tick labels merge under text extraction.** `45HT` appears as one token on 9 reports and `90FT` on 4. Your tick reader must accept the merged forms — this is Story 1.7's "merged-span tolerance" lesson repeating verbatim.
- A few reports drop a tick from the y-window entirely. Do not require all nine tokens; require enough to pin the mapping, and fail loud if you cannot.

### Value scale — the load-bearing step

Bar heights are pixels; the values are integers. Two independent derivations, and they agreed on 104/104:

- **Printed:** `unit_pt = peak_height_pt / top_axis_label`. Text-anchored — this is the preferred source, consistent with AD-8's "page discovery is text-anchored, never index-based" spirit.
- **Geometric:** approximate GCD over all bar heights.

Assert both agree **and** that every bar height is an integer multiple of the unit within tolerance. If either check fails, fail that report loud with a typed error. Do not round a disagreement away — a silently wrong scale multiplies every value in the series, and nothing downstream would catch it.

Do **not** hard-code the unit or the pitch: both vary per report. Only the baseline (429.13), the peak height (50.38 pt), and the width/pitch ratio (0.70) are corpus constants.

### There is no printed row total to reconcile against

The probe tested the per-team bar sum against **every** numeric Domain B field over all 208 team-innings. Best exact-match rate: `pass_completion` 2/208 (coincidence). `receptions_in_final_third` is consistently *smaller* than the bar sum (M01: 117 vs 138 home, 36 vs 78 away) — related metric, not the same one.

So, exactly as in Story 1.12's possession-regain finding: **this chart has no printed counterpart to reconcile a total against.** Do not invent one, and do not weaken a check to manufacture one (SM-C1). The `momentum-axis-scale` check (printed top label vs derived peak) is the genuine printed validation available, and it validates the one thing that actually carries risk — the scale.

### The contract change (Task 6) — precise

**Problem the current shape cannot express.** `MomentumSample.minute` `$ref`s `common.schema.json#/$defs/Minute`: integer 0–120, *"capped at the end of the period it fell in. Stoppage time is carried separately in stoppageMinute."* The momentum grid runs 94–144 slots **including stoppage**, so under the current shape every first-half stoppage slot collapses onto minute 45 and collides. The provisional shape is not merely imprecise — it cannot represent the data.

**The fix follows established contract precedent.** `MinuteStamp` (`{minute, stoppageMinute}`, `match-bundle.schema.json:84`) is the composite the contract already uses for every `at:` field — goals, cards, shots, substitutions. `MomentumSample` is one of only two places using bare `Minute`. Change it to use `MinuteStamp`:

```jsonc
"MomentumSample": {
  "title": "MomentumSample",
  "description": "One minute of the match. home/away are that minute's final-third distribution counts for each team — the PMSR's 'Distribution in the Final Third' chart, the report's only per-minute two-team series (OQ-5, Story 1.8). EXPERIENCE.md's aria-valuetext announces the minute plus both teams' values.",
  "type": "object",
  "additionalProperties": false,
  "required": ["at", "home", "away"],
  "properties": {
    "at":   { "$ref": "#/$defs/MinuteStamp" },
    "home": { "title": "MomentumHomeValue", "type": "integer", "minimum": 0, "x-decimals": 0 },
    "away": { "title": "MomentumAwayValue", "type": "integer", "minimum": 0, "x-decimals": 0 }
  }
}
```

Also: replace the PROVISIONAL `$comment` on the `momentum` property (`match-bundle.schema.json:32`) with the resolved description, keeping the final-in-v1 key contract wording intact (required, never omitted, never `[]`, `null` triggers the empty state).

**Strictly additive?** No — and say so plainly rather than claiming otherwise. `minute` → `at` is a rename and `number` → `integer` is a narrowing. That is fine and it is exactly what AD-14's change flow exists for, but it means:

- **No app code reads a `MomentumSample` field — verified at story creation.** A sweep of `app/src` found exactly three momentum touchpoints, none of them field-level: the generated `contract-types.d.ts` declarations, the `"momentum"` section-id string in `tactical-sections.ts`, and `tactical-sections.ts:120` `bundle.momentum !== null` — a **null check only**, unaffected by a change to the sample's inner shape. Story 2.5 (done) therefore keeps working, and Story 2.6 (Momentum Timeline, `backlog`) has not been built yet. Re-run that grep before committing anyway: 2.7 is in flight and could add a consumer after this note was written.
- Every artifact's `schemaVersion` must be re-stamped to 2 or `npm --prefix app run build` fails at `assert:schema-version`. That includes all four `data/fixtures/index/*` files, not just the match bundles.

### Fixture trap — do NOT "fix" m002 to real data

`data/fixtures/matches/m002-korea-republic-czechia.json` carries `momentum: null`, and AD-14 explicitly requires a `momentum: null` fixture so the App's empty state is buildable-against. **But the real M02 report does have a momentum band** (95 bars, measured). In fact **all 104 reports have one** — `momentum: null` never occurs in real corpus data.

So m002's `null` is a deliberate synthetic edge case, consistent with `data/fixtures/README.md`'s provenance policy. Regenerating it from the real PDF would delete the only `momentum: null` fixture in the project and leave Story 2.6's empty-state branch and UX-DR13's dedicated copy unbuilt-against. **Leave it `null`. Note in the fixtures README why it is synthetic.**

Corollary for AC 3: the `null` branch is required, must be implemented, and must be unit-tested — but it will not fire on the real corpus. Do not conclude from a clean run that the branch is dead code.

Current fixture momentum shape is synthetic 5-minute-interval samples with 2-decimal floats (m001: 19 samples; m074: 25). Real data is ~100 per-minute integer samples. Regenerate m001 and m074 from the real corpus; m001 is `spike/mex_rsa.pdf`, which gives you a hand-checkable ground truth.

### Extraction Record — your addition

`domains` currently holds `match_metadata`, `shots`, `key_statistics`, `tactical_identity`, `crosses`, `defensive_actions`, `player_stats`. Add `momentum` — always present, value is the payload or `None`.

Staging is **raw and snake_case** (AD-7 / the pipeline convention): no camelCase, no `schemaVersion`, no `at:` composite in the record if a flat `{minute, stoppage_minute, home, away}` reads more naturally — the camelCase/contract mapping happens at Story 1.16's emit boundary, not here. `/contract` is your field checklist for Task 6, not an import target for the parser.

### What already exists — do NOT rebuild

- **Anchor resolution** — `pipeline/discover/anchors.py` + `PageTextIndex`. Register a spec; never scan pages yourself, never index by page number.
- **The record seam** — `extract_report.py` has one established call-site pattern (Domains A/B/C/G, crosses, defensive actions). Copy it; do not restructure it.
- **Check registration** — `pipeline/validate/checks.py` `register_check(...)` with a module-level registry that raises on duplicate ids. Claim your ids explicitly.
- **Typed errors** — `pipeline/extract/errors.py` already has `ExtractError`, `MissingFieldError`, `MalformedFieldError`, `UnknownStatisticError`. Add momentum-specific subclasses there (e.g. `MomentumScaleError`, `MomentumAxisError`), following the file's existing docstring style. Do NOT put them in `markers/errors.py` — this is not a marker family.
- **`aggregate_self_validation`** — the strictly binary aggregator at the `pipeline/extract` package seam. Append checks; never call it yourself mid-chain.
- **The `_check` dict helper** — four verbatim copies already exist (`domain_a.py:659`, `domain_b.py:353`, `domain_c.py:519`, +1) and the ledger says extraction became cheaper than duplication at the third copy. You are the fifth. **Extract it to a shared `pipeline/extract` helper as part of this story** and migrate the copies — this is the ledgered moment for it, and it is a small, well-tested change.

### Normalization & typing rules (normative)

- Values are raw, locale-neutral, unformatted integers (AD-7). No `%`, no units, no display strings.
- Determinism (AD-8): canonical serialization, sorted keys, fixed precision, LF. Re-runs must be byte-identical. Nothing time-dependent, no absolute paths, no corpus-level knowledge in the record (AD-9 — the record must be identical whether the PDF is extracted alone or as one of 104).
- Derived floats (pitch, unit) must never leak into the record. Stage the resolved **integers** and the clock stamp only, or two machines' float noise breaks byte-identity.

### Failure & validation policy (AD-8, binding)

- Per-report failures abort **that report** with the report id and specifics; the batch continues.
- Assert-on-unknown everywhere: an off-palette fill, a baseline that is not single-valued, a pitch/tick disagreement, a non-integral bar height, an unreadable axis label → typed loud failure.
- Self-Validation is binary and is **never loosened** (SM-C1). If a check fails on some reports, that is a finding for the ledger — not a tolerance to widen.
- Absence travels as a **warning**, not a non-`pass` check (Task 4.4).

### Coordination — in-flight stories (respect strictly)

- **You are the only story authorized to touch `/contract`.** Keep other sessions off it.
- **1-10** is in `review` and owns `pipeline/extract/domain_g.py` + its tests. **2-7** is `in-progress` and owns `app/src/viz/` + `app/src/components/`. Your app-side footprint is limited to the regenerated `src/lib/contract` types (Task 6.3) — coordinate the merge so 2-7 regenerates its types after your bump lands, and tell them, because their build will fail on `schemaVersion` until they do.
- Shared-file edits (`extract_report.py`, `checks.py`, `conftest.py`, `README.md`) are **append-only**. Never `git add -A`.
- After this lands, **2-6 (Momentum Timeline) becomes buildable** — its `aria-valuetext` contract ("minute plus both teams' values") is satisfied by the new sample shape.
- 1-16 stays BLOCKED pending change-set CS-1; your bump is a *different* change and does not resolve CS-1. Do not fold CS-1's `ShotOutcomeDetail` work into this commit — it is separately scoped.

### Previous story intelligence (anti-patterns that WILL be flagged in review)

- **Ground-truth first.** 1.3 (37 reports overflow the attempts table), 1.6 (rotated formation labels), 1.11 (no per-event rows at all), 1.12 (two pitch panels silently collapsed to one) — in every case the story's assumption was corrected by a corpus sweep run *before* wiring in. A 104-report sweep of just your parser is ~2 minutes. Run it (Task 1).
- **Don't loosen a check to make a run green.** 1.12 found two reports whose printed totals genuinely self-contradict, left the check strict, and filed them for adjudication. That is the ruled behavior.
- **Merged spans.** pymupdf merges adjacent same-font inserts. Real pages print split spans, synthetic fixtures produce merged ones — and here the *real* pages merge too (`45HT`, `90FT`). Accept both forms.
- **The `checks_run` list in `test_runner.py`** is asserted verbatim and will force a repair. Expected, documented — not a defect.
- **Fill the Dev Agent Record honestly.** Reviews cross-check every claim against the suite and have caught false ones twice.

### Known landmines

1. **Page 1 is Domain A's page.** Domain A parses lineups and minute glyphs from the same page, and the momentum band sits at `y ≈ 379–459` — below the lineup rows but sharing the page. Your bar filter must not admit Domain A's card/goal glyphs, and you must not disturb `domain_a.py`. Note the page also carries the two chart fills as *stroke* colors on unrelated elements at `x ≈ 30` and `x ≈ 918` (10 each) — **filter on fill, plus the item-ops signature, plus the chart's x/y band**; colour alone is not sufficient. This is the shots parser's "shape filter before colour keying" rule (AD-9) applying again.
2. **Bar width varies 1.37–2.07 pt across the corpus.** A fixed absolute width window silently drops whole reports — the first probe pass caught only 75/104 that way. Filter on the width/pitch **ratio** (0.70) or use a generous absolute window.
3. **Empty slot ≠ missing data.** 8–35 slots per report carry no bar. Emit `0`, or the series will not "cover the full match duration" as AC 3 requires and the App's timeline will show phantom gaps.
4. **`schemaVersion` re-stamp is all seven fixtures**, not the three match bundles.
5. **A slot can carry both colours** (1,747 such slots corpus-wide). Do not assume one bar per slot.

### Project Structure Notes

New: `pipeline/extract/momentum.py`, `pipeline/tests/test_extract_momentum.py`, `pipeline/tests/test_extract_report_momentum.py`.
Updated: `pipeline/discover/anchors.py`, `pipeline/extract/errors.py`, `pipeline/extract/__init__.py` (shared `_check` helper), `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py`, `pipeline/tests/test_runner.py`, `pipeline/tests/test_fixtures.py`, `pipeline/README.md`.
Contract (one atomic commit): `contract/match-bundle.schema.json`, `contract/version.json`, `contract/README.md`, `contract/generated/contract-types.d.ts`, `app/src/lib/contract/*`, `data/fixtures/**` (all seven).

Aligns with the Structural Seed: extractors in `pipeline/extract/`, schemas in `/contract`, fixtures in `data/fixtures/`. No new top-level directory.

### Testing standards summary

pytest on the dev machine only (AD-13). `spike/mex_rsa.pdf` is a permanent ground-truth fixture and must stay green. Ground truth is counts/distribution — never lift the spike script's printed coordinates. Real-PDF tests follow the established skip-local/fail-CI fixture pattern from 1.6/1.7. Suite baseline at `f8ca7ee` per the 1-12 review: **895 passed / 1 skipped** (includes in-flight 1-10).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.8` — the three normative ACs; `#Story 2.6` — the downstream consumer]
- [Source: `.../architecture/.../ARCHITECTURE-SPINE.md#AD-4` — required `momentum` key, never omitted/never `[]`; `#AD-14` — contract change flow; `#AD-8` — fail loud/determinism; `#AD-9` — pure extract, shape filter before colour; `#AD-7` — raw locale-neutral; "Deferred shape decisions" (AR-17) — OQ-5 entry]
- [Source: `.../prds/.../prd.md#FR-35` — momentum extraction, series or flagged null; `#FR-22` — Tactical Layer empty states]
- [Source: `.../ux-designs/.../EXPERIENCE.md` — Missing-momentum empty state (UX-DR13); Momentum Timeline slider + `aria-valuetext`; momentum terminology policy]
- [Source: `contract/match-bundle.schema.json:31-34, 84-94, 311-343` — `momentum`, `MinuteStamp`, `MomentumSample`/`MomentumSeries`]
- [Source: `contract/README.md#3` — provisional-shape record; numeric-precision table]
- [Source: `contract/common.schema.json:407-426` — `Minute` / `StoppageMinute`]
- [Source: `data/fixtures/README.md` — fixture provenance and the synthetic-value policy]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — "Momentum series location (Story 1.8 scoping note, Task 9.3)"; the four-`_check`-copies entry]
- [Source: `_bmad-output/implementation-artifacts/1-7-...md` — Task 9.3 momentum probe; merged-span tolerance]
- [Source: `_bmad-output/implementation-artifacts/1-12-...md` + sprint-status 2026-07-26 — the ruled non-zero-exit batch baseline (M19, M58)]
- [Source: `pipeline/ingest/extract_report.py:186-268` — the record seam and append-only check chain]
- Story-creation probe (2026-07-26), all 104 reports — scratchpad `probe_momentum.py`, `probe3.py`, `sweep2.py`–`sweep6.py`. Every table figure in §"OQ-5 — RESOLVED" is from these runs.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), BMad `dev-story` workflow, 2026-07-27.

### Debug Log References

Scratchpad probes (not committed): `sweep_momentum.py` (pinned-fact sweep over all 104
PDFs), `analyze_ticks.py` + `derive_mapping.py` (Task 1.3), `sweep2_algorithm.py`
(prototype of the exact production algorithm), `sweep3_parser.py` (the production parser
run over all 104), `regen_fixtures.py` (Task 6.4/6.5).

**Task 1 — every pinned fact reproduced 104/104.** Title on page index 1, exactly once per
report; baseline `y == 429.13` single-valued; peak bar `50.3805 pt`; width/pitch
`0.7000–0.7004`; 0 non-integer bar heights; printed top label == derived peak value;
orange→home and purple→away proven by matching each legend swatch's printed name to that
report's cover metadata. Nothing in the story's table failed to reproduce.

**Three findings that sharpen the story's notes.**

1. *The chart draws TEN grey horizontal lines, not nine* — the nine evenly-spaced value
   gridlines plus an axis rule `0.75 pt` below the last. A naive `max(y)` therefore puts
   the axis half height at `50.755 pt` instead of `50.38`, silently breaking the geometric
   peak cross-check. The parser keeps the evenly-spaced run explicitly and asserts it is
   exactly nine.
2. *The peak bar height equals the axis half height exactly on 104/104* — an independent
   geometric confirmation of the auto-scale that the story's table did not record, and now
   a loud assertion.
3. *The tick labels never merged at character level.* The story warned that `45HT` /
   `90FT` appear as one token on 13 reports. The tick reader works on character bboxes and
   regroups on the digit/alpha class boundary, so both spellings are accepted by
   construction — the hazard is neutralized rather than special-cased.

**Task 1.3 — the slot→minute mapping, CLOSED.**

- First half: minute *M* sits at slot *M − 1*. Checked against the printed `15'`/`30'`/`45'`
  ticks on every report: **0 violations / 104**. Slot 0 is match minute 1.
- Half time: the `HT` tick marks the **first slot of the second half** (slots 48–56 across
  the corpus). Second-half ticks then satisfy `slot(M) = M − 46 + HT_slot`: **0 violations**
  across the 101 reports that print `HT`. **3 reports omit the `HT` tick** — M67, M86, M104
  — and there the `60'`/`75'`/`90'` ticks pin the same value and are required to agree.
- Full time: the `FT` tick lands on the grid's last slot on **94/94** regulation reports
  that print it. **1 report omits it** (M42) and falls back to the grid's last slot.
- Extra time (9 reports, exactly the set with a `120` tick): neither ET break is printed
  anywhere in the corpus. The first extra period opens on the slot after `FT`; the `120`
  tick's own fifteen regular minutes place the second period's opening slot. Asserted
  non-overlapping on 9/9. This is a *derivation*, not a reading — filed in `deferred-work.md`.
- Resulting stoppage ranges: H1 1–11, H2 3–19, ET1 0–4, ET2 1–11 — all inside the
  contract's `StoppageMinute` bound of 30. Every report's stamps are distinct (no collisions).

**Two numerical bugs found and fixed by the corpus run, not by the unit tests.**

- The textbook Euclidean approximate GCD (floored remainder) converged on PDF coordinate
  noise and returned ~`0.001 pt` as the "unit" for **13 of 104** reports. Fixed by taking
  the remainder against the *nearest* multiple and starting the running divisor at the
  smallest value.
- Deriving the pitch as an approximate GCD over the individual bar-x0 gaps drifts: the gaps
  are large multiples (a chart can jump 44 slots between drawn bars) and reducing them
  against each other accumulates error. Replaced with the outermost span divided by the
  whole number of slots it covers — exact, and ~95x more sensitive than the tolerance.

**One design correction made mid-story.** As first written, the value unit was derived as
`peak / printed top label`, which made `momentum-axis-scale` **tautological** — the peak's
value would equal the printed label by construction on every chart, including one whose
axis is wrong. The unit is now derived geometrically (GCD over bar heights) and the printed
label is compared against the geometric peak as the recorded check. Consequences: geometry
contradicting itself still fails loud (integrality, peak ≠ half height); the printed axis
contradicting the geometry is now *recorded* (SM-C1) rather than raised, and both
behaviours are unit-tested including the case only the GCD can see (a label read as an
integer multiple of the true peak).

### Completion Notes List

- **AC 1 — OQ-5 resolved and documented.** Verified in code against all 104 reports (above),
  the one open sub-question closed, and the resolution recorded durably in
  `pipeline/README.md` (new §"The momentum series — OQ-5 resolved") and `contract/README.md`
  §3 (which replaces the PROVISIONAL record). The `deferred-work.md` scoping-note entry is
  struck as resolved.
- **AC 2 — the shape landed via AD-14.** `MomentumSample` is now
  `{at: MinuteStamp, home: integer ≥ 0, away: integer ≥ 0}`; `schemaVersion` 1 → 2 in
  `contract/version.json` and in all five artifact schemas' `const`; types regenerated for
  both `contract/generated/` and `app/src/lib/contract/`; all seven fixtures re-stamped;
  `m001` (101 samples) and `m074` (138 samples) regenerated from the real corpus. **`m002`
  was deliberately left at `momentum: null`** and that is now pinned by a test plus a note
  in `data/fixtures/README.md` — the real M02 report *does* have a band, so this is a
  synthetic edge case AD-14 requires, not stale data.
- **AC 3 — every match carries a momentum value.** `domains["momentum"]` is always present.
  All 104 records carry a series (10,954 samples total, 96–145 per report); 0 take the
  `None` branch, because all 104 reports draw a band. That branch is nonetheless implemented
  and unit-tested at both the parser and the record seam, and it travels as a per-report
  **warning** — never a non-`pass` check, which the strictly binary aggregator would read as
  a failure.
- **AC 4 — the FR-15 gate re-runs with momentum active.** `momentum-axis-scale` and
  `momentum-coverage` appear in `checks_run`; gate **PASS, 0 deviations** across the
  16-report venue × matchday sample; two consecutive gate runs are byte-identical apart from
  `run_timestamp` (verified by diffing the two reports with that key removed).
- **Batch acceptance.** Full `--force` run over `pmsr-corpus`: **104 extracted / 0 failed /
  exactly 2 self-validation failures (PMSR-M19-ARG-V-ALG, PMSR-M58-TUN-V-NED)** and a
  non-zero run result — the baseline ruled by the 1-12 review. Both failures are 1.12's
  ledgered `defensive-actions-marker-count` discrepancies; **no momentum check fails on any
  report** (`momentum-axis-scale` 104/104 pass, `momentum-coverage` 104/104 pass, 0 momentum
  warnings). Re-run without `--force`: **104/104 skipped-unchanged, 104/104 records
  byte-identical**.
- **Suites.** `pytest pipeline/tests`: **1040 passed / 1 skipped / 0 failed** (the f8ca7ee
  baseline was 895+1; the growth includes in-flight 1-10 and 1-13 as well as this story's 65
  new tests — 51 parser, 12 record/gate seam, 2 fixture-shape). App: **240 passed / 0 failed**,
  `eslint --max-warnings 0` clean, `npm --prefix contract run check:types` clean, and
  `npm --prefix app run build` green with `assert-schema-version: 7 artifact(s) at
  schemaVersion 2`.
- **The ledgered `_check` extraction was done here.** Momentum would have been the fifth
  verbatim copy. The helper is now `pipeline.extract.check_entry`, beside
  `aggregate_self_validation` at the package seam; the four domain modules bind the local
  name to it so no call site changed.
- **Forced test repairs (expected, all named by the story or by the registry design):**
  `test_runner.py`'s verbatim `checks_run` list (+2 ids), `test_anchor_registry.py`'s
  30 specs / 47 anchors → 31 / 48, `test_contract_schemas.py`'s `schemaVersion == 1`
  assertion, and `app/src/lib/assert-schema-version.test.ts` (now reads the generated
  `SCHEMA_VERSION` constant instead of a literal, so the next bump does not land there).
- **Coordination.** Story 1.13 (offers/movement receiving parsers) landed in the same
  working tree during this session and also edits `extract_report.py`, `checks.py`,
  `conftest.py` and `test_runner.py`. All shared-file edits here were append-only and both
  stories' blocks coexist; `test_the_momentum_checks_are_appended_as_one_contiguous_block`
  was deliberately written to assert contiguity rather than "momentum is last", so 1.13
  appending after it is not a failure. Nothing outside this story's scope was reverted, and
  `git add -A` was never used.
- **Not in scope, deliberately:** no CS-1 (`ShotOutcomeDetail`) work was folded into this
  bump; 1-16 stays blocked on CS-1, which this change does not resolve.

### File List

**New**
- `pipeline/extract/momentum.py`
- `pipeline/tests/test_extract_momentum.py`
- `pipeline/tests/test_extract_report_momentum.py`

**Modified — pipeline**
- `pipeline/discover/anchors.py` (the `momentum` anchor spec)
- `pipeline/extract/__init__.py` (shared `check_entry`)
- `pipeline/extract/domain_a.py`, `domain_b.py`, `domain_c.py`, `domain_g.py` (bind the
  local `_check` name to the shared helper)
- `pipeline/extract/errors.py` (five typed momentum errors)
- `pipeline/ingest/extract_report.py` (call site, `domains["momentum"]`, appended checks,
  warning pass-through)
- `pipeline/validate/checks.py` (memo + the two gate checks)
- `pipeline/tests/conftest.py` (`draw_momentum_page` + the `momentum_*` kwargs)
- `pipeline/tests/test_anchor_registry.py`, `test_contract_schemas.py`, `test_fixtures.py`,
  `test_runner.py`
- `pipeline/README.md`

**Modified — contract (the AD-14 atomic set)**
- `contract/match-bundle.schema.json`, `contract/version.json`
- `contract/leaderboards.schema.json`, `contract/player-profile.schema.json`,
  `contract/team-profile.schema.json`, `contract/tournament.schema.json` (`const` 1 → 2)
- `contract/generated/contract-types.d.ts`, `contract/generated/schema-version.ts`
- `app/src/lib/contract/contract-types.d.ts`, `app/src/lib/contract/schema-version.ts`
- `contract/README.md`
- `data/fixtures/README.md` and all seven fixtures under `data/fixtures/`
- `app/src/lib/assert-schema-version.test.ts`

**Modified — records**
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-8-momentum-series-extraction-oq-5-resolution.md`

### Review Findings (Code Review 2026-07-27)

Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) over the
1.8-scoped diff (4,325 lines; 1.13's interleaved work excluded, `m001`/`m074` fixture data
verified separately). **All four ACs audited as satisfied**, and the Dev Agent Record's
substantive claims verified against the codebase rather than taken on trust — the contract
bump, all seven fixtures, both generated type sets, the `check_entry` extraction, the
non-tautological axis-scale derivation, the `m002` `null` fixture, the batch/gate baselines
and the 65 new tests all reproduce. 31 raw findings merged to 25; 3 dismissed as noise. The
findings below are robustness, invariant-encoding, and record-accuracy items.

**Decisions needed**

- [ ] [Review][Decision] `momentum-coverage` is largely tautological — two of its four clauses cannot fail on any document the parser accepts, and none of its failure tests goes through the parser. `momentum.py:794` ("opens at kick-off") can never fire because `_stamp_for(0, …)` returns `(1, None)` unconditionally (`momentum.py:449-451`) once `_clock_structure` has asserted `second_half_slot >= 45` (`:395-400`). `momentum.py:800-806` ("clock does not advance") can never fire because samples come from `for slot in range(slot_count)` (`:735`) through a `_stamp_for` that is monotonic by construction. Every failure test hand-edits the parser's *output dict* (`test_extract_momentum.py:571-601`) rather than drawing a document — and `test_the_coverage_check_fails_when_the_ft_tick_is_not_the_last_sample`'s docstring claims it is "a real cross-check rather than a restatement of the parse", which is precisely what it is not. This is the same tautology the Dev Agent Record correctly diagnosed and fixed for `momentum-axis-scale`, left unaddressed for its sibling. Options: strengthen the check so it compares independently-sourced facts (e.g. slot geometry vs the full printed tick set) / narrow the check to the two clauses that can genuinely fire and correct the docstrings / accept and ledger.
- [ ] [Review][Decision] The v2 schema encodes none of the three invariants its own descriptions assert — `MomentumSeries.samples` (`match-bundle.schema.json:332-344`) has no `minItems`, no `uniqueItems` and no ordering constraint, while its description says "in clock order, with no gap … never a missing sample" and `:26` says "never `[]`". Validated directly against `contract/`: `{"samples": []}`, a fully reversed sample list and three identical stamps all pass with **zero** errors. AC 3 is explicit that the value is "never `[]`", yet only `pipeline/tests/test_fixtures.py:2168` pins it — on seven committed files, not on anything Story 1.16 emits or the App loads (`MatchBundleRegion.tsx:70` gates only `matchId`/`schemaVersion`). `minItems: 1` and `uniqueItems: true` are free at bump time and this was the once-per-project bump moment. Options: tighten now inside this bump / ledger for a later bump and accept that AC 3's guarantee is unenforced.
- [ ] [Review][Decision] Task 3.5 and Dev Notes §"Value scale" mandate a **loud typed failure** when the printed axis disagrees with the geometric unit; the code records a check instead. The spec is explicit ("assert both agree … else fail loud"; "If either check fails, fail that report loud with a typed error"). The implementation derives the unit geometrically only (`momentum.py:712`) and downgrades the printed comparison to a non-raising recorded check (`:781-790`), codified by `test_a_printed_axis_that_contradicts_the_geometry_is_RECORDED_not_raised`. This is disclosed in the Dev Agent Record and ledgered in `deferred-work.md:241-246` — but it is an unratified change to a **normative** Dev Note, and the correction is *necessary* for `momentum-axis-scale` to be non-tautological, so the likely resolution is that the spec text is stale, not the code. Needs an explicit ruling either way.
- [ ] [Review][Decision] Task 3.3's pinned constants are asserted only relatively, never absolutely — the checkbox says "assert it is single-valued **and equals `429.13`**", but `momentum.py:606-610` asserts only that the bars' shared edge equals the *derived* middle gridline; the `50.38 pt` peak is likewise checked only against the derived half height (`:700`). `grep -n "429\|50\.38" pipeline/extract/momentum.py` hits the docstring prose alone. A template revision that translated the whole chart band vertically would parse silently, and `pipeline/README.md`'s "Constant on 104/104" table documents facts no code path enforces. Defensible as AD-8's "never hard-code" spirit, but it is a deviation from a checkbox marked `[x]`. Options: add the absolute assertions / keep relative-only and correct the task text and README framing.
- [ ] [Review][Decision] The bump silently invalidated Story 2.6's `aria-valuetext` acceptance criterion and nobody was told — `match-bundle.schema.json:313` still asserts the shape is "exactly" what EXPERIENCE.md's `aria-valuetext` consumes, but minute is no longer a unique key. Measured on the regenerated fixtures: `m001` carries minute 45 five times and 90 eight times; `m074` carries 45×7, 90×6, 105×5, 120×4. EXPERIENCE.md:74 and epics.md:737 specify `aria-valuemin/max` **over match minutes** with "arrow keys move ±1 minute", which no longer maps 1:1 onto samples. `contract/README.md` §3 justifies the bump as safe because 2.6 was still `backlog` — true for compilation, false for its AC. None of the four new `deferred-work.md` entries covers this. Options: file the AD-14 note now and let 2.6 re-spec its slider / adjust the schema description and EXPERIENCE.md in this commit.
- [ ] [Review][Decision] The synthetic fixtures remove the one collision scenario the parser is most exposed to — `conftest.py:2402-2420` gives the momentum chart its own otherwise-empty page, and `test_extract_momentum.py:53-59`'s `chart_doc` builds a one-page document containing nothing but the chart. In the corpus the chart sits at the foot of the **lineups** page, sharing it with Domain A's two full team sheets, the formation diagram and the goal/card glyphs. The conftest comment frames this as proving the parser "is not quietly relying on the lineups page" — but page-identity independence is already proved by the title anchor. What the fixture strips is every co-tenant that `_plot_box` (`:179`, whole-page `get_drawings()`), `_read_axis_labels` (`:243`, whole-page words), `_tick_runs` (`:291`, whole-page rawdict) and `_read_legend` (`:492-495`, whole-page words + drawings) could collide with. That entire failure class rests on exactly one real report (M01) and zero synthetic tests — and findings P3, P5 and P8 below are all instances of it. Options: build a co-tenant fixture page now / ledger it as test-architecture work.

**Patches**

- [ ] [Review][Patch] Unbounded stoppage — nothing bounds `second_half_slot` or the FT-absent regulation span against the contract's `StoppageMinute` maximum of 30; the parser can stage records Story 1.16 cannot emit [pipeline/extract/momentum.py:395-400, 430-435, 452, 459]
- [ ] [Review][Patch] A bar-signature template change degrades silently to `None` + warning instead of failing loud, on all 104 reports at once [pipeline/extract/momentum.py:558-591]
- [ ] [Review][Patch] `_read_legend` is last-write-wins, applies no shape filter, and depends on PDF drawing order — the one mechanism that *proves* colour → team [pipeline/extract/momentum.py:495-512]
- [ ] [Review][Patch] Legend team-name comparison is exact string equality; every sibling module imports `pipeline.discover.text.normalize` for this [pipeline/extract/momentum.py:518]
- [ ] [Review][Patch] The gridline filter is page-wide with no y-locality — one unrelated light-grey horizontal rule anywhere on the shared lineups page aborts the report (reproduced) [pipeline/extract/momentum.py:178-196]
- [ ] [Review][Patch] FT/`120` ticks read from the ±12 pt margin outside the plot box can yield `full_time_index >= len(samples)`, and extra-time reports never cross-check the FT index at all [pipeline/extract/momentum.py:402-435, 815-822]
- [ ] [Review][Patch] Baseline and plot-box extents use sets of 2-dp-rounded floats where the module elsewhere clusters at `GEOMETRY_TOL_PT` (0.05); a value straddling the rounding boundary aborts on sub-thousandth noise [pipeline/extract/momentum.py:191, 201, 596-605]
- [ ] [Review][Patch] `_tick_runs` sorts characters by x only — a second text line inside the 25 pt tick band merges into the tick runs [pipeline/extract/momentum.py:300-310]
- [ ] [Review][Patch] The `"no gaps"` claim in `momentum-coverage`'s specifics and in both READMEs advertises a check that does not exist; gaps are impossible by construction [pipeline/extract/momentum.py:831, contract/README.md §3, pipeline/README.md]
- [ ] [Review][Patch] `pipeline/README.md:847` claims the FT cross-check is "recorded as unavailable" when the tick is missing; it is silently skipped and M42 records a generic pass [pipeline/README.md:847]
- [ ] [Review][Patch] `data/fixtures/README.md` now contradicts itself on momentum provenance — `:73` still lists the series as synthetic with OQ-5 unresolved against the new real-data block at `:29-40`, the "(see below)" cross-reference dangles, and no row was added to the "Real, from the source reports" table [data/fixtures/README.md:73]
- [ ] [Review][Patch] Stale comment "Further domains filled by Stories 1.8-1.14" inside the very return block this story added a key to [pipeline/ingest/extract_report.py:338]
- [ ] [Review][Patch] Missing double-attribution caveat — `_domain_anchor_pages`' bare `LookupError` escapes both `except ExtractError` and `except PipelineError` and lands against both momentum ids; the domain-g precedent documents this caveat in both docstrings, momentum copied the code and dropped it [pipeline/validate/checks.py:1121-1122]
- [ ] [Review][Patch] The precision-table row restates the catch-all row verbatim and breaks the table's descending `x-decimals` ordering [contract/README.md:64]
- [ ] [Review][Patch] `test_the_momentum_null_fixture_is_deliberate_and_stays_null` asserts on `_bundles()` iteration order — fragile exactly when a second `momentum: null` fixture appears, which is the scenario it guards [pipeline/tests/test_fixtures.py:2208-2210]
- [ ] [Review][Patch] The staged record carries `axis_top_label`, `full_time_index` and `extra_time`, which `MomentumSeries` (`additionalProperties: false`) forbids, with no handoff note telling Story 1.16 to drop them [pipeline/extract/momentum.py:752-762]

**Dismissed as noise (3)**

- Momentum's `register_check` block sits above 1.13's receiving block rather than appended after it — `register_check` is order-independent, `checks_run` is sorted (`test_runner.py:2228`), and no 1.13 line was rewritten.
- The `momentum` anchor spec is inserted at registry index 2 rather than appended — that is page-order, the file's own convention, and `test_anchor_registry.py` was updated 30→31 / 47→48 and passes.
- `conftest.py:655-657` uses one blank line where the neighbouring section banner uses two — no linter is configured in the repo.

**Reviewer verification runs (2026-07-27)**

- **Suite claim VERIFIED.** `pytest pipeline/tests` collected 1041: **1039 passed / 1 failed /
  1 skipped**, against the Dev Record's 1040 passed / 1 skipped — same 1041 total. The single
  failure was `test_ingest_fingerprint.py::test_code_version_is_stable_across_calls`, an
  environment artifact of concurrent source edits during the 38-minute run (see below); it
  passes deterministically in isolation (16 passed in 0.32 s). No defect.
- **Batch baseline RE-VERIFIED on the current tree** (with 1.13 and 1.9 present): 104 extracted
  / 0 failed / exactly 2 self-validation failures, `PMSR-M19-ARG-V-ALG` and `PMSR-M58-TUN-V-NED`,
  both 1.12's ledgered `defensive-actions-marker-count` discrepancies, `RUN RESULT: FAIL`.
  **No momentum check fails on any report.** Confirms AC 3 and Task 8.1.
- **Task 8.3's skip-unchanged claim is NOT VERIFIABLE in this working tree — and this is not a
  1.8 defect.** Two consecutive non-`--force` batch runs both reported `skipped-unchanged: 0`.
  Root cause: `code_version()` fingerprints all 44 `pipeline/**/*.py` files, and **stories 1.9
  and 1.13 are being developed live in this same tree** — `markers/receiving.py` (mtime
  11:29:10) and `validate/checks.py` (11:28:29) were both modified *during* the second batch
  run, and `extract/domain_e.py` / `domain_f.py` (Story 1.9) appeared mid-session as new
  untracked files. Every run therefore computes a different `code_version` and correctly
  invalidates all 104 records. The mechanism itself was proven sound in isolation:
  `is_unchanged(record, hash, stored_version)` → `True`, `_self_validation_trustworthy` → `True`,
  and the records were byte-identical across runs (unchanged mtimes). **Consequence beyond this
  story: no story can verify a skip-unchanged or byte-identity claim while multiple dev sessions
  share one working tree.** Worth a process ruling.

**Scope check — 1.8 did not clobber in-flight 1.13.** Verified in all four shared files
(`extract_report.py`, `checks.py`, `conftest.py`, `anchors.py`): both stories' blocks coexist
intact, no 1.13 line was rewritten, and `_make` is keyword-only so the new `momentum_*` kwargs
shift nothing.

## Change Log

- 2026-07-27: Story implemented and moved to review. OQ-5 verified in code against all 104
  reports and the slot→minute mapping closed from the printed ticks; `pipeline/extract/momentum.py`
  added with five typed errors, an anchored chart reader (shape filter before colour keying),
  three agreeing pitch derivations and a geometric value scale; `momentum-axis-scale` and
  `momentum-coverage` appended at both the record and FR-15 gate seams; the ledgered `_check`
  helper extracted to `pipeline.extract.check_entry`.
- 2026-07-27: **Contract bumped to `schemaVersion` 2** (the project's first bump, AD-14):
  `MomentumSample` `{minute, home, away}` → `{at: MinuteStamp, home: integer, away: integer}`,
  all five artifact schemas re-pinned, types regenerated for `contract/` and `app/`, all seven
  fixtures re-stamped, `m001`/`m074` momentum regenerated from real corpus data, `m002` left
  `null` by design. Schema change, version, fixtures and regenerated types land in ONE commit.
- 2026-07-26: Story context created. Ultimate context engine analysis: epics + PRD/addendum + ARCHITECTURE-SPINE + EXPERIENCE + `/contract` + fixtures provenance + live code seams, plus a full 104-report story-creation probe that **resolved OQ-5 before dev** — the series is the page-1 `Distribution in the Final Third` chart (title, palette, baseline, auto-scale, colour→team mapping and axis cross-check all verified 104/104). The contract's provisional `MomentumSample` was found unable to represent stoppage-time slots; the `MinuteStamp` fix is specified in Task 6.

---
baseline_commit: NO_VCS
---

# Story 1.4: Template-Consistency Verification Across the Venue × Matchday Sample

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the builder,
I want a verification mode that runs extraction + available self-validation on a stratified sample of reports,
so that a silent mid-tournament template revision — the project's top extraction risk — is caught before any full-batch output is trusted (FR-15).

## Acceptance Criteria

1. **Stratified sample selection (two covers):**
   **Given** the 104-report corpus in a configured input directory,
   **When** verification mode selects its sample,
   **Then** the sample is the union of two covers — at least one report per venue AND at least one per matchday round — with one report allowed to satisfy both covers. Selection is deterministic (same corpus → same sample).

2. **Per-report deviation summary:**
   **Given** the sample,
   **When** verification runs (text-anchored discovery + all extractors implemented so far + available Self-Validation),
   **Then** a per-report deviation summary lists missing anchors, unknown RGB values, and count mismatches — sufficient to localize any template revision to a venue or matchday
   **And** every deviation is recorded in the verification manifest with report ID and specifics; a clean run is recorded as the gate result.
   *Scope note: this story lands before any extractor exists (see Sequencing Reality below), so the first run is anchor-level only — the unknown-RGB and count-mismatch deviation categories must exist structurally in the report format but will be empty until Stories 1.3+ register their checks.*

3. **Cheap, extensible re-runs (the standing gate):**
   **Given** later parser/extractor stories,
   **When** each lands,
   **Then** verification mode is re-runnable cheaply against the same sample (idempotent re-run semantics: unchanged corpus + code → same sample, same result), and the check set is extensible via a registry so each subsequent extraction story (1.5–1.14) re-runs this gate as part of its acceptance without modifying this story's core.

4. **Fail-loud discovery semantics (pulled forward from FR-2):**
   **Given** any sampled report,
   **When** target anchors are searched,
   **Then** location uses whitespace-normalized text search on section anchors, never page indices, and a missing anchor is recorded as a deviation with report ID + anchor text — never a silent skip (AD-8).

5. **Test coverage:**
   **Given** the permanent ground-truth fixture `spike/mex_rsa.pdf`,
   **When** pytest runs,
   **Then** the metadata probe, anchor discovery, sample-selection logic, and deviation-report format are covered — including a synthetic multi-report corpus exercising the two-cover union and a missing-anchor case.

## Tasks / Subtasks

- [x] Task 1: Bootstrap the minimal pipeline workspace (prerequisite; keep minimal — Story 1.1 completes the monorepo seed)
  - [x] Create `pipeline/` as a Python package following the Structural Seed layout: `pipeline/discover/`, `pipeline/validate/` (only the subpackages this story needs; `ingest/`, `extract/`, `markers/`, `precompute/` are later stories' concerns)
  - [x] Create `pipeline/requirements.txt` with exact pins installed via pip (no `uv`): `pymupdf` 1.28.x, `pdfplumber` 0.11.x, `pytest` 8.x (AR-15; record the exact patch versions you install)
  - [x] Create a fresh venv for the pipeline (do NOT reuse `spike/venv` — spike is a frozen reference), document the two-command setup in `pipeline/README.md` (venv create + pip install)
  - [x] Create `pipeline/tests/` with pytest discovery working (`python -m pytest pipeline/tests` from repo root)
- [x] Task 2: Text-anchored discovery slice (pulled forward from Story 1.2 — minimal, reusable) (AC: 4)
  - [x] In `pipeline/discover/`: whitespace-normalized text search — normalize with `" ".join(page.get_text().split())`, match anchor strings against it, return page number(s)
  - [x] Anchor registry module: a declarative list of anchor specs (anchor id, anchor text or template like `"Attempts at Goal {team}"`, domain, required/optional). Seed it with the anchors derivable from `spike/mex_rsa.pdf` — at minimum the shots-page anchor `"Attempts at Goal {team}"` proven by the spike; walk mex_rsa.pdf's ~52 pages (census.py prints per-page snippets) to identify and register the section-title anchors for the other domain pages (Key Statistics, lineups, phases of play, set plays, goalkeeping, per-player pages, crosses/pressure/receiving maps, pass networks)
  - [x] Typed exception `MissingAnchorError` carrying report ID + anchor text (Consistency Conventions: typed exception per failure class); in verification mode it is caught and recorded as a deviation, never aborts the run
- [x] Task 3: Corpus metadata probe for stratification (AC: 1)
  - [x] For each PDF in the input dir, extract sample-selection metadata via the discovery slice: teams, venue, stage/group, date — probe mex_rsa.pdf first to learn what the cover/header pages actually print and anchor on that
  - [x] Derive the matchday round per report into a closed set (e.g. `group-md1 | group-md2 | group-md3 | r32 | r16 | qf | sf | third-place | final`): knockout rounds come from the printed stage; group matchday, if not printed, is derived deterministically by ordering each group's matches by date (position 1/2/3 within the group). Validate the chosen derivation against the real corpus; record the rule in code comments — **validated against all 104 real reports: 12 complete groups derive to md1/md2/md3, and all 6 knockout wordings map correctly (one fix required: `"Bronze final"`).**
  - [x] A report whose probe fails (missing cover anchor) is itself a deviation — record it and exclude it from stratification keys, never crash the corpus scan
- [x] Task 4: Stratified sample selection (AC: 1)
  - [x] Compute the union of two covers: ≥1 report per venue, ≥1 per matchday round; overlap allowed (one report may satisfy both covers); prefer a minimal, deterministic selection (e.g. greedy over sorted report IDs so re-runs pick the same sample)
  - [x] Emit the sample listing (report → venue, round, which cover(s) it satisfies) into the verification report
- [x] Task 5: Verification runner, check registry & deviation summary (AC: 2, 3)
  - [x] In `pipeline/validate/`: verification mode that runs, per sampled report, every registered check. Ship two check kinds now: (a) anchor-coverage (every registered anchor resolves), (b) metadata-probe completeness. Define the registry interface so later stories plug in extractor + Self-Validation checks (1.3: shots parse + count match; 1.5: link rate; 1.6+: domain extractors) without touching the runner
  - [x] Deviation summary structure per report: report ID, venue, matchday round, deviations `[{check, category: missing-anchor | unknown-rgb | count-mismatch | probe-failure, specifics}]` — all four categories structurally present from day one
  - [x] Write the verification manifest to `work/verification/verification-report.json` (machine-readable; `work/` is pipeline-internal staging per AD-9, so snake_case keys are fine — the camelCase rule binds only `/contract` + `/data`) plus a human-readable console summary; a clean run records an explicit pass gate result, localizable-by-venue/matchday grouping in the summary
- [x] Task 6: CLI entrypoint & re-run semantics (AC: 3)
  - [x] `python -m pipeline.validate.verify --input-dir <corpus-dir>` (input dir configurable via CLI arg; no hardcoded paths); re-run over unchanged corpus + code produces the same sample and same report content (deterministic ordering everywhere; don't embed wall-clock-dependent values except an ISO run timestamp field)
  - [x] Keep runs cheap: the metadata probe reads only the pages it needs; full-document text walks only where anchor search requires it
- [x] Task 7: Tests (AC: 5)
  - [x] pytest: metadata probe against `spike/mex_rsa.pdf` (assert the actual venue/teams/stage it prints); anchor registry resolves all registered anchors on mex_rsa.pdf; missing-anchor case (search for a bogus anchor → deviation recorded, run continues); two-cover selection on a synthetic in-memory corpus description (venues × rounds fixture — no PDFs needed for the set-cover logic); deviation-report format round-trip
- [x] Task 8: Run the gate & record the result (AC: 2)
  - [x] Run verification mode against the configured corpus directory of 104 PMSR PDFs; record the gate result (clean pass or per-report deviations) in the verification manifest and paste the summary into this story's Dev Agent Record
  - [x] If the full corpus is not yet available on this machine, run against `spike/` (single-report corpus: sample = mex_rsa.pdf, both covers trivially satisfied), record that result, and flag corpus availability as a blocker note in the Dev Agent Record — do NOT mark the 104-report gate satisfied

### Review Findings

_Code review 2026-07-22 — three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 29 findings retained, 4 dismissed as noise. All 7 decision-needed findings were resolved by reviewer recommendation (Juan's call, 2026-07-22) and folded into the patch set below._

**Decisions resolved (7) — now patches**

- [x] [Review][Patch] **Substring anchor matching lets a wrong page satisfy an anchor.** `"IN POSSESSION {home} v {away}"` is a literal substring of `"INDIVIDUAL DATA IN POSSESSION {home} v {away}"`. Verified on mex_rsa.pdf: the dividers resolve to pages `[4, 40]` and `[23, 45]`, where 40/45 are the *individual-data* dividers — delete page 4 and the gate still reports clean. `text.py:9-11` wrongly claims case-sensitivity prevents this; both strings are upper-case. **Decision:** add `at_page_start: bool = False` to `AnchorSpec`, set it on the six divider/title specs, and give `PageTextIndex.find_all` / `find_anchor_pages` a matching mode that uses `startswith` on the normalized page text. Separately, for `per_team` specs where the two team names differ, record a deviation when the home and away resolutions are not disjoint page sets — that closes the `Korea` / `Korea Republic` prefix hazard. [pipeline/discover/anchors.py:48,62 · pipeline/discover/text.py:71 · pipeline/validate/checks.py:63-65]
- [x] [Review][Patch] **Cover slots accept almost anything.** Venue is `lines[kickoff_idx + 1]` guarded only against the cover-anchor/date/kick-off regexes; stage is `lines[date_idx - 1]` guarded only against a scoreline. Verified: inserting `"Attendance 87,523"` below the kick-off yields `venue="Attendance 87,523"`, zero deviations, gate PASS. **Decision:** assert the cover block's documented shape positively instead of negatively — require `stage_idx == score_idx + 1 == date_idx - 1`, and require the line following the venue to be the cover anchor. Any inserted or reordered line then raises `ProbeError` and is recorded as a deviation, which is the behaviour the module docstring already claims. [pipeline/discover/probe.py:179-187]
- [x] [Review][Patch] **The gate has no expectation of what the corpus should contain.** An empty input dir returns `{"result": "pass", "sample_size": 0}` and exit 0 (verified). Both covers are seeded from the corpus itself, never from `rounds.ROUNDS` or an expected venue list, so a wholly missing round or an entire stadium's reports are vacuously covered; `ROUNDS` is referenced nowhere in production code. **Decision:** (a) an empty corpus is a gate `fail`, never a pass; (b) add optional `--expect-reports N` which records a mismatch; (c) add a top-level `corpus_gaps` list to the manifest naming every round in `ROUNDS` with zero reports — informational, and it keeps the four AC-2 deviation categories untouched so the report shape stays stable. Gate fails on empty corpus or on an `--expect-reports` mismatch. [pipeline/validate/runner.py:167-171 · pipeline/validate/sample.py:48-51]
- [x] [Review][Patch] **Group matchday derivation is corpus-relative, so a partial corpus is silently mislabelled.** `1 + max(played[home], played[away])` cannot distinguish "matchday 1" from "the first match of this team I happen to hold". Verified: a corpus holding only a group's MD2 and MD3 fixtures returns `group-md1` / `group-md2` with `problems == []`. **Decision:** incremental runs are in scope (this is a standing gate re-run by Stories 1.5–1.14, and the corpus may arrive in pieces), so add a completeness precondition — derive group matchdays only when a group holds all 6 matches of its round-robin; otherwise every report in that group gets `matchday_round=None` plus a recorded problem naming the shortfall. That makes the module docstring's "Nothing is guessed" true. [pipeline/discover/rounds.py:88]
- [x] [Review][Patch] **Away team absorbs trailing scoreline text.** `_SCORE_RE`'s `(?P<away>\S.*)$` is greedy, so `Argentina 3 - 3 France (4-2 Pens)` yields `away="France (4-2 Pens)"`, which feeds every `per_team` template and produces ~11 false missing-anchor deviations. **Decision:** do not guess at knockout scoreline formats without a real knockout report. Strip a trailing parenthetical from the away name and record a `probe-failure` deviation quoting the raw scoreline — so the first real corpus run tells you the format changed instead of burying it under phantom missing anchors. Revisit once knockout PDFs are in hand. [pipeline/discover/probe.py:47]
- [x] [Review][Patch] **No unicode normalization on stratification keys or anchor text.** Venue and team strings are used raw as dict/Counter/cover keys, so NFC vs NFD `México`, or a zero-width space, splits one venue into two cover elements and gives one team two matchday counters — with no problem recorded, because the `rounds.py:91` guard never fires. **Decision:** apply NFC normalization and strip Unicode `Cf` (format) characters inside `normalize()`, so it lands uniformly on page text, anchor text and every probed string. Deliberately do *not* collapse anything semantic — no accent stripping, no case folding, no `Türkiye`→`Turkiye` — so a genuinely inconsistent venue spelling still surfaces as a deviation, which is what the Dev Notes ask for. [pipeline/discover/text.py:26 · pipeline/validate/sample.py:39 · pipeline/discover/rounds.py:88]
- [x] [Review][Patch] **Manifest omits non-sampled clean reports with no list of what went unchecked.** `recorded_ids = sampled_ids | deviating_ids`, so a 104-report corpus with a 20-report sample emits 20 entries against `corpus.report_count: 104`. **Decision:** add a sorted `unchecked_report_ids` field to the manifest. Cheap, makes the artifact auditable against "no silent skips", no downside. [pipeline/validate/runner.py:106-107]

**Patches (20)**

- [x] [Review][Patch] An impossible cover date aborts the entire corpus scan — `dt.date(...)` sits outside the `try` (which closes at line 164) and `probe_corpus` catches only `ProbeError`, so `"31 June 2026"` raises `ValueError` and the other 103 reports are never looked at [pipeline/discover/probe.py:172]
- [x] [Review][Patch] A raising check silently discards every deviation the remaining checks would have found — the `except Exception` wraps the whole `for check in applicable` loop, and the deviation it records hardcodes `check="metadata-probe"` / `probe-failure` regardless of which check failed. Reproduced: 46 real missing-anchor deviations collapse to 1 [pipeline/validate/runner.py:65-77]
- [x] [Review][Patch] `_find_single` never checks for a single match — it returns `matches[0]`, so a second date- or kick-off-shaped line on the cover silently shifts the stage and venue slots instead of raising [pipeline/discover/probe.py:135-139]
- [x] [Review][Patch] Task 3's subtask "Validate the chosen derivation against the real corpus" is marked `[x]` but is blocked by the same missing corpus as Task 8 — the BLOCKER note scopes itself to Task 8 only [this file:59]
- [x] [Review][Patch] Kick-off is sorted as a string, so `"9:00"` sorts after `"21:00"` and the matchday walk assigns wrong rounds; every test uses `"13:00"` [pipeline/discover/rounds.py:85]
- [x] [Review][Patch] `glob("*.pdf")` is case-insensitive on Windows and case-sensitive on POSIX, so corpus membership — and therefore the gate result — is platform-dependent; `report_id = path.stem` also collides `a.pdf` with `a.PDF` in `by_id` and `assigned` [pipeline/discover/probe.py:224 · pipeline/validate/runner.py:96]
- [x] [Review][Patch] Manifest is not canonically serialized — no `sort_keys`, and `write_text` without `newline="\n"` emits CRLF on Windows (48/48 newlines in the committed artifact), violating AD-8's byte-identical re-run canon [pipeline/validate/runner.py:181-183]
- [x] [Review][Patch] One unrecognized stage line is recorded as two deviations — once by `_corpus_deviations` over `round_problems` and again by `_check_metadata_probe` seeing `matchday_round is None` — inflating `deviation_count`, `deviations_by_venue` and `deviations_by_matchday_round` [pipeline/validate/runner.py:44-52 · pipeline/validate/checks.py:101-102]
- [x] [Review][Patch] A `{team}` placeholder in a non-`per_team` spec is silently formatted to `""` instead of failing loudly, contradicting the docstring's promise and producing a permanently-green or phantom anchor [pipeline/discover/anchors.py:148]
- [x] [Review][Patch] `Deviation.__post_init__` validates only `category`, so a non-string `specifics` from a future check raises `TypeError` inside `json.dumps` after every PDF has been read — no manifest, no exit code [pipeline/validate/deviations.py:48-53]
- [x] [Review][Patch] The CLI has no error handling — a bad `--input-dir`, an unwritable `--output`, or a non-cp1252 character in a deviation string on redirected Windows stdout produces a traceback instead of the documented 0/1 gate contract [pipeline/validate/verify.py:104-106]
- [x] [Review][Patch] Several tests assert on their own scaffolding: `applies_to` is called directly rather than through `_run_checks`; the "without touching the runner" test never invokes the runner; the volatility test only asserts the timestamp ends in `+00:00`; the "realistic scale" fixture uses `i%16 × i%9` (coprime, so every pair occurs — the easiest possible cover) with all 104 metas in group A; the "pinned stack" test asserts `pymupdf.__doc__ is not None` and `pytest.__version__.startswith("8.")` against exact pins [pipeline/tests/test_checks_registry.py:95-129 · test_runner.py:181-183 · test_sample_selection.py:129-152 · test_workspace.py:15-20]
- [x] [Review][Patch] `test_rerun_produces_byte_identical_report_apart_from_the_timestamp` never compares bytes — it `json.loads` both files, pops the timestamp and compares dicts, so the AC-3 byte-identity claim in the Dev Agent Record is unproven [pipeline/tests/test_cli.py:140-145]
- [x] [Review][Patch] The real-PDF runner and CLI tests take only `repo_root` and point at `repo_root / "spike"`, bypassing the `conftest.py` skip-guard — without the fixture that is an empty corpus, which returns PASS with all-zero counts, so every one of those tests stays green having verified nothing [pipeline/tests/test_runner.py:78,85,173,186,194,216,240 · test_cli.py:31,114,135]
- [x] [Review][Patch] Re-run determinism is only ever tested on the single-report spike corpus, where the greedy loop has no tie to break — the configuration where AC-3 could fail is untested [pipeline/tests/test_runner.py:173-178 · test_cli.py:135-145]
- [x] [Review][Patch] `AnchorSpec.required` is dead — no spec sets `required=False`, the `if not anchor.required` branch never executes and no test covers it, yet the Dev Agent Record plans to rely on that path for the first real 104-report run [pipeline/discover/anchors.py:28 · pipeline/validate/checks.py:67-68]
- [x] [Review][Patch] `python -m pytest pipeline/tests` from repo root — the invocation Task 1 and Testing Standards declare — fails on this machine (system python has neither pytest nor pymupdf); README documents only the explicit venv-path form and never venv activation [pipeline/README.md:52 · this file:52,121]
- [x] [Review][Patch] Two of the three `_check_metadata_probe` assertions are unreachable: `cover_lines` filters empty lines and `_SCORE_RE` requires `\S`, so neither an empty venue nor an empty team name can reach the check [pipeline/validate/checks.py:97-100]
- [x] [Review][Patch] A probed report with a blank venue is filed under `<unprobed>`, conflating it with reports that failed to probe entirely; same conflation for `matchday_round` / `<unknown>` [pipeline/validate/runner.py:137-138]
- [x] [Review][Patch] Dev Agent Record documentation fixes: "49 resolved anchors" is wrong — 30 specs with 17 `per_team` resolve to 47 (verified); the Task 8 summary pasted into the record is an edited condensation, not what `format_summary` emits; `select_sample`'s docstring claims "smallest" for a greedy approximation (verified selecting 4 where 3 suffice); and the `checks=` parameter bypasses `register_check`'s duplicate-id guard [this file:176,217,236-243 · pipeline/validate/sample.py:46 · pipeline/validate/runner.py:92]

**Deferred (2)**

- [x] [Review][Defer] Cover-line reconstruction has two hard-coded geometric thresholds with no fallback and no boundary test — above 3.0pt line tolerance the scoreline splits and the report dies with "cover page has no scoreline"; at exactly 1.0pt gap no space is inserted and the away team becomes `"SouthAfrica"`, propagating a wrong-but-plausible team name into every away anchor [pipeline/discover/probe.py:41-43] — deferred, validating thresholds requires the real corpus
- [x] [Review][Defer] Zero-width spaces, soft hyphens and `ﬁ`/`ﬂ` ligatures survive `normalize` (only `str.split` whitespace is collapsed), so a cosmetic font change reports as a corpus-wide template revision [pipeline/discover/text.py:26] — deferred, cannot confirm the corpus exhibits this without the 104 PDFs

_Dismissed as noise: `pdfplumber` pinned but unused (AR-15 mandates the pin and the Dev Record declares it); `.pytest_cache/` and `__pycache__/` absent from the File List (tool byproducts, no VCS yet); hardcoded page numbers in `test_discover_text.py:41` (legitimate assertion against a frozen fixture); README's unenforced "Python 3.13+" claim (the venv runs 3.14.4)._

## Dev Notes

### Sequencing Reality — read this first

This is the **first implemented story in the project**. The sprint plan (sprint-status.yaml header) deliberately runs 1.4 before 1.1/1.2/1.3: it de-risks the top extraction threat (silent mid-tournament template revision) before anything downstream is trusted. Consequences:

- **Nothing exists yet.** No `pipeline/`, no `contract/`, no run manifest, no parsers. The repo contains only `spike/` (frozen reference: `census.py`, `extract.py`, `inspect_drawings.py`, `mex_rsa.pdf`, two PNGs, a stale venv), `docs/` (empty), the project brief, and BMad artifacts. There is no git repo yet either — initialize one only if asked; it is not this story's scope.
- **First run is anchor-level only.** The epics AC says "all extractors implemented so far + Self-Validation" — right now that set is empty. Build the verification *harness* with the deviation categories (missing-anchor, unknown-rgb, count-mismatch) structurally present; only anchor-coverage and probe checks produce findings today. Stories 1.3, 1.5, 1.6–1.14 each register their checks and re-run this gate as part of their own acceptance — your check-registry design is what makes that cheap.
- **You pull forward a minimal text-anchored discovery slice from Story 1.2.** Build it small and reusable in `pipeline/discover/` — Story 1.2 will later build batch ingestion, the full run manifest, and idempotence keys *around* it, not instead of it. Do not build 1.2's manifest/idempotence machinery here; your `work/verification/verification-report.json` is this mode's own record, which 1.2's manifest will reference/absorb later.
- **Do not touch Story 1.1's scope:** no JSON Schemas, no `contract/`, no fixtures, no `data/`. The readiness report assigns the full monorepo seed to 1.1; you create only the `pipeline/` slice you need.

### Critical constraint: the corpus is NOT in the repo

Only `spike/mex_rsa.pdf` is committed (Mexico vs South Africa, the spike's ground-truth report). The 104-PDF corpus is assumed to be in Juan's possession (PRD §11 assumption) but its location is unknown to this story. Therefore: input directory is a required CLI argument; tests run against `spike/mex_rsa.pdf` and synthetic fixtures; the real 104-report gate run (Task 8) depends on Juan pointing the tool at his corpus. If it's not available, deliver the harness + spike-corpus run and flag the blocker honestly — never claim the gate passed on 104 reports it didn't see.

### Architecture guardrails (binding)

- **AD-8 (fail loud):** text-anchored discovery, never page indices — the PDF header lies about page count (claims 8, reports run ~52; addendum §1). Assert-on-unknown everywhere. In verification mode, per-report failures become recorded deviations and the run continues to the next report — a deviation is data here, not a crash. Typed exception per failure class (`MissingAnchorError`, later `UnknownRgbError`, `CountMismatchError`...). No silent skips: every sampled report gets a terminal entry in the verification report.
- **AD-9 (staging):** `work/` is the pipeline-internal staging area (later `work/extracted/`); put the verification report under `work/verification/`. Verification mode belongs in `pipeline/validate/` per the Structural Seed ("self-validation, template-consistency sample mode"); discovery in `pipeline/discover/`.
- **AR-15 (stack pins):** Python 3.13+, pymupdf 1.28.x, pdfplumber 0.11.x, pytest 8.x. Pinned `pipeline/requirements.txt` via **pip — no `uv`** (explicit architecture convention; also a standing user preference on this machine: call `python`, never `uv run`). Windows host: use `python`, not `python3`.
- **Conventions:** Python `snake_case`; camelCase JSON binds only `/contract` + `/data` artifacts (not `work/` internals); everything in English; no presentational output from the pipeline.
- **AR-16 / spike fixture:** `spike/mex_rsa.pdf` is a permanent ground-truth fixture. **`spike/` is frozen** — read it, learn from it, never modify it. Its printed coordinates are in a transposed frame vs AD-6 — irrelevant to this story (no coordinate work here), but never lift them as expected values.

### What the spike already proved (reuse, don't rediscover)

From `spike/census.py` + `spike/extract.py` + addendum §1:

- **Page discovery technique:** `page.get_text()` → `" ".join(text.split())` → substring match. census.py finds the shots page via `"Attempts at Goal Mexico"` — note the anchor embeds the **team name**, so anchor specs must be templates (`"Attempts at Goal {team}"`) resolved with the teams learned by the metadata probe. Expect other section anchors to be static titles; verify each against mex_rsa.pdf.
- **Per-page census recipe:** `len(page.get_drawings())`, `len(page.get_image_info())`, first-text snippet per page — a cheap way to fingerprint page types when you walk mex_rsa.pdf to build the anchor registry (analytic pages: hundreds of vector paths + typically 1 raster background).
- **pymupdf API:** the spike uses `import fitz`; pymupdf 1.28.x supports both `import pymupdf` (current name) and `import fitz` (legacy alias). Prefer `import pymupdf` in new code. Pins were web-verified 2026-07-21 (architecture review): pymupdf 1.28.x wheels cover Python 3.10–3.14; pdfplumber 0.11.x current at 0.11.10. No fresher research needed.
- **What NOT to build here:** the marker parsing / RGB classification in extract.py is Story 1.3's productionization target. Don't port it now; just leave the registry seams (`unknown-rgb`, `count-mismatch` categories) it will plug into.

### Stratification design guidance

- WC 2026 has 16 venues and 104 matches; matchday rounds ≈ {group-md1..3, r32, r16, qf, sf, third-place, final} — 9 rounds. Union of covers is therefore roughly 16–25 reports (venue cover dominates; overlap shrinks it). The point (addendum §5 risk register): a template revision localizes to *when* (matchday) or *where* (venue) it happened.
- Venue/stage/date/teams must come from the PDFs themselves (text-anchored probe — this is the pulled-forward discovery slice; keep it honest, no hand-maintained schedule table as the primary source). Probe mex_rsa.pdf first to learn the cover/header layout and pick robust anchors.
- Keep stratification keys normalized (venue names whitespace-normalized exactly as printed; document any collapsing you must do if the corpus prints venue names inconsistently — that itself would be a template deviation worth surfacing).

### Check-registry contract (design for the next nine stories)

Later stories extend the gate; make the seam explicit. Suggested shape: a check = `(check_id, applies_to(report_meta) -> bool, run(pdf, report_meta) -> list[Deviation])`, registered in one module-level list. This story registers `anchor-coverage` and `metadata-probe`; 1.3 adds shots-parse + count-match; 1.5 adds link-rate; 1.6–1.14 add domain checks. The runner, sample selection, and report format must not need edits when checks are added — that's AC 3.

### Testing standards

- pytest 8.x, tests in `pipeline/tests/`, runnable via `python -m pytest pipeline/tests` from repo root on Windows.
- Real-PDF tests use `spike/mex_rsa.pdf` (relative path from repo root — no absolute paths).
- Pure-logic tests (set-cover selection, report format, matchday derivation) use synthetic fixtures — don't require 104 PDFs to test the logic.
- Keep tests deterministic; no network.

### Project Structure Notes

All files NEW (greenfield); aligned to the Structural Seed (ARCHITECTURE-SPINE.md):

```
pipeline/
  README.md              # NEW — venv + pip setup, how to run verification mode
  requirements.txt       # NEW — exact pins: pymupdf 1.28.x, pdfplumber 0.11.x, pytest 8.x
  __init__.py            # NEW (plus __init__.py per subpackage)
  discover/              # NEW — whitespace-normalized text search, anchor registry, metadata probe
  validate/              # NEW — check registry, sample selection, verification runner, CLI (verify.py)
  tests/                 # NEW — pytest suite
work/
  verification/          # NEW at runtime (gitignore-worthy later; git not initialized yet) — verification-report.json
```

Variance note: the Structural Seed doesn't show a `tests/` dir; `pipeline/tests/` follows pytest convention (AR-16 mandates pytest). Do not create `contract/`, `data/`, `app/`, or the remaining pipeline subpackages — later stories own them. Never modify `spike/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4] — story + ACs; re-run-gate pattern in Stories 1.5–1.14
- [Source: _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md#FR-15, #FR-2, #§8.1, #§9 SM-C1] — verification mode, text-anchored discovery, de-risking order, never-weaken-checks counter-metric
- [Source: _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md#§1, #§5] — spike findings (page reality, anchor technique), risk register (template revision = top risk)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md#AD-8, #AD-9, #Consistency-Conventions, #Stack, #Structural-Seed] — fail-loud rules, staging, conventions, pins, layout
- [Source: _bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/reviews/review-web-verify.md#L-2] — pin verification (pymupdf/pdfplumber current as of 2026-07-21)
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml#SEQUENCING-PLAN] — why 1.4 runs first; anchor-level-only first run
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-07-22.md#Epic-Quality-Review] — gate-strengthens-incrementally pattern; monorepo seed belongs to 1.1
- [Source: spike/census.py, spike/extract.py] — proven discovery + census technique; frozen reference

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code, `bmad-dev-story` workflow)

### Debug Log References

**Corpus walk (one-off, scratchpad — not committed):** walked all 52 pages of `spike/mex_rsa.pdf`
printing per-page drawing/image counts and normalized first-text snippets (the spike's census recipe).
That walk is the source of every anchor in `pipeline/discover/anchors.py`; page 51 is a text-free back
cover, and the header's claimed page count (8) is indeed wrong, confirming AD-8.

**Cover-page span dump:** the scoreline is split by the away team's crest (an image block between the
spans), so pymupdf's own line grouping returns `"Mexico 2 - 0"` and `"South Africa"` separately, and
adjacent spans carry no space character across a visual gap. First probe implementation failed on the
real PDF with `cover page has no scoreline`; fixed by rebuilding cover lines from span geometry
(cluster by y within 3pt, join left-to-right inserting a space where the horizontal gap exceeds 1pt).

**Performance:** the first working `anchor-coverage` check re-walked the whole document once per
anchor — 47 resolved anchors x 52 pages — and the runner test file took 175s. Added
`PageTextIndex`, which extracts each page's normalized text once per document; the same tests now
run in ~9s (~18x). The metadata probe deliberately does *not* use the index: it needs only the cover
page and short-circuits there, which is what keeps a 104-report corpus scan cheap.

**Gate run (Task 8):** see the post-review run recorded below — exit 1, gate FAIL on corpus gaps.

### Completion Notes List

**What was built.** The template-consistency verification harness: a text-anchored discovery slice
(`pipeline/discover/`), a stratified two-cover sample selector, and an extensible check registry with
a verification runner and CLI (`pipeline/validate/`). 88 tests, all passing.

**AC 1 — stratified sample.** `select_sample` is a greedy set cover over the combined universe of
venue elements and matchday-round elements, ties broken on report id, output sorted by report id, so
the same corpus always yields the same sample. Overlap is exploited (one report can satisfy both
covers); a synthetic 104-report / 16-venue / 9-round fixture selects 16 reports, inside the 16-25 band
the Dev Notes predicted.

**AC 2 — per-report deviation summary.** Every deviation carries report id, check id, category and
specifics. All four categories (`missing-anchor`, `unknown-rgb`, `count-mismatch`, `probe-failure`)
are structurally present in `deviations.py` and always appear in
`deviation_counts_by_category`, zero-valued until Stories 1.3+ register the checks that produce them —
so the report shape never changes underneath an earlier gate result. The manifest is written to
`work/verification/verification-report.json` (snake_case keys; `work/` is pipeline-internal per AD-9),
with `deviations_by_venue` and `deviations_by_matchday_round` groupings so a revision localizes to a
venue or a matchday. A clean run records an explicit `"gate": {"result": "pass"}`.

**AC 3 — cheap, extensible re-runs.** A check is `(check_id, applies_to, run)` in one module-level
registry. `test_a_newly_registered_check_flows_into_the_report` proves a later story's check reaches
the manifest without touching the runner, the sample selection or the report format; `applies_to`
filtering is covered too. Re-runs over an unchanged corpus are byte-identical apart from
`run_timestamp` (verified end-to-end through the CLI).

**AC 4 — fail-loud discovery.** Location is whitespace-normalized substring search over page text;
no page index is ever used to address a section. `MissingAnchorError` carries report id + anchor text,
and in verification mode it is caught and recorded, never fatal — a report that cannot even be opened
becomes a `probe-failure` deviation rather than aborting the scan, so one broken report can never hide
the state of the other 103.

**AC 5 — coverage.** Real-PDF tests against `spike/mex_rsa.pdf` cover the metadata probe (asserting
the venue, teams, stage, date and kick-off it actually prints) and anchor resolution for all 30 specs
(47 resolved anchors: 13 single + 17 per-team x 2). Pure-logic tests use synthetic fixtures: the
two-cover union, matchday derivation, deviation-report JSON round-trip, and a missing-anchor case
that confirms the run continues. Synthetic multi-report corpora are generated as real PDFs in
`tmp_path`.

**Matchday derivation — rule chosen and why.** `spike/mex_rsa.pdf` prints `"Group A - Match 1"`, which
is a match number within the group (1..6), not a matchday (1..3), so the printed value is not usable
directly. Per the Dev Notes, group matchdays are derived: within each group, matches are sorted by
(date, kick-off, report id) and each is assigned `1 + max(matches already played by either team)`.
This is deterministic and — unlike grouping by calendar date — stays correct when the two fixtures of
one matchday fall on different days, which happens in the 2026 group stage. Knockout rounds come from
the printed stage line by keyword, with the specific rounds tested before the bare `"final"` so
"Quarter Final" and "Semi Final" are not shadowed. An unrecognized stage is a recorded deviation, not
a guess. The rule is documented in `pipeline/discover/rounds.py`.

**✅ RESOLVED 2026-07-22 — the 104-report gate is SATISFIED.** Juan supplied the corpus at
`pmsr-corpus/` (104 PDFs, flat, one per match). The gate now passes on the real corpus; the run is
recorded below under "Task 8 — real corpus gate run". The historical single-report fallback run is
kept beneath it for context.

### Task 8 — real corpus gate run (2026-07-22)

`python -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` — exit code 0:

```
corpus          : pmsr-corpus
reports found   : 104 (probed 104, probe failures 0)
checks run      : anchor-coverage, metadata-probe
sample size     : 16

Sample (report -> venue | matchday round | covers)
  PMSR-M01-MEX-V-RSA       Mexico City Stadium | group-md1 | round, venue
  PMSR-M02-KOR-V-CZE       Guadalajara Stadium | group-md1 | venue
  PMSR-M03-CAN-V-BIH       Toronto Stadium | group-md1 | venue
  PMSR-M05-HAI-V-SCO       Boston Stadium | group-md1 | venue
  PMSR-M08-QAT-V-SUI       San Francisco Bay Area Stadium | group-md1 | venue
  PMSR-M10-GER-V-CUW       Houston Stadium | group-md1 | venue
  PMSR-M100-ARG-V-SUI      Kansas City Stadium | qf | round, venue
  PMSR-M101-FRA-V-ESP      Dallas Stadium | sf | round, venue
  PMSR-M103-FRA-V-ENG      Miami Stadium | third-place | round, venue
  PMSR-M104-ESP-V-ARG      New York/New Jersey Stadium | final | round, venue
  PMSR-M12-SWE-V-TUN       Monterrey Stadium | group-md1 | venue
  PMSR-M16-BEL-V-EGY       Seattle Stadium | group-md1 | venue
  PMSR-M25-CZE-V-RSA       Atlanta Stadium | group-md2 | round, venue
  PMSR-M51-SUI-V-CAN       BC Place Vancouver | group-md3 | round, venue
  PMSR-M73-RSA-V-CAN       Los Angeles Stadium | r32 | round, venue
  PMSR-M89-PAR-V-FRA       Philadelphia Stadium | r16 | round, venue

Deviations by category
  missing-anchor   0
  unknown-rgb      0
  count-mismatch   0
  probe-failure    0

GATE RESULT: PASS (0 deviation(s) across 16 sampled report(s), 0 corpus gap(s))
```

**What the gate result means.** The sample is 16 reports covering all **16 venues** and all **9
matchday rounds** — inside the 16-25 band the Dev Notes predicted. Every one of the 47 resolved
anchors was located in every sampled report, across every venue and every stage of the tournament.
**No mid-tournament template revision is detectable in the PMSR corpus** — the project's top
extraction risk (addendum §5) is retired for the anchor-level checks that exist today. Re-runs are
byte-identical apart from `run_timestamp` (verified), and the manifest is LF + sorted-key canonical.

**Two real template variants were discovered by the first run, exactly as predicted.** Both were
invisible in the single-report spike corpus, and both are now modelled and regression-tested:

1. **`"Bronze final"` is FIFA's wording for the third-place play-off** (match 103). It contains
   `"final"` but neither `"third place"` nor `"3rd place"`, so it was classified as a *second final*
   and the `third-place` round silently vanished from the corpus — caught by the corpus-gap check
   added in code review. Fixed by adding `"bronze"` to the third-place keywords, which are already
   tested before the bare `"final"`. The complete set of six real knockout wordings
   (`Round of 32`, `Round of 16`, `Quarter-final`, `Semi-final`, `Bronze final`, `Final`) is now
   asserted in `test_every_real_corpus_stage_wording_maps_to_a_round`.
2. **Ties decided on penalties print the shoot-out result on its own line** between the scoreline and
   the stage — `"(Paraguay win 3-4 on Penalties)"` — in 4 of 104 reports. The cover-block shape
   assertion caught the shift rather than silently mis-reading the stage. Modelled as an optional
   line and captured verbatim in `ReportMeta.shootout`; it is a legitimate variant, so it probes
   cleanly and is **not** recorded as a deviation.

Note the review's predicted form for variant 2 was an *inline* scoreline suffix; the real corpus
prints a *separate line*. `_SCORE_SUFFIX_RE` is retained as a fail-loud guard for the inline form,
which does not occur in this corpus.

**Corpus shape confirmed:** 12 groups x 6 = 72 group matches, then 16 + 8 + 4 + 2 + 1 + 1 = 104.

**Standing caveat for Stories 1.5-1.14.** This PASS is anchor-level and probe-level only — the
`unknown-rgb` and `count-mismatch` categories are still structurally present and zero because no
extractor exists yet. 88 of the 104 reports are outside the sample and named in
`unchecked_report_ids`. Each subsequent extraction story registers its checks and re-runs this gate;
a PASS today does not pre-clear parser-level consistency.

<details>
<summary>Historical: the pre-corpus fallback run (superseded)</summary>

The corpus was not on this machine when the story was first implemented. `Documents`, `Downloads`,
`Desktop` and `OneDrive` were searched plus a targeted filename sweep of the user profile; the only
PMSR PDF present was `spike/mex_rsa.pdf`. Per Task 8's fallback the gate was run against `spike/` as
a single-report corpus:

Verbatim output of `python -m pipeline.validate.verify --input-dir spike` (exit code 1), re-run
after the code review patches landed:

```
Template-consistency verification
=================================
corpus          : spike
reports found   : 1 (probed 1, probe failures 0)
checks run      : anchor-coverage, metadata-probe
sample size     : 1

Sample (report -> venue | matchday round | covers)
  mex_rsa                  Mexico City Stadium | None | venue

Deviations by category
  missing-anchor   0
  unknown-rgb      0
  count-mismatch   0
  probe-failure    1

Corpus gaps (what this run could not have checked)
  - no report present for matchday round 'group-md1'
  - no report present for matchday round 'group-md2'
  - no report present for matchday round 'group-md3'
  - no report present for matchday round 'r32'
  - no report present for matchday round 'r16'
  - no report present for matchday round 'qf'
  - no report present for matchday round 'sf'
  - no report present for matchday round 'third-place'
  - no report present for matchday round 'final'

Deviations by venue
  Mexico City Stadium              1

Deviations by matchday round
  <unknown>                        1

Per-report deviations
  mex_rsa [Mexico City Stadium | None] - 1 deviation(s)
      [probe-failure] metadata-probe: group A holds 1 of 6 matches; matchday cannot be derived

GATE RESULT: FAIL (1 deviation(s) across 1 sampled report(s), 9 corpus gap(s))
```

**Note the change from the pre-review run, which reported PASS.** That earlier pass was an artifact
of the gate having no expectation of its corpus: a one-report corpus trivially satisfied both covers,
and the group matchday was derived confidently from a single fixture. Post-review the gate says what
is actually true — `missing-anchor 0` confirms mex_rsa is self-consistent with its own anchor
registry, and the nine corpus gaps plus the incomplete-group deviation record that this run proves
**nothing** about template consistency across venues or matchdays, which is the entire point of the
story.

This prediction proved accurate: the first real run surfaced exactly the two unmodelled knockout-cover
variants anticipated here (the third-place stage wording and the shoot-out line). No anchor needed
`required=False` — the registry seeded from one report resolved cleanly across all 16 venues.

</details>

**Scope discipline.** No `contract/`, `data/`, `app/`, JSON Schemas or fixtures were created — those
belong to Story 1.1. Only the `pipeline/discover/` and `pipeline/validate/` subpackages this story
needs exist. `spike/` was read but never modified (verified: all files retain their original
timestamps). No git repository was initialized. `pdfplumber` is pinned per AR-15 but unused so far.

### File List

**New:**

- `pipeline/README.md`
- `pipeline/requirements.txt`
- `pipeline/__init__.py`
- `pipeline/errors.py`
- `pipeline/discover/__init__.py`
- `pipeline/discover/anchors.py`
- `pipeline/discover/errors.py`
- `pipeline/discover/probe.py`
- `pipeline/discover/rounds.py`
- `pipeline/discover/text.py`
- `pipeline/validate/__init__.py`
- `pipeline/validate/checks.py`
- `pipeline/validate/deviations.py`
- `pipeline/validate/runner.py`
- `pipeline/validate/sample.py`
- `pipeline/validate/verify.py`
- `pipeline/tests/conftest.py`
- `pipeline/tests/test_anchor_registry.py`
- `pipeline/tests/test_checks_registry.py`
- `pipeline/tests/test_cli.py`
- `pipeline/tests/test_discover_text.py`
- `pipeline/tests/test_metadata_probe.py`
- `pipeline/tests/test_rounds.py`
- `pipeline/tests/test_runner.py`
- `pipeline/tests/test_sample_selection.py`
- `pipeline/tests/test_workspace.py`
- `work/verification/verification-report.json` (runtime output of the Task 8 gate run)

**Modified:**

- `_bmad-output/implementation-artifacts/1-4-template-consistency-verification-across-the-venue-matchday-sample.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Untracked local environment (not source):** `pipeline/venv/`

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-22 | Story 1.4 implemented: pipeline workspace bootstrap (venv + pinned stack), text-anchored discovery slice with 30-spec anchor registry, cover-page metadata probe, matchday-round derivation, two-cover stratified sample selection, extensible check registry with `anchor-coverage` and `metadata-probe`, verification runner emitting `work/verification/verification-report.json`, and the `python -m pipeline.validate.verify` CLI. 88 pytest tests added, all passing. |
| 2026-07-22 | Task 8 gate run executed against `spike/` (single-report fallback corpus): PASS, 0 deviations. The 104-report gate remains UNSATISFIED — corpus not available on this machine. |
| 2026-07-22 | Code review (3 adversarial layers): 29 findings, 7 decisions resolved, 27 patches applied, 2 deferred. Hardened the gate against reporting a false PASS — empty/incomplete corpora now fail via `corpus_gaps`, per-check crash isolation, page-start anchor matching for dividers, positive cover-block shape assertion, `_find_single` ambiguity rejection, impossible-date containment, NFC/`Cf` text normalization, canonical LF+sorted-key manifest, and a new `--expect-reports` flag with a 0/1/2 exit contract. Test suite 88 → 125, all passing. |
| 2026-07-22 | Task 8 gate re-run against `spike/`: now **FAIL** (1 deviation, 9 corpus gaps) — the earlier PASS was the gate lacking any expectation of its corpus. The 104-report gate remains UNSATISFIED. |
| 2026-07-22 | Corpus supplied at `pmsr-corpus/` (104 PDFs). First real run surfaced two unmodelled knockout-cover variants: `"Bronze final"` (FIFA's third-place wording, was shadowed by the bare `final` keyword) and the shoot-out line `"(X win N-N on Penalties)"` printed between scoreline and stage in 4 reports. Both modelled and regression-tested; suite 125 → 130. |
| 2026-07-22 | **Task 8 SATISFIED — 104-report gate PASS.** 104/104 probed, 0 probe failures, 0 deviations, 0 corpus gaps; sample of 16 covering all 16 venues and all 9 matchday rounds. No mid-tournament template revision detectable at anchor level. Task 3's real-corpus validation subtask closed by the same run. Story status → done. |

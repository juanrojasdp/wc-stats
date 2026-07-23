---
baseline_commit: 1fe59f9
---

# Story 1.2: Batch Ingestion, Run Manifest & Text-Anchored Page Discovery

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the pipeline operator,
I want to run the batch over a directory of PMSR PDFs with per-report status tracking and text-anchored page location,
So that every report is processed reliably regardless of page order and re-runs are cheap and deterministic (FR-1, FR-2, UJ-5).

## Acceptance Criteria

1. **Run manifest — one terminal status per report.**
   **Given** a configured input directory of PMSR PDFs
   **When** a batch run executes
   **Then** the run manifest lists **exactly one** entry per PDF with a terminal status from the closed set `extracted | failed | skipped-unchanged`, and the entry count equals the PDF count — no report is silently absent.

2. **Per-report failures never abort the batch.**
   **Given** a report that cannot be processed
   **When** it fails
   **Then** the failure lands in that report's manifest entry as a **typed** exception (exception class name + localizing message + report ID), the report's status is `failed`, and the batch continues to the next report (AD-8). A run in which every report fails still produces a complete manifest and a non-zero exit code.

3. **Idempotent re-runs keyed on (PDF content hash, code version).**
   **Given** a completed run with unchanged inputs and unchanged code
   **When** the batch is re-run
   **Then** every report is reported `skipped-unchanged` and no PDF is re-parsed
   **And** when re-extraction is forced, every Extraction Record is **byte-identical** to the previous run's (FR-1, NFR-6, AD-8).

4. **Text-anchored page discovery — never page index.**
   **Given** any report
   **When** target pages are located
   **Then** location uses whitespace-normalized text search on section anchors, never page indices — a shuffled or offset report still resolves
   **And** a missing anchor fails **that report** loud with report ID + anchor text, never a silent skip (FR-2, AD-8).

5. **Pure per-report Extraction Record (AD-9).**
   **Given** the two-phase staging rule
   **When** a report's extraction completes
   **Then** a per-report Extraction Record is persisted to `work/extracted/{match-id}.json` carrying that report's own identity, its resolved anchor→page map, a structurally-present self-validation block, and its idempotence keys — with **zero cross-report knowledge** and zero wall-clock values.

6. **Test coverage.**
   **Given** pytest
   **When** the suite runs
   **Then** it covers: manifest completeness and the three terminal statuses; a failing report not aborting the batch; skip-on-unchanged and byte-identical forced re-extraction; match-ID derivation including the cover-vs-filename disagreement failure; a missing anchor producing a `failed` entry naming the anchor text; and Extraction Record purity (no corpus-level fields, no timestamps). Multi-report corpora are synthetic PDFs in `tmp_path`; real-PDF assertions use `spike/mex_rsa.pdf`.

7. *(Carried gate, from Story 1.4 AC 3)*
   **Given** the existing template-consistency verification mode
   **When** this story lands
   **Then** `python -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` still exits 0 with a clean gate, proving no regression.

## Tasks / Subtasks

- [x] **Task 1: Create the `pipeline/ingest/` subpackage** (AC: 1, 2)
  - [x] `pipeline/ingest/__init__.py` with a one-line docstring (match the style of `pipeline/discover/__init__.py`)
  - [x] `pipeline/ingest/errors.py` — `IngestError(PipelineError)` base, plus the typed classes this story raises (see **Dev Notes → Typed exception taxonomy**). Copy the pattern from `pipeline/discover/errors.py` verbatim: structured `__init__` args, attributes set, message formatted `[{report_id}] {what failed}`
  - [x] Add `pipeline.ingest` to `pipeline/tests/test_workspace.py::test_pipeline_subpackages_import` (it asserts each subpackage imports; a new subpackage must be added there)
  - [x] Do **NOT** create `pipeline/extract/`, `pipeline/markers/`, or `pipeline/precompute/` — later stories own those

- [x] **Task 2: Report identity — derive the match ID** (AC: 5)
  - [x] `pipeline/ingest/identity.py`: `match_id_for(meta: ReportMeta, source_path: Path) -> str` producing `m{NNN}-{home-slug}-{away-slug}` (3-digit zero-padded; see **Dev Notes → Match ID derivation** for the exact rule, the verified corpus evidence, and the slug algorithm)
  - [x] Read the match number from the cover stage line (`- Match N` suffix) and **cross-check it against the filename stem**; a disagreement, a missing number, or a number outside 1..999 raises a typed error → that report is `failed`. Never prefer one source silently
  - [x] Assert the produced ID matches the contract's `MatchId` pattern `^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$` (read the regex from `contract/common.schema.json` if convenient, or restate it with a comment citing the source — do **not** import anything from `contract/` at runtime)
  - [x] Detect duplicate match IDs within a run (two PDFs deriving the same ID): both reports `failed` with a typed error naming the collision — a silent overwrite in `work/extracted/` would lose a report

- [x] **Task 3: Idempotence keys** (AC: 3)
  - [x] `pipeline/ingest/fingerprint.py`: `pdf_content_hash(path) -> str` — SHA-256 over the file's bytes, read in chunks, returned as lowercase hex
  - [x] `code_version() -> str` — a deterministic fingerprint of the extraction code (see **Dev Notes → Code version**: SHA-256 over the sorted `(relative posix path, file bytes)` of `pipeline/**/*.py`, excluding `pipeline/tests/`, `pipeline/venv/`, and `__pycache__/`). Memoize per process; document why a source fingerprint is used instead of a hand-bumped constant or a git SHA
  - [x] Both keys are stored **inside** each Extraction Record so the skip decision needs nothing but the record itself

- [x] **Task 4: The per-report Extract function (pure)** (AC: 4, 5)
  - [x] `pipeline/ingest/extract_report.py`: `extract_report(path: Path) -> ExtractionRecord` — a pure function of one PDF, with **zero cross-report knowledge**
  - [x] Probe identity with the existing `probe_report(path)` (reuse — do not write a second cover reader)
  - [x] Resolve every anchor with `resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)` + **`PageTextIndex`** (one text extraction per page per document; the naive per-anchor walk is ~18× slower — measured in Story 1.4)
  - [x] Build the anchor→page map: `{anchor_id: [page numbers]}`, honoring `at_page_start` per spec. A `MissingAnchorError` on a `required` anchor fails that report; a non-required anchor is omitted from the map and named in a `warnings` list
  - [x] Assemble the record per **Dev Notes → Extraction Record shape**. Include the structurally-present `self_validation` block and the empty `domains` block that Stories 1.3+ fill in
  - [x] **Purity rules, enforced by test:** no `matchday_round` (it is corpus-level — see Dev Notes), no timestamps, no absolute paths, no run-scoped counters, no filesystem writes inside this function

- [x] **Task 5: Canonical record writer** (AC: 3, 5)
  - [x] `pipeline/ingest/records.py`: write `work/extracted/{match-id}.json` using the canonical recipe — `json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True) + "\n"`, written with `encoding="utf-8", newline=""`. **Reuse the exact recipe from `pipeline/validate/runner.py::_write`**; the `newline=""` is what stops Windows CRLF translation from breaking byte-identity
  - [x] Reader that loads an existing record and answers `is_unchanged(record, pdf_hash, code_version) -> bool`. A record that is missing, unreadable, or malformed is treated as absent (re-extract) — never as a skip
  - [x] **Write atomically**: serialize to a temp file in the same directory, then `os.replace()` onto the target (atomic on Windows and POSIX). A run interrupted mid-write must never leave a truncated record that a later run might read as valid
  - [x] Records use `snake_case` keys: `work/` is pipeline-internal staging (AD-9). camelCase binds only `/contract` and `/data`

- [x] **Task 6: Batch runner + run manifest** (AC: 1, 2, 3)
  - [x] `pipeline/ingest/batch.py`: enumerate PDFs exactly as `probe_corpus` does — `p.suffix.lower() == ".pdf"` over `input_dir.iterdir()`, sorted by `(stem, name)`. **Do not use `glob("*.pdf")`**: it is case-insensitive on Windows and case-sensitive on POSIX, which would make corpus membership host-dependent
  - [x] Per report, in sorted order: compute `pdf_content_hash`; if a record exists whose stored `(pdf_content_hash, code_version)` match and `--force` was not passed → status `skipped-unchanged`, do not open the PDF; otherwise run `extract_report`, write the record, status `extracted`
  - [x] Wrap each report in `try/except`: catch `PipelineError` (typed) **and** `Exception` (untyped, e.g. a corrupt PDF that pymupdf refuses) — both become a `failed` entry carrying `error_type` (the exception class name) and `error` (its message). Nothing propagates out of the per-report loop
  - [x] Duplicate report-id / duplicate match-id detection as in Task 2, recorded as `failed` entries
  - [x] Write the manifest to `work/run-manifest.json`, canonically serialized. Shape in **Dev Notes → Run manifest shape**. Exactly one entry per discovered PDF; assert this before writing
  - [x] **Detect orphan records** (see **Dev Notes → Orphan records**): any `work/extracted/*.json` this run neither wrote nor skipped is listed in the manifest's `orphan_record_paths` and named in the console summary. Report them — do **not** delete them
  - [x] The single permitted volatile field is `run_timestamp` (ISO 8601 UTC), matching the precedent set by `work/verification/verification-report.json`. Nothing else in the manifest and **nothing at all** in an Extraction Record may vary between two runs over an unchanged corpus

- [x] **Task 7: CLI entrypoint** (AC: 1, 3)
  - [x] `python -m pipeline.ingest.batch --input-dir <corpus-dir>` with `--output` (default `work/run-manifest.json`), `--extracted-dir` (default `work/extracted`), `--force` (re-extract regardless of idempotence keys), `--expect-reports N`
  - [x] Exit codes matching the established contract: `0` = every report `extracted` or `skipped-unchanged`; `1` = one or more `failed`, or an `--expect-reports` mismatch, or an empty corpus; `2` = the harness could not run (bad input dir, unwritable output)
  - [x] Human-readable console summary: counts by status, then every `failed` report with its `error_type` and message — a reader must be able to identify each failure without opening the manifest
  - [x] Copy the two hardening details from `pipeline/validate/verify.py::main`: `stream.reconfigure(errors="replace")` on stdout/stderr (PDF-derived text vs. cp1252 console), and `except (OSError, ValueError)` → exit 2 so a broken harness is distinguishable from a failed run
  - [x] **An empty corpus is a failure, not a clean run** — same rule as the 1.4 gate

- [x] **Task 8: Tests** (AC: 6)
  - [x] `pipeline/tests/test_ingest_identity.py` — match-ID derivation on `spike/mex_rsa.pdf` (`m001-mexico-south-africa`); the three accented team names slug correctly (see Dev Notes table); cover-vs-filename disagreement raises; produced IDs satisfy the `MatchId` pattern
  - [x] `pipeline/tests/test_ingest_fingerprint.py` — content hash is stable and differs for differing bytes; `code_version` is stable across calls and changes when a `pipeline/*.py` file changes (use `tmp_path` copies or monkeypatched roots — do **not** mutate the real tree)
  - [x] `pipeline/tests/test_ingest_batch.py` — synthetic multi-report corpus in `tmp_path`: manifest has exactly one entry per PDF; all three statuses reachable; a deliberately corrupt/unreadable PDF yields `failed` while its neighbours still reach `extracted`; second run reports all `skipped-unchanged`; `--force` re-run produces **byte-identical** record files (compare `read_bytes()`, not parsed dicts — Story 1.4's review caught exactly that weak assertion)
  - [x] `pipeline/tests/test_ingest_record.py` — record purity: no key named `matchday_round` anywhere in the tree, no ISO-timestamp-shaped value, the `self_validation` and `domains` blocks are structurally present, and a hand-corrupted record is re-extracted rather than skipped
  - [x] Orphan detection: drop a stray `work/extracted/m999-foo-bar.json` into a `tmp_path` extracted dir, run the batch, assert it is listed in `orphan_record_paths`, is **still on disk** afterwards, and did not change `failed_count` or the run result
  - [x] Missing-anchor case: build a synthetic PDF whose pages lack a required anchor → `failed` entry whose message contains both the report ID and the anchor text
  - [x] Follow the house style: `from __future__ import annotations` first; module docstring naming the Task + AC it covers; long sentence-like test names; repo-root-relative paths only; reuse the `repo_root` / `mex_rsa_pdf` / `spike_corpus` fixtures from `conftest.py`
  - [x] **The 256 existing tests must stay green.** Run the whole suite, not just the new files

- [x] **Task 9: Run the batch over the real corpus & record the result** (AC: 1, 2, 4)
  - [x] `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104`
  - [x] Paste the verbatim console summary into the Dev Agent Record, then re-run immediately and paste the second summary showing 104 `skipped-unchanged`
  - [x] **This is the first time all 104 reports have their anchors resolved** — Story 1.4's gate only sampled 16. If reports in the other 88 fail on a missing anchor, that is a real finding: record it per report, report the anchor and the reports affected in the Dev Agent Record, and **do not weaken the anchor registry or make the anchor optional to get a green run** (SM-C1). Raise it instead

- [x] **Task 10: Docs + the carried gate** (AC: 7)
  - [x] Extend `pipeline/README.md` with a "Batch ingestion" section: the command, the flags, the exit-code table, where records and the manifest land, and the idempotence rule (what invalidates a skip). Add `ingest/` to the Layout block
  - [x] Correct the factual error in `pipeline/discover/rounds.py`'s docstring: it states the cover's match number is *"a match number within the group (1..6)"*. Verified against all 104 reports — it is the **global** match number (`Group A - Match 25`, `Group B - Match 51`). Behaviour is unaffected (the module never reads the number), but the claim is wrong and this story now depends on the true rule. Fix the docstring only
  - [x] Re-run the 1.4 gate: `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104` → exit 0, gate `pass`. Paste the verbatim output

### Review Findings

Adversarial code review 2026-07-22 (Blind Hunter + Edge Case Hunter + Acceptance Auditor).
All 7 ACs judged satisfied; AC 4 and AC 6 satisfied with coverage gaps noted below.

**Decisions resolved** (Juan, 2026-07-22 — all three became patches)

- [x] [Review][Patch] **Decision 1 → fold `pipeline/requirements.txt` into `code_version`** [pipeline/ingest/fingerprint.py:54] — the fingerprint covers only `pipeline/**/*.py`, so a pymupdf/pdfplumber bump changes extraction output while leaving the key byte-identical and all 104 records `skipped-unchanged`. Hash the pinned dependency set alongside the sources; a dependency bump now correctly invalidates the corpus. Update the module docstring, which currently claims the fingerprint "invalidates precisely when extraction code changes".
- [x] [Review][Patch] **Decision 2 → orphan records fail the run** [pipeline/ingest/batch.py:224] — `run.result` ignored `orphan_record_paths`, so a run reporting orphans still exited 0 and CI could not detect the phantom-match hazard the mechanism exists to surface. Orphans now fail the run (`result: "fail"`, exit 1) while still **never** inflating `failed_count` — they stay a run-level observation, as the Dev Notes require, and are still reported-not-deleted.
- [x] [Review][Patch] **Decision 3 → tighten `MAX_MATCH_NUMBER` to 104** [pipeline/ingest/identity.py:37] — Task 2 prescribed 1..999, but `contract/match-bundle.schema.json` and `contract/tournament.schema.json` both cap `matchNumber` at 104. A misread cover printing "Match 501" would otherwise stage a record satisfying `MatchId` that Story 1.16 cannot emit. The three-digit padding rule is unaffected.

**Patches**

- [x] [Review][Patch] Blanket `except Exception` relabels anchor-registry authoring bugs as report-data failures [pipeline/ingest/extract_report.py:121] — `resolve_anchors` raises `ValueError`/`KeyError` for a malformed `AnchorSpec` and is called inside the guarded block; the handler rewrites it as `ProbeError("could not read report pages: …")`. `pipeline/discover/anchors.py:160-164` states these "fail loudly at resolution time rather than surfacing as a phantom missing anchor across all 104 reports" — this handler defeats that, turning one registry typo into 104 identical `failed` entries blaming the corpus. Live risk for Stories 1.3 and 1.6–1.14, which all edit the registry.
- [x] [Review][Patch] AC 4's "a shuffled or offset report still resolves" has no test [pipeline/tests/conftest.py:106] — `make_report` always emits anchor pages in `ANCHOR_REGISTRY` order with the cover at index 0. Only the negative (missing anchor) case is covered. A `shuffle_pages` / leading-blank-page option asserting an unchanged anchor map closes the AC.
- [x] [Review][Patch] Optional-anchor `warnings` branch is untested and the Dev Agent Record claims otherwise [pipeline/ingest/extract_report.py:92] — Completion Notes state "The `warnings` path for a non-required anchor exists and is tested". It is not: the only `warnings` assertion in the suite is `== []`. Three branches are dead in the suite — the optional-anchor append, the `probe note:` extend (extract_report.py:124), and `format_summary`'s entire "Warnings (non-fatal)" block. Correct the claim and cover the path.
- [x] [Review][Patch] `RecordWriteError` has zero test coverage though it guards AC 2 [pipeline/ingest/records.py:76] — this wrap is what keeps an unwritable staging directory inside the per-report loop; without it a raw `OSError` becomes exit 2 for the whole run.
- [x] [Review][Patch] `MatchNumberError` is overloaded for two failure classes it does not name [pipeline/ingest/identity.py:124,128] — raised for an unsluggable team name and for a MatchId-pattern violation, so the manifest reads `match number could not be established: team name '!!!' produces no slug characters`. The taxonomy asks one class per failure; the dev already added `DuplicateReportIdError` on that reasoning. Add `TeamSlugError` / `MatchIdFormatError`, and make `team_slug` raise a `PipelineError` rather than a bare `ValueError`.
- [x] [Review][Patch] The reuse path trusts a staged record's `match_id` with no validation [pipeline/ingest/batch.py:173,188] — `is_unchanged` validates only the `idempotence` block. A staged record with matching keys but a missing `match_id` yields an untyped `[KeyError] 'match_id'` naming no report; a wrong-but-well-formed value makes the manifest advertise a `match_id` contradicting the record file's own name, feeding Story 1.15 an identity no PDF produced. Validate against `MATCH_ID_RE` and check `staged_path.stem == match_id`, else treat as absent.
- [x] [Review][Patch] `claimed[...]` is set before `entry["warnings"]`, so a malformed staged `warnings` hides the record from the orphan scan [pipeline/ingest/batch.py:189,193] — `list(record.get("warnings", []))` on a non-list raises after the path is already claimed; the report is `failed` with `record_path: None` while the file stays out of `orphan_record_paths`. Assign `claimed` last.
- [x] [Review][Patch] `_fail` leaves `match_id` and `warnings` populated on a retro-failed entry [pipeline/ingest/batch.py:111,184] — on a duplicate-match-id collision the earlier report is re-failed after those fields are set, producing a `failed` entry with a non-null `match_id` that no other failure path produces.
- [x] [Review][Patch] `EXCLUDED_DIRS` omits `.venv`, `site-packages`, `build`, `.tox` [pipeline/ingest/fingerprint.py:36] — a virtualenv at `pipeline/.venv` (the more common convention) is hashed in full, so `code_version` churns on every `pip install` and invalidates all 104 records.
- [x] [Review][Patch] `code_version` globs only `*.py`, so the promised slug-registry pickup will not happen [pipeline/ingest/fingerprint.py:62] — the docstring states AD-8's committed slug registry "will live under `pipeline/`, so this fingerprint picks it up for free when it lands". A registry committed as `.json`/`.csv`/`.yaml` — the natural formats — is outside the glob, and editing it would change extraction output without invalidating a single record. Narrow the claim now, widen the glob when 1.15 fixes the format.
- [x] [Review][Patch] `source_fingerprint` returns the SHA-256 of no input when it finds no files [pipeline/ingest/fingerprint.py:70] — `code_version` silently becomes a fixed constant, so every record answers `is_unchanged` forever. Assert at least one file contributed.
- [x] [Review][Patch] `rglob("*.py")` reintroduces the host-dependent glob this package avoids elsewhere [pipeline/ingest/fingerprint.py:62] — `discover_pdfs` matches `suffix.lower()` with a five-line docstring explaining why; the fingerprint does not, so a `Foo.PY` yields different `code_version` values per host despite the docstring's "Windows and POSIX agree".
- [x] [Review][Patch] The `len(entries) != len(paths)` invariant AC 1 relies on is tautological [pipeline/ingest/batch.py:197] — `entries.append` is unconditional and nothing removes entries, hence `# pragma: no cover`. Assert terminality instead (every entry's status is in `STATUSES`), which also removes the `counts[None]` KeyError path.
- [x] [Review][Patch] Docstrings and notes state the corpus lives outside the repo — it does not [pipeline/tests/test_ingest_batch.py:5, pipeline/tests/test_ingest_record.py:122, this file's Completion Notes] — `pmsr-corpus/` sits at the repo root (gitignored via `*.pdf`), and the staged record proves the repo-relative branch runs: `"source_pdf": "pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf"`. Behaviour is correct; the stated rationale for the `path.name` fallback is not. Relatedly, `relative_source_path`'s repo-relative branch is only exercised on the pure helper, never end-to-end.
- [x] [Review][Patch] "the skip decision … never opens the PDF" contradicts hashing every PDF [pipeline/ingest/batch.py:15, pipeline/README.md] — `fingerprint.py:44-45` says the opposite in the same change set. The true invariant is "never re-*parsed*"; reword both so a later story does not build on a false one.
- [x] [Review][Patch] Every PDF is SHA-256'd twice per extracted report [pipeline/ingest/batch.py:164 + pipeline/ingest/extract_report.py:132] — two full reads of a multi-MB file, 104× per cold run, and the two samples are taken at different instants. Pass the computed hash into `extract_report`.
- [x] [Review][Patch] `MATCH_ID_RE` is not bound to the contract by any test [pipeline/ingest/identity.py:33] — the literal currently matches `contract/common.schema.json` exactly, but nothing enforces that, and `contract/` is being edited concurrently. A test that reads the pattern out of the schema file closes the drift without a runtime import (the scope fence forbids the import, not the test).
- [x] [Review][Patch] `test_a_changed_code_version_invalidates_every_skip` patches one of two call sites [pipeline/tests/test_ingest_batch.py:292] — only `batch_module.code_version` is rebound; `extract_report` holds its own import, so the records written carry the real version while the manifest reports `ffff…`. Production is unaffected (both share the `lru_cache`), but the test proves less than its name.
- [x] [Review][Patch] Hardcoded `len(record["anchors"]) == 47` defeats the self-widening fixture design [pipeline/tests/test_ingest_record.py:66] — `make_report`'s docstring says anchors are generated from `ANCHOR_REGISTRY` "so a domain page added by a later story widens these fixtures automatically"; this assertion reintroduces the manual maintenance. Derive the expected count from `resolve_anchors`.
- [x] [Review][Patch] `drop_anchor_ids` silently drops nothing on a typo [pipeline/tests/conftest.py:107] — no check that each requested id matched a real anchor. Current tests are safe because they assert the resolved anchor text, but the trap is laid for the next author.
- [x] [Review][Patch] `read_record` does not treat `RecursionError` as malformed [pipeline/ingest/records.py:88] — a deeply nested record escapes as a traceback, contradicting the module contract that missing/unreadable/malformed means absent.
- [x] [Review][Patch] `.tmp` files survive non-`OSError` failures and are invisible to the orphan scan [pipeline/ingest/records.py:52, pipeline/ingest/batch.py:74] — a `UnicodeEncodeError` (lone surrogates in PDF-derived text) or an interrupt leaves `{name}.{pid}.tmp` behind, and `_existing_record_files` filters on `.json` so it is never reported.
- [x] [Review][Patch] Nothing rejects `--output` sitting inside `--extracted-dir` [pipeline/ingest/batch.py:309] — the manifest is then parsed as a record, dropped for lacking `report_id`, and reported as an orphan on every subsequent run; aimed at an existing `m###-*.json` it overwrites a real record.
- [x] [Review][Patch] `--expect-reports` accepts 0 and negative values [pipeline/ingest/batch.py:326] — produces "corpus holds 0 reports, expected -5" instead of an argument error.
- [x] [Review][Patch] Match-number regexes use `\d` without `re.ASCII` [pipeline/ingest/identity.py:39-40] — fullwidth or Arabic-Indic digits are accepted by `int()`, producing a disagreement message showing two numbers that look identical.
- [x] [Review][Patch] `is_unchanged` never consults `record_version` [pipeline/ingest/records.py:95] — `RECORD_VERSION` is written into every record and read by nothing; the skip rests entirely on `code_version` as a schema-compatibility proxy.
- [x] [Review][Patch] `match_id_for` does not reject `home == away` [pipeline/ingest/identity.py:126] — `m001-x-x` satisfies `MATCH_ID_RE` and stages cleanly.
- [x] [Review][Patch] A manifest write failure discards a fully successful run [pipeline/ingest/batch.py:232] — `write_canonical` is the last statement before `return`, so an `OSError` after all 104 records are staged prints "batch ingestion could not run" with exit 2 and no summary. Print the summary before writing.

**Deferred** (see `deferred-work.md`)

- [x] [Review][Defer] Suite is red on the current tree: 3 `test_fixtures.py` failures — deferred, pre-existing (Story 1.1's concurrent `contract/match-bundle.schema.json` + `pipeline/validate/schema.py` edits; this story's 89 tests all pass)
- [x] [Review][Defer] All 104 staged records are already stale (`a001b41f3e53` → `57572a38efaf`) — deferred, pre-existing (Story 1.1's `pipeline/validate/schema.py` edit moved the fingerprint; spec-compliant behaviour, but re-run the batch before Story 1.15 consumes records)
- [x] [Review][Defer] No test exercises the batch beyond n=3 [pipeline/tests/test_ingest_batch.py:33] — deferred, pre-existing (`_corpus` caps at 5 via `TEAMS`; corpus-scale acceptance is Story 1.19)
- [x] [Review][Defer] Synthetic fixtures give every anchor exactly one page [pipeline/tests/conftest.py:106] — deferred, pre-existing (multi-page anchor lists, which `anchors.py:71` says shots produce, are never exercised; the ascending-pages assertion is trivially true)
- [x] [Review][Defer] Duplicate `anchor_id`s would silently overwrite in the anchor map [pipeline/ingest/extract_report.py:89] — deferred, pre-existing (registry uniqueness is `anchors.py`'s invariant, outside this story)
- [x] [Review][Defer] A three-way match-id collision loses one collision fact from the manifest [pipeline/ingest/batch.py:178] — deferred, pre-existing (owner stays the first report, so report A's error names only the last collider)

## Dev Notes

### Scope fence — read this first

This story is the **pure per-report Extract phase of AD-9, and nothing else.**

| In scope | Out of scope — and whose it is |
| --- | --- |
| `work/extracted/{match-id}.json` internal records | `data/matches/*.json` contract artifacts → **Story 1.16** |
| Batch orchestration, run manifest, idempotence | Batch *report* / 104-104 acceptance → **Story 1.19** |
| Anchor→page map per report | Actually parsing any domain off those pages → **Stories 1.3, 1.6–1.14** |
| Mechanical match-ID derivation | Player identity resolution, slug registry, cross-match spine → **Story 1.15** |
| A structurally-present `self_validation` block | Real self-validation content (marker counts, link rate) → **Stories 1.3, 1.5** |

**Story 1.1's contract is still in code review.** Do not import from `contract/`, do not validate Extraction Records against any JSON Schema, and do not add a schema dependency to this story's code path. Extraction Records are **internal `work/` staging**, not contract artifacts — `snake_case` keys, no `schemaVersion` stamp, no camelCase mapping. The one place the contract is allowed to influence this story is the `MatchId` **pattern**, restated as a literal regex with a source comment (Task 2) so the ID this story derives is the one 1.16 will eventually emit.

### What already exists — reuse, do not rediscover

Stories 1.4 (`done`) and 1.1 (`review`) built the ground you stand on. All 256 tests are green.

| Module | What it gives you |
| --- | --- |
| `pipeline/errors.py` | `PipelineError` — the base class every typed exception subclasses |
| `pipeline/discover/errors.py` | `MissingAnchorError(anchor_text, report_id)`, `ProbeError(reason, report_id)`. **Also the pattern to copy** for your own typed classes |
| `pipeline/discover/text.py` | `normalize()`, `page_text()`, **`PageTextIndex`** (`find_all`, `find_first`, both with `at_start=`). This is your discovery engine — do not write a second one |
| `pipeline/discover/anchors.py` | `ANCHOR_REGISTRY` (30 specs → **47 resolved anchors**: 13 single + 17 per-team × 2) and `resolve_anchors(specs, home, away)` returning `ResolvedAnchor(anchor_id, text, domain, required, at_page_start)` |
| `pipeline/discover/probe.py` | `probe_report(path) -> ReportMeta` (cover identity: teams, scores, `stage_text`, `group`, `match_date`, `kickoff`, `venue`, `shootout`, `probe_notes`) and `probe_corpus(dir)`. **`ReportMeta` is your whole record-identity block, for free.** Note its PDF-enumeration rule — copy it, don't re-invent it |
| `pipeline/discover/rounds.py` | `assign_matchday_rounds()` — **corpus-level. Do not call it from `extract_report`** (see the purity trap below) |
| `pipeline/validate/runner.py` | `_write()` — the canonical serializer recipe. Reuse verbatim |
| `pipeline/validate/verify.py` | The CLI shape to mirror: argparse, `reconfigure(errors="replace")`, `format_summary()`, 0/1/2 exit contract |
| `pipeline/tests/conftest.py` | `repo_root`, `mex_rsa_pdf`, `spike_corpus` session fixtures + the `sys.path` insert |

`spike/` is **frozen** — read it, never modify it.

### The AD-9 purity trap (most likely way to get this wrong)

`ReportMeta.matchday_round` is filled by `assign_matchday_rounds()`, which needs **the whole corpus** — group matchdays are derived by walking every fixture in a group, and the module refuses to derive at all unless the group holds all 6. Putting `matchday_round` into an Extraction Record would:

- inject cross-report knowledge into a function AD-9 requires to be pure, and
- break AC 3's byte-identity, because the same PDF extracted alone and extracted as part of the 104 would produce **different records**.

So: `extract_report` calls `probe_report`, never `probe_corpus`, and never `assign_matchday_rounds`. The record stores `stage_text` and `group` verbatim (both are printed on that report's own cover); the matchday round is precompute's business.

The same rule kills two other tempting fields: a run counter/index, and anything read from `pmsr-corpus/manifest.csv`. **`manifest.csv` is download provenance, not pipeline input** — every fact this story needs is on the PDF's own cover (verified below). Point the batch at the directory, ignore the CSV.

### Match ID derivation — verified against all 104 reports

Format: `m{NNN}-{home-slug}-{away-slug}`, e.g. `m001-mexico-south-africa`, `m074-germany-paraguay`. This matches Story 1.1's committed fixtures and its `MatchId` pattern `^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$`. Three-digit zero padding is a **logged decision from Story 1.1** (`contract/README.md`): AD-3 requires precompute to consume records in ascending-match-ID order, and unpadded IDs sort `m1, m10, m100, m11…`. Padded, string order equals numeric order by construction.

**The match number is on the cover, and it is global at every stage.** Verified 2026-07-22 by probing all 104 reports: every `stage_text` ends with `- Match N`, and N equals the filename's number in 104/104 cases.

```
PMSR-M01-MEX-V-RSA    'Group A - Match 1'          PMSR-M73-RSA-V-CAN   'Round of 32 - Match 73'
PMSR-M25-CZE-V-RSA    'Group A - Match 25'         PMSR-M100-ARG-V-SUI  'Quarter-final - Match 100'
PMSR-M51-SUI-V-CAN    'Group B - Match 51'         PMSR-M103-FRA-V-ENG  'Bronze final - Match 103'
                                                   PMSR-M104-ESP-V-ARG  'Final - Match 104'
```

> `pipeline/discover/rounds.py`'s docstring claims this number is *"a match number within the group (1..6)"*. That is **wrong** — M25 is `Group A - Match 25`. Nothing reads the number today so no behaviour changed, but Task 10 fixes the docstring because this story now relies on the true rule.

Use **both** sources and require agreement: parse `- Match (\d+)$` off `stage_text`, parse `^PMSR-M(\d+)-` off the filename stem, and raise a typed error if they disagree or either is absent. The filename is a human-managed download artifact and the cover is authoritative content — an agreement check is what turns a mis-named download into a loud `failed` entry instead of a bundle emitted under another match's ID.

**Team slug algorithm** (AD-3: lowercase ASCII kebab, accent-stripped): NFKD-normalize → drop non-ASCII → lowercase → replace each run of non-`[a-z0-9]` with `-` → collapse repeats → strip leading/trailing `-`.

Verified over the 48 distinct team names the corpus prints: **zero slug collisions**, and exactly three names need more than lowercasing:

| Printed | Slug |
| --- | --- |
| `Curaçao` | `curacao` |
| `Côte d'Ivoire` | `cote-d-ivoire` |
| `Türkiye` | `turkiye` |

Pin `cote-d-ivoire` (the apostrophe is a separator like any other non-alphanumeric) and assert all three in a test. AD-3 says an emitted ID never changes; `work/` is regenerable so this is not yet irreversible, but Story 1.15 will adopt whatever you pin here — get it right now.

### Code version — why a source fingerprint

AD-8 keys idempotence on *(PDF content hash, code version)*. Three candidate implementations:

- **A hand-bumped constant** — silently serves stale records the first time someone forgets to bump it. The failure is invisible and produces wrong data, which is the project's one unrecoverable failure mode.
- **A git commit SHA** — wrong during development, which is exactly when re-runs happen: a dirty worktree keeps reporting the committed SHA while the extractor changes underneath it.
- **A source fingerprint** *(use this)* — SHA-256 over the sorted `(relative posix path, file bytes)` of every `pipeline/**/*.py`, excluding `pipeline/tests/`, `pipeline/venv/`, and `__pycache__/`. Automatic, deterministic, and invalidates precisely when extraction code changes.

Sort by relative **posix** path so Windows and POSIX agree. Memoize per process — recomputing it 104 times is pointless. Excluding `pipeline/tests/` is deliberate: a test edit cannot change extraction output, and invalidating 104 records on every test tweak would make the cache useless. Document that trade-off in the module docstring.

AD-8 notes the code version "includes the committed slug registry" — that registry is Story 1.15's artifact and does not exist yet. When it lands it will live under `pipeline/`, so the fingerprint picks it up for free. Say so in a comment.

### Extraction Record shape

`work/extracted/{match-id}.json`, `snake_case`, canonically serialized. Fill in what exists today; leave the seams Stories 1.3+ plug into.

```jsonc
{
  "record_version": 1,                 // internal staging format, unrelated to /contract schemaVersion
  "match_id": "m001-mexico-south-africa",
  "report_id": "PMSR-M01-MEX-V-RSA",   // filename stem, the manifest's join key
  "source_pdf": "pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf",  // repo-relative posix, never absolute
  "idempotence": {
    "pdf_content_hash": "<sha256 hex>",
    "code_version": "<sha256 hex>"
  },
  "metadata": {                        // straight from ReportMeta — this report's own cover only
    "home_team": "Mexico", "away_team": "South Africa",
    "home_score": 2, "away_score": 0,
    "match_number": 1,
    "stage_text": "Group A - Match 1", "group": "A",
    "match_date": "2026-06-11", "kickoff": "13:00",
    "venue": "Mexico City Stadium",
    "shootout": null,
    "probe_notes": []
  },
  "page_count": 52,
  "anchors": {                         // anchor_id -> ascending page numbers, from PageTextIndex
    "cover": [0],
    "shots:home": [21, 22],
    "shots:away": [33, 34]
  },
  "domains": {},                       // Stories 1.3, 1.6-1.14 fill this in
  "self_validation": {                 // structurally present from day one, like 1.4's deviation categories
    "result": "not-applicable",        // not-applicable | pass | fail
    "checks": []
  },
  "warnings": []                       // non-fatal: optional anchors that did not resolve, probe notes
}
```

Rules that AC 3 and AC 5 turn into tests:

- **No timestamps anywhere.** Not `extracted_at`, not a run id. They would make every re-run differ.
- **No `matchday_round`** (see the purity trap).
- **`source_pdf` is repo-relative posix**, so a record produced on one machine matches one produced on another.
- `"result": "not-applicable"` is honest today: no extractor exists, so there is nothing to self-validate. Do not write `"pass"` — that would read as a passed check in Story 1.19's acceptance.

### Run manifest shape

`work/run-manifest.json`, canonically serialized, `snake_case`. This is AD-8's "single record of truth" and Story 1.19 builds its batch report on top of it — keep the shape stable and boring.

```jsonc
{
  "manifest_version": 1,
  "generated_by": "pipeline.ingest.batch",
  "run_timestamp": "2026-07-22T…Z",    // the ONLY volatile field in the whole run
  "input_dir": "pmsr-corpus",
  "code_version": "<sha256 hex>",
  "corpus": { "pdf_count": 104, "expected_pdf_count": 104 },
  "counts_by_status": { "extracted": 104, "failed": 0, "skipped-unchanged": 0 },
  "reports": [                          // sorted by report_id; EXACTLY one per discovered PDF
    {
      "report_id": "PMSR-M01-MEX-V-RSA",
      "match_id": "m001-mexico-south-africa",   // null when identity could not be established
      "status": "extracted",                    // extracted | failed | skipped-unchanged
      "record_path": "work/extracted/m001-mexico-south-africa.json",  // null when failed
      "error_type": null,                       // e.g. "MissingAnchorError"
      "error": null,                            // the exception's localizing message
      "warnings": []
    }
  ],
  "orphan_record_paths": [],            // records in work/extracted/ this run neither wrote nor skipped
  "run": { "result": "pass", "failed_count": 0, "corpus_gaps": [] }
}
```

Assert `len(reports) == pdf_count` before writing. A manifest that silently lists 103 of 104 is precisely the failure AD-8 exists to prevent, and it is cheap to make impossible.

### Orphan records — a silent-wrong-data hazard worth closing now

`work/extracted/` is keyed by **match ID**, but the batch iterates by **PDF**. The two can drift apart: rename a source PDF, correct a mis-typed match number, or fix a team-name slug, and the run writes a record under the new ID while the record under the old ID stays on disk. Story 1.15's precompute consumes *all* Extraction Records in canonical order — so an orphan from a superseded run would enter the dataset as a phantom match, and every aggregate downstream would be quietly wrong.

Closing it is cheap: after the report loop, diff the `*.json` files present in the extracted directory against the set of record paths this run wrote or skipped, and list the difference in `orphan_record_paths` plus the console summary.

**Report, do not delete.** Deleting files the run did not create is destructive and can silently discard a partially-complete corpus run. Listing them makes the state visible and lets Juan decide. Note in `pipeline/README.md` that Story 1.15 must consume only the records the manifest names — the manifest, not the directory listing, is the record of truth (AD-8). An orphan is not a `failed` report and must not inflate `failed_count`; it is a run-level observation, exactly as `corpus_gaps` is in the 1.4 gate.

### Typed exception taxonomy (Consistency Conventions: one per failure class)

In `pipeline/ingest/errors.py`, all subclassing `IngestError(PipelineError)`. Each carries `report_id` and formats `[{report_id}] …` like the discovery errors:

| Exception | Raised when |
| --- | --- |
| `MatchNumberError` | the cover has no `- Match N`, the filename has no number, or the two disagree |
| `DuplicateMatchIdError` | two PDFs in one run derive the same match ID |
| `RecordWriteError` | the record could not be written (wrap the `OSError`, keep the report ID) |

Reuse — do not redefine — `MissingAnchorError` and `ProbeError` from `pipeline/discover/errors.py`. The manifest records `type(exc).__name__`, so a reused class is a feature: the manifest names the real failure class either way.

Catch **`Exception`, not just `PipelineError`**, in the per-report loop. A corrupt PDF makes pymupdf raise its own types, and AC 2 says the batch continues regardless. `probe_report` already models this: it wraps arbitrary open failures into `ProbeError`.

### Expect a slower run than the 1.4 gate, and a possible real finding

The 1.4 gate ran 47 anchor resolutions × 16 sampled reports. This story runs 47 × **104**. `PageTextIndex` extracts each page's text once per document (~52 pages/report), so budget a few minutes for a cold full run; the second run should be near-instant because every report skips without opening its PDF. That contrast is itself the AC 3 demonstration — put both timings in the Dev Agent Record.

The 88 reports outside 1.4's sample have **never had their anchors resolved**. If some fail, that is the gate doing its job on a wider surface. Record it honestly (Task 9) and raise it — never relax an anchor to `required=False` to get a green run. Note that `AnchorSpec.required` is currently dead code (no spec sets it `False`); if a genuinely optional section turns up, that is a finding to raise, not a switch to flip quietly.

### Architecture guardrails (binding)

- **AD-8 (fail loud, deterministic):** typed exception per failure class; every failure lands in the manifest; the batch never aborts; page discovery is text-anchored, never index-based (the PDF header lies about page count — claims 8, reports run ~52); canonical serialization makes re-runs byte-identical.
- **AD-9 (staging):** `extract_report` is a pure `PDF → Extraction Record`. Precompute (1.15+) is the only phase that may know about more than one report. `work/` is pipeline-internal staging and is gitignored — records and the manifest are regenerable, never the source of truth.
- **AD-1 (two-system boundary):** nothing here reads `app/`, and nothing presentational is emitted.
- **AR-15 (stack pins):** Python 3.13+ (venv runs 3.14.4), pymupdf 1.28.0, pdfplumber 0.11.10, pytest 8.4.2, installed by **pip** from `pipeline/requirements.txt` — **never `uv`**. This story should need **no new dependency**: `hashlib`, `json`, `argparse`, `pathlib` are stdlib. If you think you need one, that is a signal to reconsider.
- **Conventions:** Python `snake_case`; English everywhere; `from __future__ import annotations` first in every module; modern hints (`str | None`, `list[int]`); `@dataclass(frozen=True)` for value objects; absolute imports rooted at `pipeline.`; module docstrings that explain **why**, naming the specific failure they defend against.

### Testing standards

- **Run command (exact)** — a bare `python -m pytest` fails with `ModuleNotFoundError: No module named 'pymupdf'`:
  ```
  pipeline\venv\Scripts\python.exe -m pytest pipeline/tests
  ```
- Synthetic multi-report corpora: generate real PDFs into `tmp_path` with pymupdf, the way `pipeline/tests/test_runner.py` already does. Your synthetic covers must satisfy `probe.py`'s **positive block-shape assertion** — scoreline, [optional shoot-out line], stage, date, kick-off, venue, `POST MATCH SUMMARY REPORT`, each immediately following the last — or every synthetic report will fail to probe. Read `cover_lines()` and `probe_report()` before writing the first fixture; copy an existing synthetic-cover helper rather than inventing one.
- Byte-identity must be asserted on **bytes** (`path.read_bytes()`), never on parsed dicts. Story 1.4's review found exactly that hole.
- Tests are deterministic and offline; repo-root-relative paths only; no absolute paths.
- Do not add `pytest.ini` / `pyproject.toml` — config is implicit plus `conftest.py`.

### Project Structure Notes

```text
pipeline/
  ingest/                    # NEW — this story (Structural Seed: "batch orchestration, run manifest, idempotence")
    __init__.py
    batch.py                 #   runner + CLI entrypoint
    errors.py                #   IngestError + typed subclasses
    extract_report.py        #   the pure per-report Extract function
    fingerprint.py           #   pdf_content_hash, code_version
    identity.py              #   match-ID derivation + team slugs
    records.py               #   canonical record read/write
  discover/                  # UNCHANGED except one docstring fix in rounds.py (Task 10)
  validate/                  # UNCHANGED
  tests/
    test_ingest_batch.py     # NEW
    test_ingest_fingerprint.py # NEW
    test_ingest_identity.py  # NEW
    test_ingest_record.py    # NEW
    test_workspace.py        # MODIFIED — add pipeline.ingest to the subpackage import test
  README.md                  # MODIFIED — batch ingestion section + ingest/ in Layout
work/                        # gitignored, regenerable
  extracted/                 # NEW at runtime — {match-id}.json per report
  run-manifest.json          # NEW at runtime
  verification/              # existing (Story 1.4)
```

**Do NOT create:** `pipeline/extract/`, `pipeline/markers/`, `pipeline/precompute/`, `app/`, `data/matches/`, `data/index/`, the slug registry. **Do NOT modify:** anything under `spike/` (frozen), `contract/` (Story 1.1, in review), `data/fixtures/`. The `ingest/` vs `extract/` split is the Structural Seed's — orchestration here, domain parsers there.

**Open deferred items** (`_bmad-output/implementation-artifacts/deferred-work.md`): the two Story 1.4 findings (cover-line reconstruction thresholds; zero-width/format-character normalization) stay deferred. Neither is this story's scope. If the full-104 run surfaces evidence bearing on either, add it to the deferred entry rather than fixing it here.

### Previous story intelligence

**From Story 1.4 (`done`)** — its code review produced 29 findings; these are the ones that would bite this story again:

- A `try/except` wrapped around a whole loop collapsed 46 real deviations into 1. **Isolate per report**, and record the failure against the report that caused it.
- `glob("*.pdf")` made corpus membership platform-dependent. Use the `iterdir()` + `suffix.lower()` rule.
- `write_text` without `newline=""` emitted CRLF on Windows, breaking byte-identity.
- A "byte-identical" test that compared parsed dicts proved nothing.
- Tests that pointed at a directory without the skip-guard fixture ran against an *empty corpus* and passed having verified nothing.
- An empty corpus reported `pass` with exit 0. Empty is a failure.

**From Story 1.1 (`review`)** — corpus facts already paid for: 104 reports, 16 venues, 9 matchday rounds, 0 probe failures, filenames `PMSR-M{NN}-{HOME3}-V-{AWAY3}.pdf`, 4 reports carrying a shoot-out cover line. Its fixtures pin the match-ID format you must reproduce.

### Git intelligence

Single commit `1fe59f9` ("Initial commit: WC2026 match analytics"). The working tree currently carries uncommitted edits to Story 1.1's file and `sprint-status.yaml` — Story 1.1 is in review, so **do not touch `contract/`, `data/fixtures/`, or `pipeline/validate/schema.py`**; a concurrent edit there would collide with review fixes. `work/` is gitignored (`.gitignore` line: `work/`), so no batch output is committed by this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Batch Ingestion, Run Manifest & Text-Anchored Page Discovery] — the four AC blocks
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — AR-8 (AD-8), AR-9 (AD-9), AR-15, AR-16
- [Source: _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md#FR-1, #FR-2, #FR-16, #NFR-6, #SM-C1]
- [Source: .../architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md#AD-8] — fail loud, manifest as record of truth, idempotence key, canonical serialization
- [Source: .../ARCHITECTURE-SPINE.md#AD-9] — pure per-report Extract → `work/extracted/{match-id}.json`, then global precompute
- [Source: .../ARCHITECTURE-SPINE.md#AD-3] — ID = slug, canonical ascending-match-ID order
- [Source: .../ARCHITECTURE-SPINE.md#Consistency Conventions, #Stack, #Structural Seed] — typed exception per failure class, pins, `pipeline/ingest/` placement
- [Source: _bmad-output/implementation-artifacts/1-4-template-consistency-verification-across-the-venue-matchday-sample.md] — discovery slice built here to be built *around*; review findings; the 16-report gate baseline
- [Source: _bmad-output/implementation-artifacts/1-1-contract-v1-schemas-fixtures-type-generation-spike.md] — `MatchId` pattern, 3-digit padding decision, corpus findings
- [Source: pipeline/discover/{text,anchors,probe,rounds}.py, pipeline/validate/{runner,verify}.py] — the modules to reuse and the CLI shape to mirror
- [Source: work/verification/verification-report.json] — the 16-report sample this story's 104-report run widens

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

**Task 9 — full-corpus run, first pass (cold).** No report failed. This is the first time
all 104 reports have had all 47 anchors resolved; Story 1.4's gate sampled 16.

```
Batch ingestion
===============
corpus          : pmsr-corpus
reports found   : 104 (expected 104)
code version    : a001b41f3e53

Reports by status
  extracted          104
  failed             0
  skipped-unchanged  0

RUN RESULT: PASS (0 failed report(s), 0 corpus gap(s), 0 orphan record(s))

manifest written to work/run-manifest.json
```

Exit code 0. Wall clock **126.3 s**.

**Task 9 — immediate re-run (AC 3).**

```
Batch ingestion
===============
corpus          : pmsr-corpus
reports found   : 104 (expected 104)
code version    : a001b41f3e53

Reports by status
  extracted          0
  failed             0
  skipped-unchanged  104

RUN RESULT: PASS (0 failed report(s), 0 corpus gap(s), 0 orphan record(s))

manifest written to work/run-manifest.json
```

Exit code 0. Wall clock **3.3 s** — a 38x contrast, because a skipped report is decided
from its staged record and its PDF is never opened.

**Byte-identity over the real corpus (AC 3).** SHA-256 of all 104 record files taken
before and after `--force`, compared on bytes: `BYTE_IDENTICAL=YES (104 records)`, with
`extracted: 104` on the forced pass. Cold forced run 102.7 s.

**`code_version` invalidating itself in the wild.** The Task 10 docstring fix to
`pipeline/discover/rounds.py` moved the fingerprint from `49db9f1d190d` to `a001b41f3e53`,
and the next run correctly re-extracted all 104 rather than skipping. That is the source
fingerprint doing exactly what a hand-bumped constant would not have.

**Task 10 — carried 1.4 gate (AC 7), verbatim tail:**

```
Deviations by category
  missing-anchor   0
  unknown-rgb      0
  count-mismatch   0
  probe-failure    0

GATE RESULT: PASS (0 deviation(s) across 16 sampled report(s), 0 corpus gap(s))

manifest written to work/verification/verification-report.json
```

Exit code 0. No regression.

### Post-review verification (2026-07-23)

Re-run end to end after the 31 review patches. `code_version` moved to `fff78694238d`
(the patches changed `pipeline/` source *and* the fingerprint now covers
`requirements.txt`), so the cold run correctly re-extracted all 104.

```
Reports by status            Reports by status            Reports by status
  extracted          104       extracted          0         extracted          104
  failed             0         failed             0         failed             0
  skipped-unchanged  0         skipped-unchanged  104       skipped-unchanged  0

RUN RESULT: PASS            RUN RESULT: PASS             RUN RESULT: PASS
(cold, 113.9 s)             (re-run, 2.7 s)              (--force)
```

All three exit 0, 0 failed / 0 gaps / 0 orphans throughout. The re-run is a **42x**
contrast. Byte-identity re-confirmed on bytes across the forced pass:
`BYTE_IDENTICAL=YES (104 records)`.

AC 7 carried gate re-run after the patches: `GATE RESULT: PASS (0 deviation(s) across 16
sampled report(s), 0 corpus gap(s))`, exit 0 — no regression.

Full suite: **440 passed, 1 skipped, 0 failed** (the 1 skip is `mex_rsa_pdf`-dependent and
guarded). Story 1.1's `cornersBySide` fixture failures, which were red mid-review, resolved
themselves as that story's own work landed.

### Completion Notes List

**Result: all 7 ACs satisfied. 345 tests pass (256 pre-existing + 89 new), no regressions.**

Corpus findings from the first full-104 anchor resolution:

- **No anchor findings to raise.** All 104 reports resolved all 47 anchors; every record
  carries exactly 47 anchor entries, and the manifest lists 0 warnings, 0 orphans, 0 gaps.
  The anchor registry was not weakened and no anchor was made optional (SM-C1 respected —
  there was nothing to relax).
- **Match-id derivation held on all 104.** Cover `- Match N` and filename `PMSR-M{N}-`
  agreed in 104/104 cases; ids run `m001-mexico-south-africa` … `m104-spain-argentina` and
  lexicographic order equals numeric order, as the 3-digit padding decision requires.
- **The three accented names slugged as pinned:** `m055-curacao-cote-d-ivoire`,
  `m006-australia-turkiye`, `m009-cote-d-ivoire-ecuador`. No collisions. Record metadata
  still prints `Curaçao` / `Côte d'Ivoire` (`ensure_ascii=False` round-trips).
- `AnchorSpec.required` remains dead code — no genuinely optional section turned up, so
  nothing was flipped. **Correction (code review, 2026-07-22):** the `warnings` path for a
  non-required anchor existed but was *not* tested, contrary to what this note originally
  claimed; the only assertion touching `warnings` was `== []`. It is now covered by
  `test_an_optional_anchor_that_does_not_resolve_is_warned_not_fatal`, which adds a
  `required=False` spec to the registry for the duration of the test. It remains
  unexercised by the real corpus.

Deliberate decisions worth review attention:

- **A fourth typed exception, `DuplicateReportIdError`,** joins the three the Dev Notes
  named. Task 6 requires duplicate report-id detection, and the convention is one typed
  exception per failure class; recording it as an untyped string would have been the only
  alternative. It is a distinct failure from `DuplicateMatchIdError`.
- **Skip decisions index staged records by `report_id`,** which is the filename stem and so
  is known without opening the PDF — that is what makes "do not re-parse" literally true.
  A report id claimed by two records is treated as ambiguous, hence absent, hence
  re-extracted.
- **A duplicate match id fails both reports and disowns the already-written record,** which
  then surfaces in `orphan_record_paths`. That is intentional: the file on disk is claimed
  by no report the manifest stands behind, and the manifest is the record of truth.
- **`relative_source_path` falls back to the bare file name** for a PDF outside the repo.
  An absolute path would break cross-machine record identity; the report id is the join key
  regardless and the manifest names the input dir. **Correction (code review, 2026-07-22):**
  this note originally said "the corpus is held outside it" — it is not. `pmsr-corpus/` sits
  at the repo root (gitignored via `*.pdf`), so all 104 records take the repo-relative branch
  and carry `pmsr-corpus/PMSR-M..-...pdf`. The fallback serves `tmp_path` fixtures and
  corpora mounted elsewhere. An end-to-end test now covers the repo-relative branch, which
  was previously only exercised on the pure helper.
- **`spike/mex_rsa.pdf` cannot be ingested under its own name** — its stem carries no
  `PMSR-M{N}-` prefix, so the filename cross-check refuses it. That is the mis-named
  download guard working; real-PDF tests copy it to a corpus-shaped name first, and there
  is an explicit test asserting the refusal.
- Two batch tests substitute enumeration rather than behaviour: the duplicate-report-id
  case (`a.pdf` beside `a.PDF`) cannot exist on this case-insensitive filesystem, and the
  no-re-parse proof monkeypatches `extract_report` to raise. Both are noted in their
  docstrings.

**Outside this story's scope, observed and not touched:** the working tree gained
uncommitted edits to `contract/common.schema.json`, `contract/match-bundle.schema.json`,
`contract/team-profile.schema.json` and `deferred-work.md` during this session (a
`Formation` `$def` being centralized — Story 1.1 review fixes). Per the story's git
intelligence I did not touch `contract/`. The `MatchId` pattern this story restates as a
literal is **unchanged** by those edits, so `identity.py` still matches the contract.

### File List

**New**

- `pipeline/ingest/__init__.py`
- `pipeline/ingest/batch.py`
- `pipeline/ingest/errors.py`
- `pipeline/ingest/extract_report.py`
- `pipeline/ingest/fingerprint.py`
- `pipeline/ingest/identity.py`
- `pipeline/ingest/records.py`
- `pipeline/tests/test_ingest_batch.py`
- `pipeline/tests/test_ingest_fingerprint.py`
- `pipeline/tests/test_ingest_identity.py`
- `pipeline/tests/test_ingest_record.py`

**Modified**

- `pipeline/README.md` — batch ingestion section (command, flags, exit codes, staging
  layout, idempotence rule, orphan policy) and `ingest/` added to the Layout block
- `pipeline/discover/rounds.py` — docstring only: the cover's match number is the global
  tournament number, not a within-group number (Task 10)
- `pipeline/tests/conftest.py` — added the `make_report` synthetic-report factory, which
  generates anchor pages from `ANCHOR_REGISTRY` itself
- `pipeline/tests/test_workspace.py` — `pipeline.ingest` added to the subpackage import test
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status transitions

**Generated at runtime (gitignored, not committed):** `work/extracted/*.json` (104
records), `work/run-manifest.json`.

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-22 | Story created — context engine analysis across epics, architecture spine, PRD requirement inventory, the live `pipeline/` codebase from Stories 1.4/1.1, and an empirical probe of all 104 corpus reports establishing the cover match-number rule, team-slug behaviour, and manifest.csv redundancy. |
| 2026-07-22 | Story implemented — `pipeline/ingest/` subpackage (batch runner + CLI, pure per-report Extract, match-id derivation, source-fingerprint idempotence keys, canonical atomic record I/O, typed exception taxonomy). 89 new tests; 345 pass total. First full-corpus run: 104/104 extracted, 0 failed, 0 orphans, 0 gaps; re-run 104/104 skipped-unchanged; forced re-extraction byte-identical. Story 1.4 gate re-run clean (exit 0). |

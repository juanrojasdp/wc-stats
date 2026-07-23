# wc-stats extraction pipeline

Python extraction pipeline for FIFA World Cup 2026 Post Match Summary Reports (PMSR PDFs).

## Setup (two commands)

From the repo root, on Windows:

```
python -m venv pipeline/venv
pipeline\venv\Scripts\python.exe -m pip install -r pipeline/requirements.txt
```

Requires Python 3.13+ (developed and verified on 3.14.4). Dependencies are installed
with **pip** — this project does not use `uv` (AR-15).

`pipeline/venv/` is this pipeline's own environment. `spike/venv` is a frozen reference
from the exploration spike and must not be reused or modified.

## Verification mode (template-consistency gate)

Runs the standing template-consistency gate over a stratified venue × matchday sample of
a PMSR corpus:

```
pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir <corpus-dir>
```

The input directory is a required argument — no corpus path is hardcoded. It must be a **flat**
directory of `.pdf` files (subdirectories are not searched); each filename stem becomes that
report's id in the manifest, so stems must be unique. Nothing is parsed from the filename —
teams, venue, stage and date all come from the PDF's own cover page. The machine-readable
manifest is written to `work/verification/verification-report.json` (override with `--output`),
and a human-readable summary, grouped by venue and by matchday round, is printed to the console.

Add `--expect-reports N` to assert the corpus size, so a mistyped path cannot pass as a run:

```
pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir <corpus-dir> --expect-reports 104
```

Exit codes, so a CI job can tell a failed gate from a broken harness:

| code | meaning |
| --- | --- |
| `0` | clean gate — every sampled report checked, no deviations, no corpus gaps |
| `1` | gate failed — deviations and/or corpus gaps were recorded |
| `2` | the harness could not run (bad input directory, unwritable output) |

An **empty corpus is a failure, not a clean run**. The gate also reports `corpus_gaps` for any
matchday round with no report present, and any group holding fewer than its 6 fixtures leaves
those reports unassigned rather than guessing a matchday — a partial corpus cannot tell
"matchday 1" from "the first match of this team I happen to hold".

The gate is designed to be re-run cheaply by every later extraction story: each story registers
its own checks with the check registry in `pipeline/validate/checks.py` without modifying the
runner, the sample selection, or the report format.

## Batch ingestion

Runs every report in a corpus through the Extract phase, staging one Extraction Record per
report plus a run manifest:

```
pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir <corpus-dir>
```

| flag | meaning |
| --- | --- |
| `--input-dir` | directory holding the PMSR PDF corpus (required; flat, `.pdf` files only) |
| `--output` | where the run manifest is written (default `work/run-manifest.json`) |
| `--extracted-dir` | where Extraction Records are staged (default `work/extracted`) |
| `--force` | re-extract every report regardless of the idempotence keys |
| `--expect-reports N` | assert the corpus holds exactly N reports (use 104 for the full tournament) |

Exit codes, matching the verification gate's contract:

| code | meaning |
| --- | --- |
| `0` | every report `extracted` or `skipped-unchanged`, with no orphan records |
| `1` | one or more reports `failed`, an `--expect-reports` mismatch, an empty corpus, or one or more orphan records |
| `2` | the harness could not run (bad input directory, unwritable output, `--output` inside `--extracted-dir`) |

An **empty corpus is a failure, not a clean run**, and a report that fails never aborts the
batch: the failure lands in that report's manifest entry as the exception class name plus
its message, and the run continues. The manifest holds **exactly one terminal entry per
discovered PDF** — `extracted | failed | skipped-unchanged` — and every entry is asserted to
carry one of those three terminal statuses before the manifest is written.

The console summary is printed **before** the manifest is written, so a run whose records
all staged correctly still reports its result even if the manifest itself cannot be written.

### Where things land

```
work/extracted/{match-id}.json   one Extraction Record per report (snake_case, internal staging)
work/run-manifest.json           the run's record of truth
```

Both are canonically serialized (sorted keys, UTF-8, LF) and written atomically. `work/` is
gitignored and fully regenerable — it is never the source of truth for anything shipped.
Records are internal staging, *not* contract artifacts: `snake_case` keys, no
`schemaVersion` stamp. camelCase binds only `/contract` and `/data`.

### Idempotence — what invalidates a skip

A record is reused only when **both** idempotence keys stored inside it still match:

- `pdf_content_hash` — SHA-256 of the source PDF's bytes
- `code_version` — SHA-256 over every `pipeline/**/*.py` (excluding `tests/`, virtualenvs,
  build trees and `__pycache__/`) **plus `pipeline/requirements.txt`**, so editing
  extraction code or bumping a pinned dependency invalidates every record automatically,
  while editing a test invalidates none

Deciding to skip reads the PDF's bytes once to hash them, but **never re-parses** it — that
is the difference between a ~126 s cold run and a ~3 s re-run over 104 reports.

A record that is missing, unreadable, malformed, written under an older `record_version`, or
whose `match_id` disagrees with its own file name counts as **absent**, so the report is
re-extracted — never skipped on the strength of a file that cannot prove what produced it.
`--force` bypasses the keys; a forced re-run over an unchanged corpus produces
byte-identical records.

### Orphan records

`work/extracted/` is keyed by match id while the batch iterates by PDF, so the two can
drift: rename a source PDF or correct a mis-typed match number and the run writes a record
under the new id while the old one stays on disk. Any record the run neither wrote nor
skipped is listed in `orphan_record_paths` and named in the console summary — and **left on
disk**, because deleting files a run did not create is destructive. Interrupted atomic
writes leave a `.tmp` file behind; those are reported as orphans too, rather than
accumulating unseen in a directory that is only ever scanned for `.json`.

An orphan never inflates `failed_count` — it is not a failed report — but it **does fail the
run** (`result: "fail"`, exit 1). An orphan is the phantom-match hazard this scan exists to
surface, and a hazard that exits 0 is one CI can never be taught to catch.

Consumers must therefore read the records the **manifest** names, not the directory listing
(AD-8). This binds Story 1.15's precompute in particular: an orphan from a superseded run
would otherwise enter the dataset as a phantom match.

## Layout

```
pipeline/
  discover/   text-anchored page discovery, anchor registry, corpus metadata probe
  ingest/     batch orchestration, run manifest, idempotence, per-report Extract, CLI
  validate/   check registry, sample selection, verification runner, CLI
  tests/      pytest suite
```

## Tests

From the repo root, using the venv interpreter explicitly:

```
pipeline\venv\Scripts\python.exe -m pytest pipeline/tests
```

Or activate the venv first, after which the bare `python` form works:

```
pipeline\venv\Scripts\activate
python -m pytest pipeline/tests
```

A bare `python -m pytest pipeline/tests` **without** activating the venv will fail with
`ModuleNotFoundError: No module named 'pymupdf'` — the system interpreter has none of the
pinned stack installed.

Tests are deterministic and offline. Real-PDF tests use the permanent ground-truth fixture
`spike/mex_rsa.pdf`; set-cover, matchday-derivation, and report-format tests use synthetic
fixtures and need no PDFs.

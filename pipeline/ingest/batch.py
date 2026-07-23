"""Batch ingestion: run every PDF in a directory through Extract, and record the run.

    python -m pipeline.ingest.batch --input-dir <corpus-dir>

AD-8 in three rules, each of which this module makes structurally hard to violate:

1. **Exactly one terminal entry per discovered PDF** — `extracted`, `failed`, or
   `skipped-unchanged`, asserted before the manifest is written. A manifest silently
   listing 103 of 104 reports is precisely the failure the manifest exists to prevent.
2. **A per-report failure never aborts the batch** — every report is wrapped, and
   `Exception` is caught, not merely `PipelineError`: a corrupt PDF makes pymupdf raise
   its own types. The failure lands in that report's entry with the exception class name
   and its localizing message, and the run continues.
3. **Idempotence on (PDF content hash, code version)** — both keys live inside each
   Extraction Record, so the skip decision is answered from the record alone and the PDF
   is **never re-parsed**. It is still *read*: the content hash is SHA-256 over its bytes,
   so deciding to skip costs one streaming read and no page parsing. That is the whole
   difference between a ~126 s cold run and a ~3 s re-run.

The manifest is the record of truth, not the directory listing: Story 1.15 must consume
only the records this manifest names. Records the run neither wrote nor skipped are
reported as `orphan_record_paths` and **left on disk** — deleting files a run did not
create is destructive and could silently discard a partially-complete corpus run. An
orphan does not inflate `failed_count` (it is not a failed report) but it **does fail the
run**: a review decision (2026-07-22), because an orphan is the phantom-match hazard the
scan exists to surface, and a hazard that exits 0 is one CI can never catch.

Self-Validation (Story 1.3) follows the same precedent: each entry mirrors its record's
`self_validation.result`, a `fail` carries the failing checks with both counts, and any
`fail` fails the run (exit 1) without inflating `failed_count` — the record exists and was
written; it just disagreed with the count its own attempts table prints.

`run_timestamp` is the single permitted volatile field, matching the precedent set by
`work/verification/verification-report.json`. Nothing else in the manifest, and nothing at
all in an Extraction Record, may vary between two runs over an unchanged corpus.
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

from pipeline.ingest.errors import DuplicateMatchIdError, DuplicateReportIdError
from pipeline.ingest.extract_report import extract_report
from pipeline.ingest.fingerprint import code_version, pdf_content_hash
from pipeline.ingest.identity import MATCH_ID_RE
from pipeline.ingest.records import (
    DEFAULT_EXTRACTED_DIR,
    TEMP_SUFFIX,
    is_unchanged,
    read_record,
    write_canonical,
    write_record,
)

MANIFEST_VERSION = 1
DEFAULT_MANIFEST_PATH = Path("work") / "run-manifest.json"

# The closed set of terminal statuses. Always all three in `counts_by_status`, so the
# manifest's shape never changes underneath an earlier run's numbers.
STATUSES: tuple[str, ...] = ("extracted", "failed", "skipped-unchanged")


def discover_pdfs(input_dir: "str | Path") -> list[Path]:
    """Every PDF in `input_dir`, sorted by `(stem, name)`.

    `glob("*.pdf")` is case-insensitive on Windows and case-sensitive on POSIX, which
    would make corpus membership — and therefore the run result — depend on the host.
    The suffix is matched explicitly instead, exactly as `probe_corpus` does.
    """
    input_dir = Path(input_dir)
    if not input_dir.is_dir():
        raise NotADirectoryError(f"input directory does not exist: {input_dir}")
    return sorted(
        (p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"),
        key=lambda p: (p.stem, p.name),
    )


def _existing_record_files(extracted_dir: Path) -> list[Path]:
    """Every record file currently staged, whoever wrote it.

    `.tmp` leftovers count. An interrupted atomic write leaves one behind, and a
    `.json`-only scan would never mention it — so it would sit in the staging directory
    indefinitely, invisible to the very check that exists to name unaccounted-for files.
    They can never be *claimed* by a report, so they always surface as orphans.
    """
    if not extracted_dir.is_dir():
        return []
    return sorted(
        (
            p
            for p in extracted_dir.iterdir()
            if p.is_file() and p.suffix.lower() in (".json", TEMP_SUFFIX)
        ),
        key=lambda p: p.name,
    )


def _records_by_report_id(extracted_dir: Path) -> "dict[str, tuple[Path, dict]]":
    """Staged records indexed by the report they claim, read once per run.

    Indexing by report id rather than by match id is what lets the skip decision run
    without opening the PDF: the report id is the filename stem, known before any parse.
    A report id claimed by two records is ambiguous, so neither is offered — the report
    is re-extracted and the stale file surfaces as an orphan.
    """
    found: dict[str, list[tuple[Path, dict]]] = {}
    for path in _existing_record_files(extracted_dir):
        if path.suffix.lower() != ".json":
            continue  # a `.tmp` leftover is orphan-scan material, never a skip candidate
        record = read_record(path)
        if record is None:
            continue  # unreadable or malformed: absent, never a skip
        report_id = record.get("report_id")
        if not isinstance(report_id, str):
            continue
        # `is_unchanged` proves the two idempotence keys match and nothing else about the
        # file. A record whose `match_id` is missing, malformed, or disagrees with its own
        # file name cannot be trusted to name the match it claims — so it is *absent*,
        # exactly as an unreadable one is, and the report is re-extracted. Trusting it
        # would put a match id in the manifest that no PDF produced and hand Story 1.15 a
        # phantom identity; failing the report instead would be worse still, since the
        # PDF is right there and re-extracting costs one parse.
        match_id = record.get("match_id")
        if not isinstance(match_id, str) or not MATCH_ID_RE.match(match_id):
            continue
        if path.stem != match_id:
            continue
        found.setdefault(report_id, []).append((path, record))
    return {report_id: pair[0] for report_id, pair in found.items() if len(pair) == 1}


def _entry(report_id: str) -> dict:
    """A manifest entry in its unresolved state — every field present from the start."""
    return {
        "report_id": report_id,
        "match_id": None,
        "status": None,
        "record_path": None,
        "error_type": None,
        "error": None,
        "warnings": [],
        # Mirrored from the record's `self_validation.result`; `None` for a report that
        # produced no record. On "fail", `self_validation_failures` copies the failing
        # check entries — the AC requires both counts in the manifest itself.
        "self_validation": None,
        "self_validation_failures": [],
    }


def _self_validation_trustworthy(record: dict) -> bool:
    """Whether a staged record's Self-Validation block can be mirrored as-is.

    The same trust rule `_records_by_report_id` applies to `match_id`: a staged block
    that is off-shape — missing, a non-dict, a result outside the enum, or a "fail"
    whose failing checks cannot be copied out — cannot be trusted to say what this
    report proved, so the record is treated as absent and the report re-extracted
    (review decision, 2026-07-23). Mirroring it as `None` instead would let a corrupt
    verdict launder into a passing run, since only `"fail"` counts toward the tally.
    """
    block = record.get("self_validation")
    if not isinstance(block, dict) or block.get("result") not in ("pass", "fail", "not-applicable"):
        return False
    if block.get("result") == "fail":
        checks = block.get("checks")
        if not isinstance(checks, list) or not any(
            isinstance(check, dict) and check.get("result") == "fail" for check in checks
        ):
            return False
    return True


def _mirror_self_validation(entry: dict, record: dict) -> None:
    """Copy the record's Self-Validation verdict into its manifest entry.

    Reads the record — staged or fresh — the same way `warnings` flows, so a
    skipped-unchanged entry carries the verdict its staged record already proved.
    Staged records reach here only after `_self_validation_trustworthy` admitted their
    block on the skip decision; the shape guards below are kept as a backstop so an
    off-shape block can never crash the run or invent a "pass".
    """
    block = record.get("self_validation")
    result = block.get("result") if isinstance(block, dict) else None
    entry["self_validation"] = result if result in ("pass", "fail", "not-applicable") else None
    if entry["self_validation"] == "fail":
        checks = block.get("checks")
        entry["self_validation_failures"] = [
            check
            for check in (checks if isinstance(checks, list) else [])
            if isinstance(check, dict) and check.get("result") == "fail"
        ]


def _fail(entry: dict, exc: BaseException) -> None:
    """Record a typed failure against one report. The batch continues regardless.

    Every non-diagnostic field is cleared, not just the ones the normal failure path
    happens to leave empty. A duplicate match id fails a report *retroactively*, after its
    `match_id` and `warnings` were already filled in — and a `failed` entry still carrying
    a `match_id` is a match no record stands behind, which is exactly the shape a consumer
    filtering on `match_id is not None` would pick up.
    """
    entry["status"] = "failed"
    entry["match_id"] = None
    entry["record_path"] = None
    entry["warnings"] = []
    entry["self_validation"] = None
    entry["self_validation_failures"] = []
    entry["error_type"] = type(exc).__name__
    entry["error"] = str(exc)


def check_manifest_path(output_path: "str | Path | None", extracted_dir: "str | Path") -> None:
    """Refuse a manifest path that lands inside the record staging directory.

    The manifest would otherwise be picked up by the orphan scan, fail to parse as a
    record, and be reported as an orphan on every subsequent run forever — or, aimed at an
    existing `m###-*.json`, silently overwrite a real Extraction Record.
    """
    if output_path is None:
        return
    if Path(output_path).parent.resolve() == Path(extracted_dir).resolve():
        raise ValueError(
            f"manifest path {Path(output_path).as_posix()} is inside the extracted "
            f"directory {Path(extracted_dir).as_posix()}; choose a path outside it"
        )


def _corpus_gaps(pdf_count: int, expect_reports: int | None) -> list[str]:
    """Run-level shortfalls. An empty corpus is a failure, not a clean run."""
    gaps: list[str] = []
    if pdf_count == 0:
        gaps.append("corpus is empty: no PDF reports found in the input directory")
    if expect_reports is not None and pdf_count != expect_reports:
        gaps.append(f"corpus holds {pdf_count} reports, expected {expect_reports}")
    return gaps


def run_batch(
    input_dir: "str | Path",
    output_path: "str | Path | None" = DEFAULT_MANIFEST_PATH,
    extracted_dir: "str | Path" = DEFAULT_EXTRACTED_DIR,
    force: bool = False,
    expect_reports: int | None = None,
) -> dict:
    """Ingest every report in `input_dir` and return the run manifest.

    Raises only for failures of the harness itself — a missing input directory, an
    unwritable manifest. Everything a *report* can do wrong becomes a `failed` entry.
    """
    input_dir = Path(input_dir)
    extracted_dir = Path(extracted_dir)
    check_manifest_path(output_path, extracted_dir)
    paths = discover_pdfs(input_dir)
    version = code_version()
    staged = _records_by_report_id(extracted_dir)

    entries: list[dict] = []
    entry_index: dict[str, int] = {}
    match_id_owner: dict[str, str] = {}
    claimed: dict[str, Path] = {}  # report_id -> the record path this run stands behind
    seen_stems: dict[str, Path] = {}

    for path in paths:
        report_id = path.stem
        entry = _entry(report_id)
        entries.append(entry)

        try:
            if report_id in seen_stems:
                raise DuplicateReportIdError(seen_stems[report_id].name, report_id)
            seen_stems[report_id] = path
            entry_index[report_id] = len(entries) - 1

            content_hash = pdf_content_hash(path)
            staged_path, staged_record = staged.get(report_id, (None, None))
            reuse = (
                not force
                and staged_record is not None
                and is_unchanged(staged_record, content_hash, version)
                and _self_validation_trustworthy(staged_record)
            )

            if reuse:
                # `_records_by_report_id` has already proven this record names a match id
                # that matches its own file name, so the lookup below cannot surprise us.
                record, match_id = staged_record, staged_record["match_id"]
            else:
                # The hash computed above is handed on, so the bytes the skip decision
                # compared and the bytes the record certifies are the same read.
                record = extract_report(path, content_hash=content_hash)
                match_id = record["match_id"]

            owner = match_id_owner.get(match_id)
            if owner is not None:
                # Both reports fail: `work/extracted/` is keyed by match id, so writing
                # the second over the first would lose a report entirely. The file the
                # earlier report already wrote is disowned here and surfaces as an orphan.
                claimed.pop(owner, None)
                _fail(entries[entry_index[owner]], DuplicateMatchIdError(match_id, report_id, owner))
                raise DuplicateMatchIdError(match_id, owner, report_id)
            match_id_owner[match_id] = report_id

            written = staged_path if reuse else write_record(record, extracted_dir)
            entry["match_id"] = match_id
            entry["status"] = "skipped-unchanged" if reuse else "extracted"
            entry["record_path"] = written.as_posix()
            # A staged file's `warnings` is arbitrary JSON. Anything that is not a list is
            # dropped rather than iterated: `list("corrupted")` would quietly spell the
            # string out one character per warning into the manifest.
            staged_warnings = record.get("warnings")
            entry["warnings"] = (
                [str(warning) for warning in staged_warnings]
                if isinstance(staged_warnings, list)
                else []
            )
            _mirror_self_validation(entry, record)
            # Claimed last, and only once every field above has succeeded. Claiming
            # earlier would hide the file from the orphan scan if any of them raised —
            # leaving a record that the manifest names nowhere and the orphan list omits.
            claimed[report_id] = written
        except Exception as exc:  # typed or not: AC 2 says the batch continues
            _fail(entry, exc)

    # AC 1's guarantee, checked on substance rather than on count. The old form compared
    # `len(entries)` to `len(paths)`, which `entries.append` makes true by construction and
    # so could never fire. What actually matters is that every entry reached a *terminal*
    # status from the closed set — and checking that here is also what stops a `None`
    # status from surfacing as a bare `KeyError` in the tally below.
    if len(entries) != len(paths) or any(entry["status"] not in STATUSES for entry in entries):
        stranded = [entry["report_id"] for entry in entries if entry["status"] not in STATUSES]
        raise ValueError(
            f"manifest holds {len(entries)} entries for {len(paths)} discovered PDFs; "
            f"{len(stranded)} without a terminal status: {stranded[:5]}"
        )

    counts = {status: 0 for status in STATUSES}
    for entry in entries:
        counts[entry["status"]] += 1

    kept = {path.resolve() for path in claimed.values()}
    orphans = [
        path.as_posix() for path in _existing_record_files(extracted_dir) if path.resolve() not in kept
    ]
    gaps = _corpus_gaps(len(paths), expect_reports)
    failed_count = counts["failed"]
    # The orphan-records precedent: a Self-Validation failure is reported on its entry
    # and fails the *run*, never inflating `failed_count` — the record exists and is
    # written, it just failed its own count check.
    self_validation_fail_count = sum(
        1 for entry in entries if entry["self_validation"] == "fail"
    )

    manifest = {
        "manifest_version": MANIFEST_VERSION,
        "generated_by": "pipeline.ingest.batch",
        "run_timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        "input_dir": input_dir.as_posix(),
        "code_version": version,
        "corpus": {"pdf_count": len(paths), "expected_pdf_count": expect_reports},
        "counts_by_status": counts,
        "reports": entries,
        "orphan_record_paths": orphans,
        "run": {
            # An orphan is a run-level observation, exactly as a corpus gap is, so it never
            # inflates `failed_count` — but it does fail the run (review decision,
            # 2026-07-22). An orphan is the phantom-match hazard the scan exists to
            # surface, and one that exits 0 is a hazard CI can never be taught to catch.
            "result": (
                "pass"
                if (
                    failed_count == 0
                    and not gaps
                    and not orphans
                    and self_validation_fail_count == 0
                )
                else "fail"
            ),
            "failed_count": failed_count,
            "self_validation_fail_count": self_validation_fail_count,
            "corpus_gaps": gaps,
        },
    }
    if output_path is not None:
        write_canonical(manifest, output_path)
    return manifest


def format_summary(manifest: dict) -> str:
    """Human-readable summary: counts, then every failure with its type and message."""
    counts = manifest["counts_by_status"]
    run = manifest["run"]
    lines = [
        "",
        "Batch ingestion",
        "=" * 15,
        f"corpus          : {manifest['input_dir']}",
        f"reports found   : {manifest['corpus']['pdf_count']}"
        + (
            f" (expected {manifest['corpus']['expected_pdf_count']})"
            if manifest["corpus"]["expected_pdf_count"] is not None
            else ""
        ),
        f"code version    : {manifest['code_version'][:12]}",
        "",
        "Reports by status",
    ]
    for status in STATUSES:
        lines.append(f"  {status:<18} {counts[status]}")

    warned = [entry for entry in manifest["reports"] if entry["warnings"]]
    if warned:
        lines += ["", "Warnings (non-fatal)"]
        for entry in warned:
            for warning in entry["warnings"]:
                lines.append(f"  {entry['report_id']}: {warning}")

    if run["failed_count"]:
        lines += ["", "Failed reports"]
        for entry in manifest["reports"]:
            if entry["status"] != "failed":
                continue
            lines.append(f"  {entry['report_id']}")
            lines.append(f"      [{entry['error_type']}] {entry['error']}")

    if run["self_validation_fail_count"]:
        lines += ["", "Self-validation failures (record written; run fails)"]
        for entry in manifest["reports"]:
            if entry["self_validation"] != "fail":
                continue
            lines.append(f"  {entry['report_id']}")
            # Each domain's checks carry their own detail shape: the shots count check
            # has per-team marker/table counts, Domain A's carry `specifics`. Render
            # what the check actually holds — a shots-shaped template over a Domain A
            # check would print `None: None markers, table lists None`.
            for check in entry["self_validation_failures"]:
                if check.get("check") == "shots-link-rate":
                    # Story 1.5's link-rate check: rate first, then each unlinked
                    # marker's identifying specifics (FR-14's manifest specifics).
                    unlinked = check.get("unlinked") or []
                    positions = ", ".join(
                        f"{marker.get('outcome')}@({marker.get('pdf_x')},{marker.get('pdf_y')})"
                        for marker in unlinked
                        if isinstance(marker, dict)
                    )
                    detail = (
                        f"{check.get('team')}: {check.get('linked_count')}/"
                        f"{check.get('marker_count')} markers linked"
                        + (f"; unlinked: {positions}" if positions else "")
                    )
                elif "marker_count" in check or "table_count" in check:
                    detail = (
                        f"{check.get('team')}: {check.get('marker_count')} markers, "
                        f"table lists {check.get('table_count')}"
                    )
                else:
                    detail = str(check.get("specifics") or "no detail recorded")
                lines.append(f"      [{check.get('check')}] {detail}")

    if manifest["orphan_record_paths"]:
        lines += [
            "",
            "Orphan records (present in the extracted directory, claimed by no report in "
            "this run — left on disk, not deleted)",
        ]
        for path in manifest["orphan_record_paths"]:
            lines.append(f"  - {path}")

    if run["corpus_gaps"]:
        lines += ["", "Corpus gaps (what this run could not have ingested)"]
        for gap in run["corpus_gaps"]:
            lines.append(f"  - {gap}")

    result = "PASS" if run["result"] == "pass" else "FAIL"
    lines += [
        "",
        f"RUN RESULT: {result} ({run['failed_count']} failed report(s), "
        f"{run['self_validation_fail_count']} self-validation-failed report(s), "
        f"{len(run['corpus_gaps'])} corpus gap(s), "
        f"{len(manifest['orphan_record_paths'])} orphan record(s))",
        "",
    ]
    return "\n".join(lines)


def _positive_int(value: str) -> int:
    """An `--expect-reports` count. Zero and negatives can only ever produce a `fail`."""
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError(f"must be 1 or greater, got {number}")
    return number


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.ingest.batch",
        description=(
            "Batch-ingest a PMSR corpus: one Extraction Record per report, one run "
            "manifest, idempotent on (PDF content hash, code version)."
        ),
    )
    parser.add_argument(
        "--input-dir", type=Path, required=True, help="directory holding the PMSR PDF corpus"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_MANIFEST_PATH,
        help=f"where to write the run manifest (default: {DEFAULT_MANIFEST_PATH.as_posix()})",
    )
    parser.add_argument(
        "--extracted-dir",
        type=Path,
        default=DEFAULT_EXTRACTED_DIR,
        help=f"where Extraction Records are staged (default: {DEFAULT_EXTRACTED_DIR.as_posix()})",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="re-extract every report regardless of the idempotence keys",
    )
    parser.add_argument(
        "--expect-reports",
        type=_positive_int,
        default=None,
        metavar="N",
        help="assert the corpus holds exactly N reports (use 104 for the full tournament)",
    )
    return parser


def main(argv: "list[str] | None" = None) -> int:
    """Exit 0 when every report extracted or skipped, 1 on any failure or gap, 2 if broken."""
    args = build_parser().parse_args(argv)

    # Report text is PDF-derived, so it can hold characters the console encoding cannot
    # represent (a redirected stdout on Windows is cp1252). Replacing them keeps the exit
    # code meaningful — a UnicodeEncodeError here would look like a crashed harness.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")

    try:
        # Validated up front: `run_batch` is called with `output_path=None` below, so it
        # never sees the manifest path and cannot check it itself.
        check_manifest_path(args.output, args.extracted_dir)
        # `output_path=None` so the run's result is in hand *before* anything is written.
        # With the write inside `run_batch`, an unwritable manifest discarded a run in
        # which all 104 records had already been staged correctly, printing nothing and
        # exiting 2 as though the harness had never started.
        manifest = run_batch(
            args.input_dir,
            output_path=None,
            extracted_dir=args.extracted_dir,
            force=args.force,
            expect_reports=args.expect_reports,
        )
    except (OSError, ValueError) as exc:
        # The harness could not run at all — distinct from a run that ran and failed.
        print(f"batch ingestion could not run: {exc}", file=sys.stderr)
        return 2

    print(format_summary(manifest))

    try:
        write_canonical(manifest, args.output)
    except OSError as exc:
        print(f"run completed, but the manifest could not be written: {exc}", file=sys.stderr)
        return 2

    print(f"manifest written to {Path(args.output).as_posix()}")
    return 0 if manifest["run"]["result"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())

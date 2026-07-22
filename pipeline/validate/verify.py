"""CLI entrypoint for verification mode.

    python -m pipeline.validate.verify --input-dir <corpus-dir>

The corpus location is a required argument: only `spike/mex_rsa.pdf` lives in this repo,
and the 104-report corpus is held outside it, so no input path may be hardcoded.

Exit codes, so a CI job can tell a failed gate from a broken harness:

    0  clean gate — every sampled report checked, no deviations, no corpus gaps
    1  gate failed — deviations and/or corpus gaps were recorded
    2  the harness could not run (bad input directory, unwritable output)

An empty corpus is a *failure*, not a clean run: a mistyped `--input-dir` must never
report green. Pass `--expect-reports` to assert the corpus size as well.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pipeline.validate.runner import DEFAULT_OUTPUT_PATH, run_verification


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.validate.verify",
        description=(
            "Template-consistency gate: run every registered check over a stratified "
            "venue x matchday sample of a PMSR corpus."
        ),
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        required=True,
        help="directory holding the PMSR PDF corpus",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"where to write the verification manifest (default: {DEFAULT_OUTPUT_PATH.as_posix()})",
    )
    parser.add_argument(
        "--expect-reports",
        type=int,
        default=None,
        metavar="N",
        help="assert the corpus holds exactly N reports (use 104 for the full tournament)",
    )
    return parser


def format_summary(report: dict) -> str:
    """Human-readable console summary, grouped so a revision localizes at a glance."""
    corpus = report["corpus"]
    gate = report["gate"]
    lines = [
        "",
        "Template-consistency verification",
        "=" * 33,
        f"corpus          : {report['input_dir']}",
        f"reports found   : {corpus['report_count']} "
        f"(probed {corpus['probed_count']}, probe failures {corpus['probe_failure_count']})",
        f"checks run      : {', '.join(report['checks_run'])}",
        f"sample size     : {gate['sample_size']}",
        "",
        "Sample (report -> venue | matchday round | covers)",
    ]
    for entry in report["sample"]:
        lines.append(
            f"  {entry['report_id']:<24} {entry['venue']} | "
            f"{entry['matchday_round']} | {', '.join(entry['covers'])}"
        )

    lines += ["", "Deviations by category"]
    for category, count in report["deviation_counts_by_category"].items():
        lines.append(f"  {category:<16} {count}")

    if report["corpus_gaps"]:
        lines += ["", "Corpus gaps (what this run could not have checked)"]
        for gap in report["corpus_gaps"]:
            lines.append(f"  - {gap}")

    if gate["deviation_count"]:
        lines += ["", "Deviations by venue"]
        for venue, count in report["deviations_by_venue"].items():
            lines.append(f"  {venue:<32} {count}")
        lines += ["", "Deviations by matchday round"]
        for matchday, count in report["deviations_by_matchday_round"].items():
            lines.append(f"  {matchday:<32} {count}")
        lines += ["", "Per-report deviations"]
        for entry in report["reports"]:
            if not entry["deviations"]:
                continue
            lines.append(
                f"  {entry['report_id']} "
                f"[{entry['venue']} | {entry['matchday_round']}] "
                f"- {len(entry['deviations'])} deviation(s)"
            )
            for deviation in entry["deviations"]:
                lines.append(
                    f"      [{deviation['category']}] {deviation['check']}: "
                    f"{deviation['specifics']}"
                )

    result = "PASS" if gate["result"] == "pass" else "FAIL"
    lines += [
        "",
        f"GATE RESULT: {result} ({gate['deviation_count']} deviation(s) across "
        f"{gate['sample_size']} sampled report(s), "
        f"{gate['corpus_gap_count']} corpus gap(s))",
        "",
    ]
    return "\n".join(lines)


def main(argv: "list[str] | None" = None) -> int:
    args = build_parser().parse_args(argv)

    # Report text is PDF-derived, so it can hold characters the console encoding cannot
    # represent (a redirected stdout on Windows is cp1252). Replacing them keeps the exit
    # code meaningful — a UnicodeEncodeError here would look like a crashed harness.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")

    try:
        report = run_verification(
            args.input_dir,
            output_path=args.output,
            expect_reports=args.expect_reports,
        )
    except (OSError, ValueError) as exc:
        # The harness could not run at all — distinct from a gate that ran and failed.
        print(f"verification could not run: {exc}", file=sys.stderr)
        return 2

    print(format_summary(report))
    print(f"manifest written to {Path(args.output).as_posix()}")
    return 0 if report["gate"]["result"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())

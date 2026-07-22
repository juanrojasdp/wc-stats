"""Verification mode: run every registered check over the stratified sample.

The run is deliberately fail-soft per report and fail-loud in aggregate. A report that
cannot be probed, or an anchor that has moved, becomes a recorded deviation and the run
carries on to the next report — one broken report must never hide the state of the other
103. The gate result is what fails.

Determinism (AC 3): the corpus is probed in report-id order, checks run in check-id
order, deviations are sorted, and every mapping is emitted sorted. `run_timestamp` is the
only field that varies between two runs over an unchanged corpus.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from pipeline.discover.probe import ReportMeta, probe_corpus
from pipeline.discover.rounds import ROUNDS, assign_matchday_rounds
from pipeline.validate.checks import Check, registered_checks
from pipeline.validate.deviations import ALL_CATEGORIES, Deviation, DeviationCategory
from pipeline.validate.sample import SampleEntry, select_sample

REPORT_SCHEMA_VERSION = 1
DEFAULT_OUTPUT_PATH = Path("work") / "verification" / "verification-report.json"


def _corpus_deviations(
    probe_failures: "list[tuple[str, str]]",
    round_problems: "list[tuple[str, str]]",
) -> dict[str, list[Deviation]]:
    """Deviations discovered while establishing report identity, keyed by report id."""
    found: dict[str, list[Deviation]] = {}
    for report_id, reason in probe_failures:
        found.setdefault(report_id, []).append(
            Deviation(
                report_id=report_id,
                check="metadata-probe",
                category=DeviationCategory.PROBE_FAILURE,
                specifics=reason,
            )
        )
    for report_id, reason in round_problems:
        found.setdefault(report_id, []).append(
            Deviation(
                report_id=report_id,
                check="metadata-probe",
                category=DeviationCategory.PROBE_FAILURE,
                specifics=reason,
            )
        )
    return found


def _run_checks(meta: ReportMeta, checks: "list[Check]") -> list[Deviation]:
    """Run every applicable check against one report.

    Each check is isolated: one that raises is recorded against its own check id and the
    rest still run. Wrapping the whole loop instead would let a single bug in an early
    check silently erase every deviation the later ones would have found — the gate would
    report one problem where there were forty-seven.
    """
    import pymupdf

    deviations: list[Deviation] = []
    applicable = [check for check in checks if check.applies_to(meta)]
    if not applicable:
        return deviations

    try:
        doc = pymupdf.open(meta.source_path)
    except Exception as exc:  # a report that will not open is itself a deviation
        return [
            Deviation(
                report_id=meta.report_id,
                check="metadata-probe",
                category=DeviationCategory.PROBE_FAILURE,
                specifics=f"report could not be read during verification: {exc}",
            )
        ]

    with doc:
        for check in applicable:
            try:
                deviations.extend(check.run(doc, meta))
            except Exception as exc:
                deviations.append(
                    Deviation(
                        report_id=meta.report_id,
                        check=check.check_id,
                        category=DeviationCategory.PROBE_FAILURE,
                        specifics=f"check {check.check_id!r} raised {type(exc).__name__}: {exc}",
                    )
                )
    return deviations


def _corpus_gaps(metas: "list[ReportMeta]", expect_reports: int | None, total: int) -> list[str]:
    """Corpus-level shortfalls: what the gate could not have checked, whatever it found.

    These are deliberately *not* deviations. The four deviation categories are the
    contract Stories 1.3-1.14 write into (AC 2), and a fifth kind of finding must not
    change the shape of `deviation_counts_by_category` underneath an earlier gate result.
    They still fail the gate — a corpus that cannot be checked has not passed.
    """
    gaps: list[str] = []
    if total == 0:
        gaps.append("corpus is empty: no PDF reports found in the input directory")
    if expect_reports is not None and total != expect_reports:
        gaps.append(f"corpus holds {total} reports, expected {expect_reports}")

    present = {meta.matchday_round for meta in metas if meta.matchday_round is not None}
    for round_id in ROUNDS:
        if round_id not in present:
            gaps.append(f"no report present for matchday round {round_id!r}")
    return gaps


def run_verification(
    input_dir: "str | Path",
    output_path: "str | Path | None" = None,
    checks: "list[Check] | None" = None,
    expect_reports: int | None = None,
) -> dict:
    """Run the template-consistency gate over `input_dir` and return the manifest.

    When `output_path` is given the manifest is also written there as JSON; pass
    `DEFAULT_OUTPUT_PATH` for the standard `work/verification/` location. `expect_reports`
    asserts the corpus size, so a mistyped input directory cannot pass as a clean run.
    """
    input_dir = Path(input_dir)
    if checks is None:
        checks = registered_checks()
    else:
        seen: set[str] = set()
        for check in checks:
            if check.check_id in seen:
                raise ValueError(f"duplicate check id: {check.check_id!r}")
            seen.add(check.check_id)
        checks = sorted(checks, key=lambda c: c.check_id)

    metas, probe_failures = probe_corpus(input_dir)
    metas, round_problems = assign_matchday_rounds(metas)
    by_id: dict[str, ReportMeta] = {meta.report_id: meta for meta in metas}

    sample: list[SampleEntry] = select_sample(metas)
    deviations_by_report = _corpus_deviations(probe_failures, round_problems)

    for entry in sample:
        found = _run_checks(by_id[entry.report_id], checks)
        if found:
            deviations_by_report.setdefault(entry.report_id, []).extend(found)

    sampled_ids = {entry.report_id for entry in sample}
    recorded_ids = sorted(sampled_ids | set(deviations_by_report))
    # Everything the gate never looked at, named explicitly: a manifest listing 20 of 104
    # reports and nothing about the other 84 cannot be audited against "no silent skips".
    unchecked_ids = sorted(set(by_id) - set(recorded_ids))

    reports: list[dict] = []
    for report_id in recorded_ids:
        meta = by_id.get(report_id)
        found = deviations_by_report.get(report_id, [])
        reports.append(
            {
                "report_id": report_id,
                "venue": meta.venue if meta else None,
                "matchday_round": meta.matchday_round if meta else None,
                "probed": meta is not None,
                "sampled": report_id in sampled_ids,
                "deviations": [
                    deviation.to_dict()
                    for deviation in sorted(
                        found, key=lambda d: (d.check, d.category, d.specifics)
                    )
                ],
            }
        )

    counts_by_category = {category: 0 for category in ALL_CATEGORIES}
    by_venue: dict[str, int] = {}
    by_round: dict[str, int] = {}
    total_deviations = 0
    for entry in reports:
        for deviation in entry["deviations"]:
            counts_by_category[deviation["category"]] += 1
            total_deviations += 1
        if entry["deviations"]:
            # A probed report with a blank venue is a different finding from one that
            # could not be probed at all, so the two must not share a bucket.
            if not entry["probed"]:
                venue = "<unprobed>"
            else:
                venue = entry["venue"] if (entry["venue"] or "").strip() else "<blank venue>"
            matchday = entry["matchday_round"] or ("<unknown>" if entry["probed"] else "<unprobed>")
            by_venue[venue] = by_venue.get(venue, 0) + len(entry["deviations"])
            by_round[matchday] = by_round.get(matchday, 0) + len(entry["deviations"])

    report_count = len(metas) + len(probe_failures)
    gaps = _corpus_gaps(metas, expect_reports, report_count)

    return _write(
        {
            "schema_version": REPORT_SCHEMA_VERSION,
            "generated_by": "pipeline.validate.verify",
            "run_timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
            "input_dir": input_dir.as_posix(),
            "corpus": {
                "report_count": report_count,
                "probed_count": len(metas),
                "probe_failure_count": len(probe_failures),
                "expected_report_count": expect_reports,
            },
            "checks_run": [check.check_id for check in checks],
            "sample": [
                {
                    "report_id": entry.report_id,
                    "venue": entry.venue,
                    "matchday_round": entry.matchday_round,
                    "covers": list(entry.covers),
                }
                for entry in sample
            ],
            "reports": reports,
            "unchecked_report_ids": unchecked_ids,
            "deviation_counts_by_category": counts_by_category,
            "deviations_by_venue": dict(sorted(by_venue.items())),
            "deviations_by_matchday_round": dict(sorted(by_round.items())),
            "corpus_gaps": gaps,
            "gate": {
                "result": "pass" if (total_deviations == 0 and not gaps) else "fail",
                "deviation_count": total_deviations,
                "corpus_gap_count": len(gaps),
                "sample_size": len(sample),
            },
        },
        output_path,
    )


def _write(report: dict, output_path: "str | Path | None") -> dict:
    """Write the manifest canonically: UTF-8, LF, fixed key order (AD-8).

    `newline=""` stops Windows translating `\\n` to CRLF, which would make two runs of an
    unchanged corpus differ byte-for-byte across hosts.
    """
    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
            newline="",
        )
    return report

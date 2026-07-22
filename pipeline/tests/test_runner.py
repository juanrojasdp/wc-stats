"""Task 5/6: verification runner, report format and re-run semantics (AC 2, AC 3, AC 5)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.validate.checks import CHECK_REGISTRY, Check, register_check
from pipeline.validate.deviations import ALL_CATEGORIES, Deviation, DeviationCategory
from pipeline.validate.runner import REPORT_SCHEMA_VERSION, run_verification

COVER_ANCHOR = "POST MATCH SUMMARY REPORT"


@pytest.fixture
def clean_registry():
    snapshot = list(CHECK_REGISTRY)
    yield
    CHECK_REGISTRY[:] = snapshot


def _cover_pdf(path: Path, stage="Group A - Match 1", venue="V1", day=11, teams=("Mexico", "South Africa"), kickoff="13:00"):
    """A cover-only report: probes cleanly, but every domain anchor is missing."""
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    lines = [
        f"{teams[0]} 2 - 0 {teams[1]}",
        stage,
        f"{day} June 2026",
        f"{kickoff} Kick Off",
        venue,
        COVER_ANCHOR,
    ]
    y = 100.0
    for line in lines:
        page.insert_text((80, y), line, fontsize=18)
        y += 40
    doc.save(path)
    doc.close()
    return path


def _junk_pdf(path: Path):
    import pymupdf

    doc = pymupdf.open()
    doc.new_page(width=960, height=540).insert_text((80, 100), "Not a match report", fontsize=18)
    doc.save(path)
    doc.close()
    return path


KNOCKOUT_STAGES = (
    ("Round of 32", "r32"),
    ("Round of 16", "r16"),
    ("Quarter Final", "qf"),
    ("Semi Final", "sf"),
    ("Third Place Play-Off", "third-place"),
    ("Final", "final"),
)


def _gapless_corpus(directory: Path) -> Path:
    """A corpus with every round of `ROUNDS` present and no incomplete group.

    Cover-only reports, so anchor deviations are expected — but `corpus_gaps` is empty,
    which is what lets a test isolate gate behaviour from corpus completeness.
    """
    pairs = [("T1", "T2"), ("T3", "T4"), ("T1", "T3"), ("T2", "T4"), ("T1", "T4"), ("T2", "T3")]
    for i, (home, away) in enumerate(pairs):
        _cover_pdf(
            directory / f"g{i + 1}.pdf",
            stage=f"Group A - Match {i + 1}",
            venue=f"Venue {i + 1}",
            day=11 + i,
            teams=(home, away),
        )
    for i, (stage, _) in enumerate(KNOCKOUT_STAGES):
        _cover_pdf(
            directory / f"k{i + 1}.pdf",
            stage=stage,
            venue=f"Venue {i + 1}",
            day=20 + i,
            teams=(f"K{i}A", f"K{i}B"),
        )
    return directory


def _without_timestamp(report: dict) -> dict:
    return {k: v for k, v in report.items() if k != "run_timestamp"}


# --- the real report -------------------------------------------------------------


def test_ground_truth_report_has_no_missing_anchors(spike_corpus):
    """Every registered anchor resolves on mex_rsa.pdf — the registry's own ground truth.

    The gate as a whole does *not* pass on `spike/`: one group-stage report is not a
    complete group and covers none of the other eight rounds. That is the corpus blocker
    stated honestly, not a harness failure.
    """
    report = run_verification(spike_corpus)

    assert report["schema_version"] == REPORT_SCHEMA_VERSION
    assert [entry["report_id"] for entry in report["sample"]] == ["mex_rsa"]
    assert report["sample"][0]["venue"] == "Mexico City Stadium"
    assert report["deviation_counts_by_category"]["missing-anchor"] == 0


def test_single_report_corpus_cannot_pass_the_gate(spike_corpus):
    """A one-report corpus says nothing about template consistency, so it is not a pass."""
    report = run_verification(spike_corpus)

    assert report["gate"]["result"] == "fail"
    assert report["gate"]["corpus_gap_count"] > 0
    assert any("holds 1 of 6 matches" in gap for gap in report["corpus_gaps"]) or any(
        "matchday round" in gap for gap in report["corpus_gaps"]
    )


def test_report_always_carries_all_four_categories(spike_corpus):
    """AC 2: the report shape must never change underneath an earlier gate result."""
    counts = run_verification(spike_corpus)["deviation_counts_by_category"]

    assert set(counts) == set(ALL_CATEGORIES)


def test_checks_run_are_recorded(spike_corpus):
    report = run_verification(spike_corpus)
    assert report["checks_run"] == ["anchor-coverage", "metadata-probe"]


# --- deviations ------------------------------------------------------------------


def test_missing_anchors_are_recorded_not_raised(tmp_path):
    _cover_pdf(tmp_path / "cover_only.pdf", stage="Final")

    report = run_verification(tmp_path)

    entry = report["reports"][0]
    categories = {d["category"] for d in entry["deviations"]}
    assert categories == {DeviationCategory.MISSING_ANCHOR}
    assert report["gate"]["result"] == "fail"
    assert report["deviation_counts_by_category"]["missing-anchor"] > 0
    # every deviation names the report and the specific anchor
    assert all(d["report_id"] == "cover_only" for d in entry["deviations"])
    assert any("Attempts at Goal Mexico" in d["specifics"] for d in entry["deviations"])


def test_run_continues_across_reports_after_a_deviation(tmp_path):
    _cover_pdf(tmp_path / "a.pdf", venue="V1", stage="Final", day=11)
    _cover_pdf(tmp_path / "b.pdf", venue="V2", stage="Round of 16", day=30, teams=("T1", "T2"))

    report = run_verification(tmp_path)

    assert {entry["report_id"] for entry in report["reports"]} == {"a", "b"}
    assert all(entry["deviations"] for entry in report["reports"])


def test_probe_failure_is_recorded_and_never_crashes_the_scan(tmp_path):
    _cover_pdf(tmp_path / "good.pdf")
    _junk_pdf(tmp_path / "junk.pdf")

    report = run_verification(tmp_path)

    by_id = {entry["report_id"]: entry for entry in report["reports"]}
    assert set(by_id) == {"good", "junk"}
    assert by_id["junk"]["sampled"] is False
    assert by_id["junk"]["venue"] is None
    assert [d["category"] for d in by_id["junk"]["deviations"]] == ["probe-failure"]
    assert report["corpus"]["probe_failure_count"] == 1
    assert report["gate"]["result"] == "fail"


def test_an_impossible_cover_date_never_aborts_the_corpus_scan(tmp_path):
    """A date-shaped but unreal line is report data — it must not kill the other reports."""
    _cover_pdf(tmp_path / "bad.pdf", day=31)  # 31 June does not exist
    _cover_pdf(tmp_path / "good.pdf", stage="Final", venue="V2", teams=("T1", "T2"))

    report = run_verification(tmp_path)

    by_id = {entry["report_id"]: entry for entry in report["reports"]}
    assert set(by_id) == {"bad", "good"}
    assert any("not a real date" in d["specifics"] for d in by_id["bad"]["deviations"])
    assert by_id["good"]["probed"] is True


def test_unrecognized_stage_is_recorded_exactly_once(tmp_path):
    """One root cause, one deviation — a double count distorts the localization counts."""
    _cover_pdf(tmp_path / "odd.pdf", stage="Friendly Kickabout")

    report = run_verification(tmp_path)

    entry = report["reports"][0]
    assert entry["matchday_round"] is None
    stage_deviations = [d for d in entry["deviations"] if "Friendly Kickabout" in d["specifics"]]
    assert len(stage_deviations) == 1
    assert stage_deviations[0]["category"] == "probe-failure"


def test_corpus_membership_does_not_depend_on_filename_case(tmp_path):
    """`glob("*.pdf")` is case-insensitive on Windows and case-sensitive on POSIX.

    Matching the suffix explicitly is what stops the same directory yielding a different
    corpus — and a different gate result — on a POSIX CI runner than on this machine.
    """
    _cover_pdf(tmp_path / "upper.PDF", stage="Final")

    report = run_verification(tmp_path, checks=[])

    assert report["corpus"]["report_count"] == 1
    assert [entry["report_id"] for entry in report["sample"]] == ["upper"]


def test_every_sampled_report_gets_a_terminal_entry(tmp_path):
    """AD-8: no silent skips — presence in the sample implies presence in the report."""
    for name, venue in (("a", "V1"), ("b", "V2"), ("c", "V3")):
        _cover_pdf(tmp_path / f"{name}.pdf", venue=venue)

    report = run_verification(tmp_path)

    sampled = {entry["report_id"] for entry in report["sample"]}
    recorded = {entry["report_id"] for entry in report["reports"] if entry["sampled"]}
    assert sampled == recorded


def test_reports_never_checked_are_named_explicitly(tmp_path):
    """A manifest covering 2 of 5 reports must say which 3 it never looked at."""
    for i in range(5):
        _cover_pdf(tmp_path / f"r{i}.pdf", venue="One Venue", stage="Final", day=11 + i,
                   teams=(f"T{i}A", f"T{i}B"))

    report = run_verification(tmp_path, checks=[])

    recorded = {entry["report_id"] for entry in report["reports"]}
    unchecked = set(report["unchecked_report_ids"])
    assert unchecked and not (recorded & unchecked)
    assert recorded | unchecked == {f"r{i}" for i in range(5)}


# --- localization ----------------------------------------------------------------


def test_deviations_are_grouped_by_venue_and_matchday(tmp_path):
    """AC 2: the summary must localize a revision to a venue or a matchday."""
    _cover_pdf(tmp_path / "a.pdf", venue="Stadium One", stage="Semi Final", day=11)
    _cover_pdf(tmp_path / "b.pdf", venue="Stadium Two", stage="Final", day=19, teams=("T1", "T2"))

    report = run_verification(tmp_path)

    assert set(report["deviations_by_venue"]) == {"Stadium One", "Stadium Two"}
    assert set(report["deviations_by_matchday_round"]) == {"sf", "final"}
    assert all(count > 0 for count in report["deviations_by_venue"].values())


def test_unprobed_reports_are_not_filed_under_a_venue(tmp_path):
    """A report that could not be probed is a different finding from a blank venue."""
    _junk_pdf(tmp_path / "junk.pdf")

    report = run_verification(tmp_path)

    assert report["deviations_by_venue"] == {"<unprobed>": 1}


# --- corpus expectations ---------------------------------------------------------


def test_empty_corpus_fails_the_gate(tmp_path):
    """A mistyped --input-dir must never report green."""
    report = run_verification(tmp_path)

    assert report["corpus"]["report_count"] == 0
    assert report["sample"] == []
    assert report["gate"]["result"] == "fail"
    assert any("corpus is empty" in gap for gap in report["corpus_gaps"])


def test_expect_reports_mismatch_fails_the_gate(tmp_path):
    _cover_pdf(tmp_path / "only.pdf", stage="Final")

    report = run_verification(tmp_path, expect_reports=104)

    assert report["gate"]["result"] == "fail"
    assert any("expected 104" in gap for gap in report["corpus_gaps"])


def test_a_gapless_corpus_records_no_corpus_gaps(tmp_path):
    _gapless_corpus(tmp_path)

    report = run_verification(tmp_path, checks=[], expect_reports=12)

    assert report["corpus_gaps"] == []
    assert report["gate"]["result"] == "pass"


def test_a_missing_round_is_reported_as_a_corpus_gap(tmp_path):
    _gapless_corpus(tmp_path)
    (tmp_path / "k6.pdf").unlink()  # drop the final

    report = run_verification(tmp_path, checks=[])

    assert any("'final'" in gap for gap in report["corpus_gaps"])
    assert report["gate"]["result"] == "fail"


# --- re-run semantics ------------------------------------------------------------


def test_rerun_over_unchanged_corpus_is_identical(spike_corpus):
    """AC 3: same corpus + same code -> same sample, same result."""
    first = run_verification(spike_corpus)
    second = run_verification(spike_corpus)

    assert _without_timestamp(first) == _without_timestamp(second)


def test_rerun_is_deterministic_on_a_multi_report_corpus(tmp_path):
    """A one-report corpus has no tie to break — determinism must be shown where it can fail."""
    _gapless_corpus(tmp_path)

    first = run_verification(tmp_path)
    second = run_verification(tmp_path)

    assert _without_timestamp(first) == _without_timestamp(second)
    assert len(first["sample"]) > 1


def test_report_round_trips_through_json(spike_corpus, tmp_path):
    output = tmp_path / "nested" / "verification-report.json"
    report = run_verification(spike_corpus, output_path=output)

    assert output.exists()
    assert json.loads(output.read_text(encoding="utf-8")) == json.loads(json.dumps(report))


def test_manifest_is_serialized_canonically(spike_corpus, tmp_path):
    """AD-8: sorted keys, UTF-8, LF — so two runs are byte-identical across hosts."""
    output = tmp_path / "report.json"
    run_verification(spike_corpus, output_path=output)

    raw = output.read_bytes()
    assert b"\r\n" not in raw
    text = raw.decode("utf-8")
    assert json.dumps(json.loads(text), indent=2, ensure_ascii=False, sort_keys=True) + "\n" == text


def test_rerun_is_byte_identical_apart_from_the_timestamp(spike_corpus, tmp_path):
    first, second = tmp_path / "a.json", tmp_path / "b.json"
    run_verification(spike_corpus, output_path=first)
    run_verification(spike_corpus, output_path=second)

    def blank_timestamp(raw: bytes) -> bytes:
        import re

        return re.sub(rb'"run_timestamp": "[^"]*"', b'"run_timestamp": ""', raw)

    assert blank_timestamp(first.read_bytes()) == blank_timestamp(second.read_bytes())


def test_output_directory_is_created(tmp_path, spike_corpus):
    output = tmp_path / "deep" / "deeper" / "report.json"
    run_verification(spike_corpus, output_path=output)
    assert output.exists()


def test_missing_input_directory_raises(tmp_path):
    with pytest.raises(NotADirectoryError):
        run_verification(tmp_path / "nope")


# --- extensibility ---------------------------------------------------------------


def test_a_newly_registered_check_flows_into_the_report(spike_corpus, clean_registry):
    """AC 3: Stories 1.3-1.14 extend the gate without editing the runner."""
    register_check(
        Check(
            check_id="future-count-check",
            applies_to=lambda meta: True,
            run=lambda doc, meta: [
                Deviation(
                    report_id=meta.report_id,
                    check="future-count-check",
                    category=DeviationCategory.COUNT_MISMATCH,
                    specifics="parsed 15 markers, page prints 16",
                )
            ],
        )
    )

    report = run_verification(spike_corpus)

    assert "future-count-check" in report["checks_run"]
    assert report["deviation_counts_by_category"]["count-mismatch"] == 1


def test_applies_to_prevents_a_check_from_running(spike_corpus, clean_registry):
    """The predicate is honoured by the runner, not merely callable on its own."""
    register_check(
        Check(
            check_id="knockout-only-check",
            applies_to=lambda meta: meta.group is None,
            run=lambda doc, meta: [
                Deviation(
                    report_id=meta.report_id,
                    check="knockout-only-check",
                    category=DeviationCategory.COUNT_MISMATCH,
                    specifics="should not run on a group-stage report",
                )
            ],
        )
    )

    report = run_verification(spike_corpus)

    assert "knockout-only-check" in report["checks_run"]
    assert report["deviation_counts_by_category"]["count-mismatch"] == 0


def test_a_raising_check_does_not_suppress_the_others(tmp_path, clean_registry):
    """One buggy check must not erase every deviation the remaining checks would find."""
    _cover_pdf(tmp_path / "cover_only.pdf", stage="Final")

    baseline = run_verification(tmp_path)["deviation_counts_by_category"]["missing-anchor"]
    assert baseline > 1

    register_check(
        Check(
            check_id="aaa-exploding-check",  # sorts before anchor-coverage
            applies_to=lambda meta: True,
            run=lambda doc, meta: (_ for _ in ()).throw(RuntimeError("boom")),
        )
    )

    report = run_verification(tmp_path)

    assert report["deviation_counts_by_category"]["missing-anchor"] == baseline
    crash = [
        d
        for entry in report["reports"]
        for d in entry["deviations"]
        if d["check"] == "aaa-exploding-check"
    ]
    assert len(crash) == 1
    assert "RuntimeError" in crash[0]["specifics"]


def test_duplicate_check_ids_are_rejected(tmp_path):
    """The `checks=` parameter must not bypass the registry's uniqueness guard."""
    noop = Check(check_id="x", applies_to=lambda meta: True, run=lambda doc, meta: [])

    with pytest.raises(ValueError, match="duplicate check id"):
        run_verification(tmp_path, checks=[noop, noop])

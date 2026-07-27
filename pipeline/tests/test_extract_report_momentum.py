"""Momentum at the Extraction Record and FR-15 gate seams (Story 1.8, AC 3, AC 4).

`test_extract_momentum.py` owns the parser; this module owns the two seams it plugs into
— `domains["momentum"]` plus the appended self-validation checks, and the
`momentum-axis-scale` / `momentum-coverage` gate pair.
"""

from __future__ import annotations

import json

import pytest

from pipeline.ingest.batch import run_batch
from pipeline.ingest.extract_report import extract_report
from pipeline.ingest.records import serialize_record
from pipeline.validate.checks import registered_checks
from pipeline.validate.deviations import DeviationCategory
from pipeline.validate.runner import run_verification

MOMENTUM_CHECK_IDS = ("momentum-axis-scale", "momentum-coverage")


# --- the record seam ------------------------------------------------------------------


def test_the_record_always_carries_a_momentum_key(make_report, tmp_path):
    """AD-4: required, never omitted, never `[]`."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert "momentum" in record["domains"]
    series = record["domains"]["momentum"]
    assert series is not None
    assert series["samples"] != []


def test_an_absent_chart_stages_none_and_a_warning_not_a_failed_check(make_report, tmp_path):
    """The documented-absence branch (Task 4.4). No corpus report takes it — all 104 draw
    a band — so a clean corpus run is NOT evidence that this branch is dead code."""
    record = extract_report(
        make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, momentum_values={})
    )

    assert "momentum" in record["domains"]
    assert record["domains"]["momentum"] is None
    assert any(
        warning.startswith("momentum: the chart on page") for warning in record["warnings"]
    )
    # The aggregator is strictly binary: a non-"pass" check here would turn a merely
    # incomplete report into a failing one.
    assert not [
        check
        for check in record["self_validation"]["checks"]
        if check["check"] in MOMENTUM_CHECK_IDS
    ]
    assert record["self_validation"]["result"] == "pass"


def test_the_momentum_checks_are_appended_as_one_contiguous_block(make_report, tmp_path):
    """Append-only: the chain composes across domain stories and never reorders.

    Deliberately NOT "the momentum pair is last" — a later story appending its own block
    after this one is exactly what append-only means, and pinning the tail would make
    every subsequent extraction story fail this test for behaving correctly.
    """
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    ids = [check["check"] for check in record["self_validation"]["checks"]]
    start = ids.index("momentum-axis-scale")
    assert ids[start : start + 2] == list(MOMENTUM_CHECK_IDS)
    assert start > 0, "momentum must not displace the checks appended before it"
    assert [check_id for check_id in ids if check_id in MOMENTUM_CHECK_IDS] == list(
        MOMENTUM_CHECK_IDS
    ), "each momentum check appears exactly once"
    assert record["self_validation"]["result"] == "pass"


def test_a_chart_whose_axis_contradicts_its_bars_fails_self_validation_but_still_extracts(
    make_report, tmp_path
):
    """SM-C1: a recorded check, never loosened, and never an exception — the record still
    stages so the gate can localize it. Every drawn value is even, so the geometric unit
    comes out at two units and the derived peak at half the printed label; only the
    printed-vs-derived comparison can see that."""
    record = extract_report(
        make_report(
            tmp_path / "PMSR-M07-AAA-V-BBB.pdf",
            number=7,
            momentum_top_label=10,
            momentum_values={5: (10, 4), 9: (6, 2), 15: (2, 0)},
        )
    )

    series = record["domains"]["momentum"]
    assert series is not None, "the record still stages, so the gate can localize it"
    (axis_check,) = [
        check
        for check in record["self_validation"]["checks"]
        if check["check"] == "momentum-axis-scale"
    ]
    assert axis_check["result"] == "fail"
    assert record["self_validation"]["result"] == "fail"


def test_the_momentum_anchor_is_resolved_and_recorded(make_report, tmp_path):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert record["anchors"]["momentum"], "the chart page must be located by its anchor"


def test_the_staged_series_serializes_deterministically(make_report, tmp_path):
    """AD-8: sorted keys, fixed precision, byte-identical re-runs. No derived float ever
    reaches the record, so two machines' float noise cannot diverge."""
    path = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    first = serialize_record(extract_report(path))
    second = serialize_record(extract_report(path))

    assert first == second
    series = json.loads(first)["domains"]["momentum"]
    for sample in series["samples"]:
        assert sorted(sample) == ["away", "home", "minute", "stoppage_minute"]
        assert isinstance(sample["home"], int) and isinstance(sample["away"], int)


def test_the_absence_warning_reaches_the_run_manifest(make_report, tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M07-AAA-V-BBB.pdf", number=7, momentum_values={})

    manifest = run_batch(
        corpus,
        output_path=tmp_path / "work" / "run-manifest.json",
        extracted_dir=tmp_path / "work" / "extracted",
    )

    (entry,) = manifest["reports"]
    assert entry["status"] == "extracted"
    assert any(warning.startswith("momentum: the chart") for warning in entry["warnings"])


# --- the gate seam --------------------------------------------------------------------


def test_both_momentum_checks_are_registered():
    ids = [check.check_id for check in registered_checks()]

    for check_id in MOMENTUM_CHECK_IDS:
        assert check_id in ids
    assert ids == sorted(ids), "registered_checks() must stay sorted by id"


def test_a_clean_report_emits_no_momentum_deviation(make_report, tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    report = run_verification(corpus)

    (entry,) = report["reports"]
    assert not [
        deviation
        for deviation in entry["deviations"]
        if deviation["check"] in MOMENTUM_CHECK_IDS
    ]
    for check_id in MOMENTUM_CHECK_IDS:
        assert check_id in report["checks_run"]


def test_an_off_palette_bar_reaches_the_gate_as_unknown_rgb(make_report, tmp_path):
    """The same bucket an off-palette shots marker lands in: the chart encodes home/away
    ONLY as a fill, so an unrecognized colour makes the attribution a guess."""
    from conftest import MOMENTUM_BASELINE, MOMENTUM_PLOT_X0, momentum_pitch, momentum_unit

    def stray_bar(page):
        pitch = momentum_pitch()
        width = 0.70 * pitch
        x0 = MOMENTUM_PLOT_X0 + 40 * pitch + (pitch - width) / 2.0
        y0 = MOMENTUM_BASELINE - 2 * momentum_unit()
        page.draw_polyline(
            [(x0, y0), (x0 + width, y0), (x0 + width, MOMENTUM_BASELINE),
             (x0, MOMENTUM_BASELINE), (x0, y0)],
            color=None,
            fill=(0.0, 0.6, 0.2),
        )

    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M07-AAA-V-BBB.pdf", number=7, momentum_decorate=stray_bar)

    report = run_verification(corpus)

    (entry,) = report["reports"]
    (deviation,) = [
        d for d in entry["deviations"] if d["check"] == "momentum-axis-scale"
    ]
    assert deviation["category"] == DeviationCategory.UNKNOWN_RGB
    assert "MomentumFillError" in deviation["specifics"]
    # Single attribution: `momentum-coverage` swallows the parse failure so one root
    # cause is not counted twice in the localization histograms.
    assert not [d for d in entry["deviations"] if d["check"] == "momentum-coverage"]


def test_a_clock_failure_reaches_the_gate_as_a_probe_failure(make_report, tmp_path):
    ticks = {"0": 0, "15": 14, "45": 44, "HT": 48, "60": 62, "75": 77, "90": 92, "FT": 95}

    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M07-AAA-V-BBB.pdf", number=7, momentum_ticks=ticks)

    report = run_verification(corpus)

    (entry,) = report["reports"]
    (deviation,) = [
        d for d in entry["deviations"] if d["check"] == "momentum-axis-scale"
    ]
    assert deviation["category"] == DeviationCategory.PROBE_FAILURE
    assert "MomentumClockError" in deviation["specifics"]


def test_a_missing_chart_page_is_anchor_coverages_finding_only(make_report, tmp_path):
    """Re-reporting a missing anchor under a domain id would count one root cause twice."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M07-AAA-V-BBB.pdf", number=7, drop_anchor_ids=("momentum",)
    )

    report = run_verification(corpus)

    (entry,) = report["reports"]
    anchor_findings = [
        d for d in entry["deviations"] if d["check"] == "anchor-coverage" and "momentum" in d["specifics"]
    ]
    assert len(anchor_findings) == 1
    assert not [
        d for d in entry["deviations"] if d["check"] in MOMENTUM_CHECK_IDS
    ]

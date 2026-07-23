"""Task 5: the deviation model and the extensible check registry (AC 2, AC 3, AC 5)."""

from __future__ import annotations

import datetime as dt
import json

import pytest

from pipeline.discover.probe import ReportMeta
from pipeline.validate.checks import (
    CHECK_REGISTRY,
    Check,
    register_check,
    registered_checks,
)
from pipeline.validate.deviations import ALL_CATEGORIES, Deviation, DeviationCategory


@pytest.fixture
def clean_registry():
    """Snapshot and restore the module-level registry around registry mutations."""
    snapshot = list(CHECK_REGISTRY)
    yield
    CHECK_REGISTRY[:] = snapshot


def sample_meta(**overrides):
    base = dict(
        report_id="r1",
        source_path="r1.pdf",
        home_team="Mexico",
        away_team="South Africa",
        home_score=2,
        away_score=0,
        stage_text="Group A - Match 1",
        group="A",
        match_date=dt.date(2026, 6, 11),
        kickoff="13:00",
        venue="Mexico City Stadium",
        matchday_round="group-md1",
    )
    base.update(overrides)
    return ReportMeta(**base)


def test_all_four_deviation_categories_exist_from_day_one():
    """1.3+ fill unknown-rgb and count-mismatch; the shape must already be there."""
    assert ALL_CATEGORIES == (
        "missing-anchor",
        "unknown-rgb",
        "count-mismatch",
        "probe-failure",
    )
    assert DeviationCategory.MISSING_ANCHOR == "missing-anchor"
    assert DeviationCategory.UNKNOWN_RGB == "unknown-rgb"
    assert DeviationCategory.COUNT_MISMATCH == "count-mismatch"
    assert DeviationCategory.PROBE_FAILURE == "probe-failure"


def test_deviation_serializes_to_snake_case_json():
    deviation = Deviation(
        report_id="r1",
        check="anchor-coverage",
        category=DeviationCategory.MISSING_ANCHOR,
        specifics="anchor 'Set Plays Mexico' not found",
    )

    payload = deviation.to_dict()

    assert payload == {
        "report_id": "r1",
        "check": "anchor-coverage",
        "category": "missing-anchor",
        "specifics": "anchor 'Set Plays Mexico' not found",
    }
    assert json.loads(json.dumps(payload)) == payload


def test_deviation_rejects_unknown_category():
    with pytest.raises(ValueError):
        Deviation(report_id="r1", check="c", category="made-up", specifics="x")


@pytest.mark.parametrize(
    "field,value",
    [
        ("specifics", ValueError("boom")),
        ("specifics", 42),
        ("report_id", None),
        ("check", object()),
    ],
)
def test_deviation_rejects_non_string_fields(field, value):
    """Caught at construction, not inside json.dumps after every PDF has been read.

    A later story passing an exception object as `specifics` would otherwise abort the
    run at serialization time — no manifest written, no gate result, all work wasted.
    """
    kwargs = {
        "report_id": "r1",
        "check": "c",
        "category": DeviationCategory.COUNT_MISMATCH,
        "specifics": "x",
    }
    kwargs[field] = value

    with pytest.raises(TypeError, match=field):
        Deviation(**kwargs)


def test_builtin_checks_are_registered():
    ids = {check.check_id for check in registered_checks()}
    assert {"anchor-coverage", "metadata-probe"} <= ids


def test_registered_checks_are_returned_in_deterministic_order():
    ids = [check.check_id for check in registered_checks()]
    assert ids == sorted(ids)


def test_a_later_story_can_register_a_check_into_the_registry(clean_registry):
    """The registry surface only. That a registered check actually reaches the manifest
    is proved end-to-end by `test_runner.test_a_newly_registered_check_flows_into_the_report`.
    """
    # `marker-event-link-rate` was this test's example until Story 1.5 registered it for
    # real; the example must stay a check no story has claimed yet.
    marker = Deviation(
        report_id="r1",
        check="crosses-count-match",
        category=DeviationCategory.COUNT_MISMATCH,
        specifics="parsed 15 markers, page prints 16",
    )
    register_check(
        Check(
            check_id="crosses-count-match",
            applies_to=lambda meta: True,
            run=lambda doc, meta: [marker],
        )
    )

    assert "crosses-count-match" in {c.check_id for c in registered_checks()}


def test_register_check_rejects_duplicate_ids(clean_registry):
    check = Check("dup", applies_to=lambda meta: True, run=lambda doc, meta: [])
    register_check(check)
    with pytest.raises(ValueError):
        register_check(check)


def test_applies_to_is_a_predicate_over_report_metadata(clean_registry):
    """The predicate's own contract. That the *runner* honours it is proved by
    `test_runner.test_applies_to_prevents_a_check_from_running`, which is where the
    filtering actually happens.
    """
    knockout_only = Check(
        check_id="knockout-only",
        applies_to=lambda meta: meta.group is None,
        run=lambda doc, meta: [],
    )

    assert knockout_only.applies_to(sample_meta()) is False
    assert knockout_only.applies_to(sample_meta(group=None, stage_text="Final")) is True


# --- Story 1.3: the shots checks --------------------------------------------------


def _checks_by_id():
    return {check.check_id: check for check in registered_checks()}


def _open_report(make_report, tmp_path, **kwargs):
    import pymupdf

    return pymupdf.open(make_report(tmp_path / "PMSR-M01-MEX-V-RSA.pdf", number=1, **kwargs))


def test_the_shots_checks_are_registered_once():
    ids = [check.check_id for check in registered_checks()]

    assert ids.count("shots-parse") == 1
    assert ids.count("shots-count-match") == 1


def test_shots_checks_are_clean_on_a_well_formed_report(tmp_path, make_report):
    with _open_report(make_report, tmp_path) as doc:
        assert _checks_by_id()["shots-parse"].run(doc, sample_meta()) == []
        assert _checks_by_id()["shots-count-match"].run(doc, sample_meta()) == []


def test_the_two_shots_checks_share_one_parse_per_document(tmp_path, make_report, monkeypatch):
    """Neither check may rebuild the full-text index and re-parse both maps on its own:
    the one-slot memo replays the first parse for the same open document — the
    naive-re-extraction lesson `extract_report.py` documents."""
    import pipeline.validate.checks as checks_module

    calls: list[int] = []
    real = checks_module._shots_parse_uncached
    monkeypatch.setattr(
        checks_module,
        "_shots_parse_uncached",
        lambda doc, meta: calls.append(1) or real(doc, meta),
    )
    with _open_report(make_report, tmp_path) as doc:
        _checks_by_id()["shots-parse"].run(doc, sample_meta())
        _checks_by_id()["shots-count-match"].run(doc, sample_meta())

    assert len(calls) == 1


def test_shots_parse_reports_an_off_palette_marker_as_unknown_rgb(tmp_path, make_report):
    def decorate(side, page, pitch):
        if side == "home":
            page.draw_circle((200, 300), 5.625, color=(1, 1, 1), fill=(0.5, 0.5, 0.5), width=0.75)

    with _open_report(make_report, tmp_path, shots_decorate=decorate) as doc:
        deviations = _checks_by_id()["shots-parse"].run(doc, sample_meta())

    [deviation] = deviations
    assert deviation.category == DeviationCategory.UNKNOWN_RGB
    assert "(0.5, 0.5, 0.5)" in deviation.specifics
    assert "page" in deviation.specifics


def test_shots_count_match_reports_one_deviation_per_failing_team_with_both_counts(
    tmp_path, make_report
):
    with _open_report(
        make_report, tmp_path, shots_table_rows={"home": 9, "away": 5}
    ) as doc:
        deviations = _checks_by_id()["shots-count-match"].run(doc, sample_meta())

    assert [d.category for d in deviations] == [
        DeviationCategory.COUNT_MISMATCH,
        DeviationCategory.COUNT_MISMATCH,
    ]
    by_side = {d.specifics.split(":")[0]: d.specifics for d in deviations}
    assert "table lists 9" in by_side["home"]
    assert "table lists 5" in by_side["away"]


def test_shots_checks_stay_silent_when_a_shots_anchor_is_missing(tmp_path, make_report):
    """A missing anchor is anchor-coverage's finding; double-reporting it here would
    inflate the localization histograms with one root cause counted twice."""
    with _open_report(make_report, tmp_path, drop_anchor_ids=("shots:home",)) as doc:
        assert _checks_by_id()["shots-parse"].run(doc, sample_meta()) == []
        assert _checks_by_id()["shots-count-match"].run(doc, sample_meta()) == []


def test_shots_count_match_stays_silent_on_a_parse_failure_shots_parse_raises(
    tmp_path, make_report
):
    """One root cause, one finding: the count check yields nothing on a broken parse,
    while shots-parse raises the typed error for the runner to isolate and record."""
    from pipeline.markers.errors import PitchFrameError

    with _open_report(make_report, tmp_path, shots_draw_pitch=False) as doc:
        assert _checks_by_id()["shots-count-match"].run(doc, sample_meta()) == []
        with pytest.raises(PitchFrameError):
            _checks_by_id()["shots-parse"].run(doc, sample_meta())

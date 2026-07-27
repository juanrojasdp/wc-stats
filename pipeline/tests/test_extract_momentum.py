"""Story 1.8: the momentum chart parser (`pipeline/extract/momentum.py`).

Unit coverage of the two derivations that carry the risk — the value scale and the
slot -> match-clock mapping — plus the absence branch and every typed failure path.

Ground truth is `spike/mex_rsa.pdf` (= the m001 report), whose figures were measured
against all 104 corpus reports at story creation and re-measured by this story's own
full-corpus sweep. It is counts and distribution only, never the spike script's printed
coordinates.
"""

from __future__ import annotations

import pytest
import pymupdf

from conftest import (
    DEFAULT_MOMENTUM_SLOTS,
    DEFAULT_MOMENTUM_TICKS,
    DEFAULT_MOMENTUM_TOP_LABEL,
    DEFAULT_MOMENTUM_VALUES,
    MOMENTUM_AWAY_FILL,
    MOMENTUM_BASELINE,
    MOMENTUM_GRID_STEP,
    MOMENTUM_GRID_TOP,
    MOMENTUM_HOME_FILL,
    MOMENTUM_LEGEND_Y0,
    MOMENTUM_LEGEND_Y1,
    MOMENTUM_PLOT_X0,
    MOMENTUM_PLOT_X1,
    MOMENTUM_TICK_FONTSIZE,
    MOMENTUM_TITLE,
    draw_momentum_page,
    momentum_pitch,
    momentum_unit,
)
from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.text import PageTextIndex, normalize
from pipeline.extract.errors import (
    MomentumAxisError,
    MomentumChartError,
    MomentumClockError,
    MomentumFillError,
    MomentumScaleError,
)
from pipeline.extract.momentum import (
    MOMENTUM_ANCHOR_ID,
    _approx_gcd,
    extract_momentum,
    momentum_checks,
)

REPORT_ID = "PMSR-M01-MEX-V-RSA"


# --- helpers -------------------------------------------------------------------------


def chart_doc(**kwargs):
    """A one-page document carrying only the momentum chart, anchored by its title."""
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    page.insert_text((372.84, 361.89), MOMENTUM_TITLE, fontsize=12)
    draw_momentum_page(page, title=False, **kwargs)
    return doc


def parse(doc, home="Mexico", away="South Africa", anchors=None):
    return extract_momentum(
        doc,
        {MOMENTUM_ANCHOR_ID: [0]} if anchors is None else anchors,
        report_id=REPORT_ID,
        home_team=home,
        away_team=away,
    )


def stamps(series):
    return [(sample["minute"], sample["stoppage_minute"]) for sample in series["samples"]]


# --- the happy path ------------------------------------------------------------------


def test_the_default_chart_parses_into_a_dense_per_minute_series():
    series = parse(chart_doc())["series"]

    # One sample per SLOT, not per drawn bar: the fixture draws 8 slots and the grid
    # holds 96. A sparse series would leave the App's timeline showing phantom gaps.
    assert len(series["samples"]) == DEFAULT_MOMENTUM_SLOTS
    assert series["axis_top_label"] == DEFAULT_MOMENTUM_TOP_LABEL
    assert series["full_time_index"] == DEFAULT_MOMENTUM_TICKS["FT"]
    assert series["extra_time"] is False

    by_slot = {slot: (values[0], values[1]) for slot, values in DEFAULT_MOMENTUM_VALUES.items()}
    for index, sample in enumerate(series["samples"]):
        expected = by_slot.get(index, (0, 0))
        assert (sample["home"], sample["away"]) == expected, index


def test_absent_slots_are_a_real_zero_on_both_sides():
    series = parse(chart_doc(values={10: (5, 0), 12: (1, 0)}))["series"]

    assert all(
        sample["home"] == 0 and sample["away"] == 0
        for index, sample in enumerate(series["samples"])
        if index not in (10, 12)
    )
    assert series["samples"][10] == {
        "minute": 11,
        "stoppage_minute": None,
        "home": 5,
        "away": 0,
    }
    assert series["samples"][12]["home"] == 1


def test_every_staged_value_is_an_int_never_a_derived_float():
    """AD-8 byte-identity: a leaked pitch or unit float would differ between machines."""
    series = parse(chart_doc())["series"]

    assert set(series) == {"samples", "axis_top_label", "full_time_index", "extra_time"}
    assert isinstance(series["axis_top_label"], int)
    for sample in series["samples"]:
        assert isinstance(sample["minute"], int)
        assert isinstance(sample["home"], int) and isinstance(sample["away"], int)
        assert sample["stoppage_minute"] is None or isinstance(sample["stoppage_minute"], int)


def test_a_slot_can_carry_both_colours():
    """1,747 corpus slots do; assuming one bar per slot silently halves the series."""
    series = parse(chart_doc(values={5: (3, 2), 6: (5, 1), 7: (1, 0)}))["series"]

    assert (series["samples"][5]["home"], series["samples"][5]["away"]) == (3, 2)
    assert (series["samples"][6]["home"], series["samples"][6]["away"]) == (5, 1)


# --- the clock mapping (Task 1.3) ----------------------------------------------------


def test_the_first_half_maps_minute_m_to_slot_m_minus_one():
    series = parse(chart_doc())["series"]
    mapping = stamps(series)

    assert mapping[0] == (1, None)
    assert mapping[14] == (15, None)
    assert mapping[29] == (30, None)
    assert mapping[44] == (45, None)


def test_first_half_stoppage_lands_between_the_45_tick_and_half_time():
    """The HT tick sits on slot 48, so slots 45-47 are 45+1, 45+2, 45+3."""
    mapping = stamps(parse(chart_doc())["series"])

    assert mapping[45:48] == [(45, 1), (45, 2), (45, 3)]
    assert mapping[48] == (46, None)


def test_the_second_half_shifts_by_the_reports_own_stoppage_allotment():
    """Half time lands anywhere from slot 48 to 56 across the corpus; nothing is
    hard-coded, so a chart with a longer first-half stoppage must still map correctly."""
    ticks = {
        "0": 0, "15": 14, "30": 29, "45": 44, "HT": 52,
        "60": 66, "75": 81, "90": 96, "FT": 99,
    }
    mapping = stamps(parse(chart_doc(slot_count=100, ticks=ticks))["series"])

    assert mapping[45:52] == [(45, k) for k in range(1, 8)]
    assert mapping[52] == (46, None)
    assert mapping[66] == (60, None)
    assert mapping[96] == (90, None)
    assert mapping[99] == (90, 3)


def test_second_half_stoppage_runs_to_the_ft_tick():
    mapping = stamps(parse(chart_doc())["series"])

    assert mapping[92] == (90, None)
    assert mapping[93:96] == [(90, 1), (90, 2), (90, 3)]
    assert mapping[-1] == (90, 3)


def test_a_report_that_does_not_print_half_time_infers_it_from_the_later_ticks():
    """Three corpus reports omit the HT tick entirely (M67, M86, M104)."""
    ticks = dict(DEFAULT_MOMENTUM_TICKS)
    del ticks["HT"]

    mapping = stamps(parse(chart_doc(ticks=ticks))["series"])

    assert mapping[48] == (46, None)
    assert mapping[45] == (45, 1)


def test_a_report_that_does_not_print_full_time_takes_the_grids_last_slot():
    """One corpus report omits the FT tick (M42); the grid ends at full time on all 94
    reports that print both, which is what makes the fallback safe — and the check
    records that it could not be cross-checked."""
    ticks = dict(DEFAULT_MOMENTUM_TICKS)
    del ticks["FT"]

    result = parse(chart_doc(ticks=ticks))
    series = result["series"]

    assert series["full_time_index"] is None
    assert stamps(series)[-1] == (90, 3)
    checks = {check["check"]: check for check in momentum_checks(series)}
    assert checks["momentum-coverage"]["result"] == "pass"


def test_contradicting_second_half_ticks_fail_loud():
    ticks = dict(DEFAULT_MOMENTUM_TICKS)
    ticks["60"] = 63  # one slot away from what HT=48 implies

    with pytest.raises(MomentumClockError, match="second-half start disagrees"):
        parse(chart_doc(ticks=ticks))


def test_a_missing_first_half_tick_fails_loud():
    ticks = dict(DEFAULT_MOMENTUM_TICKS)
    del ticks["30"]

    with pytest.raises(MomentumClockError, match=r"does not print the 30' tick"):
        parse(chart_doc(ticks=ticks))


def test_a_first_half_tick_off_its_slot_fails_loud():
    ticks = dict(DEFAULT_MOMENTUM_TICKS)
    ticks["30"] = 31

    with pytest.raises(MomentumClockError, match=r"tick 30' sits at slot 31"):
        parse(chart_doc(ticks=ticks))


def test_a_grid_running_past_full_time_with_no_extra_time_tick_fails_loud():
    with pytest.raises(MomentumClockError, match="past the FT tick"):
        parse(chart_doc(slot_count=DEFAULT_MOMENTUM_SLOTS + 4))


# --- extra time -----------------------------------------------------------------------


EXTRA_TIME_TICKS = {
    "0": 0, "15": 14, "30": 29, "45": 44, "HT": 48,
    "60": 62, "75": 77, "90": 92, "FT": 95, "120": 128,
}


def test_extra_time_maps_both_periods_from_the_ft_and_120_ticks():
    """Nine corpus reports carry a 120 tick. Neither extra-time break is printed on any
    of them: the first period opens on the slot after FT and the 120 tick's own fifteen
    regular minutes place the second, which is the only reading the ticks support."""
    mapping = stamps(
        parse(chart_doc(slot_count=131, ticks=EXTRA_TIME_TICKS, values={10: (5, 0), 12: (1, 0)}))["series"]
    )

    assert mapping[95] == (90, 3)
    assert mapping[96] == (91, None)
    assert mapping[110] == (105, None)
    assert mapping[113] == (105, 3)  # first extra period's stoppage
    assert mapping[114] == (106, None)
    assert mapping[128] == (120, None)
    assert mapping[130] == (120, 2)


def test_an_extra_time_series_is_flagged_and_its_coverage_check_targets_120():
    series = parse(
        chart_doc(slot_count=131, ticks=EXTRA_TIME_TICKS, values={10: (5, 0), 12: (1, 0)})
    )["series"]

    assert series["extra_time"] is True
    checks = {check["check"]: check for check in momentum_checks(series)}
    assert checks["momentum-coverage"]["result"] == "pass"
    assert "120+2" in checks["momentum-coverage"]["specifics"]


def test_overlapping_extra_time_periods_fail_loud():
    ticks = dict(EXTRA_TIME_TICKS)
    ticks["120"] = 110  # leaves no room for two fifteen-minute periods after FT

    with pytest.raises(MomentumClockError, match="extra-time periods overlap"):
        parse(chart_doc(slot_count=131, ticks=ticks, values={10: (5, 0), 12: (1, 0)}))


def test_an_extra_time_chart_without_an_ft_tick_fails_loud():
    ticks = dict(EXTRA_TIME_TICKS)
    del ticks["FT"]

    with pytest.raises(MomentumClockError, match="prints no FT tick"):
        parse(chart_doc(slot_count=131, ticks=ticks, values={10: (5, 0), 12: (1, 0)}))


# --- the value scale ------------------------------------------------------------------


def test_the_scale_comes_from_the_printed_axis_and_the_peak_matches_it():
    series = parse(chart_doc(top_label=8, values={3: (8, 2), 9: (5, 8), 11: (1, 0)}))["series"]

    assert series["axis_top_label"] == 8
    assert max(max(s["home"], s["away"]) for s in series["samples"]) == 8


def test_a_printed_axis_that_contradicts_the_geometry_is_RECORDED_not_raised():
    """The values come from the geometry, so a wrong printed axis does not stop the parse
    — it is exactly the printed-vs-derived disagreement `momentum-axis-scale` exists to
    surface, and SM-C1 rules that such a finding is recorded and ledgered, never absorbed
    by loosening the check or by aborting the report."""
    doc = chart_doc(axis_labels=["7", "5.25", "3.5", "1.75", "0", "1.75", "3.5", "5.25", "7"])

    series = parse(doc)["series"]

    assert series["axis_top_label"] == 7
    assert max(s["home"] for s in series["samples"]) == 5  # unchanged: geometry wins
    (axis_check,) = [c for c in momentum_checks(series) if c["check"] == "momentum-axis-scale"]
    assert axis_check["result"] == "fail"


def test_a_chart_whose_values_all_share_a_factor_is_caught_by_the_axis_check():
    """The geometric GCD cannot tell one unit from two when every drawn value is even, so
    the derived peak comes out half the printed label. Nothing else on the page could see
    it — this is precisely why the printed axis is worth reading."""
    doc = chart_doc(top_label=10, values={3: (10, 4), 9: (6, 2), 15: (2, 0)})

    series = parse(doc)["series"]

    assert series["axis_top_label"] == 10
    assert max(s["home"] for s in series["samples"]) == 5  # the halved reading
    (axis_check,) = [c for c in momentum_checks(series) if c["check"] == "momentum-axis-scale"]
    assert axis_check["result"] == "fail"
    assert axis_check["specifics"] == (
        "printed y-axis top label 10 vs derived peak value 5"
    )


def test_a_bar_height_off_the_value_grid_fails_loud():
    """Zero non-integer heights exist across the whole corpus, so one is the geometry
    contradicting itself — a template revision, never something to round away."""
    doc = chart_doc()
    page = doc[0]
    pitch = momentum_pitch()
    unit = momentum_unit()
    width = 0.70 * pitch
    x0 = MOMENTUM_PLOT_X0 + 30 * pitch + (pitch - width) / 2.0
    y0 = MOMENTUM_BASELINE - (2 * unit + 0.5)
    page.draw_polyline(
        [(x0, y0), (x0 + width, y0), (x0 + width, MOMENTUM_BASELINE),
         (x0, MOMENTUM_BASELINE), (x0, y0)],
        color=None,
        fill=MOMENTUM_HOME_FILL,
    )

    with pytest.raises(MomentumScaleError, match="not an integer multiple"):
        parse(doc)


def test_a_peak_that_no_longer_fills_the_axis_half_height_fails_loud():
    doc = chart_doc(values={10: (4, 1)})  # top label 5, so the peak stops short

    with pytest.raises(MomentumScaleError, match="auto-scale no longer fills the axis"):
        parse(doc)


def test_approx_gcd_survives_pdf_coordinate_noise():
    """The Euclidean form with a floored remainder converged on ~0.001 pt for 13 real
    reports; the nearest-multiple remainder is what makes this stable."""
    unit = 2.79892
    heights = [unit * k + noise for k, noise in ((18, 0.0), (7, 1e-4), (3, -1e-4), (11, 5e-5))]

    assert _approx_gcd(heights, tol=0.01) == pytest.approx(unit, abs=1e-3)


# --- the y-axis -----------------------------------------------------------------------


def test_a_short_axis_label_column_fails_loud():
    with pytest.raises(MomentumAxisError, match="holds 8 labels"):
        parse(chart_doc(axis_labels=["5", "3.75", "2.5", "1.25", "0", "1.25", "2.5", "3.75"]))


def test_an_asymmetric_axis_fails_loud():
    labels = ["5", "3.75", "2.5", "1.25", "0", "1.25", "2.5", "3.75", "6"]

    with pytest.raises(MomentumAxisError, match="not symmetric"):
        parse(chart_doc(axis_labels=labels))


def test_an_axis_whose_centre_is_not_zero_fails_loud():
    labels = ["5", "3.75", "2.5", "1.25", "1", "1.25", "2.5", "3.75", "5"]

    with pytest.raises(MomentumAxisError, match="centre label"):
        parse(chart_doc(axis_labels=labels))


def test_a_non_numeric_top_label_fails_loud():
    labels = ["N/A", "3.75", "2.5", "1.25", "0", "1.25", "2.5", "3.75", "N/A"]

    with pytest.raises(MomentumAxisError, match="not numeric"):
        parse(chart_doc(axis_labels=labels))


def test_a_fractional_top_label_fails_loud():
    labels = ["2.5", "1.875", "1.25", "0.625", "0", "0.625", "1.25", "1.875", "2.5"]

    with pytest.raises(MomentumAxisError, match="not a positive integer"):
        parse(chart_doc(axis_labels=labels))


# --- chart structure ------------------------------------------------------------------


def test_a_chart_without_gridlines_fails_loud():
    with pytest.raises(MomentumChartError, match="no chart gridlines"):
        parse(chart_doc(gridlines=False))


def test_an_off_palette_bar_shaped_path_fails_loud():
    """Shape filter FIRST, then colour keying (AD-9): a four-line filled path inside the
    plot box that is neither palette colour means the home/away attribution would be a
    guess."""
    doc = chart_doc()
    page = doc[0]
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

    with pytest.raises(MomentumFillError, match="neither the home"):
        parse(doc)


def test_a_bar_shaped_path_outside_the_plot_box_is_ignored_not_a_failure():
    """The lineups page shares the chart's palette as STROKE colours on unrelated
    elements and draws its own glyphs; only the plot box keeps them out."""
    doc = chart_doc()
    page = doc[0]
    page.draw_polyline(
        [(40, 100), (60, 100), (60, 120), (40, 120), (40, 100)],
        color=None,
        fill=(0.0, 0.6, 0.2),
    )

    series = parse(doc)["series"]

    assert len(series["samples"]) == DEFAULT_MOMENTUM_SLOTS


def test_two_bars_of_one_colour_in_one_slot_fail_loud():
    doc = chart_doc()
    page = doc[0]
    pitch = momentum_pitch()
    width = 0.70 * pitch
    x0 = MOMENTUM_PLOT_X0 + 10 * pitch + (pitch - width) / 2.0
    y0 = MOMENTUM_BASELINE - 3 * momentum_unit()
    page.draw_polyline(
        [(x0, y0), (x0 + width, y0), (x0 + width, MOMENTUM_BASELINE),
         (x0, MOMENTUM_BASELINE), (x0, y0)],
        color=None,
        fill=MOMENTUM_HOME_FILL,
    )

    with pytest.raises(MomentumChartError, match="two home bars"):
        parse(doc)


def test_a_bar_off_the_baseline_fails_loud():
    doc = chart_doc()
    page = doc[0]
    pitch = momentum_pitch()
    width = 0.70 * pitch
    x0 = MOMENTUM_PLOT_X0 + 60 * pitch + (pitch - width) / 2.0
    floated = MOMENTUM_BASELINE - 4.0
    page.draw_polyline(
        [(x0, floated - momentum_unit()), (x0 + width, floated - momentum_unit()),
         (x0 + width, floated), (x0, floated), (x0, floated - momentum_unit())],
        color=None,
        fill=MOMENTUM_HOME_FILL,
    )

    with pytest.raises(MomentumChartError, match="do not share one baseline"):
        parse(doc)


def test_a_bar_of_the_wrong_width_fails_loud():
    """Bar width is 1.37-2.07 pt across the corpus, so only the RATIO is checkable; a
    fixed absolute window silently drops whole reports."""
    doc = chart_doc()
    page = doc[0]
    pitch = momentum_pitch()
    x0 = MOMENTUM_PLOT_X0 + 70 * pitch
    y1 = MOMENTUM_BASELINE + momentum_unit()  # away bars grow DOWN from the baseline
    page.draw_polyline(
        [(x0, MOMENTUM_BASELINE), (x0 + pitch * 0.4, MOMENTUM_BASELINE),
         (x0 + pitch * 0.4, y1), (x0, y1), (x0, MOMENTUM_BASELINE)],
        color=None,
        fill=MOMENTUM_AWAY_FILL,
    )

    with pytest.raises(MomentumChartError, match="of the slot pitch wide"):
        parse(doc)


def test_an_anchor_resolving_to_two_pages_fails_loud():
    doc = chart_doc()
    doc.new_page(width=960, height=540)

    with pytest.raises(MomentumChartError, match="resolves to 2 pages"):
        parse(doc, anchors={MOMENTUM_ANCHOR_ID: [0, 1]})


def test_an_unresolved_anchor_is_an_authoring_bug_not_a_keyerror():
    with pytest.raises(MomentumChartError, match="drifted apart"):
        parse(chart_doc(), anchors={})


# --- the legend proves colour -> team --------------------------------------------------


def test_the_legend_is_verified_against_the_reports_own_cover():
    with pytest.raises(MomentumChartError, match="maps the home colour"):
        parse(chart_doc(), home="Brazil")


def test_a_missing_legend_fails_loud():
    with pytest.raises(MomentumChartError, match="no home swatch"):
        parse(chart_doc(legend=False))


def test_the_legend_check_is_skipped_when_no_team_names_are_handed_in():
    series = extract_momentum(chart_doc(legend=False), {MOMENTUM_ANCHOR_ID: [0]})["series"]

    assert len(series["samples"]) == DEFAULT_MOMENTUM_SLOTS


# --- the documented-absence branch (AD-4, Task 4.4) -------------------------------------


def test_a_chart_with_no_bars_stages_none_and_a_warning_never_a_failed_check():
    result = parse(chart_doc(values={}))

    assert result["series"] is None
    assert result["warnings"] == [
        "momentum: the chart on page 0 draws no bars; the series is recorded as absent"
    ]
    # A non-"pass" check here would be read by the strictly binary aggregator as a
    # FAILURE of a report that is merely incomplete (Story 1.12's precedent).
    assert momentum_checks(result["series"]) == []


# --- self-validation checks -------------------------------------------------------------


def test_the_axis_scale_check_compares_the_printed_label_with_the_derived_peak():
    series = parse(chart_doc())["series"]

    (axis_check,) = [c for c in momentum_checks(series) if c["check"] == "momentum-axis-scale"]

    assert axis_check["result"] == "pass"
    assert axis_check["specifics"] == (
        "printed y-axis top label 5 vs derived peak value 5"
    )


def test_the_axis_scale_check_fails_when_the_two_disagree():
    """Recorded, never raised, and never loosened (SM-C1)."""
    series = dict(parse(chart_doc())["series"])
    series["axis_top_label"] = 6

    (axis_check,) = [c for c in momentum_checks(series) if c["check"] == "momentum-axis-scale"]

    assert axis_check["result"] == "fail"


# `momentum-coverage` is a backstop over the STAGED payload, not an independent
# cross-check of the parse — every clock inconsistency it can describe is already a typed
# failure in `_clock_structure`, which aborts the report before a series exists. These
# tests therefore corrupt the payload deliberately, which is the condition the check
# actually defends against. See `momentum_checks`' docstring; a code review found the
# docstrings here previously claiming independence these three cannot have.


def test_the_coverage_check_fails_when_the_staged_ft_index_is_stamped_wrong():
    series = dict(parse(chart_doc())["series"])
    series["full_time_index"] = 40

    (coverage,) = [c for c in momentum_checks(series) if c["check"] == "momentum-coverage"]

    assert coverage["result"] == "fail"
    assert "stamped minute 41 rather than 90" in coverage["specifics"]


def test_the_coverage_check_fails_when_the_staged_ft_index_is_out_of_range():
    series = dict(parse(chart_doc())["series"])
    series["full_time_index"] = len(series["samples"]) + 5

    (coverage,) = [c for c in momentum_checks(series) if c["check"] == "momentum-coverage"]

    assert coverage["result"] == "fail"
    assert "outside the" in coverage["specifics"]


def test_the_coverage_check_fails_when_the_series_does_not_open_at_kickoff():
    series = parse(chart_doc())["series"]
    series["samples"] = series["samples"][3:]

    (coverage,) = [c for c in momentum_checks(series) if c["check"] == "momentum-coverage"]

    assert coverage["result"] == "fail"
    assert "not at kick-off" in coverage["specifics"]


def test_the_coverage_check_fails_when_the_clock_does_not_advance():
    series = parse(chart_doc())["series"]
    series["samples"][5] = dict(series["samples"][5], minute=2, stoppage_minute=None)

    (coverage,) = [c for c in momentum_checks(series) if c["check"] == "momentum-coverage"]

    assert coverage["result"] == "fail"
    assert "clock does not advance" in coverage["specifics"]


def test_the_coverage_specifics_record_when_the_ft_cross_check_was_unavailable():
    """The one report that prints no FT tick must not read as a fully cross-checked one."""
    series = dict(parse(chart_doc())["series"])
    series["full_time_index"] = None

    (coverage,) = [c for c in momentum_checks(series) if c["check"] == "momentum-coverage"]

    assert coverage["result"] == "pass"
    assert "cross-check was unavailable" in coverage["specifics"]
    assert "no gaps" not in coverage["specifics"]


# --- co-tenant page content -------------------------------------------------------------
#
# In the corpus this chart sits at the FOOT of the lineups page, sharing it with Domain A's
# two team sheets, the formation diagram and the goal/card glyphs. `chart_doc` gives it a
# page to itself, which proves page-identity independence (already proved by the title
# anchor) while stripping every co-tenant the whole-page sweeps in `_plot_box`,
# `_read_axis_labels`, `_tick_runs` and `_read_legend` could collide with. A code review
# found that entire failure class resting on one real report and zero synthetic tests.


GRID_BOTTOM = MOMENTUM_GRID_TOP + 8 * MOMENTUM_GRID_STEP


def test_an_unrelated_grey_rule_elsewhere_on_the_page_does_not_abort():
    """The page carries horizontal rules that are not this chart's gridlines."""

    def decorate(page):
        page.draw_line((60, 120), (300, 120), color=(0.878, 0.878, 0.878), width=0.75)

    assert (
        parse(chart_doc(decorate=decorate))["series"]["samples"]
        == parse(chart_doc())["series"]["samples"]
    )


def test_a_second_path_in_a_chart_colour_below_the_plot_box_fails_loud():
    """Ambiguous legend swatches must not be resolved by PDF drawing order."""

    def decorate(page):
        page.draw_rect(
            pymupdf.Rect(700.0, MOMENTUM_LEGEND_Y0, 709.0, MOMENTUM_LEGEND_Y1),
            color=None,
            fill=MOMENTUM_HOME_FILL,
        )

    with pytest.raises(MomentumChartError, match="more than one path"):
        parse(chart_doc(decorate=decorate))


def test_a_second_text_line_in_the_tick_band_does_not_merge_into_the_ticks():
    """The band under the plot box is 25 pt tall — room for more than one line of text."""
    pitch = momentum_pitch(DEFAULT_MOMENTUM_SLOTS)
    centre_x = MOMENTUM_PLOT_X0 + (44 + 0.5) * pitch
    right_edge = centre_x + pymupdf.get_text_length("45", fontsize=MOMENTUM_TICK_FONTSIZE) / 2.0

    def decorate(page):
        # A digit on a LOWER line, close enough in x that merging by x alone would splice
        # it onto the 45' tick and read the pair as "457" — losing the 45' tick entirely.
        page.insert_text(
            (right_edge + 0.5, GRID_BOTTOM + 23.0), "7", fontsize=MOMENTUM_TICK_FONTSIZE
        )

    assert (
        parse(chart_doc(decorate=decorate))["series"]["samples"]
        == parse(chart_doc())["series"]["samples"]
    )


def test_the_chart_parses_identically_beside_dense_co_tenant_content():
    """All of the above at once, plus text flanking the y-axis label column."""

    def decorate(page):
        page.draw_line((60, 120), (300, 120), color=(0.878, 0.878, 0.878), width=0.75)
        page.draw_line((60, 200), (300, 200), color=(0.878, 0.878, 0.878), width=0.75)
        page.insert_text((40.0, MOMENTUM_GRID_TOP + 3.0), "11 GOALKEEPER", fontsize=8.25)
        page.insert_text((MOMENTUM_PLOT_X1 + 40.0, MOMENTUM_BASELINE), "7 FORWARD", fontsize=8.25)
        page.insert_text((MOMENTUM_PLOT_X1 + 120.0, GRID_BOTTOM + 23.0), "SUBSTITUTES", fontsize=9.0)

    assert (
        parse(chart_doc(decorate=decorate))["series"]["samples"]
        == parse(chart_doc())["series"]["samples"]
    )


# --- real-PDF ground truth (Task 7.3) ---------------------------------------------------


@pytest.fixture(scope="module")
def spike_momentum(mex_rsa_pdf):
    doc = pymupdf.open(mex_rsa_pdf)
    index = PageTextIndex(doc, REPORT_ID)
    anchors = {MOMENTUM_ANCHOR_ID: index.find_all(MOMENTUM_TITLE)}
    result = extract_momentum(
        doc, anchors, report_id=REPORT_ID, home_team="Mexico", away_team="South Africa"
    )
    yield result
    doc.close()


def test_the_title_anchor_resolves_exactly_once_on_the_ground_truth_report(mex_rsa_pdf):
    """Exactly once per report on page index 1, on 104/104 — the fact the whole parser
    is anchored on."""
    with pymupdf.open(mex_rsa_pdf) as doc:
        pages = [i for i, page in enumerate(doc) if MOMENTUM_TITLE in normalize(page.get_text())]

    assert pages == [1]


def test_the_momentum_spec_is_registered_and_resolves_on_the_ground_truth(mex_rsa_pdf):
    (spec,) = [s for s in ANCHOR_REGISTRY if s.anchor_id == MOMENTUM_ANCHOR_ID]

    assert spec.per_team is False and spec.required is True
    resolved = [
        a
        for a in resolve_anchors(ANCHOR_REGISTRY, home="Mexico", away="South Africa")
        if a.anchor_id == MOMENTUM_ANCHOR_ID
    ]
    assert [a.text for a in resolved] == [MOMENTUM_TITLE]


def test_ground_truth_series_matches_the_measured_corpus_figures(spike_momentum):
    """Measured on the real report at story creation and re-measured by this story's own
    104-report sweep: 50 home bars, 41 away bars, unit 5.038 pt, peak 10, home sum 138,
    away sum 78, 101 slots."""
    series = spike_momentum["series"]
    samples = series["samples"]

    assert len(samples) == 101
    assert series["axis_top_label"] == 10
    assert series["extra_time"] is False
    assert series["full_time_index"] == 100
    assert sum(1 for s in samples if s["home"]) == 50
    assert sum(1 for s in samples if s["away"]) == 41
    assert sum(s["home"] for s in samples) == 138
    assert sum(s["away"] for s in samples) == 78
    assert max(max(s["home"], s["away"]) for s in samples) == 10


def test_ground_truth_clock_stamps_span_kickoff_to_full_time(spike_momentum):
    mapping = stamps(spike_momentum["series"])

    assert mapping[0] == (1, None)
    assert mapping[44] == (45, None)
    assert mapping[45:49] == [(45, 1), (45, 2), (45, 3), (45, 4)]
    assert mapping[49] == (46, None)
    assert mapping[93] == (90, None)
    assert mapping[-1] == (90, 7)
    assert len(set(mapping)) == len(mapping)  # every stamp distinct


def test_ground_truth_self_validation_passes(spike_momentum):
    checks = momentum_checks(spike_momentum["series"])

    assert [c["check"] for c in checks] == ["momentum-axis-scale", "momentum-coverage"]
    assert all(c["result"] == "pass" for c in checks)
    assert spike_momentum["warnings"] == []

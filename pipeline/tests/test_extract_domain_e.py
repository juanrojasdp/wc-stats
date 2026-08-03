"""Story 1.9, Domain E: the four goalkeeping page families (AC 1, AC 3, AC 4).

Domain E is four different extraction problems under one name — one table page, one
half-table page, one marker MAP page and one per-minute CHART page — so the sections below
follow that split rather than the payload's.

Expected values are derived from what the factory drew (`default_goalkeeping_blocks`),
never restated as a second literal (the 1.6/1.7/1.10 review rule).
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.probe import probe_report
from pipeline.discover.text import PageTextIndex
from pipeline.extract.domain_a import extract_domain_a
from pipeline.extract.domain_e import (
    AERIAL_DELIVERY_TYPES,
    DISTRIBUTION_MARKER_SPEC,
    DISTRIBUTION_PRINTED_MAX_OVERSHOOT,
    DISTRIBUTION_PRINTED_PANELS,
    DOCUMENTED_ABSENCES,
    INTERVENTION_TYPES,
    domain_e_checks,
    domain_e_goalkeeper_warnings,
    domain_e_warnings,
    extract_domain_e,
)
from pipeline.extract.errors import (
    GoalkeepingPageParseError,
    InvolvementChartError,
    InvolvementClockError,
    MalformedFieldError,
    MissingFieldError,
)
from pipeline.markers.errors import PitchFrameError, UnknownRgbError

from pipeline.tests.conftest import (
    AERIAL_TOTAL_LAYOUT,
    DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT,
    DEFAULT_GK_INVOLVEMENT_TOP_LABEL,
    EF_LABEL_FONTSIZE,
    GK_DISTRIBUTION_DONUT_XS,
    GK_DISTRIBUTION_PANELS,
    GK_INVOLVEMENT_CHART_TOPS,
    GK_INVOLVEMENT_GRID_STROKE,
    GK_INVOLVEMENT_PLOT_X0,
    GK_INVOLVEMENT_PLOT_X1,
    GK_INVOLVEMENT_UNIT,
    _ef_centred,
    default_gk_involvement_block,
    default_goalkeeping_blocks,
    default_lineup_sides,
    gk_involvement_ticks,
    lineup_entry,
    lineup_side,
)

REPORT_NAME = "PMSR-M01-MEX-V-RSA.pdf"
ANCHOR_IDS = (
    "lineups",
    "gk-involvement",
    "gk-distribution:home",
    "gk-distribution:away",
    "goal-prevention:home",
    "goal-prevention:away",
    "aerial-control:home",
    "aerial-control:away",
)


def _extract(path: Path) -> dict:
    """Run Domain E over a built report, resolving only the anchors it reads."""
    meta = probe_report(path)
    with pymupdf.open(path) as doc:
        index = PageTextIndex(doc, meta.report_id)
        anchors = {
            anchor.anchor_id: index.find_all(anchor.text, at_start=anchor.at_page_start)
            for anchor in resolve_anchors(
                ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team
            )
            if anchor.anchor_id in ANCHOR_IDS
        }
        metadata = {
            "home_team": meta.home_team,
            "away_team": meta.away_team,
            "home_score": meta.home_score,
            "away_score": meta.away_score,
            "stage_text": meta.stage_text,
            "match_date": meta.match_date.isoformat(),
            "kickoff": meta.kickoff,
            "venue": meta.venue,
            "shootout": meta.shootout,
        }
        domain_a = extract_domain_a(doc, metadata, anchors, report_id=meta.report_id)
        return extract_domain_e(
            doc,
            anchors,
            domain_a["lineups"],
            report_id=meta.report_id,
            home_team=meta.home_team,
            away_team=meta.away_team,
        )


@pytest.fixture
def build(make_report, tmp_path):
    counter = {"n": 0}

    def _build(**kwargs) -> Path:
        counter["n"] += 1
        return make_report(tmp_path / f"{counter['n']:02d}" / REPORT_NAME, **kwargs)

    return _build


def _check(checks, check_id):
    return next(check for check in checks if check["check"] == check_id)


# --- the happy path, per family ---------------------------------------------------------


def test_both_sides_carry_all_four_families(build):
    payload = _extract(build())

    assert set(payload) == {"home", "away"}
    for side in ("home", "away"):
        assert set(payload[side]) == {
            "goalkeepers",
            "total_involvements",
            "involvement_series",
            "involvement_clock",
            "distribution",
            "goal_prevention",
            "aerial_control",
        }


def test_goal_prevention_reads_the_seven_column_table(build):
    payload = _extract(build())

    for side in ("home", "away"):
        expected = default_goalkeeping_blocks(side)["goal_prevention"]
        block = payload[side]["goal_prevention"]
        assert block["attempts_faced"] == expected["attempts_faced"]
        assert block["total_interventions"] == expected["total_interventions"]
        assert block["by_intervention_type"] == expected["by_intervention_type"]
        assert block["attempts_faced_printed"] == expected["attempts_faced_printed"]


def test_goal_prevention_survives_the_stray_ordinal_left_of_the_table(build):
    """The corpus trap (PMSR-M38-ESP-V-KSA home): a pitch-marker ordinal prints at x=275
    on the table's OWN row, so the row carries eight spans and a naive "row of seven
    digits" finds none. Only the `x >= 460` bound survives it — the fixture draws it by
    default, so this passing at all IS the regression guard."""
    with_stray = _extract(build())
    without = _extract(build(goal_prevention_stray_ordinal=False))

    assert with_stray == without


def test_save_percentage_is_a_float_on_the_zero_to_hundred_scale(build):
    """AD-7: the page prints it WITHOUT a '%' sign, unlike every Domain B/G percentage."""
    payload = _extract(build())

    assert payload["home"]["goal_prevention"]["save_percentage"] == 80.0
    assert payload["away"]["goal_prevention"]["save_percentage"] == 66.7
    for side in ("home", "away"):
        assert isinstance(payload[side]["goal_prevention"]["save_percentage"], float)


def test_the_goal_prevention_donut_centres_are_ignored(build):
    """Task 3.5: they are in the text layer and they are NOT trustworthy — on PMSR-M01 the
    Intervention Type donut reads 4 against a table of 3. The fixture draws them
    deliberately wrong, so a parser that ever read them would disagree with the table."""
    payload = _extract(build())

    for side in ("home", "away"):
        block = payload[side]["goal_prevention"]
        assert block["attempts_faced"] not in (9, 8)
        assert block["total_interventions"] not in (9, 8)


def test_aerial_control_reads_the_tiles_and_the_delivery_table(build):
    payload = _extract(build())

    for side in ("home", "away"):
        expected = default_goalkeeping_blocks(side)["aerial_control"]
        block = payload[side]["aerial_control"]
        assert block["total_interventions"] == expected["total_interventions"]
        for key in ("punches", "claims", "tipped_palmed"):
            assert block[key] == expected[key]
        assert block["delivery_types_faced"] == expected["delivery_types_faced"]
        assert block["crosses_faced_attempted"] == expected["delivery_types_faced"]["total"]


def test_distribution_counts_markers_per_titled_panel(build):
    payload = _extract(build())

    for side in ("home", "away"):
        drawn = default_goalkeeping_blocks(side)["distribution"]["markers"]
        block = payload[side]["distribution"]
        for key in DISTRIBUTION_PRINTED_PANELS:
            markers = drawn[key]
            assert block[key]["total"] == len(markers)
            assert block[key]["complete"] == sum(
                1 for *_xy, outcome in markers if outcome == "complete"
            )
            assert block[key]["incomplete"] == sum(
                1 for *_xy, outcome in markers if outcome == "incomplete"
            )
            assert block[key]["printed_total"] == len(markers)
        # The Total Distributions panel is the union of the other three and prints NO
        # donut centre of its own.
        assert block["total"]["total"] == sum(len(drawn[key]) for key in DISTRIBUTION_PRINTED_PANELS)
        assert block["total"]["printed_total"] is None
        assert block["line_breaks"] == default_goalkeeping_blocks(side)["distribution"]["line_breaks"]


def test_the_distribution_legend_and_pitch_spots_are_never_counted(build):
    """The 9.0 pt legend swatches sit 10.5 pt below every frame and the white penalty and
    centre spots sit inside it. Both are excluded — the swatches twice over, by the size
    window and by the pitch margin — so dropping EITHER must change nothing.

    Both halves are exercised. Dropping only the legend left the spots drawn on every run,
    so the docstring's second claim went untested while reading as if it were covered.
    """
    with_furniture = _extract(build())

    assert _extract(build(gk_distribution_legend=False)) == with_furniture
    assert _extract(build(gk_distribution_spots=False)) == with_furniture
    assert (
        _extract(build(gk_distribution_legend=False, gk_distribution_spots=False))
        == with_furniture
    )


def test_the_pitch_margin_admits_a_marker_that_overshoots_its_frame(build):
    """Story 1.11's touchline finding, here: eight corpus team-innings print a
    distribution dot whose centre falls up to 0.29 pt below its frame, and on seven of
    them admitting it is what makes the panel match its printed donut centre."""
    assert 0.0 < DISTRIBUTION_MARKER_SPEC.pitch_margin_pt <= 1.0

    panel = GK_DISTRIBUTION_PANELS[0][1]

    def decorate(page):
        # A marker centred 0.25 pt BELOW the feet panel's bottom edge — inside the margin.
        page.draw_circle(
            ((panel[0] + panel[2]) / 2, panel[3] + 0.25), 2.9145,
            color=(1.0, 1.0, 1.0), fill=(0.18, 0.30, 1.00), width=0.75,
        )

    payload = _extract(build(gk_distribution_decorate=decorate))
    baseline = _extract(build())

    assert (
        payload["home"]["distribution"]["feet"]["total"]
        == baseline["home"]["distribution"]["feet"]["total"] + 1
    )


def test_involvement_reads_one_value_per_slot_for_both_teams(build):
    payload = _extract(build())

    for side in ("home", "away"):
        expected = default_goalkeeping_blocks(side)["involvement"]
        assert payload[side]["involvement_series"] == expected["series"]
        assert payload[side]["total_involvements"] == expected["total_involvements"]


def test_involvement_charts_are_keyed_by_their_printed_title_not_position(build):
    """AD-8: ONE page carries both charts, and only the printed
    `'{team} GK Involvement Timeline'` says which is which. Printing the AWAY chart on top
    must change nothing about the payload — a parser reading top-then-bottom would swap
    the two series here and pass everywhere else."""
    straight = _extract(build())
    reversed_page = _extract(build(gk_involvement_reverse=True))

    assert reversed_page["home"]["involvement_series"] == straight["home"]["involvement_series"]
    assert reversed_page["away"]["involvement_series"] == straight["away"]["involvement_series"]
    assert (
        reversed_page["home"]["involvement_series"]
        != reversed_page["away"]["involvement_series"]
    )


def test_the_involvement_slot_count_is_per_report(build):
    """95-111 regulation and 129-145 extra time on the corpus — never hard-coded."""
    payload = _extract(build())

    assert len(payload["home"]["involvement_series"]) == 100
    assert len(payload["away"]["involvement_series"]) == 100


# --- the goalkeeper attribution (Task 4, AC 1's re-scope) --------------------------------


def test_the_goalkeeper_list_is_carried_from_the_lineups(build):
    payload = _extract(build())

    for side in ("home", "away"):
        keepers = payload[side]["goalkeepers"]
        assert [keeper["shirt_number"] for keeper in keepers] == [1]
        assert keepers[0]["name"] == "Test ALPHA"
        assert keepers[0]["substituted_on"] is None


def test_a_two_goalkeeper_inning_parses_clean_with_two_names(build):
    """AC 1's re-scope, and the single easiest thing to get wrong: 7 of 208 corpus
    team-innings used TWO keepers and their pages still print ONE team-level block each.
    Two names must be carried, no page data joined to either, and NO finding raised."""
    home = lineup_side("Mexico")
    # The reserve keeper comes on for the starter, exactly as PMSR-M53 away prints it.
    home["starters"][0]["markers"].append(("sub-off", "78'"))
    home["substitutes"][0]["markers"].append(("sub-on", "78'"))
    home["starters"][5]["markers"].append(("goal", "12'"))
    home["starters"][6]["markers"].append(("goal", "40'"))
    _default_home, away = default_lineup_sides("Mexico", "South Africa", 2, 0)

    payload = _extract(build(lineup_sides=(home, away)))

    keepers = payload["home"]["goalkeepers"]
    assert [keeper["shirt_number"] for keeper in keepers] == [1, 12]
    assert keepers[0]["substituted_off"] is not None
    assert keepers[1]["substituted_on"] is not None
    # The team block is unchanged: nothing is keyed on, or split between, the two keepers.
    assert payload["home"]["distribution"] == _extract(build())["home"]["distribution"]
    assert all(check["result"] == "pass" for check in domain_e_checks(payload))


def test_an_unused_reserve_keeper_is_not_listed(build):
    """`has_minutes` is Story 1.10's rule verbatim: a substitute took the field exactly
    when the lineup page stamped a sub-on minute on them. The default reserve keeper has
    none."""
    payload = _extract(build())

    assert len(payload["home"]["goalkeepers"]) == 1


def test_a_side_with_no_goalkeeper_raises(build):
    """208/208 corpus team-innings field at least one — but the check is `>= 1`, never
    `== 1`, because exactly-one is corpus-FALSE on seven of them."""
    home = lineup_side("Mexico")
    home["starters"][0] = lineup_entry(1, "DF", "Test ALPHA")
    home["substitutes"][0] = lineup_entry(12, "DF", "Test LIMA")
    home["starters"][5]["markers"].append(("goal", "12'"))
    home["starters"][6]["markers"].append(("goal", "40'"))
    _default_home, away = default_lineup_sides("Mexico", "South Africa", 2, 0)

    with pytest.raises(MissingFieldError, match="no goalkeeper"):
        _extract(build(lineup_sides=(home, away)))


# --- typed failure paths -----------------------------------------------------------------


def test_an_anchor_resolving_to_two_pages_raises(build):
    with pytest.raises(GoalkeepingPageParseError, match="resolves to 2 pages"):
        _extract(build(gk_distribution_extra_pages={"home": 1}))


def test_an_involvement_anchor_resolving_to_two_pages_raises(build):
    with pytest.raises(GoalkeepingPageParseError, match="resolves to 2 pages"):
        _extract(build(gk_involvement_extra_pages=1))


def test_a_missing_table_header_raises(build):
    """AD-8: the header band text is a closed constant asserted by EQUALITY, so a
    reworded or dropped column is a template revision that fails loud."""
    with pytest.raises(GoalkeepingPageParseError, match="Total Attempts on Goal"):
        _extract(build(goal_prevention_header=False))


def test_a_missing_aerial_header_raises(build):
    with pytest.raises(GoalkeepingPageParseError, match="In Swing"):
        _extract(build(aerial_header=False))


def test_a_table_row_with_the_wrong_value_count_raises(build):
    blocks = default_goalkeeping_blocks("home")
    del blocks["goal_prevention"]["by_intervention_type"]["save_attempt"]

    with pytest.raises(GoalkeepingPageParseError, match=r"carries 6 value\(s\)"):
        _extract(build(goalkeeping_blocks={"home": blocks}))


def test_a_non_numeric_token_in_a_table_is_MALFORMED_not_a_count_error(build):
    """A `-` where a value belongs names the malformed token, not a short row.

    The pre-filter used to drop the token before it could be typed, so the row failed the
    COUNT assertion ("carries 6 value(s)") and pointed a gate operator at a template
    revision instead of at the unreadable value printed right there. `errors.py`'s
    malformed-vs-missing rule is the reason this distinction is load-bearing.
    """
    blocks = default_goalkeeping_blocks("away")
    blocks["aerial_control"]["delivery_types_faced"]["driven"] = "-"

    with pytest.raises(MalformedFieldError, match=r"is not a non-negative integer: '-'"):
        _extract(build(goalkeeping_blocks={"away": blocks}))


def test_a_decimal_token_in_a_table_is_also_malformed(build):
    """The other half of the same rule: a decimal is present-but-wrong-type, not absent."""
    blocks = default_goalkeeping_blocks("home")
    blocks["goal_prevention"]["by_intervention_type"]["save_attempt"] = "1.5"

    with pytest.raises(MalformedFieldError, match=r"is not a non-negative integer: '1\.5'"):
        _extract(build(goalkeeping_blocks={"home": blocks}))


def test_a_non_numeric_kpi_value_raises(build):
    blocks = default_goalkeeping_blocks("home")
    blocks["goal_prevention"]["save_percentage"] = 140

    with pytest.raises(MalformedFieldError, match="outside 0-100"):
        _extract(build(goalkeeping_blocks={"home": blocks}))


def test_a_page_with_no_pitch_panel_raises_the_chains_own_error(build):
    """The shared chain's typed errors travel as themselves (the 1.11/1.12 precedent), so
    the gate keeps mapping them the way it already does."""
    with pytest.raises(PitchFrameError):
        _extract(build(gk_distribution_panels=()))


def test_a_panel_count_other_than_four_raises(build):
    with pytest.raises(GoalkeepingPageParseError, match="carries 3 pitch panels"):
        _extract(build(gk_distribution_panels=GK_DISTRIBUTION_PANELS[:3]))


def test_an_unknown_panel_title_raises(build):
    titles = {key: title for key, title in
              zip(("feet", "hands", "throw", "total"),
                  ("Kick from Feet", "Kick from Hands", "Throw Distribution", "Everything"))}

    with pytest.raises(GoalkeepingPageParseError, match="Total Distributions"):
        _extract(build(gk_distribution_titles=titles))


def test_an_off_palette_distribution_marker_raises_unknown_rgb(build):
    """Geometry before colour (AD-9): colour never filters, it only names what geometry
    already admitted, and a miss is loud rather than a nearest-colour match."""
    with pytest.raises(UnknownRgbError):
        _extract(build(gk_distribution_off_palette=True))


def test_a_non_integral_involvement_slot_raises(build):
    """A dot that does not land on a value gridline means the scale is not what the
    printed axis says — and a silently wrong unit multiplies the whole series."""
    with pytest.raises(InvolvementChartError, match="not an integer"):
        _extract(build(gk_involvement_dot_offsets={("home", 12): -5.0}))


def test_a_dot_below_the_zero_line_raises(build):
    """Slot 30 of the away chart is a zero, so a full unit DOWN puts it at -1 — integral,
    and therefore only reachable by the range guard."""
    with pytest.raises(InvolvementChartError, match="BELOW the zero line"):
        _extract(build(gk_involvement_dot_offsets={("away", 30): 15.4403}))


def test_a_dot_above_the_printed_axis_top_raises(build):
    """The chart auto-scales so the peak fills the axis; a dot above the top label means
    the printed axis no longer describes the series."""
    with pytest.raises(InvolvementChartError, match="above the printed axis top label"):
        _extract(build(gk_involvement_dot_offsets={("home", 19): -15.4403}))


# --- the involvement chart's TIME axis (Decision 3) ---------------------------------------
#
# Every mapping below is derived from the chart's own printed x-ticks. The fixture's tick
# row moves with the clock structure it is given, so a parser that ignored the ticks and
# assumed a fixed layout would fail every extra-time case here.


def _involvement_blocks(**clock):
    """Both sides' goalkeeping blocks with one clock structure applied to both charts."""
    blocks = {side: default_goalkeeping_blocks(side) for side in ("home", "away")}
    for side in ("home", "away"):
        blocks[side]["involvement"] = default_gk_involvement_block(side, **clock)
    return blocks


def test_the_clock_stamps_every_slot_from_the_printed_ticks(build):
    """The default fixture is the reference report's own structure: 100 slots with match
    minute 46 on slot 49, so 4 first-half and 6 second-half stoppage minutes."""
    payload = _extract(build())

    for side in ("home", "away"):
        clock = payload[side]["involvement_clock"]
        stamps = clock["stamps"]

        assert clock["second_half_slot"] == DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT
        assert clock["first_extra_slot"] is None
        assert clock["second_extra_slot"] is None
        assert len(stamps) == len(payload[side]["involvement_series"])
        assert stamps[0] == {"minute": 1, "stoppage_minute": None}
        assert stamps[44] == {"minute": 45, "stoppage_minute": None}
        assert stamps[45] == {"minute": 45, "stoppage_minute": 1}
        assert stamps[49] == {"minute": 46, "stoppage_minute": None}
        assert stamps[93] == {"minute": 90, "stoppage_minute": None}
        assert stamps[-1] == {"minute": 90, "stoppage_minute": 6}


def test_the_clock_follows_this_reports_own_stoppage_rather_than_a_fixed_layout(build):
    """The same chart with a different half-time boundary maps to different minutes.

    This is the whole reason the mapping is derived: everything after half time shifts by
    that report's own allotment, so a parser using a fixed formula would stage minute 46 on
    slot 49 here too.
    """
    payload = _extract(build(goalkeeping_blocks=_involvement_blocks(second_half_slot=52)))

    for side in ("home", "away"):
        stamps = payload[side]["involvement_clock"]["stamps"]
        assert payload[side]["involvement_clock"]["second_half_slot"] == 52
        assert stamps[45] == {"minute": 45, "stoppage_minute": 1}
        assert stamps[51] == {"minute": 45, "stoppage_minute": 7}
        assert stamps[52] == {"minute": 46, "stoppage_minute": None}
        assert stamps[-1] == {"minute": 90, "stoppage_minute": 3}


def test_an_extra_time_chart_maps_both_extra_periods(build):
    """A 138-slot extra-time chart, the shape of `PMSR-M104-ESP-V-ARG`: minute 91 on slot
    102 and minute 106 on slot 118, with the grid running to `120+5`."""
    payload = _extract(
        build(
            goalkeeping_blocks=_involvement_blocks(
                slots=138, second_half_slot=49, first_extra_slot=102, second_extra_slot=118
            )
        )
    )

    for side in ("home", "away"):
        clock = payload[side]["involvement_clock"]
        stamps = clock["stamps"]

        assert (clock["first_extra_slot"], clock["second_extra_slot"]) == (102, 118)
        assert stamps[101] == {"minute": 90, "stoppage_minute": 8}
        assert stamps[102] == {"minute": 91, "stoppage_minute": None}
        assert stamps[116] == {"minute": 105, "stoppage_minute": None}
        assert stamps[117] == {"minute": 105, "stoppage_minute": 1}
        assert stamps[118] == {"minute": 106, "stoppage_minute": None}
        assert stamps[132] == {"minute": 120, "stoppage_minute": None}
        assert stamps[-1] == {"minute": 120, "stoppage_minute": 5}


def test_a_first_extra_period_drawn_short_parses_and_is_recorded(build):
    """`PMSR-M88-AUS-V-EGY`'s chart, pinned.

    Both of its charts draw a 14-slot first extra period: no `105'` tick is printed and the
    `110'` tick sits one slot earlier than a 15-minute ET1 would put it. The page is
    internally consistent and simply says minute 105 has no slot, so it parses — asserting
    football over the source would fail a report the source states plainly — and the short
    period is recorded in the check's specifics on every report instead.
    """
    payload = _extract(
        build(
            goalkeeping_blocks=_involvement_blocks(
                slots=131, second_half_slot=49, first_extra_slot=100, second_extra_slot=114
            )
        )
    )

    stamps = payload["home"]["involvement_clock"]["stamps"]
    assert stamps[113] == {"minute": 104, "stoppage_minute": None}
    assert stamps[114] == {"minute": 106, "stoppage_minute": None}  # minute 105 has no slot

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")
    assert check["result"] == "pass"
    assert "ET1 drawn SHORT at 14/15 slots" in check["specifics"]


def test_the_clock_check_records_every_periods_stoppage(build):
    check = _check(domain_e_checks(_extract(build())), "goalkeeping-involvement-clock")

    assert check["result"] == "pass"
    for side in ("home", "away"):
        assert f"{side}: 100 slots, 1..90+6, H1 +4, H2 +6" in check["specifics"]


# --- the clock check's FAIL branches (Task 8.3) ------------------------------------------
#
# Every clock test above this point drives `InvolvementClockError` out of the PARSER, which
# is a different code path: the parse aborts and `domain_e_checks` is never reached. So none
# of them covers this check's predicate, and the predicate is the part that runs against a
# STAGED record — where the parser's invariants no longer hold by construction. The
# mutations below are the only way in, and each one targets a single clause.


def test_the_clock_check_fails_when_the_series_does_not_open_at_kick_off(build):
    payload = _extract(build())
    payload["home"]["involvement_clock"]["stamps"][0] = {"minute": 2, "stoppage_minute": None}

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "home: series opens at 2, not kick-off" in check["specifics"]


def test_the_clock_check_fails_when_the_clock_does_not_advance(build):
    payload = _extract(build())
    stamps = payload["away"]["involvement_clock"]["stamps"]
    stamps[60] = dict(stamps[59])

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "away: clock does not advance at" in check["specifics"]


def test_the_clock_check_fails_when_the_series_ends_outside_its_final_period(build):
    payload = _extract(build())
    # Past the closing period rather than before it, so the mutation still ADVANCES on the
    # preceding stamp and this clause is reached rather than the monotonicity one.
    payload["home"]["involvement_clock"]["stamps"][-1] = {
        "minute": 121, "stoppage_minute": None
    }

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "home: series ends at 121, outside the closing 46'-90' period" in check["specifics"]


def test_a_short_second_extra_period_is_recorded_not_failed(build):
    """The mirror of the ET1 case above, and the reason the predicate asks for the final
    PERIOD rather than for minute 120 exactly.

    An earlier form compared `stamps[-1]["minute"] != 120`, which passed a short ET1 (whose
    last stamp is still minute 120) and FAILED a short ET2 — the same page shape judged two
    ways, and the opposite of the policy the check's own comment states.
    """
    payload = _extract(
        build(
            goalkeeping_blocks=_involvement_blocks(
                slots=129, second_half_slot=49, first_extra_slot=100, second_extra_slot=115
            )
        )
    )

    stamps = payload["home"]["involvement_clock"]["stamps"]
    assert stamps[-1] == {"minute": 119, "stoppage_minute": None}  # ET2 one slot short

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")
    assert check["result"] == "pass"
    assert "ET2 drawn SHORT at 14/15 slots" in check["specifics"]


def test_the_clock_check_fails_when_a_boundary_field_disagrees_with_its_own_stamps(build):
    """The backstop's whole subject is corruption of the staged block between parse and
    record — so a boundary field the predicate never reads is the one it most needs to.

    Before this clause existed the mutation below PASSED, while `specifics` reported period
    lengths derived from the wrong slot: a green check carrying visibly wrong numbers.
    """
    payload = _extract(build())
    payload["home"]["involvement_clock"]["second_half_slot"] = 60

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "home: second_half_slot is slot 60, which the staged stamps put at 57" in (
        check["specifics"]
    )


def test_the_clock_check_fails_when_a_boundary_field_lands_outside_the_stamps(build):
    payload = _extract(build())
    payload["away"]["involvement_clock"]["second_half_slot"] = 900

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "away: second_half_slot is slot 900, outside the 100 staged stamps" in (
        check["specifics"]
    )


def test_the_clock_check_records_the_passing_sides_facts_when_the_other_side_fails(build):
    """The delta-absorption shape this story's 2026-07-27 review patched twice, and which
    the clock check reintroduced: a `continue` past `clock_facts.append` on the failing
    side. The allotments are promised on EVERY report, passing or not."""
    payload = _extract(build())
    payload["home"]["involvement_clock"]["stamps"] = []

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "home: no clock stamps staged" in check["specifics"]
    # The failing side still contributes a fact, and the passing side keeps its allotments.
    assert "home: 0 slots, no clock" in check["specifics"]
    assert "away: 100 slots, 1..90+6, H1 +4, H2 +6" in check["specifics"]
    # No dangling separator on either end.
    assert not check["specifics"].endswith(" | ")
    assert " |  " not in check["specifics"]


def test_the_clock_check_fails_rather_than_raising_on_an_empty_staged_block(build):
    """`stamps == []` alongside an equally empty series passes a bare length-equality guard
    and then indexes `stamps[0]`. An `IndexError` escaping here is a non-`PipelineError`
    that neither gate handler is written for — a recordable failure turned into a crash."""
    payload = _extract(build())
    payload["home"]["involvement_clock"]["stamps"] = []
    payload["home"]["involvement_series"] = []

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "home: no clock stamps staged" in check["specifics"]


def test_the_clock_check_fails_when_only_one_extra_boundary_is_staged(build):
    """`first_extra_slot` set with `second_extra_slot` `None` reaches a `None` subtraction
    in `_period_notes` — a `TypeError` out of the check runner, not a recorded failure."""
    payload = _extract(build())
    payload["away"]["involvement_clock"]["first_extra_slot"] = 95

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "away: extra-time boundaries staged inconsistently" in check["specifics"]


def test_the_clock_check_fails_when_the_stamps_do_not_cover_the_series(build):
    payload = _extract(build())
    payload["home"]["involvement_series"] = payload["home"]["involvement_series"][:-1]

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-clock")

    assert check["result"] == "fail"
    assert "home: 100 clock stamps against 99 plotted slots" in check["specifics"]


def test_a_chart_with_no_x_ticks_raises(build):
    with pytest.raises(InvolvementClockError, match="prints no x-tick labels"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=())))


def test_a_tick_off_the_slot_grid_raises(build):
    """A tick centred between two slots means the tick row and the dot grid were laid out
    against different scales — the one thing that could shift a whole period by a minute
    with nothing else disagreeing."""
    ticks = [
        (slot + 0.4, label) if label == "HT" else (slot, label)
        for slot, label in gk_involvement_ticks(100, DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT)
    ]

    with pytest.raises(InvolvementClockError, match="is not a slot centre"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=ticks)))


def test_an_unknown_tick_label_raises(build):
    """Closed grammar, assert-on-unknown (AD-8). Ignoring a label this parser cannot read
    would silently drop whichever boundary it was the only witness to."""
    ticks = [
        (slot, "FT" if label == "HT" else label)
        for slot, label in gk_involvement_ticks(100, DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT)
    ]

    with pytest.raises(InvolvementClockError, match="is neither a minute"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=ticks)))


def test_a_tick_printed_twice_raises(build):
    """Whichever period it pins becomes ambiguous, and no printed counterpart on the page
    could catch the wrong choice."""
    ticks = list(gk_involvement_ticks(100, DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT))
    ticks.append((60, "HT"))

    with pytest.raises(InvolvementClockError, match="more than once"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=ticks)))


def test_second_half_ticks_that_disagree_raise(build):
    """Every second-half tick pins the same boundary; the redundancy is the assertion."""
    ticks = [
        (slot + 1, label) if label == "70" else (slot, label)
        for slot, label in gk_involvement_ticks(100, DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT)
    ]

    with pytest.raises(InvolvementClockError, match="disagree on where the second half"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=ticks)))


def test_a_missing_origin_tick_raises(build):
    """Without the `0` tick the whole grid could be shifted and every later assertion
    would still pass."""
    ticks = [
        (slot, label)
        for slot, label in gk_involvement_ticks(100, DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT)
        if label != "0"
    ]

    with pytest.raises(InvolvementClockError, match="origin tick"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=ticks)))


def test_a_first_half_tick_on_the_wrong_slot_raises(build):
    ticks = [
        (slot + 2, label) if label == "30" else (slot, label)
        for slot, label in gk_involvement_ticks(100, DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT)
    ]

    with pytest.raises(InvolvementClockError, match=r"first-half x-tick 30' sits at slot 31"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=ticks)))


def test_a_stoppage_tick_on_the_wrong_slot_raises(build):
    ticks = [
        (slot + 1, label) if label == "90+5" else (slot, label)
        for slot, label in gk_involvement_ticks(100, DEFAULT_GK_INVOLVEMENT_SECOND_HALF_SLOT)
    ]

    with pytest.raises(InvolvementClockError, match=r"x-tick '90\+5' sits at slot 99"):
        _extract(build(goalkeeping_blocks=_involvement_blocks(ticks=ticks)))


def test_ticks_for_only_one_extra_period_raise(build):
    """Guessing the missing boundary from a 15-minute assumption is exactly what the
    `PMSR-M88` chart shows to be wrong, so one period's ticks alone are refused."""
    ticks = [
        (slot, label)
        for slot, label in gk_involvement_ticks(138, 49, 102, 118)
        if label not in ("110", "115", "120", "120+5")
    ]

    with pytest.raises(InvolvementClockError, match="only one extra period"):
        _extract(
            build(
                goalkeeping_blocks=_involvement_blocks(
                    slots=138, second_half_slot=49, first_extra_slot=102,
                    second_extra_slot=118, ticks=ticks,
                )
            )
        )


def test_a_first_half_stoppage_past_the_contract_bound_raises(build):
    """A half-time boundary far down the grid stages `stoppage_minute` values the
    contract's `StoppageMinute` cannot express, and nothing between here and Story 1.16's
    emit boundary would notice.

    The `M+N` stoppage ticks are dropped: at 140 slots the plot box gives each slot 5.2 pt,
    so stoppage labels 5 slots apart overprint each other into one unreadable run. The
    corpus never comes close (H1 stoppage measures 0-10, H2 1-19), which is the point —
    this bound guards a state no real page reaches.
    """
    ticks = [
        (slot, label) for slot, label in gk_involvement_ticks(140, 80) if "+" not in label
    ]

    with pytest.raises(InvolvementClockError, match="first-half stoppage minutes, past"):
        _extract(
            build(
                goalkeeping_blocks=_involvement_blocks(
                    slots=140, second_half_slot=80, ticks=ticks
                )
            )
        )


def test_the_tick_reader_splits_a_merged_45ht_span(tmp_path):
    """pymupdf merges adjacent same-font inserts, and two corpus reports
    (`PMSR-M86-ARG-V-CPV`, `PMSR-M100-ARG-V-SUI`) hand back a single `'45HT'` span whose
    centre is neither tick's — read span-level those four charts fail on a page that is
    perfectly well formed. The reader is character-level and splits on the digit-class
    boundary, with `+` folded in WITH the digits so `90+5` stays one label.
    """
    from pipeline.extract.domain_e import _tick_runs

    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    page.insert_text((100.0, 200.0), "45HT", fontsize=8)
    page.insert_text((300.0, 200.0), "90+5", fontsize=8)

    runs = _tick_runs(page, 0.0, 960.0, 150.0, 250.0, "involvement chart", None)
    doc.close()

    assert [label for label, _x in runs] == ["45", "HT", "90+5"]
    # And the two halves keep their OWN centres — the whole point of splitting.
    centres = dict(runs)
    assert centres["45"] < centres["HT"] < centres["90+5"]


def _anchors_for(path):
    """The nine Domain E/F anchors for a built report, resolved."""
    meta = probe_report(path)
    doc = pymupdf.open(path)
    index = PageTextIndex(doc, meta.report_id)
    anchors = {
        anchor.anchor_id: index.find_all(anchor.text, at_start=anchor.at_page_start)
        for anchor in resolve_anchors(
            ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team
        )
        if anchor.anchor_id in ANCHOR_IDS
    }
    return doc, meta, anchors


def test_the_missing_team_names_are_refused(build):
    """The involvement page carries BOTH charts and names them only in their titles, so
    the cover names are required rather than optional.

    Two layers, and both are asserted: omitting them is a `TypeError` from the signature
    (they are keyword-only and carry no default, so the requirement is structural rather
    than only a runtime guard), and passing them empty still hits the typed guard.
    """
    doc, meta, anchors = _anchors_for(build())
    with doc:
        with pytest.raises(TypeError, match="home_team"):
            extract_domain_e(doc, anchors, {}, report_id=meta.report_id)
        with pytest.raises(GoalkeepingPageParseError, match="cover team names"):
            extract_domain_e(
                doc, anchors, {}, report_id=meta.report_id, home_team="", away_team=""
            )


def test_a_lineups_shape_change_is_typed_not_a_bare_keyerror(build):
    """Domain E reads a SIBLING domain's payload, so its shape is guarded.

    A bare `KeyError` here is neither an `ExtractError` nor a `PipelineError`, so it
    escapes both gate handlers and records one root cause under two check ids. Typed, it
    is one `MalformedFieldError` naming the key that went missing.
    """
    doc, meta, anchors = _anchors_for(build())
    with doc:
        with pytest.raises(MalformedFieldError, match="no 'home'.'starters' section"):
            extract_domain_e(
                doc,
                anchors,
                {"home": {}, "away": {}},
                report_id=meta.report_id,
                home_team=meta.home_team,
                away_team=meta.away_team,
            )
        with pytest.raises(MalformedFieldError, match="is missing"):
            extract_domain_e(
                doc,
                anchors,
                {
                    side: {"starters": [{"position": "gk"}], "substitutes": []}
                    for side in ("home", "away")
                },
                report_id=meta.report_id,
                home_team=meta.home_team,
                away_team=meta.away_team,
            )


def test_absent_lineups_stage_goalkeepers_none_and_still_parse_every_page(build):
    """Task 7.2, ruled in code review: a Domain A failure costs the goalkeeper list ONLY.

    Goal prevention, aerial control, distribution and involvement are all page-internal,
    so failing the whole domain would hide a genuinely broken goalkeeping page behind
    `domain-a-completeness`'s finding. `lineups=None` stages `goalkeepers: None` per side
    and everything else parses byte-identically to the normal path.
    """
    path = build()
    doc, meta, anchors = _anchors_for(path)
    with doc:
        without = extract_domain_e(
            doc,
            anchors,
            None,
            report_id=meta.report_id,
            home_team=meta.home_team,
            away_team=meta.away_team,
        )
    full = _extract(path)

    for side in ("home", "away"):
        assert without[side]["goalkeepers"] is None
        assert full[side]["goalkeepers"] is not None
        # Every other key is untouched by the absent lineup.
        for key in ("total_involvements", "involvement_series", "distribution",
                    "goal_prevention", "aerial_control"):
            assert without[side][key] == full[side][key]
    # And the absence is recorded, not merely nulled.
    assert domain_e_goalkeeper_warnings(without) == [
        w for w in domain_e_goalkeeper_warnings(without) if "did not extract" in w
    ]
    assert len(domain_e_goalkeeper_warnings(without)) == 2
    assert domain_e_goalkeeper_warnings(full) == []
    # The checks are unaffected — none of them reads the goalkeeper list.
    assert domain_e_checks(without) == domain_e_checks(full)


# --- AC 4: the documented absences --------------------------------------------------------


def test_the_three_absences_stage_as_none(build):
    payload = _extract(build())

    for side in ("home", "away"):
        distribution = payload[side]["distribution"]
        assert distribution["feet_techniques"] is None
        assert distribution["hands_techniques"] is None
        assert distribution["throw_techniques"] is None
        assert payload[side]["goal_prevention"]["by_body_type"] is None
        assert payload[side]["aerial_control"]["crosses_faced_completed"] is None


def test_each_absence_carries_exactly_one_warning():
    """AC 4: `null` plus a per-report warning naming it — never a non-"pass" check, which
    the strictly binary aggregator would read as a failure."""
    warnings = domain_e_warnings()

    assert len(warnings) == len(DOCUMENTED_ABSENCES) == 3
    for field, _reason in DOCUMENTED_ABSENCES:
        assert any(field in warning for warning in warnings)
    assert warnings == domain_e_warnings()  # deterministic, so re-runs are byte-identical


# --- the recorded checks -------------------------------------------------------------------


def test_all_six_checks_pass_on_the_defaults(build):
    checks = domain_e_checks(_extract(build()))

    assert [check["check"] for check in checks] == [
        "goalkeeping-distribution-sum",
        "goalkeeping-distribution-printed",
        "goalkeeping-goal-prevention-sum",
        "goalkeeping-aerial-sum",
        "goalkeeping-involvement-bound",
        "goalkeeping-involvement-clock",
    ]
    assert all(check["result"] == "pass" for check in checks)


def test_exactly_one_dict_per_check_id_covers_both_sides(build):
    checks = domain_e_checks(_extract(build()))

    assert len(checks) == len({check["check"] for check in checks})


def test_distribution_sum_check_fails_when_the_total_panel_disagrees(build):
    payload = _extract(build())
    payload["home"]["distribution"]["total"]["total"] += 1

    check = _check(domain_e_checks(payload), "goalkeeping-distribution-sum")

    assert check["result"] == "fail"
    assert check["specifics"].startswith("home")


def test_distribution_printed_check_is_a_TWO_sided_bound(build):
    """A BOUND, not an equality, and TWO-SIDED — ruled in the 1.9 code review.

    Over all 208 corpus team-innings x 3 printed panels the marker count COVERS the donut
    centre on 624/624 while equality holds on only 604/624, every residual in the `feet`
    panel (+1 on 18, +2 on 2). So an overshoot within the corpus maximum must pass and a
    short count must fail — but an overshoot PAST that maximum must fail too. A one-sided
    check left the whole overshoot direction open, and `pitch_margin_pt` 0.0 -> 0.5 can
    only push counts up: between them, a mapping slip assigning the `total` panel's
    markers to `feet` used to pass outright.
    """
    payload = _extract(build())
    payload["home"]["distribution"]["feet"]["total"] += DISTRIBUTION_PRINTED_MAX_OVERSHOOT
    assert _check(domain_e_checks(payload), "goalkeeping-distribution-printed")["result"] == "pass"

    payload = _extract(build())
    payload["away"]["distribution"]["throw"]["printed_total"] += 1
    check = _check(domain_e_checks(payload), "goalkeeping-distribution-printed")
    assert check["result"] == "fail"
    assert "away throw" in check["specifics"]

    payload = _extract(build())
    payload["home"]["distribution"]["feet"]["total"] += DISTRIBUTION_PRINTED_MAX_OVERSHOOT + 1
    check = _check(domain_e_checks(payload), "goalkeeping-distribution-printed")
    assert check["result"] == "fail"
    assert "overshoot" in check["specifics"]


def test_the_printed_delta_is_recorded_on_EVERY_report_passing_or_failing(build):
    """Task 5.6's discipline: the residual stays visible rather than being absorbed.

    Including on a FAILING report. The original ternary put the delta census in the
    passing branch alone, so a report failing on one side silently dropped the other
    side's honest residual — the exact absorption the check's own comment forbids.
    """
    check = _check(domain_e_checks(_extract(build())), "goalkeeping-distribution-printed")
    assert check["result"] == "pass"
    assert "home feet:" in check["specifics"]

    payload = _extract(build())
    payload["away"]["distribution"]["throw"]["printed_total"] += 1
    check = _check(domain_e_checks(payload), "goalkeeping-distribution-printed")
    assert check["result"] == "fail"
    # The failure is named AND every panel's delta still travels, both sides.
    assert "away throw:" in check["specifics"]
    for side in ("home", "away"):
        for key in DISTRIBUTION_PRINTED_PANELS:
            assert f"{side} {key}:" in check["specifics"]


def test_goal_prevention_check_fails_when_the_types_miss_the_attempts(build):
    payload = _extract(build())
    payload["home"]["goal_prevention"]["by_intervention_type"]["save_attempt"] += 1

    check = _check(domain_e_checks(payload), "goalkeeping-goal-prevention-sum")

    assert check["result"] == "fail"
    assert "intervention types sum" in check["specifics"]


def test_goal_prevention_check_fails_when_the_kpi_tile_disagrees_with_the_table(build):
    payload = _extract(build())
    payload["away"]["goal_prevention"]["attempts_faced_printed"] += 1

    check = _check(domain_e_checks(payload), "goalkeeping-goal-prevention-sum")

    assert check["result"] == "fail"
    assert "KPI tile" in check["specifics"]


def test_aerial_check_fails_when_the_delivery_types_miss_the_total(build):
    payload = _extract(build())
    payload["home"]["aerial_control"]["delivery_types_faced"]["driven"] += 3

    check = _check(domain_e_checks(payload), "goalkeeping-aerial-sum")

    assert check["result"] == "fail"


def test_involvement_bound_passes_when_the_series_falls_short(build):
    """The corpus mode: `printed - drawn` is 0..5, never negative, exact on only 59/208.
    A short series is the NORMAL state and must not fail."""
    payload = _extract(build())
    away = payload["away"]
    assert sum(away["involvement_series"]) < away["total_involvements"]

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-bound")

    assert check["result"] == "pass"
    assert "delta 1" in check["specifics"]


def test_involvement_bound_fails_when_the_series_overshoots(build):
    payload = _extract(build())
    payload["home"]["total_involvements"] = 0

    check = _check(domain_e_checks(payload), "goalkeeping-involvement-bound")

    assert check["result"] == "fail"
    assert "above the printed total" in check["specifics"]
    # The passing side's delta survives the other side's failure — the residual gap is
    # recorded on EVERY report, which the original ternary did only on passing ones.
    assert "away:" in check["specifics"]
    assert "delta" in check["specifics"]


def test_the_corpus_refuted_relations_are_not_shipped(build):
    """`sum(5 intervention types) == total_interventions` is corpus-FALSE on 207/208 and
    `total_interventions == attempts_faced - no_save_attempt` on 183/208. The defaults
    make BOTH false, so no fixture can quietly bless either — and the checks still pass."""
    payload = _extract(build())

    for side in ("home", "away"):
        block = payload[side]["goal_prevention"]
        types = sum(block["by_intervention_type"][key] for key in INTERVENTION_TYPES)
        assert types != block["total_interventions"]
        assert block["total_interventions"] != (
            block["attempts_faced"] - block["by_intervention_type"]["no_save_attempt"]
        )
    assert all(check["result"] == "pass" for check in domain_e_checks(payload))


def test_the_aerial_delivery_types_are_the_six_that_sum_to_the_total(build):
    payload = _extract(build())

    for side in ("home", "away"):
        delivery = payload[side]["aerial_control"]["delivery_types_faced"]
        assert set(delivery) == set(AERIAL_DELIVERY_TYPES) | {"total"}
        assert sum(delivery[key] for key in AERIAL_DELIVERY_TYPES) == delivery["total"]


# --- tripwires the grammar structurally cannot see (code-review additions) ----------------
#
# Everything above is found by NAME, so a printed number nobody reads would stage silently.
# The four `*_decorate` hooks exist to draw exactly that, and until this review none of
# them was used by any test.


def test_an_extra_number_below_the_panels_trips_the_distribution_census(build):
    """The distribution page's four-number census is the only read that sees the WHOLE
    page rather than the parts the grammar names — Domain F's identical tripwire had two
    tests from the start and this one had none."""

    def decorate(page):
        page.insert_text((300.0, 520.0), "7", fontsize=12)

    with pytest.raises(GoalkeepingPageParseError, match="below the panel band, expected 4"):
        _extract(build(gk_distribution_decorate=decorate))


def test_two_donut_centres_under_one_panel_raises(build):
    """The page-level census counts four numbers; this is the per-PANEL half of the same
    grammar. Moving the `hands` centre under the `feet` panel keeps the census at four and
    still has to fail: a panel with two centres cannot be read unambiguously (AD-8)."""
    moved = dict(GK_DISTRIBUTION_DONUT_XS)
    moved["hands"] = GK_DISTRIBUTION_DONUT_XS["feet"] + 20.0

    with pytest.raises(GoalkeepingPageParseError, match=r"printed donut centre\(s\)"):
        _extract(build(gk_distribution_donut_xs=moved))


def test_a_label_printed_TWICE_ON_ONE_ROW_is_ambiguous(build):
    """`_find_label`'s duplicate guard has to be per-PAGE, not per-row.

    A first-match run accessor made it per-row, and the rows this parser keys on are
    precisely the ones carrying several labels each — the four distribution panel titles
    share one row, so do the aerial `Complete / <type> / Incomplete` columns. A label
    repeated inside ONE row therefore bound silently to whichever tile sat left, which is
    the plausible-wrong-value outcome AD-8 forbids outright. This draws the duplicate on
    the label's own visual row, so only a per-page count can see it.
    """
    _label, _centre_x, label_top, _value_top = AERIAL_TOTAL_LAYOUT

    def decorate(page):
        _ef_centred(page, 400.0, label_top, "Total Interventions", fontsize=EF_LABEL_FONTSIZE)

    with pytest.raises(
        GoalkeepingPageParseError, match="prints the label 'Total Interventions' 2 times"
    ):
        _extract(build(aerial_decorate=decorate))


def test_an_extra_evenly_spaced_gridline_run_is_refused(build):
    """The printed axis and the drawn grid are two independent sources and their agreement
    IS the assertion: the labels give the unit, the grid gives the baseline.

    An extra gridline exactly one unit BELOW zero does NOT make two candidate runs — it
    makes the top-anchored one too long (`count + 1`) and therefore rejected, leaving the
    run shifted a whole unit down as the unique survivor. Every value then reads one unit
    high off a baseline that is not zero. Uniqueness alone is not the assertion; the run
    also has to reach the bottom of the grid.

    This case was raised in review, dismissed on the reasoning that
    `goalkeeping-involvement-bound` would catch the inflation, and then reproduced by this
    test: the bound does fire, but as a count mismatch blaming the printed total for a
    misread axis, and only after the series has already been staged wrong.
    """
    top_gridline = GK_INVOLVEMENT_CHART_TOPS[0][1]
    zero = top_gridline + DEFAULT_GK_INVOLVEMENT_TOP_LABEL * GK_INVOLVEMENT_UNIT

    def decorate(page):
        page.draw_line(
            (GK_INVOLVEMENT_PLOT_X0, zero + GK_INVOLVEMENT_UNIT),
            (GK_INVOLVEMENT_PLOT_X1, zero + GK_INVOLVEMENT_UNIT),
            color=GK_INVOLVEMENT_GRID_STROKE, width=0.5,
        )

    with pytest.raises(
        InvolvementChartError, match="does not start at the top of the grid"
    ):
        _extract(build(gk_involvement_decorate=decorate))


def test_a_stray_dot_above_the_away_title_lands_in_the_away_chart_band(build):
    """Each chart's band runs from its own title to the NEXT title, so a dot drawn in the
    lower chart's band is read there. Deliberately loud rather than silently absorbed."""

    def decorate(page):
        # A 3.0 pt dot inside the away plot box but off the value grid.
        page.draw_circle((400.0, 470.0), 1.5, color=None, fill=(0.18, 0.30, 1.00))

    with pytest.raises(InvolvementChartError):
        _extract(build(gk_involvement_decorate=decorate))


def test_an_extra_number_in_the_aerial_kpi_band_is_caught(build):
    """The aerial page repeats three tiles at identical x centres, so a number centred on
    a tile label is exactly what the bounded upward walk exists to disambiguate."""

    def decorate(page):
        page.insert_text((100.0, 200.0), "Total Interventions", fontsize=9)

    with pytest.raises(GoalkeepingPageParseError, match="prints the label 'Total Interventions' 2 times"):
        _extract(build(aerial_decorate=decorate))


# --- import-time constant integrity (the 1.2/1.4/1.10 rule) -------------------------------
#
# An authoring bug in these tables must fail the run at IMPORT, not surface as 208
# identical per-report failures blaming the corpus. Three of the tables the parser `zip`s
# over were unguarded, and `zip` truncates silently.


def test_a_truncating_aerial_triple_fails_at_import():
    """`zip(AERIAL_TRIPLE_KEYS, centres)` would stage fewer values per tile with nothing
    failing anywhere — no check reads those keys, so 208 reports would go out short."""
    from pipeline.extract import domain_e as de

    original = de.AERIAL_TRIPLE_KEYS
    try:
        de.AERIAL_TRIPLE_KEYS = original + ("fourth",)
        with pytest.raises(ValueError, match="zip would truncate"):
            de._assert_constant_integrity()
    finally:
        de.AERIAL_TRIPLE_KEYS = original

    original = de.AERIAL_TRIPLE_LABELS
    try:
        de.AERIAL_TRIPLE_LABELS = ("Complete", "Incomplete", "Extra")
        with pytest.raises(ValueError, match="exactly one aerial triple column"):
            de._assert_constant_integrity()
    finally:
        de.AERIAL_TRIPLE_LABELS = original


def test_a_renamed_aerial_total_column_fails_at_import():
    """`crosses_faced_attempted` reads `delivery['total']` by name; a rename would be a
    bare `KeyError` mid-parse instead of an authoring bug caught once."""
    from pipeline.extract import domain_e as de

    original = de.AERIAL_DELIVERY_COLUMNS
    try:
        de.AERIAL_DELIVERY_COLUMNS = ("grand_total",) + original[1:]
        with pytest.raises(ValueError, match="reads it by that name"):
            de._assert_constant_integrity()
    finally:
        de.AERIAL_DELIVERY_COLUMNS = original


def test_a_goal_prevention_kpi_table_missing_its_cross_check_key_fails_at_import():
    """`goalkeeping-goal-prevention-sum` reads `attempts_faced_printed`; dropping the KPI
    that stages it would make the check raise per report rather than fail once here."""
    from pipeline.extract import domain_e as de

    original = de.GOAL_PREVENTION_KPIS
    try:
        de.GOAL_PREVENTION_KPIS = (("save_percentage", "Save %"),)
        with pytest.raises(ValueError, match="attempts_faced_printed"):
            de._assert_constant_integrity()
    finally:
        de.GOAL_PREVENTION_KPIS = original


def test_the_shipped_constants_pass_their_own_integrity_guard():
    from pipeline.extract import domain_e as de

    de._assert_constant_integrity()

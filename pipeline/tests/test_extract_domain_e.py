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
    DISTRIBUTION_PRINTED_PANELS,
    DOCUMENTED_ABSENCES,
    INTERVENTION_TYPES,
    domain_e_checks,
    domain_e_warnings,
    extract_domain_e,
)
from pipeline.extract.errors import (
    GoalkeepingPageParseError,
    InvolvementChartError,
    MalformedFieldError,
    MissingFieldError,
)
from pipeline.markers.errors import PitchFrameError, UnknownRgbError

from pipeline.tests.conftest import (
    GK_DISTRIBUTION_PANELS,
    default_goalkeeping_blocks,
    default_lineup_sides,
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
    window and by the pitch margin — so dropping them must change nothing."""
    with_furniture = _extract(build())
    without = _extract(build(gk_distribution_legend=False))

    assert with_furniture == without


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


def test_a_non_numeric_token_in_a_table_raises(build):
    blocks = default_goalkeeping_blocks("away")
    blocks["aerial_control"]["delivery_types_faced"]["driven"] = "-"

    with pytest.raises(GoalkeepingPageParseError, match=r"carries 6 value\(s\)"):
        _extract(build(goalkeeping_blocks={"away": blocks}))


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


def test_the_missing_team_names_are_refused(build):
    """The involvement page carries BOTH charts and names them only in their titles, so
    the cover names are required rather than optional."""
    path = build()
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
        with pytest.raises(GoalkeepingPageParseError, match="cover team names"):
            extract_domain_e(doc, anchors, {}, report_id=meta.report_id)


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


def test_all_five_checks_pass_on_the_defaults(build):
    checks = domain_e_checks(_extract(build()))

    assert [check["check"] for check in checks] == [
        "goalkeeping-distribution-sum",
        "goalkeeping-distribution-printed",
        "goalkeeping-goal-prevention-sum",
        "goalkeeping-aerial-sum",
        "goalkeeping-involvement-bound",
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


def test_distribution_printed_check_fails_only_when_markers_fall_SHORT(build):
    """A BOUND, not an equality, and the direction is the finding: over all 208 corpus
    team-innings x 3 printed panels the marker count COVERS the donut centre on 624/624
    while equality holds on only 604/624, every residual in the `feet` panel. Drawing
    more than the donut counts must pass; drawing fewer must fail."""
    payload = _extract(build())
    payload["home"]["distribution"]["feet"]["total"] += 2
    assert _check(domain_e_checks(payload), "goalkeeping-distribution-printed")["result"] == "pass"

    payload = _extract(build())
    payload["away"]["distribution"]["throw"]["printed_total"] += 1
    check = _check(domain_e_checks(payload), "goalkeeping-distribution-printed")
    assert check["result"] == "fail"
    assert "away throw" in check["specifics"]


def test_the_printed_delta_is_recorded_on_a_passing_report(build):
    """Task 5.6's discipline: the residual stays visible rather than being absorbed."""
    check = _check(domain_e_checks(_extract(build())), "goalkeeping-distribution-printed")

    assert check["result"] == "pass"
    assert "home feet:" in check["specifics"]


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

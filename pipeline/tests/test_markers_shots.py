"""Tasks 2-3 + 6: the shots parser — AD-6 events, attempts-table count, ground truth.

Two fixture families, per the story's testing requirements:

- Synthetic vector pages (always run) cover every branch on drawings the tests drew
  themselves; expected table counts derive from what the factory drew, never a second
  literal.
- The ground-truth fixture `spike/mex_rsa.pdf` (auto-skips when absent, AR-16) is
  counts/distribution only: 16 home markers, 2/2/8/3/1, plus orientation *invariants* —
  never exact coordinate values, because the spike's printed coordinates are in a
  transposed frame vs AD-6.
"""

from __future__ import annotations

from collections import Counter

import pymupdf
import pytest

from pipeline.markers.errors import (
    AttemptsTableError,
    PitchFrameError,
    ShotsPageLayoutError,
    UnknownRgbError,
)
from pipeline.markers.shots import (
    SHOTS_MARKER_SPEC,
    SHOTS_RGB_TO_OUTCOME,
    parse_shots,
    self_validation_block,
)
from pipeline.tests.conftest import SHOTS_PITCH

REPORT_ID = "PMSR-M07-AAA-V-BBB"


def open_report(make_report, tmp_path, **kwargs):
    pdf = make_report(tmp_path / f"{REPORT_ID}.pdf", number=7, **kwargs)
    return pymupdf.open(pdf)


def shots_anchors(doc) -> dict:
    from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
    from pipeline.discover.text import PageTextIndex

    index = PageTextIndex(doc, REPORT_ID)
    anchors = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home="Mexico", away="South Africa"):
        anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
    return anchors


def parse(doc) -> dict:
    return parse_shots(doc, shots_anchors(doc), REPORT_ID, "Mexico", "South Africa")


# --- palette ----------------------------------------------------------------------


def test_the_shots_palette_uses_the_contract_hyphenated_outcome_values():
    assert SHOTS_RGB_TO_OUTCOME == {
        (0.00, 0.50, 0.00): "goal",
        (0.36, 0.61, 0.84): "on-target",
        (0.96, 0.74, 0.00): "off-target",
        (0.70, 0.53, 1.00): "blocked",
        (0.18, 0.30, 1.00): "incomplete",
    }
    assert SHOTS_MARKER_SPEC.marker_min_pt == 8.0
    assert SHOTS_MARKER_SPEC.marker_max_pt == 15.0


# --- synthetic: event shape and AD-6 frame ----------------------------------------


def test_shot_events_carry_the_full_snake_case_shape(make_report, tmp_path):
    with open_report(make_report, tmp_path) as doc:
        shots = parse(doc)

    assert shots["shootout_attempts"] is None
    assert shots["shot_events"], "default factory draws markers"
    for event in shots["shot_events"]:
        assert set(event) == {"team_id", "x", "y", "outcome", "own_goal", "source"}
        assert event["team_id"] in ("mexico", "south-africa")
        assert event["own_goal"] is False
        assert 0 <= event["x"] <= 100 and 0 <= event["y"] <= 100
        assert event["x"] == round(event["x"], 2) and event["y"] == round(event["y"], 2)
        assert set(event["source"]) == {"page_index", "pdf_x", "pdf_y"}


def test_ad6_normalization_maps_attack_up_pdf_space_into_the_ad6_frame(make_report, tmp_path):
    """The transposition trap: x runs along the attack (up the page), y across the pitch
    from the attacker's left. A marker drawn near the top of the pitch (near the attacked
    goal, small pdf y) must land at high AD-6 x; one at page-left lands at low AD-6 y.
    """
    markers = {
        "home": [("goal", 0.10, 0.05), ("off-target", 0.90, 0.95)],
        "away": [("on-target", 0.50, 0.50)],
    }
    with open_report(make_report, tmp_path, shots_markers=markers) as doc:
        shots = parse(doc)

    home = sorted(
        (e for e in shots["shot_events"] if e["team_id"] == "mexico"), key=lambda e: e["x"]
    )
    near_goal, far_corner = home[1], home[0]
    # (fx=0.10, fy=0.05): 5% down the pitch length -> x = 95; 10% across -> y = 10.
    assert near_goal["outcome"] == "goal"
    assert near_goal["x"] == pytest.approx(95, abs=0.5)
    assert near_goal["y"] == pytest.approx(10, abs=0.5)
    assert far_corner["outcome"] == "off-target"
    assert far_corner["x"] == pytest.approx(5, abs=0.5)
    assert far_corner["y"] == pytest.approx(90, abs=0.5)

    away = [e for e in shots["shot_events"] if e["team_id"] == "south-africa"]
    assert [e["outcome"] for e in away] == ["on-target"]
    assert away[0]["x"] == pytest.approx(50, abs=0.5)


def test_events_are_sorted_by_team_then_page_then_pdf_position(make_report, tmp_path):
    markers = {
        "home": [("goal", 0.5, 0.8), ("blocked", 0.2, 0.1), ("blocked", 0.8, 0.1)],
        "away": [("on-target", 0.5, 0.5)],
    }
    with open_report(make_report, tmp_path, shots_markers=markers) as doc:
        shots = parse(doc)

    keys = [
        (e["team_id"], e["source"]["page_index"], e["source"]["pdf_y"], e["source"]["pdf_x"])
        for e in shots["shot_events"]
    ]
    assert keys == sorted(keys)


def test_source_block_keeps_pdf_space_positions_on_the_map_page(make_report, tmp_path):
    """Story 1.5 links digit glyphs to markers in pdf space, so the record must keep it."""
    markers = {"home": [("goal", 0.25, 0.25)], "away": [("on-target", 0.5, 0.5)]}
    with open_report(make_report, tmp_path, shots_markers=markers) as doc:
        anchors = shots_anchors(doc)
        shots = parse(doc)

    event = next(e for e in shots["shot_events"] if e["team_id"] == "mexico")
    assert event["source"]["page_index"] == anchors["shots:home"][0]
    assert event["source"]["pdf_x"] == pytest.approx(
        SHOTS_PITCH.x0 + 0.25 * SHOTS_PITCH.width, abs=0.5
    )
    assert event["source"]["pdf_y"] == pytest.approx(
        SHOTS_PITCH.y0 + 0.25 * SHOTS_PITCH.height, abs=0.5
    )


# --- synthetic: chain behavior end-to-end through the parser ----------------------


def test_dark_blue_header_rect_and_out_of_pitch_circle_yield_zero_false_markers(
    make_report, tmp_path
):
    def decorate(side, page, pitch):
        page.draw_rect(pymupdf.Rect(60, 130, 204, 148), fill=(0.18, 0.30, 1.00))
        page.draw_circle((700, 300), 5.625, color=(1, 1, 1), fill=(0.18, 0.30, 1.00), width=0.75)

    markers = {"home": [], "away": []}
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_decorate=decorate
    ) as doc:
        shots = parse(doc)

    assert shots["shot_events"] == []
    assert shots["counts"] == {
        "home": {"markers": 0, "table": 0},
        "away": {"markers": 0, "table": 0},
    }


def test_the_default_legend_row_is_excluded_from_events(make_report, tmp_path):
    """The factory draws a 5-color legend row inside the pitch on every map page; none of
    those circles may surface as events."""
    markers = {"home": [("goal", 0.5, 0.5)], "away": []}
    with open_report(make_report, tmp_path, shots_markers=markers) as doc:
        shots = parse(doc)

    assert [e["outcome"] for e in shots["shot_events"]] == ["goal"]


def test_overlapping_markers_are_two_events(make_report, tmp_path):
    markers = {"home": [("blocked", 0.4, 0.4), ("blocked", 0.4, 0.4)], "away": []}
    with open_report(make_report, tmp_path, shots_markers=markers) as doc:
        shots = parse(doc)

    home = [e for e in shots["shot_events"] if e["team_id"] == "mexico"]
    assert len(home) == 2
    assert home[0]["source"] == home[1]["source"]


def test_an_unknown_marker_color_aborts_with_rgb_and_page(make_report, tmp_path):
    def decorate(side, page, pitch):
        if side == "home":
            page.draw_circle((200, 300), 5.625, color=(1, 1, 1), fill=(0.5, 0.5, 0.5), width=0.75)

    with open_report(make_report, tmp_path, shots_decorate=decorate) as doc:
        anchors = shots_anchors(doc)
        with pytest.raises(UnknownRgbError) as excinfo:
            parse_shots(doc, anchors, REPORT_ID, "Mexico", "South Africa")

    assert excinfo.value.rgb == (0.5, 0.5, 0.5)
    assert excinfo.value.page_index == anchors["shots:home"][0]
    assert REPORT_ID in str(excinfo.value)


def test_a_map_page_without_a_pitch_frame_fails_loud(make_report, tmp_path):
    with open_report(make_report, tmp_path, shots_draw_pitch=False) as doc:
        with pytest.raises(PitchFrameError):
            parse(doc)


# --- synthetic: anchor layout -----------------------------------------------------


def test_a_shots_anchor_resolving_to_a_single_page_fails_loud(make_report, tmp_path):
    with open_report(make_report, tmp_path, shots_pages={"away": 1}) as doc:
        with pytest.raises(ShotsPageLayoutError) as excinfo:
            parse(doc)

    assert excinfo.value.anchor_id == "shots:away"
    assert len(excinfo.value.pages) == 1


def test_a_multi_page_attempts_table_sums_rows_across_its_pages(make_report, tmp_path):
    """37 of the 104 real reports overflow the event table onto a second page (Task 7
    discovery: Germany's 26 attempts in M10 split 17 + 9). The expected count is the sum
    over every table page, and the check stays exact."""
    markers = {"home": [("goal", 0.5, 0.5)] * 5, "away": []}
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_table_pages={"home": [3, 2]}
    ) as doc:
        shots = parse(doc)

    assert shots["counts"]["home"] == {"markers": 5, "table": 5}


def test_a_trailing_anchored_page_with_no_table_on_it_fails_loud(make_report, tmp_path):
    """A stray third anchored page is not silently ignored: it is read as a table page
    and its missing header is a typed failure."""
    with open_report(make_report, tmp_path, shots_pages={"home": 3}) as doc:
        with pytest.raises(AttemptsTableError):
            parse(doc)


def test_a_table_first_page_ordering_fails_loud_as_pitch_frame_error(make_report, tmp_path):
    """The parser docstring's safety argument for accepting >= 2 pages: were a template
    revision to put the event table first, the map-page parse must fail loud on the table
    page — its header band is fill-only and far below the pitch area floor — never read
    the wrong page silently."""
    with open_report(make_report, tmp_path) as doc:
        anchors = shots_anchors(doc)
        anchors["shots:home"] = list(reversed(anchors["shots:home"]))
        with pytest.raises(PitchFrameError):
            parse_shots(doc, anchors, REPORT_ID, "Mexico", "South Africa")


def test_a_missing_shots_anchor_entry_fails_loud_not_keyerror(make_report, tmp_path):
    with open_report(make_report, tmp_path) as doc:
        anchors = shots_anchors(doc)
        del anchors["shots:away"]
        with pytest.raises(ShotsPageLayoutError) as excinfo:
            parse_shots(doc, anchors, REPORT_ID, "Mexico", "South Africa")

    assert excinfo.value.anchor_id == "shots:away"
    assert excinfo.value.pages is None


# --- synthetic: attempts-table count ----------------------------------------------


def test_table_count_comes_from_the_event_table_rows_not_the_markers(make_report, tmp_path):
    markers = {"home": [("goal", 0.5, 0.5), ("blocked", 0.3, 0.3)], "away": []}
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_table_rows={"home": 5}
    ) as doc:
        shots = parse(doc)

    assert shots["counts"]["home"] == {"markers": 2, "table": 5}


def test_a_table_page_without_a_header_row_is_a_typed_failure(make_report, tmp_path):
    with open_report(make_report, tmp_path, shots_table_header={"home": ""}) as doc:
        with pytest.raises(AttemptsTableError) as excinfo:
            parse(doc)

    assert REPORT_ID in str(excinfo.value)
    assert excinfo.value.page_index is not None


def test_two_header_shaped_lines_are_ambiguous_not_first_match(make_report, tmp_path):
    header = "Time Player Outcome Body Part Delivery Type"

    def decorate_table(side, page):
        if side == "home":
            page.insert_text((55, 520), header, fontsize=10)

    with open_report(make_report, tmp_path, shots_decorate_table=decorate_table) as doc:
        with pytest.raises(AttemptsTableError, match="header"):
            parse(doc)


def test_fullwidth_digits_do_not_count_as_attempt_rows(make_report, tmp_path):
    """`re.ASCII` on the digit class: a fullwidth-digit row must not inflate the count."""

    def decorate_table(side, page):
        if side == "home":
            # The built-in CJK font: under the default font pymupdf renders the
            # fullwidth digits as U+FFFD, which would make this test vacuous.
            page.insert_text((55, 500), "３５ 9 Ghost ROW Off Target", fontsize=10, fontname="japan")

    markers = {"home": [("goal", 0.5, 0.5)], "away": []}
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_decorate_table=decorate_table
    ) as doc:
        shots = parse(doc)

    assert shots["counts"]["home"]["table"] == 1


def test_an_empty_attempts_table_counts_zero_rows(make_report, tmp_path):
    markers = {"home": [], "away": []}
    with open_report(make_report, tmp_path, shots_markers=markers) as doc:
        shots = parse(doc)

    assert shots["counts"]["home"] == {"markers": 0, "table": 0}


# --- self-validation block --------------------------------------------------------


def test_matching_counts_produce_a_pass_with_both_counts_recorded():
    block = self_validation_block(
        {"home": {"markers": 16, "table": 16}, "away": {"markers": 3, "table": 3}}
    )

    assert block == {
        "result": "pass",
        "checks": [
            {
                "check": "shots-marker-count",
                "team": "home",
                "result": "pass",
                "marker_count": 16,
                "table_count": 16,
            },
            {
                "check": "shots-marker-count",
                "team": "away",
                "result": "pass",
                "marker_count": 3,
                "table_count": 3,
            },
        ],
    }


def test_any_team_mismatch_fails_the_whole_block_exactly_no_tolerance():
    block = self_validation_block(
        {"home": {"markers": 15, "table": 16}, "away": {"markers": 3, "table": 3}}
    )

    assert block["result"] == "fail"
    by_team = {check["team"]: check for check in block["checks"]}
    assert by_team["home"]["result"] == "fail"
    assert by_team["home"]["marker_count"] == 15
    assert by_team["home"]["table_count"] == 16
    assert by_team["away"]["result"] == "pass"


# --- ground truth (AR-16: counts/distribution and invariants only) ----------------


def test_ground_truth_home_map_yields_16_markers_with_the_known_distribution(mex_rsa_pdf):
    with pymupdf.open(mex_rsa_pdf) as doc:
        anchors = shots_anchors(doc)
        shots = parse_shots(doc, anchors, "mex_rsa", "Mexico", "South Africa")

    home = [e for e in shots["shot_events"] if e["team_id"] == "mexico"]
    assert len(home) == 16
    assert Counter(e["outcome"] for e in home) == {
        "goal": 2,
        "on-target": 2,
        "off-target": 8,
        "blocked": 3,
        "incomplete": 1,
    }


def test_ground_truth_self_validation_passes_for_both_teams(mex_rsa_pdf):
    with pymupdf.open(mex_rsa_pdf) as doc:
        shots = parse_shots(doc, shots_anchors(doc), "mex_rsa", "Mexico", "South Africa")

    assert shots["counts"]["home"] == {"markers": 16, "table": 16}
    assert shots["counts"]["away"]["markers"] == shots["counts"]["away"]["table"]
    assert self_validation_block(shots["counts"])["result"] == "pass"


def test_ground_truth_frame_orientation_invariants(mex_rsa_pdf):
    """Orientation, not coordinates: both home goals sit near the attacked goal line
    (the box edge is ~x 83), every coordinate is inside [0, 100], and the away map uses
    the same own-attack orientation. Exact values would violate AR-16.
    """
    with pymupdf.open(mex_rsa_pdf) as doc:
        shots = parse_shots(doc, shots_anchors(doc), "mex_rsa", "Mexico", "South Africa")

    for event in shots["shot_events"]:
        assert 0 <= event["x"] <= 100 and 0 <= event["y"] <= 100

    goals = [e for e in shots["shot_events"] if e["outcome"] == "goal"]
    assert len(goals) == 2
    assert all(goal["x"] > 66 for goal in goals)

    away = [e for e in shots["shot_events"] if e["team_id"] == "south-africa"]
    assert away, "South Africa took 3 attempts"
    assert all(event["x"] > 50 for event in away), "attempts cluster toward the attacked goal"

"""Crosses map parser tests (Story 1.11): synthetic-first, ground truth auto-skips.

Expected values derive from what the conftest factory drew (its exported constants and
helpers), never from a second hardcoded literal. Ground-truth assertions are counts and
outcome distribution only, never lifted coordinates (AR-16).
"""

from __future__ import annotations

import json

import pytest

from conftest import (
    CROSSES_MARKER_RADIUS,
    CROSSES_OUTCOME_RGB,
    CROSSES_PITCH_COORDS,
    DEFAULT_CROSSES_MARKERS,
    default_cross_rows,
)
from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.probe import probe_report
from pipeline.discover.text import PageTextIndex
from pipeline.markers.crosses import (
    CROSS_DELIVERY_LABEL_TO_ENUM,
    CROSSES_MARKER_SPEC,
    COORD_CLAMP_TOLERANCE,
    _clamp_coord,
    crosses_self_validation_block,
    parse_crosses,
)
from pipeline.markers.errors import (
    CrossesCoordinateError,
    CrossesPageLayoutError,
    CrossesTableError,
    UnknownLabelError,
    UnknownRgbError,
)

import pymupdf


def _crosses_anchors(pdf_path, home="Mexico", away="South Africa"):
    """The crosses anchor map of a synthetic (or real) report, via the real resolver."""
    doc = pymupdf.open(pdf_path)
    index = PageTextIndex(doc, "test")
    anchors = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=home, away=away):
        if anchor.anchor_id in ("crosses:home", "crosses:away"):
            anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
    return doc, anchors


def _parse(pdf_path, **kwargs):
    doc, anchors = _crosses_anchors(pdf_path, **kwargs)
    with doc:
        return parse_crosses(doc, anchors, "test", "Mexico", "South Africa")


def _expected_xy(fx, fy):
    """The AD-6 coordinates of a marker drawn at pitch fractions (fx, fy)."""
    x0, y0, x1, y1 = CROSSES_PITCH_COORDS
    pdf_x = x0 + fx * (x1 - x0)
    pdf_y = y0 + fy * (y1 - y0)
    nx = round(100 * (y1 - pdf_y) / (y1 - y0), 2)
    ny = round(100 * (pdf_x - x0) / (x1 - x0), 2)
    return min(100.0, max(0.0, nx)), min(100.0, max(0.0, ny))


# ---------------------------------------------------------------------------- happy path


def test_happy_path_both_teams(make_report, tmp_path):
    path = make_report(tmp_path / "r.pdf")
    result = _parse(path)

    events = result["cross_events"]
    assert len(events) == sum(len(m) for m in DEFAULT_CROSSES_MARKERS.values())

    for side, team_id in (("home", "mexico"), ("away", "south-africa")):
        team_events = [event for event in events if event["team_id"] == team_id]
        drawn = DEFAULT_CROSSES_MARKERS[side]
        assert len(team_events) == len(drawn)
        # Outcomes key by exact RGB to the contract's completed boolean.
        assert sorted(event["completed"] for event in team_events) == sorted(
            outcome == "completed" for outcome, _, _ in drawn
        )
        for event in team_events:
            assert event["delivery_type"] is None  # no linking pass exists for crosses
            assert set(event["source"]) == {"page_index", "pdf_x", "pdf_y"}
        # Coordinates derive from the drawn fractions.
        assert sorted((event["x"], event["y"]) for event in team_events) == sorted(
            _expected_xy(fx, fy) for _, fx, fy in drawn
        )
        assert result["counts"][side] == {
            "markers": len(drawn),
            "table": sum(default_cross_rows(drawn)[0]["counts"]),
        }
        rows = result["cross_table_rows"][side]
        assert [row["shirt_number"] for row in rows] == [9]
        assert rows[0]["player_name"] == "Test PLAYER"
        # Staged keys are snake_case (work/ staging rule); the contract's kebab enum
        # codes appear only at 1.16 emission via the frozen label map.
        assert rows[0]["deliveries"] == {
            "inswing": len(drawn), "outswing": 0, "driven": 0,
            "lofted": 0, "cutback": 0, "push_cross": 0,
        }
        assert rows[0]["total_attempted"] == len(drawn)

    # Deterministic order: team, then page, then pdf position.
    keys = [
        (e["team_id"], e["source"]["page_index"], e["source"]["pdf_y"], e["source"]["pdf_x"])
        for e in events
    ]
    assert keys == sorted(keys)


def test_self_validation_block_passes_on_matching_counts(make_report, tmp_path):
    result = _parse(make_report(tmp_path / "r.pdf"))
    checks = crosses_self_validation_block(result["counts"])
    assert [check["check"] for check in checks] == ["crosses-marker-count"] * 2
    assert [check["team"] for check in checks] == ["home", "away"]
    assert all(check["result"] == "pass" for check in checks)
    # Both counts always present, pass or fail.
    for check in checks:
        assert isinstance(check["marker_count"], int)
        assert isinstance(check["table_count"], int)


# ------------------------------------------------------------------- geometry before color


def test_palette_colored_rectangles_and_lines_admit_no_markers(make_report, tmp_path):
    """A table-header-band rect (or trajectory) in a palette color must stay inert."""

    def decorate(side, page, pitch):
        page.draw_rect(
            pymupdf.Rect(pitch.x0 + 10, pitch.y0 + 10, pitch.x0 + 200, pitch.y0 + 25),
            fill=CROSSES_OUTCOME_RGB["attempted"],
        )
        # An arrowhead-like filled polyline in a palette color, marker-sized.
        shape = page.new_shape()
        shape.draw_polyline(
            [
                (pitch.x0 + 50, pitch.y0 + 50),
                (pitch.x0 + 56, pitch.y0 + 53),
                (pitch.x0 + 50, pitch.y0 + 56),
                (pitch.x0 + 50, pitch.y0 + 50),
            ]
        )
        shape.finish(color=None, fill=CROSSES_OUTCOME_RGB["completed"], closePath=True)
        shape.commit()

    result = _parse(make_report(tmp_path / "r.pdf", crosses_decorate=decorate))
    assert len(result["cross_events"]) == sum(len(m) for m in DEFAULT_CROSSES_MARKERS.values())


# ----------------------------------------------------------------------- legend handling


def test_nine_pt_legend_swatches_are_never_markers(make_report, tmp_path):
    """The real 2-swatch legend sits INSIDE the pitch; the size window excludes it."""
    with_legend = _parse(make_report(tmp_path / "a.pdf", crosses_legend=True))
    without = _parse(make_report(tmp_path / "b.pdf", crosses_legend=False))
    assert with_legend["counts"] == without["counts"]
    assert len(with_legend["cross_events"]) == len(without["cross_events"])


def test_marker_sized_legend_row_of_four_colors_is_excluded(make_report, tmp_path):
    """A >=4-distinct-fill row at one y is a legend row even at marker size, and its
    off-palette members must be excluded BEFORE keying (no UnknownRgbError)."""

    def decorate(side, page, pitch):
        y = pitch.y0 + 0.8 * pitch.height
        fills = [
            CROSSES_OUTCOME_RGB["attempted"],
            CROSSES_OUTCOME_RGB["completed"],
            (0.5, 0.5, 0.5),
            (0.1, 0.9, 0.1),
        ]
        for i, fill in enumerate(fills):
            page.draw_circle(
                (pitch.x0 + 30 + i * 40, y),
                CROSSES_MARKER_RADIUS,
                color=(1, 1, 1),
                fill=fill,
                width=0.75,
            )

    result = _parse(make_report(tmp_path / "r.pdf", crosses_decorate=decorate))
    assert len(result["cross_events"]) == sum(len(m) for m in DEFAULT_CROSSES_MARKERS.values())


def test_two_real_markers_sharing_a_rounded_y_both_survive(make_report, tmp_path):
    """The 2-color palette must never reach legend_min_colors: an orange and a blue
    cross at one y are two real events (M50's dy=0.035pt pair), not a legend row."""
    markers = {
        "home": [("attempted", 0.2, 0.4), ("completed", 0.8, 0.4)],
        "away": DEFAULT_CROSSES_MARKERS["away"],
    }
    result = _parse(make_report(tmp_path / "r.pdf", crosses_markers=markers))
    home = [e for e in result["cross_events"] if e["team_id"] == "mexico"]
    assert len(home) == 2
    assert sorted(e["completed"] for e in home) == [False, True]


# ------------------------------------------------------------------- overlap and two-tone


def test_overlapping_same_color_markers_are_two_events(make_report, tmp_path):
    markers = {
        "home": [("attempted", 0.5, 0.3), ("attempted", 0.5, 0.3)],
        "away": DEFAULT_CROSSES_MARKERS["away"],
    }
    result = _parse(
        make_report(
            tmp_path / "r.pdf",
            crosses_markers=markers,
            crosses_rows={"home": [{"shirt": 9, "name": "Test PLAYER", "counts": (2, 0, 0, 0, 0, 0)}]},
        )
    )
    home = [e for e in result["cross_events"] if e["team_id"] == "mexico"]
    assert len(home) == 2
    assert result["counts"]["home"] == {"markers": 2, "table": 2}


def test_two_tone_double_draw_collapses_to_one_completed_event(make_report, tmp_path):
    """An orange+blue pair at the bit-identical rect is ONE event, completed (the
    corpus draws blue on top; 16 pages / 17 events in the 104-report census)."""
    markers = {
        "home": [("attempted", 0.3, 0.2), ("attempted", 0.6, 0.5)],
        "away": DEFAULT_CROSSES_MARKERS["away"],
    }
    result = _parse(
        make_report(
            tmp_path / "r.pdf",
            crosses_markers=markers,
            crosses_two_tone={"home": (1,)},
        )
    )
    home = [e for e in result["cross_events"] if e["team_id"] == "mexico"]
    assert len(home) == 2
    assert sorted(e["completed"] for e in home) == [False, True]
    assert result["counts"]["home"] == {"markers": 2, "table": 2}
    checks = crosses_self_validation_block(result["counts"])
    assert all(check["result"] == "pass" for check in checks)


# ---------------------------------------------------------------------------- unknown rgb


def test_unknown_marker_rgb_aborts_with_rgb_and_page(make_report, tmp_path):
    def decorate(side, page, pitch):
        if side == "home":
            page.draw_circle(
                (pitch.x0 + 0.4 * pitch.width, pitch.y0 + 0.6 * pitch.height),
                CROSSES_MARKER_RADIUS,
                color=(1, 1, 1),
                fill=(0.9, 0.1, 0.1),
                width=0.75,
            )

    path = make_report(tmp_path / "r.pdf", crosses_decorate=decorate)
    doc, anchors = _crosses_anchors(path)
    with doc, pytest.raises(UnknownRgbError) as excinfo:
        parse_crosses(doc, anchors, "test", "Mexico", "South Africa")
    assert excinfo.value.rgb == (0.9, 0.1, 0.1)
    assert excinfo.value.page_index == anchors["crosses:home"][0]


# ------------------------------------------------------------------------- count mismatch


def test_count_mismatch_fails_self_validation_with_both_counts(make_report, tmp_path):
    rows = {"home": [{"shirt": 9, "name": "Test PLAYER", "counts": (5, 0, 0, 0, 0, 0)}]}
    result = _parse(make_report(tmp_path / "r.pdf", crosses_rows=rows))
    drawn = len(DEFAULT_CROSSES_MARKERS["home"])
    assert result["counts"]["home"] == {"markers": drawn, "table": 5}
    checks = crosses_self_validation_block(result["counts"])
    home_check = next(check for check in checks if check["team"] == "home")
    assert home_check["result"] == "fail"
    assert home_check["marker_count"] == drawn
    assert home_check["table_count"] == 5
    away_check = next(check for check in checks if check["team"] == "away")
    assert away_check["result"] == "pass"


# ------------------------------------------------------------------------- table grammar


def test_multi_row_table_sums_the_total_column(make_report, tmp_path):
    markers = {
        "home": [("attempted", 0.2, 0.2), ("completed", 0.5, 0.3), ("attempted", 0.8, 0.4)],
        "away": DEFAULT_CROSSES_MARKERS["away"],
    }
    rows = {
        "home": [
            {"shirt": 5, "name": "Alpha ONE", "counts": (1, 0, 0, 0, 0, 0)},
            {"shirt": 7, "name": "Bravo TWO", "counts": (0, 1, 0, 0, 0, 1)},
            {"shirt": 11, "name": "Charlie THREE", "counts": (0, 0, 0, 0, 0, 0)},
        ]
    }
    result = _parse(
        make_report(tmp_path / "r.pdf", crosses_markers=markers, crosses_rows=rows)
    )
    assert result["counts"]["home"] == {"markers": 3, "table": 3}
    staged = result["cross_table_rows"]["home"]
    assert [row["shirt_number"] for row in staged] == [5, 7, 11]
    assert staged[1]["deliveries"]["push_cross"] == 1
    assert [row["total_attempted"] for row in staged] == [1, 2, 0]


def test_two_line_player_name_is_gathered_across_lines(make_report, tmp_path):
    rows = {
        "home": [
            {
                "shirt": 17,
                "name": "Alejandro ROMERO",
                "name_dy": 4.5,
                "name_below": "GAMARRA",
                "counts": (len(DEFAULT_CROSSES_MARKERS["home"]), 0, 0, 0, 0, 0),
            }
        ]
    }
    result = _parse(make_report(tmp_path / "r.pdf", crosses_rows=rows))
    staged = result["cross_table_rows"]["home"]
    assert staged[0]["player_name"] == "Alejandro ROMERO GAMARRA"
    assert result["counts"]["home"]["table"] == len(DEFAULT_CROSSES_MARKERS["home"])


def test_fullwidth_digit_shirt_number_is_not_a_row(make_report, tmp_path):
    """Fullwidth digits satisfy \\d without re.ASCII; such a row must not be admitted."""
    n = len(DEFAULT_CROSSES_MARKERS["home"])
    rows = {
        "home": [
            {"shirt": 9, "name": "Test PLAYER", "counts": (n, 0, 0, 0, 0, 0)},
            {"shirt": "１７", "name": "Ghost ROW", "counts": (3, 0, 0, 0, 0, 0)},
        ]
    }
    result = _parse(make_report(tmp_path / "r.pdf", crosses_rows=rows))
    assert [row["shirt_number"] for row in result["cross_table_rows"]["home"]] == [9]
    assert result["counts"]["home"]["table"] == n


def test_non_numeric_delivery_cell_is_a_table_error(make_report, tmp_path):
    rows = {"home": [{"shirt": 9, "name": "Test PLAYER", "counts": (1, "x", 0, 0, 0, 0), "total": 1}]}
    with pytest.raises(CrossesTableError):
        _parse(make_report(tmp_path / "r.pdf", crosses_rows=rows))


def test_row_total_not_matching_delivery_sum_is_a_table_error(make_report, tmp_path):
    rows = {"home": [{"shirt": 9, "name": "Test PLAYER", "counts": (1, 0, 0, 0, 0, 0), "total": 3}]}
    with pytest.raises(CrossesTableError):
        _parse(make_report(tmp_path / "r.pdf", crosses_rows=rows))


def test_row_without_a_player_name_is_a_table_error(make_report, tmp_path):
    rows = {"home": [{"shirt": 9, "name": None, "counts": (2, 0, 0, 0, 0, 0)}]}
    with pytest.raises(CrossesTableError):
        _parse(make_report(tmp_path / "r.pdf", crosses_rows=rows))


def test_unknown_header_label_is_an_unknown_label_error(make_report, tmp_path):
    replace = {"home": {"Cutback": "Curled"}}
    with pytest.raises(UnknownLabelError) as excinfo:
        _parse(make_report(tmp_path / "r.pdf", crosses_header_replace=replace))
    assert excinfo.value.label == "Curled"


def test_missing_header_word_is_a_table_error(make_report, tmp_path):
    replace = {"home": {"Driven": None}}
    with pytest.raises(CrossesTableError):
        _parse(make_report(tmp_path / "r.pdf", crosses_header_replace=replace))


def test_missing_header_row_is_a_table_error(make_report, tmp_path):
    replace = {"home": {"Player": None, "Inswing": None}}
    with pytest.raises(CrossesTableError):
        _parse(make_report(tmp_path / "r.pdf", crosses_header_replace=replace))


def test_zero_cross_report_stages_zero_events_and_passes(make_report, tmp_path):
    markers = {"home": [], "away": []}
    rows = {
        "home": [{"shirt": 9, "name": "Test PLAYER", "counts": (0, 0, 0, 0, 0, 0)}],
        "away": [{"shirt": 4, "name": "Other PLAYER", "counts": (0, 0, 0, 0, 0, 0)}],
    }
    result = _parse(
        make_report(tmp_path / "r.pdf", crosses_markers=markers, crosses_rows=rows)
    )
    assert result["cross_events"] == []
    assert result["counts"]["home"] == {"markers": 0, "table": 0}
    checks = crosses_self_validation_block(result["counts"])
    assert all(check["result"] == "pass" for check in checks)


# -------------------------------------------------------------------------- page layout


def test_multi_page_crosses_anchor_is_a_layout_error(make_report, tmp_path):
    with pytest.raises(CrossesPageLayoutError) as excinfo:
        _parse(make_report(tmp_path / "r.pdf", crosses_pages={"home": 2}))
    assert excinfo.value.anchor_id == "crosses:home"
    assert len(excinfo.value.pages) == 2


def test_missing_crosses_anchor_is_a_layout_error(make_report, tmp_path):
    path = make_report(tmp_path / "r.pdf")
    doc, anchors = _crosses_anchors(path)
    del anchors["crosses:away"]
    with doc, pytest.raises(CrossesPageLayoutError):
        parse_crosses(doc, anchors, "test", "Mexico", "South Africa")


# --------------------------------------------------------------- AD-6 range / orientation


def test_ad6_orientation_and_range_invariants(make_report, tmp_path):
    """fy=0 is the attacked goal line (x=100); fx=0 the attacker's left (y=0)."""
    markers = {
        "home": [("attempted", 0.0, 0.0), ("completed", 1.0, 1.0)],
        "away": [("attempted", 0.5, 0.5)],
    }
    result = _parse(make_report(tmp_path / "r.pdf", crosses_markers=markers))
    home = sorted(
        ((e["x"], e["y"]) for e in result["cross_events"] if e["team_id"] == "mexico")
    )
    assert home == [(0.0, 100.0), (100.0, 0.0)]
    away = [(e["x"], e["y"]) for e in result["cross_events"] if e["team_id"] == "south-africa"]
    assert away == [(50.0, 50.0)]
    for event in result["cross_events"]:
        assert 0.0 <= event["x"] <= 100.0
        assert 0.0 <= event["y"] <= 100.0


def test_pitch_margin_admits_edge_markers_and_clamps(make_report, tmp_path):
    """A real touchline cross sits <=0.35pt outside the frame (9 corpus pages); the
    1pt margin admits it and its coordinate clamps into the contract's [0, 100]."""
    x0, y0, x1, y1 = CROSSES_PITCH_COORDS
    just_outside_fy = -0.4 / (y1 - y0)  # center 0.4 pt above the pitch top
    markers = {
        "home": [("attempted", 0.5, just_outside_fy)],
        "away": DEFAULT_CROSSES_MARKERS["away"],
    }
    result = _parse(make_report(tmp_path / "r.pdf", crosses_markers=markers))
    home = [e for e in result["cross_events"] if e["team_id"] == "mexico"]
    assert len(home) == 1
    assert home[0]["x"] == 100.0  # 100.1 pre-clamp


def test_markers_beyond_the_margin_stay_excluded(make_report, tmp_path):
    x0, y0, x1, y1 = CROSSES_PITCH_COORDS
    far_outside_fy = -3.0 / (y1 - y0)  # center 3 pt above the pitch top
    markers = {
        "home": [("attempted", 0.5, far_outside_fy), ("completed", 0.5, 0.5)],
        "away": DEFAULT_CROSSES_MARKERS["away"],
    }
    rows = {"home": [{"shirt": 9, "name": "Test PLAYER", "counts": (1, 0, 0, 0, 0, 0)}]}
    result = _parse(
        make_report(tmp_path / "r.pdf", crosses_markers=markers, crosses_rows=rows)
    )
    home = [e for e in result["cross_events"] if e["team_id"] == "mexico"]
    assert len(home) == 1
    assert home[0]["completed"] is True


def test_clamp_coord_absorbs_touchline_overshoot_but_raises_beyond_tolerance():
    """Sub-tolerance overshoot (the in-margin touchline case) clamps into [0, 100];
    a value further out is a mis-normalization and fails loud (Code Review 2026-07-24)."""
    # Within tolerance on either edge -> clamped, no raise (100.1 is the probe max).
    assert _clamp_coord(100.1, "x", "r", 17) == 100.0
    assert _clamp_coord(100.0 + COORD_CLAMP_TOLERANCE, "x", "r", 17) == 100.0
    assert _clamp_coord(-COORD_CLAMP_TOLERANCE, "y", "r", 17) == 0.0
    assert _clamp_coord(42.5, "x", "r", 17) == 42.5  # in range, untouched
    # Beyond tolerance either way -> typed error carrying axis + pre-clamp value.
    with pytest.raises(CrossesCoordinateError) as high:
        _clamp_coord(100.0 + COORD_CLAMP_TOLERANCE + 0.01, "x", "r", 17)
    assert high.value.axis == "x"
    assert high.value.page_index == 17
    with pytest.raises(CrossesCoordinateError):
        _clamp_coord(-(COORD_CLAMP_TOLERANCE + 0.01), "y", "r", 17)


def test_shots_spec_default_margin_is_zero():
    """The margin knob must not move shots behavior: its default is 0.0 and the
    crosses spec's palette/size tuning stays self-contained."""
    from pipeline.markers.filter_chain import MarkerSpec
    from pipeline.markers.shots import SHOTS_MARKER_SPEC

    assert SHOTS_MARKER_SPEC.pitch_margin_pt == 0.0
    assert MarkerSpec(1.0, 2.0, {}).pitch_margin_pt == 0.0
    assert CROSSES_MARKER_SPEC.pitch_margin_pt == 1.0
    assert CROSSES_MARKER_SPEC.marker_min_pt <= 7.4 <= CROSSES_MARKER_SPEC.marker_max_pt
    assert not (CROSSES_MARKER_SPEC.marker_min_pt <= 9.0 <= CROSSES_MARKER_SPEC.marker_max_pt)


# ------------------------------------------------------------------------ frozen mappings


def test_delivery_label_map_matches_the_contract_enum(repo_root):
    schema = json.loads(
        (repo_root / "contract" / "common.schema.json").read_text(encoding="utf-8")
    )
    enum = set(schema["$defs"]["CrossDeliveryType"]["enum"])
    assert set(CROSS_DELIVERY_LABEL_TO_ENUM.values()) == enum
    # The two spelling variants the contract documents both normalize.
    assert CROSS_DELIVERY_LABEL_TO_ENUM["Inswing"] == "inswing"
    assert CROSS_DELIVERY_LABEL_TO_ENUM["In Swing"] == "inswing"


# -------------------------------------------------------------------------- ground truth


def test_mex_rsa_ground_truth_counts_and_distribution(mex_rsa_pdf):
    """Counts + outcome distribution only, never lifted coordinates (AR-16)."""
    meta = probe_report(mex_rsa_pdf)
    doc = pymupdf.open(mex_rsa_pdf)
    index = PageTextIndex(doc, meta.report_id)
    anchors = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        if anchor.anchor_id in ("crosses:home", "crosses:away"):
            anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
    with doc:
        result = parse_crosses(doc, anchors, meta.report_id, meta.home_team, meta.away_team)

    assert result["counts"]["home"] == {"markers": 10, "table": 10}
    assert result["counts"]["away"] == {"markers": 7, "table": 7}
    home = [e for e in result["cross_events"] if e["team_id"] == "mexico"]
    away = [e for e in result["cross_events"] if e["team_id"] == "south-africa"]
    assert sum(e["completed"] for e in home) == 2
    assert sum(e["completed"] for e in away) == 0
    # AD-6 orientation invariant: open-play crosses originate advanced or wide.
    assert all(e["x"] >= 50 or e["y"] <= 20 or e["y"] >= 80 for e in home + away)
    # The per-player aggregate table, staged verbatim.
    assert len(result["cross_table_rows"]["home"]) == 16
    assert len(result["cross_table_rows"]["away"]) == 15
    mokoena = next(
        row for row in result["cross_table_rows"]["away"] if row["shirt_number"] == 4
    )
    assert mokoena["player_name"] == "Teboho MOKOENA"
    assert mokoena["deliveries"]["outswing"] == 1
    assert mokoena["total_attempted"] == 1
    checks = crosses_self_validation_block(result["counts"])
    assert all(check["result"] == "pass" for check in checks)

"""Defensive-actions map parser tests (Story 1.12): synthetic-first, ground truth skips.

Expected values derive from what the conftest factory drew (its exported constants and
helpers), never from a second hardcoded literal. Ground-truth assertions are counts and
distribution only, never lifted coordinates (AR-16).
"""

from __future__ import annotations

import json

import pytest

from conftest import (
    DEFAULT_DEFENSIVE_ACTIONS_MARKERS,
    DEFENSIVE_ACTIONS_HEADLINE_XS,
    DEFENSIVE_ACTIONS_MARKER_RADIUS,
    DEFENSIVE_ACTIONS_PANELS,
    DEFENSIVE_ACTIONS_PANEL_TITLES,
    DEFENSIVE_ACTIONS_RGB,
    DEFENSIVE_ACTIONS_SWATCH_RADIUS,
    DEFENSIVE_ACTIONS_TABLE_YS,
    default_defensive_action_rows,
)
from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.text import PageTextIndex
from pipeline.markers.defensive_actions import (
    ABSENT_COUNTERPART_WARNING,
    COORD_CLAMP_TOLERANCE,
    DEFENSIVE_ACTION_LABEL_TO_ENUM,
    DEFENSIVE_ACTIONS_MARKER_SPEC,
    MAPPED_ACTION_TYPES,
    UNCOUNTED_FAMILIES,
    _DIRECTION_VECTOR,
    _clamp_coord,
    _panel_directions,
    defensive_actions_self_validation_block,
    parse_defensive_actions,
)
from pipeline.markers.errors import (
    DefensiveActionsCoordinateError,
    DefensiveActionsPageLayoutError,
    DefensiveActionsTableError,
    PitchFrameError,
    UnknownLabelError,
    UnknownRgbError,
)
from pipeline.markers.filter_chain import detect_pitch_frames
from pipeline.markers.shots import SHOTS_MARKER_SPEC

import pymupdf

PANEL_RECTS = dict(DEFENSIVE_ACTIONS_PANELS)


def _defensive_actions_anchors(pdf_path, home="Mexico", away="South Africa"):
    """The defensive-actions anchor map of a synthetic report, via the real resolver."""
    doc = pymupdf.open(pdf_path)
    index = PageTextIndex(doc, "test")
    anchors = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=home, away=away):
        if anchor.anchor_id in ("defensive-actions:home", "defensive-actions:away"):
            anchors[anchor.anchor_id] = index.find_all(
                anchor.text, at_start=anchor.at_page_start
            )
    return doc, anchors


def _parse(pdf_path, **kwargs):
    doc, anchors = _defensive_actions_anchors(pdf_path, **kwargs)
    with doc:
        return parse_defensive_actions(doc, anchors, "test", "Mexico", "South Africa")


def _expected_xy(action_type, fx, fy):
    """The AD-6 coordinates of a marker drawn at (fx, fy) of its OWN panel."""
    x0, y0, x1, y1 = PANEL_RECTS[action_type]
    pdf_x = x0 + fx * (x1 - x0)
    pdf_y = y0 + fy * (y1 - y0)
    nx = round(100 * (y1 - pdf_y) / (y1 - y0), 2)
    ny = round(100 * (pdf_x - x0) / (x1 - x0), 2)
    return min(100.0, max(0.0, nx)), min(100.0, max(0.0, ny))


def _drawn_count(side, action_type):
    return len(DEFAULT_DEFENSIVE_ACTIONS_MARKERS[side][action_type])


# ---------------------------------------------------------------------------- happy path


def test_happy_path_both_teams_and_both_panels(make_report, tmp_path):
    path = make_report(tmp_path / "r.pdf")
    result = _parse(path)

    events = result["defensive_action_events"]
    assert len(events) == sum(
        len(markers)
        for side in DEFAULT_DEFENSIVE_ACTIONS_MARKERS.values()
        for markers in side.values()
    )
    for side, team_id in (("home", "mexico"), ("away", "south-africa")):
        for action_type in MAPPED_ACTION_TYPES:
            family = [
                event
                for event in events
                if event["team_id"] == team_id and event["action_type"] == action_type
            ]
            assert len(family) == _drawn_count(side, action_type)


def test_both_panels_are_found_and_typed(make_report, tmp_path):
    """The equal-area regression: `detect_pitch_frame`'s `max` would keep ONE panel.

    The factory draws the possession-regain panel very slightly larger, exactly as the
    corpus does, so a parser that reached for the single largest frame would report zero
    forced turnovers and normalize every regain against the wrong rect.
    """
    path = make_report(tmp_path / "r.pdf")
    result = _parse(path)

    for side in ("home", "away"):
        families = {
            counts["action_type"] for counts in result["counts"][side].values()
        }
        assert families == set(MAPPED_ACTION_TYPES)
        for counts in result["counts"][side].values():
            assert counts["markers"] == _drawn_count(side, counts["action_type"])


def test_events_are_typed_by_panel_not_by_colour(make_report, tmp_path):
    """Every marker shares ONE fill, so the panel title is the only discriminator."""
    assert len(DEFENSIVE_ACTIONS_MARKER_SPEC.rgb_to_outcome) == 1
    result = _parse(make_report(tmp_path / "r.pdf"))
    assert {event["action_type"] for event in result["defensive_action_events"]} == set(
        MAPPED_ACTION_TYPES
    )


def test_coordinates_normalize_against_each_markers_own_panel(make_report, tmp_path):
    path = make_report(tmp_path / "r.pdf")
    result = _parse(path)

    for action_type in MAPPED_ACTION_TYPES:
        drawn = DEFAULT_DEFENSIVE_ACTIONS_MARKERS["home"][action_type]
        got = sorted(
            (event["x"], event["y"])
            for event in result["defensive_action_events"]
            if event["team_id"] == "mexico" and event["action_type"] == action_type
        )
        assert got == sorted(_expected_xy(action_type, fx, fy) for fx, fy in drawn)


def test_every_coordinate_is_in_range_and_two_decimals(make_report, tmp_path):
    result = _parse(make_report(tmp_path / "r.pdf"))
    for event in result["defensive_action_events"]:
        for axis in ("x", "y"):
            assert 0.0 <= event[axis] <= 100.0
            assert round(event[axis], 2) == event[axis]


def test_events_carry_defending_team_and_no_contest_type(make_report, tmp_path):
    """AD-6: `teamId` is the DEFENDING team — the team the anchor names."""
    result = _parse(make_report(tmp_path / "r.pdf"))
    assert {event["team_id"] for event in result["defensive_action_events"]} == {
        "mexico",
        "south-africa",
    }
    assert all(
        event["contest_type"] is None for event in result["defensive_action_events"]
    )


def test_events_are_deterministically_ordered(make_report, tmp_path):
    result = _parse(make_report(tmp_path / "r.pdf"))
    events = result["defensive_action_events"]
    keys = [
        (
            event["team_id"],
            event["action_type"],
            event["source"]["page_index"],
            event["source"]["pdf_y"],
            event["source"]["pdf_x"],
        )
        for event in events
    ]
    assert keys == sorted(keys)


def test_events_carry_their_panel_and_page_provenance(make_report, tmp_path):
    result = _parse(make_report(tmp_path / "r.pdf"))
    for event in result["defensive_action_events"]:
        source = event["source"]
        assert set(source) == {"page_index", "panel", "pdf_x", "pdf_y"}
        assert source["panel"] in (0, 1)


# ------------------------------------------------------------- geometry before colour


def test_a_table_header_rect_in_the_marker_colour_admits_no_markers(make_report, tmp_path):
    """The dark-blue collision: an `"re"` drawing in the markers' exact fill, inside a
    panel, must never reach the colour stage (AD-9's stage order)."""

    def decorate(side, page, panels):
        x0, y0, x1, y1 = PANEL_RECTS["forced-turnover"]
        page.draw_rect(
            pymupdf.Rect(x0 + 10, y0 + 10, x0 + 120, y0 + 28), fill=DEFENSIVE_ACTIONS_RGB
        )

    result = _parse(
        make_report(tmp_path / "r.pdf", defensive_actions_decorate=decorate)
    )
    for side in ("home", "away"):
        for counts in result["counts"][side].values():
            assert counts["markers"] == _drawn_count(side, counts["action_type"])


def test_a_nine_point_same_colour_swatch_inside_a_panel_is_excluded(make_report, tmp_path):
    """The size window carries the whole legend defense: the bullet swatches share the
    markers' EXACT blue and sit only 0.13 pt above them."""

    def decorate(side, page, panels):
        x0, y0, x1, y1 = PANEL_RECTS["possession-regain"]
        page.draw_circle(
            ((x0 + x1) / 2, y0 + 20),
            DEFENSIVE_ACTIONS_SWATCH_RADIUS,
            color=None,
            fill=DEFENSIVE_ACTIONS_RGB,
        )

    result = _parse(
        make_report(tmp_path / "r.pdf", defensive_actions_decorate=decorate)
    )
    for side in ("home", "away"):
        for counts in result["counts"][side].values():
            assert counts["markers"] == _drawn_count(side, counts["action_type"])


def test_the_size_window_stays_below_the_nine_point_swatch(make_report, tmp_path):
    """The bound is a measured constant, not a round number that would admit a swatch."""
    assert DEFENSIVE_ACTIONS_MARKER_SPEC.marker_max_pt < 9.0
    assert DEFENSIVE_ACTIONS_MARKER_SPEC.marker_min_pt > 2 * 1.5


def test_white_pitch_spots_inside_a_panel_never_reach_colour_keying(make_report, tmp_path):
    """The penalty and centre spots are FILLED all-Bezier circles inside the panels; only
    `marker_min_pt` keeps them out of `key_outcomes`, which would abort on white."""

    def decorate(side, page, panels):
        x0, y0, x1, y1 = PANEL_RECTS["forced-turnover"]
        for radius in (0.7395, 1.4785):
            page.draw_circle(
                ((x0 + x1) / 2, (y0 + y1) / 2 + radius * 10),
                radius,
                color=(1, 1, 1),
                fill=(1.0, 1.0, 1.0),
            )

    result = _parse(
        make_report(tmp_path / "r.pdf", defensive_actions_decorate=decorate)
    )
    assert result["counts"]["home"]["forced_turnover"]["markers"] == _drawn_count(
        "home", "forced-turnover"
    )


def test_two_markers_at_one_point_stay_two_events(make_report, tmp_path):
    """No dedup, ever (AD-8): this family has no two-tone anatomy to decode, and the
    corpus shows zero coincident pairs — a pair that appears is two real events."""
    markers = {
        "home": {
            "forced-turnover": [(0.4, 0.4), (0.4, 0.4)],
            "possession-regain": [(0.5, 0.5)],
        },
        "away": {"forced-turnover": [(0.3, 0.3)], "possession-regain": [(0.6, 0.6)]},
    }
    result = _parse(
        make_report(tmp_path / "r.pdf", defensive_actions_markers=markers)
    )
    assert result["counts"]["home"]["forced_turnover"]["markers"] == 2


def test_an_off_palette_fill_aborts_with_rgb_and_page(make_report, tmp_path):
    """FR-11: assert-on-unknown stays the seam even for a one-entry palette."""

    def decorate(side, page, panels):
        x0, y0, x1, y1 = PANEL_RECTS["forced-turnover"]
        page.draw_circle(
            ((x0 + x1) / 2, y0 + 40),
            DEFENSIVE_ACTIONS_MARKER_RADIUS,
            color=(1, 1, 1),
            fill=(0.96, 0.74, 0.00),
            width=0.75,
        )

    path = make_report(tmp_path / "r.pdf", defensive_actions_decorate=decorate)
    with pytest.raises(UnknownRgbError) as excinfo:
        _parse(path)
    assert excinfo.value.rgb == (0.96, 0.74, 0.0)
    assert excinfo.value.page_index is not None


def test_a_missing_pitch_frame_fails_loud(make_report, tmp_path):
    path = make_report(tmp_path / "r.pdf", defensive_actions_draw_panels=False)
    with pytest.raises(PitchFrameError):
        _parse(path)


# ------------------------------------------------------------------ panel -> action type


def test_the_label_map_matches_the_contract_enum(repo_root):
    """Frozen literals, cross-checked against the schema (never imported from it)."""
    schema = json.loads(
        (repo_root / "contract" / "common.schema.json").read_text(encoding="utf-8")
    )
    enum = set(schema["$defs"]["DefensiveActionType"]["enum"])
    assert set(DEFENSIVE_ACTION_LABEL_TO_ENUM.values()) == enum
    assert set(MAPPED_ACTION_TYPES) <= enum
    assert set(UNCOUNTED_FAMILIES) <= set(MAPPED_ACTION_TYPES)


def test_an_unknown_panel_title_raises_unknown_label(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_titles={"forced-turnover": "Turnover Regains"},
    )
    with pytest.raises(UnknownLabelError) as excinfo:
        _parse(path)
    assert excinfo.value.label == "Turnover Regains"


def test_an_untitled_panel_raises_unknown_label(make_report, tmp_path):
    """A panel with no title reads as the empty label — never as "the left one"."""
    path = make_report(tmp_path / "r.pdf", defensive_actions_titles={"forced-turnover": None})
    with pytest.raises(UnknownLabelError):
        _parse(path)


def test_a_missing_panel_is_a_layout_error(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_panels=(DEFENSIVE_ACTIONS_PANELS[0],),
    )
    with pytest.raises(DefensiveActionsPageLayoutError):
        _parse(path)


def test_a_duplicated_panel_is_a_layout_error(make_report, tmp_path):
    """Two panels titled the same is a template revision, not a family with two maps."""
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_panels=(
            ("forced-turnover", (40.0, 200.0, 240.0, 500.0)),
            ("forced-turnover", (300.0, 200.0, 500.3, 500.0)),
        ),
    )
    with pytest.raises(DefensiveActionsPageLayoutError):
        _parse(path)


def test_a_third_qualifying_panel_is_a_layout_error(make_report, tmp_path):
    """A page that grows a stroked panel is a layout revision, and must report as one.

    Review patch: the panel COUNT is checked before any title lookup. Previously the
    extra frame's (empty) title was resolved first, so a structural template change
    surfaced as `UnknownLabelError('')` — the wrong typed class, blaming a missing label
    for a missing panel, and the same `error_type` a renamed column emits.
    """
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_panels=DEFENSIVE_ACTIONS_PANELS
        + (("possession-contest", (560.0, 200.0, 760.0, 500.0)),),
    )
    with pytest.raises(DefensiveActionsPageLayoutError) as excinfo:
        _parse(path)
    assert "3 stroked pitch panels" in str(excinfo.value)


def test_an_anchor_resolving_to_two_pages_is_a_layout_error(make_report, tmp_path):
    path = make_report(tmp_path / "r.pdf", defensive_actions_pages={"home": 2})
    with pytest.raises(DefensiveActionsPageLayoutError) as excinfo:
        _parse(path)
    assert excinfo.value.anchor_id == "defensive-actions:home"


# ----------------------------------------------------------------- printed counterparts


def test_the_forced_turnover_headline_is_the_counterpart(make_report, tmp_path):
    result = _parse(make_report(tmp_path / "r.pdf"))
    for side in ("home", "away"):
        counts = result["counts"][side]["forced_turnover"]
        assert counts["table"] == _drawn_count(side, "forced-turnover")
        assert counts["markers"] == counts["table"]


def test_the_possession_regain_family_records_a_documented_absence(make_report, tmp_path):
    """AC 2's absence branch, exact shape: no check, `table: None`, one warning."""
    result = _parse(make_report(tmp_path / "r.pdf"))
    for side in ("home", "away"):
        assert result["counts"][side]["possession_regain"]["table"] is None
    assert result["warnings"] == [ABSENT_COUNTERPART_WARNING]

    checks = defensive_actions_self_validation_block(result["counts"])
    assert {check["family"] for check in checks} == {"forced-turnover"}
    assert all(check["result"] == "pass" for check in checks)


def test_the_absence_never_becomes_a_non_pass_check(make_report, tmp_path):
    """`aggregate_self_validation` is strictly binary: a "not-applicable" check would
    fail the whole record for a counterpart that never existed."""
    result = _parse(make_report(tmp_path / "r.pdf"))
    checks = defensive_actions_self_validation_block(result["counts"])
    assert all(check["result"] in ("pass", "fail") for check in checks)
    assert len(checks) == 2  # one per team, forced-turnover only


def test_a_count_mismatch_is_a_failing_check_carrying_both_counts(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_headline={"home": {"forced-turnover": 99}},
    )
    result = _parse(path)
    checks = defensive_actions_self_validation_block(result["counts"])
    failing = [check for check in checks if check["result"] == "fail"]
    assert len(failing) == 1
    assert failing[0]["team"] == "home"
    assert failing[0]["family"] == "forced-turnover"
    assert failing[0]["table_count"] == 99
    assert failing[0]["marker_count"] == _drawn_count("home", "forced-turnover")


def test_a_missing_headline_value_fails_loud(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_headline={"home": {"forced-turnover": None}},
    )
    with pytest.raises(DefensiveActionsTableError):
        _parse(path)


def test_the_headline_is_never_read_from_a_panel_title(make_report, tmp_path):
    """"Turnovers" prints TWICE on the page — the left panel's title and the headline's
    stacked label — so the lookup is only unambiguous because panel titles are consumed
    first. The fixture is asserted to actually draw both, or the guard proves nothing."""
    path = make_report(tmp_path / "r.pdf")
    doc, anchors = _defensive_actions_anchors(path)
    with doc:
        page = doc[anchors["defensive-actions:home"][0]]
        printed = [word[4] for word in page.get_text("words") if word[4].strip()]
        assert printed.count("Turnovers") == 2
        assert printed.count("Regained") == 1
        result = parse_defensive_actions(doc, anchors, "test", "Mexico", "South Africa")

    assert DEFENSIVE_ACTIONS_PANEL_TITLES["forced-turnover"] == "Forced Turnovers"
    assert result["counts"]["home"]["forced_turnover"]["table"] == _drawn_count(
        "home", "forced-turnover"
    )


def test_the_possession_regain_headline_is_captured_as_evidence(make_report, tmp_path):
    """Task 4.2: BOTH printed totals are staged; only one of them is a counterpart.

    The factory prints the possession-regain headline deliberately unequal to its marker
    count, exactly as every corpus page does. `table` stays None so no check is emitted,
    while `printed_total` keeps the delta on the record for the AD-14 note.
    """
    result = _parse(make_report(tmp_path / "r.pdf"))
    regain = result["counts"]["home"]["possession_regain"]

    assert regain["table"] is None
    assert regain["printed_total"] == regain["markers"] + 2
    assert regain["printed_total"] != regain["markers"]
    assert not [
        check
        for check in defensive_actions_self_validation_block(result["counts"])
        if check["family"] == "possession-regain"
    ]


def test_two_printed_values_over_one_headline_label_are_ambiguous(make_report, tmp_path):
    """Review patch: the headline column must match unambiguously, not merely nearest.

    `candidates` spans the page, so "closest digit wins" would silently accept an
    unrelated number whenever the real value failed to parse as a bare digit run.
    """

    def decorate(side, page, panels):
        page.insert_text(
            (DEFENSIVE_ACTIONS_HEADLINE_XS["forced-turnover"], 130.0), "99", fontsize=7
        )

    path = make_report(tmp_path / "r.pdf", defensive_actions_decorate=decorate)
    with pytest.raises(DefensiveActionsTableError) as excinfo:
        _parse(path)
    assert "ambiguous" in str(excinfo.value)


def test_a_fullwidth_digit_headline_is_rejected(make_report, tmp_path):
    """`re.ASCII` on every digit class: fullwidth digits otherwise satisfy `int()`."""
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_headline={"home": {"forced-turnover": "２"}},
    )
    with pytest.raises(DefensiveActionsTableError):
        _parse(path)


# ------------------------------------------------------------------- the regains table


def test_the_regains_table_is_staged_verbatim(make_report, tmp_path):
    result = _parse(make_report(tmp_path / "r.pdf"))
    expected = default_defensive_action_rows(DEFAULT_DEFENSIVE_ACTIONS_MARKERS["home"])
    rows = result["regain_table_rows"]["home"]
    assert len(rows) == len(expected)
    assert rows[0]["shirt_number"] == expected[0]["shirt"]
    assert rows[0]["player_name"] == expected[0]["name"]
    assert rows[0]["total_possession_regains"] == expected[0]["total"]


def test_the_regains_table_is_never_the_maps_counterpart(make_report, tmp_path):
    """The table counts what the printed Possession Regained total counts, which is NOT
    what the possession-regain map plots — substituting it would manufacture failures."""
    rows = [{"shirt": 7, "name": "Test REGAINER", "total": 41}]
    result = _parse(
        make_report(tmp_path / "r.pdf", defensive_actions_rows={"home": rows, "away": rows})
    )
    assert result["regain_table_rows"]["home"][0]["total_possession_regains"] == 41
    # A table total that differs from the map's marker count is staged, not compared.
    assert result["counts"]["home"]["possession_regain"]["markers"] != 41
    assert result["counts"]["home"]["possession_regain"]["table"] is None
    checks = defensive_actions_self_validation_block(result["counts"])
    assert [check["family"] for check in checks] == ["forced-turnover"] * 2
    assert all(check["result"] == "pass" for check in checks)


def test_a_row_without_a_name_fails_loud(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_rows={"home": [{"shirt": 7, "name": None, "total": 3}]},
    )
    with pytest.raises(DefensiveActionsTableError):
        _parse(path)


def test_a_row_without_a_numeric_total_fails_loud(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_rows={"home": [{"shirt": 7, "name": "Test P", "total": "n/a"}]},
    )
    with pytest.raises(DefensiveActionsTableError):
        _parse(path)


def test_a_fullwidth_digit_total_is_rejected(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_rows={"home": [{"shirt": 7, "name": "Test P", "total": "３"}]},
    )
    with pytest.raises(DefensiveActionsTableError):
        _parse(path)


def test_a_row_of_only_a_shirt_number_fails_loud(make_report, tmp_path):
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_rows={"home": [{"shirt": 7, "name": None, "total": None}]},
    )
    with pytest.raises(DefensiveActionsTableError):
        _parse(path)


def test_a_two_line_name_still_parses_its_row(make_report, tmp_path):
    """Review patch: the name is gathered from the name x-band across neighbouring lines,
    so a name printed off the numeric row line leaves that cluster holding just the shirt
    number and the total. Requiring three cells aborted the whole report on exactly the
    two-line names `_NAME_Y_TOLERANCE_PT` exists to support."""
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_rows={
            "home": [{"shirt": 7, "name": "Test REGAINER", "total": 3, "name_dy": -4.5}]
        },
    )
    rows = _parse(path)["regain_table_rows"]["home"]

    assert rows == [
        {"shirt_number": 7, "player_name": "Test REGAINER", "total_possession_regains": 3}
    ]


def test_a_stray_player_word_left_of_the_table_is_ignored(make_report, tmp_path):
    """Review patch: `player_x` comes from the x-RESTRICTED header cells.

    `table_lines` clusters across the full page width and the middle-column panels do
    share table y-lines on the real page, so a 'Player' printed to the left of the table
    used to win `next()` and start the name band half a page early — sweeping unrelated
    text into every `player_name`, silently, because the staged rows are checked against
    nothing. It must now be ignored, not merely survived.
    """

    def decorate(side, page, panels):
        page.insert_text(
            (300.0, DEFENSIVE_ACTIONS_TABLE_YS["header"]), "Player", fontsize=7
        )

    rows = _parse(make_report(tmp_path / "r.pdf", defensive_actions_decorate=decorate))
    assert rows["regain_table_rows"]["home"] == [
        {"shirt_number": 7, "player_name": "Test REGAINER", "total_possession_regains": 3}
    ]


def test_two_player_headers_inside_the_table_region_fail_loud(make_report, tmp_path):
    """Two 'Player' titles in the table region make the name band undecidable — the
    assert-on-ambiguity rule, rather than picking the leftmost and hoping."""

    def decorate(side, page, panels):
        page.insert_text(
            (800.0, DEFENSIVE_ACTIONS_TABLE_YS["header"]), "Player", fontsize=7
        )

    path = make_report(tmp_path / "r.pdf", defensive_actions_decorate=decorate)
    with pytest.raises(DefensiveActionsTableError) as excinfo:
        _parse(path)
    assert "'Player' column titles" in str(excinfo.value)


def test_an_empty_table_is_valid(make_report, tmp_path):
    result = _parse(make_report(tmp_path / "r.pdf", defensive_actions_rows={"home": []}))
    assert result["regain_table_rows"]["home"] == []


# ------------------------------------------------------------------- margin and clamping


def test_the_margin_admits_a_marker_just_outside_its_panel(make_report, tmp_path):
    """The corpus prints marker centres up to 0.296 pt beyond a panel edge."""
    x0, y0, x1, y1 = PANEL_RECTS["forced-turnover"]
    overshoot_fy = 1.0 + 0.29 / (y1 - y0)
    markers = {
        "home": {"forced-turnover": [(0.5, overshoot_fy)], "possession-regain": [(0.5, 0.5)]},
        "away": {"forced-turnover": [(0.3, 0.3)], "possession-regain": [(0.6, 0.6)]},
    }
    result = _parse(make_report(tmp_path / "r.pdf", defensive_actions_markers=markers))
    assert result["counts"]["home"]["forced_turnover"]["markers"] == 1
    event = next(
        event
        for event in result["defensive_action_events"]
        if event["team_id"] == "mexico" and event["action_type"] == "forced-turnover"
    )
    assert event["x"] == 0.0


def test_a_sub_tolerance_overshoot_clamps():
    assert _clamp_coord(100.0 + COORD_CLAMP_TOLERANCE / 2, "x", "r", 1) == 100.0
    assert _clamp_coord(-COORD_CLAMP_TOLERANCE / 2, "y", "r", 1) == 0.0


def test_a_beyond_tolerance_coordinate_raises():
    with pytest.raises(DefensiveActionsCoordinateError) as excinfo:
        _clamp_coord(100.0 + COORD_CLAMP_TOLERANCE + 0.1, "x", "r", 7)
    assert excinfo.value.axis == "x"
    assert excinfo.value.page_index == 7


def test_the_shots_margin_default_is_unchanged():
    """`pitch_margin_pt` is per-family tuning; shots keep the strict containment they
    shipped with."""
    assert SHOTS_MARKER_SPEC.pitch_margin_pt == 0.0
    assert DEFENSIVE_ACTIONS_MARKER_SPEC.pitch_margin_pt > 0.0


# ------------------------------------------------------------------ AD-6 orientation


def test_defensive_actions_land_predominantly_in_the_teams_own_half(mex_rsa_pdf):
    """The physical invariant: under AD-6 (x=100 at the opponent's goal line) possession
    regains cluster in the team's OWN half. Distribution only, never coordinates."""
    doc, anchors = _defensive_actions_anchors(mex_rsa_pdf)
    with doc:
        result = parse_defensive_actions(
            doc, anchors, "PMSR-M01-MEX-V-RSA", "Mexico", "South Africa"
        )
    regains = [
        event
        for event in result["defensive_action_events"]
        if event["action_type"] == "possession-regain"
    ]
    own_half = sum(1 for event in regains if event["x"] < 50)
    assert own_half / len(regains) > 0.5


@pytest.mark.parametrize("action_type", MAPPED_ACTION_TYPES)
def test_a_mirrored_panel_fails_loud(make_report, tmp_path, action_type):
    """Review decision: every panel's own DIRECTION label is asserted before normalizing.

    Both families are covered deliberately. The possession-regain map has a physical
    own-half invariant a mirrored panel would visibly break, but the forced-turnover map
    has none by design (a high-pressing team forces turnovers in the opponent's half), so
    a 180-degree flip there would publish `100 - x` for every event it holds with nothing
    detecting it: the count check is orientation-blind, `_clamp_coord` passes either way,
    and no gate check reads coordinates.
    """
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_direction={"home": {action_type: 270}},
    )
    with pytest.raises(DefensiveActionsPageLayoutError) as excinfo:
        _parse(path)
    assert action_type in str(excinfo.value)
    assert "re-oriented" in str(excinfo.value)


@pytest.mark.parametrize("action_type", MAPPED_ACTION_TYPES)
def test_a_panel_without_a_direction_label_fails_loud(make_report, tmp_path, action_type):
    """No label is no evidence: the orientation cannot be confirmed, so it is not assumed."""
    path = make_report(
        tmp_path / "r.pdf",
        defensive_actions_direction={"home": {action_type: None}},
    )
    with pytest.raises(DefensiveActionsPageLayoutError) as excinfo:
        _parse(path)
    assert "0 'DIRECTION' labels" in str(excinfo.value)


def test_the_ground_truth_panels_both_carry_the_asserted_direction(mex_rsa_pdf):
    """The corpus evidence the parser now depends on, pinned rather than left in prose."""
    doc, anchors = _defensive_actions_anchors(mex_rsa_pdf)
    with doc:
        for anchor_id in ("defensive-actions:home", "defensive-actions:away"):
            page = doc[anchors[anchor_id][0]]
            frames = detect_pitch_frames(page, "PMSR-M01-MEX-V-RSA")
            directions = _panel_directions(page)
            assert len(frames) == 2
            for pitch in frames:
                inside = [
                    direction
                    for center_x, center_y, direction in directions
                    if pitch.x0 <= center_x <= pitch.x1 and pitch.y0 <= center_y <= pitch.y1
                ]
                assert len(inside) == 1
                assert inside[0] == pytest.approx(_DIRECTION_VECTOR, abs=1e-6)


# ------------------------------------------------------------------------- ground truth


def test_ground_truth_counts(mex_rsa_pdf):
    """mex_rsa defensive-actions counts (AR-16: counts and distribution only).

    Task 1 census values: the forced-turnover maps carry 31 (home) and 32 (away) markers
    and match the page's printed Forced Turnovers total exactly; the possession-regain
    maps carry 47 and 46 and match no printed total, so they record the documented
    absence instead.
    """
    doc, anchors = _defensive_actions_anchors(mex_rsa_pdf)
    with doc:
        result = parse_defensive_actions(
            doc, anchors, "PMSR-M01-MEX-V-RSA", "Mexico", "South Africa"
        )

    counts = result["counts"]
    assert counts["home"]["forced_turnover"] == {
        "action_type": "forced-turnover",
        "markers": 31,
        "printed_total": 31,
        "table": 31,
    }
    assert counts["away"]["forced_turnover"] == {
        "action_type": "forced-turnover",
        "markers": 32,
        "printed_total": 32,
        "table": 32,
    }
    assert counts["home"]["possession_regain"]["markers"] == 47
    assert counts["away"]["possession_regain"]["markers"] == 46
    assert counts["home"]["possession_regain"]["table"] is None
    # The printed "Possession Regained" total is captured as evidence even though it is
    # not a counterpart: 37 against a 47-marker map is the delta Task 1.2 measured, and
    # keeping it on the record is what makes the AD-14 note re-checkable without a probe.
    assert counts["home"]["possession_regain"]["printed_total"] == 37
    assert counts["away"]["possession_regain"]["printed_total"] == 41
    assert len(result["defensive_action_events"]) == 31 + 32 + 47 + 46
    assert len(result["regain_table_rows"]["home"]) == 16
    assert sum(
        row["total_possession_regains"] for row in result["regain_table_rows"]["home"]
    ) == 37

    checks = defensive_actions_self_validation_block(counts)
    assert [check["result"] for check in checks] == ["pass", "pass"]

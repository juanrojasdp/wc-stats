"""Story 1.13: the two receiving page-family parsers (ACs 1-3).

Synthetic-first, and every expected value is DERIVED from what the factory drew
(`default_offers_block` / `default_movement_block` over this report's own Domain G rows)
rather than restated as a second literal. The ground-truth tests at the end assert the
m001 figures re-derived by the Task 1 corpus probe — values and counts only, never
coordinates (AR-16).
"""

from __future__ import annotations

import json

import pymupdf
import pytest

from conftest import (
    RECEIVING_DOT_OFFSETS,
    RECEIVING_GRID_ROW_TOPS,
    RECEIVING_MOVEMENT_LABELS,
    RECEIVING_OFFERS_PANELS,
    RECEIVING_ROW_TOP0,
    RECEIVING_THIRD_LABELS,
    default_movement_block,
    default_offers_block,
)
from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.errors import MissingAnchorError
from pipeline.discover.probe import probe_report
from pipeline.discover.text import PageTextIndex
from pipeline.markers.attempts import table_lines
from pipeline.markers.errors import (
    ReceivingPageLayoutError,
    ReceivingTableError,
    UnknownLabelError,
    UnknownRgbError,
)
from pipeline.markers.filter_chain import detect_pitch_frames
from pipeline.markers.receiving import (
    MOVEMENT_LABEL_TO_ENUM,
    OFFERS_DECORATION_DOTS_PER_PANEL,
    PITCH_THIRD_LABEL_TO_ENUM,
    parse_movement,
    parse_offers,
    receiving_domain,
    receiving_self_validation_block,
)

# --------------------------------------------------------------------------- helpers


def _receiving(pdf):
    """`(domain, report_id)` for a report on disk — both parsers plus the merge."""
    meta = probe_report(pdf)
    resolved = resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)
    with pymupdf.open(pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        # An unresolved anchor is simply ABSENT from the record's map (the
        # `extract_report._resolve_anchor_pages` shape), which is what the parser must
        # see — not an exception raised on its behalf.
        anchors = {}
        for anchor in resolved:
            if anchor.anchor_id.split(":")[0] not in ("offers", "movement"):
                continue
            try:
                anchors[anchor.anchor_id] = index.find_all(
                    anchor.text, at_start=anchor.at_page_start
                )
            except MissingAnchorError:
                continue
        return (
            receiving_domain(
                parse_offers(doc, anchors, meta.report_id, meta.home_team, meta.away_team),
                parse_movement(doc, anchors, meta.report_id, meta.home_team, meta.away_team),
            ),
            meta.report_id,
        )


def _expect_error(pdf, error_type):
    with pytest.raises(error_type) as excinfo:
        _receiving(pdf)
    return excinfo.value


def _report(make_report, tmp_path, name="PMSR-M01-MEX-V-RSA.pdf", **kwargs):
    path = tmp_path / name
    make_report(path, **kwargs)
    return path


def _player_rows(pdf, side="home"):
    """The Domain G rows the factory printed for `side` — the source every default
    receiving value is derived from."""
    from conftest import default_lineup_sides, default_player_stats_rows

    from pipeline.extract.domain_b import extract_domain_b

    meta = probe_report(pdf)
    resolved = resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)
    with pymupdf.open(pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        anchors = {
            anchor.anchor_id: index.find_all(anchor.text, at_start=anchor.at_page_start)
            for anchor in resolved
        }
        stats = extract_domain_b(doc, anchors, meta.report_id, meta.home_team, meta.away_team)
    sides = default_lineup_sides(
        meta.home_team, meta.away_team, meta.home_score, meta.away_score
    )
    return default_player_stats_rows(sides, stats)[side]


# ------------------------------------------------------------------- AC 1: happy path


def test_both_families_parse_for_both_teams(make_report, tmp_path):
    pdf = _report(make_report, tmp_path)

    domain, _report_id = _receiving(pdf)

    assert sorted(domain) == ["counts", "movement", "offers"]
    for side, team_id in (("home", "mexico"), ("away", "south-africa")):
        offers = domain["offers"][side]
        movement = domain["movement"][side]
        # AD-6: `teamId` is the RECEIVING player's team, which on both families is the
        # team the anchor names.
        assert offers["team_id"] == team_id
        assert movement["team_id"] == team_id
        # The `offer | movement` discriminator survives as a staged VALUE on each side
        # block (there is no per-event row to carry it).
        assert offers["type"] == "offer"
        assert movement["type"] == "movement"


def test_offers_values_are_what_the_page_printed(make_report, tmp_path):
    pdf = _report(make_report, tmp_path)
    expected = default_offers_block(_player_rows(pdf))

    offers = _receiving(pdf)[0]["offers"]["home"]

    for key in (
        "total_offers_made",
        "total_offers_received",
        "offers_final_third",
        "offers_middle_third",
        "offers_defensive_third",
        "offers_inside_shape",
        "offers_outside_shape",
    ):
        assert offers[key] == expected[key], key
    assert offers["most_offers"] == expected["most_offers"]
    assert [
        (row["shirt_number"], row["player_name"], row["offers_made"], row["offers_received"])
        for row in offers["table_rows"]
    ] == [(row["shirt"], row["name"], row["made"], row["received"]) for row in expected["rows"]]


def test_movement_values_are_what_the_page_printed(make_report, tmp_path):
    pdf = _report(make_report, tmp_path)
    expected = default_movement_block(_player_rows(pdf))

    movement = _receiving(pdf)[0]["movement"]["home"]

    assert movement["total_movements"] == expected["total_movements"]
    assert movement["by_phase"] == {
        "final_third": expected["by_phase"]["Final Third Phase"],
        "progression": expected["by_phase"]["Progression Phase"],
        "build_up": expected["by_phase"]["Build Up Phase"],
    }
    assert len(movement["by_third_and_type"]) == 15
    drawn = {
        (PITCH_THIRD_LABEL_TO_ENUM[third], code): count
        for (third, code), count in expected["grid"].items()
    }
    assert {
        (cell["pitch_third"], cell["movement_type"]): cell["count"]
        for cell in movement["by_third_and_type"]
    } == drawn
    assert [
        (row["movement_type"], row["shirt_number"], row["movements"])
        for row in movement["top_ranked_players"]
    ] == [
        (dict(RECEIVING_MOVEMENT_LABELS)[row["label"]], row["shirt"], row["movements"])
        for row in expected["top_ranked"]
    ]


def test_record_order_is_deterministic(make_report, tmp_path):
    """AD-8: pitch thirds in PRINTED order, then movement type; no dedup anywhere."""
    pdf = _report(make_report, tmp_path)

    movement = _receiving(pdf)[0]["movement"]["home"]

    printed_thirds = [PITCH_THIRD_LABEL_TO_ENUM[label] for label, _y in RECEIVING_THIRD_LABELS]
    keys = [(cell["pitch_third"], cell["movement_type"]) for cell in movement["by_third_and_type"]]
    assert keys == sorted(keys, key=lambda k: (printed_thirds.index(k[0]), k[1]))


# ---------------------------------------------- AC 1: the shared chain and its census


def test_the_page_really_presents_four_qualifying_rects_for_two_panels(make_report, tmp_path):
    """The de-duplication is per-family tuning, so the fixture must reproduce the input
    that makes it necessary — otherwise the dedup could be deleted and stay green."""
    pdf = _report(make_report, tmp_path)
    meta = probe_report(pdf)
    resolved = resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)
    with pymupdf.open(pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        page_index = index.find_all(
            next(a.text for a in resolved if a.anchor_id == "offers:home")
        )[0]
        frames = detect_pitch_frames(doc[page_index], meta.report_id)
        distinct = {tuple(round(v, 2) for v in (r.x0, r.y0, r.x1, r.y1)) for r in frames}

    assert len(frames) == 4
    assert len(distinct) == 2


def test_a_third_distinct_panel_is_a_layout_error(make_report, tmp_path):
    pdf = _report(
        make_report,
        tmp_path,
        offers_panels=RECEIVING_OFFERS_PANELS + (("extra", (60.0, 222.75, 220.0, 497.25)),),
    )

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert "3 distinct stroked panels" in str(error)


def test_panel_typing_is_text_anchored_not_positional(make_report, tmp_path):
    """Swap the two printed titles: the badges must follow the TITLES, not the x order."""
    plain = _report(make_report, tmp_path)
    baseline = _receiving(plain)[0]["offers"]["home"]

    swapped = _report(
        make_report,
        tmp_path,
        name="PMSR-M02-MEX-V-RSA.pdf",
        offers_titles={
            "offers_inside_shape": "Offers Made Outside Shape",
            "offers_outside_shape": "Offers Made Inside Shape",
        },
    )
    offers = _receiving(swapped)[0]["offers"]["home"]

    # The badge VALUES swap with the titles, proving the mapping is read from the printed
    # text rather than from which panel sits on the left (AD-8).
    assert offers["offers_inside_shape"] == baseline["offers_outside_shape"]
    assert offers["offers_outside_shape"] == baseline["offers_inside_shape"]


def test_an_unknown_panel_title_is_an_unknown_label(make_report, tmp_path):
    pdf = _report(
        make_report, tmp_path, offers_titles={"offers_inside_shape": "Offers Made In Formation"}
    )

    error = _expect_error(pdf, UnknownLabelError)

    assert error.column == "Offers panel title"
    assert error.label == "Offers Made In Formation"


def test_a_duplicated_panel_title_is_a_layout_error(make_report, tmp_path):
    pdf = _report(
        make_report, tmp_path, offers_titles={"offers_inside_shape": "Offers Made Outside Shape"}
    )

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert "twice" in str(error)


@pytest.mark.parametrize("count", [10, 12])
def test_the_eleven_dot_census_is_a_tripwire(make_report, tmp_path, count):
    """A panel that stops drawing exactly 11 decoration dots may be drawing real markers,
    and silence would be the worst outcome — so the parser aborts loud."""
    offsets = (
        RECEIVING_DOT_OFFSETS[:count]
        if count < len(RECEIVING_DOT_OFFSETS)
        else RECEIVING_DOT_OFFSETS + ((0.4, 0.4),)
    )
    pdf = _report(make_report, tmp_path, offers_dots={"offers_inside_shape": offsets})

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert f"holds {count} decoration circles" in str(error)
    assert str(OFFERS_DECORATION_DOTS_PER_PANEL) in str(error)


def test_moving_one_dot_breaks_the_identical_position_assertion(make_report, tmp_path):
    moved = ((0.31, 0.28),) + RECEIVING_DOT_OFFSETS[1:]
    pdf = _report(make_report, tmp_path, offers_dots={"offers_inside_shape": moved})

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert "decoration positions differ" in str(error)


def test_an_off_palette_decoration_fill_is_unknown_rgb(make_report, tmp_path):
    """FR-11: assert-on-unknown, carrying the RGB and the page."""
    pdf = _report(
        make_report, tmp_path, offers_dot_rgbs={"offers_inside_shape": {3: (0.91, 0.12, 0.44)}}
    )

    error = _expect_error(pdf, UnknownRgbError)

    assert error.rgb == (0.91, 0.12, 0.44)
    assert error.page_index is not None
    assert error.report_id == "PMSR-M01-MEX-V-RSA"


def test_the_white_in_panel_spots_never_reach_the_palette(make_report, tmp_path):
    """The penalty and centre spots are FILLED all-Bezier circles inside the panels, and
    only `marker_min_pt` excludes them; admitting either aborts on a white fill."""
    pdf = _report(make_report, tmp_path)

    domain, _report_id = _receiving(pdf)

    assert domain["offers"]["home"]["total_offers_made"] > 0


# ------------------------------------------------------- AC 1: label-anchored KPI reads


def test_the_two_line_defensive_third_label_still_finds_its_value(make_report, tmp_path):
    """`Offers Made in Defensive Third` wraps onto two lines; the anchor is the first
    line only, which puts its run centre 11 pt off the value's."""
    pdf = _report(make_report, tmp_path)
    expected = default_offers_block(_player_rows(pdf))

    offers = _receiving(pdf)[0]["offers"]["home"]

    assert offers["offers_defensive_third"] == expected["offers_defensive_third"]


def test_a_missing_kpi_value_is_a_table_error(make_report, tmp_path):
    pdf = _report(
        make_report, tmp_path, offers_values={"home": {"offers_middle_third": None}}
    )

    error = _expect_error(pdf, ReceivingTableError)

    assert "Offers Made in Middle Third" in str(error)


def test_a_missing_shape_badge_is_a_table_error(make_report, tmp_path):
    pdf = _report(make_report, tmp_path, offers_values={"home": {"offers_inside_shape": None}})

    error = _expect_error(pdf, ReceivingTableError)

    assert "0 digit words" in str(error)


def test_the_most_offers_block_stages_its_position_verbatim(make_report, tmp_path):
    """`position` is NOT mapped to the contract's `Position` vocabulary here — that
    vocabulary and its `UnknownPositionError` belong to Domain A (Story 1.6)."""
    pdf = _report(
        make_report,
        tmp_path,
        offers_most={
            "home": {"value": 41, "player_name": "Julian QUINONES", "position": "LEFT WINGER"}
        },
    )

    most = _receiving(pdf)[0]["offers"]["home"]["most_offers"]

    assert most == {"value": 41, "player_name": "Julian QUINONES", "position": "LEFT WINGER"}


def test_a_truncated_most_offers_block_is_a_table_error(make_report, tmp_path):
    pdf = _report(
        make_report,
        tmp_path,
        offers_most={"home": {"value": 41, "player_name": "Julian QUINONES", "position": None}},
    )

    error = _expect_error(pdf, ReceivingTableError)

    assert "'Most Offers' block holds 2 lines" in str(error)


# --------------------------------------------------------- AC 1: the offers table rules


def test_the_fixture_really_collides_a_kpi_value_with_the_first_table_row(
    make_report, tmp_path
):
    """The x-restriction's regression must actually bite.

    On the real page the left KPI column prints its value at y=126.8 while the first
    table row prints at y=126.0 — 0.8 pt apart, INSIDE the shared 3 pt `table_lines`
    tolerance — so an x-unrestricted leftmost-digit rule glues two KPI values into the
    first player row. If this assertion ever fails, the regression below has stopped
    testing anything.
    """
    pdf = _report(make_report, tmp_path)
    meta = probe_report(pdf)
    resolved = resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)
    with pymupdf.open(pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        page_index = index.find_all(
            next(a.text for a in resolved if a.anchor_id == "offers:home")
        )[0]
        lines = table_lines(doc[page_index])

    row_cluster = [
        cells for y, cells in lines if abs(y - RECEIVING_ROW_TOP0) <= 3.0
    ]
    assert len(row_cluster) == 1
    xs = [x for x, _word in row_cluster[0]]
    assert min(xs) < 200.0, "no KPI value shares the first table row's cluster"
    assert max(xs) > 600.0, "the first table row is not in this cluster"


def test_the_kpi_column_is_not_glued_into_the_first_table_row(make_report, tmp_path):
    pdf = _report(make_report, tmp_path)
    expected = default_offers_block(_player_rows(pdf))

    rows = _receiving(pdf)[0]["offers"]["home"]["table_rows"]

    assert len(rows) == len(expected["rows"])
    assert rows[0]["shirt_number"] == expected["rows"][0]["shirt"]
    assert rows[0]["offers_made"] == expected["rows"][0]["made"]


def test_a_three_line_player_name_is_reunited_from_the_name_band(make_report, tmp_path):
    """Four corpus pages print a three-line name whose halves straddle the numeric row,
    leaving that cluster with no name at all."""
    rows = [
        {"shirt": 16, "name_split": ("Marcus HOLMGREN", "PEDERSEN"), "made": 20, "received": 8},
        {"shirt": 7, "name": "Test PLAYER", "made": 10, "received": 5},
    ]
    pdf = _report(make_report, tmp_path, offers_rows={"home": rows})

    parsed = _receiving(pdf)[0]["offers"]["home"]["table_rows"]

    assert parsed[0]["player_name"] == "Marcus HOLMGREN PEDERSEN"
    assert parsed[0]["shirt_number"] == 16
    assert parsed[1]["player_name"] == "Test PLAYER"


def test_a_row_with_no_name_anywhere_is_a_table_error(make_report, tmp_path):
    pdf = _report(
        make_report,
        tmp_path,
        offers_rows={"home": [{"shirt": 9, "name": None, "made": 10, "received": 5}]},
    )

    error = _expect_error(pdf, ReceivingTableError)

    assert "no player name" in str(error)


def test_the_percentage_column_is_parsed_explicitly(make_report, tmp_path):
    """`30.8%`, `50%` and `0%` never match a bare digit run, so a `\\d+` filter would drop
    the column and mis-shape every row."""
    rows = [
        {"shirt": 1, "name": "Test ONE", "made": 13, "received": 4},
        {"shirt": 2, "name": "Test TWO", "made": 6, "received": 3},
        {"shirt": 3, "name": "Test THREE", "made": 0, "received": 0},
    ]
    pdf = _report(make_report, tmp_path, offers_rows={"home": rows})

    parsed = _receiving(pdf)[0]["offers"]["home"]["table_rows"]

    assert [row["made_received_pct"] for row in parsed] == [30.8, 50.0, 0.0]


def test_a_row_missing_its_percentage_is_a_table_error(make_report, tmp_path):
    pdf = _report(
        make_report,
        tmp_path,
        offers_rows={"home": [{"shirt": 9, "name": "Test P", "made": 10, "received": 5, "pct": None}]},
    )

    error = _expect_error(pdf, ReceivingTableError)

    assert "one percentage" in str(error)


def test_fullwidth_digits_are_rejected_as_a_shirt_number(make_report, tmp_path):
    """`re.ASCII` everywhere: fullwidth digits otherwise satisfy `\\d` and `int()` takes
    them happily, so a doctored shirt number would parse to a plausible integer."""
    rows = [{"shirt": "１６", "name": "Test WIDE", "made": 20, "received": 8}]
    pdf = _report(make_report, tmp_path, offers_rows={"home": rows})

    # The row is not admitted at all (its leading cell is not an ASCII digit run), so the
    # table sums to zero and the reconciliation fails loud rather than staging 16.
    domain, _report_id = _receiving(pdf)
    assert domain["offers"]["home"]["table_rows"] == []
    assert domain["counts"]["home"]["offers"]["table_made_sum"] == 0


def test_a_missing_table_header_is_a_table_error(make_report, tmp_path):
    def drop_header(side, page, panels):
        page.add_redact_annot(pymupdf.Rect(660.0, 88.0, 720.0, 112.0))
        page.apply_redactions()

    pdf = _report(make_report, tmp_path, offers_decorate=drop_header)

    error = _expect_error(pdf, ReceivingTableError)

    assert "'#' and 'Player'" in str(error)


# ------------------------------------------------------------ AC 1: the movement family


def test_the_movement_label_map_matches_the_contract_and_omits_no_movement(repo_root):
    """Frozen literals, never schema imports — but a test keeps them honest.

    `no-movement` is the contract's sixth value and this page NEVER prints it:
    reconciliation #8 proves the grid equals Domain G's FIVE-type sum on 208/208 pages
    and never its six-type sum. The absence is asserted, not merely unmentioned.
    """
    schema = json.loads((repo_root / "contract" / "common.schema.json").read_text("utf-8"))
    contract_values = schema["$defs"]["OfferMovementType"]["enum"]

    assert set(MOVEMENT_LABEL_TO_ENUM.values()) < set(contract_values)
    assert set(contract_values) - set(MOVEMENT_LABEL_TO_ENUM.values()) == {"no-movement"}
    assert "no-movement" not in MOVEMENT_LABEL_TO_ENUM.values()


def test_the_movement_panel_holds_the_axis_ticks_the_grid_must_ignore(make_report, tmp_path):
    """33 tick digits sit inside the panel beside the 15 grid values — the reason the
    grid is read label-anchored rather than by visual row."""
    pdf = _report(make_report, tmp_path)
    meta = probe_report(pdf)
    resolved = resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)
    with pymupdf.open(pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        page_index = index.find_all(
            next(a.text for a in resolved if a.anchor_id == "movement:home")
        )[0]
        page = doc[page_index]
        [panel] = detect_pitch_frames(page, meta.report_id)
        digits = [
            word
            for x0, y0, x1, y1, word, *_ in page.get_text("words")
            if word.isdigit()
            and panel.x0 <= (x0 + x1) / 2 <= panel.x1
            and panel.y0 <= (y0 + y1) / 2 <= panel.y1
        ]

    assert len(digits) == 15 + 33


def test_a_mis_oriented_direction_label_is_a_layout_error(make_report, tmp_path):
    """A re-oriented panel would swap `final-third` and `defensive-third` on every grid
    row while every reconciliation still passed — the grid sum is orientation-blind."""
    pdf = _report(make_report, tmp_path, movement_direction={"home": 270})

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert "re-oriented" in str(error)


def test_a_missing_direction_label_is_a_layout_error(make_report, tmp_path):
    pdf = _report(make_report, tmp_path, movement_direction={"home": None})

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert "0 'DIRECTION' labels" in str(error)


def test_a_missing_pitch_third_label_is_a_layout_error(make_report, tmp_path):
    pdf = _report(
        make_report, tmp_path, movement_third_labels=RECEIVING_THIRD_LABELS[:2]
    )

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert "rotated third labels" in str(error)


def test_an_unknown_movement_panel_title_is_an_unknown_label(make_report, tmp_path):
    pdf = _report(make_report, tmp_path, movement_panel_title="Movement Types By Zone")

    error = _expect_error(pdf, UnknownLabelError)

    assert error.column == "Movement panel title"


def test_a_missing_grid_value_is_a_table_error(make_report, tmp_path):
    third = next(iter(RECEIVING_GRID_ROW_TOPS))
    pdf = _report(make_report, tmp_path, movement_grid={"home": {(third, "in-front"): None}})

    error = _expect_error(pdf, ReceivingTableError)

    assert "'In Front'" in str(error)
    assert "0 values" in str(error)


def test_a_missing_donut_centre_total_is_a_table_error(make_report, tmp_path):
    pdf = _report(make_report, tmp_path, movement_donuts={"home": {"Progression Phase": None}})

    error = _expect_error(pdf, ReceivingTableError)

    assert "'Progression Phase' donut holds 0 digit words" in str(error)


def test_a_short_top_ranked_table_is_a_table_error(make_report, tmp_path):
    pdf = _report(
        make_report,
        tmp_path,
        movement_top_rows={
            "home": [
                {"label": label, "shirt": 7, "name": "Test P", "movements": 3}
                for label, _code in RECEIVING_MOVEMENT_LABELS[:4]
            ]
        },
    )

    error = _expect_error(pdf, ReceivingTableError)

    assert "admitted 4 rows" in str(error)


def test_the_rotated_third_labels_are_not_swept_into_a_top_ranked_row(make_report, tmp_path):
    """The rotated `... THIRD` labels extract LEFT of the panel's own x0, so the table's
    right bound cannot be the panel edge — it comes from the header's own last column."""
    pdf = _report(make_report, tmp_path)

    rows = _receiving(pdf)[0]["movement"]["home"]["top_ranked_players"]

    assert len(rows) == 5
    assert all("THIRD" not in row["player_name"] for row in rows)


# ---------------------------------------------------- AC 1/2: anchor and page contract


@pytest.mark.parametrize("anchor_id", ["offers:home", "movement:away"])
def test_a_missing_receiving_anchor_is_a_layout_error(make_report, tmp_path, anchor_id):
    pdf = _report(make_report, tmp_path, drop_anchor_ids=(anchor_id,))

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert error.anchor_id == anchor_id
    assert error.pages is None


@pytest.mark.parametrize(
    "kwargs, anchor_id",
    [
        ({"offers_pages": {"home": 2}}, "offers:home"),
        ({"movement_pages": {"away": 2}}, "movement:away"),
    ],
)
def test_a_duplicated_receiving_page_is_a_layout_error(make_report, tmp_path, kwargs, anchor_id):
    pdf = _report(make_report, tmp_path, **kwargs)

    error = _expect_error(pdf, ReceivingPageLayoutError)

    assert error.anchor_id == anchor_id
    assert len(error.pages) == 2


# --------------------------------------------------- AC 2: the seven Self-Validation ids


def _checks(domain, player_stats=None, check_id=None, team="home"):
    return [
        check
        for check in receiving_self_validation_block(domain["counts"], player_stats=player_stats)
        if (check_id is None or check["check"] == check_id) and check["team"] == team
    ]


def test_the_five_page_internal_checks_pass_with_both_operands(make_report, tmp_path):
    pdf = _report(make_report, tmp_path)
    domain, _report_id = _receiving(pdf)

    checks = receiving_self_validation_block(domain["counts"])

    assert {check["check"] for check in checks} == {
        "receiving-offers-thirds-sum",
        "receiving-offers-shape-sum",
        "receiving-offers-table-sum",
        "receiving-movement-grid-total",
        "receiving-offers-table-pct",
    }
    assert all(check["result"] == "pass" for check in checks)
    for check in checks:
        if check["check"] == "receiving-offers-table-pct":
            assert check["rows_checked"] > 0
            assert check["rows_matching"] == check["rows_checked"]
        else:
            # Both operands always present, pass or fail (FR-14, AD-8).
            assert isinstance(check["page_value"], int)
            assert isinstance(check["counterpart"], int)
    # The made/received split is TWO checks: a merged one could not say which failed.
    table_sums = [c for c in checks if c["check"] == "receiving-offers-table-sum"]
    assert {c["column"] for c in table_sums} == {"offers_made", "offers_received"}


@pytest.mark.parametrize(
    "key, check_id",
    [
        ("offers_final_third", "receiving-offers-thirds-sum"),
        ("offers_inside_shape", "receiving-offers-shape-sum"),
    ],
)
def test_a_broken_offers_sum_fails_with_both_operands(make_report, tmp_path, key, check_id):
    expected = default_offers_block(_player_rows(_report(make_report, tmp_path)))
    pdf = _report(
        make_report,
        tmp_path,
        name="PMSR-M03-MEX-V-RSA.pdf",
        offers_values={"home": {key: expected[key] + 5}},
    )
    domain, _report_id = _receiving(pdf)

    check = _checks(domain, check_id=check_id)[0]

    assert check["result"] == "fail"
    assert check["page_value"] == check["counterpart"] + 5


def test_a_broken_table_sum_names_the_column_that_failed(make_report, tmp_path):
    base = default_offers_block(_player_rows(_report(make_report, tmp_path)))
    rows = [dict(row) for row in base["rows"]]
    rows[0]["received"] = rows[0]["received"] + 3
    rows[0]["pct"] = "42.9%"  # keep the percentage check independent of this one
    pdf = _report(
        make_report, tmp_path, name="PMSR-M04-MEX-V-RSA.pdf", offers_rows={"home": rows}
    )
    domain, _report_id = _receiving(pdf)

    checks = {c["column"]: c for c in _checks(domain, check_id="receiving-offers-table-sum")}

    assert checks["offers_made"]["result"] == "pass"
    assert checks["offers_received"]["result"] == "fail"
    assert checks["offers_received"]["page_value"] == checks["offers_received"]["counterpart"] + 3


def test_a_broken_grid_total_fails_with_both_operands(make_report, tmp_path):
    third = next(iter(RECEIVING_GRID_ROW_TOPS))
    pdf = _report(make_report, tmp_path, movement_grid={"home": {(third, "in-front"): 999}})
    domain, _report_id = _receiving(pdf)

    check = _checks(domain, check_id="receiving-movement-grid-total")[0]

    assert check["result"] == "fail"
    assert check["page_value"] != check["counterpart"]


def test_the_percentage_check_is_exact_and_records_its_mismatch(make_report, tmp_path):
    rows = [{"shirt": 1, "name": "Test ONE", "made": 13, "received": 4, "pct": "31.8%"}]
    pdf = _report(make_report, tmp_path, offers_rows={"home": rows})
    domain, _report_id = _receiving(pdf)

    check = _checks(domain, check_id="receiving-offers-table-pct")[0]

    assert check["result"] == "fail"
    assert check["rows_checked"] == 1
    assert check["rows_matching"] == 0
    assert check["mismatches"] == [{"shirt_number": 1, "printed": 31.8, "computed": 30.8}]


def test_rows_printing_zero_offers_made_are_skipped_and_counted(make_report, tmp_path):
    """81 corpus rows print `offers_made == 0`, where the ratio is undefined. The check
    skips exactly those and says how many — never a bare division, never a coerced 0.0."""
    rows = [
        {"shirt": 1, "name": "Test ONE", "made": 13, "received": 4},
        {"shirt": 2, "name": "Test TWO", "made": 0, "received": 0},
        {"shirt": 3, "name": "Test THREE", "made": 0, "received": 0},
    ]
    pdf = _report(make_report, tmp_path, offers_rows={"home": rows})
    domain, _report_id = _receiving(pdf)

    check = _checks(domain, check_id="receiving-offers-table-pct")[0]

    assert check["result"] == "pass"
    assert check["rows_checked"] == 1
    assert check["rows_skipped_zero_made"] == 2


def test_the_two_documented_absences_emit_no_check_and_one_warning_each(make_report, tmp_path):
    """AC 2's absence branch. `aggregate_self_validation` is strictly binary, so a
    "not-applicable" check would fail every record in the corpus."""
    pdf = _report(make_report, tmp_path)
    meta = probe_report(pdf)
    resolved = resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)
    with pymupdf.open(pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        anchors = {
            anchor.anchor_id: index.find_all(anchor.text, at_start=anchor.at_page_start)
            for anchor in resolved
            if anchor.anchor_id.split(":")[0] in ("offers", "movement")
        }
        offers = parse_offers(doc, anchors, meta.report_id, meta.home_team, meta.away_team)
        movement = parse_movement(doc, anchors, meta.report_id, meta.home_team, meta.away_team)
    domain = receiving_domain(offers, movement)

    # Recorded as explicit `None` counterparts in `counts` ...
    for side in ("home", "away"):
        assert domain["counts"][side]["movement"]["donut_slice_table"] is None
        assert domain["counts"][side]["movement"]["phase_partition_table"] is None
    # ... plus exactly one warning each per REPORT, not per side ...
    assert len(movement["warnings"]) == 2
    assert sum("raster" in w for w in movement["warnings"]) == 1
    assert sum("partition" in w for w in movement["warnings"]) == 1
    # ... and NO check mentions either.
    checks = receiving_self_validation_block(domain["counts"])
    assert all(check["result"] == "pass" for check in checks)
    assert not [c for c in checks if "phase" in c["check"] or "donut" in c["check"]]


def test_the_phase_totals_are_deliberately_not_a_partition(make_report, tmp_path):
    """The corpus delta ranges -48..+314 and is zero on 3 of 208 pages, so a fixture whose
    phases summed to the total would quietly bless the check AC 2 forbids."""
    pdf = _report(make_report, tmp_path)

    counts = _receiving(pdf)[0]["counts"]["home"]["movement"]

    # Asserted against `by_phase` directly: `counts` deliberately stages NO `phase_sum`
    # (2026-07-27 review ruling), because Task 7.4's filing forbids downstream surfaces
    # from summing these totals and a staged sum is what invites it.
    by_phase = _receiving(pdf)[0]["movement"]["home"]["by_phase"]
    assert sum(by_phase.values()) != counts["total_movements"]
    assert "phase_sum" not in counts


# --------------------------------------------------- AC 2: the two cross-domain checks


def _domain_g_payload(pdf):
    """Domain G's `player_stats` shape, rebuilt from the rows the factory printed.

    Shared by the green cross-domain test and the two failing ones so a single source
    defines the shape the seam hands `receiving_self_validation_block` — a second literal
    is a second thing to drift.
    """
    player_stats = {side: _player_rows(pdf, side) for side in ("home", "away")}
    return {
        side: [
            {
                "in_possession": {
                    "total_offers": row["offers"][0],
                    "offers_received": row["offers"][7],
                    "offers_by_movement_type": {
                        "in_front": row["offers"][1],
                        "in_between": row["offers"][2],
                        "out_to_in": row["offers"][3],
                        "in_to_out": row["offers"][4],
                        "in_behind": row["offers"][5],
                        "no_movement": row["offers"][6],
                    },
                }
            }
            for row in rows
        ]
        for side, rows in player_stats.items()
    }


def test_the_cross_domain_checks_pass_against_domain_g(make_report, tmp_path):
    pdf = _report(make_report, tmp_path)
    domain, _report_id = _receiving(pdf)
    payload = _domain_g_payload(pdf)

    checks = receiving_self_validation_block(domain["counts"], player_stats=payload)

    cross = [c for c in checks if c["check"].endswith("domain-g")]
    assert len(cross) == 2 * (2 + len(MOVEMENT_LABEL_TO_ENUM))
    assert all(check["result"] == "pass" for check in cross)
    # Record keys stay snake_case even though the codes they name are kebab (AD-9;
    # Story 1.12 was caught keying `counts` by kebab codes).
    assert set(domain["counts"]["home"]["movement"]["grid_by_type"]) == {
        code.replace("-", "_") for code in MOVEMENT_LABEL_TO_ENUM.values()
    }
    # Reconciliation #8: the grid equals the FIVE-type sum, never the six-type sum.
    home = payload["home"]
    five = sum(
        value
        for row in home
        for key, value in row["in_possession"]["offers_by_movement_type"].items()
        if key != "no_movement"
    )
    six = sum(
        sum(row["in_possession"]["offers_by_movement_type"].values()) for row in home
    )
    assert domain["counts"]["home"]["movement"]["grid_sum"] == five != six


def test_the_offers_cross_domain_check_fails_with_both_operands(make_report, tmp_path):
    """Reconciliations 6 and 7 must FAIL loud, both operands recorded (Task 5.2).

    The five page-internal ids each have a paired failing test; these two had only the
    green path, so the `page_value`/`counterpart` recording on their fail branch was
    untested (2026-07-27 review patch). Perturbing Domain G's side of the comparison is
    what isolates the cross-domain check: the page's own numbers stay reconciled, so no
    page-internal check moves.
    """
    pdf = _report(make_report, tmp_path)
    domain, _report_id = _receiving(pdf)
    payload = _domain_g_payload(pdf)
    # One extra offer on one player: the team total no longer matches the page.
    payload["home"][0]["in_possession"]["total_offers"] += 1
    payload["home"][0]["in_possession"]["offers_received"] += 1

    checks = receiving_self_validation_block(domain["counts"], player_stats=payload)

    failed = [c for c in checks if c["result"] == "fail"]
    assert [c["check"] for c in failed] == ["receiving-offers-domain-g"] * 2
    made, received = failed
    assert made["column"] == "total_offers_made"
    assert received["column"] == "total_offers_received"
    for check in failed:
        # Both operands, as named fields AND in the rendered string the manifest summary
        # and the FR-15 gate both read.
        assert check["page_value"] != check["counterpart"]
        assert check["counterpart"] == check["page_value"] + 1
        assert f"page reads {check['page_value']}" in check["specifics"]
        assert f"counterpart is {check['counterpart']}" in check["specifics"]
    # The away side and every page-internal check are untouched — one root cause, one
    # finding.
    assert all(c["team"] == "home" for c in failed)


def test_the_movement_cross_domain_check_fails_per_type_with_both_operands(
    make_report, tmp_path
):
    """Reconciliation 8 fails once per offending TYPE, not once for the grid (Task 5.2)."""
    pdf = _report(make_report, tmp_path)
    domain, _report_id = _receiving(pdf)
    payload = _domain_g_payload(pdf)
    # Perturb exactly one of the five mapped types on one player.
    payload["away"][0]["in_possession"]["offers_by_movement_type"]["in_behind"] += 3

    checks = receiving_self_validation_block(domain["counts"], player_stats=payload)

    failed = [c for c in checks if c["result"] == "fail"]
    assert len(failed) == 1
    check = failed[0]
    assert check["check"] == "receiving-movement-domain-g"
    assert check["team"] == "away"
    # The kebab contract code travels as the check's VALUE, so a consumer can name the
    # offending type without re-deriving it from the snake_case record key.
    assert check["movement_type"] == "in-behind"
    assert check["counterpart"] == check["page_value"] + 3
    assert f"page reads {check['page_value']}" in check["specifics"]
    assert f"counterpart is {check['counterpart']}" in check["specifics"]


def test_no_cross_domain_check_is_emitted_when_domain_g_is_unavailable(make_report, tmp_path):
    """One root cause, one finding — the `_check_domain_g_counts` Domain-B precedent."""
    pdf = _report(make_report, tmp_path)
    domain, _report_id = _receiving(pdf)

    checks = receiving_self_validation_block(domain["counts"], player_stats=None)

    assert not [c for c in checks if c["check"].endswith("domain-g")]


# ------------------------------------------------------------------ AC 1-2: ground truth


def test_ground_truth_offers_figures(mex_rsa_pdf):
    """`spike/mex_rsa.pdf` IS the m001 report. Values and counts only (AR-16)."""
    domain, report_id = _receiving(mex_rsa_pdf)
    offers = domain["offers"]["home"]

    assert report_id == "mex_rsa"
    assert offers["team_id"] == "mexico"
    assert offers["total_offers_made"] == 424
    assert offers["total_offers_received"] == 166
    assert offers["offers_final_third"] == 134
    assert offers["offers_middle_third"] == 212
    assert offers["offers_defensive_third"] == 78
    assert offers["offers_inside_shape"] == 213
    assert offers["offers_outside_shape"] == 211
    assert offers["most_offers"] == {
        "value": 54,
        "player_name": "Julian QUINONES",
        "position": "LEFT WINGER",
    }
    assert len(offers["table_rows"]) == 16
    assert sum(row["offers_made"] for row in offers["table_rows"]) == 424
    assert sum(row["offers_received"] for row in offers["table_rows"]) == 166


def test_ground_truth_movement_figures(mex_rsa_pdf):
    domain, _report_id = _receiving(mex_rsa_pdf)
    movement = domain["movement"]["home"]

    assert movement["total_movements"] == 309
    assert movement["by_phase"] == {"final_third": 65, "progression": 96, "build_up": 176}
    assert sum(cell["count"] for cell in movement["by_third_and_type"]) == 309
    assert len(movement["by_third_and_type"]) == 15
    assert len(movement["top_ranked_players"]) == 5
    # The documented non-partition, on the ground-truth page itself.
    assert 65 + 96 + 176 != 309


def test_ground_truth_self_validation_passes(mex_rsa_pdf):
    domain, _report_id = _receiving(mex_rsa_pdf)

    checks = receiving_self_validation_block(domain["counts"])

    assert checks
    assert all(check["result"] == "pass" for check in checks)

"""Pass-network parser and self-validation checks (Story 1.14, FR-13).

The pages are synthesized directly here rather than through `make_report`: this module
tests the parser, so it needs one cheap document per doctored case, and the full
multi-anchor factory would cost a whole report per assertion.

The first test in the file is the join asymmetry, deliberately: 2,103 corpus lineup
entries have no matrix row because they never played, and the natural-but-wrong "every
lineup player needs a row" rule would fire on every one of them. The second pins the one
tolerated anomaly the corpus does carry.
"""

from __future__ import annotations

import pymupdf
import pytest

from pipeline.extract.errors import (
    MissingFieldError,
    PassNetworkParseError,
    PlayerJoinError,
)
from pipeline.extract.pass_network import (
    PASS_NETWORK_ANCHOR_STEM,
    TOP_RANKED_PCT_TOLERANCE,
    extract_pass_network,
    pass_network_checks,
    pass_network_warnings,
)
from pipeline.tests.conftest import (
    PAGE_HEIGHT,
    PAGE_WIDTH,
    PASS_NETWORK_FIRST_COLUMN_X0,
    PASS_NETWORK_HEADER_Y0,
    draw_pass_network_page,
    pass_network_columns,
)

REPORT = "PMSR-M01-AAA-V-BBB"


# --- fixture builders -----------------------------------------------------------------


def block(names, matrix, top5=None):
    """One side's drawable pass-network block from a name list and a matrix.

    `matrix` uses `None` for the blank diagonal. `top5` defaults to the five largest
    cells as printed percentages of the matrix total, which is what makes the shipped
    `pass-network-top5-pct` check pass unless a test deliberately breaks it.
    """
    total = sum(value for row in matrix for value in row if value is not None)
    largest = sorted(
        (value for row in matrix for value in row if value is not None), reverse=True
    )[:5]
    return {
        "players": [
            {"shirt": index + 1, "name": name} for index, name in enumerate(names)
        ],
        "matrix": matrix,
        "top5": (
            top5
            if top5 is not None
            else [round(100.0 * cell / total, 1) for cell in largest]
        ),
    }


def lineup_entry(shirt, name, position="mf", *, substituted_on=None):
    return {
        "name": name,
        "shirt_number": shirt,
        "position": position,
        "goals": [],
        "own_goals": [],
        "cards": [],
        "substituted_on": substituted_on,
        "substituted_off": None,
    }


def lineups(home_starters, away_starters, *, home_subs=(), away_subs=()):
    return {
        "home": {"starters": list(home_starters), "substitutes": list(home_subs)},
        "away": {"starters": list(away_starters), "substitutes": list(away_subs)},
    }


def build(
    blocks,
    *,
    pages_per_side=1,
    sides=("home", "away"),
    header_names=None,
    omit_cells=None,
    cell_text=None,
    cell_fonts=None,
    **draw_kwargs,
):
    """A document carrying one pass-network page per side, and its resolved anchor map.

    The four doctoring kwargs are keyed BY SIDE here (the drawer takes them flat), so a
    test can break the home page while the away page stays parseable — which is what
    proves a failure is localized to one side rather than to the whole document.
    """
    doc = pymupdf.open()
    anchors: dict[str, list[int]] = {}
    for side in sides:
        indexes = []
        per_side = {
            "omit_cells": (omit_cells or {}).get(side, ()),
            "cell_text": (cell_text or {}).get(side),
            "cell_fonts": (cell_fonts or {}).get(side),
        }
        if header_names is not None and side in header_names:
            per_side["header_names"] = header_names[side]
        for _ in range(pages_per_side):
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            draw_pass_network_page(page, blocks[side], **per_side, **draw_kwargs)
            indexes.append(page.number)
        anchors[f"{PASS_NETWORK_ANCHOR_STEM}:{side}"] = indexes
    return doc, anchors


def extract(blocks, lineup_block, **build_kwargs):
    doc, anchors = build(blocks, **build_kwargs)
    with doc:
        return extract_pass_network(doc, anchors, lineup_block, report_id=REPORT)


# A 3x3 asymmetric, non-uniform matrix: every reciprocal pair differs, so a transposed
# column assignment cannot pass unnoticed (Task 8.4's degeneracy rule in miniature).
NAMES = ["Ana ALPHA", "Bo BRAVO", "Cy CHARLIE"]
MATRIX = [
    [None, 7, 2],
    [4, None, 9],
    [1, 5, None],
]
AWAY_NAMES = ["Di DELTA", "Ed ECHO", "Fi FOXTROT"]
AWAY_MATRIX = [
    [None, 3, 8],
    [6, None, 1],
    [2, 10, None],
]
BASIC = {"home": block(NAMES, MATRIX), "away": block(AWAY_NAMES, AWAY_MATRIX)}
BASIC_LINEUPS = lineups(
    [lineup_entry(index + 1, name) for index, name in enumerate(NAMES)],
    [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
)


# --- the join asymmetry (AC 1 — the easiest thing to get backwards) -------------------


def test_an_unused_substitute_has_no_matrix_row_and_that_is_not_a_finding():
    """2,103 corpus lineup entries have no matrix row because they never played."""
    lineup_block = lineups(
        [lineup_entry(index + 1, name) for index, name in enumerate(NAMES)],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
        home_subs=[lineup_entry(12, "Unused SUB", "df")],
        away_subs=[lineup_entry(13, "Also UNUSED", "mf")],
    )

    payload = extract(BASIC, lineup_block)

    assert [player["name"] for player in payload["home"]["players"]] == NAMES
    assert [player["name"] for player in payload["away"]["players"]] == AWAY_NAMES


def test_an_all_zero_row_for_a_player_with_no_minutes_is_tolerated():
    """PMSR-M92 away #14 Jordan HENDERSON: booked from the bench, all-zero row AND column.

    Corpus-measured in both directions (Task 1.3b): row sum 0 and column sum 0. The page
    is merely verbose, not contradictory, so the parser admits it.
    """
    names = NAMES + ["Jordan HENDERSON"]
    matrix = [
        [None, 7, 2, 0],
        [4, None, 9, 0],
        [1, 5, None, 0],
        [0, 0, 0, None],
    ]
    blocks = {
        "home": block(names, matrix),
        "away": block(AWAY_NAMES, AWAY_MATRIX),
    }
    lineup_block = lineups(
        [lineup_entry(index + 1, name) for index, name in enumerate(NAMES)],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
        home_subs=[lineup_entry(4, "Jordan HENDERSON", "mf")],
    )

    payload = extract(blocks, lineup_block)

    henderson = payload["home"]["players"][3]
    assert henderson["name"] == "Jordan HENDERSON"
    assert (henderson["passes_made"], henderson["passes_received"]) == (0, 0)
    assert not [
        edge
        for edge in payload["home"]["edges"]
        if "HENDERSON" in (edge["from_name"], edge["to_name"])
    ]


def test_a_non_zero_row_for_a_player_with_no_minutes_is_a_contradiction():
    names = NAMES + ["Ghost PLAYER"]
    matrix = [
        [None, 7, 2, 0],
        [4, None, 9, 0],
        [1, 5, None, 0],
        [3, 0, 0, None],
    ]
    blocks = {"home": block(names, matrix), "away": block(AWAY_NAMES, AWAY_MATRIX)}
    lineup_block = lineups(
        [lineup_entry(index + 1, name) for index, name in enumerate(NAMES)],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
        home_subs=[lineup_entry(4, "Ghost PLAYER", "mf")],
    )

    with pytest.raises(PlayerJoinError, match="Ghost PLAYER"):
        extract(blocks, lineup_block)


def test_a_non_zero_column_for_a_player_with_no_minutes_is_the_same_contradiction():
    """The direction Domain G has no analogue for: a teammate passing TO a phantom."""
    names = NAMES + ["Ghost PLAYER"]
    matrix = [
        [None, 7, 2, 5],
        [4, None, 9, 0],
        [1, 5, None, 0],
        [0, 0, 0, None],
    ]
    blocks = {"home": block(names, matrix), "away": block(AWAY_NAMES, AWAY_MATRIX)}
    lineup_block = lineups(
        [lineup_entry(index + 1, name) for index, name in enumerate(NAMES)],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
        home_subs=[lineup_entry(4, "Ghost PLAYER", "mf")],
    )

    with pytest.raises(PlayerJoinError, match="5 received"):
        extract(blocks, lineup_block)


def test_a_substitute_who_came_on_must_have_a_matrix_row():
    lineup_block = lineups(
        [lineup_entry(index + 1, name) for index, name in enumerate(NAMES)],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
        home_subs=[
            lineup_entry(12, "Came ON", "df", substituted_on={"minute": 60, "raw": "60'"})
        ],
    )

    with pytest.raises(MissingFieldError, match="Came ON"):
        extract(BASIC, lineup_block)


def test_an_unmatched_endpoint_fails_the_report_loud():
    """AC 1: every endpoint references a player in that team's Domain A lineup."""
    lineup_block = lineups(
        [lineup_entry(1, "Ana ALPHA"), lineup_entry(2, "Bo BRAVO")],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
    )

    with pytest.raises(PlayerJoinError, match="'Cy CHARLIE'"):
        extract(BASIC, lineup_block)


def test_a_shirt_disagreement_fails_even_when_the_name_matches():
    """The shirt is the CORROBORATING key: 0 disagreements on 3,289 corpus rows."""
    lineup_block = lineups(
        [
            lineup_entry(1, "Ana ALPHA"),
            lineup_entry(9, "Bo BRAVO"),
            lineup_entry(3, "Cy CHARLIE"),
        ],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
    )

    with pytest.raises(PlayerJoinError, match="prints shirt 2"):
        extract(BASIC, lineup_block)


def test_a_duplicate_lineup_name_cannot_silently_collapse_two_players():
    lineup_block = lineups(
        [
            lineup_entry(1, "Ana ALPHA"),
            lineup_entry(2, "Bo BRAVO"),
            lineup_entry(3, "Cy CHARLIE"),
        ],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
        home_subs=[lineup_entry(14, "Ana ALPHA")],
    )

    with pytest.raises(PlayerJoinError, match="twice"):
        extract(BASIC, lineup_block)


# --- the matrix itself (AC 1) ---------------------------------------------------------


def test_the_matrix_stages_every_non_zero_cell_as_one_directed_edge():
    payload = extract(BASIC, BASIC_LINEUPS)

    assert [
        (edge["from_shirt"], edge["to_shirt"], edge["volume"])
        for edge in payload["home"]["edges"]
    ] == [(1, 2, 7), (1, 3, 2), (2, 1, 4), (2, 3, 9), (3, 1, 1), (3, 2, 5)]


def test_a_reciprocal_pair_is_two_edges_and_is_never_symmetrized():
    """6,835 corpus reciprocal pairs print DIFFERENT volumes in the two directions."""
    payload = extract(BASIC, BASIC_LINEUPS)

    forward = [e for e in payload["home"]["edges"] if (e["from_shirt"], e["to_shirt"]) == (1, 2)]
    backward = [e for e in payload["home"]["edges"] if (e["from_shirt"], e["to_shirt"]) == (2, 1)]
    assert [edge["volume"] for edge in forward] == [7]
    assert [edge["volume"] for edge in backward] == [4]


def test_a_zero_cell_is_an_absent_edge_never_a_zero_volume_one():
    """The contract's `volume` is `minimum: 1`; 25,217 corpus cells print 0."""
    matrix = [[None, 0, 2], [4, None, 0], [0, 5, None]]
    blocks = {"home": block(NAMES, matrix), "away": block(AWAY_NAMES, AWAY_MATRIX)}

    payload = extract(blocks, BASIC_LINEUPS)

    assert all(edge["volume"] >= 1 for edge in payload["home"]["edges"])
    assert len(payload["home"]["edges"]) == 3


def test_node_degrees_come_from_the_matrix_row_and_column_sums():
    payload = extract(BASIC, BASIC_LINEUPS)

    assert [
        (player["passes_made"], player["passes_received"])
        for player in payload["home"]["players"]
    ] == [(9, 5), (13, 12), (6, 11)]
    assert payload["home"]["matrix_total"] == 28


def test_edges_are_in_matrix_reading_order_and_players_in_printed_row_order():
    """AD-8's determinism: the matrix's own order, never a sort by volume or name."""
    payload = extract(BASIC, BASIC_LINEUPS)

    keys = [(edge["from_shirt"], edge["to_shirt"]) for edge in payload["home"]["edges"]]
    assert keys == sorted(keys)
    assert [p["shirt_number"] for p in payload["home"]["players"]] == [1, 2, 3]


# --- column geometry: the production rule (Task 2.4) ----------------------------------


def test_a_drawn_row_yields_one_span_per_printed_cell():
    """The fixture must not collapse a row into ONE span (the 1.10 landmine).

    `pymupdf` merges adjacent same-font inserts, and a row emitted as a single string
    would make x-containment meaningless — every geometry test in this module would then
    pass over a page that cannot exercise the rule it exists to prove.
    """
    doc, _anchors = build(BASIC)
    with doc:
        page = doc[0]
        columns = pass_network_columns(len(NAMES))
        body = [
            span
            for block_ in page.get_text("dict")["blocks"]
            if block_.get("type") == 0
            for line in block_["lines"]
            for span in line["spans"]
            if span["bbox"][1] > 120.0
            and columns[0][0] <= (span["bbox"][0] + span["bbox"][2]) / 2 <= columns[-1][1]
        ]
        # 3 rows x 2 printed cells each (the diagonal is blank).
        assert len(body) == 6
        assert {span["text"].strip() for span in body} == {"7", "2", "4", "9", "1", "5"}


def test_column_widths_are_read_per_column_and_never_assumed_uniform():
    """156 of 208 corpus innings print NON-UNIFORM widths; 36 pt is the family minimum.

    Drawn here at three very different widths, so a parser computing `span / N` or
    hardcoding 36 pt lands in the wrong column and the values transpose.
    """
    blocks = {"home": block(NAMES, MATRIX), "away": block(AWAY_NAMES, AWAY_MATRIX)}

    payload = extract(blocks, BASIC_LINEUPS, column_widths=(58.5, 27.75, 45.0))

    assert [
        (edge["from_shirt"], edge["to_shirt"], edge["volume"])
        for edge in payload["home"]["edges"]
    ] == [(1, 2, 7), (1, 3, 2), (2, 1, 4), (2, 3, 9), (3, 1, 1), (3, 2, 5)]


def test_the_blank_diagonal_does_not_shift_the_values_after_it():
    """The ragged-row landmine: only the diagonal is absent, and it is absent per row.

    Row 2's printed stream is `4, 9` — an ordinal read assigns 4 to column 0 and 9 to
    column 1, putting player 2's 9 passes onto themselves. Geometry puts them at 0 and 2.
    """
    payload = extract(BASIC, BASIC_LINEUPS)

    row_two = [e for e in payload["home"]["edges"] if e["from_shirt"] == 2]
    assert [(e["to_shirt"], e["volume"]) for e in row_two] == [(1, 4), (3, 9)]


def test_a_second_blank_in_a_row_fails_the_census():
    with pytest.raises(PassNetworkParseError, match="leaves columns"):
        extract(BASIC, BASIC_LINEUPS, omit_cells={"home": ((1, 2),)})


def test_a_blank_off_the_diagonal_fails_the_census():
    """A row that prints its own diagonal and blanks a real cell — the shift, inverted."""
    matrix = [[0, 7, 2], [4, None, 9], [1, 5, None]]
    blocks = {"home": block(NAMES, matrix), "away": block(AWAY_NAMES, AWAY_MATRIX)}

    with pytest.raises(PassNetworkParseError, match=r"on the diagonal at column 0"):
        extract(blocks, BASIC_LINEUPS, omit_cells={"home": ((0, 1),)})


def test_a_missing_header_band_fails_rather_than_guessing_a_grid():
    with pytest.raises(PassNetworkParseError, match="qualifying cells"):
        extract(BASIC, BASIC_LINEUPS, header=False)


def test_the_two_leading_header_cells_are_identified_by_text_not_by_index():
    with pytest.raises(PassNetworkParseError, match="header cell 0 reads"):
        extract(BASIC, BASIC_LINEUPS, lead_texts=("No.", "Passes From to"))
    with pytest.raises(PassNetworkParseError, match="header cell 1 reads"):
        extract(BASIC, BASIC_LINEUPS, lead_texts=("#", "Passes To from"))


def test_row_order_must_match_column_order():
    """208/208 corpus innings agree; a disagreement raises rather than falling back."""
    with pytest.raises(PassNetworkParseError, match="row order does not match"):
        extract(
            BASIC,
            BASIC_LINEUPS,
            header_names={"home": ["Cy CHARLIE", "Bo BRAVO", "Ana ALPHA"]},
        )


# --- the hyphen wrap (Task 2.7) --------------------------------------------------------


def test_a_hyphen_wrapped_column_header_still_matches_its_row_label():
    """24 of 208 corpus innings wrap a hyphenated surname inside the header cell.

    The header then reads `'Ben GANNON- DOAK'` against the row label's
    `'Ben GANNON-DOAK'`. The canonical list comes from the ROW labels; the header is
    compared hyphen-normalized and never silently repaired.
    """
    names = ["Ana ALPHA", "Ben GANNON-DOAK", "Cy CHARLIE"]
    blocks = {"home": block(names, MATRIX), "away": block(AWAY_NAMES, AWAY_MATRIX)}
    lineup_block = lineups(
        [lineup_entry(index + 1, name) for index, name in enumerate(names)],
        [lineup_entry(index + 1, name) for index, name in enumerate(AWAY_NAMES)],
    )

    payload = extract(
        blocks,
        lineup_block,
        header_names={"home": ["Ana ALPHA", "Ben GANNON- DOAK", "Cy CHARLIE"]},
    )

    # The staged name is the ROW label's, with the hyphen intact.
    assert payload["home"]["players"][1]["name"] == "Ben GANNON-DOAK"


# --- value typing (Task 2.9) -----------------------------------------------------------


def test_a_fullwidth_digit_cell_is_rejected_by_the_ascii_guard():
    """Fullwidth digits satisfy a bare `\\d` and are happily accepted by `int()`.

    The cell needs `fontname="japan"` to carry the glyph at all (the 1.13 note): the
    base-14 fonts substitute U+FFFD, which would make this test pass for the wrong
    reason — a rejected replacement character rather than a rejected fullwidth digit.
    """
    blocks = {"home": block(NAMES, MATRIX), "away": block(AWAY_NAMES, AWAY_MATRIX)}

    with pytest.raises(PassNetworkParseError, match="not a non-negative ASCII integer"):
        extract(
            blocks,
            BASIC_LINEUPS,
            cell_text={"home": {(0, 1): "７"}},
            cell_fonts={"home": {(0, 1): "japan"}},
        )


def test_a_non_integer_cell_fails_loud():
    with pytest.raises(PassNetworkParseError, match="not a non-negative ASCII integer"):
        extract(BASIC, BASIC_LINEUPS, cell_text={"home": {(0, 1): "7.5"}})


def test_a_negative_cell_fails_loud():
    with pytest.raises(PassNetworkParseError, match="not a non-negative ASCII integer"):
        extract(BASIC, BASIC_LINEUPS, cell_text={"home": {(0, 1): "-7"}})


def test_zero_width_and_format_characters_are_dropped_from_an_assembled_name():
    """U+200B / U+00AD are `Cf` and are dropped by `normalize()`, not by luck.

    Asserted on the assembly path itself rather than through a drawn page, and
    deliberately so: `insert_text` cannot put a `Cf` character into the text layer at all
    with any font available here — the base-14 fonts substitute U+FFFD and `japan`
    swallows the codepoint — so a page-based version of this test would prove that a
    REPLACEMENT character is rejected, which is a different (and weaker) claim. The
    parser assembles every name through exactly this call.
    """
    from pipeline.extract.lines import TextSpan, join_spans

    spans = [
        TextSpan(x0=33.0, y0=125.3, x1=44.0, y1=132.3, text="Ana​"),
        TextSpan(x0=46.0, y0=125.3, x1=70.0, y1=132.3, text="AL­PHA"),
    ]

    assert join_spans(spans) == "Ana ALPHA"


# --- the anchor (Task 2.3) --------------------------------------------------------------


def test_an_anchor_resolving_to_two_pages_fails_rather_than_reading_the_first():
    with pytest.raises(PassNetworkParseError, match="resolves to 2 pages"):
        extract(BASIC, BASIC_LINEUPS, pages_per_side=2)


def test_an_unresolved_anchor_fails_loud():
    with pytest.raises(PassNetworkParseError, match="no resolved 'pass-network:away'"):
        extract(BASIC, BASIC_LINEUPS, sides=("home",))


# --- AC 2: the documented absence, and its standing tripwire (Task 2.12) ---------------


def test_node_positions_is_always_an_explicit_none():
    payload = extract(BASIC, BASIC_LINEUPS)

    assert payload["home"]["node_positions"] is None
    assert payload["away"]["node_positions"] is None


def test_the_absence_travels_as_a_warning_naming_its_reason():
    (warning,) = pass_network_warnings()

    assert "node_positions is not extractable" in warning
    assert "no pitch, no markers and no coordinates" in warning


def test_a_pitch_rectangle_on_the_page_aborts_the_report():
    """The tripwire that makes the AD-14 filing self-maintaining.

    The whole `x`/`y` re-scope rests on "this page draws no pitch". The day the vendor
    starts printing one, the corpus must abort loud rather than keep publishing
    `node_positions: null` forever.
    """

    def draw_pitch(page):
        page.draw_rect(pymupdf.Rect(300, 200, 700, 480), color=(1, 1, 1))

    with pytest.raises(PassNetworkParseError, match="qualifying pitch rectangle"):
        extract(BASIC, BASIC_LINEUPS, decorate=draw_pitch)


def test_a_filled_bezier_marker_on_the_page_aborts_the_report():
    def draw_marker(page):
        page.draw_circle((500, 300), 5.6, color=None, fill=(0.9, 0.1, 0.1))

    with pytest.raises(PassNetworkParseError, match="filled all-Bezier drawing"):
        extract(BASIC, BASIC_LINEUPS, decorate=draw_marker)


def test_the_pages_own_header_arrows_do_not_trip_the_marker_assertion():
    """The corpus's only curve content is two ~9 pt MIXED `c`+`l` sort-arrow glyphs."""

    def draw_arrow(page):
        shape = page.new_shape()
        shape.draw_bezier((100, 200), (104, 196), (108, 204), (112, 200))
        shape.draw_line((112, 200), (100, 200))
        shape.finish(color=None, fill=(1.0, 1.0, 1.0))
        shape.commit()

    payload = extract(BASIC, BASIC_LINEUPS, decorate=draw_arrow)

    assert payload["home"]["matrix_total"] == 28


# --- the printed Top-5 panel (Task 4.1) -------------------------------------------------


def test_the_panel_prints_five_percentages_in_printed_order():
    payload = extract(BASIC, BASIC_LINEUPS)

    assert payload["home"]["top_ranked_pairs"] == [
        {"rank": 1, "percent_of_total": 32.1},
        {"rank": 2, "percent_of_total": 25.0},
        {"rank": 3, "percent_of_total": 17.9},
        {"rank": 4, "percent_of_total": 14.3},
        {"rank": 5, "percent_of_total": 7.1},
    ]


def test_a_percentage_printed_without_a_decimal_parses():
    """`3.8%` and `3%` both appear on the reference page; a bare `\\d+` filter drops one."""
    matrix = [[None, 25, 25], [25, None, 25], [0, 0, None]]
    blocks = {
        "home": block(NAMES, matrix, top5=["25%", "25%", "25%", "25%", "0%"]),
        "away": block(AWAY_NAMES, AWAY_MATRIX),
    }

    payload = extract(blocks, BASIC_LINEUPS)

    assert [
        pair["percent_of_total"] for pair in payload["home"]["top_ranked_pairs"]
    ] == [25.0, 25.0, 25.0, 25.0, 0.0]


def test_a_panel_printing_the_wrong_number_of_percentages_fails_loud():
    blocks = {
        "home": block(NAMES, MATRIX, top5=[32.1, 25.0, 17.9]),
        "away": block(AWAY_NAMES, AWAY_MATRIX),
    }

    with pytest.raises(PassNetworkParseError, match="prints 3 percentages"):
        extract(blocks, BASIC_LINEUPS)


def test_the_panel_header_percent_sign_is_not_read_as_a_sixth_row():
    """`% of Total Team Passes` sits INSIDE the header band and carries a bare `%`."""
    payload = extract(BASIC, BASIC_LINEUPS)

    assert len(payload["home"]["top_ranked_pairs"]) == 5


# --- Self-Validation (Task 4) -----------------------------------------------------------


def player_stats(names, passes_completed, offers_received=99):
    return {
        "home": [
            {
                "name": name,
                "shirt_number": index + 1,
                "in_possession": {
                    "passes_completed": passes_completed,
                    "offers_received": offers_received,
                },
            }
            for index, name in enumerate(names)
        ],
        "away": [
            {
                "name": name,
                "shirt_number": index + 1,
                "in_possession": {
                    "passes_completed": passes_completed,
                    "offers_received": offers_received,
                },
            }
            for index, name in enumerate(AWAY_NAMES)
        ],
    }


def key_statistics(passes_completed):
    return {
        "home": {"passes_completed": passes_completed},
        "away": {"passes_completed": passes_completed},
    }


def test_the_printed_top5_reconciliation_is_the_primary_check():
    payload = extract(BASIC, BASIC_LINEUPS)

    (check,) = [
        entry
        for entry in pass_network_checks(payload)
        if entry["check"] == "pass-network-top5-pct"
    ]
    assert check["result"] == "pass"
    assert "100 x cell / matrix_total" in check["specifics"]


def test_a_printed_percentage_outside_the_tolerance_fails_the_check():
    blocks = {
        "home": block(NAMES, MATRIX, top5=[40.0, 25.0, 17.9, 14.3, 7.1]),
        "away": block(AWAY_NAMES, AWAY_MATRIX),
    }
    payload = extract(blocks, BASIC_LINEUPS)

    (check,) = [
        entry
        for entry in pass_network_checks(payload)
        if entry["check"] == "pass-network-top5-pct"
    ]
    assert check["result"] == "fail"
    assert "home rank 1" in check["specifics"]


def test_the_tolerance_is_the_printed_half_ulp_and_admits_exactly_it():
    """Worst observed corpus delta is EXACTLY 0.05 over all 1,040 printed percentages."""
    assert TOP_RANKED_PCT_TOLERANCE == 0.05

    payload = extract(BASIC, BASIC_LINEUPS)
    payload["home"]["top_ranked_pairs"][0]["percent_of_total"] = 32.1 + 0.05

    (check,) = [
        entry
        for entry in pass_network_checks(payload)
        if entry["check"] == "pass-network-top5-pct"
    ]
    assert check["result"] == "pass"


def test_the_row_relation_ships_as_a_bound_and_records_the_delta():
    """Equality is corpus-FALSE on 1,290 of 3,289 rows; the gap must stay visible."""
    payload = extract(BASIC, BASIC_LINEUPS)

    (check,) = [
        entry
        for entry in pass_network_checks(payload, player_stats=player_stats(NAMES, 40))
        if entry["check"] == "pass-network-row-bound"
    ]
    assert check["result"] == "pass"
    assert "total shortfall" in check["specifics"]


def test_a_row_sum_above_domain_g_fails_the_bound():
    payload = extract(BASIC, BASIC_LINEUPS)

    (check,) = [
        entry
        for entry in pass_network_checks(payload, player_stats=player_stats(NAMES, 5))
        if entry["check"] == "pass-network-row-bound"
    ]
    assert check["result"] == "fail"
    assert "> Domain G passes_completed 5" in check["specifics"]


def test_the_total_relation_ships_as_a_bound_and_records_the_delta():
    payload = extract(BASIC, BASIC_LINEUPS)

    (check,) = [
        entry
        for entry in pass_network_checks(payload, key_statistics=key_statistics(100))
        if entry["check"] == "pass-network-total-bound"
    ]
    assert check["result"] == "pass"
    assert "delta 72" in check["specifics"]


def test_an_absent_sibling_payload_emits_no_check_rather_than_a_failing_one():
    """One root cause, one finding — the 1.7/1.10/1.13 rule."""
    payload = extract(BASIC, BASIC_LINEUPS)

    ids = [entry["check"] for entry in pass_network_checks(payload)]

    assert ids == ["pass-network-top5-pct"]


def test_every_check_result_is_the_literal_pass_string_never_a_bool():
    payload = extract(BASIC, BASIC_LINEUPS)

    checks = pass_network_checks(
        payload,
        player_stats=player_stats(NAMES, 40),
        key_statistics=key_statistics(100),
    )

    assert [entry["check"] for entry in checks] == [
        "pass-network-top5-pct",
        "pass-network-row-bound",
        "pass-network-total-bound",
    ]
    assert all(entry["result"] == "pass" for entry in checks)
    assert all(isinstance(entry["result"], str) for entry in checks)


def test_the_column_sum_versus_offers_received_relation_is_not_shipped():
    """Corpus-FALSE in BOTH directions — 3,145 greater, 121 equal, 23 less.

    Pinned as a test as well as a comment: a later story reaching for the obvious
    relation must find a red test, not just prose.
    """
    payload = extract(BASIC, BASIC_LINEUPS)

    # Column sums here are 5, 12 and 11; `offers_received` is deliberately none of them.
    ids = [
        entry["check"]
        for entry in pass_network_checks(
            payload,
            player_stats=player_stats(NAMES, 40, offers_received=1),
            key_statistics=key_statistics(100),
        )
    ]

    assert not [check_id for check_id in ids if "offer" in check_id or "col" in check_id]


# --- determinism (Task 8.12) -------------------------------------------------------------


def test_re_extraction_is_byte_identical():
    """Task 2.11's ordering has no other coverage; the corpus SHA check is too coarse."""
    import json

    first = json.dumps(extract(BASIC, BASIC_LINEUPS), sort_keys=False)
    second = json.dumps(extract(BASIC, BASIC_LINEUPS), sort_keys=False)

    assert first == second


def test_the_header_band_geometry_matches_the_corpus_template():
    """A guard on the fixture itself: drawn where the real page draws."""
    columns = pass_network_columns(3)

    assert columns[0][0] == PASS_NETWORK_FIRST_COLUMN_X0
    assert PASS_NETWORK_HEADER_Y0 == 90.75
    assert [round(x1 - x0, 2) for x0, x1 in columns] == [36.0, 30.0, 42.0]

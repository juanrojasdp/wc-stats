"""Story 1.5 Task 2: attempts-table row extraction — columns by header x-positions.

Two fixture families, per the story's testing requirements: synthetic vector pages
(always run) whose expected values derive from what the factory drew
(`default_attempt_cells`, never a second literal), and the label -> enum mappings
cross-checked against the contract schema JSON — the frozen dicts are literals by
design, so a drifted value must fail here, not in production.
"""

from __future__ import annotations

import json
from pathlib import Path

import pymupdf
import pytest

from pipeline.markers.attempts import (
    BODY_PART_LABEL_TO_ENUM,
    DELIVERY_LABEL_TO_ENUM,
    DETAIL_COMPATIBLE_OUTCOMES,
    DETAIL_TO_OUTCOME,
    OUTCOME_LABEL_TO_DETAIL,
    AttemptRow,
    attempts_table_count,
    parse_attempt_rows,
    table_lines,
)
from pipeline.markers.errors import AttemptRowError, AttemptsTableError, UnknownLabelError
from pipeline.tests.conftest import (
    DEFAULT_SHOTS_MARKERS,
    SHOTS_OUTCOME_TO_LABEL,
    default_attempt_cells,
)

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


def parse_side(doc, side: str) -> list[AttemptRow]:
    pages = shots_anchors(doc)[f"shots:{side}"]
    return parse_attempt_rows(doc, pages[1:], REPORT_ID)


# --- label -> enum mappings, cross-checked against the contract schemas -----------


@pytest.fixture(scope="module")
def common_schema(repo_root: Path) -> dict:
    return json.loads(
        (repo_root / "contract" / "common.schema.json").read_text(encoding="utf-8")
    )


# The two labels the closed enum missed, found in the Story 1.5 full-corpus run (bare
# "Incomplete" x31, bare "On Target" x3) — AD-14 change-flow candidates recorded in
# deferred-work.md. Named here so the cross-check tests state the divergence precisely:
# anything beyond enum + exactly these two is a real drift and must fail.
AD14_EXTRA_DETAILS = {"incomplete": "incomplete", "on-target": "on-target"}

# The one detail the corpus renders in BOTH marker colours (10 incomplete + 1
# on-target of 11 rows) — the linking cross-check accepts either; AD-14 contract
# change request recorded in deferred-work.md.
AD14_BOTH_COLOURS_DETAIL = "deflected-on-target-defensive-event"


def test_outcome_labels_cover_the_contract_enum_plus_the_ad14_extras(common_schema):
    """Every enum value covered, injectively; extras are exactly the two documented
    corpus-observed AD-14 candidates — no other gap or addition tolerated."""
    enum = common_schema["$defs"]["ShotOutcomeDetail"]["enum"]

    assert sorted(OUTCOME_LABEL_TO_DETAIL.values()) == sorted(
        list(enum) + sorted(AD14_EXTRA_DETAILS)
    )
    assert len(set(OUTCOME_LABEL_TO_DETAIL.values())) == len(OUTCOME_LABEL_TO_DETAIL)


def test_detail_to_outcome_restates_the_contract_x_maps_to_outcome(common_schema):
    """The detail -> outcome map must equal the schema's machine-readable one plus
    exactly the AD-14 extras — it is NOT prefix-derivable (`incomplete-blocked` ->
    `blocked`)."""
    contract_map = common_schema["$defs"]["ShotOutcomeDetail"]["x-maps-to-outcome"]

    assert DETAIL_TO_OUTCOME == {**contract_map, **AD14_EXTRA_DETAILS}


def test_compatible_outcomes_are_singletons_except_the_documented_both_colours_detail():
    """The linking cross-check accepts exactly the mapped colour everywhere except the
    one detail the corpus itself renders in two colours (AD-14)."""
    for detail, outcome in DETAIL_TO_OUTCOME.items():
        if detail == AD14_BOTH_COLOURS_DETAIL:
            continue
        assert DETAIL_COMPATIBLE_OUTCOMES[detail] == (outcome,)
    assert DETAIL_COMPATIBLE_OUTCOMES[AD14_BOTH_COLOURS_DETAIL] == ("incomplete", "on-target")
    assert set(DETAIL_COMPATIBLE_OUTCOMES) == set(DETAIL_TO_OUTCOME)


def test_body_part_labels_cover_the_contract_enum_exactly(common_schema):
    enum = common_schema["$defs"]["BodyPart"]["enum"]

    assert sorted(BODY_PART_LABEL_TO_ENUM.values()) == sorted(enum)


def test_delivery_labels_cover_the_contract_enum_exactly(common_schema):
    enum = common_schema["$defs"]["ShotDeliveryType"]["enum"]

    assert sorted(DELIVERY_LABEL_TO_ENUM.values()) == sorted(enum)
    # The one non-mechanical pairing: the label glues what the enum splits.
    assert DELIVERY_LABEL_TO_ENUM["Freekick"] == "free-kick"


def test_the_fixture_outcome_labels_agree_with_the_production_mapping():
    """The factory's outcome -> label restatement must reverse through the frozen dict
    onto a detail that maps back to the marker outcome — otherwise every default
    fixture would fail the linking cross-check for the wrong reason."""
    for outcome, label in SHOTS_OUTCOME_TO_LABEL.items():
        assert DETAIL_TO_OUTCOME[OUTCOME_LABEL_TO_DETAIL[label]] == outcome


# --- row extraction on synthetic fixtures -----------------------------------------


def test_default_rows_parse_with_values_derived_from_the_factory(make_report, tmp_path):
    with open_report(make_report, tmp_path) as doc:
        rows = parse_side(doc, "home")

    markers = DEFAULT_SHOTS_MARKERS["home"]
    assert len(rows) == len(markers)
    for k, row in enumerate(rows):
        cells = default_attempt_cells(markers, k)
        assert row.ordinal == k + 1
        assert row.time_raw == cells["time"]
        assert row.shirt_number == cells["shirt"]
        assert row.player_name == cells["name"]
        assert row.outcome_detail == OUTCOME_LABEL_TO_DETAIL[cells["outcome"]]
        assert row.body_part == BODY_PART_LABEL_TO_ENUM[cells["body"]]
        assert row.delivery_type == DELIVERY_LABEL_TO_ENUM[cells["delivery"]]


def test_multi_word_names_and_compound_labels_segment_by_column_not_token_count(
    make_report, tmp_path
):
    """The real row shape: `3 | 26 | Brian GUTIERREZ | Incomplete - Blocked | ...` —
    the hyphen is a separate word, names are multi-word, so only the header-x0
    segmentation can carve this correctly."""
    overrides = {
        "home": {
            0: {
                "time": 3,
                "shirt": 26,
                "name": "Brian GUTIERREZ",
                "outcome": "Deflected Off Target - Defensive Event",
                "body": "Upper Body",
                "delivery": "Loose Ball",
            }
        }
    }
    with open_report(make_report, tmp_path, shots_table_cells=overrides) as doc:
        row = parse_side(doc, "home")[0]

    assert row.time_raw == 3
    assert row.shirt_number == 26
    assert row.player_name == "Brian GUTIERREZ"
    assert row.outcome_detail == "deflected-off-target-defensive-event"
    assert row.body_part == "upper-body"
    assert row.delivery_type == "loose-ball"


def test_multi_page_tables_concatenate_rows_with_continuing_ordinals(make_report, tmp_path):
    """37/104 real reports overflow onto a second table page; the ordinal is the 1-based
    position in the concatenated printed order, per side."""
    markers = {"home": [("goal", 0.1 + 0.05 * i, 0.1 + 0.04 * i) for i in range(5)], "away": []}
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_table_pages={"home": [3, 2]}
    ) as doc:
        rows = parse_side(doc, "home")

    assert [row.ordinal for row in rows] == [1, 2, 3, 4, 5]
    # Times continue across the page break: the factory prints the global row's cells.
    assert [row.time_raw for row in rows] == [
        default_attempt_cells(markers["home"], k)["time"] for k in range(5)
    ]


def test_an_empty_table_parses_to_zero_rows(make_report, tmp_path):
    markers = {"home": [], "away": []}
    with open_report(make_report, tmp_path, shots_markers=markers) as doc:
        assert parse_side(doc, "home") == []


def test_the_row_parser_and_the_row_counter_agree_on_every_fixture(make_report, tmp_path):
    """The internal count assert's premise, verified from the outside: both derive from
    one admission rule."""
    markers = {"home": [("goal", 0.5, 0.5)] * 3, "away": []}
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_table_pages={"home": [2, 1]}
    ) as doc:
        pages = shots_anchors(doc)["shots:home"]
        rows = parse_attempt_rows(doc, pages[1:], REPORT_ID)
        counted = sum(
            attempts_table_count(doc[page_index], REPORT_ID, page_index)
            for page_index in pages[1:]
        )

    assert len(rows) == counted == 3


# --- typed failures ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("cell", "value", "column"),
    [
        ("outcome", "Wide Left", "Outcome"),
        ("body", "Chest", "Body Part"),
        ("delivery", "Throw In", "Delivery Type"),
    ],
)
def test_an_unmapped_label_is_a_typed_error_naming_label_and_page(
    make_report, tmp_path, cell, value, column
):
    overrides = {"home": {0: {cell: value}}}
    with open_report(make_report, tmp_path, shots_table_cells=overrides) as doc:
        pages = shots_anchors(doc)["shots:home"]
        with pytest.raises(UnknownLabelError) as excinfo:
            parse_attempt_rows(doc, pages[1:], REPORT_ID)

    assert excinfo.value.column == column
    assert excinfo.value.label == value
    assert excinfo.value.page_index == pages[1]
    assert REPORT_ID in str(excinfo.value)
    assert value in str(excinfo.value)


def test_a_player_cell_without_a_leading_shirt_number_is_a_typed_row_error(
    make_report, tmp_path
):
    overrides = {"home": {0: {"shirt": "X"}}}
    with open_report(make_report, tmp_path, shots_table_cells=overrides) as doc:
        with pytest.raises(AttemptRowError) as excinfo:
            parse_side(doc, "home")

    assert REPORT_ID in str(excinfo.value)


def test_a_duplicated_header_column_word_makes_segmentation_a_typed_failure(
    make_report, tmp_path
):
    """A second `Outcome` word on the header row means the boundaries are ambiguous —
    never guessed."""

    def decorate_table(side, page):
        if side == "home":
            page.insert_text((760, 100), "Outcome", fontsize=10)

    with open_report(make_report, tmp_path, shots_decorate_table=decorate_table) as doc:
        with pytest.raises(AttemptsTableError, match="Outcome"):
            parse_side(doc, "home")


def test_a_missing_header_is_the_same_typed_failure_as_the_counter_raises(
    make_report, tmp_path
):
    with open_report(make_report, tmp_path, shots_table_header={"home": ""}) as doc:
        with pytest.raises(AttemptsTableError):
            parse_side(doc, "home")


# --- the moved visual-row helper ---------------------------------------------------


def test_table_lines_rebuilds_words_into_visual_rows(make_report, tmp_path):
    """The factor-out kept the shape: (y, [(x, word), ...]) top to bottom, x-sorted."""
    with open_report(make_report, tmp_path) as doc:
        pages = shots_anchors(doc)["shots:home"]
        lines = table_lines(doc[pages[1]])

    assert lines == sorted(lines, key=lambda line: line[0])
    for _y, cells in lines:
        assert cells == sorted(cells)
    header_rows = [
        cells
        for _y, cells in lines
        if {"Time", "Player", "Outcome"} <= {word for _x, word in cells}
    ]
    assert len(header_rows) == 1

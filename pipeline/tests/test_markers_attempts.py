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


# The one detail the corpus renders in BOTH marker colours (10 incomplete + 1
# on-target of 11 rows). Change-set CS-1 moved this INTO the contract as an array
# value on `x-maps-to-outcome` (contract/README.md decision 17, CR-2), so it is no
# longer a local exception — the tests below source the expectation from the schema
# and name it here only to assert it is the ONLY such entry.
BOTH_COLOURS_DETAIL = "deflected-on-target-defensive-event"


def _as_tuple(mapped) -> tuple[str, ...]:
    """Normalize a scalar-or-array `x-maps-to-outcome` value to the frozen tuple form.

    JSON arrays load as `list`; the production dict freezes them as `tuple`. The
    normalization is deliberately the ONLY latitude the equality asserts below get.
    """
    return (mapped,) if isinstance(mapped, str) else tuple(mapped)


def test_outcome_labels_cover_the_contract_enum_exactly(common_schema):
    """Every enum value covered, injectively, with nothing left over.

    Before CS-1 this asserted enum + two documented `AD14_EXTRA_DETAILS`: bare
    "Incomplete" and "On Target" were printed by the corpus but absent from the closed
    enum. Decision 17 added them, so the coverage is now exact in both directions and
    ANY divergence is drift.
    """
    enum = common_schema["$defs"]["ShotOutcomeDetail"]["enum"]

    assert sorted(OUTCOME_LABEL_TO_DETAIL.values()) == sorted(enum)
    assert len(set(OUTCOME_LABEL_TO_DETAIL.values())) == len(OUTCOME_LABEL_TO_DETAIL)


def test_detail_to_outcome_restates_the_contract_x_maps_to_outcome(common_schema):
    """The detail -> outcome map must equal the schema's machine-readable one EXACTLY —
    no extras. It is NOT prefix-derivable (`incomplete-blocked` -> `blocked`), and it is
    not uniformly scalar-valued (CR-2's one array entry)."""
    contract_map = common_schema["$defs"]["ShotOutcomeDetail"]["x-maps-to-outcome"]

    assert {detail: _as_tuple(mapped) for detail, mapped in DETAIL_TO_OUTCOME.items()} == {
        detail: _as_tuple(mapped) for detail, mapped in contract_map.items()
    }

    # `_as_tuple` normalizes BOTH sides above, so the equality alone cannot tell
    # `"off-target"` from `["off-target"]`. The schema's own description promises consumers
    # that values are scalar EXCEPT one, and generated JSDoc repeats it, so pin the raw
    # value TYPES against that promise: silently flipping entries to 1-element arrays would
    # otherwise pass every assert in this file while the documentation went false.
    arrays = sorted(d for d, mapped in contract_map.items() if not isinstance(mapped, str))
    assert arrays == [BOTH_COLOURS_DETAIL], (
        "x-maps-to-outcome must carry exactly one array value; the rest are scalar strings"
    )


def test_compatible_outcomes_widen_the_contract_map_and_nothing_else(common_schema):
    """The linking cross-check accepts exactly what the contract maps each detail to.

    Post-CS-1 this is a pure widening of `x-maps-to-outcome` with no local override, so
    the both-colours detail is accepted because the SCHEMA says two colours — not because
    this module tolerates a known-wrong pairing.
    """
    contract_map = common_schema["$defs"]["ShotOutcomeDetail"]["x-maps-to-outcome"]

    for detail, mapped in contract_map.items():
        assert DETAIL_COMPATIBLE_OUTCOMES[detail] == _as_tuple(mapped)

    # Against the CONTRACT's keys, not against `DETAIL_TO_OUTCOME`'s. The production dict is
    # now a comprehension over `DETAIL_TO_OUTCOME`, so comparing the two key sets is
    # tautological — it holds by construction and could never catch the drift it names.
    assert set(DETAIL_COMPATIBLE_OUTCOMES) == set(contract_map)

    multi = sorted(d for d, o in DETAIL_COMPATIBLE_OUTCOMES.items() if len(o) > 1)
    assert multi == [BOTH_COLOURS_DETAIL], "exactly one detail may accept two colours"
    assert DETAIL_COMPATIBLE_OUTCOMES[BOTH_COLOURS_DETAIL] == ("incomplete", "on-target")

    # A zero-length value would silently unlink every marker carrying that detail:
    # `linking.py` tests `marker.outcome in DETAIL_COMPATIBLE_OUTCOMES[...]`, and an empty
    # tuple fails that for every colour with no error. Impossible while the map was all
    # scalars; possible from a hand-edit now that array values are legal.
    assert all(len(o) >= 1 for o in DETAIL_COMPATIBLE_OUTCOMES.values()), (
        "every detail must accept at least one outcome"
    )


def test_every_parsed_detail_has_a_compatible_outcomes_entry():
    """`link_markers` looks each parsed row's detail up in `DETAIL_COMPATIBLE_OUTCOMES`
    with no fallback (its docstring promises nothing raises), so a drift between the
    two frozen dicts would surface as a bare KeyError mid-linking. Today this holds by
    construction; this pins it against future edits."""
    assert set(OUTCOME_LABEL_TO_DETAIL.values()) <= set(DETAIL_COMPATIBLE_OUTCOMES)


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
    fixture would fail the linking cross-check for the wrong reason.

    Both halves are asserted, because they catch different drifts. Membership is the
    predicate `link_markers` actually applies, so it is what "the fixture will link"
    means. But membership ALONE is too weak here: retargeting a factory label at CR-2's
    dual-colour detail would satisfy `"on-target" in ("incomplete", "on-target")` while
    the factory silently drew the minority colour, and every synthetic expectation built
    on `default_attempt_cells` would encode the wrong reading. The factory's five labels
    are all scalar-mapped and must stay that way, so the exact mapping is pinned too.
    """
    for outcome, label in SHOTS_OUTCOME_TO_LABEL.items():
        detail = OUTCOME_LABEL_TO_DETAIL[label]
        assert outcome in DETAIL_COMPATIBLE_OUTCOMES[detail]
        assert DETAIL_TO_OUTCOME[detail] == outcome, (
            f"the factory's {label!r} must map to exactly {outcome!r}; a dual-colour detail "
            f"would make the synthetic fixtures ambiguous"
        )


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
    """Both derive from the one admission rule in `_attempt_lines` and cannot drift by
    construction — verified here from the outside in case the implementations fork."""
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

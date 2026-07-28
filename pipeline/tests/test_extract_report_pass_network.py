"""The pass network at the Extraction Record and FR-15 gate seams (Story 1.14, AC 1-3).

`test_extract_pass_network.py` owns the parser; this module owns the two seams it plugs
into — `domains["pass_network"]` plus the three appended self-validation checks, and the
`pass-network-completeness` / `pass-network-counts` gate pair — plus the real-PDF ground
truth.

`clean_registry` is defined locally, following `test_checks_registry.py` and
`test_runner.py`: it is not a conftest fixture.
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.probe import probe_report
from pipeline.discover.text import PageTextIndex
from pipeline.extract.domain_a import extract_domain_a
from pipeline.extract.pass_network import extract_pass_network, pass_network_warnings
from pipeline.ingest.extract_report import extract_report
from pipeline.ingest.records import serialize_record
from pipeline.validate import checks as checks_module
from pipeline.validate.checks import CHECK_REGISTRY, registered_checks
from pipeline.validate.deviations import DeviationCategory
from pipeline.validate.runner import run_verification

PASS_NETWORK_CHECK_IDS = (
    "pass-network-top5-pct",
    "pass-network-row-bound",
    "pass-network-total-bound",
)
PASS_NETWORK_GATE_IDS = ("pass-network-completeness", "pass-network-counts")


@pytest.fixture
def clean_registry():
    """Restore the registry after a test registers its own check (local by convention)."""
    saved = list(CHECK_REGISTRY)
    yield
    CHECK_REGISTRY[:] = saved


@pytest.fixture(autouse=True)
def reset_pass_network_memo():
    """Clear the one-slot memo around every test in this module.

    Stale memo state across tests is a real flake source — the older memo blocks do not
    reset and `test_checks_registry.py` had to learn this the hard way.
    """
    checks_module._pass_network_memo.update(doc=None, result=None, error=None)
    yield
    checks_module._pass_network_memo.update(doc=None, result=None, error=None)


def _deviations(report, check_id):
    return [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == check_id
    ]


def _checks(record, check_id):
    return [
        check for check in record["self_validation"]["checks"] if check["check"] == check_id
    ]


# --- the record seam (AC 1, AC 2) -------------------------------------------------


def test_the_record_carries_the_pass_network_payload(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    pass_network = record["domains"]["pass_network"]
    assert set(pass_network) == {"home", "away"}
    for side in ("home", "away"):
        block = pass_network[side]
        assert set(block) == {
            "players",
            "edges",
            "matrix_total",
            "top_ranked_pairs",
            "node_positions",
        }
        assert block["players"], "expected a player per matrix row"
        assert block["edges"], "expected the non-zero cells as edges"
        assert block["matrix_total"] == sum(
            player["passes_made"] for player in block["players"]
        )


def test_every_endpoint_joins_to_that_sides_lineup(tmp_path, make_report):
    """AC 1's join half, asserted at the seam the record actually stages."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    lineups = record["domains"]["match_metadata"]["lineups"]
    for side in ("home", "away"):
        names = {
            entry["name"]
            for section in ("starters", "substitutes")
            for entry in lineups[side][section]
        }
        for edge in record["domains"]["pass_network"][side]["edges"]:
            assert edge["from_name"] in names
            assert edge["to_name"] in names


def test_the_payload_carries_no_player_id(tmp_path, make_report):
    """Cross-report identity is Story 1.15's; nothing here may mint one."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    for side in ("home", "away"):
        block = record["domains"]["pass_network"][side]
        assert all("player_id" not in player for player in block["players"])
        assert all("playerId" not in player for player in block["players"])
        assert all("player_id" not in edge for edge in block["edges"])


def test_the_payload_keys_are_snake_case_with_no_contract_codes(tmp_path, make_report):
    """Record JSON keys are snake_case — the slip that caught both 1.12 and 1.13."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                assert key == key.lower() and "-" not in key, key
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(record["domains"]["pass_network"])


def test_node_positions_is_none_and_its_absence_reaches_the_warnings(
    tmp_path, make_report
):
    """AC 2: a later story cannot quietly start fabricating positions without a red test."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert record["domains"]["pass_network"]["home"]["node_positions"] is None
    assert record["domains"]["pass_network"]["away"]["node_positions"] is None
    (warning,) = pass_network_warnings()
    assert record["warnings"].count(warning) == 1
    # A documented absence is a WARNING, never a non-"pass" check: the aggregator reads
    # anything but the literal "pass" as a failure.
    assert record["self_validation"]["result"] == "pass"


def test_the_absence_warning_is_appended_last_in_the_warnings_block(
    tmp_path, make_report
):
    """`warnings` is an ordered list, mirroring `extract_report`'s `extend` order."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    (warning,) = pass_network_warnings()
    assert record["warnings"][-1] == warning


def test_the_three_self_validation_checks_are_appended_and_pass(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    ids = [check["check"] for check in record["self_validation"]["checks"]]
    assert ids[-3:] == list(PASS_NETWORK_CHECK_IDS)
    for check_id in PASS_NETWORK_CHECK_IDS:
        (check,) = _checks(record, check_id)
        assert check["result"] == "pass", check["specifics"]


def test_the_fixture_makes_all_three_refuted_relations_false_by_construction(
    tmp_path, make_report
):
    """The 1.9/1.13 discipline: a fixture where they held would bless what the corpus
    refutes.

    Equality with Domain G's `passes_completed` is corpus-false on 1,290 of 3,289 rows;
    `matrix_total == key_statistics.passes_completed` is corpus-false on 208/208; and
    `sum(col_j)` vs `offers_received` is corpus-false in BOTH directions (3,145 greater,
    121 equal, 23 less). All three must be false HERE, and every check must still pass.
    """
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    pass_network = record["domains"]["pass_network"]
    player_stats = record["domains"]["player_stats"]
    key_statistics = record["domains"]["key_statistics"]
    for side in ("home", "away"):
        by_name = {player["name"]: player for player in player_stats[side]}
        deltas = []
        for player in pass_network[side]["players"]:
            stats = by_name[player["name"]]["in_possession"]
            assert player["passes_made"] < stats["passes_completed"]
            deltas.append(player["passes_received"] - stats["offers_received"])
        # BOTH directions present, so neither `<=` nor `>=` could be shipped as a bound.
        assert any(delta > 0 for delta in deltas)
        assert any(delta < 0 for delta in deltas)
        assert pass_network[side]["matrix_total"] < key_statistics[side]["passes_completed"]

    for check_id in PASS_NETWORK_CHECK_IDS:
        (check,) = _checks(record, check_id)
        assert check["result"] == "pass", check["specifics"]


def test_the_record_stays_free_of_absolute_paths_with_the_pass_network_present(
    tmp_path, make_report
):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))
    text = serialize_record(record)

    assert str(tmp_path) not in text
    assert tmp_path.as_posix() not in text


def test_re_extraction_is_byte_identical(tmp_path, make_report):
    """AD-8's determinism, at the record seam (Task 2.11's ordering has no other cover)."""
    path = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    first = serialize_record(extract_report(path))
    second = serialize_record(extract_report(path))

    assert first == second


# --- the FR-15 gate (Task 6, AC 3) ------------------------------------------------


def test_pass_network_gate_checks_are_registered():
    check_ids = {check.check_id for check in registered_checks()}

    assert set(PASS_NETWORK_GATE_IDS) <= check_ids
    # The Self-Validation ids and the gate ids are two DIFFERENT registries; neither may
    # be reused as the other.
    assert not set(PASS_NETWORK_CHECK_IDS) & check_ids


def test_the_unclaimed_offers_placeholder_is_still_unclaimed():
    """`offers-count-match` is `test_checks_registry.py`'s live placeholder id."""
    check_ids = {check.check_id for check in registered_checks()}

    assert "offers-count-match" not in check_ids
    assert not [check_id for check_id in check_ids if check_id.startswith("movement-")]


def test_a_clean_report_yields_no_pass_network_deviations(tmp_path, make_report):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    report = run_verification(corpus)

    for check_id in PASS_NETWORK_GATE_IDS:
        assert check_id in report["checks_run"]
        assert _deviations(report, check_id) == []


def test_a_join_failure_lands_in_the_probe_failure_bucket(tmp_path, make_report):
    """AC 3: join integrity reaches the deviation summary through this path."""
    from pipeline.tests.conftest import (
        default_key_statistics,
        default_lineup_sides,
        default_pass_network_block,
        default_player_stats_rows,
    )

    stats = default_key_statistics()
    rows = default_player_stats_rows(default_lineup_sides("Alpha", "Bravo", 2, 0), stats)
    block = default_pass_network_block(
        rows["home"], stats["home"]["passes_completed"]
    )
    block["players"][0] = {**block["players"][0], "name": "Ghost PLAYER"}
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        pass_network_block={"home": block},
    )

    report = run_verification(corpus)

    found = _deviations(report, "pass-network-completeness")
    assert found, "expected a pass-network-completeness deviation"
    assert all(
        deviation["category"] == DeviationCategory.PROBE_FAILURE for deviation in found
    )
    assert any("PlayerJoinError" in deviation["specifics"] for deviation in found)
    assert any("Ghost PLAYER" in deviation["specifics"] for deviation in found)


def test_a_pitch_rectangle_on_the_page_reaches_the_gate_as_a_probe_failure(
    tmp_path, make_report
):
    """The no-coordinates tripwire, end to end: the gate must surface it, not swallow it."""

    def draw_pitch(side, page):
        if side == "home":
            page.draw_rect(pymupdf.Rect(300, 200, 700, 480), color=(1, 1, 1))

    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        pass_network_decorate=draw_pitch,
    )

    report = run_verification(corpus)

    found = _deviations(report, "pass-network-completeness")
    assert any("PassNetworkParseError" in deviation["specifics"] for deviation in found)
    assert any("qualifying pitch rectangle" in deviation["specifics"] for deviation in found)


def test_a_failing_top5_reconciliation_lands_in_the_count_mismatch_bucket(
    tmp_path, make_report
):
    from pipeline.tests.conftest import (
        default_key_statistics,
        default_lineup_sides,
        default_pass_network_block,
        default_player_stats_rows,
    )

    stats = default_key_statistics()
    rows = default_player_stats_rows(default_lineup_sides("Alpha", "Bravo", 2, 0), stats)
    block = default_pass_network_block(rows["home"], stats["home"]["passes_completed"])
    block["top5"] = [99.9] + block["top5"][1:]
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        pass_network_block={"home": block},
    )

    report = run_verification(corpus)

    found = _deviations(report, "pass-network-counts")
    assert found, "expected a pass-network-counts deviation"
    assert all(
        deviation["category"] == DeviationCategory.COUNT_MISMATCH for deviation in found
    )
    # BOTH operands visible — the printed value and what the matrix says it should be.
    assert any("printed 99.9%" in deviation["specifics"] for deviation in found)
    assert any("pass-network-top5-pct" in deviation["specifics"] for deviation in found)


def test_the_two_gate_checks_share_one_parse_through_the_memo(tmp_path, make_report):
    """Task 6.2's one-slot memo: exactly one parse across both checks."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    path = make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo"
    )
    meta = probe_report(path)
    calls = []
    original = checks_module._pass_network_uncached

    def counting(doc, report_meta):
        calls.append(report_meta.report_id)
        return original(doc, report_meta)

    checks_module._pass_network_uncached = counting
    try:
        with pymupdf.open(path) as doc:
            checks_module._check_pass_network_completeness(doc, meta)
            checks_module._check_pass_network_counts(doc, meta)
    finally:
        checks_module._pass_network_uncached = original

    assert calls == [meta.report_id]


def test_the_gate_still_extends_without_editing_the_runner(
    tmp_path, make_report, clean_registry
):
    """A later story's check registers and runs beside this one's, untouched runner."""
    from pipeline.validate.checks import Check, register_check

    register_check(
        Check(
            check_id="pass-network-probe",
            applies_to=lambda meta: True,
            run=lambda doc, meta: [],
        )
    )
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    report = run_verification(corpus)

    assert "pass-network-probe" in report["checks_run"]
    assert "pass-network-counts" in report["checks_run"]


# --- real-PDF ground truth (Task 8.7; AR-16: counts and values only) ---------------


def _ground_truth_payload(mex_rsa_pdf: Path):
    meta = probe_report(mex_rsa_pdf)
    doc = pymupdf.open(mex_rsa_pdf)
    index = PageTextIndex(doc, meta.report_id)
    anchors = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        anchors[anchor.anchor_id] = index.find_all(
            anchor.text, at_start=anchor.at_page_start
        )
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
    payload = extract_pass_network(
        doc, anchors, domain_a["lineups"], report_id=meta.report_id
    )
    doc.close()
    return payload


MEXICO_ROW_ORDER = (
    (1, "Raul RANGEL"),
    (3, "Cesar MONTES"),
    (5, "Johan VASQUEZ"),
    (6, "Erik LIRA"),
    (8, "Alvaro FIDALGO"),
    (9, "Raul JIMENEZ"),
    (15, "Israel REYES"),
    (16, "Julian QUINONES"),
    (23, "Jesus GALLARDO"),
    (25, "Roberto ALVARADO"),
    (26, "Brian GUTIERREZ"),
    (4, "Edson ALVAREZ"),
    (10, "Alexis VEGA"),
    (14, "Armando GONZALEZ"),
    (19, "Gilberto MORA"),
    (24, "Luis CHAVEZ"),
)
# `1 Raul RANGEL`'s printed row, read off page 11 of spike/mex_rsa.pdf. The blank
# diagonal is the first cell.
RANGEL_ROW = (None, 6, 8, 4, 0, 2, 2, 1, 3, 1, 0, 0, 0, 0, 0, 0)


def test_the_ground_truth_matrix_is_16x16_in_printed_row_order(mex_rsa_pdf):
    payload = _ground_truth_payload(mex_rsa_pdf)

    home = payload["home"]
    assert [
        (player["shirt_number"], player["name"]) for player in home["players"]
    ] == list(MEXICO_ROW_ORDER)


def test_the_ground_truth_first_row_matches_the_printed_page(mex_rsa_pdf):
    payload = _ground_truth_payload(mex_rsa_pdf)

    home = payload["home"]
    names = [player["name"] for player in home["players"]]
    by_target = {
        edge["to_name"]: edge["volume"]
        for edge in home["edges"]
        if edge["from_name"] == "Raul RANGEL"
    }
    # Every printed value, including the zeros — which stage as ABSENT edges, never as
    # zero-volume ones (the contract's `volume` is `minimum: 1`).
    assert [
        None if index == 0 else by_target.get(names[index], 0)
        for index in range(len(names))
    ] == list(RANGEL_ROW)


def test_the_ground_truth_diagonal_is_blank(mex_rsa_pdf):
    """The matrix diagonal is blank on 208/208 — a self-pass edge is unreachable."""
    payload = _ground_truth_payload(mex_rsa_pdf)

    for side in ("home", "away"):
        assert not [
            edge
            for edge in payload[side]["edges"]
            if (edge["from_name"], edge["from_shirt"])
            == (edge["to_name"], edge["to_shirt"])
        ]


def test_the_ground_truth_matrix_totals_match_the_printed_page(mex_rsa_pdf):
    payload = _ground_truth_payload(mex_rsa_pdf)

    assert payload["home"]["matrix_total"] == 470
    assert payload["away"]["matrix_total"] == 278
    assert len(payload["away"]["players"]) == 15


def test_the_ground_truth_top5_panel_matches_the_printed_page(mex_rsa_pdf):
    """`3%` prints without a decimal; `3.8%` with one. Both are on this page."""
    payload = _ground_truth_payload(mex_rsa_pdf)

    assert [
        pair["percent_of_total"] for pair in payload["home"]["top_ranked_pairs"]
    ] == [3.8, 3.6, 3.0, 2.8, 2.8]


def test_the_ground_truth_report_stages_no_node_positions(mex_rsa_pdf):
    payload = _ground_truth_payload(mex_rsa_pdf)

    assert payload["home"]["node_positions"] is None
    assert payload["away"]["node_positions"] is None

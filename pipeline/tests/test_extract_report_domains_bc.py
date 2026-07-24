"""Tasks 6-7: Domains B/C wired into the Extraction Record, the batch, and the FR-15
gate.

Synthetic full reports come from `make_report` (which now draws parseable Key
Statistics, Phases and four line-height pages on every report). Byte-identity asserts
on real bytes (`read_bytes`), never parsed dicts (Story 1.2 review rule).
"""

from __future__ import annotations

import pytest

from pipeline.extract.errors import MalformedFieldError
from pipeline.ingest.batch import run_batch
from pipeline.ingest.extract_report import extract_report
from pipeline.ingest.records import serialize_record, write_record
from pipeline.tests.conftest import DEFAULT_LINE_HEIGHTS, default_key_statistics
from pipeline.validate.checks import CHECK_REGISTRY, registered_checks
from pipeline.validate.deviations import DeviationCategory
from pipeline.validate.runner import run_verification

DOMAIN_B_CHECK_IDS = (
    "key-statistics-possession-sum",
    "key-statistics-internal-consistency",
    "key-statistics-shots-reconciliation",
)
DOMAIN_C_CHECK_IDS = ("tactical-metre-bounds",)

GATE_CHECK_IDS = (
    "domain-b-completeness",
    "domain-b-counts",
    "domain-c-completeness",
    "domain-c-counts",
)


@pytest.fixture
def clean_registry():
    """Snapshot and restore the module-level registry around registry mutations
    (local by convention — see test_checks_registry.py)."""
    snapshot = list(CHECK_REGISTRY)
    yield
    CHECK_REGISTRY[:] = snapshot


def _line_heights_with(state, panel, measure, value):
    block = {
        kind: {key: dict(measures) for key, measures in panels.items()}
        for kind, panels in DEFAULT_LINE_HEIGHTS.items()
    }
    block[state][panel][measure] = value
    return block


# --- the record (Task 6: seam filled, nothing clobbered) --------------------------


def test_the_record_carries_both_new_domain_payloads(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    key_statistics = record["domains"]["key_statistics"]
    assert key_statistics["home"]["possession"] == 57.1
    assert key_statistics["contested_possession"] == 6.8
    assert len(key_statistics["home"]) == 19

    tactical = record["domains"]["tactical_identity"]
    assert tactical["home"]["phases_in_possession"]["build_up_unopposed"] == 47.0
    assert tactical["away"]["defensive_block"]["mid"] == 30.0
    assert set(tactical["home"]["line_height_team_length"]) == {
        "in_possession",
        "out_of_possession",
    }
    # The earlier domains' blocks are untouched beside them.
    assert "match_metadata" in record["domains"]
    assert "shots" in record["domains"]


def test_b_and_c_checks_append_to_self_validation_without_replacing_it(
    tmp_path, make_report
):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    check_ids = [check["check"] for check in record["self_validation"]["checks"]]
    # Story 1.3's shots checks still open the list; 1.5's and 1.6's follow; B/C append.
    assert check_ids.count("shots-marker-count") == 2
    assert "domain-a-goal-reconciliation" in check_ids
    for check_id in DOMAIN_B_CHECK_IDS + DOMAIN_C_CHECK_IDS:
        assert check_id in check_ids
    # B's checks precede C's, both after everything already registered before them.
    assert check_ids.index("key-statistics-possession-sum") > check_ids.index(
        "domain-a-goal-reconciliation"
    )
    assert record["self_validation"]["result"] == "pass"


def test_default_key_statistics_shots_derive_from_the_drawn_attempts_table(
    tmp_path, make_report
):
    """Task 5.4's constraint: on a deliberate marker/table mismatch fixture the
    reconciliation stays green (markers-vs-table is shots-marker-count's finding)."""
    record = extract_report(
        make_report(
            tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, shots_table_rows={"home": 9}
        )
    )

    assert record["domains"]["key_statistics"]["home"]["shots"] == 9
    by_id = {}
    for check in record["self_validation"]["checks"]:
        by_id.setdefault(check["check"], []).append(check["result"])
    assert by_id["key-statistics-shots-reconciliation"] == ["pass"]
    assert "fail" in by_id["shots-marker-count"]


def test_a_failed_b_check_fails_the_record_but_still_produces_it(tmp_path, make_report):
    """AD-8 / SM-C1: a consistency-check failure is data, not an exception."""
    stats = default_key_statistics()
    stats["contested_possession"] = 20.0  # sum 113.2, far outside ±0.2
    record = extract_report(
        make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, key_statistics=stats)
    )

    assert record["self_validation"]["result"] == "fail"
    failed = {
        check["check"]
        for check in record["self_validation"]["checks"]
        if check["result"] == "fail"
    }
    assert failed == {"key-statistics-possession-sum"}
    assert record["domains"]["key_statistics"]["contested_possession"] == 20.0


def test_an_out_of_bounds_metre_value_fails_the_record_but_still_produces_it(
    tmp_path, make_report
):
    record = extract_report(
        make_report(
            tmp_path / "PMSR-M07-AAA-V-BBB.pdf",
            number=7,
            line_heights=_line_heights_with("in_possession", "build-up-mid", "line_height", 88.0),
        )
    )
    # 88 m is still in bounds — prove the pass first, then the fail with 120 m.
    assert record["self_validation"]["result"] == "pass"

    record = extract_report(
        make_report(
            tmp_path / "PMSR-M08-AAA-V-BBB.pdf",
            number=8,
            line_heights=_line_heights_with(
                "out_of_possession", "low-block", "team_length", 120.0
            ),
        )
    )
    assert record["self_validation"]["result"] == "fail"
    failed = [
        check
        for check in record["self_validation"]["checks"]
        if check["result"] == "fail"
    ]
    assert [check["check"] for check in failed] == ["tactical-metre-bounds"]
    assert "low-block.team_length = 120.0" in failed[0]["specifics"]


def test_a_typed_b_error_propagates_as_itself_and_the_batch_carries_on(
    tmp_path, make_report
):
    stats = default_key_statistics()
    stats["home"]["goals"] = 2.5  # prints '2.5' where an int is required
    pdf = make_report(
        tmp_path / "PMSR-M02-CHA-V-DEL.pdf",
        number=2,
        home="Charlie",
        away="Delta",
        key_statistics=stats,
    )
    with pytest.raises(MalformedFieldError, match="home.goals"):
        extract_report(pdf)

    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")
    make_report(
        corpus / "PMSR-M02-CHA-V-DEL.pdf",
        number=2,
        home="Charlie",
        away="Delta",
        key_statistics=stats,
    )
    manifest = run_batch(
        corpus, output_path=None, extracted_dir=tmp_path / "work" / "extracted"
    )

    entries = {entry["report_id"]: entry for entry in manifest["reports"]}
    assert entries["PMSR-M01-ALP-V-BRA"]["status"] == "extracted"
    assert entries["PMSR-M02-CHA-V-DEL"]["status"] == "failed"
    assert entries["PMSR-M02-CHA-V-DEL"]["error_type"] == "MalformedFieldError"


# --- determinism (AD-9) -----------------------------------------------------------


def test_extracting_the_same_report_twice_is_byte_identical(tmp_path, make_report):
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    first = extract_report(pdf)
    second = extract_report(pdf)

    assert serialize_record(first).encode("utf-8") == serialize_record(second).encode("utf-8")

    first_path = write_record(first, tmp_path / "staged-a")
    second_path = write_record(second, tmp_path / "staged-b")
    assert first_path.read_bytes() == second_path.read_bytes()
    assert b"key_statistics" in first_path.read_bytes()
    assert b"tactical_identity" in first_path.read_bytes()


# --- the FR-15 gate (Task 7, AC 3) -----------------------------------------------


def test_domain_b_and_c_gate_checks_are_registered():
    check_ids = {check.check_id for check in registered_checks()}
    assert set(GATE_CHECK_IDS) <= check_ids


def test_reregistering_a_domain_check_id_raises(clean_registry):
    """Registry integrity is an authoring failure, never 104 per-report failures."""
    from pipeline.validate.checks import Check, register_check

    with pytest.raises(ValueError, match="domain-b-completeness"):
        register_check(
            Check(
                check_id="domain-b-completeness",
                applies_to=lambda meta: True,
                run=lambda doc, meta: [],
            )
        )


def test_a_clean_report_yields_no_b_or_c_deviations(tmp_path, make_report):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    report = run_verification(corpus)

    for check_id in GATE_CHECK_IDS:
        assert check_id in report["checks_run"]
    found = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"].startswith(("domain-b-", "domain-c-"))
    ]
    assert found == []


def test_a_typed_b_parse_failure_lands_in_the_probe_failure_bucket(
    tmp_path, make_report
):
    """Task 7.2: parse/typing failures -> probe-failure, typed class name prefixed."""
    stats = default_key_statistics()
    stats["away"]["expected_goals"] = "(2)"  # prints a wrong-shape xG value
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        key_statistics=stats,
    )

    report = run_verification(corpus)

    found = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == "domain-b-completeness"
    ]
    assert found, "expected a domain-b-completeness deviation"
    assert all(
        deviation["category"] == DeviationCategory.PROBE_FAILURE for deviation in found
    )
    assert any("MalformedFieldError" in deviation["specifics"] for deviation in found)
    # The counts check stays silent over a failed extract: one root cause, one finding.
    assert not any(
        deviation["check"] == "domain-b-counts"
        for entry in report["reports"]
        for deviation in entry["deviations"]
    )


def test_a_failed_consistency_check_lands_in_the_count_mismatch_bucket(
    tmp_path, make_report
):
    stats = default_key_statistics()
    stats["contested_possession"] = 20.0
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        key_statistics=stats,
    )

    report = run_verification(corpus)

    found = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == "domain-b-counts"
    ]
    assert found, "expected a domain-b-counts deviation"
    assert all(
        deviation["category"] == DeviationCategory.COUNT_MISMATCH for deviation in found
    )
    assert any(
        "key-statistics-possession-sum" in deviation["specifics"] for deviation in found
    )


def test_an_out_of_bounds_metre_lands_in_the_count_mismatch_bucket(
    tmp_path, make_report
):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        line_heights=_line_heights_with("in_possession", "build-up-low", "line_height", 120.0),
    )

    report = run_verification(corpus)

    found = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == "domain-c-counts"
    ]
    assert found, "expected a domain-c-counts deviation"
    assert all(
        deviation["category"] == DeviationCategory.COUNT_MISMATCH for deviation in found
    )
    assert any("tactical-metre-bounds" in deviation["specifics"] for deviation in found)


def test_a_missing_key_statistics_page_is_anchor_coverage_finding_alone(
    tmp_path, make_report
):
    """Task 7.1: missing anchor -> None, never double-reported by the domain checks."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        drop_anchor_ids=("key-statistics", "phases-of-play"),
    )

    report = run_verification(corpus)

    all_deviations = [
        deviation for entry in report["reports"] for deviation in entry["deviations"]
    ]
    assert any(
        deviation["category"] == DeviationCategory.MISSING_ANCHOR
        and "key-statistics" in deviation["specifics"]
        for deviation in all_deviations
    )
    assert not any(
        deviation["check"].startswith(("domain-b-", "domain-c-"))
        for deviation in all_deviations
    )


def test_the_gate_reextracts_the_same_b_and_c_payloads_as_the_record(
    tmp_path, make_report
):
    """Pins the gate's payload path to the record path: if either drifts, they
    diverge (or one fails typed)."""
    import json

    import pymupdf

    from pipeline.discover.probe import probe_report
    from pipeline.validate.checks import _domain_b_payload, _domain_c_payload

    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)
    record = extract_report(pdf)
    meta = probe_report(pdf)
    with pymupdf.open(pdf) as doc:
        gate_b = _domain_b_payload(doc, meta)
        gate_c = _domain_c_payload(doc, meta)

    assert json.dumps(gate_b, sort_keys=True) == json.dumps(
        record["domains"]["key_statistics"], sort_keys=True
    )
    assert json.dumps(gate_c, sort_keys=True) == json.dumps(
        record["domains"]["tactical_identity"], sort_keys=True
    )

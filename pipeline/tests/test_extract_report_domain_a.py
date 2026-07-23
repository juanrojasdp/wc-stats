"""Tasks 6-7: Domain A wired into the Extraction Record, the batch, and the FR-15 gate.

Synthetic full reports come from `make_report` (whose lineups page now parses as Domain
A) and the `make_lineup_report` adapter for per-side overrides. Byte-identity asserts on
real bytes (`read_bytes`), never parsed dicts (Story 1.2 review rule).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.extract.errors import UnknownVenueError
from pipeline.ingest.batch import run_batch
from pipeline.ingest.extract_report import extract_report
from pipeline.ingest.records import serialize_record, write_record
from pipeline.validate.checks import registered_checks
from pipeline.validate.deviations import DeviationCategory
from pipeline.validate.runner import run_verification

DOMAIN_A_CHECK_IDS = (
    "domain-a-starters-count",
    "domain-a-goalkeeper-count",
    "domain-a-shirt-numbers-unique",
    "domain-a-formation-sum",
    "domain-a-substitution-pairing",
    "domain-a-goal-reconciliation",
)


# --- the record (Task 6.2: seam filled, nothing clobbered) -----------------------


def test_the_record_carries_the_domain_a_payload(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    payload = record["domains"]["match_metadata"]
    assert payload["stage"] == "group"
    assert payload["group"] == "a"
    assert payload["date"] == "2026-06-11"
    assert payload["kickoff"] == "2026-06-11T13:00:00-06:00"
    assert payload["teams"] == {"home": "Mexico", "away": "South Africa"}
    assert payload["lineups"]["home"]["formation"] == "4-1-2-3"
    assert len(payload["lineups"]["home"]["starters"]) == 11
    # The other domain's block is untouched beside it.
    assert "shots" in record["domains"]


def test_the_probed_metadata_block_stays_verbatim_beside_the_normalized_payload(
    tmp_path, make_report
):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert record["metadata"]["stage_text"] == "Group A - Match 7"
    assert record["metadata"]["kickoff"] == "13:00"
    assert record["metadata"]["group"] == "A"
    assert record["domains"]["match_metadata"]["group"] == "a"


def test_domain_a_checks_append_to_self_validation_without_replacing_it(
    tmp_path, make_report
):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    check_ids = [check["check"] for check in record["self_validation"]["checks"]]
    # Story 1.3's shots checks still open the list; Domain A's six follow.
    assert check_ids.count("shots-marker-count") == 2
    for check_id in DOMAIN_A_CHECK_IDS:
        assert check_id in check_ids
    assert record["self_validation"]["result"] == "pass"


def test_a_failed_domain_a_check_fails_the_record_but_still_produces_it(
    tmp_path, make_lineup_report
):
    """AD-8 / SM-C1: a consistency-check failure is data, not an exception."""
    from pipeline.tests.conftest import lineup_side

    # Cover says 2-0 but the home column carries no goal markers at all.
    record = extract_report(
        make_lineup_report(
            tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, home_side=lineup_side("Mexico")
        )
    )

    assert record["self_validation"]["result"] == "fail"
    failed = {
        check["check"]
        for check in record["self_validation"]["checks"]
        if check["result"] == "fail"
    }
    assert failed == {"domain-a-goal-reconciliation"}
    assert record["domains"]["match_metadata"]["lineups"]["home"]["starters"]


def test_a_typed_domain_a_error_propagates_as_itself(tmp_path, make_report):
    """Task 6.4: the batch manifest needs the real class name, never a relabeling."""
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, venue="Atlantis Arena")

    with pytest.raises(UnknownVenueError, match="Atlantis Arena"):
        extract_report(pdf)


def test_the_batch_records_a_domain_a_failure_and_carries_on(tmp_path, make_report):
    """Task 6.4: one report's Domain A failure never aborts the batch."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")
    make_report(
        corpus / "PMSR-M02-CHA-V-DEL.pdf",
        number=2,
        home="Charlie",
        away="Delta",
        venue="Atlantis Arena",
    )

    manifest = run_batch(
        corpus, output_path=None, extracted_dir=tmp_path / "work" / "extracted"
    )

    entries = {entry["report_id"]: entry for entry in manifest["reports"]}
    assert entries["PMSR-M01-ALP-V-BRA"]["status"] == "extracted"
    assert entries["PMSR-M02-CHA-V-DEL"]["status"] == "failed"
    assert entries["PMSR-M02-CHA-V-DEL"]["error_type"] == "UnknownVenueError"
    assert "Atlantis Arena" in entries["PMSR-M02-CHA-V-DEL"]["error"]


# --- determinism (Task 8.4, AD-9) ------------------------------------------------


def test_extracting_the_same_report_twice_is_byte_identical(tmp_path, make_report):
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    first = extract_report(pdf)
    second = extract_report(pdf)

    assert serialize_record(first).encode("utf-8") == serialize_record(second).encode("utf-8")

    first_path = write_record(first, tmp_path / "staged-a")
    second_path = write_record(second, tmp_path / "staged-b")
    assert first_path.read_bytes() == second_path.read_bytes()
    assert b"match_metadata" in first_path.read_bytes()


def test_the_record_stays_free_of_absolute_paths_with_domain_a_present(
    tmp_path, make_report
):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))
    text = serialize_record(record)
    assert str(tmp_path) not in text
    assert tmp_path.as_posix() not in text


# --- the FR-15 gate (Task 7, AC 3) -----------------------------------------------


def test_domain_a_gate_checks_are_registered():
    check_ids = {check.check_id for check in registered_checks()}
    assert {"domain-a-completeness", "domain-a-counts"} <= check_ids


def test_a_clean_report_yields_no_domain_a_deviations(tmp_path, make_report):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    report = run_verification(corpus)

    assert "domain-a-completeness" in report["checks_run"]
    assert "domain-a-counts" in report["checks_run"]
    domain_a = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"].startswith("domain-a-")
    ]
    assert domain_a == []


def test_a_count_inconsistency_lands_in_the_count_mismatch_bucket(
    tmp_path, make_lineup_report
):
    """Task 7.2: lineup count/consistency mismatches map onto `count-mismatch`."""
    from pipeline.tests.conftest import lineup_side

    corpus = tmp_path / "corpus"
    corpus.mkdir()
    ten_starters = lineup_side("Alpha")
    del ten_starters["starters"][10]
    make_lineup_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        home_side=ten_starters,
    )

    report = run_verification(corpus)

    found = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == "domain-a-counts"
    ]
    assert found, "expected a domain-a-counts deviation"
    assert all(
        deviation["category"] == DeviationCategory.COUNT_MISMATCH for deviation in found
    )
    assert any("domain-a-starters-count" in deviation["specifics"] for deviation in found)
    assert report["deviation_counts_by_category"][DeviationCategory.COUNT_MISMATCH] >= 1


def test_an_extract_failure_lands_in_the_probe_failure_bucket(tmp_path, make_report):
    """Task 7.2: field completeness failures carry `probe-failure` semantics."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        venue="Atlantis Arena",
    )

    report = run_verification(corpus)

    found = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == "domain-a-completeness"
    ]
    assert found, "expected a domain-a-completeness deviation"
    assert all(
        deviation["category"] == DeviationCategory.PROBE_FAILURE for deviation in found
    )
    assert any("Atlantis Arena" in deviation["specifics"] for deviation in found)
    # Specifics carry the typed class name — the histogram separates failure classes.
    assert any("UnknownVenueError" in deviation["specifics"] for deviation in found)
    # The counts check stays silent over a failed extract: one root cause, one finding.
    assert not any(
        deviation["check"] == "domain-a-counts"
        for entry in report["reports"]
        for deviation in entry["deviations"]
    )


def test_an_unknown_minute_glyph_lands_in_the_unknown_rgb_bucket(
    tmp_path, make_lineup_report
):
    """Review decision 2026-07-23: an off-legend glyph fill is the same phenomenon as
    an off-palette shots marker and shares its `unknown-rgb` bucket."""
    from pipeline.tests.conftest import lineup_side

    corpus = tmp_path / "corpus"
    corpus.mkdir()
    off_legend = lineup_side("Alpha")
    off_legend["starters"][3]["markers"] = [((0.5, 0.5, 0.5), "55'")]
    make_lineup_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        home_side=off_legend,
    )

    report = run_verification(corpus)

    found = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == "domain-a-completeness"
    ]
    assert found, "expected a domain-a-completeness deviation"
    assert all(
        deviation["category"] == DeviationCategory.UNKNOWN_RGB for deviation in found
    )
    assert any("UnknownMinuteGlyphError" in deviation["specifics"] for deviation in found)


def test_the_gate_reextracts_the_same_domain_a_payload_as_the_record(
    tmp_path, make_report
):
    """Pins the gate's hand-rolled probed-metadata dict to the record path: if either
    of the two copies drifts, the payloads diverge (or one path fails typed)."""
    import json

    import pymupdf

    from pipeline.discover.probe import probe_report
    from pipeline.validate.checks import _domain_a_payload

    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)
    record = extract_report(pdf)
    meta = probe_report(pdf)
    with pymupdf.open(pdf) as doc:
        gate_payload = _domain_a_payload(doc, meta)

    assert json.dumps(gate_payload, sort_keys=True) == json.dumps(
        record["domains"]["match_metadata"], sort_keys=True
    )


def test_a_missing_lineups_page_is_anchor_coverage_finding_alone(tmp_path, make_report):
    """Task 7.2: lineup-anchor problems stay `missing-anchor` via anchor-coverage."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        drop_anchor_ids=("lineups",),
    )

    report = run_verification(corpus)

    all_deviations = [
        deviation for entry in report["reports"] for deviation in entry["deviations"]
    ]
    missing_anchor = [
        deviation
        for deviation in all_deviations
        if deviation["category"] == DeviationCategory.MISSING_ANCHOR
        and "lineups" in deviation["specifics"]
    ]
    assert missing_anchor, "expected anchor-coverage to report the missing lineups page"
    assert not any(
        deviation["check"].startswith("domain-a-") for deviation in all_deviations
    )

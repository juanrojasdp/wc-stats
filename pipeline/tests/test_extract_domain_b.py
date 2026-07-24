"""Tasks 2/5: Domain B Key Statistics parse, typing, and self-validation checks.

Synthetic pages come from the conftest Key Statistics kit (geometry mirrors the real
template); `spike/mex_rsa.pdf` is the only real-PDF fixture and pins the ground truth
the row grammar was verified against (flanking value spans, the possession bar's
left-to-right ordering, compound splits, unit suffixes, the en-dash Zone 4 label).
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from pipeline.discover.text import PageTextIndex
from pipeline.extract.domain_b import (
    _ROW_SPECS,
    _normalize_label,
    PASS_COMPLETION_TOLERANCE,
    POSSESSION_SUM_TOLERANCE,
    domain_b_checks,
    extract_domain_b,
)
from pipeline.extract.errors import (
    MalformedFieldError,
    MissingFieldError,
    StatisticsParseError,
    UnknownStatisticError,
)
from pipeline.tests.conftest import (
    KEY_STATISTICS_ROW_ORDER,
    default_key_statistics,
    default_key_statistics_rows,
    draw_key_statistics_page,
)

REPORT_ID = "PMSR-M01-TEST"
HOME, AWAY = "Mexico", "South Africa"


def _stats_doc(tmp_path: Path, **draw_kwargs) -> "pymupdf.Document":
    path = tmp_path / "stats.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    page.insert_text((40, 60), "Match Summary - Key Statistics", fontsize=11)
    draw_key_statistics_page(page, HOME, AWAY, **draw_kwargs)
    doc.save(path)
    doc.close()
    return pymupdf.open(path)


def _extract(tmp_path, anchors=None, **draw_kwargs):
    with _stats_doc(tmp_path, **draw_kwargs) as doc:
        return extract_domain_b(
            doc,
            anchors if anchors is not None else {"key-statistics": [0]},
            REPORT_ID,
            HOME,
            AWAY,
        )


def _rows_with(replacements: dict, stats=None) -> list:
    """The default rows with `label -> (home_text, away_text) | None` replacements
    applied (None drops the row)."""
    rows = []
    for label, home_text, away_text in default_key_statistics_rows(
        stats if stats is not None else default_key_statistics()
    ):
        if label in replacements:
            replacement = replacements[label]
            if replacement is None:
                continue
            home_text, away_text = replacement
        rows.append((label, home_text, away_text))
    return rows


# --- the full parse ---------------------------------------------------------------


def test_a_default_synthetic_page_parses_to_the_full_19_field_block(tmp_path):
    stats = default_key_statistics(home_score=2, away_score=0, home_shots=16, away_shots=3)
    payload = _extract(tmp_path, stats=stats)

    assert payload["contested_possession"] == 6.8
    for side in ("home", "away"):
        assert payload[side] == stats[side]
        assert len(payload[side]) == 19


def test_every_field_arrives_with_its_numeric_type_not_a_string(tmp_path):
    payload = _extract(tmp_path)

    for side in ("home", "away"):
        for field, value in payload[side].items():
            assert isinstance(value, (int, float)), (side, field, value)
        assert isinstance(payload[side]["goals"], int)
        assert isinstance(payload[side]["expected_goals"], float)
        assert isinstance(payload[side]["possession"], float)
    assert isinstance(payload["contested_possession"], float)


def test_the_possession_bar_reads_home_contested_away_left_to_right(tmp_path):
    payload = _extract(tmp_path, possession_texts=("41.5%", "12.5%", "46%"))

    assert payload["home"]["possession"] == 41.5
    assert payload["contested_possession"] == 12.5
    assert payload["away"]["possession"] == 46.0


def test_compound_rows_split_into_their_two_fields(tmp_path):
    rows = _rows_with({"Attempts at Goal (On Target)": ("16 (4)", "3 (2)")})
    payload = _extract(tmp_path, rows=rows)

    assert payload["home"]["shots"] == 16
    assert payload["home"]["shots_on_target"] == 4
    assert payload["away"]["shots"] == 3
    assert payload["away"]["shots_on_target"] == 2


def test_unit_suffixes_are_stripped_to_raw_floats(tmp_path):
    rows = _rows_with({"Total Distance Covered": ("107.3 km", "97.1 km")})
    payload = _extract(tmp_path, rows=rows)

    assert payload["home"]["distance_covered"] == 107.3
    assert payload["away"]["distance_covered"] == 97.1


def test_the_row_label_set_is_closed_and_the_conftest_kit_covers_it_exactly():
    """The fixture kit and the parser must enumerate the same closed set — a drift
    between them would let fixture rows silently stop exercising a parser row."""
    kit_labels = {label for label, _, _ in KEY_STATISTICS_ROW_ORDER}
    assert kit_labels == set(_ROW_SPECS)
    per_side_fields = 1 + sum(len(spec.fields) for spec in _ROW_SPECS.values())
    assert per_side_fields == 19  # the contract TeamKeyStatistics checklist


# --- typed failure paths ----------------------------------------------------------


def test_a_decimal_where_an_int_is_expected_names_the_field_and_raw_text(tmp_path):
    rows = _rows_with({"Goals": ("2.5", "0")})
    with pytest.raises(MalformedFieldError) as exc_info:
        _extract(tmp_path, rows=rows)
    assert "home.goals" in str(exc_info.value)
    assert "'2.5'" in str(exc_info.value)


def test_a_wrong_shape_percentage_names_the_field_and_raw_text(tmp_path):
    rows = _rows_with({"Pass Completion %": ("90 %", "(83)")})
    with pytest.raises(MalformedFieldError) as exc_info:
        _extract(tmp_path, rows=rows)
    assert "away.pass_completion" in str(exc_info.value)
    assert "'(83)'" in str(exc_info.value)


def test_a_wholly_non_numeric_value_still_fails_loud_as_an_unknown_row(tmp_path):
    """A value the grammar cannot even recognize as a value merges into the row label
    under relative classification — the failure stays loud and carries the raw text."""
    rows = _rows_with({"Pass Completion %": ("90 %", "n/a %")})
    with pytest.raises(UnknownStatisticError) as exc_info:
        _extract(tmp_path, rows=rows)
    assert "n/a" in str(exc_info.value)


def test_an_unknown_row_label_is_never_fuzzy_matched(tmp_path):
    rows = _rows_with({}) + [("Expected Threat", "0.4", "0.2")]
    with pytest.raises(UnknownStatisticError) as exc_info:
        _extract(tmp_path, rows=rows)
    assert "Expected Threat" in str(exc_info.value)


def test_a_missing_required_row_is_named(tmp_path):
    rows = _rows_with({"Forced Turnovers": None})
    with pytest.raises(MissingFieldError) as exc_info:
        _extract(tmp_path, rows=rows)
    assert "Forced Turnovers" in str(exc_info.value)


def test_a_missing_possession_bar_is_named(tmp_path):
    with pytest.raises(MissingFieldError) as exc_info:
        _extract(tmp_path, possession_texts=())
    assert "possession" in str(exc_info.value)


def test_a_possession_bar_with_two_values_fails_loud(tmp_path):
    with pytest.raises(StatisticsParseError) as exc_info:
        _extract(tmp_path, possession_texts=("57.1%", "42.9%"))
    assert "2 percentage values" in str(exc_info.value)


def test_a_duplicated_stat_row_fails_loud(tmp_path):
    rows = _rows_with({}) + [("Crosses", "13", "8")]
    with pytest.raises(StatisticsParseError) as exc_info:
        _extract(tmp_path, rows=rows)
    assert "appears twice" in str(exc_info.value)


def test_swapped_team_names_raise_rather_than_swapping_every_stat(tmp_path):
    """AD-8's exact failure mode: left must be home, verified on the page itself."""
    with _stats_doc(tmp_path) as doc:
        with pytest.raises(StatisticsParseError) as exc_info:
            extract_domain_b(doc, {"key-statistics": [0]}, REPORT_ID, AWAY, HOME)
    assert "away team on the left" in str(exc_info.value)


def test_a_page_without_the_team_names_row_fails_the_side_verification(tmp_path):
    with pytest.raises(StatisticsParseError) as exc_info:
        _extract(tmp_path, team_names=False)
    assert "side" in str(exc_info.value)


def test_a_missing_anchor_fails_loud(tmp_path):
    with pytest.raises(StatisticsParseError):
        _extract(tmp_path, anchors={})


def test_an_anchor_resolving_to_two_pages_fails_loud(tmp_path):
    with pytest.raises(StatisticsParseError) as exc_info:
        _extract(tmp_path, anchors={"key-statistics": [0, 1]})
    assert "2 pages" in str(exc_info.value)


# --- label normalization ----------------------------------------------------------


def test_the_en_dash_zone_4_label_folds_to_a_closed_set_key():
    """The real Zone 4 row prints a U+2013 en-dash; the base-14 fixture font cannot
    encode it, so cover the fold directly (independent of `spike/mex_rsa.pdf`, which
    skips locally). A raw en-dash label must normalize to the hyphen form the closed
    row-label set keys on."""
    raw = "Zone 4 – Low Speed Sprinting: 20-25 km/h"
    assert "–" in raw  # the label genuinely carries the en-dash
    normalized = _normalize_label(raw)
    assert "–" not in normalized
    assert normalized in _ROW_SPECS
    assert _ROW_SPECS[normalized].fields == ("sprint_distance",)


# --- self-validation checks -------------------------------------------------------


def _payload(**overrides):
    stats = default_key_statistics()
    for path, value in overrides.items():
        side, field = path.split(".")
        if side == "match":
            stats[field] = value
        else:
            stats[side][field] = value
    return stats


def test_the_possession_sum_check_passes_within_the_fixed_tolerance():
    checks = {check["check"]: check for check in domain_b_checks(_payload())}
    assert checks["key-statistics-possession-sum"]["result"] == "pass"


def test_the_possession_sum_check_fails_beyond_the_fixed_tolerance():
    payload = _payload(**{"match.contested_possession": 6.8 + 2 * POSSESSION_SUM_TOLERANCE})
    checks = {check["check"]: check for check in domain_b_checks(payload)}
    assert checks["key-statistics-possession-sum"]["result"] == "fail"
    assert str(POSSESSION_SUM_TOLERANCE) in checks["key-statistics-possession-sum"]["specifics"]


def test_internal_consistency_fails_when_a_subset_count_exceeds_its_superset():
    payload = _payload(**{"home.shots_on_target": 99})
    checks = {check["check"]: check for check in domain_b_checks(payload)}
    assert checks["key-statistics-internal-consistency"]["result"] == "fail"
    assert "99 on target" in checks["key-statistics-internal-consistency"]["specifics"]


def test_internal_consistency_fails_when_printed_completion_disagrees_with_the_ratio():
    payload = _payload(**{"home.pass_completion": 90.0 + 2 * PASS_COMPLETION_TOLERANCE})
    checks = {check["check"]: check for check in domain_b_checks(payload)}
    assert checks["key-statistics-internal-consistency"]["result"] == "fail"


def test_shots_reconciliation_compares_against_the_table_count_only_when_given():
    payload = _payload()
    without = {check["check"] for check in domain_b_checks(payload)}
    assert "key-statistics-shots-reconciliation" not in without

    counts = {
        "home": {"markers": 0, "table": payload["home"]["shots"]},
        "away": {"markers": 0, "table": payload["away"]["shots"]},
    }
    checks = {
        check["check"]: check for check in domain_b_checks(payload, shots_counts=counts)
    }
    assert checks["key-statistics-shots-reconciliation"]["result"] == "pass"

    counts["home"]["table"] = payload["home"]["shots"] + 3
    checks = {
        check["check"]: check for check in domain_b_checks(payload, shots_counts=counts)
    }
    assert checks["key-statistics-shots-reconciliation"]["result"] == "fail"
    assert "table lists" in checks["key-statistics-shots-reconciliation"]["specifics"]


def test_check_results_are_exactly_pass_or_fail():
    for check in domain_b_checks(_payload()):
        assert check["result"] in ("pass", "fail")
        assert set(check) == {"check", "result", "specifics"}


# --- ground truth (AR-16) ---------------------------------------------------------


def _mex_rsa_payload(mex_rsa_pdf):
    with pymupdf.open(mex_rsa_pdf) as doc:
        index = PageTextIndex(doc, "mex_rsa")
        anchors = {"key-statistics": index.find_all("Match Summary - Key Statistics")}
        return extract_domain_b(doc, anchors, "mex_rsa", HOME, AWAY)


def test_ground_truth_key_statistics_block(mex_rsa_pdf):
    """The hand-transcribed mex_rsa values, including the en-dash Zone 4 row."""
    payload = _mex_rsa_payload(mex_rsa_pdf)

    assert payload["home"] == {
        "possession": 57.1, "goals": 2, "expected_goals": 1.78,
        "shots": 16, "shots_on_target": 4, "passes": 547, "passes_completed": 495,
        "pass_completion": 90.0, "completed_line_breaks": 105,
        "defensive_line_breaks": 10, "receptions_in_final_third": 117, "crosses": 13,
        "ball_progressions": 23, "defensive_pressures": 170, "direct_pressures": 26,
        "forced_turnovers": 31, "second_balls": 56, "distance_covered": 107.3,
        "sprint_distance": 5.3,
    }
    assert payload["away"] == {
        "possession": 36.1, "goals": 0, "expected_goals": 0.1,
        "shots": 3, "shots_on_target": 2, "passes": 351, "passes_completed": 290,
        "pass_completion": 83.0, "completed_line_breaks": 57,
        "defensive_line_breaks": 3, "receptions_in_final_third": 36, "crosses": 8,
        "ball_progressions": 8, "defensive_pressures": 306, "direct_pressures": 45,
        "forced_turnovers": 32, "second_balls": 45, "distance_covered": 97.1,
        "sprint_distance": 5.1,
    }
    assert payload["contested_possession"] == 6.8


def test_ground_truth_checks_all_pass(mex_rsa_pdf):
    payload = _mex_rsa_payload(mex_rsa_pdf)
    counts = {"home": {"markers": 16, "table": 16}, "away": {"markers": 3, "table": 3}}
    for check in domain_b_checks(payload, shots_counts=counts):
        assert check["result"] == "pass", check

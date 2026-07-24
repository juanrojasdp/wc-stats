"""Tasks 3/4/5: Domain C phases parse, line-height bracket classification, checks.

Synthetic pages come from the conftest Phases / Line-Height kits (geometry mirrors the
real template, including the measurement brackets the classification rule reads);
`spike/mex_rsa.pdf` pins the ground truth: 8+9 phase rows per team, and 3,744
corpus-verified bracket classifications resolved in Task 4.3 (line height / team
length / team width).
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from pipeline.discover.text import PageTextIndex
from pipeline.extract.domain_c import (
    _IN_POSSESSION_PANELS,
    _parse_line_height_page,
    PITCH_LENGTH_METRES,
    domain_c_checks,
    extract_domain_c,
)
from pipeline.extract.errors import (
    LineHeightParseError,
    MissingFieldError,
    PhasesParseError,
    UnknownStatisticError,
)
from pipeline.tests.conftest import (
    DEFAULT_LINE_HEIGHTS,
    DEFAULT_PHASES,
    LINE_HEIGHT_GRAY,
    PHASES_IN_ROWS,
    PHASES_OUT_ROWS,
    _draw_bracket_badge,
    _draw_metre_value,
    draw_line_height_page,
    draw_phases_page,
)

REPORT_ID = "PMSR-M01-TEST"
HOME, AWAY = "Mexico", "South Africa"

ANCHOR_IDS = (
    "phases-of-play",
    "in-possession-line-height:home",
    "in-possession-line-height:away",
    "defensive-line-height:home",
    "defensive-line-height:away",
)


def _domain_c_doc(
    tmp_path: Path,
    *,
    phases_kwargs=None,
    in_possession_kwargs=None,
    out_of_possession_kwargs=None,
) -> "pymupdf.Document":
    """A five-page document: phases, then the four line-height pages in anchor order."""
    path = tmp_path / "tactical.pdf"
    doc = pymupdf.open()
    draw_phases_page(doc.new_page(width=960, height=540), **(phases_kwargs or {}))
    for kind, kwargs in (
        ("in_possession", in_possession_kwargs),
        ("in_possession", None),
        ("out_of_possession", out_of_possession_kwargs),
        ("out_of_possession", None),
    ):
        draw_line_height_page(doc.new_page(width=960, height=540), kind, **(kwargs or {}))
    doc.save(path)
    doc.close()
    return pymupdf.open(path)


def _anchors():
    return {anchor_id: [index] for index, anchor_id in enumerate(ANCHOR_IDS)}


def _extract(tmp_path, anchors=None, **doc_kwargs):
    with _domain_c_doc(tmp_path, **doc_kwargs) as doc:
        return extract_domain_c(
            doc, anchors if anchors is not None else _anchors(), report_id=REPORT_ID
        )


# --- the full parse ---------------------------------------------------------------


def test_a_default_synthetic_report_parses_both_teams_17_phases_each(tmp_path):
    payload = _extract(tmp_path)

    for side in ("home", "away"):
        in_phases = payload[side]["phases_in_possession"]
        out_phases = payload[side]["phases_out_of_possession"]
        assert set(in_phases) == {key for _, key in PHASES_IN_ROWS}
        assert set(out_phases) == {key for _, key in PHASES_OUT_ROWS}
        for key in in_phases:
            assert in_phases[key] == DEFAULT_PHASES[side][key]
        for key in out_phases:
            assert out_phases[key] == DEFAULT_PHASES[side][key]
        assert all(isinstance(value, float) for value in in_phases.values())


def test_the_defensive_block_is_a_projection_of_the_block_phases(tmp_path):
    """Contract `DefensiveBlockDistribution` $comment: same numbers, single source."""
    payload = _extract(tmp_path)

    for side in ("home", "away"):
        out_phases = payload[side]["phases_out_of_possession"]
        assert payload[side]["defensive_block"] == {
            "high": out_phases["high_block"],
            "mid": out_phases["mid_block"],
            "low": out_phases["low_block"],
        }


def test_line_height_pages_classify_all_three_measures_per_panel(tmp_path):
    payload = _extract(tmp_path)

    for side in ("home", "away"):
        block = payload[side]["line_height_team_length"]
        assert block["in_possession"] == DEFAULT_LINE_HEIGHTS["in_possession"]
        assert block["out_of_possession"] == DEFAULT_LINE_HEIGHTS["out_of_possession"]


def test_a_tiny_phase_value_near_the_centre_still_classifies_by_label_side(tmp_path):
    """The bar-end x varies with the value: 0%/1% print close to the centred label."""
    rows_out = [
        (f"{DEFAULT_PHASES['home'][key]:g}%", label, f"{DEFAULT_PHASES['away'][key]:g}%")
        if label != "Low Press"
        else ("0%", "Low Press", "1%", 405, 500)
        for label, key in PHASES_OUT_ROWS
    ]
    payload = _extract(tmp_path, phases_kwargs={"rows_out": rows_out})

    assert payload["home"]["phases_out_of_possession"]["low_press"] == 0.0
    assert payload["away"]["phases_out_of_possession"]["low_press"] == 1.0


# --- phases failure paths ---------------------------------------------------------


def _rows(section_rows, phases=DEFAULT_PHASES, replace=None, drop=None, extra=None):
    rows = []
    for label, key in section_rows:
        if drop == label:
            continue
        row = (f"{phases['home'][key]:g}%", label, f"{phases['away'][key]:g}%")
        if replace and label in replace:
            row = replace[label]
        rows.append(row)
    if extra is not None:
        rows.append(extra)
    return rows


def test_two_percent_spans_on_one_side_of_a_phase_label_fail_loud(tmp_path):
    path = tmp_path / "phases.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    # All rows but Long Ball from the kit, then a doctored Long Ball row with two
    # well-separated percentage spans left of the label (adjacent inserts would fuse
    # into one span and read as label text instead).
    draw_phases_page(page, rows_in=_rows(PHASES_IN_ROWS, drop="Long Ball"))
    for x, text in ((100, "3%"), (160, "6%"), (430, "Long Ball"), (700, "6%")):
        page.insert_text((x, 280), text, fontsize=10)
    doc.save(path)
    doc.close()
    with pymupdf.open(path) as saved:
        with pytest.raises(PhasesParseError) as exc_info:
            extract_domain_c(saved, _anchors(), report_id=REPORT_ID)
    assert "2 percentage span(s) left" in str(exc_info.value)


def test_an_unknown_phase_label_is_never_fuzzy_matched(tmp_path):
    rows_in = _rows(PHASES_IN_ROWS, replace={"Progression": ("16%", "Progressions", "14%")})
    with pytest.raises(UnknownStatisticError) as exc_info:
        _extract(tmp_path, phases_kwargs={"rows_in": rows_in})
    assert "Progressions" in str(exc_info.value)


def test_a_missing_phase_row_is_named(tmp_path):
    rows_out = _rows(PHASES_OUT_ROWS, drop="Counter-press")
    with pytest.raises(MissingFieldError) as exc_info:
        _extract(tmp_path, phases_kwargs={"rows_out": rows_out})
    assert "Counter-press" in str(exc_info.value)


def test_a_duplicated_phase_row_fails_loud(tmp_path):
    rows_out = _rows(PHASES_OUT_ROWS, extra=("9%", "High Press", "6%"))
    with pytest.raises(PhasesParseError) as exc_info:
        _extract(tmp_path, phases_kwargs={"rows_out": rows_out})
    assert "appears twice" in str(exc_info.value)


def test_a_page_without_the_out_of_possession_header_fails_loud(tmp_path):
    path = tmp_path / "phases.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    page.insert_text((430, 105), "IN POSSESSION", fontsize=11)
    page.insert_text((100, 130), "47%", fontsize=10)
    page.insert_text((430, 130), "Build Up Unopposed", fontsize=10)
    page.insert_text((700, 130), "43%", fontsize=10)
    doc.save(path)
    doc.close()
    with pymupdf.open(path) as saved:
        with pytest.raises(PhasesParseError) as exc_info:
            extract_domain_c(saved, {"phases-of-play": [0]}, report_id=REPORT_ID)
    assert "no OUT OF POSSESSION" in str(exc_info.value)


def test_a_phases_anchor_resolving_to_two_pages_fails_loud(tmp_path):
    anchors = _anchors()
    anchors["phases-of-play"] = [0, 1]
    with pytest.raises(PhasesParseError) as exc_info:
        _extract(tmp_path, anchors=anchors)
    assert "2 pages" in str(exc_info.value)


# --- line-height failure paths ----------------------------------------------------


def test_a_missing_line_height_anchor_fails_loud(tmp_path):
    anchors = _anchors()
    del anchors["defensive-line-height:away"]
    with pytest.raises(LineHeightParseError) as exc_info:
        _extract(tmp_path, anchors=anchors)
    assert "defensive-line-height:away" in str(exc_info.value)


def test_a_two_panel_page_fails_loud(tmp_path):
    with pytest.raises(LineHeightParseError) as exc_info:
        _extract(tmp_path, in_possession_kwargs={"panel_count": 2})
    assert "2 pitch panels" in str(exc_info.value)


def test_eight_metre_values_fail_loud(tmp_path):
    with pytest.raises(LineHeightParseError) as exc_info:
        _extract(tmp_path, in_possession_kwargs={"skip": {(1, "team_length")}})
    assert "8 metre values" in str(exc_info.value)


def test_ten_metre_values_fail_loud(tmp_path):
    path = tmp_path / "ten.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    draw_line_height_page(page, "in_possession")
    page.insert_text((200, 200), "42 m", fontsize=9)  # a stray tenth value
    doc.save(path)
    doc.close()
    with pymupdf.open(path) as saved:
        with pytest.raises(LineHeightParseError) as exc_info:
            _parse_line_height_page(saved[0], _IN_POSSESSION_PANELS, REPORT_ID)
    assert "10 metre values" in str(exc_info.value)


def test_an_unknown_panel_header_fails_loud(tmp_path):
    with pytest.raises(LineHeightParseError) as exc_info:
        _extract(
            tmp_path,
            out_of_possession_kwargs={
                "headers": ["High Block / Press", "Middle Block", "Low Block"]
            },
        )
    assert "Middle Block" in str(exc_info.value)


def test_a_value_displaced_off_its_badge_fails_loud(tmp_path):
    with pytest.raises(LineHeightParseError) as exc_info:
        _extract(
            tmp_path,
            in_possession_kwargs={"value_offsets": {(0, "team_width"): (0.0, 40.0)}},
        )
    assert "0 bracket badges" in str(exc_info.value)


def test_a_duplicate_measure_in_one_panel_fails_loud(tmp_path):
    """Nine values, but one panel prints two team-width brackets and no line height."""
    path = tmp_path / "dup.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    draw_line_height_page(page, "in_possession", skip={(0, "line_height")})
    # A second width bracket in panel 0, below the first one.
    cx, cy = 82.5 + 112.5, 400.0
    for rx0, rx1 in ((cx - 60, cx - 13), (cx + 13, cx + 60)):
        page.draw_rect(
            pymupdf.Rect(rx0, cy - 0.35, rx1, cy + 0.35), color=None, fill=LINE_HEIGHT_GRAY
        )
    _draw_bracket_badge(page, cx, cy)
    _draw_metre_value(page, cx, cy, "36")
    doc.save(path)
    doc.close()
    with pymupdf.open(path) as saved:
        with pytest.raises(LineHeightParseError) as exc_info:
            _parse_line_height_page(saved[0], _IN_POSSESSION_PANELS, REPORT_ID)
    assert "two team_width values" in str(exc_info.value)


def test_an_out_of_bounds_metre_value_is_a_recorded_fail_not_a_raise(tmp_path):
    payload = _extract(
        tmp_path,
        in_possession_kwargs={"value_texts": {(0, "line_height"): "120"}},
    )

    assert (
        payload["home"]["line_height_team_length"]["in_possession"]["build-up-low"][
            "line_height"
        ]
        == 120.0
    )
    checks = {check["check"]: check for check in domain_c_checks(payload)}
    bounds = checks["tactical-metre-bounds"]
    assert bounds["result"] == "fail"
    assert "home.in_possession.build-up-low.line_height = 120.0" in bounds["specifics"]


# --- checks -----------------------------------------------------------------------


def test_default_checks_pass_and_are_binary(tmp_path):
    payload = _extract(tmp_path)
    checks = domain_c_checks(payload)

    assert [check["check"] for check in checks] == ["tactical-metre-bounds"]
    for check in checks:
        assert check["result"] in ("pass", "fail")
        assert set(check) == {"check", "result", "specifics"}
        assert check["result"] == "pass"
    assert str(int(PITCH_LENGTH_METRES)) in checks[0]["specifics"]


# --- ground truth (AR-16) ---------------------------------------------------------


@pytest.fixture(scope="module")
def mex_rsa_payload(mex_rsa_pdf):
    with pymupdf.open(mex_rsa_pdf) as doc:
        index = PageTextIndex(doc, "mex_rsa")
        anchors = {
            "phases-of-play": index.find_all(f"{HOME} Phases of Play {AWAY}"),
            "in-possession-line-height:home": index.find_all(
                f"In Possession Line Height & Team Length {HOME}"
            ),
            "in-possession-line-height:away": index.find_all(
                f"In Possession Line Height & Team Length {AWAY}"
            ),
            "defensive-line-height:home": index.find_all(
                f"Defensive Line Height & Team Length {HOME}"
            ),
            "defensive-line-height:away": index.find_all(
                f"Defensive Line Height & Team Length {AWAY}"
            ),
        }
        return extract_domain_c(doc, anchors, report_id="mex_rsa")


def test_ground_truth_phase_spot_checks(mex_rsa_payload):
    home = mex_rsa_payload["home"]
    away = mex_rsa_payload["away"]
    assert home["phases_in_possession"]["build_up_unopposed"] == 47.0
    assert home["phases_out_of_possession"]["counter_press"] == 8.0
    assert away["phases_out_of_possession"]["mid_block"] == 30.0
    # The §Spec correction evidence: blocks are independent rates, nowhere near 100.
    assert home["defensive_block"] == {"high": 7.0, "mid": 25.0, "low": 11.0}
    assert away["defensive_block"] == {"high": 5.0, "mid": 30.0, "low": 14.0}
    assert sum(home["defensive_block"].values()) == 43.0
    assert sum(away["defensive_block"].values()) == 49.0


def test_ground_truth_line_height_pages_classify_nine_in_bounds_values_each(
    mex_rsa_payload,
):
    for side in ("home", "away"):
        for state, panels in mex_rsa_payload[side]["line_height_team_length"].items():
            assert len(panels) == 3, (side, state)
            for panel_key, measures in panels.items():
                assert set(measures) == {"line_height", "team_length", "team_width"}
                for value in measures.values():
                    assert 0 < value <= PITCH_LENGTH_METRES, (side, state, panel_key)
    # The Task 4.3 classification, spot-checked against the probed geometry.
    build_up_mid = mex_rsa_payload["home"]["line_height_team_length"]["in_possession"][
        "build-up-mid"
    ]
    assert build_up_mid == {"line_height": 39.0, "team_length": 33.0, "team_width": 57.0}


def test_ground_truth_checks_all_pass(mex_rsa_payload):
    for check in domain_c_checks(mex_rsa_payload):
        assert check["result"] == "pass", check

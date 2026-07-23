"""Tasks 3-6: Domain A lineup parse, normalization, glyph classification, checks.

Synthetic pages come from the conftest lineup kit (geometry mirrors the real template);
`spike/mex_rsa.pdf` is the only real-PDF fixture and pins the ground truth the whole
design was verified against (both column grammars, wrapped names, glued position codes,
multi-marker rows, the six glyph fills).
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from pipeline.extract import aggregate_self_validation
from pipeline.extract.domain_a import (
    _parse_column,
    _parse_formations,
    _validate_completeness,
    domain_a_checks,
    extract_domain_a,
)
from pipeline.extract.lines import TextSpan, VisualRow
from pipeline.extract.errors import (
    LineupCountError,
    LineupParseError,
    MalformedFieldError,
    MissingFieldError,
    UnknownMinuteGlyphError,
    UnknownPositionError,
    UnknownStageError,
    UnknownVenueError,
)
from pipeline.extract.venues import VENUE_UTC_OFFSETS, utc_offset_for
from pipeline.tests.conftest import (
    default_lineup_sides,
    draw_lineup_page,
    lineup_entry,
    lineup_side,
)

REPORT_ID = "PMSR-M01-TEST"


def _metadata(**overrides) -> dict:
    metadata = {
        "home_team": "Mexico",
        "away_team": "South Africa",
        "home_score": 2,
        "away_score": 0,
        "stage_text": "Group A - Match 1",
        "match_date": "2026-06-11",
        "kickoff": "13:00",
        "venue": "Mexico City Stadium",
        "shootout": None,
    }
    metadata.update(overrides)
    return metadata


def _lineup_doc(tmp_path: Path, home=None, away=None, **draw_kwargs) -> "pymupdf.Document":
    if home is None or away is None:
        default_home, default_away = default_lineup_sides()
        home = home if home is not None else default_home
        away = away if away is not None else default_away
    path = tmp_path / "lineup.pdf"
    doc = pymupdf.open()
    draw_lineup_page(doc.new_page(width=960, height=540), home, away, **draw_kwargs)
    doc.save(path)
    doc.close()
    return pymupdf.open(path)


def _extract(tmp_path, metadata=None, home=None, away=None, anchors=None, **draw_kwargs):
    with _lineup_doc(tmp_path, home=home, away=away, **draw_kwargs) as doc:
        return extract_domain_a(
            doc,
            metadata if metadata is not None else _metadata(),
            anchors if anchors is not None else {"lineups": [0]},
            report_id=REPORT_ID,
        )


def _by_shirt(lineup_section, shirt):
    return next(entry for entry in lineup_section if entry["shirt_number"] == shirt)


# --- the full payload off a synthetic page (AC 1, AC 2) --------------------------


def test_extracts_the_full_domain_a_payload_from_a_synthetic_page(tmp_path):
    payload = _extract(tmp_path)

    assert payload["stage"] == "group"
    assert payload["group"] == "a"
    assert payload["venue"] == "Mexico City Stadium"
    assert payload["date"] == "2026-06-11"
    assert payload["kickoff"] == "2026-06-11T13:00:00-06:00"
    assert payload["teams"] == {"home": "Mexico", "away": "South Africa"}
    assert payload["score"] == {"home": 2, "away": 0, "shootout": None}

    lineups = payload["lineups"]
    assert lineups["home"]["formation"] == "4-1-2-3"
    assert lineups["away"]["formation"] == "5-3-2"
    for side in ("home", "away"):
        assert len(lineups[side]["starters"]) == 11
        assert len(lineups[side]["substitutes"]) == 5

    # The default sides score two home goals (starters 6 and 7 at 5' and 12'), book
    # starter 4 at 17', and pair a 76' substitution (starter 11 off, substitute 13 on).
    first_scorer = _by_shirt(lineups["home"]["starters"], 6)
    assert first_scorer["goals"] == [{"minute": 5, "stoppage_minute": None}]
    second_scorer = _by_shirt(lineups["home"]["starters"], 7)
    assert second_scorer["goals"] == [{"minute": 12, "stoppage_minute": None}]
    substituted = _by_shirt(lineups["home"]["starters"], 11)
    assert substituted["substituted_off"] == {"minute": 76, "stoppage_minute": None}
    replacement = _by_shirt(lineups["home"]["substitutes"], 13)
    assert replacement["substituted_on"] == {"minute": 76, "stoppage_minute": None}
    for side in ("home", "away"):
        booked = _by_shirt(lineups[side]["starters"], 4)
        assert booked["cards"] == [
            {"type": "yellow", "at": {"minute": 17, "stoppage_minute": None}}
        ]
    away_goals = [entry["goals"] for entry in lineups["away"]["starters"]]
    assert all(goals == [] for goals in away_goals)


def test_positions_map_to_the_lowercase_enum_and_names_pass_through(tmp_path):
    home = lineup_side()
    home["starters"][0]["name"] = "José ÁLVAREZ"
    payload = _extract(tmp_path, home=home)
    keeper = payload["lineups"]["home"]["starters"][0]
    assert keeper["position"] == "gk"
    assert keeper["name"] == "José ÁLVAREZ"
    positions = {entry["position"] for entry in payload["lineups"]["home"]["starters"]}
    assert positions == {"gk", "df", "mf", "fw"}


def test_starters_and_substitutes_keep_the_printed_order(tmp_path):
    payload = _extract(tmp_path)
    shirts = [entry["shirt_number"] for entry in payload["lineups"]["home"]["starters"]]
    assert shirts == list(range(1, 12))


def test_stoppage_time_notation_splits_into_minute_and_stoppage(tmp_path):
    home = lineup_side()
    home["starters"][8]["markers"] = [("goal", "90+2'")]
    home["starters"][9]["markers"] = [("goal", "45+12'")]
    payload = _extract(tmp_path, home=home)
    assert _by_shirt(payload["lineups"]["home"]["starters"], 9)["goals"] == [
        {"minute": 90, "stoppage_minute": 2}
    ]
    assert _by_shirt(payload["lineups"]["home"]["starters"], 10)["goals"] == [
        {"minute": 45, "stoppage_minute": 12}
    ]


def test_own_goal_glyphs_land_in_own_goals_not_goals(tmp_path):
    away = lineup_side("South Africa")
    away["starters"][2]["markers"] = [("own-goal", "40'")]
    payload = _extract(tmp_path, away=away, metadata=_metadata(home_score=3))
    unlucky = _by_shirt(payload["lineups"]["away"]["starters"], 3)
    assert unlucky["own_goals"] == [{"minute": 40, "stoppage_minute": None}]
    assert unlucky["goals"] == []


def test_red_card_glyph_records_a_red_card(tmp_path):
    home = lineup_side()
    home["starters"][1]["markers"] = [("card-red", "92'")]
    payload = _extract(tmp_path, home=home)
    assert _by_shirt(payload["lineups"]["home"]["starters"], 2)["cards"] == [
        {"type": "red", "at": {"minute": 92, "stoppage_minute": None}}
    ]


def test_a_wrapped_home_name_reassembles_across_its_fragment_rows(tmp_path):
    home = lineup_side()
    home["starters"][10] = lineup_entry(
        24, "FW", None, markers=[("goal", "64'")],
        name_above="Crysencio", name_below="SUMMERVILLE",
    )
    payload = _extract(tmp_path, home=home)
    wrapped = _by_shirt(payload["lineups"]["home"]["starters"], 24)
    assert wrapped["name"] == "Crysencio SUMMERVILLE"
    assert wrapped["goals"] == [{"minute": 64, "stoppage_minute": None}]


def test_a_wrapped_away_name_shifts_only_its_own_column(tmp_path):
    away = lineup_side("South Africa")
    away["starters"][4] = lineup_entry(
        5, "DF", None, name_above="Azzedine", name_below="OUNAHI"
    )
    payload = _extract(tmp_path, away=away)
    assert _by_shirt(payload["lineups"]["away"]["starters"], 5)["name"] == "Azzedine OUNAHI"
    # Both columns parse in full even though the wrap breaks their y-alignment.
    assert len(payload["lineups"]["home"]["starters"]) == 11
    assert [entry["shirt_number"] for entry in payload["lineups"]["away"]["starters"]] == list(
        range(1, 12)
    )


def test_a_glued_away_position_and_number_still_parse(tmp_path):
    away = lineup_side("South Africa")
    away["starters"][9] = lineup_entry(15, "FW", "Iqraam RAYNERS", glued=True)
    payload = _extract(tmp_path, away=away)
    rayners = _by_shirt(payload["lineups"]["away"]["starters"], 15)
    assert rayners["name"] == "Iqraam RAYNERS"
    assert rayners["position"] == "fw"


# --- stage / kickoff normalization (AC 2) ----------------------------------------


@pytest.mark.parametrize(
    ("stage_text", "expected_stage", "expected_group"),
    [
        ("Group A - Match 1", "group", "a"),
        ("Group L - Match 68", "group", "l"),
        ("Round of 32 - Match 74", "r32", None),
        ("Round of 16 - Match 89", "r16", None),
        ("Quarter-final - Match 100", "qf", None),
        ("Semi-final - Match 101", "sf", None),
        ("Bronze final - Match 103", "third-place", None),
        ("Final - Match 104", "final", None),
    ],
)
def test_stage_lines_map_onto_the_closed_ad3_enum(tmp_path, stage_text, expected_stage, expected_group):
    payload = _extract(tmp_path, metadata=_metadata(stage_text=stage_text))
    assert payload["stage"] == expected_stage
    assert payload["group"] == expected_group


def test_the_shootout_line_passes_through_verbatim(tmp_path):
    payload = _extract(
        tmp_path,
        metadata=_metadata(
            stage_text="Round of 32 - Match 74",
            shootout="(Paraguay win 3-4 on Penalties)",
        ),
    )
    assert payload["score"]["shootout"] == "(Paraguay win 3-4 on Penalties)"


@pytest.mark.parametrize(
    ("venue", "offset"),
    [
        ("Mexico City Stadium", "-06:00"),
        ("Toronto Stadium", "-04:00"),
        ("Dallas Stadium", "-05:00"),
        ("BC Place Vancouver", "-07:00"),
    ],
)
def test_kickoff_composes_venue_local_time_with_the_venue_utc_offset(tmp_path, venue, offset):
    payload = _extract(tmp_path, metadata=_metadata(venue=venue, kickoff="21:00"))
    assert payload["kickoff"] == f"2026-06-11T21:00:00{offset}"


def test_the_venue_offset_table_covers_exactly_the_sixteen_corpus_venues():
    assert len(VENUE_UTC_OFFSETS) == 16
    assert all(offset in {"-04:00", "-05:00", "-06:00", "-07:00"} for offset in VENUE_UTC_OFFSETS.values())
    assert utc_offset_for("Mexico City Stadium") == "-06:00"


# --- failure paths: every typed error, loud (AC 1, AD-8) -------------------------


def test_unknown_stage_text_fails_loud(tmp_path):
    with pytest.raises(UnknownStageError, match="Quarterfinals"):
        _extract(tmp_path, metadata=_metadata(stage_text="Quarterfinals - Match 97"))


def test_unknown_venue_fails_loud_instead_of_defaulting_an_offset(tmp_path):
    with pytest.raises(UnknownVenueError, match="Atlantis Arena"):
        _extract(tmp_path, metadata=_metadata(venue="Atlantis Arena"))


def test_unknown_position_code_fails_loud(tmp_path):
    home = lineup_side()
    home["starters"][6] = lineup_entry(7, "ST", "Test STRIKER")
    with pytest.raises(UnknownPositionError, match="'ST'"):
        _extract(tmp_path, home=home)


def test_an_unknown_glyph_fill_fails_loud(tmp_path):
    home = lineup_side()
    home["starters"][3]["markers"] = [((0.5, 0.5, 0.5), "55'")]
    with pytest.raises(UnknownMinuteGlyphError, match="not in the known legend"):
        _extract(tmp_path, home=home)


def test_a_minute_with_no_adjacent_glyph_fails_loud(tmp_path):
    home = lineup_side()
    home["starters"][3]["markers"] = [(None, "55'")]
    with pytest.raises(UnknownMinuteGlyphError, match="0 adjacent glyphs"):
        _extract(tmp_path, home=home)


def test_a_minute_beyond_the_clock_bound_fails_loud(tmp_path):
    home = lineup_side()
    home["starters"][3]["markers"] = [("goal", "121'")]
    with pytest.raises(LineupParseError, match="121"):
        _extract(tmp_path, home=home)


def test_a_missing_starting_header_fails_loud(tmp_path):
    # Without headers the first player row is already "above the STARTING header" —
    # the guard fires on it before the column can finish parsing headerless.
    with pytest.raises(LineupParseError, match="STARTING header"):
        _extract(tmp_path, home=lineup_side(headers=False))


def test_a_missing_formation_string_fails_loud(tmp_path):
    with pytest.raises(LineupCountError, match="1 formation"):
        _extract(tmp_path, formations=("4-1-2-3", None))


def test_a_shirt_number_outside_the_contract_bound_fails_loud(tmp_path):
    home = lineup_side()
    home["starters"][2] = lineup_entry(0, "DF", "Test ZERO")
    with pytest.raises(LineupParseError, match="shirt number 0"):
        _extract(tmp_path, home=home)


def test_two_sub_on_markers_on_one_player_fail_loud(tmp_path):
    home = lineup_side()
    home["substitutes"][0]["markers"] = [("sub-on", "60'"), ("sub-on", "70'")]
    with pytest.raises(LineupParseError, match="two sub-on markers"):
        _extract(tmp_path, home=home)


def test_missing_field_errors_name_the_field_empty_substitutes(tmp_path):
    with pytest.raises(MissingFieldError, match=r"lineups\.home\.substitutes"):
        _extract(tmp_path, home=lineup_side(substitutes=[]))


def test_missing_field_errors_name_the_field_blank_venue(tmp_path):
    with pytest.raises(MissingFieldError, match=r"metadata\.venue"):
        _extract(tmp_path, metadata=_metadata(venue="  "))


def test_a_multi_page_lineups_anchor_fails_rather_than_guessing_a_page(tmp_path):
    with pytest.raises(LineupParseError, match="2 pages"):
        _extract(tmp_path, anchors={"lineups": [0, 1]})


def test_an_absent_lineups_anchor_fails_rather_than_falling_back_to_an_index(tmp_path):
    with pytest.raises(LineupParseError, match="anchor map"):
        _extract(tmp_path, anchors={})


def test_every_extract_failure_names_the_report_id(tmp_path):
    with pytest.raises(UnknownVenueError, match=r"\[PMSR-M01-TEST\]"):
        _extract(tmp_path, metadata=_metadata(venue="Atlantis Arena"))


# --- malformed metadata values: typed, and distinct from "missing" ---------------


def test_a_non_iso_date_fails_as_malformed_not_missing(tmp_path):
    with pytest.raises(MalformedFieldError, match="match_date is not ISO 8601"):
        _extract(tmp_path, metadata=_metadata(match_date="11 June 2026"))


def test_an_impossible_calendar_date_fails_loud(tmp_path):
    with pytest.raises(MalformedFieldError, match="not a real calendar date"):
        _extract(tmp_path, metadata=_metadata(match_date="2026-13-45"))


def test_an_impossible_clock_time_fails_loud(tmp_path):
    with pytest.raises(MalformedFieldError, match="not a real clock time"):
        _extract(tmp_path, metadata=_metadata(kickoff="99:99"))


def test_a_non_numeric_score_fails_typed_never_a_bare_value_error(tmp_path):
    with pytest.raises(MalformedFieldError, match="home_score is not numeric"):
        _extract(tmp_path, metadata=_metadata(home_score="two"))


# --- silent-drop guards on the lineup page ---------------------------------------


def test_a_digit_bearing_fragment_row_fails_instead_of_joining_a_name(tmp_path):
    home = lineup_side()
    home["starters"][10] = lineup_entry(11, "FW", None, name_above="Test", name_below="99 PROBLEMS")
    with pytest.raises(LineupParseError, match="never contain digits"):
        _extract(tmp_path, home=home)


def test_a_name_span_straddling_the_column_band_edge_fails_loud(tmp_path):
    home = lineup_side()
    home["starters"][5] = lineup_entry(6, "MF", "Test " + "STRADDLE" * 8)
    with pytest.raises(LineupParseError, match="band edge"):
        _extract(tmp_path, home=home)


def _row(y, text, x0=50.0):
    span = TextSpan(x0=x0, y0=y, x1=x0 + 6.0 * len(text), y1=y + 9.0, text=text)
    return VisualRow(y=y, spans=(span,))


def test_a_player_row_above_the_starting_header_fails_loud():
    rows = [
        _row(100.0, "7 MF Test EARLY"),
        _row(115.0, "STARTING"),
        _row(128.5, "1 GK Test KEEPER"),
    ]
    with pytest.raises(LineupParseError, match="above the STARTING header"):
        _parse_column(rows, "home", REPORT_ID)


def test_a_name_fragment_ambiguously_between_two_rows_fails_loud():
    rows = [
        _row(100.0, "STARTING"),
        _row(113.5, "7 MF Test SEVEN"),
        _row(127.0, "8 FW Test EIGHT"),
        _row(120.3, "FRAGMENT"),  # 6.8pt from one row, 6.7pt from the other
    ]
    with pytest.raises(LineupParseError, match="ambiguously between two player rows"):
        _parse_column(rows, "home", REPORT_ID)


def test_formation_labels_on_one_side_of_the_centre_fail_loud():
    spans = [
        TextSpan(x0=330.0, y0=210.0, x1=360.0, y1=219.0, text="4-1-2-3"),
        TextSpan(x0=380.0, y0=210.0, x1=410.0, y1=219.0, text="5-3-2"),
    ]
    with pytest.raises(LineupCountError, match="straddle the page centre"):
        _parse_formations(spans, 960.0, REPORT_ID)


# --- the completeness walk covers the whole §6 entry shape -----------------------


def test_completeness_names_a_dropped_minute_list_key(tmp_path):
    payload = _extract(tmp_path)
    del payload["lineups"]["home"]["starters"][0]["goals"]
    with pytest.raises(MissingFieldError, match=r"lineups\.home\.starters\[0\]\.goals"):
        _validate_completeness(payload, REPORT_ID)


def test_completeness_names_a_dropped_substitution_key(tmp_path):
    payload = _extract(tmp_path)
    del payload["lineups"]["away"]["substitutes"][2]["substituted_off"]
    with pytest.raises(
        MissingFieldError, match=r"lineups\.away\.substitutes\[2\]\.substituted_off"
    ):
        _validate_completeness(payload, REPORT_ID)


# --- Self-Validation checks (SM-C1: binary, recorded, never loosened) ------------


def _payload_and_metadata(tmp_path, metadata=None, **kwargs):
    metadata = metadata if metadata is not None else _metadata()
    return _extract(tmp_path, metadata=metadata, **kwargs), metadata


def _check_results(checks):
    return {check["check"]: check["result"] for check in checks}


def test_all_six_checks_pass_on_a_consistent_report(tmp_path):
    payload, metadata = _payload_and_metadata(tmp_path)
    checks = domain_a_checks(payload)
    assert _check_results(checks) == {
        "domain-a-starters-count": "pass",
        "domain-a-goalkeeper-count": "pass",
        "domain-a-shirt-numbers-unique": "pass",
        "domain-a-formation-sum": "pass",
        "domain-a-substitution-pairing": "pass",
        "domain-a-goal-reconciliation": "pass",
    }
    assert aggregate_self_validation(checks) == "pass"


def test_ten_starters_fail_the_starters_count_check(tmp_path):
    home = lineup_side()
    del home["starters"][10]
    payload, metadata = _payload_and_metadata(tmp_path, home=home)
    checks = domain_a_checks(payload)
    assert _check_results(checks)["domain-a-starters-count"] == "fail"
    failing = next(c for c in checks if c["check"] == "domain-a-starters-count")
    assert "home 10" in failing["specifics"]


def test_two_starting_goalkeepers_fail_the_goalkeeper_check(tmp_path):
    home = lineup_side()
    home["starters"][1] = lineup_entry(2, "GK", "Test SECONDKEEPER")
    payload, metadata = _payload_and_metadata(tmp_path, home=home)
    assert _check_results(domain_a_checks(payload))["domain-a-goalkeeper-count"] == "fail"


def test_duplicate_shirt_numbers_fail_the_uniqueness_check(tmp_path):
    home = lineup_side()
    home["substitutes"][0] = lineup_entry(7, "GK", "Test DUPLICATE")
    payload, metadata = _payload_and_metadata(tmp_path, home=home)
    checks = domain_a_checks(payload)
    assert _check_results(checks)["domain-a-shirt-numbers-unique"] == "fail"
    assert "7" in next(c for c in checks if c["check"] == "domain-a-shirt-numbers-unique")["specifics"]


def test_a_formation_whose_outfield_sum_is_not_ten_fails_the_sum_check(tmp_path):
    payload, metadata = _payload_and_metadata(tmp_path, formations=("4-4-3", "5-3-2"))
    assert _check_results(domain_a_checks(payload))["domain-a-formation-sum"] == "fail"


def test_an_unpaired_substitution_fails_the_pairing_check(tmp_path):
    home = lineup_side()
    home["starters"][7]["markers"] = [("sub-off", "80'")]  # nobody comes on at 80'
    payload, metadata = _payload_and_metadata(tmp_path, home=home)
    assert _check_results(domain_a_checks(payload))["domain-a-substitution-pairing"] == "fail"


def test_goal_markers_short_of_the_cover_score_fail_reconciliation(tmp_path):
    payload, metadata = _payload_and_metadata(tmp_path, metadata=_metadata(home_score=3))
    checks = domain_a_checks(payload)
    assert _check_results(checks)["domain-a-goal-reconciliation"] == "fail"
    failing = next(c for c in checks if c["check"] == "domain-a-goal-reconciliation")
    assert "cover score 3" in failing["specifics"]


def test_an_own_goal_reconciles_toward_the_opposing_team(tmp_path):
    away = lineup_side("South Africa")
    away["starters"][2]["markers"] = [("own-goal", "40'")]
    payload, metadata = _payload_and_metadata(
        tmp_path, away=away, metadata=_metadata(home_score=3)
    )
    assert _check_results(domain_a_checks(payload))["domain-a-goal-reconciliation"] == "pass"


def test_aggregate_result_over_present_checks_only():
    assert aggregate_self_validation([]) == "not-applicable"
    assert aggregate_self_validation([{"check": "x", "result": "pass", "specifics": ""}]) == "pass"
    assert (
        aggregate_self_validation(
            [
                {"check": "x", "result": "pass", "specifics": ""},
                {"check": "y", "result": "fail", "specifics": ""},
            ]
        )
        == "fail"
    )


def test_a_malformed_check_result_never_launders_into_pass():
    assert aggregate_self_validation([{"check": "x", "result": "error", "specifics": ""}]) == "fail"
    assert aggregate_self_validation([{"check": "x", "specifics": ""}]) == "fail"


# --- ground truth: spike/mex_rsa.pdf (AC 1, AC 2) --------------------------------


@pytest.fixture(scope="module")
def mex_rsa_payload(mex_rsa_pdf):
    from pipeline.discover.probe import probe_report
    from pipeline.discover.text import PageTextIndex

    meta = probe_report(mex_rsa_pdf)
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
    with pymupdf.open(mex_rsa_pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        anchors = {"lineups": index.find_all("Match Summary - Teams")}
        payload = extract_domain_a(doc, metadata, anchors, report_id=meta.report_id)
    return payload, metadata


def test_mex_rsa_formations_and_counts(mex_rsa_payload):
    payload, _ = mex_rsa_payload
    assert payload["lineups"]["home"]["formation"] == "4-1-2-3"
    assert payload["lineups"]["away"]["formation"] == "5-3-2"
    for side in ("home", "away"):
        assert len(payload["lineups"][side]["starters"]) == 11
        assert len(payload["lineups"][side]["substitutes"]) == 15


def test_mex_rsa_normalized_metadata(mex_rsa_payload):
    payload, _ = mex_rsa_payload
    assert payload["stage"] == "group"
    assert payload["group"] == "a"
    assert payload["date"] == "2026-06-11"
    assert payload["kickoff"] == "2026-06-11T13:00:00-06:00"
    assert payload["score"] == {"home": 2, "away": 0, "shootout": None}


def test_mex_rsa_home_column_grammar_rows(mex_rsa_payload):
    payload, _ = mex_rsa_payload
    starters = payload["lineups"]["home"]["starters"]
    keeper = starters[0]
    assert keeper == {
        "name": "Raul RANGEL",
        "shirt_number": 1,
        "position": "gk",
        "goals": [],
        "own_goals": [],
        "cards": [],
        "substituted_on": None,
        "substituted_off": None,
    }
    one_line_row = _by_shirt(starters, 25)
    assert one_line_row["name"] == "Roberto ALVARADO"
    assert one_line_row["position"] == "fw"


def test_mex_rsa_away_column_grammar_rows(mex_rsa_payload):
    payload, _ = mex_rsa_payload
    starters = payload["lineups"]["away"]["starters"]
    keeper = _by_shirt(starters, 1)
    assert keeper["name"] == "Ronwen WILLIAMS"
    assert keeper["position"] == "gk"
    glued = _by_shirt(starters, 15)  # printed as "FW15", number glued to the code
    assert glued["name"] == "Iqraam RAYNERS"
    assert glued["position"] == "fw"
    assert glued["substituted_off"] == {"minute": 76, "stoppage_minute": None}
    sibisi = _by_shirt(starters, 19)
    assert sibisi["cards"] == [{"type": "yellow", "at": {"minute": 74, "stoppage_minute": None}}]


def test_mex_rsa_multi_marker_row_and_minute_kinds(mex_rsa_payload):
    payload, _ = mex_rsa_payload
    starters = payload["lineups"]["home"]["starters"]
    jimenez = _by_shirt(starters, 9)
    assert jimenez["name"] == "Raul JIMENEZ"
    assert jimenez["goals"] == [{"minute": 67, "stoppage_minute": None}]
    assert jimenez["substituted_off"] == {"minute": 76, "stoppage_minute": None}
    quinones = _by_shirt(starters, 16)
    assert quinones["goals"] == [{"minute": 9, "stoppage_minute": None}]
    montes = _by_shirt(starters, 3)
    assert montes["cards"] == [{"type": "red", "at": {"minute": 92, "stoppage_minute": None}}]
    gutierrez = _by_shirt(starters, 26)
    assert gutierrez["cards"] == [
        {"type": "yellow", "at": {"minute": 23, "stoppage_minute": None}}
    ]
    mokoena = _by_shirt(payload["lineups"]["away"]["starters"], 4)
    assert mokoena["cards"] == [{"type": "yellow", "at": {"minute": 17, "stoppage_minute": None}}]


def test_mex_rsa_passes_every_self_validation_check(mex_rsa_payload):
    payload, metadata = mex_rsa_payload
    checks = domain_a_checks(payload)
    assert all(check["result"] == "pass" for check in checks)
    assert aggregate_self_validation(checks) == "pass"


def test_mex_rsa_extraction_is_deterministic(mex_rsa_pdf, mex_rsa_payload):
    import json

    from pipeline.discover.text import PageTextIndex

    payload, metadata = mex_rsa_payload
    with pymupdf.open(mex_rsa_pdf) as doc:
        index = PageTextIndex(doc)
        anchors = {"lineups": index.find_all("Match Summary - Teams")}
        again = extract_domain_a(doc, metadata, anchors)
    assert json.dumps(payload, sort_keys=True) == json.dumps(again, sort_keys=True)

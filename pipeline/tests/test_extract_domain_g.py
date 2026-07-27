"""Domain G parser and self-validation checks (Story 1.10, FR-8).

The pages are synthesized directly here rather than through `make_report`: this module
tests the parser, so it needs one cheap document per doctored case, and the eight-page
factory would cost a full multi-anchor report per assertion.

The first test in the file is the join asymmetry, deliberately: an unused substitute has
no Domain G row on any of the 104 corpus reports, and the natural-but-wrong "every
lineup player needs a row" rule would fire on every one of them.
"""

from __future__ import annotations

import pymupdf
import pytest

from pipeline.extract.domain_g import (
    DISTRIBUTIONS_COLUMNS,
    IN_POSSESSION_FIELDS,
    OFFERS_COLUMNS,
    OUT_OF_POSSESSION_COLUMNS,
    OUT_OF_POSSESSION_FIELDS,
    PHYSICAL_COLUMNS,
    PHYSICAL_FIELDS,
    domain_g_checks,
    extract_domain_g,
    has_minutes,
)
from pipeline.extract.errors import (
    MalformedFieldError,
    MissingFieldError,
    PlayerJoinError,
    PlayerTableParseError,
)
from pipeline.tests.conftest import (
    DEFAULT_DISTRIBUTIONS_HEAD,
    DEFAULT_OFFERS,
    DEFAULT_OUT_OF_POSSESSION,
    DOMAIN_G_DRAWERS,
    DOMAIN_G_FONTSIZE,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    draw_distributions_page,
)

FAMILY_STEMS = (
    "individual-distributions",
    "individual-offers-receptions",
    "individual-out-of-possession",
    "physical-data",
)

# total, zone 1-5, high speed runs, sprints, top speed. The zones sum to the total
# exactly, so any zone-sum failure in a test is the one that test introduced.
DEFAULT_PHYSICAL = (1000.0, 700.0, 200.0, 60.0, 30.0, 10.0, 12, 3, 25.0)


def row(shirt, name, **overrides):
    """One printed Domain G row across all four families, defaults overridable."""
    values = {
        "shirt": shirt,
        "name": name,
        "distributions": DEFAULT_DISTRIBUTIONS_HEAD + (3, 0),
        "offers": DEFAULT_OFFERS,
        "out_of_possession": DEFAULT_OUT_OF_POSSESSION,
        "physical": DEFAULT_PHYSICAL,
    }
    values.update(overrides)
    return values


def lineup_entry(shirt, name, position="mf", *, substituted_on=None, own_goals=0):
    return {
        "name": name,
        "shirt_number": shirt,
        "position": position,
        "goals": [],
        "own_goals": [{"minute": 30, "raw": "30'"}] * own_goals,
        "cards": [],
        "substituted_on": substituted_on,
        "substituted_off": None,
    }


def lineups(home_starters, away_starters, *, home_subs=(), away_subs=()):
    return {
        "home": {"starters": list(home_starters), "substitutes": list(home_subs)},
        "away": {"starters": list(away_starters), "substitutes": list(away_subs)},
    }


def build(rows_by_side, *, pages_per_family=1, families=FAMILY_STEMS, **draw_kwargs):
    """A document carrying one page per family per side, and its resolved anchor map.

    `families` lets a test emit a subset (an absent family's anchor then resolves to
    nothing at all, the missing-anchor path).
    """
    doc = pymupdf.open()
    anchors: dict[str, list[int]] = {}
    for stem in families:
        for side in ("home", "away"):
            indexes = []
            for _ in range(pages_per_family):
                page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
                drawer = DOMAIN_G_DRAWERS[stem]
                if drawer is draw_distributions_page:
                    drawer(page, rows_by_side[side], **draw_kwargs)
                else:
                    drawer(page, rows_by_side[side])
                indexes.append(page.number)
            anchors[f"{stem}:{side}"] = indexes
    return doc, anchors


def extract(rows_by_side, lineup_block, **build_kwargs):
    doc, anchors = build(rows_by_side, **build_kwargs)
    with doc:
        return extract_domain_g(doc, anchors, lineup_block, report_id="PMSR-M01-AAA-V-BBB")


def one_each(home_rows, away_rows):
    return {"home": home_rows, "away": away_rows}


BASIC_ROWS = one_each([row(1, "Ana ALPHA")], [row(2, "Bo BRAVO")])
BASIC_LINEUPS = lineups(
    [lineup_entry(1, "Ana ALPHA", "gk")], [lineup_entry(2, "Bo BRAVO", "fw")]
)


# --- the join asymmetry (AC 1, AC 2 — the easiest thing to get backwards) ---------


def test_an_unused_substitute_has_no_row_and_that_is_not_a_finding():
    """8,412 corpus lineup entries have no Domain G row because they never played."""
    block = lineups(
        [lineup_entry(1, "Ana ALPHA", "gk")],
        [lineup_entry(2, "Bo BRAVO", "fw")],
        home_subs=[lineup_entry(12, "Unused SUB", "df")],
        away_subs=[lineup_entry(13, "Also UNUSED", "mf")],
    )

    payload = extract(BASIC_ROWS, block)

    assert [player["name"] for player in payload["home"]] == ["Ana ALPHA"]
    assert [player["name"] for player in payload["away"]] == ["Bo BRAVO"]


def test_a_substitute_who_came_on_must_have_a_row():
    """AC 1's completeness half: a sub-on stamp means the player took the field."""
    block = lineups(
        [lineup_entry(1, "Ana ALPHA", "gk")],
        [lineup_entry(2, "Bo BRAVO", "fw")],
        home_subs=[
            lineup_entry(12, "Came ON", "df", substituted_on={"minute": 60, "raw": "60'"})
        ],
    )

    with pytest.raises(MissingFieldError, match="Came ON"):
        extract(BASIC_ROWS, block)


def test_has_minutes_is_starter_or_a_sub_on_stamp():
    assert has_minutes(lineup_entry(1, "A"), "starters")
    assert not has_minutes(lineup_entry(12, "B"), "substitutes")
    assert has_minutes(
        lineup_entry(12, "B", substituted_on={"minute": 60, "raw": "60'"}), "substitutes"
    )


def test_a_substitute_who_came_on_and_has_a_row_parses_clean():
    on = lineup_entry(12, "Came ON", "df", substituted_on={"minute": 60, "raw": "60'"})
    block = lineups(
        [lineup_entry(1, "Ana ALPHA", "gk")], [lineup_entry(2, "Bo BRAVO", "fw")],
        home_subs=[on, lineup_entry(13, "Unused SUB", "mf")],
    )
    rows = one_each([row(1, "Ana ALPHA"), row(12, "Came ON")], [row(2, "Bo BRAVO")])

    payload = extract(rows, block)

    assert [player["name"] for player in payload["home"]] == ["Ana ALPHA", "Came ON"]
    assert payload["home"][1]["position"] == "df"


# --- the full parse (AC 1) --------------------------------------------------------


def test_every_column_lands_in_its_own_field_in_printed_order():
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)
    player = payload["home"][0]

    printed = DEFAULT_DISTRIBUTIONS_HEAD + (3, 0)
    for (field, _kind), value in zip(DISTRIBUTIONS_COLUMNS, printed):
        assert player["in_possession"][field] == value, field
    flat_offers = dict(zip((field for field, _ in OFFERS_COLUMNS), DEFAULT_OFFERS))
    assert player["in_possession"]["total_offers"] == flat_offers["total_offers"]
    assert player["in_possession"]["offers_received"] == flat_offers["offers_received"]
    assert player["in_possession"]["offers_by_movement_type"] == {
        movement: flat_offers[movement]
        for movement in ("in_front", "in_between", "out_to_in", "in_to_out",
                         "in_behind", "no_movement")
    }
    for (field, _kind), value in zip(OUT_OF_POSSESSION_COLUMNS, DEFAULT_OUT_OF_POSSESSION):
        assert player["out_of_possession"][field] == value, field
    for (field, _kind), value in zip(PHYSICAL_COLUMNS, DEFAULT_PHYSICAL):
        assert player["physical"][field] == value, field


def test_the_payload_carries_the_full_contract_field_inventory():
    """AC 1: the 17 / 15 / 9 field lists, derived from the parser's own column table."""
    player = extract(BASIC_ROWS, BASIC_LINEUPS)["home"][0]

    assert set(player) == {
        "name", "shirt_number", "position", "in_possession", "out_of_possession",
        "physical",
    }
    assert set(player["in_possession"]) == set(IN_POSSESSION_FIELDS)
    assert set(player["out_of_possession"]) == set(OUT_OF_POSSESSION_FIELDS)
    assert set(player["physical"]) == set(PHYSICAL_FIELDS)
    assert len(IN_POSSESSION_FIELDS) == 17
    assert len(OUT_OF_POSSESSION_FIELDS) == 15
    assert len(PHYSICAL_FIELDS) == 9


def test_the_position_is_copied_from_the_joined_lineup_entry():
    """The Domain G pages print no position — it can only come from the join."""
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)

    assert payload["home"][0]["position"] == "gk"
    assert payload["away"][0]["position"] == "fw"


def test_rows_keep_page_order():
    block = lineups(
        [lineup_entry(9, "Zed ZULU"), lineup_entry(1, "Ana ALPHA")],
        [lineup_entry(2, "Bo BRAVO")],
    )
    rows = one_each([row(9, "Zed ZULU"), row(1, "Ana ALPHA")], [row(2, "Bo BRAVO")])

    payload = extract(rows, block)

    assert [player["shirt_number"] for player in payload["home"]] == [9, 1]


def test_every_value_is_numeric_typed_never_a_display_string():
    """AC 1 / AD-7: no `%`, `m` or `km/h` strings survive into the payload."""
    player = extract(BASIC_ROWS, BASIC_LINEUPS)["home"][0]

    for block in ("in_possession", "out_of_possession", "physical"):
        for field, value in player[block].items():
            if field == "offers_by_movement_type":
                assert all(isinstance(v, int) for v in value.values())
                continue
            assert isinstance(value, (int, float)), (block, field, value)
            assert not isinstance(value, str)
    assert isinstance(player["in_possession"]["pass_completion"], float)
    assert isinstance(player["in_possession"]["passes_attempted"], int)
    assert isinstance(player["physical"]["total_distance"], float)
    # Printed '12.0' / '3.0', stored as ints (never rounded — asserted integral first).
    assert player["physical"]["high_speed_runs"] == 12
    assert isinstance(player["physical"]["high_speed_runs"], int)
    assert isinstance(player["physical"]["sprints"], int)


@pytest.mark.parametrize("percent_gap", [0.0, 4.0])
def test_both_printed_percent_forms_parse_identically(percent_gap):
    """The real page prints '88' and '%' as abutting spans; pymupdf merges abutting
    synthetic inserts into one. A visibly separated '%' must read the same."""
    payload = extract(BASIC_ROWS, BASIC_LINEUPS, percent_gap=percent_gap)

    assert payload["home"][0]["in_possession"]["pass_completion"] == 88.0


def test_the_header_row_is_not_read_as_a_player_row():
    """The header's leftmost span is the literal '#' in the shirt column."""
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)

    assert len(payload["home"]) == 1


# --- typed failure paths (AC 1, AC 2 — AD-8's loud paths) -------------------------


def test_a_row_whose_name_matches_no_lineup_player_fails_loud():
    rows = one_each([row(1, "Ghost PLAYER")], [row(2, "Bo BRAVO")])

    with pytest.raises(PlayerJoinError) as exc:
        extract(rows, BASIC_LINEUPS)

    # The assembled name is repr'd so a whitespace defect in row assembly is visible.
    assert "'Ghost PLAYER'" in str(exc.value)
    assert "home" in str(exc.value)


def test_a_shirt_number_disagreement_fails_loud():
    rows = one_each([row(7, "Ana ALPHA")], [row(2, "Bo BRAVO")])

    with pytest.raises(PlayerJoinError, match="shirt 7"):
        extract(rows, BASIC_LINEUPS)


def test_a_duplicate_lineup_name_fails_rather_than_collapsing_two_players():
    block = lineups(
        [lineup_entry(1, "Ana ALPHA"), lineup_entry(4, "Ana ALPHA")],
        [lineup_entry(2, "Bo BRAVO")],
    )
    rows = one_each([row(1, "Ana ALPHA"), row(4, "Ana ALPHA")], [row(2, "Bo BRAVO")])

    with pytest.raises(PlayerJoinError, match="twice"):
        extract(rows, block)


def test_a_row_with_the_wrong_number_of_values_fails_loud():
    rows = one_each(
        [row(1, "Ana ALPHA", distributions=DEFAULT_DISTRIBUTIONS_HEAD + (3,))],
        [row(2, "Bo BRAVO")],
    )

    with pytest.raises(PlayerTableParseError) as exc:
        extract(rows, BASIC_LINEUPS)

    assert "13 values, expected 14" in str(exc.value)
    assert "distributions" in str(exc.value)


def test_a_non_numeric_token_in_the_value_area_fails_loud():
    rows = one_each(
        [row(1, "Ana ALPHA", offers=("abc",) + DEFAULT_OFFERS[1:])],
        [row(2, "Bo BRAVO")],
    )

    with pytest.raises(MalformedFieldError, match="not a numeric value"):
        extract(rows, BASIC_LINEUPS)


def test_a_slash_bearing_token_fails_loud_through_the_count_assertion():
    """The `/` of `Tackles Made / Won` is the value area's only slash furniture, so it
    is folded to a separator everywhere. A hypothetical `n/a` cell therefore surfaces as
    a loud count failure printing the tokens seen, not as a silently absorbed value —
    still AD-8's fail-loud, and the message names exactly what was on the page."""
    rows = one_each(
        [row(1, "Ana ALPHA", offers=("n/a",) + DEFAULT_OFFERS[1:])],
        [row(2, "Bo BRAVO")],
    )

    with pytest.raises(PlayerTableParseError) as exc:
        extract(rows, BASIC_LINEUPS)

    assert "9 values, expected 8" in str(exc.value)
    assert "'n', 'a'" in str(exc.value)


def test_a_fractional_sprints_value_fails_loud_naming_field_and_raw_text():
    """The two `.0`-printed columns are asserted integral, never rounded."""
    physical = DEFAULT_PHYSICAL[:7] + ("3.5", DEFAULT_PHYSICAL[8])
    rows = one_each([row(1, "Ana ALPHA", physical=physical)], [row(2, "Bo BRAVO")])

    with pytest.raises(MalformedFieldError) as exc:
        extract(rows, BASIC_LINEUPS)

    assert "sprints" in str(exc.value)
    assert "'3.5'" in str(exc.value)


def test_a_decimal_where_a_count_is_expected_fails_loud():
    rows = one_each(
        [row(1, "Ana ALPHA", distributions=("33.5",) + DEFAULT_DISTRIBUTIONS_HEAD[1:] + (3, 0))],
        [row(2, "Bo BRAVO")],
    )

    with pytest.raises(MalformedFieldError, match="passes_attempted"):
        extract(rows, BASIC_LINEUPS)


def test_a_percentage_outside_0_to_100_fails_loud():
    doctored = DEFAULT_DISTRIBUTIONS_HEAD[:2] + ("150%",) + DEFAULT_DISTRIBUTIONS_HEAD[3:]
    rows = one_each([row(1, "Ana ALPHA", distributions=doctored + (3, 0))], [row(2, "Bo BRAVO")])

    with pytest.raises(MalformedFieldError, match="outside 0-100"):
        extract(rows, BASIC_LINEUPS)


def test_a_percent_sign_on_a_count_column_fails_loud():
    doctored = ("33%",) + DEFAULT_DISTRIBUTIONS_HEAD[1:] + (3, 0)
    rows = one_each([row(1, "Ana ALPHA", distributions=doctored)], [row(2, "Bo BRAVO")])

    with pytest.raises(MalformedFieldError, match="expected no percent sign"):
        extract(rows, BASIC_LINEUPS)


def test_an_anchor_resolving_to_two_pages_fails_loud():
    """832/832 corpus pages resolve singly, but 1.3's attempts table proved multi-page
    sections are real — this asserts rather than silently reading the first page."""
    with pytest.raises(PlayerTableParseError, match="expected 1"):
        extract(BASIC_ROWS, BASIC_LINEUPS, pages_per_family=2)


def test_a_missing_family_anchor_fails_loud():
    with pytest.raises(PlayerTableParseError, match="no resolved"):
        extract(BASIC_ROWS, BASIC_LINEUPS, families=FAMILY_STEMS[:3])


def test_a_page_with_no_player_rows_fails_loud():
    with pytest.raises(PlayerTableParseError, match="no player rows"):
        extract(one_each([], []), BASIC_LINEUPS)


def test_a_row_with_no_name_fails_loud():
    rows = one_each([row(1, None)], [row(2, "Bo BRAVO")])

    with pytest.raises(PlayerTableParseError, match="empty player name"):
        extract(rows, BASIC_LINEUPS)


def test_the_four_families_must_agree_on_the_same_player_set():
    """A family listing a different set would merge one player's numbers onto another."""
    doc = pymupdf.open()
    anchors: dict[str, list[int]] = {}
    for stem in FAMILY_STEMS:
        for side in ("home", "away"):
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            rows = BASIC_ROWS[side]
            if stem == "physical-data" and side == "home":
                rows = [row(1, "Ana ALPHA"), row(2, "Extra PLAYER")]
            DOMAIN_G_DRAWERS[stem](page, rows)
            anchors[f"{stem}:{side}"] = [page.number]

    with doc:
        with pytest.raises(PlayerTableParseError, match="different player sequence"):
            extract_domain_g(doc, anchors, BASIC_LINEUPS, report_id="PMSR-M01-AAA-V-BBB")


def test_the_same_document_extracts_identically_twice():
    doc, anchors = build(BASIC_ROWS)
    with doc:
        first = extract_domain_g(doc, anchors, BASIC_LINEUPS, report_id="R")
        second = extract_domain_g(doc, anchors, BASIC_LINEUPS, report_id="R")

    assert first == second


# --- the recorded self-validation checks (Task 4, SM-C1) --------------------------


KEY_STATISTICS = {
    "home": {"goals": 0, "distance_covered": 1.0},
    "away": {"goals": 0, "distance_covered": 1.0},
}


def check_by_id(checks):
    return {check["check"]: check for check in checks}


def test_all_four_checks_are_recorded_once_each_in_a_fixed_order():
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)

    checks = domain_g_checks(payload, key_statistics=KEY_STATISTICS, lineups=BASIC_LINEUPS)

    assert [check["check"] for check in checks] == [
        "domain-g-zone-sum",
        "domain-g-internal-consistency",
        "domain-g-distance-reconciliation",
        "domain-g-goals-reconciliation",
    ]
    assert all(check["result"] == "pass" for check in checks)


def test_the_cross_domain_checks_are_omitted_rather_than_faked_when_a_sibling_is_absent():
    """The aggregator is strictly binary: a "not-applicable" dict would read as a fail."""
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)

    without_stats = [check["check"] for check in domain_g_checks(payload)]
    without_lineups = [
        check["check"] for check in domain_g_checks(payload, key_statistics=KEY_STATISTICS)
    ]

    assert without_stats == ["domain-g-zone-sum", "domain-g-internal-consistency"]
    assert "domain-g-distance-reconciliation" in without_lineups
    assert "domain-g-goals-reconciliation" not in without_lineups


def test_zone_sum_fails_when_the_zones_do_not_reconstruct_the_total():
    physical = (1000.0, 500.0) + DEFAULT_PHYSICAL[2:]
    rows = one_each([row(1, "Ana ALPHA", physical=physical)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-zone-sum"]

    assert check["result"] == "fail"
    assert "Ana ALPHA" in check["specifics"]


def test_zone_sum_tolerates_the_derived_rounding_drift():
    """Six 1-decimal values drift at most 6 x 0.05 = 0.30 m from an exact sum."""
    physical = (1000.0, 700.2) + DEFAULT_PHYSICAL[2:]
    rows = one_each([row(1, "Ana ALPHA", physical=physical)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    assert check_by_id(domain_g_checks(payload))["domain-g-zone-sum"]["result"] == "pass"


@pytest.mark.parametrize(
    "field_index, value, expected",
    [
        (1, 40, "passes_completed"),        # completed > attempted (33)
        (5, 25, "crosses_completed"),       # completed > attempted (20)
        (7, 20, "line_breaks_completed"),   # completed > attempted (13)
    ],
)
def test_internal_consistency_fails_on_a_subset_count_that_exceeds_its_total(
    field_index, value, expected
):
    printed = list(DEFAULT_DISTRIBUTIONS_HEAD + (3, 0))
    printed[field_index] = value
    rows = one_each([row(1, "Ana ALPHA", distributions=tuple(printed))], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "fail"
    assert expected in check["specifics"]


def test_internal_consistency_fails_when_tackles_won_exceeds_tackles_made():
    printed = (2, 8) + DEFAULT_OUT_OF_POSSESSION[2:]
    rows = one_each([row(1, "Ana ALPHA", out_of_possession=printed)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "fail"
    assert "tackles_won" in check["specifics"]


def test_internal_consistency_requires_the_movement_types_to_sum_exactly():
    """Verified EXACT on all 3,289 corpus rows — no tolerance is admissible."""
    printed = (21, 7, 5, 4, 3, 2, 1, 9)  # sums to 22, not 21
    rows = one_each([row(1, "Ana ALPHA", offers=printed)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "fail"
    assert "movement types sum to 22" in check["specifics"]


def test_internal_consistency_fails_when_offers_received_exceeds_total_offers():
    printed = DEFAULT_OFFERS[:7] + (30,)
    rows = one_each([row(1, "Ana ALPHA", offers=printed)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "fail"
    assert "offers_received" in check["specifics"]


def test_internal_consistency_fails_on_a_printed_completion_that_does_not_compute():
    printed = (33, 29, 50) + DEFAULT_DISTRIBUTIONS_HEAD[3:] + (3, 0)
    rows = one_each([row(1, "Ana ALPHA", distributions=printed)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "fail"
    assert "pass_completion" in check["specifics"]


def test_a_zero_attempts_row_printing_zero_percent_is_a_pass_not_a_division():
    printed = (0, 0, 0, 7, 0, 0, 0, 0, 0, 6, 4, 5, 3, 0)
    rows = one_each([row(1, "Ana ALPHA", distributions=printed)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "pass"


def test_a_printed_completion_on_zero_attempts_is_impossible_and_fails():
    """The other half of the zero-attempts rule: skip the DIVISION, not the CHECK.

    100% of nothing is not a number the page can honestly print, so a non-zero
    completion beside zero attempts is a finding — recording nothing there would be the
    silent loosening SM-C1 forbids. All 53 zero-attempt corpus rows print 0%.
    """
    printed = (0, 0, 90, 7, 0, 0, 0, 0, 0, 6, 4, 5, 3, 0)
    rows = one_each([row(1, "Ana ALPHA", distributions=printed)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "fail"
    assert "pass_completion 90.0 on 0 passes_attempted" in check["specifics"]


def test_goals_may_exceed_attempts_at_goal_and_that_is_NOT_a_finding():
    """The obvious relation is corpus-FALSE, so it is deliberately not checked.

    Four reports carry a player with more goals than printed attempts, each goal
    independently confirmed by Domain A's own scorer ledger — the page's "Attempts at
    Goal" column is narrower than "shots including the one that scored". Pinned so the
    relation is not re-added as an invariant; see `deferred-work.md`.
    """
    printed = DEFAULT_DISTRIBUTIONS_HEAD + (0, 1)  # 1 goal, 0 attempts at goal
    rows = one_each([row(1, "Ana ALPHA", distributions=printed)], [row(2, "Bo BRAVO")])
    payload = extract(rows, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload))["domain-g-internal-consistency"]

    assert check["result"] == "pass"


def test_distance_reconciliation_fails_when_the_player_sum_misses_the_team_total():
    stats = {
        "home": {"goals": 0, "distance_covered": 5.0},  # players sum to 1.0 km
        "away": {"goals": 0, "distance_covered": 1.0},
    }
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload, key_statistics=stats))[
        "domain-g-distance-reconciliation"
    ]

    assert check["result"] == "fail"
    assert "home" in check["specifics"]


def test_distance_reconciliation_tolerates_the_derived_rounding_drift():
    stats = {
        "home": {"goals": 0, "distance_covered": 1.05},
        "away": {"goals": 0, "distance_covered": 1.0},
    }
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)

    check = check_by_id(domain_g_checks(payload, key_statistics=stats))[
        "domain-g-distance-reconciliation"
    ]

    assert check["result"] == "pass"


def test_goals_reconciliation_counts_the_opponents_own_goals():
    """Corpus-FALSE without the term: it failed on exactly 14 team-innings, each short
    by one — the corpus's 14 own goals, which Story 1.6's ledger carries."""
    block = lineups(
        [lineup_entry(1, "Ana ALPHA")], [lineup_entry(2, "Bo BRAVO", own_goals=1)]
    )
    # The home player scored nothing; the away player put one into their own net, so
    # the home team's printed score is 1.
    stats = {
        "home": {"goals": 1, "distance_covered": 1.0},
        "away": {"goals": 0, "distance_covered": 1.0},
    }
    payload = extract(BASIC_ROWS, block)

    check = check_by_id(domain_g_checks(payload, key_statistics=stats, lineups=block))[
        "domain-g-goals-reconciliation"
    ]

    assert check["result"] == "pass"
    # The naive form — player goals alone — would have failed this exact shape.
    naive = sum(player["in_possession"]["goals"] for player in payload["home"])
    assert naive != stats["home"]["goals"]


def test_goals_reconciliation_is_exact_and_fails_on_a_mismatch():
    stats = {
        "home": {"goals": 2, "distance_covered": 1.0},
        "away": {"goals": 0, "distance_covered": 1.0},
    }
    payload = extract(BASIC_ROWS, BASIC_LINEUPS)

    check = check_by_id(
        domain_g_checks(payload, key_statistics=stats, lineups=BASIC_LINEUPS)
    )["domain-g-goals-reconciliation"]

    assert check["result"] == "fail"
    assert "Key Statistics prints 2" in check["specifics"]


def test_check_specifics_are_deterministic_across_runs():
    """Byte-identical re-runs: one dict per check id, offenders in page order."""
    physical = (1000.0, 500.0) + DEFAULT_PHYSICAL[2:]
    rows = one_each(
        [row(1, "Ana ALPHA", physical=physical), row(4, "Cy CHARLIE", physical=physical)],
        [row(2, "Bo BRAVO")],
    )
    block = lineups(
        [lineup_entry(1, "Ana ALPHA"), lineup_entry(4, "Cy CHARLIE")],
        [lineup_entry(2, "Bo BRAVO")],
    )
    payload = extract(rows, block)

    first = domain_g_checks(payload, key_statistics=KEY_STATISTICS, lineups=block)
    second = domain_g_checks(payload, key_statistics=KEY_STATISTICS, lineups=block)

    assert first == second
    zone = check_by_id(first)["domain-g-zone-sum"]
    assert zone["specifics"].index("Ana ALPHA") < zone["specifics"].index("Cy CHARLIE")


# --- name assembly across fragmented spans (the §Known landmines item) -------------
#
# The real pages fragment a name per glyph run and rely entirely on `join_spans`' 1.0 pt
# space-gap rule to restore the implied space. A single-span synthetic name exercises
# none of that, so these drive the boundary directly: a mis-inserted or missing space
# breaks the join silently and surfaces as a `PlayerJoinError` on a name that LOOKS
# right, which is why the error message prints the assembled name with `repr()`.


def fragment(*runs, gap=0.0):
    """`(offset, text)` spans laying `runs` out left to right at real glyph widths.

    Consecutive runs abut exactly; `gap` adds that many points BEFORE each run that is
    marked with a leading `|`. Offsets are measured, never guessed, so the assertions
    sit on the gap rule rather than on this helper's arithmetic.
    """
    import pymupdf

    pieces = []
    x = 0.0
    for run in runs:
        if run.startswith("|"):
            run = run[1:]
            x += gap
        pieces.append((x, run))
        x += pymupdf.get_text_length(run, fontsize=DOMAIN_G_FONTSIZE)
    return pieces


def test_a_name_fragmented_per_glyph_run_assembles_with_its_implied_space():
    """`'Ra' 'u' 'l' <gap> 'R' 'A' 'N' 'GE' 'L'` must become `'Raul RANGEL'`.

    The gap between the two words carries no space character of its own on the real
    page — `join_spans` restores it from the geometry alone.
    """
    pieces = fragment("Ra", "u", "l", "|R", "A", "N", "GE", "L", gap=2.5)
    rows = one_each([row(1, None, name_spans=pieces)], [row(2, "Bo BRAVO")])
    block = lineups([lineup_entry(1, "Raul RANGEL")], [lineup_entry(2, "Bo BRAVO")])

    payload = extract(rows, block)

    assert [player["name"] for player in payload["home"]] == ["Raul RANGEL"]


def test_abutting_name_fragments_do_not_gain_a_space():
    """Hyphenated names arrive as abutting runs; a fabricated space would break the
    join on a name that reads correctly."""
    pieces = fragment("AIT", "-", "NOURI")
    rows = one_each([row(1, None, name_spans=pieces)], [row(2, "Bo BRAVO")])
    block = lineups([lineup_entry(1, "AIT-NOURI")], [lineup_entry(2, "Bo BRAVO")])

    payload = extract(rows, block)

    assert [player["name"] for player in payload["home"]] == ["AIT-NOURI"]


@pytest.mark.parametrize(
    "gap, expected",
    [
        (0.5, "AnaALPHA"),   # below SPACE_GAP_PT: no space restored
        (2.0, "Ana ALPHA"),  # above it: the implied space appears
    ],
)
def test_the_space_gap_boundary_decides_whether_a_name_gains_a_space(gap, expected):
    """`join_spans`' 1.0 pt threshold, pinned from both sides. This is the landmine:
    a name assembled on the wrong side of it looks right and joins wrong."""
    pieces = fragment("Ana", "|ALPHA", gap=gap)
    rows = one_each([row(1, None, name_spans=pieces)], [row(2, "Bo BRAVO")])
    block = lineups([lineup_entry(1, expected)], [lineup_entry(2, "Bo BRAVO")])

    payload = extract(rows, block)

    assert [player["name"] for player in payload["home"]] == [expected]


def test_a_name_fragment_gap_that_breaks_the_join_names_the_assembled_form():
    """The failure must print the assembled name so a whitespace defect is visible
    rather than reading as an identical-looking name."""
    pieces = fragment("Ana", "|ALPHA", gap=2.0)
    rows = one_each([row(1, None, name_spans=pieces)], [row(2, "Bo BRAVO")])
    block = lineups([lineup_entry(1, "AnaALPHA")], [lineup_entry(2, "Bo BRAVO")])

    with pytest.raises(PlayerJoinError) as excinfo:
        extract(rows, block)

    assert "'Ana ALPHA'" in str(excinfo.value)


# --- the unreachable `%` folding branch (no corpus instance; pinned anyway) ---------


def test_a_value_area_opening_with_a_bare_percent_sign_fails_loud():
    """`_value_tokens` folds a standalone `%` onto the number to its left; with no
    number to its left it survives as its own token and must fail naming itself."""
    rows = one_each(
        [row(1, "Ana ALPHA", distributions=("%",) + DEFAULT_DISTRIBUTIONS_HEAD[1:] + (3, 0))],
        [row(2, "Bo BRAVO")],
    )

    with pytest.raises(MalformedFieldError) as excinfo:
        extract(rows, BASIC_LINEUPS)

    assert "'%'" in str(excinfo.value)


# --- module-constant integrity (Task 5.2: authoring bugs fail the run, not 104 reports)


def test_the_offers_family_is_closed_in_both_directions():
    """A column added to `OFFERS_COLUMNS` alone would be parsed and then silently
    discarded, because the payload copies that family in by explicit name and
    `IN_POSSESSION_FIELDS` is the DISTRIBUTIONS list plus three literals — so its
    length guard would not notice. The integrity assert must catch it."""
    import pipeline.extract.domain_g as domain_g

    original = domain_g.OFFERS_COLUMNS
    try:
        domain_g.OFFERS_COLUMNS = original + (("offers_refused", "count"),)
        with pytest.raises(ValueError, match="offers family must be exactly"):
            domain_g._assert_column_integrity()
    finally:
        domain_g.OFFERS_COLUMNS = original
    domain_g._assert_column_integrity()


def test_the_four_families_must_agree_on_player_ORDER_not_merely_membership():
    """Assembly is positional, so the same players in a different order would merge one
    player's numbers onto another's row — the comparison is deliberately not a set."""
    home = [row(1, "Ana ALPHA"), row(4, "Cy CHARLIE")]
    block = lineups(
        [lineup_entry(1, "Ana ALPHA"), lineup_entry(4, "Cy CHARLIE")],
        [lineup_entry(2, "Bo BRAVO")],
    )
    doc = pymupdf.open()
    anchors: dict[str, list[int]] = {}
    for stem in FAMILY_STEMS:
        for side in ("home", "away"):
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            printed = home if side == "home" else [row(2, "Bo BRAVO")]
            # The physical family lists the same two players bottom-up.
            if stem == "physical-data" and side == "home":
                printed = list(reversed(printed))
            DOMAIN_G_DRAWERS[stem](page, printed)
            anchors[f"{stem}:{side}"] = [page.number]

    with doc:
        with pytest.raises(PlayerTableParseError) as excinfo:
            extract_domain_g(doc, anchors, block, report_id="PMSR-M01-AAA-V-BBB")

    assert "different player sequence" in str(excinfo.value)


# --- the orphan-row rule (row -> lineup entry WITHOUT minutes) ---------------------


ZERO_ROW_VALUES = {
    "distributions": (0,) * 14,
    "offers": (0,) * 8,
    "out_of_possession": (0,) * 15,
    "physical": (0.0,) * 6 + (0, 0, 0.0),
}


def test_an_all_zero_row_for_an_unused_substitute_is_admitted():
    """PMSR-M92-MEX-V-ENG away #14 Jordan HENDERSON: booked from the bench at 98', never
    played, and the report prints him an all-zero row anyway. The page is verbose, not
    contradictory, so the row parses and stages."""
    block = lineups(
        [lineup_entry(1, "Ana ALPHA", "gk")],
        [lineup_entry(2, "Bo BRAVO", "fw")],
        home_subs=[lineup_entry(14, "Booked ONBENCH", "mf")],
    )
    rows = one_each(
        [row(1, "Ana ALPHA"), row(14, "Booked ONBENCH", **ZERO_ROW_VALUES)],
        [row(2, "Bo BRAVO")],
    )

    payload = extract(rows, block)

    assert [player["name"] for player in payload["home"]] == ["Ana ALPHA", "Booked ONBENCH"]
    assert payload["home"][1]["physical"]["total_distance"] == 0.0


def test_a_non_zero_row_for_a_player_with_no_minutes_fails_loud():
    """The contradiction the zero-row exception must not swallow: real numbers for a
    player the lineup says never took the field means a missed sub-on stamp, and staging
    it would feed a phantom into the leaderboards and both reconciliations."""
    block = lineups(
        [lineup_entry(1, "Ana ALPHA", "gk")],
        [lineup_entry(2, "Bo BRAVO", "fw")],
        home_subs=[lineup_entry(14, "Actually PLAYED", "mf")],
    )
    rows = one_each(
        [row(1, "Ana ALPHA"), row(14, "Actually PLAYED")],
        [row(2, "Bo BRAVO")],
    )

    with pytest.raises(PlayerJoinError) as excinfo:
        extract(rows, block)

    assert "Actually PLAYED" in str(excinfo.value)
    assert "no minutes" in str(excinfo.value)


def test_a_single_non_zero_value_is_enough_to_fail_an_orphan_row():
    """The zero test walks every field of all three blocks, including the nested
    movement-type counts — one stray value anywhere is a contradiction."""
    nested_only = dict(ZERO_ROW_VALUES, offers=(1, 1, 0, 0, 0, 0, 0, 0))
    block = lineups(
        [lineup_entry(1, "Ana ALPHA", "gk")],
        [lineup_entry(2, "Bo BRAVO", "fw")],
        home_subs=[lineup_entry(14, "One VALUE", "mf")],
    )
    rows = one_each(
        [row(1, "Ana ALPHA"), row(14, "One VALUE", **nested_only)],
        [row(2, "Bo BRAVO")],
    )

    with pytest.raises(PlayerJoinError, match="One VALUE"):
        extract(rows, block)

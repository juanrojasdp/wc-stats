"""Task 3: matchday-round derivation into a closed set (AC 1, AC 5)."""

from __future__ import annotations

import datetime as dt

import pytest

from pipeline.discover.probe import ReportMeta
from pipeline.discover.rounds import (
    ROUNDS,
    assign_matchday_rounds,
    knockout_round_from_stage,
)


def meta(report_id, stage, group, day, home, away, venue="V1", kickoff="13:00"):
    return ReportMeta(
        report_id=report_id,
        source_path=f"{report_id}.pdf",
        home_team=home,
        away_team=away,
        home_score=0,
        away_score=0,
        stage_text=stage,
        group=group,
        match_date=dt.date(2026, 6, day),
        kickoff=kickoff,
        venue=venue,
    )


def round_robin(group, teams=("T1", "T2", "T3", "T4"), days=(11, 12, 17, 18, 24, 25), prefix=""):
    """The complete 6 fixtures of a 4-team group, in matchday order.

    Derivation only runs on a complete group (a partial one cannot tell matchday 1 from
    "the first match of this team I hold"), so every group fixture here must be whole.
    """
    a, b, c, d = teams
    pairs = [(a, b), (c, d), (a, c), (b, d), (a, d), (b, c)]
    return [
        meta(f"{prefix}{group.lower()}{i + 1}", f"Group {group} - Match {i + 1}", group, day, h, w)
        for i, ((h, w), day) in enumerate(zip(pairs, days))
    ]


def test_closed_round_set():
    assert ROUNDS == (
        "group-md1",
        "group-md2",
        "group-md3",
        "r32",
        "r16",
        "qf",
        "sf",
        "third-place",
        "final",
    )


@pytest.mark.parametrize(
    "stage,expected",
    [
        ("Round of 32 - Match 73", "r32"),
        ("ROUND OF 16", "r16"),
        ("Quarter Final - Match 101", "qf"),
        ("Quarter-Finals", "qf"),
        ("Semi Final", "sf"),
        ("Semi-Finals", "sf"),
        ("Third Place Play-Off", "third-place"),
        ("3rd Place Play-Off", "third-place"),
        # FIFA's actual wording in the 2026 corpus (match 103).
        ("Bronze final - Match 103", "third-place"),
        ("Bronze Final", "third-place"),
        ("Final - Match 104", "final"),
        ("Final", "final"),
        ("Group A - Match 1", None),
        ("Something Unheard Of", None),
    ],
)
def test_knockout_round_from_stage(stage, expected):
    assert knockout_round_from_stage(stage) == expected


def test_final_keyword_does_not_shadow_quarter_semi_and_bronze():
    """These all contain 'final' — keyword order is what protects them.

    'Bronze final' is the real 2026 wording for the third-place play-off; without it the
    third-place round silently disappears from the corpus and the match is counted as a
    second final.
    """
    assert knockout_round_from_stage("Quarter Final") == "qf"
    assert knockout_round_from_stage("Quarter-final") == "qf"
    assert knockout_round_from_stage("Semi Final") == "sf"
    assert knockout_round_from_stage("Semi-final") == "sf"
    assert knockout_round_from_stage("Third Place Final") == "third-place"
    assert knockout_round_from_stage("Bronze final") == "third-place"


def test_every_real_corpus_stage_wording_maps_to_a_round():
    """The 6 distinct knockout wordings observed across the real 104-report corpus."""
    observed = {
        "Round of 32 - Match 74": "r32",
        "Round of 16 - Match 89": "r16",
        "Quarter-final - Match 100": "qf",
        "Semi-final - Match 102": "sf",
        "Bronze final - Match 103": "third-place",
        "Final - Match 104": "final",
    }
    assert {s: knockout_round_from_stage(s) for s in observed} == observed


def test_group_matchdays_derived_from_date_order_within_group():
    """A 4-team group: 6 matches, each team plays once per matchday."""
    metas = [
        meta("m1", "Group A - Match 1", "A", 11, "MEX", "RSA"),
        meta("m2", "Group A - Match 2", "A", 12, "KOR", "JPN"),
        meta("m3", "Group A - Match 3", "A", 17, "MEX", "KOR"),
        meta("m4", "Group A - Match 4", "A", 18, "RSA", "JPN"),
        meta("m5", "Group A - Match 5", "A", 24, "JPN", "MEX"),
        meta("m6", "Group A - Match 6", "A", 24, "RSA", "KOR"),
    ]

    assigned, problems = assign_matchday_rounds(metas)

    assert problems == []
    assert {m.report_id: m.matchday_round for m in assigned} == {
        "m1": "group-md1",
        "m2": "group-md1",
        "m3": "group-md2",
        "m4": "group-md2",
        "m5": "group-md3",
        "m6": "group-md3",
    }


def test_matchdays_split_across_dates_still_pair_correctly():
    """MD1 and MD2 fixtures of one group need not share a calendar date."""
    metas = round_robin("B", days=(11, 12, 17, 18, 24, 25))

    assigned, problems = assign_matchday_rounds(metas)

    assert problems == []
    rounds = {m.report_id: m.matchday_round for m in assigned}
    # b1 (day 11) and b2 (day 12) are the two MD1 fixtures despite the different dates.
    assert rounds == {
        "b1": "group-md1",
        "b2": "group-md1",
        "b3": "group-md2",
        "b4": "group-md2",
        "b5": "group-md3",
        "b6": "group-md3",
    }


def test_groups_are_derived_independently():
    metas = round_robin("A") + round_robin("B")

    assigned, problems = assign_matchday_rounds(metas)

    assert problems == []
    rounds = {m.report_id: m.matchday_round for m in assigned}
    assert rounds["a1"] == rounds["b1"] == "group-md1"
    assert rounds["a5"] == rounds["b5"] == "group-md3"


def test_knockout_reports_bypass_group_derivation():
    """A knockout report needs no group context — its round is printed on the cover."""
    metas = [meta("k1", "Round of 16 - Match 89", None, 30, "T1", "T2")] + round_robin("A")

    assigned, problems = assign_matchday_rounds(metas)

    assert problems == []
    rounds = {m.report_id: m.matchday_round for m in assigned}
    assert rounds["k1"] == "r16"
    assert rounds["a1"] == "group-md1"


def test_incomplete_group_is_a_problem_not_a_confident_guess():
    """A partial group cannot distinguish md1 from 'the first match of this team I hold'."""
    metas = round_robin("A")[3:]  # only the MD2/MD3 fixtures survive

    assigned, problems = assign_matchday_rounds(metas)

    assert all(m.matchday_round is None for m in assigned)
    assert {report_id for report_id, _ in problems} == {"a4", "a5", "a6"}
    assert all("holds 3 of 6 matches" in reason for _, reason in problems)


def test_single_digit_kickoff_hour_does_not_sort_after_a_late_one():
    """'9:00' must not sort after '21:00' — the walk order decides every matchday."""
    metas = round_robin("A", days=(11, 11, 17, 17, 24, 24))
    metas = [
        m.__class__(**{**m.__dict__, "kickoff": "9:00"}) if m.report_id == "a1" else m
        for m in metas
    ]
    metas = [
        m.__class__(**{**m.__dict__, "kickoff": "21:00"}) if m.report_id == "a2" else m
        for m in metas
    ]

    assigned, problems = assign_matchday_rounds(metas)

    assert problems == []
    rounds = {m.report_id: m.matchday_round for m in assigned}
    # a1 kicks off first, so both opening fixtures are still MD1.
    assert rounds["a1"] == "group-md1"
    assert rounds["a2"] == "group-md1"


def test_unrecognized_stage_is_a_problem_not_a_crash():
    metas = [meta("weird", "Friendly Kickabout", None, 11, "T1", "T2")]

    assigned, problems = assign_matchday_rounds(metas)

    assert assigned[0].matchday_round is None
    assert problems and problems[0][0] == "weird"
    assert "Friendly Kickabout" in problems[0][1]


def test_more_than_three_group_matchdays_is_a_problem():
    """A team appearing in a 4th group fixture means the corpus or the rule is wrong.

    The group is deliberately complete (6 matches) so this exercises the matchday ceiling
    rather than the incomplete-group precondition.
    """
    metas = [
        meta("x1", "Group C - Match 1", "C", 11, "T1", "T2"),
        meta("x2", "Group C - Match 2", "C", 12, "T1", "T3"),
        meta("x3", "Group C - Match 3", "C", 13, "T1", "T4"),
        meta("x4", "Group C - Match 4", "C", 14, "T1", "T5"),
        meta("x5", "Group C - Match 5", "C", 15, "T2", "T3"),
        meta("x6", "Group C - Match 6", "C", 16, "T4", "T5"),
    ]

    assigned, problems = assign_matchday_rounds(metas)

    by_id = {m.report_id: m.matchday_round for m in assigned}
    assert by_id["x1"] == "group-md1"
    assert by_id["x4"] is None
    assert any(
        report_id == "x4" and "outside 1..3" in reason for report_id, reason in problems
    )


def test_assignment_is_deterministic():
    metas = [
        meta("m2", "Group A - Match 2", "A", 12, "KOR", "JPN"),
        meta("m1", "Group A - Match 1", "A", 11, "MEX", "RSA"),
    ]

    first, _ = assign_matchday_rounds(metas)
    second, _ = assign_matchday_rounds(list(reversed(metas)))

    assert {m.report_id: m.matchday_round for m in first} == {
        m.report_id: m.matchday_round for m in second
    }


def test_same_date_and_kickoff_ties_break_on_report_id():
    """Two same-day fixtures sharing a team: the earlier report id is walked first."""
    metas = [
        meta("zz", "Group D - Match 1", "D", 11, "T1", "T3"),
        meta("aa", "Group D - Match 2", "D", 11, "T1", "T2"),
        meta("c", "Group D - Match 3", "D", 17, "T3", "T4"),
        meta("d", "Group D - Match 4", "D", 18, "T2", "T4"),
        meta("e", "Group D - Match 5", "D", 24, "T1", "T4"),
        meta("f", "Group D - Match 6", "D", 24, "T2", "T3"),
    ]

    assigned, problems = assign_matchday_rounds(metas)

    assert problems == []
    by_id = {m.report_id: m.matchday_round for m in assigned}
    assert by_id["aa"] == "group-md1"
    assert by_id["zz"] == "group-md2"

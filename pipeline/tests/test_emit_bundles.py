"""Story 1.16 — Match Bundle emission.

No test read `data/matches/` before this module; every assertion here is new. The one
pre-existing reader is `check_committed_data`, which is Task 8's second pinning source
rather than a bundle test.

Two kinds of test live here and the split is deliberate. **Constructed** tests build a
synthetic spine and drive each gate RED — a budget gate proven only green on the corpus is
the gate-that-cannot-fail this project has already shipped twice. **Corpus** tests run over
the real staged spine, which is gitignored, so they skip locally and fail under `CI=1`
exactly as the ground-truth PDF fixtures do.
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import pytest

from pipeline.ingest.records import canonical_json
from pipeline.precompute import emit
from pipeline.precompute.budget import BUDGET_BYTES, gzip_bytes, over_budget
from pipeline.precompute.errors import EmitError, UnmappedFieldError
from pipeline.precompute.serialize import decimals_map
from pipeline.validate.schema import iter_violations, schema_version

BUNDLE = emit.BUNDLE_SCHEMA


# --------------------------------------------------------------------------- the corpus
@pytest.fixture(scope="module")
def spine_dir(repo_root: Path) -> Path:
    """`work/spine/`, staged by `pipeline.precompute.run`.

    Gitignored staging, so a fresh clone does not have it. Same rule as the ground-truth
    PDF: a skip locally, a failure under CI, because a skip is exactly how a missing input
    comes to read as a pass.
    """
    path = repo_root / "work" / "spine"
    if not (path / "entities.json").is_file() or not (path / "matches").is_dir():
        message = ("staged spine not available at work/spine — run "
                   "`python -m pipeline.precompute.run --expect-records 104` first")
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)
    return path


@pytest.fixture(scope="module")
def corpus(spine_dir: Path):
    entities, matches = emit.load_spine(spine_dir)
    return entities, matches


@pytest.fixture(scope="module")
def decimals():
    return decimals_map(BUNDLE)


@pytest.fixture(scope="module")
def bundles(corpus, decimals):
    """Every Match Bundle, built from the real staged corpus."""
    entities, matches = corpus
    return [emit.build_bundle(m, entities, decimals) for m in matches]


# ----------------------------------------------------------------- a synthetic spine
def _counts(**kw):
    base = {
        "possession": 50.0, "goals": 0, "expected_goals": 1.0, "shots": 1,
        "shots_on_target": 0, "passes": 100, "passes_completed": 90,
        "pass_completion": 90.0, "completed_line_breaks": 10,
        "defensive_line_breaks": 2, "receptions_in_final_third": 20, "crosses": 3,
        "ball_progressions": 5, "defensive_pressures": 30, "direct_pressures": 4,
        "forced_turnovers": 6, "second_balls": 7, "distance_covered": 100.0,
        "sprint_distance": 5.0,
    }
    base.update(kw)
    return base


def _player(pid, shirt, top_speed=30.0):
    return {
        "player_id": pid, "name": "A PLAYER", "position": "mf", "shirt_number": shirt,
        "in_possession": {
            "passes_attempted": 10, "passes_completed": 9, "pass_completion": 90.0,
            "switches_of_play": 0, "crosses_attempted": 0, "crosses_completed": 0,
            "line_breaks_attempted": 1, "line_breaks_completed": 1,
            "line_break_completion": 100.0, "ball_progressions": 0, "take_ons": 0,
            "step_ins": 0, "attempts_at_goal": 0, "goals": 0, "total_offers": 1,
            "offers_received": 1,
            "offers_by_movement_type": {"in_front": 1, "in_between": 0, "out_to_in": 0,
                                        "in_to_out": 0, "in_behind": 0, "no_movement": 0},
        },
        "out_of_possession": {
            "tackles_made": 0, "tackles_won": 0, "blocks": 0, "interceptions": 0,
            "pressing_direct": 0, "pressing_indirect": 0, "duels_won_aerial": 0,
            "duels_won_physical": 0, "possession_contests_won": 0, "clearances": 0,
            "loose_ball_receptions": 0, "pushing_on": 0, "pushing_on_into_pressing": 0,
            "possession_regains": 0, "possession_interrupted": 0,
        },
        "physical": {
            "total_distance": 9000.0, "distance_zone_1": 5000.0, "distance_zone_2": 2000.0,
            "distance_zone_3": 1000.0, "distance_zone_4": 800.0, "distance_zone_5": 200.0,
            "high_speed_runs": 10, "sprints": 3, "top_speed": top_speed,
        },
    }


def _entry(pid, shirt, goals=(), own_goals=(), cards=()):
    return {
        "player_id": pid, "name": "A PLAYER", "position": "mf", "shirt_number": shirt,
        "substituted_on": None, "substituted_off": None,
        "goals": [dict(g) for g in goals], "own_goals": [dict(o) for o in own_goals],
        "cards": [dict(c) for c in cards],
    }


def _set_plays():
    return {
        "total_set_plays": 4, "total_free_kicks": 2, "total_penalties": 0,
        "total_corners": 1, "total_throw_ins": 1,
        "free_kicks": {"direct": 1, "direct_on_target": 0, "direct_off_target": 0,
                       "indirect": 1},
        "corners_by_delivery_type": {
            "direct_to_area": {"left": 1, "right": 0, "total": 1},
            "short": {"left": 0, "right": 0, "total": 0},
            "edge_of_penalty_area": {"left": 0, "right": 0, "total": 0},
        },
        "corners_by_delivery_style": {"inswing": 1, "outswing": 0, "driven": 0,
                                      "lofted": 0},
    }


def _shot(ordinal, time_raw, team_id, pid, **kw):
    row = {
        "team_id": team_id, "player_id": pid, "player_name": "A PLAYER",
        "shirt_number": 7, "ordinal": ordinal, "time_raw": time_raw, "linked": True,
        "source": {"page_index": 1, "pdf_x": 1.0, "pdf_y": 1.0},
        "x": 90.0, "y": 40.0, "outcome": "off-target", "outcome_detail": "off-target",
        "body_part": "right-foot", "delivery_type": "pass", "expected_goals": None,
        "own_goal": False,
    }
    row.update(kw)
    return row


def make_spine(*, shots=None, momentum_max=90, score=None, shootout=None,
               home_goals=(), away_goals=(), home_own=(), away_own=(),
               home_players=None, away_players=None, set_plays_home=None):
    """A minimal spine match that every unblocked mapper accepts."""
    home_id, away_id = "alpha", "beta"
    samples = [{"minute": m, "stoppage_minute": None, "home": 1, "away": 1}
               for m in range(1, momentum_max + 1)]
    hp = home_players if home_players is not None else [_player("alpha-one-aaa", 1, 30.0),
                                                        _player("alpha-two-aaa", 2, 32.5)]
    ap = away_players if away_players is not None else [_player("beta-one-bbb", 1, 28.0)]
    return {
        "spine": {"match_id": "m001-alpha-beta", "home_team_id": home_id,
                  "away_team_id": away_id, "matchday_round": "group-md1",
                  "report_id": "PMSR-M01-ALP-V-BET"},
        "domains": {
            "match_metadata": {
                "date": "2026-06-11", "group": "a",
                "kickoff": "2026-06-11T13:00:00-06:00", "stage": "group",
                "venue": "A Stadium",
                "teams": {"home": "Alpha", "away": "Beta",
                          "home_team_id": home_id, "away_team_id": away_id},
                "score": score or {"home": len(home_goals) + len(away_own),
                                   "away": len(away_goals) + len(home_own),
                                   "shootout": shootout},
                "lineups": {
                    "home": {"formation": "4-4-2",
                             "starters": [_entry("alpha-one-aaa", 1, home_goals, home_own),
                                          _entry("alpha-two-aaa", 2)],
                             "substitutes": []},
                    "away": {"formation": "4-3-3",
                             "starters": [_entry("beta-one-bbb", 1, away_goals, away_own)],
                             "substitutes": []},
                },
            },
            "key_statistics": {"home": _counts(), "away": _counts(),
                               "contested_possession": 5.0},
            "momentum": {"samples": samples, "axis_top_label": "x", "extra_time": False,
                         "full_time_index": 90},
            "pass_network": {
                s: {"edges": [], "players": [], "node_positions": None,
                    "matrix_total": 0, "top_ranked_pairs": []}
                for s in ("home", "away")
            },
            "player_stats": {"home": hp, "away": ap},
            "set_plays": {"home": set_plays_home or _set_plays(), "away": _set_plays()},
            "shots": {"shot_events": shots if shots is not None else [],
                      "shootout_attempts": None, "counts": {}},
            "crosses": {"cross_events": [], "counts": {}, "cross_table_rows": []},
            "defensive_actions": {"defensive_action_events": [], "counts": {},
                                  "regain_table_rows": [], "warnings": []},
            "receiving": {"counts": {}, "movement": {}, "offers": {}},
            "goalkeeping": {s: _goalkeeping_side() for s in ("home", "away")},
            "tactical_identity": {s: _tactical_side() for s in ("home", "away")},
        },
    }


def _panel(line_height, team_length, team_width):
    return {"line_height": line_height, "team_length": team_length,
            "team_width": team_width}


def _tactical_side(high=7.0, mid=25.0, low=11.0):
    """`defensive_block` MIRRORS the three block phases — asserted by the emitter."""
    return {
        "defensive_block": {"high": high, "mid": mid, "low": low},
        "line_height_team_length": {
            "in_possession": {"build-up-low": _panel(19.0, 40.0, 56.0),
                              "build-up-mid": _panel(39.0, 33.0, 57.0),
                              "final-third-phase": _panel(54.0, 35.0, 47.0)},
            "out_of_possession": {"high-block-press": _panel(46.0, 38.0, 43.0),
                                  "mid-block": _panel(38.0, 30.0, 42.0),
                                  "low-block": _panel(19.0, 26.0, 35.0)},
        },
        "phases_in_possession": {
            "attacking_transition": 10.0, "build_up_opposed": 13.0,
            "build_up_unopposed": 47.0, "counter_attack": 1.0, "final_third": 11.0,
            "long_ball": 3.0, "progression": 16.0, "set_piece": 5.0,
        },
        "phases_out_of_possession": {
            "counter_press": 8.0, "defensive_transition": 12.0, "high_block": high,
            "high_press": 9.0, "low_block": low, "low_press": 0.0, "mid_block": mid,
            "mid_press": 3.0, "recovery": 5.0,
        },
    }


def _counts3(complete=1, incomplete=0, total=1):
    return {"complete": complete, "incomplete": incomplete, "total": total,
            "printed_total": total}


def _goalkeeping_side(keepers=None, slots=3, total=None):
    series = [1] * slots
    return {
        "total_involvements": sum(series) if total is None else total,
        "involvement_series": series,
        "involvement_clock": {
            "extra_time_slot": None, "second_extra_slot": None, "second_half_slot": 2,
            "stamps": [{"minute": i + 1, "stoppage_minute": None} for i in range(slots)],
        },
        "goalkeepers": keepers if keepers is not None else [
            {"name": "A KEEPER", "player_id": "alpha-one-aaa", "shirt_number": 1,
             "substituted_off": None, "substituted_on": None},
        ],
        "distribution": {
            "total": _counts3(), "feet": _counts3(), "hands": _counts3(),
            "throw": _counts3(), "line_breaks": 2,
            # Null on 208/208 corpus team-innings; nullable since CS-2.
            "feet_techniques": None, "hands_techniques": None, "throw_techniques": None,
        },
        "goal_prevention": {
            "attempts_faced": 3, "attempts_faced_printed": 3, "save_percentage": 100.0,
            "total_interventions": 3, "by_body_type": None,
            "by_intervention_type": {"deflect_and_retain": 0, "no_save_attempt": 1,
                                     "save_and_deflect": 0, "save_and_retain": 2,
                                     "save_attempt": 0},
        },
        "aerial_control": {
            "total_interventions": 1, "punches": _counts3(0, 0, 0), "claims": _counts3(),
            "tipped_palmed": _counts3(0, 0, 0), "crosses_faced_attempted": 8,
            "crosses_faced_completed": None,
            "delivery_types_faced": {"inswing": 1, "outswing": 5, "driven": 0,
                                     "lofted": 2, "cutback": 0, "push_cross": 0,
                                     "total": 8},
        },
    }


def make_entities():
    return {
        "matches": [{"match_id": "m001-alpha-beta", "match_number": 1}],
        "teams": [{"team_id": "alpha", "team_code": "alp"},
                  {"team_id": "beta", "team_code": "bet"}],
    }


@pytest.fixture
def synthetic(decimals):
    def _build(**kw):
        return emit.build_bundle_partial(make_spine(**kw), make_entities(), decimals)
    return _build


# ============================================================ the boundary (Task 3.3)
def test_check_total_catches_the_two_keys_no_underscore_check_can_see():
    """`linked` and `ordinal` are single-word snake keys — indistinguishable from correct
    camelCase to a "no key contains `_`" check, and two of the five `ShotEvent` must drop."""
    row = {"teamId": "alpha", "playerId": "p", "playerName": "n",
           "at": {"minute": 1, "stoppageMinute": None}, "x": 1.0, "y": 1.0,
           "outcome": "goal", "outcomeDetail": "on-target-goal", "bodyPart": "head",
           "deliveryType": "pass", "expectedGoals": None, "ownGoal": False,
           "linked": True, "ordinal": 3}
    assert all("_" not in k for k in row), "the cheap check would pass this object"
    with pytest.raises(UnmappedFieldError) as exc:
        emit.check_total(row, "ShotEvent", "ShotEvent")
    assert "linked" in str(exc.value) and "ordinal" in str(exc.value)


def test_check_total_catches_an_unfilled_required_target():
    with pytest.raises(UnmappedFieldError, match="unfilled required target"):
        emit.check_total({"minute": 3}, "MinuteStamp", "MinuteStamp")


def test_check_total_reads_both_contract_documents():
    """`MinuteStamp` is local to the bundle; `KnockoutScore` and `TeamScore` are shared."""
    assert emit._def_properties("MinuteStamp") == {"minute", "stoppageMinute"}
    assert emit._def_properties("TeamScore") == {"home", "away"}
    assert "decidedBy" in emit._def_properties("KnockoutScore")


# ============================================================ RULED D4 — the shot clock
def test_time_raw_is_one_less_than_the_football_minute():
    """Landmine 2: emitting `time_raw` at face value shifts all 2,571 shots by a minute,
    validates clean, and nothing downstream would notice."""
    assert emit.shot_minute_stamp(0, 0) == {"minute": 1, "stoppageMinute": None}
    assert emit.shot_minute_stamp(65, 1) == {"minute": 66, "stoppageMinute": None}


@pytest.mark.parametrize(
    "time_raw,period,expected",
    [
        # Every one of these reproduces a real goal stamp measured in Task 1.5.
        (45, 0, {"minute": 45, "stoppageMinute": 1}),    # m050
        (47, 0, {"minute": 45, "stoppageMinute": 3}),    # m029
        (50, 0, {"minute": 45, "stoppageMinute": 6}),    # m037
        (90, 1, {"minute": 90, "stoppageMinute": 1}),    # m075
        (101, 1, {"minute": 90, "stoppageMinute": 12}),  # m020
        (120, 3, {"minute": 120, "stoppageMinute": 1}),  # m100
        (130, 3, {"minute": 120, "stoppageMinute": 11}),  # m082, the ledger's figure
    ],
)
def test_the_boundary_decomposition_reproduces_the_measured_goal_stamps(
        time_raw, period, expected):
    assert emit.shot_minute_stamp(time_raw, period) == expected


def test_the_overflow_rows_stay_inside_the_contract_maximum():
    """14 rows across six matches carry `time_raw >= 120`. Under a naive +1 they become
    121..132, `Minute`'s maximum is 120, and those six bundles could not be emitted."""
    for time_raw in (120, 121, 124, 126, 130, 131):
        stamp = emit.shot_minute_stamp(time_raw, 3)
        assert stamp["minute"] == 120
        assert 1 <= stamp["stoppageMinute"] <= 30


def test_a_drop_in_the_printed_clock_forces_the_earlier_period():
    """m001's real Mexico sequence: 46 and 48 are first-half stoppage BECAUSE 45 follows."""
    rows = [{"time_raw": t} for t in (41, 46, 48, 45, 47, 51)]
    periods = emit.assign_shot_periods(rows, 2)
    assert periods == [0, 0, 0, 1, 1, 1]
    assert emit.shot_minute_stamp(46, periods[1]) == {"minute": 45, "stoppageMinute": 2}
    assert emit.shot_minute_stamp(48, periods[2]) == {"minute": 45, "stoppageMinute": 4}
    assert emit.shot_minute_stamp(45, periods[3]) == {"minute": 46, "stoppageMinute": None}


def test_with_no_drop_a_band_row_defaults_to_regular_play():
    """The ruling's own wording — `at.minute = time_raw + 1` in regular play. Measured:
    this is right 9 times and wrong 6 in the zone, and the residual is FILED, not closed
    by making the numbers agree."""
    periods = emit.assign_shot_periods([{"time_raw": t} for t in (10, 47, 60)], 2)
    assert periods == [0, 1, 1]
    assert emit.shot_minute_stamp(47, periods[1]) == {"minute": 48, "stoppageMinute": None}


def test_a_two_period_match_reads_everything_above_ninety_as_stoppage():
    """What makes 2,247 of 2,571 rows structurally unambiguous: with no extra time there
    is no competing reading above 90."""
    periods = emit.assign_shot_periods([{"time_raw": t} for t in (60, 95)], 2)
    assert emit.shot_minute_stamp(95, periods[1]) == {"minute": 90, "stoppageMinute": 6}


def test_periods_played_is_read_from_the_matchs_own_momentum_clock():
    assert emit.periods_played(make_spine(momentum_max=90)) == 2
    assert emit.periods_played(make_spine(momentum_max=120)) == 4


def test_a_match_with_no_momentum_samples_fails_loud():
    spine = make_spine()
    spine["domains"]["momentum"]["samples"] = []
    with pytest.raises(EmitError, match="period structure"):
        emit.periods_played(spine)


# ============================================================ RULED D3 — the penalty join
def test_a_penalty_goal_shot_marks_its_lineup_goal(synthetic):
    bundle = synthetic(
        home_goals=[{"minute": 30, "stoppage_minute": None}],
        shots=[_shot(1, 29, "alpha", "alpha-one-aaa", outcome="goal",
                     outcome_detail="on-target-goal", delivery_type="penalty")],
    )
    goal = bundle["metadata"]["goals"][0]
    assert goal["penalty"] is True and goal["ownGoal"] is False


def test_a_non_penalty_goal_is_not_marked(synthetic):
    bundle = synthetic(
        home_goals=[{"minute": 30, "stoppage_minute": None}],
        shots=[_shot(1, 29, "alpha", "alpha-one-aaa", outcome="goal",
                     outcome_detail="on-target-goal", delivery_type="pass")],
    )
    assert bundle["metadata"]["goals"][0]["penalty"] is False


def test_a_penalty_goal_shot_that_joins_nothing_fails_loud(synthetic):
    """The condition D3 ships under: fail loud on ANY unmatched penalty-goal shot."""
    with pytest.raises(EmitError, match="joins no lineup goal"):
        synthetic(shots=[_shot(1, 29, "alpha", "alpha-one-aaa", outcome="goal",
                               outcome_detail="on-target-goal", delivery_type="penalty")])


def test_a_multi_goal_scorer_is_tiebroken_on_the_exact_elapsed_count(synthetic):
    """5 of the 16 corpus penalty scorers scored twice. m010 Havertz: the penalty is the
    `45+5` goal (elapsed 50 == time_raw 49 + 1), not the 88th-minute one."""
    bundle = synthetic(
        home_goals=[{"minute": 45, "stoppage_minute": 5},
                    {"minute": 88, "stoppage_minute": None}],
        shots=[_shot(1, 49, "alpha", "alpha-one-aaa", outcome="goal",
                     outcome_detail="on-target-goal", delivery_type="penalty")],
    )
    by_elapsed = {g["at"]["minute"] + (g["at"]["stoppageMinute"] or 0): g["penalty"]
                  for g in bundle["metadata"]["goals"]}
    assert by_elapsed == {50: True, 88: False}


# ============================================================ Domain A
def test_an_own_goal_is_credited_to_the_benefiting_team(synthetic):
    """AD-6's one live trap: `scorerPlayerId` names the scorer, `teamId` names the team
    that BENEFITED, so the id inverts relative to the entry it was read from."""
    bundle = synthetic(home_own=[{"minute": 10, "stoppage_minute": None}])
    goal = bundle["metadata"]["goals"][0]
    assert goal["scorerPlayerId"] == "alpha-one-aaa"
    assert goal["teamId"] == "beta", "an own goal by a home player scores for away"
    assert goal["ownGoal"] is True and goal["penalty"] is False


def test_own_goals_are_dropped_from_the_lineup_entry_not_renamed(synthetic):
    """`LineupEntry` has no own-goals slot. Renaming to `ownGoals` passes an underscore
    check and fails jsonschema with an `additionalProperties` error pointing elsewhere."""
    bundle = synthetic(home_own=[{"minute": 10, "stoppage_minute": None}])
    entry = bundle["metadata"]["lineups"]["home"]["starters"][0]
    assert "ownGoals" not in entry and "own_goals" not in entry
    assert set(entry) == emit._def_properties("LineupEntry")


def test_goals_are_chronological(synthetic):
    bundle = synthetic(
        home_goals=[{"minute": 80, "stoppage_minute": None},
                    {"minute": 45, "stoppage_minute": 2}],
        away_goals=[{"minute": 45, "stoppage_minute": None}],
    )
    order = [(g["at"]["minute"], g["at"]["stoppageMinute"] or 0)
             for g in bundle["metadata"]["goals"]]
    assert order == sorted(order)


def test_team_code_comes_from_the_registry_never_from_the_slug(synthetic):
    bundle = synthetic()
    assert bundle["metadata"]["homeTeam"] == {"teamId": "alpha", "teamCode": "alp",
                                              "name": "Alpha"}


def test_a_team_with_no_committed_code_fails_loud(decimals):
    entities = make_entities()
    entities["teams"] = [t for t in entities["teams"] if t["team_id"] != "beta"]
    with pytest.raises(EmitError, match="no committed teamCode"):
        emit.build_bundle_partial(make_spine(), entities, decimals)


# ============================================================ Task 6 — knockoutScore
def test_a_drawn_group_match_still_carries_knockout_score(synthetic):
    """Required on ALL 104 matches. Reading Task 6 as knockout-only ships 72 bundles
    missing a required key."""
    ks = synthetic()["metadata"]["knockoutScore"]
    assert ks["decidedBy"] == "regulation"
    assert ks["scoreAfterET"] is None and ks["shootoutScore"] is None
    assert ks["winnerTeamId"] is None


def test_a_won_group_match_names_its_winner(synthetic):
    ks = synthetic(home_goals=[{"minute": 10, "stoppage_minute": None}])["metadata"]["knockoutScore"]
    assert ks["winnerTeamId"] == "alpha" and ks["decidedBy"] == "regulation"


def test_the_shootout_score_is_home_away_not_winner_first(synthetic):
    """Landmine 10, verified on 4/4: m074 prints `3-4` with Paraguay (AWAY) winning, and
    the committed fixture pins `{"home": 3, "away": 4}`."""
    bundle = synthetic(momentum_max=120, score={"home": 1, "away": 1,
                                                "shootout": "(Beta win 3-4 on Penalties)"},
                       home_goals=[{"minute": 10, "stoppage_minute": None}],
                       away_goals=[{"minute": 20, "stoppage_minute": None}])
    ks = bundle["metadata"]["knockoutScore"]
    assert ks["shootoutScore"] == {"home": 3, "away": 4}
    assert ks["winnerTeamId"] == "beta" and ks["decidedBy"] == "shootout"
    assert ks["scoreAfterET"] == {"home": 1, "away": 1}


def test_a_shootout_string_whose_winner_holds_the_smaller_total_fails_loud(synthetic):
    """The assertion that PROVES the home-away reading rather than assuming it."""
    with pytest.raises(EmitError, match="smaller total"):
        synthetic(momentum_max=120,
                  score={"home": 1, "away": 1, "shootout": "(Alpha win 3-4 on Penalties)"},
                  home_goals=[{"minute": 10, "stoppage_minute": None}],
                  away_goals=[{"minute": 20, "stoppage_minute": None}])


@pytest.mark.parametrize("prose", [
    "Beta win 3-4 on Penalties",          # unparenthesised
    "(Beta beat Alpha 3-4 on Penalties)",  # no ' win '
    "(Beta win 3 to 4 on Penalties)",     # not '<a>-<b>'
    "(Beta win 3-4)",                     # no trailing marker
])
def test_shootout_prose_that_will_not_decompose_fails_loud(synthetic, prose):
    with pytest.raises(EmitError):
        synthetic(momentum_max=120, score={"home": 1, "away": 1, "shootout": prose},
                  home_goals=[{"minute": 10, "stoppage_minute": None}],
                  away_goals=[{"minute": 20, "stoppage_minute": None}])


def test_score_after_90_is_derived_from_the_goal_clock_not_copied(synthetic):
    """The cover prints ONE final score, after extra time when ET was played. Copying it
    into `scoreAfter90` states the wrong number wherever the tie was not level at 90."""
    bundle = synthetic(momentum_max=120,
                       home_goals=[{"minute": 10, "stoppage_minute": None},
                                   {"minute": 110, "stoppage_minute": None}])
    ks = bundle["metadata"]["knockoutScore"]
    assert ks["scoreAfter90"] == {"home": 1, "away": 0}, "the 110th-minute goal is not in it"
    assert ks["scoreAfterET"] == {"home": 2, "away": 0}
    assert ks["decidedBy"] == "extra-time"


def test_a_cover_score_disagreeing_with_the_goal_records_fails_loud(synthetic):
    with pytest.raises(EmitError, match="printed sources disagree"):
        synthetic(score={"home": 5, "away": 0, "shootout": None},
                  home_goals=[{"minute": 10, "stoppage_minute": None}])


# ============================================================ Task 4.5a — cornersBySide
def test_corners_by_side_is_derived_and_cross_checked(synthetic):
    """`cornersBySide` is required, the block is closed, and the spine has NO side block —
    without this derivation every bundle fails validation for both teams on all 104."""
    assert synthetic()["setPlays"]["home"]["cornersBySide"] == {"left": 1, "right": 0,
                                                                "total": 1}


def test_a_corner_side_mismatch_fails_loud(synthetic):
    broken = _set_plays()
    broken["corners_by_delivery_type"]["direct_to_area"]["right"] = 9
    with pytest.raises(EmitError, match="left\\+right"):
        synthetic(set_plays_home=broken)


def test_the_two_corpus_false_relations_are_not_asserted(synthetic):
    """`direct == on+off` holds on 0/208 and `sum(style) == totalCorners` on 96/208.
    Asserting either makes a CORRECT bundle look broken."""
    sp = _set_plays()
    sp["free_kicks"] = {"direct": 11, "direct_on_target": 0, "direct_off_target": 0,
                        "indirect": 1}
    sp["total_free_kicks"] = 12
    sp["total_set_plays"] = 12 + 1 + 1 + 0
    sp["corners_by_delivery_style"] = {"inswing": 0, "outswing": 0, "driven": 0,
                                       "lofted": 0}
    bundle = synthetic(set_plays_home=sp)
    assert bundle["setPlays"]["home"]["freeKicks"]["direct"] == 11
    assert sum(bundle["setPlays"]["home"]["cornersByDeliveryStyle"].values()) == 0


# ============================================================ Domain G / storyStats
def test_top_speed_is_the_per_team_maximum(synthetic):
    """The one derived `storyStats` field, and the one the shipped fixture invariant does
    NOT cover."""
    bundle = synthetic()
    assert bundle["storyStats"]["home"]["topSpeed"] == 32.5
    assert bundle["storyStats"]["away"]["topSpeed"] == 28.0


def test_story_stats_project_the_other_four_from_key_statistics(synthetic):
    bundle = synthetic()
    for side in ("home", "away"):
        story, keys = bundle["storyStats"][side], bundle["keyStatistics"][side]
        for field in ("possession", "shots", "expectedGoals", "distanceCovered"):
            assert story[field] == keys[field]


def test_a_duplicate_player_id_fails_loud(synthetic):
    """No `uniqueItems` on `players` and none on `PlayerId`. A duplicate ships duplicate
    React keys and makes DataTable's focus restore resolve to the wrong row — routed here
    by name by Story 2.11b's review."""
    with pytest.raises(EmitError, match="duplicate playerId"):
        synthetic(home_players=[_player("alpha-one-aaa", 1), _player("alpha-one-aaa", 2)])


def test_players_are_ordered_home_then_away_then_by_shirt(synthetic):
    bundle = synthetic(home_players=[_player("alpha-two-aaa", 9), _player("alpha-one-aaa", 3)])
    assert [p["teamId"] for p in bundle["players"]] == ["alpha", "alpha", "beta"]
    assert [p["shirtNumber"] for p in bundle["players"]] == [3, 9, 1]


def test_team_id_comes_from_the_side_key_not_the_row(synthetic):
    for player in synthetic()["players"]:
        assert player["teamId"] in ("alpha", "beta")


# ============================================================ Domain D — declared nulls
def test_the_four_blocked_tables_and_shootout_attempts_are_null_never_empty(synthetic):
    """Landmine 1. `[]` is schema-legal and means something DIFFERENT, jsonschema will not
    tell you which you wrote, and on `passNetworkNodes` the wrong one takes every Tactical
    section down inside `TacticalErrorBoundary`."""
    events = synthetic()["events"]
    for table in ("crosses", "defensiveActions", "receiving", "passNetworkNodes",
                  "shootoutAttempts"):
        assert events[table] is None, f"{table} must be null, never []"


def test_the_event_table_key_set_is_exactly_the_contract_s(synthetic):
    assert set(synthetic()["events"]) == emit._def_properties("EventTables")


def test_momentum_is_a_series_or_null_and_never_empty(synthetic):
    bundle = synthetic()
    assert len(bundle["momentum"]["samples"]) >= 1
    assert set(bundle["momentum"]) == {"samples"}, "axis_top_label/extra_time/full_time_index drop"


# ============================================================ Task 2.4 / 10.4 — the budget
def test_the_budget_gate_can_actually_fail():
    """A gate proven only green is the gate-that-cannot-fail this project has shipped
    twice. Driven RED by construction, not observed green on a corpus."""
    incompressible = json.dumps([f"{i:016x}{i*7919:016x}" for i in range(200_000)])
    assert gzip_bytes(incompressible) > BUDGET_BYTES
    breach = over_budget("constructed", incompressible)
    assert breach is not None
    label, compressed, raw = breach
    assert label == "constructed" and compressed > BUDGET_BYTES and raw > compressed


def test_a_bundle_under_budget_reports_no_breach(synthetic):
    assert over_budget("m001", canonical_json(synthetic())) is None


def test_the_budget_unit_is_gzip_not_raw_bytes():
    """`test_fixtures.py` measures raw bytes; AD-4 and NFR-1 measure gzip -9. The two
    coexist and must not be "aligned"."""
    text = "a" * 1_000_000
    assert len(text.encode("utf-8")) > BUDGET_BYTES
    assert gzip_bytes(text) < BUDGET_BYTES


def test_gzip_bytes_is_reproducible():
    """`gzip.compress` writes an mtime into the header by default."""
    assert gzip_bytes("payload") == gzip_bytes("payload")


# ============================================================ Task 10.5 — precision
def _numeric_leaves(node, path="", out=None):
    out = [] if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            _numeric_leaves(v, f"{path}/{k}", out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _numeric_leaves(v, f"{path}/{i}", out)
    elif isinstance(node, float) and not isinstance(node, bool):
        out.append((path, node))
    return out


def _places(value: float) -> int:
    text = repr(float(value))
    if "e" in text or "E" in text:
        return 99
    return len(text.split(".")[1].rstrip("0")) if "." in text else 0


def test_no_emitted_float_carries_more_places_than_its_x_decimals(synthetic, decimals):
    by_key = emit.precision_by_key(decimals)
    for path, value in _numeric_leaves(synthetic()):
        key = path.rsplit("/", 1)[-1]
        allowed = by_key.get(key)
        if allowed is None:
            for part in reversed(path.split("/")):
                if part in by_key:
                    allowed = by_key[part]
                    break
        assert allowed is not None, f"{path} has no declared precision"
        assert _places(value) <= allowed, f"{path} = {value!r} exceeds {allowed} places"


def test_the_precision_layer_can_actually_fail(decimals):
    """Driven RED with a constructed 17-digit float. Nothing else in the stack sees this:
    no `multipleOf` exists anywhere and a 17-digit float validates clean."""
    dirty = {"storyStats": {"home": {"possession": 0.1 + 0.2, "topSpeed": 1 / 3}}}
    assert _places(dirty["storyStats"]["home"]["possession"]) > 1
    rounded = emit.round_bundle(dirty, decimals)
    assert rounded["storyStats"]["home"]["possession"] == 0.3
    assert _places(rounded["storyStats"]["home"]["topSpeed"]) <= 1


def test_zero_place_fields_emit_as_json_integers(synthetic):
    """`Count`, `Minute`, `ShirtNumber` are `type: integer`; a rounded 3.0 fails that."""
    bundle = synthetic()
    for field in ("shots",):
        assert isinstance(bundle["storyStats"]["home"][field], int)
    assert isinstance(bundle["metadata"]["matchNumber"], int)


def test_booleans_survive_rounding(synthetic):
    """`bool` is an `int` subclass; rounding one turns `ownGoal: false` into `0`."""
    bundle = synthetic(home_own=[{"minute": 10, "stoppage_minute": None}])
    goal = bundle["metadata"]["goals"][0]
    assert goal["ownGoal"] is True and goal["penalty"] is False


# ============================================================ Task 7.5 / 10.3 — bytes
def test_re_runs_are_byte_identical(synthetic):
    """Bytes, not parsed dicts — canonical serialization is the property under test. A
    bundle has no field to blank, so this is a straight equality."""
    first = canonical_json(synthetic()).encode("utf-8")
    second = canonical_json(synthetic()).encode("utf-8")
    assert first == second


def test_the_canonical_text_is_lf_utf8_and_newline_terminated(synthetic):
    text = canonical_json(synthetic())
    assert "\r\n" not in text and text.endswith("\n")
    text.encode("utf-8").decode("utf-8")


def test_no_bundle_carries_a_timestamp_a_path_or_a_code_version(synthetic):
    """Three sources of non-determinism already exist in this repo; none may reach a
    bundle."""
    text = canonical_json(synthetic())
    for forbidden in ("run_timestamp", "code_version", "generated_by", "source_path",
                      "source_manifest", "C:\\\\", "/Users/"):
        assert forbidden not in text, f"{forbidden!r} reached a bundle"


def test_the_bundle_stamps_the_version_it_reads_from_the_contract(synthetic):
    """Landmine 4: a literal here would be a seventh declaration of a six-declaration
    constant."""
    assert synthetic()["schemaVersion"] == schema_version()


# ============================================================ Task 10.6 — mutation checks
def test_swapping_home_and_away_changes_the_bundle(synthetic, decimals):
    """A test asserting `emit(x) == emit(x)` proves only that the function is the
    function. Each mutation below must turn something red."""
    spine = make_spine()
    baseline = emit.build_bundle_partial(spine, make_entities(), decimals)
    swapped = copy.deepcopy(spine)
    swapped["spine"]["home_team_id"], swapped["spine"]["away_team_id"] = "beta", "alpha"
    swapped["domains"]["match_metadata"]["teams"].update(
        {"home": "Beta", "away": "Alpha", "home_team_id": "beta", "away_team_id": "alpha"})
    mutated = emit.build_bundle_partial(swapped, make_entities(), decimals)
    assert mutated["metadata"]["homeTeam"]["teamId"] != baseline["metadata"]["homeTeam"]["teamId"]
    assert mutated["players"][0]["teamId"] != baseline["players"][0]["teamId"]


def test_dropping_the_plus_one_on_the_shot_clock_changes_the_bundle(synthetic):
    """Landmine 2 as a mutation check."""
    assert emit.shot_minute_stamp(29, 0)["minute"] == 30
    assert emit.shot_minute_stamp(29, 0)["minute"] != 29


def test_emitting_empty_instead_of_null_changes_the_bundle(synthetic):
    bundle = synthetic()
    assert bundle["events"]["crosses"] is None
    assert canonical_json(bundle) != canonical_json({**bundle, "events": {
        **bundle["events"], "crosses": []}})


# ============================================================ Task 10.6a — the CLI
def _stage(tmp_path: Path, matches, entities) -> Path:
    spine = tmp_path / "spine"
    (spine / "matches").mkdir(parents=True)
    (spine / "entities.json").write_text(json.dumps(entities), encoding="utf-8")
    for i, m in enumerate(matches):
        (spine / "matches" / f"{i:03d}.json").write_text(json.dumps(m), encoding="utf-8")
    return spine


def test_main_emits_cleanly_now_that_cs2_has_landed(tmp_path, capsys):
    """This test used to assert the CS-2 BLOCK — exit 1 naming both unbuildable mappers.

    CS-2 landed, so the same input now emits. Kept rather than deleted because it is the
    one place the block's removal is asserted rather than assumed.
    """
    spine = _stage(tmp_path, [make_spine()], make_entities())
    code = emit.main(["--spine-dir", str(spine), "--data-dir", str(tmp_path / "data")])
    assert code == 0, capsys.readouterr().err
    written = sorted((tmp_path / "data" / "matches").glob("*.json"))
    assert [p.name for p in written] == ["m001-alpha-beta.json"]
    bundle = json.loads(written[0].read_text(encoding="utf-8"))
    assert bundle["tacticalIdentity"]["home"]["shapeByPhase"]["inPossession"]["buildUpLow"]
    assert len(bundle["goalkeeping"]) == 2, "one entry per TEAM, home first"


def test_main_returns_two_when_the_spine_cannot_be_read(tmp_path, capsys):
    code = emit.main(["--spine-dir", str(tmp_path / "absent"),
                      "--data-dir", str(tmp_path / "data")])
    assert code == 2
    assert "could not run" in capsys.readouterr().err


def test_main_prints_the_version_it_read(tmp_path, capsys):
    spine = _stage(tmp_path, [make_spine()], make_entities())
    emit.main(["--spine-dir", str(spine), "--data-dir", str(tmp_path / "data")])
    assert f"schemaVersion   : {schema_version()}" in capsys.readouterr().out


def test_a_failed_run_writes_nothing_at_all(tmp_path):
    """All 104 or none. A half-emitted `data/matches/` is worse than an empty one, because
    `check_committed_data` would then pin a partial namespace as the immutability
    baseline."""
    broken = make_spine()
    # A corpus-impossible mirror: defensiveBlockDistribution must equal the three block
    # phases, and the emitter refuses to write anything at all when it does not.
    broken["domains"]["tactical_identity"]["home"]["defensive_block"]["mid"] = 99.0
    spine = _stage(tmp_path, [make_spine(), broken], make_entities())
    data = tmp_path / "data"
    assert emit.main(["--spine-dir", str(spine), "--data-dir", str(data)]) == 1
    assert not data.exists(), "the GOOD bundle must not be written either"


# ================================================ Task 7 — the write path, end to end
#
# `build_bundle` raises while CS-2 is outstanding, so `emit_bundles`' validate/measure/write
# path is otherwise unreachable. These tests substitute a COMMITTED FIXTURE — a real,
# schema-valid Match Bundle at the current `schemaVersion` — as the builder's output, which
# exercises the writer, the stale-file sweep, the budget gate and the two failure paths
# without pretending the blocked mappers exist.

FIXTURE_BUNDLES = sorted(
    (Path(__file__).resolve().parents[2] / "data" / "fixtures" / "matches").glob("*.json")
)


@pytest.fixture
def valid_builder(monkeypatch):
    """Point `emit_bundles` at a real committed bundle instead of the blocked builder."""
    if not FIXTURE_BUNDLES:
        pytest.skip("no committed match fixtures to stand in for a built bundle")
    template = json.loads(FIXTURE_BUNDLES[0].read_text(encoding="utf-8"))

    def _install(mutate=None):
        def fake(match_spine, entities, decimals):
            bundle = copy.deepcopy(template)
            bundle["matchId"] = match_spine["spine"]["match_id"]
            if mutate is not None:
                mutate(bundle)
            return bundle
        monkeypatch.setattr(emit, "build_bundle", fake)
    return _install


def test_emit_bundles_writes_one_canonical_file_per_match(tmp_path, valid_builder):
    valid_builder()
    spine = _stage(tmp_path, [make_spine()], make_entities())
    written = emit.emit_bundles(spine, tmp_path / "data")
    assert [p.name for p in written] == ["m001-alpha-beta.json"]
    raw = written[0].read_bytes()
    assert b"\r\n" not in raw and raw.endswith(b"\n")
    assert json.loads(raw.decode("utf-8"))["matchId"] == "m001-alpha-beta"


def test_written_bundles_are_byte_identical_across_two_runs(tmp_path, valid_builder):
    """Bytes, not parsed dicts. `newline=""` in `write_canonical` is what keeps Windows
    from turning every re-run diff into the whole file."""
    valid_builder()
    spine = _stage(tmp_path, [make_spine()], make_entities())
    first = emit.emit_bundles(spine, tmp_path / "a")[0].read_bytes()
    second = emit.emit_bundles(spine, tmp_path / "b")[0].read_bytes()
    assert first == second


def test_a_dry_run_validates_and_measures_but_writes_nothing(tmp_path, valid_builder):
    valid_builder()
    spine = _stage(tmp_path, [make_spine()], make_entities())
    assert emit.emit_bundles(spine, tmp_path / "data", dry_run=True) == []
    assert not (tmp_path / "data").exists()


def test_a_stale_bundle_this_run_did_not_produce_is_deleted(tmp_path, valid_builder):
    """A match id that ever changed would leave an orphan that `check_committed_data` then
    PINS as the immutability baseline."""
    valid_builder()
    out = tmp_path / "data" / "matches"
    out.mkdir(parents=True)
    orphan = out / "m999-gone-away.json"
    orphan.write_text("{}", encoding="utf-8")
    spine = _stage(tmp_path, [make_spine()], make_entities())
    emit.emit_bundles(spine, tmp_path / "data")
    assert not orphan.exists()
    assert (out / "m001-alpha-beta.json").is_file()


def test_a_schema_invalid_bundle_stops_the_run_before_any_write(tmp_path, valid_builder):
    from pipeline.precompute.errors import BundleValidationError

    valid_builder(mutate=lambda b: b.pop("keyStatistics"))
    spine = _stage(tmp_path, [make_spine()], make_entities())
    with pytest.raises(BundleValidationError, match="keyStatistics"):
        emit.emit_bundles(spine, tmp_path / "data")
    assert not (tmp_path / "data").exists(), "a failing run must write nothing at all"


def test_a_budget_breach_stops_the_run_and_names_both_byte_counts(tmp_path, valid_builder):
    """SM-C2: a breach is a design conversation, never a serializer tweak."""
    from pipeline.precompute.errors import BudgetExceededError

    def bloat(bundle):
        # High-entropy and DETERMINISTIC: a hash chain, not a counter. Sequential hex
        # compresses roughly 30:1, so a naive filler stays comfortably under budget and the
        # test passes for the wrong reason.
        import hashlib

        digest = hashlib.sha256(b"1.16").hexdigest()
        chunks = []
        for _ in range(40_000):
            digest = hashlib.sha256(digest.encode()).hexdigest()
            chunks.append(digest)
        bundle["metadata"]["venue"] = "".join(chunks)

    valid_builder(mutate=bloat)
    spine = _stage(tmp_path, [make_spine()], make_entities())
    with pytest.raises(BudgetExceededError) as exc:
        emit.emit_bundles(spine, tmp_path / "data")
    message = str(exc.value)
    assert "m001-alpha-beta" in message and str(BUDGET_BYTES) in message
    assert "NEVER by dropping fields" in message
    assert not (tmp_path / "data").exists()


def test_main_reports_expect_matches_misses_as_a_finding(tmp_path, valid_builder, capsys):
    valid_builder()
    spine = _stage(tmp_path, [make_spine()], make_entities())
    code = emit.main(["--spine-dir", str(spine), "--data-dir", str(tmp_path / "data"),
                      "--expect-matches", "104"])
    assert code == 1
    assert "expected 104" in capsys.readouterr().err


def test_main_returns_zero_on_a_clean_run(tmp_path, valid_builder, capsys):
    valid_builder()
    spine = _stage(tmp_path, [make_spine()], make_entities())
    code = emit.main(["--spine-dir", str(spine), "--data-dir", str(tmp_path / "data"),
                      "--expect-matches", "1"])
    assert code == 0
    assert "EMIT RESULT: PASS" in capsys.readouterr().out


def test_main_treats_a_writer_oserror_as_a_broken_harness(tmp_path, valid_builder,
                                                          monkeypatch, capsys):
    valid_builder()
    spine = _stage(tmp_path, [make_spine()], make_entities())

    def boom(*_args, **_kwargs):
        raise OSError("disk is gone")

    monkeypatch.setattr(emit, "write_canonical", boom)
    code = emit.main(["--spine-dir", str(spine), "--data-dir", str(tmp_path / "data")])
    assert code == 2
    assert "could not run" in capsys.readouterr().err


def test_an_empty_spine_is_a_finding_never_a_vacuous_pass(tmp_path, valid_builder, capsys):
    valid_builder()
    spine = _stage(tmp_path, [], make_entities())
    code = emit.main(["--spine-dir", str(spine), "--data-dir", str(tmp_path / "data")])
    assert code == 1
    assert "never a pass" in capsys.readouterr().err


# ============================================================ the real corpus
def test_every_corpus_bundle_is_schema_valid(bundles):
    """AC 1/2, over the whole corpus: 104 bundles, zero violations.

    This assertion INVERTED when change-set CS-2 landed. Before it, the two blocked mappers
    made `tacticalIdentity` and `goalkeeping` missing on every bundle, and the test pinned
    exactly those two violations and nothing else so the block could not silently widen.
    CS-2 reshaped both, so the honest assertion is now the strict one.
    """
    for bundle in bundles:
        violations = iter_violations(bundle, BUNDLE)
        assert violations == [], f'{bundle["matchId"]}: {violations}'
    assert len(bundles) == 104


def test_the_corpus_emits_one_bundle_per_match(bundles):
    assert len(bundles) == 104
    assert len({b["matchId"] for b in bundles}) == 104


def test_no_corpus_bundle_carries_a_snake_case_key(bundles):
    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                assert "_" not in k, f"snake_case key {k!r} reached a bundle"
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    for bundle in bundles:
        walk(bundle)


def test_no_corpus_bundle_carries_a_non_finite_number(bundles):
    import math

    def walk(node, path):
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}/{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}/{i}")
        elif isinstance(node, float):
            assert math.isfinite(node), f"{path} = {node!r}"
    for bundle in bundles:
        walk(bundle, bundle["matchId"])


def test_the_four_blocked_tables_are_null_on_every_corpus_bundle(bundles):
    for bundle in bundles:
        for table in ("crosses", "defensiveActions", "receiving", "passNetworkNodes",
                      "shootoutAttempts"):
            assert bundle["events"][table] is None, f'{bundle["matchId"]}.{table}'


def test_momentum_is_non_null_on_every_corpus_bundle(bundles):
    for bundle in bundles:
        assert bundle["momentum"] is not None
        assert len(bundle["momentum"]["samples"]) >= 1


def test_the_corpus_shot_clock_never_overruns_the_contract_maximum(bundles):
    for bundle in bundles:
        for shot in bundle["events"]["shots"]:
            assert 0 <= shot["at"]["minute"] <= 120, bundle["matchId"]
            stoppage = shot["at"]["stoppageMinute"]
            assert stoppage is None or 1 <= stoppage <= 30, bundle["matchId"]


def test_the_corpus_carries_the_measured_goal_and_card_totals(bundles):
    goals = [g for b in bundles for g in b["metadata"]["goals"]]
    assert len(goals) == 308
    assert sum(1 for g in goals if g["ownGoal"]) == 14
    assert sum(1 for g in goals if g["penalty"]) == 16
    cards = [c for b in bundles
             for side in ("home", "away")
             for group in ("starters", "substitutes")
             for e in b["metadata"]["lineups"][side][group]
             for c in e["cards"]]
    assert len(cards) == 283
    assert sum(1 for c in cards if c["type"] == "yellow") == 270
    assert sum(1 for c in cards if c["type"] == "red") == 13
    assert not any(c["type"] == "second-yellow" for c in cards), (
        "the corpus exposes two card fill RGBs; a second yellow is indistinguishable from "
        "a straight red and must NOT be inferred"
    )


def test_the_corpus_carries_the_measured_cardinalities(bundles):
    assert sum(len(b["events"]["shots"]) for b in bundles) == 2571
    assert sum(len(b["events"]["passNetworkEdges"]) for b in bundles) == 23597
    assert sum(len(b["players"]) for b in bundles) == 3289


def test_pass_network_edges_are_never_deduplicated(bundles):
    """A reciprocal pair is two edges; 6,835 corpus pairs print different volumes in the
    two directions."""
    differing = 0
    for bundle in bundles:
        seen = {(e["teamId"], e["fromPlayerId"], e["toPlayerId"]): e["volume"]
                for e in bundle["events"]["passNetworkEdges"]}
        for (team, a, b), volume in seen.items():
            back = seen.get((team, b, a))
            if back is not None and back != volume and a < b:
                differing += 1
    assert differing == 6835


def test_every_corpus_bundle_is_under_the_payload_budget(bundles):
    """Green by arithmetic, and recorded as such — `test_the_budget_gate_can_actually_fail`
    is what proves the gate works."""
    worst = max((gzip_bytes(canonical_json(b)), b["matchId"]) for b in bundles)
    assert worst[0] <= BUDGET_BYTES
    assert worst[0] < BUDGET_BYTES * 0.1, f"corpus maximum {worst} is unexpectedly large"


def test_the_corpus_shootout_ties_decompose_to_the_measured_scores(bundles):
    got = {b["matchId"]: b["metadata"]["knockoutScore"]["shootoutScore"]
           for b in bundles if b["metadata"]["knockoutScore"]["shootoutScore"] is not None}
    assert got == {
        "m074-germany-paraguay": {"home": 3, "away": 4},
        "m075-netherlands-morocco": {"home": 2, "away": 3},
        "m088-australia-egypt": {"home": 2, "away": 4},
        "m096-switzerland-colombia": {"home": 4, "away": 3},
    }


def test_decided_by_agrees_with_the_knockout_score_shape(bundles):
    """The invariant the schema documents but cannot encode (decision 12)."""
    counts = {"regulation": 0, "extra-time": 0, "shootout": 0}
    for bundle in bundles:
        ks = bundle["metadata"]["knockoutScore"]
        counts[ks["decidedBy"]] += 1
        if ks["decidedBy"] == "regulation":
            assert ks["scoreAfterET"] is None and ks["shootoutScore"] is None
        elif ks["decidedBy"] == "extra-time":
            assert ks["scoreAfterET"] is not None and ks["shootoutScore"] is None
        else:
            assert ks["scoreAfterET"] is not None and ks["shootoutScore"] is not None
    assert counts["shootout"] == 4
    assert counts["extra-time"] == 5
    assert counts["regulation"] == 95


def test_every_corpus_bundle_carries_a_knockout_score_including_group_ties(bundles):
    assert all(b["metadata"]["knockoutScore"] is not None for b in bundles)
    group = [b for b in bundles if b["metadata"]["stage"] == "group"]
    assert len(group) == 72
    assert all(b["metadata"]["knockoutScore"]["decidedBy"] == "regulation" for b in group)


def test_no_corpus_bundle_repeats_a_player_id(bundles):
    for bundle in bundles:
        ids = [p["playerId"] for p in bundle["players"]]
        assert len(ids) == len(set(ids)), bundle["matchId"]
        lineup = [e["playerId"] for side in ("home", "away")
                  for group in ("starters", "substitutes")
                  for e in bundle["metadata"]["lineups"][side][group]]
        assert len(lineup) == len(set(lineup)), bundle["matchId"]


def test_corpus_story_stats_agree_with_the_key_statistics_they_summarize(bundles):
    for bundle in bundles:
        for side in ("home", "away"):
            story, keys = bundle["storyStats"][side], bundle["keyStatistics"][side]
            for field in ("possession", "shots", "expectedGoals", "distanceCovered"):
                assert story[field] == keys[field], f'{bundle["matchId"]}/{side}/{field}'
            team_id = bundle["metadata"][f"{side}Team"]["teamId"]
            speeds = [p["physical"]["topSpeed"] for p in bundle["players"]
                      if p["teamId"] == team_id]
            assert story["topSpeed"] == max(speeds), f'{bundle["matchId"]}/{side}'


def test_corpus_bundles_are_byte_identical_across_two_builds(corpus, decimals):
    entities, matches = corpus
    for match in matches[:12]:
        first = canonical_json(emit.build_bundle_partial(match, entities, decimals))
        second = canonical_json(emit.build_bundle_partial(match, entities, decimals))
        assert first.encode("utf-8") == second.encode("utf-8"), match["spine"]["match_id"]


def test_the_committed_id_check_is_total_for_a_match_bundle(bundles):
    """Task 8.3, verified rather than assumed.

    `check_committed_data` reads only the seven keys in `COMMITTED_ID_KEYS`, and an id
    under any other key is INVISIBLE to it. Those seven happen to cover every id-bearing
    key a Match Bundle carries — so the second pinning source is total for this artifact.
    That stops being true the moment a successor change-set adds an id-bearing field, which
    is exactly why it is pinned here instead of noted.
    """
    from pipeline.precompute.identity import COMMITTED_ID_KEYS

    carried: set[str] = set()

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key.lower().endswith("id") and isinstance(value, (str, type(None))):
                    carried.add(key)
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    for bundle in bundles:
        walk(bundle)
    assert carried == set(COMMITTED_ID_KEYS), (
        f"a Match Bundle carries id key(s) {sorted(carried - set(COMMITTED_ID_KEYS))!r} "
        f"that the committed-data check cannot see"
    )


def test_every_corpus_numeric_leaf_respects_its_declared_precision(bundles, decimals):
    by_key = emit.precision_by_key(decimals)
    for bundle in bundles:
        for path, value in _numeric_leaves(bundle):
            key = path.rsplit("/", 1)[-1]
            allowed = by_key.get(key)
            if allowed is None:
                for part in reversed(path.split("/")):
                    if part in by_key:
                        allowed = by_key[part]
                        break
            assert allowed is not None, f'{bundle["matchId"]}{path}'
            assert _places(value) <= allowed, f'{bundle["matchId"]}{path} = {value!r}'

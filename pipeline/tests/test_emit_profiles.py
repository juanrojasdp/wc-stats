"""Story 1.18 — team and player profile artifacts.

**The anti-tautology rule is the whole difficulty in this module, so it is stated first.**
AC 4 quotes it: *"Derive expected values from the parsed corpus, never restate the
implementation. A test asserting `emit(x) == emit(x)` proves only that the function is the
function."* Story 1.16 took a review finding for exactly this — *"Both precision tests
derive their expectation from the emitter's own key map, so neither can see the defect."*

Operationally that means three things here:

1. The lineups-with-minutes -> Domain G join is **re-implemented in this module**
   (`_has_minutes`, `_match_length`, `independent_join`) rather than imported from
   `profiles`. If the emitter's join is wrong, these expectations do not move with it.
2. The eighteen player metrics get **eighteen NAMED tests**, each stating its own reduction
   in its own body. A single parametrized sweep over a shared `REDUCTIONS` table that the
   emitter also reads is the same defect wearing a different hat.
3. `_PLAYER_METRICS`, `_TREND_CODES` and `_PROFILE_KEY_TO_DEF` are **never imported**. The
   precision tests resolve each instance path through the schema's own `$ref`s.

Two kinds of test live here. **Corpus** tests read `data/matches/` and `data/index/`, both
of which are COMMITTED (AD-13) — unlike Story 1.16's staged spine, so there is no skip path
and no `CI=1` branch. **Constructed** tests build synthetic inputs and drive each gate RED;
a budget gate proven only green on a corpus where the largest artifact is 0.31% of the
ceiling is the gate-that-cannot-fail this project has already shipped twice.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from pipeline.ingest.records import canonical_json
from pipeline.precompute import profiles
from pipeline.precompute.budget import BUDGET_BYTES, gzip_bytes, over_budget
from pipeline.precompute.errors import ProfileError, UnmappedFieldError
from pipeline.precompute.serialize import decimals_map
from pipeline.precompute.slug_registry import PINS, TEAM_CODES
from pipeline.validate.schema import (
    iter_violations,
    load_schemas,
    schema_version,
    walk_subschemas,
)

TEAM_SCHEMA = profiles.TEAM_SCHEMA
PLAYER_SCHEMA = profiles.PLAYER_SCHEMA


# ============================================================== the corpus, read independently
@pytest.fixture(scope="module")
def bundles(repo_root: Path) -> "list[dict]":
    """Every committed Match Bundle, read here rather than through `profiles.load_bundles`.

    `data/matches/` is committed (AD-13), so this never skips. A missing corpus is a real
    failure, not an absent input.
    """
    paths = sorted((repo_root / "data" / "matches").glob("*.json"))
    assert paths, "data/matches/ is committed; an empty corpus is a failure, not a skip"
    return [json.loads(p.read_text(encoding="utf-8")) for p in paths]


@pytest.fixture(scope="module")
def built(repo_root: Path) -> "tuple[dict, dict]":
    """Every profile, BUILT BY THE EMITTER in memory — not read from `data/index/`.

    **This distinction is what makes the mutation check meaningful, and getting it wrong the
    first time cost five silent mutations.** When these fixtures read the committed
    artifacts, every semantic assertion below proves that the COMMITTED FILES are correct and
    says nothing about the emitter: flipping `topSpeed` from max to sum, `passCompletion`
    from weighted to unweighted, `perNinety` to the metric's own precision, `points` to
    all-rows, and the home/away side ALL left the suite green, because none of them changes
    a byte already on disk. Only `test_the_committed_artifacts_equal_what_the_emitter_
    produces_today` linked the two, and one test carrying the whole coupling is exactly the
    single point of failure AC 4's anti-tautology rule warns about.

    So the semantic tests run against a fresh build and the on-disk namespace is checked
    separately by the `committed_*` fixtures. Both properties are then asserted, and a
    mutation turns the NAMED test for the metric it breaks red rather than one distant
    byte-comparison.
    """
    bundles = profiles.load_bundles(repo_root / "data")
    teams, players = profiles.index_bundles(bundles)
    combined = {**decimals_map(TEAM_SCHEMA), **decimals_map(PLAYER_SCHEMA)}
    by_key = profiles.precision_by_key(combined)
    metric_places = profiles._metric_places(combined)
    ninety = profiles.per_ninety_places(decimals_map(PLAYER_SCHEMA))
    entities = {"teamCodes": dict(TEAM_CODES)}

    def finish(artifact, label):
        return profiles._round_profile(artifact, by_key, metric_places, ninety, label)

    return (
        {t: finish(profiles.build_team_profile(t, teams[t], entities), t)
         for t in sorted(teams)},
        {p: finish(profiles.build_player_profile(p, players[p], entities), p)
         for p in sorted(players)},
    )


@pytest.fixture(scope="module")
def team_profiles(built) -> "dict[str, dict]":
    return built[0]


@pytest.fixture(scope="module")
def player_profiles(built) -> "dict[str, dict]":
    return built[1]


@pytest.fixture(scope="module")
def committed_team_profiles(repo_root: Path) -> "dict[str, dict]":
    root = repo_root / "data" / "index" / "team-profiles"
    assert root.is_dir(), "data/index/team-profiles/ is committed"
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in root.glob("*.json")}


@pytest.fixture(scope="module")
def committed_player_profiles(repo_root: Path) -> "dict[str, dict]":
    root = repo_root / "data" / "index" / "player-profiles"
    assert root.is_dir(), "data/index/player-profiles/ is committed"
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in root.glob("*.json")}


def _match_length(bundle: "dict") -> int:
    """Re-derived here, not imported. 120 when the tie went past 90, else 90."""
    return 120 if (bundle["metadata"].get("knockoutScore") or {}).get("decidedBy") in (
        "extra-time", "shootout") else 90


def _has_minutes(entry: "dict", section: str) -> bool:
    """Re-derived here, not imported. `pipeline.extract.domain_g.has_minutes`'s rule:
    a starter always took the field; a substitute did exactly when the lineup page stamped
    a sub-on minute."""
    return section == "starters" or entry.get("substitutedOn") is not None


@pytest.fixture(scope="module")
def independent_join(bundles: "list[dict]") -> "dict[str, list[dict]]":
    """`player_id -> [that player's Domain G record, per match WITH MINUTES, chronological]`.

    Built by iterating lineups-with-minutes and joining Domain G by `playerId` — the
    direction premise 6 measured as total. Written here so the eighteen expectations below
    do not move when the emitter's join moves.
    """
    joined: "dict[str, list[dict]]" = {}
    for bundle in bundles:
        # **`players: null` is a legal bundle and contributes ZERO rows**, exactly as
        # `build_player_profile` treats it. The re-implementation used to read
        # `records[entry["playerId"]]` unguarded after an `or []`, so a null-`players`
        # bundle in `data/matches/` would `KeyError` here while the emitter handled it
        # correctly — the independent check diverging from the code on the one branch this
        # story added a fixture for. It has no corpus today; that is why it must be written
        # to survive one.
        if bundle["players"] is None:
            continue
        records = {r["playerId"]: r for r in bundle["players"]}
        for side in ("home", "away"):
            lineup = bundle["metadata"]["lineups"][side]
            for section in ("starters", "substitutes"):
                for entry in lineup[section]:
                    if not _has_minutes(entry, section):
                        continue
                    joined.setdefault(entry["playerId"], []).append(
                        records[entry["playerId"]])
    return joined


@pytest.fixture(scope="module")
def independent_team_rows(bundles: "list[dict]") -> "dict[str, list[tuple[dict, str]]]":
    rows: "dict[str, list[tuple[dict, str]]]" = {}
    for bundle in bundles:
        for side in ("home", "away"):
            rows.setdefault(bundle["metadata"][f"{side}Team"]["teamId"], []).append(
                (bundle, side))
    return rows


def _aggregate(profile: "dict", code: str) -> "dict":
    matched = [a for a in profile["aggregates"] if a["metricCode"] == code]
    assert len(matched) == 1, f"{profile['playerId']}: {len(matched)} rows for {code!r}"
    return matched[0]


def _assert_summed(player_profiles, independent_join, code, block, field, places=0):
    """Shared arithmetic for the fifteen count-typed sums.

    Deliberately NOT a parametrized sweep: each of the eighteen tests below names its own
    metric, its own source path and its own reduction in its own body, and merely delegates
    the loop. What AC 4 forbids is a table the emitter also reads — not a shared assertion
    helper whose arguments are written out per metric.
    """
    for player_id, profile in player_profiles.items():
        records = independent_join.get(player_id, [])
        expected = sum(r[block][field] for r in records)
        actual = _aggregate(profile, code)
        assert actual["aggregation"] == "sum", f"{player_id}: {code} is not declared a sum"
        assert round(actual["value"], places) == round(expected, places), (
            f"{player_id}: {code} is {actual['value']}, the corpus sum of "
            f"players[].{block}.{field} is {expected}"
        )


# =============================================== Task 9.2 — eighteen NAMED player expectations
def test_the_goals_aggregate_is_the_corpus_sum_of_in_possession_goals(
        player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "goals", "inPossession", "goals")


def test_the_passes_completed_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "passesCompleted",
                   "inPossession", "passesCompleted")


def test_the_ball_progressions_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "ballProgressions",
                   "inPossession", "ballProgressions")


def test_the_line_breaks_completed_aggregate_is_the_corpus_sum(
        player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "lineBreaksCompleted",
                   "inPossession", "lineBreaksCompleted")


def test_the_crosses_completed_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "crossesCompleted",
                   "inPossession", "crossesCompleted")


def test_the_switches_of_play_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "switchesOfPlay",
                   "inPossession", "switchesOfPlay")


def test_the_take_ons_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "takeOns", "inPossession", "takeOns")


def test_the_step_ins_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "stepIns", "inPossession", "stepIns")


def test_the_tackles_won_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "tacklesWon",
                   "outOfPossession", "tacklesWon")


def test_the_interceptions_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "interceptions",
                   "outOfPossession", "interceptions")


def test_the_aerial_duels_won_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "duelsWonAerial",
                   "outOfPossession", "duelsWonAerial")


def test_the_physical_duels_won_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "duelsWonPhysical",
                   "outOfPossession", "duelsWonPhysical")


def test_the_possession_regains_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "possessionRegains",
                   "outOfPossession", "possessionRegains")


def test_the_high_speed_runs_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "highSpeedRuns",
                   "physical", "highSpeedRuns")


def test_the_sprints_aggregate_is_the_corpus_sum(player_profiles, independent_join):
    _assert_summed(player_profiles, independent_join, "sprints", "physical", "sprints")


def test_the_total_distance_aggregate_is_the_corpus_sum_at_one_decimal(
        player_profiles, independent_join):
    """`totalDistance` is `Metres`, so it sums like a count but rounds to 1 place."""
    _assert_summed(player_profiles, independent_join, "totalDistance",
                   "physical", "totalDistance", places=1)


def test_the_top_speed_aggregate_is_the_corpus_MAXIMUM_and_never_a_sum(
        player_profiles, independent_join):
    """The mutation `max -> sum` must turn this red. `topSpeed` is "the maximum, never a
    mean" — and never a total either: a player with five matches would otherwise ship a
    speed of ~160 km/h that validates clean against `KmPerHour`'s `minimum: 0`."""
    for player_id, profile in player_profiles.items():
        records = independent_join.get(player_id, [])
        speeds = [r["physical"]["topSpeed"] for r in records]
        actual = _aggregate(profile, "topSpeed")
        assert actual["aggregation"] == "max"
        assert actual["value"] == pytest.approx(max(speeds, default=0.0), abs=0.05), (
            f"{player_id}: topSpeed {actual['value']} is not max({speeds})"
        )
        if len(speeds) > 1 and len(set(speeds)) > 1:
            assert actual["value"] < sum(speeds), (
                f"{player_id}: topSpeed equals the SUM of its per-match values"
            )


def test_the_pass_completion_aggregate_is_WEIGHTED_and_not_the_mean_of_the_percentages(
        player_profiles, independent_join):
    """The one weighted average, and the one that will be got wrong.

    A player's per-match `passCompletion` IS `passesCompleted / passesAttempted`, so the
    tournament figure reproducible from the bundles is the ratio of the SUMS — not the mean
    of the per-match percentages, which weights a 12-pass cameo equally with a 90-pass
    shift. The `aggregation` label cannot express the difference (`AggregationSemantics` is
    `sum | max | average` and carries no denominator), which is exactly why this asserts the
    ARITHMETIC rather than the label.

    Also pins the zero-denominator ruling: 17 players have minutes and attempt 0 passes
    across every appearance, and `AggregateMetricValue` is not nullable, so the value is
    `0.0` with `perNinety: null`.
    """
    weighted_differs_somewhere = False
    zero_denominator_players = []
    for player_id, profile in player_profiles.items():
        records = independent_join.get(player_id, [])
        completed = sum(r["inPossession"]["passesCompleted"] for r in records)
        attempted = sum(r["inPossession"]["passesAttempted"] for r in records)
        actual = _aggregate(profile, "passCompletion")
        assert actual["aggregation"] == "average"
        assert actual["perNinety"] is None, "a percentage has no meaningful per-90 rate"
        if attempted == 0:
            assert actual["value"] == 0.0, (
                f"{player_id}: no pass attempted all tournament, so the weighted average "
                f"divides by zero; ruled to 0.0 because the slot is not nullable"
            )
            if records:
                zero_denominator_players.append(player_id)
            continue
        expected = round(completed / attempted * 100, 1)
        assert actual["value"] == pytest.approx(expected, abs=0.05), (
            f"{player_id}: passCompletion {actual['value']} != weighted "
            f"{completed}/{attempted} = {expected}"
        )
        unweighted = round(
            sum(r["inPossession"]["passCompletion"] for r in records) / len(records), 1)
        if abs(unweighted - expected) > 0.05:
            weighted_differs_somewhere = True
    assert weighted_differs_somewhere, (
        "no player's weighted pass completion differs from the unweighted mean, so this "
        "test cannot tell the two apart and the mutation weighted->unweighted would not "
        "turn it red"
    )
    assert len(zero_denominator_players) == 17, (
        f"expected the 17 measured players who have minutes and attempt no passes, found "
        f"{len(zero_denominator_players)}"
    )


# =========================================================== per-90, the other easy mistake
def test_per_ninety_is_two_decimal_places_for_every_metric_including_the_counts(
        player_profiles):
    """The mutation "round `perNinety` at the metric's own precision" must turn this red.

    Applying `Count`'s 0 places would round `goals` per-90 to `0` and destroy the field.
    `PerNinety`'s own `x-decimals` is 2 and it is NOT keyed to the source field.
    """
    seen_fractional_count_metric = False
    for player_id, profile in player_profiles.items():
        for row in profile["aggregates"]:
            rate = row["perNinety"]
            if rate is None:
                continue
            assert round(rate, 2) == rate, (
                f"{player_id}/{row['metricCode']}: perNinety {rate!r} carries more than "
                f"two decimal places"
            )
            if row["metricCode"] in ("goals", "sprints") and rate != int(rate):
                seen_fractional_count_metric = True
    assert seen_fractional_count_metric, (
        "no count-typed metric has a fractional per-90 anywhere in the corpus, so this "
        "test cannot see the 0-places mutation"
    )


def test_per_ninety_is_the_value_normalized_to_ninety_minutes(
        player_profiles, independent_join):
    for player_id, profile in player_profiles.items():
        minutes = profile["appearances"]["minutesPlayed"]
        for row in profile["aggregates"]:
            if row["perNinety"] is None:
                continue
            assert minutes > 0, f"{player_id}: a per-90 with zero minutes played"
            assert row["perNinety"] == pytest.approx(
                row["value"] / minutes * 90, abs=0.006), (
                f"{player_id}/{row['metricCode']}: perNinety {row['perNinety']} != "
                f"{row['value']} / {minutes} * 90"
            )


def test_per_ninety_is_null_for_the_maximum_and_the_percentage_and_for_zero_minutes(
        player_profiles):
    """Two independent reasons for a null, both live: the schema's ("null when the metric is
    a maximum or a percentage") and division by zero on the 209 who never played."""
    never_appeared = appeared_but_scoreless_on_the_clock = 0
    for player_id, profile in player_profiles.items():
        rows = {r["metricCode"]: r for r in profile["aggregates"]}
        assert rows["topSpeed"]["perNinety"] is None
        assert rows["passCompletion"]["perNinety"] is None
        if profile["appearances"]["minutesPlayed"] == 0:
            assert all(r["perNinety"] is None for r in profile["aggregates"]), (
                f"{player_id}: played no minutes, so every per-90 divides by zero"
            )
            if profile["appearances"]["played"] == 0:
                never_appeared += 1
            else:
                appeared_but_scoreless_on_the_clock += 1
    # The arithmetic is spelled out because the second population was NOT anticipated by the
    # story and is a consequence of Task 3.3's ignore-stoppageMinute ruling — see
    # `test_a_substitute_sent_on_at_the_closing_minute_plays_zero_clock_minutes`.
    assert never_appeared == 209, (
        f"expected the 209 measured zero-appearance players, found {never_appeared}"
    )
    assert appeared_but_scoreless_on_the_clock == 20
    assert never_appeared + appeared_but_scoreless_on_the_clock == 229


# ============================================================ Task 9.2 — the physical block
def test_the_physical_block_sums_eight_fields_and_maxes_only_top_speed(
        player_profiles, independent_join):
    for player_id, profile in player_profiles.items():
        records = independent_join.get(player_id, [])
        physical = profile["physical"]
        for field in ("totalDistance", "distanceZone1", "distanceZone2", "distanceZone3",
                      "distanceZone4", "distanceZone5", "highSpeedRuns", "sprints"):
            expected = sum(r["physical"][field] for r in records)
            assert physical[field] == pytest.approx(expected, abs=0.05), (
                f"{player_id}: physical.{field} {physical[field]} != corpus sum {expected}"
            )
        assert physical["topSpeed"] == pytest.approx(
            max((r["physical"]["topSpeed"] for r in records), default=0.0), abs=0.05)


def test_high_speed_runs_and_sprints_stay_integers(player_profiles):
    """Story 1.10 parses them as float, asserts integral and narrows to `int` on all 3,289
    rows. `Count` is `type: integer`, so a `3.0` fails the contract."""
    for player_id, profile in player_profiles.items():
        for field in ("highSpeedRuns", "sprints"):
            value = profile["physical"][field]
            assert isinstance(value, int) and not isinstance(value, bool), (
                f"{player_id}: physical.{field} is {value!r} ({type(value).__name__})"
            )


# ============================================================ Task 9.2 — appearances identities
def test_the_appearance_identities_hold_by_construction(player_profiles):
    for player_id, profile in player_profiles.items():
        rows, appearances = profile["matches"], profile["appearances"]
        assert appearances["played"] == len(rows)
        assert appearances["started"] == sum(1 for r in rows if r["started"])
        assert (appearances["played"]
                == appearances["started"] + appearances["substituteAppearances"])
        assert appearances["minutesPlayed"] == sum(r["minutesPlayed"] for r in rows)


def test_every_match_row_reports_minutes_inside_its_own_match_length(
        player_profiles, bundles):
    lengths = {b["matchId"]: _match_length(b) for b in bundles}
    for player_id, profile in player_profiles.items():
        for row in profile["matches"]:
            length = lengths[row["matchId"]]
            assert 0 <= row["minutesPlayed"] <= length, (
                f"{player_id}/{row['matchId']}: {row['minutesPlayed']} minutes in a "
                f"{length}-minute match"
            )


def test_matches_is_one_row_per_match_WITH_MINUTES_not_one_per_domain_g_row(
        player_profiles, bundles, independent_join):
    """The distinction is the entire Henderson case. 3,288 with-minutes pairs against 3,289
    Domain G rows."""
    total_rows = sum(len(p["matches"]) for p in player_profiles.values())
    domain_g_rows = sum(len(b["players"] or []) for b in bundles)
    assert total_rows == 3288, f"expected 3,288 with-minutes rows, emitted {total_rows}"
    assert domain_g_rows == 3289, f"expected 3,289 Domain G rows, corpus has {domain_g_rows}"
    assert sum(len(v) for v in independent_join.values()) == total_rows


# ============================================================ Task 9.2/9.3 — the team side
def test_the_team_record_is_derivable_from_its_own_rows_with_GROUP_ONLY_points(
        team_profiles):
    """**`points` counts group-stage points only; knockout ties award none** — the schema's
    own words, and the shipped `test_the_team_profile_record_matches_its_own_per_match_rows`
    asserted the other form. The mutation "points over all rows" must turn this red: it is
    wrong on 19 of 48 teams, Mexico 12 against 9.
    """
    disagreeing = 0
    for team_id, profile in team_profiles.items():
        rows, record = profile["matches"], profile["record"]
        assert record["played"] == len(rows)
        assert record["won"] == sum(1 for r in rows if r["result"] == "win")
        assert record["drawn"] == sum(1 for r in rows if r["result"] == "draw")
        assert record["lost"] == sum(1 for r in rows if r["result"] == "loss")
        assert record["goalsFor"] == sum(r["goalsFor"] for r in rows)
        assert record["goalsAgainst"] == sum(r["goalsAgainst"] for r in rows)
        assert record["goalDifference"] == record["goalsFor"] - record["goalsAgainst"]
        group_points = sum(3 if r["result"] == "win" else 1 if r["result"] == "draw" else 0
                           for r in rows if r["stage"] == "group")
        all_points = sum(3 if r["result"] == "win" else 1 if r["result"] == "draw" else 0
                         for r in rows)
        assert record["points"] == group_points, (
            f"{team_id}: points {record['points']} is not the group-stage-only total "
            f"{group_points}"
        )
        if all_points != group_points:
            disagreeing += 1
    assert disagreeing == 19, (
        f"expected the 19 measured teams where all-rows points differ from group-only, "
        f"found {disagreeing}; this test cannot see the mutation without them"
    )


def test_the_furthest_stage_ranks_the_third_place_play_off_below_the_final(team_profiles):
    """The trap in `("group",) + KNOCKOUT_ROUNDS`: a team in the third-place play-off did
    NOT reach the final. Exactly one match of each exists, so both branches are corpus-live.
    """
    order = ("group", "r32", "r16", "qf", "sf", "third-place", "final")
    finalists, bronze = [], []
    for team_id, profile in team_profiles.items():
        stages = {r["stage"] for r in profile["matches"]}
        expected = max(stages, key=order.index)
        assert profile["record"]["furthestStage"] == expected, (
            f"{team_id}: furthestStage {profile['record']['furthestStage']} over {stages}"
        )
        if expected == "final":
            finalists.append(team_id)
        elif expected == "third-place":
            bronze.append(team_id)
    assert len(finalists) == 2 and len(bronze) == 2, (
        f"expected 2 finalists and 2 third-place teams, found {finalists} / {bronze}"
    )


def test_every_tactical_identity_leaf_is_the_per_leaf_mean_over_the_teams_own_matches(
        team_profiles, independent_team_rows):
    """All 40 leaves: 8 + 9 + 18 + 3 + 1 + 1. Re-derived from the bundles, per leaf.

    Includes the swapped-side mutation: `possession` and `pressingIntensity` come from
    `keyStatistics.{side}` and `tacticalIdentity` is keyed `home`/`away`, so reading the
    wrong side silently produces the opponent's tournament identity.
    """
    checked = 0
    for team_id, profile in team_profiles.items():
        rows = independent_team_rows[team_id]
        identity = profile["tacticalIdentity"]

        def mean_of(path):
            values = []
            for bundle, side in rows:
                node = bundle["tacticalIdentity"][side]
                for part in path:
                    node = node[part]
                values.append(node)
            return sum(values) / len(values)

        for block in ("phasesInPossession", "phasesOutOfPossession",
                      "defensiveBlockDistribution"):
            for leaf, actual in identity[block].items():
                assert actual == pytest.approx(round(mean_of((block, leaf)), 1), abs=0.05), (
                    f"{team_id}: tacticalIdentity.{block}.{leaf} is {actual}"
                )
                checked += 1
        for state, panels in (("inPossession",
                               ("buildUpLow", "buildUpMid", "finalThirdPhase")),
                              ("outOfPossession",
                               ("highBlockPress", "midBlock", "lowBlock"))):
            for panel in panels:
                for measure in ("lineHeight", "teamLength", "teamWidth"):
                    actual = identity["shapeByPhase"][state][panel][measure]
                    expected = round(mean_of(("shapeByPhase", state, panel, measure)), 1)
                    assert actual == pytest.approx(expected, abs=0.05), (
                        f"{team_id}: shapeByPhase.{state}.{panel}.{measure} is {actual}, "
                        f"the per-leaf mean is {expected}"
                    )
                    checked += 1

        possession = sum(b["keyStatistics"][s]["possession"] for b, s in rows) / len(rows)
        assert identity["possession"] == pytest.approx(round(possession, 1), abs=0.05)
        pressures = sum(b["keyStatistics"][s]["defensivePressures"] for b, s in rows)
        assert identity["pressingIntensity"] == pytest.approx(
            round(pressures / len(rows), 1), abs=0.05)
        checked += 2
    assert checked == 40 * len(team_profiles), (
        f"expected 40 leaves x {len(team_profiles)} teams, checked {checked}"
    )


def test_pressing_intensity_is_a_count_valued_mean_and_not_one_of_the_pressing_shares(
        team_profiles):
    """"Pressing tendencies" is two distinct things and they are not the same number. The
    four pressing SHARES are percentages in `phasesOutOfPossession`; `pressingIntensity` is
    "Mean defensive pressures applied per match" and routinely exceeds 100."""
    assert any(p["tacticalIdentity"]["pressingIntensity"] > 100
               for p in team_profiles.values()), (
        "no team's pressingIntensity exceeds 100, so it cannot be distinguished from a "
        "percentage and a shares-vs-intensity mix-up would go unseen"
    )
    for team_id, profile in team_profiles.items():
        shares = profile["tacticalIdentity"]["phasesOutOfPossession"]
        for key in ("highPress", "midPress", "lowPress", "counterPress"):
            assert 0 <= shares[key] <= 100


def test_formation_usage_is_ordered_by_descending_match_count_then_formation_string(
        team_profiles):
    """The tie-break is live on 9 of 48 teams, not a defensive branch."""
    tied = 0
    for team_id, profile in team_profiles.items():
        rows = profile["formationUsage"]
        keys = [(-r["matches"], r["formation"]) for r in rows]
        assert keys == sorted(keys), f"{team_id}: formationUsage is not in the ruled order"
        counts = [r["matches"] for r in rows]
        if counts and counts.count(max(counts)) > 1:
            tied += 1
    assert tied == 9, f"expected the 9 measured teams with a top-count tie, found {tied}"


def test_formation_shares_are_the_honest_rounding_and_are_not_renormalized(team_profiles):
    """Measured: `qatar`, `curacao` and `ir-iran` each play 3 matches with 3 distinct
    formations, so `33.3 x 3 = 99.9`. *Ruled: do not allocate the residual.* A bare
    `== 100` would be red on correct data."""
    not_exactly_100 = []
    for team_id, profile in team_profiles.items():
        rows = profile["formationUsage"]
        played = profile["record"]["played"]
        assert sum(r["matches"] for r in rows) == played
        for row in rows:
            assert row["share"] == pytest.approx(
                round(row["matches"] / played * 100, 1), abs=0.05)
        total = sum(r["share"] for r in rows)
        assert abs(total - 100) <= 0.1 * len(rows), f"{team_id}: shares sum to {total}"
        if abs(total - 100) > 1e-9:
            not_exactly_100.append(team_id)
    assert sorted(not_exactly_100) == ["curacao", "ir-iran", "qatar"], (
        f"expected the three measured 99.9 teams, found {sorted(not_exactly_100)}"
    )


def test_the_result_on_a_shootout_match_follows_the_scoreline_and_reads_as_a_draw(
        team_profiles, bundles):
    """R4, pinned by id. `metadata.score` is level on all four shootout matches while
    `knockoutScore.winnerTeamId` names an advancer, so 8 team-rows have two defensible
    readings and the ruling picks the scoreline."""
    shootouts = {b["matchId"] for b in bundles
                 if (b["metadata"].get("knockoutScore") or {}).get("decidedBy") == "shootout"}
    assert len(shootouts) == 4, f"expected 4 shootout matches, found {sorted(shootouts)}"
    rows_seen = 0
    for profile in team_profiles.values():
        for row in profile["matches"]:
            if row["matchId"] in shootouts:
                rows_seen += 1
                assert row["result"] == "draw", (
                    f"{profile['teamId']}/{row['matchId']}: a shootout is a tie on the "
                    f"scoreline; progression is carried by record.furthestStage"
                )
    assert rows_seen == 8


def test_goals_for_agrees_with_the_key_statistics_goals_it_could_have_come_from(
        team_profiles, bundles):
    """`metadata.score` is the ruled source and `keyStatistics.{side}.goals` is identical on
    all 208 team-innings. The agreement is PINNED so a future divergence is a finding rather
    than a silent choice between two sources."""
    by_id = {b["matchId"]: b for b in bundles}
    checked = 0
    for profile in team_profiles.values():
        for row in profile["matches"]:
            bundle = by_id[row["matchId"]]
            side = "home" if row["isHome"] else "away"
            assert row["goalsFor"] == bundle["metadata"]["score"][side]
            assert row["goalsFor"] == bundle["keyStatistics"][side]["goals"], (
                f"{profile['teamId']}/{row['matchId']}: metadata.score and "
                f"keyStatistics.goals have diverged; the emitter reads the former"
            )
            checked += 1
    assert checked == 208


def test_the_group_letter_resolves_from_a_group_stage_row_on_every_team(
        team_profiles, bundles):
    """`metadata.group` is null on all 32 knockout matches; every team plays the group
    stage, so it always resolves."""
    by_id = {b["matchId"]: b for b in bundles}
    for team_id, profile in team_profiles.items():
        letters = {by_id[r["matchId"]]["metadata"]["group"]
                   for r in profile["matches"] if r["stage"] == "group"}
        assert letters == {profile["group"]}, f"{team_id}: group {profile['group']}"
        assert profile["group"] in list("abcdefghijkl")


def test_the_team_code_is_the_committed_one_and_is_never_derived(team_profiles):
    """Six codes carry a letter absent from their slug and no first-three-letters rule
    produces `rsa` or `cod`."""
    for team_id, profile in team_profiles.items():
        assert profile["teamCode"] == TEAM_CODES[team_id]
    assert team_profiles["south-africa"]["teamCode"] == "rsa"
    assert team_profiles["saudi-arabia"]["teamCode"] == "ksa"


# ================================================================= Task 9.9 — Henderson, by id
def test_the_henderson_domain_g_row_with_no_minutes_produces_no_match_row(
        player_profiles, bundles):
    """`m092-mexico-england` / `henderson-jordan-eng` is the ONE Domain G row with no
    minutes — an unused substitute the report prints an all-zero row for after booking him
    from the bench. Under the lineups-with-minutes join he gets NO row for m092, so the zero
    surfaces as the correct ABSENCE of an appearance rather than as a zeroed appearance.

    All three facts in one test: no m092 row, an otherwise ordinary profile, and no
    exception. He is neither pruned from the registry nor special-cased by id.
    """
    profile = player_profiles["henderson-jordan-eng"]
    assert not [r for r in profile["matches"] if r["matchId"] == "m092-mexico-england"], (
        "iterating players[] instead of lineups-with-minutes manufactures a phantom "
        "appearance here and breaks played == started + substituteAppearances"
    )
    assert profile["matches"], "he has minutes in England's other matches"
    assert profile["appearances"]["played"] == len(profile["matches"])
    m092 = [b for b in bundles if b["matchId"] == "m092-mexico-england"][0]
    row = [r for r in m092["players"] if r["playerId"] == "henderson-jordan-eng"]
    assert len(row) == 1, "the orphan Domain G row is still in the corpus and is not pruned"
    assert all(v == 0 for block in ("inPossession", "outOfPossession", "physical")
               for v in row[0][block].values() if isinstance(v, (int, float))
               and not isinstance(v, bool)), "the orphan row is all-zero"


# ============================================================ Task 9.9a — the zero denominator
def test_a_player_who_attempts_no_pass_all_tournament_emits_zero_and_does_not_raise(
        player_profiles):
    """One of the 17, by id. `AggregateMetricValue` is `type: number` and NOT nullable."""
    profile = player_profiles["iglesias-borja-esp"]
    row = _aggregate(profile, "passCompletion")
    assert row["value"] == 0.0 and row["aggregation"] == "average"
    assert row["perNinety"] is None
    assert profile["appearances"]["played"] > 0, "he did play; he simply attempted no pass"
    assert all(r["passesAttempted"] == 0 for r in profile["matches"])


def test_a_match_row_with_no_pass_attempted_carries_pass_completion_zero(player_profiles):
    """`common#Percentage` is also non-nullable. Measured: 53 Domain G rows carry
    `passesAttempted: 0`, of which 52 are with-minutes rows and therefore emitted — the
    53rd is Henderson's m092 row, which produces no match row at all."""
    emitted = [(p["playerId"], r["matchId"])
               for p in player_profiles.values() for r in p["matches"]
               if r["passesAttempted"] == 0]
    assert len(emitted) == 52, (
        f"expected the 52 emitted zero-denominator rows (53 Domain G rows minus "
        f"Henderson's m092), found {len(emitted)}"
    )
    for player_id, match_id in emitted:
        row = [r for r in player_profiles[player_id]["matches"]
               if r["matchId"] == match_id][0]
        assert row["passCompletion"] == 0.0


# ================================================================== Task 9.9b — Senesi, by id
def test_senesi_resolves_to_defender_because_that_is_his_most_frequent_lineup_position(
        player_profiles, bundles):
    """The one player carrying two positions, and the test states WHICH value and why — a
    test asserting merely "some position" would pass on the wrong one.

    He is listed `mf` in `m019-argentina-algeria`, where he was an UNUSED SUBSTITUTE and has
    no Domain G row, and `df` in seven other matches. *Ruled: most frequent across the
    player's lineup entries, ties broken by first chronological occurrence* — so `df`. The
    rejected "first lineup entry" rule yields `mf`, a wrong label sourced from a match he
    did not play.
    """
    seen = []
    for bundle in bundles:
        for side in ("home", "away"):
            for section in ("starters", "substitutes"):
                for entry in bundle["metadata"]["lineups"][side][section]:
                    if entry["playerId"] == "senesi-marcos-arg":
                        seen.append((bundle["matchId"], section, entry["position"]))
    positions = {p for _m, _s, p in seen}
    assert positions == {"df", "mf"}, f"the two-position case has moved: {sorted(seen)}"
    assert seen[0][2] == "mf", (
        "the FIRST chronological entry is the mf one, so a 'first lineup entry wins' rule "
        "would yield mf — a wrong label sourced from a match he did not play"
    )
    assert player_profiles["senesi-marcos-arg"]["position"] == "df"


def test_no_other_player_carries_two_positions_or_two_shirt_numbers(bundles):
    positions, shirts = {}, {}
    for bundle in bundles:
        for side in ("home", "away"):
            for section in ("starters", "substitutes"):
                for entry in bundle["metadata"]["lineups"][side][section]:
                    positions.setdefault(entry["playerId"], set()).add(entry["position"])
                    shirts.setdefault(entry["playerId"], set()).add(entry["shirtNumber"])
    assert sorted(p for p, v in positions.items() if len(v) > 1) == ["senesi-marcos-arg"]
    assert [p for p, v in shirts.items() if len(v) > 1] == []


# ============================================================ Task 9.8 — the zero-appearance shape
def test_the_two_hundred_and_nine_players_who_never_played_still_get_a_total_artifact(
        player_profiles, independent_join):
    """16.7% of the player artifacts, not an edge case the App may treat as one.

    R2's totality corollary: `aggregates[]` is a CLOSED, TOTAL, ORDERED list, so it must be
    total on all 1,248 files — otherwise the App still has to branch, which is the branch
    the totality argument exists to remove. The only genuinely empty array is `matches`.
    """
    never_played = [pid for pid in player_profiles if pid not in independent_join]
    assert len(never_played) == 209, f"expected 209, found {len(never_played)}"
    for player_id in never_played:
        profile = player_profiles[player_id]
        assert profile["appearances"] == {
            "played": 0, "started": 0, "substituteAppearances": 0, "minutesPlayed": 0}
        assert profile["matches"] == []
        assert len(profile["aggregates"]) == 18, "18 rows, not an empty list"
        assert all(a["value"] == 0 and a["perNinety"] is None
                   for a in profile["aggregates"])
        assert len(profile["trends"]) == 6
        assert all(t["points"] == [] for t in profile["trends"])
        assert profile["physical"]["topSpeed"] == 0.0, (
            "max over an empty set is undefined; ruled to 0.0 rather than raising"
        )
        assert all(profile["physical"][f] == 0 for f in
                   ("totalDistance", "distanceZone1", "distanceZone2", "distanceZone3",
                    "distanceZone4", "distanceZone5", "highSpeedRuns", "sprints"))
        # The identity block is reachable ONLY from lineups for these 209.
        assert profile["name"] and profile["position"] in ("gk", "df", "mf", "fw")
        assert isinstance(profile["shirtNumber"], int)
        assert profile["team"]["id"] in PINS["teams"].values()
        assert set(profile["team"]) == {"id", "name"}


def test_attempts_at_goal_and_passes_attempted_are_verbatim_from_domain_g(
        player_profiles, bundles):
    """The two `PlayerMatchRow` columns that appear in NO `metricCode` table anywhere.

    Task 5.5: "their source is named here and nowhere else." That made them the two stat
    columns with no aggregate expectation standing behind them — every other column is
    reachable through one of the eighteen named metric tests, so a wrong source or a coarse
    precision binding on these two alone would have been invisible.
    """
    by_match = {b["matchId"]: b for b in bundles}
    checked = 0
    for player_id, profile in player_profiles.items():
        for row in profile["matches"]:
            source = [r for r in (by_match[row["matchId"]]["players"] or [])
                      if r["playerId"] == player_id]
            assert len(source) == 1, f"{player_id}/{row['matchId']}: join is not total"
            for column in ("attemptsAtGoal", "passesAttempted"):
                expected = source[0]["inPossession"][column]
                assert row[column] == expected, (
                    f"{player_id}/{row['matchId']}: {column} is {row[column]!r}, "
                    f"Domain G says {expected!r}"
                )
                assert isinstance(row[column], int) and not isinstance(row[column], bool), (
                    f"{player_id}/{row['matchId']}: {column} is a Count and must be an int"
                )
                checked += 1
    assert checked == 3288 * 2, f"expected 6,576 column reads, made {checked}"


def test_the_team_match_row_key_statistics_columns_are_verbatim_from_the_bundle(
        team_profiles, bundles):
    """The six `TeamMatchBreakdown` columns copied straight out of `keyStatistics.{side}`.

    Nothing asserted them: the tactical-identity test re-derives the aggregate MEANS, and
    the per-match columns they are meaned from went unchecked. This is also the one place a
    coarser precision binding would still hide — `distanceCovered` bound to `Count` instead
    of `Kilometres` would round 107.3 to 107 and the schema-wide precision test would pass
    it, because an integer satisfies `round(v, 0) == v`.
    """
    by_match = {b["matchId"]: b for b in bundles}
    columns = ("possession", "expectedGoals", "shots", "shotsOnTarget",
               "passCompletion", "distanceCovered")
    checked = 0
    for team_id, profile in team_profiles.items():
        for row in profile["matches"]:
            bundle = by_match[row["matchId"]]
            side = "home" if bundle["metadata"]["homeTeam"]["teamId"] == team_id else "away"
            assert row["isHome"] == (side == "home"), f"{team_id}/{row['matchId']}: wrong side"
            stats = bundle["keyStatistics"][side]
            for column in columns:
                assert row[column] == stats[column], (
                    f"{team_id}/{row['matchId']}: {column} is {row[column]!r}, "
                    f"keyStatistics.{side} says {stats[column]!r}"
                )
                checked += 1
            # `goalsFor` is ruled onto `metadata.score`; the agreement with
            # `keyStatistics.{side}.goals` is pinned so a future divergence is a finding.
            assert row["goalsFor"] == stats["goals"], (
                f"{team_id}/{row['matchId']}: metadata.score and keyStatistics.goals have "
                f"diverged; the ruled source must be re-examined, not silently preferred"
            )
    assert checked == 208 * len(columns), f"expected {208 * len(columns)}, made {checked}"


def test_the_aggregate_roster_is_the_same_closed_ordered_eighteen_on_every_player(
        player_profiles):
    """A closed, total, ORDERED list is the one shape that never needs a later artifact
    change to add a metric the App wants — and the order is the only contract the App has,
    since `additionalProperties` does not constrain array contents."""
    enum = load_schemas()["common.schema.json"]["$defs"]["MetricCode"]["enum"]
    rosters = {tuple(a["metricCode"] for a in p["aggregates"])
               for p in player_profiles.values()}
    assert len(rosters) == 1, f"the aggregate roster is not total: {len(rosters)} variants"
    roster = rosters.pop()
    assert len(roster) == 18
    assert set(roster) <= set(enum), "a metricCode outside the closed enum"
    # **Asserted against the ENUM's order, not against `sorted()`.** The module states the
    # contract as "the enum's own order" and notes that the enum happens to be alphabetical
    # today; asserting `list(roster) == sorted(roster)` pins the coincidence rather than the
    # contract, so a non-alphabetical reorder of `common#MetricCode` would silently falsify
    # the stated rule while every test stayed green. Kept alongside the alphabetical check,
    # because the module's claim `enum == sorted(enum)` is itself worth a tripwire.
    assert list(enum) == sorted(enum), (
        "common#MetricCode is no longer alphabetical, so 'enum order' and 'alphabetical "
        "order' have diverged — profiles.py's ordering comment must be re-read"
    )
    assert list(roster) == [c for c in enum if c in set(roster)], (
        "aggregates[] is not in common#MetricCode's own order"
    )
    # The 14 team-scope codes are schema-legal on a player profile and semantically
    # forbidden; nothing validates this, so it is asserted here.
    forbidden = {"completedLineBreaks", "crosses", "defensiveLineBreaks",
                 "defensivePressures", "distanceCovered", "expectedGoals",
                 "forcedTurnovers", "passes", "possession", "receptionsInFinalThird",
                 "secondBalls", "shots", "shotsOnTarget", "sprintDistance"}
    assert not (set(roster) & forbidden), "a team-scope metric on a player profile"
    assert set(enum) - set(roster) == forbidden
    assert "attemptsAtGoal" not in enum, (
        "attemptsAtGoal is a required PlayerMatchRow column and is NOT in the enum; "
        "inventing a code for it would be a change-set"
    )


def test_the_trend_roster_is_the_same_closed_ordered_six_on_every_player(player_profiles):
    rosters = {tuple(t["metricCode"] for t in p["trends"])
               for p in player_profiles.values()}
    assert len(rosters) == 1, f"the trend roster is not total: {len(rosters)} variants"
    roster = rosters.pop()
    assert roster == ("ballProgressions", "goals", "passCompletion", "passesCompleted",
                      "topSpeed", "totalDistance")


def test_a_trend_point_is_the_match_value_verbatim_and_never_cumulative_or_reweighted(
        player_profiles, independent_join):
    """The weighting rule applies to the tournament aggregate ONLY; a trend is a series of
    match values. A cumulative series would be monotonic, which this would catch."""
    source = {"ballProgressions": ("inPossession", "ballProgressions"),
              "goals": ("inPossession", "goals"),
              "passCompletion": ("inPossession", "passCompletion"),
              "passesCompleted": ("inPossession", "passesCompleted"),
              "topSpeed": ("physical", "topSpeed"),
              "totalDistance": ("physical", "totalDistance")}
    for player_id, profile in player_profiles.items():
        records = independent_join.get(player_id, [])
        for series in profile["trends"]:
            block, field = source[series["metricCode"]]
            assert len(series["points"]) == len(records)
            for point, record in zip(series["points"], records):
                assert point["value"] == pytest.approx(record[block][field], abs=0.05), (
                    f"{player_id}/{series['metricCode']}/{point['matchId']}: "
                    f"{point['value']} != the match's own {record[block][field]}"
                )
            assert [p["matchId"] for p in series["points"]] == [
                r["matchId"] for r in profile["matches"]]


# ================================================== Task 9.7 — the bijection this story owns
def test_exactly_one_artifact_exists_per_registry_pinned_entity(
        committed_team_profiles, committed_player_profiles):
    """R3 scopes this story to the UNILATERAL property. The AD-4 route-manifest bijection
    is Story 1.17's and is printed by `main` as not-asserted-here, never treated as passed
    by absence — the `check_committed_data` precedent.

    Asserted over the ON-DISK namespace: this is a claim about which files exist.
    """
    assert set(committed_team_profiles) == set(PINS["teams"].values())
    assert len(committed_team_profiles) == 48
    assert set(committed_player_profiles) == set(PINS["players"].values())
    assert len(committed_player_profiles) == 1248


def test_every_filename_equals_the_id_inside_the_file(
        committed_team_profiles, committed_player_profiles):
    for stem, profile in committed_team_profiles.items():
        assert profile["teamId"] == stem
    for stem, profile in committed_player_profiles.items():
        assert profile["playerId"] == stem


def _id_bearing_keys(schema_name: str) -> "set[str]":
    """Which property names of `schema_name` carry an entity id, DERIVED from the contract.

    Resolved through the `$ref` targets rather than transcribed, so a new id-bearing field
    shows up here automatically instead of silently escaping the immutability walk.
    """
    schemas = load_schemas()
    common = schemas["common.schema.json"]
    id_types = {"TeamId", "PlayerId", "MatchId"}
    found: "set[str]" = set()

    def scan(document):
        for pointer, node in walk_subschemas(document):
            if not isinstance(node, dict):
                continue
            parts = pointer.strip("/").split("/")
            if len(parts) < 2 or parts[-2] != "properties":
                continue
            ref = node.get("$ref")
            if not isinstance(ref, str):
                continue
            target = ref.rsplit("/", 1)[-1]
            if target in id_types:
                found.add(parts[-1])
            elif target == "EntityRef":
                # `EntityRef.id` is a plain slug under a key named `id`. It is an entity
                # reference by every measure that matters to AD-3's walk.
                found.add("id")

    scan(schemas[schema_name])
    scan(common)
    return found


def test_the_committed_id_check_is_total_for_a_team_profile(committed_team_profiles):
    """Task 7.8c, named for its artifact the way Story 1.16 named its own.

    Every id-bearing key a team profile actually carries must be in `PROFILE_ID_KEYS`, or
    that id sits outside AD-3's immutability walk while the run still prints "all pinned".
    """
    from pipeline.precompute.identity import PROFILE_ID_KEYS
    declared = _id_bearing_keys(TEAM_SCHEMA)
    carried = {key for profile in committed_team_profiles.values()
               for path, _v in _leaves(profile)
               for key in [path.rsplit("/", 1)[-1]] if key in declared}
    assert carried, "no id-bearing key found in any team profile"
    assert carried <= set(PROFILE_ID_KEYS), (
        f"team profiles carry id key(s) {sorted(carried - set(PROFILE_ID_KEYS))} that "
        f"PROFILE_ID_KEYS does not name; they escape the /data immutability walk"
    )
    assert {"teamId", "matchId", "id"} <= carried


def test_the_committed_id_check_is_total_for_a_player_profile(committed_player_profiles):
    from pipeline.precompute.identity import PROFILE_ID_KEYS
    declared = _id_bearing_keys(PLAYER_SCHEMA)
    carried = {key for profile in committed_player_profiles.values()
               for path, _v in _leaves(profile)
               for key in [path.rsplit("/", 1)[-1]] if key in declared}
    assert carried, "no id-bearing key found in any player profile"
    assert carried <= set(PROFILE_ID_KEYS), (
        f"player profiles carry id key(s) {sorted(carried - set(PROFILE_ID_KEYS))} that "
        f"PROFILE_ID_KEYS does not name; they escape the /data immutability walk"
    )
    assert {"playerId", "matchId", "id"} <= carried


def test_a_bare_id_names_a_TEAM_everywhere_it_appears_in_a_profile(
        committed_team_profiles, committed_player_profiles):
    """Why `PROFILE_ID_KEYS` can map `"id" -> "teams"` at all.

    Story 1.17 rejected widening `COMMITTED_ID_KEYS` because a bare `id` "names a team or a
    player BY CONTEXT". True across `data/index/` as a whole; FALSE inside a profile, where
    `EntityRef` appears in exactly two slots — `matches[].opponent` and a player profile's
    `team` — and both name a team. This asserts that, so the day a third `EntityRef` slot
    names a player the map becomes wrong LOUDLY rather than pinning player ids against the
    team namespace.
    """
    teams = set(PINS["teams"].values())
    seen = 0
    for profile in committed_team_profiles.values():
        for row in profile["matches"]:
            assert row["opponent"]["id"] in teams
            seen += 1
    for profile in committed_player_profiles.values():
        assert profile["team"]["id"] in teams
        seen += 1
        for row in profile["matches"]:
            assert row["opponent"]["id"] in teams
            seen += 1
    assert seen == 208 + 1248 + 3288


def test_the_default_committed_data_walk_is_unchanged_by_the_globs_parameter(repo_root):
    """Task 7.8a widened the WALKER, additively. The default must stay byte-for-byte Story
    1.15's behaviour or `test_precompute_spine.py`'s "104 bundle(s)" expectation is
    silently invalidated."""
    from pipeline.precompute.identity import check_committed_data
    notes = check_committed_data(PINS, repo_root / "data")
    assert len(notes) == 1
    assert notes[0].startswith("committed /data baseline: 104 bundle(s), ")
    assert notes[0].endswith("id reference(s), all pinned")


def test_emit_profiles_prints_that_the_route_manifest_bijection_is_not_asserted_here(
        repo_root, capsys):
    """Never let "no manifest" read as "bijection passed"."""
    profiles.main(["--data-dir", str(repo_root / "data"), "--dry-run"])
    out = capsys.readouterr().out
    assert "route-manifest bijection not asserted here; owned by Story 1.17." in out


# ================================================================== Task 9.11 — corpus sweeps
def test_every_emitted_artifact_validates_against_its_schema(team_profiles, player_profiles):
    for team_id, profile in team_profiles.items():
        assert iter_violations(profile, TEAM_SCHEMA) == [], team_id
    for player_id, profile in player_profiles.items():
        assert iter_violations(profile, PLAYER_SCHEMA) == [], player_id


def test_every_artifact_is_stamped_with_the_declared_schema_version_never_a_literal(
        team_profiles, player_profiles):
    version = schema_version()
    for profile in list(team_profiles.values()) + list(player_profiles.values()):
        assert profile["schemaVersion"] == version


def _leaves(node, path=""):
    if isinstance(node, dict):
        for key, value in node.items():
            yield from _leaves(value, f"{path}/{key}")
    elif isinstance(node, list):
        for i, value in enumerate(node):
            yield from _leaves(value, f"{path}/{i}")
    else:
        yield path, node


def test_no_artifact_carries_a_snake_case_key_or_a_non_finite_number(
        team_profiles, player_profiles):
    import math
    for profile in list(team_profiles.values()) + list(player_profiles.values()):
        for path, value in _leaves(profile):
            assert "_" not in path, f"snake_case key at {path}"
            if isinstance(value, float):
                assert math.isfinite(value), f"non-finite at {path}"


def test_the_committed_artifacts_equal_what_the_emitter_produces_today(
        repo_root, built, committed_team_profiles, committed_player_profiles):
    """The rebuild-and-compare test Story 1.16's review found missing. Shipped from day one.

    Compares BYTES, not parsed dicts: two serializations differing by a single space parse
    identically and are two different artifacts.

    This is the ONE test that couples the emitter to the committed namespace, and it is no
    longer the only test that can see an emitter defect — see the `built` fixture for why
    that mattered.
    """
    rebuilt_teams, rebuilt_players = built
    assert set(rebuilt_teams) == set(committed_team_profiles)
    assert set(rebuilt_players) == set(committed_player_profiles)
    for team_id, rebuilt in rebuilt_teams.items():
        assert canonical_json(rebuilt) == canonical_json(
            committed_team_profiles[team_id]), team_id
    for player_id, rebuilt in rebuilt_players.items():
        assert canonical_json(rebuilt) == canonical_json(
            committed_player_profiles[player_id]), player_id


def test_the_committed_files_are_utf8_lf_and_newline_terminated(repo_root):
    root = repo_root / "data" / "index"
    paths = sorted(root.glob("*-profiles/*.json"))
    assert len(paths) == 1296
    for path in paths:
        raw = path.read_bytes()
        assert b"\r\n" not in raw, f"{path.name} carries CRLF"
        assert raw.endswith(b"\n"), f"{path.name} has no trailing newline"
        raw.decode("utf-8")


def test_no_artifact_carries_a_timestamp_a_path_a_host_name_or_a_code_version(
        team_profiles, player_profiles):
    """Determinism is a property of the CONTENT, not only of the serializer."""
    banned = ("generatedAt", "timestamp", "codeVersion", "hostname", "sourcePath",
              "runId", "emittedAt")
    for profile in list(team_profiles.values()) + list(player_profiles.values()):
        for path, _value in _leaves(profile):
            for key in banned:
                assert key.lower() not in path.lower(), f"{key} at {path}"


# ================================================================== Task 9.4 — determinism
def test_two_emissions_into_two_directories_are_byte_identical(repo_root, tmp_path):
    """Compared on BYTES, not parsed dicts."""
    first, second = tmp_path / "a", tmp_path / "b"
    for target in (first, second):
        (target / "matches").mkdir(parents=True)
        for path in sorted((repo_root / "data" / "matches").glob("*.json")):
            (target / "matches" / path.name).write_bytes(path.read_bytes())
        profiles.emit_profiles(target, expect_teams=48, expect_players=1248)
    a = sorted((first / "index").glob("*-profiles/*.json"))
    b = sorted((second / "index").glob("*-profiles/*.json"))
    assert [p.name for p in a] == [p.name for p in b]
    assert len(a) == 1296
    for left, right in zip(a, b):
        assert left.read_bytes() == right.read_bytes(), left.name


# ============================================================ Task 9.5 / 6.2 — precision
def _declared_precision_by_instance_path() -> "dict[str, int]":
    """Every profile instance path's declared `x-decimals`, resolved through the schema's
    own `$ref`s — NOT through the emitter's key map.

    Story 1.16's review found that deriving the expectation from `_KEY_TO_DEF` made every
    wrongly-bound leaf invisible. This walks the contract instead.
    """
    schemas = load_schemas()
    common = schemas["common.schema.json"]

    def places_of(node: dict) -> "int | None":
        ref = node.get("$ref")
        if isinstance(ref, str):
            name = ref.rsplit("/", 1)[-1]
            if ref.startswith("common.schema.json#"):
                return places_of(common["$defs"][name])
            return None
        if "x-decimals" in node:
            return node["x-decimals"]
        for branch in node.get("anyOf", ()):
            if isinstance(branch, dict) and "x-decimals" in branch:
                return branch["x-decimals"]
        return None

    found: "dict[str, int]" = {}
    for document in (schemas[TEAM_SCHEMA], schemas[PLAYER_SCHEMA]):
        for pointer, node in walk_subschemas(document):
            if not isinstance(node, dict):
                continue
            parts = pointer.strip("/").split("/")
            if len(parts) < 2 or parts[-2] != "properties":
                continue
            declared = places_of(node)
            if declared is not None:
                found[parts[-1]] = declared
    return found


def test_every_numeric_leaf_respects_the_precision_the_SCHEMA_declares_for_it(
        team_profiles, player_profiles):
    """Collects `int` leaves as well as `float`: Story 1.16's review found that collecting
    floats only made every wrongly-0-placed leaf invisible."""
    declared = _declared_precision_by_instance_path()
    assert declared, "the schema walk found no declared precision at all"
    # The polymorphic slots are excluded here and covered by their own tests below: their
    # `x-decimals: 2` is "the widest precision any metric uses", not the rule.
    polymorphic = {"value", "perNinety"}
    checked = 0
    unchecked: "set[str]" = set()
    for profile in list(team_profiles.values()) + list(player_profiles.values()):
        for path, value in _leaves(profile):
            key = path.rsplit("/", 1)[-1]
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                continue
            if key in polymorphic or key not in declared:
                unchecked.add(key)
                continue
            places = declared[key]
            if places == 0:
                assert isinstance(value, int), f"{path} = {value!r} must be an integer"
            else:
                assert round(value, places) == value, (
                    f"{path} = {value!r} carries more than {places} decimal place(s)"
                )
                # **The assertion above is blind to an integer, and that blindness shipped
                # 1,672 leaves as JSON `0` across the 209 zero-appearance profiles**:
                # `round(0, 1) == 0` is True, so a `Metres` field printed `0` beside a
                # `topSpeed` printing `0.0` and nothing moved. The check was strict in the
                # `places == 0` direction only. The corpus convention is the other way —
                # the committed Match Bundles carry 23,023 values in these slots and every
                # one is a float, including all 261 zeros.
                assert isinstance(value, float), (
                    f"{path} = {value!r} is an int in a slot the schema declares at "
                    f"{places} decimal place(s); it must ship as a JSON float"
                )
            checked += 1
    # A TOTALITY claim rather than a magic floor: the only numeric leaves this sweep does
    # not cover are the two polymorphic slots (covered by their own test below) and
    # `schemaVersion`, which is `{"type": "integer", "const": 4}` and declares no
    # `x-decimals` to check against. Anything else appearing here is a leaf shipping
    # unrounded, which is precisely what this test exists to catch.
    assert unchecked == {"value", "perNinety", "schemaVersion"}, (
        f"numeric leaves reached the artifact with no declared precision: "
        f"{sorted(unchecked - {'value', 'perNinety', 'schemaVersion'})}"
    )
    assert checked == 57_808, (
        f"the precision sweep covered {checked} leaves, not the 57,808 the committed "
        f"namespace carries; the artifact shape has changed"
    )


def test_the_polymorphic_value_slot_rounds_to_the_source_metrics_precision_not_to_two(
        player_profiles):
    """`AggregateMetricValue` declares `x-decimals: 2` and its own description calls that
    "the widest precision any metric uses"; the rule is the precision of the source field
    named by `metricCode`."""
    expected = {"passCompletion": 1, "topSpeed": 1, "totalDistance": 1}
    integral = {"goals", "passesCompleted", "ballProgressions", "lineBreaksCompleted",
                "crossesCompleted", "switchesOfPlay", "takeOns", "stepIns", "tacklesWon",
                "interceptions", "duelsWonAerial", "duelsWonPhysical", "possessionRegains",
                "highSpeedRuns", "sprints"}
    for player_id, profile in player_profiles.items():
        for row in profile["aggregates"]:
            code, value = row["metricCode"], row["value"]
            if code in integral:
                assert isinstance(value, int) and not isinstance(value, bool), (
                    f"{player_id}/{code}: {value!r} — a Count aggregate must be an integer"
                )
            else:
                assert round(value, expected[code]) == value, (
                    f"{player_id}/{code}: {value!r} exceeds {expected[code]} place(s)"
                )
                # Same blind spot as the schema-wide precision test: `topSpeed` and
                # `totalDistance` reduce over an EMPTY record set on the 209
                # zero-appearance players, and an empty reduction is a Python `int`, so
                # both shipped as JSON `0` while `passCompletion` beside them shipped `0.0`.
                assert isinstance(value, float), (
                    f"{player_id}/{code}: {value!r} is an int in a "
                    f"{expected[code]}-decimal metric slot; it must ship as a float"
                )


def test_per_ninety_stays_bound_because_its_precision_hides_inside_an_anyof_branch():
    """Task 6.2b, kept as a tripwire after the gap it documented was closed.

    At this story's baseline `decimals_map("player-profile.schema.json")` returned 7 names
    and `PerNinety` was NOT among them: its `x-decimals: 2` sits inside an `anyOf` branch
    while the inline-title loop read the keyword off the titled node itself. An unbound
    `perNinety` ships unrounded 17-digit floats, validates clean against `type: number`, and
    destroys byte-identity. Story 1.17 fixed the loop (crediting `LeaderboardPerMatchValue`,
    the same shape in its own artifact).

    This asserts the shape is STILL the tricky one and that the map still carries it, so a
    revert of that fix fails here with the reason attached rather than as 1,248 artifacts
    quietly gaining seventeen decimal places.
    """
    node = (load_schemas()[PLAYER_SCHEMA]["$defs"]["AggregateMetric"]
            ["properties"]["perNinety"])
    assert "x-decimals" not in node, "PerNinety declares on an anyOf branch, not on itself"
    assert [b["x-decimals"] for b in node["anyOf"] if "x-decimals" in b] == [2]
    mapped = decimals_map(PLAYER_SCHEMA)
    assert "PerNinety" in mapped, (
        "decimals_map no longer carries PerNinety — the anyOf-branch read has regressed"
    )
    assert profiles.per_ninety_places(mapped) == 2
    with pytest.raises(ProfileError, match="does not carry 'PerNinety'"):
        profiles.per_ninety_places({"Count": 0})


def test_the_shipped_check_total_resolves_every_profile_type_including_the_titled_ones():
    """Task 4.7, inverted after 1.17 landed.

    At this story's baseline `emit._def_properties` took only a name and resolved it against
    the match-bundle + common documents, so all 13 profile `$def`s raised `KeyError` and the
    story ordered a profile-scoped fork. Story 1.17 (`ae207ed`) added the `documents`
    parameter for exactly this, so the fork was retired rather than left in place with a
    stale rationale — its own docstring forbids the duplicate.

    Six of these are declared INLINE with a `title` rather than hoisted into `$defs`, which
    is the part a copy tends to drop and the reason the shipped function is worth reusing.
    """
    from pipeline.precompute import emit
    hoisted = ("TeamProfile", "PlayerProfile", "AggregateMetric", "TournamentRecord",
               "AggregateTacticalIdentity", "FormationUsageRow", "TeamMatchBreakdown",
               "Appearances", "PhysicalProfile", "PlayerMatchRow", "TrendSeries",
               "TrendPoint", "AggregateShapeMetrics", "EntityRef")
    titled_only = ("AggregateInPossessionPhases", "AggregateOutOfPossessionPhases",
                   "AggregateShapeByPhase", "AggregateInPossessionShapePanels",
                   "AggregateOutOfPossessionShapePanels", "AggregateBlockDistribution")
    for name in hoisted + titled_only:
        resolved = set()
        for documents in (profiles.TEAM_DOCS, profiles.PLAYER_DOCS):
            try:
                resolved |= emit._def_properties(name, documents)
            except KeyError:
                continue
        assert resolved, (
            f"emit._def_properties({name!r}) resolves in neither profile document; the "
            f"documents parameter has regressed and every emitted object would go "
            f"unasserted"
        )
    # And it still refuses the bundle-only tuple, which is what made the fork necessary.
    with pytest.raises(KeyError):
        emit._def_properties("TeamProfile")


def test_an_unbound_numeric_leaf_raises_rather_than_shipping_unrounded():
    """The defect Story 1.16's review found in `emit._KEY_TO_DEF`: an unrecognised key
    inherited its PARENT's binding, so 29 percentage and metre leaves took `Count`'s 0
    places and `lineHeight: 19.5` shipped as `20` while validating clean."""
    with pytest.raises(ProfileError, match="not bound to any declared precision"):
        profiles._round_profile({"anUnknownMetre": 19.5}, {"lineHeight": 1}, {}, 2, "test")
    # Nothing inherits: a bound parent key does not license its children.
    with pytest.raises(ProfileError, match="not bound to any declared precision"):
        profiles._round_profile({"possession": {"nested": 1.234}},
                                {"possession": 1}, {}, 2, "test")


# ====================================================================== Task 9.6 — the budget
def test_the_budget_gate_can_actually_fail():
    """CONSTRUCTED, because the corpus cannot drive it red: the largest emitted artifact is
    ~1.5 KB, 0.31% of the 500 KB ceiling. "A gate that cannot fail reads greener than no
    gate while proving strictly less."
    """
    incompressible = json.dumps([f"{i:016x}{i * 7919:016x}" for i in range(200_000)])
    assert gzip_bytes(incompressible) > BUDGET_BYTES
    breach = over_budget("constructed-profile", incompressible)
    assert breach is not None
    label, compressed, raw = breach
    assert label == "constructed-profile" and compressed > BUDGET_BYTES and raw > compressed


def test_no_committed_profile_breaches_the_budget(repo_root):
    root = repo_root / "data" / "index"
    for path in sorted(root.glob("*-profiles/*.json")):
        assert over_budget(path.stem, path.read_text(encoding="utf-8")) is None


def test_the_budget_unit_is_gzip_and_the_measurement_is_reproducible():
    text = "a" * 1_000_000
    assert len(text.encode("utf-8")) > BUDGET_BYTES
    assert gzip_bytes(text) < BUDGET_BYTES
    assert gzip_bytes("payload") == gzip_bytes("payload")


# ================================================== Task 9.9c / 2.2a — constructed edge cases
def _synthetic_bundle(match_id="m001-alpha-beta", players="keep"):
    """A minimal schema-shaped bundle for the paths the corpus cannot reach."""
    entry = {"playerId": "one-alpha-aaa", "name": "One ALPHA", "position": "mf",
             "shirtNumber": 7, "substitutedOn": None, "substitutedOff": None,
             "cards": [], "goals": []}
    blocks = {
        "inPossession": {"goals": 1, "attemptsAtGoal": 2, "passesAttempted": 10,
                         "passesCompleted": 8, "passCompletion": 80.0,
                         "ballProgressions": 3, "crossesCompleted": 1,
                         "lineBreaksCompleted": 2, "switchesOfPlay": 1, "takeOns": 2,
                         "stepIns": 1},
        "outOfPossession": {"tacklesWon": 2, "interceptions": 1, "duelsWonAerial": 1,
                            "duelsWonPhysical": 2, "possessionRegains": 3},
        "physical": {"totalDistance": 9000.0, "distanceZone1": 1000.0,
                     "distanceZone2": 2000.0, "distanceZone3": 3000.0,
                     "distanceZone4": 2000.0, "distanceZone5": 1000.0,
                     "highSpeedRuns": 10, "sprints": 5, "topSpeed": 30.0},
    }
    shape = {"lineHeight": 20.0, "teamLength": 30.0, "teamWidth": 40.0}
    identity = {
        "phasesInPossession": {k: 12.5 for k in (
            "buildUpUnopposed", "buildUpOpposed", "progression", "finalThird", "longBall",
            "attackingTransition", "counterAttack", "setPiece")},
        "phasesOutOfPossession": {k: 11.1 for k in (
            "highPress", "midPress", "lowPress", "highBlock", "midBlock", "lowBlock",
            "recovery", "defensiveTransition", "counterPress")},
        "shapeByPhase": {
            "inPossession": {p: dict(shape) for p in
                             ("buildUpLow", "buildUpMid", "finalThirdPhase")},
            "outOfPossession": {p: dict(shape) for p in
                                ("highBlockPress", "midBlock", "lowBlock")}},
        "defensiveBlockDistribution": {"high": 33.3, "mid": 33.3, "low": 33.4},
    }
    stats = {"possession": 50.0, "expectedGoals": 1.0, "shots": 10, "shotsOnTarget": 4,
             "passCompletion": 80.0, "distanceCovered": 110.0, "defensivePressures": 200,
             "goals": 1}
    return {
        "matchId": match_id,
        "schemaVersion": schema_version(),
        "metadata": {
            "date": "2026-06-11", "stage": "group", "group": "a",
            "score": {"home": 1, "away": 1},
            "homeTeam": {"teamId": "alpha", "teamCode": "aaa", "name": "Alpha"},
            "awayTeam": {"teamId": "beta", "teamCode": "bbb", "name": "Beta"},
            "knockoutScore": {"decidedBy": "regulation"},
            "lineups": {
                "home": {"formation": "4-3-3", "starters": [entry], "substitutes": []},
                "away": {"formation": "4-4-2", "starters": [], "substitutes": []}},
        },
        "keyStatistics": {"home": dict(stats), "away": dict(stats)},
        "tacticalIdentity": {"home": identity, "away": identity},
        "players": None if players is None else [
            {"playerId": "one-alpha-aaa", "playerName": "One ALPHA", "teamId": "alpha",
             "position": "mf", "shirtNumber": 7, **blocks}],
    }


def test_a_bundle_with_players_null_contributes_no_rows_and_does_not_raise():
    """Task 2.2a. The corpus carries 0 null and 0 empty, so this is only ever a constructed
    test — and the contract declares `players` "or null when the report does not carry the
    per-player pages at all", so a guard that RAISED on null would contradict it."""
    bundle = _synthetic_bundle(players=None)
    profiles.check_bundle_shape(bundle, "constructed")
    _teams, players = profiles.index_bundles([bundle])
    profile = profiles.build_player_profile(
        "one-alpha-aaa", players["one-alpha-aaa"], {"teamCodes": {"alpha": "aaa"}})
    assert profile["matches"] == []
    assert profile["appearances"]["played"] == 0
    assert len(profile["aggregates"]) == 18
    assert profile["name"] == "One ALPHA", "identity still comes from the lineup"


def test_check_bundle_shape_names_the_missing_path_rather_than_raising_a_key_error():
    bundle = _synthetic_bundle()
    del bundle["metadata"]["lineups"]
    with pytest.raises(ProfileError, match="lineups"):
        profiles.check_bundle_shape(bundle, "constructed")
    bundle = _synthetic_bundle()
    del bundle["keyStatistics"]
    with pytest.raises(ProfileError, match="keyStatistics"):
        profiles.check_bundle_shape(bundle, "constructed")


def test_an_entity_ref_is_id_and_name_and_is_not_a_team_ref():
    """Reusing `emit._team_ref` here is schema-invalid on every row (landmine 8)."""
    assert profiles.entity_ref("alpha", "Alpha") == {"id": "alpha", "name": "Alpha"}
    with pytest.raises(UnmappedFieldError):
        profiles.check_total({"teamId": "alpha", "teamCode": "aaa", "name": "Alpha"},
                             "EntityRef", "constructed", profiles.PLAYER_DOCS)


def test_minutes_played_covers_every_substitution_shape_and_never_clamps():
    def entry(on=None, off=None):
        return {"playerId": "x", "substitutedOn": on and {"minute": on},
                "substitutedOff": off and {"minute": off}}
    assert profiles.minutes_played(entry(), "starters", 90) == 90
    assert profiles.minutes_played(entry(off=60), "starters", 90) == 60
    assert profiles.minutes_played(entry(on=76), "substitutes", 90) == 14
    assert profiles.minutes_played(entry(on=60, off=80), "substitutes", 90) == 20
    assert profiles.minutes_played(entry(), "starters", 120) == 120
    with pytest.raises(ProfileError, match="no minutes"):
        profiles.minutes_played(entry(), "substitutes", 90)
    with pytest.raises(ProfileError, match=r"outside \[0, 90\]"):
        profiles.minutes_played(entry(on=95), "substitutes", 90)


def test_stoppage_minute_is_ignored_so_a_substitution_never_exceeds_the_match(bundles):
    """Task 3.3. 122 stamps carry a non-null `stoppageMinute` and every one is discarded:
    measured 0 substitution stamps above minute 90 in a regulation match, so `minute` is
    already the clock minute and adding stoppage would push a total past the length."""
    carrying, above_ninety = 0, 0
    for bundle in bundles:
        length = _match_length(bundle)
        for side in ("home", "away"):
            for section in ("starters", "substitutes"):
                for entry in bundle["metadata"]["lineups"][side][section]:
                    for stamp in (entry.get("substitutedOn"), entry.get("substitutedOff")):
                        if not stamp:
                            continue
                        if stamp.get("stoppageMinute") is not None:
                            carrying += 1
                        if stamp["minute"] > 90 and length == 90:
                            above_ninety += 1
    assert carrying == 122, f"the stoppage population moved: {carrying}"
    assert above_ninety == 0, "a regulation substitution above minute 90 would break the rule"
    stamped = {"playerId": "x", "substitutedOn": {"minute": 89, "stoppageMinute": 4},
               "substitutedOff": None}
    assert profiles.minutes_played(stamped, "substitutes", 90) == 1, (
        "adding the 4 stoppage minutes would make this -3"
    )


def test_a_substitute_sent_on_at_the_closing_minute_plays_zero_clock_minutes(
        player_profiles, bundles):
    """**A consequence of Task 3.3's ruling that the story did not anticipate, measured and
    pinned rather than smoothed over.**

    75 substitutes are stamped at exactly the closing minute of their match — `minute: 90`
    in a regulation tie, `minute: 120` in an extra-time one — with no `substitutedOff`.
    Ignoring `stoppageMinute` (Task 3.3) makes their clock time `length - length == 0`, so
    they emit a real appearance carrying `minutesPlayed: 0`. 59 of the 75 carry a non-null
    `stoppageMinute` (1-7); the other 16 carry none at all, so this is NOT purely an
    artefact of discarding stoppage and adding it back would not remove the population.

    **The ruling stands and 0 is the honest floor**, because the alternative is worse: a
    substitution stamped `{minute: 90, stoppageMinute: 2}` in a 90-minute match would give
    `90 - 92 = -2`, which `minutes_played` correctly refuses to emit. That is the failure
    Task 3.3 predicted in as many words.

    Consequences, asserted here so they cannot drift silently: 20 players have `played > 0`
    with `minutesPlayed == 0` and therefore a null `perNinety` on every metric; no STARTER
    is ever affected; and `played == started + substituteAppearances` still holds.
    """
    zero_rows = [(pid, row["matchId"])
                 for pid, profile in player_profiles.items()
                 for row in profile["matches"] if row["minutesPlayed"] == 0]
    assert len(zero_rows) == 75, f"the closing-minute population moved: {len(zero_rows)}"
    for player_id, match_id in zero_rows:
        row = [r for r in player_profiles[player_id]["matches"]
               if r["matchId"] == match_id][0]
        assert not row["started"], "a starter can never play zero minutes"

    stamped_at_close, carrying_stoppage = 0, 0
    for bundle in bundles:
        length = _match_length(bundle)
        for side in ("home", "away"):
            for entry in bundle["metadata"]["lineups"][side]["substitutes"]:
                on = entry.get("substitutedOn")
                if on and on["minute"] == length and entry.get("substitutedOff") is None:
                    stamped_at_close += 1
                    carrying_stoppage += on["stoppageMinute"] is not None
    assert stamped_at_close == 75 and carrying_stoppage == 59

    totalling_zero = [pid for pid, p in player_profiles.items()
                      if p["appearances"]["played"] > 0
                      and p["appearances"]["minutesPlayed"] == 0]
    assert len(totalling_zero) == 20
    for player_id in totalling_zero:
        profile = player_profiles[player_id]
        assert all(a["perNinety"] is None for a in profile["aggregates"])
        assert (profile["appearances"]["played"]
                == profile["appearances"]["started"]
                + profile["appearances"]["substituteAppearances"])


def test_match_length_is_120_exactly_on_the_nine_non_regulation_matches(bundles):
    lengths = [profiles.match_length(b) for b in bundles]
    assert lengths.count(120) == 9 and lengths.count(90) == 95


# ============================================================ Task 9.10 — main(), not just the API
def test_main_returns_zero_and_writes_nothing_on_a_dry_run(repo_root, tmp_path):
    staged = tmp_path / "data"
    (staged / "matches").mkdir(parents=True)
    for path in sorted((repo_root / "data" / "matches").glob("*.json")):
        (staged / "matches" / path.name).write_bytes(path.read_bytes())
    assert profiles.main(["--data-dir", str(staged), "--dry-run",
                          "--expect-teams", "48", "--expect-players", "1248"]) == 0
    assert not (staged / "index").exists(), "a dry run wrote to the filesystem"


def test_main_returns_zero_and_writes_the_namespace_under_a_temporary_data_dir(
        repo_root, tmp_path):
    staged = tmp_path / "data"
    (staged / "matches").mkdir(parents=True)
    for path in sorted((repo_root / "data" / "matches").glob("*.json")):
        (staged / "matches" / path.name).write_bytes(path.read_bytes())
    assert profiles.main(["--data-dir", str(staged),
                          "--expect-teams", "48", "--expect-players", "1248"]) == 0
    assert len(list((staged / "index" / "team-profiles").glob("*.json"))) == 48
    assert len(list((staged / "index" / "player-profiles").glob("*.json"))) == 1248


def test_main_returns_one_on_a_dataset_finding(repo_root, tmp_path):
    staged = tmp_path / "data"
    (staged / "matches").mkdir(parents=True)
    for path in sorted((repo_root / "data" / "matches").glob("*.json")):
        (staged / "matches" / path.name).write_bytes(path.read_bytes())
    assert profiles.main(["--data-dir", str(staged), "--dry-run",
                          "--expect-teams", "47"]) == 1


def test_main_returns_one_rather_than_two_on_an_empty_input(tmp_path):
    """An empty run is never a pass, and it is a FINDING, not a broken harness."""
    (tmp_path / "data" / "matches").mkdir(parents=True)
    assert profiles.main(["--data-dir", str(tmp_path / "data")]) == 1


def test_main_returns_two_on_an_unreadable_bundle(tmp_path):
    """`json.JSONDecodeError` is a `ValueError`; unwrapped it escapes as a traceback and
    reports a broken harness as a dataset finding. Story 1.16 took a review finding for
    exactly this."""
    matches = tmp_path / "data" / "matches"
    matches.mkdir(parents=True)
    (matches / "m001-alpha-beta.json").write_text("{not json", encoding="utf-8")
    assert profiles.main(["--data-dir", str(tmp_path / "data")]) == 2


def test_the_module_runs_as_a_cli_and_does_not_crash_on_a_redirected_console(
        repo_root, tmp_path):
    """`reconfigure(errors="replace")`: without it a PDF-derived name crashes a redirected
    Windows console and destroys the exit code."""
    staged = tmp_path / "data"
    (staged / "matches").mkdir(parents=True)
    for path in sorted((repo_root / "data" / "matches").glob("*.json")):
        (staged / "matches" / path.name).write_bytes(path.read_bytes())
    result = subprocess.run(
        [sys.executable, "-m", "pipeline.precompute.profiles",
         "--data-dir", str(staged), "--dry-run"],
        cwd=repo_root, capture_output=True, env={**__import__("os").environ,
                                                 "PYTHONIOENCODING": "ascii"})
    assert result.returncode == 0, result.stderr[-2000:]


# ======================================================= Task 7.4 — the write is all-or-nothing
def test_a_failed_write_leaves_the_previous_namespace_intact(repo_root, tmp_path):
    """The named hazard is `check_committed_data` pinning a PARTIAL namespace as the
    immutability baseline. 1,296 artifacts across two directories is a far wider window
    than Story 1.16's 104, which is why the write is a staged-directory swap."""
    staged = tmp_path / "data"
    (staged / "matches").mkdir(parents=True)
    for path in sorted((repo_root / "data" / "matches").glob("*.json")):
        (staged / "matches" / path.name).write_bytes(path.read_bytes())
    profiles.emit_profiles(staged, expect_teams=48, expect_players=1248)
    before = {p.name: p.read_bytes()
              for p in (staged / "index" / "team-profiles").glob("*.json")}
    assert len(before) == 48

    before_players = {p.name: p.read_bytes()
                      for p in (staged / "index" / "player-profiles").glob("*.json")}
    assert len(before_players) == 1248

    # Corrupt one bundle so the SECOND run fails after the first has committed a namespace.
    victim = sorted((staged / "matches").glob("*.json"))[0]
    doc = json.loads(victim.read_text(encoding="utf-8"))
    del doc["metadata"]["lineups"]
    victim.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(ProfileError):
        profiles.emit_profiles(staged, expect_teams=48, expect_players=1248)
    after = {p.name: p.read_bytes()
             for p in (staged / "index" / "team-profiles").glob("*.json")}
    assert after == before, "a failed run modified the committed namespace"


def test_a_failure_DURING_THE_WRITE_leaves_BOTH_namespaces_on_the_previous_run(
        repo_root, tmp_path, monkeypatch):
    """The write path itself, which the test above cannot reach.

    **This is the test the hazard actually needed.** Its neighbour corrupts a BUNDLE, so the
    run aborts during `build` — before a single byte is written — and then compares only
    `team-profiles`, the namespace that is written FIRST and therefore survives no matter
    what. Both halves point away from the defect, and the defect was real: staging and
    swapping each kind in turn left `team-profiles` installed against the new corpus while
    `player-profiles` still held the old one, so the two directories described different
    tournaments and `check_committed_data` would pin that mixture as the AD-3 baseline.

    Failing on a player artifact is the load-bearing choice: it is the second namespace, so
    it can only be reached once the team swap has already happened.
    """
    staged = tmp_path / "data"
    (staged / "matches").mkdir(parents=True)
    for path in sorted((repo_root / "data" / "matches").glob("*.json")):
        (staged / "matches" / path.name).write_bytes(path.read_bytes())
    profiles.emit_profiles(staged, expect_teams=48, expect_players=1248)

    index = staged / "index"
    before = {kind: {p.name: p.read_bytes() for p in (index / kind).glob("*.json")}
              for kind in ("team-profiles", "player-profiles")}
    assert len(before["team-profiles"]) == 48 and len(before["player-profiles"]) == 1248

    # Change the corpus so a successful run WOULD rewrite both namespaces — otherwise a
    # no-op run would pass this test without the rollback doing anything.
    victim = sorted((staged / "matches").glob("*.json"))[0]
    doc = json.loads(victim.read_text(encoding="utf-8"))
    doc["keyStatistics"]["home"]["possession"] += 3.0
    victim.write_text(json.dumps(doc), encoding="utf-8")

    real_write = profiles.write_canonical
    calls = {"n": 0}

    def exploding_write(obj, path):
        calls["n"] += 1
        if path.parent.name.startswith("player-profiles") and calls["n"] > 48 + 500:
            raise OSError("simulated disk failure part-way through the player namespace")
        return real_write(obj, path)

    monkeypatch.setattr(profiles, "write_canonical", exploding_write)
    with pytest.raises(OSError):
        profiles.emit_profiles(staged, expect_teams=48, expect_players=1248)

    after = {kind: {p.name: p.read_bytes() for p in (index / kind).glob("*.json")}
             for kind in ("team-profiles", "player-profiles")}
    assert after["team-profiles"] == before["team-profiles"], (
        "the TEAM namespace was swapped in and left there while the player write failed; "
        "the two namespaces now describe different corpora"
    )
    assert after["player-profiles"] == before["player-profiles"], (
        "the player namespace was modified by a run that failed"
    )
    leftovers = sorted(p.name for p in index.iterdir() if p.name not in
                       ("team-profiles", "player-profiles"))
    assert not leftovers, (
        f"a failed run left {leftovers!r} inside the committed data/index/ tree; an "
        f"untracked partial namespace there can be swept into a commit"
    )


def test_the_swap_removes_an_artifact_the_run_did_not_produce(repo_root, tmp_path):
    staged = tmp_path / "data"
    (staged / "matches").mkdir(parents=True)
    for path in sorted((repo_root / "data" / "matches").glob("*.json")):
        (staged / "matches" / path.name).write_bytes(path.read_bytes())
    profiles.emit_profiles(staged, expect_teams=48, expect_players=1248)
    orphan = staged / "index" / "team-profiles" / "atlantis.json"
    orphan.write_text("{}", encoding="utf-8")
    profiles.emit_profiles(staged, expect_teams=48, expect_players=1248)
    assert not orphan.exists(), "a stale artifact survived and would be PINNED as baseline"

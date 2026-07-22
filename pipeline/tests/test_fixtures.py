"""Every committed fixture validates, and covers the edge shapes (Story 1.1, Task 8; AC 4-6).

data/fixtures/ is what unblocks Epic 2 (AD-14): Story 2.1 and everything after it build
against these files before the pipeline emits a single real bundle. So the fixtures are held
to the same bar as real output -- schema-valid, correctly identified, canonically
serialized -- and to one more besides: they must actually exercise the awkward shapes
(`momentum: null`, a shoot-out, an own goal), because a fixture set that only covers the
happy path lets Epic 2 build a surface that breaks the first time real data arrives.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from pipeline.validate.errors import SchemaValidationError
from pipeline.validate.schema import schema_version, validate_artifact

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "data" / "fixtures"

# AD-3's identity patterns, restated here on purpose. The schemas enforce them against the
# fixtures; this module enforces them against the schemas' own claim, so a loosened pattern
# cannot quietly let a malformed slug through both layers at once.
TEAM_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
MATCH_ID_RE = re.compile(r"^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$")
PLAYER_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$")

MATCH_FIXTURES = sorted((FIXTURES_DIR / "matches").glob("*.json"))
INDEX_FIXTURES = sorted((FIXTURES_DIR / "index").rglob("*.json"))

SCHEMA_FOR_INDEX = {
    "tournament.json": "tournament.schema.json",
    "leaderboards.json": "leaderboards.schema.json",
}


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _schema_for(path: Path) -> str:
    if path.parent.name == "matches":
        return "match-bundle.schema.json"
    if path.parent.name == "team-profiles":
        return "team-profile.schema.json"
    if path.parent.name == "player-profiles":
        return "player-profile.schema.json"
    return SCHEMA_FOR_INDEX[path.name]


def _ids(node, key):
    """Every value of `key` anywhere in a nested structure."""
    found = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k == key and isinstance(v, str):
                found.append(v)
            found.extend(_ids(v, key))
    elif isinstance(node, list):
        for v in node:
            found.extend(_ids(v, key))
    return found


ALL_FIXTURES = MATCH_FIXTURES + INDEX_FIXTURES


def test_the_fixture_set_is_present_and_complete() -> None:
    """AC 4: at least one full Match Bundle and one instance of every index artifact."""
    assert len(MATCH_FIXTURES) >= 1, "no match bundle fixtures"
    kinds = {p.parent.name if p.parent.name != "index" else p.name for p in INDEX_FIXTURES}
    assert kinds == {
        "tournament.json",
        "leaderboards.json",
        "team-profiles",
        "player-profiles",
    }, f"index fixtures incomplete: {sorted(kinds)}"


@pytest.mark.parametrize("path", ALL_FIXTURES, ids=lambda p: p.name)
def test_every_fixture_validates_against_its_schema(path: Path) -> None:
    try:
        validate_artifact(_load(path), _schema_for(path), path.name)
    except SchemaValidationError as exc:
        pytest.fail(str(exc))


@pytest.mark.parametrize("path", ALL_FIXTURES, ids=lambda p: p.name)
def test_every_fixture_is_stamped_with_the_declared_schema_version(path: Path) -> None:
    assert _load(path)["schemaVersion"] == schema_version()


@pytest.mark.parametrize("path", ALL_FIXTURES, ids=lambda p: p.name)
def test_every_id_in_every_fixture_matches_its_ad_3_pattern(path: Path) -> None:
    fixture = _load(path)
    for value in _ids(fixture, "matchId"):
        assert MATCH_ID_RE.match(value), f"{path.name}: bad matchId {value!r}"
    for key in ("teamId", "winnerTeamId"):
        for value in _ids(fixture, key):
            assert TEAM_ID_RE.match(value), f"{path.name}: bad {key} {value!r}"
    for key in ("playerId", "scorerPlayerId", "fromPlayerId", "toPlayerId"):
        for value in _ids(fixture, key):
            assert PLAYER_ID_RE.match(value), f"{path.name}: bad {key} {value!r}"


@pytest.mark.parametrize("path", ALL_FIXTURES, ids=lambda p: p.name)
def test_every_fixture_round_trips_byte_identically_through_the_canonical_serializer(
    path: Path,
) -> None:
    """AD-8. Sorted keys, indent 2, UTF-8, LF, trailing newline.

    Byte-identity is the whole point: it is what lets a re-run over an unchanged corpus be
    diffed against the last one and show nothing.
    """
    raw = path.read_bytes()
    assert b"\r\n" not in raw, f"{path.name} has CRLF line endings"
    text = raw.decode("utf-8")
    canonical = json.dumps(json.loads(text), indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    assert text == canonical, f"{path.name} is not canonically serialized"


@pytest.mark.parametrize("path", ALL_FIXTURES, ids=lambda p: p.name)
def test_no_fixture_exceeds_the_per_artifact_budget(path: Path) -> None:
    """AD-4's 500 KB per-artifact budget, as an early read rather than the enforcing gate.

    The real gate measures canonical bytes over real data and fails the run on breach; that
    is Story 1.16. A *fixture* already over budget would mean the bundle shape itself does
    not fit, which is far cheaper to learn now than at 1.16.
    """
    size = path.stat().st_size
    assert size <= 500 * 1024, f"{path.name} is {size / 1024:.1f} KiB, over the 500 KB budget"


# --------------------------------------------------------------------- edge-shape coverage


def _bundles() -> "dict[str, dict]":
    return {path.name: _load(path) for path in MATCH_FIXTURES}


def test_a_bundle_carries_momentum_as_an_explicit_null() -> None:
    """AD-4: `momentum` is required, never omitted, never `[]`.

    `null` is the empty state the App renders; an absent key or an empty array would both be
    indistinguishable from "we have a series with nothing in it".
    """
    bundles = _bundles()
    assert any(b["momentum"] is None for b in bundles.values()), (
        "no fixture covers momentum: null"
    )
    for name, bundle in bundles.items():
        assert "momentum" in bundle, f"{name} omits the required momentum key"
        assert bundle["momentum"] != [], f"{name} uses [] for momentum instead of null"


def test_a_bundle_carries_a_momentum_series() -> None:
    bundles = _bundles()
    with_series = [b for b in bundles.values() if b["momentum"] is not None]
    assert with_series, "no fixture covers a populated momentum series"
    for bundle in with_series:
        assert bundle["momentum"]["samples"], "momentum series is present but empty"


def test_a_bundle_covers_a_knockout_decided_by_extra_time_and_a_shootout() -> None:
    """AC 5's knockout edge shape, checked end to end rather than by `decidedBy` alone."""
    bundles = _bundles()
    shootouts = [
        b for b in bundles.values()
        if b["metadata"]["knockoutScore"]["decidedBy"] == "shootout"
    ]
    assert shootouts, "no fixture covers decidedBy: shootout"
    for bundle in shootouts:
        knockout = bundle["metadata"]["knockoutScore"]
        assert knockout["scoreAfterET"] is not None, "a shoot-out tie must record its ET score"
        assert knockout["shootoutScore"] is not None
        assert knockout["winnerTeamId"] is not None, "a shoot-out always has a winner"
        home, away = knockout["shootoutScore"]["home"], knockout["shootoutScore"]["away"]
        assert home != away, "a shoot-out cannot end level"
        winner_is_home = knockout["winnerTeamId"] == bundle["metadata"]["homeTeam"]["teamId"]
        assert winner_is_home == (home > away), "winnerTeamId disagrees with shootoutScore"


def test_a_bundle_carries_shootout_attempt_rows() -> None:
    bundles = _bundles()
    with_attempts = [
        b for b in bundles.values() if b["events"]["shootoutAttempts"]
    ]
    assert with_attempts, "no fixture covers ShootoutAttempt rows"
    for bundle in with_attempts:
        attempts = bundle["events"]["shootoutAttempts"]
        orders = [a["order"] for a in attempts]
        assert orders == sorted(orders), "shoot-out attempts are not in taking order"
        assert orders == list(range(1, len(orders) + 1)), "shoot-out order is not 1..n"
        knockout = bundle["metadata"]["knockoutScore"]["shootoutScore"]
        home_id = bundle["metadata"]["homeTeam"]["teamId"]
        scored_home = sum(
            1 for a in attempts if a["teamId"] == home_id and a["outcome"] == "scored"
        )
        scored_away = sum(
            1 for a in attempts if a["teamId"] != home_id and a["outcome"] == "scored"
        )
        assert (scored_home, scored_away) == (knockout["home"], knockout["away"]), (
            "shoot-out attempt outcomes do not add up to the recorded shootoutScore"
        )


def test_a_bundle_carries_a_shot_event_flagged_as_an_own_goal() -> None:
    """AC 5's own-goal shape, plus AD-6's attribution rule.

    The shot belongs to the player who took it; the goal is credited to the team that
    benefited. Getting that backwards would put the goal on the wrong side of the scoreline.
    """
    bundles = _bundles()
    found = False
    for name, bundle in bundles.items():
        own_goal_shots = [s for s in bundle["events"]["shots"] if s["ownGoal"]]
        own_goals = [g for g in bundle["metadata"]["goals"] if g["ownGoal"]]
        if not own_goal_shots:
            continue
        found = True
        assert own_goals, f"{name} has an own-goal shot but no matching goal record"
        for goal in own_goals:
            scorer_team = next(
                s["teamId"] for s in own_goal_shots if s["playerId"] == goal["scorerPlayerId"]
            )
            assert goal["teamId"] != scorer_team, (
                f"{name}: an own goal must be credited to the team that did NOT score it"
            )
    assert found, "no fixture covers a ShotEvent with ownGoal: true"


def test_a_bundle_covers_a_group_match() -> None:
    bundles = _bundles()
    group_matches = [b for b in bundles.values() if b["metadata"]["stage"] == "group"]
    assert group_matches, "no fixture covers a group match"
    for bundle in group_matches:
        assert bundle["metadata"]["group"] is not None, "a group match must name its group"


# --------------------------------------------------------------- internal consistency


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_the_scoreline_agrees_with_the_goal_records(path: Path) -> None:
    bundle = _load(path)
    home_id = bundle["metadata"]["homeTeam"]["teamId"]
    away_id = bundle["metadata"]["awayTeam"]["teamId"]
    goals = bundle["metadata"]["goals"]
    assert bundle["metadata"]["score"]["home"] == sum(1 for g in goals if g["teamId"] == home_id)
    assert bundle["metadata"]["score"]["away"] == sum(1 for g in goals if g["teamId"] == away_id)


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_defensive_block_distribution_mirrors_the_three_block_phases(path: Path) -> None:
    """The two copies share one source, so they must never disagree.

    `defensiveBlockDistribution` exists because Story 2.10 renders block height as its own
    concept, but the Phases of Play page is the only place either value comes from.
    """
    bundle = _load(path)
    for side in ("home", "away"):
        tactical = bundle["tacticalIdentity"][side]
        phases = tactical["phasesOutOfPossession"]
        block = tactical["defensiveBlockDistribution"]
        assert block == {
            "high": phases["highBlock"],
            "mid": phases["midBlock"],
            "low": phases["lowBlock"],
        }, f"{path.name} {side}: block distribution has drifted from the phase values"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_story_stats_agree_with_the_key_statistics_they_summarize(path: Path) -> None:
    """FR-21's five Hero tiles are precomputed, but they still have to be the same numbers."""
    bundle = _load(path)
    for side in ("home", "away"):
        story = bundle["storyStats"][side]
        key = bundle["keyStatistics"][side]
        assert story["possession"] == key["possession"]
        assert story["shots"] == key["shots"]
        assert story["expectedGoals"] == key["expectedGoals"]
        assert story["distanceCovered"] == key["distanceCovered"]


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_story_stats_carry_exactly_the_five_hero_fields(path: Path) -> None:
    """Story 2.4 renders exactly five tiles; a sixth field or a missing one breaks it."""
    bundle = _load(path)
    for side in ("home", "away"):
        assert set(bundle["storyStats"][side]) == {
            "possession",
            "shots",
            "expectedGoals",
            "distanceCovered",
            "topSpeed",
        }


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_every_event_names_a_team_that_is_playing_in_this_match(path: Path) -> None:
    """AD-6 requires an explicit teamId on every spatial event; it has to be a real one."""
    bundle = _load(path)
    valid = {bundle["metadata"]["homeTeam"]["teamId"], bundle["metadata"]["awayTeam"]["teamId"]}
    for table, rows in bundle["events"].items():
        for row in rows or []:
            assert row["teamId"] in valid, f"{path.name}: {table} references {row['teamId']!r}"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_every_spatial_event_sits_inside_the_pitch_frame(path: Path) -> None:
    """AD-6: 0-100 over the full pitch rectangle, both axes."""
    bundle = _load(path)
    for table in ("shots", "crosses", "passNetworkNodes", "receiving", "defensiveActions"):
        for row in bundle["events"][table] or []:
            assert 0 <= row["x"] <= 100, f"{path.name}: {table} x out of frame"
            assert 0 <= row["y"] <= 100, f"{path.name}: {table} y out of frame"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_every_event_player_appears_in_a_team_sheet(path: Path) -> None:
    """A marker the App cannot link back to a Player Profile is a dead end in the UI."""
    bundle = _load(path)
    known = set()
    for side in ("home", "away"):
        lineup = bundle["metadata"]["lineups"][side]
        for entry in lineup["starters"] + lineup["substitutes"]:
            known.add(entry["playerId"])

    for table, rows in bundle["events"].items():
        for row in rows or []:
            for key in ("playerId", "fromPlayerId", "toPlayerId"):
                if key in row:
                    assert row[key] in known, (
                        f"{path.name}: {table} references unknown player {row[key]!r}"
                    )
    for record in bundle["players"]:
        assert record["playerId"] in known, f"{path.name}: player record off the team sheet"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_shot_outcome_counts_agree_with_the_key_statistics_on_target_total(path: Path) -> None:
    """The marker-count self-validation Story 1.3 will automate, applied to the fixtures.

    Own goals are excluded: they are not an attempt at goal by the team credited with them.
    """
    bundle = _load(path)
    for side in ("home", "away"):
        team_id = bundle["metadata"][f"{side}Team"]["teamId"]
        shots = [
            s
            for s in bundle["events"]["shots"]
            if s["teamId"] == team_id and not s["ownGoal"]
        ]
        on_target = sum(1 for s in shots if s["outcome"] in ("goal", "on-target"))
        key = bundle["keyStatistics"][side]
        assert len(shots) == key["shots"], f"{path.name} {side}: shot count"
        assert on_target == key["shotsOnTarget"], f"{path.name} {side}: on-target count"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_pass_network_edges_join_players_who_have_a_node(path: Path) -> None:
    bundle = _load(path)
    nodes = {(n["teamId"], n["playerId"]) for n in bundle["events"]["passNetworkNodes"]}
    for edge in bundle["events"]["passNetworkEdges"]:
        assert (edge["teamId"], edge["fromPlayerId"]) in nodes, f"{path.name}: dangling edge"
        assert (edge["teamId"], edge["toPlayerId"]) in nodes, f"{path.name}: dangling edge"


def test_the_tournament_entity_index_resolves_to_the_artifacts_that_exist() -> None:
    """AR-4's bijection, scoped to the fixture world.

    The fixture set is deliberately partial -- standings name teams with no profile, and that
    is intentional. What must hold is the other direction: every artifact that exists is
    listed, so the route manifest never omits a page that has data behind it. The full
    bijection is asserted against real /data in Story 1.17.
    """
    tournament = _load(FIXTURES_DIR / "index" / "tournament.json")
    entities = tournament["entities"]

    listed_matches = {m["matchId"] for m in entities["matches"]}
    on_disk_matches = {p.stem for p in MATCH_FIXTURES}
    assert on_disk_matches <= listed_matches, (
        f"match bundles missing from the entity index: {sorted(on_disk_matches - listed_matches)}"
    )

    listed_teams = {t["teamId"] for t in entities["teams"]}
    on_disk_teams = {p.stem for p in (FIXTURES_DIR / "index" / "team-profiles").glob("*.json")}
    assert on_disk_teams <= listed_teams

    listed_players = {p["playerId"] for p in entities["players"]}
    on_disk_players = {
        p.stem for p in (FIXTURES_DIR / "index" / "player-profiles").glob("*.json")
    }
    assert on_disk_players <= listed_players


def test_group_standings_are_internally_consistent_and_explicitly_ranked() -> None:
    """AD-4 requires an explicit pipeline-computed rank; the App never derives it."""
    tournament = _load(FIXTURES_DIR / "index" / "tournament.json")
    for table in tournament["groups"]:
        rows = table["standings"]
        assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1)), "ranks are not 1..n"
        for row in rows:
            assert row["played"] == row["won"] + row["drawn"] + row["lost"]
            assert row["points"] == row["won"] * 3 + row["drawn"]
            assert row["goalDifference"] == row["goalsFor"] - row["goalsAgainst"]
            assert len(row["form"]) == row["played"], "form sequence is not one entry per match"
            assert sum(1 for f in row["form"] if f == "win") == row["won"]
            assert sum(1 for f in row["form"] if f == "draw") == row["drawn"]
            assert sum(1 for f in row["form"] if f == "loss") == row["lost"]


def test_every_leaderboard_is_ranked_in_order_and_uses_a_closed_metric_code() -> None:
    leaderboards = _load(FIXTURES_DIR / "index" / "leaderboards.json")
    assert leaderboards["boards"], "leaderboards fixture has no boards"
    scopes = {b["scope"] for b in leaderboards["boards"]}
    assert {"team", "player"} <= scopes, "fixtures must cover a team board and a player board"
    for board in leaderboards["boards"]:
        rows = board["rows"]
        assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1))
        values = [r["value"] for r in rows]
        assert values == sorted(values, reverse=board["higherIsBetter"]), (
            f"{board['metricCode']} rows are not in rank order"
        )


def test_profile_per_match_rows_link_back_to_a_match() -> None:
    """Every per-match value must name the match it came from (mandatory cross-link)."""
    for path in INDEX_FIXTURES:
        if path.parent.name not in ("team-profiles", "player-profiles"):
            continue
        fixture = _load(path)
        assert fixture["matches"], f"{path.name} has no per-match breakdown"
        for row in fixture["matches"]:
            assert MATCH_ID_RE.match(row["matchId"]), f"{path.name}: bad matchId"


def test_the_fixtures_readme_exists_and_documents_provenance() -> None:
    """AC 4 requires the fixture world's partiality to be written down, not just true."""
    readme = FIXTURES_DIR / "README.md"
    assert readme.exists(), "data/fixtures/README.md is missing"
    text = readme.read_text(encoding="utf-8")
    for topic in ("AD-14", "synthetic", "provenance"):
        assert topic.lower() in text.lower(), f"fixtures README does not cover {topic}"

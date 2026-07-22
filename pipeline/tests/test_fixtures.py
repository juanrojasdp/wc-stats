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
from pipeline.validate.schema import load_schemas, schema_version, validate_artifact

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "data" / "fixtures"

# AD-3's identity patterns, restated here on purpose. The schemas enforce them against the
# fixtures; this module enforces them against the schemas' own claim, so a loosened pattern
# cannot quietly let a malformed slug through both layers at once.
# `\Z`, not `$`: Python's `$` also matches immediately before a trailing newline, so a slug
# ending in one would satisfy this restatement AND the schema pattern, while ECMA-262 -- the
# regex dialect JSON Schema actually mandates -- rejects it. Without `\Z` the Python gate is
# strictly weaker than the dialect it claims to implement, and a team id carrying a trailing
# newline reaches the App as a URL.
TEAM_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*\Z")
MATCH_ID_RE = re.compile(r"^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*\Z")
PLAYER_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}\Z")

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
    if path.name not in SCHEMA_FOR_INDEX:
        # A bare KeyError here surfaces inside three parametrized tests as an unexplained
        # crash. Adding an artifact under index/ should say what is missing.
        raise AssertionError(
            f"{path.relative_to(FIXTURES_DIR)} has no schema mapping. Add it to "
            f"SCHEMA_FOR_INDEX (known: {sorted(SCHEMA_FOR_INDEX)}) -- a new index artifact "
            f"is an AD-4 contract change, not a detail."
        )
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


def _entity_refs(node, scope: str | None = None) -> "list[tuple[str, str]]":
    """Every EntityRef in a structure, paired with the kind of entity it points at.

    `EntityRef.id` is typed with the loose team pattern, because one shape serves matches,
    teams and players. That means the schema layer CANNOT tell a malformed player slug from
    a valid team slug, so the test layer has to -- and it did not: `leaderboards.json` holds
    64 EntityRefs and the id test asserted nothing about any of them, because it looks for
    keys named `playerId`/`teamId` and an EntityRef's key is just `id`. A player row whose
    slug lost its team code validated cleanly and produced a route that resolves to nothing.
    """
    found: list[tuple[str, str]] = []
    if isinstance(node, dict):
        inherited = node.get("scope", scope)
        if "id" in node and "name" in node and isinstance(node.get("id"), str):
            found.append((node["id"], inherited or "unknown"))
        for key, value in node.items():
            # A board's rows describe entities of the board's own scope; its `team` column is
            # always a team regardless.
            child_scope = "team" if key == "team" else inherited
            found.extend(_entity_refs(value, child_scope))
    elif isinstance(node, list):
        for value in node:
            found.extend(_entity_refs(value, scope))
    return found


@pytest.mark.parametrize("path", INDEX_FIXTURES, ids=lambda p: p.name)
def test_every_entity_ref_slug_matches_the_pattern_for_the_kind_it_names(path: Path) -> None:
    """EntityRef ids are checked against the pattern for what they actually point at."""
    refs = _entity_refs(_load(path))
    assert refs, f"{path.name} carries no EntityRef -- the walker is looking in the wrong place"
    for value, kind in refs:
        if kind == "player":
            assert PLAYER_ID_RE.match(value), (
                f"{path.name}: {value!r} is a player reference but is not a "
                f"{{surname}}-{{givenName}}-{{teamCode}} slug (AD-3)"
            )
        else:
            assert TEAM_ID_RE.match(value), f"{path.name}: bad entity id {value!r}"


@pytest.mark.parametrize("path", ALL_FIXTURES, ids=lambda p: p.name)
def test_no_fixture_carries_a_non_finite_number(path: Path) -> None:
    """NaN and Infinity pass every other gate in this file and then break the browser.

    Python's `json` accepts bare `NaN`/`Infinity` on read AND re-emits them byte-identically,
    so the canonical round-trip test is satisfied; `jsonschema` accepts `float('nan')`
    against `{"type": "number", "minimum": 0, "maximum": 100}` because every comparison with
    NaN is false. The value reaches the App and `JSON.parse` throws -- the one consumer that
    is not lenient. Nothing else in the stack looks for this.
    """
    def walk(node, pointer="") -> "list[str]":
        bad = []
        if isinstance(node, float) and (node != node or node in (float("inf"), float("-inf"))):
            bad.append(f"{pointer} = {node!r}")
        elif isinstance(node, dict):
            for key, value in node.items():
                bad.extend(walk(value, f"{pointer}/{key}"))
        elif isinstance(node, list):
            for index, value in enumerate(node):
                bad.extend(walk(value, f"{pointer}/{index}"))
        return bad

    offenders = walk(_load(path))
    assert offenders == [], f"{path.name} carries non-finite numbers:\n" + "\n".join(offenders)


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
    # 500 KB decimal, matching how AD-4 and both READMEs state the budget. The previous
    # `500 * 1024` measured KiB, so a 505,000-byte artifact passed a gate documented to
    # reject it -- a 2.4% slack that Story 1.16 would have inherited as the enforcing gate.
    budget = 500_000
    size = path.stat().st_size
    assert size <= budget, (
        f"{path.name} is {size:,} bytes ({size / 1000:.1f} KB), over the 500 KB budget"
    )


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
    """Ranks are competition-style, and the metric code really is from the closed enum.

    Two things this test is named for but did not do. It never looked at `metricCode` at
    all, so an unknown code would have sailed through the layer whose whole job is to catch
    it. And it asserted `rank == 1..n`, which FORBIDS the tied ranks the schema mandates --
    LeaderboardRow states that "ties are represented honestly rather than implied by array
    order (AD-5)", and the topSpeed board really does have several players sharing a value.
    """
    metric_codes = set(
        load_schemas()["common.schema.json"]["$defs"]["MetricCode"]["enum"]
    )
    leaderboards = _load(FIXTURES_DIR / "index" / "leaderboards.json")
    assert leaderboards["boards"], "leaderboards fixture has no boards"
    scopes = {b["scope"] for b in leaderboards["boards"]}
    assert {"team", "player"} <= scopes, "fixtures must cover a team board and a player board"

    for board in leaderboards["boards"]:
        code = board["metricCode"]
        assert code in metric_codes, f"{code!r} is not a closed MetricCode value"

        rows = board["rows"]
        values = [r["value"] for r in rows]
        assert values == sorted(values, reverse=board["higherIsBetter"]), (
            f"{code} rows are not in rank order"
        )

        # Competition ranking: equal values share the lower rank, and the next distinct value
        # skips to its ordinal position (1,2,2,4 - never 1,2,2,3).
        expected: list[int] = []
        for index, value in enumerate(values, start=1):
            if index > 1 and value == values[index - 2]:
                expected.append(expected[-1])
            else:
                expected.append(index)
        assert [r["rank"] for r in rows] == expected, (
            f"{code} ranks do not represent ties honestly: "
            f"{[r['rank'] for r in rows]} != {expected}"
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


# ------------------------------------------------- cross-field and reconciliation invariants
#
# Everything below defends a relationship BETWEEN fields. None of it is expressible in the
# schema: `if`/`then` would say it, but json-schema-to-typescript compiles an if/then branch
# to an open object and reintroduces the `[k: string]: unknown` index signature the AD-2
# codegen spike exists to prevent. So the schema documents the invariant and pytest enforces
# it -- pytest is the gate either way.


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_knockout_score_agrees_with_decided_by(path: Path) -> None:
    """`decidedBy` drives the Hero display, so it must match the periods actually played."""
    score = _load(path)["metadata"]["knockoutScore"]
    decided = score["decidedBy"]
    if decided == "regulation":
        assert score["scoreAfterET"] is None, f"{path.name}: regulation tie carries scoreAfterET"
        assert score["shootoutScore"] is None, f"{path.name}: regulation tie carries a shootout"
    elif decided == "extra-time":
        assert score["scoreAfterET"] is not None, f"{path.name}: extra-time tie has no scoreAfterET"
        assert score["shootoutScore"] is None, f"{path.name}: extra-time tie carries a shootout"
    else:
        assert score["scoreAfterET"] is not None, f"{path.name}: shootout tie has no scoreAfterET"
        assert score["shootoutScore"] is not None, f"{path.name}: shootout tie has no shootoutScore"
        assert score["winnerTeamId"] is not None, f"{path.name}: shootout tie has no winner"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_the_match_id_agrees_with_its_filename_and_its_own_metadata(path: Path) -> None:
    """`matchId` is a composite key whose parts are duplicated; nothing tied them together.

    The pattern cannot relate the `NNN` to `metadata.matchNumber` or the slug halves to the
    two team ids, so `m074-germany-paraguay` with `matchNumber: 12` and a home team of Brazil
    validated cleanly -- and the entity-index test compares file STEMS, never content, so the
    route the App generates and the bundle it fetches could disagree in silence.
    """
    bundle = _load(path)
    match_id = bundle["matchId"]
    assert match_id == path.stem, f"{path.name}: matchId {match_id!r} != filename"
    number, _, slug = match_id.partition("-")
    assert int(number[1:]) == bundle["metadata"]["matchNumber"], (
        f"{path.name}: matchId says match {int(number[1:])}, metadata says "
        f"{bundle['metadata']['matchNumber']}"
    )
    home = bundle["metadata"]["homeTeam"]["teamId"]
    away = bundle["metadata"]["awayTeam"]["teamId"]
    assert slug == f"{home}-{away}", f"{path.name}: matchId slug {slug!r} != {home}-{away}"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_the_stage_and_matchday_round_describe_the_same_match(path: Path) -> None:
    """`stage: "final"` with `matchdayRound: "group-md1"` was a legal bundle."""
    metadata = _load(path)["metadata"]
    stage, round_code = metadata["stage"], metadata["matchdayRound"]
    if stage == "group":
        assert round_code.startswith("group-md"), f"{path.name}: {stage} / {round_code}"
        assert metadata["group"] is not None, f"{path.name}: a group match with no group letter"
    else:
        assert round_code == stage, f"{path.name}: stage {stage} but round {round_code}"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_no_event_in_a_regulation_match_runs_past_the_ninety_minute_clock(path: Path) -> None:
    """Stoppage time is (minute, stoppageMinute), never a raw minute past the period end.

    `Minute`'s `maximum: 120` accepts 92 in a match that played no extra time, so three shots
    in m002 sat at minute 92/93 with `stoppageMinute: null` -- directly against logged
    decision 7, and invisible to every other check. Ordering by the pair (which the roving
    tabindex depends on) and the App's "90+2" label are both built on the pair being used.
    """
    bundle = _load(path)
    if bundle["metadata"]["knockoutScore"]["decidedBy"] != "regulation":
        pytest.skip("extra time was played, so minutes past 90 are real clock minutes")
    offenders = []

    def walk(node, pointer=""):
        if isinstance(node, dict):
            if "minute" in node and "stoppageMinute" in node and node["minute"] > 90:
                offenders.append(f"{pointer} = minute {node['minute']}")
            for key, value in node.items():
                walk(value, f"{pointer}/{key}")
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{pointer}/{index}")

    walk(bundle)
    assert offenders == [], (
        f"{path.name} stores stoppage time as a raw minute past 90:\n" + "\n".join(offenders)
    )


def test_at_least_one_fixture_exercises_the_stoppage_minute_integer_branch() -> None:
    """`StoppageMinute` is `integer | null` and every stamp in every bundle was null.

    The null arm alone leaves the App's "90+n" label composition and the (minute,
    stoppageMinute) marker ordering built against a shape no fixture contains.
    """
    seen = []

    def walk(node):
        if isinstance(node, dict):
            if isinstance(node.get("stoppageMinute"), int):
                seen.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    for bundle in _bundles().values():
        walk(bundle)
    assert seen, "no fixture carries a non-null stoppageMinute"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_shot_outcome_agrees_with_its_finer_outcome_detail(path: Path) -> None:
    """The 22 detail values map onto the 5 outcomes, and the map is NOT derivable by prefix.

    `incomplete-blocked` maps to `blocked` while every other `incomplete-*` maps to
    `incomplete`, so a consumer deriving one from the other by prefix is wrong on the whole
    blocked family. The mapping now lives machine-readably in the schema; this holds the
    fixtures to it, so an outcome/detail pair that contradicts itself no longer validates at
    every layer.
    """
    common = load_schemas()["common.schema.json"]
    detail_def = common["$defs"]["ShotOutcomeDetail"]
    mapping = detail_def["x-maps-to-outcome"]
    assert set(mapping) == set(detail_def["enum"]), (
        "x-maps-to-outcome does not cover exactly the ShotOutcomeDetail enum"
    )
    outcomes = set(common["$defs"]["ShotOutcome"]["enum"])
    assert set(mapping.values()) <= outcomes, "x-maps-to-outcome names an unknown ShotOutcome"

    for index, shot in enumerate(_load(path)["events"]["shots"] or []):
        assert shot["outcome"] == mapping[shot["outcomeDetail"]], (
            f"{path.name} shot {index}: outcomeDetail {shot['outcomeDetail']!r} maps to "
            f"{mapping[shot['outcomeDetail']]!r}, but outcome says {shot['outcome']!r}"
        )


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_domain_g_player_totals_reconcile_with_the_domain_b_team_totals(path: Path) -> None:
    """The per-player rows and the team's Key Statistics are rendered on the same page.

    They disagreed by up to 8x in every fixture -- South Africa's team `shots: 3` against 37
    across its player rows. Domain B is read off the report and Domain G is synthetic, so the
    synthetic side is what must add up. A developer who spots the discrepancy cannot tell
    whether it is their bug or the fixture's.
    """
    bundle = _load(path)
    stats = bundle["keyStatistics"]
    pairs = [
        ("inPossession", "passesAttempted", "passes"),
        ("inPossession", "passesCompleted", "passesCompleted"),
        ("inPossession", "crossesAttempted", "crosses"),
        ("inPossession", "ballProgressions", "ballProgressions"),
        ("inPossession", "lineBreaksCompleted", "completedLineBreaks"),
    ]
    for side in ("home", "away"):
        team_id = bundle["metadata"][f"{side}Team"]["teamId"]
        squad = [p for p in bundle["players"] if p["teamId"] == team_id]
        assert squad, f"{path.name}: no player records for {team_id}"
        for block, field, team_field in pairs:
            total = sum(p[block][field] for p in squad)
            assert total == stats[side][team_field], (
                f"{path.name}/{side}: players sum to {total} {field}, "
                f"Key Statistics says {stats[side][team_field]} {team_field}"
            )
        # Attempts at goal come from the real event table. An own goal is not an attempt:
        # the printed count excludes it and AD-6 excludes it from the shot map.
        attempts = sum(
            1
            for s in (bundle["events"]["shots"] or [])
            if s["teamId"] == team_id and not s["ownGoal"]
        )
        assert attempts == stats[side]["shots"], (
            f"{path.name}/{side}: {attempts} shot events, Key Statistics says "
            f"{stats[side]['shots']}"
        )
        assert sum(p["inPossession"]["attemptsAtGoal"] for p in squad) == attempts
        metres = sum(p["physical"]["totalDistance"] for p in squad)
        assert abs(metres / 1000 - stats[side]["distanceCovered"]) < 0.01, (
            f"{path.name}/{side}: players cover {metres / 1000:.2f} km, "
            f"Key Statistics says {stats[side]['distanceCovered']} km"
        )


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_the_three_possession_shares_sum_to_one_hundred(path: Path) -> None:
    """Home, contested and away DO partition possession -- unlike the phase percentages.

    The README states this as fact and nothing checked it; m002 shipped summing to 100.1,
    which is enough to overflow a three-segment bar. m001 and m074 summed to exactly 100, so
    a spot check on one fixture would have missed it.
    """
    stats = _load(path)["keyStatistics"]
    total = stats["home"]["possession"] + stats["contestedPossession"] + stats["away"]["possession"]
    assert round(total, 1) == 100.0, f"{path.name}: possession shares sum to {total:.1f}"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_every_pass_network_node_is_at_least_as_involved_as_its_own_edges(path: Path) -> None:
    """`involvement` is passes made plus received; an incident edge is a subset of those.

    Roughly 45% of nodes carried an involvement SMALLER than the sum of their own edges --
    arithmetically impossible, and it inverts the DESIGN.md encoding, since node size would
    render smallest exactly where the strokes are thickest.
    """
    bundle = _load(path)
    incident: dict[str, int] = {}
    for edge in bundle["events"]["passNetworkEdges"] or []:
        incident[edge["fromPlayerId"]] = incident.get(edge["fromPlayerId"], 0) + edge["volume"]
        incident[edge["toPlayerId"]] = incident.get(edge["toPlayerId"], 0) + edge["volume"]
    for node in bundle["events"]["passNetworkNodes"] or []:
        floor = incident.get(node["playerId"], 0)
        assert node["involvement"] >= floor, (
            f"{path.name}: {node['playerId']} has involvement {node['involvement']} but its "
            f"edges carry {floor} passes"
        )


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_set_play_counts_are_internally_consistent(path: Path) -> None:
    """Free kicks are NESTED and corners are partitioned; both were undocumented and untested."""
    for side in ("home", "away"):
        plays = _load(path)["setPlays"][side]
        free_kicks = plays["freeKicks"]
        assert (
            free_kicks["direct"]
            == free_kicks["directOnTarget"] + free_kicks["directOffTarget"]
        ), f"{path.name}/{side}: direct free kicks are not the sum of their on/off split"
        assert (
            free_kicks["direct"] + free_kicks["indirect"] == plays["totalFreeKicks"]
        ), f"{path.name}/{side}: direct + indirect != totalFreeKicks"
        by_side = plays["cornersBySide"]
        assert by_side["left"] + by_side["right"] == by_side["total"]
        assert by_side["total"] == plays["totalCorners"]
        for axis in ("left", "right", "total"):
            assert by_side[axis] == sum(
                v[axis] for v in plays["cornersByDeliveryType"].values()
            ), f"{path.name}/{side}: cornersBySide.{axis} != the delivery-type split"


@pytest.mark.parametrize("path", MATCH_FIXTURES, ids=lambda p: p.name)
def test_goal_prevention_breakdowns_hit_their_own_documented_denominators(path: Path) -> None:
    """The two panels have DIFFERENT totals by design; that is now written down and held."""
    for keeper in _load(path)["goalkeeping"] or []:
        prevention = keeper["goalPrevention"]
        assert sum(prevention["byInterventionType"].values()) == prevention["attemptsFaced"], (
            f"{path.name}/{keeper['playerId']}: intervention types do not sum to attemptsFaced"
        )
        assert sum(prevention["byBodyType"].values()) == prevention["totalInterventions"], (
            f"{path.name}/{keeper['playerId']}: body types do not sum to totalInterventions"
        )


def test_the_shootout_sequence_is_complete_and_alternates() -> None:
    """A shoot-out fixture must encode a state the tie could actually have stopped in.

    m074 shipped 8 kicks at 3-4 with Germany still holding their fifth -- the trailing side
    could still equalise, so the sequence was not terminal and the declared winner could not
    be read off it. The old test only checked `order == 1..n` and that the scored counts
    matched the aggregate, both of which an unfinished sequence satisfies.
    """
    for name, bundle in _bundles().items():
        attempts = bundle["events"]["shootoutAttempts"]
        if not attempts:
            continue
        score = bundle["metadata"]["knockoutScore"]["shootoutScore"]
        home = bundle["metadata"]["homeTeam"]["teamId"]
        away = bundle["metadata"]["awayTeam"]["teamId"]
        assert [a["order"] for a in attempts] == list(range(1, len(attempts) + 1))

        sides = [a["teamId"] for a in attempts]
        assert all(a != b for a, b in zip(sides, sides[1:])), f"{name}: kicks do not alternate"

        scored = {
            home: sum(1 for a in attempts if a["teamId"] == home and a["outcome"] == "scored"),
            away: sum(1 for a in attempts if a["teamId"] == away and a["outcome"] == "scored"),
        }
        assert scored[home] == score["home"] and scored[away] == score["away"], (
            f"{name}: attempt rows score {scored}, aggregate says {score}"
        )
        taken = {t: sum(1 for a in attempts if a["teamId"] == t) for t in (home, away)}
        remaining = {t: max(0, 5 - taken[t]) for t in (home, away)}
        decided = (
            scored[home] + remaining[home] < scored[away]
            or scored[away] + remaining[away] < scored[home]
        )
        assert decided, (
            f"{name}: the shoot-out is not over after {len(attempts)} kicks -- "
            f"{scored}, kicks remaining {remaining}. The declared winner cannot be read "
            f"off a sequence the trailing side could still level."
        )
        assert len({a["playerId"] for a in attempts}) == len(attempts), (
            f"{name}: a player takes two kicks before everyone has taken one"
        )


def test_the_team_profile_record_matches_its_own_per_match_rows() -> None:
    """`matches` is one row per match played, so the record must be derivable from it.

    The fixture claimed `furthestStage: "r16"` alongside `played: 3` and three group rows --
    reaching the round of 16 takes at least one knockout tie, so there was no reading under
    which both were true.
    """
    for path in INDEX_FIXTURES:
        if path.parent.name != "team-profiles":
            continue
        profile = _load(path)
        rows, record = profile["matches"], profile["record"]
        assert record["played"] == len(rows), f"{path.name}: played != len(matches)"
        assert record["won"] == sum(1 for r in rows if r["result"] == "win")
        assert record["drawn"] == sum(1 for r in rows if r["result"] == "draw")
        assert record["lost"] == sum(1 for r in rows if r["result"] == "loss")
        assert record["goalsFor"] == sum(r["goalsFor"] for r in rows)
        assert record["goalsAgainst"] == sum(r["goalsAgainst"] for r in rows)
        assert record["goalDifference"] == record["goalsFor"] - record["goalsAgainst"]
        assert record["points"] == record["won"] * 3 + record["drawn"]
        stages = {r["stage"] for r in rows}
        if record["furthestStage"] == "group":
            assert stages == {"group"}, f"{path.name}: furthestStage group but rows {stages}"
        else:
            assert record["furthestStage"] in stages, (
                f"{path.name}: furthestStage {record['furthestStage']} has no match row"
            )


def test_the_player_profile_aggregates_equal_their_own_aggregation() -> None:
    """FR-27: an aggregate must equal the correct aggregation, checkable from the artifact.

    `physical.totalDistance` read 26,496.6 against per-match rows summing to 27,590.0 -- a
    1.1 km disagreement inside one file, with nothing comparing the two.
    """
    for path in INDEX_FIXTURES:
        if path.parent.name != "player-profiles":
            continue
        profile = _load(path)
        rows = profile["matches"]
        assert rows, f"{path.name} has no per-match breakdown"
        physical = profile["physical"]
        assert abs(physical["totalDistance"] - sum(r["totalDistance"] for r in rows)) < 0.05, (
            f"{path.name}: totalDistance {physical['totalDistance']} != the row sum "
            f"{sum(r['totalDistance'] for r in rows):.1f}"
        )
        assert physical["topSpeed"] == max(r["topSpeed"] for r in rows), (
            f"{path.name}: topSpeed is not the maximum over the per-match rows"
        )
        appearances = profile["appearances"]
        assert appearances["played"] == len(rows)
        assert appearances["minutesPlayed"] == sum(r["minutesPlayed"] for r in rows)
        assert appearances["started"] == sum(1 for r in rows if r["started"])
        assert (
            appearances["played"]
            == appearances["started"] + appearances["substituteAppearances"]
        ), f"{path.name}: played != started + substituteAppearances"


def test_leaderboard_rows_agree_with_the_profiles_and_standings_they_duplicate() -> None:
    """The App shows a board and a profile side by side; they described different worlds.

    Every board row said `matchesPlayed: 1` while the standings and the team profile both
    said 3, and Mexico's possession value was one match's figure presented as a tournament
    average.
    """
    boards = _load(FIXTURES_DIR / "index" / "leaderboards.json")
    tournament = _load(FIXTURES_DIR / "index" / "tournament.json")
    played = {
        row["team"]["id"]: row["played"]
        for group in tournament["groups"]
        for row in group["standings"]
    }
    profiles = {}
    players = {}
    for path in INDEX_FIXTURES:
        if path.parent.name == "team-profiles":
            profile = _load(path)
            profiles[profile["teamId"]] = profile
        elif path.parent.name == "player-profiles":
            profile = _load(path)
            players[profile["playerId"]] = profile

    for board in boards["boards"]:
        for row in board["rows"]:
            team_id = row["team"]["id"]
            if team_id in played:
                assert row["matchesPlayed"] == played[team_id], (
                    f"{board['metricCode']}: {team_id} played {row['matchesPlayed']} on the "
                    f"board and {played[team_id]} in the standings"
                )
            if board["aggregation"] == "max":
                assert row["perMatch"] is None, (
                    f"{board['metricCode']}: a maximum has no meaningful per-match rate"
                )
            elif board["aggregation"] == "sum":
                assert abs(row["perMatch"] - row["value"] / row["matchesPlayed"]) < 0.05, (
                    f"{board['metricCode']}: perMatch is not value / matchesPlayed"
                )

            profile = profiles.get(row["entity"]["id"])
            if profile and board["metricCode"] == "possession":
                assert row["value"] == profile["tacticalIdentity"]["possession"], (
                    f"possession board says {row['value']} for {row['entity']['id']}, "
                    f"its profile says {profile['tacticalIdentity']['possession']}"
                )
            player = players.get(row["entity"]["id"])
            if player and board["metricCode"] == "topSpeed":
                assert row["value"] == player["physical"]["topSpeed"], (
                    f"topSpeed board says {row['value']} for {row['entity']['id']}, "
                    f"its profile says {player['physical']['topSpeed']}"
                )

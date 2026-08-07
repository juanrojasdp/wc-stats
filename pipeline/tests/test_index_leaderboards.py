"""Story 1.17 — `leaderboards.json`: the 36-board roster, ranking, the cap and the budget.

Same two-kind split as `test_index_tournament.py`. The gates this module drives red are the
COMBINED payload budget (which the real corpus passes at 23% of ceiling, so it is provable
only by construction) and the tie-group cap.

**Every board value is recomputed from the committed bundles rather than restated.** The
emitter aggregates `keyStatistics` and Domain G; so does the expectation here, independently
and in one place, and the two are compared. A board asserted only against itself would prove
that the aggregator is the aggregator.
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from pathlib import Path

import pytest

from pipeline.ingest.records import canonical_json
from pipeline.precompute import index as index_module
from pipeline.precompute.budget import (
    BUDGET_BYTES,
    gzip_bytes,
    over_budget,
    over_budget_combined,
)
from pipeline.precompute.emit import load_spine
from pipeline.precompute.errors import BudgetExceededError, IndexEmitError
from pipeline.precompute.serialize import decimals_map
from pipeline.validate.schema import load_schemas, schema_version, validate_artifact


# --------------------------------------------------------------------------- the corpus
@pytest.fixture(scope="module")
def spine_dir(repo_root: Path) -> Path:
    path = repo_root / "work" / "spine"
    if not (path / "entities.json").is_file() or not (path / "matches").is_dir():
        message = ("staged spine not available at work/spine — run "
                   "`python -m pipeline.precompute.run --expect-records 104` first")
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)
    return path


@pytest.fixture(scope="module")
def bundles(repo_root: Path) -> "list[dict]":
    directory = repo_root / "data" / "matches"
    paths = sorted(directory.glob("*.json")) if directory.is_dir() else []
    if not paths:
        message = "committed Match Bundles not available at data/matches"
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)
    return [json.loads(path.read_text(encoding="utf-8")) for path in paths]


@pytest.fixture(scope="module")
def corpus(spine_dir: Path):
    return load_spine(spine_dir)


@pytest.fixture(scope="module")
def leaderboards(corpus, bundles: "list[dict]") -> dict:
    entities, matches = corpus
    return index_module.round_index(
        index_module.build_leaderboards(entities, matches, bundles),
        decimals_map(index_module.LEADERBOARDS_SCHEMA),
        index_module.LEADERBOARDS_LEAF_TYPES,
    )


@pytest.fixture(scope="module")
def tournament(corpus) -> dict:
    entities, matches = corpus
    return index_module.round_index(
        index_module.build_tournament(entities, matches),
        decimals_map(index_module.TOURNAMENT_SCHEMA, require_float=False),
        index_module.TOURNAMENT_LEAF_TYPES,
    )


# ---------------------------------------------------------------------- shape and roster
def test_the_artifact_satisfies_the_contract_schema(leaderboards: dict) -> None:
    validate_artifact(leaderboards, index_module.LEADERBOARDS_SCHEMA,
                      instance_label="leaderboards.json")


def test_the_version_stamp_is_read_and_never_hardcoded(leaderboards: dict) -> None:
    assert leaderboards["schemaVersion"] == schema_version()


def test_the_board_roster_is_emitted_in_exactly_the_declared_order(
        leaderboards: dict) -> None:
    """The ORDER is the contract (AD-5, D5).

    `Leaderboard` carries no group or category field, so Story 2.13 sections this surface
    from `metricCode` alone and the family grouping is expressed by adjacency and by nothing
    else. Re-ordering `BOARDS` silently re-sections the App, which is why it is pinned.
    """
    emitted = [(board["metricCode"], board["scope"]) for board in leaderboards["boards"]]
    declared = [(code, scope) for _family, code, scope, _agg, _hib in index_module.BOARDS]
    assert emitted == declared
    assert len(emitted) == 36
    assert len(set(emitted)) == 36, "a (metricCode, scope) pair is emitted twice"


def test_the_families_are_contiguous_so_2_13_can_section_from_metric_code_alone() -> None:
    """A split family would make the grouping unreadable from adjacency, which is the only
    channel that carries it — `Leaderboard` has no group field."""
    families = [family for family, *_rest in index_module.BOARDS]
    runs = [family for position, family in enumerate(families)
            if position == 0 or families[position - 1] != family]
    assert len(runs) == len(set(runs)), f"a family is split across the roster: {runs}"
    assert runs == ["physical", "attacking", "passing", "defending"]


def test_every_metric_code_is_in_the_closed_contract_enum(leaderboards: dict) -> None:
    enum = load_schemas()["common.schema.json"]["$defs"]["MetricCode"]["enum"]
    for board in leaderboards["boards"]:
        assert board["metricCode"] in enum


def test_every_metric_code_names_a_real_field_at_the_scope_it_is_boarded_at(
        bundles: "list[dict]") -> None:
    """The contract's rule is SCOPED: a team code names a `TeamKeyStatistics` field and a
    player code names a Domain G field. Verified against a real bundle, not asserted.
    """
    bundle = bundles[0]
    team_fields = set(bundle["keyStatistics"]["home"])
    player = bundle["players"][0]
    player_fields = set()
    for block in ("inPossession", "outOfPossession", "physical"):
        player_fields |= set(player[block])
    for _family, code, scope, _agg, _hib in index_module.BOARDS:
        fields = team_fields if scope == "team" else player_fields
        assert code in fields, f"{code!r} at scope {scope!r} names no field"


def test_the_two_scopes_never_pair_codes_that_carry_different_units() -> None:
    """`distanceCovered` is kilometres and `totalDistance` is metres.

    The enum's own rule is "no code carries two units"; the roster must not put two
    same-named-concept codes at one scope, which is the confusion the scope rule prevents.
    """
    for scope in ("team", "player"):
        codes = [code for _f, code, s, _a, _h in index_module.BOARDS if s == scope]
        assert len(codes) == len(set(codes))
        assert not ({"distanceCovered", "totalDistance"} <= set(codes))


# ---------------------------------------------------------------- ranking and ordering
def test_rows_are_in_rank_order_on_every_board(leaderboards: dict) -> None:
    for board in leaderboards["boards"]:
        ranks = [row["rank"] for row in board["rows"]]
        assert ranks == sorted(ranks), f"{board['metricCode']}/{board['scope']}"


def test_ranks_are_competition_ranks_never_dense_ranks(leaderboards: dict) -> None:
    """1, 2, 2, 4 — never 1, 2, 2, 3.

    Ties share the better rank and the next distinct value skips to its ordinal position.
    The committed fixture is the only thing in the contract that states this.
    """
    saw_a_tie = False
    for board in leaderboards["boards"]:
        rows = board["rows"]
        for position, row in enumerate(rows, start=1):
            if position == 1:
                assert row["rank"] == 1
                continue
            previous = rows[position - 2]
            if row["value"] == previous["value"]:
                saw_a_tie = True
                assert row["rank"] == previous["rank"], (
                    f"{board['metricCode']}: equal values carry different ranks")
            else:
                assert row["rank"] == position, (
                    f"{board['metricCode']}: rank {row['rank']} at position {position} — "
                    f"a dense rank, not a competition rank")
    assert saw_a_tie, "no tie was walked; competition ranking is unexercised"


def test_ties_are_ordered_by_ascending_entity_id(leaderboards: dict) -> None:
    """The determinism tiebreak, and the only reason re-runs are byte-identical.

    It is a serialization order, never a claim that one tied entity outranks another.
    """
    for board in leaderboards["boards"]:
        groups: "dict[int, list[str]]" = defaultdict(list)
        for row in board["rows"]:
            groups[row["rank"]].append(row["entity"]["id"])
        for rank, ids in groups.items():
            assert ids == sorted(ids), (
                f"{board['metricCode']}/{board['scope']} rank {rank}: {ids} is not "
                f"id-ascending")


def test_rows_are_sorted_by_descending_value(leaderboards: dict) -> None:
    for board in leaderboards["boards"]:
        assert board["higherIsBetter"] is True
        values = [row["value"] for row in board["rows"]]
        assert values == sorted(values, reverse=True), board["metricCode"]


def test_CONSTRUCTED_competition_ranking_skips_to_the_ordinal_position() -> None:
    rows = [{"value": v, "entity": {"id": i}, "rank": 0} for i, v in
            (("a", 10), ("b", 9), ("c", 9), ("d", 8))]
    index_module._rank_rows(rows)
    assert [row["rank"] for row in rows] == [1, 2, 2, 4]


# ------------------------------------------------------------------------ D3: cap and budget
def test_player_boards_are_capped_and_team_boards_are_not(leaderboards: dict) -> None:
    for board in leaderboards["boards"]:
        if board["scope"] == "team":
            assert len(board["rows"]) == 48, board["metricCode"]
        else:
            assert len(board["rows"]) >= index_module.PLAYER_ROW_CAP


def test_the_cap_never_splits_a_tie_group(leaderboards: dict) -> None:
    """A hard cut at N publishes an arbitrary subset of equals.

    Every entity sharing the last published rank must be published, so the boards are wider
    than the cap wherever the boundary lands inside a tie.
    """
    extended = 0
    for board in leaderboards["boards"]:
        if board["scope"] != "player":
            continue
        rows = board["rows"]
        if len(rows) > index_module.PLAYER_ROW_CAP:
            extended += 1
            boundary = rows[index_module.PLAYER_ROW_CAP - 1]["rank"]
            assert rows[-1]["rank"] == boundary, (
                f"{board['metricCode']}: the board runs past the cap to rank "
                f"{rows[-1]['rank']} but the boundary rank is {boundary}")
        # Whatever the last published rank is, EVERY entity holding it must be published.
        last_rank = rows[-1]["rank"]
        assert all(row["rank"] <= last_rank for row in rows)
    assert extended > 0, "no board extended past the cap; tie-extension is unexercised"


def test_CONSTRUCTED_a_hard_cut_would_split_a_tie_group_and_the_cap_does_not() -> None:
    """The differential IS the test: the same rows, cut two ways."""
    rows = [{"value": 10, "entity": {"id": "a"}, "rank": 0},
            {"value": 9, "entity": {"id": "b"}, "rank": 0},
            {"value": 9, "entity": {"id": "c"}, "rank": 0},
            {"value": 9, "entity": {"id": "d"}, "rank": 0}]
    index_module._rank_rows(rows)
    assert [row["rank"] for row in rows] == [1, 2, 2, 2]
    capped = index_module._apply_cap(rows, 2)
    assert [row["entity"]["id"] for row in capped] == ["a", "b", "c", "d"], (
        "the cap split a tie group and published an arbitrary subset of equals")
    assert [row["entity"]["id"] for row in rows[:2]] == ["a", "b"], (
        "a hard cut would have dropped c and d, which are equal to b")


def test_CONSTRUCTED_the_cap_does_nothing_when_the_boundary_is_not_a_tie() -> None:
    rows = [{"value": v, "entity": {"id": i}, "rank": 0}
            for i, v in (("a", 4), ("b", 3), ("c", 2), ("d", 1))]
    index_module._rank_rows(rows)
    assert [row["entity"]["id"] for row in index_module._apply_cap(rows, 2)] == ["a", "b"]


def test_the_combined_budget_passes_on_the_real_corpus_with_headroom(
        tournament: dict, leaderboards: dict) -> None:
    tournament_text = canonical_json(tournament)
    leaderboards_text = canonical_json(leaderboards)
    combined = gzip_bytes(tournament_text) + gzip_bytes(leaderboards_text)
    assert combined <= BUDGET_BYTES, f"combined {combined} over {BUDGET_BYTES}"
    assert over_budget_combined("pair", [tournament_text, leaderboards_text]) is None


def test_CONSTRUCTED_the_combined_gate_goes_red_on_a_pair_that_breaches() -> None:
    """A gate proven only green reads greener than no gate while proving strictly less.

    Two texts each comfortably under the ceiling whose SUM is over it — which is the whole
    point of the combined unit and the one case `over_budget` structurally cannot see.
    Incompressible text, so the sizes are stable rather than at the mercy of a dictionary.
    """
    import random

    generator = random.Random(1717)
    alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
    first = "".join(generator.choice(alphabet) for _ in range(450_000))
    second = "".join(generator.choice(alphabet) for _ in range(450_000))
    assert over_budget("first", first) is None and over_budget("second", second) is None, (
        "each half must pass alone, or this proves nothing about the COMBINED unit")
    breach = over_budget_combined("pair", [first, second])
    assert breach is not None
    label, compressed, raw = breach
    assert label == "pair"
    assert compressed > BUDGET_BYTES
    assert raw == len(first.encode()) + len(second.encode())


def test_CONSTRUCTED_removing_the_row_cap_drives_the_real_run_over_budget(
        repo_root: Path, spine_dir: Path, bundles: "list[dict]", monkeypatch) -> None:
    """The cap is load-bearing, and this proves it against the REAL corpus.

    Full-roster leaderboards measure ~610,000 gzip-9 bytes combined against a 500,000
    ceiling. Without this test the cap would be a number nobody could show was needed.

    `dry_run=True`, so nothing is written even though the real data directory is named.
    """
    monkeypatch.setattr(index_module, "PLAYER_ROW_CAP", None)
    with pytest.raises(BudgetExceededError) as caught:
        index_module.emit_index(spine_dir, repo_root / "data", dry_run=True)
    message = str(caught.value)
    assert "COMBINED" in message
    assert "NEVER by dropping fields" in message


# -------------------------------------------------------------- D4b: the row denominators
def test_matches_played_on_a_player_row_is_that_player_s_own_appearance_count(
        leaderboards: dict, bundles: "list[dict]") -> None:
    """D4b — the entity's OWN Domain G rows, not its team's match count.

    Recomputed from the bundles. Using the team's count divides an unused substitute and a
    full-tournament starter by the same denominator, and `perMatch` is then false on more
    than half of every player board.
    """
    appearances: "dict[str, int]" = defaultdict(int)
    for bundle in bundles:
        for player in bundle["players"]:
            appearances[player["playerId"]] += 1
    assert appearances

    checked = 0
    for board in leaderboards["boards"]:
        if board["scope"] != "player":
            continue
        for row in board["rows"]:
            assert row["matchesPlayed"] == appearances[row["entity"]["id"]], (
                f"{board['metricCode']}: {row['entity']['id']} carries "
                f"{row['matchesPlayed']}, the bundles carry "
                f"{appearances[row['entity']['id']]}")
            checked += 1
    assert checked > 1000, f"only {checked} player rows checked"


def test_a_player_denominator_really_does_differ_from_its_team_s_match_count(
        leaderboards: dict, tournament: dict) -> None:
    """If they never differed, D4b would be moot and this suite would prove nothing."""
    team_played = {team["teamId"]: team["record"]["played"]
                   for team in tournament["entities"]["teams"]}
    differ = same = 0
    for board in leaderboards["boards"]:
        if board["scope"] != "player":
            continue
        for row in board["rows"]:
            if row["matchesPlayed"] == team_played[row["team"]["id"]]:
                same += 1
            else:
                differ += 1
    assert differ > 0 and same > 0, (
        f"player denominators differ from the team count on {differ} rows and match on "
        f"{same}; both cases must occur or the distinction is untested")


def test_no_player_row_claims_more_appearances_than_its_team_played(
        leaderboards: dict, tournament: dict) -> None:
    team_played = {team["teamId"]: team["record"]["played"]
                   for team in tournament["entities"]["teams"]}
    for board in leaderboards["boards"]:
        if board["scope"] != "player":
            continue
        for row in board["rows"]:
            assert 1 <= row["matchesPlayed"] <= team_played[row["team"]["id"]]


def test_matches_played_on_a_team_row_equals_that_team_s_tournament_record(
        leaderboards: dict, tournament: dict) -> None:
    """Cross-artifact agreement (Task 7.7), scoped per D4.

    The shipped fixture rule asserts every row against the STANDINGS `played`; under D4a
    the tournament record is the right counterpart for a team row, and under D4b a player
    row has its own denominator and is asserted above instead.
    """
    team_played = {team["teamId"]: team["record"]["played"]
                   for team in tournament["entities"]["teams"]}
    for board in leaderboards["boards"]:
        if board["scope"] != "team":
            continue
        for row in board["rows"]:
            assert row["matchesPlayed"] == team_played[row["entity"]["id"]]
            assert row["entity"] == row["team"], "a team row's entity IS its team"


# -------------------------------------------------------------------- perMatch semantics
def test_per_match_is_null_exactly_on_the_maximum_boards(leaderboards: dict) -> None:
    saw_max = False
    for board in leaderboards["boards"]:
        for row in board["rows"]:
            if board["aggregation"] == "max":
                saw_max = True
                assert row["perMatch"] is None, (
                    f"{board['metricCode']}: a maximum has no meaningful per-match rate")
            else:
                assert row["perMatch"] is not None
    assert saw_max


def test_per_match_on_a_sum_board_is_the_value_over_the_matches_played(
        leaderboards: dict) -> None:
    """The shipped cross-artifact tolerance, held against real `/data`."""
    for board in leaderboards["boards"]:
        if board["aggregation"] != "sum":
            continue
        for row in board["rows"]:
            assert abs(row["perMatch"] - row["value"] / row["matchesPlayed"]) < 0.05, (
                f"{board['metricCode']}: perMatch {row['perMatch']} is not "
                f"{row['value']} / {row['matchesPlayed']}")


def test_per_match_on_an_average_board_is_the_value_itself(leaderboards: dict) -> None:
    """For an average the value already IS the per-match figure.

    Dividing it again would publish a tournament possession of 21.8% for a team that held
    65.5% in each of three matches.
    """
    saw_average = False
    for board in leaderboards["boards"]:
        if board["aggregation"] != "average":
            continue
        saw_average = True
        for row in board["rows"]:
            assert abs(row["perMatch"] - row["value"]) < 0.05, board["metricCode"]
    assert saw_average


def test_per_match_null_is_written_rather_than_omitted(leaderboards: dict) -> None:
    """`perMatch` is required-but-nullable; an omitted key fails the contract."""
    text = canonical_json(leaderboards)
    assert '"perMatch": null' in text
    for board in leaderboards["boards"]:
        for row in board["rows"]:
            assert "perMatch" in row


# ------------------------------------------------------------------------ precision (2.4)
def test_the_leaderboards_precision_map_carries_the_per_match_slot() -> None:
    """It was silently missing: `x-decimals` sits on an untitled `anyOf` branch.

    Left unrounded, `perMatch` validates clean as `type: number` and byte-identity then
    rests on float arithmetic — the same defect class as Story 1.16's headline finding.
    """
    places = decimals_map(index_module.LEADERBOARDS_SCHEMA)
    assert places == {"Count": 0, "Rank": 0, "LeaderboardValue": 2,
                      "LeaderboardPerMatchValue": 2}


# **The expectation is stated HERE, and the emitter derives — that direction is the whole
# point.** The 1.17 code review found every precision assertion routing its expected value
# through `index_module._metric_decimals`, so both sides of the comparison came from the
# table under test: setting two `Percentage` codes to 0 places kept all 41 tests green while
# 553 float leaves shipped truncated to integers. This literal is the independent statement
# of what /contract declares, written out rather than computed, so the derivation has
# something to be wrong against. Every code not listed here is an integer-valued `Count`.
EXPECTED_PLACES: "dict[tuple[str, str], int]" = {
    ("possession", "team"): 1,        # Percentage
    ("passCompletion", "team"): 1,    # Percentage
    ("passCompletion", "player"): 1,  # Percentage
    ("expectedGoals", "team"): 2,     # ExpectedGoals
    ("distanceCovered", "team"): 2,   # Kilometres
    ("sprintDistance", "team"): 2,    # Kilometres
    ("topSpeed", "player"): 1,        # KmPerHour
    ("totalDistance", "player"): 1,   # Metres
}


def test_the_metric_precision_map_is_what_the_contract_declares() -> None:
    """The derived map, pinned against a literal — the review's headline finding.

    `METRIC_DECIMALS` is derived from `/contract` rather than transcribed, which removes the
    staleness half of the defect. This test removes the other half: a derivation that
    resolved the wrong `$ref`, or silently dropped a board, would otherwise move no test at
    all, because every other precision assertion reads the derived map.
    """
    derived = index_module.METRIC_DECIMALS
    assert len(derived) == len(index_module.BOARDS) == 36, (
        f"{len(derived)} precisions for {len(index_module.BOARDS)} boards — every board "
        f"must resolve, and a missing one must not be defaulted")
    assert {key: places for key, places in derived.items() if places} == EXPECTED_PLACES
    assert all(places == 0 for key, places in derived.items()
               if key not in EXPECTED_PLACES)


def test_every_value_carries_its_metric_s_own_precision(leaderboards: dict) -> None:
    """`value` is polymorphic, so precision is keyed by `metricCode`, not by key name.

    Reads `EXPECTED_PLACES`, never `index_module._metric_decimals`: the emitter's own table
    cannot be both the thing under test and the yardstick.
    """
    for board in leaderboards["boards"]:
        places = EXPECTED_PLACES.get((board["metricCode"], board["scope"]), 0)
        for row in board["rows"]:
            value = row["value"]
            if places == 0:
                assert isinstance(value, int) and not isinstance(value, bool), (
                    f"{board['metricCode']}: {value!r} is not an integer")
            else:
                assert round(value, places) == value, (
                    f"{board['metricCode']}: {value!r} carries more than {places} places")
                assert isinstance(value, float), (
                    f"{board['metricCode']}: {value!r} lost its fractional slot entirely")


def test_CONSTRUCTED_a_metric_bound_to_the_wrong_precision_is_caught(
        leaderboards: dict) -> None:
    """The mutation check: the precision test must go RED when the binding is wrong.

    Copied from `test_emit_bundles.py::test_a_key_bound_to_the_wrong_precision_is_caught`,
    which is the pattern that stops a precision test passing by walking nothing. Without
    this, `test_every_value_carries_its_metric_s_own_precision` could be vacuous and look
    identical from the outside.

    The mutation is applied to the EXPECTED table, not to the emitter, because the published
    artifact is the fixed quantity here: declaring `possession` an integer must make the
    real, already-emitted 1-place values fail.
    """
    mutated = dict(EXPECTED_PLACES)
    del mutated[("possession", "team")]  # now claims 0 places, i.e. integer-valued
    board = next(b for b in leaderboards["boards"]
                 if b["metricCode"] == "possession" and b["scope"] == "team")
    places = mutated.get((board["metricCode"], board["scope"]), 0)
    assert places == 0
    assert any(not isinstance(row["value"], int) for row in board["rows"]), (
        "the possession board carries no fractional value, so the precision assertion "
        "above proves nothing about it")


def test_every_per_match_carries_the_slot_s_declared_precision(leaderboards: dict) -> None:
    """Read from `/contract`, not from `index_module.PER_MATCH_DECIMALS`.

    The ruling is that `perMatch` takes the SLOT's precision rather than the metric's; the
    slot is `LeaderboardPerMatchValue` and the contract declares its `x-decimals` on an
    untitled `anyOf` branch. Taking the number from the contract means the ruling and the
    artifact are compared, rather than the emitter's constant being compared to itself.
    """
    declared = decimals_map(index_module.LEADERBOARDS_SCHEMA)["LeaderboardPerMatchValue"]
    assert index_module.PER_MATCH_DECIMALS == declared, (
        "the emitter's per-match precision has drifted from the slot the contract declares")
    for board in leaderboards["boards"]:
        for row in board["rows"]:
            if row["perMatch"] is None:
                continue
            assert round(row["perMatch"], declared) == row["perMatch"]


def test_the_numeric_leaf_binding_is_total_for_the_leaderboards(leaderboards: dict) -> None:
    """Every numeric leaf in the artifact is BOUND to a precision by name.

    The id walk has `test_the_id_containment_check_is_total_for_both_index_artifacts`; the
    numeric walk had no equivalent, and `round_index` leaves an unbound key completely
    unrounded BY DESIGN — so the failure mode is silent. A new contract field reusing an
    existing `$def` moves `decimals_map` not at all, and would ship unrounded with
    byte-identity resting on float arithmetic: verbatim the Story 1.16 headline defect.
    """
    # Two rounding paths exist and a total check must know about both. `LEADERBOARDS_LEAF_
    # TYPES` binds by key name; `value` and `perMatch` are rounded per row in `_board_rows`
    # because their precision is metric-dependent and only there is `metricCode` in scope.
    # `schemaVersion` is the contract's own integer stamp and is rounded by nothing on
    # purpose. Listing the three explicitly is what makes this a gate: a FOURTH unbound
    # numeric key — the actual failure mode — is not on this list and turns the test red.
    rounded_per_row = {"value", "perMatch"}
    not_a_measurement = {"schemaVersion"}
    bound = set(index_module.LEADERBOARDS_LEAF_TYPES) | rounded_per_row | not_a_measurement
    found: "set[str]" = set()

    def walk(node) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    found.add(key)
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(leaderboards)
    unbound = sorted(found - bound)
    assert not unbound, (
        f"{len(unbound)} numeric leaf key(s) reach the artifact bound to no precision and "
        f"are therefore rounded by nothing: {unbound}")


def test_CONSTRUCTED_a_count_metric_rounded_at_its_source_precision_breaks_the_tolerance(
) -> None:
    """Why `perMatch` takes the SLOT's precision and not the source field's.

    5 goals over 8 matches is 0.625. Rounded to `goals`' own 0 places it publishes 1, and
    the shipped invariant `abs(perMatch - value / matchesPlayed) < 0.05` fails by 0.375.
    The ruling is proven here rather than asserted in a comment.
    """
    from pipeline.precompute.serialize import round_to_precision
    exact = 5 / 8
    assert abs(round_to_precision(exact, index_module.PER_MATCH_DECIMALS) - exact) < 0.05
    assert abs(round_to_precision(exact, 0) - exact) > 0.05


# ------------------------------------------------------- AC 5: reproducible from the bundles
def test_every_board_value_is_reproducible_from_the_committed_bundles(
        leaderboards: dict, bundles: "list[dict]") -> None:
    """Recomputed from the bundles, never restated from the emitter.

    Walks every published row on all 36 boards and re-derives its value from the source
    stat blocks, applying only the declared aggregation and the metric's own precision.
    """
    from pipeline.precompute.serialize import round_to_precision

    team_values: "dict[tuple[str, str], list]" = defaultdict(list)
    player_values: "dict[tuple[str, str], list]" = defaultdict(list)
    for bundle in bundles:
        for side in ("home", "away"):
            team_id = bundle["metadata"][f"{side}Team"]["teamId"]
            for code, value in bundle["keyStatistics"][side].items():
                if value is not None:
                    team_values[(code, team_id)].append(value)
        for player in bundle["players"]:
            flat: dict = {}
            for block in ("inPossession", "outOfPossession", "physical"):
                flat.update(player[block])
            for code, value in flat.items():
                if value is not None:
                    player_values[(code, player["playerId"])].append(value)

    checked = 0
    for board in leaderboards["boards"]:
        code = board["metricCode"]
        source = team_values if board["scope"] == "team" else player_values
        # `EXPECTED_PLACES`, not the emitter's map: AC 5 requires the expectation derived
        # from the parsed corpus and the contract, never restated from the implementation.
        places = EXPECTED_PLACES.get((code, board["scope"]), 0)
        for row in board["rows"]:
            values = source[(code, row["entity"]["id"])]
            assert values, f"{code}: {row['entity']['id']} has no source values"
            if board["aggregation"] == "max":
                expected = max(values)
            elif board["aggregation"] == "sum":
                expected = sum(values)
            else:
                expected = sum(values) / len(values)
            assert row["value"] == round_to_precision(expected, places), (
                f"{code}/{board['scope']}: {row['entity']['id']} publishes "
                f"{row['value']}, the bundles give {expected}")
            assert row["matchesPlayed"] == len(values)
            checked += 1
    assert checked > 2000, f"only {checked} rows recomputed"


def test_the_player_goals_board_excludes_own_goals(bundles: "list[dict]") -> None:
    """Own goals are credited to the BENEFITING TEAM while `scorerPlayerId` names the
    scorer, so a top-scorer board that counted them would credit the wrong player.

    Verified rather than assumed: Domain G's `inPossession.goals` already excludes them,
    and it agrees match by match on the whole corpus.
    """
    total_player_goals = 0
    total_non_own = 0
    own_goals = 0
    for bundle in bundles:
        player_goals = sum(player["inPossession"]["goals"] for player in bundle["players"])
        recorded = bundle["metadata"]["goals"]
        own = sum(1 for goal in recorded if goal["ownGoal"])
        assert player_goals == len(recorded) - own, (
            f"{bundle['matchId']}: Domain G totals {player_goals} goals against "
            f"{len(recorded) - own} non-own goals in the metadata")
        total_player_goals += player_goals
        total_non_own += len(recorded) - own
        own_goals += own
    assert own_goals > 0, "no own goal in the corpus; the exclusion is unexercised"
    assert total_player_goals == total_non_own


def test_the_team_goals_board_credits_the_benefiting_team(bundles: "list[dict]") -> None:
    """`keyStatistics.goals` equals the final score, which is the crediting rule."""
    for bundle in bundles:
        score = bundle["metadata"]["score"]
        assert bundle["keyStatistics"]["home"]["goals"] == score["home"]
        assert bundle["keyStatistics"]["away"]["goals"] == score["away"]


def test_player_boards_rank_only_players_who_have_a_performance_block(
        leaderboards: dict, tournament: dict, bundles: "list[dict]") -> None:
    """A board ranks what has data; the manifest is a route list. Both are correct.

    The lineup-only players have no Domain G row and cannot be ranked on any metric — which
    is not a contradiction of the entity list, and is why the manifest is never filtered.
    """
    with_rows = {player["playerId"] for bundle in bundles for player in bundle["players"]}
    listed = {row["playerId"] for row in tournament["entities"]["players"]}
    assert with_rows < listed
    for board in leaderboards["boards"]:
        if board["scope"] != "player":
            continue
        ids = {row["entity"]["id"] for row in board["rows"]}
        assert ids <= with_rows, "a board ranks a player with no performance block"


def test_a_passing_board_ranks_the_printed_domain_g_field_not_a_matrix_row_sum(
        bundles: "list[dict]") -> None:
    """Stated as a test because the two disagree and the choice must not be silent.

    Domain G's `passesCompleted` exceeds the pass-network row sum on a large minority of
    rows. The boards rank the PRINTED per-player field; the pass matrix is a different
    measurement of a related thing and is not what `passesCompleted` names.
    """
    disagreements = 0
    for bundle in bundles:
        edges = bundle["events"]["passNetworkEdges"] or []
        outgoing: "dict[str, int]" = defaultdict(int)
        for edge in edges:
            outgoing[edge["fromPlayerId"]] += edge["volume"]
        for player in bundle["players"]:
            if player["inPossession"]["passesCompleted"] != outgoing.get(
                    player["playerId"], 0):
                disagreements += 1
    assert disagreements > 0, (
        "the Domain G field and the pass-matrix row sum agree everywhere; the choice "
        "recorded here would be moot and this test should be removed")


# ----------------------------------------------------------------- guards and serialization
def test_two_builds_are_byte_identical(corpus, bundles: "list[dict]") -> None:
    entities, matches = corpus
    places = decimals_map(index_module.LEADERBOARDS_SCHEMA)
    first = canonical_json(index_module.round_index(
        index_module.build_leaderboards(entities, matches, bundles), places,
        index_module.LEADERBOARDS_LEAF_TYPES))
    second = canonical_json(index_module.round_index(
        index_module.build_leaderboards(entities, matches, bundles), places,
        index_module.LEADERBOARDS_LEAF_TYPES))
    assert first == second


def test_the_canonical_text_carries_no_timestamp_path_or_code_version(
        leaderboards: dict) -> None:
    text = canonical_json(leaderboards)
    for forbidden in ("code_version", "generated_by", "generatedAt", "\\\\", "C:/"):
        assert forbidden not in text


def test_CONSTRUCTED_a_bundle_set_that_disagrees_with_the_spine_is_refused(
        corpus, bundles: "list[dict]") -> None:
    """A board silently built from 103 of 104 bundles is wrong in a way no schema sees."""
    entities, matches = corpus
    with pytest.raises(IndexEmitError, match="disagree on the match set"):
        index_module.build_leaderboards(entities, matches, bundles[:-1])


def test_CONSTRUCTED_a_bundle_missing_a_boarded_field_is_a_typed_failure(
        corpus, bundles: "list[dict]") -> None:
    """Never a `KeyError` out of an aggregator; AD-8 requires a typed finding."""
    import copy

    entities, matches = corpus
    damaged = copy.deepcopy(bundles)
    del damaged[0]["keyStatistics"]["home"]["possession"]
    with pytest.raises(IndexEmitError, match="possession"):
        index_module.build_leaderboards(entities, matches, damaged)


def test_CONSTRUCTED_the_players_list_is_guarded_at_load(corpus) -> None:
    """`load_spine` guards `teams` and `matches` and NOT `players`.

    This story depends on the player list entirely, so the gap is closed here rather than
    left to surface as a bare `KeyError` three frames down.
    """
    entities, _matches = corpus
    import copy

    stale = copy.deepcopy(entities)
    del stale["players"]
    with pytest.raises(IndexEmitError, match="players"):
        index_module.check_entities_shape(stale, "probe")
    empty = copy.deepcopy(entities)
    empty["players"] = []
    with pytest.raises(IndexEmitError, match="empty"):
        index_module.check_entities_shape(empty, "probe")

"""Story 1.17 — `tournament.json`: results, standings and the route manifest.

Two kinds of test, and the split is the one Story 1.16 established. **Constructed** tests
build synthetic input and drive each gate RED; this story adds four gates and a gate proven
only green would be the fourth gate-that-cannot-fail this project has shipped. **Corpus**
tests run over the real staged spine and the committed bundles, which are gitignored or
large, so they skip locally and fail under `CI=1` — a skip is exactly how a missing input
comes to read as a pass.

**Expected values are derived from the parsed corpus, never restated from the
implementation.** A test asserting `emit(x) == emit(x)` proves only that the function is
the function. Where a value can be recomputed from a second source, it is: the standings
are re-derived from the committed BUNDLES' own `knockoutScore.scoreAfter90` while the
emitter reaches them through the spine and `emit._knockout_score`, so the two paths are
genuinely independent.
"""

from __future__ import annotations

import copy
import json
import os
from collections import defaultdict
from pathlib import Path

import pytest

from pipeline.ingest.records import canonical_json
from pipeline.precompute import index as index_module
from pipeline.precompute.emit import load_spine
from pipeline.precompute.errors import (
    IndexEmitError,
    RouteManifestError,
    SlugRegistryError,
    TiebreakUnresolvedError,
)
from pipeline.precompute.serialize import decimals_map
from pipeline.validate.schema import schema_version, validate_artifact


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
def bundles_dir(repo_root: Path) -> Path:
    path = repo_root / "data" / "matches"
    if not path.is_dir() or not any(path.glob("*.json")):
        message = "committed Match Bundles not available at data/matches"
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)
    return path


@pytest.fixture(scope="module")
def corpus(spine_dir: Path):
    return load_spine(spine_dir)


@pytest.fixture(scope="module")
def tracked_profiles(repo_root: Path) -> "set[str]":
    """The profile artifacts git actually TRACKS, which is not the same as what is on disk.

    **Added by the 1.17 code review, and the distinction is the whole point.** Story 1.18
    emitted 1,296 profiles into the shared working tree while this story was in review, so
    every test that read the directory passed locally — and would have failed on a clean
    checkout, where the directories do not exist at all. `git ls-files` asks the question
    that survives a fresh clone.

    Tests that assert the POPULATED bijection depend on this being non-empty; the tripwire
    below asserts the opposite and is the thing that goes red when 1.18 commits.
    """
    import subprocess
    try:
        result = subprocess.run(
            ["git", "ls-files", "data/index/team-profiles", "data/index/player-profiles"],
            cwd=repo_root, capture_output=True, text=True, timeout=60, check=False)
    except (OSError, subprocess.SubprocessError) as exc:  # pragma: no cover - env-specific
        pytest.skip(f"git is unavailable, so tracked state cannot be established: {exc}")
    if result.returncode != 0:  # pragma: no cover - env-specific
        pytest.skip(f"git ls-files failed: {result.stderr.strip()}")
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


@pytest.fixture(scope="module")
def bundles(bundles_dir: Path) -> "list[dict]":
    return [json.loads(path.read_text(encoding="utf-8"))
            for path in sorted(bundles_dir.glob("*.json"))]


@pytest.fixture(scope="module")
def tournament(corpus) -> dict:
    entities, matches = corpus
    return index_module.round_index(
        index_module.build_tournament(entities, matches),
        decimals_map(index_module.TOURNAMENT_SCHEMA, require_float=False),
        index_module.TOURNAMENT_LEAF_TYPES,
    )


# ------------------------------------------------------------------ shape and the contract
def test_the_artifact_satisfies_the_contract_schema(tournament: dict) -> None:
    validate_artifact(tournament, index_module.TOURNAMENT_SCHEMA,
                      instance_label="tournament.json")


def test_the_top_level_carries_exactly_the_five_required_keys(tournament: dict) -> None:
    """The AC names two of the five. The schema is the specification, not the AC."""
    assert sorted(tournament) == [
        "entities", "groups", "knockoutResults", "schemaVersion", "tournamentName"]


def test_the_tournament_name_is_declared_once_and_pinned(tournament: dict) -> None:
    """The one published value not derived from the corpus, pinned so it cannot drift.

    FR-19 is "precompute adds no data the bundles don't contain" and this adds one string:
    the contract requires `tournamentName`, nothing in the repository prints it, and the
    alternatives — deriving it from a filename, or omitting it — are respectively the
    id-minting this module forbids and a validation failure. The 1.17 code review asked for
    the exception to be disclosed and pinned rather than left in a comment.
    """
    assert tournament["tournamentName"] == index_module.TOURNAMENT_NAME
    assert tournament["tournamentName"] == "FIFA World Cup 2026"


def test_the_version_stamp_is_read_and_never_hardcoded(tournament: dict) -> None:
    """A literal here would be a seventh declaration of the one version (AD-2)."""
    assert tournament["schemaVersion"] == schema_version()


def test_no_staging_key_reaches_the_artifact(tournament: dict) -> None:
    """`spine_version`, `generated_by`, `code_version` and `source_manifest` stay behind.

    `additionalProperties: false` would reject them, but `code_version` is the sharper
    reason: it would make the artifact differ between two checkouts of the same commit and
    silently destroy AD-8's byte-identity.
    """
    text = canonical_json(tournament)
    for staging_key in ("spine_version", "generated_by", "code_version", "source_manifest",
                        "report_id", "slug_source"):
        assert staging_key not in text, f"{staging_key!r} leaked into tournament.json"


def test_no_score_carries_the_spine_s_shootout_key(tournament: dict) -> None:
    """The spine's `score` is `{home, away, shootout}`; `TeamScore` is closed at two.

    Carrying it through verbatim fails validation on every `MatchResultRow`, `MatchEntity`
    and knockout row — the shoot-out prose decomposes into `knockoutScore` instead.
    """
    def scores(node):
        if isinstance(node, dict):
            if set(node) >= {"home", "away"} and "decidedBy" not in node:
                yield node
            for value in node.values():
                yield from scores(value)
        elif isinstance(node, list):
            for item in node:
                yield from scores(item)

    found = list(scores(tournament))
    assert found, "no TeamScore objects were walked; this test would prove nothing"
    for score in found:
        assert sorted(score) == ["away", "home"], f"score carries extra keys: {sorted(score)}"


# --------------------------------------------------------------------------- the orderings
def test_groups_are_ordered_by_group_letter(tournament: dict) -> None:
    letters = [group["group"] for group in tournament["groups"]]
    assert letters == sorted(letters)


def test_knockout_results_are_ordered_by_stage_then_match_number(tournament: dict) -> None:
    """`KNOCKOUT_ROUNDS` is the stage order; it is imported, never transcribed."""
    from pipeline.discover.rounds import KNOCKOUT_ROUNDS
    order = {stage: i for i, stage in enumerate(KNOCKOUT_ROUNDS)}
    keys = [(order[row["stage"]], row["matchNumber"])
            for row in tournament["knockoutResults"]]
    assert keys == sorted(keys)
    assert {row["stage"] for row in tournament["knockoutResults"]} <= set(KNOCKOUT_ROUNDS)


def test_standings_rows_are_in_rank_order_and_ranks_are_dense_from_one(
        tournament: dict) -> None:
    for group in tournament["groups"]:
        ranks = [row["rank"] for row in group["standings"]]
        assert ranks == list(range(1, len(ranks) + 1)), (
            f"group {group['group']} ranks are {ranks}")


def test_group_results_are_ordered_by_match_number(tournament: dict) -> None:
    for group in tournament["groups"]:
        numbers = [row["matchNumber"] for row in group["results"]]
        assert numbers == sorted(numbers)


def test_form_is_chronological_and_as_long_as_the_matches_played(tournament: dict) -> None:
    """`len(form) == played`, and the order key is `matchNumber` ascending.

    The key is DECLARED rather than implied (AD-8). Verified independently below: no team
    plays two group matches on one date, and `matchNumber`, `date` and `kickoff` agree.
    """
    for group in tournament["groups"]:
        for row in group["standings"]:
            assert len(row["form"]) == row["played"]
            assert set(row["form"]) <= {"win", "draw", "loss"}


def test_form_reproduces_the_results_recomputed_from_the_committed_bundles(
        tournament: dict, bundles: "list[dict]") -> None:
    """The CONTENTS of `form`, recomputed from a second source — not just its length.

    Added by the 1.17 code review: five of the six declared orderings were pinned and this
    one was not. `test_form_is_chronological_and_as_long_as_the_matches_played` asserts only
    `len(form) == played` and the value domain, so a reversed sequence, or one whose wins
    and losses were swapped, passed every shipped test. Measured while writing this: 29 of
    the 48 rows are non-palindromic, so reversal is genuinely detectable here.

    The expectation walks the bundles' own `scoreAfter90` in `matchNumber` order, which is
    the second source the emitter never touches.
    """
    expected: "dict[str, list[tuple[int, str]]]" = defaultdict(list)
    for bundle in bundles:
        metadata = bundle["metadata"]
        if metadata["stage"] != "group":
            continue
        score = metadata["knockoutScore"]["scoreAfter90"]
        number = metadata["matchNumber"]
        home, away = metadata["homeTeam"]["teamId"], metadata["awayTeam"]["teamId"]
        for team_id, scored, conceded in ((home, score["home"], score["away"]),
                                          (away, score["away"], score["home"])):
            result = "win" if scored > conceded else "loss" if scored < conceded else "draw"
            expected[team_id].append((number, result))

    assert expected, "no group bundles were walked"
    checked = 0
    for group in tournament["groups"]:
        for row in group["standings"]:
            team_id = row["team"]["id"]
            in_order = [result for _n, result in sorted(expected[team_id])]
            assert row["form"] == in_order, (
                f"{team_id}: publishes {row['form']}, the bundles give {in_order}")
            checked += 1
    assert checked == 48, f"only {checked} form sequences compared"


def test_the_standings_and_the_results_in_one_group_table_agree(tournament: dict) -> None:
    """A `GroupTable`'s two halves are computed from different scores; bound them.

    `_tally` reads `scoreAfter90` while `_match_result_row` prints the final `score`. For a
    group match those are the same number — there is no extra time — but nothing asserted
    it, so a goal reconciled into a minute above 90 would make a table's standings and its
    own printed results disagree with no test noticing. Shipping the bound rather than
    trusting the coincidence is this project's standing rule.
    """
    for group in tournament["groups"]:
        scored: "dict[str, int]" = defaultdict(int)
        conceded: "dict[str, int]" = defaultdict(int)
        for row in group["results"]:
            home, away = row["homeTeam"]["id"], row["awayTeam"]["id"]
            scored[home] += row["score"]["home"]
            conceded[home] += row["score"]["away"]
            scored[away] += row["score"]["away"]
            conceded[away] += row["score"]["home"]
        for row in group["standings"]:
            team_id = row["team"]["id"]
            assert row["goalsFor"] == scored[team_id], (
                f"group {group['group']}: {team_id} standings say goalsFor "
                f"{row['goalsFor']}, its own results rows total {scored[team_id]}")
            assert row["goalsAgainst"] == conceded[team_id]
        assert {row["team"]["id"] for row in group["standings"]} == set(scored), (
            f"group {group['group']}: the standings and the results name different teams")


def test_the_declared_form_ordering_key_is_unambiguous(tournament: dict) -> None:
    """`matchNumber`, `date` and `kickoff` induce the SAME group order for every team."""
    per_team: "dict[str, list[tuple]]" = defaultdict(list)
    for group in tournament["groups"]:
        for row in group["results"]:
            for side in ("homeTeam", "awayTeam"):
                per_team[row[side]["id"]].append(
                    (row["matchNumber"], row["date"], row["kickoff"]))
    assert per_team, "no group results were walked"
    for team_id, rows in per_team.items():
        by_number = [r[0] for r in sorted(rows, key=lambda r: r[0])]
        by_kickoff = [r[0] for r in sorted(rows, key=lambda r: (r[2], r[0]))]
        assert by_number == by_kickoff, f"{team_id}: matchNumber and kickoff disagree"


def test_the_entity_lists_carry_the_spine_s_own_order(tournament: dict, corpus) -> None:
    """`entities.*` has no declared order, so one is FIXED and pinned: the spine's.

    AD-8 requires byte-identical re-runs, and the spine is already sorted by `match_id`,
    `team_id` and `player_id`. Carried through rather than re-sorted, so the artifact and
    its input can never disagree about it.
    """
    entities, _matches = corpus
    assert ([row["matchId"] for row in tournament["entities"]["matches"]]
            == [row["match_id"] for row in entities["matches"]])
    assert ([row["teamId"] for row in tournament["entities"]["teams"]]
            == [row["team_id"] for row in entities["teams"]])
    assert ([row["playerId"] for row in tournament["entities"]["players"]]
            == [row["player_id"] for row in entities["players"]])


# ------------------------------------------------------- AC 5: reproducible from the bundles
def test_standings_reproduce_the_tables_recomputed_from_the_committed_bundles(
        tournament: dict, bundles: "list[dict]") -> None:
    """Recomputed from a SECOND source, not restated from the emitter.

    The emitter reaches the 90-minute score through the spine and `emit._knockout_score`;
    this walks the committed bundles' own `metadata.knockoutScore.scoreAfter90`. The two
    paths agreeing is evidence; the emitter agreeing with itself would not be.
    """
    tally: "dict[str, dict]" = defaultdict(
        lambda: dict(played=0, won=0, drawn=0, lost=0, goalsFor=0, goalsAgainst=0, points=0))
    for bundle in bundles:
        metadata = bundle["metadata"]
        if metadata["stage"] != "group":
            continue
        score = metadata["knockoutScore"]["scoreAfter90"]
        home = metadata["homeTeam"]["teamId"]
        away = metadata["awayTeam"]["teamId"]
        for team_id, scored, conceded in ((home, score["home"], score["away"]),
                                          (away, score["away"], score["home"])):
            row = tally[team_id]
            row["played"] += 1
            row["goalsFor"] += scored
            row["goalsAgainst"] += conceded
            if scored > conceded:
                row["won"] += 1
                row["points"] += 3
            elif scored == conceded:
                row["drawn"] += 1
                row["points"] += 1
            else:
                row["lost"] += 1

    assert len(tally) == 48, f"recomputed {len(tally)} teams from the bundles, expected 48"
    seen = 0
    for group in tournament["groups"]:
        for row in group["standings"]:
            expected = tally[row["team"]["id"]]
            seen += 1
            for field in ("played", "won", "drawn", "lost", "goalsFor", "goalsAgainst",
                          "points"):
                assert row[field] == expected[field], (
                    f"{row['team']['id']}.{field}: artifact {row[field]}, bundles "
                    f"{expected[field]}")
            assert row["goalDifference"] == expected["goalsFor"] - expected["goalsAgainst"]
    assert seen == 48


def test_the_computed_qualifiers_are_the_real_round_of_32_field(tournament: dict) -> None:
    """Ground truth, and the strongest reproducibility evidence available.

    The 2026 format sends 12 group winners, 12 runners-up and the 8 best third-placed teams
    to the Round of 32, and the real R32 participants are in the corpus. A cascade error
    that every internal-consistency test would miss shows up here immediately.
    """
    winners, runners, thirds = [], [], []
    for group in tournament["groups"]:
        standings = group["standings"]
        winners.append(standings[0])
        runners.append(standings[1])
        thirds.append(standings[2])
    assert len(winners) == 12 and len(runners) == 12

    best_thirds = sorted(
        thirds,
        key=lambda row: (-row["points"], -row["goalDifference"], -row["goalsFor"],
                         row["team"]["id"]))[:8]
    computed = ({row["team"]["id"] for row in winners}
                | {row["team"]["id"] for row in runners}
                | {row["team"]["id"] for row in best_thirds})

    real = set()
    for row in tournament["knockoutResults"]:
        if row["stage"] == "r32":
            real.add(row["homeTeam"]["id"])
            real.add(row["awayTeam"]["id"])
    assert len(real) == 32, f"the corpus has {len(real)} R32 participants"
    assert computed == real, (
        f"computed qualifiers do not reproduce the real R32 field; "
        f"computed-only {sorted(computed - real)}, real-only {sorted(real - computed)}")


def test_every_result_row_reproduces_its_committed_bundle(
        tournament: dict, bundles: "list[dict]") -> None:
    """Scores, venues and knockout decisions come from the same reality the bundles do."""
    by_id = {bundle["matchId"]: bundle for bundle in bundles}
    rows = [row for group in tournament["groups"] for row in group["results"]]
    rows += tournament["knockoutResults"]
    assert len(rows) == len(by_id), f"{len(rows)} result rows against {len(by_id)} bundles"
    for row in rows:
        metadata = by_id[row["matchId"]]["metadata"]
        assert row["score"] == {"home": metadata["score"]["home"],
                                "away": metadata["score"]["away"]}
        assert row["knockoutScore"] == metadata["knockoutScore"]
        assert row["venue"] == metadata["venue"]
        assert row["stage"] == metadata["stage"]
        assert row["group"] == metadata["group"]
        assert row["matchNumber"] == metadata["matchNumber"]


def test_group_is_non_null_exactly_on_group_stage_rows(tournament: dict) -> None:
    rows = [row for group in tournament["groups"] for row in group["results"]]
    rows += tournament["knockoutResults"]
    for row in rows:
        assert (row["group"] is not None) == (row["stage"] == "group"), (
            f"{row['matchId']}: stage {row['stage']!r} with group {row['group']!r}")


def test_knockout_score_is_present_on_group_rows_too(tournament: dict) -> None:
    """It is a bare non-nullable `$ref` in `MatchResultRow.required` — no stage branch.

    Drawn group ties carry `winnerTeamId: null`, and that null is legal.
    """
    group_rows = [row for group in tournament["groups"] for row in group["results"]]
    assert group_rows
    drawn = 0
    for row in group_rows:
        knockout = row["knockoutScore"]
        assert knockout["decidedBy"] == "regulation"
        assert knockout["scoreAfterET"] is None and knockout["shootoutScore"] is None
        if knockout["winnerTeamId"] is None:
            drawn += 1
    assert drawn > 0, "no drawn group tie was walked; the null branch is unexercised"


# --------------------------------------------------------------- D4a: the two played fields
def test_the_team_record_counts_every_match_not_only_the_group_stage(
        tournament: dict, bundles: "list[dict]") -> None:
    """`TeamRecord` is the TOURNAMENT record (D4a), recomputed from the bundles.

    It backs the Team Profile's "name + tournament record" OG string. `StandingsRow.played`
    is a group table and is necessarily group-only; the two differ for most teams that
    reached a knockout round, and that divergence is asserted here rather than left to be
    discovered on screen.
    """
    tally: "dict[str, dict]" = defaultdict(
        lambda: dict(played=0, won=0, drawn=0, lost=0, goalsFor=0, goalsAgainst=0))
    for bundle in bundles:
        metadata = bundle["metadata"]
        score = metadata["score"]
        home, away = metadata["homeTeam"]["teamId"], metadata["awayTeam"]["teamId"]
        for team_id, scored, conceded in ((home, score["home"], score["away"]),
                                          (away, score["away"], score["home"])):
            row = tally[team_id]
            row["played"] += 1
            row["goalsFor"] += scored
            row["goalsAgainst"] += conceded
            if scored > conceded:
                row["won"] += 1
            elif scored == conceded:
                row["drawn"] += 1
            else:
                row["lost"] += 1

    standings_played = {row["team"]["id"]: row["played"]
                        for group in tournament["groups"] for row in group["standings"]}
    differ = 0
    for team in tournament["entities"]["teams"]:
        assert team["record"] == tally[team["teamId"]], (
            f"{team['teamId']}: record {team['record']} != recomputed {tally[team['teamId']]}")
        if team["record"]["played"] != standings_played[team["teamId"]]:
            differ += 1
    assert differ > 0, (
        "no team's tournament record differs from its group played count — either the "
        "corpus has no knockout stage or D4a was not implemented")


def test_a_shootout_tie_is_a_draw_for_both_teams_in_the_tournament_record(
        tournament: dict) -> None:
    """The standard convention, and the reason `winnerTeamId` stays in `knockoutScore`.

    A record crediting the shoot-out winner with a win would disagree with every published
    table of the same tournament. Derived from the artifact's own knockout rows rather than
    restated: every match contributes exactly two team-matches, and every level final score
    contributes exactly two draws.
    """
    rows = [row for group in tournament["groups"] for row in group["results"]]
    rows += tournament["knockoutResults"]
    level = [row for row in rows if row["score"]["home"] == row["score"]["away"]]
    shootouts = [row for row in rows
                 if row["knockoutScore"]["decidedBy"] == "shootout"]
    assert shootouts, "no shoot-out in the corpus; this convention is unexercised"
    for row in shootouts:
        assert row["score"]["home"] == row["score"]["away"]
        assert row["knockoutScore"]["winnerTeamId"] is not None

    records = [team["record"] for team in tournament["entities"]["teams"]]
    assert sum(record["played"] for record in records) == 2 * len(rows)
    assert sum(record["drawn"] for record in records) == 2 * len(level)


def test_the_team_record_carries_no_points_and_no_goal_difference(tournament: dict) -> None:
    """The contract omits both; a tournament-wide points total is not a defined thing."""
    for team in tournament["entities"]["teams"]:
        assert sorted(team["record"]) == [
            "drawn", "goalsAgainst", "goalsFor", "lost", "played", "won"]


# --------------------------------------------------------------- the route manifest (AC 3)
def test_the_manifest_lists_every_player_including_those_with_no_performance_row(
        tournament: dict, bundles: "list[dict]") -> None:
    """AC 3: "empty sections allowed, absence not."

    The lineup-only players have no Domain G row, so Story 1.18 must still emit a near-empty
    profile for each. Filtering them out of the manifest deletes exactly that many routes.
    """
    listed = {row["playerId"] for row in tournament["entities"]["players"]}
    with_rows = {player["playerId"] for bundle in bundles for player in bundle["players"]}
    assert with_rows < listed, (
        "every listed player has a performance row; the lineup-only case is unexercised")
    assert with_rows <= listed
    lineup_only = listed - with_rows
    assert lineup_only, "no lineup-only player is listed — 209 routes would be missing"


def test_every_committed_bundle_is_named_by_the_manifest(
        tournament: dict, bundles_dir: Path) -> None:
    notes = index_module.check_route_manifest(tournament, bundles_dir.parent)
    assert any("bijection holds" in note for note in notes)


def test_an_orphan_committed_bundle_fails_the_route_manifest_gate(
        tournament: dict, tmp_path: Path) -> None:
    """CONSTRUCTED — the checkable direction of AD-4's bijection, driven RED."""
    matches = tmp_path / "matches"
    matches.mkdir()
    for row in tournament["entities"]["matches"][:3]:
        (matches / f"{row['matchId']}.json").write_text("{}", encoding="utf-8")
    (matches / "m999-nobody-nobody.json").write_text("{}", encoding="utf-8")
    with pytest.raises(RouteManifestError, match="named by no entities.matches"):
        index_module.check_route_manifest(tournament, tmp_path)


def test_a_listed_match_with_no_committed_bundle_fails_the_route_manifest_gate(
        tournament: dict, tmp_path: Path) -> None:
    """CONSTRUCTED — absence is never allowed, only emptiness is."""
    matches = tmp_path / "matches"
    matches.mkdir()
    for row in tournament["entities"]["matches"][:3]:
        (matches / f"{row['matchId']}.json").write_text("{}", encoding="utf-8")
    with pytest.raises(RouteManifestError, match="listed with no committed bundle"):
        index_module.check_route_manifest(tournament, tmp_path)


def test_the_profile_direction_reports_that_it_could_not_run_and_never_a_pass(
        tournament: dict, tmp_path: Path) -> None:
    """D2: the unavailable branch must say, in words, that this is NOT a pass.

    A `if not exists: return []` here would be a gate that cannot fail — which reads
    greener than no gate while proving strictly less.
    """
    (tmp_path / "matches").mkdir()
    for row in tournament["entities"]["matches"]:
        (tmp_path / "matches" / f"{row['matchId']}.json").write_text("{}", encoding="utf-8")
    notes = index_module.check_route_manifest(tournament, tmp_path)
    unavailable = [note for note in notes if "profile baseline unavailable" in note]
    assert len(unavailable) == 2, "both profile namespaces must report their absence"
    for note in unavailable:
        assert "This is NOT a pass." in note


def test_the_route_manifest_bijection_holds_against_the_committed_profiles(
        repo_root: Path, tracked_profiles: "set[str]") -> None:
    """AD-4's bijection, asserted for real. **This is Story 1.17's half of ruling R3.**

    It replaces `test_the_repository_has_no_committed_profiles_yet`, which was red by design
    from the moment Story 1.18 landed and whose own docstring named the work: "delete this
    test, and assert the populated bijection here instead." Story 1.18 emitted the 1,296
    profile artifacts, so `check_route_manifest`'s populated branch — live but unexercised
    on real data until now — becomes primary here.

    R3 put the assert with the AUTHORITY rather than with the emitter: 1.17 owns
    `tournament.json`, so the check lives beside the manifest and cannot go stale. Story
    1.18 asserts only the weaker unilateral property (one artifact per registry-pinned
    entity) and PRINTS that the manifest bijection is not asserted there, so the gap was
    visible rather than silent for as long as it existed.

    **Guarded on TRACKED profiles by the 1.17 code review.** As written this read the
    working tree, where a concurrent 1.18 session's untracked output happened to sit — so it
    passed here and failed on every clean checkout, which is where committed tests are
    supposed to be green.

    **The swap has HAPPENED (Story 1.19).** 1.18's 1,296 artifacts are committed, so this no
    longer skips — it runs and asserts all three directions on real data. Its tripwire
    counterpart fired at that same moment and was removed by 1.19, as that test's own
    docstring instructed; see the note below where it stood. The guard is kept rather than
    deleted, because it is what keeps this test honest on a checkout that does not yet have
    the artifacts — a bijection asserted over an absent namespace is the gate-that-cannot-fail
    this pair exists to rule out.
    """
    if not tracked_profiles:
        pytest.skip("no profile artifacts are tracked; a bijection cannot be asserted over an "
                    "absent namespace. On a normal checkout this never fires — the 1,296 "
                    "artifacts have been committed since Story 1.18.")
    tournament = json.loads(
        (repo_root / "data" / "index" / "tournament.json").read_text(encoding="utf-8"))
    notes = index_module.check_route_manifest(tournament, repo_root / "data")
    joined = " | ".join(notes)
    assert "NOT a pass" not in joined, (
        f"a direction of the bijection could not run: {joined}")
    assert "matches: 104 committed bundle(s) <-> 104 listed route(s)" in joined
    assert "teams: 48 profile(s) <-> 48 listed route(s)" in joined
    assert "players: 1248 profile(s) <-> 1248 listed route(s)" in joined


# `test_the_repository_has_no_committed_profiles_yet` stood here and was REMOVED by Story
# 1.19, which is the story that saw it fire. It was Story 1.17's tripwire, red by design from
# the moment Story 1.18 committed its 1,296 profile artifacts, and its own docstring named the
# action: "**When it fires, delete this test — do not weaken it.** The populated bijection
# above is its replacement and needs no further work."
#
# It fired, and the pair swapped over together exactly as designed: with the profiles tracked,
# `test_the_route_manifest_bijection_holds_against_the_committed_profiles` above no longer
# skips — it RUNS and asserts all three directions on real data, verified before this deletion
# rather than after. The tripwire had therefore done its whole job, and leaving it in place
# would have meant Epic 1's acceptance story reporting a permanently red suite for a test whose
# purpose was to become red.
#
# Recorded rather than silently dropped, because a deleted test is invisible in a diff read
# from the outside, and because this is the one deletion in Story 1.19's change set.


def test_a_profile_namespace_that_exists_is_asserted_rather_than_skipped(
        tournament: dict, tmp_path: Path) -> None:
    """CONSTRUCTED — the branch that goes live when 1.18 lands is exercised NOW.

    Without this the populated branch would ship untested and the successor would inherit a
    gate nobody has ever seen run.
    """
    (tmp_path / "matches").mkdir()
    for row in tournament["entities"]["matches"]:
        (tmp_path / "matches" / f"{row['matchId']}.json").write_text("{}", encoding="utf-8")
    profiles = tmp_path / "index" / "team-profiles"
    profiles.mkdir(parents=True)
    for team in tournament["entities"]["teams"][:5]:
        (profiles / f"{team['teamId']}.json").write_text("{}", encoding="utf-8")
    with pytest.raises(RouteManifestError, match="team-profiles"):
        index_module.check_route_manifest(tournament, tmp_path)


# ------------------------------------------------------------------- D1: the cascade gate
def _standings_row(team_id: str, points: int, goal_difference: int, goals_for: int) -> dict:
    return {"rank": 0, "team": {"id": team_id, "name": team_id.title()},
            "points": points, "goalDifference": goal_difference, "goalsFor": goals_for}


def test_CONSTRUCTED_a_tie_surviving_the_implemented_cascade_raises() -> None:
    """D1: tiers 1-3 are implemented and exhaustion RAISES rather than inventing an order.

    This branch never fires on the real corpus — every within-group tie separates at goal
    difference — so it is exercisable only by construction. That is precisely why it needs
    a test: a gate proven only by never firing proves nothing at all.
    """
    rows = [_standings_row("alpha", 6, 2, 5), _standings_row("beta", 6, 2, 5)]
    with pytest.raises(TiebreakUnresolvedError) as caught:
        index_module._check_tiebreaks(rows, "group 'z'")
    message = str(caught.value)
    assert "alpha" in message and "beta" in message, "the tied teams must be named"
    assert "6 pts" in message and "GD 2" in message and "5 scored" in message
    assert "do not invent an order" in message


def test_CONSTRUCTED_a_tie_broken_at_each_tier_does_not_raise() -> None:
    """The three tiers are separately load-bearing, so each is separately exercised."""
    index_module._check_tiebreaks(
        [_standings_row("a", 7, 2, 5), _standings_row("b", 6, 2, 5)], "tier 1")
    index_module._check_tiebreaks(
        [_standings_row("a", 6, 3, 5), _standings_row("b", 6, 2, 5)], "tier 2")
    index_module._check_tiebreaks(
        [_standings_row("a", 6, 2, 6), _standings_row("b", 6, 2, 5)], "tier 3")


def test_CONSTRUCTED_the_cascade_orders_by_points_then_difference_then_goals() -> None:
    rows = [
        _standings_row("d", 4, 0, 3),
        _standings_row("a", 9, 5, 7),
        _standings_row("c", 4, 0, 4),
        _standings_row("b", 4, 2, 3),
    ]
    rows.sort(key=index_module._standings_key)
    assert [row["team"]["id"] for row in rows] == ["a", "b", "c", "d"]


def test_no_within_group_tie_survives_the_cascade_on_the_real_corpus(
        tournament: dict) -> None:
    """Measured, not assumed: the corpus resolves every group tie at goal difference."""
    for group in tournament["groups"]:
        keys = [(row["points"], row["goalDifference"], row["goalsFor"])
                for row in group["standings"]]
        assert len(set(keys)) == len(keys), f"group {group['group']} carries a surviving tie"


# --------------------------------------------------------------------- precision (Task 2)
def test_the_tournament_precision_map_resolves_without_the_float_guard() -> None:
    """`tournament.json` genuinely has no float field, so an all-integer map is CORRECT.

    The vacuity guard reasons "only integer precisions ⇒ the `$ref` hop failed", which is
    true of the Match Bundle and false here. It is opted out of at this one call site and
    stays armed everywhere else.
    """
    places = decimals_map(index_module.TOURNAMENT_SCHEMA, require_float=False)
    assert places and all(value == 0 for value in places.values())
    assert sorted(places) == ["Count", "GoalDifference", "Rank", "ResultMatchNumber"]


def test_the_float_guard_is_still_armed_by_default() -> None:
    """The opt-out must be per call site, never a blanket `try/except AssertionError`."""
    with pytest.raises(AssertionError, match="found only integer precisions"):
        decimals_map(index_module.TOURNAMENT_SCHEMA)


def test_the_bundle_precision_map_is_unchanged_by_this_story() -> None:
    """The anyOf-aware inline pass adds exactly one name, and not to this document.

    Stated as a test because a change here would move committed Match Bundle bytes, which
    is the one thing this story must not do.
    """
    places = decimals_map("match-bundle.schema.json")
    assert places == {
        "Count": 0, "ExpectedGoals": 2, "Kilometres": 2, "KmPerHour": 1, "Metres": 1,
        "Minute": 0, "Percentage": 1, "PitchX": 2, "PitchY": 2, "ShirtNumber": 0,
        "StoppageMinute": 0, "MatchNumber": 0, "MomentumHomeValue": 0,
        "MomentumAwayValue": 0, "ShootoutOrder": 0, "PassNetworkEdgeVolume": 0,
    }


def test_check_total_reaches_the_index_documents_without_forking(tournament: dict) -> None:
    """`check_total(row, "StandingsRow", …)` raised `KeyError` before this story."""
    from pipeline.precompute.emit import check_total
    row = tournament["groups"][0]["standings"][0]
    check_total(row, "StandingsRow", "probe", index_module.TOURNAMENT_DOCUMENTS)
    with pytest.raises(KeyError):
        check_total(row, "StandingsRow", "probe")


def test_CONSTRUCTED_a_leaf_bound_to_the_wrong_precision_is_caught(
        tournament: dict) -> None:
    """Mutation check: the precision binding itself must be able to go red.

    Copied from `test_a_key_bound_to_the_wrong_precision_is_caught` — monkeypatch the
    binding table and assert the ROUNDING changes. A precision test that cannot notice a
    wrong binding is a test that walks nothing.
    """
    sample = {"goalDifference": 2.6, "played": 3}
    places = {"GoalDifference": 0, "Count": 0, "Wrong": 2}
    correct = index_module.round_index(sample, places,
                                       {"goalDifference": "GoalDifference",
                                        "played": "Count"})
    assert correct == {"goalDifference": 3, "played": 3}
    mutated = index_module.round_index(sample, places,
                                       {"goalDifference": "Wrong", "played": "Count"})
    assert mutated["goalDifference"] == 2.6, (
        "re-binding the leaf changed nothing; this test proves no binding")


def test_CONSTRUCTED_an_unbound_leaf_rounds_by_nothing_rather_than_inheriting() -> None:
    """Precision inheritance silently truncated 29 leaves in Story 1.16.

    An unbound key must be left ALONE, never rounded to whatever its parent declares.
    """
    sample = {"outer": {"played": 3, "unbound": 19.5}}
    result = index_module.round_index(sample, {"Count": 0}, {"played": "Count"})
    assert result["outer"]["unbound"] == 19.5
    assert result["outer"]["played"] == 3


def test_CONSTRUCTED_a_leaf_bound_to_a_type_the_document_does_not_declare_raises() -> None:
    with pytest.raises(IndexEmitError, match="rounds by nothing"):
        index_module.round_index({"played": 3}, {"Count": 0}, {"played": "Absent"})


# ------------------------------------------------- match routing (code review, 2026-08-07)
def _routable_entities() -> dict:
    """The smallest `entities.json` that routes cleanly: two teams, one group match."""
    return {
        "teams": [
            {"team_id": "alpha", "name": "Alpha", "team_code": "ALP", "group": "a"},
            {"team_id": "beta", "name": "Beta", "team_code": "BET", "group": "a"},
        ],
        "matches": [
            {"match_id": "m001-alpha-beta", "stage": "group", "group": "a",
             "home_team_id": "alpha", "away_team_id": "beta"},
        ],
        "players": [{"player_id": "p", "name": "P", "team_id": "alpha"}],
    }


def test_the_routing_check_passes_the_real_corpus(spine_dir: Path) -> None:
    """The guard must not fire on 104 real matches — otherwise the red tests below prove
    only that it fires on everything."""
    entities, _matches = load_spine(spine_dir)
    index_module.check_match_routing(entities, "entities.json")


def test_CONSTRUCTED_a_group_match_whose_group_names_no_team_is_caught() -> None:
    """It would appear in NO group table and in NO knockout list — silently dropped.

    The two filters that section the artifact are not a partition, and the group tally
    would still count the match, so the table publishes a `played` that its own `results`
    array cannot account for.
    """
    entities = _routable_entities()
    entities["matches"][0]["group"] = "z"
    with pytest.raises(IndexEmitError, match="names no team's group"):
        index_module.check_match_routing(entities, "entities.json")


def test_CONSTRUCTED_a_group_row_with_a_null_group_is_caught() -> None:
    entities = _routable_entities()
    entities["matches"][0]["group"] = None
    with pytest.raises(IndexEmitError, match="non-null iff"):
        index_module.check_match_routing(entities, "entities.json")


def test_CONSTRUCTED_a_knockout_row_carrying_a_group_letter_is_caught() -> None:
    """`ResultGroup` is `anyOf [Group, null]`, so the schema cannot object to this."""
    entities = _routable_entities()
    entities["matches"][0]["stage"] = "r32"
    with pytest.raises(IndexEmitError, match="non-null iff"):
        index_module.check_match_routing(entities, "entities.json")


def test_CONSTRUCTED_a_duplicated_match_row_is_caught() -> None:
    """`_tally` iterates the list while the result rows dedup into a dict, so a duplicate
    double-counts the standings against a `results` array carrying the row once."""
    entities = _routable_entities()
    entities["matches"].append(dict(entities["matches"][0]))
    with pytest.raises(IndexEmitError, match="listed more than once"):
        index_module.check_match_routing(entities, "entities.json")


def test_CONSTRUCTED_a_match_naming_an_unlisted_team_is_typed_rather_than_a_KeyError() -> None:
    """It reached `team_name[...]` as a bare `KeyError` three frames down."""
    entities = _routable_entities()
    entities["matches"][0]["away_team_id"] = "gamma"
    with pytest.raises(IndexEmitError, match="names no entities.teams entry"):
        index_module.check_match_routing(entities, "entities.json")


def test_CONSTRUCTED_a_team_named_by_no_match_is_caught() -> None:
    """`_tally` returns a `defaultdict`, so it would ship an all-zero `TeamRecord` and
    contribute no `GroupTable` — an artifact silently missing a whole group."""
    entities = _routable_entities()
    entities["teams"].append(
        {"team_id": "gamma", "name": "Gamma", "team_code": "GAM", "group": "c"})
    with pytest.raises(IndexEmitError, match="named by no match"):
        index_module.check_match_routing(entities, "entities.json")


def test_CONSTRUCTED_a_team_with_a_null_group_is_typed_rather_than_a_TypeError() -> None:
    """`sorted(by_group)` raised `TypeError: '<' not supported between str and NoneType`."""
    entities = _routable_entities()
    entities["teams"][1]["group"] = None
    with pytest.raises(IndexEmitError, match="non-string group"):
        index_module.check_match_routing(entities, "entities.json")


# --------------------------------------------- AD-3 immutability (code review, 2026-08-07)
def test_CONSTRUCTED_an_unregistered_id_in_a_committed_index_artifact_is_caught(
        tournament: dict, tmp_path: Path) -> None:
    """The gap `check_index_ids` structurally cannot close, and the walk that closes it.

    `check_index_ids` validates ids against `tournament["entities"]` — the manifest embedded
    in the artifact it is checking — so a manifest entry that nothing else cross-references
    pins itself. 581 of the 1,248 player routes hold no board row after the cap and are in
    exactly that position: corrupting one passes `check_index_ids` silently.

    `identity.check_committed_data` closes it by pinning against the slug REGISTRY, a source
    outside the artifact entirely. This drives that walk red on precisely the id the other
    check cannot see.
    """
    from pipeline.precompute.identity import check_committed_data
    from pipeline.precompute.slug_registry import PINS

    index_dir = tmp_path / "index"
    index_dir.mkdir()
    corrupted = copy.deepcopy(tournament)
    victim = corrupted["entities"]["players"][0]
    victim["playerId"] = "totally-bogus-not-a-player"
    (index_dir / "tournament.json").write_text(
        json.dumps(corrupted), encoding="utf-8")

    # `check_index_ids` cannot see it: the id is self-consistent within the artifact.
    index_module.check_index_ids(corrupted, {"schemaVersion": 4, "boards": []})

    # The registry walk RAISES on an unpinned id rather than reporting it as a note, so the
    # CLI maps it to exit 1 and no run can proceed past it.
    with pytest.raises(SlugRegistryError, match="totally-bogus-not-a-player"):
        check_committed_data(
            PINS, tmp_path, globs=("index/*.json",), id_keys=index_module._ID_KEY_KIND,
            unavailable=index_module.INDEX_BASELINE_UNAVAILABLE, noun="index artifact")


def test_an_absent_index_baseline_reports_unavailable_and_never_success(
        tmp_path: Path) -> None:
    """"No artifacts" must never read as "all pinned" — the rule this project broke three
    times. The message names the DIRECTORY, matching the shipped precedent."""
    from pipeline.precompute.identity import check_committed_data
    from pipeline.precompute.slug_registry import PINS

    notes = check_committed_data(
        PINS, tmp_path, globs=("index/*.json",), id_keys=index_module._ID_KEY_KIND,
        unavailable=index_module.INDEX_BASELINE_UNAVAILABLE, noun="index artifact")
    assert len(notes) == 1
    assert "This is NOT a pass." in notes[0]
    assert "all pinned" not in notes[0]


def test_the_bare_entity_ref_id_is_deliberately_absent_from_the_registry_map() -> None:
    """The two checks divide the id space, and the division must stay explicit.

    `_ID_KEY_KIND` holds only keys whose namespace is fixed by the key NAME, because that is
    all `check_committed_data` can classify. `EntityRef`'s bare `"id"` is fixed by CONTEXT
    and belongs to `check_index_ids`, which supplies the board's scope per slot. Adding
    `"id"` here would silently classify every player ref as a team ref, or vice versa.
    """
    assert "id" not in index_module._ID_KEY_KIND
    assert set(index_module._ID_KEY_KIND) == {
        "matchId", "teamId", "playerId", "winnerTeamId", "scorerPlayerId"}
    # And the context-classified side really does carry it, so nothing falls between them.
    assert index_module._REF_SLOT_KIND, "no EntityRef slots are classified by context"


def test_every_listed_match_appears_in_exactly_one_emitted_section(
        tournament: dict) -> None:
    """The output half of the routing guard, over the real corpus.

    `--expect-matches` counts the INPUT and the bundle files; nothing counted the emitted
    rows, so a filter change dropping a match was invisible to every shipped assertion.
    """
    emitted = [row["matchId"] for table in tournament["groups"]
               for row in table["results"]]
    emitted += [row["matchId"] for row in tournament["knockoutResults"]]
    listed = [row["matchId"] for row in tournament["entities"]["matches"]]
    assert sorted(emitted) == sorted(listed)
    assert len(emitted) == len(set(emitted)), "a match appears in two sections"


# ------------------------------------------------------------------- id containment (5.2)
def test_every_id_in_the_artifact_is_pinned_by_the_manifest(
        tournament: dict, corpus, bundles: "list[dict]") -> None:
    entities, matches = corpus
    leaderboards = index_module.build_leaderboards(entities, matches, bundles)
    index_module.check_index_ids(tournament, leaderboards)


def test_CONSTRUCTED_an_unpinned_id_fails_the_containment_gate(
        tournament: dict, corpus, bundles: "list[dict]") -> None:
    """The gate `check_committed_data` structurally cannot provide, driven RED.

    `COMMITTED_ID_KEYS` holds seven contract field names and none of them is the bare
    `"id"` that `EntityRef` uses, so every id in `data/index/` is outside AD-3's walk. This
    story asserts its own containment instead — and proves it can fail.
    """
    entities, matches = corpus
    leaderboards = index_module.build_leaderboards(entities, matches, bundles)
    mutated = copy.deepcopy(tournament)
    mutated["groups"][0]["standings"][0]["team"]["id"] = "atlantis"
    with pytest.raises(RouteManifestError, match="atlantis"):
        index_module.check_index_ids(mutated, leaderboards)


def test_CONSTRUCTED_a_null_id_is_reported_rather_than_skipped(
        tournament: dict, corpus, bundles: "list[dict]") -> None:
    """A null `playerId` must be a finding; only `winnerTeamId` is contract-nullable."""
    entities, matches = corpus
    leaderboards = index_module.build_leaderboards(entities, matches, bundles)
    mutated = copy.deepcopy(tournament)
    mutated["entities"]["players"][0]["playerId"] = None
    with pytest.raises(RouteManifestError, match="non-string players id"):
        index_module.check_index_ids(mutated, leaderboards)


def test_the_id_containment_check_is_total_for_both_index_artifacts(
        tournament: dict, corpus, bundles: "list[dict]") -> None:
    """Task 5.3 — the covered set must EQUAL every key whose name ends in `id`.

    Modelled on `test_the_committed_id_check_is_total_for_a_match_bundle`. Without this the
    walk could quietly miss a whole slot and the run would still report "all pinned".
    """
    entities, matches = corpus
    leaderboards = index_module.build_leaderboards(entities, matches, bundles)

    def naive(node, path: str) -> "set[str]":
        found: "set[str]" = set()
        if isinstance(node, dict):
            for key, value in node.items():
                here = f"{path}.{key}"
                if key.lower().endswith("id"):
                    found.add(here)
                else:
                    found |= naive(value, here)
        elif isinstance(node, list):
            for position, item in enumerate(node):
                found |= naive(item, f"{path}[{position}]")
        return found

    expected = naive(tournament, "tournament")
    for position, board in enumerate(leaderboards["boards"]):
        expected |= naive(board, f"leaderboards.boards[{position}]")
    covered = {path for path, _key, _value, _kind
               in index_module.index_id_sites(tournament, leaderboards)}
    assert covered == expected, (
        f"the containment walk and a naive id-key walk disagree; "
        f"walked-not-expected {sorted(covered - expected)[:5]}, "
        f"expected-not-walked {sorted(expected - covered)[:5]}")
    assert len(covered) > 5000, f"only {len(covered)} id sites walked; expected thousands"


def test_CONSTRUCTED_a_bare_id_with_no_slot_context_raises_rather_than_guessing() -> None:
    """An unclassifiable id must never be walked past silently."""
    with pytest.raises(RouteManifestError, match="no slot context"):
        index_module.id_sites({"mystery": {"id": "who"}}, index_module._REF_SLOT_KIND)


# ----------------------------------------------------------------- serialization (AD-8)
def test_two_builds_are_byte_identical(corpus) -> None:
    entities, matches = corpus
    places = decimals_map(index_module.TOURNAMENT_SCHEMA, require_float=False)
    first = canonical_json(index_module.round_index(
        index_module.build_tournament(entities, matches), places,
        index_module.TOURNAMENT_LEAF_TYPES))
    second = canonical_json(index_module.round_index(
        index_module.build_tournament(entities, matches), places,
        index_module.TOURNAMENT_LEAF_TYPES))
    assert first == second


def test_the_canonical_text_is_lf_terminated_utf8_with_sorted_keys(
        tournament: dict) -> None:
    text = canonical_json(tournament)
    assert text.endswith("\n")
    assert "\r" not in text
    text.encode("utf-8")
    assert list(json.loads(text)) == sorted(json.loads(text))


# --------------------------------------------------------------------------- the CLI (7.6)
def test_the_cli_exits_zero_on_a_clean_dry_run_and_writes_nothing(
        repo_root: Path, spine_dir: Path, bundles_dir: Path, capsys) -> None:
    """A dry run is a promise about the FILESYSTEM, so the filesystem is what is asserted."""
    index_dir = repo_root / "data" / "index"
    before = sorted((path.name, path.stat().st_mtime_ns, path.stat().st_size)
                    for path in index_dir.glob("*.json")) if index_dir.is_dir() else []

    assert index_module.main([
        "--spine-dir", str(spine_dir), "--data-dir", str(bundles_dir.parent),
        "--expect-matches", "104", "--dry-run"]) == 0

    after = sorted((path.name, path.stat().st_mtime_ns, path.stat().st_size)
                   for path in index_dir.glob("*.json")) if index_dir.is_dir() else []
    assert before == after, "a dry run touched data/index/"
    printed = capsys.readouterr().out
    assert "INDEX RESULT: PASS" in printed
    assert "dry run, nothing written" in printed
    assert f"schemaVersion   : {schema_version()}" in printed


def test_the_cli_reports_both_profile_namespaces_rather_than_staying_silent(
        repo_root: Path, spine_dir: Path, bundles_dir: Path, capsys) -> None:
    """D2 at the surface a human actually reads — and it must hold in BOTH worlds.

    Before Story 1.18 the two namespaces report "This is NOT a pass."; after it they report
    a holding bijection. The invariant that matters is that each namespace says SOMETHING
    either way: silence is the failure mode this gate exists to prevent, and a test that
    only knew the pre-1.18 world would go red on a successor doing exactly the right thing.

    **Tightened by the 1.17 code review.** The count assertion was
    `count("NOT a pass") + count("bijection holds") >= 3`, which `check_route_manifest`
    satisfies by construction — it emits exactly three notes on every path, so the sum is 3
    whatever the notes SAY. Each namespace is now matched to its own verdict individually.
    """
    assert index_module.main([
        "--spine-dir", str(spine_dir), "--data-dir", str(bundles_dir.parent),
        "--dry-run"]) == 0
    printed = capsys.readouterr().out
    verdicts = 0
    for kind, folder in (("teams", "team-profiles"), ("players", "player-profiles")):
        directory = repo_root / "data" / "index" / folder
        populated = directory.is_dir() and any(directory.glob("*.json"))
        # The verdict must appear in the SAME note as the namespace, not merely somewhere in
        # the output — the previous form matched "bijection holds" anywhere on the page.
        note = next((line for line in printed.splitlines()
                     if line.strip().startswith(f"{kind}: ")), None) if populated else \
            next((line for line in printed.splitlines()
                  if directory.as_posix() in line), None)
        assert note is not None, f"the {kind} namespace reported nothing at all"
        assert ("bijection holds" in note) if populated else ("NOT a pass." in note)
        verdicts += 1
    matches_note = next((line for line in printed.splitlines()
                         if line.strip().startswith("matches: ")), None)
    assert matches_note is not None and "bijection holds" in matches_note
    verdicts += 1
    assert verdicts == 3, "each of matches, teams and players must report its own verdict"


def test_CONSTRUCTED_the_cli_headline_does_not_claim_pass_while_a_check_could_not_run(
        tmp_path: Path, monkeypatch, capsys) -> None:
    """`INDEX RESULT: PASS` must not sit in the same output as "This is NOT a pass."

    The 1.17 code review found the headline printed unconditionally, so on a fresh clone —
    or any checkout where the profile directories are absent — two of the three bijection
    directions did not run and the verdict a human reads still said PASS. The exit code is
    deliberately unchanged, because the gates that DID run passed; what changes is that the
    headline now names what this run does not prove.

    Emission is stubbed so the assertion is about the reporting path and nothing else: this
    drives the branch with a note the real `check_route_manifest` produces verbatim whenever
    a profile namespace is missing.
    """
    def fake_emit(*_args, notes=None, **_kwargs):
        if notes is not None:
            notes.append(index_module.PROFILE_BASELINE_UNAVAILABLE.format(
                path="data/index/team-profiles"))
        return [tmp_path / "tournament.json", tmp_path / "leaderboards.json"]

    monkeypatch.setattr(index_module, "emit_index", fake_emit)
    assert index_module.main(["--data-dir", str(tmp_path), "--dry-run"]) == 0
    printed = capsys.readouterr().out
    assert "This is NOT a pass." in printed
    assert "COULD NOT RUN" in printed, (
        "the headline claimed an unqualified PASS while a check could not run")
    assert "INDEX RESULT: PASS\n" not in printed, (
        "the unqualified headline is still being printed")


def test_the_cli_headline_is_unqualified_when_every_check_ran(
        tmp_path: Path, monkeypatch, capsys) -> None:
    """The other half: a run that proves everything must not be hedged.

    Without this, qualifying the headline could degenerate into always hedging, which is
    the same failure as always passing — it just reads the other way.
    """
    def fake_emit(*_args, notes=None, **_kwargs):
        if notes is not None:
            notes.append("matches: 104 committed bundle(s) <-> 104 listed route(s) "
                         "— bijection holds")
        return [tmp_path / "tournament.json"]

    monkeypatch.setattr(index_module, "emit_index", fake_emit)
    assert index_module.main(["--data-dir", str(tmp_path), "--dry-run"]) == 0
    printed = capsys.readouterr().out
    assert "INDEX RESULT: PASS\n" in printed
    assert "COULD NOT RUN" not in printed


def test_the_cli_exits_one_on_a_pipeline_error(
        spine_dir: Path, tmp_path: Path, capsys) -> None:
    """A finding about the data or the rule: someone must rule on it."""
    assert index_module.main([
        "--spine-dir", str(spine_dir), "--data-dir", str(tmp_path), "--dry-run"]) == 1
    assert "FAIL:" in capsys.readouterr().err


def test_the_cli_exits_one_when_the_expected_match_count_is_missed(
        spine_dir: Path, bundles_dir: Path, capsys) -> None:
    assert index_module.main([
        "--spine-dir", str(spine_dir), "--data-dir", str(bundles_dir.parent),
        "--expect-matches", "103", "--dry-run"]) == 1
    assert "expected 103" in capsys.readouterr().err


def test_the_cli_exits_two_on_a_missing_spine(tmp_path: Path, capsys) -> None:
    """A broken harness: nothing was learned, which is different news from a finding."""
    assert index_module.main([
        "--spine-dir", str(tmp_path / "absent"), "--data-dir", str(tmp_path),
        "--dry-run"]) == 2
    assert "could not run" in capsys.readouterr().err


def test_the_cli_exits_two_on_a_malformed_committed_bundle(
        spine_dir: Path, tmp_path: Path, capsys) -> None:
    """`json.JSONDecodeError` is a `ValueError`, so without naming it this would exit 1
    with a traceback and read as a finding about the data (Story 1.16 patch 5)."""
    matches = tmp_path / "matches"
    matches.mkdir()
    (matches / "m001-broken.json").write_text("{not json", encoding="utf-8")
    assert index_module.main([
        "--spine-dir", str(spine_dir), "--data-dir", str(tmp_path), "--dry-run"]) == 2
    assert "could not run" in capsys.readouterr().err


# ------------------------------------------------------------------ committed drift (7.5)
def test_the_committed_index_artifacts_are_exactly_what_the_emitter_produces(
        repo_root: Path, corpus, bundles: "list[dict]") -> None:
    """Compares BYTES, not parsed dicts.

    A hand-edited committed artifact — a re-ordered key, a nudged value, a stray newline —
    is invisible to a parsed comparison and is exactly what this catches. Copied from
    `test_the_committed_bundles_are_exactly_what_the_emitter_produces`.
    """
    index_dir = repo_root / "data" / "index"
    committed = sorted(index_dir.glob("*.json")) if index_dir.is_dir() else []
    if not committed:
        message = "no committed index artifacts under data/index"
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)

    entities, matches = corpus
    expected = {
        "tournament.json": canonical_json(index_module.round_index(
            index_module.build_tournament(entities, matches),
            decimals_map(index_module.TOURNAMENT_SCHEMA, require_float=False),
            index_module.TOURNAMENT_LEAF_TYPES)),
        "leaderboards.json": canonical_json(index_module.round_index(
            index_module.build_leaderboards(entities, matches, bundles),
            decimals_map(index_module.LEADERBOARDS_SCHEMA),
            index_module.LEADERBOARDS_LEAF_TYPES)),
    }
    assert {path.name for path in committed} == set(expected), (
        f"data/index/ holds {sorted(p.name for p in committed)}, the emitter produces "
        f"{sorted(expected)}")
    for path in committed:
        on_disk = path.read_bytes()
        rebuilt = expected[path.name].encode("utf-8")
        assert on_disk == rebuilt, (
            f"{path.name} on disk is {len(on_disk)} bytes and the emitter produces "
            f"{len(rebuilt)}; the committed artifact has drifted from its source")

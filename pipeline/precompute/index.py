"""The tournament index and the leaderboards (Story 1.17, FR-19 / FR-26, AD-4 / AD-5).

Two artifacts, `data/index/tournament.json` and `data/index/leaderboards.json`, emitted
together or not at all. The Hub renders both verbatim: AD-5 reserves every aggregation to
this module and forbids the App re-sorting, re-ranking or re-summing anything it reads.

**This story is a pure projection.** Every number published here already exists in
`work/spine/entities.json` or in a committed Match Bundle. It mints no id, parses no PDF,
and derives nothing the bundles do not contain (FR-19: "precompute adds no data the
bundles don't contain"). Its whole job is to aggregate, order, rank, serialize and gate.

**Source of truth, stated because two sources exist and silent divergence would be
unfalsifiable.** `work/spine/` is THE input for match identity, scheduling and scores — it
is what `emit.py` reads, and `data/matches/` is a downstream product of it. The committed
bundles are read for exactly one thing: the per-team `keyStatistics` and per-player
Domain G stat blocks the spine stages but does not reshape. Nothing is read from both.

**The five decisions this module implements were ruled before a line was written**
(Story 1.17 D1-D5); each is recorded at the site that implements it:

* D1 the tiebreaker cascade -> `_standings_key` and `_check_tiebreaks`
* D2 the AD-4 bijection ordering -> `check_route_manifest`
* D3 the combined budget and the row cap -> `budget.over_budget_combined`, `PLAYER_ROW_CAP`
* D4 what `played` and `matchesPlayed` count -> `_team_record` and `_board_rows`
* D5 the board roster and its order -> `BOARDS`
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from pipeline.discover.rounds import KNOCKOUT_ROUNDS
from pipeline.errors import PipelineError
from pipeline.ingest.records import canonical_json, write_canonical
from pipeline.precompute.budget import BUDGET_BYTES, over_budget, over_budget_combined
from pipeline.precompute.emit import (
    _goals,
    _knockout_score,
    check_total,
    load_spine,
)
from pipeline.precompute.errors import (
    BudgetExceededError,
    BundleValidationError,
    IndexEmitError,
    RouteManifestError,
    TiebreakUnresolvedError,
)
from pipeline.precompute.identity import check_committed_data
from pipeline.precompute.slug_registry import PINS
from pipeline.precompute.serialize import (
    _declared_places,
    decimals_map,
    round_to_precision,
)
from pipeline.validate.errors import SchemaValidationError
from pipeline.validate.schema import load_schemas, schema_version, validate_artifact

TOURNAMENT_SCHEMA = "tournament.schema.json"
LEADERBOARDS_SCHEMA = "leaderboards.schema.json"

# The document pair each artifact's `$def`s are declared across. `check_total` is
# parameterized rather than forked so the index objects get the same totality assertion the
# Match Bundle's do — see `emit._def_properties`.
TOURNAMENT_DOCUMENTS = (TOURNAMENT_SCHEMA, "common.schema.json")
LEADERBOARDS_DOCUMENTS = (LEADERBOARDS_SCHEMA, "common.schema.json")

DEFAULT_SPINE_DIR = Path("work") / "spine"
DEFAULT_DATA_DIR = Path("data")

# A proper noun, not a translated label (AD-7). It is not printed in the corpus and not
# carried by the spine, so it is declared once here rather than in two artifacts.
#
# **This is the ONE published value this module does not derive, and the 1.17 code review
# asked for it to be said out loud.** FR-19 is "precompute adds no data the bundles don't
# contain", and strictly this adds one string. It is admitted rather than smuggled: the
# contract requires `tournamentName`, no source in the repository prints it, and the
# alternatives are worse — deriving it from a filename would be the id-minting this module
# forbids everywhere else, and leaving it out fails validation. Pinned by
# `test_the_tournament_name_is_declared_once_and_pinned` so it cannot drift silently, and
# recorded in `pipeline/README.md` alongside the other Story 1.17 rulings.
TOURNAMENT_NAME = "FIFA World Cup 2026"

# --------------------------------------------------------------------------- D5: the roster
#
# 36 boards: 18 team-scope and 18 player-scope, emitted family-major and, within a family,
# team boards before player boards. **The order IS the contract.** AD-5 makes array order
# the App's default order and `Leaderboard` carries no group/category field, so Story 2.13
# sections this surface from `metricCode` alone — the family grouping is expressed by
# adjacency and by nothing else. Re-ordering this tuple silently re-sections the App.
#
# The scope rule is the contract's, not a preference: a team-scope code names a
# `TeamKeyStatistics` field and a player-scope code names a Domain G field, and two scopes
# may name one concept differently (`completedLineBreaks` team / `lineBreaksCompleted`
# player, `distanceCovered` team in kilometres / `totalDistance` player in metres). All 32
# codes were verified against a real bundle; every one resolves and there are no orphans.
#
# (family, metricCode, scope, aggregation, higherIsBetter)
BOARDS: "tuple[tuple[str, str, str, str, bool], ...]" = (
    ("physical", "distanceCovered", "team", "sum", True),
    ("physical", "sprintDistance", "team", "sum", True),
    ("physical", "topSpeed", "player", "max", True),
    ("physical", "sprints", "player", "sum", True),
    ("physical", "highSpeedRuns", "player", "sum", True),
    ("physical", "totalDistance", "player", "sum", True),

    ("attacking", "goals", "team", "sum", True),
    ("attacking", "expectedGoals", "team", "sum", True),
    ("attacking", "shots", "team", "sum", True),
    ("attacking", "shotsOnTarget", "team", "sum", True),
    ("attacking", "crosses", "team", "sum", True),
    ("attacking", "goals", "player", "sum", True),
    ("attacking", "takeOns", "player", "sum", True),
    ("attacking", "stepIns", "player", "sum", True),
    ("attacking", "crossesCompleted", "player", "sum", True),

    ("passing", "possession", "team", "average", True),
    ("passing", "passes", "team", "sum", True),
    ("passing", "passesCompleted", "team", "sum", True),
    ("passing", "passCompletion", "team", "average", True),
    ("passing", "ballProgressions", "team", "sum", True),
    ("passing", "completedLineBreaks", "team", "sum", True),
    ("passing", "receptionsInFinalThird", "team", "sum", True),
    ("passing", "passesCompleted", "player", "sum", True),
    ("passing", "passCompletion", "player", "average", True),
    ("passing", "ballProgressions", "player", "sum", True),
    ("passing", "lineBreaksCompleted", "player", "sum", True),
    ("passing", "switchesOfPlay", "player", "sum", True),

    ("defending", "defensiveLineBreaks", "team", "sum", True),
    ("defending", "defensivePressures", "team", "sum", True),
    ("defending", "forcedTurnovers", "team", "sum", True),
    ("defending", "secondBalls", "team", "sum", True),
    ("defending", "tacklesWon", "player", "sum", True),
    ("defending", "interceptions", "player", "sum", True),
    ("defending", "possessionRegains", "player", "sum", True),
    ("defending", "duelsWonAerial", "player", "sum", True),
    ("defending", "duelsWonPhysical", "player", "sum", True),
)

# ------------------------------------------------------------------- D3: the row cap
#
# Player boards are capped; team boards are not (48 rows each, never a factor). Measured
# over the real corpus: at full roster the two artifacts are 610,341 gzip-9 bytes against a
# 500,000 ceiling — a FAIL caused entirely by leaderboards, since `tournament.json` alone is
# 39,137 (7.8% of ceiling). At this cap the pair measures ~115,000, under a quarter of the
# ceiling, and the UX's only stated need is "top-3 teaser rows at hero altitude and full
# sortable tables beneath".
#
# **SM-C2 forbids resolving a breach by dropping fields, and this is not that.** A row cap
# drops ROWS, which neither AD-4 nor SM-C2 names; every row that ships carries every field.
# It is nonetheless a logged budget decision, which AD-4 explicitly permits, and it is
# logged in `pipeline/README.md` and in the story's Dev Agent Record.
#
# The cap NEVER splits a tie group — see `_apply_cap`. Never truncate `entities`: those
# lists are the route manifest, and dropping an entry deletes a route.
PLAYER_ROW_CAP = 100

# ------------------------------------------------------------- Task 2.4 / 2.5: precision
#
# **Keyed by `metricCode`, because `value` is polymorphic and a key-only table cannot
# express it.** `contract/README.md` decision 15 and `leaderboards.schema.json` both rule
# that the serializer rounds to the precision of the SOURCE FIELD the code names, not to
# `LeaderboardValue`'s own `x-decimals: 2` default. A code absent from this map is a hard
# failure, never a default: an unbound key is exactly how 29 leaves were silently truncated
# in Story 1.16 while validating clean.
#
# **DERIVED from the contract, never transcribed** — `serialize.py`'s own rule, and the
# 1.17 code review's headline finding was that the first cut broke it. A hand-written table
# is a second definition of a precision the contract already declares: it is correct only
# until the next `x-decimals` edit, and because the tests read their expectation through
# this same function, nothing would have gone red when it drifted. The derivation walks the
# metric code to its source field and reads the precision off the `$ref` target, which is
# the same one-hop resolution `decimals_map` performs.
#
# The source of a code is fixed by its SCOPE, exactly as `MetricCode`'s scope rule states:
# a team-scope code names a `TeamKeyStatistics` field, a player-scope code names a Domain G
# field. Four codes exist in both shapes (`ballProgressions`, `goals`, `passCompletion`,
# `passesCompleted`), which is why the map is keyed by `(code, scope)` and not by code
# alone — `passCompletion` is a `Percentage` on both sides today, but nothing in the
# contract requires the two to agree and a code-keyed map could not express it if they
# diverged.
BUNDLE_SCHEMA = "match-bundle.schema.json"
SHARED_SCHEMA = "common.schema.json"
METRIC_SOURCE_DEFS = {
    "team": ("TeamKeyStatistics",),
    "player": ("PlayerInPossession", "PlayerOutOfPossession", "PlayerPhysical"),
}


def metric_decimals_map() -> "dict[tuple[str, str], int]":
    """`(metricCode, scope) -> decimal places`, read out of `/contract`.

    Raises rather than defaulting on anything it cannot resolve. An unresolvable code is a
    roster/contract disagreement — either `BOARDS` names a field no source `$def` carries,
    or a source field refs a type declaring no precision — and both are findings, not
    values to guess at. `_metric_decimals` then subscripts this map directly, so a code
    absent from it raises there too.
    """
    schemas = load_schemas()
    bundle_defs = schemas[BUNDLE_SCHEMA]["$defs"]
    shared_defs = schemas[SHARED_SCHEMA]["$defs"]

    places: "dict[tuple[str, str], int]" = {}
    unresolved: "list[str]" = []
    for _family, metric_code, scope, _aggregation, _higher in BOARDS:
        target: "str | None" = None
        for def_name in METRIC_SOURCE_DEFS[scope]:
            field = bundle_defs[def_name].get("properties", {}).get(metric_code)
            if isinstance(field, dict) and isinstance(field.get("$ref"), str):
                target = field["$ref"].rsplit("/", 1)[-1]
                break
        if target is None:
            unresolved.append(f"{metric_code}/{scope} names no field in "
                              f"{list(METRIC_SOURCE_DEFS[scope])!r}")
            continue
        # `_declared_places` rather than a bare `.get("x-decimals")`: it is the contract's
        # single anyOf-aware precision reader, and transcribing a second one here would be
        # the very duplication this derivation exists to remove.
        declared = _declared_places(shared_defs.get(target, {}))
        if declared is None:
            unresolved.append(f"{metric_code}/{scope} refs {target!r}, which declares no "
                              f"x-decimals")
            continue
        places[(metric_code, scope)] = declared

    if unresolved:
        raise IndexEmitError(
            f"{len(unresolved)} board(s) have no precision derivable from /contract: "
            + "; ".join(sorted(unresolved)[:10])
            + (" …" if len(unresolved) > 10 else "")
        )
    return places


METRIC_DECIMALS = metric_decimals_map()

# **`perMatch` takes the SLOT's declared precision, and that is a ruling with a proof.**
# `LeaderboardPerMatchValue` says "precision is metric-dependent; see LeaderboardValue" —
# but applying the source field's precision to a rate is provably wrong for every count
# metric. 5 goals over 8 matches is 0.625; rounded to `goals`' own 0 places it publishes 1,
# and the shipped cross-artifact invariant `abs(perMatch - value / matchesPlayed) < 0.05`
# fails by 0.375. A rate is not a value in the source field's unit, so it rounds to the
# widest precision the contract declares for the slot instead. No metric's source precision
# exceeds this, so nothing is ever widened past what the source supports.
PER_MATCH_DECIMALS = 2


# --------------------------------------------------------------------------- small helpers
def _entity_ref(entity_id: str, name: str) -> dict:
    """One `EntityRef` — `{"id", "name"}` and nothing else.

    Written here rather than reused: `emit._team_ref` produces `{teamId, teamCode, name}`
    for the bundle's `TeamRef`, which is a DIFFERENT contract type. Every team and player
    reference in both index artifacts is an `EntityRef` — `MatchResultRow.homeTeam` and
    `.awayTeam`, `MatchEntity.homeTeam` and `.awayTeam`, `StandingsRow.team`,
    `PlayerEntity.team`, `LeaderboardRow.entity` and `.team`. `TeamEntity` is the single
    exception and carries flat `teamId`/`name`/`teamCode` instead.
    """
    return check_total({"id": entity_id, "name": name}, "EntityRef",
                       f"EntityRef[{entity_id}]", TOURNAMENT_DOCUMENTS)


def check_entities_shape(entities: dict, where: str) -> dict:
    """Assert `entities.json` carries the three lists this module reads by subscript.

    `emit.load_spine` guards `teams` and `matches` and NOT `players`, because Story 1.16
    never read the player list. This story depends on it entirely — it is the route
    manifest, the search corpus and the source of every player name — so a stale spine must
    be a typed failure naming the file rather than a bare `KeyError` surfacing from inside
    an aggregator three frames down.
    """
    for key in ("teams", "matches", "players"):
        if not isinstance(entities.get(key), list):
            raise IndexEmitError(f"{where}: entities must carry a {key!r} list")
        if not entities[key]:
            raise IndexEmitError(f"{where}: entities[{key!r}] is empty; an empty manifest "
                                 f"is never a fact about this corpus")
    return entities


def check_match_routing(entities: dict, where: str) -> None:
    """Every match must be routable to exactly one section, and every id must resolve.

    **Added by the Story 1.17 code review; each clause has a demonstrated failure.** The
    emitter sections `entities.matches` by two independent fields — a group table takes the
    matches whose `group` letter equals a letter some TEAM carries, and `knockoutResults`
    takes everything whose `stage` is not `"group"`. Those two filters are not a partition:

    * a `stage: "group"` row whose `group` is null, or names a letter no team carries,
      matches NEITHER and vanishes from the artifact entirely — while still being counted
      by the group tally, so the table publishes `played: 3` beside a two-row `results`
      array. `--expect-matches` cannot see it: that counts `entities.matches` and bundle
      files, never emitted rows;
    * a non-group row carrying a `group` letter ships it, and the schema cannot object
      because `ResultGroup` is `anyOf [Group, null]`. `_match_result_row`'s docstring states
      the `iff` rule; nothing enforced it;
    * a duplicated `match_id` is tallied twice (`_tally` iterates the list) while the result
      rows dedup (they are built into a dict), so the standings double-count against a
      `results` array that carries the row once;
    * a team id naming no `entities.teams` entry surfaces as a bare `KeyError` from a dict
      subscript three frames down, exiting 1 with a traceback — indistinguishable at the
      exit code from a typed finding about the data. `build_leaderboards` already guards
      exactly this for PLAYER ids; team ids had no equivalent.

    Collected rather than raised one at a time, per this module's failure policy.
    """
    findings: "list[str]" = []
    known_teams = {team["team_id"] for team in entities["teams"]}
    grouped_teams = {team["group"] for team in entities["teams"]}

    counts: "dict[str, int]" = defaultdict(int)
    for row in entities["matches"]:
        counts[row["match_id"]] += 1
    duplicates = sorted(match_id for match_id, n in counts.items() if n > 1)
    if duplicates:
        findings.append(f"{len(duplicates)} match id(s) listed more than once: "
                        f"{duplicates[:5]!r}")

    for team in entities["teams"]:
        if not isinstance(team["group"], str):
            findings.append(f"team {team['team_id']!r} carries a non-string group "
                            f"{team['group']!r}, which no group table can be keyed by")

    played_by = {row[side] for row in entities["matches"]
                 for side in ("home_team_id", "away_team_id")}
    idle = sorted(known_teams - played_by)
    if idle:
        # Ruled explicitly rather than left to fall through: `_tally` returns a
        # `defaultdict`, so a team named by no match would ship a plausible-looking
        # all-zero `TeamRecord` and contribute no `GroupTable` at all — an artifact silently
        # missing a whole group. A team that plays nothing is never a fact about this
        # tournament.
        findings.append(f"{len(idle)} listed team(s) are named by no match: {idle[:5]!r}")

    for row in entities["matches"]:
        match_id, stage, group = row["match_id"], row["stage"], row["group"]
        if (stage == "group") != (group is not None):
            findings.append(f"{match_id}: stage {stage!r} with group {group!r} — `group` is "
                            f"non-null iff stage == 'group'")
        elif stage == "group" and group not in grouped_teams:
            findings.append(f"{match_id}: group {group!r} names no team's group, so this "
                            f"match would appear in no group table and in no knockout list")
        for side in ("home_team_id", "away_team_id"):
            if row[side] not in known_teams:
                findings.append(f"{match_id}: {side} {row[side]!r} names no entities.teams "
                                f"entry")

    if findings:
        shown = "; ".join(sorted(findings)[:10])
        raise IndexEmitError(
            f"{where}: {len(findings)} match-routing failure(s): {shown}"
            f"{' …' if len(findings) > 10 else ''}"
        )


# ------------------------------------------------------------------ D1: the FIFA cascade
def _standings_key(row: dict) -> tuple:
    """The implemented FIFA tiebreaker cascade, tiers 1-3 (Story 1.17 D1).

    Points, then goal difference, then goals scored — descending on all three. Universally
    agreed, exercised by this corpus, and verified to reproduce the actual tournament
    outcome exactly: the 12 group winners, 12 runners-up and best 8 third-placed teams this
    ordering computes ARE the real 32-team Round-of-32 field, 24/24 and 8/8.

    **Tiers 4+ are deliberately unimplemented and `_check_tiebreaks` raises rather than
    guessing.** See `TiebreakUnresolvedError` for why each of them is unavailable here.

    The trailing `team["id"]` is NOT a tiebreaker and must never be read as one — it is
    only reached after `_check_tiebreaks` has already proven no tie survives tier 3, so it
    sorts a set of rows that are pairwise distinct on the three real keys. It exists so the
    sort is total and therefore reproducible byte-for-byte (AD-8).
    """
    return (-row["points"], -row["goalDifference"], -row["goalsFor"], row["team"]["id"])


def _check_tiebreaks(rows: "list[dict]", where: str) -> None:
    """Raise if any two rows are equal on all three implemented tiers.

    Checked BEFORE the id-ordered sort is trusted, and over every pair rather than only
    adjacent ones, so the message names the whole tied set rather than one arbitrary pair
    out of it.
    """
    buckets: "dict[tuple, list[str]]" = defaultdict(list)
    for row in rows:
        buckets[(row["points"], row["goalDifference"], row["goalsFor"])].append(
            row["team"]["id"])
    tied = sorted((key, sorted(ids)) for key, ids in buckets.items() if len(ids) > 1)
    if tied:
        detail = "; ".join(
            f"{ids!r} all on {pts} pts, GD {gd}, {gf} scored" for (pts, gd, gf), ids in tied
        )
        raise TiebreakUnresolvedError(
            f"{where}: {detail}. The implemented cascade is points -> goal difference -> "
            f"goals scored and it has run out. Tiers beyond that (head-to-head, fair play, "
            f"drawing of lots) are deliberately unimplemented: no normative regulations "
            f"text exists in this repository, fair play is not computable from the "
            f"contracted StandingsRow, and drawing of lots cannot satisfy AD-8. Rule this "
            f"before emitting — do not invent an order."
        )


# --------------------------------------------------------------------------- tournament.json
def _match_result_row(match: dict, knockout: dict, team_name: "dict[str, str]") -> dict:
    """One `MatchResultRow`, projected from the spine's `entities.matches` row.

    **The staging keys are stripped at BOTH levels.** The spine's per-match `score` is
    `{home, away, shootout}` while `common.schema.json`'s `TeamScore` is
    `additionalProperties: false, required [home, away]` — carrying it through verbatim
    fails validation on every result row in the artifact. The `shootout` prose decomposes
    into `knockoutScore` instead, exactly as `emit.build_metadata` does it.

    `group` is non-null iff `stage == "group"`; `knockoutScore` is required on GROUP rows
    too, where it reads `decidedBy: "regulation"` with null `scoreAfterET` and
    `shootoutScore`, and a null `winnerTeamId` on each of the 20 drawn group ties.
    """
    home, away = match["home_team_id"], match["away_team_id"]
    return check_total(
        {
            "matchId": match["match_id"],
            "matchNumber": match["match_number"],
            "stage": match["stage"],
            "group": match["group"],
            "matchdayRound": match["matchday_round"],
            "date": match["date"],
            "kickoff": match["kickoff"],
            "venue": match["venue"],
            "homeTeam": _entity_ref(home, team_name[home]),
            "awayTeam": _entity_ref(away, team_name[away]),
            "score": check_total({"home": match["score"]["home"],
                                  "away": match["score"]["away"]},
                                 "TeamScore", f"MatchResultRow.score[{match['match_id']}]",
                                 TOURNAMENT_DOCUMENTS),
            "knockoutScore": knockout,
        },
        "MatchResultRow", f"MatchResultRow[{match['match_id']}]", TOURNAMENT_DOCUMENTS,
    )


def _tally(matches: "list[dict]", knockouts: "dict[str, dict]", group_only: bool) -> dict:
    """Accumulate W/D/L, goals and (for group tables) form, one entry per team.

    **Group tables are computed from the 90-MINUTE score, tournament records from the
    FINAL score, and the difference is not cosmetic.** A group table has no extra time to
    read; a knockout tie's cover score is printed after extra time when extra time was
    played. `knockoutScore.scoreAfter90` is itself a reconciliation of two printed sources
    (`metadata.goals` at minute <= 90, cross-checked against the cover), which is why it is
    taken from `emit._knockout_score` rather than re-derived here.

    Matches are consumed in `match_number` order, which is what makes `form` chronological.
    """
    table: "dict[str, dict]" = defaultdict(
        lambda: dict(played=0, won=0, drawn=0, lost=0, goalsFor=0, goalsAgainst=0,
                     points=0, form=[]))
    for match in sorted(matches, key=lambda m: m["match_number"]):
        if group_only and match["stage"] != "group":
            continue
        if group_only:
            score = knockouts[match["match_id"]]["scoreAfter90"]
        else:
            score = match["score"]
        home, away = match["home_team_id"], match["away_team_id"]
        for team_id, scored, conceded in ((home, score["home"], score["away"]),
                                          (away, score["away"], score["home"])):
            row = table[team_id]
            row["played"] += 1
            row["goalsFor"] += scored
            row["goalsAgainst"] += conceded
            if scored > conceded:
                row["won"] += 1
                row["points"] += 3
                row["form"].append("win")
            elif scored == conceded:
                row["drawn"] += 1
                row["points"] += 1
                row["form"].append("draw")
            else:
                row["lost"] += 1
                row["form"].append("loss")
    return table


def _team_record(tally_row: dict) -> dict:
    """One `TeamRecord` — the team's record over ALL matches (Story 1.17 D4a).

    **This is NOT `StandingsRow.played`, and the two differ for 32 of the 48 teams.**
    `StandingsRow` is a group table and is necessarily group-only; `TeamRecord` is
    documented as "a team's TOURNAMENT record" and backs the Team Profile's `<title>` and
    OG string, defined as "name + tournament record". Argentina played 3 group matches and
    5 knockout matches: publishing "P3 W3 D0 L0" as a finalist's tournament record would be
    simply false, and would silently discard the knockout half of a knockout tournament.

    `TeamRecord` carries no `points` and no `goalDifference` — the contract omits both,
    because a tournament-wide points total is not a thing the competition defines.

    **A tie decided on penalties is a DRAW for both teams here**, which is the standard
    football convention and is why `winnerTeamId` lives in `knockoutScore` rather than
    moving a W/L into this record. Measured on this corpus: 208 team-matches and 48 draws,
    being 20 drawn group ties and 4 shoot-outs, each counted for both sides. A record that
    credited the shoot-out winner with a win would disagree with every published table of
    the same tournament.
    """
    return check_total(
        {key: tally_row[key] for key in
         ("played", "won", "drawn", "lost", "goalsFor", "goalsAgainst")},
        "TeamRecord", "TeamRecord", TOURNAMENT_DOCUMENTS,
    )


def build_tournament(entities: dict, matches: "list[dict]") -> dict:
    """`tournament.json` — results, standings and the route manifest.

    `matches` is the staged match spine list, used only for the goal records
    `emit._knockout_score` reconciles; every schedule field comes from
    `entities["matches"]`, which already carries `match_number`, `stage`, `group`,
    `matchday_round`, `date`, `kickoff`, `venue` and `score`.

    **No id is minted and the `m###` prefix is never parsed.** Every id already exists in
    `entities.json`; re-deriving one is the reinvention, a divergence would be
    unfalsifiable, and `m052-bosnia-and-herzegovina-qatar` cannot be split by string rules
    in any case.
    """
    check_entities_shape(entities, "entities.json")
    check_match_routing(entities, "entities.json")
    codes = {team["team_id"]: team["team_code"] for team in entities["teams"]}
    team_name = {team["team_id"]: team["name"] for team in entities["teams"]}

    spine_by_id = {match["spine"]["match_id"]: match for match in matches}
    missing = sorted(row["match_id"] for row in entities["matches"]
                     if row["match_id"] not in spine_by_id)
    if missing:
        raise IndexEmitError(
            f"{len(missing)} match(es) are listed in entities.json with no staged spine "
            f"record: {missing[:10]!r}{' …' if len(missing) > 10 else ''}"
        )

    knockouts = {
        match_id: _knockout_score(spine, codes, _goals(spine))
        for match_id, spine in spine_by_id.items()
    }
    rows = {row["match_id"]: _match_result_row(row, knockouts[row["match_id"]], team_name)
            for row in entities["matches"]}

    # --- group tables, ordered by group letter -------------------------------------
    group_tally = _tally(entities["matches"], knockouts, group_only=True)
    group_of = {team["team_id"]: team["group"] for team in entities["teams"]}
    by_group: "dict[str, list[str]]" = defaultdict(list)
    for team_id in group_tally:
        by_group[group_of[team_id]].append(team_id)

    groups = []
    for group in sorted(by_group):
        standings_rows = []
        for team_id in by_group[group]:
            tally_row = group_tally[team_id]
            standings_rows.append({
                "rank": 0,  # replaced below; ranks are assigned only after the sort
                "team": _entity_ref(team_id, team_name[team_id]),
                "played": tally_row["played"],
                "won": tally_row["won"],
                "drawn": tally_row["drawn"],
                "lost": tally_row["lost"],
                "goalsFor": tally_row["goalsFor"],
                "goalsAgainst": tally_row["goalsAgainst"],
                "goalDifference": tally_row["goalsFor"] - tally_row["goalsAgainst"],
                "points": tally_row["points"],
                "form": list(tally_row["form"]),
            })
        _check_tiebreaks(standings_rows, f"group {group!r}")
        standings_rows.sort(key=_standings_key)
        for rank, row in enumerate(standings_rows, start=1):
            row["rank"] = rank
            check_total(row, "StandingsRow",
                        f"StandingsRow[{group}/{row['team']['id']}]", TOURNAMENT_DOCUMENTS)
        results = [rows[m["match_id"]] for m in
                   sorted((m for m in entities["matches"]
                           if m["stage"] == "group" and m["group"] == group),
                          key=lambda m: m["match_number"])]
        groups.append(check_total({"group": group, "standings": standings_rows,
                                   "results": results},
                                  "GroupTable", f"GroupTable[{group}]",
                                  TOURNAMENT_DOCUMENTS))

    # --- knockout results, ordered by stage then match number ----------------------
    stage_order = {stage: i for i, stage in enumerate(KNOCKOUT_ROUNDS)}
    unknown = sorted({m["stage"] for m in entities["matches"]
                      if m["stage"] != "group" and m["stage"] not in stage_order})
    if unknown:
        raise IndexEmitError(
            f"stage(s) {unknown!r} are not in discover.rounds.KNOCKOUT_ROUNDS, so "
            f"knockoutResults has no declared order for them"
        )
    knockout_results = [
        rows[m["match_id"]] for m in
        sorted((m for m in entities["matches"] if m["stage"] != "group"),
               key=lambda m: (stage_order[m["stage"]], m["match_number"]))
    ]

    # **The two sections must PARTITION the match list, and this is the assert that says
    # so.** `check_match_routing` rejects every unroutable shape it can see in the input;
    # this closes the loop over the OUTPUT, so any future filter change that drops or
    # duplicates a match is caught by arithmetic rather than by inspection. A silently
    # short artifact is the failure mode `--expect-matches` cannot detect, because that
    # flag counts the input and the bundles, never the emitted rows.
    emitted = sum(len(table["results"]) for table in groups) + len(knockout_results)
    if emitted != len(entities["matches"]):
        raise IndexEmitError(
            f"the emitted sections carry {emitted} match row(s) against "
            f"{len(entities['matches'])} listed in entities.matches; every match must "
            f"appear in exactly one of the group tables or knockoutResults"
        )

    # --- the route manifest --------------------------------------------------------
    #
    # `entities.matches` / `.teams` / `.players` have NO declared order in the schema, and
    # AD-8 demands byte-identical re-runs, so one is FIXED here and stated: the order is
    # `work/spine/entities.json`'s own, which is already sorted by `match_id`, `team_id`
    # and `player_id` respectively. Carried through rather than re-sorted, and pinned by a
    # test, so the artifact and its input can never disagree about it.
    record_tally = _tally(entities["matches"], knockouts, group_only=False)
    manifest = check_total(
        {
            "matches": [
                check_total({"matchId": m["match_id"], "stage": m["stage"],
                             "homeTeam": _entity_ref(m["home_team_id"],
                                                     team_name[m["home_team_id"]]),
                             "awayTeam": _entity_ref(m["away_team_id"],
                                                     team_name[m["away_team_id"]]),
                             "score": check_total({"home": m["score"]["home"],
                                                   "away": m["score"]["away"]},
                                                  "TeamScore",
                                                  f"MatchEntity.score[{m['match_id']}]",
                                                  TOURNAMENT_DOCUMENTS)},
                            "MatchEntity", f"MatchEntity[{m['match_id']}]",
                            TOURNAMENT_DOCUMENTS)
                for m in entities["matches"]
            ],
            "teams": [
                check_total({"teamId": t["team_id"], "name": t["name"],
                             "teamCode": t["team_code"], "group": t["group"],
                             "record": _team_record(record_tally[t["team_id"]])},
                            "TeamEntity", f"TeamEntity[{t['team_id']}]",
                            TOURNAMENT_DOCUMENTS)
                for t in entities["teams"]
            ],
            # All 1,248, including the 209 who appear in a lineup and have no Domain G row.
            # AC 3 is explicit that empty sections are allowed and absence is not: filtering
            # them out would delete 209 routes from the manifest Story 1.18 builds against.
            "players": [
                check_total({"playerId": p["player_id"], "name": p["name"],
                             "team": _entity_ref(p["team_id"], team_name[p["team_id"]]),
                             "position": p["position"]},
                            "PlayerEntity", f"PlayerEntity[{p['player_id']}]",
                            TOURNAMENT_DOCUMENTS)
                for p in entities["players"]
            ],
        },
        "EntityIndex", "EntityIndex", TOURNAMENT_DOCUMENTS,
    )

    return {
        "schemaVersion": schema_version(),
        "tournamentName": TOURNAMENT_NAME,
        "groups": groups,
        "knockoutResults": knockout_results,
        "entities": manifest,
    }


# --------------------------------------------------------------------------- leaderboards
def _metric_decimals(metric_code: str, scope: str) -> int:
    """The board's precision, subscripted — never `.get` with a default.

    A default of 0 here would be the Story 1.16 defect exactly: a new float-valued code
    added to `BOARDS` and not to the map would ship truncated to a whole number, validate
    clean against `LeaderboardValue`'s `type: number`, and move no test. `METRIC_DECIMALS`
    is derived from `BOARDS` itself, so a miss means the roster changed under the map and
    the run must stop.
    """
    return METRIC_DECIMALS[(metric_code, scope)]


def collect_metric_values(bundles: "list[dict]") -> "tuple[dict, dict, dict]":
    """`(team_values, player_values, player_team)` read from the committed bundles.

    `team_values[code][team_id]` and `player_values[code][player_id]` are the per-match
    values a board aggregates, in bundle order. The bundles are the ONLY source for these:
    the spine stages the stat blocks but does not reshape them, and `keyStatistics` /
    Domain G are exactly what the two scopes' metric codes name.

    **A player board is populated from the players who have a `players[]` performance
    block, not from the route manifest.** 1,039 of the 1,248 listed players have one; the
    other 209 appear only in lineups, have no Domain G row and cannot be ranked on any
    metric. That is not a contradiction of the manifest — the manifest is a route list, a
    board ranks what has data.

    **A NULL value is a match this entity has no reading for, and it is skipped — ruled
    explicitly rather than left to fall through** (1.17 code review). A MISSING key raises:
    the contract requires the field, so its absence is an extraction defect. A present
    `null` is different — it is the contract's own way of saying the source printed nothing
    — so the match contributes to neither `value` nor `matchesPlayed`.

    The consequence is deliberate and worth stating, because it looks like a bug from the
    outside: `matchesPlayed` is therefore PER BOARD, not per entity. A player whose
    `topSpeed` is null in one appearance carries a smaller denominator on that board than on
    the others. That is the reading that keeps `perMatch` honest — dividing by a match whose
    value was never counted would understate every rate — and it keeps `matchesPlayed`
    meaning "the matches aggregated into this value", which is what `_board_rows` documents.
    An entity null on every match drops off the board entirely rather than dividing by zero.

    **Own goals need no special handling here, and that was verified rather than assumed.**
    Domain G's `inPossession.goals` already excludes them: summed corpus-wide it is 294,
    exactly the 308 recorded goals less the 14 own goals, and it agrees match by match on
    all 104. The team-scope `keyStatistics.goals` equals the final score on all 104, which
    is the benefiting-team crediting the contract specifies. So the top-scorer board
    credits the scorer and the team board credits the beneficiary, from the printed fields,
    with no re-derivation.
    """
    team_values: "dict[str, dict[str, list]]" = defaultdict(lambda: defaultdict(list))
    player_values: "dict[str, dict[str, list]]" = defaultdict(lambda: defaultdict(list))
    player_team: "dict[str, str]" = {}

    team_codes = {code for _f, code, scope, _a, _h in BOARDS if scope == "team"}
    player_codes = {code for _f, code, scope, _a, _h in BOARDS if scope == "player"}

    for bundle in bundles:
        match_id = bundle["matchId"]
        for side in ("home", "away"):
            team_id = bundle["metadata"][f"{side}Team"]["teamId"]
            statistics = bundle["keyStatistics"][side]
            for code in team_codes:
                if code not in statistics:
                    raise IndexEmitError(
                        f"{match_id}: keyStatistics.{side} has no field {code!r}, which a "
                        f"team-scope board ranks", match_id)
                if statistics[code] is not None:
                    team_values[code][team_id].append(statistics[code])
        for player in bundle["players"]:
            player_id = player["playerId"]
            player_team[player_id] = player["teamId"]
            flat: dict = {}
            for block in ("inPossession", "outOfPossession", "physical"):
                flat.update(player.get(block) or {})
            for code in player_codes:
                if code not in flat:
                    raise IndexEmitError(
                        f"{match_id}: player {player_id!r} has no Domain G field {code!r}, "
                        f"which a player-scope board ranks", match_id)
                if flat[code] is not None:
                    player_values[code][player_id].append(flat[code])

    return team_values, player_values, player_team


def _aggregate(values: "list", aggregation: str, where: str):
    if aggregation == "max":
        return max(values)
    if aggregation == "sum":
        return sum(values)
    if aggregation == "average":
        return sum(values) / len(values)
    raise IndexEmitError(f"{where}: unknown aggregation {aggregation!r}")


def _per_match(value, aggregation: str, matches_played: int):
    """`perMatch` for one row — required-but-nullable, so `null` is WRITTEN, not omitted.

    `max` is null: the contract names `topSpeed` as its own example of a metric that is not
    meaningfully rateable. `sum` divides. `average` returns the value itself, because for
    an average the value already IS the per-match figure — dividing it again would publish
    a tournament possession of 21.8% for a team that held 65.5% in each of three matches,
    and the shipped fixture's one `average` board carries a non-null `perMatch` equal to
    its value.
    """
    if aggregation == "max":
        return None
    if aggregation == "average":
        return value
    return value / matches_played


def _rank_rows(rows: "list[dict]") -> None:
    """Assign competition ranks in place: 1, 2, 2, 4 — never 1, 2, 2, 3.

    Ties share the better (lower) rank and the next distinct value skips to its ordinal
    position. The committed fixture is the only thing in the contract that says so — its
    `topSpeed` board runs 1,2,3,4,5,6,7,7,7,7,7,12,… — and `test_fixtures.py` pins it.

    `rows` must already be sorted by `(-value, entity id)`. The ascending-id tiebreak
    inside a tie group is the fixture's too, and it is what makes re-runs byte-identical;
    it is a serialization order, never a claim that one tied entity outranks another.
    """
    previous_value = None
    previous_rank = 0
    for position, row in enumerate(rows, start=1):
        if previous_value is None or row["value"] != previous_value:
            row["rank"] = position
            previous_rank = position
        else:
            row["rank"] = previous_rank
        previous_value = row["value"]


def _apply_cap(rows: "list[dict]", cap: "int | None") -> "list[dict]":
    """Truncate to `cap` rows, extended to the END of the boundary tie group.

    **A hard cut at N publishes an arbitrary subset of equals.** Competition ranking means
    several entities can share the boundary rank, and cutting mid-group would ship some of
    them and drop others on no stated criterion — with the survivors chosen by the id
    tiebreak, which exists for determinism and is emphatically not a ranking. So the cut is
    made on RANK, not on position: every row sharing the boundary row's rank ships.

    Measured on this corpus, that is ~2,965 rows against 2,664 for a hard cut — about 300
    rows and ~9,500 gzip bytes of difference, which the budget absorbs four times over.
    """
    if cap is None or len(rows) <= cap:
        return rows
    boundary_rank = rows[cap - 1]["rank"]
    return [row for row in rows if row["rank"] <= boundary_rank]


def _board_rows(metric_code: str, scope: str, aggregation: str, higher_is_better: bool,
                values: "dict[str, list]", name_of: "dict[str, str]",
                team_of: "dict[str, str]", team_name: "dict[str, str]") -> "list[dict]":
    """Every ranked row of one board, sorted, ranked and capped.

    **`higher_is_better` is honoured here, not merely published.** `Leaderboard` describes
    the field as "sort direction the ranks already reflect", so a board declaring `false`
    while the rows descend would tell the App the opposite of what it shipped — and the App
    renders `rank` verbatim under AD-5, so nothing downstream could correct it. Every board
    in today's roster is `true`; this branch exists so the first `false` one (a concessions
    or errors metric) cannot rank the worst entity first.

    **`matchesPlayed` is the ENTITY'S OWN match count (Story 1.17 D4b)** — the number of
    matches whose values were aggregated into `value`.

    That makes `perMatch == value / matchesPlayed` true by construction **on the 30 `sum`
    boards, which is where the argument for D4b applies**. It is not a claim about all 36:
    `max` boards publish `perMatch: null` (the contract names `topSpeed` as its own example
    of a metric that is not rateable) and `average` boards publish the value itself, since
    an average already IS the per-match figure. The unqualified version of this sentence was
    a 1.17 code review finding — it read as a property of every row and is a property of
    five sixths of them.

    For a player that is the number of matches carrying a Domain G row for them. It is NOT
    their team's match count, which the hand-authored fixture uses and which differs for
    584 of the 1,039 ranked players — dividing an unused substitute and a full-tournament
    starter by the same denominator makes `perMatch` false on more than half of every
    player board. Nor is it `entities.json`'s `match_ids`, which is the TEAMSHEET: six
    players are on the sheet for eight matches with a single performance row, and that
    reading would divide their one match by eight.

    For a team it is the team's match count, group and knockout, which agrees with
    `TeamRecord.played` by construction — every played match contributes a `keyStatistics`
    block.
    """
    decimals = _metric_decimals(metric_code, scope)
    rows = []
    for entity_id, per_match_values in values.items():
        matches_played = len(per_match_values)
        value = round_to_precision(
            _aggregate(per_match_values, aggregation, f"{metric_code}/{scope}"), decimals)
        team_id = entity_id if scope == "team" else team_of[entity_id]
        rows.append({
            "rank": 0,  # replaced by `_rank_rows`, which needs the sorted order first
            "entity": _entity_ref(entity_id, name_of[entity_id]),
            "team": _entity_ref(team_id, team_name[team_id]),
            "value": value,
            "matchesPlayed": matches_played,
            "perMatch": _per_match(value, aggregation, matches_played),
        })
    # The id is ALWAYS ascending, whichever way the value sorts: it is the determinism
    # tiebreak (AD-8), not a ranking criterion, so it must not flip with the direction.
    rows.sort(key=lambda row: (-row["value"] if higher_is_better else row["value"],
                               row["entity"]["id"]))
    _rank_rows(rows)
    rows = _apply_cap(rows, PLAYER_ROW_CAP if scope == "player" else None)
    for row in rows:
        if row["perMatch"] is not None:
            row["perMatch"] = round_to_precision(row["perMatch"], PER_MATCH_DECIMALS)
        check_total(row, "LeaderboardRow",
                    f"LeaderboardRow[{metric_code}/{scope}/{row['entity']['id']}]",
                    LEADERBOARDS_DOCUMENTS)
    return rows


def build_leaderboards(entities: dict, matches: "list[dict]",
                       bundles: "list[dict]") -> dict:
    """`leaderboards.json` — the 36-board roster, in `BOARDS` order.

    `matches` is carried for the cross-check that the committed bundle set is exactly the
    staged match set: a board silently built from 103 of 104 bundles would be wrong in a
    way no schema and no ordering test could see.
    """
    check_entities_shape(entities, "entities.json")
    team_name = {team["team_id"]: team["name"] for team in entities["teams"]}
    player_name = {player["player_id"]: player["name"] for player in entities["players"]}

    staged = {match["spine"]["match_id"] for match in matches}
    committed = {bundle["matchId"] for bundle in bundles}
    if staged != committed:
        only_staged = sorted(staged - committed)
        only_committed = sorted(committed - staged)
        raise IndexEmitError(
            f"the staged spine and the committed bundles disagree on the match set: "
            f"{len(only_staged)} staged-only {only_staged[:5]!r}, "
            f"{len(only_committed)} committed-only {only_committed[:5]!r}. Leaderboards "
            f"aggregate the bundles and are ranked against the spine's entities; the two "
            f"must name the same matches or the boards are built from a partial corpus"
        )

    team_values, player_values, player_team = collect_metric_values(bundles)
    unknown = sorted(pid for pid in player_team if pid not in player_name)
    if unknown:
        raise IndexEmitError(
            f"{len(unknown)} player(s) carry a Domain G row and are absent from the "
            f"entities manifest: {unknown[:10]!r}. Every ranked entity must have a route"
        )
    # The same guard for TEAM ids, which had none — an asymmetry the code review caught.
    # A bundle naming a team the manifest does not list reached `team_of[...]`,
    # `team_name[...]` and `name_of[...]` as a bare `KeyError`, exiting 1 with a traceback
    # rather than as a typed finding. Both the row's own team and every ranked team's id
    # are covered.
    unknown_teams = sorted(
        {team_id for values in team_values.values() for team_id in values}
        | set(player_team.values())
    )
    unknown_teams = [team_id for team_id in unknown_teams if team_id not in team_name]
    if unknown_teams:
        raise IndexEmitError(
            f"{len(unknown_teams)} team(s) carry a committed stat block and are absent "
            f"from the entities manifest: {unknown_teams[:10]!r}. Every ranked entity must "
            f"have a route"
        )

    boards = []
    for _family, metric_code, scope, aggregation, higher_is_better in BOARDS:
        if scope == "team":
            values, name_of = team_values[metric_code], team_name
        else:
            values, name_of = player_values[metric_code], player_name
        if not values:
            raise IndexEmitError(
                f"board {metric_code!r}/{scope} would ship with no rows; an empty board is "
                f"an extraction defect, not a fact about this tournament"
            )
        boards.append(check_total(
            {
                "metricCode": metric_code,
                "scope": scope,
                "aggregation": aggregation,
                "higherIsBetter": higher_is_better,
                "rows": _board_rows(metric_code, scope, aggregation, higher_is_better,
                                    values, name_of, player_team, team_name),
            },
            "Leaderboard", f"Leaderboard[{metric_code}/{scope}]", LEADERBOARDS_DOCUMENTS,
        ))

    return {"schemaVersion": schema_version(), "boards": boards}


# --------------------------------------------------------------- rounding at the boundary
def round_index(artifact: dict, decimals: "dict[str, int]", leaf_types: "dict[str, str]"):
    """Round every numeric leaf to its BOUND precision, and no leaf by inheritance.

    `leaf_types` maps a leaf KEY to the contract type name whose precision it takes.
    `decimals` is the schema-derived map for the document. A key absent from `leaf_types`
    is rounded by NOTHING — never by a parent's precision.

    That last rule is the whole point. `emit.round_bundle`'s docstring records that
    inheritance silently truncated 29 leaves (`lineHeight: 19.5 -> 20`) while the artifact
    validated clean, because a validator ignores `x-decimals` entirely. Precision is
    enforced here or nowhere.
    """
    def walk(node, key: "str | None"):
        if isinstance(node, dict):
            return {k: walk(v, k) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(item, key) for item in node]
        type_name = leaf_types.get(key) if key is not None else None
        if type_name is None:
            return node
        if type_name not in decimals:
            raise IndexEmitError(
                f"leaf {key!r} is bound to contract type {type_name!r}, which declares no "
                f"x-decimals in this document; a leaf bound to nothing rounds by nothing"
            )
        return round_to_precision(node, decimals[type_name])

    return walk(artifact, None)


# Every numeric leaf of `tournament.json`, bound explicitly to the contract type that
# declares its precision. All four are integer precisions — `tournament.json` genuinely has
# no float field, which is why `decimals_map` needs `require_float=False` for it.
TOURNAMENT_LEAF_TYPES: "dict[str, str]" = {
    "matchNumber": "ResultMatchNumber",
    "rank": "Rank",
    "played": "Count", "won": "Count", "drawn": "Count", "lost": "Count",
    "goalsFor": "Count", "goalsAgainst": "Count", "points": "Count",
    "goalDifference": "GoalDifference",
    "home": "Count", "away": "Count",
}

# `value` and `perMatch` are deliberately ABSENT: their precision is metric-dependent and
# is applied per row in `_board_rows`, which is the only place the `metricCode` is in
# scope. Binding them here would round every board to one precision.
LEADERBOARDS_LEAF_TYPES: "dict[str, str]" = {
    "rank": "Rank",
    "matchesPlayed": "Count",
}


# --------------------------------------------------------------- D2: the route manifest
#
# **These five keys are also the AD-3 immutability map for `data/index/*.json`** — see
# `INDEX_BASELINE_UNAVAILABLE` and the `check_committed_data` call in `main`. They are
# exactly the id keys whose namespace is fixed by the key NAME, which is what
# `identity.check_committed_data` requires; `EntityRef`'s bare `"id"` is deliberately absent
# because its namespace is fixed by CONTEXT, and that one stays with `check_index_ids`.
_ID_KEY_KIND: "dict[str, str]" = {
    "matchId": "matches",
    "teamId": "teams",
    "playerId": "players",
    "winnerTeamId": "teams",
    "scorerPlayerId": "players",
}

INDEX_BASELINE_UNAVAILABLE = (
    "committed index baseline unavailable: no index artifacts found under {path} — "
    "the registry is the ONLY immutability source for them. This is NOT a pass."
)
# The slots whose value is an `EntityRef`, and the namespace that ref's bare `"id"` belongs
# to. `entity` is absent on purpose: its namespace is the BOARD'S SCOPE, supplied per board.
_REF_SLOT_KIND: "dict[str, str]" = {
    "homeTeam": "teams",
    "awayTeam": "teams",
    "team": "teams",
}

# `winnerTeamId` is the one contract-nullable id key these artifacts carry: it is
# `anyOf [TeamId, null]` and is null on all 20 drawn group ties. Every other key above is a
# bare non-nullable `$ref`, so a null there stays a finding.
_NULLABLE_ID_KEYS = frozenset({"winnerTeamId"})


def id_sites(artifact, slot_kinds: "dict[str, str]", ref_kind: "str | None" = None,
             path: str = "") -> "list[tuple[str, str, object, str]]":
    """Every id-bearing site in an index artifact as `(path, key, value, kind)`.

    ONE walk, used by both the containment gate and the totality test, so the two can
    never drift into disagreeing about what "every id" means.

    **A bare `"id"` is classified by its SLOT, not by its shape**, which is why this is a
    context-carrying walk rather than a key lookup. `EntityRef.id` is the id key both index
    artifacts use most, and it names a team in `homeTeam`/`awayTeam`/`team` and either a
    team or a player in `entity`, depending on the board's scope. `slot_kinds` is passed in
    rather than read from a module constant for exactly that reason: the caller binds
    `entity` per board, because nothing about the ref itself says which namespace it is in.

    An `"id"` reached with no slot context is a FAILURE, never a skip. An unclassifiable id
    the gate quietly walked past is precisely how a run reports "all pinned" while unpinned
    ids ship.
    """
    sites: "list[tuple[str, str, object, str]]" = []
    if isinstance(artifact, dict):
        for key, value in artifact.items():
            here = f"{path}.{key}"
            if key == "id":
                if ref_kind is None:
                    raise RouteManifestError(
                        f"{here}: a bare 'id' with no slot context; this walk cannot say "
                        f"which namespace it belongs to and must not guess"
                    )
                sites.append((here, key, value, ref_kind))
            elif key in _ID_KEY_KIND:
                sites.append((here, key, value, _ID_KEY_KIND[key]))
            else:
                sites.extend(id_sites(value, slot_kinds,
                                      slot_kinds.get(key, ref_kind), here))
    elif isinstance(artifact, list):
        for position, item in enumerate(artifact):
            sites.extend(id_sites(item, slot_kinds, ref_kind, f"{path}[{position}]"))
    return sites


def index_id_sites(tournament: dict, leaderboards: dict) -> "list[tuple]":
    """Every id-bearing site across BOTH artifacts, with board scope bound per board.

    `entity` is the one slot whose namespace comes from the artifact rather than from the
    key, so each board is walked with its own `slot_kinds` binding instead of the walk
    guessing. `metricCode`, `scope` and the numeric leaves carry no id and are reached and
    ignored by the same walk, which is what makes the totality test meaningful.
    """
    sites = [(f"tournament{path}", key, value, kind)
             for path, key, value, kind in id_sites(tournament, _REF_SLOT_KIND)]
    for position, board in enumerate(leaderboards["boards"]):
        slot_kinds = dict(_REF_SLOT_KIND)
        slot_kinds["entity"] = "teams" if board["scope"] == "team" else "players"
        sites.extend(
            (f"leaderboards.boards{path}", key, value, kind)
            for path, key, value, kind
            in id_sites(board, slot_kinds, None, f"[{position}]")
        )
    return sites


def check_index_ids(tournament: dict, leaderboards: dict) -> None:
    """Every id in either index artifact must be pinned by the emitted route manifest.

    **This is HALF of the coverage, and the other half is `check_committed_data`.** The two
    prove genuinely different properties and the 1.17 code review found that shipping only
    this one left a real gap:

    * this check proves INTERNAL REFERENTIAL INTEGRITY — no id anywhere in either artifact
      names an entity the manifest does not list, so the aggregator minted nothing. It is
      the only check that can classify `EntityRef`'s bare `"id"`, whose namespace is fixed
      by context (the board's `scope`, the slot it sits in) rather than by its key name;
    * `identity.check_committed_data` proves IMMUTABILITY against the slug registry, which
      this one structurally cannot: `known` is built from `tournament["entities"]`, the
      manifest embedded in the artifact being checked, so a manifest entry that nothing
      else cross-references pins itself. Measured: 581 of the 1,248 player routes hold no
      board row after the cap, and rewriting one of their `playerId`s to a bogus value
      passed this check silently.

    `main` therefore calls BOTH. The original reasoning for skipping the second — that a
    bare `"id"` would be ambiguous in `COMMITTED_ID_KEYS` — was sound and is preserved:
    `_ID_KEY_KIND` carries only the five name-classified keys and never `"id"`. Story 1.18
    parameterized `globs` and `id_keys` on `check_committed_data`, so no edit to
    `identity.py` is needed for this and none was made.
    """
    known = {
        "matches": {row["matchId"] for row in tournament["entities"]["matches"]},
        "teams": {row["teamId"] for row in tournament["entities"]["teams"]},
        "players": {row["playerId"] for row in tournament["entities"]["players"]},
    }
    unpinned: "list[str]" = []
    for path, key, value, kind in index_id_sites(tournament, leaderboards):
        if value is None and key in _NULLABLE_ID_KEYS:
            continue
        if not isinstance(value, str):
            # Reported, never skipped: a null `playerId` would otherwise go uncounted and
            # the run would print "all pinned".
            unpinned.append(f"{path} = {value!r} (non-string {kind} id)")
        elif value not in known[kind]:
            unpinned.append(f"{path} = {value!r} names no {kind} entry in the manifest")
    if unpinned:
        shown = "; ".join(sorted(unpinned)[:10])
        raise RouteManifestError(
            f"{len(unpinned)} id(s) in the index artifacts are not pinned by the route "
            f"manifest: {shown}{' …' if len(unpinned) > 10 else ''}"
        )


PROFILE_BASELINE_UNAVAILABLE = (
    "profile baseline unavailable: {path} does not exist — Story 1.18 emits the team and "
    "player profile artifacts, so the artifact->entity half of AD-4's bijection has "
    "nothing to run against in this story. This is NOT a pass."
)

# **An EXISTING but empty directory is a different fact and must not borrow the message
# above.** A swept or aborted Story 1.18 run leaves the directory in place with no JSON in
# it; reporting "does not exist" then asserts something false, and — worse — reports a
# 0-against-48 bijection failure as a missing baseline. Absent means the successor has not
# run; empty means it ran and produced nothing, which is a finding.
PROFILE_DIRECTORY_EMPTY = (
    "{path} exists and holds no profile artifact, so all {listed} listed {kind} are "
    "unbacked. An empty directory is not an unavailable baseline: Story 1.18 has run here "
    "and emitted nothing."
)


def check_route_manifest(tournament: dict, data_dir: "str | Path") -> "list[str]":
    """AD-4's route-manifest bijection, both directions, honestly (Story 1.17 D2).

    Returns human-readable notes for the CLI to print. Raises `RouteManifestError` when a
    direction that CAN be checked fails.

    **The two directions are not equally checkable today, and pretending otherwise would
    be the defect.** AC 3 requires one profile artifact per listed entity — but
    `data/index/team-profiles/` and `player-profiles/` are Story 1.18's output and do not
    exist, so a literal `==` here would fail on 1,248 players and 48 teams, and a
    `if not exists: pass` would be a gate that cannot fail, which reads greener than no
    gate while proving strictly less.

    So this copies Story 1.15's two-source pattern exactly, which is precedent rather than
    invention and which worked as intended when its successor landed:

    * the direction checkable NOW is asserted — every Match Bundle committed under
      `data/matches/` is named by `entities.matches`, all 104 of them, and any bundle on
      disk that no entity lists is a route-manifest failure;
    * the profile direction PRINTS that it could not run and says in words that this is
      not a pass;
    * `test_the_repository_has_no_committed_profiles_yet` goes RED BY DESIGN the moment
      1.18 COMMITS, which is the prompt to make the populated branch primary here.

    **"Committed" is load-bearing and was learned the hard way.** A concurrent Story 1.18
    session EMITTED 1,296 profiles into the shared working tree during this story's review;
    every test reading the directory then passed locally while failing on any clean
    checkout. The tripwire and the populated-bijection test are both keyed on `git
    ls-files`, not on what happens to be on disk, and they swap over in the same run.

    **Ordering constraint, stated because the recourse is not obvious.** The profile
    direction is checked BEFORE the write, so once profiles exist, adding an entity to the
    spine makes this raise and blocks emission of the very manifest the profiles are built
    from. The recourse is to empty the two profile directories, re-run this module, then
    re-run Story 1.18. Resolving the phase ordering properly belongs to Story 1.19, which
    owns end-to-end orchestration; it is ledgered in `deferred-work.md`.
    """
    notes: "list[str]" = []
    root = Path(data_dir)

    listed = {row["matchId"] for row in tournament["entities"]["matches"]}
    matches_dir = root / "matches"
    on_disk = sorted(p.stem for p in matches_dir.glob("*.json")) if matches_dir.is_dir() \
        else []
    if not on_disk:
        notes.append(
            f"committed bundle baseline unavailable: no match bundles under "
            f"{matches_dir.as_posix()} — the artifact->entity direction could not run. "
            f"This is NOT a pass."
        )
    else:
        orphans = sorted(set(on_disk) - listed)
        if orphans:
            raise RouteManifestError(
                f"{len(orphans)} committed Match Bundle(s) are named by no entities.matches "
                f"entry: {orphans[:10]!r}{' …' if len(orphans) > 10 else ''}. Every emitted "
                f"artifact must have a route"
            )
        unbacked = sorted(listed - set(on_disk))
        if unbacked:
            raise RouteManifestError(
                f"{len(unbacked)} match route(s) are listed with no committed bundle: "
                f"{unbacked[:10]!r}{' …' if len(unbacked) > 10 else ''}. AC 3 allows an "
                f"empty section and never an absent artifact"
            )
        notes.append(f"matches: {len(on_disk)} committed bundle(s) <-> "
                     f"{len(listed)} listed route(s) — bijection holds")

    for kind, folder in (("teams", "team-profiles"), ("players", "player-profiles")):
        directory = root / "index" / folder
        exists = directory.is_dir()
        profiles = sorted(p.stem for p in directory.glob("*.json")) if exists else []
        if not profiles and not exists:
            notes.append(PROFILE_BASELINE_UNAVAILABLE.format(path=directory.as_posix()))
            continue
        if not profiles:
            raise RouteManifestError(PROFILE_DIRECTORY_EMPTY.format(
                path=directory.as_posix(), kind=kind,
                listed=len(tournament["entities"][kind])))
        # Story 1.18 has landed. This branch is deliberately live from the day it does, so
        # the successor is not silently running against a gate that was never wired up.
        key = "teamId" if kind == "teams" else "playerId"
        listed_kind = {row[key] for row in tournament["entities"][kind]}
        missing = sorted(listed_kind - set(profiles))
        orphans = sorted(set(profiles) - listed_kind)
        if missing or orphans:
            raise RouteManifestError(
                f"{folder}: {len(missing)} listed {kind} have no profile artifact "
                f"{missing[:5]!r}; {len(orphans)} profile artifact(s) are listed by no "
                f"entity {orphans[:5]!r}"
            )
        notes.append(f"{kind}: {len(profiles)} profile(s) <-> {len(listed_kind)} listed "
                     f"route(s) — bijection holds")
    return notes


# ------------------------------------------------------------------------------- emission
def emit_index(spine_dir: "str | Path" = DEFAULT_SPINE_DIR,
               data_dir: "str | Path" = DEFAULT_DATA_DIR,
               *, expect_matches: "int | None" = None,
               dry_run: bool = False,
               notes: "list[str] | None" = None) -> "list[Path]":
    """Build, round, validate, serialize, measure, gate — and only then write.

    Both artifacts or neither. AD-8's "never abort the batch" governs per-report extract;
    emission has no per-report recovery, and a partial `data/index/` becomes the pinning
    baseline for everything downstream.

    **Every failure class that can be evaluated independently is COLLECTED, and the run
    reports all of them at once** — "aborting on the first turns one run into ten." The
    1.17 code review found this claim true only of the budget gate, with schema validation,
    id containment and the route manifest each aborting serially, so a run with three
    distinct faults reported one and cost three runs to diagnose. They are gathered here.

    The one deliberate exception is ORDERING: schema validation runs first and alone,
    because the later gates subscript fields (`entities.matches[].matchId`, a board's
    `scope`) that a schema-invalid artifact may not carry, and a `KeyError` raised from
    inside a gate proves nothing about the gate. Stated rather than left to be inferred.

    `expect_matches` is checked HERE, before the write, not by the caller — the same
    reasoning `emit_bundles` records: a check made after the function returns is a check
    made after the filesystem has already changed.

    Returns the artifact paths. A dry run writes nothing — that is a promise about the
    filesystem, not about the return value — and returns the targets it validated rather
    than an empty list that every downstream count check would read as a miss.

    `notes` is an optional sink the CLI passes so it can print the route-manifest findings.
    It is a sink rather than a second return value because the return type is pinned, and
    because D2 makes those notes non-optional output: the profile direction of the
    bijection PRINTS that it could not run, in words, and a caller that silently discarded
    that would turn "this is NOT a pass" back into a silent pass.
    """
    entities, matches = load_spine(spine_dir)
    check_entities_shape(entities, f"{Path(spine_dir).as_posix()}/entities.json")

    bundles_dir = Path(data_dir) / "matches"
    bundle_paths = sorted(bundles_dir.glob("*.json"))
    if not bundle_paths:
        raise IndexEmitError(
            f"no committed Match Bundle under {bundles_dir.as_posix()}; the leaderboards "
            f"aggregate them and an empty corpus is never a pass"
        )
    bundles = [json.loads(path.read_text(encoding="utf-8")) for path in bundle_paths]

    if expect_matches is not None and len(entities["matches"]) != expect_matches:
        raise IndexEmitError(
            f"the spine lists {len(entities['matches'])} match(es), expected "
            f"{expect_matches}")
    if expect_matches is not None and len(bundles) != expect_matches:
        raise IndexEmitError(
            f"{len(bundles)} committed bundle(s), expected {expect_matches}")

    tournament = build_tournament(entities, matches)
    leaderboards = build_leaderboards(entities, matches, bundles)

    tournament = round_index(tournament,
                             decimals_map(TOURNAMENT_SCHEMA, require_float=False),
                             TOURNAMENT_LEAF_TYPES)
    leaderboards = round_index(leaderboards, decimals_map(LEADERBOARDS_SCHEMA),
                               LEADERBOARDS_LEAF_TYPES)

    violations: "list[str]" = []
    for artifact, schema_name in ((tournament, TOURNAMENT_SCHEMA),
                                  (leaderboards, LEADERBOARDS_SCHEMA)):
        try:
            validate_artifact(artifact, schema_name, instance_label=schema_name)
        except SchemaValidationError as exc:
            violations.append(f"{schema_name}: {exc}")
    if violations:
        raise BundleValidationError(
            f"{len(violations)} index artifact(s) failed the /contract schema: "
            + "; ".join(sorted(violations))
        )

    tournament_text = canonical_json(tournament)
    leaderboards_text = canonical_json(leaderboards)

    breaches = [breach for breach in (
        over_budget("tournament.json", tournament_text),
        over_budget("leaderboards.json", leaderboards_text),
        over_budget_combined("tournament.json + leaderboards.json",
                             [tournament_text, leaderboards_text]),
    ) if breach is not None]

    # The budget, the id containment and the route manifest are mutually independent, so
    # all three run and every finding is reported together. Each raises its OWN typed error
    # (`errors.py`: "one exception per failure kind, never overload one class for two"), so
    # when more than one fires the run raises the first by that declared order and names
    # the others in the message rather than swallowing them.
    failures: "list[tuple[type[PipelineError], str]]" = []
    if breaches:
        shown = "; ".join(
            f"{label} {gz} gzip-9 bytes over canonical {raw}" for label, gz, raw
            in sorted(breaches))
        failures.append((BudgetExceededError,
            f"{len(breaches)} payload budget breach(es) against the {BUDGET_BYTES}-byte "
            f"ceiling: {shown}. AD-4 measures tournament.json + leaderboards.json COMBINED "
            f"because the Hub loads both. SM-C2: resolve by splitting or by a logged budget "
            f"decision, NEVER by dropping fields, lowering a precision to fit, or "
            f"truncating the entity lists — those are the route manifest."))

    manifest_notes: "list[str]" = []
    for gate in (lambda: check_index_ids(tournament, leaderboards),
                 lambda: manifest_notes.extend(
                     check_route_manifest(tournament, data_dir))):
        try:
            gate()
        except (RouteManifestError, IndexEmitError) as exc:
            failures.append((type(exc), str(exc)))
    if notes is not None:
        notes.extend(manifest_notes)

    if failures:
        error_type, first = failures[0]
        rest = "".join(f" ALSO: {message}" for _t, message in failures[1:])
        raise error_type(f"{first}{rest}")

    out_dir = Path(data_dir) / "index"
    targets = [out_dir / "tournament.json", out_dir / "leaderboards.json"]
    if dry_run:
        return targets

    written: "list[Path]" = []
    for target, text in zip(targets, (tournament_text, leaderboards_text)):
        # `json.loads(text)` round-trips deliberately: the bytes measured above and the
        # bytes written here are then provably the same serialization, rather than two
        # serializations of one object that a stray key-order change could separate.
        written.append(write_canonical(json.loads(text), target))

    # Sweep stale artifacts this run did not produce, AFTER a successful write and never
    # before it — Story 1.16 patch 3 records a short spine deleting 54 committed bundles
    # because the count check ran after the sweep. Scoped to `data/index/*.json`, which is
    # a non-recursive glob: Story 1.18's `team-profiles/` and `player-profiles/`
    # subdirectories are not reachable by it and must never be.
    keep = {path.name for path in written}
    for existing in sorted(out_dir.glob("*.json")):
        if existing.name not in keep:
            existing.unlink()
    return written


# ------------------------------------------------------------------------------------ CLI
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.precompute.index",
        description="Emit the tournament index and the leaderboards from the staged spine "
                    "and the committed Match Bundles.",
    )
    parser.add_argument("--spine-dir", default=str(DEFAULT_SPINE_DIR),
                        help="staged spine to consume (default work/spine)")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR),
                        help="artifact root; writes data/index (default data)")
    parser.add_argument("--expect-matches", type=int, default=None, metavar="N",
                        help="assert exactly N matches are indexed (use 104)")
    parser.add_argument("--dry-run", action="store_true",
                        help="build, validate, round and measure; write nothing")
    return parser


def main(argv: "list[str] | None" = None) -> int:
    args = build_parser().parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")

    print("")
    print("Tournament index emission")
    print("=" * 25)
    print(f"spine dir       : {Path(args.spine_dir).as_posix()}")
    print(f"data dir        : {Path(args.data_dir).as_posix()}")
    print(f"schemaVersion   : {schema_version()}")

    notes: "list[str]" = []
    try:
        written = emit_index(args.spine_dir, args.data_dir,
                             expect_matches=args.expect_matches,
                             dry_run=args.dry_run, notes=notes)
    except PipelineError as exc:
        print("")
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    except (OSError, AssertionError, json.JSONDecodeError) as exc:
        # `json.JSONDecodeError` is a `ValueError`, so without naming it a malformed
        # committed bundle would exit 1 with a traceback and read as a finding about the
        # data. It is a broken harness: nothing was learned. `AssertionError` is
        # `decimals_map`'s vacuity guard, for the same reason.
        print("")
        print(f"index emission could not run: {exc}", file=sys.stderr)
        return 2

    for note in notes:
        print(f"  {note}")
    suffix = " (dry run, nothing written)" if args.dry_run else ""
    print(f"artifacts       : {len(written)}{suffix}")

    # **AD-3's immutability walk, now reaching `data/index/`** (added by the 1.17 code
    # review). A SECOND source, independent of `check_index_ids`: that one asks whether the
    # artifacts agree with the manifest they carry, this one re-opens what is on disk and
    # asks whether every id is pinned by the slug REGISTRY. Without it, an id could be
    # rewritten in both the manifest and its references and no gate would object.
    #
    # Story 1.18 parameterized `globs` and `id_keys` for exactly this shape, so `identity.py`
    # is still untouched by this story. Skipped on a dry run: nothing new was written to
    # re-read, and the committed artifacts are the previous run's.
    if not args.dry_run:
        try:
            for note in check_committed_data(
                    PINS, args.data_dir,
                    globs=("index/*.json",),
                    id_keys=_ID_KEY_KIND,
                    unavailable=INDEX_BASELINE_UNAVAILABLE,
                    noun="index artifact"):
                print(note)
                if "NOT a pass" in note:
                    notes.append(note)
        except PipelineError as exc:
            print("")
            print(f"FAIL: {exc}", file=sys.stderr)
            return 1

    # **The headline must not contradict the notes above it.** The gates that RAN all
    # passed — that is what the exit code means and it is unchanged — but a run where a
    # direction of AD-4's bijection could not run has not proven what an unqualified `PASS`
    # claims. Printing both `This is NOT a pass.` and `INDEX RESULT: PASS` in one output put
    # the gate-that-reads-green failure back at the one surface a human actually reads.
    incomplete = [note for note in notes if "NOT a pass" in note]
    print("")
    if incomplete:
        print(f"INDEX RESULT: PASS ({len(incomplete)} check(s) COULD NOT RUN — see above; "
              f"this run does not prove them)")
    else:
        print("INDEX RESULT: PASS")
    print("")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())

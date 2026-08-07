"""Team and player profile artifacts (Story 1.18, FR-19 / AD-5).

Emits `data/index/team-profiles/{team-id}.json` (48) and
`data/index/player-profiles/{player-id}.json` (1,248) from the committed Match Bundles.

**The input is `data/matches/`, not `work/spine/`, and that is a ruling.** The bundles are
already camelCase, already contract-shaped, already schema-valid and already carry resolved
ids. Reading the spine would require a SECOND snake_case->camelCase mapper, and Story
1.16's binding rule is that "the mapping happens at this boundary only". It also makes every
`matches[]` row literally verbatim from the bundle, which is what AC 4 asks for. *Recorded
alternative: emitting from `work/spine/` as `emit.py` does. Rejected because it duplicates
the mapping boundary and because `work/spine/` is gitignored staging, so no committed test
could run against it.* **Consequence: profile emission runs AFTER `emit_bundles`, and
`data/matches/` is its input.**

**Emit all or emit none (AD-4, AD-8).** Every artifact is built, validated, rounded and
measured before the first byte is written, and the write itself is a staged-directory swap
so an `OSError` on artifact 800 of 1,296 cannot leave a partial namespace behind for
`identity.check_committed_data` to pin as the immutability baseline. A corpus-level abort is
therefore the designed behaviour, not an AD-8 violation.

**The same word "average" means two different arithmetics in the two artifacts, and both
are correct.** A team's `tacticalIdentity.possession` is an UNWEIGHTED mean over the team's
matches, because no possession-time denominator exists anywhere in the artifact set and
`AggregateTacticalIdentity` says "match-count-weighted mean over the team's matches". A
player's `passCompletion` aggregate is a WEIGHTED mean, `sum(completed) / sum(attempted)`,
because that denominator does exist on every row. Do not "unify" them.

Rulings recorded in the story's Dev Agent Record; the ones that shape this module:

* **R1** — goalkeeping appears in NO profile artifact. Neither profile schema carries a
  goalkeeping property and both are `additionalProperties: false`; CS-2's D2b made
  `GoalkeepingBlock` per-team with the keeper list as context. A goalkeeper's profile is
  exactly the same shape as every other player's. Nothing goalkeeping-shaped is synthesized.
* **R2** — `aggregates[]` is all 18 legal player-scope `MetricCode`s in the enum's own
  (alphabetical) order and `trends[]` is six of them, both TOTAL on all 1,248 files so the
  App never branches. A zero-appearance player carries 18 zeroed rows and six empty series.
* **R3** — the AD-4 route-manifest bijection is Story 1.17's; this module asserts only the
  unilateral, always-runnable property (one artifact per registry-pinned entity) and PRINTS
  that the manifest bijection is not asserted here, so the gap is visible rather than silent.
* **R4** — `TeamMatchBreakdown.result` follows `metadata.score`, so the 8 team-rows of the
  4 shootout matches read `draw`. `MatchResult` is tied to "standings form sequences" and
  `TournamentRecord` says "knockout ties award none", which presupposes a knockout tie is
  recorded as a tie. Progression is carried by `record.furthestStage`.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from pipeline.discover.rounds import KNOCKOUT_ROUNDS
from pipeline.errors import PipelineError
from pipeline.ingest.records import canonical_json, write_canonical
from pipeline.precompute.budget import BUDGET_BYTES, over_budget
from pipeline.precompute.emit import DEFAULT_DATA_DIR, check_total
from pipeline.precompute.identity import (
    PROFILE_BASELINE_UNAVAILABLE,
    PROFILE_ID_KEYS,
    check_committed_data,
)
from pipeline.precompute.errors import (
    BudgetExceededError,
    ProfileError,
    ProfileValidationError,
)
from pipeline.precompute.serialize import decimals_map, round_to_precision
from pipeline.precompute.slug_registry import PINS, TEAM_CODES
from pipeline.validate.errors import SchemaValidationError
from pipeline.validate.schema import schema_version, validate_artifact

TEAM_SCHEMA = "team-profile.schema.json"
PLAYER_SCHEMA = "player-profile.schema.json"

# **`emit.check_total` is REUSED, not forked, and the history is worth recording because the
# story ordered the fork.** At this story's baseline (`74b1789`) `emit._def_properties` took
# only a name and resolved it against the match-bundle + common documents, so all 13 profile
# `$def`s raised `KeyError` and Task 4.7 correctly ordered a profile-scoped copy. Story 1.17
# then landed (`ae207ed`) with a `documents` parameter added for exactly this purpose, and
# its docstring forbids the alternative: "A second copy of this function would be a second
# definition of 'the boundary is total', and the inline-title loop below is precisely the
# part a copy tends to drop." The fork was written, then retired once 1.17 was committed
# rather than merely in-flight. `test_emit_profiles.py` pins that all 20 profile types
# resolve through the shipped function, so a revert of 1.17's parameter is loud here.
#
# The inline-title loop matters: six profile objects are declared with a `title` rather than
# hoisted into `$defs` — `AggregateInPossessionPhases`, `AggregateOutOfPossessionPhases`,
# `AggregateShapeByPhase`, `AggregateInPossessionShapePanels`,
# `AggregateOutOfPossessionShapePanels`, `AggregateBlockDistribution`.
TEAM_DOCS = (TEAM_SCHEMA, "common.schema.json")
PLAYER_DOCS = (PLAYER_SCHEMA, "common.schema.json")

# `("group",) + KNOCKOUT_ROUNDS`, imported rather than re-invented. `common#Stage`'s own
# description says "Knockout codes are exactly pipeline.discover.rounds.KNOCKOUT_ROUNDS".
# The `third-place` < `final` position is the trap and the shipped tuple already encodes it:
# a team in the third-place play-off did NOT reach the final. Exactly one match of each
# exists, so both branches are corpus-live.
STAGE_ORDER: "tuple[str, ...]" = ("group",) + KNOCKOUT_ROUNDS

# The two possession states of `metadata`-level lineups, and the two lineup sections a
# player can be listed under. Named rather than inlined so a typo is an import error.
SIDES = ("home", "away")
SECTIONS = ("starters", "substitutes")


# --------------------------------------------------------------- the per-metric reduction
#
# `(metricCode, block, field, aggregation, per_ninety, places)`.
#
# **This table is the AC, and it is deliberately NOT importable by the test module's
# expectations.** AC 4's anti-tautology rule: "Derive expected values from the parsed
# corpus, never restate the implementation. A test asserting `emit(x) == emit(x)` proves
# only that the function is the function." `test_emit_profiles.py` writes eighteen NAMED
# expectations, each re-deriving its own reduction from `data/matches/*.json`, rather than
# parametrizing over this tuple.
#
# Order is `common#MetricCode`'s own, which is alphabetical (verified, not assumed:
# `enum == sorted(enum)`). `additionalProperties` does not constrain array contents, so the
# order is the only contract the App has — AD-4 makes it render artifact order verbatim.
#
# `places` is the precision of the SOURCE FIELD named by `metricCode`, per
# `AggregateMetricValue`'s own instruction, NOT the polymorphic slot's `x-decimals: 2`.
# The names (`Count`, `Metres`, ...) are resolved against `decimals_map` at runtime so the
# VALUES stay in the schema; only the key->name binding lives here.
_PLAYER_METRICS: "tuple[tuple[str, str, str, str, bool, str], ...]" = (
    ("ballProgressions", "inPossession", "ballProgressions", "sum", True, "Count"),
    ("crossesCompleted", "inPossession", "crossesCompleted", "sum", True, "Count"),
    ("duelsWonAerial", "outOfPossession", "duelsWonAerial", "sum", True, "Count"),
    ("duelsWonPhysical", "outOfPossession", "duelsWonPhysical", "sum", True, "Count"),
    ("goals", "inPossession", "goals", "sum", True, "Count"),
    ("highSpeedRuns", "physical", "highSpeedRuns", "sum", True, "Count"),
    ("interceptions", "outOfPossession", "interceptions", "sum", True, "Count"),
    ("lineBreaksCompleted", "inPossession", "lineBreaksCompleted", "sum", True, "Count"),
    # The one weighted average, and the one metric whose `aggregation` label cannot express
    # its own arithmetic: `AggregationSemantics` is `sum | max | average` and carries no
    # denominator. That is precisely why the test asserts the arithmetic rather than the
    # label. See `_pass_completion`.
    ("passCompletion", "inPossession", "passCompletion", "average", False, "Percentage"),
    ("passesCompleted", "inPossession", "passesCompleted", "sum", True, "Count"),
    ("possessionRegains", "outOfPossession", "possessionRegains", "sum", True, "Count"),
    ("sprints", "physical", "sprints", "sum", True, "Count"),
    ("stepIns", "inPossession", "stepIns", "sum", True, "Count"),
    ("switchesOfPlay", "inPossession", "switchesOfPlay", "sum", True, "Count"),
    ("tacklesWon", "outOfPossession", "tacklesWon", "sum", True, "Count"),
    ("takeOns", "inPossession", "takeOns", "sum", True, "Count"),
    ("topSpeed", "physical", "topSpeed", "max", False, "KmPerHour"),
    ("totalDistance", "physical", "totalDistance", "sum", True, "Metres"),
)

# The six the App can chart meaningfully per match (R2). Emitted in the same enum order as
# `aggregates[]` — ruled here rather than inherited, because R2 enumerates the SET and
# leaves the order open. One ordering convention serves both lists, so a reader never has
# to learn two; AD-4 makes artifact order the contract either way.
_TREND_CODES: "tuple[str, ...]" = (
    "ballProgressions", "goals", "passCompletion", "passesCompleted",
    "topSpeed", "totalDistance",
)

# `PhysicalProfile`'s own description: "Distances are the sums over matches played;
# topSpeed is the maximum, never a mean." Eight sum, one maxes.
_PHYSICAL_SUMMED = (
    "totalDistance", "distanceZone1", "distanceZone2", "distanceZone3",
    "distanceZone4", "distanceZone5", "highSpeedRuns", "sprints",
)

# The ten stat columns of a `PlayerMatchRow`, verbatim from that match's Domain G row.
# `attemptsAtGoal` and `passesAttempted` are required columns that appear in NO `metricCode`
# table anywhere in this story — their source is named here and nowhere else.
_MATCH_ROW_STATS = (
    ("goals", "inPossession"),
    ("attemptsAtGoal", "inPossession"),
    ("passesAttempted", "inPossession"),
    ("passesCompleted", "inPossession"),
    ("passCompletion", "inPossession"),
    ("ballProgressions", "inPossession"),
    ("duelsWonAerial", "outOfPossession"),
    ("duelsWonPhysical", "outOfPossession"),
    ("totalDistance", "physical"),
    ("topSpeed", "physical"),
)


# ------------------------------------------------------------------- precision, bound hard
#
# **`emit._KEY_TO_DEF` is NOT reused, and that is deliberate.** Story 1.16's review found it
# defective: `round_bundle` passes a parent's binding down to any unrecognised key, and
# `"home"`/`"away"` are bound to `Count`, so 29 percentage and metre leaves inherited 0
# places and `lineHeight: 19.5` shipped as `20` while validating clean. Here every numeric
# leaf key is bound explicitly and an UNBOUND numeric leaf RAISES rather than defaulting —
# nothing inherits anything.
_PROFILE_KEY_TO_DEF: "dict[str, str]" = {
    # Team: TournamentRecord
    "played": "Count", "won": "Count", "drawn": "Count", "lost": "Count",
    "goalsFor": "Count", "goalsAgainst": "Count", "points": "Count",
    "goalDifference": "TeamProfileGoalDifference",
    # Team: the 8 + 9 + 3 percentages of AggregateTacticalIdentity
    "buildUpUnopposed": "Percentage", "buildUpOpposed": "Percentage",
    "progression": "Percentage", "finalThird": "Percentage", "longBall": "Percentage",
    "attackingTransition": "Percentage", "counterAttack": "Percentage",
    "setPiece": "Percentage",
    "highPress": "Percentage", "midPress": "Percentage", "lowPress": "Percentage",
    "highBlock": "Percentage", "midBlock": "Percentage", "lowBlock": "Percentage",
    "recovery": "Percentage", "defensiveTransition": "Percentage",
    "counterPress": "Percentage",
    "high": "Percentage", "mid": "Percentage", "low": "Percentage",
    # Team: the 18 metres of shapeByPhase (3 measures x 6 panels)
    "lineHeight": "Metres", "teamLength": "Metres", "teamWidth": "Metres",
    # Team: the two scalars the bundle's `tacticalIdentity` does NOT carry
    "possession": "Percentage", "pressingIntensity": "PressingIntensity",
    # Team: FormationUsageRow + TeamMatchBreakdown
    "matches": "Count", "share": "Percentage",
    "expectedGoals": "ExpectedGoals", "shots": "Count", "shotsOnTarget": "Count",
    "passCompletion": "Percentage", "distanceCovered": "Kilometres",
    # Player: Appearances, PhysicalProfile, PlayerMatchRow
    "started": "Count", "substituteAppearances": "Count", "minutesPlayed": "Count",
    "totalDistance": "Metres", "distanceZone1": "Metres", "distanceZone2": "Metres",
    "distanceZone3": "Metres", "distanceZone4": "Metres", "distanceZone5": "Metres",
    "highSpeedRuns": "Count", "sprints": "Count", "topSpeed": "KmPerHour",
    "shirtNumber": "ShirtNumber",
    "goals": "Count", "attemptsAtGoal": "Count", "passesAttempted": "Count",
    "passesCompleted": "Count", "ballProgressions": "Count",
    "duelsWonAerial": "Count", "duelsWonPhysical": "Count",
}

# The keys whose precision is METRIC-DEPENDENT and therefore cannot be bound by key name.
# `AggregateMetricValue`, `TrendPointValue` and `PerNinety` all declare `x-decimals: 2`,
# which their own descriptions call "the widest precision any metric uses" — a placeholder,
# not the rule. `_round_profile` handles these by `metricCode` and skips the key table.
_METRIC_KEYED_LEAVES = frozenset({"value", "perNinety"})

# The one numeric leaf deliberately exempt from the "an unbound leaf raises" rule, named
# here rather than given a fake binding. `schemaVersion` is `{"type": "integer",
# "const": 4}` in both profile documents and declares no `x-decimals` at all, so there is
# no precision to bind it to — `decimals_map` correctly does not carry it. It is stamped
# from `schema_version()` and is never the product of arithmetic, so it cannot carry float
# error. Binding it to `Count` would be a lie about which `$def` it references; leaving it
# unnamed would make the strict rule fire on every one of the 1,296 artifacts.
_UNROUNDED_LEAVES = frozenset({"schemaVersion"})


def precision_by_key(decimals: "dict[str, int]") -> "dict[str, int]":
    """Which declared precision each profile leaf key carries.

    The NAMES come from `decimals_map`, which derives them from the schema; this only
    records which profile key resolves to which name. Every name must resolve: silently
    dropping an unresolved one would mean a renamed `$def` quietly unbinds every key that
    pointed at it, shipping them unrounded while `decimals_map`'s vacuity guard stays green.
    """
    unresolved = sorted({n for n in _PROFILE_KEY_TO_DEF.values() if n not in decimals})
    if unresolved:
        raise ProfileError(
            f"precision binding names {unresolved!r}, which the schema-derived map does not "
            f"carry (it has {sorted(decimals)!r}); every bound key would ship unrounded"
        )
    return {key: decimals[name] for key, name in _PROFILE_KEY_TO_DEF.items()}


def _metric_places(decimals: "dict[str, int]") -> "dict[str, int]":
    """`metricCode -> the precision of the source field it names`."""
    return {code: decimals[name] for code, _b, _f, _a, _p, name in _PLAYER_METRICS}


def per_ninety_places(decimals: "dict[str, int]") -> int:
    """`PerNinety`'s declared precision, ASSERTED present rather than looked up bare.

    **At this story's baseline `decimals_map("player-profile.schema.json")` silently omitted
    `PerNinety`**, which is why this is a named function with a message instead of a dict
    subscript. The map held 7 names and `PerNinety` was not among them: its `x-decimals: 2`
    sits inside an `anyOf` branch while the document's inline-title loop read the keyword off
    the titled node itself — the identical shape `StoppageMinute` needed a special case for,
    pinned by `test_emit_serialize.py::test_stoppage_minute_declares_inside_its_anyof_branch`.
    An unbound `perNinety` leaf ships unrounded 17-digit floats, validates clean against
    `type: number`, and destroys byte-identity.

    Story 1.17 (`ae207ed`) fixed that loop to use `_declared_places`, crediting
    `LeaderboardPerMatchValue` — the same shape in its own artifact — so the name is now
    carried and the value is read from the map like every other precision, never hardcoded.
    What stays is the ASSERT: a bare `KeyError` here would be a silent unbinding, so the
    failure is typed and says what it would have cost.
    """
    if "PerNinety" not in decimals:
        raise ProfileError(
            "the schema-derived precision map does not carry 'PerNinety' (it has "
            f"{sorted(decimals)!r}). Its x-decimals sits inside an anyOf branch, so a "
            "walker reading the keyword off the titled node alone misses it — and an "
            "unbound perNinety ships unrounded floats that validate clean."
        )
    return decimals["PerNinety"]


def _rounded(value: "int | float", places: int) -> "int | float":
    """`round_to_precision`, plus the float coercion a declared decimal place implies.

    **`round_to_precision(0, 1)` returns `int` 0, and that shipped 1,672 leaves as JSON
    integers across the 209 zero-appearance profiles.** An empty reduction is an `int` in
    Python — `sum([])` is `0` and `max((), default=0)` was `0` — and rounding an `int` to 1
    place leaves it an `int`, so `totalDistance` and the five distance zones printed as `0`
    while `topSpeed` beside them printed `0.0` purely because `_physical_profile` happened to
    spell its default `0.0`. The corpus convention is unambiguous in the other direction: the
    104 committed Match Bundles carry 23,023 values in these same 1-decimal Domain G slots
    and **every one is a JSON float, including all 261 genuine zeros**.

    Coercing here rather than at each reduction site fixes the whole class at one point: any
    leaf whose `$def` declares a decimal place ships as a float regardless of how its value
    was computed. A 0-place leaf (`Count`, `ShirtNumber`, `TeamProfileGoalDifference` — all
    `type: integer`) is left an `int`, which the contract requires.
    """
    rounded = round_to_precision(value, places)
    return float(rounded) if places > 0 else rounded


def _round_profile(node, by_key: "dict[str, int]", metric_places: "dict[str, int]",
                   per_ninety_places: int, where: str, key: "str | None" = None,
                   metric: "str | None" = None):
    """Round every numeric leaf of a built profile to its declared precision.

    Three rules, in order:

    1. `value` and `perNinety` are POLYMORPHIC slots. `value` (and a trend point's `value`)
       rounds to the precision of the source field named by the enclosing `metricCode`;
       `perNinety` rounds to 2 places for EVERY metric. Applying `Count`'s 0 places to a
       per-90 would round `goals` per-90 to `0` and destroy the field — the committed
       fixture proves the rule with `goals` value `1`, `perNinety` `0.37`.
    2. Every other numeric leaf is bound by key name, explicitly.
    3. An unbound numeric leaf RAISES. Nothing inherits a parent's binding, which is the
       defect Story 1.16's review found in `emit._KEY_TO_DEF`.
    """
    if isinstance(node, dict):
        # `metricCode` sits beside `value`/`perNinety` on an `AggregateMetric`, and one
        # level above `points[].value` on a `TrendSeries`. Both are covered by carrying it
        # down from whichever node declares it.
        code = node.get("metricCode", metric)
        return {
            k: _round_profile(v, by_key, metric_places, per_ninety_places,
                              f"{where}.{k}", k, code)
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [
            _round_profile(v, by_key, metric_places, per_ninety_places,
                           f"{where}[{i}]", key, metric)
            for i, v in enumerate(node)
        ]
    if isinstance(node, bool) or node is None or not isinstance(node, (int, float)):
        return node

    if key in _METRIC_KEYED_LEAVES:
        if metric is None:
            raise ProfileError(
                f"{where}: {key!r} is a metric-keyed precision slot but no enclosing "
                f"metricCode was found; it would ship unrounded"
            )
        if key == "perNinety":
            return _rounded(node, per_ninety_places)
        if metric not in metric_places:
            raise ProfileError(
                f"{where}: metricCode {metric!r} has no declared source precision; "
                f"known {sorted(metric_places)!r}"
            )
        return _rounded(node, metric_places[metric])

    if key in _UNROUNDED_LEAVES:
        return node
    if key not in by_key:
        raise ProfileError(
            f"{where}: numeric leaf {key!r} = {node!r} is not bound to any declared "
            f"precision; an unbound leaf ships unrounded and validates clean"
        )
    return _rounded(node, by_key[key])


# ------------------------------------------------------------------------------ the inputs
_REQUIRED_BUNDLE_KEYS = ("matchId", "metadata", "keyStatistics", "tacticalIdentity",
                         "players")
_REQUIRED_METADATA_KEYS = ("date", "stage", "group", "score", "homeTeam", "awayTeam",
                           "lineups", "knockoutScore")


def check_bundle_shape(bundle: "dict", where: str) -> "dict":
    """Assert one committed Match Bundle carries the paths this module reads by subscript.

    Mirrors `emit.check_spine_shape`, which Story 1.16's review decision 3 ruled in — "the
    emitter's bare-subscript spine reads — ADD THE ENTRY-POINT GUARD". `check_total` is NOT
    a substitute: it only inspects dicts a mapper already built.

    **`players` is asserted PRESENT but NOT NON-NULL.** `match-bundle.schema.json` declares
    it "Per-player Domain G records, **or null** when the report does not carry the
    per-player pages at all", and this story's own Task 8.1 orders a `players: null`
    fixture, so a guard that raised on null would contradict it. A `players: null` bundle is
    legal and contributes ZERO player match rows and zero team-level effect: every player in
    its lineups still gets a profile from the other matches, and a player whose only bundle
    is null-`players` becomes zero-appearance. Corpus today carries 0 null and 0 empty, so
    this is a latent path tested by construction, never by corpus.
    """
    if not isinstance(bundle, dict):
        raise ProfileError(f"{where}: bundle is {type(bundle).__name__}, not an object")
    missing = [k for k in _REQUIRED_BUNDLE_KEYS if k not in bundle]
    if missing:
        raise ProfileError(f"{where}: bundle is missing {missing!r}")
    metadata = bundle["metadata"]
    if not isinstance(metadata, dict):
        raise ProfileError(f"{where}: bundle has no 'metadata' object")
    absent = [k for k in _REQUIRED_METADATA_KEYS if k not in metadata]
    if absent:
        raise ProfileError(
            f"{where}: metadata is missing {absent!r}; the bundle was written by a "
            f"different checkout than this emitter reads"
        )
    score = metadata["score"]
    if not isinstance(score, dict) or not all(s in score for s in SIDES):
        raise ProfileError(f"{where}: metadata.score is not a {{home, away}} object")
    # **The two blocks the emitter reads DEEPEST were presence-only, and that is how a
    # malformed bundle became an uncaught `KeyError`.** `_aggregate_tactical_identity` and
    # `_team_match_row` subscript `bundle["tacticalIdentity"][side][...]` and
    # `bundle["keyStatistics"][side][...]` bare, so a bundle missing a SIDE — not the block —
    # sailed past this guard and blew up mid-build with no `FAIL:` line and no typed error,
    # which is the exit-code inversion (landmine 13) this guard exists to prevent. Asserting
    # the side keys is what makes the docstring's claim ("the paths this module reads by
    # subscript") true; the leaf keys stay unchecked on purpose, because `check_total` is
    # total over them at build time and would duplicate the list here.
    for block in ("keyStatistics", "tacticalIdentity"):
        node = bundle[block]
        if not isinstance(node, dict):
            raise ProfileError(f"{where}: {block} is {type(node).__name__}, not an object")
        for side in SIDES:
            if not isinstance(node.get(side), dict):
                raise ProfileError(f"{where}: {block}.{side} is missing or not an object")
    for side in SIDES:
        team = metadata.get(f"{side}Team")
        if not isinstance(team, dict) or "teamId" not in team or "name" not in team:
            raise ProfileError(f"{where}: metadata.{side}Team is not a {{teamId, name}}")
        lineup = (metadata.get("lineups") or {}).get(side)
        if not isinstance(lineup, dict) or "formation" not in lineup:
            raise ProfileError(f"{where}: metadata.lineups.{side} has no formation")
        for section in SECTIONS:
            entries = lineup.get(section)
            if not isinstance(entries, list):
                raise ProfileError(f"{where}: metadata.lineups.{side}.{section} is not a list")
            # `index_bundles` reads `entry["playerId"]` and `_identity` reads `name`,
            # `position` and `shirtNumber` by bare subscript. Same reasoning as the blocks
            # above: without this a malformed entry is a `KeyError`, not a finding.
            for position, entry in enumerate(entries):
                if not isinstance(entry, dict):
                    raise ProfileError(
                        f"{where}: lineups.{side}.{section}[{position}] is "
                        f"{type(entry).__name__}, not an object"
                    )
                lacking = [k for k in ("playerId", "name", "position", "shirtNumber")
                           if k not in entry]
                if lacking:
                    raise ProfileError(
                        f"{where}: lineups.{side}.{section}[{position}] is missing {lacking!r}"
                    )
    players = bundle["players"]
    if players is not None and not isinstance(players, list):
        raise ProfileError(
            f"{where}: players is {type(players).__name__}; the contract declares a list "
            f"or an explicit null"
        )
    return bundle


def entity_ref(entity_id: str, name: str) -> "dict":
    """`common#EntityRef` = `{id, name}`, `additionalProperties: false`.

    **NOT `emit._team_ref`.** That returns `TeamRef` `{teamId, teamCode, name}` and is
    schema-invalid in both slots that need this one — `TeamMatchBreakdown.opponent` and
    `PlayerProfile.team`. Reusing it is Story 1.16 landmine 8 and would fail on every row.
    """
    if not isinstance(entity_id, str) or not entity_id:
        raise ProfileError(f"EntityRef id must be a non-empty string, got {entity_id!r}")
    if not isinstance(name, str) or not name:
        raise ProfileError(f"EntityRef name must be a non-empty string, got {name!r}")
    return check_total({"id": entity_id, "name": name}, "EntityRef",
                       f"EntityRef[{entity_id}]", PLAYER_DOCS)


def match_length(bundle: "dict") -> int:
    """`120` when the tie went past 90 minutes, else `90`.

    *Ruled over `emit.periods_played`:* `metadata.knockoutScore.decidedBy` is non-nullable
    by contract while `momentum` — which `periods_played` reads — is nullable. Both agree on
    9 of 104 (5 `extra-time` + 4 `shootout`), verified independently in Task 1.4 against
    `periods_played`'s own 95/9 split.
    """
    knockout = bundle["metadata"].get("knockoutScore") or {}
    return 120 if knockout.get("decidedBy") in ("extra-time", "shootout") else 90


def has_minutes(entry: "dict", section: str) -> bool:
    """Did this lineup entry take the field?

    **`pipeline.extract.domain_g.has_minutes` is the ruled predicate and this MIRRORS it
    verbatim rather than re-deriving it.** It is not importable here: it reads
    `entry["substituted_on"]`, a staged snake_case key, and this module reads the committed
    camelCase bundles (Task 2.1). Task 3.2a anticipated exactly that and ordered the mirror
    with the difference stated, which is what this docstring is.

    Its rule, quoted: "A starter always did; a substitute did exactly when the lineup page
    stamped a sub-on minute." Its docstring already carries the Henderson correction — the
    one Domain G row with no minutes.
    """
    if section not in SECTIONS:
        raise ProfileError(f"unknown lineup section {section!r}; expected one of {SECTIONS!r}")
    # **An off-stamp with no on-stamp used to drop a real appearance in silence.** The
    # predicate returned `False`, `build_player_profile` skipped the entry, and the player's
    # Domain G row for that match went with it — no row, no minutes, no error. A substitute
    # cannot come off without having come on, so the pair is contradictory and the lineup
    # page is what is wrong; assert-on-unknown says raise rather than quietly under-count.
    if (section == "substitutes" and entry.get("substitutedOn") is None
            and entry.get("substitutedOff") is not None):
        raise ProfileError(
            f"{entry.get('playerId')!r}: a substitute carries substitutedOff="
            f"{entry.get('substitutedOff')!r} with no substitutedOn; the appearance cannot "
            f"be timed and dropping it would under-count in silence"
        )
    return section == "starters" or entry.get("substitutedOn") is not None


def _stamp_minute(stamp: "dict | None", where: str) -> "int | None":
    """The clock minute of a substitution stamp, or `None`.

    **`stoppageMinute` is IGNORED, and that is a ruling.** Task 1.4 measures 0 substitution
    stamps above minute 90 in a regulation match across all 104 bundles, so `minute` is
    already the clock minute inside the period; adding stoppage would push a total past
    `match_length` and turn a correct substitution into a `ProfileError`. 122 stamps carry a
    non-null `stoppageMinute` and every one of them is discarded here on purpose.
    """
    if stamp is None:
        return None
    minute = stamp.get("minute") if isinstance(stamp, dict) else None
    # `isinstance(True, int)` is `True` in Python, so the bare int check accepted
    # `{"minute": true}` and computed it as minute 1. Every other numeric guard in this
    # module excludes `bool` explicitly (`_round_profile`, `leaf_mean`); this one did not.
    if minute is None or isinstance(minute, bool) or not isinstance(minute, int):
        raise ProfileError(f"{where}: substitution stamp {stamp!r} carries no integer minute")
    return minute


def minutes_played(entry: "dict", section: str, length: int) -> int:
    """Minutes this lineup entry was on the field.

    Starter with no `substitutedOff` -> `length`; starter off at `m` -> `m`; substitute on
    at `m` with no off -> `length - m`; substitute on at `m1` and off at `m2` -> `m2 - m1`
    (4 such entries corpus-wide). An unused substitute has no minutes and therefore no row,
    so calling this on one is a defect in the caller, not a zero.
    """
    if not has_minutes(entry, section):
        raise ProfileError(
            f"minutes_played called on an entry with no minutes: "
            f"{entry.get('playerId')!r} in {section!r}"
        )
    where = f"{entry.get('playerId')!r}"
    on = _stamp_minute(entry.get("substitutedOn"), where)
    off = _stamp_minute(entry.get("substitutedOff"), where)
    # **A starter carrying a sub-on stamp was silently credited the full match.** `start`
    # is 0 for a starter, so the stamp was discarded rather than reconciled. The corpus
    # carries none, but the module's policy is assert-on-unknown: a contradictory pair of
    # stamps is a finding about the lineup page, not a value to average away.
    if section == "starters" and on is not None:
        raise ProfileError(
            f"{where}: a starter carries substitutedOn={on}; the stamps contradict the "
            f"section and the minute cannot be resolved"
        )
    start = 0 if section == "starters" else on
    end = length if off is None else off
    played = end - start
    # A negative or over-length value is a finding, NEVER a clamp (Task 3.4): a clamp would
    # turn a mis-stamped substitution into a plausible number and hide it forever.
    if not 0 <= played <= length:
        raise ProfileError(
            f"{where}: minutes_played is {played} (on={on!r}, off={off!r}, "
            f"length={length}), outside [0, {length}]"
        )
    return played


# ------------------------------------------------------------------------ the team builder
#
# **There is no `_side_of(bundle, team_id)` helper, deliberately.** One was written and then
# deleted: the mutation check exposed it as dead code, because `index_bundles` resolves the
# side BY CONSTRUCTION — it iterates `("home", "away")` and files each row under that side's
# own team — so nothing ever had to look a side up again. A lookup helper that no caller uses
# is worse than no helper: it reads as the place the rule lives, so a reviewer checking
# "is the side resolved correctly?" finds a correct-looking function and stops, while the
# real resolution sits somewhere else entirely. `tacticalIdentity` and `keyStatistics` are
# keyed `home`/`away` and never by `teamId` (Story 1.16 landmine 14), and the row tuples
# carry that side from the moment they are built.


def _result(bundle: "dict", side: str) -> str:
    """`win` / `draw` / `loss` from `metadata.score` (R4).

    No bundle field carries a per-team result, so this is DERIVED — stated explicitly
    because "verbatim from the bundle" does not derive. R4 rules the derivation onto
    `metadata.score` rather than onto `knockoutScore.winnerTeamId`, so the 8 team-rows of
    the 4 shootout matches (`m074`, `m075`, `m088`, `m096`) read `draw`. Deriving from the
    winner instead would make `record.drawn` disagree with the standings Story 1.17 emits
    from the same field, and `test_leaderboard_rows_agree_with_the_profiles_and_standings_
    they_duplicate` couples the two artifacts.
    """
    score = bundle["metadata"]["score"]
    mine, theirs = score[side], score["away" if side == "home" else "home"]
    return "win" if mine > theirs else ("loss" if mine < theirs else "draw")


def _mean(values: "list[float]", where: str) -> float:
    if not values:
        raise ProfileError(f"{where}: mean over an empty set is undefined")
    return sum(values) / len(values)


def _aggregate_tactical_identity(rows: "list[tuple[dict, str]]", team_id: str) -> "dict":
    """The six required blocks: 8 + 9 + 18 + 3 + 1 + 1 = 40 leaves, each a per-leaf mean.

    The epic names five surfaces in prose; the schema names six required blocks and the
    schema wins. "Line heights" maps to `shapeByPhase`, not to a `lineHeight` pair.

    `possession` and `pressingIntensity` come from `keyStatistics.{side}` — the bundle's own
    `tacticalIdentity` carries NEITHER. `pressingIntensity` is "Mean defensive pressures
    applied per match", a count-valued mean from `defensivePressures`, not a percentage; the
    four pressing SHARES are separate and live in `phasesOutOfPossession`.
    """
    where = f"tacticalIdentity[{team_id}]"

    def leaf_mean(path: "tuple[str, ...]") -> float:
        values = []
        for bundle, side in rows:
            node = bundle["tacticalIdentity"][side]
            for part in path:
                node = node[part]
            if not isinstance(node, (int, float)) or isinstance(node, bool):
                raise ProfileError(
                    f"{where}: tacticalIdentity.{side}.{'.'.join(path)} is {node!r} "
                    f"in {bundle['matchId']}, not a number"
                )
            values.append(node)
        return _mean(values, f"{where}.{'.'.join(path)}")

    def block(name: str, keys: "tuple[str, ...]", def_name: str) -> "dict":
        return check_total({k: leaf_mean((name, k)) for k in keys}, def_name,
                           f"{where}.{name}", TEAM_DOCS)

    # `shapeByPhase` is "not a partition and not aggregable across panels — each panel is
    # its own measurement". Never sum or mean ACROSS panels; each of the 18 leaves is its
    # own independent per-panel, per-measure mean.
    def panels(state: str, names: "tuple[str, ...]", def_name: str) -> "dict":
        built = {
            panel: check_total(
                {m: leaf_mean(("shapeByPhase", state, panel, m))
                 for m in ("lineHeight", "teamLength", "teamWidth")},
                "AggregateShapeMetrics", f"{where}.shapeByPhase.{state}.{panel}", TEAM_DOCS)
            for panel in names
        }
        return check_total(built, def_name, f"{where}.shapeByPhase.{state}", TEAM_DOCS)

    identity = {
        "phasesInPossession": block("phasesInPossession", (
            "buildUpUnopposed", "buildUpOpposed", "progression", "finalThird", "longBall",
            "attackingTransition", "counterAttack", "setPiece"),
            "AggregateInPossessionPhases"),
        "phasesOutOfPossession": block("phasesOutOfPossession", (
            "highPress", "midPress", "lowPress", "highBlock", "midBlock", "lowBlock",
            "recovery", "defensiveTransition", "counterPress"),
            "AggregateOutOfPossessionPhases"),
        "shapeByPhase": check_total({
            "inPossession": panels("inPossession",
                                   ("buildUpLow", "buildUpMid", "finalThirdPhase"),
                                   "AggregateInPossessionShapePanels"),
            "outOfPossession": panels("outOfPossession",
                                      ("highBlockPress", "midBlock", "lowBlock"),
                                      "AggregateOutOfPossessionShapePanels"),
        }, "AggregateShapeByPhase", f"{where}.shapeByPhase", TEAM_DOCS),
        "defensiveBlockDistribution": block("defensiveBlockDistribution",
                                            ("high", "mid", "low"),
                                            "AggregateBlockDistribution"),
        # UNWEIGHTED means over matches, and deliberately so — see the module docstring.
        "possession": _mean([b["keyStatistics"][s]["possession"] for b, s in rows],
                            f"{where}.possession"),
        "pressingIntensity": _mean(
            [b["keyStatistics"][s]["defensivePressures"] for b, s in rows],
            f"{where}.pressingIntensity"),
    }
    return check_total(identity, "AggregateTacticalIdentity", where, TEAM_DOCS)


def _formation_usage(rows: "list[tuple[dict, str]]", team_id: str) -> "list[dict]":
    """`{formation, matches, share}` per started formation, descending by match count.

    **The tie-break is live on 9 of 48 teams**, not a defensive branch: `australia`
    (5-4-1 x2 / 3-4-3 x2), `brazil`, `switzerland`, `qatar`, `curacao`, `algeria`,
    `argentina`, `ir-iran`, `sweden`. *Ruled:* descending `matches`, then ASCENDING
    `formation` string, so the order is total and deterministic across re-runs.

    **Shares do not sum to 100 and that is arithmetic, not a defect.** 3 teams (`qatar`,
    `curacao`, `ir-iran`) play 3 matches with 3 distinct formations, so `33.3 x 3 = 99.9`.
    *Ruled: do not allocate the residual and do not renormalize* — each `share` is the
    honest rounding of `matches / played`.
    """
    counts: "dict[str, int]" = {}
    for bundle, side in rows:
        formation = bundle["metadata"]["lineups"][side]["formation"]
        if not isinstance(formation, str) or not formation:
            raise ProfileError(
                f"{bundle['matchId']}: {team_id} has no formation on the {side} lineup"
            )
        counts[formation] = counts.get(formation, 0) + 1
    played = len(rows)
    return [
        check_total({"formation": f, "matches": n, "share": n / played * 100},
                    "FormationUsageRow", f"formationUsage[{team_id}/{f}]", TEAM_DOCS)
        for f, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def _team_match_row(bundle: "dict", side: str) -> "dict":
    """One `TeamMatchBreakdown`: 15 required fields."""
    metadata = bundle["metadata"]
    other = "away" if side == "home" else "home"
    opponent = metadata[f"{other}Team"]
    stats = bundle["keyStatistics"][side]
    row = {
        "matchId": bundle["matchId"],
        "stage": metadata["stage"],
        "date": metadata["date"],
        "opponent": entity_ref(opponent["teamId"], opponent["name"]),
        "isHome": side == "home",
        "result": _result(bundle, side),
        # `metadata.score` is the ruled source. `keyStatistics.{side}.goals` is IDENTICAL on
        # all 208 team-innings (measured, Task 4.5) — one is picked, stated, and the
        # agreement is pinned in a test so a future divergence is a finding rather than a
        # silent choice.
        "goalsFor": metadata["score"][side],
        "goalsAgainst": metadata["score"][other],
        "formation": metadata["lineups"][side]["formation"],
        "possession": stats["possession"],
        "expectedGoals": stats["expectedGoals"],
        "shots": stats["shots"],
        "shotsOnTarget": stats["shotsOnTarget"],
        "passCompletion": stats["passCompletion"],
        "distanceCovered": stats["distanceCovered"],
    }
    return check_total(row, "TeamMatchBreakdown",
                       f"TeamMatchBreakdown[{bundle['matchId']}/{side}]", TEAM_DOCS)


def build_team_profile(team_id: str, rows: "list[tuple[dict, str]]",
                       entities: "dict") -> "dict":
    """One complete team profile. `rows` are this team's matches in chronological order.

    Chronological is ascending `matchId`, which is chronological by construction: the match
    number is zero-padded to three digits precisely so lexicographic order equals numeric
    order (`common#MatchId`).
    """
    if not rows:
        raise ProfileError(f"team {team_id!r} has no match rows; every team plays")
    codes = entities["teamCodes"]
    if team_id not in codes:
        raise ProfileError(f"no committed teamCode for team id {team_id!r}")

    # **Asserted, not taken from `rows[0]`, for symmetry with `_identity`.** A player who
    # carries two names raises; a team that carried two silently took whichever bundle came
    # first, and every OTHER team's `matches[].opponent` reads its name per-bundle — so a
    # divergent spelling would ship a profile whose own `name` disagrees with how 47 other
    # profiles refer to it. The corpus carries no such team; that is the reason to pin it.
    names = {b["metadata"][f"{s}Team"]["name"] for b, s in rows}
    if len(names) != 1:
        raise ProfileError(f"team {team_id!r} carries {sorted(names)!r} names across its rows")
    name = names.pop()

    # `group` is required and is null on knockout matches. Every team plays the group stage,
    # so it always resolves; asserting that rather than defaulting means an unresolvable
    # group surfaces here instead of as a `common#Group` enum violation pointing at the
    # wrong place.
    groups = {b["metadata"]["group"] for b, _s in rows
              if b["metadata"]["stage"] == "group"}
    groups.discard(None)
    if len(groups) != 1:
        raise ProfileError(
            f"team {team_id!r} resolves to {sorted(groups)!r} group letter(s) across its "
            f"group-stage rows; exactly one is required"
        )

    match_rows = [_team_match_row(bundle, side) for bundle, side in rows]
    results = [r["result"] for r in match_rows]
    goals_for = sum(r["goalsFor"] for r in match_rows)
    goals_against = sum(r["goalsAgainst"] for r in match_rows)

    # **`points` counts GROUP-STAGE points only; knockout ties award none** — the schema's
    # own words. Computing it over all rows is wrong on 19 of 48 teams (Mexico 12 vs 9), and
    # the shipped `test_the_team_profile_record_matches_its_own_per_match_rows` asserted the
    # wrong form: its fixture has three group rows only, so both readings agree there and
    # the conflict is invisible until real data.
    points = sum(3 if r["result"] == "win" else 1 if r["result"] == "draw" else 0
                 for r in match_rows if r["stage"] == "group")
    stages = [r["stage"] for r in match_rows]
    unknown = sorted(set(stages) - set(STAGE_ORDER))
    if unknown:
        raise ProfileError(f"team {team_id!r} carries unknown stage(s) {unknown!r}")

    record = check_total({
        "played": len(match_rows),
        "won": results.count("win"),
        "drawn": results.count("draw"),
        "lost": results.count("loss"),
        "goalsFor": goals_for,
        "goalsAgainst": goals_against,
        "goalDifference": goals_for - goals_against,
        "points": points,
        "furthestStage": max(stages, key=STAGE_ORDER.index),
    }, "TournamentRecord", f"TournamentRecord[{team_id}]", TEAM_DOCS)

    profile = {
        "schemaVersion": schema_version(),
        "teamId": team_id,
        "name": name,
        "teamCode": codes[team_id],
        "group": groups.pop(),
        "record": record,
        "tacticalIdentity": _aggregate_tactical_identity(rows, team_id),
        "formationUsage": _formation_usage(rows, team_id),
        "matches": match_rows,
    }
    return check_total(profile, "TeamProfile", f"TeamProfile[{team_id}]", TEAM_DOCS)


# ---------------------------------------------------------------------- the player builder
def _pass_completion(records: "list[dict]") -> float:
    """The tournament pass completion: `sum(completed) / sum(attempted) x 100`.

    **WEIGHTED, and this is the one metric that will be got wrong.** A player's per-match
    `passCompletion` IS `passesCompleted / passesAttempted`, so the tournament figure
    reproducible from the bundles is the ratio of the SUMS, not the mean of the per-match
    percentages — those weight a 12-pass cameo equally with a 90-pass shift. Measured on
    `quinones-julian-mex`: the unweighted mean of 90.3 / 82.9 / 73.9 is 82.4, which is what
    the committed fixture shipped; the weighted value is `119/143 x 100` = 83.2.

    **The denominator is zero on 17 real players.** They have minutes and attempt 0 passes
    across every appearance, and 53 individual Domain G rows carry `passesAttempted: 0` (52
    of them on with-minutes rows; the 53rd is Henderson's m092 row, which produces no match
    row at all). `AggregateMetricValue` is `type: number` and NOT nullable, so `null` is not
    available. *Ruled: `sum(attempted) == 0` => value `0.0`, `aggregation: "average"`,
    `perNinety: null`.*
    """
    attempted = sum(r["inPossession"]["passesAttempted"] for r in records)
    if attempted == 0:
        return 0.0
    return sum(r["inPossession"]["passesCompleted"] for r in records) / attempted * 100


def _aggregates(records: "list[dict]", minutes: int, player_id: str) -> "list[dict]":
    """All 18 legal player-scope metrics, in enum order, TOTAL on every file (R2).

    Reduced over the DOMAIN G RECORDS, not over `matches[]`: a `PlayerMatchRow` carries ten
    stat columns and ten only, while eleven of the eighteen metrics
    (`crossesCompleted`, `switchesOfPlay`, `takeOns`, `stepIns`, `lineBreaksCompleted`,
    `tacklesWon`, `interceptions`, `duelsWon*`, `possessionRegains`, `highSpeedRuns`,
    `sprints`) live only on the Domain G blocks. The two lists are index-aligned by
    construction in `build_player_profile`.
    """
    built = []
    for code, block, field, aggregation, per_ninety, _places in _PLAYER_METRICS:
        if code == "passCompletion":
            value: float = _pass_completion(records)
        elif aggregation == "max":
            # Max over an empty set is undefined; a zero-appearance player is ruled to 0.0
            # rather than raising (Task 5.6). Spelled `0.0` rather than `0` so the code says
            # what the comment says — `_rounded` would coerce it either way, but a literal
            # that contradicts the sentence above it is how the int/float split shipped.
            value = max((r[block][field] for r in records), default=0.0)
        else:
            value = sum(r[block][field] for r in records)
        # Two independent reasons for a null per-90, and both are live. The schema's own:
        # "Null when the metric is a maximum or a percentage, where a per-90 rate is
        # meaningless." And division by zero: `minutesPlayed == 0` on all 209
        # zero-appearance players. Nothing in the schema says so — the ledger files it as an
        # unconstrained pairing — so it is ruled here and tested.
        rate = None
        if per_ninety and minutes > 0:
            rate = value / minutes * 90
        built.append(check_total(
            {"metricCode": code, "value": value, "aggregation": aggregation,
             "perNinety": rate},
            "AggregateMetric", f"AggregateMetric[{player_id}/{code}]", PLAYER_DOCS))
    return built


def _trends(match_rows: "list[dict]", records: "list[dict]",
            player_id: str) -> "list[dict]":
    """Six charted series, one point per match played (R2).

    **A trend point is that match's own value, verbatim — never re-weighted, never
    cumulative.** The weighting rule for `passCompletion` applies to the tournament
    aggregate only; a trend is a series of match values, so a point is
    `players[i].inPossession.passCompletion` as the bundle carries it. Measured: the bundle
    already carries `0.0` on all 53 zero-denominator Domain G rows, so the zero-denominator
    ruling needs no special case here — the per-match value is honest as printed.

    **Trend points follow the SOURCE FIELD's precision, not the slot's.** `TrendPointValue`
    declares `x-decimals: 2` for the same polymorphic reason `AggregateMetricValue` does;
    none of the six is a 2-place metric. `_round_profile` resolves that by `metricCode`.
    """
    source = {code: (block, field)
              for code, block, field, _a, _p, _n in _PLAYER_METRICS}
    return [
        check_total({
            "metricCode": code,
            "points": [
                check_total(
                    {"matchId": row["matchId"],
                     "value": record[source[code][0]][source[code][1]]},
                    "TrendPoint", f"TrendPoint[{player_id}/{code}/{row['matchId']}]",
                    PLAYER_DOCS)
                for row, record in zip(match_rows, records)
            ],
        }, "TrendSeries", f"TrendSeries[{player_id}/{code}]", PLAYER_DOCS)
        for code in _TREND_CODES
    ]


def _player_match_row(bundle: "dict", side: str, section: str, entry: "dict",
                      domain_g: "dict") -> "dict":
    """One `PlayerMatchRow`: 16 required fields, ten of them verbatim from Domain G."""
    metadata = bundle["metadata"]
    other = "away" if side == "home" else "home"
    opponent = metadata[f"{other}Team"]
    row = {
        "matchId": bundle["matchId"],
        "stage": metadata["stage"],
        "date": metadata["date"],
        "opponent": entity_ref(opponent["teamId"], opponent["name"]),
        "started": section == "starters",
        "minutesPlayed": minutes_played(entry, section, match_length(bundle)),
    }
    for field, block in _MATCH_ROW_STATS:
        row[field] = domain_g[block][field]
    return check_total(row, "PlayerMatchRow",
                       f"PlayerMatchRow[{bundle['matchId']}/{entry['playerId']}]",
                       PLAYER_DOCS)


def _identity(player_id: str, appearances: "list[tuple[dict, str, str, dict]]") -> "dict":
    """`name`, `position`, `shirtNumber`, `team` — from LINEUPS, never from Domain G.

    **Sourcing this block from Domain G works for 1,039 players and raises a `KeyError` for
    the other 209** (Story 1.16 landmine 7). All 1,248 pinned players appear in some lineup;
    only 1,039 ever have minutes.

    Measured so it does not have to be rediscovered: `name` is identical between the lineup
    entry and the Domain G `playerName` on all 3,289 rows, and 0 players carry two shirt
    numbers — so both are unambiguous whichever source is used.

    **`position` is NOT unambiguous, and exactly one player proves it.**
    `senesi-marcos-arg` is listed `mf` in `m019-argentina-algeria` — where he was an UNUSED
    SUBSTITUTE, so he has no Domain G row there — and `df` in seven other matches, while
    `player-profile.schema.json` requires a single scalar. *Ruled: the most frequent value
    across the player's lineup entries, ties broken by first chronological occurrence.* That
    yields `df` for Senesi. *Recorded alternatives: "first lineup entry" (yields `mf`, a
    wrong label sourced from a match he did not play) and "the Domain G row" (correct for
    the 1,039, unavailable for the 209, so it cannot be the general rule).* A multi-position
    player is corpus-real, not a defect, so the assert-on-unknown policy does not fire here.
    """
    # `key=repr` on every conflict set: a `None` among the values makes a bare `sorted()`
    # raise `TypeError` from inside the error path, turning a typed finding into a traceback
    # at the exact moment the module is trying to report one.
    names = {e["name"] for _b, _s, _sec, e in appearances}
    if len(names) != 1:
        raise ProfileError(f"player {player_id!r} carries {sorted(names, key=repr)!r} names")
    shirts = {e["shirtNumber"] for _b, _s, _sec, e in appearances}
    if len(shirts) != 1:
        raise ProfileError(
            f"player {player_id!r} carries {sorted(shirts, key=repr)!r} shirt numbers"
        )
    teams = {(b["metadata"][f"{s}Team"]["teamId"], b["metadata"][f"{s}Team"]["name"])
             for b, s, _sec, _e in appearances}
    if len(teams) != 1:
        raise ProfileError(f"player {player_id!r} appears for {sorted(teams)!r}")

    counts: "dict[str, int]" = {}
    first_seen: "dict[str, int]" = {}
    for index, (_b, _s, _sec, entry) in enumerate(appearances):
        position = entry["position"]
        counts[position] = counts.get(position, 0) + 1
        first_seen.setdefault(position, index)
    position = min(counts, key=lambda p: (-counts[p], first_seen[p]))

    team_id, team_name = teams.pop()
    return {
        "name": names.pop(),
        "position": position,
        "shirtNumber": shirts.pop(),
        "team": entity_ref(team_id, team_name),
    }


def build_player_profile(player_id: str,
                         rows: "list[tuple[dict, str, str, dict]]",
                         entities: "dict") -> "dict":
    """One complete player profile.

    `rows` are EVERY lineup appearance this player has, chronological — including the ones
    with no minutes, because the identity block is sourced from all of them (see
    `_identity`). `matches[]` is filtered to the with-minutes subset.

    **Match rows are built by iterating lineups-with-minutes and joining Domain G by
    `playerId`, never the reverse.** Measured: 3,288 with-minutes (match, player) pairs,
    3,289 Domain G rows, 0 with-minutes pairs lacking a Domain G row, and exactly one Domain
    G row lacking minutes — `m092-mexico-england` / `henderson-jordan-eng`, all zero in every
    field. Iterating `players[]` instead manufactures a phantom appearance for him and
    breaks `played == started + substituteAppearances` (landmine 5). The join is asserted
    total in this direction: a with-minutes entry with no Domain G row is a `ProfileError`.
    """
    if not rows:
        raise ProfileError(f"player {player_id!r} has no lineup appearances")
    del entities  # identity comes from the bundles themselves; kept for API symmetry

    match_rows: "list[dict]" = []
    records: "list[dict]" = []
    for bundle, side, section, entry in rows:
        if not has_minutes(entry, section):
            continue
        players = bundle["players"]
        if players is None:
            # A `players: null` bundle is legal and contributes zero rows (see
            # `check_bundle_shape`). The entry still counted toward identity above.
            continue
        matched = [r for r in players if r["playerId"] == player_id]
        if len(matched) != 1:
            raise ProfileError(
                f"{bundle['matchId']}: {player_id!r} has minutes but {len(matched)} Domain G "
                f"row(s); the lineups-with-minutes -> Domain G join must be total"
            )
        match_rows.append(_player_match_row(bundle, side, section, entry, matched[0]))
        records.append(matched[0])

    started = sum(1 for r in match_rows if r["started"])
    minutes = sum(r["minutesPlayed"] for r in match_rows)
    appearances = check_total({
        "played": len(match_rows),
        "started": started,
        "substituteAppearances": len(match_rows) - started,
        "minutesPlayed": minutes,
    }, "Appearances", f"Appearances[{player_id}]", PLAYER_DOCS)

    # `physical`: eight fields summed, `topSpeed` a max — `PhysicalProfile`'s own words.
    # `highSpeedRuns` and `sprints` stay `int`: Story 1.10 parses them as float, asserts
    # integral and narrows on all 3,289 rows. Do not re-litigate and do not round.
    physical = _physical_profile(records, player_id)

    profile = {
        "schemaVersion": schema_version(),
        "playerId": player_id,
        **_identity(player_id, rows),
        "appearances": appearances,
        "aggregates": _aggregates(records, minutes, player_id),
        "physical": physical,
        "matches": match_rows,
        "trends": _trends(match_rows, records, player_id),
    }
    return check_total(profile, "PlayerProfile", f"PlayerProfile[{player_id}]", PLAYER_DOCS)


def _physical_profile(records: "list[dict]", player_id: str) -> "dict":
    """`PhysicalProfile`: eight sums and one maximum, over the matches with minutes.

    Reduced over the Domain G records of exactly the matches that produced a match row —
    never over every Domain G row the player has, which would re-admit Henderson's all-zero
    m092 row as a tenth appearance and desynchronize `physical` from `matches[]`.

    The five distance zones are NOT on a `PlayerMatchRow`, which is why this reads the
    Domain G block rather than the emitted rows.

    `topSpeed` over an empty set is undefined, so a zero-appearance player is ruled to
    `0.0` rather than raising (Task 5.6).
    """
    blocks = [r["physical"] for r in records]
    physical = {field: sum(b[field] for b in blocks) for field in _PHYSICAL_SUMMED}
    physical["topSpeed"] = max((b["topSpeed"] for b in blocks), default=0.0)
    return check_total(physical, "PhysicalProfile", f"PhysicalProfile[{player_id}]",
                       PLAYER_DOCS)


# ------------------------------------------------------------------------------- the emitter
def load_bundles(data_dir: "str | Path") -> "list[dict]":
    """Every committed Match Bundle, shape-asserted at load, in chronological order.

    `json.JSONDecodeError` is a `ValueError`, so an unhandled one escapes `main`'s
    `PipelineError` handler and reports "the harness could not run" as "a dataset finding" —
    the exact inversion the exit-code contract exists to prevent. Raised as `OSError` so it
    lands on exit 2, mirroring `emit._read_json`.
    """
    root = Path(data_dir) / "matches"
    paths = sorted(root.glob("*.json")) if root.is_dir() else []
    if not paths:
        raise ProfileError(
            f"no Match Bundle found under {root.as_posix()}; profile emission runs AFTER "
            f"emit_bundles and reads its output. An empty input is never a pass."
        )
    bundles = []
    for path in paths:
        try:
            bundle = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            # `UnicodeDecodeError` is also a `ValueError` and `read_text` raises it on a
            # byte-corrupt bundle. Only the JSON half was wrapped, so the decode half escaped
            # both of `main`'s handlers as a traceback — the identical defect this docstring
            # says Story 1.16 took a review finding for.
            raise OSError(f"{path.as_posix()} is not readable: {exc}") from None
        bundles.append(check_bundle_shape(bundle, path.name))
    return bundles


def index_bundles(bundles: "list[dict]") -> "tuple[dict, dict]":
    """`(team_id -> [(bundle, side)], player_id -> [(bundle, side, section, entry)])`.

    Both are chronological: `bundles` arrive sorted by `matchId`, which is chronological by
    construction, and each match contributes its rows in that order.
    """
    teams: "dict[str, list]" = {}
    players: "dict[str, list]" = {}
    for bundle in bundles:
        metadata = bundle["metadata"]
        # **The LINEUP side of the join is asserted here; the Domain G side is asserted in
        # `build_player_profile`.** Only the second one existed, and the module argues at
        # length about the join DIRECTION (Henderson) while a player listed in both
        # `starters` and `substitutes` of one match produced two match rows, two trend
        # points for a single `matchId`, doubled aggregates and `minutesPlayed: 120` in a
        # 90-minute match — all schema-valid, none of it caught. `minutes_played`'s bounds
        # check is per-entry, so it structurally cannot see a per-match total.
        seen: "set[tuple[str, str]]" = set()
        for side in SIDES:
            teams.setdefault(metadata[f"{side}Team"]["teamId"], []).append((bundle, side))
            lineup = metadata["lineups"][side]
            for section in SECTIONS:
                for entry in lineup[section]:
                    key = (bundle["matchId"], entry["playerId"])
                    if key in seen:
                        raise ProfileError(
                            f"{bundle['matchId']}: {entry['playerId']!r} is listed more than "
                            f"once in this match's lineups; one (match, player) pair must "
                            f"produce exactly one appearance"
                        )
                    seen.add(key)
                    players.setdefault(entry["playerId"], []).append(
                        (bundle, side, section, entry))
    return teams, players


def _swap_directory(staged: Path, target: Path) -> "Path | None":
    """Replace `target` with `staged`, RETAINING the retired copy for the caller.

    **Ruled over per-file `.tmp` renames** (Task 7.4): a second rename pass leaves the
    namespace half-swapped for its whole duration and reproduces the hazard in a smaller
    window. The named hazard is `identity.check_committed_data` pinning a PARTIAL namespace
    as the immutability baseline, and 1,296 artifacts across two directories is a far wider
    window than Story 1.16's 104.

    `os.replace` cannot move a directory onto a non-empty directory on either platform, so
    the swap is retire-then-install with a rollback, not a single call.

    **Returns the retained backup rather than deleting it**, because atomicity has to span
    BOTH namespaces: `emit_profiles` can only undo a completed team swap after a failed
    player swap if the retired team directory still exists. The caller owns the cleanup once
    every swap has landed.
    """
    backup = target.with_name(f"{target.name}.previous.rollback")
    if backup.exists():
        shutil.rmtree(backup)
    target.parent.mkdir(parents=True, exist_ok=True)
    retired = False
    if target.exists():
        target.rename(backup)
        retired = True
    try:
        staged.rename(target)
    except BaseException:
        if retired:
            backup.rename(target)
        raise
    return backup if retired else None


def emit_profiles(data_dir: "str | Path" = DEFAULT_DATA_DIR,
                  dry_run: bool = False,
                  expect_teams: "int | None" = None,
                  expect_players: "int | None" = None) -> "list[Path]":
    """Build, validate, round, measure and write every profile artifact. All 1,296 or none.

    Order is build -> validate -> measure -> write, with rounding folded into the END of
    each build rather than run as a separate pass over built artifacts. That is a stated
    departure from the task's four-phase wording and it is forced: `Count`, `ShirtNumber`
    and `TeamProfileGoalDifference` are `type: integer`, so an unrounded mean of `3.0`
    fails validation before any rounding pass could reach it. `emit.build_bundle` folds it
    the same way, for the same reason. Nothing is written until every artifact has been
    built, validated, rounded AND measured.
    """
    bundles = load_bundles(data_dir)
    teams, players = index_bundles(bundles)

    team_decimals = decimals_map(TEAM_SCHEMA)
    player_decimals = decimals_map(PLAYER_SCHEMA)
    combined = {**team_decimals, **player_decimals}
    by_key = precision_by_key(combined)
    metric_places = _metric_places(combined)
    ninety_places = per_ninety_places(player_decimals)

    entities = {"teamCodes": dict(TEAM_CODES)}
    pinned_teams = set(PINS["teams"].values())
    pinned_players = set(PINS["players"].values())

    built: "list[tuple[str, str, str]]" = []  # (kind, id, canonical text)
    failures: "list[str]" = []
    violations: "list[str]" = []
    breaches: "list[tuple[str, int, int]]" = []

    def build(kind: str, schema: str, identifier: str, builder) -> None:
        try:
            artifact = builder()
            artifact = _round_profile(artifact, by_key, metric_places, ninety_places,
                                      f"{kind}/{identifier}")
        except PipelineError as exc:
            failures.append(f"{kind}/{identifier}: {exc}")
            return
        try:
            validate_artifact(artifact, schema, instance_label=f"{kind}/{identifier}")
        except SchemaValidationError as exc:
            violations.append(f"{kind}/{identifier}: {exc}")
            return
        text = canonical_json(artifact)
        breach = over_budget(f"{kind}/{identifier}", text)
        if breach is not None:
            breaches.append(breach)
        built.append((kind, identifier, text))

    for team_id in sorted(teams):
        build("team-profiles", TEAM_SCHEMA, team_id,
              lambda t=team_id: build_team_profile(t, teams[t], entities))
    for player_id in sorted(players):
        build("player-profiles", PLAYER_SCHEMA, player_id,
              lambda p=player_id: build_player_profile(p, players[p], entities))

    if failures:
        shown = "; ".join(sorted(failures)[:10])
        raise ProfileError(
            f"{len(failures)} profile(s) could not be built: {shown}"
            f"{' …' if len(failures) > 10 else ''}"
        )
    if violations:
        shown = "; ".join(sorted(violations)[:10])
        raise ProfileValidationError(
            f"{len(violations)} profile(s) failed the /contract schema: {shown}"
            f"{' …' if len(violations) > 10 else ''}"
        )
    if breaches:
        shown = "; ".join(
            f"{label} {gz} gzip-9 bytes over canonical {raw} (budget {BUDGET_BYTES})"
            for label, gz, raw in sorted(breaches)[:10]
        )
        raise BudgetExceededError(
            f"{len(breaches)} profile(s) breached the {BUDGET_BYTES}-byte payload budget: "
            f"{shown}{' …' if len(breaches) > 10 else ''}. SM-C2: resolve by splitting or "
            f"by a logged budget decision, NEVER by dropping fields, truncating an array "
            f"or lowering a precision to fit."
        )

    # Count is NOT distinctness (Story 1.16's review: "Two spine files carrying the same
    # match_id inflate the reported count and pass --expect-matches").
    #
    # **This is a STRUCTURAL invariant, not a gate that can fail, and saying so is the
    # point.** `built` is appended once per key of `teams` / `players`, both dicts, so the
    # ids are distinct by construction and no input can drive this red — it ships no
    # constructed failure because none can be written. It is kept as an assertion against a
    # future refactor that changes how `built` is populated (Story 1.16's defect arrived
    # exactly that way, through the loop rather than the data), and the real distinctness
    # exposure — one (match, player) pair appearing twice — is asserted where it can actually
    # occur, in `index_bundles`.
    for kind in ("team-profiles", "player-profiles"):
        ids = [i for k, i, _t in built if k == kind]
        if len(ids) != len(set(ids)):
            duplicated = sorted({i for i in ids if ids.count(i) > 1})
            raise ProfileError(f"{kind}: {len(duplicated)} duplicated id(s) {duplicated[:10]!r}")

    if not built:
        raise ProfileError("no profile was built; an empty run is never a pass")

    # What this story CAN assert unilaterally (R3): the artifact set is exactly the
    # registry's pinned namespace. The AD-4 route-manifest bijection is Story 1.17's and is
    # PRINTED as not-asserted-here by `main`, never treated as passed by absence.
    emitted_teams = {i for k, i, _t in built if k == "team-profiles"}
    emitted_players = {i for k, i, _t in built if k == "player-profiles"}
    for kind, emitted, pinned in (("team", emitted_teams, pinned_teams),
                                  ("player", emitted_players, pinned_players)):
        orphans = sorted(emitted - pinned)
        absent = sorted(pinned - emitted)
        if orphans or absent:
            raise ProfileError(
                f"{kind} profiles are not a bijection with the registry's pinned namespace: "
                f"{len(orphans)} unpinned {orphans[:5]!r}, {len(absent)} unemitted "
                f"{absent[:5]!r}"
            )

    if expect_teams is not None and len(emitted_teams) != expect_teams:
        raise ProfileError(f"built {len(emitted_teams)} team profile(s), expected {expect_teams}")
    if expect_players is not None and len(emitted_players) != expect_players:
        raise ProfileError(
            f"built {len(emitted_players)} player profile(s), expected {expect_players}"
        )

    index_dir = Path(data_dir) / "index"
    targets = [index_dir / kind / f"{identifier}.json" for kind, identifier, _t in built]
    # A dry run writes NOTHING — a promise about the filesystem, not about the return
    # value — so it returns the targets it validated and measured rather than an empty list
    # that would make every downstream count check read as a miss.
    if dry_run:
        return targets

    # **STAGE BOTH NAMESPACES, THEN SWAP BOTH.** The loop used to stage-and-swap each kind
    # in turn, which made the write all-or-nothing PER NAMESPACE and not across the two: an
    # `OSError` while writing the 1,248 player files landed after `team-profiles` was already
    # swapped in, leaving the two directories describing different corpora — reproduced, and
    # exactly the state `identity.check_committed_data` would then pin as the immutability
    # baseline. The module docstring's "All 1,296 or none" is only true with both stagings
    # complete before either swap.
    kinds = ("team-profiles", "player-profiles")
    staged_dirs = {kind: index_dir / f"{kind}.staged" for kind in kinds}
    swapped: "list[str]" = []
    backups: "dict[str, Path]" = {}
    try:
        for kind in kinds:
            staged = staged_dirs[kind]
            if staged.exists():
                shutil.rmtree(staged)
            staged.mkdir(parents=True, exist_ok=True)
            for k, identifier, text in built:
                if k != kind:
                    continue
                # `write_canonical(json.loads(text), ...)` rather than writing `text`: the
                # measured bytes and the written bytes are then provably the same
                # serialization, since both go through `canonical_json`. Story 1.17's Task
                # 8.5 idiom.
                write_canonical(json.loads(text), staged / f"{identifier}.json")
        for kind in kinds:
            retired = _swap_directory(staged_dirs[kind], index_dir / kind)
            swapped.append(kind)
            if retired is not None:
                backups[kind] = retired
    except BaseException:
        # Roll the completed swaps back, so a failure in the second one cannot leave the
        # first namespace installed against a corpus the other half never saw.
        for kind in reversed(swapped):
            backup = backups.get(kind)
            if backup is not None and backup.exists():
                shutil.rmtree(index_dir / kind, ignore_errors=True)
                backup.rename(index_dir / kind)
        raise
    finally:
        # **Never leave a partial `.staged` or retired namespace inside the committed tree.**
        # `.staged` used to be cleared only at the START of the next run, so an aborted run
        # left hundreds of orphan artifacts in `data/index/` — untracked, and
        # `data/index/*.staged` is not gitignored, so a sweeping `git add` would commit them.
        # `ignore_errors` throughout: the swap is already committed by the time these run, so
        # a failure to remove a scratch directory must not turn a successful emission into a
        # failed one.
        for staged in staged_dirs.values():
            shutil.rmtree(staged, ignore_errors=True)
        for backup in backups.values():
            shutil.rmtree(backup, ignore_errors=True)

    written: "list[Path]" = []
    for kind in kinds:
        written.extend(index_dir / kind / f"{i}.json" for k, i, _t in built if k == kind)

    # The swap installs exactly this run's namespace, so a stale artifact cannot survive it
    # — the sweep `emit_bundles` performs per file is structural here. Assert it rather than
    # assume it: an id that ever changed would leave an orphan that
    # `identity.check_committed_data` then PINS as the immutability baseline.
    for kind in ("team-profiles", "player-profiles"):
        on_disk = {p.name for p in (index_dir / kind).glob("*.json")}
        expected = {f"{i}.json" for k, i, _t in built if k == kind}
        if on_disk != expected:
            raise ProfileError(
                f"{kind}: after the swap the directory holds {sorted(on_disk - expected)[:5]!r} "
                f"extra and {sorted(expected - on_disk)[:5]!r} missing"
            )
    return written


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.precompute.profiles",
        description="Emit one team profile per team and one player profile per player.",
    )
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR),
                        help="reads data/matches, writes data/index (default data)")
    parser.add_argument("--expect-teams", type=int, default=None, metavar="N",
                        help="assert exactly N team profiles are emitted (use 48)")
    parser.add_argument("--expect-players", type=int, default=None, metavar="N",
                        help="assert exactly N player profiles are emitted (use 1248)")
    parser.add_argument("--dry-run", action="store_true",
                        help="build, validate and measure, write nothing")
    return parser


def main(argv: "list[str] | None" = None) -> int:
    args = build_parser().parse_args(argv)

    # Without this a PDF-derived name crashes a redirected Windows console and destroys the
    # exit code's meaning. Same reasoning as run.py and emit.py.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")

    print("")
    print("Team & player profile emission")
    print("=" * 30)
    print(f"data dir        : {Path(args.data_dir).as_posix()}")
    print(f"schemaVersion   : {schema_version()}")

    try:
        written = emit_profiles(args.data_dir, dry_run=args.dry_run,
                                expect_teams=args.expect_teams,
                                expect_players=args.expect_players)
    except PipelineError as exc:
        print("")
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    except (OSError, AssertionError) as exc:
        # `AssertionError` is `decimals_map`'s vacuity guard: the schema resolved to no float
        # precision at all, which is a broken checkout rather than a finding about the data.
        # `OSError` covers an unreadable bundle, including the wrapped `JSONDecodeError` and
        # `UnicodeDecodeError`.
        print("")
        print(f"profile emission could not run: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001 — the exit-code contract is the whole point
        # **The backstop that makes the 0/1/2 contract total.** `check_bundle_shape` is
        # deepened to catch the malformed-bundle paths that used to reach a bare `KeyError`,
        # but "every untyped escape is now guarded" is a claim no guard list can keep true as
        # the module grows. An untyped exception is BY DEFINITION "the harness could not run"
        # rather than "a dataset finding", so it belongs on exit 2 — and a traceback with no
        # `FAIL:` line, exiting 1, is the precise inversion landmine 13 names. `repr` because
        # a bare `KeyError` stringifies to just the key, which reads as nothing at all.
        print("")
        print(f"profile emission could not run: {exc!r}", file=sys.stderr)
        return 2

    teams = sum(1 for p in written if p.parent.name == "team-profiles")
    players = sum(1 for p in written if p.parent.name == "player-profiles")
    suffix = " (dry run, nothing written)" if args.dry_run else ""
    print(f"team profiles   : {teams}{suffix}")
    print(f"player profiles : {players}{suffix}")

    # The `/data` immutability baseline, now that it reaches these namespaces (Task 7.8).
    # A SECOND source, independent of the in-memory registry bijection inside
    # `emit_profiles`: that one checks the ids this run minted, this one re-opens what is
    # actually on disk. Skipped on a dry run because nothing new was written to re-read.
    if not args.dry_run:
        try:
            for note in check_committed_data(
                    PINS, args.data_dir,
                    globs=("index/team-profiles/*.json", "index/player-profiles/*.json"),
                    id_keys=PROFILE_ID_KEYS,
                    unavailable=PROFILE_BASELINE_UNAVAILABLE,
                    noun="profile"):
                # The note already opens "committed /data baseline: …", so a "profile
                # baseline: " prefix rendered it twice. Only the noun was parameterized.
                print(note)
        except PipelineError as exc:
            print("")
            print(f"FAIL: {exc}", file=sys.stderr)
            return 1
    print("")
    # R3: never let the absence of a manifest read as a bijection that passed. The
    # `check_committed_data` precedent is binding — "print that the second source is
    # unavailable; never treat 'no baseline' as 'passed'."
    print("route-manifest bijection not asserted here; owned by Story 1.17.")
    print("Asserted here: one artifact per registry-pinned entity (48 teams, 1,248 players).")

    print("")
    print("PROFILE EMIT RESULT: PASS")
    print("")
    return 0


if __name__ == "__main__":
    sys.exit(main())

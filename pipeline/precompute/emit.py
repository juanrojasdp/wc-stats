"""Match Bundle emission: the staged spine -> `data/matches/{match-id}.json` (Story 1.16).

AD-9's second phase, and the FIRST module in the pipeline whose output another system
consumes. Everything upstream fails loud into a manifest a human reads; this fails loud
into a contract a build asserts.

This module reads no PDF and resolves no identity. It is a pure function from the staged
spine to `/data`, and `work/spine/` is its only input.

**Emit all 104 or emit none, and that resolves a real tension between two ADs.** AD-8 says
per-report failures never abort the batch; AD-4 says a budget breach fails the pipeline
run. AD-8's rule is about the per-report extract phase, where one bad PDF must not cost the
other 103. Emission has no per-report recovery: a half-emitted `data/matches/` is worse
than an empty one, because `check_committed_data` would then pin a partial namespace as the
immutability baseline. So the corpus-level abort here is not an AD-8 violation.

**This phase writes no run-manifest entry.** `ARCHITECTURE-SPINE.md:138` requires every
typed pipeline error to land as a manifest entry, but that contract is per-report (AD-8)
and this phase is all-or-nothing: there is no per-match terminal status to record. Stated
so a reviewer does not read the absence as a miss.

**This story registers no FR-15 gate check.** `pipeline/validate/checks.py:90-91` reserves
a "1.16 bundle emission" slot; it stays reserved. The gate is per-report and emission is
corpus-level.

WHAT CHANGE-SET CS-2 UNBLOCKED ----------------------------------------------------------
Two domain mappers could not be written against the pre-CS-2 contract and were deliberately
NOT stubbed with a guessed shape. CS-2 (logged decision 18, `schemaVersion` 3 -> 4) reshaped
both, and `build_bundle` emits them:

  * `tacticalIdentity` (D1) — `PossessionSplitMetres` required ONE `inPossession` and ONE
    `outOfPossession` metre per team, non-nullable, while the corpus prints three panels of
    three measures per possession state (3,744 values against the contract's 832) plus a
    `team_width` that had no destination in `/contract` at all. There was no null escape on
    that path, so it blocked EVERY bundle. It is now `ShapeByPhase`: six per-phase panels of
    `{lineHeight, teamLength, teamWidth}`.
  * `goalkeeping` (D2) — five contract-required sub-fields are null on 208/208 team-innings
    and the record was per-keeper while the source is per-team. `GoalkeepingBlock` is now
    per-team with the keeper list as context, those five are nullable, and the involvement
    sample carries a `MinuteStamp`.

CS-2 landed in the same commit as this story's emission rather than as its own atomic
commit, which Task 0 required. The deviation is disclosed in the Dev Agent Record and the
ledger rather than left for a reader to infer from the history.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pipeline.errors import PipelineError
from pipeline.ingest.records import canonical_json, write_canonical
from pipeline.precompute.budget import BUDGET_BYTES, over_budget
from pipeline.precompute.errors import (
    BudgetExceededError,
    BundleValidationError,
    EmitError,
    UnmappedFieldError,
)
from pipeline.precompute.serialize import decimals_map, round_to_precision
from pipeline.validate.errors import SchemaValidationError
from pipeline.validate.schema import (
    load_schemas,
    schema_version,
    validate_artifact,
    walk_subschemas,
)

BUNDLE_SCHEMA = "match-bundle.schema.json"
DEFAULT_SPINE_DIR = Path("work") / "spine"
DEFAULT_DATA_DIR = Path("data")

# Period structure. `PERIOD_REGULAR[i]` is the elapsed-count range of period i's regular
# play; `BOUNDS[i]` is the minute its stoppage hangs off. Derived and measured in Task 1.5,
# never assumed — see `shot_minute_stamp`.
PERIOD_REGULAR = ((1, 45), (46, 90), (91, 105), (106, 120))
BOUNDS = (45, 90, 105, 120)


# --------------------------------------------------------------------------- the boundary
def _def_properties(name: str) -> "set[str]":
    """The declared property names of one contract type, from either document.

    Both documents are searched because the bundle mixes them: `MinuteStamp` and `ShotEvent`
    are local, while `KnockoutScore` and `TeamScore` live in `common.schema.json`. Looking in
    one document only would make `check_total` raise `KeyError` on the shared types and
    quietly leave them unasserted if that were caught.

    **Named subschemas are searched too, not just `$defs`.** Several contract objects are
    declared INLINE with a `title` rather than hoisted into `$defs` — `FreeKickCounts`,
    `CornerDeliveryTypeCounts`, `CornerDeliveryStyleCounts`, `InterventionTypeCounts`. They
    are types by every other measure (the codegen emits them, the review cites them by name),
    and looking only in `$defs` is why Task 3.3's totality claim quietly held on eight of the
    bundle's objects instead of all of them: `check_total` on those four would have raised
    `KeyError`, so they were left unasserted.
    """
    schemas = load_schemas()
    for document in (BUNDLE_SCHEMA, "common.schema.json"):
        defs = schemas[document].get("$defs", {})
        if name in defs:
            return set(defs[name].get("properties", {}))
    for document in (BUNDLE_SCHEMA, "common.schema.json"):
        for _pointer, node in walk_subschemas(schemas[document]):
            if isinstance(node, dict) and node.get("title") == name and "properties" in node:
                return set(node["properties"])
    raise KeyError(f"no $def or titled subschema named {name!r} in either contract document")


def check_total(obj: "dict", def_name: str, where: str) -> "dict":
    """Assert `obj`'s key set EQUALS `def_name`'s declared properties (Task 3.3).

    The cheap check is "no key contains `_`", and it is NOT sufficient: single-word snake
    keys are indistinguishable from correct camelCase, so it misses `linked` and `ordinal`
    — two of the five keys `ShotEvent` must drop. Set equality costs the same, catches
    those, and also catches a camelCased-but-MISNAMED field that no underscore check can.

    **Every emitted object goes through this, which is the whole point of the sub-binding.**
    Six were originally missed — `metadata.score`, the three `TeamScore`s inside
    `knockoutScore`, `freeKicks`, `cornersByDeliveryType`, `cornersByDeliveryStyle` and
    `byInterventionType` — four of them because they are declared inline with a `title`
    rather than in `$defs` and `_def_properties` used to look only in `$defs`.
    """
    declared = _def_properties(def_name)
    present = set(obj)
    extra = present - declared
    missing = declared - present
    if extra or missing:
        parts = []
        if extra:
            parts.append(f"unmapped source key(s) {sorted(extra)!r}")
        if missing:
            parts.append(f"unfilled required target(s) {sorted(missing)!r}")
        raise UnmappedFieldError(
            f"{where}: {def_name} expects {sorted(declared)!r}; " + "; ".join(parts)
        )
    return obj


def _stamp(node: "dict | None") -> "dict | None":
    """`{minute, stoppage_minute}` -> `MinuteStamp`. A pure rename; the spine is already
    two-integer shaped (decision 7), so this never derives anything."""
    if node is None:
        return None
    return check_total(
        {"minute": node["minute"], "stoppageMinute": node["stoppage_minute"]},
        "MinuteStamp",
        "MinuteStamp",
    )


def _elapsed(stamp: "dict") -> int:
    """Elapsed-minute count of a football stamp: `minute + stoppage`.

    The single quantity both printed clocks agree on, and what makes the penalty tiebreak
    and the shot-clock cross-check possible without inventing anything.
    """
    return stamp["minute"] + (stamp["stoppageMinute"] or 0)


# ------------------------------------------------------------------------ RULED D4, clock
def periods_played(match: "dict") -> int:
    """2 or 4, read from the match's own momentum clock.

    The momentum series is a complete per-minute clock for the whole match, so its highest
    REGULAR minute says directly whether extra time was played. Measured: exactly 95
    matches end at regular minute 90 and 9 at 120, with nothing in between. This matters
    far beyond bookkeeping — in a two-period match every elapsed count above 90 is
    second-half stoppage with no competing reading, which is what makes 2,247 of 2,571
    shot rows structurally unambiguous.
    """
    samples = match["domains"]["momentum"]["samples"]
    if not samples:
        raise EmitError("momentum carries no samples, so the period structure is unknown",
                        match["spine"]["match_id"])
    return 4 if max(s["minute"] for s in samples) > 90 else 2


def _period_by_range(elapsed: int, n_periods: int) -> int:
    """The LATEST period whose regular range holds `elapsed`; else the last period played.

    This is an upper bound on the true period: an elapsed count of 46 is regular play of
    the second half OR stoppage of the first, and only order evidence can tell them apart.
    """
    for i in range(n_periods):
        lo, hi = PERIOD_REGULAR[i]
        if lo <= elapsed <= hi:
            return i
    return n_periods - 1


def assign_shot_periods(rows: "list[dict]", n_periods: int) -> "list[int]":
    """Period index per shot row, for one team-inning already sorted by `ordinal`.

    The range index is an UPPER bound. A DROP in the printed elapsed clock proves a period
    boundary was crossed, so a row before a drop sits in a strictly earlier period than the
    row after it. One backward pass pushes those upper bounds down; rows with no drop after
    them keep the range default (regular play), which is the ruling's own wording —
    "`at.minute = time_raw + 1` in regular play".

    Measured against the 208 independent goal stamps this agrees on 198, failing only on
    4 rows where the two printed clocks themselves disagree by 2 and 6 rows where the
    period is genuinely undetermined. 215 of 2,571 rows corpus-wide are defaulted with no
    evidence either way; the residual is filed, not buried, and it is NOT closed by making
    the numbers agree (the standing 1.8/1.12 rule).
    """
    period = [_period_by_range(row["time_raw"] + 1, n_periods) for row in rows]
    for i in range(len(rows) - 2, -1, -1):
        dropped = rows[i + 1]["time_raw"] < rows[i]["time_raw"]
        cap = period[i + 1] - 1 if dropped else period[i + 1]
        period[i] = min(period[i], max(cap, 0))
    return period


def shot_minute_stamp(time_raw: int, period: int) -> "dict":
    """The football stamp of a printed elapsed-minute floor (RULED D4).

    **`time_raw` is NOT the football minute — it is one less.** The shots table prints the
    elapsed-minute FLOOR, so second-half kickoff prints 45 and is football minute 46.
    Cross-checked against Domain A's goal glyphs over 208 clean 1:1 pairs:
    `time_raw - (minute + stoppage)` is -1 on 204 and -2 on 4. Emitting `time_raw` at face
    value would shift every one of 2,571 shots by a minute, validate clean, and nothing
    downstream would notice.

    Given the period's regular-play end boundary B and the elapsed count E = time_raw + 1:
    E > B is stoppage of that boundary, `{minute: B, stoppageMinute: E - B}`; otherwise it
    is plain regular play `{minute: E, stoppageMinute: None}`. Verified against every goal
    stamp that carries stoppage, including `m082` `time_raw` 130 -> `120+11`, which
    reproduces the ledger's `PMSR-M82-BEL-V-SEN` figure exactly.

    This also keeps `at.minute` inside `Minute`'s 0..120 maximum. 14 rows across six
    matches carry `time_raw >= 120`; under a naive +1 they become 121..132 and those six
    bundles could not be emitted at all.
    """
    elapsed = time_raw + 1
    boundary = BOUNDS[period]
    if elapsed > boundary:
        return check_total(
            {"minute": boundary, "stoppageMinute": elapsed - boundary},
            "MinuteStamp", "ShotEvent.at",
        )
    return check_total({"minute": elapsed, "stoppageMinute": None},
                       "MinuteStamp", "ShotEvent.at")


# ------------------------------------------------------------------------------ Domain A
def _team_ref(team_id: str, name: str, codes: "dict[str, str]") -> "dict":
    """`TeamRef` = `{teamId, teamCode, name}`.

    `teamCode` has NO producer anywhere in the extract layer — it exists only inside
    `report_id` and is committed in the registry. Never re-derive it: six codes carry a
    letter their team's slug does not contain (`cpv`, `cuw`, `mar`, `ksa`, `esp`, `sui`),
    and no first-three-letters rule produces `rsa` or `cod` either.
    """
    if team_id not in codes:
        raise EmitError(f"no committed teamCode for team id {team_id!r}")
    return check_total({"teamId": team_id, "teamCode": codes[team_id], "name": name},
                       "TeamRef", f"TeamRef[{team_id}]")


def _lineup_entry(entry: "dict") -> "dict":
    """One `LineupEntry`. `own_goals` is DROPPED, not renamed.

    `LineupEntry` is `additionalProperties: false` over eight properties with no own-goals
    slot, and `LineupEntry.goals`' own description says own goals appear in
    `metadata.goals` attributed to the benefiting team. The tempting repair is to camelCase
    it to `ownGoals`, which passes an underscore check and fails jsonschema with an
    `additionalProperties` error pointing somewhere unhelpful. Own goals leave the entry
    entirely.
    """
    return check_total(
        {
            "playerId": entry["player_id"],
            "name": entry["name"],
            "shirtNumber": entry["shirt_number"],
            "position": entry["position"],
            "substitutedOn": _stamp(entry["substituted_on"]),
            "substitutedOff": _stamp(entry["substituted_off"]),
            "goals": [_stamp(g) for g in entry["goals"]],
            "cards": [
                check_total({"type": c["type"], "at": _stamp(c["at"])},
                            "CardRecord", "CardRecord")
                for c in entry["cards"]
            ],
        },
        "LineupEntry",
        f'LineupEntry[{entry["player_id"]}]',
    )


def _lineup(side: "dict", match_id: str, which: str) -> "dict":
    """One side's `Lineup`, with the duplicate-`playerId` invariant asserted across it.

    `PlayerId` carries no uniqueness constraint and neither `players` nor `Lineup` declares
    `uniqueItems`, so a duplicate ships duplicate React keys and makes `DataTable`'s focus
    restore resolve to the wrong row. Story 2.11b's review routed the fix here by name and
    Task 4.6a asks for it on `metadata.lineups` as well as on `players[]` — the spine
    guarantees it (1,248 players, 0 collisions, all pinned), so this is a standing assertion
    rather than new logic. Starters and substitutes are checked as ONE namespace: the same
    player appearing in both is the collision that matters.
    """
    starters = [_lineup_entry(e) for e in side["starters"]]
    substitutes = [_lineup_entry(e) for e in side["substitutes"]]
    ids = [e["playerId"] for e in starters + substitutes]
    if len(ids) != len(set(ids)):
        seen: set[str] = set()
        dupes = sorted({i for i in ids if i in seen or seen.add(i)})
        raise EmitError(
            f"duplicate playerId(s) in metadata.lineups[{which}]: {dupes!r}", match_id
        )
    return check_total(
        {
            "formation": side["formation"],
            "starters": starters,
            "substitutes": substitutes,
        },
        "Lineup",
        f"Lineup[{which}]",
    )


def _penalty_goal_elapsed(match: "dict") -> "dict[str, set[int]]":
    """`{player_id: {elapsed counts of that player's penalty goals}}` (RULED D3).

    `GoalRecord.penalty` is required and `metadata.goals` is non-nullable, so this blocked
    all of Domain A. The lineup block renders goals as coloured glyphs carrying only a
    minute; no penalty flag exists anywhere in the spine. The shots table carries
    `delivery_type: "penalty"`, and corpus-wide all 16 penalty-delivery goal shots join a
    lineup goal by the same `player_id` with 0 failures.

    Two independently printed sources reconciled is not a guess — but it ships only because
    the join is re-derived here and FAILS LOUD on any unmatched penalty-goal shot.

    The match is exact rather than nearest-wins: the shot's elapsed count (`time_raw + 1`)
    must equal the lineup goal's (`minute + stoppage`). A multi-goal scorer NEEDS that
    tiebreak — 5 of the 16 have one and all five resolve uniquely, which is an independent
    confirmation of D4's clock from the other direction.

    **The elapsed check applies to a lone candidate too.** It used to be skipped when a
    scorer had exactly one lineup goal, on the reasoning that there was nothing to break the
    tie between — but that turned the sole candidate into an unconditional match, so a
    penalty goal shot at 70' by a player whose only lineup goal is at 30' would have flagged
    the 30' goal `penalty: true` and raised nothing, while the same disagreement in a
    two-goal scorer raised. Re-measured across the corpus: 11 of the 16 penalty goals take
    the lone-candidate path and 11/11 agree exactly, so this asserts a property the data
    already has rather than tightening one it does not.
    """
    domains = match["domains"]
    match_id = match["spine"]["match_id"]
    n_periods = periods_played(match)

    lineup_goals: dict[str, list[dict]] = {}
    for side in ("home", "away"):
        block = domains["match_metadata"]["lineups"][side]
        for group in ("starters", "substitutes"):
            for entry in block[group]:
                if entry["goals"]:
                    lineup_goals.setdefault(entry["player_id"], []).extend(entry["goals"])

    out: dict[str, set[int]] = {}
    for side in ("home", "away"):
        team_id = match["spine"][f"{side}_team_id"]
        rows = sorted(
            [s for s in domains["shots"]["shot_events"] if s["team_id"] == team_id],
            key=lambda s: s["ordinal"],
        )
        periods = assign_shot_periods(rows, n_periods)
        for row, period in zip(rows, periods):
            if row["delivery_type"] != "penalty" or row["outcome"] != "goal":
                continue
            candidates = lineup_goals.get(row["player_id"], [])
            if not candidates:
                raise EmitError(
                    f"penalty-delivery shot with outcome 'goal' by {row['player_id']!r} "
                    f"joins no lineup goal; the D3 reconciliation is broken and "
                    f"GoalRecord.penalty cannot be derived",
                    match_id,
                )
            shot_elapsed = _elapsed(shot_minute_stamp(row["time_raw"], period))
            hits = [g for g in candidates if _elapsed(_stamp(g)) == shot_elapsed]
            if len(hits) != 1:
                raise EmitError(
                    f"penalty-goal shot by {row['player_id']!r} at elapsed "
                    f"{shot_elapsed} matches {len(hits)} of {len(candidates)} lineup "
                    f"goal(s) {[_elapsed(_stamp(g)) for g in candidates]!r}; the two "
                    f"printed clocks disagree and penalty must not be guessed",
                    match_id,
                )
            out.setdefault(row["player_id"], set()).add(_elapsed(_stamp(hits[0])))
    return out


def _goals(match: "dict") -> "list[dict]":
    """`metadata.goals` — assembled, not copied, and chronological.

    Goals and own goals are nested INSIDE the owning `LineupEntry` (294 + 14 = 308 records
    corpus-wide). AD-6's one live trap is here: an `ownGoal: true` record is credited to
    the team that BENEFITED while `scorerPlayerId` names the scorer, so the team id
    inverts relative to the entry it was read from.
    """
    domains = match["domains"]
    penalties = _penalty_goal_elapsed(match)
    records: list[dict] = []

    for side in ("home", "away"):
        own_team = match["spine"][f"{side}_team_id"]
        other_team = match["spine"][f'{"away" if side == "home" else "home"}_team_id']
        block = domains["match_metadata"]["lineups"][side]
        for group in ("starters", "substitutes"):
            for entry in block[group]:
                for goal in entry["goals"]:
                    at = _stamp(goal)
                    records.append(check_total(
                        {
                            "teamId": own_team,
                            "scorerPlayerId": entry["player_id"],
                            "scorerName": entry["name"],
                            "at": at,
                            "ownGoal": False,
                            "penalty": _elapsed(at) in penalties.get(entry["player_id"], ()),
                        },
                        "GoalRecord", f'GoalRecord[{entry["player_id"]}]',
                    ))
                for goal in entry["own_goals"]:
                    records.append(check_total(
                        {
                            # AD-6: credited to the BENEFITING team, not the scorer's.
                            "teamId": other_team,
                            "scorerPlayerId": entry["player_id"],
                            "scorerName": entry["name"],
                            "at": _stamp(goal),
                            "ownGoal": True,
                            # A shoot-out conversion is never a goal, and an own goal is
                            # never a penalty; nothing in the corpus marks one.
                            "penalty": False,
                        },
                        "GoalRecord", f'GoalRecord[{entry["player_id"]} own]',
                    ))

    records.sort(key=lambda g: (g["at"]["minute"], g["at"]["stoppageMinute"] or 0,
                                g["scorerPlayerId"]))
    return records


def _knockout_score(match: "dict", codes: "dict[str, str]", goals: "list[dict]") -> "dict":
    """`metadata.knockoutScore` — required on ALL 104 matches, group ties included.

    It is a bare non-nullable `$ref` named in `MatchMetadata.required`; there is no
    "knockout matches only" branch. Reading Task 6 as scoped to the 32 knockout matches
    ships 72 bundles missing a required key.

    `scoreAfter90` is DERIVED from `metadata.goals` rather than assumed equal to the cover
    score. The cover prints one final score — after extra time when extra time was played
    (`match-bundle.schema.json:211`) — and no after-90 line, so in the 9 extra-time matches
    copying it would state the wrong number wherever the tie was not level at 90. Every
    goal already carries a real `MinuteStamp`, so counting the ones at minute <= 90 is a
    reconciliation of two printed sources rather than an invention. The result is
    cross-checked against the cover score below.
    """
    match_id = match["spine"]["match_id"]
    score = match["domains"]["match_metadata"]["score"]
    home_id = match["spine"]["home_team_id"]
    away_id = match["spine"]["away_team_id"]
    final = {"home": score["home"], "away": score["away"]}
    went_to_et = periods_played(match) == 4
    shootout_prose = score["shootout"]

    def tally(limit: int) -> "dict[str, int]":
        return {
            "home": sum(1 for g in goals if g["teamId"] == home_id and g["at"]["minute"] <= limit),
            "away": sum(1 for g in goals if g["teamId"] == away_id and g["at"]["minute"] <= limit),
        }

    # The cover score and the goal records must agree on the full match, or one of the two
    # printed sources is being read wrongly and neither tally can be trusted.
    full = tally(120)
    if full != final:
        raise EmitError(
            f"goal records tally {full} but the cover score prints {final}; the two "
            f"printed sources disagree and scoreAfter90 must not be derived from either",
            match_id,
        )

    # The momentum clock says whether extra time was played; `metadata.goals` says it again,
    # independently, because regulation stoppage stamps as `{90, N}` so any goal at
    # `minute > 90` can only be extra time. Cross-check them: a momentum series truncated at
    # 90 on a tie actually decided in extra time would otherwise emit `decidedBy:
    # "regulation"` with a `scoreAfter90` short by the extra-time goals, and nothing else
    # would notice — `tally(120)` still equals the cover score and a winner still exists.
    goals_past_90 = [g for g in goals if g["at"]["minute"] > 90]
    if goals_past_90 and not went_to_et:
        raise EmitError(
            f"{len(goals_past_90)} goal(s) are stamped past minute 90 but the momentum "
            f"clock ends at 90, so the two printed clocks disagree on whether extra time "
            f"was played; decidedBy must not be derived from one of them alone",
            match_id,
        )

    score_after_90 = tally(90)
    score_after_et = dict(final) if went_to_et else None
    shootout_score = (_parse_shootout(shootout_prose, match, codes)
                      if shootout_prose is not None else None)

    if shootout_prose is not None:
        decided_by = "shootout"
    elif went_to_et:
        decided_by = "extra-time"
    else:
        decided_by = "regulation"

    if decided_by == "shootout":
        winner = _shootout_winner(shootout_prose, match, codes)
    elif final["home"] != final["away"]:
        winner = home_id if final["home"] > final["away"] else away_id
    else:
        winner = None

    out = check_total(
        {
            "scoreAfter90": check_total(score_after_90, "TeamScore",
                                        f"KnockoutScore.scoreAfter90[{match_id}]"),
            "scoreAfterET": (None if score_after_et is None else check_total(
                score_after_et, "TeamScore", f"KnockoutScore.scoreAfterET[{match_id}]")),
            "shootoutScore": (None if shootout_score is None else check_total(
                shootout_score, "TeamScore", f"KnockoutScore.shootoutScore[{match_id}]")),
            "winnerTeamId": winner,
            "decidedBy": decided_by,
        },
        "KnockoutScore", f"KnockoutScore[{match_id}]",
    )

    # The invariant the schema documents but cannot encode (decision 12 forbids if/then).
    if decided_by == "regulation" and (score_after_et is not None or shootout_score is not None):
        raise EmitError("decidedBy 'regulation' with a non-null scoreAfterET or "
                        "shootoutScore", match_id)
    if decided_by == "extra-time" and (score_after_et is None or shootout_score is not None):
        raise EmitError("decidedBy 'extra-time' needs scoreAfterET and a null "
                        "shootoutScore", match_id)
    if decided_by == "shootout" and (score_after_et is None or shootout_score is None):
        raise EmitError("decidedBy 'shootout' needs both scoreAfterET and shootoutScore",
                        match_id)
    if (winner is None) != (decided_by == "regulation" and final["home"] == final["away"]):
        raise EmitError(
            f"winnerTeamId is null iff the tie was drawn in regulation; got "
            f"winner={winner!r} decidedBy={decided_by!r} score={final!r}",
            match_id,
        )
    return out


def _shootout_parts(prose: str, match: "dict") -> "tuple[str, int, int]":
    """`'(Paraguay win 3-4 on Penalties)'` -> `('Paraguay', 3, 4)`.

    **`a`-`b` IS home-away — it is simply not winner-first.** Verified on all four ties:
    m074 Germany(h)/Paraguay(a) prints `3-4` with Paraguay winning, and the committed m074
    fixture pins `shootoutScore {"home": 3, "away": 4}`. Assuming winner-first inverts
    every one of them.
    """
    match_id = match["spine"]["match_id"]
    text = prose.strip()
    if not (text.startswith("(") and text.endswith(")")):
        raise EmitError(f"shoot-out prose {prose!r} is not parenthesised", match_id)
    body = text[1:-1].strip()
    marker = " win "
    if marker not in body or not body.endswith(" on Penalties"):
        raise EmitError(
            f"shoot-out prose {prose!r} does not match '(<winner> win <a>-<b> on "
            f"Penalties)'; it must not be guessed at",
            match_id,
        )
    winner_name, rest = body.split(marker, 1)
    digits = rest[: -len(" on Penalties")].strip()
    if digits.count("-") != 1:
        raise EmitError(f"shoot-out score {digits!r} in {prose!r} is not '<a>-<b>'", match_id)
    left, right = digits.split("-")
    try:
        return winner_name.strip(), int(left), int(right)
    except ValueError:
        raise EmitError(f"shoot-out score {digits!r} in {prose!r} is not two integers",
                        match_id) from None


def _parse_shootout(prose: str, match: "dict", codes: "dict[str, str]") -> "dict":
    winner_name, home_goals, away_goals = _shootout_parts(prose, match)
    teams = match["domains"]["match_metadata"]["teams"]
    match_id = match["spine"]["match_id"]
    if winner_name not in (teams["home"], teams["away"]):
        raise EmitError(
            f"shoot-out winner {winner_name!r} in {prose!r} is neither "
            f"{teams['home']!r} nor {teams['away']!r}",
            match_id,
        )
    # Assert the named winner's OWN side holds the larger number, which is what proves the
    # home-away reading rather than assuming it.
    winner_is_home = winner_name == teams["home"]
    if home_goals == away_goals:
        # Checked before the side comparison, which cannot see it: `(a > b) != winner_is_home`
        # is False == False for an away-named winner on a level score, so a tie would pass
        # from one side and raise from the other. A shoot-out cannot end level.
        raise EmitError(
            f"shoot-out prose {prose!r} reads {home_goals}-{away_goals}, which is level; "
            f"a shoot-out cannot end level and the score must not be guessed at",
            match_id,
        )
    if (home_goals > away_goals) != winner_is_home:
        raise EmitError(
            f"shoot-out prose {prose!r} names {winner_name!r} as winner but the "
            f"home-away reading {home_goals}-{away_goals} gives it the smaller total; "
            f"the a-b mapping does not hold on this row",
            match_id,
        )
    return {"home": home_goals, "away": away_goals}


def _shootout_winner(prose: str, match: "dict", codes: "dict[str, str]") -> str:
    winner_name, _, _ = _shootout_parts(prose, match)
    teams = match["domains"]["match_metadata"]["teams"]
    if winner_name == teams["home"]:
        return match["spine"]["home_team_id"]
    return match["spine"]["away_team_id"]


def build_metadata(match: "dict", entities: "dict", codes: "dict[str, str]") -> "dict":
    """Domain A -> `metadata`."""
    domains = match["domains"]
    spine = match["spine"]
    match_id = spine["match_id"]

    row = next((m for m in entities["matches"] if m["match_id"] == match_id), None)
    if row is None:
        raise EmitError(f"entities.json carries no row for match {match_id!r}")

    teams = domains["match_metadata"]["teams"]
    score = domains["match_metadata"]["score"]
    goals = _goals(match)
    return check_total(
        {
            # One source, not two: the entities block was shaped so this story emits from
            # it without a reshape. Re-parsing the match_id prefix is the reinvention.
            "matchNumber": row["match_number"],
            "homeTeam": _team_ref(spine["home_team_id"], teams["home"], codes),
            "awayTeam": _team_ref(spine["away_team_id"], teams["away"], codes),
            # Drop the unparsed `shootout` prose string; it decomposes into knockoutScore.
            "score": check_total({"home": score["home"], "away": score["away"]},
                                 "TeamScore", f"MatchMetadata.score[{match_id}]"),
            "knockoutScore": _knockout_score(match, codes, goals),
            "stage": domains["match_metadata"]["stage"],
            "group": domains["match_metadata"]["group"],
            "matchdayRound": spine["matchday_round"],
            "venue": domains["match_metadata"]["venue"],
            "date": domains["match_metadata"]["date"],
            "kickoff": domains["match_metadata"]["kickoff"],
            "lineups": {
                "home": _lineup(domains["match_metadata"]["lineups"]["home"],
                                match_id, "home"),
                "away": _lineup(domains["match_metadata"]["lineups"]["away"],
                                match_id, "away"),
            },
            "goals": goals,
        },
        "MatchMetadata", f"MatchMetadata[{match_id}]",
    )


# ------------------------------------------------------------------------------ Domain B
_KEY_STATISTICS = {
    "possession": "possession", "goals": "goals", "expectedGoals": "expected_goals",
    "shots": "shots", "shotsOnTarget": "shots_on_target", "passes": "passes",
    "passesCompleted": "passes_completed", "passCompletion": "pass_completion",
    "completedLineBreaks": "completed_line_breaks",
    "defensiveLineBreaks": "defensive_line_breaks",
    "receptionsInFinalThird": "receptions_in_final_third", "crosses": "crosses",
    "ballProgressions": "ball_progressions", "defensivePressures": "defensive_pressures",
    "directPressures": "direct_pressures", "forcedTurnovers": "forced_turnovers",
    "secondBalls": "second_balls", "distanceCovered": "distance_covered",
    "sprintDistance": "sprint_distance",
}


def build_key_statistics(match: "dict") -> "dict":
    """Domain B -> `keyStatistics`. `contestedPossession` sits at block level, not per team."""
    block = match["domains"]["key_statistics"]
    return check_total(
        {
            "home": check_total({t: block["home"][s] for t, s in _KEY_STATISTICS.items()},
                                "TeamKeyStatistics", "TeamKeyStatistics[home]"),
            "away": check_total({t: block["away"][s] for t, s in _KEY_STATISTICS.items()},
                                "TeamKeyStatistics", "TeamKeyStatistics[away]"),
            "contestedPossession": block["contested_possession"],
        },
        "KeyStatisticsBlock", "KeyStatisticsBlock",
    )


# ------------------------------------------------------------------------------ Domain F
def _corner_sides(counts: "dict") -> "dict":
    return check_total({"left": counts["left"], "right": counts["right"],
                        "total": counts["total"]}, "CornerSideCounts", "CornerSideCounts")


def build_set_plays(match: "dict") -> "dict":
    """Domain F -> `setPlays`. NOT a pure rename: `cornersBySide` is derived here.

    `TeamSetPlays.required` includes `cornersBySide`, the block is
    `additionalProperties: false`, and the spine has NO side block — without this
    derivation every bundle fails validation for both teams on all 104 matches. It is
    deliberate: decision 14 makes `cornersBySide` precomputed BECAUSE AD-5 forbids the App
    adding three numbers.

    The two relations the contract's own `description`s assert are CORPUS-FALSE and are NOT
    asserted here: `direct == directOnTarget + directOffTarget` holds on 0/208 (160 innings
    carry `on + off == 0` while `direct > 0`), and `sum(cornersByDeliveryStyle) ==
    totalCorners` holds on only 96/208, never over. Both hold 6/6 in the hand-authored
    fixtures, which is how they came to be written. Carrying them across to the real
    emission would make a correct bundle look broken. Correcting the two descriptions is a
    successor change-set, not this story.
    """
    out: dict[str, dict] = {}
    for side in ("home", "away"):
        block = match["domains"]["set_plays"][side]
        by_type = block["corners_by_delivery_type"]
        free_kicks = block["free_kicks"]
        match_id = match["spine"]["match_id"]

        left = sum(v["left"] for v in by_type.values())
        right = sum(v["right"] for v in by_type.values())
        total = sum(v["total"] for v in by_type.values())

        # Cross-checks, all corpus-true on 208/208. Fail loud on a mismatch.
        for name, counts in by_type.items():
            if counts["left"] + counts["right"] != counts["total"]:
                raise EmitError(
                    f"{side} corners_by_delivery_type[{name}]: left+right "
                    f"{counts['left']}+{counts['right']} != total {counts['total']}",
                    match_id,
                )
        if left + right != total:
            raise EmitError(
                f"{side} derived cornersBySide: left+right {left}+{right} != total {total}",
                match_id,
            )
        if total != block["total_corners"]:
            raise EmitError(
                f"{side} sum(cornersByDeliveryType[*].total) {total} != totalCorners "
                f"{block['total_corners']}",
                match_id,
            )
        if free_kicks["direct"] + free_kicks["indirect"] != block["total_free_kicks"]:
            raise EmitError(
                f"{side} direct+indirect {free_kicks['direct']}+{free_kicks['indirect']} "
                f"!= totalFreeKicks {block['total_free_kicks']}",
                match_id,
            )
        expected_total = (block["total_free_kicks"] + block["total_corners"]
                          + block["total_throw_ins"] + block["total_penalties"])
        if block["total_set_plays"] != expected_total:
            raise EmitError(
                f"{side} totalSetPlays {block['total_set_plays']} != freeKicks+corners+"
                f"throwIns+penalties {expected_total}",
                match_id,
            )

        style = block["corners_by_delivery_style"]
        out[side] = check_total(
            {
                "totalSetPlays": block["total_set_plays"],
                "totalFreeKicks": block["total_free_kicks"],
                "totalPenalties": block["total_penalties"],
                "totalCorners": block["total_corners"],
                "totalThrowIns": block["total_throw_ins"],
                "cornersBySide": check_total(
                    {"left": left, "right": right, "total": total},
                    "TeamCornerSideCounts", f"TeamCornerSideCounts[{side}]",
                ),
                "freeKicks": check_total(
                    {
                        "direct": free_kicks["direct"],
                        "directOnTarget": free_kicks["direct_on_target"],
                        "directOffTarget": free_kicks["direct_off_target"],
                        "indirect": free_kicks["indirect"],
                    },
                    "FreeKickCounts", f"FreeKickCounts[{side}]",
                ),
                "cornersByDeliveryType": check_total(
                    {
                        "directToArea": _corner_sides(by_type["direct_to_area"]),
                        "short": _corner_sides(by_type["short"]),
                        "edgeOfPenaltyArea": _corner_sides(by_type["edge_of_penalty_area"]),
                    },
                    "CornerDeliveryTypeCounts", f"CornerDeliveryTypeCounts[{side}]",
                ),
                "cornersByDeliveryStyle": check_total(
                    {
                        "inswing": style["inswing"], "outswing": style["outswing"],
                        "driven": style["driven"], "lofted": style["lofted"],
                    },
                    "CornerDeliveryStyleCounts", f"CornerDeliveryStyleCounts[{side}]",
                ),
            },
            "TeamSetPlays", f"TeamSetPlays[{side}]",
        )
    return check_total(out, "SetPlaysBlock", "SetPlaysBlock")


# ------------------------------------------------------------------------------ Domain G
_IN_POSSESSION = {
    "passesAttempted": "passes_attempted", "passesCompleted": "passes_completed",
    "passCompletion": "pass_completion", "switchesOfPlay": "switches_of_play",
    "crossesAttempted": "crosses_attempted", "crossesCompleted": "crosses_completed",
    "lineBreaksAttempted": "line_breaks_attempted",
    "lineBreaksCompleted": "line_breaks_completed",
    "lineBreakCompletion": "line_break_completion", "ballProgressions": "ball_progressions",
    "takeOns": "take_ons", "stepIns": "step_ins", "attemptsAtGoal": "attempts_at_goal",
    "goals": "goals", "totalOffers": "total_offers", "offersReceived": "offers_received",
}
_OFFER_MOVEMENT = {
    "inFront": "in_front", "inBetween": "in_between", "outToIn": "out_to_in",
    "inToOut": "in_to_out", "inBehind": "in_behind", "noMovement": "no_movement",
}
_OUT_OF_POSSESSION = {
    "tacklesMade": "tackles_made", "tacklesWon": "tackles_won", "blocks": "blocks",
    "interceptions": "interceptions", "pressingDirect": "pressing_direct",
    "pressingIndirect": "pressing_indirect", "duelsWonAerial": "duels_won_aerial",
    "duelsWonPhysical": "duels_won_physical",
    "possessionContestsWon": "possession_contests_won", "clearances": "clearances",
    "looseBallReceptions": "loose_ball_receptions", "pushingOn": "pushing_on",
    "pushingOnIntoPressing": "pushing_on_into_pressing",
    "possessionRegains": "possession_regains",
    "possessionInterrupted": "possession_interrupted",
}
_PHYSICAL = {
    "totalDistance": "total_distance", "distanceZone1": "distance_zone_1",
    "distanceZone2": "distance_zone_2", "distanceZone3": "distance_zone_3",
    "distanceZone4": "distance_zone_4", "distanceZone5": "distance_zone_5",
    "highSpeedRuns": "high_speed_runs", "sprints": "sprints", "topSpeed": "top_speed",
}


def build_players(match: "dict") -> "list[dict]":
    """Domain G -> `players[]`.

    `teamId` is NOT on the row — it comes from the `home`/`away` side key. Order is
    home-then-away read from the SPINE's team ids rather than from array order (the rule
    Story 2.10 shipped for `#goalkeeping`), then by shirt number. Both are prose in the
    schema description and enforced by nothing, so they are asserted here.

    `players` has no `uniqueItems` and `PlayerId` carries no uniqueness, so a duplicate is
    asserted here too: it would ship duplicate React keys and make `DataTable`'s focus
    restore resolve to the wrong player's row. Story 2.11b's review routed the fix upstream
    to this story by name.
    """
    match_id = match["spine"]["match_id"]
    out: list[dict] = []
    for side in ("home", "away"):
        team_id = match["spine"][f"{side}_team_id"]
        rows = sorted(match["domains"]["player_stats"][side], key=lambda p: p["shirt_number"])
        for row in rows:
            in_possession = {t: row["in_possession"][s] for t, s in _IN_POSSESSION.items()}
            in_possession["offersByMovementType"] = check_total(
                {t: row["in_possession"]["offers_by_movement_type"][s]
                 for t, s in _OFFER_MOVEMENT.items()},
                "OfferMovementCounts", "OfferMovementCounts",
            )
            out.append(check_total(
                {
                    "teamId": team_id,
                    "playerId": row["player_id"],
                    "playerName": row["name"],
                    "shirtNumber": row["shirt_number"],
                    "position": row["position"],
                    "inPossession": check_total(in_possession, "PlayerInPossession",
                                                f'PlayerInPossession[{row["player_id"]}]'),
                    "outOfPossession": check_total(
                        {t: row["out_of_possession"][s] for t, s in _OUT_OF_POSSESSION.items()},
                        "PlayerOutOfPossession", f'PlayerOutOfPossession[{row["player_id"]}]'),
                    "physical": check_total(
                        {t: row["physical"][s] for t, s in _PHYSICAL.items()},
                        "PlayerPhysical", f'PlayerPhysical[{row["player_id"]}]'),
                },
                "PlayerRecord", f'PlayerRecord[{row["player_id"]}]',
            ))

    ids = [p["playerId"] for p in out]
    if len(ids) != len(set(ids)):
        seen: set[str] = set()
        dupes = sorted({i for i in ids if i in seen or seen.add(i)})
        raise EmitError(f"duplicate playerId(s) in players[]: {dupes!r}", match_id)
    return out


def build_story_stats(key_statistics: "dict", players: "list[dict]",
                      home_id: str, away_id: str, match_id: str) -> "dict":
    """`storyStats` — four fields projected from `keyStatistics`, `topSpeed` derived.

    `keyStatistics` carries no top speed; the per-team maximum comes from
    `players[].physical.topSpeed`. AD-5 puts that derivation in the pipeline, and the
    shipped fixture invariant covers only the other four, so `topSpeed` is asserted here.
    """
    out: dict[str, dict] = {}
    for side, team_id in (("home", home_id), ("away", away_id)):
        speeds = [p["physical"]["topSpeed"] for p in players if p["teamId"] == team_id]
        if not speeds:
            raise EmitError(f"no player rows for {side} team {team_id!r}, so storyStats"
                            f".topSpeed cannot be derived", match_id)
        stats = key_statistics[side]
        out[side] = check_total(
            {
                "possession": stats["possession"],
                "shots": stats["shots"],
                "expectedGoals": stats["expectedGoals"],
                "distanceCovered": stats["distanceCovered"],
                "topSpeed": max(speeds),
            },
            "StoryStats", f"StoryStats[{side}]",
        )
    return check_total(out, "StoryStatsBlock", "StoryStatsBlock")


# ------------------------------------------------------------------------------ Domain C
_IN_POSSESSION_PHASES = {
    "buildUpUnopposed": "build_up_unopposed", "buildUpOpposed": "build_up_opposed",
    "progression": "progression", "finalThird": "final_third", "longBall": "long_ball",
    "attackingTransition": "attacking_transition", "counterAttack": "counter_attack",
    "setPiece": "set_piece",
}
_OUT_OF_POSSESSION_PHASES = {
    "highPress": "high_press", "midPress": "mid_press", "lowPress": "low_press",
    "highBlock": "high_block", "midBlock": "mid_block", "lowBlock": "low_block",
    "recovery": "recovery", "defensiveTransition": "defensive_transition",
    "counterPress": "counter_press",
}
# The panel keys the Phases of Play page prints, contract name -> corpus name.
_IN_POSSESSION_PANELS = {
    "buildUpLow": "build-up-low", "buildUpMid": "build-up-mid",
    "finalThirdPhase": "final-third-phase",
}
_OUT_OF_POSSESSION_PANELS = {
    "highBlockPress": "high-block-press", "midBlock": "mid-block", "lowBlock": "low-block",
}


def _shape_metrics(panel: "dict") -> "dict":
    return check_total(
        {"lineHeight": panel["line_height"], "teamLength": panel["team_length"],
         "teamWidth": panel["team_width"]},
        "ShapeMetrics", "ShapeMetrics",
    )


def build_tactical_identity(match: "dict") -> "dict":
    """Domain C -> `tacticalIdentity` (RULED D1, unblocked by CS-2).

    The corpus prints **three panels per possession state with three measures each** — 18
    values per team, 3,744 corpus-wide — against the four `PossessionSplitMetres` modelled
    before CS-2. No aggregation is implied by the data and none is invented here: m001 home
    in-possession `line_height` is 19 / 39 / 54, and the pre-CS-2 fixture's single 44.4
    matched no panel and no mean of them because it was synthetic.

    `defensiveBlockDistribution` MUST equal `phasesOutOfPossession.{high,mid,low}Block` —
    the schema cannot say so (decision 12 forbids `if`/`then`), and the two copies exist
    because #pressing renders block height as its own concept. Verified equal on 208/208
    corpus team-innings; asserted here so they cannot drift.
    """
    match_id = match["spine"]["match_id"]
    out: dict[str, dict] = {}
    for side in ("home", "away"):
        block = match["domains"]["tactical_identity"][side]
        panels = block["line_height_team_length"]
        phases_out = {t: block["phases_out_of_possession"][s]
                      for t, s in _OUT_OF_POSSESSION_PHASES.items()}
        distribution = {"high": block["defensive_block"]["high"],
                        "mid": block["defensive_block"]["mid"],
                        "low": block["defensive_block"]["low"]}
        mirrored = {"high": phases_out["highBlock"], "mid": phases_out["midBlock"],
                    "low": phases_out["lowBlock"]}
        if distribution != mirrored:
            raise EmitError(
                f"{side} defensiveBlockDistribution {distribution!r} does not mirror "
                f"phasesOutOfPossession {mirrored!r}; the two copies of the same three "
                f"numbers have drifted",
                match_id,
            )
        out[side] = check_total(
            {
                "phasesInPossession": check_total(
                    {t: block["phases_in_possession"][s]
                     for t, s in _IN_POSSESSION_PHASES.items()},
                    "InPossessionPhases", f"InPossessionPhases[{side}]"),
                "phasesOutOfPossession": check_total(
                    phases_out, "OutOfPossessionPhases", f"OutOfPossessionPhases[{side}]"),
                "shapeByPhase": check_total(
                    {
                        "inPossession": check_total(
                            {t: _shape_metrics(panels["in_possession"][s])
                             for t, s in _IN_POSSESSION_PANELS.items()},
                            "InPossessionShapePanels", f"InPossessionShapePanels[{side}]"),
                        "outOfPossession": check_total(
                            {t: _shape_metrics(panels["out_of_possession"][s])
                             for t, s in _OUT_OF_POSSESSION_PANELS.items()},
                            "OutOfPossessionShapePanels",
                            f"OutOfPossessionShapePanels[{side}]"),
                    },
                    "ShapeByPhase", f"ShapeByPhase[{side}]"),
                "defensiveBlockDistribution": check_total(
                    distribution, "DefensiveBlockDistribution",
                    f"DefensiveBlockDistribution[{side}]"),
            },
            "TeamTacticalIdentity", f"TeamTacticalIdentity[{side}]",
        )
    return check_total(out, "TacticalIdentityBlock", "TacticalIdentityBlock")


# ------------------------------------------------------------------------------ Domain E
def _completion_counts(node: "dict", where: str) -> "dict":
    """`CompletionCounts`. The spine's `printed_total` is DROPPED — the contract models
    `total` alone, and `printed_total` is the extractor's own cross-check field."""
    return check_total(
        {"complete": node["complete"], "incomplete": node["incomplete"],
         "total": node["total"]},
        "CompletionCounts", where,
    )


_INTERVENTION_TYPES = {
    "saveAndRetain": "save_and_retain", "saveAndDeflect": "save_and_deflect",
    "deflectAndRetain": "deflect_and_retain", "saveAttempt": "save_attempt",
    "noSaveAttempt": "no_save_attempt",
}
_DELIVERY_TYPES_FACED = {
    "inswing": "inswing", "outswing": "outswing", "driven": "driven", "lofted": "lofted",
    "cutback": "cutback", "pushCross": "push_cross", "total": "total",
}


def build_goalkeeping(match: "dict") -> "list[dict]":
    """Domain E -> `goalkeeping` (RULED D2, unblocked by CS-2).

    **Per TEAM, home first.** The source is per-team: all four page families are titled
    `{team}`, no goalkeeper name appears on any of them, and 7 of 208 corpus team-innings
    used two keepers while still printing one team-level block each. The keeper list is
    carried as CONTEXT and the figures are never summed or split across two keepers (AD-5).

    **The five CS-2-nullable fields emit `null` on 208/208** — `feetTechniques`,
    `handsTechniques`, `throwTechniques`, `byBodyType`, `crossesFacedCompleted`. Their
    absence is not an extraction defect: they are raster donut-slice labels and one
    unvalidatable marker colour, and only the donut centre total reaches the text layer.

    **The two parallel lists are zipped here**, which Story 1.9 chose the shape for and
    recorded so the zip would be expected rather than surprising: `involvement_series` and
    `involvement_clock.stamps` are indexed by position, one sample per slot.

    `Σ(involvement_series) <= total_involvements` is the shipped bound and is NOT an
    equality — the printed total exceeds the plotted sum by 0-5 on all 208 innings, cause
    unresolved. Both are emitted verbatim and are not reconciled (the standing 1.8/1.12
    rule).
    """
    match_id = match["spine"]["match_id"]
    out: list[dict] = []
    for side in ("home", "away"):
        team_id = match["spine"][f"{side}_team_id"]
        block = match["domains"]["goalkeeping"][side]
        series = block["involvement_series"]
        stamps = block["involvement_clock"]["stamps"]
        if len(series) != len(stamps):
            raise EmitError(
                f"{side} involvement_series has {len(series)} slot(s) but "
                f"involvement_clock.stamps has {len(stamps)}; the two parallel lists "
                f"cannot be zipped",
                match_id,
            )
        total = block["total_involvements"]
        if sum(series) > total:
            raise EmitError(
                f"{side} plotted involvements {sum(series)} exceed the printed total "
                f"{total}; the bound is sum <= total",
                match_id,
            )
        keepers = block["goalkeepers"]
        if not keepers:
            raise EmitError(f"{side} goalkeeping block names no goalkeeper", match_id)

        distribution = block["distribution"]
        prevention = block["goal_prevention"]
        aerial = block["aerial_control"]
        out.append(check_total(
            {
                "teamId": team_id,
                "goalkeepers": [
                    check_total(
                        {
                            "playerId": k["player_id"],
                            "playerName": k["name"],
                            "shirtNumber": k["shirt_number"],
                            "substitutedOn": _stamp(k["substituted_on"]),
                            "substitutedOff": _stamp(k["substituted_off"]),
                        },
                        "GoalkeeperRef", f'GoalkeeperRef[{k["player_id"]}]')
                    for k in keepers
                ],
                "totalInvolvements": total,
                "involvementTimeline": [
                    check_total(
                        {"at": _stamp(stamp), "involvements": count},
                        "GoalkeeperInvolvementSample", "GoalkeeperInvolvementSample")
                    for stamp, count in zip(stamps, series)
                ],
                "distribution": check_total(
                    {
                        "total": _completion_counts(distribution["total"],
                                                    f"distribution.total[{side}]"),
                        "feet": _completion_counts(distribution["feet"],
                                                   f"distribution.feet[{side}]"),
                        "hands": _completion_counts(distribution["hands"],
                                                    f"distribution.hands[{side}]"),
                        "throw": _completion_counts(distribution["throw"],
                                                    f"distribution.throw[{side}]"),
                        "feetTechniques": distribution["feet_techniques"],
                        "handsTechniques": distribution["hands_techniques"],
                        "throwTechniques": distribution["throw_techniques"],
                        "lineBreaks": distribution["line_breaks"],
                    },
                    "GoalkeeperDistribution", f"GoalkeeperDistribution[{side}]"),
                "goalPrevention": check_total(
                    {
                        "attemptsFaced": prevention["attempts_faced"],
                        "savePercentage": prevention["save_percentage"],
                        "totalInterventions": prevention["total_interventions"],
                        "byInterventionType": check_total(
                            {
                                t: prevention["by_intervention_type"][s]
                                for t, s in _INTERVENTION_TYPES.items()
                            },
                            "InterventionTypeCounts", f"InterventionTypeCounts[{side}]"),
                        "byBodyType": prevention["by_body_type"],
                    },
                    "GoalPrevention", f"GoalPrevention[{side}]"),
                "aerialControl": check_total(
                    {
                        "totalInterventions": aerial["total_interventions"],
                        "punches": _completion_counts(aerial["punches"],
                                                      f"aerial.punches[{side}]"),
                        "claims": _completion_counts(aerial["claims"],
                                                     f"aerial.claims[{side}]"),
                        "tippedPalmed": _completion_counts(aerial["tipped_palmed"],
                                                           f"aerial.tippedPalmed[{side}]"),
                        "crossesFacedAttempted": aerial["crosses_faced_attempted"],
                        "crossesFacedCompleted": aerial["crosses_faced_completed"],
                        "deliveryTypesFaced": check_total(
                            {t: aerial["delivery_types_faced"][s]
                             for t, s in _DELIVERY_TYPES_FACED.items()},
                            "CrossDeliveryTypeCounts", f"deliveryTypesFaced[{side}]"),
                    },
                    "AerialControl", f"AerialControl[{side}]"),
            },
            "TeamGoalkeeping", f"TeamGoalkeeping[{side}]",
        ))
    return out


# ------------------------------------------------------------------------------ Domain D
def build_shots(match: "dict") -> "list[dict]":
    """`events.shots[]`.

    Five staged keys have no destination and are DROPPED: `linked`, `ordinal`, `source`,
    `shirt_number`, `time_raw`. `ShotEvent` is `additionalProperties: false` over exactly
    twelve properties, and `check_total` catches all five — including `linked` and
    `ordinal`, which a no-underscore check cannot see.

    `expectedGoals` is null on 2,571/2,571: required-but-nullable, and the ledger rules
    that a shot tooltip must not promise it.
    """
    domains = match["domains"]
    n_periods = periods_played(match)
    out: list[dict] = []
    for side in ("home", "away"):
        team_id = match["spine"][f"{side}_team_id"]
        rows = sorted([s for s in domains["shots"]["shot_events"] if s["team_id"] == team_id],
                      key=lambda s: s["ordinal"])
        for row, period in zip(rows, assign_shot_periods(rows, n_periods)):
            out.append(check_total(
                {
                    "teamId": row["team_id"],
                    "playerId": row["player_id"],
                    "playerName": row["player_name"],
                    "at": shot_minute_stamp(row["time_raw"], period),
                    "x": row["x"],
                    "y": row["y"],
                    "outcome": row["outcome"],
                    "outcomeDetail": row["outcome_detail"],
                    "bodyPart": row["body_part"],
                    "deliveryType": row["delivery_type"],
                    "expectedGoals": row["expected_goals"],
                    "ownGoal": row["own_goal"],
                },
                "ShotEvent", f'ShotEvent[{match["spine"]["match_id"]}/{row["ordinal"]}]',
            ))
    return out


def build_pass_network_edges(match: "dict") -> "list[dict]":
    """`events.passNetworkEdges[]`.

    NO dedup ever: a reciprocal pair is two edges, and 6,835 corpus pairs print different
    volumes in the two directions. `teamId` comes from the side key, not the edge.
    `from_name`/`to_name`/`from_shirt`/`to_shirt` are dropped — `PassNetworkEdge` is
    `additionalProperties: false` over exactly four properties.
    """
    out: list[dict] = []
    for side in ("home", "away"):
        team_id = match["spine"][f"{side}_team_id"]
        for edge in match["domains"]["pass_network"][side]["edges"]:
            out.append(check_total(
                {
                    "teamId": team_id,
                    "fromPlayerId": edge["from_player_id"],
                    "toPlayerId": edge["to_player_id"],
                    "volume": edge["volume"],
                },
                "PassNetworkEdge", "PassNetworkEdge",
            ))
    return out


def build_events(match: "dict") -> "dict":
    """`events` — two tables populated, five declared `null`.

    Every `null` below is a DECLARED null with its reason, never a fall-through. `[]` is
    equally legal and means something different (decision 9), and jsonschema will not tell
    you which one you wrote. On `passNetworkNodes` the wrong one is not merely wrong: a
    `null` node table with populated edges makes the App's tactical sections render empty,
    while `[]` with populated edges THROWS inside `TacticalErrorBoundary`.

    **The two POPULATED tables raise rather than emit `[]`.** A zero-row shots or
    pass-network table is an extraction defect, not a fact about a football match: both
    pages exist on 208/208 team-innings, so `[]` here would be the third meaning — "zero
    events occurred" — asserted from an absence of evidence. Ruled in code review: raise,
    which is assert-on-unknown (AD-8) and the same treatment every other missing source
    gets. `null` was rejected because it would claim the report does not carry a page that
    demonstrably does.
    """
    match_id = match["spine"]["match_id"]
    shots = build_shots(match)
    edges = build_pass_network_edges(match)
    for label, rows in (("events.shots", shots), ("events.passNetworkEdges", edges)):
        if not rows:
            raise EmitError(
                f"{label} built 0 rows; the source page exists on 208/208 team-innings, so "
                f"an empty table is an extraction defect rather than a match with no such "
                f"events, and it must not ship as [] meaning 'zero occurred'",
                match_id,
            )
    return check_total(
        {
            "shots": shots,
            # The spine stages `shootout_attempts: None` on 104/104; PMSR prints only the
            # aggregate cover line, which belongs in `knockoutScore.shootoutScore`.
            "shootoutAttempts": None,
            # `deliveryType` is null on 2,608/2,608 and `playerId`/`playerName`/`at` have
            # no carrier at all — four non-nullable required fields unfulfillable.
            "crosses": None,
            # Five of seven required fields are available; `x`/`y` are `PitchX`/`PitchY`
            # with no null branch and there are 0 pitch frames on 208/208 pages.
            "passNetworkNodes": None,
            "passNetworkEdges": edges,
            # No events at all: the family stages values, not events. The 11 decoration
            # circles are a static formation template and Domain G's per-player offers
            # rows are match aggregates with no clock and no coordinates.
            "receiving": None,
            # `contest_type` being null on 20,169/20,169 is NOT the blocker (it is
            # required-but-nullable and the contract expects null unless the action is a
            # possession-contest). The three unfulfillable fields are `playerId`,
            # `playerName` and `at`.
            "defensiveActions": None,
        },
        "EventTables", "EventTables",
    )


def build_momentum(match: "dict") -> "dict | None":
    """`momentum` — the series object or `null`; `[]` is not representable.

    `MomentumSeries.samples` carries `minItems: 1`, and `MomentumSeries` is
    `additionalProperties: false` over `{samples}` alone — so `axis_top_label`,
    `full_time_index` and `extra_time` are dropped, exactly as `momentum.py`'s note to this
    story asks.
    """
    samples = match["domains"]["momentum"]["samples"]
    if not samples:
        # UNREACHABLE, and deliberately so rather than by accident. `momentum: null` is a
        # legal contract state with a shipped App empty state, but this pipeline cannot
        # produce it: `periods_played` reads the same series to derive the period structure
        # and raises first, because without that clock RULED D4 cannot decompose a single
        # shot stamp. So a momentum-less match is a corpus-level abort, not a null series —
        # the branch is kept because the schema models the state and a successor source
        # might carry it.
        return None
    return check_total(
        {
            "samples": [
                check_total(
                    {
                        "at": _stamp({"minute": s["minute"],
                                      "stoppage_minute": s["stoppage_minute"]}),
                        "home": s["home"],
                        "away": s["away"],
                    },
                    "MomentumSample", "MomentumSample",
                )
                for s in samples
            ]
        },
        "MomentumSeries", "MomentumSeries",
    )


# --------------------------------------------------------------------------- the assembly
def round_bundle(node, decimals: "dict[str, int]", places: "int | None" = None,
                 by_key: "dict[str, int] | None" = None):
    """Apply `x-decimals` across a built bundle, once, at the emit boundary.

    Precision is bound per KEY: a leaf is rounded to what its own contract type declares,
    and a key the table does not name is rounded by NOTHING.

    **An earlier version let a leaf inherit its parent's binding, and that silently
    truncated a whole domain.** `home`/`away` are bound to `Count` because they are the
    numeric members of a `TeamScore` and a `MomentumSample` — but they are ALSO the side
    keys of `keyStatistics`, `storyStats`, `tacticalIdentity`, `setPlays` and `lineups`.
    Inheritance carried `Count`'s 0 places down through `tacticalIdentity.home` into all 29
    leaves below it, every one of which declares 1 (`Percentage` or `Metres`), so
    `lineHeight: 19.5` emitted as `20` and validated clean because both types are
    `type: number`. No corpus value was fractional, so nothing was visibly wrong — which is
    precisely the unfalsifiable failure this module exists to prevent. Binding every leaf
    key explicitly makes an unnamed key round nothing, which is what
    `test_every_numeric_leaf_key_is_bound_to_its_schema_declared_precision` asserts against
    the schema itself rather than against this table.
    """
    if by_key is None:
        by_key = precision_by_key(decimals)
    if isinstance(node, dict):
        return {k: round_bundle(v, decimals, by_key.get(k), by_key)
                for k, v in node.items()}
    if isinstance(node, list):
        return [round_bundle(v, decimals, places, by_key) for v in node]
    if places is None:
        return node
    return round_to_precision(node, places)


# Instance-path binding: which declared precision each leaf key carries. Built from the
# contract's own `$ref` targets rather than transcribed — the names come from
# `decimals_map`, and this table only says which bundle KEY resolves to which name.
_KEY_TO_DEF = {
    # PitchX / PitchY
    "x": "PitchX", "y": "PitchY",
    # ExpectedGoals
    "expectedGoals": "ExpectedGoals",
    # Kilometres
    "distanceCovered": "Kilometres", "sprintDistance": "Kilometres",
    # Percentage
    "possession": "Percentage", "passCompletion": "Percentage",
    "contestedPossession": "Percentage", "lineBreakCompletion": "Percentage",
    "savePercentage": "Percentage",
    # Metres
    "totalDistance": "Metres", "distanceZone1": "Metres", "distanceZone2": "Metres",
    "distanceZone3": "Metres", "distanceZone4": "Metres", "distanceZone5": "Metres",
    # KmPerHour
    "topSpeed": "KmPerHour",
    # Minute / StoppageMinute / counts
    "minute": "Minute", "stoppageMinute": "StoppageMinute",
    "shirtNumber": "ShirtNumber", "matchNumber": "MatchNumber",
    "volume": "PassNetworkEdgeVolume", "order": "ShootoutOrder",
    # Every remaining numeric leaf in a bundle is a `Count`. Bound explicitly rather than
    # by a default, so an unrecognised key rounds NOTHING and shows up as an unrounded
    # float in the precision test instead of being silently coerced to an integer.
    "goals": "Count", "shots": "Count", "shotsOnTarget": "Count", "passes": "Count",
    "passesCompleted": "Count", "completedLineBreaks": "Count",
    "defensiveLineBreaks": "Count", "receptionsInFinalThird": "Count", "crosses": "Count",
    "ballProgressions": "Count", "defensivePressures": "Count", "directPressures": "Count",
    "forcedTurnovers": "Count", "secondBalls": "Count", "passesAttempted": "Count",
    "switchesOfPlay": "Count", "crossesAttempted": "Count", "crossesCompleted": "Count",
    "lineBreaksAttempted": "Count", "lineBreaksCompleted": "Count", "takeOns": "Count",
    "stepIns": "Count", "attemptsAtGoal": "Count", "totalOffers": "Count",
    "offersReceived": "Count", "inFront": "Count", "inBetween": "Count",
    "outToIn": "Count", "inToOut": "Count", "inBehind": "Count", "noMovement": "Count",
    "tacklesMade": "Count", "tacklesWon": "Count", "blocks": "Count",
    "interceptions": "Count", "pressingDirect": "Count", "pressingIndirect": "Count",
    "duelsWonAerial": "Count", "duelsWonPhysical": "Count",
    "possessionContestsWon": "Count", "clearances": "Count",
    "looseBallReceptions": "Count", "pushingOn": "Count",
    "pushingOnIntoPressing": "Count", "possessionRegains": "Count",
    "possessionInterrupted": "Count", "highSpeedRuns": "Count", "sprints": "Count",
    "totalSetPlays": "Count", "totalFreeKicks": "Count", "totalPenalties": "Count",
    "totalCorners": "Count", "totalThrowIns": "Count", "left": "Count", "right": "Count",
    "total": "Count", "direct": "Count", "directOnTarget": "Count",
    "directOffTarget": "Count", "indirect": "Count", "inswing": "Count",
    "outswing": "Count", "driven": "Count", "lofted": "Count",
    # Domain E counts (CS-2's per-team `GoalkeepingBlock`).
    "totalInvolvements": "Count", "involvements": "Count", "attemptsFaced": "Count",
    "totalInterventions": "Count", "lineBreaks": "Count", "crossesFacedAttempted": "Count",
    "complete": "Count", "incomplete": "Count",
    "saveAndRetain": "Count", "saveAndDeflect": "Count", "deflectAndRetain": "Count",
    "saveAttempt": "Count", "noSaveAttempt": "Count",
    "cutback": "Count", "pushCross": "Count",
    # TeamScore and MomentumSample members. `home`/`away` are numeric ONLY here — everywhere
    # else in a bundle they are side keys holding objects, and nothing inherits through them.
    "home": "Count", "away": "Count",
    # Domain C percentages (CS-2). `phasesInPossession` (8) + `phasesOutOfPossession` (9)
    # + `defensiveBlockDistribution` (3), every one a `Percentage`.
    "buildUpUnopposed": "Percentage", "buildUpOpposed": "Percentage",
    "progression": "Percentage", "finalThird": "Percentage", "setPiece": "Percentage",
    "counterAttack": "Percentage", "longBall": "Percentage",
    "attackingTransition": "Percentage", "defensiveTransition": "Percentage",
    "highPress": "Percentage", "midPress": "Percentage", "lowPress": "Percentage",
    "counterPress": "Percentage", "recovery": "Percentage",
    "highBlock": "Percentage", "midBlock": "Percentage", "lowBlock": "Percentage",
    "high": "Percentage", "mid": "Percentage", "low": "Percentage",
    # Domain C metres (CS-2's `ShapeByPhase`): three measures per panel, six panels.
    "lineHeight": "Metres", "teamLength": "Metres", "teamWidth": "Metres",
}


def precision_by_key(decimals: "dict[str, int]") -> "dict[str, int]":
    """Which declared precision each bundle key carries.

    The NAMES come from `decimals_map`, which derives them from the schema; this table only
    records which bundle key resolves to which name. That split is what keeps the precision
    values themselves out of Python — a hardcoded copy of the values would go stale on the
    next `$def`, which is exactly what `contract/README.md` warns against.

    **Every name must resolve.** Silently dropping an unresolved one (`if name in decimals`)
    would mean a renamed or deleted `$def` quietly unbinds every key that pointed at it,
    shipping them unrounded while `decimals_map`'s own vacuity guard stays green on the
    surviving float types.
    """
    unresolved = sorted({name for name in _KEY_TO_DEF.values() if name not in decimals})
    if unresolved:
        raise EmitError(
            f"precision binding names {unresolved!r}, which the schema-derived map does not "
            f"carry (it has {sorted(decimals)!r}); every bound key would ship unrounded"
        )
    return {key: decimals[name] for key, name in _KEY_TO_DEF.items()}


def build_bundle(match_spine: "dict", entities: "dict", decimals: "dict[str, int]") -> "dict":
    """One complete Match Bundle from one staged spine file.

    All eleven required root keys. `tacticalIdentity` and `goalkeeping` were blocked until
    change-set CS-2 (logged decision 18) reshaped `PossessionSplitMetres` into the
    per-phase panels the corpus actually prints and made `GoalkeepingBlock` per-team with
    the five unfulfillable sub-fields nullable.
    """
    codes = {t["team_id"]: t["team_code"] for t in entities["teams"]}
    spine = match_spine["spine"]
    key_statistics = build_key_statistics(match_spine)
    players = build_players(match_spine)

    bundle = {
        "schemaVersion": schema_version(),
        "matchId": spine["match_id"],
        "metadata": build_metadata(match_spine, entities, codes),
        "storyStats": build_story_stats(key_statistics, players, spine["home_team_id"],
                                        spine["away_team_id"], spine["match_id"]),
        "momentum": build_momentum(match_spine),
        "keyStatistics": key_statistics,
        "tacticalIdentity": build_tactical_identity(match_spine),
        "events": build_events(match_spine),
        "goalkeeping": build_goalkeeping(match_spine),
        "setPlays": build_set_plays(match_spine),
        "players": players,
    }
    return round_bundle(bundle, decimals)


# ---------------------------------------------------------------------------------- CLI
def _read_json(path: Path) -> "dict":
    """One staged JSON file, with a malformed one reported as a HARNESS failure.

    `json.JSONDecodeError` is a `ValueError`, so an unhandled one escapes `main`'s
    `PipelineError`/`OSError` handlers, prints a traceback and exits 1 — reporting "the
    harness could not run" as "a dataset finding", which is the exact inversion
    `errors.py`'s exit-code contract exists to prevent. A file this module cannot parse is
    an input it cannot read, so it is raised as `OSError` and reported as exit 2.
    """
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise OSError(f"{path.as_posix()} is not readable JSON: {exc}") from None


# The staged spine keys every bundle depends on. Not a schema — a shape assertion at the
# boundary, so a record staged by an older checkout fails as a typed error naming the
# missing path instead of as a bare `KeyError` from whichever mapper happened to reach it
# first. `deferred-work.md` routed this here by name ("Story 1.16 is the natural point,
# since it is the first consumer that reads staged records it did not write") and Task 11.2
# offered a guard or a re-file; the guard was ruled.
_REQUIRED_SPINE_KEYS = ("match_id", "matchday_round", "home_team_id", "away_team_id")
_REQUIRED_DOMAINS = ("match_metadata", "key_statistics", "tactical_identity", "momentum",
                     "shots", "pass_network", "goalkeeping", "set_plays", "player_stats")


def check_spine_shape(match_spine: "dict", where: str) -> "dict":
    """Assert one staged match spine carries the keys the emitter reads by subscript."""
    spine = match_spine.get("spine")
    if not isinstance(spine, dict):
        raise UnmappedFieldError(f"{where}: staged record has no 'spine' block")
    missing = [k for k in _REQUIRED_SPINE_KEYS if k not in spine]
    if missing:
        raise UnmappedFieldError(f"{where}: spine is missing {missing!r}")
    domains = match_spine.get("domains")
    if not isinstance(domains, dict):
        raise UnmappedFieldError(f"{where}: staged record has no 'domains' block")
    absent = [k for k in _REQUIRED_DOMAINS if k not in domains]
    if absent:
        raise UnmappedFieldError(
            f"{where}: domains is missing {absent!r}; the record was staged by a different "
            f"checkout than this emitter reads"
        )
    return match_spine


def load_spine(spine_dir: "str | Path") -> "tuple[dict, list[dict]]":
    """`(entities, [match spine, ...])` read from a staged spine directory.

    Each record's shape is asserted at load, so a stale or truncated record is a typed
    failure naming the file rather than a `KeyError` surfacing from inside a mapper.
    """
    root = Path(spine_dir)
    entities_path = root / "entities.json"
    if not entities_path.is_file():
        raise OSError(f"no entities.json under {root.as_posix()}")
    entities = _read_json(entities_path)
    if not isinstance(entities.get("teams"), list) or not isinstance(
            entities.get("matches"), list):
        raise UnmappedFieldError(
            f"{entities_path.as_posix()}: entities must carry 'teams' and 'matches' lists"
        )
    matches = [check_spine_shape(_read_json(p), p.name)
               for p in sorted((root / "matches").glob("*.json"))]
    return entities, matches


def emit_bundles(spine_dir: "str | Path" = DEFAULT_SPINE_DIR,
                 data_dir: "str | Path" = DEFAULT_DATA_DIR,
                 dry_run: bool = False,
                 expect_matches: "int | None" = None) -> "list[Path]":
    """Build, validate, measure and write every Match Bundle. All 104 or none.

    Building, validation, rounding, the budget measurement AND the expected-count check all
    happen BEFORE the first byte is written, so a failure anywhere leaves `data/matches/`
    exactly as it was rather than partial.

    **`expect_matches` is checked here, not by the caller, and that is load-bearing.** The
    stale sweep below deletes every bundle this run did not produce, so a count check made
    after `emit_bundles` returns is made after the deletion: a truncated spine, a
    `precompute.run` that stopped early or a mistyped `--spine-dir` would write what it had,
    delete the rest of the committed corpus, and only then report the miss. That is
    landmine 14 — `check_committed_data` pinning a partial namespace as the immutability
    baseline — reached from the one direction the "all 104 or none" rule did not cover.

    Building is COLLECTED like validation and the budget rather than aborting on the first
    failure. The failure policy names all three classes together: "Aborting on the first
    turns one run into ten."
    """
    entities, matches = load_spine(spine_dir)
    decimals = decimals_map(BUNDLE_SCHEMA)
    out_dir = Path(data_dir) / "matches"

    built: list[tuple[str, str]] = []
    failures: list[str] = []
    violations: list[str] = []
    breaches: list[tuple[str, int, int]] = []
    seen_ids: dict[str, int] = {}

    for match in matches:
        match_id = match["spine"]["match_id"]
        seen_ids[match_id] = seen_ids.get(match_id, 0) + 1
        try:
            bundle = build_bundle(match, entities, decimals)
        except PipelineError as exc:
            failures.append(f"{match_id}: {exc}")
            continue
        try:
            validate_artifact(bundle, BUNDLE_SCHEMA, instance_label=match_id)
        except SchemaValidationError as exc:
            violations.append(f"{match_id}: {exc}")
            continue
        text = canonical_json(bundle)
        breach = over_budget(match_id, text)
        if breach is not None:
            breaches.append(breach)
        built.append((match_id, text))

    # Two spine files carrying one match id write one bundle and count two, so a duplicate
    # would satisfy `--expect-matches` while the corpus is short. The id is the filename.
    duplicates = sorted(mid for mid, n in seen_ids.items() if n > 1)
    if duplicates:
        raise EmitError(
            f"{len(duplicates)} match id(s) are staged more than once and would overwrite "
            f"each other: {duplicates[:10]!r}{' …' if len(duplicates) > 10 else ''}"
        )

    if failures:
        shown = "; ".join(sorted(failures)[:10])
        raise EmitError(
            f"{len(failures)} bundle(s) could not be built: {shown}"
            f"{' …' if len(failures) > 10 else ''}"
        )
    if violations:
        shown = "; ".join(sorted(violations)[:10])
        raise BundleValidationError(
            f"{len(violations)} bundle(s) failed the /contract schema: {shown}"
            f"{' …' if len(violations) > 10 else ''}"
        )
    if breaches:
        shown = "; ".join(
            f"{label} {gz} gzip-9 bytes over canonical {raw} (budget {BUDGET_BYTES})"
            for label, gz, raw in sorted(breaches)[:10]
        )
        raise BudgetExceededError(
            f"{len(breaches)} bundle(s) breached the {BUDGET_BYTES}-byte payload budget: "
            f"{shown}{' …' if len(breaches) > 10 else ''}. SM-C2: resolve by splitting or "
            f"by a logged budget decision, NEVER by dropping fields, truncating an array "
            f"or lowering a precision to fit."
        )

    # BEFORE the first byte and before the stale sweep, so a short spine never reaches the
    # committed tree at all. Emitting zero is a FAIL on both paths, dry run included —
    # run.py:141-147's precedent, which a `not dry_run` guard would have skipped on exactly
    # the invocation most likely to be pointed at the wrong directory.
    if not built:
        raise EmitError("no bundle was built; an empty run is never a pass")
    if expect_matches is not None and len(built) != expect_matches:
        raise EmitError(f"built {len(built)} bundle(s), expected {expect_matches}")

    # The paths this run accounts for, in both modes. A dry run writes NOTHING — that is a
    # promise about the filesystem, not about the return value — so it returns the targets it
    # validated and measured rather than an empty list that would make every count check
    # downstream read as a miss.
    targets = [out_dir / f"{match_id}.json" for match_id, _text in built]
    if dry_run:
        return targets

    written: list[Path] = []
    for match_id, text in built:
        target = out_dir / f"{match_id}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        write_canonical(json.loads(text), target)
        written.append(target)

    # Delete stale bundles this run did not produce. `write_spine` does the same for the
    # phantom-match hazard; here the reason is sharper — a match id that ever changed would
    # leave an orphan that `check_committed_data` then PINS as the immutability baseline.
    keep = {p.name for p in written}
    for existing in sorted(out_dir.glob("*.json")):
        if existing.name not in keep:
            existing.unlink()
    return written


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.precompute.emit",
        description="Emit one schema-valid Match Bundle per match from the staged spine.",
    )
    parser.add_argument("--spine-dir", default=str(DEFAULT_SPINE_DIR),
                        help="staged spine to consume (default work/spine)")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR),
                        help="where bundles are written (default data)")
    parser.add_argument("--expect-matches", type=int, default=None, metavar="N",
                        help="assert exactly N bundles are emitted (use 104)")
    parser.add_argument("--dry-run", action="store_true",
                        help="validate and measure, write nothing")
    return parser


def main(argv: "list[str] | None" = None) -> int:
    args = build_parser().parse_args(argv)

    # Without this a PDF-derived name crashes a redirected Windows console and destroys the
    # exit code's meaning. Same reasoning as run.py:107-109.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")

    print("")
    print("Match Bundle emission")
    print("=" * 21)
    print(f"spine dir       : {Path(args.spine_dir).as_posix()}")
    print(f"data dir        : {Path(args.data_dir).as_posix()}")
    print(f"schemaVersion   : {schema_version()}")

    try:
        written = emit_bundles(args.spine_dir, args.data_dir, dry_run=args.dry_run,
                               expect_matches=args.expect_matches)
    except PipelineError as exc:
        print("")
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    except (OSError, AssertionError) as exc:
        # `AssertionError` is `decimals_map`'s vacuity guard: the schema resolved to no float
        # precision at all, which is a broken checkout rather than a finding about the data.
        print("")
        print(f"emission could not run: {exc}", file=sys.stderr)
        return 2

    # The empty and expected-count checks live inside `emit_bundles`, ahead of the write and
    # the stale sweep — see its docstring. A dry run returns the targets it validated rather
    # than an empty list, so `--dry-run --expect-matches 104` means what it says instead of
    # failing by construction on every clean corpus.
    count = len(written)
    print(f"bundles         : {count}{' (dry run, nothing written)' if args.dry_run else ''}")

    print("")
    print("EMIT RESULT: PASS")
    print("")
    return 0


if __name__ == "__main__":
    sys.exit(main())

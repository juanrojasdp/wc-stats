"""Matchday-round derivation into a closed set.

The stratification's second cover is "at least one report per matchday round", so every
report must land in exactly one of:

    group-md1 group-md2 group-md3 r32 r16 qf sf third-place final

Knockout rounds come straight from the stage line the cover prints. Group matchdays are
*not* printed in a usable form — `spike/mex_rsa.pdf` prints "Group A - Match 1", which is
a match number within the group (1..6), not a matchday (1..3) — so they are derived.

Derivation rule (deterministic, corpus-level):
  sort each group's matches by (date, kick-off, report id), then walk them in order,
  assigning each match `1 + max(matches already played by the home team, by the away
  team)`. In a round-robin every team plays once per matchday, so this yields 1, 2, 3
  and — unlike grouping by calendar date — stays correct when the two fixtures of one
  matchday fall on different days, which happens in the 2026 group stage.

The rule is only valid on a *complete* group. It counts matches relative to the reports
in hand, so on a partial corpus it cannot tell "matchday 1" from "the first match of this
team I happen to hold" — a corpus containing only a group's MD2 and MD3 fixtures would
label them md1 and md2 and report no problem at all. Since this gate is re-run
incrementally by Stories 1.5-1.14, and the corpus may arrive in pieces, a group is
therefore only derived when it holds all `GROUP_MATCHES_PER_GROUP` of its fixtures;
otherwise every report in it is left unassigned and the shortfall is reported.

Anything the rule cannot place (an unrecognized stage, an incomplete group, a derived
matchday above 3) is returned as a problem for the caller to record as a deviation.
Nothing is guessed.
"""

from __future__ import annotations

from collections import Counter, defaultdict

from pipeline.discover.probe import ReportMeta

GROUP_ROUNDS: tuple[str, ...] = ("group-md1", "group-md2", "group-md3")
KNOCKOUT_ROUNDS: tuple[str, ...] = ("r32", "r16", "qf", "sf", "third-place", "final")
ROUNDS: tuple[str, ...] = GROUP_ROUNDS + KNOCKOUT_ROUNDS

MAX_GROUP_MATCHDAY = len(GROUP_ROUNDS)
# A 4-team round-robin group: 3 matchdays x 2 fixtures.
GROUP_MATCHES_PER_GROUP = 6

# Order matters: "Quarter-final", "Semi-final" and "Bronze final" all contain "final",
# so the specific rounds must be tested before the bare "final".
#
# "Bronze final" is FIFA's own wording for the third-place play-off — confirmed against
# the real 104-report corpus (2026-07-22), where it is the stage line of match 103. It
# contains "final" but neither "third place" nor "3rd place", so without "bronze" here it
# is silently classified as the final and the third-place round vanishes from the corpus.
_KNOCKOUT_KEYWORDS: tuple[tuple[tuple[str, ...], str], ...] = (
    (("third place", "3rd place", "bronze"), "third-place"),
    (("round of 32", "round of thirty-two"), "r32"),
    (("round of 16", "round of sixteen"), "r16"),
    (("quarter",), "qf"),
    (("semi",), "sf"),
    (("final",), "final"),
)


def knockout_round_from_stage(stage_text: str) -> str | None:
    """Map a printed stage line to a knockout round, or `None` if it is not one."""
    lowered = " ".join(stage_text.lower().replace("-", " ").split())
    for keywords, round_id in _KNOCKOUT_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return round_id
    return None


def assign_matchday_rounds(
    metas: "list[ReportMeta]",
) -> tuple[list[ReportMeta], list[tuple[str, str]]]:
    """Return the reports with `matchday_round` filled in, plus unresolved problems.

    Problems are `(report_id, reason)` pairs; the corresponding report keeps
    `matchday_round is None` and is excluded from the matchday cover.
    """
    import dataclasses

    problems: list[tuple[str, str]] = []
    assigned: dict[str, str | None] = {}

    group_matches: dict[str, list[ReportMeta]] = defaultdict(list)
    for meta in metas:
        if meta.group is not None:
            group_matches[meta.group].append(meta)
            continue
        round_id = knockout_round_from_stage(meta.stage_text)
        if round_id is None:
            problems.append(
                (meta.report_id, f"unrecognized stage line: {meta.stage_text!r}")
            )
        assigned[meta.report_id] = round_id

    for group in sorted(group_matches):
        members = group_matches[group]
        if len(members) != GROUP_MATCHES_PER_GROUP:
            # Deriving from a partial group would assign confident, wrong matchdays.
            for meta in sorted(members, key=lambda m: m.report_id):
                problems.append(
                    (
                        meta.report_id,
                        f"group {group} holds {len(members)} of "
                        f"{GROUP_MATCHES_PER_GROUP} matches; matchday cannot be derived",
                    )
                )
                assigned[meta.report_id] = None
            continue

        played: Counter[str] = Counter()
        ordered = sorted(
            members,
            key=lambda m: (m.match_date, m.kickoff_sort_key, m.report_id),
        )
        for meta in ordered:
            matchday = 1 + max(played[meta.home_team], played[meta.away_team])
            played[meta.home_team] += 1
            played[meta.away_team] += 1
            if matchday > MAX_GROUP_MATCHDAY:
                problems.append(
                    (
                        meta.report_id,
                        f"derived group matchday {matchday} is outside 1..{MAX_GROUP_MATCHDAY} "
                        f"for group {group}",
                    )
                )
                assigned[meta.report_id] = None
            else:
                assigned[meta.report_id] = f"group-md{matchday}"

    updated = [
        dataclasses.replace(meta, matchday_round=assigned.get(meta.report_id))
        for meta in metas
    ]
    return updated, sorted(problems)

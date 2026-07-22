"""Declarative registry of PMSR section anchors.

Every anchor here was read off the ground-truth report `spike/mex_rsa.pdf` by walking all
52 pages and recording each page's normalized first-text snippet. Section titles embed
team names (the spike proved `"Attempts at Goal Mexico"`), so specs are *templates*
resolved with the teams the metadata probe learned — never hardcoded team names.

Placeholders:
  {team}  — spec is expanded twice, once per team (`per_team=True`)
  {home}, {away} — spec is expanded once, with both teams substituted

`at_page_start` marks an anchor that must *open* the page's normalized text rather than
merely appear in it. The section dividers need this: `"IN POSSESSION {home} v {away}"` is
a literal substring of `"INDIVIDUAL DATA IN POSSESSION {home} v {away}"`, so with plain
substring matching the individual-data divider silently satisfies the possession divider
and a removed section still reports clean.

Adding a domain page here automatically widens the template-consistency gate: the
anchor-coverage check walks whatever this list contains.
"""

from __future__ import annotations

import string
from dataclasses import dataclass


@dataclass(frozen=True)
class AnchorSpec:
    """A section anchor as a template plus the domain page family it identifies."""

    anchor_id: str
    template: str
    domain: str
    required: bool = True
    per_team: bool = False
    at_page_start: bool = False


@dataclass(frozen=True)
class ResolvedAnchor:
    """An `AnchorSpec` with the team placeholders substituted for one report."""

    anchor_id: str
    text: str
    domain: str
    required: bool
    at_page_start: bool = False


# Seeded from spike/mex_rsa.pdf (52 pages, 11 June 2026, Mexico v South Africa).
ANCHOR_REGISTRY: tuple[AnchorSpec, ...] = (
    AnchorSpec("cover", "POST MATCH SUMMARY REPORT", "metadata"),
    AnchorSpec("lineups", "Match Summary - Teams", "lineups"),
    AnchorSpec("key-statistics", "Match Summary - Key Statistics", "key-statistics"),
    AnchorSpec("phases-of-play", "{home} Phases of Play {away}", "phases-of-play"),
    AnchorSpec(
        "divider-in-possession",
        "IN POSSESSION {home} v {away}",
        "metadata",
        at_page_start=True,
    ),
    AnchorSpec(
        "in-possession-line-height",
        "In Possession Line Height & Team Length {team}",
        "line-height",
        per_team=True,
    ),
    AnchorSpec("line-breaks", "Line Breaks {team}", "line-breaks", per_team=True),
    AnchorSpec("pass-network", "Passing Networks {team}", "pass-network", per_team=True),
    AnchorSpec("shots", "Attempts at Goal {team}", "shots", per_team=True),
    AnchorSpec("crosses", "Crosses (Open Play) {team}", "crosses", per_team=True),
    AnchorSpec("offers", "Offering to Receive {team}", "offers", per_team=True),
    AnchorSpec("movement", "Movement to Receive {team}", "movement", per_team=True),
    AnchorSpec(
        "divider-out-of-possession",
        "OUT OF POSSESSION {home} v {away}",
        "metadata",
        at_page_start=True,
    ),
    AnchorSpec(
        "defensive-actions", "Defensive Actions {team}", "defensive-actions", per_team=True
    ),
    AnchorSpec(
        "defensive-line-height",
        "Defensive Line Height & Team Length {team}",
        "line-height",
        per_team=True,
    ),
    AnchorSpec(
        "defensive-pressure", "Defensive Pressure {home} {away}", "defensive-pressure"
    ),
    AnchorSpec(
        "divider-goalkeeping", "GOALKEEPING {home} v {away}", "metadata", at_page_start=True
    ),
    # One page carries both teams' involvement timelines, keyed by the home team.
    AnchorSpec("gk-involvement", "Goalkeeping Involvement {home}", "goalkeeping"),
    AnchorSpec(
        "gk-distribution", "Goalkeeping Distribution {team}", "goalkeeping", per_team=True
    ),
    AnchorSpec("goal-prevention", "Goal Prevention {team}", "goalkeeping", per_team=True),
    AnchorSpec("aerial-control", "Aerial Control {team}", "goalkeeping", per_team=True),
    AnchorSpec(
        "divider-set-plays", "SET PLAYS {home} v {away}", "metadata", at_page_start=True
    ),
    AnchorSpec("set-plays", "Set Plays {team}", "set-plays", per_team=True),
    AnchorSpec(
        "divider-individual-in-possession",
        "INDIVIDUAL DATA IN POSSESSION {home} v {away}",
        "metadata",
        at_page_start=True,
    ),
    AnchorSpec(
        "individual-distributions",
        "In Possession - Distributions {team}",
        "per-player",
        per_team=True,
    ),
    AnchorSpec(
        "individual-offers-receptions",
        "In Possession - Offers & Receptions {team}",
        "per-player",
        per_team=True,
    ),
    AnchorSpec(
        "divider-individual-out-of-possession",
        "INDIVIDUAL DATA OUT OF POSSESSION {home} v {away}",
        "metadata",
        at_page_start=True,
    ),
    AnchorSpec(
        "individual-out-of-possession",
        "Out of Possession {team}",
        "per-player",
        per_team=True,
    ),
    AnchorSpec(
        "divider-individual-physical",
        "INDIVIDUAL DATA PHYSICAL {home} v {away}",
        "metadata",
        at_page_start=True,
    ),
    AnchorSpec("physical-data", "Physical Data {team}", "physical", per_team=True),
)


def _placeholders(template: str) -> set[str]:
    """Placeholder names used by a template."""
    return {name for _, name, _, _ in string.Formatter().parse(template) if name}


def resolve_anchors(
    specs: "tuple[AnchorSpec, ...] | list[AnchorSpec]",
    home: str,
    away: str,
) -> list[ResolvedAnchor]:
    """Substitute team placeholders, expanding `per_team` specs into home/away pairs.

    Raises `KeyError` for a placeholder that is not `{team}`, `{home}` or `{away}`, and
    `ValueError` for a `{team}` placeholder on a spec that is not `per_team`. Both are
    authoring bugs, not report data, so they fail loudly at resolution time rather than
    surfacing as a phantom missing anchor across all 104 reports — a `{team}` left
    unexpanded would otherwise be formatted to the empty string, producing either a
    never-matching anchor or, worse, one so short it always matches.
    """
    resolved: list[ResolvedAnchor] = []
    for spec in specs:
        if spec.per_team:
            for side, team in (("home", home), ("away", away)):
                resolved.append(
                    ResolvedAnchor(
                        anchor_id=f"{spec.anchor_id}:{side}",
                        text=spec.template.format(team=team, home=home, away=away),
                        domain=spec.domain,
                        required=spec.required,
                        at_page_start=spec.at_page_start,
                    )
                )
        else:
            if "team" in _placeholders(spec.template):
                raise ValueError(
                    f"anchor {spec.anchor_id!r} uses {{team}} but is not per_team; "
                    "either set per_team=True or use {home}/{away}"
                )
            resolved.append(
                ResolvedAnchor(
                    anchor_id=spec.anchor_id,
                    text=spec.template.format(home=home, away=away),
                    domain=spec.domain,
                    required=spec.required,
                    at_page_start=spec.at_page_start,
                )
            )
    return resolved

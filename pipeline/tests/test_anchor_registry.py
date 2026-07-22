"""Task 2: the anchor registry resolves against the ground-truth report (AC 4, AC 5)."""

from __future__ import annotations

import pytest

from pipeline.discover.anchors import (
    ANCHOR_REGISTRY,
    AnchorSpec,
    resolve_anchors,
)
from pipeline.discover.errors import MissingAnchorError
from pipeline.discover.text import find_anchor_pages


def test_registry_is_non_empty_and_ids_unique():
    ids = [spec.anchor_id for spec in ANCHOR_REGISTRY]
    assert len(ids) > 20
    assert len(ids) == len(set(ids)), "duplicate anchor ids in the registry"


def test_registry_covers_every_domain_page_family():
    domains = {spec.domain for spec in ANCHOR_REGISTRY}
    expected = {
        "metadata",
        "lineups",
        "key-statistics",
        "phases-of-play",
        "line-height",
        "line-breaks",
        "pass-network",
        "shots",
        "crosses",
        "offers",
        "movement",
        "defensive-actions",
        "defensive-pressure",
        "goalkeeping",
        "set-plays",
        "per-player",
        "physical",
    }
    assert expected <= domains


def test_resolve_expands_team_templates():
    spec = AnchorSpec(
        anchor_id="shots",
        template="Attempts at Goal {team}",
        domain="shots",
        per_team=True,
    )
    resolved = resolve_anchors([spec], home="Mexico", away="South Africa")

    assert [r.anchor_id for r in resolved] == ["shots:home", "shots:away"]
    assert [r.text for r in resolved] == [
        "Attempts at Goal Mexico",
        "Attempts at Goal South Africa",
    ]


def test_resolve_expands_home_away_templates():
    spec = AnchorSpec(
        anchor_id="divider",
        template="IN POSSESSION {home} v {away}",
        domain="metadata",
    )
    resolved = resolve_anchors([spec], home="Mexico", away="South Africa")

    assert len(resolved) == 1
    assert resolved[0].text == "IN POSSESSION Mexico v South Africa"


def test_every_registered_anchor_resolves_on_mex_rsa(mex_rsa_pdf):
    """The gate's baseline: every seeded anchor is present in the ground-truth report."""
    import pymupdf

    resolved = resolve_anchors(ANCHOR_REGISTRY, home="Mexico", away="South Africa")
    unresolved = []
    with pymupdf.open(mex_rsa_pdf) as doc:
        for anchor in resolved:
            try:
                find_anchor_pages(
                    doc, anchor.text, report_id="mex_rsa", at_start=anchor.at_page_start
                )
            except MissingAnchorError:
                unresolved.append(anchor.text)

    assert unresolved == []


def test_registry_resolves_to_the_expected_anchor_count():
    """30 specs, 17 of them per_team -> 13 + 34 = 47 resolved anchors."""
    per_team = sum(1 for spec in ANCHOR_REGISTRY if spec.per_team)
    resolved = resolve_anchors(ANCHOR_REGISTRY, home="Mexico", away="South Africa")

    assert len(ANCHOR_REGISTRY) == 30
    assert per_team == 17
    assert len(resolved) == len(ANCHOR_REGISTRY) + per_team == 47


def test_divider_anchor_is_not_satisfied_by_a_longer_title_containing_it(mex_rsa_pdf):
    """'IN POSSESSION X v Y' is a substring of 'INDIVIDUAL DATA IN POSSESSION X v Y'.

    Without page-start matching the individual-data divider silently satisfies the
    possession divider, and deleting the possession section still reports clean.
    """
    import pymupdf

    text = "IN POSSESSION Mexico v South Africa"
    with pymupdf.open(mex_rsa_pdf) as doc:
        loose = find_anchor_pages(doc, text, at_start=False)
        strict = find_anchor_pages(doc, text, at_start=True)

    assert len(loose) > len(strict)
    assert len(strict) == 1

    spec = next(s for s in ANCHOR_REGISTRY if s.anchor_id == "divider-in-possession")
    assert spec.at_page_start is True


def test_unknown_template_placeholder_is_rejected():
    spec = AnchorSpec(anchor_id="bad", template="Something {venue}", domain="metadata")
    with pytest.raises(KeyError):
        resolve_anchors([spec], home="Mexico", away="South Africa")


def test_team_placeholder_without_per_team_is_rejected():
    """Formatting {team} to '' would produce a phantom or always-matching anchor."""
    spec = AnchorSpec(anchor_id="oops", template="Line Breaks {team}", domain="line-breaks")

    with pytest.raises(ValueError, match="per_team"):
        resolve_anchors([spec], home="Mexico", away="South Africa")


def test_optional_anchors_are_not_reported_as_missing(tmp_path):
    """The `required=False` path is what the first real corpus run will lean on."""
    import pymupdf

    from pipeline.discover.probe import ReportMeta
    from pipeline.validate.checks import _check_anchor_coverage

    doc = pymupdf.open()
    doc.new_page(width=960, height=540).insert_text((80, 100), "Nothing useful", fontsize=18)
    doc.save(tmp_path / "bare.pdf")
    doc.close()

    import datetime as dt

    meta = ReportMeta(
        report_id="bare",
        source_path=str(tmp_path / "bare.pdf"),
        home_team="Mexico",
        away_team="South Africa",
        home_score=0,
        away_score=0,
        stage_text="Final",
        group=None,
        match_date=dt.date(2026, 6, 11),
        kickoff="13:00",
        venue="V",
    )

    optional = AnchorSpec("opt", "Never Present Here", "metadata", required=False)
    required = AnchorSpec("req", "Also Never Present", "metadata")

    import pipeline.validate.checks as checks_module

    with pymupdf.open(tmp_path / "bare.pdf") as opened:
        original = checks_module.ANCHOR_REGISTRY
        checks_module.ANCHOR_REGISTRY = (optional, required)
        try:
            found = _check_anchor_coverage(opened, meta)
        finally:
            checks_module.ANCHOR_REGISTRY = original

    assert [d["specifics"] for d in (x.to_dict() for x in found)] == [
        "anchor 'req' (domain 'metadata') not found: 'Also Never Present'"
    ]

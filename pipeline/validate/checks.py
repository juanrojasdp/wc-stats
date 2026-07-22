"""The check registry — the seam every later extraction story plugs into.

A check is a triple: an id, a predicate deciding which reports it applies to, and a
runner returning the deviations it found. Checks are registered in one module-level list;
the verification runner, the sample selection and the report format never need to change
when a new one arrives. That is what makes the gate cheap to re-run as the standing
acceptance criterion of Stories 1.5-1.14.

Registered here today:
  anchor-coverage  every registered section anchor resolves in the report
  metadata-probe   the report's stratification keys are complete

Later stories add, for example:
  1.3   shots-parse, shots-count-match   (count-mismatch, unknown-rgb)
  1.5   marker-event-link-rate           (count-mismatch)
  1.6+  per-domain extractor checks
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.errors import MissingAnchorError
from pipeline.discover.text import PageTextIndex
from pipeline.discover.probe import ReportMeta
from pipeline.validate.deviations import Deviation, DeviationCategory

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf


@dataclass(frozen=True)
class Check:
    """One registered verification check."""

    check_id: str
    applies_to: Callable[[ReportMeta], bool]
    run: Callable[["pymupdf.Document", ReportMeta], list[Deviation]]


CHECK_REGISTRY: list[Check] = []


def register_check(check: Check) -> Check:
    """Add a check to the registry. Duplicate ids are an authoring bug, so they raise."""
    if any(existing.check_id == check.check_id for existing in CHECK_REGISTRY):
        raise ValueError(f"check id already registered: {check.check_id!r}")
    CHECK_REGISTRY.append(check)
    return check


def registered_checks() -> list[Check]:
    """Registered checks in a stable order, so report content never depends on imports."""
    return sorted(CHECK_REGISTRY, key=lambda check: check.check_id)


def _check_anchor_coverage(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Every registered anchor must resolve to at least one page (AD-8, AC 4)."""
    deviations: list[Deviation] = []

    def record(specifics: str) -> None:
        deviations.append(
            Deviation(
                report_id=meta.report_id,
                check="anchor-coverage",
                category=DeviationCategory.MISSING_ANCHOR,
                specifics=specifics,
            )
        )

    index = PageTextIndex(doc, report_id=meta.report_id)
    resolved_pages: dict[str, list[int]] = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        try:
            resolved_pages[anchor.anchor_id] = index.find_all(
                anchor.text, at_start=anchor.at_page_start
            )
        except MissingAnchorError as exc:
            if not anchor.required:
                continue
            record(
                f"anchor {anchor.anchor_id!r} (domain {anchor.domain!r}) "
                f"not found: {exc.anchor_text!r}"
            )

    # A per-team anchor that resolves to the same page for both teams means one team's
    # section satisfied the other's anchor — the failure mode when one team name is a
    # prefix of the other ("Korea" / "Korea Republic"). Without this, a genuinely absent
    # per-team section reports as present.
    if meta.home_team != meta.away_team:
        for spec in ANCHOR_REGISTRY:
            if not spec.per_team:
                continue
            home_pages = resolved_pages.get(f"{spec.anchor_id}:home")
            away_pages = resolved_pages.get(f"{spec.anchor_id}:away")
            if home_pages is None or away_pages is None:
                continue
            shared = sorted(set(home_pages) & set(away_pages))
            if shared:
                record(
                    f"anchor {spec.anchor_id!r} (domain {spec.domain!r}) resolves to the "
                    f"same page(s) {shared} for both teams; one team's section cannot be "
                    f"distinguished from the other's"
                )
    return deviations


def _check_metadata_probe(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Recoverable oddities the probe recorded while reading this report's cover.

    Keys that are outright missing already fail in `probe_report`, and a report whose
    matchday round could not be derived is already recorded by the runner from
    `assign_matchday_rounds`' problems — re-reporting either here would count one root
    cause twice and inflate the by-venue and by-matchday localization histograms.
    """
    return [
        Deviation(
            report_id=meta.report_id,
            check="metadata-probe",
            category=DeviationCategory.PROBE_FAILURE,
            specifics=note,
        )
        for note in meta.probe_notes
    ]


register_check(
    Check(
        check_id="anchor-coverage",
        applies_to=lambda meta: True,
        run=_check_anchor_coverage,
    )
)
register_check(
    Check(
        check_id="metadata-probe",
        applies_to=lambda meta: True,
        run=_check_metadata_probe,
    )
)

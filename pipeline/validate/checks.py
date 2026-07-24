"""The check registry — the seam every later extraction story plugs into.

A check is a triple: an id, a predicate deciding which reports it applies to, and a
runner returning the deviations it found. Checks are registered in one module-level list;
the verification runner, the sample selection and the report format never need to change
when a new one arrives. That is what makes the gate cheap to re-run as the standing
acceptance criterion of Stories 1.5-1.14.

Registered here today:
  anchor-coverage         every registered section anchor resolves in the report
  metadata-probe          the report's stratification keys are complete
  shots-parse             the shots maps parse; an off-palette fill is unknown-rgb
  shots-count-match       parsed markers equal the attempts table's rows (Story 1.3)
  marker-event-link-rate  every shot marker links to its event row (Story 1.5,
                          count-mismatch)
  domain-a-completeness   Domain A extracts with its full §6 field inventory (Story 1.6);
                          an unknown minute-glyph fill is unknown-rgb, like shots
  domain-a-counts         Domain A's Self-Validation count checks, as deviations (1.6)
  domain-b-completeness   Domain B extracts the full Key Statistics block, typed (1.7)
  domain-b-counts         Domain B's Self-Validation consistency checks, as deviations
                          (possession-sum, internal-consistency, shots-reconciliation)
  domain-c-completeness   Domain C extracts phases + line-height pages, typed (1.7)
  domain-c-counts         Domain C's Self-Validation checks (metre bounds), as deviations
  crosses-parse           the crosses maps parse; an off-palette fill is unknown-rgb
                          (Story 1.11)
  crosses-count-match     parsed cross markers equal the delivery table's Total sum
                          (Story 1.11)

Later stories add, for example:
  1.8+  per-domain extractor checks
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.errors import MissingAnchorError
from pipeline.discover.text import PageTextIndex
from pipeline.discover.probe import ReportMeta
from pipeline.errors import PipelineError
from pipeline.extract.domain_a import domain_a_checks, extract_domain_a
from pipeline.extract.domain_b import domain_b_checks, extract_domain_b
from pipeline.extract.domain_c import domain_c_checks, extract_domain_c
from pipeline.extract.errors import ExtractError, UnknownMinuteGlyphError
from pipeline.ingest.identity import team_slug
from pipeline.markers.crosses import parse_crosses
from pipeline.markers.errors import UnknownRgbError
from pipeline.markers.shots import parse_shots
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


# One-slot memo for `_shots_parse_result`: the runner hands the same open document to
# `shots-parse` and then `shots-count-match`, and each parse rebuilds the full-text
# `PageTextIndex` — the naive-re-extraction cost `extract_report.py` documents (~18x in
# Story 1.4's measurement). Keyed on document identity (the stored strong reference is
# replaced on the next report, so a recycled `id()` can never alias), replaying the
# outcome — value or raised exception — so each check still decides what it owns.
_parse_memo: dict = {"doc": None, "result": None, "error": None}


def _shots_parse_result(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Both teams' shots domain, or `None` when the shots anchors do not resolve.

    A missing anchor is anchor-coverage's finding; re-reporting it here would count one
    root cause twice in the localization histograms. Every *other* typed parse failure
    propagates to the caller — each check decides for itself what it owns.
    """
    if _parse_memo["doc"] is not doc:
        _parse_memo.update(doc=doc, result=None, error=None)
        try:
            _parse_memo["result"] = _shots_parse_uncached(doc, meta)
        except Exception as exc:
            _parse_memo["error"] = exc
    if _parse_memo["error"] is not None:
        raise _parse_memo["error"]
    return _parse_memo["result"]


def _shots_parse_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    index = PageTextIndex(doc, report_id=meta.report_id)
    anchors: dict[str, list[int]] = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        if anchor.anchor_id not in ("shots:home", "shots:away"):
            continue
        try:
            anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
        except MissingAnchorError:
            return None
    return parse_shots(doc, anchors, meta.report_id, meta.home_team, meta.away_team)


def _check_shots_parse(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """The shots maps parse cleanly; an off-palette marker is an `unknown-rgb` deviation.

    Other typed failures (pitch frame, page layout, attempts table) deliberately raise:
    the runner isolates a raising check and records it against this check's id, which is
    exactly the loud, localizable surfacing the gate owes a template revision.
    """
    try:
        _shots_parse_result(doc, meta)
    except UnknownRgbError as exc:
        return [
            Deviation(
                report_id=meta.report_id,
                check="shots-parse",
                category=DeviationCategory.UNKNOWN_RGB,
                specifics=f"marker fill rgb {exc.rgb} on page {exc.page_index} "
                "is not in the shots palette",
            )
        ]
    return []


def _check_shots_count_match(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Per-team marker count equals the attempts table's row count, exactly (FR-14).

    A report that does not parse yields no deviation *here*: parse failures are
    shots-parse's finding (or anchor-coverage's), and a count comparison over a failed
    parse would attribute one root cause to two checks.
    """
    try:
        shots = _shots_parse_result(doc, meta)
    except PipelineError:
        return []
    if shots is None:
        return []
    deviations: list[Deviation] = []
    for side in ("home", "away"):
        markers = shots["counts"][side]["markers"]
        table = shots["counts"][side]["table"]
        if markers != table:
            deviations.append(
                Deviation(
                    report_id=meta.report_id,
                    check="shots-count-match",
                    category=DeviationCategory.COUNT_MISMATCH,
                    specifics=f"{side}: parsed {markers} markers, table lists {table}",
                )
            )
    return deviations


def _check_marker_event_link_rate(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Every parsed marker links to its attempts-table row — 100%, binary (FR-15, 1.5 AC 4).

    Specifics carry the per-report link rate plus each unlinked marker's identifying
    position, so a below-100% report's rate lands in the deviation summary. A report
    that does not parse yields no deviation *here* (shots-parse's or anchor-coverage's
    finding), and a clean report emits none — the deviation framework records only
    departures.
    """
    try:
        shots = _shots_parse_result(doc, meta)
    except PipelineError:
        return []
    if shots is None:
        return []
    deviations: list[Deviation] = []
    for side, team_name in (("home", meta.home_team), ("away", meta.away_team)):
        team_id = team_slug(team_name)
        events = [event for event in shots["shot_events"] if event["team_id"] == team_id]
        unlinked = [event for event in events if not event["linked"]]
        if unlinked:
            details = ", ".join(
                f"{event['outcome']}@({event['source']['pdf_x']},{event['source']['pdf_y']})"
                for event in unlinked
            )
            deviations.append(
                Deviation(
                    report_id=meta.report_id,
                    check="marker-event-link-rate",
                    category=DeviationCategory.COUNT_MISMATCH,
                    specifics=(
                        f"{side}: {len(events) - len(unlinked)}/{len(events)} markers "
                        f"linked; unlinked: {details}"
                    ),
                )
            )
    return deviations


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
register_check(
    Check(
        check_id="shots-parse",
        applies_to=lambda meta: True,
        run=_check_shots_parse,
    )
)
register_check(
    Check(
        check_id="shots-count-match",
        applies_to=lambda meta: True,
        run=_check_shots_count_match,
    )
)
register_check(
    Check(
        check_id="marker-event-link-rate",
        applies_to=lambda meta: True,
        run=_check_marker_event_link_rate,
    )
)


# One-slot memo for `_domain_a_payload`, same shape and justification as `_parse_memo`
# above: the runner hands the same open document to `domain-a-completeness` and then
# `domain-a-counts`, and each uncached call rebuilds the full-text `PageTextIndex` and
# re-parses the entire lineup page.
_domain_a_memo: dict = {"doc": None, "result": None, "error": None}


def _domain_a_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Domain A's payload for one report, or `None` when the lineups anchor does not
    resolve.

    A missing lineup page is anchor-coverage's finding (Story 1.6 maps lineup-anchor
    problems to `missing-anchor` through that existing check); re-reporting it here
    would count one root cause twice. Every other typed extract failure propagates —
    each check decides for itself what it owns.
    """
    if _domain_a_memo["doc"] is not doc:
        _domain_a_memo.update(doc=doc, result=None, error=None)
        try:
            _domain_a_memo["result"] = _domain_a_uncached(doc, meta)
        except Exception as exc:
            _domain_a_memo["error"] = exc
    if _domain_a_memo["error"] is not None:
        raise _domain_a_memo["error"]
    return _domain_a_memo["result"]


def _domain_a_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    index = PageTextIndex(doc, report_id=meta.report_id)
    spec = next(
        (anchor for anchor in ANCHOR_REGISTRY if anchor.anchor_id == "lineups"), None
    )
    if spec is None:
        # An authoring bug, not report data — a bare StopIteration here would be
        # recorded against the check with an empty message.
        raise LookupError("anchor registry has no 'lineups' spec; Domain A checks need it")
    try:
        anchors = {"lineups": index.find_all(spec.template, at_start=spec.at_page_start)}
    except MissingAnchorError:
        return None
    metadata = {
        "home_team": meta.home_team,
        "away_team": meta.away_team,
        "home_score": meta.home_score,
        "away_score": meta.away_score,
        "stage_text": meta.stage_text,
        "match_date": meta.match_date.isoformat(),
        "kickoff": meta.kickoff,
        "venue": meta.venue,
        "shootout": meta.shootout,
    }
    return extract_domain_a(doc, metadata, anchors, report_id=meta.report_id)


def _check_domain_a_completeness(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain A extracts with its full addendum §6 field inventory (AC 1, AC 3).

    An unknown minute-glyph fill is the same phenomenon as an off-palette shots marker
    and lands in the same `unknown-rgb` bucket (review decision 2026-07-23). Every
    other typed extract failure — a §6 field missing, a lineup row that resists the
    grammar, an unknown stage/venue/position — is a completeness-probe finding, the
    same `probe-failure` semantics as `metadata-probe`. Specifics carry the typed
    class name: the localization histogram exists to separate failure classes. A
    raising *bug* (anything untyped) deliberately propagates: the runner records it
    against this check's id.
    """

    def deviation(category: DeviationCategory, exc: ExtractError) -> list[Deviation]:
        return [
            Deviation(
                report_id=meta.report_id,
                check="domain-a-completeness",
                category=category,
                specifics=f"{type(exc).__name__}: {exc.reason}",
            )
        ]

    try:
        _domain_a_payload(doc, meta)
    except UnknownMinuteGlyphError as exc:
        return deviation(DeviationCategory.UNKNOWN_RGB, exc)
    except ExtractError as exc:
        return deviation(DeviationCategory.PROBE_FAILURE, exc)
    return []


def _check_domain_a_counts(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain A's Self-Validation count checks, re-run as gate deviations (AC 3).

    A report that does not extract yields no deviation *here*: extract failures are
    domain-a-completeness's finding (or anchor-coverage's), and any other pipeline
    failure surfaces once through whichever check owns it — running count checks over
    a failed extract would attribute one root cause to two checks.
    """
    try:
        payload = _domain_a_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    return [
        Deviation(
            report_id=meta.report_id,
            check="domain-a-counts",
            category=DeviationCategory.COUNT_MISMATCH,
            specifics=f"{check['check']}: {check['specifics']}",
        )
        for check in domain_a_checks(payload)
        if check["result"] == "fail"
    ]


register_check(
    Check(
        check_id="domain-a-completeness",
        applies_to=lambda meta: True,
        run=_check_domain_a_completeness,
    )
)
register_check(
    Check(
        check_id="domain-a-counts",
        applies_to=lambda meta: True,
        run=_check_domain_a_counts,
    )
)


# One-slot memos for the Domain B and C payloads, same shape and justification as
# `_parse_memo` / `_domain_a_memo` above: the runner hands the same open document to
# each domain's completeness and then counts check, and each uncached call rebuilds
# the full-text `PageTextIndex` and re-parses the domain's pages.
_domain_b_memo: dict = {"doc": None, "result": None, "error": None}
_domain_c_memo: dict = {"doc": None, "result": None, "error": None}


def _domain_anchor_pages(
    doc: "pymupdf.Document", meta: ReportMeta, anchor_ids: "tuple[str, ...]"
) -> "dict[str, list[int]] | None":
    """The resolved pages of `anchor_ids`, or `None` when any does not resolve.

    A missing section page is anchor-coverage's finding (missing-anchor); re-reporting
    it through a domain check would count one root cause twice.
    """
    index = PageTextIndex(doc, report_id=meta.report_id)
    wanted = set(anchor_ids)
    anchors: dict[str, list[int]] = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        if anchor.anchor_id not in wanted:
            continue
        try:
            anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
        except MissingAnchorError:
            return None
    missing = sorted(wanted - set(anchors))
    if missing:
        # An authoring bug, not report data — the registry no longer carries a spec
        # this domain's checks were written against.
        raise LookupError(f"anchor registry has no spec(s) for {missing}")
    return anchors


def _domain_b_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Domain B's payload for one report, or `None` when its anchor does not resolve."""
    if _domain_b_memo["doc"] is not doc:
        _domain_b_memo.update(doc=doc, result=None, error=None)
        try:
            _domain_b_memo["result"] = _domain_b_uncached(doc, meta)
        except Exception as exc:
            _domain_b_memo["error"] = exc
    if _domain_b_memo["error"] is not None:
        raise _domain_b_memo["error"]
    return _domain_b_memo["result"]


def _domain_b_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    anchors = _domain_anchor_pages(doc, meta, ("key-statistics",))
    if anchors is None:
        return None
    return extract_domain_b(doc, anchors, meta.report_id, meta.home_team, meta.away_team)


def _domain_c_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Domain C's payload for one report, or `None` when any of its five anchors does
    not resolve."""
    if _domain_c_memo["doc"] is not doc:
        _domain_c_memo.update(doc=doc, result=None, error=None)
        try:
            _domain_c_memo["result"] = _domain_c_uncached(doc, meta)
        except Exception as exc:
            _domain_c_memo["error"] = exc
    if _domain_c_memo["error"] is not None:
        raise _domain_c_memo["error"]
    return _domain_c_memo["result"]


def _domain_c_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    anchors = _domain_anchor_pages(
        doc,
        meta,
        (
            "phases-of-play",
            "in-possession-line-height:home",
            "in-possession-line-height:away",
            "defensive-line-height:home",
            "defensive-line-height:away",
        ),
    )
    if anchors is None:
        return None
    return extract_domain_c(doc, anchors, report_id=meta.report_id)


def _extract_failure_deviation(
    check_id: str, meta: ReportMeta, exc: ExtractError
) -> list[Deviation]:
    """A typed B/C extract failure as this check's probe-failure deviation (Task 7.2).

    Every parse/typing/completeness failure class lands in `probe-failure` with the
    typed class name prefixed in specifics — the closed four-category set admits no
    fifth category, and the localization histogram separates failure classes by name.
    """
    return [
        Deviation(
            report_id=meta.report_id,
            check=check_id,
            category=DeviationCategory.PROBE_FAILURE,
            specifics=f"{type(exc).__name__}: {exc.reason}",
        )
    ]


def _failed_check_deviations(
    check_id: str, meta: ReportMeta, checks: "list[dict]"
) -> list[Deviation]:
    """A domain's failed Self-Validation checks as count-mismatch deviations."""
    return [
        Deviation(
            report_id=meta.report_id,
            check=check_id,
            category=DeviationCategory.COUNT_MISMATCH,
            specifics=f"{check['check']}: {check['specifics']}",
        )
        for check in checks
        if check["result"] == "fail"
    ]


def _check_domain_b_completeness(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain B extracts its full §6 Key Statistics inventory, all numeric-typed (AC 1,
    AC 3).

    Every typed extract failure — an unknown or missing row, a value that fails its
    expected type, a layout that resists the grammar — is a `probe-failure` finding
    naming the typed class. A raising `PipelineError` bug propagates once and is
    recorded against this check's id, while `domain-b-counts` swallows it (Task 7.3,
    the 1.6 single-attribution patch). NOTE: an exception outside the `PipelineError`
    hierarchy (e.g. the `LookupError` `_domain_anchor_pages` raises on registry drift)
    is caught by neither check, so the memo replays it into both and the runner records
    it against two ids — an authoring-bug-only path, ledgered for the runner-owned
    parse-handoff that retires the shared memo pattern.
    """
    try:
        _domain_b_payload(doc, meta)
    except ExtractError as exc:
        return _extract_failure_deviation("domain-b-completeness", meta, exc)
    return []


def _check_domain_b_counts(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain B's Self-Validation consistency checks, re-run as gate deviations (AC 3).

    A report that does not extract yields no deviation *here* (completeness's or
    anchor-coverage's finding). The shots reconciliation reuses `_shots_parse_result`'s
    memo — never a third parse (Task 5.4); a report whose shots domain does not parse
    simply runs without the reconciliation check, because that failure is shots-parse's
    finding.
    """
    try:
        payload = _domain_b_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    shots_counts = None
    try:
        shots = _shots_parse_result(doc, meta)
    except PipelineError:
        shots = None
    if shots is not None:
        shots_counts = shots["counts"]
    return _failed_check_deviations(
        "domain-b-counts", meta, domain_b_checks(payload, shots_counts=shots_counts)
    )


def _check_domain_c_completeness(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain C extracts the phases and all four line-height pages, typed (AC 2, AC 3).

    Same attribution rules as `domain-b-completeness`: typed `ExtractError` failures are
    probe-failure findings naming the class; a raising `PipelineError` propagates once to
    the runner. The same non-`PipelineError` caveat applies (registry-drift `LookupError`
    lands in both this check and `domain-c-counts` via the replayed memo — ledgered).
    """
    try:
        _domain_c_payload(doc, meta)
    except ExtractError as exc:
        return _extract_failure_deviation("domain-c-completeness", meta, exc)
    return []


def _check_domain_c_counts(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain C's Self-Validation checks (metre bounds), re-run as gate deviations."""
    try:
        payload = _domain_c_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    return _failed_check_deviations("domain-c-counts", meta, domain_c_checks(payload))


register_check(
    Check(
        check_id="domain-b-completeness",
        applies_to=lambda meta: True,
        run=_check_domain_b_completeness,
    )
)
register_check(
    Check(
        check_id="domain-b-counts",
        applies_to=lambda meta: True,
        run=_check_domain_b_counts,
    )
)
register_check(
    Check(
        check_id="domain-c-completeness",
        applies_to=lambda meta: True,
        run=_check_domain_c_completeness,
    )
)
register_check(
    Check(
        check_id="domain-c-counts",
        applies_to=lambda meta: True,
        run=_check_domain_c_counts,
    )
)


# One-slot memo for `_crosses_parse_result`, same shape and justification as
# `_parse_memo` above (Story 1.11): the runner hands the same open document to
# `crosses-parse` and then `crosses-count-match`, and each uncached call rebuilds the
# full-text `PageTextIndex` and re-parses both crosses pages. Copied, not refactored:
# the memo pattern carries two OPEN deferred-work entries (strong doc ref, replayed
# cached exceptions) that a shared abstraction would have to inherit anyway.
_crosses_memo: dict = {"doc": None, "result": None, "error": None}


def _crosses_parse_result(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Both teams' crosses domain, or `None` when the crosses anchors do not resolve.

    A missing anchor is anchor-coverage's finding; re-reporting it here would count one
    root cause twice. Every *other* typed parse failure propagates to the caller —
    each check decides for itself what it owns.
    """
    if _crosses_memo["doc"] is not doc:
        _crosses_memo.update(doc=doc, result=None, error=None)
        try:
            _crosses_memo["result"] = _crosses_parse_uncached(doc, meta)
        except Exception as exc:
            _crosses_memo["error"] = exc
    if _crosses_memo["error"] is not None:
        raise _crosses_memo["error"]
    return _crosses_memo["result"]


def _crosses_parse_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    index = PageTextIndex(doc, report_id=meta.report_id)
    anchors: dict[str, list[int]] = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        if anchor.anchor_id not in ("crosses:home", "crosses:away"):
            continue
        try:
            anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
        except MissingAnchorError:
            return None
    return parse_crosses(doc, anchors, meta.report_id, meta.home_team, meta.away_team)


def _check_crosses_parse(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """The crosses maps parse cleanly; an off-palette marker is `unknown-rgb` (FR-11).

    Other typed failures (pitch frame, page layout, table grammar) deliberately raise:
    the runner isolates a raising check and records it against this check's id — the
    loud, localizable surfacing the gate owes a template revision.
    """
    try:
        _crosses_parse_result(doc, meta)
    except UnknownRgbError as exc:
        return [
            Deviation(
                report_id=meta.report_id,
                check="crosses-parse",
                category=DeviationCategory.UNKNOWN_RGB,
                specifics=f"marker fill rgb {exc.rgb} on page {exc.page_index} "
                "is not in the crosses palette",
            )
        ]
    return []


def _check_crosses_count_match(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Per-team cross-marker count equals the delivery table's Total sum (FR-14).

    A report that does not parse yields no deviation *here*: parse failures are
    crosses-parse's finding (or anchor-coverage's), and a count comparison over a
    failed parse would attribute one root cause to two checks.
    """
    try:
        crosses = _crosses_parse_result(doc, meta)
    except PipelineError:
        return []
    if crosses is None:
        return []
    deviations: list[Deviation] = []
    for side in ("home", "away"):
        markers = crosses["counts"][side]["markers"]
        table = crosses["counts"][side]["table"]
        if markers != table:
            deviations.append(
                Deviation(
                    report_id=meta.report_id,
                    check="crosses-count-match",
                    category=DeviationCategory.COUNT_MISMATCH,
                    specifics=f"{side}: parsed {markers} markers, table lists {table}",
                )
            )
    return deviations


register_check(
    Check(
        check_id="crosses-parse",
        applies_to=lambda meta: True,
        run=_check_crosses_parse,
    )
)
register_check(
    Check(
        check_id="crosses-count-match",
        applies_to=lambda meta: True,
        run=_check_crosses_count_match,
    )
)

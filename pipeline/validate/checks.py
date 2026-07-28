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
  domain-g-completeness   Domain G extracts every player's four per-player pages and
                          joins each row to the lineup, typed (Story 1.10)
  domain-g-counts         Domain G's Self-Validation checks (zone sum, internal
                          consistency, and the two cross-domain reconciliations), as
                          deviations (Story 1.10)
  crosses-parse           the crosses maps parse; an off-palette fill is unknown-rgb
                          (Story 1.11)
  crosses-count-match     parsed cross markers equal the delivery table's Total sum
                          (Story 1.11)
  defensive-actions-parse the two defensive-actions panels parse; an off-palette fill is
                          unknown-rgb (Story 1.12)
  defensive-actions-count-match
                          parsed forced-turnover markers equal the page's printed Forced
                          Turnovers total (Story 1.12; the possession-regain map has no
                          established printed counterpart and is deliberately unchecked)

  momentum-axis-scale     the momentum chart parses and its printed y-axis top label
                          equals the peak bar's derived value — the ONLY printed
                          counterpart the chart offers (Story 1.8)
  momentum-coverage       the staged series covers the full match, kick-off to the final
                          period, with the printed FT tick stamped at regulation's end.
                          A backstop over the staged payload, not an independent
                          cross-check — the parser's own `_clock_structure` already fails
                          loud on every clock inconsistency (Story 1.8)

  receiving-parse         both receiving page families parse; an off-palette decoration
                          fill is unknown-rgb (Story 1.13)
  receiving-count-match   every receiving reconciliation holds — the five page-internal
                          ones plus, when Domain G is available, the two cross-domain
                          ones (Story 1.13). One prefix covers both page families
                          because they share one payload; `offers-*` is deliberately NOT
                          claimed (it is test_checks_registry's unclaimed placeholder).

  goalkeeping-completeness
                          Domain E extracts all four goalkeeping page families for both
                          teams, typed, with each team's goalkeeper list carried from
                          Domain A (Story 1.9); an off-palette distribution marker is
                          unknown-rgb, like shots
  goalkeeping-counts      Domain E's Self-Validation checks (distribution sum, the printed
                          donut cross-check, goal-prevention sum, aerial sum and the
                          involvement bound), as deviations (Story 1.9)
  set-plays-completeness  Domain F extracts both teams' set-plays pages, typed (Story 1.9)
  set-plays-counts        Domain F's Self-Validation checks (corner sides, set-play
                          totals), as deviations (Story 1.9). `offers-count-match` is
                          deliberately NOT claimed by either pair — it is
                          test_checks_registry's unclaimed placeholder.

  pass-network-completeness
                          both teams' pass matrices parse and every endpoint joins to the
                          lineup, typed (Story 1.14) — this is where AC 3's join integrity
                          lands, and where the page's two standing NEGATIVE assertions (no
                          pitch frame, no filled all-Bezier drawing) surface if the
                          template ever starts printing coordinates
  pass-network-counts     the pass network's Self-Validation checks (the printed Top-5
                          reconciliation, plus the row and total BOUNDS against Domains G
                          and B when those are available), as deviations (Story 1.14)

Later stories add, for example:
  1.15 player identity resolution
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
from pipeline.extract.domain_e import (
    AERIAL_ANCHOR_STEM,
    DISTRIBUTION_ANCHOR_STEM,
    GOAL_PREVENTION_ANCHOR_STEM,
    INVOLVEMENT_ANCHOR_ID,
    domain_e_checks,
    extract_domain_e,
)
from pipeline.extract.domain_f import (
    SET_PLAYS_ANCHOR_STEM,
    domain_f_checks,
    extract_domain_f,
)
from pipeline.extract.domain_g import FAMILIES, domain_g_checks, extract_domain_g
from pipeline.extract.errors import (
    ExtractError,
    MomentumFillError,
    UnknownMinuteGlyphError,
)
from pipeline.extract.momentum import (
    MOMENTUM_ANCHOR_ID,
    extract_momentum,
    momentum_checks,
)
from pipeline.extract.pass_network import (
    PASS_NETWORK_ANCHOR_STEM,
    extract_pass_network,
    pass_network_checks,
)
from pipeline.ingest.identity import team_slug
from pipeline.markers.crosses import parse_crosses
from pipeline.markers.defensive_actions import parse_defensive_actions
from pipeline.markers.errors import UnknownRgbError
from pipeline.markers.receiving import (
    parse_movement,
    parse_offers,
    receiving_domain,
    receiving_self_validation_block,
)
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


# One-slot memo for `_defensive_actions_parse_result`, same shape and justification as
# `_crosses_memo` above (Story 1.12): the runner hands the same open document to
# `defensive-actions-parse` and then `defensive-actions-count-match`, and each uncached
# call rebuilds the full-text `PageTextIndex` and re-parses both pages. Copied, not
# refactored: the memo pattern carries OPEN deferred-work entries (strong doc ref,
# replayed cached exceptions) that a shared abstraction would have to inherit anyway.
_defensive_actions_memo: dict = {"doc": None, "result": None, "error": None}


def _defensive_actions_parse_result(
    doc: "pymupdf.Document", meta: ReportMeta
) -> "dict | None":
    """Both teams' defensive actions, or `None` when the anchors do not resolve.

    A missing anchor is anchor-coverage's finding; re-reporting it here would count one
    root cause twice. Every *other* typed parse failure propagates to the caller — each
    check decides for itself what it owns.
    """
    if _defensive_actions_memo["doc"] is not doc:
        _defensive_actions_memo.update(doc=doc, result=None, error=None)
        try:
            _defensive_actions_memo["result"] = _defensive_actions_parse_uncached(doc, meta)
        except Exception as exc:
            _defensive_actions_memo["error"] = exc
    if _defensive_actions_memo["error"] is not None:
        raise _defensive_actions_memo["error"]
    return _defensive_actions_memo["result"]


def _defensive_actions_parse_uncached(
    doc: "pymupdf.Document", meta: ReportMeta
) -> "dict | None":
    index = PageTextIndex(doc, report_id=meta.report_id)
    anchors: dict[str, list[int]] = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        if anchor.anchor_id not in ("defensive-actions:home", "defensive-actions:away"):
            continue
        try:
            anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
        except MissingAnchorError:
            return None
    return parse_defensive_actions(
        doc, anchors, meta.report_id, meta.home_team, meta.away_team
    )


def _check_defensive_actions_parse(
    doc: "pymupdf.Document", meta: ReportMeta
) -> list[Deviation]:
    """Both defensive-actions panels parse; an off-palette marker is `unknown-rgb` (FR-11).

    Other typed failures (pitch frame, page layout, panel title, table grammar)
    deliberately raise: the runner isolates a raising check and records it against this
    check's id — the loud, localizable surfacing the gate owes a template revision.
    """
    try:
        _defensive_actions_parse_result(doc, meta)
    except UnknownRgbError as exc:
        return [
            Deviation(
                report_id=meta.report_id,
                check="defensive-actions-parse",
                category=DeviationCategory.UNKNOWN_RGB,
                specifics=f"marker fill rgb {exc.rgb} on page {exc.page_index} "
                "is not in the defensive-actions palette",
            )
        ]
    return []


def _check_defensive_actions_count_match(
    doc: "pymupdf.Document", meta: ReportMeta
) -> list[Deviation]:
    """Per-team, per-family marker count equals the family's printed total (FR-14).

    Only families with an established printed counterpart are compared: the
    possession-regain map's `table` count is `None` by design (its marker count matches
    no printed number on the page), and a comparison against a different family's total
    would manufacture 208 false deviations. One deviation per failing team/family.

    A report that does not parse yields no deviation *here*: parse failures are
    defensive-actions-parse's finding (or anchor-coverage's), and a count comparison over
    a failed parse would attribute one root cause to two checks.
    """
    try:
        defensive_actions = _defensive_actions_parse_result(doc, meta)
    except PipelineError:
        return []
    if defensive_actions is None:
        return []
    deviations: list[Deviation] = []
    for side in ("home", "away"):
        for _key, counts in sorted(defensive_actions["counts"][side].items()):
            table = counts["table"]
            if table is None:
                continue
            markers = counts["markers"]
            if markers != table:
                deviations.append(
                    Deviation(
                        report_id=meta.report_id,
                        check="defensive-actions-count-match",
                        category=DeviationCategory.COUNT_MISMATCH,
                        specifics=f"{side} {counts['action_type']}: parsed {markers} "
                        f"markers, page prints {table}",
                    )
                )
    return deviations


register_check(
    Check(
        check_id="defensive-actions-parse",
        applies_to=lambda meta: True,
        run=_check_defensive_actions_parse,
    )
)
register_check(
    Check(
        check_id="defensive-actions-count-match",
        applies_to=lambda meta: True,
        run=_check_defensive_actions_count_match,
    )
)


# One-slot memo for `_domain_g_payload`, same shape and justification as `_domain_b_memo`
# / `_domain_c_memo` above (Story 1.10): the runner hands the same open document to
# `domain-g-completeness` and then `domain-g-counts`, and each uncached call rebuilds the
# full-text `PageTextIndex` and re-parses eight per-player pages. Copied, not refactored:
# the memo pattern carries OPEN deferred-work entries (strong doc ref, replayed cached
# exceptions) that a shared abstraction would have to inherit anyway, and the
# runner-owned parse-handoff that retires it is ledgered as a single joint fix.
_domain_g_memo: dict = {"doc": None, "result": None, "error": None}

# The eight resolved anchor ids Domain G reads, derived from the parser's own family
# table so the two can never drift apart.
_DOMAIN_G_ANCHOR_IDS: "tuple[str, ...]" = tuple(
    f"{family.anchor_stem}:{side}" for family in FAMILIES for side in ("home", "away")
)


def _domain_g_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Domain G's payload for one report, or `None` when it cannot be attempted.

    `None` covers both skip paths: one of the eight per-player anchors did not resolve
    (anchor-coverage's finding), or Domain A did not extract, which leaves the lineups
    this domain joins to unavailable. A Domain A failure is `domain-a-completeness`'s
    finding, and re-reporting it under a `domain-g-*` id is exactly the double
    attribution the 1.6 review patched out.
    """
    if _domain_g_memo["doc"] is not doc:
        _domain_g_memo.update(doc=doc, result=None, error=None)
        try:
            _domain_g_memo["result"] = _domain_g_uncached(doc, meta)
        except Exception as exc:
            _domain_g_memo["error"] = exc
    if _domain_g_memo["error"] is not None:
        raise _domain_g_memo["error"]
    return _domain_g_memo["result"]


def _domain_g_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    anchors = _domain_anchor_pages(doc, meta, _DOMAIN_G_ANCHOR_IDS)
    if anchors is None:
        return None
    # Reuse Domain A's memo rather than a ninth parse of the same document.
    try:
        domain_a = _domain_a_payload(doc, meta)
    except PipelineError:
        return None
    if domain_a is None:
        return None
    return extract_domain_g(doc, anchors, domain_a["lineups"], report_id=meta.report_id)


def _check_domain_g_completeness(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Every player with minutes extracts and joins to the lineup, typed (AC 1, AC 2, AC 3).

    Same attribution rules as `domain-b-completeness`: typed `ExtractError` failures —
    a page that resists the table grammar, a value that fails its expected type, a row
    that matches no lineup player, a player with minutes and no row — are probe-failure
    findings naming the class, and the join failures land here through
    `PlayerJoinError`, which is what puts join integrity in the deviation summary (AC 3).
    A raising `PipelineError` propagates once to the runner while `domain-g-counts`
    swallows it. The same non-`PipelineError` caveat applies as for Domains B and C
    (registry-drift `LookupError` lands in both ids via the replayed memo — ledgered).
    """
    try:
        _domain_g_payload(doc, meta)
    except ExtractError as exc:
        return _extract_failure_deviation("domain-g-completeness", meta, exc)
    return []


def _check_domain_g_counts(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain G's Self-Validation checks, re-run as gate deviations (AC 3).

    A report that does not extract yields no deviation *here* (completeness's,
    domain-a-completeness's or anchor-coverage's finding). The two cross-domain checks
    need Domain B's Key Statistics, so they reuse `_domain_b_payload`'s memo — never a
    third parse of that page. A report whose Domain B raises a `PipelineError` simply
    runs WITHOUT those two checks (the zone-sum and internal-consistency checks need
    neither sibling): a Domain B parse failure is `domain-b-*`'s finding, and
    re-reporting it under `domain-g-counts` would attribute one root cause to two
    checks. The same non-`PipelineError` caveat as `domain-g-completeness` applies and
    is NOT covered by that skip — a registry-drift `LookupError` out of the Domain B
    memo propagates from here and is recorded against this id (ledgered). The Domain A
    lineups the goals reconciliation needs are already inside the payload's own
    precondition, so they are re-read from the same memo.
    """
    try:
        payload = _domain_g_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    key_statistics = None
    lineups = None
    try:
        key_statistics = _domain_b_payload(doc, meta)
    except PipelineError:
        key_statistics = None
    if key_statistics is not None:
        try:
            domain_a = _domain_a_payload(doc, meta)
        except PipelineError:
            domain_a = None
        lineups = domain_a["lineups"] if domain_a is not None else None
    return _failed_check_deviations(
        "domain-g-counts",
        meta,
        domain_g_checks(payload, key_statistics=key_statistics, lineups=lineups),
    )


register_check(
    Check(
        check_id="domain-g-completeness",
        applies_to=lambda meta: True,
        run=_check_domain_g_completeness,
    )
)
register_check(
    Check(
        check_id="domain-g-counts",
        applies_to=lambda meta: True,
        run=_check_domain_g_counts,
    )
)


# One-slot memo for `_momentum_payload`, same shape and justification as the memos above
# (Story 1.8): the runner hands the same open document to `momentum-axis-scale` and then
# `momentum-coverage`, and each uncached call rebuilds the full-text `PageTextIndex` and
# re-reads every drawing on the chart page. Copied, not refactored: the memo pattern
# carries OPEN deferred-work entries (strong doc ref, replayed cached exceptions) that a
# shared abstraction would have to inherit anyway.
_momentum_memo: dict = {"doc": None, "result": None, "error": None}


def _momentum_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """The momentum parser's result for one report, or `None` when its anchor does not
    resolve.

    A missing chart page is anchor-coverage's finding; re-reporting it here would count
    one root cause twice. Note the return is the parser's `{"series", "warnings"}` wrapper,
    not the series itself: a report whose chart draws no bars stages `series: None` and
    that is a legitimate, check-free outcome — distinct from "could not be attempted".
    """
    if _momentum_memo["doc"] is not doc:
        _momentum_memo.update(doc=doc, result=None, error=None)
        try:
            _momentum_memo["result"] = _momentum_uncached(doc, meta)
        except Exception as exc:
            _momentum_memo["error"] = exc
    if _momentum_memo["error"] is not None:
        raise _momentum_memo["error"]
    return _momentum_memo["result"]


def _momentum_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    anchors = _domain_anchor_pages(doc, meta, (MOMENTUM_ANCHOR_ID,))
    if anchors is None:
        return None
    return extract_momentum(
        doc,
        anchors,
        report_id=meta.report_id,
        home_team=meta.home_team,
        away_team=meta.away_team,
    )


def _check_momentum_axis_scale(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """The chart parses, and its printed y-axis top label equals the peak bar's value.

    This check owns the parse, so every typed failure surfaces under this id: an
    off-palette bar fill is the same phenomenon as an off-palette shots marker and lands
    in `unknown-rgb`, while a structural, scale, axis or clock failure is a probe-failure
    finding naming the typed class. `momentum-coverage` swallows those, so one root cause
    is attributed once.

    The same non-`PipelineError` caveat as the domain-g pair applies and is ledgered: the
    single-attribution guarantee holds for `ExtractError` here and `PipelineError` in
    `_check_momentum_coverage`, but `_domain_anchor_pages` raises a bare `LookupError` on
    registry drift, which neither handler catches — so that one cause would be reported
    against both ids.

    The axis comparison itself is the genuine printed cross-check the page offers: this
    chart has NO printed row total to reconcile a sum against (the probe tested the bar
    sum against every numeric Domain B field over all 208 team-innings), and inventing one
    is exactly what SM-C1 forbids.
    """

    def deviation(category: DeviationCategory, exc: ExtractError) -> list[Deviation]:
        return [
            Deviation(
                report_id=meta.report_id,
                check="momentum-axis-scale",
                category=category,
                specifics=f"{type(exc).__name__}: {exc.reason}",
            )
        ]

    try:
        payload = _momentum_payload(doc, meta)
    except MomentumFillError as exc:
        return deviation(DeviationCategory.UNKNOWN_RGB, exc)
    except ExtractError as exc:
        return deviation(DeviationCategory.PROBE_FAILURE, exc)
    if payload is None:
        return []
    return _failed_check_deviations(
        "momentum-axis-scale",
        meta,
        [
            check
            for check in momentum_checks(payload["series"])
            if check["check"] == "momentum-axis-scale"
        ],
    )


def _check_momentum_coverage(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """The staged series spans the whole match — kick-off to the final period.

    A backstop over the staged payload, NOT an independent cross-check of the parse: every
    clock inconsistency it could describe is already a typed failure inside the parser's
    `_clock_structure`, which aborts the report before a series exists. See
    `momentum_checks`' docstring in `pipeline/extract/momentum.py`.

    A report that does not parse yields no deviation *here* (momentum-axis-scale's or
    anchor-coverage's finding). A report whose chart draws no bars also yields none: its
    absence travels as a per-report warning into the manifest, and the strictly binary
    aggregator would read a non-`pass` check as a failure of a merely incomplete report.

    Same non-`PipelineError` caveat as `_check_momentum_axis_scale`, ledgered there.
    """
    try:
        payload = _momentum_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    return _failed_check_deviations(
        "momentum-coverage",
        meta,
        [
            check
            for check in momentum_checks(payload["series"])
            if check["check"] == "momentum-coverage"
        ],
    )


register_check(
    Check(
        check_id="momentum-axis-scale",
        applies_to=lambda meta: True,
        run=_check_momentum_axis_scale,
    )
)
register_check(
    Check(
        check_id="momentum-coverage",
        applies_to=lambda meta: True,
        run=_check_momentum_coverage,
    )
)


# One-slot memo for `_receiving_parse_result`, same shape and justification as
# `_crosses_memo` above (Story 1.13): the runner hands the same open document to
# `receiving-parse` and then `receiving-count-match`, and each uncached call rebuilds the
# full-text `PageTextIndex` and re-parses all four receiving pages. Copied, not
# refactored: the memo pattern carries OPEN deferred-work entries (strong doc ref,
# replayed cached exceptions) that a shared abstraction would have to inherit anyway.
_receiving_memo: dict = {"doc": None, "result": None, "error": None}

# One prefix for both page families, deliberately: `offers-count-match` is
# `test_checks_registry.py`'s unclaimed placeholder id (Story 1.12 moved it there) and
# `register_check` raises on duplicates, so claiming it would silently break that test.
# One prefix also matches the one `domains["receiving"]` payload the two families share.
_RECEIVING_ANCHOR_IDS = ("offers:home", "offers:away", "movement:home", "movement:away")


def _receiving_parse_result(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Both teams' receiving domain, or `None` when the receiving anchors do not resolve.

    A missing anchor is anchor-coverage's finding; re-reporting it here would count one
    root cause twice. Every *other* typed parse failure propagates to the caller — each
    check decides for itself what it owns.
    """
    if _receiving_memo["doc"] is not doc:
        _receiving_memo.update(doc=doc, result=None, error=None)
        try:
            _receiving_memo["result"] = _receiving_parse_uncached(doc, meta)
        except Exception as exc:
            _receiving_memo["error"] = exc
    if _receiving_memo["error"] is not None:
        raise _receiving_memo["error"]
    return _receiving_memo["result"]


def _receiving_parse_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    # `_domain_anchor_pages`, not a hand-rolled loop (2026-07-27 review patch): the
    # inlined copy silently left an anchor id OUT of the map when the registry no longer
    # carried a spec for it, so `_single_anchor_page` then raised
    # `ReceivingPageLayoutError(..., pages=None)` — report data — on all 104 reports for
    # what is an authoring bug. The shared helper raises the deliberate
    # `LookupError("anchor registry has no spec(s) for ...")` instead, and reuses the
    # index rather than building a second full-document one per report.
    anchors = _domain_anchor_pages(doc, meta, _RECEIVING_ANCHOR_IDS)
    if anchors is None:
        return None
    return receiving_domain(
        parse_offers(doc, anchors, meta.report_id, meta.home_team, meta.away_team),
        parse_movement(doc, anchors, meta.report_id, meta.home_team, meta.away_team),
    )


def _check_receiving_parse(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Both receiving page families parse; an off-palette fill is `unknown-rgb` (FR-11).

    The only fills this family keys are the offers panels' 11-dot formation template —
    decoration, not data — and that is exactly the point: the census is a
    template-revision tripwire, so a panel that ever starts drawing real markers in a
    second colour surfaces here instead of publishing silence.

    Other typed failures (pitch frame, page layout, panel title, table grammar)
    deliberately raise: the runner isolates a raising check and records it against this
    check's id — the loud, localizable surfacing the gate owes a template revision.
    """
    try:
        _receiving_parse_result(doc, meta)
    except UnknownRgbError as exc:
        return [
            Deviation(
                report_id=meta.report_id,
                check="receiving-parse",
                category=DeviationCategory.UNKNOWN_RGB,
                specifics=f"decoration fill rgb {exc.rgb} on page {exc.page_index} "
                "is not in the receiving palette",
            )
        ]
    return []


def _check_receiving_count_match(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Every receiving reconciliation holds — one deviation per failing team and check.

    Re-runs the record's own Self-Validation block as gate deviations, including the two
    cross-domain families when Domain G's payload is available (it comes from the sibling
    memo, the `_check_domain_g_counts` precedent). When it is not, those checks are not
    emitted at all rather than failed: a Domain G parse failure is `domain-g-*`'s
    finding.

    A report that does not parse yields no deviation *here*: parse failures are
    receiving-parse's finding (or anchor-coverage's), and a count comparison over a
    failed parse would attribute one root cause to two checks.
    """
    try:
        receiving = _receiving_parse_result(doc, meta)
    except PipelineError:
        return []
    if receiving is None:
        return []
    try:
        player_stats = _domain_g_payload(doc, meta)
    except PipelineError:
        player_stats = None
    # Every receiving check carries a `specifics` string holding BOTH operands, so the
    # shared builder renders one deviation per failing team and check id.
    return _failed_check_deviations(
        "receiving-count-match",
        meta,
        receiving_self_validation_block(receiving["counts"], player_stats=player_stats),
    )


register_check(
    Check(
        check_id="receiving-parse",
        applies_to=lambda meta: True,
        run=_check_receiving_parse,
    )
)
register_check(
    Check(
        check_id="receiving-count-match",
        applies_to=lambda meta: True,
        run=_check_receiving_count_match,
    )
)


# One-slot memos for the Domain E and F payloads, same shape and justification as the memos
# above (Story 1.9): the runner hands the same open document to each domain's completeness
# and then counts check, and each uncached call rebuilds the full-text `PageTextIndex` and
# re-parses seven (E) or two (F) pages. Copied, not refactored: the memo pattern carries
# OPEN deferred-work entries (strong doc ref, replayed cached exceptions) that a shared
# abstraction would have to inherit anyway, and the runner-owned parse-handoff that retires
# it is ledgered as a single joint fix.
_domain_e_memo: dict = {"doc": None, "result": None, "error": None}
_domain_f_memo: dict = {"doc": None, "result": None, "error": None}

# The seven resolved anchor ids Domain E reads. `gk-involvement` is BARE — its spec is not
# `per_team`, because one page carries both teams' charts — while the other three families
# are per-team. Derived from the parser's own anchor constants so the two cannot drift.
_DOMAIN_E_ANCHOR_IDS: "tuple[str, ...]" = (INVOLVEMENT_ANCHOR_ID,) + tuple(
    f"{stem}:{side}"
    for stem in (
        DISTRIBUTION_ANCHOR_STEM,
        GOAL_PREVENTION_ANCHOR_STEM,
        AERIAL_ANCHOR_STEM,
    )
    for side in ("home", "away")
)
_DOMAIN_F_ANCHOR_IDS: "tuple[str, ...]" = tuple(
    f"{SET_PLAYS_ANCHOR_STEM}:{side}" for side in ("home", "away")
)


def _domain_e_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Domain E's payload for one report, or `None` when it cannot be attempted.

    `None` means one of the seven goalkeeping anchors did not resolve — anchor-coverage's
    finding, never re-reported here.

    A Domain A failure is NOT a skip. It leaves the lineups this domain carries its
    goalkeeper list from unavailable, so `extract_domain_e` is called with `lineups=None`
    and the four page families are read as normal: goal prevention, aerial control,
    distribution and involvement are all page-internal and need no lineup. Returning
    `None` here instead would hide a genuinely broken goalkeeping page behind
    `domain-a-completeness`'s finding, which Task 7.2 forbids ("skip only the parts that
    need it and run the rest"). The Domain A failure itself is still reported once, under
    `domain-a-*`, and never re-attributed to a `goalkeeping-*` id.
    """
    if _domain_e_memo["doc"] is not doc:
        _domain_e_memo.update(doc=doc, result=None, error=None)
        try:
            _domain_e_memo["result"] = _domain_e_uncached(doc, meta)
        except Exception as exc:
            _domain_e_memo["error"] = exc
    if _domain_e_memo["error"] is not None:
        raise _domain_e_memo["error"]
    return _domain_e_memo["result"]


def _domain_e_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    anchors = _domain_anchor_pages(doc, meta, _DOMAIN_E_ANCHOR_IDS)
    if anchors is None:
        return None
    # Reuse Domain A's memo rather than an eighth parse of the same document. Its failure
    # costs only the goalkeeper list (Task 7.2), so it becomes `lineups=None` rather than a
    # skip of the whole domain — see `_domain_e_payload`.
    try:
        domain_a = _domain_a_payload(doc, meta)
    except PipelineError:
        domain_a = None
    return extract_domain_e(
        doc,
        anchors,
        None if domain_a is None else domain_a["lineups"],
        report_id=meta.report_id,
        home_team=meta.home_team,
        away_team=meta.away_team,
    )


def _domain_f_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """Domain F's payload for one report, or `None` when its anchors do not resolve."""
    if _domain_f_memo["doc"] is not doc:
        _domain_f_memo.update(doc=doc, result=None, error=None)
        try:
            _domain_f_memo["result"] = _domain_f_uncached(doc, meta)
        except Exception as exc:
            _domain_f_memo["error"] = exc
    if _domain_f_memo["error"] is not None:
        raise _domain_f_memo["error"]
    return _domain_f_memo["result"]


def _domain_f_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    anchors = _domain_anchor_pages(doc, meta, _DOMAIN_F_ANCHOR_IDS)
    if anchors is None:
        return None
    return extract_domain_f(doc, anchors, report_id=meta.report_id)


def _check_goalkeeping_completeness(
    doc: "pymupdf.Document", meta: ReportMeta
) -> list[Deviation]:
    """All four goalkeeping page families extract for both teams, typed (AC 1, AC 3).

    An off-palette distribution marker is the same phenomenon as an off-palette shots
    marker and lands in the same `unknown-rgb` bucket. Every other typed extract failure —
    a page that resists its family's grammar, a chart whose scale cannot be established, a
    value that fails its expected type, a team with no goalkeeper in the lineup — is a
    `probe-failure` finding naming the typed class, so the localization histogram can
    separate the four families' failure modes.

    A raising `PipelineError` bug propagates once and is recorded against this check's id
    while `goalkeeping-counts` swallows it (Task 7.4). The same non-`PipelineError` caveat
    applies as for Domains B, C and G (registry-drift `LookupError` lands in both ids via
    the replayed memo — ledgered).
    """
    try:
        _domain_e_payload(doc, meta)
    except UnknownRgbError as exc:
        return [
            Deviation(
                report_id=meta.report_id,
                check="goalkeeping-completeness",
                category=DeviationCategory.UNKNOWN_RGB,
                specifics=f"distribution marker fill rgb {exc.rgb} on page "
                f"{exc.page_index} is not in the goalkeeping palette",
            )
        ]
    except ExtractError as exc:
        return _extract_failure_deviation("goalkeeping-completeness", meta, exc)
    return []


def _check_goalkeeping_counts(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain E's Self-Validation checks, re-run as gate deviations (AC 3).

    A report that does not extract yields no deviation *here* (goalkeeping-completeness's,
    domain-a-completeness's or anchor-coverage's finding). Every check is page-internal, so
    no sibling payload is needed.
    """
    try:
        payload = _domain_e_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    return _failed_check_deviations("goalkeeping-counts", meta, domain_e_checks(payload))


def _check_set_plays_completeness(
    doc: "pymupdf.Document", meta: ReportMeta
) -> list[Deviation]:
    """Both teams' set-plays pages extract with their full label inventory (AC 2, AC 3).

    Same attribution rules as `domain-b-completeness`: typed `ExtractError` failures — a
    missing KPI or table label, a row with the wrong value count, a page whose
    numeric-word census departs from the corpus-invariant 24 — are probe-failure findings
    naming the class; a raising `PipelineError` propagates once to the runner.
    """
    try:
        _domain_f_payload(doc, meta)
    except ExtractError as exc:
        return _extract_failure_deviation("set-plays-completeness", meta, exc)
    return []


def _check_set_plays_counts(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """Domain F's Self-Validation checks, re-run as gate deviations (AC 2, AC 3)."""
    try:
        payload = _domain_f_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    return _failed_check_deviations("set-plays-counts", meta, domain_f_checks(payload))


register_check(
    Check(
        check_id="goalkeeping-completeness",
        applies_to=lambda meta: True,
        run=_check_goalkeeping_completeness,
    )
)
register_check(
    Check(
        check_id="goalkeeping-counts",
        applies_to=lambda meta: True,
        run=_check_goalkeeping_counts,
    )
)
register_check(
    Check(
        check_id="set-plays-completeness",
        applies_to=lambda meta: True,
        run=_check_set_plays_completeness,
    )
)
register_check(
    Check(
        check_id="set-plays-counts",
        applies_to=lambda meta: True,
        run=_check_set_plays_counts,
    )
)


# One-slot memo for `_pass_network_payload`, same shape and justification as the memos
# above (Story 1.14): the runner hands the same open document to `pass-network-completeness`
# and then `pass-network-counts`, and each uncached call rebuilds the full-text
# `PageTextIndex` and re-parses both pass-network pages plus the Domain A lineups they
# join to. Copied, not refactored — this is the TWELFTH instance, and the memo pattern
# carries OPEN deferred-work entries (strong doc ref, replayed cached exceptions) that a
# shared abstraction would have to inherit anyway; the runner-owned parse-handoff that
# retires all twelve is ledgered as a single joint fix.
_pass_network_memo: dict = {"doc": None, "result": None, "error": None}

# Derived from the parser's own anchor-stem constant so the gate's anchor list and the
# parser's can never drift (the `domain_e.py` precedent). `offers-*` and `movement-*` are
# deliberately NOT the prefix here either: `offers-count-match` is test_checks_registry's
# unclaimed placeholder and `register_check` raises on duplicates.
_PASS_NETWORK_ANCHOR_IDS: "tuple[str, ...]" = tuple(
    f"{PASS_NETWORK_ANCHOR_STEM}:{side}" for side in ("home", "away")
)


def _pass_network_payload(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    """The pass-network payload for one report, or `None` when it cannot be attempted.

    `None` covers both skip paths, exactly as `_domain_g_payload` does: a pass-network
    anchor did not resolve (anchor-coverage's finding), or Domain A did not extract,
    which leaves the lineups every matrix endpoint joins to unavailable (a
    `domain-a-completeness` finding). Re-reporting either under a `pass-network-*` id is
    the double attribution the 1.6 review patched out.
    """
    if _pass_network_memo["doc"] is not doc:
        _pass_network_memo.update(doc=doc, result=None, error=None)
        try:
            _pass_network_memo["result"] = _pass_network_uncached(doc, meta)
        except Exception as exc:
            _pass_network_memo["error"] = exc
    if _pass_network_memo["error"] is not None:
        raise _pass_network_memo["error"]
    return _pass_network_memo["result"]


def _pass_network_uncached(doc: "pymupdf.Document", meta: ReportMeta) -> "dict | None":
    # `_domain_anchor_pages`, never a hand-rolled `resolve_anchors` loop: the 2026-07-27
    # review patch removed exactly that inlined copy from `receiving`, where a registry
    # that no longer carried a spec silently left the id OUT of the map and surfaced an
    # authoring bug as report data on all 104 reports. Four older domains still carry the
    # unpatched shape, so this one copies the PATCHED neighbour deliberately.
    anchors = _domain_anchor_pages(doc, meta, _PASS_NETWORK_ANCHOR_IDS)
    if anchors is None:
        return None
    try:
        domain_a = _domain_a_payload(doc, meta)
    except PipelineError:
        return None
    if domain_a is None:
        return None
    return extract_pass_network(doc, anchors, domain_a["lineups"], report_id=meta.report_id)


def _check_pass_network_completeness(
    doc: "pymupdf.Document", meta: ReportMeta
) -> list[Deviation]:
    """The matrix parses and every endpoint joins to the lineup, typed (AC 1, AC 3).

    This is where AC 3's "join integrity" reaches the deviation summary: an endpoint that
    matches no lineup player, or whose shirt number disagrees with the matched entry,
    surfaces here as a `probe-failure` carrying `PlayerJoinError` and its message. So does
    every structural failure of the matrix grammar (`PassNetworkParseError`) — including
    the page's two standing NEGATIVE assertions, so a template that starts drawing a pitch
    or markers aborts loud in the gate rather than publishing `node_positions: null`
    forever. Same attribution rules and the same non-`PipelineError` caveat as
    `domain-g-completeness`.
    """
    try:
        _pass_network_payload(doc, meta)
    except ExtractError as exc:
        return _extract_failure_deviation("pass-network-completeness", meta, exc)
    return []


def _check_pass_network_counts(doc: "pymupdf.Document", meta: ReportMeta) -> list[Deviation]:
    """The pass network's Self-Validation checks, re-run as gate deviations (AC 3).

    A report that does not extract yields no deviation *here* (completeness's,
    domain-a-completeness's or anchor-coverage's finding). The two cross-domain BOUNDS
    need Domain G's per-player rows and Domain B's Key Statistics, so they reuse those
    memos rather than a third parse of the same pages; a report whose Domain G or Domain B
    raises simply runs WITHOUT that bound, because a sibling parse failure is that
    domain's finding. The page-internal Top-5 check needs neither and always runs.
    """
    try:
        payload = _pass_network_payload(doc, meta)
    except PipelineError:
        return []
    if payload is None:
        return []
    try:
        player_stats = _domain_g_payload(doc, meta)
    except PipelineError:
        player_stats = None
    try:
        key_statistics = _domain_b_payload(doc, meta)
    except PipelineError:
        key_statistics = None
    return _failed_check_deviations(
        "pass-network-counts",
        meta,
        pass_network_checks(
            payload, player_stats=player_stats, key_statistics=key_statistics
        ),
    )


register_check(
    Check(
        check_id="pass-network-completeness",
        applies_to=lambda meta: True,
        run=_check_pass_network_completeness,
    )
)
register_check(
    Check(
        check_id="pass-network-counts",
        applies_to=lambda meta: True,
        run=_check_pass_network_counts,
    )
)

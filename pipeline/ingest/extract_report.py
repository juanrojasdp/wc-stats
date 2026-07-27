"""The pure per-report Extract phase of AD-9: one PDF in, one Extraction Record out.

Zero cross-report knowledge, by construction. `probe_report` (this report's own cover),
never `probe_corpus`; and never `assign_matchday_rounds` — group matchdays are derived by
walking every fixture in a group, so `matchday_round` is corpus-level. Putting it in a
record would inject corpus knowledge into a function AD-9 requires to be pure *and* break
byte-identity: the same PDF extracted alone and extracted as one of 104 would produce
different records. The record stores `stage_text` and `group` verbatim — both are printed
on that report's own cover — and the matchday round stays precompute's business.

For the same reason there is no timestamp, no run counter, and no absolute path anywhere
in a record, and nothing is read from `pmsr-corpus/manifest.csv` (that file is download
provenance, not pipeline input — every fact needed here is on the PDF's own cover).

Pages are located by text anchor, never by index: the PDF header lies about the page
count (claims 8, reports run ~52). Anchors are resolved through `PageTextIndex`, which
extracts each page's text once per document rather than once per anchor — the naive walk
is ~18x slower over 47 anchors, measured in Story 1.4.

Story 1.2 filled identity, anchors and the idempotence keys; Story 1.3 plugged the shots
parser into `domains` and made `self_validation` real (marker count vs the attempts
table, exact and binary); Story 1.6 added Domain A (`domains["match_metadata"]`: the
normalized cover block plus the lineup-page parse) and its six appended checks; Story
1.7 added Domains B and C (`key_statistics`, `tactical_identity`) and their appended
checks; Story 1.11 the crosses map and Story 1.12 the defensive-actions maps; Story 1.10
Domain G (`player_stats`: the four per-player page families, joined to Domain A's
lineups) and its four appended checks. Stories 1.8-1.14 keep plugging into the same two
seams.
"""

from __future__ import annotations

from pathlib import Path

import pymupdf

from pipeline.discover.anchors import ANCHOR_REGISTRY, ResolvedAnchor, resolve_anchors
from pipeline.discover.errors import MissingAnchorError, ProbeError
from pipeline.discover.probe import ReportMeta, probe_report
from pipeline.discover.text import PageTextIndex
from pipeline.errors import PipelineError
from pipeline.extract import aggregate_self_validation
from pipeline.extract.domain_a import domain_a_checks, extract_domain_a
from pipeline.extract.domain_b import domain_b_checks, extract_domain_b
from pipeline.extract.domain_c import domain_c_checks, extract_domain_c
from pipeline.extract.domain_g import domain_g_checks, extract_domain_g
from pipeline.ingest.fingerprint import PIPELINE_ROOT, code_version, pdf_content_hash
from pipeline.ingest.identity import match_id_for, match_number_for
from pipeline.ingest.records import RECORD_VERSION
from pipeline.markers.crosses import crosses_self_validation_block, parse_crosses
from pipeline.markers.defensive_actions import (
    defensive_actions_self_validation_block,
    parse_defensive_actions,
)
from pipeline.markers.linking import link_rate_checks
from pipeline.markers.shots import parse_shots, self_validation_block

REPO_ROOT = PIPELINE_ROOT.parent


def relative_source_path(path: "str | Path") -> str:
    """The PDF's path as a repo-relative posix string.

    A record must not carry an absolute path: two machines would then produce different
    records for the same bytes and AC 3's byte-identity would hold only per checkout.

    The real corpus lives *inside* the repo at `pmsr-corpus/` (gitignored via `*.pdf`), so
    the repo-relative branch is what the 104-report run takes:
    `"source_pdf": "pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf"`. The fallback exists for a PDF
    with no repo-relative form at all — a `tmp_path` fixture, or a corpus mounted
    elsewhere — and records it by bare file name. Two same-named PDFs in different
    out-of-repo directories therefore record the same `source_pdf`; the report id, not
    this field, is the manifest's join key, and the manifest names the input directory.
    """
    path = Path(path)
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.name


def _metadata_block(meta: ReportMeta, match_number: int) -> dict:
    """This report's own cover, verbatim. No corpus-level field may appear here."""
    return {
        "home_team": meta.home_team,
        "away_team": meta.away_team,
        "home_score": meta.home_score,
        "away_score": meta.away_score,
        "match_number": match_number,
        "stage_text": meta.stage_text,
        "group": meta.group,
        "match_date": meta.match_date.isoformat(),
        "kickoff": meta.kickoff,
        "venue": meta.venue,
        "shootout": meta.shootout,
        "probe_notes": list(meta.probe_notes),
    }


def _resolve_anchor_pages(
    index: PageTextIndex, resolved: "list[ResolvedAnchor]"
) -> "tuple[dict[str, list[int]], list[str]]":
    """Map every already-resolved anchor to its pages, honouring `at_page_start`.

    A required anchor that does not resolve raises `MissingAnchorError`, which fails
    *this* report loud with its id and the anchor text. An optional anchor that does not
    resolve is omitted from the map and named in `warnings` — never silently dropped.

    Takes the *resolved* anchors rather than the registry: `resolve_anchors` raises bare
    `ValueError`/`KeyError` for a malformed `AnchorSpec`, and those are authoring bugs
    that must not be caught by this report's page-reading handler. Resolving before the
    PDF is opened is what keeps that structurally impossible.
    """
    anchors: dict[str, list[int]] = {}
    warnings: list[str] = []
    for anchor in resolved:
        try:
            anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
        except MissingAnchorError:
            if anchor.required:
                raise
            warnings.append(
                f"optional anchor {anchor.anchor_id!r} did not resolve: {anchor.text!r}"
            )
    return anchors, warnings


def extract_report(path: "str | Path", content_hash: str | None = None) -> dict:
    """Extract one PMSR report into an Extraction Record.

    Raises `ProbeError` (cover unreadable), `MatchNumberError` / `TeamSlugError` /
    `MatchIdFormatError` (identity could not be established), `MissingAnchorError` (a
    required section is gone), the shots parser's typed errors (`PitchFrameError`,
    `UnknownRgbError`, `AttemptsTableError`, `ShotsPageLayoutError`), the crosses
    parser's (Story 1.11: `CrossesPageLayoutError`, `CrossesTableError`,
    `UnknownLabelError`, `CrossesCoordinateError`, plus the shared-chain errors), the
    defensive-actions parser's (Story 1.12: `DefensiveActionsPageLayoutError`,
    `DefensiveActionsTableError`, `DefensiveActionsCoordinateError`), Domain A's
    (`MissingFieldError`, `LineupParseError`, `LineupCountError`, `UnknownStageError`,
    `UnknownVenueError`, `UnknownPositionError`, `UnknownMinuteGlyphError`), Domain B's
    (`StatisticsParseError`, `UnknownStatisticError`, `MissingFieldError`,
    `MalformedFieldError`), Domain C's (`PhasesParseError`, `LineHeightParseError`,
    `UnknownStatisticError`, `MissingFieldError`), or Domain G's (Story 1.10:
    `PlayerTableParseError`, `PlayerJoinError`, `MalformedFieldError`,
    `MissingFieldError`). The batch runner turns each into a
    `failed` manifest entry; nothing is caught here, because a partial record is worse
    than none.

    `content_hash` lets the caller hand in the SHA-256 it already computed for the skip
    decision. Passing it avoids a second full read of a multi-megabyte file 104 times per
    cold run, and — more than a saving — closes the seam where the hash the batch compared
    against and the hash written into the record were sampled at two different instants.

    Writes nothing: persistence is `records.write_record`'s job.
    """
    path = Path(path)
    meta = probe_report(path)
    match_number = match_number_for(meta, path)
    match_id = match_id_for(meta, path)

    # Resolved *outside* the try below, and before the PDF is opened. `resolve_anchors`
    # raises bare `ValueError`/`KeyError` for a malformed `AnchorSpec`, and
    # `discover/anchors.py` says those "fail loudly at resolution time rather than
    # surfacing as a phantom missing anchor across all 104 reports". Inside the handler a
    # registry typo would be rewritten as this report's `ProbeError` — turning one
    # authoring bug into 104 identical failed entries blaming the corpus.
    resolved = resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team)

    try:
        doc = pymupdf.open(path)
    except Exception as exc:
        raise ProbeError(f"could not read report pages: {exc}", meta.report_id) from exc

    with doc:
        try:
            index = PageTextIndex(doc, meta.report_id)
            page_count = len(index)
            anchors, warnings = _resolve_anchor_pages(index, resolved)
        except PipelineError:
            # MissingAnchorError and ProbeError travel as themselves.
            raise
        except Exception as exc:
            # Only a genuine page-reading failure of this PDF can reach here now.
            raise ProbeError(f"could not read report pages: {exc}", meta.report_id) from exc

        # Deliberately outside the handler above: the shots parser raises its own typed
        # errors (PitchFrameError, UnknownRgbError, ...), and a bug in parser code must
        # surface as itself, not be relabeled as this report's page-reading ProbeError.
        shots = parse_shots(doc, anchors, meta.report_id, meta.home_team, meta.away_team)

        # Story 1.11, same transparency rule: the crosses parser's typed errors
        # (CrossesPageLayoutError, CrossesTableError, UnknownRgbError, ...) travel as
        # themselves.
        crosses = parse_crosses(doc, anchors, meta.report_id, meta.home_team, meta.away_team)

        # Story 1.12, same transparency rule: the defensive-actions parser's typed errors
        # (DefensiveActionsPageLayoutError, DefensiveActionsTableError, UnknownRgbError,
        # ...) travel as themselves.
        defensive_actions = parse_defensive_actions(
            doc, anchors, meta.report_id, meta.home_team, meta.away_team
        )

        # Same transparency rule for Domain A (Story 1.6): its typed errors
        # (MissingFieldError, UnknownVenueError, LineupParseError, ...) travel as
        # themselves. The probed cover block goes in as-is and comes back normalized —
        # the cover is never re-parsed here.
        metadata = _metadata_block(meta, match_number)
        match_metadata = extract_domain_a(doc, metadata, anchors, report_id=meta.report_id)

        # Domains B and C (Story 1.7), same transparency rule: their typed errors
        # travel as themselves. Pure over this report's own anchored pages only.
        key_statistics = extract_domain_b(
            doc, anchors, meta.report_id, meta.home_team, meta.away_team
        )
        tactical_identity = extract_domain_c(doc, anchors, report_id=meta.report_id)

        # Domain G (Story 1.10), same transparency rule. The first extractor that takes
        # another domain's output: the Domain A lineups it joins to are handed in from
        # the payload already parsed above, never re-parsed from the page.
        player_stats = extract_domain_g(
            doc, anchors, match_metadata["lineups"], report_id=meta.report_id
        )

    warnings.extend(f"probe note: {note}" for note in meta.probe_notes)
    # Story 1.12: the documented absence of a printed counterpart for the
    # possession-regain map travels as a per-report warning (never as a non-"pass" check,
    # which the strictly binary aggregator would read as a failure). `batch.py` mirrors
    # record warnings into the manifest entry.
    warnings.extend(defensive_actions["warnings"])

    # Each domain APPENDS its checks and the result re-aggregates over whatever checks
    # are actually present, so domain stories compose without clobbering one another.
    self_validation = self_validation_block(shots["counts"])
    # Story 1.5: per-team link-rate checks appended beside the marker-count checks —
    # Self-Validation is now the full binary check, exact marker count AND 100% link
    # rate (FR-14, complete).
    self_validation["checks"].extend(
        link_rate_checks(shots["shot_events"], meta.home_team, meta.away_team)
    )
    self_validation["checks"].extend(domain_a_checks(match_metadata))
    # Story 1.7: both payloads are in hand here, so the shots reconciliation check
    # (Key Statistics printed attempts vs the attempts-TABLE row count) is computed at
    # this seam via `shots_counts` — the Domain B parser itself stays single-source.
    self_validation["checks"].extend(
        domain_b_checks(key_statistics, shots_counts=shots["counts"])
    )
    self_validation["checks"].extend(domain_c_checks(tactical_identity))
    # Story 1.11: the crosses marker-count checks append after every existing appender;
    # the counterpart is the crosses page's OWN table total, never Key Statistics.
    self_validation["checks"].extend(crosses_self_validation_block(crosses["counts"]))
    # Story 1.12: appended after every existing appender. One check per team per marker
    # family that HAS an established printed counterpart — the forced-turnover map only;
    # the possession-regain map's absence is carried by the warning above (AC 2).
    self_validation["checks"].extend(
        defensive_actions_self_validation_block(defensive_actions["counts"])
    )
    # Story 1.10: appended after every existing appender. Both sibling payloads are in
    # hand at this seam, so the two cross-domain checks (per-player distance vs the
    # Domain B team total; per-player goals plus the opponent's Domain A own-goal ledger
    # vs the Domain B team goals) are computed here — the Domain G parser stays
    # single-source, the 1.7 `shots_counts` precedent.
    self_validation["checks"].extend(
        domain_g_checks(
            player_stats,
            key_statistics=key_statistics,
            lineups=match_metadata["lineups"],
        )
    )
    self_validation["result"] = aggregate_self_validation(self_validation["checks"])

    return {
        "record_version": RECORD_VERSION,
        "match_id": match_id,
        "report_id": meta.report_id,
        "source_pdf": relative_source_path(path),
        "idempotence": {
            "pdf_content_hash": content_hash if content_hash is not None else pdf_content_hash(path),
            "code_version": code_version(),
        },
        "metadata": metadata,
        "page_count": page_count,
        "anchors": anchors,
        # Further domains filled by Stories 1.8-1.14.
        "domains": {
            "match_metadata": match_metadata,
            "shots": shots,
            "key_statistics": key_statistics,
            "tactical_identity": tactical_identity,
            "crosses": crosses,
            "defensive_actions": defensive_actions,
            "player_stats": player_stats,
        },
        # Real from Story 1.3 on: once extractors run, the result is "pass" or "fail",
        # never left "not-applicable" (a failed consistency check is data, not an
        # exception — the record still stages so the gate can localize it).
        "self_validation": self_validation,
        "warnings": warnings,
    }

"""Typed failures raised by ingestion (AD-8: fail loud, never skip silently).

One exception per failure class, each carrying the report id, so the run manifest can
record `type(exc).__name__` and a message that localizes the problem without a debugger.
The batch runner catches these per report — a failure lands in that report's manifest
entry and the run continues to the next report.

`MissingAnchorError` and `ProbeError` are deliberately *not* redefined here: discovery
already owns them, and the manifest names the real failure class either way.
"""

from __future__ import annotations

from pipeline.errors import PipelineError


class IngestError(PipelineError):
    """Base class for ingestion failures."""


class MatchNumberError(IngestError):
    """The report's match number could not be established from cover *and* filename.

    Both sources are required to agree: the filename is a human-managed download
    artifact and the cover is authoritative content, so a mis-named download becomes a
    loud `failed` entry rather than a record emitted under another match's identity.
    """

    def __init__(self, reason: str, report_id: str | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] match number could not be established: {reason}")


class TeamSlugError(IngestError):
    """A printed team name does not reduce to a usable slug.

    Distinct from `MatchNumberError`: the match number was established fine, but the name
    the cover prints cannot become an id component. An empty slug would produce `m001--rsa`
    — an id that reads as valid to a careless eye and matches no team anywhere downstream.
    """

    def __init__(self, reason: str, report_id: str | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] team name could not be slugged: {reason}")


class MatchIdFormatError(IngestError):
    """The assembled match id does not satisfy the contract's `MatchId` pattern.

    A guard against a cover whose team names slug into something the pattern rejects, or
    into the same slug twice. Caught here rather than in Story 1.16, which would otherwise
    discover it with 104 records already staged under bad ids.
    """

    def __init__(self, reason: str, report_id: str | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] derived match id is not usable: {reason}")


class DuplicateMatchIdError(IngestError):
    """Two PDFs in one run derive the same match id.

    `work/extracted/` is keyed by match id, so a silent second write would overwrite the
    first report's record and lose it entirely. Both reports fail instead.
    """

    def __init__(self, match_id: str, other_report_id: str, report_id: str | None = None) -> None:
        self.match_id = match_id
        self.other_report_id = other_report_id
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(
            f"[{where}] duplicate match id {match_id!r}: collides with {other_report_id!r}"
        )


class DuplicateReportIdError(IngestError):
    """Two files in one run share a filename stem.

    The stem *is* the report id — the manifest's join key and the key every downstream
    mapping uses — so a collision would silently drop one of the two reports rather than
    process it. Seen in practice as `a.pdf` beside `a.PDF`.
    """

    def __init__(self, other_name: str, report_id: str | None = None) -> None:
        self.other_name = other_name
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] duplicate report id: collides with {other_name!r}")


class RecordWriteError(IngestError):
    """The Extraction Record could not be written.

    Wraps the underlying `OSError` while keeping the report id, so an unwritable staging
    directory is attributed to the report it stopped rather than crashing the batch.
    """

    def __init__(self, reason: str, report_id: str | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] extraction record could not be written: {reason}")

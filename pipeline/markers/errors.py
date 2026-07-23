"""Typed failures raised by marker extraction (AD-8: fail loud, never skip silently).

One class per failure kind — never one class for two — so a manifest `error_type` names
what actually broke and the 1.4 gate can localize it to venue/matchday. Every error
carries the report id and formats its message `[{report_id}] ...`, matching the
discovery errors' convention. Story 1.3 Tasks 1-3; ACs 1-4.
"""

from __future__ import annotations

from pipeline.errors import PipelineError


class MarkerError(PipelineError):
    """Base class for marker-extraction failures."""


class PitchFrameError(MarkerError):
    """No qualifying pitch rectangle was found on a map page.

    Loud by design: a map page without a detectable pitch frame is a template revision,
    exactly the signal the venue x matchday gate exists to surface — never a skip.
    """

    def __init__(self, reason: str, report_id: str | None = None, page_index: int | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        self.page_index = page_index
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] pitch frame not detected on page {page_index}: {reason}")


class UnknownRgbError(MarkerError):
    """A marker fill is not in the exact-RGB outcome palette.

    Carries the rounded RGB tuple and the 0-based page index (AC 3 names both). This
    aborts the report's extraction: an off-palette marker is either a template revision
    or a new outcome type, and silently dropping it would fabricate a marker count.
    """

    def __init__(self, rgb: "tuple[float, ...]", page_index: int, report_id: str | None = None) -> None:
        self.rgb = rgb
        self.page_index = page_index
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(
            f"[{where}] marker fill rgb {rgb} on page {page_index} is not in the outcome palette"
        )


class AttemptsTableError(MarkerError):
    """The tabular attempts table could not be parsed into a row count.

    Never fall back to the marker count: Self-Validation comparing the marker count to
    itself is a tautology, not a check.
    """

    def __init__(self, reason: str, report_id: str | None = None, page_index: int | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        self.page_index = page_index
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] attempts table on page {page_index} unparseable: {reason}")


class ShotsPageLayoutError(MarkerError):
    """A shots anchor did not resolve to [map page, event-table page(s)].

    Carries the anchor id and the page list it actually resolved to. The map page is
    always first and the table takes at least one further page (up to two on the real
    corpus, when a team's attempts overflow one table page) — fewer than two anchored
    pages means a template revision, and must fail loud rather than parse the wrong page.
    """

    def __init__(self, anchor_id: str, pages: "list[int] | None", report_id: str | None = None) -> None:
        self.anchor_id = anchor_id
        self.pages = pages
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(
            f"[{where}] anchor {anchor_id!r} resolved to pages {pages}, "
            "expected [map page, event-table page(s)]"
        )

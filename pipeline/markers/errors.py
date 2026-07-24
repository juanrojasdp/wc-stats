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


class UnknownLabelError(MarkerError):
    """An attempts-table cell label is not in its frozen label -> enum mapping.

    Assert-on-unknown, the `UnknownRgbError` precedent: an unmapped Outcome / Body Part /
    Delivery Type label is either a template revision or a corpus value the contract does
    not know, and silently skipping or guessing it would fabricate event data. Carries the
    column, the verbatim label and the 0-based page index.
    """

    def __init__(
        self,
        column: str,
        label: str,
        page_index: "int | None" = None,
        report_id: "str | None" = None,
    ) -> None:
        self.column = column
        self.label = label
        self.page_index = page_index
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(
            f"[{where}] {column} label {label!r} on page {page_index} "
            "is not in the known label mapping"
        )


class AttemptRowError(MarkerError):
    """An attempts-table row is structurally malformed.

    A row that leads with a Time value but then resists the row grammar — no shirt
    number opening the Player cell, an empty player name, a Time cell that is not a
    single integer — is a parser-breaking template revision, never a row to skip: a
    skipped row would silently shift every later ordinal's join by one.
    """

    def __init__(
        self, reason: str, report_id: "str | None" = None, page_index: "int | None" = None
    ) -> None:
        self.reason = reason
        self.report_id = report_id
        self.page_index = page_index
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] attempts-table row on page {page_index} malformed: {reason}")


class CrossesPageLayoutError(MarkerError):
    """A crosses anchor did not resolve to exactly one page (Story 1.11).

    Carries the anchor id and the page list it actually resolved to. The crosses
    section is a single page — map, legend, stat panels and the per-player delivery
    table together — on all 208 corpus pages (Task 1 probe). More or fewer anchored
    pages is a template revision, never a page to guess at.
    """

    def __init__(self, anchor_id: str, pages: "list[int] | None", report_id: str | None = None) -> None:
        self.anchor_id = anchor_id
        self.pages = pages
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(
            f"[{where}] anchor {anchor_id!r} resolved to pages {pages}, "
            "expected exactly one crosses page"
        )


class CrossesTableError(MarkerError):
    """The crosses page's per-player delivery table resists the house grammar.

    A missing/ambiguous header, an unexpected or missing header word, a shirt-led row
    without seven numeric tail cells or a printed name, or a row whose Total Attempted
    does not equal the sum of its six delivery counts — each is a template revision,
    and the fallback is never the marker count (Self-Validation comparing the marker
    count to itself is a tautology, the `AttemptsTableError` rule).
    """

    def __init__(self, reason: str, report_id: str | None = None, page_index: int | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        self.page_index = page_index
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] crosses table on page {page_index} unparseable: {reason}")


class CrossesCoordinateError(MarkerError):
    """A cross marker normalized to a coordinate outside the tolerated [0, 100] envelope.

    The pitch margin admits touchline centers a fraction of a point beyond the frame
    (normalizing to at most ~100.1, and at most ~0.4 beyond either edge for the 1.0 pt
    crosses margin), and those sub-tolerance overshoots clamp into [0, 100]. A coordinate
    further out than the tolerance is a mis-normalization — a wrong or undersized pitch
    rect, an orientation flip, or a stray glyph admitted through the margin — never a real
    cross, so it fails loud rather than being silently clamped to a plausible boundary
    (AD-8; Code Review 2026-07-24). Carries the axis, the pre-clamp value and the page.
    """

    def __init__(
        self, axis: str, value: float, report_id: str | None = None, page_index: int | None = None
    ) -> None:
        self.axis = axis
        self.value = value
        self.report_id = report_id
        self.page_index = page_index
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(
            f"[{where}] cross marker {axis}={value} on page {page_index} is outside the "
            "tolerated [0, 100] coordinate envelope"
        )


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

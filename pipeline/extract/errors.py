"""Typed failures raised by per-domain extraction (AD-8: fail loud, never guess).

One exception per failure class, each carrying the report id, so the run manifest can
record `type(exc).__name__` and a message that localizes the problem without a debugger.
The batch runner catches these per report — a failure lands in that report's manifest
entry and the run continues to the next report. Never overload one class for two failure
kinds, and never raise a bare `ValueError` for report data.
"""

from __future__ import annotations

from pipeline.errors import PipelineError


class ExtractError(PipelineError):
    """Base class for per-domain extraction failures."""

    def __init__(self, reason: str, report_id: str | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] {self.what}: {reason}")

    # Subclasses override with the phrase that names their failure class in messages.
    what = "extraction failed"


class MissingFieldError(ExtractError):
    """A field the addendum §6 inventory requires is missing or empty (AC 1).

    The message MUST name the missing field: a Domain A payload is all-or-nothing per
    report, and "something was missing" localizes nothing across 104 reports.
    """

    what = "required field missing"


class MalformedFieldError(ExtractError):
    """A required field is present but its value has the wrong shape (AC 1, AD-8).

    Distinct from `MissingFieldError` by the module rule above — "missing" and
    "present but malformed" are two failure kinds, and a gate operator triaging
    deviations must not read "field missing" for a field whose value is printed right
    there in the message. The message names the field and carries the offending value.
    """

    what = "field value malformed"


class LineupParseError(ExtractError):
    """The lineup page's structure does not match the two-column template grammar.

    Covers everything structural: a player row outside STARTING/SUBSTITUTES, a name that
    assembles to nothing, a minute marker no player row claims, a shirt number outside
    1-99, a minute outside the contract clock bounds.
    """

    what = "lineup page did not parse"


class UnknownPositionError(ExtractError):
    """A position code outside the closed GK/DF/MF/FW set (AD-3, never fuzzy-matched)."""

    what = "unknown position code"


class UnknownStageError(ExtractError):
    """A stage line outside the closed corpus-enumerated wording map (AD-3)."""

    what = "unknown stage text"


class UnknownVenueError(ExtractError):
    """A venue string absent from the committed venue -> UTC-offset table (AD-7).

    Deliberately loud: silently defaulting an offset would stamp a plausible but wrong
    kickoff instant on every match at that venue.
    """

    what = "unknown venue"


class UnknownMinuteGlyphError(ExtractError):
    """A minute marker whose adjacent vector glyph cannot be classified (AD-8).

    The page carries the marker *kind* (goal / own goal / sub / card) only as a coloured
    icon, so an unknown fill RGB — or zero or several candidate glyphs — means the kind
    would be a guess. Guessing is forbidden; dropping the marker silently is worse.
    """

    what = "minute marker glyph not classifiable"


class LineupCountError(ExtractError):
    """The page yields an impossible count of a structural element.

    A column with no starters, or a page without exactly two formation strings, is not a
    parseable lineup at all — distinct from `LineupParseError` (a row that resists the
    grammar) and from Self-Validation count checks (which are recorded, not raised).
    """

    what = "lineup element count impossible"

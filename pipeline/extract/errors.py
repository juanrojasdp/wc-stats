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


class StatisticsParseError(ExtractError):
    """The Key Statistics page's layout or a row resists the stat-row grammar (Story 1.7).

    Covers everything structural about the page: the anchor resolving to zero or several
    pages, a missing or side-swapped team-name row (AD-8's silent home/away swap failure
    mode), a possession bar without exactly three percentage values, or a stat row whose
    value spans do not flank its label. Value-level failures are NOT this class:
    a present-but-wrong-type value is `MalformedFieldError`, an unrecognized row label is
    `UnknownStatisticError`, an absent required row is `MissingFieldError`.
    """

    what = "key statistics page did not parse"


class PhasesParseError(ExtractError):
    """The Phases of Play page's structure does not match the template grammar (1.7).

    A missing section header, a phase row without exactly one percentage span on each
    side of its label, a duplicated phase row, or the anchor resolving to zero or
    several pages. Label- and value-level failures carry their own classes, as for
    `StatisticsParseError`.
    """

    what = "phases of play page did not parse"


class LineHeightParseError(ExtractError):
    """A Line Height & Team Length page resists the three-panel grammar (Story 1.7).

    The pages carry no textual key for what each printed metre value measures — only a
    drawn measurement bracket per value — so this class also covers every vector-side
    failure: a panel count other than three, a metre-value count other than nine, an
    unknown panel header, or a value whose bracket cannot be classified as exactly one
    of line height / team length / team width. Classification is never guessed (AD-8).
    """

    what = "line-height page did not parse"


class UnknownStatisticError(ExtractError):
    """A stat or phase row label outside the closed corpus-enumerated label set (AD-3).

    Deliberately loud, never fuzzy-matched: a new or reworded row is a template revision
    the extractor has never seen, and absorbing it silently — or dropping it — would
    stage a plausible but incomplete Key Statistics or Phases block.
    """

    what = "unknown statistic label"

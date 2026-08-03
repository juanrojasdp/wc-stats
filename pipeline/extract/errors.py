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


class PlayerTableParseError(ExtractError):
    """A Domain G per-player page resists the table grammar (Story 1.10).

    Everything structural about the four page families: an anchor resolving to zero or
    several pages, a page with no player rows at all, a row carrying the wrong number of
    numeric values, a non-numeric token in the value area, or the four families
    disagreeing on which players the page set lists. Value-level failures keep their own
    classes, as for `StatisticsParseError`: a present-but-wrong-type value is
    `MalformedFieldError`, a player with minutes and no row is `MissingFieldError`, and a
    row that matches no lineup player is `PlayerJoinError`.
    """

    what = "per-player page did not parse"


class MomentumChartError(ExtractError):
    """The momentum bar chart's structure resists the template grammar (Story 1.8).

    Everything structural about the chart: the anchor resolving to zero or several pages,
    a gridline set that is not the nine evenly-spaced value lines the template draws, a
    baseline that is not single-valued or does not sit on the middle gridline, a bar
    outside the plot box, a bar whose centre does not land on a slot, or two bars of the
    same colour in one slot. Scale failures are `MomentumScaleError`, axis-label failures
    `MomentumAxisError`, clock failures `MomentumClockError`, and an off-palette bar fill
    `MomentumFillError` — five failure kinds, five classes, per the module rule above.
    """

    what = "momentum chart did not parse"


class MomentumFillError(ExtractError):
    """A bar-shaped path inside the chart box carries a fill outside the two-colour
    palette (AD-8, AD-9).

    The same phenomenon as an off-palette shots marker or an unclassifiable minute glyph,
    and it lands in the gate's `unknown-rgb` bucket for the same reason: the chart encodes
    which team a bar belongs to ONLY in its fill, so an unrecognized colour means the
    home/away attribution would be a guess. The filter is shape-first (AD-9): only paths
    with the bar's exact four-line item signature that sit inside the plot box are
    considered, so the lineup page's own glyphs can never reach this check.
    """

    what = "momentum bar fill not in the palette"


class MomentumScaleError(ExtractError):
    """The bar-height -> value scale cannot be established beyond doubt (Story 1.8).

    The chart auto-scales, so the pixels-per-unit factor is per-report and must be
    *derived*. Three independent derivations exist — the printed y-axis top label against
    the peak bar, the approximate GCD over every bar height, and the plot box's own half
    height — and this class is raised when they disagree, or when any bar height is not an
    integer multiple of the resolved unit. Deliberately loud: a silently wrong scale
    multiplies every value in the series by a constant, and nothing downstream would
    catch it (the series has no printed row total to reconcile against).
    """

    what = "momentum value scale unresolvable"


class MomentumAxisError(ExtractError):
    """The printed y-axis cannot be read (Story 1.8).

    A label column that is not the nine symmetric labels the template prints, a top label
    that is not a positive integer, or a column whose ends disagree. The top label is the
    ONLY printed counterpart this chart offers, so losing it means losing the one genuine
    cross-check on the scale — that is a template revision, not a value to guess.
    """

    what = "momentum y-axis unreadable"


class MomentumClockError(ExtractError):
    """The printed x-axis ticks cannot pin the slot -> match-clock mapping (Story 1.8).

    Slot spacing is per-report and stoppage time shifts every tick after half time, so the
    mapping is derived from the printed ticks on each report, never from a hard-coded
    formula. Raised when the ticks needed to pin it are absent or contradict each other,
    when a derived period boundary is impossible, or when a drawn slot falls outside the
    span the ticks describe.
    """

    what = "momentum match-clock mapping unresolvable"


class GoalkeepingPageParseError(ExtractError):
    """A Domain E goalkeeping page resists its family's grammar (Story 1.9).

    One class for everything structural across the four families, because they fail the
    same way and a gate operator triaging deviations wants "goalkeeping page did not
    parse" localized by the message, not by four near-identical class names: an anchor
    resolving to zero or several pages, a required KPI or table label the page does not
    print, a distribution page whose panel titles are not the four the template fixes,
    or a table row that does not yield its family's exact value count.

    Deliberately NOT this class: a value present but of the wrong type
    (`MalformedFieldError`), a required field the page does not print at all
    (`MissingFieldError`), the involvement chart's own geometry (`InvolvementChartError`),
    and the shared marker chain's `PitchFrameError` / `UnknownRgbError`, which travel as
    themselves so the gate keeps mapping an off-palette fill to `unknown-rgb` (the
    1.11/1.12 precedent).
    """

    what = "goalkeeping page did not parse"


class SetPlaysParseError(ExtractError):
    """The Set Plays page's structure does not match the template grammar (Story 1.9).

    The anchor resolving to zero or several pages, a missing KPI or table label, a
    corners or free-kick row that does not yield its exact value count, or a page whose
    numeric-word census departs from the corpus-invariant 24. Value-level failures keep
    their own classes, as for `StatisticsParseError`.
    """

    what = "set plays page did not parse"


class InvolvementChartError(ExtractError):
    """The GK involvement timeline's structure or scale cannot be established (1.9).

    The chart auto-scales, so the points-per-unit factor is per-report and must be
    derived twice — once from the printed y-axis labels and once from the drawn value
    gridlines — and this class is raised when the two disagree, when the label column is
    not the descending run ending at 0 that the template prints, when a dot falls outside
    the plot box, or when a dot's value is not a non-negative integer. Deliberately loud
    for the `MomentumScaleError` reason: a silently wrong unit multiplies every value in
    the series by a constant, and the printed total is a BOUND rather than an equality,
    so nothing downstream would catch it.
    """

    what = "goalkeeping involvement chart did not parse"


class InvolvementClockError(ExtractError):
    """The GK involvement timeline's slot -> match-clock mapping cannot be pinned (1.9).

    Separate from `InvolvementChartError` by the module rule above: that class is the
    chart's VALUE axis — the points-per-unit factor, the dots and their integrality —
    while this one is its TIME axis, read from a different source (the printed x-tick
    labels) and failing for entirely different reasons. A gate operator triaging a
    deviation histogram must be able to tell "the series values are unreadable" from
    "the series is readable but nobody knows which minute each slot is".

    Raised when a tick label is not one the template's grammar admits, when a tick does
    not land on a slot centre, when the ticks that pin a period boundary disagree with
    each other, when the derived periods are out of order or fall outside the drawn grid,
    or when a derived stoppage allotment exceeds what the contract's `StoppageMinute` can
    express. Every one of those is a mapping this parser must not guess: unlike the value
    axis there is no printed counterpart to reconcile a wrong clock against, so a silent
    off-by-one would place Story 2.10's whole timeline on the wrong minutes.
    """

    what = "goalkeeping involvement match-clock mapping unresolvable"


class PlayerJoinError(ExtractError):
    """A Domain G page row cannot be joined to this report's Domain A lineup (AC 2).

    Raised when a row's assembled name matches no lineup player on that side, when its
    shirt number disagrees with the matched lineup entry's, or when one side's lineup
    prints a name twice (which would silently collapse two players into one). The join
    is within-report name identity only — cross-report/normalized identity is Story
    1.15's — so this never fuzzy-matches and never falls back to the shirt number. The
    message carries the assembled name with `repr()`: a mis-inserted or missing space
    from row assembly is otherwise invisible in a name that looks right.
    """

    what = "player row did not join to the lineup"


class PassNetworkParseError(ExtractError):
    """The Passing Networks page's structure does not match the matrix grammar (1.14).

    One class for everything structural on this page: the anchor resolving to zero or
    several pages, a header band whose two leading cells are not `#` and `Passes From`,
    a column/row census that is not N x N, a row missing its blank or blanking a cell
    that is not its own diagonal, a cell that is not a non-negative ASCII integer, row
    order disagreeing with column order, a Top-5 panel that does not print exactly five
    percentages — and the page's two standing NEGATIVE assertions: a qualifying pitch
    rectangle or a filled all-Bezier drawing appearing where the corpus prints none.

    That last pair is the point of the class as much as the first: the whole `x`/`y`
    re-scope (AC 2, and the AD-14 filing it produced) rests on "this page carries no
    coordinates". If the vendor ever starts printing them, the corpus must abort loud
    rather than keep publishing `node_positions: null` forever.

    Deliberately NOT this class: a row that matches no lineup player or whose shirt
    number disagrees (`PlayerJoinError`), and a lineup player with minutes and no matrix
    row (`MissingFieldError`). Those two name exactly these failure kinds already, and
    the module rule above forbids overloading one class for two.
    """

    what = "pass-network page did not parse"

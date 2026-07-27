"""Momentum series extraction — the report's only per-minute two-team time series.

OQ-5, resolved by a full 104-report probe and re-verified here: the series is the vector
bar chart titled **"Distribution in the Final Third"**, drawn once per report at the foot
of the lineups page. It is a per-minute, per-team count of final-third distributions — not
a possession percentage and not an abstract momentum index. That distinction is recorded
in the contract's own description and in both READMEs; nothing here should be read as
implying "possession".

This is a chart reader, not a marker map: there is no pitch frame, no legend-row
exclusion and no linking, so it belongs in `pipeline/extract/` rather than
`pipeline/markers/`. What makes it tractable is that **the values are exactly recoverable
integers and the page prints its own y-axis**, so the scale is verifiable rather than
guessed.

Every geometric quantity except three is per-report and must be derived:

  * the **baseline** `y = 429.13`, the **peak bar height** `50.38 pt` and the **bar
    width / slot pitch ratio** `0.70` are corpus constants (104/104);
  * the **slot pitch** (1.95-2.95 pt) and the **value unit** (2.40-5.60 pt) are NOT —
    the chart box is a fixed width and the chart auto-scales, so both vary with the match
    length and the peak value. A fixed absolute bar-width window catches only 75 of 104
    reports; filter on the ratio.

Three independent pitch derivations are computed and asserted to agree (AD-8, fail loud):
the printed tick spacing, the plot box divided into whole slots, and the drawn bars' own
span.

The value unit is derived **geometrically**, as the approximate GCD over the bar heights,
and the printed y-axis top label is then compared against the peak's derived value as the
recorded `momentum-axis-scale` check. The split is deliberate: deriving the unit as
`peak / top_label` would make that check tautological — the peak would equal the printed
label by construction on every chart, including one whose axis is wrong. Geometry
contradicting itself (a non-integral height, a peak that no longer fills the axis half
height) fails loud; the printed axis contradicting the geometry is recorded, because that
is a finding for the ledger rather than an exception (SM-C1).

A silently wrong unit multiplies every value in the series by a constant, and — unlike
every other domain — there is **no printed row total to reconcile against**: the probe
tested the per-team bar sum against every numeric Domain B field over all 208
team-innings and the best exact-match rate was 2/208 (coincidence). The printed y-axis is
the one genuine printed counterpart the page offers, and it validates exactly the thing
that carries risk.

Staging is raw and snake_case (AD-7): integers and a flat `{minute, stoppage_minute}`
clock stamp. Derived floats (pitch, unit) never enter the record — two machines' float
noise would break AD-8 byte-identity.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

from pipeline.discover.text import normalize
from pipeline.extract import check_entry
from pipeline.extract.errors import (
    MomentumAxisError,
    MomentumChartError,
    MomentumClockError,
    MomentumFillError,
    MomentumScaleError,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# The chart title, and the id of the anchor spec that resolves it (Story 1.8, Task 2).
MOMENTUM_ANCHOR_ID = "momentum"

# Palette, measured on 104/104. Colour -> team is proven, not assumed: the legend swatch's
# own name is matched against this report's cover metadata by `_read_legend`.
HOME_FILL: "tuple[float, float, float]" = (1.0, 0.239, 0.0)
AWAY_FILL: "tuple[float, float, float]" = (0.702, 0.533, 1.0)
# The chart's horizontal value gridlines and the axis rule share this stroke.
GRID_STROKE: "tuple[float, float, float]" = (0.878, 0.878, 0.878)

# A bar is a filled path whose item ops are exactly four lines. Nothing else on the
# lineups page carries that signature inside the chart box (the goal markers draw 204
# lines, the legend swatches 20 curve-and-line ops, the gridlines a single line).
BAR_ITEM_OPS: "tuple[str, ...]" = ("l", "l", "l", "l")

# The template draws nine evenly-spaced value gridlines (a symmetric +/-peak axis) plus a
# tenth axis rule just below the bottom one. Taking max(y) naively puts the "half height"
# 0.75 pt too low and corrupts the geometric peak cross-check, so the run is kept
# explicitly. Nine on 104/104; any other count is a template revision.
VALUE_GRIDLINE_COUNT = 9

# Tolerances. All are far wider than the measured corpus spread (worst observed: pitch
# 0.001 pt, unit 3e-5 pt, integrality 1e-5, slot snap 3e-4) and far tighter than the
# smallest quantity they could confuse (the narrowest slot pitch is 1.95 pt, the smallest
# value unit 2.40 pt).
RGB_TOL = 0.005
GEOMETRY_TOL_PT = 0.05
PITCH_TOL_PT = 0.01
UNIT_TOL_PT = 0.01
SLOT_SNAP_TOL = 0.05
INTEGRALITY_TOL = 0.02
WIDTH_RATIO = 0.70
WIDTH_RATIO_TOL = 0.02

# Match-clock structure. Both halves run 45 regular minutes; both extra-time halves run
# 15. Slot 0 is match minute 1 — verified 104/104 by the printed 15/30/45 ticks landing on
# slots 14/29/44 with zero violations.
REGULATION_HALF = 45
EXTRA_TIME_HALF = 15

# The contract's `StoppageMinute` upper bound (`contract/common.schema.json`). The corpus
# measures H1 1-11, H2 3-19, ET1 0-4, ET2 1-11, so this is far above anything real — but a
# clock structure that implied more would stage a record Story 1.16 could not emit, and
# staging an unemittable record silently is exactly what AD-8 forbids. Derived here, never
# read from the contract: `/contract` is a field checklist for this pipeline, not an import
# target (Dev Notes, "Extraction Record").
MAX_STOPPAGE_MINUTE = 30


def _close(rgb, target) -> bool:
    """Whether a path colour is the target palette colour."""
    return (
        rgb is not None
        and len(rgb) == len(target)
        and all(abs(a - b) <= RGB_TOL for a, b in zip(rgb, target))
    )


def _approx_gcd(values: "list[float]", tol: float) -> float:
    """Approximate greatest common divisor of positive floats.

    Used for the geometric half of the unit derivation: bar heights are integer multiples
    of one per-report unit, so their GCD *is* that unit — an entirely different route to
    it than the printed y-axis label, which is what makes the agreement assertion worth
    making.

    Two things keep it numerically stable, and the naive form fails both ways without
    them:

    * The remainder is taken against the NEAREST multiple, not the largest smaller one. A
      textbook Euclidean remainder turns the sub-thousandth float noise on a PDF
      coordinate into a genuine residue and the recursion then converges on that noise:
      run against the real corpus, the floored form returned ~0.001 pt as the "GCD" of 13
      reports whose true unit is 2.4-3.9 pt.
    * The running divisor starts at the SMALLEST value, not the largest. Every reduction
      loses a little precision, and starting large means many of them; starting at the
      minimum usually leaves the first candidate standing and each later value only
      confirms it.
    """
    ordered = sorted(values)
    current = ordered[0]
    for value in ordered:
        a, b = max(current, value), min(current, value)
        while b > tol:
            a, b = b, abs(a - b * round(a / b))
        current = a
    return current


def _page_for(anchors: "dict[str, list[int]]", report_id: "str | None") -> int:
    """The one page the momentum anchor resolves to.

    Never an index: the chart lives on the lineups page today, but AD-8 forbids addressing
    it that way, and a report whose lineups page moved must still parse.
    """
    pages = anchors.get(MOMENTUM_ANCHOR_ID)
    if pages is None:
        raise MomentumChartError(
            f"anchor {MOMENTUM_ANCHOR_ID!r} was not resolved for this report; the "
            "registry spec and this parser have drifted apart",
            report_id,
        )
    if len(pages) != 1:
        raise MomentumChartError(
            f"the momentum chart title resolves to {len(pages)} pages {pages}; the "
            "template draws it exactly once per report",
            report_id,
        )
    return pages[0]


def _plot_box(page: "pymupdf.Page", report_id: "str | None") -> "tuple[float, float, list[float]]":
    """`(x0, x1, value_gridline_ys)` for the chart's plot area.

    Derived from the printed gridlines rather than from the bars: the box is what fixes
    the slot COUNT (bars only occupy the slots that have data — 9 to 36 slots per report
    are empty, and up to two leading slots), and its half height is an independent
    confirmation of the peak-bar auto-scale.
    """
    lines: "list[tuple[float, float, float]]" = []
    for drawing in page.get_drawings():
        if tuple(item[0] for item in drawing["items"]) != ("l",):
            continue
        if not _close(drawing.get("color"), GRID_STROKE):
            continue
        rect = drawing["rect"]
        if abs(rect.y1 - rect.y0) > GEOMETRY_TOL_PT:  # horizontal only
            continue
        lines.append((rect.y0, rect.x0, rect.x1))
    if not lines:
        raise MomentumChartError("no chart gridlines found on the anchored page", report_id)

    # The chart shares the lineups page with Domain A, so the page-wide grey-stroke sweep
    # above is a candidate set, not the chart. Group the candidates into columns of lines
    # that share a horizontal extent, then let exactly one column qualify as the value
    # axis. Requiring instead that EVERY grey rule on the page share one extent made an
    # unrelated horizontal rule anywhere on the page abort the report — colour-and-page-wide
    # where the module's own rule (AD-9) is shape first, and the chart's own geometry is
    # what identifies it. Grouping is by tolerance rather than by rounded-value equality:
    # two coordinates 0.004 pt apart can round to different 2-dp values and would then be
    # read as two different columns, which is noise the module tolerates at 0.05 pt
    # everywhere else.
    columns: "list[tuple[float, float, list[float]]]" = []
    for y, x0, x1 in sorted(lines, key=lambda line: (line[1], line[2], line[0])):
        for index, (cx0, cx1, ys) in enumerate(columns):
            if abs(x0 - cx0) <= GEOMETRY_TOL_PT and abs(x1 - cx1) <= GEOMETRY_TOL_PT:
                ys.append(y)
                break
        else:
            columns.append((x0, x1, [y]))

    qualified: "list[tuple[float, float, list[float]]]" = []
    for cx0, cx1, ys in columns:
        if cx1 - cx0 <= 0:
            continue
        value_lines = _value_gridline_run(ys)
        if value_lines is not None:
            qualified.append((cx0, cx1, value_lines))
    if len(qualified) != 1:
        raise MomentumChartError(
            f"{len(qualified)} horizontal rule groups on the anchored page form a "
            f"{VALUE_GRIDLINE_COUNT}-line evenly-spaced value axis, expected exactly one; "
            f"candidate extents {[(round(cx0, 2), round(cx1, 2), len(ys)) for cx0, cx1, ys in columns]}",
            report_id,
        )
    plot_x0, plot_x1, value_lines = qualified[0]
    return plot_x0, plot_x1, value_lines


def _value_gridline_run(ys: "list[float]") -> "list[float] | None":
    """The chart's `VALUE_GRIDLINE_COUNT` evenly-spaced value gridlines, or `None`.

    The template draws nine evenly-spaced value lines plus a tenth axis rule just below
    the last one, so a naive `max(y)` puts the axis half height 0.75 pt too low and
    corrupts the geometric peak cross-check. Returns `None` — rather than raising — when
    the run does not qualify, because `_plot_box` calls this over every candidate group on
    the page and only the caller knows whether a non-qualifying group is a template
    revision or simply unrelated page furniture.
    """
    ordered: "list[float]" = []
    for y in sorted(ys):
        if not ordered or abs(y - ordered[-1]) > GEOMETRY_TOL_PT:
            ordered.append(y)
    if len(ordered) < 2:
        return None
    steps = [round(ordered[i + 1] - ordered[i], 3) for i in range(len(ordered) - 1)]
    step = max(set(steps), key=steps.count)
    run = [ordered[0]]
    for y in ordered[1:]:
        if abs(y - (run[-1] + step)) <= GEOMETRY_TOL_PT:
            run.append(y)
    if len(run) != VALUE_GRIDLINE_COUNT:
        return None
    # Anything the run did not absorb must be the axis rule immediately below the last
    # value line — never a second value axis the run silently ignored.
    stray = [y for y in ordered if all(abs(y - kept) > GEOMETRY_TOL_PT for kept in run)]
    if any(y < run[-1] or y - run[-1] > 1.0 for y in stray):
        return None
    return run


def _read_axis_labels(
    page: "pymupdf.Page",
    plot_x0: float,
    value_lines: "list[float]",
    report_id: "str | None",
) -> int:
    """The printed y-axis top label, as a positive integer.

    The axis is symmetric (`peak / ... / 0 / ... / peak`), and its top label equals the
    peak bar's value in units on 104/104 — the one printed counterpart this chart offers.
    Read from the right-aligned label column immediately left of the plot box; the lineup
    page's own two team columns sit hundreds of points away on either side.
    """
    top, bottom = value_lines[0], value_lines[-1]
    labels: "list[tuple[float, str]]" = []
    for word in page.get_text("words"):
        x0, y0, x1, y1, text = word[0], word[1], word[2], word[3], word[4]
        if plot_x0 - 30 <= x0 and x1 <= plot_x0 and top - 8 <= y0 and y1 <= bottom + 8:
            labels.append(((y0 + y1) / 2.0, text))
    labels.sort()
    if len(labels) != VALUE_GRIDLINE_COUNT:
        raise MomentumAxisError(
            f"y-axis label column holds {len(labels)} labels "
            f"{[text for _y, text in labels]}, expected {VALUE_GRIDLINE_COUNT}",
            report_id,
        )
    texts = [text for _y, text in labels]
    if texts[0] != texts[-1]:
        raise MomentumAxisError(
            f"y-axis is not symmetric: top label {texts[0]!r}, bottom label {texts[-1]!r}",
            report_id,
        )
    if texts[VALUE_GRIDLINE_COUNT // 2] != "0":
        raise MomentumAxisError(
            f"y-axis centre label is {texts[VALUE_GRIDLINE_COUNT // 2]!r}, expected '0'; "
            "the baseline is not the axis zero",
            report_id,
        )
    try:
        top_value = float(texts[0])
    except ValueError:
        raise MomentumAxisError(
            f"y-axis top label {texts[0]!r} is not numeric", report_id
        ) from None
    if top_value <= 0 or top_value != int(top_value):
        raise MomentumAxisError(
            f"y-axis top label {texts[0]!r} is not a positive integer", report_id
        )
    return int(top_value)


def _tick_runs(
    page: "pymupdf.Page", x0: float, x1: float, y0: float, y1: float
) -> "dict[str, list[float]]":
    """Tick labels in the band under the plot box, as `label -> centre x` readings.

    Character-level, regrouped into digit runs and alpha runs. pymupdf merges adjacent
    same-font inserts, so the real pages print `45HT` as one token on some reports and
    `45` + `HT` on others — Story 1.7's merged-span lesson repeating. Splitting on the
    digit/alpha class boundary accepts both forms by construction rather than by
    special-casing the merged spellings.
    """
    chars: "list[tuple[float, float, float, str]]" = []
    for block in page.get_text("rawdict")["blocks"]:
        if block.get("type") != 0:  # image block
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                for char in span["chars"]:
                    cx0, cy0, cx1, cy1 = char["bbox"]
                    if x0 <= cx0 and cx1 <= x1 and y0 <= cy0 and cy1 <= y1:
                        chars.append(((cy0 + cy1) / 2.0, cx0, cx1, char["c"]))
    # Sorted and run-merged BY TEXT LINE, not by x alone. The band under the plot box is
    # 25 pt tall — room for more than one line of text on a page this parser shares with
    # Domain A — and merging by x alone would splice characters from two different lines
    # into one run, silently corrupting a tick's label or its centre.
    chars.sort()
    runs: "list[list]" = []
    for centre_y, cx0, cx1, char in chars:
        if char.isspace():
            continue
        kind = "digit" if char.isdigit() else "other"
        same_line = runs and abs(centre_y - runs[-1][4]) <= 1.0
        if same_line and runs[-1][0] == kind and cx0 - runs[-1][2] < 1.5:
            runs[-1][2] = cx1
            runs[-1][3] += char
        else:
            runs.append([kind, cx0, cx1, char, centre_y])
    readings: "dict[str, list[float]]" = {}
    for _kind, run_x0, run_x1, text, _centre_y in runs:
        readings.setdefault(text, []).append((run_x0 + run_x1) / 2.0)
    return readings


def _slot_of(centre_x: float, plot_x0: float, pitch: float) -> float:
    """Fractional slot index of an x coordinate. Slot `s` is centred at `x0+(s+0.5)*pitch`."""
    return (centre_x - plot_x0) / pitch - 0.5


def _clock_structure(
    ticks: "dict[str, list[float]]",
    plot_x0: float,
    pitch: float,
    slot_count: int,
    report_id: "str | None",
) -> dict:
    """Derive the slot -> match-clock structure from this report's own printed ticks.

    Never a hard-coded formula: first-half ticks are stable (minute *M* sits at slot
    *M-1*, 0 violations on 104/104), but every tick after half time shifts by that
    report's first-half stoppage allotment, which lands the HT tick anywhere from slot 48
    to slot 56.

    Returns `{"second_half_slot", "full_time_slot", "extra_time_slot"}`, where
    `full_time_slot` is `None` when the report does not print an FT tick (one report does
    not) and `extra_time_slot` is `None` on the 95 regulation reports.
    """

    def slot_for(label: str) -> "int | None":
        readings = ticks.get(label)
        if readings is None:
            return None
        if len(readings) > 1:
            raise MomentumClockError(
                f"x-axis prints tick {label!r} {len(readings)} times", report_id
            )
        fractional = _slot_of(readings[0], plot_x0, pitch)
        snapped = round(fractional)
        if abs(fractional - snapped) > SLOT_SNAP_TOL:
            raise MomentumClockError(
                f"x-axis tick {label!r} sits at slot {fractional:.3f}, which is not a "
                "slot centre",
                report_id,
            )
        return snapped

    # First half: the anchor of the whole mapping. Minute M is slot M-1.
    for minute in (15, 30, REGULATION_HALF):
        slot = slot_for(str(minute))
        if slot is None:
            raise MomentumClockError(
                f"x-axis does not print the {minute}' tick; the first-half mapping "
                "cannot be pinned",
                report_id,
            )
        if slot != minute - 1:
            raise MomentumClockError(
                f"x-axis tick {minute}' sits at slot {slot}, expected {minute - 1}",
                report_id,
            )

    # Second half. The HT tick marks its first slot; three reports omit it, and there the
    # 60/75/90 ticks pin the same number — but they must all agree.
    candidates = {"HT": slot_for("HT")}
    for minute in (60, 75, 90):
        slot = slot_for(str(minute))
        if slot is not None:
            candidates[str(minute)] = slot - (minute - REGULATION_HALF - 1)
    agreed = {value for value in candidates.values() if value is not None}
    if not agreed:
        raise MomentumClockError(
            "x-axis prints no half-time or second-half tick; the second half cannot be "
            "located",
            report_id,
        )
    if len(agreed) > 1:
        raise MomentumClockError(
            f"second-half start disagrees across ticks: "
            f"{ {k: v for k, v in candidates.items() if v is not None} }",
            report_id,
        )
    second_half_slot = agreed.pop()
    if second_half_slot < REGULATION_HALF:
        raise MomentumClockError(
            f"second half starts at slot {second_half_slot}, before the first half's "
            f"{REGULATION_HALF} regular minutes",
            report_id,
        )
    # Upper bounds, all of them. Every slot between the 45' tick and the HT tick is a
    # first-half stoppage minute, so an HT tick far down the grid does not merely look odd
    # — it stages `stoppage_minute` values the contract's `StoppageMinute` cannot express,
    # and nothing downstream of here would catch it before Story 1.16's emit boundary.
    first_half_stoppage = second_half_slot - REGULATION_HALF
    if first_half_stoppage > MAX_STOPPAGE_MINUTE:
        raise MomentumClockError(
            f"second half starts at slot {second_half_slot}, implying {first_half_stoppage} "
            f"first-half stoppage minutes, past the contract's {MAX_STOPPAGE_MINUTE}",
            report_id,
        )
    if second_half_slot >= slot_count:
        raise MomentumClockError(
            f"second half starts at slot {second_half_slot}, outside the plot box's "
            f"{slot_count} slots",
            report_id,
        )

    full_time_slot = slot_for("FT")
    last_regulation_slot = second_half_slot + REGULATION_HALF - 1
    if full_time_slot is not None and full_time_slot < last_regulation_slot:
        raise MomentumClockError(
            f"FT tick at slot {full_time_slot} falls before the end of the second half's "
            f"regular minutes (slot {last_regulation_slot})",
            report_id,
        )
    # The tick band is read from a 12 pt margin either side of the plot box, so a tick can
    # legitimately be found at an x that maps past the last slot. Left unchecked it stages a
    # `full_time_index` pointing past the samples it indexes.
    if full_time_slot is not None and full_time_slot >= slot_count:
        raise MomentumClockError(
            f"FT tick at slot {full_time_slot} falls outside the plot box's {slot_count} "
            "slots",
            report_id,
        )
    extra_time_slot = slot_for("120")
    # Read before the stoppage bound below, so that an extra-time report missing its FT
    # tick is diagnosed as the missing tick it is. Deriving regulation's end from the grid
    # would otherwise attribute the whole of extra time to second-half stoppage and report
    # that instead — true, but a symptom rather than the cause.
    if extra_time_slot is not None:
        if extra_time_slot >= slot_count:
            raise MomentumClockError(
                f"120' tick at slot {extra_time_slot} falls outside the plot box's "
                f"{slot_count} slots",
                report_id,
            )
        if full_time_slot is None:
            raise MomentumClockError(
                "extra-time report prints no FT tick; the first extra period cannot be "
                "located",
                report_id,
            )

    # Second-half stoppage runs from the 90' minute to whichever slot ends regulation — the
    # FT tick, or the grid's end on the one report that prints no FT tick.
    regulation_end = full_time_slot if full_time_slot is not None else slot_count - 1
    second_half_stoppage = (regulation_end - second_half_slot) - (REGULATION_HALF - 1)
    if second_half_stoppage > MAX_STOPPAGE_MINUTE:
        raise MomentumClockError(
            f"regulation ends at slot {regulation_end}, implying {second_half_stoppage} "
            f"second-half stoppage minutes, past the contract's {MAX_STOPPAGE_MINUTE}",
            report_id,
        )

    if extra_time_slot is not None:
        # Extra time repeats the pattern the two regular halves establish: the first
        # period opens on the slot after FT, and the 120' tick closes the second, whose
        # own 15 regular minutes place its opening slot. The break between them is NOT
        # printed on any of the nine extra-time reports; this is the only reading the
        # printed ticks support, and it is asserted to leave room for both periods.
        if extra_time_slot - EXTRA_TIME_HALF + 1 < full_time_slot + 1 + EXTRA_TIME_HALF:
            raise MomentumClockError(
                f"extra-time periods overlap: FT at slot {full_time_slot}, 120' tick at "
                f"slot {extra_time_slot}",
                report_id,
            )
        # Both extra periods carry stoppage the same way the regular halves do, and both
        # are bounded the same way.
        second_extra_slot = extra_time_slot - EXTRA_TIME_HALF + 1
        first_extra_stoppage = (second_extra_slot - 1 - full_time_slot) - EXTRA_TIME_HALF
        if first_extra_stoppage > MAX_STOPPAGE_MINUTE:
            raise MomentumClockError(
                f"the first extra period runs to slot {second_extra_slot - 1}, implying "
                f"{first_extra_stoppage} stoppage minutes, past the contract's "
                f"{MAX_STOPPAGE_MINUTE}",
                report_id,
            )
        second_extra_stoppage = (slot_count - 1 - second_extra_slot) - (EXTRA_TIME_HALF - 1)
        if second_extra_stoppage > MAX_STOPPAGE_MINUTE:
            raise MomentumClockError(
                f"the chart grid runs to slot {slot_count - 1}, implying "
                f"{second_extra_stoppage} second-extra-period stoppage minutes, past the "
                f"contract's {MAX_STOPPAGE_MINUTE}",
                report_id,
            )
    elif full_time_slot is not None and slot_count - 1 > full_time_slot:
        raise MomentumClockError(
            f"chart grid runs to slot {slot_count - 1}, past the FT tick at slot "
            f"{full_time_slot}, with no extra-time tick to explain it",
            report_id,
        )
    return {
        "second_half_slot": second_half_slot,
        "full_time_slot": full_time_slot,
        "extra_time_slot": extra_time_slot,
    }


def _stamp_for(slot: int, structure: dict, slot_count: int, report_id: "str | None") -> tuple:
    """`(minute, stoppage_minute)` for one slot, from the derived clock structure."""
    second_half = structure["second_half_slot"]
    full_time = structure["full_time_slot"]
    extra_time = structure["extra_time_slot"]

    if slot < second_half:
        if slot < REGULATION_HALF:
            return (slot + 1, None)
        return (REGULATION_HALF, slot - (REGULATION_HALF - 1))

    regulation_end = full_time if full_time is not None else slot_count - 1
    if slot <= regulation_end:
        offset = slot - second_half
        if offset < REGULATION_HALF:
            return (REGULATION_HALF + 1 + offset, None)
        return (2 * REGULATION_HALF, offset - (REGULATION_HALF - 1))

    if extra_time is None:
        raise MomentumClockError(
            f"slot {slot} falls past full time with no extra-time tick", report_id
        )
    second_extra_slot = extra_time - EXTRA_TIME_HALF + 1
    if slot < second_extra_slot:
        offset = slot - regulation_end  # 1-based minute into the first extra period
        if offset <= EXTRA_TIME_HALF:
            return (2 * REGULATION_HALF + offset, None)
        return (2 * REGULATION_HALF + EXTRA_TIME_HALF, offset - EXTRA_TIME_HALF)
    offset = slot - second_extra_slot
    if offset < EXTRA_TIME_HALF:
        return (2 * REGULATION_HALF + EXTRA_TIME_HALF + 1 + offset, None)
    return (2 * (REGULATION_HALF + EXTRA_TIME_HALF), offset - (EXTRA_TIME_HALF - 1))


def _read_legend(
    page: "pymupdf.Page",
    plot_bottom: float,
    home_team: "str | None",
    away_team: "str | None",
    report_id: "str | None",
) -> None:
    """Prove orange -> home / purple -> away from the legend, rather than assuming it.

    Verified 104/104 at story creation and re-verified on every extraction: the swatch's
    own printed name is matched against this report's cover metadata. Skipped when the
    caller hands in no team names (the gate's parse-only path).
    """
    if home_team is None or away_team is None:
        return
    words = sorted(page.get_text("words"), key=lambda word: word[0])
    expected = {HOME_FILL: ("home", home_team), AWAY_FILL: ("away", away_team)}
    seen: "dict[str, str]" = {}
    for drawing in page.get_drawings():
        rect = drawing["rect"]
        if rect.y0 <= plot_bottom:
            continue
        for palette, (side, _team) in expected.items():
            if not _close(drawing.get("fill"), palette):
                continue
            # Exactly one swatch per palette colour. Overwriting silently instead made the
            # reading depend on PDF drawing order — a second path in either chart colour
            # anywhere below the plot box would be adopted if it happened to be drawn last
            # and ignored if it was drawn first. Order-dependence is the wrong shape for the
            # one mechanism that PROVES colour -> team rather than assuming it, so a second
            # candidate is a loud failure either way round.
            if side in seen:
                raise MomentumChartError(
                    f"more than one path below the plot box carries the {side} chart "
                    "colour; the legend swatch cannot be identified unambiguously",
                    report_id,
                )
            centre_y = (rect.y0 + rect.y1) / 2.0
            parts: "list[str]" = []
            edge = rect.x1
            for word in words:
                if word[0] < rect.x1 - 0.5 or abs((word[1] + word[3]) / 2.0 - centre_y) > 6:
                    continue
                if word[0] - edge > 8:
                    break
                parts.append(word[4])
                edge = word[2]
            seen[side] = " ".join(parts)
    for side, team in (("home", home_team), ("away", away_team)):
        if side not in seen:
            raise MomentumChartError(
                f"chart legend has no {side} swatch below the plot box", report_id
            )
        # Normalized, as every sibling parser compares extracted text (`domain_b.py`,
        # `domain_c.py`): the legend name is assembled from raw `words` fragments and the
        # cover name comes from a different page, so a zero-width space or an NFD-composed
        # accent on either side would fail a report whose mapping is perfectly correct.
        # Nothing semantic is collapsed — a genuine name mismatch still fails loud.
        if normalize(seen[side]) != normalize(team):
            raise MomentumChartError(
                f"chart legend maps the {side} colour to {seen[side]!r}, but this "
                f"report's cover names {team!r}; the colour -> team mapping cannot be "
                "assumed",
                report_id,
            )


def extract_momentum(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: "str | None" = None,
    home_team: "str | None" = None,
    away_team: "str | None" = None,
) -> dict:
    """The momentum series for one report.

    Returns `{"series": <payload or None>, "warnings": [...]}`. The series is `None` only
    when the chart is anchored but draws no bars at all — a documented absence that
    travels as a per-report **warning**, never as a non-`pass` check, because the
    Self-Validation aggregator is strictly binary and would read a non-pass check as a
    failure (Story 1.12's possession-regain precedent). Every other departure from the
    template fails this report loud with a typed error; the batch continues to the next.

    No report in the 104-report corpus takes the `None` branch — all 104 draw a band — so
    a clean corpus run is NOT evidence that the branch is dead code. It exists because
    AD-4 requires the key to be present with a flagged absence, and it is unit-tested.
    """
    page_index = _page_for(anchors, report_id)
    page = doc[page_index]
    drawings = page.get_drawings()

    plot_x0, plot_x1, value_lines = _plot_box(page, report_id)
    plot_top, plot_bottom = value_lines[0], value_lines[-1]
    baseline = value_lines[VALUE_GRIDLINE_COUNT // 2]
    half_height = baseline - plot_top

    # --- bars: shape filter FIRST, then colour keying (AD-9) --------------------------
    bars: "list[tuple[str, float, float, float, float]]" = []
    for drawing in drawings:
        if tuple(item[0] for item in drawing["items"]) != BAR_ITEM_OPS:
            continue
        rect = drawing["rect"]
        inside = (
            plot_x0 - 1 <= rect.x0
            and rect.x1 <= plot_x1 + 1
            and plot_top - 1 <= rect.y0
            and rect.y1 <= plot_bottom + 1
        )
        if not inside:
            continue
        fill = drawing.get("fill")
        if _close(fill, HOME_FILL):
            side = "home"
        elif _close(fill, AWAY_FILL):
            side = "away"
        else:
            raise MomentumFillError(
                f"bar-shaped path at ({rect.x0:.2f}, {rect.y0:.2f}) inside the chart box "
                f"carries fill {fill}, which is neither the home {HOME_FILL} nor the away "
                f"{AWAY_FILL} colour",
                report_id,
            )
        bars.append((side, rect.x0, rect.y0, rect.x1, rect.y1))

    if not bars:
        # A genuinely empty chart and a template that changed the bar path signature look
        # identical from here, and they must NOT be handled identically: absence is a
        # warning, a template revision is a loud failure (AD-8, assert-on-unknown). Tell
        # them apart by the palette. A chart that draws no bars carries no chart-coloured
        # fill inside the plot box either; one whose bars this parser no longer recognises
        # still does. Without this, a one-line template change would stage `momentum: null`
        # for all 104 reports and raise nothing at all.
        unrecognised = [
            drawing
            for drawing in drawings
            if (_close(drawing.get("fill"), HOME_FILL) or _close(drawing.get("fill"), AWAY_FILL))
            and plot_x0 - 1 <= drawing["rect"].x0
            and drawing["rect"].x1 <= plot_x1 + 1
            and plot_top - 1 <= drawing["rect"].y0
            and drawing["rect"].y1 <= plot_bottom + 1
        ]
        if unrecognised:
            raise MomentumChartError(
                f"the chart box holds {len(unrecognised)} path(s) in the chart palette but "
                f"none with the bar signature {BAR_ITEM_OPS}; the template has changed and "
                "the series must not be recorded as merely absent",
                report_id,
            )
        return {
            "series": None,
            "warnings": [
                f"momentum: the chart on page {page_index} draws no bars; the series is "
                "recorded as absent"
            ],
        }

    _read_legend(page, plot_bottom, home_team, away_team, report_id)

    # --- baseline: the shared edge, single-valued and on the axis zero -----------------
    # Clustered at `GEOMETRY_TOL_PT`, not by rounded-value equality: two shared edges
    # 0.004 pt apart can round to different 2-dp values, and the report would then abort on
    # noise three orders of magnitude below the tolerance this module applies everywhere
    # else. The invariant being asserted — one single-valued baseline — is unchanged.
    edges = sorted(
        [bar[4] for bar in bars if bar[0] == "home"] + [bar[2] for bar in bars if bar[0] == "away"]
    )
    if edges[-1] - edges[0] > GEOMETRY_TOL_PT:
        raise MomentumChartError(
            f"bars do not share one baseline: {round(edges[0], 2)}..{round(edges[-1], 2)}; "
            "home bars grow up from it and away bars grow down from it",
            report_id,
        )
    bar_baseline = edges[0]
    if abs(bar_baseline - baseline) > GEOMETRY_TOL_PT:
        raise MomentumChartError(
            f"bar baseline {bar_baseline} is not the axis zero gridline {baseline}",
            report_id,
        )

    # --- slot pitch: printed ticks, bar spacing, and the plot box, all three -----------
    ticks = _tick_runs(page, plot_x0 - 12, plot_x1 + 12, plot_bottom + 1, plot_bottom + 26)
    if "15" not in ticks or "45" not in ticks:
        raise MomentumClockError(
            "x-axis does not print both the 15' and 45' ticks; the slot pitch cannot be "
            "derived from the printed scale",
            report_id,
        )
    if len(ticks["15"]) != 1 or len(ticks["45"]) != 1:
        raise MomentumClockError(
            "x-axis prints the 15' or 45' tick more than once", report_id
        )
    pitch_ticks = (ticks["45"][0] - ticks["15"][0]) / 30.0
    if pitch_ticks <= 0:
        raise MomentumClockError(
            f"printed ticks give a non-positive slot pitch ({pitch_ticks:.4f} pt)", report_id
        )
    slot_count = round((plot_x1 - plot_x0) / pitch_ticks)
    if slot_count < 1:
        raise MomentumChartError(
            f"plot box holds {slot_count} slots at the printed pitch {pitch_ticks:.4f} pt",
            report_id,
        )
    pitch = (plot_x1 - plot_x0) / slot_count
    if abs(pitch - pitch_ticks) > PITCH_TOL_PT:
        raise MomentumChartError(
            f"slot pitch from the printed ticks ({pitch_ticks:.4f} pt) disagrees with the "
            f"plot box divided into {slot_count} slots ({pitch:.4f} pt)",
            report_id,
        )
    # Third derivation, from the bars' own spacing: the outermost gap divided by the whole
    # number of slots it spans. Deliberately the total span rather than an approximate GCD
    # over the individual gaps — the gaps are large multiples of the pitch (a chart can
    # easily jump 44 slots between drawn bars), and reducing those against each other
    # accumulates enough drift to converge on noise. One division over the longest
    # available lever is both exact and the most sensitive form: over a 95-slot span it
    # pins the pitch ~95x tighter than the tolerance below.
    left_edges = sorted(bar[1] for bar in bars)
    span = left_edges[-1] - left_edges[0]
    if span > 0:
        slots_spanned = round(span / pitch_ticks)
        if slots_spanned < 1:
            raise MomentumChartError(
                f"the drawn bars span {span:.4f} pt, less than one slot at the printed "
                f"pitch {pitch_ticks:.4f} pt",
                report_id,
            )
        pitch_bars = span / slots_spanned
        if abs(pitch_bars - pitch) > PITCH_TOL_PT:
            raise MomentumChartError(
                f"slot pitch from the bars' own spacing ({pitch_bars:.4f} pt over "
                f"{slots_spanned} slots) disagrees with the printed scale ({pitch:.4f} pt)",
                report_id,
            )

    # --- slots: one bar per colour per slot, snapped to the grid -----------------------
    slots: "dict[int, dict[str, float]]" = {}
    for side, x0, y0, x1, y1 in bars:
        ratio = (x1 - x0) / pitch
        if abs(ratio - WIDTH_RATIO) > WIDTH_RATIO_TOL:
            raise MomentumChartError(
                f"bar at x={x0:.2f} is {ratio:.4f} of the slot pitch wide, expected "
                f"{WIDTH_RATIO}",
                report_id,
            )
        fractional = _slot_of((x0 + x1) / 2.0, plot_x0, pitch)
        slot = round(fractional)
        if abs(fractional - slot) > SLOT_SNAP_TOL:
            raise MomentumChartError(
                f"bar at x={x0:.2f} centres on slot {fractional:.3f}, which is not a slot "
                "centre",
                report_id,
            )
        if not 0 <= slot < slot_count:
            raise MomentumChartError(
                f"bar at x={x0:.2f} lands on slot {slot}, outside the plot box's "
                f"{slot_count} slots",
                report_id,
            )
        if side in slots.get(slot, {}):
            raise MomentumChartError(
                f"slot {slot} carries two {side} bars", report_id
            )
        slots.setdefault(slot, {})[side] = y1 - y0

    # --- value scale: printed axis, bar-height GCD, and the plot box's half height -----
    heights = [height for values in slots.values() for height in values.values()]
    peak = max(heights)
    if abs(peak - half_height) > GEOMETRY_TOL_PT:
        raise MomentumScaleError(
            f"the tallest bar is {peak:.4f} pt but the axis half height is "
            f"{half_height:.4f} pt; the chart's auto-scale no longer fills the axis",
            report_id,
        )
    # The unit is derived GEOMETRICALLY — the approximate GCD over the bar heights, which
    # never looks at the printed axis. Deriving it as `peak / top_label` instead would
    # make `momentum-axis-scale` tautological: the peak's value would then equal the
    # printed label by construction on every chart, including one whose axis is wrong.
    # Keeping the two sources apart is the whole point (§"Value scale"), and it is what
    # makes the recorded check a genuine printed-vs-derived comparison.
    unit = _approx_gcd(heights, tol=UNIT_TOL_PT)
    if unit <= 0:
        raise MomentumScaleError(
            f"bar heights yield a non-positive value unit ({unit:.5f} pt)", report_id
        )
    # 0 non-integer bar heights exist across the entire corpus, so one is a template
    # revision — never something to round away. This is the geometry contradicting
    # ITSELF, so it fails loud; the printed axis disagreeing with the geometry is a
    # recorded check instead (SM-C1: a finding for the ledger, not an exception).
    for slot, values in sorted(slots.items()):
        for side, height in sorted(values.items()):
            quotient = height / unit
            if abs(quotient - round(quotient)) > INTEGRALITY_TOL:
                raise MomentumScaleError(
                    f"{side} bar in slot {slot} is {height:.4f} pt tall, which is "
                    f"{quotient:.4f} units — not an integer multiple of {unit:.5f} pt",
                    report_id,
                )
    top_label = _read_axis_labels(page, plot_x0, value_lines, report_id)

    # --- clock and series --------------------------------------------------------------
    structure = _clock_structure(ticks, plot_x0, pitch, slot_count, report_id)
    samples: "list[dict]" = []
    for slot in range(slot_count):
        minute, stoppage = _stamp_for(slot, structure, slot_count, report_id)
        values = slots.get(slot, {})
        samples.append(
            {
                "minute": minute,
                "stoppage_minute": stoppage,
                # Absence is a real zero, not missing data: 9 to 36 slots per report carry
                # no bar on either side, and a sparse series would leave the App's timeline
                # showing phantom gaps where the match simply had no final-third entry.
                "home": round(values["home"] / unit) if "home" in values else 0,
                "away": round(values["away"] / unit) if "away" in values else 0,
            }
        )

    full_time = structure["full_time_slot"]
    # NOTE FOR STORY 1.16 (the emit boundary): of the four keys below, only `samples` has a
    # contract counterpart. `MomentumSeries` is `additionalProperties: false` over
    # `{samples}` alone, so `axis_top_label`, `full_time_index` and `extra_time` must be
    # DROPPED — not renamed — when this record is emitted, and each sample's flat
    # `{minute, stoppage_minute}` becomes the `at: MinuteStamp` composite. They are staged
    # because they are Self-Validation inputs, not because they are part of the payload.
    return {
        "series": {
            "samples": samples,
            # The printed y-axis top label, staged so `momentum-axis-scale` compares two
            # independently sourced numbers rather than re-deriving one of them. This is
            # the one genuinely independent cross-check the page offers.
            "axis_top_label": top_label,
            # Index of the sample the printed FT tick lands on; `None` on the one report
            # that does not print it.
            "full_time_index": full_time,
            "extra_time": structure["extra_time_slot"] is not None,
        },
        "warnings": [],
    }


def momentum_checks(series: "dict | None") -> "list[dict]":
    """The momentum Self-Validation checks (Story 1.8, Task 5).

    Both are recorded, never raised, and neither is loosened when it fails (SM-C1): a
    report whose printed axis contradicts its own bars is a finding for the ledger.

    The two checks are not peers, and a code review found the docstrings here previously
    implied they were:

    * **`momentum-axis-scale` is a genuine cross-check.** The value unit is derived
      geometrically and the printed y-axis label is never consulted while deriving it, so
      the two numbers compared below reach this function by independent routes and can
      genuinely disagree.
    * **`momentum-coverage` is a backstop, not a cross-check.** Every clock inconsistency
      it could describe is already a typed failure in `_clock_structure` — tick positions,
      period bounds, stoppage bounds and the FT/grid agreement all abort the report before
      a series is built at all. The samples are then generated by `range(slot_count)`
      through a `_stamp_for` that is monotonic by construction, so an interior gap or a
      series that opens after kick-off cannot arise from a parse this module accepted. What
      remains is worth recording — it catches corruption of the staged payload between
      parse and record, which is exactly what its tests exercise — but it must not be read
      as independent evidence that the clock is right. `_clock_structure` is that evidence.

    An absent series contributes NO checks. That is deliberate: absence travels as a
    per-report warning (see `extract_momentum`), and a non-`pass` check would be read by
    the strictly binary aggregator as a failure of a report that is merely incomplete.
    """
    if series is None:
        return []
    samples = series["samples"]

    peak = max(max(sample["home"], sample["away"]) for sample in samples)
    top_label = series["axis_top_label"]
    axis_ok = peak == top_label
    checks = [
        check_entry(
            "momentum-axis-scale",
            axis_ok,
            f"printed y-axis top label {top_label} vs derived peak value {peak}",
        )
    ]

    problems: "list[str]" = []
    first = samples[0]
    if (first["minute"], first["stoppage_minute"]) != (1, None):
        problems.append(
            f"series opens at minute {first['minute']}"
            f"{'+' + str(first['stoppage_minute']) if first['stoppage_minute'] else ''}, "
            "not at kick-off"
        )
    previous = None
    for sample in samples:
        key = (sample["minute"], sample["stoppage_minute"] or 0)
        if previous is not None and key <= previous:
            problems.append(f"clock does not advance at minute {sample['minute']}")
            break
        previous = key

    last = samples[-1]
    final_period = 120 if series["extra_time"] else 90
    if last["minute"] != final_period:
        problems.append(
            f"series ends at minute {last['minute']}, not in the "
            f"{final_period}' period"
        )
    full_time_index = series["full_time_index"]
    if full_time_index is not None:
        if not 0 <= full_time_index < len(samples):
            problems.append(
                f"printed FT tick falls on sample {full_time_index}, outside the "
                f"{len(samples)} samples"
            )
        elif samples[full_time_index]["minute"] != 2 * REGULATION_HALF:
            # Applies to extra-time reports too, which this clause used to skip entirely —
            # nine reports whose FT tick was staged and then never looked at.
            problems.append(
                f"printed FT tick falls on sample {full_time_index}, stamped minute "
                f"{samples[full_time_index]['minute']} rather than {2 * REGULATION_HALF}"
            )
        elif not series["extra_time"] and full_time_index != len(samples) - 1:
            problems.append(
                f"printed FT tick falls on sample {full_time_index} of "
                f"{len(samples)}; the chart grid and the printed clock disagree on "
                "where the match ends"
            )
    # The specifics say what was actually checked. They previously ended "no gaps" on every
    # passing report, which advertised a gap check this function does not perform (the slot
    # grid is dense by construction, so there is nothing to check), and said nothing at all
    # about the FT cross-check being unavailable on the one report that prints no FT tick —
    # making that report indistinguishable from a fully cross-checked one.
    coverage = (
        f"{len(samples)} per-minute samples from {_format_stamp(first)} to "
        f"{_format_stamp(last)} over a dense slot grid"
    )
    coverage += (
        f"; printed FT tick cross-checked at sample {full_time_index}"
        if full_time_index is not None
        else "; no FT tick printed, so the grid-end cross-check was unavailable"
    )
    checks.append(
        check_entry("momentum-coverage", not problems, "; ".join(problems) if problems else coverage)
    )
    return checks


def _format_stamp(sample: dict) -> str:
    """A clock stamp for check specifics only — never for the record (AD-7)."""
    if sample["stoppage_minute"]:
        return f"{sample['minute']}+{sample['stoppage_minute']}"
    return str(sample["minute"])

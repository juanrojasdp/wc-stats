"""Domain E extraction: goalkeeping — involvement, distribution, goal prevention, aerial.

One open report in, one JSON-ready `domains["goalkeeping"]` block out. Pure in the AD-9
sense: no filesystem writes, no timestamps, no absolute paths, no cross-report knowledge.

**The domain is staged PER TEAM, not per goalkeeper.** The epic's "every goalkeeper with
minutes has a record" is unfulfillable and the story-creation probe proved it corpus-wide:
all four goalkeeping page families are titled `{team}`, NO goalkeeper name appears anywhere
on any of them, and 7 of 208 team-innings used two keepers while still printing one
team-level block each. The goalkeeper(s) with minutes are therefore carried BESIDE the
block, from Domain A's lineups, so the attribution question is *recorded* rather than
silently guessed — never joined, not even on the 201 unambiguous innings (§Task 4.2).

Domain E is four different extraction problems wearing one domain's name, and each page
family below is its own reader:

- **Goal Prevention** — one tabular page. The authoritative source is the seven-column
  table at the page foot, found by header anchor plus an `x >= 460` bound. Both bounds are
  load-bearing and both were measured: one corpus page prints a stray pitch-marker ordinal
  on the table's own row (8 spans, not 7) and two others carry a *second* seven-digit row
  higher up the page. The two donut centres on this page are in the text layer and are NOT
  trustworthy — on PMSR-M01 the Intervention Type donut reads `4` against a table of `3` —
  so they are neither staged nor checked.
- **Aerial Control** — half tabular: KPI tiles on the left, the `Delivery Types Faced`
  table on the right.
- **Goalkeeping Distribution** — a MAP page. Four equal-area panels (59,516.0 pt² each on
  208/208), so `detect_pitch_frame`'s `max()` is unusable and the plural accessor Story
  1.12 added is mandatory; panel -> category is keyed by the printed panel TITLE, never by
  position (AD-8). Markers are counted through the shared chain read-only.
- **Goalkeeping Involvement** — a chart, and Story 1.8's momentum problem again: one page
  carries BOTH teams' timelines, the y-axis auto-scales, and the slot count is per report
  (95-111 regulation, 129-145 extra time). Never hard-code 100. Both of its axes are read:
  the VALUE axis from the printed y-labels and the drawn gridlines, and the TIME axis from
  the printed x-ticks, which is the only key to what minute each slot is. The tick grammar
  is NOT momentum's — no `FT` tick exists, `HT` is printed on barely half the charts, and
  stoppage ticks (`45+N`, `90+N`, `120+N`) are printed here and nowhere else — so the
  method is 1.8's and the code is its own.

Two printed-layout rules recur across all four families and are worth naming once:

1. **A KPI value prints ABOVE its label and CENTRED on it**, and the row immediately above
   is frequently not the value's row (for `Total Attempts on Goal Faced` it is the
   intervention-type header). Every KPI here is read by walking up from the label to the
   first row carrying a number centred on it.
2. **A table's values print BELOW its header**, found by header anchor plus an exact
   value-count assertion.

Staging is raw, locale-neutral and snake_case (AD-7). Three contracted values are NOT
extractable and take the documented-absence branch (AC 4) — `None` in the payload plus one
per-report warning, never a non-`"pass"` check: the distribution technique breakdowns and
goal prevention's `by_body_type` are raster-only donut slice labels, and the aerial
`crosses_faced_completed` split is drawn only as marker colour on a goal-mouth crop with no
printed counterpart to validate against.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from pipeline.extract import bounded_check, check_entry
from pipeline.extract.errors import (
    GoalkeepingPageParseError,
    InvolvementChartError,
    InvolvementClockError,
    MalformedFieldError,
    MissingFieldError,
)
from pipeline.extract.lines import TextSpan, VisualRow, group_rows, join_spans, text_spans
from pipeline.markers.filter_chain import (
    MarkerSpec,
    collect_candidate_markers,
    detect_pitch_frames,
    key_outcomes,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# --- anchors (Story 1.2 registered all five; this story adds none) ------------------

INVOLVEMENT_ANCHOR_ID = "gk-involvement"  # ONE page, both teams — NOT a per-team spec
DISTRIBUTION_ANCHOR_STEM = "gk-distribution"
GOAL_PREVENTION_ANCHOR_STEM = "goal-prevention"
AERIAL_ANCHOR_STEM = "aerial-control"

_INTEGER_RE = re.compile(r"^\d+$", re.ASCII)
_NUMBER_RE = re.compile(r"^\d+(?:\.\d+)?$", re.ASCII)

# A KPI value is centred on its label to a fraction of a point on 208/208; 3.0 pt is that
# agreement with room for a wider printed value, and far tighter than the gap between any
# two KPI columns (the narrowest measured is ~115 pt).
KPI_CENTRE_TOL_PT = 3.0
# How far above its label a KPI value may sit. KPI columns REPEAT down these pages (the
# aerial page prints three `Complete / <type> / Incomplete` tiles at identical x centres),
# so an unbounded upward walk past a missing value would silently adopt the tile above's
# number rather than failing — a plausible wrong value, the one outcome AD-8 forbids
# outright. Measured on the corpus, every KPI value sits 37-43 pt above its label; 80 pt is
# ~1.9x that and comfortably below the ~149 pt from a label to the VALUE of the tile above
# it in the same column. That last quantity is the one the bound has to clear, not the
# ~110 pt label-to-label pitch: the walk stops at the first row carrying a centred *value*,
# so what it must never reach is the neighbouring tile's value row, which sits a further
# tile-height above that tile's own label.
KPI_MAX_RISE_PT = 80.0


# --- goal prevention ----------------------------------------------------------------

# The seven-column table's own band. The bound is load-bearing: PMSR-M38-ESP-V-KSA home
# prints a stray pitch-marker ordinal '1' at x=275 on the table's own visual row, so a
# naive "row of 7 digits" finds ZERO there; PMSR-M34-ECU-V-CUW away and PMSR-M38 away each
# carry a SECOND seven-digit row higher up the page, which the header anchor excludes.
GOAL_PREVENTION_TABLE_X_MIN = 460.0
# The KPI tiles live left of the table, so their label band is bounded by the same x: the
# table header repeats the words 'Total Attempts on Goal' and 'Faced'.
GOAL_PREVENTION_KPI_X_MAX = 460.0
# The table header's own row, verbatim. The printed header wraps over TWO visual rows
# (`'... Save No Save'` then `'Faced Interventions Retain ...'`); this is the first, and the
# anchor. A closed value asserted by equality rather than containment, per AD-8: measured
# over all 208 corpus pages it takes exactly ONE distinct form, so a reworded or reordered
# column is a template revision that must fail loud instead of shifting every value by one.
GOAL_PREVENTION_HEADER_TEXT = (
    "Total Attempts on Goal Total Goal Save & Deflect & Save & Save No Save"
)

# Printed left-to-right order, 1:1 with the contract's `GoalPrevention` field list (the
# Story 1.16 emit-time checklist, not an import).
GOAL_PREVENTION_COLUMNS: "tuple[str, ...]" = (
    "attempts_faced",
    "total_interventions",
    "save_and_retain",
    "deflect_and_retain",
    "save_and_deflect",
    "save_attempt",
    "no_save_attempt",
)
# The five intervention types, which sum EXACTLY to `attempts_faced` on 208/208. They do
# NOT sum to `total_interventions` (corpus-false on 207/208 — the two breakdowns have
# different denominators, as the contract's own note says).
INTERVENTION_TYPES: "tuple[str, ...]" = GOAL_PREVENTION_COLUMNS[2:]

GOAL_PREVENTION_KPIS: "tuple[tuple[str, str], ...]" = (
    ("attempts_faced_printed", "Total Attempts on Goal Faced"),
    # Prints WITHOUT a '%' sign, unlike every Domain B/G percentage — do not require one.
    ("save_percentage", "Save %"),
)


# --- aerial control ------------------------------------------------------------------

AERIAL_KPI_X_MAX = 450.0
AERIAL_TABLE_X_MIN = 460.0
# The `Delivery Types Faced` table's column-header row, verbatim — one distinct form on all
# 208 corpus pages, asserted by equality for the same AD-8 reason as the goal-prevention
# header above. Anchoring on the column header rather than on the section title puts the
# anchor directly above the values it keys.
AERIAL_HEADER_TEXT = "Total In Swing Out Swing Driven Lofted Cutback Push"

# Printed left-to-right order. `total` is `crosses_faced_attempted`; the remaining six sum
# to it EXACTLY on 208/208.
AERIAL_DELIVERY_COLUMNS: "tuple[str, ...]" = (
    "total",
    "inswing",
    "outswing",
    "driven",
    "lofted",
    "cutback",
    "push_cross",
)
AERIAL_DELIVERY_TYPES: "tuple[str, ...]" = AERIAL_DELIVERY_COLUMNS[1:]

# Each triple prints `{complete, <type total>, incomplete}` left to right under its own
# three labels.
AERIAL_INTERVENTIONS: "tuple[tuple[str, str], ...]" = (
    ("punches", "Punches"),
    ("claims", "Claims"),
    ("tipped_palmed", "Tipped/Palmed"),
)
# The triple's three column labels in printed order; `None` is the tile's own type label
# (`Punches` / `Claims` / `Tipped/Palmed`), which is what the middle value keys on.
AERIAL_TRIPLE_LABELS: "tuple[str | None, ...]" = ("Complete", None, "Incomplete")
AERIAL_TRIPLE_KEYS: "tuple[str, ...]" = ("complete", "total", "incomplete")


# --- distribution --------------------------------------------------------------------

# Printed panel title -> payload key. Text-anchored, never positional (AD-8): the four
# panels are equal-area and evenly spaced, so nothing but the title identifies them.
DISTRIBUTION_PANEL_TITLES: "dict[str, str]" = {
    "Kick from Feet": "feet",
    "Kick from Hands": "hands",
    "Throw Distribution": "throw",
    "Total Distributions": "total",
}
# The `Total Distributions` panel is drawn as the union of the other three and prints NO
# donut centre of its own — the three that do are Task 5's printed cross-check.
DISTRIBUTION_PRINTED_PANELS: "tuple[str, ...]" = ("feet", "hands", "throw")
DISTRIBUTION_PANEL_COUNT = 4
# The largest honest gap between a panel's drawn markers and its printed donut centre.
# Measured over 208 team-innings x 3 printed panels: equality on 604/624, +1 on 18 and +2
# on 2, every residual in the `feet` panel, and never negative. `goalkeeping-distribution-
# printed` bounds the overshoot at this rather than leaving it open — see the check.
DISTRIBUTION_PRINTED_MAX_OVERSHOOT = 2

LINE_BREAKS_LABEL = "Goalkeeper Line Breaks"
# The line-breaks tile sits under the `Total Distributions` panel; bounding the search keeps
# the three donut centres (all left of it) out of the centred-value walk. The bound is taken
# from that panel's own resolved `x0` rather than a page coordinate: panel identity is
# already title-anchored here (AD-8), and a hard-coded x would silently change which numbers
# fall inside the band if a template revision shifted the panel row.

# Real dots are 5.83 pt filled circles with a white stroke, in exactly two fills. The size
# window and the palette are the story's corpus-verified values; `pitch_margin_pt` is a
# RECORDED DEPARTURE from the story's `0.0`, and the departure is measured rather than
# assumed:
#
#   * The story's stated reason for strict containment — "any positive margin would admit
#     two Complete/Incomplete legend swatches per panel and inflate every count by 2" — does
#     not hold for this spec. Swept over all 208 corpus pages: the swatches are 9.0 pt
#     circles, outside the 5.0-6.5 size window, and their centres sit 10.5 pt below the
#     frame (y = 417.0 against y1 = 406.5 on all 832 panels). NO out-of-size filled circle
#     sits within 6.0 pt of any frame, so the swatches are excluded twice over.
#   * Strict containment DROPS real markers. Eight team-innings print a distribution dot
#     whose centre falls a fraction of a point below its frame — max overshoot 0.2917 pt
#     over the whole corpus — and on 7 of them admitting it makes the panel's marker count
#     match its printed donut centre EXACTLY, which is the arbiter. This is Story 1.11's
#     touchline-cross finding verbatim, and 1.11 answered it the same way.
#
# 0.5 pt is therefore ~1.7x the largest observed overshoot and 21x smaller than the legend
# distance, with the adjacent panel 36 pt away in x. `legend_min_colors` can never fire
# either (a two-colour palette cannot reach four distinct fills at one y), so no legend-row
# exclusion is needed at all — `exclude_legend_rows` is deliberately not called.
DISTRIBUTION_PITCH_MARGIN_PT = 0.5
DISTRIBUTION_MARKER_SPEC = MarkerSpec(
    marker_min_pt=5.0,
    marker_max_pt=6.5,
    rgb_to_outcome={
        (0.18, 0.30, 1.00): "complete",
        (1.00, 0.00, 0.00): "incomplete",
    },
    pitch_margin_pt=DISTRIBUTION_PITCH_MARGIN_PT,
)
DISTRIBUTION_OUTCOMES: "tuple[str, ...]" = ("complete", "incomplete")


# --- involvement chart ----------------------------------------------------------------

INVOLVEMENT_TITLE_SUFFIX = "GK Involvement Timeline"
TOTAL_INVOLVEMENTS_LABEL = "Total Involvements"

# The chart's horizontal value gridlines share the momentum chart's stroke.
GRID_STROKE: "tuple[float, float, float]" = (0.878, 0.878, 0.878)
RGB_TOL = 0.005
# Dots are 3.0 pt on 21,764 of 21,764 corpus dots.
DOT_MIN_PT, DOT_MAX_PT = 2.5, 3.5
# The y-axis label column: right-aligned well left of the plot box (x1 ~ 29 against a plot
# box starting at ~37 on every corpus page).
AXIS_LABEL_X_MAX = 35.0
GEOMETRY_TOL_PT = 0.05
# How far outside the plot box a dot centre may sit. Dots at value 0 and at the top label
# land exactly ON the bounding gridlines, so this is float slack, not a real margin.
PLOT_MARGIN_PT = 1.0
# Slot spacing agreement across the whole chart. Measured worst deviation over the corpus
# is far below this; it is a template-revision tripwire, not a fit.
SLOT_PITCH_TOL_PT = 0.05
# The dots land exactly ON the value gridlines, so this bound is float slack rather than a
# fit tolerance, and the measurement says so: swept over all 208 corpus charts / 21,764
# dots, the worst deviation from an integer is 0.000001 units. 0.01 leaves four orders of
# magnitude of headroom and is still 50x tighter than the 0.5 at which a dot could round to
# the wrong integer.
#
# This is the resolution of the story's open tolerance question. Its naive
# label-anchored fit — `value = (y_of_zero_LABEL - y) / unit` — carries an offset of
# 1.81 pt, which is 0.117 units on the reference report but scales with the per-report
# unit: measured worst 0.161278 units, exceeding the story's proposed 0.15 bound on 206
# dots rather than on 2 charts. Anchoring the baseline on the zero GRIDLINE instead of the
# zero LABEL removes the fit entirely (see `_involvement_series`), so no tolerance has to
# absorb a systematic offset at all.
INVOLVEMENT_INTEGRALITY_TOL = 0.01

# --- the involvement chart's TIME axis (Story 1.9, Decision 3) -------------------------
#
# The slot COUNT is per report (95-111 regulation, 129-145 extra time). The slot ->
# match-clock MAPPING is per report too, and for the same reason as momentum's: everything
# after half time shifts by that report's own stoppage allotment. It is therefore derived
# from this chart's own printed x-tick labels, never from a formula.
#
# The tick grammar is NOT momentum's, measured over all 208 charts:
#
#   * `FT` is **never printed** (momentum prints it on 94/104) and `HT` on only 122/208, so
#     the second half is pinned by whichever of `HT` / `50` / ... / `90` the chart prints —
#     they agree on one minute-46 slot on 208/208.
#   * Stoppage ticks ARE printed, which momentum's axis has none of. Counted as CHARTS and
#     as READINGS, which differ because a chart may print two of them: `45+N` on 108 charts
#     / 110 readings, `90+N` on 182 / 214, `120+N` on 4 / 4.
#   * The grid runs 0-7 slots past the last tick — but NOT always past it: the gap is 0 on
#     38 charts, where the last tick IS the last slot. Distribution over 208:
#     {0: 38, 1: 56, 2: 46, 3: 38, 4: 28, 7: 2}. So the tail past the last tick carries no
#     printed witness and is stamped by the derived structure alone; do not read the last
#     tick as the end of the series, and do not assume there is a tail either.
#
# Every relation below is exact with 0 deviations corpus-wide (208 charts, 4,508 tick
# readings): tick `M` at slot `M-1` for the first half (1,872/1,872), `45+N` at slot `44+N`
# (110/110), the minute-46 slot unanimous across every second-half tick (208/208) and equal
# to the `HT` tick where printed (122/122), `90+N` at `m46+44+N` (214/214), and both extra
# periods unanimous across their own ticks (18/18 charts).
TICK_BAND_PT = 30.0
# The tick row is read from a margin either side of the plot box. The origin tick `0` is
# centred on slot 0 and so sits on the box's left edge, but the LAST tick is 0-7 slots short
# of the right edge (see the distribution above), so the right-hand margin is there for the
# glyph overhang of a wide label rather than for a tick centred on the edge.
TICK_X_MARGIN_PT = 15.0
# Every tick centres on a slot to well under a hundredth of a slot (worst observed residual
# 0.000529 slots); this is a template-revision tripwire, not a fit.
TICK_SLOT_SNAP_TOL = 0.05
# How far one glyph may start INSIDE the previous one before the run reader calls it an
# overprint rather than an adjacency. Kerning can close a gap to zero; only a double-struck
# insert makes it meaningfully negative.
TICK_GLYPH_OVERLAP_PT = 0.5
HALF_TIME_TICK = "HT"
_TICK_MINUTE_RE = re.compile(r"^\d+$", re.ASCII)
_TICK_STOPPAGE_RE = re.compile(r"^(\d+)\+(\d+)$", re.ASCII)

# Both halves run 45 regular minutes; both extra periods run 15. Slot 0 is match minute 1,
# and the origin tick `0` marks it on 208/208.
REGULATION_HALF = 45
EXTRA_TIME_HALF = 15
# The contract's `StoppageMinute` upper bound (`contract/common.schema.json`), derived here
# rather than imported — `/contract` is an emit-time checklist for this pipeline, not an
# import target. The corpus measures H1 0-10 and H2 1-19, so this is far above anything
# real; a clock structure implying more would stage a record Story 1.16 could not emit, and
# staging an unemittable record silently is what AD-8 forbids. Same value and same reasoning
# as `momentum.MAX_STOPPAGE_MINUTE`, deliberately not shared: the two charts are different
# pages with different grammars, and coupling them would make a momentum template revision
# change what this parser accepts.
MAX_STOPPAGE_MINUTE = 30


def _assert_constant_integrity() -> None:
    """Module-constant integrity, checked once at import (the 1.2/1.4/1.10 rule).

    An authoring bug in the column or panel tables must fail the run at import, not
    surface as 208 identical per-report failures blaming the corpus.
    """
    for name, columns in (
        ("GOAL_PREVENTION_COLUMNS", GOAL_PREVENTION_COLUMNS),
        ("AERIAL_DELIVERY_COLUMNS", AERIAL_DELIVERY_COLUMNS),
    ):
        if len(set(columns)) != len(columns):
            raise ValueError(f"domain_e: duplicate column name in {name}")
    if len(GOAL_PREVENTION_COLUMNS) != 7 or len(INTERVENTION_TYPES) != 5:
        raise ValueError("domain_e: goal prevention is a 7-column table with 5 types")
    if len(AERIAL_DELIVERY_COLUMNS) != 7 or len(AERIAL_DELIVERY_TYPES) != 6:
        raise ValueError("domain_e: aerial delivery is a 7-column table with 6 types")
    if set(DISTRIBUTION_PANEL_TITLES.values()) != {"feet", "hands", "throw", "total"}:
        raise ValueError("domain_e: the four distribution panels are feet/hands/throw/total")
    if len(DISTRIBUTION_PANEL_TITLES) != DISTRIBUTION_PANEL_COUNT:
        raise ValueError("domain_e: expected exactly four distribution panel titles")
    if "total" in DISTRIBUTION_PRINTED_PANELS or set(DISTRIBUTION_PRINTED_PANELS) != {
        "feet",
        "hands",
        "throw",
    }:
        raise ValueError(
            "domain_e: the Total Distributions panel prints no donut centre of its own, so "
            "DISTRIBUTION_PRINTED_PANELS must be exactly feet/hands/throw"
        )
    if set(DISTRIBUTION_MARKER_SPEC.rgb_to_outcome.values()) != set(DISTRIBUTION_OUTCOMES):
        raise ValueError("domain_e: the distribution palette and outcome list disagree")
    # The margin admits a real marker that overshoots its frame; it must never grow far
    # enough to reach the 9.0 pt legend swatches 10.5 pt below the frame, and the size
    # window is the second, independent defence against them.
    if not 0.0 <= DISTRIBUTION_MARKER_SPEC.pitch_margin_pt <= 1.0:
        raise ValueError(
            "domain_e: pitch_margin_pt must stay within 1.0 pt — the Complete/Incomplete "
            "legend swatches sit 10.5 pt below every panel frame"
        )
    if DISTRIBUTION_MARKER_SPEC.marker_max_pt >= 9.0:
        raise ValueError(
            "domain_e: the marker size window must exclude the 9.0 pt legend swatches"
        )
    # The aerial triple is read by `zip`ping labels to keys, and `zip` truncates silently:
    # a fourth key with no fourth label would stage fewer values per tile on all 208
    # innings with nothing failing anywhere. The same for the goal-prevention KPI table,
    # whose keys must exist in the payload the checks read.
    if len(AERIAL_TRIPLE_LABELS) != len(AERIAL_TRIPLE_KEYS):
        raise ValueError(
            f"domain_e: the aerial triple has {len(AERIAL_TRIPLE_LABELS)} column labels "
            f"and {len(AERIAL_TRIPLE_KEYS)} payload keys; zip would truncate"
        )
    if len(set(AERIAL_TRIPLE_KEYS)) != len(AERIAL_TRIPLE_KEYS):
        raise ValueError("domain_e: duplicate payload key in AERIAL_TRIPLE_KEYS")
    if AERIAL_TRIPLE_LABELS.count(None) != 1:
        raise ValueError(
            "domain_e: exactly one aerial triple column is the tile's own type label"
        )
    if AERIAL_DELIVERY_COLUMNS[0] != "total":
        raise ValueError(
            "domain_e: the aerial delivery table's first column is the printed total, and "
            "`crosses_faced_attempted` reads it by that name"
        )
    kpi_keys = [key for key, _label in GOAL_PREVENTION_KPIS]
    if len(set(kpi_keys)) != len(kpi_keys):
        raise ValueError("domain_e: duplicate payload key in GOAL_PREVENTION_KPIS")
    if "attempts_faced_printed" not in kpi_keys or "save_percentage" not in kpi_keys:
        raise ValueError(
            "domain_e: GOAL_PREVENTION_KPIS must stage `attempts_faced_printed` (the "
            "KPI-vs-table cross-check reads it) and `save_percentage`"
        )
    # The clock constants. A tick snap tolerance of half a slot or more would let a tick
    # round to its neighbour's slot and shift a whole period by one minute with nothing
    # failing — the mapping has no printed counterpart to catch that downstream.
    if not 0 < TICK_SLOT_SNAP_TOL < 0.5:
        raise ValueError(
            "domain_e: TICK_SLOT_SNAP_TOL must stay inside half a slot, or a tick can "
            "round onto its neighbour"
        )
    if REGULATION_HALF <= 0 or EXTRA_TIME_HALF <= 0:
        raise ValueError("domain_e: both half lengths are positive minute counts")
    if MAX_STOPPAGE_MINUTE <= 0:
        raise ValueError("domain_e: MAX_STOPPAGE_MINUTE is a positive minute count")
    # The two constants that decide which ticks are read AT ALL. A non-positive band or
    # margin silently empties the read window, and every chart then fails with "prints no
    # x-tick labels under its plot box" — pointing at the PDF for a fault in this file,
    # which is the misattribution the 1.2/1.4/1.10 import-time rule exists to prevent.
    if TICK_BAND_PT <= 0 or TICK_X_MARGIN_PT <= 0:
        raise ValueError(
            "domain_e: TICK_BAND_PT and TICK_X_MARGIN_PT are positive point extents; a "
            "non-positive one empties the tick read window and blames the page"
        )
    if TICK_GLYPH_OVERLAP_PT < 0:
        raise ValueError(
            "domain_e: TICK_GLYPH_OVERLAP_PT is a non-negative overlap allowance"
        )


_assert_constant_integrity()


# --- shared page-reading helpers -----------------------------------------------------


def _band(row: "VisualRow", x_min: float, x_max: float) -> "list[TextSpan]":
    """The row's spans wholly inside `[x_min, x_max]`, left to right."""
    return [span for span in row.spans if span.x0 >= x_min and span.x1 <= x_max]


def _band_text(row: "VisualRow", x_min: float, x_max: float) -> str:
    """Everything the row prints inside the band, joined left to right."""
    return join_spans(_band(row, x_min, x_max))


def _label_runs(
    row: "VisualRow", label: str, x_min: float, x_max: float
) -> "list[tuple[float, float]]":
    """`(x0, x1)` of EVERY contiguous span run inside the band joining to `label` exactly.

    Real pages fragment a label per glyph run (`'D' 'eli' 'v' 'e' 'ry'`); the synthetic
    fixtures print it as one span. Matching over contiguous runs joined by `join_spans`
    accepts both by construction. Exact equality, never a prefix or substring.

    ALL runs, not the leftmost: returning the first match would make every caller's
    "printed twice is ambiguous" guard a per-ROW guard, and the rows this parser keys on
    are precisely the ones that carry several labels each — the four distribution panel
    titles share one row, so do the aerial `Complete / <type> / Incomplete` columns. A
    label repeated inside one row would then bind silently to whichever tile sits left.
    Matches are non-overlapping: a run that matches is consumed before the scan resumes.
    """
    spans = _band(row, x_min, x_max)
    runs: "list[tuple[float, float]]" = []
    start = 0
    while start < len(spans):
        for end in range(start, len(spans)):
            joined = join_spans(spans[start : end + 1])
            if joined == label:
                runs.append((spans[start].x0, spans[end].x1))
                start = end + 1
                break
            if len(joined) >= len(label):
                start += 1
                break
        else:
            start += 1
    return runs


def _find_label(
    rows: "list[VisualRow]",
    label: str,
    x_min: float,
    x_max: float,
    where: str,
    report_id: "str | None",
) -> "tuple[int, float]":
    """`(row index, label centre x)` of the one row printing `label` inside the band.

    Exactly one, asserted: a label the page does not print is a template revision, and a
    label printed twice makes every read keyed on it ambiguous (AD-8). Twice on ONE row
    counts, which is why this walks `_label_runs` rather than a first-match accessor.
    """
    hits = [
        (index, run)
        for index, row in enumerate(rows)
        for run in _label_runs(row, label, x_min, x_max)
    ]
    if not hits:
        raise GoalkeepingPageParseError(
            f"{where} does not print the label {label!r} between x={x_min} and x={x_max}",
            report_id,
        )
    if len(hits) > 1:
        raise GoalkeepingPageParseError(
            f"{where} prints the label {label!r} {len(hits)} times (at "
            f"{[(round(rows[index].y, 2), round((run[0] + run[1]) / 2.0, 2)) for index, run in hits]} "
            "as (row y, centre x)); the value it keys cannot be read unambiguously",
            report_id,
        )
    index, (x0, x1) = hits[0]
    return index, (x0 + x1) / 2.0


def _numbers_in(row: "VisualRow", x_min: float, x_max: float) -> "list[TextSpan]":
    """The row's numeric spans inside the band, left to right."""
    return [
        span for span in _band(row, x_min, x_max) if _NUMBER_RE.match(span.text.strip())
    ]


def _value_above(
    rows: "list[VisualRow]",
    label_index: int,
    centre_x: float,
    x_min: float,
    x_max: float,
    key: str,
    where: str,
    report_id: "str | None",
) -> "tuple[int, str]":
    """`(row index, raw token)` of the KPI value printed above its label, centred on it.

    Walks UP from the label row to the first row carrying a number inside the band whose
    own centre matches the label's. Deliberately NOT "the row immediately above": on the
    goal-prevention page that row is the intervention-type header, and on the distribution
    page the row above `Goalkeeper Line Breaks` carries three donut centres hundreds of
    points to the left. The centre match is what makes the walk safe.
    """
    label_y = rows[label_index].y
    for index in range(label_index - 1, -1, -1):
        if label_y - rows[index].y > KPI_MAX_RISE_PT:
            break
        matches = [
            span
            for span in _numbers_in(rows[index], x_min, x_max)
            if abs(span.center_x - centre_x) <= KPI_CENTRE_TOL_PT
        ]
        if not matches:
            continue
        if len(matches) > 1:
            raise GoalkeepingPageParseError(
                f"{where} KPI {key!r} has {len(matches)} candidate values "
                f"{[span.text for span in matches]} centred on x={centre_x:.1f}",
                report_id,
            )
        return index, matches[0].text.strip()
    raise MissingFieldError(
        f"{where} prints no value within {KPI_MAX_RISE_PT} pt above the {key!r} label "
        f"(centre x={centre_x:.1f})",
        report_id,
    )


def _parse_int(raw: str, where: str, report_id: "str | None") -> int:
    """One printed token as a non-negative integer (AD-7: raw, locale-neutral)."""
    if not _INTEGER_RE.match(raw):
        raise MalformedFieldError(
            f"{where} is not a non-negative integer: {raw!r}", report_id
        )
    return int(raw)


def _parse_percentage(raw: str, where: str, report_id: "str | None") -> float:
    """One printed token as a 0-100 percentage. The page prints NO '%' sign."""
    if not _NUMBER_RE.match(raw):
        raise MalformedFieldError(f"{where} is not numeric: {raw!r}", report_id)
    value = float(raw)
    if not 0.0 <= value <= 100.0:
        raise MalformedFieldError(
            f"{where} percentage outside 0-100: {raw!r}", report_id
        )
    return value


def _find_header_row(
    rows: "list[VisualRow]",
    header: str,
    x_min: float,
    x_max: float,
    where: str,
    report_id: "str | None",
) -> int:
    """The index of the one row whose band text IS this table's column header.

    Equality on the whole band, not containment of a fragment: both E tables print exactly
    one header form across all 208 corpus pages, so a reworded, reordered or dropped column
    is a template revision that must fail loud rather than silently shift every value by
    one position. Header-anchoring is also what separates the real table from the decoy
    seven-digit rows two corpus pages carry higher up (see `GOAL_PREVENTION_TABLE_X_MIN`).
    """
    hits = [
        index
        for index, row in enumerate(rows)
        if _band_text(row, x_min, x_max) == header
    ]
    if len(hits) != 1:
        raise GoalkeepingPageParseError(
            f"{where} prints the table header {header!r} {len(hits)} times right of "
            f"x={x_min}; expected exactly once",
            report_id,
        )
    return hits[0]


def _table_row_below(
    rows: "list[VisualRow]",
    header_index: int,
    x_min: float,
    x_max: float,
    expected: int,
    where: str,
    report_id: "str | None",
) -> "list[int]":
    """The first row below the header carrying exactly `expected` integers in the band.

    Header-anchored AND x-bounded, and both halves were earned on the corpus (see
    `GOAL_PREVENTION_TABLE_X_MIN`). Only rows carrying NO numbers at all are skipped —
    between a header and its values the template prints a second header line whose band
    holds none. The first row that carries any number is the value row, so a count other
    than `expected` there RAISES rather than being skipped past: a template revision that
    changed the column count must fail loud, never silently fall through to some later row
    that happens to hold the right number of integers. A page with no numeric row at all
    raises `MissingFieldError`.
    """
    for index in range(header_index + 1, len(rows)):
        band = _band(rows[index], x_min, x_max)
        numbers = _numbers_in(rows[index], x_min, x_max)
        if not band:
            continue
        # A value row is one that carries a number. Once found, EVERY token in its band
        # must be one: a row reading `3 3 - 0 0 0 1` is a malformed value, not a six-column
        # table, and `_numbers_in`'s pre-filter would otherwise drop the `-` silently and
        # report a count error naming the wrong fault (`errors.py`'s malformed-vs-missing
        # rule). Rows with no number at all are still skipped — the template prints a
        # second header line between a header and its values.
        if not numbers:
            continue
        for span in band:
            _parse_int(span.text.strip(), f"{where}[x={span.x0:.1f}]", report_id)
        if len(numbers) != expected:
            raise GoalkeepingPageParseError(
                f"{where} table row at y={rows[index].y:.2f} carries "
                f"{len(numbers)} value(s) {[span.text for span in numbers]} right of "
                f"x={x_min}, expected {expected}",
                report_id,
            )
        return [
            _parse_int(span.text.strip(), f"{where}[{position}]", report_id)
            for position, span in enumerate(numbers)
        ]
    raise MissingFieldError(
        f"{where} prints no table row of {expected} values below its header", report_id
    )


def _page_for(
    anchors: "dict[str, list[int]]", anchor_id: str, where: str, report_id: "str | None"
) -> int:
    """The one page an anchor resolves to (verified 936/936 corpus pages)."""
    pages = anchors.get(anchor_id)
    if not pages:
        raise GoalkeepingPageParseError(
            f"anchor map carries no resolved {anchor_id!r} page ({where})", report_id
        )
    if len(pages) != 1:
        raise GoalkeepingPageParseError(
            f"{anchor_id!r} anchor resolves to {len(pages)} pages {pages}; expected 1 "
            f"({where})",
            report_id,
        )
    return pages[0]


# --- Goal Prevention ------------------------------------------------------------------


def _parse_goal_prevention(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    side: str,
    report_id: "str | None",
) -> dict:
    """One team's goal-prevention block, from the seven-column table and two KPI tiles."""
    where = f"{side} goal prevention page"
    page = doc[_page_for(anchors, f"{GOAL_PREVENTION_ANCHOR_STEM}:{side}", where, report_id)]
    rows = group_rows(text_spans(page))
    page_x1 = float(page.rect.x1)

    payload: dict = {}
    for key, label in GOAL_PREVENTION_KPIS:
        index, centre_x = _find_label(
            rows, label, 0.0, GOAL_PREVENTION_KPI_X_MAX, where, report_id
        )
        _row, raw = _value_above(
            rows, index, centre_x, 0.0, GOAL_PREVENTION_KPI_X_MAX, key, where, report_id
        )
        payload[key] = (
            _parse_percentage(raw, f"{side}.goal_prevention.{key}", report_id)
            if key == "save_percentage"
            else _parse_int(raw, f"{side}.goal_prevention.{key}", report_id)
        )

    header_index = _find_header_row(
        rows,
        GOAL_PREVENTION_HEADER_TEXT,
        GOAL_PREVENTION_TABLE_X_MIN,
        page_x1,
        where,
        report_id,
    )
    values = _table_row_below(
        rows,
        header_index,
        GOAL_PREVENTION_TABLE_X_MIN,
        page_x1,
        len(GOAL_PREVENTION_COLUMNS),
        f"{side}.goal_prevention",
        report_id,
    )
    table = dict(zip(GOAL_PREVENTION_COLUMNS, values))
    payload["attempts_faced"] = table["attempts_faced"]
    payload["total_interventions"] = table["total_interventions"]
    payload["by_intervention_type"] = {key: table[key] for key in INTERVENTION_TYPES}
    # AC 4 documented absence: the Intervention Body Type donut's slice values are inside
    # raster images, and its text-layer centre is the untrustworthy one (§module docstring).
    payload["by_body_type"] = None
    return payload


# --- Aerial Control -------------------------------------------------------------------


def _parse_aerial_control(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    side: str,
    report_id: "str | None",
) -> dict:
    """One team's aerial-control block: three KPI triples plus the delivery-types table."""
    where = f"{side} aerial control page"
    page = doc[_page_for(anchors, f"{AERIAL_ANCHOR_STEM}:{side}", where, report_id)]
    rows = group_rows(text_spans(page))
    page_x1 = float(page.rect.x1)

    index, centre_x = _find_label(
        rows, "Total Interventions", 0.0, AERIAL_KPI_X_MAX, where, report_id
    )
    _row, raw = _value_above(
        rows,
        index,
        centre_x,
        0.0,
        AERIAL_KPI_X_MAX,
        "total_interventions",
        where,
        report_id,
    )
    payload: dict = {
        "total_interventions": _parse_int(
            raw, f"{side}.aerial_control.total_interventions", report_id
        )
    }

    for key, label in AERIAL_INTERVENTIONS:
        label_index, type_centre = _find_label(
            rows, label, 0.0, AERIAL_KPI_X_MAX, where, report_id
        )
        # The three labels share one visual row; their centres key the three values.
        centres: "list[float]" = []
        for column_label in AERIAL_TRIPLE_LABELS:
            if column_label is None:
                centres.append(type_centre)
                continue
            runs = _label_runs(rows[label_index], column_label, 0.0, AERIAL_KPI_X_MAX)
            if len(runs) != 1:
                raise GoalkeepingPageParseError(
                    f"{where} {label!r} row prints the {column_label!r} column label "
                    f"{len(runs)} times, expected exactly once",
                    report_id,
                )
            centres.append((runs[0][0] + runs[0][1]) / 2.0)
        value_rows: "set[int]" = set()
        triple: "list[int]" = []
        for column, centre in zip(AERIAL_TRIPLE_KEYS, centres):
            row_index, token = _value_above(
                rows,
                label_index,
                centre,
                0.0,
                AERIAL_KPI_X_MAX,
                f"{key}.{column}",
                where,
                report_id,
            )
            value_rows.add(row_index)
            triple.append(_parse_int(token, f"{side}.aerial_control.{key}.{column}", report_id))
        if len(value_rows) != 1:
            # The template prints one value row per triple; three values found on three
            # different rows would mean the centred walk crossed a tile boundary.
            raise GoalkeepingPageParseError(
                f"{where} {label!r} values come from {len(value_rows)} different rows "
                f"(y={sorted(round(rows[i].y, 2) for i in value_rows)}); the tile's three "
                "values must share one row",
                report_id,
            )
        payload[key] = dict(zip(AERIAL_TRIPLE_KEYS, triple))

    header_index = _find_header_row(
        rows, AERIAL_HEADER_TEXT, AERIAL_TABLE_X_MIN, page_x1, where, report_id
    )
    values = _table_row_below(
        rows,
        header_index,
        AERIAL_TABLE_X_MIN,
        page_x1,
        len(AERIAL_DELIVERY_COLUMNS),
        f"{side}.aerial_control.delivery_types_faced",
        report_id,
    )
    delivery = dict(zip(AERIAL_DELIVERY_COLUMNS, values))
    payload["delivery_types_faced"] = delivery
    payload["crosses_faced_attempted"] = delivery["total"]
    # AC 4 documented absence: the completed/attempted split is drawn only as marker colour
    # on a goal-mouth crop, with no printed counterpart to validate a count against.
    payload["crosses_faced_completed"] = None
    return payload


# --- Goalkeeping Distribution ----------------------------------------------------------


def _panel_for_title(
    panels: "list[pymupdf.Rect]", centre_x: float
) -> "int | None":
    """The index of the one panel whose x range contains a title's centre, or `None`."""
    hits = [
        index for index, panel in enumerate(panels) if panel.x0 <= centre_x <= panel.x1
    ]
    return hits[0] if len(hits) == 1 else None


def _parse_distribution(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    side: str,
    report_id: "str | None",
) -> dict:
    """One team's distribution block: four marker panels plus four printed numbers."""
    where = f"{side} goalkeeping distribution page"
    page = doc[_page_for(anchors, f"{DISTRIBUTION_ANCHOR_STEM}:{side}", where, report_id)]
    # The plural accessor is mandatory here: all four panels have area 59,516.0 pt^2, so
    # `detect_pitch_frame`'s `max()` would return an arbitrary one of them and silently
    # discard the other three (the Story 1.12 lesson, verbatim). A page with NO qualifying
    # rectangle raises the chain's own `PitchFrameError`, which travels as itself.
    panels = detect_pitch_frames(page, report_id)
    if len(panels) != DISTRIBUTION_PANEL_COUNT:
        raise GoalkeepingPageParseError(
            f"{where} carries {len(panels)} pitch panels, expected "
            f"{DISTRIBUTION_PANEL_COUNT}",
            report_id,
        )
    panel_top = min(panel.y0 for panel in panels)
    panel_bottom = max(panel.y1 for panel in panels)

    rows = group_rows(text_spans(page))
    page_x1 = float(page.rect.x1)

    # Panel -> category by the printed TITLE, never by position (AD-8). Titles print above
    # the panel band; each maps to exactly one panel by x containment, and every panel must
    # be claimed exactly once.
    title_rows = [row for row in rows if row.y < panel_top]
    panel_keys: "dict[int, str]" = {}
    for title, key in DISTRIBUTION_PANEL_TITLES.items():
        hits = [
            run for row in title_rows for run in _label_runs(row, title, 0.0, page_x1)
        ]
        if len(hits) != 1:
            raise GoalkeepingPageParseError(
                f"{where} prints the panel title {title!r} {len(hits)} times above the "
                "panel band; expected exactly once",
                report_id,
            )
        panel_index = _panel_for_title(panels, (hits[0][0] + hits[0][1]) / 2.0)
        if panel_index is None:
            raise GoalkeepingPageParseError(
                f"{where} panel title {title!r} does not sit above exactly one panel",
                report_id,
            )
        if panel_index in panel_keys:
            raise GoalkeepingPageParseError(
                f"{where} panel {panel_index} is claimed by both "
                f"{panel_keys[panel_index]!r} and {key!r}",
                report_id,
            )
        panel_keys[panel_index] = key
    if len(panel_keys) != DISTRIBUTION_PANEL_COUNT:
        raise GoalkeepingPageParseError(
            f"{where} matched {len(panel_keys)} of {DISTRIBUTION_PANEL_COUNT} panels to a "
            "printed title",
            report_id,
        )

    # Geometry before colour (AD-9), assert-on-unknown RGB. No dedup: two markers at the
    # same point are two distributions, and the printed donut centre — which agrees with
    # the undeduped count on 208/208 — is the arbiter.
    drawings = page.get_drawings()
    counts: "dict[str, dict]" = {}
    for panel_index, key in sorted(panel_keys.items()):
        candidates = collect_candidate_markers(
            drawings, panels[panel_index], DISTRIBUTION_MARKER_SPEC
        )
        keyed = key_outcomes(
            candidates, DISTRIBUTION_MARKER_SPEC, report_id, page.number
        )
        block = {
            outcome: sum(1 for marker in keyed if marker.outcome == outcome)
            for outcome in DISTRIBUTION_OUTCOMES
        }
        block["total"] = len(keyed)
        block["printed_total"] = None
        counts[key] = block

    # The four printed numbers below the panel band: three donut centres (one per panel,
    # feet/hands/throw) plus the Goalkeeper Line Breaks tile. Exactly four on 208/208 — a
    # page-level census, because everything else here is found by name and a template
    # revision that ADDED a printed number would otherwise stage silently.
    below = [row for row in rows if row.y > panel_bottom]
    numeric_spans = [
        span for row in below for span in _numbers_in(row, 0.0, page_x1)
    ]
    expected_numbers = len(DISTRIBUTION_PRINTED_PANELS) + 1
    if len(numeric_spans) != expected_numbers:
        raise GoalkeepingPageParseError(
            f"{where} prints {len(numeric_spans)} numbers "
            f"{[span.text for span in numeric_spans]} below the panel band, expected "
            f"{expected_numbers} (three donut centres plus the line-breaks tile)",
            report_id,
        )

    # The band comes from the `Total Distributions` panel's own resolved rect, not a page
    # coordinate: that panel is already identified by its printed title, so the bound moves
    # with the layout instead of silently changing which numbers it admits (AD-8).
    total_panel = panels[
        next(index for index, key in panel_keys.items() if key == "total")
    ]
    label_index, centre_x = _find_label(
        rows, LINE_BREAKS_LABEL, total_panel.x0, page_x1, where, report_id
    )
    _row, raw = _value_above(
        rows,
        label_index,
        centre_x,
        total_panel.x0,
        page_x1,
        "line_breaks",
        where,
        report_id,
    )
    line_breaks = _parse_int(raw, f"{side}.distribution.line_breaks", report_id)

    donut_spans = [
        span
        for span in numeric_spans
        if not (
            span.text.strip() == raw
            and abs(span.center_x - centre_x) <= KPI_CENTRE_TOL_PT
        )
    ]
    for panel_index, key in sorted(panel_keys.items()):
        if key not in DISTRIBUTION_PRINTED_PANELS:
            continue
        panel = panels[panel_index]
        inside = [span for span in donut_spans if panel.x0 <= span.center_x <= panel.x1]
        if len(inside) != 1:
            raise GoalkeepingPageParseError(
                f"{where} {key!r} panel has {len(inside)} printed donut centre(s) "
                f"{[span.text for span in inside]} below it, expected 1",
                report_id,
            )
        counts[key]["printed_total"] = _parse_int(
            inside[0].text.strip(), f"{side}.distribution.{key}.printed_total", report_id
        )

    payload = dict(counts)
    payload["line_breaks"] = line_breaks
    # AC 4 documented absences: the donut SLICE labels are inside raster images; only the
    # centre total is in the text layer (identical to Story 1.13's movement-donut finding).
    payload["feet_techniques"] = None
    payload["hands_techniques"] = None
    payload["throw_techniques"] = None
    return payload


# --- Goalkeeping Involvement -----------------------------------------------------------


def _close(rgb, target) -> bool:
    """Whether a path colour is the target palette colour."""
    return (
        rgb is not None
        and len(rgb) == len(target)
        and all(abs(a - b) <= RGB_TOL for a, b in zip(rgb, target))
    )


def _axis_labels(
    rows: "list[VisualRow]", y0: float, y1: float, where: str, report_id: "str | None"
) -> "list[tuple[float, int]]":
    """`(centre y, value)` for the printed y-axis labels, top to bottom.

    The template prints a descending run of consecutive integers ending at 0 (`4 3 2 1 0`
    on the reference report; the top label auto-scales). Anything else is a template
    revision the chart's scale cannot be derived from.
    """
    labels: "list[tuple[float, int]]" = []
    for row in rows:
        for span in row.spans:
            if span.x1 > AXIS_LABEL_X_MAX or not (y0 <= span.center_y <= y1):
                continue
            text = span.text.strip()
            if not _INTEGER_RE.match(text):
                raise InvolvementChartError(
                    f"{where} y-axis label column carries the non-integer {text!r}",
                    report_id,
                )
            labels.append((span.center_y, int(text)))
    labels.sort()
    if len(labels) < 2:
        raise InvolvementChartError(
            f"{where} y-axis column holds {len(labels)} label(s); the value scale cannot "
            "be derived",
            report_id,
        )
    values = [value for _y, value in labels]
    if values != list(range(len(values) - 1, -1, -1)):
        raise InvolvementChartError(
            f"{where} y-axis labels are {values}, not a descending run of consecutive "
            "integers ending at 0",
            report_id,
        )
    return labels


def _value_gridlines(
    page: "pymupdf.Page", y0: float, y1: float, where: str, report_id: "str | None"
) -> "tuple[float, float, list[float]]":
    """`(plot_x0, plot_x1, gridline ys top-to-bottom)` for one chart's plot box."""
    lines: "list[tuple[float, float, float]]" = []
    for drawing in page.get_drawings():
        if tuple(item[0] for item in drawing["items"]) != ("l",):
            continue
        if not _close(drawing.get("color"), GRID_STROKE):
            continue
        rect = drawing["rect"]
        if abs(rect.y1 - rect.y0) > GEOMETRY_TOL_PT:  # horizontal only
            continue
        if not y0 <= rect.y0 <= y1:
            continue
        lines.append((round(rect.y0, 3), rect.x0, rect.x1))
    if not lines:
        raise InvolvementChartError(f"{where} draws no value gridlines", report_id)
    # Compared within `GEOMETRY_TOL_PT`, not by equality on the rounded values. Rounding to
    # three decimals and then demanding an exact match is a 0.001 pt tripwire in a module
    # that everywhere else allows 0.05 pt of float noise; two lines drawn under slightly
    # different transforms would abort the whole report over drawing noise, not a template
    # revision. The bound is still tight: the plot box is ~500 pt wide.
    plot_x0 = min(x0 for _y, x0, _x1 in lines)
    plot_x1 = max(x1 for _y, _x0, x1 in lines)
    ragged = [
        (round(x0, 3), round(x1, 3))
        for _y, x0, x1 in lines
        if abs(x0 - plot_x0) > GEOMETRY_TOL_PT or abs(x1 - plot_x1) > GEOMETRY_TOL_PT
    ]
    if ragged:
        raise InvolvementChartError(
            f"{where} gridlines do not share one horizontal extent within "
            f"{GEOMETRY_TOL_PT} pt of {(round(plot_x0, 3), round(plot_x1, 3))}: "
            f"{sorted(set(ragged))}",
            report_id,
        )
    if plot_x1 - plot_x0 <= 0:
        raise InvolvementChartError(
            f"{where} plot box has no width: {plot_x0}..{plot_x1}", report_id
        )
    return plot_x0, plot_x1, sorted({y for y, _x0, _x1 in lines})


def _gridline_run(
    ys: "list[float]", count: int, unit: float, where: str, report_id: "str | None"
) -> "list[float]":
    """The one run of `count` gridlines spaced `unit` apart, top to bottom.

    The chart draws MORE lines than the axis labels: an axis rule sits 0.75 pt below the
    zero line on every corpus chart, exactly as the momentum chart's tenth line does. So
    the unit is derived from the printed LABELS (an independent source) and used here to
    SELECT the value gridlines — never derived from gridline spacing, which a naive run
    over all the lines would get wrong. The two sources agreeing is the assertion.
    """
    runs: "list[list[float]]" = []
    for start in range(len(ys)):
        run = [ys[start]]
        for y in ys[start + 1 :]:
            if abs(y - (run[-1] + unit)) <= GEOMETRY_TOL_PT:
                run.append(y)
        if len(run) == count:
            runs.append(run)
    if len(runs) != 1:
        raise InvolvementChartError(
            f"{where} has {len(runs)} runs of {count} gridlines spaced {unit:.4f} pt "
            f"apart among {ys}; the printed axis and the drawn grid disagree",
            report_id,
        )
    run = runs[0]
    # The selected run must START at the top of the grid, and uniqueness alone does not
    # give that. A chart drawing ONE extra evenly-spaced line below zero makes the
    # top-anchored candidate `count + 1` long — rejected for being too long — while the
    # candidate starting one line down is exactly `count`, so it is uniquely selected and
    # every value then reads one unit high off a baseline that is not zero. Caught here
    # rather than downstream: the range guard only fires if some dot happens to reach the
    # top label, and the involvement bound would report it as a count mismatch, blaming
    # the printed total for a misread axis.
    stragglers = [y for y in ys if run[0] - y > unit / 2.0]
    if stragglers:
        raise InvolvementChartError(
            f"{where} draws {len(stragglers)} gridline(s) {[round(y, 3) for y in stragglers]} "
            f"a full unit or more ABOVE the run's top line {run[0]:.3f}; the run does not "
            "start at the top of the grid, so its last line is not the axis zero",
            report_id,
        )
    return run


def _chart_dots(
    page: "pymupdf.Page", plot_x0: float, plot_x1: float, y0: float, y1: float
) -> "list[tuple[float, float]]":
    """`(centre x, centre y)` of every value dot inside one chart's plot box."""
    dots: "list[tuple[float, float]]" = []
    for drawing in page.get_drawings():
        if drawing.get("fill") is None:
            continue
        items = drawing["items"]
        if not items or not all(item[0] == "c" for item in items):
            continue
        rect = drawing["rect"]
        if not (
            DOT_MIN_PT <= rect.width <= DOT_MAX_PT
            and DOT_MIN_PT <= rect.height <= DOT_MAX_PT
        ):
            continue
        centre_x = (rect.x0 + rect.x1) / 2.0
        centre_y = (rect.y0 + rect.y1) / 2.0
        if not (
            plot_x0 - PLOT_MARGIN_PT <= centre_x <= plot_x1 + PLOT_MARGIN_PT
            and y0 - PLOT_MARGIN_PT <= centre_y <= y1 + PLOT_MARGIN_PT
        ):
            continue
        dots.append((centre_x, centre_y))
    dots.sort()
    return dots


def _involvement_series(
    page: "pymupdf.Page",
    rows: "list[VisualRow]",
    band: "tuple[float, float]",
    where: str,
    report_id: "str | None",
) -> "tuple[list[int], dict]":
    """One chart's per-slot involvement counts, left to right, plus its slot grid.

    The grid — `{plot_x0, plot_x1, zero_line, first_dot_x, pitch}` — travels back to the
    caller because the TIME axis is read against exactly the same grid the VALUES are
    read against: a tick's slot is `(tick_x - first_dot_x) / pitch`, so the two axes can
    never be measured off two subtly different origins.

    The scale is established twice from two independent sources and the two must agree:
    the printed y-axis labels give the points-per-unit factor, and the drawn value
    gridlines give the baseline.

    Deriving BOTH from the labels carries a systematic offset — the labels sit 1.81 pt
    above their gridlines, and because the unit is per-report that is 0.117 units on the
    reference report but up to 0.161278 units across the corpus. Deriving both from the
    grid would leave the printed axis unverified. Anchoring the baseline on the zero
    GRIDLINE is exact: every dot lands on a gridline, so a value's distance from an
    integer is float noise (worst 0.000001 units over 21,764 corpus dots), not a fit.
    """
    y0, y1 = band
    labels = _axis_labels(rows, y0, y1, where, report_id)
    top_label = labels[0][1]
    unit = (labels[-1][0] - labels[0][0]) / top_label
    if unit <= 0:
        raise InvolvementChartError(
            f"{where} y-axis labels give a non-positive unit ({unit:.4f} pt)", report_id
        )

    plot_x0, plot_x1, gridline_ys = _value_gridlines(page, y0, y1, where, report_id)
    value_lines = _gridline_run(gridline_ys, len(labels), unit, where, report_id)
    top_line, zero_line = value_lines[0], value_lines[-1]

    # Collected over the whole chart BAND, not just between the top and zero gridlines.
    # Bounding by the value lines would silently DROP a dot drawn outside them, and the
    # series would then fail as "not evenly spaced" — a message that points at the slot
    # grid when the real fault is a value off the axis. Admitting it and rejecting it
    # below names the actual problem, and keeps the two range guards reachable rather than
    # dead by construction. The band is still a real bound: on 208/208 corpus charts the
    # only 3.0 pt filled circles inside it are the value dots.
    dots = _chart_dots(page, plot_x0, plot_x1, y0, y1)
    if len(dots) < 2:
        raise InvolvementChartError(
            f"{where} draws {len(dots)} value dot(s); the slot grid cannot be established",
            report_id,
        )
    xs = [x for x, _y in dots]
    pitch = (xs[-1] - xs[0]) / (len(xs) - 1)
    if pitch <= 0:
        raise InvolvementChartError(f"{where} value dots do not advance in x", report_id)
    for index in range(1, len(xs)):
        if abs((xs[index] - xs[index - 1]) - pitch) > SLOT_PITCH_TOL_PT:
            raise InvolvementChartError(
                f"{where} value dots are not evenly spaced: dot {index} sits "
                f"{xs[index] - xs[index - 1]:.4f} pt after its neighbour, slot pitch "
                f"{pitch:.4f} pt",
                report_id,
            )
    # The dots span the whole plot box on every corpus chart; a chart that started or
    # ended short would silently drop leading or trailing slots from the series.
    for name, drawn, printed in (("first", xs[0], plot_x0), ("last", xs[-1], plot_x1)):
        if abs(drawn - printed) > PLOT_MARGIN_PT:
            raise InvolvementChartError(
                f"{where} {name} value dot sits at x={drawn:.3f}, {abs(drawn - printed):.3f} "
                f"pt from the plot box edge x={printed:.3f}",
                report_id,
            )

    series: "list[int]" = []
    for centre_x, centre_y in dots:
        raw = (zero_line - centre_y) / unit
        # Range before integrality, so a dot off the axis is reported as off the axis
        # rather than as a rounding failure. The tolerance is the same float slack: a
        # value-0 dot reads exactly 0.0, never a small negative.
        if raw < -INVOLVEMENT_INTEGRALITY_TOL:
            raise InvolvementChartError(
                f"{where} dot at x={centre_x:.3f} sits {-raw:.4f} units BELOW the zero "
                "line; an involvement count cannot be negative",
                report_id,
            )
        if raw > top_label + INVOLVEMENT_INTEGRALITY_TOL:
            raise InvolvementChartError(
                f"{where} dot at x={centre_x:.3f} reads {raw:.4f} units, above the printed "
                f"axis top label {top_label}; the chart's auto-scale no longer bounds it",
                report_id,
            )
        value = round(raw)
        if abs(raw - value) > INVOLVEMENT_INTEGRALITY_TOL:
            raise InvolvementChartError(
                f"{where} dot at x={centre_x:.3f} sits {raw:.4f} units above the zero "
                "line, which is not an integer",
                report_id,
            )
        series.append(value)
    return series, {
        "plot_x0": plot_x0,
        "plot_x1": plot_x1,
        "zero_line": zero_line,
        "first_dot_x": xs[0],
        "pitch": pitch,
    }


# --- the involvement chart's TIME axis ---------------------------------------------------


def _tick_runs(
    page: "pymupdf.Page", x0: float, x1: float, y0: float, y1: float, where: str,
    report_id: "str | None",
) -> "list[tuple[str, float]]":
    """`(label, centre x)` for every x-tick under one chart's plot box.

    Character-level and regrouped, not span-level — and that is not a stylistic choice.
    pymupdf merges adjacent same-font inserts, so on the two corpus reports whose half-time
    tick sits ONE slot after the 45' tick (`PMSR-M86-ARG-V-CPV` and `PMSR-M100-ARG-V-SUI`)
    the page hands back a single `'45HT'` span whose centre is neither tick's. Read
    span-level, those four charts fail with "tick '45HT' is not a slot centre" while the
    page is perfectly well formed; read character-level they parse. This is Story 1.7's
    merged-span lesson and momentum's `_tick_runs` reaching the same conclusion.

    Runs break on the digit-class boundary, with `+` folded in WITH the digits so a
    stoppage tick `90+5` stays one label while `45HT` still splits in two. Grouping is by
    text line as well as by x, so a stray label on a second line in the band cannot splice
    its characters into a tick.
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
    chars.sort()
    glyphs = [char for char in chars if not char[3].isspace()]
    if not glyphs:
        raise InvolvementClockError(
            f"{where} prints no x-tick labels under its plot box; the slot -> match-clock "
            "mapping has no source",
            report_id,
        )
    # One text line, asserted over the CHARACTERS and BEFORE grouping. Asserting it over the
    # runs cannot see the fault it exists to catch: two lines close enough in y to splice
    # merge into a single run carrying a single y, so the spread reads 0.0 exactly when the
    # splice happened, and the assertion fires only when a second line FAILS to splice — the
    # harmless case. The band is 30 pt tall, with room for a second line of page furniture,
    # and a character from another line carries a centre x that means nothing on this
    # chart's slot grid.
    lines_y = [glyph[0] for glyph in glyphs]
    if max(lines_y) - min(lines_y) > 1.0:
        raise InvolvementClockError(
            f"{where} x-tick band holds text on more than one line "
            f"({[round(y, 2) for y in sorted(set(round(y, 2) for y in lines_y))]}); the "
            "tick row cannot be identified",
            report_id,
        )
    runs: "list[list]" = []
    for _centre_y, cx0, cx1, char in glyphs:
        kind = "number" if (char.isdigit() or char == "+") else "other"
        gap = cx0 - runs[-1][2] if runs else None
        if gap is not None and gap < -TICK_GLYPH_OVERLAP_PT:
            # Overlapping glyphs, not adjacent ones. A double-struck label (faux bold, a
            # double-stroke insert) hands back each glyph twice at the same x, and a bare
            # `gap < 1.5` merge is satisfied by a NEGATIVE gap — so `45` drawn twice would
            # concatenate to the run `4455` and be read as a minute. Assert rather than
            # absorb (AD-8): no corpus page overprints, so this can only be a revision.
            raise InvolvementClockError(
                f"{where} x-tick band draws overlapping glyphs "
                f"({char!r} starts {abs(gap):.2f} pt inside the previous glyph); the tick "
                "labels cannot be read as written",
                report_id,
            )
        if runs and runs[-1][0] == kind and gap < 1.5:
            runs[-1][2] = cx1
            runs[-1][3] += char
        else:
            runs.append([kind, cx0, cx1, char])
    return [(run[3], (run[1] + run[2]) / 2.0) for run in runs]


def _involvement_ticks(
    page: "pymupdf.Page", grid: dict, band_bottom: float, where: str,
    report_id: "str | None",
) -> "dict[str, int]":
    """Every printed x-tick as `label -> slot index`, against this chart's own slot grid.

    Each tick must land on a slot centre and each label may appear only once: a tick
    printed twice makes whichever period it pins ambiguous, and there is no printed
    counterpart anywhere on the page to catch the wrong choice (AD-8).

    The read window is clipped to `band_bottom` — this chart's own band, the same bound
    `_involvement_series` reads its dots inside. ONE page carries BOTH teams' charts, so an
    unclipped `zero_line + TICK_BAND_PT` is a page coordinate that happens to fall short of
    the next chart rather than a bound that cannot reach it, and the next chart's title
    entering this chart's tick read would abort a well-formed report.
    """
    readings = _tick_runs(
        page,
        grid["plot_x0"] - TICK_X_MARGIN_PT,
        grid["plot_x1"] + TICK_X_MARGIN_PT,
        grid["zero_line"] + 0.5,
        min(grid["zero_line"] + TICK_BAND_PT, band_bottom),
        where,
        report_id,
    )
    ticks: "dict[str, int]" = {}
    for label, centre_x in readings:
        fractional = (centre_x - grid["first_dot_x"]) / grid["pitch"]
        slot = round(fractional)
        if abs(fractional - slot) > TICK_SLOT_SNAP_TOL:
            raise InvolvementClockError(
                f"{where} x-tick {label!r} sits at slot {fractional:.4f}, which is not a "
                "slot centre",
                report_id,
            )
        if label in ticks:
            raise InvolvementClockError(
                f"{where} prints the x-tick {label!r} more than once", report_id
            )
        ticks[label] = slot
    return ticks


def _involvement_clock(
    ticks: "dict[str, int]", slot_count: int, where: str, report_id: "str | None"
) -> dict:
    """The slot -> match-clock structure, derived from this chart's own printed ticks.

    Returns `{second_half_slot, first_extra_slot, second_extra_slot}` — the slot carrying
    match minute 46, minute 91 and minute 106 respectively, the last two `None` on the 95
    regulation reports. Everything else follows from those three plus the slot count, so
    they are the whole mapping.

    Nothing here is assumed. Each boundary is pinned by EVERY tick that speaks to it and
    the candidates must be unanimous; every tick the boundaries then determine is asserted
    against its own printed position. The redundancy is the point — on a chart printing
    `HT`, `50`, `55` ... `90` and `90+5`, twelve independent readings have to agree before
    a single minute is staged.

    One thing is deliberately NOT asserted: that each period ran its regular length. It is
    true of every period on 206 of 208 charts, and `PMSR-M88-AUS-V-EGY` (both charts,
    which is why the remainder is 206 and not 207)
    prints a first extra period of 14 slots — its `105'` tick is absent and its `110'`
    tick sits one slot earlier than a 15-minute ET1 would put it, so the page is
    internally consistent and simply says that minute 105 has no slot. Failing that report
    would be asserting football over the source; the short period is recorded in
    `goalkeeping-involvement-clock`'s specifics on every report instead, and ledgered.
    """
    minutes: "dict[int, int]" = {}
    stoppages: "dict[tuple[int, int], int]" = {}
    half_time: "int | None" = None
    full_time = 2 * (REGULATION_HALF + EXTRA_TIME_HALF)
    for label, slot in ticks.items():
        if label == HALF_TIME_TICK:
            half_time = slot
        elif _TICK_MINUTE_RE.match(label):
            minute = int(label)
            # Bounded, because the run grammar cannot tell one long label from two short
            # ones spliced together: `45` and `90` merged by an overlapping glyph read as
            # the single minute `4590`, which falls in NO period bucket below and would
            # then be caught only by the round trip, blaming the derived clock for a
            # misread label. A minute tick past full time is not a minute tick.
            if not 0 <= minute <= full_time:
                raise InvolvementClockError(
                    f"{where} x-tick {label!r} reads as match minute {minute}, past full "
                    f"time ({full_time}); the tick row is misread, most likely two labels "
                    "merged into one run",
                    report_id,
                )
            minutes[minute] = slot
        else:
            stoppage = _TICK_STOPPAGE_RE.match(label)
            if stoppage is None:
                # Closed grammar, assert-on-unknown (AD-8). A label this parser cannot
                # read is a template revision, and quietly ignoring it would silently drop
                # whichever boundary it was the only witness to.
                raise InvolvementClockError(
                    f"{where} x-tick {label!r} is neither a minute, a `M+N` stoppage "
                    f"minute nor {HALF_TIME_TICK!r}",
                    report_id,
                )
            base, added = int(stoppage.group(1)), int(stoppage.group(2))
            # Same reasoning on the stoppage half, and the same merge is what makes it
            # necessary: `90+5` followed by `95` splices to `90+595`, which this regex
            # accepts as base 90 / added 595.
            if not 0 <= added <= MAX_STOPPAGE_MINUTE:
                raise InvolvementClockError(
                    f"{where} x-tick {label!r} reads as {added} stoppage minutes, past the "
                    f"contract's {MAX_STOPPAGE_MINUTE}; the tick row is misread, most "
                    "likely two labels merged into one run",
                    report_id,
                )
            stoppages[(base, added)] = slot

    # The origin. Slot 0 is match minute 1 and the chart labels it `0` on 208/208; without
    # it the whole grid could be shifted and every later assertion would still pass.
    if minutes.get(0) != 0:
        raise InvolvementClockError(
            f"{where} does not print its origin tick '0' on slot 0 "
            f"(found {minutes.get(0)})",
            report_id,
        )
    for minute, slot in sorted(minutes.items()):
        if 1 <= minute <= REGULATION_HALF and slot != minute - 1:
            raise InvolvementClockError(
                f"{where} first-half x-tick {minute}' sits at slot {slot}, expected "
                f"{minute - 1}",
                report_id,
            )
    for (base, added), slot in sorted(stoppages.items()):
        if base == REGULATION_HALF and slot != REGULATION_HALF - 1 + added:
            raise InvolvementClockError(
                f"{where} x-tick '{base}+{added}' sits at slot {slot}, expected "
                f"{REGULATION_HALF - 1 + added}",
                report_id,
            )

    second_half_slot = _unanimous(
        {
            **({HALF_TIME_TICK: half_time} if half_time is not None else {}),
            **{
                str(minute): slot - (minute - REGULATION_HALF - 1)
                for minute, slot in minutes.items()
                if REGULATION_HALF < minute <= 2 * REGULATION_HALF
            },
        },
        "second half",
        where,
        report_id,
    )
    for (base, added), slot in sorted(stoppages.items()):
        if base == 2 * REGULATION_HALF and slot != second_half_slot + REGULATION_HALF - 1 + added:
            raise InvolvementClockError(
                f"{where} x-tick '{base}+{added}' sits at slot {slot}, expected "
                f"{second_half_slot + REGULATION_HALF - 1 + added}",
                report_id,
            )

    first_extra = {
        str(minute): slot - (minute - 2 * REGULATION_HALF - 1)
        for minute, slot in minutes.items()
        if 2 * REGULATION_HALF < minute <= 2 * REGULATION_HALF + EXTRA_TIME_HALF
    }
    second_extra = {
        str(minute): slot - (minute - 2 * REGULATION_HALF - EXTRA_TIME_HALF - 1)
        for minute, slot in minutes.items()
        if 2 * REGULATION_HALF + EXTRA_TIME_HALF < minute <= 2 * (REGULATION_HALF + EXTRA_TIME_HALF)
    }
    first_extra_slot: "int | None" = None
    second_extra_slot: "int | None" = None
    if first_extra or second_extra:
        # Both or neither. One extra period's ticks alone cannot place the other, and
        # guessing the missing boundary from a 15-minute assumption is exactly what the
        # `PMSR-M88` chart shows to be wrong.
        if not first_extra or not second_extra:
            raise InvolvementClockError(
                f"{where} prints ticks for only one extra period "
                f"(first {sorted(first_extra)}, second {sorted(second_extra)}); the other "
                "boundary cannot be placed",
                report_id,
            )
        first_extra_slot = _unanimous(first_extra, "first extra period", where, report_id)
        second_extra_slot = _unanimous(second_extra, "second extra period", where, report_id)
        for (base, added), slot in sorted(stoppages.items()):
            if base == 2 * (REGULATION_HALF + EXTRA_TIME_HALF) and (
                slot != second_extra_slot + EXTRA_TIME_HALF - 1 + added
            ):
                raise InvolvementClockError(
                    f"{where} x-tick '{base}+{added}' sits at slot {slot}, expected "
                    f"{second_extra_slot + EXTRA_TIME_HALF - 1 + added}",
                    report_id,
                )
    else:
        for base, added in sorted(stoppages):
            if base not in (REGULATION_HALF, 2 * REGULATION_HALF):
                raise InvolvementClockError(
                    f"{where} prints the stoppage tick '{base}+{added}' but no extra-time "
                    "minute tick to place the period it belongs to",
                    report_id,
                )

    _assert_clock_bounds(
        second_half_slot, first_extra_slot, second_extra_slot, slot_count, where, report_id
    )
    return {
        "second_half_slot": second_half_slot,
        "first_extra_slot": first_extra_slot,
        "second_extra_slot": second_extra_slot,
    }


def _unanimous(
    candidates: "dict[str, int]", what: str, where: str, report_id: "str | None"
) -> int:
    """The one slot every witness agrees on, or a loud failure naming the disagreement."""
    if not candidates:
        raise InvolvementClockError(
            f"{where} prints no x-tick that places the {what}", report_id
        )
    agreed = set(candidates.values())
    if len(agreed) != 1:
        raise InvolvementClockError(
            f"{where} x-ticks disagree on where the {what} starts: "
            f"{dict(sorted(candidates.items()))}",
            report_id,
        )
    return agreed.pop()


def _assert_clock_bounds(
    second_half_slot: int,
    first_extra_slot: "int | None",
    second_extra_slot: "int | None",
    slot_count: int,
    where: str,
    report_id: "str | None",
) -> None:
    """Every derived boundary lands inside the drawn grid, in order, within the contract.

    The stoppage bounds are the reason this is not merely tidiness: every slot between the
    45' tick and the half-time boundary is a first-half stoppage minute, so a boundary far
    down the grid does not just look odd — it stages `stoppage_minute` values the
    contract's `StoppageMinute` cannot express, and nothing between here and Story 1.16's
    emit boundary would notice.
    """
    if second_half_slot < REGULATION_HALF:
        raise InvolvementClockError(
            f"{where} places match minute 46 on slot {second_half_slot}, before the first "
            f"half's {REGULATION_HALF} regular minutes",
            report_id,
        )
    first_half_stoppage = second_half_slot - REGULATION_HALF
    if first_half_stoppage > MAX_STOPPAGE_MINUTE:
        raise InvolvementClockError(
            f"{where} implies {first_half_stoppage} first-half stoppage minutes, past the "
            f"contract's {MAX_STOPPAGE_MINUTE}",
            report_id,
        )
    regulation_end = slot_count - 1 if first_extra_slot is None else first_extra_slot - 1
    if regulation_end < second_half_slot + REGULATION_HALF - 1:
        raise InvolvementClockError(
            f"{where} regulation ends at slot {regulation_end}, before the second half's "
            f"{REGULATION_HALF} regular minutes are drawn",
            report_id,
        )
    second_half_stoppage = regulation_end - (second_half_slot + REGULATION_HALF - 1)
    if second_half_stoppage > MAX_STOPPAGE_MINUTE:
        raise InvolvementClockError(
            f"{where} implies {second_half_stoppage} second-half stoppage minutes, past "
            f"the contract's {MAX_STOPPAGE_MINUTE}",
            report_id,
        )
    if first_extra_slot is None:
        return
    if second_extra_slot <= first_extra_slot:
        raise InvolvementClockError(
            f"{where} places the second extra period on slot {second_extra_slot}, at or "
            f"before the first's slot {first_extra_slot}",
            report_id,
        )
    if second_extra_slot > slot_count - 1:
        raise InvolvementClockError(
            f"{where} places match minute 106 on slot {second_extra_slot}, outside the "
            f"chart's {slot_count} slots",
            report_id,
        )
    first_extra_stoppage = (second_extra_slot - first_extra_slot) - EXTRA_TIME_HALF
    if first_extra_stoppage > MAX_STOPPAGE_MINUTE:
        raise InvolvementClockError(
            f"{where} implies {first_extra_stoppage} first-extra-period stoppage minutes, "
            f"past the contract's {MAX_STOPPAGE_MINUTE}",
            report_id,
        )
    second_extra_stoppage = (slot_count - 1 - second_extra_slot) - (EXTRA_TIME_HALF - 1)
    if second_extra_stoppage > MAX_STOPPAGE_MINUTE:
        raise InvolvementClockError(
            f"{where} implies {second_extra_stoppage} second-extra-period stoppage "
            f"minutes, past the contract's {MAX_STOPPAGE_MINUTE}",
            report_id,
        )


def _involvement_stamp(slot: int, structure: dict, slot_count: int) -> "dict":
    """`{minute, stoppage_minute}` for one slot, from the derived clock structure.

    Raw and flat (AD-7): two integers, `stoppage_minute` `None` on a regular minute. The
    contract's `MinuteStamp` composite is Story 1.16's emit-time shape, not this one.
    """
    second_half = structure["second_half_slot"]
    first_extra = structure["first_extra_slot"]
    second_extra = structure["second_extra_slot"]

    def stamp(minute: int, stoppage: "int | None") -> dict:
        return {"minute": minute, "stoppage_minute": stoppage}

    if slot < REGULATION_HALF:
        return stamp(slot + 1, None)
    if slot < second_half:
        return stamp(REGULATION_HALF, slot - (REGULATION_HALF - 1))
    regulation_end = slot_count - 1 if first_extra is None else first_extra - 1
    if slot <= regulation_end:
        offset = slot - second_half
        if offset < REGULATION_HALF:
            return stamp(REGULATION_HALF + 1 + offset, None)
        return stamp(2 * REGULATION_HALF, offset - (REGULATION_HALF - 1))
    if slot < second_extra:
        offset = slot - first_extra
        if offset < EXTRA_TIME_HALF:
            return stamp(2 * REGULATION_HALF + 1 + offset, None)
        return stamp(2 * REGULATION_HALF + EXTRA_TIME_HALF, offset - (EXTRA_TIME_HALF - 1))
    offset = slot - second_extra
    if offset < EXTRA_TIME_HALF:
        return stamp(2 * REGULATION_HALF + EXTRA_TIME_HALF + 1 + offset, None)
    return stamp(2 * (REGULATION_HALF + EXTRA_TIME_HALF), offset - (EXTRA_TIME_HALF - 1))


def _involvement_clock_block(
    page: "pymupdf.Page", grid: dict, slot_count: int, band_bottom: float, where: str,
    report_id: "str | None",
) -> dict:
    """One chart's staged clock block: the three boundaries plus one stamp per slot.

    The stamps are staged rather than left to be re-derived downstream for the reason
    momentum stages its samples' stamps: a derivation that lives only in code cannot be
    read back off the record, and Story 2.10 places this timeline on the match clock from
    the record alone.

    Every printed tick is then round-tripped through the staged stamps. That is NOT
    redundant with the assertions in `_involvement_clock`: those check tick positions
    against the derived boundaries, this checks the STAMPS the boundaries produce, so a
    fault in `_involvement_stamp` — the one piece of this reader nothing else constrains —
    surfaces here rather than as a wrong minute in the record.
    """
    ticks = _involvement_ticks(page, grid, band_bottom, where, report_id)
    structure = _involvement_clock(ticks, slot_count, where, report_id)
    stamps = [_involvement_stamp(slot, structure, slot_count) for slot in range(slot_count)]
    for label, slot in sorted(ticks.items()):
        if label == "0":  # the origin marker, not a minute label
            continue
        if label == HALF_TIME_TICK:
            expected = {"minute": REGULATION_HALF + 1, "stoppage_minute": None}
        elif _TICK_MINUTE_RE.match(label):
            expected = {"minute": int(label), "stoppage_minute": None}
        else:
            base, added = _TICK_STOPPAGE_RE.match(label).groups()
            expected = {"minute": int(base), "stoppage_minute": int(added)}
        if not 0 <= slot < slot_count:
            raise InvolvementClockError(
                f"{where} x-tick {label!r} lands on slot {slot}, outside the chart's "
                f"{slot_count} slots",
                report_id,
            )
        if stamps[slot] != expected:
            raise InvolvementClockError(
                f"{where} x-tick {label!r} lands on slot {slot}, which the derived clock "
                f"stamps {stamps[slot]}",
                report_id,
            )
    return {
        "second_half_slot": structure["second_half_slot"],
        "first_extra_slot": structure["first_extra_slot"],
        "second_extra_slot": structure["second_extra_slot"],
        "stamps": stamps,
    }


def _parse_involvement(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    home_team: str,
    away_team: str,
    report_id: "str | None",
) -> "dict[str, dict]":
    """Both teams' involvement timelines — ONE page carries both charts (104/104).

    Which chart belongs to which team is read from the printed chart TITLE
    (`'{team} GK Involvement Timeline'`) matched against this report's own cover metadata,
    never from the drawing order (AD-8) — the same discipline the momentum parser applies
    to its legend.
    """
    where = "goalkeeping involvement page"
    page = doc[_page_for(anchors, INVOLVEMENT_ANCHOR_ID, where, report_id)]
    rows = group_rows(text_spans(page))
    page_x1 = float(page.rect.x1)
    page_y1 = float(page.rect.y1)

    if home_team == away_team:
        raise GoalkeepingPageParseError(
            f"{where} cannot be split between two teams both named {home_team!r}", report_id
        )
    titles: "dict[str, int]" = {}
    for side, team in (("home", home_team), ("away", away_team)):
        index, _centre = _find_label(
            rows, f"{team} {INVOLVEMENT_TITLE_SUFFIX}", 0.0, page_x1, where, report_id
        )
        titles[side] = index
    if titles["home"] == titles["away"]:
        raise GoalkeepingPageParseError(
            f"{where} resolves both teams' chart titles to one row", report_id
        )

    ordered = sorted(titles.items(), key=lambda item: rows[item[1]].y)
    payload: "dict[str, dict]" = {}
    for position, (side, index) in enumerate(ordered):
        top = rows[index].y
        bottom = rows[ordered[position + 1][1]].y if position + 1 < len(ordered) else page_y1
        chart_where = f"{side} goalkeeping involvement chart"
        series, grid = _involvement_series(page, rows, (top, bottom), chart_where, report_id)
        clock = _involvement_clock_block(
            page, grid, len(series), bottom, chart_where, report_id
        )

        # BOTH the label lookup and the value walk run over this chart's own rows only.
        # `Total Involvements` is printed once per chart, so searching the whole page
        # would find two; and while the upward walk is already bounded to
        # `KPI_MAX_RISE_PT`, restricting it to the band makes "a chart's total comes from
        # that chart" structural rather than a consequence of the two charts happening to
        # sit ~220 pt apart.
        band_rows = [rows[i] for i, row in enumerate(rows) if top <= row.y < bottom]
        label_index, centre_x = _find_label(
            band_rows, TOTAL_INVOLVEMENTS_LABEL, 0.0, page_x1, chart_where, report_id
        )
        _row, raw = _value_above(
            band_rows, label_index, centre_x, 0.0, page_x1, "total_involvements",
            chart_where, report_id,
        )
        payload[side] = {
            "total_involvements": _parse_int(
                raw, f"{side}.goalkeeping.total_involvements", report_id
            ),
            "involvement_series": series,
            "involvement_clock": clock,
        }
    return payload


# --- the goalkeeper attribution (Task 4) ------------------------------------------------


GOALKEEPER_FIELDS: "tuple[str, ...]" = (
    "name",
    "shirt_number",
    "substituted_on",
    "substituted_off",
)


def _lineup_entries(lineups: dict, side: str, section: str, report_id: "str | None"):
    """One lineup section, with every key this reader needs asserted present.

    Bare subscripting into a SIBLING domain's payload is the failure mode this guards: a
    Domain A shape change would otherwise raise `KeyError`, which is neither an
    `ExtractError` nor a `PipelineError`, so it escapes both gate handlers and lands the
    same root cause under two check ids (`errors.py`'s "never raise a bare error for
    report data" rule). Typed here, it is one `MalformedFieldError` naming the key.
    """
    side_block = lineups.get(side)
    if not isinstance(side_block, dict) or section not in side_block:
        raise MalformedFieldError(
            f"Domain A lineups carry no {side!r}.{section!r} section for the goalkeeper "
            f"list; got keys {sorted(side_block) if isinstance(side_block, dict) else type(side_block).__name__}",
            report_id,
        )
    entries = side_block[section]
    for entry in entries:
        missing = [key for key in ("position", *GOALKEEPER_FIELDS) if key not in entry]
        if missing:
            raise MalformedFieldError(
                f"Domain A lineup entry in {side!r}.{section!r} is missing {missing}; the "
                "goalkeeper list cannot be built from it",
                report_id,
            )
    return entries


def _goalkeepers(lineups: dict, side: str, report_id: "str | None") -> "list[dict]":
    """The keeper(s) who took the field, from Domain A's lineups — context, never a key.

    `has_minutes` is Story 1.10's rule verbatim: a starter always took the field, a
    substitute did exactly when the lineup page stamped a sub-on minute on them. The list
    is NOT joined to any page data and no goalkeeper is inferred from it: no goalkeeping
    page names a keeper, and 7 of 208 corpus team-innings used two — so attributing a team
    block to "the" keeper would be plainly wrong on those and an unsupported inference on
    the other 201.
    """
    keepers: "list[dict]" = []
    for section in ("starters", "substitutes"):
        for entry in _lineup_entries(lineups, side, section, report_id):
            if entry["position"] != "gk":
                continue
            if section != "starters" and entry["substituted_on"] is None:
                continue
            keepers.append({key: entry[key] for key in GOALKEEPER_FIELDS})
    if not keepers:
        # 208/208 corpus team-innings field at least one. Deliberately NOT "exactly one":
        # that is corpus-false on 7 (M21, M41, M53, M62, M66, M88, M98).
        raise MissingFieldError(
            f"{side} lineup records no goalkeeper who took the field", report_id
        )
    return keepers


# --- the extractor ------------------------------------------------------------------


def extract_domain_e(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    lineups: "dict | None",
    report_id: "str | None" = None,
    *,
    home_team: str,
    away_team: str,
) -> dict:
    """Extract the Domain E payload for one report, PER TEAM (AC 1, AC 4).

    `lineups` is Domain A's already-parsed `match_metadata["lineups"]` block, handed in by
    the record seam (the Story 1.10 precedent) — the lineup page is never re-parsed here.
    It supplies the `goalkeepers` list only; no page data is joined to it.

    `lineups=None` means Domain A did not extract for this report. The four page families
    are read as normal and `goalkeepers` stages `None` plus a warning, because none of
    them needs a lineup: goal prevention, aerial control, distribution and involvement are
    all page-internal. Failing the whole domain on a sibling's failure would hide a
    genuinely broken goalkeeping page behind `domain-a-completeness`'s finding — Task 7.2
    says skip only the parts that need it and run the rest.

    `home_team` / `away_team` are this report's own cover names, and they are REQUIRED —
    a recorded departure from the story's stated signature, for the reason Task 3.10 makes
    unavoidable. The involvement page carries BOTH teams' charts and identifies them only
    by the printed title `'{team} GK Involvement Timeline'`, so without the cover names the
    home/away split could only be read from drawing order, which AD-8 forbids. Every
    sibling parser that faces the same problem takes the same two arguments
    (`parse_shots`, `parse_crosses`, `extract_momentum`). They are keyword-only and
    without defaults, so the requirement is in the signature rather than only at runtime.

    Pages are located through the already-resolved `anchors` map, never by page index
    (AD-8). Raises `GoalkeepingPageParseError`, `InvolvementChartError`,
    `InvolvementClockError`, `MalformedFieldError` or `MissingFieldError`, and lets the
    shared chain's
    `PitchFrameError` / `UnknownRgbError` travel as themselves (the 1.11/1.12 precedent);
    the batch turns each into a `failed` manifest entry for this report alone. The payload
    is all-or-nothing: no partial goalkeeping block ever stages.
    """
    if not home_team or not away_team:
        raise GoalkeepingPageParseError(
            "extract_domain_e needs this report's cover team names: the involvement page "
            "carries both charts and identifies them only by their printed titles",
            report_id,
        )
    involvement = _parse_involvement(doc, anchors, home_team, away_team, report_id)
    payload: dict = {}
    for side in ("home", "away"):
        payload[side] = {
            "goalkeepers": (
                None if lineups is None else _goalkeepers(lineups, side, report_id)
            ),
            "total_involvements": involvement[side]["total_involvements"],
            "involvement_series": involvement[side]["involvement_series"],
            "involvement_clock": involvement[side]["involvement_clock"],
            "distribution": _parse_distribution(doc, anchors, side, report_id),
            "goal_prevention": _parse_goal_prevention(doc, anchors, side, report_id),
            "aerial_control": _parse_aerial_control(doc, anchors, side, report_id),
        }
    return payload


# --- AC 4 documented absences -----------------------------------------------------------

DOCUMENTED_ABSENCES: "tuple[tuple[str, str], ...]" = (
    (
        "goalkeeping.distribution.*_techniques",
        "the Kick from Feet / Kick from Hands / Throw distribution technique breakdowns "
        "are printed only as donut SLICE labels inside raster images; only the centre "
        "total is in the text layer",
    ),
    (
        "goalkeeping.goal_prevention.by_body_type",
        "the Intervention Body Type breakdown is raster-only, and this page's text-layer "
        "donut centres are demonstrably untrustworthy (PMSR-M01 prints 4 against a table "
        "of 3), so neither is staged",
    ),
    (
        "goalkeeping.aerial_control.crosses_faced_completed",
        "the completed/attempted split is drawn only as marker colour on a goal-mouth "
        "crop, not a full pitch, and the page prints no counterpart to validate a count "
        "against",
    ),
)


def domain_e_warnings() -> "list[str]":
    """The three documented-absence warnings, one per report (AC 4).

    Warnings, never checks: the Self-Validation aggregator treats anything but the literal
    `"pass"` as a failure, so a non-`pass` check would turn a merely incomplete report into
    a failing one (the Story 1.12 / 1.13 branch).
    """
    return [f"goalkeeping: {field} is not extractable — {reason}" for field, reason in DOCUMENTED_ABSENCES]


def domain_e_goalkeeper_warnings(payload: dict) -> "list[str]":
    """The per-report warning for a team block staged with no goalkeeper list.

    Empty on every report where Domain A extracted, which is the whole corpus. It fires
    only on the `lineups=None` path, so the absence is recorded rather than inferred from
    a `null` in the payload — the same documented-absence discipline as AC 4's three,
    except that this one is conditional on a sibling domain rather than on the source page.
    """
    return [
        f"goalkeeping: {side} goalkeepers is not staged — Domain A's lineups did not "
        "extract for this report, so the keeper(s) who took the field cannot be recorded "
        "beside the team block"
        for side in ("home", "away")
        if payload[side]["goalkeepers"] is None
    ]


# --- Self-Validation checks (SM-C1: binary, within-report, never loosened) ------------
#
# Every relation below was measured EXACT on all 208 corpus team-innings at story creation
# and reproduced by this parser's own sweep. The tempting relations the corpus REFUTES are
# named at their call sites rather than left as silence.

_check = check_entry
_bounded = bounded_check


def domain_e_checks(payload: dict) -> "list[dict]":
    """Domain E's self-validation checks over an extracted payload (AC 1).

    Recorded, never raised. Exactly one dict per check id covers BOTH sides, with
    `specifics` naming every offending side in a deterministic order, so re-runs are
    byte-identical.
    """
    checks: list[dict] = []

    # AC 1's named check: the Total Distributions panel is drawn as the union of the other
    # three, EXACT on 208/208.
    sum_notes: list[str] = []
    printed_notes: list[str] = []
    printed_deltas: list[str] = []
    printed_gaps: list[int] = []
    for side in ("home", "away"):
        distribution = payload[side]["distribution"]
        parts = sum(distribution[key]["total"] for key in DISTRIBUTION_PRINTED_PANELS)
        if parts != distribution["total"]["total"]:
            sum_notes.append(
                f"{side}: feet {distribution['feet']['total']} + hands "
                f"{distribution['hands']['total']} + throw {distribution['throw']['total']} "
                f"= {parts}, total panel {distribution['total']['total']}"
            )
        for key in DISTRIBUTION_PRINTED_PANELS:
            block = distribution[key]
            drawn, printed = block["total"], block["printed_total"]
            printed_deltas.append(f"{side} {key}: {drawn}/{printed}")
            printed_gaps.append(abs(drawn - printed))
            if drawn < printed:
                printed_notes.append(
                    f"{side} {key}: {drawn} markers drawn, page prints {printed}"
                )
            elif drawn - printed > DISTRIBUTION_PRINTED_MAX_OVERSHOOT:
                printed_notes.append(
                    f"{side} {key}: {drawn} markers drawn against a printed "
                    f"{printed}, an overshoot of {drawn - printed} past the corpus "
                    f"maximum of {DISTRIBUTION_PRINTED_MAX_OVERSHOOT}"
                )
    checks.append(
        _check(
            "goalkeeping-distribution-sum",
            not sum_notes,
            "; ".join(sum_notes)
            if sum_notes
            else "distribution category counts sum to the total distributions panel",
        )
    )
    # The genuine two-source cross-check — drawn markers against the printed donut centre,
    # and the strongest available signal that panel -> category mapping did not slip.
    #
    # A BOUND, not an equality, and the difference was earned on the corpus rather than
    # assumed. Over all 208 team-innings x 3 printed panels: `drawn >= printed` is TRUE on
    # 624/624, and equality holds on 604/624. The 20 residuals are ALL in the `feet` panel
    # (+1 on 18, +2 on 2) while `hands` and `throw` are exact on 208/208 each; no geometric
    # cause survived investigation — the Total Distributions panel is the EXACT union of the
    # other three on every case examined, so the drawn set is self-consistent and the map
    # simply plots more feet distributions than the technique donut counts. Shipping the
    # equality would fail 20 innings for a relation the source does not hold to, which is
    # the inversion SM-C1 forbids in the other direction.
    #
    # TWO-SIDED, ruled in the 1.9 code review. A one-sided `drawn < printed` failure left
    # the overshoot unbounded, and `pitch_margin_pt` 0.0 -> 0.5 can only push counts UP:
    # between them, nothing shipped could detect the margin admitting a non-marker
    # (`goalkeeping-distribution-sum` is blind to it too, because the Total panel is the
    # union and absorbs the same extras). A mapping slip assigning the `total` panel's
    # markers to `feet` reads 33 against a printed 30 and used to pass outright. The
    # corpus bounds the honest overshoot at 2, so the check is now `0 <= drawn - printed
    # <= 2` — still binary, still true on 624/624, and it constrains the direction the
    # widened margin opened. The per-panel delta is recorded in `specifics` on EVERY
    # report, passing or failing, so the residual gap stays visible rather than absorbed.
    checks.append(
        _bounded(
            "goalkeeping-distribution-printed",
            not printed_notes,
            (
                ("; ".join(printed_notes) + " | ") if printed_notes else
                "every panel's marker count covers its printed donut centre without "
                f"overshooting it by more than {DISTRIBUTION_PRINTED_MAX_OVERSHOOT} — "
            )
            + "; ".join(printed_deltas),
            # The residual the `>=` bound tolerates, now machine-readable so the batch
            # summary can aggregate it (Story 1.19 R2). Corpus-wide: non-zero on 20 of 624
            # side/panel pairs, all in `feet`, +1 on 18 and +2 on 2.
            max(printed_gaps, default=0),
        )
    )

    prevention_notes: list[str] = []
    for side in ("home", "away"):
        block = payload[side]["goal_prevention"]
        types = sum(block["by_intervention_type"].values())
        if types != block["attempts_faced"]:
            prevention_notes.append(
                f"{side}: intervention types sum to {types}, attempts faced "
                f"{block['attempts_faced']}"
            )
        if block["attempts_faced_printed"] != block["attempts_faced"]:
            prevention_notes.append(
                f"{side}: KPI tile prints {block['attempts_faced_printed']} attempts "
                f"faced, the table prints {block['attempts_faced']}"
            )
        # NOT checked, and both were measured before being rejected: `sum(5 intervention
        # types) == total_interventions` is corpus-FALSE on 207/208 (the two breakdowns
        # have different denominators, as the contract's own note says), and
        # `total_interventions == attempts_faced - no_save_attempt` on 183/208.
    checks.append(
        _check(
            "goalkeeping-goal-prevention-sum",
            not prevention_notes,
            "; ".join(prevention_notes)
            if prevention_notes
            else "intervention types sum to attempts faced, and the KPI tile agrees with "
            "the table",
        )
    )

    aerial_notes: list[str] = []
    for side in ("home", "away"):
        delivery = payload[side]["aerial_control"]["delivery_types_faced"]
        types = sum(delivery[key] for key in AERIAL_DELIVERY_TYPES)
        if types != delivery["total"]:
            aerial_notes.append(
                f"{side}: delivery types sum to {types}, printed total {delivery['total']}"
            )
    checks.append(
        _check(
            "goalkeeping-aerial-sum",
            not aerial_notes,
            "; ".join(aerial_notes)
            if aerial_notes
            else "the six delivery types faced sum to the printed total",
        )
    )

    # A BOUND, not an equality, and the difference is the point: `sum(series) ==
    # total_involvements` is corpus-FALSE on 149/208, while `<=` is TRUE on 208/208 (the
    # delta is 0..5, never negative, mean 1.26). Manufacturing the equality would be
    # exactly the fake reconciliation Stories 1.8 and 1.12 refused; the observed delta is
    # recorded in `specifics` on EVERY report, passing or not — including the side that
    # passed on a report where the other side failed, which the original ternary dropped.
    involvement_notes: list[str] = []
    deltas: list[str] = []
    gaps: list[int] = []
    for side in ("home", "away"):
        block = payload[side]
        drawn = sum(block["involvement_series"])
        printed = block["total_involvements"]
        deltas.append(f"{side}: {drawn}/{printed} (delta {printed - drawn})")
        gaps.append(abs(printed - drawn))
        if drawn > printed:
            involvement_notes.append(
                f"{side}: series sums to {drawn}, above the printed total {printed}"
            )
    checks.append(
        _bounded(
            "goalkeeping-involvement-bound",
            not involvement_notes,
            (
                ("; ".join(involvement_notes) + " | ")
                if involvement_notes
                else "series sum within the printed total — "
            )
            + "; ".join(deltas),
            # Corpus-wide the delta runs 0..5 with mean 1.26 and is non-zero on 149 of 208
            # team-innings; `sum(series) == total_involvements` is corpus-FALSE (Story 1.19 R2).
            max(gaps, default=0),
        )
    )

    # The staged slot -> match-clock mapping, recorded (Decision 3). This is a BACKSTOP,
    # not a cross-check, and the distinction matters as much as it does for momentum's
    # `momentum-coverage`: every clock inconsistency it could describe is already a typed
    # `InvolvementClockError` — the tick grammar, the boundary unanimity, the period order,
    # the stoppage bounds and the tick-to-stamp round trip all abort the report before a
    # clock is staged at all. What remains worth recording is corruption of the staged
    # block between parse and record, and the two per-period observations below, which are
    # NOT part of the predicate:
    #
    #   * the derived stoppage allotments, so the numbers this parser inferred stay visible
    #     rather than being absorbed into a bare "pass";
    #   * a period drawn SHORTER than its regular length. True of no period on 206 of 208
    #     corpus charts, and of `PMSR-M88-AUS-V-EGY`'s first extra period on BOTH of its own
    #     charts (206 + 2 = 208), which print 14 slots and no 105' tick — the page is
    #     self-consistent and says minute 105 has no slot. Making that a failure would
    #     assert football over the source and would move the ruled batch baseline; it is
    #     recorded and ledgered. That tolerance is applied to EVERY period, not just ET1:
    #     the predicate below asks whether the series ends inside its final PERIOD, never
    #     whether it reaches that period's regular last minute. An earlier form compared
    #     against minute 120 exactly, which failed a short ET2 while passing the short ET1
    #     this comment exists to permit — the same page shape judged two ways.
    clock_notes: list[str] = []
    clock_facts: list[str] = []
    for side in ("home", "away"):
        block = payload[side]
        clock = block["involvement_clock"]
        stamps = clock["stamps"]
        series = block["involvement_series"]
        second_half = clock["second_half_slot"]
        first_extra = clock["first_extra_slot"]
        second_extra = clock["second_extra_slot"]

        # Shape first, and every later clause behind it. This check reads a STAGED record
        # rather than a freshly parsed one, so it cannot assume the parser's invariants
        # still hold — and an `IndexError` or a `None` comparison escaping here would leave
        # `domain_e_checks` raising a non-`PipelineError` that neither gate handler is
        # written for, turning a recordable failure into a crash.
        if not stamps:
            clock_notes.append(f"{side}: no clock stamps staged")
            clock_facts.append(f"{side}: 0 slots, no clock")
            continue
        if len(stamps) != len(series):
            clock_notes.append(
                f"{side}: {len(stamps)} clock stamps against {len(series)} plotted slots"
            )
        if (first_extra is None) != (second_extra is None):
            clock_notes.append(
                f"{side}: extra-time boundaries staged inconsistently "
                f"(first {first_extra}, second {second_extra})"
            )
            clock_facts.append(f"{side}: {len(stamps)} slots, extra-time boundaries broken")
            continue

        if stamps[0] != {"minute": 1, "stoppage_minute": None}:
            clock_notes.append(f"{side}: series opens at {_format_stamp(stamps[0])}, not kick-off")
        previous: "tuple[int, int] | None" = None
        for stamp in stamps:
            key = (stamp["minute"], stamp["stoppage_minute"] or 0)
            if previous is not None and key <= previous:
                clock_notes.append(
                    f"{side}: clock does not advance at {_format_stamp(stamp)}"
                )
                break
            previous = key

        # The three staged boundary fields, reconciled against the staged stamps. Without
        # this the check reads `stamps` alone and the boundaries ride along unexamined —
        # so a block whose `second_half_slot` no longer agrees with its own stamps passes
        # while `specifics` reports period lengths derived from the wrong number. Since
        # corruption of the staged block is the one thing this backstop is FOR, the fields
        # it does not read are the ones it most needs to.
        for name, slot, minute in (
            ("second_half_slot", second_half, REGULATION_HALF + 1),
            ("first_extra_slot", first_extra, 2 * REGULATION_HALF + 1),
            ("second_extra_slot", second_extra, 2 * REGULATION_HALF + EXTRA_TIME_HALF + 1),
        ):
            if slot is None:
                continue
            if not 0 <= slot < len(stamps):
                clock_notes.append(
                    f"{side}: {name} is slot {slot}, outside the {len(stamps)} staged stamps"
                )
            elif stamps[slot] != {"minute": minute, "stoppage_minute": None}:
                clock_notes.append(
                    f"{side}: {name} is slot {slot}, which the staged stamps put at "
                    f"{_format_stamp(stamps[slot])} rather than {minute}'"
                )

        # The series must END inside its final period — not AT that period's regular last
        # minute, which is what a short period legitimately falls short of.
        if first_extra is None:
            final_first, final_last = REGULATION_HALF + 1, 2 * REGULATION_HALF
        else:
            final_first = 2 * REGULATION_HALF + EXTRA_TIME_HALF + 1
            final_last = 2 * (REGULATION_HALF + EXTRA_TIME_HALF)
        if not final_first <= stamps[-1]["minute"] <= final_last:
            clock_notes.append(
                f"{side}: series ends at {_format_stamp(stamps[-1])}, outside the closing "
                f"{final_first}'-{final_last}' period"
            )
        clock_facts.append(
            f"{side}: {len(stamps)} slots, {_format_stamp(stamps[0])}"
            f"..{_format_stamp(stamps[-1])}, "
            + ", ".join(_period_notes(clock, len(stamps)))
        )
    checks.append(
        _check(
            "goalkeeping-involvement-clock",
            not clock_notes,
            " | ".join(part for part in ("; ".join(clock_notes), "; ".join(clock_facts)) if part),
        )
    )

    return checks


def _format_stamp(stamp: dict) -> str:
    """A clock stamp for check specifics only — never for the record (AD-7)."""
    if stamp["stoppage_minute"]:
        return f"{stamp['minute']}+{stamp['stoppage_minute']}"
    return str(stamp["minute"])


def _period_notes(clock: dict, slot_count: int) -> "list[str]":
    """Each derived period's stoppage allotment, and any period drawn short.

    Reported in `specifics` on every report, passing or not — see the check above for why
    a short period is recorded rather than failed.

    The four period rows are not equally reachable, and saying so is the point. On a
    freshly parsed chart only ET1 and ET2 can be short: `_assert_clock_bounds` raises
    before staging if either regulation half is drawn under its 45 slots, so `H1 drawn
    SHORT` and `H2 drawn SHORT` cannot describe a parsed report. They are retained because
    this runs over a STAGED record, where the boundaries may no longer agree with the
    stamps — exactly the corruption the check reconciles for — and a period row that
    silently reported `H1 +0` on a broken block would hide it.
    """
    second_half = clock["second_half_slot"]
    first_extra = clock["first_extra_slot"]
    second_extra = clock["second_extra_slot"]
    regulation_end = slot_count - 1 if first_extra is None else first_extra - 1
    periods = [
        ("H1", REGULATION_HALF, second_half),
        ("H2", REGULATION_HALF, regulation_end + 1 - second_half),
    ]
    if first_extra is not None:
        periods.append(("ET1", EXTRA_TIME_HALF, second_extra - first_extra))
        periods.append(("ET2", EXTRA_TIME_HALF, slot_count - second_extra))
    notes: "list[str]" = []
    for name, regular, drawn in periods:
        if drawn < regular:
            notes.append(f"{name} drawn SHORT at {drawn}/{regular} slots")
        else:
            notes.append(f"{name} +{drawn - regular}")
    return notes

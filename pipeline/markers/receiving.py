"""Offers & movement to receive: the receiving page family (Story 1.13).

**This page family draws no markers, so this module stages VALUES, not events.** Neither
`Offering to Receive {team}` nor `Movement to Receive {team}` is a marker-scatter pitch
map — both are dashboards. The Task 1 corpus probe (all 104 reports / 416 receiving
pages) found no coordinate, no per-event row and no ordinal glyph anywhere in either
family, so no `ReceivingEvent` row is producible here and none is fabricated. That gap is
filed as an AD-14 emission blocker for Story 1.16 (`events.receiving` can only be
`null`); do not read this module expecting a scatter parser and go looking for the bug.

It nonetheless lives in `pipeline/markers/` beside `shots.py` / `crosses.py` /
`defensive_actions.py` rather than in `pipeline/extract/`: this is Domain D (spatial
events) by page family, Story 1.16 will consume it beside `events.crosses`, and it
composes the shared filter chain (below).

`team_id` is **the RECEIVING player's team** (`contract/match-bundle.schema.json`'s
`ReceivingEvent` `$comment`; acting-team table at `contract/README.md:90`), and on both
page families that is simply the team the anchor names: each page totals that team's own
offers and movements. The call is mechanically the same `team_slug(team_name)` the
shots, crosses and defensive-actions parsers make, but semantically the opposite end of
the event — do NOT re-derive it as the "crossing/shooting team" pattern.

The layout, re-measured on all 104 reports / 416 pages (Task 1 probe):

`Offering to Receive {team}` — 208/208 pages, landscape 960 x 540, exactly one page per
team:

- **4 qualifying stroked rects, 2 distinct panels.** Both are 52,704 pt^2 white-stroked
  (2.744 pt) frames — `Rect(234.0, 222.75, 426.0, 497.25)` and
  `Rect(450.0, 222.75, 642.0, 497.25)` — and the right panel additionally carries TWO
  stroke+fill rects of bit-identical geometry (the raster shape overlay's border). The
  de-duplication is per-family tuning inside this parser: `detect_pitch_frames` is
  correct as written and returns every qualifying rect, which is what a multi-panel page
  needs (Story 1.12).
- Each panel is typed from **its own printed title** (`Offers Made Inside Shape` /
  `Offers Made Outside Shape`, printed in a band just above its frame and inside its
  x-span), never by x order — AD-8, the `defensive_actions._panel_title` precedent. The
  two shape badges are then read as the unique digit word inside each typed panel, so
  which badge is "inside" and which "outside" is text-anchored end to end.
- **Each panel holds exactly 11 filled 8.229 pt circles, fill (0.18, 0.30, 1.00)**, and
  their positions relative to their own panel are identical between the two panels on
  208/208 pages and identical across every team page. They are a static formation
  template carrying zero per-report information — see `_assert_decoration_census` for
  why the chain runs over them and stages nothing.
- Also inside the panels: white penalty spots (1.371 pt) and centre spots (2.743 pt),
  filled all-Bezier circles that only `marker_min_pt` excludes. Admitting either would
  abort every report in the corpus on a white fill.
- Real payload: five label-anchored KPI values, the two in-panel badges, a Most Offers
  block (value / player / position) and a per-player table with 13-17 rows.

`Movement to Receive {team}` — 208/208 pages, exactly one page per team:

- **Exactly 1 qualifying stroked rect**, `Rect(675.0, 129.0, 936.0, 502.5)` titled
  `Movement Types Pitch Third`, holding **zero markers**: it is a pitch split into three
  thirds, each carrying a five-row horizontal bar chart. The chain's marker stages are
  therefore not run here (there is nothing to key); the panel is detected because every
  value read inside it is bounded by that frame.
- Rotated `FINAL THIRD` / `MIDDLE THIRD` / `DEFENSIVE THIRD` labels assign each grid row
  its third (text-anchored, never "top band = final third"), and the panel's own rotated
  `DIRECTION` label is asserted first — the page's own statement of which way it is
  drawn, and what licenses reading the thirds off it at all.
- **13-21 raster images per page.** The three phase donuts and the All-Movement-Types
  donut are images and **their slice values are inside the images**: only the four centre
  totals are text. Each donut is located by its own printed title and read as the unique
  digit word inside the titled image rect.
- The only 9.0 pt filled circles on the page are the five legend swatches, outside the
  panel.

`exclude_legend_rows` is a no-op by construction on the offers panels (the decoration is
a single fill, so no y-bucket ever reaches `legend_min_colors`) and is kept in the
production path anyway: the recipe is the recipe (Story 1.5's review restored it after an
inlined copy went dead), and a future panel that grows a real multi-colour legend must
meet the same chain every other family meets.

Pure: no I/O beyond the open `pymupdf.Document`. Story 1.13 Tasks 2-3.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from pipeline.ingest.identity import team_slug
from pipeline.markers.attempts import table_lines
from pipeline.markers.errors import (
    ReceivingPageLayoutError,
    ReceivingTableError,
    UnknownLabelError,
)
from pipeline.markers.filter_chain import (
    MarkerSpec,
    collect_candidate_markers,
    detect_pitch_frames,
    exclude_legend_rows,
    key_outcomes,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# The one fill the offers panels' decoration carries, corpus-wide (4,576 circles over 208
# pages, Task 1 census). A degenerate one-entry palette whose only job is the
# assert-on-unknown seam (FR-11): nothing is staged from the lookup, and the internal key
# names what the shape actually is rather than pretending it is an outcome.
RECEIVING_DECORATION_RGB_TO_OUTCOME: dict[tuple[float, float, float], str] = {
    (0.18, 0.30, 1.00): "formation-template-dot",
}

# Decoration circles measure 8.229 x 8.235 pt on every corpus page. The lower bound
# excludes the in-panel white 2.743 pt centre spot and 1.371 pt penalty spots — filled
# all-Bezier circles that would otherwise reach `key_outcomes` and abort all 104 reports
# on a white fill. The upper bound sits below the 9.0 pt circles the sibling movement
# page draws as legend swatches. Strict containment (`pitch_margin_pt` 0.0): the template
# is drawn well inside its frame, so no margin is warranted or needed.
RECEIVING_SHAPE_SPEC = MarkerSpec(
    marker_min_pt=8.0,
    marker_max_pt=8.5,
    rgb_to_outcome=RECEIVING_DECORATION_RGB_TO_OUTCOME,
)

# The corpus-invariant decoration census, asserted per panel (see
# `_assert_decoration_census`).
OFFERS_DECORATION_DOTS_PER_PANEL = 11

# Printed offers panel title -> the staging key its badge lands under. Frozen literals,
# text-anchored typing: a renamed or re-ordered panel can never be silently typed as the
# family that happens to sit in that position (AD-8).
OFFERS_PANEL_TITLE_TO_KEY: dict[str, str] = {
    "Offers Made Inside Shape": "offers_inside_shape",
    "Offers Made Outside Shape": "offers_outside_shape",
}

# Staging key -> the label printed BELOW its value, centred on the same x. Every KPI is
# read as the integer above its own label (the `defensive_actions._headline_value`
# pattern), never by absolute position.
#
# `Offers Made in Defensive Third` wraps onto two printed lines on 208/208 pages, so its
# anchor is the FIRST line only — "Third" is deliberately not part of the token sequence.
OFFERS_KPI_LABELS: dict[str, str] = {
    "total_offers_made": "Total Offers Made",
    "total_offers_received": "Total Offers Received",
    "offers_final_third": "Offers Made in Final Third",
    "offers_middle_third": "Offers Made in Middle Third",
    "offers_defensive_third": "Offers Made in Defensive",
}

MOST_OFFERS_LABEL = "Most Offers"

MOVEMENT_PANEL_TITLE = "Movement Types Pitch Third"

# Printed movement-type label -> the contract's `OfferMovementType` kebab code
# (`contract/common.schema.json`). Frozen literals, never schema imports (the
# `CROSS_DELIVERY_LABEL_TO_ENUM` precedent); `test_markers_receiving` cross-checks every
# value against the contract JSON.
#
# The contract's sixth value, `no-movement`, is deliberately ABSENT: this page prints
# exactly five types, and reconciliation #8 proves what the grid counts — the grid's
# per-type totals equal Domain G's FIVE-type sum on 208/208 pages and never its six-type
# sum. `no-movement` exists only per player, on Domain G's Offers & Receptions page. The
# asymmetry is real; do not "complete" this map.
MOVEMENT_LABEL_TO_ENUM: dict[str, str] = {
    "In Front": "in-front",
    "In Between": "in-between",
    "Out to In": "out-to-in",
    "In to Out": "in-to-out",
    "In Behind": "in-behind",
}

# The rotated in-panel labels that assign each grid row its third. No contract enum
# covers pitch thirds, so these kebab codes are this pipeline's own (recorded in the
# Task 7.2 shape note); they are staged as VALUES, never as record keys.
PITCH_THIRD_LABEL_TO_ENUM: dict[str, str] = {
    "FINAL THIRD": "final-third",
    "MIDDLE THIRD": "middle-third",
    "DEFENSIVE THIRD": "defensive-third",
}

# Printed donut title -> the staging key its centre total lands under. The three phase
# donuts stage under `by_phase`; `all_movement_types` is `total_movements`.
MOVEMENT_DONUT_TITLES: dict[str, str] = {
    "Final Third Phase": "final_third",
    "Progression Phase": "progression",
    "Build Up Phase": "build_up",
    "All Movement Types": "all_movement_types",
}
MOVEMENT_PHASE_KEYS = ("final_third", "progression", "build_up")

# Each panel and donut prints its title in a band just above its own top edge and inside
# its x-span — the geometry that makes title -> region typing text-anchored. Measured
# clearances: offers panels 15.9 pt, the movement panel 18.9 pt, the phase donuts 12.8 pt
# and the All-Movement donut 15.9 pt; the 25 pt window absorbs a font-metric change while
# still clearing the next structure above (42.8 pt away at the tightest, the
# `Movement Types by Phase` section header).
_TITLE_BAND_PT = 25.0
_TITLE_X_MARGIN_PT = 2.0

# Words on one visual line share y0 to well under a point. 3 pt mirrors `table_lines`
# (and the cover parser's line tolerance) so a run matched here and a row clustered there
# agree about what "one line" means.
_WORD_LINE_TOLERANCE_PT = 3.0

# The KPI value sits 40 pt above its label on 208/208 pages. Four of the five labels are
# centred on their value exactly (0 pt measured); the fifth is `Offers Made in Defensive
# Third`, whose anchor is only its FIRST printed line, so the run's centre sits 11 pt off
# — hence a window well above that rather than the 6 pt the single-line families use.
# Candidates are unrestricted in x by necessity (the KPI columns are not at fixed
# positions) and the two columns are ~215 pt apart, so 15 pt cannot reach the neighbour;
# the column match must still be unambiguous rather than merely nearest, and
# `_labelled_value` raises when two values sit inside the window.
_KPI_MIN_DY_PT = 15.0
_KPI_MAX_DY_PT = 80.0
_KPI_X_TOLERANCE_PT = 15.0

# The movement grid's value sits on its label's own line, but the corpus prints the
# `In to Out` value up to 3.02 pt below its label — just over `table_lines`' 3 pt
# clustering tolerance, which is why the grid is read label-anchored rather than by
# visual row. 5 pt admits that offset with room to spare while staying under half the
# 11.98 pt minimum row pitch, so a neighbouring row's value can never be captured.
_GRID_VALUE_DY_PT = 5.0

# Both tables' regions start at their own header's leftmost column word rather than at a
# hardcoded x. The margin mirrors `crosses.py` / `defensive_actions.py`.
_TABLE_X_MARGIN_PT = 10.0
# The offers table's stacked header ("Offers Made" / "Offers Received" /
# "% Made & Received") occupies ~9 pt above and below the '#'+'Player' line.
_TABLE_HEADER_BAND_PT = 12.0
# Name words may straddle the numeric row line: four corpus pages print a three-line
# name, its halves 4.5 pt above and below the numbers. 6 pt admits both while staying
# well under the 24.75 pt row pitch.
_NAME_Y_TOLERANCE_PT = 6.0
_NAME_X_MARGIN_PT = 5.0

# The decoration signature is compared at 3 decimals: the positions are derived from the
# panel rects by subtraction, so they agree exactly between panels up to float noise.
_DECORATION_DECIMALS = 3

# The panel's own rotated `DIRECTION` label is what licenses reading the three pitch
# thirds off it: AD-6's orientation is a statement about how the panel is drawn, not a
# measurement, and a re-oriented panel would silently swap the final and defensive
# thirds of every grid row. The vector is computed from the text matrix, so it carries
# float noise (the corpus prints 6.1e-17 for the x component, not a clean 0.0).
_DIRECTION_LABEL = "DIRECTION"
_DIRECTION_VECTOR = (0.0, -1.0)
_DIRECTION_TOLERANCE = 1e-6

# `re.ASCII` on every digit class: fullwidth digits otherwise satisfy `\d` and `int()`
# accepts them happily.
_DIGITS_RE = re.compile(r"\d+", re.ASCII)
# The offers table's third numeric column is a PERCENTAGE and prints without a trailing
# ".0" (`30.8%`, but `50%` and `32%`), so it will never match a bare digit run and must
# be parsed explicitly rather than left to fall through a `\d+` filter.
_PERCENT_RE = re.compile(r"(\d+(?:\.\d+)?)%", re.ASCII)

# The two documented absences (AC 2). Both are real, both are recorded as an explicit
# `None` counterpart in `counts` plus ONE per-report warning, and NEITHER emits a check:
# `aggregate_self_validation` is strictly binary and treats anything but a literal
# "pass" as a failure, so a "not-applicable" check would fail every record in the corpus.
DONUT_SLICES_ABSENT_WARNING = (
    "receiving: no per-type check recorded for the movement donuts (their slice values "
    "are inside the raster images; only the four centre totals are text)"
)
PHASE_PARTITION_ABSENT_WARNING = (
    "receiving: no phase-sum check recorded for movement by-phase totals (they are "
    "independent totals, not a partition of the movement total)"
)


def parse_offers(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: str,
    home_team: str,
    away_team: str,
) -> dict:
    """Extract both teams' `Offering to Receive` block from an open report.

    `anchors` is the record's anchor map (0-based page indices). Each team's
    `offers:{side}` anchor must resolve to exactly one page (208/208 corpus pages);
    anything else raises `ReceivingPageLayoutError`. Raises `PitchFrameError`,
    `UnknownRgbError` (FR-11), `UnknownLabelError` (an unmapped panel title),
    `ReceivingPageLayoutError` and `ReceivingTableError`, all typed and report-scoped. A
    reconciliation mismatch is NOT an exception — it lands in `counts` for
    `receiving_self_validation_block` to judge.
    """
    offers: dict[str, dict] = {}
    counts: dict[str, dict] = {}
    for side, team_name in (("home", home_team), ("away", away_team)):
        anchor_id = f"offers:{side}"
        page_index = _single_anchor_page(anchors, anchor_id, report_id)
        block = _parse_offers_page(
            doc[page_index],
            team_slug(team_name),
            anchor_id,
            anchors[anchor_id],
            report_id,
            page_index,
        )
        offers[side] = block
        counts[side] = _offers_counts(block)
    return {"offers": offers, "counts": counts}


def parse_movement(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: str,
    home_team: str,
    away_team: str,
) -> dict:
    """Extract both teams' `Movement to Receive` block from an open report.

    Same page/anchor contract and the same typed-error vocabulary as `parse_offers`.
    Stages the two documented absences as `None` counterparts in `counts` plus one
    warning each per REPORT (not per side): the absence is a property of the page family,
    and `batch.py` mirrors record warnings into the manifest entry.
    """
    movement: dict[str, dict] = {}
    counts: dict[str, dict] = {}
    for side, team_name in (("home", home_team), ("away", away_team)):
        anchor_id = f"movement:{side}"
        page_index = _single_anchor_page(anchors, anchor_id, report_id)
        block = _parse_movement_page(
            doc[page_index],
            team_slug(team_name),
            anchor_id,
            anchors[anchor_id],
            report_id,
            page_index,
        )
        movement[side] = block
        counts[side] = _movement_counts(block)
    return {
        "movement": movement,
        "counts": counts,
        "warnings": [DONUT_SLICES_ABSENT_WARNING, PHASE_PARTITION_ABSENT_WARNING],
    }


def receiving_domain(offers: dict, movement: dict) -> dict:
    """The record's `domains["receiving"]` block, assembled from the two parsers.

    Kept here rather than at the extract seam so the two families' payloads and their
    `counts` can never be stitched together two different ways.
    """
    return {
        "offers": offers["offers"],
        "movement": movement["movement"],
        "counts": {
            side: {"offers": offers["counts"][side], "movement": movement["counts"][side]}
            for side in ("home", "away")
        },
    }


# --------------------------------------------------------------------- self-validation


def receiving_self_validation_block(
    counts: "dict[str, dict[str, dict]]", player_stats: "dict | None" = None
) -> list[dict]:
    """The record's receiving checks: five page-internal ids, plus two cross-domain.

    Every check is binary and exact with BOTH operands always recorded — no tolerance,
    never loosened (FR-14, SM-C1, AD-8). All nine measured reconciliations are exact on
    208/208 pages (3,208/3,208 rows for the percentage), so a tolerance would only hide a
    real template revision.

    `player_stats` is Domain G's payload, handed in at the extract seam (the Story 1.7
    `shots_counts` / Story 1.10 `domain_g_checks` precedent) so this module stays
    single-source and off `pipeline/extract/`. When it is unavailable, the two
    cross-domain check families emit NOTHING rather than a failing check: one root cause,
    one finding (the `checks.py::_check_domain_g_counts` Domain-B-unavailable precedent).

    No check is emitted for either documented absence — see
    `DONUT_SLICES_ABSENT_WARNING` / `PHASE_PARTITION_ABSENT_WARNING`.
    """
    checks: list[dict] = []
    for side in ("home", "away"):
        offers = counts[side]["offers"]
        movement = counts[side]["movement"]
        total_made = offers["total_offers_made"]

        checks.append(
            _count_check(
                "receiving-offers-thirds-sum", side, offers["thirds_sum"], total_made
            )
        )
        checks.append(
            _count_check(
                "receiving-offers-shape-sum", side, offers["shape_sum"], total_made
            )
        )
        # Two checks, one operand pair each: a merged made+received check could not say
        # which column disagreed.
        checks.append(
            _count_check(
                "receiving-offers-table-sum",
                side,
                offers["table_made_sum"],
                total_made,
                column="offers_made",
            )
        )
        checks.append(
            _count_check(
                "receiving-offers-table-sum",
                side,
                offers["table_received_sum"],
                offers["total_offers_received"],
                column="offers_received",
            )
        )
        checks.append(
            _count_check(
                "receiving-movement-grid-total",
                side,
                movement["grid_sum"],
                movement["total_movements"],
            )
        )
        # Exact at printed precision: the worst corpus deviation is 0.0 pp over
        # 3,208 rows, so no tolerance is warranted. Rows printing `offers_made == 0`
        # (81 corpus rows) have an undefined ratio and are skipped — never coerced to
        # 0.0, which would invent a value — and the skip count is an operand.
        checks.append(
            {
                "check": "receiving-offers-table-pct",
                "team": side,
                "result": "pass" if offers["pct_matching"] == offers["pct_checked"] else "fail",
                # Both operands, under the same names every other check uses (2026-07-27
                # review patch). Without them this was the one check in the family a
                # programmatic consumer could not read, against the module's own stated
                # invariant. They also make the zero-row case self-describing: a table
                # that admitted no rows at all reports `0 of 0` here rather than a bare
                # "pass" — the unread-table case itself is caught by
                # `receiving-offers-table-sum`, which is why this stays a pass.
                "page_value": offers["pct_matching"],
                "counterpart": offers["pct_checked"],
                "rows_checked": offers["pct_checked"],
                "rows_matching": offers["pct_matching"],
                "rows_skipped_zero_made": offers["pct_skipped_zero_made"],
                "mismatches": offers["pct_mismatches"],
                "specifics": (
                    f"{side}: {offers['pct_matching']} of {offers['pct_checked']} rows "
                    f"match the printed percentage "
                    f"({offers['pct_skipped_zero_made']} skipped for offers_made == 0)"
                    + (f"; {offers['pct_mismatches']}" if offers["pct_mismatches"] else "")
                ),
            }
        )

    if player_stats is None:
        return checks

    for side in ("home", "away"):
        offers = counts[side]["offers"]
        movement = counts[side]["movement"]
        players = player_stats[side]
        checks.append(
            _count_check(
                "receiving-offers-domain-g",
                side,
                offers["total_offers_made"],
                sum(player["in_possession"]["total_offers"] for player in players),
                column="total_offers_made",
            )
        )
        checks.append(
            _count_check(
                "receiving-offers-domain-g",
                side,
                offers["total_offers_received"],
                sum(player["in_possession"]["offers_received"] for player in players),
                column="total_offers_received",
            )
        )
        for label, code in MOVEMENT_LABEL_TO_ENUM.items():
            # Record keys are snake_case on both sides of this comparison (Domain G's own
            # `offers_by_movement_type` and this parser's `grid_by_type`); the contract's
            # kebab code travels as the check's `movement_type` VALUE.
            field = code.replace("-", "_")
            checks.append(
                _count_check(
                    "receiving-movement-domain-g",
                    side,
                    movement["grid_by_type"][field],
                    sum(
                        player["in_possession"]["offers_by_movement_type"][field]
                        for player in players
                    ),
                    movement_type=code,
                    label=label,
                )
            )
    return checks


def _count_check(check_id: str, side: str, page_value: int, counterpart: int, **extra) -> dict:
    """One binary, exact check carrying both operands (pass or fail).

    The operands are recorded twice on purpose: as named fields, which is what a
    programmatic consumer reads, and inside `specifics`, which is the shape
    `batch.format_summary`'s fallback branch and `checks._failed_check_deviations` both
    render. Without the string form a failing receiving check would print "no detail
    recorded" in the manifest summary and reach the FR-15 gate with no operands at all.
    """
    qualifier = "".join(f" {key}={value}" for key, value in extra.items() if key != "label")
    # `**extra` is spread FIRST so the computed fields always win (2026-07-27 review
    # patch). Spread last, a caller keyword named `result`, `check`, `page_value` or
    # `counterpart` would silently overwrite the verdict — the wrong shape for a helper
    # whose whole contract is that checks are computed and strictly binary, never
    # asserted.
    return {
        **extra,
        "check": check_id,
        "team": side,
        "result": "pass" if page_value == counterpart else "fail",
        "page_value": page_value,
        "counterpart": counterpart,
        "specifics": (
            f"{side}{qualifier}: page reads {page_value}, counterpart is {counterpart}"
        ),
    }


def _offers_counts(block: dict) -> dict:
    """The offers page's own reconciliation operands, all read from that page."""
    rows = block["table_rows"]
    checked = matching = skipped = 0
    mismatches: list[dict] = []
    for row in rows:
        if row["offers_made"] == 0:
            skipped += 1
            continue
        checked += 1
        computed = round(100 * row["offers_received"] / row["offers_made"], 1)
        if computed == row["made_received_pct"]:
            matching += 1
        else:
            mismatches.append(
                {
                    "shirt_number": row["shirt_number"],
                    "printed": row["made_received_pct"],
                    "computed": computed,
                }
            )
    return {
        "total_offers_made": block["total_offers_made"],
        "total_offers_received": block["total_offers_received"],
        "thirds_sum": (
            block["offers_final_third"]
            + block["offers_middle_third"]
            + block["offers_defensive_third"]
        ),
        "shape_sum": block["offers_inside_shape"] + block["offers_outside_shape"],
        "table_made_sum": sum(row["offers_made"] for row in rows),
        "table_received_sum": sum(row["offers_received"] for row in rows),
        "pct_checked": checked,
        "pct_matching": matching,
        "pct_skipped_zero_made": skipped,
        "pct_mismatches": mismatches,
    }


def _movement_counts(block: dict) -> dict:
    """The movement page's operands, plus the two documented absences as `None`.

    `grid_by_type` is keyed in **snake_case**, not by the contract's kebab codes: record
    JSON keys are snake_case by rule (`test_record_keys_are_snake_case` enforces it, and
    Story 1.12 was caught keying `counts` by kebab codes). The kebab code still travels as
    a VALUE on every `by_third_and_type` cell, which is what 1.16's emission reads. The
    snake spelling is also Domain G's own (`offers_by_movement_type`), so the cross-domain
    check compares like with like.
    """
    grid_by_type: dict[str, int] = {
        code.replace("-", "_"): 0 for code in MOVEMENT_LABEL_TO_ENUM.values()
    }
    for cell in block["by_third_and_type"]:
        grid_by_type[cell["movement_type"].replace("-", "_")] += cell["count"]
    return {
        "total_movements": block["total_movements"],
        "grid_sum": sum(cell["count"] for cell in block["by_third_and_type"]),
        "grid_by_type": grid_by_type,
        # No `phase_sum` is staged, deliberately (2026-07-27 review ruling). The three
        # per-phase totals are NOT a partition of `total_movements` (the corpus delta
        # ranges -48..+314 and is zero on 3/208 pages), and Task 7.4's AD-14 filing tells
        # every downstream surface never to sum them — so handing them a pre-computed sum
        # in the check-operand surface is the exact artifact that filing warns against.
        # `by_phase` stages verbatim; anything wanting the per-type split takes it from
        # the grid, which reconciles exactly.
        # AC 2's documented absences, recorded rather than checked (see the warnings).
        "donut_slice_table": None,
        "phase_partition_table": None,
    }


# ----------------------------------------------------------------------- offers parsing


def _parse_offers_page(
    page: "pymupdf.Page",
    team_id: str,
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> dict:
    words = _page_words(page)
    panels = _offers_panels(page, words, anchor_id, pages, report_id, page_index)
    _assert_decoration_census(page, panels, anchor_id, pages, report_id, page_index)

    block: dict = {"team_id": team_id, "type": "offer"}
    for key, label in OFFERS_KPI_LABELS.items():
        block[key] = _labelled_value(words, label, report_id, page_index)
    for key, (rect, _title_words) in panels.items():
        block[key] = _panel_badge(rect, words, key, report_id, page_index)
    block["most_offers"] = _most_offers(words, panels, report_id, page_index)
    block["table_rows"] = _offers_table_rows(page, report_id, page_index)
    return block


def _offers_panels(
    page: "pymupdf.Page",
    words: "list[tuple[float, float, float, float, str]]",
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> "dict[str, tuple[pymupdf.Rect, list]]":
    """The two titled offers panels, keyed by what their own titles say they hold.

    De-duplication by rounded geometry is per-family tuning, deliberately NOT a change to
    the shared chain: the right panel carries its white-stroked frame plus two
    stroke+fill rects of bit-identical geometry (the shape overlay's border), so
    `detect_pitch_frames` correctly reports 4 qualifying rects for 2 panels on 208/208
    pages. The COUNT is checked before any title lookup, so a page that grows or loses a
    panel reports as the layout revision it is rather than blaming an empty title
    (the Story 1.12 `_typed_panels` precedent).
    """
    frames = detect_pitch_frames(page, report_id)
    distinct: list["pymupdf.Rect"] = []
    seen: set[tuple[float, ...]] = set()
    for rect in frames:
        key = tuple(round(value, 2) for value in (rect.x0, rect.y0, rect.x1, rect.y1))
        if key in seen:
            continue
        seen.add(key)
        distinct.append(rect)
    if len(distinct) != len(OFFERS_PANEL_TITLE_TO_KEY):
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index} presents {len(distinct)} distinct stroked panels "
            f"({len(frames)} qualifying rects), expected {len(OFFERS_PANEL_TITLE_TO_KEY)}",
        )
    panels: dict[str, tuple["pymupdf.Rect", list]] = {}
    for rect in distinct:
        title, title_words = _panel_title(rect, words)
        key = OFFERS_PANEL_TITLE_TO_KEY.get(title)
        if key is None:
            raise UnknownLabelError("Offers panel title", title, page_index, report_id)
        if key in panels:
            raise ReceivingPageLayoutError(
                anchor_id,
                pages,
                report_id,
                f"page {page_index} prints the panel title {title!r} twice; the two "
                "shape badges cannot be told apart",
            )
        panels[key] = (rect, title_words)
    return panels


def _assert_decoration_census(
    page: "pymupdf.Page",
    panels: "dict[str, tuple[pymupdf.Rect, list]]",
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> None:
    """Run the full chain over both panels and assert the corpus-invariant decoration.

    This is the template-revision tripwire, and it is the reason AC 1's "reuse the chain,
    assert on unknown RGB" is true here rather than a formality. The 11 dots are a static
    formation template: byte-identical between the two panels and across every team page
    sampled, carrying zero per-report information. **Nothing is staged from them** —
    staging them would put 22 meaningless rows in every record and invite a downstream
    consumer to render them as positions.

    But dropping the chain would leave the one page in this family with pitch-panel
    geometry unguarded, and silence is the worst outcome: if a future report ever draws
    real markers there, this parser must abort loud rather than publish a receiving
    payload that quietly omits them. So the chain runs and asserts — exactly 11 dots per
    panel, one known fill (`key_outcomes` raises `UnknownRgbError` on anything else), and
    positions identical between the panels relative to each panel's own origin.
    """
    drawings = page.get_drawings()
    signatures: dict[str, tuple] = {}
    for key, (rect, _title_words) in sorted(panels.items()):
        candidates = collect_candidate_markers(drawings, rect, RECEIVING_SHAPE_SPEC)
        dots = exclude_legend_rows(candidates, RECEIVING_SHAPE_SPEC)
        keyed = key_outcomes(dots, RECEIVING_SHAPE_SPEC, report_id, page_index)
        if len(keyed) != OFFERS_DECORATION_DOTS_PER_PANEL:
            raise ReceivingPageLayoutError(
                anchor_id,
                pages,
                report_id,
                f"page {page_index}: the {key} panel holds {len(keyed)} decoration "
                f"circles, expected exactly {OFFERS_DECORATION_DOTS_PER_PANEL}; this "
                "panel may now be drawing real markers",
            )
        signatures[key] = tuple(
            sorted(
                (
                    round(marker.pdf_x - rect.x0, _DECORATION_DECIMALS),
                    round(marker.pdf_y - rect.y0, _DECORATION_DECIMALS),
                )
                for marker in keyed
            )
        )
    if len(set(signatures.values())) != 1:
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the two panels' decoration positions differ; they are a "
            "static template on every corpus page, so one of them is now carrying data",
        )


def _panel_badge(
    rect: "pymupdf.Rect",
    words: "list[tuple[float, float, float, float, str]]",
    key: str,
    report_id: str,
    page_index: int,
) -> int:
    """The shape badge printed inside a typed panel.

    Each offers panel holds exactly ONE word on 416/416 corpus panels and it is that
    panel's badge, so the lookup is "the unique digit word whose centre is inside this
    panel's own rect" — and because the panel was typed from its printed title, the
    inside/outside assignment is text-anchored end to end (Task 1.2). The two badges sit
    at different y on the reference page; nothing positional may be read into them.
    """
    inside = [
        word
        for word in words
        if rect.x0 <= (word[0] + word[2]) / 2 <= rect.x1
        and rect.y0 <= (word[1] + word[3]) / 2 <= rect.y1
    ]
    digits = [word for word in inside if _DIGITS_RE.fullmatch(word[4])]
    if len(digits) != 1:
        raise ReceivingTableError(
            f"the {key} panel holds {len(digits)} digit words "
            f"({[word[4] for word in inside]}), expected exactly one shape badge",
            report_id,
            page_index,
        )
    return int(digits[0][4])


def _most_offers(
    words: "list[tuple[float, float, float, float, str]]",
    panels: "dict[str, tuple[pymupdf.Rect, list]]",
    report_id: str,
    page_index: int,
) -> dict:
    """The Most Offers block: value, player name, position — stacked under its title.

    Bounded by the page's own structures rather than by invented coordinates: the block
    runs from its own title down to the panel titles below it, and horizontally it is
    every word whose x-span overlaps the title's. That last bound is what separates it
    from the KPI column on its left and the per-player table on its right, both of which
    share y-lines with it (`LEFT WINGER` clusters with a table row at 0.0 pt on the
    reference page). Exactly three lines must remain.

    `position` stages **verbatim** (`"LEFT WINGER"`). It is NOT mapped to the contract's
    `Position` vocabulary here: that vocabulary and its `UnknownPositionError` belong to
    Domain A (Story 1.6), and a second mapping site is a second thing to drift.
    """
    title = _label_run(words, MOST_OFFERS_LABEL, report_id, page_index)
    panel_titles_top = min(
        min(word[1] for word in title_words)
        for _rect, title_words in panels.values()
    )
    block = [
        word
        for word in words
        if title[3] < word[1] < panel_titles_top
        and word[0] < title[2]
        and word[2] > title[0]
    ]
    lines = _visual_lines(block)
    if len(lines) != 3:
        raise ReceivingTableError(
            f"the {MOST_OFFERS_LABEL!r} block holds {len(lines)} lines "
            f"({[[word[4] for word in line] for _y, line in lines]}), expected a value, "
            "a player name and a position",
            report_id,
            page_index,
        )
    value_line = lines[0][1]
    if len(value_line) != 1 or not _DIGITS_RE.fullmatch(value_line[0][4]):
        raise ReceivingTableError(
            f"the {MOST_OFFERS_LABEL!r} block's first line is "
            f"{[word[4] for word in value_line]}, expected a single integer",
            report_id,
            page_index,
        )
    return {
        "value": int(value_line[0][4]),
        "player_name": " ".join(word[4] for word in lines[1][1]),
        "position": " ".join(word[4] for word in lines[2][1]),
    }


def _offers_table_rows(page: "pymupdf.Page", report_id: str, page_index: int) -> list[dict]:
    """The per-player offers rows, staged verbatim in printed order.

    The x-restriction is load-bearing and the evidence is direct: the left KPI column
    prints `424` at y=126.8 while the first table row prints at y=126.0 — **0.8 pt
    apart, inside the shared 3 pt `table_lines` tolerance** — so an x-unrestricted
    leftmost-digit rule glues two KPI values into the first player row. The region is
    therefore derived from the header's own '#' position, exactly as
    `crosses.py::_cross_table_rows` and `defensive_actions.py::_regain_table_rows` do.

    Row admission: the leftmost region word is a pure-ASCII-digit shirt number. An
    admitted row must then carry exactly three digit cells (shirt, offers made, offers
    received) and exactly one percentage cell — anything else is a template revision,
    never a row to skip. Zero admitted rows is a valid table.

    The name is gathered SEPARATELY, from the name x-band across neighbouring lines,
    because it may straddle the numeric row line: four corpus pages print a three-line
    name ("Marcus HOLMGREN" 4.5 pt above the numbers, "PEDERSEN" 4.5 pt below), which
    leaves the numeric cluster holding only the shirt number, two counts and a
    percentage. Requiring the name to sit IN the row cluster would abort those reports
    on exactly the names this band exists to support (the `crosses.py` /
    `defensive_actions.py` precedent). A row that genuinely has no name is still caught.
    """
    lines = table_lines(page)
    words = [
        (x0, y0, text)
        for x0, y0, _x1, _y1, text, *_ in page.get_text("words")
        if text.strip()
    ]
    header_y, header_cells = _offers_header_line(lines, report_id, page_index)
    table_x_min = min(x for x, word in header_cells if word == "#") - _TABLE_X_MARGIN_PT
    # Derived from the x-RESTRICTED header cells, never the full-width cluster: the
    # Most-Offers block and the KPI column share this header's y-line, so a stray
    # 'Player' printed left of the table would start the name band half a page early and
    # sweep unrelated text into every row's name.
    player_columns = [x for x, word in header_cells if word == "Player" and x >= table_x_min]
    if len(player_columns) != 1:
        raise ReceivingTableError(
            f"header line carries {len(player_columns)} 'Player' column titles inside the "
            "table region; the name band cannot be derived",
            report_id,
            page_index,
        )
    player_x = player_columns[0]

    rows: list[dict] = []
    for y, cells in lines:
        if y <= header_y + _TABLE_HEADER_BAND_PT:
            continue
        region = [(x, word) for x, word in cells if x >= table_x_min]
        if not region or not _DIGITS_RE.fullmatch(region[0][1]):
            continue
        digits = [(x, word) for x, word in region if _DIGITS_RE.fullmatch(word)]
        percents = [(x, word) for x, word in region if _PERCENT_RE.fullmatch(word)]
        if len(digits) != 3 or len(percents) != 1:
            raise ReceivingTableError(
                f"row at y={y:.1f} reads {[word for _x, word in region]}, expected a "
                "shirt number, two counts and one percentage",
                report_id,
                page_index,
            )
        name_band = (player_x - _NAME_X_MARGIN_PT, digits[1][0] - _NAME_X_MARGIN_PT)
        name_words = sorted(
            (y0, x0, text)
            for x0, y0, text in words
            if name_band[0] <= x0 < name_band[1] and abs(y0 - y) <= _NAME_Y_TOLERANCE_PT
        )
        if not name_words:
            raise ReceivingTableError(
                f"row at y={y:.1f} (shirt {region[0][1]}) has no player name in the name "
                "column",
                report_id,
                page_index,
            )
        rows.append(
            {
                "shirt_number": int(digits[0][1]),
                "player_name": " ".join(text for _y, _x, text in name_words),
                "offers_made": int(digits[1][1]),
                "offers_received": int(digits[2][1]),
                "made_received_pct": float(_PERCENT_RE.fullmatch(percents[0][1]).group(1)),
            }
        )
    return rows


def _offers_header_line(
    lines: "list[tuple[float, list[tuple[float, str]]]]", report_id: str, page_index: int
) -> "tuple[float, list[tuple[float, str]]]":
    """The single line carrying both '#' and 'Player' — the offers table's main header.

    The column titles stack over three lines ("Offers"/"Made", "Offers"/"Received",
    "%"/"Made"/"&"/"Received") and "Offers" also appears in five KPI labels, the two
    panel titles and the Most-Offers title, so the '#'+'Player' pair is the only
    unambiguous anchor for the table region.
    """
    matches = [
        (y, cells)
        for y, cells in lines
        if any(word == "#" for _x, word in cells)
        and any(word == "Player" for _x, word in cells)
    ]
    if len(matches) != 1:
        raise ReceivingTableError(
            f"{len(matches)} header-shaped lines carry both '#' and 'Player'; the offers "
            "table region cannot be derived",
            report_id,
            page_index,
        )
    header_y, cells = matches[0]
    if sum(1 for _x, word in cells if word == "#") != 1:
        raise ReceivingTableError(
            "header line does not carry exactly one '#' column title; the offers table "
            "region cannot be derived",
            report_id,
            page_index,
        )
    return header_y, cells


# --------------------------------------------------------------------- movement parsing


def _parse_movement_page(
    page: "pymupdf.Page",
    team_id: str,
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> dict:
    words = _page_words(page)
    panel = _movement_panel(page, words, anchor_id, pages, report_id, page_index)
    _assert_panel_orientation(page, panel, anchor_id, pages, report_id, page_index)
    thirds = _pitch_thirds(page, panel, anchor_id, pages, report_id, page_index)
    donuts = _donut_totals(page, words, report_id, page_index)
    grid = _movement_grid(panel, words, thirds, anchor_id, pages, report_id, page_index)
    return {
        "team_id": team_id,
        "type": "movement",
        "total_movements": donuts["all_movement_types"],
        "by_phase": {key: donuts[key] for key in MOVEMENT_PHASE_KEYS},
        "by_third_and_type": grid,
        "top_ranked_players": _top_ranked_players(page, panel, report_id, page_index),
    }


def _movement_panel(
    page: "pymupdf.Page",
    words: "list[tuple[float, float, float, float, str]]",
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> "pymupdf.Rect":
    """The single titled pitch panel every movement page draws.

    It holds no markers — it is a three-thirds bar chart — but it IS what bounds the 15
    grid values, so it is detected through the shared chain like every other map panel
    and typed from its own printed title.
    """
    frames = detect_pitch_frames(page, report_id)
    distinct = {
        tuple(round(value, 2) for value in (rect.x0, rect.y0, rect.x1, rect.y1)): rect
        for rect in frames
    }
    if len(distinct) != 1:
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index} presents {len(distinct)} distinct stroked panels, "
            "expected exactly one",
        )
    panel = next(iter(distinct.values()))
    title, _title_words = _panel_title(panel, words)
    if title != MOVEMENT_PANEL_TITLE:
        raise UnknownLabelError("Movement panel title", title, page_index, report_id)
    return panel


def _assert_panel_orientation(
    page: "pymupdf.Page",
    panel: "pymupdf.Rect",
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> None:
    """Fail loud unless the panel's own `DIRECTION` label fixes the assumed orientation.

    No coordinate is produced by this family, so AD-6's normalization formula pair never
    runs — but the three pitch thirds ARE read off this panel, and a re-oriented panel
    would swap `final-third` and `defensive-third` on every grid row it holds while every
    reconciliation still passed (the grid sum is orientation-blind). The label is the
    page's own statement of which way it is drawn, so it is what gets asserted (AD-8:
    read the page, never assume the template) — the
    `defensive_actions._assert_panel_orientation` precedent.
    """
    inside = [
        direction
        for text, direction, center_x, center_y in _rotated_lines(page)
        if text == _DIRECTION_LABEL
        and panel.x0 <= center_x <= panel.x1
        and panel.y0 <= center_y <= panel.y1
    ]
    if len(inside) != 1:
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the movement panel carries {len(inside)} "
            f"{_DIRECTION_LABEL!r} labels, expected exactly one to fix its orientation",
        )
    direction = inside[0]
    if any(
        abs(component - expected) > _DIRECTION_TOLERANCE
        for component, expected in zip(direction, _DIRECTION_VECTOR)
    ):
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the movement panel's {_DIRECTION_LABEL!r} label reads "
            f"{direction}, expected {_DIRECTION_VECTOR}; the panel is re-oriented and "
            "every grid row's pitch third would be assigned upside down",
        )


def _pitch_thirds(
    page: "pymupdf.Page",
    panel: "pymupdf.Rect",
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> "list[tuple[str, float]]":
    """The three rotated pitch-third labels as (enum code, centre y), in printed order.

    Text-anchored: which band is the final third is what the page says it is, never "the
    top band" (AD-8). The labels extract at x0 ~= 664.6 — just LEFT of the panel's own
    x0 (675.0) — so association is by their centre y falling inside the panel's y-span,
    which is the axis that actually assigns a third.
    """
    found: list[tuple[str, float]] = []
    for text, _direction, _center_x, center_y in _rotated_lines(page):
        code = PITCH_THIRD_LABEL_TO_ENUM.get(text)
        if code is None or not panel.y0 <= center_y <= panel.y1:
            continue
        found.append((code, center_y))
    found.sort(key=lambda pair: pair[1])
    if sorted(code for code, _y in found) != sorted(PITCH_THIRD_LABEL_TO_ENUM.values()):
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the movement panel carries rotated third labels "
            f"{[code for code, _y in found]}, expected exactly "
            f"{sorted(PITCH_THIRD_LABEL_TO_ENUM.values())}",
        )
    return found


def _donut_totals(
    page: "pymupdf.Page",
    words: "list[tuple[float, float, float, float, str]]",
    report_id: str,
    page_index: int,
) -> dict:
    """The four donut centre totals, each located by its own printed title.

    The donuts are RASTER: their slice values live inside the images and are
    unextractable, so the centre total is the only text each one offers (AC 2's
    documented absence (a)). The image rect is the page's own statement of where a donut
    is, so the read is "the unique digit word inside the titled image rect" — the same
    title-band geometry that types the pitch panels, one structure over.
    """
    rects: dict[tuple[float, ...], "pymupdf.Rect"] = {}
    for info in page.get_image_info():
        rect = info["bbox"]
        rects.setdefault(tuple(round(value, 2) for value in rect), rect)

    totals: dict[str, int] = {}
    for title, key in MOVEMENT_DONUT_TITLES.items():
        run = _label_run(words, title, report_id, page_index)
        center = (run[0] + run[2]) / 2
        below = [
            rect
            for rect in rects.values()
            if run[3] <= rect[1] <= run[3] + _TITLE_BAND_PT and rect[0] <= center <= rect[2]
        ]
        if len(below) != 1:
            raise ReceivingTableError(
                f"{len(below)} image rects sit under the donut title {title!r}, expected "
                "exactly one",
                report_id,
                page_index,
            )
        rect = below[0]
        digits = [
            word
            for word in words
            if _DIGITS_RE.fullmatch(word[4])
            and rect[0] <= (word[0] + word[2]) / 2 <= rect[2]
            and rect[1] <= (word[1] + word[3]) / 2 <= rect[3]
        ]
        if len(digits) != 1:
            raise ReceivingTableError(
                f"the {title!r} donut holds {len(digits)} digit words "
                f"({[word[4] for word in digits]}), expected exactly one centre total",
                report_id,
                page_index,
            )
        totals[key] = int(digits[0][4])
    return totals


def _movement_grid(
    panel: "pymupdf.Rect",
    words: "list[tuple[float, float, float, float, str]]",
    thirds: "list[tuple[str, float]]",
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> list[dict]:
    """The 15-cell third x type grid inside the movement panel.

    Read label-anchored, not by visual row, for two measured reasons: the panel also
    prints 33 axis-tick digits (11 per third, 48 digit words inside the panel in total),
    and the corpus prints the `In to Out` value up to 3.02 pt below its own label — just
    outside `table_lines`' 3 pt clustering tolerance. So each of the five type labels is
    located three times inside the panel, and each occurrence takes the single digit to
    its right within `_GRID_VALUE_DY_PT`, which the tick rows (>= 21 pt below the last
    label row) never reach.

    Each cell's third comes from the nearest rotated third label (`_pitch_thirds`), and
    the resulting partition is asserted to be exactly five cells per third — the real
    guard, and the one that would catch a re-laid-out panel. Order is deterministic
    (AD-8): pitch thirds in PRINTED order, then movement type.
    """
    inside = [
        word
        for word in words
        if panel.x0 <= (word[0] + word[2]) / 2 <= panel.x1
        and panel.y0 <= (word[1] + word[3]) / 2 <= panel.y1
    ]
    third_order = {code: index for index, (code, _y) in enumerate(thirds)}
    cells: list[dict] = []
    for label, code in MOVEMENT_LABEL_TO_ENUM.items():
        runs = _label_runs(inside, label)
        if len(runs) != len(thirds):
            raise ReceivingPageLayoutError(
                anchor_id,
                pages,
                report_id,
                f"page {page_index}: the movement panel prints the label {label!r} "
                f"{len(runs)} times, expected once per pitch third ({len(thirds)})",
            )
        for run in runs:
            values = [
                word
                for word in inside
                if _DIGITS_RE.fullmatch(word[4])
                and word[0] > run[2]
                and abs(word[1] - run[1]) <= _GRID_VALUE_DY_PT
            ]
            if len(values) != 1:
                raise ReceivingTableError(
                    f"the grid row {label!r} at y={run[1]:.1f} has {len(values)} values "
                    f"to its right ({[word[4] for word in values]}), expected exactly one",
                    report_id,
                    page_index,
                )
            center_y = (run[1] + run[3]) / 2
            third = min(thirds, key=lambda pair: abs(pair[1] - center_y))[0]
            cells.append(
                {
                    "pitch_third": third,
                    "movement_type": code,
                    "count": int(values[0][4]),
                }
            )
    per_third = {code: 0 for code, _y in thirds}
    for cell in cells:
        per_third[cell["pitch_third"]] += 1
    if set(per_third.values()) != {len(MOVEMENT_LABEL_TO_ENUM)}:
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the movement grid assigns {per_third} rows per pitch "
            f"third, expected {len(MOVEMENT_LABEL_TO_ENUM)} in each",
        )
    # The counts-per-third guard above is necessary but NOT sufficient, and the gap is the
    # one this parser is least able to see: `third` is assigned by nearest rotated label
    # (the `min(thirds, ...)` above), so a re-laid-out panel that pushed one row across a
    # band boundary while another compensated would keep 5/5/5 and pass. No reconciliation
    # can catch it either — `receiving-movement-grid-total` sums across thirds and
    # `receiving-movement-domain-g` sums each type across thirds, so both are
    # orientation- and partition-blind. Requiring the 15 cells to be 15 DISTINCT
    # (third, type) pairs is what makes a swap or a duplicate loud (2026-07-27 review
    # ruling); the grid is a full 3 x 5 partition on 208/208 corpus pages.
    pairs = {(cell["pitch_third"], cell["movement_type"]) for cell in cells}
    if len(pairs) != len(thirds) * len(MOVEMENT_LABEL_TO_ENUM):
        raise ReceivingPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the movement grid's {len(cells)} cells cover only "
            f"{len(pairs)} distinct (pitch third, movement type) pairs, expected "
            f"{len(thirds) * len(MOVEMENT_LABEL_TO_ENUM)}; a grid row has been assigned "
            "to the wrong pitch third",
        )
    cells.sort(key=lambda cell: (third_order[cell["pitch_third"]], cell["movement_type"]))
    return cells


def _top_ranked_players(
    page: "pymupdf.Page", panel: "pymupdf.Rect", report_id: str, page_index: int
) -> list[dict]:
    """The `Top Ranked Players` rows — one per movement type, in printed order.

    The table needs BOTH x bounds, unlike every earlier family. The left one is the
    house pattern (the header's own 'Type' column). The right one cannot be the pitch
    panel's edge: the rotated `FINAL`/`MIDDLE`/`DEFENSIVE THIRD` labels extract at
    x0 ~= 664.6, LEFT of the panel's own x0 (675.0), so they would be swept into a row's
    trailing cell. It is derived instead from the header's own last column word
    ('Movements'), which is what the printed table actually ends at.

    Row grammar: the leading cells spell one of the five frozen movement-type labels,
    then a pure-ASCII-digit shirt number, then the name, then the movements count. The
    shirt number is its OWN cell (x ~= 346) printed before the name (x ~= 358), not glued
    to it (Task 1.4, measured).
    """
    lines = table_lines(page)
    words = _page_words(page)
    header_y, header_cells = _top_ranked_header_line(lines, report_id, page_index)
    table_x_min = min(x for x, word in header_cells if word == "Type") - _TABLE_X_MARGIN_PT
    movements = [
        word
        for word in words
        if word[4] == "Movements" and abs(word[1] - header_y) <= _WORD_LINE_TOLERANCE_PT
    ]
    if len(movements) != 1:
        raise ReceivingTableError(
            f"header line carries {len(movements)} 'Movements' column titles; the Top "
            "Ranked Players table region cannot be derived",
            report_id,
            page_index,
        )
    table_x_max = movements[0][2] + _TABLE_X_MARGIN_PT

    rows: list[dict] = []
    for y, cells in lines:
        if y <= header_y + _WORD_LINE_TOLERANCE_PT * 2:
            continue
        region = [(x, word) for x, word in cells if table_x_min <= x < table_x_max]
        if not region:
            continue
        texts = [word for _x, word in region]
        matched = next(
            (
                (label, code)
                for label, code in MOVEMENT_LABEL_TO_ENUM.items()
                if texts[: len(label.split())] == label.split()
            ),
            None,
        )
        if matched is None:
            continue
        label, code = matched
        rest = region[len(label.split()) :]
        if (
            len(rest) < 3
            or not _DIGITS_RE.fullmatch(rest[0][1])
            or not _DIGITS_RE.fullmatch(rest[-1][1])
        ):
            raise ReceivingTableError(
                f"the {label!r} row at y={y:.1f} reads {[word for _x, word in rest]}, "
                "expected a shirt number, a name and a movements count",
                report_id,
                page_index,
            )
        rows.append(
            {
                "movement_type": code,
                "shirt_number": int(rest[0][1]),
                "player_name": " ".join(word for _x, word in rest[1:-1]),
                "movements": int(rest[-1][1]),
            }
        )
    if len(rows) != len(MOVEMENT_LABEL_TO_ENUM):
        raise ReceivingTableError(
            f"the Top Ranked Players table admitted {len(rows)} rows, expected one per "
            f"movement type ({len(MOVEMENT_LABEL_TO_ENUM)})",
            report_id,
            page_index,
        )
    # One row per type, and the types must be DISTINCT (2026-07-27 review patch). The
    # count guard alone is satisfied by a page printing one type twice and omitting
    # another, and — the case this family actually has to survive — by a page that grows
    # a sixth `No Movement` row: the unmapped row is skipped by the `matched is None`
    # branch above, five rows still land, and the vocabulary asymmetry Task 7.3 filed
    # would arrive silently. Nothing downstream reconciles `top_ranked_players`, so this
    # is its only guard.
    types = [row["movement_type"] for row in rows]
    if len(set(types)) != len(MOVEMENT_LABEL_TO_ENUM):
        raise ReceivingTableError(
            f"the Top Ranked Players table lists movement types {types}, expected each of "
            f"the {len(MOVEMENT_LABEL_TO_ENUM)} exactly once",
            report_id,
            page_index,
        )
    return rows


def _top_ranked_header_line(
    lines: "list[tuple[float, list[tuple[float, str]]]]", report_id: str, page_index: int
) -> "tuple[float, list[tuple[float, str]]]":
    """The single line carrying 'Type', 'Player' and 'Movements'."""
    matches = [
        (y, cells)
        for y, cells in lines
        if all(
            any(word == title for _x, word in cells)
            for title in ("Type", "Player", "Movements")
        )
    ]
    if len(matches) != 1:
        raise ReceivingTableError(
            f"{len(matches)} header-shaped lines carry 'Type', 'Player' and 'Movements'; "
            "the Top Ranked Players table region cannot be derived",
            report_id,
            page_index,
        )
    header_y, cells = matches[0]
    if sum(1 for _x, word in cells if word == "Type") != 1:
        raise ReceivingTableError(
            "header line does not carry exactly one 'Type' column title; the Top Ranked "
            "Players table region cannot be derived",
            report_id,
            page_index,
        )
    return header_y, cells


# ------------------------------------------------------------------------------ shared


def _single_anchor_page(
    anchors: "dict[str, list[int]]", anchor_id: str, report_id: str
) -> int:
    """The one page a receiving anchor must resolve to (208/208 pages per family)."""
    pages = anchors.get(anchor_id)
    if not isinstance(pages, list) or len(pages) != 1:
        raise ReceivingPageLayoutError(anchor_id, pages, report_id)
    return pages[0]


def _page_words(page: "pymupdf.Page") -> "list[tuple[float, float, float, float, str]]":
    """Every non-blank word as (x0, y0, x1, y1, text)."""
    return [
        (x0, y0, x1, y1, text)
        for x0, y0, x1, y1, text, *_ in page.get_text("words")
        if text.strip()
    ]


def _visual_lines(
    words: "list[tuple[float, float, float, float, str]]",
) -> "list[tuple[float, list[tuple[float, float, float, float, str]]]]":
    """`table_lines`' clustering, but keeping full word boxes.

    The shared helper drops x1/y1, and every label anchor here needs a centre and a
    right edge. Same 3 pt tolerance, so "one line" means the same thing in both.
    """
    lines: list[tuple[float, list]] = []
    current: list = []
    current_y: float | None = None
    for word in sorted(words, key=lambda word: (word[1], word[0])):
        if current_y is not None and abs(word[1] - current_y) > _WORD_LINE_TOLERANCE_PT:
            lines.append((current_y, sorted(current, key=lambda word: word[0])))
            current, current_y = [], None
        if current_y is None:
            current_y = word[1]
        current.append(word)
    if current:
        lines.append((current_y, sorted(current, key=lambda word: word[0])))
    return lines


def _label_runs(
    words: "list[tuple[float, float, float, float, str]]", label: str
) -> "list[tuple[float, float, float, float]]":
    """Every consecutive same-line word run printing `label`, as bboxes.

    Multi-word matching rather than single-word lookup, because this family's labels
    share prefixes ("Offers Made in Final/Middle/Defensive Third", "In Front" vs
    "In Between" vs "In Behind") and a one-word anchor would be ambiguous on every page.
    """
    tokens = label.split()
    runs: list[tuple[float, float, float, float]] = []
    for _y, line in _visual_lines(words):
        texts = [word[4] for word in line]
        for start in range(len(texts) - len(tokens) + 1):
            if texts[start : start + len(tokens)] != tokens:
                continue
            run = line[start : start + len(tokens)]
            runs.append(
                (
                    min(word[0] for word in run),
                    min(word[1] for word in run),
                    max(word[2] for word in run),
                    max(word[3] for word in run),
                )
            )
    return runs


def _label_run(
    words: "list[tuple[float, float, float, float, str]]",
    label: str,
    report_id: str,
    page_index: int,
) -> "tuple[float, float, float, float]":
    """The single run printing `label` — ambiguity is a template revision, not a guess."""
    runs = _label_runs(words, label)
    if len(runs) != 1:
        raise ReceivingTableError(
            f"the label {label!r} appears {len(runs)} times, expected exactly once",
            report_id,
            page_index,
        )
    return runs[0]


def _labelled_value(
    words: "list[tuple[float, float, float, float, str]]",
    label: str,
    report_id: str,
    page_index: int,
) -> int:
    """The integer printed above `label`, centred on the same x.

    The `defensive_actions._headline_value` pattern: anchored on the label, never on an
    absolute position, and the column match must be unambiguous rather than merely
    nearest — "closest digit wins" would silently accept an unrelated number if the real
    value ever failed to parse.
    """
    run = _label_run(words, label, report_id, page_index)
    center = (run[0] + run[2]) / 2
    candidates = [
        word
        for word in words
        if _DIGITS_RE.fullmatch(word[4])
        and _KPI_MIN_DY_PT < run[1] - word[1] < _KPI_MAX_DY_PT
    ]
    within = [
        word
        for word in candidates
        if abs((word[0] + word[2]) / 2 - center) <= _KPI_X_TOLERANCE_PT
    ]
    if not within:
        # Two DIFFERENT diagnoses, reported differently (2026-07-27 review patch, restoring
        # the `defensive_actions._headline_value` behaviour this function claims to copy):
        # "no digit anywhere above the label" is a missing value, while "a digit 15.1 pt
        # off centre" is font-metric or column drift. Naming the near miss is what makes
        # the second localizable without reopening the PDF.
        if candidates:
            nearest = min(
                candidates, key=lambda word: abs((word[0] + word[2]) / 2 - center)
            )
            offset = abs((nearest[0] + nearest[2]) / 2 - center)
            raise ReceivingTableError(
                f"the nearest printed value above the label {label!r} is "
                f"{nearest[4]!r}, {offset:.1f} pt off its centre (tolerance "
                f"{_KPI_X_TOLERANCE_PT} pt)",
                report_id,
                page_index,
            )
        raise ReceivingTableError(
            f"no printed value sits in the {_KPI_MIN_DY_PT}-{_KPI_MAX_DY_PT} pt band "
            f"above the label {label!r}",
            report_id,
            page_index,
        )
    if len(within) > 1:
        raise ReceivingTableError(
            f"{len(within)} printed values sit above the label {label!r} within "
            f"{_KPI_X_TOLERANCE_PT} pt of its centre; the value is ambiguous",
            report_id,
            page_index,
        )
    return int(within[0][4])


def _panel_title(
    rect: "pymupdf.Rect", words: "list[tuple[float, float, float, float, str]]"
) -> "tuple[str, list]":
    """The title printed immediately above `rect`, and the words that make it up.

    Title association is geometric only in the weak sense the page itself fixes: the
    words sit in a band just above the frame's top edge and inside its x-span. What the
    panel holds is then read from those words through a frozen label map — text-anchored
    typing, never "the left panel is inside shape" (AD-8; the Story 1.12 precedent).
    """
    band = [
        word
        for word in words
        if rect.y0 - _TITLE_BAND_PT < word[3] <= rect.y0 + 1
        and word[0] >= rect.x0 - _TITLE_X_MARGIN_PT
        and word[2] <= rect.x1 + _TITLE_X_MARGIN_PT
    ]
    band.sort(key=lambda word: word[0])
    return " ".join(word[4] for word in band), band


def _rotated_lines(
    page: "pymupdf.Page",
) -> "list[tuple[str, tuple[float, float], float, float]]":
    """Every rotated text line as (text, writing-direction vector, centre x, centre y).

    Read from `get_text("dict")` rather than `get_text("words")` because the direction
    vector is a property of the line, and the `DIRECTION` assertion is entirely about it.
    """
    found: list[tuple[str, tuple[float, float], float, float]] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if not text:
                continue
            direction = tuple(line["dir"])
            # Tolerance, not bit-exact equality (2026-07-27 review patch): this module
            # documents 250 lines up that `dir` is computed from the text matrix and
            # carries float noise (the corpus prints 6.1e-17, not a clean 0.0), and then
            # filtered the common case on `== (1.0, 0.0)`. A horizontal line whose matrix
            # produced (1.0, -0.0)-style noise was treated as ROTATED and fed to both
            # `_pitch_thirds` (which bounds on centre y only) and
            # `_assert_panel_orientation` (which counts `DIRECTION` labels) — a spurious
            # typed layout error, or a third label admitted from anywhere on the page.
            if all(
                abs(component - expected) <= _DIRECTION_TOLERANCE
                for component, expected in zip(direction, (1.0, 0.0))
            ):
                continue
            x0, y0, x1, y1 = line["bbox"]
            found.append((text, direction, (x0 + x1) / 2, (y0 + y1) / 2))
    return found

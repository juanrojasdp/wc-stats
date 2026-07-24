"""Crosses pitch-map parser: shared filter chain -> AD-6 cross events + counts.

The crosses section is ONE page per team (208/208 corpus pages, Task 1 probe): the
pitch map on the left, stat panels in the middle, and a per-player delivery-AGGREGATE
table on the right — there are no per-event rows and no on-marker ordinal glyphs, so no
marker-row linking pass exists for crosses. Events therefore carry `delivery_type: None`
(delivery types are per-player aggregates only) and the parsed table rows are staged
verbatim under `cross_table_rows` so later work has the raw material. The contract's
per-event `playerId`/`playerName`/`at`/`deliveryType` requirements are unfulfillable
from this page — the emission gap is ledgered in deferred-work.md for Story 1.16.

Outcome semantics, measured not assumed: the page legend is "Attempted" (orange) /
"Completed" (blue) — orange marks an attempted-but-not-completed cross — and the
contract models the outcome as `completed: boolean` (no CrossOutcome enum). The RGB
keying (FR-11: exact lookup, assert-on-unknown) targets those two internal keys and
each staged event carries the converted `completed: bool`, contract-shaped at staging.

Two corpus quirks the parser decodes (full 104-report census, Task 1):

- Touchline crosses: 9 pages print one real marker whose center sits <= 0.35 pt OUTSIDE
  the pitch rect. The spec's `pitch_margin_pt=1.0` admits them (shots keep 0.0), and the
  normalized coordinate clamps into the contract's [0, 100] (max overshoot 100.1).
- Two-tone double-draws: 16 pages render one event as an orange AND a blue marker at the
  BIT-IDENTICAL rect (blue drawn on top). That pair is ONE completed event. This is
  decoding a two-tone glyph, NOT marker dedup: real same-spot pairs always differ in
  position (>= 0.035 pt in the corpus) or share a color, and those are kept — two
  markers at one point remain two events (AD-8).

Pure: no I/O beyond the open `pymupdf.Document`. Story 1.11 Tasks 2-5.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from pipeline.ingest.identity import team_slug
from pipeline.markers.attempts import table_lines
from pipeline.markers.errors import (
    CrossesCoordinateError,
    CrossesPageLayoutError,
    CrossesTableError,
    UnknownLabelError,
)
from pipeline.markers.filter_chain import (
    KeyedMarker,
    MarkerSpec,
    collect_candidate_markers,
    detect_pitch_frame,
    exclude_legend_rows,
    key_outcomes,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# The crosses outcome palette, measured on the full corpus (Task 1: the ONLY two marker
# fills across all 208 pages). Keys are the page legend's own words, lowercased:
# "attempted" is drawn orange and means attempted-but-not-completed (completed crosses
# are drawn blue), so `completed = outcome == "completed"`.
CROSSES_RGB_TO_OUTCOME: dict[tuple[float, float, float], str] = {
    (0.96, 0.74, 0.00): "attempted",
    (0.18, 0.30, 1.00): "completed",
}

# Real cross markers are 7.4 x 7.4 pt filled Bezier circles with a white stroke; the
# legend swatches are 9.0 pt and strokeless. The size window is the legend defense: a
# two-color legend row can never reach `legend_min_colors` (kept at the shared default
# 4 — lowering it to 2 would delete real orange+blue pairs sharing a rounded y, e.g.
# M50's dy=0.035 pt pair), so `exclude_legend_rows` stays in the recipe as a no-op by
# construction. `pitch_margin_pt` admits the corpus' touchline-cross centers.
CROSSES_MARKER_SPEC = MarkerSpec(
    marker_min_pt=6.0,
    marker_max_pt=8.5,
    rgb_to_outcome=CROSSES_RGB_TO_OUTCOME,
    pitch_margin_pt=1.0,
)

# Delivery-type header label -> the contract's `CrossDeliveryType` enum. Frozen
# literals, never schema imports (the `DELIVERY_LABEL_TO_ENUM` precedent); a test
# cross-checks every value against contract/common.schema.json. The corpus prints the
# glued forms; the spaced variants are the contract's documented alternates
# (contract/README.md: "Inswing" and "In Swing" both normalize to the same code).
CROSS_DELIVERY_LABEL_TO_ENUM: dict[str, str] = {
    "Inswing": "inswing",
    "In Swing": "inswing",
    "Outswing": "outswing",
    "Out Swing": "outswing",
    "Driven": "driven",
    "Lofted": "lofted",
    "Cutback": "cutback",
    "Push Cross": "push-cross",
}

# The header word multiset of the delivery table, uniform on 208/208 corpus pages:
# one main line (# Player Inswing Outswing Driven Lofted Cutback) plus the stacked
# two-line "Push Cross" and "Total Attempted" column titles.
_HEADER_WORDS = (
    "#", "Player", "Inswing", "Outswing", "Driven", "Lofted", "Cutback",
    "Push", "Cross", "Total", "Attempted",
)

# The staged `deliveries` keys are the enum codes in snake_case (`push_cross`): work/
# staging is snake_case by rule (AD-9; kebab is reserved for page-family section
# names), and Story 1.16's emission maps them mechanically back to the contract's
# kebab codes through `CROSS_DELIVERY_LABEL_TO_ENUM`'s values.
_DELIVERY_COLUMN_ORDER = ("inswing", "outswing", "driven", "lofted", "cutback", "push_cross")

# `re.ASCII`: fullwidth digits otherwise satisfy `\d` and `int()` accepts them happily.
_DIGITS_RE = re.compile(r"\d+", re.ASCII)

# The header band spans the stacked titles (+-4 pt around the main line, corpus ~3.8);
# data rows start well below (first row ~22 pt under the header).
_HEADER_BAND_PT = 8.0

# The table region starts at the '#' column; left-panel words (bar-chart values, zone
# counts) share y-lines with table rows and must never enter row clustering.
_TABLE_X_MARGIN_PT = 10.0

# Name words may straddle the numeric row line (two-line names print at +-4.5 pt).
_NAME_Y_TOLERANCE_PT = 6.0
_NAME_X_MARGIN_PT = 5.0

# Stored coordinates are rounded to 2 decimals (PitchX/PitchY `x-decimals: 2`), then
# clamped into the contract's [0, 100]: a margin-admitted touchline cross normalizes
# to at most 100.1 before the clamp.
COORD_DECIMALS = 2

# Only the sub-tolerance touchline overshoot the 1.0 pt margin admits (<= ~0.4 beyond
# either edge; probe max 100.1) is clamped into [0, 100]. A pre-clamp value further out
# is a mis-normalization, not a real cross, and fails loud rather than being silently
# rewritten to a plausible boundary (Code Review 2026-07-24, decision on the AD-8
# tension of the original unconditional clamp).
COORD_CLAMP_TOLERANCE = 0.5


def parse_crosses(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: str,
    home_team: str,
    away_team: str,
) -> dict:
    """Extract both teams' crosses domain block from an open report.

    `anchors` is the record's anchor map (0-based page indices). Each team's
    `crosses:{side}` anchor must resolve to exactly one page; anything else raises
    `CrossesPageLayoutError`. Raises `PitchFrameError`, `UnknownRgbError` (FR-11),
    `CrossesTableError` and `UnknownLabelError`, all typed and report-scoped. A count
    mismatch is NOT an exception — it lands in `counts` for
    `crosses_self_validation_block` to judge.
    """
    events: list[dict] = []
    table_rows: dict[str, list[dict]] = {}
    counts: dict[str, dict[str, int]] = {}
    for side, team_name in (("home", home_team), ("away", away_team)):
        anchor_id = f"crosses:{side}"
        pages = anchors.get(anchor_id)
        if not isinstance(pages, list) or len(pages) != 1:
            raise CrossesPageLayoutError(anchor_id, pages, report_id)
        page_index = pages[0]

        page = doc[page_index]
        pitch = detect_pitch_frame(page, report_id)
        candidates = collect_candidate_markers(page.get_drawings(), pitch, CROSSES_MARKER_SPEC)
        markers = exclude_legend_rows(candidates, CROSSES_MARKER_SPEC)
        keyed = key_outcomes(markers, CROSSES_MARKER_SPEC, report_id, page_index)
        collapsed = _collapse_two_tone(keyed)

        rows = _cross_table_rows(page, report_id, page_index)

        team_id = team_slug(team_name)
        for marker in collapsed:
            x = round(100 * (pitch.y1 - marker.pdf_y) / pitch.height, COORD_DECIMALS)
            y = round(100 * (marker.pdf_x - pitch.x0) / pitch.width, COORD_DECIMALS)
            events.append(
                {
                    "team_id": team_id,
                    "x": _clamp_coord(x, "x", report_id, page_index),
                    "y": _clamp_coord(y, "y", report_id, page_index),
                    "completed": marker.outcome == "completed",
                    # No linking pass exists for crosses (aggregate table, no ordinal
                    # glyphs); the per-event delivery type is unrecoverable from this
                    # page — ledgered as a 1.16 emission gap in deferred-work.md.
                    "delivery_type": None,
                    "source": {
                        "page_index": page_index,
                        "pdf_x": round(marker.pdf_x, COORD_DECIMALS),
                        "pdf_y": round(marker.pdf_y, COORD_DECIMALS),
                    },
                }
            )
        table_rows[side] = rows
        counts[side] = {
            "markers": len(collapsed),
            # The page's own tabular total: the sum of the per-player Total Attempted
            # column (== the panel's printed Attempted on 208/208 corpus pages) —
            # never Key Statistics `crosses` (Domain B's scalar counts set-play
            # crosses too; this page is open play only).
            "table": sum(row["total_attempted"] for row in rows),
        }

    # Deterministic record order (AD-8): team, then map page, then pdf position.
    events.sort(
        key=lambda event: (
            event["team_id"],
            event["source"]["page_index"],
            event["source"]["pdf_y"],
            event["source"]["pdf_x"],
        )
    )
    return {"cross_events": events, "cross_table_rows": table_rows, "counts": counts}


def crosses_self_validation_block(counts: "dict[str, dict[str, int]]") -> list[dict]:
    """The record's per-team `crosses-marker-count` checks (FR-14, SM-C1, AD-8).

    Binary and exact — no tolerance, never loosened. Both counts are always recorded,
    pass or fail, matching the `shots-marker-count` shape so the manifest mirroring and
    `format_summary`'s count branch render it unchanged.
    """
    return [
        {
            "check": "crosses-marker-count",
            "team": side,
            "result": "pass" if side_counts["markers"] == side_counts["table"] else "fail",
            "marker_count": side_counts["markers"],
            "table_count": side_counts["table"],
        }
        for side, side_counts in (("home", counts["home"]), ("away", counts["away"]))
    ]


def _clamp_coord(value: float, axis: str, report_id: str, page_index: int) -> float:
    """Clamp a normalized coordinate into [0, 100] — but only the sub-tolerance overshoot.

    The 1.0 pt pitch margin admits real touchline crosses whose centers sit a fraction of
    a point beyond the frame (normalizing to at most ~100.1); those clamp cleanly. A value
    further out than `COORD_CLAMP_TOLERANCE` cannot come from an in-margin marker on a
    correctly detected frame — it is a mis-normalization (wrong/undersized pitch rect,
    orientation flip, a stray glyph through the margin) — so it raises rather than being
    silently rewritten to a plausible boundary (AD-8).
    """
    if value < -COORD_CLAMP_TOLERANCE or value > 100.0 + COORD_CLAMP_TOLERANCE:
        raise CrossesCoordinateError(axis, value, report_id, page_index)
    return min(100.0, max(0.0, value))


def _collapse_two_tone(keyed: "list[KeyedMarker]") -> "list[KeyedMarker]":
    """Collapse each attempted+completed pair at a bit-identical position into its
    completed member (drawn on top in the corpus).

    Exact float equality is the discriminator, deliberately: real same-spot pairs
    differ by >= 0.035 pt in the corpus, and anything looser would start deleting real
    events. Groups of any other shape — same-color coincidences, or a never-observed
    triple — are kept whole; if the page ever draws one, the count check fails loud
    rather than this function guessing.
    """
    positions: dict[tuple[float, float], list[int]] = {}
    for index, marker in enumerate(keyed):
        positions.setdefault((marker.pdf_x, marker.pdf_y), []).append(index)
    dropped: set[int] = set()
    for indices in positions.values():
        if len(indices) != 2:
            continue
        first, second = keyed[indices[0]], keyed[indices[1]]
        if {first.outcome, second.outcome} == {"attempted", "completed"}:
            dropped.add(indices[0] if first.outcome == "attempted" else indices[1])
    return [marker for index, marker in enumerate(keyed) if index not in dropped]


def _cross_table_rows(page: "pymupdf.Page", report_id: str, page_index: int) -> list[dict]:
    """The per-player delivery-aggregate rows, staged verbatim in printed order.

    House pattern with a crosses twist: rows cluster at the shared 3 pt tolerance
    (`table_lines`), but ONLY within the table's x-region — the left panels print
    bar-chart values and zone counts on the same y-lines as table rows, and an
    x-unrestricted leftmost-digit rule would admit them. The region is derived from the
    header's own '#' position, never hardcoded. Row admission: leftmost region word is
    a pure-ASCII-digit shirt number; each admitted row must then carry seven numeric
    tail cells (six delivery counts + Total Attempted) and a printed name in the name
    band within +-6 pt (two-line names straddle the row line at +-4.5 pt) — anything
    else is `CrossesTableError`. Zero admitted rows is a valid table.
    """
    lines = table_lines(page)
    words = [
        (x0, y0, text)
        for x0, y0, _x1, _y1, text, *_ in page.get_text("words")
        if text.strip()
    ]

    header_y, header_cells = _header_line(lines, report_id, page_index)
    table_x_min = min(x for x, word in header_cells if word == "#") - _TABLE_X_MARGIN_PT

    # The full stacked header band, x-restricted; validate vocabulary and column order
    # before reading any row.
    band = [
        (x0, text)
        for x0, y0, text in words
        if x0 >= table_x_min and abs(y0 - header_y) <= _HEADER_BAND_PT
    ]
    delivery_columns = _validate_header(band, report_id, page_index)

    player_x = next(x for x, word in band if word == "Player")
    delivery_x = next(x for x, word in band if word == "Inswing")
    name_band = (player_x - _NAME_X_MARGIN_PT, delivery_x - _TABLE_X_MARGIN_PT)

    rows: list[dict] = []
    for y, cells in lines:
        if y <= header_y + _HEADER_BAND_PT:
            continue
        region = [(x, word) for x, word in cells if x >= table_x_min]
        if not region or not _DIGITS_RE.fullmatch(region[0][1]):
            continue
        if len(region) < 8:
            raise CrossesTableError(
                f"row at y={y:.1f} has {len(region)} cells, expected a shirt number, "
                "a name and seven numeric columns",
                report_id,
                page_index,
            )
        tail = [word for _x, word in region[-7:]]
        if not all(_DIGITS_RE.fullmatch(word) for word in tail):
            raise CrossesTableError(
                f"row at y={y:.1f} tail cells {tail!r} are not all numeric",
                report_id,
                page_index,
            )
        values = [int(word) for word in tail]
        deliveries = dict(zip(delivery_columns, values[:6]))
        total = values[6]
        if total != sum(values[:6]):
            raise CrossesTableError(
                f"row at y={y:.1f} Total Attempted {total} != delivery sum "
                f"{sum(values[:6])}",
                report_id,
                page_index,
            )
        # Name words may straddle the row line (two-line names), so they are gathered
        # from the name x-band across neighbouring lines, in reading order.
        name_words = sorted(
            (y0, x0, text)
            for x0, y0, text in words
            if name_band[0] <= x0 < name_band[1] and abs(y0 - y) <= _NAME_Y_TOLERANCE_PT
        )
        if not name_words:
            raise CrossesTableError(
                f"row at y={y:.1f} (shirt {region[0][1]}) has no player name in the "
                "name column",
                report_id,
                page_index,
            )
        rows.append(
            {
                "shirt_number": int(region[0][1]),
                "player_name": " ".join(text for _y, _x, text in name_words),
                "deliveries": deliveries,
                "total_attempted": total,
            }
        )
    return rows


def _header_line(
    lines: "list[tuple[float, list[tuple[float, str]]]]", report_id: str, page_index: int
) -> "tuple[float, list[tuple[float, str]]]":
    """The single line carrying both 'Player' and 'Inswing' — the table's main header.

    'Inswing' alone also appears in the left Delivery Type panel and 'Attempted' in
    two panels, but only the table header prints Player and Inswing together.
    """
    matches = [
        (y, cells)
        for y, cells in lines
        if any(word == "Player" for _x, word in cells)
        and any(word == "Inswing" for _x, word in cells)
    ]
    if not matches:
        raise CrossesTableError(
            "no header line containing both 'Player' and 'Inswing' found",
            report_id,
            page_index,
        )
    if len(matches) > 1:
        raise CrossesTableError(
            f"{len(matches)} header-shaped lines found; the crosses table is ambiguous",
            report_id,
            page_index,
        )
    header_y, cells = matches[0]
    if sum(1 for _x, word in cells if word == "#") != 1:
        raise CrossesTableError(
            "header line does not carry exactly one '#' column title; the table "
            "region cannot be derived",
            report_id,
            page_index,
        )
    return header_y, cells


def _validate_header(
    band: "list[tuple[float, str]]", report_id: str, page_index: int
) -> list[str]:
    """The header band must carry exactly the known word multiset, in column x-order;
    returns the staged delivery-column keys through the frozen label map.

    An unknown word is `UnknownLabelError` (assert-on-unknown, the FR-11 rule applied
    to labels); a missing or duplicated known word, or delivery columns out of the
    frozen order, is `CrossesTableError` — either way a template revision fails loud
    before a single row is misread.
    """
    expected = set(_HEADER_WORDS)
    for _x, word in band:
        if word not in expected:
            raise UnknownLabelError("Delivery Type header", word, page_index, report_id)
    found = [word for _x, word in band]
    missing = [word for word in _HEADER_WORDS if word not in found]
    duplicated = sorted({word for word in found if found.count(word) > 1})
    if missing or duplicated:
        raise CrossesTableError(
            f"header words missing {missing!r} / duplicated {duplicated!r}",
            report_id,
            page_index,
        )
    by_word = {word: x for x, word in band}
    column_xs = [
        by_word["Inswing"], by_word["Outswing"], by_word["Driven"],
        by_word["Lofted"], by_word["Cutback"], by_word["Push"], by_word["Total"],
    ]
    if column_xs != sorted(column_xs):
        raise CrossesTableError(
            f"delivery columns out of x-order ({column_xs}); the frozen column order "
            "cannot be applied",
            report_id,
            page_index,
        )
    # The validated printed order, through the frozen map, as snake_case staging keys.
    ordered_labels = ("Inswing", "Outswing", "Driven", "Lofted", "Cutback", "Push Cross")
    return [
        CROSS_DELIVERY_LABEL_TO_ENUM[label].replace("-", "_") for label in ordered_labels
    ]

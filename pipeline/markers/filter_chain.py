"""The shared core filter chain for pitch-map marker extraction (AD-9, FR-9).

Defends against the dark-blue collision: the "incomplete" marker blue is reused by
table-header rectangles, so color alone must never admit a marker. The recipe is
therefore a fixed order — pitch-frame detect, circle-geometry filter, legend-row
exclusion, exact-RGB outcome keying — with geometry strictly before color. The order is
an invariant, not a style choice; each stage is a separately testable function.

Recipe vs tuning: the stages and their order are shared by every map parser (shots now;
crosses, defensive actions, offers/movement in Stories 1.11-1.13), while the per-family
values — marker size window, outcome palette — live in a frozen `MarkerSpec`.

No dedup anywhere: two markers at the same point are two events (AD-8; six-yard-box
pileups are real). Story 1.3 Task 1; ACs 1, 3.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

import pymupdf

from pipeline.markers.errors import PitchFrameError, UnknownRgbError

# Pitch-frame area window, in pt^2 / page-area fraction. Spike-derived thresholds
# (spike/extract.py): the frame is the largest rectangle bigger than any table cell or
# side panel but smaller than the page border. The real frame is ~188,000 pt^2 on a
# 518,400 pt^2 page; the summary side panel is ~55,600 pt^2, so "largest qualifying"
# picks the frame with a 3x margin.
PITCH_MIN_AREA_PT = 10000
PITCH_MAX_PAGE_AREA_FRACTION = 0.8

# Fill RGB channels are rounded to 2 decimals before the exact palette lookup — the
# spike-proven keying rule, and what `UnknownRgbError` reports.
RGB_DECIMALS = 2

# Legend grouping rounds marker y to 1 decimal: legend circles share a y to sub-pt
# precision, real markers land on arbitrary fractional positions.
LEGEND_Y_DECIMALS = 1


@dataclass(frozen=True)
class MarkerSpec:
    """Per-marker-family tuning for the shared chain (frozen: tuning, never recipe).

    Shots values: min 8.0, max 15.0 (real markers are 11.25 x 11.25 pt filled Bezier
    circles with a white stroke), the five-color outcome palette, legend_min_colors 4.
    Stories 1.11-1.13 instantiate their own.
    """

    marker_min_pt: float
    marker_max_pt: float
    rgb_to_outcome: "Mapping[tuple[float, float, float], str]"
    # A legend row is a group of circles sharing one rounded y that shows at least this
    # many distinct fill colors. 4+ distinct outcome colors at one identical y is
    # implausible for real events — spike-validated on the shots maps.
    legend_min_colors: int = 4
    # How far outside the pitch rect a marker center may sit and still be admitted
    # (Story 1.11): touchline/goal-line crosses print centers up to 0.35 pt beyond the
    # frame on 9 corpus pages. The default 0.0 preserves the strict containment the
    # shots parser shipped with, byte-identically.
    pitch_margin_pt: float = 0.0


@dataclass(frozen=True)
class CandidateMarker:
    """A marker-shaped filled circle inside the pitch, before outcome keying."""

    pdf_x: float
    pdf_y: float
    rgb: "tuple[float, ...]"  # rounded to RGB_DECIMALS


@dataclass(frozen=True)
class KeyedMarker:
    """A candidate whose fill keyed exactly to an outcome."""

    pdf_x: float
    pdf_y: float
    rgb: "tuple[float, ...]"
    outcome: str


def detect_pitch_frame(page: "pymupdf.Page", report_id: str | None = None) -> pymupdf.Rect:
    """Stage 1: the largest *stroked* sub-page rectangle drawing — the AD-6 basis.

    The pitch rect extends below the visible page clip on the real reports; that full
    rectangle, not the visible part, is what marker positions are normalized against.
    Stroked is part of the recipe (Dev Notes stage 1): the frame is drawn as an outline,
    and a fill-only band — a chart background, a shaded panel — must never outcompete it
    as the normalization basis. Raises `PitchFrameError` when no rectangle falls in the
    area window: a map page without a pitch frame is a template revision, never a skip.
    """
    page_area = page.rect.get_area()
    candidates: list[pymupdf.Rect] = []
    for drawing in page.get_drawings():
        if drawing.get("color") is None:
            continue
        for item in drawing["items"]:
            if item[0] != "re":
                continue
            rect = pymupdf.Rect(item[1])
            area = rect.get_area()
            if PITCH_MIN_AREA_PT < area < PITCH_MAX_PAGE_AREA_FRACTION * page_area:
                candidates.append(rect)
    if not candidates:
        raise PitchFrameError(
            f"no rectangle with area in ({PITCH_MIN_AREA_PT}, "
            f"{PITCH_MAX_PAGE_AREA_FRACTION} x page area)",
            report_id,
            page.number,
        )
    return max(candidates, key=lambda rect: rect.get_area())


def collect_candidate_markers(
    drawings: "list[dict]", pitch: pymupdf.Rect, spec: MarkerSpec
) -> list[CandidateMarker]:
    """Stage 2: filled all-Bezier circles in the size window, centered inside the pitch.

    This geometry stage is what kills the dark-blue collision: header rectangles are
    `"re"` items, the wrong size, and/or outside the pitch — they never reach the color
    stage. Fill values are rounded here, once, so the legend and keying stages see the
    same tuple `UnknownRgbError` would report.

    Containment is judged against the pitch expanded by `spec.pitch_margin_pt` (0.0 for
    shots — strict, unchanged): the crosses corpus prints touchline-cross centers a
    fraction of a point outside the frame, and those are real events, not noise.
    """
    zone = pitch
    if spec.pitch_margin_pt > 0:
        margin = spec.pitch_margin_pt
        zone = pymupdf.Rect(
            pitch.x0 - margin, pitch.y0 - margin, pitch.x1 + margin, pitch.y1 + margin
        )
    found: list[CandidateMarker] = []
    for drawing in drawings:
        fill = drawing.get("fill")
        if fill is None:
            continue
        items = drawing["items"]
        if not items or not all(item[0] == "c" for item in items):
            continue
        rect = drawing["rect"]
        if not (
            spec.marker_min_pt <= rect.width <= spec.marker_max_pt
            and spec.marker_min_pt <= rect.height <= spec.marker_max_pt
        ):
            continue
        center_x = (rect.x0 + rect.x1) / 2
        center_y = (rect.y0 + rect.y1) / 2
        if not zone.contains(pymupdf.Point(center_x, center_y)):
            continue
        found.append(
            CandidateMarker(
                pdf_x=center_x,
                pdf_y=center_y,
                rgb=tuple(round(channel, RGB_DECIMALS) for channel in fill),
            )
        )
    return found


def legend_row_ys(candidates: list[CandidateMarker], spec: MarkerSpec) -> set[float]:
    """The rounded y values of legend rows: >= `legend_min_colors` distinct fills at one y.

    Exposed separately from `exclude_legend_rows` (Story 1.5): digit-glyph linking must
    ignore any digit word sitting in the legend band, and the band's position is defined
    by exactly this grouping — one definition, two consumers.
    """
    groups: dict[float, list[CandidateMarker]] = {}
    for candidate in candidates:
        groups.setdefault(round(candidate.pdf_y, LEGEND_Y_DECIMALS), []).append(candidate)
    return {
        y
        for y, group in groups.items()
        if len({candidate.rgb for candidate in group}) >= spec.legend_min_colors
    }


def exclude_legend_rows(
    candidates: list[CandidateMarker], spec: MarkerSpec
) -> list[CandidateMarker]:
    """Stage 3: drop whole rows of >= `legend_min_colors` distinct colors at one y.

    Distinctness is judged on the rounded fill tuples, not on palette membership, so a
    legend containing a color the palette does not know still reads as a legend instead
    of surviving into keying and aborting the report.
    """
    legend_ys = legend_row_ys(candidates, spec)
    return [
        candidate
        for candidate in candidates
        if round(candidate.pdf_y, LEGEND_Y_DECIMALS) not in legend_ys
    ]


def key_outcomes(
    markers: list[CandidateMarker],
    spec: MarkerSpec,
    report_id: str | None = None,
    page_index: int | None = None,
) -> list[KeyedMarker]:
    """Stage 4: exact lookup of each rounded fill in the outcome palette (AC 3).

    A miss raises `UnknownRgbError` with the RGB tuple and page — never a nearest-color
    match, never a dropped marker. Runs last by design: color must never be used to
    filter, only to name what geometry already admitted.
    """
    keyed: list[KeyedMarker] = []
    for marker in markers:
        outcome = spec.rgb_to_outcome.get(marker.rgb)
        if outcome is None:
            raise UnknownRgbError(marker.rgb, page_index, report_id)
        keyed.append(
            KeyedMarker(pdf_x=marker.pdf_x, pdf_y=marker.pdf_y, rgb=marker.rgb, outcome=outcome)
        )
    return keyed

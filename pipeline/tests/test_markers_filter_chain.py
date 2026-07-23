"""Task 1: the shared marker filter chain, one stage at a time (AC 1, AC 3).

Every page here is a hand-built vector page: the branch coverage the reviewer
cross-checks (geometry-before-color, legend exclusion, no dedup, unknown RGB) must be
demonstrated on drawings whose shapes the test itself chose, never inferred from the
ground-truth PDF (AR-16 keeps that fixture counts-only).
"""

from __future__ import annotations

import dataclasses

import pymupdf
import pytest

from pipeline.errors import PipelineError
from pipeline.markers.errors import (
    AttemptsTableError,
    MarkerError,
    PitchFrameError,
    ShotsPageLayoutError,
    UnknownRgbError,
)
from pipeline.markers.filter_chain import (
    PITCH_MIN_AREA_PT,
    MarkerSpec,
    collect_candidate_markers,
    detect_pitch_frame,
    exclude_legend_rows,
    key_outcomes,
)

PAGE_WIDTH, PAGE_HEIGHT = 960, 540
PITCH = pymupdf.Rect(40, 115, 400, 520)

DARK_BLUE = (0.18, 0.30, 1.00)
GREEN = (0.00, 0.50, 0.00)
LIGHT_BLUE = (0.36, 0.61, 0.84)
AMBER = (0.96, 0.74, 0.00)

SPEC = MarkerSpec(
    marker_min_pt=8.0,
    marker_max_pt=15.0,
    rgb_to_outcome={
        GREEN: "goal",
        LIGHT_BLUE: "on-target",
        AMBER: "off-target",
        DARK_BLUE: "incomplete",
    },
)

MARKER_RADIUS = 5.625  # 11.25 pt diameter, the real markers' size


def make_page(doc: "pymupdf.Document | None" = None) -> pymupdf.Page:
    doc = doc if doc is not None else pymupdf.open()
    page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    page.draw_rect(PITCH, color=(1, 1, 1))
    return page


def draw_marker(page: pymupdf.Page, x: float, y: float, rgb: tuple) -> None:
    page.draw_circle((x, y), MARKER_RADIUS, color=(1, 1, 1), fill=rgb, width=0.75)


def chain_candidates(page: pymupdf.Page, spec: MarkerSpec = SPEC):
    pitch = detect_pitch_frame(page, report_id="r1")
    return pitch, collect_candidate_markers(page.get_drawings(), pitch, spec)


# --- error taxonomy ---------------------------------------------------------------


def test_every_marker_error_is_a_typed_pipeline_error_carrying_the_report_id():
    errors = [
        PitchFrameError("no rectangle qualifies", "r1", page_index=13),
        UnknownRgbError((0.5, 0.5, 0.5), 13, "r1"),
        AttemptsTableError("no header row", "r1", page_index=14),
        ShotsPageLayoutError("shots:home", [13], "r1"),
    ]
    for error in errors:
        assert isinstance(error, MarkerError)
        assert isinstance(error, PipelineError)
        assert error.report_id == "r1"
        assert str(error).startswith("[r1] ")


def test_unknown_rgb_error_carries_the_rounded_rgb_and_page_index():
    """AC 3 names both: the RGB value and the page must be in the error."""
    error = UnknownRgbError((0.5, 0.51, 0.52), 13, "r1")

    assert error.rgb == (0.5, 0.51, 0.52)
    assert error.page_index == 13
    assert "(0.5, 0.51, 0.52)" in str(error)
    assert "13" in str(error)


def test_shots_page_layout_error_carries_the_anchor_id_and_page_list():
    error = ShotsPageLayoutError("shots:away", [3, 4, 5], "r1")

    assert error.anchor_id == "shots:away"
    assert error.pages == [3, 4, 5]
    assert "shots:away" in str(error)
    assert "[3, 4, 5]" in str(error)


# --- stage 1: pitch-frame detection -----------------------------------------------


def test_detect_pitch_frame_finds_the_largest_qualifying_rectangle():
    page = make_page()
    page.draw_rect(pymupdf.Rect(500, 115, 700, 300), color=(1, 1, 1))  # smaller panel

    pitch = detect_pitch_frame(page, report_id="r1")

    assert pitch == PITCH


def test_detect_pitch_frame_ignores_the_full_page_rectangle():
    """The page border fails the < 0.8 x page-area ceiling; the pitch wins."""
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    page.draw_rect(page.rect, color=(0, 0, 0))
    page.draw_rect(PITCH, color=(1, 1, 1))

    assert detect_pitch_frame(page, report_id="r1") == PITCH


def test_detect_pitch_frame_fails_loud_on_a_page_with_no_qualifying_rectangle():
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    page.draw_rect(pymupdf.Rect(10, 10, 60, 60), color=(0, 0, 0))  # below the area floor

    with pytest.raises(PitchFrameError) as excinfo:
        detect_pitch_frame(page, report_id="r1")

    assert excinfo.value.page_index == page.number
    assert "r1" in str(excinfo.value)


def test_a_larger_fill_only_rectangle_does_not_outcompete_the_stroked_pitch():
    """Stage 1 is 'largest *stroked* rectangle' (Dev Notes): a fill-only band bigger than
    the pitch must not become the normalization basis."""
    page = make_page()
    page.draw_rect(
        pymupdf.Rect(420, 40, 950, 530), color=None, fill=(0.9, 0.9, 0.9)
    )  # bigger, fill-only: draw_rect strokes in black unless color is explicitly None

    assert detect_pitch_frame(page, report_id="r1") == PITCH


def test_pitch_area_floor_is_the_spike_threshold():
    assert PITCH_MIN_AREA_PT == 10000


# --- stage 2: circle-geometry filter ----------------------------------------------


def test_dark_blue_header_rectangle_yields_zero_false_markers():
    """The AC 1 collision: geometry runs before color, so the table-header rectangle
    sharing the 'incomplete' dark blue is rejected as a non-circle, not admitted by fill.
    """
    page = make_page()
    page.draw_rect(pymupdf.Rect(60, 130, 204, 148), fill=DARK_BLUE)  # header-sized, in pitch

    _, candidates = chain_candidates(page)

    assert candidates == []


def test_dark_blue_circle_outside_the_pitch_is_rejected():
    page = make_page()
    draw_marker(page, 700, 300, DARK_BLUE)  # marker-sized, marker-shaped, wrong place

    _, candidates = chain_candidates(page)

    assert candidates == []


def test_dark_blue_circle_inside_the_pitch_at_marker_size_is_one_incomplete_marker():
    page = make_page()
    draw_marker(page, 200, 300, DARK_BLUE)

    _, candidates = chain_candidates(page)
    keyed = key_outcomes(candidates, SPEC, report_id="r1", page_index=page.number)

    assert [marker.outcome for marker in keyed] == ["incomplete"]


def test_circles_outside_the_size_window_are_rejected():
    page = make_page()
    page.draw_circle((200, 300), 3.0, color=(1, 1, 1), fill=GREEN, width=0.75)  # too small
    page.draw_circle((300, 300), 30.0, color=(1, 1, 1), fill=GREEN, width=0.75)  # too big

    _, candidates = chain_candidates(page)

    assert candidates == []


def test_unfilled_circles_are_rejected():
    page = make_page()
    page.draw_circle((200, 300), MARKER_RADIUS, color=(1, 1, 1), width=0.75)

    _, candidates = chain_candidates(page)

    assert candidates == []


def test_candidate_rgb_is_rounded_to_two_decimals():
    page = make_page()
    draw_marker(page, 200, 300, (0.184, 0.304, 0.996))

    _, candidates = chain_candidates(page)

    assert [candidate.rgb for candidate in candidates] == [(0.18, 0.30, 1.00)]


# --- stage 3: legend-row exclusion ------------------------------------------------


def test_a_row_of_four_distinct_colors_at_one_y_is_dropped_whole():
    page = make_page()
    for i, rgb in enumerate((GREEN, LIGHT_BLUE, AMBER, DARK_BLUE)):
        draw_marker(page, 80 + i * 60, 500, rgb)  # inside the pitch, one shared y
    draw_marker(page, 200, 300, GREEN)  # a real marker elsewhere

    _, candidates = chain_candidates(page)
    kept = exclude_legend_rows(candidates, SPEC)

    assert len(candidates) == 5
    assert [marker.rgb for marker in kept] == [GREEN]


def test_a_three_color_row_is_kept_it_is_data_not_a_legend():
    page = make_page()
    for i, rgb in enumerate((GREEN, LIGHT_BLUE, AMBER)):
        draw_marker(page, 80 + i * 60, 500, rgb)

    _, candidates = chain_candidates(page)
    kept = exclude_legend_rows(candidates, SPEC)

    assert len(kept) == 3


def test_a_legend_row_containing_an_off_palette_color_still_reads_as_a_legend():
    """Distinctness is judged on rounded fill tuples, not palette membership: a legend
    carrying a swatch the palette does not know must still be excluded whole, instead of
    surviving into keying and aborting the report as `UnknownRgbError`."""
    page = make_page()
    for i, rgb in enumerate((GREEN, LIGHT_BLUE, AMBER, (0.5, 0.5, 0.5))):
        draw_marker(page, 80 + i * 60, 500, rgb)
    draw_marker(page, 200, 300, GREEN)  # a real marker elsewhere

    _, candidates = chain_candidates(page)
    kept = exclude_legend_rows(candidates, SPEC)
    keyed = key_outcomes(kept, SPEC, report_id="r1", page_index=page.number)

    assert [marker.outcome for marker in keyed] == ["goal"]


def test_four_same_color_markers_at_one_y_are_kept():
    """A goal-line scramble can put four shots on one y; only color diversity marks a legend."""
    page = make_page()
    for i in range(4):
        draw_marker(page, 80 + i * 60, 500, AMBER)

    _, candidates = chain_candidates(page)
    kept = exclude_legend_rows(candidates, SPEC)

    assert len(kept) == 4


# --- stage 4: exact-RGB outcome keying --------------------------------------------


def test_overlapping_markers_are_both_kept_never_deduped():
    """AD-8: each source drawing is one event; six-yard-box pileups are real."""
    page = make_page()
    draw_marker(page, 200, 300, AMBER)
    draw_marker(page, 200, 300, AMBER)

    _, candidates = chain_candidates(page)
    keyed = key_outcomes(candidates, SPEC, report_id="r1", page_index=page.number)

    assert len(keyed) == 2


def test_an_off_palette_fill_aborts_with_the_rgb_and_page_in_the_error():
    page = make_page()
    draw_marker(page, 200, 300, (0.5, 0.5, 0.5))

    _, candidates = chain_candidates(page)

    with pytest.raises(UnknownRgbError) as excinfo:
        key_outcomes(candidates, SPEC, report_id="r1", page_index=page.number)

    assert excinfo.value.rgb == (0.5, 0.5, 0.5)
    assert excinfo.value.page_index == page.number


def test_keying_is_exact_lookup_never_nearest_match():
    page = make_page()
    draw_marker(page, 200, 300, (0.17, 0.30, 1.00))  # one hundredth off the palette blue

    _, candidates = chain_candidates(page)

    with pytest.raises(UnknownRgbError):
        key_outcomes(candidates, SPEC, report_id="r1", page_index=page.number)


def test_marker_spec_is_frozen_tuning_not_recipe():
    with pytest.raises(dataclasses.FrozenInstanceError):
        SPEC.marker_min_pt = 1.0

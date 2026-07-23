"""Tasks 1-2: extract package errors and lineup-page visual-line reconstruction (AC 1).

The boundary tests exist because deferred-work.md flags the probe's tolerances as
unvalidated at the edge: a 1.0pt gap fuses words and a >3.0pt font delta splits lines.
The lineup variant inherits both constants, so its edges are pinned here.
"""

from __future__ import annotations

import pytest

from pipeline.errors import PipelineError
from pipeline.extract.errors import (
    ExtractError,
    LineupCountError,
    LineupParseError,
    MissingFieldError,
    UnknownMinuteGlyphError,
    UnknownPositionError,
    UnknownStageError,
    UnknownVenueError,
)
from pipeline.extract.lines import TextSpan, group_rows, join_spans, text_spans

ALL_ERRORS = (
    MissingFieldError,
    LineupParseError,
    UnknownPositionError,
    UnknownStageError,
    UnknownVenueError,
    UnknownMinuteGlyphError,
    LineupCountError,
)


# --- errors ----------------------------------------------------------------------


@pytest.mark.parametrize("error_class", ALL_ERRORS)
def test_every_extract_error_is_a_pipeline_error_carrying_the_report_id(error_class):
    exc = error_class("something went wrong", "PMSR-M01-MEX-V-RSA")
    assert isinstance(exc, ExtractError)
    assert isinstance(exc, PipelineError)
    assert exc.report_id == "PMSR-M01-MEX-V-RSA"
    assert "[PMSR-M01-MEX-V-RSA]" in str(exc)
    assert "something went wrong" in str(exc)


@pytest.mark.parametrize("error_class", ALL_ERRORS)
def test_extract_errors_tolerate_an_unknown_report_id(error_class):
    exc = error_class("reason", None)
    assert "<unknown report>" in str(exc)


def test_missing_field_error_message_carries_the_field_name():
    """AC 1: any missing field fails loud *with the field named*."""
    exc = MissingFieldError("domain A field missing: lineups.home.formation", "PMSR-X")
    assert "lineups.home.formation" in str(exc)


# --- span collection -------------------------------------------------------------


def _page_with(texts_at):
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    for (x, y), text in texts_at:
        page.insert_text((x, y), text, fontsize=10)
    return doc, page


def test_text_spans_returns_positioned_spans_and_drops_blank_ones():
    doc, page = _page_with([((50, 100), "GK"), ((87, 100), "Raul RANGEL"), ((300, 200), "   ")])
    try:
        spans = text_spans(page)
        texts = [span.text for span in spans]
        assert "GK" in texts
        assert any("RANGEL" in text for text in texts)
        assert all(text.strip() for text in texts)
        for span in spans:
            assert span.x0 < span.x1
            assert span.y0 < span.y1
    finally:
        doc.close()


# --- row grouping boundaries -----------------------------------------------------


def _span(x0, y0, text, width=20.0, height=10.0):
    return TextSpan(x0=x0, y0=y0, x1=x0 + width, y1=y0 + height, text=text)


def test_spans_within_the_tolerance_share_a_row():
    rows = group_rows([_span(50, 100.0, "a"), _span(80, 102.9, "b")])
    assert len(rows) == 1
    assert [span.text for span in rows[0].spans] == ["a", "b"]


def test_spans_just_past_the_tolerance_split_into_two_rows():
    rows = group_rows([_span(50, 100.0, "a"), _span(80, 103.1, "b")])
    assert [[span.text for span in row.spans] for row in rows] == [["a"], ["b"]]


def test_row_anchor_is_the_first_span_and_rows_come_back_top_to_bottom():
    rows = group_rows([_span(50, 200.0, "low"), _span(50, 100.0, "high")])
    assert [row.spans[0].text for row in rows] == ["high", "low"]
    assert rows[0].y == 100.0


def test_rows_sort_their_spans_left_to_right():
    rows = group_rows([_span(300, 100.0, "right"), _span(50, 100.1, "left")])
    assert [span.text for span in rows[0].spans] == ["left", "right"]


# --- span joining boundaries -----------------------------------------------------


def test_join_restores_a_space_across_a_wide_gap():
    left = _span(50, 100, "Raul", width=30)
    right = _span(50 + 30 + 1.1, 100, "RANGEL")
    assert join_spans([left, right]) == "Raul RANGEL"


def test_join_keeps_abutting_spans_glued():
    """The away column prints hyphenated names as abutting spans: 'AIT' '-' 'NOURI'."""
    a = _span(87, 100, "Rayan AIT", width=49.9)
    hyphen = _span(136.0, 100, "-", width=3.6)
    b = _span(139.5, 100, "NOURI", width=30)
    assert join_spans([a, hyphen, b]) == "Rayan AIT-NOURI"


def test_join_collapses_whitespace_the_spans_carry_themselves():
    a = _span(50, 100, "GK", width=14)
    b = _span(64.0, 100, " 15")  # glued span with its own leading space
    assert join_spans([a, b]) == "GK 15"


def test_join_is_input_order_independent():
    spans = [_span(120, 100, "world"), _span(50, 100, "hello", width=30)]
    assert join_spans(spans) == join_spans(list(reversed(spans))) == "hello world"

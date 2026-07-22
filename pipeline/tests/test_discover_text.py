"""Task 2: whitespace-normalized text search and fail-loud anchor discovery (AC 4)."""

from __future__ import annotations

import pytest

from pipeline.discover.errors import MissingAnchorError
from pipeline.discover.text import (
    PageTextIndex,
    find_anchor_pages,
    find_first_anchor_page,
    normalize,
    page_text,
)


def test_normalize_collapses_all_whitespace():
    assert normalize("  Attempts   at\nGoal\tMexico \r\n") == "Attempts at Goal Mexico"
    assert normalize("") == ""


def test_normalize_strips_invisible_formatting_characters():
    """PDF extraction emits ZWSP and soft hyphens; str.split does not touch them."""
    assert normalize("Line​Breaks") == "LineBreaks"
    assert normalize("Goal­keeping Mexico") == "Goalkeeping Mexico"
    assert normalize("a​ b") == "a b"


def test_normalize_unifies_composed_and_decomposed_accents():
    """NFC vs NFD would otherwise split one venue into two stratification keys."""
    composed = "México City Stadium"       # é as one code point
    decomposed = "México City Stadium"    # e + combining acute

    assert normalize(composed) == normalize(decomposed)


def test_normalize_does_not_collapse_anything_semantic():
    """A venue the corpus genuinely prints two ways must still read as a deviation."""
    assert normalize("Türkiye") != normalize("Turkiye")
    assert normalize("Estadio Azteca") != normalize("estadio azteca")


def test_page_text_is_normalized(mex_rsa_pdf):
    import pymupdf

    with pymupdf.open(mex_rsa_pdf) as doc:
        text = page_text(doc[0])

    assert "POST MATCH SUMMARY REPORT" in text
    assert "  " not in text
    assert "\n" not in text


def test_find_anchor_pages_locates_shots_page_by_text_not_index(mex_rsa_pdf):
    """The spike proved this anchor; it embeds the team name, hence templated specs."""
    import pymupdf

    with pymupdf.open(mex_rsa_pdf) as doc:
        pages = find_anchor_pages(doc, "Attempts at Goal Mexico")

    # Pitch-map page plus its event-table page.
    assert pages == [13, 14]


def test_find_first_anchor_page_short_circuits(mex_rsa_pdf):
    import pymupdf

    with pymupdf.open(mex_rsa_pdf) as doc:
        assert find_first_anchor_page(doc, "POST MATCH SUMMARY REPORT") == 0


def test_missing_anchor_raises_typed_error_with_report_id_and_anchor(mex_rsa_pdf):
    import pymupdf

    with pymupdf.open(mex_rsa_pdf) as doc:
        with pytest.raises(MissingAnchorError) as excinfo:
            find_anchor_pages(doc, "Definitely Not A Section Title", report_id="mex_rsa")

    err = excinfo.value
    assert err.report_id == "mex_rsa"
    assert err.anchor_text == "Definitely Not A Section Title"
    assert "mex_rsa" in str(err)
    assert "Definitely Not A Section Title" in str(err)


def test_find_first_anchor_page_missing_raises(mex_rsa_pdf):
    import pymupdf

    with pymupdf.open(mex_rsa_pdf) as doc:
        with pytest.raises(MissingAnchorError):
            find_first_anchor_page(doc, "No Such Anchor", report_id="mex_rsa")


def test_page_text_index_matches_the_walking_search(mex_rsa_pdf):
    """The cached index must not change what discovery finds — only how fast."""
    import pymupdf

    with pymupdf.open(mex_rsa_pdf) as doc:
        index = PageTextIndex(doc, report_id="mex_rsa")

        assert len(index) == doc.page_count
        assert index.find_all("Attempts at Goal Mexico") == find_anchor_pages(
            doc, "Attempts at Goal Mexico"
        )
        assert index.find_first("POST MATCH SUMMARY REPORT") == 0


def test_page_text_index_reports_missing_anchors_with_context(mex_rsa_pdf):
    import pymupdf

    with pymupdf.open(mex_rsa_pdf) as doc:
        index = PageTextIndex(doc, report_id="mex_rsa")
        with pytest.raises(MissingAnchorError) as excinfo:
            index.find_all("Nowhere To Be Found")

    assert excinfo.value.report_id == "mex_rsa"
    assert excinfo.value.anchor_text == "Nowhere To Be Found"

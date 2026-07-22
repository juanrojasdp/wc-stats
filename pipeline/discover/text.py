"""Whitespace-normalized, text-anchored page discovery.

AD-8: pages are located by searching normalized page text for section anchors, never by
page index. The PDF header lies about the page count (claims 8, reports run ~52), so any
index-based addressing is wrong by construction. A missing anchor raises
`MissingAnchorError` — never a silent skip.

Technique proven by the spike (`spike/census.py`): `page.get_text()` collapsed with
`" ".join(text.split())`, then substring match. Matching is case-sensitive, but that is
*not* enough on its own: `"IN POSSESSION Mexico v South Africa"` is a literal substring of
the upper-case divider `"INDIVIDUAL DATA IN POSSESSION Mexico v South Africa"`, so a page
title must be matched with `at_start=True` (see `AnchorSpec.at_page_start`). Plain
substring matching stays the default for section titles that appear mid-page.
"""

from __future__ import annotations

import unicodedata
from typing import TYPE_CHECKING

from pipeline.discover.errors import MissingAnchorError

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf


def normalize(text: str) -> str:
    """Collapse whitespace, apply NFC, and drop invisible formatting characters.

    PDF text extraction emits zero-width spaces, soft hyphens and other Unicode `Cf`
    characters that `str.split` does not touch, and the same accented venue name can
    arrive composed (NFC) from one report and decomposed (NFD) from another. Both would
    otherwise read as a template revision, and both would split one venue into two
    stratification keys.

    Nothing *semantic* is collapsed: no case folding, no accent stripping. A venue the
    corpus genuinely prints two different ways must still surface as a deviation — per
    the Dev Notes, that inconsistency is itself worth catching.
    """
    text = unicodedata.normalize("NFC", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Cf")
    return " ".join(text.split())


def page_text(page: "pymupdf.Page") -> str:
    """Normalized text of a single page."""
    return normalize(page.get_text())


def _matches(text: str, anchor_text: str, at_start: bool) -> bool:
    """Whether `anchor_text` locates `text`, as a page title or as a substring."""
    return text.startswith(anchor_text) if at_start else anchor_text in text


def find_anchor_pages(
    doc: "pymupdf.Document",
    anchor_text: str,
    report_id: str | None = None,
    at_start: bool = False,
) -> list[int]:
    """Every page located by `anchor_text`, in ascending order.

    Walks the whole document: a section's content can span several pages (the shots
    pitch map and its event table both carry `"Attempts at Goal {team}"`), and knowing
    all of them is what later parser stories need.

    `at_start=True` requires the anchor to open the page's normalized text, which is how
    a divider title is distinguished from a longer title that contains it.

    Raises `MissingAnchorError` when no page matches.
    """
    pages = [i for i, page in enumerate(doc) if _matches(page_text(page), anchor_text, at_start)]
    if not pages:
        raise MissingAnchorError(anchor_text, report_id)
    return pages


class PageTextIndex:
    """Normalized text of every page, extracted once and reused for many anchors.

    Resolving the ~49 registered anchors by re-walking the document each time costs 49
    full text extractions of a ~52-page report; the index makes it one. Use it whenever
    more than a couple of anchors are looked up in the same document — the metadata
    probe deliberately does not, because it needs only the cover page and stops there.
    """

    def __init__(self, doc: "pymupdf.Document", report_id: str | None = None) -> None:
        self.report_id = report_id
        self._texts: list[str] = [page_text(page) for page in doc]

    def __len__(self) -> int:
        return len(self._texts)

    def find_all(self, anchor_text: str, at_start: bool = False) -> list[int]:
        """Every page located by `anchor_text`. Raises `MissingAnchorError` if none."""
        pages = [i for i, text in enumerate(self._texts) if _matches(text, anchor_text, at_start)]
        if not pages:
            raise MissingAnchorError(anchor_text, self.report_id)
        return pages

    def find_first(self, anchor_text: str, at_start: bool = False) -> int:
        """First page located by `anchor_text`. Raises `MissingAnchorError` if none."""
        return self.find_all(anchor_text, at_start)[0]


def find_first_anchor_page(
    doc: "pymupdf.Document",
    anchor_text: str,
    report_id: str | None = None,
) -> int:
    """First page containing `anchor_text`, short-circuiting on the match.

    Used by the corpus metadata probe, which must stay cheap across 104 reports: the
    cover anchor hits on the first page, so no full-document text walk happens.

    Raises `MissingAnchorError` when no page matches.
    """
    for i, page in enumerate(doc):
        if anchor_text in page_text(page):
            return i
    raise MissingAnchorError(anchor_text, report_id)

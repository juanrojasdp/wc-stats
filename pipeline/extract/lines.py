"""Visual-line reconstruction that preserves per-span x-positions.

Generalized from the technique `pipeline/discover/probe.py::cover_lines` proved on the
cover: spans are regrouped into visual rows by vertical position because pymupdf's own
line grouping splits across image blocks and column layouts. The cover only needed the
joined text; the lineup page is two team columns read column-interleaved by naive
`get_text()`, so this variant keeps every span's (x, y) — the caller needs them to
assign spans to the home (left) vs away (right) column and to associate trailing minute
markers with the correct player row.

`probe.py` stays byte-identical: its module-private helpers are adapted here, not
imported, so the 104 already-verified cover parses cannot shift underneath this story.

Tolerances match the probe's (`_LINE_TOLERANCE_PT = 3.0`, `_SPACE_GAP_PT = 1.0`).
deferred-work.md flags them as unvalidated at the boundary — a 1.0pt gap fuses words, a
>3.0pt delta splits lines — so `test_extract_lines.py` pins both edges for this variant.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pipeline.discover.text import normalize

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# Spans whose tops differ by less than this many points belong to the same visual row.
LINE_TOLERANCE_PT = 3.0
# A horizontal gap wider than this between adjacent spans reads as a word break.
SPACE_GAP_PT = 1.0


@dataclass(frozen=True)
class TextSpan:
    """One positioned text span, as extracted from `page.get_text("dict")`."""

    x0: float
    y0: float
    x1: float
    y1: float
    text: str

    @property
    def center_x(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass(frozen=True)
class VisualRow:
    """One visual row: its anchor y (first span's top) and its spans, left to right."""

    y: float
    spans: tuple[TextSpan, ...]


def text_spans(page: "pymupdf.Page") -> list[TextSpan]:
    """Every non-blank text span of a page, sorted top-to-bottom then left-to-right."""
    spans: list[TextSpan] = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:  # image block
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                if span["text"].strip():
                    x0, y0, x1, y1 = span["bbox"]
                    spans.append(TextSpan(x0=x0, y0=y0, x1=x1, y1=y1, text=span["text"]))
    return sorted(spans, key=lambda span: (span.y0, span.x0))


def group_rows(
    spans: "list[TextSpan]", tolerance: float = LINE_TOLERANCE_PT
) -> list[VisualRow]:
    """Group spans into visual rows by vertical position, top to bottom.

    Same anchor semantics as the probe: a row opens at its first span's `y0` and takes
    every following span within `tolerance` of that anchor. Callers must pre-filter the
    spans to one column — grouping both columns plus the central formation diagram in a
    single pass lets a diagram span at an in-between y open a row that splits a player
    row from its minute markers (observed on the real corpus, PMSR-M69).
    """
    rows: list[VisualRow] = []
    current: list[TextSpan] = []
    current_y: float | None = None
    for span in sorted(spans, key=lambda s: (s.y0, s.x0)):
        if current_y is not None and abs(span.y0 - current_y) > tolerance:
            rows.append(VisualRow(y=current_y, spans=tuple(sorted(current, key=lambda s: s.x0))))
            current = []
            current_y = None
        if current_y is None:
            current_y = span.y0
        current.append(span)
    if current:
        rows.append(VisualRow(y=current_y, spans=tuple(sorted(current, key=lambda s: s.x0))))
    return rows


def join_spans(spans: "list[TextSpan] | tuple[TextSpan, ...]", space_gap: float = SPACE_GAP_PT) -> str:
    """Join one row's spans left to right, restoring spaces the layout only implies.

    Mirrors the probe's `_join_spans`: adjacent spans usually abut exactly (hyphenated
    names arrive as abutting `'AIT'` `'-'` `'NOURI'` spans), but a wide visual gap — a
    column between the shirt number and the position code — carries no space character
    of its own. The result is `normalize()`d, so span-carried whitespace collapses.
    """
    parts: list[str] = []
    previous_x1: float | None = None
    for span in sorted(spans, key=lambda s: (s.x0, s.x1)):
        if previous_x1 is not None and span.x0 - previous_x1 > space_gap:
            parts.append(" ")
        parts.append(span.text)
        previous_x1 = span.x1
    return normalize("".join(parts))

"""Pass-network extraction: the printed player-to-player pass matrix (Story 1.14, FR-13).

**This page draws no pitch and no markers, and it carries no coordinates of any kind.**
Measured with `filter_chain.detect_pitch_frames`' own qualifying rule over all 104
reports / 208 team-innings: 0 pitch frames, 0 filled all-Bezier drawings, one 36x36 pt
competition logo. Every other spatial family in the report has a pitch rect at the
template's 0.70 aspect ratio; "Passing Networks {team}" has none, and no page anywhere in
the corpus is titled with average positions. So this module stages a **matrix**, not
events — and `PassNetworkNode.x`/`y` are unfulfillable rather than merely hard (AC 2,
filed as an AD-14 emission blocker). `node_positions` is staged as an explicit `None`
with a per-report warning, so the absence is published rather than implied by a missing
key, and `_assert_no_pitch_and_no_markers` re-proves the negative on EVERY run so the day
the vendor starts printing coordinates the corpus aborts loud instead of publishing
`null` forever.

It still lives in `pipeline/extract/` rather than `pipeline/markers/` for three reasons,
in order: the shared marker chain has no data to contribute here (it is imported
read-only, as an assertion, and stages nothing); the page joins Domain A's lineups, which
is `extract/`'s convention and whose `PlayerJoinError` / `MissingFieldError` live in
`extract/errors.py`; and the page is a table read through `lines.py`, which is `extract/`'s
reader.

Page grammar, verified verbatim on `spike/mex_rsa.pdf` and swept over the whole corpus:

- One page per team, both already anchored by Story 1.2's `pass-network` spec. Every
  anchor resolves to EXACTLY one page (208/208).
- A square **N x N directed** matrix, rows = "Passes From", columns = "to",
  N in {13,14,15,16,17} (13:2, 14:11, 15:26, 16:154, 17:15). The diagonal is blank on
  208/208 (no self-pass); every off-diagonal cell is printed, including the 25,217 zeros.
  23,597 cells are non-zero, volumes 1-48, over 48,814 off-diagonal cells — which is
  exactly sum N(N-1) across that distribution.
- Directed, and asymmetric in fact: 9,151 reciprocal pairs of which 6,835 print different
  volumes in the two directions. Never symmetrize, never collapse a pair, never dedup.
- **Column assignment is GEOMETRIC, read from the blue header rectangles.** Only the
  blank diagonal is absent from the text layer, but that single absence makes every row
  ragged: an ordinal read over the present values shifts every cell at or after position
  `i` in row `i`, and with 25,217 zeros in the corpus a shifted value looks entirely
  plausible. Widths are non-uniform WITHIN the page on 156 of 208 innings (27.75-58.5 pt),
  the 52 uniform pages are all 36.0 pt and occur at N=15/16/17, and the enclosing span is
  not fixed either (left edge takes 56 distinct values 126.75-255.75; right edge 748.5 on
  204/208). So neither a hardcoded 36 pt nor a `span / N` model works: each column's
  extent is read from its own header rect and nothing else.
- Row labels carry the shirt number the column headers do not, and a hyphenated surname
  wraps inside the narrow header cell on 24 of 208 innings (`'Ben GANNON- DOAK'`). The
  canonical player list therefore comes from the ROW labels; the headers are read only to
  place the columns and are compared hyphen-normalized, never silently repaired.
- The join to Domain A is exact and asymmetric, and it is the same player set Domain G
  sees: all 3,289 rows join by verbatim name with the shirt corroborating 3,289/3,289,
  2,103 unused substitutes correctly have no row, and the one tolerated anomaly is the
  same one — PMSR-M92 away #14 Jordan HENDERSON, whose row AND column are all zeros.
"""

from __future__ import annotations

import re

import pymupdf

from pipeline.extract import bounded_check, check_entry
from pipeline.extract.domain_g import has_minutes
from pipeline.extract.errors import (
    MissingFieldError,
    PassNetworkParseError,
    PlayerJoinError,
)
from pipeline.extract.lines import TextSpan, group_rows, join_spans, text_spans
from pipeline.markers.errors import PitchFrameError
from pipeline.markers.filter_chain import detect_pitch_frames

# --- the anchor (Story 1.2 registered the spec; nothing new is registered here) -----
#
# Module scope so `pipeline/validate/checks.py` imports it rather than re-spelling the
# ids, and the gate's anchor list can never drift from the parser's (`domain_e.py`).
PASS_NETWORK_ANCHOR_STEM = "pass-network"

# --- header-band geometry (corpus-verified, asserted not assumed) -------------------

# The header cells are filled with this exact colour, rounded to 2 decimals the way
# `filter_chain` rounds every fill it keys.
HEADER_FILL_RGB: "tuple[float, float, float]" = (0.18, 0.30, 1.00)
HEADER_FILL_DECIMALS = 2
# The band's y0 is 90.75 on 208/208; the window is deliberately loose in y and strict in
# height, because height is what separates the header run from the Top-5 panel's own
# header rect (13.5 pt) sitting at the same y0.
HEADER_BAND_Y0_MIN = 85.0
HEADER_BAND_Y0_MAX = 95.0
HEADER_MIN_HEIGHT_PT = 20.0

# The two leading cells, identified by their TEXT and never by index (AD-8).
SHIRT_HEADER_TEXT = "#"
ROW_HEADER_TEXT_PREFIX = "Passes From"

# The printed self-check panel: five rows of `Player | Passed To | % of Total Team
# Passes`, present on 208/208.
TOP_RANKED_PAIR_COUNT = 5

# `re.ASCII` on the digit class throughout: fullwidth digits otherwise satisfy `\d` and
# are happily accepted by `int()`, which would launder a template revision into a number.
_SHIRT_RE = re.compile(r"^\d{1,2}$", re.ASCII)
_CELL_RE = re.compile(r"^\d+$", re.ASCII)
# Percentages print with or without a decimal — `3.8%` and `3%` both appear on the
# reference page — and always carry the trailing sign.
_PERCENT_RE = re.compile(r"(\d+(?:\.\d+)?)%", re.ASCII)


# --- page-level assertions ----------------------------------------------------------


def _side_page(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    side: str,
    report_id: "str | None",
) -> "pymupdf.Page":
    """The one pass-network page for one side, located by anchor id (AD-8)."""
    anchor_id = f"{PASS_NETWORK_ANCHOR_STEM}:{side}"
    pages = anchors.get(anchor_id)
    if not pages:
        raise PassNetworkParseError(
            f"anchor map carries no resolved {anchor_id!r} page", report_id
        )
    if len(pages) != 1:
        raise PassNetworkParseError(
            f"{anchor_id!r} anchor resolves to {len(pages)} pages {pages}; expected 1",
            report_id,
        )
    return doc[pages[0]]


def _filled_bezier_rects(page: "pymupdf.Page") -> "list[pymupdf.Rect]":
    """Every filled all-Bezier drawing on the page — what a marker parser could ever see.

    Deliberately unbounded in size rather than windowed to one family's `MarkerSpec`:
    the corpus draws ZERO of these at ANY size on 208/208 (its only curve content is the
    two ~9-10 pt mixed `c`+`l` header sort-arrow glyphs, which this predicate excludes),
    so the stricter form is the one the measurement supports — and a re-scaled marker
    must not slip through a size window the day the template changes.
    """
    found: list[pymupdf.Rect] = []
    for drawing in page.get_drawings():
        if drawing.get("fill") is None:
            continue
        items = drawing["items"]
        if items and all(item[0] == "c" for item in items):
            found.append(drawing["rect"])
    return found


def _assert_no_pitch_and_no_markers(
    page: "pymupdf.Page", side: str, report_id: "str | None"
) -> None:
    """AC 2's negative, re-proved on every run — never a comment, never a one-off probe.

    The shared chain is imported here read-only, as an assertion that stages nothing.
    `detect_pitch_frames` is REQUIRED to raise `PitchFrameError`: on this page its
    qualifying rule (stroked `"re"`, 10000 < area < 0.8 x page area) returns nothing at
    all, because the only sub-page rectangles are the table's own filled header cells.
    """
    try:
        rects = detect_pitch_frames(page, report_id)
    except PitchFrameError:
        rects = None
    # The RAISE is the assertion, exactly as Task 2.12 words it — not "an empty list is
    # also fine". `detect_pitch_frames` never returns empty (it raises on 0 qualifying
    # rects), so a return of ANY kind means the page now carries something this parser's
    # whole `node_positions` re-scope says it does not.
    if rects is not None:
        raise PassNetworkParseError(
            f"{side} pass-network page {page.number} carries {len(rects)} qualifying "
            "pitch rectangle(s) where the corpus prints none on 208/208 — the page may "
            "now draw coordinates, and node_positions must be re-scoped before this "
            "parser stages another report",
            report_id,
        )
    markers = _filled_bezier_rects(page)
    if markers:
        raise PassNetworkParseError(
            f"{side} pass-network page {page.number} carries {len(markers)} filled "
            "all-Bezier drawing(s) where the corpus prints none on 208/208 — the page "
            "may now draw markers, and node_positions must be re-scoped before this "
            "parser stages another report",
            report_id,
        )


# --- column geometry (Task 2.4: the production rule) ---------------------------------


def _header_cells(
    page: "pymupdf.Page", side: str, report_id: "str | None"
) -> "list[pymupdf.Rect]":
    """The blue header cells, left to right — the ONLY source of column extents.

    The `height > 20` predicate is what excludes the Top-5 panel's own header rect
    (13.5 pt) sitting at the same y0, and the fill predicate excludes the 0.75 pt white
    separators drawn over the same band at the same height.
    """
    cells: list[pymupdf.Rect] = []
    for drawing in page.get_drawings():
        fill = drawing.get("fill")
        if fill is None:
            continue
        if tuple(round(channel, HEADER_FILL_DECIMALS) for channel in fill) != HEADER_FILL_RGB:
            continue
        for item in drawing["items"]:
            if item[0] != "re":
                continue
            rect = pymupdf.Rect(item[1])
            if (
                HEADER_BAND_Y0_MIN < rect.y0 < HEADER_BAND_Y0_MAX
                and rect.height > HEADER_MIN_HEIGHT_PT
            ):
                cells.append(rect)
    cells.sort(key=lambda rect: rect.x0)
    if len(cells) < 3:
        raise PassNetworkParseError(
            f"{side} pass-network header band carries {len(cells)} qualifying cells; "
            "expected the two leading cells plus at least one player column",
            report_id,
        )
    for left, right in zip(cells, cells[1:]):
        # Every cell butts against its neighbour on 208/208. A gap would mean a header
        # cell went missing, which would silently drop a whole column from the grid while
        # every remaining column still parsed — the one failure the census below cannot
        # see, because the row would then simply carry one fewer value.
        if abs(right.x0 - left.x1) > 0.01:
            raise PassNetworkParseError(
                f"{side} pass-network header cells are not contiguous: "
                f"{left.x1} -> {right.x0}",
                report_id,
            )
    return cells


def _cell_index(cells: "list[pymupdf.Rect]", center_x: float) -> "int | None":
    """Which header cell a span's centre falls in — half-open, closed at the right edge."""
    for index, rect in enumerate(cells[:-1]):
        if rect.x0 <= center_x < rect.x1:
            return index
    if cells[-1].x0 <= center_x <= cells[-1].x1:
        return len(cells) - 1
    return None


def _header_texts(
    cells: "list[pymupdf.Rect]", spans: "list[TextSpan]"
) -> "list[str]":
    """Each header cell's printed text, its wrapped lines joined left to right.

    Per LINE, then lines joined by a space: sorting a two-line cell's spans by x alone
    would interleave the lines and scramble the name. This is also where the hyphen wrap
    shows up as `'Ben GANNON- DOAK'` — recorded verbatim, normalized only at comparison
    time (Task 2.7).
    """
    band = cells[0]
    texts: list[str] = []
    for index, rect in enumerate(cells):
        inside = [
            span
            for span in spans
            if band.y0 <= span.y0 <= band.y1 and _cell_index(cells, span.center_x) == index
        ]
        texts.append(
            " ".join(join_spans(row.spans) for row in group_rows(inside)).strip()
        )
    return texts


def _hyphen_normalized(text: str) -> str:
    """`'Ben GANNON- DOAK'` -> `'Ben GANNON-DOAK'` — for COMPARISON only, never staged."""
    return text.replace("- ", "-")


# --- row grammar (Tasks 2.5-2.9) ------------------------------------------------------


def _parse_rows(
    cells: "list[pymupdf.Rect]",
    spans: "list[TextSpan]",
    side: str,
    report_id: "str | None",
) -> "list[tuple[int, str, dict[int, int]]]":
    """Every matrix row as (shirt, name, {column index -> value}), in printed order.

    Assignment is by x-containment in each column's OWN header rect — never by nearest
    centre and never by left-to-right ordinal over the present values, which is exactly
    the off-by-one the blank diagonal would otherwise produce in every row.
    """
    body_limit = cells[-1].x1
    body = [
        span for span in spans if span.y0 > cells[0].y1 and span.center_x <= body_limit
    ]
    rows: list[tuple[int, str, dict[int, int]]] = []
    for row in group_rows(body):
        buckets: dict[int, list[TextSpan]] = {}
        for span in row.spans:
            index = _cell_index(cells, span.center_x)
            if index is None:
                raise PassNetworkParseError(
                    f"{side} matrix row at y={row.y} carries a span "
                    f"{span.text!r} at x={span.center_x} outside every header cell",
                    report_id,
                )
            buckets.setdefault(index, []).append(span)
        shirt_spans = buckets.get(0, [])
        if not shirt_spans:
            if 1 in buckets:
                # A row-label line with no shirt number is the wrap case: 1.13's
                # analogous table hid a three-line player name that failed on four
                # reports. It does not occur here (max 1 line per label on 208/208), so
                # if it ever does, abort loud rather than stage a truncated name that
                # surfaces later as a PlayerJoinError on a name that looks right.
                raise PassNetworkParseError(
                    f"{side} matrix carries a row-label line with no shirt number at "
                    f"y={row.y}: {join_spans(buckets[1])!r} — a wrapped row label, which "
                    "the corpus does not print",
                    report_id,
                )
            continue
        shirt_text = join_spans(shirt_spans)
        if not _SHIRT_RE.match(shirt_text):
            raise PassNetworkParseError(
                f"{side} matrix row at y={row.y} carries {shirt_text!r} in the shirt "
                "column, which is not a 1-2 digit number",
                report_id,
            )
        shirt = int(shirt_text)
        name = join_spans(buckets.get(1, []))
        if not name:
            raise PassNetworkParseError(
                f"{side} matrix row #{shirt} assembled an empty player name", report_id
            )
        values: dict[int, int] = {}
        for index, items in buckets.items():
            if index < 2:
                continue
            text = join_spans(items)
            if not _CELL_RE.match(text):
                raise PassNetworkParseError(
                    f"{side} matrix row #{shirt} ({name!r}) column {index - 2} carries "
                    f"{text!r}, which is not a non-negative ASCII integer",
                    report_id,
                )
            values[index - 2] = int(text)
        rows.append((shirt, name, values))
    if not rows:
        raise PassNetworkParseError(
            f"{side} pass-network page carries no matrix rows", report_id
        )
    return rows


def _matrix(
    rows: "list[tuple[int, str, dict[int, int]]]",
    column_count: int,
    side: str,
    report_id: "str | None",
) -> "list[list[int | None]]":
    """The census (Task 2.5): N x N, one blank per row, and that blank on the diagonal."""
    if len(rows) != column_count:
        raise PassNetworkParseError(
            f"{side} matrix prints {len(rows)} rows against {column_count} columns; "
            "the pass matrix is square on 208/208",
            report_id,
        )
    grid: list[list[int | None]] = []
    for position, (shirt, name, values) in enumerate(rows):
        # Unreachable by construction and kept as an internal invariant, not as a data
        # guard: `_parse_rows` builds these keys as `index - 2` for `2 <= index <
        # len(cells)`, and the caller passes `column_count = len(cells) - 2`, so the key
        # range is exactly `0..column_count-1`. It fires only if the two ever drift apart.
        unknown = sorted(index for index in values if not 0 <= index < column_count)
        if unknown:
            raise PassNetworkParseError(
                f"{side} matrix row #{shirt} ({name!r}) carries values in columns "
                f"{unknown} outside 0..{column_count - 1}",
                report_id,
            )
        blanks = [index for index in range(column_count) if index not in values]
        if blanks != [position]:
            raise PassNetworkParseError(
                f"{side} matrix row {position} #{shirt} ({name!r}) leaves columns "
                f"{blanks} blank; exactly one blank is expected, on the diagonal at "
                f"column {position}",
                report_id,
            )
        grid.append([values.get(index) for index in range(column_count)])
    return grid


# --- the within-report join (Task 3, AC 1) --------------------------------------------


def _join_index(
    lineups: dict, side: str, report_id: "str | None"
) -> "tuple[dict[str, dict], list[dict]]":
    """`{name -> lineup entry}` for one side, plus the entries that took the field.

    Domain G's shape, deliberately copied rather than imported: keyed on the lineup
    entry's name VERBATIM — never normalized, folded, fuzzy-matched, or falling back to
    the shirt number (AD-8; cross-report identity is Story 1.15's) — with an explicit
    duplicate guard rather than a dict that would silently collapse two players.
    """
    side_lineup = lineups[side]
    index: dict[str, dict] = {}
    with_minutes: list[dict] = []
    for section in ("starters", "substitutes"):
        for entry in side_lineup[section]:
            name = entry["name"]
            if name in index:
                raise PlayerJoinError(
                    f"{side} lineup prints the name {name!r} twice "
                    f"(shirts {index[name]['shirt_number']} and {entry['shirt_number']}); "
                    "the within-report join cannot be 1:1",
                    report_id,
                )
            index[name] = entry
            if has_minutes(entry, section):
                with_minutes.append(entry)
    return index, with_minutes


def _join_row(
    index: "dict[str, dict]",
    name: str,
    shirt: int,
    side: str,
    report_id: "str | None",
) -> dict:
    """The lineup entry a matrix row belongs to, or a loud failure (AC 1).

    The shirt number is the CORROBORATING key, not the join key: it catches a name
    collision the registry-free join cannot see, and disagreed on 0 of 3,289 corpus rows.
    """
    entry = index.get(name)
    if entry is None:
        raise PlayerJoinError(
            f"{side} pass-network row #{shirt} name {name!r} matches no lineup player",
            report_id,
        )
    if entry["shirt_number"] != shirt:
        raise PlayerJoinError(
            f"{side} pass-network row for {name!r} prints shirt {shirt}, "
            f"but the lineup prints {entry['shirt_number']}",
            report_id,
        )
    return entry


# --- the printed Top-5 panel (Task 4.1) ------------------------------------------------


def _top_ranked_percentages(
    cells: "list[pymupdf.Rect]",
    spans: "list[TextSpan]",
    side: str,
    report_id: "str | None",
) -> "list[float]":
    """The five printed percentages, in printed order.

    The panel's PLAYER NAMES are deliberately not read: they wrap across lines on 12 of
    208 innings, they are not staged, and they carry no check — the percentages alone
    reconcile the whole matrix (`pass-network-top5-pct`). A later story that wants the
    names owes the wrap recipe (`crosses.py` / `defensive_actions.py`), not a guess.
    """
    panel = [span for span in spans if span.y0 > cells[0].y1 and span.x0 >= cells[-1].x1]
    percentages: list[float] = []
    for row in group_rows(panel):
        percentages.extend(
            float(match) for match in _PERCENT_RE.findall(join_spans(row.spans))
        )
    if len(percentages) != TOP_RANKED_PAIR_COUNT:
        raise PassNetworkParseError(
            f"{side} Top-5 panel prints {len(percentages)} percentages "
            f"{percentages}; expected exactly {TOP_RANKED_PAIR_COUNT}",
            report_id,
        )
    return percentages


# --- the extractor ---------------------------------------------------------------------


def _extract_side(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    lineups: dict,
    side: str,
    report_id: "str | None",
) -> dict:
    """One team's pass-network block. The side comes from the ANCHOR ID, never x-order."""
    page = _side_page(doc, anchors, side, report_id)
    _assert_no_pitch_and_no_markers(page, side, report_id)

    cells = _header_cells(page, side, report_id)
    spans = text_spans(page)
    header_texts = _header_texts(cells, spans)
    if header_texts[0] != SHIRT_HEADER_TEXT:
        raise PassNetworkParseError(
            f"{side} pass-network header cell 0 reads {header_texts[0]!r}, "
            f"expected {SHIRT_HEADER_TEXT!r} — a template revision",
            report_id,
        )
    if not header_texts[1].startswith(ROW_HEADER_TEXT_PREFIX):
        raise PassNetworkParseError(
            f"{side} pass-network header cell 1 reads {header_texts[1]!r}, expected it "
            f"to begin {ROW_HEADER_TEXT_PREFIX!r} — a template revision",
            report_id,
        )
    columns = cells[2:]
    column_names = header_texts[2:]

    rows = _parse_rows(cells, spans, side, report_id)
    grid = _matrix(rows, len(columns), side, report_id)

    # Row order == column order on 208/208, hyphen-normalized. This is what makes cell
    # [i][j] mean "row-player i -> column-player j" without a second name lookup per
    # cell; if it ever fails, raise rather than fall back to per-cell name matching.
    row_names = [name for _shirt, name, _values in rows]
    if [_hyphen_normalized(name) for name in row_names] != [
        _hyphen_normalized(name) for name in column_names
    ]:
        raise PassNetworkParseError(
            f"{side} matrix row order does not match column order: "
            f"rows {row_names!r} vs columns {column_names!r}",
            report_id,
        )

    size = len(columns)
    players = [
        {
            "name": name,
            "shirt_number": shirt,
            "passes_made": sum(
                grid[position][other] for other in range(size) if other != position
            ),
            "passes_received": sum(
                grid[other][position] for other in range(size) if other != position
            ),
        }
        for position, (shirt, name, _values) in enumerate(rows)
    ]
    # Matrix reading order, and NO dedup ever: a reciprocal pair is two edges, and 6,835
    # corpus pairs print different volumes in the two directions.
    edges = [
        {
            "from_name": players[i]["name"],
            "from_shirt": players[i]["shirt_number"],
            "to_name": players[j]["name"],
            "to_shirt": players[j]["shirt_number"],
            "volume": grid[i][j],
        }
        for i in range(size)
        for j in range(size)
        if i != j and grid[i][j]
    ]
    matrix_total = sum(player["passes_made"] for player in players)

    index, with_minutes = _join_index(lineups, side, report_id)
    seen: set[str] = set()
    for position, player in enumerate(players):
        name, shirt = player["name"], player["shirt_number"]
        if name in seen:
            raise PassNetworkParseError(
                f"{side} matrix lists {name!r} twice", report_id
            )
        seen.add(name)
        _join_row(index, name, shirt, side, report_id)
    with_minutes_names = {entry["name"] for entry in with_minutes}
    for player in players:
        if player["name"] in with_minutes_names:
            continue
        # The one tolerated anomaly, and it is the same player Domain G tolerates:
        # PMSR-M92 away #14 Jordan HENDERSON, an unused substitute booked from the bench
        # who carries an all-zero row. The page is merely verbose, not contradictory.
        # BOTH directions are ruled: a teammate passing TO someone who never played is
        # the same contradiction Domain G has no analogue for.
        if player["passes_made"] or player["passes_received"]:
            raise PlayerJoinError(
                f"{side} pass-network row for {player['name']!r} (shirt "
                f"{player['shirt_number']}) carries {player['passes_made']} passes made "
                f"and {player['passes_received']} received, but the lineup records no "
                "minutes for them (not a starter, no sub-on stamp)",
                report_id,
            )
    # The other direction. A lineup entry WITHOUT minutes and without a matrix row is the
    # normal case — 2,103 corpus-wide — and is deliberately neither recorded nor warned.
    for entry in with_minutes:
        if entry["name"] not in seen:
            raise MissingFieldError(
                f"{side} lineup player {entry['name']!r} (shirt "
                f"{entry['shirt_number']}) took the field but has no pass-network row",
                report_id,
            )

    percentages = _top_ranked_percentages(cells, spans, side, report_id)
    return {
        "players": players,
        "edges": edges,
        "matrix_total": matrix_total,
        "top_ranked_pairs": [
            {"rank": rank, "percent_of_total": percent}
            for rank, percent in enumerate(percentages, start=1)
        ],
        # AC 2's documented absence, published rather than implied by a missing key.
        # `pass_network_warnings()` carries the reason into every report's warnings.
        "node_positions": None,
    }


def extract_pass_network(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    lineups: dict,
    report_id: "str | None" = None,
) -> dict:
    """Extract the pass-network payload for one report (AC 1, AC 2).

    `lineups` is Domain A's already-parsed `match_metadata["lineups"]` block, handed in by
    the record seam — the lineup page is never re-parsed here (the `domain_g.py` rule).
    Pages are located through the already-resolved `anchors` map, never by page index
    (AD-8), and the side comes from the anchor id rather than page or x order.

    Pure in the AD-9 sense: no filesystem writes, no timestamps, no cross-report
    knowledge, and no `player_id` — cross-report identity is Story 1.15's. Raises
    `PassNetworkParseError`, `PlayerJoinError` or `MissingFieldError`; the batch turns
    each into a `failed` manifest entry for this report alone. The payload is
    all-or-nothing: no partial pass-network block ever stages.
    """
    return {
        side: _extract_side(doc, anchors, lineups, side, report_id)
        for side in ("home", "away")
    }


# --- Self-Validation checks (SM-C1: binary, within-report, never loosened) -------------

# The printed Top-5 percentages carry one decimal, so a faithful value sits at most half
# an ulp — 0.05 — from the computed one. Corpus-verified over all 1,040 printed
# percentages (208 innings x 5): worst observed absolute delta is EXACTLY 0.05, and the
# three worst cases evaluate to 0.04999999999999982 in float. Compare with `<=`; do not
# tighten this constant or restructure the arithmetic without re-measuring.
TOP_RANKED_PCT_TOLERANCE = 0.05
# Compared as `delta > TOLERANCE + EPSILON` so that a faithful page sitting EXACTLY at the
# half-ulp cannot fail on float representation alone. The three worst corpus cases happen
# to evaluate to 0.04999999999999982 — BELOW 0.05 — but the sign of that last-bit error is
# an accident of the operands: `abs(value - 100.0 * cell / matrix_total)` can just as
# easily land at 0.050000000000000044 for a page that is printed correctly. This does not
# loosen the tolerance (1e-9 is eleven orders of magnitude below the 1-dp printed
# precision); it stops the constant from meaning "0.05, unless the rounding goes the other
# way". Do not raise it, and do not change TOP_RANKED_PCT_TOLERANCE without re-measuring.
TOP_RANKED_PCT_EPSILON = 1e-9

_check = check_entry
_bounded = bounded_check


def _side_blocks(payload: "dict | None", *keys: str) -> "dict | None":
    """A sibling payload's per-side blocks, or `None` when it is not that shape.

    Sibling payloads are read through this rather than subscripted bare. A shape change in
    Domain G or Domain B is that domain's finding, and reading it with `payload[side]` /
    `block["in_possession"]["passes_completed"]` would surface it here as an UNTYPED
    `KeyError` — which escapes `extract_report` as a non-typed failure and reaches the gate
    only because `runner.py` catches broad `Exception`. That is exactly the defect the
    Story 1.9 review patched out of `domain_e._goalkeepers`. `None` here means the check is
    OMITTED, the same "one root cause, one finding" branch as an absent payload.
    """
    if not isinstance(payload, dict):
        return None
    blocks: dict = {}
    for side in ("home", "away"):
        block = payload.get(side)
        for key in keys:
            if not isinstance(block, dict):
                return None
            block = block.get(key)
        if block is None:
            return None
        blocks[side] = block
    return blocks


def pass_network_checks(
    payload: dict,
    player_stats: "dict | None" = None,
    key_statistics: "dict | None" = None,
) -> list[dict]:
    """The pass-network Self-Validation checks over an extracted payload (AC 1).

    Recorded, never raised — a failed consistency check is data about this report, and
    the record still stages so the gate can localize it. Exactly one dict per check id
    covers both sides, with `specifics` naming every offender in page order, so re-runs
    are byte-identical.

    `player_stats` (Domain G) and `key_statistics` (Domain B) are the sibling payloads
    the two cross-domain BOUNDS need; the caller (`extract_report`, and the gate's counts
    check) has them in hand, which keeps this parser single-source — the 1.7/1.10/1.13
    precedent. When one is absent its check is OMITTED rather than emitted as a passing
    or failing dict: one root cause, one finding.

    The check ids here are Self-Validation ids and are a DIFFERENT registry from the
    FR-15 gate ids `pass-network-completeness` / `pass-network-counts`. Never reuse one
    as the other.
    """
    checks: list[dict] = []

    # --- the primary check: the page's own printed counterpart -----------------------
    top5_notes: list[str] = []
    top5_totals: list[str] = []
    for side in ("home", "away"):
        block = payload[side]
        matrix_total = block["matrix_total"]
        volumes = sorted((edge["volume"] for edge in block["edges"]), reverse=True)
        printed = [pair["percent_of_total"] for pair in block["top_ranked_pairs"]]
        largest = volumes[:TOP_RANKED_PAIR_COUNT]
        if len(largest) < len(printed):
            top5_notes.append(
                f"{side}: matrix carries only {len(largest)} non-zero cells against "
                f"{len(printed)} printed Top-5 rows"
            )
            top5_totals.append(f"{side} 0/{len(printed)} (total {matrix_total})")
            continue
        verified = 0
        worst = 0.0
        for rank, (value, cell) in enumerate(zip(printed, largest), start=1):
            computed = 100.0 * cell / matrix_total if matrix_total else 0.0
            delta = abs(value - computed)
            worst = max(worst, delta)
            if delta > TOP_RANKED_PCT_TOLERANCE + TOP_RANKED_PCT_EPSILON:
                top5_notes.append(
                    f"{side} rank {rank}: printed {value}% vs {cell}/{matrix_total} = "
                    f"{round(computed, 4)}% (delta {round(delta, 4)})"
                )
            else:
                verified += 1
        # The count is VERIFIED-of-printed, not printed-of-printed: the old form compared
        # `len(printed)` with itself and could only ever read `5/5`, which reads like a
        # tally but cannot report a partial. The worst delta rides along so the margin to
        # the tolerance is visible on every report rather than only when it is exceeded.
        top5_totals.append(
            f"{side} {verified}/{len(printed)} within tol (worst delta "
            f"{round(worst, 4)}, total {matrix_total})"
        )
    # The census is recorded whether the check passes or FAILS. Dropping it on failure was
    # the same absorption Tasks 4.3/4.4 forbid one level down: the offending rank is the
    # finding, but the other four ranks' margin is the context that says how close the rest
    # of the page sits to the bound.
    top5_census = "; ".join(top5_totals)
    checks.append(
        _check(
            "pass-network-top5-pct",
            not top5_notes,
            f"{'; '.join(top5_notes)} | {top5_census}"
            if top5_notes
            else "every printed Top-5 percentage equals 100 x cell / matrix_total "
            f"(tol {TOP_RANKED_PCT_TOLERANCE}): " + top5_census,
        )
    )

    # --- the two cross-domain BOUNDS (the 1.8/1.9/1.12 rule) -------------------------
    #
    # Deliberately NOT shipped, and named here because this is exactly where a reader
    # reaches for it: `sum(col_j)` vs Domain G's `offers_received` is corpus-FALSE in
    # BOTH directions — 3,145 greater, 121 equal, 23 less over 3,289 rows. There is no
    # relation to check, and a "bound" in either direction would fire on thousands of
    # rows. (The `domain_g.py` do-not-ship comment shape.)
    domain_g_rows = _side_blocks(player_stats)
    if domain_g_rows is not None and all(
        isinstance(rows, list) for rows in domain_g_rows.values()
    ):
        row_notes: list[str] = []
        shortfalls: list[int] = []
        rows_seen = 0
        for side in ("home", "away"):
            by_name = {
                row["name"]: row
                for row in domain_g_rows[side]
                if isinstance(row, dict) and "name" in row
            }
            for player in payload[side]["players"]:
                stats = by_name.get(player["name"])
                if stats is None:
                    row_notes.append(
                        f"{side} #{player['shirt_number']} {player['name']}: no Domain G row"
                    )
                    continue
                in_possession = stats.get("in_possession")
                completed = (
                    in_possession.get("passes_completed")
                    if isinstance(in_possession, dict)
                    else None
                )
                if not isinstance(completed, int):
                    row_notes.append(
                        f"{side} #{player['shirt_number']} {player['name']}: Domain G row "
                        f"carries passes_completed {completed!r}, not an integer"
                    )
                    continue
                rows_seen += 1
                made = player["passes_made"]
                if made > completed:
                    row_notes.append(
                        f"{side} #{player['shirt_number']} {player['name']}: matrix row "
                        f"sum {made} > Domain G passes_completed {completed}"
                    )
                elif made < completed:
                    shortfalls.append(completed - made)
        # The delta is recorded on EVERY report, passing OR FAILING: equality is
        # corpus-FALSE on 1,290 of 3,289 rows and the gap must stay visible rather than be
        # closed by making the numbers agree. Emitting it only on the passing branch was
        # the absorption this comment already forbade.
        row_census = (
            f"{rows_seen} rows within bound; {len(shortfalls)} print fewer matrix passes "
            f"than Domain G (total shortfall {sum(shortfalls)}, "
            f"worst {max(shortfalls) if shortfalls else 0})"
        )
        checks.append(
            _bounded(
                "pass-network-row-bound",
                not row_notes,
                f"{'; '.join(row_notes)} | {row_census}" if row_notes else row_census,
                # The shortfall the bound tolerates, machine-readable for the batch
                # summary's near-miss aggregate (Story 1.19 R2). Equality is corpus-FALSE
                # on 1,290 of 3,289 rows, so this is non-zero on most reports.
                max(shortfalls, default=0),
            )
        )

    key_totals = _side_blocks(key_statistics, "passes_completed")
    if key_totals is not None:
        total_notes: list[str] = []
        deltas: list[str] = []
        total_gaps: list[int] = []
        for side in ("home", "away"):
            matrix_total = payload[side]["matrix_total"]
            completed = key_totals[side]
            if not isinstance(completed, int):
                total_notes.append(
                    f"{side}: Key Statistics carries passes_completed {completed!r}, "
                    "not an integer"
                )
            elif matrix_total > completed:
                total_notes.append(
                    f"{side}: matrix_total {matrix_total} > Key Statistics "
                    f"passes_completed {completed}"
                )
            else:
                deltas.append(
                    f"{side} {matrix_total} <= {completed} (delta {completed - matrix_total})"
                )
                total_gaps.append(abs(completed - matrix_total))
        # Same rule, and the same defect it had: one side exceeding its Key Statistics total
        # used to discard the OTHER side's delta entirely.
        total_census = ", ".join(deltas)
        checks.append(
            _bounded(
                "pass-network-total-bound",
                not total_notes,
                f"{'; '.join(total_notes)} | {total_census}"
                if total_notes and total_census
                else "; ".join(total_notes)
                if total_notes
                else total_census,
                max(total_gaps, default=0),
            )
        )

    return checks


def pass_network_warnings() -> list[str]:
    """AC 2's documented absence, as a per-report warning — never as a check.

    The aggregator treats anything but the literal `"pass"` as a failure, so a documented
    absence expressed as a check would turn every complete report into a failing one.
    """
    return [
        "pass_network: node_positions is not extractable — the Passing Networks page "
        "carries no pitch, no markers and no coordinates (0 pitch frames on 208/208), "
        "and no page anywhere in the corpus prints average positions"
    ]

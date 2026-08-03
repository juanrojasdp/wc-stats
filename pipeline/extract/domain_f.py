"""Domain F extraction: set plays — free kicks, penalties, corners, throw-ins (1.9, FR-7).

One open report in, one JSON-ready `domains["set_plays"]` block out. Pure in the AD-9
sense: no filesystem writes, no timestamps, no absolute paths, no cross-report knowledge.
The fifth instance of the `pipeline/extract/` convention Story 1.6 established, and by far
the easiest page in the corpus — fully in the text layer, invariant at 24 numeric words
and 14 structural labels on 208/208 team-innings, with four independent arithmetic
relations all true 208/208.

Page grammar, verified verbatim on spike/mex_rsa.pdf and swept over the whole corpus:

- ONE page per team (the `set-plays:{home|away}` anchors Story 1.2 already registered);
  208/208 resolve singly.
- **Five KPI tiles** whose value prints ABOVE its label, horizontally CENTRED on it, and
  one value row is shared by two KPIs (`'12 0'` sits above `'Total Free Kicks Total
  Penalties'`). The value is therefore found by walking UP from the label row to the first
  row carrying a numeric word centred on the label — never "the row immediately above",
  which for `Total Set Plays` is the corners table's own first data row.
- **Three tables**, each read label-anchored with its own x bands, never positionally:
  corners by delivery type (label 460-700, three values right of 700: left / right /
  total), corners by delivery style (same label band, one value), and free kicks (label
  left of 200, one value between 400 and 470). The x bands are what separate the free-kick
  row `'Direct 11'` from the corners row `'Direct to Area 3 0 3'`, whose label runs would
  otherwise both match `'Direct'`.
- The KPI band is bounded at x<400 and the table value band at x>700 for the same reason:
  the Total-Set-Plays value shares a visual row with the corners table header
  (`'36 Delivery Type From Left Side Total'`).

Staging is raw, locale-neutral and snake_case (AD-7); printed values go in verbatim and
nothing is derived — the corner side sum is AC 2's *check*, and Story 1.16 owns the
emit-time derivation.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from pipeline.extract import check_entry
from pipeline.extract.errors import MalformedFieldError, MissingFieldError, SetPlaysParseError
from pipeline.extract.lines import TextSpan, VisualRow, group_rows, join_spans, text_spans

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

SET_PLAYS_ANCHOR_STEM = "set-plays"

# --- page geometry (corpus-verified constants, asserted not assumed) ----------------
#
# Bands rather than positions: a value's x0 shifts with its width, so every read below is
# "inside this band, centred on that label", never "the nth span".

# The five KPI tiles live left of the corners tables. The bound is load-bearing: the
# Total-Set-Plays value shares a visual row with the corners table header.
KPI_X_MAX = 400.0
# A KPI value is centred on its label to within a fraction of a point on 208/208; 3.0 pt
# is that agreement with room for a wider printed value, and far tighter than the ~115 pt
# between the two KPI columns.
KPI_CENTRE_TOL_PT = 3.0
# How far above its label a KPI value may sit. The two KPI columns REPEAT down the page
# (x = 121.5 and x = 352.5 carry free kicks/penalties and then corners/throw-ins), so an
# unbounded upward walk past a missing value would silently adopt the tile above's number
# instead of failing — a plausible wrong value, which is the one outcome AD-8 forbids
# outright. Measured on the corpus, every KPI value sits 37-43 pt above its label; 80 pt is
# ~1.9x that and less than half the 139 pt to the next tile in the same column.
KPI_MAX_RISE_PT = 80.0

# The free-kick table: label at the page's left edge, its single value in the Total column.
FREE_KICK_LABEL_X_MAX = 200.0
FREE_KICK_VALUE_X_MIN = 400.0
FREE_KICK_VALUE_X_MAX = 470.0

# Both corners tables: label in the middle band, values in the right band.
CORNERS_LABEL_X_MIN = 460.0
CORNERS_LABEL_X_MAX = 700.0
CORNERS_VALUE_X_MIN = 700.0

# Every set-plays page carries exactly this many bare-integer words: the 22 printed values
# plus the date strip's day and year (`'11'` and `'2026'`; `'13:00'` is not a bare
# integer). A page-level tripwire, so a template revision that adds or drops a printed
# number fails loud even if every label this parser reads still resolves.
NUMERIC_WORD_COUNT = 24

_INTEGER_RE = re.compile(r"^\d+$", re.ASCII)
# Candidate KPI tokens are matched on this, then narrowed by `_parse_int`. Matching on
# `_INTEGER_RE` instead would make a KPI printed as `12.5` invisible to the walk, and the
# failure would surface as `MissingFieldError` — "prints no value" for a value printed
# right there, which `errors.py` forbids outright. `domain_e._value_above` already reads
# its candidates this way; this keeps the two modules' malformed-vs-missing split identical.
_NUMBER_RE = re.compile(r"^\d+(?:\.\d+)?$", re.ASCII)


# --- the closed label sets (AD-8: assert on unknown, never fuzzy-match) -------------
#
# These lists ARE the grammar. Each is 1:1 with the contract's `TeamSetPlays` /
# `FreeKickCounts` / `CornerCounts` field lists — the Story 1.16 emit-time checklist, not
# an import. Fourteen structural labels, all present on 208/208.

KPI_LABELS: "tuple[tuple[str, str], ...]" = (
    ("total_set_plays", "Total Set Plays"),
    ("total_free_kicks", "Total Free Kicks"),
    ("total_penalties", "Total Penalties"),
    ("total_corners", "Total Corners"),
    ("total_throw_ins", "Total Throw Ins"),
)

FREE_KICK_ROWS: "tuple[tuple[str, str], ...]" = (
    ("direct", "Direct"),
    ("direct_on_target", "Direct (on target)"),
    ("direct_off_target", "Direct (off target)"),
    ("indirect", "Indirect"),
)

# Three values per row, in printed left-to-right order.
CORNER_SIDE_COLUMNS: "tuple[str, ...]" = ("left", "right", "total")

CORNER_TYPE_ROWS: "tuple[tuple[str, str], ...]" = (
    ("direct_to_area", "Direct to Area"),
    ("short", "Short"),
    ("edge_of_penalty_area", "Edge of Penalty Area"),
)

CORNER_STYLE_ROWS: "tuple[tuple[str, str], ...]" = (
    ("inswing", "Inswing"),
    ("outswing", "Outswing"),
    ("driven", "Driven"),
    ("lofted", "Lofted"),
)


def _is_word_subrun(needle: str, haystack: str) -> bool:
    """Whether `needle` is a contiguous run of whole words inside `haystack`.

    Word-level, not character-level: `_label_run` joins whole spans, so `'Corners'` can
    only collide with `'Total Corners'` on a word boundary, never mid-word.
    """
    words, whole = needle.split(), haystack.split()
    return any(
        whole[start : start + len(words)] == words
        for start in range(len(whole) - len(words) + 1)
    )


def _assert_label_integrity() -> None:
    """Module-constant integrity, checked once at import (the 1.2/1.4/1.10 rule).

    An authoring bug in the label tables — a duplicated key, a label that shadows another
    within the same x band, a census that no longer matches the values the parser reads —
    must fail the run at import, not surface as 208 identical per-report failures blaming
    the corpus.
    """
    for name, table in (
        ("KPI_LABELS", KPI_LABELS),
        ("FREE_KICK_ROWS", FREE_KICK_ROWS),
        ("CORNER_TYPE_ROWS", CORNER_TYPE_ROWS),
        ("CORNER_STYLE_ROWS", CORNER_STYLE_ROWS),
    ):
        keys = [key for key, _label in table]
        labels = [label for _key, label in table]
        if len(set(keys)) != len(keys):
            raise ValueError(f"domain_f: duplicate payload key in {name}")
        if len(set(labels)) != len(labels):
            raise ValueError(f"domain_f: duplicate printed label in {name}")
    # The two corners tables share one x band, so their label sets must stay disjoint or a
    # style row could satisfy a type row's lookup (and be read for three values, not one).
    type_labels = {label for _key, label in CORNER_TYPE_ROWS}
    style_labels = {label for _key, label in CORNER_STYLE_ROWS}
    if type_labels & style_labels:
        raise ValueError(
            "domain_f: the corners delivery-type and delivery-style labels share the same "
            f"x band and must be disjoint; both carry {sorted(type_labels & style_labels)}"
        )
    # The KPI tiles are the one table matched on contiguous sub-runs (two of them share a
    # visual row), so no KPI label may be a sub-run of another — that is precisely the
    # ambiguity whole-band matching exists to avoid everywhere else.
    #
    # A PREFIX test is too narrow for what `_label_run` actually matches. It matches any
    # contiguous span run, so the real hazard is a label equal to an INTERIOR run of
    # another: `'Set Plays'` alongside `'Total Set Plays'` passes `startswith` cleanly and
    # then matches inside the longer label whenever the spans split on that boundary,
    # turning an authoring bug into 208 identical `SetPlaysParseError`s blaming the corpus.
    kpi_labels = [label for _key, label in KPI_LABELS]
    for label in kpi_labels:
        for other in kpi_labels:
            if label is not other and _is_word_subrun(label, other):
                raise ValueError(
                    f"domain_f: KPI label {label!r} is a contiguous word run inside "
                    f"{other!r}; the run matcher could not tell the two apart"
                )
    printed_values = (
        len(KPI_LABELS)
        + len(FREE_KICK_ROWS)
        + len(CORNER_TYPE_ROWS) * len(CORNER_SIDE_COLUMNS)
        + len(CORNER_STYLE_ROWS)
    )
    # 22 printed values plus the date strip's two bare integers.
    if printed_values + 2 != NUMERIC_WORD_COUNT:
        raise ValueError(
            f"domain_f: the label tables describe {printed_values} printed values, which "
            f"with the 2 date tokens is not the corpus-invariant {NUMERIC_WORD_COUNT}"
        )
    if len(KPI_LABELS) + len(FREE_KICK_ROWS) + len(CORNER_TYPE_ROWS) + len(
        CORNER_STYLE_ROWS
    ) != 16:
        raise ValueError("domain_f: expected 16 label rows across the four tables")


_assert_label_integrity()


# --- row grammar --------------------------------------------------------------------


def _band(row: "VisualRow", x_min: float, x_max: float) -> "list[TextSpan]":
    """The row's spans wholly inside `[x_min, x_max]`, left to right."""
    return [span for span in row.spans if span.x0 >= x_min and span.x1 <= x_max]


def _band_label(row: "VisualRow", x_min: float, x_max: float) -> "tuple[str, float, float]":
    """`(joined text, x0, x1)` of everything the row prints inside the label band.

    The table rows are matched on this WHOLE-band text, never on a contiguous sub-run:
    `'Direct'` is a prefix of `'Direct (on target)'` and `'Direct (off target)'`, so a
    run-based match finds three rows for one label — measured, not hypothesised (the
    first corpus sweep of this parser failed on 104/104 exactly there). Each table's own
    x band holds exactly one label per row, which is what makes whole-band equality both
    available and stricter.
    """
    spans = _band(row, x_min, x_max)
    if not spans:
        return "", 0.0, 0.0
    return join_spans(spans), spans[0].x0, spans[-1].x1


def _label_run(
    row: "VisualRow", label: str, x_min: float, x_max: float
) -> "tuple[float, float] | None":
    """`(x0, x1)` of the contiguous span run inside the band that joins to `label` exactly.

    Only the KPI tiles need this: two of them share one visual row (`'Total Free Kicks
    Total Penalties'`), so whole-band equality cannot separate them. Real pages fragment a
    label per glyph run (`'D' 'eli' 'v' 'e' 'ry'`) while the synthetic fixtures print it
    as one span, so matching is done over contiguous runs joined by `join_spans` rather
    than on span text. Exact equality, never a prefix — and no KPI label is a run-prefix
    of another, which `_assert_label_integrity` pins.
    """
    spans = _band(row, x_min, x_max)
    for start in range(len(spans)):
        for end in range(start, len(spans)):
            joined = join_spans(spans[start : end + 1])
            if joined == label:
                return spans[start].x0, spans[end].x1
            if len(joined) >= len(label):
                break
    return None


def _find_label(
    rows: "list[VisualRow]", label: str, x_min: float, x_max: float, side: str,
    report_id: "str | None", *, whole_band: bool,
) -> "tuple[int, float]":
    """`(row index, label centre x)` of the one row printing `label` inside the band.

    Exactly one, asserted: a label the page does not print is a template revision, and a
    label printed twice makes every read from it ambiguous (AD-8). Both fail loud rather
    than silently taking the first.
    """
    hits: "list[tuple[int, tuple[float, float]]]" = []
    for index, row in enumerate(rows):
        if whole_band:
            text, x0, x1 = _band_label(row, x_min, x_max)
            run = (x0, x1) if text == label else None
        else:
            run = _label_run(row, label, x_min, x_max)
        if run is not None:
            hits.append((index, run))
    if not hits:
        raise SetPlaysParseError(
            f"{side} set plays page does not print the label {label!r} between "
            f"x={x_min} and x={x_max}",
            report_id,
        )
    if len(hits) > 1:
        raise SetPlaysParseError(
            f"{side} set plays page prints the label {label!r} {len(hits)} times "
            f"(rows y={[round(rows[index].y, 2) for index, _run in hits]}); the value it "
            "keys cannot be read unambiguously",
            report_id,
        )
    index, (x0, x1) = hits[0]
    return index, (x0 + x1) / 2.0


def _parse_int(raw: str, where: str, report_id: "str | None") -> int:
    """One printed token as a non-negative integer (AC 2: raw, locale-neutral, AD-7)."""
    if not _INTEGER_RE.match(raw):
        raise MalformedFieldError(
            f"{where} is not a non-negative integer: {raw!r}", report_id
        )
    return int(raw)


def _kpi_value(
    rows: "list[VisualRow]",
    label_index: int,
    centre_x: float,
    key: str,
    side: str,
    report_id: "str | None",
) -> int:
    """The KPI value printed above its label, centred on it.

    Walks UP from the label row to the first row carrying a numeric word inside the KPI
    band whose own centre matches the label's. Deliberately not "the row immediately
    above": for `Total Set Plays` that row is the corners table's first data row, whose
    three values sit hundreds of points to the right — and for `Total Corners` it is a
    delivery-style row. The centre match is what makes the walk safe.
    """
    label_y = rows[label_index].y
    for index in range(label_index - 1, -1, -1):
        if label_y - rows[index].y > KPI_MAX_RISE_PT:
            break
        matches = [
            span
            for span in _band(rows[index], 0.0, KPI_X_MAX)
            if _NUMBER_RE.match(span.text.strip())
            and abs(span.center_x - centre_x) <= KPI_CENTRE_TOL_PT
        ]
        if not matches:
            continue
        if len(matches) > 1:
            raise SetPlaysParseError(
                f"{side} set plays KPI {key!r} has {len(matches)} candidate values "
                f"{[span.text for span in matches]} centred on x={centre_x:.1f}",
                report_id,
            )
        return _parse_int(matches[0].text.strip(), f"{side}.set_plays.{key}", report_id)
    raise MissingFieldError(
        f"{side} set plays page prints no value within {KPI_MAX_RISE_PT} pt above the "
        f"{key!r} label (centre x={centre_x:.1f})",
        report_id,
    )


def _row_values(
    row: "VisualRow",
    x_min: float,
    x_max: float,
    expected: int,
    key: str,
    side: str,
    report_id: "str | None",
) -> "list[int]":
    """The `expected` integers of one table row, left to right (AD-8: exact count).

    The count is invariant corpus-wide, so any other count is a template revision that
    must fail loud rather than shift every column by one.
    """
    tokens = [span.text.strip() for span in _band(row, x_min, x_max)]
    if len(tokens) != expected:
        raise SetPlaysParseError(
            f"{side} set plays row {key!r} carries {len(tokens)} value(s) {tokens} "
            f"between x={x_min} and x={x_max}, expected {expected}",
            report_id,
        )
    return [
        _parse_int(token, f"{side}.set_plays.{key}[{index}]", report_id)
        for index, token in enumerate(tokens)
    ]


def _page_for(
    anchors: "dict[str, list[int]]", side: str, report_id: "str | None"
) -> int:
    """The one page this side's set-plays anchor resolves to (208/208)."""
    anchor_id = f"{SET_PLAYS_ANCHOR_STEM}:{side}"
    pages = anchors.get(anchor_id)
    if not pages:
        raise SetPlaysParseError(
            f"anchor map carries no resolved {anchor_id!r} page", report_id
        )
    if len(pages) != 1:
        raise SetPlaysParseError(
            f"{anchor_id!r} anchor resolves to {len(pages)} pages {pages}; expected 1",
            report_id,
        )
    return pages[0]


def _assert_numeric_census(
    page: "pymupdf.Page", side: str, report_id: "str | None"
) -> None:
    """The page-level tripwire: exactly `NUMERIC_WORD_COUNT` bare-integer words (208/208).

    Every value this parser reads is found by label, so a printed number the label set
    does not name would simply be ignored — and a template revision that ADDS a column
    would stage a silently incomplete block. The census closes that: it is the only check
    here that sees the whole page rather than the parts the grammar names.

    Deliberately run AFTER the grammar, not before it. A template revision that DROPS a
    value already fails loud and precisely — "the `Short` row carries 2 values, expected
    3" — and running the census first would replace every such message with a page-level
    word count that localizes nothing. The census owns the one failure mode the grammar
    structurally cannot see: a number nobody read.
    """
    numeric = [
        word[4] for word in page.get_text("words") if _INTEGER_RE.match(word[4].strip())
    ]
    if len(numeric) != NUMERIC_WORD_COUNT:
        raise SetPlaysParseError(
            f"{side} set plays page carries {len(numeric)} bare-integer words {numeric}, "
            f"expected the corpus-invariant {NUMERIC_WORD_COUNT}",
            report_id,
        )


def _extract_side(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    side: str,
    report_id: "str | None",
) -> dict:
    """One team's set-plays block."""
    page = doc[_page_for(anchors, side, report_id)]
    rows = group_rows(text_spans(page))

    payload: dict = {}
    for key, label in KPI_LABELS:
        index, centre_x = _find_label(
            rows, label, 0.0, KPI_X_MAX, side, report_id, whole_band=False
        )
        payload[key] = _kpi_value(rows, index, centre_x, key, side, report_id)

    free_kicks: dict[str, int] = {}
    for key, label in FREE_KICK_ROWS:
        index, _centre = _find_label(
            rows, label, 0.0, FREE_KICK_LABEL_X_MAX, side, report_id, whole_band=True
        )
        (value,) = _row_values(
            rows[index],
            FREE_KICK_VALUE_X_MIN,
            FREE_KICK_VALUE_X_MAX,
            1,
            key,
            side,
            report_id,
        )
        free_kicks[key] = value
    payload["free_kicks"] = free_kicks

    by_type: dict[str, dict] = {}
    for key, label in CORNER_TYPE_ROWS:
        index, _centre = _find_label(
            rows,
            label,
            CORNERS_LABEL_X_MIN,
            CORNERS_LABEL_X_MAX,
            side,
            report_id,
            whole_band=True,
        )
        values = _row_values(
            rows[index],
            CORNERS_VALUE_X_MIN,
            float(page.rect.x1),
            len(CORNER_SIDE_COLUMNS),
            key,
            side,
            report_id,
        )
        by_type[key] = dict(zip(CORNER_SIDE_COLUMNS, values))
    payload["corners_by_delivery_type"] = by_type

    by_style: dict[str, int] = {}
    for key, label in CORNER_STYLE_ROWS:
        index, _centre = _find_label(
            rows,
            label,
            CORNERS_LABEL_X_MIN,
            CORNERS_LABEL_X_MAX,
            side,
            report_id,
            whole_band=True,
        )
        (value,) = _row_values(
            rows[index], CORNERS_VALUE_X_MIN, float(page.rect.x1), 1, key, side, report_id
        )
        by_style[key] = value
    payload["corners_by_delivery_style"] = by_style

    # Last, so a dropped value fails with its own row's message rather than a page-level
    # word count (see `_assert_numeric_census`).
    _assert_numeric_census(page, side, report_id)
    return payload


def extract_domain_f(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: "str | None" = None,
) -> dict:
    """Extract the Domain F payload for one report (AC 2).

    Pages are located through the already-resolved `anchors` map, never by page index
    (AD-8). Raises `SetPlaysParseError`, `MalformedFieldError` or `MissingFieldError`; the
    batch turns each into a `failed` manifest entry for this report alone. The payload is
    all-or-nothing: no partial set-plays block ever stages.
    """
    return {side: _extract_side(doc, anchors, side, report_id) for side in ("home", "away")}


# --- Self-Validation checks (SM-C1: binary, within-report, never loosened) ----------
#
# Every relation below was measured EXACT on all 208 corpus team-innings at story
# creation. Two tempting relations are deliberately absent because the corpus refutes
# them, and both are named at their call site rather than left as silence.

_check = check_entry


def domain_f_checks(payload: dict) -> "list[dict]":
    """Domain F's self-validation checks over an extracted payload (AC 2).

    Recorded, never raised — a failed consistency check is data about this report, and the
    record still stages so the gate can localize it. Exactly one dict per check id covers
    BOTH sides, with `specifics` naming every offending side in a deterministic order, so
    re-runs are byte-identical.
    """
    checks: list[dict] = []

    # AC 2's named check.
    side_notes: list[str] = []
    for side in ("home", "away"):
        block = payload[side]
        by_type = block["corners_by_delivery_type"]
        for key, _label in CORNER_TYPE_ROWS:
            row = by_type[key]
            if row["left"] + row["right"] != row["total"]:
                side_notes.append(
                    f"{side} {key}: left {row['left']} + right {row['right']} != "
                    f"total {row['total']}"
                )
        left = sum(by_type[key]["left"] for key, _label in CORNER_TYPE_ROWS)
        right = sum(by_type[key]["right"] for key, _label in CORNER_TYPE_ROWS)
        if left + right != block["total_corners"]:
            side_notes.append(
                f"{side}: left {left} + right {right} = {left + right}, total corners "
                f"{block['total_corners']}"
            )
    checks.append(
        _check(
            "set-plays-corner-sides",
            not side_notes,
            "; ".join(side_notes)
            if side_notes
            else "corner counts by side sum to each team's total corners",
        )
    )

    total_notes: list[str] = []
    for side in ("home", "away"):
        block = payload[side]
        parts = (
            block["total_free_kicks"]
            + block["total_penalties"]
            + block["total_corners"]
            + block["total_throw_ins"]
        )
        if parts != block["total_set_plays"]:
            total_notes.append(
                f"{side}: free kicks {block['total_free_kicks']} + penalties "
                f"{block['total_penalties']} + corners {block['total_corners']} + throw-ins "
                f"{block['total_throw_ins']} = {parts}, total set plays "
                f"{block['total_set_plays']}"
            )
        free_kicks = block["free_kicks"]
        # `direct + indirect == total_free_kicks` is true on 208/208. NOT checked, and
        # deliberately: the contract's own `FreeKickCounts` $comment asserts
        # `direct == direct_on_target + direct_off_target`, which is FALSE on 208/208 real
        # team-innings — 160 of them print `on + off == 0` while `direct > 0`. Shipping it
        # would flood the gate with 208 false count-mismatches (Task 9.4b files it).
        nested = free_kicks["direct"] + free_kicks["indirect"]
        if nested != block["total_free_kicks"]:
            total_notes.append(
                f"{side}: direct {free_kicks['direct']} + indirect "
                f"{free_kicks['indirect']} = {nested}, total free kicks "
                f"{block['total_free_kicks']}"
            )
        by_type_total = sum(
            block["corners_by_delivery_type"][key]["total"] for key, _label in CORNER_TYPE_ROWS
        )
        if by_type_total != block["total_corners"]:
            total_notes.append(
                f"{side}: delivery-type totals sum to {by_type_total}, total corners "
                f"{block['total_corners']}"
            )
        # NOT checked: `sum(delivery style) == total_corners`. It is the obvious relation
        # and it is corpus-FALSE on 112 of 208 team-innings — the style table is simply not
        # a partition of the corners. Adding it would fail more than half the corpus for a
        # relation the source never claimed.
    checks.append(
        _check(
            "set-plays-totals",
            not total_notes,
            "; ".join(total_notes)
            if total_notes
            else "set-play totals, free-kick nesting and delivery-type totals all consistent",
        )
    )

    return checks

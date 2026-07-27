"""Defensive-actions pitch-map parser: shared filter chain -> AD-6 defensive events.

`teamId` is the **DEFENDING** team (`contract/match-bundle.schema.json`'s
`DefensiveActionEvent` `$comment`), and on this page family that is simply the team the
anchor names: `Defensive Actions {team}` plots that team's own defensive actions. The
call is mechanically the same `team_slug(team_name)` the crosses and shots parsers make,
but the semantics are the opposite end of the event — do NOT re-derive it as the
"crossing/shooting team" pattern.

The layout, measured on all 104 reports / 208 pages (Task 1 probe):

- ONE anchored page per team, carrying TWO stroked pitch panels of all-but-identical
  area (61,168.1435 and 61,168.1451 pt^2, byte-identical rects on 208/208 pages). The
  0.0016 pt^2 difference is why `detect_pitch_frame`'s `max` silently discarded the LEFT
  panel on every corpus page; this parser composes the chain over `detect_pitch_frames`
  instead, and types each panel from its own printed title.
- The marker family is NOT keyed by colour. Every marker on every page shares ONE fill,
  (0.18, 0.30, 1.00) — the same blue the shots palette calls `incomplete` and the crosses
  palette calls `completed`. Palettes are per-family (FR-11), and here the discriminator
  is which titled panel the marker sits in (AD-8: text-anchored, never positional).
  `key_outcomes` stays in the chain regardless: it is the assert-on-unknown seam, so a
  second fill entering the size window inside a panel aborts the report with its RGB and
  page rather than being silently typed as a defensive action.
- Each panel prints its OWN rotated `DIRECTION` label inside its frame, and the parser
  asserts that vector per panel before normalizing anything. Both panels agree on
  208/208 pages, but only the possession-regain map has a physical own-half invariant to
  fall back on — a mirrored forced-turnover panel would publish `100 - x` for every event
  it holds and no count, clamp or gate check would see it.
- Only two of the contract's four `DefensiveActionType` values are pitch maps
  ("Forced Turnovers", "Possession Regain"); "Blocks" and "Possession Contests" are
  aggregate panels with no coordinates, so `events.defensiveActions` can only ever carry
  the two mapped families (ledgered as an AD-14 note for Story 1.16).

Three same-page shapes the size window and panel containment have to survive, all
measured rather than assumed:

- The bullet swatches of the right-hand Possession-Contests list are 9.0 x 9.02 pt and
  include the markers' EXACT blue. Markers are 8.8715 x 8.8651 pt at the corpus maximum —
  a 0.13 pt separation, tighter than any earlier family — so `marker_max_pt` sits inside
  that gap and is never rounded up to 9.0. (Panel containment also excludes them: they
  print at x >= 622, outside both panels. Two independent defenses, both kept.)
- Each panel's four corner arcs are stroke-only Beziers of the marker's exact width
  (8.871 pt, 8 items). Only `collect_candidate_markers`' `fill is None` test excludes
  them; the size window cannot.
- The penalty spots (1.479 pt) and centre spot (2.957 pt) are FILLED all-Bezier circles
  INSIDE the panels, drawn white. `marker_min_pt` is what keeps them out — without it
  they would reach `key_outcomes` and abort every report in the corpus on a white RGB.

`exclude_legend_rows` is a no-op by construction here (the swatches are a vertical stack,
one colour per y, so no y-bucket ever reaches `legend_min_colors`) and is kept in the
production path anyway: the recipe is the recipe (Story 1.5's review restored it after an
inlined copy went dead).

No linking pass exists: the probe found zero digit glyphs inside either panel on 208/208
pages and the page carries no per-event rows, so marker <-> row correspondence is
structurally absent. Events carry `contest_type: None`.

Pure: no I/O beyond the open `pymupdf.Document`. Story 1.12 Tasks 2-5.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from pipeline.ingest.identity import team_slug
from pipeline.markers.attempts import table_lines
from pipeline.markers.errors import (
    DefensiveActionsCoordinateError,
    DefensiveActionsPageLayoutError,
    DefensiveActionsTableError,
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

# The one fill every defensive-action marker carries, corpus-wide (20,169 markers over
# 208 pages, Task 1 census). A degenerate one-entry palette: the internal key names what
# the page encodes — the marker's *family* comes from its panel, not from this lookup —
# and no string outcome is staged from it.
DEFENSIVE_ACTIONS_RGB_TO_OUTCOME: dict[tuple[float, float, float], str] = {
    (0.18, 0.30, 1.00): "defensive-action",
}

# Markers measure 8.8713-8.8715 pt wide by 8.8650-8.8651 pt high across the whole corpus.
# The upper bound sits in the 0.13 pt gap below the 9.0 pt swatches (see module docstring)
# and must never be widened to a round 9.0; the lower bound excludes the in-panel white
# 2.957 pt centre spot and 1.479 pt penalty spots. `pitch_margin_pt` admits the corpus'
# maximum overshoot of a marker center beyond its own panel edge (0.296 pt).
DEFENSIVE_ACTIONS_MARKER_SPEC = MarkerSpec(
    marker_min_pt=8.5,
    marker_max_pt=8.95,
    rgb_to_outcome=DEFENSIVE_ACTIONS_RGB_TO_OUTCOME,
    pitch_margin_pt=0.5,
)

# Printed panel title -> the contract's `DefensiveActionType` enum. Frozen literals,
# never schema imports (the `CROSS_DELIVERY_LABEL_TO_ENUM` precedent); a test
# cross-checks every value against contract/common.schema.json. All four contract codes
# are mapped even though only the first two are drawn as maps — an aggregate panel that
# ever grows a pitch map must key to the code the contract already fixes, not a new one.
DEFENSIVE_ACTION_LABEL_TO_ENUM: dict[str, str] = {
    "Forced Turnovers": "forced-turnover",
    "Possession Regain": "possession-regain",
    "Blocks": "block",
    "Possession Contests": "possession-contest",
}

# The two titled panels every corpus page presents, as action-type codes. A page showing
# any other set of titled panels is a template revision, not a page to guess at.
MAPPED_ACTION_TYPES = ("forced-turnover", "possession-regain")

# Each panel prints its title just above its own frame (the title's bottom sits 5.4 pt
# above the top edge, its top 15.9 pt above, on 208/208 pages) and inside the frame's
# x-span — the geometry that makes panel -> family typing text-anchored. The 25.0 pt
# window absorbs a font-metric change and still clears the headline label band, whose
# nearest word bottom is 53.0 pt above the frame top.
_TITLE_BAND_PT = 25.0
_TITLE_X_MARGIN_PT = 2.0

# Each panel prints its OWN rotated `DIRECTION` label inside its frame, and AD-6's
# formula pair is only correct for the orientation that label fixes. Both panels carry
# the same vector on 208/208 pages; the forced-turnover map has no physical own-half
# invariant to fall back on (a high-pressing team forces turnovers in the opponent's
# half), so this label is the ONLY evidence that panel is not mirrored. Asserted per
# panel before any coordinate is normalized: a re-oriented panel is a template revision
# that would otherwise silently publish `100 - x` for every event it holds.
_DIRECTION_LABEL = "DIRECTION"
_DIRECTION_VECTOR = (0.0, -1.0)
# The vector is computed from the text matrix, so it carries float noise (the corpus
# prints 6.1e-17 for the x component, not a clean 0.0).
_DIRECTION_TOLERANCE = 1e-6

# The headline band above the panels prints each family's own total as a value with its
# label stacked ~48 pt below it, centred on the same x (208/208 pages, max centre offset
# < 0.5 pt). The value is looked up from the label, never by absolute position. BOTH
# families' totals are read (Task 4.2); whether a total is a usable counterpart is a
# separate question `UNCOUNTED_FAMILIES` answers.
_HEADLINE_LABELS = {"forced-turnover": "Turnovers", "possession-regain": "Regained"}
_HEADLINE_MIN_DY_PT = 15.0
_HEADLINE_MAX_DY_PT = 80.0
_HEADLINE_X_TOLERANCE_PT = 6.0

# The per-player table header stacks "Total" / "Possession" / "Regains" over three lines
# above the row band; the main line carries '#' and 'Player'.
_TABLE_HEADER_BAND_PT = 12.0
# The table region starts at the '#' column. `table_lines` clusters across the FULL page
# width, and the middle-column panels share table rows' y-clusters exactly — on the
# ground-truth page five of the sixteen rows cluster with 'Passes', 'Clearances',
# 'Aerial Duels', 'Most Possession Regains' and 'LEFT BACK' at 0.0 pt. Both failure modes
# the x-restriction closes are live: without it those rows' leftmost cell is a non-digit
# word, so the row is silently DROPPED, and the Possession-Contests total (x 543) forms
# its own cluster whose leftmost word IS a digit, so it would be admitted as a phantom
# row. (The trap `crosses.py::_cross_table_rows` documents, one column family over.)
_TABLE_X_MARGIN_PT = 10.0
# Name words may straddle the numeric row line, as on the crosses page.
_NAME_Y_TOLERANCE_PT = 6.0
_NAME_X_MARGIN_PT = 5.0

# `re.ASCII`: fullwidth digits otherwise satisfy `\d` and `int()` accepts them happily.
_DIGITS_RE = re.compile(r"\d+", re.ASCII)

# Stored coordinates are rounded to 2 decimals (PitchX/PitchY `x-decimals: 2`).
COORD_DECIMALS = 2

# Only the sub-tolerance overshoot the pitch margin admits is clamped into [0, 100]: a
# 0.5 pt margin on the narrower (207 pt) panel axis normalizes to at most 0.24, and the
# corpus maximum is 0.14. Anything further out is a mis-normalization and fails loud
# rather than being rewritten to a plausible boundary (the Story 1.11 review decision).
COORD_CLAMP_TOLERANCE = 0.5

# The possession-regain map has NO established printed counterpart (Task 1.2, decided by
# measurement over all 208 pages): its marker count equals no printed number on the page
# and no +/-1 linear combination of them, differing from the printed "Possession
# Regained" total by -3..+36. The printed total and the per-player `Total Possession
# Regains` column sum equal each other on 208/208 pages, so they are a consistent count
# of something the map is not plotting. Checking the map against them would report 208
# false failures, and checking it against its own marker count is a tautology — so the
# family takes AC 2's documented-absence branch: no check, `table: None`, one warning.
# Its printed total is still STAGED (as `printed_total`), so the delta stays on the
# record as standing evidence for the AD-14 note rather than needing a re-probe.
UNCOUNTED_FAMILIES = ("possession-regain",)
ABSENT_COUNTERPART_WARNING = (
    "defensive-actions: no marker-count check recorded for the possession-regain map "
    "(that panel's marker count matches no total printed on the page)"
)


def parse_defensive_actions(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: str,
    home_team: str,
    away_team: str,
) -> dict:
    """Extract both teams' defensive-actions domain block from an open report.

    `anchors` is the record's anchor map (0-based page indices). Each team's
    `defensive-actions:{side}` anchor must resolve to exactly one page, and that page
    must present exactly the two titled pitch panels the corpus fixes; anything else
    raises `DefensiveActionsPageLayoutError`. Raises `PitchFrameError`, `UnknownRgbError`
    (FR-11), `UnknownLabelError` (an unmapped panel title), `DefensiveActionsTableError`
    and `DefensiveActionsCoordinateError`, all typed and report-scoped. A count mismatch
    is NOT an exception — it lands in `counts` for
    `defensive_actions_self_validation_block` to judge.
    """
    events: list[dict] = []
    table_rows: dict[str, list[dict]] = {}
    counts: dict[str, dict[str, dict]] = {}
    warnings: list[str] = []
    for side, team_name in (("home", home_team), ("away", away_team)):
        anchor_id = f"defensive-actions:{side}"
        pages = anchors.get(anchor_id)
        if not isinstance(pages, list) or len(pages) != 1:
            raise DefensiveActionsPageLayoutError(anchor_id, pages, report_id)
        page_index = pages[0]
        page = doc[page_index]

        frames = detect_pitch_frames(page, report_id)
        words = _page_words(page)
        panels, title_indices = _typed_panels(
            frames, words, anchor_id, pages, report_id, page_index
        )
        directions = _panel_directions(page)
        # "Forced Turnovers" prints twice on the page — once as the left panel's title,
        # once as the headline's stacked label — so the headline lookup runs over the
        # words no panel title consumed, which leaves each label unique (208/208 pages).
        headline_words = [
            word for index, word in enumerate(words) if index not in title_indices
        ]

        team_id = team_slug(team_name)
        drawings = page.get_drawings()
        side_counts: dict[str, dict] = {}
        for panel_index, pitch, action_type in panels:
            # Before any coordinate is normalized: this panel's own DIRECTION label must
            # fix the orientation AD-6's formula pair assumes.
            _assert_panel_orientation(
                directions, pitch, action_type, anchor_id, pages, report_id, page_index
            )
            candidates = collect_candidate_markers(
                drawings, pitch, DEFENSIVE_ACTIONS_MARKER_SPEC
            )
            markers = exclude_legend_rows(candidates, DEFENSIVE_ACTIONS_MARKER_SPEC)
            keyed = key_outcomes(markers, DEFENSIVE_ACTIONS_MARKER_SPEC, report_id, page_index)
            for marker in keyed:
                # AD-6 against the marker's OWN panel rect, never a shared frame.
                x = round(100 * (pitch.y1 - marker.pdf_y) / pitch.height, COORD_DECIMALS)
                y = round(100 * (marker.pdf_x - pitch.x0) / pitch.width, COORD_DECIMALS)
                events.append(
                    {
                        "team_id": team_id,
                        "action_type": action_type,
                        "x": _clamp_coord(x, "x", report_id, page_index),
                        "y": _clamp_coord(y, "y", report_id, page_index),
                        # No linking pass exists (no digit glyphs, no per-event rows), so
                        # the contest breakdown is unrecoverable from this page.
                        "contest_type": None,
                        "source": {
                            "page_index": page_index,
                            "panel": panel_index,
                            "pdf_x": round(marker.pdf_x, COORD_DECIMALS),
                            "pdf_y": round(marker.pdf_y, COORD_DECIMALS),
                        },
                    }
                )
            # Staging keys are snake_case by rule (AD-9; kebab is reserved for
            # page-family section names — the `_DELIVERY_COLUMN_ORDER` precedent), so the
            # contract's kebab code travels as a VALUE inside the entry rather than being
            # round-tripped out of the key.
            # Both families' printed headline totals are captured (Task 4.2). Only a
            # family with an ESTABLISHED counterpart promotes its total to `table`, which
            # is what `defensive_actions_self_validation_block` keys the check on; for
            # possession-regain the number is recorded as evidence and `table` stays None.
            printed_total = _headline_value(
                headline_words, action_type, report_id, page_index
            )
            side_counts[action_type.replace("-", "_")] = {
                "action_type": action_type,
                "markers": len(keyed),
                "printed_total": printed_total,
                "table": None if action_type in UNCOUNTED_FAMILIES else printed_total,
            }
        table_rows[side] = _regain_table_rows(page, report_id, page_index)
        counts[side] = side_counts

    if any(
        family.replace("-", "_") in counts[side]
        for side in ("home", "away")
        for family in UNCOUNTED_FAMILIES
    ):
        # One warning per report, not per side/family: `batch.py` mirrors the record's
        # warnings into the manifest entry, and the absence is a property of the page
        # family, not of one team's page.
        warnings.append(ABSENT_COUNTERPART_WARNING)

    # Deterministic record order (AD-8): team, family, then map page and pdf position.
    events.sort(
        key=lambda event: (
            event["team_id"],
            event["action_type"],
            event["source"]["page_index"],
            event["source"]["pdf_y"],
            event["source"]["pdf_x"],
        )
    )
    return {
        "defensive_action_events": events,
        "regain_table_rows": table_rows,
        "counts": counts,
        "warnings": warnings,
    }


def defensive_actions_self_validation_block(counts: "dict[str, dict[str, dict]]") -> list[dict]:
    """The record's per-team, per-family `defensive-actions-marker-count` checks.

    Binary and exact — no tolerance, never loosened (FR-14, SM-C1, AD-8). Both counts are
    always recorded, pass or fail. A family whose `table` count is `None` emits NO check
    at all: `aggregate_self_validation` treats anything but a literal `"pass"` as a fail,
    so a "not-applicable" check would fail the record for a counterpart that never
    existed. That documented absence travels as `counts[...]["table"] = None` plus the
    per-report warning `parse_defensive_actions` stages (AC 2's absence branch).
    """
    return [
        {
            "check": "defensive-actions-marker-count",
            "team": side,
            "family": family_counts["action_type"],
            "result": "pass" if family_counts["markers"] == family_counts["table"] else "fail",
            "marker_count": family_counts["markers"],
            "table_count": family_counts["table"],
        }
        for side in ("home", "away")
        for _key, family_counts in sorted(counts[side].items())
        if family_counts["table"] is not None
    ]


def _clamp_coord(value: float, axis: str, report_id: str, page_index: int) -> float:
    """Clamp a normalized coordinate into [0, 100] — but only the sub-tolerance overshoot.

    The pitch margin admits real markers whose centers sit a fraction of a point beyond
    their panel (normalizing to at most ~0.24 outside the range); those clamp cleanly. A
    value further out cannot come from an in-margin marker on a correctly detected panel,
    so it raises rather than being silently rewritten to a plausible boundary (AD-8).
    """
    if value < -COORD_CLAMP_TOLERANCE or value > 100.0 + COORD_CLAMP_TOLERANCE:
        raise DefensiveActionsCoordinateError(axis, value, report_id, page_index)
    return min(100.0, max(0.0, value))


def _page_words(page: "pymupdf.Page") -> "list[tuple[float, float, float, float, str]]":
    """Every non-blank word as (x0, y0, x1, y1, text)."""
    return [
        (x0, y0, x1, y1, text)
        for x0, y0, x1, y1, text, *_ in page.get_text("words")
        if text.strip()
    ]


def _panel_title(
    pitch: "pymupdf.Rect", words: "list[tuple[float, float, float, float, str]]"
) -> "tuple[str, set[int]]":
    """The title printed immediately above `pitch`, and the indices of its words.

    Title association is geometric only in the weak sense the page itself fixes: the
    words sit in a band just above the frame's top edge and inside its x-span. Which
    marker family the panel holds is then read from those words through the frozen label
    map — text-anchored typing, never "the left panel is forced turnovers" (AD-8).
    """
    band = [
        (index, word)
        for index, word in enumerate(words)
        if pitch.y0 - _TITLE_BAND_PT < word[3] <= pitch.y0 + 1
        and word[0] >= pitch.x0 - _TITLE_X_MARGIN_PT
        and word[2] <= pitch.x1 + _TITLE_X_MARGIN_PT
    ]
    band.sort(key=lambda pair: pair[1][0])
    return " ".join(word[4] for _index, word in band), {index for index, _word in band}


def _typed_panels(
    frames: "list[pymupdf.Rect]",
    words: "list[tuple[float, float, float, float, str]]",
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> "tuple[list[tuple[int, pymupdf.Rect, str]], set[int]]":
    """Each detected panel as (drawing-order index, rect, action type), plus the word
    indices its title consumed.

    The panel COUNT is checked first, so a page that grows or loses a qualifying stroked
    rect reports as the layout revision it is; before this check a third panel surfaced
    as `UnknownLabelError('')`, blaming an empty title for a structural change. A title
    outside the frozen map is then `UnknownLabelError` — the assert-on-unknown rule
    applied to labels, so a renamed panel can never be silently typed as the family that
    happens to sit in that position. A duplicated title survives both and is caught by
    the final set comparison against `MAPPED_ACTION_TYPES`.
    """
    if len(frames) != len(MAPPED_ACTION_TYPES):
        raise DefensiveActionsPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index} presents {len(frames)} stroked pitch panels, expected "
            f"{len(MAPPED_ACTION_TYPES)}",
        )
    typed: list[tuple[int, "pymupdf.Rect", str]] = []
    consumed: set[int] = set()
    for index, pitch in enumerate(frames):
        title, word_indices = _panel_title(pitch, words)
        action_type = DEFENSIVE_ACTION_LABEL_TO_ENUM.get(title)
        if action_type is None:
            raise UnknownLabelError("Defensive Actions panel title", title, page_index, report_id)
        typed.append((index, pitch, action_type))
        consumed |= word_indices
    found = sorted(action_type for _index, _pitch, action_type in typed)
    if found != sorted(MAPPED_ACTION_TYPES):
        raise DefensiveActionsPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index} presents titled pitch panels {found}, expected "
            f"{sorted(MAPPED_ACTION_TYPES)}",
        )
    return typed, consumed


def _panel_directions(page: "pymupdf.Page") -> "list[tuple[float, float, tuple[float, float]]]":
    """Every rotated `DIRECTION` label as (center x, center y, writing-direction vector).

    Read from `get_text("dict")` rather than `get_text("words")` because the direction
    vector is a property of the line, and it is the whole point of the lookup.
    """
    found: list[tuple[float, float, tuple[float, float]]] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text != _DIRECTION_LABEL:
                continue
            x0, y0, x1, y1 = line["bbox"]
            direction = tuple(line["dir"])
            found.append(((x0 + x1) / 2, (y0 + y1) / 2, direction))
    return found


def _assert_panel_orientation(
    directions: "list[tuple[float, float, tuple[float, float]]]",
    pitch: "pymupdf.Rect",
    action_type: str,
    anchor_id: str,
    pages: "list[int]",
    report_id: str,
    page_index: int,
) -> None:
    """Fail loud unless this panel's own `DIRECTION` label fixes the assumed orientation.

    AD-6 normalization is a formula pair, not a measurement: `x` counts up towards the
    opponent's goal line only while the panel is drawn the way the corpus draws it. The
    possession-regain map has a physical own-half invariant to fall back on, but the
    forced-turnover map deliberately has none (a high-pressing team forces turnovers in
    the opponent's half), so a mirrored panel would publish `100 - x` for every event it
    holds and no count, clamp or gate check would notice. The label is the page's own
    statement of which way it is drawn, so it is what gets asserted (AD-8: read the page,
    never assume the template).
    """
    inside = [
        direction
        for center_x, center_y, direction in directions
        if pitch.x0 <= center_x <= pitch.x1 and pitch.y0 <= center_y <= pitch.y1
    ]
    if len(inside) != 1:
        raise DefensiveActionsPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the {action_type} panel carries {len(inside)} "
            f"{_DIRECTION_LABEL!r} labels, expected exactly one to fix its orientation",
        )
    direction = inside[0]
    if any(
        abs(component - expected) > _DIRECTION_TOLERANCE
        for component, expected in zip(direction, _DIRECTION_VECTOR)
    ):
        raise DefensiveActionsPageLayoutError(
            anchor_id,
            pages,
            report_id,
            f"page {page_index}: the {action_type} panel's {_DIRECTION_LABEL!r} label "
            f"reads {direction}, expected {_DIRECTION_VECTOR}; the panel is re-oriented "
            "and AD-6 normalization would mirror every marker it holds",
        )


def _headline_value(
    words: "list[tuple[float, float, float, float, str]]",
    action_type: str,
    report_id: str,
    page_index: int,
) -> int:
    """The family's own printed total from the headline band, looked up from its label.

    The page prints five headline values in a row with their labels stacked below them;
    the value belonging to a label is the integer directly above it, centred on the same
    x (offset < 0.5 pt on 208/208 pages). Anchored on the label word, never on an
    absolute position — and never on Key Statistics, which counts a different domain's
    scalars (Domain B, Story 1.7).
    """
    label_word = _HEADLINE_LABELS[action_type]
    matches = [word for word in words if word[4] == label_word]
    if len(matches) != 1:
        raise DefensiveActionsTableError(
            f"{len(matches)} headline labels {label_word!r} found outside the panel "
            f"titles; the {action_type} total cannot be located",
            report_id,
            page_index,
        )
    label = matches[0]
    label_center = (label[0] + label[2]) / 2
    candidates = [
        word
        for word in words
        if _DIGITS_RE.fullmatch(word[4])
        and _HEADLINE_MIN_DY_PT < label[1] - word[1] < _HEADLINE_MAX_DY_PT
    ]
    if not candidates:
        raise DefensiveActionsTableError(
            f"no printed value above the headline label {label_word!r}",
            report_id,
            page_index,
        )
    # `candidates` is unrestricted in x (the headline columns are not at fixed positions),
    # so the column match must be unambiguous rather than merely nearest: "closest digit
    # wins" would silently accept an unrelated number if the real value ever failed to
    # parse as a bare digit run.
    within = [
        word
        for word in candidates
        if abs((word[0] + word[2]) / 2 - label_center) <= _HEADLINE_X_TOLERANCE_PT
    ]
    if not within:
        best = min(candidates, key=lambda word: abs((word[0] + word[2]) / 2 - label_center))
        offset = abs((best[0] + best[2]) / 2 - label_center)
        raise DefensiveActionsTableError(
            f"the nearest value above the headline label {label_word!r} is {offset:.1f} pt "
            "off its centre; the headline columns cannot be matched",
            report_id,
            page_index,
        )
    if len(within) > 1:
        raise DefensiveActionsTableError(
            f"{len(within)} printed values sit within {_HEADLINE_X_TOLERANCE_PT} pt of the "
            f"headline label {label_word!r}; the {action_type} total is ambiguous",
            report_id,
            page_index,
        )
    return int(within[0][4])


def _regain_table_rows(page: "pymupdf.Page", report_id: str, page_index: int) -> list[dict]:
    """The per-player `Total Possession Regains` rows, staged verbatim in printed order.

    The house pattern: rows cluster at the shared 3 pt tolerance (`table_lines`), but
    ONLY within the table's x-region, derived from the header's own '#' position rather
    than hardcoded — the middle-column panels share table rows' y-clusters outright (0.0
    pt on the ground-truth page), so an x-unrestricted rule would both drop real rows and
    admit a panel total as a phantom one. Row admission: leftmost region word is a
    pure-ASCII-digit shirt number; the row must then carry a printed name in the name
    band and a numeric total. Zero admitted rows is a valid table.

    Staged, not checked: these rows count the same thing the printed "Possession
    Regained" total counts (they agree on 208/208 pages) — which is NOT what the
    possession-regain MAP plots (see `UNCOUNTED_FAMILIES`). They are raw material for
    later work, never this story's counterpart.
    """
    lines = table_lines(page)
    words = [(x0, y0, text) for x0, y0, _x1, _y1, text, *_ in page.get_text("words") if text.strip()]

    header_y, header_cells = _regain_header_line(lines, report_id, page_index)
    table_x_min = min(x for x, word in header_cells if word == "#") - _TABLE_X_MARGIN_PT
    # Derived from the x-RESTRICTED header cells, never the full-width cluster. The
    # middle-column panels share this cluster's y-line (see `_TABLE_X_MARGIN_PT`), so a
    # stray 'Player' printed left of the table would start the name band half a page
    # early and sweep unrelated text into every row's `player_name` — silently, because
    # the staged rows are checked against nothing. `crosses.py:304` restricts it for the
    # same reason.
    player_columns = [
        x for x, word in header_cells if word == "Player" and x >= table_x_min
    ]
    if len(player_columns) != 1:
        raise DefensiveActionsTableError(
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
        # Two cells, not three: the name is gathered separately from the name x-band
        # across neighbouring lines (`_NAME_Y_TOLERANCE_PT`), so a name printed on its
        # own line leaves the numeric cluster holding just the shirt number and the
        # total. Requiring the name to sit IN the row cluster would abort the whole
        # report on exactly the two-line names that band exists to support; a row that
        # genuinely has no name is caught by the `name_words` check below.
        if len(region) < 2:
            raise DefensiveActionsTableError(
                f"row at y={y:.1f} has {len(region)} cells, expected at least a shirt "
                "number and a Total Possession Regains value",
                report_id,
                page_index,
            )
        total_x, total_word = region[-1]
        if not _DIGITS_RE.fullmatch(total_word):
            raise DefensiveActionsTableError(
                f"row at y={y:.1f} trailing cell {total_word!r} is not a numeric total",
                report_id,
                page_index,
            )
        name_band = (player_x - _NAME_X_MARGIN_PT, total_x - _NAME_X_MARGIN_PT)
        name_words = sorted(
            (y0, x0, text)
            for x0, y0, text in words
            if name_band[0] <= x0 < name_band[1] and abs(y0 - y) <= _NAME_Y_TOLERANCE_PT
        )
        if not name_words:
            raise DefensiveActionsTableError(
                f"row at y={y:.1f} (shirt {region[0][1]}) has no player name in the name "
                "column",
                report_id,
                page_index,
            )
        rows.append(
            {
                "shirt_number": int(region[0][1]),
                "player_name": " ".join(text for _y, _x, text in name_words),
                "total_possession_regains": int(total_word),
            }
        )
    return rows


def _regain_header_line(
    lines: "list[tuple[float, list[tuple[float, str]]]]", report_id: str, page_index: int
) -> "tuple[float, list[tuple[float, str]]]":
    """The single line carrying both '#' and 'Player' — the regains table's main header.

    'Possession' and 'Regains' print on their own stacked lines above it, and
    'Possession' also appears in the headline band and the contests panel, so the
    '#'+'Player' pair is the only unambiguous anchor for the table region.
    """
    matches = [
        (y, cells)
        for y, cells in lines
        if any(word == "#" for _x, word in cells) and any(word == "Player" for _x, word in cells)
    ]
    if not matches:
        raise DefensiveActionsTableError(
            "no header line containing both '#' and 'Player' found",
            report_id,
            page_index,
        )
    if len(matches) > 1:
        raise DefensiveActionsTableError(
            f"{len(matches)} header-shaped lines found; the possession-regains table is "
            "ambiguous",
            report_id,
            page_index,
        )
    header_y, cells = matches[0]
    if sum(1 for _x, word in cells if word == "#") != 1:
        raise DefensiveActionsTableError(
            "header line does not carry exactly one '#' column title; the table region "
            "cannot be derived",
            report_id,
            page_index,
        )
    return header_y, cells

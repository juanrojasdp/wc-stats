"""Domain C extraction: tactical identity (Story 1.7, FR-5).

One open report in, one JSON-ready `domains["tactical_identity"]` block out. Pure in
the AD-9 sense: no filesystem writes, no timestamps, no absolute paths, no cross-report
knowledge. Two page families feed it, located by anchor, never by page index (AD-8):

**Phases of Play** (one page, both teams): two sections headed `IN POSSESSION` (8 rows)
and `OUT OF POSSESSION` (9 rows). Per phase row the home percentage prints left of the
centred label and the away percentage right of it — the value x varies with the value
(bar-end placement), so spans are classified relative to the row's own label position,
never by fixed bands. The Defensive Block distribution is a projection of the same
three parsed `high/mid/low block` values (the Phases page is their only source, per the
contract `DefensiveBlockDistribution` $comment) — copied at build time, never
re-parsed, so the two views cannot disagree by construction. The blocks are independent
per-phase rates that do NOT sum to 100 (AC 2's evidence-driven correction).

**Line Height & Team Length** (four pages: in-possession and defensive, one per team):
three pitch panels in x-thirds, each printing exactly three metre values with no
textual key for what each measures. The key is drawn, not written — each value sits on
the arrow badge of a measurement bracket, and the bracket geometry classifies it
(Task 4.3's investigation, the rule verified on all 104 reports x 4 pages x 3 panels =
3,744 values):

- a bracket with horizontal rails measures the team block's x-extent -> `team_width`
- a bracket with vertical rails whose extent reaches a pitch goal-line edge measures
  the gap from the own goal line to the block's nearest edge -> `line_height`
- the other vertical bracket spans the block itself -> `team_length`

Each panel carries exactly one of each; anything else raises `LineHeightParseError` —
the classification is never guessed (AD-8).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from pipeline.discover.text import normalize
from pipeline.extract.errors import (
    LineHeightParseError,
    MissingFieldError,
    PhasesParseError,
    UnknownStatisticError,
)
from pipeline.extract.lines import TextSpan, group_rows, join_spans, text_spans

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# --- Phases of Play (Task 3) ------------------------------------------------------

# The optional space mirrors Domain B's percent grammar: the Key Statistics template
# demonstrably prints a spaced `NN %` (split spans); tolerate the same on the phases
# page rather than misread a spaced value as label text.
_PHASE_PERCENT_RE = re.compile(r"^(\d+(?:\.\d+)?) ?%$", re.ASCII)

_IN_POSSESSION_HEADER = "IN POSSESSION"
_OUT_OF_POSSESSION_HEADER = "OUT OF POSSESSION"

# Closed label sets (AD-3). `Counter-press` arrives as three spans on the real page;
# rows are rejoined before matching, so the map keys are the joined forms.
_IN_POSSESSION_PHASES: dict[str, str] = {
    "Build Up Unopposed": "build_up_unopposed",
    "Build Up Opposed": "build_up_opposed",
    "Progression": "progression",
    "Final Third": "final_third",
    "Long Ball": "long_ball",
    "Attacking Transition": "attacking_transition",
    "Counter Attack": "counter_attack",
    "Set Piece": "set_piece",
}
_OUT_OF_POSSESSION_PHASES: dict[str, str] = {
    "High Press": "high_press",
    "Mid Press": "mid_press",
    "Low Press": "low_press",
    "High Block": "high_block",
    "Mid Block": "mid_block",
    "Low Block": "low_block",
    "Recovery": "recovery",
    "Defensive Transition": "defensive_transition",
    "Counter-press": "counter_press",
}


def _parse_phase_row(
    spans: "tuple[TextSpan, ...]", report_id: str | None
) -> "tuple[str, float, float] | None":
    """One row between/below the section headers -> (label, home %, away %).

    Returns `None` for a row carrying no percentage span at all — furniture, never a
    label candidate. A %-bearing row must show exactly one percentage span left of the
    label's start and one right of the label's end (Task 3.2); the tiny-value case
    (`0%` / `1%` bars ending near the centre) still satisfies this because the value
    always stays on its own team's side of the label.
    """
    percent_spans = [span for span in spans if _PHASE_PERCENT_RE.match(span.text.strip())]
    if not percent_spans:
        return None
    label_spans = [
        span for span in spans if not _PHASE_PERCENT_RE.match(span.text.strip())
    ]
    joined = join_spans(spans)
    if not label_spans:
        raise PhasesParseError(f"phase row {joined!r} carries no label", report_id)
    label = normalize(join_spans(label_spans))
    label_start = min(span.x0 for span in label_spans)
    label_end = max(span.x1 for span in label_spans)
    left = [span for span in percent_spans if span.x1 <= label_start]
    right = [span for span in percent_spans if span.x0 >= label_end]
    if len(percent_spans) != 2 or len(left) != 1 or len(right) != 1:
        raise PhasesParseError(
            f"phase row {joined!r} has {len(left)} percentage span(s) left of the "
            f"label and {len(right)} right of it (expected exactly 1 each)",
            report_id,
        )
    home = float(_PHASE_PERCENT_RE.match(left[0].text.strip()).group(1))
    away = float(_PHASE_PERCENT_RE.match(right[0].text.strip()).group(1))
    return label, home, away


def _parse_phases_page(page: "pymupdf.Page", report_id: str | None) -> dict:
    """Both teams' 8+9 phase percentages off the one Phases of Play page."""
    rows = group_rows(text_spans(page))

    section: str | None = None
    values: dict[str, dict[str, float]] = {"home": {}, "away": {}}
    seen: set[str] = set()
    for row in rows:
        joined = join_spans(row.spans)
        if joined == _IN_POSSESSION_HEADER:
            if section is not None:
                raise PhasesParseError("two IN POSSESSION section headers", report_id)
            section = "in"
            continue
        if joined == _OUT_OF_POSSESSION_HEADER:
            if section != "in":
                raise PhasesParseError(
                    "OUT OF POSSESSION header arrived before IN POSSESSION", report_id
                )
            section = "out"
            continue
        if section is None:
            continue  # above the first header: title, date strip, team names
        parsed = _parse_phase_row(row.spans, report_id)
        if parsed is None:
            continue
        label, home, away = parsed
        label_map = _IN_POSSESSION_PHASES if section == "in" else _OUT_OF_POSSESSION_PHASES
        key = label_map.get(label)
        if key is None:
            raise UnknownStatisticError(
                f"phase label {label!r} is not in the closed "
                f"{'in' if section == 'in' else 'out-of'}-possession set",
                report_id,
            )
        if key in seen:
            raise PhasesParseError(f"phase row {label!r} appears twice", report_id)
        seen.add(key)
        prefix = "phases_in_possession" if section == "in" else "phases_out_of_possession"
        values["home"].setdefault(prefix, {})[key] = home
        values["away"].setdefault(prefix, {})[key] = away

    if section is None:
        raise PhasesParseError("no IN POSSESSION section header on the page", report_id)
    if section == "in":
        raise PhasesParseError("no OUT OF POSSESSION section header on the page", report_id)
    for label_map, prefix in (
        (_IN_POSSESSION_PHASES, "phases_in_possession"),
        (_OUT_OF_POSSESSION_PHASES, "phases_out_of_possession"),
    ):
        for label, key in label_map.items():
            if key not in values["home"].get(prefix, {}):
                raise MissingFieldError(
                    f"required phase row {label!r} ({prefix}.{key}) not found", report_id
                )
    return values


# --- Line Height & Team Length (Task 4) -------------------------------------------

_METRE_VALUE_RE = re.compile(r"^\d+(?:\.\d+)?$", re.ASCII)
# A span carrying the whole value ('56 m' / '56m') is as valid as its split pair.
_METRE_MERGED_RE = re.compile(r"^(\d+(?:\.\d+)?) ?m$", re.ASCII)

# The measurement-graphic gray, rounded to 3 decimals like Domain A's glyph fills;
# constant across all 104 reports (Task 4.3 sweep).
_BRACKET_GRAY = (0.42, 0.447, 0.502)

# A value badge is the arrow glyph its metre text prints on: a many-item gray fill
# ~23x15pt. Rails are the bracket's thin gray bars (single rectangle, <=1.5pt thin).
_BADGE_MIN_ITEMS = 16
_BADGE_WIDTH_RANGE = (15.0, 35.0)
_BADGE_HEIGHT_RANGE = (10.0, 20.0)
_RAIL_THIN_PT = 1.5
_RAIL_MIN_LENGTH_PT = 3.0
# A rail whose long axis passes the badge's cross-range within this gap belongs to it.
_RAIL_BADGE_GAP_PT = 8.0
_RAIL_BADGE_CROSS_PT = 2.0
# A vertical bracket ending within this of a pitch y-edge touches the goal line.
_GOAL_LINE_TOUCH_PT = 2.0

# The pitch frame is the wide-stroked large rectangle drawn once per panel.
_PITCH_MIN_STROKE_PT = 2.5
_PITCH_MIN_WIDTH_PT = 150.0
_PITCH_MIN_HEIGHT_PT = 250.0

# Panel headers print in a band immediately above the pitch frames (y~142 against
# pitch top 163.5 on the reference); the page title and team name sit far higher.
_HEADER_BAND_PT = 40.0

# Closed panel-header sets per page family (AD-3), keys normalized kebab (Task 4.4).
_IN_POSSESSION_PANELS: dict[str, str] = {
    "Build Up Low": "build-up-low",
    "Build Up Mid": "build-up-mid",
    "Final Third Phase": "final-third-phase",
}
_OUT_OF_POSSESSION_PANELS: dict[str, str] = {
    "High Block / Press": "high-block-press",
    "Mid Block": "mid-block",
    "Low Block": "low-block",
}

_MEASURES = ("line_height", "team_length", "team_width")


@dataclass(frozen=True)
class _Rect:
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    def contains(self, x: float, y: float) -> bool:
        return self.x0 <= x <= self.x1 and self.y0 <= y <= self.y1


def _rounded_fill(drawing: dict) -> "tuple[float, ...] | None":
    fill = drawing.get("fill")
    if fill is None:
        return None
    return tuple(round(channel, 3) for channel in fill)


def _page_geometry(
    page: "pymupdf.Page",
) -> "tuple[list[_Rect], list[_Rect], list[_Rect]]":
    """The page's (pitch frames, value badges, bracket rails), read off the drawings."""
    pitches: list[_Rect] = []
    badges: list[_Rect] = []
    rails: list[_Rect] = []
    for drawing in page.get_drawings():
        rect = drawing["rect"]
        items = drawing["items"]
        if (
            drawing["type"] == "s"
            and (drawing.get("width") or 0) > _PITCH_MIN_STROKE_PT
            and len(items) == 1
            and items[0][0] == "re"
            and rect.width > _PITCH_MIN_WIDTH_PT
            and rect.height > _PITCH_MIN_HEIGHT_PT
        ):
            pitches.append(_Rect(rect.x0, rect.y0, rect.x1, rect.y1))
            continue
        if _rounded_fill(drawing) != _BRACKET_GRAY:
            continue
        if (
            len(items) >= _BADGE_MIN_ITEMS
            and _BADGE_WIDTH_RANGE[0] < rect.width < _BADGE_WIDTH_RANGE[1]
            and _BADGE_HEIGHT_RANGE[0] < rect.height < _BADGE_HEIGHT_RANGE[1]
        ):
            badges.append(_Rect(rect.x0, rect.y0, rect.x1, rect.y1))
        elif (
            len(items) == 1
            and items[0][0] == "re"
            and min(rect.width, rect.height) <= _RAIL_THIN_PT
            and max(rect.width, rect.height) >= _RAIL_MIN_LENGTH_PT
        ):
            rails.append(_Rect(rect.x0, rect.y0, rect.x1, rect.y1))
    return pitches, badges, rails


def _metre_values(spans: "list[TextSpan]") -> "list[tuple[TextSpan, float]]":
    """Every printed `NN m` value: a numeric span paired with its trailing `m` span,
    or the merged single-span form."""
    values: list[tuple[TextSpan, float]] = []
    for span in spans:
        merged = _METRE_MERGED_RE.match(span.text.strip())
        if merged:
            values.append((span, float(merged.group(1))))
            continue
        if not _METRE_VALUE_RE.match(span.text.strip()):
            continue
        for unit in spans:
            if (
                unit.text.strip() == "m"
                and abs(unit.x0 - span.x1) < 3.0
                and abs(unit.y0 - span.y0) < 3.0
            ):
                values.append((span, float(span.text.strip())))
                break
    return values


def _classify_value(
    span: TextSpan,
    badges: "list[_Rect]",
    rails: "list[_Rect]",
    pitch: _Rect,
    report_id: str | None,
) -> str:
    """One metre value -> its measure, from the bracket its badge belongs to."""
    owners = [badge for badge in badges if badge.contains(span.center_x, span.center_y)]
    if len(owners) != 1:
        raise LineHeightParseError(
            f"metre value {span.text.strip()!r} m sits on {len(owners)} bracket "
            "badges (expected exactly 1)",
            report_id,
        )
    badge = owners[0]
    vertical = [
        rail
        for rail in rails
        if rail.height > rail.width
        and badge.x0 - _RAIL_BADGE_CROSS_PT <= (rail.x0 + rail.x1) / 2 <= badge.x1 + _RAIL_BADGE_CROSS_PT
        and (
            abs(rail.y1 - badge.y0) <= _RAIL_BADGE_GAP_PT
            or abs(rail.y0 - badge.y1) <= _RAIL_BADGE_GAP_PT
        )
    ]
    horizontal = [
        rail
        for rail in rails
        if rail.width > rail.height
        and badge.y0 - _RAIL_BADGE_CROSS_PT <= (rail.y0 + rail.y1) / 2 <= badge.y1 + _RAIL_BADGE_CROSS_PT
        and (
            abs(rail.x1 - badge.x0) <= _RAIL_BADGE_GAP_PT
            or abs(rail.x0 - badge.x1) <= _RAIL_BADGE_GAP_PT
        )
    ]
    if len(horizontal) == 2 and not vertical:
        return "team_width"
    if len(vertical) == 2 and not horizontal:
        low = min(rail.y0 for rail in vertical)
        high = max(rail.y1 for rail in vertical)
        touches_goal_line = (
            abs(low - pitch.y0) <= _GOAL_LINE_TOUCH_PT
            or abs(high - pitch.y1) <= _GOAL_LINE_TOUCH_PT
        )
        return "line_height" if touches_goal_line else "team_length"
    raise LineHeightParseError(
        f"metre value {span.text.strip()!r} m has {len(vertical)} vertical and "
        f"{len(horizontal)} horizontal bracket rails (expected exactly 2 of one kind)",
        report_id,
    )


def _panel_headers(
    spans: "list[TextSpan]",
    pitches: "list[_Rect]",
    panel_map: "dict[str, str]",
    report_id: str | None,
) -> list[str]:
    """The three panel keys, left to right, from the header band above each pitch."""
    keys: list[str] = []
    for pitch in pitches:
        header_spans = [
            span
            for span in spans
            if pitch.y0 - _HEADER_BAND_PT <= span.y0 < pitch.y0
            and pitch.x0 <= span.center_x <= pitch.x1
        ]
        label = normalize(join_spans(sorted(header_spans, key=lambda s: s.x0)))
        key = panel_map.get(label)
        if key is None:
            raise LineHeightParseError(
                f"panel header {label!r} is not in the closed set "
                f"{sorted(panel_map)}",
                report_id,
            )
        keys.append(key)
    if sorted(keys) != sorted(panel_map.values()):
        raise LineHeightParseError(
            f"panel headers {keys} do not cover the closed set exactly once each",
            report_id,
        )
    return keys


def _parse_line_height_page(
    page: "pymupdf.Page", panel_map: "dict[str, str]", report_id: str | None
) -> dict:
    """One Line Height & Team Length page -> `{panel-key: {measure: metres}}`."""
    pitches, badges, rails = _page_geometry(page)
    if len(pitches) != 3:
        raise LineHeightParseError(
            f"page carries {len(pitches)} pitch panels (expected exactly 3)", report_id
        )
    pitches.sort(key=lambda rect: rect.x0)
    spans = text_spans(page)
    values = _metre_values(spans)
    if len(values) != 9:
        raise LineHeightParseError(
            f"page prints {len(values)} metre values (expected exactly 9, three per "
            "panel)",
            report_id,
        )
    panel_keys = _panel_headers(spans, pitches, panel_map, report_id)

    panels: dict[str, dict[str, float]] = {key: {} for key in panel_keys}
    for span, value in values:
        containing = [
            index
            for index, pitch in enumerate(pitches)
            # Badges overhang the frame by a few points (the reference page's
            # team-length badge starts 7.5pt left of the pitch edge).
            if pitch.x0 - 20.0 <= span.center_x <= pitch.x1 + 20.0
        ]
        if len(containing) != 1:
            raise LineHeightParseError(
                f"metre value {span.text.strip()!r} m sits in {len(containing)} "
                "panels (expected exactly 1)",
                report_id,
            )
        pitch = pitches[containing[0]]
        panel = panels[panel_keys[containing[0]]]
        measure = _classify_value(span, badges, rails, pitch, report_id)
        if measure in panel:
            raise LineHeightParseError(
                f"panel {panel_keys[containing[0]]!r} carries two {measure} values",
                report_id,
            )
        panel[measure] = value
    for key, panel in panels.items():
        missing = sorted(set(_MEASURES) - set(panel))
        if missing:
            raise LineHeightParseError(
                f"panel {key!r} is missing measures {missing}", report_id
            )
    return panels


# --- entry point ------------------------------------------------------------------


def _anchored_page(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    anchor_id: str,
    error: type,
    report_id: str | None,
) -> "pymupdf.Page":
    pages = anchors.get(anchor_id)
    if not pages:
        raise error(f"anchor map carries no resolved {anchor_id!r} page", report_id)
    if len(pages) != 1:
        raise error(
            f"{anchor_id!r} anchor resolves to {len(pages)} pages {pages}; "
            "expected exactly 1",
            report_id,
        )
    return doc[pages[0]]


def extract_domain_c(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: str | None = None,
) -> dict:
    """Extract the Domain C payload for one report (AC 2).

    Raises `PhasesParseError`, `LineHeightParseError`, `UnknownStatisticError` or
    `MissingFieldError`; the batch turns each into a `failed` manifest entry for this
    report alone. All-or-nothing: no partial block ever stages.
    Metre values outside pitch bounds do NOT raise — the bounds check is recorded by
    `domain_c_checks` so the record still stages and the gate can localize it.
    """
    phases_page = _anchored_page(doc, anchors, "phases-of-play", PhasesParseError, report_id)
    phases = _parse_phases_page(phases_page, report_id)

    payload: dict[str, dict] = {}
    for side in ("home", "away"):
        out_phases = phases[side]["phases_out_of_possession"]
        line_heights: dict[str, dict] = {}
        for state, anchor_stem, panel_map in (
            ("in_possession", "in-possession-line-height", _IN_POSSESSION_PANELS),
            ("out_of_possession", "defensive-line-height", _OUT_OF_POSSESSION_PANELS),
        ):
            page = _anchored_page(
                doc, anchors, f"{anchor_stem}:{side}", LineHeightParseError, report_id
            )
            line_heights[state] = _parse_line_height_page(page, panel_map, report_id)
        payload[side] = {
            "phases_in_possession": phases[side]["phases_in_possession"],
            "phases_out_of_possession": out_phases,
            # A projection of the same three parsed values, copied at build time —
            # never re-parsed, so the two views cannot disagree by construction.
            "defensive_block": {
                "high": out_phases["high_block"],
                "mid": out_phases["mid_block"],
                "low": out_phases["low_block"],
            },
            "line_height_team_length": line_heights,
        }
    return payload


# --- Self-Validation checks (SM-C1: binary, within-report, never loosened) -------

# FIFA pitch dimensions; every printed metre value must fit on the axis it measures
# (Task 5.3). `line_height`/`team_length` run the goal-to-goal length; `team_width`
# runs the touchline-to-touchline width, a materially tighter bound — checking it
# against the 105 m length would pass a physically impossible 90 m width silently.
PITCH_LENGTH_METRES = 105.0
PITCH_WIDTH_METRES = 68.0

_MEASURE_BOUND_METRES: dict[str, float] = {
    "line_height": PITCH_LENGTH_METRES,
    "team_length": PITCH_LENGTH_METRES,
    "team_width": PITCH_WIDTH_METRES,
}


def _check(check_id: str, passed: bool, specifics: str) -> dict:
    return {"check": check_id, "result": "pass" if passed else "fail", "specifics": specifics}


def domain_c_checks(payload: dict) -> list[dict]:
    """Domain C's self-validation checks over an extracted payload (AC 2).

    Recorded, never raised. The phases values are already type-checked at parse (a
    non-numeric raises — the AC's "meter values numeric" fail-loud half); the recorded
    half is the bounds walk here. There is deliberately NO "blocks sum to ~100" check:
    the blocks are independent per-phase rates (AC 2's corpus-verified correction).
    """
    violations: list[str] = []
    for side in ("home", "away"):
        for state, panels in payload[side]["line_height_team_length"].items():
            for panel_key, measures in panels.items():
                for measure, value in measures.items():
                    bound = _MEASURE_BOUND_METRES.get(measure, PITCH_LENGTH_METRES)
                    if not 0 < value <= bound:
                        violations.append(
                            f"{side}.{state}.{panel_key}.{measure} = {value} "
                            f"(bound 0 < v <= {bound:g})"
                        )
    return [
        _check(
            "tactical-metre-bounds",
            not violations,
            "; ".join(violations)
            if violations
            else f"all metre values within their pitch-axis bounds "
            f"({PITCH_LENGTH_METRES:g} m length, {PITCH_WIDTH_METRES:g} m width)",
        )
    ]

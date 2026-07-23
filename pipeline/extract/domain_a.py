"""Domain A extraction: match metadata, lineups and formations (Story 1.6, FR-3).

One open report in, one JSON-ready `domains["match_metadata"]` block out. Pure in the
AD-9 sense: no filesystem writes, no timestamps, no absolute paths, no cross-report
knowledge. The cover metadata arrives already probed (Story 1.2) — this module never
re-parses the cover; it normalizes that block (stage enum, ISO date, kickoff with venue
UTC offset) and parses the lineup page.

Lineup page geometry, verified against the whole 104-report corpus:

- The page is a y-aligned table of two independent team columns around a central
  formation diagram. Home column: shirt number, position code, name, then minute
  markers rightward. Away column mirrors it: minute markers leftward of the name,
  position and number on the right edge. The two columns flow independently — a wrapped
  name shifts every later row of its own column only (PMSR-M90), so rows are grouped
  per column, never jointly.
- Long names wrap into fragment rows ~6pt above/below their entry row while distinct
  players sit ~13.5pt apart, so fragments attach to the nearest entry unambiguously.
- A minute marker is bare text (`"67'"`, `"90+2'"`); its *kind* is carried by the small
  vector glyph printed immediately left of it. The six fill RGBs enumerated across all
  2,535 corpus markers are closed here; anything else is `UnknownMinuteGlyphError`.
- The red-football glyph is an own goal, verified corpus-wide: every report satisfies
  `team score == own column's goal glyphs + opponent column's own-goal glyphs`.
- Card glyphs expose exactly two RGBs (yellow, red). The contract's `second-yellow` is
  therefore not deterministically recoverable from a lineup page — recorded as an AD-14
  note in deferred-work.md, not guessed at here.

Everything unknown fails loud with a typed error carrying the report id (AD-8): unknown
stage wording, venue string, position code or glyph fill is never fuzzy-matched, never
defaulted, never dropped.
"""

from __future__ import annotations

import datetime
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from pipeline.extract.errors import (
    LineupCountError,
    LineupParseError,
    MalformedFieldError,
    MissingFieldError,
    UnknownMinuteGlyphError,
    UnknownPositionError,
    UnknownStageError,
)
from pipeline.extract.lines import (
    LINE_TOLERANCE_PT,
    TextSpan,
    VisualRow,
    group_rows,
    join_spans,
    text_spans,
)
from pipeline.extract.venues import utc_offset_for

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# --- template geometry (points, verified on the 104-report corpus) ---------------

# Column bands as fractions of the page width (960pt in the corpus template). Home
# column content ends by x~314; away column content starts by x~658; the central
# formation diagram and its vertical FORMATION labels live between x~324 and x~637.
_HOME_BAND_FRACTION = 1 / 3
_AWAY_BAND_FRACTION = 2 / 3

# A marker glyph is a small filled drawing printed immediately left of its minute text:
# observed gaps run 3-5pt, sizes 6x9 (cards) and ~7x7 (balls, arrows).
_GLYPH_MAX_SIZE_PT = 20.0
_GLYPH_ROW_TOLERANCE_PT = 7.0
_GLYPH_GAP_PT = 14.0

# Name-wrap fragments sit ~6pt from their entry row; distinct rows sit ~13.5pt apart.
# The adjacent row above a fragment is therefore ~7.5pt away — inside the tolerance —
# so nearest-wins needs a real separation margin, not a float-exact equidistance test:
# the corpus margin is 1.5pt, and anything closer than the margin below is ambiguous.
_NAME_WRAP_TOLERANCE_PT = 8.0
_NAME_WRAP_MARGIN_PT = 1.0

# --- closed vocabularies (AD-3 / AD-8: enumerate, never fuzzy-match) -------------

_MINUTE_RE = re.compile(r"^(\d{1,3})(?:\+(\d{1,2}))?'$", re.ASCII)
_HOME_ROW_RE = re.compile(r"^(\d{1,2}) ([A-Z]{1,3})(?: (\S.*))?$", re.ASCII)
_AWAY_ROW_RE = re.compile(r"^(?:(\S.*) )?([A-Z]{1,3}) ?(\d{1,2})$", re.ASCII)
_FORMATION_RE = re.compile(r"^[1-9](-[1-9]){1,4}$", re.ASCII)
_STAGE_RE = re.compile(r"^(?P<head>\S.*) - Match (?P<number>\d{1,3})$", re.ASCII)
_GROUP_HEAD_RE = re.compile(r"^Group (?P<letter>[A-L])$", re.ASCII)
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$", re.ASCII)
_KICKOFF_RE = re.compile(r"^\d{2}:\d{2}$", re.ASCII)

# Page prints uppercase; the record carries the contract's lowercase enum.
_POSITIONS = {"GK": "gk", "DF": "df", "MF": "mf", "FW": "fw"}

# Knockout stage wordings enumerated from the real corpus (all 104 stage lines).
_KNOCKOUT_STAGES = {
    "Round of 32": "r32",
    "Round of 16": "r16",
    "Quarter-final": "qf",
    "Semi-final": "sf",
    "Bronze final": "third-place",
    "Final": "final",
}

# Marker-glyph fill RGBs (rounded to 3 decimals), enumerated from all 2,535 corpus
# minute markers. Card colour maps to card type; `second-yellow` has no glyph of its
# own — see the module docstring.
_GLYPH_FILLS = {
    (0.0, 0.0, 0.0): "goal",
    (1.0, 0.0, 0.0): "own-goal",
    (0.02, 0.588, 0.412): "sub-on",
    (0.863, 0.149, 0.149): "sub-off",
    (0.984, 0.749, 0.141): "card-yellow",
    (0.973, 0.443, 0.443): "card-red",
}

_STARTING_HEADER = "STARTING"
_SUBSTITUTES_HEADER = "SUBSTITUTES"

# Contract clock bounds (common.schema.json Minute / StoppageMinute / ShirtNumber).
_MINUTE_MAX = 120
_STOPPAGE_MAX = 30
_SHIRT_MAX = 99


@dataclass
class _Entry:
    """One player row while the column is being assembled."""

    y: float
    shirt_number: int
    position: str
    name_parts: list[tuple[float, str]] = field(default_factory=list)
    goals: list[dict] = field(default_factory=list)
    own_goals: list[dict] = field(default_factory=list)
    cards: list[dict] = field(default_factory=list)
    substituted_on: dict | None = None
    substituted_off: dict | None = None


@dataclass(frozen=True)
class _Glyph:
    """One small filled vector drawing — a candidate minute-marker icon."""

    x0: float
    y0: float
    x1: float
    y1: float
    fill: tuple[float, ...]

    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2


def _stamp(minute: int, stoppage_minute: int | None) -> dict:
    return {"minute": minute, "stoppage_minute": stoppage_minute}


def _stamp_key(stamp: dict) -> tuple[int, int]:
    return (stamp["minute"], stamp["stoppage_minute"] or 0)


def _stamp_text(stamp: dict) -> str:
    if stamp["stoppage_minute"] is not None:
        return f"{stamp['minute']}+{stamp['stoppage_minute']}"
    return str(stamp["minute"])


def _parse_minute(text: str, report_id: str | None) -> dict:
    """`"67'"` -> minute 67; `"90+2'"` -> minute 90, stoppage 2 (contract bounds)."""
    match = _MINUTE_RE.match(text)
    if not match:
        raise LineupParseError(f"minute marker {text!r} does not parse", report_id)
    minute = int(match.group(1))
    stoppage = int(match.group(2)) if match.group(2) is not None else None
    if minute > _MINUTE_MAX:
        raise LineupParseError(f"minute {minute} exceeds the {_MINUTE_MAX} clock bound", report_id)
    if stoppage is not None and not 1 <= stoppage <= _STOPPAGE_MAX:
        raise LineupParseError(
            f"stoppage minute {stoppage} outside 1..{_STOPPAGE_MAX} in {text!r}", report_id
        )
    return _stamp(minute, stoppage)


def _page_glyphs(page: "pymupdf.Page") -> list[_Glyph]:
    """Every small filled drawing on the page — the marker-icon candidates."""
    glyphs: list[_Glyph] = []
    for drawing in page.get_drawings():
        fill = drawing.get("fill")
        if fill is None:
            continue
        rect = drawing["rect"]
        if rect.width <= _GLYPH_MAX_SIZE_PT and rect.height <= _GLYPH_MAX_SIZE_PT:
            glyphs.append(
                _Glyph(
                    x0=rect.x0,
                    y0=rect.y0,
                    x1=rect.x1,
                    y1=rect.y1,
                    fill=tuple(round(channel, 3) for channel in fill),
                )
            )
    return glyphs


def _classify_marker(span: TextSpan, glyphs: "list[_Glyph]", report_id: str | None) -> str:
    """The marker kind of one minute span, read from its adjacent glyph (AD-8).

    Exactly one candidate glyph must sit immediately left of the minute text on the
    same visual row. Zero candidates, several, or an unknown fill RGB all raise — the
    kind must never be guessed and the marker must never be dropped.
    """
    candidates = [
        glyph
        for glyph in glyphs
        if abs(glyph.center_y - span.center_y) <= _GLYPH_ROW_TOLERANCE_PT
        and span.x0 - _GLYPH_GAP_PT <= glyph.x0
        and glyph.x1 <= span.x0 + 1.0
    ]
    if len(candidates) != 1:
        fills = sorted({glyph.fill for glyph in candidates})
        raise UnknownMinuteGlyphError(
            f"minute {span.text.strip()!r} has {len(candidates)} adjacent glyphs"
            + (f" with fills {fills}" if fills else ""),
            report_id,
        )
    fill = candidates[0].fill
    kind = _GLYPH_FILLS.get(fill)
    if kind is None:
        raise UnknownMinuteGlyphError(
            f"minute {span.text.strip()!r} glyph fill {fill} is not in the known legend",
            report_id,
        )
    return kind


def _parse_column(
    rows: "list[VisualRow]",
    side: str,
    report_id: str | None,
) -> "tuple[list[_Entry], list[_Entry]]":
    """Walk one column's rows into (starters, substitutes) entries.

    Rows above the STARTING header are the page title and team-name header — ignored.
    A row matching the side's grammar opens a player entry; anything else after the
    header is a wrapped-name fragment and must attach to the nearest entry within
    `_NAME_WRAP_TOLERANCE_PT` (fragments sit ~6pt off; distinct rows ~13.5pt).
    """
    row_re = _HOME_ROW_RE if side == "home" else _AWAY_ROW_RE
    sections: dict[str, list[_Entry]] = {"starters": [], "substitutes": []}
    fragments: list[tuple[float, str]] = []
    section: str | None = None

    for row in rows:
        joined = join_spans(row.spans)
        if not joined:
            continue
        if joined == _STARTING_HEADER:
            if section is not None:
                raise LineupParseError(f"{side} column has two STARTING headers", report_id)
            section = "starters"
            continue
        if joined == _SUBSTITUTES_HEADER:
            if section != "starters":
                raise LineupParseError(
                    f"{side} column SUBSTITUTES header arrived before STARTING", report_id
                )
            section = "substitutes"
            continue
        if section is None:
            # Only the page title and team-name header print above STARTING. A row that
            # matches the player grammar up there is a displaced player, and dropping it
            # silently would surface (at best) as a downstream count-check data failure.
            if row_re.match(joined):
                raise LineupParseError(
                    f"{side} player row {joined!r} appears above the STARTING header",
                    report_id,
                )
            continue  # page title / team-name header above STARTING

        match = row_re.match(joined)
        if not match:
            # A non-player row after the header can only be a wrapped-name fragment,
            # and names never contain digits — a digit here is a minute marker missing
            # its apostrophe or other template drift, and absorbing it into a player
            # name would corrupt the record silently.
            if any(character.isdigit() for character in joined):
                raise LineupParseError(
                    f"{side} row {joined!r} is neither a player row nor a name fragment "
                    "(fragments never contain digits)",
                    report_id,
                )
            fragments.append((row.y, joined))
            continue
        if side == "home":
            shirt_text, position_code, name = match.group(1), match.group(2), match.group(3)
        else:
            name, position_code, shirt_text = match.group(1), match.group(2), match.group(3)
        if position_code not in _POSITIONS:
            raise UnknownPositionError(
                f"{position_code!r} in {side} row {joined!r} "
                f"(expected one of {sorted(_POSITIONS)})",
                report_id,
            )
        shirt_number = int(shirt_text)
        if not 1 <= shirt_number <= _SHIRT_MAX:
            raise LineupParseError(
                f"shirt number {shirt_number} outside 1..{_SHIRT_MAX} in {side} row {joined!r}",
                report_id,
            )
        entry = _Entry(y=row.y, shirt_number=shirt_number, position=_POSITIONS[position_code])
        if name:
            entry.name_parts.append((row.y, name))
        sections[section].append(entry)

    if section is None:
        raise LineupParseError(f"{side} column has no STARTING header", report_id)

    entries = sections["starters"] + sections["substitutes"]
    if not entries:
        raise LineupCountError(f"{side} column parsed to zero player rows", report_id)

    for fragment_y, text in fragments:
        nearby = sorted(
            (entry for entry in entries if abs(entry.y - fragment_y) <= _NAME_WRAP_TOLERANCE_PT),
            key=lambda entry: abs(entry.y - fragment_y),
        )
        if not nearby:
            raise LineupParseError(
                f"{side} row {text!r} is neither a player row nor adjacent to one", report_id
            )
        if (
            len(nearby) > 1
            and abs(nearby[1].y - fragment_y) - abs(nearby[0].y - fragment_y)
            < _NAME_WRAP_MARGIN_PT
        ):
            raise LineupParseError(
                f"{side} name fragment {text!r} sits ambiguously between two player rows",
                report_id,
            )
        nearby[0].name_parts.append((fragment_y, text))

    return sections["starters"], sections["substitutes"]


def _attach_markers(
    entries: "list[_Entry]",
    minute_spans: "list[TextSpan]",
    glyphs: "list[_Glyph]",
    side: str,
    report_id: str | None,
) -> None:
    """Attach each minute marker to the player row it prints on, kind read per glyph."""
    for span in minute_spans:
        owners = [entry for entry in entries if abs(entry.y - span.y0) <= LINE_TOLERANCE_PT]
        if len(owners) != 1:
            raise LineupParseError(
                f"minute {span.text.strip()!r} in the {side} column aligns with "
                f"{len(owners)} player rows",
                report_id,
            )
        entry = owners[0]
        stamp = _parse_minute(span.text.strip(), report_id)
        kind = _classify_marker(span, glyphs, report_id)
        if kind == "goal":
            entry.goals.append(stamp)
        elif kind == "own-goal":
            entry.own_goals.append(stamp)
        elif kind == "card-yellow":
            entry.cards.append({"type": "yellow", "at": stamp})
        elif kind == "card-red":
            entry.cards.append({"type": "red", "at": stamp})
        elif kind == "sub-on":
            if entry.substituted_on is not None:
                raise LineupParseError(
                    f"{side} shirt {entry.shirt_number} carries two sub-on markers", report_id
                )
            entry.substituted_on = stamp
        else:  # sub-off — _GLYPH_FILLS admits no other kind
            if entry.substituted_off is not None:
                raise LineupParseError(
                    f"{side} shirt {entry.shirt_number} carries two sub-off markers", report_id
                )
            entry.substituted_off = stamp


def _entry_payload(entry: _Entry, side: str, report_id: str | None) -> dict:
    name_pieces = [text for _, text in sorted(entry.name_parts, key=lambda part: part[0])]
    name = " ".join(name_pieces).strip()
    if not name:
        raise LineupParseError(
            f"{side} shirt {entry.shirt_number} assembled an empty player name", report_id
        )
    return {
        "name": name,
        "shirt_number": entry.shirt_number,
        "position": entry.position,
        "goals": sorted(entry.goals, key=_stamp_key),
        "own_goals": sorted(entry.own_goals, key=_stamp_key),
        "cards": sorted(entry.cards, key=lambda card: (_stamp_key(card["at"]), card["type"])),
        "substituted_on": entry.substituted_on,
        "substituted_off": entry.substituted_off,
    }


def _parse_formations(
    spans: "list[TextSpan]", width: float, report_id: str | None
) -> tuple[str, str]:
    """The two formation strings printed beside the central diagram, (home, away).

    Located by the contract `Formation` pattern within the central band — the only
    dashed digit strings on the page — and assigned by x-position (home label left of
    the diagram, away label right). Anything but exactly two is a template change.
    """
    found = sorted(
        (
            span
            for span in spans
            if span.x0 > width * _HOME_BAND_FRACTION
            and span.x1 < width * _AWAY_BAND_FRACTION
            and _FORMATION_RE.match(span.text.strip())
        ),
        key=lambda span: span.center_x,
    )
    if len(found) != 2:
        values = [span.text.strip() for span in found]
        raise LineupCountError(
            f"found {len(found)} formation strings {values}, expected exactly 2", report_id
        )
    # Home is the label left of the diagram, away right. Two labels on the same side of
    # the page centre would still pass the exactly-two count while swapping the teams'
    # formations silently — assert the straddle instead of trusting the sort.
    if not (found[0].center_x < width / 2 <= found[1].center_x):
        raise LineupCountError(
            "the two formation strings do not straddle the page centre "
            f"(centers x={found[0].center_x:.0f}, x={found[1].center_x:.0f})",
            report_id,
        )
    return found[0].text.strip(), found[1].text.strip()


def _parse_lineups(page: "pymupdf.Page", report_id: str | None) -> dict:
    """Parse the lineup page into `{"home": Lineup, "away": Lineup}`."""
    width = page.rect.width
    spans = text_spans(page)
    glyphs = _page_glyphs(page)

    # Single-pass partition: a span is a minute marker or column material, never both.
    # (Membership tests against the minute list would exclude a byte-identical
    # double-printed span from both groups.)
    minute_spans: list[TextSpan] = []
    other_spans: list[TextSpan] = []
    for span in spans:
        (minute_spans if _MINUTE_RE.match(span.text.strip()) else other_spans).append(span)
    home_core = [span for span in other_spans if span.x1 <= width * _HOME_BAND_FRACTION]
    away_core = [span for span in other_spans if span.x0 >= width * _AWAY_BAND_FRACTION]
    band_edges = {"home": width * _HOME_BAND_FRACTION, "away": width * _AWAY_BAND_FRACTION}

    lineups: dict[str, dict] = {}
    for side, core in (("home", home_core), ("away", away_core)):
        starters, substitutes = _parse_column(group_rows(core), side, report_id)
        # A non-minute span straddling the band edge belongs to neither core; if it is
        # y-aligned with a player row, its text (a long name reaching past the band)
        # would silently vanish from that row — only fully-empty names raise later.
        edge = band_edges[side]
        for span in other_spans:
            if span.x0 < edge < span.x1 and any(
                abs(entry.y - span.y0) <= LINE_TOLERANCE_PT
                for entry in starters + substitutes
            ):
                raise LineupParseError(
                    f"span {span.text.strip()!r} straddles the {side} column band edge "
                    "on a player row; its text would be dropped from the lineup",
                    report_id,
                )
        # Minute markers extend from the name toward the page centre, so they are
        # split at the half-width line, not at the core-column band edge: a long
        # marker chain reaches past the band (observed to x~314 home, x~658 away).
        if side == "home":
            side_minutes = [span for span in minute_spans if span.center_x < width / 2]
        else:
            side_minutes = [span for span in minute_spans if span.center_x >= width / 2]
        _attach_markers(starters + substitutes, side_minutes, glyphs, side, report_id)
        lineups[side] = {
            "starters": [_entry_payload(entry, side, report_id) for entry in starters],
            "substitutes": [_entry_payload(entry, side, report_id) for entry in substitutes],
        }

    home_formation, away_formation = _parse_formations(spans, width, report_id)
    lineups["home"]["formation"] = home_formation
    lineups["away"]["formation"] = away_formation
    return lineups


def _normalize_stage(stage_text: str, report_id: str | None) -> tuple[str, str | None]:
    """`"Group A - Match 1"` -> ("group", "a"); `"Bronze final - Match 103"` ->
    ("third-place", None). Closed map, never fuzzy (AD-3 / AD-8)."""
    match = _STAGE_RE.match(stage_text)
    if not match:
        raise UnknownStageError(f"stage line {stage_text!r} does not parse", report_id)
    head = match.group("head")
    group_match = _GROUP_HEAD_RE.match(head)
    if group_match:
        return "group", group_match.group("letter").lower()
    stage = _KNOCKOUT_STAGES.get(head)
    if stage is None:
        raise UnknownStageError(
            f"stage wording {head!r} is not in the closed stage map", report_id
        )
    return stage, None


def _require(metadata: dict, key: str, report_id: str | None):
    value = metadata.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise MissingFieldError(f"domain A field missing: metadata.{key}", report_id)
    return value


def _numeric_score(metadata: dict, key: str, report_id: str | None) -> int:
    value = _require(metadata, key, report_id)
    try:
        return int(value)
    except (TypeError, ValueError):
        # A bare ValueError would escape the ExtractError handlers and lose the typed,
        # localizing class name in the manifest and the gate.
        raise MalformedFieldError(
            f"metadata.{key} is not numeric: {value!r}", report_id
        ) from None


def _validate_completeness(payload: dict, report_id: str | None) -> None:
    """The addendum §6 inventory, checked field by field, each failure named (AC 1).

    The parser constructs most of these, so today this guards template drift; it stays
    a full walk rather than trusting construction, because a future edit that drops a
    field must fail here, not in Story 1.16's bundle emission. `group` is null for
    knockout stages — null there is valid, not missing.
    """

    def missing(path: str) -> MissingFieldError:
        return MissingFieldError(f"domain A field missing: {path}", report_id)

    for key in ("stage", "venue", "date", "kickoff"):
        if not payload.get(key):
            raise missing(key)
    if payload["stage"] == "group" and not payload.get("group"):
        raise missing("group")
    for side in ("home", "away"):
        if not payload["teams"].get(side):
            raise missing(f"teams.{side}")
        if payload["score"].get(side) is None:
            raise missing(f"score.{side}")
        lineup = payload["lineups"].get(side)
        if not lineup:
            raise missing(f"lineups.{side}")
        if not lineup.get("formation"):
            raise missing(f"lineups.{side}.formation")
        for section in ("starters", "substitutes"):
            entries = lineup.get(section)
            if not entries:
                raise missing(f"lineups.{side}.{section}")
            for index, entry in enumerate(entries):
                for entry_field in ("name", "shirt_number", "position"):
                    if entry.get(entry_field) in (None, ""):
                        raise missing(f"lineups.{side}.{section}[{index}].{entry_field}")
                # The §6 minute lists: the lists must exist (empty is valid data), and
                # the substitution stamps must be present as keys (null is valid data).
                for list_field in ("goals", "own_goals", "cards"):
                    if entry.get(list_field) is None:
                        raise missing(f"lineups.{side}.{section}[{index}].{list_field}")
                for stamp_field in ("substituted_on", "substituted_off"):
                    if stamp_field not in entry:
                        raise missing(f"lineups.{side}.{section}[{index}].{stamp_field}")


def extract_domain_a(
    doc: "pymupdf.Document",
    metadata: dict,
    anchors: "dict[str, list[int]]",
    report_id: str | None = None,
) -> dict:
    """Extract the Domain A payload for one report.

    `metadata` is the record's probed cover block (Story 1.2) — the keys used here are
    `home_team`, `away_team`, `home_score`, `away_score`, `stage_text`, `match_date`,
    `kickoff`, `venue` and `shootout`. It is read, normalized and passed through,
    never re-parsed from the cover and never mutated.

    The lineup page is located through the already-resolved `anchors` map, never by
    page index (AD-8). Raises the typed errors of `pipeline.extract.errors`; the batch
    turns each into a `failed` manifest entry for this report alone.
    """
    pages = anchors.get("lineups")
    if not pages:
        raise LineupParseError("anchor map carries no resolved 'lineups' page", report_id)
    if len(pages) != 1:
        # Synthetic fixtures and all 104 corpus reports resolve to exactly one page; a
        # multi-page lineup section is a template change this parser has never seen.
        raise LineupParseError(
            f"'lineups' anchor resolves to {len(pages)} pages {pages}; expected exactly 1",
            report_id,
        )

    stage, group = _normalize_stage(str(_require(metadata, "stage_text", report_id)), report_id)

    date = str(_require(metadata, "match_date", report_id))
    if not _DATE_RE.match(date):
        raise MalformedFieldError(
            f"metadata.match_date is not ISO 8601: {date!r}", report_id
        )
    try:
        datetime.date.fromisoformat(date)
    except ValueError:
        raise MalformedFieldError(
            f"metadata.match_date is not a real calendar date: {date!r}", report_id
        ) from None
    kickoff_local = str(_require(metadata, "kickoff", report_id))
    if not _KICKOFF_RE.match(kickoff_local):
        raise MalformedFieldError(
            f"metadata.kickoff is not HH:MM: {kickoff_local!r}", report_id
        )
    hour, minute_of_hour = (int(part) for part in kickoff_local.split(":"))
    if hour > 23 or minute_of_hour > 59:
        raise MalformedFieldError(
            f"metadata.kickoff is not a real clock time: {kickoff_local!r}", report_id
        )
    venue = str(_require(metadata, "venue", report_id))
    kickoff = f"{date}T{kickoff_local}:00{utc_offset_for(venue, report_id)}"

    payload = {
        "stage": stage,
        "group": group,
        "venue": venue,
        "date": date,
        "kickoff": kickoff,
        "teams": {
            "home": str(_require(metadata, "home_team", report_id)),
            "away": str(_require(metadata, "away_team", report_id)),
        },
        "score": {
            "home": _numeric_score(metadata, "home_score", report_id),
            "away": _numeric_score(metadata, "away_score", report_id),
            # Verbatim shoot-out line for the knockout ties that print one, else null.
            "shootout": metadata.get("shootout"),
        },
        "lineups": _parse_lineups(doc[pages[0]], report_id),
    }
    _validate_completeness(payload, report_id)
    return payload


# --- Self-Validation checks (SM-C1: binary, within-report, never loosened) -------


def _check(check_id: str, passed: bool, specifics: str) -> dict:
    return {"check": check_id, "result": "pass" if passed else "fail", "specifics": specifics}


def domain_a_checks(payload: dict) -> list[dict]:
    """The six Domain A self-validation checks over an extracted payload.

    Pure over the payload alone — the payload's `score` is the probed cover score
    passed through by `extract_domain_a`, so goal reconciliation already compares the
    lineup markers against the cover. Recorded into the record's
    `self_validation.checks`, never raised — a failed consistency check is data about
    this report, and the record still stages so the gate can localize it.
    """
    lineups = payload["lineups"]
    checks: list[dict] = []

    starter_counts = {side: len(lineups[side]["starters"]) for side in ("home", "away")}
    checks.append(
        _check(
            "domain-a-starters-count",
            all(count == 11 for count in starter_counts.values()),
            f"home {starter_counts['home']}, away {starter_counts['away']} starters "
            "(expected 11 each)",
        )
    )

    keeper_counts = {
        side: sum(1 for entry in lineups[side]["starters"] if entry["position"] == "gk")
        for side in ("home", "away")
    }
    checks.append(
        _check(
            "domain-a-goalkeeper-count",
            all(count == 1 for count in keeper_counts.values()),
            f"home {keeper_counts['home']}, away {keeper_counts['away']} starting "
            "goalkeepers (expected exactly 1 each)",
        )
    )

    duplicate_notes: list[str] = []
    for side in ("home", "away"):
        shirts = [
            entry["shirt_number"]
            for section in ("starters", "substitutes")
            for entry in lineups[side][section]
        ]
        duplicates = sorted({shirt for shirt in shirts if shirts.count(shirt) > 1})
        if duplicates:
            duplicate_notes.append(f"{side} duplicates {duplicates}")
    checks.append(
        _check(
            "domain-a-shirt-numbers-unique",
            not duplicate_notes,
            "; ".join(duplicate_notes) if duplicate_notes else "shirt numbers unique per team",
        )
    )

    formation_sums = {
        side: sum(int(segment) for segment in lineups[side]["formation"].split("-"))
        for side in ("home", "away")
    }
    checks.append(
        _check(
            "domain-a-formation-sum",
            all(total == 10 for total in formation_sums.values()),
            f"outfield sums home {formation_sums['home']}, away {formation_sums['away']} "
            "(expected 10 each)",
        )
    )

    pairing_notes: list[str] = []
    for side in ("home", "away"):
        entries = lineups[side]["starters"] + lineups[side]["substitutes"]
        ons = sorted(
            _stamp_key(entry["substituted_on"])
            for entry in entries
            if entry["substituted_on"] is not None
        )
        offs = sorted(
            _stamp_key(entry["substituted_off"])
            for entry in entries
            if entry["substituted_off"] is not None
        )
        if ons != offs:
            pairing_notes.append(
                f"{side} sub-on minutes {[f'{m}+{s}' if s else str(m) for m, s in ons]} "
                f"!= sub-off minutes {[f'{m}+{s}' if s else str(m) for m, s in offs]}"
            )
    checks.append(
        _check(
            "domain-a-substitution-pairing",
            not pairing_notes,
            "; ".join(pairing_notes)
            if pairing_notes
            else "every sub-on pairs with a sub-off at the same stamp",
        )
    )

    goal_notes: list[str] = []
    for side, other in (("home", "away"), ("away", "home")):
        scored = sum(
            len(entry["goals"])
            for section in ("starters", "substitutes")
            for entry in lineups[side][section]
        )
        benefit = sum(
            len(entry["own_goals"])
            for section in ("starters", "substitutes")
            for entry in lineups[other][section]
        )
        expected = payload["score"][side]
        if scored + benefit != expected:
            goal_notes.append(
                f"{side}: {scored} goal + {benefit} opponent own-goal markers "
                f"!= cover score {expected}"
            )
    checks.append(
        _check(
            "domain-a-goal-reconciliation",
            not goal_notes,
            "; ".join(goal_notes)
            if goal_notes
            else "goal and own-goal markers reconcile with the cover score",
        )
    )

    return checks

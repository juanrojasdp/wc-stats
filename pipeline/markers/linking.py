"""Marker–event linking via digit-glyph proximity (Story 1.5, FR-12/FR-14, AC 1-2).

Defends against the wrong-join hazard: the PMSR shots map prints each attempt's ordinal
shot number 1..N as white text ON its marker (ground-truth probe 2026-07-23: nearest
digit-word center 0.7-0.8 pt from the marker center, next-nearest >= 9.5 pt), and the
ordinal indexes the attempts table's printed row order per side — there is no number
column in the table. Nearest-with-threshold alone would still accept a plausible-but-
wrong join in a crowded six-yard box, so three safety nets demote a link to *unlinked*:
the distance threshold (the marker radius), the bijection rule (each ordinal accepted at
most once, ordinal within 1..N), and the outcome cross-check (the linked row's
`outcome_detail` must map onto the marker's RGB-keyed outcome via the contract's
`x-maps-to-outcome`).

An unlinkable marker is per-marker DATA, never an exception (SM-C1/AD-8): it keeps its
coordinates and outcome with null joined fields, `linked: false`, and fails the report's
Self-Validation — retained, flagged, never guessed, never dropped, never deduped. Typed
exceptions belong to structural failures only (`attempts.py`'s taxonomy).

Pure: no I/O beyond the open `pymupdf.Document`. Story 1.5 Tasks 3-5.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from pipeline.ingest.identity import team_slug
from pipeline.markers.attempts import DETAIL_COMPATIBLE_OUTCOMES, AttemptRow

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

    from pipeline.markers.filter_chain import KeyedMarker

# Accept a digit glyph only within the marker's own radius (the 11.25 pt marker
# diameter's half): ground truth puts the real label < 1 pt from its marker center and
# the next-nearest digit >= 9.5 pt away, so this threshold is generous for a true label
# and rejecting for everything else. Production-side constant — conftest's same-named
# fixture constant is fixture-side only; test code is never imported here.
SHOTS_MARKER_RADIUS = 5.625

# `re.ASCII`: fullwidth/Arabic-Indic digits otherwise fullmatch `\d+` and `int()`
# accepts them — the whole feature is digit matching, so this is not optional.
_DIGIT_RE = re.compile(r"\d+", re.ASCII)

# A merged word is a pileup of overlapping 1-2 digit labels; the corpus maximum is 4
# digits ("1819"). Longer digit runs are page furniture, never a label cluster, and
# `_word_readings`' partition count grows Fibonacci-fast with length — so words beyond
# this cap yield no readings at all rather than an unbounded enumeration.
_MAX_MERGED_WORD_DIGITS = 8


@dataclass(frozen=True)
class DigitGlyph:
    """One candidate ordinal label, by bbox center.

    `word_id` and the `[start, end)` char interval tie a glyph back to the ink it was
    read out of: overlapping markers' labels merge into one extracted word ("3" and
    "4" printed 1 pt apart come back as the word "34"), so each digit word is offered
    as every part that appears in some valid *reading* — a partition into 1-2 digit
    parts that are each a valid ordinal. Two claims on one word are consistent iff
    their intervals do not overlap (each printed character explains at most one
    ordinal). Hand-built glyphs default to degenerate intervals, which never conflict —
    plain one-glyph-per-word semantics.
    """

    pdf_x: float
    pdf_y: float
    ordinal: int
    word_id: int = 0
    start: int = 0
    end: int = 0
    # True when this glyph IS its whole printed word. Split parts are rescue
    # candidates only — see `link_markers`' two passes.
    whole: bool = True


def _word_readings(text: str, row_count: int) -> "list[list[tuple[int, int, int]]]":
    """Every partition of a digit string into 1-2 digit parts that are valid ordinals.

    Returns readings as lists of (start, end, ordinal). A single-digit word has one
    reading (itself); "34" with 14 rows has only ["3", "4"]; "12" with >= 12 rows has
    ["12"] and ["1", "2"] and the geometry + outcome constraints pick between them.
    Parts never exceed 2 digits (no team approaches 100 attempts) and never lead with
    zero.
    """
    readings: "list[list[tuple[int, int, int]]]" = []
    if len(text) > _MAX_MERGED_WORD_DIGITS:
        return readings

    def extend(start: int, acc: "list[tuple[int, int, int]]") -> None:
        if start == len(text):
            readings.append(list(acc))
            return
        for end in (start + 1, start + 2):
            if end > len(text) or text[start] == "0":
                continue
            ordinal = int(text[start:end])
            if not 1 <= ordinal <= row_count:
                continue
            acc.append((start, end, ordinal))
            extend(end, acc)
            acc.pop()

    extend(0, [])
    return readings


def collect_digit_glyphs(
    page: "pymupdf.Page", pitch: "pymupdf.Rect", legend_ys: "set[float]", row_count: int
) -> list[DigitGlyph]:
    """Candidate glyphs: words fullmatching `\\d+` centered inside the pitch rect,
    expanded into their valid readings (see `DigitGlyph`).

    The pitch rect is expanded by the marker radius before the containment test: a
    label sits ON its marker and a marker center may lie exactly on the pitch boundary
    (real corpus: markers at pdf_y == pitch.y0), so the label's own center can fall a
    fraction outside the rect — dropping it there silently unlinks an edge marker.
    Anything a true label could be is within one marker radius of the pitch.

    A part's center is interpolated arithmetically across the word bbox (digits are
    effectively tabular-width; at label size the error is well under a point). The
    legend band is excluded defensively (no corpus legend contains a digit today, but a
    digit printed there must never steal an ordinal): any word whose center sits within
    the marker radius of a legend row's y is dropped. Page-header text sits outside the
    expanded rect and never reaches the match.
    """
    import pymupdf

    reach = pymupdf.Rect(
        pitch.x0 - SHOTS_MARKER_RADIUS,
        pitch.y0 - SHOTS_MARKER_RADIUS,
        pitch.x1 + SHOTS_MARKER_RADIUS,
        pitch.y1 + SHOTS_MARKER_RADIUS,
    )
    glyphs: list[DigitGlyph] = []
    word_id = 0
    for x0, y0, x1, y1, text, *_ in page.get_text("words"):
        if not _DIGIT_RE.fullmatch(text):
            continue
        center_x, center_y = (x0 + x1) / 2, (y0 + y1) / 2
        if not reach.contains(pymupdf.Point(center_x, center_y)):
            continue
        if any(abs(center_y - legend_y) <= SHOTS_MARKER_RADIUS for legend_y in legend_ys):
            continue
        word_id += 1
        char_width = (x1 - x0) / len(text)
        parts = sorted(
            {
                part
                for reading in _word_readings(text, row_count)
                for part in reading
            }
        )
        for start, end, ordinal in parts:
            glyphs.append(
                DigitGlyph(
                    pdf_x=x0 + char_width * (start + end) / 2,
                    pdf_y=center_y,
                    ordinal=ordinal,
                    word_id=word_id,
                    start=start,
                    end=end,
                    whole=(start, end) == (0, len(text)),
                )
            )
    return glyphs


def link_markers(
    markers: "list[KeyedMarker]", glyphs: list[DigitGlyph], rows: list[AttemptRow]
) -> "list[AttemptRow | None]":
    """Each marker's attempts-table row, or `None` where no trustworthy link exists.

    Positionally aligned with `markers`. Assignment is a greedy global bijection over
    (distance, marker, glyph) pairs sorted ascending: each glyph is claimed at most
    once, each marker takes its nearest still-available glyph, and a pair is considered
    only when it is within `SHOTS_MARKER_RADIUS` AND *outcome-compatible* — the glyph's
    ordinal is in 1..len(rows) and the marker's RGB-keyed outcome is in that row's
    `DETAIL_COMPATIBLE_OUTCOMES` (the contract's `x-maps-to-outcome`, plus its one
    corpus-documented both-colours exception). Ties in distance break deterministically
    by (marker, glyph) input order.

    Independent per-marker nearest is NOT enough on the real corpus: overlapping
    six-yard-box markers sit within threshold of *both* their labels (e.g. two markers
    1 pt apart under labels 4 and 27), and both would claim the same glyph — the
    sanctioned "bijection recovery". Nor is the cross-check as a post-filter: for two
    overlapping markers of *different* outcomes the geometrically-nearest assignment
    can swap their labels and a post-hoc check would demote both, where compatibility
    as an assignment constraint resolves the swap from the printed truth itself.

    Two passes, then one demotion:

    1. Whole-word glyphs only — the plain case, and it keeps a split reading of some
       word from outbidding a marker's own intact label.
    2. Duplicate-ordinal claims from pass 1 are resolved by keeping the nearest
       claimant (releasing the others' words), then a rescue pass over ALL parts
       assigns the still-unassigned markers — this is where a merged word ("34"
       printed by two overlapping markers, or "1819" by markers 18 and 19) yields its
       parts. Claims on one word must not overlap in char interval, and a *split* part
       never claims an ordinal some marker already holds (that collision would only
       destroy a stronger whole-word claim).

    Finally, an ordinal still claimed by two markers unlinks both — guessing which
    claimant is right would be a silent wrong join. Violations demote markers to
    unlinked; nothing here raises.
    """
    pairs = sorted(
        (distance, marker_index, glyph_index)
        for marker_index, marker in enumerate(markers)
        for glyph_index, glyph in enumerate(glyphs)
        if 1 <= glyph.ordinal <= len(rows)
        and marker.outcome in DETAIL_COMPATIBLE_OUTCOMES[rows[glyph.ordinal - 1].outcome_detail]
        and (
            distance := math.hypot(glyph.pdf_x - marker.pdf_x, glyph.pdf_y - marker.pdf_y)
        )
        <= SHOTS_MARKER_RADIUS
    )
    assigned: "dict[int, tuple[int, float]]" = {}  # marker -> (glyph, distance)
    used_glyphs: set[int] = set()
    used_intervals: "dict[int, list[tuple[int, int]]]" = {}  # word -> claimed intervals
    claimed_ordinals: set[int] = set()

    def greedy(whole_only: bool) -> None:
        for distance, marker_index, glyph_index in pairs:
            if marker_index in assigned or glyph_index in used_glyphs:
                continue
            glyph = glyphs[glyph_index]
            if whole_only and not glyph.whole:
                continue
            # A split part is rescue-grade evidence: it never claims an ordinal a
            # marker already holds — that collision could only demote both later.
            if not glyph.whole and glyph.ordinal in claimed_ordinals:
                continue
            # Each printed character explains at most one ordinal: two claims on one
            # word are consistent iff their char intervals do not overlap.
            if any(
                glyph.start < end and start < glyph.end
                for start, end in used_intervals.get(glyph.word_id, [])
            ):
                continue
            assigned[marker_index] = (glyph_index, distance)
            used_glyphs.add(glyph_index)
            used_intervals.setdefault(glyph.word_id, []).append((glyph.start, glyph.end))
            claimed_ordinals.add(glyph.ordinal)

    greedy(whole_only=True)

    # Resolve pass-1 ordinal collisions (two *different* words printing one ordinal —
    # e.g. a real "12" label plus a merged "1"+"2" word read whole): keep the nearest
    # claimant, release the rest for the rescue pass. This is not the final verdict,
    # and the keep only matters when every released marker finds a *different* ordinal
    # in the rescue (a merged word yielding its split parts): a released marker with no
    # viable split rescue re-claims its released word — whole-word re-claims are not
    # barred from held ordinals — recreating the duplicate, and the demotion below then
    # unlinks every claimant including the kept one. That round-trip is the designed
    # outcome for a genuinely duplicate printed ordinal (Task 7: both markers unlink).
    claimants_by_ordinal: dict[int, list[int]] = {}
    for marker_index, (glyph_index, _distance) in assigned.items():
        claimants_by_ordinal.setdefault(glyphs[glyph_index].ordinal, []).append(marker_index)
    for claimants in claimants_by_ordinal.values():
        if len(claimants) < 2:
            continue
        keep = min(claimants, key=lambda marker_index: (assigned[marker_index][1], marker_index))
        for marker_index in claimants:
            if marker_index == keep:
                continue
            glyph_index, _distance = assigned.pop(marker_index)
            glyph = glyphs[glyph_index]
            used_glyphs.discard(glyph_index)
            intervals = used_intervals.get(glyph.word_id, [])
            if (glyph.start, glyph.end) in intervals:
                intervals.remove((glyph.start, glyph.end))
        # The ordinal stays in `claimed_ordinals`: the kept claimant holds it.

    greedy(whole_only=False)

    claimed: list[int | None] = [
        glyphs[assigned[marker_index][0]].ordinal if marker_index in assigned else None
        for marker_index in range(len(markers))
    ]

    claim_counts: dict[int, int] = {}
    for ordinal in claimed:
        if ordinal is not None:
            claim_counts[ordinal] = claim_counts.get(ordinal, 0) + 1

    return [
        rows[ordinal - 1] if ordinal is not None and claim_counts[ordinal] == 1 else None
        for ordinal in claimed
    ]


def event_fields(row: "AttemptRow | None") -> dict:
    """The Story 1.5 enrichment of one shot-event dict (snake_case, deterministic).

    Unlinked (`row is None`): `linked: false` and every joined field null.
    `expected_goals` is ALWAYS null: PMSR prints xG only as a team total — the shots
    event table has no xG column (contract `$comment`, verified across all 104 reports);
    the field exists so Story 1.16's `expectedGoals` mapping is mechanical (the
    `own_goal: False` precedent). A per-shot xG source is an AD-14 change request.
    """
    return {
        "linked": row is not None,
        "ordinal": row.ordinal if row is not None else None,
        "time_raw": row.time_raw if row is not None else None,
        "shirt_number": row.shirt_number if row is not None else None,
        "player_name": row.player_name if row is not None else None,
        "outcome_detail": row.outcome_detail if row is not None else None,
        "body_part": row.body_part if row is not None else None,
        "delivery_type": row.delivery_type if row is not None else None,
        "expected_goals": None,
    }


def link_rate_checks(shot_events: list[dict], home_team: str, away_team: str) -> list[dict]:
    """Per-team `shots-link-rate` Self-Validation checks (FR-14, complete).

    Binary: `fail` iff any of the team's markers is unlinked — the link-rate requirement
    is 100%, never loosened (SM-C1). `unlinked` carries each unlinked marker's
    identifying specifics (pdf position + outcome), which the manifest's
    `self_validation_failures` mirrors verbatim.
    """
    checks: list[dict] = []
    for side, team_name in (("home", home_team), ("away", away_team)):
        team_id = team_slug(team_name)
        team_events = [event for event in shot_events if event["team_id"] == team_id]
        unlinked = [
            {
                "outcome": event["outcome"],
                "page_index": event["source"]["page_index"],
                "pdf_x": event["source"]["pdf_x"],
                "pdf_y": event["source"]["pdf_y"],
            }
            for event in team_events
            if not event["linked"]
        ]
        checks.append(
            {
                "check": "shots-link-rate",
                "team": side,
                "result": "pass" if not unlinked else "fail",
                "linked_count": len(team_events) - len(unlinked),
                "marker_count": len(team_events),
                "unlinked": unlinked,
            }
        )
    return checks

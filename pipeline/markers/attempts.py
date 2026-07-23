"""Attempts-table row extraction: visual rows -> typed attempt rows (Story 1.5, AC 1).

Defends against column drift: player names and compound outcome labels are multi-word
("Brian GUTIERREZ", "Deflected Off Target - Defensive Event"), so splitting a row by
token count would misassign words the moment a name or label grew a word. Columns are
therefore segmented by the header words' x-positions — the boundaries sit at the `Player`,
`Outcome`, `Body` and `Delivery` x0s — and each row word is assigned to its column by x0.

Label -> enum mappings are frozen literal dicts (the `SHOTS_RGB_TO_OUTCOME` precedent —
never imported from the schema at runtime; a test cross-checks every value against the
contract JSON). An unmapped label raises `UnknownLabelError`: assert-on-unknown, never a
guess. The row parser's admission rule is the exact rule `attempts_table_count` counts
by, and the two are asserted equal per page — a divergence is a parser bug, typed, never
silently reconciled.

Pure: no I/O beyond the open `pymupdf.Document`. Story 1.5 Task 2.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from pipeline.markers.errors import AttemptRowError, AttemptsTableError, UnknownLabelError

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# Words on one visual table row share y0 to well under a point; consecutive rows sit
# ~25 pt apart on the real reports. 3 pt mirrors the cover parser's line tolerance.
_ROW_Y_TOLERANCE_PT = 3.0

# `re.ASCII`: fullwidth digits otherwise satisfy `\d` and `int()` accepts them happily.
_TIME_TOKEN_RE = re.compile(r"\d+", re.ASCII)

# A header row must carry all three of these words; the real header reads
# "Time | Player | Outcome | Body Part | Delivery Type".
_HEADER_TOKENS = ("Time", "Player", "Outcome")

# Column boundaries sit at these header words' x0s ("Body Part" and "Delivery Type" are
# two words each; the boundary is the first word of each). Exactly one of each must
# appear in the header row or the table cannot be segmented.
_BOUNDARY_TOKENS = ("Player", "Outcome", "Body", "Delivery")

# A row word sitting fractionally left of its header word (rendering jitter) must not
# fall into the previous column.
_COLUMN_X_TOLERANCE_PT = 1.0

# The compound Outcome label printed in the table -> the contract's 22-value
# `ShotOutcomeDetail` enum (kebab-case, ` - ` separators dropped). Frozen literals;
# `test_markers_attempts` cross-checks every value against contract/common.schema.json.
#
# Two corpus-observed labels are NOT in the contract's closed enum: bare "Incomplete"
# (31 rows) and bare "On Target" (3 rows), found in the Story 1.5 full-corpus run.
# They map mechanically like bare "Off Target" and are AD-14 change-flow candidates
# (add `incomplete` and `on-target` to ShotOutcomeDetail + x-maps-to-outcome) —
# recorded in deferred-work.md; Story 1.16's contract emission must resolve them.
OUTCOME_LABEL_TO_DETAIL: dict[str, str] = {
    "Incomplete": "incomplete",
    "On Target": "on-target",
    "Deflected Off Target": "deflected-off-target",
    "Deflected Off Target - Defensive Event": "deflected-off-target-defensive-event",
    "Deflected Off Target - Referee Event": "deflected-off-target-referee-event",
    "Deflected Off Target - Saved": "deflected-off-target-saved",
    "Deflected On Target - Defensive Event": "deflected-on-target-defensive-event",
    "Deflected On Target - Goal": "deflected-on-target-goal",
    "Deflected On Target - Goal Prevented": "deflected-on-target-goal-prevented",
    "Deflected On Target - Saved": "deflected-on-target-saved",
    "Incomplete - Assist": "incomplete-assist",
    "Incomplete - Blocked": "incomplete-blocked",
    "Incomplete - Defensive Event": "incomplete-defensive-event",
    "Incomplete - Foul For": "incomplete-foul-for",
    "Incomplete - Player On Ball Error": "incomplete-player-on-ball-error",
    "Incomplete - Referee Event": "incomplete-referee-event",
    "Off Target": "off-target",
    "Off Target - Defensive Event": "off-target-defensive-event",
    "Off Target - Player On Ball Error": "off-target-player-on-ball-error",
    "Off Target - Saved": "off-target-saved",
    "On Target - Defensive Event": "on-target-defensive-event",
    "On Target - Goal": "on-target-goal",
    "On Target - Goal Prevented": "on-target-goal-prevented",
    "On Target - Saved": "on-target-saved",
}

# `ShotOutcomeDetail` -> the five-value marker `ShotOutcome`, restating the contract's
# `x-maps-to-outcome`. NOT prefix-derivable: `incomplete-blocked` maps to `blocked`.
# The first two entries are the AD-14 candidates above, mapped mechanically.
DETAIL_TO_OUTCOME: dict[str, str] = {
    "incomplete": "incomplete",
    "on-target": "on-target",
    "deflected-off-target": "off-target",
    "deflected-off-target-defensive-event": "off-target",
    "deflected-off-target-referee-event": "off-target",
    "deflected-off-target-saved": "off-target",
    "deflected-on-target-defensive-event": "on-target",
    "deflected-on-target-goal": "goal",
    "deflected-on-target-goal-prevented": "on-target",
    "deflected-on-target-saved": "on-target",
    "incomplete-assist": "incomplete",
    "incomplete-blocked": "blocked",
    "incomplete-defensive-event": "incomplete",
    "incomplete-foul-for": "incomplete",
    "incomplete-player-on-ball-error": "incomplete",
    "incomplete-referee-event": "incomplete",
    "off-target": "off-target",
    "off-target-defensive-event": "off-target",
    "off-target-player-on-ball-error": "off-target",
    "off-target-saved": "off-target",
    "on-target-defensive-event": "on-target",
    "on-target-goal": "goal",
    "on-target-goal-prevented": "on-target",
    "on-target-saved": "on-target",
}

# What the linking outcome cross-check accepts: which marker colours a row's detail
# may legitimately pair with. Every detail accepts exactly the `DETAIL_TO_OUTCOME`
# colour EXCEPT `deflected-on-target-defensive-event`, which the corpus renders in
# BOTH colours: Story 1.5's full-corpus run found 10 of its 11 rows under markers
# drawn in the incomplete colour and 1 under an on-target marker (each sitting < 1 pt
# under its own ordinal label). The contract's guessed `on-target` pairing is
# corpus-contradicted for those 10 — an AD-14 contract change request recorded in
# deferred-work.md; until it resolves, the cross-check accepts either colour for this
# one detail rather than manufacturing 10 (or 1) false wrong-join demotions.
DETAIL_COMPATIBLE_OUTCOMES: dict[str, tuple[str, ...]] = {
    **{detail: (outcome,) for detail, outcome in DETAIL_TO_OUTCOME.items()},
    "deflected-on-target-defensive-event": ("incomplete", "on-target"),
}


# Body Part column label -> the contract's `BodyPart` enum.
BODY_PART_LABEL_TO_ENUM: dict[str, str] = {
    "Right Foot": "right-foot",
    "Left Foot": "left-foot",
    "Head": "head",
    "Upper Body": "upper-body",
    "Lower Body": "lower-body",
}

# Delivery Type column label -> the contract's `ShotDeliveryType` enum. Mechanical
# kebab-case except `Freekick` -> `free-kick` (the label glues what the enum splits).
DELIVERY_LABEL_TO_ENUM: dict[str, str] = {
    "Pass": "pass",
    "Cross": "cross",
    "Corner": "corner",
    "Freekick": "free-kick",
    "Penalty": "penalty",
    "Loose Ball": "loose-ball",
    "Ball Progression": "ball-progression",
    "Interception": "interception",
    "Tackle": "tackle",
    "Other": "other",
}


@dataclass(frozen=True)
class AttemptRow:
    """One attempts-table row, verbatim values plus contract-enum labels.

    `ordinal` is the row's 1-based position in the side's printed row order,
    concatenated across a multi-page table — there is NO number column in the table;
    row position is what the map's digit glyphs index. `player_name` is verbatim as
    printed (given name + UPPERCASE surname); identity resolution is Story 1.15's.
    `time_raw` is the verbatim printed Time value: first-half stoppage prints as plain
    cumulative minutes, so the `MinuteStamp` split needs period inference and is
    deferred to Story 1.16.
    """

    ordinal: int
    time_raw: int
    shirt_number: int
    player_name: str
    outcome_detail: str
    body_part: str
    delivery_type: str


def table_lines(page: "pymupdf.Page") -> "list[tuple[float, list[tuple[float, str]]]]":
    """The page's words rebuilt into visual rows: (y, [(x, word), ...]) top to bottom.

    The span-clustering technique of `probe.cover_lines`, on `get_text("words")` because
    row membership is decided by geometry, not by extraction order. Moved here from
    `shots.py` (Story 1.5 Task 2) so both the row counter and the row parser share one
    definition of "a visual row".
    """
    words = sorted(
        (y0, x0, text)
        for x0, y0, _x1, _y1, text, *_ in page.get_text("words")
        if text.strip()
    )
    lines: list[tuple[float, list[tuple[float, str]]]] = []
    current: list[tuple[float, str]] = []
    current_y: float | None = None
    for y0, x0, text in words:
        if current_y is not None and abs(y0 - current_y) > _ROW_Y_TOLERANCE_PT:
            lines.append((current_y, sorted(current)))
            current, current_y = [], None
        if current_y is None:
            current_y = y0
        current.append((x0, text))
    if current:
        lines.append((current_y, sorted(current)))
    return lines


def attempts_table_count(page: "pymupdf.Page", report_id: str, page_index: int) -> int:
    """Count attempt rows in the tabular attempts table (the count check's other half).

    Heuristic, inspected on the real table: exactly one header row carries the words
    Time/Player/Outcome; every attempt row below it leads with its Time value — a purely
    ASCII-digit leftmost word. Zero rows is a valid count (a team can go without an
    attempt); a missing or ambiguous header is `AttemptsTableError`, and the fallback is
    never the marker count — that would make Self-Validation a tautology.
    """
    lines = table_lines(page)
    header_y = _header_y(lines, report_id, page_index)
    return len(_attempt_lines(lines, header_y))


def parse_attempt_rows(
    doc: "pymupdf.Document", table_indices: "list[int]", report_id: str
) -> list[AttemptRow]:
    """Every attempt row across a side's table page(s), in printed order.

    Multi-page tables (37 of the 104 corpus reports) repeat the header per page; each
    page is parsed below its own header and the rows concatenate in anchored page order,
    so `ordinal` is the 1-based position in the concatenated list. Raises
    `AttemptsTableError` (header missing/ambiguous/unsegmentable, or a row-count
    divergence from `attempts_table_count` — a parser bug surfacing loud),
    `AttemptRowError` (a row resisting the grammar) and `UnknownLabelError` (a label
    outside the frozen mappings).
    """
    rows: list[AttemptRow] = []
    for page_index in table_indices:
        page = doc[page_index]
        lines = table_lines(page)
        header_y, boundaries = _header_geometry(lines, report_id, page_index)
        attempt_lines = _attempt_lines(lines, header_y)

        expected = attempts_table_count(page, report_id, page_index)
        if len(attempt_lines) != expected:
            raise AttemptsTableError(
                f"row parser found {len(attempt_lines)} attempt rows where the row "
                f"counter found {expected}; the two share one admission rule, so this "
                "is a parser bug",
                report_id,
                page_index,
            )

        for cells in attempt_lines:
            rows.append(
                _parse_row(cells, boundaries, len(rows) + 1, report_id, page_index)
            )
    return rows


def _header_y(
    lines: "list[tuple[float, list[tuple[float, str]]]]", report_id: str, page_index: int
) -> float:
    """The single header row's y. Ambiguity or absence is `AttemptsTableError`.

    Requires only the Time/Player/Outcome tokens — the exact 1.3 counting rule, kept
    separate from `_header_geometry`'s stricter boundary needs so the count check's
    behavior is unchanged by the Story 1.5 factor-out.
    """
    header_ys = [
        y
        for y, cells in lines
        if all(any(word == token for _x, word in cells) for token in _HEADER_TOKENS)
    ]
    if not header_ys:
        raise AttemptsTableError(
            f"no header row containing {_HEADER_TOKENS} found", report_id, page_index
        )
    if len(header_ys) > 1:
        raise AttemptsTableError(
            f"{len(header_ys)} header-shaped rows found; the attempts table is ambiguous",
            report_id,
            page_index,
        )
    return header_ys[0]


def _header_geometry(
    lines: "list[tuple[float, list[tuple[float, str]]]]", report_id: str, page_index: int
) -> "tuple[float, list[float]]":
    """The single header row's y plus the four column-boundary x0s.

    Exactly one of each boundary word must appear within the header row — ambiguity or
    absence is `AttemptsTableError`.
    """
    header_y = _header_y(lines, report_id, page_index)
    header_cells = next(cells for y, cells in lines if y == header_y)

    boundaries: list[float] = []
    for token in _BOUNDARY_TOKENS:
        xs = [x for x, word in header_cells if word == token]
        if len(xs) != 1:
            raise AttemptsTableError(
                f"header word {token!r} appears {len(xs)} times; columns cannot be "
                "segmented by header x-positions",
                report_id,
                page_index,
            )
        boundaries.append(xs[0])
    if boundaries != sorted(boundaries):
        raise AttemptsTableError(
            f"header column words are out of x-order ({boundaries}); columns cannot be "
            "segmented by header x-positions",
            report_id,
            page_index,
        )
    return header_y, boundaries


def _attempt_lines(
    lines: "list[tuple[float, list[tuple[float, str]]]]", header_y: float
) -> "list[list[tuple[float, str]]]":
    """The attempt rows below the header: leftmost word is a pure-ASCII-digit Time.

    This is `attempts_table_count`'s admission rule, verbatim — the two must never
    drift apart, and `parse_attempt_rows` asserts they have not.
    """
    return [
        cells
        for y, cells in lines
        if y > header_y and cells and _TIME_TOKEN_RE.fullmatch(cells[0][1])
    ]


def _parse_row(
    cells: "list[tuple[float, str]]",
    boundaries: "list[float]",
    ordinal: int,
    report_id: str,
    page_index: int,
) -> AttemptRow:
    """One admitted row -> a typed `AttemptRow`, columns segmented by header x0s."""
    columns: "list[list[str]]" = [[] for _ in range(len(boundaries) + 1)]
    for x, word in cells:
        column = sum(1 for boundary in boundaries if x >= boundary - _COLUMN_X_TOLERANCE_PT)
        columns[column].append(word)
    time_words, player_words, outcome_words, body_words, delivery_words = columns

    if len(time_words) != 1:
        raise AttemptRowError(
            f"Time cell is {time_words!r}, expected a single printed minute value",
            report_id,
            page_index,
        )
    if len(player_words) < 2 or not _TIME_TOKEN_RE.fullmatch(player_words[0]):
        raise AttemptRowError(
            f"Player cell is {player_words!r}, expected a leading shirt number "
            "followed by the printed name",
            report_id,
            page_index,
        )

    return AttemptRow(
        ordinal=ordinal,
        time_raw=int(time_words[0]),
        shirt_number=int(player_words[0]),
        player_name=" ".join(player_words[1:]),
        outcome_detail=_lookup(
            "Outcome", OUTCOME_LABEL_TO_DETAIL, outcome_words, report_id, page_index
        ),
        body_part=_lookup(
            "Body Part", BODY_PART_LABEL_TO_ENUM, body_words, report_id, page_index
        ),
        delivery_type=_lookup(
            "Delivery Type", DELIVERY_LABEL_TO_ENUM, delivery_words, report_id, page_index
        ),
    )


def _lookup(
    column: str,
    mapping: "dict[str, str]",
    words: "list[str]",
    report_id: str,
    page_index: int,
) -> str:
    """The cell's words joined verbatim, then the frozen mapping. Miss -> typed error."""
    label = " ".join(words)
    value = mapping.get(label)
    if value is None:
        raise UnknownLabelError(column, label, page_index, report_id)
    return value

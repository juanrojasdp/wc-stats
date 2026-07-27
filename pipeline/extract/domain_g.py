"""Domain G extraction: per-player performance and physical data (Story 1.10, FR-8).

One open report in, one JSON-ready `domains["player_stats"]` block out. Pure in the
AD-9 sense: no filesystem writes, no timestamps, no absolute paths, no cross-report
knowledge. The one thing this extractor takes that its predecessors did not is another
domain's already-parsed output — Domain A's `lineups` block — because the join to it is
this story's real content (AC 2). The lineup page is never re-parsed here: the record
seam has that payload in hand and is the single source.

Page grammar, verified verbatim on spike/mex_rsa.pdf and swept over the whole
104-report corpus:

- Four page families, one page per team each (eight anchors Story 1.2 already
  registered): distributions, offers & receptions, out of possession, physical data.
  Every anchor resolves to EXACTLY one page (832/832 corpus pages); the 1.3 attempts
  table's two-page overflow does not occur here, and the assertion exists precisely
  because that surprise is why the rule exists.
- A **player row** is a visual row whose leftmost span is a 1-2 digit shirt number at
  x < 32. Name spans end left of x=195, value spans start at or right of it, on every
  corpus page. The name is heavily fragmented per glyph run (`'Ra' 'u' 'l' 'R' 'A' 'N'
  'GE' 'L'`) and is reassembled with `join_spans`.
- Values are assigned **left-to-right by ordinal**, guarded by an exact-count assertion
  per family (14 / 8 / 15 / 9, invariant on all 3,289 rows of each). Never by fixed
  x-bands: three families are centre-aligned and physical data is right-aligned, so a
  value's x0 shifts with its width (`'5476.4'`@289 vs `'10046.9'`@284 in one column).
- The value area carries exactly two pieces of non-numeric furniture: the `%` that
  abuts its number, and the `/` of the `Tackles Made / Won` split cell. Anything else
  is a template revision and raises (AD-8).
- The join is asymmetric, and the natural-but-wrong direction fails on every corpus
  report: a page row with no lineup player raises (`PlayerJoinError`, AC 2), a lineup
  player WITH minutes and no page row raises (`MissingFieldError`, AC 1's completeness
  half), and a lineup player WITHOUT minutes has no page row — 8,412 corpus-wide — which
  is correct, not a finding.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from pipeline.extract.errors import (
    MalformedFieldError,
    MissingFieldError,
    PlayerJoinError,
    PlayerTableParseError,
)
from pipeline.extract.lines import TextSpan, VisualRow, group_rows, join_spans, text_spans

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# --- page geometry (corpus-verified constants, asserted not assumed) --------------

# A player row's leftmost span is its shirt number, right-aligned to x1 = 30.0 on every
# corpus page. The header's own leftmost span is the literal '#', which the shirt
# grammar below excludes.
SHIRT_COLUMN_X = 32.0
# Name spans end left of this x; value spans start at or right of it. The widest corpus
# name ends at ~133 and the leftmost value starts at ~200.
NAME_VALUE_BOUNDARY_X = 195.0

_SHIRT_RE = re.compile(r"^\d{1,2}$", re.ASCII)
# A value token: digits, optionally one decimal part, optionally a trailing percent.
_VALUE_RE = re.compile(r"^(\d+(?:\.\d+)?)(%?)$", re.ASCII)


# --- the closed column sets (AD-8: assert on unknown, never fuzzy-match) ----------
#
# Each family's numeric columns in printed left-to-right order. These lists ARE the
# assignment rule, and their lengths are the per-family count assertion. They are 1:1
# with the contract's `PlayerInPossession` (17) / `PlayerOutOfPossession` (15) /
# `PlayerPhysical` (9) field lists — the Story 1.16 emit-time checklist, not an import.

# kind: "count" (non-negative int) | "percent" (float 0-100) | "metres" (float) |
#       "speed" (float km/h) | "integral" (printed with a .0 decimal, stored int)
_COUNT, _PERCENT, _METRES, _SPEED, _INTEGRAL = (
    "count",
    "percent",
    "metres",
    "speed",
    "integral",
)

DISTRIBUTIONS_COLUMNS: "tuple[tuple[str, str], ...]" = (
    ("passes_attempted", _COUNT),
    ("passes_completed", _COUNT),
    ("pass_completion", _PERCENT),
    ("switches_of_play", _COUNT),
    ("crosses_attempted", _COUNT),
    ("crosses_completed", _COUNT),
    ("line_breaks_attempted", _COUNT),
    ("line_breaks_completed", _COUNT),
    ("line_break_completion", _PERCENT),
    ("ball_progressions", _COUNT),
    ("take_ons", _COUNT),
    ("step_ins", _COUNT),
    ("attempts_at_goal", _COUNT),
    ("goals", _COUNT),
)

OFFERS_COLUMNS: "tuple[tuple[str, str], ...]" = (
    ("total_offers", _COUNT),
    ("in_front", _COUNT),
    ("in_between", _COUNT),
    ("out_to_in", _COUNT),
    ("in_to_out", _COUNT),
    ("in_behind", _COUNT),
    ("no_movement", _COUNT),
    ("offers_received", _COUNT),
)
# The six movement types nest under one key in the payload; the other two stay flat.
OFFER_MOVEMENT_TYPES: "tuple[str, ...]" = (
    "in_front",
    "in_between",
    "out_to_in",
    "in_to_out",
    "in_behind",
    "no_movement",
)

OUT_OF_POSSESSION_COLUMNS: "tuple[tuple[str, str], ...]" = (
    ("tackles_made", _COUNT),
    ("tackles_won", _COUNT),
    ("blocks", _COUNT),
    ("interceptions", _COUNT),
    ("pressing_direct", _COUNT),
    ("pressing_indirect", _COUNT),
    ("duels_won_aerial", _COUNT),
    ("duels_won_physical", _COUNT),
    ("possession_contests_won", _COUNT),
    ("clearances", _COUNT),
    ("loose_ball_receptions", _COUNT),
    ("pushing_on", _COUNT),
    ("pushing_on_into_pressing", _COUNT),
    ("possession_regains", _COUNT),
    ("possession_interrupted", _COUNT),
)

PHYSICAL_COLUMNS: "tuple[tuple[str, str], ...]" = (
    ("total_distance", _METRES),
    ("distance_zone_1", _METRES),
    ("distance_zone_2", _METRES),
    ("distance_zone_3", _METRES),
    ("distance_zone_4", _METRES),
    ("distance_zone_5", _METRES),
    ("high_speed_runs", _INTEGRAL),
    ("sprints", _INTEGRAL),
    ("top_speed", _SPEED),
)


@dataclass(frozen=True)
class _Family:
    """One page family: its anchor id stem, its columns and the block it fills."""

    key: str
    anchor_stem: str
    columns: "tuple[tuple[str, str], ...]"


FAMILIES: "tuple[_Family, ...]" = (
    _Family("distributions", "individual-distributions", DISTRIBUTIONS_COLUMNS),
    _Family("offers", "individual-offers-receptions", OFFERS_COLUMNS),
    _Family("out_of_possession", "individual-out-of-possession", OUT_OF_POSSESSION_COLUMNS),
    _Family("physical", "physical-data", PHYSICAL_COLUMNS),
)

# The three payload blocks and the fields each carries, derived from the column lists so
# the completeness walk can never drift from the parser (the Domain B precedent).
IN_POSSESSION_FIELDS: "tuple[str, ...]" = (
    tuple(field for field, _ in DISTRIBUTIONS_COLUMNS)
    + ("total_offers", "offers_by_movement_type", "offers_received")
)
OUT_OF_POSSESSION_FIELDS: "tuple[str, ...]" = tuple(
    field for field, _ in OUT_OF_POSSESSION_COLUMNS
)
PHYSICAL_FIELDS: "tuple[str, ...]" = tuple(field for field, _ in PHYSICAL_COLUMNS)


def _assert_column_integrity() -> None:
    """Module-constant integrity, checked once at import (Task 5.2, the 1.2/1.4 rule).

    An authoring bug in the column lists — a duplicated field, a kind the parser has no
    grammar for — must fail the run at import, not surface as 104 identical per-report
    failures blaming the corpus.
    """
    kinds = {_COUNT, _PERCENT, _METRES, _SPEED, _INTEGRAL}
    for family in FAMILIES:
        fields = [field for field, _ in family.columns]
        if len(set(fields)) != len(fields):
            raise ValueError(f"domain_g: duplicate column name in family {family.key!r}")
        for field, kind in family.columns:
            if kind not in kinds:
                raise ValueError(f"domain_g: column {field!r} has unknown kind {kind!r}")
    # Both directions. The payload copies the offers family into `in_possession` by
    # explicit name (`extract_domain_g`), so a column added here and nowhere there would
    # be parsed and then silently discarded — and `len(IN_POSSESSION_FIELDS) != 17` would
    # not notice, because that tuple is the distributions list plus three literals.
    offers_fields = {field for field, _ in OFFERS_COLUMNS}
    expected_offers = set(OFFER_MOVEMENT_TYPES) | {"total_offers", "offers_received"}
    if offers_fields != expected_offers:
        raise ValueError(
            "domain_g: the offers family must be exactly the six movement types plus "
            f"total_offers and offers_received; got {sorted(offers_fields)}"
        )
    if len(IN_POSSESSION_FIELDS) != 17 or len(set(IN_POSSESSION_FIELDS)) != 17:
        raise ValueError("domain_g: in_possession must carry 17 distinct fields")
    if len(OUT_OF_POSSESSION_FIELDS) != 15:
        raise ValueError("domain_g: out_of_possession must carry 15 fields")
    if len(PHYSICAL_FIELDS) != 9:
        raise ValueError("domain_g: physical must carry 9 fields")


_assert_column_integrity()


# --- row grammar -----------------------------------------------------------------


def _is_player_row(row: "VisualRow") -> bool:
    """A row whose leftmost span is a 1-2 digit shirt number in the shirt column.

    The header row's leftmost span is the literal `'#'` at the same x, and the page's
    date/venue strip starts far right of it — so this one predicate separates player
    rows from every piece of furniture the four families print.
    """
    if not row.spans:
        return False
    first = row.spans[0]
    return first.x1 < SHIRT_COLUMN_X and bool(_SHIRT_RE.match(first.text.strip()))


def _value_tokens(spans: "list[TextSpan]") -> list[str]:
    """The value area's tokens, left to right, with its two furniture forms folded.

    `join_spans` restores the spaces the layout only implies, so the real pages'
    per-glyph fragmentation and pymupdf's habit of merging adjacent same-font inserts in
    the synthetic fixtures (`'0 / 0'`, `'88 %'` arriving as ONE span where the real page
    prints three) both reduce to the same token list. `%` is folded onto the number it
    abuts and `/` is dropped: they are the only non-numeric marks the corpus value area
    carries, and no value contains either character otherwise.
    """
    joined = join_spans(spans).replace("/", " ")
    tokens: list[str] = []
    for piece in joined.split():
        if piece == "%":
            # A standalone `%` span always abuts the number to its left.
            if tokens:
                tokens[-1] = tokens[-1] + "%"
            else:
                tokens.append(piece)
            continue
        tokens.append(piece)
    return tokens


def _parse_value(
    field: str, kind: str, raw: str, side: str, family: str, shirt: int, report_id: "str | None"
) -> "int | float":
    """One printed token as its typed value (AC 1: raw, locale-neutral, AD-7).

    Counts narrow to `int`, percentages and distances to `float`. The two `.0`-printed
    integral fields are asserted integral before narrowing — a genuinely fractional
    value is a `MalformedFieldError`, never a rounding opportunity.
    """
    where = f"{side}.{family}.#{shirt}.{field}"
    match = _VALUE_RE.match(raw)
    if not match:
        raise MalformedFieldError(f"{where} is not a numeric value: {raw!r}", report_id)
    digits, percent = match.group(1), match.group(2)
    if kind == _PERCENT:
        if not percent:
            raise MalformedFieldError(
                f"{where} expected a percentage, got {raw!r}", report_id
            )
        value = float(digits)
        if not 0.0 <= value <= 100.0:
            raise MalformedFieldError(
                f"{where} percentage outside 0-100: {raw!r}", report_id
            )
        return value
    if percent:
        raise MalformedFieldError(
            f"{where} expected no percent sign, got {raw!r}", report_id
        )
    if kind == _COUNT:
        if "." in digits:
            raise MalformedFieldError(
                f"{where} expected a non-negative integer, got {raw!r}", report_id
            )
        return int(digits)
    if kind == _INTEGRAL:
        # `high_speed_runs` and `sprints` print with one decimal ('18.0', '3.0') and are
        # integral on all 3,289 corpus rows. Assert, then narrow — never round.
        value = float(digits)
        if value != int(value):
            raise MalformedFieldError(
                f"{where} prints a fractional value where a count is required: {raw!r}",
                report_id,
            )
        return int(value)
    # _METRES and _SPEED: the printed decimal, verbatim.
    return float(digits)


def _parse_row(
    row: "VisualRow", family: "_Family", side: str, report_id: "str | None"
) -> "tuple[int, str, dict]":
    """One player row as (shirt number, assembled name, {field: typed value}).

    Assignment is left-to-right ordinal, guarded by the family's exact-count assertion:
    the token count is invariant corpus-wide, so positional assignment is deterministic
    and total, and any other count is a template revision that must fail loud rather
    than shift every column by one.
    """
    shirt_span, rest = row.spans[0], row.spans[1:]
    shirt = int(shirt_span.text.strip())
    name = join_spans([span for span in rest if span.x1 < NAME_VALUE_BOUNDARY_X])
    tokens = _value_tokens([span for span in rest if span.x1 >= NAME_VALUE_BOUNDARY_X])
    if not name:
        raise PlayerTableParseError(
            f"{side} {family.key} row #{shirt} assembled an empty player name", report_id
        )
    if len(tokens) != len(family.columns):
        raise PlayerTableParseError(
            f"{side} {family.key} row #{shirt} ({name!r}) carries {len(tokens)} values, "
            f"expected {len(family.columns)}: {tokens}",
            report_id,
        )
    values = {
        field: _parse_value(field, kind, raw, side, family.key, shirt, report_id)
        for (field, kind), raw in zip(family.columns, tokens)
    }
    return shirt, name, values


def _parse_family_page(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    family: "_Family",
    side: str,
    report_id: "str | None",
) -> "list[tuple[int, str, dict]]":
    """Every player row of one family's page for one side, in printed page order."""
    anchor_id = f"{family.anchor_stem}:{side}"
    pages = anchors.get(anchor_id)
    if not pages:
        raise PlayerTableParseError(
            f"anchor map carries no resolved {anchor_id!r} page", report_id
        )
    if len(pages) != 1:
        # 832/832 corpus pages resolve singly, but 37/104 reports overflow the shots
        # attempts table onto a second page — multi-page sections are a real corpus
        # behavior, so this asserts rather than silently reading the first page.
        raise PlayerTableParseError(
            f"{anchor_id!r} anchor resolves to {len(pages)} pages {pages}; expected 1",
            report_id,
        )
    # Bound the row region below the column-header band before grouping. `lines.py`
    # instructs callers to pre-filter spans rather than group a whole page (it cites a
    # real corpus failure, PMSR-M69), and `_is_player_row` is bounded in x only: any
    # 1-2 digit span left of x=32 anywhere on the page would otherwise be read as a
    # player row. The header's own leftmost span is the literal '#', which gives the
    # region its top edge. No corpus page carries furniture in that column, so this is
    # hardening, not a fix — a page drawn without the header falls back to the whole
    # page rather than silently losing every row.
    all_rows = group_rows(text_spans(doc[pages[0]]))
    header_y = next(
        (
            row.y
            for row in all_rows
            if row.spans and row.spans[0].text.strip() == "#"
        ),
        None,
    )
    rows = [
        _parse_row(row, family, side, report_id)
        for row in all_rows
        if (header_y is None or row.y > header_y) and _is_player_row(row)
    ]
    if not rows:
        raise PlayerTableParseError(
            f"{side} {family.key} page carries no player rows", report_id
        )
    return rows


# --- the within-report join (Task 3, AC 2) ---------------------------------------


def has_minutes(entry: dict, section: str) -> bool:
    """Did this lineup entry take the field?

    A starter always did; a substitute did exactly when the lineup page stamped a sub-on
    minute on them.

    The rule is exact in the lineup->row direction on all 104 reports: every entry it
    calls "with minutes" has a page row. The reverse is NOT exact, and the story's
    "0 discrepancies in both directions" was measured wrong: 3,289 page rows meet 3,288
    such entries. The one extra row is PMSR-M92-MEX-V-ENG away #14 Jordan HENDERSON, an
    unused substitute the report prints an ALL-ZERO row for (0.0 m, 0 passes, 0.0 km/h)
    after booking him from the bench. Domain A is right about him; the page is merely
    verbose. `extract_domain_g` therefore admits an orphan row only when every one of its
    values is zero, and raises `PlayerJoinError` on one carrying real numbers.
    """
    return section == "starters" or entry["substituted_on"] is not None


def _join_index(
    lineups: dict, side: str, report_id: "str | None"
) -> "tuple[dict[str, dict], list[dict]]":
    """`{name -> lineup entry}` for one side, plus the entries that have minutes.

    Keyed on the lineup entry's name VERBATIM: the Domain G pages and the lineup page
    print name identity byte-for-byte, so nothing is normalized, folded or fuzzy-matched
    here (AD-8; cross-report identity is Story 1.15's). Names are unique within a team
    on all 104 reports, but the map is built with an explicit duplicate guard rather
    than a dict that would silently collapse two players into one.
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


def _is_all_zero(player: dict) -> bool:
    """Does this assembled row carry nothing but zeros across all three blocks?"""
    for block in ("in_possession", "out_of_possession", "physical"):
        for value in player[block].values():
            if isinstance(value, dict):
                if any(nested for nested in value.values()):
                    return False
            elif value:
                return False
    return True


def _join_row(
    index: "dict[str, dict]",
    name: str,
    shirt: int,
    side: str,
    family: str,
    report_id: "str | None",
) -> dict:
    """The lineup entry a page row belongs to, or a loud failure (AC 2).

    The shirt number is the corroborating key, not the join key: it catches a name
    collision the registry-free join cannot see, and disagreed on 0 of 3,289 corpus rows.
    """
    entry = index.get(name)
    if entry is None:
        raise PlayerJoinError(
            f"{side} {family} row #{shirt} name {name!r} matches no lineup player",
            report_id,
        )
    if entry["shirt_number"] != shirt:
        raise PlayerJoinError(
            f"{side} {family} row for {name!r} prints shirt {shirt}, "
            f"but the lineup prints {entry['shirt_number']}",
            report_id,
        )
    return entry


# --- the extractor ---------------------------------------------------------------


def extract_domain_g(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    lineups: dict,
    report_id: "str | None" = None,
) -> dict:
    """Extract the Domain G payload for one report (AC 1, AC 2).

    `lineups` is Domain A's already-parsed `match_metadata["lineups"]` block, handed in
    by the record seam — the lineup page is never re-parsed here. Pages are located
    through the already-resolved `anchors` map, never by page index (AD-8).

    Raises `PlayerTableParseError`, `PlayerJoinError`, `MalformedFieldError` or
    `MissingFieldError`; the batch turns each into a `failed` manifest entry for this
    report alone. The payload is all-or-nothing: no partial Domain G block ever stages.
    """
    payload: dict[str, list[dict]] = {}
    for side in ("home", "away"):
        index, with_minutes = _join_index(lineups, side, report_id)

        # Parse the four families independently, then require them to agree on the same
        # players IN THE SAME ORDER before anything is assembled. The comparison is
        # deliberately order-sensitive, not a set comparison: the payload assembles the
        # four families by positional index below, so a family that merely reordered its
        # rows would silently merge one player's numbers onto another's row.
        parsed: dict[str, list[tuple[int, str, dict]]] = {
            family.key: _parse_family_page(doc, anchors, family, side, report_id)
            for family in FAMILIES
        }
        reference_key = FAMILIES[0].key
        reference = [(name, shirt) for shirt, name, _ in parsed[reference_key]]
        for family in FAMILIES[1:]:
            other = [(name, shirt) for shirt, name, _ in parsed[family.key]]
            if other != reference:
                raise PlayerTableParseError(
                    f"{side} {family.key} lists a different player sequence than "
                    f"{reference_key} (same players in a different order is also a "
                    f"failure, because assembly is positional): {other} vs {reference}",
                    report_id,
                )

        with_minutes_names = {entry["name"] for entry in with_minutes}
        players: list[dict] = []
        seen_names: set[str] = set()
        for position, (shirt, name, distributions) in enumerate(parsed[reference_key]):
            if name in seen_names:
                raise PlayerTableParseError(
                    f"{side} {reference_key} page lists {name!r} twice", report_id
                )
            seen_names.add(name)
            entry = _join_row(index, name, shirt, side, reference_key, report_id)
            offers = parsed["offers"][position][2]
            in_possession = dict(distributions)
            in_possession["total_offers"] = offers["total_offers"]
            in_possession["offers_by_movement_type"] = {
                movement: offers[movement] for movement in OFFER_MOVEMENT_TYPES
            }
            in_possession["offers_received"] = offers["offers_received"]
            player = {
                "name": name,
                "shirt_number": shirt,
                # The G pages do not print a position; it is copied from the joined
                # lineup entry rather than re-derived.
                "position": entry["position"],
                "in_possession": in_possession,
                "out_of_possession": dict(parsed["out_of_possession"][position][2]),
                "physical": dict(parsed["physical"][position][2]),
            }
            # The row->lineup direction's second half. A row for an entry the lineup says
            # never took the field is only tolerable when it carries NOTHING: the corpus
            # has exactly one such row (PMSR-M92-MEX-V-ENG away #14 Jordan HENDERSON, an
            # unused substitute booked from the bench) and it is all zeros, so the page is
            # merely verbose, not contradictory. A row with real numbers for a player the
            # lineup says never played IS a contradiction — most likely a sub-on stamp
            # Domain A missed — and must fail loud rather than stage a phantom's stat line
            # into the physical leaderboards and the two reconciliations.
            if name not in with_minutes_names and not _is_all_zero(player):
                raise PlayerJoinError(
                    f"{side} {reference_key} row for {name!r} (shirt {shirt}) carries "
                    "non-zero values, but the lineup records no minutes for them "
                    "(not a starter, no sub-on stamp)",
                    report_id,
                )
            players.append(player)

        # AC 1's completeness half. The other direction — a lineup entry WITHOUT minutes
        # and without a page row — is the normal case (8,412 corpus-wide) and is
        # deliberately neither recorded nor warned about.
        for entry in with_minutes:
            if entry["name"] not in seen_names:
                raise MissingFieldError(
                    f"{side} lineup player {entry['name']!r} (shirt "
                    f"{entry['shirt_number']}) took the field but has no Domain G row",
                    report_id,
                )
        payload[side] = players

    return payload


# --- Self-Validation checks (SM-C1: binary, within-report, never loosened) --------

# Six values each rounded to 1 decimal drift at most 6 x 0.05 = 0.30 m from an exact
# sum; 0.35 is that derived bound with the float-comparison margin. Corpus-verified:
# worst observed deviation 0.200 m over 3,289 rows.
ZONE_SUM_TOLERANCE_M = 0.35
# The team km prints to 1 decimal (+/-0.05) plus per-player metre rounding over ~16
# rows. Corpus-verified: worst 0.0499 km over 208 team-innings.
DISTANCE_RECONCILIATION_TOLERANCE_KM = 0.1
# The printed completion is integer-rounded, so a faithful value can sit at most 0.5 from
# the computed one; 0.55 is that derived bound with the float-comparison margin, the same
# construction as the zone sum above (derived 0.30, shipped 0.35). Corpus-verified: worst
# observed 0.500 over 3,289 rows — which sits ON the derived bound, hence the margin.
COMPLETION_TOLERANCE = 0.55


def _check(check_id: str, passed: bool, specifics: str) -> dict:
    return {"check": check_id, "result": "pass" if passed else "fail", "specifics": specifics}


def domain_g_checks(
    payload: dict,
    key_statistics: "dict | None" = None,
    lineups: "dict | None" = None,
) -> list[dict]:
    """Domain G's self-validation checks over an extracted payload (AC 1).

    Recorded, never raised — a failed consistency check is data about this report, and
    the record still stages so the gate can localize it. Exactly one dict per check id
    covers both sides, with `specifics` naming every offending side/player in page
    order, so re-runs are byte-identical.

    `key_statistics` and `lineups` are the sibling payloads the two cross-domain checks
    need; the caller (`extract_report`, and the gate's counts check) has them in hand,
    which keeps this parser single-source — the 1.7 `shots_counts` precedent. When one
    is absent its checks are OMITTED rather than emitted as a passing or
    "not-applicable" dict, which the strictly binary aggregator could not read honestly.
    """
    checks: list[dict] = []

    zone_notes: list[str] = []
    for side in ("home", "away"):
        for player in payload[side]:
            physical = player["physical"]
            zones = sum(
                physical[f"distance_zone_{zone}"] for zone in range(1, 6)
            )
            drift = round(abs(physical["total_distance"] - zones), 3)
            if drift > ZONE_SUM_TOLERANCE_M:
                zone_notes.append(
                    f"{side} #{player['shirt_number']} {player['name']}: total "
                    f"{physical['total_distance']} vs zones {round(zones, 1)} "
                    f"(drift {drift})"
                )
    checks.append(
        _check(
            "domain-g-zone-sum",
            not zone_notes,
            "; ".join(zone_notes)
            if zone_notes
            else f"every player's total distance equals its speed-zone sum "
            f"(+/-{ZONE_SUM_TOLERANCE_M} m)",
        )
    )

    consistency_notes: list[str] = []
    for side in ("home", "away"):
        for player in payload[side]:
            where = f"{side} #{player['shirt_number']} {player['name']}"
            in_possession = player["in_possession"]
            out_of_possession = player["out_of_possession"]
            for smaller, larger in (
                ("passes_completed", "passes_attempted"),
                ("crosses_completed", "crosses_attempted"),
                ("line_breaks_completed", "line_breaks_attempted"),
            ):
                if in_possession[smaller] > in_possession[larger]:
                    consistency_notes.append(
                        f"{where}: {smaller} {in_possession[smaller]} > "
                        f"{larger} {in_possession[larger]}"
                    )
            if out_of_possession["tackles_won"] > out_of_possession["tackles_made"]:
                consistency_notes.append(
                    f"{where}: tackles_won {out_of_possession['tackles_won']} > "
                    f"tackles_made {out_of_possession['tackles_made']}"
                )
            if in_possession["offers_received"] > in_possession["total_offers"]:
                consistency_notes.append(
                    f"{where}: offers_received {in_possession['offers_received']} > "
                    f"total_offers {in_possession['total_offers']}"
                )
            movement_sum = sum(in_possession["offers_by_movement_type"].values())
            if movement_sum != in_possession["total_offers"]:
                consistency_notes.append(
                    f"{where}: movement types sum to {movement_sum}, total_offers "
                    f"{in_possession['total_offers']}"
                )
            # NOT checked: `goals <= attempts_at_goal`. It is the obvious relation and it
            # is corpus-FALSE — 4 of 104 reports violate it, each with a goal Domain A
            # independently confirms (PMSR-M11 and PMSR-M36 away #15 Daichi KAMADA, 1 goal
            # / 0 attempts; PMSR-M29 home #9 MATHEUS CUNHA, 2 / 1; PMSR-M59 home #21 Baris
            # Alper YILMAZ, 1 / 0). The page's "Attempts at Goal" column is evidently
            # narrower than "shots, including the one that went in". Shipping the relation
            # would flood the gate with 4 false count-mismatches — the same inversion the
            # naive goals reconciliation would have caused on 14 team-innings. Recorded in
            # `deferred-work.md`; do not re-add it without resolving the column's meaning.
            for printed_field, completed, attempted in (
                ("pass_completion", "passes_completed", "passes_attempted"),
                ("line_break_completion", "line_breaks_completed", "line_breaks_attempted"),
            ):
                if not in_possession[attempted]:
                    # A zero-attempts row prints 0% — a pass, never a division. Assert
                    # the 0 rather than skipping blind: a printed completion on zero
                    # attempts is impossible arithmetic, and letting it through silently
                    # would be exactly the loosening SM-C1 forbids. 53 corpus rows print
                    # 0 attempts and every one prints 0%.
                    if in_possession[printed_field]:
                        consistency_notes.append(
                            f"{where}: printed {printed_field} "
                            f"{in_possession[printed_field]} on 0 {attempted}"
                        )
                    continue
                computed = 100.0 * in_possession[completed] / in_possession[attempted]
                if abs(in_possession[printed_field] - computed) > COMPLETION_TOLERANCE:
                    consistency_notes.append(
                        f"{where}: printed {printed_field} "
                        f"{in_possession[printed_field]} vs computed {computed:.2f}"
                    )
    checks.append(
        _check(
            "domain-g-internal-consistency",
            not consistency_notes,
            "; ".join(consistency_notes)
            if consistency_notes
            else "subset counts, offer movement sums and completion % consistent",
        )
    )

    if key_statistics is not None:
        distance_notes: list[str] = []
        for side in ("home", "away"):
            player_km = sum(
                player["physical"]["total_distance"] for player in payload[side]
            ) / 1000.0
            team_km = key_statistics[side]["distance_covered"]
            drift = round(abs(player_km - team_km), 4)
            if drift > DISTANCE_RECONCILIATION_TOLERANCE_KM:
                distance_notes.append(
                    f"{side}: players sum to {round(player_km, 4)} km, Key Statistics "
                    f"prints {team_km} km (drift {drift})"
                )
        checks.append(
            _check(
                "domain-g-distance-reconciliation",
                not distance_notes,
                "; ".join(distance_notes)
                if distance_notes
                else f"per-player distance sums equal the team totals "
                f"(+/-{DISTANCE_RECONCILIATION_TOLERANCE_KM} km)",
            )
        )

        if lineups is not None:
            # EXACT, and the own-goal term is mandatory: a team's printed score includes
            # own goals scored by the OPPONENT, while the Distributions page credits the
            # player who actually scored. Without the term the check is corpus-FALSE on
            # exactly 14 team-innings — the corpus's 14 own goals, found by Story 1.6.
            goal_notes: list[str] = []
            for side, other in (("home", "away"), ("away", "home")):
                scored = sum(
                    player["in_possession"]["goals"] for player in payload[side]
                )
                benefit = sum(
                    len(entry["own_goals"])
                    for section in ("starters", "substitutes")
                    for entry in lineups[other][section]
                )
                expected = key_statistics[side]["goals"]
                if scored + benefit != expected:
                    goal_notes.append(
                        f"{side}: players scored {scored} + {benefit} opponent own "
                        f"goal(s) = {scored + benefit}, Key Statistics prints {expected}"
                    )
            checks.append(
                _check(
                    "domain-g-goals-reconciliation",
                    not goal_notes,
                    "; ".join(goal_notes)
                    if goal_notes
                    else "per-player goals plus opponent own goals equal the team goals",
                )
            )

    return checks

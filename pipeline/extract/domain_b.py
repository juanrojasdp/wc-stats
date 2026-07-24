"""Domain B extraction: the Key Statistics block (Story 1.7, FR-4).

One open report in, one JSON-ready `domains["key_statistics"]` block out. Pure in the
AD-9 sense: no filesystem writes, no timestamps, no absolute paths, no cross-report
knowledge.

Key Statistics page grammar, verified verbatim on spike/mex_rsa.pdf and swept over the
whole 104-report corpus:

- One landscape page, both teams. Below the header strip a team-names row prints the
  home team on the left and the away team on the right. The anchor text embeds no team
  names, so left=home would otherwise be an assumption — the printed names are asserted
  against the probed home/away, foreclosing a silent home/away stat swap under a
  template revision (AD-8's exact failure mode).
- Each stat row prints home value spans left of its label and away value spans right of
  it. The x-bands vary between reports, so spans are classified relative to the row's
  own label position, never by fixed band constants.
- The Possession row is the exception: three percentage values sit along a horizontal
  bar (home / contested / away, left-to-right), their x varying with the values. Two
  `Total` labels inside that row are furniture, not stat labels.
- The row-label set is closed (AD-3): an unrecognized stat row raises
  `UnknownStatisticError`; a required row that never appears raises `MissingFieldError`;
  a value that fails to parse as its expected type raises `MalformedFieldError` naming
  the field and the raw text (AC 1's loud path). Never fuzzy-matched, never defaulted.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from pipeline.discover.text import normalize
from pipeline.extract.errors import (
    MalformedFieldError,
    MissingFieldError,
    StatisticsParseError,
    UnknownStatisticError,
)
from pipeline.extract.lines import TextSpan, VisualRow, group_rows, join_spans, text_spans

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# --- value grammars (re.ASCII everywhere: the page prints ASCII digits only) ------

_COUNT_RE = re.compile(r"^\d+$", re.ASCII)
_COMPOUND_RE = re.compile(r"^(\d+) \((\d+)\)$", re.ASCII)
_PERCENT_RE = re.compile(r"^(\d+(?:\.\d+)?) ?%$", re.ASCII)
_DECIMAL_RE = re.compile(r"^\d+(?:\.\d+)?$", re.ASCII)
_KM_RE = re.compile(r"^(\d+(?:\.\d+)?) km$", re.ASCII)

# Digit-led tokens a printed value can consist of, split or merged — a span carrying a
# whole value ('16 (4)', '90 %', '107.3 km') is as valid as its split pieces (the label
# never starts with a digit; the Zone 4 label's trailing fragment always carries
# 'km/h', which matches none of these).
_NUMERIC_SPAN_RE = re.compile(
    r"^(?:\d+(?:\.\d+)?(?: ?%| km)?|\(\d+\)|\d+ \(\d+\))$", re.ASCII
)
# Bare unit spans. Only consumable next to a numeric span being consumed with them:
# the 'Pass Completion %' label ends in its own bare '%' span, which must stay label.
_UNIT_SPANS = ("%", "km")


@dataclass(frozen=True)
class _RowSpec:
    """One closed-set stat row: its field name(s) and its value grammar."""

    kind: str  # "count" | "compound" | "percent" | "decimal" | "km"
    fields: tuple[str, ...]


# The closed row-label set (addendum §6 Domain B inventory; labels normalized with the
# en-dash folded to a hyphen — the Zone 4 label prints U+2013 on the real page).
_ROW_SPECS: dict[str, _RowSpec] = {
    "Goals": _RowSpec("count", ("goals",)),
    "xG (Expected Goals)": _RowSpec("decimal", ("expected_goals",)),
    "Attempts at Goal (On Target)": _RowSpec("compound", ("shots", "shots_on_target")),
    "Total Passes (Complete)": _RowSpec("compound", ("passes", "passes_completed")),
    "Pass Completion %": _RowSpec("percent", ("pass_completion",)),
    "Completed Line Breaks": _RowSpec("count", ("completed_line_breaks",)),
    "Defensive Line Breaks": _RowSpec("count", ("defensive_line_breaks",)),
    "Receptions in the Final Third": _RowSpec("count", ("receptions_in_final_third",)),
    "Crosses": _RowSpec("count", ("crosses",)),
    "Ball Progressions": _RowSpec("count", ("ball_progressions",)),
    "Defensive Pressures Applied (Direct Pressures)": _RowSpec(
        "compound", ("defensive_pressures", "direct_pressures")
    ),
    "Forced Turnovers": _RowSpec("count", ("forced_turnovers",)),
    "Second Balls": _RowSpec("count", ("second_balls",)),
    "Total Distance Covered": _RowSpec("km", ("distance_covered",)),
    "Zone 4 - Low Speed Sprinting: 20-25 km/h": _RowSpec("km", ("sprint_distance",)),
}

# Every per-team field the payload must carry (the 19-key checklist of contract
# `TeamKeyStatistics`, in staging snake_case). Derived from the row specs plus the
# possession bar, so the completeness walk can never drift from the parser.
_TEAM_FIELDS: tuple[str, ...] = ("possession",) + tuple(
    field for spec in _ROW_SPECS.values() for field in spec.fields
)


def _normalize_label(text: str) -> str:
    """Whitespace-normalize a joined row label and fold the en-dash to a hyphen."""
    return normalize(text.replace("–", "-"))


def _parse_count(field: str, raw: str, report_id: str | None) -> int:
    if not _COUNT_RE.match(raw):
        raise MalformedFieldError(
            f"{field} expected a non-negative integer, got {raw!r}", report_id
        )
    return int(raw)


def _parse_value(spec: _RowSpec, raw: str, side: str, report_id: str | None) -> dict:
    """Parse one side's joined value text per the row's grammar (AC 1 typing rules)."""
    qualified = f"{side}.{spec.fields[0]}"
    if spec.kind == "count":
        return {spec.fields[0]: _parse_count(qualified, raw, report_id)}
    if spec.kind == "compound":
        match = _COMPOUND_RE.match(raw)
        if not match:
            raise MalformedFieldError(
                f"{qualified} expected 'N (M)', got {raw!r}", report_id
            )
        return {
            spec.fields[0]: int(match.group(1)),
            spec.fields[1]: int(match.group(2)),
        }
    if spec.kind == "percent":
        match = _PERCENT_RE.match(raw)
        if not match:
            raise MalformedFieldError(
                f"{qualified} expected a percentage, got {raw!r}", report_id
            )
        return {spec.fields[0]: float(match.group(1))}
    if spec.kind == "decimal":
        if not _DECIMAL_RE.match(raw):
            raise MalformedFieldError(
                f"{qualified} expected a non-negative number, got {raw!r}", report_id
            )
        return {spec.fields[0]: float(raw)}
    if spec.kind == "km":
        match = _KM_RE.match(raw)
        if not match:
            raise MalformedFieldError(
                f"{qualified} expected 'N km' or 'N.N km', got {raw!r}", report_id
            )
        return {spec.fields[0]: float(match.group(1))}
    # _ROW_SPECS admits no other kind today; a new one added without its grammar is an
    # authoring bug — fail loud at first use rather than mis-parsing it as km.
    raise StatisticsParseError(
        f"{qualified}: unknown row kind {spec.kind!r}", report_id
    )


def _find_team_row(
    rows: "list[VisualRow]", home_team: str, away_team: str, report_id: str | None
) -> int:
    """Index of the team-names row, with the left=home side verification (AD-8).

    The page prints both team names on one visual row (home left, away right). The
    anchor text embeds no team names, so this printed row is the only on-page evidence
    that left really is home — a swapped row raises rather than staging every stat
    under the wrong team.
    """
    expected = normalize(f"{home_team} {away_team}")
    swapped = normalize(f"{away_team} {home_team}")
    for index, row in enumerate(rows):
        joined = join_spans(row.spans)
        if joined == expected:
            return index
        if joined == swapped and expected != swapped:
            raise StatisticsParseError(
                f"team-names row prints {joined!r}: away team on the left "
                f"(probed home is {home_team!r})",
                report_id,
            )
    raise StatisticsParseError(
        f"no row prints the team names {expected!r}; the left=home side "
        "verification cannot run",
        report_id,
    )


def _parse_possession_row(
    row: "VisualRow", report_id: str | None
) -> tuple[float, float, float]:
    """The possession bar's three percentages, left-to-right = home/contested/away."""
    values: list[float] = []
    for span in sorted(row.spans, key=lambda s: s.x0):
        match = _PERCENT_RE.match(span.text.strip())
        if match:
            values.append(float(match.group(1)))
    if len(values) != 3:
        raise StatisticsParseError(
            f"possession bar row carries {len(values)} percentage values, expected 3 "
            "(home / contested / away)",
            report_id,
        )
    return values[0], values[1], values[2]


def _split_stat_row(
    row: "VisualRow",
) -> "tuple[list[TextSpan], list[TextSpan], list[TextSpan]]":
    """Partition one row's spans into (home values, label, away values).

    Value spans are consumed from each edge inward; the label is whatever remains in
    the middle. Classification is relative to the row's own content, never to fixed
    x-band constants — the value x-positions vary with the values (Dev Notes landmine).
    A bare unit span (`%` / ` km`) is consumed only when the numeric span to its left
    is consumed with it, so the label's own trailing `%` stays part of the label.
    """
    spans = sorted(row.spans, key=lambda s: (s.x0, s.x1))

    def numeric(index: int) -> bool:
        return bool(_NUMERIC_SPAN_RE.match(spans[index].text.strip()))

    def unit(index: int) -> bool:
        return spans[index].text.strip() in _UNIT_SPANS

    start = 0
    while start < len(spans):
        if numeric(start) or (unit(start) and start > 0 and numeric(start - 1)):
            start += 1
            continue
        break
    end = len(spans)
    while end > start:
        if numeric(end - 1) or (unit(end - 1) and end - 1 > start and numeric(end - 2)):
            end -= 1
            continue
        break
    return spans[:start], spans[start:end], spans[end:]


def extract_domain_b(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: str | None,
    home_team: str,
    away_team: str,
) -> dict:
    """Extract the Domain B payload for one report (AC 1).

    The page is located through the already-resolved `anchors` map, never by page index
    (AD-8). Raises `StatisticsParseError`, `UnknownStatisticError`, `MissingFieldError`
    or `MalformedFieldError`; the batch turns each into a `failed` manifest entry for
    this report alone. The payload is all-or-nothing: no partial block ever stages.
    """
    pages = anchors.get("key-statistics")
    if not pages:
        raise StatisticsParseError(
            "anchor map carries no resolved 'key-statistics' page", report_id
        )
    if len(pages) != 1:
        # 37/104 reports overflow the shots attempts table onto a second page, so
        # multi-page sections are a real corpus behavior — if Key Statistics ever
        # overflows too, model it then; loud first (Task 2.1).
        raise StatisticsParseError(
            f"'key-statistics' anchor resolves to {len(pages)} pages {pages}; "
            "expected exactly 1",
            report_id,
        )

    rows = group_rows(text_spans(doc[pages[0]]))
    team_row_index = _find_team_row(rows, home_team, away_team, report_id)

    sides: dict[str, dict] = {"home": {}, "away": {}}
    contested: float | None = None
    seen_labels: set[str] = set()

    for row in rows[team_row_index + 1 :]:
        percent_spans = [
            span for span in row.spans if _PERCENT_RE.match(span.text.strip())
        ]
        non_value_spans = [
            span
            for span in row.spans
            if not _NUMERIC_SPAN_RE.match(span.text.strip())
            and span.text.strip() not in _UNIT_SPANS
        ]
        # The possession bar row — the page's only row with three combined percentage
        # spans, and the only row printing bare `Total` spans (its two `Total` labels
        # are furniture, not stat labels). The second disjunct keeps a *degraded* bar
        # — fewer or more percentages than three — inside the possession grammar, whose
        # count assertion names the real problem. It requires EVERY non-value span to
        # be `Total`, so a stat label that begins with "Total" and splits across spans
        # (`Total Passes (Complete)` → `Total`/`Passes`/`(Complete)`) is not misrouted
        # here but reaches its own row grammar.
        if len(percent_spans) == 3 or (
            non_value_spans
            and all(span.text.strip() == "Total" for span in non_value_spans)
        ):
            if "Possession" in seen_labels:
                raise StatisticsParseError(
                    "two possession bar rows on one Key Statistics page", report_id
                )
            seen_labels.add("Possession")
            home_possession, contested, away_possession = _parse_possession_row(
                row, report_id
            )
            sides["home"]["possession"] = home_possession
            sides["away"]["possession"] = away_possession
            continue

        home_spans, label_spans, away_spans = _split_stat_row(row)
        if not home_spans and not away_spans:
            continue  # furniture: the centred `Possession` section header
        label = _normalize_label(join_spans(label_spans)) if label_spans else ""
        if not label:
            # A value-only row (a page-number footer or a stray numeric strip below the
            # team-names row) has no label material once its numeric spans are consumed.
            # Skip it rather than fail: a genuinely broken *stat* row still fails loudly
            # below, where the closed-set completeness walk raises `MissingFieldError`
            # naming the required label that never appeared (review 2026-07-23).
            continue
        spec = _ROW_SPECS.get(label)
        if spec is None:
            raise UnknownStatisticError(
                f"row label {label!r} is not in the closed Key Statistics set",
                report_id,
            )
        if label in seen_labels:
            raise StatisticsParseError(
                f"stat row {label!r} appears twice on one page", report_id
            )
        seen_labels.add(label)
        for side, value_spans in (("home", home_spans), ("away", away_spans)):
            raw = join_spans(value_spans)
            if not raw:
                raise MissingFieldError(
                    f"{side}.{spec.fields[0]}: row {label!r} prints no {side} value",
                    report_id,
                )
            sides[side].update(_parse_value(spec, raw, side, report_id))

    for label, spec in _ROW_SPECS.items():
        if label not in seen_labels:
            raise MissingFieldError(
                f"required Key Statistics row {label!r} "
                f"(fields {', '.join(spec.fields)}) not found",
                report_id,
            )
    if contested is None:
        raise MissingFieldError(
            "required Key Statistics possession bar (possession, "
            "contested_possession) not found",
            report_id,
        )
    for side in ("home", "away"):
        for field in _TEAM_FIELDS:
            if field not in sides[side]:
                raise MissingFieldError(f"{side}.{field} missing after parse", report_id)

    return {"home": sides["home"], "away": sides["away"], "contested_possession": contested}


# --- Self-Validation checks (SM-C1: binary, within-report, never loosened) -------

# Three values each rounded to 1 decimal drift at most ±0.15 from an exact 100, so
# ±0.2 is principled, not corpus luck (Task 5.2). Verified corpus-wide.
POSSESSION_SUM_TOLERANCE = 0.2
# The printed completion is integer-rounded (495/547 prints 90), so ±1.0.
PASS_COMPLETION_TOLERANCE = 1.0


def _check(check_id: str, passed: bool, specifics: str) -> dict:
    return {"check": check_id, "result": "pass" if passed else "fail", "specifics": specifics}


def domain_b_checks(payload: dict, shots_counts: "dict | None" = None) -> list[dict]:
    """Domain B's self-validation checks over an extracted payload (AC 1).

    Recorded, never raised — a failed consistency check is data about this report, and
    the record still stages so the gate can localize it. `shots_counts` is the shots
    domain's `counts` block when the caller has it in hand (`extract_report` does): the
    reconciliation check compares this page's printed attempts against the attempts
    TABLE row count — two independent sources of the same fact. The comparison target
    is deliberately the table, never the marker count: markers-vs-table is already
    `shots-marker-count`'s check, and re-comparing against markers would double-report
    that mismatch here.
    """
    checks: list[dict] = []

    total = (
        payload["home"]["possession"]
        + payload["contested_possession"]
        + payload["away"]["possession"]
    )
    # Three 1-decimal values sum to a 1-decimal value; round the drift to 1 decimal
    # before comparing so the documented ±0.2 tolerance is the real tolerance and not
    # float-arithmetic noise (an exact-boundary sum lands at 100.20000000000002).
    drift = round(abs(total - 100.0), 1)
    checks.append(
        _check(
            "key-statistics-possession-sum",
            drift <= POSSESSION_SUM_TOLERANCE,
            f"home {payload['home']['possession']} + contested "
            f"{payload['contested_possession']} + away {payload['away']['possession']} "
            f"= {round(total, 1)} (expected 100 ±{POSSESSION_SUM_TOLERANCE})",
        )
    )

    notes: list[str] = []
    for side in ("home", "away"):
        team = payload[side]
        if team["shots_on_target"] > team["shots"]:
            notes.append(
                f"{side}: {team['shots_on_target']} on target > {team['shots']} attempts"
            )
        if team["passes_completed"] > team["passes"]:
            notes.append(
                f"{side}: {team['passes_completed']} completed > {team['passes']} passes"
            )
        if team["direct_pressures"] > team["defensive_pressures"]:
            notes.append(
                f"{side}: {team['direct_pressures']} direct > "
                f"{team['defensive_pressures']} pressures"
            )
        computed = (
            100.0 * team["passes_completed"] / team["passes"] if team["passes"] else 0.0
        )
        if abs(team["pass_completion"] - computed) > PASS_COMPLETION_TOLERANCE:
            notes.append(
                f"{side}: printed completion {team['pass_completion']} vs computed "
                f"{computed:.2f} (±{PASS_COMPLETION_TOLERANCE})"
            )
    checks.append(
        _check(
            "key-statistics-internal-consistency",
            not notes,
            "; ".join(notes) if notes else "subset counts and completion % consistent",
        )
    )

    if shots_counts is not None:
        shot_notes = [
            f"{side}: Key Statistics prints {payload[side]['shots']} attempts, "
            f"attempts table lists {shots_counts[side]['table']}"
            for side in ("home", "away")
            if payload[side]["shots"] != shots_counts[side]["table"]
        ]
        checks.append(
            _check(
                "key-statistics-shots-reconciliation",
                not shot_notes,
                "; ".join(shot_notes)
                if shot_notes
                else "printed attempts equal the attempts-table row counts",
            )
        )

    return checks

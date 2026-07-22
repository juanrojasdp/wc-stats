"""Cover-page metadata probe: the stratification keys for verification mode.

Everything the sample selection needs (teams, venue, stage, date) comes from the PDFs
themselves — there is no hand-maintained schedule table anywhere in this pipeline.

Cover layout, read off `spike/mex_rsa.pdf`:

    Mexico 2 - 0 South Africa      <- scoreline
    Group A - Match 1              <- stage
    11 June 2026                   <- date
    13:00 Kick Off                 <- kick-off time
    Mexico City Stadium            <- venue
    POST MATCH SUMMARY REPORT      <- report title (the cover anchor)

A match decided on penalties carries one extra line under the scoreline, confirmed against
the real corpus (4 of 104 reports, 2026-07-22):

    Germany 1 - 1 Paraguay
    (Paraguay win 3-4 on Penalties)   <- shoot-out line, knockout ties only
    Round of 32 - Match 74
    ...

The two strongly-patterned lines (date, kick-off) are located by regex, and the whole
block is then required to hold exactly that shape: scoreline, optional shoot-out line,
stage, date, kick-off, venue, cover anchor, each immediately following the last.
Asserting the shape positively
— rather than merely rejecting a handful of known-wrong lines in the stage and venue
slots — is what keeps the probe honest. An inserted line (an attendance row, a sponsor
strip) shifts the block and raises `ProbeError` instead of silently promoting that line
to a venue name, which is exactly the mid-tournament template revision this gate exists
to catch.

Team crests sit between the scoreline spans as image blocks, so pymupdf's own line
grouping splits `"Mexico 2 - 0"` from `"South Africa"`. Lines are therefore rebuilt by
vertical position rather than taken from the text-extraction structure.
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf

from pipeline.discover.errors import MissingAnchorError, ProbeError
from pipeline.discover.text import find_first_anchor_page, normalize

COVER_ANCHOR = "POST MATCH SUMMARY REPORT"

# Spans whose tops differ by less than this many points belong to the same visual line.
_LINE_TOLERANCE_PT = 3.0
# A horizontal gap wider than this between adjacent spans reads as a word break.
_SPACE_GAP_PT = 1.0

_DATE_RE = re.compile(r"^(\d{1,2}) ([A-Z][a-z]+) (\d{4})$")
_KICKOFF_RE = re.compile(r"^(\d{1,2}):(\d{2}) Kick Off$")
_SCORE_RE = re.compile(r"^(?P<home>\S.*?) (?P<home_score>\d+) - (?P<away_score>\d+) (?P<away>\S.*)$")
_GROUP_RE = re.compile(r"^Group ([A-Z])\b")
# A knockout tie decided on penalties prints the shoot-out result on its own line between
# the scoreline and the stage, e.g. "(Paraguay win 3-4 on Penalties)".
_SHOOTOUT_RE = re.compile(r"^\(.*\bon Penalties\)$", re.IGNORECASE)
# Defensive: should a scoreline ever carry an inline suffix instead, the greedy away group
# would swallow it into the team name and break every per-team anchor. Not seen in the
# 104-report corpus, so this stays a fail-loud guard rather than a silent fix-up.
_SCORE_SUFFIX_RE = re.compile(r"\s*\([^)]*\)\s*$")

_MONTHS = {
    "January": 1,
    "February": 2,
    "March": 3,
    "April": 4,
    "May": 5,
    "June": 6,
    "July": 7,
    "August": 8,
    "September": 9,
    "October": 10,
    "November": 11,
    "December": 12,
}


@dataclass(frozen=True)
class ReportMeta:
    """Identity and stratification keys of one PMSR report."""

    report_id: str
    source_path: str
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    stage_text: str
    group: str | None
    match_date: dt.date
    kickoff: str
    venue: str
    # Filled by `rounds.assign_matchday_rounds` — group matchdays are only knowable
    # once the whole corpus is on the table.
    matchday_round: str | None = None
    # The cover's shoot-out line, verbatim, for the knockout ties that print one.
    shootout: str | None = None
    # Recoverable oddities seen while probing: the report is still usable, but the
    # runner records each one as a deviation so nothing is fixed up silently.
    probe_notes: tuple[str, ...] = ()

    @property
    def teams(self) -> tuple[str, str]:
        return (self.home_team, self.away_team)

    @property
    def kickoff_sort_key(self) -> tuple[int, int]:
        """Kick-off as (hour, minute) — `"9:00"` must not sort after `"21:00"`."""
        hour, _, minute = self.kickoff.partition(":")
        return (int(hour), int(minute))


def _join_spans(spans: "list[tuple[float, float, str]]") -> str:
    """Join one line's spans left to right, restoring spaces the layout only implies.

    Adjacent spans usually abut exactly (the cover's scoreline separators are literal
    space spans), but a wide visual gap — such as the one the away team's crest leaves
    between `"0"` and `"South Africa"` — carries no space character of its own.
    """
    parts: list[str] = []
    previous_x1: float | None = None
    for x0, x1, text in sorted(spans):
        if previous_x1 is not None and x0 - previous_x1 > _SPACE_GAP_PT:
            parts.append(" ")
        parts.append(text)
        previous_x1 = x1
    return normalize("".join(parts))


def cover_lines(page: "pymupdf.Page") -> list[str]:
    """Normalized text lines of a page, rebuilt by vertical position, top to bottom."""
    spans: list[tuple[float, float, float, str]] = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:  # image block
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                if span["text"].strip():
                    x0, y0, x1, _ = span["bbox"]
                    spans.append((y0, x0, x1, span["text"]))

    lines: list[str] = []
    current: list[tuple[float, float, str]] = []
    current_y: float | None = None
    for y0, x0, x1, text in sorted(spans, key=lambda s: (s[0], s[1])):
        if current_y is not None and abs(y0 - current_y) > _LINE_TOLERANCE_PT:
            lines.append(_join_spans(current))
            current = []
            current_y = None
        if current_y is None:
            current_y = y0
        current.append((x0, x1, text))
    if current:
        lines.append(_join_spans(current))
    return [line for line in lines if line]


def _find_single(lines: list[str], pattern: re.Pattern[str], what: str, report_id: str) -> int:
    """Index of the one line matching `pattern`.

    Ambiguity is a failure, not something to resolve by taking the first hit: a second
    date- or kick-off-shaped line means the cover gained a block, and quietly reading the
    stage and venue from around the wrong one produces a plausible but wrong
    stratification key with no deviation recorded.
    """
    matches = [i for i, line in enumerate(lines) if pattern.match(line)]
    if not matches:
        raise ProbeError(f"cover page has no {what} line", report_id)
    if len(matches) > 1:
        found = ", ".join(repr(lines[i]) for i in matches)
        raise ProbeError(f"cover page has {len(matches)} {what} lines: {found}", report_id)
    return matches[0]


def probe_report(path: "str | Path") -> ReportMeta:
    """Read one report's stratification metadata from its cover page.

    Cheap by construction: the cover anchor matches on the first page, so
    `find_first_anchor_page` stops there and no full-document text walk happens.

    Raises `ProbeError` if the cover cannot be found or is not fully readable.
    """
    path = Path(path)
    report_id = path.stem
    try:
        with pymupdf.open(path) as doc:
            try:
                page_no = find_first_anchor_page(doc, COVER_ANCHOR, report_id)
            except MissingAnchorError as exc:
                raise ProbeError(
                    f"cover anchor {COVER_ANCHOR!r} not found in any page", report_id
                ) from exc
            lines = cover_lines(doc[page_no])
    except ProbeError:
        raise
    except Exception as exc:  # unreadable/corrupt PDF is a probe failure, not a crash
        raise ProbeError(f"could not open report: {exc}", report_id) from exc

    notes: list[str] = []

    date_idx = _find_single(lines, _DATE_RE, "date", report_id)
    kickoff_idx = _find_single(lines, _KICKOFF_RE, "kick-off time", report_id)

    day, month_name, year = _DATE_RE.match(lines[date_idx]).groups()
    if month_name not in _MONTHS:
        raise ProbeError(f"unknown month name {month_name!r} on cover", report_id)
    try:
        match_date = dt.date(int(year), _MONTHS[month_name], int(day))
    except ValueError as exc:
        # A date-shaped but impossible line ("31 June 2026") is report data, so it must
        # become a recorded deviation. Letting ValueError escape would abort the scan of
        # every remaining report in the corpus.
        raise ProbeError(f"cover date {lines[date_idx]!r} is not a real date: {exc}", report_id)

    hour, minute = _KICKOFF_RE.match(lines[kickoff_idx]).groups()
    kickoff = f"{int(hour):02d}:{minute}"

    # The cover block must hold its documented shape, each line immediately following the
    # last: scoreline, stage, date, kick-off, venue, cover anchor. Checking the shape
    # positively is what turns an inserted line into a deviation rather than a phantom
    # venue name (see the module docstring).
    if kickoff_idx != date_idx + 1:
        raise ProbeError(
            f"cover kick-off line is not directly below the date "
            f"(date at {date_idx}, kick-off at {kickoff_idx})",
            report_id,
        )
    if date_idx < 2:
        raise ProbeError("cover page has no scoreline and stage line above the date", report_id)

    stage_text = lines[date_idx - 1]
    if _SCORE_RE.match(stage_text):
        raise ProbeError("cover page has no stage line between scoreline and date", report_id)

    # A shoot-out line, when present, sits between the scoreline and the stage.
    shootout: str | None = None
    score_idx = date_idx - 2
    if _SHOOTOUT_RE.match(lines[score_idx]):
        shootout = lines[score_idx]
        score_idx -= 1
        if score_idx < 0:
            raise ProbeError(
                f"cover page has a shoot-out line {shootout!r} but no scoreline above it",
                report_id,
            )

    score_line = lines[score_idx]
    score = _SCORE_RE.match(score_line)
    if not score:
        raise ProbeError(
            f"cover scoreline slot holds a non-scoreline: {score_line!r}", report_id
        )

    if kickoff_idx + 2 >= len(lines):
        raise ProbeError(
            "cover page has no venue line and report title below the kick-off time", report_id
        )
    venue = lines[kickoff_idx + 1]
    if COVER_ANCHOR in venue or _DATE_RE.match(venue) or _KICKOFF_RE.match(venue):
        raise ProbeError(f"venue slot holds a non-venue line: {venue!r}", report_id)
    if COVER_ANCHOR not in lines[kickoff_idx + 2]:
        raise ProbeError(
            f"cover block does not end with {COVER_ANCHOR!r} below the venue; "
            f"found {lines[kickoff_idx + 2]!r}",
            report_id,
        )

    away_team = score.group("away")
    trimmed_away = _SCORE_SUFFIX_RE.sub("", away_team)
    if trimmed_away != away_team:
        # Never fix this up silently: the suffix is a scoreline format this registry has
        # never seen, and the first real knockout run should say so out loud.
        notes.append(
            f"scoreline {score_line!r} carries a suffix after the away team; "
            f"read as {trimmed_away!r}"
        )
        away_team = trimmed_away
    if not away_team:
        raise ProbeError(f"cover scoreline has no away team: {score_line!r}", report_id)

    group_match = _GROUP_RE.match(stage_text)

    return ReportMeta(
        report_id=report_id,
        source_path=path.as_posix(),
        home_team=score.group("home"),
        away_team=away_team,
        home_score=int(score.group("home_score")),
        away_score=int(score.group("away_score")),
        stage_text=stage_text,
        group=group_match.group(1) if group_match else None,
        match_date=match_date,
        kickoff=kickoff,
        venue=venue,
        shootout=shootout,
        probe_notes=tuple(notes),
    )


def probe_corpus(input_dir: "str | Path") -> tuple[list[ReportMeta], list[tuple[str, str]]]:
    """Probe every PDF in `input_dir`.

    Returns the successfully probed reports (sorted by report id) and the probe
    failures as `(report_id, reason)` pairs. A failing report never aborts the scan —
    it is excluded from stratification keys and recorded as a deviation by the runner.
    """
    input_dir = Path(input_dir)
    if not input_dir.is_dir():
        raise NotADirectoryError(f"input directory does not exist: {input_dir}")

    # `glob("*.pdf")` is case-insensitive on Windows and case-sensitive on POSIX, which
    # would make corpus membership — and therefore the gate result — depend on the host.
    # Match the suffix explicitly instead, so every platform sees the same corpus.
    paths = sorted(
        (p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"),
        key=lambda p: (p.stem, p.name),
    )

    metas: list[ReportMeta] = []
    failures: list[tuple[str, str]] = []
    seen: dict[str, Path] = {}
    for path in paths:
        report_id = path.stem
        if report_id in seen:
            # Report ids key every downstream mapping; a collision would silently drop a
            # report rather than verify it.
            failures.append(
                (
                    report_id,
                    f"duplicate report id: {path.name!r} collides with {seen[report_id].name!r}",
                )
            )
            continue
        seen[report_id] = path
        try:
            metas.append(probe_report(path))
        except ProbeError as exc:
            failures.append((report_id, exc.reason))
    return metas, failures

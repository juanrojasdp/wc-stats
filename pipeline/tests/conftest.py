"""Shared pytest fixtures. Repo-root-relative paths only (no absolute paths)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]

# Allow `python -m pytest pipeline/tests` from any working directory.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def mex_rsa_pdf(repo_root: Path) -> Path:
    """The ground-truth fixture (AR-16). Read-only — spike/ is frozen.

    NOT committed: it is a copyrighted FIFA report, so `.gitignore` excludes it and a fresh
    clone does not have it. That makes the skip below load-bearing rather than incidental —
    and a skip is exactly how a missing fixture comes to read as a pass. Under CI the absence
    is therefore a failure, so nobody can ship a green run in which these tests never
    executed. Locally it stays a skip, because a contributor without the corpus should still
    be able to run everything else.
    """
    path = repo_root / "spike" / "mex_rsa.pdf"
    if not path.exists():
        message = (
            "ground-truth fixture spike/mex_rsa.pdf not available — fetch it with "
            "download_pmsr_corpus.py (it is copyrighted and deliberately not committed)"
        )
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)
    return path


@pytest.fixture(scope="session")
def spike_corpus(mex_rsa_pdf: Path) -> Path:
    """`spike/` as a single-report corpus directory.

    Depends on `mex_rsa_pdf` deliberately: without that guard a missing fixture would
    leave `spike/` looking like an empty corpus, and every test using it would still pass
    having verified nothing at all.
    """
    return mex_rsa_pdf.parent


COVER_ANCHOR = "POST MATCH SUMMARY REPORT"

# The synthetic shots section's fixed geometry, exported so tests can derive expected
# values from what the factory drew instead of hardcoding a second literal.
PAGE_WIDTH, PAGE_HEIGHT = 960, 540
SHOTS_PITCH_COORDS = (40.0, 115.0, 400.0, 520.0)  # area 145,800 pt^2: in the frame window
SHOTS_MARKER_RADIUS = 5.625  # 11.25 pt diameter, the real markers' size
SHOTS_TABLE_HEADER = "Time Player Outcome Body Part Delivery Type"

# Outcome -> fill RGB, restated from the shots palette. Deliberately a literal rather
# than an import from `pipeline.markers`: the fixtures must keep drawing the colors the
# spec fixes even if the module under test corrupts its palette.
SHOTS_OUTCOME_RGB = {
    "goal": (0.00, 0.50, 0.00),
    "on-target": (0.36, 0.61, 0.84),
    "off-target": (0.96, 0.74, 0.00),
    "blocked": (0.70, 0.53, 1.00),
    "incomplete": (0.18, 0.30, 1.00),
}

# (outcome, fx, fy) per side: fractions of the pitch rect, fy measured down from the
# pitch top (the attacked goal), so fy 0.15 is a shot close to the goal.
DEFAULT_SHOTS_MARKERS = {
    "home": [("goal", 0.7, 0.15), ("off-target", 0.4, 0.45)],
    "away": [("on-target", 0.55, 0.3)],
}

# Story 1.5: the synthetic attempts table draws each cell at its header column's
# x-position (the real layout the column segmentation keys on). Values chosen so the
# longest contract outcome label ("Deflected Off Target - Defensive Event") stays inside
# its column at fontsize 10.
SHOTS_TABLE_COLUMNS = {
    "Time": 55.0,
    "Player": 100.0,
    "Outcome": 240.0,
    "Body Part": 470.0,
    "Delivery Type": 580.0,
}

# Marker outcome -> a compatible printed Outcome label (one per five-color outcome), so
# default table rows always satisfy the linking outcome cross-check. Deliberately a
# literal restatement, like SHOTS_OUTCOME_RGB: the fixtures must keep printing labels
# the contract fixes even if the module under test corrupts its mapping.
SHOTS_OUTCOME_TO_LABEL = {
    "goal": "On Target - Goal",
    "on-target": "On Target - Saved",
    "off-target": "Off Target",
    "blocked": "Incomplete - Blocked",
    "incomplete": "Incomplete - Assist",
}


def default_attempt_cells(markers, row_index):
    """What the factory prints in table row `row_index` (0-based, per side) by default.

    Row k's outcome label derives from marker k's outcome so linking's cross-check holds
    on default fixtures; rows beyond the marker list (count-mismatch fixtures) print the
    off-target default. Exported so tests derive expected values from what the factory
    drew instead of hardcoding a second literal.
    """
    outcome = markers[row_index][0] if row_index < len(markers) else "off-target"
    return {
        "time": 3 + 5 * row_index,
        "shirt": 9,
        "name": "Test PLAYER",
        "outcome": SHOTS_OUTCOME_TO_LABEL[outcome],
        "body": "Right Foot",
        "delivery": "Pass",
    }


def _shots_pitch():
    import pymupdf

    return pymupdf.Rect(*SHOTS_PITCH_COORDS)


# Late-bound so importing conftest constants never needs pymupdf at collection time.
class _ShotsPitchProxy:
    def __getattr__(self, name):
        return getattr(_shots_pitch(), name)


SHOTS_PITCH = _ShotsPitchProxy()


@pytest.fixture(scope="session")
def make_report():
    """Factory for a synthetic PMSR report whose every registered anchor resolves.

    The cover block is built in the exact shape `probe.probe_report` asserts positively —
    scoreline, optional shoot-out line, stage, date, kick-off, venue, cover anchor, each
    immediately following the last — because anything else fails to probe and the report
    never reaches the code under test.

    Anchor pages are generated from `ANCHOR_REGISTRY` itself rather than hand-listed, so
    a domain page added by a later story widens these fixtures automatically. Each anchor
    gets its own page with its text at the top, which is what `at_page_start` anchors
    require. Pass `drop_anchor_ids` to build a report that is missing a required section.

    The shots anchors are the exception (Story 1.3, closing the deferred-work gap): each
    emits the real two-page section — a map page with a stroked pitch rectangle, filled
    Bezier circle markers and a five-color legend row, then an event-table page with a
    header row and one Time-led text row per attempt. `shots_markers` places markers as
    (outcome, fx, fy) pitch fractions; `shots_table_rows` overrides the row count to
    force a Self-Validation mismatch; `shots_table_pages` splits the table across
    several pages as the real corpus does for high-attempt teams (rows per page, e.g.
    `{"home": [17, 9]}`); `shots_pages` breaks the layout (1 = map only, 3 = a stray
    anchored page with no table on it); `shots_table_header` replaces or removes the
    header line; `shots_draw_pitch=False` omits the pitch frame;
    `shots_decorate`/`shots_decorate_table` draw extra content on the map/table page for
    collision and ambiguity tests.

    Story 1.5 (additive): every marker gets a white ordinal digit label drawn on it and
    every table row prints full cells (Time, shirt+name, Outcome, Body Part, Delivery
    Type) at their header column x-positions, row k's outcome label derived from marker
    k's outcome (`default_attempt_cells`). `shots_ordinal_labels=False` suppresses all
    labels; `shots_label_text` / `shots_label_offset` corrupt, duplicate, suppress or
    displace individual labels; `shots_table_cells` overrides individual printed cells.

    `page_order` re-orders the anchor pages (the cover always stays first — `probe_report`
    reads it by position). `AC 4` says a shuffled or offset report must still resolve, so
    a fixture that can only ever emit registry order cannot demonstrate it.
    """
    from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors

    def _make(
        path: Path,
        *,
        number: int = 1,
        home: str = "Mexico",
        away: str = "South Africa",
        home_score: int = 2,
        away_score: int = 0,
        stage: str | None = None,
        # A real corpus venue: Domain A (Story 1.6) fails loud on any venue outside
        # the committed UTC-offset table, and extract_report runs it on every report.
        venue: str = "Mexico City Stadium",
        day: int = 11,
        kickoff: str = "13:00",
        shootout: str | None = None,
        drop_anchor_ids: "tuple[str, ...]" = (),
        page_order: "str" = "registry",
        filler_pages: int = 0,
        lineup_sides: "tuple[dict, dict] | None" = None,
        lineup_formations: "tuple" = ("4-1-2-3", "5-3-2"),
        shots_markers: "dict[str, list[tuple[str, float, float]]] | None" = None,
        shots_table_rows: "dict[str, int] | None" = None,
        shots_table_pages: "dict[str, list[int]] | None" = None,
        shots_table_header: "dict[str, str] | None" = None,
        shots_pages: "dict[str, int] | None" = None,
        shots_draw_pitch: bool = True,
        shots_decorate=None,
        shots_decorate_table=None,
        # Story 1.5 (additive): ordinal digit labels drawn centered on each marker,
        # matching the real layout, default on. `shots_label_text` overrides the label
        # printed for marker index i per side (a string to duplicate/corrupt, None to
        # suppress); `shots_label_offset` displaces a label by (dx, dy) pt so it falls
        # outside the link threshold; `shots_table_cells` overrides printed cell values
        # of table row k per side (keys: time, shirt, name, outcome, body, delivery).
        shots_ordinal_labels: bool = True,
        shots_label_text: "dict[str, dict[int, str | None]] | None" = None,
        shots_label_offset: "dict[str, dict[int, tuple[float, float]]] | None" = None,
        shots_table_cells: "dict[str, dict[int, dict]] | None" = None,
    ) -> Path:
        import pymupdf

        def emit_shots_pages(side: str, anchor_text: str) -> None:
            pitch = _shots_pitch()
            markers = (DEFAULT_SHOTS_MARKERS if shots_markers is None else shots_markers).get(
                side, DEFAULT_SHOTS_MARKERS[side]
            )
            page_count = (shots_pages or {}).get(side, 2)
            if page_count not in (1, 2, 3):
                raise AssertionError(f"shots_pages[{side!r}] must be 1, 2 or 3")

            map_page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            map_page.insert_text((40, 60), anchor_text, fontsize=11)
            if shots_draw_pitch:
                map_page.draw_rect(pitch, color=(1, 1, 1))
            for marker_index, (outcome, fx, fy) in enumerate(markers):
                center_x = pitch.x0 + fx * pitch.width
                center_y = pitch.y0 + fy * pitch.height
                map_page.draw_circle(
                    (center_x, center_y),
                    SHOTS_MARKER_RADIUS,
                    color=(1, 1, 1),
                    fill=SHOTS_OUTCOME_RGB[outcome],
                    width=0.75,
                )
                if shots_ordinal_labels:
                    # The real maps print the attempt's 1-based ordinal as white text
                    # ON its marker (probe 2026-07-23: label center < 1 pt from the
                    # marker center).
                    label = (shots_label_text or {}).get(side, {}).get(
                        marker_index, str(marker_index + 1)
                    )
                    if label is not None:
                        dx, dy = (shots_label_offset or {}).get(side, {}).get(
                            marker_index, (0.0, 0.0)
                        )
                        map_page.insert_text(
                            (center_x - 2.0 + dx, center_y + 2.2 + dy),
                            label,
                            fontsize=6,
                            color=(1, 1, 1),
                        )
            # The legend row the real maps carry: five distinct palette colors sharing
            # one y inside the pitch. Every synthetic run exercises legend exclusion.
            legend_y = pitch.y0 + 0.97 * pitch.height
            for i, rgb in enumerate(SHOTS_OUTCOME_RGB.values()):
                map_page.draw_circle(
                    (60 + i * 60, legend_y),
                    SHOTS_MARKER_RADIUS,
                    color=(1, 1, 1),
                    fill=rgb,
                    width=0.75,
                )
            if shots_decorate is not None:
                shots_decorate(side, map_page, pitch)
            if page_count == 1:
                return

            # The two row controls are mutually exclusive per side: `shots_table_pages`
            # would otherwise silently win and a test could assert against counts the
            # factory never drew.
            if side in (shots_table_pages or {}) and side in (shots_table_rows or {}):
                raise AssertionError(
                    f"pass shots_table_rows or shots_table_pages for {side!r}, not both"
                )
            rows_per_page = (shots_table_pages or {}).get(
                side, [(shots_table_rows or {}).get(side, len(markers))]
            )
            global_row = 0
            for page_rows in rows_per_page:
                table_page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
                table_page.insert_text((40, 60), anchor_text, fontsize=11)
                # The dark-blue header band behind the header text, like the real table
                # — the collision the geometry stage must keep inert.
                table_page.draw_rect(
                    pymupdf.Rect(55, 85, 400, 103), fill=SHOTS_OUTCOME_RGB["incomplete"]
                )
                header = (shots_table_header or {}).get(side, SHOTS_TABLE_HEADER)
                if header == SHOTS_TABLE_HEADER:
                    # The default header prints each column title at its column
                    # x-position — the geometry Story 1.5's column segmentation keys on.
                    for title, column_x in SHOTS_TABLE_COLUMNS.items():
                        table_page.insert_text((column_x, 100), title, fontsize=10)
                elif header:
                    table_page.insert_text((55, 100), header, fontsize=10)
                for i in range(page_rows):
                    cells = default_attempt_cells(markers, global_row)
                    cells.update((shots_table_cells or {}).get(side, {}).get(global_row, {}))
                    y = 130 + i * 20
                    for column_x, text in (
                        (SHOTS_TABLE_COLUMNS["Time"], str(cells["time"])),
                        (SHOTS_TABLE_COLUMNS["Player"], f"{cells['shirt']} {cells['name']}"),
                        (SHOTS_TABLE_COLUMNS["Outcome"], cells["outcome"]),
                        (SHOTS_TABLE_COLUMNS["Body Part"], cells["body"]),
                        (SHOTS_TABLE_COLUMNS["Delivery Type"], cells["delivery"]),
                    ):
                        table_page.insert_text((column_x, y), text, fontsize=10)
                    global_row += 1
                if shots_decorate_table is not None:
                    shots_decorate_table(side, table_page)
            if page_count == 3:
                extra = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
                extra.insert_text((40, 60), anchor_text, fontsize=11)

        stage = stage if stage is not None else f"Group A - Match {number}"
        lines = [f"{home} {home_score} - {away_score} {away}"]
        if shootout is not None:
            lines.append(shootout)
        lines += [stage, f"{day} June 2026", f"{kickoff} Kick Off", venue, COVER_ANCHOR]

        doc = pymupdf.open()
        cover = doc.new_page(width=960, height=540)
        y = 100.0
        for line in lines:
            cover.insert_text((80, y), line, fontsize=16)
            y += 40

        resolved = resolve_anchors(ANCHOR_REGISTRY, home=home, away=away)

        # A typo in `drop_anchor_ids` used to drop nothing at all, so a test written to
        # assert a missing-required-anchor failure would quietly build a complete report
        # and pass for the wrong reason. Fail the fixture instead.
        known = {anchor.anchor_id for anchor in resolved}
        unknown = sorted(set(drop_anchor_ids) - known)
        if unknown:
            raise AssertionError(f"drop_anchor_ids names no such anchor: {unknown}")

        body = [
            anchor
            for anchor in resolved
            if anchor.anchor_id != "cover" and anchor.anchor_id not in drop_anchor_ids
        ]
        if page_order == "reversed":
            body = list(reversed(body))
        elif page_order != "registry":
            raise AssertionError(f"unknown page_order {page_order!r}")

        # Content-free pages, so anchor pages sit at indices nothing could guess.
        for _ in range(filler_pages):
            doc.new_page(width=960, height=540)

        for anchor in body:
            if anchor.anchor_id in ("shots:home", "shots:away"):
                emit_shots_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            page = doc.new_page(width=960, height=540)
            page.insert_text((40, 60), anchor.text, fontsize=11)
            if anchor.anchor_id == "lineups":
                # The lineups page must parse as Domain A (Story 1.6) — extract_report
                # runs the extractor on every report. Default sides score-adaptively
                # reconcile their goal markers with the cover score.
                sides = (
                    lineup_sides
                    if lineup_sides is not None
                    else default_lineup_sides(home, away, home_score, away_score)
                )
                draw_lineup_page(
                    page, sides[0], sides[1], formations=lineup_formations, title=False
                )

        path.parent.mkdir(parents=True, exist_ok=True)
        doc.save(path)
        doc.close()
        return path

    return _make


# --- Story 1.6: synthetic lineup-page synthesis (additive — make_report untouched) ---
#
# Geometry mirrors the real template (960x540pt, two team columns around a central
# formation diagram): the home column prints number / position / name with minute
# markers rightward of the name; the away column mirrors it — markers leftward of the
# name, position and shirt number on the right edge. Marker glyphs are small filled
# rects immediately left of their minute text, in the exact six fill RGBs the corpus
# legend uses.

LINEUP_PAGE_ANCHOR = "Match Summary - Teams"

LINEUP_GLYPH_FILLS = {
    "goal": (0.0, 0.0, 0.0),
    "own-goal": (1.0, 0.0, 0.0),
    "sub-on": (0.02, 0.588, 0.412),
    "sub-off": (0.863, 0.149, 0.149),
    "card-yellow": (0.984, 0.749, 0.141),
    "card-red": (0.973, 0.443, 0.443),
}

_LINEUP_ROW_PITCH = 13.5
_LINEUP_START_Y = 115.0
_LINEUP_FONTSIZE = 9.0
_LINEUP_POSITIONS_11 = ("GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW")
_LINEUP_SUB_POSITIONS = ("GK", "DF", "MF", "FW", "FW")
_LINEUP_WORDS = (
    "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL",
    "INDIA", "JULIET", "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA",
)


def lineup_entry(shirt, pos, name, markers=(), name_above=None, name_below=None, glued=False):
    """One synthetic player row. `markers` are (kind, "NN'") pairs — kind is a
    `LINEUP_GLYPH_FILLS` key, a raw RGB tuple for an unknown-glyph test, or None to
    print a minute with no glyph at all."""
    return {
        "shirt": shirt,
        "pos": pos,
        "name": name,
        "markers": list(markers),
        "name_above": name_above,
        "name_below": name_below,
        "glued": glued,
    }


def lineup_side(team="Mexico", starters=None, substitutes=None, headers=True):
    """A clean default column: 11 starters (one GK first) and 5 substitutes."""
    if starters is None:
        starters = [
            lineup_entry(i + 1, _LINEUP_POSITIONS_11[i], f"Test {_LINEUP_WORDS[i]}")
            for i in range(11)
        ]
    if substitutes is None:
        substitutes = [
            lineup_entry(12 + i, _LINEUP_SUB_POSITIONS[i], f"Test {_LINEUP_WORDS[11 + i]}")
            for i in range(5)
        ]
    return {"team": team, "starters": starters, "substitutes": substitutes, "headers": headers}


def default_lineup_sides(home_team="Mexico", away_team="South Africa", home_goals=2, away_goals=0):
    """Sides whose goal markers reconcile with the given cover score, plus one
    substitution pair and one card per team, so every Self-Validation check passes."""
    home = lineup_side(home_team)
    away = lineup_side(away_team)
    for side, goals in ((home, home_goals), (away, away_goals)):
        for i in range(goals):
            # Spread goals over the five attacking starters (never the GK), distinct
            # minutes, at most a few markers per row so the chain stays in-band.
            side["starters"][5 + i % 5]["markers"].append(("goal", f"{5 + 7 * i}'"))
        side["starters"][3]["markers"].append(("card-yellow", "17'"))
        side["starters"][10]["markers"].append(("sub-off", "76'"))
        side["substitutes"][1]["markers"].append(("sub-on", "76'"))
    return home, away


def _draw_lineup_marker(page, x, base_y, kind, minute):
    import pymupdf

    if kind is not None:
        fill = LINEUP_GLYPH_FILLS[kind] if isinstance(kind, str) else tuple(kind)
        page.draw_rect(pymupdf.Rect(x - 11, base_y - 7, x - 4, base_y), color=None, fill=fill)
    page.insert_text((x, base_y), minute, fontsize=_LINEUP_FONTSIZE)


def _draw_lineup_column(page, side_key, spec):
    header_x = 33 if side_key == "home" else 870
    name_x = 87 if side_key == "home" else 760
    y = _LINEUP_START_Y
    for header, entries in (("STARTING", spec["starters"]), ("SUBSTITUTES", spec["substitutes"])):
        if spec.get("headers", True):
            page.insert_text((header_x, y), header, fontsize=_LINEUP_FONTSIZE)
        y += _LINEUP_ROW_PITCH
        for entry in entries:
            base_y = y
            if entry["name_above"] is not None:
                page.insert_text((name_x, base_y - 6), entry["name_above"], fontsize=_LINEUP_FONTSIZE)
            if entry["name_below"] is not None:
                page.insert_text((name_x, base_y + 6), entry["name_below"], fontsize=_LINEUP_FONTSIZE)
            if side_key == "home":
                page.insert_text((50, base_y), str(entry["shirt"]), fontsize=_LINEUP_FONTSIZE)
                page.insert_text((69, base_y), entry["pos"], fontsize=_LINEUP_FONTSIZE)
                if entry["name"] is not None:
                    page.insert_text((87, base_y), entry["name"], fontsize=_LINEUP_FONTSIZE)
                for i, (kind, minute) in enumerate(entry["markers"]):
                    _draw_lineup_marker(page, 155 + 36 * i, base_y, kind, minute)
            else:
                for i, (kind, minute) in enumerate(entry["markers"]):
                    _draw_lineup_marker(page, 745 - 36 * i, base_y, kind, minute)
                if entry["name"] is not None:
                    page.insert_text((760, base_y), entry["name"], fontsize=_LINEUP_FONTSIZE)
                if entry["glued"]:
                    page.insert_text(
                        (882, base_y), f"{entry['pos']}{entry['shirt']}", fontsize=_LINEUP_FONTSIZE
                    )
                else:
                    page.insert_text((882, base_y), entry["pos"], fontsize=_LINEUP_FONTSIZE)
                    page.insert_text((898, base_y), str(entry["shirt"]), fontsize=_LINEUP_FONTSIZE)
            y += _LINEUP_ROW_PITCH
            if entry["name_below"] is not None:
                # A wrapped name shifts the rest of its own column, as on the real page.
                y += 6.0


def draw_lineup_page(page, home, away, formations=("4-1-2-3", "5-3-2"), title=True, decoys=True):
    """Draw a parseable two-column lineup page onto `page` (expects 960x540)."""
    import pymupdf

    if title:
        page.insert_text((12, 30), LINEUP_PAGE_ANCHOR, fontsize=12)
    page.insert_text((60, 72), home["team"], fontsize=11)
    page.insert_text((760, 72), away["team"], fontsize=11)
    _draw_lineup_column(page, "home", home)
    _draw_lineup_column(page, "away", away)
    if formations[0] is not None:
        page.insert_text((330, 210), formations[0], fontsize=_LINEUP_FONTSIZE)
    if formations[1] is not None:
        page.insert_text((600, 210), formations[1], fontsize=_LINEUP_FONTSIZE)
    if decoys:
        # The central formation-diagram digits, the momentum axis strip, the footer
        # lines and a distribution-chart football — everything the parser must ignore,
        # at the x-positions the real template prints them.
        for x, y, text in (
            (400, 150, "23"), (500, 260, "9"), (450, 310, "15"),
            (348, 490, "0"), (469, 490, "45"), (482, 490, "HT"), (607, 490, "90"),
            (372, 13, "11 June 2026 - Test Stadium - 13:00"),
            (437, 508, home["team"]), (485, 508, away["team"]),
        ):
            page.insert_text((x, y), text, fontsize=_LINEUP_FONTSIZE)
        page.draw_rect(pymupdf.Rect(369, 374, 378, 383), color=None, fill=(0.0, 0.0, 0.0))
        page.draw_rect(pymupdf.Rect(379, 138, 396, 155), color=None, fill=(1.0, 1.0, 1.0))


@pytest.fixture(scope="session")
def make_lineup_report(make_report):
    """`make_report` with per-side lineup overrides spelled out (Story 1.6 tests).

    A thin adapter: `home_side` / `away_side` replace one column while the other keeps
    the score-adaptive default, and `formations` forwards to `lineup_formations`.
    """

    def _make(
        path: Path,
        *,
        home_side: dict | None = None,
        away_side: dict | None = None,
        formations: "tuple" = ("4-1-2-3", "5-3-2"),
        **make_report_kwargs,
    ) -> Path:
        default_home, default_away = default_lineup_sides(
            make_report_kwargs.get("home", "Mexico"),
            make_report_kwargs.get("away", "South Africa"),
            make_report_kwargs.get("home_score", 2),
            make_report_kwargs.get("away_score", 0),
        )
        sides = (
            home_side if home_side is not None else default_home,
            away_side if away_side is not None else default_away,
        )
        return make_report(
            path, lineup_sides=sides, lineup_formations=formations, **make_report_kwargs
        )

    return _make

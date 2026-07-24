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


# --- Story 1.7: Key Statistics / Phases / Line-Height synthesis constants --------
#
# Deliberate literals, like SHOTS_OUTCOME_RGB: the fixtures must keep drawing the
# layout the corpus fixes even if the modules under test corrupt their constants.

KEY_STATISTICS_ROW_ORDER = (
    ("Goals", "goals", "count"),
    ("xG (Expected Goals)", "expected_goals", "decimal"),
    ("Attempts at Goal (On Target)", ("shots", "shots_on_target"), "compound"),
    ("Total Passes (Complete)", ("passes", "passes_completed"), "compound"),
    ("Pass Completion %", "pass_completion", "percent"),
    ("Completed Line Breaks", "completed_line_breaks", "count"),
    ("Defensive Line Breaks", "defensive_line_breaks", "count"),
    ("Receptions in the Final Third", "receptions_in_final_third", "count"),
    ("Crosses", "crosses", "count"),
    ("Ball Progressions", "ball_progressions", "count"),
    (
        "Defensive Pressures Applied (Direct Pressures)",
        ("defensive_pressures", "direct_pressures"),
        "compound",
    ),
    ("Forced Turnovers", "forced_turnovers", "count"),
    ("Second Balls", "second_balls", "count"),
    ("Total Distance Covered", "distance_covered", "km"),
    # The real label prints an en-dash (U+2013) after "Zone 4"; the parser folds it to
    # this hyphen form. The base-14 fixture font cannot encode the en-dash, so the
    # en-dash path itself is proven by the mex_rsa ground-truth tests.
    ("Zone 4 - Low Speed Sprinting: 20-25 km/h", "sprint_distance", "km"),
)

PHASES_IN_ROWS = (
    ("Build Up Unopposed", "build_up_unopposed"),
    ("Build Up Opposed", "build_up_opposed"),
    ("Progression", "progression"),
    ("Final Third", "final_third"),
    ("Long Ball", "long_ball"),
    ("Attacking Transition", "attacking_transition"),
    ("Counter Attack", "counter_attack"),
    ("Set Piece", "set_piece"),
)
PHASES_OUT_ROWS = (
    ("High Press", "high_press"),
    ("Mid Press", "mid_press"),
    ("Low Press", "low_press"),
    ("High Block", "high_block"),
    ("Mid Block", "mid_block"),
    ("Low Block", "low_block"),
    ("Recovery", "recovery"),
    ("Defensive Transition", "defensive_transition"),
    ("Counter-press", "counter_press"),
)

# The mex_rsa phase percentages (hand-verified in the m001 fixture).
DEFAULT_PHASES = {
    "home": {
        "build_up_unopposed": 47.0, "build_up_opposed": 13.0, "progression": 16.0,
        "final_third": 11.0, "long_ball": 3.0, "attacking_transition": 10.0,
        "counter_attack": 1.0, "set_piece": 5.0,
        "high_press": 9.0, "mid_press": 3.0, "low_press": 0.0, "high_block": 7.0,
        "mid_block": 25.0, "low_block": 11.0, "recovery": 5.0,
        "defensive_transition": 12.0, "counter_press": 8.0,
    },
    "away": {
        "build_up_unopposed": 43.0, "build_up_opposed": 13.0, "progression": 14.0,
        "final_third": 7.0, "long_ball": 6.0, "attacking_transition": 12.0,
        "counter_attack": 2.0, "set_piece": 5.0,
        "high_press": 6.0, "mid_press": 3.0, "low_press": 1.0, "high_block": 5.0,
        "mid_block": 30.0, "low_block": 14.0, "recovery": 2.0,
        "defensive_transition": 10.0, "counter_press": 7.0,
    },
}

LINE_HEIGHT_PANELS = {
    "in_possession": (
        ("Build Up Low", "build-up-low"),
        ("Build Up Mid", "build-up-mid"),
        ("Final Third Phase", "final-third-phase"),
    ),
    "out_of_possession": (
        ("High Block / Press", "high-block-press"),
        ("Mid Block", "mid-block"),
        ("Low Block", "low-block"),
    ),
}

# The mex_rsa home-team line-height values (measure names per Task 4.3's resolved
# bracket semantics: line height / team length / team width).
DEFAULT_LINE_HEIGHTS = {
    "in_possession": {
        "build-up-low": {"line_height": 19.0, "team_length": 40.0, "team_width": 56.0},
        "build-up-mid": {"line_height": 39.0, "team_length": 33.0, "team_width": 57.0},
        "final-third-phase": {"line_height": 54.0, "team_length": 35.0, "team_width": 47.0},
    },
    "out_of_possession": {
        "high-block-press": {"line_height": 46.0, "team_length": 38.0, "team_width": 43.0},
        "mid-block": {"line_height": 38.0, "team_length": 30.0, "team_width": 42.0},
        "low-block": {"line_height": 19.0, "team_length": 26.0, "team_width": 35.0},
    },
}

# The measurement-graphic gray of the real line-height brackets.
LINE_HEIGHT_GRAY = (0.42, 0.447, 0.502)

# --- Story 1.11: crosses page synthesis constants ------------------------------------
#
# Deliberate literals like SHOTS_OUTCOME_RGB: the fixtures must keep drawing what the
# corpus fixes even if the module under test corrupts its constants. The real crosses
# section is a SINGLE page per team: pitch map (left), stat panels (middle) and a
# per-player delivery-aggregate table (right, x >= ~585). Cross markers are 7.4 pt
# filled Bezier circles with a white stroke in exactly two fills; the legend is a pair
# of 9.0 pt STROKELESS swatches drawn INSIDE the pitch rect (the visible map only uses
# the frame's top; panels overprint its clipped lower region).

CROSSES_PITCH_COORDS = (40.0, 115.0, 400.0, 520.0)  # same frame window as the shots page
CROSSES_MARKER_RADIUS = 3.7  # 7.4 pt diameter, the real cross markers' size
CROSSES_LEGEND_RADIUS = 4.5  # 9.0 pt legend swatches — outside the marker size window

# Internal outcome key -> fill RGB, from the page legend words ("Attempted" = drawn
# orange = not completed; "Completed" = drawn blue).
CROSSES_OUTCOME_RGB = {
    "attempted": (0.96, 0.74, 0.00),
    "completed": (0.18, 0.30, 1.00),
}

# (outcome, fx, fy) per side: fractions of the pitch rect, like DEFAULT_SHOTS_MARKERS.
DEFAULT_CROSSES_MARKERS = {
    "home": [("attempted", 0.2, 0.15), ("completed", 0.85, 0.3)],
    "away": [("attempted", 0.6, 0.25)],
}

# Header word -> x position (the real template's layout: "Push Cross" and
# "Total Attempted" print stacked over two lines).
CROSSES_TABLE_COLUMNS = {
    "#": 590.0,
    "Player": 606.0,
    "Inswing": 725.0,
    "Outswing": 756.0,
    "Driven": 794.0,
    "Lofted": 823.0,
    "Cutback": 851.0,
    "Push": 887.0,
    "Cross": 886.0,
    "Total": 921.0,
    "Attempted": 913.0,
}

# Numeric cell x positions in column order (Inswing..Push Cross, then Total Attempted).
CROSSES_VALUE_XS = (734.0, 768.0, 801.0, 830.0, 861.0, 891.0)
CROSSES_TOTAL_X = 925.0


def default_cross_rows(markers):
    """One aggregate player row whose Total Attempted equals the marker count.

    Mirrors `default_attempt_cells`' role: exported so tests derive expected values
    from what the factory drew instead of hardcoding a second literal. `counts` is the
    six delivery-column values in printed order (all inswing by default).
    """
    return [{"shirt": 9, "name": "Test PLAYER", "counts": (len(markers), 0, 0, 0, 0, 0)}]

# Line-height page geometry (mirrors the real 960x540 template).
_LH_PITCH_Y0, _LH_PITCH_Y1 = 163.5, 485.2
_LH_PITCH_WIDTH = 225.0
_LH_PITCH_LENGTH_M, _LH_PITCH_WIDTH_M = 105.0, 68.0


def default_key_statistics(home_score=2, away_score=0, home_shots=2, away_shots=1):
    """A full Domain B stats block whose every self-validation check passes.

    `goals` mirror the cover score and `shots` the attempts-table rows the shots
    fixtures actually draw, so goal and shots reconciliation stay green by default.
    Every field differs between the two sides (the mex_rsa reference values), so a
    left/right stat misclassification cannot slip past the synthetic suite unseen — an
    equal-on-both-sides default would only be caught by the single mex_rsa ground-truth
    test (review 2026-07-23).
    """

    def side(score, shots, possession, passes, completed, completion, rest):
        return {
            "possession": possession,
            "goals": score,
            "expected_goals": round(0.4 + 0.7 * score, 2),
            "shots": shots,
            "shots_on_target": shots // 2,
            "passes": passes,
            "passes_completed": completed,
            "pass_completion": completion,
            "completed_line_breaks": rest[0],
            "defensive_line_breaks": rest[1],
            "receptions_in_final_third": rest[2],
            "crosses": rest[3],
            "ball_progressions": rest[4],
            "defensive_pressures": rest[5],
            "direct_pressures": rest[6],
            "forced_turnovers": rest[7],
            "second_balls": rest[8],
            "distance_covered": rest[9],
            "sprint_distance": rest[10],
        }

    # `rest` = the 11 non-score/possession/pass fields, distinct per side; home is the
    # mex_rsa home row, away its away row (direct_pressures stays <= defensive_pressures
    # on both, so internal-consistency holds).
    home_rest = (105, 10, 117, 13, 23, 170, 26, 31, 56, 107.3, 5.3)
    away_rest = (57, 3, 36, 8, 8, 306, 45, 32, 45, 97.1, 5.1)
    return {
        "home": side(home_score, home_shots, 57.1, 547, 495, 90.0, home_rest),
        "away": side(away_score, away_shots, 36.1, 351, 290, 83.0, away_rest),
        "contested_possession": 6.8,
    }


def _format_stat(value, kind):
    """The on-page text of one side's value for a stat row (space-separated pieces
    are drawn as separate spans, like the real template). A string value passes
    through verbatim so tests can print doctored raw text."""
    if isinstance(value, str):
        return value
    if kind == "count":
        return str(value)
    if kind == "compound":
        return f"{value[0]} ({value[1]})"
    if kind == "percent":
        return f"{value:g} %"
    if kind == "decimal":
        return f"{value:g}"
    return f"{value:g} km"  # kind == "km"


def default_key_statistics_rows(stats):
    """The (label, home_text, away_text) rows the factory prints for a stats block."""
    rows = []
    for label, fields, kind in KEY_STATISTICS_ROW_ORDER:
        values = []
        for side in ("home", "away"):
            if isinstance(fields, tuple):
                values.append(tuple(stats[side][field] for field in fields))
            else:
                values.append(stats[side][fields])
        rows.append((label, _format_stat(values[0], kind), _format_stat(values[1], kind)))
    return rows


def _insert_value_pieces(page, x, y, text, fontsize=10):
    """Print `text` as one span per space-separated piece, abutting like the real
    template (a value and its unit arrive as separate spans)."""
    import pymupdf

    cursor = x
    for piece in text.split(" "):
        page.insert_text((cursor, y), piece, fontsize=fontsize)
        cursor += pymupdf.get_text_length(piece, fontsize=fontsize) + 2.0


def draw_key_statistics_page(
    page,
    home_team="Mexico",
    away_team="South Africa",
    stats=None,
    *,
    rows=None,
    possession_texts=None,
    team_names=True,
):
    """Draw a parseable Key Statistics page body onto `page` (expects 960x540).

    The page anchor text is the caller's job (make_report prints it at the top).
    `rows` replaces the (label, home_text, away_text) stat rows for doctored pages;
    `possession_texts` replaces the three bar percentages (home, contested, away) as
    raw strings, or is `None`-able entirely by passing an empty tuple.
    """
    if stats is None:
        stats = default_key_statistics()
    if team_names:
        page.insert_text((60, 85), home_team, fontsize=11)
        page.insert_text((722, 85), away_team, fontsize=11)
    if possession_texts is None:
        possession_texts = (
            f"{stats['home']['possession']:g}%",
            f"{stats['contested_possession']:g}%",
            f"{stats['away']['possession']:g}%",
        )
    page.insert_text((450, 110), "Possession", fontsize=10)
    if possession_texts:
        page.insert_text((60, 128), "Total", fontsize=10)
        page.insert_text((95, 128), "86", fontsize=10)
        for x, text in zip((345, 526, 646), possession_texts):
            page.insert_text((x, 128), text, fontsize=10)
        page.insert_text((800, 128), "Total", fontsize=10)
        page.insert_text((838, 128), "835", fontsize=10)
    if rows is None:
        rows = default_key_statistics_rows(stats)
    y = 152.0
    for label, home_text, away_text in rows:
        _insert_value_pieces(page, 84, y, home_text)
        page.insert_text((380, y), label, fontsize=10)
        _insert_value_pieces(page, 833, y, away_text)
        y += 21.0


def draw_phases_page(page, phases=None, *, rows_in=None, rows_out=None):
    """Draw a parseable Phases of Play page body onto `page` (expects 960x540).

    `phases` is `{"home": {...17 snake keys...}, "away": {...}}` (defaults to the
    mex_rsa values). `rows_in` / `rows_out` replace a section's rows for doctored
    pages: tuples of (home_text, label, away_text) or (home_text, label, away_text,
    home_x, away_x) — the positional form places a bar-end value near the centre.
    """
    if phases is None:
        phases = DEFAULT_PHASES

    def default_rows(labels):
        return [
            (f"{phases['home'][key]:g}%", label, f"{phases['away'][key]:g}%")
            for label, key in labels
        ]

    if rows_in is None:
        rows_in = default_rows(PHASES_IN_ROWS)
    if rows_out is None:
        rows_out = default_rows(PHASES_OUT_ROWS)

    def draw_section(header, header_y, rows):
        page.insert_text((430, header_y), header, fontsize=11)
        y = header_y + 22.0
        for row in rows:
            home_text, label, away_text = row[:3]
            home_x = row[3] if len(row) > 3 else 100
            away_x = row[4] if len(row) > 4 else 700
            page.insert_text((home_x, y), home_text, fontsize=10)
            page.insert_text((430, y), label, fontsize=10)
            page.insert_text((away_x, y), away_text, fontsize=10)
            y += 22.0

    draw_section("IN POSSESSION", 105, rows_in)
    draw_section("OUT OF POSSESSION", 310, rows_out)


def _draw_bracket_badge(page, cx, cy):
    """The gray arrow badge a metre value prints on: a many-segment closed polygon
    (the real badge is a 20-item vector glyph ~24x15pt)."""
    import math

    shape = page.new_shape()
    points = [
        (cx + 12.0 * math.cos(2 * math.pi * k / 20), cy + 7.5 * math.sin(2 * math.pi * k / 20))
        for k in range(20)
    ]
    shape.draw_polyline(points + [points[0]])
    shape.finish(color=None, fill=LINE_HEIGHT_GRAY, closePath=True)
    shape.commit()


def _draw_metre_value(page, cx, cy, text):
    import pymupdf

    width = pymupdf.get_text_length(text, fontsize=9)
    page.insert_text((cx - width / 2 - 4, cy + 3), text, fontsize=9)
    page.insert_text((cx - width / 2 - 4 + width + 1.0, cy + 3), "m", fontsize=9)


def draw_line_height_page(
    page,
    kind="in_possession",
    values=None,
    *,
    headers=None,
    panel_count=3,
    skip=(),
    value_texts=None,
    value_offsets=None,
):
    """Draw a parseable Line Height & Team Length page onto `page` (expects 960x540).

    `values` maps panel key -> {line_height, team_length, team_width} in metres
    (defaults to `DEFAULT_LINE_HEIGHTS[kind]`); geometry is derived from the values at
    the real pitch scale. `headers` overrides the three printed panel headers;
    `panel_count` draws fewer/more pitch frames; `skip` omits (panel_index, measure)
    pairs entirely; `value_texts` overrides just the printed number of a pair;
    `value_offsets` displaces just the printed number by (dx, dy) so it misses its
    badge.
    """
    import pymupdf

    if values is None:
        values = DEFAULT_LINE_HEIGHTS[kind]
    panel_specs = LINE_HEIGHT_PANELS[kind]
    if headers is None:
        headers = [label for label, _ in panel_specs[:panel_count]]

    for index in range(panel_count):
        x0 = 82.5 + index * 285.0
        pitch = pymupdf.Rect(x0, _LH_PITCH_Y0, x0 + _LH_PITCH_WIDTH, _LH_PITCH_Y1)
        page.draw_rect(pitch, color=(1, 1, 1), width=3.2)
        if index < len(headers):
            page.insert_text((x0 + 60, _LH_PITCH_Y0 - 12), headers[index], fontsize=10)
        panel_key = panel_specs[index][1] if index < len(panel_specs) else None
        if panel_key is None or panel_key not in values:
            continue
        for measure, metres in values[panel_key].items():
            if (index, measure) in skip:
                continue
            text = (value_texts or {}).get((index, measure), f"{metres:g}")
            dx, dy = (value_offsets or {}).get((index, measure), (0.0, 0.0))
            if measure == "team_width":
                extent = metres / _LH_PITCH_WIDTH_M * _LH_PITCH_WIDTH
                cx, cy = (pitch.x0 + pitch.x1) / 2, pitch.y0 + 90.0
                for rx0, rx1 in ((cx - extent / 2, cx - 13), (cx + 13, cx + extent / 2)):
                    page.draw_rect(
                        pymupdf.Rect(rx0, cy - 0.35, rx1, cy + 0.35),
                        color=None,
                        fill=LINE_HEIGHT_GRAY,
                    )
            else:
                extent = metres / _LH_PITCH_LENGTH_M * (_LH_PITCH_Y1 - _LH_PITCH_Y0)
                if measure == "team_length":
                    cx, cy = pitch.x0 + 6.0, pitch.y0 + 160.0
                else:  # line_height: the bracket reaches the own-goal line
                    cx, cy = pitch.x1 - 6.0, pitch.y1 - extent / 2
                for ry0, ry1 in ((cy - extent / 2, cy - 9), (cy + 9, cy + extent / 2)):
                    page.draw_rect(
                        pymupdf.Rect(cx - 0.35, ry0, cx + 0.35, ry1),
                        color=None,
                        fill=LINE_HEIGHT_GRAY,
                    )
            _draw_bracket_badge(page, cx, cy)
            _draw_metre_value(page, cx + dx, cy + dy, text)


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
        # Story 1.7 (additive): every report now carries parseable Key Statistics,
        # Phases and four line-height pages — extract_report runs Domains B and C on
        # every report. Defaults are self-consistent: B `goals` mirror the cover
        # score and B `shots` the attempts-table rows the shots pages actually draw.
        key_statistics: "dict | None" = None,
        phases: "dict | None" = None,
        line_heights: "dict | None" = None,
        # Story 1.11 (additive): every report now carries parseable single-page crosses
        # sections — extract_report runs the crosses parser on every report. Markers are
        # (outcome, fx, fy) pitch fractions with outcome in CROSSES_OUTCOME_RGB;
        # `crosses_rows` overrides the per-player aggregate rows (dicts with shirt/name/
        # counts, optional total/name_below; cell values may be strings for doctored
        # pages); `crosses_two_tone` double-draws marker index i in BOTH palette fills
        # at the identical rect (the corpus anomaly the parser collapses);
        # `crosses_pages` emits extra anchored pages to break the single-page layout;
        # `crosses_header_replace` swaps or (None) drops individual header words;
        # `crosses_decorate` draws extra content on the map for collision tests.
        crosses_markers: "dict[str, list[tuple[str, float, float]]] | None" = None,
        crosses_rows: "dict[str, list[dict]] | None" = None,
        crosses_two_tone: "dict[str, tuple[int, ...]] | None" = None,
        crosses_pages: "dict[str, int] | None" = None,
        crosses_legend: bool = True,
        crosses_draw_pitch: bool = True,
        crosses_header_replace: "dict[str, dict[str, str | None]] | None" = None,
        crosses_decorate=None,
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

        def emit_crosses_pages(side: str, anchor_text: str) -> None:
            # Story 1.11: the real crosses section is ONE page — map, legend and the
            # per-player delivery table together (Task 1 probe: 208/208 corpus pages).
            pitch = pymupdf.Rect(*CROSSES_PITCH_COORDS)
            markers = (
                DEFAULT_CROSSES_MARKERS if crosses_markers is None else crosses_markers
            ).get(side, DEFAULT_CROSSES_MARKERS[side])

            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)

            def txt(x: float, y: float, text, fontsize: int = 7) -> None:
                # Fontsize 7 like the real table: the template's column x-positions
                # leave gaps a 10 pt font would bridge, gluing adjacent header words
                # into one extracted word.
                text = str(text)
                # Fullwidth digits need a font that can encode them (the shots tests'
                # `fontname="japan"` precedent).
                kwargs = {} if text.isascii() else {"fontname": "japan"}
                page.insert_text((x, y), text, fontsize=fontsize, **kwargs)

            if crosses_draw_pitch:
                page.draw_rect(pitch, color=(1, 1, 1))
            two_tone = (crosses_two_tone or {}).get(side, ())
            for marker_index, (outcome, fx, fy) in enumerate(markers):
                center = (pitch.x0 + fx * pitch.width, pitch.y0 + fy * pitch.height)
                fills = (
                    (CROSSES_OUTCOME_RGB["attempted"], CROSSES_OUTCOME_RGB["completed"])
                    if marker_index in two_tone
                    else (CROSSES_OUTCOME_RGB[outcome],)
                )
                for fill in fills:
                    page.draw_circle(
                        center, CROSSES_MARKER_RADIUS, color=(1, 1, 1), fill=fill, width=0.75
                    )
            if crosses_legend:
                # The two-swatch legend INSIDE the pitch rect, strokeless at 9.0 pt —
                # the real anatomy the size window must exclude.
                legend_y = pitch.y0 + 0.55 * pitch.height
                for i, rgb in enumerate(CROSSES_OUTCOME_RGB.values()):
                    page.draw_circle(
                        (pitch.x0 + 30 + i * 120, legend_y),
                        CROSSES_LEGEND_RADIUS,
                        color=None,
                        fill=rgb,
                    )

            # Header: main line plus the stacked "Push Cross" / "Total Attempted" pairs.
            replace = (crosses_header_replace or {}).get(side, {})

            def header_word(word: str, y_offset: float = 0.0) -> None:
                printed = replace.get(word, word)
                if printed is not None:
                    txt(CROSSES_TABLE_COLUMNS[word], 100.0 + y_offset, printed)

            for word in ("#", "Player", "Inswing", "Outswing", "Driven", "Lofted", "Cutback"):
                header_word(word)
            header_word("Push", -4.0)
            header_word("Cross", 3.7)
            header_word("Total", -4.0)
            header_word("Attempted", 3.7)

            side_rows = (
                crosses_rows[side]
                if crosses_rows is not None and side in crosses_rows
                else default_cross_rows(markers)
            )
            y = 130.0
            for row in side_rows:
                txt(CROSSES_TABLE_COLUMNS["#"], y, row["shirt"])
                if row.get("name") is not None:
                    txt(CROSSES_TABLE_COLUMNS["Player"], y - row.get("name_dy", 0.0), row["name"])
                if row.get("name_below") is not None:
                    # A two-line name straddles the numeric row line (±4.5 pt corpus).
                    txt(CROSSES_TABLE_COLUMNS["Player"], y + 4.5, row["name_below"])
                counts = row["counts"]
                total = row.get("total", sum(v for v in counts if isinstance(v, int)))
                for x, value in zip(CROSSES_VALUE_XS, counts):
                    txt(x, y, value)
                txt(CROSSES_TOTAL_X, y, total)
                y += 24.7
            if crosses_decorate is not None:
                crosses_decorate(side, page, pitch)
            for _ in range((crosses_pages or {}).get(side, 1) - 1):
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

        def drawn_table_rows(side: str) -> int:
            """The attempts-table row count the shots fixtures actually draw — the
            Domain B default `shots` value derives from it (Story 1.7, Task 5.4)."""
            side_markers = (
                DEFAULT_SHOTS_MARKERS if shots_markers is None else shots_markers
            ).get(side, DEFAULT_SHOTS_MARKERS[side])
            if (shots_pages or {}).get(side, 2) == 1:
                return 0
            if side in (shots_table_pages or {}):
                return sum(shots_table_pages[side])
            return (shots_table_rows or {}).get(side, len(side_markers))

        stats_block = (
            key_statistics
            if key_statistics is not None
            else default_key_statistics(
                home_score, away_score, drawn_table_rows("home"), drawn_table_rows("away")
            )
        )
        line_height_blocks = (
            line_heights if line_heights is not None else DEFAULT_LINE_HEIGHTS
        )

        for anchor in body:
            if anchor.anchor_id in ("shots:home", "shots:away"):
                emit_shots_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            if anchor.anchor_id in ("crosses:home", "crosses:away"):
                emit_crosses_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            page = doc.new_page(width=960, height=540)
            page.insert_text((40, 60), anchor.text, fontsize=11)
            # Story 1.7: the anchor loop matches RESOLVED ids, so the per-team
            # line-height branches use the suffixed forms (like the shots pair above).
            if anchor.anchor_id == "key-statistics":
                draw_key_statistics_page(page, home, away, stats=stats_block)
            elif anchor.anchor_id == "phases-of-play":
                draw_phases_page(page, phases)
            elif anchor.anchor_id in (
                "in-possession-line-height:home",
                "in-possession-line-height:away",
            ):
                draw_line_height_page(
                    page, "in_possession", line_height_blocks["in_possession"]
                )
            elif anchor.anchor_id in (
                "defensive-line-height:home",
                "defensive-line-height:away",
            ):
                draw_line_height_page(
                    page, "out_of_possession", line_height_blocks["out_of_possession"]
                )
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

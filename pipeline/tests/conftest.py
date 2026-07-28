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


# --- Story 1.12: defensive-actions page synthesis constants --------------------------
#
# Deliberate literals like SHOTS_OUTCOME_RGB. The real section is a SINGLE page per team
# carrying TWO stroked pitch panels of all-but-equal area, each titled just above its own
# frame, plus a headline band whose values sit ~48 pt above their stacked labels, plus a
# per-player "Total Possession Regains" table on the right. Markers are 8.87 pt filled
# Bezier circles with a white stroke in ONE fill; the bullet swatches are 9.0 pt and
# STROKELESS, sharing the markers' exact colour.

DEFENSIVE_ACTIONS_PANELS = (
    # (action type, panel rect) — the left panel is drawn FIRST and made very slightly
    # SMALLER, mirroring the corpus: `detect_pitch_frame`'s `max` would discard it, which
    # is exactly the regression the two-panel assertions guard.
    ("forced-turnover", (40.0, 200.0, 240.0, 500.0)),
    ("possession-regain", (300.0, 200.0, 500.3, 500.0)),
)
DEFENSIVE_ACTIONS_PANEL_TITLES = {
    "forced-turnover": "Forced Turnovers",
    "possession-regain": "Possession Regain",
}
# The headline label stacks under its value; the parser finds the value from the label.
DEFENSIVE_ACTIONS_HEADLINE = {
    "forced-turnover": ("Forced", "Turnovers"),
    "possession-regain": ("Possession", "Regained"),
}
# Column CENTRES: the parser matches a headline value to its label by x-centre, so the
# fixture must centre both like the real template does.
DEFENSIVE_ACTIONS_HEADLINE_XS = {"forced-turnover": 85.0, "possession-regain": 200.0}
DEFENSIVE_ACTIONS_VALUE_Y = 115.0
DEFENSIVE_ACTIONS_LABEL_Y = (151.0, 163.0)
DEFENSIVE_ACTIONS_TITLE_Y = 194.0

DEFENSIVE_ACTIONS_MARKER_RADIUS = 4.4355  # 8.871 pt diameter, the real markers' size
DEFENSIVE_ACTIONS_SWATCH_RADIUS = 4.5  # 9.0 pt strokeless bullet swatches
DEFENSIVE_ACTIONS_RGB = (0.18, 0.30, 1.00)
# The other bullet colours of the Possession-Contests list (outside both panels).
DEFENSIVE_ACTIONS_SWATCH_RGBS = (
    (0.18, 0.30, 1.00),
    (1.00, 0.24, 0.00),
    (0.70, 0.53, 1.00),
    (0.36, 0.61, 0.84),
)

# (fx, fy) per family per side: fractions of that panel's rect.
DEFAULT_DEFENSIVE_ACTIONS_MARKERS = {
    "home": {
        "forced-turnover": [(0.3, 0.7), (0.6, 0.8)],
        "possession-regain": [(0.5, 0.75), (0.2, 0.6), (0.8, 0.9)],
    },
    "away": {
        "forced-turnover": [(0.45, 0.65)],
        "possession-regain": [(0.35, 0.85), (0.7, 0.55)],
    },
}

# Each panel prints its own rotated DIRECTION label INSIDE its frame; `rotate=90` is the
# insertion that reproduces the corpus' writing-direction vector (0.0, -1.0) exactly, and
# `rotate=270` is the mirrored panel the parser must reject.
DEFENSIVE_ACTIONS_DIRECTION_TEXT = "DIRECTION"
DEFENSIVE_ACTIONS_DIRECTION_ROTATE = 90
DEFENSIVE_ACTIONS_DIRECTION_DY = 160.0

DEFENSIVE_ACTIONS_TABLE_COLUMNS = {"#": 730.0, "Player": 748.0, "Total": 909.0}
DEFENSIVE_ACTIONS_TOTAL_X = 915.0
# The stacked three-line header and the row band, kept clear of the headline band's
# y-lines (`table_lines` clusters across the whole page width, not per column).
DEFENSIVE_ACTIONS_TABLE_YS = {"total": 240.0, "header": 252.0, "regains": 261.0}
DEFENSIVE_ACTIONS_ROW_Y0 = 282.0
DEFENSIVE_ACTIONS_ROW_PITCH = 24.7


def default_defensive_action_rows(markers):
    """One per-player regains row per side. Deliberately NOT tied to the marker count:
    the real page's regains table counts something the possession-regain map does not
    plot (Task 1.2), and the parser must never check the map against it."""
    return [{"shirt": 7, "name": "Test REGAINER", "total": 3}]


# --- Story 1.13: receiving page synthesis constants ----------------------------------
#
# Both receiving families are DASHBOARDS, not marker maps, and the fixtures reproduce the
# real anatomy measured over all 104 reports / 416 pages — including the three collisions
# the parsers exist to survive:
#
#   1. a KPI value on the SAME `table_lines` cluster as the first table row (0.8 pt apart
#      on the real page), so the offers table's x-restriction has a regression that bites;
#   2. a three-line player name straddling its numeric row (4.5 pt above and below), which
#      leaves the numeric cluster with no name at all;
#   3. the movement page's rotated `... THIRD` labels extracting LEFT of the pitch panel's
#      own x0, so the Top Ranked Players table's right bound cannot be the panel edge.
#
# Geometry is expressed as word TOP (y0) rather than baseline, because that is what the
# parsers see; `_baseline_for_top` converts. PyMuPDF's word bbox is exactly
# `baseline - fontsize * ascender` .. `baseline - fontsize * descender`.
_HELV_ASCENDER = 1.075
_HELV_DESCENDER = -0.299


def _baseline_for_top(top: float, fontsize: float) -> float:
    """The insert_text baseline that puts a word's bbox top at `top`."""
    return top + fontsize * _HELV_ASCENDER


def _top_to_bottom(top: float, fontsize: float) -> float:
    """The bbox bottom of a word whose top is `top`."""
    return top - fontsize * _HELV_DESCENDER


# The two panels, at the corpus' own rects. Both are 192 x 274.5, so the decoration's
# per-panel relative positions come out bit-identical — the invariant the census asserts.
RECEIVING_OFFERS_PANELS = (
    ("offers_inside_shape", (234.0, 222.75, 426.0, 497.25)),
    ("offers_outside_shape", (450.0, 222.75, 642.0, 497.25)),
)
RECEIVING_OFFERS_PANEL_TITLES = {
    "offers_inside_shape": "Offers Made Inside Shape",
    "offers_outside_shape": "Offers Made Outside Shape",
}
# The right panel additionally carries two stroke+fill rects of bit-identical geometry
# (the raster shape overlay's border), so the page presents 4 qualifying rects for 2
# panels — the de-duplication the parser must do.
RECEIVING_OFFERS_OVERLAY_KEY = "offers_outside_shape"
RECEIVING_OFFERS_OVERLAY_COPIES = 2

RECEIVING_TITLE_TOP = 203.0
RECEIVING_TITLE_FONTSIZE = 8

RECEIVING_DOT_RADIUS = 4.1145  # 8.229 pt diameter, the real decoration's size
RECEIVING_DOT_RGB = (0.18, 0.30, 1.00)
# 11 (fx, fy) fractions of each panel — the static formation template, identical in both.
RECEIVING_DOT_OFFSETS = (
    (0.27, 0.28), (0.73, 0.28),
    (0.09, 0.50), (0.27, 0.50), (0.73, 0.50), (0.91, 0.50),
    (0.09, 0.67), (0.91, 0.67),
    (0.27, 0.68), (0.73, 0.68),
    (0.50, 0.90),
)
# White penalty/centre spots INSIDE the panels: filled all-Bezier circles that only
# `marker_min_pt` excludes. Admitting either aborts every report on a white fill.
RECEIVING_SPOT_RADIUS = 0.6855  # 1.371 pt penalty spots
RECEIVING_CENTRE_SPOT_RADIUS = 1.3715  # 2.743 pt centre spot

# The shape badges, the only word inside each panel. Different y per panel, as the corpus
# prints them — nothing positional may be read into either.
RECEIVING_BADGE_TOPS = {"offers_inside_shape": 350.0, "offers_outside_shape": 440.0}

RECEIVING_KPI_FONTSIZE = 14
RECEIVING_LABEL_FONTSIZE = 8
# Staging key -> (label lines, value x-centre, value top, first label top).
RECEIVING_KPI_LAYOUT = {
    "total_offers_made": (("Total Offers Made",), 110.0, 119.8, 158.0),
    "total_offers_received": (("Total Offers Received",), 325.0, 119.8, 158.0),
    "offers_final_third": (("Offers Made in Final Third",), 110.0, 225.0, 264.0),
    "offers_middle_third": (("Offers Made in Middle Third",), 110.0, 328.0, 366.0),
    # Two printed lines on 208/208 pages; the parser anchors on the FIRST only.
    "offers_defensive_third": (
        ("Offers Made in Defensive", "Third"),
        110.0,
        432.0,
        471.0,
    ),
}
RECEIVING_LABEL_LINE_PITCH = 15.0

RECEIVING_MOST_X = 534.0
RECEIVING_MOST_TITLE_TOP = 96.0
RECEIVING_MOST_VALUE_TOP = 110.0
RECEIVING_MOST_VALUE_FONTSIZE = 12
RECEIVING_MOST_NAME_TOP = 152.0
RECEIVING_MOST_POSITION_TOP = 166.0

RECEIVING_TABLE_FONTSIZE = 7
RECEIVING_TABLE_COLUMNS = {"#": 666.0, "Player": 686.0}
RECEIVING_TABLE_VALUE_XS = {"made": 820.0, "received": 868.0, "pct": 908.0}
# The stacked three-line header. The '#'+'Player' line is the parser's anchor and shares
# its y-cluster with the Most-Offers title, exactly as the corpus prints it.
RECEIVING_TABLE_TOPS = {"stack_top": 88.0, "header": 95.0, "stack_bottom": 102.0}
# `RECEIVING_ROW_TOP0 + 0.8` is where `total_offers_made`'s value lands: the collision the
# x-restriction closes. Keep the two in step if either moves.
RECEIVING_ROW_TOP0 = 119.0
RECEIVING_ROW_PITCH = 24.75

# --- the movement page
RECEIVING_MOVEMENT_PANEL = (675.0, 129.0, 936.0, 502.5)
RECEIVING_MOVEMENT_PANEL_TITLE = "Movement Types Pitch Third"
RECEIVING_MOVEMENT_TITLE_TOP = 110.0
# `rotate=90` reproduces the corpus' writing-direction vector (0.0, -1.0) exactly;
# `rotate=270` is the mirrored panel the parser must reject.
RECEIVING_DIRECTION_TEXT = "DIRECTION"
RECEIVING_DIRECTION_ROTATE = 90
RECEIVING_DIRECTION_AT = (920.0, 230.0)
# Rotated third labels, printed just LEFT of the panel's x0 as the corpus prints them
# (measured 6-7 pt outside). Values are (printed label, centre y).
RECEIVING_THIRD_LABELS = (
    ("FINAL THIRD", 166.0),
    ("MIDDLE THIRD", 294.0),
    ("DEFENSIVE THIRD", 420.0),
)
RECEIVING_THIRD_LABEL_X = 668.0

# Printed donut title -> (image rect, title top, centre-total position as (x, top)).
RECEIVING_DONUTS = {
    "Final Third Phase": ((24.0, 141.6, 214.0, 246.0), 130.0, (110.0, 188.0)),
    "Progression Phase": ((24.0, 272.9, 214.0, 376.6), 261.0, (110.0, 320.0)),
    "Build Up Phase": ((24.0, 403.4, 214.0, 507.8), 392.0, (110.0, 450.0)),
    "All Movement Types": ((310.0, 114.7, 610.0, 303.0), 100.0, (400.0, 195.0)),
}
RECEIVING_DONUT_TITLE_XS = {
    "Final Third Phase": 100.0,
    "Progression Phase": 100.0,
    "Build Up Phase": 100.0,
    "All Movement Types": 460.0,
}
# The five 9.0 pt legend swatches and their labels print INSIDE the All-Movement donut's
# image rect — non-digit words that must not disturb the "unique digit inside" read.
RECEIVING_LEGEND_X = 550.0
RECEIVING_LEGEND_SWATCH_X = 540.0
RECEIVING_LEGEND_TOP0 = 130.0
RECEIVING_LEGEND_PITCH = 16.5
RECEIVING_LEGEND_RADIUS = 4.5
RECEIVING_LEGEND_RGBS = (
    (1.00, 0.24, 0.00),
    (0.36, 0.61, 0.84),
    (0.96, 0.74, 0.00),
    (0.70, 0.53, 1.00),
    (0.18, 0.30, 1.00),
)

# The grid: label x inside the panel, values to their right. Row tops per third, plus the
# axis-tick row each third carries >= 21 pt below its last label (33 digit words inside
# the panel in total — why the grid is read label-anchored, not by visual row).
RECEIVING_GRID_LABEL_X = 684.0
RECEIVING_GRID_VALUE_X = 760.0
RECEIVING_GRID_ROW_TOPS = {
    "FINAL THIRD": (138.0, 153.0, 167.0, 179.0, 194.0),
    "MIDDLE THIRD": (266.0, 280.0, 294.0, 308.0, 322.0),
    "DEFENSIVE THIRD": (393.0, 407.0, 421.0, 435.0, 447.0),
}
# One value per third is printed off its label's own line, as the corpus does — the
# reason `table_lines` clustering cannot be used to pair label and value.
RECEIVING_GRID_VALUE_DY = {"FINAL THIRD": 3.0, "MIDDLE THIRD": 0.0, "DEFENSIVE THIRD": 0.0}
RECEIVING_TICK_TOPS = {"FINAL THIRD": 216.0, "MIDDLE THIRD": 342.0, "DEFENSIVE THIRD": 469.0}
RECEIVING_TICK_XS = (733.0, 752.0, 769.0, 788.0, 807.0, 827.0, 846.0, 865.0, 885.0, 904.0, 923.0)
RECEIVING_TICK_LABELS = (0, 8, 15, 23, 31, 39, 46, 54, 62, 69, 77)

RECEIVING_TOP_RANKED_TITLE_TOP = 346.0
RECEIVING_TOP_RANKED_COLUMNS = {"Type": 249.75, "Player": 346.5, "Movements": 571.5}
RECEIVING_TOP_RANKED_VALUE_XS = {"shirt": 346.0, "name": 358.0, "movements": 592.0}
RECEIVING_TOP_RANKED_HEADER_TOP = 375.0
# The fourth row deliberately shares a y-cluster with the defensive third's tick row, and
# the third with a grid label row — both real collisions the x-restriction closes.
RECEIVING_TOP_RANKED_ROW_TOPS = (396.0, 420.0, 446.0, 468.0, 495.0)

# Printed label -> the contract's kebab code, in printed order. A literal copy of the
# parser's own frozen map: a test asserts the two agree AND that neither carries
# `no-movement`, the contract's sixth value, which this page never prints.
RECEIVING_MOVEMENT_LABELS = (
    ("In Front", "in-front"),
    ("In Between", "in-between"),
    ("Out to In", "out-to-in"),
    ("In to Out", "in-to-out"),
    ("In Behind", "in-behind"),
)
RECEIVING_THIRD_ENUMS = {
    "FINAL THIRD": "final-third",
    "MIDDLE THIRD": "middle-third",
    "DEFENSIVE THIRD": "defensive-third",
}


def default_offers_block(player_rows):
    """The offers page's printed values, DERIVED from this report's own Domain G rows.

    Story 1.13 keys two cross-domain reconciliations on Domain G's per-player offers
    (`total_offers_made == Σ total_offers`, `total_offers_received == Σ offers_received`),
    so the fixture derives both totals rather than inventing them — the
    `default_player_stats_rows` discipline. The per-player table simply IS the Domain G
    row set, which makes the two table-sum reconciliations hold by construction too.

    Exported so tests derive expected values from what the factory drew, never a second
    literal.
    """
    made = [row["offers"][0] for row in player_rows]
    received = [row["offers"][7] for row in player_rows]
    total_made, total_received = sum(made), sum(received)
    # ASYMMETRIC splits, deliberately (2026-07-27 review patch). Every player row carries
    # the same `DEFAULT_OFFERS`, so `total_made` is always 21 x N — divisible by 3 for
    # every lineup size — and the previous `total_made // 3` / `total_made // 2` splits
    # printed 84/84/84 for the thirds and 126/126 for the two shape badges. That made the
    # story's own AD-8 proofs tautological: `test_panel_typing_is_text_anchored_not_positional`
    # asserted `126 == 126` and passed whether panel typing read the printed titles or
    # merely the x order, and `test_the_two_line_defensive_third_label_still_finds_its_value`
    # would have passed while returning the Final Third value. The three thirds and the
    # two badges must be pairwise DISTINCT for those tests to be able to fail; the
    # reconciliations they feed (`thirds_sum`, `shape_sum`) are sums, so any split holds.
    final_third = total_made // 2
    middle_third = total_made // 3
    inside = total_made // 3
    return {
        "total_offers_made": total_made,
        "total_offers_received": total_received,
        "offers_final_third": final_third,
        "offers_middle_third": middle_third,
        "offers_defensive_third": total_made - final_third - middle_third,
        "offers_inside_shape": inside,
        "offers_outside_shape": total_made - inside,
        "most_offers": {
            "value": max(made) if made else 0,
            "player_name": player_rows[0]["name"] if player_rows else "Test PLAYER",
            "position": "LEFT WINGER",
        },
        "rows": [
            {"shirt": row["shirt"], "name": row["name"], "made": m, "received": r}
            for row, m, r in zip(player_rows, made, received)
        ],
    }


def default_movement_block(player_rows):
    """The movement page's printed values, derived from the same Domain G rows.

    The grid's per-type totals must equal Domain G's FIVE-type sums (reconciliation #8 —
    never the six-type sum, because `no-movement` never appears on this page), and the
    All-Movement centre total must equal the grid sum. The three phase totals are
    deliberately NOT a partition of it, as the corpus's are not (the real delta ranges
    -48..+314 and is zero on 3 of 208 pages): a fixture whose phases summed to the total
    would quietly bless the check AC 2 forbids.
    """
    thirds = tuple(RECEIVING_GRID_ROW_TOPS)
    grid: dict[tuple[str, str], int] = {}
    per_type: dict[str, int] = {}
    for index, (_label, code) in enumerate(RECEIVING_MOVEMENT_LABELS, start=1):
        total = sum(row["offers"][index] for row in player_rows)
        per_type[code] = total
        # ASYMMETRIC, for the same reason as the offers thirds above (2026-07-27 review
        # patch): every per-type total is 21-times-something and divisible by 3, so the
        # previous `total // 3, total // 3, remainder` split drew all three thirds
        # IDENTICAL (24/24/24, 20/20/20, ...). `test_movement_values_are_what_the_page_printed`
        # compares the whole `{(third, type): count}` dict, which was therefore invariant
        # under any permutation of the three thirds — leaving the module's riskiest read
        # (nearest-label third assignment) with no coverage at all. The grid sum is what
        # the reconciliations use, and it is unchanged by how the total is split.
        first = total // 2
        second = total // 3
        grid[(thirds[0], code)] = first
        grid[(thirds[1], code)] = second
        grid[(thirds[2], code)] = total - first - second
    total_movements = sum(per_type.values())
    return {
        "total_movements": total_movements,
        "by_phase": {
            "Final Third Phase": total_movements // 2,
            "Progression Phase": total_movements // 3,
            "Build Up Phase": total_movements // 4,
        },
        "grid": grid,
        "per_type": per_type,
        "top_ranked": [
            {
                "label": label,
                "shirt": player_rows[index % len(player_rows)]["shirt"],
                "name": player_rows[index % len(player_rows)]["name"],
                "movements": per_type[code],
            }
            for index, (label, code) in enumerate(RECEIVING_MOVEMENT_LABELS)
        ]
        if player_rows
        else [],
    }


def default_cross_rows(markers):
    """One aggregate player row whose Total Attempted equals the marker count.

    Mirrors `default_attempt_cells`' role: exported so tests derive expected values
    from what the factory drew instead of hardcoding a second literal. `counts` is the
    six delivery-column values in printed order (all inswing by default).
    """
    return [{"shirt": 9, "name": "Test PLAYER", "counts": (len(markers), 0, 0, 0, 0, 0)}]

# --- Story 1.8: momentum chart synthesis constants ------------------------------------
#
# The real geometry, measured on all 104 reports: a plot box fixed in x, nine evenly
# spaced value gridlines plus a tenth axis rule 0.75 pt below the last, the baseline on
# the middle gridline at y=429.13, and bars 0.70 of the slot pitch wide. Slot pitch and
# value unit are DERIVED here exactly as the parser derives them — hardcoding either
# would let a fixture agree with a parser that had drifted from the corpus.

MOMENTUM_TITLE = "Distribution in the Final Third"
MOMENTUM_HOME_FILL = (1.0, 0.239, 0.0)
MOMENTUM_AWAY_FILL = (0.702, 0.533, 1.0)
MOMENTUM_GRID_STROKE = (0.878, 0.878, 0.878)
MOMENTUM_PLOT_X0, MOMENTUM_PLOT_X1 = 349.688, 633.0
MOMENTUM_GRID_TOP, MOMENTUM_GRID_STEP = 378.75, 12.595
MOMENTUM_BASELINE = 429.13  # == MOMENTUM_GRID_TOP + 4 * MOMENTUM_GRID_STEP
MOMENTUM_HALF_HEIGHT = 50.38
MOMENTUM_WIDTH_RATIO = 0.70
MOMENTUM_TICK_FONTSIZE = 9.0
MOMENTUM_AXIS_FONTSIZE = 8.25
MOMENTUM_LEGEND_Y0, MOMENTUM_LEGEND_Y1 = 509.25, 518.25

# A compact but structurally real regulation match: 96 slots, three minutes of first-half
# stoppage (HT on slot 48) and three of second-half (FT on the last slot, 95).
DEFAULT_MOMENTUM_SLOTS = 96
DEFAULT_MOMENTUM_TICKS = {
    "0": 0, "15": 14, "30": 29, "45": 44, "HT": 48,
    "60": 62, "75": 77, "90": 92, "FT": 95,
}
# slot -> (home, away). The peak (5) is a HOME bar, so a parser that read the away side
# for the scale would disagree with the printed top label immediately. Every listed value
# is distinct enough that an off-by-one slot assignment cannot pass.
DEFAULT_MOMENTUM_VALUES = {
    0: (1, 0), 10: (5, 2), 20: (3, 3), 44: (2, 0),
    47: (0, 1), 48: (1, 1), 92: (0, 2), 95: (1, 0),
}
DEFAULT_MOMENTUM_TOP_LABEL = 5


def momentum_pitch(slot_count=DEFAULT_MOMENTUM_SLOTS):
    """Slot pitch for a chart of `slot_count` slots — the parser's own derivation."""
    return (MOMENTUM_PLOT_X1 - MOMENTUM_PLOT_X0) / slot_count


def momentum_unit(top_label=DEFAULT_MOMENTUM_TOP_LABEL):
    """Points per value unit — the chart auto-scales so the peak fills the half height."""
    return MOMENTUM_HALF_HEIGHT / top_label


def _momentum_centred_text(page, text, centre_x, y, fontsize):
    """Insert `text` horizontally centred on `centre_x` at text baseline `y`."""
    import pymupdf

    width = pymupdf.get_text_length(text, fontsize=fontsize)
    page.insert_text((centre_x - width / 2.0, y), text, fontsize=fontsize)
    return width


def draw_momentum_page(
    page,
    home="Mexico",
    away="South Africa",
    *,
    values=None,
    slot_count=DEFAULT_MOMENTUM_SLOTS,
    ticks=None,
    top_label=DEFAULT_MOMENTUM_TOP_LABEL,
    axis_labels=None,
    gridlines=True,
    axis_rule=True,
    legend=True,
    title=True,
    decorate=None,
):
    """Draw the synthetic momentum band on `page`.

    `values` maps slot index -> `(home, away)` integer counts; a slot absent from the map
    draws no bar at all, which is exactly the corpus's own "empty minute" (9 to 36 per
    report) and is what the parser must fill with a real zero rather than a gap.

    `ticks` maps the printed x-axis label -> slot index. `axis_labels` overrides the nine
    printed y-axis labels. `gridlines=False` / `axis_rule=False` / `legend=False` break
    the chart structurally, and `decorate(page)` draws extra content for collision tests.
    """
    import pymupdf

    values = DEFAULT_MOMENTUM_VALUES if values is None else values
    ticks = DEFAULT_MOMENTUM_TICKS if ticks is None else ticks
    pitch = momentum_pitch(slot_count)
    unit = momentum_unit(top_label)
    bar_width = MOMENTUM_WIDTH_RATIO * pitch
    grid_bottom = MOMENTUM_GRID_TOP + 8 * MOMENTUM_GRID_STEP

    if title:
        page.insert_text((372.84, 361.89), MOMENTUM_TITLE, fontsize=12)

    if gridlines:
        for row in range(9):
            y = MOMENTUM_GRID_TOP + row * MOMENTUM_GRID_STEP
            page.draw_line(
                (MOMENTUM_PLOT_X0, y), (MOMENTUM_PLOT_X1, y),
                color=MOMENTUM_GRID_STROKE, width=0.75,
            )
        if axis_rule:
            # The tenth line the template draws just below the axis. Present so the
            # fixture exercises the parser's even-spacing run rather than letting a
            # naive max(y) accidentally agree with it.
            page.draw_line(
                (MOMENTUM_PLOT_X0, grid_bottom + 0.75),
                (MOMENTUM_PLOT_X1, grid_bottom + 0.75),
                color=MOMENTUM_GRID_STROKE, width=0.75,
            )

    if axis_labels is None:
        quarter = top_label / 4.0
        steps = [top_label - i * quarter for i in range(5)]
        printed = [f"{value:g}" for value in steps]
        axis_labels = printed + printed[-2::-1]
    for row, text in enumerate(axis_labels):
        y = MOMENTUM_GRID_TOP + row * MOMENTUM_GRID_STEP
        width = pymupdf.get_text_length(text, fontsize=MOMENTUM_AXIS_FONTSIZE)
        page.insert_text(
            (MOMENTUM_PLOT_X0 - 7.5 - width, y + 3.0), text,
            fontsize=MOMENTUM_AXIS_FONTSIZE,
        )

    for slot, (home_value, away_value) in sorted(values.items()):
        x0 = MOMENTUM_PLOT_X0 + slot * pitch + (pitch - bar_width) / 2.0
        x1 = x0 + bar_width
        if home_value:
            y0 = MOMENTUM_BASELINE - home_value * unit
            page.draw_polyline(
                [(x0, y0), (x1, y0), (x1, MOMENTUM_BASELINE), (x0, MOMENTUM_BASELINE), (x0, y0)],
                color=None, fill=MOMENTUM_HOME_FILL,
            )
        if away_value:
            y1 = MOMENTUM_BASELINE + away_value * unit
            page.draw_polyline(
                [(x0, MOMENTUM_BASELINE), (x1, MOMENTUM_BASELINE), (x1, y1), (x0, y1),
                 (x0, MOMENTUM_BASELINE)],
                color=None, fill=MOMENTUM_AWAY_FILL,
            )

    for label, slot in ticks.items():
        _momentum_centred_text(
            page, label, MOMENTUM_PLOT_X0 + (slot + 0.5) * pitch,
            grid_bottom + 12.0, MOMENTUM_TICK_FONTSIZE,
        )

    if legend:
        x = 420.0
        for fill, name in ((MOMENTUM_HOME_FILL, home), (MOMENTUM_AWAY_FILL, away)):
            page.draw_rect(
                pymupdf.Rect(x, MOMENTUM_LEGEND_Y0, x + 9.0, MOMENTUM_LEGEND_Y1),
                color=None, fill=fill,
            )
            page.insert_text((x + 11.0, MOMENTUM_LEGEND_Y1 - 2.0), name, fontsize=9.0)
            # The parser assembles a legend name from the words right of its swatch and
            # stops at the first gap wider than 8 pt, so the two entries must be further
            # apart than the space inside a two-word team name.
            x += 11.0 + pymupdf.get_text_length(name, fontsize=9.0) + 20.0

    if decorate is not None:
        decorate(page)


# --- Story 1.10: Domain G per-player page synthesis constants ------------------------
#
# Deliberate literals like SHOTS_OUTCOME_RGB. The four families are plain rectangular
# tables on the real 960x540 template: a right-aligned shirt number ending at x=30, a
# name from x=42, then the numeric columns. Three families are CENTRE-aligned and
# physical data is RIGHT-aligned — the fixtures reproduce both, because the parser's
# ordinal assignment must not quietly become x-band classification.

DOMAIN_G_FONTSIZE = 9.0
DOMAIN_G_SHIRT_X1 = 30.0
DOMAIN_G_NAME_X = 42.0
DOMAIN_G_HEADER_Y = 100.0
DOMAIN_G_ROW_Y0 = 130.0
DOMAIN_G_ROW_PITCH = 24.7

# Column centres / right edges measured on spike/mex_rsa.pdf.
DISTRIBUTIONS_CENTRE_XS = (
    219.0, 273.0, 327.0, 381.0, 435.0, 489.0, 543.0, 597.0, 651.0, 705.0, 759.0,
    813.0, 867.0, 921.0,
)
# The two percentage columns of the distributions family, by column index.
DISTRIBUTIONS_PERCENT_INDEXES = (2, 8)
OFFERS_CENTRE_XS = (226.0, 322.0, 418.0, 514.0, 610.0, 706.0, 802.0, 898.0)
# The `Tackles Made / Won` split cell prints as three spans; the other 13 columns are
# ordinary centred values.
OUT_OF_POSSESSION_TACKLE_XS = (209.0, 217.0, 223.0)
OUT_OF_POSSESSION_CENTRE_XS = (
    270.0, 324.0, 378.0, 432.0, 486.0, 540.0, 594.0, 648.0, 702.0, 756.0, 810.0,
    864.0, 918.0,
)
PHYSICAL_RIGHT_XS = (321.0, 395.0, 474.0, 559.0, 645.0, 722.0, 798.0, 870.0, 942.0)

# The per-row values every default Domain G row carries, minus the three derived from
# the report's own lineup and Key Statistics (goals, attempts at goal, and the whole
# physical block). Every column inside a family holds a DISTINCT value, so a
# left-to-right assignment that slips by one column cannot pass the synthetic suite.
#
# The head must stay distinct from the two DERIVED distributions columns as well, which
# is why it avoids 0, 1, 3 and 4: `attempts_at_goal` is `goals + 3` and `goals` is 0 or
# 1, so a head carrying a 1 or a 4 would collide with a scorer's own two columns —
# exactly the rows where a slip between `take_ons`, `attempts_at_goal` and `goals` is
# most likely and least visible. `crosses_completed <= crosses_attempted` still holds.
DEFAULT_DISTRIBUTIONS_HEAD = (33, 29, 88, 7, 20, 14, 13, 10, 77, 6, 18, 5)
DEFAULT_OFFERS = (21, 6, 5, 4, 3, 2, 1, 9)
DEFAULT_OUT_OF_POSSESSION = (8, 3, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16)


def _domain_g_players(spec):
    """(shirt, name) for every synthetic lineup entry that took the field.

    Mirrors `domain_g.has_minutes`: a starter always did, a substitute did exactly when
    the column stamped a sub-on marker on them.

    The name must mirror what Domain A will PARSE, not what the spec literally carries:
    a wrapped entry sets `name=None` and prints `name_above`/`name_below` on two lines,
    which Domain A joins into one name (`'Crysencio' + 'SUMMERVILLE'`). Reading only
    `name` here would print no Domain G row for a starter who has minutes, and the join
    would then raise `MissingFieldError` for a defect that is purely the fixture's — the
    trap the first test to combine a wrapped name with `make_report` would have fallen
    into. Only an entry with no printed name at all is skipped; those exist to make
    Domain A raise, which happens before Domain G ever runs.
    """
    players = []
    for section in ("starters", "substitutes"):
        for entry in spec[section]:
            name = entry.get("name")
            if not isinstance(name, str) or not name:
                wrapped = [
                    part
                    for part in (entry.get("name_above"), entry.get("name_below"))
                    if isinstance(part, str) and part
                ]
                if not wrapped:
                    continue
                name = " ".join(wrapped)
            if section == "starters" or any(
                kind == "sub-on" for kind, _minute in entry["markers"]
            ):
                players.append((entry["shirt"], name))
    return players


def _own_goals_scored_by(spec):
    """How many own goals this column's players scored (they credit the OPPONENT)."""
    return sum(
        1
        for section in ("starters", "substitutes")
        for entry in spec[section]
        for kind, _minute in entry["markers"]
        if kind == "own-goal"
    )


def _split_metres(total, count):
    """`count` one-decimal metre values summing to `total` (the last absorbs the rest)."""
    tenths = int(round(total * 10))
    base, remainder = divmod(tenths, count) if count else (0, 0)
    values = [base / 10.0] * count
    if values:
        values[0] = (base + remainder) / 10.0
    return values


def default_player_stats_rows(sides, stats):
    """The Domain G rows the factory prints, per side, derived from the report itself.

    The synthetic defaults carry three cross-domain couplings, and all three are derived
    rather than invented so a caller who changes the cover score, the lineup or the Key
    Statistics block keeps every Domain G check green:

    - the rows name exactly the lineup players WITH minutes, with matching shirts (the
      join, AC 2, and its completeness half, AC 1);
    - per-player `total_distance` sums to Key Statistics `distance_covered` x 1000;
    - per-player `goals` plus the OPPONENT column's own goals sum to Key Statistics
      `goals` — the own-goal term the corpus proved mandatory.

    Zone sums and the internal-consistency relations hold by construction. Exported so
    tests derive expected values from what the factory drew, never a second literal.
    """
    rows = {}
    specs = {"home": sides[0], "away": sides[1]}
    for side, other in (("home", "away"), ("away", "home")):
        players = _domain_g_players(specs[side])
        count = len(players)

        team_goals = stats[side]["goals"]
        own_goals = _own_goals_scored_by(specs[other])
        # A doctored non-integer `goals` exists only to make Domain B raise, which it
        # does before Domain G runs; print no goals rather than crash the factory.
        scored = (
            max(0, team_goals - own_goals) if isinstance(team_goals, int) else 0
        )
        if scored > count:
            # One goal per player from the top of the column cannot represent more goals
            # than there are players. Fail the FACTORY loudly rather than print a row set
            # whose goals reconciliation is short by construction — the caller would see
            # a Domain G check failure with nothing in the report pointing at the cause,
            # and this function's contract promises the opposite.
            raise ValueError(
                f"default_player_stats_rows: {side} scored {scored} but only {count} "
                "players have minutes; give the side more players with minutes, lower "
                "the score, or pass explicit player_stats_rows"
            )

        team_km = stats[side]["distance_covered"]
        total_m = round(team_km * 1000.0, 1) if isinstance(team_km, (int, float)) else 0.0
        distances = _split_metres(total_m, count)

        side_rows = []
        for index, ((shirt, name), metres) in enumerate(zip(players, distances)):
            # Spread the team's goals one per player from the top of the column.
            goals = 1 if index < scored else 0
            zone_5 = round(metres * 0.01, 1)
            zone_4 = round(metres * 0.02, 1)
            zone_3 = round(metres * 0.05, 1)
            zone_2 = round(metres * 0.20, 1)
            zone_1 = round(metres - zone_2 - zone_3 - zone_4 - zone_5, 1)
            side_rows.append(
                {
                    "shirt": shirt,
                    "name": name,
                    "distributions": DEFAULT_DISTRIBUTIONS_HEAD + (goals + 3, goals),
                    "offers": DEFAULT_OFFERS,
                    "out_of_possession": DEFAULT_OUT_OF_POSSESSION,
                    "physical": (
                        metres,
                        zone_1,
                        zone_2,
                        zone_3,
                        zone_4,
                        zone_5,
                        # `high_speed_runs` / `sprints` are integral values the page
                        # prints with a `.0` decimal — the drawer adds it, so these stay
                        # the ints the parser is expected to produce.
                        10 + index,
                        2 + index,
                        round(23.2 + index / 10.0, 1),
                    ),
                }
            )
        rows[side] = side_rows
    return rows


def _g_text(page, x, y, text, fontsize=DOMAIN_G_FONTSIZE):
    page.insert_text((x, y), str(text), fontsize=fontsize)


def _g_right(page, x1, y, text, fontsize=DOMAIN_G_FONTSIZE):
    """Print `text` right-aligned to `x1` (the shirt column and the physical values)."""
    import pymupdf

    text = str(text)
    width = pymupdf.get_text_length(text, fontsize=fontsize)
    page.insert_text((x1 - width, y), text, fontsize=fontsize)


def _g_centred(page, centre, y, text, fontsize=DOMAIN_G_FONTSIZE):
    import pymupdf

    text = str(text)
    width = pymupdf.get_text_length(text, fontsize=fontsize)
    page.insert_text((centre - width / 2, y), text, fontsize=fontsize)


def _g_row_head(page, row, y):
    """The shirt number (right-aligned to x=30) and the player name (from x=42).

    `name_spans` prints the name as SEVERAL spans — `[(dx, text), ...]`, each `dx` an
    offset from the name column's left edge — instead of one `insert_text`. The real
    pages fragment a name per glyph run (`'Ra' 'u' 'l' 'R' 'A' 'N' 'GE' 'L'`) and rely
    entirely on `join_spans`' gap rule to restore the implied space; a single-span name
    exercises none of that, so the gap rule's boundary is only reachable through this.
    """
    if row.get("shirt") is not None:
        _g_right(page, DOMAIN_G_SHIRT_X1, y, row["shirt"])
    pieces = row.get("name_spans")
    if pieces is not None:
        for offset, text in pieces:
            _g_text(page, DOMAIN_G_NAME_X + offset, y, text)
    elif row.get("name") is not None:
        _g_text(page, DOMAIN_G_NAME_X, y, row["name"])


def _g_header(page, titles):
    """The `#` / `Player` header the real families print. Never a player row: its
    leftmost span is the literal `#`, which the shirt grammar excludes."""
    _g_text(page, 25.0, DOMAIN_G_HEADER_Y, "#")
    _g_text(page, DOMAIN_G_NAME_X, DOMAIN_G_HEADER_Y, "Player")
    for centre, title in titles:
        _g_centred(page, centre, DOMAIN_G_HEADER_Y, title, fontsize=6)


def draw_distributions_page(page, rows, *, header=True, percent_gap=0.0):
    """Draw a parseable In Possession - Distributions body (14 centred columns).

    `percent_gap` displaces the `%` span rightward of its number by that many points, so
    a test can pin BOTH printed forms: abutting (the real page, and what pymupdf merges
    into one span here) and visibly separated (which `join_spans` renders as `'88 %'`).
    """
    import pymupdf

    if header:
        _g_header(page, [(x, f"C{i + 1}") for i, x in enumerate(DISTRIBUTIONS_CENTRE_XS)])
    y = DOMAIN_G_ROW_Y0
    for row in rows:
        _g_row_head(page, row, y)
        for index, (centre, value) in enumerate(
            zip(DISTRIBUTIONS_CENTRE_XS, row["distributions"])
        ):
            text = str(value)
            if index in DISTRIBUTIONS_PERCENT_INDEXES and not text.endswith("%"):
                # The number and its `%` print as two spans centred as one unit.
                width = pymupdf.get_text_length(text, fontsize=DOMAIN_G_FONTSIZE)
                percent_width = pymupdf.get_text_length("%", fontsize=DOMAIN_G_FONTSIZE)
                x0 = centre - (width + percent_gap + percent_width) / 2
                _g_text(page, x0, y, text)
                _g_text(page, x0 + width + percent_gap, y, "%")
            else:
                _g_centred(page, centre, y, text)
        y += DOMAIN_G_ROW_PITCH


def draw_offers_receptions_page(page, rows, *, header=True):
    """Draw a parseable In Possession - Offers & Receptions body (8 centred columns).

    The real page also prints a centred `Offer movement types` banner above the header
    row; it is furniture at its own y and never reaches a player row, so the fixture
    prints it too rather than pretending the page is cleaner than it is.
    """
    if header:
        _g_centred(page, 514.0, DOMAIN_G_HEADER_Y - 12.0, "Offer movement types", fontsize=7)
        _g_header(page, [(x, f"C{i + 1}") for i, x in enumerate(OFFERS_CENTRE_XS)])
    y = DOMAIN_G_ROW_Y0
    for row in rows:
        _g_row_head(page, row, y)
        for centre, value in zip(OFFERS_CENTRE_XS, row["offers"]):
            _g_centred(page, centre, y, value)
        y += DOMAIN_G_ROW_PITCH


def draw_out_of_possession_page(page, rows, *, header=True):
    """Draw a parseable Out of Possession body: the `Tackles Made / Won` split cell
    (three spans, as the real page prints it) then 13 centred columns."""
    if header:
        _g_header(
            page,
            [(OUT_OF_POSSESSION_TACKLE_XS[1], "Made/Won")]
            + [(x, f"C{i + 2}") for i, x in enumerate(OUT_OF_POSSESSION_CENTRE_XS)],
        )
    y = DOMAIN_G_ROW_Y0
    for row in rows:
        _g_row_head(page, row, y)
        values = row["out_of_possession"]
        made_x, slash_x, won_x = OUT_OF_POSSESSION_TACKLE_XS
        _g_text(page, made_x, y, values[0])
        _g_text(page, slash_x, y, "/")
        _g_text(page, won_x, y, values[1])
        for centre, value in zip(OUT_OF_POSSESSION_CENTRE_XS, values[2:]):
            _g_centred(page, centre, y, value)
        y += DOMAIN_G_ROW_PITCH


def draw_physical_page(page, rows, *, header=True):
    """Draw a parseable Physical Data body — 9 RIGHT-aligned columns, unlike the other
    three families, so the fixtures exercise both alignments the corpus prints.

    Every numeric column prints to one decimal, as the real page does — including
    `High Speed Runs` and `Sprints`, whose `.0` form is exactly the printed-decimal /
    stored-integer seam the parser asserts before narrowing. A string value passes
    through verbatim so doctored pages can print anything.
    """
    if header:
        _g_header(page, [(x - 12.0, f"C{i + 1}") for i, x in enumerate(PHYSICAL_RIGHT_XS)])
    y = DOMAIN_G_ROW_Y0
    for row in rows:
        _g_row_head(page, row, y)
        for x1, value in zip(PHYSICAL_RIGHT_XS, row["physical"]):
            text = value if isinstance(value, str) else f"{value:.1f}"
            _g_right(page, x1, y, text)
        y += DOMAIN_G_ROW_PITCH


DOMAIN_G_DRAWERS = {
    "individual-distributions": draw_distributions_page,
    "individual-offers-receptions": draw_offers_receptions_page,
    "individual-out-of-possession": draw_out_of_possession_page,
    "physical-data": draw_physical_page,
}


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


# --- Story 1.9: Domains E & F page synthesis constants --------------------------------
#
# Deliberate literals like SHOTS_OUTCOME_RGB: the fixtures must keep drawing what the
# corpus fixes even if the modules under test corrupt their constants. Geometry is taken
# from the real 960x540 pages measured on spike/mex_rsa.pdf, because the two layout rules
# these parsers live on are geometric and cannot be exercised by a tidier fixture:
#
#   1. a KPI value prints ABOVE its label and CENTRED on it, with rows in between that
#      carry OTHER numbers (for `Total Set Plays` the corners table's first data row, for
#      `Goalkeeper Line Breaks` the three donut centres);
#   2. a table's values print BELOW a header whose own band text is a closed constant, and
#      the goal-prevention page prints a stray digit LEFT of the table on the value row —
#      the corpus trap (PMSR-M38 home) that the `x >= 460` bound exists to survive.
#
# Positions are expressed as word TOPS (y0), because that is what the parsers' visual-row
# grouping sees; `_baseline_for_top` converts (shared with the Story 1.13 helpers above).

EF_FONTSIZE = 9
EF_LABEL_FONTSIZE = 8
# The date/venue strip every real page prints. It carries exactly two bare-integer words
# ('11' and '2026'; '13:00' is not one), which is why the set-plays numeric census is 24
# rather than 22 — the fixture must draw it or the census is unreachable.
EF_DATE_STRIP = "11 June 2026 - Test Stadium - 13:00"
EF_DATE_STRIP_X = 372.0
EF_DATE_STRIP_TOP = 13.0


def _ef_centred(page, centre_x, top, text, fontsize=EF_FONTSIZE):
    """Insert `text` with its bbox centred on `centre_x` and its top at `top`."""
    import pymupdf

    text = str(text)
    width = pymupdf.get_text_length(text, fontsize=fontsize)
    page.insert_text(
        (centre_x - width / 2.0, _baseline_for_top(top, fontsize)), text, fontsize=fontsize
    )


def _ef_left(page, x, top, text, fontsize=EF_FONTSIZE):
    """Insert `text` with its left edge at `x` and its top at `top`."""
    page.insert_text((x, _baseline_for_top(top, fontsize)), str(text), fontsize=fontsize)


def _ef_date_strip(page):
    _ef_left(page, EF_DATE_STRIP_X, EF_DATE_STRIP_TOP, EF_DATE_STRIP, fontsize=EF_FONTSIZE)


# --- Domain F: the set-plays page -----------------------------------------------------

# KPI tiles: payload key -> (label, centre x, label top, value top). Two pairs share one
# label row and one value row, exactly as the corpus prints them.
SET_PLAYS_KPI_LAYOUT = {
    "total_set_plays": ("Total Set Plays", 237.0, 152.0, 113.0),
    "total_free_kicks": ("Total Free Kicks", 121.5, 254.0, 217.0),
    "total_penalties": ("Total Penalties", 352.5, 254.0, 217.0),
    "total_corners": ("Total Corners", 121.5, 356.0, 319.0),
    "total_throw_ins": ("Total Throw Ins", 352.5, 356.0, 319.0),
}
SET_PLAYS_CORNER_LABEL_X = 504.0
SET_PLAYS_CORNER_VALUE_XS = (768.0, 840.0, 912.0)  # left / right / total
SET_PLAYS_CORNER_TYPE_TOPS = {
    "direct_to_area": 140.0,
    "short": 165.0,
    "edge_of_penalty_area": 190.0,
}
SET_PLAYS_CORNER_TYPE_LABELS = {
    "direct_to_area": "Direct to Area",
    "short": "Short",
    "edge_of_penalty_area": "Edge of Penalty Area",
}
SET_PLAYS_CORNER_STYLE_TOPS = {
    "inswing": 262.0,
    "outswing": 287.0,
    "driven": 312.0,
    "lofted": 337.0,
}
SET_PLAYS_CORNER_STYLE_LABELS = {
    "inswing": "Inswing",
    "outswing": "Outswing",
    "driven": "Driven",
    "lofted": "Lofted",
}
SET_PLAYS_FREE_KICK_LABEL_X = 18.0
SET_PLAYS_FREE_KICK_VALUE_X = 426.0
SET_PLAYS_FREE_KICK_TOPS = {
    "direct": 436.0,
    "direct_on_target": 461.0,
    "direct_off_target": 486.0,
    "indirect": 511.0,
}
SET_PLAYS_FREE_KICK_LABELS = {
    "direct": "Direct",
    "direct_on_target": "Direct (on target)",
    "direct_off_target": "Direct (off target)",
    "indirect": "Indirect",
}


def default_set_plays_block(side):
    """One team's printed set-plays values, satisfying every shipped relation exactly.

    The two relations the corpus REFUTES are deliberately made FALSE here too, so a
    fixture can never quietly bless a check Story 1.9 rejected on evidence: the delivery
    STYLE values do not sum to the total corners (corpus-false on 112/208) and `direct`
    does not equal `on target + off target` (corpus-false on 208/208).

    Home and away carry different numbers in every field, so a side swap cannot pass.
    Exported so tests derive expected values from what the factory drew.
    """
    if side == "home":
        by_type = {"direct_to_area": (2, 1), "short": (1, 0), "edge_of_penalty_area": (0, 1)}
        style = {"inswing": 2, "outswing": 1, "driven": 0, "lofted": 1}
        direct, indirect, on_target, off_target = 7, 3, 2, 1
        penalties, throw_ins = 1, 18
    else:
        by_type = {"direct_to_area": (0, 3), "short": (1, 1), "edge_of_penalty_area": (1, 0)}
        style = {"inswing": 1, "outswing": 2, "driven": 1, "lofted": 1}
        direct, indirect, on_target, off_target = 5, 4, 1, 3
        penalties, throw_ins = 0, 12
    corners = {
        key: {"left": left, "right": right, "total": left + right}
        for key, (left, right) in by_type.items()
    }
    total_corners = sum(row["total"] for row in corners.values())
    total_free_kicks = direct + indirect
    return {
        "total_set_plays": total_free_kicks + penalties + total_corners + throw_ins,
        "total_free_kicks": total_free_kicks,
        "total_penalties": penalties,
        "total_corners": total_corners,
        "total_throw_ins": throw_ins,
        "free_kicks": {
            "direct": direct,
            "direct_on_target": on_target,
            "direct_off_target": off_target,
            "indirect": indirect,
        },
        "corners_by_delivery_type": corners,
        "corners_by_delivery_style": style,
    }


def draw_set_plays_page(page, block, *, date_strip=True, omit_labels=(), decorate=None):
    """Draw a parseable Set Plays body onto `page`.

    `omit_labels` drops printed labels by payload key (a missing-label failure path);
    `date_strip=False` removes the two date tokens, which breaks the 24-word census;
    `decorate(page)` draws extra content for collision tests. Cell values may be strings,
    so a caller can print a non-numeric or extra token.
    """
    if date_strip:
        _ef_date_strip(page)

    for key, (label, centre_x, label_top, value_top) in SET_PLAYS_KPI_LAYOUT.items():
        if key not in omit_labels:
            _ef_centred(page, centre_x, label_top, label, fontsize=EF_LABEL_FONTSIZE)
        _ef_centred(page, centre_x, value_top, block[key], fontsize=EF_FONTSIZE)

    # The corners delivery-type header shares its visual row with the Total-Set-Plays
    # value, exactly as the corpus prints it — the collision the KPI x bound closes.
    _ef_left(page, SET_PLAYS_CORNER_LABEL_X, 113.0, "Delivery Type", fontsize=EF_LABEL_FONTSIZE)
    for centre_x, header in zip(
        SET_PLAYS_CORNER_VALUE_XS, ("From Left Side", "From Right Side", "Total")
    ):
        _ef_centred(page, centre_x, 113.0, header, fontsize=EF_LABEL_FONTSIZE)
    _ef_left(page, SET_PLAYS_CORNER_LABEL_X, 241.0, "Delivery Style", fontsize=EF_LABEL_FONTSIZE)
    _ef_centred(page, SET_PLAYS_CORNER_VALUE_XS[2], 241.0, "Total", fontsize=EF_LABEL_FONTSIZE)
    _ef_left(page, SET_PLAYS_FREE_KICK_LABEL_X, 415.0, "Type", fontsize=EF_LABEL_FONTSIZE)
    _ef_centred(page, SET_PLAYS_FREE_KICK_VALUE_X, 415.0, "Total", fontsize=EF_LABEL_FONTSIZE)

    for key, top in SET_PLAYS_CORNER_TYPE_TOPS.items():
        if key not in omit_labels:
            _ef_left(
                page, SET_PLAYS_CORNER_LABEL_X, top, SET_PLAYS_CORNER_TYPE_LABELS[key],
                fontsize=EF_FONTSIZE,
            )
        row = block["corners_by_delivery_type"][key]
        for centre_x, column in zip(SET_PLAYS_CORNER_VALUE_XS, ("left", "right", "total")):
            if column in row:
                _ef_centred(page, centre_x, top, row[column])

    for key, top in SET_PLAYS_CORNER_STYLE_TOPS.items():
        if key not in omit_labels:
            _ef_left(
                page, SET_PLAYS_CORNER_LABEL_X, top, SET_PLAYS_CORNER_STYLE_LABELS[key],
                fontsize=EF_FONTSIZE,
            )
        _ef_centred(page, SET_PLAYS_CORNER_VALUE_XS[2], top, block["corners_by_delivery_style"][key])

    for key, top in SET_PLAYS_FREE_KICK_TOPS.items():
        if key not in omit_labels:
            _ef_left(
                page, SET_PLAYS_FREE_KICK_LABEL_X, top, SET_PLAYS_FREE_KICK_LABELS[key],
                fontsize=EF_FONTSIZE,
            )
        _ef_centred(page, SET_PLAYS_FREE_KICK_VALUE_X, top, block["free_kicks"][key])

    if decorate is not None:
        decorate(page)


# --- Domain E: goal prevention --------------------------------------------------------

GOAL_PREVENTION_KPI_LAYOUT = {
    "attempts_faced_printed": ("Total Attempts on Goal Faced", 117.8, 490.0, 447.0),
    "save_percentage": ("Save %", 330.8, 490.0, 447.0),
}
# The header row's band text is a closed constant the parser asserts by EQUALITY, so the
# fixture prints it as the corpus does — one span, right of the x bound.
GOAL_PREVENTION_HEADER_X = 468.0
GOAL_PREVENTION_HEADER_TOP = 481.0
GOAL_PREVENTION_HEADER = (
    "Total Attempts on Goal Total Goal Save & Deflect & Save & Save No Save"
)
GOAL_PREVENTION_HEADER_LINE_2 = "Faced Interventions Retain Retain Deflect Attempt Attempt"
GOAL_PREVENTION_VALUE_TOP = 508.0
GOAL_PREVENTION_VALUE_XS = (510.0, 606.0, 677.0, 736.0, 796.0, 852.0, 913.0)
GOAL_PREVENTION_COLUMN_ORDER = (
    "attempts_faced",
    "total_interventions",
    "save_and_retain",
    "deflect_and_retain",
    "save_and_deflect",
    "save_attempt",
    "no_save_attempt",
)
# The corpus trap, reproduced by default: PMSR-M38-ESP-V-KSA home prints a stray
# pitch-marker ordinal at x=275 on the TABLE'S OWN visual row, so a naive "row of seven
# digits" finds eight spans and zero tables. Only the `x >= 460` bound survives it.
GOAL_PREVENTION_STRAY_ORDINAL = (275.0, "1")
# The two donut centres, in the text layer and demonstrably untrustworthy (PMSR-M01 prints
# 4 against a table of 3). Drawn deliberately WRONG so a parser that ever read them fails.
GOAL_PREVENTION_DONUT_CENTRES = ((574.0, 358.0, "9"), (824.0, 365.0, "8"))


def draw_goal_prevention_page(page, block, *, header=True, stray_ordinal=True, decorate=None):
    """Draw a parseable Goal Prevention body onto `page`."""
    _ef_date_strip(page)
    for key, (label, centre_x, label_top, value_top) in GOAL_PREVENTION_KPI_LAYOUT.items():
        _ef_centred(page, centre_x, label_top, label, fontsize=EF_LABEL_FONTSIZE)
        value = block[key] if key in block else block["attempts_faced"]
        _ef_centred(page, centre_x, value_top, value)
    for centre_x, top, text in GOAL_PREVENTION_DONUT_CENTRES:
        _ef_centred(page, centre_x, top, text, fontsize=12)
    if header:
        _ef_left(
            page, GOAL_PREVENTION_HEADER_X, GOAL_PREVENTION_HEADER_TOP,
            GOAL_PREVENTION_HEADER, fontsize=EF_LABEL_FONTSIZE,
        )
        _ef_left(
            page, 499.0, 490.0, GOAL_PREVENTION_HEADER_LINE_2, fontsize=EF_LABEL_FONTSIZE
        )
    if stray_ordinal:
        _ef_centred(
            page, GOAL_PREVENTION_STRAY_ORDINAL[0], GOAL_PREVENTION_VALUE_TOP,
            GOAL_PREVENTION_STRAY_ORDINAL[1],
        )
    values = dict(block["by_intervention_type"])
    values["attempts_faced"] = block["attempts_faced"]
    values["total_interventions"] = block["total_interventions"]
    for centre_x, column in zip(GOAL_PREVENTION_VALUE_XS, GOAL_PREVENTION_COLUMN_ORDER):
        if column in values:
            _ef_centred(page, centre_x, GOAL_PREVENTION_VALUE_TOP, values[column])
    if decorate is not None:
        decorate(page)


# --- Domain E: aerial control ---------------------------------------------------------

AERIAL_TOTAL_LAYOUT = ("Total Interventions", 249.0, 163.0, 123.0)
AERIAL_TRIPLE_CENTRES = (124.5, 249.0, 373.5)  # Complete / <type> / Incomplete
AERIAL_TRIPLE_TOPS = {
    "punches": (272.0, 233.0),  # (label top, value top)
    "claims": (382.0, 342.0),
    "tipped_palmed": (490.0, 452.0),
}
AERIAL_TRIPLE_LABELS = {
    "punches": "Punches",
    "claims": "Claims",
    "tipped_palmed": "Tipped/Palmed",
}
# The delivery-types header shares its visual row with the Tipped/Palmed labels, exactly as
# the corpus prints it — the collision the two x bands separate.
AERIAL_HEADER_X = 517.0
AERIAL_HEADER_TOP = 490.0
AERIAL_HEADER = "Total In Swing Out Swing Driven Lofted Cutback Push"
AERIAL_VALUE_TOP = 511.0
AERIAL_VALUE_XS = (528.0, 589.0, 650.0, 710.0, 771.0, 832.0, 893.0)
AERIAL_COLUMN_ORDER = (
    "total",
    "inswing",
    "outswing",
    "driven",
    "lofted",
    "cutback",
    "push_cross",
)


def draw_aerial_control_page(page, block, *, header=True, decorate=None):
    """Draw a parseable Aerial Control body onto `page`."""
    _ef_date_strip(page)
    label, centre_x, label_top, value_top = AERIAL_TOTAL_LAYOUT
    _ef_centred(page, centre_x, label_top, label, fontsize=EF_LABEL_FONTSIZE)
    _ef_centred(page, centre_x, value_top, block["total_interventions"])

    for key, (label_top, value_top) in AERIAL_TRIPLE_TOPS.items():
        labels = ("Complete", AERIAL_TRIPLE_LABELS[key], "Incomplete")
        for centre, text in zip(AERIAL_TRIPLE_CENTRES, labels):
            _ef_centred(page, centre, label_top, text, fontsize=EF_LABEL_FONTSIZE)
        triple = block[key]
        for centre, column in zip(AERIAL_TRIPLE_CENTRES, ("complete", "total", "incomplete")):
            if column in triple:
                _ef_centred(page, centre, value_top, triple[column])

    _ef_left(page, 631.0, 459.0, "Delivery Types Faced", fontsize=EF_LABEL_FONTSIZE)
    if header:
        _ef_left(page, AERIAL_HEADER_X, AERIAL_HEADER_TOP, AERIAL_HEADER, fontsize=EF_LABEL_FONTSIZE)
    delivery = block["delivery_types_faced"]
    for centre_x, column in zip(AERIAL_VALUE_XS, AERIAL_COLUMN_ORDER):
        if column in delivery:
            _ef_centred(page, centre_x, AERIAL_VALUE_TOP, delivery[column])
    if decorate is not None:
        decorate(page)


# --- Domain E: goalkeeping distribution (the marker MAP page) --------------------------

# The four panel rects, at the corpus' own coordinates: 203.996 x 291.75 = 59,516.0 pt^2
# each, all EQUAL-area, which is why `detect_pitch_frame`'s max() is unusable and the
# plural accessor is mandatory. Every frame ends at y1 = 406.5 on all 832 corpus panels.
GK_DISTRIBUTION_PANELS = (
    ("feet", (18.002, 114.75, 221.998, 406.5)),
    ("hands", (258.002, 114.75, 461.998, 406.5)),
    ("throw", (498.002, 114.75, 701.998, 406.5)),
    ("total", (738.002, 114.75, 941.998, 406.5)),
)
GK_DISTRIBUTION_PANEL_TITLES = {
    "feet": "Kick from Feet",
    "hands": "Kick from Hands",
    "throw": "Throw Distribution",
    "total": "Total Distributions",
}
GK_DISTRIBUTION_TITLE_TOP = 96.0
GK_DISTRIBUTION_MARKER_RADIUS = 2.9145  # 5.829 pt, the real dots' size
GK_DISTRIBUTION_RGB = {"complete": (0.18, 0.30, 1.00), "incomplete": (1.00, 0.00, 0.00)}
# The legend: 9.0 pt swatches 10.5 pt BELOW every frame. Excluded twice over — by the size
# window and by the pitch margin — which is exactly what the fixture must prove.
GK_DISTRIBUTION_LEGEND_RADIUS = 4.5
GK_DISTRIBUTION_LEGEND_CY = 417.0
# White penalty/centre spots INSIDE each panel: filled all-Bezier circles that only
# `marker_min_pt` excludes. Admitting either aborts the report on a white fill.
GK_DISTRIBUTION_SPOT_RADII = (0.6855, 1.3715, 0.6855)
GK_DISTRIBUTION_SPOT_FYS = (0.11, 0.5, 0.89)
# The three donut centres print below the panels, one inside each of the first three
# panels' x band; the Total Distributions panel prints NO centre of its own.
GK_DISTRIBUTION_DONUT_TOP = 474.0
GK_DISTRIBUTION_DONUT_XS = {"feet": 168.0, "hands": 410.0, "throw": 647.0}
GK_DISTRIBUTION_LINE_BREAKS_LAYOUT = ("Goalkeeper Line Breaks", 840.0, 507.0, 470.0)
# Technique labels the donuts carry — non-numeric furniture that shares the donut row.
# WORDS ONLY, deliberately: the numbers a corpus donut row carries are the three donut
# CENTRES themselves, which the fixture already draws at `GK_DISTRIBUTION_DONUT_XS`, and
# the four-number census below the panel band is what pins them. Drawing further numbers
# beside these labels would make the fixture contradict the census it exists to prove.
GK_DISTRIBUTION_TECHNIQUE_LABELS = ((274.5, "From Hands"), (514.5, "Under Arm"))

# (fx, fy, outcome) per source panel. The Total Distributions panel is drawn as the exact
# union of the other three at the SAME relative positions, which is what the corpus does
# and what makes `goalkeeping-distribution-sum` true by construction.
DEFAULT_GK_DISTRIBUTION_MARKERS = {
    "home": {
        "feet": [
            (0.30, 0.72, "complete"), (0.45, 0.80, "complete"), (0.60, 0.75, "complete"),
            (0.52, 0.88, "complete"), (0.38, 0.66, "incomplete"),
        ],
        "hands": [(0.50, 0.70, "complete")],
        "throw": [(0.40, 0.78, "complete"), (0.62, 0.83, "complete"), (0.55, 0.69, "incomplete")],
    },
    "away": {
        "feet": [
            (0.35, 0.74, "complete"), (0.55, 0.82, "complete"), (0.48, 0.90, "complete"),
            (0.28, 0.68, "incomplete"), (0.66, 0.71, "incomplete"),
        ],
        "hands": [(0.44, 0.76, "incomplete")],
        "throw": [(0.58, 0.86, "complete")],
    },
}
DEFAULT_GK_LINE_BREAKS = {"home": 6, "away": 4}


def default_gk_distribution_block(side):
    """The distribution page's printed values, DERIVED from the markers the factory draws.

    The three printed donut centres equal their panel's marker count exactly, so
    `goalkeeping-distribution-printed` holds by construction; the Total Distributions panel
    prints no centre, as the corpus does not.
    """
    markers = DEFAULT_GK_DISTRIBUTION_MARKERS[side]
    return {
        "markers": markers,
        "printed": {key: len(markers[key]) for key in ("feet", "hands", "throw")},
        "line_breaks": DEFAULT_GK_LINE_BREAKS[side],
    }


def draw_gk_distribution_page(
    page,
    block,
    *,
    panels=GK_DISTRIBUTION_PANELS,
    titles=None,
    legend=True,
    spots=True,
    donut_xs=None,
    off_palette=False,
    decorate=None,
):
    """Draw a parseable Goalkeeping Distribution map page onto `page`.

    `panels` overrides the panel set (a panel-count failure path — pass `()` to draw none
    at all, which raises the shared chain's own `PitchFrameError`); `titles` overrides the
    printed panel titles; `off_palette=True` draws one marker in a fill the palette does
    not know, which must raise `UnknownRgbError`.
    """
    import pymupdf

    _ef_date_strip(page)
    titles = GK_DISTRIBUTION_PANEL_TITLES if titles is None else titles
    rects = {}
    for key, coords in panels:
        rect = pymupdf.Rect(*coords)
        rects[key] = rect
        # STROKED, which is what `detect_pitch_frames` requires: a fill-only band must
        # never outcompete the frame as the normalization basis.
        page.draw_rect(rect, color=(0.81, 0.84, 0.84), width=0.75)
        if key in titles:
            _ef_centred(
                page, (rect.x0 + rect.x1) / 2, GK_DISTRIBUTION_TITLE_TOP, titles[key],
                fontsize=EF_LABEL_FONTSIZE,
            )
        if spots:
            for radius, fy in zip(GK_DISTRIBUTION_SPOT_RADII, GK_DISTRIBUTION_SPOT_FYS):
                page.draw_circle(
                    ((rect.x0 + rect.x1) / 2, rect.y0 + fy * rect.height),
                    radius, color=None, fill=(1.0, 1.0, 1.0),
                )
        if legend:
            for index, rgb in enumerate(GK_DISTRIBUTION_RGB.values()):
                page.draw_circle(
                    (rect.x0 + 30.0 + index * 100.0, GK_DISTRIBUTION_LEGEND_CY),
                    GK_DISTRIBUTION_LEGEND_RADIUS, color=None, fill=rgb,
                )

    def plot(rect, fx, fy, outcome):
        page.draw_circle(
            (rect.x0 + fx * rect.width, rect.y0 + fy * rect.height),
            GK_DISTRIBUTION_MARKER_RADIUS,
            color=(1.0, 1.0, 1.0),
            fill=GK_DISTRIBUTION_RGB.get(outcome, outcome),
            width=0.75,
        )

    for key in ("feet", "hands", "throw"):
        for fx, fy, outcome in block["markers"].get(key, ()):
            if key in rects:
                plot(rects[key], fx, fy, outcome)
            # The Total Distributions panel is the exact union of the other three.
            if "total" in rects:
                plot(rects["total"], fx, fy, outcome)
    if off_palette and "feet" in rects:
        plot(rects["feet"], 0.5, 0.5, (0.0, 0.6, 0.2))

    for key, centre_x in (GK_DISTRIBUTION_DONUT_XS if donut_xs is None else donut_xs).items():
        if key in block["printed"]:
            _ef_centred(page, centre_x, GK_DISTRIBUTION_DONUT_TOP, block["printed"][key], fontsize=12)
    for x, text in GK_DISTRIBUTION_TECHNIQUE_LABELS:
        _ef_left(page, x, GK_DISTRIBUTION_DONUT_TOP, text, fontsize=EF_LABEL_FONTSIZE)
    label, centre_x, label_top, value_top = GK_DISTRIBUTION_LINE_BREAKS_LAYOUT
    _ef_centred(page, centre_x, label_top, label, fontsize=EF_LABEL_FONTSIZE)
    _ef_centred(page, centre_x, value_top, block["line_breaks"], fontsize=12)
    if decorate is not None:
        decorate(page)


# --- Domain E: the goalkeeping involvement page (ONE page, BOTH teams) -----------------

GK_INVOLVEMENT_TITLE_SUFFIX = "GK Involvement Timeline"
GK_INVOLVEMENT_GRID_STROKE = (0.878, 0.878, 0.878)
GK_INVOLVEMENT_UNIT = 15.4403  # points per involvement, measured on the reference report
# The printed axis LABELS sit 1.81 pt above their gridlines on every corpus chart — the
# systematic offset that makes a label-anchored value fit wrong by up to 0.16 units, and
# the reason the parser anchors its baseline on the zero GRIDLINE instead. The fixture
# reproduces it deliberately.
GK_INVOLVEMENT_LABEL_OFFSET = 1.81
GK_INVOLVEMENT_AXIS_LABEL_X = 24.755
GK_INVOLVEMENT_PLOT_X0, GK_INVOLVEMENT_PLOT_X1 = 36.844, 754.5
# (chart title top, top gridline y) per printed chart position.
GK_INVOLVEMENT_CHART_TOPS = ((135.0, 173.25), (355.0, 393.75))
GK_INVOLVEMENT_DOT_RADIUS = 1.5  # 3.0 pt on 21,764 of 21,764 corpus dots
GK_INVOLVEMENT_DOT_RGB = (0.18, 0.30, 1.00)
GK_INVOLVEMENT_TOTAL_LABEL = "Total Involvements"
GK_INVOLVEMENT_TOTAL_CENTRE_X = 861.0
GK_INVOLVEMENT_TICK_LABELS = (
    "0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "HT",
    "50", "55", "60", "65", "70", "75", "80", "85", "90", "90+5",
)
DEFAULT_GK_INVOLVEMENT_SLOTS = 100
DEFAULT_GK_INVOLVEMENT_TOP_LABEL = 4
# slot -> value. Every listed value is distinct enough that an off-by-one slot assignment
# cannot pass, and the peak equals the printed top label, as the auto-scale requires.
DEFAULT_GK_INVOLVEMENT_VALUES = {
    "home": {0: 1, 7: 2, 19: 4, 33: 1, 48: 3, 61: 2, 77: 1, 95: 2},
    "away": {2: 2, 14: 1, 26: 3, 40: 4, 52: 1, 66: 2, 81: 3, 99: 1},
}
# home's printed total equals its series sum exactly (delta 0, the 59/208 case); away's is
# one higher (delta 1, the corpus mode) — both are PASSING states of the shipped bound, and
# printing only the exact case would leave the corpus's normal behaviour untested.
DEFAULT_GK_INVOLVEMENT_DELTA = {"home": 0, "away": 1}


def default_gk_involvement_block(side, slots=DEFAULT_GK_INVOLVEMENT_SLOTS):
    """One chart's series and printed total, derived so the shipped bound holds."""
    values = DEFAULT_GK_INVOLVEMENT_VALUES[side]
    series = [values.get(slot, 0) for slot in range(slots)]
    return {
        "series": series,
        "total_involvements": sum(series) + DEFAULT_GK_INVOLVEMENT_DELTA[side],
        "top_label": DEFAULT_GK_INVOLVEMENT_TOP_LABEL,
    }


def draw_gk_involvement_page(
    page, home, away, blocks, *, axis_rule=True, reverse=False, dot_offsets=None, decorate=None
):
    """Draw the one page carrying BOTH teams' involvement timelines.

    The home chart prints on top by default, as the corpus does. `reverse=True` prints the
    AWAY chart on top instead, with each chart still carrying its own team's title and
    series — the only way to prove the parser reads the split from the printed
    `'{team} GK Involvement Timeline'` title rather than from drawing order (AD-8). A test
    that merely swapped the cover names would redraw the whole page and prove nothing.

    `dot_offsets` maps `(side, slot) -> dy` to displace one dot off the value grid (a
    non-integral-slot failure path); `axis_rule=False` drops the extra rule the gridline
    run must exclude.
    """
    _ef_date_strip(page)
    _ef_left(page, 12.0, 32.0, "Goalkeeping Involvement", fontsize=12)
    printed = [("home", home), ("away", away)]
    if reverse:
        printed.reverse()
    for (side, team), (title_top, grid_top) in zip(printed, GK_INVOLVEMENT_CHART_TOPS):
        block = blocks[side]
        top_label = block["top_label"]
        series = block["series"]
        zero_line = grid_top + top_label * GK_INVOLVEMENT_UNIT

        _ef_left(page, 60.0, title_top - 54.0, team, fontsize=11)
        _ef_centred(page, 387.0, title_top, f"{team} {GK_INVOLVEMENT_TITLE_SUFFIX}", fontsize=10)

        for step in range(top_label + 1):
            y = grid_top + step * GK_INVOLVEMENT_UNIT
            page.draw_line(
                (GK_INVOLVEMENT_PLOT_X0, y), (GK_INVOLVEMENT_PLOT_X1, y),
                color=GK_INVOLVEMENT_GRID_STROKE, width=0.75,
            )
            # The printed label, offset above its gridline exactly as the corpus prints it.
            _ef_left(
                page, GK_INVOLVEMENT_AXIS_LABEL_X,
                y - GK_INVOLVEMENT_LABEL_OFFSET - 8 * _HELV_ASCENDER / 2.0 - 0.6,
                top_label - step, fontsize=8,
            )
        if axis_rule:
            # The extra rule 0.75 pt below the zero line — present so the fixture
            # exercises the parser's evenly-spaced run rather than letting a naive
            # min/max accidentally agree with it (the momentum-chart lesson).
            page.draw_line(
                (GK_INVOLVEMENT_PLOT_X0, zero_line + 0.75),
                (GK_INVOLVEMENT_PLOT_X1, zero_line + 0.75),
                color=GK_INVOLVEMENT_GRID_STROKE, width=0.75,
            )

        pitch = (GK_INVOLVEMENT_PLOT_X1 - GK_INVOLVEMENT_PLOT_X0) / (len(series) - 1)
        for slot, value in enumerate(series):
            dy = (dot_offsets or {}).get((side, slot), 0.0)
            page.draw_circle(
                (GK_INVOLVEMENT_PLOT_X0 + slot * pitch, zero_line - value * GK_INVOLVEMENT_UNIT + dy),
                GK_INVOLVEMENT_DOT_RADIUS, color=None, fill=GK_INVOLVEMENT_DOT_RGB,
            )

        # The printed total: value ABOVE its label, centred on it, like every other KPI.
        _ef_centred(
            page, GK_INVOLVEMENT_TOTAL_CENTRE_X, zero_line - 46.7,
            block["total_involvements"], fontsize=12,
        )
        _ef_centred(
            page, GK_INVOLVEMENT_TOTAL_CENTRE_X, zero_line - 7.2,
            GK_INVOLVEMENT_TOTAL_LABEL, fontsize=EF_LABEL_FONTSIZE,
        )

        # The x-axis ticks. The first label is centred on the plot box's left edge, which
        # puts its right edge past the axis-label column bound — the real page's own
        # geometry, and what keeps a tick out of the y-axis label read.
        tick_pitch = (GK_INVOLVEMENT_PLOT_X1 - GK_INVOLVEMENT_PLOT_X0) / (
            len(GK_INVOLVEMENT_TICK_LABELS) - 1
        )
        for index, text in enumerate(GK_INVOLVEMENT_TICK_LABELS):
            _ef_centred(
                page, GK_INVOLVEMENT_PLOT_X0 + index * tick_pitch, zero_line + 10.6, text,
                fontsize=EF_FONTSIZE,
            )
    if decorate is not None:
        decorate(page)


def default_goalkeeping_blocks(side):
    """One team's full goalkeeping page values, satisfying every shipped relation.

    Derived, not invented, and the relations Story 1.9 REJECTED on corpus evidence are
    deliberately made FALSE here so no fixture can bless them: the five intervention types
    do not sum to `total_interventions` (corpus-false on 207/208), and `total_interventions`
    does not equal `attempts_faced - no_save_attempt` (corpus-false on 183/208).
    """
    if side == "home":
        types = {
            "save_and_retain": 2, "deflect_and_retain": 1, "save_and_deflect": 1,
            "save_attempt": 0, "no_save_attempt": 1,
        }
        total_interventions, save_percentage = 3, 80
        aerial_triples = {
            "punches": {"complete": 1, "total": 2, "incomplete": 1},
            "claims": {"complete": 0, "total": 1, "incomplete": 1},
            "tipped_palmed": {"complete": 1, "total": 1, "incomplete": 0},
        }
        delivery = {"inswing": 2, "outswing": 3, "driven": 1, "lofted": 2, "cutback": 1,
                    "push_cross": 0}
        aerial_total_interventions = 3
    else:
        types = {
            "save_and_retain": 1, "deflect_and_retain": 0, "save_and_deflect": 1,
            "save_attempt": 0, "no_save_attempt": 1,
        }
        # A decimal percentage, so the float branch is exercised as well as the integer one.
        total_interventions, save_percentage = 1, 66.7
        aerial_triples = {
            "punches": {"complete": 0, "total": 1, "incomplete": 1},
            "claims": {"complete": 1, "total": 2, "incomplete": 1},
            "tipped_palmed": {"complete": 0, "total": 0, "incomplete": 0},
        }
        delivery = {"inswing": 1, "outswing": 2, "driven": 0, "lofted": 1, "cutback": 1,
                    "push_cross": 1}
        aerial_total_interventions = 2
    attempts_faced = sum(types.values())
    aerial = dict(aerial_triples)
    aerial["total_interventions"] = aerial_total_interventions
    aerial["delivery_types_faced"] = dict(delivery, total=sum(delivery.values()))
    return {
        "distribution": default_gk_distribution_block(side),
        "goal_prevention": {
            "attempts_faced": attempts_faced,
            "attempts_faced_printed": attempts_faced,
            "total_interventions": total_interventions,
            "save_percentage": save_percentage,
            "by_intervention_type": types,
        },
        "aerial_control": aerial,
        "involvement": default_gk_involvement_block(side),
    }


# --- Story 1.14: the pass-network page (a MATRIX, no pitch, no markers) -------------
#
# Geometry mirrors the real 960x540 template verbatim (PMSR-M01 page 11): the header band
# at y 90.75-117.75, the `#` cell at x 12-30, the `Passes From to` cell at 30-172.5, then
# the player columns from 172.5 rightward, and the Top-5 panel from 760.5.
PASS_NETWORK_HEADER_FILL = (0.1804, 0.302, 1.0)
PASS_NETWORK_HEADER_Y0, PASS_NETWORK_HEADER_Y1 = 90.75, 117.75
PASS_NETWORK_SHIRT_X0, PASS_NETWORK_SHIRT_X1 = 12.0, 30.0
PASS_NETWORK_FIRST_COLUMN_X0 = 172.5
PASS_NETWORK_PANEL_X0, PASS_NETWORK_PANEL_X1 = 760.5, 948.0
PASS_NETWORK_ROW_Y0, PASS_NETWORK_ROW_PITCH = 125.34, 24.75
PASS_NETWORK_FONTSIZE = 7.0
# Every y quoted above and below is a span **y0**, which is what the corpus dump reports
# and what the parser's header band is expressed in — but `insert_text` takes a BASELINE.
# Converting here rather than eyeballing offsets is what keeps the fixture's header band
# and first body row on the same side of y=117.75 as the real page's are; a fixture drawn
# a few points high puts the first row's shirt number INSIDE the header band, where it
# reads as part of the `#` cell's text.
PASS_NETWORK_ASCENDER = 1.075  # pymupdf's Helvetica ascender, the default insert_text font


def _pn_baseline(y0, fontsize=PASS_NETWORK_FONTSIZE):
    return y0 + PASS_NETWORK_ASCENDER * fontsize
# DELIBERATELY NON-UNIFORM, cycling: widths vary WITHIN the page on 156 of 208 corpus
# innings (27.75-58.5 pt), and a uniform fixture would let a parser that hardcodes 36 pt
# — wrong on 156 innings — pass every synthetic test in the suite.
PASS_NETWORK_COLUMN_WIDTHS = (36.0, 30.0, 42.0, 27.75, 33.0)
# The five spiked cells that give the Top-5 panel five DISTINCT descending values well
# above every other cell (base values are 0-2), so the printed reconciliation is a real
# ordering check rather than five ties.
PASS_NETWORK_SPIKES = (12, 11, 10, 9, 8)


def _pass_network_base(i, j):
    """The background cell value: 0-2, asymmetric, and varied row to row.

    Uniformity is the severe fixture risk here (the 1.13 review's theme): if every row
    printed the same values, a parser that transposed its column assignment would be
    undetectable by any test. This pattern makes `cell[i][j] != cell[j][i]` on 49 of the
    66 default pairs.
    """
    return (i * 3 + j * 5 + (i * j) % 7) % 3


def _pass_network_spike_cells(size):
    """The five spiked (row, column) pairs for a matrix of `size` players."""
    return {(k, (2 * k + 1) % size): value for k, value in enumerate(PASS_NETWORK_SPIKES)}


def default_pass_network_block(rows, matrix_total_cap):
    """One team's pass matrix, DERIVED from this report's own Domain G rows.

    `rows` are the Domain G rows the factory already built for this side, so the matrix
    names exactly the lineup players with minutes, with matching shirts, in the same
    order — which is what keeps the join, its completeness half and the two cross-domain
    bounds green when a caller changes the lineup.

    The three relations Story 1.14 REJECTED on corpus evidence are made FALSE here by
    construction, so no fixture can bless them (the 1.9/1.13 discipline):

    - every row sum is STRICTLY LESS than that player's Domain G `passes_completed`
      (equality is corpus-false on 1,290 of 3,289 rows, so the check ships as a bound);
    - `matrix_total` is STRICTLY LESS than Key Statistics `passes_completed` (corpus-true
      on 208/208);
    - column sums fall on BOTH sides of `offers_received`, so no bound in either
      direction could be blessed (that relation is corpus-false both ways and is
      deliberately not shipped at all).

    The first two caps are asserted rather than assumed: a caller who shrinks the lineup
    or lowers the printed pass counts gets a loud factory error naming the offender,
    never a report whose pass-network checks fail for a reason nothing on the page points
    at. The third is not asserted here — see the comment at its would-be site below.
    """
    size = len(rows)
    if size < 6:
        raise ValueError(
            f"default_pass_network_block: {size} players with minutes is too few to draw "
            "a pass matrix with five distinct Top-5 cells; pass explicit "
            "pass_network_block or give the side more players"
        )
    spikes = _pass_network_spike_cells(size)
    matrix = [
        [
            None
            if i == j
            else spikes.get((i, j), _pass_network_base(i, j))
            for j in range(size)
        ]
        for i in range(size)
    ]
    for index, row in enumerate(matrix):
        made = sum(value for value in row if value is not None)
        cap = rows[index]["distributions"][1]
        if not isinstance(cap, int) or made >= cap:
            raise ValueError(
                f"default_pass_network_block: row {index} sums to {made}, which is not "
                f"strictly less than its Domain G passes_completed {cap!r}"
            )
    # The column-sum vs `offers_received` relation is deliberately NOT asserted here.
    # It is corpus-false in BOTH directions (3,145 greater, 121 equal, 23 less), so no
    # check ships against it and a coincidental equality on one column breaks nothing —
    # a factory raise would only break reports that have no interest in pass networks.
    # The property that matters (both directions present, so no bound in either direction
    # could be blessed) is asserted against the default report in
    # `test_extract_report_pass_network.py`, where the lineup is known.
    total = sum(value for row in matrix for value in row if value is not None)
    if not isinstance(matrix_total_cap, int) or total >= matrix_total_cap:
        raise ValueError(
            f"default_pass_network_block: matrix_total {total} is not strictly less than "
            f"Key Statistics passes_completed {matrix_total_cap!r}"
        )
    largest = sorted(
        (value for row in matrix for value in row if value is not None), reverse=True
    )[:5]
    return {
        "players": [{"shirt": row["shirt"], "name": row["name"]} for row in rows],
        "matrix": matrix,
        # Printed to one decimal, exactly as the corpus does — which is where the
        # parser's 0.05 tolerance (the half-ulp of 1-dp rounding) comes from.
        "top5": [round(100.0 * cell / total, 1) for cell in largest],
    }


def _pn_centred(page, centre, y0, text, fontsize=PASS_NETWORK_FONTSIZE):
    """Print `text` horizontally centred on `centre`, with its span top at `y0`."""
    import pymupdf

    text = str(text)
    width = pymupdf.get_text_length(text, fontsize=fontsize)
    page.insert_text((centre - width / 2, _pn_baseline(y0, fontsize)), text, fontsize=fontsize)


def _pn_text(page, x, y0, text, fontsize=PASS_NETWORK_FONTSIZE):
    """Print `text` left-aligned at `x`, with its span top at `y0`."""
    page.insert_text((x, _pn_baseline(y0, fontsize)), str(text), fontsize=fontsize)


def _pn_right(page, x1, y0, text, fontsize=PASS_NETWORK_FONTSIZE):
    """Print `text` right-aligned to `x1`, with its span top at `y0`."""
    import pymupdf

    text = str(text)
    width = pymupdf.get_text_length(text, fontsize=fontsize)
    _pn_text(page, x1 - width, y0, text, fontsize)


def pass_network_columns(size, widths=PASS_NETWORK_COLUMN_WIDTHS):
    """The (x0, x1) extent of each player column, non-uniform and contiguous."""
    columns = []
    x0 = PASS_NETWORK_FIRST_COLUMN_X0
    for index in range(size):
        x1 = x0 + widths[index % len(widths)]
        columns.append((x0, x1))
        x0 = x1
    return columns


def draw_pass_network_page(
    page,
    block,
    *,
    header=True,
    lead_texts=("#", "Passes From to"),
    column_widths=PASS_NETWORK_COLUMN_WIDTHS,
    header_names=None,
    omit_cells=(),
    cell_text=None,
    cell_fonts=None,
    panel=True,
    decorate=None,
):
    """Draw a parseable Passing Networks page: header band, N x N matrix, Top-5 panel.

    **Every cell is printed with its OWN `insert_text` at its own x, inside its column's
    own header rect.** This is load-bearing, not style: `pymupdf` merges adjacent
    same-font inserts into a single span (the 1.10 landmine — `_g_row_head` printed each
    name with one call, so every synthetic test saw one name span). If a row were emitted
    as one string, the parser would see one span, x-containment would become meaningless,
    and every test here would pass over a page that cannot exercise the column-geometry
    rule they exist to prove. `test_a_drawn_row_yields_one_span_per_printed_cell` pins it.

    The diagonal is NOT printed — that single absence per row is what makes the text
    stream ragged and is the whole reason assignment must be geometric. Zeros ARE printed.

    `header_names` overrides the printed column-header names (a hyphen-wrap case, a
    renamed column); `omit_cells` drops `(row, column)` cells; `cell_text` overrides a
    cell's printed text by `(row, column)`; `decorate(page)` draws extra content last,
    following the family convention (a pitch rect there is Task 2.12's tripwire).
    """
    import pymupdf

    matrix = block["matrix"]
    size = len(matrix)
    columns = pass_network_columns(size, column_widths)
    names = [player["name"] for player in block["players"]]
    printed_names = list(header_names) if header_names is not None else list(names)

    if header:
        cells = [(PASS_NETWORK_SHIRT_X0, PASS_NETWORK_SHIRT_X1),
                 (PASS_NETWORK_SHIRT_X1, PASS_NETWORK_FIRST_COLUMN_X0)] + columns
        for x0, x1 in cells:
            page.draw_rect(
                pymupdf.Rect(x0, PASS_NETWORK_HEADER_Y0, x1, PASS_NETWORK_HEADER_Y1),
                color=None,
                fill=PASS_NETWORK_HEADER_FILL,
            )
            # The 0.75 pt white separators the real page draws over the same band at the
            # same height: they qualify on y and on height and are excluded by FILL
            # alone, so the fixture proves the fill predicate is doing work.
            page.draw_rect(
                pymupdf.Rect(x0, PASS_NETWORK_HEADER_Y0, x0 + 0.75, PASS_NETWORK_HEADER_Y1 + 0.75),
                color=None,
                fill=(1.0, 1.0, 1.0),
            )
        # The Top-5 panel's own header rect: same y0, height 13.5, which is what the
        # `height > 20` predicate exists to exclude.
        page.draw_rect(
            pymupdf.Rect(PASS_NETWORK_PANEL_X0, PASS_NETWORK_HEADER_Y0,
                         PASS_NETWORK_PANEL_X1, PASS_NETWORK_HEADER_Y0 + 13.5),
            color=None,
            fill=PASS_NETWORK_HEADER_FILL,
        )
        shirt_text, row_text = lead_texts
        if shirt_text is not None:
            _pn_centred(page, (PASS_NETWORK_SHIRT_X0 + PASS_NETWORK_SHIRT_X1) / 2, 100.31,
                        shirt_text)
        if row_text is not None:
            _pn_text(page, 36.8, 100.31, row_text)
        # Column headers wrap onto two lines exactly as the corpus prints them (given
        # names above, surnames below), so `_header_texts` must join per LINE and then
        # join the lines — sorting a two-line cell's spans by x alone would interleave.
        for (x0, x1), name in zip(columns, printed_names):
            centre = (x0 + x1) / 2
            head, _, tail = name.rpartition(" ")
            if head:
                _pn_centred(page, centre, 94.31, head)
                _pn_centred(page, centre, 104.81, tail)
            else:
                _pn_centred(page, centre, 100.31, tail)

    for index, player in enumerate(block["players"]):
        y = PASS_NETWORK_ROW_Y0 + index * PASS_NETWORK_ROW_PITCH
        _pn_right(page, PASS_NETWORK_SHIRT_X1 - 2.4, y, player["shirt"])
        _pn_text(page, 33.0, y, player["name"])
        for column, (x0, x1) in enumerate(columns):
            if matrix[index][column] is None or (index, column) in omit_cells:
                continue
            text = (cell_text or {}).get((index, column), str(matrix[index][column]))
            if text is None:
                continue
            # `cell_fonts` exists for exactly one case: a FULLWIDTH digit needs a font
            # that can encode it (the 1.13 note). The base-14 fonts substitute U+FFFD,
            # which would make the `re.ASCII` guard's test pass for the wrong reason.
            font = (cell_fonts or {}).get((index, column))
            if font is None:
                _pn_centred(page, (x0 + x1) / 2, y, text)
            else:
                page.insert_text(
                    ((x0 + x1) / 2 - 3.5, _pn_baseline(y)),
                    str(text),
                    fontsize=PASS_NETWORK_FONTSIZE,
                    fontname=font,
                )

    if panel:
        # The panel's own stacked header, INSIDE the header band's y range but outside
        # every header cell's x range — so it must reach neither the column-name read nor
        # the percentage read. It carries a bare `%`, which is exactly the token a lazy
        # percentage regex would pick up as a sixth Top-5 row.
        _pn_text(page, 893.0, 108.56, "% of Total Team")
        _pn_text(page, 763.6, 112.31, "Player")
        _pn_text(page, 824.3, 112.31, "Passed To")
        _pn_text(page, 906.1, 116.06, "Passes")
        for rank, percent in enumerate(block["top5"]):
            y = 138.84 + rank * 30.0
            text = percent if isinstance(percent, str) else f"{percent:g}%"
            # Names share the percentage's visual row exactly as the corpus prints them,
            # so the read must pull the percentage OUT of a mixed row rather than assume
            # the panel prints numbers alone.
            _pn_text(page, 763.6, y, names[rank % size].split(" ")[0])
            _pn_text(page, 823.6, y, names[(rank + 1) % size].split(" ")[0])
            _pn_right(page, 926.7, y, text)
            _pn_text(page, 763.6, y + 6.0, names[rank % size].split(" ")[-1])
            _pn_text(page, 823.6, y + 6.0, names[(rank + 1) % size].split(" ")[-1])

    if decorate is not None:
        decorate(page)


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

    Story 1.12 (additive, default-on): the defensive-actions anchors emit the real
    single-page section — TWO titled stroked pitch panels of all-but-equal area, markers
    at the measured 8.871 pt size and single fill, the strokeless 9.0 pt bullet swatches
    in that same fill, the headline band (value above its stacked label, centred) and the
    per-player `Total Possession Regains` table at the real x-positions and ~7 pt font.
    The `defensive_actions_*` kwargs are documented on the parameters themselves.

    Story 1.13 (additive, default-on): the `offers` and `movement` anchors emit the real
    single-page dashboards — two titled stroked panels with the 11-dot formation
    template and one shape badge each, label-anchored KPI pairs, the Most-Offers block
    and the per-player table on the offers page; one titled pitch panel with rotated
    third + DIRECTION labels, the 15-cell grid, its 33 axis ticks, four raster donuts and
    the Top Ranked Players table on the movement page. Printed values DEFAULT to a
    derivation of this report's own Domain G rows, which is what keeps the two
    cross-domain reconciliations green. The `offers_*` / `movement_*` kwargs are
    documented on the parameters themselves.

    Story 1.10 (additive, default-on): the eight Domain G anchors emit the real
    per-player tables — a right-aligned shirt number, a name, then the family's numeric
    columns (14 / 8 / 15 / 9), centre-aligned for three families and right-aligned for
    physical data. The default rows are DERIVED from this report's own lineup and Key
    Statistics (`default_player_stats_rows`), so the join, the distance reconciliation
    and the goals reconciliation stay green when a caller changes the score, the lineup
    or the stats block. The `player_stats_*` kwargs are documented on the parameters.

    Story 1.9 (additive, default-on): the nine Domain E/F anchors emit the real pages —
    a Set Plays page whose five KPI values print ABOVE their labels (two pairs sharing one
    value row) with three label-anchored tables and the date strip that makes its 24-word
    numeric census reachable; a Goal Prevention page with the closed seven-column header,
    the stray left-of-table ordinal the corpus prints on the value row, and two
    deliberately WRONG donut centres; an Aerial Control page whose delivery-types header
    shares a visual row with the Tipped/Palmed labels; a Goalkeeping Distribution MAP page
    with four EQUAL-area stroked panels, 5.83 pt two-colour markers, the 9.0 pt legend
    10.5 pt below every frame and the white penalty/centre spots; and ONE Goalkeeping
    Involvement page carrying BOTH teams' timelines, whose printed axis labels sit 1.81 pt
    above their gridlines exactly as the corpus prints them. Defaults satisfy every shipped
    relation by construction and make both corpus-refuted relations FALSE. The
    `set_plays_*` / `goalkeeping_*` / `gk_*` / `goal_prevention_*` / `aerial_*` kwargs are
    documented on the parameters themselves.

    Story 1.14 (additive, default-on): the two `pass-network` anchors emit the real page —
    a filled header band whose two leading cells are `#` and `Passes From to`, then N
    NON-UNIFORM player columns with two-line wrapped names, an N x N matrix whose diagonal
    is blank and whose zeros ARE printed, each cell drawn with its own `insert_text`
    inside its own column rect, and the Top-5 panel with five distinct printed
    percentages. The matrix is DERIVED from this report's own Domain G rows
    (`default_pass_network_block`), so the join and both cross-domain bounds stay green —
    and all three corpus-refuted relations are false by construction. The
    `pass_network_*` kwargs are documented on the parameters themselves.

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
        # Story 1.8 (additive, default-on): every report now carries a parseable momentum
        # chart on its own anchored page — extract_report runs the parser on every report.
        # `momentum_values` maps slot -> (home, away) counts (`{}` draws no bars at all,
        # which is the documented-absence branch); `momentum_ticks` maps printed x-axis
        # label -> slot; the remaining kwargs break one structural element each.
        momentum_values: "dict[int, tuple[int, int]] | None" = None,
        momentum_slots: int = DEFAULT_MOMENTUM_SLOTS,
        momentum_ticks: "dict[str, int] | None" = None,
        momentum_top_label: int = DEFAULT_MOMENTUM_TOP_LABEL,
        momentum_axis_labels: "list[str] | None" = None,
        momentum_gridlines: bool = True,
        momentum_axis_rule: bool = True,
        momentum_legend: bool = True,
        momentum_decorate=None,
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
        # Story 1.12 (additive, default-on): every report now carries a parseable
        # single-page defensive-actions section per team — extract_report runs the parser
        # on every report, so a text-only auto-generated page would die in
        # `PitchFrameError`. `defensive_actions_markers` places markers per family as
        # (fx, fy) fractions of that family's panel; `defensive_actions_headline`
        # overrides the printed headline value per family (forcing a count mismatch);
        # `defensive_actions_rows` overrides the per-player regains rows;
        # `defensive_actions_titles` renames a panel title (None drops it);
        # `defensive_actions_panels` replaces the (action_type, rect) panel list entirely
        # (dropping, duplicating or adding a panel); `defensive_actions_draw_panels=False`
        # omits the pitch frames; `defensive_actions_pages` emits extra anchored pages;
        # `defensive_actions_decorate` draws extra content for collision tests;
        # `defensive_actions_direction` overrides a panel's DIRECTION label rotation per
        # side per family (`None` drops the label, 270 mirrors the panel).
        defensive_actions_markers: "dict[str, dict[str, list[tuple[float, float]]]] | None" = None,
        defensive_actions_headline: "dict[str, dict[str, object]] | None" = None,
        defensive_actions_rows: "dict[str, list[dict]] | None" = None,
        defensive_actions_titles: "dict[str, str | None] | None" = None,
        defensive_actions_panels: "tuple | None" = None,
        defensive_actions_draw_panels: bool = True,
        defensive_actions_swatches: bool = True,
        defensive_actions_pages: "dict[str, int] | None" = None,
        defensive_actions_decorate=None,
        defensive_actions_direction: "dict[str, dict[str, int | None]] | None" = None,
        # Story 1.13 (additive, default-on): every report now carries the two parseable
        # receiving pages per team — extract_report runs both parsers on every report, so
        # a text-only auto-generated page would die in `PitchFrameError`. The printed
        # values DEFAULT to a derivation of this report's own Domain G rows
        # (`default_offers_block` / `default_movement_block`), which is what keeps the two
        # cross-domain reconciliations green when a caller changes the lineup.
        #
        # `offers_values` overrides individual printed KPI/badge values per side (keys of
        # `RECEIVING_KPI_LAYOUT` plus `offers_inside_shape`/`offers_outside_shape`);
        # `offers_rows` replaces the per-player rows (dicts with shirt/name/made/received,
        # optional `pct` to doctor the printed percentage and `name_split` to print a
        # three-line name); `offers_most` overrides the Most-Offers block;
        # `offers_titles` renames a panel title (None drops it); `offers_panels` replaces
        # the (key, rect) panel list entirely; `offers_dots` overrides the decoration
        # offsets per panel key (dropping, adding or moving a dot);
        # `offers_dot_rgbs` recolours dot index i of a panel (an off-palette fill);
        # `offers_draw_panels=False` omits the frames; `offers_pages` emits extra anchored
        # pages; `offers_decorate` draws extra content for collision tests.
        offers_values: "dict[str, dict[str, object]] | None" = None,
        offers_rows: "dict[str, list[dict]] | None" = None,
        offers_most: "dict[str, dict] | None" = None,
        offers_titles: "dict[str, str | None] | None" = None,
        offers_panels: "tuple | None" = None,
        offers_dots: "dict[str, tuple] | None" = None,
        offers_dot_rgbs: "dict[str, dict[int, tuple]] | None" = None,
        offers_draw_panels: bool = True,
        offers_pages: "dict[str, int] | None" = None,
        offers_decorate=None,
        # `movement_grid` overrides individual (third label, kebab code) grid counts per
        # side; `movement_donuts` overrides a printed donut centre total by its printed
        # title; `movement_top_rows` replaces the Top Ranked Players rows;
        # `movement_third_labels` replaces the (printed label, centre y) list (renaming or
        # dropping a third); `movement_direction` overrides the DIRECTION rotation per
        # side (None drops the label, 270 mirrors the panel); `movement_panels` replaces
        # the panel rect list; `movement_panel_title` renames the panel;
        # `movement_pages` emits extra anchored pages; `movement_decorate` draws extra
        # content for collision tests.
        movement_grid: "dict[str, dict[tuple[str, str], object]] | None" = None,
        movement_donuts: "dict[str, dict[str, object]] | None" = None,
        movement_top_rows: "dict[str, list[dict]] | None" = None,
        movement_third_labels: "tuple | None" = None,
        movement_direction: "dict[str, int | None] | None" = None,
        movement_panels: "tuple | None" = None,
        movement_panel_title: "str | None" = None,
        movement_pages: "dict[str, int] | None" = None,
        movement_decorate=None,
        # Story 1.10 (additive, default-on): every report now carries the eight parseable
        # Domain G per-player pages — extract_report runs the extractor on every report,
        # so a text-only auto-generated page would die in `PlayerTableParseError`.
        # `player_stats_rows` replaces the printed rows for one or both sides (dicts with
        # shirt / name / distributions / offers / out_of_possession / physical; cell
        # values may be strings for doctored pages, and `name_spans` prints the name as
        # several spans to exercise `join_spans`' gap rule).
        #
        # The multi-page-anchor and split-`%` variants are NOT parameters here: both are
        # properties of one family's page rather than of a whole report, and
        # `test_extract_domain_g.build()` drives the drawers directly for them. A second
        # unused copy on this factory would drift from the one that is exercised.
        player_stats_rows: "dict[str, list[dict]] | None" = None,
        # Story 1.9 (additive, default-on): every report now carries the nine parseable
        # Domain E/F pages — extract_report runs both extractors on every report, so a
        # text-only auto-generated page would die in `SetPlaysParseError` /
        # `GoalkeepingPageParseError`. Defaults come from `default_set_plays_block` and
        # `default_goalkeeping_blocks`, which satisfy every shipped relation by
        # construction AND make the two corpus-refuted relations false.
        #
        # `set_plays_block` / `goalkeeping_blocks` replace the printed values for one or
        # both sides (cell values may be strings or absent, for doctored pages);
        # `set_plays_date_strip=False` breaks the 24-word census; `set_plays_omit_labels`
        # drops printed labels by payload key; `gk_distribution_panels` /
        # `gk_distribution_titles` break the four-panel/title grammar;
        # `gk_distribution_off_palette` draws an unknown marker fill;
        # `gk_distribution_legend=False` / `gk_distribution_spots=False` drop the two
        # excluded-by-construction shapes, so a test can prove dropping them changes
        # nothing; `gk_involvement_dot_offsets` displaces a dot off the value grid;
        # `gk_involvement_axis_rule=False` drops the extra rule; the four `*_decorate`
        # hooks draw extra content for collision tests; and the `*_extra_pages`
        # counts emit additional anchored pages so an anchor resolves to more than one.
        set_plays_block: "dict[str, dict] | None" = None,
        set_plays_date_strip: bool = True,
        set_plays_omit_labels: "tuple[str, ...]" = (),
        set_plays_decorate=None,
        set_plays_extra_pages: "dict[str, int] | None" = None,
        goalkeeping_blocks: "dict[str, dict] | None" = None,
        gk_distribution_panels: "tuple | None" = None,
        gk_distribution_titles: "dict[str, str] | None" = None,
        gk_distribution_legend: bool = True,
        gk_distribution_spots: bool = True,
        gk_distribution_donut_xs: "dict[str, float] | None" = None,
        gk_distribution_off_palette: bool = False,
        gk_distribution_decorate=None,
        gk_distribution_extra_pages: "dict[str, int] | None" = None,
        gk_involvement_axis_rule: bool = True,
        gk_involvement_reverse: bool = False,
        gk_involvement_dot_offsets: "dict | None" = None,
        gk_involvement_decorate=None,
        gk_involvement_extra_pages: int = 0,
        goal_prevention_header: bool = True,
        goal_prevention_stray_ordinal: bool = True,
        goal_prevention_decorate=None,
        aerial_header: bool = True,
        aerial_decorate=None,
        # Story 1.14 (additive, default-on): every report now carries a parseable
        # Passing Networks page per team — extract_report runs the parser on every
        # report, so the text-only auto-generated page this anchor used to emit would die
        # in `PassNetworkParseError` and take the whole synthetic suite with it.
        #
        # The matrix DEFAULTS to a derivation of this report's own Domain G rows
        # (`default_pass_network_block`), which is what keeps the join and both
        # cross-domain bounds green when a caller changes the lineup — and which makes
        # all three corpus-refuted relations false by construction.
        #
        # `pass_network_block` replaces the drawn matrix per side; `pass_network_header`
        # drops the whole header band; `pass_network_lead_texts` rewrites the two leading
        # header cells' text per side (a template revision); `pass_network_column_widths`
        # changes the column grid (a uniform grid, a wider one);
        # `pass_network_header_names` rewrites the printed column-header names (the
        # hyphen-wrap case); `pass_network_omit_cells` drops `(row, column)` cells (a
        # second blank in a row); `pass_network_cell_text` doctors a cell's printed text
        # (a fullwidth digit, a non-integer); `pass_network_panel=False` drops the Top-5
        # panel; `pass_network_decorate` draws extra content last (a pitch rect there is
        # the no-coordinates tripwire); `pass_network_extra_pages` emits additional
        # anchored pages so the anchor resolves to more than one.
        pass_network_block: "dict[str, dict] | None" = None,
        pass_network_header: bool = True,
        pass_network_lead_texts: "dict[str, tuple] | None" = None,
        pass_network_column_widths: "tuple | None" = None,
        pass_network_header_names: "dict[str, list] | None" = None,
        pass_network_omit_cells: "dict[str, tuple] | None" = None,
        pass_network_cell_text: "dict[str, dict] | None" = None,
        pass_network_panel: bool = True,
        pass_network_decorate=None,
        pass_network_extra_pages: "dict[str, int] | None" = None,
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

        def emit_defensive_actions_pages(side: str, anchor_text: str) -> None:
            # Story 1.12: ONE page per team carrying TWO titled pitch panels, the
            # headline band whose values sit above their stacked labels, the strokeless
            # bullet swatches (outside both panels, in the markers' exact colour) and the
            # per-player regains table.
            panels = (
                DEFENSIVE_ACTIONS_PANELS
                if defensive_actions_panels is None
                else defensive_actions_panels
            )
            markers = (
                DEFAULT_DEFENSIVE_ACTIONS_MARKERS
                if defensive_actions_markers is None
                else defensive_actions_markers
            ).get(side, DEFAULT_DEFENSIVE_ACTIONS_MARKERS[side])

            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)

            def centred(x_centre: float, y: float, text, fontsize: float) -> None:
                text = str(text)
                # Fullwidth digits need a font that can encode them (the shots tests'
                # `fontname="japan"` precedent).
                kwargs = {} if text.isascii() else {"fontname": "japan"}
                width = pymupdf.get_text_length(
                    text, fontsize=fontsize, fontname=kwargs.get("fontname", "helv")
                )
                page.insert_text((x_centre - width / 2, y), text, fontsize=fontsize, **kwargs)

            def txt(x: float, y: float, text, fontsize: float = 7) -> None:
                text = str(text)
                kwargs = {} if text.isascii() else {"fontname": "japan"}
                page.insert_text((x, y), text, fontsize=fontsize, **kwargs)

            titles = defensive_actions_titles or {}
            directions = (defensive_actions_direction or {}).get(side, {})
            for action_type, rect in panels:
                pitch = pymupdf.Rect(*rect)
                if defensive_actions_draw_panels:
                    page.draw_rect(pitch, color=(1, 1, 1))
                # The panel's own rotated DIRECTION label, inside its frame and well
                # clear of both the title band above it and the regains table's y-lines.
                rotate = directions.get(action_type, DEFENSIVE_ACTIONS_DIRECTION_ROTATE)
                if rotate is not None:
                    page.insert_text(
                        (
                            (pitch.x0 + pitch.x1) / 2,
                            pitch.y0 + DEFENSIVE_ACTIONS_DIRECTION_DY,
                        ),
                        DEFENSIVE_ACTIONS_DIRECTION_TEXT,
                        fontsize=7,
                        rotate=rotate,
                    )
                title = titles.get(
                    action_type, DEFENSIVE_ACTIONS_PANEL_TITLES.get(action_type, action_type)
                )
                if title:
                    centred(
                        (pitch.x0 + pitch.x1) / 2, DEFENSIVE_ACTIONS_TITLE_Y, title, 10
                    )
                for fx, fy in markers.get(action_type, []):
                    page.draw_circle(
                        (pitch.x0 + fx * pitch.width, pitch.y0 + fy * pitch.height),
                        DEFENSIVE_ACTIONS_MARKER_RADIUS,
                        color=(1, 1, 1),
                        fill=DEFENSIVE_ACTIONS_RGB,
                        width=0.75,
                    )

            # The headline band: value above, two-line label below, both centred.
            overrides = (defensive_actions_headline or {}).get(side, {})
            for action_type, x_centre in DEFENSIVE_ACTIONS_HEADLINE_XS.items():
                drawn = len(markers.get(action_type, []))
                # The possession-regain headline deliberately differs from its marker
                # count, as it does on every corpus page: the parser must not check it.
                value = overrides.get(
                    action_type, drawn if action_type == "forced-turnover" else drawn + 2
                )
                if value is not None:
                    centred(x_centre, DEFENSIVE_ACTIONS_VALUE_Y, value, 14)
                for label, label_y in zip(
                    DEFENSIVE_ACTIONS_HEADLINE[action_type], DEFENSIVE_ACTIONS_LABEL_Y
                ):
                    centred(x_centre, label_y, label, 8)

            if defensive_actions_swatches:
                # The Possession-Contests bullet list: 9.0 pt STROKELESS swatches, one of
                # them in the markers' exact fill, outside both panels.
                for index, rgb in enumerate(DEFENSIVE_ACTIONS_SWATCH_RGBS):
                    page.draw_circle(
                        (622.5, 136.5 + index * 16.5),
                        DEFENSIVE_ACTIONS_SWATCH_RADIUS,
                        color=None,
                        fill=rgb,
                    )

            txt(DEFENSIVE_ACTIONS_TABLE_COLUMNS["Total"], DEFENSIVE_ACTIONS_TABLE_YS["total"], "Total")
            txt(DEFENSIVE_ACTIONS_TABLE_COLUMNS["#"], DEFENSIVE_ACTIONS_TABLE_YS["header"], "#")
            txt(DEFENSIVE_ACTIONS_TABLE_COLUMNS["Player"], DEFENSIVE_ACTIONS_TABLE_YS["header"], "Player")
            txt(897.0, DEFENSIVE_ACTIONS_TABLE_YS["header"], "Possession")
            txt(904.0, DEFENSIVE_ACTIONS_TABLE_YS["regains"], "Regains")

            side_rows = (
                defensive_actions_rows[side]
                if defensive_actions_rows is not None and side in defensive_actions_rows
                else default_defensive_action_rows(markers)
            )
            y = DEFENSIVE_ACTIONS_ROW_Y0
            for row in side_rows:
                txt(DEFENSIVE_ACTIONS_TABLE_COLUMNS["#"], y, row["shirt"])
                if row.get("name") is not None:
                    # `name_dy` prints the name off the numeric row line, which is what a
                    # two-line name does on the real page: the name then clusters on its
                    # own `table_lines` row and only the name x-band reunites it.
                    txt(
                        DEFENSIVE_ACTIONS_TABLE_COLUMNS["Player"],
                        y + row.get("name_dy", 0),
                        row["name"],
                    )
                if row.get("total") is not None:
                    txt(DEFENSIVE_ACTIONS_TOTAL_X, y, row["total"])
                y += DEFENSIVE_ACTIONS_ROW_PITCH
            if defensive_actions_decorate is not None:
                defensive_actions_decorate(side, page, panels)
            for _ in range((defensive_actions_pages or {}).get(side, 1) - 1):
                extra = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
                extra.insert_text((40, 60), anchor_text, fontsize=11)

        def _receiving_writers(page):
            """`left`/`centred`/`rotated` text helpers placing words by their bbox TOP."""
            import pymupdf

            def left(x, top, text, fontsize=RECEIVING_TABLE_FONTSIZE):
                text = str(text)
                # Fullwidth digits need a font that can encode them (the shots tests'
                # `fontname="japan"` precedent).
                kwargs = {} if text.isascii() else {"fontname": "japan"}
                page.insert_text(
                    (x, _baseline_for_top(top, fontsize)), text, fontsize=fontsize, **kwargs
                )

            def centred(x_centre, top, text, fontsize=RECEIVING_TABLE_FONTSIZE):
                text = str(text)
                kwargs = {} if text.isascii() else {"fontname": "japan"}
                width = pymupdf.get_text_length(
                    text, fontsize=fontsize, fontname=kwargs.get("fontname", "helv")
                )
                left(x_centre - width / 2, top, text, fontsize)

            def rotated(x, centre_y, text, rotate=90, fontsize=RECEIVING_TABLE_FONTSIZE):
                # `rotate=90` draws upward from the insertion point, so the run spans
                # `centre_y - width/2 .. centre_y + width/2` once offset by half its width.
                width = pymupdf.get_text_length(text, fontsize=fontsize)
                page.insert_text(
                    (x, centre_y + width / 2), text, fontsize=fontsize, rotate=rotate
                )

            return left, centred, rotated

        def emit_offers_pages(side: str, anchor_text: str) -> None:
            # Story 1.13: the real section is ONE page per team and it is a DASHBOARD —
            # two titled stroked panels holding an 11-dot formation template and one shape
            # badge each, five label-anchored KPI value/label pairs, a Most-Offers block
            # and a per-player table at the real x-positions and ~7 pt font.
            import pymupdf

            panels = RECEIVING_OFFERS_PANELS if offers_panels is None else offers_panels
            block = default_offers_block(player_stats_blocks[side])
            values = dict(
                {key: block[key] for key in RECEIVING_KPI_LAYOUT},
                offers_inside_shape=block["offers_inside_shape"],
                offers_outside_shape=block["offers_outside_shape"],
            )
            values.update((offers_values or {}).get(side, {}))
            rows = (
                block["rows"]
                if offers_rows is None or side not in offers_rows
                else offers_rows[side]
            )
            most = (offers_most or {}).get(side, block["most_offers"])

            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            left, centred, _rotated = _receiving_writers(page)

            titles = offers_titles or {}
            dot_offsets = offers_dots or {}
            for key, rect in panels:
                pitch = pymupdf.Rect(*rect)
                if offers_draw_panels:
                    page.draw_rect(pitch, color=(1, 1, 1), width=2.744)
                    if key == RECEIVING_OFFERS_OVERLAY_KEY:
                        # The raster shape overlay's border: stroke+fill rects of
                        # bit-identical geometry, so the page presents 4 qualifying rects
                        # for 2 panels (208/208 corpus pages).
                        for _ in range(RECEIVING_OFFERS_OVERLAY_COPIES):
                            page.draw_rect(pitch, color=RECEIVING_DOT_RGB, fill=RECEIVING_DOT_RGB)
                title = titles.get(key, RECEIVING_OFFERS_PANEL_TITLES.get(key, key))
                if title:
                    centred(
                        (pitch.x0 + pitch.x1) / 2,
                        RECEIVING_TITLE_TOP,
                        title,
                        RECEIVING_TITLE_FONTSIZE,
                    )
                for index, (fx, fy) in enumerate(dot_offsets.get(key, RECEIVING_DOT_OFFSETS)):
                    fill = (offers_dot_rgbs or {}).get(key, {}).get(index, RECEIVING_DOT_RGB)
                    page.draw_circle(
                        (pitch.x0 + fx * pitch.width, pitch.y0 + fy * pitch.height),
                        RECEIVING_DOT_RADIUS,
                        color=(1, 1, 1),
                        fill=fill,
                        width=0.75,
                    )
                # The in-panel white furniture only `marker_min_pt` excludes.
                for fx, fy in ((0.5, 0.12), (0.5, 0.88)):
                    page.draw_circle(
                        (pitch.x0 + fx * pitch.width, pitch.y0 + fy * pitch.height),
                        RECEIVING_SPOT_RADIUS,
                        color=None,
                        fill=(1, 1, 1),
                    )
                page.draw_circle(
                    (pitch.x0 + 0.5 * pitch.width, pitch.y0 + 0.5 * pitch.height),
                    RECEIVING_CENTRE_SPOT_RADIUS,
                    color=None,
                    fill=(1, 1, 1),
                )
                badge = values.get(key)
                if badge is not None and key in RECEIVING_BADGE_TOPS:
                    centred(
                        (pitch.x0 + pitch.x1) / 2,
                        RECEIVING_BADGE_TOPS[key],
                        badge,
                        RECEIVING_TABLE_FONTSIZE,
                    )

            for key, (labels, x_centre, value_top, label_top) in RECEIVING_KPI_LAYOUT.items():
                value = values.get(key)
                if value is not None:
                    centred(x_centre, value_top, value, RECEIVING_KPI_FONTSIZE)
                for index, label in enumerate(labels):
                    centred(
                        x_centre,
                        label_top + index * RECEIVING_LABEL_LINE_PITCH,
                        label,
                        RECEIVING_LABEL_FONTSIZE,
                    )

            # The Most Offers block: title, then value / name / position stacked under it,
            # each x-overlapping the title and above the panel titles.
            centred(
                RECEIVING_MOST_X, RECEIVING_MOST_TITLE_TOP, "Most Offers", RECEIVING_LABEL_FONTSIZE
            )
            if most.get("value") is not None:
                centred(
                    RECEIVING_MOST_X,
                    RECEIVING_MOST_VALUE_TOP,
                    most["value"],
                    RECEIVING_MOST_VALUE_FONTSIZE,
                )
            for top, text in (
                (RECEIVING_MOST_NAME_TOP, most.get("player_name")),
                (RECEIVING_MOST_POSITION_TOP, most.get("position")),
            ):
                if text is not None:
                    centred(RECEIVING_MOST_X, top, text, RECEIVING_LABEL_FONTSIZE)

            # The stacked three-line table header. The '#'+'Player' line deliberately
            # shares its y-cluster with the Most-Offers title, as the corpus prints it.
            for x, text in ((817.0, "Offers"), (865.0, "Offers"), (900.0, "%"), (912.0, "Made"), (932.0, "&")):
                left(x, RECEIVING_TABLE_TOPS["stack_top"], text)
            for word, x in RECEIVING_TABLE_COLUMNS.items():
                left(x, RECEIVING_TABLE_TOPS["header"], word)
            for x, text in ((818.0, "Made"), (859.0, "Received"), (900.0, "Received")):
                left(x, RECEIVING_TABLE_TOPS["stack_bottom"], text)

            top = RECEIVING_ROW_TOP0
            for row in rows:
                left(RECEIVING_TABLE_COLUMNS["#"], top, row["shirt"])
                name = row.get("name")
                if row.get("name_split"):
                    # The three-line name four corpus pages print: halves 4.5 pt above and
                    # below the numeric row, leaving that cluster with no name at all.
                    above, below = row["name_split"]
                    left(RECEIVING_TABLE_COLUMNS["Player"], top - 4.5, above)
                    left(RECEIVING_TABLE_COLUMNS["Player"], top + 4.5, below)
                elif name is not None:
                    left(RECEIVING_TABLE_COLUMNS["Player"], top, name)
                if row.get("made") is not None:
                    left(RECEIVING_TABLE_VALUE_XS["made"], top, row["made"])
                if row.get("received") is not None:
                    left(RECEIVING_TABLE_VALUE_XS["received"], top, row["received"])
                if "pct" in row:
                    printed = row["pct"]
                else:
                    ratio = (
                        round(100 * row["received"] / row["made"], 1) if row["made"] else 0
                    )
                    # The page drops a trailing ".0" ("50%", "32%", "0%") exactly as the
                    # corpus does — 81 corpus rows print `0%` beside `offers_made == 0`.
                    printed = f"{ratio:g}%"
                if printed is not None:
                    left(RECEIVING_TABLE_VALUE_XS["pct"], top, printed)
                top += RECEIVING_ROW_PITCH
            if offers_decorate is not None:
                offers_decorate(side, page, panels)
            for _ in range((offers_pages or {}).get(side, 1) - 1):
                extra = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
                extra.insert_text((40, 60), anchor_text, fontsize=11)

        def emit_movement_pages(side: str, anchor_text: str) -> None:
            # Story 1.13: ONE titled stroked pitch panel holding ZERO markers (a
            # three-thirds bar chart), rotated third + DIRECTION labels, four RASTER
            # donuts whose only text is their centre total, and the Top Ranked Players
            # table.
            import pymupdf

            panels = (
                (RECEIVING_MOVEMENT_PANEL,) if movement_panels is None else movement_panels
            )
            block = default_movement_block(player_stats_blocks[side])
            grid = dict(block["grid"])
            grid.update((movement_grid or {}).get(side, {}))
            donuts = dict(block["by_phase"])
            donuts["All Movement Types"] = block["total_movements"]
            donuts.update((movement_donuts or {}).get(side, {}))
            top_rows = (
                block["top_ranked"]
                if movement_top_rows is None or side not in movement_top_rows
                else movement_top_rows[side]
            )

            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            left, centred, rotated = _receiving_writers(page)

            for rect in panels:
                pitch = pymupdf.Rect(*rect)
                page.draw_rect(pitch, color=(1, 1, 1), width=3.73)
                title = (
                    RECEIVING_MOVEMENT_PANEL_TITLE
                    if movement_panel_title is None
                    else movement_panel_title
                )
                if title:
                    centred(
                        (pitch.x0 + pitch.x1) / 2,
                        RECEIVING_MOVEMENT_TITLE_TOP,
                        title,
                        RECEIVING_TITLE_FONTSIZE,
                    )
            rotate = (
                RECEIVING_DIRECTION_ROTATE
                if movement_direction is None or side not in movement_direction
                else movement_direction[side]
            )
            if rotate is not None:
                rotated(
                    RECEIVING_DIRECTION_AT[0],
                    RECEIVING_DIRECTION_AT[1],
                    RECEIVING_DIRECTION_TEXT,
                    rotate=rotate,
                )
            third_labels = (
                RECEIVING_THIRD_LABELS if movement_third_labels is None else movement_third_labels
            )
            for label, centre_y in third_labels:
                if label:
                    # Printed just LEFT of the panel's own x0, as the corpus prints them.
                    rotated(RECEIVING_THIRD_LABEL_X, centre_y, label)

            centred(100.0, 88.0, "Movement Types by Phase", RECEIVING_LABEL_FONTSIZE)
            for title, (rect, title_top, (value_x, value_top)) in RECEIVING_DONUTS.items():
                centred(
                    RECEIVING_DONUT_TITLE_XS[title], title_top, title, RECEIVING_LABEL_FONTSIZE
                )
                # A real raster image, because the parser locates each donut by its own
                # image rect: the slice values are inside the picture and unextractable,
                # so the centre total is the only text the donut offers.
                pixmap = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 8, 8), False)
                pixmap.clear_with(200)
                page.insert_image(pymupdf.Rect(*rect), pixmap=pixmap)
                value = donuts.get(title)
                if value is not None:
                    centred(value_x, value_top, value, RECEIVING_LABEL_FONTSIZE)
            # The five legend swatches and labels print INSIDE the All-Movement donut's
            # image rect — non-digit words the "unique digit inside" read must survive.
            for index, ((label, _code), rgb) in enumerate(
                zip(RECEIVING_MOVEMENT_LABELS, RECEIVING_LEGEND_RGBS)
            ):
                top = RECEIVING_LEGEND_TOP0 + index * RECEIVING_LEGEND_PITCH
                page.draw_circle(
                    (RECEIVING_LEGEND_SWATCH_X, top + 3.0),
                    RECEIVING_LEGEND_RADIUS,
                    color=None,
                    fill=rgb,
                )
                left(RECEIVING_LEGEND_X, top, label)

            for third_label, row_tops in RECEIVING_GRID_ROW_TOPS.items():
                for (label, code), row_top in zip(RECEIVING_MOVEMENT_LABELS, row_tops):
                    left(RECEIVING_GRID_LABEL_X, row_top, label)
                    count = grid.get((third_label, code))
                    if count is not None:
                        left(
                            RECEIVING_GRID_VALUE_X,
                            row_top + RECEIVING_GRID_VALUE_DY[third_label],
                            count,
                        )
                # The axis-tick row: 11 more digit words inside the panel, >= 21 pt below
                # the last label row. 33 per page in total.
                for x, tick in zip(RECEIVING_TICK_XS, RECEIVING_TICK_LABELS):
                    left(x, RECEIVING_TICK_TOPS[third_label], tick)

            centred(420.0, RECEIVING_TOP_RANKED_TITLE_TOP, "Top Ranked Players", RECEIVING_LABEL_FONTSIZE)
            for word, x in RECEIVING_TOP_RANKED_COLUMNS.items():
                left(x, RECEIVING_TOP_RANKED_HEADER_TOP, word)
            for row, row_top in zip(top_rows, RECEIVING_TOP_RANKED_ROW_TOPS):
                left(RECEIVING_TOP_RANKED_COLUMNS["Type"], row_top, row["label"])
                left(RECEIVING_TOP_RANKED_VALUE_XS["shirt"], row_top, row["shirt"])
                if row.get("name") is not None:
                    left(RECEIVING_TOP_RANKED_VALUE_XS["name"], row_top, row["name"])
                if row.get("movements") is not None:
                    left(RECEIVING_TOP_RANKED_VALUE_XS["movements"], row_top, row["movements"])
            if movement_decorate is not None:
                movement_decorate(side, page, panels)
            for _ in range((movement_pages or {}).get(side, 1) - 1):
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
        # Story 1.10: the lineup specs are resolved BEFORE the anchor loop, because the
        # Domain G pages are derived from them and may be emitted ahead of the lineups
        # page (`page_order="reversed"` does exactly that).
        lineup_specs = (
            lineup_sides
            if lineup_sides is not None
            else default_lineup_sides(home, away, home_score, away_score)
        )
        player_stats_blocks = default_player_stats_rows(lineup_specs, stats_block)
        if player_stats_rows is not None:
            player_stats_blocks = {**player_stats_blocks, **player_stats_rows}

        def emit_player_stats_page(family: str, side: str, anchor_text: str) -> None:
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            DOMAIN_G_DRAWERS[family](page, player_stats_blocks[side])

        # Story 1.9: the Domain E/F blocks, resolved before the anchor loop because the
        # involvement page needs BOTH sides at once.
        set_plays_blocks = {side: default_set_plays_block(side) for side in ("home", "away")}
        if set_plays_block is not None:
            set_plays_blocks = {**set_plays_blocks, **set_plays_block}
        gk_blocks = {side: default_goalkeeping_blocks(side) for side in ("home", "away")}
        if goalkeeping_blocks is not None:
            gk_blocks = {**gk_blocks, **goalkeeping_blocks}

        # Story 1.14: the pass matrix is derived from the Domain G rows resolved above,
        # and from the Key Statistics block, so the join and both bounds hold whatever
        # the caller changed. Resolved BEFORE the anchor loop for the same reason the
        # Domain G blocks are: the pass-network page may be emitted ahead of the lineups.
        pass_network_blocks = {
            side: default_pass_network_block(
                player_stats_blocks[side], stats_block[side]["passes_completed"]
            )
            for side in ("home", "away")
        }
        if pass_network_block is not None:
            pass_network_blocks = {**pass_network_blocks, **pass_network_block}

        def emit_anchored_extras(anchor_text: str, count: int) -> None:
            """Extra pages carrying the same anchor text, so the anchor resolves to >1."""
            for _ in range(count):
                extra = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
                extra.insert_text((40, 60), anchor_text, fontsize=11)

        def emit_pass_network_page(side: str, anchor_text: str) -> None:
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            draw_pass_network_page(
                page,
                pass_network_blocks[side],
                header=pass_network_header,
                lead_texts=(pass_network_lead_texts or {}).get(
                    side, ("#", "Passes From to")
                ),
                column_widths=(
                    pass_network_column_widths
                    if pass_network_column_widths is not None
                    else PASS_NETWORK_COLUMN_WIDTHS
                ),
                header_names=(pass_network_header_names or {}).get(side),
                omit_cells=(pass_network_omit_cells or {}).get(side, ()),
                cell_text=(pass_network_cell_text or {}).get(side),
                panel=pass_network_panel,
                decorate=(
                    None
                    if pass_network_decorate is None
                    else (lambda p, s=side: pass_network_decorate(s, p))
                ),
            )
            emit_anchored_extras(anchor_text, (pass_network_extra_pages or {}).get(side, 0))

        def emit_set_plays_page(side: str, anchor_text: str) -> None:
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            draw_set_plays_page(
                page,
                set_plays_blocks[side],
                date_strip=set_plays_date_strip,
                omit_labels=set_plays_omit_labels,
                decorate=set_plays_decorate,
            )
            emit_anchored_extras(anchor_text, (set_plays_extra_pages or {}).get(side, 0))

        def emit_gk_distribution_page(side: str, anchor_text: str) -> None:
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            draw_gk_distribution_page(
                page,
                gk_blocks[side]["distribution"],
                panels=(
                    GK_DISTRIBUTION_PANELS
                    if gk_distribution_panels is None
                    else gk_distribution_panels
                ),
                titles=gk_distribution_titles,
                legend=gk_distribution_legend,
                spots=gk_distribution_spots,
                donut_xs=gk_distribution_donut_xs,
                off_palette=gk_distribution_off_palette,
                decorate=gk_distribution_decorate,
            )
            emit_anchored_extras(anchor_text, (gk_distribution_extra_pages or {}).get(side, 0))

        def emit_goal_prevention_page(side: str, anchor_text: str) -> None:
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            draw_goal_prevention_page(
                page,
                gk_blocks[side]["goal_prevention"],
                header=goal_prevention_header,
                stray_ordinal=goal_prevention_stray_ordinal,
                decorate=goal_prevention_decorate,
            )

        def emit_aerial_control_page(side: str, anchor_text: str) -> None:
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            draw_aerial_control_page(
                page,
                gk_blocks[side]["aerial_control"],
                header=aerial_header,
                decorate=aerial_decorate,
            )

        def emit_gk_involvement_page(anchor_text: str) -> None:
            page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
            page.insert_text((40, 60), anchor_text, fontsize=11)
            draw_gk_involvement_page(
                page,
                home,
                away,
                {side: gk_blocks[side]["involvement"] for side in ("home", "away")},
                axis_rule=gk_involvement_axis_rule,
                reverse=gk_involvement_reverse,
                dot_offsets=gk_involvement_dot_offsets,
                decorate=gk_involvement_decorate,
            )
            emit_anchored_extras(anchor_text, gk_involvement_extra_pages)

        for anchor in body:
            if anchor.anchor_id in ("shots:home", "shots:away"):
                emit_shots_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            if anchor.anchor_id in ("crosses:home", "crosses:away"):
                emit_crosses_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            if anchor.anchor_id in ("defensive-actions:home", "defensive-actions:away"):
                emit_defensive_actions_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            # Story 1.13: the two receiving families, per team. Like the branches above,
            # these match RESOLVED ids — a bare-id branch for a per-team spec never fires.
            if anchor.anchor_id in ("offers:home", "offers:away"):
                emit_offers_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            if anchor.anchor_id in ("movement:home", "movement:away"):
                emit_movement_pages(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            # Story 1.10: the four Domain G families, per team. The anchor loop matches
            # RESOLVED ids, so these are the eight suffixed forms — a bare-id branch for
            # a per-team spec never fires, and the generic anchor-text-only page it would
            # leave behind fails the whole suite undiagnosably.
            if anchor.anchor_id in (
                "individual-distributions:home",
                "individual-distributions:away",
                "individual-offers-receptions:home",
                "individual-offers-receptions:away",
                "individual-out-of-possession:home",
                "individual-out-of-possession:away",
                "physical-data:home",
                "physical-data:away",
            ):
                family, side = anchor.anchor_id.split(":")
                emit_player_stats_page(family, side, anchor.text)
                continue
            # Story 1.9: the four goalkeeping families and set plays. The anchor loop
            # matches RESOLVED ids, so the per-team families use the SUFFIXED forms while
            # `gk-involvement` uses the BARE one — its spec is deliberately not per_team
            # (one page carries both teams' charts). A suffixed branch for gk-involvement,
            # or a bare branch for a per-team spec, never fires at all and leaves behind a
            # generic anchor-text-only page that fails the whole suite undiagnosably.
            if anchor.anchor_id == "gk-involvement":
                emit_gk_involvement_page(anchor.text)
                continue
            if anchor.anchor_id in ("gk-distribution:home", "gk-distribution:away"):
                emit_gk_distribution_page(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            if anchor.anchor_id in ("goal-prevention:home", "goal-prevention:away"):
                emit_goal_prevention_page(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            if anchor.anchor_id in ("aerial-control:home", "aerial-control:away"):
                emit_aerial_control_page(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            if anchor.anchor_id in ("set-plays:home", "set-plays:away"):
                emit_set_plays_page(anchor.anchor_id.split(":")[1], anchor.text)
                continue
            # Story 1.14: the pass-network family, per team — the SUFFIXED ids, like every
            # per-team branch above. A bare-id branch would never fire and would leave the
            # generic anchor-text-only page behind, which now fails the whole suite.
            if anchor.anchor_id in ("pass-network:home", "pass-network:away"):
                emit_pass_network_page(anchor.anchor_id.split(":")[1], anchor.text)
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
            if anchor.anchor_id == "momentum":
                # Story 1.8: the real corpus draws this chart at the foot of the lineups
                # page, but the parser locates it by its OWN title anchor and never by
                # page identity — so the fixture gives it its own page, which is what
                # proves the parser is not quietly relying on the lineups page.
                draw_momentum_page(
                    page,
                    home,
                    away,
                    values=momentum_values,
                    slot_count=momentum_slots,
                    ticks=momentum_ticks,
                    top_label=momentum_top_label,
                    axis_labels=momentum_axis_labels,
                    gridlines=momentum_gridlines,
                    axis_rule=momentum_axis_rule,
                    legend=momentum_legend,
                    title=False,
                    decorate=momentum_decorate,
                )
            if anchor.anchor_id == "lineups":
                # The lineups page must parse as Domain A (Story 1.6) — extract_report
                # runs the extractor on every report. Default sides score-adaptively
                # reconcile their goal markers with the cover score. Resolved above the
                # loop since Story 1.10, because the Domain G pages derive from them.
                draw_lineup_page(
                    page,
                    lineup_specs[0],
                    lineup_specs[1],
                    formations=lineup_formations,
                    title=False,
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

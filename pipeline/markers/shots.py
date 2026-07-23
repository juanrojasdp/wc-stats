"""Shots pitch-map parser: filter chain -> AD-6 shot events + marker-count counts.

Defends against the transposition trap (the story's highest-risk detail): the PMSR map
is rendered vertically, attack up the page, so the spike's `nx`/`ny` were pitch-width /
pitch-length *fractions* — a transposed frame vs AD-6. Here x runs along the attack
direction (`x = 100 * (pitch.y1 - pdf_y) / pitch.height`, 100 at the attacked goal, which
sits at the top of the page) and y across the pitch from the attacker's left
(`y = 100 * (pdf_x - pitch.x0) / pitch.width`). Verified empirically on the ground-truth
fixture: both home goal markers land at x ~85-94, inside the box (edge ~x 83), and the
away map is drawn from its own attacking perspective with the same page orientation.

The expected attempt count comes from the tabular attempts table on the section's second
page — never from the markers themselves, which would make Self-Validation a tautology.
The table helpers live in `attempts.py` since Story 1.5, which also enriches every event
with its linked table row via `linking.py` (digit-glyph proximity).
Pure: no I/O beyond the open `pymupdf.Document`. Story 1.3 Tasks 2-3; Story 1.5 Task 4.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pipeline.ingest.identity import team_slug
from pipeline.markers.attempts import parse_attempt_rows
from pipeline.markers.errors import ShotsPageLayoutError
from pipeline.markers.filter_chain import (
    LEGEND_Y_DECIMALS,
    MarkerSpec,
    collect_candidate_markers,
    detect_pitch_frame,
    key_outcomes,
    legend_row_ys,
)
from pipeline.markers.linking import collect_digit_glyphs, event_fields, link_markers

if TYPE_CHECKING:  # pragma: no cover - typing only
    import pymupdf

# The shots outcome palette, frozen ground truth from spike/extract.py. Values are the
# contract's hyphenated `ShotOutcome` enum, not the spike's underscores.
SHOTS_RGB_TO_OUTCOME: dict[tuple[float, float, float], str] = {
    (0.00, 0.50, 0.00): "goal",
    (0.36, 0.61, 0.84): "on-target",
    (0.96, 0.74, 0.00): "off-target",
    (0.70, 0.53, 1.00): "blocked",
    (0.18, 0.30, 1.00): "incomplete",
}

# Real markers are 11.25 x 11.25 pt filled Bezier circles with a white stroke.
SHOTS_MARKER_SPEC = MarkerSpec(
    marker_min_pt=8.0,
    marker_max_pt=15.0,
    rgb_to_outcome=SHOTS_RGB_TO_OUTCOME,
)

# Stored coordinates are rounded to 2 decimals: PitchX/PitchY fix `x-decimals: 2`, and
# rounding is what keeps records byte-identical across float environments (AD-8).
COORD_DECIMALS = 2


def parse_shots(
    doc: "pymupdf.Document",
    anchors: "dict[str, list[int]]",
    report_id: str,
    home_team: str,
    away_team: str,
) -> dict:
    """Extract both teams' shots domain block from an open report.

    `anchors` is the record's anchor map (0-based page indices, ascending). Each team's
    `shots:{side}` anchor resolves to [pitch-map page, event-table page(s)]: the first
    anchored page carries the map, and the table takes one page per ~17 attempts — 37 of
    the 104 corpus reports overflow onto a second table page (Task 7 discovery; Germany's
    26 attempts in M10 split 17 + 9). Fewer than two pages raises `ShotsPageLayoutError`;
    a trailing anchored page that is not a table page fails loud as `AttemptsTableError`,
    and a table-first ordering as `PitchFrameError` — nothing parses the wrong page
    silently.

    Raises `PitchFrameError`, `UnknownRgbError`, `AttemptsTableError`,
    `AttemptRowError`, `UnknownLabelError` and `ShotsPageLayoutError`, all typed and
    report-scoped. A count mismatch is NOT an exception — it lands in `counts` for
    `self_validation_block` to judge — and neither is an unlinkable marker: it stays in
    `shot_events` with `linked: false` and null joined fields (Story 1.5, AC 2).
    """
    events: list[dict] = []
    counts: dict[str, dict[str, int]] = {}
    for side, team_name in (("home", home_team), ("away", away_team)):
        anchor_id = f"shots:{side}"
        pages = anchors.get(anchor_id)
        if not isinstance(pages, list) or len(pages) < 2:
            raise ShotsPageLayoutError(anchor_id, pages, report_id)
        map_index, table_indices = pages[0], pages[1:]

        page = doc[map_index]
        pitch = detect_pitch_frame(page, report_id)
        candidates = collect_candidate_markers(page.get_drawings(), pitch, SHOTS_MARKER_SPEC)
        legend_ys = legend_row_ys(candidates, SHOTS_MARKER_SPEC)
        markers = [
            candidate
            for candidate in candidates
            if round(candidate.pdf_y, LEGEND_Y_DECIMALS) not in legend_ys
        ]
        keyed = key_outcomes(markers, SHOTS_MARKER_SPEC, report_id, map_index)

        # Story 1.5: the tabular event rows plus the on-marker ordinal glyphs. Linking
        # runs best-effort per marker even when marker count != row count — the 1.3
        # count check already fails Self-Validation for that; a marker whose ordinal
        # has a row can still link.
        rows = parse_attempt_rows(doc, table_indices, report_id)
        glyphs = collect_digit_glyphs(page, pitch, legend_ys, len(rows))
        linked_rows = link_markers(keyed, glyphs, rows)

        team_id = team_slug(team_name)
        for marker, row in zip(keyed, linked_rows):
            events.append(
                {
                    "team_id": team_id,
                    "x": round(100 * (pitch.y1 - marker.pdf_y) / pitch.height, COORD_DECIMALS),
                    "y": round(100 * (marker.pdf_x - pitch.x0) / pitch.width, COORD_DECIMALS),
                    "outcome": marker.outcome,
                    # PMSR marks no own goals anywhere (Story 1.1, corpus-verified); the
                    # field exists so Story 1.16's `ownGoal` mapping is mechanical.
                    "own_goal": False,
                    # Story 1.5's join: time/player/labels from the linked attempts-table
                    # row, or nulls with `linked: false` when no trustworthy link exists.
                    **event_fields(row),
                    # pdf-space position on the map page, for Story 1.5's digit-glyph
                    # proximity linking.
                    "source": {
                        "page_index": map_index,
                        "pdf_x": round(marker.pdf_x, COORD_DECIMALS),
                        "pdf_y": round(marker.pdf_y, COORD_DECIMALS),
                    },
                }
            )
        counts[side] = {
            "markers": len(keyed),
            # `parse_attempt_rows` internally asserts this equals the 1.3 counting
            # heuristic's result for the same pages.
            "table": len(rows),
        }

    # Deterministic record order (AD-8): team, then map page, then pdf position.
    events.sort(
        key=lambda event: (
            event["team_id"],
            event["source"]["page_index"],
            event["source"]["pdf_y"],
            event["source"]["pdf_x"],
        )
    )
    return {
        "shot_events": events,
        # No per-attempt shootout table exists anywhere in the corpus (Story 1.1), and
        # shootout attempts never mix into shot events — if a template variant ever drew
        # them on the map, markers != table rows and Self-Validation fails that report.
        "shootout_attempts": None,
        "counts": counts,
    }


def self_validation_block(counts: "dict[str, dict[str, int]]") -> dict:
    """The record's `self_validation` block from per-team marker/table counts (FR-14).

    Binary and exact — no tolerance, never loosened (SM-C1). Both counts are always
    recorded, pass or fail: recording them on pass costs nothing and feeds the 1.4
    deviation summary.
    """
    checks = [
        {
            "check": "shots-marker-count",
            "team": side,
            "result": "pass" if side_counts["markers"] == side_counts["table"] else "fail",
            "marker_count": side_counts["markers"],
            "table_count": side_counts["table"],
        }
        for side, side_counts in (("home", counts["home"]), ("away", counts["away"]))
    ]
    return {
        "result": "pass" if all(check["result"] == "pass" for check in checks) else "fail",
        "checks": checks,
    }



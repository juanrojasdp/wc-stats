"""Story 1.5 Tasks 3-6: digit-glyph proximity linking, Self-Validation, gate seam.

An unlinkable marker is DATA (retained, flagged, SV fail), never an exception; every
negative path here asserts exactly that. Expected joined values derive from what the
factory drew (`default_attempt_cells`), never a second literal; the ground-truth tests
assert table values (player/minute/labels) but never lifted coordinates (AR-16).
"""

from __future__ import annotations

import pymupdf
import pytest

from pipeline.ingest.batch import run_batch
from pipeline.ingest.extract_report import extract_report
from pipeline.markers.attempts import (
    BODY_PART_LABEL_TO_ENUM,
    DELIVERY_LABEL_TO_ENUM,
    OUTCOME_LABEL_TO_DETAIL,
    AttemptRow,
)
from pipeline.markers.filter_chain import KeyedMarker
from pipeline.markers.linking import (
    SHOTS_MARKER_RADIUS,
    DigitGlyph,
    collect_digit_glyphs,
    event_fields,
    link_markers,
    link_rate_checks,
)
from pipeline.markers.shots import parse_shots
from pipeline.tests.conftest import DEFAULT_SHOTS_MARKERS, default_attempt_cells
from pipeline.validate.runner import run_verification

REPORT_ID = "PMSR-M07-AAA-V-BBB"

JOINED_FIELDS = (
    "ordinal",
    "time_raw",
    "shirt_number",
    "player_name",
    "outcome_detail",
    "body_part",
    "delivery_type",
)


def open_report(make_report, tmp_path, **kwargs):
    pdf = make_report(tmp_path / f"{REPORT_ID}.pdf", number=7, **kwargs)
    return pymupdf.open(pdf)


def shots_anchors(doc, home="Mexico", away="South Africa", report_id=REPORT_ID) -> dict:
    from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
    from pipeline.discover.text import PageTextIndex

    index = PageTextIndex(doc, report_id)
    anchors = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=home, away=away):
        anchors[anchor.anchor_id] = index.find_all(anchor.text, at_start=anchor.at_page_start)
    return anchors


def parse(doc) -> dict:
    return parse_shots(doc, shots_anchors(doc), REPORT_ID, "Mexico", "South Africa")


def team_events(shots: dict, team_id: str) -> list[dict]:
    return [event for event in shots["shot_events"] if event["team_id"] == team_id]


def expected_join(markers, ordinal: int) -> dict:
    """The joined fields row `ordinal` should carry, derived from the factory's cells."""
    cells = default_attempt_cells(markers, ordinal - 1)
    return {
        "ordinal": ordinal,
        "time_raw": cells["time"],
        "shirt_number": cells["shirt"],
        "player_name": cells["name"],
        "outcome_detail": OUTCOME_LABEL_TO_DETAIL[cells["outcome"]],
        "body_part": BODY_PART_LABEL_TO_ENUM[cells["body"]],
        "delivery_type": DELIVERY_LABEL_TO_ENUM[cells["delivery"]],
    }


def make_row(ordinal: int, outcome_detail: str = "off-target") -> AttemptRow:
    return AttemptRow(
        ordinal=ordinal,
        time_raw=3 + 5 * (ordinal - 1),
        shirt_number=9,
        player_name="Test PLAYER",
        outcome_detail=outcome_detail,
        body_part="right-foot",
        delivery_type="pass",
    )


def make_marker(pdf_x: float, pdf_y: float, outcome: str = "off-target") -> KeyedMarker:
    return KeyedMarker(pdf_x=pdf_x, pdf_y=pdf_y, rgb=(0.96, 0.74, 0.00), outcome=outcome)


# --- glyph collection (unit) ------------------------------------------------------


def test_glyph_collection_keeps_only_ascii_digit_words_inside_the_pitch():
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    pitch = pymupdf.Rect(40, 115, 400, 520)
    page.insert_text((200, 300), "7", fontsize=6)  # inside: kept
    page.insert_text((700, 300), "8", fontsize=6)  # far outside the pitch: dropped
    page.insert_text((200, 340), "3:00", fontsize=6)  # not a full digit match: dropped
    # Fullwidth digits under the CJK font (the default font renders them U+FFFD, which
    # would make this branch vacuous): `re.ASCII` must reject them.
    page.insert_text((220, 380), "３５", fontsize=6, fontname="japan")

    glyphs = collect_digit_glyphs(page, pitch, legend_ys=set(), row_count=20)

    assert [glyph.ordinal for glyph in glyphs] == [7]
    doc.close()


def test_a_merged_word_from_two_adjacent_labels_offers_its_split_reading():
    """Real corpus: overlapping markers' labels "3" and "4" extract as one word "34".
    With 14 rows, 34 is no valid ordinal, so the only reading is the split — two part
    glyphs sharing the word, left part left of the right part."""
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    pitch = pymupdf.Rect(40, 115, 400, 520)
    page.insert_text((200, 300), "34", fontsize=6)

    glyphs = collect_digit_glyphs(page, pitch, legend_ys=set(), row_count=14)

    assert [glyph.ordinal for glyph in glyphs] == [3, 4]
    assert glyphs[0].pdf_x < glyphs[1].pdf_x
    assert glyphs[0].word_id == glyphs[1].word_id
    assert not glyphs[0].whole and not glyphs[1].whole
    # Non-overlapping char intervals: both parts are claimable together.
    assert glyphs[0].end <= glyphs[1].start
    doc.close()


def test_an_ambiguous_two_digit_word_offers_both_readings():
    """"12" with >= 12 rows could be ordinal 12 or the merged labels "1"+"2"; all
    three parts are offered and the interval-conflict rule keeps a claim of "12" from
    coexisting with a claim of "1" or "2"."""
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    pitch = pymupdf.Rect(40, 115, 400, 520)
    page.insert_text((200, 300), "12", fontsize=6)

    glyphs = collect_digit_glyphs(page, pitch, legend_ys=set(), row_count=14)

    assert sorted(glyph.ordinal for glyph in glyphs) == [1, 2, 12]
    assert [glyph.ordinal for glyph in glyphs if glyph.whole] == [12]
    doc.close()


def test_a_label_of_an_edge_marker_just_outside_the_pitch_is_still_a_candidate():
    """Real corpus: markers sit exactly on the pitch boundary (pdf_y == pitch.y0), so
    their labels' centers can fall a fraction outside the rect. The containment test
    runs against the pitch expanded by the marker radius — dropping such a glyph would
    silently unlink an edge marker."""
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    pitch = pymupdf.Rect(40, 115, 400, 520)
    # Baseline placed so the word's bbox center lands just ABOVE pitch.y0.
    page.insert_text((200, 114), "9", fontsize=6)

    glyphs = collect_digit_glyphs(page, pitch, legend_ys=set(), row_count=20)

    assert [glyph.ordinal for glyph in glyphs] == [9]
    assert glyphs[0].pdf_y < pitch.y0
    doc.close()


def test_a_digit_in_the_legend_band_is_never_a_candidate():
    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    pitch = pymupdf.Rect(40, 115, 400, 520)
    page.insert_text((200, 508), "4", fontsize=6)  # in the legend band
    page.insert_text((200, 300), "5", fontsize=6)  # a real candidate

    glyphs = collect_digit_glyphs(page, pitch, legend_ys={505.9}, row_count=20)

    assert [glyph.ordinal for glyph in glyphs] == [5]
    doc.close()


# --- linking rules (unit) ---------------------------------------------------------


def test_nearest_glyph_within_the_marker_radius_links():
    markers = [make_marker(100.0, 200.0)]
    glyphs = [DigitGlyph(101.0, 200.5, ordinal=1), DigitGlyph(140.0, 200.0, ordinal=2)]

    assert link_markers(markers, glyphs, [make_row(1), make_row(2)]) == [make_row(1)]


def test_a_glyph_beyond_the_threshold_leaves_the_marker_unlinked():
    markers = [make_marker(100.0, 200.0)]
    glyphs = [DigitGlyph(100.0, 200.0 + SHOTS_MARKER_RADIUS + 0.1, ordinal=1)]

    assert link_markers(markers, glyphs, [make_row(1)]) == [None]


def test_no_glyphs_at_all_leaves_every_marker_unlinked():
    assert link_markers([make_marker(100.0, 200.0)], [], [make_row(1)]) == [None]


def test_overlapping_markers_recover_a_bijection_instead_of_double_claiming():
    """The real six-yard-box case (M06 away, markers 4/27 under 1 pt apart): both
    markers sit within threshold of the SAME nearest glyph. Independent nearest would
    double-claim and unlink both; the greedy global assignment gives each marker its
    nearest still-available glyph and both link."""
    markers = [make_marker(100.0, 200.0), make_marker(100.6, 200.0)]
    glyphs = [DigitGlyph(100.35, 200.0, ordinal=1), DigitGlyph(101.2, 200.0, ordinal=2)]
    rows = [make_row(1), make_row(2)]

    # Marker 2 is nearer to glyph 1 than marker 1 is, so it wins it; marker 1 takes
    # glyph 2 — a full bijection, no marker sacrificed.
    assert link_markers(markers, glyphs, rows) == [rows[1], rows[0]]


def test_a_duplicate_ordinal_claim_unlinks_both_claimants():
    """Guessing which claimant is right would be a silent wrong join — bijection or
    nothing."""
    markers = [make_marker(100.0, 200.0), make_marker(300.0, 400.0)]
    glyphs = [DigitGlyph(100.0, 200.0, ordinal=1), DigitGlyph(300.0, 400.0, ordinal=1)]

    assert link_markers(markers, glyphs, [make_row(1), make_row(2)]) == [None, None]


def test_an_ordinal_outside_the_row_range_is_unlinked():
    markers = [make_marker(100.0, 200.0), make_marker(300.0, 400.0)]
    glyphs = [DigitGlyph(100.0, 200.0, ordinal=0), DigitGlyph(300.0, 400.0, ordinal=3)]

    assert link_markers(markers, glyphs, [make_row(1), make_row(2)]) == [None, None]


def test_the_outcome_cross_check_demotes_a_contradicted_link():
    """`incomplete-blocked` maps to `blocked`; a goal marker claiming that row is a
    wrong join, not a tolerable variance."""
    markers = [make_marker(100.0, 200.0, outcome="goal")]
    glyphs = [DigitGlyph(100.0, 200.0, ordinal=1)]
    rows = [make_row(1, outcome_detail="incomplete-blocked")]

    assert link_markers(markers, glyphs, rows) == [None]


def test_the_cross_check_accepts_the_non_prefix_mapping():
    markers = [make_marker(100.0, 200.0, outcome="blocked")]
    glyphs = [DigitGlyph(100.0, 200.0, ordinal=1)]
    rows = [make_row(1, outcome_detail="incomplete-blocked")]

    assert link_markers(markers, glyphs, rows) == [rows[0]]


def test_event_fields_join_a_row_and_null_out_when_unlinked():
    row = make_row(3, outcome_detail="on-target-goal")

    linked = event_fields(row)
    assert linked == {
        "linked": True,
        "ordinal": 3,
        "time_raw": 13,
        "shirt_number": 9,
        "player_name": "Test PLAYER",
        "outcome_detail": "on-target-goal",
        "body_part": "right-foot",
        "delivery_type": "pass",
        "expected_goals": None,
    }

    unlinked = event_fields(None)
    assert unlinked["linked"] is False
    assert all(unlinked[field] is None for field in JOINED_FIELDS)
    assert unlinked["expected_goals"] is None


# --- end to end through the parser ------------------------------------------------


def test_default_fixtures_link_every_marker_with_factory_derived_values(
    make_report, tmp_path
):
    with open_report(make_report, tmp_path) as doc:
        shots = parse(doc)

    for team_id, side in (("mexico", "home"), ("south-africa", "away")):
        markers = DEFAULT_SHOTS_MARKERS[side]
        events = team_events(shots, team_id)
        assert len(events) == len(markers)
        assert all(event["linked"] for event in events)
        assert sorted(event["ordinal"] for event in events) == list(
            range(1, len(markers) + 1)
        )
        for event in events:
            expected = expected_join(markers, event["ordinal"])
            assert {field: event[field] for field in JOINED_FIELDS} == expected
            assert event["expected_goals"] is None


def test_a_displaced_label_leaves_the_marker_retained_and_unlinked(make_report, tmp_path):
    """AC 2: the marker keeps coordinates and outcome; only the join is refused."""
    offset = {"home": {0: (0.0, 3 * SHOTS_MARKER_RADIUS)}}
    with open_report(make_report, tmp_path, shots_label_offset=offset) as doc:
        shots = parse(doc)

    home = team_events(shots, "mexico")
    assert len(home) == len(DEFAULT_SHOTS_MARKERS["home"])
    unlinked = [event for event in home if not event["linked"]]
    assert len(unlinked) == 1
    assert unlinked[0]["outcome"] == DEFAULT_SHOTS_MARKERS["home"][0][0]
    assert all(unlinked[0][field] is None for field in JOINED_FIELDS)
    assert [event["linked"] for event in team_events(shots, "south-africa")] == [True]


def test_a_duplicate_printed_ordinal_unlinks_both_markers(make_report, tmp_path):
    """Two same-outcome markers both labeled `1`: nothing disambiguates the claim, so
    both unlink — guessing would be a silent wrong join."""
    markers = {"home": [("off-target", 0.3, 0.3), ("off-target", 0.7, 0.6)], "away": []}
    labels = {"home": {1: "1"}}  # marker 2 also claims "1"
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_label_text=labels
    ) as doc:
        shots = parse(doc)

    assert [event["linked"] for event in team_events(shots, "mexico")] == [False, False]


def test_a_duplicate_ordinal_resolved_by_the_outcome_constraint_links_the_true_marker(
    make_report, tmp_path
):
    """Default home markers are a goal and an off-target; when the off-target's label is
    corrupted to `1`, row 1's outcome (derived from the goal marker) is compatible only
    with the goal — the constraint resolves the duplicate instead of sacrificing both."""
    labels = {"home": {1: "1"}}
    with open_report(make_report, tmp_path, shots_label_text=labels) as doc:
        shots = parse(doc)

    home = {event["outcome"]: event for event in team_events(shots, "mexico")}
    assert home["goal"]["linked"] is True and home["goal"]["ordinal"] == 1
    assert home["off-target"]["linked"] is False


def test_a_corrupted_out_of_range_label_unlinks_its_marker(make_report, tmp_path):
    labels = {"home": {0: "99"}}
    with open_report(make_report, tmp_path, shots_label_text=labels) as doc:
        shots = parse(doc)

    by_linked = {event["linked"] for event in team_events(shots, "mexico")}
    assert by_linked == {True, False}


def test_a_suppressed_label_unlinks_its_marker(make_report, tmp_path):
    labels = {"home": {0: None}}
    with open_report(make_report, tmp_path, shots_label_text=labels) as doc:
        shots = parse(doc)

    home = team_events(shots, "mexico")
    assert [event["linked"] for event in home].count(False) == 1


def test_an_outcome_contradicting_row_unlinks_through_the_parser(make_report, tmp_path):
    """Marker 1 is a goal; its row printed `Off Target` — evidence of a wrong join."""
    overrides = {"home": {0: {"outcome": "Off Target"}}}
    with open_report(make_report, tmp_path, shots_table_cells=overrides) as doc:
        shots = parse(doc)

    home = team_events(shots, "mexico")
    goal = next(event for event in home if event["outcome"] == "goal")
    assert goal["linked"] is False
    other = next(event for event in home if event["outcome"] != "goal")
    assert other["linked"] is True


def test_multi_page_table_ordinals_link_across_the_page_break(make_report, tmp_path):
    """`shots_table_pages={"home": [17, 9]}` reproduces the real overflow: ordinal 18
    lives on the second table page and must still join."""
    markers = {
        "home": [("off-target", 0.06 + 0.035 * i, 0.05 + 0.033 * i) for i in range(26)],
        "away": [],
    }
    with open_report(
        make_report, tmp_path, shots_markers=markers, shots_table_pages={"home": [17, 9]}
    ) as doc:
        shots = parse(doc)

    home = team_events(shots, "mexico")
    assert len(home) == 26
    assert all(event["linked"] for event in home)
    assert sorted(event["ordinal"] for event in home) == list(range(1, 27))
    by_ordinal = {event["ordinal"]: event for event in home}
    assert by_ordinal[18]["time_raw"] == default_attempt_cells(markers["home"], 17)["time"]


# --- Self-Validation completion (extract_report + manifest) -----------------------


def test_link_rate_checks_shape_on_pass():
    events = [
        {
            "team_id": "mexico",
            "outcome": "goal",
            "linked": True,
            "source": {"page_index": 13, "pdf_x": 191.25, "pdf_y": 193.5},
        },
        {
            "team_id": "south-africa",
            "outcome": "off-target",
            "linked": True,
            "source": {"page_index": 20, "pdf_x": 100.0, "pdf_y": 100.0},
        },
    ]

    assert link_rate_checks(events, "Mexico", "South Africa") == [
        {
            "check": "shots-link-rate",
            "team": "home",
            "result": "pass",
            "linked_count": 1,
            "marker_count": 1,
            "unlinked": [],
        },
        {
            "check": "shots-link-rate",
            "team": "away",
            "result": "pass",
            "linked_count": 1,
            "marker_count": 1,
            "unlinked": [],
        },
    ]


def test_link_rate_checks_carry_unlinked_marker_specifics_on_fail():
    events = [
        {
            "team_id": "mexico",
            "outcome": "off-target",
            "linked": False,
            "source": {"page_index": 13, "pdf_x": 234.0, "pdf_y": 230.2},
        },
    ]

    check = link_rate_checks(events, "Mexico", "South Africa")[0]
    assert check["result"] == "fail"
    assert check["linked_count"] == 0
    assert check["marker_count"] == 1
    assert check["unlinked"] == [
        {"outcome": "off-target", "page_index": 13, "pdf_x": 234.0, "pdf_y": 230.2}
    ]


def test_an_unlinkable_marker_fails_self_validation_but_still_extracts(
    make_report, tmp_path
):
    """AC 2 end to end: record produced, marker retained, SV fail with specifics —
    while the marker-count checks still pass (counts agree; only the link failed)."""
    offset = {"home": {0: (0.0, 3 * SHOTS_MARKER_RADIUS)}}
    record = extract_report(
        make_report(tmp_path / f"{REPORT_ID}.pdf", number=7, shots_label_offset=offset)
    )

    assert record["self_validation"]["result"] == "fail"
    link_checks = {
        check["team"]: check
        for check in record["self_validation"]["checks"]
        if check["check"] == "shots-link-rate"
    }
    assert link_checks["home"]["result"] == "fail"
    assert link_checks["home"]["linked_count"] == len(DEFAULT_SHOTS_MARKERS["home"]) - 1
    assert link_checks["home"]["marker_count"] == len(DEFAULT_SHOTS_MARKERS["home"])
    (unlinked,) = link_checks["home"]["unlinked"]
    assert unlinked["outcome"] == DEFAULT_SHOTS_MARKERS["home"][0][0]
    assert {"page_index", "pdf_x", "pdf_y"} <= set(unlinked)
    assert link_checks["away"]["result"] == "pass"
    count_checks = [
        check
        for check in record["self_validation"]["checks"]
        if check["check"] == "shots-marker-count"
    ]
    assert all(check["result"] == "pass" for check in count_checks)


def test_the_unlinked_specifics_reach_the_run_manifest(make_report, tmp_path):
    """FR-14's manifest specifics: the unlinked-marker list is mirrored, and the run
    fails without inflating failed_count (the record exists and was written)."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / f"{REPORT_ID}.pdf",
        number=7,
        shots_label_offset={"home": {0: (0.0, 3 * SHOTS_MARKER_RADIUS)}},
    )

    manifest = run_batch(
        corpus,
        output_path=tmp_path / "work" / "run-manifest.json",
        extracted_dir=tmp_path / "work" / "extracted",
    )

    (entry,) = manifest["reports"]
    assert entry["status"] == "extracted"
    assert entry["self_validation"] == "fail"
    link_failures = [
        check
        for check in entry["self_validation_failures"]
        if check["check"] == "shots-link-rate"
    ]
    assert len(link_failures) == 1
    (unlinked,) = link_failures[0]["unlinked"]
    assert unlinked["outcome"] == DEFAULT_SHOTS_MARKERS["home"][0][0]
    assert manifest["run"]["result"] == "fail"
    assert manifest["run"]["failed_count"] == 0
    assert manifest["run"]["self_validation_fail_count"] == 1


# --- the FR-15 gate seam ----------------------------------------------------------


def test_a_link_rate_deviation_flows_into_the_gate_report(make_report, tmp_path):
    """Story 1.4's AC-3 seam: the registered check reaches the report without runner or
    format changes; category is count-mismatch and the specifics carry the rate."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / f"{REPORT_ID}.pdf",
        number=7,
        shots_label_offset={"home": {0: (0.0, 3 * SHOTS_MARKER_RADIUS)}},
    )

    report = run_verification(corpus)

    assert "marker-event-link-rate" in report["checks_run"]
    deviations = [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == "marker-event-link-rate"
    ]
    assert len(deviations) == 1
    assert deviations[0]["category"] == "count-mismatch"
    expected_rate = (
        f"home: {len(DEFAULT_SHOTS_MARKERS['home']) - 1}/"
        f"{len(DEFAULT_SHOTS_MARKERS['home'])} markers linked"
    )
    assert expected_rate in deviations[0]["specifics"]
    assert "unlinked:" in deviations[0]["specifics"]


def test_a_fully_linked_report_emits_no_link_rate_deviation(make_report, tmp_path):
    """AC 4's clean reading: the deviation framework records only departures, so a
    100%-linked report contributes zero link-rate deviations to the summary."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / f"{REPORT_ID}.pdf", number=7)

    report = run_verification(corpus)

    assert "marker-event-link-rate" in report["checks_run"]
    assert all(
        deviation["check"] != "marker-event-link-rate"
        for entry in report["reports"]
        for deviation in entry["deviations"]
    )


# --- ground truth (table values are legitimate; lifted coordinates are not, AR-16) --


@pytest.fixture(scope="module")
def ground_truth_shots(mex_rsa_pdf) -> dict:
    with pymupdf.open(mex_rsa_pdf) as doc:
        anchors = shots_anchors(doc, report_id="mex_rsa")
        return parse_shots(doc, anchors, "mex_rsa", "Mexico", "South Africa")


def test_ground_truth_links_every_marker_on_both_maps(ground_truth_shots):
    """AC 3: 16/16 home + 3/3 away, ordinals a clean bijection onto the table rows."""
    home = team_events(ground_truth_shots, "mexico")
    away = team_events(ground_truth_shots, "south-africa")

    assert len(home) == 16 and all(event["linked"] for event in home)
    assert len(away) == 3 and all(event["linked"] for event in away)
    assert sorted(event["ordinal"] for event in home) == list(range(1, 17))
    assert sorted(event["ordinal"] for event in away) == list(range(1, 4))


def test_ground_truth_spot_checked_rows_join_correctly(ground_truth_shots):
    home = {event["ordinal"]: event for event in team_events(ground_truth_shots, "mexico")}
    away = {
        event["ordinal"]: event
        for event in team_events(ground_truth_shots, "south-africa")
    }

    first = home[1]
    assert first["time_raw"] == 3
    assert first["shirt_number"] == 26
    assert first["player_name"] == "Brian GUTIERREZ"
    assert first["outcome_detail"] == "incomplete-blocked"
    assert first["outcome"] == "blocked"
    assert first["body_part"] == "right-foot"
    assert first["delivery_type"] == "free-kick"

    opener = home[3]
    assert opener["time_raw"] == 8
    assert opener["player_name"] == "Julian QUINONES"
    assert opener["outcome_detail"] == "on-target-goal"
    assert opener["outcome"] == "goal"

    last = home[16]
    assert last["time_raw"] == 66
    assert last["player_name"] == "Raul JIMENEZ"
    assert last["outcome_detail"] == "on-target-goal"
    assert last["outcome"] == "goal"
    assert last["body_part"] == "head"
    assert last["delivery_type"] == "cross"

    away_first = away[1]
    assert away_first["time_raw"] == 37
    assert away_first["player_name"] == "Lyle FOSTER"
    assert away_first["outcome_detail"] == "off-target"
    assert away_first["body_part"] == "head"
    assert away_first["delivery_type"] == "pass"


def test_ground_truth_emits_null_expected_goals_on_every_shot(ground_truth_shots):
    """The contract's corpus-verified decision: the shots table has no xG column, so v1
    emits null per shot — the ground-truth assertion for xG IS that it is null."""
    events = ground_truth_shots["shot_events"]

    assert events
    assert all(event["expected_goals"] is None for event in events)

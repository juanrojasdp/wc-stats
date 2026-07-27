"""Domain G at the Extraction Record and FR-15 gate seams (Story 1.10, AC 1-3).

`test_extract_domain_g.py` owns the parser; this module owns the two seams it plugs
into — `domains["player_stats"]` plus the appended self-validation checks, and the
`domain-g-completeness` / `domain-g-counts` gate pair — plus the real-PDF ground truth.

`clean_registry` is defined locally, following `test_checks_registry.py` and
`test_runner.py`: it is not a conftest fixture.
"""

from __future__ import annotations

import json
from pathlib import Path

import pymupdf
import pytest

from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.probe import probe_report
from pipeline.discover.text import PageTextIndex
from pipeline.extract.domain_a import extract_domain_a
from pipeline.extract.domain_g import extract_domain_g
from pipeline.extract.errors import MissingFieldError, PlayerJoinError
from pipeline.ingest.batch import run_batch
from pipeline.ingest.extract_report import extract_report
from pipeline.ingest.records import serialize_record, write_record
from pipeline.tests.conftest import DEFAULT_OFFERS, default_key_statistics
from pipeline.validate.checks import CHECK_REGISTRY, registered_checks
from pipeline.validate.deviations import DeviationCategory
from pipeline.validate.runner import run_verification

DOMAIN_G_CHECK_IDS = (
    "domain-g-zone-sum",
    "domain-g-internal-consistency",
    "domain-g-distance-reconciliation",
    "domain-g-goals-reconciliation",
)


@pytest.fixture
def clean_registry():
    """Restore the registry after a test registers its own check (local by convention)."""
    saved = list(CHECK_REGISTRY)
    yield
    CHECK_REGISTRY[:] = saved


def _deviations(report, check_id):
    return [
        deviation
        for entry in report["reports"]
        for deviation in entry["deviations"]
        if deviation["check"] == check_id
    ]


def _distance_mismatch_report(make_report, path, *, number=7, home="Mexico", away="South Africa"):
    """A report whose per-player metres do NOT reconcile with its printed team total.

    The factory derives the Domain G rows FROM the Key Statistics block, so doctoring
    `distance_covered` alone keeps the two in step. The rows are therefore generated
    against the honest block first and pinned via `player_stats_rows`, and only then is
    the printed team total moved out from under them — which is exactly the real-world
    failure this check exists to catch, and it leaves every other check green.
    """
    from pipeline.tests.conftest import default_lineup_sides, default_player_stats_rows

    stats = default_key_statistics()
    rows = default_player_stats_rows(default_lineup_sides(home, away, 2, 0), stats)
    stats["home"]["distance_covered"] = 200.0
    return make_report(
        path,
        number=number,
        home=home,
        away=away,
        key_statistics=stats,
        player_stats_rows={"home": rows["home"]},
    )


# --- the record seam (AC 1, AC 2) -------------------------------------------------


def test_the_record_carries_the_domain_g_payload(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    player_stats = record["domains"]["player_stats"]
    lineups = record["domains"]["match_metadata"]["lineups"]
    assert set(player_stats) == {"home", "away"}
    for side in ("home", "away"):
        # Derived from the parsed lineup, never a hardcoded count: every starter plus
        # every substitute the page stamped a sub-on minute on.
        expected = [entry["name"] for entry in lineups[side]["starters"]] + [
            entry["name"]
            for entry in lineups[side]["substitutes"]
            if entry["substituted_on"] is not None
        ]
        assert [player["name"] for player in player_stats[side]] == expected
        assert player_stats[side], "a side with minutes must carry rows"


def test_unused_substitutes_are_absent_from_the_payload_and_from_the_warnings(
    tmp_path, make_report
):
    """AC 1's asymmetry, end to end: not a finding, not a warning, just absent."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    lineups = record["domains"]["match_metadata"]["lineups"]
    named = {player["name"] for player in record["domains"]["player_stats"]["home"]}
    unused = [
        entry["name"]
        for entry in lineups["home"]["substitutes"]
        if entry["substituted_on"] is None
    ]

    assert unused, "the default fixture must carry unused substitutes to prove this"
    assert not (named & set(unused))
    assert not any("player_stats" in warning for warning in record["warnings"])
    assert record["self_validation"]["result"] == "pass"


def test_domain_g_checks_append_to_self_validation_without_replacing_it(
    tmp_path, make_report
):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    check_ids = [check["check"] for check in record["self_validation"]["checks"]]
    assert check_ids.count("shots-marker-count") == 2  # Story 1.3's still open the list
    assert "domain-a-starters-count" in check_ids  # and 1.6's still follow
    for check_id in DOMAIN_G_CHECK_IDS:
        assert check_ids.count(check_id) == 1
    # Appended after every existing appender.
    assert check_ids.index("domain-g-zone-sum") > check_ids.index("domain-a-starters-count")
    assert record["self_validation"]["result"] == "pass"


def test_the_payload_keys_are_snake_case_throughout(tmp_path, make_report):
    """No `/contract` dependency: staging is snake_case, and 1.2's record walk holds."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                assert key == key.lower() and "-" not in key, key
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(record["domains"]["player_stats"])


def test_a_failed_domain_g_check_fails_the_record_but_still_produces_it(
    tmp_path, make_report
):
    """AD-8 / SM-C1: a consistency-check failure is data, not an exception."""
    record = extract_report(
        _distance_mismatch_report(make_report, tmp_path / "PMSR-M07-AAA-V-BBB.pdf")
    )

    assert record["self_validation"]["result"] == "fail"
    failed = {
        check["check"]
        for check in record["self_validation"]["checks"]
        if check["result"] == "fail"
    }
    assert failed == {"domain-g-distance-reconciliation"}
    assert record["domains"]["player_stats"]["home"], "the payload still stages"


def test_a_typed_domain_g_error_propagates_as_itself_and_the_batch_carries_on(
    tmp_path, make_report
):
    """Task 6.4: the batch manifest needs the real class name, never a relabeling."""
    from pipeline.tests.conftest import default_lineup_sides, default_player_stats_rows

    sides = default_lineup_sides("Charlie", "Delta", 2, 0)
    rows = default_player_stats_rows(sides, default_key_statistics())
    rows["home"][0] = {**rows["home"][0], "name": "Ghost PLAYER"}

    pdf = make_report(
        tmp_path / "PMSR-M02-CHA-V-DEL.pdf",
        number=2,
        home="Charlie",
        away="Delta",
        player_stats_rows={"home": rows["home"]},
    )
    with pytest.raises(PlayerJoinError, match="Ghost PLAYER"):
        extract_report(pdf)

    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")
    make_report(
        corpus / "PMSR-M02-CHA-V-DEL.pdf",
        number=2,
        home="Charlie",
        away="Delta",
        player_stats_rows={"home": rows["home"]},
    )
    manifest = run_batch(
        corpus, output_path=None, extracted_dir=tmp_path / "work" / "extracted"
    )

    entries = {entry["report_id"]: entry for entry in manifest["reports"]}
    assert entries["PMSR-M01-ALP-V-BRA"]["status"] == "extracted"
    assert entries["PMSR-M02-CHA-V-DEL"]["status"] == "failed"
    assert entries["PMSR-M02-CHA-V-DEL"]["error_type"] == "PlayerJoinError"


def test_a_player_with_minutes_and_no_row_fails_the_report(tmp_path, make_report):
    from pipeline.tests.conftest import default_lineup_sides, default_player_stats_rows

    sides = default_lineup_sides("Mexico", "South Africa", 2, 0)
    rows = default_player_stats_rows(sides, default_key_statistics())
    dropped = rows["home"][-1]["name"]

    pdf = make_report(
        tmp_path / "PMSR-M07-AAA-V-BBB.pdf",
        number=7,
        player_stats_rows={"home": rows["home"][:-1]},
    )

    with pytest.raises(MissingFieldError, match=dropped):
        extract_report(pdf)


# --- determinism (AD-9) -----------------------------------------------------------


def test_extracting_the_same_report_twice_is_byte_identical(tmp_path, make_report):
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    first = write_record(extract_report(pdf), tmp_path / "staged-a")
    second = write_record(extract_report(pdf), tmp_path / "staged-b")

    assert first.read_bytes() == second.read_bytes()
    assert b"player_stats" in first.read_bytes()


def test_the_record_stays_free_of_absolute_paths_with_domain_g_present(
    tmp_path, make_report
):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))
    text = serialize_record(record)

    assert str(tmp_path) not in text
    assert tmp_path.as_posix() not in text


# --- the FR-15 gate (Task 6, AC 3) ------------------------------------------------


def test_domain_g_gate_checks_are_registered():
    check_ids = {check.check_id for check in registered_checks()}

    assert {"domain-g-completeness", "domain-g-counts"} <= check_ids


def test_a_clean_report_yields_no_domain_g_deviations(tmp_path, make_report):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    report = run_verification(corpus)

    assert "domain-g-completeness" in report["checks_run"]
    assert "domain-g-counts" in report["checks_run"]
    assert _deviations(report, "domain-g-completeness") == []
    assert _deviations(report, "domain-g-counts") == []


def test_a_join_failure_lands_in_the_probe_failure_bucket_naming_player_and_side(
    tmp_path, make_report
):
    """AC 3: join integrity reaches the deviation summary through this path."""
    from pipeline.tests.conftest import default_lineup_sides, default_player_stats_rows

    sides = default_lineup_sides("Alpha", "Bravo", 2, 0)
    rows = default_player_stats_rows(sides, default_key_statistics())
    rows["home"][0] = {**rows["home"][0], "name": "Ghost PLAYER"}
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        player_stats_rows={"home": rows["home"]},
    )

    report = run_verification(corpus)

    found = _deviations(report, "domain-g-completeness")
    assert found, "expected a domain-g-completeness deviation"
    assert all(
        deviation["category"] == DeviationCategory.PROBE_FAILURE for deviation in found
    )
    assert any("PlayerJoinError" in deviation["specifics"] for deviation in found)
    assert any("Ghost PLAYER" in deviation["specifics"] for deviation in found)
    assert any("home" in deviation["specifics"] for deviation in found)
    # The counts check stays silent over a failed extract: one root cause, one finding.
    assert _deviations(report, "domain-g-counts") == []


def test_a_failed_consistency_check_lands_in_the_count_mismatch_bucket(
    tmp_path, make_report
):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    _distance_mismatch_report(
        make_report,
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
    )

    report = run_verification(corpus)

    found = _deviations(report, "domain-g-counts")
    assert found, "expected a domain-g-counts deviation"
    assert all(
        deviation["category"] == DeviationCategory.COUNT_MISMATCH for deviation in found
    )
    assert any(
        "domain-g-distance-reconciliation" in deviation["specifics"] for deviation in found
    )


def test_a_missing_domain_g_anchor_is_only_anchor_coverages_finding(
    tmp_path, make_report
):
    """Never double-reported: the anchor miss belongs to `anchor-coverage` alone."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        drop_anchor_ids=("physical-data:home",),
    )

    report = run_verification(corpus)

    anchor_findings = _deviations(report, "anchor-coverage")
    assert any("physical-data" in dev["specifics"] for dev in anchor_findings)
    assert _deviations(report, "domain-g-completeness") == []
    assert _deviations(report, "domain-g-counts") == []


def test_a_domain_a_failure_is_not_re_reported_under_a_domain_g_id(
    tmp_path, make_lineup_report
):
    """Domain G joins to Domain A's lineups, so a Domain A failure blocks it — but that
    failure is `domain-a-completeness`'s finding, not this domain's (the 1.6 patch)."""
    from pipeline.tests.conftest import lineup_side

    off_legend = lineup_side("Alpha")
    off_legend["starters"][3]["markers"] = [((0.5, 0.5, 0.5), "55'")]
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_lineup_report(
        corpus / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        home_side=off_legend,
    )

    report = run_verification(corpus)

    assert _deviations(report, "domain-a-completeness"), "Domain A owns this failure"
    assert _deviations(report, "domain-g-completeness") == []
    assert _deviations(report, "domain-g-counts") == []


def test_the_gate_still_extends_without_editing_the_runner(tmp_path, make_report, clean_registry):
    """The seam `test_runner.py` guarantees, re-proved with Domain G registered."""
    from pipeline.validate.checks import Check, register_check
    from pipeline.validate.deviations import Deviation

    register_check(
        Check(
            check_id="domain-g-probe-check",
            applies_to=lambda meta: True,
            run=lambda doc, meta: [
                Deviation(
                    report_id=meta.report_id,
                    check="domain-g-probe-check",
                    category=DeviationCategory.COUNT_MISMATCH,
                    specifics="registered after Domain G",
                )
            ],
        )
    )
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    report = run_verification(corpus)

    assert "domain-g-probe-check" in report["checks_run"]
    assert "domain-g-completeness" in report["checks_run"]


# --- real-PDF ground truth (Task 7.4, AR-16) --------------------------------------


def _ground_truth_bundle(mex_rsa_pdf: Path):
    """Everything the ground-truth tests need, from ONE pass over the reference report.

    Probing, indexing and resolving every anchor in the registry is the expensive part;
    doing it a second time to reach one more extractor would double the work over the
    largest input in the suite for nothing.
    """
    from pipeline.extract.domain_b import extract_domain_b

    meta = probe_report(mex_rsa_pdf)
    doc = pymupdf.open(mex_rsa_pdf)
    index = PageTextIndex(doc, meta.report_id)
    anchors = {}
    for anchor in resolve_anchors(ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team):
        anchors[anchor.anchor_id] = index.find_all(
            anchor.text, at_start=anchor.at_page_start
        )
    metadata = {
        "home_team": meta.home_team,
        "away_team": meta.away_team,
        "home_score": meta.home_score,
        "away_score": meta.away_score,
        "stage_text": meta.stage_text,
        "match_date": meta.match_date.isoformat(),
        "kickoff": meta.kickoff,
        "venue": meta.venue,
        "shootout": meta.shootout,
    }
    domain_a = extract_domain_a(doc, metadata, anchors, report_id=meta.report_id)
    payload = extract_domain_g(doc, anchors, domain_a["lineups"], report_id=meta.report_id)
    key_statistics = extract_domain_b(
        doc, anchors, meta.report_id, meta.home_team, meta.away_team
    )
    doc.close()
    return payload, domain_a["lineups"], key_statistics


def _ground_truth_payload(mex_rsa_pdf: Path):
    payload, lineups, _key_statistics = _ground_truth_bundle(mex_rsa_pdf)
    return payload, lineups


def test_the_ground_truth_report_lists_every_player_who_took_the_field(mex_rsa_pdf):
    payload, lineups = _ground_truth_payload(mex_rsa_pdf)

    for side in ("home", "away"):
        # Derived from the parsed lineup, never a magic number (1.6 / 1.7 review rule).
        expected = [entry["name"] for entry in lineups[side]["starters"]] + [
            entry["name"]
            for entry in lineups[side]["substitutes"]
            if entry["substituted_on"] is not None
        ]
        assert [player["name"] for player in payload[side]] == expected
    # 11 starters + 5 on for Mexico, 11 + 4 for South Africa.
    assert len(payload["home"]) == 16
    assert len(payload["away"]) == 15


def test_the_ground_truth_row_matches_the_printed_page(mex_rsa_pdf):
    payload, _lineups = _ground_truth_payload(mex_rsa_pdf)
    [rangel] = [p for p in payload["home"] if p["shirt_number"] == 1]

    assert rangel["name"] == "Raul RANGEL"
    assert rangel["position"] == "gk"
    assert rangel["in_possession"] == {
        "passes_attempted": 33, "passes_completed": 29, "pass_completion": 88.0,
        "switches_of_play": 1, "crosses_attempted": 0, "crosses_completed": 0,
        "line_breaks_attempted": 13, "line_breaks_completed": 10,
        "line_break_completion": 77.0, "ball_progressions": 0, "take_ons": 0,
        "step_ins": 0, "attempts_at_goal": 0, "goals": 0,
        "total_offers": 13,
        "offers_by_movement_type": {
            "in_front": 0, "in_between": 0, "out_to_in": 0, "in_to_out": 0,
            "in_behind": 0, "no_movement": 13,
        },
        "offers_received": 4,
    }
    assert rangel["out_of_possession"] == {
        "tackles_made": 0, "tackles_won": 0, "blocks": 0, "interceptions": 0,
        "pressing_direct": 0, "pressing_indirect": 0, "duels_won_aerial": 0,
        "duels_won_physical": 0, "possession_contests_won": 0, "clearances": 0,
        "loose_ball_receptions": 5, "pushing_on": 0, "pushing_on_into_pressing": 0,
        "possession_regains": 6, "possession_interrupted": 0,
    }
    assert rangel["physical"] == {
        "total_distance": 5476.4, "distance_zone_1": 4175.3, "distance_zone_2": 1076.4,
        "distance_zone_3": 200.9, "distance_zone_4": 23.7, "distance_zone_5": 0.0,
        "high_speed_runs": 18, "sprints": 3, "top_speed": 23.2,
    }


def test_the_ground_truth_outfield_physical_row_matches_the_printed_page(mex_rsa_pdf):
    payload, _lineups = _ground_truth_payload(mex_rsa_pdf)
    [vasquez] = [p for p in payload["home"] if p["shirt_number"] == 5]

    assert vasquez["name"] == "Johan VASQUEZ"
    assert vasquez["physical"] == {
        "total_distance": 10046.9, "distance_zone_1": 4107.2, "distance_zone_2": 4232.8,
        "distance_zone_3": 1151.6, "distance_zone_4": 455.2, "distance_zone_5": 100.2,
        "high_speed_runs": 102, "sprints": 33, "top_speed": 27.9,
    }


def test_the_ground_truth_physical_block_matches_the_committed_fixture(
    mex_rsa_pdf, repo_root
):
    """`data/fixtures/README.md`: Domain G *physical* is REAL, hand-transcribed from the
    `Physical Data {team}` pages — a second independent transcription of the same page.

    Eight of the nine fields agree EXACTLY on all 31 fixture players, which is the
    strongest available proof that the right-aligned physical columns are assigned to the
    right fields. `totalDistance` is deliberately excluded and pinned separately below:
    the fixture's value is whole-metre on 30 of 31 players and disagrees with the printed
    total AND with the fixture's own zone sum, so it was synthesized rather than
    transcribed (AD-14 note filed — a fixture-data finding, not a parser or contract one).
    """
    fixture_paths = sorted((repo_root / "data" / "fixtures" / "matches").glob("m001-*.json"))
    if not fixture_paths:
        pytest.skip("m001 fixture bundle not present")
    bundle = json.loads(fixture_paths[0].read_text(encoding="utf-8"))
    players = bundle.get("players")
    if not players:
        pytest.skip("m001 fixture carries no players block")

    payload, _lineups = _ground_truth_payload(mex_rsa_pdf)
    parsed = {
        (player["shirt_number"], player["name"]): player["physical"]
        for side in ("home", "away")
        for player in payload[side]
    }
    transcribed = {
        "distanceZone1": "distance_zone_1",
        "distanceZone2": "distance_zone_2",
        "distanceZone3": "distance_zone_3",
        "distanceZone4": "distance_zone_4",
        "distanceZone5": "distance_zone_5",
        "highSpeedRuns": "high_speed_runs",
        "sprints": "sprints",
        "topSpeed": "top_speed",
    }
    compared = 0
    matched_players = 0
    for record in players:
        key = (record["shirtNumber"], record["playerName"])
        if key not in parsed or "physical" not in record:
            continue
        matched_players += 1
        for camel, snake in transcribed.items():
            if camel in record["physical"]:
                assert parsed[key][snake] == pytest.approx(
                    record["physical"][camel]
                ), f"{key} {snake}"
                compared += 1
    assert matched_players == len(players), "every fixture player must join a parsed row"
    assert compared == matched_players * len(transcribed)


def test_the_fixture_total_distance_is_the_known_divergence_not_the_printed_value(
    mex_rsa_pdf, repo_root
):
    """Pins the finding above so it cannot silently become a parser regression.

    The parser reports what the page prints (`5476.4` for Raul RANGEL); the committed
    fixture carries `5476.0`, which does not even reconstruct from the fixture's own
    zones (4175.3 + 1076.4 + 200.9 + 23.7 + 0 = 5476.3). If a future fixture refresh
    fixes `totalDistance`, this test fails and is deleted — that is the point of it.
    """
    fixture_paths = sorted((repo_root / "data" / "fixtures" / "matches").glob("m001-*.json"))
    if not fixture_paths:
        pytest.skip("m001 fixture bundle not present")
    bundle = json.loads(fixture_paths[0].read_text(encoding="utf-8"))
    players = bundle.get("players")
    if not players:
        pytest.skip("m001 fixture carries no players block")
    payload, _lineups = _ground_truth_payload(mex_rsa_pdf)
    parsed = {
        (player["shirt_number"], player["name"]): player["physical"]
        for side in ("home", "away")
        for player in payload[side]
    }

    matched = [
        record
        for record in players
        if (record["shirtNumber"], record["playerName"]) in parsed
    ]
    assert matched, "no fixture player joined a parsed row"

    diverging = [
        (record["shirtNumber"], record["playerName"])
        for record in matched
        if parsed[(record["shirtNumber"], record["playerName"])]["total_distance"]
        != record["physical"]["totalDistance"]
    ]

    # Pin the SHAPE of the divergence, derived from the fixture rather than a literal
    # count (the 1.6 / 1.7 review rule). Three properties, each independently meaningful:
    #
    #  1. every fixture total is whole-metre valued, while the page prints one decimal —
    #     the signature of a synthesized value, not a transcribed one;
    #  2. the disagreement is small, so this is a rounding-shaped defect and not a
    #     column-assignment error on our side;
    #  3. at most one player agrees, i.e. this is corpus-wide for the fixture and not a
    #     handful of stragglers.
    #
    # A fixture refresh that corrects `totalDistance` empties `diverging` and trips the
    # last assertion, which is the point of the test.
    assert all(
        float(record["physical"]["totalDistance"]).is_integer() for record in matched
    )
    deltas = [
        parsed[(record["shirtNumber"], record["playerName"])]["total_distance"]
        - record["physical"]["totalDistance"]
        for record in matched
    ]
    assert all(abs(delta) <= 5.0 for delta in deltas), deltas
    assert len(diverging) >= len(matched) - 1
    assert diverging, "the known fixture divergence has disappeared — delete this test"
    # Every parsed total does reconstruct from its own printed zones, which is what the
    # zone-sum check asserts on every report — the divergence is the fixture's, not ours.
    for side in ("home", "away"):
        for player in payload[side]:
            physical = player["physical"]
            zones = sum(physical[f"distance_zone_{zone}"] for zone in range(1, 6))
            assert abs(physical["total_distance"] - zones) <= 0.35


def test_every_recorded_check_passes_on_the_ground_truth_report(mex_rsa_pdf):
    from pipeline.extract.domain_g import domain_g_checks

    payload, lineups, key_statistics = _ground_truth_bundle(mex_rsa_pdf)

    checks = domain_g_checks(payload, key_statistics=key_statistics, lineups=lineups)

    assert [check["check"] for check in checks] == list(DOMAIN_G_CHECK_IDS)
    assert all(check["result"] == "pass" for check in checks), [
        check for check in checks if check["result"] != "pass"
    ]


def test_the_offers_page_is_extracted_even_though_section_6_never_names_it(mex_rsa_pdf):
    """The one whole page the addendum's prose omits; `PlayerInPossession` requires it."""
    payload, _lineups = _ground_truth_payload(mex_rsa_pdf)
    [rangel] = [p for p in payload["home"] if p["shirt_number"] == 1]

    assert rangel["in_possession"]["total_offers"] == 13
    assert sum(rangel["in_possession"]["offers_by_movement_type"].values()) == 13
    assert len(DEFAULT_OFFERS) == 8  # the family's invariant column count

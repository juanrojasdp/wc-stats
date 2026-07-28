"""Story 1.9, Tasks 6-9: Domains E/F wired into the Extraction Record and the FR-15 gate.

Synthetic full reports come from `make_report`, which now draws parseable goalkeeping and
set-plays pages on every report. Byte-identity asserts on real bytes (`read_bytes`), never
on parsed dicts (the Story 1.2 review rule), and the gate tests use a LOCAL
`clean_registry` fixture rather than a conftest one, copying the established pattern.
"""

from __future__ import annotations

import pytest

from pipeline.extract.domain_e import DOCUMENTED_ABSENCES
from pipeline.ingest.extract_report import extract_report
from pipeline.ingest.records import serialize_record, write_record
from pipeline.validate.checks import CHECK_REGISTRY, registered_checks
from pipeline.validate.deviations import DeviationCategory
from pipeline.validate.runner import run_verification

DOMAIN_E_CHECK_IDS = (
    "goalkeeping-distribution-sum",
    "goalkeeping-distribution-printed",
    "goalkeeping-goal-prevention-sum",
    "goalkeeping-aerial-sum",
    "goalkeeping-involvement-bound",
)
DOMAIN_F_CHECK_IDS = ("set-plays-corner-sides", "set-plays-totals")
GATE_CHECK_IDS = (
    "goalkeeping-completeness",
    "goalkeeping-counts",
    "set-plays-completeness",
    "set-plays-counts",
)


@pytest.fixture
def clean_registry():
    """Restore the global check registry after any test that runs a verification.

    A LOCAL fixture, deliberately — `test_checks_registry.py` and `test_runner.py` each
    carry their own copy, and a shared conftest one would let a registry mutation in any
    file leak into every other. Every test below that calls `run_verification` requests
    it; without that the four deviation-category tests ran against the live registry and
    the fixture was dead code asserting nothing.
    """
    snapshot = list(CHECK_REGISTRY)
    yield
    CHECK_REGISTRY[:] = snapshot


def _deviations(report: dict) -> "list[dict]":
    """Every deviation in a verification report, flattened across its per-report entries."""
    return [
        deviation for entry in report["reports"] for deviation in entry["deviations"]
    ]


# --- Task 6: the record seam ---------------------------------------------------------


def test_the_record_carries_both_new_domain_blocks(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    for key in ("goalkeeping", "set_plays"):
        assert key in record["domains"]
        assert set(record["domains"][key]) == {"home", "away"}


def test_the_goalkeeping_block_is_per_team_not_per_goalkeeper(tmp_path, make_report):
    """AC 1's re-scope: no goalkeeping page names a keeper, so the keeper(s) with minutes
    ride ALONGSIDE the team block rather than keying it."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    home = record["domains"]["goalkeeping"]["home"]
    assert isinstance(home["goalkeepers"], list)
    assert "distribution" in home and "goal_prevention" in home and "aerial_control" in home


def test_the_seven_checks_append_after_every_existing_appender(tmp_path, make_report):
    """Task 6.1: this story's seven ids APPEND — never replacing the list, never
    reordering another domain's entries.

    Asserted as a contiguous block preceded by the pre-1.9 appenders, NOT as the list's
    tail. Story 1.14 appends three `pass-network-*` ids after these, which is exactly what
    "domain stories compose without clobbering one another" is supposed to allow; pinning
    `ids[-7:]` made this test fail on a later story doing the right thing.
    """
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    ids = [check["check"] for check in record["self_validation"]["checks"]]
    ours = list(DOMAIN_E_CHECK_IDS) + list(DOMAIN_F_CHECK_IDS)
    start = ids.index(ours[0])
    assert ids[start : start + len(ours)] == ours
    # Everything before the block is another domain's, and every earlier appender ran.
    assert start > 0
    assert not set(ids[:start]) & set(ours)
    assert ids[0].startswith("shots")


def test_a_clean_synthetic_report_self_validates(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    failed = [
        check for check in record["self_validation"]["checks"] if check["result"] != "pass"
    ]
    assert failed == []
    assert record["self_validation"]["result"] == "pass"


def test_the_three_documented_absences_travel_as_warnings(tmp_path, make_report):
    """AC 4: `null` plus one warning each — never a non-"pass" check, which the strictly
    binary aggregator would read as a failure of a merely incomplete report."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    for field, _reason in DOCUMENTED_ABSENCES:
        matching = [w for w in record["warnings"] if field in w]
        assert len(matching) == 1, field
    ids = {check["check"] for check in record["self_validation"]["checks"]}
    assert not any("technique" in check_id or "body-type" in check_id for check_id in ids)


def test_a_failing_consistency_check_still_stages_the_record(tmp_path, make_report):
    """AD-8: recorded checks are data, not exceptions — the record stages so the gate can
    localize it."""
    from pipeline.tests.conftest import default_set_plays_block

    block = default_set_plays_block("home")
    block["total_corners"] = block["total_corners"] + 4
    pdf = make_report(
        tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, set_plays_block={"home": block}
    )

    record = extract_report(pdf)

    assert record["self_validation"]["result"] == "fail"
    failed = {
        check["check"]
        for check in record["self_validation"]["checks"]
        if check["result"] == "fail"
    }
    assert "set-plays-corner-sides" in failed


def test_every_new_record_key_is_snake_case(tmp_path, make_report):
    """Story 1.2's `test_record_keys_are_snake_case` walk must pass unmodified; this
    asserts the same rule locally so a kebab slip is caught in this story's own file."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                assert key == key.lower() and "-" not in key, key
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(record["domains"]["goalkeeping"])
    walk(record["domains"]["set_plays"])


def test_extracting_the_same_report_twice_is_byte_identical(tmp_path, make_report):
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    first = extract_report(pdf)
    second = extract_report(pdf)

    assert serialize_record(first).encode("utf-8") == serialize_record(second).encode("utf-8")
    first_path = write_record(first, tmp_path / "staged-a")
    second_path = write_record(second, tmp_path / "staged-b")
    assert first_path.read_bytes() == second_path.read_bytes()


# --- Task 7: the FR-15 gate ------------------------------------------------------------


def test_the_four_gate_ids_are_registered():
    ids = [check.check_id for check in registered_checks()]

    for check_id in GATE_CHECK_IDS:
        assert check_id in ids
    # Task 7.6: `offers-count-match` is test_checks_registry's unclaimed placeholder and
    # must stay unclaimed — `register_check` raises on duplicates.
    assert "offers-count-match" not in ids


def test_a_clean_report_produces_no_ef_deviations(tmp_path, make_report):
    make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    report = run_verification(tmp_path)

    ours = [d for d in _deviations(report) if d["check"] in GATE_CHECK_IDS]
    assert ours == []
    for check_id in GATE_CHECK_IDS:
        assert check_id in report["checks_run"]


def test_a_parse_failure_lands_in_probe_failure(tmp_path, make_report, clean_registry):
    """Task 7.3's closed mapping: every typed parse/typing/completeness failure is a
    `probe-failure` naming the typed class."""
    make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, goal_prevention_header=False)

    report = run_verification(tmp_path)

    ours = [d for d in _deviations(report) if d["check"] == "goalkeeping-completeness"]
    assert len(ours) == 1
    assert ours[0]["category"] == DeviationCategory.PROBE_FAILURE
    assert ours[0]["specifics"].startswith("GoalkeepingPageParseError:")


def test_a_set_plays_parse_failure_lands_in_probe_failure(tmp_path, make_report, clean_registry):
    make_report(
        tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, set_plays_omit_labels=("indirect",)
    )

    report = run_verification(tmp_path)

    ours = [d for d in _deviations(report) if d["check"] == "set-plays-completeness"]
    assert len(ours) == 1
    assert ours[0]["category"] == DeviationCategory.PROBE_FAILURE
    assert ours[0]["specifics"].startswith("SetPlaysParseError:")


def test_an_off_palette_distribution_marker_lands_in_unknown_rgb(tmp_path, make_report, clean_registry):
    make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, gk_distribution_off_palette=True)

    report = run_verification(tmp_path)

    ours = [d for d in _deviations(report) if d["check"] == "goalkeeping-completeness"]
    assert len(ours) == 1
    assert ours[0]["category"] == DeviationCategory.UNKNOWN_RGB
    assert "goalkeeping palette" in ours[0]["specifics"]


def test_a_failed_consistency_check_lands_in_count_mismatch(tmp_path, make_report, clean_registry):
    from pipeline.tests.conftest import default_set_plays_block

    block = default_set_plays_block("away")
    block["total_corners"] = block["total_corners"] + 2
    make_report(
        tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, set_plays_block={"away": block}
    )

    report = run_verification(tmp_path)

    ours = [d for d in _deviations(report) if d["check"] == "set-plays-counts"]
    assert ours, "a failed set-plays check must surface as a gate deviation"
    assert all(d["category"] == DeviationCategory.COUNT_MISMATCH for d in ours)


def test_a_completeness_failure_is_not_double_reported_by_the_counts_check(
    tmp_path, make_report, clean_registry
):
    """Task 7.4: the counts check swallows `PipelineError`, so one root cause is
    attributed once (the 1.6 review's single-attribution patch)."""
    make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, aerial_header=False)

    report = run_verification(tmp_path)

    assert [d["check"] for d in _deviations(report) if d["check"] in GATE_CHECK_IDS] == [
        "goalkeeping-completeness"
    ]


def test_a_missing_anchor_is_only_anchor_coverages_finding(tmp_path, make_report, clean_registry):
    """Task 7.1: a missing section page returns `None`, never a second report of the same
    root cause under a domain id."""
    make_report(
        tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, drop_anchor_ids=("set-plays:home",)
    )

    report = run_verification(tmp_path)

    checks = {d["check"] for d in _deviations(report)}
    assert "anchor-coverage" in checks
    assert "set-plays-completeness" not in checks
    assert "set-plays-counts" not in checks


def test_two_gate_runs_differ_only_in_the_timestamp(tmp_path, make_report):
    make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    first = run_verification(tmp_path)
    second = run_verification(tmp_path)

    assert first.keys() == second.keys()
    for key in first:
        if key == "run_timestamp":
            continue
        assert first[key] == second[key], key


# --- Task 8.4: real-PDF ground truth ---------------------------------------------------
#
# spike/mex_rsa.pdf IS the PMSR-M01 report, so these are ground truth rather than
# fixtures. The fixture skips locally when the (copyrighted, uncommitted) PDF is absent
# and FAILS under CI.


@pytest.fixture(scope="module")
def m01_record(mex_rsa_pdf):
    """The two Domain E/F blocks of the ground-truth report, shaped like `domains`.

    Built by driving the extractors directly rather than through `extract_report`: the
    spike fixture is named `mex_rsa.pdf`, and `match_number_for` requires a `PMSR-M<n>-`
    filename in agreement with the cover. Renaming or copying a copyrighted, deliberately
    uncommitted file to satisfy an identity check the domain payloads do not depend on
    would be a fixture working around the pipeline rather than testing it.
    """
    import pymupdf

    from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
    from pipeline.discover.probe import probe_report
    from pipeline.discover.text import PageTextIndex
    from pipeline.extract.domain_a import extract_domain_a
    from pipeline.extract.domain_e import extract_domain_e
    from pipeline.extract.domain_f import extract_domain_f

    meta = probe_report(mex_rsa_pdf)
    with pymupdf.open(mex_rsa_pdf) as doc:
        index = PageTextIndex(doc, meta.report_id)
        anchors = {
            anchor.anchor_id: index.find_all(anchor.text, at_start=anchor.at_page_start)
            for anchor in resolve_anchors(
                ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team
            )
            if anchor.anchor_id == "lineups"
            or anchor.anchor_id.split(":")[0]
            in ("gk-involvement", "gk-distribution", "goal-prevention", "aerial-control",
                "set-plays")
        }
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
        return {
            "domains": {
                "goalkeeping": extract_domain_e(
                    doc,
                    anchors,
                    domain_a["lineups"],
                    report_id=meta.report_id,
                    home_team=meta.home_team,
                    away_team=meta.away_team,
                ),
                "set_plays": extract_domain_f(doc, anchors, report_id=meta.report_id),
            }
        }


def test_ground_truth_set_plays(m01_record):
    home = m01_record["domains"]["set_plays"]["home"]

    assert home["total_set_plays"] == 36
    assert home["total_free_kicks"] == 12
    assert home["total_penalties"] == 0
    assert home["total_corners"] == 3
    assert home["total_throw_ins"] == 21
    assert home["free_kicks"] == {
        "direct": 11,
        "direct_on_target": 0,
        "direct_off_target": 0,
        "indirect": 1,
    }
    assert home["corners_by_delivery_type"] == {
        "direct_to_area": {"left": 3, "right": 0, "total": 3},
        "short": {"left": 0, "right": 0, "total": 0},
        "edge_of_penalty_area": {"left": 0, "right": 0, "total": 0},
    }
    assert home["corners_by_delivery_style"] == {
        "inswing": 1,
        "outswing": 2,
        "driven": 0,
        "lofted": 0,
    }


def test_ground_truth_set_plays_free_kick_nesting_is_corpus_false(m01_record):
    """The contract's `FreeKickCounts` $comment asserts `direct == on target + off
    target`. On this very report `direct` is 11 while both flags print 0 — the finding
    Task 9.4b files, reproduced on ground truth."""
    home = m01_record["domains"]["set_plays"]["home"]["free_kicks"]

    assert home["direct"] == 11
    assert home["direct_on_target"] + home["direct_off_target"] == 0
    assert home["direct"] + home["indirect"] == 12


def test_ground_truth_goal_prevention(m01_record):
    home = m01_record["domains"]["goalkeeping"]["home"]["goal_prevention"]

    assert home["attempts_faced"] == 3
    assert home["total_interventions"] == 3
    assert home["by_intervention_type"] == {
        "save_and_retain": 2,
        "deflect_and_retain": 0,
        "save_and_deflect": 0,
        "save_attempt": 0,
        "no_save_attempt": 1,
    }
    assert home["attempts_faced_printed"] == 3
    assert home["save_percentage"] == 100.0
    assert home["by_body_type"] is None


def test_ground_truth_goal_prevention_ignores_the_untrustworthy_donut(m01_record):
    """The Intervention Type donut centre on this page reads 4 against a table of 3 —
    the measurement Task 3.5 rests on. The staged value must be the table's."""
    home = m01_record["domains"]["goalkeeping"]["home"]["goal_prevention"]

    assert home["attempts_faced"] == 3
    assert sum(home["by_intervention_type"].values()) == 3


def test_ground_truth_aerial_control(m01_record):
    home = m01_record["domains"]["goalkeeping"]["home"]["aerial_control"]

    assert home["total_interventions"] == 1
    assert home["punches"] == {"complete": 0, "total": 0, "incomplete": 0}
    assert home["claims"] == {"complete": 0, "total": 1, "incomplete": 0}
    assert home["tipped_palmed"] == {"complete": 0, "total": 0, "incomplete": 0}
    assert home["delivery_types_faced"] == {
        "total": 8,
        "inswing": 1,
        "outswing": 5,
        "driven": 0,
        "lofted": 2,
        "cutback": 0,
        "push_cross": 0,
    }
    assert home["crosses_faced_attempted"] == 8
    assert home["crosses_faced_completed"] is None


def test_ground_truth_distribution(m01_record):
    home = m01_record["domains"]["goalkeeping"]["home"]["distribution"]

    assert home["feet"] == {"complete": 26, "incomplete": 4, "total": 30, "printed_total": 30}
    assert home["hands"] == {"complete": 0, "incomplete": 0, "total": 0, "printed_total": 0}
    assert home["throw"] == {"complete": 3, "incomplete": 0, "total": 3, "printed_total": 3}
    assert home["total"]["complete"] == 29
    assert home["total"]["incomplete"] == 4
    assert home["total"]["total"] == 33
    assert home["total"]["printed_total"] is None
    assert home["line_breaks"] == 13
    assert home["feet_techniques"] is None


def test_ground_truth_involvement_and_the_honest_delta(m01_record):
    """Mexico's chart sums EXACTLY to its printed total (one of the 59/208 exact charts);
    South Africa's falls 3 short. The delta is asserted rather than smoothed away — it is
    the honest corpus behaviour and the regression guard for §Open question."""
    goalkeeping = m01_record["domains"]["goalkeeping"]

    home = goalkeeping["home"]
    assert home["total_involvements"] == 37
    assert sum(home["involvement_series"]) == 37

    away = goalkeeping["away"]
    assert away["total_involvements"] == 67
    assert sum(away["involvement_series"]) == 64
    assert away["total_involvements"] - sum(away["involvement_series"]) == 3

    for side in ("home", "away"):
        series = goalkeeping[side]["involvement_series"]
        assert len(series) == 100
        assert all(isinstance(value, int) and value >= 0 for value in series)


def test_ground_truth_goalkeepers(m01_record):
    goalkeeping = m01_record["domains"]["goalkeeping"]

    for side in ("home", "away"):
        keepers = goalkeeping[side]["goalkeepers"]
        assert len(keepers) == 1
        assert keepers[0]["name"]
        assert 1 <= keepers[0]["shirt_number"] <= 99


def test_ground_truth_every_recorded_check_passes(m01_record):
    from pipeline.extract.domain_e import domain_e_checks
    from pipeline.extract.domain_f import domain_f_checks

    checks = domain_e_checks(m01_record["domains"]["goalkeeping"]) + domain_f_checks(
        m01_record["domains"]["set_plays"]
    )

    assert [check["check"] for check in checks] == list(DOMAIN_E_CHECK_IDS) + list(
        DOMAIN_F_CHECK_IDS
    )
    assert [check for check in checks if check["result"] != "pass"] == []

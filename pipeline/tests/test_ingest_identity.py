"""Task 2: match-id derivation and team slugs (AC 5).

Real-PDF assertions use the permanent ground-truth fixture; everything else is a
hand-built `ReportMeta`, so no PDF is needed to prove the derivation rules.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest

from pipeline.discover.probe import ReportMeta, probe_report
from pipeline.ingest.errors import MatchIdFormatError, MatchNumberError, TeamSlugError
from pipeline.ingest.identity import (
    MATCH_ID_RE,
    MAX_MATCH_NUMBER,
    match_id_for,
    match_number_for,
    team_slug,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


def _meta(
    report_id: str = "PMSR-M01-MEX-V-RSA",
    home: str = "Mexico",
    away: str = "South Africa",
    stage_text: str = "Group A - Match 1",
) -> ReportMeta:
    return ReportMeta(
        report_id=report_id,
        source_path=f"pmsr-corpus/{report_id}.pdf",
        home_team=home,
        away_team=away,
        home_score=2,
        away_score=0,
        stage_text=stage_text,
        group="A",
        match_date=dt.date(2026, 6, 11),
        kickoff="13:00",
        venue="Mexico City Stadium",
    )


# --- the real report -------------------------------------------------------------


def test_ground_truth_report_derives_the_committed_match_id(mex_rsa_pdf):
    """The id Story 1.1's fixtures pin, derived from the PDF rather than restated."""
    meta = probe_report(mex_rsa_pdf)

    # The frozen fixture's filename stem is `mex_rsa`, not a PMSR download name, so the
    # match number is supplied from the cover alone here; the corpus path is covered by
    # the filename cross-check tests below.
    assert match_id_for(meta, Path("pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf")) == (
        "m001-mexico-south-africa"
    )


# --- the format ------------------------------------------------------------------


def test_every_derived_id_satisfies_the_contract_match_id_pattern():
    """The id this story stages must be the one Story 1.16 can emit unchanged."""
    for number, home, away in (
        (1, "Mexico", "South Africa"),
        (74, "Germany", "Paraguay"),
        (104, "Spain", "Argentina"),
    ):
        meta = _meta(
            report_id=f"PMSR-M{number:02d}-XXX-V-YYY",
            home=home,
            away=away,
            stage_text=f"Group A - Match {number}",
        )
        match_id = match_id_for(meta, Path(f"pmsr-corpus/PMSR-M{number}-XXX-V-YYY.pdf"))
        assert MATCH_ID_RE.match(match_id), match_id


def test_match_number_is_zero_padded_to_three_digits():
    """AD-3 requires ascending-match-id order; unpadded ids sort m1, m10, m100, m11."""
    low = match_id_for(
        _meta(report_id="PMSR-M01-XXX-V-YYY", stage_text="Group A - Match 1"),
        Path("PMSR-M1-XXX-V-YYY.pdf"),
    )
    high = match_id_for(
        _meta(report_id="PMSR-M104-XXX-V-YYY", stage_text="Final - Match 104"),
        Path("PMSR-M104-XXX-V-YYY.pdf"),
    )

    assert low.startswith("m001-")
    assert high.startswith("m104-")
    assert sorted([high, low]) == [low, high]


# --- team slugs ------------------------------------------------------------------


@pytest.mark.parametrize(
    "printed,expected",
    [
        ("Mexico", "mexico"),
        ("South Africa", "south-africa"),
        ("Curaçao", "curacao"),
        ("Côte d'Ivoire", "cote-d-ivoire"),
        ("Türkiye", "turkiye"),
        ("Korea Republic", "korea-republic"),
    ],
)
def test_team_names_slug_to_lowercase_ascii_kebab(printed, expected):
    """AD-3: accents stripped, every non-alphanumeric run becomes one separator."""
    assert team_slug(printed) == expected


def test_a_team_name_with_no_usable_characters_is_a_failure_not_an_empty_slug():
    """An empty slug would silently produce `m001--rsa`, which no pattern check catches.

    Typed as `TeamSlugError`, not a bare `ValueError`: the manifest records the exception
    class name, so an untyped failure would file a bad team name under the wrong bucket.
    """
    with pytest.raises(TeamSlugError, match="no slug"):
        team_slug("!!!")


def test_an_unsluggable_team_name_is_reported_as_a_slug_failure_not_a_number_failure():
    """One typed exception per failure class: the number was fine, the name was not."""
    with pytest.raises(TeamSlugError) as excinfo:
        match_id_for(_meta(home="!!!"), Path("pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf"))

    assert excinfo.value.report_id == "PMSR-M01-MEX-V-RSA"
    assert "PMSR-M01-MEX-V-RSA" in str(excinfo.value)
    assert "match number" not in str(excinfo.value)


def test_a_report_naming_the_same_team_twice_is_refused():
    """`m001-x-x` satisfies MATCH_ID_RE, so the pattern check alone cannot catch it."""
    with pytest.raises(MatchIdFormatError, match="both slug to"):
        match_id_for(
            _meta(home="Mexico", away="Mexico"), Path("pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf")
        )


def test_the_match_id_pattern_still_equals_the_contract_s_pattern():
    """The literal in `identity.py` is a hand-copy of the contract's `MatchId` pattern.

    Nothing at runtime binds the two — the scope fence forbids importing from `contract/`
    — so the copy could drift the moment Story 1.1's schemas are edited, which is exactly
    what is happening in the working tree. Reading the schema file here is not a runtime
    dependency, and it is the only thing that makes the restatement safe.
    """
    schema = json.loads(
        (REPO_ROOT / "contract" / "common.schema.json").read_text(encoding="utf-8")
    )

    assert schema["$defs"]["MatchId"]["pattern"] == MATCH_ID_RE.pattern


# --- the cover/filename agreement check ------------------------------------------


def test_match_number_comes_from_the_cover_and_agrees_with_the_filename():
    assert match_number_for(_meta(), Path("pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf")) == 1


def test_the_cover_number_is_global_not_within_the_group():
    """Verified against all 104 reports: `Group A - Match 25` is match 25 of the tournament."""
    meta = _meta(report_id="PMSR-M25-CZE-V-RSA", stage_text="Group A - Match 25")

    assert match_number_for(meta, Path("pmsr-corpus/PMSR-M25-CZE-V-RSA.pdf")) == 25


def test_cover_and_filename_disagreement_raises():
    """A mis-named download must fail loud, never be resolved by preferring one source."""
    meta = _meta(report_id="PMSR-M02-MEX-V-RSA", stage_text="Group A - Match 1")

    with pytest.raises(MatchNumberError, match="disagree"):
        match_number_for(meta, Path("pmsr-corpus/PMSR-M02-MEX-V-RSA.pdf"))


def test_a_cover_without_a_match_number_raises():
    meta = _meta(stage_text="Group A")

    with pytest.raises(MatchNumberError, match="cover"):
        match_number_for(meta, Path("pmsr-corpus/PMSR-M01-MEX-V-RSA.pdf"))


def test_a_filename_without_a_match_number_raises():
    with pytest.raises(MatchNumberError, match="file name"):
        match_number_for(_meta(report_id="whatever"), Path("pmsr-corpus/whatever.pdf"))


@pytest.mark.parametrize("number", [0, 105, 501, 1000])
def test_a_match_number_outside_the_tournament_range_raises(number):
    """Bounded on the contract's `matchNumber` maximum of 104, not on what padding allows.

    A misread cover printing "Match 501" would otherwise stage a record that satisfies
    `MatchId` but that Story 1.16 could never emit — discovered with 104 records already
    written under it (review decision, 2026-07-22).
    """
    meta = _meta(
        report_id=f"PMSR-M{number}-XXX-V-YYY", stage_text=f"Group A - Match {number}"
    )

    with pytest.raises(MatchNumberError, match="out of range"):
        match_number_for(meta, Path(f"pmsr-corpus/PMSR-M{number}-XXX-V-YYY.pdf"))


def test_the_upper_bound_is_the_contract_s_declared_match_number_maximum():
    """If the contract ever re-scopes the tournament, this is the line that must move."""
    schema = json.loads(
        (REPO_ROOT / "contract" / "match-bundle.schema.json").read_text(encoding="utf-8")
    )
    declared = schema["$defs"]["MatchMetadata"]["properties"]["matchNumber"]["maximum"]

    assert MAX_MATCH_NUMBER == declared == 104
    assert match_number_for(
        _meta(report_id="PMSR-M104-ESP-V-ARG", stage_text="Final - Match 104"),
        Path("pmsr-corpus/PMSR-M104-ESP-V-ARG.pdf"),
    ) == 104


def test_the_error_names_the_report():
    with pytest.raises(MatchNumberError) as excinfo:
        match_number_for(_meta(stage_text="Group A"), Path("pmsr-corpus/PMSR-M01-A-V-B.pdf"))

    assert "PMSR-M01-MEX-V-RSA" in str(excinfo.value)

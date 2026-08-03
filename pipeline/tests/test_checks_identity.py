"""Story 1.15 — the two FR-15 gate checks, exercised at their branches.

`identity-completeness` and `identity-pinning` shipped registered, wired into
`checks_run`, and with no behavioural test at all: only the sorted id literal in
`test_runner.py` referenced them, so nothing exercised the registry/report code
disagreement, the in-report duplicate-slug branch, the `probe-failure` mapping or Task
4.2's absent-pin rule. Story 1.15's code review filed that; this module is the fix.

The checks are per-report by the gate's own contract and read Domain A's lineups through
`_domain_a_payload`'s memo. These tests substitute that payload directly rather than
drawing synthetic PDFs: the branch logic under test is entirely downstream of the parse,
and a PDF round-trip would test `make_report` instead of the checks.

**The highest-value case here is the OVERRIDES one.** Precompute applies an override
BEFORE pinning, so an overridden player's pin is by construction not what the caps-run
rule mints from the PDF. A gate that re-minted and compared reported a `count-mismatch`
on every sampled report naming that player — and the story advertises 219 as-listed
players as override candidates whose fix is "a data edit, not a code change", so the
first such edit would have turned the gate red for a correct registry.
"""

from __future__ import annotations

import datetime as dt

import pytest

from pipeline.discover.probe import ReportMeta
from pipeline.precompute import slug_registry
from pipeline.validate import checks as checks_module
from pipeline.validate.checks import (
    _check_identity_completeness,
    _check_identity_pinning,
)
from pipeline.validate.deviations import DeviationCategory

SENTINEL_DOC = object()  # never parsed: `_domain_a_payload` is substituted below


@pytest.fixture
def clean_registry():
    """Snapshot and restore the committed registry's module-level maps."""
    snapshot = (
        dict(slug_registry.TEAM_CODES),
        {kind: dict(mapping) for kind, mapping in slug_registry.PINS.items()},
        dict(slug_registry.OVERRIDES),
    )
    yield
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update(snapshot[0])
    for kind, mapping in snapshot[1].items():
        slug_registry.PINS[kind].clear()
        slug_registry.PINS[kind].update(mapping)
    slug_registry.OVERRIDES.clear()
    slug_registry.OVERRIDES.update(snapshot[2])


def make_meta(report_id="PMSR-M01-MEX-V-RSA", home="Mexico", away="South Africa"):
    return ReportMeta(
        report_id=report_id,
        source_path=f"pmsr-corpus/{report_id}.pdf",
        home_team=home,
        away_team=away,
        home_score=2,
        away_score=0,
        stage_text="Group A - Match 1",
        group="A",
        match_date=dt.date(2026, 6, 11),
        kickoff="13:00",
        venue="Mexico City Stadium",
    )


def lineups(home_entries, away_entries):
    """A Domain A payload carrying only the lineups the checks read."""

    def side(entries):
        return {
            "starters": [{"name": n, "shirt_number": s} for n, s in entries],
            "substitutes": [],
        }

    return {"lineups": {"home": side(home_entries), "away": side(away_entries)}}


@pytest.fixture
def payload(monkeypatch):
    """Substitute Domain A's payload for the check under test."""

    def install(value):
        monkeypatch.setattr(
            checks_module, "_domain_a_payload", lambda doc, meta: value
        )

    return install


# --- identity-completeness ---------------------------------------------------------


def test_a_clean_report_produces_no_completeness_deviation(payload, clean_registry):
    payload(lineups([("Raul RANGEL", 1)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update({"mexico": "mex", "south-africa": "rsa"})
    assert _check_identity_completeness(SENTINEL_DOC, make_meta()) == []


def test_a_registry_code_disagreeing_with_the_report_is_a_count_mismatch(
    payload, clean_registry
):
    """The check's whole purpose: the PDF and the committed registry must agree about
    which three letters terminate every player id on this report."""
    payload(lineups([("Raul RANGEL", 1)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update({"mexico": "zzz", "south-africa": "rsa"})
    deviations = _check_identity_completeness(SENTINEL_DOC, make_meta())
    assert len(deviations) == 1
    assert deviations[0].category is DeviationCategory.COUNT_MISMATCH
    assert "'zzz'" in deviations[0].specifics and "'mex'" in deviations[0].specifics


def test_a_team_absent_from_the_registry_is_reported_not_skipped(payload, clean_registry):
    """A team the registry has never seen is either a new entrant or a slug that has
    drifted, and silently passing the assertion is how the second one goes unnoticed."""
    payload(lineups([("Raul RANGEL", 1)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update({"south-africa": "rsa"})  # mexico missing
    deviations = _check_identity_completeness(SENTINEL_DOC, make_meta())
    assert [d.category for d in deviations] == [DeviationCategory.COUNT_MISMATCH]
    assert "no committed registry entry" in deviations[0].specifics


def test_two_lineup_entries_minting_one_id_is_a_count_mismatch(payload, clean_registry):
    """An in-report collision is a statement about counts of distinct entities, not
    about a page that failed to parse."""
    payload(lineups([("Raul RANGEL", 1), ("Raul RANGEL", 12)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update({"mexico": "mex", "south-africa": "rsa"})
    deviations = _check_identity_completeness(SENTINEL_DOC, make_meta())
    assert [d.category for d in deviations] == [DeviationCategory.COUNT_MISMATCH]
    assert "minted twice" in deviations[0].specifics
    assert "shirt 1" in deviations[0].specifics and "12" in deviations[0].specifics


def test_a_name_that_mints_nothing_valid_is_a_probe_failure_naming_the_class(
    payload, clean_registry
):
    payload(lineups([("...", 1)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update({"mexico": "mex", "south-africa": "rsa"})
    deviations = _check_identity_completeness(SENTINEL_DOC, make_meta())
    assert [d.category for d in deviations] == [DeviationCategory.PROBE_FAILURE]
    assert deviations[0].specifics.startswith("PlayerSlugError: ")


def test_an_unreadable_report_id_is_ONE_probe_failure_not_one_per_lineup_entry(
    payload, clean_registry
):
    """`REPORT_ID_RE` accepts `[A-Z0-9]+`, so a four-letter segment parses fine and then
    fails inside `player_slug` once per entry — ~52 identical deviations for a single
    malformed report id, flooding the localization histogram. The code is gated up front
    instead, exactly as `precompute.identity.team_codes` gates it."""
    payload(lineups([("Raul RANGEL", 1), ("Cesar MONTES", 3)], [("Ronwen WILLIAMS", 1)]))
    meta = make_meta(report_id="PMSR-M01-MEXI-V-RSA")
    deviations = _check_identity_completeness(SENTINEL_DOC, meta)
    assert len(deviations) == 1, f"one report-level fact, {len(deviations)} deviations"
    assert deviations[0].category is DeviationCategory.PROBE_FAILURE
    assert "TeamCode" in deviations[0].specifics


# --- identity-pinning --------------------------------------------------------------


def test_a_pin_that_still_holds_produces_no_deviation(payload, clean_registry):
    payload(lineups([("Raul RANGEL", 1)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.PINS["players"].clear()
    slug_registry.PINS["players"]["mexico#1"] = "rangel-raul-mex"
    assert _check_identity_pinning(SENTINEL_DOC, make_meta()) == []


def test_a_pin_disagreeing_with_the_minted_id_is_a_count_mismatch_naming_both(
    payload, clean_registry
):
    payload(lineups([("Raul RANGEL", 1)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.PINS["players"].clear()
    slug_registry.PINS["players"]["mexico#1"] = "someone-else-mex"
    deviations = _check_identity_pinning(SENTINEL_DOC, make_meta())
    assert [d.category for d in deviations] == [DeviationCategory.COUNT_MISMATCH]
    assert "someone-else-mex" in deviations[0].specifics
    assert "rangel-raul-mex" in deviations[0].specifics


def test_an_absent_pin_is_a_new_entity_and_emits_nothing(payload, clean_registry):
    """Task 4.2's rule — normal on a growing corpus, and it must not fail."""
    payload(lineups([("Raul RANGEL", 1)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.PINS["players"].clear()
    assert _check_identity_pinning(SENTINEL_DOC, make_meta()) == []


def test_an_OVERRIDDEN_player_does_NOT_trip_the_pinning_check(payload, clean_registry):
    """THE REGRESSION THIS MODULE EXISTS FOR.

    `resolve_players` applies `OVERRIDES` before pinning, so the pin IS the override and
    is deliberately not what the caps-run rule mints. The gate re-minted from the PDF and
    compared, so the very first override — the story's advertised data-only fix for 219
    as-listed players — would have reported a `count-mismatch` on every sampled report
    naming that player, against a registry that was entirely correct.
    """
    payload(lineups([("GABRIEL MAGALHAES", 4)], [("Ronwen WILLIAMS", 1)]))
    meta = make_meta(report_id="PMSR-M01-BRA-V-RSA", home="Brazil")
    slug_registry.PINS["players"].clear()
    slug_registry.OVERRIDES.clear()
    # Without the override the caps-run rule mints `gabriel-magalhaes-bra` (as-listed).
    slug_registry.OVERRIDES["brazil#4"] = "magalhaes-gabriel-bra"
    slug_registry.PINS["players"]["brazil#4"] = "magalhaes-gabriel-bra"
    assert _check_identity_pinning(SENTINEL_DOC, meta) == []


def test_an_override_that_disagrees_with_its_own_pin_is_still_reported(
    payload, clean_registry
):
    """Consulting OVERRIDES must not become a way to silence the check."""
    payload(lineups([("GABRIEL MAGALHAES", 4)], [("Ronwen WILLIAMS", 1)]))
    meta = make_meta(report_id="PMSR-M01-BRA-V-RSA", home="Brazil")
    slug_registry.PINS["players"].clear()
    slug_registry.OVERRIDES.clear()
    slug_registry.OVERRIDES["brazil#4"] = "magalhaes-gabriel-bra"
    slug_registry.PINS["players"]["brazil#4"] = "something-stale-bra"
    deviations = _check_identity_pinning(SENTINEL_DOC, meta)
    assert [d.category for d in deviations] == [DeviationCategory.COUNT_MISMATCH]
    assert "something-stale-bra" in deviations[0].specifics


def test_a_malformed_override_is_a_probe_failure_rather_than_a_silent_pass(
    payload, clean_registry
):
    payload(lineups([("GABRIEL MAGALHAES", 4)], [("Ronwen WILLIAMS", 1)]))
    meta = make_meta(report_id="PMSR-M01-BRA-V-RSA", home="Brazil")
    slug_registry.PINS["players"].clear()
    slug_registry.OVERRIDES.clear()
    slug_registry.OVERRIDES["brazil#4"] = "Gabriel Magalhaes"  # spaces, capitals, no code
    slug_registry.PINS["players"]["brazil#4"] = "Gabriel Magalhaes"
    deviations = _check_identity_pinning(SENTINEL_DOC, meta)
    assert [d.category for d in deviations] == [DeviationCategory.PROBE_FAILURE]
    assert "SlugRegistryError" in deviations[0].specifics


def test_a_non_integer_shirt_number_is_reported_rather_than_passing_vacuously(
    payload, clean_registry
):
    """`pin_key(team, None)` builds `team#None`, which matches no pin — so the check
    would report nothing on a report it never actually tested."""
    payload(lineups([("Raul RANGEL", None)], [("Ronwen WILLIAMS", 1)]))
    slug_registry.PINS["players"].clear()
    slug_registry.PINS["players"]["mexico#1"] = "rangel-raul-mex"
    deviations = _check_identity_pinning(SENTINEL_DOC, make_meta())
    assert [d.category for d in deviations] == [DeviationCategory.PROBE_FAILURE]
    assert "non-integer" in deviations[0].specifics

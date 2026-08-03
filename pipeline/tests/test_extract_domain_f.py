"""Story 1.9, Domain F: the Set Plays page (AC 2, AC 3).

Tests drive the drawers directly through `make_report`, so every expected value is derived
from what the factory actually drew (`default_set_plays_block`) rather than restated as a
second literal — the 1.6/1.7/1.10 review rule.
"""

from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest

from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors
from pipeline.discover.probe import probe_report
from pipeline.discover.text import PageTextIndex
from pipeline.extract.domain_f import (
    CORNER_STYLE_ROWS,
    CORNER_TYPE_ROWS,
    FREE_KICK_ROWS,
    KPI_LABELS,
    NUMERIC_WORD_COUNT,
    domain_f_checks,
    extract_domain_f,
)
from pipeline.extract.errors import MalformedFieldError, MissingFieldError, SetPlaysParseError

from pipeline.tests.conftest import default_set_plays_block

REPORT_NAME = "PMSR-M01-MEX-V-RSA.pdf"
ANCHOR_IDS = ("set-plays:home", "set-plays:away")


def _extract(path: Path) -> dict:
    """Run Domain F over a built report, resolving only its own anchors."""
    meta = probe_report(path)
    with pymupdf.open(path) as doc:
        index = PageTextIndex(doc, meta.report_id)
        anchors = {
            anchor.anchor_id: index.find_all(anchor.text, at_start=anchor.at_page_start)
            for anchor in resolve_anchors(
                ANCHOR_REGISTRY, home=meta.home_team, away=meta.away_team
            )
            if anchor.anchor_id in ANCHOR_IDS
        }
        return extract_domain_f(doc, anchors, meta.report_id)


@pytest.fixture
def build(make_report, tmp_path):
    counter = {"n": 0}

    def _build(**kwargs) -> Path:
        counter["n"] += 1
        return make_report(tmp_path / f"{counter['n']:02d}" / REPORT_NAME, **kwargs)

    return _build


# --- the happy path -------------------------------------------------------------------


def test_both_sides_parse_with_every_printed_value(build):
    payload = _extract(build())

    assert set(payload) == {"home", "away"}
    for side in ("home", "away"):
        assert payload[side] == default_set_plays_block(side)


def test_the_two_sides_are_not_swapped(build):
    """The home and away defaults differ in every field, so a swap cannot pass."""
    payload = _extract(build())

    assert payload["home"] != payload["away"]
    assert payload["home"]["total_set_plays"] == default_set_plays_block("home")["total_set_plays"]


def test_every_value_is_a_plain_integer(build):
    """AC 2 / AD-7: raw and locale-neutral — no '%' strings, no display formatting."""
    payload = _extract(build())

    for side in ("home", "away"):
        block = payload[side]
        for key, _label in KPI_LABELS:
            assert isinstance(block[key], int)
        for key, _label in FREE_KICK_ROWS:
            assert isinstance(block["free_kicks"][key], int)
        for key, _label in CORNER_TYPE_ROWS:
            for column in ("left", "right", "total"):
                assert isinstance(block["corners_by_delivery_type"][key][column], int)
        for key, _label in CORNER_STYLE_ROWS:
            assert isinstance(block["corners_by_delivery_style"][key], int)


def test_the_kpi_value_is_not_simply_the_row_above_its_label(build):
    """`Total Set Plays`' printed value is separated from its label by the corners table's
    own first data row — the exact collision the centred upward walk exists for."""
    payload = _extract(build())
    home = default_set_plays_block("home")

    # The row directly above the label carries the `Direct to Area` values, not the KPI.
    assert payload["home"]["total_set_plays"] == home["total_set_plays"]
    assert payload["home"]["total_set_plays"] != home["corners_by_delivery_type"][
        "direct_to_area"
    ]["total"]


# --- typed failure paths ---------------------------------------------------------------


def test_anchor_resolving_to_two_pages_raises(build):
    path = build(set_plays_extra_pages={"home": 1})

    with pytest.raises(SetPlaysParseError, match="resolves to 2 pages"):
        _extract(path)


def test_a_missing_kpi_label_raises(build):
    path = build(set_plays_omit_labels=("total_corners",))

    with pytest.raises(SetPlaysParseError, match="Total Corners"):
        _extract(path)


def test_a_missing_table_label_raises(build):
    path = build(set_plays_omit_labels=("indirect",))

    with pytest.raises(SetPlaysParseError, match="Indirect"):
        _extract(path)


def test_a_corners_row_with_the_wrong_value_count_raises(build):
    """AD-8: the count is invariant corpus-wide, so any other count is a template
    revision that must fail loud rather than shift every column by one."""
    block = default_set_plays_block("home")
    block["corners_by_delivery_type"]["short"] = {"left": 1, "right": 0}

    with pytest.raises(SetPlaysParseError, match=r"carries 2 value\(s\)"):
        _extract(build(set_plays_block={"home": block}))


def test_a_non_numeric_token_raises(build):
    block = default_set_plays_block("away")
    block["free_kicks"]["direct"] = "n/a"

    with pytest.raises(MalformedFieldError, match="not a non-negative integer"):
        _extract(build(set_plays_block={"away": block}))


def test_a_kpi_with_no_printed_value_raises(build):
    """A KPI label with nothing centred above it is a missing field, not a zero."""
    block = default_set_plays_block("home")
    block["total_throw_ins"] = ""

    with pytest.raises(MissingFieldError, match="total_throw_ins"):
        _extract(build(set_plays_block={"home": block}))


def test_the_numeric_word_census_is_a_page_level_tripwire(build):
    """Every value is found by name, so a printed number the label set does not name
    would simply be ignored — the census is the only whole-page guard."""
    path = build(set_plays_date_strip=False)

    with pytest.raises(SetPlaysParseError, match=f"expected the corpus-invariant {NUMERIC_WORD_COUNT}"):
        _extract(path)


def test_an_extra_printed_number_also_trips_the_census(build):
    def decorate(page):
        page.insert_text((600, 470), "99", fontsize=9)

    with pytest.raises(SetPlaysParseError, match="bare-integer words"):
        _extract(build(set_plays_decorate=decorate))


# --- the recorded checks ---------------------------------------------------------------


def _check(checks, check_id):
    return next(check for check in checks if check["check"] == check_id)


def test_both_checks_pass_on_the_defaults(build):
    checks = domain_f_checks(_extract(build()))

    assert [check["check"] for check in checks] == [
        "set-plays-corner-sides",
        "set-plays-totals",
    ]
    assert all(check["result"] == "pass" for check in checks)


def test_exactly_one_dict_per_check_id_covers_both_sides(build):
    """Task 5.1: one dict per id, so re-runs are byte-identical."""
    checks = domain_f_checks(_extract(build()))

    assert len(checks) == len({check["check"] for check in checks})


def test_corner_sides_check_fails_when_a_row_does_not_add_up(build):
    block = default_set_plays_block("home")
    block["corners_by_delivery_type"]["short"]["total"] = 9

    payload = _extract(build(set_plays_block={"home": block}))
    check = _check(domain_f_checks(payload), "set-plays-corner-sides")

    assert check["result"] == "fail"
    assert "home short" in check["specifics"]


def test_corner_sides_check_fails_when_the_side_sums_miss_the_total(build):
    block = default_set_plays_block("away")
    block["total_corners"] = block["total_corners"] + 3

    payload = _extract(build(set_plays_block={"away": block}))
    check = _check(domain_f_checks(payload), "set-plays-corner-sides")

    assert check["result"] == "fail"
    assert check["specifics"].startswith("away")


def test_totals_check_fails_when_the_parts_miss_the_total(build):
    block = default_set_plays_block("home")
    block["total_set_plays"] = block["total_set_plays"] + 1

    payload = _extract(build(set_plays_block={"home": block}))
    check = _check(domain_f_checks(payload), "set-plays-totals")

    assert check["result"] == "fail"
    assert "total set plays" in check["specifics"]


def test_totals_check_fails_when_the_free_kick_nesting_breaks(build):
    # Only the nesting moves: `total_free_kicks` and every other total stay put, so the
    # first clause of the check still holds and the failure is unambiguously this one.
    block = default_set_plays_block("away")
    block["free_kicks"]["indirect"] = block["free_kicks"]["indirect"] + 1

    payload = _extract(build(set_plays_block={"away": block}))
    check = _check(domain_f_checks(payload), "set-plays-totals")

    assert check["result"] == "fail"
    assert "indirect" in check["specifics"]


def test_the_corpus_refuted_relations_are_not_shipped(build):
    """Story 1.9 §Contract finding: `direct == on target + off target` is corpus-FALSE on
    208/208 team-innings, and `sum(delivery style) == total corners` on 112/208. The
    defaults make BOTH false, so a fixture can never quietly bless either — and the checks
    must still pass."""
    payload = _extract(build())

    for side in ("home", "away"):
        block = payload[side]
        free_kicks = block["free_kicks"]
        assert (
            free_kicks["direct"]
            != free_kicks["direct_on_target"] + free_kicks["direct_off_target"]
        )
        assert sum(block["corners_by_delivery_style"].values()) != block["total_corners"]
    assert all(check["result"] == "pass" for check in domain_f_checks(payload))


# --- malformed vs missing, and the import-time label guard (code-review additions) --------


def test_a_decimal_kpi_is_MALFORMED_not_missing(build):
    """`errors.py`'s rule: "a gate operator triaging deviations must not read 'field
    missing' for a field whose value is printed right there".

    The candidate filter used to be `_INTEGER_RE`, so a KPI printed `12.5` was invisible
    to the upward walk and the failure surfaced as `MissingFieldError` — an absence
    message for a malformation. `domain_e._value_above` always got this right; the two
    modules now split malformed-from-missing identically.
    """
    block = default_set_plays_block("home")
    block["total_throw_ins"] = "12.5"

    with pytest.raises(MalformedFieldError, match=r"is not a non-negative integer: '12\.5'"):
        _extract(build(set_plays_block={"home": block}))


def test_a_kpi_label_that_is_an_INTERIOR_word_run_of_another_fails_at_import():
    """The guard has to match what `_label_run` actually matches.

    `_label_run` accepts any contiguous span run, so the real hazard is a label equal to an
    interior run of another — `'Set Plays'` inside `'Total Set Plays'` passes a `startswith`
    test cleanly and then matches inside the longer label whenever the spans split on that
    boundary, turning one authoring bug into 208 identical failures blaming the corpus.
    """
    from pipeline.extract import domain_f

    assert domain_f._is_word_subrun("Set Plays", "Total Set Plays")
    assert domain_f._is_word_subrun("Total", "Total Corners")
    # Whole words only — `_label_run` joins spans, so a mid-word collision is impossible.
    assert not domain_f._is_word_subrun("Corner", "Total Corners")
    assert not domain_f._is_word_subrun("Total Penalties", "Total Corners")

    original = domain_f.KPI_LABELS
    try:
        domain_f.KPI_LABELS = original + (("set_plays_short", "Set Plays"),)
        with pytest.raises(ValueError, match="contiguous word run inside"):
            domain_f._assert_label_integrity()
    finally:
        domain_f.KPI_LABELS = original
    # And the shipped constants still pass their own guard.
    domain_f._assert_label_integrity()

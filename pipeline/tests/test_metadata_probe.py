"""Task 3: cover-page metadata probe for stratification (AC 1, AC 5)."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from pipeline.discover.errors import ProbeError
from pipeline.discover.probe import COVER_ANCHOR, ReportMeta, probe_report, probe_corpus


def _write_pdf(path: Path, lines: list[str]) -> Path:
    """Synthetic single-page report whose cover layout mimics the real one."""
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    y = 100.0
    for line in lines:
        page.insert_text((80, y), line, fontsize=18)
        y += 40
    doc.save(path)
    doc.close()
    return path


COVER_LINES = [
    "Mexico 2 - 0 South Africa",
    "Group A - Match 1",
    "11 June 2026",
    "13:00 Kick Off",
    "Mexico City Stadium",
    COVER_ANCHOR,
]


def test_probe_reads_the_real_report(mex_rsa_pdf):
    meta = probe_report(mex_rsa_pdf)

    assert meta.report_id == "mex_rsa"
    assert meta.home_team == "Mexico"
    assert meta.away_team == "South Africa"
    assert meta.home_score == 2
    assert meta.away_score == 0
    assert meta.stage_text == "Group A - Match 1"
    assert meta.group == "A"
    assert meta.match_date == dt.date(2026, 6, 11)
    assert meta.kickoff == "13:00"
    assert meta.venue == "Mexico City Stadium"
    # Group-stage matchday is a corpus-level derivation, not a per-report fact.
    assert meta.matchday_round is None


def test_probe_of_synthetic_cover(tmp_path):
    meta = probe_report(_write_pdf(tmp_path / "syn_a.pdf", COVER_LINES))

    assert meta.report_id == "syn_a"
    assert (meta.home_team, meta.away_team) == ("Mexico", "South Africa")
    assert meta.venue == "Mexico City Stadium"


def test_probe_without_cover_anchor_raises(tmp_path):
    path = _write_pdf(tmp_path / "no_cover.pdf", ["Some Other Document", "11 June 2026"])
    with pytest.raises(ProbeError):
        probe_report(path)


@pytest.mark.parametrize(
    "lines",
    [
        # no date line
        ["Mexico 2 - 0 South Africa", "Group A - Match 1", "13:00 Kick Off", "V", COVER_ANCHOR],
        # no kick-off line
        ["Mexico 2 - 0 South Africa", "Group A - Match 1", "11 June 2026", "V", COVER_ANCHOR],
        # no scoreline
        ["Group A - Match 1", "11 June 2026", "13:00 Kick Off", "V", COVER_ANCHOR],
        # venue slot occupied by the report title (i.e. venue missing)
        [
            "Mexico 2 - 0 South Africa",
            "Group A - Match 1",
            "11 June 2026",
            "13:00 Kick Off",
            COVER_ANCHOR,
        ],
    ],
)
def test_probe_fails_loud_on_incomplete_cover(tmp_path, lines):
    path = _write_pdf(tmp_path / "broken.pdf", lines)
    with pytest.raises(ProbeError) as excinfo:
        probe_report(path)
    assert excinfo.value.report_id == "broken"


def test_an_impossible_date_is_a_probe_error_not_a_valueerror(tmp_path):
    """`31 June` is date-shaped but unreal; a ValueError here would abort the whole scan."""
    lines = list(COVER_LINES)
    lines[2] = "31 June 2026"
    path = _write_pdf(tmp_path / "baddate.pdf", lines)

    with pytest.raises(ProbeError) as excinfo:
        probe_report(path)
    assert "not a real date" in excinfo.value.reason


def test_a_second_date_line_is_ambiguous_not_silently_resolved(tmp_path):
    """Taking the first match would read the stage and venue from the wrong block."""
    path = _write_pdf(tmp_path / "twodates.pdf", ["Report generated", "01 July 2026"] + COVER_LINES)

    with pytest.raises(ProbeError) as excinfo:
        probe_report(path)
    assert "2 date lines" in excinfo.value.reason


def test_an_inserted_cover_line_is_a_deviation_not_a_phantom_venue(tmp_path):
    """The exact threat model: a cover redesign that adds a line must not pass silently."""
    lines = list(COVER_LINES)
    lines.insert(4, "Attendance 87,523")
    path = _write_pdf(tmp_path / "shifted.pdf", lines)

    with pytest.raises(ProbeError) as excinfo:
        probe_report(path)
    assert excinfo.value.report_id == "shifted"
    # The block no longer ends with the report title below the venue, so the shape check
    # catches the shift instead of promoting "Attendance 87,523" to a venue name.
    assert "does not end with" in excinfo.value.reason


def test_single_digit_kickoff_is_normalized_for_ordering(tmp_path):
    lines = list(COVER_LINES)
    lines[3] = "9:00 Kick Off"
    meta = probe_report(_write_pdf(tmp_path / "early.pdf", lines))

    assert meta.kickoff == "09:00"
    assert meta.kickoff_sort_key == (9, 0)


def test_shootout_cover_variant_probes_cleanly(tmp_path):
    """4 of the real 104 reports print the shoot-out result under the scoreline.

    Confirmed wording from `PMSR-M74-GER-V-PAR`; a legitimate cover variant, so it must
    probe cleanly and be captured — not recorded as a deviation.
    """
    path = _write_pdf(
        tmp_path / "pens.pdf",
        [
            "Germany 1 - 1 Paraguay",
            "(Paraguay win 3-4 on Penalties)",
            "Round of 32 - Match 74",
            "29 June 2026",
            "16:30 Kick Off",
            "Boston Stadium",
            COVER_ANCHOR,
        ],
    )

    meta = probe_report(path)

    assert (meta.home_team, meta.away_team) == ("Germany", "Paraguay")
    assert (meta.home_score, meta.away_score) == (1, 1)
    assert meta.stage_text == "Round of 32 - Match 74"
    assert meta.venue == "Boston Stadium"
    assert meta.shootout == "(Paraguay win 3-4 on Penalties)"
    assert meta.probe_notes == ()


def test_a_scoreline_suffix_is_trimmed_and_recorded(tmp_path):
    """A knockout shoot-out suffix must not become part of the away team's name."""
    lines = list(COVER_LINES)
    lines[0] = "Argentina 3 - 3 France (4-2 Pens)"
    lines[1] = "Final"
    meta = probe_report(_write_pdf(tmp_path / "pens.pdf", lines))

    assert meta.away_team == "France"
    assert meta.probe_notes and "suffix" in meta.probe_notes[0]


def test_probe_corpus_reports_failures_without_crashing(tmp_path):
    _write_pdf(tmp_path / "good.pdf", COVER_LINES)
    _write_pdf(tmp_path / "bad.pdf", ["Not a match report"])

    metas, failures = probe_corpus(tmp_path)

    assert [m.report_id for m in metas] == ["good"]
    assert [report_id for report_id, _ in failures] == ["bad"]
    assert "bad" in failures[0][1] or "anchor" in failures[0][1]


def test_probe_corpus_is_deterministic_and_sorted(tmp_path):
    for name in ("c", "a", "b"):
        _write_pdf(tmp_path / f"{name}.pdf", COVER_LINES)

    first, _ = probe_corpus(tmp_path)
    second, _ = probe_corpus(tmp_path)

    assert [m.report_id for m in first] == ["a", "b", "c"]
    assert first == second


def test_report_meta_is_hashable_and_frozen():
    meta = ReportMeta(
        report_id="x",
        source_path="x.pdf",
        home_team="A",
        away_team="B",
        home_score=1,
        away_score=0,
        stage_text="Group A - Match 1",
        group="A",
        match_date=dt.date(2026, 6, 11),
        kickoff="13:00",
        venue="V",
    )
    assert hash(meta)
    with pytest.raises(Exception):
        meta.venue = "other"  # type: ignore[misc]

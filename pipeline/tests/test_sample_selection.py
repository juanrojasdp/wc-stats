"""Task 4: two-cover stratified sample selection (AC 1, AC 5).

Pure set-cover logic — exercised on a synthetic in-memory corpus description, so it
needs no PDFs at all.
"""

from __future__ import annotations

import datetime as dt

from pipeline.discover.probe import ReportMeta
from pipeline.validate.sample import select_sample


def meta(report_id, venue, matchday_round, day=11):
    return ReportMeta(
        report_id=report_id,
        source_path=f"{report_id}.pdf",
        home_team="H",
        away_team="A",
        home_score=0,
        away_score=0,
        stage_text="Group A - Match 1",
        group="A",
        match_date=dt.date(2026, 6, day),
        kickoff="13:00",
        venue=venue,
        matchday_round=matchday_round,
    )


def test_empty_corpus_yields_empty_sample():
    assert select_sample([]) == []


def test_single_report_satisfies_both_covers():
    sample = select_sample([meta("only", "Mexico City Stadium", "group-md1")])

    assert len(sample) == 1
    assert sample[0].report_id == "only"
    assert sample[0].covers == ("round", "venue")


def test_sample_covers_every_venue_and_every_round():
    metas = [
        meta("r1", "V1", "group-md1"),
        meta("r2", "V2", "group-md2"),
        meta("r3", "V3", "group-md3"),
        meta("r4", "V1", "r16"),
        meta("r5", "V2", "final"),
        meta("r6", "V4", "group-md1"),
    ]

    sample = select_sample(metas)
    chosen = {entry.report_id for entry in sample}
    by_id = {m.report_id: m for m in metas}

    assert {by_id[r].venue for r in chosen} == {"V1", "V2", "V3", "V4"}
    assert {by_id[r].matchday_round for r in chosen} == {
        "group-md1",
        "group-md2",
        "group-md3",
        "r16",
        "final",
    }


def test_overlap_is_exploited_so_the_union_stays_small():
    """Four venues x four rounds, perfectly diagonal: four reports must suffice."""
    metas = [meta(f"r{i}", f"V{i}", f"group-md{i}" if i <= 3 else "final") for i in range(1, 5)]

    sample = select_sample(metas)

    assert len(sample) == 4
    assert all(entry.covers == ("round", "venue") for entry in sample)


def test_selection_is_deterministic_regardless_of_input_order():
    metas = [
        meta("b", "V1", "group-md1"),
        meta("a", "V1", "group-md2"),
        meta("c", "V2", "group-md1"),
    ]

    first = select_sample(metas)
    second = select_sample(list(reversed(metas)))

    assert [e.report_id for e in first] == [e.report_id for e in second]
    assert [e.covers for e in first] == [e.covers for e in second]


def test_ties_break_on_report_id():
    """Two equally good candidates: the lexicographically smaller id wins."""
    metas = [meta("zz", "V1", "group-md1"), meta("aa", "V1", "group-md1")]

    sample = select_sample(metas)

    assert [e.report_id for e in sample] == ["aa"]


def test_report_without_a_round_still_covers_its_venue():
    """A report whose matchday round could not be derived is excluded from the round
    cover but must not drop out of the venue cover."""
    metas = [
        meta("known", "V1", "group-md1"),
        meta("unknown_round", "V2", None),
    ]

    sample = select_sample(metas)
    chosen = {e.report_id: e for e in sample}

    assert set(chosen) == {"known", "unknown_round"}
    assert chosen["unknown_round"].covers == ("venue",)
    assert chosen["known"].covers == ("round", "venue")


def test_sample_is_sorted_by_report_id():
    metas = [
        meta("m3", "V3", "group-md3"),
        meta("m1", "V1", "group-md1"),
        meta("m2", "V2", "group-md2"),
    ]

    sample = select_sample(metas)

    assert [e.report_id for e in sample] == ["m1", "m2", "m3"]


def _tournament_shaped_corpus():
    """104 matches shaped like the real tournament, not like an all-pairs grid.

    `i % 16` x `i % 9` would make every (venue, round) pair occur — the easiest possible
    set-cover instance, and one where "at least 16" is guaranteed by there being 16
    venues. A real corpus is lumpier: the group stage fills every venue, while the later
    rounds are concentrated in a handful of them.
    """
    venues = [f"V{i:02d}" for i in range(16)]
    group_rounds = ["group-md1", "group-md2", "group-md3"]
    knockout = ["r32", "r16", "qf", "sf", "third-place", "final"]

    metas = []
    for i in range(72):  # group stage: 24 fixtures per matchday across all 16 venues
        metas.append(
            meta(f"g{i:03d}", venues[i % 16], group_rounds[i // 24], day=11 + (i // 16))
        )
    # Knockouts cluster in the six largest venues; the final has exactly one report.
    knockout_plan = [("r32", 16), ("r16", 8), ("qf", 4), ("sf", 2), ("third-place", 1), ("final", 1)]
    counter = 0
    for round_id, count in knockout_plan:
        for j in range(count):
            metas.append(
                meta(f"k{counter:03d}", venues[j % 6], round_id, day=20 + knockout.index(round_id))
            )
            counter += 1
    return metas, set(venues), set(group_rounds + knockout)


def test_realistic_scale_stays_within_the_expected_band():
    """16 venues x 9 rounds over 104 matches: the union should be ~16-25 reports."""
    metas, venues, rounds = _tournament_shaped_corpus()
    assert len(metas) == 104

    sample = select_sample(metas)

    assert 16 <= len(sample) <= 25
    assert {e.venue for e in sample} == venues
    assert {e.matchday_round for e in sample} == rounds


def test_realistic_scale_selection_is_deterministic():
    """The tie-breaking has something to do here, unlike on an all-pairs grid."""
    metas, _, _ = _tournament_shaped_corpus()

    first = [e.report_id for e in select_sample(metas)]
    second = [e.report_id for e in select_sample(list(reversed(metas)))]

    assert first == second

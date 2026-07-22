"""Stratified sample selection: the union of a venue cover and a matchday cover.

The gate exists to localize a silent mid-tournament template revision to *where* it
happened (a venue) or *when* it happened (a matchday round), so the sample must contain
at least one report per venue **and** at least one per round. One report can serve both
covers, and exploiting that overlap is what keeps the sample near 16-25 reports out of
104 rather than 25 distinct ones.

Selection is a greedy set cover over the combined universe of venue and round elements,
with ties broken on report id, so an unchanged corpus always yields the same sample.
"""

from __future__ import annotations

from dataclasses import dataclass

from pipeline.discover.probe import ReportMeta

VENUE_COVER = "venue"
ROUND_COVER = "round"


@dataclass(frozen=True)
class SampleEntry:
    """One selected report and the cover(s) it was selected to satisfy."""

    report_id: str
    venue: str
    matchday_round: str | None
    covers: tuple[str, ...]


def _elements(meta: ReportMeta) -> set[tuple[str, str]]:
    """The cover elements a report can satisfy.

    A report whose matchday round could not be derived still covers its venue; it is
    only excluded from the round cover.
    """
    elements = {(VENUE_COVER, meta.venue)}
    if meta.matchday_round is not None:
        elements.add((ROUND_COVER, meta.matchday_round))
    return elements


def select_sample(metas: "list[ReportMeta]") -> list[SampleEntry]:
    """Pick a deterministic report set covering every venue and every round in the corpus.

    Greedy set cover, so the result is small but not provably minimal — on adversarial
    inputs it can select more reports than the optimum. That is fine for the gate (a
    slightly larger sample only costs time) but it is not the "smallest" set, and the
    16-25 band the Dev Notes predict rests on the corpus's real shape, not on optimality.

    Note the universe is built from the corpus itself: a round or venue with no report at
    all is vacuously covered here. `runner._corpus_gaps` is what catches that.
    """
    candidates = sorted(metas, key=lambda m: m.report_id)
    uncovered: set[tuple[str, str]] = set()
    for meta in candidates:
        uncovered |= _elements(meta)

    selected: list[SampleEntry] = []
    remaining = list(candidates)
    while uncovered:
        best: ReportMeta | None = None
        best_gain: set[tuple[str, str]] = set()
        for meta in remaining:
            gain = _elements(meta) & uncovered
            if len(gain) > len(best_gain):
                best, best_gain = meta, gain
        if best is None:
            break  # nothing left can cover anything (unreachable given the universe)

        selected.append(
            SampleEntry(
                report_id=best.report_id,
                venue=best.venue,
                matchday_round=best.matchday_round,
                covers=tuple(sorted(kind for kind, _ in best_gain)),
            )
        )
        uncovered -= best_gain
        remaining.remove(best)

    return sorted(selected, key=lambda entry: entry.report_id)

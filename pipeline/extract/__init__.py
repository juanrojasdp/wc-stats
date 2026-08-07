"""Per-domain tabular extractors (architecture Structural Seed).

Each domain story adds one module here that turns pages of an open report into that
domain's block under the Extraction Record's `domains` mapping. Extractors are pure in
the AD-9 sense: no filesystem writes, no timestamps, no absolute paths, no cross-report
knowledge — one open document in, one JSON-ready dict out.

Story 1.6 establishes the package with Domain A (`domain_a.py`); Stories 1.7-1.10 follow
the same convention. Pitch-map marker parsing is NOT here — `pipeline/markers/` owns it.

`aggregate_self_validation` lives here, not in any one domain's module: it is the
record-level seam every extractor's checks flow through, and importing it from a
sibling domain would couple each new story to Domain A's extractor. `check_entry` is
here for the same reason (Story 1.8): four domain modules carried byte-identical private
copies of it, and the ledger's rule is that extraction becomes cheaper than duplication
at the third copy — momentum would have been the fifth.
"""

from __future__ import annotations


def check_entry(check_id: str, passed: bool, specifics: str) -> dict:
    """One Self-Validation check, in the shape `aggregate_self_validation` reads.

    `result` is the literal `"pass"`/`"fail"` the aggregator compares against — never a
    bool, never a truthy value — because the aggregator treats anything that is not the
    exact string `"pass"` as a failure, and a bool would silently fail every check.
    """
    return {"check": check_id, "result": "pass" if passed else "fail", "specifics": specifics}


def bounded_check(check_id: str, passed: bool, specifics: str, max_delta: "int | float") -> dict:
    """A BOUNDED check — one whose predicate is an inequality, not an equality.

    Several of this pipeline's strongest cross-checks are bounds rather than equalities,
    because the source does not hold to the equality and manufacturing one would be the
    fake reconciliation Stories 1.8 and 1.12 refused. Such a check *passes* while the
    drawn set still sits a measurable distance from the printed count, and that distance
    is the "near-miss parse" category AC 1 and FR-16 name (Story 1.19, ruling R2).

    `max_delta` is that distance: the largest **absolute** gap from exactness the check
    observed on this report, across every side/panel/row it covered. Zero means the check
    was exact everywhere, which is the corpus-normal case; the batch summary aggregates
    only the non-zero ones, so an exact corpus produces no near-miss block at all.

    Carried as an extra key on the check dict rather than as a separate structure. Checks
    have always been free-shaped beyond the three keys `aggregate_self_validation` reads
    (`linking.py` and `defensive_actions.py` both add their own), and keying off the
    presence of `max_delta` is what lets `format_summary` aggregate near misses without
    hard-coding a registry of check ids it would then have to be kept in step with.
    """
    return {**check_entry(check_id, passed, specifics), "max_delta": max_delta}


def aggregate_self_validation(checks: "list[dict]") -> str:
    """The record-level result over whatever checks are present.

    "fail" if any present check is anything but a literal "pass" — a malformed check
    (a typo'd result, a missing key) must never launder into a passing record — and
    the seam's honest "not-applicable" when no extractor contributed any check at all.
    """
    if not checks:
        return "not-applicable"
    return "pass" if all(check.get("result") == "pass" for check in checks) else "fail"

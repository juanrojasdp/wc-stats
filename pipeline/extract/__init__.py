"""Per-domain tabular extractors (architecture Structural Seed).

Each domain story adds one module here that turns pages of an open report into that
domain's block under the Extraction Record's `domains` mapping. Extractors are pure in
the AD-9 sense: no filesystem writes, no timestamps, no absolute paths, no cross-report
knowledge — one open document in, one JSON-ready dict out.

Story 1.6 establishes the package with Domain A (`domain_a.py`); Stories 1.7-1.10 follow
the same convention. Pitch-map marker parsing is NOT here — `pipeline/markers/` owns it.

`aggregate_self_validation` lives here, not in any one domain's module: it is the
record-level seam every extractor's checks flow through, and importing it from a
sibling domain would couple each new story to Domain A's extractor.
"""

from __future__ import annotations


def aggregate_self_validation(checks: "list[dict]") -> str:
    """The record-level result over whatever checks are present.

    "fail" if any present check is anything but a literal "pass" — a malformed check
    (a typo'd result, a missing key) must never launder into a passing record — and
    the seam's honest "not-applicable" when no extractor contributed any check at all.
    """
    if not checks:
        return "not-applicable"
    return "pass" if all(check.get("result") == "pass" for check in checks) else "fail"

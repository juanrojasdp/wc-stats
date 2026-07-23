"""Per-domain tabular extractors (architecture Structural Seed).

Each domain story adds one module here that turns pages of an open report into that
domain's block under the Extraction Record's `domains` mapping. Extractors are pure in
the AD-9 sense: no filesystem writes, no timestamps, no absolute paths, no cross-report
knowledge — one open document in, one JSON-ready dict out.

Story 1.6 establishes the package with Domain A (`domain_a.py`); Stories 1.7-1.10 follow
the same convention. Pitch-map marker parsing is NOT here — `pipeline/markers/` owns it.
"""

from __future__ import annotations

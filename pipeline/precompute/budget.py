"""The AD-4 / NFR-1 payload budget, measured over canonical bytes (Story 1.16).

**The unit is exact and it is not what the fixture guard measures.** AD-4 and NFR-1 both
say gzip -9 over the canonical serialized bytes, measured by the Pipeline; the App never
re-measures. `pipeline/tests/test_fixtures.py` asserts `path.stat().st_size <= 500_000` —
raw bytes, not gzip — and its own docstring defers the real gate here. The two coexist:
that one is a cheap fixture-shape tripwire, this one is the enforcing gate. Do not
"align" them; a raw-bytes fixture guard is strictly stronger for its own purpose.

**Placement is a deliberate departure and is recorded as one.** `ARCHITECTURE-SPINE.md:176`
puts "budget + route-manifest asserts" under `validate/`. It lands in `precompute/` because
it is a property of the bytes THIS module writes, measured at the moment of writing —
`validate/` is the per-report FR-15 gate and never sees an emitted artifact. The rejected
alternative was `pipeline/validate/budget.py` imported by the emitter; it splits one
write-and-measure step across two packages. A reviewer should read this as a considered
placement, not a structural violation.

**A gate that cannot fail reads greener than no gate while proving strictly less.** The
largest committed fixture gzips to 17,023 bytes — 3.4% of the ceiling — and no real bundle
comes near it. So the gate ships with a CONSTRUCTED over-budget test that drives it red
(`test_emit_bundles.py`), never a corpus assertion that is green by arithmetic.
"""

from __future__ import annotations

import gzip

# 500 KB decimal, matching the existing raw-bytes constant in `test_fixtures.py`. AD-4 and
# NFR-1 both state the budget in KB, and every other size in this project is decimal.
BUDGET_BYTES = 500_000


def gzip_bytes(text: str) -> int:
    """Compressed size of `text`'s UTF-8 encoding under gzip -9.

    Measured over the canonical string the emitter is about to write, never over a
    re-serialization — two serializations that differ by a single space would report two
    different budgets for one artifact.

    `mtime=0` keeps the gzip header free of a timestamp. It does not affect the size, but
    it means the compressed bytes are themselves reproducible, so a caller that ever wants
    to compare them (rather than just measure) is not silently defeated by a header clock.

    Note this is NOT what `gzip -9 <file>` reports on the command line: GNU gzip writes the
    source filename into the FNAME header, so the shell figure is higher.
    """
    return len(gzip.compress(text.encode("utf-8"), compresslevel=9, mtime=0))


def over_budget(label: str, text: str) -> "tuple[str, int, int] | None":
    """`(label, gzip_size, raw_size)` when `text` breaches the budget, else `None`.

    Returned rather than raised so a caller can collect EVERY breach before failing.
    Aborting on the first turns one run into ten.
    """
    compressed = gzip_bytes(text)
    if compressed > BUDGET_BYTES:
        return (label, compressed, len(text.encode("utf-8")))
    return None

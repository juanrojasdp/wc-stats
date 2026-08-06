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


def over_budget_combined(label: str, texts: "list[str]") -> "tuple[str, int, int] | None":
    """`(label, summed_gzip_size, summed_raw_size)` when a SET of artifacts breaches it.

    AD-4 states one budget over `tournament.json` + `leaderboards.json` **combined**,
    "because the Hub loads both" — a unit `over_budget` cannot express, since it measures
    exactly one string.

    **The measurement is the SUM OF INDEPENDENTLY GZIPPED ARTIFACTS, and that is a ruling
    (Story 1.17 D3), not an implementation detail.** The Hub fetches two files over two
    HTTP responses, so it downloads two gzip streams and pays for both headers and both
    dictionaries; that is what this sums. The alternative reading, `gzip_bytes(a + b)`,
    compresses one stream over a concatenation nobody ever transfers, and it is
    systematically the smaller number because the second artifact gets to reuse the first
    one's dictionary. Measured over the real corpus the two readings differ by well under
    0.5% at every row cap and never disagree on the verdict — but they are different
    claims about the wire, and the one the reader pays for is this one.

    Same return-don't-raise contract as `over_budget`, so a caller collects every breach —
    the per-artifact ones and this one — before failing.
    """
    compressed = sum(gzip_bytes(text) for text in texts)
    if compressed > BUDGET_BYTES:
        return (label, compressed, sum(len(text.encode("utf-8")) for text in texts))
    return None

"""Cross-match identity resolution and the normalized spine — AD-9's SECOND phase.

Everything under `pipeline/extract/` is **per-report and pure**: one PDF in, one
Extraction Record out, with no knowledge of any other report. This package is the
opposite by construction. It is **global**: it consumes all 104 Extraction Records in
canonical order (ascending match id) and is the **only** phase that resolves identity —
the phase where "the Raul RANGEL on match 1 and the Raul RANGEL on match 43 are one
person with one URL" becomes a fact the rest of the system can rely on.

Nothing here reads a PDF. Story 1.15 is the first Epic 1 story with no `pymupdf` in its
production path at all, other than the two FR-15 gate checks, which are per-report by the
gate's own contract and live in `pipeline/validate/checks.py`.

**No `/contract` dependency (AD-1).** Everything this package writes lands in `work/`,
which is pipeline-internal staging, so keys stay `snake_case`. The camelCase mapping, the
`schemaVersion` stamp and emission into `/data` are all Story 1.16's. The contract's four
id patterns are restated as literals in `identity.py` and pinned against the schema file
by a drift test, exactly as `pipeline/ingest/identity.py` does for `MatchId`.

**Failure policy is stricter here than in extract, and deliberately so.** Under AD-8 a
per-report extract failure is recoverable: the report lands `failed` in the manifest and
the batch continues, because 103 good records are worth more than none. A precompute
failure is not recoverable in that sense. A slug collision, a team with two codes, a
pinned id that would change, a name that resolves to nobody — each is a defect in the
dataset or in the resolution rule itself, and emitting a half-resolved namespace would
put wrong ids into `/data` where AD-3 promises they never change. So precompute
**aborts**. One typed exception per failure kind (`errors.py`), never a bare `ValueError`,
always with the offending values in `repr()`.

**There is no first-seen-shirt tiebreak, and none is faked.** AD-3 describes one for two
players who normalize to the same name within one team; measured over 5,392 lineup
entries this corpus holds 0 such collisions, 0 players wearing two shirts and 0 non-ASCII
characters in any name. On that corpus a tiebreak can only ever fire on a defect, and
quietly minting two ids out of one printed name is the unfalsifiable failure mode this
package aborts to prevent — every id unique, every pattern satisfied, and one route
naming the wrong person. So `resolve_players` raises `IdentityCollisionError` naming both
parties instead. AC 1's binding block rules exactly this; AC 4 rows 2-3 and Task 3.4
describe the tiebreak, and that contradiction was resolved in favour of raising by Story
1.15's code review (Decision 1). "First seen wins" is true here only in the sense that a
key seen in several matches takes the first record's answer, which canonical order makes
well defined.

**Precompute runs over the COMPLETE corpus.** `matchdayRound` is derivable only for a
group holding all 6 of its fixtures and is `required` by both bundle schemas, so a
partial manifest cannot be precomputed and is refused rather than staged with the field
missing or guessed (Decision 3, same review).

Modules:
  `records.py`       load the Extraction Records the run manifest names, in canonical order
  `identity.py`      team codes, the player slug rule, resolution, and the pinning checks
  `slug_registry.py` the committed, generated registry — the artifact that outlives the code
  `spine.py`         the normalized spine staged to `work/spine/`
  `run.py`           the CLI
"""

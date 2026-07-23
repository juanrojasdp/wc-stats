"""Match-id derivation: the mechanical half of AD-3's entity identity.

`m{NNN}-{home-slug}-{away-slug}`, e.g. `m001-mexico-south-africa`. Three-digit zero
padding is Story 1.1's logged decision: AD-3 requires precompute to consume records in
ascending-match-id order, and unpadded ids sort `m1, m10, m100, m11...`. Padded, string
order equals numeric order by construction.

The match number is read from **both** the cover's stage line and the filename stem, and
the two must agree. The filename is a human-managed download artifact while the cover is
authoritative content; requiring agreement is what turns a mis-named download into a loud
`failed` entry instead of a record staged under another match's identity. Verified across
all 104 corpus reports (2026-07-22): every cover's `stage_text` ends `- Match N`, N is the
*global* tournament number at every stage (`Group A - Match 25`, `Final - Match 104`), and
N equals the filename's number in 104/104 cases.

Only the mechanical derivation lives here. Player identity, the committed slug registry
and the cross-match spine are Story 1.15's.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from pipeline.discover.probe import ReportMeta
from pipeline.ingest.errors import MatchIdFormatError, MatchNumberError, TeamSlugError

# Restated from contract/common.schema.json#/$defs/MatchId. Deliberately a literal rather
# than an import: Extraction Records are internal `work/` staging and this story's code
# path takes no dependency on /contract (Story 1.1 is still in review). The point of the
# check is that the id staged here is the one Story 1.16 can emit unchanged.
# `test_ingest_identity.py` reads the pattern back out of the schema file and asserts it
# equals this literal, so the two cannot drift apart silently.
MATCH_ID_RE = re.compile(r"^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$")

# The tournament holds 104 matches, and both contract/match-bundle.schema.json and
# contract/tournament.schema.json declare `matchNumber` with "maximum": 104. Bounding on
# the contract's number rather than on what three-digit padding can represent (999) is a
# review decision (2026-07-22): a misread cover printing "Match 501" would otherwise stage
# a record that satisfies MatchId but that Story 1.16 could never emit.
MIN_MATCH_NUMBER = 1
MAX_MATCH_NUMBER = 104

# `re.ASCII` on both: without it `\d` also matches fullwidth and Arabic-Indic digits, which
# `int()` accepts happily. A cover yielding those would disagree with the ASCII-only
# filename and produce a diagnostic showing two numbers that look identical on screen.
_COVER_NUMBER_RE = re.compile(r"-\s*Match\s+(\d+)\s*$", re.ASCII)
_FILENAME_NUMBER_RE = re.compile(r"^PMSR-M(\d+)-", re.IGNORECASE | re.ASCII)


def team_slug(name: str) -> str:
    """A printed team name as a lowercase ASCII kebab slug (AD-3).

    NFKD-normalize, drop non-ASCII, lowercase, collapse each run of non-`[a-z0-9]` to a
    single `-`, strip the ends. Verified over the 48 distinct team names the corpus
    prints: zero collisions, and exactly three names need more than lowercasing —
    `Curaçao` -> `curacao`, `Côte d'Ivoire` -> `cote-d-ivoire`, `Türkiye` -> `turkiye`.
    The apostrophe is a separator like any other non-alphanumeric.

    An empty result is a failure, not a slug: it would produce `m001--rsa`, which reads as
    a valid id to a careless eye and matches no team anywhere downstream.
    """
    folded = unicodedata.normalize("NFKD", name)
    ascii_only = folded.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    if not slug:
        raise TeamSlugError(f"team name {name!r} produces no slug characters")
    return slug


def _cover_match_number(meta: ReportMeta) -> int | None:
    match = _COVER_NUMBER_RE.search(meta.stage_text)
    return int(match.group(1)) if match else None


def _filename_match_number(source_path: Path) -> int | None:
    match = _FILENAME_NUMBER_RE.match(source_path.stem)
    return int(match.group(1)) if match else None


def match_number_for(meta: ReportMeta, source_path: "str | Path") -> int:
    """The report's global match number, from the cover and the filename in agreement.

    Raises `MatchNumberError` when either source is absent, when the two disagree, or
    when the number cannot be represented as a three-digit id. Never prefers one source
    silently — see the module docstring for why both are required.
    """
    source_path = Path(source_path)
    report_id = meta.report_id

    cover_number = _cover_match_number(meta)
    if cover_number is None:
        raise MatchNumberError(
            f"cover stage line {meta.stage_text!r} has no '- Match N' suffix", report_id
        )

    filename_number = _filename_match_number(source_path)
    if filename_number is None:
        raise MatchNumberError(
            f"file name {source_path.name!r} has no 'PMSR-M<number>-' prefix", report_id
        )

    if cover_number != filename_number:
        raise MatchNumberError(
            f"cover and file name disagree: cover {meta.stage_text!r} says {cover_number}, "
            f"file name {source_path.name!r} says {filename_number}",
            report_id,
        )

    if not MIN_MATCH_NUMBER <= cover_number <= MAX_MATCH_NUMBER:
        raise MatchNumberError(
            f"match number {cover_number} is out of range "
            f"{MIN_MATCH_NUMBER}..{MAX_MATCH_NUMBER}",
            report_id,
        )
    return cover_number


def match_id_for(meta: ReportMeta, source_path: "str | Path") -> str:
    """`m{NNN}-{home-slug}-{away-slug}` for one report.

    Raises one typed error per failure class, so the manifest's `error_type` names what
    actually went wrong: `MatchNumberError` (the number), `TeamSlugError` (a name that
    reduces to nothing), `MatchIdFormatError` (an assembled id the contract's pattern
    rejects, or one naming the same team twice). The last two exist so a bad id is caught
    here rather than in Story 1.16, with 104 records already staged under it.
    """
    number = match_number_for(meta, source_path)
    try:
        home = team_slug(meta.home_team)
        away = team_slug(meta.away_team)
    except TeamSlugError as exc:
        # Re-raised with the report id attached: `team_slug` is a pure string function and
        # has no idea which report it is serving.
        raise TeamSlugError(exc.reason, meta.report_id) from exc

    if home == away:
        # `m001-x-x` satisfies MATCH_ID_RE, so the pattern check below cannot catch this.
        # Reachable from a cover misread, or from two names that NFKD-fold to one slug.
        raise MatchIdFormatError(
            f"home and away teams both slug to {home!r} "
            f"({meta.home_team!r} vs {meta.away_team!r})",
            meta.report_id,
        )

    match_id = f"m{number:03d}-{home}-{away}"
    if not MATCH_ID_RE.match(match_id):
        raise MatchIdFormatError(
            f"{match_id!r} does not satisfy the contract MatchId pattern "
            f"{MATCH_ID_RE.pattern}",
            meta.report_id,
        )
    return match_id

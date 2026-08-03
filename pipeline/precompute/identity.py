"""Player, team and match identity resolved across the whole corpus (AD-3).

Two-thirds of the id minting already exists and is reused, not reimplemented:
`pipeline.ingest.identity.team_slug` is the accent-stripping kebab slugger (48 team names
-> 48 slugs, 0 collisions), and every Extraction Record already carries its `match_id`,
minted and validated at ingest. What is genuinely new here is the **player** id, and the
**team code** that terminates it.

`teamCode` has no producer anywhere else in the pipeline. It exists only inside
`report_id` — `PMSR-M01-MEX-V-RSA` — and it is the trailing segment of every `PlayerId`,
so it is on the critical path. It is parsed out, asserted 1:1 against the teams, and
committed into the slug registry, because it is **not derivable from the printed name**:
`KSA` for Saudi Arabia, `CUW` for Curacao, `CPV` for Cabo Verde, `ESP` for Spain, `SUI`
for Switzerland and `MAR` for Morocco each contain a letter the team's own slug does not,
and `RSA` / `COD` are not the first three letters of anything. A lookup is mandatory; a
derivation rule would be a guess, and AD-8 forbids guessing.

THE PLAYER SLUG RULE (the "caps-run" rule)
------------------------------------------
No record carries surname and given name separately — `name` is one printed string — and
the corpus prints at least four incompatible grammars over its 5,392 lineup entries:

    uU    4,191   `Raul RANGEL`           given first, surname in caps
    UU      707   `GABRIEL MAGALHAES`     all caps; the boundary is unknowable
    uUU     168   `Luc DE FOUGEROLLES`    multi-token surname
    U       107   `ALISSON`               mononym; no split exists
    uuU      81   `Juan Jose CACERES`     multi-token given name
    Uu       78   `KIM Seunggyu`          SURNAME FIRST (every Korea Republic player)
    uu       25   `Weston McKENNIE`       no all-caps token at all
    (35 more across UUU / uuUU / uUUU / uuuU)

Ruled: **the all-caps tokens are the surname, wherever in the string they sit; the
remaining tokens are the given name in printed order; if there are no caps tokens, or no
remainder, the name slugs as listed.**

The rule is **validated, not asserted**. It reproduces **155 of 155** distinct player ids
in the committed `data/fixtures/matches/*.json` bundles with 0 mismatches — bundles
hand-authored by Story 1.1 and signed off by Story 2.3, so they are the de-facto worked
examples. Over the real corpus it yields 1,248 slugs for 1,248 distinct players with 0
collisions.

**Uniqueness cannot discriminate between candidate rules; only the fixtures can.** The
rejected "last token is the surname" rule ALSO yields 1,248 unique, collision-free slugs
— it differs on 1,009 entries and inverts all 26 Korea Republic players — so a story that
validated on collision count alone would have shipped either rule. It fails the fixture
reproduction on 27 ids. That is why the fixture check is the acceptance check.

Declared residual, not hidden: the `U`, `UU`, `UUU` and `uu` buckets take the as-listed
fallback, so **856 entries / 219 distinct players** slug in given-name-first order —
`abdallah-alfakhori-jor` sits beside `rangel-raul-mex` with the opposite component order.
Every one is unique, stable, deterministic and passes `PlayerId`; the cost is cosmetic
ordering on a URL, not correctness. Fabricating a surname boundary inside
`GABRIEL MAGALHAES` would be a guess. Every one is a candidate `OVERRIDES` entry, so the
fix is a data edit rather than a code change.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

from pipeline.ingest.identity import team_slug
from pipeline.precompute.errors import (
    IdentityCollisionError,
    PlayerSlugError,
    PrecomputeError,
    SlugRegistryError,
)

# Verbatim copies of contract/common.schema.json#/$defs — `$`, exactly as the schema
# writes it. Only ever compared for equality; never compiled. A drift test reads the
# schema file and asserts these literals still equal it, the same restate-and-pin
# precedent `pipeline/ingest/identity.py` set for `MatchId`.
SCHEMA_PATTERNS: dict[str, str] = {
    "TeamId": r"^[a-z0-9]+(-[a-z0-9]+)*$",
    "TeamCode": r"^[a-z]{3}$",
    "MatchId": r"^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$",
    "PlayerId": r"^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$",
}

# The runtime gates. `\Z`, not `$`: Python's `$` also matches immediately before a
# trailing newline, which ECMA-262 — the dialect JSON Schema mandates — rejects. So a
# slug carrying a stray `"\n"` would pass a `$` gate here and then fail validation in
# Story 1.16, with 104 records already staged under it. That defect shipped once already.
#
# Deliberately NOT `from pipeline.ingest.identity import MATCH_ID_RE`: the shipped one
# uses `$` and would import the weaker form.
TEAM_ID_RE = re.compile(SCHEMA_PATTERNS["TeamId"][:-1] + r"\Z")
TEAM_CODE_RE = re.compile(SCHEMA_PATTERNS["TeamCode"][:-1] + r"\Z")
MATCH_ID_RE = re.compile(SCHEMA_PATTERNS["MatchId"][:-1] + r"\Z")
PLAYER_ID_RE = re.compile(SCHEMA_PATTERNS["PlayerId"][:-1] + r"\Z")

# `re.ASCII` for the same reason `pipeline/ingest/identity.py` uses it: without it `\d`
# also matches fullwidth and Arabic-Indic digits. Matched on 104/104 report ids.
# `\Z` rather than `$` for the same reason the four id gates above use it: `$` would also
# accept a report id carrying a trailing newline, and this pattern is what the team codes
# — the trailing segment of every PlayerId — are parsed out of.
REPORT_ID_RE = re.compile(r"^PMSR-M\d+-([A-Z0-9]+)-V-([A-Z0-9]+)\Z", re.ASCII)

SIDES: tuple[str, str] = ("home", "away")
LINEUP_SECTIONS: tuple[str, str] = ("starters", "substitutes")

# How a slug was arrived at. Diagnostic only — never part of the identity — but it is
# what turns "which players slug given-name-first?" into a query over the spine instead
# of a re-derivation.
SLUG_SOURCE_CAPS_RUN = "caps-run"
SLUG_SOURCE_AS_LISTED = "as-listed"
SLUG_SOURCE_OVERRIDE = "override"


def pin_key(team_id: str, shirt_number: int) -> str:
    """The pin key, serialized. ONE form everywhere: `f"{team_id}#{shirt_number}"`.

    `(team_id, shirt_number)` is the resolution key because it is globally unique on this
    corpus — measured, not assumed: 0 `(team, shirt)` pairs are worn by two players and 0
    players wear more than one shirt. `team_id` is the key half rather than `team_code`
    because it is what 25,764 of the corpus's 26,180 team references already carry.

    Serialized flat so the generated registry is a sorted literal a `git diff` reads
    cleanly, rather than a nest of tuples.
    """
    return f"{team_id}#{shirt_number}"


def _kebab(text: str) -> str:
    """`team_slug`'s recipe applied to a name fragment.

    NOT `team_slug` itself: that one raises `TeamSlugError`, which is the wrong typed
    error for a player name, and it would report an empty *team* name for what is
    actually an empty name fragment. The recipe is identical on purpose — a player
    slugger that quietly diverged from the team slugger is the easiest way to break the
    committed fixtures.
    """
    folded = unicodedata.normalize("NFKD", text)
    ascii_only = folded.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")


def player_slug(name: str, team_code: str) -> str:
    """`{surname}-{givenName}-{teamCode}` by the caps-run rule (see the module docstring).

    Three points the corpus makes safe today but which a future corpus will not, so they
    are stated rather than left to be rediscovered:

    (a) The caps tokens are a **filter over the token list, not a contiguous run**.
        Measured 0 names with non-contiguous caps, so the two are indistinguishable on
        this corpus; the filter is the ruled form and it is what reproduces 155/155.
    (b) `str.isupper()` is `False` for a token with no cased characters — a bare `"2"`,
        a bare `"-"` — which would silently land in the given name. Measured 0 such
        tokens; the character inventory of every player name is `A-Z`, `a-z`, space,
        `-` and one `.`. **Guarded rather than merely declared**, because the resulting
        slug is well formed: `"Raul RANGEL 7"` would mint `rangel-raul-7-mex`, which
        passes `PlayerId` cleanly and pins a mis-parsed column as a permanent id.
    (c) `_kebab` collapses the hyphen, so `WAN-BISSAKA` -> `wan-bissaka` and joining the
        caps tokens with `" "`, `"-"` or `""` is indistinguishable here. `" "` is ruled.

    **Both branches append `-{team_code}`.** A two-segment slug validates clean as a
    `TeamId` — `PlayerId` is a strict superset shape — so it would pass the schema layer
    and produce a dead route. That is a defect that shipped once, and it is why the
    pattern gate below is unconditional rather than only on the caps-run branch.
    """
    slug, _source = _player_slug_with_source(name, team_code)
    return slug


def _player_slug_with_source(name: str, team_code: str) -> tuple[str, str]:
    """`player_slug`, plus which branch produced it. See `SLUG_SOURCE_*`."""
    tokens = name.split()  # whitespace runs; no other separator exists in this corpus
    uncased = [token for token in tokens if not any(c.isalpha() for c in token)]
    if uncased:
        # Point (b) above. Such a token is `isupper() == False`, so it would join the
        # given name and mint a valid-looking id out of a parse defect.
        raise PlayerSlugError(
            f"player name {name!r} carries token(s) {uncased!r} with no cased character; "
            f"the caps-run rule cannot place them and the corpus contains none"
        )
    caps = [token for token in tokens if token.isupper()]  # True "ST.", False "McKENNIE"
    rest = [token for token in tokens if not token.isupper()]
    if not caps or not rest:  # mononym, all caps, or no caps at all -> as listed
        slug = f"{_kebab(name)}-{team_code}"
        source = SLUG_SOURCE_AS_LISTED
    else:
        slug = f"{_kebab(' '.join(caps))}-{_kebab(' '.join(rest))}-{team_code}"
        source = SLUG_SOURCE_CAPS_RUN
    if not PLAYER_ID_RE.match(slug):
        raise PlayerSlugError(
            f"player name {name!r} with team code {team_code!r} produced {slug!r}, "
            f"which does not satisfy the contract PlayerId pattern "
            f"{SCHEMA_PATTERNS['PlayerId']}"
        )
    return slug, source


def gate_override(override: str, key: str) -> str:
    """An `OVERRIDES` value, gated exactly as hard as a minted one.

    `OVERRIDES` is the only map in the registry a human hand-edits, which makes it the
    last place to trust an unchecked string — and it is applied BEFORE pinning, so an
    ungated override is pinned, committed, and staged into every spine file that names the
    player. The minted path is gated inside `_player_slug_with_source`; an override that
    replaced the result afterwards would bypass that gate entirely, and `PlayerId` is a
    strict superset shape of `TeamId`, so even a two-segment override would validate clean
    against the schema and produce a dead route.
    """
    if not PLAYER_ID_RE.match(override):
        raise SlugRegistryError(
            f"OVERRIDES names {key!r} -> {override!r}, which does not satisfy the "
            f"contract PlayerId pattern {SCHEMA_PATTERNS['PlayerId']}"
        )
    return override


def team_codes(records: "list[dict]") -> dict[str, str]:
    """`{team_id: team_code}`, parsed out of every report id and asserted 1:1.

    A second code for a known team, or a second team for a known code, is fatal: a code
    serving two teams silently merges two squads into one player-id namespace, and it is
    invisible to every downstream count because both squads still resolve.
    """
    to_code: dict[str, str] = {}
    to_team: dict[str, str] = {}
    for record in records:
        report_id = record.get("report_id")
        if not isinstance(report_id, str):
            raise PrecomputeError(f"record {record.get('match_id')!r} carries no report id")
        matched = REPORT_ID_RE.match(report_id)
        if matched is None:
            raise PrecomputeError(
                f"report id {report_id!r} does not match {REPORT_ID_RE.pattern!r}, "
                f"so its team codes cannot be read",
                report_id,
            )
        teams = record["domains"]["match_metadata"]["teams"]
        for code, side in ((matched.group(1), "home"), (matched.group(2), "away")):
            code = code.lower()
            if not TEAM_CODE_RE.match(code):
                raise PrecomputeError(
                    f"team code {code!r} from report id {report_id!r} does not satisfy "
                    f"the contract TeamCode pattern {SCHEMA_PATTERNS['TeamCode']}",
                    report_id,
                )
            team_id = team_slug(teams[side])
            known_code = to_code.get(team_id)
            if known_code is not None and known_code != code:
                raise IdentityCollisionError(
                    f"team {team_id!r} carries two codes: {known_code!r} "
                    f"(seen earlier) and {code!r} (report {report_id!r})",
                    report_id,
                )
            known_team = to_team.get(code)
            if known_team is not None and known_team != team_id:
                raise IdentityCollisionError(
                    f"team code {code!r} serves two teams: {known_team!r} "
                    f"(seen earlier) and {team_id!r} (report {report_id!r})",
                    report_id,
                )
            to_code[team_id] = code
            to_team[code] = team_id
    return dict(sorted(to_code.items()))


def lineup_entries(record: dict) -> "list[tuple[str, str, str, dict]]":
    """Every lineup entry of one record as `(side, section, team_id, entry)`.

    The **section is carried alongside the entry** because `has_minutes(entry, section)`
    cannot be answered by the entry dict alone: starter-ness comes from the section the
    entry was read from, not from anything stored on it.
    """
    teams = record["domains"]["match_metadata"]["teams"]
    lineups = record["domains"]["match_metadata"]["lineups"]
    rows: list[tuple[str, str, str, dict]] = []
    for side in SIDES:
        team_id = team_slug(teams[side])
        for section in LINEUP_SECTIONS:
            for entry in lineups[side][section]:
                rows.append((side, section, team_id, entry))
    return rows


def resolve_players(
    records: "list[dict]", codes: "dict[str, str]", registry
) -> dict[tuple[str, int], str]:
    """`{(team_id, shirt_number): player_id}` over the whole corpus.

    Records are walked in canonical order, so for one `(team_id, shirt_number)` key seen
    in several matches **the first record wins** — which is what the padded, sortable
    match id was bought for. That is idempotence across records, and it is the only sense
    in which "first seen wins" is true here.

    **There is no first-seen-shirt TIEBREAK, and that is deliberate — see AC 1's binding
    block.** Two players on one team whose printed names mint one slug do not get
    silently separated by shirt order: they raise `IdentityCollisionError` naming both.
    Measured over 5,392 lineup entries, all three of OQ-4's named ambiguous cases are
    corpus-empty — 0 normalized name+team collisions, 0 players wearing more than one
    shirt, 0 non-ASCII characters in any player name — so a tiebreak here could only ever
    fire on a defect, and quietly minting two ids out of one printed name is exactly the
    unfalsifiable failure this package aborts to prevent. AD-3's tiebreak is recorded as
    unimplemented rather than faked; Story 1.15's code review ruled it (Decision 1).

    `OVERRIDES` is applied **before** the `PlayerId` gate and before pinning, so an
    override is what gets pinned and can rescue a name that mints nothing valid.
    """
    resolved: dict[tuple[str, int], str] = {}
    # Provenance for the error messages. A collision naming only ids localizes nothing.
    provenance: dict[tuple[str, int], tuple[str, str]] = {}  # key -> (name, match_id)
    by_slug: dict[str, tuple[str, int]] = {}
    overrides = getattr(registry, "OVERRIDES", {})

    for record in records:
        match_id = record["match_id"]
        report_id = record.get("report_id")
        for _side, _section, team_id, entry in lineup_entries(record):
            code = codes.get(team_id)
            if code is None:
                raise PrecomputeError(
                    f"team {team_id!r} has no team code; "
                    f"it appears in {match_id!r} but in no report id",
                    report_id,
                )
            name = entry["name"]
            shirt = entry["shirt_number"]
            # `isinstance(True, int)` is True, so bool is excluded explicitly: it would
            # alias shirt 1 in the tuple key while pinning as `team#True`.
            if not isinstance(shirt, int) or isinstance(shirt, bool):
                raise PrecomputeError(
                    f"lineup entry {name!r} in {match_id!r} carries a non-integer "
                    f"shirt number {shirt!r}",
                    report_id,
                )
            key = (team_id, shirt)
            # The override is resolved FIRST, not layered over a minted slug: minting
            # raises on a name that produces nothing valid, and that is precisely the
            # failure an override exists to fix. Gated as hard as a minted slug.
            override = overrides.get(pin_key(team_id, shirt))
            if override is not None:
                slug = gate_override(override, pin_key(team_id, shirt))
            else:
                slug, _source = _player_slug_with_source(name, code)

            known = resolved.get(key)
            if known is None:
                # A slug already serving a DIFFERENT key means two people share one URL.
                owner = by_slug.get(slug)
                if owner is not None and owner != key:
                    owner_name, owner_match = provenance[owner]
                    raise IdentityCollisionError(
                        f"player id {slug!r} would serve two players: "
                        f"{owner_name!r} (team {owner[0]!r} shirt {owner[1]}, first seen "
                        f"in {owner_match!r}) and {name!r} (team {team_id!r} shirt "
                        f"{shirt}, in {match_id!r})",
                        report_id,
                    )
                resolved[key] = slug
                provenance[key] = (name, match_id)
                by_slug[slug] = key
            elif known != slug:
                first_name, first_match = provenance[key]
                raise IdentityCollisionError(
                    f"team {team_id!r} shirt {shirt} resolves to two player ids: "
                    f"{known!r} from {first_name!r} in {first_match!r}, and {slug!r} "
                    f"from {name!r} in {match_id!r}",
                    report_id,
                )
    return dict(sorted(resolved.items()))


def slug_sources(
    records: "list[dict]", codes: "dict[str, str]", registry
) -> dict[tuple[str, int], str]:
    """`{(team_id, shirt_number): slug_source}` — diagnostic, never identity."""
    overrides = getattr(registry, "OVERRIDES", {})
    sources: dict[tuple[str, int], str] = {}
    for record in records:
        for _side, _section, team_id, entry in lineup_entries(record):
            shirt = entry["shirt_number"]
            key = (team_id, shirt)
            if key in sources:
                continue
            if pin_key(team_id, shirt) in overrides:
                sources[key] = SLUG_SOURCE_OVERRIDE
                continue
            code = codes.get(team_id)
            if code is None:
                raise PrecomputeError(
                    f"team {team_id!r} has no team code; "
                    f"it appears in {record.get('match_id')!r} but in no report id",
                    record.get("report_id"),
                )
            _slug, source = _player_slug_with_source(entry["name"], code)
            sources[key] = source
    return sources


def resolve_matches(records: "list[dict]") -> dict[str, str]:
    """`{report_id: match_id}` — already minted at ingest, gated again here.

    Nothing is re-derived. The match id on the record is the one Story 1.16 emits, and the
    gate exists so a record staged under a malformed id is caught before it is pinned.

    **Never parse the tail of a match id to recover home and away.**
    `m073-south-africa-canada` and `m052-bosnia-and-herzegovina-qatar` cannot be split by
    any string rule — 9 of 48 team slugs contain a hyphen. Teams come from
    `domains.match_metadata.teams`.
    """
    matches: dict[str, str] = {}
    for record in records:
        report_id = record["report_id"]
        match_id = record["match_id"]
        if not MATCH_ID_RE.match(match_id):
            raise PrecomputeError(
                f"match id {match_id!r} does not satisfy the contract MatchId pattern "
                f"{SCHEMA_PATTERNS['MatchId']}",
                report_id,
            )
        if report_id in matches and matches[report_id] != match_id:
            raise IdentityCollisionError(
                f"report {report_id!r} names two match ids: "
                f"{matches[report_id]!r} and {match_id!r}",
                report_id,
            )
        matches[report_id] = match_id
    return dict(sorted(matches.items()))


def resolve_teams(records: "list[dict]") -> dict[str, str]:
    """`{team_id: team_id}` for every team in the corpus, each gated against `TeamId`.

    Identity on the surface, and that is the point: pinning it makes the team namespace
    immutable on the same terms as the player namespace, so a later change to `team_slug`
    fails loud instead of silently re-slugging 48 teams and every route to them.
    """
    teams: dict[str, str] = {}
    for record in records:
        for side in SIDES:
            printed = record["domains"]["match_metadata"]["teams"][side]
            team_id = team_slug(printed)
            if not TEAM_ID_RE.match(team_id):
                raise PrecomputeError(
                    f"team name {printed!r} slugs to {team_id!r}, which does not satisfy "
                    f"the contract TeamId pattern {SCHEMA_PATTERNS['TeamId']}",
                    record.get("report_id"),
                )
            teams[team_id] = team_id
    return dict(sorted(teams.items()))


# --------------------------------------------------------------------------- pinning


def check_pins(resolved: "dict[str, str]", pinned: "dict[str, str]", kind: str) -> None:
    """Every already-pinned key must resolve to its pinned id. AD-3's whole guarantee.

    A key that is **not** yet pinned is a new entity — normal on a growing corpus — and
    must not fail; that is what lets the registry be populated one run at a time. What
    fails is a key whose pinned id and freshly minted id disagree, because that is an id
    changing after it was emitted.
    """
    for key in sorted(resolved):
        pin = pinned.get(key)
        if pin is not None and pin != resolved[key]:
            raise SlugRegistryError(
                f"{kind} {key!r} is pinned to {pin!r} but this run mints {resolved[key]!r}; "
                f"an id, once emitted, never changes (AD-3). If the change is intended, "
                f"add an OVERRIDES entry or regenerate with --write-registry deliberately"
            )


def check_overrides(resolved_players: "dict[str, str]", overrides: "dict[str, str]") -> None:
    """An override naming a key that resolves to nobody — or naming a malformed id — is fatal.

    A stale override is how a registry rots silently: it sits there looking authoritative
    while naming a player who left the corpus three runs ago.

    The value is gated too, and not only where it is applied. `OVERRIDES` is the one map a
    human hand-edits, and an entry whose key resolves to nobody would otherwise be
    reported while an entry whose *value* is malformed sailed through into `PINS`.
    """
    for key in sorted(overrides):
        gate_override(overrides[key], key)
        if key not in resolved_players:
            raise SlugRegistryError(
                f"OVERRIDES names {key!r} -> {overrides[key]!r}, but no player resolves "
                f"to that key; a stale override must be removed, not carried"
            )


# The id-bearing keys of a committed match bundle. Read from the contract's own field
# names rather than inferred, so a bundle carrying an id under a key not listed here is
# invisible to this check — stated plainly because it bounds what the check proves.
COMMITTED_ID_KEYS: dict[str, str] = {
    "matchId": "matches",
    "teamId": "teams",
    "winnerTeamId": "teams",
    "playerId": "players",
    "scorerPlayerId": "players",
    "fromPlayerId": "players",
    "toPlayerId": "players",
}

DATA_BASELINE_UNAVAILABLE = (
    "committed /data baseline unavailable: no match bundles found under {path} — "
    "the registry is the ONLY immutability source for this run. This is NOT a pass."
)


def check_committed_data(pins: "dict[str, dict[str, str]]", data_dir: "str | Path") -> list[str]:
    """AC 3's second source: every id in a committed bundle must be pinned.

    Returns human-readable notes for the CLI to print. Raises `SlugRegistryError` on a
    committed id the registry does not pin — that is an id already emitted into `/data`
    that this run no longer stands behind.

    **When `data/matches/` is absent this returns the "unavailable" note and never
    reports success.** `data/matches/` does not exist yet; it arrives with Story 1.16. A
    naive `if not exists: return []` here would be a gate that cannot fail, which is worse
    than no gate at all because it reads green.
    """
    matches_dir = Path(data_dir) / "matches"
    bundles = sorted(matches_dir.glob("*.json")) if matches_dir.is_dir() else []
    if not bundles:
        return [DATA_BASELINE_UNAVAILABLE.format(path=matches_dir.as_posix())]

    pinned_by_kind = {kind: set(mapping.values()) for kind, mapping in pins.items()}
    unpinned: list[str] = []
    seen = 0

    def walk(node, path: str, bundle: str) -> None:
        nonlocal seen
        if isinstance(node, dict):
            for key, value in node.items():
                kind = COMMITTED_ID_KEYS.get(key)
                if kind is not None:
                    seen += 1
                    if not isinstance(value, str):
                        # Reported, not skipped: a bundle carrying `playerId: null` would
                        # otherwise go uncounted and the run would print "all pinned".
                        unpinned.append(
                            f"{bundle}{path}.{key} = {value!r} (non-string {kind} id)"
                        )
                    elif value not in pinned_by_kind.get(kind, set()):
                        unpinned.append(f"{bundle}{path}.{key} = {value!r} ({kind})")
                walk(value, f"{path}.{key}", bundle)
        elif isinstance(node, list):
            for item in node:
                walk(item, f"{path}[]", bundle)

    for bundle in bundles:
        try:
            doc = json.loads(bundle.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SlugRegistryError(
                f"committed bundle {bundle.as_posix()!r} is unreadable: {exc}"
            )
        walk(doc, "", bundle.name)

    if unpinned:
        shown = "; ".join(sorted(unpinned)[:10])
        raise SlugRegistryError(
            f"{len(unpinned)} id(s) in committed /data are not pinned by the registry: "
            f"{shown}{' …' if len(unpinned) > 10 else ''}"
        )
    return [
        f"committed /data baseline: {len(bundles)} bundle(s), "
        f"{seen} id reference(s), all pinned"
    ]


# --------------------------------------------------------------------------- rounds


def matchday_rounds(records: "list[dict]") -> dict[str, str]:
    """`{match_id: matchday_round}` via `pipeline.discover.rounds`.

    `matchdayRound` is `required` in both bundle schemas and **no extractor produces it**,
    so it is derived here. The corpus-level rule already exists and is reused whole; its
    enum is exactly `rounds.ROUNDS`, so no mapping layer is needed.

    **This is the one place the record's top-level `metadata` block is authoritative over
    `domains.match_metadata`, and getting it wrong is fatal rather than merely wrong:**
    `assign_matchday_rounds` needs `stage_text` (absent from `domains`), an uppercase
    `group` (`domains` carries `"a"`), and a `"H:MM"` kickoff — `ReportMeta.kickoff_sort_key`
    does `int(kickoff.partition(":")[0])`, so `domains`' full ISO form
    `"2026-06-11T13:00:00-06:00"` raises `ValueError` on the very first sort. Everywhere
    else in this package the opposite rule holds and `domains` wins.

    Measured against the shipped record shape rather than assumed: the `metadata` block
    carries neither `report_id` nor `source_path`, so both come from the record's top
    level. Any non-empty `problems` is a failure, never a guess.
    """
    import datetime as dt

    from pipeline.discover.probe import ReportMeta
    from pipeline.discover.rounds import assign_matchday_rounds

    metas = []
    for record in records:
        metadata = record.get("metadata")
        if not isinstance(metadata, dict):
            raise PrecomputeError(
                f"record {record.get('match_id')!r} carries no top-level metadata block, "
                f"which is the only source of stage_text, an uppercase group and the "
                f"'H:MM' kickoff the round derivation needs",
                record.get("report_id"),
            )
        required = (
            "home_team", "away_team", "home_score", "away_score",
            "stage_text", "group", "kickoff", "venue",
        )
        absent = [key for key in required if key not in metadata]
        if absent:
            raise PrecomputeError(
                f"record {record.get('match_id')!r} metadata lacks {absent!r}; "
                f"a ReportMeta cannot be reconstructed from it",
                record.get("report_id"),
            )
        try:
            match_date = dt.date.fromisoformat(metadata["match_date"])
        except (KeyError, TypeError, ValueError) as exc:
            raise PrecomputeError(
                f"record {record['match_id']!r} has an unusable match date "
                f"{metadata.get('match_date')!r}: {exc}",
                record.get("report_id"),
            )
        metas.append(
            ReportMeta(
                report_id=record["report_id"],
                source_path=record.get("source_pdf", ""),
                home_team=metadata["home_team"],
                away_team=metadata["away_team"],
                home_score=metadata["home_score"],
                away_score=metadata["away_score"],
                stage_text=metadata["stage_text"],
                group=metadata["group"],
                match_date=match_date,
                kickoff=metadata["kickoff"],
                venue=metadata["venue"],
                shootout=metadata.get("shootout"),
                probe_notes=tuple(metadata.get("probe_notes") or ()),
            )
        )

    assigned, problems = assign_matchday_rounds(metas)
    if problems:
        detail = "; ".join(f"{report_id}: {reason}" for report_id, reason in problems)
        # Lead with the corpus-completeness diagnosis, because that is almost always the
        # real cause and the group-arithmetic detail reads as an unrelated defect.
        # `assign_matchday_rounds` derives a group's rounds only when it holds all 6 of
        # its fixtures, so ANY partial corpus lands here — a spike run, a re-extract of
        # one match, a manifest filtered by hand. Precompute is corpus-complete by
        # construction: it resolves a namespace over the whole tournament, and
        # `matchdayRound` is `required` by both bundle schemas, so staging a spine with
        # the field missing or guessed would only move this failure into Story 1.16.
        # Ruled by Story 1.15's code review (Decision 3): refuse, do not soften.
        raise PrecomputeError(
            f"matchday rounds are not derivable for {len(problems)} of {len(records)} "
            f"record(s). Precompute runs over the COMPLETE corpus — a group's rounds are "
            f"derivable only when all 6 of its fixtures are present — so a partial "
            f"manifest cannot be precomputed. Re-run the batch over the full corpus, or "
            f"pass --expect-records to fail earlier and more plainly. Detail: {detail}"
        )

    by_report = {record["report_id"]: record["match_id"] for record in records}
    rounds = {by_report[meta.report_id]: meta.matchday_round for meta in assigned}
    missing = sorted(match_id for match_id, value in rounds.items() if value is None)
    if missing:
        raise PrecomputeError(
            f"matchday round resolved to None for {len(missing)} match(es): {missing}"
        )
    return dict(sorted(rounds.items()))


# --------------------------------------------------------------------------- registry


_REGISTRY_HEADER = '''"""The committed slug registry — the artifact that outlives the code (AD-3).

GENERATED by `python -m pipeline.precompute.run --write-registry`. Do not hand-edit the
generated maps; edit `OVERRIDES` and regenerate. All four maps are sorted by key so a
`git diff` of a regeneration reads as exactly the entities that changed.

**This module is Python for a load-bearing reason, not a style preference.** AD-8 requires
the code version to include the committed slug registry, and `code_version()` fingerprints
`pipeline/**/*.py`. A registry landing as `.json`, `.csv` or `.yaml` falls outside that
glob, so the AD-8 guarantee would silently stop covering it. Moving this file to JSON
therefore also requires widening `EXTRA_FINGERPRINTED_FILES` in
`pipeline/ingest/fingerprint.py` — a step a future editor can forget, and whose failure is
silent. (That alternative was considered and rejected for exactly that reason.)

Committing this file changes `code_version()` by construction, which invalidates every
staged Extraction Record and forces one full re-extract. That is the fingerprint working
as designed, not a defect.

The pin key is `(team_id, shirt_number)`, serialized `f"{team_id}#{shirt_number}"`.
`team_id` rather than `team_code` because it is what 25,764 of the corpus's 26,180 team
references already carry.

`OVERRIDES` is the manual correction map AD-3 calls the "override map". It is applied
BEFORE pinning, so an override is what gets pinned. It ships **empty**: 219 players slug
in given-name-first order under the as-listed fallback, every one unique and
deterministic, and which of those (if any) should be re-ordered is a UX ruling, not an
implementation detail. An override naming a key that resolves to nobody fails loud.
"""

from __future__ import annotations

'''


def _render_map(name: str, annotation: str, mapping: "dict[str, str]") -> str:
    if not mapping:
        return f"{name}: {annotation} = {{}}\n"
    lines = [f"{name}: {annotation} = {{"]
    for key in sorted(mapping):
        lines.append(f"    {key!r}: {mapping[key]!r},")
    lines.append("}\n")
    return "\n".join(lines)


def render_registry(
    codes: "dict[str, str]", pins: "dict[str, dict[str, str]]", overrides: "dict[str, str]"
) -> str:
    """The registry module's full source text.

    Byte-identical across runs by construction: every map is sorted by key, the formatting
    is fixed, and nothing here reads the clock, the filesystem or the environment. A
    regenerate-and-compare test pins that.
    """
    parts = [_REGISTRY_HEADER]
    parts.append("# team_id -> team_code, parsed from report ids and asserted 1:1.\n")
    parts.append(_render_map("TEAM_CODES", "dict[str, str]", codes))
    parts.append("\n")
    parts.append(
        "# The minted namespace. players: f\"{team_id}#{shirt}\" -> player_id;\n"
        "# teams: team_id -> team_id; matches: report_id -> match_id.\n"
    )
    parts.append("PINS: dict[str, dict[str, str]] = {\n")
    for kind in ("matches", "players", "teams"):
        mapping = pins.get(kind, {})
        if not mapping:
            parts.append(f"    {kind!r}: {{}},\n")
            continue
        parts.append(f"    {kind!r}: {{\n")
        for key in sorted(mapping):
            parts.append(f"        {key!r}: {mapping[key]!r},\n")
        parts.append("    },\n")
    parts.append("}\n\n")
    parts.append('# Manual corrections, applied BEFORE pinning. f"{team_id}#{shirt}" -> player_id.\n')
    parts.append(_render_map("OVERRIDES", "dict[str, str]", overrides))
    return "".join(parts)


def write_registry(text: str, path: "str | Path") -> Path:
    """Write the registry source with LF endings and a trailing newline, atomically.

    `newline=""` for the same reason `pipeline/ingest/records.py` uses it: without it
    Windows translates `\\n` to CRLF and two hosts regenerating the same registry would
    produce different bytes, which is precisely what the determinism test forbids.

    Written to a sibling temp file and moved into place with `os.replace`, following
    `pipeline/ingest/records.py`'s canonical writer. Not a nicety: this module is imported
    at load by `pipeline/validate/checks.py`, so a regeneration interrupted mid-write
    would otherwise leave a truncated, unparseable registry that takes the whole validate
    CLI down with an `ImportError` rather than a typed failure.
    """
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not text.endswith("\n"):
        text += "\n"
    temporary = target.with_name(target.name + ".tmp")
    temporary.write_text(text, encoding="utf-8", newline="")
    os.replace(temporary, target)
    return target


def build_pins(
    records: "list[dict]", codes: "dict[str, str]", registry
) -> dict[str, dict[str, str]]:
    """The full minted namespace: players, teams and matches, all sorted."""
    players = {
        pin_key(team_id, shirt): slug
        for (team_id, shirt), slug in resolve_players(records, codes, registry).items()
    }
    return {
        "matches": resolve_matches(records),
        "players": dict(sorted(players.items())),
        "teams": resolve_teams(records),
    }


def team_code_collisions(codes: "dict[str, str]") -> "dict[str, list[str]]":
    """`{team_code: [team_id, …]}` for any code serving more than one team.

    `team_codes` already raises on this during the parse; this is the same fact recomputed
    over an arbitrary committed map, so the FR-15 gate and the registry test can assert it
    without re-walking 104 reports.
    """
    by_code: dict[str, list[str]] = defaultdict(list)
    for team_id, code in codes.items():
        by_code[code].append(team_id)
    return {code: sorted(teams) for code, teams in by_code.items() if len(teams) > 1}

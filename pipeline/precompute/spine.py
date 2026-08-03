"""The normalized spine: every Extraction Record with resolved ids added beside names.

Staged to `work/spine/`, so keys are `snake_case` (AD-9). The camelCase mapping, the
`schemaVersion` stamp, the budget measurement and emission into `/data` are Story 1.16's;
`entities.json` is modelled on the committed `data/fixtures/index/tournament.json`
`entities` block precisely so 1.16 emits from it without a reshape.

THE SPINE ADDS IDS. IT NEVER REMOVES NAMES.
-------------------------------------------
`playerName` is `required` in eight `$defs` of `match-bundle.schema.json` — `ShotEvent`,
`CrossEvent`, `PassNetworkNode`, `ReceivingEvent`, `DefensiveActionEvent`,
`GoalkeeperRecord`, `PlayerRecord`, `ShootoutAttempt` — and every committed fixture row
carries `playerId` **and** `playerName` side by side. A name-stripping spine could not be
emitted from at all. So `work/spine/matches/{match_id}.json` is the record's `domains`
block **structurally unchanged, with an `*_id` field ADDED beside every name field**,
plus a small `spine` header. No key removed, no list reordered, nothing deduped: a reader
diffing a record against its spine file must see only additions.

Because the spine only adds, the exhaustiveness assertion is the **inverse** of a
coverage list: walk the staged spine and assert that every string equal to a known player
name has a resolved id sibling on the same object, and every display team name a
`team_id` sibling. That is what makes the path inventory self-maintaining — a name path
added by a future story fails loudly here instead of passing through unresolved. A
hardcoded list of 25 paths would silently stop being complete the day the 26th arrived.

RESOLUTION KEYS
---------------
23 of the 25 name paths carry a `shirt_number` companion, so they resolve on
`(side, shirt_number)` with the **name as the corroborating key** — the inverse of the
extract layer's convention, and correct here for a reason: the extract layer had no
cross-report anchor and this phase does. `(team_id, shirt_number)` is globally unique on
this corpus (measured: 0 shirts worn by two players, 0 players wearing two shirts).

The two `receiving.offers.{side}.most_offers` paths carry **no shirt** — 208 occurrences,
keys `{player_name, position, value}` only — so they resolve by verbatim name against
that match's lineup index, exactly as the extract layer joins. They are not skipped: they
are a required Story 1.16 input.
"""

from __future__ import annotations

from pathlib import Path

from pipeline.ingest.fingerprint import code_version
from pipeline.ingest.identity import team_slug
from pipeline.ingest.records import write_canonical
from pipeline.precompute.errors import SpineError
from pipeline.precompute.identity import SIDES, lineup_entries, slug_sources
from pipeline.precompute.records import DEFAULT_MANIFEST_PATH, DEFAULT_SPINE_DIR

SPINE_VERSION = 1
GENERATED_BY = "pipeline.precompute.spine"

# `{name key: id key}` for every object shape the records use. Both spellings exist
# because the extract layer grew them independently; the spine adds the matching id
# spelling beside each rather than normalizing the name key, which would be a removal.
NAME_TO_ID_KEY: dict[str, str] = {
    "name": "player_id",
    "player_name": "player_id",
    "from_name": "from_player_id",
    "to_name": "to_player_id",
}

# The name keys that sit beside their own shirt number, and under which key.
SHIRT_KEY_FOR_NAME: dict[str, str] = {
    "name": "shirt_number",
    "player_name": "shirt_number",
    "from_name": "from_shirt",
    "to_name": "to_shirt",
}


def team_id_key_for(name_key: str) -> str:
    """The `*_team_id` sibling key for a display-team-name key.

    `home` -> `home_team_id`, `winner` -> `winner_team_id`, and a key that already ends in
    `_name` swaps that suffix (`team_name` -> `team_id`). One function so the producer in
    `_add_ids` and the checker in `assert_every_name_resolved` can never drift apart —
    when they did, a team name under any key but `home`/`away` got no id and raised
    nothing.
    """
    if name_key.endswith("_name"):
        return f"{name_key[: -len('_name')]}_team_id"
    return f"{name_key}_team_id"


def _code_for(codes: "dict[str, str]", team_id: str, record: dict) -> str:
    """`codes[team_id]`, typed. A bare `KeyError` here would surface as exit 2 — a broken
    harness — for what is a dataset finding, which is exactly the distinction
    `errors.py` exists to preserve."""
    code = codes.get(team_id)
    if code is None:
        raise SpineError(
            f"team {team_id!r} has no team code; it appears in "
            f"{record.get('match_id')!r} but in no report id",
            record.get("report_id"),
        )
    return code


def _match_index(record: dict, resolved: "dict[tuple[str, int], str]") -> dict:
    """Per-match lookups: `(side, shirt) -> player_id` and `(side, name) -> player_id`.

    The by-name index is built per side and is allowed to be ambiguous only in the sense
    that two players on one side could share a printed name — measured 0 on this corpus,
    and asserted here rather than assumed, because `most_offers` has nothing else to
    resolve on.
    """
    by_shirt: dict[tuple[str, int], str] = {}
    by_name: dict[tuple[str, str], str] = {}
    ambiguous: set[tuple[str, str]] = set()
    team_ids: dict[str, str] = {}

    for side, _section, team_id, entry in lineup_entries(record):
        team_ids[side] = team_id
        shirt = entry["shirt_number"]
        player_id = resolved.get((team_id, shirt))
        if player_id is None:
            raise SpineError(
                f"lineup entry {entry['name']!r} (team {team_id!r} shirt {shirt}) has no "
                f"resolved player id",
                record.get("report_id"),
            )
        by_shirt[(side, shirt)] = player_id
        key = (side, entry["name"])
        if key in by_name and by_name[key] != player_id:
            ambiguous.add(key)
        by_name[key] = player_id

    for side, name in sorted(ambiguous):
        raise SpineError(
            f"name {name!r} is worn by two players on the {side} side; it cannot be "
            f"resolved by name alone, which `receiving.offers.{side}.most_offers` requires",
            record.get("report_id"),
        )

    return {"by_shirt": by_shirt, "by_name": by_name, "team_ids": team_ids}


def _side_of(path: str) -> str | None:
    """The `home`/`away` side a JSON path sits under, or `None`.

    Read from the path rather than from the payload because the side is structural: it is
    which key of the domain the object hangs from, and no row carries it.
    """
    parts = path.split(".")
    for part in reversed(parts):
        stem = part.split("[")[0]
        if stem in SIDES:
            return stem
    return None


def _add_ids(node, path: str, index: dict, team_ids_by_name: dict, record: dict):
    """Return `node` with `*_id` fields added beside every name field. Purely additive."""
    if isinstance(node, list):
        return [_add_ids(item, f"{path}[]", index, team_ids_by_name, record) for item in node]
    if not isinstance(node, dict):
        return node

    result = {
        key: _add_ids(value, f"{path}.{key}", index, team_ids_by_name, record)
        for key, value in node.items()
    }

    side = _side_of(path)
    # Two name keys map to `player_id` (`name` and `player_name`). An object carrying
    # both would have the second silently overwrite the first, so it is refused rather
    # than resolved — measured 0 such objects, and a future one is a shape question for
    # whoever adds it, not something to guess at.
    written_by: dict[str, str] = {}
    for name_key, id_key in NAME_TO_ID_KEY.items():
        value = node.get(name_key)
        if not isinstance(value, str):
            continue
        if id_key in written_by:
            raise SpineError(
                f"{path} carries both {written_by[id_key]!r} and {name_key!r}, which both "
                f"resolve to {id_key!r}; one would silently overwrite the other",
                record.get("report_id"),
            )
        # A team name under a `name` key is a TEAM reference, not a player one, and gets
        # its id from the team branch below. Measured 0 overlap between the 48 printed
        # team names and the 1,247 printed player names — and if that ever stopped being
        # true, `assert_every_name_resolved` fails on the missing player id rather than
        # letting the name through silently.
        if value in team_ids_by_name:
            continue
        written_by[id_key] = name_key
        result[id_key] = _resolve_name(node, name_key, value, side, path, index, record)

    # Display team names -> team_id, added beside rather than replacing. The id key is
    # derived from whatever key the name sits under — NOT restricted to `home`/`away`.
    # Gating on `key in SIDES` would leave a team name under `winner`, `team_name` or
    # `opponent` with no id AND no failure, because `assert_every_name_resolved` skipped
    # exactly the same keys; the team half of the exhaustiveness guarantee was vacuous
    # everywhere but the two side keys.
    for key, value in node.items():
        if isinstance(value, str) and value in team_ids_by_name:
            result[team_id_key_for(key)] = team_ids_by_name[value]
    return result


def _resolve_name(
    node: dict, name_key: str, value: str, side: "str | None", path: str, index: dict, record: dict
) -> str:
    """One name -> one player id, on the shirt when there is one and the name when not."""
    if side is None:
        # Only `shots.shot_events[]` has no side in its path; it carries `team_id`.
        team_id = node.get("team_id")
        side = next(
            (s for s, t in index["team_ids"].items() if t == team_id), None
        )
        if side is None:
            raise SpineError(
                f"{path}.{name_key} = {value!r} sits under no side and its team_id "
                f"{team_id!r} matches neither team",
                record.get("report_id"),
            )

    shirt_key = SHIRT_KEY_FOR_NAME[name_key]
    shirt = node.get(shirt_key)
    if shirt_key in node and (not isinstance(shirt, int) or isinstance(shirt, bool)):
        # Present but unusable is a defect, not an invitation to fall through to the
        # name-only branch: that branch is for the two `most_offers` paths, which carry no
        # shirt key at all, and silently taking it here would skip the corroboration the
        # 23 shirt-bearing paths exist to get.
        raise SpineError(
            f"{path}.{shirt_key} = {shirt!r} is not an integer, so {value!r} cannot be "
            f"resolved on its shirt number",
            record.get("report_id"),
        )
    if isinstance(shirt, int) and not isinstance(shirt, bool):
        player_id = index["by_shirt"].get((side, shirt))
        if player_id is None:
            raise SpineError(
                f"{path}: {side} shirt {shirt} ({value!r}) is in no lineup",
                record.get("report_id"),
            )
        # The name corroborates the shirt. `repr()` deliberately: a mis-inserted space
        # breaks a join on a name that looks right in a plain message.
        corroborating = index["by_name"].get((side, value))
        if corroborating is not None and corroborating != player_id:
            raise SpineError(
                f"{path}: name {value!r} resolves to {corroborating!r} but {side} shirt "
                f"{shirt} resolves to {player_id!r}",
                record.get("report_id"),
            )
        if corroborating is None:
            raise SpineError(
                f"{path}: name {value!r} is in no {side} lineup, though shirt {shirt} "
                f"resolves to {player_id!r}",
                record.get("report_id"),
            )
        return player_id

    # No shirt companion — `receiving.offers.{side}.most_offers` is the only such path.
    player_id = index["by_name"].get((side, value))
    if player_id is None:
        raise SpineError(
            f"{path}.{name_key} = {value!r} carries no shirt number and matches no "
            f"{side} lineup name",
            record.get("report_id"),
        )
    return player_id


def build_match_spine(
    record: dict, resolved: "dict[tuple[str, int], str]", rounds: "dict[str, str]"
) -> dict:
    """One record's `domains` block with ids added, under a `spine` header."""
    index = _match_index(record, resolved)
    teams = record["domains"]["match_metadata"]["teams"]
    team_ids_by_name = {name: team_slug(name) for name in teams.values()}
    match_id = record["match_id"]
    if match_id not in rounds:
        raise SpineError(
            f"record {match_id!r} has no derived matchday round, which is required by "
            f"both bundle schemas",
            record.get("report_id"),
        )

    domains = _add_ids(record["domains"], "domains", index, team_ids_by_name, record)
    return {
        "spine": {
            "match_id": match_id,
            "report_id": record["report_id"],
            "home_team_id": team_slug(teams["home"]),
            "away_team_id": team_slug(teams["away"]),
            "matchday_round": rounds[match_id],
        },
        "domains": domains,
    }


def assert_every_name_resolved(
    spine: dict, known_names: "set[str]", team_names: "set[str]", report_id: "str | None"
) -> None:
    """The inverse exhaustiveness check (see the module docstring).

    Every string equal to a known player name must have a resolved id sibling on the same
    object; every display team name must have a `*_team_id` sibling. This is what makes
    the inventory self-maintaining: a name path a future story adds fails here.

    `known_names` is **this match's own lineup names**, not the corpus's. A corpus-wide
    set is wrong in both directions: it raises on a sound record that happens to print a
    non-player string (a coach, an official) equal to one of 1,247 names from other
    matches, and it still misses a name path whose spelling differs from the lineup. The
    question this check asks is per-match by nature — "does every player name in THIS
    match's spine resolve against THIS match's lineup".
    """

    def walk(node, path: str) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item, f"{path}[]")
            return
        if not isinstance(node, dict):
            return
        for key, value in node.items():
            if isinstance(value, str) and value in known_names:
                id_key = NAME_TO_ID_KEY.get(key)
                if id_key is None or id_key not in node:
                    raise SpineError(
                        f"{path}.{key} = {value!r} is a known player name but the object "
                        f"carries no resolved id sibling "
                        f"({id_key or 'no id key is mapped for this name key'})",
                        report_id,
                    )
            elif isinstance(value, str) and value in team_names:
                team_id_key = team_id_key_for(key)
                if team_id_key not in node:
                    raise SpineError(
                        f"{path}.{key} = {value!r} is a display team name with no "
                        f"{team_id_key} sibling",
                        report_id,
                    )
            walk(value, f"{path}.{key}")

    walk(spine["domains"], "domains")


def build_spine(
    records: "list[dict]",
    resolved: "dict[tuple[str, int], str]",
    codes: "dict[str, str]",
    rounds: "dict[str, str]",
    registry=None,
    source_manifest: str = str(DEFAULT_MANIFEST_PATH.as_posix()),
) -> dict:
    """The whole spine: `entities` plus one entry per match.

    Entities are sorted by id; per-match rows keep their printed order and are never
    deduped (AD-8). Nothing here reads the clock or an absolute path, so two runs over an
    unchanged corpus produce identical bytes.

    `registry` supplies `OVERRIDES` for the diagnostic `slug_source`. It is optional so
    the four-positional call the story pins keeps working — but `slug_source` is populated
    either way: `slug_sources` reads overrides with `getattr(registry, "OVERRIDES", {})`,
    so `None` simply means "no overrides", not "no diagnostic". Returning `None` for every
    player here would have made Task 7.3's filing — defined as a query over `slug_source`
    — unanswerable from a spine built through the pinned API.
    """
    sources = slug_sources(records, codes, registry)

    teams: dict[str, dict] = {}
    players: dict[str, dict] = {}
    matches: list[dict] = []
    # Per match, not corpus-wide — see `assert_every_name_resolved`.
    names_by_match: dict[str, set[str]] = {}
    team_names_by_match: dict[str, set[str]] = {}

    for record in records:
        match_id = record["match_id"]
        mm = record["domains"]["match_metadata"]
        printed = mm["teams"]
        team_names_by_match.setdefault(match_id, set()).update(printed.values())
        known_names = names_by_match.setdefault(match_id, set())

        for side in SIDES:
            team_id = team_slug(printed[side])
            entry = teams.setdefault(
                team_id,
                {
                    "team_id": team_id,
                    "team_code": _code_for(codes, team_id, record),
                    "name": printed[side],
                    "group": mm.get("group"),
                    "match_ids": [],
                },
            )
            entry["match_ids"].append(match_id)

        for _side, _section, team_id, lineup in lineup_entries(record):
            shirt = lineup["shirt_number"]
            player_id = resolved.get((team_id, shirt))
            if player_id is None:
                raise SpineError(
                    f"lineup entry {lineup['name']!r} (team {team_id!r} shirt {shirt}) "
                    f"has no resolved player id",
                    record.get("report_id"),
                )
            known_names.add(lineup["name"])
            player = players.setdefault(
                player_id,
                {
                    "player_id": player_id,
                    "name": lineup["name"],
                    "team_id": team_id,
                    "team_code": _code_for(codes, team_id, record),
                    "shirt_number": shirt,
                    "position": lineup.get("position"),
                    "match_ids": [],
                    "slug_source": sources.get((team_id, shirt)),
                },
            )
            if match_id not in player["match_ids"]:
                player["match_ids"].append(match_id)

        absent = [key for key in ("stage", "venue", "date", "kickoff", "score") if key not in mm]
        if absent or "match_number" not in record.get("metadata", {}):
            raise SpineError(
                f"record {match_id!r} cannot describe its match: match_metadata lacks "
                f"{absent!r}" + ("" if "match_number" in record.get("metadata", {})
                                 else " and metadata lacks 'match_number'"),
                record.get("report_id"),
            )
        if match_id not in rounds:
            raise SpineError(
                f"record {match_id!r} has no derived matchday round, which is required "
                f"by both bundle schemas",
                record.get("report_id"),
            )

        matches.append(
            {
                "match_id": match_id,
                "match_number": record["metadata"]["match_number"],
                "report_id": record["report_id"],
                "stage": mm["stage"],
                "group": mm.get("group"),
                "matchday_round": rounds[match_id],
                "home_team_id": team_slug(printed["home"]),
                "away_team_id": team_slug(printed["away"]),
                "venue": mm["venue"],
                "date": mm["date"],
                "kickoff": mm["kickoff"],
                "score": mm["score"],
            }
        )

    match_spines = {}
    for record in records:
        match_id = record["match_id"]
        spine = build_match_spine(record, resolved, rounds)
        assert_every_name_resolved(
            spine,
            names_by_match[match_id],
            team_names_by_match[match_id],
            record.get("report_id"),
        )
        match_spines[match_id] = spine

    entities = {
        "spine_version": SPINE_VERSION,
        "generated_by": GENERATED_BY,
        "code_version": code_version(),
        "source_manifest": source_manifest,
        "teams": [teams[team_id] for team_id in sorted(teams)],
        "players": [players[player_id] for player_id in sorted(players)],
        "matches": sorted(matches, key=lambda m: m["match_id"]),
    }
    return {"entities": entities, "matches": match_spines}


def write_spine(spine: dict, spine_dir: "str | Path" = DEFAULT_SPINE_DIR) -> list[Path]:
    """Write `entities.json` and one file per match. Canonical serialization, reused.

    Match files this spine does not name are **removed**, not left behind. `work/spine/`
    is staging that Story 1.16 emits from, and a stale file from a superseded run would
    enter the dataset as a phantom match — the exact hazard `load_records` refuses the
    directory listing to prevent. Leaving them would put the hazard back one layer down.
    """
    spine_dir = Path(spine_dir)
    written = [write_canonical(spine["entities"], spine_dir / "entities.json")]
    for match_id in sorted(spine["matches"]):
        written.append(
            write_canonical(spine["matches"][match_id], spine_dir / "matches" / f"{match_id}.json")
        )

    matches_dir = spine_dir / "matches"
    if matches_dir.is_dir():
        current = set(spine["matches"])
        for stale in sorted(matches_dir.glob("*.json")):
            if stale.stem not in current:
                stale.unlink()
    return written

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
from pipeline.precompute.records import DEFAULT_SPINE_DIR

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
    for name_key, id_key in NAME_TO_ID_KEY.items():
        value = node.get(name_key)
        if not isinstance(value, str):
            continue
        # A team name under a `name` key is a TEAM reference, not a player one, and gets
        # its id from the team branch below. Measured 0 overlap between the 48 printed
        # team names and the 1,247 printed player names — and if that ever stopped being
        # true, `assert_every_name_resolved` fails on the missing player id rather than
        # letting the name through silently.
        if value in team_ids_by_name:
            continue
        result[id_key] = _resolve_name(node, name_key, value, side, path, index, record)

    # Display team names -> team_id, added beside rather than replacing.
    for key, value in node.items():
        if isinstance(value, str) and value in team_ids_by_name and key in SIDES:
            result[f"{key}_team_id"] = team_ids_by_name[value]
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
    if isinstance(shirt, int):
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

    domains = _add_ids(record["domains"], "domains", index, team_ids_by_name, record)
    return {
        "spine": {
            "match_id": record["match_id"],
            "report_id": record["report_id"],
            "home_team_id": team_slug(teams["home"]),
            "away_team_id": team_slug(teams["away"]),
            "matchday_round": rounds[record["match_id"]],
        },
        "domains": domains,
    }


def assert_every_name_resolved(
    spine: dict, known_names: "set[str]", team_names: "set[str]", report_id: "str | None"
) -> None:
    """The inverse exhaustiveness check (see the module docstring).

    Every string equal to a known player name must have a resolved id sibling on the same
    object; every display team name must have a `team_id` sibling. This is what makes the
    inventory self-maintaining: a name path a future story adds fails here.
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
                if key in SIDES and f"{key}_team_id" not in node:
                    raise SpineError(
                        f"{path}.{key} = {value!r} is a display team name with no "
                        f"{key}_team_id sibling",
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
) -> dict:
    """The whole spine: `entities` plus one entry per match.

    Entities are sorted by id; per-match rows keep their printed order and are never
    deduped (AD-8). Nothing here reads the clock or an absolute path, so two runs over an
    unchanged corpus produce identical bytes.
    """
    sources = slug_sources(records, codes, registry) if registry is not None else {}

    teams: dict[str, dict] = {}
    players: dict[str, dict] = {}
    matches: list[dict] = []
    known_names: set[str] = set()
    team_names: set[str] = set()

    for record in records:
        match_id = record["match_id"]
        mm = record["domains"]["match_metadata"]
        printed = mm["teams"]
        team_names.update(printed.values())

        for side in SIDES:
            team_id = team_slug(printed[side])
            entry = teams.setdefault(
                team_id,
                {
                    "team_id": team_id,
                    "team_code": codes[team_id],
                    "name": printed[side],
                    "group": mm.get("group"),
                    "match_ids": [],
                },
            )
            entry["match_ids"].append(match_id)

        for side, section, team_id, lineup in lineup_entries(record):
            shirt = lineup["shirt_number"]
            player_id = resolved[(team_id, shirt)]
            known_names.add(lineup["name"])
            player = players.setdefault(
                player_id,
                {
                    "player_id": player_id,
                    "name": lineup["name"],
                    "team_id": team_id,
                    "team_code": codes[team_id],
                    "shirt_number": shirt,
                    "position": lineup.get("position"),
                    "match_ids": [],
                    "slug_source": sources.get((team_id, shirt)),
                },
            )
            if match_id not in player["match_ids"]:
                player["match_ids"].append(match_id)
            _ = section  # carried by `lineup_entries` for `has_minutes`; unused here

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
        spine = build_match_spine(record, resolved, rounds)
        assert_every_name_resolved(spine, known_names, team_names, record.get("report_id"))
        match_spines[record["match_id"]] = spine

    entities = {
        "spine_version": SPINE_VERSION,
        "generated_by": GENERATED_BY,
        "code_version": code_version(),
        "source_manifest": "work/run-manifest.json",
        "teams": [teams[team_id] for team_id in sorted(teams)],
        "players": [players[player_id] for player_id in sorted(players)],
        "matches": sorted(matches, key=lambda m: m["match_id"]),
    }
    return {"entities": entities, "matches": match_spines}


def write_spine(spine: dict, spine_dir: "str | Path" = DEFAULT_SPINE_DIR) -> list[Path]:
    """Write `entities.json` and one file per match. Canonical serialization, reused."""
    spine_dir = Path(spine_dir)
    written = [write_canonical(spine["entities"], spine_dir / "entities.json")]
    for match_id in sorted(spine["matches"]):
        written.append(
            write_canonical(spine["matches"][match_id], spine_dir / "matches" / f"{match_id}.json")
        )
    return written

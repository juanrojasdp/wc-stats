"""Per-field fixed precision at the emit boundary (Story 1.16, AD-7/AD-8).

**Nothing else enforces this and no validator will catch you.** `multipleOf` appears zero
times in any `/contract` schema, deliberately: `contract/README.md:71-77` records that
validators implement it as a float modulo and reject correct data. Precision is declared
with the custom keyword `x-decimals`, which is legal JSON Schema, ignored by every
validator and ignored by the codegen. A bundle carrying 17-digit floats validates clean.
This module is the entire enforcement, and `contract/README.md:57-59` names Story 1.16 as
where it lands.

**Rounding is not cosmetic — it is what makes byte-identity possible.** `round()` on a
float is deterministic for a fixed input, but an unrounded float carries whatever the
arithmetic produced, so two code paths reaching the same value by different routes
serialize differently. Round at the emit boundary, once, per field.

**The map is built across BOTH documents, and that is load-bearing.** `walk_subschemas`
does not resolve `$ref` — it is a plain recursive walk over one document. Walking
`match-bundle.schema.json` alone yields exactly five `x-decimals` declarations
(`matchNumber`, `MomentumSample.home`, `.away`, `ShootoutAttempt.order`,
`PassNetworkEdge.volume`), ALL of them `0` and all integers. Every float precision sits in
`common.schema.json` behind a cross-document `$ref`, so a map built from the bundle
document alone rounds no float in the artifact, validates clean, and makes the precision
test green by vacuity. `test_the_map_is_not_built_by_walking_the_bundle_schema_alone`
pins that trap.

The table is DERIVED, never transcribed. A hardcoded copy is a second definition that goes
stale on the next `$def`.
"""

from __future__ import annotations

from pipeline.validate.schema import load_schemas, walk_subschemas

# The one document `match-bundle.schema.json` refs. Resolution is therefore one hop, not a
# general resolver; `pipeline.validate.schema.registry()` already does it properly if a
# successor artifact ever refs more than one.
_SHARED = "common.schema.json"


def _declared_places(node: dict) -> "int | None":
    """`x-decimals` for one subschema, including a declaration inside an `anyOf` branch.

    `StoppageMinute` is `anyOf: [{integer, x-decimals: 0}, {null}]` — the keyword is on the
    branch, not the `$def` root. A filter reading `node.get("x-decimals")` at `$def` level
    misses it. Harmless for that one (it is `0`), but the same shape on a float would ship
    unrounded, so the branch is read here rather than special-cased at the call site.
    """
    if "x-decimals" in node:
        return node["x-decimals"]
    for branch in node.get("anyOf", ()):
        if isinstance(branch, dict) and "x-decimals" in branch:
            return branch["x-decimals"]
    return None


def decimals_map(schema_name: str) -> "dict[str, int]":
    """Every named precision an artifact of `schema_name` can reach, keyed by name.

    Keys are `$def` names for the shared numeric types (`Percentage`, `Metres`, …) and
    `title`s for the precisions declared inline in the artifact document (`MatchNumber`,
    `MomentumHomeValue`, …). A Match Bundle reaches 11 shared `$defs` — the twelfth,
    `Rank`, is a leaderboard type no bundle field refs — plus 5 inline: 16 names.
    """
    schemas = load_schemas()
    if schema_name not in schemas:
        raise KeyError(f"unknown schema {schema_name!r}; have {sorted(schemas)}")

    document = schemas[schema_name]
    shared = schemas[_SHARED]

    # Which shared $defs does this document actually reach? Collect the $ref targets rather
    # than taking every $def in common.schema.json, so an unreachable type (Rank) does not
    # enter the map and make a coverage assertion pass for the wrong reason.
    reached: set[str] = set()
    for _pointer, node in walk_subschemas(document):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith(f"{_SHARED}#/$defs/"):
            reached.add(ref.rsplit("/", 1)[-1])

    # A shared $def may itself ref another ($ref chains inside common.schema.json), so
    # close the set over one more hop before reading precisions off it.
    frontier = set(reached)
    while frontier:
        name = frontier.pop()
        target = shared.get("$defs", {}).get(name)
        if not isinstance(target, dict):
            continue
        for _pointer, node in walk_subschemas(target):
            ref = node.get("$ref")
            if isinstance(ref, str) and "#/$defs/" in ref:
                nxt = ref.rsplit("/", 1)[-1]
                if nxt not in reached and (ref.startswith(f"{_SHARED}#") or ref.startswith("#")):
                    reached.add(nxt)
                    frontier.add(nxt)

    places: dict[str, int] = {}
    for name in sorted(reached):
        target = shared.get("$defs", {}).get(name)
        if isinstance(target, dict):
            declared = _declared_places(target)
            if declared is not None:
                places[name] = declared

    # The precisions declared inline in the artifact document itself, keyed by their title.
    for _pointer, node in walk_subschemas(document):
        declared = node.get("x-decimals")
        if declared is None:
            continue
        title = node.get("title")
        if title:
            places[title] = declared

    if not any(value >= 1 for value in places.values()):
        # The vacuity guard the story demands. Reaching here means the $ref hop failed and
        # every float in the artifact would ship unrounded while validating clean.
        raise AssertionError(
            f"decimals_map({schema_name!r}) found only integer precisions "
            f"({sorted(places.items())}). Every float precision lives in "
            f"{_SHARED} behind a cross-document $ref, so this means no $ref was "
            f"resolved and no float in the artifact would be rounded."
        )
    return places


def round_to_precision(node, decimals: int):
    """Round one numeric leaf to `decimals` places, leaving every other value untouched.

    `bool` is checked before `int`/`float` because it is an `int` subclass: rounding one
    would turn `ownGoal: false` into `0` and fail the contract's `type: boolean`.

    `decimals == 0` returns a Python `int`, not a rounded float. `Count`, `Minute`,
    `ShirtNumber` and friends are `type: integer`, and `3.0` fails that in jsonschema.
    """
    if isinstance(node, bool) or node is None:
        return node
    if isinstance(node, int):
        return node if decimals else int(node)
    if isinstance(node, float):
        return int(round(node)) if decimals == 0 else round(node, decimals)
    return node

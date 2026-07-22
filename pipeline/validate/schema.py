"""Load /contract and validate artifacts against it.

AD-1 draws the two-system boundary at `/data` + `/contract`: this module reads the schemas
and nothing else imports them. AD-2 makes the schemas the single definition, so validation
here and the TypeScript the App consumes are two projections of one source.

Cross-file `$ref` resolution goes through a `referencing.Registry`. `jsonschema.RefResolver`
is deprecated and must not be used -- essentially every pre-2023 tutorial shows it.

Format assertion (`"date"`, `"date-time"`) is OFF by default in jsonschema and has to be
opted into with an explicit `format_checker`, which is what the `[format]` extra in
pipeline/requirements.txt exists to support. Without both, a kickoff of `"not a time"`
validates clean.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from pipeline.validate.errors import SchemaNotFoundError, SchemaValidationError

CONTRACT_DIR = Path(__file__).resolve().parents[2] / "contract"
VERSION_PATH = CONTRACT_DIR / "version.json"

# Keywords banned by AD-2's draft-07-compatible subset of 2020-12. Every one of these either
# has no draft-07 equivalent or changes the meaning of a schema that also validates under
# draft-07, so allowing one would quietly break the compatibility the contract claims.
BANNED_KEYWORDS: tuple[str, ...] = (
    "prefixItems",
    "unevaluatedProperties",
    "unevaluatedItems",
    "dependentSchemas",
    "dependentRequired",
    "$dynamicRef",
    "$dynamicAnchor",
    "$recursiveRef",
    "$recursiveAnchor",
    "minContains",
    "maxContains",
)


def schema_paths() -> "list[Path]":
    """Every schema file in /contract, in a stable order."""
    return sorted(CONTRACT_DIR.glob("*.schema.json"))


@lru_cache(maxsize=1)
def schema_version() -> int:
    """The one global `schemaVersion`, read from /contract/version.json (AD-2).

    Never hard-code this anywhere else; a second copy is exactly the drift AD-2 prevents.
    """
    contents = json.loads(VERSION_PATH.read_text(encoding="utf-8"))
    keys = sorted(contents)
    if keys != ["schemaVersion"]:
        raise ValueError(
            f"{VERSION_PATH} must hold exactly one key 'schemaVersion', found: {keys}"
        )
    version = contents["schemaVersion"]
    if not isinstance(version, int) or isinstance(version, bool):
        # `{"schemaVersion": 1.0}` reaches here as a float. Node's `Number.isInteger(1.0)` is
        # true, so the generator would happily write `SCHEMA_VERSION = 1` while this side
        # raised -- the two readers of the single version source disagreeing about what it
        # says. Both ends now reject the float form, and the message says why.
        raise TypeError(
            f"{VERSION_PATH}: schemaVersion must be a plain integer, got {version!r}. "
            "The float form 1.0 is accepted by the Node generator and rejected here, "
            "which would split the two readers of the single version source."
        )
    return version


@lru_cache(maxsize=1)
def load_schemas() -> "dict[str, dict]":
    """Every schema keyed by its bare filename, e.g. `"match-bundle.schema.json"`."""
    return {
        path.name: json.loads(path.read_text(encoding="utf-8")) for path in schema_paths()
    }


@lru_cache(maxsize=1)
def registry() -> Registry:
    """A `referencing` registry that resolves both `$id` URIs and bare filenames.

    Both are needed: the schemas reference each other by relative filename
    (`"common.schema.json#/$defs/TeamId"`), while each document identifies itself by its
    absolute `$id`. Registering only one form leaves half the refs unresolvable.
    """
    resources = []
    for name, contents in load_schemas().items():
        resource = Resource.from_contents(contents, default_specification=DRAFT202012)
        resources.append((name, resource))
        if "$id" in contents:
            resources.append((contents["$id"], resource))
    return Registry().with_resources(resources)


def validator_for(schema_name: str) -> Draft202012Validator:
    """A format-checking validator for one named schema."""
    schemas = load_schemas()
    if schema_name not in schemas:
        raise SchemaNotFoundError(schema_name, list(schemas))
    return Draft202012Validator(
        schemas[schema_name],
        registry=registry(),
        format_checker=Draft202012Validator.FORMAT_CHECKER,
    )


def _leaf_violations(error: object) -> "list[str]":
    """Flatten one error into `"<pointer>: <message>"` strings, following `anyOf` branches.

    Without this, every nullable field in the contract reports uselessly. `momentum` is
    `anyOf: [MomentumSeries, null]`, so one bad `samples[0].minute` surfaced as a single error
    reading "<the entire 19-sample series> is not valid under any of the given schemas" -- no
    pointer to the offending field, no mention of the constraint it broke. The real diagnosis
    lives in `error.context`, which the caller never read. This affects every nullable field:
    shots, goalkeeping, players, scoreAfterET, shootoutScore, expectedGoals, stoppageMinute.

    Among the failed branches keep only those that got FURTHEST into the instance before
    failing -- the heuristic jsonschema's own `best_match` uses. For `X | null` that reliably
    picks the X branch over the null branch, which is what the author meant, instead of
    reporting both "is not of type 'null'" and the real cause with equal weight.
    """
    # `absolute_path` walks up through `parent`, so a context sub-error already reports its
    # full path from the artifact root -- it must not be re-rooted on the outer error's path.
    path = tuple(error.absolute_path)
    context = list(getattr(error, "context", None) or [])
    if not context:
        return [f"/{'/'.join(str(part) for part in path)}: {error.message}"]

    deepest = max(len(tuple(sub.absolute_path)) for sub in context)
    violations: list[str] = []
    for sub in context:
        if len(tuple(sub.absolute_path)) == deepest:
            violations.extend(_leaf_violations(sub))
    return violations


def iter_violations(instance: object, schema_name: str) -> "list[str]":
    """Every way `instance` fails `schema_name`, as sorted `"<pointer>: <message>"` strings."""
    violations: set[str] = set()
    for error in validator_for(schema_name).iter_errors(instance):
        violations.update(_leaf_violations(error))
    return sorted(violations)


def validate_artifact(
    instance: object,
    schema_name: str,
    instance_label: str | None = None,
) -> None:
    """Raise `SchemaValidationError` unless `instance` satisfies `schema_name`.

    Reports every violation at once (see `SchemaValidationError`), rather than aborting on
    the first, so one pass over a bad artifact tells the whole story.
    """
    violations = iter_violations(instance, schema_name)
    if violations:
        raise SchemaValidationError(schema_name, violations, instance_label)


def walk_subschemas(node: object, pointer: str = "") -> "list[tuple[str, dict]]":
    """Every dict node in a schema document, paired with its JSON pointer.

    Structural checks must walk the whole tree: a test that inspects three hand-picked
    definitions will pass while the fourth quietly leaves its shape open.
    """
    found: list[tuple[str, dict]] = []
    if isinstance(node, dict):
        found.append((pointer or "/", node))
        for key, value in node.items():
            escaped = str(key).replace("~", "~0").replace("/", "~1")
            found.extend(walk_subschemas(value, f"{pointer}/{escaped}"))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            found.extend(walk_subschemas(value, f"{pointer}/{i}"))
    return found

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
        raise TypeError(f"schemaVersion must be an integer, got {version!r}")
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


def iter_violations(instance: object, schema_name: str) -> "list[str]":
    """Every way `instance` fails `schema_name`, as sorted `"<pointer>: <message>"` strings."""
    violations = []
    for error in validator_for(schema_name).iter_errors(instance):
        pointer = "/" + "/".join(str(part) for part in error.absolute_path)
        violations.append(f"{pointer}: {error.message}")
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

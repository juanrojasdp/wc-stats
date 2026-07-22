"""Structural invariants of /contract (Story 1.1, Task 8; AC 2 and AC 3).

These tests defend the three properties the contract's mechanics rest on, and they are
deliberately structural rather than sampled: each one walks every schema document in full,
because a check against three hand-picked definitions passes happily while the fourth is
the one that is wrong.

  * The documents are legal 2020-12 schemas. `check_schema` catches the typo that turns a
    constraint into a no-op keyword, which would otherwise validate everything forever.
  * They stay inside AD-2's draft-07-compatible subset.
  * Every object closes, and every `$def` is titled -- both are what make the generated
    TypeScript faithful rather than merely plausible (see contract/README.md, Codegen).
"""

from __future__ import annotations

import json
import re

import pytest
from jsonschema import Draft202012Validator

from pipeline.validate.schema import (
    BANNED_KEYWORDS,
    CONTRACT_DIR,
    load_schemas,
    schema_paths,
    schema_version,
    walk_subschemas,
)

EXPECTED_SCHEMAS = {
    "common.schema.json",
    "leaderboards.schema.json",
    "match-bundle.schema.json",
    "player-profile.schema.json",
    "team-profile.schema.json",
    "tournament.schema.json",
}

# Keywords whose values are arbitrary user data, not subschemas. `properties` and `$defs`
# map names to schemas, so a property legitimately called "title" or "enum" must not be
# mistaken for the keyword of that name.
_NON_SCHEMA_CONTAINERS = ("/properties/", "/$defs/", "/examples/")


def _schema_names() -> "list[str]":
    return sorted(load_schemas())


def _is_object_schema(node: dict) -> bool:
    return node.get("type") == "object"


def _in_name_map(pointer: str) -> bool:
    """Whether this pointer names a *key* inside properties/$defs rather than a schema."""
    parts = pointer.split("/")
    for i, part in enumerate(parts[:-1]):
        if part in ("properties", "$defs") and i + 1 == len(parts) - 1:
            return True
    return False


@pytest.mark.parametrize("name", _schema_names())
def test_every_schema_document_is_itself_a_legal_2020_12_schema(name: str) -> None:
    Draft202012Validator.check_schema(load_schemas()[name])


def test_contract_holds_exactly_the_artifact_set_ad_4_names() -> None:
    """AD-4 fixes the artifact set. A seventh schema is a contract change, not a detail."""
    assert set(load_schemas()) == EXPECTED_SCHEMAS


@pytest.mark.parametrize("name", _schema_names())
def test_no_schema_uses_a_keyword_banned_by_the_draft_07_compatible_subset(name: str) -> None:
    offenders = []
    for pointer, node in walk_subschemas(load_schemas()[name]):
        if _in_name_map(pointer):
            continue
        for keyword in BANNED_KEYWORDS:
            if keyword in node:
                offenders.append(f"{pointer} uses {keyword!r}")
    assert offenders == [], f"{name} leaves AD-2's subset:\n" + "\n".join(offenders)


@pytest.mark.parametrize("name", _schema_names())
def test_every_object_in_the_contract_closes_additional_properties(name: str) -> None:
    """An object without `additionalProperties: false` is an open shape.

    Two things go wrong at once: the pipeline can emit a stray key that validates clean, and
    json-schema-to-typescript renders the type with an `[k: string]: unknown` index signature
    that silently accepts anything the App reads off it.
    """
    offenders = []
    for pointer, node in walk_subschemas(load_schemas()[name]):
        if _in_name_map(pointer) or not _is_object_schema(node):
            continue
        if node.get("additionalProperties") is not False:
            offenders.append(pointer)
    assert offenders == [], f"{name} has open objects at:\n" + "\n".join(offenders)


@pytest.mark.parametrize("name", _schema_names())
def test_every_def_carries_an_explicit_title(name: str) -> None:
    """Generated type names come from `title` first.

    Untitled definitions that resolve to the same name are silently suffixed `Foo1`, `Foo2`
    by the codegen, which is a fidelity failure the App would inherit as a confusing type.
    """
    defs = load_schemas()[name].get("$defs", {})
    untitled = sorted(key for key, value in defs.items() if "title" not in value)
    assert untitled == [], f"{name} has untitled $defs: {untitled}"


@pytest.mark.parametrize("name", _schema_names())
def test_every_schema_declares_the_2020_12_dialect_and_an_id(name: str) -> None:
    schema = load_schemas()[name]
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["$id"] == f"https://wc-stats.dev/contract/{name}"


@pytest.mark.parametrize("name", _schema_names())
def test_no_schema_uses_definitions_instead_of_defs(name: str) -> None:
    """AD-2 settles this explicitly: `$defs`, never draft-07's `definitions`."""
    offenders = [
        pointer
        for pointer, node in walk_subschemas(load_schemas()[name])
        if "definitions" in node and not _in_name_map(pointer)
    ]
    assert offenders == [], f"{name} uses `definitions` at:\n" + "\n".join(offenders)


@pytest.mark.parametrize("name", _schema_names())
def test_no_ref_node_carries_sibling_keywords(name: str) -> None:
    """A `$ref` with siblings is legal 2020-12 and a codegen trap.

    json-schema-to-typescript treats `{"$ref": X, "$comment": "..."}` as a NEW schema rather
    than a reference to X, and emits a duplicate type under a collision-suffixed name. This
    is not hypothetical: it produced `Metres1` through `Metres5`, `Count1`..`Count3` and
    `TeamScore1` on this contract's first generation. Annotations belong on the referenced
    definition or on the parent object's description.
    """
    offenders = [
        f"{pointer} (siblings: {sorted(k for k in node if k != '$ref')})"
        for pointer, node in walk_subschemas(load_schemas()[name])
        if "$ref" in node and len(node) > 1 and not _in_name_map(pointer)
    ]
    assert offenders == [], f"{name} has $ref nodes with siblings:\n" + "\n".join(offenders)


def test_version_json_declares_schema_version_1_and_nothing_else() -> None:
    contents = json.loads((CONTRACT_DIR / "version.json").read_text(encoding="utf-8"))
    assert contents == {"schemaVersion": 1}
    assert schema_version() == 1


def test_every_artifact_schema_pins_schema_version_to_the_declared_version() -> None:
    """Each artifact stamps the version, and the stamp is a `const`, not a free integer."""
    artifacts = sorted(EXPECTED_SCHEMAS - {"common.schema.json"})
    for name in artifacts:
        schema = load_schemas()[name]
        assert "schemaVersion" in schema["required"], f"{name} does not require schemaVersion"
        assert schema["properties"]["schemaVersion"]["const"] == schema_version(), name


def test_generated_schema_version_constant_agrees_with_version_json() -> None:
    """The generated constant is read from version.json, never hand-typed (AD-2).

    Two hand-maintained copies of the version is precisely the drift AD-2 exists to prevent,
    so this asserts the generated output has not gone stale against its source.
    """
    generated = CONTRACT_DIR / "generated" / "schema-version.ts"
    if not generated.exists():
        pytest.skip("generated types not present; run `npm run generate:types` in contract/")
    match = re.search(r"export const SCHEMA_VERSION = (\d+);", generated.read_text(encoding="utf-8"))
    assert match is not None, "schema-version.ts does not export SCHEMA_VERSION"
    assert int(match.group(1)) == schema_version()


def test_generated_types_are_free_of_index_signatures_and_collision_suffixes() -> None:
    """AC 3's round-trip fidelity assertions, restated against the committed output.

    The generator enforces these too and refuses to write a file that fails them; this test
    is what catches a generated file that was edited by hand afterwards.
    """
    generated = CONTRACT_DIR / "generated" / "contract-types.d.ts"
    if not generated.exists():
        pytest.skip("generated types not present; run `npm run generate:types` in contract/")
    source = generated.read_text(encoding="utf-8")

    assert "[k: string]" not in source, "generated types contain an index signature"

    suffixed = re.findall(r"^export (?:type|interface) (\w*[A-Za-z]\d+)\b", source, re.M)
    assert suffixed == [], f"generated types contain collision-suffixed names: {suffixed}"

    declared = re.findall(r"^export (?:type|interface) (\w+)", source, re.M)
    duplicates = sorted({n for n in declared if declared.count(n) > 1})
    assert duplicates == [], f"generated types declare the same name twice: {duplicates}"


def test_generated_types_render_closed_enums_as_string_literal_unions() -> None:
    """AD-2's mechanism: an unlisted enum value must become a compile error downstream.

    That only works if the enum compiles to a union of literals rather than to `string`.
    """
    generated = CONTRACT_DIR / "generated" / "contract-types.d.ts"
    if not generated.exists():
        pytest.skip("generated types not present; run `npm run generate:types` in contract/")
    source = generated.read_text(encoding="utf-8")

    for type_name, member in (
        ("ShotOutcome", '"off-target"'),
        ("DecidedBy", '"shootout"'),
        ("Position", '"gk"'),
        ("Stage", '"third-place"'),
        ("ReceivingEventType", '"movement"'),
    ):
        match = re.search(rf"^export type {type_name} =(.*?);$", source, re.M | re.S)
        assert match is not None, f"{type_name} is not declared in the generated types"
        assert member in match.group(1), f"{type_name} lost its literal member {member}"


def test_generated_types_express_nullable_fields_as_unions_with_null() -> None:
    """The `anyOf: [X, {"type": "null"}]` pattern must survive into `X | null`."""
    generated = CONTRACT_DIR / "generated" / "contract-types.d.ts"
    if not generated.exists():
        pytest.skip("generated types not present; run `npm run generate:types` in contract/")
    source = generated.read_text(encoding="utf-8")

    for type_name in ("Momentum", "ShootoutAttempts", "ShotExpectedGoals", "StoppageMinute"):
        match = re.search(rf"^export type {type_name} =(.*?);$", source, re.M | re.S)
        assert match is not None, f"{type_name} is not declared in the generated types"
        assert "| null" in match.group(1), f"{type_name} is not nullable in the generated types"


def test_schema_files_are_canonically_serialized_utf8_with_lf_endings() -> None:
    """AD-8: the contract itself must be byte-stable across hosts.

    A CRLF that Windows introduced would make the same schema hash differently on two
    machines, which undermines every determinism claim built on top of it.
    """
    for path in schema_paths():
        raw = path.read_bytes()
        assert b"\r\n" not in raw, f"{path.name} has CRLF line endings"
        raw.decode("utf-8")

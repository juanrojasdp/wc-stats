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

def _schema_names() -> "list[str]":
    return sorted(load_schemas())


def _is_object_schema(node: dict) -> bool:
    return node.get("type") == "object"


def _is_name_map(pointer: str) -> bool:
    """Whether the node AT this pointer is a name->schema map rather than a schema itself.

    `walk_subschemas` yields every dict, which includes the `properties` and `$defs`
    containers. Those are maps of names to schemas, so a property legitimately called
    "title" or "enum" would otherwise be read as the keyword of that name. Skipping the
    CONTAINER is the whole intent.

    The predicate this replaces tested the second-to-last segment instead of the last, so it
    returned True for `/$defs/TeamScore` and `/properties/metadata` — every real subschema in
    the contract. Four tests that advertise walking "every schema document in full" were
    therefore inspecting 6 of 86 object schemas and 43 of 437 $ref nodes: the closed-shape,
    banned-keyword, `definitions` and $ref-sibling guards were all effectively off. The
    $ref-sibling one is the guard that exists because untitled collisions really did produce
    `Metres1`..`Metres5` during this story's codegen spike.
    """
    return pointer.rsplit("/", 1)[-1] in ("properties", "$defs")


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
        if _is_name_map(pointer):
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
        if _is_name_map(pointer) or not _is_object_schema(node):
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
        if "definitions" in node and not _is_name_map(pointer)
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
        if "$ref" in node and len(node) > 1 and not _is_name_map(pointer)
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


# ------------------------------------------------------------------ generated-output drift
#
# The committed types drifted four JSDoc blocks behind the schemas without a single test
# going red: the checks below this point assert PROPERTIES of the committed file (no index
# signatures, no suffixed names, the version integer), all of which a stale file satisfies.
# AD-14 requires schemas, fixtures and generated types to move in the same commit, and
# nothing enforced it.


def _node() -> str:
    """Path to a node executable, or skip. Node 24 is an AD-13 pin, not an optional extra."""
    import shutil

    found = shutil.which("node")
    if found is None:
        pytest.skip("node is not on PATH; AD-13 pins Node 24 for the codegen path")
    return found


def test_the_committed_generated_types_still_match_the_schemas() -> None:
    """`npm run check:types` in test form: regenerate and compare, do not merely inspect.

    Comment-only drift still matters. The generated file is the ONLY thing Epic 2 reads
    (AD-2), so a stale JSDoc block is the contract telling App developers something the
    schemas no longer say -- which is exactly what happened: the committed types described
    the phase percentages as shares summing to ~100%, the reading logged decision 5 exists
    to forbid.
    """
    import subprocess

    result = subprocess.run(
        [_node(), "scripts/generate-types.mjs", "--check"],
        cwd=CONTRACT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "contract/generated is out of date with the schemas. Run "
        "`npm run generate:types` in contract/ and commit the result in the SAME commit as "
        f"the schema change (AD-14).\n\n{result.stdout}\n{result.stderr}"
    )


def test_no_generated_type_name_is_a_collision_suffix_of_another() -> None:
    """`Metres1` is a collision only because `Metres` exists; `DistanceZone5` is a real name.

    The generator's own guard rejected any name ending in a digit, which would have failed
    the build the day somebody promoted one of the existing distanceZone1..5 fields to a
    titled $def. The property that actually matters is that no declared name is another
    declared name plus a numeric suffix.
    """
    types_path = CONTRACT_DIR / "generated" / "contract-types.d.ts"
    declared = set(
        re.findall(r"^export (?:type|interface|const|enum) (\w+)", types_path.read_text("utf-8"), re.M)
    )
    collisions = sorted(
        name
        for name in declared
        if (match := re.fullmatch(r"(.*[A-Za-z])\d+", name)) and match.group(1) in declared
    )
    assert collisions == [], (
        "collision-suffixed type names in the generated output -- two schemas resolved to "
        f"one name, usually a $ref carrying sibling keywords: {collisions}"
    )


# ------------------------------------------------------- vocabularies and their duplicates
#
# Fourteen closed enums are declared, documented with corpus provenance and generated into
# TypeScript, but referenced by no field: each is duplicated as a fixed camelCase key set on
# an object elsewhere. That duplication is deliberate -- the App wants fixed-shape objects,
# not maps -- but nothing held the two copies together, so AD-2's "an unknown value becomes a
# compile error" did not hold for any of them. These tests are that missing link.


def _camel(value: str) -> str:
    head, *rest = value.split("-")
    return head + "".join(part.capitalize() for part in rest)


# enum $def -> (schema file, title of the object that encodes it, fields it may carry that
# are NOT enum values). The extras are always totals or a sibling breakdown: the enum has to
# be a subset of the object's fields, never the other way round.
ENUM_MIRRORS = {
    "InPossessionPhase": ("match-bundle.schema.json", "InPossessionPhases", set()),
    "OutOfPossessionPhase": ("match-bundle.schema.json", "OutOfPossessionPhases", set()),
    "BlockLevel": ("match-bundle.schema.json", "DefensiveBlockDistribution", set()),
    "DistributionType": (
        "match-bundle.schema.json",
        "GoalkeeperDistribution",
        {"feetTechniques", "handsTechniques", "throwTechniques", "lineBreaks", "total"},
    ),
    "FeetDistributionTechnique": ("match-bundle.schema.json", "FeetTechniqueCounts", set()),
    "HandsDistributionTechnique": ("match-bundle.schema.json", "HandsTechniqueCounts", set()),
    "ThrowDistributionTechnique": ("match-bundle.schema.json", "ThrowTechniqueCounts", set()),
    "InterventionType": ("match-bundle.schema.json", "InterventionTypeCounts", set()),
    "InterventionBodyType": ("match-bundle.schema.json", "InterventionBodyTypeCounts", set()),
    "FreeKickType": ("match-bundle.schema.json", "FreeKickCounts", set()),
    "CornerDeliveryType": ("match-bundle.schema.json", "CornerDeliveryTypeCounts", set()),
    "CornerDeliveryStyle": ("match-bundle.schema.json", "CornerDeliveryStyleCounts", set()),
    "PitchSide": ("match-bundle.schema.json", "TeamCornerSideCounts", {"total"}),
    "AerialInterventionType": (
        "match-bundle.schema.json",
        "AerialControl",
        {"crossesFacedAttempted", "crossesFacedCompleted", "deliveryTypesFaced",
         "totalInterventions"},
    ),
}


@pytest.mark.parametrize("enum_name", sorted(ENUM_MIRRORS))
def test_every_closed_vocabulary_matches_the_object_that_encodes_it(enum_name: str) -> None:
    """A vocabulary and its object form must not drift apart.

    Each of these enums is the documented, corpus-derived vocabulary; the object is how the
    artifact actually stores it. Nothing referenced the enum, so adding a value to one and
    not the other was silent -- and a source label with nowhere to go is data loss at
    extraction time rather than the compile error AD-2 promises.
    """
    values = load_schemas()["common.schema.json"]["$defs"][enum_name]["enum"]
    schema_name, def_name, allowed_extras = ENUM_MIRRORS[enum_name]
    # Located by `title`, not by $defs key: several of these objects are declared inline
    # inside their parent rather than hoisted, and the title is what names the generated type.
    matches = [
        node
        for _, node in walk_subschemas(load_schemas()[schema_name])
        if node.get("title") == def_name and "properties" in node
    ]
    assert len(matches) == 1, (
        f"expected exactly one schema titled {def_name!r} in {schema_name}, found {len(matches)}"
    )
    actual = set(matches[0]["properties"])
    # A counts field is sometimes pluralised where the vocabulary value is singular
    # (`claim` -> `claims`). Accept either spelling rather than force a rename of fields the
    # corpus pages already name that way.
    expected = set()
    for value in values:
        camel = _camel(value)
        candidates = (camel, f"{camel}s", f"{camel}es")
        expected.add(next((c for c in candidates if c in actual), camel))
    assert expected <= actual, (
        f"{enum_name} has values with no field in {def_name}: {sorted(expected - actual)}. "
        f"A vocabulary value with nowhere to go is silent data loss at extraction time."
    )
    unexpected = actual - expected - allowed_extras
    assert unexpected == set(), (
        f"{def_name} carries fields that are not {enum_name} values: {sorted(unexpected)}. "
        f"Add them to the enum or to this mirror's allowed extras."
    )


def test_every_metric_code_names_a_real_artifact_field() -> None:
    """MetricCode claims to be string-identical to the field it ranks. `tackles` was not.

    Domain G exposes `tacklesMade` and `tacklesWon`; there was no `tackles` anywhere, so a
    board carrying that code named no source field at all -- exactly the ambiguity the
    string-identical rule exists to remove. The rule is scoped: a team board's code names a
    Domain B field and a player board's a Domain G field, so the two scopes may legitimately
    spell one concept differently.
    """
    field_names: set[str] = set()

    def collect(node: object) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key == "properties" and isinstance(value, dict):
                    field_names.update(value)
                collect(value)
        elif isinstance(node, list):
            for value in node:
                collect(value)

    for schema in load_schemas().values():
        collect(schema)

    codes = load_schemas()["common.schema.json"]["$defs"]["MetricCode"]["enum"]
    orphans = sorted(code for code in codes if code not in field_names)
    assert orphans == [], (
        f"MetricCode values that name no field anywhere in /contract: {orphans}"
    )


@pytest.mark.parametrize("name", _schema_names())
def test_every_numeric_leaf_declares_its_precision(name: str) -> None:
    """AC 2: per-field numeric precision is fixed, expressed with `x-decimals`.

    Five polymorphic metric-value slots carried no declaration at all -- the leaderboard,
    aggregate and trend values -- which left Story 1.16's canonical serializer with no
    rounding rule for any of them. `multipleOf` is deliberately not used: validators
    implement it as a float modulo, so 0.07 % 0.01 != 0 fails legitimate data.
    """
    offenders = []
    for pointer, node in walk_subschemas(load_schemas()[name]):
        if _is_name_map(pointer):
            continue
        if node.get("type") not in ("number", "integer"):
            continue
        if "const" in node or "enum" in node:
            continue
        if "x-decimals" not in node:
            offenders.append(pointer)
    assert offenders == [], (
        f"{name} has numeric schemas with no x-decimals precision declaration:\n"
        + "\n".join(offenders)
    )

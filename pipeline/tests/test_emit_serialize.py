"""Story 1.16 Task 2.3 — the per-field precision layer.

`x-decimals` is the ENTIRE enforcement of AD-8's fixed precision. No `multipleOf` exists
anywhere in `/contract` (deliberately — `contract/README.md:71-77`), the custom keyword is
ignored by every validator and by the codegen, and a bundle carrying 17-digit floats
validates clean. So every assertion here is testing something no other gate can see.
"""

from __future__ import annotations

import json

import pytest

from pipeline.precompute.serialize import decimals_map, round_to_precision
from pipeline.validate.schema import load_schemas, walk_subschemas

BUNDLE = "match-bundle.schema.json"


def test_the_map_is_not_built_by_walking_the_bundle_schema_alone():
    """The trap the story names: a one-document walk rounds NO float in the artifact.

    Every float precision (`PitchX`/`PitchY` 2, `Percentage` 1, `Metres` 1, `Kilometres` 2,
    `KmPerHour` 1, `ExpectedGoals` 2) lives in `common.schema.json` behind a cross-document
    `$ref`. Walking `match-bundle.schema.json` on its own yields five declarations, ALL of
    them `0` and all integers — so a map built that way is green by vacuity.

    This test pins the vacuity so the real map cannot silently regress into it.
    """
    naive = {
        pointer: node["x-decimals"]
        for pointer, node in walk_subschemas(load_schemas()[BUNDLE])
        if "x-decimals" in node
    }
    assert len(naive) == 5, naive
    assert set(naive.values()) == {0}, "the bundle document alone declares only integers"

    real = decimals_map(BUNDLE)
    assert any(places >= 1 for places in real.values()), (
        "decimals_map found only integer precisions, which means it walked one document "
        "and resolved no $ref — every float in the artifact would ship unrounded"
    )


def test_the_map_carries_every_precision_the_contract_declares():
    places = set(decimals_map(BUNDLE).values())
    assert places == {0, 1, 2}, places


def test_the_map_binds_the_known_float_definitions():
    m = decimals_map(BUNDLE)
    for name, expected in [
        ("PitchX", 2), ("PitchY", 2), ("ExpectedGoals", 2), ("Kilometres", 2),
        ("Percentage", 1), ("Metres", 1), ("KmPerHour", 1),
        ("Count", 0), ("Minute", 0), ("ShirtNumber", 0), ("StoppageMinute", 0),
    ]:
        assert m[name] == expected, f"{name} -> {m.get(name)}, expected {expected}"


def test_stoppage_minute_declares_inside_its_anyof_branch():
    """`StoppageMinute` is `anyOf: [{integer, x-decimals: 0}, {null}]`.

    A filter reading `node.get("x-decimals")` at `$def` level misses it entirely. Harmless
    for this one (it is `0`), but the same shape on a float would ship unrounded.
    """
    common = load_schemas()["common.schema.json"]["$defs"]["StoppageMinute"]
    assert "x-decimals" not in common, "the declaration is not at the $def root"
    assert any("x-decimals" in branch for branch in common["anyOf"])
    assert decimals_map(BUNDLE)["StoppageMinute"] == 0


def test_the_bundle_reaches_sixteen_named_precisions():
    """11 reachable shared `$defs` + 5 inline. `Rank` is unreachable from a Match Bundle."""
    m = decimals_map(BUNDLE)
    assert "Rank" not in m, "Rank is a leaderboard type and no Match Bundle field reaches it"
    assert len(m) == 16, sorted(m)


@pytest.mark.parametrize(
    "value,places,expected",
    [
        (1.005, 2, 1.0),          # binary float, round-half-even on the stored value
        (0.1 + 0.2, 2, 0.3),      # 0.30000000000000004 -> 0.3
        (44.44444444, 1, 44.4),
        (17.0, 0, 17),
        (100.0, 1, 100.0),
        (0.0, 2, 0.0),
    ],
)
def test_round_to_precision_rounds_scalars(value, places, expected):
    assert round_to_precision(value, places) == expected


def test_zero_places_yields_a_json_integer_not_a_float():
    """`Count`, `Minute`, `ShirtNumber` are `type: integer`. A rounded 3.0 fails that."""
    out = round_to_precision(3.0, 0)
    assert out == 3
    assert isinstance(out, int) and not isinstance(out, bool)
    assert json.dumps(out) == "3"


def test_booleans_are_never_rounded():
    """`bool` is an `int` subclass; rounding one would emit 0/1 for `ownGoal`."""
    assert round_to_precision(True, 0) is True
    assert round_to_precision(False, 2) is False


def test_none_and_strings_pass_through():
    assert round_to_precision(None, 2) is None
    assert round_to_precision("on-target-goal", 2) == "on-target-goal"


def test_rounding_is_idempotent():
    """Round twice, get the same bytes — the property byte-identity rests on."""
    once = round_to_precision(1 / 3, 2)
    assert round_to_precision(once, 2) == once

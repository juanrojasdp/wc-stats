"""Story 1.15 — the precompute CLI's documented contract, exercised rather than asserted.

`run.py` was shipped with 173 lines of prose promising three exit codes, an
always-printed baseline note, an `--expect-records` gate and a write-vs-check branch, and
no test imported it at all. Story 1.15's code review filed that; this module is the fix.

The exit-code contract is the load-bearing part, because it is what CI reads:

    0  clean
    1  a FINDING — the data or the rule is wrong and someone must rule on it
    2  the HARNESS could not run — nothing was learned

Conflating 1 and 2 destroys the distinction in both directions: a real dataset defect
reported as 2 reads as "the tool is broken", and a broken tool reported as 1 sends
someone hunting a data problem that does not exist.

`clean_registry` is defined locally, following `test_checks_registry.py` — every test here
that runs the CLI against a synthetic corpus must swap the committed registry's
module-level maps out, or `check_pins` compares a two-player corpus against 1,400 real
pins and the whole module fails for the wrong reason.
"""

from __future__ import annotations

import json

import pytest

from pipeline.precompute import run as precompute_run
from pipeline.precompute import slug_registry
from pipeline.tests.test_precompute_spine import make_full_record


@pytest.fixture
def clean_registry():
    """Snapshot and restore the committed registry's module-level maps."""
    snapshot = (
        dict(slug_registry.TEAM_CODES),
        {kind: dict(mapping) for kind, mapping in slug_registry.PINS.items()},
        dict(slug_registry.OVERRIDES),
    )
    yield
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update(snapshot[0])
    for kind, mapping in snapshot[1].items():
        slug_registry.PINS[kind].clear()
        slug_registry.PINS[kind].update(mapping)
    slug_registry.OVERRIDES.clear()
    slug_registry.OVERRIDES.update(snapshot[2])


def stage(tmp_path, records, statuses=None):
    """Write a synthetic corpus plus the manifest naming it. Returns the manifest path."""
    extracted = tmp_path / "extracted"
    extracted.mkdir(exist_ok=True)
    entries = []
    for index, record in enumerate(records):
        path = extracted / f"{record['match_id']}.json"
        path.write_text(json.dumps(record), encoding="utf-8")
        entries.append(
            {
                "match_id": record["match_id"],
                "report_id": record["report_id"],
                "record_path": str(path),
                "status": (statuses or {}).get(record["match_id"], "extracted"),
            }
        )
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(json.dumps({"reports": entries}), encoding="utf-8")
    return manifest


def invoke(tmp_path, manifest, *extra):
    """Run the CLI against a staged corpus, never against the real `work/` tree."""
    return precompute_run.main(
        [
            "--manifest", str(manifest),
            "--extracted-dir", str(tmp_path / "extracted"),
            "--spine-dir", str(tmp_path / "spine"),
            "--data-dir", str(tmp_path / "data"),
            *extra,
        ]
    )


def emptied(registry):
    """Point the committed maps at nothing, so a synthetic corpus is a fresh namespace."""
    registry.TEAM_CODES.clear()
    for mapping in registry.PINS.values():
        mapping.clear()
    registry.OVERRIDES.clear()


# --- exit 0 -----------------------------------------------------------------------


def test_a_clean_run_exits_zero_and_stages_the_spine(tmp_path, clean_registry, capsys):
    emptied(slug_registry)
    manifest = stage(tmp_path, [make_full_record()])
    assert invoke(tmp_path, manifest) == 0
    out = capsys.readouterr().out
    assert "PRECOMPUTE RESULT: PASS" in out
    assert (tmp_path / "spine" / "entities.json").is_file()
    assert (tmp_path / "spine" / "matches" / "m001-mexico-south-africa.json").is_file()


def test_the_unavailable_data_baseline_line_is_always_printed_and_never_suppressed(
    tmp_path, clean_registry, capsys
):
    """`data/matches/` does not exist until Story 1.16 emits, and a gate reporting green
    on a baseline it never had is worse than no gate."""
    emptied(slug_registry)
    manifest = stage(tmp_path, [make_full_record()])
    assert invoke(tmp_path, manifest) == 0
    out = capsys.readouterr().out
    assert "baseline unavailable" in out
    assert "This is NOT a pass" in out
    assert "all pinned" not in out


# --- exit 1: findings -------------------------------------------------------------


def test_a_record_count_that_misses_expect_records_is_a_finding(
    tmp_path, clean_registry, capsys
):
    emptied(slug_registry)
    manifest = stage(tmp_path, [make_full_record()])
    assert invoke(tmp_path, manifest, "--expect-records", "104") == 1
    assert "expected 104" in capsys.readouterr().err


def test_a_manifest_naming_no_consumable_record_is_a_finding_not_a_pass(
    tmp_path, clean_registry, capsys
):
    """Every check downstream is a loop over records, so all of them pass vacuously on an
    empty corpus. Without this guard the run printed PASS, staged an empty
    `entities.json`, and with `--write-registry` would have replaced 1,400 pinned ids
    with nothing."""
    emptied(slug_registry)
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(json.dumps({"reports": []}), encoding="utf-8")
    (tmp_path / "extracted").mkdir()
    assert invoke(tmp_path, manifest) == 1
    captured = capsys.readouterr()
    assert "no consumable record" in captured.err
    assert "PRECOMPUTE RESULT: PASS" not in captured.out


def test_a_manifest_naming_one_match_id_twice_is_a_finding_not_a_broken_harness(
    tmp_path, clean_registry, capsys
):
    """A manifest that READS fine but says something wrong is exit 1. It was exit 2, so a
    genuine dataset defect reported as "nothing was learned"."""
    emptied(slug_registry)
    record = make_full_record()
    manifest = stage(tmp_path, [record])
    doc = json.loads(manifest.read_text(encoding="utf-8"))
    doc["reports"].append(dict(doc["reports"][0]))
    manifest.write_text(json.dumps(doc), encoding="utf-8")
    assert invoke(tmp_path, manifest) == 1
    assert "twice" in capsys.readouterr().err


def test_a_pinned_id_that_would_change_is_a_finding(tmp_path, clean_registry, capsys):
    emptied(slug_registry)
    slug_registry.PINS["players"]["mexico#1"] = "someone-else-mex"
    manifest = stage(tmp_path, [make_full_record()])
    assert invoke(tmp_path, manifest) == 1
    err = capsys.readouterr().err
    assert "someone-else-mex" in err and "rangel-raul-mex" in err


def test_an_override_naming_nobody_is_a_finding(tmp_path, clean_registry, capsys):
    emptied(slug_registry)
    slug_registry.OVERRIDES["mexico#99"] = "nobody-at-all-mex"
    manifest = stage(tmp_path, [make_full_record()])
    assert invoke(tmp_path, manifest) == 1
    assert "no player resolves" in capsys.readouterr().err


# --- exit 2: the harness ----------------------------------------------------------


def test_an_unreadable_manifest_is_a_broken_harness(tmp_path, clean_registry, capsys):
    emptied(slug_registry)
    (tmp_path / "extracted").mkdir()
    assert invoke(tmp_path, tmp_path / "does-not-exist.json") == 2
    assert "could not run" in capsys.readouterr().err


def test_an_unwritable_spine_directory_is_a_broken_harness(
    tmp_path, clean_registry, capsys, monkeypatch
):
    """The docstring's own example of exit 2, which previously could not produce it: the
    writes sit outside the `PipelineError` handler and raise a bare `OSError`."""
    emptied(slug_registry)
    manifest = stage(tmp_path, [make_full_record()])

    def refuse(*_args, **_kwargs):
        raise OSError("read-only file system")

    monkeypatch.setattr(precompute_run, "write_spine", refuse)
    assert invoke(tmp_path, manifest) == 2
    assert "could not run" in capsys.readouterr().err


# --- the write-vs-check branch ----------------------------------------------------


def test_write_registry_regenerates_the_module_in_place(tmp_path, clean_registry, capsys):
    emptied(slug_registry)
    target = tmp_path / "slug_registry.py"
    manifest = stage(tmp_path, [make_full_record()])
    import pipeline.precompute.run as module

    original = module.REGISTRY_PATH
    try:
        module.REGISTRY_PATH = target
        assert invoke(tmp_path, manifest, "--write-registry") == 0
    finally:
        module.REGISTRY_PATH = original
    assert "REGENERATED" in capsys.readouterr().out
    text = target.read_text(encoding="utf-8")
    assert "'mexico#1': 'rangel-raul-mex'" in text
    assert "\r" not in text and text.endswith("\n")


def test_regenerating_over_a_corpus_that_would_DROP_a_pin_fails_loud(
    tmp_path, clean_registry, capsys
):
    """Regeneration is the deliberate escape hatch for a ruled id change, but it must not
    be a way to LOSE ids. `render_registry` writes only what the run minted, so a partial
    corpus would silently delete every pin for an entity it did not see — AD-3's
    guarantee gone with no failure anywhere."""
    emptied(slug_registry)
    slug_registry.PINS["players"]["brazil#10"] = "someone-brazilian-bra"
    slug_registry.PINS["matches"]["PMSR-M77-BRA-V-ARG"] = "m077-brazil-argentina"
    target = tmp_path / "slug_registry.py"
    manifest = stage(tmp_path, [make_full_record()])
    import pipeline.precompute.run as module

    original = module.REGISTRY_PATH
    try:
        module.REGISTRY_PATH = target
        assert invoke(tmp_path, manifest, "--write-registry") == 1
    finally:
        module.REGISTRY_PATH = original
    err = capsys.readouterr().err
    assert "would drop" in err
    assert "brazil#10" in err
    assert not target.exists(), "the registry was rewritten despite the drop being fatal"

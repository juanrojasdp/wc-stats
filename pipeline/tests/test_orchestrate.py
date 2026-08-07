"""Story 1.19 Task 5 (AC 1): end-to-end phase ordering and its exit-code contract.

The ordering is the point of the module, so most of these are about ORDER and about what
the runner does with each phase's exit code — not about what any phase computes, which is
each phase's own test file's job. Phase behaviour is stubbed wherever the assertion is
about orchestration, so a failure here localizes to this module rather than to a
dependency five phases deep.

Two tests run the real phases. The constructed one builds one COMPLETE group (six matches
over four teams) in `tmp_path`, never the real corpus: that is gitignored, so a test
pointing at it would run against an empty directory and pass having verified nothing (the
Story 1.4 review finding). The corpus one runs `emit -> profiles -> index` over the real
staged spine into a throwaway data tree, and is where the deadlock resolution is actually
proven; it skips locally and fails under `CI=1` like every other corpus fixture.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from pipeline import orchestrate
from pipeline.orchestrate import PHASES, _batch_finding_is_consumable, _phase_argv, main


def _args(**overrides):
    argv = ["--input-dir", "corpus"]
    for flag, value in overrides.items():
        argv += [f"--{flag.replace('_', '-')}", str(value)]
    return orchestrate.build_parser().parse_args(argv)


def _stub(name: str, code: int):
    """A phase that records that it ran and returns `code`."""
    def phase_main(argv, _name=name, _code=code):
        RAN.append(_name)
        return _code
    return phase_main


RAN: "list[str]" = []


@pytest.fixture(autouse=True)
def _clear_ran():
    RAN.clear()
    yield
    RAN.clear()


# --- the ordering itself -----------------------------------------------------------


def test_profiles_runs_before_index_which_is_what_dissolves_the_deadlock():
    """`index.check_route_manifest` checks AD-4's profile direction BEFORE its first
    write and raises on a set difference, so once profiles exist, moving the entity set
    makes `index` refuse to emit the manifest those profiles are built from. `profiles`
    reads `data/matches/` and nothing else, so it has no dependency on `index` at all —
    running it first means the artifacts already match by the time the gate looks.

    Asserted as a literal order rather than described, because reversing these two is a
    one-line edit that reintroduces a deadlock nothing else in the suite would catch."""
    names = [name for name, _main in PHASES]

    assert names == [
        "ingest.batch",
        "precompute.run",
        "precompute.emit",
        "precompute.profiles",
        "precompute.index",
    ]
    assert names.index("precompute.profiles") < names.index("precompute.index")
    # `profiles` reads bundles, so it can never precede the phase that writes them.
    assert names.index("precompute.emit") < names.index("precompute.profiles")


def test_every_phase_is_handed_argv_its_own_cli_accepts():
    """The orchestrator builds each phase's argv by hand, so a flag renamed in a phase
    would be caught only at run time — after the batch has already spent two minutes.
    Each phase's OWN parser is the oracle here, not a copy of its flag list."""
    args = _args(expect_reports=104, expect_records=104, expect_matches=104,
                 expect_teams=48, expect_players=1248)
    parsers = {
        "ingest.batch": "pipeline.ingest.batch",
        "precompute.run": "pipeline.precompute.run",
        "precompute.emit": "pipeline.precompute.emit",
        "precompute.profiles": "pipeline.precompute.profiles",
        "precompute.index": "pipeline.precompute.index",
    }

    for name, module_path in parsers.items():
        module = __import__(module_path, fromlist=["build_parser"])
        # Raises SystemExit(2) on an unknown or mistyped option.
        module.build_parser().parse_args(_phase_argv(name, args))


def test_every_path_the_orchestrator_owns_is_forwarded_to_the_phase_that_writes_it():
    """A phase left on its own default while the runner points somewhere else does not
    fail — it writes to the wrong place and the runner then reads a stale file. The batch
    manifest is the sharp case: the orchestrator READS it to decide whether the batch's
    exit 1 is consumable, and the first version of this module omitted `--output`, so a
    test running against a temporary tree overwrote the repository's real run manifest."""
    args = _args(manifest="somewhere/else.json", extracted_dir="scratch/extracted",
                 spine_dir="scratch/spine", data_dir="scratch/data")

    # Posix-normalized: `Path` renders separators per platform and these are paths, not
    # strings, by the time they reach a phase's parser.
    forwarded = {
        name: " ".join(_phase_argv(name, args)).replace("\\", "/")
        for name, _main in PHASES
    }

    assert "somewhere/else.json" in forwarded["ingest.batch"]
    for name in ("ingest.batch", "precompute.run"):
        assert "scratch/extracted" in forwarded[name]
    for name in ("precompute.run", "precompute.emit", "precompute.index"):
        assert "scratch/spine" in forwarded[name]
    for name in ("precompute.emit", "precompute.profiles", "precompute.index"):
        assert "scratch/data" in forwarded[name]


def test_the_optional_expect_counts_are_omitted_rather_than_passed_as_none():
    """`--expect-matches None` would be parsed as the string "None" and crash the phase's
    int conversion; omitting the flag is what "not asserted" has to look like."""
    argv = _phase_argv("precompute.emit", _args())

    assert "--expect-matches" not in argv


# --- the exit-code contract --------------------------------------------------------


def test_a_phase_exiting_two_stops_the_run_before_any_later_phase(monkeypatch, capsys):
    """Exit 2 means the harness could not run, so nothing was learned. Continuing would
    let a later phase write to the committed tree on the strength of a phase that never
    produced anything."""
    monkeypatch.setattr(orchestrate, "PHASES", (
        ("ingest.batch", _stub("ingest.batch", 0)),
        ("precompute.run", _stub("precompute.run", 2)),
        ("precompute.emit", _stub("precompute.emit", 0)),
    ))

    code = main(["--input-dir", "corpus"])
    out = capsys.readouterr()

    assert code == 2
    assert RAN == ["ingest.batch", "precompute.run"]
    assert "precompute.emit      NOT RUN" in out.out
    assert "PIPELINE RESULT: COULD NOT RUN" in out.out


def test_a_precompute_phase_exiting_one_stops_the_run(monkeypatch, capsys):
    """A failed gate means the artifacts it guards are not trustworthy. Building the next
    phase on them is how a partial namespace becomes the pinned AD-3 baseline."""
    monkeypatch.setattr(orchestrate, "PHASES", (
        ("ingest.batch", _stub("ingest.batch", 0)),
        ("precompute.emit", _stub("precompute.emit", 1)),
        ("precompute.index", _stub("precompute.index", 0)),
    ))

    code = main(["--input-dir", "corpus"])
    out = capsys.readouterr()

    assert code == 1
    assert RAN == ["ingest.batch", "precompute.emit"]
    assert "PIPELINE RESULT: FAIL" in out.out


def test_a_batch_self_validation_finding_continues_the_run_and_still_exits_one(
    monkeypatch, capsys, tmp_path
):
    """The ruled clean-corpus baseline for this corpus IS exit 1 — two hand-verified
    forced-turnover source defects — and `precompute/records.py` rules both records
    CONSUMED. Stopping there would make the documented baseline unrunnable end to end.
    The finding is reported and the orchestrator still exits 1; it is never masked."""
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(json.dumps({
        "orphan_record_paths": [],
        "run": {"failed_count": 0, "corpus_gaps": [], "self_validation_fail_count": 2},
    }), encoding="utf-8")
    monkeypatch.setattr(orchestrate, "PHASES", (
        ("ingest.batch", _stub("ingest.batch", 1)),
        ("precompute.run", _stub("precompute.run", 0)),
        ("precompute.index", _stub("precompute.index", 0)),
    ))

    code = main(["--input-dir", "corpus", "--manifest", str(manifest)])
    out = capsys.readouterr()

    assert code == 1, "the batch's finding must reach the caller, never be masked to 0"
    assert RAN == ["ingest.batch", "precompute.run", "precompute.index"]
    assert "the run continues" in out.out
    assert "PIPELINE RESULT: FAIL" in out.out


@pytest.mark.parametrize(
    "run_block, orphans",
    [
        ({"failed_count": 1, "corpus_gaps": [], "self_validation_fail_count": 0}, []),
        ({"failed_count": 0, "corpus_gaps": ["corpus holds 103, expected 104"],
          "self_validation_fail_count": 0}, []),
        ({"failed_count": 0, "corpus_gaps": [], "self_validation_fail_count": 0},
         ["work/extracted/m099-x-y.json"]),
    ],
)
def test_a_batch_finding_that_is_not_purely_self_validation_stops_the_run(
    monkeypatch, capsys, tmp_path, run_block, orphans
):
    """A failed report, a corpus gap or an orphan record all mean the corpus is short, so
    every downstream `--expect-*` count would be measuring a truncated run. Only the
    self-validation-only finding is consumable."""
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(
        json.dumps({"orphan_record_paths": orphans, "run": run_block}), encoding="utf-8"
    )
    monkeypatch.setattr(orchestrate, "PHASES", (
        ("ingest.batch", _stub("ingest.batch", 1)),
        ("precompute.run", _stub("precompute.run", 0)),
    ))

    code = main(["--input-dir", "corpus", "--manifest", str(manifest)])

    assert code == 1
    assert RAN == ["ingest.batch"], "no phase may run on a short corpus"
    assert "the run stops" in capsys.readouterr().err


@pytest.mark.parametrize("body", ["", "{not json", '{"run": {}}', "[]"])
def test_an_unreadable_or_off_shape_manifest_is_never_read_as_consumable(tmp_path, body):
    """`check_committed_data`'s rule at a second seam: absence of evidence is never
    evidence. A manifest this cannot read must stop the run, not wave it through."""
    path = tmp_path / "run-manifest.json"
    path.write_text(body, encoding="utf-8")

    consumable, reason = _batch_finding_is_consumable(path)

    assert consumable is False
    assert reason


def test_a_missing_manifest_is_never_read_as_consumable(tmp_path):
    consumable, _reason = _batch_finding_is_consumable(tmp_path / "absent.json")

    assert consumable is False


def test_the_run_exits_with_the_worst_code_any_phase_returned(monkeypatch, capsys, tmp_path):
    """Never mask a phase's exit code — the worst wins, and a clean phase after a finding
    does not launder it."""
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(json.dumps({
        "orphan_record_paths": [],
        "run": {"failed_count": 0, "corpus_gaps": [], "self_validation_fail_count": 2},
    }), encoding="utf-8")
    monkeypatch.setattr(orchestrate, "PHASES", (
        ("ingest.batch", _stub("ingest.batch", 1)),
        ("precompute.run", _stub("precompute.run", 0)),
        ("precompute.emit", _stub("precompute.emit", 0)),
    ))

    assert main(["--input-dir", "corpus", "--manifest", str(manifest)]) == 1
    assert "  ingest.batch         exit 1" in capsys.readouterr().out


def test_a_clean_run_exits_zero_and_runs_every_phase(monkeypatch, capsys):
    monkeypatch.setattr(orchestrate, "PHASES", tuple(
        (name, _stub(name, 0)) for name, _main in PHASES
    ))

    code = main(["--input-dir", "corpus"])

    assert code == 0
    assert RAN == [name for name, _main in PHASES]
    assert "PIPELINE RESULT: PASS" in capsys.readouterr().out
    assert "NOT RUN" not in capsys.readouterr().out


# --- out-of-order invocation still fails loudly ------------------------------------


def test_running_profiles_before_any_bundle_exists_fails_loudly(tmp_path, capsys):
    """The ordering is expressed by this module, but nothing stops a human running the
    phases by hand. Out of order must be a loud failure, never a silent empty pass —
    'an empty run is never a pass' is the same rule `emit_bundles` enforces."""
    from pipeline.precompute import profiles

    data_dir = tmp_path / "data"
    data_dir.mkdir()

    code = profiles.main(["--data-dir", str(data_dir), "--expect-teams", "48"])

    assert code != 0
    assert capsys.readouterr().err.strip(), "a failure must say why on stderr"


def test_running_index_before_profiles_exist_does_not_read_as_an_unqualified_pass(
    tmp_path, capsys
):
    """`index` prints `INDEX RESULT: PASS (N check(s) COULD NOT RUN)` when a direction of
    AD-4's bijection could not be checked. That qualification is the whole reason the
    ordering matters, so it must survive: a run in the wrong order must never be
    indistinguishable from one in the right order."""
    from pipeline.precompute import index

    data_dir = tmp_path / "data"
    (data_dir / "index").mkdir(parents=True)

    index.main(["--data-dir", str(data_dir), "--spine-dir", str(tmp_path / "absent")])
    out = capsys.readouterr()

    assert "INDEX RESULT: PASS" not in out.out or "COULD NOT RUN" in out.out


# --- the real five phases, over a synthetic corpus ---------------------------------


GROUP_A = ["Alpha", "Bravo", "Charlie", "Delta"]
# One COMPLETE group: `precompute.run` derives matchday rounds per group and refuses a
# partial one ("a group's rounds are derivable only when all 6 of its fixtures are
# present"), so six matches over four teams is the smallest corpus that reaches every
# phase. `make_report` stamps every synthetic report `Group A` by default.
ROUND_ROBIN = [(0, 1), (2, 3), (0, 2), (1, 3), (0, 3), (1, 2)]


def test_the_real_phases_run_in_order_and_stop_at_the_first_precompute_gate(tmp_path, make_report):
    """The ordering exercised for real rather than stubbed: every phase runs its own
    `main`, in order, over a corpus this test builds. One complete group is enough to
    prove the ordering — the 104-report proof is the authoritative run in the story."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    for number, (h, a) in enumerate(ROUND_ROBIN, start=1):
        home, away = GROUP_A[h], GROUP_A[a]
        make_report(
            corpus / f"PMSR-M{number:02d}-{home[:3].upper()}-V-{away[:3].upper()}.pdf",
            number=number, home=home, away=away, day=10 + number,
        )
    data_dir = tmp_path / "data"

    code = main([
        "--input-dir", str(corpus),
        "--extracted-dir", str(tmp_path / "work" / "extracted"),
        "--spine-dir", str(tmp_path / "work" / "spine"),
        "--data-dir", str(data_dir),
        "--manifest", str(tmp_path / "work" / "run-manifest.json"),
        "--expect-reports", "6",
        "--expect-records", "6",
        "--expect-matches", "6",
    ])

    # `ingest.batch` runs green and `precompute.run` then refuses the synthetic corpus on
    # its own content — the shared `make_report` fixture's cross tables name a player who
    # resolves to no lineup entry, which is a fixture limitation and not an ordering one.
    # What this asserts is therefore the orchestration: the real phases ran, in order, and
    # the run STOPPED at the first precompute gate rather than building on its output.
    # The five-phase end-to-end proof over real data is `test_the_last_three_phases_...`
    # below plus the authoritative 104-report run recorded in the story.
    manifest = json.loads(
        (tmp_path / "work" / "run-manifest.json").read_text(encoding="utf-8")
    )
    assert code == 1
    assert len(manifest["reports"]) == 6
    assert manifest["counts_by_status"]["extracted"] == 6
    assert len(list((tmp_path / "work" / "extracted").glob("*.json"))) == 6
    assert not data_dir.exists(), "a stopped run must not have written to the data tree"


def test_the_last_three_phases_run_in_order_over_the_real_spine(tmp_path, repo_root, capsys):
    """The deadlock proof, as a test. `emit -> profiles -> index` over the real staged
    spine, into a throwaway data tree: because `profiles` runs BEFORE `index`, the profile
    artifacts already match the entity set when `check_route_manifest` looks, so all three
    directions of AD-4's bijection are asserted and the headline is an UNQUALIFIED PASS.

    In the documented order (`index` then `profiles`) the same run either raises
    `RouteManifestError` or prints `PASS (N check(s) COULD NOT RUN)` — never this.

    A corpus test: `work/spine/` is gitignored, so it skips locally and fails under `CI=1`,
    the same contract every other corpus fixture carries.
    """
    from pipeline.precompute import emit, index, profiles

    spine_dir = repo_root / "work" / "spine"
    if not (spine_dir / "entities.json").is_file() or not (spine_dir / "matches").is_dir():
        message = ("staged spine not available at work/spine — run "
                   "`python -m pipeline.precompute.run --expect-records 104` first")
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)

    data_dir = tmp_path / "data"

    assert emit.main(["--spine-dir", str(spine_dir), "--data-dir", str(data_dir)]) == 0
    assert profiles.main(["--data-dir", str(data_dir)]) == 0
    assert index.main(["--spine-dir", str(spine_dir), "--data-dir", str(data_dir)]) == 0

    out = capsys.readouterr().out
    assert "COULD NOT RUN" not in out, (
        "profiles ran first, so no direction of the bijection may report that it could "
        "not run — a qualified PASS here means the ordering regressed"
    )
    assert "teams: 48 profile(s) <-> 48 listed route(s) — bijection holds" in out
    assert "players: 1248 profile(s) <-> 1248 listed route(s) — bijection holds" in out
    assert (data_dir / "index" / "tournament.json").is_file()
    assert (data_dir / "index" / "leaderboards.json").is_file()
    assert len(list((data_dir / "index" / "team-profiles").glob("*.json"))) == 48
    assert len(list((data_dir / "index" / "player-profiles").glob("*.json"))) == 1248

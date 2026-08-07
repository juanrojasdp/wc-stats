"""Story 1.19 Task 6 (AC 3): the two committed write paths are all-or-nothing.

The hazard these defend against is the expensive one. An `OSError` partway through a write
used to leave `data/matches/` or `data/index/` PARTIALLY rewritten while the caller exited
`2` — "the harness could not run, so nothing was learned" — and the next
`identity.check_committed_data` would then pin that partial namespace as the AD-3
immutability baseline. An id, once emitted, never changes; undoing that is expensive.

**Every constructed failure here is driven through the emitter in memory**, by making one
write raise, never by mutating anything on the committed tree. Story 1.18's first mutation
run scored zero red because its fixtures loaded artifacts that were already committed, so
mutating the emitter changed nothing the assertions could see. The targets below are
throwaway trees under `tmp_path` pre-populated with recognisable sentinel bytes, so
"untouched" is asserted on CONTENT rather than on a file count.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from pipeline.precompute import emit as emit_module
from pipeline.precompute import index as index_module
from pipeline.precompute.swap import (
    ROLLBACK_SUFFIX,
    STAGED_SUFFIX,
    clear,
    rollback_sibling,
    staged_sibling,
    swap_directory,
    swap_files,
)

SENTINEL = '{\n  "sentinel": "the previous run\'s bytes"\n}\n'


def _populate(directory: Path, names: "list[str]") -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    for name in names:
        (directory / name).write_text(SENTINEL, encoding="utf-8", newline="")
    return directory


def _snapshot(directory: Path) -> "dict[str, bytes]":
    """Every file under `directory`, by relative path, on BYTES."""
    return {
        p.relative_to(directory).as_posix(): p.read_bytes()
        for p in sorted(directory.rglob("*")) if p.is_file()
    }


# --- the shared helper -------------------------------------------------------------


def test_scratch_paths_are_siblings_of_the_target_and_never_children(tmp_path):
    """The shape the `.gitignore` patterns depend on. `data/matches/*.staged/` would match
    nothing, because the staged copy of `data/matches/` is `data/matches.staged/` — beside
    it, at the `data/` level. Getting this wrong leaves a killed run's orphans stageable
    by a sweeping `git add`, which is the whole reason the patterns exist."""
    target = tmp_path / "data" / "matches"

    assert staged_sibling(target) == tmp_path / "data" / "matches.staged"
    assert rollback_sibling(target) == tmp_path / "data" / "matches.previous.rollback"
    assert staged_sibling(target).parent == target.parent
    assert rollback_sibling(target).parent == target.parent


def test_a_directory_swap_installs_every_file_or_none(tmp_path):
    target = _populate(tmp_path / "matches", ["a.json", "b.json"])
    staged = _populate(tmp_path / "matches.staged", ["a.json", "c.json"])
    (staged / "a.json").write_text("new", encoding="utf-8", newline="")

    backup = swap_directory(staged, target)

    assert sorted(p.name for p in target.glob("*.json")) == ["a.json", "c.json"]
    assert (target / "a.json").read_text(encoding="utf-8") == "new"
    assert backup is not None and (backup / "b.json").exists()
    assert not staged.exists()


def test_a_file_swap_leaves_the_targets_untouched_when_one_install_fails(tmp_path, monkeypatch):
    """The index pair is two views of one tournament, so a partial install leaves them
    disagreeing about the same competition. Failing the second must undo the first."""
    first, second = tmp_path / "tournament.json", tmp_path / "leaderboards.json"
    for target in (first, second):
        target.write_text(SENTINEL, encoding="utf-8", newline="")
    installs = []
    for target in (first, second):
        staged = staged_sibling(target)
        staged.write_text("replacement", encoding="utf-8", newline="")
        installs.append((staged, target))

    calls = {"n": 0, "fired": False}
    real_replace = Path.replace

    def flaky(self, target):
        # Fail the install of the SECOND pair, after the first has fully landed: call 0 is
        # the first retire, 1 the first install, 2 the second retire, 3 the second install.
        # Fired ONCE — the rollback goes through `Path.replace` too, and a predicate that
        # keeps matching would break the very undo this test exists to assert.
        calls["n"] += 1
        if calls["n"] == 4 and not calls["fired"]:
            calls["fired"] = True
            raise OSError("disk full")
        return real_replace(self, target)

    monkeypatch.setattr(Path, "replace", flaky)

    with pytest.raises(OSError):
        swap_files(installs)

    monkeypatch.undo()
    assert first.read_text(encoding="utf-8") == SENTINEL, "the first install must be undone"
    assert second.read_text(encoding="utf-8") == SENTINEL


def test_a_successful_file_swap_leaves_no_scratch_path_behind(tmp_path):
    target = tmp_path / "tournament.json"
    target.write_text(SENTINEL, encoding="utf-8", newline="")
    staged = staged_sibling(target)
    staged.write_text("replacement", encoding="utf-8", newline="")

    assert swap_files([(staged, target)]) == [target]

    assert target.read_text(encoding="utf-8") == "replacement"
    assert not staged.exists()
    assert not rollback_sibling(target).exists()


def test_a_file_swap_onto_an_empty_namespace_needs_no_backup(tmp_path):
    target = tmp_path / "tournament.json"
    staged = staged_sibling(target)
    staged.write_text("first ever", encoding="utf-8", newline="")

    swap_files([(staged, target)])

    assert target.read_text(encoding="utf-8") == "first ever"
    assert not rollback_sibling(target).exists()


def test_clear_removes_a_killed_runs_leftovers_whatever_shape_they_are(tmp_path):
    """A staged directory left by a killed run must never be written INTO: this run would
    then install that run's files alongside its own and call the result all-or-nothing."""
    directory = _populate(tmp_path / "left.staged", ["stale.json"])
    file_path = tmp_path / "left.json.staged"
    file_path.write_text("stale", encoding="utf-8", newline="")

    clear(directory)
    clear(file_path)
    clear(tmp_path / "never-existed")

    assert not directory.exists() and not file_path.exists()


# --- emit_bundles ------------------------------------------------------------------


def _spine(tmp_path: Path, repo_root: Path) -> Path:
    """The real staged spine, or a skip. Building a synthetic one that survives
    `build_bundle` is a whole fixture library; the rollback assertions need real input."""
    spine = repo_root / "work" / "spine"
    if not (spine / "entities.json").is_file() or not (spine / "matches").is_dir():
        message = ("staged spine not available at work/spine — run "
                   "`python -m pipeline.precompute.run --expect-records 104` first")
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)
    return spine


def test_a_write_failure_partway_through_leaves_data_matches_completely_untouched(
    tmp_path, repo_root, monkeypatch
):
    """The ledgered failure, driven for real: an `OSError` on bundle 57 used to leave 56
    files rewritten. The committed namespace must come out byte-identical to how it went
    in — not merely the same number of files."""
    spine = _spine(tmp_path, repo_root)
    data_dir = tmp_path / "data"
    target = _populate(data_dir / "matches", ["m001-alpha-bravo.json", "stale.json"])
    before = _snapshot(target)

    calls = {"n": 0}
    real_write = emit_module.write_canonical

    def flaky(obj, path):
        calls["n"] += 1
        if calls["n"] == 57:
            raise OSError("disk full on bundle 57")
        return real_write(obj, path)

    monkeypatch.setattr(emit_module, "write_canonical", flaky)

    with pytest.raises(OSError):
        emit_module.emit_bundles(spine, data_dir)

    assert calls["n"] == 57, "the failure must land mid-write, not before the loop"
    assert _snapshot(target) == before
    assert not staged_sibling(target).exists(), "the staging area must not survive"


def test_a_successful_emission_replaces_the_whole_namespace_and_leaves_no_scratch(
    tmp_path, repo_root
):
    """The swap subsumes the stale sweep it replaced: a bundle this run did not produce
    is gone, by construction rather than by a second pass."""
    spine = _spine(tmp_path, repo_root)
    data_dir = tmp_path / "data"
    _populate(data_dir / "matches", ["stale.json"])

    written = emit_module.emit_bundles(spine, data_dir, expect_matches=104)

    assert len(written) == 104
    assert not (data_dir / "matches" / "stale.json").exists()
    assert len(list((data_dir / "matches").glob("*.json"))) == 104
    assert not staged_sibling(data_dir / "matches").exists()
    assert not rollback_sibling(data_dir / "matches").exists()


def test_a_dry_run_writes_nothing_and_stages_nothing(tmp_path, repo_root):
    spine = _spine(tmp_path, repo_root)
    data_dir = tmp_path / "data"
    target = _populate(data_dir / "matches", ["stale.json"])
    before = _snapshot(target)

    assert len(emit_module.emit_bundles(spine, data_dir, dry_run=True)) == 104

    assert _snapshot(target) == before
    assert not staged_sibling(target).exists()


# --- emit_index --------------------------------------------------------------------


def test_a_write_failure_leaves_both_index_artifacts_untouched(tmp_path, repo_root, monkeypatch):
    """`tournament.json` and `leaderboards.json` install as one unit or not at all."""
    spine = _spine(tmp_path, repo_root)
    data_dir = tmp_path / "data"
    # `check_route_manifest` needs the bundles to be there, and its profile direction
    # reports "could not run" rather than raising when the directories are absent.
    emit_module.emit_bundles(spine, data_dir)
    index_dir = data_dir / "index"
    _populate(index_dir, ["tournament.json", "leaderboards.json"])
    before = _snapshot(index_dir)

    calls = {"n": 0}
    real_write = index_module.write_canonical

    def flaky(obj, path):
        calls["n"] += 1
        if calls["n"] == 2:
            raise OSError("disk full on the second index artifact")
        return real_write(obj, path)

    monkeypatch.setattr(index_module, "write_canonical", flaky)

    with pytest.raises(OSError):
        index_module.emit_index(spine, data_dir)

    assert calls["n"] == 2
    assert _snapshot(index_dir) == before
    assert not list(index_dir.glob(f"*{STAGED_SUFFIX}"))
    assert not list(index_dir.glob(f"*{ROLLBACK_SUFFIX}"))


def test_the_index_swap_never_reaches_the_profile_subdirectories(tmp_path, repo_root):
    """A DIRECTORY swap of `data/index/` would destroy 1,296 artifacts this run never
    built. The unit is the two FILES, and the sweep's `*.json` glob stays non-recursive."""
    import shutil

    spine = _spine(tmp_path, repo_root)
    data_dir = tmp_path / "data"
    emit_module.emit_bundles(spine, data_dir)
    index_dir = data_dir / "index"
    index_dir.mkdir(parents=True, exist_ok=True)
    # The COMPLETE committed profile set, copied rather than invented: a partial one would
    # fail `check_route_manifest`'s bijection before the write this test is about.
    for folder in ("team-profiles", "player-profiles"):
        source = repo_root / "data" / "index" / folder
        if not source.is_dir():
            pytest.skip(f"no committed {folder} to guard")
        shutil.copytree(source, index_dir / folder)
    teams, players = index_dir / "team-profiles", index_dir / "player-profiles"
    before = {**_snapshot(teams), **_snapshot(players)}

    index_module.emit_index(spine, data_dir)

    assert {**_snapshot(teams), **_snapshot(players)} == before
    assert (index_dir / "tournament.json").is_file()
    assert (index_dir / "leaderboards.json").is_file()
    assert not list(index_dir.glob(f"*{STAGED_SUFFIX}"))


# --- byte neutrality (Task 6.6) ----------------------------------------------------


def test_the_staged_write_path_is_byte_neutral_against_the_committed_tree(tmp_path, repo_root):
    """A staged-directory rewrite of the write phase changes WHEN bytes land, never WHICH
    bytes. Proven the way Story 1.18's review proved it: emit into an independent tree and
    diff against the committed one. This is also the shape that caught 1.18's surviving
    `perNinety` mutation, where 1,019 of 1,296 artifacts differed."""
    spine = _spine(tmp_path, repo_root)
    committed = repo_root / "data"
    if not (committed / "matches").is_dir():
        pytest.skip("no committed data/matches to compare against")

    data_dir = tmp_path / "data"
    emit_module.emit_bundles(spine, data_dir)
    index_module.emit_index(spine, data_dir)

    fresh = _snapshot(data_dir / "matches")
    assert len(fresh) == 104
    differ = [
        name for name, payload in fresh.items()
        if (committed / "matches" / name).read_bytes() != payload
    ]
    assert differ == [], f"{len(differ)} bundle(s) differ from the committed tree"
    for name in ("tournament.json", "leaderboards.json"):
        assert (data_dir / "index" / name).read_bytes() == \
            (committed / "index" / name).read_bytes()

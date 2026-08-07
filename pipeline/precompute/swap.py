"""All-or-nothing installation into the committed artifact tree.

Story 1.18 shipped the directory form of this for the 1,296 profile artifacts. Story 1.19
lifts it here and adds the file form, because the same hazard was still live on two more
write paths: `emit_bundles` wrote 104 bundles one at a time with no rollback, and
`emit_index` wrote `tournament.json` and `leaderboards.json` the same way.

**The hazard, stated once.** An `OSError` on bundle 57 used to leave 56 files written, the
stale sweep skipped, and the run exiting `2` — the code whose stated meaning is "the
harness could not run, so nothing was learned", printed over a half-rewritten committed
namespace. The next `identity.check_committed_data` would then pin that partial namespace
as the AD-3 immutability baseline, and an id once emitted never changes: undoing it is
expensive. The same reasoning applies with a sharper edge to the index pair, where a
partial write leaves `tournament.json` and `leaderboards.json` disagreeing about the same
tournament.

**Why staging siblings and not per-file `.tmp` renames** (the 1.18 ruling, unchanged): a
second rename pass leaves the namespace half-swapped for its whole duration and so
reproduces the hazard in a smaller window rather than removing it. Everything is written
first; only then is anything installed, and installation is rename-only.

**Scratch paths are SIBLINGS of the target, never children**, which is what makes them
matchable by a `.gitignore` pattern anchored at the parent — `data/matches.staged/` sits
beside `data/matches/`, not inside it. Every path this module can create is ignored; see
the block in `.gitignore` that names this module. That matters because a run killed
mid-write cannot clean up after itself, and a sweeping `git add` would otherwise commit
hundreds of orphan artifacts as though they were real.
"""

from __future__ import annotations

import shutil
from pathlib import Path

STAGED_SUFFIX = ".staged"
ROLLBACK_SUFFIX = ".previous.rollback"


def staged_sibling(target: "str | Path") -> Path:
    """Where `target` is built before it is installed."""
    target = Path(target)
    return target.with_name(f"{target.name}{STAGED_SUFFIX}")


def rollback_sibling(target: "str | Path") -> Path:
    """Where `target`'s previous contents are retired to during a swap."""
    target = Path(target)
    return target.with_name(f"{target.name}{ROLLBACK_SUFFIX}")


def clear(path: "str | Path") -> None:
    """Remove `path`, whether it is a file, a directory or absent.

    Callers use this to start from a clean staging area. A leftover staged directory from
    a killed run must never be written *into*, or this run would install that run's files
    alongside its own.
    """
    path = Path(path)
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def swap_directory(staged: Path, target: Path) -> "Path | None":
    """Replace `target` with `staged`, RETAINING the retired copy for the caller.

    `os.replace` cannot move a directory onto a non-empty directory on either platform, so
    the swap is retire-then-install with a rollback, not a single call.

    **Returns the retained backup rather than deleting it**, because atomicity sometimes
    has to span more than one namespace: `emit_profiles` can only undo a completed team
    swap after a failed player swap if the retired team directory still exists. The caller
    owns the cleanup once every swap has landed.
    """
    backup = rollback_sibling(target)
    if backup.exists():
        shutil.rmtree(backup)
    target.parent.mkdir(parents=True, exist_ok=True)
    retired = False
    if target.exists():
        target.rename(backup)
        retired = True
    try:
        staged.rename(target)
    except BaseException:
        if retired:
            backup.rename(target)
        raise
    return backup if retired else None


def swap_files(installs: "list[tuple[Path, Path]]") -> "list[Path]":
    """Install every `(staged, target)` pair as ONE unit, or leave all of them untouched.

    Unlike `swap_directory` this cleans up its own backups, because every member of the
    unit is handled in this one call — there is no second namespace whose failure could
    still need them.

    Used where the atomic unit is a set of FILES inside a directory that holds other
    things: `data/index/` also carries `team-profiles/` and `player-profiles/`, so
    swapping that directory wholesale would destroy 1,296 artifacts this run never built.
    """
    retired: "list[tuple[Path, Path]]" = []
    installed: "list[tuple[Path, Path]]" = []
    try:
        for staged, target in installs:
            backup = rollback_sibling(target)
            backup.unlink(missing_ok=True)
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                target.replace(backup)
                retired.append((target, backup))
            staged.replace(target)
            installed.append((staged, target))
    except BaseException:
        # Undo in reverse: un-install what landed, then restore what was retired. An entry
        # that was retired but never installed is covered by the second loop alone, which
        # is why the two lists are kept separately rather than inferred from one another.
        for staged, target in reversed(installed):
            target.replace(staged)
        for target, backup in reversed(retired):
            backup.replace(target)
        raise

    for _target, backup in retired:
        backup.unlink(missing_ok=True)
    return [target for _staged, target in installs]

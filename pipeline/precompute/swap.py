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


def clear_quietly(path: "str | Path") -> None:
    """`clear`, but a failure to remove is swallowed.

    ═══ WHY THIS EXISTS — 1.19 review patches P10 and P11, applied by 2.19 R3 ═══

    Cleanup runs in two places where an exception is the wrong outcome, and the pipeline
    had a defect at BOTH:

    · AFTER A SUCCESSFUL SWAP. The namespace has already been completely and correctly
      replaced; an `OSError` removing a retired backup (a Windows lock, an AV handle, a
      read-only file) propagated into `emit.main`'s `except (OSError, AssertionError):
      return 2` and printed "emission could not run" over a tree that HAD been emitted.
      That is exactly the failure mode Task 6.4 names, on the success path.

    · INSIDE A FAILURE HANDLER. An unguarded removal before `raise` can throw and REPLACE
      the exception it is cleaning up after — the real diagnostic (the `OSError` on bundle
      57) is lost and the reader is told about a temp directory instead.

    1.18 already shipped the answer and its reasoning: `profiles.py` clears scratch in a
    `finally` with `ignore_errors=True` because "a failure to remove a scratch directory
    must not turn a successful emission into a failed one". This is that rule, named once,
    for every caller.

    THE LEFTOVER IS NOT SILENT. Everything this module creates is covered by `.gitignore`'s
    named block, so an undeleted staging or rollback sibling cannot be committed by a
    sweeping `git add`; and the next run's `clear()` — which is NOT quiet — will fail loudly
    if it still cannot remove it, at the point where removing it actually matters.
    """
    try:
        clear(path)
    except OSError:
        pass


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
    # `clear`, not `shutil.rmtree` (1.19 review patch P15). A killed run can leave the
    # backup in the OTHER shape — `rmtree` raises `NotADirectoryError` on a file and
    # `unlink` raises on a directory — and the swap would die before it started. This
    # module defines `clear` for exactly that ("whether it is a file, a directory or
    # absent") and `emit_bundles` already uses it two frames up.
    clear(backup)
    target.parent.mkdir(parents=True, exist_ok=True)
    retired = False
    if target.exists():
        target.rename(backup)
        retired = True
    try:
        staged.rename(target)
    except BaseException:
        # THE RESTORE IS GUARDED (1.19 review patch P11). This is the sharpest case in the
        # module: if `backup.rename(target)` itself fails, `target` is ABSENT and the
        # exception the caller sees is the rollback's, not the cause. Suppressing the
        # rollback's own failure keeps the original diagnostic — the tree is equally
        # half-swapped either way, and the reader needs to know WHY.
        if retired:
            try:
                backup.rename(target)
            except OSError:
                pass
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
            # `clear`, not `unlink` — see `swap_directory` (1.19 review patch P15).
            clear(backup)
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
        # EVERY STEP OF THE UNDO IS GUARDED (1.19 review patch P11). A failure mid-undo
        # used to discard the original error AND leave the tree half-swapped — the state
        # this function's docstring promises cannot occur. Guarding each step means the
        # undo gets as far as it can and the CAUSE is what propagates.
        for staged, target in reversed(installed):
            try:
                target.replace(staged)
            except OSError:
                pass
        for target, backup in reversed(retired):
            try:
                backup.replace(target)
            except OSError:
                pass
        raise

    # POST-SUCCESS CLEANUP IS QUIET (1.19 review patch P10). Every install has landed; a
    # failure to remove a retired backup here must not be reported as a failed swap.
    for _target, backup in retired:
        clear_quietly(backup)
    return [target for _staged, target in installs]

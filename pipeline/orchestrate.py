"""End-to-end orchestration: the five phases, in the one order that works.

    python -m pipeline.orchestrate --input-dir pmsr-corpus --expect-reports 104

Story 1.19 owns end-to-end orchestration (ruling R5, shape (a)). "End-to-end" is FIVE
CLIs, not one, and their order is forced by what each phase reads:

    ingest.batch        pmsr-corpus/*.pdf        -> work/extracted/
    precompute.run      work/extracted/          -> work/spine/
    precompute.emit     work/spine/              -> data/matches/
    precompute.profiles data/matches/            -> data/index/{team,player}-profiles/
    precompute.index    work/spine/ + data/      -> data/index/{tournament,leaderboards}.json

**Why `profiles` runs BEFORE `index`, which is the whole point of this module.**
`index.check_route_manifest` checks AD-4's bijection in the profile direction *before* the
first `write_canonical`, and it raises on a set difference between `tournament.entities`
and the profile artifacts on disk. Once profiles exist, adding a single entity to the
spine therefore makes `index` refuse to emit the very manifest those profiles are built
from — the write-blocking deadlock ledgered against this story. `index.py`'s own docstring
offers the recourse of deleting both profile directories, emitting the index, and
re-running `profiles`, which is destructive, leaves `index` printing a qualified
`PASS (N check(s) COULD NOT RUN)`, and has to be remembered by hand every time.

It is not needed. **`profiles` reads `data/matches/` and nothing else** — not the spine,
not `tournament.json` — so it has no dependency on `index` at all, while `index` has a
hard one on it. Running `profiles` first means the profile artifacts already match the new
entity set by the time the bijection is checked, so the gate passes on the first attempt
and the deadlock never forms. **No gate is weakened, nothing is deleted, and the ordering
is byte-neutral by construction**: which bytes each phase writes is unchanged, only when.

**Exit-code contract, and the one place it is subtle.** The house contract is `0` clean /
`1` a real finding / `2` the harness could not run, and this module never masks a phase's
`1`: its own exit code is the worst any phase returned.

  * A phase exiting **2** stops the run immediately. Nothing was learned, so running the
    next phase over whatever is on disk can only compound the damage.
  * A **precompute** phase exiting 1 stops the run. A failed gate means the artifacts it
    guards are not trustworthy and the next phase would build on them.
  * `ingest.batch` exiting 1 **continues, conditionally, and this is deliberate.** The
    ruled clean-corpus baseline for this corpus IS exit 1: `PMSR-M19-ARG-V-ALG` and
    `PMSR-M58-TUN-V-NED` each draw one forced-turnover marker fewer than their own printed
    total, both hand-verified as source defects, and `precompute/records.py` rules both
    records CONSUMED — its filter is on `status` alone and never on `self_validation`.
    Stopping there would make the documented baseline unrunnable end to end. So the run
    continues **only when the batch's finding is self-validation and nothing else**: any
    failed report, corpus gap or orphan record stops it, because those mean the corpus
    itself is short and every downstream `--expect-*` count would be measuring a truncated
    run. The finding is still reported, and this module still exits 1.

There is no `--dry-run`. A dry run of `emit` writes no bundles, which leaves `profiles`
and `index` reading the *previous* run's artifacts while reporting on this one — an
end-to-end runner that can lie about what it validated is worse than no runner.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pipeline.ingest import batch as ingest_batch
from pipeline.ingest.records import DEFAULT_EXTRACTED_DIR
from pipeline.precompute import emit as precompute_emit
from pipeline.precompute import index as precompute_index
from pipeline.precompute import profiles as precompute_profiles
from pipeline.precompute import run as precompute_run

# Name, the phase's own `main(argv) -> int`, and whether a `1` from it is allowed to be a
# finding the run continues past. Only the batch qualifies, and only conditionally — see
# `_batch_finding_is_consumable`.
PHASES = (
    ("ingest.batch", ingest_batch.main),
    ("precompute.run", precompute_run.main),
    ("precompute.emit", precompute_emit.main),
    ("precompute.profiles", precompute_profiles.main),
    ("precompute.index", precompute_index.main),
)

HARNESS_FAILED = 2
FINDING = 1
CLEAN = 0


def _batch_finding_is_consumable(manifest_path: "str | Path") -> "tuple[bool, str]":
    """Whether the batch's exit 1 is a self-validation finding and nothing else.

    Returns `(consumable, reason)`. Unreadable, missing or off-shape manifests are NOT
    consumable: this decides whether to keep writing to the committed tree, so absence of
    evidence is never read as evidence. That is `check_committed_data`'s rule applied at a
    second seam — a gate that cannot fail is worse than no gate.
    """
    path = Path(manifest_path)
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
        run = manifest["run"]
        failed, gaps = run["failed_count"], run["corpus_gaps"]
        orphans = manifest["orphan_record_paths"]
        self_validation = run["self_validation_fail_count"]
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return False, f"the run manifest at {path.as_posix()} could not be read: {exc}"
    if failed or gaps or orphans:
        return False, (
            f"{failed} failed report(s), {len(gaps)} corpus gap(s), {len(orphans)} orphan "
            f"record(s) — the corpus is short, so every downstream --expect-* count would "
            f"be measuring a truncated run"
        )
    return True, (
        f"{self_validation} report(s) failed Self-Validation and nothing else failed. "
        f"precompute/records.py rules those records CONSUMED (its filter is on `status` "
        f"alone), so the run continues and this orchestrator still exits 1"
    )


def _phase_argv(name: str, args: argparse.Namespace) -> "list[str]":
    """The argv each phase's own CLI expects, built from one shared set of options."""
    if name == "ingest.batch":
        # `--output` is not optional here even though the phase defaults it. The
        # orchestrator READS this manifest to decide whether the batch's exit 1 is
        # consumable, so a phase writing to its own default while the runner inspects
        # another path would either read a stale manifest or clobber the real one from a
        # test's temporary tree. Both happened before this line existed.
        argv = ["--input-dir", str(args.input_dir), "--extracted-dir", str(args.extracted_dir),
                "--output", str(args.manifest)]
        if args.expect_reports is not None:
            argv += ["--expect-reports", str(args.expect_reports)]
        return argv
    if name == "precompute.run":
        argv = ["--extracted-dir", str(args.extracted_dir), "--spine-dir", str(args.spine_dir)]
        if args.expect_records is not None:
            argv += ["--expect-records", str(args.expect_records)]
        return argv
    if name == "precompute.emit":
        argv = ["--spine-dir", str(args.spine_dir), "--data-dir", str(args.data_dir)]
        if args.expect_matches is not None:
            argv += ["--expect-matches", str(args.expect_matches)]
        return argv
    if name == "precompute.profiles":
        argv = ["--data-dir", str(args.data_dir)]
        if args.expect_teams is not None:
            argv += ["--expect-teams", str(args.expect_teams)]
        if args.expect_players is not None:
            argv += ["--expect-players", str(args.expect_players)]
        return argv
    if name == "precompute.index":
        argv = ["--spine-dir", str(args.spine_dir), "--data-dir", str(args.data_dir)]
        if args.expect_matches is not None:
            argv += ["--expect-matches", str(args.expect_matches)]
        return argv
    raise ValueError(f"unknown phase {name!r}")  # pragma: no cover - guarded by PHASES


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.orchestrate",
        description=(
            "Run the five pipeline phases end to end in the one order that works: "
            "ingest.batch -> precompute.run -> precompute.emit -> precompute.profiles "
            "-> precompute.index."
        ),
    )
    parser.add_argument("--input-dir", type=Path, required=True,
                        help="directory holding the PMSR PDF corpus")
    parser.add_argument("--extracted-dir", type=Path, default=DEFAULT_EXTRACTED_DIR,
                        help=f"Extraction Record staging (default: "
                             f"{DEFAULT_EXTRACTED_DIR.as_posix()})")
    parser.add_argument("--spine-dir", type=Path, default=precompute_emit.DEFAULT_SPINE_DIR,
                        help="staged spine (default work/spine)")
    parser.add_argument("--data-dir", type=Path, default=precompute_emit.DEFAULT_DATA_DIR,
                        help="committed artifact tree (default data)")
    parser.add_argument("--manifest", type=Path, default=ingest_batch.DEFAULT_MANIFEST_PATH,
                        help=f"run manifest (default: "
                             f"{ingest_batch.DEFAULT_MANIFEST_PATH.as_posix()})")
    parser.add_argument("--expect-reports", type=int, default=None, metavar="N",
                        help="assert the corpus holds exactly N reports (use 104)")
    parser.add_argument("--expect-records", type=int, default=None, metavar="N",
                        help="assert exactly N Extraction Records reach the spine (use 104)")
    parser.add_argument("--expect-matches", type=int, default=None, metavar="N",
                        help="assert exactly N bundles are emitted and indexed (use 104)")
    parser.add_argument("--expect-teams", type=int, default=None, metavar="N",
                        help="assert exactly N team profiles are emitted (use 48)")
    parser.add_argument("--expect-players", type=int, default=None, metavar="N",
                        help="assert exactly N player profiles are emitted (use 1248)")
    return parser


def main(argv: "list[str] | None" = None) -> int:
    args = build_parser().parse_args(argv)

    # Same reason every phase does it: a PDF-derived name can hold characters a redirected
    # Windows console cannot encode, and a UnicodeEncodeError here would destroy the exit
    # code's meaning by making a completed run look like a crashed harness.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")

    print("")
    print("Pipeline end-to-end run")
    print("=" * 23)
    print(f"corpus          : {Path(args.input_dir).as_posix()}")
    print(f"data dir        : {Path(args.data_dir).as_posix()}")
    print(f"phases          : {' -> '.join(name for name, _main in PHASES)}")

    results: "list[tuple[str, int]]" = []
    worst = CLEAN
    for name, phase_main in PHASES:
        print("")
        print(f"--- {name} " + "-" * max(0, 60 - len(name)))
        # `SystemExit` because a phase's argparse rejects a bad option by raising it rather
        # than returning; without this the orchestrator would die with a traceback and no
        # phase table, which is the one output a reader needs when a phase would not start.
        try:
            code = phase_main(_phase_argv(name, args))
        except SystemExit as exit_code:  # pragma: no cover - argparse rejection path
            code = exit_code.code if isinstance(exit_code.code, int) else HARNESS_FAILED
        results.append((name, code))
        worst = max(worst, code)

        if code == CLEAN:
            continue
        if code >= HARNESS_FAILED:
            print("")
            print(f"{name} exited {code}: the harness could not run, so nothing was "
                  f"learned. Stopping before any later phase writes.", file=sys.stderr)
            break
        # code == FINDING
        if name != "ingest.batch":
            print("")
            print(f"{name} exited 1: a gate failed, so the artifacts it guards are not "
                  f"trustworthy. Stopping rather than building on them.", file=sys.stderr)
            break
        consumable, reason = _batch_finding_is_consumable(args.manifest)
        print("")
        if not consumable:
            print(f"ingest.batch exited 1 and the run stops: {reason}", file=sys.stderr)
            break
        print(f"ingest.batch exited 1 and the run continues: {reason}")

    print("")
    print("Phase results")
    for name, code in results:
        print(f"  {name:<20} exit {code}")
    skipped = [name for name, _main in PHASES if name not in {n for n, _c in results}]
    for name in skipped:
        print(f"  {name:<20} NOT RUN")

    print("")
    verdict = {CLEAN: "PASS", FINDING: "FAIL"}.get(worst, "COULD NOT RUN")
    print(f"PIPELINE RESULT: {verdict} ({len(results)} of {len(PHASES)} phase(s) run)")
    print("")
    return worst


if __name__ == "__main__":
    sys.exit(main())

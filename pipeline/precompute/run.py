"""CLI entrypoint for precompute.

    python -m pipeline.precompute.run [--expect-records 104]

Follows `pipeline/validate/verify.py`'s shape and exit-code contract:

    0  clean — identity resolved, every pin held, spine staged
    1  a finding — a pin would change, an override names nobody, a collision, an
       unresolved reference, or a record count that does not match --expect-records
    2  the harness could not run (unreadable manifest, unwritable staging directory)

The distinction matters because these are different jobs for whoever reads the exit code:
1 means the data or the rule is wrong and someone must rule on it; 2 means nothing was
learned at all.

The "committed /data baseline unavailable" line is **always printed and never
suppressed**. `data/matches/` does not exist until Story 1.16 emits, so on this run the
registry is the only immutability source — and a gate reporting green on a baseline it
never had is worse than no gate.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pipeline.errors import PipelineError
from pipeline.ingest.records import DEFAULT_EXTRACTED_DIR
from pipeline.precompute import slug_registry
from pipeline.precompute.identity import (
    build_pins,
    check_committed_data,
    check_overrides,
    check_pins,
    matchday_rounds,
    render_registry,
    resolve_players,
    team_codes,
    write_registry,
)
from pipeline.precompute.records import (
    DEFAULT_MANIFEST_PATH,
    DEFAULT_SPINE_DIR,
    load_records,
)
from pipeline.precompute.spine import build_spine, write_spine

REGISTRY_PATH = Path(__file__).with_name("slug_registry.py")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline.precompute.run",
        description=(
            "Resolve player, team and match identity across every Extraction Record the "
            "run manifest names, check the committed slug registry, and stage the "
            "normalized spine."
        ),
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST_PATH,
        help=f"run manifest to consume (default: {DEFAULT_MANIFEST_PATH.as_posix()})",
    )
    parser.add_argument(
        "--extracted-dir",
        type=Path,
        default=DEFAULT_EXTRACTED_DIR,
        help=f"where records are staged (default: {DEFAULT_EXTRACTED_DIR.as_posix()})",
    )
    parser.add_argument(
        "--spine-dir",
        type=Path,
        default=DEFAULT_SPINE_DIR,
        help=f"where the spine is staged (default: {DEFAULT_SPINE_DIR.as_posix()})",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="committed bundles for AC 3's second source (default: data)",
    )
    parser.add_argument(
        "--write-registry",
        action="store_true",
        help="regenerate slug_registry.py instead of checking this run against it",
    )
    parser.add_argument(
        "--expect-records",
        type=int,
        default=None,
        metavar="N",
        help="assert the manifest names exactly N consumable records (use 104)",
    )
    return parser


def main(argv: "list[str] | None" = None) -> int:
    args = build_parser().parse_args(argv)

    # PDF-derived names can hold characters a redirected Windows console cannot encode;
    # a UnicodeEncodeError here would look like a crashed harness and destroy the exit
    # code's meaning. Same reasoning as `pipeline/validate/verify.py`.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")

    try:
        records = load_records(args.manifest, args.extracted_dir)
    except PipelineError as exc:
        print(f"precompute could not run: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"precompute could not run: {exc}", file=sys.stderr)
        return 2

    print("")
    print("Cross-match identity resolution")
    print("=" * 31)
    print(f"manifest        : {Path(args.manifest).as_posix()}")
    print(f"records consumed: {len(records)}")

    if args.expect_records is not None and len(records) != args.expect_records:
        print(
            f"FAIL: manifest names {len(records)} consumable record(s), "
            f"expected {args.expect_records}",
            file=sys.stderr,
        )
        return 1

    try:
        codes = team_codes(records)
        resolved = resolve_players(records, codes, slug_registry)
        rounds = matchday_rounds(records)
        pins = build_pins(records, codes, slug_registry)

        print(f"team codes      : {len(codes)}")
        print(f"players         : {len(resolved)}")
        print(f"matches         : {len(pins['matches'])}")
        print(f"teams           : {len(pins['teams'])}")

        if args.write_registry:
            text = render_registry(codes, pins, dict(slug_registry.OVERRIDES))
            write_registry(text, REGISTRY_PATH)
            print(f"registry        : REGENERATED at {REGISTRY_PATH.as_posix()}")
        else:
            check_overrides(pins["players"], slug_registry.OVERRIDES)
            for kind in ("matches", "players", "teams"):
                check_pins(pins[kind], slug_registry.PINS.get(kind, {}), kind)
            pinned_total = sum(len(v) for v in slug_registry.PINS.values())
            print(f"registry        : {pinned_total} pinned id(s), all held")

        for note in check_committed_data(slug_registry.PINS, args.data_dir):
            print(f"data baseline   : {note}")

        spine = build_spine(records, resolved, codes, rounds, registry=slug_registry)
        written = write_spine(spine, args.spine_dir)
        print(f"spine           : {len(written)} file(s) under {Path(args.spine_dir).as_posix()}")
    except PipelineError as exc:
        print("")
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    print("")
    print("PRECOMPUTE RESULT: PASS")
    print("")
    return 0


if __name__ == "__main__":
    sys.exit(main())

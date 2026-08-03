"""Loading the Extraction Records a run stands behind, in canonical order.

**The manifest is the record of truth, not the directory listing.** `pipeline/ingest/
batch.py` states this in terms addressed to this story by name, and `pipeline/README.md`
gives the reason: `work/extracted/` may hold a record no current PDF produced — an orphan
left by a superseded run — and a directory listing would let it enter the dataset as a
phantom match. So this module walks `manifest["reports"]` and reads each entry's own
`record_path`; it never rebuilds a path from `extracted_dir` + `match_id`, because the
manifest names the exact file the run stands behind.

**Canonical order is free.** Every match id is `m{NNN}-…` with three-digit zero padding —
Story 1.1's logged decision, bought for exactly this AC — so lexicographic order over
match ids IS ascending numeric order. A plain `sorted()` is the canonical order; no
number needs parsing out of an id, and nothing here re-implements it.

**The filter is on `status` alone, and never on `self_validation`.** Two reports —
`PMSR-M19-ARG-V-ALG` and `PMSR-M58-TUN-V-NED` — carry `status: "extracted"` with
`self_validation: "fail"`. Their single failing check is `defensive-actions-marker-count`,
which touches no lineup entry, no name path and no shirt number: the identity inputs are
completely intact. Filtering them out would drop two matches from the tournament over a
source defect in an unrelated domain. That is a ruling, not an oversight.
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.ingest.records import DEFAULT_EXTRACTED_DIR, read_record
from pipeline.precompute.errors import PrecomputeError

DEFAULT_MANIFEST_PATH = Path("work") / "run-manifest.json"
DEFAULT_SPINE_DIR = Path("work") / "spine"

# The manifest statuses whose records are real, current output of this run. `failed`
# entries have no record at all; anything else is a status this module was not written
# against and must not silently consume.
CONSUMABLE_STATUSES: frozenset[str] = frozenset({"extracted", "skipped-unchanged"})


def load_records(
    manifest_path: "str | Path" = DEFAULT_MANIFEST_PATH,
    extracted_dir: "str | Path" = DEFAULT_EXTRACTED_DIR,
) -> list[dict]:
    """Every consumable Extraction Record the manifest names, in canonical order.

    `extracted_dir` is used ONLY to resolve a manifest `record_path` that is relative to
    somewhere other than the current directory — the path in the manifest wins. It is a
    parameter rather than a constant so tests can stage a corpus anywhere.

    This function deliberately does **not** compare a record's `idempotence.code_version`
    to the live `code_version()`. Committing `slug_registry.py` changes the live value by
    construction — it is Python under `pipeline/`, which is the whole point of choosing
    that format (AD-8) — so a precompute that gated on it could never run again after its
    own registry landed. Staleness is the *batch's* concern, decided by `is_unchanged`
    before a record is written. It is never precompute's.
    """
    manifest_path = Path(manifest_path)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PrecomputeError(f"run manifest {manifest_path.as_posix()!r} is unreadable: {exc}")
    except json.JSONDecodeError as exc:
        raise PrecomputeError(f"run manifest {manifest_path.as_posix()!r} is not JSON: {exc}")
    if not isinstance(manifest, dict):
        raise PrecomputeError(
            f"run manifest {manifest_path.as_posix()!r} is not a JSON object"
        )

    entries = manifest.get("reports")
    if not isinstance(entries, list):
        raise PrecomputeError(
            f"run manifest {manifest_path.as_posix()!r} has no 'reports' list"
        )

    consumable = [
        entry
        for entry in entries
        if isinstance(entry, dict) and entry.get("status") in CONSUMABLE_STATUSES
    ]

    records: list[dict] = []
    seen: dict[str, str] = {}
    for entry in consumable:
        match_id = entry.get("match_id")
        report_id = entry.get("report_id")
        record_path = entry.get("record_path")
        if not isinstance(match_id, str) or not isinstance(record_path, str):
            raise PrecomputeError(
                f"manifest entry {entry.get('report_id')!r} names no match id or record path"
            )
        # Named on insert rather than overwritten: the batch's own duplicate handling is
        # lossy when three reports collide, and a precompute that silently kept the last
        # one would inherit that defect at corpus scale.
        if match_id in seen:
            raise PrecomputeError(
                f"manifest names match id {match_id!r} twice: "
                f"reports {seen[match_id]!r} and {report_id!r}"
            )
        seen[match_id] = report_id if isinstance(report_id, str) else "<unknown>"

        path = Path(record_path)
        if not path.is_absolute() and not path.exists():
            path = Path(extracted_dir).parent / record_path
        record = read_record(path)
        if record is None:
            raise PrecomputeError(
                f"record {record_path!r} named by the manifest is missing or unreadable",
                report_id if isinstance(report_id, str) else None,
            )
        if record.get("match_id") != match_id:
            # A record staged under another match's identity is the exact failure
            # `match_id_for`'s cover/filename agreement exists to prevent upstream.
            raise PrecomputeError(
                f"record {record_path!r} carries match id {record.get('match_id')!r} "
                f"but the manifest names it {match_id!r}",
                report_id if isinstance(report_id, str) else None,
            )
        records.append(record)

    records.sort(key=lambda record: record["match_id"])
    return records

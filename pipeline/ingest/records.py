"""Canonical read/write of Extraction Records in `work/extracted/`.

Serialization recipe is the one `pipeline/validate/runner.py::_write` established:
`indent=2, ensure_ascii=False, sort_keys=True`, UTF-8, and `newline=""` so Windows does
not translate `\\n` to CRLF — that translation alone would make two runs of an unchanged
corpus differ byte-for-byte across hosts, which is exactly what AC 3 forbids.

Writes are **atomic**: serialize to a temp file in the same directory, then `os.replace`
onto the target (atomic on Windows and POSIX). A run interrupted mid-write must never
leave a truncated record that a later run reads as a valid skip.

Reading is deliberately unforgiving in the safe direction: a record that is missing,
unreadable, or malformed is treated as *absent*, so the report is re-extracted. Treating
it as a skip would let a corrupt file silently stand in for real data.

Keys are `snake_case`: `work/` is pipeline-internal staging (AD-9), and camelCase binds
only `/contract` and `/data`.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from pipeline.ingest.errors import RecordWriteError

DEFAULT_EXTRACTED_DIR = Path("work") / "extracted"

# Internal staging format version, unrelated to /contract's schemaVersion. Lives here
# rather than in `extract_report` because `is_unchanged` has to gate on it: a record
# written under an older shape must not license a skip even if both hash keys match.
RECORD_VERSION = 1

# Suffix of the atomic-write staging file. Named here so the batch's orphan scan can see
# leftovers: an interrupted write leaves one behind, and a `.json`-only scan never reports
# it, so it would accumulate invisibly in the staging directory.
TEMP_SUFFIX = ".tmp"


def canonical_json(obj: dict) -> str:
    """The canonical JSON text of any staging artifact — record or run manifest."""
    return json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def serialize_record(record: dict) -> str:
    """The record's canonical JSON text, exactly as it is written to disk."""
    return canonical_json(record)


def write_canonical(obj: dict, path: "str | Path") -> Path:
    """Write `obj` canonically and atomically to `path`, returning it.

    Raises `OSError`; callers that owe a report id wrap it in `RecordWriteError`.
    """
    target = Path(path)
    temporary = target.with_name(f"{target.name}.{os.getpid()}{TEMP_SUFFIX}")
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary.write_text(canonical_json(obj), encoding="utf-8", newline="")
        os.replace(temporary, target)
    except BaseException:
        # Deliberately `BaseException`, not `OSError`: `write_text` can raise
        # `UnicodeEncodeError` on a lone surrogate carried out of PDF-derived text, and
        # `json.dumps` a `TypeError` on an unserializable value — both after the temp file
        # exists. A `KeyboardInterrupt` mid-write is the same story. Anything narrower
        # leaves the staging file behind for good.
        try:
            temporary.unlink(missing_ok=True)
        except OSError:  # pragma: no cover - best effort; the real failure is the outer one
            pass
        raise
    return target


def record_path(extracted_dir: "str | Path", match_id: str) -> Path:
    """Where the record for `match_id` lives. Keyed by match id, not by file name."""
    return Path(extracted_dir) / f"{match_id}.json"


def write_record(record: dict, extracted_dir: "str | Path") -> Path:
    """Write one record atomically and return its path.

    Raises `RecordWriteError` — with the report id kept — so an unwritable staging
    directory is attributed to the report it stopped instead of aborting the batch.
    """
    target = record_path(extracted_dir, record["match_id"])
    try:
        return write_canonical(record, target)
    except OSError as exc:
        raise RecordWriteError(f"{target.as_posix()}: {exc}", record.get("report_id")) from exc


def read_record(path: "str | Path") -> dict | None:
    """Load a record, or `None` when it is missing, unreadable or not a JSON object.

    `None` means "re-extract", never "skip" — see the module docstring.
    """
    try:
        text = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    try:
        record = json.loads(text)
    except (json.JSONDecodeError, RecursionError):
        # `RecursionError` is not a `ValueError`, so a deeply nested file would otherwise
        # escape as a traceback — breaking this module's contract that anything
        # unreadable is *absent*, and taking the whole batch down with it.
        return None
    return record if isinstance(record, dict) else None


def is_unchanged(record: "dict | None", pdf_content_hash: str, code_version: str) -> bool:
    """Whether `record` was produced from these exact inputs by this exact code (AD-8).

    Both keys must be present and match. A record whose `idempotence` block is missing or
    the wrong shape answers `False`: it cannot prove what produced it, so it cannot
    license a skip.

    `record_version` is checked too. `code_version` covers a shape change made *here*,
    but not one in a record written by an older checkout, restored from a backup, or
    produced by hand — and a consumer that cannot read the shape must not be handed it
    just because two hashes line up.
    """
    if not isinstance(record, dict):
        return False
    if record.get("record_version") != RECORD_VERSION:
        return False
    keys = record.get("idempotence")
    if not isinstance(keys, dict):
        return False
    return (
        keys.get("pdf_content_hash") == pdf_content_hash
        and keys.get("code_version") == code_version
    )

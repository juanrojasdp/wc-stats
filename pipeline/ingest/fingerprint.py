"""The two idempotence keys AD-8 keys re-runs on: PDF content hash and code version.

A record may only be reused when *both* the input bytes and the extraction code that
produced it are unchanged. `pdf_content_hash` is the easy half. The code version is the
half that is easy to get subtly wrong, so it is a **source fingerprint**:

- A hand-bumped constant silently serves stale records the first time someone forgets to
  bump it. That failure is invisible and produces wrong data — the project's one
  unrecoverable failure mode.
- A git commit SHA is wrong exactly when re-runs happen most: during development a dirty
  worktree keeps reporting the committed SHA while the extractor changes underneath it.
- A fingerprint over the source itself is automatic, deterministic, and invalidates
  precisely when extraction code changes.

The **pinned dependency set is hashed too** (`pipeline/requirements.txt`). A pymupdf or
pdfplumber bump changes what every anchor, page count and cover line resolves to while
leaving every line of our own source untouched — so a source-only fingerprint would serve
all 104 stale records after an upgrade, which is the same invisible-stale-data failure a
hand-bumped constant produces. Cost, accepted deliberately in review (2026-07-22): any
dependency bump now invalidates the whole corpus and forces a full re-extract.

Trade-off, stated deliberately: `pipeline/tests/` is **excluded**. A test edit cannot
change extraction output, and invalidating all 104 records on every test tweak would make
the cache useless. Virtualenvs (`venv/`, `.venv/`, `site-packages/`), build trees and
`__pycache__/` (derived, and non-deterministic between interpreters) are excluded for the
same reason — and pruned during the walk rather than filtered after it, so their thousands
of vendored files are never enumerated at all.

Paths are sorted and hashed as relative **posix** strings so Windows and POSIX agree, and
so two checkouts of the same code at different locations produce the same key. The suffix
is matched case-insensitively for the same reason `discover_pdfs` does it: `rglob("*.py")`
is case-insensitive on Windows and case-sensitive on POSIX, so a `Foo.PY` would otherwise
give one checkout two different keys depending on the host.

AD-8 notes the code version "includes the committed slug registry". That registry is Story
1.15's artifact and does not exist yet. **It will only be picked up automatically if it is
committed as Python** — a registry landing as `.json`, `.csv` or `.yaml` falls outside the
source glob, and this module must be widened when 1.15 chooses its format. Adding it to
`EXTRA_FINGERPRINTED_FILES` is the one-line change.
"""

from __future__ import annotations

import hashlib
import os
from functools import lru_cache
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]

# Directory names excluded anywhere under the pipeline root (see the module docstring).
EXCLUDED_DIRS = frozenset(
    {"tests", "venv", ".venv", "site-packages", "__pycache__", "build", ".tox", ".mypy_cache"}
)

# Non-Python files whose contents change extraction output. Paths are relative to the root.
# Story 1.15's slug registry belongs here if it lands as anything other than a `.py`.
EXTRA_FINGERPRINTED_FILES: tuple[str, ...] = ("requirements.txt",)

_SOURCE_SUFFIX = ".py"

_CHUNK_BYTES = 1 << 20


def pdf_content_hash(path: "str | Path") -> str:
    """SHA-256 over a file's bytes, lowercase hex.

    Read in chunks: a PMSR report runs to several megabytes and the batch hashes 104 of
    them, including the ones it is about to skip without opening.
    """
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        while chunk := handle.read(_CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def _fingerprinted_files(root: Path) -> "list[tuple[str, Path]]":
    """Every `(relative posix path, path)` that contributes to the fingerprint.

    Excluded directories are pruned from the walk rather than filtered afterwards, so a
    virtualenv's thousands of vendored files are never enumerated.
    """
    entries: list[tuple[str, Path]] = []
    for directory, subdirectories, file_names in os.walk(root):
        subdirectories[:] = [name for name in subdirectories if name not in EXCLUDED_DIRS]
        for file_name in file_names:
            path = Path(directory) / file_name
            if path.suffix.lower() != _SOURCE_SUFFIX:
                continue
            entries.append((path.relative_to(root).as_posix(), path))

    for relative_posix in EXTRA_FINGERPRINTED_FILES:
        path = root / relative_posix
        if path.is_file():
            entries.append((relative_posix, path))
    return entries


def source_fingerprint(root: "str | Path") -> str:
    """SHA-256 over the sorted `(relative posix path, file bytes)` of the source set.

    The source set is `root/**/*.py` (excluded directories pruned) plus
    `EXTRA_FINGERPRINTED_FILES` — see the module docstring for why the pinned dependency
    set is in there.

    Takes the root as an argument so the rule can be proven on a throwaway tree rather
    than by mutating the real `pipeline/`.
    """
    root = Path(root)
    entries = _fingerprinted_files(root)
    if not entries:
        # SHA-256 of no input is a perfectly good hex string, and it would be returned
        # forever: `code_version` would silently become a constant and every staged record
        # would answer `is_unchanged` for the rest of time. That is precisely the
        # invisible-stale-data mode this module exists to rule out, so it fails loud.
        raise ValueError(
            f"no source files found under {root} — refusing to fingerprint an empty tree"
        )

    digest = hashlib.sha256()
    for relative_posix, path in sorted(entries):
        # The path is hashed too: renaming a module changes what the pipeline does even
        # when no line of code changed, so it must invalidate staged records.
        digest.update(relative_posix.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


@lru_cache(maxsize=1)
def code_version() -> str:
    """The extraction code's fingerprint, computed once per process.

    Memoized: recomputing it for each of 104 reports would re-read the whole package
    every time, and the source cannot change mid-run in any way this pipeline supports.
    """
    return source_fingerprint(PIPELINE_ROOT)

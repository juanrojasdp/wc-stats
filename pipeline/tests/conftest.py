"""Shared pytest fixtures. Repo-root-relative paths only (no absolute paths)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]

# Allow `python -m pytest pipeline/tests` from any working directory.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def mex_rsa_pdf(repo_root: Path) -> Path:
    """The ground-truth fixture (AR-16). Read-only — spike/ is frozen.

    NOT committed: it is a copyrighted FIFA report, so `.gitignore` excludes it and a fresh
    clone does not have it. That makes the skip below load-bearing rather than incidental —
    and a skip is exactly how a missing fixture comes to read as a pass. Under CI the absence
    is therefore a failure, so nobody can ship a green run in which these tests never
    executed. Locally it stays a skip, because a contributor without the corpus should still
    be able to run everything else.
    """
    path = repo_root / "spike" / "mex_rsa.pdf"
    if not path.exists():
        message = (
            "ground-truth fixture spike/mex_rsa.pdf not available — fetch it with "
            "download_pmsr_corpus.py (it is copyrighted and deliberately not committed)"
        )
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)
    return path


@pytest.fixture(scope="session")
def spike_corpus(mex_rsa_pdf: Path) -> Path:
    """`spike/` as a single-report corpus directory.

    Depends on `mex_rsa_pdf` deliberately: without that guard a missing fixture would
    leave `spike/` looking like an empty corpus, and every test using it would still pass
    having verified nothing at all.
    """
    return mex_rsa_pdf.parent

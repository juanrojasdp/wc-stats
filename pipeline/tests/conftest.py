"""Shared pytest fixtures. Repo-root-relative paths only (no absolute paths)."""

from __future__ import annotations

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
    """The permanent ground-truth fixture (AR-16). Read-only — spike/ is frozen."""
    path = repo_root / "spike" / "mex_rsa.pdf"
    if not path.exists():
        pytest.skip("ground-truth fixture spike/mex_rsa.pdf not available")
    return path


@pytest.fixture(scope="session")
def spike_corpus(mex_rsa_pdf: Path) -> Path:
    """`spike/` as a single-report corpus directory.

    Depends on `mex_rsa_pdf` deliberately: without that guard a missing fixture would
    leave `spike/` looking like an empty corpus, and every test using it would still pass
    having verified nothing at all.
    """
    return mex_rsa_pdf.parent

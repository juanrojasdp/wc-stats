"""Task 1: the pipeline workspace is importable and the pinned stack is present."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

REQUIREMENTS = Path(__file__).resolve().parents[1] / "requirements.txt"


def test_pipeline_subpackages_import():
    import pipeline
    import pipeline.discover
    import pipeline.validate

    assert pipeline.discover is not None
    assert pipeline.validate is not None


def _pins() -> dict[str, str]:
    """Exact pins declared in requirements.txt, as {distribution: version}.

    The optional-extras group is part of the requirement but not of the distribution name:
    `jsonschema[format]==4.26.0` installs the distribution `jsonschema`, which is what
    `importlib.metadata.version` answers to.
    """
    pins = {}
    for line in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        match = re.match(
            r"^([A-Za-z0-9_.-]+)(?:\[[A-Za-z0-9_,.-]+\])?==([0-9][^\s#]*)$", line.strip()
        )
        if match:
            pins[match.group(1).lower()] = match.group(2)
    return pins


def test_requirements_pin_every_dependency_exactly():
    """AR-15: exact patch pins, so a re-run cannot silently pick up a new parser."""
    assert set(_pins()) == {
        "pymupdf",
        "pdfplumber",
        "pytest",
        # Added by Story 1.1 for contract validation.
        "jsonschema",
        "referencing",
    }


@pytest.mark.parametrize(
    "distribution", ["pymupdf", "pdfplumber", "pytest", "jsonschema", "referencing"]
)
def test_installed_version_matches_the_pin(distribution):
    """Assert the real installed version, not merely that the import succeeds."""
    from importlib.metadata import version

    assert version(distribution) == _pins()[distribution]


def test_python_version_meets_the_architecture_floor():
    """AR-15 mandates Python 3.13+."""
    assert sys.version_info >= (3, 13)

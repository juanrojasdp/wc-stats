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
    import pipeline.ingest
    import pipeline.validate

    assert pipeline.discover is not None
    assert pipeline.ingest is not None
    assert pipeline.validate is not None


_PIN_RE = re.compile(r"^([A-Za-z0-9_.-]+)(?:\[[A-Za-z0-9_,.-]+\])?==([0-9][^\s#]*)$")


def _requirement_lines() -> list[str]:
    """Every line of requirements.txt that states a requirement, comments and blanks removed."""
    lines = []
    for raw in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            lines.append(line)
    return lines


def _pins() -> dict[str, str]:
    """Exact pins declared in requirements.txt, as {distribution: version}.

    The optional-extras group is part of the requirement but not of the distribution name:
    `jsonschema[format]==4.26.0` installs the distribution `jsonschema`, which is what
    `importlib.metadata.version` answers to.
    """
    pins = {}
    for line in _requirement_lines():
        match = _PIN_RE.match(line)
        if match:
            pins[match.group(1).lower()] = match.group(2)
    return pins


def test_every_requirement_line_is_an_exact_pin():
    """AR-15 head-on: a line this file cannot parse as `name==version` must FAIL, not vanish.

    `_pins()` silently drops anything that is not an exact pin, so on its own it can never
    catch the thing it is named for -- adding `requests>=2.0` would leave the pin set
    unchanged and the suite green. This test compares against the raw requirement lines, so a
    range specifier, a bare name or a `-r other.txt` include is a visible failure.
    """
    unpinned = [line for line in _requirement_lines() if not _PIN_RE.match(line)]
    assert unpinned == [], (
        "requirements.txt must pin every dependency to an exact patch version (AR-15); "
        f"these lines do not: {unpinned}"
    )


def test_requirements_pin_every_dependency_exactly():
    """AR-15: exact patch pins, so a re-run cannot silently pick up a new parser."""
    assert set(_pins()) == {
        "pymupdf",
        "pdfplumber",
        "pytest",
        # Added by Story 1.1 for contract validation.
        "jsonschema",
        "referencing",
        # Transitive via jsonschema[format], pinned directly because the `date-time` format
        # check silently stops existing without it (see requirements.txt).
        "rfc3339-validator",
    }


@pytest.mark.parametrize(
    "distribution",
    ["pymupdf", "pdfplumber", "pytest", "jsonschema", "referencing", "rfc3339-validator"],
)
def test_installed_version_matches_the_pin(distribution):
    """Assert the real installed version, not merely that the import succeeds."""
    from importlib.metadata import version

    assert version(distribution) == _pins()[distribution]


def test_python_version_meets_the_architecture_floor():
    """AR-15 mandates Python 3.13+."""
    assert sys.version_info >= (3, 13)

"""Task 3: the two idempotence keys — PDF content hash and code version (AC 3).

The real `pipeline/` tree is never mutated: source-fingerprint behaviour is proven on
throwaway trees built in `tmp_path`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.ingest.fingerprint import (
    PIPELINE_ROOT,
    code_version,
    pdf_content_hash,
    source_fingerprint,
)

HEX64 = 64


def _tree(root: Path, files: "dict[str, str]") -> Path:
    for relative, text in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="")
    return root


# --- PDF content hash ------------------------------------------------------------


def test_content_hash_is_lowercase_hex_sha256(tmp_path):
    path = tmp_path / "a.pdf"
    path.write_bytes(b"%PDF-1.7 whatever")

    digest = pdf_content_hash(path)

    assert len(digest) == HEX64
    assert digest == digest.lower()
    assert all(ch in "0123456789abcdef" for ch in digest)


def test_content_hash_is_stable_for_the_same_bytes(tmp_path):
    (tmp_path / "a.pdf").write_bytes(b"identical bytes")
    (tmp_path / "b.pdf").write_bytes(b"identical bytes")

    assert pdf_content_hash(tmp_path / "a.pdf") == pdf_content_hash(tmp_path / "b.pdf")


def test_content_hash_differs_for_differing_bytes(tmp_path):
    (tmp_path / "a.pdf").write_bytes(b"one")
    (tmp_path / "b.pdf").write_bytes(b"two")

    assert pdf_content_hash(tmp_path / "a.pdf") != pdf_content_hash(tmp_path / "b.pdf")


def test_content_hash_matches_a_hand_computed_digest(tmp_path):
    """Pin the algorithm itself, not merely that it is self-consistent."""
    import hashlib

    payload = b"the quick brown fox" * 1000  # spans several read chunks
    path = tmp_path / "big.pdf"
    path.write_bytes(payload)

    assert pdf_content_hash(path) == hashlib.sha256(payload).hexdigest()


# --- code version ----------------------------------------------------------------


def test_code_version_is_stable_across_calls():
    """Memoized per process, and a re-read of an unchanged tree must agree with it."""
    assert code_version() == code_version()
    assert code_version() == source_fingerprint(PIPELINE_ROOT)


def test_code_version_is_lowercase_hex_sha256():
    digest = code_version()

    assert len(digest) == HEX64
    assert all(ch in "0123456789abcdef" for ch in digest)


def test_the_fingerprint_changes_when_a_pipeline_source_file_changes(tmp_path):
    """A hand-bumped constant would silently serve stale records; this cannot."""
    root = _tree(tmp_path / "pipeline", {"a.py": "x = 1\n", "sub/b.py": "y = 2\n"})
    before = source_fingerprint(root)

    (root / "sub" / "b.py").write_text("y = 3\n", encoding="utf-8", newline="")

    assert source_fingerprint(root) != before


def test_the_fingerprint_changes_when_a_source_file_is_added_or_removed(tmp_path):
    root = _tree(tmp_path / "pipeline", {"a.py": "x = 1\n"})
    before = source_fingerprint(root)

    (root / "c.py").write_text("z = 3\n", encoding="utf-8", newline="")
    with_added = source_fingerprint(root)
    assert with_added != before

    (root / "c.py").unlink()
    assert source_fingerprint(root) == before


def test_the_fingerprint_ignores_tests_venv_and_pycache(tmp_path):
    """A test edit cannot change extraction output; invalidating 104 records would be waste.

    `.venv` is excluded alongside `venv`: it is the more common convention, and a missed
    exclusion would fold every vendored file into the key, so `code_version` would churn on
    each `pip install` and invalidate all 104 records for no reason.
    """
    root = _tree(
        tmp_path / "pipeline",
        {
            "a.py": "x = 1\n",
            "tests/test_a.py": "assert True\n",
            "venv/Lib/site.py": "vendored = 1\n",
            ".venv/Lib/site.py": "vendored = 1\n",
            "build/lib/copy.py": "built = 1\n",
            "__pycache__/a.cpython-314.pyc": "not really bytecode\n",
        },
    )
    before = source_fingerprint(root)

    (root / "tests" / "test_a.py").write_text("assert False\n", encoding="utf-8", newline="")
    (root / "venv" / "Lib" / "site.py").write_text("vendored = 2\n", encoding="utf-8", newline="")
    (root / ".venv" / "Lib" / "site.py").write_text("vendored = 3\n", encoding="utf-8", newline="")
    (root / "build" / "lib" / "copy.py").write_text("built = 2\n", encoding="utf-8", newline="")
    (root / "__pycache__" / "a.cpython-314.pyc").write_text("other\n", encoding="utf-8", newline="")

    assert source_fingerprint(root) == before


def test_the_fingerprint_ignores_non_python_files_it_was_not_told_about(tmp_path):
    """Documentation cannot change extraction output, so it must not invalidate records."""
    root = _tree(tmp_path / "pipeline", {"a.py": "x = 1\n", "README.md": "docs\n"})
    before = source_fingerprint(root)

    (root / "README.md").write_text("different docs\n", encoding="utf-8", newline="")

    assert source_fingerprint(root) == before


def test_the_fingerprint_changes_when_a_pinned_dependency_changes(tmp_path):
    """A pymupdf bump changes every anchor and page count while our own source stands still.

    A source-only key would serve all 104 stale records after an upgrade — the same
    invisible-stale-data failure a hand-bumped constant produces. Review decision
    (2026-07-22): the pinned dependency set is part of the code version.
    """
    root = _tree(
        tmp_path / "pipeline", {"a.py": "x = 1\n", "requirements.txt": "pymupdf==1.28.0\n"}
    )
    before = source_fingerprint(root)

    (root / "requirements.txt").write_text("pymupdf==1.29.0\n", encoding="utf-8", newline="")

    assert source_fingerprint(root) != before


def test_the_real_pipeline_fingerprint_covers_the_pinned_requirements(tmp_path):
    """The rule is proven on a throwaway tree above; this binds it to the real package."""
    from pipeline.ingest.fingerprint import EXTRA_FINGERPRINTED_FILES, PIPELINE_ROOT

    assert "requirements.txt" in EXTRA_FINGERPRINTED_FILES
    assert (PIPELINE_ROOT / "requirements.txt").is_file()


def test_the_suffix_match_is_case_insensitive(tmp_path):
    """`rglob("*.py")` is case-insensitive on Windows and case-sensitive on POSIX.

    `discover_pdfs` guards this exact hazard for corpus membership; leaving it unguarded
    here would give one checkout two different `code_version` values depending on the host.
    """
    root = _tree(tmp_path / "pipeline", {"a.py": "x = 1\n", "Helper.PY": "y = 2\n"})
    before = source_fingerprint(root)

    (root / "Helper.PY").write_text("y = 3\n", encoding="utf-8", newline="")

    assert source_fingerprint(root) != before


def test_fingerprinting_an_empty_tree_fails_loud_rather_than_returning_a_constant(tmp_path):
    """SHA-256 of no input is a perfectly good hex string — and a permanent one.

    Returned silently, `code_version` becomes a constant and every staged record answers
    `is_unchanged` for the rest of time: the invisible-stale-data mode this module exists
    to rule out.
    """
    empty = tmp_path / "pipeline"
    empty.mkdir()

    with pytest.raises(ValueError, match="no source files"):
        source_fingerprint(empty)


def test_the_fingerprint_depends_on_the_path_not_only_the_bytes(tmp_path):
    """Renaming a module changes what the pipeline does, so it must invalidate records."""
    one = _tree(tmp_path / "one" / "pipeline", {"a.py": "x = 1\n"})
    other = _tree(tmp_path / "other" / "pipeline", {"b.py": "x = 1\n"})

    assert source_fingerprint(one) != source_fingerprint(other)


def test_the_fingerprint_is_independent_of_the_root_location(tmp_path):
    """Relative posix paths only — two checkouts of the same code must agree."""
    one = _tree(tmp_path / "checkout-one" / "pipeline", {"a.py": "x = 1\n", "s/b.py": "y = 2\n"})
    other = _tree(tmp_path / "checkout-two" / "pipeline", {"a.py": "x = 1\n", "s/b.py": "y = 2\n"})

    assert source_fingerprint(one) == source_fingerprint(other)

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


COVER_ANCHOR = "POST MATCH SUMMARY REPORT"


@pytest.fixture(scope="session")
def make_report():
    """Factory for a synthetic PMSR report whose every registered anchor resolves.

    The cover block is built in the exact shape `probe.probe_report` asserts positively —
    scoreline, optional shoot-out line, stage, date, kick-off, venue, cover anchor, each
    immediately following the last — because anything else fails to probe and the report
    never reaches the code under test.

    Anchor pages are generated from `ANCHOR_REGISTRY` itself rather than hand-listed, so
    a domain page added by a later story widens these fixtures automatically. Each anchor
    gets its own page with its text at the top, which is what `at_page_start` anchors
    require. Pass `drop_anchor_ids` to build a report that is missing a required section.

    `page_order` re-orders the anchor pages (the cover always stays first — `probe_report`
    reads it by position). `AC 4` says a shuffled or offset report must still resolve, so
    a fixture that can only ever emit registry order cannot demonstrate it.
    """
    from pipeline.discover.anchors import ANCHOR_REGISTRY, resolve_anchors

    def _make(
        path: Path,
        *,
        number: int = 1,
        home: str = "Mexico",
        away: str = "South Africa",
        home_score: int = 2,
        away_score: int = 0,
        stage: str | None = None,
        venue: str = "Test Stadium",
        day: int = 11,
        kickoff: str = "13:00",
        shootout: str | None = None,
        drop_anchor_ids: "tuple[str, ...]" = (),
        page_order: "str" = "registry",
        filler_pages: int = 0,
    ) -> Path:
        import pymupdf

        stage = stage if stage is not None else f"Group A - Match {number}"
        lines = [f"{home} {home_score} - {away_score} {away}"]
        if shootout is not None:
            lines.append(shootout)
        lines += [stage, f"{day} June 2026", f"{kickoff} Kick Off", venue, COVER_ANCHOR]

        doc = pymupdf.open()
        cover = doc.new_page(width=960, height=540)
        y = 100.0
        for line in lines:
            cover.insert_text((80, y), line, fontsize=16)
            y += 40

        resolved = resolve_anchors(ANCHOR_REGISTRY, home=home, away=away)

        # A typo in `drop_anchor_ids` used to drop nothing at all, so a test written to
        # assert a missing-required-anchor failure would quietly build a complete report
        # and pass for the wrong reason. Fail the fixture instead.
        known = {anchor.anchor_id for anchor in resolved}
        unknown = sorted(set(drop_anchor_ids) - known)
        if unknown:
            raise AssertionError(f"drop_anchor_ids names no such anchor: {unknown}")

        body = [
            anchor
            for anchor in resolved
            if anchor.anchor_id != "cover" and anchor.anchor_id not in drop_anchor_ids
        ]
        if page_order == "reversed":
            body = list(reversed(body))
        elif page_order != "registry":
            raise AssertionError(f"unknown page_order {page_order!r}")

        # Content-free pages, so anchor pages sit at indices nothing could guess.
        for _ in range(filler_pages):
            doc.new_page(width=960, height=540)

        for anchor in body:
            page = doc.new_page(width=960, height=540)
            page.insert_text((40, 60), anchor.text, fontsize=11)

        path.parent.mkdir(parents=True, exist_ok=True)
        doc.save(path)
        doc.close()
        return path

    return _make

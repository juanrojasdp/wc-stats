"""Task 6: CLI entrypoint and re-run semantics (AC 3, AC 5)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from pipeline.validate.runner import DEFAULT_OUTPUT_PATH
from pipeline.validate.verify import build_parser, format_summary, main


def test_input_dir_is_required_and_not_hardcoded():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args([])

    args = parser.parse_args(["--input-dir", "some/corpus"])
    assert args.input_dir == Path("some/corpus")
    assert args.output == DEFAULT_OUTPUT_PATH


def test_output_path_is_overridable():
    args = build_parser().parse_args(["--input-dir", "c", "--output", "o/report.json"])
    assert args.output == Path("o/report.json")


def _cover_pdf(path, stage="Final", venue="V1", day=11, teams=("T1", "T2")):
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    y = 100.0
    for line in [
        f"{teams[0]} 2 - 0 {teams[1]}",
        stage,
        f"{day} June 2026",
        "13:00 Kick Off",
        venue,
        "POST MATCH SUMMARY REPORT",
    ]:
        page.insert_text((80, y), line, fontsize=18)
        y += 40
    doc.save(path)
    doc.close()
    return path


def _gapless_corpus(directory):
    directory.mkdir(parents=True, exist_ok=True)
    pairs =[("T1", "T2"), ("T3", "T4"), ("T1", "T3"), ("T2", "T4"), ("T1", "T4"), ("T2", "T3")]
    for i, (home, away) in enumerate(pairs):
        _cover_pdf(directory / f"g{i + 1}.pdf", stage=f"Group A - Match {i + 1}",
                   venue=f"Venue {i + 1}", day=11 + i, teams=(home, away))
    stages = ["Round of 32", "Round of 16", "Quarter Final", "Semi Final",
              "Third Place Play-Off", "Final"]
    for i, stage in enumerate(stages):
        _cover_pdf(directory / f"k{i + 1}.pdf", stage=stage, venue=f"Venue {i + 1}",
                   day=20 + i, teams=(f"K{i}A", f"K{i}B"))
    return directory


def test_main_returns_zero_on_a_clean_gate(tmp_path, capsys, monkeypatch):
    """A clean gate needs a corpus with no gaps; `spike/` alone can never produce one."""
    corpus = _gapless_corpus(tmp_path / "corpus")
    output = tmp_path / "report.json"

    # No registered checks fire, so the only possible findings are corpus-level.
    monkeypatch.setattr("pipeline.validate.runner.registered_checks", list)
    exit_code = main(["--input-dir", str(corpus), "--output", str(output)])

    assert exit_code == 0
    assert json.loads(output.read_text(encoding="utf-8"))["gate"]["result"] == "pass"
    assert "PASS" in capsys.readouterr().out


def test_main_returns_two_when_the_harness_cannot_run(tmp_path, capsys):
    """A bad input directory is a broken harness, not a failed gate — CI must tell them apart."""
    exit_code = main(["--input-dir", str(tmp_path / "nope"), "--output", str(tmp_path / "r.json")])

    assert exit_code == 2
    assert "could not run" in capsys.readouterr().err


def test_expect_reports_is_accepted_and_asserted(tmp_path, capsys):
    _cover_pdf(tmp_path / "only.pdf")

    exit_code = main(
        [
            "--input-dir", str(tmp_path),
            "--output", str(tmp_path / "r.json"),
            "--expect-reports", "104",
        ]
    )

    assert exit_code == 1
    assert "expected 104" in capsys.readouterr().out


def test_main_returns_nonzero_when_deviations_are_found(tmp_path, capsys):
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=960, height=540)
    y = 100.0
    for line in [
        "Mexico 2 - 0 South Africa",
        "Group A - Match 1",
        "11 June 2026",
        "13:00 Kick Off",
        "Stadium One",
        "POST MATCH SUMMARY REPORT",
    ]:
        page.insert_text((80, y), line, fontsize=18)
        y += 40
    doc.save(tmp_path / "cover_only.pdf")
    doc.close()

    exit_code = main(["--input-dir", str(tmp_path), "--output", str(tmp_path / "r.json")])

    assert exit_code == 1
    assert "FAIL" in capsys.readouterr().out


def test_summary_localizes_by_venue_and_matchday():
    report = {
        "input_dir": "corpus",
        "corpus": {"report_count": 2, "probed_count": 2, "probe_failure_count": 0},
        "checks_run": ["anchor-coverage", "metadata-probe"],
        "sample": [
            {
                "report_id": "a",
                "venue": "Stadium One",
                "matchday_round": "group-md1",
                "covers": ["round", "venue"],
            }
        ],
        "reports": [
            {
                "report_id": "a",
                "venue": "Stadium One",
                "matchday_round": "group-md1",
                "sampled": True,
                "deviations": [
                    {
                        "report_id": "a",
                        "check": "anchor-coverage",
                        "category": "missing-anchor",
                        "specifics": "anchor 'shots:home' not found",
                    }
                ],
            }
        ],
        "deviation_counts_by_category": {
            "missing-anchor": 1,
            "unknown-rgb": 0,
            "count-mismatch": 0,
            "probe-failure": 0,
        },
        "deviations_by_venue": {"Stadium One": 1},
        "deviations_by_matchday_round": {"group-md1": 1},
        "corpus_gaps": ["no report present for matchday round 'final'"],
        "gate": {
            "result": "fail",
            "deviation_count": 1,
            "corpus_gap_count": 1,
            "sample_size": 1,
        },
    }

    summary = format_summary(report)

    assert "Stadium One" in summary
    assert "group-md1" in summary
    assert "missing-anchor" in summary
    assert "FAIL" in summary
    assert "anchor 'shots:home' not found" in summary
    assert "no report present for matchday round 'final'" in summary


def test_module_is_runnable_as_python_m(repo_root, spike_corpus, tmp_path):
    """`python -m pipeline.validate.verify --input-dir <dir>` is the documented entrypoint."""
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pipeline.validate.verify",
            "--input-dir",
            str(spike_corpus),
            "--output",
            str(tmp_path / "cli.json"),
        ],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )

    # spike/ is a one-report corpus, so the gate legitimately fails on corpus gaps —
    # exit 1 (gate failed), never exit 2 (harness broken).
    assert result.returncode == 1, result.stderr
    assert (tmp_path / "cli.json").exists()


def test_rerun_produces_byte_identical_report_apart_from_the_timestamp(spike_corpus, tmp_path):
    """Bytes, not parsed dicts — canonical serialization is the property under test."""
    import re

    first_path, second_path = tmp_path / "a.json", tmp_path / "b.json"
    main(["--input-dir", str(spike_corpus), "--output", str(first_path)])
    main(["--input-dir", str(spike_corpus), "--output", str(second_path)])

    def blank_timestamp(raw: bytes) -> bytes:
        return re.sub(rb'"run_timestamp": "[^"]*"', b'"run_timestamp": ""', raw)

    first, second = first_path.read_bytes(), second_path.read_bytes()
    assert b"\r\n" not in first
    assert blank_timestamp(first) == blank_timestamp(second)

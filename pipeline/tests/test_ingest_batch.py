"""Tasks 6/7: batch runner, run manifest, idempotence and the CLI (AC 1, 2, 3, 4).

Multi-report corpora are synthetic PDFs built in `tmp_path`, never the real corpus: it is
gitignored (`*.pdf`), so it is not present in every checkout, and a test pointing at a
missing directory would run against an empty corpus and pass having verified nothing — a
Story 1.4 review finding. Tests needing a real PDF use the `mex_rsa_pdf` fixture, which
carries a skip-guard for exactly that reason.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from pipeline.ingest import batch as batch_module
from pipeline.ingest.batch import (
    MANIFEST_VERSION,
    STATUSES,
    build_parser,
    discover_pdfs,
    main,
    run_batch,
)

TEAMS = [
    ("Alpha", "Bravo"),
    ("Charlie", "Delta"),
    ("Echo", "Foxtrot"),
    ("Golf", "Hotel"),
    ("India", "Juliett"),
]

# Story 1.19 Task 4.1. `_corpus` used to index `TEAMS` directly, so any count above five
# raised `IndexError` — which is why the ledger's "No test exercises the batch beyond three
# reports" gap stayed open. The first five pairs stay PINNED because existing tests name
# `PMSR-M02-CHA-V-DEL` and friends by hand; beyond them pairs are generated, which is all
# the corpus needs since report and match ids are keyed on the match NUMBER, not the pair.
NATO = [
    "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India",
    "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo",
    "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "Xray", "Yankee", "Zulu",
]


def _team_pair(i: int) -> "tuple[str, str]":
    """Report `i`'s (home, away), never the same team — which `derive_match_id` refuses.

    The guarantee is simply that the offset is not a multiple of the list length:
    `7 % 26 != 0`, so `NATO[i % 26]` and `NATO[(i + 7) % 26]` can never coincide. **It is NOT
    a coprimality argument**, which is what this docstring claimed until the 2026-08-07 code
    review — coprimality would matter for a cycle-length property nothing here relies on, and
    a reader who trusted the stated reason could "safely" pick another coprime offset, or 26
    itself, and break the guarantee. Pinned by
    `test_generated_team_pairs_never_repeat_a_team_within_a_report` below.
    """
    if i < len(TEAMS):
        return TEAMS[i]
    return NATO[i % len(NATO)], NATO[(i + 7) % len(NATO)]


def _corpus(directory: Path, make_report, count: int = 3) -> Path:
    """`count` well-formed reports, each with a distinct match number and team pair."""
    directory.mkdir(parents=True, exist_ok=True)
    for i in range(count):
        home, away = _team_pair(i)
        make_report(
            directory / f"PMSR-M{i + 1:02d}-{home[:3].upper()}-V-{away[:3].upper()}.pdf",
            number=i + 1,
            home=home,
            away=away,
            day=11 + i % 18,
        )
    return directory


def _corrupt_pdf(path: Path) -> Path:
    """Bytes pymupdf will refuse to open — a real per-report failure, not a mocked one."""
    path.write_bytes(b"%PDF-1.7\nthis is not a pdf at all\n")
    return path


def _by_id(manifest: dict) -> "dict[str, dict]":
    return {entry["report_id"]: entry for entry in manifest["reports"]}


def _run(tmp_path: Path, corpus: Path, **kwargs) -> dict:
    return run_batch(
        corpus,
        output_path=tmp_path / "work" / "run-manifest.json",
        extracted_dir=tmp_path / "work" / "extracted",
        **kwargs,
    )


# --- the synthetic-corpus helper's own guarantees ---------------------------------


def test_generated_team_pairs_never_repeat_a_team_within_a_report():
    """`derive_match_id` refuses a report whose two teams are the same, so `_team_pair`'s
    offset is load-bearing — and it shipped unasserted, justified by a coprimality argument
    that is not the reason it works (2026-08-07 code review). Walked well past the 26-name
    wrap so the modular arithmetic is exercised rather than assumed."""
    for i in range(200):
        home, away = _team_pair(i)
        assert home != away, f"report {i} drew {home!r} against itself"


# --- AC 1: one terminal entry per report -----------------------------------------


def test_every_pdf_gets_exactly_one_terminal_entry(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=3)

    manifest = _run(tmp_path, corpus)

    assert manifest["manifest_version"] == MANIFEST_VERSION
    assert manifest["corpus"]["pdf_count"] == 3
    assert len(manifest["reports"]) == 3
    assert len(_by_id(manifest)) == 3
    assert all(entry["status"] in STATUSES for entry in manifest["reports"])


def test_the_manifest_always_carries_every_status_bucket(tmp_path, make_report):
    """The shape must not change underneath an earlier run's counts."""
    manifest = _run(tmp_path, _corpus(tmp_path / "corpus", make_report, count=1))

    assert set(manifest["counts_by_status"]) == set(STATUSES)
    assert sum(manifest["counts_by_status"].values()) == len(manifest["reports"])


def test_reports_are_listed_in_report_id_order(tmp_path, make_report):
    manifest = _run(tmp_path, _corpus(tmp_path / "corpus", make_report, count=3))

    ids = [entry["report_id"] for entry in manifest["reports"]]
    assert ids == sorted(ids)


def test_an_extracted_report_names_its_record_and_its_match_id(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)

    manifest = _run(tmp_path, corpus)

    entry = manifest["reports"][0]
    assert entry["status"] == "extracted"
    assert entry["match_id"] == "m001-alpha-bravo"
    assert entry["error"] is None and entry["error_type"] is None
    assert (tmp_path / "work" / "extracted" / "m001-alpha-bravo.json").exists()
    assert entry["record_path"].endswith("m001-alpha-bravo.json")


def test_corpus_membership_does_not_depend_on_filename_case(tmp_path, make_report):
    """`glob("*.pdf")` is case-insensitive on Windows and case-sensitive on POSIX."""
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    make_report(corpus / "PMSR-M01-ALP-V-BRA.PDF", number=1, home="Alpha", away="Bravo")

    assert [p.name for p in discover_pdfs(corpus)] == ["PMSR-M01-ALP-V-BRA.PDF"]
    assert _run(tmp_path, corpus)["corpus"]["pdf_count"] == 1


# --- AC 2: per-report failures never abort the batch ------------------------------


def test_a_corrupt_report_fails_alone_while_its_neighbours_extract(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=3)
    _corrupt_pdf(corpus / "PMSR-M02-CHA-V-DEL.pdf")

    manifest = _run(tmp_path, corpus)

    entries = _by_id(manifest)
    assert entries["PMSR-M02-CHA-V-DEL"]["status"] == "failed"
    assert entries["PMSR-M01-ALP-V-BRA"]["status"] == "extracted"
    assert entries["PMSR-M03-ECH-V-FOX"]["status"] == "extracted"
    assert manifest["counts_by_status"] == {"extracted": 2, "failed": 1, "skipped-unchanged": 0}


def test_a_failed_entry_carries_a_typed_exception_and_the_report_id(tmp_path, make_report):
    """AD-8: exception class name + localizing message + report id, in the manifest."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    _corrupt_pdf(corpus / "PMSR-M02-CHA-V-DEL.pdf")

    entry = _by_id(_run(tmp_path, corpus))["PMSR-M02-CHA-V-DEL"]

    assert entry["error_type"] == "ProbeError"
    assert "PMSR-M02-CHA-V-DEL" in entry["error"]
    assert entry["match_id"] is None
    assert entry["record_path"] is None


def test_a_run_in_which_every_report_fails_still_produces_a_complete_manifest(tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    for i in range(3):
        _corrupt_pdf(corpus / f"PMSR-M0{i + 1}-AAA-V-BBB.pdf")

    manifest = _run(tmp_path, corpus)

    assert len(manifest["reports"]) == 3
    assert manifest["run"]["failed_count"] == 3
    assert manifest["run"]["result"] == "fail"
    assert main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(tmp_path / "m.json"),
            "--extracted-dir",
            str(tmp_path / "e"),
        ]
    ) == 1


def test_a_missing_required_anchor_fails_that_report_naming_the_anchor(tmp_path, make_report):
    """AC 4: a report that lost a section fails loud, never a silent skip."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    make_report(
        corpus / "PMSR-M02-CHA-V-DEL.pdf",
        number=2,
        home="Charlie",
        away="Delta",
        drop_anchor_ids=("shots:away",),
    )

    entry = _by_id(_run(tmp_path, corpus))["PMSR-M02-CHA-V-DEL"]

    assert entry["status"] == "failed"
    assert entry["error_type"] == "MissingAnchorError"
    assert "Attempts at Goal Delta" in entry["error"]
    assert "PMSR-M02-CHA-V-DEL" in entry["error"]


def test_a_mis_named_download_fails_instead_of_staging_the_wrong_identity(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    make_report(corpus / "PMSR-M09-ECH-V-FOX.pdf", number=3, home="Echo", away="Foxtrot")

    entry = _by_id(_run(tmp_path, corpus))["PMSR-M09-ECH-V-FOX"]

    assert entry["status"] == "failed"
    assert entry["error_type"] == "MatchNumberError"
    assert "disagree" in entry["error"]


def test_two_pdfs_deriving_the_same_match_id_both_fail(tmp_path, make_report):
    """A silent second write would overwrite the first report's record and lose it."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    make_report(corpus / "PMSR-M01-ALP-V-BRA-copy.pdf", number=1, home="Alpha", away="Bravo")
    # The stem must still parse as PMSR-M01 for the identity check to reach the collision.

    manifest = _run(tmp_path, corpus)

    entries = _by_id(manifest)
    assert len(entries) == 2
    assert {entry["status"] for entry in entries.values()} == {"failed"}
    assert all(entry["error_type"] == "DuplicateMatchIdError" for entry in entries.values())
    assert all("m001-alpha-bravo" in entry["error"] for entry in entries.values())
    assert manifest["run"]["failed_count"] == 2


def test_a_duplicate_report_id_fails_rather_than_dropping_a_report(
    tmp_path, make_report, monkeypatch
):
    """Report ids key the manifest; a collision must not silently drop one of the two.

    The collision is `a.pdf` beside `a.PDF`, which only a case-sensitive filesystem can
    hold — this host's is not one, so the enumeration is substituted rather than the
    behaviour. `discover_pdfs` returning both names is exactly what POSIX hands the
    runner there, and the guard has to hold on every host that ingests the corpus.
    """
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    only = corpus / "PMSR-M01-ALP-V-BRA.pdf"
    monkeypatch.setattr(batch_module, "discover_pdfs", lambda _: [only, only])

    manifest = _run(tmp_path, corpus)

    assert manifest["corpus"]["pdf_count"] == 2
    assert len(manifest["reports"]) == 2
    assert manifest["counts_by_status"] == {"extracted": 1, "failed": 1, "skipped-unchanged": 0}
    failed = [e for e in manifest["reports"] if e["status"] == "failed"]
    assert failed[0]["error_type"] == "DuplicateReportIdError"
    assert "duplicate report id" in failed[0]["error"]


# --- AC 3: idempotent re-runs -----------------------------------------------------


def test_a_second_run_over_an_unchanged_corpus_skips_everything(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=3)
    _run(tmp_path, corpus)

    manifest = _run(tmp_path, corpus)

    assert manifest["counts_by_status"] == {"extracted": 0, "failed": 0, "skipped-unchanged": 3}
    assert manifest["run"]["result"] == "pass"
    assert all(entry["record_path"] for entry in manifest["reports"])


def test_a_skipped_report_is_never_re_parsed(tmp_path, make_report, monkeypatch):
    """`--force` aside, a skip must not open the PDF at all."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    _run(tmp_path, corpus)

    def explode(path):
        raise AssertionError(f"{path} was re-parsed on an unchanged re-run")

    monkeypatch.setattr(batch_module, "extract_report", explode)
    manifest = _run(tmp_path, corpus)

    assert manifest["counts_by_status"]["skipped-unchanged"] == 2


def test_changed_pdf_bytes_invalidate_the_skip(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    _run(tmp_path, corpus)
    make_report(
        corpus / "PMSR-M02-CHA-V-DEL.pdf",
        number=2,
        home="Charlie",
        away="Delta",
        # Another *real* corpus venue: the point is different PDF bytes, and Domain A
        # fails loud on any venue outside the committed offset table.
        venue="Toronto Stadium",
    )

    manifest = _run(tmp_path, corpus)

    entries = _by_id(manifest)
    assert entries["PMSR-M02-CHA-V-DEL"]["status"] == "extracted"
    assert entries["PMSR-M01-ALP-V-BRA"]["status"] == "skipped-unchanged"


def test_a_changed_code_version_invalidates_every_skip(tmp_path, make_report, monkeypatch):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    _run(tmp_path, corpus)

    monkeypatch.setattr(batch_module, "code_version", lambda: "f" * 64)
    manifest = _run(tmp_path, corpus)

    assert manifest["counts_by_status"]["extracted"] == 2


def test_a_corrupt_record_is_re_extracted_not_skipped(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    _run(tmp_path, corpus)
    (tmp_path / "work" / "extracted" / "m001-alpha-bravo.json").write_text(
        "{ truncated", encoding="utf-8", newline=""
    )

    manifest = _run(tmp_path, corpus)

    assert manifest["counts_by_status"]["extracted"] == 1


def test_a_forced_re_extraction_is_byte_identical(tmp_path, make_report):
    """AC 3: compared on bytes, not parsed dicts — a dict compare proves nothing here."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=3)
    _run(tmp_path, corpus)
    extracted = tmp_path / "work" / "extracted"
    before = {p.name: p.read_bytes() for p in sorted(extracted.iterdir())}

    manifest = _run(tmp_path, corpus, force=True)

    after = {p.name: p.read_bytes() for p in sorted(extracted.iterdir())}
    assert manifest["counts_by_status"]["extracted"] == 3
    assert after == before
    assert before  # the comparison must not be trivially empty


def test_the_manifest_is_serialized_canonically(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    output = tmp_path / "work" / "run-manifest.json"

    run_batch(corpus, output_path=output, extracted_dir=tmp_path / "work" / "extracted")

    raw = output.read_bytes()
    assert b"\r\n" not in raw
    text = raw.decode("utf-8")
    assert json.dumps(json.loads(text), indent=2, ensure_ascii=False, sort_keys=True) + "\n" == text


def test_the_run_timestamp_is_the_only_volatile_field(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    first = _run(tmp_path, corpus, force=True)
    second = _run(tmp_path, corpus, force=True)

    def without_timestamp(manifest: dict) -> dict:
        return {k: v for k, v in manifest.items() if k != "run_timestamp"}

    assert without_timestamp(first) == without_timestamp(second)
    assert first["run_timestamp"] != "" and first["run_timestamp"].endswith("+00:00")


# --- orphan records ---------------------------------------------------------------


def test_a_stray_record_is_reported_and_left_on_disk(tmp_path, make_report):
    """Report, do not delete: deleting files this run did not create is destructive."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    extracted = tmp_path / "work" / "extracted"
    extracted.mkdir(parents=True)
    stray = extracted / "m999-foo-bar.json"
    stray.write_text('{"match_id": "m999-foo-bar"}\n', encoding="utf-8", newline="")

    manifest = _run(tmp_path, corpus)

    assert any(path.endswith("m999-foo-bar.json") for path in manifest["orphan_record_paths"])
    assert stray.exists()
    # An orphan is not a failed report, so it never inflates `failed_count` — but it does
    # fail the run (review decision 2026-07-22), because a phantom-match hazard that exits
    # 0 is one CI can never be taught to catch.
    assert manifest["run"]["failed_count"] == 0
    assert manifest["run"]["result"] == "fail"
    assert manifest["counts_by_status"]["extracted"] == 2


def test_records_this_run_wrote_or_skipped_are_not_orphans(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    _run(tmp_path, corpus)

    manifest = _run(tmp_path, corpus)

    assert manifest["orphan_record_paths"] == []


def test_a_renamed_source_pdf_leaves_its_old_record_as_an_orphan(tmp_path, make_report):
    """The hazard this check exists for: a phantom match entering Story 1.15's precompute."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    _run(tmp_path, corpus)
    (corpus / "PMSR-M01-ALP-V-BRA.pdf").unlink()
    make_report(corpus / "PMSR-M02-CHA-V-DEL.pdf", number=2, home="Charlie", away="Delta")

    manifest = _run(tmp_path, corpus)

    assert manifest["orphan_record_paths"] == [
        (tmp_path / "work" / "extracted" / "m001-alpha-bravo.json").as_posix()
    ]
    assert (tmp_path / "work" / "extracted" / "m001-alpha-bravo.json").exists()


def test_a_record_belonging_to_a_failed_report_is_named_as_an_orphan(tmp_path, make_report):
    """A duplicate-id collision fails both reports; the file already written is not theirs."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    _run(tmp_path, corpus)
    make_report(corpus / "PMSR-M01-ALP-V-BRA-copy.pdf", number=1, home="Alpha", away="Bravo")

    manifest = _run(tmp_path, corpus, force=True)

    assert manifest["run"]["failed_count"] == 2
    assert any("m001-alpha-bravo.json" in path for path in manifest["orphan_record_paths"])


# --- corpus expectations ----------------------------------------------------------


def test_an_empty_corpus_is_a_failure_not_a_clean_run(tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()

    manifest = _run(tmp_path, corpus)

    assert manifest["corpus"]["pdf_count"] == 0
    assert manifest["run"]["result"] == "fail"
    assert any("corpus is empty" in gap for gap in manifest["run"]["corpus_gaps"])


def test_an_expect_reports_mismatch_fails_the_run(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)

    manifest = _run(tmp_path, corpus, expect_reports=104)

    assert manifest["run"]["result"] == "fail"
    assert manifest["corpus"]["expected_pdf_count"] == 104
    assert any("expected 104" in gap for gap in manifest["run"]["corpus_gaps"])
    assert manifest["counts_by_status"]["extracted"] == 2  # the reports still ran


def test_a_missing_input_directory_raises(tmp_path):
    with pytest.raises(NotADirectoryError):
        run_batch(tmp_path / "nope", output_path=None, extracted_dir=tmp_path / "e")


# --- the CLI ----------------------------------------------------------------------


def test_a_clean_run_exits_zero(tmp_path, make_report, capsys):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(tmp_path / "m.json"),
            "--extracted-dir",
            str(tmp_path / "e"),
            "--expect-reports",
            "2",
        ]
    )

    assert code == 0
    out = capsys.readouterr().out
    assert "extracted" in out and "RUN RESULT: PASS" in out


def test_a_failed_report_is_named_in_the_console_summary(tmp_path, make_report, capsys):
    """A reader must identify each failure without opening the manifest."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    _corrupt_pdf(corpus / "PMSR-M02-CHA-V-DEL.pdf")

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(tmp_path / "m.json"),
            "--extracted-dir",
            str(tmp_path / "e"),
        ]
    )

    out = capsys.readouterr().out
    assert code == 1
    assert "PMSR-M02-CHA-V-DEL" in out
    assert "ProbeError" in out


def test_an_orphan_is_named_in_the_console_summary(tmp_path, make_report, capsys):
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    extracted = tmp_path / "e"
    extracted.mkdir()
    (extracted / "m999-foo-bar.json").write_text("{}\n", encoding="utf-8", newline="")

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(tmp_path / "m.json"),
            "--extracted-dir",
            str(extracted),
        ]
    )

    # Exit 1, not 0: an orphan fails the run so CI can see it (review decision 2026-07-22).
    assert code == 1
    assert "m999-foo-bar.json" in capsys.readouterr().out


def test_an_empty_corpus_exits_one(tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(tmp_path / "m.json"),
            "--extracted-dir",
            str(tmp_path / "e"),
        ]
    )

    assert code == 1


def test_a_bad_input_directory_exits_two(tmp_path, capsys):
    """A broken harness must be distinguishable from a run that failed honestly."""
    code = main(
        [
            "--input-dir",
            str(tmp_path / "nope"),
            "--output",
            str(tmp_path / "m.json"),
            "--extracted-dir",
            str(tmp_path / "e"),
        ]
    )

    assert code == 2
    assert "could not run" in capsys.readouterr().err


def test_the_expect_reports_flag_is_enforced_by_the_cli(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(tmp_path / "m.json"),
            "--extracted-dir",
            str(tmp_path / "e"),
            "--expect-reports",
            "104",
        ]
    )

    assert code == 1


def test_the_force_flag_reaches_the_runner(tmp_path, make_report, capsys):
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    args = [
        "--input-dir",
        str(corpus),
        "--output",
        str(tmp_path / "m.json"),
        "--extracted-dir",
        str(tmp_path / "e"),
    ]
    main(args)
    capsys.readouterr()

    main(args + ["--force"])

    manifest = json.loads((tmp_path / "m.json").read_text(encoding="utf-8"))
    assert manifest["counts_by_status"]["extracted"] == 1


# --- a staged record must prove its own identity before it licenses a skip ---------


def _stage(tmp_path, make_report, mutate):
    """Run once, then mutate the single staged record and run again."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    _run(tmp_path, corpus)
    extracted = tmp_path / "work" / "extracted"
    staged = next(extracted.iterdir())
    record = json.loads(staged.read_text(encoding="utf-8"))
    mutate(record, staged, extracted)
    return _run(tmp_path, corpus)


def test_a_staged_record_without_a_usable_match_id_is_not_reused(tmp_path, make_report):
    """`is_unchanged` proves the idempotence keys match, and nothing else about the file.

    Left untyped this surfaced as `[KeyError] 'match_id'` — a manifest entry naming no
    report, from the artifact AD-8 calls the record of truth.
    """
    def mutate(record, staged, _extracted):
        del record["match_id"]
        staged.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="")

    manifest = _stage(tmp_path, make_report, mutate)

    # Re-extracted rather than trusted: the report ends up `extracted`, not `failed`.
    assert manifest["counts_by_status"]["extracted"] == 1
    assert manifest["reports"][0]["match_id"] == "m001-alpha-bravo"


def test_a_staged_record_whose_match_id_contradicts_its_file_name_is_refused(
    tmp_path, make_report
):
    """Otherwise the manifest advertises an identity no PDF produced.

    Story 1.15 consumes the records the manifest names, so a `match_id` that disagrees
    with the file holding it is a phantom match with a real path attached.
    """
    def mutate(record, staged, _extracted):
        record["match_id"] = "m999-somewhere-else"
        staged.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="")

    manifest = _stage(tmp_path, make_report, mutate)

    assert manifest["counts_by_status"]["skipped-unchanged"] == 0
    assert manifest["counts_by_status"]["extracted"] == 1


def test_a_staged_record_with_a_corrupt_warnings_list_does_not_hide_it_from_the_orphan_scan(
    tmp_path, make_report
):
    """The record path used to be claimed before the entry was fully built.

    A raise partway through left the report `failed` with `record_path: None` while its
    file stayed claimed — named nowhere in the manifest and omitted from the orphan list,
    which is the one check that exists to surface exactly that.
    """
    def mutate(record, staged, _extracted):
        record["warnings"] = "corrupted"
        staged.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8", newline="")

    manifest = _stage(tmp_path, make_report, mutate)

    entry = manifest["reports"][0]
    assert entry["status"] in STATUSES
    assert isinstance(entry["warnings"], list)
    # Either it is claimed and named, or it is unclaimed and reported. Never neither.
    assert entry["record_path"] is not None or manifest["orphan_record_paths"]


def test_a_retroactively_failed_entry_carries_no_match_id(tmp_path, make_report):
    """A duplicate match id fails the earlier report *after* its fields were filled in.

    A `failed` entry keeping its `match_id` is a match no record stands behind — the exact
    shape a consumer filtering on `match_id is not None` would pick up.
    """
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    for stem in ("PMSR-M01-ALP-V-BRA", "PMSR-M1-ALP-V-BRA"):
        make_report(corpus / f"{stem}.pdf", number=1, home="Alpha", away="Bravo")

    manifest = _run(tmp_path, corpus)

    failed = [entry for entry in manifest["reports"] if entry["status"] == "failed"]
    assert len(failed) == 2
    for entry in failed:
        assert entry["match_id"] is None
        assert entry["record_path"] is None
        assert entry["warnings"] == []
        assert entry["error_type"] == "DuplicateMatchIdError"


# --- leftovers and CLI guards ------------------------------------------------------


def test_an_interrupted_write_leaves_a_tmp_file_that_the_orphan_scan_reports(
    tmp_path, make_report
):
    """`.json`-only scanning let staging leftovers accumulate unseen forever."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    _run(tmp_path, corpus)
    extracted = tmp_path / "work" / "extracted"
    (extracted / "m001-alpha-bravo.json.9999.tmp").write_text(
        "{}\n", encoding="utf-8", newline=""
    )

    manifest = _run(tmp_path, corpus)

    assert any(path.endswith(".tmp") for path in manifest["orphan_record_paths"])
    assert manifest["run"]["result"] == "fail"
    # A leftover is never mistaken for a staged record.
    assert manifest["counts_by_status"]["skipped-unchanged"] == 1


def test_a_manifest_path_inside_the_extracted_directory_is_refused(tmp_path, make_report):
    """It would be scanned as a record and reported as an orphan on every run forever."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    extracted = tmp_path / "work" / "extracted"

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(extracted / "run-manifest.json"),
            "--extracted-dir",
            str(extracted),
        ]
    )

    assert code == 2  # a broken harness, not a failed run


def test_expect_reports_rejects_zero_and_negatives(tmp_path):
    """Neither can ever produce a pass, so they are argument errors, not run results."""
    for value in ("0", "-5"):
        with pytest.raises(SystemExit) as excinfo:
            build_parser().parse_args(["--input-dir", str(tmp_path), "--expect-reports", value])
        assert excinfo.value.code == 2


def test_the_summary_is_printed_even_when_the_manifest_cannot_be_written(
    tmp_path, make_report, capsys
):
    """A run whose 104 records all staged correctly must still report its result.

    With the write inside `run_batch` an unwritable manifest discarded the whole run and
    exited 2 having printed nothing, as though the harness had never started.
    """
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    blocked = tmp_path / "blocked"
    blocked.write_text("not a directory\n", encoding="utf-8", newline="")

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(blocked / "run-manifest.json"),
            "--extracted-dir",
            str(tmp_path / "work" / "extracted"),
        ]
    )
    out = capsys.readouterr()

    assert code == 2
    assert "Batch ingestion" in out.out
    assert "extracted" in out.out
    assert "manifest could not be written" in out.err


# --- Story 1.3: Self-Validation mirrored into the manifest ------------------------


def _mismatch_corpus(directory: Path, make_report) -> Path:
    """One report whose home attempts table lists more rows than the map draws markers."""
    directory.mkdir(parents=True, exist_ok=True)
    make_report(
        directory / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        shots_table_rows={"home": 9},
    )
    return directory


def test_every_clean_entry_mirrors_a_self_validation_pass(tmp_path, make_report):
    manifest = _run(tmp_path, _corpus(tmp_path / "corpus", make_report))

    assert all(entry["self_validation"] == "pass" for entry in manifest["reports"])
    assert all(entry["self_validation_failures"] == [] for entry in manifest["reports"])
    assert manifest["run"]["self_validation_fail_count"] == 0
    assert manifest["run"]["result"] == "pass"


def test_a_count_mismatch_fails_the_run_with_both_counts_in_the_manifest(tmp_path, make_report):
    """The orphan precedent: the record is written and `failed_count` stays 0, but the
    run fails — and the manifest entry itself carries both counts (AC 4)."""
    from pipeline.tests.conftest import DEFAULT_SHOTS_MARKERS

    manifest = _run(tmp_path, _mismatch_corpus(tmp_path / "corpus", make_report))

    [entry] = manifest["reports"]
    assert entry["status"] == "extracted"
    assert entry["self_validation"] == "fail"
    [check] = entry["self_validation_failures"]
    assert check["team"] == "home"
    assert check["marker_count"] == len(DEFAULT_SHOTS_MARKERS["home"])
    assert check["table_count"] == 9
    assert manifest["run"]["failed_count"] == 0
    assert manifest["run"]["self_validation_fail_count"] == 1
    assert manifest["run"]["result"] == "fail"


def test_a_crosses_mismatch_fails_the_run_with_both_counts_in_the_manifest(
    tmp_path, make_report
):
    """Story 1.11: the crosses family mirrors through `_mirror_self_validation`
    unchanged — the failing `crosses-marker-count` check lands in the entry with both
    counts and fails the run without inflating `failed_count`, and `format_summary`'s
    generic count branch names it."""
    from pipeline.ingest.batch import format_summary
    from pipeline.tests.conftest import DEFAULT_CROSSES_MARKERS

    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(
        directory / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        crosses_rows={
            "home": [{"shirt": 9, "name": "Test PLAYER", "counts": (7, 0, 0, 0, 0, 0)}]
        },
    )

    manifest = _run(tmp_path, directory)

    [entry] = manifest["reports"]
    assert entry["status"] == "extracted"
    assert entry["self_validation"] == "fail"
    [check] = entry["self_validation_failures"]
    assert check["check"] == "crosses-marker-count"
    assert check["team"] == "home"
    assert check["marker_count"] == len(DEFAULT_CROSSES_MARKERS["home"])
    assert check["table_count"] == 7
    assert manifest["run"]["failed_count"] == 0
    assert manifest["run"]["self_validation_fail_count"] == 1
    assert manifest["run"]["result"] == "fail"
    summary = format_summary(manifest)
    assert "[crosses-marker-count]" in summary
    assert f"home: {len(DEFAULT_CROSSES_MARKERS['home'])} markers, table lists 7" in summary


def test_a_defensive_actions_mismatch_fails_the_run_with_both_counts_in_the_manifest(
    tmp_path, make_report
):
    """Story 1.12: the failing `defensive-actions-marker-count` check lands in the entry
    with both counts and fails the run without inflating `failed_count`. Two marker
    families share this check id, so `format_summary` names the family — a detail the
    generic count branch cannot render."""
    from pipeline.ingest.batch import format_summary
    from pipeline.tests.conftest import DEFAULT_DEFENSIVE_ACTIONS_MARKERS

    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(
        directory / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        defensive_actions_headline={"home": {"forced-turnover": 12}},
    )

    manifest = _run(tmp_path, directory)

    drawn = len(DEFAULT_DEFENSIVE_ACTIONS_MARKERS["home"]["forced-turnover"])
    [entry] = manifest["reports"]
    assert entry["status"] == "extracted"
    assert entry["self_validation"] == "fail"
    [check] = entry["self_validation_failures"]
    assert check["check"] == "defensive-actions-marker-count"
    assert check["team"] == "home"
    assert check["family"] == "forced-turnover"
    assert check["marker_count"] == drawn
    assert check["table_count"] == 12
    assert manifest["run"]["failed_count"] == 0
    assert manifest["run"]["self_validation_fail_count"] == 1
    assert manifest["run"]["result"] == "fail"
    summary = format_summary(manifest)
    assert "[defensive-actions-marker-count]" in summary
    assert f"home forced-turnover: {drawn} markers, page prints 12" in summary


def test_the_documented_absence_reaches_the_manifest_as_a_warning(tmp_path, make_report):
    """AC 2's absence branch end to end: the possession-regain map records no check at
    all, and its documented absence travels as ONE per-report warning that `batch.py`
    mirrors into the entry and `format_summary` prints — while the run still passes."""
    from pipeline.ingest.batch import format_summary
    from pipeline.markers.defensive_actions import ABSENT_COUNTERPART_WARNING

    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(directory / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    manifest = _run(tmp_path, directory)

    [entry] = manifest["reports"]
    assert entry["self_validation"] == "pass"
    assert entry["warnings"].count(ABSENT_COUNTERPART_WARNING) == 1
    assert manifest["run"]["result"] == "pass"
    assert ABSENT_COUNTERPART_WARNING in format_summary(manifest)


def test_a_receiving_mismatch_fails_the_run_with_both_operands_in_the_manifest(
    tmp_path, make_report
):
    """Story 1.13: the failing receiving check lands in the entry with both operands and
    fails the run without inflating `failed_count` (the orphan-records precedent).

    No `format_summary` branch is added for these ids: the receiving checks carry a
    `specifics` string holding both operands, which the existing fallback renders — the
    marker-count template would print `None: None markers, table lists None` over them.
    """
    from pipeline.ingest.batch import format_summary

    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(
        directory / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        offers_values={"home": {"offers_inside_shape": 999}},
    )

    manifest = _run(tmp_path, directory)

    [entry] = manifest["reports"]
    assert entry["status"] == "extracted"
    assert entry["self_validation"] == "fail"
    [check] = entry["self_validation_failures"]
    assert check["check"] == "receiving-offers-shape-sum"
    assert check["team"] == "home"
    assert check["page_value"] != check["counterpart"]
    assert manifest["run"]["failed_count"] == 0
    assert manifest["run"]["self_validation_fail_count"] == 1
    assert manifest["run"]["result"] == "fail"
    summary = format_summary(manifest)
    assert "[receiving-offers-shape-sum]" in summary
    assert f"page reads {check['page_value']}" in summary
    assert f"counterpart is {check['counterpart']}" in summary


def test_the_two_receiving_absences_reach_the_manifest_as_warnings(tmp_path, make_report):
    """AC 2's absence branch end to end, twice: the movement donuts' raster-only slice
    values and the non-partitioned phase totals each record NO check at all and travel as
    ONE per-report warning that `batch.py` mirrors and `format_summary` prints — while
    the run still passes."""
    from pipeline.ingest.batch import format_summary
    from pipeline.markers.receiving import (
        DONUT_SLICES_ABSENT_WARNING,
        PHASE_PARTITION_ABSENT_WARNING,
    )

    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(directory / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    manifest = _run(tmp_path, directory)

    [entry] = manifest["reports"]
    assert entry["self_validation"] == "pass"
    assert entry["warnings"].count(DONUT_SLICES_ABSENT_WARNING) == 1
    assert entry["warnings"].count(PHASE_PARTITION_ABSENT_WARNING) == 1
    assert manifest["run"]["result"] == "pass"
    summary = format_summary(manifest)
    assert DONUT_SLICES_ABSENT_WARNING in summary
    assert PHASE_PARTITION_ABSENT_WARNING in summary


def test_a_skipped_unchanged_entry_carries_its_staged_records_verdict(tmp_path, make_report):
    """The mirror reads the staged record, the same way `warnings` flows: a re-run over
    an unchanged mismatching corpus must keep failing, not launder the verdict."""
    corpus = _mismatch_corpus(tmp_path / "corpus", make_report)

    _run(tmp_path, corpus)
    second = _run(tmp_path, corpus)

    [entry] = second["reports"]
    assert entry["status"] == "skipped-unchanged"
    assert entry["self_validation"] == "fail"
    [check] = entry["self_validation_failures"]
    assert check["marker_count"] is not None and check["table_count"] == 9
    assert second["run"]["result"] == "fail"


def test_an_off_shape_staged_self_validation_block_forces_re_extraction(tmp_path, make_report):
    """The `match_id` trust precedent applied to the verdict (review decision,
    2026-07-23): a staged record whose Self-Validation block is off-shape cannot say
    what this report proved, so the record is treated as absent and the report
    re-extracts — mirroring it as a neutral `None` would launder a corrupt verdict
    into a passing run."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=1)
    first = _run(tmp_path, corpus)
    [entry] = first["reports"]
    record_path = Path(entry["record_path"])
    staged = json.loads(record_path.read_text(encoding="utf-8"))
    staged["self_validation"] = {"result": "maybe"}
    record_path.write_text(json.dumps(staged), encoding="utf-8")

    second = _run(tmp_path, corpus)

    [entry] = second["reports"]
    assert entry["status"] == "extracted"
    assert entry["self_validation"] == "pass"
    assert second["run"]["result"] == "pass"


def test_a_failed_report_has_no_self_validation_verdict(tmp_path, make_report):
    corpus = _corpus(tmp_path / "corpus", make_report, count=2)
    _corrupt_pdf(corpus / "PMSR-M02-CHA-V-DEL.pdf")

    manifest = _run(tmp_path, corpus)

    entry = _by_id(manifest)["PMSR-M02-CHA-V-DEL"]
    assert entry["status"] == "failed"
    assert entry["self_validation"] is None
    assert entry["self_validation_failures"] == []


def test_a_self_validation_failure_exits_one_and_is_named_in_the_summary(
    tmp_path, make_report, capsys
):
    corpus = _mismatch_corpus(tmp_path / "corpus", make_report)

    code = main(
        [
            "--input-dir",
            str(corpus),
            "--output",
            str(tmp_path / "work" / "run-manifest.json"),
            "--extracted-dir",
            str(tmp_path / "work" / "extracted"),
        ]
    )
    out = capsys.readouterr().out

    assert code == 1
    assert "Self-validation failures" in out
    assert "table lists 9" in out
    assert "RUN RESULT: FAIL" in out


# --- Story 1.14: the pass network at the batch seam -------------------------------


def test_the_default_fixture_keeps_every_pass_network_check_passing(tmp_path, make_report):
    """Not optional: four tests above destructure `[check] = self_validation_failures`.

    A second failing check on a deliberate-mismatch corpus would break all four, and the
    breakage would look like a defect in whatever those tests are about (the 1.9/1.10
    warning). This pins the precondition explicitly so a regression is attributed here.
    """
    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(directory / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    manifest = _run(tmp_path, directory)

    [entry] = manifest["reports"]
    assert entry["self_validation"] == "pass"
    assert entry["self_validation_failures"] == []
    assert manifest["run"]["self_validation_fail_count"] == 0


def test_the_node_positions_absence_reaches_the_manifest_as_a_warning(tmp_path, make_report):
    """AC 2's absence branch end to end: `node_positions` records NO check at all and
    travels as ONE per-report warning that `batch.py` mirrors and `format_summary`
    prints — while the run still passes."""
    from pipeline.extract.pass_network import pass_network_warnings
    from pipeline.ingest.batch import format_summary

    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(directory / "PMSR-M01-ALP-V-BRA.pdf", number=1, home="Alpha", away="Bravo")

    manifest = _run(tmp_path, directory)

    (warning,) = pass_network_warnings()
    [entry] = manifest["reports"]
    assert entry["self_validation"] == "pass"
    assert entry["warnings"].count(warning) == 1
    assert manifest["run"]["result"] == "pass"
    assert warning in format_summary(manifest)


def test_a_pass_network_mismatch_renders_through_the_generic_specifics_fallback(
    tmp_path, make_report
):
    """No `format_summary` branch is added for these ids: a `check_entry`-shaped check
    carries a `specifics` string holding BOTH operands, which the existing fallback
    renders — the marker-count template would print `None: None markers` over it."""
    from pipeline.ingest.batch import format_summary
    from pipeline.tests.conftest import (
        default_key_statistics,
        default_lineup_sides,
        default_pass_network_block,
        default_player_stats_rows,
    )

    stats = default_key_statistics()
    rows = default_player_stats_rows(default_lineup_sides("Alpha", "Bravo", 2, 0), stats)
    block = default_pass_network_block(rows["home"], stats["home"]["passes_completed"])
    block["top5"] = [99.9] + block["top5"][1:]
    directory = tmp_path / "corpus"
    directory.mkdir(parents=True, exist_ok=True)
    make_report(
        directory / "PMSR-M01-ALP-V-BRA.pdf",
        number=1,
        home="Alpha",
        away="Bravo",
        pass_network_block={"home": block},
    )

    manifest = _run(tmp_path, directory)

    [entry] = manifest["reports"]
    assert entry["status"] == "extracted"
    assert entry["self_validation"] == "fail"
    [check] = entry["self_validation_failures"]
    assert check["check"] == "pass-network-top5-pct"
    assert manifest["run"]["failed_count"] == 0
    assert manifest["run"]["self_validation_fail_count"] == 1
    assert manifest["run"]["result"] == "fail"
    total = sum(value for row in block["matrix"] for value in row if value is not None)
    summary = format_summary(manifest)
    assert "[pass-network-top5-pct]" in summary
    # BOTH operands visible: the printed percentage, and the cell over the matrix total
    # the page's own arithmetic says it should have been.
    assert "printed 99.9%" in summary
    assert f"/{total} =" in summary


# --- Story 1.19 D1: the warnings block is collapsed by count ----------------------
#
# `format_summary` is a pure `dict -> str`, so these drive it from synthetic manifests
# rather than from synthetic PDFs. That is not a shortcut: it is the only way to build
# the 104-report, 7-uniform-warning manifest AC 1's line-count obligation is about, and
# it keeps the assertions on the rendering rather than on any extractor's behaviour.


def _summary_entry(report_id: str, warnings: "list[str] | None" = None, **overrides) -> dict:
    """One manifest entry carrying every field `format_summary` reads."""
    entry = {
        "report_id": report_id,
        "match_id": report_id.lower(),
        "status": "extracted",
        "record_path": f"work/extracted/{report_id.lower()}.json",
        "error_type": None,
        "error": None,
        "warnings": list(warnings or []),
        "self_validation": "pass",
        "self_validation_failures": [],
        "near_misses": [],
    }
    entry.update(overrides)
    return entry


def _summary_manifest(entries: "list[dict]", **overrides) -> dict:
    """A run manifest in the shape `format_summary` consumes, counts derived from
    `entries` so a hand-written manifest can never disagree with its own reports."""
    counts = {status: 0 for status in STATUSES}
    for entry in entries:
        counts[entry["status"]] += 1
    manifest = {
        "manifest_version": MANIFEST_VERSION,
        "generated_by": "pipeline.ingest.batch",
        "run_timestamp": "2026-08-07T00:00:00+00:00",
        "input_dir": "pmsr-corpus",
        "code_version": "0" * 64,
        "corpus": {"pdf_count": len(entries), "expected_pdf_count": None},
        "counts_by_status": counts,
        "reports": entries,
        "orphan_record_paths": [],
        "run": {
            "result": "pass",
            "failed_count": counts["failed"],
            "self_validation_fail_count": sum(
                1 for entry in entries if entry["self_validation"] == "fail"
            ),
            "corpus_gaps": [],
        },
    }
    manifest.update(overrides)
    return manifest


def _warning_lines(summary: str) -> "list[str]":
    """Every line of the Warnings block, exclusive of its own heading."""
    lines = summary.split("\n")
    start = lines.index("Warnings (non-fatal)") + 1
    end = start
    while end < len(lines) and lines[end].startswith("  "):
        end += 1
    return lines[start:end]


UNIFORM = "the page family draws no possession-regain counterpart, so none is recorded"
MINORITY = "this report's momentum chart is drawn one slot short of its own axis"


def test_a_warning_carried_by_the_whole_corpus_collapses_to_one_counted_line():
    """D1's whole point: 104 reports x 7 family-wide warnings printed 728 identical
    lines, which is what AC 1's "without opening logs or artifacts" forbids. The
    collapsed line carries the count and the warning VERBATIM."""
    from pipeline.ingest.batch import format_summary

    entries = [_summary_entry(f"PMSR-M{i:03d}", [UNIFORM]) for i in range(1, 105)]

    lines = _warning_lines(format_summary(_summary_manifest(entries)))

    assert lines == [f"  104 reports: {UNIFORM}"]


def test_seven_corpus_wide_warnings_render_seven_lines_and_not_seven_hundred():
    """The measured claim, asserted rather than described: the real corpus carries
    seven documented absences on every one of its 104 records."""
    from pipeline.ingest.batch import format_summary

    seven = [f"documented absence {n}: the page family records no check" for n in range(7)]
    entries = [_summary_entry(f"PMSR-M{i:03d}", seven) for i in range(1, 105)]

    lines = _warning_lines(format_summary(_summary_manifest(entries)))

    assert len(lines) == 7, "104 x 7 must render 7 lines, not 728"
    assert lines == [f"  104 reports: {warning}" for warning in seven]


def test_a_warning_carried_by_a_minority_still_names_every_report():
    """The other direction of AC 1, and the reason D1 refused a bare count: a warning
    on three of four reports is per-report information, and a reader who cannot tell
    WHICH three has to open the artifacts after all."""
    from pipeline.ingest.batch import format_summary

    entries = [
        _summary_entry("PMSR-M001", [UNIFORM, MINORITY]),
        _summary_entry("PMSR-M002", [UNIFORM, MINORITY]),
        _summary_entry("PMSR-M003", [UNIFORM]),
        _summary_entry("PMSR-M004", [UNIFORM]),
    ]

    lines = _warning_lines(format_summary(_summary_manifest(entries)))

    # First-appearance order: UNIFORM is seen first, on report 1.
    assert lines == [
        f"  4 reports: {UNIFORM}",
        f"  PMSR-M001: {MINORITY}",
        f"  PMSR-M002: {MINORITY}",
    ]


def test_the_named_and_collapsed_forms_are_never_both_reachable_for_one_count():
    """D1.3's uniformity rule, asserted at the boundary rather than described: every
    count from 1 to `WARNING_NAMED_MAX` names its reports and every count above it
    collapses, with no count producing both and no count producing neither."""
    from pipeline.ingest.batch import WARNING_NAMED_MAX, format_summary

    for count in range(1, WARNING_NAMED_MAX + 4):
        entries = [_summary_entry(f"PMSR-M{i:03d}", [UNIFORM]) for i in range(1, count + 1)]
        lines = _warning_lines(format_summary(_summary_manifest(entries)))
        named = [line for line in lines if line.endswith(f": {UNIFORM}") and " reports:" not in line]
        collapsed = [line for line in lines if line == f"  {count} reports: {UNIFORM}"]
        if count <= WARNING_NAMED_MAX:
            assert len(named) == count and not collapsed, f"count {count} must name"
        else:
            assert len(collapsed) == 1 and not named, f"count {count} must collapse"


def test_the_collapsed_line_never_truncates_or_reflows_the_warning_text():
    """Landmine 4: three pre-existing tests assert the FULL warning string is a
    substring of the summary, and a half-printed warning is not a warning. The
    collapse may add a prefix; it may never touch the text."""
    from pipeline.ingest.batch import format_summary

    long_warning = (
        "the receiving movement donuts are raster-only, so their per-slice values "
        "cannot be read and no slice-sum check is recorded for either side of this "
        "report — the absence is documented rather than silently passed"
    )
    entries = [_summary_entry(f"PMSR-M{i:03d}", [long_warning]) for i in range(1, 21)]

    summary = format_summary(_summary_manifest(entries))

    assert long_warning in summary
    assert _warning_lines(summary) == [f"  20 reports: {long_warning}"]


def test_a_report_carrying_one_warning_twice_counts_as_one_report():
    """D1 ruled the inversion as "warning -> count of ENTRIES carrying it". The
    collapsed line says "reports", so it must count reports — a manifest entry whose
    `warnings` array repeats a string is one report, not two."""
    from pipeline.ingest.batch import format_summary

    entries = [_summary_entry(f"PMSR-M{i:03d}", [UNIFORM, UNIFORM]) for i in range(1, 6)]

    assert _warning_lines(format_summary(_summary_manifest(entries))) == [f"  5 reports: {UNIFORM}"]


def test_the_warnings_block_order_is_deterministic_and_not_set_order():
    """Byte-identical output is an acceptance condition for the whole story, and the
    obvious implementation of a de-duplication is a `set`, whose iteration order is
    salted per process. Rendering the same manifest twice must produce the same string,
    and the block must follow first appearance over `manifest["reports"]`."""
    from pipeline.ingest.batch import format_summary

    warnings = [f"absence {n}" for n in range(7)]
    entries = [
        # Report 1 introduces 6 and 0; report 2 introduces the rest, out of order.
        _summary_entry("PMSR-M001", [warnings[6], warnings[0]] * 3),
        _summary_entry("PMSR-M002", list(reversed(warnings)) * 3),
        _summary_entry("PMSR-M003", warnings * 3),
        _summary_entry("PMSR-M004", warnings * 3),
    ]
    manifest = _summary_manifest(entries)

    lines = _warning_lines(format_summary(manifest))

    assert format_summary(manifest) == format_summary(_summary_manifest(entries))
    # Report 1 introduces 6 then 0, so those two lead; report 2 introduces the remaining
    # five in reverse. Those five are carried by three reports each, so they take the
    # NAMED branch — which is why this manifest exercises both forms and the ordering of
    # both in one pass.
    assert lines[0] == f"  4 reports: {warnings[6]}"
    assert lines[1] == f"  4 reports: {warnings[0]}"
    assert lines[2:] == [
        f"  PMSR-M{i:03d}: {warning}"
        for warning in reversed(warnings[1:6])
        for i in (2, 3, 4)
    ]


# --- Story 1.19 R2: near-miss parses reach the summary ----------------------------
#
# AC 1 names "near-miss parses" as a summary category and, before this story, nothing
# implemented it: the pipeline's bounded checks record how far the drawn set sits from
# the printed count on EVERY report, and a check that PASSES reaches the summary nowhere.


NEAR_MISS_HEADING = (
    "Near-miss parses (bounded checks that PASSED with a non-zero delta; not failures)"
)


def _block(summary: str, heading: str) -> "list[str]":
    """Every indented line under `heading`, or `[]` when the block is absent."""
    lines = summary.split("\n")
    if heading not in lines:
        return []
    start = lines.index(heading) + 1
    end = start
    while end < len(lines) and lines[end].startswith("  "):
        end += 1
    return lines[start:end]


def test_a_bounded_check_that_passed_with_a_delta_reaches_the_summary(tmp_path, make_report):
    """End to end from a real extraction, not a hand-built manifest: the extractor's
    bounded check carries `max_delta`, `batch.py` mirrors the non-zero ones into the
    entry, and `format_summary` aggregates them. A hand-built manifest would prove the
    renderer and leave the two seams before it untested."""
    from pipeline.ingest.batch import format_summary

    corpus = _corpus(tmp_path / "corpus", make_report, count=1)

    manifest = _run(tmp_path, corpus)

    [entry] = manifest["reports"]
    assert entry["self_validation"] == "pass"
    # Whatever the default fixture's bounded checks observe, every mirrored near miss is
    # a passing check with a non-zero delta and nothing else. Deriving the expectation
    # from the record rather than restating the fixture's numbers.
    record = json.loads(Path(entry["record_path"]).read_text(encoding="utf-8"))
    bounded = {
        check["check"]: check["max_delta"]
        for check in record["self_validation"]["checks"]
        if "max_delta" in check
    }
    assert bounded, "the fixture must exercise at least one bounded check"
    assert {near["check"]: near["max_delta"] for near in entry["near_misses"]} == {
        check_id: delta for check_id, delta in bounded.items() if delta != 0
    }
    for near in entry["near_misses"]:
        assert f"  {near['check']}: 1/1 report(s) with a non-zero delta" in format_summary(
            manifest
        )


def test_the_near_miss_block_is_aggregate_and_never_one_line_per_report():
    """R2's explicit bound: per-report lines would recreate exactly the noise D1 just
    removed, in a new block. 104 reports carrying two bounded near misses each render
    TWO lines, and the largest delta across the corpus is the one reported."""
    from pipeline.ingest.batch import format_summary

    entries = [
        _summary_entry(
            f"PMSR-M{i:03d}",
            near_misses=[
                {"check": "goalkeeping-involvement-bound", "max_delta": i % 6},
                {"check": "goalkeeping-distribution-printed", "max_delta": 1 if i < 21 else 0},
            ],
        )
        for i in range(1, 105)
    ]

    lines = _block(format_summary(_summary_manifest(entries)), NEAR_MISS_HEADING)

    assert lines == [
        "  goalkeeping-involvement-bound: 104/104 report(s) with a non-zero delta (max +5)",
        "  goalkeeping-distribution-printed: 104/104 report(s) with a non-zero delta (max +1)",
    ]


def test_an_exact_corpus_produces_no_near_miss_block_at_all():
    """A block that renders unconditionally is a block a reader learns to ignore. Zero
    is the corpus-normal case for most bounded checks and it earns no line."""
    from pipeline.ingest.batch import format_summary

    entries = [_summary_entry(f"PMSR-M{i:03d}") for i in range(1, 5)]

    assert NEAR_MISS_HEADING not in format_summary(_summary_manifest(entries))


def test_a_zero_delta_is_never_mirrored_as_a_near_miss(tmp_path, make_report):
    """The mirror's own filter, driven from the batch seam: a bounded check that was
    exact everywhere on this report contributes nothing, so an exact corpus is silent."""
    from pipeline.ingest.batch import _mirror_self_validation

    entry = {"near_misses": [], "self_validation": None, "self_validation_failures": []}
    _mirror_self_validation(
        entry,
        {
            "self_validation": {
                "result": "pass",
                "checks": [
                    {"check": "exact", "result": "pass", "specifics": "", "max_delta": 0},
                    {"check": "loose", "result": "pass", "specifics": "", "max_delta": 3},
                    # `bool` is an `int` in Python: without the explicit guard this would
                    # mirror as a near miss of "+1".
                    {"check": "bool", "result": "pass", "specifics": "", "max_delta": True},
                    {"check": "plain", "result": "pass", "specifics": ""},
                ],
            }
        },
    )

    assert entry["near_misses"] == [{"check": "loose", "max_delta": 3}]


def test_a_failing_bounded_check_is_named_as_a_failure_and_not_also_as_a_near_miss():
    """One defect, one heading. A bounded check that actually breached its bound is
    reported in full by the Self-validation failures block; counting it in the near-miss
    aggregate too would report it twice under two different meanings."""
    from pipeline.ingest.batch import _mirror_self_validation

    entry = {"near_misses": [], "self_validation": None, "self_validation_failures": []}
    _mirror_self_validation(
        entry,
        {
            "self_validation": {
                "result": "fail",
                "checks": [
                    {"check": "b", "result": "fail", "specifics": "breached", "max_delta": 9},
                ],
            }
        },
    )

    assert entry["self_validation"] == "fail"
    assert [check["check"] for check in entry["self_validation_failures"]] == ["b"]
    assert entry["near_misses"] == []


# --- Story 1.19 Task 3.2: the unlinked-marker branch would fire if it should -------


def test_an_unlinked_marker_renders_its_outcome_and_pdf_position_in_the_summary():
    """The corpus links 2571/2571 markers, so this branch never fires on a real run —
    which is exactly how a renderer rots unnoticed. Driven from a constructed manifest
    so the branch is proven reachable rather than assumed."""
    from pipeline.ingest.batch import format_summary

    entry = _summary_entry(
        "PMSR-M01-ALP-V-BRA",
        self_validation="fail",
        self_validation_failures=[
            {
                "check": "shots-link-rate",
                "team": "home",
                "linked_count": 12,
                "marker_count": 13,
                "unlinked": [{"outcome": "off-target", "pdf_x": 231.5, "pdf_y": 402.25}],
            }
        ],
    )

    summary = format_summary(_summary_manifest([entry], run={
        "result": "fail", "failed_count": 0, "self_validation_fail_count": 1, "corpus_gaps": [],
    }))

    assert "  PMSR-M01-ALP-V-BRA" in summary
    assert (
        "      [shots-link-rate] home: 12/13 markers linked; "
        "unlinked: off-target@(231.5,402.25)" in summary
    )


# --- Story 1.19 Task 3.4: "per-report status" (AC 1's obligation (f)) --------------


def test_the_summary_names_every_non_clean_report_and_lists_no_clean_one():
    """AC 1's per-report-status clause, ruled rather than left silent: `counts_by_status`
    carries the aggregate and the failure blocks name every report that is anything but
    cleanly extracted, so a reader can identify every failure and why. Listing all 104
    reports one per line would rebuild the defect D1 just removed in a new block."""
    from pipeline.ingest.batch import format_summary

    entries = [_summary_entry(f"PMSR-M{i:03d}") for i in range(1, 102)]
    entries.append(_summary_entry("PMSR-M102", status="failed", self_validation=None,
                                  error_type="ProbeError", error="page 3 is unreadable"))
    entries.append(_summary_entry("PMSR-M103", self_validation="fail",
                                  self_validation_failures=[
                                      {"check": "defensive-actions-marker-count",
                                       "team": "away", "family": "forced-turnover",
                                       "marker_count": 39, "table_count": 40}]))
    entries.append(_summary_entry("PMSR-M104", status="skipped-unchanged"))

    summary = format_summary(_summary_manifest(entries, run={
        "result": "fail", "failed_count": 1, "self_validation_fail_count": 1,
        "corpus_gaps": [],
    }))

    # Every non-clean report is identifiable, with its cause, from this string alone.
    assert "PMSR-M102" in summary and "[ProbeError] page 3 is unreadable" in summary
    assert "PMSR-M103" in summary and "away forced-turnover: 39 markers, page prints 40" in summary
    # The aggregate carries the rest — the 101 clean reports are named nowhere.
    assert "  extracted          102" in summary
    assert "  skipped-unchanged  1" in summary
    assert "PMSR-M001" not in summary and "PMSR-M104" not in summary
    assert len(summary.split("\n")) < 30, "the summary must stay readable at corpus scale"


# --- Story 1.19 Task 4: exactly 104 terminal entries ------------------------------


def test_a_corpus_far_beyond_three_reports_still_gets_one_terminal_entry_each(
    tmp_path, make_report
):
    """The ledger's gap, closed at the runner: "No test exercises the batch beyond three
    reports". Twelve is past every boundary the old `_corpus` had (it raised `IndexError`
    above five) and past the point where a per-report accumulator bug would still tally."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=12)

    manifest = _run(tmp_path, corpus)

    assert len(manifest["reports"]) == 12
    assert manifest["corpus"]["pdf_count"] == 12
    assert all(entry["status"] in STATUSES for entry in manifest["reports"])
    assert sum(manifest["counts_by_status"].values()) == 12
    assert len({entry["match_id"] for entry in manifest["reports"]}) == 12
    assert manifest["counts_by_status"]["failed"] == 0


def test_the_expect_reports_match_path_holds_at_a_two_digit_corpus(tmp_path, make_report):
    """`--expect-reports` was only ever proven green over a 2-report corpus. The mismatch
    path is covered twice; this covers the MATCH path at a size the real run uses."""
    corpus = _corpus(tmp_path / "corpus", make_report, count=12)

    manifest = _run(tmp_path, corpus, expect_reports=12)

    assert manifest["run"]["corpus_gaps"] == []
    assert manifest["corpus"]["expected_pdf_count"] == 12


def test_the_committed_corpus_run_manifest_carries_exactly_one_hundred_and_four(repo_root):
    """AC 1's literal clause, asserted over the real run rather than a synthetic corpus.

    A corpus test: `work/` is gitignored, so it skips locally and fails under `CI=1`,
    the same contract the staged-spine and ground-truth-PDF fixtures carry. Building 104
    synthetic PDFs would assert the runner's arithmetic, which the twelve-report test
    above already does; only the real manifest can assert the real corpus is complete.
    """
    path = repo_root / "work" / "run-manifest.json"
    if not path.is_file():
        message = ("run manifest not available at work/run-manifest.json — run "
                   "`python -m pipeline.ingest.batch --input-dir pmsr-corpus "
                   "--expect-reports 104` first")
        if os.environ.get("CI"):
            pytest.fail(f"{message}. Failing rather than skipping: CI is set.")
        pytest.skip(message)

    manifest = json.loads(path.read_text(encoding="utf-8"))

    assert len(manifest["reports"]) == 104
    assert manifest["corpus"]["pdf_count"] == 104
    assert all(entry["status"] in STATUSES for entry in manifest["reports"])
    assert sum(manifest["counts_by_status"].values()) == 104
    assert len({entry["report_id"] for entry in manifest["reports"]}) == 104
    assert manifest["counts_by_status"]["failed"] == 0
    # Story 1.19's tripwire, pinned rather than left as a convention in story prose: the
    # 1.12 ruling accepted EXACTLY two self-validation failures, both hand-verified as
    # source defects. A third re-opens that ruling. This is a BASELINE ASSERTION over the
    # real corpus, never a tolerance and never an allowlist — the allowlist mechanism was
    # considered and rejected in 1.12, and SM-C1 forbids weakening a check to pass.
    failing = sorted(
        entry["report_id"] for entry in manifest["reports"] if entry["self_validation"] == "fail"
    )
    assert failing == ["PMSR-M19-ARG-V-ALG", "PMSR-M58-TUN-V-NED"], (
        "the adjudicated baseline is exactly these two forced-turnover deviations; a "
        "third means the discrepancy is systematic rather than two defective pages, "
        "which re-opens the Story 1.12 ruling"
    )
    assert manifest["run"]["self_validation_fail_count"] == 2
    assert manifest["run"]["result"] == "fail", (
        "the ruled clean-corpus baseline FAILS the run by design (exit 1) — asserting a "
        "pass here would make a future dev 'fix' a correctly reported source defect"
    )

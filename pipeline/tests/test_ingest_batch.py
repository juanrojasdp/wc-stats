"""Tasks 6/7: batch runner, run manifest, idempotence and the CLI (AC 1, 2, 3, 4).

Multi-report corpora are synthetic PDFs built in `tmp_path`, never the real corpus: it is
gitignored (`*.pdf`), so it is not present in every checkout, and a test pointing at a
missing directory would run against an empty corpus and pass having verified nothing — a
Story 1.4 review finding. Tests needing a real PDF use the `mex_rsa_pdf` fixture, which
carries a skip-guard for exactly that reason.
"""

from __future__ import annotations

import json
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


def _corpus(directory: Path, make_report, count: int = 3) -> Path:
    """`count` well-formed reports, each with a distinct match number and team pair."""
    directory.mkdir(parents=True, exist_ok=True)
    for i in range(count):
        home, away = TEAMS[i]
        make_report(
            directory / f"PMSR-M{i + 1:02d}-{home[:3].upper()}-V-{away[:3].upper()}.pdf",
            number=i + 1,
            home=home,
            away=away,
            day=11 + i,
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
        venue="A Different Stadium",
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

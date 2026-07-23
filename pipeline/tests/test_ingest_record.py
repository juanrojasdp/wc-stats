"""Tasks 4/5: the pure per-report Extract and the canonical record writer (AC 3, 4, 5).

The purity assertions here are the enforcement AD-9 asks for: an Extraction Record that
carried corpus knowledge or a wall-clock value would make the same PDF produce different
records depending on what else was in the run, and AC 3's byte-identity would be a lie.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from pipeline.discover.anchors import ANCHOR_REGISTRY, AnchorSpec, resolve_anchors
from pipeline.discover.errors import MissingAnchorError
from pipeline.ingest.errors import MatchNumberError, RecordWriteError
from pipeline.ingest.extract_report import RECORD_VERSION, extract_report, relative_source_path
from pipeline.ingest.fingerprint import code_version, pdf_content_hash
from pipeline.ingest.records import (
    is_unchanged,
    read_record,
    record_path,
    serialize_record,
    write_record,
)

ISO_TIMESTAMP_RE = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")


def _values(node, path="") -> "list[tuple[str, object]]":
    """Every scalar in the record tree, with its dotted key path."""
    if isinstance(node, dict):
        return [pair for key, value in node.items() for pair in _values(value, f"{path}.{key}")]
    if isinstance(node, list):
        return [pair for i, value in enumerate(node) for pair in _values(value, f"{path}[{i}]")]
    return [(path, node)]


def _keys(node) -> "set[str]":
    if isinstance(node, dict):
        return set(node) | {k for value in node.values() for k in _keys(value)}
    if isinstance(node, list):
        return {k for value in node for k in _keys(value)}
    return set()


# --- the record, on the real report ----------------------------------------------


def test_the_ground_truth_report_extracts_a_complete_record(mex_rsa_pdf, tmp_path):
    """Every registered anchor resolves on the registry's own ground truth."""
    pdf = tmp_path / "PMSR-M01-MEX-V-RSA.pdf"
    pdf.write_bytes(mex_rsa_pdf.read_bytes())

    record = extract_report(pdf)

    assert record["record_version"] == RECORD_VERSION
    assert record["match_id"] == "m001-mexico-south-africa"
    assert record["report_id"] == "PMSR-M01-MEX-V-RSA"
    assert record["metadata"]["home_team"] == "Mexico"
    assert record["metadata"]["match_number"] == 1
    assert record["page_count"] == 52
    assert record["anchors"]["cover"] == [0]
    # Derived from the registry, not hard-coded: `make_report` generates anchor pages from
    # ANCHOR_REGISTRY so a domain page added by a later story widens the fixtures
    # automatically, and a literal 47 here would reintroduce exactly the manual
    # maintenance that design removes.
    assert len(record["anchors"]) == len(
        resolve_anchors(ANCHOR_REGISTRY, home="Mexico", away="South Africa")
    )
    assert record["warnings"] == []


def test_the_record_is_a_pure_function_of_the_pdf(mex_rsa_pdf, tmp_path):
    """AC 3: two extractions of the same bytes must agree exactly."""
    pdf = tmp_path / "PMSR-M01-MEX-V-RSA.pdf"
    pdf.write_bytes(mex_rsa_pdf.read_bytes())

    assert extract_report(pdf) == extract_report(pdf)


def test_extraction_writes_nothing_to_disk(mex_rsa_pdf, tmp_path):
    """AD-9: `extract_report` is a pure PDF -> record; persistence is the writer's job."""
    pdf = tmp_path / "PMSR-M01-MEX-V-RSA.pdf"
    pdf.write_bytes(mex_rsa_pdf.read_bytes())
    before = sorted(p.name for p in tmp_path.iterdir())

    extract_report(pdf)

    assert sorted(p.name for p in tmp_path.iterdir()) == before


# --- purity ----------------------------------------------------------------------


def test_the_record_carries_no_corpus_level_knowledge(tmp_path, make_report):
    """`matchday_round` needs the whole corpus, so it cannot live in a per-report record."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert "matchday_round" not in _keys(record)


def test_the_record_carries_no_timestamp(tmp_path, make_report):
    """A wall-clock value would make every re-run differ and defeat idempotence."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    offenders = [
        (key, value)
        for key, value in _values(record)
        if isinstance(value, str) and ISO_TIMESTAMP_RE.search(value)
    ]
    assert offenders == []
    assert not {"extracted_at", "run_timestamp", "run_id", "run_index"} & _keys(record)


def test_the_source_path_is_repo_relative_never_absolute(tmp_path, make_report):
    """A record produced on one machine must match one produced on another."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert record["source_pdf"] == "PMSR-M07-AAA-V-BBB.pdf"
    assert not Path(record["source_pdf"]).is_absolute()
    assert "\\" not in record["source_pdf"]
    assert str(tmp_path) not in json.dumps(record)


def test_a_pdf_inside_the_repo_records_its_repo_relative_path(mex_rsa_pdf, repo_root):
    """The repo-relative branch is the one the real corpus takes.

    `pmsr-corpus/` sits at the repo root (gitignored via `*.pdf`), so every one of the 104
    staged records carries `pmsr-corpus/PMSR-M..-...pdf`. The bare-file-name fallback is
    for a PDF with no repo-relative form at all, such as a `tmp_path` fixture.
    """
    recorded = relative_source_path(mex_rsa_pdf)

    assert recorded == "spike/mex_rsa.pdf"
    assert (repo_root / recorded).exists()


def test_a_report_extracted_from_inside_the_repo_records_a_repo_relative_source_end_to_end(
    mex_rsa_pdf, repo_root, tmp_path
):
    """End-to-end, not just on the pure helper — a corpus-shaped copy inside the repo.

    Every other `source_pdf` assertion runs from `tmp_path`, which is outside the repo and
    therefore only ever proves the fallback.
    """
    staging = repo_root / "work" / "review-tmp"
    staging.mkdir(parents=True, exist_ok=True)
    inside = staging / "PMSR-M01-MEX-V-RSA.pdf"
    inside.write_bytes(mex_rsa_pdf.read_bytes())
    try:
        record = extract_report(inside)
    finally:
        inside.unlink(missing_ok=True)

    assert record["source_pdf"] == "work/review-tmp/PMSR-M01-MEX-V-RSA.pdf"


def test_the_ground_truth_fixture_cannot_be_ingested_under_its_own_name(mex_rsa_pdf):
    """The filename cross-check is not optional for a PDF that merely looks right.

    `spike/mex_rsa.pdf` carries a valid PMSR cover but a hand-given stem, so ingestion
    refuses it — which is the mis-named-download guard doing its job, and the reason the
    real-PDF tests above copy it to a corpus-shaped name first.
    """
    with pytest.raises(MatchNumberError, match="file name"):
        extract_report(mex_rsa_pdf)


def test_the_self_validation_and_domains_blocks_are_structurally_present(tmp_path, make_report):
    """Stories 1.3+ plug into these seams; their absence must not change the shape later."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert record["domains"] == {}
    assert record["self_validation"] == {"result": "not-applicable", "checks": []}


def test_self_validation_does_not_claim_a_pass_it_never_ran(tmp_path, make_report):
    """`"pass"` would read as a passed check in Story 1.19's acceptance. It is not one."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert record["self_validation"]["result"] == "not-applicable"


def test_the_idempotence_keys_live_inside_the_record(tmp_path, make_report):
    """The skip decision must need nothing but the record itself."""
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    record = extract_report(pdf)

    assert record["idempotence"]["pdf_content_hash"] == pdf_content_hash(pdf)
    assert record["idempotence"]["code_version"] == code_version()


# --- anchors ---------------------------------------------------------------------


def test_a_missing_required_anchor_fails_the_report_naming_the_anchor(tmp_path, make_report):
    pdf = make_report(
        tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7, drop_anchor_ids=("shots:home",)
    )

    with pytest.raises(MissingAnchorError) as excinfo:
        extract_report(pdf)

    assert "Attempts at Goal Mexico" in str(excinfo.value)
    assert "PMSR-M07-AAA-V-BBB" in str(excinfo.value)


def test_anchor_pages_are_ascending_page_numbers(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    for pages in record["anchors"].values():
        assert pages == sorted(pages)
        assert all(0 <= page < record["page_count"] for page in pages)


# --- the writer ------------------------------------------------------------------


def test_the_record_file_is_named_for_the_match_id(tmp_path, make_report):
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    written = write_record(record, tmp_path / "extracted")

    assert written == record_path(tmp_path / "extracted", record["match_id"])
    assert written.name == f"{record['match_id']}.json"


def test_the_record_is_serialized_canonically(tmp_path, make_report):
    """AD-8: sorted keys, UTF-8, LF — so two runs are byte-identical across hosts."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    raw = write_record(record, tmp_path / "extracted").read_bytes()

    assert b"\r\n" not in raw
    text = raw.decode("utf-8")
    assert json.dumps(json.loads(text), indent=2, ensure_ascii=False, sort_keys=True) + "\n" == text
    assert text == serialize_record(record)


def test_accented_names_survive_the_round_trip(tmp_path, make_report):
    """`ensure_ascii=False` — a record must print `Curaçao`, not `Cura\\u00e7ao`."""
    pdf = make_report(
        tmp_path / "PMSR-M07-CUW-V-CIV.pdf", number=7, home="Curaçao", away="Côte d'Ivoire"
    )
    record = extract_report(pdf)

    written = write_record(record, tmp_path / "extracted")

    assert record["match_id"] == "m007-curacao-cote-d-ivoire"
    assert "Curaçao" in written.read_text(encoding="utf-8")
    assert read_record(written)["metadata"]["home_team"] == "Curaçao"


def test_rewriting_the_same_record_is_byte_identical(tmp_path, make_report):
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)
    extracted = tmp_path / "extracted"

    first = write_record(extract_report(pdf), extracted).read_bytes()
    second = write_record(extract_report(pdf), extracted).read_bytes()

    assert first == second


def test_no_temporary_file_survives_a_write(tmp_path, make_report):
    """The write is atomic via os.replace; the staging file must not be left behind."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))
    extracted = tmp_path / "extracted"

    write_record(record, extracted)

    assert [p.name for p in extracted.iterdir()] == [f"{record['match_id']}.json"]


# --- the reader and the skip decision --------------------------------------------


def test_an_unchanged_record_is_recognized(tmp_path, make_report):
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)
    written = write_record(extract_report(pdf), tmp_path / "extracted")

    assert is_unchanged(read_record(written), pdf_content_hash(pdf), code_version())


@pytest.mark.parametrize("field", ["pdf_content_hash", "code_version"])
def test_either_key_changing_invalidates_the_record(tmp_path, make_report, field):
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)
    record = extract_report(pdf)
    keys = {"pdf_content_hash": pdf_content_hash(pdf), "code_version": code_version()}
    keys[field] = "0" * 64

    assert not is_unchanged(record, keys["pdf_content_hash"], keys["code_version"])


def test_a_missing_record_is_absent_not_unchanged(tmp_path):
    assert read_record(tmp_path / "nope.json") is None
    assert not is_unchanged(None, "a" * 64, "b" * 64)


def test_a_corrupt_record_is_re_extracted_rather_than_skipped(tmp_path, make_report):
    """A run interrupted mid-write must never be read as a valid skip."""
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)
    written = write_record(extract_report(pdf), tmp_path / "extracted")
    written.write_text('{"match_id": "m007-aaa", "idempot', encoding="utf-8", newline="")

    assert read_record(written) is None


def test_a_record_missing_its_idempotence_block_is_treated_as_absent(tmp_path):
    """Malformed but parseable is still not a basis for skipping a report."""
    path = tmp_path / "m007-a-b.json"
    path.write_text('{"match_id": "m007-a-b"}\n', encoding="utf-8", newline="")

    assert not is_unchanged(read_record(path), "a" * 64, "b" * 64)


def test_record_keys_are_snake_case(tmp_path, make_report):
    """`work/` is pipeline-internal staging (AD-9); camelCase binds only /contract and /data."""
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    structural = _keys(record) - set(record["anchors"])  # anchor ids are kebab, by design
    assert all(re.fullmatch(r"[a-z][a-z0-9_]*", key) for key in structural), structural


# --- AC 4: page discovery is text-anchored, never index-based ---------------------


def test_a_shuffled_report_resolves_the_same_anchors(tmp_path, make_report):
    """AC 4: "a shuffled or offset report still resolves".

    The whole point of text-anchored discovery is that page *position* carries no meaning.
    Every other fixture emits anchor pages in registry order with the cover at index 0, so
    a purely index-based implementation would have passed all of them. Here the body pages
    are reversed and the anchor map must still name the same anchors — with different page
    numbers, which is exactly what proves the numbers were looked up rather than assumed.
    """
    ordered = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))
    shuffled = extract_report(
        make_report(tmp_path / "PMSR-M08-AAA-V-BBB.pdf", number=8, page_order="reversed")
    )

    assert set(shuffled["anchors"]) == set(ordered["anchors"])
    assert shuffled["page_count"] == ordered["page_count"]
    assert shuffled["anchors"]["cover"] == [0]
    # Same anchors, different pages: the map is derived from text, not from position.
    assert shuffled["anchors"] != ordered["anchors"]


def test_an_offset_report_resolves_the_same_anchors(tmp_path, make_report):
    """AC 4's "offset" half: blank pages pushed in front of every anchor page."""
    ordered = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))
    offset = extract_report(
        make_report(tmp_path / "PMSR-M09-AAA-V-BBB.pdf", number=9, filler_pages=3)
    )

    assert set(offset["anchors"]) == set(ordered["anchors"])
    assert offset["page_count"] == ordered["page_count"] + 3
    for anchor_id, pages in offset["anchors"].items():
        if anchor_id == "cover":
            continue
        assert pages == [page + 3 for page in ordered["anchors"][anchor_id]]


# --- Task 4: the optional-anchor warning path ------------------------------------


def test_an_optional_anchor_that_does_not_resolve_is_warned_not_fatal(
    tmp_path, make_report, monkeypatch
):
    """Task 4: a non-required anchor is omitted from the map and named in `warnings`.

    Every spec in ANCHOR_REGISTRY is `required=True`, so this branch is unreachable
    through the real registry and was previously untested — while the story's Completion
    Notes claimed otherwise. It becomes live the moment a later story adds a genuinely
    optional section, so it is exercised here against a registry with one added.
    """
    optional = AnchorSpec(
        anchor_id="review:optional",
        template="A Section No Report Contains",
        domain="review",
    )
    monkeypatch.setattr(
        "pipeline.ingest.extract_report.ANCHOR_REGISTRY",
        (*ANCHOR_REGISTRY, AnchorSpec(**{**optional.__dict__, "required": False})),
    )

    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))

    assert "review:optional" not in record["anchors"]
    assert any("review:optional" in warning for warning in record["warnings"])
    assert any("A Section No Report Contains" in warning for warning in record["warnings"])


def test_an_anchor_registry_authoring_bug_is_not_blamed_on_the_report(
    tmp_path, make_report, monkeypatch
):
    """A malformed `AnchorSpec` must not be rewritten as this report's `ProbeError`.

    `discover/anchors.py` raises for a bad spec precisely so it fails loudly at resolution
    time "rather than surfacing as a phantom missing anchor across all 104 reports". A
    blanket handler around the page read would turn one authoring typo into 104 identical
    failed entries blaming the corpus, which is the opposite of that guarantee.
    """
    monkeypatch.setattr(
        "pipeline.ingest.extract_report.ANCHOR_REGISTRY",
        (*ANCHOR_REGISTRY, AnchorSpec(anchor_id="bad", template="{team} Report", domain="x")),
    )
    pdf = make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7)

    with pytest.raises(ValueError) as excinfo:
        extract_report(pdf)

    assert "could not read report pages" not in str(excinfo.value)


# --- Task 5: the record writer's typed failure -----------------------------------


def test_an_unwritable_staging_directory_is_a_typed_per_report_failure(tmp_path, make_report):
    """Task 5: the `OSError` is wrapped so it stays inside the batch's per-report loop.

    Unwrapped, it would reach `main`'s `except (OSError, ValueError)` and exit 2 for the
    whole run — the precise AC 2 violation ("a per-report failure never aborts the batch")
    this wrap exists to prevent.
    """
    record = extract_report(make_report(tmp_path / "PMSR-M07-AAA-V-BBB.pdf", number=7))
    blocked = tmp_path / "extracted"
    blocked.write_text("not a directory\n", encoding="utf-8", newline="")

    with pytest.raises(RecordWriteError) as excinfo:
        write_record(record, blocked)

    assert excinfo.value.report_id == "PMSR-M07-AAA-V-BBB"
    assert "PMSR-M07-AAA-V-BBB" in str(excinfo.value)


def test_a_record_written_under_an_older_record_version_does_not_license_a_skip(tmp_path):
    """`code_version` cannot see a shape change made by an older checkout or a restore."""
    keys = {"pdf_content_hash": "a" * 64, "code_version": "b" * 64}

    assert is_unchanged({"record_version": RECORD_VERSION, "idempotence": keys}, *keys.values())
    assert not is_unchanged({"record_version": RECORD_VERSION - 1, "idempotence": keys}, *keys.values())
    assert not is_unchanged({"idempotence": keys}, *keys.values())

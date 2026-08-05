"""Story 1.15 — the slug registry, the pinning checks, and the normalized spine.

Two properties carry most of the weight here, and both are easy to get wrong in a way
that still reads green:

1. **The pinning check must be able to fail.** `data/matches/` does not exist yet, so a
   naive `if not exists: return []` would ship a gate that cannot fail. The absent
   baseline is asserted to report UNAVAILABLE and explicitly not success.
2. **The spine's exhaustiveness assertion must not be vacuous.** It passes on all 104
   real records, which proves nothing unless it also fails when a name goes unresolved.
   That negative is pinned directly.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.precompute import slug_registry
from pipeline.precompute.errors import SlugRegistryError, SpineError
from pipeline.precompute.identity import (
    DATA_BASELINE_UNAVAILABLE,
    build_pins,
    check_committed_data,
    check_overrides,
    check_pins,
    matchday_rounds,
    pin_key,
    render_registry,
    resolve_players,
    team_codes,
    write_registry,
)
from pipeline.ingest.identity import team_slug
from pipeline.precompute.records import CONSUMABLE_STATUSES, load_records
from pipeline.precompute.spine import (
    assert_every_name_resolved,
    build_match_spine,
    build_spine,
    write_spine,
)
from pipeline.tests.test_precompute_identity import _Registry, make_record

EMPTY_REGISTRY = _Registry()


@pytest.fixture
def clean_registry():
    """Snapshot and restore the committed registry's module-level maps.

    Defined LOCALLY rather than in `conftest.py`, following `test_checks_registry.py`:
    these maps are module-level mutables, and a test that leaked a mutation into them
    would corrupt every later test in the session in a way that looks like a real defect.
    """
    snapshot = (
        dict(slug_registry.TEAM_CODES),
        {k: dict(v) for k, v in slug_registry.PINS.items()},
        dict(slug_registry.OVERRIDES),
    )
    yield
    slug_registry.TEAM_CODES.clear()
    slug_registry.TEAM_CODES.update(snapshot[0])
    for kind, mapping in snapshot[1].items():
        slug_registry.PINS[kind].clear()
        slug_registry.PINS[kind].update(mapping)
    slug_registry.OVERRIDES.clear()
    slug_registry.OVERRIDES.update(snapshot[2])


def make_full_record(match_id="m001-mexico-south-africa", report_id="PMSR-M01-MEX-V-RSA"):
    """A constructed record carrying one row on each SHAPE of name path the corpus uses.

    Deliberately small and visibly synthetic. Its job is to exercise every resolution
    mode — shirt-bearing, shirt-less, and the two edge name keys — not to imitate a real
    record's twelve domains.
    """
    record = make_record(
        match_id, report_id, "Mexico", "South Africa",
        ([("Raul RANGEL", 1), ("Cesar MONTES", 3)], [("Julian QUINONES", 16)]),
        ([("Ronwen WILLIAMS", 1)], []),
    )
    record["domains"].update(
        {
            # Shirt-bearing, side in the path.
            "player_stats": {
                "home": [{"name": "Raul RANGEL", "shirt_number": 1, "passes": 27}],
                "away": [{"name": "Ronwen WILLIAMS", "shirt_number": 1, "passes": 12}],
            },
            # The two-name-key shape.
            "pass_network": {
                "home": {
                    "edges": [
                        {"from_name": "Raul RANGEL", "from_shirt": 1,
                         "to_name": "Cesar MONTES", "to_shirt": 3, "volume": 6}
                    ],
                    "players": [{"name": "Cesar MONTES", "shirt_number": 3}],
                },
                "away": {"edges": [], "players": []},
            },
            # NO side in the path — resolves through `team_id`.
            "shots": {
                "shot_events": [
                    {"player_name": "Cesar MONTES", "shirt_number": 3,
                     "team_id": "mexico", "outcome": "goal"}
                ]
            },
            # The ONLY shape with no shirt companion anywhere: resolves by verbatim name.
            "receiving": {
                "offers": {
                    "home": {"most_offers": {"player_name": "Julian QUINONES",
                                             "position": "LEFT WINGER", "value": 54},
                             "table_rows": []},
                    "away": {"most_offers": None, "table_rows": []},
                }
            },
            # Duplicates name + shirt from Domain A; must reconcile to the SAME id.
            "goalkeeping": {
                "home": {"goalkeepers": [{"name": "Raul RANGEL", "shirt_number": 1}]},
                "away": {"goalkeepers": [{"name": "Ronwen WILLIAMS", "shirt_number": 1}]},
            },
        }
    )
    return record


def resolve(records):
    codes = team_codes(records)
    return codes, resolve_players(records, codes, EMPTY_REGISTRY), matchday_rounds(records)


# --- the committed registry --------------------------------------------------------


def test_the_committed_registry_pins_the_whole_corpus_namespace():
    """48 team codes, 48 team ids, 104 match ids, 1,248 player ids (Task 4.6)."""
    assert len(slug_registry.TEAM_CODES) == 48
    assert len(slug_registry.PINS["teams"]) == 48
    assert len(slug_registry.PINS["matches"]) == 104
    assert len(slug_registry.PINS["players"]) == 1248


def test_the_three_accented_team_names_are_pinned_with_their_accents_folded():
    """AC 4 row 1's REAL half.

    The player half of that row is corpus-empty — 0 non-ASCII characters in 1,247 names —
    and is covered by a visibly constructed test. But the NFKD fold is not decoration:
    three real team names need it, they are why the fold is kept at all, and their ids are
    committed. Previously they appeared only inside a docstring, so nothing would have
    caught a fold that stopped working on the one input that genuinely exercises it.
    """
    for printed, expected in (
        ("Curaçao", "curacao"),
        ("Türkiye", "turkiye"),
        ("Côte d'Ivoire", "cote-d-ivoire"),
    ):
        assert team_slug(printed) == expected
        assert slug_registry.PINS["teams"][expected] == expected
        assert expected in slug_registry.TEAM_CODES


REGISTRY_SOURCE = Path(slug_registry.__file__)
STAGED_RECORDS = Path("work") / "extracted"


@pytest.mark.skipif(
    not (Path("work") / "run-manifest.json").is_file(),
    reason="needs the staged corpus; `work/` is gitignored and absent on a fresh clone",
)
def test_regenerating_the_registry_from_the_corpus_reproduces_the_COMMITTED_bytes():
    """Task 4.5's pin, against the artifact that actually ships.

    The two determinism tests below render a one-match synthetic corpus and compare two
    writes of the same text — which proves `render_registry` is a pure function, and
    nothing about the 1,400 ids in the committed module. A change to `_kebab`,
    `team_slug` or the caps-run rule that re-slugged hundreds of players passed the whole
    suite: the counts stay 48/48/104/1248 and the 155-id fixture reproduction is
    unaffected if the change touches only multi-token names.

    Skipped rather than absent when `work/` is unavailable, because the input is
    gitignored staging — but it runs on any tree that has actually executed the batch,
    which is every tree that could regenerate the registry in the first place.
    """
    records = load_records(Path("work") / "run-manifest.json", STAGED_RECORDS)
    codes = team_codes(records)
    pins = build_pins(records, codes, slug_registry)
    rendered = render_registry(codes, pins, dict(slug_registry.OVERRIDES))
    assert rendered.encode("utf-8") == REGISTRY_SOURCE.read_bytes(), (
        "regenerating the registry from the staged corpus does not reproduce the "
        "committed bytes — an id has changed, which AD-3 forbids"
    )


def test_the_committed_override_map_ships_empty():
    """An empty override map is the CORRECT state until the as-listed list is ruled on.

    219 players slug given-name-first under the as-listed fallback. Which of those should
    be re-ordered is a UX decision, and pre-emptively filling this map would be exactly
    the guess AD-8 forbids.
    """
    assert slug_registry.OVERRIDES == {}


def test_the_registry_is_python_so_the_code_version_fingerprints_it():
    """AD-8's guarantee holds only because this file is inside the source glob.

    If it ever moves to JSON, `EXTRA_FINGERPRINTED_FILES` must be widened in the same
    commit — a step whose omission is silent, which is why this test names it.
    """
    from pipeline.ingest.fingerprint import EXTRA_FINGERPRINTED_FILES, PIPELINE_ROOT

    registry_path = Path(slug_registry.__file__)
    assert registry_path.suffix == ".py"
    assert registry_path.is_relative_to(PIPELINE_ROOT)
    assert "slug_registry" not in " ".join(EXTRA_FINGERPRINTED_FILES), (
        "the registry is Python and must not also be listed as an extra file"
    )


def test_the_two_cross_team_martinez_players_are_pinned_to_distinct_ids():
    """The corpus's one real ambiguity, pinned in the committed artifact."""
    players = slug_registry.PINS["players"]
    assert players[pin_key("argentina", 23)] == "martinez-emiliano-arg"
    assert players[pin_key("uruguay", 15)] == "martinez-emiliano-uru"


def test_every_korea_republic_player_is_pinned_surname_first():
    """The 26 ids a last-token rule would have inverted."""
    korea = {
        key: value
        for key, value in slug_registry.PINS["players"].items()
        if key.startswith("korea-republic#")
    }
    assert len(korea) == 26
    assert slug_registry.PINS["players"][pin_key("korea-republic", 1)].startswith("kim-")


# --- determinism -------------------------------------------------------------------


def test_rendering_the_registry_twice_produces_identical_text():
    records = [make_full_record()]
    codes, _resolved, _rounds = resolve(records)
    pins = build_pins(records, codes, EMPTY_REGISTRY)
    assert render_registry(codes, pins, {}) == render_registry(codes, pins, {})


def test_writing_the_registry_twice_produces_byte_identical_files(tmp_path):
    """Byte-identical, not merely equal text: LF endings and a trailing newline."""
    records = [make_full_record()]
    codes, _resolved, _rounds = resolve(records)
    pins = build_pins(records, codes, EMPTY_REGISTRY)
    text = render_registry(codes, pins, {})
    first = write_registry(text, tmp_path / "a.py").read_bytes()
    second = write_registry(text, tmp_path / "b.py").read_bytes()
    assert first == second
    assert b"\r\n" not in first, "CRLF would make two hosts disagree byte-for-byte"
    assert first.endswith(b"\n")


def test_the_generated_registry_is_importable_and_round_trips(tmp_path):
    """A registry that does not parse is worse than no registry."""
    records = [make_full_record()]
    codes, _resolved, _rounds = resolve(records)
    pins = build_pins(records, codes, EMPTY_REGISTRY)
    path = write_registry(render_registry(codes, pins, {}), tmp_path / "generated.py")
    namespace: dict = {}
    exec(compile(path.read_text(encoding="utf-8"), str(path), "exec"), namespace)
    assert namespace["TEAM_CODES"] == codes
    assert namespace["PINS"]["players"] == pins["players"]
    assert namespace["OVERRIDES"] == {}


def test_building_the_spine_twice_produces_byte_identical_files(tmp_path):
    records = [make_full_record()]
    codes, resolved, rounds = resolve(records)
    first = write_spine(
        build_spine(records, resolved, codes, rounds, EMPTY_REGISTRY), tmp_path / "one"
    )
    second = write_spine(
        build_spine(records, resolved, codes, rounds, EMPTY_REGISTRY), tmp_path / "two"
    )
    assert [p.name for p in first] == [p.name for p in second]
    for a, b in zip(first, second):
        assert a.read_bytes() == b.read_bytes()


# --- pinning -----------------------------------------------------------------------


def test_a_pin_that_still_holds_passes():
    check_pins({"argentina#23": "martinez-emiliano-arg"},
               {"argentina#23": "martinez-emiliano-arg"}, "players")


def test_a_pinned_id_that_would_change_fails_naming_both_ids():
    """AD-3: an id, once emitted, never changes."""
    with pytest.raises(SlugRegistryError) as excinfo:
        check_pins({"argentina#23": "emiliano-martinez-arg"},
                   {"argentina#23": "martinez-emiliano-arg"}, "players")
    message = str(excinfo.value)
    assert "martinez-emiliano-arg" in message and "emiliano-martinez-arg" in message


def test_an_unpinned_key_is_a_new_entity_and_does_not_fail():
    """Normal on a growing corpus — this is what lets the registry fill up over runs."""
    check_pins({"argentina#23": "martinez-emiliano-arg"}, {}, "players")


def test_an_override_naming_nobody_fails_loud():
    """A stale override is how a registry rots silently."""
    with pytest.raises(SlugRegistryError) as excinfo:
        check_overrides({"argentina#23": "martinez-emiliano-arg"},
                        {"brazil#99": "nobody-at-all-bra"})
    assert "brazil#99" in str(excinfo.value)


def test_an_override_naming_a_real_key_passes():
    check_overrides({"argentina#23": "martinez-emiliano-arg"},
                    {"argentina#23": "martinez-emi-arg"})


def test_an_override_whose_VALUE_is_malformed_fails_loud():
    """The override replaces a minted slug, so it must be gated as hard as one.

    `PlayerId` is a strict superset shape of `TeamId`, so even a two-segment override
    validates clean against the schema and produces a dead route — and the minted path's
    pattern gate does not cover the override, because the override is what replaces its
    result. An ungated override is pinned, committed, and staged into every spine file
    that names the player, surfacing only in Story 1.16 at schema validation.
    """
    for bad in ("Gabriel Magalhaes", "magalhaes-gabriel", "magalhaes-gabriel-brazil", ""):
        with pytest.raises(SlugRegistryError) as excinfo:
            check_overrides({"brazil#4": "gabriel-magalhaes-bra"}, {"brazil#4": bad})
        assert "PlayerId" in str(excinfo.value)


def test_the_committed_registry_maps_survive_a_test_that_mutates_them(clean_registry):
    """`clean_registry` earns its docstring here.

    `slug_registry.PINS` and `OVERRIDES` are module-level mutables imported directly by
    `pipeline/validate/checks.py` as `SLUG_REGISTRY`, so a leaked mutation would corrupt
    every later test in the session in a way that looks like a real defect. The fixture
    was defined with that rationale and requested by no test at all, which made the guard
    inert; this exercises it against the live maps.
    """
    slug_registry.OVERRIDES["mexico#1"] = "rangel-r-mex"
    slug_registry.PINS["players"]["mexico#1"] = "rangel-r-mex"
    check_overrides({"mexico#1": "rangel-raul-mex"}, slug_registry.OVERRIDES)
    assert slug_registry.PINS["players"]["mexico#1"] == "rangel-r-mex"


def test_the_committed_maps_were_restored_after_the_mutating_test():
    """The other half of the fixture's contract — ordering-dependent by nature, and the
    reason the snapshot exists at all."""
    assert slug_registry.OVERRIDES == {}
    assert slug_registry.PINS["players"]["mexico#1"] == "rangel-raul-mex"


# --- AC 3's second source ----------------------------------------------------------


def test_an_absent_data_baseline_reports_unavailable_and_never_success(tmp_path):
    """The load-bearing negative (Task 8.7).

    `data/matches/` does not exist and will not until Story 1.16 emits. A check that
    returned "passed" here would be a gate that cannot fail — which reads greener than no
    gate at all while proving strictly less.
    """
    notes = check_committed_data(slug_registry.PINS, tmp_path)
    assert len(notes) == 1
    assert notes[0] == DATA_BASELINE_UNAVAILABLE.format(
        path=(tmp_path / "matches").as_posix()
    )
    assert "unavailable" in notes[0]
    assert "NOT a pass" in notes[0]
    # And explicitly: it must not claim anything was verified.
    assert "all pinned" not in notes[0]


def test_the_committed_data_baseline_is_populated_and_every_id_in_it_is_pinned():
    """The POPULATED branch, switched over by Story 1.16 exactly as invited.

    This test used to assert `data/matches/` did NOT exist, pinning the premise that the
    registry was the only immutability source. Its own docstring said going red when
    1.16 landed was "the correct prompt to switch the primary assertion to the populated
    branch", and this is that switch.

    It now asserts the second pinning source actually ENGAGES: `check_committed_data`
    returns the "all pinned" note over the real committed bundles rather than the
    "baseline unavailable ... This is NOT a pass" line. That is the AC-3 gate Story 1.15
    could not close, because there was nothing to close it against.
    """
    from pipeline.precompute import slug_registry

    data_dir = Path(__file__).resolve().parents[2] / "data"
    bundles = sorted((data_dir / "matches").glob("*.json"))
    assert len(bundles) == 104, f"expected 104 committed bundles, found {len(bundles)}"

    notes = check_committed_data(slug_registry.PINS, data_dir)
    assert len(notes) == 1, notes
    assert "all pinned" in notes[0], notes[0]
    assert "baseline unavailable" not in notes[0]
    assert "This is NOT a pass" not in notes[0]
    assert "104 bundle(s)" in notes[0], notes[0]


def test_a_populated_data_baseline_whose_ids_are_all_pinned_reports_what_it_checked(
    tmp_path,
):
    (tmp_path / "matches").mkdir()
    (tmp_path / "matches" / "m001.json").write_text(
        json.dumps(
            {
                "matchId": "m001-mexico-south-africa",
                "metadata": {"lineups": {"home": {"starters": [
                    {"playerId": "rangel-raul-mex", "name": "Raul RANGEL"}]}}},
                "events": {"shots": [{"playerId": "montes-cesar-mex"}]},
            }
        ),
        encoding="utf-8",
    )
    pins = {
        "matches": {"PMSR-M01-MEX-V-RSA": "m001-mexico-south-africa"},
        "players": {"a": "rangel-raul-mex", "b": "montes-cesar-mex"},
        "teams": {},
    }
    notes = check_committed_data(pins, tmp_path)
    assert len(notes) == 1
    assert "all pinned" in notes[0]
    assert "3 id reference(s)" in notes[0]


def test_a_committed_id_the_registry_does_not_pin_fails(tmp_path):
    (tmp_path / "matches").mkdir()
    (tmp_path / "matches" / "m001.json").write_text(
        json.dumps({"events": {"shots": [{"playerId": "ghost-player-xxx"}]}}),
        encoding="utf-8",
    )
    with pytest.raises(SlugRegistryError) as excinfo:
        check_committed_data({"matches": {}, "players": {}, "teams": {}}, tmp_path)
    assert "ghost-player-xxx" in str(excinfo.value)


# --- the spine ---------------------------------------------------------------------


def test_the_spine_adds_ids_beside_every_name_and_removes_nothing():
    """`playerName` is required in eight contract $defs — the spine ADDS, never replaces.

    Asserted by STRIPPING the added id keys and requiring the result to equal the original
    `domains` block exactly. A `(path, key)` set comparison — the earlier form — collapses
    every list into one `[]` segment and records no values, no list lengths and no
    ordering, so it passed unchanged against a spine that reordered rows, deduped them, or
    rewrote every value. The module docstring promises "no key removed, no list reordered,
    nothing deduped"; equality is the only assertion that covers all three.

    Pruning the 43 all-zero pass-network nodes is the concrete forbidden edit this now
    catches: it leaves the key set identical and shortens a list.
    """
    record = make_full_record()
    _codes, resolved, rounds = resolve([record])
    spine = build_match_spine(record, resolved, rounds)

    added_keys = {"player_id", "from_player_id", "to_player_id"}

    def strip(node):
        """The staged node with only the keys the spine is allowed to add removed."""
        if isinstance(node, list):
            return [strip(item) for item in node]
        if not isinstance(node, dict):
            return node
        return {
            key: strip(value)
            for key, value in node.items()
            if key not in added_keys and not key.endswith("_team_id")
        }

    assert strip(spine["domains"]) == record["domains"], (
        "the spine changed something other than adding id fields"
    )

    # And it really did add them — otherwise the equality above is satisfied by a no-op.
    def id_keys(node):
        out = set()
        if isinstance(node, dict):
            for key, value in node.items():
                if key in added_keys or key.endswith("_team_id"):
                    out.add(key)
                out |= id_keys(value)
        elif isinstance(node, list):
            for item in node:
                out |= id_keys(item)
        return out

    assert id_keys(spine["domains"]) >= {"player_id", "from_player_id", "to_player_id"}


def test_the_spine_resolves_every_shape_of_name_path():
    record = make_full_record()
    _codes, resolved, rounds = resolve([record])
    domains = build_match_spine(record, resolved, rounds)["domains"]

    # shirt-bearing, side from the path
    assert domains["player_stats"]["home"][0]["player_id"] == "rangel-raul-mex"
    # the two-name-key shape
    edge = domains["pass_network"]["home"]["edges"][0]
    assert edge["from_player_id"] == "rangel-raul-mex"
    assert edge["to_player_id"] == "montes-cesar-mex"
    # no side in the path — resolved through team_id
    assert domains["shots"]["shot_events"][0]["player_id"] == "montes-cesar-mex"
    # the shirt-LESS path, resolved by verbatim name
    assert domains["receiving"]["offers"]["home"]["most_offers"]["player_id"] == (
        "quinones-julian-mex"
    )
    # display team names gain a sibling id
    assert domains["match_metadata"]["teams"]["home_team_id"] == "mexico"
    assert domains["match_metadata"]["teams"]["away_team_id"] == "south-africa"
    # and every original name survives
    assert domains["player_stats"]["home"][0]["name"] == "Raul RANGEL"


def test_the_goalkeeping_block_reconciles_to_the_same_id_as_the_lineup():
    """215 goalkeeper entries duplicate Domain A; they must not resolve independently."""
    record = make_full_record()
    _codes, resolved, rounds = resolve([record])
    domains = build_match_spine(record, resolved, rounds)["domains"]
    lineup_id = domains["match_metadata"]["lineups"]["home"]["starters"][0]["player_id"]
    assert domains["goalkeeping"]["home"]["goalkeepers"][0]["player_id"] == lineup_id


def test_a_name_disagreeing_with_its_shirt_number_fails_naming_both():
    """The 1.10 landmine: a name that LOOKS right beside the wrong shirt."""
    record = make_full_record()
    record["domains"]["player_stats"]["home"][0]["shirt_number"] = 3  # MONTES' shirt
    _codes, resolved, rounds = resolve([record])
    with pytest.raises(SpineError) as excinfo:
        build_match_spine(record, resolved, rounds)
    message = str(excinfo.value)
    assert "rangel-raul-mex" in message and "montes-cesar-mex" in message


def test_a_shirtless_name_matching_no_lineup_entry_fails_rather_than_being_skipped():
    """`most_offers` is a required Story 1.16 input; it may not be quietly dropped."""
    record = make_full_record()
    record["domains"]["receiving"]["offers"]["home"]["most_offers"]["player_name"] = (
        "Nobody AT ALL"
    )
    _codes, resolved, rounds = resolve([record])
    with pytest.raises(SpineError) as excinfo:
        build_match_spine(record, resolved, rounds)
    assert "'Nobody AT ALL'" in str(excinfo.value)


def test_a_name_carrying_a_stray_space_is_reported_with_repr():
    """`repr()` deliberately: a doubled space is invisible in a plain message."""
    record = make_full_record()
    record["domains"]["receiving"]["offers"]["home"]["most_offers"]["player_name"] = (
        "Julian  QUINONES"
    )
    _codes, resolved, rounds = resolve([record])
    with pytest.raises(SpineError) as excinfo:
        build_match_spine(record, resolved, rounds)
    assert "'Julian  QUINONES'" in str(excinfo.value)


def test_the_exhaustiveness_assertion_is_not_vacuous():
    """THE test that makes every passing exhaustiveness run mean something.

    It passes over all 104 real records. That is only evidence if it can also fail — so
    here a known player name is planted on an object with no id sibling, exactly as a
    future story adding a 26th name path would leave it.
    """
    record = make_full_record()
    _codes, resolved, rounds = resolve([record])
    spine = build_match_spine(record, resolved, rounds)

    # Sanity: it passes on the real thing first.
    assert_every_name_resolved(spine, {"Raul RANGEL"}, {"Mexico"}, "PMSR-M01-MEX-V-RSA")

    # Now the 26th path a later story might add, with no id beside it.
    spine["domains"]["some_new_domain"] = {"home": {"rows": [{"name": "Raul RANGEL"}]}}
    with pytest.raises(SpineError) as excinfo:
        assert_every_name_resolved(
            spine, {"Raul RANGEL"}, {"Mexico"}, "PMSR-M01-MEX-V-RSA"
        )
    assert "some_new_domain" in str(excinfo.value)


def test_the_entities_block_is_sorted_and_carries_the_diagnostic_slug_source():
    records = [make_full_record()]
    codes, resolved, rounds = resolve(records)
    entities = build_spine(records, resolved, codes, rounds, EMPTY_REGISTRY)["entities"]

    assert [t["team_id"] for t in entities["teams"]] == sorted(
        t["team_id"] for t in entities["teams"]
    )
    assert [p["player_id"] for p in entities["players"]] == sorted(
        p["player_id"] for p in entities["players"]
    )
    assert [m["match_id"] for m in entities["matches"]] == sorted(
        m["match_id"] for m in entities["matches"]
    )
    sources = {p["slug_source"] for p in entities["players"]}
    assert sources <= {"caps-run", "as-listed", "override"}
    assert entities["spine_version"] == 1
    assert entities["generated_by"] == "pipeline.precompute.spine"


def test_a_player_appearing_in_two_matches_gets_one_id_and_two_match_ids():
    """FR-17, stated as the story states it."""
    records = [
        make_full_record("m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA"),
        make_full_record("m002-mexico-south-africa", "PMSR-M02-MEX-V-RSA"),
    ]
    codes, resolved, rounds = resolve(records)
    entities = build_spine(records, resolved, codes, rounds, EMPTY_REGISTRY)["entities"]
    rangel = [p for p in entities["players"] if p["player_id"] == "rangel-raul-mex"]
    assert len(rangel) == 1
    assert rangel[0]["match_ids"] == [
        "m001-mexico-south-africa", "m002-mexico-south-africa"
    ]


# --- record loading ----------------------------------------------------------------


def test_writing_the_spine_removes_match_files_the_run_no_longer_names(tmp_path):
    """A stale spine file is a phantom match one layer down.

    `work/spine/` is the staging Story 1.16 emits from, so a file left behind by a
    superseded run would enter the dataset exactly as an orphan record would — the hazard
    `load_records` refuses the directory listing to prevent. Leaving them put it back.
    """
    corpus = [make_full_record()]
    codes, resolved, rounds = resolve(corpus)
    write_spine(build_spine(corpus, resolved, codes, rounds), tmp_path)

    orphan = tmp_path / "matches" / "m999-ghost-team.json"
    orphan.write_text("{}", encoding="utf-8")
    write_spine(build_spine(corpus, resolved, codes, rounds), tmp_path)

    assert not orphan.exists(), "a superseded match file survived into the staged spine"
    assert (tmp_path / "matches" / "m001-mexico-south-africa.json").is_file()


def test_the_pinned_public_api_is_callable_exactly_as_the_story_declares_it():
    """Story 1.15 pins its entry points, following the `extract_domain_g` precedent.

    `build_spine` grew two OPTIONAL trailing parameters (`registry`, supplying `OVERRIDES`
    for the diagnostic `slug_source`, and `source_manifest` for the provenance field); it
    must still be callable with the four positional arguments the story names, or a later
    story following the pinned signature breaks.

    And the four-positional call must produce a COMPLETE `entities.json`. `slug_source` is
    `required` shape per Task 5.1 and Task 7.3's filing is defined as a query over it, so
    a pinned API that silently emitted `null` for all 1,248 players would make the story's
    own deferred-work filing unanswerable.
    """
    import inspect

    from pipeline.precompute import identity, records, slug_registry, spine

    assert inspect.signature(records.load_records).parameters.keys() >= {
        "manifest_path", "extracted_dir"
    }
    assert list(inspect.signature(identity.player_slug).parameters) == ["name", "team_code"]
    assert list(inspect.signature(identity.resolve_players).parameters) == [
        "records", "codes", "registry"
    ]
    assert list(inspect.signature(identity.team_codes).parameters) == ["records"]
    assert list(inspect.signature(spine.build_spine).parameters)[:4] == [
        "records", "resolved", "codes", "rounds"
    ]
    for name in ("TEAM_CODES", "PINS", "OVERRIDES"):
        assert hasattr(slug_registry, name)

    # And the four-positional-argument call really works — with a populated diagnostic.
    corpus = [make_full_record()]
    codes, resolved, rounds = resolve(corpus)
    built = spine.build_spine(corpus, resolved, codes, rounds)
    sources = {player["slug_source"] for player in built["entities"]["players"]}
    assert sources <= {"caps-run", "as-listed", "override"}, sources
    assert None not in sources, "the pinned four-argument API dropped slug_source"


def test_records_are_taken_from_the_manifest_and_never_from_the_directory_listing(
    tmp_path,
):
    """An orphan record no current PDF produced must not become a phantom match."""
    extracted = tmp_path / "extracted"
    extracted.mkdir()
    named = make_full_record()
    orphan = make_full_record("m999-ghost-team", "PMSR-M99-GHO-V-TEA")
    for record in (named, orphan):
        (extracted / f"{record['match_id']}.json").write_text(
            json.dumps(record), encoding="utf-8"
        )
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "reports": [
                    {
                        "match_id": named["match_id"],
                        "report_id": named["report_id"],
                        "record_path": str(extracted / f"{named['match_id']}.json"),
                        "status": "extracted",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    loaded = load_records(manifest, extracted)
    assert [r["match_id"] for r in loaded] == [named["match_id"]]


def test_both_extracted_and_skipped_unchanged_records_are_consumed():
    """The filter is on `status` alone."""
    assert CONSUMABLE_STATUSES == {"extracted", "skipped-unchanged"}


def test_a_failing_self_validation_never_excludes_a_record(tmp_path):
    """M19 and M58 are RULED CONSUMED.

    Both carry `status: "extracted"` with `self_validation: "fail"`. Their one failing
    check is `defensive-actions-marker-count`, which touches no lineup entry, no name path
    and no shirt number — the identity inputs are intact. Excluding them would drop two
    matches from the tournament over a source defect in an unrelated domain.
    """
    extracted = tmp_path / "extracted"
    extracted.mkdir()
    record = make_full_record()
    (extracted / f"{record['match_id']}.json").write_text(
        json.dumps(record), encoding="utf-8"
    )
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "reports": [
                    {
                        "match_id": record["match_id"],
                        "report_id": record["report_id"],
                        "record_path": str(extracted / f"{record['match_id']}.json"),
                        "status": "extracted",
                        "self_validation": "fail",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    assert len(load_records(manifest, extracted)) == 1


def test_records_are_returned_in_canonical_ascending_match_id_order(tmp_path):
    """Lexicographic order IS numeric order, because the padding was bought for it."""
    extracted = tmp_path / "extracted"
    extracted.mkdir()
    ids = ["m104-spain-argentina", "m001-mexico-south-africa", "m010-brazil-canada"]
    entries = []
    for index, match_id in enumerate(ids):
        record = make_full_record(match_id, f"PMSR-M{index + 1:02d}-AAA-V-BBB")
        (extracted / f"{match_id}.json").write_text(json.dumps(record), encoding="utf-8")
        entries.append(
            {
                "match_id": match_id,
                "report_id": record["report_id"],
                "record_path": str(extracted / f"{match_id}.json"),
                "status": "extracted",
            }
        )
    manifest = tmp_path / "run-manifest.json"
    manifest.write_text(json.dumps({"reports": entries}), encoding="utf-8")
    assert [r["match_id"] for r in load_records(manifest, extracted)] == sorted(ids)

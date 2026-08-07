"""Story 1.15 — the player slug rule, team codes, and cross-match resolution.

The acceptance check of this module is `test_the_caps_run_rule_reproduces_every_committed_
fixture_player_id`. Everything else supports it.

That is not a stylistic preference. Two different candidate slug rules both produce 1,248
unique, collision-free, pattern-valid ids over the real corpus — the ruled caps-run rule
and the rejected "last token is the surname" rule — so **no aggregate check can tell them
apart**. Only reproduction of the hand-authored, signed-off fixture ids can. A test suite
that asserted collision counts would have blessed either rule, and the symptom of the
wrong one is not a crash: it is `/players/seunggyu-kim-kor` naming the wrong half of a
person, on a route that resolves perfectly.

Where a case is corpus-EMPTY it is tested with visibly CONSTRUCTED data and said so. All
three of OQ-4's named ambiguous cases — accents, duplicate names, squad-number changes —
measure exactly zero on this corpus (0 non-ASCII characters in any of 1,247 distinct
player names, 0 normalized name+team collisions, 0 players wearing more than one shirt).
The mechanisms are built because AD-3 mandates them and a future corpus could exercise
them, but no fixture here pretends they are corpus-real.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pytest

from pipeline.precompute.errors import (
    IdentityCollisionError,
    PlayerSlugError,
    PrecomputeError,
)
from pipeline.precompute.identity import (
    MATCH_ID_RE,
    PLAYER_ID_RE,
    SCHEMA_PATTERNS,
    TEAM_CODE_RE,
    TEAM_ID_RE,
    pin_key,
    player_slug,
    resolve_matches,
    resolve_players,
    resolve_teams,
    team_codes,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "data" / "fixtures"
MATCH_FIXTURES = sorted((FIXTURES_DIR / "matches").glob("*.json"))
COMMON_SCHEMA = REPO_ROOT / "contract" / "common.schema.json"


class _Registry:
    """A stand-in slug registry. Constructed per test; never the committed module."""

    def __init__(self, overrides=None, pins=None, codes=None):
        self.OVERRIDES = dict(overrides or {})
        self.PINS = pins or {"matches": {}, "players": {}, "teams": {}}
        self.TEAM_CODES = dict(codes or {})


EMPTY_REGISTRY = _Registry()


def make_record(
    match_id: str,
    report_id: str,
    home_team: str,
    away_team: str,
    home_lineup,
    away_lineup,
):
    """A minimal Extraction Record carrying only what identity resolution reads.

    Visibly constructed: real records carry twelve domains and ~700 kB. Nothing here
    should be mistaken for corpus data.
    """

    def side(entries):
        starters, substitutes = entries
        return {
            "formation": "4-3-3",
            "starters": [
                {"name": n, "shirt_number": s, "position": "mf", "goals": [],
                 "own_goals": [], "cards": [], "substituted_on": None, "substituted_off": None}
                for n, s in starters
            ],
            "substitutes": [
                {"name": n, "shirt_number": s, "position": "mf", "goals": [],
                 "own_goals": [], "cards": [], "substituted_on": None, "substituted_off": None}
                for n, s in substitutes
            ],
        }

    return {
        "match_id": match_id,
        "report_id": report_id,
        "source_pdf": f"pmsr-corpus/{report_id}.pdf",
        "metadata": {
            "home_team": home_team, "away_team": away_team,
            "home_score": 0, "away_score": 0,
            # Tolerant on purpose: one test constructs a deliberately malformed match id.
            "match_number": int(re.sub(r"\D", "", match_id.split("-")[0]) or 1),
            "stage_text": "Final - Match 104", "group": None,
            "match_date": "2026-07-19", "kickoff": "15:00", "venue": "Test Stadium",
            "shootout": None, "probe_notes": [],
        },
        "domains": {
            "match_metadata": {
                "teams": {"home": home_team, "away": away_team},
                "lineups": {"home": side(home_lineup), "away": side(away_lineup)},
                "stage": "final", "group": None, "date": "2026-07-19",
                "kickoff": "2026-07-19T15:00:00-06:00", "venue": "Test Stadium",
                "score": {"home": 0, "away": 0, "shootout": None},
            }
        },
    }


# --- the four contract patterns ---------------------------------------------------


def test_schema_patterns_are_verbatim_copies_of_the_contract_defs():
    """(a) The DRIFT pin: the restated literals still equal the schema's own patterns."""
    schema = json.loads(COMMON_SCHEMA.read_text(encoding="utf-8"))
    for name, pattern in SCHEMA_PATTERNS.items():
        assert schema["$defs"][name]["pattern"] == pattern, (
            f"{name} drifted from contract/common.schema.json"
        )


@pytest.mark.parametrize(
    "name,compiled,valid",
    [
        ("TeamId", TEAM_ID_RE, "south-africa"),
        ("TeamCode", TEAM_CODE_RE, "mex"),
        ("MatchId", MATCH_ID_RE, "m001-mexico-south-africa"),
        ("PlayerId", PLAYER_ID_RE, "rangel-raul-mex"),
    ],
)
def test_the_runtime_gates_reject_a_trailing_newline_that_the_schema_literal_accepts(
    name, compiled, valid
):
    """(b) The DIALECT pin — precisely why two constants exist rather than one.

    Python's `$` also matches immediately before a trailing newline; ECMA-262, the
    dialect JSON Schema mandates, does not. A slug carrying a stray `"\\n"` would pass a
    `$`-terminated runtime gate here and then fail validation downstream.
    """
    assert compiled.match(valid), f"{name} rejects its own valid value"
    assert compiled.match(valid + "\n") is None, (
        f"{name}'s runtime gate accepts a trailing newline; it must use \\Z, not $"
    )
    # The schema literal, compiled as-is, demonstrates the laxity being guarded against.
    assert re.compile(SCHEMA_PATTERNS[name]).match(valid + "\n") is not None


# --- THE ACCEPTANCE CHECK ---------------------------------------------------------


def _fixture_player_ids() -> "set[tuple[str, str, str]]":
    """`{(playerId, printed name, teamCode)}` from every committed match bundle.

    Walks BOTH `players[]` and `metadata.lineups.*[]`. That is load-bearing: 59 of the
    155 ids are reachable ONLY through the lineups, including the 2-token-surname case
    `romero-gamarra-alejandro-par`, which appears in exactly one substitutes list. A
    `players[]`-only walk sees 96 ids and silently never tests the hardest one.

    A SET of triples rather than `{playerId: name}`. Keying on the id meant a second
    printed spelling of the same player — `"Raul RANGEL"` in `players[]` against
    `"Raul  RANGEL"` with a doubled space in the lineups — silently overwrote the first
    while the count stayed at 155, so one of the two spellings was never tested. That is
    exactly the `repr()`-invisible defect `PlayerSlugError` exists to localize.

    The `teamCode` comes from the bundle's own `metadata.{home,away}Team.teamCode`, NOT
    from the trailing segment of the expected id. Slicing it off the answer
    (`player_id.rsplit("-", 1)[1]`) made the acceptance check structurally unable to
    detect a wrong team code — the one component the story calls "on the critical path"
    and "not derivable from the printed name". Now the id's last segment is genuinely
    being predicted rather than supplied.
    """
    found: set[tuple[str, str, str]] = set()
    for path in MATCH_FIXTURES:
        doc = json.loads(path.read_text(encoding="utf-8"))
        sides = {
            side: doc["metadata"][f"{side}Team"] for side in ("home", "away")
        }
        code_by_team_id = {team["teamId"]: team["teamCode"] for team in sides.values()}
        # `or []`, NOT `get("players", [])`. `players` is `anyOf [array, null]` and the
        # default only fires when the KEY is absent — a bundle that carries an explicit
        # `null` (Story 1.18's FR-1 branch-coverage fixture) returns None and raises
        # `TypeError: 'NoneType' object is not iterable`. Same unguarded-nullable-container
        # class that was fixed six times in `test_fixtures.py`.
        for row in doc.get("players") or []:
            if isinstance(row, dict) and "playerId" in row and "playerName" in row:
                found.add(
                    (row["playerId"], row["playerName"], code_by_team_id[row["teamId"]])
                )
        for side in ("home", "away"):
            code = sides[side]["teamCode"]
            for section in ("starters", "substitutes"):
                for entry in doc["metadata"]["lineups"][side][section]:
                    found.add((entry["playerId"], entry["name"], code))
    return found


def test_the_committed_fixtures_expose_ids_unreachable_from_the_players_array():
    """The walk above is not paranoia — it is the only route to 59 of the 155 ids."""
    from_players: set[str] = set()
    from_lineups: set[str] = set()
    for path in MATCH_FIXTURES:
        doc = json.loads(path.read_text(encoding="utf-8"))
        from_players.update(
            row["playerId"] for row in doc.get("players") or [] if "playerId" in row
        )
        for side in ("home", "away"):
            for section in ("starters", "substitutes"):
                from_lineups.update(
                    e["playerId"] for e in doc["metadata"]["lineups"][side][section]
                )
    assert from_lineups - from_players, "lineups expose no id beyond players[]"
    assert "romero-gamarra-alejandro-par" in from_lineups - from_players


def test_the_caps_run_rule_reproduces_every_committed_fixture_player_id():
    """THE ACCEPTANCE CHECK (AC 2).

    Expected values are the committed fixtures' own ids — hand-authored by Story 1.1 and
    signed off by Story 2.3 — not values restated from the implementation. If this fails
    on even one id, the rule is wrong and the fixtures are ground truth.
    """
    fixture_ids = _fixture_player_ids()
    # 155 -> 207 when Story 1.18 added `data/fixtures/matches/m082-belgium-senegal.json`
    # for FR-1's branch coverage. The count is a REACH check — "the walk sees the whole
    # fixture set" — not the acceptance criterion; the acceptance criterion is the
    # zero-mismatch assertion below, and it still holds on every one of the 207. The number
    # is updated rather than loosened to a `>=`, because a silent DROP in reach is exactly
    # what this line exists to catch.
    assert len({player_id for player_id, _name, _code in fixture_ids}) == 207, (
        f"expected 207 distinct fixture player ids, found "
        f"{len({p for p, _n, _c in fixture_ids})}"
    )
    # Every (id, name, code) triple, so a second printed spelling of one id is tested too
    # rather than silently overwriting the first.
    mismatches = [
        (player_id, name, code, player_slug(name, code))
        for player_id, name, code in sorted(fixture_ids)
        if player_slug(name, code) != player_id
    ]
    assert mismatches == [], f"{len(mismatches)} fixture id(s) not reproduced: {mismatches}"


# --- the mutation check -----------------------------------------------------------


def _last_token_slug(name: str, team_code: str) -> str:
    """The REJECTED rule: "the last token is the surname".

    Defined here rather than shipped, so the mutation check is a real comparison against
    a real alternative instead of an assertion about a rule nobody wrote.
    """
    def kebab(text):
        folded = unicodedata.normalize("NFKD", text)
        ascii_only = folded.encode("ascii", "ignore").decode("ascii").lower()
        return re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")

    tokens = name.split()
    if len(tokens) == 1:
        return f"{kebab(name)}-{team_code}"
    return f"{kebab(tokens[-1])}-{kebab(' '.join(tokens[:-1]))}-{team_code}"


def test_the_rejected_last_token_rule_fails_the_fixture_reproduction():
    """The mutation check (Task 8.3).

    Mutating to the last-token rule MUST turn the acceptance check red. It differs on
    1,009 corpus entries and inverts every Korea Republic player.
    """
    fixture_ids = _fixture_player_ids()
    mismatches = [
        player_id
        for player_id, name, code in fixture_ids
        if _last_token_slug(name, code) != player_id
    ]
    assert len(mismatches) >= 26, (
        "the last-token rule reproduces the fixtures, so this mutation check proves "
        f"nothing; only {len(mismatches)} mismatch(es)"
    )
    assert "kim-seunggyu-kor" in mismatches


def test_a_collision_count_cannot_discriminate_between_the_two_candidate_rules():
    """Why the fixture reproduction is the acceptance check and uniqueness is not.

    Both rules yield perfectly unique ids over the fixture population, so a suite that
    asserted only "no collisions" would have shipped either one.
    """
    fixture_ids = _fixture_player_ids()
    expected = {player_id for player_id, _name, _code in fixture_ids}
    caps = {player_slug(name, code) for _pid, name, code in fixture_ids}
    last = {_last_token_slug(name, code) for _pid, name, code in fixture_ids}
    assert len(caps) == len(expected)
    assert len(last) == len(expected), (
        "the rejected rule collides on the fixtures, which would make uniqueness "
        "discriminating; it is not, and that is the point of this test"
    )


# --- the real corpus cases, each pinned -------------------------------------------


@pytest.mark.parametrize(
    "name,team_code,expected",
    [
        # Surname-FIRST. Every Korea Republic player prints this way; a rule that took
        # the last token would invert all 26 of them and every route to them.
        ("KIM Seunggyu", "kor", "kim-seunggyu-kor"),
        ("CASTROP Jens", "kor", "castrop-jens-kor"),
        # Given-first, the corpus majority.
        ("Raul RANGEL", "mex", "rangel-raul-mex"),
        # Multi-token surname — the case that lives only inside a substitutes list.
        ("Alejandro ROMERO GAMARRA", "par", "romero-gamarra-alejandro-par"),
        # Multi-token given name.
        ("Juan Jose CACERES", "par", "caceres-juan-jose-par"),
        # A period inside the surname; `"ST."` is `isupper()`, `_kebab` folds the dot.
        ("Dayne ST. CLAIR", "can", "st-clair-dayne-can"),
        ("Micky VAN DE VEN", "ned", "van-de-ven-micky-ned"),
        ("El Hadji Malick DIOUF", "sen", "diouf-el-hadji-malick-sen"),
        # --- the as-listed fallback, declared not hidden ---
        # Mononym: no split exists.
        ("ALISSON", "bra", "alisson-bra"),
        # All caps: the boundary is unknowable, so nothing is fabricated (AD-8).
        ("GABRIEL MAGALHAES", "bra", "gabriel-magalhaes-bra"),
        # No all-caps token at all: `"McKENNIE".isupper()` is False.
        ("Weston McKENNIE", "usa", "weston-mckennie-usa"),
    ],
)
def test_the_slug_rule_on_every_printed_name_grammar_the_corpus_uses(
    name, team_code, expected
):
    assert player_slug(name, team_code) == expected
    assert PLAYER_ID_RE.match(player_slug(name, team_code))


def test_the_as_listed_fallback_still_appends_the_team_code():
    """A two-segment slug validates clean as a TeamId and produces a dead route.

    That defect shipped once already (`son-heungmin` without its code), which is why the
    fallback branch is gated by `PlayerId` like the caps-run branch.
    """
    for name in ("ALISSON", "GABRIEL MAGALHAES", "Weston McKENNIE"):
        slug = player_slug(name, "bra")
        assert slug.endswith("-bra")
        assert PLAYER_ID_RE.match(slug)
        # Without the code it would still satisfy TeamId — the silent failure mode.
        assert TEAM_ID_RE.match(slug.rsplit("-", 1)[0])


def test_a_name_that_reduces_to_nothing_raises_a_typed_error_naming_it():
    with pytest.raises(PlayerSlugError) as excinfo:
        player_slug("...", "mex")
    assert "'...'" in str(excinfo.value)


# --- the cross-team repeat: the corpus's one real ambiguity ------------------------


def test_the_one_cross_team_name_repeat_resolves_to_two_distinct_players():
    """`Emiliano MARTINEZ` is Argentina #23 AND Uruguay #15 — two different people.

    Team code is part of the id, so this is not a collision. It is the single corpus case
    that proves the code must be there.
    """
    argentina = player_slug("Emiliano MARTINEZ", "arg")
    uruguay = player_slug("Emiliano MARTINEZ", "uru")
    assert argentina == "martinez-emiliano-arg"
    assert uruguay == "martinez-emiliano-uru"
    assert argentina != uruguay


def test_dropping_the_team_code_makes_the_cross_team_repeat_the_only_slug_collision():
    """The inverse assertion: without the code, these two people share one URL."""
    argentina = player_slug("Emiliano MARTINEZ", "arg").rsplit("-", 1)[0]
    uruguay = player_slug("Emiliano MARTINEZ", "uru").rsplit("-", 1)[0]
    assert argentina == uruguay == "martinez-emiliano"


def test_two_players_of_that_name_on_two_teams_resolve_without_collision():
    record = make_record(
        "m001-argentina-uruguay", "PMSR-M01-ARG-V-URU", "Argentina", "Uruguay",
        ([("Emiliano MARTINEZ", 23)], []),
        ([("Emiliano MARTINEZ", 15)], []),
    )
    codes = team_codes([record])
    resolved = resolve_players([record], codes, EMPTY_REGISTRY)
    assert resolved[("argentina", 23)] == "martinez-emiliano-arg"
    assert resolved[("uruguay", 15)] == "martinez-emiliano-uru"
    assert len(set(resolved.values())) == 2


# --- team codes --------------------------------------------------------------------


def test_team_codes_are_parsed_from_the_report_id_and_mapped_to_team_ids():
    record = make_record(
        "m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico", "South Africa",
        ([("Raul RANGEL", 1)], []), ([("Ronwen WILLIAMS", 1)], []),
    )
    assert team_codes([record]) == {"mexico": "mex", "south-africa": "rsa"}


def test_a_team_code_serving_two_teams_raises_naming_both():
    """A code shared by two teams silently merges two squads into one namespace.

    Constructed: measured 48 codes to 48 teams, exactly 1:1 in both directions.
    """
    records = [
        make_record("m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico",
                    "South Africa", ([("A NAME", 1)], []), ([("B NAME", 1)], [])),
        make_record("m002-morocco-canada", "PMSR-M02-MEX-V-CAN", "Morocco", "Canada",
                    ([("C NAME", 1)], []), ([("D NAME", 1)], [])),
    ]
    with pytest.raises(IdentityCollisionError) as excinfo:
        team_codes(records)
    message = str(excinfo.value)
    assert "'mex'" in message and "mexico" in message and "morocco" in message


def test_a_team_carrying_two_codes_raises_naming_both():
    records = [
        make_record("m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico",
                    "South Africa", ([("A NAME", 1)], []), ([("B NAME", 1)], [])),
        make_record("m002-mexico-canada", "PMSR-M02-MXX-V-CAN", "Mexico", "Canada",
                    ([("A NAME", 1)], []), ([("D NAME", 1)], [])),
    ]
    with pytest.raises(IdentityCollisionError) as excinfo:
        team_codes(records)
    assert "two codes" in str(excinfo.value)


def test_an_unparseable_report_id_raises_rather_than_guessing_a_code():
    record = make_record(
        "m001-mexico-south-africa", "NOT-A-REPORT-ID", "Mexico", "South Africa",
        ([("A NAME", 1)], []), ([("B NAME", 1)], []),
    )
    with pytest.raises(PrecomputeError):
        team_codes([record])


def test_the_committed_registry_maps_forty_eight_teams_to_forty_eight_codes():
    """The corpus-wide 1:1 assertion, against the committed artifact (Task 1.5)."""
    from pipeline.precompute import slug_registry
    from pipeline.precompute.identity import team_code_collisions

    assert len(slug_registry.TEAM_CODES) == 48
    assert len(set(slug_registry.TEAM_CODES.values())) == 48
    assert team_code_collisions(slug_registry.TEAM_CODES) == {}
    for team_id, code in slug_registry.TEAM_CODES.items():
        assert TEAM_ID_RE.match(team_id)
        assert TEAM_CODE_RE.match(code)


def test_at_least_six_committed_codes_are_not_derivable_from_the_team_name():
    """Why the lookup is mandatory rather than a derivation rule.

    Measured: `cpv`, `cuw`, `mar`, `ksa`, `esp` and `sui` each carry a letter their team's
    own slug does not contain, and `rsa`/`cod` are not the first three letters of
    anything. No string rule produces them, so a committed table is the only honest
    source.
    """
    from pipeline.precompute import slug_registry

    not_derivable = [
        (team_id, code)
        for team_id, code in slug_registry.TEAM_CODES.items()
        if set(code) - set(re.sub(r"[^a-z]", "", team_id))
    ]
    assert len(not_derivable) >= 6, not_derivable
    assert ("saudi-arabia", "ksa") in not_derivable

    # And the first-three-letters rule fails on more than that, including RSA and COD.
    first_three_fails = [
        (team_id, code)
        for team_id, code in slug_registry.TEAM_CODES.items()
        if code != re.sub(r"[^a-z]", "", team_id)[:3]
    ]
    assert ("south-africa", "rsa") in first_three_fails
    assert ("congo-dr", "cod") in first_three_fails


# --- resolution, and the three corpus-EMPTY OQ-4 cases ----------------------------


def test_resolution_keys_on_team_and_shirt_across_matches():
    records = [
        make_record("m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico",
                    "South Africa", ([("Raul RANGEL", 1)], []), ([("B NAME", 1)], [])),
        make_record("m002-mexico-canada", "PMSR-M02-MEX-V-CAN", "Mexico", "Canada",
                    ([("Raul RANGEL", 1)], []), ([("D NAME", 1)], [])),
    ]
    codes = team_codes(records)
    resolved = resolve_players(records, codes, EMPTY_REGISTRY)
    assert resolved[("mexico", 1)] == "rangel-raul-mex"
    # One player, two matches, one id — the whole point of the story (FR-17).
    assert sum(1 for k in resolved if k[0] == "mexico") == 1


def test_CONSTRUCTED_an_accent_folds_away_because_the_corpus_has_none():
    """OQ-4 case 1 — CORPUS-EMPTY (0 non-ASCII characters in 1,247 distinct names).

    Constructed on purpose. The NFKD fold is kept because the three *team* names
    `Curacao`, `Turkiye` and `Cote d'Ivoire` genuinely need it, and a future corpus could
    print an accented player name. No assertion anywhere claims a non-zero accent-strip
    count, because that count is zero.
    """
    assert player_slug("Julián QUIÑONES", "mex") == "quinones-julian-mex"
    assert player_slug("Édouard MENDY", "sen") == "mendy-edouard-sen"


def test_CONSTRUCTED_a_duplicate_normalized_name_within_a_team_raises_rather_than_tiebreaking():
    """OQ-4 case 2 — CORPUS-EMPTY (0 normalized name+team collisions over 5,392 entries).

    Constructed. Two players, one team, the same normalized name, different shirts.

    **There is no first-seen-shirt tiebreak, and this test is the statement of that.**
    AC 1's binding block rules it out — "an assertion that the count is 0, raising if it
    ever is not, NOT a first-seen-shirt tiebreak" — because on a corpus with zero such
    collisions a tiebreak could only ever fire on a defect, and quietly minting two ids
    out of one printed name is unfalsifiable downstream: every id unique, every pattern
    satisfied, and one of the two routes naming the wrong person. AC 4 row 2 and Task 3.4
    describe the tiebreak instead; that contradiction was ruled in favour of raising by
    Story 1.15's code review (Decision 1).
    """
    record = make_record(
        "m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico", "South Africa",
        ([("Raul RANGEL", 1), ("Raul RANGEL", 12)], []), ([("B NAME", 1)], []),
    )
    codes = team_codes([record])
    with pytest.raises(IdentityCollisionError) as excinfo:
        resolve_players([record], codes, EMPTY_REGISTRY)
    message = str(excinfo.value)
    # Both parties are named — never a bare "a collision occurred".
    assert "shirt 1" in message and "shirt 12" in message


def test_CONSTRUCTED_one_key_naming_two_players_raises_under_EITHER_input_order():
    """Resolution never silently picks a winner for a contested `(team_id, shirt)` key.

    Stated precisely, because the original form of this test could not fail: asserting
    `resolve_players(forward) == resolve_players(reversed)` proves nothing, since the
    function returns `dict(sorted(...))` and dict equality ignores insertion order —
    it passed against an implementation with no ordering discipline at all.

    The property that IS worth pinning is that a key claimed by two different names is a
    collision in both directions rather than a last-write-wins, so the answer can never
    depend on the order records happen to arrive in. Both parties are named either way.
    """
    forward = [
        make_record("m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico",
                    "South Africa", ([("Raul RANGEL", 1)], []), ([("B NAME", 1)], [])),
        make_record("m002-mexico-canada", "PMSR-M02-MEX-V-CAN", "Mexico", "Canada",
                    ([("Luis HERNANDEZ", 1)], []), ([("D NAME", 1)], [])),
    ]
    for ordering in (forward, list(reversed(forward))):
        with pytest.raises(IdentityCollisionError) as excinfo:
            resolve_players(ordering, team_codes(ordering), EMPTY_REGISTRY)
        message = str(excinfo.value)
        assert "rangel-raul-mex" in message and "hernandez-luis-mex" in message
        assert "m001-mexico-south-africa" in message and "m002-mexico-canada" in message


def test_CONSTRUCTED_the_same_player_across_two_matches_resolves_once_in_either_order():
    """The one sense in which "first seen wins" is true here: idempotence across records.

    One person, one shirt, two matches — one id, and the map is identical whichever order
    the records arrive in. This is FR-17's whole claim at its smallest scale.
    """
    forward = [
        make_record("m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico",
                    "South Africa", ([("Raul RANGEL", 1)], []), ([("B NAME", 1)], [])),
        make_record("m002-mexico-canada", "PMSR-M02-MEX-V-CAN", "Mexico", "Canada",
                    ([("Raul RANGEL", 1)], []), ([("D NAME", 1)], [])),
    ]
    reverse = list(reversed(forward))
    resolved = resolve_players(forward, team_codes(forward), EMPTY_REGISTRY)
    assert resolved[("mexico", 1)] == "rangel-raul-mex"
    assert sum(1 for key in resolved if key[0] == "mexico") == 1
    assert resolved == resolve_players(reverse, team_codes(reverse), EMPTY_REGISTRY)


def test_CONSTRUCTED_a_squad_number_change_across_matches_is_reported_not_merged():
    """OQ-4 case 3 — CORPUS-EMPTY (0 players wear more than one shirt; exactly {1: 1248}).

    Constructed. The resolution key is `(team_id, shirt_number)`, so the same person under
    two shirts produces two keys. On this corpus that is impossible; if it ever happens it
    is a dataset fact that needs a ruling, and the honest response is an OVERRIDES entry —
    not a silent merge, and not a guess about which shirt is canonical.
    """
    records = [
        make_record("m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico",
                    "South Africa", ([("Raul RANGEL", 1)], []), ([("B NAME", 1)], [])),
        make_record("m002-mexico-canada", "PMSR-M02-MEX-V-CAN", "Mexico", "Canada",
                    ([("Raul RANGEL", 12)], []), ([("D NAME", 1)], [])),
    ]
    codes = team_codes(records)
    with pytest.raises(IdentityCollisionError) as excinfo:
        resolve_players(records, codes, EMPTY_REGISTRY)
    # The same id would serve two keys — named with both shirts and both matches.
    assert "rangel-raul-mex" in str(excinfo.value)


def test_CONSTRUCTED_an_override_changes_the_slug_and_the_pin_follows_it():
    """AC 4's sixth row: the override mechanism, which ships EMPTY on this corpus."""
    record = make_record(
        "m001-brazil-south-africa", "PMSR-M01-BRA-V-RSA", "Brazil", "South Africa",
        ([("GABRIEL MAGALHAES", 4)], []), ([("B NAME", 1)], []),
    )
    codes = team_codes([record])
    assert resolve_players([record], codes, EMPTY_REGISTRY)[("brazil", 4)] == (
        "gabriel-magalhaes-bra"
    )
    registry = _Registry(overrides={pin_key("brazil", 4): "magalhaes-gabriel-bra"})
    resolved = resolve_players([record], codes, registry)
    assert resolved[("brazil", 4)] == "magalhaes-gabriel-bra"


def test_matches_and_teams_resolve_without_reminting_anything():
    record = make_record(
        "m001-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico", "South Africa",
        ([("A NAME", 1)], []), ([("B NAME", 1)], []),
    )
    assert resolve_matches([record]) == {"PMSR-M01-MEX-V-RSA": "m001-mexico-south-africa"}
    assert resolve_teams([record]) == {"mexico": "mexico", "south-africa": "south-africa"}


def test_a_malformed_match_id_is_caught_before_it_is_pinned():
    record = make_record(
        "m1-mexico-south-africa", "PMSR-M01-MEX-V-RSA", "Mexico", "South Africa",
        ([("A NAME", 1)], []), ([("B NAME", 1)], []),
    )
    with pytest.raises(PrecomputeError) as excinfo:
        resolve_matches([record])
    assert "MatchId" in str(excinfo.value)


def test_the_pin_key_has_exactly_one_serialization():
    """One form everywhere — the story's own three-different-spellings defect."""
    assert pin_key("argentina", 23) == "argentina#23"

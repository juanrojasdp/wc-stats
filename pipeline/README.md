# wc-stats extraction pipeline

Python extraction pipeline for FIFA World Cup 2026 Post Match Summary Reports (PMSR PDFs).

## Setup (two commands)

From the repo root, on Windows:

```
python -m venv pipeline/venv
pipeline\venv\Scripts\python.exe -m pip install -r pipeline/requirements.txt
```

Requires Python 3.13+ (developed and verified on 3.14.4). Dependencies are installed
with **pip** — this project does not use `uv` (AR-15).

`pipeline/venv/` is this pipeline's own environment. `spike/venv` is a frozen reference
from the exploration spike and must not be reused or modified.

## Verification mode (template-consistency gate)

Runs the standing template-consistency gate over a stratified venue × matchday sample of
a PMSR corpus:

```
pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir <corpus-dir>
```

The input directory is a required argument — no corpus path is hardcoded. It must be a **flat**
directory of `.pdf` files (subdirectories are not searched); each filename stem becomes that
report's id in the manifest, so stems must be unique. Nothing is parsed from the filename —
teams, venue, stage and date all come from the PDF's own cover page. The machine-readable
manifest is written to `work/verification/verification-report.json` (override with `--output`),
and a human-readable summary, grouped by venue and by matchday round, is printed to the console.

Add `--expect-reports N` to assert the corpus size, so a mistyped path cannot pass as a run:

```
pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir <corpus-dir> --expect-reports 104
```

Exit codes, so a CI job can tell a failed gate from a broken harness:

| code | meaning |
| --- | --- |
| `0` | clean gate — every sampled report checked, no deviations, no corpus gaps |
| `1` | gate failed — deviations and/or corpus gaps were recorded |
| `2` | the harness could not run (bad input directory, unwritable output) |

An **empty corpus is a failure, not a clean run**. The gate also reports `corpus_gaps` for any
matchday round with no report present, and any group holding fewer than its 6 fixtures leaves
those reports unassigned rather than guessing a matchday — a partial corpus cannot tell
"matchday 1" from "the first match of this team I happen to hold".

The gate is designed to be re-run cheaply by every later extraction story: each story registers
its own checks with the check registry in `pipeline/validate/checks.py` without modifying the
runner, the sample selection, or the report format. Registered today: `anchor-coverage` and
`metadata-probe` (Story 1.4); `shots-parse` (an off-palette marker fill surfaces as an
`unknown-rgb` deviation) and `shots-count-match` (a per-team marker/table disagreement surfaces
as a `count-mismatch` deviation carrying both counts) from Story 1.3;
`domain-a-completeness` plus `domain-a-counts` from Story 1.6 (see the Domain A section);
`marker-event-link-rate` from Story 1.5; `domain-b-completeness`, `domain-b-counts`,
`domain-c-completeness` plus `domain-c-counts` from Story 1.7 (see the Domains B & C section);
and `crosses-parse` plus `crosses-count-match` from Story 1.11 (same unknown-rgb /
count-mismatch semantics as the shots pair, against the crosses page's own delivery table).

## Batch ingestion

Runs every report in a corpus through the Extract phase, staging one Extraction Record per
report plus a run manifest:

```
pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir <corpus-dir>
```

| flag | meaning |
| --- | --- |
| `--input-dir` | directory holding the PMSR PDF corpus (required; flat, `.pdf` files only) |
| `--output` | where the run manifest is written (default `work/run-manifest.json`) |
| `--extracted-dir` | where Extraction Records are staged (default `work/extracted`) |
| `--force` | re-extract every report regardless of the idempotence keys |
| `--expect-reports N` | assert the corpus holds exactly N reports (use 104 for the full tournament) |

Exit codes, matching the verification gate's contract:

| code | meaning |
| --- | --- |
| `0` | every report `extracted` or `skipped-unchanged`, every Self-Validation passed, no orphan records |
| `1` | one or more reports `failed`, a Self-Validation failure, an `--expect-reports` mismatch, an empty corpus, or one or more orphan records |
| `2` | the harness could not run (bad input directory, unwritable output, `--output` inside `--extracted-dir`) |

An **empty corpus is a failure, not a clean run**, and a report that fails never aborts the
batch: the failure lands in that report's manifest entry as the exception class name plus
its message, and the run continues. The manifest holds **exactly one terminal entry per
discovered PDF** — `extracted | failed | skipped-unchanged` — and every entry is asserted to
carry one of those three terminal statuses before the manifest is written.

The console summary is printed **before** the manifest is written, so a run whose records
all staged correctly still reports its result even if the manifest itself cannot be written.

### Where things land

```
work/extracted/{match-id}.json   one Extraction Record per report (snake_case, internal staging)
work/run-manifest.json           the run's record of truth
```

Both are canonically serialized (sorted keys, UTF-8, LF) and written atomically. `work/` is
gitignored and fully regenerable — it is never the source of truth for anything shipped.
Records are internal staging, *not* contract artifacts: `snake_case` keys, no
`schemaVersion` stamp. camelCase binds only `/contract` and `/data`.

### Idempotence — what invalidates a skip

A record is reused only when **both** idempotence keys stored inside it still match:

- `pdf_content_hash` — SHA-256 of the source PDF's bytes
- `code_version` — SHA-256 over every `pipeline/**/*.py` (excluding `tests/`, virtualenvs,
  build trees and `__pycache__/`) **plus `pipeline/requirements.txt`**, so editing
  extraction code or bumping a pinned dependency invalidates every record automatically,
  while editing a test invalidates none

Deciding to skip reads the PDF's bytes once to hash them, but **never re-parses** it — that
is the difference between a ~126 s cold run and a ~3 s re-run over 104 reports.

A record that is missing, unreadable, malformed, written under an older `record_version`, or
whose `match_id` disagrees with its own file name counts as **absent**, so the report is
re-extracted — never skipped on the strength of a file that cannot prove what produced it.
`--force` bypasses the keys; a forced re-run over an unchanged corpus produces
byte-identical records.

### The shots domain and marker-count Self-Validation (Story 1.3)

Every Extraction Record now carries `domains.shots`, extracted by the shared filter chain
in `pipeline/markers/` (pitch-frame detect → circle-geometry filter → legend-row exclusion
→ exact-RGB outcome keying, in that mandatory order — geometry before color, because the
"incomplete" dark blue is reused by table-header rectangles):

```jsonc
"shots": {
  "shot_events": [        // sorted by team_id, page_index, pdf_y, pdf_x
    { "team_id": "mexico", "x": 87.31, "y": 44.12, "outcome": "goal", "own_goal": false,
      "source": { "page_index": 13, "pdf_x": 123.45, "pdf_y": 234.56 } }
  ],
  "shootout_attempts": null,   // no per-attempt shootout table exists in the corpus
  "counts": { "home": { "markers": 16, "table": 16 },
              "away": { "markers": 3,  "table": 3 } }
}
```

`x`/`y` are 0-100 floats in the AD-6 frame (x = 100 at the opponent's goal line, y = 0 at
the attacker's left touchline); `source` keeps the pdf-space position on the map page for
Story 1.5's marker-event linking. An off-palette marker fill aborts that report's
extraction (`UnknownRgbError`, carrying the rounded RGB and the page) — never a silently
dropped marker, and overlapping markers are never deduped.

**Self-Validation** compares each team's marker count to the row count of the tabular
attempts table (which spans one or *more* pages — 37 of the 104 real reports overflow
onto a second table page). The comparison is exact and binary. A mismatch is data, not an
exception: the record is still written with `self_validation.result: "fail"` and both
counts, the manifest entry mirrors the verdict in `self_validation` and copies the failing
checks (with both counts) into `self_validation_failures`, and the run fails (exit 1)
without inflating `failed_count` — the same precedent orphan records follow.

### The match-metadata domain — Domain A (Story 1.6)

Every Extraction Record also carries `domains.match_metadata`: the probed cover block
normalized per AD-7 plus the full lineup-page parse (`pipeline/extract/domain_a.py`).
The probe's raw `metadata` block stays verbatim beside it — the cover is never re-parsed.

```jsonc
"match_metadata": {
  "stage": "group",                 // closed AD-3 enum: group|r32|r16|qf|sf|third-place|final
  "group": "a",                     // null for every knockout tie
  "venue": "Mexico City Stadium",   // as printed; must be one of the 16 corpus venues
  "date": "2026-06-11",             // ISO 8601
  "kickoff": "2026-06-11T13:00:00-06:00",  // venue-local + fixed offset (pipeline/extract/venues.py)
  "teams": { "home": "Mexico", "away": "South Africa" },   // names pass through as-is
  "score": { "home": 2, "away": 0, "shootout": null },     // shootout line verbatim when printed
  "lineups": {
    "home": {                       // away mirrors it
      "formation": "4-1-2-3",
      "starters": [                 // page order; substitutes: same entry shape
        { "name": "Raul JIMENEZ", "shirt_number": 9, "position": "fw",
          "goals": [ { "minute": 67, "stoppage_minute": null } ],
          "own_goals": [], "cards": [],
          "substituted_on": null,
          "substituted_off": { "minute": 76, "stoppage_minute": null } }
      ]
    }
  }
}
```

The lineup page is a y-aligned table of two independent team columns; each minute
marker's *kind* is carried by the small vector glyph beside it, classified by exact fill
RGB over the closed six-color legend (goal, own goal, sub-on, sub-off, yellow card, red
card — enumerated from all 2,535 corpus markers). The red-football glyph is an own goal:
corpus-wide, `team score == own goal glyphs + opponent own-goal glyphs`, which is one of
the six Self-Validation checks. No player ids and no matchday round here — identity is
Story 1.15's, matchday is corpus-level.

Everything unknown fails that report loud with a typed error (`pipeline/extract/errors.py`):
a missing §6 field names the field (`MissingFieldError`), an unknown stage wording, venue
string, position code or glyph fill is never fuzzy-matched (`UnknownStageError`,
`UnknownVenueError`, `UnknownPositionError`, `UnknownMinuteGlyphError`), and a row that
resists the column grammar is `LineupParseError` / `LineupCountError`.

**Self-Validation** appends six binary checks per report (never loosened, SM-C1):
exactly 11 starters per team, exactly one starting goalkeeper, shirt numbers unique per
team, formation outfield sum = 10, every sub-on paired with a sub-off at the same stamp,
and goal/own-goal reconciliation against the cover score. A failed check is data: the
record stages with `self_validation.result: "fail"` and the run exits 1, same as shots.

The FR-15 gate gains `domain-a-completeness` (typed extract failures → `probe-failure`,
except an unknown minute-glyph fill, which shares the shots checks' `unknown-rgb` bucket)
and `domain-a-counts` (failed Self-Validation checks → `count-mismatch`); a missing
lineup page stays anchor-coverage's `missing-anchor` finding.

### Key Statistics and tactical identity — Domains B & C (Story 1.7)

Every Extraction Record also carries `domains.key_statistics` (`pipeline/extract/domain_b.py`)
and `domains.tactical_identity` (`pipeline/extract/domain_c.py`), both raw and locale-neutral
per AD-7 (plain ints/floats, no `%`/`km`/`m` strings):

```jsonc
"key_statistics": {
  "home": {                       // away mirrors it — the contract's 19-field checklist
    "possession": 57.1, "goals": 2, "expected_goals": 1.78,
    "shots": 16, "shots_on_target": 4, "passes": 547, "passes_completed": 495,
    "pass_completion": 90.0, "completed_line_breaks": 105, "defensive_line_breaks": 10,
    "receptions_in_final_third": 117, "crosses": 13, "ball_progressions": 23,
    "defensive_pressures": 170, "direct_pressures": 26, "forced_turnovers": 31,
    "second_balls": 56, "distance_covered": 107.3, "sprint_distance": 5.3
  },
  "contested_possession": 6.8     // the possession bar's match-level third share
},
"tactical_identity": {
  "home": {                       // away mirrors it
    "phases_in_possession":  { "build_up_unopposed": 47.0, /* ...8 phases... */ },
    "phases_out_of_possession": { "high_press": 9.0, /* ...9 phases... */ },
    "defensive_block": { "high": 7.0, "mid": 25.0, "low": 11.0 },  // projection of the
                                  // same three parsed block phases — never re-parsed
    "line_height_team_length": {  // per-phase pitch panels, three measures each
      "in_possession":     { "build-up-low": { "line_height": 19.0, "team_length": 40.0,
                                               "team_width": 56.0 }, /* 2 more panels */ },
      "out_of_possession": { /* high-block-press | mid-block | low-block */ }
    }
  }
}
```

The Key Statistics page prints home values left of each row label and away values right of
it (classified relative to the row's own label position, never fixed x-bands); the
Possession row is a three-value bar read left-to-right as home/contested/away. The row-label
set is closed: an unknown row is `UnknownStatisticError`, a missing row `MissingFieldError`,
a wrong-type value `MalformedFieldError` naming the field and raw text, and the printed
left/right team names are asserted against the probed home/away (a swapped page raises
`StatisticsParseError` rather than staging every stat under the wrong team).

The line-height pages carry no textual key for what each printed metre value measures — the
key is drawn: each value sits on the arrow badge of a measurement bracket, and the bracket
geometry classifies it (verified on all 104 reports × 4 pages × 3 panels = 3,744 values):
horizontal rails → `team_width` (the team block's x-extent); vertical rails reaching a pitch
goal-line edge → `line_height` (own goal line to the block's nearest edge); the other
vertical bracket → `team_length`. An unclassifiable value is `LineHeightParseError`, never a
guess. Defensive Block percentages are **independent per-phase rates that do not sum to
100** (mex_rsa: 43/49) — there is deliberately no block-sum check.

**Self-Validation** appends four recorded binary checks: `key-statistics-possession-sum`
(home + contested + away within ±0.2 of 100 — three 1-decimal roundings drift at most
±0.15), `key-statistics-internal-consistency` (on-target ≤ shots, completed ≤ passes,
direct ≤ total pressures, printed completion within ±1.0 of the computed ratio),
`key-statistics-shots-reconciliation` (the page's printed attempts vs the attempts-table
row count — two independent sources of one fact; the table, never the marker count), and
`tactical-metre-bounds` (every metre value in (0, 105]).

The FR-15 gate gains `domain-b-completeness` / `domain-c-completeness` (typed extract
failures → `probe-failure`, class name prefixed) and `domain-b-counts` / `domain-c-counts`
(failed Self-Validation checks → `count-mismatch`); missing section pages stay
anchor-coverage's `missing-anchor` finding.

### Orphan records

`work/extracted/` is keyed by match id while the batch iterates by PDF, so the two can
drift: rename a source PDF or correct a mis-typed match number and the run writes a record
under the new id while the old one stays on disk. Any record the run neither wrote nor
skipped is listed in `orphan_record_paths` and named in the console summary — and **left on
disk**, because deleting files a run did not create is destructive. Interrupted atomic
writes leave a `.tmp` file behind; those are reported as orphans too, rather than
accumulating unseen in a directory that is only ever scanned for `.json`.

An orphan never inflates `failed_count` — it is not a failed report — but it **does fail the
run** (`result: "fail"`, exit 1). An orphan is the phantom-match hazard this scan exists to
surface, and a hazard that exits 0 is one CI can never be taught to catch.

Consumers must therefore read the records the **manifest** names, not the directory listing
(AD-8). This binds Story 1.15's precompute in particular: an orphan from a superseded run
would otherwise enter the dataset as a phantom match.

## Layout

```
pipeline/
  discover/   text-anchored page discovery, anchor registry, corpus metadata probe
  extract/    tabular per-domain extractors (Domains A, B and C today; Stories 1.8-1.10
              follow the same convention) + the committed venue -> UTC-offset table
  ingest/     batch orchestration, run manifest, idempotence, per-report Extract, CLI
  markers/    shared pitch-map filter chain + map parser family (shots + crosses today;
              defensive actions, offers/movement reuse it in Stories 1.12-1.13)
  validate/   check registry, sample selection, verification runner, CLI
  tests/      pytest suite
```

## Tests

From the repo root, using the venv interpreter explicitly:

```
pipeline\venv\Scripts\python.exe -m pytest pipeline/tests
```

Or activate the venv first, after which the bare `python` form works:

```
pipeline\venv\Scripts\activate
python -m pytest pipeline/tests
```

A bare `python -m pytest pipeline/tests` **without** activating the venv will fail with
`ModuleNotFoundError: No module named 'pymupdf'` — the system interpreter has none of the
pinned stack installed.

Tests are deterministic and offline. Real-PDF tests use the permanent ground-truth fixture
`spike/mex_rsa.pdf`; set-cover, matchday-derivation, and report-format tests use synthetic
fixtures and need no PDFs.

## Marker–event linking (Story 1.5)

Every shots-map marker is joined to its attempts-table row by digit-glyph proximity: the
map prints each attempt's 1-based ordinal as white text ON its marker, and the ordinal
indexes the table's printed row order per side (there is no number column in the table;
multi-page tables concatenate in anchored page order). A link is accepted only when the
nearest digit word sits within the marker radius, the ordinals form a bijection into the
row range, and the row's Outcome label maps onto the marker's RGB-keyed outcome via the
contract's `x-maps-to-outcome`. A marker failing any of those is retained with
coordinates and outcome, carries `linked: false` with null joined fields, and fails that
report's Self-Validation (`shots-link-rate`, binary, never loosened).

**Minute/stoppage caveat (defers to Story 1.16):** the table's Time column prints
first-half stoppage as plain cumulative minutes — the ground-truth report's home rows run
`…41, 41, 46, 48, 45, 47, 51…`, where 48 = 45+3 *precedes* 45, so only row order reveals
the period. Records therefore store `time_raw` verbatim (plus `ordinal`, which preserves
the row order); the split into the contract's `MinuteStamp {minute, stoppageMinute}`
needs period inference and is deliberately not attempted here.

**xG:** `expected_goals` is always `null` — PMSR prints xG only as a team total; the
shots event table has no xG column (verified across all 104 reports; contract
`$comment` on `ShotEvent.expectedGoals`). A per-shot xG source is an AD-14 change
request, not an extractor gap.

## The crosses domain (Story 1.11)

Every Extraction Record also carries `domains.crosses`, extracted by the same shared
filter chain with crosses tuning (`pipeline/markers/crosses.py`). The section is ONE page
per team — pitch map, two-swatch legend, stat panels and a per-player delivery-aggregate
table together (all 208 corpus pages):

```jsonc
"crosses": {
  "cross_events": [       // sorted by team_id, page_index, pdf_y, pdf_x
    { "team_id": "mexico", "x": 89.32, "y": 26.41, "completed": false,
      "delivery_type": null,
      "source": { "page_index": 17, "pdf_x": 86.31, "pdf_y": 147.66 } }
  ],
  "cross_table_rows": {   // the per-player aggregate table, staged verbatim per side
    "home": [ { "shirt_number": 25, "player_name": "Roberto ALVARADO",
                "deliveries": { "inswing": 2, "outswing": 0, "driven": 0,
                                "lofted": 0, "cutback": 0, "push_cross": 0 },
                "total_attempted": 2 } ]
  },
  "counts": { "home": { "markers": 10, "table": 10 },
              "away": { "markers": 7,  "table": 7 } }
}
```

Crosses tuning, measured on the full corpus: markers are 7.4 pt circles in exactly two
fills — orange `(0.96, 0.74, 0.0)` = attempted-not-completed, blue `(0.18, 0.3, 1.0)` =
completed (`completed: bool`; the contract has no CrossOutcome enum) — and the 9.0 pt
strokeless legend swatches sit INSIDE the pitch rect, excluded by the size window (a
2-color legend can never reach `legend_min_colors`). Two corpus quirks are decoded, not
tolerated: real touchline crosses print centers up to 0.35 pt outside the frame
(`pitch_margin_pt=1.0` admits them; coordinates clamp into [0, 100]), and 16 pages render
one event as an orange AND a blue marker at the bit-identical rect — collapsed to one
completed event (real same-spot pairs always differ in position or share a color, and are
never deduped).

**No linking pass exists for crosses**: the table is per-player aggregates with no
ordinal glyphs on markers, so `delivery_type` is `null` per event and the rows are staged
under `cross_table_rows` for later work. The contract's per-event
`playerId`/`playerName`/`at`/`deliveryType` requirements are unfulfillable from this page
— an AD-14 emission gap ledgered in `deferred-work.md` for Story 1.16.

**Self-Validation** (`crosses-marker-count`, exact and binary) compares each team's
event count to the sum of the table's Total Attempted column — the page's own tabular
total (== the printed Attempted panel on 208/208 pages), never Key Statistics `crosses`
(that Domain B scalar counts set-play crosses too; this page is open play only — M01
prints 13/8 there vs 10/7 here).

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
`crosses-parse` plus `crosses-count-match` from Story 1.11 (same unknown-rgb /
count-mismatch semantics as the shots pair, against the crosses page's own delivery table);
`defensive-actions-parse` plus `defensive-actions-count-match` from Story 1.12 (the
count check covers the forced-turnover map only — see the defensive-actions section for
why the possession-regain map has no printed counterpart to check against);
and `domain-g-completeness` plus `domain-g-counts` from Story 1.10 (see the Domain G
section — parse, typing and join failures land in `probe-failure` with the typed class
name prefixed, so join integrity is localizable per player, side and page family);
`receiving-parse` plus `receiving-count-match` from Story 1.13 (one prefix covering BOTH
receiving page families, which share one payload — the count check re-runs all seven
receiving reconciliations, including the two cross-domain ones when Domain G is
available; see the receiving section); and `goalkeeping-completeness` plus
`goalkeeping-counts` / `set-plays-completeness` plus `set-plays-counts` from Story 1.9
(see the Domains E & F section — an off-palette distribution marker is `unknown-rgb`, the
same as shots, and every other typed failure is a `probe-failure` naming its class); and
`pass-network-completeness` plus `pass-network-counts` from Story 1.14 (see the
pass-network section — the completeness check is where matrix-endpoint join integrity
lands, and where the page's two standing NEGATIVE assertions surface if the template ever
starts drawing a pitch or markers).

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
  extract/    tabular per-domain extractors (Domains A, B, C, E, F and G, the momentum
              series, and the pass network — which is a printed adjacency MATRIX rather
              than a table of rows, and lives here because it joins Domain A's lineups and
              the page has no pitch geometry at all; the remaining domains follow the same
              convention) + the committed venue -> UTC-offset table
  ingest/     batch orchestration, run manifest, idempotence, per-report Extract, CLI
  markers/    shared pitch-map filter chain + the page-family parsers built on it (shots,
              crosses, defensive actions, and receiving — which turned out to draw no
              markers at all and stages values, but composes the chain as its
              template-revision tripwire; see "The receiving domain")
  precompute/ AD-9's SECOND phase — cross-match identity resolution, the committed slug
              registry, and the normalized spine. The only phase that is global rather
              than per-report, and the only one that reads no PDF at all
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

## The defensive-actions domain (Story 1.12)

Every Extraction Record also carries `domains.defensive_actions`, extracted by the same
shared filter chain with defensive-actions tuning
(`pipeline/markers/defensive_actions.py`). The section is ONE page per team, and that page
carries **two** stroked pitch panels (all 208 corpus pages):

```jsonc
"defensive_actions": {
  "defensive_action_events": [   // sorted by team_id, action_type, page_index, pdf_y, pdf_x
    { "team_id": "mexico", "action_type": "forced-turnover",
      "x": 97.43, "y": 59.57, "contest_type": null,
      "source": { "page_index": 24, "panel": 0, "pdf_x": 141.32, "pdf_y": 233.35 } }
  ],
  "regain_table_rows": {         // the per-player regains table, staged verbatim per side
    "home": [ { "shirt_number": 1, "player_name": "Raul RANGEL",
                "total_possession_regains": 6 } ]
  },
  "counts": {
    "home": { "forced_turnover":   { "action_type": "forced-turnover",
                                     "markers": 31, "printed_total": 31,
                                     "table": 31 },
              "possession_regain": { "action_type": "possession-regain",
                                     "markers": 47, "printed_total": 37,
                                     "table": null } }
  },
  "warnings": [ "defensive-actions: no marker-count check recorded for ..." ]
}
```

`teamId` is the **DEFENDING** team — the team the anchor names. Mechanically the same
`team_slug` call the crosses parser makes, semantically the opposite end of the event.

**Two panels, all but equal in area.** `Forced Turnovers` (left) and `Possession Regain`
(right) measure 61,168.1435 and 61,168.1451 pt², so `detect_pitch_frame`'s `max` silently
kept only the right one. Story 1.12 added a sibling `detect_pitch_frames` returning every
qualifying stroked rect in drawing order and re-expressed `detect_pitch_frame` over it;
the two are proven identical on all 5,448 corpus pages, with the shots and crosses
payloads byte-identical over all 104 reports.

**The family is not keyed by colour.** All 20,169 corpus markers share ONE fill,
`(0.18, 0.3, 1.0)` — the blue the shots palette calls `incomplete` and the crosses palette
calls `completed`. The marker's family comes from its panel's printed **title** (AD-8:
text-anchored, never "the left panel is forced turnovers"). `key_outcomes` stays in the
chain as the FR-11 assert-on-unknown seam, so a second fill inside a panel aborts the
report with its RGB and page rather than being typed as a defensive action.

Tuning, measured on the full corpus: markers are 8.871 × 8.865 pt, and the 9.0 pt
strokeless bullet swatches share their exact blue — a 0.13 pt separation, so
`marker_max_pt = 8.95` sits inside that gap and is never rounded to 9.0. `marker_min_pt =
8.5` excludes the white penalty (1.479 pt) and centre (2.957 pt) spots drawn *inside* the
panels, which would otherwise abort every report on an unknown white fill. Each panel's
four corner arcs are stroke-only Beziers of the marker's exact width — only the `fill is
None` test excludes them. `pitch_margin_pt = 0.5` admits the corpus' maximum 0.296 pt
overshoot of a marker centre beyond its panel edge.

**No linking pass exists**: zero digit glyphs print inside either panel and the page
carries no per-event rows, so `contest_type` is `null` per event. Only two of the
contract's four `DefensiveActionType` values are pitch maps at all — `block` and
`possession-contest` are aggregate panels with no coordinates.

**Self-Validation** (`defensive-actions-marker-count`, exact and binary) covers the
**forced-turnover** map only: its marker count equals the page's own printed
`Forced Turnovers` headline total on 206 of 208 corpus pages. The **possession-regain**
map records a documented absence instead (`"table": null`, no check, one per-report
warning): its marker count matches no number printed on the page and no ±1 linear
combination of them, differing from the printed `Possession Regained` total by −3..+36
across the corpus. Both families' printed headline totals are staged as `printed_total`
regardless, so that delta stays on the record as evidence; only a family with an
established counterpart promotes its total to `table`, which is what the check keys on. That printed total and the per-player `Total Possession Regains` column
sum agree with each other on 208/208 pages, so they consistently count something the map
does not plot — checking the map against either would manufacture 208 false failures, and
checking it against its own marker count would be a tautology.

**Two corpus pages genuinely disagree with themselves** (`PMSR-M19-ARG-V-ALG` away: 39
markers drawn, 40 printed; `PMSR-M58-TUN-V-NED` away: 33 drawn, 34 printed). Both were
verified by rendering the page and counting: the PDF really draws one marker fewer than
its own headline claims. The check is exact and never loosened (SM-C1, AD-8), so those two
records write with `self_validation: "fail"` and the batch run reports FAIL (exit 1)
without inflating `failed_count`.

**Adjudicated (code review, 2026-07-25): the standing FAIL is accepted as the intended
signal.** From Story 1.12 onward a full-corpus `python -m pipeline.ingest.batch` exits 1
by design. The clean-run baseline is `extracted 104 / failed 0 / corpus_gaps 0 /
orphan_record_paths 0` with **exactly two** self-validation failures, both
`defensive-actions-marker-count` on the away side of `PMSR-M19-ARG-V-ALG` and
`PMSR-M58-TUN-V-NED`. Verification steps must assert that baseline rather than a zero
exit code; a third failing report means the discrepancy is systematic and re-opens the
ruling. The FR-15 gate is unaffected.

## The receiving domain (Story 1.13) — **this family has no events**

Every Extraction Record also carries `domains.receiving`, extracted by
`pipeline/markers/receiving.py` from the two page families `Offering to Receive {team}`
and `Movement to Receive {team}` (one page per team each, 208/208 corpus pages per
family).

**Neither page is a pitch map.** Both are dashboards. Measured over all 104 reports /
416 receiving pages: there is **no marker, no coordinate, no per-event row and no ordinal
glyph anywhere in the family**, so **no `ReceivingEvent` row is producible and none is
fabricated**. This module therefore stages *values*, not events, and Story 1.16 can only
emit `events.receiving: null` (filed as an AD-14 emission blocker; it is strictly harder
than Story 1.11's `CrossEvent` blocker, which at least yields real coordinates). Read the
module docstring before assuming a scatter parser and going looking for the bug.

```jsonc
"receiving": {
  "offers": {
    "home": { "team_id": "mexico", "type": "offer",
              "total_offers_made": 424, "total_offers_received": 166,
              "offers_final_third": 134, "offers_middle_third": 212,
              "offers_defensive_third": 78,
              "offers_inside_shape": 213, "offers_outside_shape": 211,
              "most_offers": { "value": 54, "player_name": "Julian QUINONES",
                               "position": "LEFT WINGER" },
              "table_rows": [ { "shirt_number": 1, "player_name": "Raul RANGEL",
                                "offers_made": 13, "offers_received": 4,
                                "made_received_pct": 30.8 } ] }
  },
  "movement": {
    "home": { "team_id": "mexico", "type": "movement", "total_movements": 309,
              "by_phase": { "final_third": 65, "progression": 96, "build_up": 176 },
              "by_third_and_type": [   // 15 cells: printed third order, then type
                { "pitch_third": "final-third", "movement_type": "in-behind",
                  "count": 76 } ],
              "top_ranked_players": [ { "movement_type": "in-front", "shirt_number": 6,
                                        "player_name": "Erik LIRA", "movements": 25 } ] }
  },
  "counts": { "home": { "offers": { ... }, "movement": { ...,
                        "donut_slice_table": null, "phase_partition_table": null } } }
}
```

`teamId` is the **RECEIVING** player's team (`ReceivingEvent`'s own `$comment`) — the team
the anchor names. Mechanically the same `team_slug` call every other family makes,
semantically the opposite end of the event.

**The offers page.** Four qualifying stroked rects, **two** distinct panels: the right
panel additionally carries two stroke+fill rects of bit-identical geometry (the raster
shape overlay's border), so the parser de-duplicates by rounded geometry — per-family
tuning, not a chain edit. Each panel is typed from **its own printed title**
(`Offers Made Inside Shape` / `Offers Made Outside Shape`), never by x order, and its
shape badge is then read as the unique digit word inside that typed panel — so the
inside/outside assignment is text-anchored end to end. The five KPI values are each read
as the integer printed above its own label, centred on it (`Offers Made in Defensive
Third` wraps onto two lines, and its anchor is the first line only). The per-player table
is x-restricted to the region derived from the header's own `#`: the left KPI column
prints its value **0.8 pt** from the first table row's y — inside `table_lines`' 3 pt
tolerance — so an unrestricted rule glues two KPI values into the first player row. Names
are gathered from the name x-band across neighbouring lines, because four corpus pages
print a three-line name straddling its numeric row.

**The 11 dots are asserted, not extracted.** Each offers panel holds exactly 11 filled
8.229 pt circles in one fill `(0.18, 0.3, 1.0)`, and their positions relative to their own
panel are identical between the two panels on 208/208 pages *and* across every team page —
a static formation template carrying zero per-report information. Staging them would put 22
meaningless rows in every record and invite a consumer to render them as positions. But
dropping the chain would leave the one page in this family with pitch-panel geometry
unguarded, and silence is the worst outcome, so the full chain runs and **asserts**: 11
dots per panel, one known fill (`key_outcomes` is the FR-11 assert-on-unknown seam), and
positions equal across panels. That census is the template-revision tripwire, and it is
what makes "reuse the chain, assert on unknown RGB" true here rather than a formality.
`exclude_legend_rows` is a no-op by construction (one fill, so no y-bucket reaches
`legend_min_colors`) and is kept in the production path anyway. `marker_min_pt = 8.0`
excludes the in-panel white penalty (1.371 pt) and centre (2.743 pt) spots, which would
otherwise abort every report on a white fill.

**The movement page.** One titled stroked panel (`Movement Types Pitch Third`) holding
**zero** markers: it is a pitch split into three thirds, each carrying a five-row
horizontal bar chart. Its own rotated `DIRECTION` label is asserted before anything is read
off it — no coordinate is produced here, so AD-6's formula pair never runs, but a
re-oriented panel would silently swap `final-third` and `defensive-third` on every grid row
while every reconciliation still passed. The rotated `FINAL`/`MIDDLE`/`DEFENSIVE THIRD`
labels assign each row its third (text-anchored, never "top band = final third"); they
extract 6-7 pt *left* of the panel's own x0, which is also why the Top Ranked Players
table's right bound comes from its header's last column and not from the panel edge. The
grid is read label-anchored rather than by visual row, because the panel prints 33
axis-tick digits beside the 15 values and the corpus offsets a value up to 3 pt from its
own label's line.

Movement-type labels resolve through the frozen `MOVEMENT_LABEL_TO_ENUM` to the contract's
kebab codes. **`no-movement` is the contract's sixth value and never appears on this
page** — reconciliation #8 (below) proves the grid is the five-type sum and never the
six-type sum; it exists only per-player, on Domain G's Offers & Receptions page. Record
keys stay snake_case throughout; the kebab code travels as a *value*.

**Self-Validation: five page-internal check ids plus two cross-domain, all exact and
binary with both operands always recorded.** Nine reconciliations were measured
corpus-wide and every one holds exactly:

| # | reconciliation | check id | result |
| --- | --- | --- | --- |
| 1 | final + middle + defensive == total made | `receiving-offers-thirds-sum` | 208/208 |
| 2 | inside + outside shape == total made | `receiving-offers-shape-sum` | 208/208 |
| 3 | Σ table `offers_made` == total made | `receiving-offers-table-sum` (`column: offers_made`) | 208/208 |
| 4 | Σ table `offers_received` == total received | `receiving-offers-table-sum` (`column: offers_received`) | 208/208 |
| 5 | Σ the 15 grid counts == total movements | `receiving-movement-grid-total` | 208/208 |
| 6 | total made == Σ Domain G `in_possession.total_offers` | `receiving-offers-domain-g` | 208/208 |
| 7 | total received == Σ Domain G `offers_received` | `receiving-offers-domain-g` | 208/208 |
| 8 | grid per-type total == Σ Domain G `offers_by_movement_type`, each of the FIVE | `receiving-movement-domain-g` | 208/208 |
| 9 | printed `%` == `round(100 × received / made, 1)` | `receiving-offers-table-pct` | 3,208/3,208 rows, worst deviation **0.0 pp** |

3 and 4 are emitted as two checks with one operand pair each: a merged check could not say
which column failed. Reconciliation 9 carries the family's one crash branch — **81 corpus
rows print `offers_made == 0`** (and print `0%` beside it), where the ratio is undefined;
the check skips exactly those rows and records how many, never dividing and never coercing
a value into existence. The two cross-domain families are computed at the
`extract_report.py` seam, where Domain G's payload is in hand; if it is unavailable they
emit **nothing** rather than a failing check (one root cause, one finding).

**Two documented absences take AC 2's absence branch** — recorded as `null` counterparts in
`counts` plus one warning per report each, and **no check at all**, because
`aggregate_self_validation` is strictly binary and would read a "not-applicable" check as a
failure of every record in the corpus:

- **The donut slice values are raster-only.** The three phase donuts and the
  All-Movement-Types donut are images; exactly one text word is recoverable per donut — its
  centre total — so no independently printed per-type total exists to check against. The
  grid is the counterpart that does exist, and it reconciles exactly.
- **The three per-phase totals are NOT a partition.**
  `(final + progression + build_up) − total_movements` ranges **−48..+314** and is zero on
  only **3 of 208** pages. They are staged verbatim and **never summed into a check** —
  the same family as `InPossessionPhase`'s "independent rates, never normalize" warning.

**Gate checks** (FR-15): `receiving-parse` (an off-palette decoration fill →
`unknown-rgb`; every other typed failure raises for the runner to isolate) and
`receiving-count-match` (any failing reconciliation → `count-mismatch`, one deviation per
failing team and check id, both operands in the specifics). One prefix covers both page
families because they share one payload — and because `offers-count-match` is
`test_checks_registry.py`'s deliberately-unclaimed placeholder id, which `register_check`
would refuse as a duplicate.

## Per-player performance and physical data — Domain G (Story 1.10)

Every Extraction Record also carries `domains.player_stats`, extracted by
`pipeline/extract/domain_g.py` from four page families, one page per team each:
`In Possession - Distributions`, `In Possession - Offers & Receptions`,
`Out of Possession` and `Physical Data`. All eight anchors were already registered by
Story 1.2 — no new `AnchorSpec` was needed — and each resolves to exactly one page on
all 104 reports (832/832; the assertion stays anyway, because Story 1.3's two-page
attempts table is why the rule exists).

```
"player_stats": {
  "home": [
    {"name": "Raul RANGEL", "shirt_number": 1, "position": "gk",
     "in_possession":     {...17 fields, incl. offers_by_movement_type {...6}},
     "out_of_possession": {...15 fields},
     "physical":          {...9 fields}}, ...
  ],
  "away": [ ... ]
}
```

Values are raw and locale-neutral (AD-7): counts are `int`, percentages `float` on the
0-100 scale, distances `float` metres, `top_speed` `float` km/h — no `%`, `m` or `km/h`
strings anywhere. Keys are staging snake_case with no `/contract` dependency; the
contract's `PlayerInPossession` (17) / `PlayerOutOfPossession` (15) / `PlayerPhysical` (9)
field lists are Story 1.16's emit-time checklist, and the parser's own column tables are
1:1 with them.

**Row grammar.** A player row is a visual row whose leftmost span is a 1-2 digit shirt
number at x < 32 (the header's leftmost span is the literal `#`, which the grammar
excludes). Name spans end left of x=195 and are reassembled with `join_spans` — the real
pages fragment a name per glyph run (`'Ra' 'u' 'l' 'R' 'A' 'N' 'GE' 'L'`). Values are
assigned **left-to-right by ordinal**, guarded by an exact per-family count assertion
(14 / 8 / 15 / 9, invariant on all 3,289 rows of each family). Never by x-band: three
families are centre-aligned and physical data is right-aligned, so a value's `x0` shifts
with its width. The value area's only non-numeric furniture is the `%` abutting its
number and the `/` of the `Tackles Made / Won` split cell. `high_speed_runs` and
`sprints` print with a `.0` decimal but are integral on all 3,289 rows — parsed as float,
asserted integral, stored `int`, never rounded.

**The join is asymmetric**, and the natural-but-wrong direction fails on every corpus
report. Rows join to the Domain A lineup on within-report name identity, verbatim — never
normalized, folded, fuzzy-matched, or fallen back to the shirt number (cross-report
identity is Story 1.15's). The shirt number is the corroborating key. `position` is
copied from the joined lineup entry, since the G pages never print it.

| Direction | Corpus evidence | Behavior |
| --- | --- | --- |
| Page row → lineup player | 3,289 rows, 0 unmatched, 0 shirt disagreements | fail loud (`PlayerJoinError`) |
| Page row → lineup player *with minutes* | 1 exception in 3,289, all-zero (see below) | an all-zero orphan row is admitted; a non-zero one fails loud (`PlayerJoinError`) |
| Lineup player *with* minutes → page row | 0 missing over 104 reports | fail loud (`MissingFieldError`) |
| Lineup player *without* minutes → no row | 2,103 such entries (8,412 entry×family pairs) | normal; not a finding, not a warning |

`has_minutes(entry, section) = section == "starters" or substituted_on is not None` —
starter-ness comes from the section the entry was read from, not from the entry itself.

The rule holds in the lineup→row direction on all 104 reports. In the row→lineup
direction the corpus carries **one exception**: `PMSR-M92-MEX-V-ENG` away #14 Jordan
HENDERSON is an unused substitute (`substituted_on: null`, correctly — he was booked from
the bench at 98' and never played) who nonetheless has a printed row on all four
families, so 3,289 rows meet 3,288 lineup entries with minutes. **His row is entirely
zeros** (0.0 m, 0 passes, 0.0 km/h), so the page is verbose rather than contradictory.

The parser splits on exactly that: an orphan row whose every value is zero is admitted,
and one carrying real numbers raises `PlayerJoinError`. The second case would mean the
lineup missed a sub-on stamp for a player who actually took the field — which must not
stage a phantom's stat line into the physical leaderboards or either reconciliation.

The four families must also agree on the same players **in the same order** per side —
assembly is positional, so a reordered family would merge one player's numbers onto
another's row.

**Self-Validation** appends four recorded checks (binary, never loosened — SM-C1). Every
tolerance is derived from printed precision first and then corpus-verified:

| Check | Rule | Derivation | Worst observed |
| --- | --- | --- | --- |
| `domain-g-zone-sum` | `\|total − Σ zones 1-5\| ≤ 0.35` m | six 1-decimal values drift ≤ 6 × 0.05 = 0.30 | **0.200 m** / 3,289 rows |
| `domain-g-internal-consistency` | completed ≤ attempted (passes, crosses, line breaks), won ≤ made, received ≤ total offers, `goals ≤ attempts_at_goal`, `Σ movement types == total_offers` (EXACT), printed completion within ±0.55 of computed, and a printed completion beside **zero** attempts is itself a finding | the printed completion is integer-rounded, so ±0.5, plus the float margin — the same construction as the zone sum | **0.500** / 3,289 rows |
| `domain-g-distance-reconciliation` | `\|Σ player m / 1000 − Domain B distance_covered\| ≤ 0.1` km | team km prints to 1 decimal (±0.05) plus per-player metre rounding | **0.0499 km** / 208 team-innings |
| `domain-g-goals-reconciliation` | `Σ player goals + Σ opponent own_goals == Domain B goals` (EXACT) | — | **0 mismatches** / 208 |

**The own-goal term is mandatory.** The naive `Σ player goals == team goals` is
corpus-FALSE: it fails on exactly 14 of 208 team-innings, each short by one. A team's
printed score includes own goals scored by the *opponent*, while the Distributions page
credits the player who actually scored — and the corpus has exactly 14 own goals, the
same 14 Story 1.6's lineup ledger records. Shipping the check without the term would have
flooded the gate with 14 false `count-mismatch` deviations.

The two cross-domain checks are computed at the `extract_report` seam, where both sibling
payloads are already in hand, so the parser stays single-source (the Story 1.7
`shots_counts` precedent). When a sibling payload is absent the checks that need it are
**omitted** rather than emitted as passing — the Self-Validation aggregator is strictly
binary and could not read a "not-applicable" dict honestly.

The FR-15 gate gains `domain-g-completeness` (typed extract failures → `probe-failure`,
class name prefixed, so `PlayerJoinError` localizes the player, side and family) and
`domain-g-counts` (failed Self-Validation checks → `count-mismatch`). A missing anchor
stays anchor-coverage's `missing-anchor` finding, and a Domain A failure — which blocks
Domain G, since it joins to those lineups — stays `domain-a-completeness`'s.

---

## The momentum series — OQ-5 resolved (Story 1.8)

The PMSR carries **no page containing the word *Momentum***. It carries exactly one
per-minute two-team time series: the vector bar chart titled **`Distribution in the Final
Third`**, drawn once per report at the foot of the lineups page (page index 1 on 104/104,
but located by its own title anchor and never by index — AD-8).

`home`/`away` are that minute's count of **final-third distributions** per team. That is not
a possession percentage and not an abstract momentum index, and the schema description and
both READMEs say so; the pipeline records the true source metric so nothing downstream can
quietly let "momentum" imply "possession". It is nonetheless the only candidate for FR-35
and the App's Momentum Timeline — a per-minute attacking-presence count is exactly what a
broadcast momentum chart plots.

### What is constant, and what must be derived

Everything about this chart is per-report except three measurements. Getting that backwards
is the trap: a fixed absolute bar-width window catches only **75 of 104** reports.

These are **measurements, not assertions.** The parser derives the baseline from the middle
value gridline and the half height from the gridline run, then asserts the bars agree with
what it derived — it never compares either against the literal below. That is deliberate
(AD-8: derive, never hard-code): a template revision that translated the whole chart band
vertically would still produce correct values, because every quantity that feeds a sample is
relative, and failing such a report would be a false alarm. What the parser does assert is
the auto-scale itself — peak bar height equals the axis half height — which is the property
that would actually corrupt the values if it changed.

| Constant on 104/104 | Value |
| --- | --- |
| Baseline (the axis zero, and every bar's shared edge) | `y = 429.13` |
| Peak bar height (the chart auto-scales so the tallest bar fills the axis half height) | `50.38 pt` |
| Bar width as a fraction of the slot pitch | `0.70` |
| Home fill (grows **up**) / away fill (grows **down**) | `(1.0, 0.239, 0.0)` / `(0.702, 0.533, 1.0)` |
| Value gridlines | nine, evenly spaced, symmetric ±peak, plus a tenth axis rule 0.75 pt below |

| Per-report, derived every time | Range |
| --- | --- |
| Slot pitch | 1.95 – 2.95 pt |
| Value unit | 2.40 – 5.60 pt |
| Slot count | 96 – 114 (regulation), 132 – 145 (the 9 extra-time reports) |
| Empty slots (a minute with no bar on either side) | 9 – 36 |

**The tenth gridline matters.** The axis rule sits 0.75 pt below the last value line, so a
naive `max(y)` puts the "half height" at 50.755 pt instead of 50.38 and corrupts the
geometric peak cross-check. The parser keeps the evenly-spaced run explicitly and asserts it
is exactly nine lines.

### Colour to team is proven, never assumed

The chart encodes which team a bar belongs to **only** in its fill, so the legend swatch's
own printed name is matched against that report's cover metadata on every extraction. Orange
= home and purple = away on 104/104, and a report where it did not hold would fail loud
rather than silently swap the two series.

The lineups page also draws those exact two colours as *stroke* colours on unrelated
elements, and carries Domain A's own goal/card glyphs. Colour alone is therefore not
sufficient: the filter is **shape first** (AD-9) — a filled path whose item ops are exactly
four lines, inside the plot box — and only then colour-keyed. A bar-shaped path inside the
box carrying any other fill raises `MomentumFillError`, the same `unknown-rgb` phenomenon as
an off-palette shots marker.

### Three pitch derivations, and a geometric value scale

The slot pitch is derived three independent ways and all three must agree within 0.01 pt:
the printed tick spacing (the 45' tick minus the 15' tick, thirty slots), the plot box
divided into a whole number of slots, and the drawn bars' own outermost span.

The value unit is derived **geometrically** — the approximate GCD over the bar heights — and
never as `peak / printed label`. That split is load-bearing: deriving it from the printed
label would make `momentum-axis-scale` tautological, because the peak's value would then
equal the printed label by construction on every chart, including one whose axis is wrong.
Geometry contradicting *itself* (a bar height off the value grid, a peak that no longer
fills the axis half height) fails loud; the printed axis contradicting the geometry is the
recorded check.

> The approximate GCD takes its remainder against the **nearest** multiple, not the largest
> smaller one, and starts its running divisor at the smallest height. The textbook Euclidean
> form turns sub-thousandth PDF coordinate noise into a real residue and converges on it —
> measured against the real corpus, it returned ~0.001 pt as the "GCD" of 13 reports whose
> true unit is 2.4 – 3.9 pt.

### Slot to match clock (the story's one open question, closed)

Derived per report from the printed ticks — never a hard-coded formula, because stoppage
time shifts every tick after half time.

- **First half:** minute *M* sits at slot *M − 1*. Verified on the 15'/30'/45' ticks with
  **zero violations on 104/104**; slot 0 is match minute 1.
- **Half time:** the `HT` tick marks the **first slot of the second half**. It lands anywhere
  from slot 48 to 56, and the slots between the 45' tick and it are first-half stoppage
  (45+1, 45+2, …). Second-half ticks then satisfy `slot(M) = M − 46 + HT_slot` — again zero
  violations on the 101 reports that print `HT`. **Three reports omit the `HT` tick
  entirely** (M67, M86, M104); there the 60'/75'/90' ticks pin the same number and are
  required to agree.
- **Full time:** the `FT` tick lands on the **last slot of the grid** on all 94 regulation
  reports that print it. **One report omits it** (M42) and falls back to the grid's last
  slot; `momentum-coverage` still passes there, but its `specifics` say the grid-end
  cross-check was unavailable, so that report is never mistaken for a cross-checked one.
- **Extra time (9 reports):** neither extra-time break is printed on any of them. The first
  extra period opens on the slot after `FT`, and the `120` tick's own fifteen regular minutes
  place the second period's opening slot. That is the only reading the printed ticks support,
  and the parser asserts the two periods do not overlap.

Observed stoppage: 1–11 minutes in the first half, 3–19 in the second, 0–4 and 1–11 in the
two extra periods — all inside the contract's `StoppageMinute` bound of 30.

### There is no printed row total to reconcile against

Exactly as with Story 1.12's possession-regain map. The per-team bar sum was tested against
**every** numeric Domain B field over all 208 team-innings; the best exact-match rate was
`pass_completion` at 2/208 — coincidence. `receptions_in_final_third` is a related metric but
consistently smaller (M01: 117 vs 138 home, 36 vs 78 away). No reconciliation was
manufactured and no check was weakened to produce one (SM-C1).

**Self-Validation** appends two recorded checks:

| Check | Rule |
| --- | --- |
| `momentum-axis-scale` | the printed y-axis top label equals the peak value derived from the bar heights — the one genuine printed counterpart the page offers |
| `momentum-coverage` | the series opens at kick-off, its clock strictly advances, it ends in the final period (90' or 120'), and the printed `FT` tick falls on the last sample |

Both pass on 104/104. The FR-15 gate gains the same two ids: `momentum-axis-scale` owns the
parse (typed failures to `probe-failure` naming the class, an off-palette fill to
`unknown-rgb`) and `momentum-coverage` swallows parse failures so one root cause is
attributed once.

### Absence travels as a warning, not a failed check

A report whose chart is anchored but draws no bars stages `momentum: None` plus a per-report
warning that `batch.py` mirrors into the manifest — never a non-`pass` check, which the
strictly binary aggregator would read as a *failure* of a merely incomplete report (Story
1.12's precedent). **No corpus report takes this branch**: all 104 draw a band, and
`momentum: null` never occurs in real data. A clean corpus run is therefore not evidence
that the branch is dead code; AD-4 requires the key to be present with a flagged absence, and
it is unit-tested directly.

### The contract bump (AD-14)

This story carried the project's first `schemaVersion` bump, **1 to 2**. `MomentumSample`'s
`minute` field referenced `Minute` — an integer capped at the end of its period — and the
momentum grid runs on stoppage-inclusive slots, so every first-half stoppage minute collapsed
onto 45 and collided. The provisional shape could not represent the data. It is now
`at: MinuteStamp` with non-negative integer values. Details in `contract/README.md` section 3.

Staging stays raw and snake_case (AD-7): the record holds `{minute, stoppage_minute, home,
away}` per sample and the camelCase `at:` composite is Story 1.16's emit-boundary job. No
derived float (pitch, unit) ever reaches the record — two machines' float noise would break
AD-8 byte-identity.

## Goalkeeping and set plays — Domains E & F (Story 1.9)

`domains["goalkeeping"]` and `domains["set_plays"]`, from `pipeline/extract/domain_e.py`
and `domain_f.py`. Nine pages per report, all located by anchors Story 1.2 already
registered — this story adds no `AnchorSpec`.

### Domain E is staged PER TEAM, not per goalkeeper

The epic asked for "every goalkeeper with minutes has a record". That is **unfulfillable**,
and the story-creation probe proved it over all 104 reports:

- all four goalkeeping page families are titled `{team}`, and **no goalkeeper name appears
  anywhere on any of them**;
- **7 of 208 team-innings used two goalkeepers** (M21 home, M41 away, M53 away, M62 away,
  M66 home, M88 home, M98 away) and their pages still print one team-level block each —
  one chart, one total, no name.

So the block is per team, and the goalkeeper(s) with minutes are carried **beside** it from
Domain A's lineups as `goalkeepers: [{name, shirt_number, substituted_on, substituted_off}]`
— context recorded, never a key. No page data is joined to that list and no keeper is
inferred from it, not even on the 201 unambiguous innings: a shape that varies between
reports is worse than one that is honestly team-level everywhere. The list is asserted
non-empty and deliberately **not** asserted to hold exactly one entry.

### Four different extraction problems under one domain name

| Page family | Shape | How it is read |
| --- | --- | --- |
| Goal Prevention | one table | seven-column table at the page foot, header-anchored, values bounded to `x >= 460` |
| Aerial Control | half table | KPI tiles left of `x = 450`, the `Delivery Types Faced` table right of `x = 460` |
| Goalkeeping Distribution | a marker **MAP** | four equal-area panels through the shared filter chain, read-only |
| Goalkeeping Involvement | a per-minute **CHART** | one page carrying BOTH teams' timelines |

Two printed-layout rules recur across all four families and across set plays:

1. **A KPI value prints ABOVE its label and CENTRED on it**, and the row immediately above
   is frequently not the value's row — for `Total Set Plays` it is the corners table's first
   data row, and for `Goalkeeper Line Breaks` it is the three donut centres. Every KPI is
   read by walking up from its label to the first row carrying a number centred on it, and
   the walk is **bounded to 80 pt**: KPI columns repeat down these pages, so an unbounded
   walk past a missing value would silently adopt the tile above's number.
2. **A table's values print BELOW a header** whose own band text is a closed constant
   asserted by equality (one distinct form on 208/208 pages for both E tables), so a
   reworded or reordered column fails loud rather than shifting every value by one.

### Two page traps, both corpus-measured

- **Goal prevention's seven-column table.** `PMSR-M38-ESP-V-KSA` home prints a stray
  pitch-marker ordinal at `x = 275` on the table's own visual row, so a naive "row of seven
  digits" finds **zero** there; `PMSR-M34-ECU-V-CUW` away and `PMSR-M38` away each carry a
  *second* seven-digit row higher up the page. Header anchoring plus the `x >= 460` bound
  resolves all three: 208/208.
- **The goal-prevention donut centres are in the text layer and are NOT trustworthy.** On
  `PMSR-M01` the Intervention Type donut reads `4` against a table whose attempts-faced,
  total-interventions and five-type sum are all `3`. They are neither staged nor checked.
  (The *distribution* page's three donut centres are reliable, and are the printed
  counterpart the marker counts are compared against.)

### The distribution map: four equal-area panels

`detect_pitch_frames` returns exactly **4** panels on 208/208 pages, each **59,516.0 pt²**
and every frame ending at `y1 = 406.5` on all 832 panels. Because they are equal-area,
`detect_pitch_frame`'s `max()` would return an arbitrary one and discard the other three —
the Story 1.12 lesson verbatim, which is why the plural accessor is mandatory. Panel →
category is keyed by the **printed panel title**, never by position (AD-8).

Marker spec: `marker_min_pt=5.0`, `marker_max_pt=6.5` (real dots are 5.83 pt filled circles
with a white stroke), palette `(0.18,0.30,1.00) → complete` / `(1.00,0.00,0.00) →
incomplete`. **0 off-palette markers are admitted on 208/208.** No dedup anywhere (AD-8):
two markers at the same point are two distributions.

`pitch_margin_pt` is **0.5**, a recorded departure from the story's `0.0`, and the departure
was measured rather than assumed. The story's stated reason for strict containment — that
any positive margin would admit two `Complete`/`Incomplete` legend swatches per panel and
inflate every count by 2 — does not hold for this spec: swept over all 208 pages, the
swatches are 9.0 pt circles (outside the 5.0–6.5 window) whose centres sit **10.5 pt** below
the frame, and **no** out-of-size filled circle sits within 6.0 pt of any frame. Meanwhile
strict containment *drops real markers*: eight team-innings print a dot whose centre falls a
fraction of a point below its frame (max overshoot **0.2917 pt**), and admitting it makes
seven of them match their printed donut centre exactly. This is Story 1.11's touchline-cross
finding, answered the same way.

### The involvement chart: scale from the labels, baseline from the grid

One page carries both teams' timelines, and which chart belongs to which team is read from
the printed `'{team} GK Involvement Timeline'` title matched against this report's own cover
— never from drawing order (the discipline `extract_momentum` applies to its legend). The
extractor therefore takes the cover team names, a recorded departure from the story's stated
signature: without them the home/away split could only be positional.

The scale is established twice, from two independent sources that must agree:

- the printed y-axis labels (a descending run of consecutive integers ending at 0) give the
  points-per-unit factor;
- the drawn value gridlines give the **baseline**, selected as the one run of exactly
  `len(labels)` lines spaced that unit apart. The chart draws an extra axis rule 0.75 pt
  below the zero line — the momentum chart's tenth-line problem again — so a spacing-derived
  unit would be wrong.

That split resolves the story's open tolerance question. Its proposed label-anchored fit
`value = (y_of_zero_LABEL − y) / unit` carries a systematic offset: the labels sit 1.81 pt
above their gridlines, which is 0.117 units on the reference report but **scales with the
per-report unit** — measured worst **0.161278 units**, exceeding the proposed 0.15 bound on
206 dots rather than on 2 charts. Anchoring the baseline on the zero **gridline** removes the
fit entirely: over all 208 charts / **21,764 dots** the worst deviation from an integer is
**0.000001 units**, so the shipped `0.01` tolerance is float slack, not a fit.

Slot counts are **per report** — 95–111 regulation and 129–145 extra time, measured — and
are never hard-coded.

#### The chart's TIME axis — slot → match clock

The slot count alone does not tell Story 2.10 what minute a slot is, so the mapping is
derived from the chart's own printed x-ticks and staged as `involvement_clock`
(`second_half_slot` / `first_extra_slot` / `second_extra_slot`, plus one flat
`{minute, stoppage_minute}` stamp per slot). The method is Story 1.8's; the code is its
own, because the tick grammar is materially different:

| | momentum (1.8) | involvement (1.9) |
| --- | --- | --- |
| `FT` tick | 94/104 | **never printed** |
| `HT` tick | 101/104 | **122/208** |
| stoppage ticks | none | `45+N` (108 charts / 110 readings), `90+N` (182 / 214), `120+N` (4 / 4) |
| last tick vs last slot | FT *is* the last slot | last tick is **0–7 slots before** the grid end — 0 on 38 charts, so sometimes it *is* the last slot |

Every relation below was measured over all 208 charts / 4,508 tick readings with **0
deviations**: the origin tick `0` on slot 0 (208/208); first-half tick `M` on slot `M-1`
(1,872/1,872); `45+N` on slot `44+N` (110/110); every second-half tick agreeing on one
minute-46 slot (208/208) and equal to the `HT` tick wherever it is printed (122/122);
`90+N` on `m46+44+N` (214/214); and both extra periods unanimous across their own ticks
(18/18 charts). Each boundary is pinned by **every** tick that speaks to it and the
candidates must agree, so on a typical chart a dozen independent readings have to line up
before one minute is staged.

Two measured findings shape the reader:

- **The tick row must be read character-level, not span-level.** pymupdf merges adjacent
  same-font inserts, and the two reports whose half-time tick sits one slot after the 45'
  tick (`PMSR-M86-ARG-V-CPV`, `PMSR-M100-ARG-V-SUI`) hand back a single `'45HT'` span whose
  centre is neither tick's. Runs break on the digit-class boundary with `+` folded in
  *with* the digits, so `45HT` splits while `90+5` stays whole. This is Story 1.7's
  merged-span lesson and momentum's `_tick_runs` arriving at the same place.
- **`PMSR-M88-AUS-V-EGY` draws a 14-slot first extra period** on both charts — it prints
  no `105'` tick, and its `110'` tick sits one slot earlier than a 15-minute ET1 would put
  it. The page is internally consistent and simply says minute 105 has no slot, so the
  parser does **not** assert that a period ran its regular length; the short period is
  recorded in `goalkeeping-involvement-clock`'s specifics and filed in `deferred-work.md`.
  Failing that report would be asserting football over the source.

This also retires the "extra-time tick collision" left open at code review. The collision
was in the *naive* reading — extending the second-half formula to minute 95 puts it on the
same slot as `90+5` — not in the data. Of the 18 extra-time charts, 16 print a `90+N` tick
at all (`PMSR-M74-GER-V-PAR` prints none on either side, so there is nothing to collide
with), and on every one of those 16 the `95'` tick sits 5–9 slots after the last `90+N`
tick. The printed ticks are what the mapping reads.

### Recorded Self-Validation checks

Eight ids, all binary, all appended after every existing appender:

| id | relation | corpus |
| --- | --- | --- |
| `goalkeeping-distribution-sum` | `feet + hands + throw == total` panel | exact 208/208 |
| `goalkeeping-distribution-printed` | marker count **>=** printed donut centre | true 624/624 |
| `goalkeeping-goal-prevention-sum` | Σ(5 intervention types) `==` attempts faced, and the KPI tile agrees with the table | exact 208/208 |
| `goalkeeping-aerial-sum` | Σ(6 delivery types) `==` printed total | exact 208/208 |
| `goalkeeping-involvement-bound` | Σ(series) **<=** printed total | true 208/208 |
| `goalkeeping-involvement-clock` | the staged clock opens at kick-off, advances strictly and ends in the final period | true 208/208 |
| `set-plays-corner-sides` | Σleft + Σright `==` total corners, and per row `total == left + right` | exact 208/208 |
| `set-plays-totals` | FK + PEN + COR + THR `==` total set plays; `direct + indirect == total free kicks`; Σ(delivery-type row totals) `==` total corners | exact 208/208 |

**Two of these are BOUNDS rather than equalities, and both were earned on evidence.**

- `goalkeeping-involvement-bound`: `Σ(series) == total_involvements` is corpus-FALSE on
  **149/208** — the delta is 0..5, never negative, exact on 59, mean 1.26. The chart
  consistently plots *fewer* involvements than the KPI counts, and the cause is unresolved
  (not axis clipping: the plotted maximum equals the axis top label; not lost dots: the dot
  count equals the slot count). The observed delta is written into `specifics` on **every**
  report so the gap stays visible rather than being absorbed.
- `goalkeeping-distribution-printed`: over 208 team-innings × 3 printed panels, `drawn >=
  printed` is true on **624/624** while equality holds on **604/624**. Every one of the 20
  residuals is in the `feet` panel (+1 on 18, +2 on 2); `hands` and `throw` are exact on
  208/208 each. No geometric cause survived investigation — the Total Distributions panel is
  the **exact union** of the other three on every case examined, so the drawn set is
  self-consistent and the map simply plots more feet distributions than the technique donut
  counts. Every panel's delta is recorded in `specifics`.

`goalkeeping-involvement-clock` is a **backstop, not a cross-check**, and the distinction
is the same one momentum's `momentum-coverage` docstring draws: every clock inconsistency it
could describe is already a typed `InvolvementClockError` that aborts the report before a
clock is staged. What it adds is a record of the derived stoppage allotments and of any
period drawn short, written into `specifics` on **every** report — neither is part of its
pass/fail predicate.

### Relations that are corpus-FALSE and are deliberately NOT shipped

| Tempting relation | Reality |
| --- | --- |
| `direct == direct_on_target + direct_off_target` | **false 208/208** — 160 innings print `on + off == 0` while `direct > 0`. The contract's `FreeKickCounts` `$comment` asserts it; the `$comment` is wrong (filed in `deferred-work.md`). |
| Σ(corner delivery style) `==` total corners | false on **112/208** — the style table is not a partition of corners |
| Σ(5 intervention types) `==` total interventions | false on **207/208** — different denominators, as the contract itself notes |
| `total_interventions == attempts_faced − no_save_attempt` | false on **183/208** |

The synthetic fixtures make all four of these **false by construction**, so no test can
quietly bless a relation the corpus refutes.

### Documented absences (AC 4)

Three contracted values are not extractable. Each stages as `null` plus one per-report
**warning** — never a non-`pass` check, which the strictly binary aggregator would read as a
failure of a merely incomplete report (the 1.12/1.13 branch):

| Absent value | Why |
| --- | --- |
| `distribution.{feet,hands,throw}_techniques` | the donut **slice** labels are inside raster images; only the centre total is in the text layer |
| `goal_prevention.by_body_type` | same, and this page's text-layer donut centres are demonstrably untrustworthy |
| `aerial_control.crosses_faced_completed` | drawn only as marker colour on a goal-mouth crop, not a full pitch, with no printed counterpart to validate against |

### Page-level tripwires

Set plays carries exactly **24 bare-integer words** (22 printed values plus the date strip's
day and year) on 208/208, and the distribution page exactly **4** numbers below the panel
band (three donut centres plus `Goalkeeper Line Breaks`). Both are asserted, because every
other value on those pages is found *by name* — a template revision that ADDED a printed
number would otherwise stage a silently incomplete block. The set-plays census runs **after**
the grammar, so a DROPPED value still fails with its own row's message rather than with a
page-level word count that localizes nothing.

## The pass-network domain (Story 1.14) — the nodes have no coordinates

`Passing Networks {team}` is **not a pitch map**. It is a square **N×N directed adjacency
matrix** printed as a table (rows = "Passes From", columns = "to"), plus a printed "Top 5
Player to Player Passers" panel that reconciles against it. Two consequences run in
opposite directions, and holding both at once is the point of this section:

1. **The edge half is the cleanest extraction in Epic 1.** 23,597 edges over 208
   team-innings, every endpoint joining to Domain A by verbatim name with the shirt number
   corroborating on 3,289/3,289 rows, and a printed self-check that validates the matrix
   **total** and its five largest cells to within a rounding half-ulp on 1,040/1,040
   measurements.
2. **The node half does not exist at all.** Not "hard to read", not "raster-only": the
   coordinates are simply not on the page, and no page in the corpus carries them.

**What the printed self-check does NOT prove, stated plainly** (1.14 code review — the
first draft of this section claimed the Top-5 panel validated "therefore every cell", and
it does not). All three shipped checks are **invariant under any permutation of the
matrix's off-diagonal cells**: `pass-network-top5-pct` compares printed percentages against
the sorted multiset of cell values, `pass-network-total-bound` against their sum, and
`pass-network-row-bound` against per-row sums. None of them carries a positional operand,
so **no shipped check can detect a column-assignment slip** — the single failure mode this
family's whole parsing rule exists to prevent. What guards it instead is structural: the
header-rect grid with its contiguity assertion, the N×N census with one blank per row on
the diagonal, row order == column order, the Domain A join in both directions, and
`test_every_ground_truth_cell_agrees_with_an_independent_read`, which re-reads both
`spike/mex_rsa.pdf` matrices by a decomposition the parser does not share and compares all
496 off-diagonal cells. Do not add a check here and describe it as cell-level coverage
unless it actually reads a cell's position.

`pipeline/extract/pass_network.py` therefore stages a matrix, not events — and the module
opens by saying so, because the next reader will otherwise go looking for the marker
parser that is not there.

### The staged payload

```
domains.pass_network = {
  "home": {
    "players": [ {"name","shirt_number","passes_made","passes_received"}, ... ],   # printed row order
    "edges":   [ {"from_name","from_shirt","to_name","to_shirt","volume"}, ... ],  # matrix reading order
    "matrix_total": int,
    "top_ranked_pairs": [ {"rank","percent_of_total"}, ... ],   # printed order, 5 rows
    "node_positions": None,                                     # documented absence
  },
  "away": { ... },
}
```

Snake_case throughout, no contract kebab codes as keys, and **no `player_id`** —
cross-report identity is Story 1.15's. `passes_made` is the row sum and `passes_received`
the column sum; their sum is the contract's `involvement`, and **Story 1.16 must derive
`involvement` from this matrix, never from Domain G's `passes_completed + offers_received`**
(the two disagree — see the bounds below).

### Column assignment is GEOMETRIC, and that is the load-bearing rule

Zeros **are** printed. The only cell absent from the text layer is the **blank diagonal** —
one per row — and that single absence makes every row ragged: an ordinal read over the
present values shifts every cell at or after position `i` in row `i`. With 25,217 zero
cells corpus-wide a shifted value looks entirely plausible, and no aggregate check would
see it. Each column's extent is therefore read from **its own blue header rectangle**
(fill `(0.18, 0.30, 1.00)`, `85 < y0 < 95`, height > 20 — the height predicate is what
excludes the Top-5 panel's own 13.5 pt header rect at the same y0), and every cell is
assigned by x-containment in that rect. Never by nearest centre, never by ordinal.

Two things a reader will be tempted to assume, both measured false:

- **Widths are not uniform.** They range 27.75–58.5 pt and vary *within* the page on
  **156 of 208** innings. The 52 uniform pages are all exactly 36.0 pt and occur at
  N=15, 16 **and** 17 — not "N=16 only". 36.0 pt appears as at least one column width on
  208/208, so it is the family minimum, not an N=16 artifact.
- **The enclosing span is not fixed either**, so `span / N` is wrong too: the right edge is
  748.5 on 204/208 (749.25 / 753.0 / 756.75 on the other four) and the left edge takes
  **56 distinct values** from 126.75 to 255.75.

The two leading header cells are identified by their **text** (`#`, then a cell beginning
`Passes From`), never by index; anything else is a template revision and raises. The
qualifying header cells are asserted contiguous, because a missing header cell would drop a
whole column from the grid while every remaining column still parsed — the one failure the
row census cannot see.

The census is then asserted in full: exactly N columns, exactly N rows, exactly one blank
per row, and that blank at position `i` in row `i`. Row order is asserted equal to column
order (hyphen-normalized) on 208/208, which is what makes cell `[i][j]` mean "row-player i →
column-player j" without a second name lookup per cell.

**The hyphen wrap**: a hyphenated surname wraps inside the narrow column-header cell on
**24 of 208** innings, so joining its two lines yields `'Ben GANNON- DOAK'` against the row
label's `'Ben GANNON-DOAK'`. The canonical player list comes from the **row labels**, which
also carry the shirt number the headers do not; the headers are read only to *place* the
columns, and their text is compared hyphen-normalized and asserted — never silently
repaired.

### The join, and its one tolerated anomaly

Identical in shape and in outcome to Domain G's, and deliberately so: the pass-network
player set **is** Domain G's, including the same lone anomaly.

| Measurement | Result |
| --- | --- |
| Matrix rows joining to the lineup by **verbatim name** | 3,289 / 3,289 |
| Shirt number corroborates | 3,289 / 3,289 |
| Unmatched endpoints | 0 |
| Starters present in the matrix | 2,288 |
| Substitutes who came on, present | 1,000 |
| Substitute with **no** minutes, present | 1 — `PMSR-M92` away #14 Jordan HENDERSON |
| Unused substitutes absent from the matrix | 2,103 — correct, not a finding |
| Reconciliation | 3,289 + 2,103 = **5,392** lineup entries |

The asymmetry is the easy thing to get backwards: a row that matches no lineup player
raises `PlayerJoinError`; a lineup player **with** minutes and no row raises
`MissingFieldError`; a lineup player **without** minutes and without a row is the normal
case and is neither recorded nor warned about. HENDERSON was booked from the bench and the
page prints an **all-zero** row for him — so an orphan row is admitted only when its row
**and** its column are entirely zero. A row with any non-zero cell for a player the lineup
says never played is a contradiction and raises, and so is a non-zero **column** — a
teammate passing *to* someone who never played, the direction Domain G has no analogue for.

### Matrix invariants (all 208/208)

| Invariant | Result |
| --- | --- |
| Matrix is square N×N | 208/208 |
| N distribution | 13:2, 14:11, 15:26, **16:154**, 17:15 |
| Off-diagonal cells | **48,814** = Σ N(N−1) over that distribution |
| Non-zero cells (= edges) | **23,597**; volumes **1–48** |
| Zero cells (= absent edges) | **25,217** |
| Reciprocal pairs | **9,151**, of which **6,835 asymmetric** |
| Diagonal blank | 208/208 |

The matrix is genuinely **directed**: a reciprocal pair is two edges, and 6,835 pairs print
different volumes in the two directions. **Never symmetrize, never collapse a pair, never
dedup.** A zero cell is an **absent** edge, never a zero-volume one — the contract's
`volume` is `minimum: 1`.

### Self-Validation

Three checks, all recorded and never raised. These are **Self-Validation** ids; the FR-15
gate's `pass-network-completeness` / `pass-network-counts` are a different registry and
neither may be read as the other.

| Check id | Relation | Verdict |
| --- | --- | --- |
| `pass-network-top5-pct` | printed Top-5 pct == `100 × cell / matrix_total`, tol `<= 0.05` | TRUE 1,040/1,040 |
| `pass-network-row-bound` | `sum(row_i) <= Domain G passes_completed` | TRUE 3,289/3,289 |
| `pass-network-total-bound` | `matrix_total <= Key Statistics passes_completed` | TRUE 208/208 |

The tolerance is **derived, not tuned**: the panel prints one decimal, so a faithful value
sits at most a half-ulp — 0.05 — from the computed one. Worst observed absolute delta over
all 1,040 printed percentages is **exactly 0.05**, and the three worst cases evaluate to
`0.04999999999999982` in float, which is why the comparison is `<=` and why the constant
must not be tightened without re-measuring. It is compared as `delta > TOLERANCE +
TOP_RANKED_PCT_EPSILON` (1e-9): the sign of that last-bit error is an accident of the
operands, so a page printed correctly can just as easily land at `0.050000000000000044`
and be failed for float representation alone (1.14 code review). The epsilon is eleven
orders of magnitude below the printed precision and does not widen the tolerance;
`test_the_tolerance_admits_exactly_the_printed_half_ulp_and_nothing_beyond` pins both
edges to within 0.0001.

The two cross-domain relations ship as **BOUNDS, not equalities** (the 1.8/1.9/1.12 rule),
and both checks record the per-report delta in `specifics` on every report — passing or
not — so the gap stays visible rather than being closed by making the numbers agree:

- `sum(row_i) == Domain G passes_completed` is **corpus-FALSE on 1,290 of 3,289 rows**
  (M01 home RANGEL 27 vs 29, REYES 40 vs 47, GALLARDO 32 vs 46 …). The matrix never
  exceeds Domain G.
- `matrix_total == Key Statistics passes_completed` is **corpus-FALSE on 208/208**, and
  strictly less on all of them (M01 home 470 vs 495, away 278 vs 290).

Both cross-domain checks are computed at the `extract_report.py` seam, where the sibling
payloads are already in hand, and are **omitted entirely** rather than failed when a
sibling is unavailable — one root cause, one finding.

### Relations that are corpus-FALSE and are deliberately NOT shipped

- **`sum(col_j)` vs Domain G's `offers_received`.** False in *both* directions:
  **3,145 greater, 121 equal, 23 less** over 3,289 rows. There is no relation here, and a
  "bound" in either direction would fire on thousands of rows. Named in a comment at the
  would-be call site in `pass_network_checks`, and pinned by a test, so a later story
  reaching for the obvious relation finds a red test rather than only prose.

### Documented absences

- **`node_positions` is `None` on every report, and always will be.** The page carries **0
  pitch frames on 208/208** (measured with `filter_chain.detect_pitch_frames`' own
  qualifying rule), **0 filled all-Bézier drawings at any size**, and one 36×36 pt
  competition logo. A title scan over all **5,448** pages of the corpus finds **0** pages
  titled with average positions. `PassNetworkNode.x`/`y` are therefore unfulfillable and are
  filed as an AD-14 emission blocker; nothing here derives them from the edges, from the
  formation string, or from the lineup positions. It is a **warning**, never a non-`pass`
  check — the aggregator treats anything but the literal `"pass"` as a failure, and a
  documented absence must not turn a complete report into a failing one.

**The absence is asserted, not commented.** `_assert_no_pitch_and_no_markers` runs on every
page on every run and requires `detect_pitch_frames` to raise `PitchFrameError` and the page
to carry no filled all-Bézier drawing. This is what makes the AD-14 filing self-maintaining:
the day the vendor starts printing coordinates, the corpus aborts loud instead of publishing
`node_positions: null` forever. A test draws a pitch rect on a synthetic pass-network page
and asserts the raise.

### What the Top-5 panel does and does not give you

The panel is present on 208/208 and prints five rows of `Player | Passed To | % of Total
Team Passes`. Percentages print **with or without a decimal** — `3.8%` and `3%` both appear
on the reference page — and are parsed with an explicit `re.ASCII` pattern accepting both.
The panel's **player names are not staged and are not a check operand**: they wrap across
lines on 12 of 208 innings and the percentages alone carry the whole reconciliation. A later
story that wants the names owes the wrap recipe (the `crosses.py` / `defensive_actions.py`
precedent), not a guess.

## Cross-match identity and the normalized spine — precompute (Story 1.15)

Everything above this section is **per-report and pure**: one PDF in, one Extraction
Record out. `pipeline/precompute/` is the opposite by construction. It is AD-9's **second
phase**: global, consuming all 104 records in canonical order, and the only phase that
resolves identity. It is also the first module in the pipeline that reads **no PDF at
all** — `pymupdf` appears in its production path only through the two FR-15 gate checks,
which are per-report by the gate's own contract.

```
pipeline\venv\Scripts\python.exe -m pipeline.precompute.run --expect-records 104
```

| flag | meaning |
|---|---|
| `--manifest` | run manifest to consume (default `work/run-manifest.json`) |
| `--extracted-dir` | where records are staged (default `work/extracted`) |
| `--spine-dir` | where the spine is staged (default `work/spine`) |
| `--data-dir` | committed bundles for the second pinning source (default `data`) |
| `--write-registry` | regenerate `slug_registry.py` instead of checking against it |
| `--expect-records N` | assert the manifest names exactly N consumable records |

Exit codes follow the house contract: `0` clean, `1` a finding (a pin would change, an
override names nobody, a collision, an unresolved reference, a record count that does not
match `--expect-records`), `2` the harness could not run.

### The manifest is the input, not the directory listing

`load_records` walks `manifest["reports"]` and reads each entry's own `record_path`. It
never rebuilds a path from `extracted_dir` + `match_id`. `work/extracted/` may hold an
orphan left by a superseded run, and a directory listing would let it enter the dataset as
a phantom match.

The filter is on `status` alone — `extracted` or `skipped-unchanged` — and **never on
`self_validation`**. `PMSR-M19-ARG-V-ALG` and `PMSR-M58-TUN-V-NED` carry
`self_validation: "fail"`, but their single failing check is
`defensive-actions-marker-count`, which touches no lineup entry, no name path and no shirt
number. Excluding them would drop two matches from the tournament over a source defect in
an unrelated domain. They are ruled consumed.

Canonical order is free: every match id is `m{NNN}-…` with three-digit padding (Story
1.1's logged decision, bought for exactly this), so lexicographic order **is** ascending
numeric order and a plain `sorted()` is canonical.

### The player slug rule — the caps-run rule

No record carries surname and given name separately; `name` is one printed string, and the
corpus prints at least four incompatible grammars over its 5,392 lineup entries:

| signature | entries | example | |
|---|---|---|---|
| `uU` | 4,191 | `Raul RANGEL` | given first, surname in caps |
| `UU` | 707 | `GABRIEL MAGALHAES` | all caps — the boundary is unknowable |
| `uUU` | 168 | `Luc DE FOUGEROLLES` | multi-token surname |
| `U` | 107 | `ALISSON` | mononym — no split exists |
| `uuU` | 81 | `Juan Jose CACERES` | multi-token given name |
| `Uu` | 78 | `KIM Seunggyu` | **surname FIRST** — every Korea Republic player |
| `uu` | 25 | `Weston McKENNIE` | no all-caps token at all |
| `UUU` / `uuUU` / `uUUU` / `uuuU` | 35 | `Micky VAN DE VEN` | |

**The rule:** the all-caps tokens are the surname, *wherever in the string they sit*; the
remaining tokens are the given name in printed order; if there are no caps tokens **or** no
remainder, the name slugs **as listed**. Then `{surname}-{givenName}-{teamCode}`, or
`{name}-{teamCode}` in the fallback. Both branches append the team code — a two-segment
slug validates clean as a `TeamId` and produces a dead route, a defect that shipped once.

**The rule is validated, not asserted, and only one check can validate it.** It reproduces
**155 of 155** distinct player ids in the committed `data/fixtures/matches/*.json` bundles
with 0 mismatches, and yields 1,248 collision-free slugs over the corpus. The rejected
"last token is the surname" rule **also** yields 1,248 unique collision-free slugs — it
differs on 1,009 entries and inverts all 26 Korea Republic players — so **a collision count
cannot discriminate between the two rules and only the fixture reproduction can.** That is
why `test_the_caps_run_rule_reproduces_every_committed_fixture_player_id` is the acceptance
check, and why the mutation check mutates to *last-token* rather than to trailing-caps
(trailing-caps is behaviourally identical on 5,392/5,392, because `'Seunggyu'.isupper()` is
`False`).

Walk **both** `players[]` and `metadata.lineups.*[]` when reading the fixtures: 59 of the
155 ids are reachable only through the lineups, including the two-token-surname case
`romero-gamarra-alejandro-par`, which appears in exactly one substitutes list.

**Declared residual:** 219 players / 856 entries take the as-listed fallback and therefore
slug given-name-first. Every one is unique, stable and pattern-valid; the cost is cosmetic
URL ordering, not correctness. It is a **per-team printing convention** — eight teams print
all 26 of their players in caps and contribute 208 of the 219 — so it is filed for a
per-team ruling, and `OVERRIDES` exists so the ruling lands as data rather than code.

### Team codes have no other producer

`teamCode` is the trailing segment of every `PlayerId` and exists nowhere in the pipeline
except inside `report_id` (`PMSR-M01-MEX-V-RSA`). It is parsed out, asserted **1:1 in both
directions over 48 teams and 48 codes**, and committed. It is not derivable: `cpv`, `cuw`,
`mar`, `ksa`, `esp` and `sui` each carry a letter their team's slug does not contain, and
no first-three-letters rule produces `rsa` (South Africa) or `cod` (Congo DR) either. A
code serving two teams would silently merge two squads into one namespace, so it raises.

### OQ-4's three named ambiguous cases are all corpus-EMPTY

Measured over 5,392 lineup entries / 1,248 distinct players:

| case | corpus count |
|---|---|
| non-ASCII character in any player name | **0** of 1,247 distinct names |
| normalized name + team collisions | **0** |
| players wearing more than one shirt | **0** (distribution exactly `{1 shirt: 1248}`) |
| `(team, shirt)` pairs worn by two players | **0** |

So `(team_id, shirt_number)` is by itself a globally unique key, and **the AD-3 first-seen
tiebreak is not implemented — deliberately, and this is the one place that says so.** Two
players on one team whose printed names mint one slug raise `IdentityCollisionError`
naming both parties, both shirts and both match ids; they are not silently separated by
shirt order. On a corpus measuring 0 such collisions a tiebreak could only ever fire on a
defect, and quietly minting two ids from one printed name is unfalsifiable downstream:
every id unique, every pattern satisfied, and one route naming the wrong person. AC 1's
binding block rules exactly this; AC 4 rows 2-3 and Task 3.4 describe the tiebreak
instead, and Story 1.15's code review resolved that contradiction in favour of raising
(Decision 1). The NFKD accent fold is kept because the three
*team* names `Curaçao`, `Türkiye` and `Côte d'Ivoire` genuinely need it; no check asserts a
non-zero accent-strip count on player names, because that count is zero.

The one real ambiguity the epic never named is the surname/given-name split. The one real
cross-team repeat is `Emiliano MARTINEZ` — Argentina #23 and Uruguay #15, two different
people. Team code is part of the id, so they separate; drop the code and
`martinez-emiliano` is the corpus's only slug collision.

### The slug registry is Python, and that is load-bearing

`pipeline/precompute/slug_registry.py` is **generated** (`--write-registry`) and holds
`TEAM_CODES` (48), `PINS` (`matches` 104, `players` 1,248, `teams` 48) and `OVERRIDES`
(empty). All maps sorted by key, so a `git diff` of a regeneration reads as exactly the
entities that changed. Regeneration is byte-identical: fixed formatting, LF endings,
trailing newline, nothing read from the clock or the environment.

It is Python because AD-8 requires the code version to include the committed slug registry
and `code_version()` fingerprints `pipeline/**/*.py`. A `.json` registry falls outside that
glob, so the guarantee would silently stop holding — moving it would also require widening
`EXTRA_FINGERPRINTED_FILES` in `pipeline/ingest/fingerprint.py`, a step whose omission is
silent. **Committing the registry changes `code_version()` and invalidates all 104 staged
records, forcing one full re-extract. That is the fingerprint working as designed.**

The pin key is `(team_id, shirt_number)`, serialized `f"{team_id}#{shirt_number}"` — one
form everywhere. `OVERRIDES` is applied **before** pinning, so an override is what gets
pinned; an override naming a key that resolves to nobody fails loud, because a stale
override is how a registry rots silently.

### Pinning has two sources, and the second one does not exist yet

- **`PINS`** is the immutability baseline from run one. A later run minting a *different*
  id for an already-pinned key fails loud. An **absent** pin is a new entity — normal on a
  growing corpus — and does not fail.
- **The `/data` diff** reads every `matchId` / `teamId` / `winnerTeamId` / `playerId` /
  `scorerPlayerId` / `fromPlayerId` / `toPlayerId` in `data/matches/*.json` and asserts
  set-containment against `PINS`.

`data/matches/` **does not exist** and will not until Story 1.16 emits. So the run prints
`committed /data baseline unavailable … This is NOT a pass` and never reports success on a
baseline it never had — a check that returned green there would be a gate that cannot fail.

### The spine ADDS ids; it never removes names

`work/spine/entities.json` carries `teams` / `players` / `matches`, modelled on the
committed `data/fixtures/index/tournament.json` `entities` block so Story 1.16 emits from
it without a reshape. Each player carries a diagnostic `slug_source`
(`caps-run` | `as-listed` | `override`) — not identity, but what makes "which players slug
given-name-first?" a query rather than a re-derivation.

`work/spine/matches/{match_id}.json` is the record's `domains` block **structurally
unchanged, with an `*_id` field added beside every name field**, plus a `spine` header. No
key removed, no list reordered, nothing deduped: diffing a record against its spine file
shows only additions. That is not a style choice — `playerName` is `required` in eight
`$defs` of `match-bundle.schema.json`, and every committed fixture row carries `playerId`
**and** `playerName` side by side, so a name-stripping spine could not be emitted from.

Measured on the real corpus: **73,065 ids added across exactly 25 name paths**, matching
the independently measured 73,065 player-name occurrences one for one, plus the display
team names.

**23 of the 25 paths carry a shirt companion** and resolve on `(side, shirt_number)` with
the name as the *corroborating* key — the inverse of the extract layer's convention, and
correct here because this phase has a cross-report anchor the extract layer did not. A name
disagreeing with its shirt raises, with the name in `repr()` (a mis-inserted space breaks a
join on a name that looks right). **The two `receiving.offers.{side}.most_offers` paths
carry no shirt at all** — 208 occurrences — and resolve by verbatim name against that
match's lineup index. They are a required 1.16 input and are never skipped.

Because the spine only adds, the exhaustiveness assertion is the **inverse** of a coverage
list: walk the staged spine and assert every string equal to a known player name has a
resolved id sibling on the same object. That is what makes the 25-path inventory
self-maintaining — a 26th path added by a future story fails loudly instead of passing
through unresolved, and a hardcoded list would silently stop being complete. The negative is
pinned directly (`test_the_exhaustiveness_assertion_is_not_vacuous`), because an
exhaustiveness check that has never failed is not evidence.

Goals, own goals, cards and `substituted_on` / `substituted_off` are nested **inside** the
owning lineup entry and carry only a minute, so resolving the entry resolves them — nothing
is restructured. `goalkeeping.{side}.goalkeepers[]` duplicates name + shirt from Domain A
and is reconciled to the **same** id rather than resolved independently. All-zero
pass-network nodes are **not** pruned: 43 exist corpus-wide and every one keeps a resolved
id.

`matchdayRound` is required by both bundle schemas and no extractor produces it, so it is
derived here with `pipeline.discover.rounds.assign_matchday_rounds`. **This is the one place
the record's top-level `metadata` block is authoritative over `domains.match_metadata`**:
`domains` has no `stage_text`, lowercases `group`, and carries a full ISO `kickoff` that
raises `ValueError` inside `ReportMeta.kickoff_sort_key`. Note that `metadata` carries
neither `report_id` nor `source_path` — both come from the record's top level. Any
unresolved round is a failure, never a guess.

### Two FR-15 gate checks, and what they do NOT cover

`identity-completeness` (every lineup entry mints a valid, unique id; both team codes agree
with the registry) and `identity-pinning` (a pinned id still mints as pinned; an absent pin
emits nothing). Both are per-report, re-mint straight from the lineup page, and read
neither a record nor the spine — which makes them a real cross-check of the registry rather
than a restatement of it.

**Both cover only the sampled reports.** The corpus-wide guarantee is `check_pins` inside
the precompute CLI, not the gate. Reading "identity-pinning passed" as "all 104 reports are
pinned" is reading it wrong.

### Out of scope, deliberately

The camelCase mapping, `schemaVersion` stamping, budget measurement, the knockout score
shape, `storyStats`, aggregation, leaderboards and profiles are all Story 1.16's and
1.17's. **AC 2's "and aggregates" clause is explicitly deferred to Story 1.17**: no
aggregate exists yet to reference an id, and building one here would smuggle 1.17's work
into a story whose deliverable is the namespace. What 1.15 owes that clause is the
guarantee that makes it cheap — one id per entity, minted once, pinned.

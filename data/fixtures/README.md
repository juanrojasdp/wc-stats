# `data/fixtures/` — the contract's worked examples

These seven files are the AD-14 bootstrap: they exist so **Epic 2 is never blocked on the
pipeline**. Story 2.1 and everything after it build against these before a single real
Match Bundle has been extracted.

They are **committed artifacts, not build output**. Nothing regenerates them on demand; they
were authored once from the real corpus, hand-checked, and are now owned as files. Change
them the same way you would change any other source file — deliberately, and with the tests
green.

---

## What is here

| File | Covers |
| --- | --- |
| `matches/m001-mexico-south-africa.json` | Group match; `momentum` series present; `decidedBy: "regulation"` |
| `matches/m002-korea-republic-czechia.json` | Group match; **`momentum: null`** (the empty state) |
| `matches/m074-germany-paraguay.json` | Knockout; extra time **and** shoot-out; **own goal**; `ShootoutAttempt` rows |
| `index/tournament.json` | Group A standings with `rank` + form, results, entity lists |
| `index/leaderboards.json` | One team board (×2) and one player board, ranked |
| `index/team-profiles/mexico.json` | One full team profile |
| `index/player-profiles/quinones-julian-mex.json` | One full player profile |

Every file is stamped `schemaVersion: 1` and validates against `/contract`. The tests live in
`pipeline/tests/test_fixtures.py`.

---

## Provenance — what is real and what is not

Everything below marked **real** was read straight off the PDFs in `pmsr-corpus/` on
2026-07-22. This matters: it is what makes the fixtures hand-checkable against the source
reports rather than merely plausible-looking.

### Real, from the source reports

| Field group | Source page | Notes |
| --- | --- | --- |
| Teams, score, stage, group, venue, date, kick-off, shoot-out line | Cover | via `pipeline.discover.probe.probe_report` |
| Lineups — shirt number, position, name, formation | `Match Summary - Teams` | 11 starters + the full bench per team |
| **All of Domain B** (Key Statistics, 19 fields per team + contested possession) | `Match Summary - Key Statistics` | |
| **All of Domain C** phase percentages (8 in-possession, 9 out-of-possession) | `{home} Phases of Play {away}` | |
| Shot events — minute, player, outcome, outcome detail, body part, delivery type | `Attempts at Goal {team}` | |
| Set-play totals — set plays, free kicks, penalties, corners, throw-ins | `Set Plays {team}` | |
| **All of Domain G physical** — total distance, zones 1–5, high-speed runs, sprints, top speed | `Physical Data {team}` | |
| `storyStats` — all five Hero tiles | derived from the above | possession/shots/xG/distance from Domain B, top speed from Domain G |

The shot events self-validate against Domain B in all six team-innings: Mexico's 16 shot rows
contain exactly 4 with an on-target outcome, matching the printed `16 (4)`. The same holds
for South Africa `3 (2)`, Korea Republic `15 (6)`, Czechia `7 (4)`, Germany `21 (6)` and
Paraguay `7 (3)`. `pipeline/tests/test_fixtures.py` asserts it.

### Synthetic, deterministic, plausible

- **Every pitch coordinate** (`x`, `y`) on every event. Marker positions live in the PDF's
  vector graphics, not its text, so they are Stories 1.3 / 1.11–1.14's work. The values here
  are drawn from position-appropriate ranges and are stable across runs.
- **Momentum series** — OQ-5 has not resolved the real shape yet (see below).
- **Cross, receiving, pass-network and defensive-action events** — counts are tied to the
  real Domain B totals where one exists (crosses, forced turnovers), the rest are shaped.
- **Domain E goalkeeping** in full, though the attempts faced and goals conceded are real,
  and every category count sums back to its stated total.
- **Domain G in-possession and out-of-possession** per player.
- **Free-kick / corner breakdowns** — the totals are real; the splits beneath them are
  synthesised so that they add up to those totals.
- **Substitution minutes and card lists.** Cards are all empty: the lineup page renders them
  as coloured glyphs with no text, so no card is derivable today.

### The one deliberate departure from the source

`m074-germany-paraguay` carries an **own goal that the real report does not**. PMSR marks no
own goal anywhere in the 104-report corpus, so the only way to cover AC 5's `ownGoal: true`
edge shape was to author one.

It is done so that every real number still reconciles:

- Germany's single real goal-outcome shot is recorded as `on-target-saved` instead. Germany
  still has 21 attempts of which 6 are on target, matching the printed `21 (6)`.
- The goal is instead credited to Germany via an own goal put in by Gustavo GOMEZ, a real
  Paraguay centre-back. The `ShotEvent` belongs to **Paraguay** (AD-6: `teamId` is the
  shooting player's team) and carries `ownGoal: true`; the `GoalRecord` is credited to
  **Germany**, the team that benefited.
- Because an own goal is not an attempt at goal by the team credited with it, Paraguay's
  Domain B still reads `7 (3)` while their shots array holds 8 rows. The shot-count test
  excludes own goals for exactly this reason.

---

## The fixture world is deliberately partial

- **Entity lists name only what has an artifact.** `tournament.json` lists the three fixture
  matches, the one team with a profile (`mexico`) and the one player with a profile
  (`quinones-julian-mex`).
- **Standings and lineups reference entities with no profile.** Group A's table ranks all
  four teams; the team sheets name ~50 players. That is intentional and fine. AR-4's
  bijection assert runs against real `/data` in Story 1.17, not against fixtures.
- **Team and player profiles reference matches with no bundle.** Mexico's profile breaks down
  all three of its group matches; only `m001` has a bundle here.

What *is* enforced, and tested, is the other direction: every artifact that exists on disk is
listed in the entity index, so the route manifest never omits a page that has data behind it.

---

## Budget sanity check (AD-4)

An early read on the ≤ 500 KB per-artifact budget, **not** the enforcing gate — that is
measured over canonical bytes by the pipeline and fails the run on breach, in Story 1.16.

| Artifact | Canonical bytes | `gzip -9` |
| --- | --- | --- |
| `m074-germany-paraguay.json` | 197.4 KiB | 16.0 KiB |
| `m002-korea-republic-czechia.json` | 159.7 KiB | 13.3 KiB |
| `m001-mexico-south-africa.json` | 155.5 KiB | 13.5 KiB |
| `index/leaderboards.json` | 10.7 KiB | 1.1 KiB |
| `index/tournament.json` | 5.9 KiB | 1.0 KiB |
| `index/player-profiles/quinones-julian-mex.json` | 3.3 KiB | 0.8 KiB |
| `index/team-profiles/mexico.json` | 2.7 KiB | 0.8 KiB |

The largest bundle sits at roughly 40% of budget. The headroom is real but not vast, and the
biggest single contributor is the Domain D event arrays — `m074` is the largest precisely
because it ran 120 minutes. A real bundle with fuller event tables could plausibly approach
the limit, so Story 1.16 should treat the gate as load-bearing rather than a formality.

Note that `tournament.json` will grow by roughly two orders of magnitude against real data:
it carries 12 groups, 104 results and the entity list for every team and player in the
tournament, against one group and three matches here.

---

## Canonical serialization (AD-8)

Sorted keys, `indent=2`, `ensure_ascii=False`, UTF-8, LF, trailing newline — the same recipe
as `pipeline/validate/runner.py::_write`. A test asserts every fixture round-trips through it
byte-identically, and that none has picked up CRLF endings.

---

## Changing a fixture

Fixtures are downstream of `/contract`. Per AD-14, a shape change means: Epic 2 requests →
Epic 1 implements → logged decision in `contract/README.md` → `schemaVersion` bump → **the
fixtures and the generated types are regenerated in the same commit**. Never let a fixture
drift from the schema between commits; `pipeline/tests/test_fixtures.py` is what stops it.

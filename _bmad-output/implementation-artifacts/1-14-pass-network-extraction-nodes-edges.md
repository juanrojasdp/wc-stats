---
baseline_commit: c645cfe
---

# Story 1.14: Pass-Network Extraction — Nodes & Edges

Status: review

## Story

As the builder,
I want the player-to-player pass matrix and node positions extracted per team per match,
So that the App can render pass networks from true data (FR-13).

> **The epic's premise is half wrong, and the story-creation probe measured it over all 104 reports / 208 team-innings.** The pass matrix is real, complete, and richer than the epic assumed — every cell, every endpoint, every volume. **Node positions do not exist.** The "Passing Networks {team}" page carries **no pitch, no markers and no coordinates of any kind** (0 pitch frames on 208/208 pages), and no page anywhere in the 52-page report prints average positions. `PassNetworkNode.x`/`y` are therefore unfulfillable, exactly as `deferred-work.md:294` predicted. AC 1's edge half stands in full and is built as written; AC 1's node half is re-scoped by AC 2's BINDING block below and filed as an AD-14 emission blocker (Task 7). Everything else in the epic's story statement stands.

## Acceptance Criteria

The epic's ACs are reproduced **verbatim**, each followed by the **binding reconciliation** the story-creation probe forced. Read both — the probe overturned half the epic's premise and the reconciliation is what you build to.

The epic prints **two** Given/When/Then blocks (`epics.md:483-498`); the first block's `Then` and `And` clauses are numbered 1 and 2 here because the probe overturned only the second.

---

**1. Given** a pass-network page **When** extraction runs **Then** `PassNetworkEdge` rows carry two player endpoints and positive-integer volumes, and every endpoint references a player in that team's Domain A lineup — an unmatched endpoint fails the report loud. [Source: epics.md:493]

> **BINDING (probe-confirmed, 208/208 team-innings — this AC is satisfiable in full and is the story's core deliverable).**
>
> The page prints a square **N×N directed pass matrix**, rows = "Passes From", columns = "to", N ∈ {13,14,15,16,17}. Every off-diagonal cell is present and is a non-negative integer; the diagonal is blank (no self-pass). **An edge is a non-zero cell.** A zero cell is an absent edge — never stage a zero-volume edge (the schema's `volume` is `minimum: 1`, "a zero-volume edge is simply absent", `match-bundle.schema.json:669-674`).
>
> Measured corpus-wide: **23,597 edges**, volumes **1–48**, 25,217 zero cells — together the **48,814** off-diagonal cells that Σ N(N−1) over the N distribution below requires. (Use that identity as your own arithmetic check in Task 1: if your edge count plus your zero count is not 48,814, you have dropped innings.) The matrix is genuinely directed — **9,151** reciprocal pairs of which **6,835 are asymmetric** (`a→b ≠ b→a`), so never symmetrize, never collapse a reciprocal pair, never dedup.
>
> The join is **fulfillable and clean**: all **3,289** matrix rows join to that side's Domain A lineup by **verbatim name**, and the shirt number corroborates on **3,289/3,289** — zero unmatched, zero disagreements. Endpoint identity is therefore `{name, shirt_number}`, resolved within-report only. **Do not mint a `player_id`** — cross-report identity is Story 1.15's (the 1.10 ruling, `deferred-work.md:175`).

**2. And** `PassNetworkNode` rows carry player ID + x/y in the AD-6 frame, extracted from the page — never derived from edges. [Source: epics.md:494]

> **BINDING (probe-forced overturn — measured over all 104 reports / 208 pass-network pages).**
>
> **No `PassNetworkNode` row with coordinates is producible, and none may be fabricated.** This is exactly the risk `deferred-work.md:294` routed here, now measured and answered.
>
> The evidence, all re-derivable by Task 1:
> - **0 pitch frames on 208/208 pass-network pages**, measured with `filter_chain.detect_pitch_frames`' own qualifying rule. The page's only sub-page rectangles are the table's own blue header cells. Every other spatial page in the report has a pitch rect at the family's 0.70 aspect ratio (shots 363.0×517.9, crosses 258.7×370.1, defensive actions 207.0×295.5, offers 192.0×274.5); this page has none.
> - **0 markers.** `collect_candidate_markers` can return nothing here: there is not one all-Bézier filled drawing on the page. Its only curve content is two mixed `c`+`l` glyphs — the ~9–10 pt header sort arrows at y≈99–109 (9.02×10.50 and 10.50×9.02, white fill), constant at 28 `c` and 12 `l` on 208/208. (Rectangle count scales with N — 260/292/326/362/400 for N=13/14/15/16/17 — so do not pin a single `re` count as a family fact.)
> - **The single image is a 36×36 pt competition logo**, bbox (912.0, 39.75, 948.0, 75.75) on 208/208. It is not a rasterized pitch.
> - **No average-positions page exists anywhere.** A corpus-wide title scan over every page of all 104 reports finds **0** matching `Average Position|Positions|Avg`, and **0 pitch-bearing pages are unanchored** — so there is no unclaimed page where positions could be hiding. (Note the weaker true statement: *anchored* is not *parsed*. `line-breaks:{home,away}` and `defensive-pressure` do carry pitch rects and have no parser yet; neither is titled with positions, and neither is this family's page.)
>
> **Citation correction, recorded not applied.** The epic's AC text cites **AD-6** for the frame, which is correct. But the extract-never-derive rule itself is **AD-3** (`ARCHITECTURE-SPINE.md:62`), restated in the schema description (`match-bundle.schema.json:640`) — and `epics.md:84`'s AR-3 **drops the event-table clause entirely**, so a reader working from the epics alone finds the rule in neither AR-3 nor AR-6. Story 2.8 recorded the same numbering drift (`2-8-pass-network-visualization.md:334`).
>
> **How this AC is satisfied instead** — the 1.13 recipe (`deferred-work.md:195`):
> - **(a)** Every node field the page *does* prove is staged per player: `name` → `playerName`, `shirt_number` → `shirtNumber`, and `passes_made` (row sum) + `passes_received` (column sum), **whose sum is the contract's `involvement`** (`match-bundle.schema.json:640`). With `teamId` from the side and `playerId` from 1.15 that is **5 of `PassNetworkNode`'s 7 required fields** — only `x` and `y` are absent.
>   **Binding for Story 1.16: `involvement` is derived from the matrix (`passes_made + passes_received`), never from Domain G's `passes_completed + offers_received`.** The two sources disagree — the matrix row sum is strictly below Domain G's `passes_completed` on 1,290 of 3,289 rows (Task 4.3) — and only the matrix source is internally consistent with the edge table this story stages beside it.
> - **(b)** `node_positions` is staged as an explicit `null` with a **documented-absence warning** (never a failing check — the 1.9/1.12/1.13 branch), so the absence is published rather than implied by a missing key.
> - **(c)** The gap is filed as an AD-14 emission blocker (Task 7) naming its three owners: Story 1.16's emission, Story 2.8's shipped surface, and the stale Story 2.3 sign-off row.
>
> **Explicitly forbidden** (each is a real temptation and each would be fabrication):
> - Deriving positions from the edges — a force layout, a spring embedding, a centroid-of-neighbours pass. This is precisely what AD-3 bans, and Story 2.8 has already shipped a renderer that plots whatever it is given.
> - Synthesizing positions from the lineup **formation string** (`"4-1-2-3"`) or from `position` (`gk|df|mf|fw`). A plausible-looking coordinate is worse than an honest absence: it is unfalsifiable downstream.
> - Lifting the fixtures' coordinates. They are hand-authored (`data/fixtures/README.md:69-78`) and are not ground truth for anything.

**3. Given** the venue × matchday sample **When** the FR-15 gate re-runs **Then** pass-network anchors and join integrity appear in the deviation summary. [Source: epics.md:496-498]

> **BINDING.** Two new gate checks, `pass-network-completeness` and `pass-network-counts`, registered in `pipeline/validate/checks.py` on the Domain G pattern. The anchor half needs no new work — `pass-network:{home,away}` is already in `ANCHOR_REGISTRY` (`pipeline/discover/anchors.py:75`) and `anchor-coverage` already walks it. "Join integrity" is the AC 1 join: an unmatched endpoint surfaces as a `probe-failure` deviation carrying `PlayerJoinError` and its message.

---

## Tasks / Subtasks

- [x] **Task 1: Re-derive the probe yourself before writing any parser code** (no AC; do this first)
  - [x] 1.1 Measure your own baseline first: run the suite (`pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`) and record the pass/skip/fail counts **with attribution for every pre-existing failure**. Story 1.9 is in `review` and shares this working tree; do not inherit its numbers as yours.
  - [x] 1.2 Write your own script (session scratchpad — `spike/` is read-only, AR-16) and re-derive **every pinned fact** in Dev Notes → "Corpus sweep results" over all 104 reports. Record the figures verbatim in the Dev Agent Record. **Do not copy the table forward unverified** (the 1.13 rule). If a number disagrees with this story, your measurement wins and the disagreement is the finding.
  - [x] 1.3 Re-confirm the negatives independently, because the whole node re-scope rests on them: (a) **0 pitch frames** on all 208 pass-network pages — use the same qualifying-rect rule `filter_chain.detect_pitch_frames` uses (stroked `"re"`, `10000 < area < 0.8 × page_area`) and report the count it returns; (b) **0 pages** anywhere in the corpus whose title matches average/positions. If either fails on any report, **stop and escalate** — the node re-scope is void and the story needs a fresh ruling.
  - [x] 1.3a Measure one thing this story has **not** measured: **does any row label wrap?** Task 2.6's `y-6 .. y+12` band assumes one line per row label. 1.13's pre-filed probe missed a **three-line player name** in the analogous table and the first full-corpus sweep failed on four reports (M41, M61, M78, M99). Report the maximum line count per row label over all 208 innings; if any exceeds 1, the name must be gathered from the name x-band across neighbouring lines (the `crosses.py` / `defensive_actions.py` precedent) before you ship.
  - [x] 1.3b Verify M92 Jordan HENDERSON's **column** is all-zero, not only his row (Task 3.5 rules both directions and only the row was measured at story-creation time).
  - [x] 1.4 Build an **independent prototype extractor** (the 1.13 precedent) and run it beside the shipped parser over all 104 reports, comparing **cell by cell**. The matrix is ~43,000 scalars; a column-assignment slip is invisible to any aggregate check, so this comparison is the real proof.

- [x] **Task 2: `pipeline/extract/pass_network.py` — the parser** (AC: 1, 2)
  - [x] 2.1 Module placement is **ruled**: `pipeline/extract/`, beside `domain_g.py`. Reasons, in order: the page has **no pitch frame, no markers and no coordinates**, so the shared filter chain has literally nothing to do here (unlike 1.13's offers page, which at least had pitch-panel geometry worth guarding); it **joins Domain A lineups**, which is the `extract/` convention and whose `PlayerJoinError` / `MissingFieldError` live in `extract/errors.py`; and the page is a table read through `lines.py`, which is `extract/`'s reader. **The module docstring must open by stating that this page draws no pitch and no markers**, that it therefore stages a matrix rather than events, and why it still feeds a Domain D contract table — otherwise the next reader looks for the marker parser that is not there. *(Recorded alternative: `pipeline/markers/pass_network.py` on 1.13's "this is Domain D" reasoning. Rejected because 1.13's other stated reason — that `extract/` was off-limits while 1.10 was in flight — no longer applies, and nothing in this page is spatial.)*
  - [x] 2.2 Public entry point, matching the Domain G shape exactly: `def extract_pass_network(doc, anchors, lineups, report_id=None) -> dict:`. Pure — no I/O beyond the open `pymupdf.Document`, no cross-report knowledge (AD-9). Companion `def pass_network_checks(payload, player_stats=None, key_statistics=None) -> list[dict]:` and `def pass_network_warnings() -> list[str]:`.
  - [x] 2.3 Anchor-stem constant at module scope: `PASS_NETWORK_ANCHOR_STEM = "pass-network"`, imported by `checks.py` so the gate's anchor list can never drift from the parser's (the `domain_e.py:76-79` precedent). Locate pages as `anchors.get(f"{stem}:{side}")` → assert non-empty → assert exactly 1 (208/208 corpus-verified). **Never index a page number** (AD-8).
  - [x] 2.4 **Column geometry is the production rule, and it is read from the header cells — not from text order.** This is the single most important implementation fact in the story. Blank cells are simply absent from the text layer, so `page.get_text()` returns a *ragged* stream in which row 3's fourth value silently becomes row 3's fifth. Build the column grid from the blue header rectangles (fill `(0.18, 0.30, 1.00)`, `85 < y0 < 95`, **height > 20**): sort by `x0`, then identify the two leading cells **by their text, not by index** (AD-8): cell[0]'s text must be `#` and cell[1]'s must begin `Passes From`. A header whose first two cells do not carry those texts is a template revision → `PassNetworkParseError`. The player columns are **every remaining cell**. The `height > 20` predicate already excludes the Top-5 panel (height 13.5), so the qualifying set is exactly `N + 2` cells on **208/208** and the run exhausts it — assert that count rather than stopping at a gap. (Note all cells butt against each other including the two leading ones, so "the contiguous run" alone does not identify where the player columns start; that is why the two leading cells are text-anchored.)
  - [x] 2.4a **Column widths are NOT uniform — not within a page, and not derivable arithmetically.** Measured over 208 innings: widths range **27.75 – 58.5 pt**; columns are non-uniform *within* the page on **156 of 208** innings; the 52 uniform pages are all exactly 36.0 pt and occur at **N=15, 16 and 17** — not "N=16 only". 36.0 pt appears as at least one column width on **208/208**, so it is the family minimum, not an N=16 artifact. The enclosing span is **not fixed** either: the right edge is 748.5 on 204/208 (749.25 / 753.0 / 756.75 on the other four) and the left edge takes **56 distinct values** from 126.75 to 255.75. Consequences, both binding: **(a)** never hardcode 36 pt — it is wrong on 156 of 208 innings, and the failure set is *not* "the non-16 ones"; **(b)** never compute widths as `span / N` — that model is wrong too (N=13 measures 37.90–40.38 pt, not the ~44.3 a fixed span would give). **Each column's extent is read from its own header rect and nothing else.**
  - [x] 2.5 Assign each cell to its column by **x-containment within that column's own header rect**, then assert the census: exactly `N` columns, exactly `N` rows, exactly one blank per row, and that blank at position `i` in row `i`. Anything else → typed error. **Do not assign by nearest centre or by left-to-right ordinal over present values** — "closest wins" is the ruled anti-pattern (`1-13-…md:601`) and ordinal assignment over a ragged row is exactly the bug this task exists to prevent.
  - [x] 2.6 Row labels: `shirt_number` then `name`, read from the span region left of the first player column, `y-6 .. y+12`. Assemble the name with `lines.join_spans` semantics and print it with `repr()` in every error message — a mis-inserted space breaks the join and surfaces as a `PlayerJoinError` on a name that *looks* right (the 1.10 landmine, `1-10-…md:326`).
  - [x] 2.7 **The hyphen-wrap trap, corpus-measured on exactly 24 of 208 innings, spread over 24 distinct reports (one inning each).** A hyphenated surname wraps inside the narrow *column header* cell, so joining its two lines with a space yields `'Ben GANNON- DOAK'` against the row label's `'Ben GANNON-DOAK'`. Known affected reports include M05, M06, M16, M19, M21, M23, M30, M32, M39, M44, M48, M49, M60, M61, M64, M68, M69, M72, M77, M80, M85, M88, M97, M103 — re-derive and pin the exact list in Task 1. **Ruled resolution: take the canonical player list from the ROW labels, never from the column headers.** Row order == column order on 208/208 (Task 2.8), and the row label carries the shirt number the header does not. Read the headers only to *place* the columns geometrically and, if you compare their text at all, normalize `"- "` → `"-"` before comparing and assert the match — never silently repair it.
  - [x] 2.8 Assert **row order == column order** (208/208, hyphen-normalized). This is what makes cell `[i][j]` mean "row-player i → column-player j" without a second name lookup per cell. If it ever fails, raise — do not fall back to per-cell name matching.
  - [x] 2.9 Values are non-negative integers, parsed with `re.ASCII` on the digit class (fullwidth digits otherwise pass `int()`). Raw and locale-neutral (AD-7) — no `%`, no display strings, no units.
  - [x] 2.10 Typed errors in `pipeline/extract/errors.py`, **append-only**: `PassNetworkParseError` (structural: anchor resolving to ≠1 page, wrong column/row census, a cell that is not an integer, row order ≠ column order, a non-blank diagonal). Reuse `PlayerJoinError` and `MissingFieldError` as-is for the join — they name exactly these two failure kinds and the module rule forbids overloading one class for two (`pipeline/extract/errors.py:1-8`). Never a bare `ValueError`.
  - [x] 2.11 Deterministic order everywhere (AD-8): players in **printed row order**; edges sorted by `(from_index, to_index)` i.e. the matrix's own reading order. No dedup, ever.
  - [x] 2.12 **Ship the absence as a standing assertion, not a comment — the 1.13 discipline, and it applies with more force here.** 1.13 kept the shared chain in the production path over decoration it staged nothing from, precisely so that *"if a future template ever draws real markers there, **silence is the worst outcome**"*. Here the entire AD-14 filing, the `node_positions: null`, the warning, and Story 2.8's re-scope all rest on "this page draws no pitch and no markers" — a negative that Task 1.3 otherwise confirms exactly once, at implementation time. So assert it **every run**: call `detect_pitch_frames(page)` and require it to raise `PitchFrameError` (0 qualifying rects), and require 0 filled all-Bézier shapes in the marker size window anywhere on the page. Anything else → `PassNetworkParseError` naming the count and the page. **This is what makes the AD-14 filing self-maintaining:** the day the vendor starts printing coordinates, the corpus aborts loud instead of publishing `node_positions: null` forever. Pin it with a test that draws a pitch rect on a synthetic pass-network page and asserts the raise. *(Note this is the one place the shared chain is imported — read-only, as an assertion, staging nothing. Task 2.1's "the chain has nothing to do here" means it is not a data source, not that the page goes unguarded.)*

- [x] **Task 3: The Domain A join** (AC: 1)
  - [x] 3.1 Take `lineups` as a parameter and let the record seam hand you `match_metadata["lineups"]`. **Never re-parse the lineup page** (`domain_g.py:6-8`).
  - [x] 3.2 Copy Domain G's `_join_index` / `_join_row` shape (`domain_g.py:411-478`): key on the lineup entry's `name` **verbatim** — never normalized, folded, fuzzy-matched, or falling back to the shirt number (AD-8; cross-report identity is 1.15's). Build the index with an explicit duplicate guard raising `PlayerJoinError`, never a dict that silently collapses two players.
  - [x] 3.3 Unmatched name → `PlayerJoinError` naming side, shirt, and the assembled name in `repr()`. Shirt disagreement with the matched entry → `PlayerJoinError` (the **corroborating** key; 0 disagreements on 3,289 corpus rows).
  - [x] 3.4 **The asymmetry — write the unused-substitute test FIRST** (the 1.10 rule, `1-10-…md:325`). Reuse `domain_g.has_minutes(entry, section)`. Corpus-measured for this family: **2,288 starters + 1,000 substitutes-who-came-on** appear in the matrix; **2,103 unused substitutes have no row and that is correct** — not a finding, not a warning. A lineup player **with** minutes and no matrix row → `MissingFieldError`. This reconciles exactly with Domain G: 3,289 rows + 2,103 unused = 5,392 lineup entries, the same three numbers Story 1.10 recorded.
  - [x] 3.5 **The one tolerated anomaly, and it is the same player Domain G tolerates.** `PMSR-M92-MEX-V-ENG` away **#14 Jordan HENDERSON** — an unused substitute (booked from the bench) who carries a matrix row. His row is **all zeros** (0 passes made), so the page is merely verbose, not contradictory. Tolerate an all-zero row for a no-minutes player; a row with **any** non-zero cell for a player the lineup says never played is a contradiction and must raise `PlayerJoinError`. Copy `domain_g.py:552-566` verbatim in shape, and pin M92 with its own test. **The same rule applies to his column** — a teammate passing *to* someone who never played is the same contradiction in the direction Domain G has no analogue for. Assert both directions; verify Henderson's column is all-zero in Task 1.3b rather than assuming it.

- [x] **Task 4: Self-Validation — the printed Top-5 panel is the counterpart** (AC: 1)

  **Check ids are ruled here. Self-Validation ids and FR-15 gate ids are two different registries — never reuse one as the other** (the Domain G precedent: SV ids `domain-g-zone-sum` / `domain-g-distance-reconciliation` / … against gate ids `domain-g-completeness` / `domain-g-counts`). Tasks 8.8 and 8.11 filter on these exact strings:

  | Self-Validation id | relation | subtask |
  | --- | --- | --- |
  | `pass-network-top5-pct` | printed Top-5 pct == `100 × cell / matrix_total`, tolerance `<= 0.05` | 4.2 |
  | `pass-network-row-bound` | `sum(row_i) <= player_stats[side][i].in_possession.passes_completed` | 4.3 |
  | `pass-network-total-bound` | `matrix_total <= key_statistics[side].passes_completed` | 4.4 |

  The gate ids `pass-network-completeness` / `pass-network-counts` (Task 6.1) are separate and must not be reused here. **`matrix_total`** is the one name for "sum of every matrix cell" — use it in code, payload, `specifics` and prose alike.

  - [x] 4.1 The right-hand panel "Top 5 Player to Player Passers" is present on **208/208** and prints five rows of `Player | Passed To | % of Total Team Passes`. Read the five percentages from the region right of the last player column. **Percentages print with or without a decimal** — `3.8%` and `3%` both appear on the reference page — and always carry a trailing `%`. Parse with an explicit `re.ASCII` pattern accepting both forms; do not let them fall through a bare `\d+` cell filter. `3%` is `3.0` with a stripped trailing zero, not integer precision, so the 0.05 tolerance still applies.
  - [x] 4.1a **The panel's player names are NOT staged and are NOT a check operand.** They wrap across lines, which defeated a naive one-line read on 12 of 208 innings in the probe, and the percentages alone carry the whole check. `top_ranked_pairs` therefore stages `{rank, percent_of_total}` only (Task 5.4). *(If a later story wants the names, it owes the wrap recipe — gather from the name x-band across neighbouring lines, the `crosses.py` / `defensive_actions.py` precedent 1.13 was forced to adopt. Do not improvise it here.)*
  - [x] 4.2 **The primary check, corpus-TRUE on 1,040/1,040 percentages (208 innings × 5):** each printed percentage equals `100 × cell / matrix_total`, and the five printed rows are the five largest cells in descending order. **Worst observed absolute delta is exactly 0.05** — the half-ulp of 1-decimal rounding — so the tolerance is `<= 0.05`, derived from printed precision and corpus-verified, not a fudge. Note the three worst cases evaluate to `0.04999999999999982` in float, so compare with `<=` and do not tighten the constant or restructure the arithmetic without re-measuring. The five values need not be distinct (the reference page ties two at 13). Ship as **`pass-network-top5-pct`**.
  - [x] 4.3 **Ship the bound, not the equality** (the 1.8/1.9/1.12 rule). `sum(row_i) <= player_stats[side][i].in_possession.passes_completed` holds **3,289/3,289**; equality is corpus-FALSE on **1,290** of them (M01 home RANGEL 27 vs 29, REYES 40 vs 47, GALLARDO 32 vs 46 …). The matrix never exceeds Domain G. Ship as **`pass-network-row-bound`**, record the per-report delta in `specifics` on every report so the gap stays visible, and **do not close it by making the numbers agree.**
  - [x] 4.4 Same shape one level up: `matrix_total <= key_statistics[side].passes_completed` holds **208/208** and is **strictly less on 208/208** (M01 home 470 vs 495, away 278 vs 290). Ship as **`pass-network-total-bound`**; record the delta.
  - [x] 4.5 **Corpus-FALSE — do not ship, and say so at the would-be call site.** `sum(col_j)` vs Domain G `offers_received` is false in *both* directions: 3,145 greater, 121 equal, 23 less. There is no relation here. Comment it where a reader would reach for it, in the `domain_g.py:683-691` shape.
  - [x] 4.6 Cross-domain checks go at the **`extract_report.py` seam**, never inside the parser (the 1.7/1.10/1.13 precedent). If `player_stats` or `key_statistics` is unavailable, **emit no check rather than a failing one** — one root cause, one finding.
  - [x] 4.7 Emit **exactly one dict per check id covering both sides**, with `specifics` naming every offender in page order so re-runs are byte-identical. Use `check_entry(check_id, passed, specifics)` from `pipeline.extract` — `result` is the literal `"pass"`/`"fail"` string, never a bool.

- [x] **Task 5: Record seam + documented absence** (AC: 1, 2)
  - [x] 5.1 Wire into `pipeline/ingest/extract_report.py` at its **two seams only**, strictly additive: the parser call inside `with doc:` and **outside** the `ProbeError` handler (so typed errors travel as themselves), placed after `match_metadata` since it needs lineups; and `"pass_network": pass_network` in the `domains` dict. Update the module docstring's story ledger and `extract_report`'s raises list — every prior story did.
  - [x] 5.2 Append **one** `self_validation["checks"].extend(pass_network_checks(...))` **after every existing appender** and before `self_validation["result"] = aggregate_self_validation(...)`. Never reorder an existing check.
  - [x] 5.3 `warnings.extend(pass_network_warnings())` in the warnings block. The warning text must name the absence and its reason, e.g. `"pass_network: node_positions is not extractable — the Passing Networks page carries no pitch, no markers and no coordinates (0 pitch frames on 208/208)"`. **A warning, never a check** — the aggregator treats anything but the literal `"pass"` as a failure, and a documented absence must not turn a complete report into a failing one.
  - [x] 5.4 Payload shape — snake_case staging, **no `/contract` import, no camelCase, no `player_id`** (identity is 1.15's). Record JSON keys are snake_case; any contract kebab code travels as a *value*, never a key (the slip that caught both 1.12 and 1.13):
    ```
    domains.pass_network = {
      "home": {
        "players": [ {"name","shirt_number","passes_made","passes_received"}, ... ],   # printed row order
        "edges":   [ {"from_name","from_shirt","to_name","to_shirt","volume"}, ... ],  # matrix reading order
        "matrix_total": int,
        "top_ranked_pairs": [ {"rank","percent_of_total"}, ... ],   # printed order, 5 rows.
                                                                   # NAMES ARE NOT STAGED — they wrap across
                                                                   # lines on 12 of 208 innings and carry no
                                                                   # check (Task 4.1a).
        "node_positions": None,                                                        # documented absence
      },
      "away": { ... },
    }
    ```
  - [x] 5.5 Payload is **all-or-nothing** — no partial pass-network block ever stages (`domain_g.py:498-499`).
  - [x] 5.6 `RECORD_VERSION` does **not** need bumping — `code_version()` already covers an in-tree shape change (`records.py:120-123`).

- [x] **Task 6: FR-15 gate checks** (AC: 3)
  - [x] 6.1 Register the **gate** ids `pass-network-completeness` and `pass-network-counts` in `pipeline/validate/checks.py` on the Domain G pattern (`checks.py:1086-1099`). These are distinct from Task 4's Self-Validation ids and must not be conflated. **Never name a check `offers-*` or `movement-*`** — `offers-count-match` is `test_checks_registry.py`'s live unclaimed placeholder and `register_check` raises on duplicates. Confirm the placeholder id is still unclaimed before you commit to these names.
  - [x] 6.1a Update the module docstring's `Registered here today:` inventory (`checks.py:9-72`) in **registration order**, following the `receiving-parse` / `receiving-count-match` entry's two-column shape (`:49-55`). Story 1.10's review filed a patch for inserting out of registration order — append at the end, do not interleave.
  - [x] 6.2 Add a one-slot per-document memo (`_pass_network_memo` / `_pass_network_payload` / `_pass_network_uncached`) **copying** `_domain_g_memo`'s shape verbatim, appended at the end of the module. **Copy-don't-extend** — the memo pattern carries open deferred-work entries and this makes the **twelfth** instance (`checks.py` already holds eleven); do not refactor the existing ones.
  - [x] 6.2a The uncached function must resolve pages through **`_domain_anchor_pages(doc, meta, _PASS_NETWORK_ANCHOR_IDS)`** — never a hand-rolled `resolve_anchors` loop. The 2026-07-27 review patch (`checks.py:1275-1289`) removed exactly that inlined copy from `receiving`, where it raised a report-data error on all 104 reports for what was an authoring bug. **Four older domains still carry the unpatched shape**, so "copy a neighbour" is a coin flip — copy the receiving one.
  - [x] 6.3 `_check_pass_network_completeness` → `except ExtractError as exc: return _extract_failure_deviation(...)` (category `probe-failure`); `_check_pass_network_counts` → `except PipelineError: return []` then `_failed_check_deviations(...)` (category `count-mismatch`). **Deviation categories are frozen at four** — never add a fifth.
  - [x] 6.4 **Known forced test repair (the one your registration necessarily breaks):** `pipeline/tests/test_runner.py:133-166` asserts the exact, sorted `checks_run` list. Insert both ids in sorted position — between `momentum-coverage` and `receiving-count-match`. Keep the edit minimal; other sessions touch this file.
  - [x] 6.5 `verify.py::format_summary` needs **no change** — it renders deviations generically. `batch.py::format_summary` needs none either: `check_entry`-shaped checks take its generic `specifics` fallback. If you do add a branch, key it on the **exact check id**, never sniff for a payload key.

- [x] **Task 7: AD-14 filings — the deliverable this story owes downstream** (AC: 2)
  - [x] 7.1 File in `deferred-work.md` under `## Filed by Story 1.14 implementation (…)`: **`PassNetworkNode.x`/`y` are unfulfillable — the corpus prints no pass-network coordinates anywhere.** Quote the required-field list from `match-bundle.schema.json:637-657` with line numbers; give the corpus-wide measurement (0 pitch frames / 0 markers / 0 positions pages on 208/208); compare to the two prior blockers (this one is **narrower** than 1.13's `ReceivingEvent`, which was unfulfillable in *every* field, and narrower than 1.11's `CrossEvent` — here **5 of 7** node fields are available and only `x`/`y` are missing). Route it to **CS-1's successor change-set, never CS-1**. `/contract` is **not** edited by this story.
  - [x] 7.2 Name the three owners explicitly, each of which needs a decision:
        **(1) Story 1.16** can emit `events.passNetworkEdges` in full, but can only emit `events.passNetworkNodes: null` unless AD-14 relaxes `x`/`y` — and the two tables are independently nullable (`match-bundle.schema.json:792-801`), so a null node table beside a populated edge table is *schema-legal today*. It nonetheless collides with `test_pass_network_edges_join_players_who_have_a_node` (`test_fixtures.py:497-503`), which builds its node set from `bundle["events"]["passNetworkNodes"]` with **no `or []` guard** — a `null` node table makes it raise `TypeError` rather than fail cleanly per edge. That test parametrizes over `data/fixtures/`, so the collision lands when the fixtures are refreshed with real data (1.18/1.19), **not** the moment 1.16 emits — but it must be ruled before either. **That is the decision 1.16 must take, and it must be surfaced before 1.16 starts.**
        **(2) Story 2.8** has shipped a pass-network surface, and it fails **closed**, in two different ways that 1.16 must be told apart — neither is a graceful degradation:
        &nbsp;&nbsp;• `passNetworkNodes: **null**` + populated edges → `app/src/lib/tactical-sections.ts:124-125` requires **both** tables non-null (2.8 ruled decision 13, pinned by `tactical-sections.test.ts:193-199`), so `sectionDataState` returns `empty` and the **whole `#pass-networks` section renders `EmptyStatePanel`**. The fully-real pass matrix never reaches the reader.
        &nbsp;&nbsp;• `passNetworkNodes: **[]**` + populated edges → `pass-network-model.ts:336` throws on every unresolvable endpoint inside `TacticalErrorBoundary`, which wraps the whole layer — **all eleven Tactical sections die**, not just this one. That blast radius is an open, unpatched 2.8 review finding (`deferred-work.md:7`).
        &nbsp;&nbsp;**Binding for 1.16: emit `null`, never `[]`.** Re-scoping the surface so the edge table renders without nodes is 2.8's or a successor's call, not 1.14's — but it must be surfaced before 1.16 emits, because until it is ruled the honest emission hides this story's own best data.
        **(3) The Story 2.3 sign-off row for `#pass-networks` is stale** — `contract/README.md:509` records PASS, reached from schema line numbers and fixture counts, **never from a PDF** (`2-3-…md:209`). 1.13 recorded exactly this staleness for the offers/movement row; this entry supersedes the pass-network row the same way.
  - [x] 7.2a **Shape note — name the staged payload as the candidate replacement input** (the 1.11/1.13 filing pattern; without it the ledger entry is not actionable for the successor change-set). File beside 7.1: the corpus is *poorer* than `PassNetworkNode` in one dimension and *richer* in another. Poorer: no `x`/`y`, anywhere, ever. Richer: the matrix carries `passes_made` and `passes_received` **separately** where the contract models only their sum, plus a per-team `matrix_total` and a printed top-5 ranking — **none of which has a contracted destination**. State explicitly that a coordinate-free node shape (`playerName`, `shirtNumber`, `passesMade`, `passesReceived`, `involvement`) is **fully populatable from `domains.pass_network` today**, whereas the x/y shape can never be. That is the concrete proposal the successor change-set needs.
  - [x] 7.2b **Close an open 2.8 ledger question — this story can answer it outright.** `deferred-work.md`'s 2.8 entry "A self-loop pass edge reads '1 conexión' but highlights nothing when isolated" is explicitly *"Deferred until 1.14 shows whether the source page can produce one."* **It cannot.** The matrix diagonal is blank on 208/208, so `fromPlayerId === toPlayerId` is unreachable from this source by construction. Strike or annotate that entry with the measurement — the App-side defect is real but unreachable from real data, which changes its priority, and leaving the question open after this story has answered it wastes the next reader's time.
  - [x] 7.3 File a second, smaller note: **`involvement` will equal the incident-edge sum exactly on real data — *provided* 1.16 derives it from the matrix**, as AC 2(a) binds it to. Under that derivation `involvement = passes_made + passes_received` is *identically* the sum of a node's incident edge volumes, so the fixture-derived invariant `node.involvement >= sum(incident edges)` (`test_fixtures.py:811-829`) tightens from `>=` to `==` once real data lands — the fixtures' edges being a hand-authored subset (2.8 measured 28 of 66 nodes at equality, the rest strictly greater). **State the dependency explicitly:** if 1.16 instead sourced `involvement` from Domain G (`passes_completed + offers_received`) the equality would be false, because the matrix row sum is strictly below Domain G's on 1,290 of 3,289 rows. Flag it so 1.16 does not read the tightening as a bug, and so nobody "fixes" the fixture invariant in the wrong direction.
  - [x] 7.4 Record in the story that `epics.md:84`'s AR-3 **drops the event-table clause** of AD-3, so the extract-never-derive rule survives outside `ARCHITECTURE-SPINE.md:62` only in the schema description (`match-bundle.schema.json:640`) — a reader working from the epics alone will not find it. The epic's own AC 2 cites AD-6 for the frame and that citation is **correct**; do not "fix" it. Do not edit `epics.md`; record it.

- [x] **Task 8: Tests** (all ACs)
  - [x] 8.1 **`conftest.py::make_report` — the emitter MUST be default-on.** This is the most reliably fatal trap in the project and it has bitten 1.3, 1.6, 1.7, 1.10, 1.11, 1.12 and 1.13. `make_report` auto-generates anchor pages from `ANCHOR_REGISTRY`, so a **text-only** `pass-network:{home,away}` page exists today; the instant `extract_report` runs your parser unconditionally, every synthetic-report consumer (`test_ingest_record`, `test_ingest_batch`, `test_runner`, the Domain A/B/C/E/F/G tests …) hits it and dies. Add a real matrix drawer plus a `default_pass_network_block(...)` **derived from the report's own lineup rows**, not from invented literals, and wire it default-on.
  - [x] 8.1a **Draw every cell with its own `insert_text`, at its own x, inside its column's header rect.** `pymupdf` **merges adjacent same-font inserts into a single span** — the 1.10 landmine, re-filed as a review patch (`_g_row_head` printed each name with one `insert_text`, so every synthetic test saw a single name span). If the drawer emits a row as one string, the parser sees one span, x-containment becomes meaningless, and **every test in Task 8 passes over a page that cannot exercise Task 2.4 — the rule they exist to prove.** Add a named test asserting a parsed row yields N−1 distinct spans, so the fixture cannot silently regress to one.
  - [x] 8.2 Give the drawer a `pass_network_decorate=None` hook, invoked last, following the family convention.
  - [x] 8.3 **The fixture must make the refuted relations FALSE by construction**, and a named test must assert both that they are false *and* that all checks still pass — the 1.9/1.13 discipline. Specifically: the drawn matrix's row sums must be **strictly less** than the Domain G `passes_completed` it is drawn beside (so AC 4.3's bound cannot be quietly blessed as an equality), the `matrix_total` strictly less than Domain B `passes_completed`, and column sums must not equal `offers_received`. A fixture where these agree would bless exactly the checks Task 4 forbids.
  - [x] 8.4 **Fixture degeneracy is the severe risk here** — the 1.13 review's whole theme. A uniform matrix makes a transposed column assignment invisible: if every row prints the same values, swapping row/column is undetectable. Draw an **asymmetric, non-uniform** matrix with distinct values per cell, and assert `cell[i][j] != cell[j][i]` for at least one pair. Add a mutation check: transpose the parser's assignment and record how many tests go red (if the answer is zero, the tests are not testing).
  - [x] 8.5 New test modules: `pipeline/tests/test_extract_pass_network.py` (parser + its checks; builds its own cheap documents rather than going through `make_report`) and `pipeline/tests/test_extract_report_pass_network.py` (record seam + gate pair + real-PDF ground truth). Define `clean_registry` **locally**, following `test_checks_registry.py` and `test_runner.py`.
  - [x] 8.6 Order matters: the **first** test in the parser module is the unused-substitute asymmetry (2,103 corpus cases would fire on the natural-but-wrong rule), and the **second** pins M92 Jordan HENDERSON's all-zero tolerated row.
  - [x] 8.7 Ground-truth test against `spike/mex_rsa.pdf` (= PMSR-M01): **counts and values only, never coordinates** (AR-16 — and here there are no coordinates to assert anyway). Pin Mexico's 16×16 matrix: shirt/name row order, the blank diagonal, the matrix_total 470, and at least the first row `1 Raul RANGEL` = `[·,6,8,4,0,2,2,1,3,1,0,0,0,0,0,0]`.
  - [x] 8.8 `test_ingest_record.py`: add **separate** assertions filtered by each of the three Self-Validation ids from Task 4 — do **not** widen the existing `shots-marker-count` / `crosses-marker-count` / `defensive-actions-marker-count` filters. The `warnings` assertion is an ordered **list** mirroring the `warnings.extend` order in `extract_report.py:293-311`, not a set: append `pass_network_warnings()` **after** `domain_e_warnings()` at the end of the warnings block, and append the same entry last in the test's expected list.
  - [x] 8.9 A test asserting `node_positions is None` and that the warning is present — so a later story cannot quietly start fabricating positions without a red test. Pair it with Task 2.12's tripwire test (a pitch rect drawn on a synthetic pass-network page must raise).
  - [x] 8.10 Boundary tests for name assembly: the hyphen-wrap case (a synthetic header that wraps `GANNON-DOAK`), a zero-width/format-character case (U+200B, U+00AD survive `normalize()`), and a **fullwidth-digit** cell proving the `re.ASCII` guard rejects it — that test needs `fontname="japan"` to insert the glyphs (the 1.13 note); fullwidth digits otherwise satisfy `\d` and are accepted by `int()`.
  - [x] 8.11 `pipeline/tests/test_ingest_batch.py` — **not optional, and easy to miss**: (a) the default fixture must keep **every** pass-network check passing, because the file destructures `[check] = entry["self_validation_failures"]` on the deliberate-mismatch corpora in four places and asserts `self_validation_fail_count == 1`; a second failing check breaks all four (the 1.9/1.10 warning). (b) Add a test proving the `node_positions` absence warning reaches the manifest entry (`entry["warnings"].count(<warning>) == 1`), mirroring 1.13's `test_the_two_receiving_absences_reach_the_manifest_as_warnings`. (c) Add a forced-mismatch test proving a failing pass-network check renders through `format_summary`'s generic `specifics` fallback with **both operands visible**.
  - [x] 8.12 A determinism unit test — byte-identical `read_bytes()` on re-extract (1.10's Task 7.3 precedent). Task 2.11's ordering has no other coverage, and Task 9.2's corpus SHA-256 check is too coarse to localize a failure.
  - [x] 8.13 A memoization test for Task 6.2's one-slot memo: monkeypatch `_pass_network_uncached`, assert exactly one call across both gate checks, and **reset `_pass_network_memo` at the top of every gate test** (`test_checks_registry.py:388-405`) — stale memo state across tests is a real flake source and the older blocks do not reset.

- [x] **Task 9: Full verification + records** (all ACs)
  - [x] 9.1 Suite green: `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`. Report the delta from your Task 1.1 baseline and attribute every failure.
  - [x] 9.2 Full batch: `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104 --force`. **The ruled clean baseline is `104 extracted / 0 failed / exactly 2 self-validation failures` (`PMSR-M19-ARG-V-ALG`, `PMSR-M58-TUN-V-NED` — genuine source self-contradictions, ledgered). Assert that baseline; never assert a zero exit code.** Any third SV failure is yours. Then re-run without `--force` and prove 104/104 skipped-unchanged with byte-identical records (SHA-256).
  - [x] 9.3 FR-15 gate: `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`. Paste the output verbatim; confirm both new ids in `checks_run` and two runs byte-identical apart from `run_timestamp`. **If the sample records 0 deviations, prove the deviation path is not merely silent** by running the gate over a directory that forces a mismatch (the 1.12 precedent).
  - [x] 9.4 Update `pipeline/README.md` in **three** places (append-only), the 1.9/1.10/1.13 pattern: (1) the running gate-check enumeration at `:56-79`; (2) the `## Layout` tree annotation at `:316-329`, whose `extract/` line currently reads "Domains A, B, C and G today" and is already stale; (3) a new `## The pass-network domain (Story 1.14) — the nodes have no coordinates` section carrying the `domains.pass_network` JSON shape, the reconciliation table, a **Documented absences** subsection, and a **Relations that are corpus-FALSE and are deliberately NOT shipped** subsection (Task 4.5). Then update `sprint-status.yaml`.
  - [x] 9.5 Extend the existing batch-summary warning-noise ledger entry (`deferred-work.md:205`, itself extending `:171`) — this story adds 104 more per-report warning lines, so the summary-level de-duplication it proposes now covers four warnings, not three. **Do not fix it here**; it touches `format_summary`'s shared rendering.
  - [x] 9.6 **Commit hygiene:** commit only this story's files; disclose any co-committed in-flight state in the commit message (the 19816fc precedent). Commit directly to `main` (solo repo). **Never `git add -A`.**

## Dev Notes

### Mental model (read this first)

This page is **not** a pitch map, and it is **not** shaped like anything Domain D has produced so far. It is a **square directed adjacency matrix** printed as a table, plus a printed top-5 panel that reconciles against it.

That has two consequences that run in opposite directions, and holding both at once is the story:

1. **The edge half is the richest, cleanest extraction in Epic 1.** 23,597 edges, every endpoint joining verbatim to a lineup with the shirt number corroborating on 3,289/3,289, and a printed self-check (the Top-5 percentages) that validates the matrix total — and therefore every cell — to within a rounding half-ulp on 1,040/1,040 measurements. Nothing else in the epic has a counterpart this tight.
2. **The node half does not exist at all.** Not "hard to read", not "raster-only" — the coordinates are simply not on the page, and no page in the corpus carries them.

The failure mode to guard against is letting (1)'s abundance paper over (2)'s absence. It would take twenty lines to run a force layout over 23,597 real edges and produce 3,289 plausible-looking positions, and Story 2.8's renderer would draw them without complaint. **That is the one thing this story must not do.**

### Scoping probe already performed (2026-07-27) — the premise overturn

Run over all 104 reports / 208 pass-network pages with the real pipeline (`probe_report` → `resolve_anchors` → `_resolve_anchor_pages` → `extract_domain_a` / `_b` / `_g`), so the lineup and cross-domain blocks are exactly what your extractor will receive. **Re-derive every number below (Task 1); do not copy it forward unverified.**

#### Page anatomy — the negatives that force the re-scope

| Measurement | Result |
|---|---|
| Reports carrying pass-network pages | 104/104, **exactly 2 pages each** (one per team) → 208 team-innings |
| Anchor already registered | `AnchorSpec("pass-network", "Passing Networks {team}", "pass-network", per_team=True)`, `anchors.py:75` — **no new AnchorSpec needed** |
| **Pitch frames on pass-network pages** | **0 on 208/208** |
| **Markers of any kind** | **0.** Total vector content: 362 `re`, 12 `l`, 28 `c` — the curves are two ~9–10 pt header sort-arrow glyphs at y≈99–109 |
| Images on the page | exactly 1 — a **36×36 pt logo** at (912.0, 39.75), top-right corner |
| **Pages anywhere titled average/positions** | **0 across the whole corpus** |
| 52-page census of the reference report | **0 pitch-bearing pages are unanchored.** Two anchored families do carry a pitch rect and have no parser yet (`line-breaks` pp. 7–8, 180.0×257.2; `defensive-pressure` p. 28, 250.5×357.8) — neither is titled with positions. 27 anchored, titled pages carry no pitch rect at all, so "no pitch" is not by itself unusual on this template |

For contrast, on the same report: shots pitch 363.0×517.9, crosses 258.7×370.1, defensive actions 207.0×295.5, offers 192.0×274.5 — all aspect ratio 0.70. The pass-network page has no such rectangle at any size.

#### Matrix structure — corpus-verified invariants (all 208/208)

| Invariant | Result |
|---|---|
| Matrix is square N×N | **208/208** |
| N distribution | 13:2, 14:11, 15:26, **16:154**, 17:15 |
| Row order == column order (hyphen-normalized) | **208/208, identical order** |
| Diagonal blank; every off-diagonal cell present | **208/208** |
| Cell values | non-negative integers, **0–48** |
| Off-diagonal cells total | **48,814** = Σ N(N−1) over the distribution above — your arithmetic check |
| Non-zero cells (= edges) | **23,597**; volume range **1–48** |
| Zero cells (= absent edges) | **25,217** |
| Reciprocal pairs (both directions non-zero) | **9,151**, of which **6,835 asymmetric** |
| Top-5 panel present | **208/208**, exactly 5 percentages each |
| Column headers wrapping a hyphen | **24 of 208** innings |

#### Raw page layout — verified verbatim on `spike/mex_rsa.pdf` (= PMSR-M01), page 11, Mexico

Page rect `960 × 540`. Header band at `y0=90.75, y1=117.75`, fill `(0.18, 0.30, 1.00)`:

```
cell 0   x=[ 12.00,  30.00]  w= 18.00   '#'
cell 1   x=[ 30.00, 172.50]  w=142.50   'Passes From to'
cell 2   x=[172.50, 208.50]  w= 36.00   'Raul RANGEL'
cell 3   x=[208.50, 244.50]  w= 36.00   'Cesar MONTES'
  … 16 contiguous player columns, 36.00 pt each, 172.50 → 748.50 …
cell 18  x=[760.50, 948.00]  w=187.50   'Top 5 Player to Player Passers'   (height 13.5 — NOT part of the run)
```

Body rows at y ≈ 125, 150, 175, … 497 (≈24.75 pt pitch). First row, verbatim:

```
y=125.0   1 Raul RANGEL   |  ·   6   8   4   0   2   2   1   3   1   0   0   0   0   0   0
```

(`·` = the blank diagonal.) Mexico's `matrix_total` is **470**; Domain B `passes_completed` for the same side is **495**.

The Top-5 panel prints `Cesar MONTES → Johan VASQUEZ 3.8%`, `Johan VASQUEZ → Cesar MONTES 3.6%`, `Israel REYES → Cesar MONTES 3%`, `Johan VASQUEZ → Jesus GALLARDO 2.8%`, `Erik LIRA → Johan VASQUEZ 2.8%` — and `18/470 = 3.83%`, `17/470 = 3.62%`, `14/470 = 2.98%`, `13/470 = 2.77%`, `13/470 = 2.77%`. Note the fourth and fifth are tied at 13; the panel prints both, so **do not assume the five values are distinct**.

#### The join — measured with the real Domain A output

| Measurement | Result |
|---|---|
| Matrix rows joining to lineup by **verbatim name** | **3,289 / 3,289** |
| Shirt number corroborates | **3,289 / 3,289** |
| Unmatched endpoints | **0** |
| Present in matrix: starters (with minutes) | 2,288 |
| Present in matrix: substitutes who came on | 1,000 |
| Present in matrix: substitute with **no** minutes | **1** — `PMSR-M92` away #14 Jordan HENDERSON, **all zeros** |
| Absent from matrix: unused substitutes | **2,103** — correct, not a finding |
| Reconciliation | 3,289 + 2,103 = **5,392 lineup entries** — the exact figures Story 1.10 recorded for Domain G |

That last line is the strongest single result in the probe: **the pass-network player set is identical to Domain G's**, including the same lone anomaly. Domain G's join rules transfer wholesale and are already corpus-proven; do not re-derive them, copy them.

#### Self-Validation relations — measured, with the false ones named

| Relation | Verdict | Ship? |
|---|---|---|
| printed Top-5 pct == `100 × cell / matrix_total` (tol 0.05) | **TRUE 1,040/1,040**, worst delta exactly 0.05 | **YES — the primary check** |
| `sum(row_i) <= domain_g.passes_completed` | **TRUE 3,289/3,289** | **YES, as a BOUND** |
| `sum(row_i) == domain_g.passes_completed` | **FALSE on 1,290 / 3,289** | no — record the delta |
| `matrix_total <= key_statistics.passes_completed` | **TRUE 208/208** (strictly less on 208/208) | **YES, as a BOUND** |
| `matrix_total == key_statistics.passes_completed` | **FALSE on 208/208** | no |
| `sum(col_j)` vs `domain_g.offers_received` | **FALSE both ways** — 3,145 greater, 121 equal, 23 less | **no — name it as do-not-ship** |

The two bounds are the 1.8/1.9/1.12 pattern: the page's own arithmetic is self-consistent and the cross-domain number is larger, for a reason the pages do not carry. **Record the delta in `specifics`; do not resolve it by making the numbers agree.** If you *do* resolve it with evidence, say so and the check can tighten.

### Contract reality — read before coding types

`/contract` is **READ-ONLY** for this story. Current `schemaVersion` is **2** (Story 1.8's momentum bump, which touched nothing pass-network-related).

- `PassNetworkEdge` (`match-bundle.schema.json:658-677`) — required `["teamId","fromPlayerId","toPlayerId","volume"]`; `volume` is `integer, minimum 1`. **Fully fulfillable** once 1.15 mints the player IDs.
- `PassNetworkNode` (`match-bundle.schema.json:637-657`) — required `["teamId","playerId","playerName","shirtNumber","x","y","involvement"]`, `additionalProperties: false`. `x`/`y` are `PitchX`/`PitchY` (0–100, 2 decimals) with **no null branch**. **`x` and `y` are the only unfulfillable fields.**
- `events.passNetworkNodes` / `passNetworkEdges` (`:756-816`) are **independently nullable** sibling arrays — `null` means "the report does not carry that data".
- `teamId` is the **passing** team (`contract/README.md:91`, schema `$comment` at `:639` and `:660`).

### AD-6, spelled out for this family

AD-6 is about coordinates, and this family has none — so the frame does not apply to the staged payload at all. What *does* apply: `teamId` is the **passing** team, which here is unambiguous because the page is per-team and titled with that team's name. Resolve the side from the **anchor id** (`pass-network:home` / `:away`), never from x-order or page order (AD-8, the 1.12 `_panel_title` precedent). Nothing in this story normalizes, clamps, or rounds a coordinate.

### Failure & validation policy (AD-8, binding)

- Per-report failures abort **that report**, never the batch; typed exception per failure class.
- Assert-on-unknown everywhere. A cell that is not a non-negative integer, a row/column census that does not match, a non-blank diagonal, a name that does not join → **loud**, with report ID and specifics.
- **No dedup, ever.** A reciprocal pair is two edges. An asymmetric pair is two edges with different volumes. 6,835 pairs are asymmetric — collapsing them would destroy real data and no check would notice.
- Documented absences are **warnings**, never non-`pass` checks.
- Deterministic output: canonical serialization, no timestamps/paths/counters in the record, byte-identical re-runs.

### Testing standards summary

pytest only (AR-16). `spike/mex_rsa.pdf` is permanent ground truth and **read-only** — counts and values only. Probe scripts go to the session scratchpad. The synthetic fixture must make every corpus-FALSE relation false by construction, and a named test must assert both the falseness and that all checks still pass. Mutation-check any tuning constant that passes first try.

### Coordination — in-flight stories (respect strictly)

- **Story 1.9 is in `review`** and has `pipeline/extract/domain_e.py`, `domain_f.py` and shared seams dirty in this same working tree. Your new module is a **new file**, which is the cleanest possible coexistence — but `extract_report.py`, `checks.py`, `conftest.py`, `test_runner.py`, `test_ingest_record.py`, `pipeline/README.md` and `deferred-work.md` are **shared-contention files**: every edit **additive / append-only**, never reorder existing entries.
- **Story 2.8 is in `review`** with `app/` files dirty. `app/`, `/contract`, `/data` and `spike/` are all **off-limits** to this story.
- `code_version()` fingerprints all of `pipeline/**/*.py`, so while another session saves files in this tree every batch run invalidates all 104 records and long test runs can flake. Measure your own baseline; state it.

### Known landmines (live risks for this story)

1. **Ragged text order — one blank per row, not 25,217.** Zeros **are** printed as `0`; the only cell absent from the text layer is the **blank diagonal**. That single absence shifts every value at or after position `i` in row `i` by one, so a positional read over the present values is off-by-one across the right-hand part of every row — and because 25,217 cells hold `0`, a shifted value looks entirely plausible and no aggregate check sees it. Column assignment must be geometric (Task 2.4) and the census asserted (Task 2.5).
2. **Column widths are neither uniform nor arithmetic.** Non-uniform within the page on 156 of 208 innings; 36 pt is the family *minimum*, not the N=16 width; the enclosing span is not fixed. Read every column's extent from its own header rect (Task 2.4a).
3. **Hyphen wrap in column headers**, 24 of 208 innings. Take names from row labels (Task 2.7).
4. **The unused-substitute rule inverted.** 2,103 corpus cases would fire on "every lineup player needs a row". Write that test first.
5. **`make_report`'s auto-generated text-only pass-network page** will kill the entire suite the moment the parser goes default-on (Task 8.1).
6. **`test_runner.py`'s exact `checks_run` list** — the one guaranteed forced repair (Task 6.4).
7. **The `offers-count-match` placeholder** — do not collide with it (Task 6.1).
8. **Batch exits 1 by design** (M19, M58). Asserting exit 0 will make you "fix" a correctly-reported source defect.
9. **The temptation to derive positions.** Named here so that if it appears in a diff, it is a knowing violation and not an oversight.

### Project Structure Notes

New: `pipeline/extract/pass_network.py`, `pipeline/tests/test_extract_pass_network.py`, `pipeline/tests/test_extract_report_pass_network.py`.
Modified (additive / append-only): `pipeline/extract/errors.py`, `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py`, `pipeline/tests/test_runner.py`, `pipeline/tests/test_ingest_record.py`, `pipeline/README.md`, `_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml`.
Unchanged by design: `/contract`, `/data`, `app/`, `spike/`, `pipeline/markers/`, `pipeline/discover/anchors.py`.

### References

- [Source: epics.md:483-498] — Story 1.14's two Given/When/Then blocks, reproduced above
- [Source: ARCHITECTURE-SPINE.md:58-62] — **AD-3**, incl. "node positions are extracted, never derived from edges"; identity resolution is precompute's
- [Source: ARCHITECTURE-SPINE.md:76-80] — AD-6 pitch frame; [:82-86] AD-7; [:88-92] AD-8; [:94-98] AD-9; [:124-128] AD-14
- [Source: contract/match-bundle.schema.json:637-657] — `PassNetworkNode`; [:658-677] `PassNetworkEdge`; [:756-816] `EventTables`
- [Source: contract/README.md:91] — `teamId` is the passing team; [:509] the stale 2.3 sign-off row
- [Source: pipeline/discover/anchors.py:75] — the anchor, already registered
- [Source: pipeline/extract/domain_g.py:411-478, 552-578] — the join index, join row, and the asymmetry this story copies
- [Source: pipeline/extract/errors.py:289-301] — `PlayerJoinError`; [:28] `MissingFieldError`
- [Source: pipeline/extract/__init__.py:22-41] — `check_entry`, `aggregate_self_validation`
- [Source: deferred-work.md:294] — the risk 2.8 routed to this story, now measured and answered
- [Source: deferred-work.md:175] — 1.10's ruling that `playerId` is unfulfillable at extract time
- [Source: deferred-work.md:195] — the 1.13 unfulfillable-field filing recipe this re-scope copies
- [Source: deferred-work.md:7] — the open 2.8 finding that a throw in `pass-network-model.ts` kills all eleven Tactical sections
- [Source: 1-13-offers-movement-to-receive-parsers.md] — the premise-overturn dialect and the unfulfillable-field recipe
- [Source: 2-8-pass-network-visualization.md:311-328] — the fixture properties this story's real data will contradict; [:334] the AD-3/AD-4 numbering drift; [:60] the involvement-vs-edge-sum measurement
- [Source: app/src/lib/tactical-sections.ts:124-125] — the `&&` that makes a null node table blank the whole section

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context), via the `bmad-dev-story` workflow.

### Debug Log References

Probe and verification scripts were written to the session scratchpad (`spike/` is read-only, AR-16) and are not committed:

- `proto.py` — an **independent** prototype extractor, written before and separately from the shipped parser, with a different internal decomposition (raw `page.get_text("dict")` walk and dict-of-dicts, rather than `lines.py` and a header-rect grid). Task 1.4's cell-by-cell comparison is only a proof because the two do not share code.
- `sweep.py` — the full 104-report corpus sweep re-deriving every pinned fact (Tasks 1.2, 1.3, 1.3a, 1.3b).
- `sweep2.py` — the corpus-wide title scan done properly, plus the logo bbox and the 36 pt column census (Task 1.3).
- `sweep3.py` — the shipped parser run beside `proto.py` over all 104 reports, compared **cell by cell** (Task 1.4).

### Completion Notes List

**Task 1.1 — my own baseline, with attribution.** `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests` on the tree as I received it: **1137 passed / 1 skipped / 1 failed** in 5:46:54. The single failure is `test_ingest_fingerprint.py::test_code_version_is_stable_across_calls`, which hashes all of `pipeline/**/*.py` twice and compares. It is **not** a Story 1.9 or Story 1.14 defect: a concurrent Story 1.9 code-review session was saving `domain_e.py`, `domain_f.py`, `checks.py`, `conftest.py` and four test modules into this same working tree throughout the run, and I was writing this story's files into it too. This is exactly the shared-working-tree artifact Story 1.8's code review filed as a PROCESS FINDING. It passes in isolation.

**Task 1.2/1.3 — every pinned fact re-derived, and every one reproduced.** Nothing in the story's tables was copied forward unverified, and nothing disagreed. Measured over all 104 reports / 208 team-innings:

| Fact | Story | Re-derived |
| --- | --- | --- |
| Team-innings | 208 | **208** |
| N distribution | 13:2, 14:11, 15:26, 16:154, 17:15 | **identical** |
| Off-diagonal cells | 48,814 = Σ N(N−1) | **48,814**, and Σ N(N−1) over my own distribution is **48,814** |
| Edges (non-zero cells) | 23,597 | **23,597** |
| Zero cells | 25,217 | **25,217** |
| Volume range | 1–48 | **1–48** |
| Reciprocal pairs / asymmetric | 9,151 / 6,835 | **9,151 / 6,835** |
| Column width range | 27.75–58.5 pt | **27.75–58.5** |
| Uniform-width innings | 52, all 36.0 pt, at N=15/16/17 | **52**, all **36.0**, at N=15:3, 16:42, 17:7 |
| 36.0 pt present on | every inning | **208/208** |
| Left edge distinct values / range | 56, 126.75–255.75 | **56**, **126.75–255.75** |
| Right edge | 748.5 on 204, three others on 4 | **748.5 × 204**, 753.0 × 2, 756.75 × 1, 749.25 × 1 |
| Hyphen-wrapped headers | 24 innings, 24 reports | **24 / 24**, and the report list matches the story's one for one |
| Top-5 panel | 5 percentages on 208/208 | **1,040 percentages, 208/208** |
| Top-5 worst delta | exactly 0.05 | **0.04999999999999982** (3 cases), **0 over 0.05** |
| Join by verbatim name | 3,289 / 3,289 | **3,289 / 3,289** |
| Shirt corroborates | 3,289 / 3,289 | **3,289 / 3,289**, 0 unmatched |
| Starters / subs-on / no-minutes / unused | 2,288 / 1,000 / 1 / 2,103 | **identical**; 3,289 + 2,103 = **5,392** lineup entries |
| Row sum ≤ Domain G `passes_completed` | 3,289/3,289 | **3,289/3,289**; equality FALSE on **1,290** |
| `matrix_total` ≤ Domain B `passes_completed` | 208/208 | **208/208**; equality FALSE on **208/208** |
| Column sum vs `offers_received` | 3,145 / 121 / 23 | **3,145 greater, 121 equal, 23 less** |

**Task 1.3 — both negatives independently confirmed, so the node re-scope stands.** (a) `filter_chain.detect_pitch_frames`' own qualifying rule (stroked `"re"`, `10000 < area < 0.8 × page_area`) returns **0 rectangles on 208/208** pass-network pages. (b) A corpus-wide title scan over **all 5,448 pages of all 104 reports** — reading each page's title band rather than its body text — matches `Average Position|Positions|Avg` on **0** pages. (My first pass scanned the first 200 characters of page text and hit 104 pages; all 104 were the Defensive Pressure page's `Avg Pressure Duration` KPI **label**, not a title. Recording it because the weaker scan is the one a reader would write.) Also confirmed: **0 filled all-Bézier drawings at any size** on 208/208, and the single image is a 36×36 pt logo at bbox `(912.0, 39.75, 948.0, 75.75)` on **208/208**.

**Task 1.3a — the question the story had not measured: no row label wraps.** Maximum **1 line per row label** over all 208 innings; **0** label-continuation lines anywhere. 1.13's three-line-name trap does not occur in this family. It is nonetheless guarded rather than assumed: a row-label line carrying no shirt number now raises `PassNetworkParseError` naming the assembled fragment, so if a future report ever wraps one the corpus aborts loud instead of staging a truncated name that would surface later as a `PlayerJoinError` on a name that looks right.

**Task 1.3b — HENDERSON's column is all-zero too.** `PMSR-M92-MEX-V-ENG` away #14 Jordan HENDERSON: row sum **0** and column sum **0**. Both directions are therefore ruled and both are tested; a non-zero cell in either direction raises `PlayerJoinError`.

**Task 1.4 — the independent prototype agrees on every cell.** The shipped parser and `proto.py` were run side by side over all 104 reports and compared **cell by cell**, including the blank diagonal, the zero cells (which must be absent edges, never zero-volume ones), both node degree sums, the matrix total and the five printed percentages: **52,103 cells compared, 0 mismatches, 0 parse failures, 0 self-validation failures**, 23,597 edges and 3,289 players. This is the check that matters — a column-assignment slip is invisible to every aggregate.

**Two recorded departures from the task text, both tightenings, both measured.**

1. **Task 2.12 asks for "0 filled all-Bézier shapes in the marker size window"; the shipped assertion is 0 at ANY size.** The corpus draws none at any size on 208/208 (its only curve content is two ~9–10 pt *mixed* `c`+`l` header sort-arrow glyphs, which the all-Bézier predicate excludes anyway), so the stronger form is the one the measurement supports — and a size window would let a re-scaled marker slip through the tripwire on the one day it matters. Cannot false-fire today.
2. **A header-cell contiguity assertion was added that the story does not ask for.** Every qualifying header cell butts against its neighbour on 208/208 (verified over the whole corpus by the sweep before it was shipped). A missing header cell is the one failure the row census cannot see — it would silently drop a whole column from the grid while every remaining column still parsed and every row still carried exactly one blank.

**Task 4.5 — the do-not-ship relation is pinned by a test, not only by a comment.** The column-sum vs `offers_received` relation is commented at the would-be call site in `pass_network_checks` (the `domain_g.py:683-691` shape), and `test_the_column_sum_versus_offers_received_relation_is_not_shipped` asserts no such check id is emitted. A later story reaching for the obvious relation finds a red test rather than only prose.

**Task 7.4 — recorded, not applied.** `epics.md:84`'s AR-3 drops AD-3's event-table clause, so the extract-never-derive rule survives outside `ARCHITECTURE-SPINE.md:62` only in the schema description (`match-bundle.schema.json:640`) — a reader working from the epics alone finds it in neither AR-3 nor AR-6. `epics.md` was **not** edited. The epic's own AC 2 cites AD-6 for the frame and that citation is **correct**; it was not "fixed".

**Fixture honesty (Tasks 8.3, 8.4).** The synthetic matrix is asymmetric and non-uniform by construction — 8 distinct cell values, 49 of 66 reciprocal pairs differing, and five spiked cells giving the Top-5 panel five **distinct** descending percentages. All three corpus-refuted relations are false in the fixture and a named test asserts both the falseness and that every check still passes. **Mutation check**: transposing the parser's column assignment turns **6 tests red** (edge staging, reciprocity, node degrees, the non-uniform-width test, the ragged-row test and the phantom-column join). The tests are testing.

One fixture guard was deliberately **removed** during implementation: an early version of `default_pass_network_block` raised when any column sum equalled `offers_received`, which broke an unrelated Domain E test whose lineup happens to produce that coincidence. No shipped check compares the two — the relation is corpus-false in both directions and is not shipped at all — so a coincidental equality on one column is harmless, and a factory raise only breaks reports with no interest in pass networks. The property that actually matters (column sums fall on **both** sides of `offers_received`, so no bound in either direction could be blessed) is asserted against the default report in `test_extract_report_pass_network.py`, where the lineup is known.

**Coordination — this story was implemented in a working tree another session was actively writing to.** A Story 1.9 code-review session edited `pipeline/extract/domain_e.py`, `domain_f.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py`, `test_extract_domain_e.py`, `test_extract_domain_f.py` and `test_extract_report_domains_ef.py` while this story was in flight, including adding a `domain_e_goalkeeper_warnings()` appender to `extract_report.py`'s warnings block. Every edit made by this story to a shared file is **additive / append-only** and this story's warning is appended **after** that one, so the ordered warnings list in `test_ingest_record.py` stays correct for both. Nothing belonging to Story 1.9 was reverted, reordered or reformatted.

**Task 9 — verification results.**

*9.1 Suite.* `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`: **1227 passed / 1 skipped / 2 failed**, against a Task 1.1 baseline of 1137 passed / 1 skipped / 1 failed — **+90 tests** (48 in `test_extract_pass_network.py`, 24 in `test_extract_report_pass_network.py`, 1 in `test_ingest_record.py`, 3 in `test_ingest_batch.py`, plus 14 from the concurrent Story 1.9 review session working in the same tree). **Every failure attributed, and none of them survives:**

- The baseline's single failure, `test_ingest_fingerprint.py::test_code_version_is_stable_across_calls`, **passes** in this run. It hashes all of `pipeline/**/*.py` twice and compares, so it fails whenever any session saves a file mid-run; it did in the 5h47m baseline and did not here.
- `test_extract_domain_e.py::test_an_extra_evenly_spaced_gridline_run_is_refused` — a Story 1.9 test momentarily out of step with its own parser (the concurrent session saved `domain_e.py` at 21:40 and `test_extract_domain_e.py` at 21:42, during this run). Not reachable from any Story 1.14 file. **Passes** against the current tree.
- `test_extract_report_domains_ef.py::test_the_seven_checks_append_after_every_existing_appender` — the one failure this story genuinely caused, and a forced repair the story did not name: it pinned Domain E/F's ids as `ids[-7:]`, i.e. as the list's **tail**, and this story appends three `pass-network-*` ids after them. That is precisely what `extract_report`'s "domain stories compose without clobbering one another" is meant to allow, so the assertion — not the appender — was wrong. The repair (locate the E/F block by index rather than by tail) is on disk, names Story 1.14 in its docstring, and **passes**.

All three re-run green together in 7.06 s against the current tree, and the **confirming full-suite run, started once the tree settled, is fully green: 1229 passed / 1 skipped / 0 failed** (9:48:33 — the wall-clock is contention with the concurrent session, not this story's tests, which run in 6.5 s and 171 s respectively). The final count is 1229 rather than 1227 because the concurrent Story 1.9 review added two more tests of its own in the interval.

*9.2 Batch.* `pipeline\venv\Scripts\python.exe -m pipeline.ingest.batch --input-dir pmsr-corpus --expect-reports 104 --force`:

```
Reports by status:  extracted 104 | failed 0 | skipped-unchanged 0
RUN RESULT: FAIL (0 failed report(s), 2 self-validation-failed report(s),
                  0 corpus gap(s), 0 orphan record(s))
  PMSR-M19-ARG-V-ALG  [defensive-actions-marker-count] away forced-turnover: 39 markers, page prints 40
  PMSR-M58-TUN-V-NED  [defensive-actions-marker-count] away forced-turnover: 33 markers, page prints 34
```

Exactly the ruled clean baseline — the same two ledgered source self-contradictions, **no third**, and **0** pass-network self-validation failures over all 104 reports. The non-zero exit is by design and was not asserted against. Every report carries exactly **7** warnings (the six pre-existing documented absences plus this story's `node_positions` one, appended last).

*9.2 Idempotence.* Re-run without `--force`: **104/104 skipped-unchanged**, and all 104 staged records **byte-identical by SHA-256 (0 differences)**.

**First attempt failed and the reason is worth recording**, because a reviewer re-running these commands beside another live session will see the same thing: the first re-run reported 104 re-extracted and all 104 SHA-256s changed. That is not a determinism defect — the concurrent Story 1.9 session saved `pipeline/extract/domain_e.py` at 21:40, part-way through the `--force` batch, and `code_version()` fingerprints all of `pipeline/**/*.py`, so every record was **correctly** invalidated and every record's `code_version` field changed. Repeating the pair once the tree was quiet gave 104/104 skipped and 0 hash differences. This is the shared-working-tree hazard the story's Dev Notes name and that Story 1.8's review filed as a PROCESS FINDING.

*9.3 FR-15 gate.* `pipeline\venv\Scripts\python.exe -m pipeline.validate.verify --input-dir pmsr-corpus --expect-reports 104`:

```
reports found   : 104 (probed 104, probe failures 0)
checks run      : anchor-coverage, crosses-count-match, crosses-parse,
                  defensive-actions-count-match, defensive-actions-parse,
                  domain-a-completeness, domain-a-counts, domain-b-completeness,
                  domain-b-counts, domain-c-completeness, domain-c-counts,
                  domain-g-completeness, domain-g-counts, goalkeeping-completeness,
                  goalkeeping-counts, marker-event-link-rate, metadata-probe,
                  momentum-axis-scale, momentum-coverage, pass-network-completeness,
                  pass-network-counts, receiving-count-match, receiving-parse,
                  set-plays-completeness, set-plays-counts, shots-count-match, shots-parse
sample size     : 16

Deviations by category
  missing-anchor   0
  unknown-rgb      0
  count-mismatch   0
  probe-failure    0

GATE RESULT: PASS (0 deviation(s) across 16 sampled report(s), 0 corpus gap(s))
```

Both new ids appear in `checks_run` (27 ids, in sorted position between `momentum-coverage` and `receiving-count-match`), and two consecutive runs produced manifests **identical apart from `run_timestamp`** (`2026-07-28T03:08:58` vs `03:14:10`).

*9.3 The deviation path is not merely silent.* The sample records 0 deviations, so the path is proven separately over forced-mismatch corpora (the 1.12 precedent), by three tests that call `run_verification` and assert real deviations: a matrix endpoint that matches no lineup player lands in `probe-failure` carrying `PlayerJoinError` and the offending name; a pitch rectangle drawn on a pass-network page lands in `probe-failure` carrying `PassNetworkParseError` and the phrase `qualifying pitch rectangle`; and a doctored Top-5 percentage lands in `count-mismatch` carrying both operands.

### File List

**New**

- `pipeline/extract/pass_network.py`
- `pipeline/tests/test_extract_pass_network.py`
- `pipeline/tests/test_extract_report_pass_network.py`

**Modified (all additive / append-only)**

- `pipeline/extract/errors.py` — `PassNetworkParseError` appended
- `pipeline/ingest/extract_report.py` — import, parser call, warnings appender, checks appender, `domains["pass_network"]`, docstring ledger and raises list
- `pipeline/validate/checks.py` — import, docstring inventory entry, `_pass_network_memo` / `_pass_network_payload` / `_pass_network_uncached`, the two gate checks and their registrations
- `pipeline/tests/conftest.py` — the pass-network page drawer, `default_pass_network_block`, `pass_network_columns`, the ten `pass_network_*` kwargs, the emit function and its anchor branch, `make_report` docstring
- `pipeline/tests/test_runner.py` — the exact `checks_run` list (the one forced repair the story names)
- `pipeline/tests/test_ingest_record.py` — the ordered warnings assertion (6 → 7) and one new test filtered by the three Self-Validation ids
- `pipeline/tests/test_ingest_batch.py` — three new tests (default fixture stays clean, the absence warning reaches the manifest, a forced mismatch renders through the generic `specifics` fallback)
- `pipeline/README.md` — the gate-check enumeration, the `## Layout` `extract/` annotation, and a new `## The pass-network domain (Story 1.14) — the nodes have no coordinates` section
- `_bmad-output/implementation-artifacts/deferred-work.md` — the Story 1.14 filings, plus the 2.8 self-loop entry annotated as ANSWERED
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-14-pass-network-extraction-nodes-edges.md`

**Unchanged by design:** `/contract`, `/data`, `app/`, `spike/`, `pipeline/markers/` (`filter_chain` is imported read-only, as an assertion), `pipeline/discover/anchors.py`.

## Change Log

| date | change |
| --- | --- |
| 2026-07-27 | Story created. Corpus probe over all 104 reports / 208 team-innings overturned AC 2: the pass-network page carries no pitch, no markers and no coordinates, so `PassNetworkNode.x/y` are unfulfillable. AC 1's edge half confirmed fulfillable in full (23,597 edges, 3,289/3,289 join). Status → ready-for-dev. |
| 2026-07-27 | Implemented. `pipeline/extract/pass_network.py` — a MATRIX parser, not a marker parser: geometric column assignment from the header rects, the full N×N census, the Domain A join with its asymmetry and the M92 anomaly in BOTH directions, three Self-Validation checks (one printed reconciliation, two BOUNDS), and `node_positions: None` behind a standing every-run assertion that the page still draws no pitch and no markers. Every pinned fact re-derived over all 104 reports and every one reproduced; both re-scope negatives independently confirmed (0 pitch frames on 208/208; 0 average-position titles across all 5,448 corpus pages). An independent prototype extractor agreed with the shipped parser on **52,103 cells, 0 mismatches**. Task 1.3a answered a question the story had not measured: no row label wraps (max 1 line, 0 offenders), now guarded rather than assumed. Batch 104 extracted / 0 failed / exactly 2 self-validation failures (M19, M58 — the ledgered pair, no third); re-run 104/104 skipped-unchanged with all 104 records byte-identical. Gate PASS, 0 deviations, both new ids in `checks_run`, two runs identical apart from `run_timestamp`. Suite +90 tests; mutation check (transposed column assignment) turns 6 tests red. One forced repair the story did not name: `test_extract_report_domains_ef.py` pinned Domain E/F's checks as the list's TAIL, which a later appender is meant to be allowed to follow. Six AD-14 notes filed, including the headline blocker and the outright CLOSING of an open Story 2.8 ledger question (a self-loop pass edge is unreachable — the diagonal is blank on 208/208). `/contract`, `app/`, `data/` and `spike/` untouched. Status → review. |

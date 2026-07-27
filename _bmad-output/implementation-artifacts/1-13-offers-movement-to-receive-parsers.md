---
baseline_commit: f8ca7ee
---

# Story 1.13: Offers & Movement to Receive Parsers

Status: done

## Story

As the builder,
I want the two receiving page families parsed with the shared recipe,
So that offers and movements to receive are extracted per family with their true printed values (FR-10).

> The epic's wording is "…carry true coordinates typed per family". It is changed here on
> corpus-wide evidence: this family prints no coordinates and no events (AC 1's BINDING note).
> Everything else in the epic's story statement stands.

## Acceptance Criteria

The epic's ACs are reproduced verbatim, each followed by the **binding reconciliation** the
story-creation probe forced. Read both — the probe overturned the epic's central premise and
the reconciliation is what you build to.

1. **Given** the offers-to-receive and movement-to-receive map pages, **when** the parsers run,
   **then** both reuse the core filter chain with per-type tuning and legend exclusion,
   asserting on unknown RGB **and** `ReceivingEvent` rows carry `type: offer | movement`, 0–100
   coordinates, and `teamId` = the **receiving** player's team (AD-6).
   [Source: epics.md:468-473]

   **BINDING (probe-forced, corpus-wide evidence in Dev Notes → "Scoping probe"):** neither page
   carries per-event markers. There is no scatter, no coordinate, no per-event row and no
   on-marker glyph anywhere in the family, so **no `ReceivingEvent` row is producible and none
   may be fabricated.** AC 1 is satisfied as: (a) the shared chain IS composed — `detect_pitch_frames`
   locates the panels that bound every value read, and `collect_candidate_markers` →
   `exclude_legend_rows` → `key_outcomes` runs over the offers panels as a **template-revision
   tripwire** asserting the corpus-invariant 11-dot / one-fill decoration, so a future report that
   ever draws real markers there aborts loud instead of publishing silence; (b) `teamId` =
   `team_slug(anchor team)` = the **receiving** team, on every staged row; (c) the
   `ReceivingEvent`-unfulfillable gap is filed as an AD-14 emission blocker (Task 7). The
   `type: offer | movement` discriminator survives as a staged **value** on each side block, not
   as a per-event field, so 1.16's eventual emission stays mechanical whatever shape replaces
   `ReceivingEvent`.

2. **Given** any tabular counterpart on the pages, **when** Self-Validation runs, **then** counts
   are cross-checked where available and recorded (or their absence documented) in the manifest.
   [Source: epics.md:475-477]

   **BINDING:** nine exact reconciliations were measured and hold corpus-wide
   (Dev Notes → "The nine reconciliations"). Seven check ids cover all nine; the two documented
   absences are the raster-only donut slice values and the per-phase totals, which are **not a
   partition** of the movement total (−48..+314, equal on 3/208).

3. **Given** the venue × matchday sample, **when** the FR-15 gate re-runs, **then** receiving-map
   deviations appear in the summary. [Source: epics.md:479-481]

## Tasks / Subtasks

- [x] Task 1: Re-verify the pre-filed probe, then close the three questions it left open (AC: 1, 2)
  - [x] 1.1 Every number in Dev Notes → "Scoping probe" and "The nine reconciliations" was measured over **all 104 reports / 416 receiving pages** at story-creation time. **Re-derive them yourself** with your own script before writing parser code and record the figures verbatim in the Dev Agent Record — do not copy the table forward unverified. Probe scripts go to the session scratchpad; `spike/` is read-only (AR-16).
  - [x] 1.2 **Open question A — the offers panel badge → family mapping.** The two badges (`213` inside the left panel, `211` inside the right on the m001 home page) sum to `Total Offers Made` on 208/208, but which badge is "inside shape" and which "outside shape" must be resolved **text-anchored from each panel's printed title** (`Offers Made Inside Shape` / `Offers Made Outside Shape`, printed above its own frame), never by x order (AD-8 — the 1.12 `_panel_title` precedent). Confirm the titles are stable corpus-wide and that title→panel association is derivable by geometry.
  - [x] 1.3 **Open question B — duplicate qualifying rects on the offers page.** `detect_pitch_frames` returns **4** qualifying stroked rects but only **2 distinct panels** (208/208): each panel's white-stroked frame plus, on the right panel, two blue stroke+fill rects of the same geometry. De-duplicate by rounded geometry **inside this parser** — do NOT change the shared chain (1.12's accessor is correct as written; this is per-family tuning). Assert exactly 2 distinct panels after dedup; anything else is a template revision → typed layout error.
  - [x] 1.4 **Open question C — the movement page's `Top Ranked Players` table shape.** Five type rows on 208/208 (`Type | Player | Movements`, shirt number preceding the name). Characterize the header words, the x-columns, whether names straddle the row line, and whether any other page column prints digits on those y-lines. Decide from measurement whether the shirt number is a separate cell or glued to the name.
  - [x] 1.5 Confirm the **absence** findings so the AC 2 branch is built on measurement, not assumption: the donut slice values (five per-type, and each phase donut's slices) are **raster only** — one text word per donut region on 208/208, the centre total — and the three phase totals do not sum to the movement total. Record the delta range you measure.

- [x] Task 2: `pipeline/markers/receiving.py` — the two parsers (AC: 1)
  - [x] 2.1 Module placement is **ruled**: `pipeline/markers/`, beside `shots.py` / `crosses.py` / `defensive_actions.py`. Reason: this is Domain D (spatial events — addendum §6), 1.16 will consume it beside `events.crosses`, and `pipeline/extract/` is off-limits while 1.10 is in flight. **The module docstring must open by stating that this family draws no markers**, that it therefore stages values rather than events, and why it still lives here — otherwise the next reader assumes a scatter parser and looks for the bug.
  - [x] 2.2 Two public parsers, one page family each (the epic's "two parsers"): `parse_offers(doc, anchors, report_id, home_team, away_team)` and `parse_movement(doc, anchors, report_id, home_team, away_team)`, each resolving `{offers|movement}:{side}` to exactly ONE page per side (208/208 — anything else → typed layout error). Pure: no I/O beyond the open `pymupdf.Document`.
  - [x] 2.3 **Compose the shared chain, in order, for what it is genuinely for** (AC 1(a)): `detect_pitch_frames` on both families (offers: dedup to 2 titled panels; movement: assert exactly 1) — every value read is then bounded by a frame or anchored on a label, never by an absolute coordinate. On the offers panels only, run `collect_candidate_markers` → `exclude_legend_rows` → `key_outcomes` with a `RECEIVING_SHAPE_SPEC` tuned to the measured decoration (8.229 pt, single fill `(0.18, 0.30, 1.00)`) and **assert the census**: exactly 11 dots per panel, identical positions in both panels. An unknown fill raises `UnknownRgbError` with RGB + page (FR-11); an unexpected dot count raises the typed layout error. **Do not stage the dots as data** — they are a static template, byte-identical on every team-page sampled, and carry zero information (Dev Notes → "Why the 11 dots are asserted, not extracted").
  - [x] 2.4 **Offers staging** (`domains["receiving"]["offers"][side]`), snake_case keys, values verbatim as printed: `team_id`, `type: "offer"`, `total_offers_made`, `total_offers_received`, `offers_final_third`, `offers_middle_third`, `offers_defensive_third`, `offers_inside_shape`, `offers_outside_shape`, `most_offers: {value, player_name, position}`, `table_rows: [{shirt_number, player_name, offers_made, offers_received, made_received_pct}]`. Each KPI is read as **the integer printed above its own label, centred on the same x** — the `_headline_value` pattern from `defensive_actions.py:505`, label-anchored and never positional. `Offers Made in Defensive Third` wraps onto two lines; anchor on the first line and say so in a comment. `most_offers.position` stages **verbatim** (`"LEFT WINGER"`) — do NOT map it to the contract's `Position` vocabulary here; that vocabulary and its `UnknownPositionError` belong to Domain A (Story 1.6), and a second mapping site is a second thing to drift.
  - [x] 2.5 **Movement staging** (`domains["receiving"]["movement"][side]`): `team_id`, `type: "movement"`, `total_movements` (the All Movement Types centre), `by_phase: {final_third, progression, build_up}` (centre values ONLY — slices are raster), `by_third_and_type: [{pitch_third, movement_type, count}]` (15 entries: 3 thirds × 5 types), `top_ranked_players: [{movement_type, shirt_number, player_name, movements}]` (5 rows). Movement-type labels resolve through a **frozen `MOVEMENT_LABEL_TO_ENUM`** to the contract's kebab codes (`In Front`→`in-front`, `In Between`→`in-between`, `Out to In`→`out-to-in`, `In to Out`→`in-to-out`, `In Behind`→`in-behind`); an unmapped label → `UnknownLabelError`. **`no-movement` is the contract's sixth value and never appears on this page** — proven by reconciliation #8 (the grid equals Domain G's FIVE-type sum on 208/208 and never its six-type sum). Do not add it to the map; note the asymmetry in a comment. A test cross-checks the map's values against `contract/common.schema.json#OfferMovementType` (the `CROSS_DELIVERY_LABEL_TO_ENUM` precedent — frozen literals, never schema imports).
  - [x] 2.6 Pitch-third labels (`FINAL THIRD` / `MIDDLE THIRD` / `DEFENSIVE THIRD`) print **rotated inside** the movement pitch panel and are what assigns each grid row its third — text-anchored, never "top band = final third" (AD-8). Assert the panel's own rotated `DIRECTION` label the way `defensive_actions.py::_assert_panel_orientation` does before trusting the third assignment; it is the page's own statement of which way it is drawn.
  - [x] 2.7 **Table parsing — the x-restriction is load-bearing and the evidence is direct.** On the offers page the left KPI column prints `424` at y=126.8 while the first table row prints at y=126.0 — **0.8 pt apart, inside the shared 3 pt `table_lines` tolerance**, so an x-unrestricted rule glues two KPI values into the first player row. Use the shared `table_lines` (`pipeline/markers/attempts.py`) clustering, then restrict to the table region **derived from the header's own `#` position**, exactly as `crosses.py::_cross_table_rows` and `defensive_actions.py::_regain_table_rows` do. Leading cell must be a pure-ASCII-digit shirt number (`re.ASCII` — fullwidth digits otherwise satisfy `\d` and `int()` accepts them). The third numeric column is a **percentage** (`30.8%`, `50%`) and will not match a bare digit run — parse it explicitly, do not let it fall through a `\d+` filter. Malformed row / missing header → typed table error.
  - [x] 2.8 `team_id = team_slug(team_name)` = **the receiving player's team**, which on both page families is the team the anchor names (`contract/match-bundle.schema.json:675`: *"teamId is the RECEIVING player's team"*; `contract/README.md:90`). Mechanically the same call the other three families make, semantically a different end of the event — **state this in the module docstring** so nobody re-derives it as the crossing/shooting pattern (the 1.12 docstring precedent).
  - [x] 2.9 Typed errors in `pipeline/markers/errors.py`, **append-only**: `ReceivingPageLayoutError`, `ReceivingTableError`. Never reuse the Crosses/DefensiveActions/Shots classes, never bare `ValueError`. `UnknownRgbError` and `UnknownLabelError` are reused as-is (they already carry rgb/label + page + report).
  - [x] 2.10 Deterministic record order everywhere (AD-8): `by_third_and_type` sorted by (pitch_third in printed order, movement_type), `top_ranked_players` in printed order, `table_rows` in printed order. No dedup of anything, ever.

- [x] Task 3: Self-Validation — the seven checks (AC: 2)
  - [x] 3.1 `receiving_self_validation_block(counts)` emitting, per team, exact/binary checks with **both operands always present** (no tolerance, never loosened — SM-C1, AD-8, FR-14). The five page-internal check ids:
        `receiving-offers-thirds-sum` (final+middle+defensive == total made),
        `receiving-offers-shape-sum` (inside+outside == total made),
        `receiving-offers-table-sum` (Σ table `offers_made` == total made AND Σ `offers_received` == total received — emit as two checks, one operand pair each; a merged check cannot say which side failed),
        `receiving-movement-grid-total` (Σ the 15 grid counts == `total_movements`),
        `receiving-offers-table-pct` (every table row's printed percentage equals
        `round(100 × offers_received / offers_made, 1)` — exact at printed precision, worst
        corpus deviation 0.0 pp, so **no tolerance is warranted**; skip only the rows with
        `offers_made == 0` and record how many were skipped in the check's operands).
        Keep the block well-shaped so `_self_validation_trustworthy` (the batch skip-gate) recognizes it.
  - [x] 3.2 The two **cross-domain** checks are computed at the `extract_report.py` seam, never inside the parser — the 1.7 `shots_counts` / 1.10 `key_statistics` precedent, and the only way to stay off `pipeline/extract/` while 1.10 is in flight: `receiving-offers-domain-g` (offers `total_offers_made` == Σ Domain G `in_possession.total_offers` over that side's players, and `total_offers_received` == Σ `offers_received`) and `receiving-movement-domain-g` (the grid's per-type totals == Σ Domain G `in_possession.offers_by_movement_type` for each of the FIVE mapped types). Both hold exactly on 208/208. **If `player_stats` is unavailable, emit no check rather than a failing one** (the Domain-B-unavailable precedent in `checks.py::_check_domain_g_counts`) — one root cause, one finding.
  - [x] 3.3 **Documented-absence branch (AC 2) — exact shape, do not improvise.** Two absences, both real, both recorded as `table: None` in `counts` plus **one warning per report** (not per side) appended to the record's `warnings`, which `batch.py` mirrors into the manifest entry. **Emit NO check for either** — `aggregate_self_validation` is strictly binary and treats anything but a literal `"pass"` as a fail, so a "not-applicable" check would fail every record in the corpus (the 1.12 Task 5.2 ruling).
        (a) **Donut slice values are raster-only** — the five per-type slice numbers and each phase donut's slice numbers are inside the images, so only the four centre totals are text. No per-type total is independently printed to check against; the grid reconciliation is the counterpart that does exist.
        (b) **The three phase totals are NOT a partition** — `final_third + progression + build_up` minus `total_movements` ranges **−48..+314** and is zero on only **3 of 208** pages. Stage them verbatim, record the documented non-reconciliation, and **never write a check that sums them.** (The exact trap 1.7's AC 2 hit with "block sum ~100%", and the `InPossessionPhase` `$comment` says independent rates are the house pattern: `common.schema.json:219`.)
  - [x] 3.4 Wire into `pipeline/ingest/extract_report.py` at the two established seams ONLY: the `parse_offers(...)` / `parse_movement(...)` calls beside `parse_defensive_actions` (OUTSIDE the `ProbeError` handler, so typed parser errors travel as themselves), the `domains["receiving"]` entry, `warnings.extend(...)` for the absence warning, and ONE `self_validation["checks"].extend(...)` appended **after every existing appender**, then `aggregate_self_validation` re-runs. Strictly additive/append-only; never reorder an existing check.
  - [x] 3.5 Prove manifest mirroring with a forced-mismatch test: the failing check lands in `entry["self_validation_failures"]` with both operands, the run fails (exit 1) **without inflating `failed_count`** (the orphan-records precedent). Check `format_summary`'s generic count branch renders the new checks; add a branch only if it must key on the EXACT check id, and key it on the id — never sniff for a payload key (the 1.5 review patch).

- [x] Task 4: FR-15 gate checks (AC: 3)
  - [x] 4.1 In `pipeline/validate/checks.py`: a one-slot per-document receiving parse memo copying `_crosses_memo` / `_crosses_parse_result` / `_crosses_parse_uncached` (`checks.py:690-711`) **verbatim**, appended at the end of the module. Do not refactor the existing memos — the pattern carries OPEN deferred-work entries (five instances now); copy-don't-extend.
  - [x] 4.2 Register exactly two ids: **`receiving-parse`** (catch `UnknownRgbError` → `unknown-rgb`; other typed errors raise for the runner to isolate) and **`receiving-count-match`** (any failing reconciliation → `count-mismatch`, both operands in specifics, one deviation per failing team/check). Silent on missing anchor (anchor-coverage owns it); count-match silent on parse failure. **NO new deviation category** — the 4-set is frozen (`pipeline/validate/deviations.py:18`).
  - [x] 4.3 **Do NOT name a check `offers-*`.** `test_checks_registry.py:122-144` uses **`offers-count-match`** as its deliberately-unclaimed placeholder (1.12 moved it there from `defensive-actions-count-match`), and `register_check` raises on duplicates — claiming it silently breaks that test. The `receiving-*` prefix is ruled for this reason **and** because one prefix covering both page families matches the one `domains["receiving"]` payload. If you deviate, you own repointing the placeholder to a still-unclaimed id and updating its comment trail.
  - [x] 4.4 Update the `checks.py` module docstring registry list, and add the two new ids to `test_runner.py`'s hardcoded sorted `checks_run` list — keep that edit minimal (1.10 may touch it too).

- [x] Task 5: Tests (all ACs)
  - [x] 5.1 Extend `conftest.py` `make_report` with `emit_offers_pages` / `emit_movement_pages` helpers mirroring `emit_defensive_actions_pages` (`conftest.py:1328`), **default-on**: the moment Task 3.4 wires the parsers in, every existing `make_report` consumer hits the two anchors and dies on an auto-generated text-only page. Draw the real anatomy — offers: two stroked panels with titles above, 11 decoration dots per panel at the measured size/fill, the two in-panel badges, the five KPI value/label pairs, the Most-Offers block, the per-player table **at the real x-positions and the real ~7 pt font** (the 1.11 lesson: at fontsize 10 adjacent header words glue into one extracted word and glyph tops drift >3 pt), plus **a KPI value on the same y-line as the first table row** so the x-restriction has a regression that bites. Movement: one stroked panel with rotated third + `DIRECTION` labels, the 15 label/value grid rows, the four centre totals, the Top-Ranked table. Additive kwargs only.
  - [x] 5.2 `test_markers_receiving.py` (synthetic-first; derive every expected value from what the factory drew — never a second literal). Cover: happy path both teams both families; offers panel dedup (4 qualifying rects → 2 panels) and the wrong-count layout error; title→panel typing with left/right **swapped** (proves the mapping is text-anchored, not positional); unknown panel title → `UnknownLabelError`; the 11-dot census tripwire (10 or 12 dots → typed error; an off-palette dot → `UnknownRgbError` carrying rgb + page); KPI label-anchored reads incl. the two-line "Defensive Third" label; the x-restriction regression from 5.1; percentage column parsing; fullwidth-digit rejection (needs `fontname="japan"`); movement label map vs `contract/common.schema.json#OfferMovementType` **including the asserted absence of `no-movement`**; `DIRECTION` mis-orientation → typed error; each of the seven SV check ids passing and failing with both operands recorded; the documented-absence branch emitting **no** check and exactly one warning; missing/duplicated anchor page → `ReceivingPageLayoutError`.
  - [x] 5.3 Ground truth: `spike/mex_rsa.pdf` **is** the m001 report. Assert the m001 home figures from your Task 1 re-derivation (creation-time measurement: made 424, received 166, thirds 134/212/78, badges 213/211, table 16 rows; movement total 309, grid sum 309, phases 65/96/176) — **values and counts only, never coordinates** (AR-16). Existing shots/crosses/defensive-actions ground truth stays green.
  - [x] 5.4 `test_ingest_record.py`: add **separate** assertions filtered by each new `check["check"]` id — do NOT widen the existing `shots-marker-count` / `crosses-marker-count` / `defensive-actions-marker-count` filters (all families carry `home`/`away` keys; a widened dict collides — the 1.5 review note). The record's warnings assertion already pins 1.12's single documented-absence warning; extend it to the exact expected set, not a length check.

- [x] Task 6: Full verification + records (all ACs)
  - [x] 6.1 Measure your **own** suite baseline before starting (1.10 is in flight; 1.12's review recorded 895 passed / 1 skipped with 1.10 in the tree — do not treat that as a pinned number). Suite green at the end: `pipeline\venv\Scripts\python.exe -m pytest pipeline/tests`.
  - [x] 6.2 Full batch over all 104 PDFs: `code_version` changes, so expect all-104 re-extract. **The clean baseline is NOT exit 0** — per the 1.12 review ruling, from 1.12 onward a clean full-corpus run is `104 extracted / 0 failed / exactly 2 self-validation failures` (`PMSR-M19-ARG-V-ALG`, `PMSR-M58-TUN-V-NED` — genuine source self-contradictions, ledgered as NEEDS ADJUDICATION). **Assert that baseline; never assert a zero exit code.** Any third SV failure is yours. Then an immediate re-run → 104/104 skipped-unchanged with byte-identical records.
  - [x] 6.3 Re-run the FR-15 venue × matchday gate with **both** parsers active; paste the result verbatim in the Dev Agent Record, with deviations (or 0) in the summary. If the sample records 0 deviations, prove the deviation path is not merely silent by running the gate over a directory that forces a mismatch (the 1.12 precedent).
  - [x] 6.4 Update `pipeline/README.md` (parser-family table, gate-check list, a "The receiving domain (Story 1.13)" section stating plainly that this family has no events), **file the Task 7 AD-14 entries**, annotate the filter-chain advisory (`deferred-work.md:41`, which names Stories 1.11–1.13 and is now on its **last** named story — close it or state precisely what remains), record probe findings and discoveries in the Dev Agent Record, update sprint-status to review.

- [x] Task 7: AD-14 filings — the deliverable this story owes downstream (AC: 1, 2)
  - [x] 7.1 **Emission blocker (headline).** File in `deferred-work.md`: `ReceivingEvent` requires `playerId`, `playerName`, `type`, `movementType`, `at`, `x`, `y` **per event**, and the corpus carries **no per-event receiving data of any kind** — no markers, no coordinates, no per-event rows, no ordinal glyphs, on 416/416 pages. This is strictly harder than the `CrossEvent` blocker Story 1.11 filed (crosses at least yield real coordinates). Consequences to state explicitly: **Story 1.16 can only emit `events.receiving: null`**; **Story 2.9** (`#offers-to-receive` / `#movement-to-receive`) has no event data to render and must be re-scoped against the aggregates this story stages; and the **Story 2.3 sign-off row for offers/movement is stale** — it recorded PASS-with-note over an unfixtured `movementType: null` branch, having walked the contract without knowing the source cannot fill the shape at all. Candidate to ride CS-1's **successor** change-set, never CS-1 (already scoped). **Do not edit `/contract`.**
  - [x] 7.2 **Shape note.** The corpus is *richer* than the contract in a different dimension: team totals, made/received split, per-third and per-phase splits, a per-type × per-third grid, top-ranked players per type, and a per-player made/received table — all with **no contracted destination**. Stage the full raw shape and name it as the candidate input for whatever replaces `ReceivingEvent`.
  - [x] 7.3 **Vocabulary note.** `OfferMovementType` has six values; the movement map prints exactly **five** — `no-movement` exists only per-player in Domain G's Offers & Receptions page. Reconciliation #8 proves the map is the five-type sum, never the six-type sum.
  - [x] 7.4 **Non-partition note.** The per-phase movement totals are independent, not slices (−48..+314). Same family as the `InPossessionPhase` "never normalize, never pie" warning; whichever surface renders them must not sum them.
  - [x] 7.5 **Raster note.** Donut slice values are unextractable (image-only); only the four centre totals are text. Any surface wanting the per-type split must take it from the grid, which reconciles exactly.

## Dev Notes

### Scope boundary — what this story owns

- **In scope:** the `offers:{home,away}` and `movement:{home,away}` anchors only — `AnchorSpec("offers", "Offering to Receive {team}", per_team=True)` and `AnchorSpec("movement", "Movement to Receive {team}", per_team=True)` (`pipeline/discover/anchors.py:73-74`, already registered, resolving to exactly one page each on all 104 reports).
- **NOT this story:** the `individual-offers-receptions` anchor (`"In Possession - Offers & Receptions {team}"`, `anchors.py:119-124`, pages 42/44) — that is **Domain G, Story 1.10's** per-player page and it is already extracted (`domains.player_stats[side][].in_possession.total_offers` / `offers_received` / `offers_by_movement_type`). This story **reads that payload at the extract seam for two cross-domain checks and never re-parses that page.**
- **Coordination with Story 1.10 (Domain G, in review, files uncommitted in the working tree):** stay in the marker/page-family lane. **DO NOT touch** `pipeline/extract/` (`domain_a.py`, `domain_b.py`, `domain_c.py`, `domain_g.py`, `extract/errors.py`); `extract/__init__.py` may be imported (`aggregate_self_validation`) but not modified. Shared-contention files — every edit additive/append-only, never reorder existing checks: `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py`, `test_runner.py`, `test_ingest_record.py`, `pipeline/README.md`, `deferred-work.md`.
- **Off-limits:** `/contract` (see AD-14 above), `/data`, `app/`, `spike/` (read-only ground truth), `pipeline/validate/{runner,sample,deviations,verify}.py`.
- **Commit hygiene:** commit only this story's files; disclose any co-committed in-flight state in the commit message (the 19816fc precedent, re-raised by the 1.11 review). Commit directly to main (solo repo); never `git add -A`.

### Scoping probe already performed (2026-07-26) — the premise overturn

Measured over **all 104 reports / 416 receiving pages** (208 per family) at story-creation time.
Re-derive every figure with your own script before writing parser code (Task 1.1) — these
numbers are a map of the terrain, not a substitute for measuring it.

**Neither page family is a pitch map.** Both are dashboards. Rendered proof was inspected
directly for m001 home.

**`Offering to Receive {team}` — 208/208 pages:**

- Exactly ONE page per team. Landscape 960 × 540.
- **4 qualifying stroked rects, 2 distinct panels**: `Rect(234.0, 222.8, 426.0, 497.2)` titled
  **"Offers Made Inside Shape"** and `Rect(450.0, 222.8, 642.0, 497.2)` titled **"Offers Made
  Outside Shape"** (both 52,704 pt², white stroke 2.744). The right panel additionally carries
  two blue stroke+fill rects of identical geometry (the shape overlay) — hence 4 → dedup by
  rounded geometry (Task 1.3).
- **Each panel holds exactly 11 filled 8.229 pt circles, fill `(0.18, 0.30, 1.00)`** — and their
  positions are **identical between the two panels on 208/208 pages** *and* **identical across
  all 40 team-pages sampled for layout variation**. They are a static formation template on a
  quantized grid, not data. Also present inside the panels: white penalty spots (1.37 pt),
  centre spot (2.74 pt), stroke-only 50.19 pt arcs and 8.23 pt corner arcs — the same furniture
  family 1.12 documented, excluded by `fill is None` and `marker_min_pt`.
- **Zero digit glyphs inside either panel** except the two badges. No per-event rows anywhere.
- Real payload: five KPI value/label pairs (`Total Offers Made`, `Total Offers Received`,
  `Offers Made in Final Third`, `… Middle Third`, `… Defensive Third` — the last wraps to two
  lines), one badge inside each panel, a `Most Offers` block (value / player / position), and a
  per-player table `# | Player | Offers Made | Offers Received | % Made & Received` with
  **13–17 rows** (16 on 154 pages, 15 on 26, 17 on 15, 14 on 11, 13 on 2).
- m001 home: made 424, received 166, thirds 134 / 212 / 78, badges 213 (inside) / 211 (outside),
  Most Offers 54 · Julian QUINONES · LEFT WINGER, 16 table rows.
- **One image** per page: a raster at exactly the right panel's rect — the shape overlay.

**`Movement to Receive {team}` — 208/208 pages:**

- Exactly ONE page per team. **Exactly 1 qualifying stroked rect**:
  `Rect(675.0, 129.0, 936.0, 502.5)` titled **"Movement Types Pitch Third"**, containing **ZERO
  markers** — it is a pitch split into three thirds, each carrying a five-row horizontal bar
  chart. Rotated `FINAL THIRD` / `MIDDLE THIRD` / `DEFENSIVE THIRD` labels inside the frame; one
  rotated `DIRECTION` label, vector `(0.0, -1.0)`.
- **15 type-label/value pairs inside the panel on 208/208, 0 malformed** — the grid.
- The only 9.0 pt filled circles on the page are the **five legend swatches** at x≈543.8, one per
  movement type, in five distinct fills.
- **13–21 raster images per page**: the three phase donuts and the All-Movement-Types donut are
  images. **Their slice values are inside the images** — exactly one text word (the centre total)
  is recoverable per donut region on 208/208. Only four totals are text.
- Real payload: `Movement Types by Phase` (three donut centres), `All Movement Types` (one donut
  centre), the 15-cell grid, and a `Top Ranked Players` table (`Type | Player | Movements`) with
  **exactly 5 type rows on 208/208**.
- m001 home: total 309; grid sum 309; phases 65 / 96 / 176.
- Pages happened to be 19/20 (offers) and 21/22 (movement) on the reference report — **never
  index by page number**; the anchor map is the only page source (AD-8).

### The nine reconciliations — all exact, corpus-wide

Measured corpus-wide at creation time. Seven Self-Validation check ids cover all nine; two are the
documented absences.

| # | Reconciliation | Result |
| --- | --- | --- |
| 1 | `offers_final_third + middle + defensive == total_offers_made` | 208/208 |
| 2 | `offers_inside_shape + offers_outside_shape == total_offers_made` | 208/208 |
| 3 | Σ table `offers_made` == `total_offers_made` | 208/208 |
| 4 | Σ table `offers_received` == `total_offers_received` | 208/208 |
| 5 | Σ 15 grid counts == `total_movements` | 208/208 |
| 6 | `total_offers_made` == Σ Domain G `in_possession.total_offers` (that side) | 208/208 |
| 7 | `total_offers_received` == Σ Domain G `in_possession.offers_received` | 208/208 |
| 8 | grid per-type total == Σ Domain G `offers_by_movement_type[type]`, each of the 5 | 208/208 |
| 9 | table `made_received_pct == round(100 × offers_received / offers_made, 1)` | 3,208/3,208 rows, worst deviation **0.0 pp** |

**Reconciliation 9 carries the family's one crash branch:** **81 corpus rows print
`offers_made == 0`**, where the ratio is undefined. Measure what those rows print in the
percentage column and handle it explicitly — a bare division is a `ZeroDivisionError` on real
corpus data, and coercing it to `0.0` invents a value. The check must skip exactly those rows
(and say so), never guess them.

**Documented absences (AC 2's absence branch):**

- Donut slice values are raster-only — no independently printed per-type total exists to check.
- `by_phase` totals are **not a partition**: `(final+progression+build_up) − total_movements`
  ranges **−48 .. +314** and is zero on **3/208**. Never sum them into a check.

Reconciliation #8 is also what *identifies* the movement page: it counts offers whose movement
type is one of the five mapped values — the six-type sum never matches.

### Why the 11 dots are asserted, not extracted

They are byte-identical across every team-page sampled and identical between the two panels on
every page — a decorative formation template carrying zero per-report information. Staging them
would put 22 meaningless rows in every record and invite a downstream consumer to render them as
positions. But *dropping the chain entirely* would leave the one page in this family with
pitch-panel geometry unguarded: if a future template ever draws real markers there, silence is
the worst outcome. So the chain runs and **asserts** — 11 dots, one known fill, positions equal
across panels — and stages nothing. That is what makes AC 1's "reuse the chain, assert on unknown
RGB" true here rather than a formality.

### The filter chain — reuse contract (AD-9)

Shared module `pipeline/markers/filter_chain.py`; stage order is an INVARIANT (geometry strictly
before color — the dark-blue table-header collision is the canonical reason):

1. `detect_pitch_frames` (`:88`, Story 1.12's multi-panel accessor) / `detect_pitch_frame` (`:125`) — qualifying **stroked** `"re"` drawings, `10000 < area < 0.8 × page_area`.
2. `collect_candidate_markers` (`:142`) — filled, all items `"c"`, width AND height in `[marker_min_pt, marker_max_pt]`, centre inside the pitch expanded by `pitch_margin_pt`.
3. `legend_row_ys` (`:190`) / `exclude_legend_rows` (`:207`) — rounded-y buckets holding ≥ `legend_min_colors` distinct fills.
4. `key_outcomes` (`:224`) — exact lookup on RGB rounded to 2 decimals; a miss raises `UnknownRgbError(rgb, page_index, report_id)`. Never nearest-color, never drop, never filter by colour earlier.

Tuning seam: `MarkerSpec(marker_min_pt, marker_max_pt, rgb_to_outcome, legend_min_colors=4, pitch_margin_pt=0.0)`, frozen. **This story adds no chain edit.** `exclude_legend_rows` is a no-op by construction on the offers panels (the decoration is one fill, so no y-bucket reaches `legend_min_colors`) — keep it in the production path anyway: the recipe is the recipe (1.5's review restored it after an inlined copy went dead), and say so in the docstring with the reason.

**`deferred-work.md:41` — "Filter-chain robustness envelope for reuse (Stories 1.11–1.13)"** names this story and **this is its last named story.** 1.11 verified crosses, 1.12 verified defensive actions and closed a NEW gap additively. Facet (c) — the "circle" filter admits any filled all-Bézier shape in the size window — is the live one again here: the offers panels' decoration is admitted on size + containment alone, and the in-panel white spots are excluded only by `marker_min_pt`. Verify, then **close the advisory or state exactly what remains open and for whom.**

### Contract reality — read before coding types

`contract/match-bundle.schema.json:673-710` — `ReceivingEvent`, `$comment`: **"teamId is the
RECEIVING player's team."** Required: `teamId, playerId, playerName, type, movementType, at, x, y`.
Bundle location: `events.receiving`, `anyOf [ReceivingEvents, null]` (`:796-799`); `null` = the
report does not carry those pages.

- `type` → `ReceivingEventType` (`common.schema.json:206-211`), closed: `offer | movement`.
- `movementType` → `OfferMovementType | null` (`common.schema.json:212-217`), six values, provenance `contract/README.md:129` (**the `In Possession - Offers & Receptions` page — Domain G's, not this story's**).
- Acting-team table: `contract/README.md:90`.
- **Story 2.3 sign-off status:** offers/movement-to-receive = **PASS-with-note** over an unfixtured `movementType: null` branch (`contract/README.md:474`) — a note about fixtures, filed without knowledge that the source carries no per-event data at all. Task 7.1 supersedes it.
- **Every required per-event field is unfulfillable.** Extract what the page proves, stage the aggregates, file the gap. Do not invent events, do not stretch the 11 decoration dots into rows, do not borrow Domain G's per-player rows and call them events.

### AD-6, spelled out for this family

- `teamId` = **the receiving player's team** = the team the anchor names. Both page families plot/total that team's own offers and movements. Mechanically the same `team_slug(team_name)` call as the other three families, semantically the receiving end — say so in the docstring.
- No coordinate is produced by this story, so AD-6's normalization formula pair does not run. The `DIRECTION` assertion (Task 2.6) still does: it is what licenses reading the three pitch thirds off the panel.
- Had coordinates existed they would be rounded to 2 decimals (`PitchX`/`PitchY` `x-decimals: 2`). Record that they do not exist rather than emitting nulls-with-coordinates.

### Self-Validation + manifest plumbing (AD-8, FR-14)

- Record shape: `record["self_validation"] = {"result", "checks": [...]}`; appender seam in `extract_report.py:231-269`; `aggregate_self_validation` (`pipeline/extract/__init__.py`) recomputes the block result.
- **The aggregator is strictly binary:** `"pass" if all(check.get("result") == "pass" …)`. A check emitted with `"not-applicable"`, `"skipped"` or any other value **fails the whole record.** That is why AC 2's documented absences must NOT be checks (Task 3.3) — they are `table: None` + one per-report `warnings` entry, which `batch.py` mirrors into the manifest.
- A mismatch is NOT an exception: the record still writes with `result: "fail"` + both operands; the batch surfaces a run-level fail (exit 1) without inflating `failed_count`.
- Deviation categories are FROZEN at 4 (`missing-anchor`, `unknown-rgb`, `count-mismatch`, `probe-failure`) — this family maps onto `unknown-rgb` + `count-mismatch`.
- Counterparts are these pages' own printed numbers, plus Domain G's per-player payload at the extract seam. **Never Key Statistics** (Domain B territory; the 1.11 M01 evidence — Domain B `crosses` 13/8 vs the open-play map's 10/7 — is the standing warning about cross-domain substitution).
- Staging conventions: record JSON keys are **snake_case** (`test_record_keys_are_snake_case` enforces it; 1.12 was caught keying `counts` by kebab codes); enum **values** stage as the contract's kebab codes so 1.16's emission stays mechanical (`movement_type: "in-front"`). Adding `domains["receiving"]` needs no `RECORD_VERSION` bump (additive), but the `code_version` change forces full re-extraction — expected, not a bug.

### Previous-story intelligence (1.12 + 1.11 + 1.5 + 1.3, distilled)

- **Read `pipeline/markers/defensive_actions.py` before writing a line.** It is the closest template: multi-panel typing from printed titles (`_typed_panels`, `_panel_title`), label-anchored headline values (`_headline_value`), the x-restricted table (`_regain_table_rows`, `_regain_header_line`), per-panel `DIRECTION` assertion, the documented-absence branch (`UNCOUNTED_FAMILIES`, `ABSENT_COUNTERPART_WARNING`), and the SV block that emits no check for an absent counterpart.
- **The probe overturning the story spec is the norm here, not the exception.** 1.11 expected shots-shaped table pages and per-event rows; the page had neither. 1.12's pre-filed "two panels of exactly equal area" was wrong in mechanism (they differ by 0.0017 pt², so `max` was deterministic, not a tie-break). This story's overturn is larger than both — record what you measure, never bend the page to the spec.
- **`re.ASCII` on every digit class** (fullwidth digits otherwise pass `int()`); the fullwidth test needs `fontname="japan"`.
- **No dedup, ever** — the AD-8 invariant. Nothing in this family invites it, and nothing may introduce it.
- **Memo pattern:** the gate checks' one-slot memos keep a strong ref to the last open Document and replay cached exceptions (OPEN deferred entries, five instances after this story). Copy verbatim; do not refactor.
- **Unknown-RGB reporting is one-per-report and side-blind** (OPEN deferred item) — inherited; don't fix here.
- **The full-corpus run exits 1 by design from 1.12 onward** (Task 6.2). Asserting exit 0 will make you "fix" a source defect that is correctly reported.

### Project Structure Notes

- New: `pipeline/markers/receiving.py`, `pipeline/tests/test_markers_receiving.py`.
- Modified (additive only): `pipeline/markers/errors.py`, `pipeline/ingest/extract_report.py`, `pipeline/validate/checks.py`, `pipeline/tests/conftest.py`, `test_runner.py`, `test_ingest_record.py`, `pipeline/README.md`, `deferred-work.md`, `sprint-status.yaml`.
- Unchanged by design: `pipeline/markers/filter_chain.py` (no chain edit), `pipeline/extract/**`, `/contract`, `app/`.
- Records: `work/extracted/{match_id}.json`, snake_case staging, canonical JSON (sorted keys, LF, atomic replace).
- Python: `pipeline\venv\Scripts\python.exe` (no `uv`). Tests: plain pytest functions, synthetic-first; ground truth auto-skips when `spike/mex_rsa.pdf` is absent.

### References

- Story spec: `_bmad-output/planning-artifacts/epics.md:462-481`
- Anchors: `pipeline/discover/anchors.py:73-74` (offers, movement), `:119-124` (individual-offers-receptions — Domain G's, out of scope)
- Filter chain: `pipeline/markers/filter_chain.py` (MarkerSpec:46, detect_pitch_frames:88, detect_pitch_frame:125, collect_candidate_markers:142, legend_row_ys:190, exclude_legend_rows:207, key_outcomes:224)
- Primary template: `pipeline/markers/defensive_actions.py` (spec:98, label map:110, parse:197, SV block:323, clamp:348, panel title:370, typed panels:391, direction assert:457, headline value:505, x-restricted table:570, header validation:659)
- Secondary: `pipeline/markers/crosses.py` (spec:72, parse:137, SV block:215, clamp:234, x-restricted table:272); `pipeline/markers/shots.py`; table helper `pipeline/markers/attempts.py::table_lines`
- Errors: `pipeline/markers/errors.py` (MarkerError:14, UnknownRgbError:33, UnknownLabelError:66, DefensiveActions*:176-224)
- Extract seams: `pipeline/ingest/extract_report.py:189-222` (parser calls), `:231-269` (check appenders), `:284-292` (`domains`)
- Manifest: `pipeline/ingest/batch.py` (`_self_validation_trustworthy`, `_mirror_self_validation`, `format_summary`); aggregator `pipeline/extract/__init__.py::aggregate_self_validation` (binary — read before designing the absence branch)
- Gate: `pipeline/validate/checks.py` (crosses memo:690-711, registration pattern:1027-1040); categories `pipeline/validate/deviations.py:18`; **placeholder to avoid** `pipeline/tests/test_checks_registry.py:122-144`
- Contract: `contract/match-bundle.schema.json:673-710` (`ReceivingEvent`, receiving-team `$comment`), `:796-799` (`events.receiving`); `contract/common.schema.json:206-217` (`ReceivingEventType`, `OfferMovementType`), `:219` (`InPossessionPhase` non-partition precedent); provenance `contract/README.md:129`; acting-team table `:90`; 2.3 sign-off `:474`
- Domain G payload consumed at the seam: `record["domains"]["player_stats"][side][].in_possession.{total_offers, offers_received, offers_by_movement_type}`
- Architecture: ARCHITECTURE-SPINE.md AD-6 (receiving event = receiving player's team), AD-8 (binary SV, fail loud, no dedup, text-anchored never positional), AD-9 (one chain, geometry before color), AD-14 (contract change flow), AR-16 (mex_rsa counts-only ground truth), FR-10/FR-11/FR-14/FR-15
- Ledger: `deferred-work.md:41` (filter-chain advisory — **last named story**), `:113-117` (1.11's AD-14 filings, the template for Task 7), NEEDS-ADJUDICATION entry (M19/M58 corpus baseline)
- Prior stories: `1-12-defensive-actions-map-parser.md` (primary), `1-11-crosses-map-parser.md`, `1-10-domain-g-extraction-...md` (cross-domain check precedent), `1-3-shots-pitch-map-parser-...md`

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context) via Claude Code / BMad `dev-story`.

### Debug Log References

**Suite baseline before starting (Task 6.1), measured on this tree:** `906 passed, 2
failed, 1 skipped`. Both failures are pre-existing and **not** this story's:
`test_anchor_registry::test_registry_resolves_to_the_expected_anchor_count` (in-flight
Story 1.8 registers a new `Distribution in the Final Third` anchor and has not yet
updated that count) and `test_ingest_fingerprint::test_code_version_is_stable_across_calls`
(an artifact of `pipeline/**/*.py` being edited while the run was in flight). 1.8's work
is uncommitted in the same working tree throughout this story — see "Coordination" below.

**Task 1 — the probe, re-derived from scratch.** Three scratchpad passes (`spike/` stayed
read-only, AR-16; probe scripts are session-scratchpad only):

- **Pass A** — layout census over all 104 reports / 416 receiving pages, straight from
  `page.get_drawings()` / `get_text("words")` / `get_image_info()`.
- **Pass B** — full anatomy dump of the m001 (`spike/mex_rsa.pdf`) offers and movement
  pages, which is where the reading rules were designed.
- **Pass C/D** — an **independent prototype extractor**, written from the pass-A/B
  measurements *before* `receiving.py` existed, run over all 104 reports together with the
  shipped parser and compared **cell by cell**. Every staged value agreed on 208/208
  sides (1,456 scalar comparisons plus tables, grids, donuts and top-ranked rows: all
  `True`, zero disagreements). The nine reconciliations below are computed from the
  *prototype's* numbers, so they remain a check on the page rather than on the parser.

Every figure the story pre-filed reproduced exactly. Recorded verbatim:

| measured | result |
| --- | --- |
| `offers:{side}` / `movement:{side}` anchors | exactly ONE page each, **208/208** per family |
| offers page size | 960 × 540 on 208/208 |
| offers qualifying stroked rects | **4** on 208/208; **2** distinct after rounding-geometry dedup |
| offers panel rects | `(234.0, 222.75, 426.0, 497.25)` ×208 and `(450.0, 222.75, 642.0, 497.25)` ×**624** (3 copies: 1 stroke-only + 2 stroke+fill), all area 52,704.0, stroke width 2.7439 |
| offers panel titles | `Offers Made Inside Shape` 208/208, `Offers Made Outside Shape` 208/208 |
| offers decoration | **11** circles per panel on **416/416** panels; width **8.229** on 4,576/4,576; fill `(0.18, 0.3, 1.0)` on 4,576/4,576 |
| decoration positions | identical between the two panels on **208/208**, and the 11-offset signature is **byte-identical on all 208 pages** |
| in-panel white furniture | 1.371 pt ×4/page, 2.743 pt ×2/page — filled all-Bézier, excluded only by `marker_min_pt` |
| 9.0 pt circles on the offers page | **0** |
| words inside each offers panel | **exactly 1** on 416/416 — the shape badge |
| offers table row count | 16 (154 pages), 15 (26), 17 (15), 14 (11), 13 (2) = 208 |
| KPI value → label offset | dy **40 pt** on 208/208; x-centre offset **0 pt** for four labels and **11 pt** for the two-line `Offers Made in Defensive Third` |
| Most-Offers block | exactly **3** lines below its title on 208/208 |
| movement qualifying stroked rects | **exactly 1** on 208/208, `(675.0, 129.0, 936.0, 502.5)`, area 97,483.1, width 3.7318 |
| movement panel title | `Movement Types Pitch Third` 208/208 |
| markers inside the movement panel | **0** on 208/208 (8.2 pt census = 0) |
| movement rotated labels | `DIRECTION` + the three `... THIRD` labels, all `dir = (0.0, -1.0)`, 208/208; `DIRECTION` inside the panel on 208/208 |
| third labels vs panel | printed **6-7 pt LEFT of the panel's own x0** (outside it) on 208/208 |
| digit words inside the movement panel | **48** on 208/208 = 15 grid values + 33 axis ticks |
| grid value → label dy | **1.1 pt** on 3,120/3,120 cells; exactly one value per label on 3,120/3,120 |
| grid shape | 15 cells, **5 per third**, on 208/208 |
| deduped image rects per movement page | **5** on 208/208 (4 donuts + the logo); **exactly 1** digit word inside each titled donut rect on 208/208 |
| 9.0 pt circles on the movement page | **5**, in **5 distinct fills** (the legend), 208/208 |
| Top Ranked Players rows | **5** on 208/208 |

**The nine reconciliations, re-derived (all exact):**

| # | reconciliation | result |
| --- | --- | --- |
| 1 | `final + middle + defensive == total_offers_made` | **208/208** |
| 2 | `inside_shape + outside_shape == total_offers_made` | **208/208** |
| 3 | Σ table `offers_made == total_offers_made` | **208/208** |
| 4 | Σ table `offers_received == total_offers_received` | **208/208** |
| 5 | Σ the 15 grid counts == `total_movements` | **208/208** |
| 6 | `total_offers_made` == Σ Domain G `in_possession.total_offers` | **208/208** |
| 7 | `total_offers_received` == Σ Domain G `offers_received` | **208/208** |
| 8 | grid per-type total == Σ Domain G `offers_by_movement_type`, each of the FIVE | **208/208** |
| 9 | `made_received_pct == round(100 × received / made, 1)` | **3,208/3,208 rows, worst deviation 0.0 pp** |

**The crash branch, measured:** **81** corpus rows print `offers_made == 0`, and all 81
print `0%` in the percentage column (recorded rather than assumed — the check skips exactly
those rows and reports the skip count; it never divides and never coerces `0.0` into
existence). **The documented absences, measured:** the phase-total delta
`(final + progression + build_up) − total_movements` ranges **−48..+314** and is zero on
**3 of 208** pages; the donut slice values are inside the raster images, leaving exactly one
text word (the centre total) per donut region.

**Open questions closed by measurement:**

- **A — badge → family mapping.** Resolved text-anchored and end to end: each panel is
  typed from its own printed title through the frozen `OFFERS_PANEL_TITLE_TO_KEY` (the
  1.12 `_panel_title` precedent — a band just above the frame, inside its x-span, 15.9 pt
  clearance measured), and the badge is then the unique digit word inside that *typed*
  panel. Never x order. Both titles are stable on 208/208, and the two badges sit at
  different y on the reference page, so nothing positional may be read into them. A test
  swaps the two printed titles and asserts the badge values swap with them.
- **B — duplicate qualifying rects.** Confirmed: 4 qualifying rects, 2 distinct panels on
  208/208; the right panel carries its white-stroked frame **plus two stroke+fill rects of
  bit-identical geometry** (416 of the 832 qualifying rects corpus-wide carry a fill — the
  raster shape overlay's border). De-duplicated by rounded geometry **inside this parser**;
  the shared chain is untouched. Anything other than exactly 2 distinct panels is a typed
  layout error.
- **C — `Top Ranked Players` table shape.** Header words `Type | Player | Movements` on one
  line, 208/208; five type rows, 208/208. The **shirt number is its own cell** (x ≈ 346)
  printed before the name (x ≈ 358) — measured, not assumed. Names do **not** straddle the
  row line here. The load-bearing finding: the table needs a **right** bound as well as a
  left one, because the rotated `... THIRD` labels extract at x ≈ 664.6, *left* of the
  pitch panel's own x0 (675.0) — so the panel edge is not a usable bound and an
  unrestricted trailing-cell rule swallows `THIRD` into every row. The bound is derived
  from the header's own `Movements` column (633.3 on 208/208).

**Discovery not in the pre-filed probe (Task 2.7's rule needed widening).** Four corpus
pages print a **three-line player name** in the offers table — `Marcus HOLMGREN` 4.5 pt
above the numeric row and `PEDERSEN` 4.5 pt below it — which leaves the numeric cluster
holding only a shirt number, two counts and a percentage, with **no name at all**. The
first full-corpus sweep failed exactly there (`PMSR-M41-NOR-V-SEN`, `PMSR-M61-NOR-V-FRA`,
`PMSR-M78-CIV-V-NOR`, `PMSR-M99-NOR-V-ENG`). Closed by gathering the name from the name
x-band across neighbouring lines — the `crosses.py` / `defensive_actions.py` precedent —
rather than from the row cluster; a row with no name anywhere still fails loud. Re-run:
0 failures on 104/104.

**Forced repair (one, and it is the trap the story named).** `counts[...]["movement"]`
initially keyed `grid_by_type` by the contract's **kebab** codes, which
`test_ingest_record::test_record_keys_are_snake_case` caught immediately — the same slip
Story 1.12 was caught making. Re-keyed to snake_case; the kebab code still travels as a
*value* on every `by_third_and_type` cell (and is Domain G's own spelling on the other side
of the cross-domain check, so the comparison now compares like with like).

**Suite green at the end (Task 6.1): `1040 passed, 1 skipped, 0 failed`** — up from the
`906 passed / 2 failed / 1 skipped` baseline. This story contributes **66** new tests; the
remaining growth and the disappearance of both baseline failures are in-flight Story 1.8
catching up in the same tree (it updated the anchor-count expectation), and the
`code_version` stability failure was the editing-during-the-run artifact it looked like.
**Zero forced repairs to other stories' tests**, and one forced repair to my own code (the
kebab-key slip above).

**Task 6.2 — full batch over all 104 PDFs.** `code_version` changed, so the run was also
executed with `--force` to prove the all-104 re-extract rather than inferring it (a
concurrent session had already re-extracted 83 of them against the same code version):

```
--force :  extracted 104 / failed 0 / skipped-unchanged 0
           RUN RESULT: FAIL (0 failed, 2 self-validation-failed, 0 corpus gaps, 0 orphans)
re-run  :  extracted 0   / failed 0 / skipped-unchanged 104
           RUN RESULT: FAIL (0 failed, 2 self-validation-failed, 0 corpus gaps, 0 orphans)
```

**This is the ruled clean baseline, asserted rather than a zero exit code** (1.12 review
ruling): the two self-validation failures are `defensive-actions-marker-count` on the away
side of `PMSR-M19-ARG-V-ALG` (39 markers, 40 printed) and `PMSR-M58-TUN-V-NED` (33, 34) —
both pre-existing and ledgered as NEEDS ADJUDICATION. **No third failure appeared, so none
of the 26 receiving checks per report failed on any of the 104 reports** (2,704 checks).
Records are **byte-identical**: 104/104 SHA-256 hashes unchanged across the `--force`
re-extract.

**Task 6.3 — the FR-15 venue × matchday gate, re-run with both parsers active:**

```
Template-consistency verification
=================================
corpus          : pmsr-corpus
reports found   : 104 (probed 104, probe failures 0)
checks run      : anchor-coverage, crosses-count-match, crosses-parse,
                  defensive-actions-count-match, defensive-actions-parse,
                  domain-a-completeness, domain-a-counts, domain-b-completeness,
                  domain-b-counts, domain-c-completeness, domain-c-counts,
                  domain-g-completeness, domain-g-counts, marker-event-link-rate,
                  metadata-probe, momentum-axis-scale, momentum-coverage,
                  receiving-count-match, receiving-parse, shots-count-match, shots-parse
sample size     : 16

Deviations by category
  missing-anchor   0
  unknown-rgb      0
  count-mismatch   0
  probe-failure    0

GATE RESULT: PASS (0 deviation(s) across 16 sampled report(s), 0 corpus gap(s))
```

The sample records **0** receiving deviations, which on its own is indistinguishable from a
check that never fires — so, per the 1.12 precedent, the same `run_verification` entry
point was run over a directory carrying a forced mismatch. It emits one deviation per
failing team **and** check id, each naming both operands:

```
count-mismatch 2
  receiving-count-match  receiving-movement-grid-total: away: page reads 993, counterpart is 240
  receiving-count-match  receiving-offers-shape-sum:    home: page reads 1125, counterpart is 252
```

**Coordination note (commit hygiene).** Story 1.8 (momentum) is in flight and uncommitted
in the same working tree for the whole of this story; it owns `pipeline/extract/momentum.py`,
its own seam lines in `extract_report.py` / `checks.py`, the `Distribution in the Final
Third` anchor and the `momentum_*` `make_report` kwargs. Every edit this story made to a
shared file is **additive and appended after every existing appender**; no existing check
was reordered and `pipeline/extract/` was not touched. Two of the shared files
(`test_runner.py`, `conftest.py`) were edited by that session mid-story. Story 1.10
(Domain G) reached `done` during this story and its files are also in the tree. Only this
story's files are to be committed; anything co-committed must be disclosed in the commit
message (the 19816fc precedent).

### Completion Notes List

- **The epic's premise was overturned, and the re-derivation confirmed it corpus-wide.**
  Neither receiving page is a marker-scatter pitch map; both are dashboards. There is no
  coordinate, no per-event row and no ordinal glyph anywhere in the family on 416/416
  pages, so **no `ReceivingEvent` row is producible and none was fabricated**. AC 1 is
  satisfied as its BINDING reconciliation specifies: the chain IS composed, `teamId` is
  the receiving team on every staged row, the `offer | movement` discriminator survives as
  a staged value per side block, and the unfulfillable gap is filed as an AD-14 emission
  blocker (Task 7).
- **`pipeline/markers/receiving.py`** — two public parsers (`parse_offers`,
  `parse_movement`), pure over the open `Document`. Every value is read text-anchored:
  panels typed from their own printed titles, KPI values as the integer above their own
  label, badges as the unique digit word inside a *typed* panel, donut totals as the unique
  digit word inside a *titled* image rect, grid cells label-anchored per third. No absolute
  coordinate is used as an anchor anywhere.
- **The 11-dot census is the story's real chain contribution.** The decoration is a static
  formation template — byte-identical across all 208 pages — so nothing is staged from it,
  but the full chain (`detect_pitch_frames` → `collect_candidate_markers` →
  `exclude_legend_rows` → `key_outcomes`) runs over both panels and **asserts**: exactly 11
  dots, one known fill, positions identical between panels. That is what makes AC 1's
  "reuse the chain, assert on unknown RGB" true here rather than a formality: a future
  template that starts drawing real markers aborts loud instead of publishing silence.
  **No chain edit was made.**
- **Seven Self-Validation check ids, 26 checks per report**, all exact and binary with both
  operands always recorded (FR-14, SM-C1, AD-8). The made/received table sum is two checks
  and the per-type grid reconciliation is five, because a merged check cannot say which
  column or type failed. The two cross-domain families are computed at the
  `extract_report.py` seam where Domain G's payload is in hand, and emit **nothing** when it
  is unavailable rather than a failing check.
- **Both documented absences take AC 2's absence branch** — `null` counterparts in `counts`
  plus one warning per report each, and **no check at all**, because
  `aggregate_self_validation` is strictly binary and a "not-applicable" check would fail
  every record in the corpus. Reconciliation 9's crash branch (81 rows printing
  `offers_made == 0`, all printing `0%`) is skipped by count, never divided, never coerced.
- **Two gate checks, `receiving-parse` / `receiving-count-match`**, on a one-slot memo
  copied verbatim from `_crosses_memo`. The `offers-*` prefix was deliberately not claimed:
  `offers-count-match` is `test_checks_registry.py`'s unclaimed placeholder id, and a test
  now asserts no `offers-*` or `movement-*` id is registered.
- **Tests: 55 new in `test_markers_receiving.py`**, plus 3 in `test_ingest_record.py`, 2 in
  `test_ingest_batch.py` and 7 in `test_checks_registry.py` (67 total; the "6"/"66"
  figures were a miscount, corrected by the 2026-07-27 review). Synthetic-first, with every
  expected value derived from what the factory drew — the fixture's printed totals are
  themselves **derived from this report's own Domain G rows**, which is what keeps the two
  cross-domain reconciliations green when a caller changes the lineup. The fixtures
  reproduce all three real collisions (a KPI value inside the first table row's 3 pt
  cluster — asserted by its own test so the regression cannot silently stop biting; a
  three-line name straddling its numeric row; rotated `... THIRD` labels extracting left of
  the panel edge) and the offers page's 4-qualifying-rects-for-2-panels input.
- **Discovery worth carrying forward:** the offers table needs the name x-band that
  `crosses.py` / `defensive_actions.py` already use — four corpus pages print a three-line
  name. The pre-filed probe had not seen it, and the first full-corpus sweep found it.
- **`deferred-work.md`'s filter-chain advisory reached its last named story and is CLOSED**,
  with the reuse envelope now proven across all five instantiations; the residual chain-level
  concern raised by the 1.12 review (an out-of-panel marker never reaching `key_outcomes`)
  stays filed where it was, as a property of the shared chain rather than of this parser.

### File List

New:

- `pipeline/markers/receiving.py`
- `pipeline/tests/test_markers_receiving.py`

Modified (additive / append-only):

- `pipeline/markers/errors.py` — `ReceivingPageLayoutError`, `ReceivingTableError`
- `pipeline/ingest/extract_report.py` — parser calls, `domains["receiving"]`, the two
  absence warnings, one appended `self_validation["checks"].extend(...)`, docstrings
- `pipeline/validate/checks.py` — `_receiving_memo` + the two registered gate checks,
  imports, module docstring registry list
- `pipeline/tests/conftest.py` — receiving synthesis constants, `default_offers_block` /
  `default_movement_block`, `emit_offers_pages` / `emit_movement_pages` (default-on), the
  two anchor-loop branches, the `offers_*` / `movement_*` kwargs
- `pipeline/tests/test_ingest_record.py` — three receiving tests, exact warning set
- `pipeline/tests/test_ingest_batch.py` — manifest mirroring + the two absence warnings
- `pipeline/tests/test_checks_registry.py` — six receiving gate-check tests
- `pipeline/tests/test_runner.py` — the two new ids in the sorted `checks_run` list
- `pipeline/README.md` — gate-check list, layout table, "The receiving domain (Story 1.13)"
- `_bmad-output/implementation-artifacts/deferred-work.md` — the six Task 7 filings; the
  filter-chain advisory closed
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status + run notes
- `_bmad-output/implementation-artifacts/1-13-offers-movement-to-receive-parsers.md` — this
  record

Unchanged by design: `pipeline/markers/filter_chain.py` (no chain edit),
`pipeline/extract/**`, `/contract`, `/data`, `app/`, `spike/`.

### Review Findings (Code Review 2026-07-27)

Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) over the
1.13-scoped diff (~4,639 lines; the shared files also carry in-flight Story 1.8 hunks,
which were excluded from attribution). All three ACs audited as satisfied, and the
Auditor separately confirmed Tasks 2.9, 2.5, 3.1, 3.2, 3.3, 4.1-4.4, 2.3, the scope
boundaries and the filter-chain advisory closure. 37 raw findings merged to 21;
5 dismissed as noise. The substantive theme is **test evidence, not parser correctness**:
the fixture is numerically degenerate in three places, so the story's own AD-8
text-anchoring proofs cannot fail.

**Decisions needed**

- [x] [Review][Decision] The movement grid's pitch-third assignment is a nearest-centre-y positional rule with no third-sensitive check anywhere — `receiving.py:1175` (`third = min(thirds, key=lambda pair: abs(pair[1] - center_y))[0]`) is exactly the "closest wins" shape `_labelled_value:1402` explicitly rejects. The only guard (`:1186`) counts 5 cells per third, so a cross-band swap keeps 5/5/5 and passes; `receiving-movement-grid-total` sums across thirds and `receiving-movement-domain-g` sums per type across thirds, so neither is third-sensitive. Compounded by the fixture (below): `default_movement_block` splits each type's total into `total//3, total//3, remainder`, and every per-type total (72/60/48/36/24 at 12 players) is divisible by 3, so all three thirds print identical values and any permutation is invisible to `test_movement_values_are_what_the_page_printed`. Ground truth asserts only the sum. This is the module's riskiest read, in the payload Task 7.2 nominates as `ReceivingEvent`'s replacement, with zero coverage. Options: assert the 15 cells carry 15 distinct `(pitch_third, movement_type)` pairs / bound each row to its third's band geometry rather than nearest label / accept and document as unverifiable. **RULED 2026-07-27: ASSERT 15 DISTINCT `(pitch_third, movement_type)` PAIRS.** Smallest change that makes the existing 5-per-third guard meaningful, catches any cross-band swap or duplicate, and needs no new corpus probe. Converted to a patch below.
- [x] [Review][Decision] `receiving-offers-table-pct` reports `"pass"` over zero checked rows — `receiving.py:429` is `"pass" if pct_matching == pct_checked`, so an empty or fully-rejected table gives `0 == 0` → pass. The diff's own `test_fullwidth_digits_are_rejected_as_a_shirt_number` produces `table_rows == []` and this check still passes; only `receiving-offers-table-sum` catches that page. Changing pass→fail on zero rows is not free: a legitimately all-zero-made table would start failing the corpus baseline. Options: fail when `pct_checked == 0` and the table is non-empty / keep the pass and rely on the operands added by the patch below / leave as-is and document. **RULED 2026-07-27: RECORD BOTH OPERANDS, KEEP THE PASS.** A zero-row pass becomes self-describing in the manifest and at the gate, `receiving-offers-table-sum` demonstrably catches an unread table, and the ruled 104-report baseline is untouched. Folds into the operands patch below.
- [x] [Review][Decision] `phase_sum` — a sum of the explicitly non-partitioned phase totals — is computed and staged into every record (`receiving.py:570`), shipping as `counts.home.movement.phase_sum: 337` beside `total_movements: 309` in `work/extracted/PMSR-M01-MEX-V-RSA.json`. No check reads it (Task 3.3(b) is satisfied — nothing sums them into a check), but Task 7.4's filing tells downstream surfaces "never sum them" while the record hands them a pre-computed sum with no label. Its only reader is the fixture guard `test_the_phase_totals_are_deliberately_not_a_partition`. Options: remove the key and rewrite that guard against `by_phase` directly / keep it and rename to something self-warning. **RULED 2026-07-27: REMOVE THE KEY, REWRITE THE GUARD.** Task 7.4 tells downstream surfaces never to sum the phases; staging a pre-computed sum hands them exactly that. `test_the_phase_totals_are_deliberately_not_a_partition` is re-expressed against `by_phase` directly. Converted to a patch below.

**Patches**

- [x] [Review][Patch] Fixture degeneracy makes the flagship AD-8 text-anchoring tests tautological [pipeline/tests/conftest.py:579-589]
- [x] [Review][Patch] The gate's receiving anchor loop bypasses `_domain_anchor_pages`, mis-attributing registry drift and rebuilding a second full-document `PageTextIndex` [pipeline/validate/checks.py:1233-1246]
- [x] [Review][Patch] `top_ranked_players` silently drops a row whose type label is unmapped, so a future sixth `No Movement` row passes the 5-row guard [pipeline/markers/receiving.py:1249-1250]
- [x] [Review][Patch] No failing-case test for `receiving-offers-domain-g` / `receiving-movement-domain-g`, which Task 5.2 requires for each of the seven ids [pipeline/tests/test_markers_receiving.py:853]
- [x] [Review][Patch] `receiving-offers-table-pct` is the one check omitting `page_value`/`counterpart`, contradicting the module docstring and `pipeline/README.md` [pipeline/markers/receiving.py:427-440]
- [x] [Review][Patch] `_count_check`'s `**extra` is spread last, so a caller keyword can silently overwrite `result`, `check`, `page_value` or `counterpart` [pipeline/markers/receiving.py:499-509]
- [x] [Review][Patch] `_rotated_lines` filters horizontal text on bit-exact `direction == (1.0, 0.0)` while the same module documents float noise and uses a 1e-6 tolerance 250 lines earlier [pipeline/markers/receiving.py:1481]
- [x] [Review][Patch] `_labelled_value` collapses "no digit above the label" and "digit off-centre" into one message, dropping the near-miss diagnostic its cited `defensive_actions._headline_value` precedent provides [pipeline/markers/receiving.py:1428-1441]
- [x] [Review][Patch] `conftest.py` records the zero-made corpus figure as 78; the measured value is 81 (re-verified over all 104 staged records) [pipeline/tests/conftest.py:2138]
- [x] [Review][Patch] Dev Agent Record test counts are wrong: `test_checks_registry.py` gains 7 tests, not 6, so the total is 67, not 66 [1-13-offers-movement-to-receive-parsers.md:539]
- [x] [Review][Patch] Change Log claims "six AD-14 notes filed"; five AD-14 bullets were filed (the sixth new ledger bullet is an ordinary deferral) [1-13-offers-movement-to-receive-parsers.md:591]

**Deferred**

- [x] [Review][Defer] The movement pitch panel has no decoration census and no unknown-RGB seam [pipeline/markers/receiving.py:947] — deferred, spec-scoped
- [x] [Review][Defer] `_check_receiving_count_match` catches `PipelineError` but registry drift raises `LookupError` [pipeline/validate/checks.py:1295] — deferred, pre-existing
- [x] [Review][Defer] `most_offers` is staged entirely unreconciled though the same page prints a usable counterpart [pipeline/markers/receiving.py:745] — deferred, unverified corpus-wide
- [x] [Review][Defer] `most_offers` assigns name and position by line index, and a name wider than its title's x-span truncates silently [pipeline/markers/receiving.py:769-797] — deferred, pre-existing pattern
- [x] [Review][Defer] A table row whose leading cell is not an ASCII digit is dropped silently, and a dropped zero-offers row is invisible to every check [pipeline/markers/receiving.py:850] — deferred, pre-existing
- [x] [Review][Defer] A Domain G shape change raises a bare untyped `KeyError` out of the cross-domain block [pipeline/markers/receiving.py:456-483] — deferred, pre-existing
- [x] [Review][Defer] The decoration census is a panel-symmetry tripwire, not the template-revision tripwire the README calls it [pipeline/markers/receiving.py:697-703] — deferred, inherent

## Change Log

| date | change |
| --- | --- |
| 2026-07-26 | Story implemented. Task 1 probe re-derived over all 104 reports / 416 pages (independent prototype, compared cell-for-cell with the shipped parser: 0 disagreements); `pipeline/markers/receiving.py` with two parsers on the shared chain + the 11-dot census tripwire; seven Self-Validation check ids (five page-internal, two cross-domain at the extract seam); both documented absences on AC 2's absence branch; `receiving-parse` / `receiving-count-match` gate checks; 66 new tests; batch 104/104 at the ruled baseline with byte-identical re-extract; FR-15 gate PASS with the deviation path proven on a forced mismatch; five AD-14 notes filed (Tasks 7.1-7.5) plus two ordinary deferrals, and the filter-chain advisory closed. |
| 2026-07-27 | Code review: 3 decisions ruled, 14 patches applied. Grid cells now assert 15 distinct (pitch third, movement type) pairs; `phase_sum` removed from `counts`; the gate's receiving anchor loop routed through `_domain_anchor_pages`; `receiving-offers-table-pct` records both operands; `_count_check` spreads `**extra` first; `_rotated_lines` uses the direction tolerance; `_labelled_value` splits its two diagnoses; `top_ranked_players` asserts five distinct types; the offers/movement fixtures de-degenerated so the AD-8 text-anchoring tests can fail; two cross-domain failing-case tests added; three doc figures corrected. 7 findings deferred to the ledger. |

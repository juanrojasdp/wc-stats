# Deferred Work

Items raised by reviews that were consciously deferred rather than fixed or dismissed.

## Deferred from: code review of 2-8-pass-network-visualization (2026-07-27)

- **One bad coordinate anywhere in the pass network kills all eleven Tactical sections.** `TacticalErrorBoundary` wraps `<TacticalLayer>` whole (`app/src/components/MatchBundleRegion.tsx:155-157`), so the fail-loud throws in `pass-network-model.ts` (`:262` unreadable node coordinate, `:336` unresolvable edge endpoint) take Key Statistics, Momentum, Shot Maps and every other section down with the pass network. The fail-loud posture itself is right and ruled; the blast radius is the problem. This is pre-existing architecture — `ShotMapsSection` and `marker-model.ts:130` both rely on the same whole-layer boundary — but 2.8 wires the **least-validated** data family to it: Story 1.14 has never probed the "Passing Networks" page, and `PassNetworkNode.x`/`y` are `required` with no extractor yet written. A per-section error boundary would contain each viz to its own panel. Route to whichever story next touches `MatchBundleRegion` / `TacticalSection`, or to 2.19.

- **`pitchMarkings` draws goal furniture at one end only, so a full pitch has a bare defending third.** Independently re-confirmed by this review at `app/src/viz/pitch-geometry.ts:266-327`: `penaltyArea`, `sixYardBox`, `penaltySpot`, `penaltyArc` and `goal` are all built unconditionally at the attacked end, and the `isFullPitch` branch adds only the halfway line, centre circle and centre spot. Duplicate of the entry the 2.8 dev already filed above — recorded here only to note the review reached it independently and rated it user-visible on **every** pass-network figure (nodes sit at x≈20–25, inside the blank half). Deferred for the same reason: shipped, tested 2.7 code on 2.8's do-not-touch list, `aria-hidden` decoration with no data riding it, and no ruled reference for the second end. Whoever owns the next full-pitch surface (2.9) should rule it.

- **A self-loop pass edge reads "1 conexión" but highlights nothing when isolated.** `app/src/viz/pass-network-model.ts:437` counts `from === to` once in `nodeDegree`, so the node's accessible name promises a connection, while `incidentPlayerIds` (`:419-433`) deletes the self id and returns an empty neighbour set — isolating the node therefore dims every teammate and lights no edge. The geometry emits a zero-length segment that `strokeLinecap="round"` paints as a stray dot. The contract does not forbid `fromPlayerId === toPlayerId` and all three fixtures carry zero; Task 3.8's actual requirement ("handled without a crash") is met. Deferred until 1.14 shows whether the source page can produce one. — **ANSWERED by Story 1.14 (2026-07-27): it cannot.** The pass matrix's diagonal is blank on **208/208** team-innings (asserted every run by the row census, which requires exactly one blank per row and that blank on the diagonal), so a self-loop edge is unreachable from this source **by construction**. The defect is real but not reachable from real data; see the Story 1.14 filing at the foot of this file.

- **A selected marker forced to the front can outrank the cluster's described front member.** `app/src/components/PitchPanel.tsx:531-541` adds `selectedIndex` to `drawOrder`'s front set alongside the member `frontOfCluster` points at; the sort is stable on original index, so when both live in one cluster the marker painted on top may not be the one the popover describes. Same class as the 2.7 review's centroid-seeding finding (the drawn marker and the described marker disagreeing), but bounded: it needs a pinned node sharing a cluster with a fronted sibling, and in dialog mode every member is listed anyway. Deferred; revisit with whatever rules the selection/z-order interaction for 2.9.

- **At `<md`, pinning a player whose incident edges are all in the lowest quintile highlights nothing.** `app/src/components/PassNetworksSection.tsx:263` hides the stop-1 band by default below `md`, and `:282` filters before the isolation opacity is applied — so for a low-volume player the pin dims every teammate and reveals no edges at all. Working exactly as decisions 4 and 6 rule it, and "Mostrar todos los pases" is one press away, but it is a dead-end state reachable without any cue as to why. Deferred: the fix (suppress the declutter while a pin is active, or disclose the interaction) is a UX ruling this story does not have.

## Deferred from: code review of 1-4-template-consistency-verification-across-the-venue-matchday-sample (2026-07-22)

- **Cover-line reconstruction thresholds are unvalidated at the boundary** — `pipeline/discover/probe.py:41-43` hard-codes `_LINE_TOLERANCE_PT = 3.0` and `_SPACE_GAP_PT = 1.0` with no fallback. A scoreline whose team-name spans and score digits differ in font size by more than 3.0pt splits into separate lines and the report dies with `"cover page has no scoreline"`; at a gap of exactly 1.0pt (`>` not `>=`) no space is inserted and the away team becomes `"SouthAfrica"`, which then propagates into every away anchor as a wrong-but-plausible team name. No test exercises either boundary — all synthetic covers use a single `fontsize=18` `insert_text` per line. Deferred: validating the thresholds requires the real 104-report corpus.

- **Zero-width and format characters survive `normalize`** — `pipeline/discover/text.py:26` collapses only `str.split` whitespace, so U+200B, U+00AD and the `ﬁ`/`ﬂ` ligatures that PDF text extraction commonly emits pass through on both sides of the anchor comparison. A cosmetic font change would therefore report as a template revision across the whole corpus. Deferred: cannot confirm the corpus exhibits this without the 104 PDFs. Related to the open decision on unicode normalization of stratification keys.

## Deferred from: code review of 1-1-contract-v1-schemas-fixtures-type-generation-spike (2026-07-22)

- ~~**`tournament.schema.json` has no `stages` collection** — Task 5's subtask reads "stages, groups with standings rows…", but the schema carries `groups` and `knockoutResults` (`contract/tournament.schema.json:27-38`) with stage held per-match via the `Stage` enum. Every row of the per-surface data-needs checklist is nonetheless satisfied, so nothing downstream is blocked. Deferred: Story 2.3 is the formal contract sign-off gate and walks the Hub's real rendering needs; if a top-level stage collection is wanted, that is where the requirement will surface as a concrete AD-14 change request rather than a guess made now.~~ — **RESOLVED by Story 2.3 sign-off (2026-07-23): NO-CHANGE.** Epic 2.12's AC ("results and standings by stage/group in artifact order") is met by `groups[]` + `knockoutResults[]` (ordered by stage then match number) with `stage`/`matchdayRound` on every `MatchResultRow`; stage sectioning is a client-side group-by — presentation, not aggregation. No top-level `stages` collection is wanted.

- **A zero-appearance squad member is schema-valid but fails the profile test** — `pipeline/tests/test_fixtures.py:436` asserts `fixture["matches"]` is non-empty, while `contract/player-profile.schema.json:36-70` sets no `minItems` anywhere, so a player with `appearances.played: 0` and empty `matches`/`trends`/`aggregates` is legal and would fail the suite. Related unconstrained pairings: nothing requires `played == started + substituteAppearances`, and `AggregateMetric.perNinety` has no rule tying it to `minutesPlayed: 0`. Deferred: no such fixture exists and none is required until real player profiles are emitted in Story 1.18, which is where the zero-minutes case must be decided anyway. — **Folded into FR-1** (Story 2.3 sign-off, 2026-07-23; see "Filed by Story 2.3 sign-off" below — this entry keeps the guard-suite-conflict detail).

- **No fixture exercises `decidedBy: "extra-time"`** — the third `DecidedBy` value (non-null `scoreAfterET`, null `shootoutScore`, populated `winnerTeamId`) appears in no fixture and in no assertion, so the shape the App must render for an ET-decided tie is unbuilt-against. `test_a_bundle_covers_a_knockout_decided_by_extra_time_and_a_shootout` guards only the shootout branch despite its name. Deferred: AC 5 requires only a knockout decided by extra time *plus* shootout, which `m074` covers; adding a fourth full bundle is a real cost and belongs with Story 1.18's profile/index fixture work. — **Folded into FR-1** (Story 2.3 sign-off, 2026-07-23; see "Filed by Story 2.3 sign-off" below).

## Deferred from: code review of 1-2-batch-ingestion-run-manifest-text-anchored-page-discovery (2026-07-22)

- ~~**The test suite is red on the current working tree — 3 failures, none from this story**~~ — **RESOLVED during this review (2026-07-22).** `pipeline/tests/test_fixtures.py::test_every_fixture_validates_against_its_schema` was failing for `m001`, `m002` and `m074` with `'cornersBySide' is a required property`, caused by Story 1.1's concurrent uncommitted edit to `contract/match-bundle.schema.json` adding `cornersBySide` to a `required` list ahead of its fixtures. Story 1.1's work caught up while this review ran; the full suite is now **440 passed, 1 skipped, 0 failed**. Recorded rather than deleted because it is the reason the review's mid-run test output looked red, and because it is a live example of two in-flight stories sharing one working tree.

- **All 104 staged Extraction Records are already stale against the current tree** — `code_version` fingerprints all of `pipeline/**/*.py`, so Story 1.1's edit to `pipeline/validate/schema.py` moved it from `a001b41f3e53` to `57572a38efaf`. Every staged record now carries the old key and the next run will re-extract all 104 (~2 minutes). This is exactly what the Dev Notes prescribe and the fingerprint working as designed — recorded only so it is not mistaken for a defect, and so the batch is re-run before Story 1.15 begins consuming records. Deferred: no action while `pipeline/validate/` is still being edited by Story 1.1.

- **No test exercises the batch beyond three reports** — `_corpus` (`pipeline/tests/test_ingest_batch.py:33`) indexes a five-element `TEAMS` list, so `count > 5` raises `IndexError`, and no test in the story goes above 3. Every docstring in the change set reasons about 104-report economics (idempotence payoff, orphan/phantom-match hazard, `--expect-reports 104`), but only the *mismatch* path of `--expect-reports` is asserted. Deferred: full-corpus acceptance at 104/104 is Story 1.19's stated scope, and the real run was performed and recorded in this story's Dev Agent Record.

- ~~**Synthetic fixtures give every anchor exactly one page**~~ — **RESOLVED by Story 1.3 (2026-07-23).** `make_report` now emits the real multi-page shots section per side: a map page with a stroked pitch rectangle, filled Bézier circle markers and a five-color legend row, plus one or more event-table pages (`shots_table_pages={"home": [17, 9]}` reproduces the overflow layout). Evidence from the full run: the two-page assumption itself was wrong — 37 of 104 real reports overflow the attempts table onto a second page (first seen as 37 `ShotsPageLayoutError` failures in Story 1.3's Task 7 batch run; the parser now sums rows across all table pages and the run is 104/104 with every Self-Validation passing).

- **Duplicate `anchor_id`s would silently overwrite in the record's anchor map** — `anchors[anchor.anchor_id] = …` (`pipeline/ingest/extract_report.py:89`) has no uniqueness check, and `resolve_anchors` does not enforce one either, so a `per_team` spec generating `foo:home` could collide with a plain spec named `foo:home` and only the last would survive. Deferred: registry-key uniqueness is `pipeline/discover/anchors.py`'s invariant to hold, and that module is outside this story's scope.

- **A three-way match-id collision loses one collision fact from the manifest** — on a duplicate, `match_id_owner[match_id]` is never reassigned (`pipeline/ingest/batch.py:178-186`), so the owner stays the first report forever. With three PDFs deriving one id, report A is failed twice and its final `error` names only the last collider; B's collision against A is erased from the artifact AD-8 designates the record of truth. Deferred: two-way collisions are handled correctly and are the realistic case; a three-way collision requires two independent mis-named downloads in one run.

## Deferred from: code review of 2-1-static-app-scaffold-with-design-tokens-i18n-structure-build-gates (2026-07-23)

- **Story 2.1 commit flips stories 1-3/1-6 to in-progress while their context files sit uncommitted** — commit `0cfc1e6`'s `sprint-status.yaml` change logs context creation for 1-3 and 1-6 and flips their statuses, but the referenced context artifacts exist only in the working tree, so the committed status file points at files absent from the commit range; the 2026-07-23 log lines are also interleaved out of chronological order. Deferred: resolves itself when the in-flight 1.3/1.6 working-tree changes are committed — another live example of in-flight stories sharing one working tree.

- **Zero-external-request audit (Task 8.4) is a one-time manual grep — nothing in the build re-checks it** — the AC #1 property "zero external requests" was proven once by hand-grepping `out/`; a future external `@import` or font regression would ship silently. A dependency-free post-export origin-grep script appended to the build chain closes it. Deferred: automated audits (Lighthouse/Playwright) are Story 2.19's stated scope; add the origin check there.

## Deferred from: code review of 1-3-shots-pitch-map-parser-with-marker-count-self-validation (2026-07-23)

- **Filter-chain robustness envelope for reuse (Stories 1.11–1.13)** — three facets of `pipeline/markers/filter_chain.py` are tuned to the shots maps and proven only there: legend exclusion drops *every* candidate whose rounded y lands in a legend bucket (a real marker sharing that y would vanish and resurface as an unexplained count-mismatch); legend grouping is exact rounded-bucket membership with no tolerance clustering (legend circles straddling a 0.05 pt tenths boundary would escape exclusion); and the "circle" filter admits any filled all-Bézier shape in the size window, with no closedness or circularity check. Evidence for deferring: the complete closed 104-report corpus reconciles every team's marker count with its attempts table (Task 7, RUN RESULT: PASS), and every failure mode lands loud in the binary count check rather than a silent pass. Revisit when the chain is instantiated for crosses/defensive-actions/offers maps, whose legends and marker geometry are unverified. — **Story 1.11 (2026-07-23): verified for crosses, no chain fix needed.** The crosses legend (2 swatches, 9.0 pt strokeless vs 7.4 pt stroked markers) is excluded by the SIZE window, deliberately not by lowering `legend_min_colors` to 2 — facet (a) is exactly why: real orange+blue marker pairs share a rounded y in the corpus (M50 dy=0.035 pt) and a 2-color legend rule would delete them. Facet (c)'s all-Bézier admission also held: cross trajectory arrowheads are all-`"l"` quads and never reach the size gate. The advisory stays open for 1.12/1.13's legends. — **Story 1.12 (2026-07-24): verified for defensive actions, no chain fix needed; one additive accessor added for a NEW gap.** Facets (a)/(b) never engage: that page's only swatches are a VERTICAL bullet stack (one colour per y), so no y-bucket ever reaches `legend_min_colors` and `exclude_legend_rows` is a no-op by construction — kept in the production path anyway. Facet (c) is the live one for this family and it HELD, but only because two independent geometry defenses cover it: the 9.0 pt bullet swatches share the markers' EXACT fill and sit 0.13 pt above them (`marker_max_pt=8.95` lands inside that gap), and the white penalty/centre spots (1.479 / 2.957 pt) are filled all-Bézier circles drawn INSIDE the panels that only `marker_min_pt` excludes — admitting either would have aborted all 104 reports on an unknown white fill. Each panel's four corner arcs are also stroke-only Béziers of the marker's exact width, excluded solely by the chain's `fill is None` test. The NEW gap (not one of the three facets): `detect_pitch_frame` returns `max(candidates, key=area)`, and this page family draws TWO pitch panels of all-but-equal area (61,168.1435 vs 61,168.1451 pt²), so it silently discarded one whole map on 208/208 pages. Closed additively by `detect_pitch_frames` (every qualifying stroked rect, in drawing order), with `detect_pitch_frame` re-expressed over it and proven identical on all 5,448 corpus pages plus byte-identical shots/crosses payloads over all 104 reports. The advisory stays open for 1.13's legends. One additive knob was added for a NEW gap the probe found (not one of the three facets): `MarkerSpec.pitch_margin_pt` (default 0.0, shots byte-identical) admits real touchline-cross centers ≤0.35 pt outside the frame on 9 corpus pages. — **CLOSED by Story 1.13 (2026-07-26), this advisory's LAST named story: no chain edit needed, and the reuse envelope is now proven across all five instantiations.** The receiving family turned out not to be a marker family at all (both pages are dashboards — see the 1.13 entries below), which changes what the chain had to survive rather than removing the question. Facets (a)/(b) never engage: the offers panels' decoration is a **single fill**, so no y-bucket can ever reach `legend_min_colors` and `exclude_legend_rows` is a no-op by construction — kept in the production path anyway, per the Story 1.5 review precedent. Facet (c) — "the circle filter admits any filled all-Bézier shape in the size window" — is the live one again and it **HELD**, guarded by the same two independent geometry defenses Story 1.12 documented: the in-panel **white penalty spots (1.371 pt) and centre spot (2.743 pt)** are filled all-Bézier circles that only `marker_min_pt` excludes (admitting either aborts all 104 reports on a white fill), and the sibling movement page's **9.0 pt legend swatches** sit above `marker_max_pt` (8.5) as well as outside the panel. Verified corpus-wide: exactly **11** admitted circles per panel on **416/416** panels, one known fill on **4,576/4,576** circles, and positions relative to each panel identical between the two panels on 208/208 pages. Story 1.13 deliberately keeps the chain in the production path over decoration it stages nothing from, precisely so that facet (c) has an assertion behind it — the census is the template-revision tripwire (`_assert_decoration_census`). **Nothing remains open in this advisory.** The residual chain-level concern raised by the 1.12 review — a size-window marker whose centre falls outside every panel is dropped before `key_outcomes`, so `UnknownRgbError` never sees it — is a property of the shared chain for every family and stays filed under the 1.12 review entry below, not here.

- **Unknown-RGB reporting is one-per-report and side-blind** — `key_outcomes` raises on the first palette miss, so the `shots-parse` gate check can emit at most one `unknown-rgb` deviation per report even if both maps carry several off-palette fills, and its specifics name the page but not the team side. Acceptable under abort-first semantics (AD-8); zero unknown RGBs exist in the closed corpus. Worth widening only if a future template revision ever surfaces one.

- **Timestamp guard whitelists a key suffix, not an exact path** — `pipeline/tests/test_ingest_record.py`'s no-volatile-timestamp scan exempts any record key path ending `.kickoff`, so any future field with that suffix silently escapes the guard; whitelisting the one known deterministic field by exact path is tighter. Out of Story 1.3's scope — the exemption arrived with story 1-6's Domain A merge; route to 1-6's review.

## Deferred from: implementation of 1-6-domain-a-extraction-metadata-lineups-formations (2026-07-23)

- **AD-14 note: `second-yellow` is not deterministically recoverable from the lineup page** — the contract's `CardType` enum is `yellow|second-yellow|red`, but the corpus's card glyphs expose exactly two fill RGBs across all 104 reports (amber `(0.984, 0.749, 0.141)` and red `(0.973, 0.443, 0.443)`; 260 yellows, 13 reds in 2,535 minute markers). A second yellow presumably renders as the red rect, indistinguishable from a straight red, and inferring "yellow earlier + red later = second-yellow" would be a guess (a straight red after a booking is legal and common). Domain A therefore records card types as `yellow|red` only, per the story's explicit instruction ("record card minutes with the card kind and file the type-gap as an AD-14 note — do not silently invent types"). If Story 1.16's bundle emission needs `second-yellow`, that is an AD-14 contract-change decision (either drop the value or define the inference rule explicitly), not an extractor patch.

- **AD-14 note: the corpus DOES print an own-goal marking — `contract/match-bundle.schema.json` records the opposite** (added by the 1-6 code review, 2026-07-23) — the schema's `GoalOwnGoal` `$comment` (line ~198) states "PMSR prints no own-goal marking anywhere in the 104-report corpus (verified 2026-07-22). v1 therefore always emits false; a source that distinguishes own goals is an AD-14 change request." Story 1.6 found exactly such a source: the red-football lineup glyph fill `(1.0, 0.0, 0.0)` is an own goal, 14 across the corpus, verified corpus-wide by `team score == own column's goal glyphs + opponent column's own-goal glyphs` (0 reconciliation failures / 104). Domain A records it per player as `own_goals`, and the `domain-a-goal-reconciliation` self-validation check depends on it. Story 1.16's bundle emission must flip `GoalOwnGoal` from always-false to real data via the AD-14 flow (schema `$comment` correction + `schemaVersion` decision + fixtures regenerated together); until then the contract's recorded corpus fact is stale. `/contract` is read-only for 1.6, so the ledger entry is the pointer.

- **Formation strings are located by pattern within the central band, not by the vertical `FORMATION` label** — the two formation values print as *rotated* text beside the central diagram (home label x≈324, away x≈627 on the reference report), so `pipeline/extract/domain_a.py::_parse_formations` finds them as the only dashed digit strings in the middle third and asserts exactly two. A future template that prints any other dashed digit string in that band (or a third formation) fails loud with `LineupCountError` — correct behavior, recorded so the failure localizes fast. Verified: exactly 2 such spans on all 104 corpus reports.

- ~~**`t()` boundary hardening belongs to Story 2.2**~~ — **RESOLVED by Story 2.2 (2026-07-23).** (a) Client-import seam closed mechanically: ESLint `no-restricted-imports` bars the `t` binding from `@/lib/i18n` (alias and relative paths) inside `src/components/**`, with 5 lint-fixture regression tests; type-only imports and `src/app/**`/server usage stay legal. (b) Throw-vs-fallback: production `t()` now falls back (es value, else the key) with `console.error`; dev/test keep the throw. Decisions recorded in the 2-2 Dev Agent Record. Original entry follows. — (a) nothing stops a client component from importing the server-safe `t()` from `app/src/lib/i18n.ts` directly: it compiles, renders Spanish, and will silently ignore locale switching once 2.2 wires the toggle — the single-accessor guarantee is convention, not mechanism; (b) `t()` throws on an unresolvable key, which after 2.2 ships persistence becomes an uncaught page crash with no error boundary (fallback-to-es + console.error is the graceful alternative). Deferred by explicit decision (2026-07-23 review): both concerns only become real when 2.2 lands locale switching and persistence — resolve the seam (e.g. explicit locale argument) and the throw-vs-fallback policy there.

## Deferred from: code review of 1-6-domain-a-extraction-metadata-lineups-formations (2026-07-23)

- **Minute-marker half-width split has an unstated chain-length ceiling** — `pipeline/extract/domain_a.py::_parse_lineups` assigns minute markers to a column by which side of the page midline their centre falls; a marker chain long enough to cross the midline would be handed to the opposite column, where it either fails loud with a mislocalizing message (wrong column, wrong cause) or — if the opposite column has a y-aligned player row — attaches silently to the wrong team's player. Nothing records the corpus's maximum observed chain length, so the margin is unquantified. Document the corpus maximum and add a midline-margin guard when next touching the parser.

- **`_parse_memo` retains the last open document for the process lifetime** — the one-slot parse memo in `pipeline/validate/checks.py` keeps a strong reference to the last `pymupdf.Document` after the gate finishes (deliberately, to keep `is`-identity safe), making the module stateful and non-reentrant, and replaying a stored exception re-raises the same instance with an accumulating traceback. Pre-existing Story 1.3 design; a runner-owned parse-result handoff (the runner already owns the doc lifecycle) would eliminate the memo globals entirely — and would give Domain A its memoization for free. Revisit alongside the Domain A memo added by the 1-6 review.

## Deferred from: implementation of 1-7-domains-b-c-extraction-key-statistics-tactical-identity (2026-07-23)

- **AD-14 note: the line-height/team-length pages are per-phase panels — contract `PossessionSplitMetres` wants ONE pair per possession state** — `contract/match-bundle.schema.json` `PossessionSplitMetres` (line ~460) models `lineHeight` + `teamLength` as a single value pair per possession state, but every corpus page prints THREE pitch panels per state (in possession: Build Up Low / Build Up Mid / Final Third Phase; out of possession: High Block / Press / Mid Block / Low Block) with three measures each. Story 1.7's drawings investigation resolved the three-per-panel semantics deterministically from the measurement-bracket geometry, verified on all 104 reports × 4 pages × 3 panels (3,744 values, 0 unclassifiable): a **horizontal** bracket spans the team block's x-extent → `team_width`; a **vertical** bracket whose extent reaches a pitch goal-line edge measures own-goal-line-to-block-edge → `line_height`; the remaining vertical bracket spans the block itself → `team_length` (every printed value matched its measured extent within 1.0 m at the 105 m × 68 m pitch scale; all 3,744 values are integers in (0, 105]). So the corpus is *richer* than the contract in two ways: per-phase resolution instead of per-state, and a third measure (`team_width`) the contract does not model. Staging stores the full raw shape (`line_height_team_length.{in_possession,out_of_possession}.{panel-key}.{line_height,team_length,team_width}`; the m001 fixture's single 44.4-type values are synthetic per `data/fixtures/README.md`, not page values). Story 1.16's emission must either aggregate per a defined rule (which panel — or which reduction — represents the state?) or change the contract shape to per-phase panels; either way it is a logged AD-14 decision with a `schemaVersion` bump (candidate to ride change-set CS-1's successor, NOT CS-1 — that set is already scoped). `/contract` stayed read-only for 1.7.

- ~~**Momentum series location (Story 1.8 scoping note, Task 9.3)**~~ — **RESOLVED by Story 1.8 (2026-07-27).** OQ-5 closed against all 104 reports: the series is the page-1 chart titled `Distribution in the Final Third` (present exactly once per report, 104/104), a per-minute per-team count of final-third distributions — not a possession percentage. Palette, baseline `y=429.13`, 0.70 width/pitch ratio, the auto-scaled 50.38 pt peak and the colour→team mapping all reproduced 104/104; the slot→minute mapping was derived from the printed ticks (first half `slot = minute−1` with zero violations; `HT` marks the first second-half slot). Parser at `pipeline/extract/momentum.py`, checks `momentum-axis-scale` / `momentum-coverage`, and the contract bumped to `schemaVersion` 2 with `MomentumSample.at: MinuteStamp`. The scoping note's counts (49/42 shapes) were an undercount of the reference report's real 50 home / 41 away bars plus decoration; see `pipeline/README.md`.

## Deferred from: code review of 1-7-domains-b-c-extraction-key-statistics-tactical-identity (2026-07-23)

- **B/C payload memos double the ledgered one-slot-memo debt, and non-`PipelineError` exceptions double-attribute across each completeness/counts pair** — `pipeline/validate/checks.py` `_domain_b_memo`/`_domain_c_memo` copy the `_parse_memo`/`_domain_a_memo` design verbatim (strong document reference held for process lifetime, stored-exception replay with accumulating traceback — see the 1-6 entry above), so the known debt now has four instances. The replay also means anything outside `PipelineError` (e.g. the deliberate `LookupError` for a lost registry spec) raises from BOTH the domain's completeness and counts checks and is recorded against two check ids — the "propagates once" guarantee holds only for `PipelineError` subclasses, in Domain A exactly as in B/C. Copied per the story's "copy the pattern, don't extend its cleverness" instruction; resolve all four memos together via the runner-owned parse-result handoff.

- ~~**Four verbatim copies of the `_check` dict helper define the Self-Validation check shape**~~ — **RESOLVED by Story 1.8 (2026-07-27).** Momentum would have been the fifth copy, which is the ledgered moment. The helper is now `pipeline.extract.check_entry`, beside `aggregate_self_validation` at the package seam for the same reason (it is the record-level seam every extractor's checks flow through, so importing it from a sibling domain would couple each new story to Domain A). All four domain modules now bind the local name to it (`_check = check_entry`) so every call site reads unchanged.

- **The gate builds a full-document `PageTextIndex` at least four times per report** — `_domain_anchor_pages` (checks.py) builds one per B/C uncached call, on top of the shots and Domain A builds, over identical document text; index construction is the documented dominant cost (~18×). A per-document index memo — or the runner-owned handoff above, which subsumes it — removes the rework. Extends the 1-6 runner-owned-handoff entry.

## Deferred from: code review of 2-2-site-chrome-header-language-theme-toggles-footer-404 (2026-07-23)

- **Home page body ignores the language toggle** — `app/src/app/page.tsx` (the disposable 2.1 scaffold page) renders via server-side `t()` and `formatDecimal(1.24, DEFAULT_LOCALE)`, so a visitor who toggles EN gets English chrome/about/404 but a Spanish hub body with es-formatted numbers. Not a 2.2 defect (2.2 owns only the shell; route content is 2.3/2.4 scope), but whichever story replaces the hub body must route its copy through `useT()`-backed client components or the mixed-language page ships to launch.

- **Client-import seam residual gaps** — the `no-restricted-imports` rule in `app/eslint.config.mjs` covers only `src/components/**`: a `"use client"` file colocated under `src/app/**` or added to `src/lib/**`, or a dynamic `import("@/lib/i18n")`, escapes the mechanical seam and would silently freeze in Spanish. Acknowledged and accepted in 2.2's Dev Agent Record (both story-owned client bodies live in `src/components/` as mitigation). Revisit if a future story introduces colocated client components — extend `files` or add an ImportExpression selector then.

- **Storage memory-fallback misses the asymmetric failure mode** — in `app/src/lib/storage.ts` (pre-existing 2.1 design, unchanged by 2.2) the memory fallback is consulted only when `getItem` *throws*; in quota-exceeded/legacy-private-mode environments where `setItem` throws but `getItem` works, `writeStorage` stashes to memory and `readStorage` then ignores it in favor of an authoritative `null` — the fallback provides no session continuity exactly where partial failure actually happens. Behavior degrades gracefully (preference simply doesn't stick), so fix only if a real environment surfaces it.

## Deferred from: implementation of 1-5-marker-event-linking-via-digit-glyph-proximity (2026-07-23)

- ~~**AD-14 contract change request: `ShotOutcomeDetail` is missing two corpus-real values** — the shots event table prints bare `Incomplete` (31 rows) and bare `On Target` (3 rows) across the 104-report corpus, neither of which is in the contract's 22-value closed enum (closed 2026-07-22). The pipeline maps them mechanically (`incomplete`, `on-target`, mirroring the enum's existing bare `off-target`) and stores them in staging records; `test_markers_attempts.py` documents them as `AD14_EXTRA_DETAILS`. Story 1.16's contract emission cannot ship these values until the enum (and `x-maps-to-outcome`: `incomplete`→`incomplete`, `on-target`→`on-target`) is extended via AD-14 — or a different resolution is decided at the Story 2.3 sign-off.~~ — **RESOLVED by Story 2.3 sign-off (2026-07-23): change request CR-1 filed**, exactly the mechanical extension described (enum + both `x-maps-to-outcome` entries + README provenance rows). Implementation batched into change-set CS-1 (see "Filed by Story 2.3 sign-off" below).

- ~~**AD-14 contract change request: `deflected-on-target-defensive-event` renders in BOTH marker colours** — of its 11 corpus rows, 10 sit under markers drawn in the *incomplete* colour and 1 (PMSR-M27-CAN-V-QAT, home ordinal 10) under an *on-target* marker, each with its ordinal label < 1 pt from the marker center (unambiguous joins). The contract's `x-maps-to-outcome` guesses `on-target` — one of the 13 pairings contract/README.md marks as AD-14 candidates "should real data contradict them"; the corpus contradicts it 10:1. The linking cross-check therefore accepts either colour for this one detail (`DETAIL_COMPATIBLE_OUTCOMES` in `pipeline/markers/attempts.py`); every other detail stays exact. The contract needs an AD-14 decision: remap to `incomplete`, keep `on-target`, or acknowledge the one-to-many rendering — the App's outcome-vs-detail consistency assumption is affected either way.~~ — **RESOLVED by Story 2.3 sign-off (2026-07-23): change request CR-2 filed** — acknowledge the one-to-many rendering: `x-maps-to-outcome["deflected-on-target-defensive-event"]` becomes `["incomplete", "on-target"]` (majority first), all other 21 mappings stay exact scalars, the outcome/detail pytest invariant relaxes to set-membership for array entries, and the App treats `outcome` as authoritative for marker encoding (never derived from `outcomeDetail`). Remap-to-`incomplete` rejected (the one genuine on-target row would fail emission); keep-`on-target` rejected (corpus-false 10:1). Implementation batched into CS-1 (below).

- **Minute/stoppage mapping (`time_raw` → contract `MinuteStamp`) is deferred to Story 1.16** — the attempts table's Time column prints first-half stoppage as plain cumulative minutes: ground truth's home rows run `…41, 41, 46, 48, 45, 47, 51…`, where 48 (= 45+3, first-half stoppage) *precedes* 45, so only row order reveals the period boundary. Records store `time_raw` verbatim plus `ordinal` (which preserves printed row order), giving 1.16 exactly the context period inference needs. Do not attempt the `{minute, stoppageMinute}` split without it.

- **Observed label→enum pairings beyond the fixtures' nine** — the Story 1.5 full-corpus run observed ALL 22 contract `ShotOutcomeDetail` values in print (plus the two bare AD-14 extras above), all 5 `BodyPart` labels, and all 10 `ShotDeliveryType` labels including the previously unobserved `Penalty` (22), `Interception` (12) and `Tackle` (4). Frequencies worth recording for contract/README.md's provenance table: rare outcomes `Deflected Off Target` (1), `On Target - Defensive Event` (1), `Off Target - Defensive Event` (1), `Deflected On Target - Goal Prevented` (1). The `Freekick`→`free-kick` special case is confirmed corpus-wide (146 rows); every other mapping is mechanical kebab-case.

- **Merged ordinal labels are resolved by interpretation, bounded by outcome compatibility** — when two markers overlap, their printed ordinal labels can merge into one extracted word (`"34"`, `"910"`, `"1011"`, `"1819"`; 10 reports affected). `pipeline/markers/linking.py` offers such words as their valid 1-2-digit partitions and resolves via a two-pass greedy assignment (whole words first, split parts as rescue) under the marker-radius threshold and outcome-compatibility constraints, with non-overlapping char intervals per word. A pathological pileup (3+ merged two-digit labels with identical outcomes) could still resolve by nearest-distance among equally-compatible interpretations; any unresolved marker stays `linked: false` and fails Self-Validation loudly. Current corpus: 2571/2571 markers linked (100%), so this is a robustness note for future tournaments, not a live gap.

## Deferred from: code review of 1-5-marker-event-linking-via-digit-glyph-proximity (2026-07-23)

- **`_domain_a_memo` holds a module-scope strong reference to the last open `pymupdf.Document` and caches arbitrary exceptions for identical re-raise** (`pipeline/validate/checks.py`, `_domain_a_payload`) — copies the pre-existing `_parse_memo` pattern, so precedent stands and the single-process batch pipeline is unaffected today; revisit if the gate runner ever goes concurrent or long-lived (doc lifetime + stale traceback re-raise). Landed inside the Story 1.5 commit as part of the 1.6 Domain A repair.

## Filed by Story 2.3 sign-off (2026-07-23)

Full evidence table and adjudications: `_bmad-output/implementation-artifacts/2-3-contract-v1-per-surface-sign-off.md`; durable gate record: `contract/README.md` → "Story 2.3 sign-off (v1)". Gate outcome: **SIGNED-OFF-WITH-CHANGE-REQUESTS** — Epic 1 extraction (1.7–1.15) unblocked; Story 1.16 blocked-pending CS-1.

- **Change-set CS-1 (scheduled; must land as ONE atomic AD-14 commit before Story 1.16 begins emission)** — contents: **CR-1** extend `ShotOutcomeDetail` with bare `incomplete` + `on-target` (with `x-maps-to-outcome` entries, README provenance rows, and the two locale label rows when 2.13/2.18 map detail codes); **CR-2** `x-maps-to-outcome["deflected-on-target-defensive-event"]` → `["incomplete", "on-target"]` (rejected alternatives, recorded 2026-07-23 review: remap-to-`incomplete` — the one genuine on-target row fails emission; keep-`on-target` — corpus-false 10:1; enum-split into two colour-specific values — keeps the map scalar but breaks the 1:1 corpus-label→detail identity and pushes marker colour into the value, rejected by decision); **plus riding**: the stale own-goal `$comment` correction at `match-bundle.schema.json` (`GoalOwnGoal` — Story 1.6 proved the corpus marks own goals; the 1.16 emission-flip entry above still applies) and the matching stale row in `contract/README.md`'s "deliberately empty" table (corrected in prose 2026-07-23; keep consistent when decision 17 lands). **Pipeline consumers (added by the 2026-07-23 code review — the original "nothing else consumes the changed values" claim was FALSE):** `pipeline/tests/test_markers_attempts.py:87-99` asserts the enum equals the label map minus exactly the two AD-14 extras and `DETAIL_TO_OUTCOME == {**contract_map, **AD14_EXTRA_DETAILS}` — CR-1 and CR-2 each break these; `pipeline/tests/test_fixtures.py` needs BOTH asserts of the outcome/detail test updated (the values-subset check at :693 `TypeError`s on an array value, not just the per-shot check at :696); `AD14_EXTRA_DETAILS`/`DETAIL_COMPATIBLE_OUTCOMES` in `pipeline/markers/attempts.py` must drop/absorb the now-in-contract extras. Recipe per AD-14: schema edits + pipeline constant/test updates above + logged decision 17 in `contract/README.md` + `version.json` 1 → 2 + hand-edited fixtures re-pinned to `schemaVersion: 2` + BOTH regenerated type outputs (`contract/generated/` via `npm run generate:types` in `contract/`, and `app/src/lib/contract/` via `npm run generate:types` in `app/`), proven in the same commit by the FULL `pipeline/tests` suite (not just the two contract/fixture files — the markers tests are consumers) + `npm run check:types`. **Coordination (restating Task 6.2's rule, dropped from the first filing):** a bump re-pins fixtures and regenerates app types, so CS-1 must not land while another story session is in flight against the current baseline (1-7 is in-progress as of 2026-07-23) — land after in-flight sessions commit, or with Juan's explicit go-ahead. **Epic-2 binding:** stories 2.7/2.13/2.18 build their label/legend/locale maps against the post-CS-1 24-value enum (or handle unknown detail values defensively) — do not hardcode the 22-value set. Solo-repo AD-14 note: 2.3 filed these wearing the Epic 2 hat; whoever lands CS-1 executes Epic 1's side and says so in logged decision 17.

- **Fixture request FR-1 (routed to Story 1.18's fixture work; fixture-only, NO `schemaVersion` bump — the AD-14 flow triggers on shape changes and fixtures validate against unchanged schemas)** — add coverage for the schema-guaranteed-but-unfixtured branches found by the 2.3 walk: `goalkeeping: null`, `players: null`, `events.*: null` beyond `shootoutAttempts`, an empty `[]` event array, `decidedBy: "extra-time"` (folds the existing 1.1 entry above), a zero-appearance player (folds the existing 1.1 entry above), `movementType: null` (0 of 270 receiving rows exercise it), any `CardRecord` (all three bundles carry zero cards), and `penalty: true`. Canonical serialization + green `test_fixtures.py` required. **Scope caveats (added by the 2026-07-23 code review — "validates against unchanged tests" is not achievable as written):** the zero-appearance-player branch fails the guard suite's non-empty assert (`test_fixtures.py:549` `assert fixture["matches"]` — the folded 1.1 entry above records this), so that guard must be consciously relaxed alongside; and a new `decidedBy: "extra-time"` match fixture is not a single-file edit — it cascades into `tournament.json` entities/results (reachability bijection), profile per-match rows, and leaderboards `matchesPlayed` consistency tests. FR-1 therefore includes the matching guard-test updates as part of its scope.

- **Rendering decision FD-1 (binds Stories 2.7/2.11; no contract change)** — per-shot xG does not exist in the source PDFs (team totals only), so shot markers render at uniform size and popovers/event logs omit the xG row while `ShotEvent.expectedGoals` is `null`; the nullable slot stays as the forward-compatible landing zone. Resolves the EXPERIENCE.md/DESIGN.md/epic-2.7 xG-sizing conflict.

## Filed by Story 1.11 implementation (crosses map parser, 2026-07-23)

- **AD-14 emission blocker: `CrossEvent` requires `playerId`/`playerName`/`at`/`deliveryType` per row — unfulfillable from the crosses page; resolve before Story 1.16 emits `events.crosses`** — the crosses section (single page per team, 208/208 corpus pages) prints a per-player delivery-AGGREGATE table (# / Player / six delivery-type counts / Total Attempted) and NO per-event rows, and its 7.4 pt markers carry no ordinal digit glyphs, so no marker↔row linking pass can exist (Story 1.11 Task 4.2 branch, probe-confirmed). Extraction stages what the page proves: per-event `team_id`/`x`/`y`/`completed` (+ `source`), `delivery_type: null`, and the full aggregate table verbatim under `domains.crosses.cross_table_rows` as raw material. Story 1.16 cannot emit contract-valid `CrossEvent` rows until an AD-14 decision relaxes the four required fields (nullable per-event, like `ShotEvent.expectedGoals`' precedent) or drops them from `CrossEvent`; surface for sprint planning before 1.16 (candidate to ride CS-1's successor change-set, NOT CS-1 — that set is already scoped). The fixtures' populated per-event `deliveryType`/`playerId` values are handcrafted samples, not extractable data.

- **AD-14 note: how `completed` is keyed — the cross RGB legend is real but documented nowhere in `/contract`** — the crosses page legend is "Attempted"/"Completed" with exactly two marker fills corpus-wide: orange `(0.96, 0.74, 0.0)` = attempted-not-completed, blue `(0.18, 0.3, 1.0)` = completed (verified: blue count == the page's printed Completed on 208/208 pages; the same two RGBs double as shots `off-target`/`incomplete` — palettes are per-family, keyed per FR-11). The contract models the outcome as `completed: boolean` only (no CrossOutcome enum, no `x-maps-to-cross-outcome`, no documented cross legend). Provenance lives in `pipeline/markers/crosses.py` (`CROSSES_RGB_TO_OUTCOME`) and `pipeline/README.md`; if contract-side provenance is wanted, it is a README-only addition (no schema shape change) for the next contract change-set.

- **AD-14 note: 16 corpus pages double-draw one cross event in BOTH marker colours at the bit-identical rect — decoded as one completed event** — 17 events across 16 pages render as an orange AND a blue 7.4 pt marker with dx=dy=0.000000 and rect-equality (blue always later in draw order, i.e. on top; the event also draws two overlapping trajectories). Marker-count reconciliation proves the pair is ONE event (with the collapse: markers == table Total sum == printed Attempted on 208/208 pages; without it: 16 pages off by +1/+2), and the blue-on-top rendering plus Completed-panel reconciliation prove it counts as completed. `pipeline/markers/crosses.py::_collapse_two_tone` collapses exactly the attempted+completed bit-identical pair — real same-spot pairs (which always differ ≥0.035 pt or share a colour in the corpus, e.g. M50/M82/M45/M08) are never deduped, preserving the AD-8 no-dedup invariant for distinct markers. Same rendering family as CR-2's `deflected-on-target-defensive-event` both-colours discovery on shots; presumably a deflected-but-completed cross. If a future report draws a same-colour bit-identical pair or a triple, the collapse deliberately keeps all of them and the count check fails loud.

## Deferred from: code review of 2-4-match-route-hero-layer (2026-07-24)

- **The "two DATA_ROOT cutover points MUST flip together" contract has no enforcement** — `app/src/lib/build-data.ts:13-17` documents that its `DATA_ROOT` (`../data/fixtures`, a filesystem path) and `DATA_ROOT` in `app/src/lib/data.ts:7` (`/data/fixtures`, a URL prefix) are the two Story 2.19 fixtures→`/data` flip points and must flip together, then relies entirely on a future developer reading the comment. Nothing derives one from the other and no test asserts they agree. The failure mode it names is real and silent: the build-time and runtime views of the same match diverge, so the Hero renders fixture data while the below-Hero region fetches real data (or 404s). A one-line test comparing the trailing path segments would close it. Deferred: the flip itself is Story 2.19's scope and the guard belongs with it.

- **The eslint `build-data` import bar does not cover `"use client"` files outside `src/components/**`** — `app/eslint.config.mjs:68` scopes the `no-restricted-imports` seam to `files: ["src/components/**/*.{ts,tsx}"]`, and the new gate fixture at `app/src/lib/eslint-gate.test.ts:90-96` asserts `src/app/**` is *deliberately* exempt (server pages legitimately read data). But `src/app/**` can host `"use client"` files, as can `src/lib/**` (`i18n-provider.tsx:1`), and such a file importing `@/lib/build-data` passes lint then fails at bundle time with `node:fs` in the browser — precisely what the rule exists to prevent. Mitigated today by the naming convention that client route bodies live in `src/components/` (Project Structure Notes). Deferred: tightening this means either a directive-aware rule or restructuring the seam, which touches the Story 2.2 i18n seam it mirrors — larger than this story.

- **Substring HTML assertions assume escape-free artifact text** — `app/src/app/matches/static-output.test.ts:61,79-80,105` compare raw JSX values against the exported HTML (`toContain(expectedTitle)`, `toContain("Julian QUINONES 8′")`). React escapes `&`, `<`, `>` and `'`, so a team or player name like `Côte d'Ivoire` ships as `Côte d&#x27;Ivoire` and the assertion fails for a reason unrelated to what it guards. Passes today only because all three fixtures happen to be escape-free. Deferred: surfaces at the Story 2.19 real-data cutover, where the fix (escape the expectation, or parse rather than substring-match) should land alongside the other real-data test adjustments.

- **Empty `starters`/`substitutes` render bare headings with no empty state** — `app/src/components/LineupsDisclosure.tsx:61-74` maps both arrays unconditionally, so `starters: []` produces the "Titulares" label followed by an empty `<ul>`, indistinguishable from a rendering bug. `Lineup.starters`/`substitutes` are plain arrays in `contract/match-bundle.schema.json` with no `minItems` constraint. Deferred: no fixture exercises it, and the empty-state pattern for below-Hero regions is Story 2.5's scope — the Hero's version should match whatever 2.5 rules.

## Deferred decisions from: code review of 2-4-match-route-hero-layer (2026-07-24)

Seven open decisions surfaced by the review and deferred at Juan's call, reason: _"We'll walk to it later. For now, I need to deliver this ASAP."_ Each needs a human ruling before it can be patched; none blocks another. Full detail and evidence in the story's `### Review Findings` section.

- **Live region re-announces "Datos cargados." on every language toggle** (`app/src/components/MatchBundleRegion.tsx`) — Task 6.3 pins "once per resolution", but the announcement text is rendered from `t()` inside a persistent live region, so an ES→EN toggle re-fires a polite announcement even though nothing re-loaded (on top of `LocaleProvider`'s own language announcement). The component comment calls this intentional for Task 9.3, which only requires the announcement's *language* to swap. Rule: keep, or gate the announcement to one firing per fetch resolution.

- **`<title>`/OG description stay Spanish after an EN toggle** (`app/src/app/matches/[slug]/page.tsx`) — `generateMetadata` uses server `t()` at `DEFAULT_LOCALE`; nothing updates `document.title` on locale change and no `alternates`/`hreflang` is emitted, so the tab and shared-link preview stay Spanish while the body swaps to English. The `en.match.meta.separator`/`penShort` entries this story added are unreachable as a result. Task 9.3's goal was disproving the mixed-language failure mode — this relocates it to the chrome. Rule: accept (ES canonical for a static export), sync `document.title` client-side, or route to 2.19.

- **No-JS / failed-JS visitors are stranded on a permanently pulsing skeleton** (`app/src/components/MatchBundleRegion.tsx`) — the SSG pass bakes `status: "loading"` into the exported HTML (verified: one `aria-busy="true"` container, five `skeleton` blocks, zero `<noscript>`), with no timeout and no fallback. UX-DR14 bans spinner-only states; this is one that never resolves. Rule: `<noscript>` fallback, a fetch timeout falling into the retry panel, or accept JS as a hard requirement.

- **The fetched Match Bundle is parsed and discarded, and "loaded" is asserted from HTTP status alone** (`app/src/components/MatchBundleRegion.tsx`) — `.then(() => setStatus("loaded"))` never inspects the ~160–200 KB payload: no `matchId` match, no `schemaVersion` check, so a stale or redirected 200 announces success. Discarding is spec-shaped for 2.4 (Story 2.5 owns consumption), but the missing validation is independent of that. Rule: accept, or add minimal payload validation now.

- **Unrendered `lineups` sub-fields serialize into every match page** (`app/src/lib/match-hero.ts`, `toHeroData`) — passing the raw `m.lineups` into a client component inlines it into the RSC flight payload: 52 occurrences each of `cards`, `substitutedOn`, `substitutedOff`, none of which is rendered anywhere. Page is ~51.7 KB against 14.1 KB for `404.html`. Task 3.1 names `lineups` in the props subset so this is spec-literal, but it sits in tension with AR-11's "no inlining full bundles" intent. Rule: accept, or project `lineups` down to the rendered fields (playerId/name/shirtNumber/position + formation).

- **The Hero's only *visible* section title is not a heading** (`app/src/components/LineupsDisclosure.tsx`) — ruled decision 5 says "visible sections keep h2", but "Alineaciones y formaciones" renders as a `<span>` inside the toggle button while the per-team `<h2>`s sit inside the collapsed region, so the exported document's only `h2`s are invisible until expansion. Rule: promote the disclosure title to `h2`, demote the team names, or accept.

- **Task 9.2 is marked `[x]` with no recorded evidence** — the Debug Log covers Task 9.1 (build + static-server) and 9.3 (ES→EN, theme), but records nothing about the 390px fold order, zero horizontal scrolling, or the 200%-zoom check. That is AC 2's measurable clause and EXPERIENCE.md's reflow floor, so AC 2 is currently unverified on its most user-visible dimension. Rule: confirm it was performed and record the evidence, or re-run the 390px/200% check before the story closes.

## Filed by Story 1.12 implementation (defensive-actions map parser, 2026-07-24)

- **RULED (code review, 2026-07-25): ACCEPTED — two corpus pages draw one forced-turnover marker fewer than their own printed total, so the batch run reports FAIL (exit 1) on a clean corpus, and that is the intended signal.** — `PMSR-M19-ARG-V-ALG` (away: 39 markers drawn, headline prints 40) and `PMSR-M58-TUN-V-NED` (away: 33 drawn, 34 printed). Verified not to be a parse defect: both pages were rendered and the dots counted by hand (39 and 33), every marker-sized circle on each page is accounted for (left panel + right panel + exactly the 7 bullet swatches), no marker sits outside the panels, there are no exactly-coincident pairs at threshold 0.0, and no drawing-anatomy variant hides a 40th marker (the only other marker-sized circles are the four stroke-only corner arcs per panel). The remaining 206 of 208 pages agree exactly. Per SM-C1/AD-8 the check is exact and binary and was NOT loosened, so those two records write with `self_validation: "fail"`, land in the manifest with both counts, and the run result is FAIL (`failed_count` stays 0). **Consequence: every `pipeline.ingest.batch` run over the full corpus now exits 1 until this is ruled on.** The FR-15 gate is unaffected in practice (neither report falls in the 16-report venue × matchday sample; PASS, 0 deviations — though a sample containing M19 does emit the `count-mismatch` deviation, verified directly). Options for the ruling: accept the standing FAIL as the honest signal; add a corpus-level known-discrepancy waiver mechanism (none exists today, and deviation categories are frozen at 4); or drop the forced-turnover counterpart entirely and take the documented-absence branch for both families, losing a check that holds on 206/208 pages. **Ruling: accept the standing FAIL.** The check is exact and binary by SM-C1/AD-8, the two failures are real source defects rather than parse defects, and loosening the check to buy a green exit code would trade a true signal for a comfortable one. **Consequence every later story must plan around: `python -m pipeline.ingest.batch` over the full corpus exits 1 by design from Story 1.12 onward. The clean-run baseline is `extracted 104 / failed 0 / self-validation-failed 2`, and those two reports are `PMSR-M19-ARG-V-ALG` and `PMSR-M58-TUN-V-NED`.** A verification step that asserts "the batch exits 0" is now wrong and must assert the baseline instead; `failed_count` stays 0 and the FR-15 gate is unaffected. Re-open this entry only if a THIRD report joins the set, which would mean the discrepancy is systematic rather than two defective pages.

- **AD-14 emission blocker: `DefensiveActionEvent` requires `playerId`/`playerName`/`at`/`contestType` per row — unfulfillable from the defensive-actions page; resolve before Story 1.16 emits `events.defensiveActions`** — the same shape as the `CrossEvent` blocker filed by Story 1.11. The page prints no per-event rows and no ordinal digit glyphs inside either panel (0 on 208/208 pages), so no marker↔row linking pass can exist; the only per-player table on the page (`# / Player / Total Possession Regains`) is an aggregate and, as recorded below, counts something the map does not plot. Extraction stages what the page proves: per-event `team_id`/`action_type`/`x`/`y` (+ `source`) and `contest_type: null`. Candidate to ride CS-1's *successor* change-set, never CS-1.

- **AD-14 note: only two of four `DefensiveActionType` values have any spatial representation** — the page's two pitch maps are `Forced Turnovers` and `Possession Regain`; `Blocks` and `Possession Contests` are aggregate panels (a total plus a pie legend) with no coordinates anywhere in the corpus. `events.defensiveActions` can therefore only ever carry `forced-turnover` and `possession-regain` rows. The App's `#defensive-actions` surface (Story 2.9) should be built knowing the other two codes are unpopulatable from this source, and `PossessionContestType` has no extractable per-event carrier at all. Contract shape unchanged; a README provenance row would record it.

- **AD-14 note: the defensive-actions palette is degenerate (one fill, no colour-encoded dimension) and the family is typed by panel title** — all 20,169 corpus markers share `(0.18, 0.3, 1.0)`, the same blue the shots palette calls `incomplete` and the crosses palette calls `completed`. This is the first family where RGB is not the discriminator: `action_type` comes from the panel's printed title through the frozen `DEFENSIVE_ACTION_LABEL_TO_ENUM`, and `key_outcomes` is retained purely as the FR-11 assert-on-unknown seam. `/contract` documents no legend for this page. README-only provenance if wanted; no schema shape change.

- **Open question for whoever builds the possession-regain surface: what the right-hand panel actually plots is unknown** — its marker count matches NO number printed on the page: not `Possession Regained`, not the per-player `Total Possession Regains` sum (which equal each other exactly on 208/208 pages), not Interceptions, Tackles, Blocks, Possession Contests or Most Possession Regains, and no ±1-coefficient linear combination of all of them reaches even 150/208 (exhaustive search). The difference from the printed total ranges −3..+36 and is negative on 2 pages, ruling out a strict superset. Near-coincidence was ruled out too: single-link clustering at 0.0/0.5/1.0/2.0/3.0/5.0/8.0 pt reconciles the count on at most 16/208 pages, and destroys the left panel's own 206/208 agreement in the process. Each panel's markers form ONE contiguous drawing block, so a second interleaved marker family is ruled out as well. Story 1.12 therefore takes AC 2's documented-absence branch (`counts[...]["table"] = null`, no check, one per-report warning) rather than substituting a different family's number. If a vendor data dictionary ever becomes available, this is the question to ask it.

- **The documented-absence warning fires on every report, so the batch summary prints 104 identical warning lines** — `format_summary`'s "Warnings (non-fatal)" block lists one line per report, and the possession-regain absence is a property of the page family rather than of any one report, so at 104-report scale the block is 104 copies of the same sentence. Readable but noisy, and it dilutes genuinely per-report warnings. The shape is what Story 1.12 Task 5.2 specifies (one warning per report, mirrored into the manifest entry), so it was implemented as specified; a summary-level de-duplication ("104 reports: <warning>") would fix the console without changing the manifest. Deferred: touches `format_summary`'s shared rendering, which several stories' checks depend on.

## Filed by Story 1.10 implementation (Domain G per-player extraction, 2026-07-24)

- ~~**Scoping note (not a contract gap): `PlayerRecord.playerId` is unfulfillable at extract time**~~ — the contract requires a `playerId` per player record, but the four Domain G page families print only a shirt number and a name, and identity that is stable *across* matches is Story 1.15's resolution (the normalized spine). Staging therefore deliberately carries `name` + `shirt_number` and joins on within-report name identity only — verbatim, never normalized, folded, fuzzy-matched, or fallen back to the shirt number (AD-8). Recorded so Story 1.16's emission does not read the absent `playerId` as an extractor omission: it is a sequencing fact, and 1.15 is where it is filled. No schema change is wanted. — **RESOLVED by Story 1.15 (2026-08-03): the cross-match namespace exists and every Domain G row now carries a resolved id.** `pipeline/precompute/identity.py` mints one `PlayerId` per `(team_id, shirt_number)` across the whole corpus — 1,248 players, 0 collisions, all pinned in the committed `pipeline/precompute/slug_registry.py` — and `pipeline/precompute/spine.py` adds a `player_id` beside every one of the 73,065 player-name occurrences at all 25 name paths, including `domains.player_stats.{home,away}[].name` (3,289 rows, the Domain G family this note was filed against). The extract layer is **unchanged and stays unchanged**: it still stages `name` + `shirt_number` and still joins verbatim within the report, exactly as this note specifies. Resolution is additive and lives in the second phase, which is what makes the sequencing fact a sequencing fact rather than a defect. No schema change was made or wanted.

- **AD-14 note (no shape change needed): `PlayerPhysical.highSpeedRuns` / `sprints` are contracted as `Count` (integer) while the page prints them with a `.0` decimal** — `Physical Data {team}` prints `18.0` / `3.0`, not `18` / `3`. All 3,289 corpus rows are nonetheless integral (0 exceptions), so the contract's integer type is correct and no bump is required. The parse rule is recorded here so Story 1.16 does not re-litigate it: `domain_g.py` parses those two columns as float, **asserts integral**, and narrows to `int`; a genuinely fractional value raises `MalformedFieldError` naming the field and the raw text rather than rounding (AD-8 — rounding would silently invent a count). The same page's other seven columns are genuine 1-decimal floats and stay floats.

- **The committed `m001` fixture's `physical.totalDistance` is not the printed value — 30 of 31 players disagree** (found while building the Task 7.4 ground-truth cross-check). `data/fixtures/README.md` records all of Domain G physical as REAL, hand-transcribed from `Physical Data {team}`, and eight of the nine fields bear that out: `distanceZone1..5`, `highSpeedRuns`, `sprints` and `topSpeed` match the parsed page **exactly on all 31 players**. `totalDistance` does not: it is whole-metre valued in the fixture on 30 of 31 players (e.g. Raul RANGEL `5476.0` vs the printed `5476.4`; Khuliso MUDAU `9341.0` vs `9336.7`), deltas run −4.3..+1.2 m, and the fixture's own value does not reconstruct from its own zones either (RANGEL's zones sum to 5476.3). So that one field was synthesized or re-derived rather than transcribed, while its siblings were not. Every *parsed* total does reconcile with its own printed zones on all 3,289 corpus rows (worst drift 0.200 m), so this is a fixture-data finding, not a parser or contract one. `pipeline/tests/test_extract_report_domain_g.py` asserts the eight transcribed fields exactly and pins the `totalDistance` divergence in a separate named test, so the discrepancy cannot silently become a parser regression and the pin fails loudly if a fixture refresh corrects it. Fixtures-only corrections carry Story 2.3's explicit no-bump carve-out; `/contract` is untouched.

## Filed by Story 2.5 implementation (Tactical Layer shell + Key Statistics, 2026-07-24)

- **The Match Dashboard reflows cleanly to 320 CSS px but not to 195 CSS px (a 390 px device at 200 % zoom)** — Task 10.2 asks for zero horizontal scrolling at 390 px "and again at 200 % zoom". Measured on the exported build: at **390 px** and at **320 px** (the WCAG 1.4.10 reflow threshold) `body.scrollWidth` equals the viewport exactly and **0** elements overflow. At **195 px**, 32 elements overflow, owned by three different stories: the `SiteHeader` toggles (2.2), the Hero score row (2.4) and this story's `#key-stats` paired tiles. A tile's min-content width is **247 px** — the two fixed 76 px value tracks plus `px-4` plus the label — so it cannot fit 195 px without dropping below the DESIGN type ramp (`type-stat-value` is 26 px and its min-content width alone is ~70 px per side), and the mockups pin the 76/120 px tracks. Deferred rather than patched here: the condition is page-wide and pre-existing, WCAG's own bar (320 px) passes, and a fix that only narrowed `#key-stats` would leave the header and Hero overflowing at the same width. **Owner: Story 2.19** (performance/accessibility hardening) — decide there whether the product commits to reflow below 320 CSS px, and if so, treat header + Hero + stat tiles as one change.

- **`LineupsDisclosure`'s empty-`starters` gap (filed by the 2.4 review, explicitly waiting on this story's ruling) is still open** — this story ruled the *layer-level* absence pattern: a section whose data slice is `null` renders `EmptyStatePanel` and never collapses (ruled decision 10), and a section whose data is present but whose view has not shipped renders the distinct `PendingSectionPanel` (ruled decision 9). Neither branch reaches the Hero: `lineups` is a required, non-nullable object, so an empty `starters` array is the `[]`-means-present case, which by this story's own `null`-vs-`[]` rule belongs to the owning component's zero-content view, not to the empty-state panel. Recorded so 2.4's item is unblocked with a rule rather than left waiting: whoever picks it up should render a zero-content line inside the disclosure, not an `EmptyStatePanel`.

## Deferred from: code review of 1-12-defensive-actions-map-parser (2026-07-25)

- **The regains-row region is unbounded to the right and below the header** — `pipeline/markers/defensive_actions.py:463-477` admits every `table_lines` cluster below `header_y + 12` whose leftmost cell at `x >= table_x_min` is ASCII digits, then takes `region[-1]` as the Total Possession Regains value. There is no right-hand x-bound and no lower y-bound, so any word printed at a row's y ±3 pt to the right of the Total column becomes `region[-1]`: a digit there is **silently staged** as `total_possession_regains`, a non-digit raises `DefensiveActionsTableError` naming the wrong cell, and a stray digit below the header (a footer number, a footnote marker) aborts the whole report rather than skipping a row. Unlike `crosses.py:332`, which cross-checks `Total Attempted` against its six-column sum, this single-numeric-column table has zero internal redundancy — a mis-picked cell is staged verbatim and validated by nothing (the rows are staged, not checked, `:451`). Deferred: the pattern is inherited from `crosses.py::_cross_table_rows` and no corpus page triggers it (16 rows parse correctly on the ground-truth page, all with exactly 4 region cells); bounding the region belongs with the shared table helper rather than in one family's copy.

- **Inter-panel gutter: the two margin-expanded panel zones are never asserted disjoint, and a marker outside both never reaches the assert-on-unknown seam** — `pipeline/markers/defensive_actions.py:214-219` runs `collect_candidate_markers` once per panel over the same full-page drawings list, and `filter_chain.py:153-158` expands each panel by `pitch_margin_pt = 0.5` on every side. Two consequences, neither guarded: (a) if the panels ever sit within 1.0 pt of each other on the shared axis, a marker centre in the gutter satisfies `zone.contains` for both and one drawn marker becomes two events with different `action_type` — the forced-turnover count check would fail loudly but the possession-regain inflation is invisible, since that family emits no check; (b) a size-window marker whose centre falls outside *both* expanded rects is dropped before `key_outcomes`, so neither `UnknownRgbError` (FR-11) nor any count observes it — the module docstring's claim that `key_outcomes` is "the assert-on-unknown seam" holds only for in-panel geometry. Deferred: the corpus panels sit 36 pt apart against a 0.5 pt margin (72× the required clearance) and the fixture panels 60 pt apart, so neither is reachable today; facet (b) is a property of the shared chain for every family, not of this parser, and belongs with the filter-chain robustness advisory above.

## Filed by Story 1.13 implementation (offers & movement to receive parsers, 2026-07-26)

- **AD-14 emission blocker (headline): `ReceivingEvent` is unfulfillable in EVERY required field — the corpus carries no per-event receiving data of any kind. `events.receiving` can only be emitted as `null`.** `contract/match-bundle.schema.json:673-710` requires `teamId, playerId, playerName, type, movementType, at, x, y` **per event**. Re-measured over all 104 reports / **416 receiving pages** (Story 1.13 Task 1, re-derived independently of the story-creation probe and reproduced cell-for-cell by the shipped parser): there is **no marker, no coordinate, no per-event row and no ordinal glyph anywhere in the family**. `Offering to Receive {team}` draws exactly 11 filled 8.229 pt circles per panel whose positions relative to their own panel are **byte-identical between the two panels on 208/208 pages and identical across every team page** — a static formation template carrying zero per-report information, staged nowhere; `Movement to Receive {team}`'s single pitch panel holds **zero** markers (it is a three-thirds bar chart). This is strictly harder than the `CrossEvent` blocker Story 1.11 filed, which at least yields real coordinates for `x`/`y`. **Consequences, each of which needs an owner:** (1) **Story 1.16 can only emit `events.receiving: null`** — it must not synthesize rows from the 11 decoration dots, and must not borrow Domain G's per-player Offers & Receptions rows and call them events (they are per-player aggregates for the whole match, with no `at`, no coordinates and no per-event identity). (2) **Story 2.9** (`#offers-to-receive` / `#movement-to-receive`) has **no event data to render** and must be re-scoped against the aggregates this story stages (below) — a map surface is not buildable from this source. (3) **The Story 2.3 sign-off row for offers/movement-to-receive is stale**: it recorded PASS-with-note over an unfixtured `movementType: null` branch (`contract/README.md:474`), having walked the contract without knowing the source cannot fill the shape *at all*; that row is superseded by this entry. Candidate to ride CS-1's **successor** change-set, never CS-1 (already scoped). `/contract` was not edited by this story.

- **AD-14 shape note: the corpus is RICHER than the contract in a different dimension, and none of it has a contracted destination** — what the two pages actually print, all of it now staged verbatim under `domains.receiving`: per-team **`total_offers_made` / `total_offers_received`** (a made/received split the contract does not model), **per-third offers** (final/middle/defensive), **per-shape offers** (inside/outside the team's shape — two in-panel badges), a **Most Offers** block (value / player / position), a **per-player made/received/% table** (13-17 rows), plus on the movement side **four donut centre totals**, a **15-cell pitch-third × movement-type grid** and a **Top Ranked Players** table (one row per movement type). Named here as the candidate input for whatever replaces `ReceivingEvent`: a per-team aggregate shape would be fully populatable from this source today, whereas the per-event shape can never be. Note also that **no contract enum covers pitch thirds** — `pipeline/markers/receiving.py::PITCH_THIRD_LABEL_TO_ENUM` mints `final-third` / `middle-third` / `defensive-third` as this pipeline's own codes (`final-third` does exist inside `InPossessionPhase`, but that is a phase, not a pitch region).

- **AD-14 vocabulary note: `OfferMovementType` has six values; the movement map prints exactly FIVE** — `In Front`, `In Between`, `Out to In`, `In to Out`, `In Behind`. The contract's sixth value, **`no-movement`, appears nowhere on this page** and exists only per-player, on Domain G's `In Possession - Offers & Receptions` page. This is not an inference: reconciliation #8 measured the grid's per-type totals against Domain G's per-player sums on **208/208 pages** and the grid equals the **five-type** sum exactly and the six-type sum never — which is what *identifies* what the movement page counts. `MOVEMENT_LABEL_TO_ENUM` therefore deliberately omits `no-movement`, and a test asserts the omission rather than merely not mentioning it. Whoever builds a movement surface must not "complete" the map to six values.

- **AD-14 non-partition note: the three per-phase movement totals are INDEPENDENT totals, not slices — never sum them** — `(final_third + progression + build_up) − total_movements` ranges **−48..+314** across the corpus and is zero on only **3 of 208** pages (re-measured; identical to the creation-time figure). They are staged verbatim under `by_phase` and take AC 2's documented-absence branch: **no check sums them**, and the absence travels as one per-report warning. Same family as the `InPossessionPhase` `$comment`'s "these are independent rates, never normalize, never pie" warning (`common.schema.json:219`) and the exact trap Story 1.7's AC 2 hit with "block sum ~100%". Whichever surface renders them must not present them as a whole.

- **AD-14 raster note: the donut slice values are unextractable — only the four centre totals are text** — the three phase donuts and the All-Movement-Types donut are **raster images** (13-21 images per page), and exactly one text word is recoverable per donut region on 208/208 pages: its centre total. There is therefore **no independently printed per-type total** to check the grid against, which is why that reconciliation takes AC 2's documented-absence branch too. Any surface wanting the per-type split must take it from the **15-cell grid**, which reconciles exactly (grid sum == the All-Movement centre total on 208/208, and the per-type totals == Domain G's five-type sums on 208/208).

- **The two receiving absence warnings fire on every report, so the batch summary now prints 208 more warning lines** — the same shape (and the same cause) as the Story 1.12 entry above: `format_summary`'s "Warnings (non-fatal)" block lists one line per report, and both receiving absences are properties of the page family rather than of any one report, so at 104-report scale they add 208 copies of two sentences on top of 1.12's 104. Implemented as Task 3.3 specifies (one warning per report, mirrored into the manifest entry); the summary-level de-duplication proposed in the 1.12 entry ("104 reports: <warning>") would now fix three warnings at once and is worth more than it was. Still deferred for the same reason: it touches `format_summary`'s shared rendering.

- **Filter-chain robustness advisory (`deferred-work.md` Story 1.3 entry) — CLOSED by Story 1.13, its last named story. See that entry's closing paragraph.**

## Deferred from: code review of 2-5-tactical-layer-shell-key-statistics-empty-state-pattern (2026-07-26)

- **Task 10.2's 200 %-zoom clause fails at 195 CSS px, but the subtask is checked `[x]`** — the condition itself is already filed above (Story 2.5 implementation, owner 2.19) and honestly disclosed in the Debug Log, so this entry is only about the bookkeeping: a `[x]` on a subtask whose second clause demonstrably fails reads as passing to anyone skimming the story. `#key-stats` is one of the three named owners and the only one this story authored (`KeyStatisticsSection.tsx:93`, `grid-cols-[76px_1fr_76px]` → 247 px min-content). Annotate the checkbox rather than re-patch the condition.

- **Crossing a breakpoint unmounts a focused content region and drops focus to `<body>`** — at `≥lg` every section is open and its content region is a real focus target; shrinking below `lg` (a rotate, a split-screen, a zoom step) recomputes `open` to `false` for every section the user never explicitly toggled (`TacticalLayer.tsx:150`, `overrides[id] ?? false`) and the lazily-mounted `<div role="region">` unmounts with focus inside it. `toggle()` restores focus only on an explicit open; there is no handler for the implicit media-query collapse. The same shape appears at the `md` boundary in Key Statistics (`KeyStatisticsSection.tsx:199-200`): the "Ver todas las estadísticas" button unmounts with focus on it, and `showAll` silently stays `true` for the return trip. Deferred because the fix needs a ruling this story does not have — whether a viewport-driven collapse should preserve the user's expansion, move focus to the nearest surviving ancestor, or do nothing.

- **Hash re-entry has three unhandled paths** — `TacticalLayer.tsx:58-72` reads the hash once on mount and then subscribes to `hashchange`. (a) Re-activating the *same* fragment never re-fires: browsers do not emit `hashchange` when the hash is unchanged, so a user who manually collapses `#shot-maps` and then clicks any link resolving to `#shot-maps` gets nothing — only a full reload recovers it. (b) A post-retry remount re-consumes the hash: `TacticalLayer` is conditionally mounted, so a successful retry is a fresh mount, and `openFromHash` re-reads the still-present hash and calls `scrollIntoView()` + `focus()` with no record that this hash was already honoured — yanking a user who had scrolled through the error panel. (c) Navigating *backward* out of a section fires `hashchange` too, and the handler unconditionally bumps the focus nonce, so Back pulls the user into the section they were leaving. Deferred: all three want one consumed-hash/popstate-direction policy, not three point fixes.

- **The loading skeleton and the error retry panel now stretch the full 1152 px container** — Task 6.3 widened the route container `max-w-2xl` → `max-w-6xl` and re-wrapped only `MatchHero` in `mx-auto w-full max-w-2xl` (`matches/[slug]/page.tsx:67-73`). The two transient states that also live in that container were not re-considered: `MatchBundleRegion`'s `skeleton h-11 w-full` bars and the destructive-bordered retry panel now span the dashboard width on desktop. Arguably correct — the Tactical Layer they stand in for is itself full-width at `≥md` — so deferred as a deliberate look-at rather than a defect.

- ~~**`events.crosses` is nullable and now ingested, but no section's data-state predicate reads it**~~ — **RESOLVED by Story 2.7** (pitch-panel infrastructure with shot & cross maps). Ruled: the cross map is a SECOND PANEL inside `#shot-maps`, so the eleven-section normative order stands and no twelfth anchor is added (ruled decision 1); and `sectionDataState(bundle, "shot-maps")` now reads BOTH tables — the section is `empty` only when `events.shots` AND `events.crosses` are both `null` (ruled decision 2, `app/src/lib/tactical-sections.ts`). When exactly one table is missing the section stays `ready` and the missing panel names its own absence with an `EmptyStatePanel` in its own panel slot, so a crosses-less report reads “Sin datos de Mapa de centros para este partido.” while the shot map renders normally. A whole-section empty state over a report that carries crosses but no shots would hide present data — the FR-22 failure mode inverted. The four-way truth table is pinned in `app/src/lib/tactical-sections.test.ts`, and 2.5's `shots = null → "empty"` assertion was replaced by it.

## Deferred from: code review of 1-10-domain-g-extraction-per-player-performance-physical-data (2026-07-26)

- **`domain-g-goals-reconciliation` is a near-verbatim second copy of Domain A's own-goal reconciliation** — `pipeline/extract/domain_g.py:663-680` versus `pipeline/extract/domain_a.py:757-783`: the same loop over `(("home","away"),("away","home"))`, the same `scored`/`benefit`/`expected`/`goal_notes` names, and the same `len(entry["own_goals"])` summation over `lineups[other]`. Domain A has already computed the identical `benefit` term for the same report, and neither block references the other, so a future correction to the own-goal rule (the rule Story 1.6 established, and whose 14-instance corpus justification the Domain G README section re-derives from scratch) must be found and made twice. Deferred rather than patched: the fix is a shared helper, and every placement for it — `pipeline/extract/__init__.py` beside `aggregate_self_validation`, or `domain_a.py` itself — touches a module Story 1.10's Project Structure Notes list as DO NOT TOUCH. It belongs to whoever next has a legitimate reason to open Domain A, or to a small dedicated tidy.

- **The Domain G fixture's percent-column positions are an unlinked second copy of the parser's `_PERCENT` kinds, and the family-stem list now lives in four places** — `pipeline/tests/conftest.py:402` hardcodes `DISTRIBUTIONS_PERCENT_INDEXES = (2, 8)` while the truth lives in `DISTRIBUTIONS_COLUMNS` (`pipeline/extract/domain_g.py:88-103`); conftest imports nothing from `domain_g`. Inserting or reordering a distributions column shifts the parser's percent positions and not the fixture's, so the drawer prints `%` on a count column and the suite fails with an unrelated `MalformedFieldError` pointing nowhere near the edit. The same drift class covers the four family stems: `domain_g.FAMILIES`, `checks._DOMAIN_G_ANCHOR_IDS` (`pipeline/validate/checks.py:928`, correctly derived), the eight-literal anchor branch at `conftest.py:1514-1523` plus `DOMAIN_G_DRAWERS`, and `test_extract_domain_g.py:45` — one of four is derived. Deferred: whether the synthesis fixtures may import from the module under test is a test-architecture ruling (a fixture that derives its layout from the parser can no longer independently falsify it), and it applies to every domain's conftest helpers, not just Domain G's.

- **`goals <= attempts_at_goal` is corpus-FALSE, and the page's "Attempts at Goal" column has an unresolved definition** — raised as a code-review patch (it is the only relation that would corroborate the two right-most Distributions columns, exactly where a left-to-right ordinal slip is otherwise invisible), implemented, then **withdrawn on corpus evidence** before shipping. Swept over all 104 reports, 4 violate it: `PMSR-M11-NED-V-JPN` away #15 Daichi KAMADA (1 goal / 0 attempts), `PMSR-M36-TUN-V-JPN` away #15 Daichi KAMADA (1 / 0), `PMSR-M29-BRA-V-HAI` home #9 MATHEUS CUNHA (2 / 1), `PMSR-M59-TUR-V-USA` home #21 Baris Alper YILMAZ (1 / 0). Every one of those goals is independently confirmed by Domain A's own scorer ledger (Kamada 89', Cunha 23' and 36', Yilmaz 31'), so the goals column is right and the relation's premise is wrong: the page's `Attempts at Goal` is evidently narrower than "shots, including the one that went in" — a penalty, a deflection or a set-piece exclusion would all explain it, and the report prints no legend. Shipping the check would have flooded the gate with 4 false `count-mismatch` deviations, the same inversion the naive goals reconciliation would have caused on 14 team-innings. Deferred rather than dropped: the two columns still have no cross-check of any kind, so an ordinal slip between `take_ons` / `attempts_at_goal` / `goals` remains invisible to Self-Validation. Resolving what the column counts (against a report whose attempts are enumerable elsewhere, e.g. via the Story 1.3 attempts table) would either yield a correct relation or prove that none exists; `domain_g.py`'s consistency block carries a comment naming these four reports so the relation is not re-added blind, and `test_goals_may_exceed_attempts_at_goal_and_that_is_NOT_a_finding` pins the behaviour.

## Deferred from: code review of 2-7-pitch-panel-infrastructure-with-shot-cross-maps (2026-07-26)

- **`ShotLogRow.minute` / `stoppageMinute` (and their `CrossLogRow` twins) are dead fields carrying a defaulting decision that contradicts the ordering contract** — `pipeline`-side nothing reads them: `shot-map-model.ts:155-157` populates `minute: shot.at?.minute ?? 0` and `cross-map-model.ts:160-161` does the same, while `ShotMapsSection.tsx:251-267` renders only `teamCode`, `playerName`, `minuteLabel`, `x`, `y`, `outcomeKey`, `ownGoal` and `expectedGoals`. The fields are harmless today precisely because nothing reads them, but the `?? 0` silently sorts a clock-less row to minute 0, which is the opposite of `orderByMinute`'s ruled contract that rows with no `at` sort LAST (`marker-layout.ts:36-41`). Story 2.11 owns the sortable Expert-layer instance of these same logs and is the first consumer that would pick them up. Deferred rather than patched: either they are removed as dead weight or they are kept and their default corrected to match `orderByMinute`, and that is 2.11's call to make when it builds the collator sort — patching them now fixes nothing observable and pre-empts a decision the story that needs them should own.

## Filed by Story 1.8 (momentum-series extraction, 2026-07-27)

- **The extra-time half-time boundary is not printed on any report, and is derived.** The
  nine extra-time reports print `FT` and `120` and nothing between them: there is no ET
  half-time tick anywhere in the corpus. The parser therefore reads the first extra period as
  opening on the slot after `FT` and places the second period's opening slot fifteen regular
  minutes before the `120` tick — the same pattern the two regular halves establish and the
  only reading the printed ticks support. It is asserted self-consistent (the two periods must
  not overlap; they do not on 9/9) but it is a derivation, not a reading. If a future report
  prints an ET break tick, prefer it. Consequence for the stamps: an unusually long derived
  ET2 stoppage — PMSR-M82-BEL-V-SEN lands at `120+11` — is arithmetically pinned by the grid
  and the `120` tick rather than observed directly.

- **One report cannot have its momentum coverage cross-checked.** PMSR-M42-FRA-V-IRQ prints no
  `FT` tick, so the grid's last slot is taken as full time instead of being *compared* against
  it. That fallback is safe (the two agree on all 94 regulation reports that print both), and
  `momentum-coverage` still passes on its other clauses, but the report's end-of-match slot is
  asserted by geometry alone. Not a defect; recorded so a future reviewer does not read
  `104/104 pass` as `104/104 cross-checked`.

- **The momentum unit's GCD derivation assumes a report's values include the smallest one.**
  The value unit is the approximate GCD over bar heights, so a chart whose every drawn value
  shared a common factor would be read at 1/k scale. `momentum-axis-scale` catches exactly
  that (the derived peak would not equal the printed label) and it is unit-tested, but it
  surfaces as a recorded check failure rather than a loud parse failure. Holds on 104/104
  today — every report draws 50-90 bars with values running from 1.

- **AD-14 note: the `schemaVersion` 2 bump invalidated Story 2.6's slider AC, which has not
  been re-specified.** Raised by the 1.8 code review (2026-07-27) and ruled a real gap.
  `contract/README.md` §3 justified the bump as safe because Story 2.6 (Momentum Timeline) was
  still `backlog` — true for compilation, false for its acceptance criterion. `MomentumSample.at`
  is a `MinuteStamp`, so `at.minute` is **not unique** across the series: the regenerated
  fixtures carry minute 45 five times and minute 90 eight times in `m001`, and 45x7 / 90x6 /
  105x5 / 120x4 in `m074`. EXPERIENCE.md:74 and epics.md:737 specify `aria-valuemin`/`aria-valuemax`
  **over match minutes** with "arrow keys move +/-1 minute", which no longer maps one-to-one onto
  samples. **Story 2.6 must index the slider by sample, not by minute, and announce the stoppage
  offset in `aria-valuetext`.** No code change is owed by Story 1.8; the consequence is recorded
  in the `MomentumSample` schema description so the next reader of the contract meets it there.
  EXPERIENCE.md itself was deliberately NOT edited — that is UX's and 2.6's call, not this
  story's.

  **RESOLVED by Story 2.6 (2026-07-27).** 2.6 ruled it as its decision 1 and shipped it: the
  slider **indexes samples, not minutes** — `aria-valuemin={0}`, `aria-valuemax={samples.length - 1}`,
  `aria-valuenow={index}` — and `aria-valuetext` announces the composed clock label including the
  stoppage offset. Verified live on both fixtures: m001 `aria-valuemax="100"` with index 45
  announcing "Minuto 45+1′", m074 `aria-valuemax="137"` with End announcing "Minuto 120+3′";
  m001's indices 44-48 announce five distinct values for the same minute 45. Arrow keys move
  +/-1 SAMPLE, PageUp/PageDown +/-10, Home/End to the ends, no wrap (100 real ArrowRight presses
  from index 0 land on exactly 100; 60 ArrowLeft back land on exactly 40). The uniqueness
  property is pinned as a regression test in `app/src/viz/momentum-model.test.ts`
  ("the index space — decision 1's teeth"), which fails if anyone re-indexes by minute.

- **`EXPERIENCE.md:74` and `epics.md:737` still describe a MINUTE-indexed momentum slider and need
  a UX sign-off.** Filed by Story 2.6 (ruled decision 22), which deliberately did NOT edit either
  document. Both still say `aria-valuemin`/`aria-valuemax` run "over match minutes" and that
  "arrow keys move +/-1 minute". The shipped control indexes samples (see the resolved note
  above), so both sentences are now stale against the code AND against the contract, whose
  `MomentumSample` description states "The slider must index samples, not minutes, and
  aria-valuetext must announce the stoppage offset alongside the minute."
  **Why 2.6 did not just fix them:** these are normative UX sentences in a spine document, and
  Story 2.7's precedent for correcting a spine (the DESIGN.md light-theme note) was a ruled,
  disclosed edit of a factual error. This is a design-intent change that UX should sign. Owner:
  UX. Blocking nobody — the code, the contract and the tests already agree with each other.

- **AD-14 note: the momentum series has no per-team totals anywhere in the report.** Unlike
  every other domain, nothing printed reconciles the per-team bar sums (tested against all 208
  team-innings of Domain B; best exact-match rate 2/208). If a future contract revision wants a
  `MomentumSeries.totals` block it would have to be computed by the pipeline, which AD-5
  permits at emit time but which no printed number could then validate.

## Deferred from: code review of 1-13-offers-movement-to-receive-parsers (2026-07-27)

- **The movement pitch panel has no decoration census and no unknown-RGB seam at all** — `pipeline/markers/receiving.py:947` (`_movement_panel`) calls `detect_pitch_frames` and nothing else; `collect_candidate_markers` / `exclude_legend_rows` / `key_outcomes` never run on this page. Any future template revision that starts drawing filled circles inside `Movement Types Pitch Third` is never keyed, never counted and never asserted, so `receiving-parse` cannot fire for this page family. Deferred because Task 2.3 deliberately scopes the chain to the offers panels (the movement panel holds zero markers on 208/208 pages, so there is nothing to key today). One correction owed regardless: the 1.13 filter-chain closure entry above cites "the sibling movement page's 9.0 pt legend swatches sit above `marker_max_pt` (8.5)" as a defence that held — those swatches are on a page the chain never processes, so that clause is vacuous as written.
- **`_check_receiving_count_match` catches `PipelineError`, but registry drift raises `LookupError`** — `pipeline/validate/checks.py:1295` wraps the Domain G lookup in `except PipelineError`, which does not catch the `LookupError("anchor registry has no spec(s) for ...")` that `_domain_anchor_pages:520` raises and `_domain_g_memo` replays. The docstring's guarantee ("when it is not available, those checks are not emitted at all rather than failed") therefore does not hold on that path. Deferred: the same replayed-`LookupError` behaviour is already ledgered for Domains B/C/G, so this is one more instance of a filed pattern rather than a new defect.
- **`most_offers` is staged entirely unreconciled although the same page prints a usable counterpart** — `pipeline/markers/receiving.py:745` stages value / player / position from an "exactly three visual lines inside the title's x-band" rule, the most fragile read in the module, and none of the nine measured reconciliations covers it. The offers table on the same page prints every player's `offers_made`, so `max(row["offers_made"])` and its row's name are a free exact same-page check. Deferred because the relation was never measured corpus-wide (the Most-Offers player need not appear in a 13-17 row table), and shipping an unverified reconciliation would flood the gate.
- **`most_offers` assigns name and position by line index, and a wide name truncates silently** — `pipeline/markers/receiving.py:793-797` takes `lines[1]` as the name and `lines[2]` as the position with no text anchor, so a template printing position above name swaps them silently; and the block filter at `:769-775` keeps only words overlapping the `"Most Offers"` title's x-span, so a name or position wider than that ~48 pt run loses its outermost words while still forming three lines, passing the `len(lines) != 3` guard. `position` stages verbatim by design (Task 2.4), so no vocabulary check catches it either. Deferred: not reachable on the current corpus, and it is the same positional-block pattern the earlier marker families use.
- **A table row whose leading cell is not an ASCII digit is dropped silently, and a dropped zero-offers row is invisible** — `pipeline/markers/receiving.py:850` (`if not region or not _DIGITS_RE.fullmatch(region[0][1]): continue`) skips rather than raising, against Task 2.7's "malformed row → typed table error". A row printing a blank or fullwidth shirt cell **and** `offers_made == 0` / `offers_received == 0` contributes 0 to both table sums and is skipped by the percentage check, so its loss is unobservable in every check. Deferred: this is the established `crosses.py` / `defensive_actions.py` admission pattern, and the nonzero case is caught by `receiving-offers-table-sum`.
- **A Domain G shape change raises a bare untyped `KeyError` out of the cross-domain block** — `pipeline/markers/receiving.py:456-483` indexes `player["in_possession"]["total_offers"]`, `["offers_received"]` and `["offers_by_movement_type"][<five snake keys>]` with no guard, so a Domain G field rename escapes as an untyped `KeyError` from both `extract_report` and `receiving-count-match`. An empty side list additionally makes every cross-domain check fail with counterpart `0`, attributing a Domain G gap to the receiving family. Deferred: Domain G raises typed errors on parse failure and Domain A fails before an empty side list is reachable.
- **The decoration census is a panel-symmetry tripwire, not the template-revision tripwire it is called** — `pipeline/markers/receiving.py:697-703` asserts 11 dots, one known fill, and positions identical *between the two panels*. A wholesale change to the formation template that keeps 11 dots in the same fill at the same relative positions in **both** panels passes silently, yet `pipeline/README.md` and the module docstring describe the census as catching template revision generally. Deferred: inherent to a decoration that carries no per-report information — there is no independent counterpart to compare against — but the wording overstates the guarantee.

## Filed by Story 2.8 implementation (pass-network visualization, 2026-07-27)

- **The pass matrix ships PLAIN, not sortable — routed to Story 2.11.** AC 3 as written asks for a *sortable* table (UX-DR16). Story 2.8 ships two deterministically-ordered tables instead (node table, edge table), each stating its own default order in its caption, and defers sortability. Reason: `EXPERIENCE.md:207` puts the pass matrix in the Expert Layer's own list of tables ("shot log, cross log, **pass matrix**, receiving log, defensive-actions log — which double as the viz data-table alternatives"), and Story 2.7 already ruled the same split for the shot and cross logs. UX-DR12's sort contract (`aria-sort`, `Intl.Collator('es',{sensitivity:'base'})`, polite live-region announcements, sticky header, a stated default sort per table) is ONE cross-table contract implemented once; a bespoke second copy here is what 2.11 would then have to reconcile. **The accessibility floor is met in full today** — UX-DR16/NFR-2 require a reachable data table carrying the same numbers, which 2.8 ships. Plug-in points: the `<th>` elements in the private `DataTable` in `app/src/components/PassNetworksSection.tsx` and the row arrays `passNodeRows` / `passEdgeRows` in `app/src/viz/pass-network-model.ts`, which already carry the raw sortable values.

- **Route to Story 1.14 — nobody has ever confirmed the "Passing Networks {team}" page actually prints node positions.** This is the highest-probability spec risk in the pass-network surface and it was unfiled anywhere before this entry. `PassNetworkNode.x`/`y` are `required` in `contract/match-bundle.schema.json:634-654` and the schema demands they be EXTRACTED, never derived (AD-3); the fixtures' coordinates are handcrafted (`data/fixtures/README.md:70-72`) and Story 1.14 is still `backlog`. Three of the four Domain D families probed so far had unfulfillable required per-row fields — 1.11's `CrossEvent` (playerId/playerName/at/deliveryType), and 1.13's `ReceivingEvent`, whose probe **overturned the epic's premise entirely** (neither receiving page is a marker scatter at all). `PassNetworkNode.x/y` could be the third. Also record: **the Story 2.3 sign-off row for this surface walked the CONTRACT, not the PDF** — 1.13 recorded exactly that staleness for the offers/movement row. 1.14 should probe the page before writing a parser, and an unfulfillable-coordinate finding needs an AD-14 decision (it would ride CS-1's successor, not CS-1).

- **`PitchMarker.minutePrefixKey` / `minuteLabel` are now used POSITIONALLY as a generic middle clause; the shot-era names mislead.** `PitchPanel.markerName()` always renders three clauses (`${namePrefix} ${subjectName}, ${minutePrefix} ${minuteLabel}, ${qualifier}`), and Story 2.8 fills the middle one with "participación 80 pases y 6 conexiones" — a value clause with no clock in it. Story 2.9 will do the same. A rename to something neutral (`valuePrefixKey` / `valueLabel`) is mechanical across five files (`marker-model.ts`, `shot-map-model.ts`, `cross-map-model.ts`, `pass-network-model.ts`, `PitchPanel.tsx`, plus four test files) for zero behaviour change, so it belongs to whichever story next touches all of them. Deliberately not done in 2.8: it would have put a no-op diff across both shipped viz models and their suites inside a story that changes neither.

- **`pitchMarkings` draws goal furniture at ONE end only, so a full pitch has a bare defending half — first visible in 2.8.** `app/src/viz/pitch-geometry.ts` emits a single `penaltyArea`, `sixYardBox`, `goal`, `penaltyArc` and `penaltySpot`, which is exactly right for the half pitch Story 2.7 always drew. Story 2.8 is the first consumer whose extent is `{xMin: 0}` (fixture node x spans 20.21-79.71, so `pitchExtentFor` widens on its own), and the rendered result is a full-length pitch with the halfway line, centre circle and centre spot correct but no penalty area or goal at the defending end. Not changed here: `pitch-geometry.ts` is shipped, tested 2.7 code on this story's do-not-touch list, the missing marks are decorative (`aria-hidden`, no data rides them), and both mockups draw half pitches so there is no ruled reference for the second end. Whoever owns the next full-pitch surface (2.9's defensive-action / receiving maps) should decide whether to mirror the furniture.


## Filed by Story 1.9 implementation (Domains E & F — goalkeeping & set plays, 2026-07-27)

- **AD-14 (a): `GoalkeeperRecord` is per-keeper; the source is per-team.** `contract/match-bundle.schema.json`'s `GoalkeepingBlock` keys a record per goalkeeper with `teamId`/`playerId`/`playerName`, and that whole shape is **unfulfillable**. Verified over all 104 reports / 936 goalkeeping pages: all four page families are titled `{team}`, **no goalkeeper name appears anywhere on any of them**, and **7 of 208 team-innings used two goalkeepers** (PMSR-M21 home, M41 away, M53 away, M62 away, M66 home, M88 home, M98 away) while still printing one team-level block each — verified by hand on M53, where Mexico's RANGEL came off at 78' and the page still prints one chart, one total and no name. Story 1.9 stages `domains["goalkeeping"]` **per team**, with the keeper(s) who took the field carried alongside from Domain A's lineups (`goalkeepers: [...]`, 1 entry on 201 innings and 2 on 7) so the attribution question is *recorded* rather than guessed. **Story 1.16 emission needs an AD-14 decision**: either `GoalkeepingBlock` becomes per-team with the keeper list as context, or per-keeper emission is dropped. This did NOT ride Story 1.8's `schemaVersion: 2` bump and does not open a v3 — `/contract` was read-only for this story.

- **AD-14 (b): `FreeKickCounts`' nesting `$comment` is corpus-false.** The schema states the four values are nested with `direct == directOnTarget + directOffTarget`, "holds across all six fixture team-innings". Over the real corpus it is **false on 208 of 208 team-innings**; on **160** of them `directOnTarget + directOffTarget == 0` while `direct > 0` (the ground-truth report itself: Mexico prints `direct 11`, both flags `0`). A stacked chart built on the `$comment` would be wrong. The relation that IS true 208/208 is `direct + indirect == totalFreeKicks`, and that is the one Story 1.9 ships as a check. The `$comment` needs correcting in a future change-set.

- **AD-14 (c): three documented absences and their contract consequences.** `GoalkeeperDistribution.feetTechniques` / `handsTechniques` / `throwTechniques` and `GoalPrevention.byBodyType` are printed only as donut **slice** labels inside raster images (only the centre total is in the text layer — identical to Story 1.13's movement-donut finding), and `AerialControl.crossesFacedCompleted` is drawn only as marker colour on a goal-mouth crop with no printed counterpart to validate a count against. All three stage as `null` plus one per-report warning (AC 4). Story 1.16 cannot emit any of them.

- **AD-14 (d): re-scope notice for Story 2.10.** Its AC reads "each goalkeeper's involvement, distribution, goal prevention, and aerial control summary displays". That surface is **per team, not per goalkeeper**, for the reasons in (a). Story 2.10 must be re-scoped against the team-level block, with the goalkeeper list available as context (and two names to show on 7 team-innings).

- **The involvement series consistently plots fewer involvements than the KPI counts — cause unresolved.** `printed total − Σ(series)` is in `{0,1,2,3,4,5}` over all 208 team-innings, exact on 59, mean 1.26, and **never negative**. Not axis clipping (the plotted maximum equals the printed axis top label exactly) and not lost dots (the dot count equals the slot count). Story 1.9 ships the **bound** `Σ(series) <= total_involvements` (true 208/208) rather than manufacturing the equality, and records the observed delta in the check's `specifics` on every report so the gap stays visible. Deferred: closing it needs a source-semantics answer the pages do not carry. Do **not** resolve it by making the numbers agree (the 1.8/1.12 rule).

- **The distribution `feet` panel draws more markers than its printed donut centre on 20 of 208 team-innings — cause unresolved.** Over 208 innings × 3 printed panels, `drawn >= printed` is true on **624/624** and equality holds on **604/624**; every residual is in the `feet` panel (+1 on 18, +2 on 2), while `hands` and `throw` are exact on 208/208 each. No geometric cause survived investigation: with `pitch_margin_pt=0.5` there are no under-counts at all, no exact-duplicate marker positions on 19 of the 20, and the Total Distributions panel is the **exact union** of the other three on every case examined — so the drawn set is self-consistent and the map simply plots more feet distributions than the technique donut counts. Story 1.9 therefore ships `goalkeeping-distribution-printed` as the bound rather than the equality, with every panel's delta in `specifics`. Deferred for the same reason as the involvement delta: the resolution is a source-semantics question, most plausibly a distribution whose technique the donut does not classify.

- **The story's stated `pitch_margin_pt=0.0` rationale is measurably wrong, and the shipped value is 0.5.** Story 1.9's Dev Notes call strict containment "load-bearing" because "any positive margin would admit two Complete/Incomplete legend swatches per panel and inflate every count by 2". Swept over all 208 pages: the swatches are **9.0 pt** circles (outside the parser's 5.0–6.5 size window) whose centres sit **10.5 pt** below the frame (y = 417.0 against `y1 = 406.5` on all 832 panels), and **no** out-of-size filled circle sits within 6.0 pt of any frame. Meanwhile strict containment drops real markers on 8 team-innings (max overshoot **0.2917 pt**), and admitting them makes 7 of those panels match their printed donut centre exactly. Recorded so a later reader does not "restore" 0.0 on the strength of the story text.

- **`extract_domain_e` takes the cover team names, which the story's stated signature omitted.** The involvement page carries BOTH teams' charts on ONE page and identifies them only by the printed title `'{team} GK Involvement Timeline'`. Without the cover names the home/away split could only be read from drawing order, which AD-8 forbids; every sibling parser facing the same problem takes the same two arguments (`parse_shots`, `parse_crosses`, `extract_momentum`). Recorded as a deliberate deviation, not an oversight.

- **The "value above its label, centred on it" reader is now duplicated in two modules.** `domain_e._value_above` and `domain_f._kpi_value` are the same rule with different bands and value types, and the rule appears on five of this story's nine pages. The project's own extraction rule is that a helper moves to a shared seam at the **third** copy (the `check_entry` precedent); this is the second. Deferred rather than pre-emptively extracted — the natural home would be `pipeline/extract/lines.py`, a shared-contention file, and the two copies differ in whether they accept decimals.
## Filed by Story 1.9, Decision 3 (the involvement slot -> match-clock mapping, 2026-08-03)

- **`PMSR-M88-AUS-V-EGY` draws a 14-slot first extra period, and the parser records it rather than failing it.** Both of that report's involvement charts print no `105'` tick and place their `110'` tick one slot earlier than a 15-minute ET1 would — so the page is internally consistent and says, plainly, that minute 105 has no slot. Measured across all 18 extra-time charts, ET1 runs 15–19 slots everywhere else (15 regular minutes plus 0–4 stoppage). Asserting the regular length would fail one report of 104 over an assertion about football rather than about the page, and would move the ruled batch baseline; the short period is therefore recorded in `goalkeeping-involvement-clock`'s `specifics` on every report (`ET1 drawn SHORT at 14/15 slots`) and left visible here. **Deferred:** whether the source dropped a minute or the chart mis-renders one is a source-semantics question the page does not answer. Do **not** close it by padding the period to 15 (the 1.8/1.12 rule).

- **The "extra-time tick collision" left open at code review does not exist in the data.** The review's remaining blocker was that `90+5` and `95` would both land on `m46_slot+49`. That is true only of the *naive* reading — extending the second-half formula `slot(M) = m46 + (M-46)` past minute 90 — and the chart does not use it: across all 18 extra-time charts the `95'` tick sits **5–9 slots after** the last `90+N` tick, never on it. The mapping reads the printed ticks, so the collision never arises. Recorded because the open question was ledgered as a blocker and a later reader should not go looking for it again.

- **`MAX_STOPPAGE_MINUTE = 30` is duplicated in `momentum.py` and `domain_e.py`.** Both derive the contract's `StoppageMinute` upper bound locally rather than importing it (`/contract` is an emit-time checklist, not an import target) and both use 30 against corpus maxima of H1 10 / H2 19. Deliberately not shared: the two charts are different pages with different grammars, and coupling them would make a momentum template revision change what the goalkeeping parser accepts. Recorded so the duplication reads as a decision rather than as drift — and so a future contract change updates both.

- **The involvement clock's stamps are staged per slot, duplicating what three boundary integers already determine.** `involvement_clock` carries `second_half_slot` / `extra_time_slot` / `second_extra_slot` **and** one `{minute, stoppage_minute}` stamp per slot, so a 138-slot chart stages 138 stamps that are fully derivable from three numbers plus the slot count. Staged anyway, for the reason momentum stages its samples' stamps: a derivation that lives only in code cannot be read back off the record, and Story 2.10 places this timeline from the record alone. Recorded as a size/redundancy trade-off a future record-slimming pass may want to revisit — not as a defect.

- **`involvement_series` and `involvement_clock["stamps"]` are two parallel lists indexed by position.** Momentum's record shape instead inlines the value into each sample (`{minute, stoppage_minute, home, away}`). The parallel-list shape was chosen because `involvement_series` is already consumed by `goalkeeping-involvement-bound`, by the M01 ground-truth assertions and by the README, and reshaping it would churn verified surfaces for no extra information. Story 1.16's emit boundary has to zip them anyway; recorded so that zip is expected rather than surprising.

## Deferred from: code review of story-1.9 (2026-07-27)

- **Value readers count spans, not printed numbers, while the label readers explicitly de-fragment.** `domain_e._numbers_in` (consumed by `_table_row_below`) and `domain_f._row_values` count band spans directly, but `_label_run`'s own docstring records that real pages fragment text per glyph run (`'D' 'eli' 'v' 'e' 'ry'`). A goal-prevention or delivery-types row whose two-digit value emits as two spans would fail as "carries 8 value(s), expected 7" — a template-revision message for a page the grammar could read. Deferred: it fails loud rather than silently, and the counts are corpus-clean at 208/208. The fix (joining adjacent numeric spans) risks fusing genuinely separate columns, so it needs its own corpus measurement.

- **The lower involvement chart's y-band is unbounded below.** `_parse_involvement` sets `bottom = page_y1` for the last chart, so any text in the `x < 35` column beneath the second chart is read as a y-axis label — a non-integer raises, a bare integer breaks the descending-run assertion. Deferred because the natural fix is circular: the axis labels supply the unit that selects the value gridlines, so the gridline span is not available to bound the label search.

- **Each involvement chart's band is delimited by the NEXT chart's title row.** Anything the away chart prints or draws above its own title falls inside the home chart's band. The fixture already exercises this (the away team header sits at y≈301, inside the home band 135–355) and survives only because it is text at x=60. A 2.5–3.5 pt filled circle there would be collected for the wrong chart and fail as "not evenly spaced" — a message pointing at the slot grid when the fault is elsewhere. Deferred: fails loud, corpus-clean.

- **`_axis_labels` requires a step-1 descending run, hard-coupling the gridline count to the auto-scaled top label.** A chart forced to print `12 10 8 6 4 2 0` aborts the whole report. The story pins a corpus range for the slot count (95–111 / 129–145) but none for the axis step, so the one-gridline-per-unit assumption is asserted without the evidence every other constant in the module carries.

- **`NUMERIC_WORD_COUNT = 24` counts bare integers over the WHOLE set-plays page.** Any venue, team or competition string printing a standalone number adds a 25th word and fails every report at that venue — and because the census runs inside `_extract_side`, the whole record fails, not just Domain F. Real FIFA venue names of the form `Stadium 974` exist. Corpus-invariant today; recorded so a future corpus does not surface it as a mystery.

- **`domain_e._value_above` walks the band the page's own stray pitch-marker ordinals occupy.** The KPI search spans `[0, 460]` and up to 80 pt above the label, and the module's own comment documents a stray ordinal at x=275 on the goal-prevention page. If an ordinal lands within 3 pt of a KPI centre on a nearer row, it is returned as the KPI. `attempts_faced_printed` is protected by the KPI-vs-table cross-check in `goalkeeping-goal-prevention-sum`; `save_percentage` has no counterpart. The fixture draws its stray ordinal BELOW the labels, so the risk is structurally untestable as built.

- **Story 1.9 has no commit of its own.** `git log -- pipeline/extract/domain_e.py pipeline/extract/domain_f.py` returns a single commit, `7306d7b` "Story 1.13: offers & movement to receive parsers, code review done", which also carries `errors.py`, `extract_report.py`, `checks.py`, `conftest.py`, the three new test files, both forced repairs, `pipeline/README.md` and this ledger. The content is identical to the tree the final green run verified and the co-commit is disclosed in the Completion Notes, but `git log` attributes 1.9's whole change set to another story. Not correctable without rewriting history; recorded so a later bisect or blame is not misread. See also the same PROCESS FINDING filed by story 1.8's review — three stories sharing one working tree is the root cause.

- **The momentum data table ships PLAIN, not sortable — routed to Story 2.11.** Story 2.6 ruled
  decision 14, taking the direct 2.8 precedent above ("The pass matrix ships PLAIN"). UX-DR12's
  sort contract (`aria-sort`, `Intl.Collator('es',{sensitivity:'base'})`, polite live-region
  announcements, sticky header, a stated default sort per table) is ONE cross-table contract that
  2.11 implements once; a bespoke third copy is what 2.11 would then have to reconcile.
  **The accessibility floor is met in full today** — UX-DR16/NFR-2 require a reachable table
  carrying the same numbers, and 2.6 ships a real `<table>` of all 101 (m001) / 138 (m074) rows
  stating its own order in its caption ("Ordenado por minuto de partido, incluido el tiempo
  añadido."). Plug-in points: the `<th>` elements in the private `DataTable` in
  `app/src/components/MomentumSection.tsx`, and the row array returned by `momentumTableRows` in
  `app/src/viz/momentum-model.ts`, which already carries raw sortable values (`at`, `home`,
  `away`, `hasGoal`) and is commented with this pointer in-file.

- **`TacticalSection`'s `title` prop is a plain `string`, which blocks Story 2.18's glossary
  tooltip on "momentum".** Filed by Story 2.6 (Task 10.2a). Both momentum mockups render the
  heading as `<h2>Línea de <span class="gloss">momentum</span></h2>`, and `EXPERIENCE.md:259`
  rules that the English term is kept and carries a glossary tooltip. `TacticalSection` takes
  `title: string` and renders it as a text child, so there is no seam for marking up one word.
  2.18 needs either that prop widened to `ReactNode` or a per-section term-marking hook — a
  change to a shell component eleven sections share, which is why 2.6 deferred rather than
  widened it unilaterally. **Same entry covers `review-i18n.md:62`'s `lang="en"` pronunciation
  spot-check on "momentum"**: there is currently no element to hang `lang="en"` on either, and
  both needs are discharged by the same seam. Owner: Story 2.18.

- **`--shot-goal-canvas` was added by Story 2.6; the 2.7 deletion rationale is correct for the
  PITCH but did not survive contact with a theme-aware canvas.** The 2.7 code review deleted all
  five `--shot-*-light` overrides on the rationale that those hues "render only on the
  theme-invariant pitch, so a light-canvas variant of them is unconditionally wrong". That is
  true of `--shot-on-target`, `-off-target`, `-blocked` and `-incomplete`, and it was true of
  `--shot-goal` until the Momentum Timeline shipped goal markers on `--surface-raised`, which
  DESIGN.md:280 always named as a theme-aware canvas. Measured: `--shot-goal` `#3fdd85` on the
  light card `#ffffff` computes **1.77:1**; the DESIGN.md:288 light value `#177245` computes
  **5.95:1** (both reproduced live in the browser). 2.6 therefore added `--shot-goal-canvas`,
  declared in **both** theme blocks (`#3fdd85` in `:root, .dark`, `#177245` in `.light`) and
  registered as `--color-shot-goal-canvas` — **not** a `-light`-suffixed property, because this
  codebase has none and one declared only in `.light` would be undefined in the dark theme.
  Every pitch consumer keeps `--shot-goal` untouched (`shot-map-model.ts:33`). Both `globals.css`
  comment blocks were amended to scope the old rationale to the pitch. **The remaining four
  `--shot-*` hues still have NO off-pitch consumer** — recorded so the next story neither
  re-deletes this token nor re-litigates the other four.

- **The momentum midline measures 2.81:1 over team A's composited fill in the DARK theme, below
  the 3:1 non-text floor. Needs a palette ruling, not an implementation fix.** Filed by Story 2.6
  from the re-measurement its ruled decision 25 commissioned. DESIGN.md:288 publishes 15.8:1 for
  this line, but that figure describes ink over the BARE CARD — the "reserved 2px axis gutter that
  the area fills never enter" — and that geometry **is not expressible in recharts** (`baseValue`
  is one number per Area, so opening a gap would render every 0/0 minute as a visible band, on the
  30 m001 / 23 m074 samples decision 16 exists to protect). The shipped line is 2px
  `--ink-primary` drawn OVER the fills. Measured live, both themes:
  ink over fill A **2.81:1** (dark) / 7.32:1 (light); ink over fill B 3.53:1 (dark) / 6.97:1
  (light); ink over the bare card 15.81:1 (dark) / 17.67:1 (light) — the last reproducing
  DESIGN.md's published figure exactly, and confirming it is the wrong comparison for what ships.
  The same 2.81:1 applies to the goal marker's `--ink-primary` ring where it crosses team A's fill.
  **Why 2.6 did not fix it in-story:** the shortfall is a palette interaction, not a coding
  choice. `--ink-primary` is already the lightest ink in the dark theme; substituting pure
  `#ffffff` reaches only **3.06:1**, i.e. the floor is unreachable without either lowering the
  ruled 60% fill opacity (decision 9 forbids re-opening a settled UX number) or minting a
  dedicated midline token. Both are UX calls. Light theme passes comfortably; only dark team A
  fails. Owner: UX / DESIGN.md. See also `review-accessibility.md:18`, which filed the related
  `--viz-neutral` failure (1.03:1) that `--ink-primary` was chosen to fix.

- **recharts' automatic y-axis ticks are non-uniform and omit zero on an "un-nice" domain.**
  Found live by Story 2.6 on m074 (`peak` 17, domain `[-17, 17]`): recharts emitted
  `+17, +1, -8, -17` — four ticks, unevenly spaced, **with no zero tick at all** on a chart whose
  entire encoding is above-or-below the zero line. Because ruled decision 6 strips the sign for
  display, those labels rendered as an unreadable `17 1 8 17`. m001 (`peak` 10) happened to come
  out clean as `10 5 0 5 10`, which is exactly how this would have shipped unnoticed. Fixed in
  2.6 by supplying explicit ticks from a pure `momentumYTicks(peak)` (symmetric, integer, always
  includes 0), pinned by a property test over peaks 1-40 plus both fixture literals. **Recorded
  because stories 2.10 / 2.13 / 2.15 / 2.16 all carry recharts statistical charts and will hit
  the same default.** Do not rely on recharts' tick generation for any axis whose zero is
  semantically load-bearing.

## Filed by Story 1.14 implementation (pass-network extraction — nodes & edges, 2026-07-27)

- **AD-14 emission blocker (headline): `PassNetworkNode.x`/`y` are unfulfillable — the corpus prints no pass-network coordinates anywhere.** `contract/match-bundle.schema.json:637-657` requires `["teamId","playerId","playerName","shirtNumber","x","y","involvement"]` with `additionalProperties: false`; `x`/`y` are `PitchX`/`PitchY` (0-100, 2 decimals) with **no null branch**. Re-measured over all 104 reports / **208 pass-network pages** (Story 1.14 Task 1, re-derived independently of the story-creation probe and reproduced **cell for cell — 52,103 cells, 0 mismatches** — by an independent prototype extractor run beside the shipped parser): **0 pitch frames on 208/208** using `filter_chain.detect_pitch_frames`' own qualifying rule; **0 filled all-Bezier drawings at any size** (the page's only curve content is two ~9-10 pt mixed `c`+`l` header sort-arrow glyphs); its single image is a **36x36 pt competition logo** at bbox `(912.0, 39.75, 948.0, 75.75)` on 208/208; and a title scan over **all 5,448 pages of the corpus** finds **0** pages titled with average/positions. This is the **third** Domain D family with an unfulfillable required field after 1.11's `CrossEvent` and 1.13's `ReceivingEvent` — and the **narrowest**: `ReceivingEvent` was unfulfillable in *every* field, whereas here **5 of `PassNetworkNode`'s 7 required fields are available today** and only `x`/`y` are missing. Candidate to ride CS-1's **successor** change-set, never CS-1 (already scoped). `/contract` was not edited by this story.

- **AD-14 shape note: name the staged payload as the candidate replacement input.** The corpus is **poorer** than `PassNetworkNode` in one dimension and **richer** in another. Poorer: no `x`/`y`, anywhere, ever. Richer: the matrix carries **`passes_made` and `passes_received` separately** where the contract models only their sum, plus a per-team **`matrix_total`** and a printed **top-5 ranking** — none of which has a contracted destination. Stated plainly for whoever writes the successor change-set: a **coordinate-free node shape** (`playerName`, `shirtNumber`, `passesMade`, `passesReceived`, `involvement`) is **fully populatable from `domains.pass_network` today**, whereas the x/y shape can never be. `PassNetworkEdge` (`:658-677`, required `teamId`/`fromPlayerId`/`toPlayerId`/`volume`, `volume` `minimum: 1`) is by contrast **fully fulfillable** once Story 1.15 mints the player ids — 23,597 real edges, volumes 1-48, every endpoint joining to Domain A by verbatim name with the shirt corroborating on 3,289/3,289 rows.

- **The three owners this blocker needs a decision from, each before Story 1.16 emits.**
  **(1) Story 1.16** can emit `events.passNetworkEdges` in full but can only emit `events.passNetworkNodes: null` unless AD-14 relaxes `x`/`y`. The two tables are **independently nullable** (`match-bundle.schema.json:792-801`), so a null node table beside a populated edge table is *schema-legal today*. It nonetheless collides with `test_pass_network_edges_join_players_who_have_a_node` (`test_fixtures.py:497-503`), which builds its node set from `bundle["events"]["passNetworkNodes"]` with **no `or []` guard** — a `null` node table makes it raise `TypeError` rather than fail cleanly per edge. That test parametrizes over `data/fixtures/`, so the collision lands when the fixtures are refreshed with real data (1.18/1.19), **not** the moment 1.16 emits — but it must be ruled before either.
  **(2) Story 2.8** has shipped a pass-network surface and it fails **closed** on this data, in two different ways 1.16 must be told apart — neither is a graceful degradation. `passNetworkNodes: **null**` + populated edges → `app/src/lib/tactical-sections.ts:124-125` requires **both** tables non-null (2.8 ruled decision 13, pinned by `tactical-sections.test.ts:193-199`), so `sectionDataState` returns `empty` and the **whole `#pass-networks` section renders `EmptyStatePanel`** — the fully-real pass matrix never reaches the reader. `passNetworkNodes: **[]**` + populated edges → `pass-network-model.ts:336` throws on every unresolvable endpoint inside `TacticalErrorBoundary`, which wraps the whole layer, so **all eleven Tactical sections die** (that blast radius is the open, unpatched 2.8 review finding at the head of this file). **Binding for 1.16: emit `null`, never `[]`.** Re-scoping the surface so the edge table renders without nodes is 2.8's or a successor's call, not 1.14's — but it must be surfaced before 1.16 emits, because until it is ruled the honest emission hides this story's own best data.
  **(3) The Story 2.3 sign-off row for `#pass-networks` is stale.** `contract/README.md:509` records PASS, reached from schema line numbers and fixture counts, **never from a PDF** (`2-3-…md:209`). Story 1.13 recorded exactly this staleness for the offers/movement row; this entry supersedes the pass-network row the same way.

- **AD-14 note: `involvement` will equal the incident-edge sum EXACTLY on real data — provided Story 1.16 derives it from the MATRIX.** `PassNetworkNode.involvement` is the contract's single "passes made + received" number, and the matrix supplies both terms directly (`passes_made` = row sum, `passes_received` = column sum). Under that derivation `involvement` is *identically* the sum of a node's incident edge volumes, so the fixture-derived invariant `node.involvement >= sum(incident edges)` (`test_fixtures.py:811-829`) **tightens from `>=` to `==` once real data lands** — the fixtures' edges being a hand-authored subset (2.8 measured 28 of 66 nodes at equality, the rest strictly greater). **The dependency is load-bearing:** if 1.16 instead sourced `involvement` from Domain G (`passes_completed + offers_received`) the equality would be FALSE, because the matrix row sum is strictly below Domain G's `passes_completed` on **1,290 of 3,289 rows** (re-measured; the bound itself holds 3,289/3,289 and ships as `pass-network-row-bound`). Flagged so 1.16 does not read the tightening as a bug, and so nobody "fixes" the fixture invariant in the wrong direction.

- **AD-3 is not reachable from the epics alone.** The extract-never-derive rule ("node positions are extracted, never derived from edges") lives in `ARCHITECTURE-SPINE.md:62` and is restated in the schema description (`match-bundle.schema.json:640`), but `epics.md:84`'s AR-3 **drops the event-table clause entirely** — so a reader working from the epics finds the rule in neither AR-3 nor AR-6. Story 2.8 recorded the same numbering drift (`2-8-…md:334`). Recorded, not applied: `epics.md` was not edited. Note also that the epic's own Story 1.14 AC 2 cites **AD-6** for the frame and that citation is **correct** (AD-6 is the pitch frame); it should not be "fixed".

- **CLOSED by measurement — the 2.8 self-loop question.** The 2.8 review entry at the head of this file ("A self-loop pass edge reads '1 conexión' but highlights nothing when isolated") is explicitly *"Deferred until 1.14 shows whether the source page can produce one."* **It cannot.** The matrix diagonal is **blank on 208/208 team-innings** — measured as part of the row census, which asserts exactly one blank per row and that blank on the diagonal — so `fromPlayerId === toPlayerId` is unreachable from this source **by construction**. The App-side defect is real but unreachable from real data, which lowers its priority to whatever a hand-authored or third-party bundle could introduce; it is not a blocker for 1.16, 1.18 or 1.19.

- **A fourth family of absence warning now fires on every report, so the batch summary prints 104 more warning lines** — extends the Story 1.12 (`:171`) and Story 1.13 (`:205`) entries above with the same shape and the same cause: `format_summary`'s "Warnings (non-fatal)" block lists one line per report, and `node_positions`' absence is a property of the page family rather than of any one report. Note the ledgered arithmetic has moved on twice since 1.13 wrote "three warnings": Story 1.9 added three absence warnings of its own, so a record now carries **seven**, and the summary-level de-duplication first proposed in the 1.12 entry ("104 reports: <warning>") would now collapse **728 lines to seven**. Implemented as Task 5.3 specifies (one warning per report, mirrored into the manifest entry). Still deferred for the same reason: it touches `format_summary`'s shared rendering, which several stories' checks depend on.

- **The one-slot per-document memo in `pipeline/validate/checks.py` is now at TWELVE copies.** Story 1.14 adds `_pass_network_memo` / `_pass_network_payload` / `_pass_network_uncached`, copied verbatim from the existing blocks as the story rules (copy-don't-extend), so the open entries this pattern carries — the strong document reference and the replayed cached exception — are inherited once more rather than fixed. Recorded only to keep the count honest: the runner-owned parse-handoff that retires all twelve is already ledgered as a single joint fix, and its value grows with every copy. Note also that **four older domains still carry the pre-2026-07-27 inlined `resolve_anchors` loop** rather than `_domain_anchor_pages`; 1.14 copied the patched `receiving` shape deliberately, but "copy a neighbour" remains a coin flip for the next story.

## Deferred from: code review of 2-6-momentum-timeline (2026-08-03)

Three-layer adversarial review of Story 2.6 (the Momentum Timeline). 2 decisions ruled, 24 patches
applied, 7 items deferred below, 4 dismissed. The patch list lives in the story file's Review
Findings section; only the deferred items are recorded here.

- **A malformed momentum series takes down all eleven Tactical sections.** `TacticalErrorBoundary` wraps the whole Tactical layer, and 2.6's ruled decision 8 deliberately builds the row sets eagerly so the throw fires on load rather than on disclosure. Correct for 2.6's own purposes, but the blast radius is the entire layer: a bad `momentum` key replaces Key Statistics, Shot Maps, Pass Networks and the eight pending shells with one crashed panel. Nothing scopes the boundary to the section that actually failed. **Pre-existing architecture, not 2.6's to change** — needs a per-section boundary ruling from whichever story owns the Tactical shell.

- **`tactical-sections.ts:120` classifies `momentum: undefined` as "ready".** The predicate is `bundle.momentum !== null`, so a truncated `as`-cast payload with the key absent (rather than `null`) is routed to the populated branch, reaches `momentumRows`, and throws — the crash-instead-of-absence outcome the guard's own comment calls "strictly worse", with the dedicated empty state never rendering. The matching half in `MomentumSection.tsx:172` is in 2.6's scope and is filed as a patch; **this half is on 2.6's explicit do-not-touch list** and needs a waiver or an owning story. The same `!== null` shape is worth auditing across the other ten section predicates.

- **`viz.momentum` has no `zero` key, so an all-zero series renders an empty card.** Every other viz namespace (`viz.passNetwork.zero`, `viz.shotMap.zero`, `viz.crossMap.zero`) carries a dedicated zero string. An all-0/0 momentum series is contract-legal — `momentumPeak` floors the domain at 1, both areas collapse onto y=0, and the midline paints over them, leaving one horizontal rule and a subtitle reading "101 minutos, 0 goles". Not reachable on the current corpus (all 104 reports carry a band), so it is latent rather than live. **Needs UX copy before it can be patched.**

- **Undeclared departure in Story 2.6: the series labels' mechanism and position.** Ruled decision 24 bullet 3 specifies `<Label position="right">` on each `<Area>`; the code ships a `ReferenceDot` + custom `<text>` shape (`MomentumChart.tsx:492-501`), anchored at data `x=0` (pixel ~76 once the y-axis offset is counted) and at 60% of the domain vertically, rather than the mockup's flush-left `x=8` / `y=20`. The spec contradicts itself — decision 9a rules "flush left" per `desktop.html:253-254` while decision 24 says `position="right"` — so the swap is defensible on the merits. What is filed here is the **process gap**: the Dev Agent Record asserts "All 27 ruled decisions implemented as written except the two departures declared below", and this is a third. Either declare it or reconcile decisions 9a and 24.

- **`viz.momentum.cursorLabel` is an operating instruction used as an accessible name.** "Cursor de minuto: mueve con las flechas para leer cada minuto." is applied as the slider's `aria-label` (`MomentumChart.tsx:229`). An accessible *name* should name the control; operating instructions belong in `aria-describedby`. As written, the command is re-read on every value change, is meaningless to touch users, and is redundant after the first hearing. **UX copy call.**

- **Two number-rendering policies sit in adjacent cells of the momentum data table.** The minute column and the cursor chip render through `formatGoalMinute` (`lib/match-hero.ts:72`), whose raw `${at.minute}` template bypasses locale formatting, while the home/away columns in the same row use `formatInteger(value, locale)`. Pre-existing helper — 2.6 was explicitly required to import it rather than re-implement — but this story is the first surface to juxtapose the two policies in one table. Worth one ruling for whichever story owns clock formatting.

- **Story 2.6's ledger and sprint-status edits landed in commit `5344fac` (Story 1.14), not with 2.6.** Verified: `git show 5344fac:…/deferred-work.md` already contains "RESOLVED by Story 2.6", and `5344fac` is otherwise a pipeline-only commit (15 files, all under `pipeline/`). Story 2.6's File List claims both shared artifacts as modified by 2.6, and its Task 10.4 required them staged with the story and any co-commit disclosed in the Completion Notes. The content is present and correct — this is a **provenance defect, not a content defect** — but it is the mirror image of the co-commit that *was* disclosed, and it is exactly the condition 2.7's review named as "how a reviewer loses the ability to tell which story changed what". Recorded so the audit trail is not silently wrong.

## Deferred from: code review of 1-14-pass-network-extraction-nodes-edges (2026-08-03)

- **`_parse_rows` silently skips any body row carrying no shirt span and no name span** (`pipeline/extract/pass_network.py:301-315`). When a grouped row buckets nothing into header cell 0 and nothing into cell 1, the loop `continue`s with no record and no error, on a page family whose whole discipline is assert-on-unknown. A dropped *matrix* row is still caught downstream (the N-row census and the lineup join both fire), so the live exposure is page furniture below the header whose x-centres fall inside the matrix columns — a footer, a legend, a note — vanishing without a warning. Deferred rather than patched: turning the skip into a raise is a behaviour change on all 104 reports and needs a full batch re-run to validate, and the conservative form (raise only when the skipped row carries digit spans) is itself a ruling this story did not take.

- **`_filled_bezier_rects` is narrower than the negative the AD-14 filing rests on** (`pipeline/extract/pass_network.py:130-146`). The predicate flags only drawings whose items are *all* `"c"`, which is the corpus-measured shape of "no markers" today and is the form Story 1.14 declared as a departure (unbounded in size rather than windowed). But the AD-14 filing and Story 2.8's re-scope rest on the stronger claim that *the page carries no coordinates*: a re-scoped template drawing nodes as filled `"re"` squares, as mixed `c`+`l` paths, or as a raster image passes this predicate **and** `detect_pitch_frames`' stroked-rect rule, and the corpus would keep publishing `node_positions: null` while real coordinates sat on the page. Widening the predicate is beyond 1.14's ruling and belongs with whoever owns the AD-14 successor change-set; recorded so the tripwire's actual coverage is not mistaken for its advertised coverage.

## Filed by Story 1.15 implementation (cross-match identity resolution & normalized spine, 2026-08-03)

- **219 players / 856 lineup entries slug in GIVEN-NAME-FIRST order, and the fix is an `OVERRIDES` data edit rather than a code change. Owner: Juan / UX.** The ruled caps-run rule takes the all-caps tokens as the surname; when a name has no caps token *or* no remainder it slugs **as listed**, so `ABDALLAH ALFAKHORI` becomes `abdallah-alfakhori-jor` while `Raul RANGEL` becomes `rangel-raul-mex` — the opposite component order, side by side in the same namespace. Every one of the 219 is unique, stable, deterministic and passes the contract `PlayerId` pattern, so the cost is cosmetic ordering on a URL, not correctness; fabricating a surname boundary inside `GABRIEL MAGALHAES` would be a guess, and AD-8 forbids guessing. **The measurement that makes this tractable, and which the story did not have: it is a PER-TEAM printing convention, not scatter.** Eight teams print all 26 of their players in full caps and contribute 208 of the 219 — `brazil`, `cabo-verde`, `egypt`, `iraq`, `jordan`, `portugal`, `qatar`, `saudi-arabia` — and the remaining 11 are spread over five teams (`scotland` 4, `spain` 3, `usa` 2, `new-zealand` 1, `paraguay` 1). By case signature: 187 `UU`, 20 `U` (mononyms — `ALISSON`, `CASEMIRO`, `PEDRI`, `RODRI`, `VOZINHA` and 15 more, where no split exists at all and no override is possible), 7 `uu` (the `Mc` names — `Weston McKENNIE`, `Scott McTOMINAY`, `John McGINN` — where `"McKENNIE".isupper()` is `False`, so the surname is invisible to the rule), and 5 `UUU`. So a decision can be taken **per team** rather than per player, and the 20 mononyms need no decision at all. The full list is queryable from the staged spine with `slug_source == "as-listed"` (`work/spine/entities.json`), which is what that diagnostic field exists for. Deferred: which of these should be re-ordered is a UX/product ruling about URL aesthetics, not an implementation question, and `OVERRIDES` ships empty precisely so the ruling can land as data.

- **AC 3's second source cannot engage yet, and this run says so out loud rather than reporting green.** The epic specifies pinning as a diff "against committed `/data`", but `data/matches/` **does not exist** — `data/` holds only `data/fixtures/` — and it will not exist until Story 1.16 emits. A pinning check built only on that baseline would be a gate that cannot fail, which reads greener than no gate while proving strictly less. The implemented design is therefore two-source: `PINS` (the committed registry) is itself the immutability baseline from run one and carries the AD-3 guarantee today, while `check_committed_data` engages the moment bundles appear and until then prints `committed /data baseline unavailable … This is NOT a pass`. **Owner: Story 1.16** — when `data/matches/*.json` lands, `test_the_repository_has_no_committed_match_bundles_yet` in `pipeline/tests/test_precompute_spine.py` goes red by design, which is the prompt to make the populated branch the primary assertion. Deferred: nothing here can be finished before the artifact it checks exists.

- **The two FR-15 identity gate checks cover only the SAMPLED reports, and their ids read as though they cover the corpus.** `identity-completeness` and `identity-pinning` are per-report by the gate's own contract — they re-mint slugs straight from each sampled report's lineup page and compare them to the committed registry, which is a genuine cross-check the registry itself cannot perform. But a reviewer reading "identity-pinning passed" as "all 1,248 players are pinned" is reading it wrong: the corpus-wide guarantee is `check_pins` inside `python -m pipeline.precompute.run`, which is a different command with a different exit code. Both docstrings say so explicitly. Deferred rather than renamed: the gate's id vocabulary is shared with eleven other stories' checks and a `-sampled` suffix on two ids only would be more confusing than the docstring, but if the gate ever grows a coverage-scope column in its report format, these two are the first entries. **Deferred:** renaming a registered check id is a breaking change to the `checks_run` literal every gate consumer pins, and the corpus-wide guarantee already exists in `check_pins` inside the precompute CLI — so this is a report-legibility question, not a coverage hole. **Owner:** whoever next changes the FR-15 gate's report format.

- **`spine.NAME_TO_ID_KEY` and `SHIRT_KEY_FOR_NAME` are keyed on name-key SPELLING, so a future extractor inventing a third spelling gets no id and no error from these tables alone.** The corpus uses four (`name`, `player_name`, `from_name`, `to_name`) and the spine maps each to its id spelling. A new domain staging, say, `athlete_name` would simply not be seen by `_add_ids`. **This is caught — by `assert_every_name_resolved`, which walks the finished spine and fails on any string equal to a known player name that has no id sibling** (pinned non-vacuous by `test_the_exhaustiveness_assertion_is_not_vacuous`), so the failure is loud rather than silent. Recorded because the *first* line of defence is a lookup table that a reader may mistake for exhaustive: it is the inverse assertion that is exhaustive, not the table. **Deferred:** no third spelling exists in the corpus today, and inventing a normalization layer for a shape nobody has produced would be guessing at its form — the inverse assertion already fails loudly if one appears, which is the safe order to learn about it. **Owner:** whoever adds the 26th name path.

- **`domains.match_metadata.score.shootout` is an unparsed prose string on the 4 shootout matches. Owner: Story 1.16.** Verbatim: `'(Paraguay win 3-4 on Penalties)'` (m074), `'(Morocco win 2-3 on Penalties)'` (m075), `'(Egypt win 2-4 on Penalties)'` (m088), `'(Switzerland win 4-3 on Penalties)'` (m096). The contract's `decidedBy` and `shootoutScore` both need it decomposed into a winner and a two-sided score, and the winning team is named by **printed team name inside the prose**, not by an id — so the decomposition also needs the team-name-to-id resolution this story now provides. 1.15 stages the string through unchanged: parsing it is emission-shaped work and belongs with the story that owns the knockout score shape. **Deferred:** `decidedBy` and `shootoutScore` are 1.16's emitted fields, so parsing here would produce a staged shape with no consumer and no schema to check it against.

- **Two Story 1.16 inputs re-confirmed here, neither changed by this story.** (a) `involvement` must be derived from the **pass matrix**, never from Domain G — the directive at `pipeline/README.md`'s involvement note stands, and the spine preserves both sources side by side without ranking them. (b) `PassNetworkNode` nodes must be emitted **`null`, never `[]`** — Story 1.14's binding, because Story 2.8 fails closed in both directions. The spine does not prune all-zero pass-network nodes: 43 exist corpus-wide (including M92 #14 Jordan HENDERSON, M11 #19 Brian BROBBEY, M88 #1 Mathew RYAN and M102 #15 Dan BURN), every one carries a resolved `player_id`, and a spine that dropped them would silently change what 1.16 emits. **Deferred:** both are constraints ON Story 1.16's emission, not work this story can do — 1.15 owes them only a spine that preserves the inputs, which it does. **Owner:** Story 1.16.

- **The story's Dev Notes claim that at least eight team codes are "not derivable from the printed name" is right in its ruling and wrong in two of its examples, corrected here so the next reader does not re-derive it.** Measured over all 48: **six** codes carry a letter their team's own slug does not contain — `cpv` (cabo-verde), `cuw` (curacao), `mar` (morocco), `ksa` (saudi-arabia), `esp` (spain), `sui` (switzerland). The story's parentheticals for the other two are factually wrong: `rsa` for `south-africa` and `cod` for `congo-dr` contain **no** letter absent from their names (South Africa does contain an `r`; Congo DR contains `c`, `o` and `d`). **The ruling is unaffected and is in fact over-determined** — no first-three-letters rule produces `rsa` (`sou`) or `cod` (`con`) either, so a committed lookup is still mandatory and no derivation rule exists. Both facts are pinned by `test_at_least_six_committed_codes_are_not_derivable_from_the_team_name`, which asserts the six-letter cases and the `rsa`/`cod` first-three failures separately, so neither claim can drift back. **Deferred:** nothing is left to do in code — the correction is recorded so the next reader does not re-derive a wrong count from the story's Dev Notes, which are frozen. **Owner:** none; recorded for the record.

- **The Extraction Record's top-level `metadata` block is NOT the near-exact `ReportMeta` serialization the Dev Notes describe: it carries no `report_id` and no `source_path`, and it carries an extra `match_number`.** Story 1.15's matchday-round derivation is the one place `metadata` is authoritative over `domains.match_metadata` (it is the only side carrying `stage_text`, an uppercase `group` and the `"H:MM"` kickoff `ReportMeta.kickoff_sort_key` requires), so reconstructing the dataclass is on its critical path. `identity.matchday_rounds` therefore takes `report_id` from the record's **top level** and `source_path` from `source_pdf`. Recorded because the Dev Notes' wording would send the next reader looking for two keys that are not there, and the failure mode is a `KeyError` at the top of a 104-record walk. **Deferred:** `matchday_rounds` already reads both keys from where they actually live and now names the absent ones in a typed `PrecomputeError` (Story 1.15 code review), so nothing is broken — what remains is the Dev Notes' wording, which is frozen. **Owner:** whoever next reconstructs a `ReportMeta` from a staged record.

## Deferred from: code review of 1-15-cross-match-identity-resolution-normalized-spine (2026-08-03)

- ~~**`pipeline/README.md` as committed at `32fc131` documents Story 1.9's involvement-clock work, not Story 1.15's.**~~ — **RESOLVED by Story 1.9 (2026-08-03): `325dc2b` committed `pipeline/extract/domain_e.py` with `goalkeeping-involvement-clock` registered, so the README's eighth Self-Validation id is now backed by committed code and the documentation-ahead-of-code window closed exactly as predicted below. Recorded rather than deleted, because the window was real: between `32fc131` and `325dc2b` the repository documented a check it did not register.** ~50 lines under "The chart's TIME axis — slot -> match clock" describe the `involvement_clock` staging, the `45HT` merged-span reading and `PMSR-M88-AUS-V-EGY`'s 14-slot extra period, and the Self-Validation inventory goes `Seven ids` -> `Eight ids` with a `goalkeeping-involvement-clock` row. `pipeline/validate/checks.py:1502` likewise carries ~6 lines of 1.9's `InvolvementChartError` vs `InvolvementClockError` docstring wording. **None of it is backed by committed code** — the registering module `pipeline/extract/domain_e.py` (+602 lines) was still uncommitted in the working tree at the time of the commit, so the README documents a Self-Validation id the pipeline does not register. **Deferred:** knowingly declared in `32fc131`'s commit message under `COMMIT SCOPE` as the lesser of two evils — omitting `checks.py` would have committed a 29-check `checks_run` registry against a file registering 27 — and it self-resolves the moment Story 1.9's implementation lands. Owner: Story 1.9.

## Deferred from: code review of 1-9-domains-e-f-extraction-goalkeeping-set-plays — Decision 3 (2026-08-03)

- **`domain_e_checks` reads its own payload by bare subscript throughout, so a record staged by an older checkout raises `KeyError` rather than failing as a typed error.** Raised against Decision 3's `block["involvement_clock"]` (`pipeline/extract/domain_e.py`), and true of it — but equally true of `payload[side]["distribution"]`, `["goal_prevention"]`, `["aerial"]` and every other key the function reads, all of which predate this change. `RECORD_VERSION` exists by its own docstring for "a record written by an older checkout, restored from a backup, or produced by hand", and today `code_version()` covers records produced by this checkout, which is why nothing has hit it. **Reclassified from patch to deferred during the review**: guarding one key and not the other seven would be inconsistent noise, and the correct fix — a record-shape guard at the top of `domain_e_checks`, or a `RECORD_VERSION` bump with a real migration path — is a module-wide ruling this story did not take. Owner: whoever next touches the record-version contract (Story 1.16 is the natural point, since it is the first consumer that reads staged records it did not write).

## Filed by Story 2.9 implementation (receiving & defensive-action surfaces, heatmap decision, 2026-08-03)

**Every entry below is APPENDED. Nothing above this heading was edited** — two pipeline sessions (1.9, 1.15) held this file open concurrently, and Task 8.7's "correct in place" is served here by an appended correction rather than by rewriting another story's paragraph, which is the safer reading of the same task's own APPEND-ONLY rule.

- **UX-DR10's hollow-diamond / filled-diamond encoding has NO SURFACE, and the ruling that removed it also raises a second, narrower UX question. Route both to UX as ONE decision. Owner: UX.** DESIGN.md:282 assigns hollow diamond = offer to receive and filled diamond = movement to receive, under its own flag — `[ASSUMPTION: shape assignments proposed; the source PDF renders these families as distinct marker glyphs]`. **Story 1.13 falsified exactly that assumption**: `ReceivingEvent` is unfulfillable in every one of its eight required fields over 104 reports / 416 pages, the "Offering to Receive" panel is 11 filled circles byte-identical between panels on 208/208 team-innings (a static formation template), and the "Movement to Receive" panel carries zero markers at all. So neither diamond has a mark to encode. `MarkerShape` therefore gains exactly one member, `triangle-filled`, and the two diamonds are deliberately **not** added (2.9 ruled decision 6): an unused member of a closed union, carrying a legend swatch nobody renders, is dead code. Re-adding them later is trivially safe — `MarkerShapeGlyph`'s `default` branch assigns to `const unexpected: never`, so a future member without a case is a compile error, not a silent gap. **The second question, which only exists because of the first:** on `#defensive-actions` the two plottable action types (`forced-turnover`, `possession-regain`) are **visually identical** — one shape, one colour per team — so the legend is one entry per team (2.9 ruled decision 19) and the type reaches the reader only through the accessible name, the popover and the log column. Whether those two deserve a second visual channel is a UX call this story does not have; ruling it alongside the diamonds keeps one decision instead of two. **Deferred:** both halves are UX rulings about an encoding whose data does not exist yet.

- **The 2.9 re-scope itself: what `#offers-to-receive` and `#movement-to-receive` now read, and what the successor change-set would need. Owner: Story 1.16.** Both sections read `bundle.players[].inPossession` — `totalOffers`, `offersReceived` and the six-value `offersByMovementType` split, all three `required` in the contract, extracted by Story 1.10, present in all three fixtures — and they are **aggregate card surfaces, not maps**. `events.receiving` is read by nothing in `app/` any more; the `sectionDataState` predicate for both ids moved to `bundle.players !== null` (2.9 ruled decision 3). **The richer alternative was evaluated and rejected as this story's dependency, not on quality:** Story 1.13's `domains.receiving` aggregates (per-third, per-shape, `most_offers`, the 15-cell grid, `top_ranked_players`) are real and complete on 208/208 team-innings, but they live **only** in `work/extracted/`, which is gitignored, they have **no contracted destination** (`EventTables.required` is seven flat event arrays), and reaching them needs an AD-14 change plus a 1.16 emission path that does not exist. They remain the **successor change-set candidate** — never CS-1. **Deferred:** blocked on a contract change and an emission path, neither of which 2.9 can take.

- **THE HEATMAP IS DEFERRED, with the rationale logged. This is AC 2's deliverable, ruled by Juan, and the trigger to re-open it is named. Owner: Story 1.16.** Evaluated against the fixtures and the tokens, not skipped. **(a) The ramp is ready and unused:** `--heat-1..5` ship in the theme-invariant `:root` block with Tailwind bridges and **zero consumers** anywhere in `app/src`. **(b) Its published properties hold:** computed relative luminance `0.2668 / 0.3659 / 0.4619 / 0.6454 / 0.8857` — strictly monotonic, every step at least 1.23x — reproducing DESIGN.md:286's stated `0.267 -> 0.886`; contrast vs `--pitch-surface` `3.68 / 4.83 / 5.95 / 8.08 / 10.87`, reproducing DESIGN.md:286 **exactly**; vs `--pitch-stripe` `3.26 / 4.28 / 5.27 / 7.15 / 9.63`, so the lowest stop clears 3:1 on the stripe too — a figure DESIGN does not state. **(c) What is missing is an INPUT, not a ramp.** Every candidate Domain D family is under an unresolved AD-14 emission blocker: `ReceivingEvent` (unfulfillable entirely), `CrossEvent` (four required fields), `DefensiveActionEvent` (four required fields). A heatmap built now would bin **synthetic fixture coordinates** and would have no real input at the 2.19 cutover. **(d) The zone-grid schema is an open assumption** — `EXPERIENCE.md:113`'s "pitch third x channel, intensity % per zone" carries `[ASSUMPTION: zone-grid schema]` and `ARCHITECTURE-SPINE.md:234` defers the shape outright; ruling it is a UX call. **(e) AD-5's "exactly one surface" clause needs a profile/comparison decision 2.9 cannot take alone.** **(f) A WARNING for whoever builds it:** if a heatmap swatch ever renders on a card it must **not** use these tokens bare — measured on the light `--surface-raised`, `heat-4` is **1.51:1** and `heat-5` **1.12:1**. On-pitch only, exactly as DESIGN.md:282 states. **No AD-14 change request is filed and `/contract` is untouched.** **Re-open at Story 1.16**, whose emission decides whether any Domain D family reaches the App with real coordinates.

- **RULED: the one-ended goal furniture SHOULD be mirrored at the defending end. The ruling is 2.9's; the implementation is not, and that boundary is deliberate.** This closes the two ledger entries above that route the question to 2.9 by name (grep `"Whoever owns the next full-pitch surface"` and `"should rule it"` — both ask 2.9 to **rule** it, not to build it). Confirmed live on all three fixtures: defensive-action `x` spans 8.3-64.3, so `pitchExtentFor` returns `{xMin: 0}` on its own and every `#defensive-actions` figure is a full pitch with a bare defending half. **Why the implementation is routed onward rather than done here:** `pitchMarkings` returns a **flat single-valued record** whose fields `PitchDrawing` renders **by name**, so mirroring needs new fields on the `PitchMarkings` interface **and** new elements inside `PitchPanel` — which collides head-on with 2.9's "one switch case, additive only" boundary on that file and with `pitch-geometry.ts` being on its do-not-touch list. It also needs **two non-projective steps**: the `goal` depth offset is direction-dependent **px**, so it must be reversed by hand rather than projected, and `penaltyArc`'s angle range must be **reflected**, not projected. And it would **visibly change Story 2.8's already-shipped pass-network figures**, which would need re-verifying. **Owner:** whichever story next owns `pitch-geometry.ts` and `PitchPanel.tsx` together, or 2.19.

- **The whole-layer error boundary, re-filed with Story 2.9's added blast radius.** Pre-existing architecture (grep `"kills all eleven Tactical sections"`): `TacticalErrorBoundary` wraps `<TacticalLayer>` whole, there is no per-section boundary anywhere, and a throw from any viz model replaces all eleven sections with one crashed panel. **2.9 adds three more eager-throw surfaces behind that single boundary, on the densest marker family in the project** — corpus defensive actions run min 62 / median 97 / **max 153** markers per team figure over 208 team-innings, against the pass network's 11 — plus two aggregate surfaces that walk **every** player row on load. Every 2.9 entry point is guarded for `null` and `[]` and tested for it (an empty `players` array, a team with no rows, an empty `defensiveActions` array, and a constructed `totalOffers: 0` row that no fixture carries), and the only remaining throw is `resolveSide` on a teamId matching neither side — which is fail-loud **by design**, because a silent drop would under-count a team total this story then prints as that team's own headline. **Deferred:** the boundary itself is not 2.9's to build. **Owner:** whichever story next touches `MatchBundleRegion` / `TacticalSection`, or 2.19.

- **Story 2.11's receiving-log AC is UNBUILDABLE and needs the same re-scope 2.9 took. Owner: Story 2.11.** `epics.md:848` and `EXPERIENCE.md:207` both require a **receiving log** in the Expert Layer, and `EXPERIENCE.md:221` specifies its columns as "player, minute, coordinates, type". **There are no receiving events**: `ReceivingEvent` is unfulfillable in all eight required fields, so none of those four columns has a source. 2.9's receiving data tables are **aggregate** tables instead (a team-totals row plus a per-player breakdown, ordered by team then shirt number, with their own caption keys — `viz.table.caption`'s "Ordenado por minuto." would be a false claim on clock-less rows). **And the defensive-actions log 2.11 inherits will carry no player and no minute on real data:** `playerId`/`playerName`/`at` have no carrier in the corpus, and `contest_type` is null on 20,169/20,169, so 2.9 gates that whole column on `anyContestType(rows)` (the FD-1 `showXg` precedent). 2.11 owns `aria-sort`, the `Intl.Collator('es')` sort and the Expert-layer instance of these same logs; it should plan for a log whose Player and Minute columns are entirely em dashes and whose Contest Type column does not exist.

- **CORRECTION, appended rather than edited in place: the ledger's prediction that "Story 2.9 will do the same" is FALSIFIED.** The entry at grep `"are now used POSITIONALLY as a generic middle clause"` records that `PitchPanel.markerName()` always renders three clauses and that Story 2.8 fills the middle one with a *value* clause ("participación 80 pases y 6 conexiones") rather than a clock — then predicts 2.9 will repeat the overload. **It does not.** `DefensiveActionEvent.at` is a real `MinuteStamp` in the contract, so `#defensive-actions` uses `minutePrefixKey` / `minuteLabel` for their actual purpose: `viz.defensiveActions.minutePrefix` plus a `formatGoalMinute` stamp, degrading to the spoken `viz.marker.unknownMinute` when `at` is absent (which is the corpus-real case, and is pinned by a constructed test). The two receiving sections never touch `PitchMarker` at all. **The rename to `valuePrefixKey` / `valueLabel` remains open and remains routed to whoever next touches all five files** — 2.9 touched only `marker-model.ts` (one union member, two exports), so it is not that story.

- **`#defensive-actions` legends are ONE PER TEAM, not one per type — so 1.16's emission must not be read as incomplete when only two action types appear.** Two of the four `DefensiveActionType` values are unpopulatable from the source (grep `"only two of four"`): `block` and `possession-contest` are aggregate panels with **no coordinates anywhere in the corpus**, so `events.defensiveActions` can only ever carry `forced-turnover` and `possession-regain`. All four codes are nonetheless **labelled** in both locales (`enums.defensiveAction.*`) because the log table and any future emission may carry them, and an unlabelled row is worse than an unreachable label. The count chip carries the **total only** — a declared reading of 2.9 ruled decision 5's "enumerate only the types actually present": enumerating them beside a legend that deliberately refuses to distinguish them (decision 19) would re-introduce the very distinction the map does not draw. **Recorded so a reviewer of 1.16's output does not read a two-type corpus as a truncated extraction.**

- **MEASURED, and it changes how `#defensive-actions` behaves at real density: at corpus scale the map collapses into a single cluster on a phone.** 2.9 Task 9.1 ran the shipped pure functions over all three fixtures at 320 / 386 / 527 / 768 / 1920 px. **The dialog path dominates at every shipped width below 1920** — singleton share 0-42% at 320/386, 41-74% at 527, 31-70% at 768, and only 90-100% at 1920 — which is the opposite of Story 2.8's decision-6a premise and consistent with that premise having been falsified. **The 44 px hit floor is never breached**: the smallest cluster hit-union measures ~59-131 px across at every width and fixture. **At corpus density it degenerates:** re-run at 153 markers (the corpus max per team-inning; fixtures carry only 30-59), the whole figure resolves to **ONE cluster at 320 px**, 5 clusters at 386, 8-9 at 527/768 and 31 at 1920, with **zero singletons at any width**. So on a phone at real data the surface is effectively a 153-item cluster dialog rather than a map. It remains usable — `ClusterPopover` clamps its height to the space available and scrolls internally — but nobody should be surprised by it, and a density treatment (declutter control, zoom, or per-type filtering) is a UX call. **Owner:** Story 2.19 (real-data swap) is where this first becomes visible with real coordinates.

## Deferred from: code review of 2-9-receiving-defensive-action-maps-heatmap-decision (2026-08-03)

Four items surfaced by the 2.9 adversarial review and triaged as pre-existing rather than
introduced by this story. All four are consequences the story either already ruled or already
measured; they are re-filed here with the added blast radius `#defensive-actions` contributes.

- **The full pitch has no goal furniture at the end where every marker lands.** `pitchMarkings`
  (`app/src/viz/pitch-geometry.ts:266-307`) builds `penaltyArea`, `sixYardBox`, `penaltySpot`,
  `penaltyArc` and `goal` unconditionally at the **x=100** end only; the `isFullPitch` branch
  (`:322-326`) adds only halfway line, centre circle and centre spot. Defensive actions concentrate
  in the acting team's own half — measured x span 8.3–64.3 — so effectively the **entire** marker
  population sits in a bare striped rectangle with no goal, no box and no spot to read position
  against. This is a sharper consequence than Story 2.8's pass networks, whose nodes span 20–80 so
  half the data still lands on marked geometry. **Already ruled by 2.9's decision 9 ("yes, mirror
  it") and routed onward by Task 8.4** with its three implementation notes; this entry records that
  `#defensive-actions` is now the surface where the omission bites hardest.
  **Owner:** whichever story next owns `pitch-geometry.ts` and `PitchPanel.tsx` together, or 2.19.

- **Clustering collapses at corpus marker density, and `PitchPanel`'s documented budget is now
  exceeded.** `clusterMarkers` (`app/src/viz/marker-layout.ts:115-180`) is single-link at
  `MIN_HIT_PX = 44`. `#defensive-actions` carries 62 / 97 / 153 markers per team figure (min /
  median / max over 208 corpus team-innings) against the fixtures' 30–59, while
  `PitchPanel.tsx:376-379` explicitly budgets for "at most ~120 markers per panel (m074's 72
  crosses is the fixture worst case)". Task 9.1 measured the consequence and it is already filed:
  the dialog path dominates at every shipped width below 1920, and at 153 markers the figure
  collapses to **one cluster at 320 px** with zero singletons anywhere. Re-filed here because the
  ceiling in `PitchPanel`'s own comment is now stale and should be corrected when someone next
  touches that file.
  **Deferred:** the cluster algorithm is shared by three shipped surfaces; changing it is not a
  2.9-scoped change. **Owner:** 2.19 (real-data cutover), where corpus density arrives for real.

- **Cluster popover copy over-claims at high density.** `PitchPanel.tsx:966,972` render "Punto con
  N eventos" and an accessible name of "Eventos en este punto". A cluster produced by a transitive
  44 px chain can span most of the pitch, and its popover anchors at the arithmetic centroid of its
  members — typically a location where no event occurred. So both strings describe a point that is
  not where the events are. Pre-existing `PitchPanel` copy, not introduced by 2.9, but 2.9 is the
  first surface dense enough to make it routinely false.
  **Owner:** same as the clustering entry above.

- **Marker and row models are rebuilt on every render, forcing a full re-cluster.**
  `DefensiveActionsSection.tsx:129-140` computes `defensiveMarkers` and `defensiveRows` eagerly with
  no `useMemo`, and the `sides` array literal is fresh each render, so `PitchPanel`'s extent memo
  (`:1078-1081`, keyed on `[sides]`) and `PitchFigure`'s layout memo (`:380-409`, keyed on
  `markers`) both invalidate on every `TacticalLayer` state change — re-running an O(n²) pairwise
  cluster pass plus a Delaunay build, twice. `ShotMapsSection` and `PassNetworksSection` skip
  memoisation the same way, so this is a **house-wide convention**, not a 2.9 defect — but
  `#defensive-actions` is the first consumer sitting near the documented marker ceiling while doing
  the work most often. Note the interaction with the eager-build rule (decision 10): eager
  construction is required and correct; memoising it does not conflict with that.
  **Deferred:** fixing it in one section only would make the three PitchPanel consumers diverge.
  **Owner:** whoever standardises memoisation across the three PitchPanel sections, or 2.11.

### Filed by the Story 2.9 code review — the defensive-marker announcement collapse

- **On corpus-real data every `#defensive-actions` marker announces the SAME sentence.** The
  three-clause accessible name (`PitchPanel`'s `markerName` contract) is
  "Acción defensiva de {player}, minuto {clock}, {action type}". `playerId`, `playerName` and `at`
  have **no carrier at all** in the corpus (open AD-14 emission blocker), so `subjectName` and
  `minuteLabel` are both null on every row and the name degrades to
  **"Acción defensiva de jugador desconocido, minuto desconocido, Recuperación de balón"** — the
  same string for every marker of a given type. At corpus density that is **~97 identical
  announcements per team figure** (median; 153 at the max), so a keyboard reader roving the tabindex
  has nothing to tell one triangle from another, and every popover shows the same four rows.
  Only two of the four `DefensiveActionType` values are plottable, so in practice there are **two**
  distinct announcements on a whole figure.
  **Ruled at code review:** accept the degradation and do NOT adopt Story 2.8's positional overload
  of `minutePrefixKey`/`minuteLabel`. The announcement is *honest* — it states exactly the absence
  that is real — and inventing a positional disambiguator is a UX call Story 2.9 does not have; it
  would also repeat the naming drift this ledger already routes for a rename. Story 2.9's Task 3.3
  comment justifying the middle clause ("these events **do** carry a real clock in the contract")
  was **false** and has been corrected in place at `defensive-actions-model.ts` — the contract
  declares a clock, the corpus carries none, which is why `minuteLabelOf` exists.
  **Owner: Story 1.16**, whose emission decides whether `playerName` and `at` ever get a carrier. If
  they do, this resolves itself with no code change. If they do not, the disambiguator becomes a
  real UX question and should be ruled alongside the diamond/second-visual-channel question already
  filed by Task 8.1.

## Filed by Story 2.10 — the four closing Tactical sections (#phases, #pressing, #set-plays, #goalkeeping)

Story 2.10 closes the Tactical Layer at eleven of eleven. Everything below was measured at story
creation over the **104 staged Extraction Records in `work/extracted/`** (208 team-innings), the
three committed fixtures and the committed schemas, and re-derived during implementation wherever
the App depends on it. `work/extracted/` is gitignored staging — evidence to re-measure, never a
source the App may read.

- **AD-14 (d) UNDERSTATED THE `#goalkeeping` RE-SCOPE, and the App has now shipped against the
  larger version.** The recorded notice covered the per-keeper/per-team mismatch. It did **not**
  record that **FIVE contract-REQUIRED sub-blocks are `null` on 208/208 team-innings**:
  `distribution.feetTechniques`, `distribution.handsTechniques`, `distribution.throwTechniques`,
  `goalPrevention.byBodyType`, `aerialControl.crossesFacedCompleted`. They are raster donut-slice
  labels and an unvalidatable marker colour (1.9, AD-14 (c)). **The fixtures populate all five**,
  because `data/fixtures/README.md` files Domain E goalkeeping as Synthetic *"in full"* — so the
  surface a developer sees in dev is **not** the surface that ships at the 2.19 cutover.
  **What the App did.** (1) `#goalkeeping` renders **one block per TEAM**, ordered from
  `metadata.homeTeam`/`awayTeam` and never from array order, with the keeper name(s) as **context**;
  the **two-keeper case** (7 of 208 team-innings: M21 home, M41 away, M53 away, M62 away, M66 home,
  M88 home, M98 away) renders **both records stacked and separately labelled, with nothing summed
  across them** (AD-5). (2) The five fields are **presence-gated** through a single widened view
  type, `CorpusNullableGoalkeeperRecord` in `app/src/viz/goalkeeping-model.ts`, cast **once** at the
  model's entry point — a closed gate **omits its panel entirely**, never renders em dashes, and the
  team block states **once** that it did so (`viz.goalkeeping.gateNote`), because silent absence at
  panel granularity is what FR-22 forbids. The surface therefore degrades to the corpus-real field
  set with **no code change and no permanently-empty panel**.
  **Owner: Story 1.16**, which cannot emit any of the five and **must not read their absence as an
  extraction defect**. Either the schema marks them nullable (and the widened view collapses to a
  re-export) or extraction starts filling them (and the gates go permanently open). Rides the
  **successor** change-set, never CS-1.

- **`lineHeight` / `teamLength` now RENDER in `#pressing` with no defined provenance.** This
  **extends the 1.7 entry above** (grep `"the line-height/team-length pages are per-phase panels"`)
  with the App-side consequence rather than restating it: the four contracted values per team are
  drawn as two per-team blocks, exactly as the contract names them, with **no invented aggregation,
  no third measure, and no copy claiming which phase they describe** — the surface states only that
  *"El informe no define a qué fase del juego corresponden estas distancias."*
  Re-derived at implementation: the metres are the **only** part of Domain C with no real
  counterpart. `data/fixtures/README.md` lists *"All of Domain C phase percentages"* under Real and
  nothing else from Domain C; the corpus prints **three panels per possession state with three
  measures each**, including **`team_width`, unmodelled by the contract**; and `m001` home
  in-possession staged `line_height` is **19 / 39 / 54** against the fixture's single **44.4**,
  matching no panel and no mean of them. Corpus ranges: `line_height` 10–71 m, `team_length`
  13–51 m, `team_width` 28–60 m.
  **Owner: Story 1.16** (the aggregation rule). **When it rules, this presentation is deleted or
  re-shaped** — `metreRows`' docblock in `app/src/viz/phases-model.ts` carries that binding.

- **The contract's `FreeKickCounts` `description` is CORPUS-FALSE on 208/208 and needs correcting
  in the successor change-set.** It asserts *"directOnTarget and directOffTarget are subdivisions of
  direct, so direct == directOnTarget + directOffTarget (holds across all six fixture
  team-innings)"*. The parenthesis is true and the claim is false: measured over 208 corpus
  team-innings the relation holds on **0**, and **160** of them have `on + off == 0` while
  `direct > 0`. Corner delivery **STYLE** is the second false partition — it sums to `totalCorners`
  on only **96 / 208** (112 under, never over) while holding 6/6 in the fixtures.
  **Recorded so a later reader does not over-correct**, these relations ARE corpus-true 208/208:
  `direct + indirect == totalFreeKicks`; `sum(cornersByDeliveryType[*].total) == totalCorners`;
  `left + right == total` per type and overall; and
  `totalSetPlays == freeKicks + corners + throwIns + penalties`.
  **What the App did.** The four free-kick values render as **flat siblings with no containment cue
  of any kind — no stack, no segmented bar, and specifically no indentation**, since indentation is
  the most conventional visual assertion of containment there is and would smuggle the banned claim
  back in. Corner **STYLE** renders as four independent labelled counts. Corner **TYPE** and corner
  **SIDE** are drawn as parts of `totalCorners`, with the bar's denominator taken from the **sum of
  its own rendered segments** while `totalCorners` is printed verbatim beside it; when the two
  disagree the surface shows both and normalizes neither (AD-6). The side split is read from the
  **precomputed `cornersBySide`**, never by adding the three per-type numbers
  (`contract/README.md` §14). `set-plays-model.test.ts` pins BOTH halves — that the fixtures satisfy
  the two false relations 6/6, and the corpus figures that make them false — so a later reader
  cannot "fix" the surface back to a stacked chart by looking at a dev server.
  **`/contract` was NOT edited by this story.** **Owner:** the successor change-set, **never CS-1**.

- **`GoalkeeperInvolvementSample.minute` CANNOT REPRESENT THE CORPUS CLOCK — filed as a BLOCKER for
  Story 2.19's real-data cutover, not as an open note.** It is a bare `Minute` (0–120) with **no
  stoppage field**, while the corpus draws **95–145 slots per team-inning** (min 95, median 102,
  max 145) and puts **2,506 of 21,764 slots in stoppage time** — so minutes are **not unique** on
  real data. This is exactly what Story 1.8 already fixed for `MomentumSample.at` by making it a
  `MinuteStamp`, and exactly what invalidated Story 2.6's original slider AC. The fixtures hide it
  completely: 19 or 25 evenly-spaced, minute-unique slots that also sum exactly to
  `totalInvolvements`.
  **Why a blocker and not a note:** the upstream data already exists (grep
  `"The involvement clock's stamps are staged per slot"`), `MinuteStamp` already exists in the
  contract, and only the emit-boundary type is missing. It is the difference between a truthful axis
  and a misleading one.
  **No App change is owed when it lands.** Story 2.10 already indexes the timeline by **sample
  index**, treats the minute as a label, dedupes repeated tick labels by value with first occurrence
  winning, and states the axis's meaning on the surface and in the figure summary. **Owner:** the
  successor change-set.

- **DECLARED DEPARTURE FROM UX-DR7: no leader treatment on any Story 2.10 surface. Needs a UX
  ruling.** No ▲ / «líder» appears in `#phases`, `#pressing`, `#set-plays` or `#goalkeeping`, and
  `resolveLeader` is neither imported nor re-implemented in any of them.
  **The reasoning is STRUCTURAL, not semantic, and that distinction matters** — the semantic
  argument ("higher carries no meaning for a rate or a distance") is **false by shipped precedent**:
  Story 2.9 applies `resolveLeader` to `offersMade` with the glyph and the spoken «líder», and
  `KeyStatisticsSection` applies it across a block containing `forcedTurnovers` and `crosses`, every
  bit as directionless as *"saques de banda 21 vs 26"*. The real reason is that **no head-to-head
  TILE SHAPE exists in this story**: UX-DR7 and DESIGN's component spec both scope the treatment to
  the *stat tile* — two values facing each other across a centred label — and there is no shared
  `StatTile` to inherit it from (`KeyStatisticsSection`'s is private). Story 2.10 made that true
  rather than asserting it: every two-team value renders as **two per-team blocks in a responsive
  grid**, including `#pressing`'s four metre values, which are the one place the story would
  otherwise have built the very shape it claims does not exist.
  **The narrow question for UX:** *should a per-team block pair carry the leader treatment that the
  stat tile carries?* **Owner: UX.**

- **`#phases` and `#pressing` DELIBERATELY DUPLICATE SEVEN of the nine out-of-possession rates.**
  `#phases` renders all 17 phase rates (the Phases of Play page verbatim); `#pressing` renders the
  four press rates **plus** `defensiveBlockDistribution` **plus** the four metre values.
  **Why, so a reviewer does not read it as an error and 2.16 does not re-derive it.** The first
  draft gave `#pressing` only the blocks and the metres, which ships a section whose **shipped,
  frozen copy is false**: `tactical.sections.pressing` reads *"Presión y bloques defensivos"* /
  *"Altura de la línea defensiva e **intensidad de la presión**."* — and that summary is also the
  **`<lg` collapsed-shell copy** (`key-match-dashboard-mobile.html:350-353`), so a phone reader
  hunting press intensity opens `#pressing` first and would have found neither the press rates nor
  any hint they lived elsewhere. The duplication rides the argument the contract already makes for
  the blocks: `DefensiveBlockDistribution`'s `$comment` names this story — *"They are surfaced again
  here because Story 2.10's `#pressing` section renders block height as its own concept."* The
  source keeps `high-press` and `high-block` as **separate enum values**, so no reading collapses
  them. Nothing is recomputed: both sections read the same contract fields and print the same
  numbers, pinned by a test.
  **Owner: Story 2.16** (Team Profile renders the same Domain C block and inherits this ruling).

- **The whole-layer error boundary now has its FULL blast radius, and it is still unpatched.**
  Re-filed with Story 2.10's contribution (the original entry is above — grep
  `"kills all eleven Tactical sections"`). There is **exactly one** `TacticalErrorBoundary`, in
  `MatchBundleRegion.tsx`, wrapping all eleven sections with no per-section boundary anywhere. Story
  2.10 adds **four more surfaces** behind it over **the deepest object graph in the contract**
  (`GoalkeeperRecord` alone is 8 required fields across 5 nested objects), and — because all eleven
  sections now render real content rather than pending shells — **the blast radius is finally
  complete** rather than partly shells: any single model throw replaces the entire Tactical Layer
  with one crashed panel.
  Story 2.10 mitigated within its own scope (every model entry point returns early on an absent or
  zero-length slice, each guarded by its own test: `goalkeeping: []`, records for one team only, two
  records for one team, an empty `involvementTimeline`, `attemptsFaced: 0`, `totalCorners: 0`, and
  every set-play total at 0) but **did not build the boundary** — pre-existing architecture, and
  fixing it in one story's sections only would make the eleven diverge. **Owner:** unchanged.

- **`PendingSectionPanel` and the `tactical.pending.*` keys now have ZERO CALL SITES.** Story 2.10
  replaced the last four fall-throughs, so every `SectionId` dispatches to a real component. The
  now-orphaned import binding was deleted from `TacticalLayer.tsx` in the same edit — worth
  recording that **nothing in the build chain catches a dead import**:
  `@typescript-eslint/no-unused-vars` is not in the flat config's active set and `tsconfig.json`
  sets no `noUnusedLocals`, so `eslint --max-warnings 0` exits 0 on one (Story 2.9 shipped dead
  bindings and took a review finding for it).
  **The component and its locale keys were deliberately KEPT.** `EmptyStatePanel.tsx` is outside
  Story 2.10's touch list, the Expert Layer may want the same shell, and deleting live locale keys
  is a change three exhaustiveness tests would have to be reasoned about.
  **Owner: Story 2.11** — keep or delete.

- **NULLABILITY ASYMMETRY across the four sections, proved by building them.** `goalkeeping` and
  `players` are nullable; `tacticalIdentity` and `setPlays` are **required, non-nullable objects**.
  So FR-22's *"explicit empty state names what's absent"* is **structurally reachable for only one**
  of Story 2.10's four sections: a report lacking the Domain C or F pages fails the **whole report**
  under AD-8, so the reader loses the entire match rather than seeing a named empty section. The
  `#phases` / `#pressing` / `#set-plays` empty branches are therefore unreachable at contract v2
  except through a truncated `as`-cast payload — which is exactly what the existing
  `sectionDataState` predicate exists to catch, and which Story 2.10 pinned with assertions rather
  than changing any predicate (`tactical-sections.ts` itself is **unchanged** by this story).
  **Empirically moot** — 208/208 team-innings carry both — which is why this is a note and not a
  blocker. **Owner:** contract / **Story 1.16**.

- **The Team B non-hue channel SHIPPED AS A DIAGONAL HATCH, not the declared dashed-stroke
  fallback — and here is the evidence that decided it.** Stories 2.13 / 2.15 / 2.16 / 2.17 will all
  face the same choice, and this is the project's **first** SVG `<defs>` / `<pattern>` / `url(#…)`
  reference, so there was no precedent to copy.
  **What ships:** a 6 px diagonal-hatch `<pattern>` — a **solid `--viz-team-b` ground** with a
  1.5 px `--ink-primary` stripe — plus a solid `--viz-team-b` stroke on the bar. Team A is a plain
  solid fill. UX-DR11's first channel is the direct team-code label at the end of each series'
  longest bar (never a legend).
  **Measured live on `--surface-raised`, method validated first by reproducing published figures
  (the Story 2.6 method):** `--viz-team-a` **13.56** dark / **4.99** light and `--viz-team-b`
  **10.30** / **5.36**, all four matching the published values exactly before any new number was
  trusted. The two accents against **each other** are **1.07:1** light, which is why a second
  channel is mandatory at all.
  **The one number that needed a ruling:** the hatch STRIPE against its own team-b GROUND measures
  **3.30 light but only 1.53 dark**. That does **not** trigger decision 10(b)'s forced fallback,
  and the decision says why in its own words: with the hatch drawn over a *solid* ground rather than
  transparent gaps, "the measured solid figures … govern, and the hatch only adds texture". WCAG
  1.4.11's 3:1 non-text floor applies to the mark against its background — **10.30 / 5.36**, which
  passes in both themes — not to a mark's internal texture. The remaining test was therefore the
  legibility one, made in the browser as ruled: **the hatch is clearly legible in both themes and
  still legible at 320 px**, including on the shortest bars, where it remains distinguishable from
  Team A's solid fill.
  **Recorded for the next story rather than left implicit:** a card-coloured stripe would raise the
  texture contrast to 10.30 / 5.36 but is exactly the "transparent gaps" case decision 10(b) bans
  by name, and the declared dashed-stroke fallback **cannot work on a filled bar at all** — a dashed
  `--viz-team-b` stroke over a solid `--viz-team-b` fill is invisible, which is the same observation
  that made the hatch necessary in the first place ("MomentumChart discharges the same rule with
  `TEAM_B_DASH_ARRAY` on a stroke, which a filled bar cannot use"). So for BARS the fallback as
  written is not available, and a future story that needs one should rule a new mechanism rather
  than reach for it. **Owner:** whichever of 2.13 / 2.15 / 2.16 / 2.17 lands first.

- **Adding the second recharts importer DUPLICATED the recharts vendor chunk rather than sharing
  it.** Measured on the built export: recharts appears in four chunks — two vendor chunks of
  **300.4 KB each** (uncompressed) that carry the same recharts internals (`CartesianAxis`,
  `ResponsiveContainer`, `ReferenceDot`, `LabelList` each present in both), plus the two small
  leaves themselves, `MomentumChart` at **47.2 KB** and `TacticalCharts` at **34.5 KB**.
  **The code-split itself is intact and that was the requirement:** none of the four chunks is
  referenced by the match page's initial HTML, whose 15 initial chunks total **855 KB**
  uncompressed. Story 2.10's `import type`-only rule held.
  **But a reader who expands both `#momentum` and `#phases` now downloads recharts twice.** Turbopack
  produced one vendor chunk per `dynamic()` entry point instead of a shared one. Not fixed here:
  the obvious remedy is a single shared re-export module that both leaves import, which means
  touching `MomentumChart.tsx` / `MomentumSection.tsx` — both on Story 2.10's do-not-touch list —
  and it is a bundling decision worth making once, for all of 2.13 / 2.15 / 2.16 / 2.17, rather
  than in the story that first noticed it.
  **Owner:** whoever owns the bundle budget for the remaining recharts stories.

## Deferred from: code review of 2-10-phases-pressing-blocks-set-plays-goalkeeping-sections (2026-08-04)

- **A `DistributionChart` series whose values are all equal draws both direct team labels at the
  axis origin, overlapping each other.** `seriesLabelIndex` (`TacticalCharts.tsx:229-237`) returns
  the index of a series' largest value and falls back to index 0 when no value beats the first —
  which is what happens when every value in the series is identical, the all-zero case included.
  `SeriesEndLabel` then anchors both team codes at `x = barEnd + 6`, i.e. both at the axis origin,
  and decision 10(a)'s direct series labels are the primary UX-DR11 channel on these charts.
  **Deferred, marginal reachability:** corpus out-of-possession rates sum 73-97 across nine values
  and in-possession 84-149 across eight, so a fully flat series is not a shape the source produces;
  the four press rates being simultaneously zero is the only construction that reaches it.
  Worth a `-1` sentinel and a suppressed label if a successor recharts story (2.13 / 2.15 / 2.16 /
  2.17) touches this module anyway.
  **Owner:** the first successor story to reuse `DistributionChart`.

- **A denominator-labelled goalkeeping breakdown can contradict its own listed rows, with no
  disclosure.** Ruled decision 13 makes each breakdown state its own total —
  `byInterventionType` "de N" where N is `attemptsFaced`, `byBodyType` where N is
  `totalInterventions` — on the contract's assertion that each set sums to its stated denominator
  (`GoalPrevention.description`). `GoalkeepingSection.tsx:348-367` renders the label and the rows
  with no check that they agree, so if the relation is corpus-false the panel asserts a total its
  own visible numbers contradict. **Deferred because the measurement does not exist:** Story 2.10
  measured the free-kick and corner partitions over 208 team-innings and found two of four false,
  but never measured either goal-prevention relation. That is the missing input, not the fix — and
  the fix is cheap once the number is known (the same `disagreesWithDeclaredTotal` flag the
  set-plays model already carries). Note the risk is live **only on the fixtures** today, since
  `byBodyType` is decision 3's gated panel and is null on 208/208 corpus team-innings.
  **Owner:** Story 1.16 (to measure), then whoever ships the goalkeeping real-data cutover (2.19).

## Filed by Story 2.18 implementation — the terminology gate, `/glossary` and `/about`

Story 2.18 is the terminology GATE, not a terminology addition: ten stories shipped ~417 locale
leaves ahead of it under the honour system, and nothing in the build chain had ever compared a
shipped Spanish string to `EXPERIENCE.md`'s per-term policy table. Everything below was measured
against the live `es.ts` / `en.ts` during implementation, not carried forward from the story's
creation audit.

### RESOLVED — the whole-layer error boundary, filed FIVE times, now contained per section

The blast radius was filed by the 2.8 review (*"kills all eleven Tactical sections"*), re-filed by
the 2.6 review (*"A malformed momentum series takes down all eleven Tactical sections"*), re-filed
by 2.9 (*"The whole-layer error boundary, re-filed with Story 2.9's added blast radius"*), confirmed
unpatched by 1.14, and re-filed **again** by 2.10 (*"The whole-layer error boundary now has its FULL
blast radius"*) — routed every time to *"whichever story next touches `MatchBundleRegion` /
`TacticalSection`"*. Widening `TacticalSection.title` made 2.18 that story, and Juan ruled it takes
the work.

**What shipped:** `TacticalErrorBoundary` gained optional `headlineKey` / `explanationKey` (defaulted
with `??` inside the fallback, never `defaultProps`) and now wraps each section's `children` inside
`TacticalLayer`'s render, keyed `` `${plan.id}-${plan.open}` ``. `MatchBundleRegion.tsx` is
byte-identical — its whole-layer instance stays as the outer floor.

**STATE PRECISELY WHAT IT DOES NOT CONTAIN, because the boundary is weaker than "one section dies":**

- **`sectionContent(plan.id)` is evaluated EAGERLY, inside `TacticalLayer.render()`.** A throw during
  prop construction — or the `default:` exhaustiveness throw — happens **above** the per-section
  boundary and is caught only by the outer whole-layer instance. What the new boundary contains is a
  throw inside a *section component's own render*.
- **There is no automatic reset.** `state = { failed: false }` with no reset path, and `plan.id` is
  constant, so `key={plan.id}` could never force a remount. The `${id}-${open}` key means **recovery
  is by collapse and re-expand only** — and `key-stats` and `momentum` are never collapsible at any
  width, so **a crash in either of those two is permanent for the page's life**.

**Owner of the residual:** whoever next needs either of those two properties. Neither is a defect
this story introduced; both are limits of the mechanism, recorded so the next reader does not
assume the filing is fully discharged.

### RESOLVED — the i18n ESLint gate's object-shaped-prop hole (and the reason it never reached this ledger)

Filed by Story 2.6 **in a story file and never promoted here** (`2-6-momentum-timeline.md`, grep
*"The gate does NOT reach recharts"*), restated in `2-10-…md` (grep *"object-shaped props"*). What
was open: the three shipped selectors match a `Literal`/`TemplateLiteral` that is a **direct child**
of the `JSXExpressionContainer`, but recharts delivers text through object-shaped props —
`<YAxis label={{ value: "…" }} />` puts the literal inside an `ObjectExpression` and passed the gate
silently — and `value` was not a gated prop name at all, so `<Label value="…" />` was uncaught too.

**What the closure covers, exactly:** a string literal or template literal at
`label={{ value: … }}` / `{{ children: … }}` on any of the existing sixteen gated prop names, and a
string literal or template literal on `value` **for `<Label>` and `<LabelList>` only**. Ten new
`eslint-gate.test.ts` fixtures pin both halves plus the three things the closure must not break.

**What it deliberately does NOT cover, and why:**

- **`value` is reachable ONLY through `Label`/`LabelList`.** It is not on the shared sixteen-name
  regex and must not be added: `SiteHeader.tsx` passes `value="es"` / `value="en"` to Radix
  `ToggleGroupItem` as **state tokens**, both bare `Literal`s directly under a
  `JSXAttribute[name.name="value"]`, and they would fail `eslint --max-warnings 0` immediately. No
  scoping *by name* can separate a UI `value` from a form/state `value`. A future chart library that
  ships a differently-named text-bearing element needs its own element-scoped selector.
- **Only the `value` and `children` members of an object-shaped prop are gated.** Gating every
  `Property` flags recharts' own layout keywords — `label={{ value: t("…"), position: "insideLeft" }}`
  is correct code and `"insideLeft"` is not user-facing copy.
- **Both selectors are constrained to STRING literals via `raw`.** ESTree `Literal` includes numbers,
  booleans and `null`, and `TacticalCharts.tsx` and `MomentumChart.tsx` both pass numeric `angle`,
  `position` and `offset` values; an unconstrained selector flags correct code on the first chart it
  meets. This was not theoretical — it failed on the first run and the fixture that caught it is now
  a permanent test.
- **A descendant combinator on the `Label` selector reaches the DICTIONARY KEY inside
  `value={t("app.siteName")}`** and turns the one correct way to write the prop into a build error.
  Both `Label` selectors use direct-child combinators for that reason. Also caught by a fixture.

### FILED, NOT FIXED — the two `viz.momentum` copy holes (Task 8.8 discharged as a filing)

Both require editing `MomentumSection.tsx` and `MomentumChart.tsx`, which Story 2.18's scope
boundaries forbid, so the task was discharged as a filing rather than a fix:

- **`viz.momentum.cursorLabel`** is an *operating instruction* (*"Cursor de minuto: mueve con las
  flechas para leer cada minuto."*) used as an `aria-label`. Splitting the accessible NAME from the
  INSTRUCTION needs both files.
- **`viz.momentum.zero` does not exist**, and minting it would create the dead key AC 1's binding
  prohibits: `MomentumSection` has **no zero-state branch** at all. The key and the branch have to
  land together.

**Owner:** whoever next touches the momentum surface.

### FILED, NOT FIXED — five Tactical sections carry no glossary mark, and their titles are unmarkable

Ruled decision 6 marks the two never-collapsible sections in their **heading** and the nine
collapsible ones in their **summary**, because `{title}` renders inside the accordion
`<button aria-expanded>` for all nine and a `GlossaryTerm` is a focusable trigger with
`aria-haspopup`.

**Measured against the live dictionary: five of the nine collapsible summaries contain no term from
the policy table at all** — `pass-networks` (*"Quién conectó con quién y por dónde circuló el
balón."*), `offers-to-receive` (*"Cuántas veces se pidió el balón y cuántas llegó el pase."*),
`movement-to-receive` (whose Task 8.13 rewrite is ruled **verbatim** and also carries none),
`defensive-actions` (*"Dónde recuperó cada equipo y dónde forzó las pérdidas."*) and `phases`
(*"Cómo se repartió el partido entre ataque, transición y defensa."*) — while their **titles** do
("Red de pases", "Ofrecimientos para recibir", "Desmarques", "Acciones defensivas", "Fases del
juego"). Separately, `key-stats`'s heading ("Estadísticas clave") matches no policy row, and the
metric labels that would carry one are rendered by the do-not-touch `KeyStatisticsSection`.

So the Tactical Layer ships **five section marks** (`momentum` heading; `shot-maps`, `pressing`,
`set-plays`, `goalkeeping` summaries) plus the Hero's `xG`, not eleven. AC 2's "terms are marked once
per section" is a **ceiling**, so this is compliant — but it is materially thinner than the story
imagined, and rewriting frozen 2.5 ruled copy to manufacture marking sites was outside 2.18's
authority. **Juan ruled: file it, ship the six.**

**Owner:** whoever next owns those summaries — most likely 2.19, or a copy pass that can re-rule the
2.5 summaries with marking in mind.

### FILED — `DESIGN.md` and `EXPERIENCE.md` disagree about the footer's `/glossary` link

`EXPERIENCE.md`'s IA route table names the footer as `/glossary`'s reach path
(*"| `/glossary` | Glossary | Footer, every glossary tooltip's \"see more\" |"*), while `DESIGN.md`'s
attribution-footer bullet mentions only the `/about` link. Story 2.18 **followed `EXPERIENCE.md`**
and shipped the link (`chrome.footer.glossaryLink`, both locales); `DESIGN.md`'s bullet is now stale
and was deliberately **not** edited — it is not this story's artifact.

**Owner:** whoever next edits `DESIGN.md`.

### FILED — `<title>` / OG stay Spanish after an EN toggle, and `/glossary` makes it one route worse

Pre-existing and open, needing a human ruling: the document title and Open Graph metadata are
composed by server `t()` and never swap with the language toggle, so the `en.*` metadata keys are
unreachable. Story 2.18 adds `glossaryPage.metaTitle` and `glossaryPage.metaDescription`, so the
count of unreachable `en` metadata leaves grows. **Verified live:** `/glossary` serves
`<title>Glosario — WC Stats</title>` with the interface in English.

`/about` was deliberately given **no** metadata export at all rather than quietly taking the
decision — it has shipped without one since 2.2, and adding one here would have resolved an open
ruling as a side effect.

**Owner:** Juan (it is one of the seven decisions deferred at his call).

### FILED — the policy table's own scaffolding gap: `faltas` has no surface and no glossary id

Task 8.7's recount (below) found an item the creation audit's list of eight did not contain. Row 32
(*fouls / duels*) rules **`faltas / duelos`**. `duelos` ships — `enums.possessionContest` carries
*"Duelo físico"* and *"Duelo aéreo"* — but **`falta` occurs 0 times in `es.ts`**. The row is
classified as table scaffolding (Task 2.2's no-glossary-id list), so it is discharged "in the locale
files" — except that half of it is not in the locale files either.

**Owner:** whichever story first renders a fouls surface (2.11b/2.11c or the Tournament Hub).

### Task 8.7 — the per-term policy table recounted, and the partition SUMS TO 38

The story's own instruction was to recount rather than carry a number forward, because the creation
audit's partition did not sum. Recounted against the live `es.ts`:

| Partition | Rows | Which |
|---|---|---|
| **Compliant** | **26** | Wholly shipped and matching the ruled string |
| **Violated** | **3** | Row 21 `momentum` (ruled tooltip factually false, never shipped), row 30 `corner` (*"Córners … laterales"*), row 38 `Expert column groups` (2.10 shipped the logged REJECTED form) — **all three remediated by this story** |
| **Not yet used (wholly)** | **7** | `speed zones`, `high-speed run` (+ its `"CARR. ALTA VEL."` abbreviation), `take-on`, `step-in`, `result letters & standings columns`, `offside`, `standings / leaderboards` |
| **Partial** | **2** | Row 25 `goalkeeping vocabulary` (*distribución* ships; **`salidas`** and **`mano a mano`** do not) and row 32 `fouls / duels` (*duelos* ships; **`faltas`** does not — see the entry above) |

26 + 3 + 7 + 2 = **38**. The audit's "eight NOT-YET-USED rows" resolves to 7 whole rows plus the
`salidas`/`mano a mano` half of row 25; the `faltas` half of row 32 is a **ninth** undischarged item
the audit missed.

**How the not-yet-used rows were discharged.** Every one that is a *term* got a real `es` entry with
a real definition **in the glossary** — a surface that exists in this story, where the term
legitimately appears, and which satisfies AC 1's *"an explicit `es` entry with no raw-key
fallthrough"* without minting a dead `viz.*` / `enums.*` key. `es.ts`'s own `enums` docblock reserves
those namespaces for **per-surface** stories, and the 2.9 review already patched five dead keys.
**The next story must neither assume these are done nor re-mint them:** when `speed zones`,
`high-speed run`, `take-on`, `step-in`, `offside`, `salidas` or `mano a mano` gets a real surface, it
gets its `viz.*`/`enums.*` leaf **then**, reusing the ruled Spanish term from
`glossary.<id>.es`.

**The recorded objection stands.** A validation reviewer argued that `result letters & standings
columns` and the `"CARR. ALTA VEL."` abbreviation are *table scaffolding the AC names by category*
and are as safe to mint now as `enums.stage` was — i.e. that the binding declines ~20% of the work
AC 1 asks for. The counter is that `enums.stage` / `enums.position` were minted **by the stories that
rendered them**, and a standings-column map with no standings table is the dead key the ledger
already punished. Review can overturn this cheaply.

### FILED — the CS-1 forward note: what 2.18 deliberately did NOT map

`ShotOutcomeDetail` is **not** mapped by this story (ruled decision 12, taking 2.7 Task 10.4's
clearance verbatim in shape). 2.18 maps **`ShotOutcome` only** — the stable five-value marker enum
CS-1 does not touch. Verified at Task 1.2: `assert:schema-version` reports 7 artifacts at
schemaVersion 2, so **CS-1 has not landed**.

- **Two tripwires must stay green until detail labels ship, and must then be deleted
  DELIBERATELY:** `Object.keys(es.enums)).not.toContain("shotOutcomeDetail")` and
  `Object.keys(es.enums.shotOutcome)).toHaveLength(5)`. Story 2.18 re-asserts both from its own side
  in `i18n.test.ts`, so there are now **two** places to delete.
- **The post-CS-1 enum is 24 values** (CR-1 adds bare `incomplete` and `on-target`), and CR-2 makes
  `x-maps-to-outcome["deflected-on-target-defensive-event"]` an **array** `["incomplete", "on-target"]`
  — so anything treating that map as scalar-valued breaks. **No count is hardcoded anywhere in this
  story**, in code, comment or copy.
- The glossary's five shot-outcome entries carry the forward note in prose:
  `glossary.incomplete.definition` states that the report also prints a longer per-shot label whose
  vocabulary the site does not map yet.
- **Marker COLOUR is per-family, not global** — the same two RGBs mean `off-target`/`incomplete` on
  shots and `attempted`/`completed` on crosses — so **no glossary entry claims a colour has one
  meaning site-wide**, and none does. This is a property of the RGB legends, not of
  `x-maps-to-outcome`, which is a single `ShotOutcomeDetail → ShotOutcome` map on
  `common.schema.json` with no family dimension.

**Owner:** whoever ships CS-1, then 2.13.

### Terms minted or re-ruled by Story 2.18 (all logged as rows in `EXPERIENCE.md`)

- **`enums.aerialType.claim`: "Descuelgue" → "Atrapada"** — 2.10 minted it with no policy row;
  "Descuelgue" leans Spain against the ruled LatAm register (UX-DR19), and *atrapada* pairs with the
  shipped *arquero* / *atajada* vocabulary.
- **`enums.distributionType` (es) realigned to the `en` distinction** — es split on
  body-part/technique while en splits on **kick vs throw**, leaving *"Saque de volea"* and *"Saque
  con la mano"* mutually confusable. Now *"Saque con el pie"* / *"Volea desde las manos"* /
  *"Lanzamiento con la mano"*: two kicks, one throw.
- **`en.enums.cornerDeliveryStyle`: "Inswing"/"Outswing" → "Inswinging"/"Outswinging"** — the es
  docblock states the reuse of one delivery vocabulary is deliberate and es delivered on it; en did
  not.
- **The counterpart-language subtitle's `es:` / `en:` prefixes**, locale-invariant in both
  dictionaries, and **suppressed entirely where the two terms are identical** (decision 13).
- **`about.credits` and `about.project` are PROPOSED, NOT RULED** — no spine carries credits or
  project-framing wording. Authored under Voice and Tone and flagged for Juan at review.

### Known-adjacent, inherited and NOT fixed by this story

- **The fragment/hash re-entry defect** (filed by the 2.5 review, open, no owner): re-activating an
  **unchanged** hash never re-fires `hashchange`, so a repeat `/glossary/#term` link is a silent
  no-op. `/glossary`'s 42 anchors inherit it.
- **The cluster-popover over-claim copy** — needs a geometry ruling, not a copy edit. Untouched.
- **The `minutePrefixKey` / `valuePrefixKey` naming drift** — still routed to whoever next touches
  all five files. Untouched.
- **`app/src/app/about/page.tsx`'s "Story 2.18 replaces this" docblock is now DISCHARGED** — the
  route is filled, and the docblock says so.

## Filed by Story 2.11a — the sortable data-table contract (2026-08-04)

Every entry below is APPENDED. No earlier paragraph is edited; the two corrections below are
recorded as corrections rather than by rewriting the entries they correct.

### CLOSED by this story

- **The `?? 0` item is CLOSED.** Grep anchor: *"dead fields carrying a defaulting decision"*.
  `ShotLogRow.minute` / `stoppageMinute` are now `number | null`, populated `?? null`, and the
  shared sortable table reads them through `clockSortValue`, which returns `null` — never 0 — for a
  clock-less row. Nulls sort to the END of the array in BOTH directions, which agrees with
  `orderByMinute`'s `left == null ? 1 : -1` and is asserted equivalent to it in
  `table-sort.test.ts`. The three log row models (`ShotLogRow`, `CrossLogRow`, `DefensiveLogRow`)
  now share ONE null contract, asserted across all three in `shot-map-model.test.ts`.

- **CORRECTION to that entry, measured rather than trusted.** It claims *"`cross-map-model.ts:160-161`
  does the same"*. That clause was **STALE**: `CrossLogRow` already used `?? null` with type
  `number | null`, and `DefensiveLogRow` had been fixed by Story 2.9's code review with a docblock
  naming Story 2.11 as the owner of the Shot fix. **Only `ShotLogRow` was still wrong.** The
  original entry is left untouched; this is the correction.

- **The sortable-table plug-in points filed by Stories 2.6, 2.7, 2.8 and 2.9 are DISCHARGED.**
  Grep anchors: *"The pass matrix ships PLAIN"* (2.8) and *"The momentum data table ships PLAIN"*
  (2.6). Seven code sites across four filing stories (`grep "2.11 PLUG-IN POINT"` = 4,
  `grep "Story 2.11 owns"` = 3, plus 2.10's four later copies) are retired: ONE shared
  `app/src/components/DataTable.tsx` now serves **all twenty instances across all ten files**, and
  every private `DataTable` copy is deleted. UX-DR12's sort contract — click/Enter/Space,
  `aria-sort`, polite announcements, `Intl.Collator('es',{sensitivity:'base'})` text sort, a stated
  default sort per table, tabular numeric alignment — ships once, in `app/src/lib/table-sort.ts`
  plus that component.

- **Task 8.3's branch is DEAD and is recorded as such rather than filed.** It was written to fire
  *"only if 2-10 has not landed"*. 2-10 landed at `892766c` before this story started, the retrofit
  surface was re-counted at Task 1.2 as exactly **10 files / 20 instances**, and all twenty were
  reachable. Nothing is routed onward on this point.

### DECLARED DEPARTURES filed by this story

- **UX-DR12's STICKY HEADER is NOT implemented, and the reason is structural rather than
  discretionary. Routed to Story 2.11b.** `ViewDataDisclosure`'s region — which hosts every one of
  the twenty tables — is `className="mt-tile-gap w-full overflow-x-auto"`. Per CSS Overflow 3, an
  `overflow-x: auto` box with `overflow-y: visible` has its used `overflow-y` forced to `auto`, so
  that div is already a two-axis scroll container and is the nearest scrolling ancestor a sticky
  `<thead>` resolves against. **It has no height bound**, so its scrollport equals its content
  height and it never scrolls vertically: `position: sticky; top: 0` inside it never offsets. A
  sticky header here would ship green, pass a suite with no jsdom, and **silently not stick**.
  Verified live at Task 9.2: `getComputedStyle(thead).position === 'sticky'` is 0 across all 22
  tables, deliberately.
  **The fix** is a height-bounded scroll region. **The blocker** is that one shared disclosure
  serving twenty tables cannot pick a height. **Owner: Story 2.11b**, which introduces the Expert
  Layer's own bounded container. UX-DR12's `scroll-padding-top` clause travels with it.
  **Do not add a height to `ViewDataDisclosure`'s region** to close this.

- **DESIGN's `data-table.sort-active-color` is NOT used on the PITCH surface, and the number is
  why.** DESIGN sets the active-sort head to `{colors.accent-cyan}`. Measured live in both themes
  against the actual painted background: on the CANVAS it computes **11.27 dark / 4.99 light** and
  is used as specified. On the theme-invariant PITCH the light `--accent-cyan` (`#0e7490`) computes
  **2.28:1**, far under the 4.5 floor — the same clause `ViewDataDisclosure` and `ShotMapsSection`
  already record for their own on-pitch controls. The pitch therefore marks the active column with
  a LIGHTNESS STEP (`--ink-on-pitch` 11.14 over `--ink-on-pitch-secondary` 5.55, both
  theme-invariant) plus the direction glyph. Direction is never carried by hue alone on either
  surface. Filed for UX sign-off; not a request to edit DESIGN.md.

### Recorded, not fixed

- **The sort announcement is composed at click time and is NOT re-rendered by a later language
  toggle.** Measured: toggling ES→EN with a sort active leaves the previous Spanish sentence in the
  live region. It is **inert** — a live region speaks on change, and this text does not change — so
  nothing is mis-announced, and the next sort composes a fresh string in the active locale. Left
  as-is deliberately: clearing it on locale change would itself mutate the region and risk
  announcing an empty string. Recorded so a later reader does not mistake the residue for a bug.

- **`TableColumn.rowHeader` and `sort: null` ship with NO consumer.** Both are part of the ruled
  decision-2 contract and are exercised by `table-sort.test.ts`, but no retrofitted call site sets
  either: every one of the twenty tables makes every column sortable, and none promotes a cell to
  `<th scope="row">`. Story 2.11b's per-player tables are the intended first consumer. Flagged so
  the unused paths are not mistaken for dead code and deleted.

## Deferred from: code review of 2-11a-sortable-data-table-contract (2026-08-04)

Seven findings triaged to `defer` by the 2.11a code review. All are real; none is caused by a
mistake this story made, and none is reachable as a user-visible defect on the shipped fixtures.

- **Zero-row tables render live sort controls.** `panelDataState` returns `"zero"` for `[]` (a
  deliberate contract distinction from `null`), so a bundle with an empty event array renders a
  full sortable header over an empty `<tbody>`. Clicking a head flips `aria-sort` and announces
  "Ordenado por Equipo, ascendente." for a table with nothing in it. Pre-existing as a rendering
  shape — the ten private copies did the same — but the announcement is new.
  `app/src/components/DataTable.tsx`.
- **Sort state is silently destroyed by the disclosure toggle.** Sort state is ephemeral component
  state (AR-10, ruled), and `ViewDataDisclosure` unmounts its children when collapsed. Sorting a
  column, hiding the data and showing it again returns the table to artifact order with every
  `aria-sort` at `"none"` and no announcement. The `sortCleared` string exists for exactly this
  state change but is wired only to the cycle's third click.
- **The locale toggle re-orders an actively-sorted table without announcing it.** Sorting during
  render is deliberate and load-bearing (a `DictionaryKey` column must re-order when labels change
  language), but `announce()` fires only from `handleSort`, so every row can move with the polite
  region silent.
- **A gated column disappearing while active reverts rows with no announcement.** `sortRows` falls
  back to artifact order when the active `columnKey` is absent from `columns`, and `ariaSortFor`
  then reads `"none"` everywhere — but `sortState` stays non-null and nothing announces. Not
  reachable today (`showXg` / `showMinute` / `showContestType` are constant per bundle); the module
  documents the case and covers only half of it. `app/src/lib/table-sort.ts`.
- **The sort is unmemoised and the inactive path still copies the array.** `sortRows` runs on every
  render of every table, and `state === null` returns `[...rows]`. Deliberately un-memoised for
  correctness under the EN toggle, and a non-issue at fixture scale (the largest shipped table is
  well under 600 rows). It becomes a real main-thread cost at the corpus scale the code's own
  comments cite (20,169 defensive events). **Route: revisit at the 2.19 real-data cutover**, where
  the fix is a `useMemo` on the `columns` construction rather than on the sort.
- **`(minute, stoppage)` is now packed at two different scales.** `clockSortValue` uses `× 1000`;
  `momentum-model.ts`'s `stampRank` uses `STOPPAGE_RANK_BASE = 100`, whose bound `readStamp`
  enforces. The orders agree and `× 1000` is the safer choice for the shot and defensive log models,
  which enforce no upper bound — but the packing constant is stated twice, in a story whose own
  docblock argues `MIN_HIT_PX` should have exactly one definition. Unify only if a third consumer
  appears.
- **`aria-label` replaces rather than extends the visible head text.** The header button's
  accessible name is `"Ordenar por Minuto"` over visible text `"Minuto"`. WCAG 2.5.3 Label in Name
  is met (the visible label is contained, and `i18n.test.ts` pins the prefix order), but a
  voice-control user saying "click Minuto" no longer matches the name's start. The alternative — a
  visually-hidden prefix span, keeping the accessible name equal to the visible label — is a DOM
  change across every sortable head and was not worth making inside this story.

### Two further deferrals, ruled by Juan at the 2.11a review (2026-08-04)

- **Sort collation stays pinned to `es`; re-measure at the 2.19 real-data cutover.** The 2.11a
  review challenged ruled decision 8 — `sortRows` calls `compareText(a, b)` at its `'es'` default,
  so an EN reader sorting a name column gets Spanish collation (ñ as a distinct letter after n)
  rather than the `en` collator's base-sensitivity folding. **Decision 8 was re-affirmed and
  STANDS**: the two-argument call is what UX-DR12 asks for verbatim, and the decision's own
  measurement holds — across all 96 fixture player names the `es` and `en` orders are identical, 0
  disagreements in 9,216 pairs, 0 non-ASCII characters. The reviewers' failure case is therefore
  **unobservable on shipped data**. It stops being unobservable when real corpus names replace the
  fixtures. **Owner: 2.19.** Re-run the 96-name comparison over the real name corpus; if the orders
  diverge, that is the evidence needed to re-open decision 8, and the fix is to thread `useLocale()`
  through `DataTable` into `compareText`'s third argument (a departure from UX-DR12's verbatim
  `Intl.Collator('es')` clause, which would then need filing). `app/src/lib/table-sort.ts`.
- **One polite live region serves twenty tables and cannot say which one moved. Owner: 2.11b.**
  `announcementFor` composes only `${sortedBy} ${headText}, ${direction}.`, and `sortCleared` names
  nothing at all. `#offers-to-receive` renders two tables whose first column is headed "Equipo";
  `#set-plays` ships four tables inside one disclosure and `#goalkeeping` seven. Sorting the second
  produces speech identical to sorting the first. `SortAnnouncer`'s `tick` key solves
  re-announcement of an identical string, not its ambiguity. Ruled decision 9 (one region, mounted
  once, outside the table) is NOT re-opened by this — the fix is in what the announcement says, not
  in how many regions exist. **Routed to 2.11b**, which reworks the table shell and introduces the
  Expert-layer bounded container, so it can rule disambiguation alongside sticky headers with the
  full table inventory in view. The candidate fix is a short per-table identifier prefixed to the
  announcement (~20 new locale keys); it was judged not worth minting inside 2.11a.

### Departure filed at the 2.11a code review (2026-08-04): `aria-sort` on unsortable heads

Ruled decision 5 and Task 2.5 say that in the "none" state **every** `<th>` reads
`aria-sort="none"`. The shipped `DataTable` does that for every SORTABLE head, but omits the
attribute **entirely** on a `sort: null` head, justified only by an inline comment.

**This is a departure, and it is the right behaviour** — WAI-ARIA APG puts `aria-sort` on the
sortable column headers of a sortable table; `aria-sort="none"` on a head that can never sort
announces a capability that does not exist. Decision 5's "every `<th>`" was written about the
none-state of sortable columns, not about columns excluded from sorting altogether.

**It is currently unreachable**: zero call sites ship `sort: null` — all twenty retrofitted tables
make every column sortable — so every `<th>` that actually mounts today does read `"none"`, and
decision 5 holds verbatim on the shipped surface. Recorded so that the first story to ship a
`sort: null` column (2.11b's per-player tables are the likely first consumer) knows the deviation is
deliberate and does not "fix" it back into a decision-5 violation.

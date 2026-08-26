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

- ~~**Change-set CS-1 (scheduled; must land as ONE atomic AD-14 commit before Story 1.16 begins emission)**~~ — **LANDED 2026-08-04** as one atomic commit with Juan's explicit go-ahead while two Epic 2 sessions were in flight (the coordination rule's escape hatch). Durable record: `contract/README.md` → logged decision **17**. Epic 1 executed both change requests per the solo-repo AD-14 note. **The filed recipe below was stale on two points and wrong-by-omission on two more — corrected here for the successor change-set:** (1) it says `version.json` 1 → 2, but that bump already landed in `c645cfe` (Story 1.8); CS-1 was **2 → 3**. (2) "`version.json` bump" reads as one file — it is **six declarations**: `version.json` plus a `schemaVersion` `const` in each of the five artifact schemas (`match-bundle`, `tournament`, `team-profile`, `player-profile`, `leaderboards`). Miss them and `test_every_artifact_schema_pins_schema_version_to_the_declared_version` fails and the re-pinned fixtures stop validating. (3) A **fourth** pipeline consumer went unlisted: `pipeline/tests/test_contract_schemas.py` hardcodes `assert contents == {"schemaVersion": N}` / `assert schema_version() == N`. (4) `data/fixtures/README.md` states the stamp in prose. **Story 1.16 is unblocked.** Original filing follows. — contents: **CR-1** extend `ShotOutcomeDetail` with bare `incomplete` + `on-target` (with `x-maps-to-outcome` entries, README provenance rows, and the two locale label rows when 2.13/2.18 map detail codes); **CR-2** `x-maps-to-outcome["deflected-on-target-defensive-event"]` → `["incomplete", "on-target"]` (rejected alternatives, recorded 2026-07-23 review: remap-to-`incomplete` — the one genuine on-target row fails emission; keep-`on-target` — corpus-false 10:1; enum-split into two colour-specific values — keeps the map scalar but breaks the 1:1 corpus-label→detail identity and pushes marker colour into the value, rejected by decision); **plus riding**: the stale own-goal `$comment` correction at `match-bundle.schema.json` (`GoalOwnGoal` — Story 1.6 proved the corpus marks own goals; the 1.16 emission-flip entry above still applies) and the matching stale row in `contract/README.md`'s "deliberately empty" table (corrected in prose 2026-07-23; keep consistent when decision 17 lands). **Pipeline consumers (added by the 2026-07-23 code review — the original "nothing else consumes the changed values" claim was FALSE):** `pipeline/tests/test_markers_attempts.py:87-99` asserts the enum equals the label map minus exactly the two AD-14 extras and `DETAIL_TO_OUTCOME == {**contract_map, **AD14_EXTRA_DETAILS}` — CR-1 and CR-2 each break these; `pipeline/tests/test_fixtures.py` needs BOTH asserts of the outcome/detail test updated (the values-subset check at :693 `TypeError`s on an array value, not just the per-shot check at :696); `AD14_EXTRA_DETAILS`/`DETAIL_COMPATIBLE_OUTCOMES` in `pipeline/markers/attempts.py` must drop/absorb the now-in-contract extras. Recipe per AD-14: schema edits + pipeline constant/test updates above + logged decision 17 in `contract/README.md` + `version.json` 1 → 2 + hand-edited fixtures re-pinned to `schemaVersion: 2` + BOTH regenerated type outputs (`contract/generated/` via `npm run generate:types` in `contract/`, and `app/src/lib/contract/` via `npm run generate:types` in `app/`), proven in the same commit by the FULL `pipeline/tests` suite (not just the two contract/fixture files — the markers tests are consumers) + `npm run check:types`. **Coordination (restating Task 6.2's rule, dropped from the first filing):** a bump re-pins fixtures and regenerates app types, so CS-1 must not land while another story session is in flight against the current baseline (1-7 is in-progress as of 2026-07-23) — land after in-flight sessions commit, or with Juan's explicit go-ahead. **Epic-2 binding:** stories 2.7/2.13/2.18 build their label/legend/locale maps against the post-CS-1 24-value enum (or handle unknown detail values defensively) — do not hardcode the 22-value set. Solo-repo AD-14 note: 2.3 filed these wearing the Epic 2 hat; whoever lands CS-1 executes Epic 1's side and says so in logged decision 17.

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

> **Superseded 2026-08-04: CS-1 HAS now landed** (schemaVersion 3, decision 17). Everything
> below still holds — CS-1 shipped the 24-value enum and the array map entry but **no locale
> labels**, which remain Stories 2.13/2.18's. **Both tripwires must therefore stay green and
> undeleted**; CS-1 verified them green and did not touch either. They are now the only thing
> between the extended enum and an unlabelled detail code reaching a user. The owner line
> below still reads correctly: whoever ships CS-1 (done), then 2.13.

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

- ~~**UX-DR12's STICKY HEADER is NOT implemented, and the reason is structural rather than
  discretionary. Routed to Story 2.11b.**~~ — **RESOLVED by Story 2.11b (2026-08-04), and the
  departure's own analysis was correct in every particular.** `DataTable` gained an opt-in
  `sticky` prop; the twenty disclosure tables do NOT pass it and their headers are still not
  sticky, for exactly the reason filed below. The Expert Layer supplies its own height-bounded
  scrollport (`max-h-[70vh] overflow-auto scroll-pt-11`) and passes it. Two mechanics had to be
  built rather than assumed: the table switches to `border-separate` in sticky mode (under
  `border-collapse` the TABLE paints cell borders, so a sticky `<th>`'s bottom border scrolls away
  beneath the rows), and the sticky column run needs a strict z-ladder (body 10 / header 20 /
  corner 30 — equal z resolves to later-in-DOM, and `<tbody>` is later than `<thead>`). Verified
  BEHAVIOURALLY at 1280px, not by computed style, which is the trap this entry named: the header
  pinned to the scrollport's top edge to the pixel (574.09 vs 574.09) and held there while the body
  scrolled 400px and again 145px. `scroll-padding-top` is 44px. The original text follows.

  `ViewDataDisclosure`'s region — which hosts every one of
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

- ~~**`TableColumn.rowHeader` and `sort: null` ship with NO consumer.** Both are part of the ruled
  decision-2 contract and are exercised by `table-sort.test.ts`, but no retrofitted call site sets
  either: every one of the twenty tables makes every column sortable, and none promotes a cell to
  `<th scope="row">`. Story 2.11b's per-player tables are the intended first consumer. Flagged so
  the unused paths are not mistaken for dead code and deleted.~~ — **HALF-RESOLVED by Story 2.11b
  (2026-08-04).** `rowHeader` now has its first consumer: the Expert table's `player` column, which
  is the sticky run's third member and renders `<th scope="row">` on all 34 rows. **`sort: null`
  still has none** — every one of the Expert table's 50 columns sorts — and it stays filed for the
  same reason as before.

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

  — **MECHANISM RESOLVED by Story 2.11b (2026-08-04); the ~25 identifiers are NOT, and are
  re-filed.** `DataTableProps` gained an optional `tableName?: string`, prefixed to the polite
  announcement in BOTH its states (the cleared one included — "the table's original order was
  restored" is exactly as ambiguous across 26 tables as the sorted form). With no `tableName` the
  announcement is byte-identical to what shipped, so all 26 pre-existing call sites are unchanged.
  2.11b mints the ONE key it owns (`expert.tableName`) and passes it; verified live —
  *"Tabla de datos por jugador: Ordenado por Goles, descendente."* **It could not verify the
  multi-table case**, because it adds exactly one table. Ruled decision 9 (one region) is NOT
  re-opened. **Owner: whichever story next opens `#set-plays` (4 tables), `#goalkeeping` (7) or
  `#offers-to-receive` (2), or 2.19.** The remaining work is copy, not mechanism: mint a short
  identifier per table and pass it. The two-tables-headed-"Equipo" case in `#offers-to-receive` is
  the cheapest place to prove it.

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

## Deferred from: code review of 2-18-glossary-about-terminology-completion (2026-08-04)

Five findings triaged to `defer` by the 2.18 code review. All are real. Two are disclosed
constraints the story had no authority to resolve; three are guard-robustness items that cost
nothing today and will cost something later.

- **Title and summary marks render OUTSIDE the per-section error boundary.** `TacticalLayer`
  passes `TacticalErrorBoundary` as `children` of `TacticalSection`, and `TacticalSection` renders
  `title` and `summary` above the `{open ? <div id={contentId}> : null}` branch that holds the
  boundary. A throw from a `GlossaryTerm` in a heading or summary therefore escapes to the
  whole-layer instance in `MatchBundleRegion` and replaces all eleven sections. Story 2.18's
  ruled decision 7 discloses the class ("a throw during prop construction happens ABOVE this
  boundary") but its docblock enumerates only `sectionContent()`'s eager evaluation; marking is an
  unlisted instance of the same class. Reachability is low — all four `t()` keys `GlossaryTerm`
  resolves are pinned by the i18n exhaustiveness suites — but the containment decision 7 was filed
  five times to deliver does not cover the surface 2.18 added. Routed to whoever next touches
  `TacticalLayer` / `TacticalSection`.
  `app/src/components/TacticalLayer.tsx`, `app/src/components/TacticalSection.tsx`.

- **Roughly 450 lines of new client code ship with zero automated coverage.**
  `GlossaryTerm.tsx`, `GlossaryContent.tsx`, `glossary-marking.tsx`, `ui/popover.tsx` and
  `use-glossary-popover.ts` are untestable in a node-only harness, and "do not add jsdom" is an
  explicit Story 2.18 scope boundary — so this is not a defect of the story, it is the standing
  cost of the harness. Every behavioural clause of AC 2 (hover intent, page-wide single open, Esc,
  the two auto-focus contracts, Tab reachability) rests on a manual browser session. The 2.18
  review found two focus defects in that untested surface — the grace timer closing the panel out
  from under a focused link, and `focusInPanel` never being reset — which is the concrete price.
  Recorded so the next story that proposes a test-environment change has the evidence.

- **AC 2's "Tab-reachable glossary link" has never been verified with a real Tab key.** The harness
  delivers no OS-level key presses: a `keydown` capture listener on `document` recorded zero events
  across five Tab presses in two independent tabs. Story 2.18 substituted a document-order
  focusable walk (trigger at index 9, panel link at index 10, nothing between) and the no-portal
  implementation is correct in code, so the structural proof stands. But both focus defects the
  review found live on exactly this path, so the clause needs one minute of a focused browser
  window once they are patched. Not a code change — a verification debt.

- **`longestUnmarkedRun`'s absence guard can assert on a short, non-unique fragment.**
  `matches/static-output.test.ts` asserts `not.toContain(run)` for each section title's longest
  contiguous unmarked run, with only a separate `toBeGreaterThan(5)` floor. Today `momentum`
  yields `"Línea de"` — 8 characters, not unique to the section. Nothing requires the run to be
  section-unique, so an unrelated exported string can make the AR-11 guard report that the Tactical
  Layer has moved to the build-time path, which is the one thing that guard exists to detect.
  `app/src/app/matches/static-output.test.ts`.

- **The "no Spanish left in an `en` leaf" glossary check only asserts inequality.**
  `i18n.test.ts` counts ids whose `en` definition differs from its `es` definition and asserts the
  count equals `GLOSSARY_TERMS.length`. A paraphrased-but-still-Spanish `en` definition passes,
  and the test goes red if two locales ever legitimately share a definition. The stated property
  and the asserted property are not the same. `app/src/lib/i18n.test.ts`.

## Deferred from: change-set CS-1 (ShotOutcomeDetail 22->24, schemaVersion 2->3, 2026-08-04)

- source_spec: `_bmad-output/implementation-artifacts/spec-cs-1-shot-outcome-detail-ad14-bump.md`
  summary: **The app's generated contract types have NO freshness gate — AD-14 step 5 is enforced for only one of the two generated trees.** `test_the_committed_generated_types_still_match_the_schemas` runs `--check` against `contract/generated/` alone. `app`'s own `check:types` script exists but is wired into nothing: `app`'s `build` is `lint && typecheck && assert:schema-version && next build && copy-data`, `netlify.toml` runs `npm run build`, and no vitest test invokes it. `assert-schema-version.mjs` only regex-greps the version INTEGER out of `schema-version.ts` — it never compares `contract-types.d.ts` against the schemas.
  evidence: A description-only contract correction needs no version bump (the AD-14 flow triggers on *shape* changes — ratified at the 2.3 sign-off), so regenerate `contract/generated/` only and: `pipeline/tests` green, `assert:schema-version` green (version unchanged), `npm run build` green, and Netlify ships an `app/src/lib/contract/contract-types.d.ts` whose JSDoc states the superseded fact. That is precisely the drift `check:types` was created to stop — the README's own callout says the committed types once "drifted four JSDoc blocks behind the schemas with 256 tests green" — reintroduced in the one file decision 17 calls "the only thing Epic 2 reads". CS-1 got this right only because it ran `app`'s `check:types` by hand. Fix: add `check:types` to `app`'s `build` chain, or a vitest test that shells it. Interim mitigation landed as a warning in `contract/README.md`'s AD-14 flow section.

- source_spec: `_bmad-output/implementation-artifacts/spec-cs-1-shot-outcome-detail-ad14-bump.md`
  summary: **Six sites in `app/src/` now assert in prose that "CS-1 has not landed" — two of them as TEST NAMES.** `glossary.test.ts:125` is titled `"mints no ShotOutcomeDetail id (ruled decision 12 — CS-1 has not landed)"`; `i18n.test.ts:897` is titled `"still mints NO ShotOutcomeDetail namespace (decision 12 — CS-1 has not landed)"`; plus comments at `i18n.test.ts:208,210`, `glossary.ts:114-115`, `locales/es.ts:1247`, `viz/shot-map-model.ts:24` describing the 22->24 extension as pending.
  evidence: Every ASSERTION still holds and the suite is green — CS-1 shipped the enum but no locale rows — which is exactly the problem: green tests named "CS-1 has not landed" misreport the gate's state to the next reader. Decision 17 calls these two tripwires "the only thing standing between the 24-value enum and an unlabelled detail reaching a user" while they remain labelled as guarding an unlanded change. **NOT fixed by CS-1 deliberately:** two Epic 2 sessions were in flight and own these files (coordination rule). **Owner: Stories 2.13/2.18**, which must retitle them when they map detail labels and then delete them deliberately.

- source_spec: `_bmad-output/implementation-artifacts/spec-cs-1-shot-outcome-detail-ad14-bump.md`
  summary: **A dual-colour detail gives the linking outcome cross-check no discriminating power over its own rows.** `pipeline/markers/linking.py:215` accepts a (marker, glyph) pair when the marker's RGB outcome is in `DETAIL_COMPATIBLE_OUTCOMES[detail]`; for `deflected-on-target-defensive-event` that tuple holds both colours, so overlapping incomplete- and on-target-coloured markers over such a row can only be separated by distance and the bijection rule.
  evidence: Pre-existing, NOT introduced by CS-1 — `DETAIL_COMPATIBLE_OUTCOMES` is byte-identical before and after this change-set (the pre-CS-1 code carried the same both-colours tuple as a local override), so no production behaviour moved. CR-2 makes it permanent rather than provisional, which is why it is worth filing: acknowledging the one-to-many rendering *means* surrendering that discriminator, and the adjudication accepted that. Sits alongside the existing merged-ordinal-pileup robustness note. Current corpus links 2571/2571 markers (100%), so this is a robustness note for future tournaments, not a live gap.

## Corrections to the Story 2.18 entries (code review, 2026-08-04)

Recorded as corrections rather than by rewriting the entries they correct, per this file's own
convention. All three are claim-accuracy defects in what 2.18 filed, not new deferrals.

- **CORRECTION — "No count is hardcoded anywhere in this story, in code, comment or copy" was
  FALSE when written.** Ruled decision 12 says "do NOT hardcode the pre-CS-1 `ShotOutcomeDetail`
  count anywhere — not in a comment, a count, or a glossary entry", and two comments carried it:
  `app/src/lib/glossary.ts`'s `GLOSSARY_ORDER` note on the shot-outcome expansion, and
  `app/src/locales/es.ts`'s `glossary.incomplete` docblock — where the instruction and its
  violation were the same sentence. Both were corrected by the code review; the counts now live
  only in `contract/common.schema.json`, which is the one place they cannot go stale. The original
  claim stands corrected, not deleted.

- **CORRECTION — "The glossary's five shot-outcome entries carry the forward note in prose" names
  more entries than ship it.** Exactly ONE does: `glossary.incomplete.definition`. `goal`,
  `on-target`, `off-target` and `blocked` carry no forward clause. The sentence's own colon then
  names the single key, so the entry self-narrows and nothing downstream was misled — but the lead
  clause is what a grep returns, and Task 10.3's obligation is discharged by that one entry, not by
  five. No code change: one honest forward note is what decision 12 asked for.

- **CORRECTION — the "six table-scaffolding rows are discharged in the locale files" claim covers
  three rows, not six.** `stage names` (`enums.stage`), `lineup labels` and `Expert column groups`
  really are discharged in the locale files. `result letters & standings columns`,
  `standings / leaderboards` and `fouls / duels` have **no locale keys at all** — their surfaces do
  not ship until 2.11-2.16, and minting keys for an absent surface is the dead-key defect AC 1's
  own BINDING prohibits. Story 2.18's own FINDINGS FOR JUAN already flagged `faltas` (row 32) as a
  ninth undischarged item, which contradicted the docblock. The comments in
  `app/src/lib/glossary.ts`, `app/src/lib/glossary.test.ts` and `app/src/lib/i18n.test.ts` were
  corrected to say DEFERRED rather than discharged. **Routed to the owning stories: 2.11-2.14 for
  the standings/leaderboard vocabulary, and whichever story first renders fouls or duels.** A later
  story reading the original wording would have shipped a standings table believing its vocabulary
  was already ruled.

## Ruled at the Story 2.18 code review (2026-08-04)

- **The 5-of-11 section marking reduction is CONFIRMED by Juan: ship six marks, file the rest.**
  `SECTION_HEADING_MARKS` holds one entry (`momentum`) and `SECTION_SUMMARY_MARKS` four
  (`shot-maps`, `pressing`, `set-plays`, `goalkeeping`); with the Hero's `xg` that is six marked
  surfaces, not eleven. AC 2's "terms are marked once per section" is a CEILING, so this is
  compliant. `key-stats`, `pass-networks`, `offers-to-receive`, `movement-to-receive`,
  `defensive-actions` and `phases` carry no mark because their ruled 2.5 summaries contain no
  policy-table term while their titles — which decision 6 forbids marking, since `{title}` renders
  inside the accordion `<button>` for every collapsible section — do.

  **One correction to the reasoning, recorded for whoever next opens those summaries.** Story 2.18
  cites "rewriting frozen ruled copy to manufacture a marking site is outside this story's
  authority" as the blocker. That constraint did not apply to `movement-to-receive`: Task 8.13
  rewrote its summary outright in both locales, and chose wording ("Cómo se ofrecieron para
  recibir, y en cuáles de esos ofrecimientos además se movieron.") that matches neither
  `ofrecimientos para recibir` nor `desmarques` under `findTermSpan`. That row was open and the
  marking site was not taken. Not reopened here — the summary is ruled verbatim by decision 3 and
  changing it again is a copy ruling — but the next story to touch it should know a mark is
  available there for the cost of two words.

## Filed by Story 2.11b — Expert Layer shell and Domain G per-player tables (2026-08-04)

- **THE THREE FIXTURES BREAK `domain-g-zone-sum` ON 79 OF 96 ROWS, WORST DRIFT 4.400 m. Owner:
  2.19 / 1.16.** `pipeline/extract/domain_g.py` ships a self-validation check asserting the six
  speed-zone distances sum to `physical.totalDistance` within `ZONE_SUM_TOLERANCE_M = 0.35`, and
  that check is **corpus-verified at worst drift 0.200 m over 3,289 rows** — so the tolerance is
  right and the FIXTURES are wrong. Corroborated by the entry above on m001's
  `physical.totalDistance` disagreeing with the printed value on 30 of 31 players. This is a
  FIXTURE DEFECT, not a rendering decision, and 2.11b changed nothing about it: all seven values
  render verbatim, nothing is derived (AD-5), and the layer makes **no on-screen sum claim** while
  the fixtures contradict the corpus. Whoever regenerates fixtures from real reports should run
  `domain-g-zone-sum` over them as an acceptance gate. Related and equally not-to-be-built-on:
  `domain_g.py` records `goals <= attemptsAtGoal` as corpus-FALSE on 4 of 104 reports, so no
  consistency affordance may be built on that pair either.

- **`PendingSectionPanel`: KEEP; the delete is RE-FILED, not actioned.** Story 2.10 decision 20
  routed the keep-or-delete call to 2.11 on the grounds that *"the Expert Layer (2.11) may want the
  same shell"*. **It does not** — the Expert Layer's absence state is a real `EmptyStatePanel` with
  both copy halves overridden to name Domain G, because `players` genuinely can be `null` and the
  generic "the official report does not include this section" would be a false statement otherwise.
  So the component keeps its zero consumers. Not deleted here: removing a component plus its live
  locale keys means reasoning about three assertions in `tactical-sections.test.ts:108-125`, which
  is not this story's surface. **Owner: 2.19, or whichever story next touches that test.**

- **The Expert empty state (`players === null`) is BUILT BUT VISUALLY UNVERIFIED.** No fixture
  exercises the branch — all three carry a populated `players` array (31 / 31 / 34) — so the panel
  was verified by construction and by `buildExpertRows` returning `[]` rather than throwing, never
  on screen. `[]` is deliberately NOT this state: it is `ready` with zero rows. Recorded so a later
  reader knows which of the two absence paths has been seen and which has not.

- **CARRIED FORWARD, still unanswered: EXPERIENCE.md's Visualization Layering table (`:215`)
  assigns more to Expert altitude than AC 1 enumerates** — *"underlying series in data table"*
  (momentum), *"Exact percentages and per-match splits in tables"* (phases / pressing / blocks),
  *"Set-play log"*. Those are Story 2.10's four sections, each of which already carries a
  Tactical-altitude table. AC 1's five-log enumeration controls for 2.11c; whether these four
  **also** surface at Expert altitude is a scope question, not a defect. **Owner: 2.11c**, which is
  the story that mounts logs into this shell and is best placed to see the duplication.

### Declared departures filed by this story

- **The sticky run's ruled WIDTHS did not survive the layout and were re-measured. Recorded because
  the failure mode is silent.** The story ruled `3.5rem / 2.75rem / 6.25rem` for team / shirt /
  player with matching `left` offsets. Under AUTO table layout a cell `width` is only a suggestion —
  the algorithm may land on the column's max-content in EITHER direction — so the run rendered
  79 + 82 + 141px while `shirt` was pinned at 56px and `player` at 100px: each sticky column
  overlapped and clipped the head before it, and a `w-[5.5rem]` (88px) attempt still rendered 82px
  and opened a 6px gap for scrolled data to slide through. `min-width` DOES bind on a table cell in
  Chrome (verified: max-content 82px renders at exactly 88px under `min-w-[5.5rem]`), so the run
  ships as `min-w-*` with values clearing the wider of the two locales' head text. Measured exact
  in both: offsets 0 / 5.5rem / 11rem, widths 88 / 88 / 192, **gap 0.00px**. Anyone adding a sticky
  column elsewhere should use `min-w`, not `w`.

- **`truncate` does not truncate inside a table cell — it WIDENS the column.** It includes
  `white-space: nowrap`, which makes the cell's max-content the whole string; the `player` column's
  141px was this, not the declared width. Truncation has to happen in a fixed-width block INSIDE
  the cell. Recorded because the class name says the opposite of what it does here.

- **At 390px the `<md` escape hatch was TAKEN, and it buys less than the story assumed.** Measured
  before taking it: scrollport 345px, three-column sticky run 289px, **55.7px of data columns — not
  one full column**, because the Spanish heads run 102-126px wide (the story's estimate assumed a
  212px run and ~146px of data). Dropping the `team` column at `<md` behind a team `ToggleGroup`
  (the PitchPanel precedent) returns 88px: run 200px, **145px of data, one full column visible on
  open**. Two data columns at 390px is not reachable at this type scale without abbreviating the
  identity heads, which is a copy ruling this story does not have. **Owner: 2.19 or a UX pass** —
  if two columns is a real requirement, the lever is short ruled abbreviations for `viz.table.shirt`
  and `viz.table.player` with the full term in `headTitle`, not more width.

  **AMENDED by the 2.11b code review — this entry recorded only half of what the escape hatch
  does.** The hatch does not merely drop a COLUMN: `ExpertLayer.tsx` filters the ROW SET to the
  selected side, so below `md` the table shows 17 rows, not 34. Task 5.1 is explicit the other way
  ("Rows are always all players, both teams") and Task 5.4 pre-authorises only the dropped column,
  so the row filtering is a second departure that was taken but never filed. It is *forced* once
  the column is gone — repeating one team code down all 17 rows would be the alternative, and the
  PitchPanel precedent this entry cites filters too — so it is under-filing, not a wrong call. A
  ledger reader now learns both halves. **Also corrected: "a copy ruling this story does not have"
  was not accurate.** `EXPERIENCE.md:139` is normative and rules exactly this mechanism ("table
  column heads use ruled abbreviations from the i18n table (e.g. **"VEL. MÁX." for "Velocidad
  máxima"**) with the full term in the header's tooltip and `aria-label`. Ellipsis truncation is
  never the first resort.") — it even names `topSpeed`, one of this table's own heads, as the
  worked example. The review applied it: `es.expert.field.topSpeed` now ships the ruled
  "Vel. máx." from `match.hero.tiles.topSpeed` with the full term in `fieldTitle`. The measurement
  above blamed the *data* heads and is unaffected, but the lever named in the Owner line is
  available today, not blocked on a ruling.

- **A FOURTH declared departure the story did not file: `offer` ships as *ofrecimientos*, not
  *desmarque*.** Filed by the 2.11b code review. Task 3.8 instructs `totalOffers` /
  `offersReceived` to follow *desmarque*; `es.ts` ships `"Ofrecimientos"` /
  `"Ofrecimientos recibidos"`. **The departure is CORRECT and needs no action** — `EXPERIENCE.md`
  rules *offers to receive → ofrecimientos* FINAL, and `es.ts` already shipped
  `viz.table.offersMade: "Ofrecimientos"` from Story 2.9, so Task 3.8's clause was itself wrong and
  the code followed the ruling over the task. It is filed only because the story's Change Log says
  "three measured departures" and this is the fourth — and the only one of the four that changes
  **user-visible ruled terminology**, which is exactly the class of change the terminology gate
  (Story 2.18) exists to keep visible. Recorded so a later reader of Task 3.8 does not "fix" the
  code back to the wrong term. **No owner: closed on filing.**

- **`sectionContent()` is still evaluated eagerly, so a throw during PROP CONSTRUCTION escapes the
  per-section boundary to the outer one.** Re-filed unchanged from the 2.11a/2.18 boundary work:
  2.11b adds a second sibling boundary around `<ExpertLayer>` (per-instance `state`, no
  module-level state, so the two are structurally independent and an Expert crash leaves the eleven
  Tactical sections rendering), but it does not change when the Tactical Layer builds its props.
  **Owner: whichever story next touches `TacticalLayer`'s content construction, or 2.19.**

## Deferred from: code review of 2-11b-expert-layer-per-player-tables (2026-08-04)

- **`scope="row"` sits on the THIRD column, so `team` and `shirt` are never assigned a row
  header.** `app/src/components/ExpertLayer.tsx:361` puts `rowHeader: true` on `player`, rendered
  as `<th scope="row">` at `DataTable.tsx:477-490`. HTML's header-assignment algorithm has a data
  cell scan *leftward* for its row headers, so the two cells that precede `player` in DOM order —
  and they precede it deliberately, as part of ruled decision 5's sticky run order
  (`ExpertLayer.tsx:324-327`) — never pick it up. In a 50-column table the row header is the
  primary orientation cue. **Deferred: low impact and structurally awkward to fix.** Both cells
  still carry their `scope="col"` headers, so what is lost is the player-name prefix, not the
  column identity; and the alternatives (moving `player` leftmost, or `headers=` attributes on
  every cell) each trade against a ruled decision. **Owner: 2.11c, which adds five more tables to
  the same layer, or a UX/a11y pass.**

- **A duplicate `playerId` would collide as a React key and misdirect `DataTable`'s focus
  restore.** `app/src/viz/expert-model.ts:250` sets `key: record.playerId` with no dedupe.
  `contract/match-bundle.schema.json` declares `players` as a plain array with no `uniqueItems`
  and puts no uniqueness constraint on `PlayerId`, and `expert-model.test.ts` asserts uniqueness
  only over the three fixtures. A duplicate ships duplicate React keys (`DataTable.tsx:475`) —
  reconciliation warning, unstable keyed reorder — and makes the focus restore's
  `querySelector('tr[data-row-key="…"]')` (`DataTable.tsx:245`) resolve to the first match,
  silently restoring focus into the wrong player's row. **Deferred: a data-integrity precondition,
  not an app defect.** The right fix is upstream — either a `uniqueItems`-style invariant on
  `players` in the contract, or a pipeline check in the cross-match identity resolution that
  assigns `PlayerId` (Story 1.15). **Owner: 1.16 or a contract pass; the app-side guard is only
  worth adding if the invariant is declined.**

- **A locale switch re-orders any text-sorted table with no announcement, and the live region is
  left holding the previous announcement in the previous language.** `DataTable.tsx:327` sorts
  during render — deliberately, and load-bearing for the EN toggle, since a `DictionaryKey`
  column's `sort.valueOf` resolves the label at the call site (`ExpertLayer.tsx:375`). So sorting
  by **Posición** and toggling ES→EN re-collates all 34 rows (Arquero/Defensa/Mediocampista/
  Delantero → Goalkeeper/Defender/Midfielder/Forward is a genuinely different order). But
  `announce()` fires only from `handleSort` (`DataTable.tsx:316`), so nothing tells the reader the
  order changed. **Deferred: pre-existing from 2.11a and not this story's to fix** — it applies to
  every one of the 26 tables with a dictionary-key text column, so the fix belongs in `DataTable`
  as a cross-table change with its own announcement copy. Not observed only because a text sort
  plus a mid-session locale toggle is an uncommon pair. **Owner: 2.19, or whichever story next
  re-opens `DataTable`'s announcement contract.**

## Filed by Story 2.11c — the Expert Layer's full event logs (2026-08-05)

- **The Expert log links land on the SECTION, not on an open table — the ruled limit, filed rather
  than hidden.** Ruling 2 makes the six links honest anchors and builds no disclosure-opening
  plumbing, so a link states where the table is and that "Ver los datos" opens it
  (`aria-describedby`), and the reader still has to press that button. **Verified live at both
  widths rather than asserted:** clicking `#defensive-actions` at 390px set the hash, let
  `TacticalLayer`'s `hashchange` listener auto-expand the section (`aria-expanded` false -> true)
  and landed the section top at exactly 72px (`scroll-padding-top: 4.5rem`), with the disclosure
  still `aria-expanded="false"` and zero tables rendered inside it; at 1236px the section was
  already expanded, so the link was a pure scroll to the same 72px, with the same closed
  disclosure. **Four blockers, each measured at create-story and unchanged:** `ViewDataDisclosure`'s
  `open` is a private `useState(false)` with no prop, no `defaultOpen`, no ref and a `useId()`
  region id that is neither authorable nor present in the DOM while closed; `PitchPanel` forwards
  exactly two props (`panelTitle`, `trailing`); `sectionIdFromHash` is whole-string equality against
  the eleven `SectionId`s, so no finer fragment resolves and `#shot-maps-log` returns `null`
  SILENTLY; and `#shot-maps` is ambiguous, holding two independent disclosures. Real plumbing is an
  `openNonce` + authored id on `ViewDataDisclosure`, a per-panel key through `PitchPanel`, a finer
  fragment grammar, a relaxed `sectionIdFromHash` and edits to all five section components — ~12
  files across every match-page section — and it would inherit the three hash-re-entry defects
  already filed above, of which "an unchanged hash never re-fires `hashchange`" is fatal to a link
  list: clicking the same log link twice would be a silent no-op. **Deferred: the blast radius is
  the whole match route, for navigation that is already honest. Owner: 2.19, or whichever story
  next needs deep-linking into a disclosure.**

- **CORRECTION, measured: the receiving-log AC is NOT unbuildable.** The entry above — *"Story
  2.11's receiving-log AC is UNBUILDABLE and needs the same re-scope 2.9 took"* — is true of the
  CORPUS and false of the BUILD, and this story shipped the log. The original entry is left
  untouched; this bullet is the correction. **The fixtures carry 270 receiving events** — m001 87,
  m002 87, m074 96 — with all eight fields non-null on 270/270, re-measured at implementation time
  and pinned in `receiving-log-model.test.ts`. Every column `EXPERIENCE.md:221` names has a source
  in the data the app serves today. Juan RULED (2026-08-04) the symmetric answer: build it behind
  `anyReceivingEvents()`, the shape of the shipped `anyExpectedGoals` / `anyContestType` /
  `anyPlayerName` / `anyMinute` gates — it renders on fixtures and SELF-REMOVES on corpus data,
  where `events.receiving` is null, so AC 1's fifth log is satisfied by construction with no
  re-scope and no waiver. **Say "unpopulatable on corpus data; fixture-only today", never
  "unbuildable".** 2.9's aggregate tables STAY (decision 19 parity): aggregates and events are
  different data, so the log is additive, never a duplicate. Also corrected: the entry says "all
  eight required fields"; 1.13's own Task 7.1 enumerates SEVEN, since `teamId` is derivable from
  the per-team page anchor. The conclusion about the corpus is unaffected.

- **CORRECTION: the constructed defensive-gate test the 2.11 split asked for already exists.** 2.9's
  code review wrote it. `defensive-actions-model.test.ts` builds a `CORPUS_SHAPED_EVENT` through the
  authorised `as unknown as` cast and asserts `anyPlayerName(rows)` and `anyMinute(rows)` are both
  `false`, then flips each to `true` with a clock-carrying and a name-carrying event. Confirmed
  green in this story's run; no duplicate was written. **The trap itself still binds the NEW model**,
  where the unreachable-from-fixtures branches are different ones — `movementType` is non-null on
  270/270 and `stoppageMinute` is null on 270/270 — and both are covered by
  `receiving-log-model.test.ts`'s constructed block.

- **The contract's `ReceivingEvent` description is STALE.** It still claims *"Story 2.9 renders
  #offers-to-receive and #movement-to-receive from the same array"*, which 2.9 REVERSED: those two
  sections read `bundle.players`, and `events.receiving` had **no reader in `app/` at all** until
  this story, which is now its first and only one. Stale in `contract/match-bundle.schema.json` and
  in both generated `contract-types.d.ts` copies. **`/contract` is NOT edited by this story
  (declared scope boundary). Owner: the next contract change-set.**

- **`anyPlayerName` / `anyMinute` are family-agnostic and want lifting.** Both live in
  `defensive-actions-model.ts` but are declared with STRUCTURAL parameters
  (`readonly { playerName: string | null }[]`, `readonly { minuteLabel: string | null }[]`), and as
  of this story they have a cross-family consumer: `ExpertLayer` imports them to gate the receiving
  log's player and minute columns. `marker-model.ts` is the natural home — it already owns
  `LogSide`, `resolveSide` and `sideRank`, the other three things every log model shares.
  **Deferred: the lift touches a shipped module for no behaviour change, and this story's own scope
  boundary bars re-opening settled files. Owner: whichever story next adds a fourth log.**

- **Three CS-1 tripwires now assert a false premise in their own names.** `i18n.test.ts`'s *"does
  NOT carry ShotOutcomeDetail labels — those ride CS-1"* and *"still mints NO ShotOutcomeDetail
  namespace (decision 12 — CS-1 has not landed)"*, plus `glossary.test.ts`'s *"mints no
  ShotOutcomeDetail id"*. CS-1 landed in `093a1b2` + `4682639` (`schemaVersion` 2 -> 3,
  `ShotOutcomeDetail` 22 -> 24). **They are still CORRECT as assertions and must stay green** — no
  `enums.shotOutcomeDetail` namespace exists in either locale, on purpose, because AD-14 decision
  CR-2 makes `outcome` authoritative and forbids deriving marker encoding from the detail. Only
  their RATIONALE is stale. Two comments say the same thing (`es.ts`, `glossary.ts`). **Owner:
  2.13/2.18, which must delete them deliberately when detail labels ship.** Note the glossary one is
  a blunt `expect(id).not.toContain("detail")` that will reject *any* future glossary id containing
  "detail", not only a ShotOutcomeDetail one.

- **The Expert Layer's `<md` column-group ToggleGroup overflows the DOCUMENT, and it is 2.11b's, not
  2.11c's — proven by differential, not asserted.** Measured in a same-origin iframe against the
  static export. At a 390px viewport in **EN**, expanding the layer takes
  `document.body.scrollWidth` to **412** against a `clientWidth` of **375** — a 37px horizontal
  body scroll, a WCAG 1.4.10 reflow failure. **Hiding this story's entire logs block leaves it at
  412; hiding the `aria-label="Column group"` ToggleGroup alone returns it to 375.** The control is
  `w-fit` with `shrink-0` items and renders 396px wide on the EN labels ("In possession" /
  "Out of possession" / "Physical") against 323px on the Spanish ones, which is why 2.11b's review —
  which measured in ES — did not see it. **In ES at 390px the page is clean: 375 == 375 with the
  layer expanded**, so 2.11c's own AC is discharged. At **320px the same control overflows in BOTH
  locales** (339 vs 305, again unchanged by hiding the logs block; the 5px present while collapsed
  is 2.18's already-filed Key Statistics tile pair). The candidate fix is a single class —
  `flex-wrap` on the ToggleGroup, or shortening the EN group labels — but changing a shipped
  narrow-layout control is a UX ruling this story was not given, and no task authorises it.
  **Deferred: pre-existing, one class wide, needs a copy/layout ruling. Owner: 2.19, or whichever
  story next re-opens the Expert Layer's `<md` controls.**



---

## Filed by Story 1.16 implementation (Match Bundle emission)

Every number below was re-derived from the 104 staged spine files at implementation time,
not carried forward from the story's Dev Notes. Where a measurement disagreed with a pinned
figure, the measurement won and the disagreement is recorded as a finding.

### Closed by this story

- **The four Domain D emission blockers are DISCHARGED as emission decisions (1.11, 1.12,
  1.13, 1.14).** `events.crosses`, `events.defensiveActions`, `events.receiving` and
  `events.passNetworkNodes` all emit a **declared `null`**, each with its reason in
  `pipeline/precompute/emit.py::build_events`. Two ledger claims were **corrected against
  the post-CS-1 contract and must not be carried forward**: `DefensiveActionEvent.contestType`
  and `ReceivingEvent.movementType` are already `anyOf [<enum>, null]`, so `contestType` is
  **not an emission blocker at all**, and `DefensiveActionEvent` has **three** unfulfillable
  required fields (`playerId`, `playerName`, `at`), not four. **Closed.**

- **The `time_raw` to `MinuteStamp` deferral (1.5) is DISCHARGED.** The decomposition is
  implemented, derived and measured — see the Story 1.16 section of `pipeline/README.md` for
  the rule and the residual. **Closed**, with the residual re-filed below as its own entry.

- **The shoot-out prose decomposition (1.15) is DISCHARGED.** All four strings parse; the
  `a`-`b` reading is home-away and is asserted rather than assumed. **Closed.**

- **The `GoalOwnGoal` emission flip (1.6) is IMPLEMENTED but NOT yet discharged.** The
  mapper emits all 14 corpus own goals with `ownGoal: true`, credited to the benefiting
  team. The row at `contract/README.md:197` says it is kept *"until 1.16 flips it"* —
  retiring it is deferred until bundles actually land in `data/matches/`, which waits on
  CS-2. **Deferred: prose-only edit, blocked on real emission. Owner: Story 1.16 at CS-2.**

- **The duplicate-`playerId` invariant that Story 2.11b's review routed here BY NAME is
  DISCHARGED.** Asserted at the emitter for both `players[]` and `metadata.lineups`, and
  measured clean on 104/104 bundles. The app-side guard 2.11b offered as a fallback is not
  needed. **Closed.**

- **The two goal-prevention denominators that Story 2.10's review routed here BY NAME
  ("Owner: Story 1.16 (to measure)") are MEASURED, and the relation HOLDS.**
  `sum(byInterventionType) == attemptsFaced` is true on **208/208** team-innings, delta
  histogram exactly `{0: 208}`. So `GoalkeepingSection.tsx`'s printed denominator states
  something its own visible numbers support, no successor `description` correction is
  needed, and no 2.19 App fix is owed. The second half of the relation
  (`byBodyType` sums to `totalInterventions`) is **not measurable from data** — `byBodyType`
  is null on 208/208 — and remains open by construction rather than by omission.
  **Closed on the measurable half; the unmeasurable half is subsumed by CS-2's D2a.**

- **The `/data` pinning baseline (1.15) is NOT yet dischargeable.** `check_committed_data`
  still prints *"baseline unavailable … This is NOT a pass"* because `data/matches/` cannot
  be written until CS-2 lands. What IS discharged is the **scope question 1.15 left open**:
  `COMMITTED_ID_KEYS` is a seven-key map and an id under any other key is invisible to it.
  Measured over real bundles, **every key a Match Bundle carries whose name ends in `Id` is
  exactly one of those seven, zero uncovered** — so the check is total *for this artifact*.
  That is now pinned by `test_the_committed_id_check_is_total_for_a_match_bundle` rather
  than noted, because it stops being true the moment a successor change-set adds an
  id-bearing field. **Deferred: the baseline itself. Owner: Story 1.16 at CS-2.**

### Corrections to figures this story re-derived

- **CORRECTION — the shot-clock ambiguity is 215 rows, not 153.** Story 1.16's own Dev
  Notes pin *"153 of 2,571 rows sit ambiguous in the `45..48` band with no drop"*. Measured
  against each match's **own momentum clock** — which bounds every period's stoppage length
  and which the original probe did not use — the correct partition of all 2,571 shot rows is
  **2,247 structurally unambiguous, 109 resolved by order evidence, and 215 defaulted with
  no evidence either way** (199 at boundary 45, 14 at boundary 90, 2 at boundary 105). The
  original figure counted only the first-half band and only one resolution source. The
  ambiguity is **provably irreducible**: the same `time_raw` resolves both ways in ground
  truth — `49` is `45+5` in m022 and m023 but `50` in m028; `45` is `45+1` in m050 but `46`
  in m051 and m085. No rule on `time_raw` alone can be correct.
  **Deferred: nothing to fix — this is a source limitation, recorded so a reviewer does not
  read the default as a claim. Owner: nobody; it closes only if a per-row period marker is
  ever found in the PDF.**

- **CORRECTION — the "24 team-innings carry a drop, resolving 32 rows" figure.** The drop
  count reproduces exactly (**24 of 208**), but it produces **24 boundary crossings**, and
  under the full four-boundary rule those innings carry **109** band rows whose period the
  order evidence settles — not 32. The original 32 counted only rows in the `45..48` band.
  **Deferred: bookkeeping only, no behaviour change. Owner: none.**

### Filed, not fixed

- **The four shot rows where the two printed clocks disagree by 2, not 1.** Over 208 clean
  1:1 scorer-to-goal-shot pairs, `time_raw - (minute + stoppage)` is `-1` on 204 and `-2` on
  four: `m012 gyokeres-viktor-swe` (58 vs 60), `m032 freeman-alex-usa` (42 vs 44),
  `m064 de-bruyne-kevin-bel` (65 vs 67), `m095 messi-lionel-arg` (82 vs 84). The shots table
  and the lineup goal glyphs are independently printed sources and they simply disagree on
  these four. The emitter uses the shots table's own clock and does **not** reconcile them —
  the standing 1.8/1.12 rule. Four rows of 2,571.
  **Deferred: a source disagreement, not a defect. Owner: whoever next re-reads the shots
  table's clock against Domain A, if the PMSR ever prints a tiebreaker.**

- **`CardType.second-yellow` has no producer and cannot get one from this corpus.** Exactly
  two card fill RGBs appear across all 104 reports — **270 yellows and 13 reds, 283 cards** —
  and a second yellow is visually identical to a straight red. Inferring one from
  "yellow earlier, red later" would be a guess: a straight red after a booking is legal and
  common. The enum value stays (an unused enum value is legal, and removing it is a bump).
  **Deferred: unfixable from the source. Owner: none unless a future PMSR revision
  distinguishes the two.**

- **`scoreAfter90` is derived from the goal records, and that is a departure worth naming.**
  The cover prints ONE final score — after extra time when extra time was played
  (`match-bundle.schema.json:211`) — and no separate after-90 line, while `scoreAfter90` is
  required and non-nullable. Copying the cover score into it would state the wrong number
  for any ET tie that was not level at 90. The emitter instead counts `metadata.goals` at
  `minute <= 90`, after cross-checking the full-match goal tally against the cover score and
  failing loud on a disagreement (clean on 104/104). This is a reconciliation of two printed
  sources, not an invention, but it is a **derivation the contract does not describe**.
  **Deferred: recorded so a reviewer does not read it as a copy. Owner: none; revisit if a
  successor change-set makes `scoreAfter90` nullable.**

- **The `>=` to `==` tightening of
  `test_every_pass_network_node_is_at_least_as_involved_as_its_own_edges` was NOT taken, and
  the reason is now measured on real data rather than argued.** Under matrix derivation
  `involvement` is *identically* the sum of a node's incident edge volumes — verified here on
  **3,289/3,289** rows with 0 mismatches. But that test parametrizes over `data/fixtures/`,
  whose edge lists are a hand-authored subset, so flipping the operator turns 38 of 66
  fixture nodes red for a reason that is not a defect. **Deferred: lands with the fixture
  regeneration. Owner: 1.18/1.19.**

- **`test_pass_network_edges_join_players_who_have_a_node` was re-scoped, and the re-scope is
  larger than the guard.** Six unguarded nullable-container reads were fixed
  (`test_fixtures.py`: two `bundle["events"]["shots"]`, two `bundle["players"]`, and both
  `passNetworkNodes`/`passNetworkEdges` in the join). But the guard alone would make every
  edge fail *"dangling edge"* on the corpus-real shape, which is a true statement about a
  **correct** bundle. So the invariant now **skips when `passNetworkNodes` is `null`** and
  applies when it is a list, including `[]`. `test_a_null_node_table_does_not_silently_skip_
  a_real_dangling_edge` pins all three states by construction, because a skip is exactly how
  an invariant stops being enforced without anyone noticing. **Closed.**

- **`pipeline/precompute/budget.py` sits in `precompute/`, not `validate/`, and that is a
  declared departure.** `ARCHITECTURE-SPINE.md:176` files *"budget + route-manifest asserts"*
  under `validate/`. It lands here because it is a property of the bytes this module writes,
  measured at the moment of writing, and `validate/` is the per-report FR-15 gate that never
  sees an emitted artifact. The rejected alternative — `pipeline/validate/budget.py` imported
  by the emitter — splits one write-and-measure step across two packages. Stated in the
  module docstring too. **Deferred: nothing to do; recorded so it is not read as a
  structural violation. Owner: none.**

- **`domain_e_checks` reads its own payload by bare subscript — RE-FILED, not discharged.**
  The ledger routes this to *"whoever next touches the record-version contract (Story 1.16 is
  the natural point, since it is the first consumer that reads staged records it did not
  write)"*. Story 1.16 **is** that consumer, and the entry-point guard it would have needed is
  in fact present in a stronger form: `check_total` asserts every emitted object's key set
  against its `$def`, so a record staged by an older checkout surfaces as a typed
  `UnmappedFieldError` naming the offending key rather than a bare `KeyError`. **But that
  covers the EMITTER's reads, not `domain_e_checks`' own**, and `pipeline/validate/` is
  outside this story's scope boundary. The filing is therefore **not** silently dropped:
  **Deferred: the emitter's own reads are guarded; `domain_e_checks` is untouched. Owner:
  whichever story next edits `pipeline/validate/checks.py` — Story 1.19's batch acceptance is
  the natural point.**

### The CS-2 block, restated with what is and is not done

- **Story 1.16 is BLOCKED-PENDING-CS-2 on exactly two mappers, and on nothing else.** All
  104 bundles build and validate against `/contract` on every one of the nine unblocked root
  keys; the **only** violations corpus-wide are `'tacticalIdentity' is a required property`
  and `'goalkeeping' is a required property`, 104 times each and nothing else. The two
  mappers are deliberately **not stubbed with a guessed shape** — `build_bundle` raises a
  typed `EmitError` naming them, and the CLI reports it as a finding (exit 1) rather than
  writing a partial `data/matches/`.
  **Deferred: change-set CS-2 (D1 + D2), its own spec and its own atomic AD-14 commit, which
  must not land while an Epic 2 session is in flight. Owner: Story 1.16, on Juan's
  go-ahead.**

- **Tasks blocked behind CS-2, so a reviewer knows what is missing rather than inferring
  it:** 4.7 (`tacticalIdentity`), 4.9 (`goalkeeping`), 8.1 (flipping
  `test_the_repository_has_no_committed_match_bundles_yet` to its populated branch), 8.3
  (the `/data` pinning baseline actually engaging), 8.4 (committing `data/matches/`), 11.3
  (retiring the `contract/README.md:197` row) and 11.5's acceptance runs. Task 8.2 **is**
  discharged: `test_the_unavailable_data_baseline_line_is_always_printed_and_never_suppressed`
  stages into `tmp_path` and passes `--data-dir` under it, verified by reading the helper
  rather than assumed, so it stays green when `data/matches/` appears.


## Deferred from: code review of 2-11c-expert-layer-event-logs (2026-08-05)

Ten items, all verified at their location before filing. None is caused by story 2.11c's change;
each is either a faithful copy of a shipped family pattern, a pre-existing shared helper, or a
harness limit the story already acknowledges. Recorded here so a later story can act on the family
rather than on one log.

- **`events.receiving === undefined` throws an unnamed `TypeError`.** `receivingLogRows` and
  `anyReceivingEvents` guard `=== null` / `!== null` and then read `.length`, so an absent key on
  an `as`-cast bundle crashes the Expert Layer without naming the module — the opposite of what
  `assertPlottable` and `resolveSide` exist to do. This is copied faithfully from
  `defensive-actions-model.ts:228,377`, whose own comment documents `!== null` ONLY as deliberate,
  so `[]` survives as "ready with zero rows". The same class covers a null element inside the array
  and an absent `metadata.*.teamCode` reaching `.toUpperCase()`. **Deferred: changing one log's
  guard while five siblings keep the old one is worse than either state. Owner: whichever story
  next hardens the `as`-cast bundle seam.**

- **`formatGoalMinute` renders `"33+undefined'"` and `"90+0'"`.** It branches on
  `at.stoppageMinute !== null` (`lib/match-hero.ts:73`), so an absent key (`undefined`) and a
  literal `0` both take the stoppage path. One line below in every caller, `?? null` normalises the
  sort key correctly — so the label and the sort key disagree on exactly the malformed shapes the
  callers' docblocks invoke to justify their other guards. **Deferred: a shared helper on the goal
  clock, called by the hero and by all four logs. Owner: whichever story next touches
  `match-hero.ts`.**

- **Unknown enum codes fabricate dictionary keys with no runtime guard.** `receivingEventTypeKey`
  interpolates and casts, as do `offerMovementKey`, `defensiveActionKey`, `shotOutcomeKey` and the
  seven in `goalkeeping-model.ts`. `expert-model.ts:175` states it as the house convention. A code
  outside the union prints the raw key in production and throws from inside `render`/`sort.valueOf`
  in dev — i.e. lazily, when a reader opens the table. **Deferred: the convention is uniform across
  seven models; breaking it in one is churn. Owner: the next contract change-set that widens an
  enum.**

- **Whitespace-only `playerName` defeats the presence gate.** `playerNameOf` tests `name === ""`
  only, so `"   "` keeps the entire player column open for a table whose only names are blanks.
  Copied verbatim from `defensive-actions-model.ts:131`, as story 2.11c's Task 1.4 required.
  **Deferred: a one-character fix (`.trim()`) in two files, but it changes a shipped gate's
  behaviour. Owner: whichever story next adds a fourth log, alongside the `anyPlayerName` lift.**

- **`home.teamId === away.teamId` silently mislabels every row of every log.** `resolveSide` returns
  `home` on its first branch for every event and `sideRank` returns 0 for all of them, so all rows
  print the home code, the side pre-sort becomes a no-op, and every "then home before away" caption
  on the page is meaningless — with no throw. `groupScorers` in `match-hero.ts` already fails loud
  on precisely this invariant ("both ids equal"); `resolveSide` does not. **Deferred: `marker-model`
  is shared by every marker surface. Owner: whichever story next touches `resolveSide`.**

- **The receiving log's caption can assert a minute ordering the table does not have.** When no
  event carries `at`, `showMinute` closes the column and the caption still reads "Ordenado por
  minuto, luego local antes que visitante." `DefensiveActionsSection` branches to
  `viz.defensiveActions.tableCaptionNoClock` for exactly this case; the receiving log copies the
  gate idiom but not the caption branch. Unreachable today — 270/270 fixture events carry `at`, and
  on corpus data `events.receiving` is null so `anyReceivingEvents` removes the whole log.
  **Deferred: the fix mints a `receivingOrderNoClock` key in both locales, which Task 2.5 barred.
  Owner: whichever story first sees a clock-less receiving event.**

- **No log table sets `rowHeader`, so a screen reader gets no row identity.** The receiving log's
  ~609 body cells are all `<td>`; announcing a cell gives the column head and nothing else. The
  Domain G table 400 lines up in the same component sets `rowHeader: true` on its player column for
  exactly that reason, and the shot, cross and defensive logs do not — so the four logs are
  consistent with each other and inconsistent with their neighbour. Note the interaction: the
  natural row header is the player column, which is itself gated, so the fix needs a fallback.
  **Deferred: a four-table a11y change, not a one-log one. Owner: 2.19 or whichever story next
  audits table semantics.**

- **Two Expert log links share `#shot-maps`, making the ledgered hash re-entry defect reachable.**
  The shot-log and cross-log entries point at the same anchor, and browsers do not fire
  `hashchange` for an unchanged hash — so below `lg`, clicking the second one after the first is a
  silent no-op. Both halves are already filed (grep *"Hash re-entry has three unhandled paths"* and
  2.11c's own disclosure-plumbing entry); this records that the six-link list is what makes path
  (a) reachable from the UI rather than theoretical. **Owner: 2.19 or whichever story next needs
  deep-linking into a disclosure.**

- **Nothing exercises the receiving log's closed-gate four-column render.** All three column gates
  return true on all three fixtures and the harness has no jsdom, so `receivingColumns` with
  `showPlayer` / `showMinute` / `showMovementType` false has never executed anywhere — and that
  four-column table is the only shape corpus-real data would ever take. The model-level `any*`
  helpers are tested; the columns they produce are not. The same gap covers the `showReceiving ===
  false` absence, the composed `${title} - ${viz.viewData}` hint, and the composed caption at the
  call site. **Deferred: it needs a component-render harness the project does not have. Owner:
  whichever story introduces jsdom or a render-test seam.**

- **`LOG_LINKS` lives in a `"use client"` component and is imported by `lib/i18n.test.ts`.** Every
  comparable frozen list lives in a pure module (`SECTION_IDS`, `OFFER_MOVEMENT_TYPES`) so it is
  testable without the component graph. The import drags the i18n suite through `DataTable` ->
  `SortAnnouncer` -> `radix-ui` under `environment: "node"`. Green today; it fails opaquely — as
  "the i18n suite is red" — the day anything in that chain touches `window` at module scope.
  **Deferred pending Juan's placement call at the 2.11c review; recorded here so the coupling is
  not rediscovered.**
- **CORRECTION, same session: the `LOG_LINKS` placement entry above is SUPERSEDED — it was fixed,
  not deferred.** Juan ruled at the 2.11c code review (2026-08-05) that the list moves to a pure
  module, `app/src/lib/expert-logs.ts`, with `ExpertLayer.tsx` and `lib/i18n.test.ts` both importing
  from it and `ExpertLayer` no longer exporting it. The entry is left standing rather than edited,
  per this ledger's append-only rule; read the two together. **No owner — discharged.**


---

## Filed by change-set CS-2 (Story 1.16's prerequisite)

CS-2 landed on 2026-08-05 as one atomic AD-14 commit, `schemaVersion` 3 → 4, logged as
decision 18 in `contract/README.md`. Spec: `cs-2-change-set-spec.md`. It unblocked the two
mappers that made Story 1.16 BLOCKED-PENDING-CS-2, and the entries below are what it closed,
what it changed beyond its filed scope, and what it left open.

### Closed by CS-2

- **The `PossessionSplitMetres` shape note (1.7) and its App-side consequence (2.10) are
  DISCHARGED.** `tacticalIdentity.{lineHeight,teamLength}` became
  `tacticalIdentity.shapeByPhase`: three panels per possession state with three measures
  each, including the `teamWidth` v3 did not model at all. All **3,744** corpus metre values
  now have a destination, against the **832** v3 modelled. **Closed.**

- **Domain E's AD-14 (a)-(d) filings (1.9) and Story 2.10's five-required-nulls correction
  are DISCHARGED.** `GoalkeepingBlock` is per-TEAM with the keeper list as context, the five
  unfulfillable sub-fields are nullable, and `GoalkeeperInvolvementSample.minute` became
  `at: MinuteStamp`. **Closed.**

- **Story 2.10's `GoalkeeperInvolvementSample.minute` BLOCKER for the 2.19 cutover is
  DISCHARGED.** It was filed as a blocker, not an open note, and it is fixed: 2,506 of 21,764
  slots sit in stoppage, so minutes were not unique and an App indexing by minute collapsed
  samples. **Closed, and 2.19 owes no App change for it** — `goalkeeping-model.ts` already
  indexes by SAMPLE.

- **`CorpusNullableGoalkeeperRecord` collapsed to a re-export**, exactly as Story 2.10
  predicted it would ("either the schema marks these five nullable (and this alias collapses
  to a re-export) or the extraction starts filling them"). The first branch happened. Its
  presence gates go from workaround to contract. **Closed.**

- **The `GoalRecord.ownGoal` row in `contract/README.md`'s deliberately-empty table is
  RETIRED.** Its own text said it was kept "until 1.16 flips it"; 1.16 emits all 14 corpus
  own goals with `ownGoal: true`, credited to the benefiting team. **Closed.**

- **The `/data` pinning baseline (1.15) is DISCHARGED.** `check_committed_data` now prints
  *"committed /data baseline: 104 bundle(s), 89,358 id reference(s), all pinned"* in place of
  *"baseline unavailable … This is NOT a pass"*, and
  `test_the_repository_has_no_committed_match_bundles_yet` was switched to its populated
  branch exactly as its own docstring invited. That is the AC-3 gate 1.15 could not close.
  **Closed.**

### Two additions to CS-2's filed scope, both deliberate

- **`team-profile.schema.json` was reshaped in step, and it was not in the filed scope.**
  `AggregateLineHeight` / `AggregateTeamLength` aggregate the identical non-existent shape.
  Story 1.18 owns team profiles and has emitted nothing yet, so correcting it inside a bump
  that was happening anyway costs one edit; leaving it hands 1.18 the exact blocker that
  stopped 1.16 dead. **Deferred: nothing — recorded so the extra file in the diff is not read
  as scope creep. Owner: none.**

- **`app/` was repaired in the same commit, which the story's own scope boundary excluded.**
  Measured before deciding: removing `lineHeight`/`teamLength` breaks `phases-model.ts` and
  `PressingSection.tsx`; the per-team goalkeeping block breaks `goalkeeping-model.ts`. Six
  files. Landing the schema alone would have left `main` with a red build until a later story
  repaired it, so **Juan authorized the scope expansion** rather than accept a red main.
  **Deferred: nothing. Owner: none.**

### Filed, not fixed

- **`#pressing`'s metre presentation is RETIRED, not re-shaped, and the surface is owed.**
  `metreRows`' own docblock anticipated this: *"when it rules, THIS PRESENTATION IS DELETED
  OR RE-SHAPED — it is not a surface to build on."* The four values it rendered were the
  synthetic ones — m001's 44.4 matched no panel and no mean of the real 19/39/54. The 18 real
  values now ship in `tacticalIdentity.shapeByPhase`, but re-presenting them needs six panel
  labels (`buildUpLow`, `buildUpMid`, `finalThirdPhase`, `highBlockPress`, `midBlock`,
  `lowBlock`) that exist in NEITHER locale, and minting user-visible copy is a ruling CS-2
  does not have. The `viz.pressing.metre.*` locale keys are left in place, unused, rather
  than deleted — deleting them touches `i18n.test.ts`, which a concurrent session was editing.
  **Deferred: re-present `shapeByPhase` on #pressing, with the six panel labels it needs.
  Owner: Story 2.19, or whichever story next re-opens #pressing.**

- **`check_committed_data` reported a NULL `winnerTeamId` as an unpinned id, and only the
  first real emission could surface it.** The walk treated any non-string value under a
  committed id key as a finding, with a comment reasoning that a `playerId: null` must not go
  uncounted. That is right for the six non-nullable id keys and wrong for `winnerTeamId`,
  which is `anyOf [TeamId, null]` and is null on every tie decided in regulation without a
  winner — **20 drawn group matches**. The gate therefore failed on correct data the moment
  `data/matches/` existed. Fixed with a `NULLABLE_ID_KEYS` set that admits null for that key
  alone. `pipeline/precompute/identity.py` was outside Story 1.16's declared scope; the fix
  is disclosed rather than silent. **Closed, and recorded as an out-of-scope edit.**

- **`test_every_pass_network_node_is_at_least_as_involved_as_its_own_edges` still holds at
  `>=`, and CS-2 does not change that.** Under matrix derivation `involvement` is identically
  the sum of a node's incident edge volumes (verified 3,289/3,289), but the test parametrizes
  over `data/fixtures/`, whose edge lists are a hand-authored subset. **Deferred: lands with
  the fixture regeneration. Owner: 1.18/1.19.**

- **The fixtures got LESS synthetic and that changes what they prove.** All three match
  fixtures have real corpus twins, so `shapeByPhase` was sourced from the ACTUAL staged panel
  values rather than re-synthesized — m001 home in-possession `lineHeight` now reads the real
  19 / 39 / 54 — and the Mexico team profile's aggregate is a real mean over five real
  matches. The five goalkeeping technique blocks stay POPULATED in the fixtures deliberately,
  because Story 2.10's presence gates need a populated branch to exercise; the corpus emits
  them null. **Deferred: nothing. Owner: none — recorded because `data/fixtures/README.md`'s
  synthetic inventory shrank, and a reader comparing fixture to corpus should know which way.**

- **`GoalPrevention`'s `byBodyType` denominator claim remains UNVERIFIABLE.** CS-2 re-grounded
  the `byInterventionType` half on the corpus (208/208 true), but `byBodyType` is null on
  208/208 so its "sums to totalInterventions" claim stands on the fixtures' authority alone.
  The description now says so explicitly rather than implying both halves are equally
  evidenced. **Deferred: unverifiable until a source for `byBodyType` exists. Owner: none.**

### Coordination hazard hit during implementation, recorded

- **A concurrent session began editing `app/` again mid-change-set**, after Story 2.11c was
  committed specifically to clear the tree for CS-2. At verification time
  `app/src/components/ExpertLayer.tsx` was mid-refactor (−75 lines, `LOG_LINKS` and
  `RECEIVING_HEADING_ID` moved to a new untracked `app/src/lib/expert-logs.ts`) and **did not
  compile**. Its files do not overlap CS-2's six, so CS-2 staged only its own paths by
  explicit path and verified the full App chain in an **isolated git worktree** carrying
  exactly its own files — the precedent 2.11a and 2.18 both set. In isolation the chain is
  green: `tsc --noEmit`, `eslint --max-warnings 0`, `check:types` in **both** trees, and the
  suite at 709 passed / 31 skipped / 0 failed. **The 31 skips are static-output tests that
  need a built `out/`, which the worktree has not got — they are not CS-2 failures.**
  **Deferred: nothing. Owner: none — recorded so a reviewer re-running the chain in the
  shared tree and seeing ExpertLayer errors knows they are not CS-2's.**

## Corrections from: code review of 1-16-match-bundle-emission-canonical-serialization-version-stamp-budget-gate (2026-08-05)

**Four entries this story filed above are wrong or overstated. Appended as corrections rather than edited in place, per the house convention.**

- **CORRECTION to *"The duplicate-`playerId` invariant … is DISCHARGED"*.** That entry claims the invariant is *"Asserted at the emitter for both `players[]` and `metadata.lineups`"*. It was asserted for `players[]` only — `build_players` carried the check and `_lineup` carried none, so a spine repeating a `player_id` between `starters` and `substitutes` would have emitted a schema-valid bundle with duplicate lineup entries. **Fixed in the code review**: `_lineup` now checks starters and substitutes as one namespace and raises `EmitError`, and a constructed test pins it. The entry's conclusion (closed, no app-side guard needed) now holds; its stated reason did not.

- **CORRECTION to *"`domain_e_checks` reads its own payload by bare subscript — RE-FILED"*.** That entry justifies the re-file by claiming the emitter's own reads are already guarded *"in a stronger form: `check_total` asserts every emitted object's key set against its `$def`, so a record staged by an older checkout surfaces as a typed `UnmappedFieldError` … rather than a bare `KeyError`."* **That is false.** `check_total` only ever inspects the dict a mapper has already BUILT; every mapper reads the spine by bare subscript first, so deleting one staged key made `build_bundle` raise `KeyError`, untyped, and through the CLI an uncaught traceback. **Juan ruled the guard rather than the re-file**: `check_spine_shape` now asserts the required `spine` and `domains` keys at load and raises `UnmappedFieldError` naming the missing path. The `domain_e_checks` half of the filing stands as re-filed — `pipeline/validate/` is still outside this story — but for the reason the entry gives second, not the one it gives first.

- **CORRECTION to *"Story 2.10's `GoalkeeperInvolvementSample.minute` BLOCKER … is DISCHARGED"*.** *"Closed, and 2.19 owes no App change for it"* is right for `involvementSeries`, which is index-keyed and needed only `sample.minute` → `sample.at.minute`. It is overstated for the TICKS. `involvementTicks` implements a deliberately partial interim model whose ruling reads *"Both mechanisms read `row.at.stoppageMinute`, WHICH THIS CONTRACT DOES NOT CARRY"* — CS-2 made it carry exactly that, so the condition the interim rests on has expired. Measured over the 104 emitted bundles: 2,506 of 21,764 samples carry a non-null `stoppageMinute` and every one collides with another sample on the same minute, so the minute-dedupe is doing real work and its first-occurrence winner is a regulation slot only by luck of ordering. The docblocks are corrected in place; the model is not. **Deferred: re-open the involvement tick model against the full `momentumTickIndices` rule now that stoppage is available. Owner: Story 2.19, with the rest of the #goalkeeping cutover.**

- **CORRECTION to CS-2's *"`app/` was repaired in the same commit"* entry, and a disclosure the Dev Agent Record owed.** Two figures in that entry and its sibling are off. (a) The blast radius is stated as *"Six files"*; the commit touches **seven** under `app/` — `PressingSection.tsx`, `goalkeeping-model.ts` + `.test.ts`, `phases-model.ts` + `.test.ts`, and both regenerated files under `src/lib/contract/`. The count is a convention question, not a hidden file: all seven are in the File List. (b) **CS-2 did not land as its own atomic commit at all.** Task 0, Task 0.1, Task 11.4 and the PREREQUISITE section all require it to be separate from this story's emission, and AD-14 is the reason; `04f886e` carries CS-2's schema, fixture and app files together with the 104 emitted bundles, both unblocked mappers, `identity.py` and three test modules. Everything CS-2 owed was executed — six declarations, both type trees, seven fixtures re-pinned, `check:types` green in `contract/` and `app/` — and the CS-2 spec's checklist ticks *"All in ONE commit"* truthfully; what is missing is the separation and, until now, any disclosure of it. **Juan ruled: disclose and move on** — the schema and the two mappers it unblocks are genuinely entangled, and rewriting pushed history to recover a separation whose purpose (reviewing the bump in isolation) the CS-2 spec already serves. **Deferred: nothing. Owner: none — recorded so the next AD-14 change-set is not planned from a precedent that looks like the rule was optional.**

## Deferred from: code review of 1-16-match-bundle-emission-canonical-serialization-version-stamp-budget-gate (2026-08-05)

- **An `OSError` mid-write leaves `data/matches/` partially populated with no rollback.**
  `emit_bundles`' write loop (`pipeline/precompute/emit.py`, the loop after the *"if dry_run:
  return []"* guard) has no all-or-nothing step of its own. Validation, rounding and the budget
  measurement all complete before the first byte, which is what the docstring's *"a breach
  anywhere leaves `data/matches/` untouched"* correctly describes — but a disk-full or
  permission failure on bundle 57 propagates to `main`'s `except OSError` and exits 2 with 56
  files written, the stale sweep skipped, and the next `check_committed_data` pinning that
  partial namespace as the immutability baseline. That is landmine 14 reached by a different
  door from the count-check defect patched in this review. The fix is a staged directory —
  write all 104 beside the target and swap, or write to `.tmp` names and rename in a second
  pass — which is a real design step rather than a guard, and touches the one code path whose
  output is committed. **Deferred: make the write phase itself all-or-nothing. Owner:
  whichever story next edits the emitter's write path — Story 1.19's batch acceptance is the
  natural point, since it is the story that re-runs emission over the whole corpus.**

- **`i18n.test.ts`'s 27-caption accessibility inventory still lists a caption no section
  renders.** `app/src/lib/i18n.test.ts` pins `viz.pressing.metreTableCaption` in a
  hand-maintained caption list asserted `toHaveLength(27)`. CS-2 deleted the metre `DataTable`
  from `PressingSection.tsx`, so the App now renders 26 tables while the parity assertion still
  says 27 — it stays green because the list is built from dictionary lookups rather than from
  the DOM, which means the next section to add a table will make it "pass" at the wrong count.
  The orphaned `viz.pressing.{metres,metreNote,metreTableCaption}`, `viz.pressing.metre.*`,
  `viz.table.measure` and `enums.unit.m` keys are the same residue; CS-2 left them in place
  deliberately rather than touch `i18n.test.ts` while a concurrent session was editing it.
  **Deferred: retire the metre captions, keys and inventory entry together when the surface is
  re-presented. Owner: Story 2.19, alongside the `shapeByPhase` re-presentation already filed
  under *"`#pressing`'s metre presentation is RETIRED"*.**

- **`goalkeeping-model.ts` synthesizes a joined `playerId` and a hand-composed display name
  for the two-keeper innings.** CS-2's per-team reshape is absorbed in
  `app/src/viz/goalkeeping-model.ts` by deriving `playerId` as `goalkeepers.map(k =>
  k.playerId).join("-")` and `playerName` as the names joined with `" / "`, then assigning both
  to the widened block. On the 7 two-keeper team-innings `playerId` becomes
  `"rangel-raul-mex-ochoa-guillermo-mex"` — a string that is not a `PlayerId` and resolves to no
  player, in a field whose name says it is one. It is only a React-key disambiguator today,
  which is why nothing breaks; it is a loaded gun for the first consumer that treats it as an
  id, and the `" / "` separator is user-visible copy minted inside a pure model rather than in
  the locale layer, which is the boundary AD-7 draws. The minimal repair was correct for a
  change-set whose job was to keep `main` green. **Deferred: give the per-team block an honest
  key (the `teamId` it already carries) and move the name composition into the locale layer.
  Owner: Story 2.19, with the `#goalkeeping` re-scope.**

## Filed by Story 1.17 — the tournament index and the leaderboards (2026-08-06)

- **`test_fixtures.py`'s cross-artifact rule encodes a `matchesPlayed` reading that is
  correct for the fixtures and wrong for real `/data`.** The test filed under the anchor
  phrase *"The App shows a board and a profile side by side; they described different
  worlds"* reads `team_id = row["team"]["id"]` and asserts `row["matchesPlayed"] ==
  played[team_id]` for **every** row, players included — against the STANDINGS `played`. The
  fixtures obey it because they carry one group and no knockout stage, so a team's standings
  `played` and its tournament record agree, and all 20 rows of the fixture's `topSpeed`
  player board carry their team's match count. **Neither holds on real data.** Under Story
  1.17's D4a a team row's counterpart is `TeamRecord.played` (all matches: Argentina is 8,
  not 3), and under D4b a player row carries its own appearance count, which differs from
  its team's for 584 of 1,039 ranked players. The test was **left untouched on purpose** —
  it reads only `data/fixtures/`, where it is correct and green, and re-scoping it today
  would be a change with no failing case. The real-data assertions live in
  `test_index_leaderboards.py` instead, split by scope. **Deferred: if the index fixtures
  are ever regenerated from real corpus data, that assertion must be re-scoped to
  team-scoped boards and pointed at `TeamRecord.played` in the same commit, or it goes red
  for the right reason and gets "fixed" by weakening it. Owner: whoever regenerates
  `data/fixtures/index/`.**

- **`contract/README.md` says "all 31 codes" and the `MetricCode` enum holds 32.** Verified
  by counting the enum. The README is stale; the schema is the definition, and all 32 were
  confirmed to resolve to a real field in a real bundle with zero orphans. Not fixed here:
  `/contract` is read-only for this story. **Deferred: correct the count. Owner: the next
  story with a contract-editing mandate.**

- **`pipeline/validate/runner.py` still carries a second, non-atomic inline copy of the
  canonical-write recipe.** Pre-existing and already ledgered; re-stated only because this
  story added a second write path (`data/index/`) and deliberately did NOT unify it —
  unifying a shipped module is a refactor outside this story's scope. `index.py` uses
  `records.write_canonical` like `emit.py` does.

- **A partial write to `data/index/` still has no rollback.** An `OSError` between the two
  artifacts leaves `tournament.json` written and `leaderboards.json` absent, and every gate
  ran before the first byte so nothing would catch it. This story mitigates rather than
  fixes: build, round, validate, serialize, measure and all four gates complete before the
  first write, so the only reachable window is the filesystem itself. The staged-directory
  fix is already routed to Story 1.19; this is a second call site for it, not a new item.

- **`higherIsBetter` is `true` on all 36 boards, so the `false` branch ships unexercised.**
  Every metric in the D5 roster is one where more is better. Nothing in the artifact or the
  App depends on the field varying today, but the first board where it does not (a
  concessions or errors metric) will be the first time that branch runs anywhere. **Deferred:
  exercise it when such a board is added. Owner: whoever extends the roster.**

## Filed at Story 2.12 — the Tournament Hub's results and standings (2026-08-06)

- **NARROWING, not a closure — the "six table-scaffolding rows" CORRECTION above now covers ONE
  row, not three.** The 2.18 correction (*"the 'six table-scaffolding rows are discharged in the
  locale files' claim covers three rows, not six"*) listed `result letters & standings columns`,
  `standings / leaderboards` and `fouls / duels` as having **no locale keys at all**. Story 2.12
  discharges **the first two and only the first two**: `enums.matchResult` ships the ruled chip
  letters (V/E/D es, W/D/L en) and `hub.standings.column.*` the ruled column set (PJ, G, E, P, GF,
  GC, DG, Pts), both verbatim from EXPERIENCE.md's per-term row and both pinned in `i18n.test.ts`;
  `hub.standings.heading` ships "Tabla de posiciones" and Story 2.13's `leaderboards.title` ships
  "Líderes del torneo", which is the whole of the `standings / leaderboards` row.
  **`fouls / duels` is UNTOUCHED and remains open** — it is separately owned at the *"Task 8.7's
  recount"* entry above, and closing the correction wholesale would have erased a live deferral.
  The `app/src/lib/glossary.ts` docblock is narrowed to match: five of six discharged, one open.
  **Owner of the remainder: whichever story first renders a fouls surface.**

- **Task 10.3 discharged: the Hub does NOT inherit a fouls column, and the reason is structural
  rather than editorial.** The *"Task 8.7's recount"* entry names the owner as "whichever story
  first renders a fouls surface (2.11b/2.11c **or the Tournament Hub**)". The Hub does not:
  `StandingsRow`'s eleven fields and `MatchResultRow`'s twelve carry **no fouls field of any kind**,
  so there is nothing for the Hub to render and no key it could honestly mint. Checked against the
  contract rather than assumed. The parenthetical's Hub clause is dead; the entry stays open on its
  2.11b/2.11c half and on any future surface.

- **`/teams/{teamId}/` links now ship from THREE surfaces and the route does not exist until Story
  2.16.** Story 2.12's standings rows link every row to `/teams/{team.id}/` (ruled D2, mandated by
  AC 2 and UX-DR22), joining `MatchHero.tsx:103,119` (Story 2.4, ruled deliberately) and Story
  2.13's leaderboard team rows. `LineupsDisclosure.tsx:34` does the same for `/players/{id}/`.
  Story 2.11b decision 12 recorded this live inconsistency and explicitly declined to resolve it
  ("that is not this story's to fix"), and **nobody has filed it since** — so it is filed here.
  Every one of these is a 404 in the static export today. **This is known, accepted debt, not a
  defect to stub: do NOT build a placeholder route.** `/matches/{matchId}/` resolves (Story 2.4).
  **Owner: Story 2.16 for `/teams`, Story 2.15 for `/players`.**

- **104-at-scale verification is deferred to Story 2.19, and the fixture cannot stand in.** The
  fixture carries **3 of 104** reachable matches (1 group of 12, 4 standings rows of 48, 2 group
  results of 72, 1 knockout tie of 32) and exercises **2 of 7** `Stage` values and **2 of 9**
  `MatchdayRound` values. Story 2.12 therefore asserts what the fixture CAN carry — the group-by is
  total over synthetic rows covering all 7 stages and all 12 groups (exhaustive by construction,
  both enums being closed), link count equals row count for whatever N the artifact holds, and the
  results/manifest bijection — and **deliberately does not assert `toHaveLength(104)` against a
  fixture that cannot reach it**. Still unverified at real scale: the literal 104 count, real-data
  reachability, Lighthouse, the `<md` behaviour with 12 group tables and up to 19 sections on one
  page, and the collation premise (2.11a measured "es and en orders are identical" over 96
  ASCII-only fixture names; 2.12 sorts real team names for the first time). **Owner: Story 2.19.**

- **DECLARED DEPARTURE — Hub tables ship NO sticky header, against UX-DR12 / EXPERIENCE.md:76.**
  `DataTable`'s `sticky` is opt-in because it is correct ONLY inside a caller-rendered
  HEIGHT-BOUNDED scroll container; inside an unbounded one it computes as `sticky`, never offsets,
  and ships green while silently doing nothing (2.11a's own recorded departure). Hub tables are
  short — four standings rows per group, six results per group, sixteen in the largest knockout
  section — so none of them scrolls vertically and there is nothing to stick to. Manufacturing the
  condition would mean bounding up to nineteen tables to a fixed height, i.e. nineteen nested
  vertical scrollports on a page whose natural flow is fine, hiding rows behind a scroll gesture
  that is currently unnecessary. `scroll-padding-top: 4.5rem` is already global on `<html>`, so
  anchored and focused sections clear the site header regardless. **Owner: Story 2.19, to revisit
  if real 104-row data changes the premise.**

- **The row-link focus ring paints on the ANCHOR's box, not on the row — observed, not assumed.**
  Story 2.12 is the first surface to put focusable content inside a `DataTable` body, so UX-DR12's
  focus-restore went live here and was verified with real key presses: sorting a standings table
  with focus on a row link keeps focus on that same anchor as its row moves from position 1 to
  position 4. The ring itself, however, outlines the anchor's own 44px block inside the row-header
  cell (measured 165x44 in the fixture's widest team name) and NOT the row (1104x57), while the
  whole row is the click target — so the focus indicator understates the hit area. It is visible,
  unobscured and meets 2.4.7/2.4.11 in both themes. A row-wide indicator was prototyped
  (`tr:has(a:focus-visible)`) and NOT shipped: it either doubles the indicator or requires
  suppressing the native ring, and `outline-none` is a house prohibition that has already cost two
  review patches — and DESIGN.md specifies no row-focus treatment for this pattern, so minting one
  would be a design decision this story was not given. **Owner: whichever story rules the
  linked-row pattern — Story 2.16 ships `/teams` and makes these links live.**

- **FOUND AND FILED, NOT FIXED: Story 2.13's `#lideres` section overflows the DOCUMENT at 390px and
  320px, in BOTH locales.** Differentially attributed rather than asserted, on the technique Story
  2.6 established: with everything expanded at a 390px viewport (clientWidth 375) the document
  measures `body.scrollWidth` **457**; hiding `#lideres` alone returns it to **375 == 375**, and
  hiding Story 2.12's two surfaces instead leaves it at **457**. Same result at 320px (305 vs 433)
  and in EN (375 vs 433). The offenders are the leaderboards board `<article>` elements at 441px
  inside a grid — the same `min-width: auto` grid-item cause Story 2.12 fixed in its own sections
  with `min-w-0`, which is why the fix is a one-class change. **Story 2.12's own surfaces are clean
  at 390 AND 320, in both locales, fully expanded.** Not fixed here: 2.13 was mid-implementation in
  a concurrent session and has not yet run its own Task 9. **Owner: Story 2.13.**

- **CONTRACT QUESTION FOR STORY 1.17: `MatchResultRow.score` has no description, and the fixture
  cannot disambiguate it.** The schema gives `score` no description at all, and `TeamScore` says
  only "a home/away goal pair at one point in a match" — it does not say which point. The only
  knockout fixture (m074) has `score` == `scoreAfter90` == `scoreAfterET` == 1–1, so nothing in the
  fixture can settle it; for a 1–1 after 90 / 2–1 after ET tie the answer changes what renders.
  Story 2.12 rules it to be the same quantity as `MatchMetadata.score` ("the final score as the
  cover prints it — after extra time when extra time was played, otherwise after 90"), because
  `MatchResultRow`'s own description says it carries what the `<title>`/OG string needs "so neither
  has to fetch the Match Bundle" — which is only true if the two agree. **That is an INFERENCE from
  the contract, not a statement in it.** Nothing in 2.12 depends on the answer: the row prints
  `score` verbatim (AD-5) plus the `decidedBy` suffix, and neither reading changes what renders. A
  surface printing BOTH the 90' and the final score would. **Owner: Story 1.17, the artifact's
  producer — a one-line schema description closes it.**

- **The Hub's leaderboards anchor is a SPANISH slug, against Story 2.18 ruled decision 11.** Every
  other anchor in the app is a language-neutral English slug ("slugs are English/romanized, stable
  and human-readable, and the URL carries no language"), and Story 2.12's own anchors follow it
  (`#standings`, `#results`, `#standings-group-a`, `#results-r32`). `#lideres` does not. It is
  Story 2.13's ruling, taken before 2.12 ran and stated in that story's own code
  (`LEADERBOARDS_SECTION_ID`), and interoperating with a shipped id beat unilaterally renaming it —
  two ids for one section is the only strictly bad outcome. **Owner: Story 2.19, alongside the
  other anchor work; renaming it is a one-line change plus whatever links to it.**

- **`generateMetadata` on `/` inherits the open "`<title>`/OG stays Spanish after an EN toggle"
  decision.** Story 2.18 gave `/about` and `/glossary` NO metadata export on exactly those grounds,
  and Story 2.13's draft of `page.tsx` refused one for `/` for the same reason. Story 2.12's Task
  1.1 requires it and UX-DR22 requires a meaningful `<title>`/OG per route, so it ships — following
  the DATA-BEARING precedent (`/matches/[slug]` has carried `generateMetadata` since Story 2.4)
  rather than the two content pages. The consequence is NOT introduced here: `/` already carried a
  title from the layout's default `metadata`. The route's title is now composed from the artifact's
  own `tournamentName` and stays Spanish for an EN reader, exactly as every other route's does.
  **Owner: Juan, on the existing open entry.**

- **NOT FILED HERE, DELIBERATELY: the combined `tournament.json + leaderboards.json` budget gate.**
  `over_budget` measures exactly one string and `budget.py` is wired only into `emit_bundles`, so
  the combined gate AC 5 cites does not exist yet — but **Story 1.17 already owns building it** (its
  Task 4.1 appends a combined function reusing `BUDGET_BYTES`), and duplicating the entry here would
  split one obligation across two owners. Recorded only so a reader does not mistake the absence for
  an oversight. The measured position, from 1.17: `tournament.json` is 38,934 gzip-9 (**7.8%** of
  the 500,000 ceiling), full-roster leaderboards are 572,276, and the combined 611,210 **FAILS** —
  entirely because of leaderboards, and fixed by 1.17's still-unruled D3/D5 100-row cap (105,779,
  PASS). **Owner: Story 1.17.**

---

## Story 2.13 — Líderes del torneo (2026-08-06)

Baseline `74b1789`. `app/` + locales + the two ledger artifacts only; fixture-driven against
`data/fixtures/index/leaderboards.json` at `schemaVersion` 4. Every number below was measured
in the browser against the built `out/`, not inferred.

### Discharged by this story

- **`EXPERIENCE.md`'s `standings / leaderboards` policy row — THE LEADERBOARDS HALF ONLY.**
  `glossary.ts` recorded this row as having "NO locale keys at all" and deferred it to its
  owning story. `leaderboards.title` now ships the ruled `"Líderes del torneo"`, pinned in
  `i18n.test.ts` together with an explicit assertion that no `leaderboards.*` leaf matches
  `/clasificaci/i` — the policy row bans that form outright, because in LatAm it *means* the
  standings table and the Hub carries both surfaces. **The STANDINGS half is Story 2.12's**
  (`hub.standings.heading`), and 2.12's own `glossary.ts` docblock now credits both halves.
  `result letters & standings columns` is 2.12's and `fouls / duels` still has no surface —
  neither is claimed here.

### NEW defects found by this story, FIXED here

- **`<Link prefetch>` broke AC 4's zero-network clause, and only measurement caught it.**
  FR-26 requires sorting and filtering to be "instant and client-side — zero network beyond
  the initially loaded index". With Next's default prefetching,
  `performance.getEntriesByType("resource").length` went **48 -> 75** across one sort pass and
  one filter clear: every `<Link>` entering the viewport fired a route fetch, and re-ordering
  20 rows re-runs that on every sort. It is also pure waste — `/players/{slug}` and
  `/teams/{slug}` are UNBUILT (2.15 / 2.16), so each request is a round trip for a route that
  does not exist. **Fixed**: `prefetch={false}` on all three leaderboard `<Link>` sites. Re-
  measured at **43 -> 43** across six sort actions and four filter keystrokes, with zero
  `/players/` or `/teams/` entries attributable to `#lideres`.
  **STILL OPEN, AND IT IS 2.12's**: the Hub's standings links prefetch. Measured on the merged
  page, 4 route fetches fire on load — `/teams/czechia/`, `/teams/korea-republic/`,
  `/teams/south-africa/`, `/teams/mexico/` — and all four resolve to links OUTSIDE `#lideres`.
  2.13's 13 links inside the section fire none. **Owner: Story 2.12** (its D2 ships the same
  dead links). One prop, same fix. — **RESOLVED, and this entry was STALE (correction appended
  by Story 2.14, 2026-08-07).** Story 2.12's code review shipped the fix in commit `29e90fb`,
  which is 2.14's own baseline: `app/src/components/TournamentHub.tsx:129` carries
  `prefetch={false}` on its single `<Link>` site, with the 48→75 measurement quoted in its
  docblock as the reason. The entry above kept saying "STILL OPEN" for a story-length after it
  had been closed, which is how a ledger stops being the record. Corrected in place per this
  file's append-a-correction convention rather than by editing the original text. Story 2.14
  re-measured on the built export and attributes **zero** route prefetches to any surface it
  owns — every result row ships `prefetch={false}` (see 2.14's own AC 7 filing below).

- **A grid item's default `min-width: auto` gave the Hub a WCAG 1.4.10 document scroll.**
  Each board's `<article>` is a grid item, and `min-width: auto` refuses to shrink below the
  content's min-content width — so the article was sized BY ITS TABLE and the
  `overflow-x-auto` wrapper inside it could never engage. At a 390px viewport
  `document.body.scrollWidth` measured **457 against a clientWidth of 375** (82px of document
  scroll) in ES, and 433 in EN. Proven to be this story's by differential: hiding `#lideres`
  returned the document to 375/375. **Fixed** with `min-w-0` on the board article; the wrapper
  then becomes the scrollport (437px of table inside a 343px port) and the document sits at
  exactly 375/375 at 390px and 305/305 at 320px, in BOTH themes and BOTH locales. Same family
  as 2.11b's lesson that `truncate` inside a table cell widens the column instead of
  truncating.

### NEW defect found, FILED not fixed

- **`InvolvementChart` ships the UNFIXED, edge-drawn copy of the Team B hatch `<pattern>`.**
  `TacticalCharts.tsx:531-534` draws its hatch line at `x1={0} x2={0}`, while
  `DistributionChart` at `:338-340` centres it at `x1={HATCH_TILE_PX / 2}`. An SVG pattern
  tile clips at its own edge, so a stroke centred on x=0 puts half its width at negative x and
  renders as a clipped 0.75px stripe — the precise case `DistributionChart`'s own comment
  warns about and whose centring exists to prevent. This is half the texture channel
  UX-DR11(b) is discharged with, on a shipped chart, uncommented. Re-verified present at this
  story's baseline. **Not fixed here — `TacticalCharts.tsx` is outside 2.13's scope (ruling
  2). Owner: whoever next opens that file (2.16 / 2.17 or 2.19).**

- **An abbreviated head that also carries a unit composes two stacked parentheticals.**
  The `topSpeed` column's accessible name resolves to `"Ordenar por Vel. máx. (km/h)
  (Velocidad máxima)"`. Both halves are RULED and neither is wrong: Task 7.2 puts the unit in
  the head (`es.ts` decision 4 — "the unit NEVER rides the label … never per cell") and Task
  5.2 appends the full term in parentheses, visible-text-first, because substituting it would
  be a WCAG 2.5.3 Label in Name failure. Their composition simply stacks. It reads clumsily
  rather than incorrectly — the visible label is contained, the full term is present, and
  `title` carries the expansion alone. **Deferred: a copy ruling this story does not have.
  Owner: whoever next rules head composition (2.19's a11y hardening is the natural home).**

### Filed by this story

- **No glossary marking anywhere on the leaderboards surface.** Marking inside a sortable head
  is STRUCTURALLY invalid — `glossary.ts` bans nesting a focusable trigger inside a
  `<button aria-expanded>`, and nothing in the build chain catches it. The board headings could
  legitimately carry marks; that is scope this story was not given. **Owner: 2.19 or a copy
  pass.**
- **2.12's `"Más columnas"` disclosure and its `<md` sort menu must be applied to the three
  leaderboard tables when they land** (ruling 8: that work is named in 2.12's ACs and in
  neither of 2.13's). What keeps 390px usable meanwhile is the two PRESENCE GATES rather than
  a breakpoint: `team` repeats `entity` on all 12 fixture team rows and `perMatch` is null on
  all 20 `topSpeed` rows, so every board renders **five** columns, not six — measured in the
  browser, driven off the data. **Owner: the follow-on both stories should expect.**
- **`sort: null` still has no consumer.** Story 2.13 added the accessible-name composition to
  that branch of `DataTable` (Task 5.3) for parity, but every column this story ships is
  sortable and no other call site passes `sort: null`, so the branch remains unexercised at
  runtime. **Owner: the first story that ships an unsortable column.**
- **`EXPERIENCE.md`'s per-term policy table has NO row for "max speed" / "velocidad máxima".**
  The Spanish-text-expansion rule names `"VEL. MÁX."` for `"Velocidad máxima"` as its one
  worked example, yet no term row exists for it. This story MINTS NOTHING — both abbreviations
  reuse already-shipped ruled copy byte-for-byte (`match.hero.tiles.topSpeed` and
  `expert.field.highSpeedRuns`, both pinned equal in `i18n.test.ts`) — so the line-278 minting
  procedure does not require a row. **Recorded so a later story does not mistake the reuse for
  a minting. Owner: whoever next edits the policy table.**

### Routed, with evidence — NOT taken here (ruling 2: this story ships no chart)

`EXPERIENCE.md`'s Visualization Layering row is normative and gives leaderboards exactly two
altitudes: *"Leaderboards (Hub) | Top-3 teaser rows | — | Full sortable table (FR-26)"*. The em
dash at Tactical altitude is the ruling, and the AC names no visualization. The bundle
arithmetic confirms it: there are exactly TWO recharts import specifiers today and the vendor
duplication is PER SPECIFIER, so a third would mint a third ~300 KB vendor chunk on the Hub —
one of the two Lighthouse-≥90-budgeted routes. Verified in the exported HTML: `out/index.html`
contains no `recharts` and no `<pattern>`.

- **The recharts vendor-chunk duplication -> Story 2.15.** Its AC declares recharts by name
  ("cross-match trend charts follow (recharts, `viz-single` series)"), so 2.15 is the genuine
  third importer and the first story that can verify the win on its own route.
- **The Team B non-hue channel -> 2.16 / 2.17.** 2.15 is `viz-single` — single-series — so it
  needs no second channel at all; the first real two-team surface is a profile or comparison
  chart. The recorded evidence stands unchanged and is not re-derived here, including the
  binding conclusion that **the declared dashed-stroke fallback cannot work on a filled bar at
  all**, so a story needing a different mechanism must RULE a new one rather than reach for it.
- **`seriesLabelIndex` -> still the first successor story to reuse `DistributionChart`.** This
  story does not. The recorded remedy travels with the item.

### DO NOT FILE — already owned, and duplicating is the failure mode this list exists to prevent

- **The dead-link departure is 2.12's D2.** It states in its own words that "the ledger entry
  nobody filed is now 2.12's", and it files the departure for BOTH surfaces. 2.13 links on the
  same footing (ruling 3, the `MatchHero` / `LineupsDisclosure` precedent) and files nothing.
  Disclosed rather than hidden: on the fixtures **19 of 20 player slugs and 5 of 6 team slugs
  have no profile artifact**, so most links dead-end today. `tournament.json`'s entity lists
  are the route manifest and the pipeline asserts the bijection, so this resolves at real
  data — a fixture property, not a design flaw.
- **The missing combined-budget gate is 1-17's Task 4.1.** 2.12 already says of it "already
  tracked there — do not duplicate the ledger entry". 2.13 measures no budget: the App never
  does (AD-4), the pipeline owns it, and 2.12's D6 rules the same.
- **The recharts tick trap is MOOT here, not re-filed.** It was filed naming 2.13, but under
  ruling 2 this story adds no chart and no recharts importer, so the condition never arises.
  Recorded as moot rather than forgotten.

### Carried forward, unchanged: the combined-budget failure is real and upstream

Story 1-17 measured a realistic 36-board full-roster emission at **19,566 rows / 572,276 bytes
gzip -9**, giving **611,210 combined against a 500,000 ceiling — FAIL**, with `tournament.json`
only 7.8% of the ceiling and leaderboards the entire cause. **A 100-row player cap lands at
105,779 combined — PASS.** The ruling is **1-17's unruled D3/D5** (the board roster and the
cap), not 2.13's, and the fix is upstream: a breach is resolved by splitting artifacts or a
logged decision, never by dropping fields (SM-C2). **This story is built indifferent to the
outcome** — every count is driven off `board.rows.length` and `boards.length`, nothing assumes
a full roster and nothing assumes a cap, and the filter and teaser work at either scale. On the
fixtures the artifact is 10,927 bytes raw / **1,198 gzip -9** (shell `gzip -9`; `zlib.gzipSync`
reports 1,175 — the 23-byte difference is the FNAME header, the same shell-vs-library gap 2.12
had to correct in its own figures).

- **`assert-schema-version.test.ts` now times out in the full suite, and the cause is the data tree
  growing, not the gate breaking.** The test shells out to `scripts/assert-schema-version.mjs`, which
  walks every `*.json` under `data/`. At the start of Story 2.12's session that was **111 artifacts**
  and the test ran in 2,632 ms; by the end a concurrent Story 1.18 session had emitted
  `data/index/player-profiles/` and `data/index/team-profiles/`, taking the tree to **1,409
  artifacts**, and the same test takes **4,434 ms against a 5,000 ms default timeout** — so it passes
  3/3 in isolation and tips over under the full suite's parallel load. Nothing about the gate is
  wrong: it correctly reports 1,409 artifacts at schemaVersion 4, and both negative cases still pass.
  **Deliberately NOT papered over with a larger timeout by Story 2.12**, which changed no artifact and
  owns none of this: the real question is whether a unit-test run should re-walk the entire emitted
  corpus at all, and Story 1.19's full batch run will multiply the tree again. **Owner: Story 1.18 /
  1.19, with the batch-run work.**

## Story 2.12 addendum — ownership of the bullet immediately above (2026-08-06)

**The `assert-schema-version.test.ts` bullet directly above this heading belongs to Story 2.12, not
to Story 2.13.** It was appended while the concurrent 2.13 session was appending its own section, so
it landed after that section rather than inside 2.12's block at the heading *Filed at Story 2.12 —
the Tournament Hub's results and standings*. The content is unchanged and the ownership is restated
here rather than by rewriting the file, because every story in this ledger proves the append-only
property programmatically and a reflow would break that proof for all of them.

### Found at 2.13's hand-off, NOT this story's: the schema-version gate now times out in vitest

`app/src/lib/assert-schema-version.test.ts > "passes on the current fixture tree"` FAILS with
"Test timed out in 5000ms". **Cause: Story 1.17's commit `ae207ed`**, which added a real
`data/index/` — **1,298 JSON artifacts, ~12 MB**, where the tree previously held 9 fixture
files. `node scripts/assert-schema-version.mjs` now takes **12.1 s** standalone (measured)
against vitest's **5 s** default timeout, so the wrapper fails while the gate ITSELF PASSES and
correctly reports "111 artifact(s) at schemaVersion 4".

**It is a timeout, not a correctness failure**, and it is not Story 2.13's: that story touched
neither the test, nor `app/scripts/assert-schema-version.mjs`, nor anything under `data/`
(verified with `git diff` over all three paths). It was green at 2.13's baseline `74b1789` and
on every run until `ae207ed` landed mid-implementation.

The fix is one argument — an explicit per-test timeout on that case — but it belongs to the
story that changed the input, and the deeper question is whether the gate should scan the whole
`data/` tree on every test run now that the tree is real rather than fixture-sized.
**Owner: Story 1.17 (or 1.19, which owns the full-batch run).**

## Filed by Story 1.18 implementation (team & player profile emission, 2026-08-06)

Entries are cited by quoted anchor phrase, never by line number, and closures are appended
rather than edited into another story's paragraph.

### Closed by this story

- **Closes _"A zero-appearance squad member is schema-valid but fails the profile test"_.**
  Measured: **209 of the 1,248 pinned players never took the field** — 16.7% of the player
  artifacts, not an edge case. Ruled and shipped: the file is emitted with
  `appearances` all-zero, `matches: []`, `physical` all zeros (`topSpeed: 0.0` — max over an
  empty set is undefined, ruled to 0.0 rather than raising), **all 18 aggregate rows with
  `value: 0` and `perNinety: null`, and all six trend series with `points: []`**. The
  identity block comes from lineups, which is the only source that has it for these 209.
  *Rejected: omitting the file (breaks the registry bijection) and emitting empty
  `aggregates`/`trends` (re-introduces the branch that a closed, total, ordered list exists
  to remove, on 16.7% of files).* AD-4: "empty sections allowed, absence not."

- **Closes _"Fixture request FR-1 (routed to Story 1.18's fixture work"_.** All nine
  branches now have fixture coverage, verified programmatically:
  `goalkeeping: null`, `players: null`, `events.*: null` beyond `shootoutAttempts`, an empty
  `[]` event array, `decidedBy: "extra-time"`, `movementType: null`, a `CardRecord` and
  `penalty: true` all land on one new bundle, `data/fixtures/matches/m082-belgium-senegal.json`;
  the zero-appearance player is `data/fixtures/index/player-profiles/acevedo-carlos-mex.json`.
  **A NEW bundle rather than edits to the existing three, deliberately**: m001/m002/m074 must
  keep their populated goalkeeping technique blocks (Story 2.10's presence gates need the
  populated branch) and m001's hand-transcribed Domain G physical block, which
  `test_the_ground_truth_physical_block_matches_the_committed_fixture` and the
  `totalDistance`-divergence pin both read. **m082 was chosen by measurement**: it is the
  only corpus match that is `decidedBy: "extra-time"` AND carries a `penalty: true` goal
  record AND carries cards, so only the two contract-nullable branches and the empty array
  are hand-authored — everything else is real data. FR-1's own scope caveat about guard-test
  updates is discharged below.

- **Closes _"No fixture exercises `decidedBy: \"extra-time\"`"_.** Covered by the same
  bundle. Closed explicitly because it is a separate filing from FR-1 even though FR-1 folds
  it, and a sweep that closes one leaves the other open.

### Filed, not fixed

- **A substitute sent on at the closing minute plays ZERO clock minutes, and 20 players
  total zero minutes despite an appearance.** Not anticipated by the story; found by
  measurement during implementation. **75** substitutes are stamped at exactly the closing
  minute of their match — `minute: 90` in a regulation tie, `minute: 120` in an extra-time
  one — with no `substitutedOff`, so under the ruling that `stoppageMinute` is ignored their
  clock time is `length − length = 0`. **59 of the 75 carry a non-null `stoppageMinute` (1–7)
  and 16 carry none at all**, so this is not purely an artefact of discarding stoppage and
  adding it back would not remove the population — it would instead make
  `{minute: 90, stoppageMinute: 2}` in a 90-minute match compute `90 − 92 = −2`, which is
  the failure the ignore-stoppage ruling exists to prevent. **The ruling stands and `0` is
  the honest floor.** Consequences, all asserted in
  `test_a_substitute_sent_on_at_the_closing_minute_plays_zero_clock_minutes`: 20 players
  carry `played > 0` with `minutesPlayed: 0` and therefore a null `perNinety` on every
  metric; no starter is ever affected; `played == started + substituteAppearances` still
  holds. **Owner: Story 2.15 (Player Profile)** — the page will render an appearance whose
  minutes read `0'`, and whether that shows as `0'`, as `<1'` or as a dash is a copy ruling
  this story does not have.

- **The `>=` to `==` tightening is STILL not takeable, and the stated precondition was
  wrong.** Both filings — _"The `>=` to `==` tightening of"_ (Story 1.16) and _"still holds
  at `>=`, and CS-2 does not change that"_ (CS-2) — defer it to "the fixture regeneration,
  Owner: 1.18/1.19". **Story 1.18's fixture work regenerates the PROFILE fixtures, not the
  match-bundle fixtures**, and it must not regenerate the latter: Story 2.10's presence gates
  require their populated goalkeeping technique blocks and the Domain G ground-truth pins
  require m001's hand-transcribed physical block. Re-measured at this story's close:
  **38 of 66 fixture nodes still go red under `==`**, unchanged. **And the deeper reason the
  precondition can never be met by a regeneration: `events.passNetworkNodes` is `null` on
  104/104 corpus bundles**, so the invariant SKIPS on every real bundle and can only ever run
  against hand-authored fixtures, whose edge lists are a subset by construction. The
  `involvement == Σ incident edge volumes` identity is true (3,289/3,289 in the staged
  spine); it is simply not assertable through this test. **Both entries stay OPEN with the
  precondition corrected to: "a fixture bundle whose `passNetworkEdges` list is TOTAL for its
  `passNetworkNodes`, which no corpus-derived bundle can supply." Owner: whoever makes the
  node/edge fixtures total, or a decision to retire the test.**

- **_"An `OSError` mid-write leaves `data/matches/` partially populated with no rollback."_
  stays OPEN with its existing owner.** Story 1.18 gives the two PROFILE namespaces
  all-or-nothing writes via a staged-directory swap with rollback
  (`profiles._swap_directory`), but that entry is about **`emit.py`'s bundle loop**, and
  `emit.py` was not edited by this story. Closing it on the strength of a different module's
  write path would close it falsely. The bundle namespace remains uncovered; the profile
  namespaces are covered.

- **A new fixture match bundle adds a static app route, and the app side was NOT verified.**
  `app/src/app/matches/[slug]/page.tsx`'s `generateStaticParams` reads
  `tournament.json`'s `entities.matches`, so registering `m082-belgium-senegal` there — which
  the fixture set's own reachability test requires — creates a fourth pre-rendered match
  route. That route is the first to exercise `players: null` and `goalkeeping: null` in the
  App, branches Stories 2.11b and 2.10 built absence states for. **The app suite was not run
  for it**: `app/` is Epic 2's tree (AD-1, read-only for this story) and was occupied by two
  concurrent in-flight sessions (Stories 2.12 and 2.13) throughout this implementation, so a
  run there would have reported their work rather than this change. No app test asserts a
  page count, and none references `m082`. **Owner: the next Epic 2 session to touch the
  match route, or Story 2.19's real-data cutover.**

### Guard-test updates, disclosed because they change what a shipped test proves

- **`test_fixtures.py::test_the_team_profile_record_matches_its_own_per_match_rows` asserted
  the WRONG points rule and is corrected.** It asserted `points == won * 3 + drawn` over ALL
  rows; `TournamentRecord`'s own description says _"`points` counts group-stage points only;
  knockout ties award none."_ The two disagree on **19 of the 48 real teams** (Mexico: 12 by
  the old form, **9** by the contract). The old fixture carried three group rows and nothing
  else, so both readings agreed and the conflict was invisible until the fixture was
  regenerated from real data.

- **`test_fixtures.py`'s two non-empty profile guards are relaxed, and replaced with
  something stronger.** `assert fixture["matches"]` and `assert rows` fail on a CORRECT
  zero-appearance artifact. Both now assert `len(rows) == played`, which still forbids the
  failure the originals existed to catch — a silently empty breakdown on a profile that did
  play — and additionally forbids the reverse. FR-1 named this as in scope.

- **`test_fixtures.py::test_domain_g_player_totals_reconcile_with_the_domain_b_team_totals`
  is re-scoped to skip on `players: null`**, following the `passNetworkNodes` precedent
  exactly. A bundle with no per-player pages has nothing to reconcile. Because a skip is how
  an invariant stops being enforced unnoticed,
  `test_the_players_null_skip_does_not_silently_disable_the_domain_g_reconciliation` pins
  that at least three fixtures are still reconciled, that the skip fires on exactly one file,
  and that an EMPTY `players` list stays reconciled rather than joining the skip.

- **`test_precompute_identity.py` carried two unguarded nullable-container reads and they are
  fixed.** `doc.get("players", [])` returns `None` when the key is present and explicitly
  null — the default only fires on an ABSENT key — so four tests raised
  `TypeError: 'NoneType' object is not iterable` the moment a `players: null` fixture
  existed. Now `doc.get("players") or []`, the same idiom `test_fixtures.py` uses in six
  places. Same defect class, different file; disclosed rather than silent because
  `test_precompute_identity.py` was not in this story's declared file list until FR-1 forced
  it.

- **_"`test_set_play_counts_are_internally_consistent`"_ needed no action.** The story routed
  it here as a pin that would "turn red for a reason that is not a defect" once fixtures were
  regenerated from real data. Re-read at implementation time: CS-2 already corrected it to
  the four corpus-true relations, and its docstring records the change. Verified green; no
  edit made.

- **The `m001` `physical.totalDistance` divergence pin was NOT triggered and needs no
  action.** `test_extract_report_domain_g.py`'s pin fails loudly "if a fixture refresh
  corrects it" — but this story does not refresh the m001 BUNDLE fixture (see the FR-1 entry
  above), only the profile fixtures, so the divergence and its pin are untouched.

### Two figures from the story that did not reproduce, and the reconciliation

- **`quinones-julian-mex`'s pass completion is `82.2`, not the `83.2` the story instructs.**
  The story derives `119/143 × 100 = 83.2` from the COMMITTED FIXTURE's three hand-authored
  rows — and those rows are not corpus data: the fixture claims 56/62 for `m001` where the
  real Domain G row is 28/34. Over his five real matches the corpus sums are
  **111 completed / 135 attempted = 82.2** weighted, against **81.8** unweighted. The RULE
  the figure was defending is implemented and tested (weighted ≠ unweighted, and 82.2 ≠ 81.8
  is what makes the mutation visible); only the fixture-scoped number differs. The
  regenerated fixture is the real corpus artifact, so it now carries 82.2.

- **`passesAttempted == 0` holds on 53 Domain G rows but only 52 EMITTED match rows.** The
  53rd is `m092-mexico-england` / `henderson-jordan-eng`, whose row has no minutes and
  therefore produces no `PlayerMatchRow` at all. Both numbers are right; they count different
  things, and the story's "53 individual match rows" is a Domain G count.

### Coordination and attribution

- **Story 1.17's commit `ae207ed` captured this story's two error classes.** `ProfileError`
  and `ProfileValidationError` were appended to `pipeline/precompute/errors.py` by this
  story and were swept into 1.17's commit alongside its own `IndexEmitError`,
  `TiebreakUnresolvedError` and `RouteManifestError`. Content integrity verified — both
  classes are intact at HEAD — so this is an **attribution defect only**. Recorded, not
  repaired, per this repo's precedent (the Story 1.14 review's ruling on commit `5344fac`
  and Story 2.18's identical disclosure). A reviewer looking for those two classes' diff must
  read `ae207ed`.

- **Two forks were written against the baseline and retired once 1.17 landed.** At `74b1789`
  `emit._def_properties` took only a name and raised `KeyError` on all 13 profile `$def`s,
  and `decimals_map("player-profile.schema.json")` silently omitted `PerNinety` (7 names, the
  declaration hidden inside an `anyOf` branch) — both reproduced by running the code, and both
  are why Tasks 4.7 and 6.2b ordered profile-scoped copies. Story 1.17 (`ae207ed`) then added
  the `documents` parameter and fixed the inline-title loop to use `_declared_places`. The
  copies were **deleted** in favour of the shipped functions rather than left in place with a
  stale rationale, and the tripwires that detected the change were inverted into positive
  assertions (`test_the_shipped_check_total_resolves_every_profile_type_including_the_titled_ones`,
  `test_per_ninety_stays_bound_because_its_precision_hides_inside_an_anyof_branch`) so a
  revert of either 1.17 change is loud here rather than silent. The 1,296 emitted artifacts
  are byte-identical before and after the retirement.


## Deferred from: code review of 2-13-tournament-leaderboards (2026-08-06)

Three adversarial layers over the uncommitted tree; 53 raw findings, 40 after dedupe, 3 dismissed.
Four items went to Juan as decisions and 26 to patches; these seven are deferred.

- **The `aria-label` branch added to the unsortable `<th>` has no call site.** Story 2.13 Task 5.3
  composed the full term onto the `sort: null` head, but `grep "sort: null"` returns exactly one
  production column — `TournamentHub.tsx:247`, the standings `form` strip — and
  `STANDINGS_COLUMN_KEYS.filter(...)` guarantees its `headTitle` is null. So `plainAccessibleName`
  is `undefined` at every rendered head and the branch never runs. Untested, unreachable code in a
  component 27 instances depend on. **When a caller first pairs `sort: null` with a non-null
  `headTitle`, note that `aria-label` on a non-interactive `<th>` REPLACES the header name AT reads
  when announcing each body cell's column association — verify that before shipping it.**
  Owner: whoever adds that first call site.

- **Two boards sharing `metricCode` + `scope` would collide on every identity the leaderboards
  surface mints.** `Leaderboard` carries `aggregation` and the App reads it nowhere; board identity
  is asserted to be `metricCode` + `scope` alone, and the row key
  (`${scope}-${metricCode}-${entity.id}`), the React key, the heading, the caption and `tableName`
  all derive from that pair. An emission carrying e.g. `{goals, player, sum}` and
  `{goals, player, average}` — or the same entity twice in one board — gives duplicate React keys,
  byte-identical captions and ambiguous sort announcements, and `DataTable`'s focus restore
  (`querySelector` on `data-row-key`) lands on whichever row matches first. Unreachable in both the
  3-board fixture and the 36-board real emission today. Owner: whoever extends the board roster.

- **Story 2.13's `static-output.test.ts` block asserts ABSENCE across the whole document.**
  `not.toContain('role="region"')`, `not.toContain("recharts")`, `not.toContain("<pattern")` and
  `not.toContain("type-display-score")` all run against the entire `out/index.html`, which includes
  Story 2.12's Hub region and the shared chrome — not the leaderboards subtree. Any later Hub work
  adding a landmark or mounting a chart turns 2.13's suite red with a message pointing at
  leaderboards. Pre-existing idiom — the glossary suite does the same at `:187`. Owner: whichever
  story first trips it.

- **Task 10.4's "commit `app/` by explicit path" is no longer achievable.** 2.12's and 2.13's hunks
  are interleaved inside seven shared files — `DataTable.tsx` (2.13's `headAccessibleName` beside
  2.12's `sortState`/`onSortChange`/`rowClass`), `es.ts`, `en.ts`, `i18n.test.ts`, `page.tsx`,
  `static-output.test.ts` and `glossary.ts` (a jointly authored docblock). Per-path staging cannot
  separate the two stories; only a per-hunk stage can, and neither story's protocol describes one.
  The Completion Notes state "neither story restructured the other's work" without noting the
  slices are no longer separable. A concurrency consequence, not a code defect.
  Owner: Juan, at staging time.

- **[Story 2.12] `sortState` passed without `onSortChange` is silently ignored.**
  `DataTable.tsx:244` sets `isControlled = onSortChange !== undefined` — controlled-ness keys off
  the CALLBACK, not the value. A caller passing `sortState` alone silently gets the uncontrolled
  path with no dev warning, and TypeScript permits it because the two props are independently
  optional. The header glyphs and the caller's state then disagree. Owner: Story 2.12.

- **[Story 2.12] Caption uniqueness is no longer a site-wide property.** `i18n.test.ts`'s
  hand-maintained list totals 31 — the match route plus 2.13's three boards — but
  `TournamentHub.tsx:541,629` passes an un-composed `t("hub.standings.caption")` /
  `t("hub.results.caption")` to every table it renders, so every standings table on the Hub carries
  the identical caption and none of them is in the list. 2.13's own three entries are correct; the
  invariant the list claims to guard is not. Owner: Story 2.12.

- **[Story 2.12] `/`'s `generateMetadata` takes the unruled `<title>`-language decision.**
  Story 2.13's scope boundary and Task 6.2 both forbade adding one — "`/about` and `/glossary`
  deliberately export no `metadata`, because the `<title>`-stays-Spanish decision is unruled and
  2.18 refused to take it". 2.12's Task 1.1 overrode that and shipped `title`, `description` and
  `openGraph` on the Hub. Not chargeable to 2.13, but the decision is now taken de facto on the
  route 2.13 mounts into, and the inherited ledger entry is unfiled. **NFR-4 forces the question at
  2.19.** Owner: Juan (the ruling), Story 2.12 (the filing).

- **[Story 2.13 review, RULED BY JUAN] Two `MetricCode` values resolve to ONE Spanish label.**
  `enums.leaderboardMetric.completedLineBreaks` and `.lineBreaksCompleted` are both
  "Rupturas de lineas completadas" in `es.ts` — the first inherited from `enums.metric`, the
  second from `expert.field`, which is how one name arrived for two quantities. EN separates them
  ("Completed line breaks" / "Line breaks completed"); ES does not. Both codes ship in the real
  emission (`completedLineBreaks` team, 48 rows; `lineBreaksCompleted` player, 106 rows) and are
  separated on screen only by the scope suffix the heading appends.
  Board heading, table caption, `tableName` (hence every sort announcement) and the filter
  announcement all derive from this label.
  **Ruled: FILED, NOT MINTED.** Ruling 7's no-mint constraint stands and the scope suffix
  disambiguates both shipped emissions today. **The live risk is a SAME-SCOPE emission** — both
  codes at `team`, or both at `player` — which would give two boards an identical heading,
  identical `tableName` and identical captions, turning `i18n.test.ts`'s caption-uniqueness
  assertion red. That test is driven off a 3-board fixture containing neither code, so it cannot
  see this coming. Owner: whoever first emits both codes at one scope, or the story that mints a
  distinguishing Spanish term with its EXPERIENCE.md policy row.

## Filed at Story 2.12 CODE REVIEW (2026-08-06)

Appended, never edited into the paragraphs above — the append-only property is proven
programmatically by every story in this file.

### Reconciliation: the `assert-schema-version` timeout is filed TWICE, with contradictory causes

Two adjacent sections describe one failure and disagree on both facts. The 2.12 bullet
("`assert-schema-version.test.ts` now times out in the full suite") attributes the growth to
*a concurrent Story 1.18 session* emitting `data/index/{player,team}-profiles/` and names
**Owner: Story 1.18 / 1.19**. The 2.13 section immediately below it attributes the same failure
to *Story 1.17's commit `ae207ed`* adding 1,298 artifacts and names **Owner: Story 1.17 (or
1.19)**. Both were appended in the same window, and this file's own rule is "DO NOT FILE —
already owned, and duplicating is the failure mode this list exists to prevent".

**Reconciled: both causes are real and additive, and neither story is the owner.** `ae207ed`
(1.17) added `data/index/*.json`; the concurrent 1.18 session added
`data/index/{player,team}-profiles/`. The tree went 9 → ~111 → 1,409 artifacts across the two,
so each session measured a different intermediate figure and correctly attributed the growth it
could see. **Owner: Story 1.19**, which owns the full-batch run and will multiply the tree
again; 1.17 and 1.18 are both already done.

**One measured fact in the 2.12 bullet is now STALE and should not be relied on.** It records
"it passes 3/3 in isolation at 4,434 ms". Re-measured at code review, against the tree as it
stands: the test **FAILS IN ISOLATION TOO**, at **18,192 ms** against the 5,000 ms default
(the other two cases in the file still pass, at 530 ms and 426 ms). So the "passes alone, tips
over under parallel load" framing no longer holds — the gate now exceeds the default timeout on
its own. The gate itself is still correct: it reports the full tree at schemaVersion 4 and both
negative cases pass. The open question is unchanged and is the real one: whether a unit-test run
should re-walk the entire emitted corpus at all, now that the corpus is real rather than
fixture-sized.

### The head-name composer does not guard the case its own new test asserts

`src/lib/i18n.test.ts > "the leaderboards namespaces (Story 2.13, AD-2 / AD-7)" > "never nests a
parenthetical a call site pre-composed"` is **RED** in the shared tree.
`composeHeadAccessibleName` (`app/src/lib/table-sort.ts:347-357`) suppresses the parenthetical
when `headText.includes(headTitle)` — the direction Story 2.13's ruling 6 needed ("Top speed
(km/h)" containing "Top speed"). The new test asserts the REVERSE direction, where the call site
pre-composed the parenthetical into `headTitle` ("Hora" + "Hora (hora local)"), and that
direction has no guard, so the composer still emits `"Ordenar por Hora (Hora (hora local))"`.

**NOT FIXED HERE, deliberately.** The function, the test and the file are Story 2.13's, that
session was actively editing all three during this review (the file changed under this session
twice), and a concurrent edit to a function mid-fix is worse than a red test its owner is
already looking at. Story 2.12's own exposure is closed at the CALL SITE instead: the Hub's
kickoff column now passes the bare clarifier (`match.hero.localTime`) as its `headTitle` rather
than a pre-composed `"Hora (hora local)"`, so no shipped head reaches the unguarded branch.
**Owner: Story 2.13.** The fix is one condition — when `headTitle.includes(headText)`, emit
`headTitle` in place of the composed pair.

- **[Story 2.13 review CORRECTION, 2026-08-06] The `assert-schema-version.test.ts` timeout is
  owned by STORY 1.18, not 1.17.** Story 2.13's hand-off block filed this against 1.17's commit
  `ae207ed`, on the stated grounds that it "added a real `data/index/` — 1,298 JSON artifacts".
  **Measured at review, that is wrong:** `git diff --name-only 74b1789 ae207ed -- data/` returns
  **two** files (`index/leaderboards.json`, `index/tournament.json`), and `git ls-files data/index`
  returns the same two. The other **1,296** artifacts are UNCOMMITTED and belong to **Story
  1.18** — `data/index/player-profiles/` and `data/index/team-profiles/`, emitted by a concurrent
  session alongside its still-untracked `pipeline/precompute/profiles.py` and
  `pipeline/tests/test_emit_profiles.py`. Story 2.12's own block in this file already recorded it
  correctly ("a concurrent Story 1.18 session had emitted ... taking the tree to 1,409
  artifacts"); the two entries contradicted each other and 2.13's was the wrong one.
  Also corrected: the gate reports **1,411** artifacts at schemaVersion 4, not the 111 recorded.
  **The defect itself is unchanged and real** — `node scripts/assert-schema-version.mjs` walks the
  whole tree and exceeds vitest's 5 s default while the gate itself PASSES, so the wrapper times
  out on a healthy artifact set. The fix is a per-test timeout or a scoped walk, not a data change.
  **Owner: Story 1.18 (or 1.19).**

### Appended by Story 1.18 at close — the R3 hand-off, and three guard-test consequences

- **Story 1.17's `test_the_repository_has_no_committed_profiles_yet` went red exactly as
  designed, and was replaced rather than patched.** Its docstring named the work — *"delete
  this test, and assert the populated bijection here instead"* — and that is what happened.
  `check_route_manifest`'s populated branch, live but never exercised on real data, now
  reports **matches 104 <-> 104, teams 48 <-> 48, players 1248 <-> 1248, bijection holds**.
  Ruling R3 is therefore fully discharged across both stories: the assert lives with the
  authority that owns `tournament.json`, and Story 1.18's `main` printed
  *"route-manifest bijection not asserted here"* for exactly as long as the gap existed.

- **`test_precompute_identity.py`'s fixture-reach count moved 155 -> 207**, because FR-1's
  new bundle brings two more squads into the fixture set. Updated rather than loosened to a
  `>=`: a silent DROP in reach is what that line exists to catch. The acceptance criterion
  it guards — zero caps-run mismatches — still holds on all 207.

- **`identity.check_committed_data`'s "unavailable" message formats the DIRECTORY, not the
  glob.** Caught by `test_an_absent_data_baseline_reports_unavailable_and_never_success`,
  which pins the exact string; the first cut of the `globs` parameter had it printing
  `.../matches/*.json`. Recorded because that test is the load-bearing negative for the
  whole "never let absence read as a pass" rule, and it did its job.

- **One full-suite failure is a WORKTREE ARTEFACT and not a defect**, stated so a reviewer
  re-running the suite is not misled: `test_contract_schemas.py::test_the_committed_
  generated_types_still_match_the_schemas` shells out to `contract/scripts/generate-types.mjs`,
  whose `json-schema-to-typescript` dependency lives in a gitignored `node_modules`. It fails
  in a fresh git worktree and passes in the main tree (73/73). `contract/` was not touched by
  this story.

## Deferred from: code review of 1-17-tournament-index-results-standings-leaderboards (2026-08-06)

- **A partial `data/index/` with no rollback, now on a second write path.** An `OSError`
  between the two `write_canonical` calls in `emit_index` leaves `tournament.json` replaced
  and `leaderboards.json` carrying the previous run's content, and the stale sweep never
  runs. Every gate ran before the first byte, so the artifacts are individually valid and
  mutually inconsistent. Compounding it, `main` maps `OSError` to exit **2**, whose stated
  meaning is *"index emission could not run: nothing was learned"* — the one exit code that
  promises the filesystem is untouched is the one printed after it was mutated. Pre-existing
  in shape (`emit_bundles` has the same property) and the staged-directory fix is already
  routed to Story 1.19; recorded again because 1.17 adds a second call site and because the
  exit-code half of it is new. Anchor: *"Sweep stale artifacts this run did not produce, AFTER a
  successful write and never before it"*.

- **The stale sweep unlinks any top-level `data/index/*.json` the run did not write.** The
  glob is correctly non-recursive, and its comment reasons carefully about why Story 1.18's
  `team-profiles/` and `player-profiles/` subdirectories are out of reach — but not about a
  sibling top-level artifact. A later story emitting a third file into `data/index/`, or
  anything hand-placed there, is deleted without a note. Anchor: *"Scoped to
  `data/index/*.json`, which is a non-recursive glob"*.

- **`_def_properties` raises a bare `KeyError` that escapes the CLI's typed handler.** A
  contract document renaming a `$def` produces an uncaught `KeyError` and exit 1 with a
  traceback — indistinguishable at the exit code from a typed finding about the data, which
  is precisely the confusion the `json.JSONDecodeError` clause was added to prevent.
  `test_check_total_reaches_the_index_documents_without_forking` pins `pytest.raises(KeyError)`,
  so the untyped path is currently intended behaviour. Pre-existing in a Story 1.16 module
  and out of 1.17's declared scope. Anchor: *"`json.JSONDecodeError` is a `ValueError`, so
  without naming it a malformed committed bundle would exit 1 with a traceback"*.

- **The profile direction of AD-4's bijection is WRITE-BLOCKING, which inverts the
  dependency between Story 1.17 and Story 1.18.** `check_route_manifest` raises
  `RouteManifestError` on any `missing or orphans` and runs before the first
  `write_canonical`, so adding a single entity to the spine makes `index.py` refuse to emit
  `tournament.json` until a profile artifact exists for it — but profile artifacts are
  generated FROM that manifest. The recourse is real but undocumented and ugly: empty the two
  profile directories to reach the "baseline unavailable" branch, emit, then re-run 1.18.
  Ruled at 1.17's code review as a DEFERRAL rather than a patch, because reversing a gate's
  failure semantics exceeds a review's remit and **Story 1.19 owns end-to-end orchestration**,
  which is where the phase ordering should be expressed. The constraint itself is documented
  in `index.py` and `pipeline/README.md` by that review's patches. Anchor: *"the profile
  direction PRINTS that it could not run"*.

- **The three Domain G blocks are flattened into one namespace before metric lookup.**
  `inPossession`, `outOfPossession` and `physical` are merged with successive `dict.update`
  calls, so a field name present in two blocks would resolve by dict order with no
  diagnostic. Verified against `match-bundle.schema.json`: no collision exists among the 18
  player-scope codes today, which is why this is a ledger entry and not a patch. Anchor:
  *"Player metrics live across three Domain G blocks"*.

## Deferred from: code review of 1-18-team-player-profile-artifacts (2026-08-06)

- **`pipeline/tests/test_emit_profiles.py` costs 8m40s on its own**, measured
  (`82 passed in 520.72s`), on a suite already running ~45 minutes and documented in this
  ledger as getting killed for length. The cost is structural rather than wasteful: one
  `emit_profiles` build-validate-measure pass over the 104 committed bundles is ~35 s, and
  the module runs roughly ten of them — the module-scope `built` fixture, the two-tree
  byte-identity comparison, the `main()` exit-code tests, the failed-write and stale-sweep
  tests, three dry runs and a cold-interpreter subprocess CLI run — most of them first
  copying all 104 bundles into `tmp_path` and then writing 1,296 files.
  **Deferred rather than patched because it is a coverage-versus-runtime tradeoff, not a
  defect:** every one of those passes exists to satisfy a named acceptance criterion, and
  collapsing them onto a shared session-scoped emission would weaken the independence that
  AC 4's anti-tautology rule and Task 9.4's two-tree byte comparison depend on. The honest
  fix is a session-scoped fixture for the read-only assertions while the write-path tests
  keep their own trees, which is a real piece of work with a real risk of quietly coupling
  tests that are currently independent. **Owner: whichever story next needs the pipeline
  suite to fit in a single un-chunked run.**

## Filed by: 2-14-header-search (2026-08-07)

- **AC 1's "no network beyond the already-loaded index" is FALSE off the Hub, and the story
  ships a declared departure rather than the AC's letter.** Measured on the built export
  before any code was written: `grep -rl "index/tournament.json" out/_next/` matches **exactly
  one chunk** (46,292 B raw / 12,924 B gzip), the minified `TournamentHubRegion`, referenced by
  `out/index.html` and by **no other route's HTML**. So on four of the five routes there is no
  already-loaded index and the module that fetches it is not even shipped there, while the
  header search is global. **RULED: lazy on first engagement, with a module-scope promise cache**
  (`app/src/lib/tournament-index.ts`). **Re-measured in the browser on the built export**
  (`python -m http.server`, `/matches/m001-mexico-south-africa/`): **33 resources on a settled
  load with ZERO `tournament.json` entries**; focus the input → **exactly one** new entry
  (7,391 B on the fixture; the real index is 409,524 B raw / 39,137 B gzip); six further
  keystrokes → **no further requests at all**. On `/` the artifact is fetched **once, not
  twice** — the Hub and the header share the loader (Task 4.4). AC 7 therefore reads: *zero
  network beyond the already-loaded index on `/`; on every other route, exactly one on-demand
  fetch of that same index, once per page load, triggered by user engagement and never by page
  load.* **The payload question is genuinely open and is NOT this entry's to close:** whether
  39 KB gzip is the right thing to pull on a match route at all, or whether the `entities`
  slice (29,758 B gzip) or a projected corpus earns a contract change, wants real query
  behaviour to answer. **Owner: Story 2.19.**

- **The render-test seam now exists, and it makes a whole class of previously-unverifiable
  work testable.** This ledger's own entry routed interactive verification to "whichever story
  introduces jsdom or a render-test seam"; 2.14 is that story. Added as **devDependencies
  only** (`jsdom`, `@testing-library/react`, `@testing-library/user-event`,
  `@testing-library/jest-dom`) — `dependencies` is untouched, nothing ships to a browser, and
  Story 2.2's prohibition is on RUNTIME dependencies. `@vitejs/plugin-react` proved
  **unnecessary**: Vite's esbuild already compiles `.tsx` from tsconfig's `jsx: "react-jsx"`,
  and the plugin exists for Fast Refresh. **The global `environment` stays `"node"`** — a flip
  would change `storage.test.ts`'s `vi.unstubAllGlobals()` restore target — so the seam is a
  per-file `// @vitest-environment jsdom` pragma. `app/src/components/HeaderSearch.test.tsx` is
  the repo's first `.test.tsx` (30 tests). **What later stories can now do that they could
  not:** drive real key events, assert focus position, assert `aria-activedescendant`, and test
  any overlay's open/close/focus-return contract. **Three limits stand and were not closed:**
  no live screen reader (the structural pass reads roles, labels and strings back from the DOM,
  which is not the same thing), **no axe** (2.19 owns it — `axe-core` is still transitive-only
  via `eslint-plugin-jsx-a11y`), and a real Tab key has still never been delivered by this
  project's browser automation; 2.14's element-order check fell back to the document-order
  focusable walk and says so.

- **`accent-cyan` on `surface-overlay` is now PUBLISHED: 9.20:1 dark / 4.68:1 light.** DESIGN.md
  publishes cyan at 11.3 dark / 5.0 light **against `surface-base` only**, and the header
  search's matched-substring `<mark>` is the first surface putting cyan text on an overlay. By
  the established method (reproduce a published figure before trusting a new one), the same
  script measured **cyan on base at 11.27 dark / 4.99 light** — reproducing 11.3 / 5.0 — before
  the new figure was recorded. Both new values clear the **4.5:1** text floor; light is the
  tighter of the two at 4.68 and is the number to watch if the cyan token is ever re-toned.
  Also re-confirmed on the same surface: `ink-primary` 14.13 dark / 15.43 light,
  `ink-secondary` 7.03 / 6.65, and **`ink-muted` at 3.30 dark** — below the floor, which is why
  the panel carries no copy in it. A live class audit of the open panel found only
  `text-ink-primary`, `text-ink-secondary`, `text-accent-cyan` and `bg-transparent`: **no
  `ink-muted`, no `*-on-pitch` token** (the exact 2.6/2.9/2.10 failure). The `<mark>`'s cue is
  not colour alone — `font-weight: 600` carries it too (WCAG 1.4.1). **DESIGN.md should absorb
  the two new figures at 2.19**; they are recorded here rather than written into the spine
  because this story does not own that document.

- **"Full-width" vs "full-screen": EXPERIENCE.md contradicts itself, and 2.14 shipped
  FULL-WIDTH.** The Site header row says the `<md` search opens a *"full-width sheet"*; the
  Header search row says *"full-screen sheet"*. Measured in a 390 px same-origin iframe on the
  built export: the sheet is **386 px wide against a 386 px viewport, anchored at `top: 0`**,
  with `max-h-dvh` + `overflow-y-auto` so a long result list scrolls inside the panel. So it
  spans the full width and is **not** full-screen — its height is content-driven. Full-width was
  chosen because a top-anchored panel keeps the reader's typing hand and their eye in the same
  place the control they pressed lives, and because a forced full-height panel over two result
  rows is a lot of empty overlay. **The two rows should be reconciled to one wording**; both
  cannot stand. **Owner: 2.19**, or whichever story next edits EXPERIENCE.md's Component
  Patterns.

- **The sheet's Escape returns focus to the ICON BUTTON, not to the input — a UX-doc
  departure.** EXPERIENCE.md's Interaction Primitives say Esc "returns focus to the input". In
  the sheet presentation the input **is unmounted by the close**, so there is nothing to return
  to; Radix returns focus to the trigger, which is the only correct destination and the one
  every dialog convention expects. Verified live: one Escape with the listbox open closed
  **both** the listbox and the dialog and left focus on the icon button. On the DESKTOP
  presentation the doc's wording is satisfied literally and trivially — focus never leaves the
  input, so Esc needs no focus call at all. Recorded as a departure rather than a defect; the
  doc's sentence is written for a presentation that does not unmount its input.

- **AC 2's accent-insensitivity is NOT verifiable against the fixture, and this is a standing
  coverage gap, not a one-story shortfall.** `data/fixtures/index/tournament.json` contains
  **zero non-ASCII characters** across its 7 searchable rows, so every accent assertion against
  it would be a case-insensitivity assertion wearing an accent-insensitivity label. 2.14 covers
  it by pointing `search-model.test.ts` at the **real** `data/index/tournament.json` (1,400
  rows), whose entire non-ASCII inventory is three characters — `ü`, `ô`, `ç`, all in team
  names (`Türkiye`, `Côte d'Ivoire`, `Curaçao`) — and by constructing the cases the corpus
  cannot supply (`Núñez`/`nunez`, `Quiñones`/`Quinones`). **The inversion is worth carrying:**
  all 1,248 real player names arrive with diacritics ALREADY stripped (`Julian QUINONES`,
  `Darwin NUNEZ`), so it is the READER who types the accent — which is the actual justification
  for AC 2, and a naive `String.includes` fails it. **The gap is that no BROWSER check can
  exercise an accent until the 2.19 real-data swap**, because `DATA_ROOT` still points at
  `/data/fixtures`. **Owner: 2.19** — re-run the accent path in the browser once real data is
  served, and consider giving the fixture one accented team name so the gap closes for good.

- **`hub.separator` (" · ", U+00B7) is NOT fold-safe, and any future highlight surface must
  check its glyphs.** Found by 2.14's own corpus-wide fold test, not by reading: **U+00B7
  MIDDLE DOT is in `\p{Diacritic}`** (it marks the Catalan *punt volat*), so `foldForSearch`
  DELETES it — `" · "` (3 chars) folds to `"  "` (2). Built into a composed match name it broke
  the 1:1 fold invariant on **all 104 match rows** and silently dropped every match highlight,
  because degrading quietly is exactly what `matchSpan`'s guard is for. 2.14 joins match team
  names with `match.hero.scoreSeparator` (U+2013 EN DASH, which folds to itself) and pins the
  property in both `search-model.test.ts` and `format.test.ts`. **Carry this forward:** any
  string whose indices are used for highlighting must have its composition glyphs checked
  against the fold, and `hub.separator` is the one already in the dictionary that fails.

- **`assert-schema-version.test.ts`'s "passes on the current fixture tree" is a 5-second
  TIMING FLAKE in the full suite, and 2.14 made it more likely without causing it.** Measured:
  it takes **1.3–1.7 s run alone** and passes every time, but under `npm test`'s seven-worker
  parallelism it intermittently exceeds vitest's 5 s default and fails as a timeout. **It
  failed at 2.14's BASELINE**, on the very first full-suite run of this story before a single
  file was touched — so it is not this story's defect. It is also not innocent of it: 2.14 adds
  a jsdom test file, which is the heaviest thing in the suite, and more contention makes a
  marginal timeout tip over more often. Observed rate mid-story: **2 failures in 5 full-suite
  runs.** — **FIXED IN THIS STORY (2026-08-07), not deferred, and the reversal is deliberate.**
  This was first written as a deferral on the reasoning that another story's test file is not
  2.14's to touch. That was wrong on the facts: the scope boundary's do-not-touch list names
  `table-sort.ts`, `DataTable.tsx`, `match-hero.ts`, `TournamentHub.tsx` and
  `LeaderboardsSection.tsx`, and the "do not fix inherited behaviours" list is about PRODUCT
  behaviour (prefetch, the live region, the zoom overflow) — neither covers a test gate that
  fails at random, and leaving the definition-of-done red on a coin flip is worse than a
  one-line test-only change. **The fix:** all three `it`s in
  `app/src/lib/assert-schema-version.test.ts` now carry an explicit `20_000` ms budget, because
  every one of them shells out to the real gate script and pays a Node interpreter start.
  Raised per-test rather than globally in `vitest.config.ts` — the other suites are pure-model
  and their 5 s default is a genuine signal. **Verified: four consecutive full-suite runs at
  964/964.** 2.14 separately fixed the flake it introduced in its own file
  (`vi.setConfig({ testTimeout: 20_000 })` file-scoped plus `userEvent.setup({ delay: null })`,
  which cut that file from 5.6 s to 2.0 s while still dispatching real key events). Recorded
  rather than deleted because the measurement — a spawning test is the shape that flakes under
  worker contention — is the reusable part, and because the next story to add a heavy test file
  should expect to meet it again.

## Deferred from: code review of 2-14-header-search (2026-08-07)

- **`playerHref` ships without converting the three inline `/players/` call sites.** Story 2.14
  added `playerHref` to `hub-model.ts`, and the helper's own docblock justifies its existence by
  naming call sites that interpolate the route by hand — *"a caller that … hand-writes the third
  is exactly how a missing trailing slash gets in"*. All three remain hand-written:
  `LineupsDisclosure.tsx:34`, `LeaderboardsSection.tsx:200` and `LeaderboardsRegion.tsx:424` (the
  last two also hand-write `/teams/${…}/` beside the existing `teamHref`). So the helper currently
  adds a fourth spelling rather than consolidating three. **Not deferred to nobody — Story 2.15
  already owns it by name.** Its D10 rules: *"Three surfaces interpolate `/players/` inline today
  and all three become live links when this route ships … Switch all three to `playerHref()`."*
  Recorded here only so the interval between 2.14 landing and 2.15 shipping is not mistaken for an
  oversight. **Owner: 2.15. Close this entry when 2.15 converts them.**

- **The static-output module-graph walk cannot see two legal spellings of the fetch it asserts set
  equality over.** `app/src/app/static-output.test.ts:425`'s `FETCH_ARTIFACT_PATH` is
  `/fetchArtifact\s*<[^>]*>\s*\(\s*(?:"([^"]+)"|`([^`]+)`)/g` — the `<[^>]*>` segment is
  **mandatory**, so a `fetchArtifact("/index/x.json")` written with an inferred type argument
  matches nothing, and `[^>]*` terminates early on any nested generic
  (`fetchArtifact<Record<string, T>>`). `ALIAS_IMPORT` (`:414`) follows only `from "@/…"`, so a
  relative import or a dynamic `import()` truncates the walk silently. The assertion built on it,
  `expect(reachable).toEqual(["/index/tournament.json"])`, describes itself as catching a MISSING
  fetch as well as an extra one; against either unmatched spelling it stays green. **Pre-existing:
  the mandatory-generic segment predates 2.14, which only added the template-literal alternation.**
  Partly mitigated in place — `tournament-index.ts:81-88` documents the resulting constraint at the
  call site in red (*"THE FETCH CALL IS WRITTEN VERBATIM AND MUST STAY THAT WAY"*) — but the
  mitigation is a comment, not a gate, and it protects only the one call site that carries it.
  **Owner: unassigned.** The fix is to make the generic optional and to walk relative and dynamic
  imports, or to replace the regex walk with a real module-graph read.


## Deferred from: 2-15-player-profile (2026-08-07)

**CLOSED — the duplicated recharts vendor chunk.** Closes *"Adding the second recharts importer
DUPLICATED the recharts vendor chunk rather than sharing it."* **The filed remedy was insufficient
as written and is corrected here, not merely executed.** It proposed *"a single shared re-export
module that both leaves import"* — but `MomentumChart.tsx` and `TacticalCharts.tsx` already
imported the identical bare specifier `"recharts"`, so module identity was never the cause. The
duplication is **per async chunk group**, and there were two groups because there were two distinct
`dynamic()` **import specifiers**. A barrel both LEAVES import changes nothing; a barrel both CALL
SITES import collapses them. The converse was already proven in-repo: five `dynamic()` handles
across three files all naming `@/components/TacticalCharts` produced one group (`PhasesSection`'s
own docblock). `app/src/components/Charts.tsx` is that barrel; all five handles across four files
now name it.

Measured on the built export, gzip-9 in brackets:

| | before | after |
|---|---|---|
| chunks classified VENDOR | **2** — 300.4 KB [89.4] + 300.4 KB [89.2] | **1** — 359.0 KB [103.2] |
| `MomentumChart` leaf | 47.2 KB [13.3] | merged into the one chunk |
| `TacticalCharts` leaf | 34.5 KB [10.4] | merged into the one chunk |

Three-scenario cost, gzip-9:

| scenario | before | after | delta |
|---|---|---|---|
| Match `<lg`, reader opens nothing (`momentum` is in `ALWAYS_EXPANDED_SECTION_IDS`, so it mounts at every width) | 102.7 KB | 103.2 KB | **+0.5 KB — the regression, and the number that matters: the `<lg` Match Dashboard is Lighthouse-gated** |
| Match `>=lg` (Tactical sections default open) | 202.3 KB | 103.2 KB | **-99.1 KB** |
| Match `<lg`, reader opens any second chart section | 202.3 KB | 103.2 KB | **-99.1 KB** |
| `/players/{slug}`, PAGE WEIGHT | ~89.2 KB vendor + its own leaf | 103.2 KB shared | **~+14 KB — a regression, like the `<lg` match page** |
| `/players/{slug}`, EXPORT TOTAL | would have minted a THIRD vendor copy | shares the one chunk | **-89 KB of build artifacts** |

**The `/players/{slug}` row was corrected at code review 2026-08-07, and the correction is worth
stating rather than quietly editing.** It read a single `-89 KB`, which is the EXPORT-TOTAL number —
the third vendor copy the barrel avoids minting — reported inside a table whose other three rows are
PAGE-WEIGHT deltas. Per page the sign is inverted: this route renders only `ProfileCharts`, so with
its own specifier it would load one vendor chunk (~89.2 KB) plus its own leaf, and with the barrel it
loads the merged 103.2 KB, which carries `MomentumChart`'s 13.3 KB and `TacticalCharts`' 10.4 KB of
leaf code this route can never render. Both numbers are true and neither was measured wrongly; the
row conflated two different questions. D1 (the story spec) framed it the same way, so this is an
inherited framing rather than an implementation slip — recorded here so the next story reading this
table does not re-inherit it.

The `<lg` regression is **+0.5 KB gzip against D1's ~40 KB stop-threshold**, so the escape hatch (a
Turbopack `cacheGroup`-equivalent) was neither needed nor adopted. `/players/{slug}` is not
Lighthouse-gated (`epics.md:67` scopes NFR-1 to Match Dashboard and Tournament Hub), which is
exactly why the mobile match-page number is the one recorded — and why the ~+14 KB this route pays
was accepted rather than escaped.

**CLOSED — the `/players/` half of the dangling-link entry.** All three inline interpolations now
call `playerHref()`: `LineupsDisclosure.tsx`, `LeaderboardsSection.tsx` and `LeaderboardsRegion.tsx`
(the last two also take `teamHref()` in the same ternary). `/players/` **is a live route from this
story on**, so the trailing slash stopped being cosmetic — `trailingSlash: true` rewrites a
slash-less href at request time. `MatchHero.tsx`'s two `/teams/` interpolations and
`LeaderboardsRegion.tsx`'s third are deliberately untouched: out of scope, and `/teams/` belongs to
Story 2.16.

**CLOSED — the `InvolvementChart` edge-drawn hatch.** Closes Story 2.13's filing against *"whoever
next opens that file"*. `x1`/`x2` moved from `0` to `HATCH_TILE_PX / 2`, matching
`DistributionChart`. Verified in the browser in BOTH themes: all six patterns on the match route
now report `x1="3" x2="3"` with `stroke-width="1.5"`, and the stripe renders at full width rather
than as the clipped 0.75 px half-stroke.

**RULED AND FIXED — the row-link focus ring.** Closes *"The row-link focus ring paints on the
ANCHOR's box, not on the row — observed, not assumed."* This story rules the linked-row pattern on
its second surface and **fixes it rather than restating it**: the ring moves off the anchor
(`focus-visible:outline-none`) and onto the `<tr>` (`focus-within:outline` +
`outline-offset-[-2px]`, carried through `DataTable`'s `rowClass`). 2.12 prototyped
`tr:has(a:focus-visible)` and declined it because it *"either doubles the indicator or requires
suppressing the native ring, and `outline-none` is a house prohibition"* — the prohibition is
against suppressing an indicator, and here the row paints one in the anchor's place, which is the
one condition that makes the suppression legal. Verified under a REAL Tab press (2.13's ruling that
`element.focus()` is not a substitute): focus on the m001 row anchor, anchor `outline-style: none`,
`<tr>` `solid 2px rgb(14,116,144)` at `-2px` offset, ring box **1411x63** against the anchor's
**58x50**. The click target and the focus indicator now describe the same region. **`DataTable.tsx`'s
own note — "this is what keeps it satisfied when 2.15 makes those names links" — is discharged.**

> **OVERTURNED AT CODE REVIEW 2026-08-07, and this entry is RESTATED rather than closed.** Juan
> ruled Story 2.16 Q2 — *"accept the anchor-box focus ring"* — while this story was in `review`, so
> the tree carried two contradictory rulings for one pattern and two `RowAnchor` implementations to
> match. The anchor-box ring wins on the merits as well as on precedence, for a reason this entry
> did not see: **`:focus-within` matches on ANY descendant `:focus`, including the focus a MOUSE
> CLICK puts on the anchor**, so the row painted a persistent 2px ring for pointer users that the
> anchor's `:focus-visible` ring never did and that no ruled visual state covers. The measurement
> above is real and the geometry argument still has force — a 1411x63 ring does describe the click
> target better than a 58x50 one — but it was bought with `outline-none`, which the house prohibits
> and which has now cost three review patches. `PlayerMatchesSection` therefore imports
> `@/components/RowAnchor` and its private copy is deleted (Story 2.11a decision 1: *"every private
> copy is deleted"*), which also removed the `HubTable` fork that only existed to carry the row-level
> `rowClass`. **Owner of the remaining question — whether a row-scoped indicator is worth minting a
> DESIGN.md treatment for — is whichever story next revisits the linked-row pattern.**

**CLOSED — the minutes half of the zero-minutes entry.** Closes *"20 players carry `played > 0`
with `minutesPlayed: 0`"*, whose copy ruling was assigned to this story by name. **RULED: render
verbatim through the same integer formatter as every other minutes cell — `0`, not `<1`, not a
dash, no footnote.** AR-5 requires verbatim; `<1` is a client-side reinterpretation of a precomputed
value; and the em dash is this codebase's MISSING-data glyph (`MomentumSection.tsx`: *"asserted
absence of information where the information exists"*). Story 1.18's own conclusion — *"`0` is the
honest floor"* — is simply carried onto the surface. Verified in the browser on
`acevedo-carlos-mex`: the appearances line reads `Partidos: 0 · Titular: 0 · Suplente: 0 · Minutos:
0`, and no em dash appears in any data cell on the route (the two on the page are a caption
separator and the site footer). **The `perNinety` half of that entry travels with the new filing
below.**

**RECORDED AS DISCHARGED — the y-tick trap.** *"recharts' automatic y-axis ticks are non-uniform and
omit zero on an 'un-nice' domain"* names Story 2.15 among the stories that *"will hit the same
default"*. Both charts on this route pass explicit `ticks` AND `domain`, never left to recharts.
Verified live: the speed-zone axis emits `0,0 / 5.000,0 / ... / 20.000,0` and the trend axis emits
`0 / 1 / 2 / 3 / 4` for a count series — zero present, uniformly spaced, in both cases.

**FILED — `perNinety` is rendered on no surface (ruled D3), and the numbers are why.** The
denominator explodes: **62 players sit on 1-14 minutes**, and the corpus maximum is **104,139.0**
(`stewart-ross-sco`, `totalDistance`, 1,157.1 m over **one** minute); `henderson-jordan-eng` reads
value 1,790.7 against perNinety 26,860.5. Unsuppressed, that puts a six-digit number beside a
four-digit one in the same column; suppressing it needs a minutes floor, which is a product rule
this story does not have. The field stays in the artifact, untouched and unread. **Objection
recorded:** per-90 is arguably the most analyst-useful column on a profile and dropping it thins
FR-27; the counter is SM-C2 (depth behind disclosure, not deleted) plus the fact that a rate with an
unruled denominator policy is worse than no rate. **If review overturns, the remedy is a ruled
minutes floor PLUS copy, never a bare column. Owner: whichever story first needs a rate** — this
also absorbs the `perNinety` half of the zero-minutes entry closed above.

**FILED — `passCompletion: 0,0 %` is ambiguous at hero and aggregate altitude (ruled D4b).** Story
1.18 ruled `sum(passesAttempted) == 0` implies `value 0.0`, true for **17 players and 52 emitted
match rows**. It renders as `0,0 %`, which reads as *"completed none of many"* rather than
*"attempted none"*. **In the per-match table this is NOT a defect and needs no copy:**
`passesAttempted` renders in the same row, so the honest reading is available without minting an
interpretive gloss. **In the Hero tile and the aggregates table it is a real ambiguity** — neither
surface renders `passesAttempted` adjacent — and it is filed rather than papered over, because the
fix is either a copy ruling or an extra column and both are product decisions. **Owner:
unassigned.**

**FILED — `LEADERBOARD_FORMAT.totalDistance` is `"integer"`, which is wrong on a profile.** Correct
for the leaderboards artifact; a silent AR-5 breach here. Measured across the real corpus:
`totalDistance` is fractional in **918 of 1,248 aggregates** and **2,937 of 3,288 per-match rows**
(Story 1.18 puts metres at 1 dp), so printing 47.274,9 m as "47.275" is the App rounding a
precomputed value — invisible, because a rounded distance still looks like a distance. Scoped around
rather than mutated: `profileMetricFormat()` in `player-profile-model.ts` narrows that ONE code to
`decimal1` and leaves `LEADERBOARD_UNIT` and every other code on the contract-fixed table. **Owner:
whichever story next audits `LEADERBOARD_FORMAT`** — the leaderboards surface may or may not want
the same 1 dp, and that is a separate question this story did not take.

**FILED — D6's x-tick ruling named a field that does not exist on this route, and was amended.** D6
rules the trend chart's x-tick label *"the opponent's team code (`opponent.id` -> code)"*. There is
no such field reachable here: `PlayerMatchRow.opponent` is an `EntityRef` (`{id, name}`), and
`teamCode` lives only on `MatchMetadata.homeTeam/awayTeam` and on `tournament.json`'s
`entities.teams[]`. The region fetches ONE artifact (FR-26), the ids are not derivable into codes
("south-africa" is RSA, "korea-republic" is KOR), and on the fixture manifest only Mexico is listed
— so 4 of a 5-match series would resolve to nothing even with a second fetch, and adding that fetch
would breach the route's own allow-list. **AMENDED: the x-tick is the match DATE**, via a new
`formatDateShort` in `@/lib/format` (the only formatting path). It satisfies D6's stated criterion —
*"the only per-point label that is meaningful across all six metrics"* — is chronological, matching
the x ordering, and is a formatting of a verbatim field rather than a derivation. The opponent is
not lost: it is carried in the data-table alternative, in the figure summary and in the per-match
table directly below, all on the same artifact slice (NFR-2). `{day:"numeric", month:"short"}` was
rejected on measurement — es-CO renders "11 de jun" (9 chars, Spanish inserts the preposition)
against a ~220 px plot at 320 px. **If a team code ever becomes reachable from a profile, this is
the ruling to revisit.**

**FILED — `useEmptyHeadline()` is match-scoped and cannot be reused off the Match Dashboard.** It
composes `tactical.empty.headlineBefore` + title + `headlineAfter` = *"Sin datos de {seccion} **para
este partido**"*, which is false on any route that is not a match. The Hub already worked around it
with its own `empty.headline`/`explanation` pairs and did not record why; this story authors
`player.empty.*` for the same reason and records it. **Owner: whichever story next needs an empty
state off the Match Dashboard** (2.16 and 2.17 both will) — the fix is either a route-scoped variant
of the helper or a second composition fragment, and doing it once beats a third hand-rolled pair.

**FILED — `expert.field.highSpeedRuns` is an ABBREVIATION ("CARR. ALTA VEL."), not a term.** D12's
reuse table names it as the shipped term for high-speed runs. It is not: the Expert Layer can use it
because a sortable `<th>` carries the full term in `headTitle`, but a stat TILE has no such slot, so
it rendered as an unexplained all-caps string — exactly what UX-DR17/UX-DR19 require a full term
behind. Caught in the browser, not by any test. Fixed in place by reading
`enums.leaderboardMetric.highSpeedRuns` ("Carreras a alta velocidad"), which is equally shipped and
equally a reuse. **Owner: unassigned** — worth an audit of the other `expert.field.*` entries D12
lists as terms, since at least one more may be an abbreviation in the same way.

**NOT RE-FILED — the `<title>`/OG language question.** This route INHERITS *"`<title>`/OG description
stay Spanish after an EN toggle"* (owner: Juan, unfiled since 2.12 took it for `/`).
`generateMetadata` here is the same server-`t()` shape, so `/players/{slug}` joins the population —
and at Story 2.19's cutover that is **1,248 routes**, which is the scale argument for ruling it
before then. Deliberately NOT duplicated as a new entry: one question, one owner.

**REPORTED, NOT FIXED, AND NO OWNER CLAIMED — `assert-schema-version.test.ts`.** The story records it
as *"already times out against the grown data tree"* with the ledger carrying conflicting owners
(1.17 / 1.18 / 1.19). It did **not** time out in this story's runs: it passed in 694 ms and 497 ms
across the full suite. Reported as instructed; no owner claimed and nothing changed.

**COORDINATION, recorded because it affected this story's verification.** Two other sessions were
live in `app/` throughout. (1) Story 2.14's code-review session ran a sweeping `git add` and
committed this story's in-progress work inside commit `79bd7aa` ("Story 2.14 code review..."), so
2.15's files are in history under another story's message. (2) Story 2.16's session added
`Team*.tsx` components referencing a `team.*` namespace not yet in `es.ts`, which turns `npm run
build` red **in the shared tree** — 23 `tsc` errors, all in `TeamFormationsSection.tsx`,
`TeamIdentitySection.tsx` and `team-profile-model.test.ts`, **zero in any 2.15 file**. This story's
full gate (lint, typecheck, `assert:schema-version`, `next build`, `copy-data`) and its full suite
were therefore verified in an isolated worktree at HEAD plus this story's own diff: **build green,
1,060 tests green, exactly one VENDOR chunk.**

### Sizing measurement for Story 2.19 (Task 9.4 — measured once, then reverted)

Both cutover points flipped together (`build-data.ts` `DATA_ROOT` -> `../data`, `data.ts` ->
`/data`), built, measured, and **both reverted** — `git diff` on `data.ts` is empty and on
`build-data.ts` shows only this story's `readPlayerProfile`.

| | measured |
|---|---|
| player routes generated | **1,248** |
| match routes generated | **104** (this flip generates those too) |
| `next build` wall clock | **76 s** (lint/typecheck/schema-assert excluded) |
| `out/` total | **79.3 MB** across **12,243** files |
| `out/players/` | **65.6 MB**, 11,232 files (~9 per route: `index.html` + segment `.txt`) |
| `out/matches/` | **11.6 MB**, 936 files |
| one player HTML | **23,328 B** (`bellingham-jude-eng`) vs **23,247 B** on fixtures |
| `data/` tree `copy-data.mjs` would copy | **26.4 MB**, 1,412 files |

**Nothing timed out and nothing failed.** The one number worth carrying forward: a real player's
exported HTML is **81 bytes** larger than a fixture player's, which is the AD-11 projection holding
exactly as intended — the Hero payload is bounded by the projection's seven fields, not by profile
size, so the 1,248-route pre-render does not grow per-page HTML.

## Deferred from: code review of 2-15-player-profile (2026-08-07)

- **The horizontally-scrolling data tables ship no visible scroll affordance.** The Story 2.15 spec
  required one for the 15-column per-match table — *"an `overflow-x-auto` wrapper with visible
  affordance (UX-DR15 allows horizontal scroll only inside wide containers)"* — and the table ships
  the scrollport (`w-full min-w-0 overflow-x-auto`) with no edge shadow, gradient or hint. Deferred
  because **no shipped surface has one either**: `ExpertLayer.tsx`, `HubTable.tsx` and
  `LeaderboardsRegion.tsx` are all bare `overflow-x-auto`, so there is no house pattern to reuse and
  minting one is a design decision across five surfaces rather than a fix to one. Owner: whichever
  story first rules the scroll-affordance pattern. Reflow itself is clean — zero page overflow at
  320 and 390 px, both locales, both themes.

- **`MatchBundleRegion`'s loading skeleton carries `aria-label` on a role-less `<div>`.** A `<div>`
  with no role maps to `role="generic"`, for which ARIA declares name-from-author **prohibited**, so
  the label is dropped, axe's `aria-prohibited-attr` flags it, and the retry `focus()` lands on an
  unnamed node. `LeaderboardsRegion.tsx` was patched for exactly this at the Story 2.13 code review
  (`role="group"` — *"the minimal role that legitimately takes a name and adds no live region"*);
  `MatchBundleRegion` was missed and is still unpatched. Story 2.15's `PlayerProfileRegion` copied
  the unpatched sibling and is being fixed under its own review; this entry covers the original.
  Owner: whichever story next opens `MatchBundleRegion.tsx`.

## Deferred from: 2-16-team-profile (2026-08-07)

`/teams/{slug}` shipped. Rulings taken by Juan during the story: **R1 option (A)** (2.16 mints the
`shapeByPhase` vocabulary), **Q2** (accept the anchor-box focus ring), **Q3** (no shootout-draw copy).

### CLOSED by this story

- **The `/teams/{id}/` dead links are live.** The route builds and pre-renders from the manifest.
  Measured on the built export: **eight distinct `/teams/` slugs are linked and only `mexico`
  resolves** — czechia, germany, korea-republic, mexico from standings; belgium, paraguay, senegal,
  south-africa from the four match headers. That is a **fixture property**, not a defect: the fixture
  manifest lists one team, and the other seven resolve at Story 2.19's real-data flip. A **fifth
  emitting surface** exists that the story brief did not name — `/players/{slug}` now links to its
  player's team (Story 2.15), alongside standings, `MatchHero`, the leaderboards and header search.

- **The linked-row focus ring.** Filed as *"the row-link focus ring paints on the ANCHOR's box, not
  on the row"*, owner *"whichever story rules the linked-row pattern"*. **RULED by Juan (Q2): accept
  the anchor-box ring.** Verified in the browser under REAL Tab key presses on `/teams/mexico/`:
  `outline: solid 2px rgb(14,116,144)` on a **51x44** anchor box inside a **1104x57** row, not
  suppressed, hit target >= 44 px. The alternative — a row-wide `focus-within` treatment — either
  doubles the indicator or requires `outline-none`, a house prohibition that has already cost two
  review patches, and DESIGN.md specifies no row-focus treatment to copy.
  > **DIVERGENCE FILED, not closed.** Story 2.15 independently shipped the row-wide form on
  > `/players`: `PlayerMatchesSection.tsx` carries `focus-within:outline` plus
  > `focus-visible:outline-none` on the anchor. Two linked-table surfaces now differ. The hoisted
  > `RowAnchor` follows Juan's ruling. **Owner: Story 2.17**, when it repoints the second copy.

- **The recharts vendor-chunk duplication.** **Story 2.15 fixed this in the tree and filed nothing**,
  so this closure records 2.15's fix rather than claiming it. Measured by 2.16 before any change
  (Task 1.4) and again after (Task 2.4), discriminating a vendor chunk on `CartesianAxis` **AND**
  `Brush` **AND** `redux` together — `CartesianAxis` alone also matches the 34.5 kB `TacticalCharts`
  leaf and cannot identify a vendor chunk:

  | | Before 2.15 | After 2.15's D1 | 2.16 Task 1.4 | 2.16 Task 2.4 |
  |---|---|---|---|---|
  | 300.4 kB VENDOR chunks | 2 (89.4 + 89.2 kB gzip-9) | 1 | **1** (367,636 B raw) | **1** |
  | distinct `dynamic()` specifiers | 2 | 1 | **1** | **1** |

  2.16 added four chart mounts and the count did not move: all four name `@/components/Charts`, so
  the call sites went 6 to 7 inside one chunk group.

- **The "Más columnas" follow-on.** Discharged by `TeamMatchesSection`'s narrow-layout column
  reduction (13 columns to 5) plus `TableSortMenu`, reusing `hub.columns.{more,fewer}`. Hidden
  columns are `display: none` and stay in the model, so sorting a hidden column reveals it rather
  than silently re-ordering.

- **The per-term policy-table entry.** Discharged by the rows appended to `EXPERIENCE.md`, including
  the new **`team width` to "amplitud del equipo"** row.

### RECORDED, not claimed

- **`InvolvementChart`'s edge-drawn hatch is ALREADY FIXED, by Story 2.15, not by 2.16.**
  `TacticalCharts.tsx` now centres the hatch with the comment *"CENTRED, like DistributionChart's
  (Story 2.15, D11 — the defect Story 2.13 filed against 'whoever next opens this file')."*
  Recorded here so the entry stops reading as open.

### ROUTED ONWARD, with evidence

- **The Team B non-hue channel goes to Story 2.17 ONLY.** Story 2.13 routed it to "2.16 / 2.17"
  reasoning that *"the first real two-team surface is a profile or comparison chart"*. **The profile
  half of that guess is wrong and this story's own AC is the evidence.** AC 2 says single-entity
  charts use `viz-single`; `team-profile.schema.json` carries **no opponent series** —
  `tacticalIdentity` is one team's aggregates, `formationUsage` is one team's formations, and
  `matches[].opponent` is a bare `EntityRef` with no metrics attached. Every chart on
  `/teams/{slug}` plots ONE team. `/compare` is the genuine first two-team surface.
  **Sole owner: Story 2.17.**

- **`seriesLabelIndex` stays with "the first successor story to reuse `DistributionChart`".** 2.16
  does not reuse it — ruled D2 generalized the single-series chart instead — so the item does not
  transfer here. **Still genuinely open and unfixed**: `TacticalCharts.tsx` still resolves the label
  index with no `-1` sentinel. **The ledger's cite `:229-237` has drifted to `:239-247`**, corrected
  here per this file's append-a-correction convention.

### FILED (new)

- **`MatchHero`'s two prefetch sites — FILED AND FIXED IN THE SAME STORY, with the measurement.**
  They had never been filed. `prefetch` was **ABSENT** on both, so Next's default was ON. While
  `/teams/{id}/` did not exist this cost two cheap 404s and nobody noticed; **2.16 built the route
  and the cost changed shape.** Measured on `/matches/m001-mexico-south-africa/`:

  | | resource entries | `/teams/` requests |
  |---|---|---|
  | before the flip (route now exists) | 38 | **7** (~5.7 kB) |
  | after `prefetch={false}` | **31** | **0** |

  The seven were `/teams/south-africa/` (a 404) plus `/teams/mexico/` and its **five RSC payloads**
  (`__next._tree.txt`, `__next._head.txt`, `__next.teams.txt`, `__next.teams.$d$slug.txt`,
  `__next.teams.$d$slug.__PAGE__.txt`). At 2.19's scale both sides resolve on all 104 match pages.
  Both links now carry `prefetch={false}` and were repointed from hand-written route literals to
  **`teamHref()`**.
  > **The five other `prefetch={false}` sites were deliberately LEFT ALONE.** They sit on sort/filter
  > surfaces with an explicit zero-network AC (FR-26), where the waste 2.13 measured (48 to 75
  > entries across one sort pass) was the **per-sort re-fire**, not the 404. A built route does not
  > change that arithmetic. Still hand-writing the route inline beside `teamHref`:
  > `LeaderboardsSection.tsx:200` and `LeaderboardsRegion.tsx:424`. Owner: whoever next opens them.

- **AC 1 says "form strings"; the contract ships no `form` field on a team profile.**
  `team-profile.schema.json` has no `form` property — the word appears there only inside
  `formationUsage`. What exists is `TeamMatchBreakdown.result`, a contracted `MatchResult` per row.
  2.16's D3 ruled the Hero strip a **projection of `matches[].result` in artifact order** (verbatim,
  nothing aggregated, so AR-5 holds). **The `form` field you WILL find is the wrong one:**
  `tournament.json`'s `groups[].standings[].form` IS a `MatchResult[]` and `TournamentHub` already
  chips it — but it is **group-stage only** (three entries for a team that played eight), and
  `/teams/[slug]` touching `tournament.json` would fail the per-route module-graph allow-list, which
  uses set equality. Filed so 2.17 and 2.19 do not read AC 1 as naming a missing field.

- **The shootout `draw` presentation trap.** Story 1.18's R4 makes `result` follow `metadata.score`,
  so the **8 team-rows of the 4 shootout matches** (`m074`, `m075`, `m088`, `m096`) read `draw`, and
  a team that advanced on penalties shows a **draw chip** on that row. Progression is carried ONLY by
  `record.furthestStage`. **Ruled Q3 by Juan: no new copy** — `furthestStage` is on the Hero and a
  sentence explaining a contracted enum invites more copy than it resolves. Filed so the next reader
  does not read it as a bug.

- **`team-profile.schema.json:97` describes `tacticalIdentity` as a "match-count-weighted mean" and
  that is MISLEADING.** `pipeline/precompute/profiles.py:22-25` records the team implementation is
  **unweighted**, while the player artifact's `passCompletion` IS weighted — *"the same word
  'average' means two different arithmetics in the two artifacts, and both are correct"*. `contract/`
  is not the App's to correct. No shipped copy asserts a weighting: `team.tile.possession` reads
  "Posesión en el torneo" and deliberately avoids "promedio". Owner: whoever next opens `contract/`.

- **The CS-2 `shapeByPhase` filing needs an owner split.** CS-2 filed the whole thing to Story 2.19.
  **2.16 owns the VOCABULARY** (minted under R1 option (A), rows in `EXPERIENCE.md`, keys under
  `team.shape.*`). **2.19 keeps the match-route `#pressing` re-presentation**, which 2.16 did not
  touch — `phases-model.ts` and `TacticalCharts.tsx` are untouched by this story.

- **Two on-page string collisions in the minted R1 vocabulary.**
  `team.shape.inPossession.finalThirdPhase` reads "Último tercio", identical to
  `enums.inPossessionPhase["final-third"]`; and `team.shape.outOfPossession.{midBlock,lowBlock}` read
  "Bloque medio"/"Bloque bajo", identical to `enums.blockLevel.{mid,low}`. **Both pairs render on
  `/teams/{slug}`** — the enum in a rate chart, the panel in a shape table. Juan approved these exact
  strings at R1; filed rather than silently resolved, because the alternatives invent terms
  `EXPERIENCE.md` does not carry.

- **`PlayerMatchesSection.tsx` still holds a private `RowAnchor`.** 2.16 hoisted the pattern to
  `src/components/RowAnchor.tsx` from `TournamentHub`'s copy and repointed that one. The second copy
  was left because Story 2.15 was `in-progress` in a concurrent session with the file untracked when
  the coordination check ran — 2.16's D4 makes the hoist conditional on exactly that. 2.11a decision
  1, *"every private copy is deleted"*, is still owed. **Owner: Story 2.17.**

- **The `viz.pressing.metre*` caption and key family is ORPHANED and still shipped.**
  `viz.pressing.{metres, metre.*, metreNote, metreTableCaption}` lost their surface when CS-2 retired
  `PossessionSplitMetres` — `PressingSection.tsx` says so in a comment — yet `metreTableCaption` still
  occupies a slot in `i18n.test.ts`'s composed-caption inventory and `metre.*` still has pinned
  assertions. 2.16 did **not** retire them: the caption count is three hardcoded literals
  (`toHaveLength(27)`, `.toBe(27)`, `.toBe(28)`) that Story 2.17 was concurrently editing for
  `/compare`, and two stories editing one count is how it goes wrong. **Also note
  `viz.pressing.metreNote` is now FALSE** — it says the report does not define which phase the
  distances belong to, and CS-2 established the opposite. The two glossary definitions making the
  same false claim (`line-height`, `team-length`) **were** corrected by 2.16 in both locales.
  Owner: Story 2.17 or 2.19, whichever next touches the caption inventory.

### NOT RE-FILED (deliberately)

The Hub standings prefetch (resolved in `29e90fb`); the `assert-schema-version` timeout (fixed by
2.14); the title/OG language decision (filed under Story 2.12, owner Juan — 2.16 inherits it and
`/teams/[slug]/page.tsx` carries the same note as `/players`).

### NOT VERIFIED by this story — stated rather than implied

- **Reflow at 320 / 390 CSS px was NOT measured.** The browser automation could not resize the
  window: the tool reported success while the window stayed at 1920, and both `window.resizeTo` and
  a same-origin popup were blocked. **Contrast WAS measured** in both themes and passes with zero
  failures and zero `--ink-muted` table content, method-validated first by reproducing DESIGN.md's
  published result-chip ratios (10.68 / 6.66 measured against 10.68 / 6.66 published). 200% zoom and
  an actual `prefers-reduced-motion: reduce` media state were likewise not exercised, though the page
  carries **zero** animations in its default state. Owner: Story 2.19's accessibility hardening, or a
  manual pass before release.

## Filed by Story 1.19 implementation (full batch run, batch report, 104/104 acceptance, 2026-08-07)

### Closed by this story

- **The batch summary's warnings block IS de-duplicated — all THREE filings closed.**
  Anchors: *"so the batch summary prints 104 identical warning lines"* (1.12), *"so the batch
  summary now prints 208 more warning lines"* (1.13), *"A fourth family of absence warning now
  fires on every report"* (1.14). Filed three times and deferred three times for one stated
  reason: it *"touches `format_summary`'s shared rendering, which several stories' checks
  depend on."* **That blocker was measured and it does not hold.** All seven dependent tests
  were read: every one asserts `<WARNING_CONSTANT> in format_summary(manifest)` — a
  **substring** check on the warning text. None asserts the `f"  {report_id}: {warning}"`
  prefix and none asserts a line count, so all seven survive the collapse and all seven are
  still green. The block now iterates warning-first: above `WARNING_NAMED_MAX` (3) reports a
  warning renders as one `  {n} reports: {warning}` line, at three or fewer it still names
  each report, and the text is emitted **verbatim** — no truncation, elision or reflow.
  Ordering is first appearance over `manifest["reports"]`, never `set` order, so the summary
  stays byte-identical across runs. **The manifest is unchanged**; per-report `warnings`
  arrays still carry one entry per report. This is a rendering change only.
  **Measured on the authoritative run: the warnings block renders 7 lines where the same
  manifest previously produced 728 (104 x 7).** Owner: none — closed.

- **`emit_bundles`' non-atomic write — CLOSED, and BOTH filings are closed together.**
  Anchor: *"An `OSError` mid-write leaves `data/matches/` partially populated with no
  rollback."* The original is Story 1.16's; Story 1.18 re-filed it verbatim with *"stays OPEN
  with its existing owner"*. Closing one and leaving the other is exactly the failure mode
  this list exists to prevent, so both are named here and both are closed. `emit_bundles` now
  writes every bundle into `data/matches.staged/` and installs the namespace with one
  directory rename (`pipeline/precompute/swap.py::swap_directory`, **lifted** from 1.18's
  shipped `profiles._swap_directory` rather than reinvented — `profiles.py` now imports it and
  keeps the private name as an alias, so 1.18's ruling and its tests are untouched).
  The directory swap also **subsumes the stale sweep it replaced**: the sweep existed to delete
  bundles the run did not produce, and a swap installs exactly what the run built, by
  construction rather than by a second pass. Only the final write loop and the sweep changed —
  the collection phase, and the load-bearing reason `expect_matches` is checked *inside*
  `emit_bundles`, are untouched. Driven red by a constructed `OSError` on bundle 57 **through
  the real emitter in memory**, never off the committed tree, asserting the target namespace is
  unchanged **on bytes** rather than on a file count. Owner: none — closed.

- **`emit_index`'s non-atomic write — CLOSED, and BOTH filings are closed together.**
  Anchors: *"A partial write to `data/index/` still has no rollback."* (Story 1.17) and *"A
  partial `data/index/` with no rollback, now on a second write path."* (its code review).
  Both are closed for the same reason. `emit_index` now stages both artifacts beside their
  targets and installs them as ONE unit with rollback (`swap.py::swap_files`), so
  `tournament.json` and `leaderboards.json` can never disagree about the same tournament.
  **A FILE swap, not a directory swap, and the distinction is load-bearing:** `data/index/`
  also holds `team-profiles/` and `player-profiles/`, so swapping that directory wholesale
  would destroy 1,296 artifacts the run never built — pinned by a test that populates both
  profile namespaces with the complete committed set and asserts them byte-unchanged across an
  index emission. The sweep stays scoped to the non-recursive `data/index/*.json` glob, which
  can reach neither the profile subdirectories nor this run's own `*.json.staged` siblings.
  Owner: none — closed.

- **The write-blocking bijection deadlock — CLOSED by ORDERING, with no gate touched.**
  Anchor: *"The profile direction of AD-4's bijection is WRITE-BLOCKING, which inverts the
  dependency between Story 1.17 and Story 1.18."* The ledger routed it here because *"Story
  1.19 owns end-to-end orchestration, which is where the phase ordering should be expressed"*,
  and the recorded recourse was to empty both profile directories, emit the index, then re-run
  1.18. **That recourse is not needed.** `profiles` reads `data/matches/` and nothing else —
  verified: its CLI takes only `--data-dir`, and it reads neither `work/spine/` nor
  `tournament.json` — so it has no dependency on `index` at all, while `index` has a hard one
  on it. Running `profiles` BEFORE `index` means the profile artifacts already match the entity
  set when `check_route_manifest` looks, so the gate passes on the first attempt and the
  deadlock never forms.
  **Reproduced before it was fixed**, on a scratch copy of `data/` rather than the committed
  tree: removing one file from `data/index/player-profiles/` and running `precompute.index`
  raises `RouteManifestError: … 1 listed players have no profile artifact
  ['aaronson-brenden-usa']` and writes nothing. Running `profiles` first over that same
  perturbed tree and then `index` asserts all three bijection directions and prints an
  **unqualified** `INDEX RESULT: PASS` — no `(N check(s) COULD NOT RUN)`. The authoritative
  104-report run reproduced the unqualified PASS at full scale.
  `check_route_manifest`, `check_pins`, `check_committed_data`, the budget gates and the schema
  asserts are all byte-identical to before, and the ordering is byte-neutral by construction:
  which bytes each phase writes is unchanged, only when they land moves. Expressed in
  `pipeline/orchestrate.py` (`python -m pipeline.orchestrate`) and in `pipeline/README.md`,
  which replaces the recourse paragraph. Note 1.17 explicitly rejected moving the bijection
  *assertion* to 1.19; this story inherited the **orchestration**, not the assert, and moved
  neither. Owner: none — closed.

- **The batch-scale test gap — CLOSED.** Anchor: *"No test exercises the batch beyond three
  reports"*. The gap was SCALE, not the `--expect-reports` match path: `test_a_clean_run_exits_zero`
  already asserted `--expect-reports 2` green at the CLI. The real blocker was that `_corpus`
  indexed a five-element `TEAMS` list directly, so any count above five raised `IndexError`.
  The first five pairs stay PINNED (existing tests name `PMSR-M02-CHA-V-DEL` and friends by
  hand) and pairs beyond them are now generated, which is all the corpus needs since report and
  match ids are keyed on the match NUMBER, not the pair. The batch is now exercised at twelve
  reports with `--expect-reports` matching at that size, plus a corpus test asserting the REAL
  run manifest carries exactly 104 entries, every one at a terminal status from `STATUSES`,
  `counts_by_status` summing to 104, and `failed_count == 0`. Owner: none — closed.

- **The standing staleness note — CLOSED by construction.** Anchor: *"All 104 staged Extraction
  Records are already stale against the current tree"*. Its stated blocker (*"no action while
  `pipeline/validate/` is still being edited by Story 1.1"*) is long gone, and this story's
  authoritative run is a fresh full re-extract of all 104 at the current `code_version`
  (`ad4735a216e2`). Owner: none — closed.

### Filed, not fixed

- **A killed run's staging siblings are gitignored but still reachable by the App's schema
  walker.** `app/scripts/assert-schema-version.mjs` walks every `*.json` under `data/`, and it
  walks the WORKING TREE rather than the index. A run killed mid-write leaves
  `data/matches.staged/*.json`, which the walker would visit even though `.gitignore` correctly
  stops them being committed. This is a **pre-existing property, not one this story
  introduced** — `data/index/*.staged/` has had exactly the same exposure since Story 1.18 —
  and it is bounded: the files are schema-valid artifacts carrying a real `schemaVersion`, so
  the walker passes rather than fails. Recorded because the `.gitignore` comment presents the
  sweeping-`git add` commit path as the whole exposure, and it is not.
  **Deferred:** the fix is a directory-skip rule in a file under `app/`, and `app/` is outside
  this story's authorised surface. **Owner: Story 2.19**, which already owns the `DATA_ROOT`
  flip and the App-side data-tree questions.

- **`check_route_manifest`'s docstring describes a world that ended when Story 1.18
  committed, and Story 1.19 added one more stale line to it rather than pay a full re-extract
  to fix prose.** The passage states that *"`data/index/team-profiles/` and `player-profiles/`
  are Story 1.18's output and do not exist"* — false since 1.18 committed 1,296 artifacts —
  and cites `test_the_repository_has_no_committed_profiles_yet`, which **Story 1.19 removed**
  (see below). The staleness is therefore **pre-existing**, introduced by 1.18's commit; 1.19
  added the dangling test citation to an already-stale paragraph. Anchor: *"the profile
  direction PRINTS that it could not run"*.
  **Deferred, and the reason is mechanical rather than a judgement call:** `index.py` is
  inside `code_version()`'s fingerprint, so a comment-only edit invalidates all 104 staged
  Extraction Records and forces a full re-extract plus a fresh byte-identity proof before this
  story's recorded figures would be true again. That is the exact trade ruling D1.7 already
  names — *"editing them is a no-op that re-invalidates all 104 staged records for nothing"*.
  The free half was taken: `pipeline/README.md` and the surviving test's own docstring were
  both corrected, since neither is fingerprinted.
  **Owner: whichever story next edits `pipeline/precompute/index.py` for a substantive reason
  and is therefore already paying for the re-extract.**

- **Story 1.19 REMOVED `test_the_repository_has_no_committed_profiles_yet`
  (`pipeline/tests/test_index_tournament.py`), which is the one deletion in its change set.**
  Recorded here because a deleted test is invisible in a diff read from the outside. It was
  Story 1.17's tripwire, red by design from the moment 1.18 committed, and its own docstring
  named the action: *"**When it fires, delete this test — do not weaken it.** The populated
  bijection above is its replacement and needs no further work."* It fired in 1.19's full
  suite (`1296 profile artifact(s) are now tracked by git`). Verified BEFORE the deletion, not
  after: `test_the_route_manifest_bijection_holds_against_the_committed_profiles` no longer
  skips — it runs and asserts all three directions on real data. The D2 design worked exactly
  as built; the pair swapped over together. Deleting a test does not disturb this story's
  byte-identity proof, because `tests` is in `fingerprint.EXCLUDED_DIRS` and so sits outside
  `code_version()`. Owner: none — this is a record, not an open item.

### Measured by the 104-report run; the entries stay where they are

- **Cover-line reconstruction thresholds — measured, entry STAYS OPEN.** Anchor: *"Cover-line
  reconstruction thresholds are unvalidated at the boundary"*, precondition *"validating the
  thresholds requires the real 104-report corpus"*. This story ran it: **104/104 reports parsed
  their cover lines**, with zero `"cover page has no scoreline"` failures, zero
  `MatchNumberError`, and all 48 team slugs resolving such that `check_pins` held all 1,400
  pinned ids. **That establishes only that no corpus report TRIPS either threshold; it does not
  measure the MARGIN, which is what the entry actually asks for.** Measuring the margin needs
  `probe.py` instrumented to record the observed line-gap and space-gap distributions, which is
  a production edit this story deliberately did not make — every such edit forces another full
  re-extract before the byte-identity proof can start. Recording "the corpus parses" as a
  closure would be the gate-that-cannot-fail mistake restated in prose.
  **Deferred:** unchanged. **Owner:** unchanged.

- **Zero-width and format characters — measured, entry STAYS OPEN on narrower ground.**
  Anchor: *"Zero-width and format characters survive `normalize`"*, precondition *"cannot
  confirm the corpus exhibits this without the 104 PDFs"*. Measured across all 104 staged
  Extraction Records: **zero** occurrences of U+200B, U+00AD, U+FEFF, U+2060, U+200E, U+200F,
  U+00A0 or the `ﬁ`/`ﬂ` ligatures, and **zero** characters of Unicode category `Cf` anywhere.
  So the corpus as extracted does not exhibit the hazard today. The entry stays open because
  its concern is a **future** corpus revision — *"a cosmetic font change would therefore report
  as a template revision across the whole corpus"* — and no measurement of today's corpus can
  close a claim about tomorrow's. The scan also covers only text that survives into the
  records; the anchor comparison the entry is really about happens on raw page text before
  staging. **Deferred:** unchanged. **Owner:** unchanged.

- **The combined index budget, re-measured: `tournament.json` 39,137 + `leaderboards.json`
  78,501 = 117,638 gzip-9 bytes = 23.5% of the 500,000-byte AD-4 ceiling.** Also re-measured:
  104 bundles totalling 17,887,538 canonical bytes, largest `m082-belgium-senegal` at 14,251
  gzip-9 (2.85%); 1,296 profiles, largest `bellingham-jude-eng` at 1,543 gzip-9 (0.31%). Every
  figure reproduces this ledger's and the story's recorded values exactly. **Recorded as a
  MEASUREMENT NOTE only.** The combined-budget entries are Story 1.17's, 1.17 is `done`, and
  one of them sits under this file's literal `### DO NOT FILE — already owned` heading. They
  stay closed under 1.17 and this story files nothing against them.

### Corrections (appended as corrections; no other story's paragraph was edited)

- **[Story 1.19 CORRECTION, 2026-08-07] The premise that reconciled `assert-schema-version`
  ownership to Story 1.19 was FALSE, and this correction applies to every filing of it.**
  The reconciliation reads *"Story 1.19's full batch run will multiply the tree again."* It did
  not and could not: the data tree was **already** at its full size before this story started —
  1.16 emitted the 104 bundles, 1.17 the 2 index artifacts, 1.18 the 1,296 profiles — and this
  story re-emitted exactly the same set. **Measured against the post-run tree:
  `node scripts/assert-schema-version.mjs` reports `1411 artifact(s) at schemaVersion 4`, exit
  0, in 1,659 ms.** That reconciles exactly with `git ls-files data/` = 1,412 (1,411 `.json`
  plus `data/fixtures/README.md`), and the artifact count is unchanged from before the run.
  The **timeout itself is already closed** by Story 2.14, which raised all three `it`s to an
  explicit `20_000` ms budget and verified four consecutive full-suite runs at 964/964 — that
  fix is now committed, not merely in a working tree. What remains open is the architectural
  question the reconciliation names and which neither 1.19 nor 2.14 answers: whether a
  unit-test run should re-walk the entire emitted corpus at all, now that the corpus is real
  rather than fixture-sized. **Deferred:** that is a decision about a file under `app/`, which
  this story is not authorised to touch. **Owner: Story 2.19.**

- **[Story 1.19, 2026-08-07] The pipeline-suite runtime entry is routed to *"whichever story
  next needs the pipeline suite to fit in a single un-chunked run"* — this story IS that story,
  and it RE-DEFERS with the measurement attached.** Anchor: *"costs 8m40s on its own"*.
  Measured on this story's tree: the full `pipeline/tests` suite ran **un-chunked in a single
  background invocation** and completed — **1,778 passed, 1 failed, 4 skipped in 4,097 s
  (1 h 08 m 17 s)**. So it does now "fit in a single un-chunked run" in the literal sense, but
  at more than double the ~45-minute figure this ledger records, with two concurrent Epic 2
  sessions active (1.17 measured 112 minutes under the same conditions, so this sits between
  the quiet-tree and contended figures). The single failure was Story 1.17's red-by-design
  tripwire, triaged individually and removed per its own instruction — not a regression, and
  not attributable to suite length.
  **Deferred:** the honest fix the original entry names — a session-scoped fixture for the
  read-only assertions while the write-path tests keep their own trees — is a real piece of work
  with a real risk of quietly coupling tests that are currently independent. This story made
  that tradeoff strictly worse and did so deliberately: `test_swap.py` adds five more
  full-emission passes, because Task 6's rollback and byte-neutrality proofs each need their
  own tree by construction, and driving a constructed write failure through a shared emission
  is exactly the mistake that scored 1.18's first mutation run zero red. Taking the runtime fix
  here would mean weakening the independence in the same story that added the proofs depending
  on it. **Owner:** unchanged.

### Explicitly NOT closed by this story, stated so the omission is not read as a miss

- **`domain_e_checks`' bare-subscript payload reads — NAMED for Story 1.19 by this ledger, and
  deliberately NOT taken.** Anchor: *"`domain_e_checks` reads its own payload by bare
  subscript"*, owner *"whichever story next edits `pipeline/validate/checks.py` — Story 1.19's
  batch acceptance is the natural point"*. This story planned no `pipeline/validate/checks.py`
  edit and made none. The prescribed fix (a record-shape guard, or a `RECORD_VERSION` bump with
  a real migration path) is a module-wide ruling, and taking it would add an unruled production
  edit that forces another full re-extract before the byte-identity proof could even start —
  the one sequencing constraint this story cannot absorb.
  *Disclosure: this story DID edit `pipeline/extract/domain_e.py`, adding `max_delta` to two
  bounded checks. That is the extractor, not `validate/checks.py`, and it does not touch the
  bare-subscript payload reads the entry is about.* **Deferred:** unchanged. **Owner:** unchanged.

- **The `>=` -> `==` pass-network tightening — NOT taken.** 1.18 proved the precondition
  unreachable (`events.passNetworkNodes` is `null` on 104/104 corpus bundles) and corrected the
  owner to *"whoever makes the node/edge fixtures total, or a decision to retire the test"*.
  **Deferred:** unchanged. **Owner:** unchanged.

- **`_parse_rows`' silent row skip — RE-DEFERRED by explicit ruling (Story 1.19 R3, answered by
  Juan).** Read against the source rather than the ledger's looser framing:
  `pipeline/extract/pass_network.py` **already raises** `PassNetworkParseError` on a shirt-less
  row carrying a name span. The residual silent skip is the `continue` on a row that bucketed
  nothing into either cell — page furniture whose x-centres fall inside the matrix columns. It
  is required by no AC, the raise-always vs raise-only-on-digit-spans choice is a second unruled
  decision, and each production edit forces another full re-extract cycle before the
  byte-identity proof can start. **Deferred:** to be sequenced with the next production edit to
  that module, so one re-extract covers both. **Owner:** unchanged.

- **The 219 given-name-first player slugs (`OVERRIDES` data edit) — NOT taken.** An edit would
  rename committed artifacts, break every affected URL, and break this story's AC 3
  byte-identity. **Owner:** Juan / UX, unchanged.

- **Renaming the two FR-15 gate check ids (`identity-completeness`, `identity-pinning`) — NOT
  taken**; a breaking change to the `checks_run` literal every gate consumer pins. **Owner:**
  unchanged.

- **Everything routed to Story 2.19** — the `DATA_ROOT` flip, 104-at-scale App verification,
  Lighthouse, sort collation over real names, accent-insensitivity in the browser, cluster
  density at 320px, the header-search payload question. **Owner:** unchanged.

## Deferred from: code review of 2-16-team-profile (2026-08-07)

Seven items triaged as pre-existing or cosmetic during the code review of Story 2.16. Each was
verified against the working tree before being deferred; none is caused by this story alone.

- **A `/teams/{slug}` → `/teams/{slug}` client navigation renders the previous team's sections
  under the new team's hero.** The fetch effect at `TeamProfileRegion.tsx` (the `useEffect` keyed
  on `[slug, attempt]`) resets neither `status` nor `profile` before refetching, so the stale
  payload stays mounted until the new one resolves. **Deferred as pre-existing:**
  `PlayerProfileRegion.tsx` carries the identical shape, and the reachable entry point
  (header-search team rows) hits both routes equally. **Owner:** whichever story next touches the
  profile region pattern — the fix belongs on both files in one edit, not on `/teams` alone.

- **The build reads each team artifact twice, and the docblock says it is read once per AD-11
  path.** `generateMetadata` and the page body both call `readTeamProfile(slug)`, which does a
  fresh `readFileSync` + `JSON.parse` with no memoisation, so the real count is three reads (two
  at build time, one client fetch) against the two the comment claims. 96 parses at 2.19's 48
  routes. **Deferred as pre-existing:** `/players/[slug]` has the same shape. **Owner:** 2.19, with
  the real-data sizing that Task 9.4 left unmeasured.

- **The AD-11 inline gate lost its standings-row-level probe.** `5c52643` correctly retired
  `goalDifference` — the premise that it was Tournament-only was already false, since
  `contract-types.d.ts` declares it on both `StandingsRow` and `TeamTournamentRecord` — and
  replaced it with `tournamentName`. The retirement was right and was driven red on purpose. What
  is left is that no token now asserts the absence of `standings` itself, so a route inlining only
  `groups[].standings[]` rows would pass the gate. **Deferred:** adding `standings` as a third
  token is cheap but needs a build to confirm it is not red on an already-correct route.

- **The dynamic-route family list in the every-route sweep is hardcoded.** `5c52643` replaced a
  `matches/`-only walk with an explicit `["matches", "players", "teams"]` list plus a vacuity guard
  per family — a clear net improvement over a sweep that had silently skipped `/players` and
  `/teams` since 2.15. The residual gap is that a family added later is still silently skipped
  until someone edits the literal. **Owner:** 2.17, which ships `/compare`.

- **`classAttrCount` now exists as a third private copy**, in the story that hoisted `RowAnchor` on
  the grounds that "every private copy is deleted" (2.11a decision 1). Copies live in
  `teams/`, `matches/` and `players/static-output.test.ts`. The new copy's docblock also states a
  premise that was already false in the tree it shipped into — "`/players` shipped **no**
  static-output test at all" — when `app/src/app/players/static-output.test.ts` exists.
  **Deferred:** two of the three copies predate this story; hoisting is one edit for whoever next
  adds a static-output suite.

- **D6's projection field list is exceeded by one scalar.** D6 rules the hero projection to be
  "exactly" nine `record` fields plus `name`, `teamCode`, `group`, `possession`,
  `pressingIntensity` and `matches[].result`, "nothing else". `TeamHeroData` also carries `teamId`,
  used only for `compareTeamHref`, a value the page already holds as `slug`. **Deferred as
  cosmetic:** the over-projection is harmless and the alternative is threading `slug` through the
  hero's props.

- **Tasks 9.4, 10.6 and 10.7 are unrun while the story sits at `review`.** Real-data sizing, reflow
  at 320/390 CSS px in both themes and both locales, 200% zoom and a real
  `prefers-reduced-motion: reduce` media state. Named honestly by the story under "NOT DONE" and
  already routed to 2.19. **Recorded here because of what they cover:** this route introduces the
  site's widest table (13 columns) and a narrow-layout column reduction whose only reason to exist
  is those widths, so reflow is the unmeasured obligation that would have exercised the new code.
  The blocker was environmental — the browser automation reported a successful resize while the
  window stayed at 1920, and both `window.resizeTo` and a same-origin popup were blocked.
  **Owner:** 2.19, or a manual pass.

---

## Filed by Story 2.17 — comparison mode (2026-08-07)

**CLOSED — the Team B non-hue channel.** Closes the entry filed by 2.10 with **Owner:** *"whichever
of 2.13 / 2.15 / 2.16 / 2.17 lands first"*, routed onward by 2.13 ruling 2 to *"2.16 / 2.17"* and by
2.16's D1 to this story by name — *"the genuine first two-team surface"*. `/compare` is that surface:
`type=players` and `type=teams` paint side A in `--viz-team-a` and side B in `--viz-team-b`, which is
the 1.32:1 (dark) / 1.07:1 (light) pair that makes a second channel mandatory rather than optional.

**THE HATCH SHIPS, AND NOT ONE MEASURED NUMBER WAS RE-DERIVED.** The 2.10 evidence was carried
verbatim and re-verified live in the browser at this story's Task 11.7, in both themes, with the
method validated against the recorded figures BEFORE any new number was trusted:

| mark | dark | light | measured against | matches the filed figure |
|---|---|---|---|---|
| `--viz-team-a` | 13.56 | 4.99 | `--surface-raised` | yes |
| `--viz-team-b` | 10.30 | 5.36 | `--surface-raised` | yes |
| team-a vs team-b | 1.32 | 1.07 | each other | yes |
| hatch stripe (`--ink-primary`) | 1.53 | 3.30 | its own **solid** `--viz-team-b` ground | yes |

The 1.53 dark figure does not trip decision 10(b), in that decision's own words: with the hatch over
a *solid* ground rather than transparent gaps, *"the measured solid figures … govern, and the hatch
only adds texture"*. WCAG 1.4.11's 3:1 floor applies to the mark against its background — 10.30 /
5.36, which passes in both themes — not to a mark's internal texture.

**THE BINDING CONCLUSION IS RESTATED RATHER THAN QUIETLY DROPPED:** the declared dashed-stroke
fallback **cannot work on a filled bar at all**, and `/compare` has no line marks, so that half of
the ruling is untested here by construction rather than by omission. A future story that needs a
line-shaped second channel still has `TEAM_B_DASH_ARRAY`; one that needs a third bar channel must
rule a new mechanism.

**CLOSED — `seriesLabelIndex` returning 0 for both series on an all-equal set.** Closes the entry
whose owner line was *"the first successor story to reuse `DistributionChart`"*. 2.13 did not reuse
it, 2.15 was told not to, 2.16 does not — and `type=matches` renders a two-series home/away
distribution through the shipped `DistributionChart`, so this story is the first. Fixed in
`TacticalCharts.tsx` with the `-1` sentinel plus a co-located test; `SeriesEndLabel`'s existing
`index !== labelIndex` guard was already sentinel-compatible and needed no change.

- **CORRECTION TO THE ORIGINAL ENTRY, APPENDED RATHER THAN EDITED IN PLACE.** The filed citation
  `TacticalCharts.tsx:229-237` had drifted; the function was at `:238-247` at this story's baseline.
- **AND THE RULED REMEDY WAS NARROWER THAN THE SHIPPED ONE, DELIBERATELY.** The ledger's recorded
  fix is "return `-1` when no value beats the first", which is a REGRESSION as written: on `[10, 3,
  2]` nothing beats the first value either, so it would suppress the label on an ordinary series
  whose peak simply sits at index 0. The degenerate case the entry actually describes — and the only
  one where both series collide at the axis origin — is the FLAT series. That is what ships and what
  the test pins.

**RECORDED, NOT CLAIMED — two 2.15 fixes that are live in code and were never filed.**

- **`InvolvementChart`'s hatch IS centred** (`x1 = x2 = HATCH_TILE_PX / 2`), and so is the
  `TacticalCharts` copy. That is 2.15's fix, verified present at this story's baseline and reused
  verbatim by `CompareCharts`. Recorded here because the ledger still reads as though it were open.
- **The recharts vendor duplication is fixed and its entry is already closed above** by the
  `Charts.tsx` barrel. Re-measured by this story before its first edit and after its last, with the
  classifier discriminating on `CartesianAxis` **AND** `Brush` **AND** `redux` together: **one line
  classified VENDOR both times, 359.0 KB → 362.0 KB.** The fourth recharts leaf costs 3 KB because
  the duplication is per `dynamic()` SPECIFIER, not per leaf module. `static-output.test.ts`'s
  comment claiming "exactly two recharts import specifiers … a third would put a third ~300 KB
  chunk" was stale on both halves and is corrected in this story's diff.

### Filed, not fixed

- **`/compare` has no AD-4 route-payload set.** AD-4 enumerates exactly three — Match Bundle,
  profile artifact, and `tournament.json` + `leaderboards.json` combined — and this route is none of
  them. It reaches four artifacts (`tournament.json` as picker corpus AND slug manifest, plus one
  entity family per comparable type), and the per-route allow-list test now pins that set. Measured
  worst case on real-data sizes, `type=matches`: 39,137 + 2 × 14,251 = **67,639 B gzip ≈ 66 KB
  against the 500 KB cap.** The risk is nil; the DOCUMENT gap is real. The adversary review closed
  the same hole for the Hub only (C3). **Owner:** 2.19 or an architecture amendment.

- **`/compare` has no Lighthouse target.** NFR-1 names only the Match Dashboard and the Hub, so this
  route's JS weight is ungoverned by any written rule — which is exactly why the story self-imposed
  the vendor-chunk count as its gate. **Owner:** 2.19.

- **A shared comparison link's preview card is the generic shell's.** `/compare` takes no
  `export const metadata`, ruled rather than omitted: `<title>`/OG stay Spanish after an EN toggle,
  so `en.*` metadata keys would be unreachable by construction — the pattern 2.18's BINDING
  prohibition forbids, and the open ruling 2.18 filed rather than resolved ("either both routes take
  metadata or neither does"). NFR-4 also excludes this route by enumeration, and entity-specific OG
  is architecturally impossible under `output: 'export'` with one shell per query string. **The
  `<title>`-language decision itself is NOT re-filed here — it is 2.12's, owner Juan, one entry and
  one owner.** What is filed is only the consequence. **Owner:** whoever takes 2.18's Decision 2.

- **The `<md` sticky mini-header's `IntersectionObserver` is UNVERIFIED, while the sticky itself is
  verified.** Split deliberately, because they failed differently:
  - **VERIFIED LIVE, in a real 386 px viewport:** `position: sticky`, `top: 56px`, `z-index: 30`,
    zero clipping ancestors, `display: none` at `≥md` / `block` below it — and, decisively, it
    ACTUALLY OFFSETS: `getBoundingClientRect().top === 56` at every scrolled probe. That closes, for
    this header, the class of defect recorded above where twenty-two sticky headers shipped green
    and silently did not stick.
  - **NOT VERIFIED:** that the observer renames the header as the second figure comes on screen. The
    browser automation reported a successful window resize while the window stayed at 1920 (the same
    environmental blocker 2.16 recorded), so the only narrow viewport available was a same-origin
    iframe — and `IntersectionObserver` delivers **zero callbacks** for content inside that iframe in
    this environment. An in-realm observer constructed over the same nodes also fired nothing, so the
    harness is what failed, not necessarily the page. One real defect WAS found and fixed during the
    attempt: the callback decided from the `entries` argument alone, which is only what CHANGED, so a
    scroll delivering one entry could never compare the two figures; it now decides over a persistent
    visibility map. `data-compare-showing` on the mini-header and `data-compare-side` on the figures
    exist to make the next pass cheap. **Owner:** 2.19's accessibility pass, or a manual check.

- **No term on `/compare` is glossary-marked.** UX-DR20's per-term policy table governs marking
  row-by-row and names no row for this route; the mirrored-row labels are also BUILT rather than
  named at the call site (`leaderboardMetricKey`, `hub.standings.columnTitle.*`, `enums.metric.*`),
  so marking them would require a key→`GlossaryTermId` map that exists nowhere in the codebase plus
  roughly nineteen new policy rows. 2.5 decision 8: *"a dotted underline with no popover behind it
  is a broken promise."* A policy row recording this decision is appended to `EXPERIENCE.md`.
  **Owner:** a successor with the terminology mandate.

- **`CompareLineChart` was NOT built, against Task 7.1's literal wording.** Every mark on this route
  is a bar: players plot speed bands, teams plot phase rates, and matches reuse `DistributionChart`.
  Shipping an unmounted chart component would be dead code on the deferred side of the lazy boundary
  — and D4's line-mark channel (`TEAM_B_DASH_ARRAY`) already ships in `MomentumChart` for whoever
  needs it. Recorded so the omission is a decision rather than a discovery.

- **`/compare` mounts no `RowAnchor`, so the two surviving private copies are untouched.** The
  Reuse Inventory asked this story not to add a fourth; it adds none. The two at
  `TournamentHub.tsx` and `PlayerMatchesSection.tsx` remain open under their existing owner.

## Deferred from: code review of 1-19-full-batch-run-batch-report-104-104-acceptance (2026-08-07)

Six items from the three-layer adversarial review of Story 1.19's diff. Each was verified
against the source before filing. **None is a defect Story 1.19 introduced and left unhandled**
— they are pre-existing properties, ruled tradeoffs, or new rulings that exceed a review's remit.
The review's actionable findings live in that story file's §Review Findings and are not
duplicated here.

- **A killed process mid-swap leaves `data/matches/` absent entirely, and nothing restores it.**
  `swap_directory` (`pipeline/precompute/swap.py`) retires the target to a `*.previous.rollback`
  sibling and only then installs the staged copy. A kill inside that window leaves 104 committed
  bundles surviving *only* in a gitignored sibling; no run restores from it, and the `.gitignore`
  entry added by 1.19 makes the survivor invisible to `git status`. Before 1.19 that window did
  not exist for `data/matches/` — the old loop could leave a *partial* namespace but never an
  absent one. **This is the same tradeoff Story 1.18 ruled and shipped** for the wider
  1,296-artifact profile namespace, under the anchor *"Ruled over per-file `.tmp` renames"*, so
  it is not re-litigated by a review of 1.19. **Deferred:** reversing it means re-opening 1.18's
  ruling, and a restore-on-startup path is a new mechanism, not a fix.
  **Owner:** whichever story next revisits the directory-swap mechanism itself.

- **Staging and rollback paths are fixed rather than process-scoped.** `staged_sibling` and
  `rollback_sibling` (`pipeline/precompute/swap.py`) derive from the target name alone, so two
  runs against the same `--data-dir` collide: run B's `clear(staged_dir)` deletes run A's
  in-flight staging, then both swap and one namespace is a mix. `write_canonical`
  (`pipeline/ingest/records.py`) already solves exactly this for its own temp by interpolating
  `os.getpid()`. **Deferred:** concurrent runs against one data directory are not a supported
  mode, and 1.18's shipped mechanism has the identical property, so fixing it here would leave
  the two halves inconsistent. **Owner:** whichever story makes concurrent pipeline runs a
  supported mode, or the one that unifies the profile path onto `swap.py`'s helpers.

- **The corpus-gated tests skip on a clean checkout and their `CI=1` escape hatch is dead code.**
  Story 1.19's rollback, byte-neutrality and phase-ordering proofs (`test_swap.py`,
  `test_orchestrate.py`, and the 104-entry manifest assertion in `test_ingest_batch.py`) all gate
  on `work/spine/` or `work/run-manifest.json`, both under the gitignored `work/`. Each falls
  back to `pytest.fail` *"under `CI=1`"* — but the repository has **no `.github/` directory and
  no CI configuration of any kind**, so that branch never executes anywhere. On a fresh clone the
  evidence base for AC 3's headline claims silently skips, which is the *"a skip is exactly how a
  missing input comes to read as a pass"* rule the same test files invoke as a principle.
  Measured during the review: all 12 `test_swap.py` tests genuinely ran here (0 skipped), because
  this tree's `work/spine/` is populated. **Deferred:** repo-wide and pre-existing — the pattern
  predates 1.19 and closing it means either committing a CI config or re-shaping every corpus
  fixture. **Owner:** whichever story introduces CI, or decides the corpus-gated suite needs a
  checked-in minimal spine.

- **A stale comment in `profiles.py` asserts that `data/index/*.staged` is not gitignored.** The
  `finally` block's comment reads *"`data/index/*.staged` is not gitignored, so a sweeping
  `git add` would commit them"* — false since 1.18's own review added `data/index/*.staged/` and
  `data/index/*.previous.rollback/` to `.gitignore`. It was already false before Story 1.19
  began. **Deferred:** correcting it is an edit to `pipeline/**/*.py`, which changes
  `code_version()` and re-invalidates all 104 staged Extraction Records — the exact trade ruling
  D1.7 names as *"a no-op that re-invalidates all 104 staged records for nothing."*
  **Owner:** whichever story next edits `pipeline/precompute/profiles.py` for a substantive
  reason and is therefore already paying for the re-extract.

- **`PIPELINE RESULT: FAIL` is permanent on the ruled-clean corpus, with no way to read the
  headline as "as designed".** `pipeline/orchestrate.py` computes `worst = max(worst, code)`
  before the consumability check, so the ruled clean-corpus baseline — `ingest.batch` exit 1 for
  the two adjudicated forced-turnover deviations — makes every *correct* end-to-end run print
  `FAIL`. Nothing in the headline distinguishes that from a broken gate. The runner is right to
  refuse to mask a phase's exit 1 (landmine 2: asserting exit 0 *"will make you 'fix' a correctly
  reported source defect"*), so the fix is not to change the code but to give the verdict a
  distinct token, e.g. `FAIL (ruled baseline)`. **Deferred:** that is a new ruling on the
  house-wide exit-code contract's presentation layer, which exceeds a code review's remit — the
  same reasoning 1.17's review used to decline reversing a gate's failure semantics.
  **Owner:** whichever story next rules on the orchestrator's operator-facing output.

- **TWELVE production edits from Story 1.19's code review, deliberately batched so ONE re-extract
  covers all of them.** Ruled by Juan on 2026-08-07 during the review: the fixes are correct and
  none is applied, because every one is an edit to `pipeline/**/*.py` outside `tests/`, which
  changes `code_version()` from the recorded `ad4735a216e2` and invalidates Story 1.19's
  byte-identity evidence — all 104 staged Extraction Records plus every figure in AC 3's
  reproducibility proof. Measured, not assumed: `EXCLUDED_DIRS`
  (`pipeline/ingest/fingerprint.py`) contains `tests`, so test-only fixes were free and *were*
  applied; these were not. This is ruling D1.7's own trade — *"a no-op that re-invalidates all
  104 staged records for nothing"* — applied to the review itself. **Whoever takes these must
  take them together and re-run the five phases plus a fresh byte-identity proof afterwards; the
  full detail and evidence for each sits in Story 1.19's §Review Findings and is not duplicated
  here.** The two exit-code items are the only ones touching a shipped guarantee.
  1. **Post-swap cleanup turns a SUCCESSFUL emission into exit 2** — `clear(backup)` in
     `emit_bundles` and the retired-backup `unlink` in `swap_files` both sit outside the guarded
     block, so an `OSError` during cleanup reports *"nothing was learned"* over a namespace
     already correctly installed. Found independently by all three review layers. Story 1.18
     already shipped the answer with its reasoning, under the anchor *"a failure to remove a
     scratch directory must not turn a successful emission into a failed one"*.
  2. **Cleanup inside the failure handlers can replace the exception it is cleaning up after** —
     four unguarded I/O sites inside `except BaseException:` before `raise`, including both
     rollback loops, where a mid-undo failure discards the original error *and* leaves the tree
     half-swapped.
  3. **The near-miss renderer never re-filters `max_delta == 0`** — the filter lives only in
     `_mirror_self_validation`, so the renderer trusts its input where the mirror carries four
     `isinstance` guards. Production output is correct today; a shipped test asserts a false
     count and must be fixed with it.
  4. **The orchestrator catches only `SystemExit`** — any other exception yields the
     tracebackless death its own comment says the handler exists to prevent, and CPython exits 1
     when the truth is 2. `profiles.py`'s `main` already establishes the repo's pattern.
  5. **`len(gaps)` / `len(orphans)` sit outside the `try`** in `_batch_finding_is_consumable`,
     the one function documented as never reading absence of evidence as evidence.
  6. **`swap.py` bypasses its own shape-agnostic `clear()`** when removing backups, so a backup
     left in the other shape by a killed run kills the next swap before it starts.
  7. **`emit_index` never clears a leftover staging sibling** before writing into it, where
     `emit_bundles` does — `swap.py`'s own docstring states the rule it half-enforces.
  8. **The `.staged` suffix literal now lives in two places** — `profiles.py` still hard-codes it
     rather than importing `staged_sibling`/`STAGED_SUFFIX`, so the lift that was meant to avoid
     a second mechanism reached `_swap_directory` only.
  9. **`bounded_check`'s docstring is missing the `pass-network-top5-pct` exclusion rationale**
     that Story 1.19's Completion Notes claim is there.
  10. **`run_batch`'s docstring is missing Task 4.3's three-way match-id collision note**, which
      that task was marked complete without writing.
  11. **`MANIFEST_VERSION` bump `1` → `2`** — RULED by Juan 2026-08-07. `_entry` gained a
      `near_misses` key while the version stayed put and `format_summary` compensates with a
      defensive read; the version field exists to signal exactly this. Keep the `.get`.
  12. **Drop the `+` from the near-miss delta** — RULED by Juan 2026-08-07. No producer is
      signed; every one feeds an `abs()` or a one-directional shortfall, so the glyph asserts a
      direction the data does not carry. **The batch summary quoted verbatim in Story 1.19's Dev
      Agent Record must be re-rendered in the same change**, or it stops matching the code.
  **Deferred:** applying any one of them costs the full re-extract, so they are worth exactly one
  cycle between them. **Owner:** whichever story next edits `pipeline/**/*.py` for a substantive
  reason and is therefore already paying for the re-extract — Story 2.19 is the natural candidate
  if it touches the pipeline at all, otherwise the first Epic 3 story that does.

- **The orchestrator takes no lock, so two runs can interleave their swap windows.**
  `pipeline/orchestrate.py` runs `precompute.profiles` and `precompute.index` back to back
  against the same `data/index/`, both installing by in-place swap, with no lock file and no
  staleness check. Two orchestrators — or an orchestrator plus a hand-run phase — can interleave
  retire/install windows and leave one namespace from run A beside one from run B. That is
  precisely the cross-namespace inconsistency `emit_profiles`' two-phase swap was built to
  prevent, defeated one level above it. **Deferred:** out of scope for 1.19, which was routed the
  *ordering* problem and not concurrency; and this repo's live concurrency hazard is concurrent
  *editing sessions*, not concurrent pipeline runs. **Owner:** whichever story makes concurrent
  pipeline runs a supported mode.

## Deferred from: code review of 2-17-comparison-mode (2026-08-07)

Seven items triaged as deferred during the code review of Story 2.17. Three adversarial layers
raised 28 findings; after dedup and re-verification against the working tree, 3 went to Juan as
decisions, 16 became patches on the story, 2 were dismissed, and the seven below were judged real
but not actionable in this story.

- **A fourth private `LEADER_GLYPH = "\342\226\262"` copy now ships** (`CompareRows.tsx:52`). D14 and the Reuse
  Inventory both name `StoryStatTiles.tsx:22` as the single home, but three copies already shipped
  before this story (`StoryStatTiles.tsx:22`, `KeyStatisticsSection.tsx:42`,
  `OffersToReceiveSection.tsx:62`) and 2.17 followed the shipped pattern rather than the ruling.
  Consolidating all four is a cross-story refactor touching three other stories' files.
  **Owner:** whichever story next needs a leader mark, or a dedicated cleanup pass.

- **The two-series peak is re-minted inline twice** (`viz/compare-model.ts:418` in `teamChartModel`,
  and the equivalent block in `matchChartModel`) as
  `[...].reduce((best, value) => (value > best ? value : best), 0)`. The Shared-Domain Seam ruled
  *"Build `PhaseRow`-shaped rows, not `CategoryRow`-shaped ones, and the shared domain falls out"*
  over `rowsPeak(rows: PhaseRow[])` (`phases-model.ts:345`), which is present and exported. The
  inline form is functionally identical; the reuse was simply not taken.
  **Owner:** a successor touching `compare-model.ts`'s chart models.

- **`?? 0` defaults sit on displayed values** (`CompareChartsSection.tsx:445, :455, :525, :535,
  :636, :644, :645`), contradicting `compare-model.ts`'s own stated rule that *"`?? 0` would assert
  a real measured zero on a row that has no measurement, which is the same lie as a derived
  number."* Dead today: every value reaching those sites has already passed the model's `finite()`
  guard, so the default can only fire if that guard is removed. Latent, not live.
  **Owner:** whoever next changes the model's entry guards.

- **An artifact returning HTTP 200 with a `null` body falls into the retryable `error` branch**
  (`CompareRegion.tsx:208` `isSideValid`, `:257` the index check). Both read `.schemaVersion` off a
  payload typed non-null at an untyped fetch boundary; a `null` body throws a `TypeError` into
  `.catch`, which shows the retry affordance for a condition retrying cannot fix. The correct state
  is `invalid`. Requires a contract violation to reach.
  **Owner:** a successor hardening the fetch boundary; the same shape exists on the profile routes.

- **An unrecognised `type` param persists in the URL when the index fetch errors.** The cleanup
  effect early-returns on `if (!indexReady)` (`CompareRegion.tsx:438-441`), so `?type=bogus` stays
  in the address bar while the selector silently shows `players`. Harmless in practice: when the
  index has failed the whole route is already in its error state with a retry.
  **Owner:** a successor revisiting the URL cleanup ordering.

- **Metric codes present on one side and absent on the other are dropped silently**
  (`viz/compare-model.ts:176`), and if the two profiles share no codes at all the Statistics
  heading renders over an empty container. The drop itself is deliberate and documented — `?? 0`
  there would assert a measurement that does not exist — but there is no "these rows could not be
  paired" disclosure, and no empty-state panel under the heading. Both artifacts are total today,
  so reaching it needs a truncated emission.
  **Owner:** a successor, or 2.19 if real-data emission ever goes partial.

- **`scroll-padding-top` coverage is narrower than Task 8.4's wording.** The implementation is a
  per-element `max-md:scroll-mt-28` on the two `CompareFigure` wrappers only
  (`CompareChartsSection.tsx:201`); the `#stats` / `#charts` headings and every mirrored row keep
  the global `scroll-padding-top: 4.5rem` (72 px, `globals.css:446`). Judged not a live defect —
  the sticky mini-header exists only inside the charts section and only below `md`, so the other
  anchors never land under it — but the coverage is narrower than the task text reads.
  **Owner:** a successor if the mini-header is ever hoisted above the charts section.

## Filed by the code review of story 2-17-comparison-mode (2026-08-09)

- **Two entities with the SAME DISPLAY NAME still produce byte-identical captions on `/compare`.**
  The route now guarantees `a !== b` three ways (the picker filters each side's pick out of the
  other's corpus, the URL cleanup drops a duplicate `b`, and `idA !== idB` gates `bothListed`), and
  `i18n.test.ts`'s composed-caption inventory records that guarantee. But **distinct ids are not
  distinct names**, and the caption prefix is the NAME: `CompareChartsSection` composes every
  caption, table name and mini-header entry as `${ref.name} — …`. `search-model.ts` records that
  "Emiliano MARTINEZ occurs twice in the real corpus", so two different players on the two sides can
  render two identical `<caption>`s, two identical table names, and a mini-header that cannot say
  which figure is on screen — which also leaves the route's single polite sort announcement unable
  to name the table that moved.
  Not reachable today: the fixture index carries two players with different names, so nothing is
  red. The fix is a design choice this review did not have the standing to make — the disambiguator
  would be the side's `detail` line (team and position, already on `SideRef`) or the entity id, and
  either changes six shipped captions plus the two figure headings.
  **Owner:** Story 2.19, at the real-data swap — that is the first point the collision becomes
  reachable, since the real corpus is where the duplicate names live.

## Disposition of every entry naming Story 2.19 — Story 2.19, 2026-08-25

**This section discharges AC 5 and ruled decision D11.** 66 blocks in this file name Story 2.19
(74 raw mentions). Every one of them has a disposition below: implemented, ruled, re-deferred with a
named successor and a stated reason, or already-closed with the correction appended.

**It is APPENDED, never a rewrite (D12).** No paragraph above this line is edited. Where a
measurement recorded above is now known to be wrong, the correction is stated here and names what it
corrects, which is this repo's house rule since Story 2.9.

**Nothing naming 2.19 is left silently open.** Story 2.19 is the last story in the project, so
"re-deferred" here means routed to a named SUCCESSOR CHANGE-SET rather than to a story that exists.
Where that is the disposition, the trigger that would re-open it is stated too.

---

### A — IMPLEMENTED by 2.19 (32 entries)

| ledger | item | disposition |
|---|---|---|
| L133 | The two `DATA_ROOT` cutover points have no enforcement | **DONE.** Both constants flipped in one change; `data-root-agreement.test.ts` compares the trailing path segments and was proven RED in both directions by actually reverting each constant alone (2 failed / 6 passed each way). |
| L137 | Substring HTML assertions assume escape-free text | **DONE.** Measured: exactly ONE name escapes corpus-wide — `Côte d'Ivoire` → `Côte d&#x27;Ivoire`, on four matches; zero player names. One `escapeForHtml` helper covers the single assertion site; the assertion STYLE is unchanged, per D3. |
| L49 | Zero-external-request audit is a one-time manual grep | **DONE.** `app/scripts/assert-no-external-origins.mjs` runs in the build chain after `copy-data`. Current export: 12,682 text assets, **0 external subresources**. Nine tests feed it the trees it must reject. The design decision that makes it usable is recorded in the script: a naive "any absolute URL" scan reports 27 violations on a clean build, all of them diagnostic strings inside vendor bundles, so it matches FETCHING POSITIONS only and merely counts the rest. |
| L2173 | 104-at-scale Hub verification | **DONE.** Route bijection exact on all three families (104 / 1,248 / 48, 0 missing, 0 extra); 1,407 documents scanned, 1,303 distinct internal hrefs, 16,802 occurrences, **0 dead links**; Lighthouse recorded in the story. |
| L2967 | Accent-insensitivity never exercised in a BROWSER | **DONE.** 10/10 in a real browser on the real corpus, both directions: `Türkiye`/`Turkiye`, `Curaçao`/`Curacao`, `Côte d'Ivoire`/`Cote`, and the reader typing `Núñez`/`Nunez`, `Quiñones`/`Quinones` against a corpus whose player names arrive diacritic-stripped. |
| L3299 | Seven of eight linked `/teams/` slugs 404 on fixtures | **CLOSED — it was a fixture artefact.** All 48 team routes resolve after the flip and every one carries at least one inbound link. |
| L3451, L3768 | Reflow at 320/390 in both themes and locales, 200% zoom, real reduced motion | **DONE, and the ledger's own predicate was part of the finding.** 96 cells measured. At 320 and 390 the DOCUMENT never scrolled sideways even before the fix — the 654 "overflowing" elements the raw predicate reported on `/` were table cells inside `overflow-x-auto` wrappers, which EXPERIENCE.md:119 permits. At **195 px** (a 390 px device at 200% zoom) the document overflowed on ALL EIGHT ROUTES, including `/about`, `/glossary` and `/404`. After R2/D8: every one of the 16 route×locale cells reports a document scrollWidth of exactly 195. |
| L3862 | `/compare`'s `<md` sticky mini-header `IntersectionObserver` is UNVERIFIED | **DONE.** `position: sticky` and **actually stuck at 56 px**; `data-compare-showing` goes 0 → 1 when side A leaves the observer's adjusted root. At 390×844 it correctly does not rename (both figures are inside the root at once, exactly as its own docblock predicts), so the check was re-run at 390×500. |
| L3558 | `assert-schema-version.mjs` walks the working tree | **DONE.** A name-suffix skip rule (`*.staged`, `*.previous.rollback`) at any depth, with three tests: two skip cases and a control proving the same tampered bytes still fail in an ordinary directory. |
| L3640 | Should a unit-test run re-walk the entire real corpus? | **RULED: YES, and the cost is not new.** ~8.5 s of a ~20 s suite over 1,411 artifacts. Kept because the gate is the only thing between a schema drift and a published site, `npm test` is where it can fail in seconds rather than after a 91 s build, and sampling would test something other than what ships. `DATA_DIR` resolves independently of `DATA_ROOT`, so the gate ALWAYS walked the real corpus — the test's name ("passes on the current fixture tree") was wrong before the flip and is corrected. |
| L2545 | `m082-belgium-senegal`'s fourth route, `players`/`goalkeeping` null branches | **DONE, and the premise moved.** Both blocks are POPULATED on 104/104 at real data, so the null branches the entry wanted exercised are not reachable there; the route is covered by the exact bijection and the rendered census records what does render. |
| L2066, L3431 | `i18n.test.ts`'s caption inventory is stale | **DONE, and one quarter of the entry was wrong.** The `viz.pressing.metre*` family was already retired and the counts already read 26/26/27 (Story 2.17's review). The 3→36 board count does NOT break the inventory — it reads the fixture by relative path and is deliberately fixture-pinned (D2). `viz.table.measure` WAS a live orphan and is retired. **`enums.unit.m` must NOT be retired**: it is live on five components and via `leaderboard-format.ts`. The inventory is now 28 (Task 7.1 adds two). |
| L1979, L3412 | `#pressing`'s metre presentation is RETIRED and the surface is owed | **DONE.** `shapeByPhase` is re-presented as two tables, 2 possession states × 6 rows. Story 2.16's `team.shape.*` vocabulary is reused whole; only the two captions are new. |
| L2045 | The involvement TICK model rests on an expired condition | **DONE, resolved differently from the proposal.** Measured: 2,506 of 21,764 real samples carry a non-null `stoppageMinute` and EVERY ONE collides on minute. Resolved by LABELLING the whole clock ("45+2") and deduping on it, not by adopting `momentumTickIndices`' skip rule — that model drops stoppage slots because its axis cannot say "45+2", and this one can. Nothing is dropped and a stride landing in stoppage no longer thins the axis unpredictably. |
| L2079 | `goalkeeping-model.ts` synthesizes a fake `playerId` and mints `" / "` copy | **DONE.** The block is per TEAM (CS-2 decision 18), so the field is now `teamId`; the join moved to `viz.goalkeeping.nameJoin`, resolved at the call site (AD-7). |
| L1213 | `sortRows` is unmemoised; the inactive path copies the array | **SUPERSEDED, and said so rather than silently dropped.** D15 put the `columns` memo back in scope. It was not applied because Task 5.8 removed the thing it optimised: with `SectionContent` deferring prop construction to OPEN sections only, the eleven column arrays a collapsed match route used to build on every render are no longer built at all. A `useMemo` over an array that is never constructed is dead weight. |
| L1877 | No log table sets `rowHeader` | **DONE.** `markRowHeader` picks the first available of player → minute → team. Not a hard-coded flag: the player column is gated by `anyPlayerName`, so a fixed one would leave exactly the matches with least context with no row header at all. |
| L2236 | `#lideres` is a Spanish anchor | **DONE.** `#lideres` → `#leaders`, the last Spanish fragment id in the app. Taken now because it is URL-shaped and nothing links to it yet — the site has not been published. |
| L3732 | `readTeamProfile` is called twice per build | **DONE.** `build-data.ts` caches parsed artifacts by resolved absolute path. 2,496 parses of 1,248 files on `/players/[slug]` at real scale; build wall clock 89–91 s → **78 s**. |
| L2325 | `InvolvementChart` ships the unfixed edge-drawn hatch | **ALREADY CLOSED — verified, not re-implemented.** The hatch already draws at `HATCH_TILE_PX / 2` and its own comment records the fix; `x1={0}` occurs nowhere in the tree. |
| L2929 | DESIGN.md should absorb `accent-cyan` on `surface-overlay` | **DONE.** 9.20:1 dark / 4.68:1 light, absorbed with the note that the light figure leaves only 0.18 over the 4.5 floor. |
| L2945 | EXPERIENCE.md contradicts itself: "full-width" vs "full-screen" sheet | **DONE.** Reconciled to full-width, which is what 2.14 shipped (386 px at `top: 0`, content-driven height). |
| L4089 | Two entities with the same display name produce byte-identical `/compare` captions | **DONE.** Confirmed reachable — `Emiliano MARTINEZ` occurs twice (`…-arg` gk / `…-uru` mf). Six captions, two figure headings AND the sticky mini-header were byte-identical; all now carry the side's `detail` line via `composeSideHeading`. |
| L2910 | axe was never run | **DONE.** 8 routes × {dark, light} × {es, en} with every disclosure open = 32 cells. **Before: 2 rules, 66 nodes. After: 0 and 0.** Both findings were real and both are fixed — see the corrections below. |
| L1410 | `domain-g-zone-sum` broke on 79 of 96 FIXTURE rows | **CLOSED — a fixture defect, as suspected.** Over the emitted corpus: 3,289 per-match rows, worst drift **0.200 m** against a 0.35 m tolerance, **0 failures** — exactly reproducing the pipeline's own published figure through an independent implementation. |
| L1538 | A locale switch re-orders any text-sorted table with no announcement | **DONE.** `DataTable` announces the re-collation on a locale change. Text sorts only: a numeric column collates identically in both locales, so announcing it would be a second false claim. |
| L2185 | Hub tables ship no sticky header | **NO CHANGE, and the check is recorded.** With every disclosure open the route holds 66 tables; the tallest is 190 rows / 7,509 px and its `thead` is `static`. The premise the entry asked about — Hub standings/results tables are short — still holds at 4–16 rows. The 190-row table is the LEADERBOARDS surface, a different owner. |
| L3367 | Two hand-written `/teams/` route literals remain | **DONE, and it was half-done already.** `LeaderboardsSection.tsx` already routed through `teamHref`; only `LeaderboardsRegion.tsx` was left — in the same table whose entity column twenty lines above already used the helper. `prefetch={false}` verified in the BROWSER (it is not serialised into the HTML at all, so grepping proves nothing): zero of the 1,248 player, 48 team or 104 match routes are speculatively fetched. |
| L527, L545 | Mirror the goal furniture at the defending end | **DONE (D16).** Both non-projective steps were real, and the first version had a BUG at one of them: reusing the attacked end's crossing angle drew the mirrored arc straight THROUGH the penalty area. Caught by the test that samples every point of the path. |
| L2890 | The header-search payload question | **RULED: ACCEPT, no contract change.** Re-measured at the cutover: 38,860 B gzip / 409,524 B raw, fetched lazily on first engagement, once per page load, never on load. 7.8% of the 500 KB route budget, paid only by a reader who opens the search; the `entities` slice would save 9 KB for a contract change and a second artifact to keep in bijection. |
| L3849, L3841 | `/compare` has no Lighthouse target and no AD-4 route-payload set | **DONE.** `/compare` has a number: median 88 (88–90) mobile, payload 65.7 KB of the 500 KB cap. The AD-4 amendment is filed as a RECORDED GAP rather than a contract change: `/compare`'s payload set is `tournament.json` plus up to two entity artifacts, bounded by the two per-entity caps that already exist, so it needs no cap of its own. |
| L624 | Five contract-required goalkeeping sub-blocks are null on 208/208 | **VERIFIED, no code owed.** All five gates close and `viz.goalkeeping.gateNote` renders on every sampled match. |

### B — RULINGS taken (6 entries)

| ledger | question | ruling |
|---|---|---|
| L147, L2697, L3227 | `<title>`/OG stay Spanish after an EN toggle | **RULED by Juan 2026-08-25 (D17): ACCEPT ES CANONICAL.** Closed as ACCEPTED on all 104 + 1,248 + 48 + Hub routes — not re-deferred, not WONTFIX-without-reason. A static export has one canonical document language and the UI toggle does not change it. **Recorded consequence:** `<html lang>` DOES track the toggle, so at EN the document is `lang="en"` while the title is Spanish, and a screen reader announces a Spanish title with English phonemes. That is the one audible cost and it follows from the ruling. |
| L2890 | Is 39 KB gzip the right thing to pull on a match route? | **RULED: accept** — see Partition A above. |
| L521 | UX-DR10's two diamonds have no surface; `forced-turnover` vs `possession-regain` are visually identical | **CLOSED AS MOOT.** `defensiveActions` is null on 104/104, so the section renders its empty state on every match and neither half is reachable from shipped data. The UX question is real but has no surface to be wrong on; it rides the successor change-set with the heatmap, under the same AD-14 blocker. |
| L2335 | An abbreviated head that also carries a unit stacks two parentheticals | **RULED by Juan 2026-08-25 (D18b): TAKE IT.** `"Ordenar por Vel. máx. (km/h) (Velocidad máxima)"` → `"… (km/h) — Velocidad máxima"`. WCAG 2.5.3 holds in both branches. |
| L1246 | ~25 per-table announcement identifiers | **RULED by Juan 2026-08-25 (D18a): TAKE IT.** The copy ruling: a table's announcement identifier IS ITS `<caption>` — already its accessible name, already unique site-wide by the caption inventory, and needing no new copy. |
| L962, L2347 | Five Tactical summaries and the leaderboards surface carry no glossary mark | **RULED by Juan 2026-08-25 (D18c): TAKE IT.** Each of the five summaries keeps its ruled sentence VERBATIM as the clause after a colon and gains its term in front. The leaderboards mark goes on the board's heading — not on the metric's sortable column head, which cannot hold a focusable trigger. |

### C — RE-DEFERRED, with a named successor and a stated reason (8 entries)

> **The successor is "the first change-set that reopens `/contract`" unless stated otherwise.** No
> further story exists in this project; naming a phase rather than a number is what D11 permits
> ("the first Epic 3 story that…" is acceptable) and is more honest than a number nobody will read.

| ledger | item | successor | reason |
|---|---|---|---|
| L525 | The heatmap | **The successor change-set that reopens `/contract`** | **The input still does not exist, and the re-open trigger has now FIRED with a negative answer.** The 2.9 filing said "revisit when Story 1.16 emits". 1.16 has emitted: `crosses`, `defensiveActions` and `receiving` are **null on 104/104** in the emitted bundles, and every candidate Domain D family is under an unresolved AD-14 blocker. A heatmap built now would bin nothing. |
| L1553, L1886 | Deep-linking into a closed disclosure (match route) | **The first change-set that reworks match-route navigation** | ~12 files across every match-page section, and it inherits three filed hash-re-entry defects — of which "an unchanged hash never re-fires `hashchange`" is fatal to a link list. Blast radius is the whole match route for navigation that is already honest. **2.19 did NOT mint a new instance of it**: the Hub's new disclosures take `openNonce` and open from the hash. |
| L1465 | Two data columns at 390 px in the Expert table | **A copy/UX pass** | Measured: 55.7 px of data columns, not one full column; the `<md` escape hatch buys 88 px. The lever (ruled abbreviations, EXPERIENCE.md:139) exists but this is copy, not reflow compliance — 320 and 390 both pass with every disclosure open. |
| L1423 | Delete `PendingSectionPanel` | **Any change-set that touches `tactical-sections.ts`** | Dead code with no user impact. It was NOT taken "if free": R1 already edits three assertions in `tactical-sections.test.ts` and removing the panel would have widened that edit for no reader-visible gain. |
| L4071 | `/compare` drops unpaired metric codes silently | **The successor change-set** | Both artifacts are total today — `keyStatistics` populated 104/104, profiles 1,248/48. Reaching it needs a truncated emission. |
| L3388 | AC 1 says "form strings"; the contract ships no `form` field on a team profile | **CLOSED — informational.** 2.16's D3 ruled the Hero strip a projection of `matches[].result`. Recorded so nobody reads AC 1 as naming a missing field. |
| L3715 | The 1.19 roll-up of "everything routed to 2.19" | **CLOSED — index entry, not work.** Every item it names is disposed of elsewhere in this table. |
| L1629 (part) | The **195 px** half of the Expert ToggleGroup | **CLOSED — subsumed.** The 320 px half was D9 and shipped; at 195 px the group now wraps and its items carry `whitespace-normal max-w-full`, so the document no longer overflows there either. |

> **L1504 IS NOT IN THIS TABLE.** D15 pulled it back out of Partition C and its disposition is
> **implemented here** — see Partition A's row for the eagerly-constructed section content.

### D — ALREADY CLOSED, with the corrections this story owes (7 entries)

| ledger | item | correction |
|---|---|---|
| L7, L529, L861 | The whole-layer error boundary, filed FIVE times | **RESOLVED by 2.18** — not re-implemented. The residual (a throw during PROP CONSTRUCTION escaping the per-section boundary) **is now closed too**, by 2.19 Task 5.8: `sectionContent` is called inside `<SectionContent>`, below the boundary. What remains open is only the boundary's lack of a RESET PATH, which stays with the successor. |
| L839, L1685 | A denominator-labelled goalkeeping breakdown can contradict its own rows | **MEASURED CLOSED by 1.16** — `sum(byInterventionType) == attemptsFaced` on 208/208, delta histogram exactly `{0: 208}`. No App fix was owed and none was written. |
| L687, L1939 | `GoalkeeperInvolvementSample.minute` cannot represent the corpus clock | **DISCHARGED by CS-2**, and the residual it named (the TICKS) is now closed by Task 7.2 — see L2045 above. |
| L1234 | Sort collation pinned to `es`; re-measure over the real name corpus | **MEASURED, DECISION 8 STANDS.** 784,612 pairs across players, teams and match labels: **0 disagreements**, identical sorted orders. Unobservable on shipped data because all 1,248 real player names arrive with diacritics already stripped and the only non-ASCII characters in the whole corpus are `ü`, `ô`, `ç` in three team names. No code changed. |
| L3249 | Real-data sizing (2.15 Task 9.4) | **RE-MEASURED at the cutover.** 1,406 pages, `out/` **109.6 MB / 14,102 files** (the 79.3 MB figure predates the 48 team routes), one player HTML 23,619 B — the AD-11 projection holding at +291 B against 2.15's measurement. |
| L537, L557, L570 | `#defensive-actions` collapses to ONE cluster at 320 px at 153-marker density | **⚠️ THE 153-MARKER FIGURE IS WRONG FOR SHIPPED DATA, AND THIS IS THE THIRD TIME IT HAS BEEN CARRIED FORWARD.** It was measured over *staged extraction records*. `events.defensiveActions` is **null on 104/104** in the EMITTED bundles, because four required fields are unfulfillable — so the section renders its whole-section empty state on every match and there are no markers to cluster. Verified in a browser on six matches across the tournament. Any future entry quoting 153 must quote this correction with it. |
| L593 | Every `#defensive-actions` marker announces the same sentence at corpus density | **MOOT, same reason** — there are no markers. Already ruled "accept the degradation" at the 2.9 review; now unreachable as well. |

### Corrections this story owes to entries that are NOT its own

- **`PitchPanel` painted an on-canvas team accent ON THE PITCH.** Found by axe at Task 6.8, not by
  any ledger entry: `--viz-team-a` is the dark olive `#4d7c0f` in the light theme and the pitch is
  the theme-invariant `#0b3d2e`, giving **2.44:1** at 11 px against a 4.5:1 requirement. The
  `-on-pitch` pair exists for exactly this, `globals.css:194` says so, and
  `DefensiveActionsSection` has used it since 2.9 decision 8 — this one call site had missed the
  ruling. Recorded because it is the second time a ruled palette rule has been missed at a new call
  site.
- **Three of this story's own verification probes were wrong before they were right**, and each is
  recorded in the story's Dev Agent Record rather than quietly fixed: the overflow predicate
  over-reported by 654 elements on one route, the focus probe reported eight indicator-less controls
  per route because `:focus-visible` does not match a programmatic focus, and the reduced-motion
  probe reported 30,161 animated elements because it tested `> 0` and so counted the very rule that
  disables motion. **A measurement that has not been falsified once is not yet evidence.**

### AC 2's Lighthouse floor — RULED, and left partially met on purpose

**Story 2.19 D19, ruled by Juan 2026-08-25: ACCEPT AND RECORD THE GAP.** The two gated routes finish
at **88 (86-91)** and **86 (84-94)**, medians of 5, against NFR-1's floor of 90. NFR-1 is therefore
partially met and is SAID to be, here and in the story record, rather than rounded away.

What is not in doubt: AC 2's payload half passes with 4x margin (114.9 KB against 500 KB on the
heaviest route); accessibility reached **100 on all five routes** during this story; CLS is 0.000;
and TBT fell **368 -> 102 ms** and **674 -> 134 ms**.

**The one lever not taken, recorded for whoever picks this up:** pre-rendering the standings shell
into the export so the Hub's LCP element is static rather than fetched. The Hub's LCP element is
`h2#standings`, inside the AD-11 client-fetched region, and the settled region is 4,496 px so the
`min-h-[120vh]` reservation cannot shrink without reintroducing the CLS Task 5.4 removed. That makes
it an **AD-11 exception, not a tuning change** — which is why it was declined in the final story and
why it is filed here rather than left implicit.

### Fingerprint superseded (Story 2.19 R3)

`code_version ad4735a216e2` — quoted throughout the 1.19 entries above — is **superseded by
`1d3a32f1ec55`**. Story 2.19 took all twelve deferred pipeline items as one batch, which is exactly
why 1.19's Decision 1 ruled (b): one re-extract, spent once, by the successor. The emitted `/data` is
**byte-identical across the change** (1,411 of 1,411 artifacts), a second run skips all 104, and the
pipeline suite is 1,782 passed / 4 skipped / 0 failed across all 49 files. Do not read the older
fingerprint as current.

### A correction this story owes to its own measurements

Two of this story's Lighthouse measurement rounds were taken against a server that was **serving
every asset uncompressed** — a rewrite of the measurement harness wrote literal backspace bytes into
its content-negotiation regexes, so the server advertised gzip/brotli and negotiated neither. The
same build measured **76 / 65** against it and **90 / 85** against a compressing one. Any figure in
this file or in a story record that cites a Lighthouse performance score for Story 2.19 should be
read against the harness state named beside it. This is the second time in this story that a number
turned out to be about the method; the first was the reflow predicate that reported 654 overflowing
elements on a route whose document did not overflow at all.

---

## Deferred from: code review of story-2.19 (2026-08-25)

Seven findings from the adversarial code review of `7f28e44..HEAD` that are real but are not this
story's to fix — pre-existing patterns, deliberate rulings, or evidence gaps in the record rather
than defects in the code. The patched findings are checked off in the story's Review Findings
section; these are the ones left open. **No successor story exists** — 2.19 is the final story — so
every entry here is owed to the successor change-set, and that is stated rather than implied.

- **`build-data.ts`'s artifact cache is unbounded, shared and never invalidated** (`app/src/lib/build-data.ts:62`).
  `readJson` now hands the *same* parsed object to every caller for the life of the worker process.
  Three consequences, all latent today: 18 MB of `data/matches` plus 11 MB of player profiles is
  retained rather than collected; any future consumer that sorts or mutates in place leaks across
  routes, and the invariant that made in-place work safe was removed without an `Object.freeze` or a
  documented ban; and in `next dev` the module outlives the request, so an edited artifact is never
  re-read. Verified no current consumer mutates. **Successor: the first change-set that adds a
  build-time reader, or any move to a long-lived dev process.**

- **The locale-change sort announcement fires from every sorted table into one live region**
  (`app/src/components/DataTable.tsx:442`). The effect has no dependency array, and `SortAnnouncer`
  renders exactly one polite region with last-write-wins semantics — so a reader who has sorted more
  than one table and then toggles ES/EN hears a single sentence naming an arbitrary one. Bounded in
  practice because the effect returns early on `sortState === null`, which is every table the reader
  has not actively sorted. **Successor: whoever next owns `DataTable`'s announcement layer.**

- **The Hub's `min-h-[120vh]` reservation is justified by a measurement this story invalidated**
  (`app/src/components/TournamentHubRegion.tsx:182`). The rationale at `:153-172` cites a settled
  region of 14,990 px over 30 tables; Task 5.7 then moved every one of those tables behind a
  disclosure, so the settled region is now headings, counts and collapsed controls. The comment's own
  warning — "over-reserving shifts content UP just as badly as under-reserving shifts it down" — is
  the failure mode the change makes newly plausible. Separately, the reservation exists only on the
  `loading` branch, so the `error` and `invalid` exits collapse ~120vh to a ~120 px panel and shift
  everything below upward. Not acted on because CLS measures **0.000** on the shipped path.
  **Successor: whoever re-tunes the Hub's above-the-fold reservation.**

- **`sideIdentity` still produces byte-identical `/compare` captions when both sides' `detail` is
  null** (`app/src/components/CompareChartsSection.tsx:154`). A23's fix disambiguates by the side's
  `detail` line, which is `string | null`; `composeSideHeading` returns the bare name for `null`, so
  the six duplicate captions and two duplicate figure headings return in full on that branch. The
  comment acknowledges the case ("nothing is claimed that is not known") but does not fall back to
  the distinct `ref.id` or the A/B side label. No null-detail name collision exists in the 1,248-name
  corpus, which is why this is a filing and not a patch. **Successor: whoever next touches the
  compare caption composition.**

- **The caption-uniqueness inventory covers 3 of 36 Hub boards** (`app/src/lib/i18n.test.ts:1910`).
  `hubLeaderboardCaptions` derives from `LEADERBOARD_FIXTURE.boards.length`, and the totals at
  `:1794/:1802/:1811/:1821` are `29 + hub.length` with `hub.length === 3`. The property asserted —
  that no two shipped table captions collide — is a claim about the shipped site, exercised on a
  twelfth of it. Left alone deliberately: **D2 rules that fixture-pinned unit tests stay
  fixture-pinned**, and the real artifact was checked by hand at review time (`metricCode+scope` is
  unique across all 36). Note `completedLineBreaks` and `lineBreaksCompleted` already share the ES
  label "Rupturas de líneas completadas" and are separated only by `scope`. **Successor: whoever
  revisits D2's fixture-pinning rule.**

- **`min-[19rem]` media queries resolve against the browser's default font size, not the root
  element** (`app/src/components/StoryStatTiles.tsx:136`, `app/src/components/CompareRows.tsx:184,261`).
  `rem` in a media query is evaluated against the initial font size, so a reader whose browser default
  is 24 px gets a 456 px breakpoint and sees the Hero stat tiles and every compare stat row stack into
  one column on a 390 px phone at 100% zoom. That population — low-vision readers who raise the
  default font — is exactly who WCAG 1.4.10 is for, and the record's claim that "the two-column
  arrival state every shipped width has today is unchanged" does not hold for them. Not patched
  because the degradation is toward single-column, which is the safe direction. **Successor: whoever
  next audits the reflow breakpoints; the fix is `em` or a `px` literal in the query.**

- **D15's before/after screenshot declaration for Task 5.7 was never produced** (story:1175-1193).
  D15 requires the Hub restructuring be declared "with before/after screenshots at 390 px and 1920 px,
  both locales" against Story 2.12's ruled arrival state. What the record carries is one DOM/table/CLS
  metrics table at **412 px only** — no screenshots, no 1920 px column, no locale dimension. This is a
  gap in the evidence, not in the code: the restructuring itself is present and correct. **Successor:
  nobody, unless Juan wants the declaration completed retroactively.**

### One defect Story 2.19 introduced, declared in a comment and filed nowhere

- **A wrapped `SiteHeader` out-grows `scroll-padding-top`, so deep-linked headings land under it at
  200% zoom** (`app/src/components/SiteHeader.tsx:89-93`, `app/src/app/globals.css:446`). R2/D8's
  header fix added `flex-wrap` + `min-h-14` — the right trade, and it is what took the universal
  237 px reflow floor down to 195. But at a wrapped width the sticky header is **~112 px** while
  `scroll-padding-top: 4.5rem` still reserves **72**, so an anchored heading scrolls to roughly
  40 px too high and sits behind the header.

  The code says so itself — "KNOWN AND ACCEPTED … recorded rather than left to be re-found" — and
  that sentence is the entire record: it was never filed here, so "re-found" is exactly what would
  have happened. It is filed now (2.19 code review). Two properties make it worth an entry rather
  than a shrug: it is a **regression this story introduced**, and it lands at **200% zoom**, the
  precise condition AC 3 tests. It also touches UX-DR18's deep links, which are the whole reason
  `scroll-padding-top` exists.

  Not patched in review because the fix is a judgement call, not a correction: `scroll-padding-top`
  would have to become responsive (a `7rem` at the wrapped breakpoint, or a `calc()` off a header
  height custom property that nothing currently publishes), and picking between those is a design
  decision about the header's contract, not a defect fix. **Successor: whoever next owns
  `SiteHeader` or `globals.css`.**

### Two blocks this project never dispositioned

Filed by the code review, because AC 5 says no entry naming 2.19 is left silently open and these two
are. Both name **Story 2.19** as owner and neither appears in the disposition section above, nor in
the story's own Partition A-D tables — so the "66 blocks" partition was short by two from story
creation, and nothing downstream noticed.

- **L183** — the original 195 CSS px reflow filing: "decide there whether the product commits to
  reflow below 320 CSS px". *Substantively this WAS answered* — R2/D8 ruled yes and Task 6.2 shipped
  the three-surface fix — but the block itself carries no disposition line, so a reader walking the
  ledger finds it open.
- **L211** — "Task 10.2's 200%-zoom clause fails at 195 CSS px, but the subtask is checked `[x]`…
  **Annotate the checkbox** rather than re-patch the condition." The instruction names Story 2.5's
  Task 10.2 checkbox and is not carried out anywhere in the diff. This is the one with residual work.

## Filed by the SEO / locale ruling — sprint-change-proposal-2026-08-26

- **D20 RULED (Juan, 2026-08-26): ES CANONICAL FOR `<title>`/OG STANDS. D17 is upheld, not reopened.**
  Locale-varying share previews are not implementable on a static export: crawlers have no user, no
  geolocation, no session and no JavaScript, and one URL yields exactly one document. **Per-locale
  URLs (`/en/` + `/es/` with `hreflang`) are DEFERRED AGAINST EVIDENCE, not WONTFIX** — the standard
  answer, refused on measurement rather than on effort. The measured prize is ~1–2 words per preview:
  `app.siteName` is "WC Stats" in both dictionaries, and team names, player names, scores, records
  and venues are proper nouns and numerals, so on 1,400 of 1,406 routes the title is ALREADY
  locale-neutral and the whole translatable delta is a closed set of ~8 stage and ~4 position enum
  labels. The price is ~1,406 additional routes, every internal link, the route manifest, the
  route-bijection tests, and the `t()`-at-`DEFAULT_LOCALE` server model all 40 shipped stories are
  built on. **Re-open trigger:** Google Search Console shows either (a) material impression volume on
  English-language queries or (b) language-targeting confusion on the ES-canonical routes — no
  earlier than **2026-11-24** (90 days of collected data). **The `sitemap.xml` shipped in Epic 3 is
  the instrument that makes this trigger measurable; without it the deferral would be indefinite by
  construction.** L147, L2697 and L3227 stay CLOSED-ACCEPTED per D17 and are not re-filed.

- **D20-b RULED: the AR-11 `og:image` ban is RETIRED as an over-read.** AR-11 (`epics.md:92`,
  `ARCHITECTURE-SPINE.md:110`) scopes "zero external requests" to fonts and third-party origins; a
  **same-origin** `og:image` is not a request the page makes at all. Confirmed mechanically rather
  than textually: `app/scripts/assert-no-external-origins.mjs` enumerates `FETCHING_POSITIONS`
  explicitly and `<meta content>` is deliberately absent, because the gate "matches FETCHING
  POSITIONS only: the attributes and call sites that actually cause a request". Verified on a fixture
  — `og:image` and `twitter:card` pass clean. AR-11 and AD-11 amended 2026-08-26. **The two pinning
  assertions must be REPLACED, never merely deleted** (`app/src/app/players/static-output.test.ts:125-126`,
  `app/src/app/teams/static-output.test.ts:139-140`): the new assertion is that `og:image` is present
  AND same-origin. Deleting them would leave the same-origin property unasserted, and the build gate
  cannot catch an off-origin `og:image` — correctly, since `<meta content>` is not a fetching
  position. **That test is the only thing holding the line.** Four source comments corrected
  (`matches/[slug]/page.tsx:49`, `page.tsx:74`, `players/[slug]/page.tsx:53-55`,
  `teams/[slug]/page.tsx:64-66`). *(The Epic 2 retrospective said three tests; the count is two.)*

- **BLOCKER FOUND, and it contradicts the retrospective: `assert-no-external-origins.mjs` FAILS the
  build on the site's OWN absolute URLs.** Retro §6.3 lists `metadataBase`, absolute canonical URLs,
  `sitemap.xml`, `robots.txt`, the Twitter card and `og:image` as "available without any ruling".
  They are not. The gate treats `<link href>` as a fetching position and matches it against
  `FETCH_HOST`, which has **no concept of the site's own origin** — `ALLOWED` holds exactly `w3.org`
  and `schema.org`. Reproduced 2026-08-26 by running the shipped script against a fixture:
  `<link rel="canonical" href="https://mundial-stats.juancr.dev/...">` and
  `<link rel="alternate" hreflang=…>` both reported as EXTERNAL SUBRESOURCES, **exit 1** — while
  `og:image` passed. The gate has it backwards: it red-builds on a navigation hint that fetches
  nothing, and waves through the one tag that genuinely causes a third party to fetch an asset.
  **Consequence:** the first commit adding canonical URLs fails the Netlify chain on all ~1,406 pages
  with an error naming AR-11 and NFR-9. **Owner: Epic 3 story 3-1, sequenced FIRST as a hard
  prerequisite.** Two conditions on the fix: a NEGATIVE test (an off-origin `<link rel="stylesheet">`
  and an off-origin `og:image` must still fail — a gate that stopped failing has proved nothing, the
  argument this file's own header makes twice), and `SITE_ORIGIN` defined in exactly ONE place shared
  with `metadataBase`, because two copies drift silently in the direction that matters.
  **CLOSED 2026-08-26 by story 3-1 (`432dc29`), with both conditions met and one correction applied
  at code review.** The gate now reads `SITE_ORIGIN` from its single definition
  (`app/src/lib/site-origin.ts`) and treats `rel="canonical"`/`rel="alternate"` as navigation hints
  under a deny-by-default rel policy; the negative test exists and holds (an off-origin stylesheet
  still fails while an off-origin `og:image` is only reported). Code review then found the rewrite
  had opened THREE false negatives of its own — a full-value `^FETCH_HOST$` match that dropped any
  href containing a space, `(`, `)` or backslash, and `\b`-anchored attribute readers that
  `data-href`/`data-rel` could spoof — plus a self-origin allowance wide enough to pass a
  self-origin tracker script and `fetch()`. All four are fixed and pinned by six parity cases; see
  the story's Review Findings section.

- **A SILENT i18n GATE HOLE, to be closed BEFORE the story that would fall into it.**
  `app/eslint.config.mjs:160`'s metadata selector gates
  `Property[key.name=/^(title|description|default|template|absolute)$/]`. **`alt` and `siteName` are
  not in it.** An `og:image` card carries `alt` text and `openGraph.siteName` is a metadata string, so
  both would ship as bare Spanish literals **with the build green** — the "tests that passed for the
  wrong reason" class the Epic 2 retrospective logged four instances of (§3.3). Add both keys to the
  metadata-object selector. Note `alt` already appears in the JSX-attribute regexes; this is a
  different AST path. **Owner: Epic 3 story 3-1.**
  **CLOSED 2026-08-26 by story 3-1 (`432dc29`).** Both keys are in the metadata selector, along with
  a quoted/computed-key arm. Code review corrected that arm — as first shipped it reported at the
  KEY, making `{ "siteName": t("app.siteName") }` a build error on correct code — and added six
  permanent cases to `app/src/lib/eslint-gate.test.ts`, which story 3-1 had left with none.

- **`bootstrap.ts` has no `navigator.language`, and every first-time visitor on Earth is served
  Spanish.** `resolveLocale(stored)` (`app/src/lib/bootstrap.ts:36-41`) is persisted-value-or-`es`,
  in the pure function and in the checked-in pre-paint ES5 literal alike. This is the actual defect
  behind the share-preview ask: the preview is one line of text, the landing page is the whole
  product, and unlike the crawler the recipient's browser HAS `navigator.language`. **Owner: Epic 3
  story 3-5** (independent of 3-1, and the highest user value in the epic). Four constraints, each a
  defect if missed: (1) BOTH the pure function and the script literal, with `bootstrap.test.ts`'s
  cross-check matrix gaining a `navigator.language` dimension; (2) `i18n-provider.tsx`'s mount effect
  must change too — it currently does `if (stored === null) return;`, so detection in the script but
  not the provider would re-render Spanish strings under an `<html lang="en">` the script had already
  set; (3) a DETECTED locale is NEVER persisted — only an explicit toggle writes `wcstats.locale`, or
  a guess becomes indistinguishable from a choice and outlives a change of browser language; (4) only
  the primary subtag is read, and anything not `en` falls to canonical `es` — a French reader gets the
  canonical, not a guess.

- **ACCEPTED CONSEQUENCE of D20 + first-visit detection, recorded rather than discovered later.**
  Googlebot renders JavaScript with `navigator.language` typically `en-US`, so it will see the
  pre-paint script flip `<html lang>` to `en` and swap the body strings while `<title>`/OG — emitted
  by `generateMetadata` at build and never touched by the script — stay Spanish. That is a
  **mixed-language rendered document**, the exact failure mode Story 2.19 Task 9.3 set out to
  disprove, reappearing at index time. **Accepted:** it is already the shipped behaviour whenever a
  reader toggles to EN (detection only makes it automatic); Google's initial non-rendered fetch sees
  `lang="es"` plus the new explicit `<link rel="canonical">`; and if it does cause harm, that harm
  **IS** re-open trigger (b) above. The failure mode and the instrument that would detect it are the
  same mechanism.

- **NOT FIRED by this ruling: L525 (the heatmap) and L4071 (`/compare` drops unpaired metric codes).**
  Both name a reopened `/contract` or per-locale URLs as their trigger, and the retrospective (§6.1)
  listed them as conditional on the SEO ruling taking option 2. **D20 takes neither.** Both stay
  deferred, unchanged, with their triggers intact.

- status: **DONE — closed by story 3.10 (`3-10-navigation-menu.md`), 2026-08-26.** All seven consumers now derive from `--spacing-header-h-*`: `globals.css`'s `scroll-padding-top` is `calc(var(--header-h) + var(--spacing-scroll-clearance))`; `CompareChartsSection`'s three offsets are `top-[var(--header-h)]`, a token-derived `scroll-mt`, and a `rootMargin` READ from `getComputedStyle` rather than written; the four prose-only files (`ExpertLayer.tsx`, `HubTable.tsx`, `LeaderboardsSection.tsx`, `TournamentHub.tsx`) reason from a sentence that is TRUE AGAIN at every width, though their comments still name the old `4.5rem` constant — see the follow-up entry below. VERIFIED BY MEASUREMENT, headless Chromium against the built export: an anchored heading (`#key-stats`) clears the bar by **16 px at 320/390/1280 and 17 px at 195**, in both locales, where it was **−46 px (hidden)** before; `/compare`'s mini-header resolves `top` to the bar exactly (gap +0.2 px) and is fully visible at 195/320/390 in both locales, closing the "entirely behind the site header" defect this entry names. **WCAG 2.4.11 evaluated**, as the scope_correction demanded: the `#main-content` skip-link target lands at the header's bottom edge at every matrix width, never behind it. **THE PROPOSED PER-LOCALE AXIS WAS NOT TAKEN, and the reason is a measurement, not a preference** — see the "locale-dependent threshold" entries below, which this closes too.
- source_spec: `spec-sign-the-project.md`
  summary: The site header is no longer 56 px, and AT LEAST SEVEN places still encode that it is — `globals.css`'s `scroll-padding-top: 4.5rem` (which is also what makes the SKIP LINK work), `CompareChartsSection`'s `sticky top-14`, `max-md:scroll-mt-28` and `-104px` rootMargin, and prose reasoning in `ExpertLayer.tsx`, `HubTable.tsx`, `LeaderboardsSection.tsx` and `TournamentHub.tsx` — so `/compare`'s ruled mini-header is invisible on small phones, and anchored headings AND the skip-link target land behind a wrapped bar.
  scope_correction: The 2026-08-26 code review of this spec re-counted the consumers. This entry originally said THREE and named only `globals.css` and `CompareChartsSection`; the deferral was ruled on that picture. Four further files each justify plain fragment navigation with NO scroll handling of their own by citing "`scroll-padding-top: 4.5rem` already clears the sticky header" (`ExpertLayer.tsx:984`, `HubTable.tsx:43`, `LeaderboardsSection.tsx:85`, `TournamentHub.tsx:908`) — false below the wrap threshold. `globals.css`'s own comment says the property "fixes the #main-content skip link", so on any phone <=341 px (es) / <=337 px (en) activating "Saltar al contenido" now lands the main heading 46 px BEHIND the header: the site's accessibility-floor bypass is degraded, not just an anchor. WCAG 2.4.11 (Focus Not Obscured) is evaluated NOWHERE in the caption change, though `RowAnchor.tsx:45` and `ExpertLayer.tsx:190` both cite it as a live constraint and a sticky bar growing 57 -> 118 px is its canonical failure. Juan re-confirmed the deferral on 2026-08-26 with this wider scope in hand: the fix stays with story 3-10, which owns `globals.css`, `CompareChartsSection.tsx` and `SiteHeader.tsx` together. WHOEVER TAKES IT VERIFIES ALL SEVEN CONSUMERS PLUS THE SKIP LINK, and evaluates 2.4.11 — not the two this entry originally named.
  evidence: MEASURED, not inferred (browser, served export, iframe at true layout widths). The authorship caption took the header from 57 px to 62 px one-row, and to 118 px where the row wraps (es at <=341 px, en at <=337 px; captions are 127 vs 122 px wide). `CompareChartsSection`'s mini-header is `top:56px`, 54 px tall, `z-30` under the header's `z-40` -- so at 320 px, 56+54=110 < 118 and it is ENTIRELY behind the site header, on the `<md` widths it is the ruled D13/UX-DR17 affordance for. At 390 px it loses 6 px, which eats its `py-2` padding rather than text. `scroll-mt-28` (112 px) was derived as "56 header + 48 mini" and now needs 116 at one row and 172 wrapped; the `-104px` rootMargin has the same provenance. Separately `globals.css` states the contract in its own comment -- "4.5rem = the header's own 3.5rem (h-14) + 1rem of breathing room ... change h-14 and this must follow" -- and at a wrapped 118 px bar an anchored heading lands 46 px BEHIND it, hidden rather than tight, on every route with an anchor. WCAG 1.4.10 is unaffected: document overflow measured 0 of 96 cells (320/390/195 x dark/light x es/en x 8 routes). PROPOSED FIX: one `--header-h` custom property, set per breakpoint AND per locale (the existing `html.locale-es` / `html.locale-en` classes carry the locale, and the two thresholds differ by 4 px), consumed by `scroll-padding-top` and by `/compare`'s three offsets, with the rootMargin read from `getComputedStyle` rather than hardcoded. Deliberately NOT taken in the caption's change: it is a shared-contract edit that re-tunes anchor landing on all 8 routes and needs its own verification pass.

## Deferred from: code review of spec-sign-the-project (2026-08-26)

- source_spec: `spec-sign-the-project.md`
  summary: WITHDRAWN, and replaced by the finding below it. This entry claimed that flipping ES|EN at 338-341 px reflows the header 62 <-> 118 px live. Its premise was the spec's per-locale thresholds, and those are now disputed -- see below.
  evidence: Written from the spec's own numbers (`es` <=341, `en` <=337) rather than from a measurement, then invalidated within the hour by commit d3c103c (story 3-8), which measured in HEADLESS CHROMIUM against the built export and found the es bar "still ONE ROW at 341 px", wrapping at <=337 -- i.e. the SAME threshold as en, and no locale-dependent band for a toggle to sit inside. Keeping the entry, struck through rather than deleted, because the reasoning is still correct IF the thresholds ever do differ: the locale toggle is client-side (`LocaleProvider.setLocale`), so any per-locale threshold difference becomes a live reflow rather than a page-load difference. Whoever takes `--header-h` should re-derive this from their own measurement, not from either number here.

- source_spec: `spec-sign-the-project.md`
  summary: The "locale-dependent wrap threshold" is asserted in four places as a load-bearing, deliberately non-collapsible fact -- and an independent measurement contradicts it. One of the two numbers is wrong and nobody has reconciled them.
  evidence: RAISED BY THE 2026-08-26 CODE REVIEW. spec-sign-the-project states "THE THRESHOLD IS LOCALE-DEPENDENT and the two differ, because `Por` is wider than `By`: es wraps at <=341, en at <=337", measured by "a 1 px sweep per locale" in an iframe; `SiteHeader.tsx`, `reflow-guards.test.ts` and `globals.css` each repeat it, and SiteHeader's comment instructs "Do not collapse these to one number". Commit d3c103c (story 3-8, same day) measured es in headless Chromium against the served export and found it ONE ROW at 341 px, wrapping at <=337 -- collapsing to exactly one number. The methods differ in a way that matters: the iframe route already produced one wrong figure on this very property (the spec records an earlier "354" that was an artifact of a 15 px iframe scrollbar narrowing the layout viewport), and the headless run has no such surface. That makes the headless figure the more credible of the two, but it measured only es and neither has been reproduced. CONSEQUENCE IF 337/337 IS RIGHT: the `--header-h` fix does NOT need to be per-locale, which is the one piece of complexity the proposed fix above carries specifically for this; `SiteHeader.tsx`'s "the 96-cell run caught /404 in en sitting one row while es sat two at the same width" needs re-examining, since that observation is the only direct evidence for a difference. RESOLVE BY MEASURING, before `--header-h` is designed around a per-locale property that may not exist.

- source_spec: `spec-sign-the-project.md`
  summary: Nothing enforces the spec's "Never ... any third surface" boundary for `chrome.signature`. A future addition to `<title>`, OG metadata or the `/about` body would pass every gate this change introduced.
  evidence: `static-output.test.ts` counts occurrences only WITHIN the `<header>` and `<footer>` slices it extracts, and `SiteSignature.test.tsx` renders only those two components. Neither asserts absence anywhere else in the document. The boundary is stated in the spec's Boundaries -> Never (spec:36) and guarded nowhere. Cheap fix if wanted: one document-level count assertion pinning total occurrences to exactly 2.

- source_spec: `spec-sign-the-project.md`
  summary: `CompareChartsSection.tsx:239` calls its sticky mini-header "~48 px" while the ledger entry above measured it at 54 px, and `scroll-mt-28` / the -104px rootMargin were both derived from the 48 figure.
  evidence: Pre-existing inconsistency, surfaced by this review rather than introduced by the caption. It matters because the `--header-h` fix will re-derive those two offsets, and re-deriving them from the wrong mini-header height would leave them wrong by 6 px in the new arrangement. Re-measure the mini-header as part of that work rather than trusting either number.

## Closed by Story 3.8 — match-route deep-link plumbing (2026-08-26)

**APPENDED, not a rewrite (D12).** No paragraph above this line is edited, including L1553's and
L1886's own entries — they stay as written so the record of what was believed on 2026-08-05 survives
next to what turned out to be true.

- **L1553 is CLOSED — and TWO of its four blockers had already been resolved before this story
  started, including the one it called *fatal to a link list*.** The entry (2026-08-05) ruled the six
  Expert log links "honest anchors" because opening a disclosure from a fragment was ~12 files of
  invention. Re-measured against the tree at `f07116b`: (1) `ViewDataDisclosure`'s `open` was no
  longer a private `useState` with no prop — **Story 2.19 shipped `openNonce`**
  (`ViewDataDisclosure.tsx:31`), adjusted during render; (2) *"an unchanged hash never re-fires
  `hashchange`… fatal to a link list"* — **Story 2.19 also shipped the fix**, a capture-phase
  `document` `click` listener beside `hashchange` (`TournamentHub.tsx:182-215`), working over 21 Hub
  sections. Only the other two were still true: `PitchPanel` forwarded exactly two props, and
  `sectionIdFromHash` was whole-string equality. **The blocker list was therefore STALE**, and 2.19
  had recorded at the time that it was *"not allowed to MINT a new instance"* of this defect while
  re-deferring the old one — that restraint is precisely what made this story small. What shipped was
  a **port of a working Hub mechanism**, not the invention the entry projected: the hook moved whole
  to `app/src/lib/use-anchor-nonce.ts` and `TournamentHub.tsx`'s diff is one import line.

- **L1886 is CLOSED.** `#shot-maps` no longer holds two links. `shot-maps-shots` and
  `shot-maps-crosses` are distinct resolvable fragments in the frozen registry
  (`app/src/lib/match-anchors.ts`), each pinned by its own test case — one in
  `match-anchors.test.ts` asserting they resolve to *different* panels on the *same* section, and one
  in `MatchDeepLink.test.tsx` asserting each opens its own table while the sibling stays shut. The
  `i18n.test.ts` href pin was **strengthened rather than deleted**: it asserted `SECTION_IDS`
  membership, which both colliding hrefs PASSED; it now asserts the fragment resolves *and* names a
  panel, and a second case asserts all six panels are distinct. That is the assertion that would have
  caught L1886, and it was driven RED before it was believed.

- **THE RESIDUAL, STATED PLAINLY — the closure of (a) does NOT close (b) or (c).** Of the three
  hash-re-entry paths filed at `deferred-work.md:215`:
  - **(a) IS CLOSED HERE.** `TacticalLayer`'s `hashchange`-only subscription is deleted, not layered,
    and section expansion is now driven from the same `useAnchorHit` reading that drives panel
    opening — so a reader who collapses a section and re-clicks its Expert link gets it back.
  - **(b) is NOT closed.** A post-retry remount still re-consumes the still-present hash with no
    record that it was already honoured. It is arguably *slightly* more reachable now, since a
    re-consumed hash now opens a table as well as scrolling.
  - **(c) is NOT closed.** Navigating backward out of a section still bumps the focus nonce, so Back
    still pulls the reader into the section they were leaving.
  Both want the one consumed-hash / popstate-direction policy their original entry names, and neither
  has an owner. **Successor trigger: the next story that touches match-route history or focus
  restoration.** Do not read "the deep links work now" as covering them.

- **`sectionIdFromHash`'s silent null is now dev-loud.** An addressed-but-unresolvable fragment
  (`#shot-maps-log` — a real section, a panel that does not exist) reports once via `console.error` in
  dev/test and stays silent in production. `console.error` and **not** `throw`, deliberately: `i18n.ts`
  throws because an unresolvable KEY is only reachable from a code defect, whereas a URL fragment is
  READER INPUT, and a hand-typed `#shot-map` must not take the page down inside
  `TacticalErrorBoundary`. `#main-content` and `#expert` name no section and stay silent at every
  environment — `ExpertLayer.tsx` records that their null is by design, and a blanket warn would fire
  on both on every match page load.

- **OBSERVED AND NOT FIXED: the `--header-h` interaction (this story's D9).** The entry immediately
  above this section — story 3.6's caption taking the header from 57 px to 62 px, and to 118 px where
  the row wraps at ≤341 px es / ≤337 px en, against an unchanged `scroll-padding-top: 4.5rem` (72 px)
  — applies to every fragment this story adds, and the finer panel anchors make anchored landing more
  frequent, not less. **Deliberately not taken here**: that entry names its own fix (one `--header-h`
  custom property consumed by `scroll-padding-top` and `/compare`'s three offsets) and its own reason
  for deferral (a shared-contract edit re-tuning anchor landing on all 8 routes). The two entries are
  to be read together, and this story's browser verification was done at ≥390 px for that reason.
  **RE-MEASURED 2026-08-26 in headless Chromium against the built export, and the entry's es threshold
  is a few px off:** in es the bar is still ONE ROW at 341 px (62 px) and wraps at **≤337 px**
  (118 px) — the entry says ≤341 px es / ≤337 px en. Where it does wrap the predicted overlap is
  exact: at 337 px the anchored `<h3>` lands at 72 px, i.e. **46 px behind** the 118 px bar, with
  `scroll-padding-top` a constant 72 px and document overflow false at every width tested
  (320/337/341/360/390). Correcting the threshold does not change the fix or its owner.

- **NOT A DEFECT, RECORDED SO IT IS NOT "FIXED" LATER: two of the six links land on a NAMED ABSENCE
  on the shipped corpus.** Measured 2026-08-26 across `data/matches/` (the 104 bundles
  `build-data.ts:28` reads) versus `data/fixtures/matches/m001`: `events.crosses` and
  `events.defensiveActions` are **null on 104/104 real matches** and populated on the fixture, and
  `passNetworkNodes` is null on 104/104 and populated on the fixture. So `#shot-maps-crosses` lands on
  *"Sin datos de Mapa de centros para este partido."* and `#defensive-actions-table` lands on that
  section's whole-section empty state. **That is ruled FR-22 behaviour.** The anchor was made to land
  ON the absence (the empty panel carries the id in that branch) rather than at the top of the
  section: a link that lands on a named absence is honest, one that lands nowhere is not.
  **Consequence for anyone changing `PassNetworksSection`:** its matrix-only branch is what a real
  reader meets and its `PitchPanel` branch is what the fixture-backed tests meet. Both carry the same
  `pass-networks-matrix` nonce. Wiring one and not the other passes every test and ships broken, or
  the inverse.

- **NOT UPDATED: Story 2.19's Partition C disposition row for `L1553, L1886`.** That table is 2.19's
  appended artifact and stays as written; this section names it and records that its successor trigger
  fired.

- source_spec: `3-5-first-visit-locale-detection.md`
  summary: `app/src/components/MatchDeepLink.test.tsx` mounts a bare `<LocaleProvider>` and asserts Spanish strings, so story 3.5's first-visit detection turns 3 of its 7 tests red. It needs the same explicit `navigator.language` pin the three other render suites now carry.
  evidence: MEASURED, not predicted. `npx vitest run src/components/MatchDeepLink.test.tsx` against the shipped detection gives `3 failed | 4 passed`, failing on Spanish accessible-name queries such as `/ocultar los datos/i`. Cause: the file renders `<LocaleProvider>` at `:77` with empty `localStorage` and no `navigator.language` pin, and jsdom's default is `"en-US"` — so with detection live its locale is decided by an ambient default instead of by the test (the A2 coincidence-green class, arriving from the other direction). Story 3.5's Task 7.5 grep expected SIX `LocaleProvider` renderers; this is a SEVENTH, created by story 3-8 DURING 3.5's run. NOT REPAIRED BY 3.5 and NOT staged by it: the file was untracked and in-flight under story 3-8, and A3 forbids editing another session's live work. FIX (one line, same shape as the three files 3.5 repaired): add `vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-CO")` in a `beforeEach`, and `vi.restoreAllMocks()` in the existing `afterEach`. See `TournamentHub.test.tsx` for the exact pattern. **Owner: Epic 3 story 3-8** (it owns the file), or the Epic 3 retrospective if 3-8 closes without it. STANDING RULE this establishes: any NEW jsdom render test that mounts `LocaleProvider` must now state the `navigator.language` it assumes, including when it assumes Spanish.

- source_spec: `3-5-first-visit-locale-detection.md`
  summary: `app/src/app/static-output.test.ts:171` checks the exported inline bootstrap script for the markers `["wcstats.locale", "prefers-color-scheme", "locale-"]` and does NOT check for `"navigator"` — so an export that shipped WITHOUT first-visit locale detection would pass the export-layer guard silently.
  evidence: Story 3.5 shipped `navigator.language` detection into the checked-in ES5 literal, and the built export carries `window.navigator.language` (verified: 2 occurrences in `out/index.html`). Adding `"navigator"` to that marker list would make a detection-less export fail — it is the ONLY export-layer check that would catch detection being dropped from the shipped script, since every other guard on this behaviour is a unit or jsdom test that reads the source rather than the artifact. NOT TAKEN BY 3.5 on two grounds, both recorded rather than assumed: (1) the file is on story 3-6's owned-paths list, and (2) adding it would have put a ninth path into 3.5's Task 11.1 staging list, which is explicitly closed. The file was CLEAN at 3.5's probe, so this is a one-line change whenever its owner takes it. Note the guard sits behind `describe.skipIf(!anyBuilt)`, so it only bites after a prior `npm run build`. **Owner: Epic 3 story 3-6, or the Epic 3 retrospective.** Raised as 3.5's open question #2 for Juan; deferred, not silently dropped.

## Deferred from: code review of 3-5-first-visit-locale-detection (2026-08-26)

- **English visitors now get `<html lang="en">` over Spanish copy for the whole hydration window.**
  `output: "export"` (`next.config.ts`) ships every route as pre-rendered Spanish HTML. The pre-paint
  script corrects `<html lang>` and the locale class before first paint but cannot touch the rendered
  strings, which swap only after hydration + the mount effect. So an English first-time visitor now
  sees `lang="en"` over Spanish copy for the bundle-download-and-hydrate window — a WCAG 3.1.1
  mismatch while it lasts, and the very failure mode `i18n-provider.test.tsx:11-14` names. **Not
  introduced by 3.5 and not fixable inside it:** the identical transient already existed for anyone
  with a stored `en` preference, all the way back to Story 2.2's toggle; 3.5 only widens the affected
  population from "returning users who toggled" to "first-time English visitors". It is inherent to
  AD-12's single post-hydration swap, so closing it is an architecture decision (server-side locale
  variants, or an inline copy swap in the pre-paint script — the latter explicitly ruled out by
  AC 6 / D17 / D20). Note the render test cannot observe it either: RTL's `render()` wraps the mount
  effect in `act()`, so only the settled state is assertable.
  **Owner: Epic 3 retrospective, or the D20-b re-open review on 2026-11-24.**

- **`locale-es` / `locale-en` have no consumers anywhere in the product.**
  Grepping every non-test `.ts`, `.tsx` and `.css`, the only references to these classes are the two
  places that *write* them — `bootstrap.ts:127-128` and `i18n-provider.tsx:56-57,65-66` — plus
  `localeClass()` itself. No CSS rule selects them; no component branches on them. They are written
  by the pre-paint script, re-asserted by the provider on every mount, and this story added a fresh
  set of assertions treating them as load-bearing (`i18n-provider.test.tsx:156-158,167`). Either a
  `:root.locale-en` rule was intended and never landed, or this is dead state that four files now
  maintain. Pre-existing since Story 2.2 — 3.5 only added assertions to it — but the question should
  be settled rather than inherited again. **Owner: Epic 3 retrospective.**

- **One fact, three pinning idioms, and `SiteSignature`'s per-`it` variant is the fragile one.**
  Task 7 taught three files the same fact — "state the `navigator.language` you assume" — and each
  came out a different shape: a file-wide `beforeEach` (`HeaderSearch.test.tsx:196-203`), an inline
  `beforeEach` (`TournamentHub.test.tsx:55-65`), and a per-`it` helper called five times
  (`SiteSignature.test.tsx:62-80,103,143,223`), with two incompatible signatures across the four
  copies (`pinLanguage(tag: string)` vs `pinLanguage(locale: "es" | "en")`). The per-`it` form is the
  one that can rot: **any new `it` added to `SiteSignature.test.tsx` silently inherits jsdom's
  ambient `en-US`**, which is the exact dependency Task 7 existed to remove. It fails loudly rather
  than passing vacuously (the case would assert Spanish against an English render), so this is
  hygiene, not a bug. Task 7.3 *ruled* the per-locale shape because that file's cases are generated
  from a `DICTIONARIES` loop, so the fix is a shared helper in test-utils rather than a reshape.
  **Note: `SiteSignature.test.tsx` is dirty under another session as of this review — do not take
  this without an A3 probe. Owner: Epic 3 retrospective, or whoever next touches the file.**

## Deferred from: code review of 3-8-match-route-deep-link-plumbing (2026-08-26)

- **The Tournament Hub still mounts two `useAnchorNonce()` instances.** `TournamentHub.tsx:523`
  (`StandingsSurface`) and `TournamentHub.tsx:686` (`ResultsSurface`) each call the hook, so the Hub
  route carries two `hashchange` listeners and two capture-phase `document` click listeners. Story
  3.8's D4 argues at length that more than one instance is unacceptable — "that would mint five
  `hashchange` + five capture-phase `click` listener pairs on a route that needs exactly one pair" —
  and `TacticalLayer` honours that with a single `useAnchorHit()`. The Hub does not, so the D4
  rationale currently reads as post-hoc.
  **Pre-existing from Story 2.19; not caused by 3.8.** The 3.8 extraction was the cheapest moment to
  collapse it (the hook moved into `lib/` regardless), but doing so means lifting the hook above both
  surfaces and threading the hit down — a Hub-side refactor with its own regression surface, outside
  this story's ruled scope (D9). Consequence today is duplicated listeners, not incorrect behaviour.
  **Owner: whoever next touches `TournamentHub`'s anchor plumbing.**

## Deferred from: code review of 3-1-build-gate-lint-gate-correction (2026-08-26)

- **`imagesrcset` on `<link rel="preload" as="image">` is a fetching position nothing covers.**
  `app/scripts/assert-no-external-origins.mjs:249` — the `srcset` reader is word-boundary-anchored
  and there is no boundary inside `imagesrcset` (`e` and `s` are both word chars), while `linkHref`
  reads only `href`. A tree containing
  `<link rel="preload" as="image" imagesrcset="https://cdn.evil.example.com/hero.jpg 2x">` exits 0.
  **Verified EXIT=0 on both the post-3.1 gate and the `f07116b` gate, so pre-existing, not a 3.1
  regression.** Recorded because 3.1's own comment lists `preload` among the rels that "stay gated",
  and for the preload form that actually drives LCP it is not gated at all. `imagesizes` is
  unhandled for the same reason. **Owner: whoever next touches `FETCHING_POSITIONS`.**

- **A `>` inside a `<link>` attribute value truncates the tag and drops both `href` and `rel`.**
  `app/scripts/assert-no-external-origins.mjs:253` — the tag pattern cannot cross a `>`, so the
  match ends mid-tag and neither attribute is found. Reaches it: a hand-authored (non-React-escaped)
  `.svg`/`.xml`/`.html` asset carrying `<link rel="stylesheet" title="a > b" href="https://...">`.
  **EXIT=0 on both gates, so pre-existing.** Recorded because 3.1 made the tag boundary load-bearing
  for the **rel** read as well, doubling the blast radius of the same parse weakness — a tag that
  fails to parse now also loses its deny-by-default rel. Fixing it means allowing quoted spans in
  the tag pattern. **Owner: whoever next touches the `<link href>` position.**

- **The `SITE_ORIGIN` drift gate does not scan where the second copy will actually land.**
  `app/src/lib/site-origin.test.ts:48-56, 82` — `scannedFiles()` walks only `app/src` and
  `app/scripts` plus top-level `app/*.{ts,mjs,json,toml}`. This matches Task 2.3 as prescribed, but
  AC1's wording is "exactly one definition in the repository" and enforcement is "under `app/`, in
  three places". Three concrete gaps: `app/public/**` is never walked — **story 3.4's
  `public/robots.txt` carrying a `Sitemap:` line is the single most likely second copy and would be
  invisible**; repo-root `netlify.toml` is outside the scan entirely (confirmed present, carries no
  domain today, and is the natural home for a domain, a redirect or a `NEXT_PUBLIC_SITE_URL`); and
  the check is a substring count of the *verbatim full-origin string*, so a bare-host copy (the form
  an `images.domains` list, a CSP `connect-src`, a robots.txt or a Netlify redirect would use), a
  concatenated `"https://" + HOST`, or a case variant each count zero — and the origin gate's regex
  is case-insensitive, so a case variant drifts undetected on **both** sides. `SKIPPED_DIRECTORIES`
  at `:30` is also dead code: `walk` is only ever entered at `src`/`scripts`, neither of which
  contains `node_modules`, `.next` or `out`, so it reads as coverage that was never possible.
  **Owner: Epic 3 story 3-4, which creates `public/robots.txt` and the sitemap.**

- **The ESLint metadata selector is defeated by hoisting the object one line.**
  `app/eslint.config.mjs:202` — the ancestor anchor is
  `:matches(VariableDeclarator[id.name="metadata"], FunctionDeclaration[id.name="generateMetadata"],
  VariableDeclarator[id.name="generateMetadata"])`. Verified with `npx eslint`:
  `const OG = { alt: "Texto", siteName: "Mundial Stats" }; export const metadata = { openGraph: OG };`
  reports **0 errors**, while the same properties written inline report. A sibling const, or a
  `buildMetadata()` helper in another module, ships bare Spanish literals with the build green —
  the exact outcome 3.1's comment says `alt`/`siteName` were added to prevent.
  **Pre-existing for the whole selector: it predates `alt`/`siteName` and applies equally to
  `title` and `description`.** Closing it means either a value-flow rule or a naming convention the
  selector can anchor on, both beyond a key-list extension.
  **Owner: whoever next revisits the i18n metadata rule.**

- **Stated invariants in the 3.1 gate that no test pins.** Three, all low but all of the
  "claims more than it enforces" shape this repo tracks. (1) The `NON_FETCHING_RELS` comment
  (`assert-no-external-origins.mjs:189-199`) and Task 4.5 both claim three consequences "each pinned
  by a test"; the **unknown-`rel`** one has no fixture — the behaviour is correct (an invented rel
  gives EXIT=1) but the deny-by-default property D3-1-b calls load-bearing is asserted in prose only.
  (2) Neither exit-2 branch in `readSiteOrigin` (`:109-118`) has a test — not the "could not find the
  declaration" throw, nor the "must be a bare origin" throw — and the `catch` additionally collapses
  any `readFile` failure (permissions, a packaged invocation with no `src/`) into the same "could not
  find `export const SITE_ORIGIN`" message, pointing the operator at the constant rather than the
  real cause. (3) The ESLint value matcher misses `String.raw`-tagged templates.
  **Owner: whoever next extends the gate suite.**


## Deferred from: story 3.10 — navigation menu (2026-08-26)

Appended, never regenerated: every line above this heading is unchanged.

- source_spec: `3-10-navigation-menu.md`
  status: **RESOLVED — the locale-dependent wrap threshold question is closed, by measurement.**
  summary: Three entries above disagree about whether the header's wrap threshold differs by locale (`es` <=341 vs `en` <=337, versus commit d3c103c's headless 337/337), and the `--header-h` design was told to resolve it before adding a per-locale axis. It is resolved, and the answer moots the disagreement rather than settling it.
  evidence: MEASURED for the CURRENT composition (headless Chromium, built export, 1 px sweep per locale, 200-420 px, `Emulation.setDeviceMetricsOverride` so there is no iframe scrollbar artifact): **`es` is one row from 215 px, `en` from 211 px.** Both prior figures described the PRE-NAV four-element row, which UX-DR24 deleted — below `xl` the row is now wordmark + one 44 px trigger, and the threshold fell ~126 px. So the thresholds DO differ by locale, by 4 px, exactly as `spec-sign-the-project` claimed — but they differ at widths below the 320 px floor, reachable only at zoom, and **both locales agree on the token VALUES (62 px one row, 118 px wrapped).** D9's test for adding a locale axis is a difference in VALUES, not in thresholds, so **no locale axis was shipped**; the breakpoint takes the larger threshold (215 px), because over-reserving adds whitespace above an anchored heading while under-reserving hides it. The three entries above are closed by this, not left open.

- source_spec: `3-10-navigation-menu.md`
  status: OPEN — prose only, no behaviour.
  summary: Four files still name the deleted `scroll-padding-top: 4.5rem` constant in their comments, reasoning from it to justify plain fragment navigation with no scroll handling of their own.
  evidence: `ExpertLayer.tsx:984`, `HubTable.tsx:43`, `LeaderboardsSection.tsx:85`, `TournamentHub.tsx:847`. Their CONCLUSION is now correct at every width — the property tracks the bar instead of guessing at it — but the value they cite no longer exists in `globals.css`. Left rather than edited because all four are outside story 3.10's declared paths (A4: stage only this story's paths), and two of them were held by story 3-8 when this work began. **Owner: whoever next edits any of those four files.** One-line correction each: cite `calc(var(--header-h) + var(--spacing-scroll-clearance))`.

- source_spec: `3-10-navigation-menu.md`
  status: OPEN — pre-existing, found by this story's measurement pass, NOT introduced by it.
  summary: `LeaderboardsRegion`'s loading skeleton overflows the document at a 195 px layout viewport, on `/`, in both locales and themes.
  evidence: MEASURED. The R2/D8 matrix (320/390/195 x dark/light x es/en x 8 routes = 96 cells) reported **4 cells overflowing at 195 px on `/` with `document.scrollWidth` = 208 against a 195 px viewport**. The offender is `<div className="skeleton h-6 w-48">` at `LeaderboardsRegion.tsx:191` and `:193` — `w-48` is a FIXED 192 px, and 16 px of gutter puts its right edge at 208. It is a LOADING state: re-measuring after the fetch settles gives **0 of 48 cells overflowing**, which is why Story 2.19's matrix was green and why this went unseen — that run measured settled state. The header is not implicated (its own `scrollWidth` is exactly 195 at that width). WCAG 1.4.10 is a property of the page as presented, including while it loads, so this is a real if transient failure. Fix is one class: a responsive or `max-w-full` width on the two skeletons. **Left to `LeaderboardsRegion.tsx`'s owner — outside story 3.10's declared paths.**

- source_spec: `3-10-navigation-menu.md`
  status: OPEN — pre-existing, found by this story's a11y pass, NOT introduced by it.
  summary: 36 dangling `aria-controls` IDREFs on `/`, on disclosure buttons whose panels are not rendered while closed — an axe `aria-valid-attr-value` failure.
  evidence: MEASURED in headless Chromium on the built export, at 390 px and 1280 px, sheet open and closed. Every one is on a "Ver la tabla" disclosure button (`aria-controls="_r_v_"` and siblings — React `useId` values), pointing at a panel that only exists while open. This is precisely the failure the CONDITIONAL form exists to prevent, and which story 3.10's own trigger uses (`aria-controls={sheetOpen ? sheetId : undefined}`, D6). **The chrome this story owns is clean: zero violations at every width and state, zero duplicate ids, and zero hit targets under 44 px, measured rather than asserted.** The 36 are in other components' disclosures. Fix is the same one-line conditional at each site. **Owner: whoever next edits those disclosures.**

- source_spec: `3-10-navigation-menu.md`
  status: OPEN — verification gap, disclosed rather than papered over.
  summary: `axe-core` is not installed, so story 3.10's Task 9.9 could not run a full axe sweep; the two rules the story names were checked directly instead.
  evidence: Story 2.14's docblock records "axe-core is present TRANSITIVELY ONLY, via eslint-plugin-jsx-a11y". It is no longer present at all — `find node_modules -name "axe*"` returns nothing. Story 3.10 therefore hand-checked exactly the rules D5 and D6 name (`aria-dialog-name`, `aria-valid-attr-value`) plus `duplicate-id` and MEASURED 44 px hit targets, over the header and the open sheet, at 390 px and 1280 px: all clean. That is narrower than axe's full ruleset — colour contrast, name-role-value on other controls, and landmark rules were NOT swept. **A dev dependency was deliberately not added without the owner's approval** (the dev-story workflow halts on new dependencies). **Owner: add `axe-core` as a devDependency and run a full sweep, or rule that the targeted check suffices.**

- source_spec: `3-10-navigation-menu.md`
  status: OPEN — interactive path not driven headlessly.
  summary: `/compare`'s mini-header geometry was measured by mounting the shipped class string, not by completing the two-entity picker flow.
  evidence: The mini-header mounts only once two entities are compared, and the picker's listbox could not be driven from CDP (real `Input.dispatchKeyEvent` and `Input.insertText` both left the listbox closed; the corpus never yielded options headlessly). The GEOMETRY question — does the bar clear the site header at 320 px — was answered directly instead: the shipped class string was mounted into the live `/compare` document and measured while stuck, giving `position: sticky`, `top` resolving to 118/62 px per breakpoint, and the probe's top sitting at the header's bottom (+0.2 px) at 195/320/390 in both locales. What remains unverified is the flow that MOUNTS it, not the offset it uses. **Owner: whoever next has a working headless path into the compare pickers.**

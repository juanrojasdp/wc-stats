---
baseline_commit: 7f28e44
---

# Story 2.19: Performance & Accessibility Hardening, Real-Data Swap & Launch

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

**This is the FINAL story in the project.** Epic 1 is done (1.1–1.19). Epic 2 is done through 2.18.
Baseline: commit `7f28e44` on `main`, tree clean, in sync with origin.
Spec: `_bmad-output/planning-artifacts/epics.md:1004`.

---

## Story

As the builder,
I want the budgets, accessibility floor, and real-artifact behavior verified end to end,
so that the product ships on the real dataset meeting every gate it promised (FR-34, SM-4, SM-5).

---

## Acceptance Criteria

**AC 1 — Real-data build (SM-3).**
**Given** the committed real `/data` from Story 1.19
**When** the app builds against it
**Then** all routes pre-render from the real route manifest, the schema-version assert passes, and spot-checked shot maps match the source PDFs on ≥10 matches.

**AC 2 — Performance budgets (NFR-1, SM-C2).**
**Given** the performance budgets
**When** measured on the production build
**Then** Lighthouse mobile ≥ 90 on Match Dashboard and Tournament Hub and every route's JSON payload respects the pipeline-measured 500 KB budgets — with density moved behind disclosure, never deleted, if tuning is needed.

**AC 3 — Accessibility floor (NFR-2, UX-DR16).**
**Given** the accessibility floor
**When** audited
**Then** WCAG 2.1 AA checks pass: every viz has its reachable data-table alternative, focus is visible everywhere (`focus-ring-on-pitch` on pitch in both themes), keyboard-only traversal completes every flow (UJ-1..4), `prefers-reduced-motion` disables all animation, 200% zoom holds the single-column Hero, reflow holds to 320px, and a Spanish screen-reader spot-check resolves the `lang="en"` span decisions.

**AC 4 — Launch (SM-4, SM-6).**
**Given** launch
**When** the site deploys
**Then** Netlify publishes `app/out` via the AD-13 chain at $0/month, the Netlify account bandwidth model is confirmed and logged, and the repo + live URL are publishable as the portfolio piece.

**AC 5 — The ledger closes (this story's own).**
`deferred-work.md` carries ~38 entries naming 2.19 as owner. Every one is discharged, re-deferred with a named successor and a stated reason, or recorded as already-closed. No entry naming 2.19 is left silently open at the end of the project.

---

## READ THIS FIRST

Five things will save you a day each. Read all five before opening a file.

1. **The ledger sweep IS this story.** `epics.md:1004` is four paragraphs. The real scope is the
   66 ledger blocks naming 2.19, partitioned below. Do not build this story from the epic alone.

2. **The viewport blocker is SOLVED. It is not a blocker any more.** Browser automation still
   cannot resize the window (it reports success and stays at 1920 — this killed reflow
   verification in 2.16 and 2.17). A dependency-free headless-Chrome CDP harness *does* work and
   was proven at story creation: real 320/195 CSS px layout viewports, `prefers-reduced-motion`
   and `prefers-color-scheme` emulation, and **`IntersectionObserver` fires**. Working script and
   proof are in *The measurement harness* below. Do not re-discover this and do not fall back to
   an iframe.

3. **The real bundles are much emptier than the fixtures, and it changes what ships.** Four of the
   seven event tables are `null` on 104/104. The most consequential: `passNetworkNodes` is null
   while `passNetworkEdges` carries **23,597 real rows**, and Story 2.8 fails *closed* on exactly
   that shape. Juan ruled the re-scope (R1). Full census in *Real-data reality* below.

4. **Two of the biggest ledger items are already CLOSED.** The whole-layer error boundary (filed
   five times) was fixed by 2.18. The goal-prevention denominator was measured by 1.16 and the
   relation holds 208/208. Do not re-implement either. Partition D lists all of them.

5. **Juan has already ruled the four decisions that set this story's size.** R1–R4 below are
   decided, not open. He took the maximal option on all four: re-scope the pass network, fix
   reflow below 320 across all three owners, spend the pipeline re-extract here, and deploy to
   production as part of this story.

---

## Rulings taken by Juan at story creation (2026-08-09) — DECIDED, not open

### R1 — `#pass-networks`: RE-SCOPE so a populated edge table renders without nodes

At real data `events.passNetworkNodes` is `null` on 104/104 and `events.passNetworkEdges` carries
23,597 rows. `app/src/lib/tactical-sections.ts:124-125` requires **both** tables non-null (2.8 ruled
decision 13, pinned by `tactical-sections.test.ts:193-199`), so `sectionDataState` returns `empty`
and the whole section renders `EmptyStatePanel` — the fully-real pass matrix never reaches a reader.

**RULED: relax the predicate so a populated edge table renders on its own** — as the sortable pass
matrix table UX-DR16 already requires, without the node figure. Story 1.14's binding stands
underneath it: 1.16 emits `null`, **never `[]`**, because `pass-network-model.ts:336` throws on
every unresolvable endpoint. Your relaxation must therefore admit `nodes === null` *only* alongside
non-empty edges, and must not route `[]` down the populated branch.

> The node figure is not buildable and never will be: 0 pitch frames on 208/208 pass-network pages,
> 0 filled Béziers at any size, and a corpus-wide title scan over all 5,448 pages finds no
> average-positions page. See the 1.14 AD-14 filing. Do not go looking for coordinates.

### R2 — Reflow below 320 CSS px: YES, and the three owners move together

32 elements overflow at 195 CSS px (a 390px device at 200% zoom), owned by three stories:
`SiteHeader` toggles (2.2), the Hero score row (2.4), `#key-stats` paired tiles (2.5). A fix that
narrows only one leaves the other two overflowing, so **it is one change across all three or it is
nothing.**

**RULED: take it.** The known constraint: a `#key-stats` tile's min-content width is **247px** — two
fixed 76px value tracks plus `px-4` plus the label — and `type-stat-value` is 26px with a ~70px
min-content per side. You cannot reach 195px without either re-tracking the 76/120px columns or
dropping below the DESIGN type ramp. The mockups pin the tracks; UX-DR2 pins "no type below 11px".
Prefer a documented narrow-width track change (`grid-cols-[76px_1fr_76px]` → a `minmax()` or a
stacked sub-320 layout) over a type-ramp departure. Any type-ramp departure must be declared.

**Also inside AC 3's letter and NOT optional:** the Expert Layer's `<md` column-group `ToggleGroup`
overflows at **320px in BOTH locales** (339 vs 305) and at **390px in EN** (412 vs 375). The
candidate fix is one class — `flex-wrap` on the ToggleGroup — or shorter EN group labels. That is a
true 320px failure, distinct from the 195px question.

### R3 — The Story 1.19 pipeline batch: TAKE ALL TWELVE HERE

**RULED: 2.19 spends the re-extract.** All twelve edits from Story 1.19's code review land in this
story, together, followed by a full re-run and a fresh byte-identity proof. This is the last story;
otherwise they never land. Detail in *The pipeline batch* below.

### R4 — Netlify: DEPLOY TO PRODUCTION AS PART OF THIS STORY

**RULED and AUTHORIZED by Juan at story creation.** Connecting the repo and publishing to production
is an AC 4 deliverable. The dev agent does **not** need to re-ask for permission to publish — that
authorization is recorded here. It must still satisfy the AC's own preconditions first (green build
chain, account bandwidth model confirmed and logged, `$0/month` verified) and must report the live
URL in the Dev Agent Record.

---

## THE LEDGER SWEEP — the partition

66 blocks in `_bmad-output/implementation-artifacts/deferred-work.md` name 2.19 (74 raw mentions).
Every one is placed below. Line numbers are into the ledger as of `7f28e44`.

### Partition A — 2.19 IMPLEMENTS

| # | Ledger | The item | Note |
|---|---|---|---|
| A1 | L133 | **The two `DATA_ROOT` cutover points have no enforcement.** Flip both + add the guard test. | THE cutover. See *The DATA_ROOT cutover*. |
| A2 | L137 | **Substring HTML assertions assume escape-free text.** | **Measured: exactly ONE name escapes — `Côte d'Ivoire` → `Côte d&#x27;Ivoire`, on 4 matches.** Zero player names. See *Real-data fallout*. |
| A3 | L49 | **Zero-external-request audit is a one-time manual grep.** Add a dependency-free post-export origin-grep to the build chain. | AC 3 adjacent; 2.1 routed it here by name. |
| A4 | L2173 | **104-at-scale Hub verification.** Literal 104 count, real reachability, `<md` with 12 group tables and up to 19 sections, Lighthouse. | Fixture carries 3 of 104. |
| A5 | L2967 | **Accent-insensitivity has never been exercised in a BROWSER** because `DATA_ROOT` pointed at fixtures. | Real corpus non-ASCII inventory is exactly `ü`, `ô`, `ç` — all in team names. Player names arrive diacritic-stripped, so it is the *reader* who types the accent. |
| A6 | L3299 | **Seven of eight linked `/teams/` slugs 404 on fixtures.** | Verify all 48 resolve after the flip. |
| A7 | L3451, L3768 | **Reflow at 320/390 in both themes and both locales, 200% zoom, real `prefers-reduced-motion`.** Never measured — routed here twice. | **Unblocked by the harness.** Includes 2.16's 13-column team table. |
| A8 | L3862 | **`/compare`'s `<md` sticky mini-header `IntersectionObserver` is UNVERIFIED.** | **Unblocked** — IO fires in the harness. `data-compare-showing` / `data-compare-side` exist to make this cheap. |
| A9 | L3558 | **`assert-schema-version.mjs` walks the working tree**, so a killed run's gitignored `data/matches.staged/` siblings are visited. | Add a directory-skip rule. |
| A10 | L3640 | **Should a unit-test run re-walk the entire real corpus?** 1,411 artifacts, 1,659 ms. | Architectural call on a file under `app/`; 1.19 was not authorised to take it. |
| A11 | L2545 | **`m082-belgium-senegal` added a fourth route the app suite never ran for** — the first to exercise `players: null` / `goalkeeping: null`. | At real data both are populated on 104/104. Verify the route and the absence branches. |
| A12 | L2066, L3431 | **`i18n.test.ts`'s caption inventory is stale**: pins `viz.pressing.metreTableCaption` for a table CS-2 deleted, and hardcodes `27`/`27`/`28`. | **Also breaks at the flip:** real `leaderboards.json` carries **36** boards vs the fixture's 3. Retire the orphaned `viz.pressing.metre*` family with it. |
| A13 | L1979, L3412 | **`#pressing`'s metre presentation is RETIRED and the surface is owed.** Re-present `tacticalIdentity.{home,away}.shapeByPhase`. | **2.16 already minted the vocabulary** (`team.shape.*`, rows in EXPERIENCE.md). 2.19 owns the match-route surface only. `shapeByPhase` is **populated on 104/104**. |
| A14 | L2045 | **The involvement TICK model rests on an expired condition.** Its interim ruling reads "both mechanisms read `row.at.stoppageMinute`, WHICH THIS CONTRACT DOES NOT CARRY" — CS-2 made it carry exactly that. | 2,506 of 21,764 samples carry a non-null `stoppageMinute` and **every one collides** on minute. Re-open against the full `momentumTickIndices` rule. |
| A15 | L2079 | **`goalkeeping-model.ts` synthesizes a fake `playerId`** (`"rangel-raul-mex-ochoa-guillermo-mex"`) and mints `" / "` user-visible copy inside a pure model. | Give the per-team block the `teamId` it already carries; move name composition to the locale layer (AD-7). |
| A16 | L1213 | **`sortRows` is unmemoised and the inactive path copies the array on every render.** | Fixture-scale non-issue; real scale is the point. The fix is a `useMemo` on `columns` construction, not on the sort. |
| A17 | L1877 | **No log table sets `rowHeader`** — the receiving log's ~609 body cells are all `<td>`. | Four-table a11y change. The natural row header (player) is itself gated, so it needs a fallback. |
| A18 | L2236 | **`#lideres` is a Spanish anchor**, against 2.18 ruled decision 11 (slugs are English/romanized). | One-line rename plus whatever links to it. |
| A19 | L3732 | **`readTeamProfile` is called twice per build** (`generateMetadata` + page body), no memoisation. 96 parses across 48 routes; `/players/[slug]` has the same shape at **2,496**. | Memoise the read. |
| A20 | L2325 | **`InvolvementChart` ships the unfixed edge-drawn hatch `<pattern>`** — `x1={0}` where `DistributionChart` centres at `HATCH_TILE_PX / 2`, so half the stroke clips to a 0.75px stripe. | This is half the UX-DR11(b) texture channel, on a shipped chart. One-line fix. |
| A21 | L2929 | **DESIGN.md should absorb `accent-cyan` on `surface-overlay`: 9.20:1 dark / 4.68:1 light.** | Doc edit. Method was validated by reproducing the published base figures first. |
| A22 | L2945 | **EXPERIENCE.md contradicts itself: "full-width sheet" vs "full-screen sheet".** 2.14 shipped full-width (386px at `top: 0`, content-driven height). | Reconcile to one wording. |
| A23 | L4089 | **Two entities with the same display name produce byte-identical `/compare` captions.** | **CONFIRMED reachable at real data: `Emiliano MARTINEZ` occurs twice in the 1,248-name corpus.** Disambiguator is the side's `detail` line or the entity id. |
| A24 | L2910 | **axe was never run — "2.19 owns it".** `axe-core` is still transitive-only via `eslint-plugin-jsx-a11y`. | AC 3's mechanical half. |
| A25 | L1410 | **`domain-g-zone-sum` broke on 79 of 96 FIXTURE rows, worst drift 4.400 m**, while corpus-verified at 0.200 m over 3,289 rows. A fixture defect. | Real profiles now exist. Run the check over them as an acceptance gate. |
| A26 | L1538 | **A locale switch re-orders any text-sorted table with no announcement**, leaving the live region holding the previous language's message. | Applies to all 26 tables; belongs in `DataTable`. In scope for the a11y floor. |
| A27 | L2185 | **Hub tables ship no sticky header** — deliberately, because none of them scrolls. | Revisit the premise at 104 rows: largest knockout section is 16 rows. Expect NO CHANGE; record the check. |
| A28 | L3367 | **Two hand-written `/teams/` route literals remain** beside `teamHref` (`LeaderboardsSection.tsx:200`, `LeaderboardsRegion.tsx:424`). | Repoint. `MatchHero`'s two prefetch sites are already fixed; verify `prefetch={false}` holds at 104 match pages. |
| A29 | L527, L545 | **Mirror the goal furniture at the defending end.** RULED YES by 2.9 decision 9; implementation routed to "whichever story next owns `pitch-geometry.ts` and `PitchPanel.tsx` together, **or 2.19**". | **Last chance — this ruling has nowhere else to go.** Two non-projective steps: the `goal` depth offset is direction-dependent px (reverse by hand, do not project) and `penaltyArc`'s angle range must be **reflected**. It visibly changes 2.8's shipped pass-network figures — re-verify them. See *Open questions* for the cut option. |
| A30 | L2890 | **The header-search payload question.** On four of five routes there is no already-loaded index; the header lazily fetches `tournament.json` on first engagement. | **Measured: 409,524 B raw / 39,137 B gzip.** Decide whether 39 KB on a match route is right, or whether the `entities` slice earns a contract change. See *Open questions* Q1. |
| A31 | L3849, L3841 | **`/compare` has no Lighthouse target and no AD-4 route-payload set.** | Measured worst case `type=matches`: 39,137 + 2 × 14,251 = **67,639 B gzip ≈ 66 KB** against the 500 KB cap. Measure Lighthouse anyway; file the AD-4 amendment or record the gap. |
| A32 | L624 | **Five contract-required goalkeeping sub-blocks are null on 208/208** while the fixtures populate all five. "The surface a developer sees in dev is not the surface that ships at the 2.19 cutover." | **No code change is owed** — 2.10 presence-gates all five through `CorpusNullableGoalkeeperRecord`. **Verify the gates close and `viz.goalkeeping.gateNote` renders** at real data. |

### Partition B — RULINGS, not work

R1–R4 are **already ruled by Juan** (above). These remain open and are listed in *Open questions
for Juan* at the foot of this file, each with the evidence needed to rule it:

| Ledger | The question | Owner |
|---|---|---|
| L147, L2697, L3227 | **`<title>`/OG stay Spanish after an EN toggle.** Unruled since 2.12 took it de facto for `/`. **NFR-4 forces the question at 2.19**, and at the cutover the population is 104 + 1,248 + 48 + Hub routes. | **Juan.** Filed three times, never ruled. |
| L2890 | **Is 39 KB gzip the right thing to pull on a match route?** | Juan / architecture. |
| L521 | **UX-DR10's two diamonds have no surface, and `forced-turnover` vs `possession-regain` are visually identical.** One UX decision, both halves. | UX. **Now moot in practice** — `defensiveActions` is null on 104/104. Rule it or close it. |
| L2335 | **An abbreviated head that also carries a unit stacks two parentheticals**: `"Ordenar por Vel. máx. (km/h) (Velocidad máxima)"`. Both halves are ruled and neither is wrong; the composition is clumsy. | Copy ruling. |
| L1246 | **~25 per-table announcement identifiers.** Mechanism resolved by 2.11b (`tableName?: string`); the copy is not. | Copy, not mechanism. |
| L962, L2347 | **Five Tactical section summaries and the whole leaderboards surface carry no glossary mark.** Marking inside a sortable head is structurally invalid (`glossary.ts` bans nesting a focusable trigger in a `<button aria-expanded>`). | Copy pass with the terminology mandate. |

### Partition C — RE-DEFER, with the reason and a named successor

| Ledger | The item | Why it is not 2.19's |
|---|---|---|
| L525 | **The heatmap.** | **The input still does not exist.** Re-verified at story creation against the *emitted* bundles: `crosses`, `defensiveActions` and `receiving` are `null` on 104/104. Every candidate Domain D family remains under an unresolved AD-14 blocker. A heatmap built now would bin nothing. The 2.9 filing's re-open trigger (Story 1.16) has fired and the answer is *no input*. **Re-defer to the successor change-set**, and record that the trigger fired. |
| L1504 | **`sectionContent()` is evaluated eagerly, so a throw during PROP CONSTRUCTION escapes the per-section boundary.** | 2.18 contained the per-section case; this residual needs `TacticalLayer`'s content construction reworked. Also open: the boundary has **no reset path**, and `key-stats`/`momentum` are never collapsible, so a crash in either is permanent for the page's life. Not hardening scope. |
| L1553, L1886 | **Deep-linking into a closed disclosure.** | ~12 files across every match-page section, and it inherits three filed hash-re-entry defects — of which "an unchanged hash never re-fires `hashchange`" is fatal to a link list. Blast radius is the whole match route for navigation that is already honest. |
| L1465 | **Two data columns at 390px in the Expert table.** | Measured: 55.7px of data columns, not one full column; the `<md` escape hatch buys 88px. The lever (ruled abbreviations per EXPERIENCE.md:139) is available, but this is a copy/UX pass, not reflow compliance. 320/390 already pass once A7/R2 land. |
| L1423 | **Delete `PendingSectionPanel`** (zero consumers, live locale keys). | Removing it means reasoning about three assertions in `tactical-sections.test.ts:108-125`, which A1/R1 are already editing. Dead code with no user impact; take it only if free. |
| L4071 | **`/compare` drops unpaired metric codes silently.** | Both artifacts are total today (verified: `keyStatistics` populated 104/104, profiles 1,248/48). Reaching it needs a truncated emission. |
| L3388 | **AC 1 says "form strings"; the contract ships no `form` field on a team profile.** | Informational. 2.16's D3 ruled the Hero strip a projection of `matches[].result`. Recorded so nobody reads AC 1 as naming a missing field. |
| L3715 | The 1.19 roll-up of "everything routed to 2.19". | Index entry, not work. Every item it names is placed elsewhere in this table. |
| L1629 (part) | The **195px** half of the Expert ToggleGroup. | The **320px** half is A7/R2 and IS taken. |

### Partition D — ALREADY CLOSED. Do NOT re-implement.

| Ledger | Item | Closed by |
|---|---|---|
| L7, L529, L861 | **The whole-layer error boundary** — filed FIVE times ("kills all eleven Tactical sections"). | **RESOLVED by Story 2.18.** `TacticalErrorBoundary` gained `headlineKey`/`explanationKey` and now wraps each section's children inside `TacticalLayer`'s render, keyed `` `${plan.id}-${plan.open}` ``. `MatchBundleRegion.tsx` is byte-identical. Only the residual in Partition C stays open. |
| L839, L1685 | **A denominator-labelled goalkeeping breakdown can contradict its own rows.** | **MEASURED by 1.16: `sum(byInterventionType) == attemptsFaced` on 208/208, delta histogram exactly `{0: 208}`.** "No 2.19 App fix is owed." The `byBodyType` half is unmeasurable (null on 208/208) and is subsumed by CS-2's D2a. |
| L687, L1939 | **`GoalkeeperInvolvementSample.minute` cannot represent the corpus clock** — filed as a 2.19 BLOCKER. | **DISCHARGED by CS-2.** `goalkeeping-model.ts` already indexes by SAMPLE. Note the correction at L2045: the TICKS are still owed — that is A14. |
| L1234 | **Sort collation pinned to `es`; re-measure over the real name corpus.** | **MEASURED AT STORY CREATION — see below. Decision 8 STANDS.** Do not thread `useLocale()` through `DataTable`. |
| L3249 | **Real-data sizing (2.15 Task 9.4).** | Already measured once and reverted. Numbers carried forward below. |
| L537, L557, L570 | **`#defensive-actions` collapses to ONE cluster at 320px at 153-marker corpus density.** | **MOOT at the emitted artifacts.** The 153/team-inning figure was measured over *staged extraction records*; `events.defensiveActions` is **null on 104/104** in the emitted bundles because four required fields are unfulfillable. The section renders its empty state. Record this correction in the ledger — it is the third place this number has been carried forward. |
| L593 | **Every `#defensive-actions` marker announces the same sentence at corpus density.** | Same reason: there are no markers. Already ruled "accept the degradation" at the 2.9 review. |

#### The collation measurement, taken at story creation — DO NOT RE-RUN

Real corpus, Node 24 `Intl.Collator(locale, {sensitivity: "base"})`, `es` vs `en`:

| corpus | n | pairs compared | disagreements | sorted orders identical |
|---|---|---|---|---|
| player names | 1,248 | 778,128 | **0** | **yes** |
| team names | 48 | 1,128 | **0** | **yes** |
| match labels | 104 | 5,356 | **0** | **yes** |

The 2.11a reviewers' failure case (ñ collating as a distinct letter) stays **unobservable on shipped
data** — because all 1,248 real player names arrive with diacritics already stripped and the only
non-ASCII characters anywhere in the corpus are `ü`, `ô`, `ç` in three team names. **Ruled decision 8
is re-affirmed on real data.** Record the measurement; change no code. (`app/src/lib/table-sort.ts`
stays at its `'es'` default, verbatim per UX-DR12.)

---

## The measurement harness — the blocker is SOLVED

**The environmental blocker is real and unchanged:** `mcp__claude-in-chrome__resize_window` reports
success while the window stays at 1920; `window.resizeTo` and same-origin popups are blocked. This
killed 2.16's Task 10.6/10.7 and 2.17's Task 8 verification. **An iframe is not the answer** —
`IntersectionObserver` delivers zero callbacks for iframe content in this environment.

**A headless-Chrome CDP harness works, and all three capabilities were proven at story creation.**

Chrome is at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Node 24 ships a global
`WebSocket`, so the driver needs **zero dependencies** — do not add puppeteer or playwright.

```js
// launch: --headless=new --remote-debugging-port=9333 --disable-gpu --user-data-dir=<scratch>
// discover: GET http://127.0.0.1:9333/json/list -> the type:"page" target's webSocketDebuggerUrl
// drive:  new WebSocket(url); send {id, method, params}; resolve by id
await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 800, deviceScaleFactor: 1, mobile: true });
await send("Emulation.setEmulatedMedia", { features: [
  { name: "prefers-reduced-motion", value: "reduce" },
  { name: "prefers-color-scheme",  value: "light"  },
]});
await send("Page.navigate", { url });
await send("Runtime.evaluate", { expression: "...", returnByValue: true });
```

**Proof taken at story creation** — a 400px-wide block in a page at three emulated widths:

| emulated width | `documentElement.clientWidth` | `body.scrollWidth` | overflowing elements |
|---|---|---|---|
| 320 | **320** | 400 | 1 |
| 390 | **390** | 400 | 1 |
| 195 | **195** | 400 | 1 |

| capability | result |
|---|---|
| `matchMedia('(prefers-reduced-motion: reduce)')` | **true** under emulation |
| `matchMedia('(prefers-color-scheme: light)')` | **true** under emulation |
| `IntersectionObserver` across a scroll | **fires** — `[false]` → `[false, true]` |

**Three rules for using it.**

- **Measure `document.documentElement.clientWidth`, NEVER `window.innerWidth`.** Under mobile
  emulation `innerWidth` reports the scrollWidth-expanded initial containing block (it read **400**
  at every one of the three widths above) and will silently tell you the page is fine.
- The overflow predicate that matches the ledger's own figures is
  `[...document.querySelectorAll('*')].filter(n => n.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)`.
  Report the count **and** the offending selectors — the 195px filing's value is that it names three owners.
- **200% zoom is modelled as half the CSS width**, exactly as the ledger frames it: 390px device at
  200% zoom = a **195 CSS px** layout viewport. Do not reach for `Emulation.setPageScaleFactor`.

**Serve the export over HTTP, not `file://`** — `fetch` of `/data/...` needs a real origin. Use
`python -m http.server` from `app/out` as 2.14 and 2.16 did, on a private port (another session may
hold the default).

**Coverage this harness must produce (AC 3):** 320 / 390 / 195 CSS px × {dark, light} × {es, en}
across `/`, `/matches/{slug}`, `/players/{slug}`, `/teams/{slug}`, `/compare`, `/glossary`, `/about`,
`/404`. Report a table, not a claim.

---

## The DATA_ROOT cutover — two points, one flip

**Both constants must move in the same commit. Nothing derives one from the other and no test
asserts they agree. The failure is silent and split: the Hero renders fixture data while the
below-Hero region fetches real data or 404s.**

| file | line | today | after |
|---|---|---|---|
| `app/src/lib/build-data.ts` | 26 | `path.join(process.cwd(), "..", "data", "fixtures")` | `path.join(process.cwd(), "..", "data")` |
| `app/src/lib/data.ts` | 7 | `export const DATA_ROOT = "/data/fixtures";` | `export const DATA_ROOT = "/data";` |

> **⚠ SCRIPTED EDITS TO THESE TWO FILES HAVE HISTORICALLY PATCHED THE DOC COMMENT INSTEAD OF THE
> CONSTANT.** Both files carry a `DATA_ROOT flip point (Story 2.19)` comment block containing the
> same string literal, and both sit *above* the constant. Use the edit tools with the assignment
> line as the anchor, then `git diff` and confirm you changed line 26 and line 7 — not lines 21–25
> and 2–6. Update the comments too, but as a separate, deliberate edit.

**The guard test the ledger asks for (L133).** A one-line test comparing the trailing path segments
of the two constants. It must fail if either is flipped alone. `data.ts` is client-importable and
`build-data.ts` is barred from `src/components/**` by ESLint, so put the test where it can import
both — a `src/lib/*.test.ts` under the node environment, importing `build-data`'s root via a small
named export rather than re-deriving the path (re-deriving is how you build a test that cannot fail).

**Also flips with it:**
- `app/src/lib/tournament-index.test.ts:80` asserts the literal `"/data/fixtures/index/tournament.json"`.
- `app/src/lib/i18n.test.ts` caption inventory: hardcoded `27` / `27` / `28`, and the Hub caption
  count is derived from `LEADERBOARD_FIXTURE.boards.length` — **3 on fixtures, 36 on real data** (A12).
- Tests that read fixtures by relative path (`hub-model.test.ts:32`,
  `leaderboard-model.test.ts:34`, the `viz/*-model.test.ts` family) are **deliberately fixture-pinned
  unit tests and should STAY pinned.** Do not sweep them into the flip.

---

## Real-data reality — the census, measured at story creation

`data/` is committed and complete: **1,412 files, 30 MB** — 104 match bundles, 1,248 player
profiles, 48 team profiles, `tournament.json`, `leaderboards.json`, plus `data/fixtures/` (10 files).

### Event tables over all 104 emitted bundles

| table | state | rows |
|---|---|---|
| `shots` | populated 104/104 | 2,571 |
| `passNetworkEdges` | populated 104/104 | **23,597** |
| `crosses` | **null 104/104** | 0 |
| `defensiveActions` | **null 104/104** | 0 |
| `receiving` | **null 104/104** | 0 |
| `passNetworkNodes` | **null 104/104** | 0 |
| `shootoutAttempts` | **null 104/104** | 0 |

Top-level blocks `momentum`, `players`, `goalkeeping`, `tacticalIdentity`, `keyStatistics`,
`setPlays` are **populated on 104/104**.

**What this means per section, and what NOT to "fix":**
- `#pass-networks` → R1's re-scope. 23,597 edges, zero nodes.
- `#shot-maps` → shots render; the **cross map has no data**. That is the 1.11 AD-14 blocker, not a defect.
- `#defensive-actions` → **empty state on every match.** The 153-marker cluster-density and
  identical-announcement filings are moot (Partition D).
- `#offers-to-receive` / `#movement-to-receive` → **fine.** 2.9 re-scoped both to read
  `bundle.players[].inPossession`, which is populated (`totalOffers`, `offersReceived`,
  `offersByMovementType` all present).
- `#goalkeeping` → the five null sub-blocks close their gates; `viz.goalkeeping.gateNote` renders (A32).
- `#pressing` → `shapeByPhase` is populated with all six panels (A13).

### Names, escaping and collation

| fact | value |
|---|---|
| team names needing HTML escape | **1** — `Côte d'Ivoire` → `Côte d&#x27;Ivoire` |
| matches carrying it | `m009-cote-d-ivoire-ecuador`, `m033-germany-cote-d-ivoire`, `m055-curacao-cote-d-ivoire`, `m078-cote-d-ivoire-norway` |
| player names needing HTML escape | **0** |
| non-ASCII characters in the whole corpus | `ü`, `ô`, `ç` — team names only (`Türkiye`, `Curaçao`, `Côte d'Ivoire`) |
| duplicate display names | **`Emiliano MARTINEZ` × 2** (players). Teams: none. Match ids: none. |

### Hard-coded test ids SURVIVE the flip — verified

`m001-mexico-south-africa` (Mexico 2–0 South Africa) and `m074-germany-paraguay` (Germany 1–1
Paraguay, shootout **3–4** to Paraguay) exist in real data with the same ids and the same scores, so
`static-output.test.ts`'s hard-coded expectations — including `"Germany 1–1 Paraguay (3–4 pen.)"` —
still hold. The knockout shape lives at `metadata.knockoutScore`, and real data now covers all three
`decidedBy` values (`m001` regulation, `m104` extra-time, `m074/075/088/096` shootout) — closing the
1.1 fixture gap.

### Payload budgets — MEASURED, all PASS (AC 2, NFR-1)

gzip -9 over the canonical committed bytes:

| route payload set | measured | cap | result |
|---|---|---|---|
| Hub (`tournament.json` + `leaderboards.json`) | 39,137 + 78,501 = **117,638 B (114.9 KB)** | 500 KB | **PASS**, 23% of budget |
| largest match bundle (`m082-belgium-senegal`) | **14,251 B (13.9 KB)**, median 12,269 | 500 KB | **PASS** |
| largest player profile (`bellingham-jude-eng`) | **1,543 B**, median 1,022 | 500 KB | **PASS** |
| largest team profile (`england`) | **1,254 B**, median 1,023 | 500 KB | **PASS** |
| `/compare` worst case (`type=matches`) | **67,639 B (66 KB)** | 500 KB (unassigned — A31) | PASS |

**So AC 2's payload half is already discharged by measurement.** Re-verify and record; the open half
is Lighthouse. SM-C2 applies only if Lighthouse forces tuning: **move density behind disclosure,
never delete it.**

### Build sizing (measured by 2.15 Task 9.4, then reverted)

| | measured |
|---|---|
| player routes | 1,248 |
| match routes | 104 |
| `next build` wall clock | 76 s (gates excluded) |
| `out/` total | 79.3 MB / 12,243 files |
| one player HTML | 23,328 B vs 23,247 B on fixtures — **+81 bytes** |

That +81 bytes is the AD-11 projection holding: the Hero payload is bounded by the projection's
seven fields, not by profile size. **Note the measurement predates 2.16, so it does not include the
48 team routes.** Expect a modestly larger `out/`.

---

## The pipeline batch (R3) — all twelve, one cycle

Every edit to `pipeline/**/*.py` outside `tests/` changes `code_version()` from the recorded
`ad4735a216e2` and invalidates Story 1.19's byte-identity evidence — all 104 staged Extraction
Records plus every figure in AC 3's reproducibility proof. `EXCLUDED_DIRS`
(`pipeline/ingest/fingerprint.py`) contains `tests`, which is why the test-only fixes were free and
were already applied. **These twelve are worth exactly one cycle between them — take them together.**

Full detail and per-item evidence live in **Story 1.19 §Review Findings**; it is not duplicated here.

1. **Post-swap cleanup turns a SUCCESSFUL emission into exit 2** — `clear(backup)` in `emit_bundles`
   and the retired-backup `unlink` in `swap_files` sit outside the guarded block. Found independently
   by all three review layers. 1.18 already shipped the answer. *(Touches a shipped guarantee.)*
2. **Cleanup inside the failure handlers can replace the exception it is cleaning up after** — four
   unguarded I/O sites inside `except BaseException:` before `raise`, including both rollback loops.
   *(Touches a shipped guarantee.)*
3. **The near-miss renderer never re-filters `max_delta == 0`** — a shipped test asserts a false count
   and must be fixed with it.
4. **The orchestrator catches only `SystemExit`** — CPython exits 1 when the truth is 2.
   `profiles.py`'s `main` establishes the pattern.
5. **`len(gaps)` / `len(orphans)` sit outside the `try`** in `_batch_finding_is_consumable`.
6. **`swap.py` bypasses its own shape-agnostic `clear()`** when removing backups.
7. **`emit_index` never clears a leftover staging sibling** before writing into it.
8. **The `.staged` suffix literal lives in two places** — `profiles.py` still hard-codes it.
9. **`bounded_check`'s docstring is missing the `pass-network-top5-pct` exclusion rationale.**
10. **`run_batch`'s docstring is missing Task 4.3's three-way match-id collision note.**
11. **`MANIFEST_VERSION` `1` → `2`** — RULED by Juan 2026-08-07. **Keep the `.get`.**
12. **Drop the `+` from the near-miss delta** — RULED by Juan 2026-08-07. **The batch summary quoted
    verbatim in Story 1.19's Dev Agent Record must be re-rendered in the same change**, or it stops
    matching the code.

**After applying: re-run the five phases and produce a fresh byte-identity proof.** Record the new
`code_version()` and supersede `ad4735a216e2` explicitly in 1.19's record and in the ledger — do not
leave two fingerprints presented as current.

**Environment (non-negotiable):**
- Use `./pipeline/venv/Scripts/python.exe`. System python has no pytest and no pymupdf.
- **Long pipeline runs get killed.** Chunk pytest by file/directory and resume the batch rather than
  restarting it. 1.19's own four-file run took 18m42s.
- Call BMad scripts as `python _bmad/scripts/...` — `uv run` fails in this environment.

**Also verify it does not regress AC 1:** a re-extract must reproduce the same emitted `/data`. If
any artifact byte changes, that is a finding, not a shrug — the twelve edits are meant to be
behaviour-preserving except items 1, 2, 3, 4 and 11/12's declared changes.

---

## Launch & Netlify (AC 4) — authorized

`netlify.toml` already ships and is correct:

```toml
[build]
  base = "app"
  command = "npm run build"
  publish = "out"
[build.environment]
  NETLIFY_NEXT_PLUGIN_SKIP = "true"
```

`npm run build` = `lint --max-warnings 0` → `typecheck` → `assert:schema-version` → `next build` →
`copy-data.mjs`. That is the AD-13 chain verbatim. `copy-data.mjs` copies the whole `data/` tree
(30 MB, 1,412 files) into `out/data` — including `data/fixtures/` (10 files), which is negligible and
needs no exclusion ruling.

**Preconditions before publishing:**
1. Green build chain end to end on the flipped tree.
2. **The Netlify account bandwidth model confirmed and logged** — legacy (100 GB/mo) or credit-based
   (~15 GB/mo effective). ARCHITECTURE-SPINE.md:235 defers this to deploy time by name; AR-17 lists
   it as a story-relevant deferred item. Record the budget math against an ~80 MB export.
   Documented fallbacks if it proves tight: Cloudflare Pages or GitHub Pages — a config move, not an
   architecture change.
3. `$0/month` verified, not assumed.
4. No functions, no middleware, no env-dependent behaviour, **no analytics or telemetry** (NFR-9,
   AD-13). The A3 origin-grep is the mechanical check.

**Publishing is AUTHORIZED (R4).** Report the live URL in the Dev Agent Record. `git push` needs
`gh auth switch -u juanrojasdp` or it 403s.

---

## Ruled Decisions

**D1 — Flip both `DATA_ROOT` constants in ONE commit, with the guard test in the same commit.**
A commit that flips one is a broken tree, and the guard test is what makes that unrepeatable.

**D2 — Fixture-pinned unit tests stay fixture-pinned.** Only tests asserting the *runtime* root or
deriving counts from fixture artifact sizes change. If you find yourself editing a `viz/*-model.test.ts`
to make it pass, stop — you have flipped something that should not have moved.

**D3 — Escape the expectation; do not stop substring-matching.** For A2, escape the expected value
(or parse the HTML) rather than rewriting the assertion style. The tests' value is that they compare
JSX values against exported bytes; a parse-based rewrite of four files is scope this story does not
need. One helper (`escapeForHtml`) covers all sites.

**D4 — Measure, then claim. Every AC 2 and AC 3 number goes in a table with its method.**
The house pattern is established and load-bearing: reproduce a published figure before trusting a
new one (2.14 did it for cyan, 2.16 for the result chips, 2.17 for the hatch). Do the same for
Lighthouse and for every reflow number.

**D5 — Lighthouse runs via `npx -y lighthouse@13.4.1` against the served export. Do NOT add it to
`app/package.json`.** Netlify runs `npm install` in `app/` on every build; a headless-Chrome
toolchain in `devDependencies` makes every deploy pay for a dev-machine gate. Registry availability
was confirmed at story creation (13.4.1). Pin the version in the record so the number is reproducible.

**D6 — axe runs the same way: `npx -y @axe-core/cli` against the served export, not as an
`app/` dependency.** `axe-core` is currently transitive-only via `eslint-plugin-jsx-a11y` and must
stay that way.

**D7 — R1's predicate relaxation admits `nodes === null` ONLY alongside a NON-EMPTY edge array.**
`[]` must keep failing closed — `pass-network-model.ts:336` throws on every unresolvable endpoint,
and 1.14's "emit `null`, never `[]`" binding exists because both directions fail. Add a test for
each of the three shapes: `(null, [23597 edges])` → renders; `([], [edges])` → closed; `(null, null)`
→ empty state.

**D8 — R2's three surfaces move in ONE change.** SiteHeader + Hero score row + `#key-stats`. Do not
land a partial fix; a tree where only one is narrowed still overflows and reads as done.

**D9 — The 320px Expert ToggleGroup fix is separate from R2 and lands regardless.** It is a true
320px reflow failure in both locales, inside AC 3's literal wording.

**D10 — Do not rebuild what 2.18 already fixed.** Read Partition D before touching
`TacticalErrorBoundary`, `MatchBundleRegion`, `GoalkeepingSection`'s denominators, or
`table-sort.ts`'s collator.

**D11 — The ledger is a deliverable, not a chore.** AC 5. Every one of the 66 blocks gets a
disposition. For Partition C entries, name the successor and the reason in the ledger itself — "the
first Epic 3 story that…" is acceptable; silence is not. For Partition D, append the correction
(especially the defensive-actions density figure, which has now been carried forward three times
against emitted data that does not support it).

**D12 — Append to the ledger; do not rewrite other stories' paragraphs.** House rule since 2.9.
Corrections go in as appended corrections that name what they correct.

**D13 — Commit your own slices early.** A concurrent session's sweeping `git add` has captured
in-progress work under another story's message twice in this project (2.14 → 2.15, 1.14 → 2.6). If
`app/` looks dirty in ways you did not cause, verify in an isolated worktree on a private port
before believing a red gate.

**D14 — Do not use PowerShell `Get-Content`/`Set-Content` round-trips on any file containing
accents or em dashes.** PS 5.1 mangles them. Use the edit tools. Scripted Python edits must open in
binary mode or a one-line change commits as a whole-file CRLF rewrite.

---

## Tasks / Subtasks

### Task 1 — Baseline and harness (BLOCKING; all AC)
- [x] 1.1 Confirm `main` at `7f28e44`, tree clean, in sync. Confirm no concurrent session holds `app/`.
- [x] 1.2 Build and serve the CURRENT (fixture) export; record the pre-flip baseline: test count, build time, `out/` size.
- [x] 1.3 Stand up the CDP harness (`app/scripts/` is production — put it in a scratch dir or a clearly-marked dev script). Reproduce the three proof tables in *The measurement harness* before trusting any new number (D4).
- [x] 1.4 Confirm `npx -y lighthouse@13.4.1` and `npx -y @axe-core/cli` run against the served export.

### Task 2 — The cutover (AC 1; D1, D2)
- [x] 2.1 Flip `build-data.ts:26` and `data.ts:7`. **`git diff` and confirm the CONSTANTS moved, not the doc comments.** Update the comments as a separate edit.
- [x] 2.2 Add the two-constant guard test (D1). Prove it fails when either is reverted alone.
- [x] 2.3 Fix `tournament-index.test.ts:80`'s literal.
- [x] 2.4 Fix `i18n.test.ts`'s caption inventory: the `27`/`27`/`28` literals and the 3→36 board count; retire `viz.pressing.{metres,metre.*,metreNote,metreTableCaption}`, `viz.table.measure`, `enums.unit.m` together (A12).
- [x] 2.5 A2: escape the expectations in `app/src/app/matches/static-output.test.ts` (`:61,79-80,105`) via one helper (D3). Verify against the four `Côte d'Ivoire` matches.
- [x] 2.6 Add the `data/*.staged/` directory-skip to `assert-schema-version.mjs` (A9) and rule the corpus-rewalk question (A10).
- [x] 2.7 Full build + full suite green on the flipped tree. Record: routes generated, `out/` size, wall clock.

### Task 3 — R1: the pass-network re-scope (AC 1; D7)
- [ ] 3.1 Relax `tactical-sections.ts:124-125` so non-empty edges render without nodes. Update `tactical-sections.test.ts:193-199`.
- [ ] 3.2 `PassNetworksSection`: render the sortable pass-matrix table (UX-DR16) when nodes are absent; suppress the figure. No new locale keys if an existing empty/partial string covers it — check before minting.
- [ ] 3.3 Three-shape test per D7.
- [ ] 3.4 Verify live on ≥3 real matches at 390px and 1920px, both locales.

### Task 4 — Real-data verification at scale (AC 1)
- [ ] 4.1 Route bijection: 104 match + 1,248 player + 48 team routes pre-rendered, exactly the manifest (A4, A6, A11).
- [ ] 4.2 All 48 `/teams/` slugs resolve; no dead links from standings, `MatchHero`, leaderboards, header search or `/players/{slug}` (A6). Repoint the two remaining route literals (A28); verify `prefetch={false}` holds.
- [ ] 4.3 **SM-3 spot-check: shot maps vs source PDFs on ≥10 matches.** Sample across venues and matchday rounds, not the first ten. Record match ids and what was compared.
- [ ] 4.4 Verify the section census in *Real-data reality* renders as described: `#shot-maps` (no cross map), `#defensive-actions` empty, `#offers-*` populated, `#goalkeeping` gates closed with `gateNote` (A32).
- [ ] 4.5 Browser accent-insensitivity on real data (A5) — `Türkiye`, `Curaçao`, `Côte d'Ivoire`, plus the reader typing `Nunez`/`Núñez`, `Quinones`/`Quiñones`.
- [ ] 4.6 Record the real-data collation result from Partition D; change no code.
- [ ] 4.7 Run `domain-g-zone-sum` over the real player profiles as an acceptance gate (A25).

### Task 5 — AC 2: budgets
- [ ] 5.1 Re-verify and record the payload table (already measured — reproduce it).
- [ ] 5.2 Lighthouse mobile on **Match Dashboard** and **Tournament Hub** against the served production export. ≥90. Record all five category scores and the Lighthouse version.
- [ ] 5.3 Lighthouse on `/compare` (A31); file the AD-4 route-payload amendment or record the documented gap.
- [ ] 5.4 If tuning is needed: **disclosure, never deletion** (SM-C2). Declare any change.
- [ ] 5.5 A16: memoise the `columns` construction; A19: memoise the profile reads.
- [ ] 5.6 A30: rule the header-search payload question with the measured 39,137 B (see Open questions Q1).

### Task 6 — AC 3: the accessibility floor
- [ ] 6.1 **Reflow matrix**: 320 / 390 / 195 CSS px × {dark, light} × {es, en} × 8 routes. Report the table and the offending selectors.
- [ ] 6.2 **R2/D8**: fix SiteHeader + Hero score row + `#key-stats` as one change. Declare any type-ramp departure.
- [ ] 6.3 **D9**: `flex-wrap` (or shorter EN labels) on the Expert `<md` column-group ToggleGroup; verify 320 both locales and 390 EN.
- [ ] 6.4 `prefers-reduced-motion: reduce` under real media emulation — confirm zero animation on every route.
- [ ] 6.5 Focus visible everywhere; `focus-ring-on-pitch` on pitch in **both** themes.
- [ ] 6.6 Keyboard-only traversal of UJ-1..4 end to end. Note: a real Tab key has never been delivered by this project's automation — use CDP `Input.dispatchKeyEvent` and say so if it still fails.
- [ ] 6.7 Every viz has its reachable data-table alternative (now includes R1's matrix table).
- [ ] 6.8 A24: axe over all 8 routes, both themes, both locales. Triage every violation.
- [ ] 6.9 A17: `rowHeader` across the four log tables with a fallback for the gated player column.
- [ ] 6.10 A26: announce re-collation on locale change in `DataTable`.
- [ ] 6.11 A8: verify the `/compare` `<md` sticky mini-header's `IntersectionObserver` renames on scroll, using `data-compare-showing` / `data-compare-side`.
- [ ] 6.12 A23: disambiguate `/compare` captions — reachable via `Emiliano MARTINEZ`. Six shipped captions plus two figure headings.
- [ ] 6.13 Spanish screen-reader spot-check resolving the `lang="en"` span decisions.
- [ ] 6.14 A3: origin-grep script wired into the build chain; zero external requests.
- [ ] 6.15 A27: record the Hub sticky-header premise check at real row counts.

### Task 7 — The remaining App-side ledger items
- [ ] 7.1 A13: re-present `shapeByPhase` on `#pressing` using 2.16's `team.shape.*` vocabulary.
- [ ] 7.2 A14: re-open the involvement tick model against `momentumTickIndices` now that `stoppageMinute` exists.
- [ ] 7.3 A15: honest per-team key (`teamId`); move the `" / "` composition into the locale layer.
- [ ] 7.4 A18: rename `#lideres` → English slug; update every link.
- [ ] 7.5 A20: centre the `InvolvementChart` hatch at `HATCH_TILE_PX / 2`.
- [ ] 7.6 A29: mirror the goal furniture at the defending end (**re-verify 2.8's pass-network figures afterwards**). See Open questions Q2 before starting.
- [ ] 7.7 A21: DESIGN.md absorbs 9.20 / 4.68. A22: reconcile EXPERIENCE.md's full-width/full-screen rows to one wording.

### Task 8 — R3: the pipeline batch
- [ ] 8.1 Apply all twelve edits (`./pipeline/venv/Scripts/python.exe`; chunk everything).
- [ ] 8.2 Re-render the batch summary quoted verbatim in 1.19's Dev Agent Record (item 12).
- [ ] 8.3 Re-run the five phases. Chunk; resume rather than restart.
- [ ] 8.4 Fresh byte-identity proof. Record the new `code_version()` and supersede `ad4735a216e2` in 1.19's record and the ledger.
- [ ] 8.5 Confirm the re-extract reproduces the emitted `/data` byte-for-byte. Any change is a finding.
- [ ] 8.6 Chunked pytest across all pipeline test files.

### Task 9 — AC 4: launch
- [ ] 9.1 Green build chain end to end.
- [ ] 9.2 Confirm and **log** the Netlify account bandwidth model; record the budget math against the export size.
- [ ] 9.3 Verify $0/month; no functions, middleware, env, analytics.
- [ ] 9.4 Connect and publish (**authorized — R4**). `gh auth switch -u juanrojasdp` before pushing.
- [ ] 9.5 Verify the live site: all routes, both locales, both themes, real data served from the same origin.
- [ ] 9.6 Record the live URL. Confirm repo + URL are publishable as the portfolio piece (SM-6).

### Task 10 — AC 5: close the ledger, and close the project
- [ ] 10.1 Walk all 66 blocks. Give each a disposition (D11).
- [ ] 10.2 Append the Partition D corrections — **especially the defensive-actions density figure**, now carried forward three times against emitted data that does not support it.
- [ ] 10.3 Name a successor and a reason for every Partition C entry.
- [ ] 10.4 Record the answers to whatever remains in *Open questions for Juan*.
- [ ] 10.5 Update `sprint-status.yaml`; `2-19` → `review`. Note `epic-2-retrospective: optional`.
- [ ] 10.6 Commit your own slices as you go (D13). Commit directly to `main` — no branches, no PRs.

---

## Testing Requirements

- **App:** `cd app && npm test` (vitest, 45 test files). Baseline at 2.17 close was ~1,060+ tests
  green. The `assert-schema-version` tests carry an explicit `20_000` ms budget (raised by 2.14);
  they walk 1,411 real artifacts in ~1,659 ms.
- **Gates:** `npm run build` = lint (`--max-warnings 0`) → typecheck → schema-assert → `next build`
  → `copy-data`. All four must be green before any AC 2/3/4 measurement is trusted.
- **Pipeline:** `./pipeline/venv/Scripts/python.exe -m pytest`, **chunked**. 48 test files.
- **New tests owed:** the two-constant `DATA_ROOT` guard (D1); R1's three-shape predicate test (D7);
  whatever pins the reflow fix so R2 cannot silently regress.
- **A skip is how a missing input comes to read as a pass.** 1.19's review found exactly that. Report
  skip counts, not just pass counts.

---

## Project Structure & Scope boundaries

**In scope:** `app/src/**`, `app/scripts/**`, `pipeline/**` (R3 only), `data/**` (regenerated by the
re-extract only), `netlify.toml`, `_bmad-output/implementation-artifacts/deferred-work.md`,
`_bmad-output/implementation-artifacts/sprint-status.yaml`, and the two doc edits A21/A22 in
`DESIGN.md` / `EXPERIENCE.md`.

**Out of scope:** `/contract` (no AD-14 change request is filed by this story; the heatmap and the
Domain D emission blockers ride the successor change-set), new routes, new features, the Partition C
list.

**Conventions that bind:** AR-7 (artifacts raw and locale-neutral; all formatting in the locale
layer), AD-5 (no App-side aggregation), AD-10 (URL + localStorage + ephemeral state only), AD-11
(build-time filesystem reads for static params/meta/Hero; client fetch below the Hero), AD-12 (all
strings through `t()`; ESLint enforces), AR-15 stack pins (Node 24, Next 16.2.x, React 19.2,
TypeScript 6.0.x, Tailwind 4.3.x, recharts 3.x).

---

## Open questions for Juan — non-blocking, answer during implementation

**Q1 — The header-search payload.** On four of five routes the header lazily fetches
`tournament.json` on first engagement: **39,137 B gzip / 409,524 B raw**, once per page load, never
on load. Is that right on a match route, or does the `entities` slice (29,758 B gzip) or a projected
corpus earn a contract change? Ledger L2890. *(Recommendation: accept — it is 8% of the route budget
and only on engagement.)*

**Q2 — A29, the mirrored goal furniture.** Ruled YES by 2.9 decision 9, implementation routed to
"…or 2.19". It is the last story, so re-deferring means never. But it is viz work in a hardening
story and it visibly changes 2.8's shipped pass-network figures. Take it, or close the ruling as
WONTFIX with the reason recorded?

**Q3 — `<title>`/OG stay Spanish after an EN toggle.** Filed three times, owner "Juan", never ruled;
2.12 took it de facto for `/`. **NFR-4 forces the question here**, at 104 + 1,248 + 48 + Hub routes.
Options: accept ES canonical for a static export (zero work), or sync `document.title` client-side.
Ledger L147, L2697, L3227.

**Q4 — Copy rulings, all cheap, all optional.** (a) ~25 per-table announcement identifiers (L1246);
(b) the two-stacked-parentheticals head composition (L2335); (c) glossary marks on the five Tactical
summaries and the leaderboards surface (L962, L2347). Take any, all, or none — say which.

---

## References

- Story spec: `_bmad-output/planning-artifacts/epics.md:1004`
- Requirements: FR-33, FR-34; NFR-1, NFR-2, NFR-4, NFR-8, NFR-9, NFR-10; SM-3, SM-4, SM-5, SM-6, SM-C2 — `epics.md:97-130`, `prds/prd-wc-stats-2026-07-21/prd.md:382,443-452`
- AD-13 (deployment & gates): `architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md:118-122`
- Netlify account model deferred by name: `ARCHITECTURE-SPINE.md:235`; AR-17
- UX-DR16 (accessibility floor): `epics.md:119`; UX-DR2, UX-DR12, UX-DR15, UX-DR17: `epics.md:105-121`
- UJ-1..4: `ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md:143-190`; 15-second hero test: `EXPERIENCE.md:199`
- Budgets: `EXPERIENCE.md:22`; SM-C2 depth preservation: `EXPERIENCE.md:197`
- The ledger: `_bmad-output/implementation-artifacts/deferred-work.md` (66 blocks; line numbers as of `7f28e44`)
- Story 1.19 §Review Findings — the twelve pipeline edits, per-item evidence
- Cutover points: `app/src/lib/build-data.ts:26`, `app/src/lib/data.ts:7`
- Build chain: `app/package.json`, `app/scripts/copy-data.mjs`, `app/scripts/assert-schema-version.mjs`, `netlify.toml`

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

#### Task 1 — baseline and harness

**Pre-flip baseline (fixtures), commit `7f28e44`:**

| | measured |
|---|---|
| app suite | 45 files / **1238 tests** / **0 skipped** / 19.06 s |
| `npm run build` | exit 0, **81 s** |
| `out/` | 34 MB apparent, 1,565 files, 14 HTML routes |
| `out/data` | 30 MB, 1,412 files (the real corpus already shipped pre-flip — `copy-data.mjs` copies the whole `data/` tree regardless of `DATA_ROOT`) |

**The CDP harness reproduces all three proof tables** (`scratchpad/cdp.mjs` + `proof.mjs`, Chrome
151.0.7922.77, Node 24.15.0 global `WebSocket`, zero dependencies):

| emulated width | `documentElement.clientWidth` | `window.innerWidth` | `body.scrollWidth` | overflowing |
|---|---|---|---|---|
| 320 | **320** | 400 | 400 | 1 |
| 390 | **390** | 400 | 400 | 1 |
| 195 | **195** | 400 | 400 | 1 |

| capability | result |
|---|---|
| `prefers-reduced-motion: reduce` under emulation | **true** (and `false` under `no-preference`) |
| `prefers-color-scheme: light` / `dark` under emulation | **true** / **true** respectively |
| `IntersectionObserver` across a scroll | **fires** — `[false]` → `[false, true]` |

The `innerWidth` = 400 gotcha reproduced exactly at all three widths, confirming the story's rule to
assert on `documentElement.clientWidth`.

> **ONE CORRECTION TO THE HARNESS RECIPE, and it is the difference between a working reflow gate and
> a silent one.** `Emulation.setDeviceMetricsOverride` with `mobile: true` only produces the
> requested layout viewport if the document carries `<meta name="viewport">`. Without one Chrome
> falls back to the legacy **980 px** layout viewport, and the first run of the proof measured
> `clientWidth` = 980 at 320, 390 **and** 195 with **zero** overflowing elements — a harness that
> reports every page as passing. The real app ships the meta tag (Next's default metadata), so this
> only bites synthetic probe pages, but any future probe page must include it.

**Gate availability (D5, D6):** `npx -y lighthouse@13.4.1` and `npx -y @axe-core/cli` (axe-core
4.12.1) both run against the served export. Two invocation facts worth recording:

- **Lighthouse exits 1 on Windows even on a fully successful run.** The JSON report is written and
  complete; `chrome-launcher`'s `destroyTmp` then fails with `EPERM` removing its own temp profile
  and that becomes the process exit code. Read the report, do not trust the exit status.
- axe's CLI exits 1 when it finds violations (correct), and `--save` needs a filename relative to
  cwd. A smoke run on `/about` already surfaced 2 real `link-in-text-block` violations — carried into
  Task 6.8 rather than fixed here.

#### Task 2 — the cutover

**The flip landed on the constants, not the doc comments** (the failure mode the story warns about):
`git diff -U0` reported exactly `build-data.ts` line 26 and `data.ts` line 7. Comments updated
afterwards as a separate edit.

**The guard test (D1) was proven red in both directions**, by actually reverting each constant alone
rather than only by table-driven cases:

| tree state | `data-root-agreement.test.ts` |
|---|---|
| both flipped (shipped) | 8 passed |
| `data.ts` reverted alone | **2 failed** / 6 passed |
| `build-data.ts` reverted alone | **2 failed** / 6 passed |

**Post-flip build and suite:**

| | measured | pre-flip |
|---|---|---|
| `npm run build` | exit 0, **91 s** | 81 s |
| pages generated | **1406** (104 match + 1,248 player + 48 team + 6 static) | 13 |
| `assert-schema-version` | **1,411 artifacts** at schemaVersion 4 | 1,411 |
| app suite | 46 files / **1251 tests** / **0 skipped** | 45 / 1238 / 0 |
| `out/` true size | **109.6 MB**, 14,102 files | — |
| `out/` HTML | 35.0 MB / 1,407 files (avg 26,094 B) | — |
| `out/` RSC `.txt` payloads | 46.2 MB / 11,234 files (avg 4,316 B) | — |
| `out/data` | 26.4 MB / 1,411 artifacts | 26.4 MB |
| one player HTML (`bellingham-jude-eng`) | **23,619 B** | 23,328 B at 2.15 |

`du -sh` reports 149 MB for this tree; that is cluster slack over 14,102 mostly-small files, not
bytes. The 109.6 MB figure is the sum of actual file sizes and is the one the AC 4 bandwidth math
uses. The player-HTML figure re-confirms the AD-11 projection at +291 B against 2.15's measurement.

### Completion Notes List

**Task 1 — baseline and harness.** Baseline captured, CDP harness built and validated against all
three story-creation proof tables, both `npx` gates confirmed. The viewport blocker is genuinely
solved: real 320/390/195 CSS px layout viewports, working media emulation, and a firing
`IntersectionObserver`.

**Task 2 — the DATA_ROOT cutover.** Both constants flipped in one change with the guard test beside
them (D1), and the whole tree is green on real data: 1406 routes, 1251 tests, 0 skipped.

Four things the story did not predict, each recorded because each was a real defect rather than a
mechanical rename:

1. ✅ **`build-data` was a SECOND, undocumented fixture-pinning channel.** D2's list of tests to
   leave alone names the ones that read fixtures *by relative path*. But `match-hero.test.ts` and
   `tactical-sections.test.ts` pinned themselves through `readMatchBundle`, so the flip silently
   repointed both at the real corpus. `tactical-sections.test.ts` went red honestly (the real bundles
   carry four null event tables). `match-hero.test.ts` **stayed green by coincidence** — m001 and
   m074 exist in both corpora with the same ids — which is the worse outcome of the two. Both now
   read by relative path like the `viz/*-model.test.ts` family, so D2's intent actually holds.
2. ✅ **A2 confirmed exactly as measured.** `Côte d'Ivoire` → `Côte d&#x27;Ivoire` was the only
   escape needed anywhere, and only one assertion site in the whole suite substring-matches a
   corpus-derived name into exported HTML. `escapeForHtml` (React's own five replacements, in
   React's order) covers it; the assertion style is unchanged, per D3.
3. ✅ **m074 lost its own goal at the cutover, and the AD-6 assertion was re-anchored rather than
   deleted.** The 1.1 fixture invented a Gustavo GOMEZ own goal at 5′ to exercise benefiting-team
   attribution; real m074 is Enciso 42′ / Havertz 54′ with no own goal. The real corpus carries **14
   own goals across 14 matches**, so the export-level AD-6 check moved to **m004-usa-paraguay**
   (Damian BOBADILLA, a Paraguay player, 7′, benefiting USA). m074's shoot-out and knockout
   assertions survived verbatim. m001's goal minutes also moved by exactly +1 each (8′→9′, 66′→67′)
   with scoreline and scorers unchanged.
4. ✅ **The Hub's export test was checking 3 boards of 36.** `static-output.test.ts` drove its
   "renders EVERY board" loop off the *fixture* leaderboards while asserting against the *exported*
   page — 8% coverage, silently. It now reads the shipped artifact with a `>= 36` floor. This is not
   a D2 violation: D2 pins fixture-pinned **unit** tests, and every assertion in that file reads
   `out/`. The two other fixture facts in it were re-anchored to the real corpus, and the
   payload-inlining guard got stronger by it — its witness is now one of **676** entities that
   appear in a board but in no teaser, against the fixture's single rank-20 witness.

**A12 was already three-quarters discharged and one quarter of it was wrong.** Verified rather than
assumed: the `viz.pressing.metre*` family is already retired from both locales and the caption counts
already read 26/26/27 (Story 2.17's review did this). The 3→36 board count does **not** break
`i18n.test.ts` — that inventory reads the fixture by relative path and is deliberately fixture-pinned
(D2), and it stayed green. `viz.table.measure` **was** a live orphan with zero consumers and no
dynamic-key path, and is now retired in both locales. **`enums.unit.m` must NOT be retired** — A12
lists it for removal, but it is live on five components (`CompareChartsSection`, `ExpertLayer`,
`PhysicalSection`, `PlayerMatchesSection`, `TeamIdentitySection`) and via `leaderboard-format.ts`.

**A9 (staging siblings) and A10 (corpus re-walk) both closed.** `assert-schema-version.mjs` now skips
any directory whose name ends `.staged` or `.previous.rollback`, at any depth — a name-suffix rule
rather than a path list, because the siblings exist at both `data/` and `data/index/` level and
`profiles.py` derives its own per-kind names. The file-level shapes (`tournament.json.staged`) never
entered the walk, since they do not end in `.json`. Three tests pin it: two skip cases and a control
proving the same tampered bytes still fail in an ordinary directory.

**A10 — RULED: yes, a unit-test run re-walks the whole corpus.** ~8.5 s of a ~20 s suite, walking
1,411 artifacts. Kept because the gate is the only thing between a schema drift and a published site,
`npm test` is where it can fail in seconds rather than after a 91 s build, and sampling would test
something other than what ships. Recorded that this cost is **not** new at the cutover: `DATA_DIR`
resolves to `<repo>/data` independent of `DATA_ROOT`, so the gate always walked the real corpus — the
test's name ("passes on the current fixture tree") was wrong before the flip, and is now corrected.

### File List

---

## Change Log

| Date | Change |
|---|---|
| 2026-08-09 | Story context created. Ledger swept: 66 blocks partitioned (32 implement / 6 rulings / 9 re-defer / 7 already-closed). Viewport blocker solved and proven. Real-data census, payload budgets, collation and name-escaping measured at creation. R1–R4 ruled by Juan. Status → ready-for-dev. |

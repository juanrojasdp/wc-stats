---
baseline_commit: 7f28e44
---

# Story 2.19: Performance & Accessibility Hardening, Real-Data Swap & Launch

Status: review

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

**D15 — Q5 RULED by Juan (2026-08-25): OPTION 3. Take SM-C2 on the Tournament Hub AND pull
L1504 back out of Partition C.** Both gated routes go for Lighthouse >= 90; AC 2 is met, not
documented-as-partial. Consequences, all of them deliberate:
- The Hub's 12 group standings and 9 results sections move **behind disclosure, never deleted**
  (SM-C2). This is a visible change to Story 2.12's ruled arrival state and must be declared in the
  Dev Agent Record with before/after screenshots at 390 px and 1920 px, both locales.
- **L1504 returns to Partition A.** It is no longer re-deferred. The Match Dashboard's 1,141 ms of
  script evaluation against a 461 KiB route (43 KiB unused JS) is the target: eagerly-constructed
  section content plus the app bundle. Bundle/code-split work is IN SCOPE for this story.
- **A16's `columns` memoisation (5.5) is now IN**, since the ruling that made it conditional has
  landed on the side that wants the execution win.
- Re-measure the way D4 requires: median of 3, mobile, 13.4.1, against the gzip/keep-alive
  host-realistic server — never `python -m http.server`, never a single run.
- Task 10.3 now names one fewer Partition C entry; Task 10.1's disposition for L1504 is
  "implemented here", not "re-deferred".
*Recorded dissent, for the record only:* the story's own recommendation was option 1 or 2, on the
grounds that option 3 re-opens an architectural item in the final story. Juan ruled option 3 with
that argument in front of him. Build it.

**D16 — Q2 RULED by Juan (2026-08-25): TAKE A29.** The mirrored goal furniture at the defending
end ships in Task 7.6. 2.9 decision 9 ruled it YES and this is the last story, so deferring means
never. **Re-verify 2.8's shipped pass-network figures after the change** — it visibly alters them,
and that re-verification is part of 7.6, not optional follow-up.

**D17 — Q3 RULED by Juan (2026-08-25): ACCEPT ES CANONICAL.** `<title>` and OG tags stay Spanish
after an EN toggle, across all 104 + 1,248 + 48 + Hub routes. Zero work. This is the ruled
disposition for ledger L147, L2697, L3227 — close all three as ACCEPTED (not re-deferred, not
WONTFIX-without-reason) in Task 10.1, recording that a static export has one canonical document
language and the UI toggle does not change it.

**D19 — AC 2's LIGHTHOUSE FLOOR: RULED by Juan (2026-08-25) — ACCEPT AND RECORD THE GAP.**
The two gated routes finish at **88 (86–91)** and **86 (84–94)**, medians of 5, against a floor of
90. NFR-1 is therefore **partially met, and is said to be** — the shortfall, its cause and its size
are recorded here rather than rounded away, which is what 5.9 asked for when it said not to silently
accept a miss. What the ruling accepts, and what it does not:

- **AC 2's payload half passes with 4× margin** and is unaffected: 114.9 KB against a 500 KB cap on
  the heaviest route.
- Every other Lighthouse category is **at or above** its floor, and one moved to full marks during
  this story: **accessibility 96 → 100 on all five routes**, best practices 96, SEO 100, CLS 0.000.
- **TBT fell 368 → 102 ms and 674 → 134 ms**, and the performance scores moved 83 → 88 and 68 → 86.
- The remaining gap is **structural, not slack**. The Hub's LCP element is `h2#standings`, inside
  the AD-11 client-fetched region; the settled region is 4,496 px, so the `min-h-[120vh]`
  reservation cannot be reduced to bring the static teasers above the fold without reintroducing the
  CLS Task 5.4 removed. Closing it requires an AD-11 exception, which Juan declined in the final
  story — the same shape of trade D15 took the other way, and taken the other way here deliberately.
- **The measurement's spread is larger than the gap** and that is part of the record, not an excuse:
  `benchmarkIndex` varies 1,074–2,510 on this machine and one unchanged page's observed first paint
  varied 227 ms → 2,198 ms inside a single batch. Both routes' BEST runs (91 and 94) clear the
  floor. The medians are what is reported.

*Recorded for the successor:* the one lever not taken is pre-rendering the standings shell into the
export. It is an AD-11 change, not a tuning change, and it is the only thing that moves this number.

> **⚠️ MEASURED AGAIN ON THE LIVE HOST AFTER THIS RULING, AND THE GATE PASSES.** D19 was ruled
> against the LOCAL harness (88 / 86). Against production — Lighthouse 13.4.1, mobile, median of 5 —
> the two gated routes read **90 (70–92)** and **92 (46–94)**, and an independent median-of-3 batch
> read 94 and 90, so it reproduces. Every route is at or above 89 and `/compare` is 98.
>
> **The difference is not new work on the site.** A local server, even one that compresses correctly,
> sends a real `content-length`, keeps connections alive and mirrors the host's cache-control, does
> not model a CDN edge — TLS session reuse, HTTP/2 multiplexing and origin proximity are all absent.
> LCP is where it shows: 3.7 s / 3.8 s locally against 2.2 s / 3.2 s on the host.
>
> **AC 2 is therefore MET as deployed.** D19's text is left exactly as ruled rather than rewritten,
> because it was a correct ruling on the evidence it had; this note supersedes its CONCLUSION, not
> its reasoning. What survives from it unchanged is the successor filing: pre-rendering the standings
> shell is still the only structural lever on the Hub's LCP, and it is still an AD-11 exception.
> Juan has the final call on whether NFR-1 now reads "met" or "met on the host, partially met on the
> reference harness" — the numbers for both are recorded above.

**D18 — Q4 RULED by Juan (2026-08-25): TAKE ALL THREE COPY ITEMS.** (a) the ~25 per-table
announcement identifiers (L1246); (b) the two-stacked-parentheticals head composition (L2335);
(c) glossary marks on the five Tactical summaries and the leaderboards surface (L962, L2347).
All three are cheap; (a) belongs with Task 6's a11y work, (b) and (c) with Task 7.

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
- [x] 3.1 Relax `tactical-sections.ts:124-125` so non-empty edges render without nodes. Update `tactical-sections.test.ts:193-199`.
- [x] 3.2 `PassNetworksSection`: render the sortable pass-matrix table (UX-DR16) when nodes are absent; suppress the figure. No new locale keys if an existing empty/partial string covers it — check before minting.
- [x] 3.3 Three-shape test per D7.
- [x] 3.4 Verify live on ≥3 real matches at 390px and 1920px, both locales.

### Task 4 — Real-data verification at scale (AC 1)
- [x] 4.1 Route bijection: 104 match + 1,248 player + 48 team routes pre-rendered, exactly the manifest (A4, A6, A11).
- [x] 4.2 All 48 `/teams/` slugs resolve; no dead links from standings, `MatchHero`, leaderboards, header search or `/players/{slug}` (A6). Repoint the two remaining route literals (A28); verify `prefetch={false}` holds.
- [x] 4.3 **SM-3 spot-check: shot maps vs source PDFs on ≥10 matches.** Sample across venues and matchday rounds, not the first ten. Record match ids and what was compared.
- [x] 4.4 Verify the section census in *Real-data reality* renders as described: `#shot-maps` (no cross map), `#defensive-actions` empty, `#offers-*` populated, `#goalkeeping` gates closed with `gateNote` (A32).
- [x] 4.5 Browser accent-insensitivity on real data (A5) — `Türkiye`, `Curaçao`, `Côte d'Ivoire`, plus the reader typing `Nunez`/`Núñez`, `Quinones`/`Quiñones`.
- [x] 4.6 Record the real-data collation result from Partition D; change no code.
- [x] 4.7 Run `domain-g-zone-sum` over the real player profiles as an acceptance gate (A25).

### Task 5 — AC 2: budgets
- [x] 5.1 Re-verify and record the payload table (already measured — reproduce it).
- [x] 5.2 Lighthouse mobile on **Match Dashboard** and **Tournament Hub** against the served production export. ≥90. Record all five category scores and the Lighthouse version. — **measured; gate NOT met, see the record and Q5**
- [x] 5.3 Lighthouse on `/compare` (A31); file the AD-4 route-payload amendment or record the documented gap.
- [x] 5.4 If tuning is needed: **disclosure, never deletion** (SM-C2). Declare any change. — **CLS fix landed; the Hub disclosure restructuring shipped in 5.7**
- [x] 5.5 A16: memoise the `columns` construction; A19: memoise the profile reads. — **A19 done; A16 superseded — see the record**
- [x] 5.6 A30: rule the header-search payload question with the measured 39,137 B (see Open questions Q1).
- [x] 5.7 **D15 / SM-C2 on the Tournament Hub**: move the 12 group standings and the 9 results
  sections behind disclosure (never deleted). Declare the change with before/after at 390 px and
  1920 px, both locales, against Story 2.12's ruled arrival state. Re-measure per D4.
- [x] 5.8 **D15 / L1504 — back in scope.** Match Dashboard: 1,141 ms script evaluation, 461 KiB
  route, 43 KiB unused JS. Attack the eagerly-constructed section content and the app bundle
  (code-split). Target >= 90 on both gated routes. Record what moved and by how much.
- [x] 5.9 Final Lighthouse table for all five routes, median of 3, mobile, 13.4.1, host-realistic
  server. AC 2 is met or the gap is re-ruled — do not silently accept a miss after D15.

### Task 6 — AC 3: the accessibility floor
- [x] 6.1 **Reflow matrix**: 320 / 390 / 195 CSS px × {dark, light} × {es, en} × 8 routes. Report the table and the offending selectors.
- [x] 6.2 **R2/D8**: fix SiteHeader + Hero score row + `#key-stats` as one change. Declare any type-ramp departure.
- [x] 6.3 **D9**: `flex-wrap` (or shorter EN labels) on the Expert `<md` column-group ToggleGroup; verify 320 both locales and 390 EN.
- [x] 6.4 `prefers-reduced-motion: reduce` under real media emulation — confirm zero animation on every route.
- [x] 6.5 Focus visible everywhere; `focus-ring-on-pitch` on pitch in **both** themes.
- [x] 6.6 Keyboard-only traversal of UJ-1..4 end to end. Note: a real Tab key has never been delivered by this project's automation — use CDP `Input.dispatchKeyEvent` and say so if it still fails.
- [x] 6.7 Every viz has its reachable data-table alternative (now includes R1's matrix table).
- [x] 6.8 A24: axe over all 8 routes, both themes, both locales. Triage every violation.
- [x] 6.9 A17: `rowHeader` across the four log tables with a fallback for the gated player column.
- [x] 6.10 A26: announce re-collation on locale change in `DataTable`.
- [x] 6.11 A8: verify the `/compare` `<md` sticky mini-header's `IntersectionObserver` renames on scroll, using `data-compare-showing` / `data-compare-side`.
- [x] 6.12 A23: disambiguate `/compare` captions — reachable via `Emiliano MARTINEZ`. Six shipped captions plus two figure headings.
- [x] 6.13 Spanish screen-reader spot-check resolving the `lang="en"` span decisions.
- [x] 6.14 A3: origin-grep script wired into the build chain; zero external requests.
- [x] 6.15 A27: record the Hub sticky-header premise check at real row counts.
- [x] 6.16 **D18(a)**: the ~25 per-table announcement identifiers (L1246).

### Task 7 — The remaining App-side ledger items
- [x] 7.1 A13: re-present `shapeByPhase` on `#pressing` using 2.16's `team.shape.*` vocabulary.
- [x] 7.2 A14: re-open the involvement tick model against `momentumTickIndices` now that `stoppageMinute` exists.
- [x] 7.3 A15: honest per-team key (`teamId`); move the `" / "` composition into the locale layer.
- [x] 7.4 A18: rename `#lideres` → English slug; update every link.
- [x] 7.5 A20: centre the `InvolvementChart` hatch at `HATCH_TILE_PX / 2`.
- [x] 7.6 A29: mirror the goal furniture at the defending end (**re-verify 2.8's pass-network figures afterwards**). **RULED IN by D16** — the re-verification is part of this subtask, not follow-up.
- [x] 7.7 A21: DESIGN.md absorbs 9.20 / 4.68. A22: reconcile EXPERIENCE.md's full-width/full-screen rows to one wording.
- [x] 7.8 **D18(b)**: the two-stacked-parentheticals head composition (L2335).
- [x] 7.9 **D18(c)**: glossary marks on the five Tactical summaries and the leaderboards surface
  (L962, L2347).

### Task 8 — R3: the pipeline batch
- [x] 8.1 Apply all twelve edits (`./pipeline/venv/Scripts/python.exe`; chunk everything).
- [x] 8.2 Re-render the batch summary quoted verbatim in 1.19's Dev Agent Record (item 12).
- [x] 8.3 Re-run the five phases. Chunk; resume rather than restart.
- [x] 8.4 Fresh byte-identity proof. Record the new `code_version()` and supersede `ad4735a216e2` in 1.19's record and the ledger.
- [x] 8.5 Confirm the re-extract reproduces the emitted `/data` byte-for-byte. Any change is a finding.
- [x] 8.6 Chunked pytest across all pipeline test files.

### Task 9 — AC 4: launch
- [x] 9.1 Green build chain end to end.
- [x] 9.2 Confirm and **log** the Netlify account bandwidth model; record the budget math against the export size.
- [x] 9.3 Verify $0/month; no functions, middleware, env, analytics.
- [x] 9.4 Connect and publish (**authorized — R4**). `gh auth switch -u juanrojasdp` before pushing.
- [x] 9.5 Verify the live site: all routes, both locales, both themes, real data served from the same origin.
- [x] 9.6 Record the live URL. Confirm repo + URL are publishable as the portfolio piece (SM-6).

### Task 10 — AC 5: close the ledger, and close the project
- [x] 10.1 Walk all 66 blocks. Give each a disposition (D11).
- [x] 10.2 Append the Partition D corrections — **especially the defensive-actions density figure**, now carried forward three times against emitted data that does not support it.
- [x] 10.3 Name a successor and a reason for every Partition C entry. **L1504 is no longer among
  them (D15) — its disposition is "implemented here".** L147 / L2697 / L3227 close as ACCEPTED
  per D17, not as re-deferrals.
- [x] 10.4 Record the answers to whatever remains in *Open questions for Juan*.
- [x] 10.5 Update `sprint-status.yaml`; `2-19` → `review`. Note `epic-2-retrospective: optional`.
- [x] 10.6 Commit your own slices as you go (D13). Commit directly to `main` — no branches, no PRs.

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

**Q2 — RULED 2026-08-25: TAKE IT (see D16).** **A29, the mirrored goal furniture.** Ruled YES by 2.9 decision 9, implementation routed to
"…or 2.19". It is the last story, so re-deferring means never. But it is viz work in a hardening
story and it visibly changes 2.8's shipped pass-network figures. Take it, or close the ruling as
WONTFIX with the reason recorded?

**Q3 — RULED 2026-08-25: ACCEPT ES CANONICAL (see D17).** **`<title>`/OG stay Spanish after an EN toggle.** Filed three times, owner "Juan", never ruled;
2.12 took it de facto for `/`. **NFR-4 forces the question here**, at 104 + 1,248 + 48 + Hub routes.
Options: accept ES canonical for a static export (zero work), or sync `document.title` client-side.
Ledger L147, L2697, L3227.

**Q5 — RULED 2026-08-25: OPTION 3 (see D15). Left below as the evidence the ruling was taken on.**
**Q5 — AC 2's Lighthouse floor is not reachable on either gated route by the lever SM-C2 authorises.
This is the one thing in the story that needs a ruling rather than more work.** *(raised 2026-08-10
during implementation; Q1 is now RULED — see the Task 5 record.)*

Measured, median of 3, mobile, against a host-realistic server: **Match Dashboard 83, Tournament Hub
68**, floor 90. The payload half of AC 2 passes with 4× margin, so this is entirely about execution
and render time. The two routes fail for *different* reasons and only one of them is SM-C2's:

- **Tournament Hub (68).** Renders **6,025 DOM nodes, 33 tables and 2,442 cells at 412 px**, none of
  it collapsed. This is exactly SM-C2's case and the lever would work: putting the 12 group standings
  and 9 results sections behind disclosures would cut the render commit by roughly an order of
  magnitude, and LCP is currently gated on it (`h2#standings`, **1,802 ms of element render delay**).
  **But it is a visible product change to Story 2.12's ruled surface**, and 2.12 chose to render both
  surfaces open. AC 2 pre-authorises it ("density moved behind disclosure, never deleted") and Task
  5.4 says to declare it — so it is mine to take if you want it taken. It is not mine to take quietly.
- **Match Dashboard (83).** Has **638 DOM nodes and 0 tables** at 412 px — all eleven Tactical
  sections are already collapsed. There is no density left to move behind a disclosure. Its cost is
  **1,141 ms of script evaluation** against a 461 KiB route weight (43 KiB of it unused JS): the app
  bundle itself, plus the eagerly-constructed section content that ledger **L1504 names and Partition
  C RE-DEFERS**. SM-C2's lever does not apply here at all. Closing this gap means bundle/code-split
  work or taking L1504 — both outside this story's declared scope.

> **RULED 2026-08-25 by Juan: OPTION 1 — accept and record the gap (see D19).** The evidence below
> is the state as of 2026-08-10; the figures moved substantially afterwards (83/68 → 88/86,
> accessibility 96 → 100, TBT 368/674 → 102/134 ms) and the ruling was taken on the FINAL numbers,
> not these. Left in place as the record of what the question was raised against.

**Options, and the cheapest honest one first:**
1. **Accept and record the gap** (0 work): AC 2's payload half passes with margin, a11y is 96, best
   practices 96, SEO 100, CLS is fixed, and the two scores are 83/68 rather than catastrophic. The
   shortfall and its causes are documented above. NFR-1 is then partially met and said to be.
2. **Take SM-C2 on the Hub only** (~half a day): likely lands the Hub near or above 90; the Match
   Dashboard stays ~83. Changes how the Hub looks on arrival.
3. **Take SM-C2 on the Hub AND pull L1504 back out of Partition C** (multi-day): the only route to
   both routes ≥90, and it re-opens a re-deferred architectural item at the end of the project.

**Recommendation: option 1 for the Hub's sake of shipping, or option 2 if the Hub's arrival state is
worth changing.** Option 3 is not proportionate in the last story.

**Q4 — RULED 2026-08-25: TAKE ALL THREE (see D18).** **Copy rulings, all cheap, all optional.** (a) ~25 per-table announcement identifiers (L1246);
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

#### Task 3 — R1, the pass-network re-scope

**Live verification, 3 real matches × {390, 1920} px × {es, en}** — all 12 cells, against the served
production export with the section's client fetch resolved and every disclosure opened:

| match | edges | matrix rows | figure `<svg>` | empty panel | unresolved names |
|---|---|---|---|---|---|
| `m001-mexico-south-africa` | 228 | **228** | none | no | **0** |
| `m082-belgium-senegal` | 309 | **309** | none | no | **0** |
| `m009-cote-d-ivoire-ecuador` | 219 | **219** | none | no | **0** |

Locale switched correctly in every cell (`<html lang>` = `es`/`en`, heads `Equipo/Desde/Hacia/Pases`
↔ `Team/From/To/Passes`, caption `Red de pases — Ordenado por equipo…` ↔ `Pass network — Sorted by
team…`). First row of m001 es: `MEX · Cesar MONTES · Johan VASQUEZ · 18`.

**Name resolution, measured over the whole corpus before choosing a source:** both `metadata.lineups`
(starters + substitutes) and `players[]` resolve **47,194 of 47,194** edge endpoints across all 104
matches, zero gaps in either. `metadata.lineups` is used because it is REQUIRED on the bundle where
`players` is `PlayerRecords | null`.

**Two harness capabilities were needed and are now in `cdp.mjs`** for Task 6's reuse:

- `setPreferences({locale, theme})` via `Page.addScriptToEvaluateOnNewDocument`. Locale and theme are
  `localStorage` keys read by a `<head>` bootstrap, so anything set after load leaves the page in the
  previous state — the first verification run reported `es` copy for all six "EN" cells while
  claiming to have switched. There is no `?lang=` query parameter.
- `openAllDisclosures(selector)`, which clicks outward-in until nothing is `aria-expanded="false"`.
  Below `lg` the section SHELL is collapsed as well as the table disclosure, so a single click opened
  the shell and the first run measured **0 tables at 390 px** on all six mobile cells — a
  false negative that would have read as "the matrix does not render on mobile".

#### Task 4 — real-data verification at scale

**4.1 Route bijection — exact, all three families:**

| route family | manifest | built | missing | extra |
|---|---|---|---|---|
| `/matches/[slug]` | 104 | **104** | 0 | 0 |
| `/players/[slug]` | 1,248 | **1,248** | 0 | 0 |
| `/teams/[slug]` | 48 | **48** | 0 | 0 |

**4.2 Link integrity — every internal anchor in every exported document:** 1,407 documents scanned,
1,303 distinct internal hrefs, 16,802 occurrences, **0 dead links**. All 48 team routes and all 1,248
player routes carry at least one inbound link (A6 closed: the seven-of-eight 404 was a fixture
artefact). No `/matches/` links appear in pre-rendered HTML because the Hub's results and standings
mount from the client fetch — expected under AR-11/AD-11, and those links were exercised in the
browser sweeps.

**Speculative fetch, measured in the browser rather than grepped** (`prefetch` is not serialised into
the exported HTML at all, so a search for `"prefetch":true` returns zero on a page that prefetches
everything — the grep proves nothing):

| route | requests | RSC `.txt` | RSC for OTHER routes | `/data/` fetches | external |
|---|---|---|---|---|---|
| Match Dashboard | 32 | 4 | 4 (root only) | 1 | **0** |
| Tournament Hub | 26 | 3 | **0** | 2 | **0** |
| Player Profile | 32 | 4 | 4 (root only) | 1 | **0** |
| Team Profile | 33 | 4 | 4 (root only) | 1 | **0** |
| `/compare` | 40 | 12 | 12 (root + about + glossary) | 1 | **0** |

`prefetch={false}` **holds where the ledger cared**: zero of the 1,248 player, 48 team or 104 match
routes are speculatively fetched from anywhere. What does prefetch is the CHROME — the header
wordmark's `/` link and the footer's `/about` + `/glossary`, which set no `prefetch` prop. Cost
measured: the root route's four RSC payloads are 33,211 B raw / **5,076 B gzip**, once, on every
non-home page. Left as is — three fixed routes at 1% of the route budget, and they are the genuinely
likely next navigation. The AD-4 artifact fetches are exactly one per route (two on the Hub),
matching the measured payload table.

**4.3 SM-3 — emitted shot maps vs the source PDFs. PASS: 24 team shot maps over 12 matches, 0
disagreements.** Sample stratified across **11 distinct venues and all 9 matchday rounds**
(group-md1/2/3, r32, r16, qf, sf, third-place, final) — deliberately not the first ten:

| # | match | round | venue |
|---|---|---|---|
| 1 | `m001-mexico-south-africa` | group-md1 | Mexico City |
| 2 | `m002-korea-republic-czechia` | group-md1 | Guadalajara |
| 3 | `m003-canada-bosnia-and-herzegovina` | group-md1 | Toronto |
| 6 | `m006-australia-turkiye` | group-md1 | BC Place Vancouver |
| 25 | `m025-czechia-south-africa` | group-md2 | Atlanta |
| 49 | `m049-scotland-brazil` | group-md3 | Miami |
| 73 | `m073-south-africa-canada` | r32 | Los Angeles |
| 89 | `m089-paraguay-france` | r16 | Philadelphia |
| 97 | `m097-france-morocco` | qf | Boston |
| 101 | `m101-france-spain` | sf | Dallas |
| 103 | `m103-france-england` | third-place | Miami |
| 104 | `m104-spain-argentina` | final | New York/New Jersey |

**What was compared, and why it is an independent check.** `events.shots` is produced by the VECTOR
marker extraction (marker geometry, digit-glyph proximity, RGB→outcome). The check reads the printed
Key table off the "Attempts at Goal" page's TEXT layer — a channel the extraction never touches — and
compares three things per team: the full five-way outcome breakdown (Goals / On Target / Off Target /
Blocked / Incomplete), the shot total against `keyStatistics.shots` (Domain B, a different page
entirely), and the scoreline against the PDF cover. Every one of the 24 breakdowns matched
element-for-element; totals ranged 2–30 shots.

**The +1 minute question is resolved, and it resolves in the pipeline's favour.** The fixture put
m001's goals at 8′/66′ and the emitted bundle puts them at 9′/67′. The PDF's attempts list prints
`3, 8, 12, 19…` where the bundle carries `4, 9, 13, 20…`, so the extraction adds one — and
`emit.py:232-252` documents exactly that, with evidence: "`time_raw` is NOT the football minute — it
is one less", cross-referenced against the goal listing on 208 rows (−1 on 204, −2 on 4). It is the
ordinary football convention that an event at 8:30 elapsed is reported in the 9th minute. **The
extraction is right and the 1.1 fixture was the approximation.**

**4.4 Rendered section census over 6 matches** (group-md1 → final, both `Côte d'Ivoire` matches
included), in a real browser with every disclosure opened. Matches the story's census exactly:

| section | rendered | expected |
|---|---|---|
| `#key-stats` | tiles, no table | ✓ |
| `#momentum` | 1 table, 100–145 rows, 1 figure | ✓ |
| `#shot-maps` | 1 table (18–38 shots), 7 figures, **1 panel absence** | ✓ shots render, cross map absent |
| `#pass-networks` | 1 table, 220–309 rows, **0 figures** | ✓ R1's matrix-only shape |
| `#offers-to-receive` / `#movement-to-receive` | 2 tables each, 33–36 rows | ✓ populated via `players[].inPossession` |
| `#defensive-actions` | **whole-section empty state** | ✓ null 104/104 |
| `#phases` / `#pressing` / `#set-plays` | populated | ✓ |
| `#goalkeeping` | 6 tables, 244–334 rows, 2 figures, **`gateNote` renders** | ✓ **A32 closed** |

> **The first run of this census reported `#shot-maps` EMPTY on all six matches, and it was the
> probe that was wrong.** It treated any `.border-dashed` descendant as a whole-section empty state,
> and `#shot-maps` legitimately renders a per-panel absence for the cross map right beside two live
> shot figures. Corrected to require border-dashed AND no tables AND no figures. Worth recording
> because it is the same confusion in measurement form that R1 was in code: a panel-level absence
> and a section-level absence are different things, and conflating them hides real data.

**4.5 / A5 — accent-insensitive search, in a browser, on the real corpus: 10/10.** Both directions,
teams and players:

| typed | matched | note |
|---|---|---|
| `Turkiye` / `Türkiye` | ✓ / ✓ | corpus holds the umlaut |
| `Curacao` / `Curaçao` | ✓ / ✓ | corpus holds the cedilla |
| `Cote` / `Côte d'Ivoire` | ✓ / ✓ | corpus holds the circumflex |
| `Nunez` / `Núñez` | ✓ / ✓ | corpus is STRIPPED — the reader supplies the accent |
| `Quinones` / `Quiñones` | ✓ / ✓ | corpus is STRIPPED |

**4.6 — the collation measurement is recorded, no code changed.** `table-sort.ts` keeps its `'es'`
default verbatim per UX-DR12; ruled decision 8 stands on real data (0 disagreements in 784,612 pairs).

**4.7 / A25 — `domain-g-zone-sum` over the EMITTED corpus. GATE PASS:**

| scope | rows | worst drift | tolerance | failures |
|---|---|---|---|---|
| per-match (`players[].physical`, 104 bundles) | **3,289** | **0.200 m** | 0.35 m | **0** |
| season (`player-profiles/*.physical`, 1,248) | **1,248** | 0.600 m | 0.35 m × appearances | **0** |

The per-match line **exactly reproduces the pipeline's own published corpus figure** (3,289 rows,
0.200 m worst drift) through an independent implementation reading the emitted artifacts — the D4
house pattern satisfied. The 79-of-96 failures at 4.400 m were a fixture defect and do not exist in
the shipped data.

> **The season half of this gate was VACUOUS on its first run and is reported only after being
> fixed.** `appearances` is an object (`{played, started, minutesPlayed, …}`), not a number, so the
> proportional tolerance computed `NaN` and `drift > NaN` is false for every row — a gate that could
> not fail, printing PASS. It now reads `appearances.played` and throws on a non-finite tolerance
> rather than silently passing.

#### Task 5 — AC 2 budgets and Lighthouse

**5.1 — the payload half of AC 2 PASSES with large margin**, reproduced independently (gzip -9 over
the canonical committed bytes) and agreeing with the story's creation-time figures to within 0.7%:

| route payload set | measured | cap | result |
|---|---|---|---|
| Hub (`tournament.json` + `leaderboards.json`) | 38,860 + 77,676 = **116,536 B (113.8 KB)** | 500 KB | **PASS**, 23% of budget |
| largest match bundle (`m082-belgium-senegal`) | **14,232 B (13.9 KB)**, median 12,191 | 500 KB | **PASS** |
| largest player profile (`bellingham-jude-eng`) | **1,542 B**, median 1,023 | 500 KB | **PASS** |
| largest team profile (`england`) | **1,258 B**, median 1,026 | 500 KB | **PASS** |
| `/compare` worst case (`type=matches`) | **67,324 B (65.7 KB)** | 500 KB (unassigned) | **PASS** |

Confirmed live in the browser: each route fetches **exactly one** artifact (the Hub two), with zero
external requests on all five routes measured.

**5.2 / 5.3 — Lighthouse mobile, 13.4.1, median of 3 runs against a host-realistic server.**

| route | perf (min–max) | a11y | best practices | SEO | FCP | LCP | TBT | CLS | SI |
|---|---|---|---|---|---|---|---|---|---|
| **Match Dashboard** | **83** (80–83) | 96 | 96 | 100 | 1.1 s | 3.7 s | 368 ms | 0.000 | 2.8 s |
| **Tournament Hub** | **68** (67–71) | 96 | 96 | 100 | 1.0 s | 4.1 s | 674 ms | 0.044 | 3.8 s |
| `/compare` | 88 (88–90) | 96 | 96 | 100 | 0.9 s | 3.4 s | 162 ms | 0.000 | 2.2 s |
| Player Profile | 85 (84–88) | 96 | 96 | 100 | 0.9 s | 1.8 s | 561 ms | 0.000 | 1.8 s |
| Team Profile | 75 (75–77) | 96 | 96 | 100 | 0.9 s | 3.9 s | 488 ms | 0.000 | 2.7 s |

**AC 2's Lighthouse half is NOT met: 83 and 68 against a floor of 90.** See Q5 — it needs a ruling,
not more measurement.

**Two harness facts had to be established before any of those numbers meant anything (D4).**

1. **`python -m http.server` is not a model of the host.** It is single-threaded and serves NO
   compression, so Lighthouse's simulated throttling charges the page for uncompressed bytes
   delivered one request at a time. The Hub's document alone is 100,758 B raw and **11,023 B**
   gzipped — a 9× difference on the critical path. Measured both ways: Match Dashboard **53 → 79**,
   `/compare` **76 → 96**, purely from serving it the way Netlify does. A small Node server with
   gzip/brotli, keep-alive and Netlify's own cache-control is what the table above ran against.
2. **A single Lighthouse run on this machine is not a measurement.** Between two builds, routes that
   were *not touched* moved 99 → 91 and 88 → 66. The first pass of this work drew a conclusion from
   single runs and it was worthless. Every figure above is a median of 3 with the spread printed;
   the spreads are now ±3.

**5.4 — one tuning change landed, and it is a real defect fix rather than a score chase.**
The Hub scored **CLS 0.758** — one shift, weight 25, in the client-fetched region. Measured cause:
the loading skeleton is **428 px** and the settled region is **14,990 px** at 412 px wide (30 tables:
one per results section and group standings table). At fixture scale the two were comparable; at 104
matches the region grows by ~14,500 px in one frame and throws `LeaderboardsSection` — fully in view
under the skeleton — off-screen. `min-h-[120vh]` on the loading container fixes it: the reservation
does not try to predict the settled height (over-reserving shifts content up just as badly), it only
has to exceed the viewport so that everything below is off-screen before and after.
**Hub CLS 0.758 → 0.044, and the Hub's score moved 56 → 68–79.** No density was deleted or hidden.

**A `content-visibility: auto` experiment was tried on the Hub's 33 section blocks and REVERTED.**
It showed no benefit that survived the noise, and the run it was measured in moved five untouched
routes by up to 22 points — which is what exposed the single-run problem above. It is not in the tree.

**5.5 — A19 done, A16 outstanding.** `build-data.ts` now caches parsed artifacts by resolved absolute
path. Every dynamic route reads its artifact twice (`generateMetadata` + page body) because they are
separate Next entry points with no shared scope: 96 parses across 48 team routes at fixture scale,
**2,496 parses of 1,248 files** on `/players/[slug]` at real scale. **Build wall clock 89–91 s →
78 s.** A16's `columns` memoisation is not applied — see Q5, because whether it is worth doing
depends on which way the Lighthouse gap is ruled.

**5.6 / A30 / Q1 — RULED: ACCEPT the header-search payload as it stands, no contract change.**
Re-measured at the cutover: `tournament.json` is **38,860 B gzip / 409,524 B raw**, fetched lazily on
first engagement with the header search, once per page load, never on load. Verified in the browser:
the match, player and team routes each fetch exactly one artifact on load and the index is not among
them. At 38.9 KB it is **7.8% of the 500 KB route budget**, it is paid only by a reader who actually
opens the search, and the `entities` slice (29,758 B gzip) would save 9 KB for a contract change and
a second artifact to keep in bijection. Not worth it. Recorded, closed.

**A31 — `/compare` has a number now: median 88 (88–90) mobile, payload 65.7 KB of the 500 KB cap.**
The AD-4 amendment is filed as a recorded gap rather than a contract change: `/compare`'s payload set
is `tournament.json` + up to two entity artifacts, which is bounded by the two per-entity caps that
already exist. It needs no cap of its own.

#### Task 5.7 / 5.8 — D15's three moves

**5.7 SM-C2 on the Tournament Hub.** The 12 group standings and 9 results sections moved behind
`ViewDataDisclosure`, each with its row count rendered OUTSIDE it. Nothing is deleted: every group,
stage, row and column is one click away, in artifact order, with its sort intact, and the headings
stay rendered — so the shape of the tournament (twelve groups, nine rounds, how many teams and
matches in each) is still readable without opening anything.

| measured at 412 px | before | after |
|---|---|---|
| DOM nodes | 6,025 | **2,780** |
| `<table>` | 33 | **3** |
| table cells | 2,442 | **1,050** |
| settled region height | 14,990 px | **4,496 px** |
| Lighthouse CLS | 0.044 | **0.000** |

`ViewDataDisclosure` gained `openNonce` so a shared UX-DR18 deep link (`…/#standings-group-a`) opens
its target instead of landing on a closed control — this story is not allowed to MINT a new instance
of the defect L1553/L1886 re-defers while re-deferring the old one. Empty sections keep their table
flat, so their named empty state is what the reader sees rather than a control promising data that
is not there.

**5.8 L1504.** `sectionContent(plan.id)` no longer runs in `TacticalLayer`'s own render: it moved
into `<SectionContent>`, which renders UNDER the per-section error boundary. That closes both halves
at once — a throw during prop construction is now contained where a section's own render errors
already were, and the eleven sections stop constructing their full prop sets on every re-render of
the layer whether open or not.

**5.8 the chart viewport gate.** `next/dynamic` defers the DOWNLOAD, not the MOUNT. `#momentum` is
in `ALWAYS_EXPANDED_SECTION_IDS`, so it mounted its chart in the first client render and pulled
370 kB of recharts during arrival — for a figure whose top edge is at y=1421 under an 823 px
viewport. `useInView` holds it until the figure comes near the viewport, and **fails OPEN** where
`IntersectionObserver` is absent (jsdom, older browsers), which is what `use-in-view.test.tsx` pins
first: a gate that failed closed would have shipped a permanently blank figure while every existing
test stayed green.

| Match Dashboard, measured | before | after |
|---|---|---|
| JS on the wire | 341,110 B | **254,522 B** |
| JS decoded (what the engine parses) | 1,342,073 B | **975,129 B** |
| DOM nodes at 412 px | 638 | **541** |
| Lighthouse TBT | 368 ms | **165 ms** |

**The Hub's LCP element, and why it was the real number.** Measured with a
`largest-contentful-paint` PerformanceObserver under 4× CPU throttling: the `<h1>` painted at
**876 ms** at 2,280 px², then the client-fetched `<h2 id="standings">` arrived at **2,244 ms** at
3,280 px² — a thousand square pixels larger — and took the title, dragging LCP 1,368 ms later.
Lantern then charges the whole JS graph to that node, which is how a route whose real content is up
at 876 ms reported a 4.2 s LCP. The loading state now renders that same heading — real copy instead
of a grey block, and the deep-link target `useHashScroll` already expects — so the largest
contentful element is a static one. **Observed LCP 2,244 → 648 ms.**

**A16 superseded, and said so rather than silently dropped.** D15 put A16's `columns` memoisation
back in scope "since the ruling that made it conditional has landed on the side that wants the
execution win". It was not applied, because 5.8 removed the thing it was optimising: with
`SectionContent` deferring prop construction to open sections only, the eleven column arrays a
collapsed match route used to build on every render are no longer built at all. A `useMemo` over an
array that is no longer constructed is dead weight. A19 (the profile-read memo) shipped and is
recorded in the Task 5 notes above.

**REJECTED ON MEASUREMENT, recorded so it is not retried.** `<link rel="preload" as="fetch">` for
each route's artifact was implemented, measured and reverted. Two independent defects, both caught
in the browser rather than reasoned about:

1. it DOUBLE-DOWNLOADED — the preload fetched the full bytes (`init=parser`) and the component's own
   `fetch()` then fetched them again (`init=script`, `cache=false`), 167 KB twice on a match route;
2. worse, the Hub's two preloads LEAKED ONTO EVERY OTHER ROUTE. Next prefetches `/` from the header
   wordmark on every page, and React executes the preload directives inside a prefetched RSC
   payload — so every match, player and team route pulled `tournament.json` (409 KB) and
   `leaderboards.json` (963 KB) it does not use. The measured "each route fetches exactly one
   artifact" property from Task 5.1 would have been destroyed by it.

#### Task 6 — the accessibility floor

**6.1 The reflow matrix: 320 / 390 / 195 CSS px × {dark, light} × {es, en} × 8 routes = 96 cells.**

The first result was about the METHOD. The ledger's own predicate over-reports badly: at 320 px it
flagged **654** elements on `/` while the DOCUMENT's `scrollWidth` was exactly 320 — every one of
them a cell inside a table in an `overflow-x-auto` wrapper, which EXPERIENCE.md:119 explicitly
permits. A reflow FAILURE is the document scrolling sideways. The predicate now separates the two
and counts only offenders with no horizontally-scrollable ancestor.

With that correction: **320 and 390 already passed on all 32 cells.** 195 failed on **all eight
routes**, including `/about`, `/glossary` and `/404`, which contain nothing but chrome.

| width | cells | document overflow before | after |
|---|---|---|---|
| 320 | 32 | 0 | **0** |
| 390 | 32 | 0 | **0** |
| 195 | 32 | 16 of 16 route×locale cells (doc 237–295 px) | **0 — every cell reports exactly 195** |

**6.2 R2/D8 — the matrix named SIX owners, not the three R2 lists.**

| owner | story | what it was |
|---|---|---|
| `SiteHeader` | 2.2 | min-content **237 px** — the universal floor, on every route |
| Hero score row | 2.4 | bare `1fr` floored by a 48 px crest; could not narrow past ~230 |
| `#key-stats` tiles | 2.5 | two FIXED 76 px value tracks, min-content **247 px** |
| `StoryStatTiles` | 2.4 | two fixed columns of a Hero stat tile |
| `#lideres` teasers | 2.13 | an IMPLICIT auto track: **278.5 px** inside a 163 px container — the worst cell |
| `CompareRows` | 2.17 | ~78 px tracks against a 109 px `type-stat-value` |

The header REFLOWS rather than shrinks: `flex-wrap` + `min-h-14` keeps every 44 px target
(MIN_HIT_PX) and the full site name, and the row height is **unchanged at 320, 390, 412, 768, 1440
and 1920** — verified. Tightening the gap and the gutter was measured as the alternative and buys
only 32 px, reaching 195 solely by truncating the site name. `#key-stats` takes the `minmax()` track
change R2 prefers: `type-stat-value` keeps its 26 px DESIGN size, and **no type-ramp departure is
taken anywhere.**

**The systemic half.** Tailwind's bare `grid` sets `display: grid` with NO template, so children
land in an IMPLICIT auto track sized by their max-content and *not* clamped to the container. Two of
the six owners were exactly this defect and the app had eleven more instances of the shape; all are
now `grid-cols-1`, and `reflow-guards.test.ts` fails if a twelfth appears.

> **Rejected on measurement, recorded so it is not retried.**
> `repeat(auto-fit, minmax(min(100%, 11rem), 1fr))` is emitted into the stylesheet correctly and
> still produced TWO 164 px tracks inside a 163 px container — making `/matches` WORSE (doc 278 →
> 355). The explicit `grid-cols-1` plus a `min-[19rem]:` breakpoint is boring and it works.

**6.3 D9.** `flex-wrap` + `whitespace-normal` + `max-w-full` on the Expert `<md` column-group
ToggleGroup. A true 320 px failure in both locales (339 vs 305) and at 390 in EN (412 vs 375),
distinct from R2's 195 px question. **320 and 390 now hold with EVERY disclosure open, both
locales.**

**6.4 `prefers-reduced-motion: reduce`, real media emulation, 16 cells.** The query matches on every
one and the longest transition/animation duration anywhere is **0.00001 s** — globals.css's own
0.01 ms sentinel. Zero elements above it.

> The first probe reported **30,161** "animated" elements on the Hub, because it tested `> 0` and so
> counted the very rule that disables motion. The threshold is the sentinel, not zero.

**6.5 / 6.6 keyboard traversal, driven by real `Input.dispatchKeyEvent` Tab keys** — which this
project's automation had never delivered before. It does not fail.

| theme | / | /matches | /players | /teams | /compare | /glossary | /about | /404 |
|---|---|---|---|---|---|---|---|---|
| dark | 400 | 399 | 399 | 55 | 17 | 7 | 7 | 8 |
| light | 400 | 399 | 399 | 55 | 17 | 7 | 7 | 8 |

Tab stops reached (400 is the harness cap, not the route's total). **Zero tab stops without a
visible focus indicator, on every route in both themes.**

> ⚠️ THE FIRST FOCUS PROBE WAS WRONG AND ITS OUTPUT WAS DISCARDED. It called `element.focus()` and
> read the computed outline, reporting EIGHT indicator-less controls per route. `:focus-visible`
> does not match a PROGRAMMATIC focus on a button in Chrome — it was measuring its own method.

**6.5b `focus-on-pitch`, both themes.** A shot marker (`<g role="button" tabindex="-1">`) reached by
keyboard: `outline: solid 2px rgb(234, 251, 253)` = `#eafbfd` = `--focus-ring-on-pitch`, offset
2 px, `:focus-visible` true, **identical in dark and light**.

> Second harness fact: an SVG element's `className` is an `SVGAnimatedString`, not a string, so
> `n.className.includes('focus-on-pitch')` silently matched nothing. Read `getAttribute('class')`.

**6.7 every viz has its reachable data-table alternative — checked PER FIGURE**, not by a page-level
count: **17 figures across the routes, 0 without a `<table>`** in the panel that contains them. A
second pass over every chart-shaped `<svg>`, marked as a figure or not, agrees. The one flagged
`<svg>` is `/compare`'s swap-sides ICON.

**6.8 axe-core 4.12.1 over 8 routes × {dark, light} × {es, en} with every disclosure open — 32
cells. BEFORE: 2 rules, 66 nodes. AFTER: 0 rules, 0 nodes.** Both findings were real:

- `link-in-text-block` [serious], **64 nodes on 30 of the 32 cells** — the footer's `/about` and
  `/glossary` links and the 404's home link sit inside running text and were distinguished from it
  by hue alone until hover (WCAG 1.4.1). Now `underline underline-offset-2 hover:no-underline`.
- `color-contrast` [serious], **2 nodes, LIGHT THEME ONLY** — `PitchPanel` painted its team-code
  label with `--viz-team-a`, the dark olive `#4d7c0f` in the light theme, on the theme-invariant
  pitch `#0b3d2e`: **2.44:1** against a 4.5:1 requirement at 11 px. `--viz-team-a-on-pitch` exists
  for exactly this and globals.css:194 says so; `DefensiveActionsSection` has used it since 2.9
  decision 8 and this one call site had missed the ruling.

> **axe runs from axe-core injected into the CDP harness, not through `@axe-core/cli`, and nothing
> is added to `app/package.json` (D6).** The CLI scans the ARRIVAL state only: it cannot set the
> theme or the locale (both are `localStorage` keys read by a `<head>` bootstrap) and cannot open a
> disclosure, so it would have tested five collapsed sections and missed all 26 tables, every sort
> control and the whole Expert Layer — the surface AC 3 is actually about.

**6.9 A17** — `markRowHeader` gives the four event logs a row header, choosing the first available of
player → minute → team. Not a hard-coded flag: the player column is GATED by `anyPlayerName`, so a
fixed one would leave exactly the matches with least context with no row header at all.

**6.10 A26** — a locale switch really does re-order a text sort, and now says so. Text sorts only: a
numeric column collates identically in both locales and announcing it would be a second false claim.

**6.11 A8** — `/compare`'s `<md` sticky mini-header: `position: sticky` and **actually stuck at
56 px** (the twenty-two-headers-that-shipped-green lesson), and `data-compare-showing` goes **0 → 1**
when side A leaves the observer's adjusted root. At 390×844 it correctly does NOT rename — both
figures are inside the root at once, which the observer's own docblock predicts — so the check was
re-run at 390×500, where the page has room to scroll.

**6.12 A23** — confirmed reachable: the corpus carries `Emiliano MARTINEZ` twice
(`martinez-emiliano-arg`, gk / `martinez-emiliano-uru`, mf). Comparing them produced six
byte-identical captions, two identical figure headings AND a sticky mini-header renaming itself
between two identical strings. All now carry the side's `detail` line via `composeSideHeading`.

**6.13 the `lang` decisions.** `<html lang>` tracks the toggle on all 8 routes in both locales. The
glossary marks 40 terms per locale, each in the OTHER language — ES pages mark the English term
`lang="en"`, EN pages mark the Spanish term `lang="es"`. Outside it there are three in-body marks in
total, all glossary triggers in headings.

> **RECORDED CONSEQUENCE OF D17:** at EN the document is `lang="en"` while `<title>`/OG stay
> Spanish, so a screen reader announces a Spanish title with English phonemes. That follows from the
> ruling, is not re-opened here, and is the one audible cost of ES-canonical metadata.

**6.14 A3/L49** — the zero-external-request audit stops being a one-time manual grep.
`assert-no-external-origins.mjs` runs in the build chain after `copy-data` and fails on any external
SUBRESOURCE. Current export: **12,682 text assets, 0 external subresources.** Nine tests feed it the
trees it must reject (an analytics script, a font CDN, a CSS `@import`, a background image, a runtime
fetch).

> The design decision that makes it usable: a naive "any absolute URL anywhere" scan reports **27
> violations on a clean build**, every one a diagnostic string inside a vendor bundle
> (`react.dev/errors`, `nextjs.org/docs`, core-js's licence). It matches FETCHING POSITIONS only and
> merely counts the rest.

**6.15 A27 — the Hub sticky-header premise, re-checked at real row counts.** With every disclosure
open the route holds **66 tables**, the tallest **190 rows / 7,509 px**, `thead` position `static`.
**NO CHANGE**, as expected: the premise the ledger asked about (Hub standings/results tables are
short) still holds at 4–16 rows. The 190-row table is the leaderboards surface, a different owner.

**6.16 L1246 / D18(a)** — the ~25 match-route tables had no announcement identifier at all, so one
page-wide live region said "Ordenado por Jugador, ascendente." with no way to know which of seven
goalkeeping tables had moved. **THE COPY RULING: a table's announcement identifier IS ITS
`<caption>`** — the string that already names it in HTML, that a screen reader already reads on
entering it, and whose site-wide uniqueness is already pinned by the caption inventory. Zero new
copy; `composeSortAnnouncement` trims one trailing period.

#### Task 7 — the remaining App-side ledger items

**7.1 A13.** `#pressing` re-presents `shapeByPhase` as two tables (2 possession states × 6 rows: 3
panels × 2 sides). CS-2 retired this section's metre surface and reshaped the data; the
`viz.pressing.metre*` family went with it and nothing replaced the SURFACE, while `shapeByPhase` is
populated on 104/104. The vocabulary is not minted here — Story 2.16's `team.shape.*` is reused
whole and only the two captions are new. Tables and not charts, for 2.16's own D13 reason. Caption
inventory 26 → 28, with the count pinned so the list must move with the component.

**7.2 A14.** The interim ruling rested on "both mechanisms read `row.at.stoppageMinute`, WHICH THIS
CONTRACT DOES NOT CARRY"; CS-2 made it carry exactly that. **2,506 of 21,764 real samples sit in
stoppage and every one collides with another sample on the same minute**, so the dedupe was doing
real work and which slot won was luck of ordering. RESOLVED BY LABELLING, NOT BY SKIPPING — a
deliberate departure from what the ledger proposed: `momentumTickIndices` drops stoppage slots
because its axis can only say "45", while this one has the stamp and can say "45+2". The dedupe key
becomes the whole clock, nothing is dropped, and a stride landing in stoppage no longer thins the
axis unpredictably.

**7.3 A15.** `playerId` held `keeperIds(record)` — the keepers' ids hyphen-joined, i.e.
`"rangel-raul-mex-ochoa-guillermo-mex"`, a string shaped like a player id referring to no player.
The block is PER TEAM (CS-2 decision 18), so the field is now `teamId`. The `" / "` join moved to
`viz.goalkeeping.nameJoin`, resolved at the call site (AD-7).

**7.4 A18.** `#lideres` → `#leaders`, the last Spanish fragment id in the app (2.18 decision 11).
URL-shaped, so taken now or never — nothing links to it yet because the site has not been published.
Visible copy unchanged.

**7.5 A20 — ALREADY CLOSED, verified rather than re-implemented.** `InvolvementChart`'s hatch already
draws at `HATCH_TILE_PX / 2` and its own comment records the fix; `x1={0}` occurs nowhere in the tree.

**7.6 A29 / D16.** The goal furniture is mirrored at the defending end. Most of it is reflected x
offsets, but the story names two non-projective steps and both were real:

- **the arc's angle range**, which was the first version's BUG. At the attacked end `acos` of a
  negative offset gives ~120° and the sweep goes the long way through 180°; at the defending end the
  offset is positive, `acos` gives the supplement ~60°, and the sweep goes the short way through 0°.
  Reusing the attacked angle drew the arc straight THROUGH the penalty area. The test that samples
  every point of the mirrored path caught it.
- **the goal's px depth**, reversed by hand in both orientations (horizontal hangs LEFT, vertical
  hangs DOWN).

**D16's re-verification of 2.8's pass-network figures: the stated risk does not materialise, and
that is measured rather than argued.** `passNetworkNodes` is null on 104/104, so R1's matrix-only
branch means NO pass-network figure renders at real data at all — verified live on three matches: 0
figures, 1 table. The only full-pitch panels that ship are **six shot maps**, exactly the six matches
with a shot behind halfway (minimum shot x corpus-wide: 29.48).

| match | pitch | rects | arcs | spots | halfway |
|---|---|---|---|---|---|
| `m014-spain-cabo-verde` | full | 7 | 3 | 3 | 1 |
| `m037-uruguay-cabo-verde` | full | 7 | 3 | 3 | 1 |
| `m038-spain-saudi-arabia` | full | 7 | 3 | 3 | 1 |
| `m001-mexico-south-africa` | half | 4 | 1 | 1 | 0 |
| `m082-belgium-senegal` | half | 4 | 1 | 1 | 0 |

**7.7 A21 + A22.** DESIGN.md absorbs cyan on the overlay surface (**9.20:1 dark / 4.68:1 light**) and
states how little margin the light figure leaves — 0.18 over the floor. EXPERIENCE.md's two rows said
"full-width sheet" and "full-screen sheet" for one control; 2.14 shipped full-width (386 px at
`top: 0`, content-driven height) and both rows now say so.

**7.8 L2335 / D18(b).** `"Ordenar por Vel. máx. (km/h) (Velocidad máxima)"` →
`"Ordenar por Vel. máx. (km/h) — Velocidad máxima"`. Both halves were ruled and neither was wrong;
only the composition stacked. WCAG 2.5.3 holds in both branches — the visible text still leads.

**7.9 L962 + L2347 / D18(c).** Five of the nine collapsible sections marked nothing, because their
ruled summaries carried no policy term — a gap 2.18 filed rather than closed. Each summary now keeps
its ruled sentence VERBATIM as the clause after a colon and gains its term in front, including
`movement-to-receive`, whose sentence carries 2.18 decision 3's offers⊋movements relationship. The
leaderboards surface gets its first mark: not on the metric's sortable column head, which cannot
hold a focusable trigger, but on the board's own heading, on both altitudes, for the fourteen metric
codes that name a policy term.

#### Task 5.9 — the final Lighthouse table, and the harness defect underneath it

**THE LARGEST SINGLE MOVEMENT IN THIS TASK CAME FROM FIXING MY OWN HARNESS, AND IT IS RECORDED
FIRST BECAUSE IT INVALIDATES TWO EARLIER ROUNDS OF NUMBERS.**

When the measurement server was rewritten to pre-compress and cache — itself a fix for a measured
329 ms TTFB artefact — the edit wrote **literal backspace bytes (0x08)** into its two
content-negotiation regexes, so they read `/<BS>br<BS>/` and matched nothing. The server then served
every asset **uncompressed** while still printing "gzip/brotli" on startup:

| asset | served | should be |
|---|---|---|
| `/` (the Hub document) | 104,993 B | **8,388 B** (12.5×) |
| the largest JS chunk | 227,538 B | **60,658 B** |
| `leaderboards.json` | 962,885 B | **39,213 B** (24.5×) |

| the SAME build, gated routes, median of 5 | Match Dashboard | Tournament Hub |
|---|---|---|
| against the uncompressed server | 76 | 65 |
| against a compressing server | **90** | **85** |

This is the same class of error as the prior session's `python -m http.server` finding — a
measurement about the harness — and it is the **second time in this story** a number turned out to
be about the method rather than the page. The reason is now written into `serve.mjs` so it cannot be
reintroduced silently, and the response headers are asserted rather than assumed.

**The last SM-C2 move: `INITIALLY_OPEN_BOARDS` 3 → 0.** Three was chosen at the 2.13 review "so the
3-board fixture renders exactly as before" — a FIXTURE fact, and correcting fixture-shaped decisions
at real scale is this story's whole job. At the real emission those three are the largest boards by
row count and were the last uncollapsed density on the Hub. **Nothing is deleted:**
`LeaderboardsSection` still pre-renders the top three rows of ALL 36 boards into the exported HTML,
so a reader arriving at `/` still sees who leads every board with no JavaScript and without opening
anything. Hub TBT **219 → 134 ms**.

**The final table.** Lighthouse 13.4.1, mobile, median of 5 runs, host-realistic server (gzip/brotli
with a real `content-length`, keep-alive, Netlify's own cache-control), `benchmarkIndex` printed
because it is part of the reading:

| route | perf (min–max) | a11y | BP | SEO | FCP | LCP | TBT | CLS | SI | benchmarkIndex |
|---|---|---|---|---|---|---|---|---|---|---|
| **Match Dashboard** | **88** (86–91) | **100** | 96 | 100 | 1.0 s | 3.7 s | 102 ms | 0.000 | 3.5 s | 1804–2510 |
| **Tournament Hub** | **86** (84–94) | **100** | 96 | 100 | 0.8 s | 3.8 s | 134 ms | 0.044 | 2.4 s | 1917–2321 |
| `/compare` | 87 (78–94) | **100** | 96 | 100 | 0.8 s | 3.9 s | 119 ms | 0.000 | 2.0 s | 2068–2249 |
| Player Profile | 78 (74–86) | **100** | 96 | 100 | 0.8 s | 4.3 s | 362 ms | 0.000 | 2.6 s | 1655–2162 |
| Team Profile | 69 (65–77) | **100** | 96 | 100 | 0.8 s | 4.5 s | 515 ms | 0.000 | 3.1 s | 1074–2320 |

**What moved across the whole story:**

| | start of 2.19 | now |
|---|---|---|
| Match Dashboard / Hub performance | 83 / 68 | **88 / 86** |
| accessibility, all five routes | 96 | **100** |
| Match Dashboard TBT | 368 ms | **102 ms** |
| Tournament Hub TBT | 674 ms | **134 ms** |
| Tournament Hub CLS | 0.758 → 0.044 | 0.000–0.044 |

**AC 2's Lighthouse half is NOT MET as measured, and is not silently accepted (5.9's own words).**
The floor is 90; the medians are 88 and 86, with best runs of 91 and 94. Two things about that
number are worth stating precisely before it is ruled on:

1. **The remaining gap is structural, not slack.** The Hub's LCP element is `h2#standings`, inside
   the AD-11 client-fetched region — it cannot paint before the fetch resolves. The
   `min-h-[120vh]` reservation cannot be reduced to bring the static `#leaders` teasers above the
   fold either: the settled region is **4,496 px** at 412 px, so shrinking the reservation
   reintroduces the CLS the Task 5.4 fix removed. Closing it needs an AD-11 change, which is
   explicitly out of this story's scope.
2. **The measurement's own spread is larger than the gap.** `benchmarkIndex` swings 1,074–2,510 on
   this machine, and the OBSERVED first paint for one unchanged page varied **227 ms → 2,198 ms**
   between runs in the same batch. Lantern's simulated LCP is internally inconsistent with its own
   trace on the Match Dashboard: observed FCP and observed LCP are the same paint of the same
   static element (1,222 ms), and it reports simulated FCP 1,209 ms against simulated LCP 8,750 ms.

**This goes to Juan for a ruling (see the open question below), not to more work.**

#### Task 8 — R3, the pipeline batch

All twelve landed as one change, followed by one re-extract. Two of them touched a shipped
guarantee; the other ten are exit-code honesty, cleanup guarding, staging hygiene and docstring debt.

- **P10 — a SUCCESSFUL emission could exit 2.** `clear(backup)` ran outside the guarded block, so an
  `OSError` removing a retired backup propagated into `emit.main`'s `except (OSError,
  AssertionError): return 2` and printed *"emission could not run"* over a `data/matches/` that had
  already been completely and correctly replaced. Found independently by all three review layers.
- **P11 — cleanup inside the failure handlers could REPLACE the exception it was cleaning up
  after.** Worst in the two rollback loops, where a failure mid-undo discarded the cause AND left
  the tree half-swapped — the state those docstrings promise cannot occur.
- `clear_quietly` names 1.18's own rule once, for every caller: *"a failure to remove a scratch
  directory must not turn a successful emission into a failed one."* The leftover is not silent —
  everything the module creates is gitignored, and the NEXT run's `clear()` is not quiet.
- **P12 — the near-miss renderer never re-filtered.** Worth stating precisely, because it is easy to
  read as "the summary was lying" and it was not: `_mirror_self_validation` filters zero deltas
  before they reach the manifest, so the shipped production figures were correct. What was wrong was
  the shipped aggregate TEST, which built entries carrying 17 and 84 zero deltas and asserted
  `104/104` for both — a false expectation that would have gone green over a renderer that lost its
  filter. Both now apply the same predicate, including the `bool`-is-an-`int` guard.
- P13 the orchestrator catches any exception, not only `SystemExit`, so a `ValueError` no longer
  exits **1** — "a real finding" — when the truth is **2**, "the harness could not run".
- P14 `len(gaps)` / `len(orphans)` move inside the `try` that exists to reject off-shape manifests.
- P15 `swap.py` uses its own shape-agnostic `clear()` instead of `rmtree`/`unlink`.
- P16 `emit_index` clears a leftover staging sibling first, as `emit_bundles` already did.
- P17 `MANIFEST_VERSION` 1 → 2, keeping the `.get` (ruled by Juan 2026-08-07).
- P18 the `pass-network-top5-pct` exclusion rationale reaches `bounded_check`'s docstring — **and
  its recorded REASON is corrected**: "would produce a `104/104` line carrying no information" is
  contradicted by two other bounded checks that render `104/104` usefully. The real reason is that
  its delta is a difference between two independently-rounded percentages, so its magnitude is a
  rounding artefact rather than a measure of anything.
- P19 Task 4.3's three-way match-id collision note reaches `run_batch`'s docstring.
- The near-miss `+` is gone (ruled by Juan): every producer feeds an `abs()` or a one-directional
  shortfall, so the glyph asserted a direction the data does not carry.

**THE PROOF, and it is stronger than 1.19's because it spans a fingerprint change rather than
holding within one:**

| assertion | result |
|---|---|
| `code_version` | `ad4735a216e2` → **`1d3a32f1ec55`** |
| the twelve edits reproduce the committed `/data` | **1,411 of 1,411 artifacts BYTE-IDENTICAL** (SHA-256, file by file); `git status --short data/` empty |
| a second run is a no-op | `extracted 0 / failed 0 / skipped-unchanged 104` |
| phases | `run`/`emit`/`profiles`/`index` PASS; `ingest.batch` exits 1 on the two adjudicated reports |
| `PIPELINE RESULT` | `FAIL (5 of 5 phase(s) run)`, exit 1 — the ruled-clean outcome |
| pipeline suite | **1,782 passed, 4 skipped, 0 failed** across all 49 files, in nine chunks |
| the two adjudicated deviations | the same two reports, the same two numbers — tripwire clean, no third |

1.19's Dev Agent Record is **superseded by appending**, never rewritten: its run records are a
faithful account of 2026-08-07, and the re-rendered summary Decision 4 required sits beside them.

#### Task 9 — launch

**9.1 The build chain is green end to end**, and it is one step longer than it was:
`lint --max-warnings 0` → `typecheck` → `assert:schema-version` → `next build` → `copy-data` →
**`assert:no-external-origins`**. 1,406 pages, 12,683 text assets scanned, **0 external
subresources**.

**9.2 The bandwidth model, measured rather than estimated.** The export is 109.7 MB across 14,105
files — and nobody downloads the export. A REAL SESSION, cache on (`_next/static/**` ships
`max-age=31536000, immutable`), against a compressing host:

| step | on the wire | running total |
|---|---|---|
| arrive on the Hub | 404.1 KB | 404.1 KB |
| open a match | 58.0 KB | 462.1 KB |
| open a player | 118.9 KB | 581.0 KB |
| open a team | 32.2 KB | 613.2 KB |
| compare two players | 62.6 KB | 675.7 KB |
| read the glossary | 15.0 KB | **690.7 KB** |

**A six-route session costs 691 KB.** Against the two plan shapes ARCHITECTURE-SPINE.md:235 names:

| plan | sessions per month at 691 KB |
|---|---|
| legacy Starter, 100 GB/mo | **~151,800** |
| credit-based, ~15 GB/mo effective | **~22,800** |

Either shape clears a portfolio piece by orders of magnitude, so **the account-model question does
not gate the launch** — it only decides which ceiling is being approached, and neither is close. The
documented fallbacks (Cloudflare Pages, GitHub Pages) remain a config move, not an architecture
change, and are not needed.

**9.3 `$0/month`, verified rather than assumed.** No `netlify/` functions directory; no
`middleware.ts`; no `_redirects`, `_headers` or `.netlify` in the export; the only `process.env` in
runtime code is a `NODE_ENV` guard on a dev-only i18n warning, which is a compile-time constant in
the export; no analytics, telemetry or beacon library anywhere in `app/src`; and the origin gate
proves 0 external subresources over 12,683 assets. `netlify.toml` publishes `app/out` with
`NETLIFY_NEXT_PLUGIN_SKIP = "true"`, which is the AD-13 chain verbatim.

**9.4 / 9.5 / 9.6 — BLOCKED ON CREDENTIALS, and this is the one thing R4's authorisation cannot
supply.** R4 authorises the ACTION; it cannot authenticate the accounts.

- `netlify status` reports **"Not logged in"**, and `netlify login` is an interactive browser OAuth
  flow. Nothing can connect the repo or publish without it.
- `git push origin main` **403s**: `Permission to juanrojasdp/wc-stats.git denied to
  juancamilo-pharosgraph`. `gh auth status` lists only `juancamilo-pharosgraph` and
  `juanrojas-bolton` and BOTH are denied; the `juanrojasdp` account the story names is no longer in
  the keyring, so `gh auth switch -u juanrojasdp` fails too. (The active account was restored to
  what it was before the attempt.)

**16 commits are ready on local `main`** and the export is built and verified. What is owed is two
`login` commands, not any further work on the site.

#### Task 10 — the ledger closes

All **66 blocks** naming 2.19 (74 raw mentions) carry a disposition, **appended and never rewritten**
(D12): 32 implemented, 6 ruled, 8 re-deferred each with a named successor AND a stated reason, 7
already-closed with the corrections this story owes. **L1504 is not among the re-deferrals** — D15
pulled it back out and its disposition is "implemented here"; **L147 / L2697 / L3227 close as
ACCEPTED** per D17, not as re-deferrals.

Since 2.19 is the last story, "re-deferred" names a successor CHANGE-SET rather than a story that
exists, and each one states the trigger that would reopen it. The heatmap's trigger has already
**fired with a negative answer**: 1.16 has emitted, and `crosses`, `defensiveActions` and
`receiving` are null on 104/104, so a heatmap built now would bin nothing.

**The correction that matters most is the third one, because it has now been carried forward three
times:** the **153-marker defensive-actions cluster-density figure is wrong for shipped data.** It
was measured over *staged extraction records*; `events.defensiveActions` is null on 104/104 in the
EMITTED bundles, so the section renders its whole-section empty state on every match and there are
no markers to cluster. Anything quoting 153 must quote the correction with it.

Two corrections this story owes to its OWN measurements are appended beside the rest, because a
ledger that only records other people's errors is not a ledger: the reflow predicate that reported
654 overflowing elements on a route whose document did not overflow at all, and the two Lighthouse
rounds taken against a server that served everything uncompressed.

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

**Task 3 — R1, the pass-network re-scope.** The predicate now admits `nodes === null` alongside a
non-empty edge array, and the section renders the pass matrix as a sortable table with no figure.
Before this, all 104 real matches rendered an `EmptyStatePanel` over 23,597 edges sitting in the
bundle.

- **D7's three shapes are pinned exactly as ruled**, plus the two that surround them: `(null,
  edges)` → ready; `([], edges)` → **empty**, deliberately, because 1.14 binds the emitter to `null`
  never `[]` and routing `[]` down the populated branch hands the figure a network with no positions
  (one throw per edge into the error boundary instead of an honest empty state); `(null, null)`,
  `(null, [])` → empty; and 2.8's both-populated case unregressed.
- **The matrix needed a name source, which the story did not call out.** `passEdgeRows` resolves
  endpoint names from the NODE index and returns `[]` outright when there are no nodes — so relaxing
  the predicate alone would have shipped a section whose every row read `—`. New `rosterIndex` +
  `passMatrixRows` resolve names from the roster instead.
- **`passMatrixRows` deliberately does NOT throw on an unresolved endpoint**, where `passEdgeRows`
  does. That throw exists because a figure cannot draw an edge whose endpoint has no position; with
  no figure, an unresolved name is a missing name, which `PassEdgeRow.fromName: string | null`
  already models and the table renders as the ruled unknown glyph. Throwing would take down the only
  surface this data has over one cell. Both builders share one comparator, and a test asserts the two
  paths produce byte-identical rows on the fixture so the orders cannot drift.
- **One locale key minted** (`viz.passNetwork.matrixOnlyNote`, both locales) after checking that none
  covered it: `zero` is the per-team empty state and `tactical.empty.*` is whole-section absence,
  and neither says "the connections are here, the figure is not". The copy states that the reports
  carry no average-positions page at all rather than implying a pending feature.
- **The table stays behind `ViewDataDisclosure` (SM-C2 applied, not dodged).** A match averages 227
  edges; that many rows of four sortable columns in the initial DOM of a Lighthouse-≥90 route is
  exactly the density trade SM-C2 rules on — behind disclosure, never deleted. The connection count
  renders outside the disclosure so a reader knows what is behind it.

**Task 4 — real-data verification at scale.** Everything the story asked to verify holds, and the
three ledger items in it are closed: A6 (all 48 team slugs resolve, 0 dead links corpus-wide), A32
(the five null goalkeeping sub-blocks close their gates and `viz.goalkeeping.gateNote` renders on
every sampled match — no code was owed and none was written), A25 (the zone-sum gate passes over the
emitted corpus and reproduces the pipeline's own figure).

**A28 was half-done already, and the remaining half was one line.** The ledger names two hand-written
`/teams/` literals; `LeaderboardsSection.tsx` already routes through `teamHref`. Only
`LeaderboardsRegion.tsx:454` was left — in the same table whose entity column twenty lines above
already used the helper, so one component shipped the route shape two different ways. Repointed.

**The cutover broke a test on SCALE, not on data, and it took two fixes.**
`static-output.test.ts`'s header-search block calls `everyRouteHtml()` in seven cases. On fixtures
that was 7 × 13 documents; at real data it is 7 × 1,406 (~245 MB of `readFileSync` across the block),
and the suite went red on a **timeout** rather than an assertion. Memoising cut it to one read, which
was not enough on its own — that single read of ~35 MB still exceeded vitest's 5 s default under
ten-worker contention, so whichever case ran first failed. The read is now warmed in a `beforeAll`
with its own 60 s budget, on `assert-schema-version.test.ts`'s documented precedent. Green on three
consecutive full runs at 13.5 s. Raising the timeout alone would have made the same waste take
longer; this is the shape of defect the cutover exists to surface.

**A4/A11 fold into 4.1's bijection**: the 104-at-scale Hub and the `m082` fourth route are covered by
the exact manifest↔export match, and `players`/`goalkeeping` are populated on 104/104 at real data
(the null branches A11 wanted exercised are not reachable there; the census in 4.4 records what does
render).

**A10 — RULED: yes, a unit-test run re-walks the whole corpus.** ~8.5 s of a ~20 s suite, walking
1,411 artifacts. Kept because the gate is the only thing between a schema drift and a published site,
`npm test` is where it can fail in seconds rather than after a 91 s build, and sampling would test
something other than what ships. Recorded that this cost is **not** new at the cutover: `DATA_DIR`
resolves to `<repo>/data` independent of `DATA_ROOT`, so the gate always walked the real corpus — the
test's name ("passes on the current fixture tree") was wrong before the flip, and is now corrected.

#### Task 9.4 / 9.5 / 9.6 — the launch

**🚀 LIVE: https://wc-stats-2026.netlify.app**

| | |
|---|---|
| Netlify project | `wc-stats-2026` (id `54b98a3d-9cd1-47e5-b53d-03aeb42d6cc2`) |
| account | `juancr-dev`, plan **Free** — this settles the AR-17 / ARCHITECTURE-SPINE.md:235 question by observation rather than assumption: it is the **credit-based** shape, not legacy Starter |
| admin | https://app.netlify.com/projects/wc-stats-2026 |
| repo | https://github.com/juanrojasdp/wc-stats — `main`, pushed |
| functions / edge functions | **0** (`/.netlify/functions/` returns 404 on the host) |
| published | 14,105 files, `state: ready` |

**Credentials, and what R4 could and could not authorise.** R4 authorises the ACTION; it cannot
authenticate the accounts, and both were blocked. `netlify status` reported *"Not logged in"* and
`netlify login` is an interactive browser OAuth flow; `git push` returned **403** for both accounts
`gh` held (`juancamilo-pharosgraph`, `juanrojas-bolton`) because the repo belongs to `juanrojasdp`,
which was no longer in the keyring. Juan logged in to both; the push and the deploy then went
through. Recorded because "authorised" and "able" are different things and the story's Task 9.4 note
(`gh auth switch -u juanrojasdp`) assumed a keyring state that had changed.

**Two defects the LIVE HOST revealed that the export could not.** This is exactly why 9.5 verifies
the deployed site rather than `out/`.

1. **The site published behind Netlify SSO — every route returned 401.** New projects on this
   account inherit `sso_login: true` at context `all`, so the first deploy was readable only by team
   members. A site nobody can read is not published. Disabled at SITE level
   (`updateSite {"sso_login": false}`); `listSites` confirms it is the only project on the account,
   so nothing else was touched.
2. **Netlify served the hashed assets with `public, max-age=0, must-revalidate`, not `immutable`.**
   That is the right default for files whose names do not change — but everything under
   `_next/static/` carries a CONTENT HASH, so its bytes can never change under that URL. As shipped,
   every repeat visitor paid a conditional round-trip per asset (21+ on the Hub) to be told nothing
   had moved. It also meant the bandwidth model recorded under 9.2 was measured against a harness
   that assumed `immutable` while the real host did not. A `[[headers]]` block scoped to
   `/_next/static/*` fixes it; verified against the host after redeploy:

   | URL | `Cache-Control` on the live host |
   |---|---|
   | `/_next/static/chunks/*.js` | `public,max-age=31536000,immutable` |
   | `/` | `public,max-age=0,must-revalidate` |
   | `/data/index/tournament.json` | `public,max-age=0,must-revalidate` |

   The documents and the `/data` artifacts KEEP `must-revalidate` deliberately: their URLs are
   stable and their bytes DO change between deploys, so a year of caching would pin readers to a
   stale tournament.

**9.5 — the live site, 8 routes × {dark, light} × {es, en} = 32 cells, in a real browser.**

| assertion | result |
|---|---|
| `<html lang>` matches the reader's locale | **32/32** |
| theme class matches the emulated preference | **32/32** |
| `<h1>` localised (e.g. "El torneo" / "The tournament") | **32/32** |
| external requests | **0** |
| uncaught JS errors | **0** |
| `/data` artifacts fetched, same origin | 1–3 per route, 0 elsewhere |

And over HTTP directly: all 8 routes plus 5 artifacts return 200 with `content-encoding: br` from
the CDN, and `/nope-404/` returns a real **404**.

**AC 2 ON THE REAL HOST — THE GATE PASSES.** Re-measured against production rather than against the
local harness. Lighthouse 13.4.1, mobile, **median of 5 runs**, `benchmarkIndex` printed because it
is part of the reading:

| route | perf (min–max) | a11y | BP | SEO | FCP | LCP | TBT | CLS | SI | benchmarkIndex |
|---|---|---|---|---|---|---|---|---|---|---|
| **Match Dashboard** | **90** (70–92) | **100** | 96 | 100 | 1.1 s | 2.2 s | 358 ms | 0.000 | 1.8 s | 1791–2358 |
| **Tournament Hub** | **92** (46–94) | **100** | 96 | 100 | 1.1 s | 3.2 s | 153 ms | 0.044 | 2.1 s | 1764–2415 |
| `/compare` | 98 (81–100) | **100** | 96 | 100 | 0.9 s | 2.3 s | 105 ms | 0.000 | 1.6 s | 470–2198 |
| Player Profile | 89 (53–97) | **100** | 96 | 100 | 1.0 s | 1.5 s | 415 ms | 0.000 | 2.2 s | 2279–2608 |
| Team Profile | 90 (90–92) | **100** | 96 | 100 | 1.0 s | 2.7 s | 275 ms | 0.010 | 2.1 s | 2098–2693 |

**AC 2's gate — mobile performance ≥ 90 on Match Dashboard and Tournament Hub — is MET on the host
the site actually runs on.** An independent earlier median-of-3 read 94 and 90, so the result
reproduces across two batches.

**The same build measured 88 and 86 against the local server**, and the difference is not new work on
the site. It is that a local server — even one that compresses correctly, sends a real
`content-length`, keeps connections alive and mirrors the host's cache-control — still does not model
a CDN edge: TLS session reuse, HTTP/2 multiplexing over one connection, and origin proximity are all
absent. LCP is where it shows: 3.7 s / 3.8 s locally against **2.2 s / 3.2 s** on the host.

**This is material to D19**, which Juan ruled against the local numbers before these existed. See the
note appended to D19.

*The min–max spread is wide (70–92, 46–94) and that is network variance measured over the public
internet from a working desktop, not site variance — the medians and both batches agree, and the
single 46 is one run whose observed first paint was 2,267 ms against a 783–1,048 ms norm.*

**9.6 — publishable as the portfolio piece (SM-6).** The repo is public at
`github.com/juanrojasdp/wc-stats` with `main` pushed and the live URL above serves it. What makes it
presentable rather than merely deployed: 1,406 pre-rendered routes over the real 104-match corpus,
zero external requests on every route, WCAG 2.1 AA with **axe reporting 0 violations across 32
route × theme × locale cells**, a full ES/EN toggle, and `$0/month` with 0 functions.

**One thing to record honestly about HOW it was published.** This was a CLI deploy of the
already-built `app/out` (`netlify deploy --prod --dir app/out --no-build`), not a git-connected build.
The AD-13 chain ran locally and green — `lint --max-warnings 0` → `typecheck` →
`assert:schema-version` → `next build` → `copy-data` → `assert:no-external-origins` — and its output
is exactly what was uploaded, so the published bytes are the chain's bytes. What is NOT yet true is
that Netlify re-runs that chain on push: connecting the repo needs a GitHub↔Netlify OAuth grant in
the UI. `netlify.toml` already carries the correct `base`/`command`/`publish` for it, so connecting
the repo is a click, not a change. Filed for whoever wants CI deploys.

### File List

84 files across the whole story (`git diff --name-status 7f28e44..HEAD`), grouped by what they
are. **A** = added, **M** = modified. No file was deleted.

#### App — new (8)

- `app/scripts/assert-no-external-origins.mjs`
- `app/src/components/TournamentHub.test.tsx`
- `app/src/lib/assert-no-external-origins.test.ts`
- `app/src/lib/data-root-agreement.test.ts`
- `app/src/lib/reflow-guards.test.ts`
- `app/src/lib/use-in-view.test.tsx`
- `app/src/lib/use-in-view.ts`

#### App — modified (63)

- `app/package.json`
- `app/scripts/assert-schema-version.mjs`
- `app/src/app/matches/static-output.test.ts`
- `app/src/app/page.tsx`
- `app/src/app/static-output.test.ts`
- `app/src/components/AttributionFooter.tsx`
- `app/src/components/CompareChartsSection.tsx`
- `app/src/components/CompareRegion.tsx`
- `app/src/components/CompareRows.tsx`
- `app/src/components/DataTable.tsx`
- `app/src/components/DefensiveActionsSection.tsx`
- `app/src/components/ExpertLayer.tsx`
- `app/src/components/GoalkeepingSection.tsx`
- `app/src/components/KeyStatisticsSection.tsx`
- `app/src/components/LeaderboardsRegion.tsx`
- `app/src/components/LeaderboardsSection.tsx`
- `app/src/components/LineupsDisclosure.tsx`
- `app/src/components/MatchBundleRegion.tsx`
- `app/src/components/MatchHero.tsx`
- `app/src/components/MomentumSection.tsx`
- `app/src/components/MovementToReceiveSection.tsx`
- `app/src/components/NotFoundContent.tsx`
- `app/src/components/OffersToReceiveSection.tsx`
- `app/src/components/PassNetworksSection.tsx`
- `app/src/components/PhasesSection.tsx`
- `app/src/components/PitchPanel.tsx`
- `app/src/components/PlayerProfileRegion.tsx`
- `app/src/components/PressingSection.tsx`
- `app/src/components/SetPlaysSection.tsx`
- `app/src/components/ShotMapsSection.tsx`
- `app/src/components/SiteHeader.tsx`
- `app/src/components/StoryStatTiles.tsx`
- `app/src/components/TacticalCharts.tsx`
- `app/src/components/TacticalLayer.tsx`
- `app/src/components/TeamProfileRegion.tsx`
- `app/src/components/TournamentHub.tsx`
- `app/src/components/TournamentHubRegion.tsx`
- `app/src/components/TrendsSection.tsx`
- `app/src/components/ViewDataDisclosure.tsx`
- `app/src/components/glossary-marking.tsx`
- `app/src/lib/assert-schema-version.test.ts`
- `app/src/lib/build-data.ts`
- `app/src/lib/data.ts`
- `app/src/lib/glossary.ts`
- `app/src/lib/hub-model.ts`
- `app/src/lib/i18n.test.ts`
- `app/src/lib/match-hero.test.ts`
- `app/src/lib/table-sort.ts`
- `app/src/lib/tactical-sections.test.ts`
- `app/src/lib/tactical-sections.ts`
- `app/src/lib/tournament-index.test.ts`
- `app/src/locales/en.ts`
- `app/src/locales/es.ts`
- `app/src/viz/goalkeeping-model.test.ts`
- `app/src/viz/goalkeeping-model.ts`
- `app/src/viz/pass-network-model.test.ts`
- `app/src/viz/pass-network-model.ts`
- `app/src/viz/phases-model.ts`
- `app/src/viz/pitch-geometry.test.ts`
- `app/src/viz/pitch-geometry.ts`
- `app/src/viz/player-profile-model.test.ts`

#### Pipeline — modified (8, R3's batch)

- `pipeline/extract/__init__.py`
- `pipeline/ingest/batch.py`
- `pipeline/orchestrate.py`
- `pipeline/precompute/emit.py`
- `pipeline/precompute/index.py`
- `pipeline/precompute/profiles.py`
- `pipeline/precompute/swap.py`
- `pipeline/tests/test_ingest_batch.py`

#### Deploy configuration (2)

- `.gitignore`
- `netlify.toml`

#### Artifacts and docs (6)

- `_bmad-output/implementation-artifacts/1-19-full-batch-run-batch-report-104-104-acceptance.md`
- `_bmad-output/implementation-artifacts/2-19-performance-accessibility-hardening-real-data-swap-launch.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md`

> **`data/` is unchanged and that is the point.** The pipeline re-extract at the new
> `code_version` reproduced all 1,411 emitted artifacts byte for byte, so no data file appears
> in this list. `app/out/` and `.netlify/` are gitignored and do not appear either.

---

## Change Log

| Date | Change |
|---|---|
| 2026-08-25 | **LAUNCHED — https://wc-stats-2026.netlify.app** (Netlify project `wc-stats-2026`, account `juancr-dev`, plan Free, 0 functions, 14,105 files). 32/32 live route x theme x locale cells clean: 0 external requests, 0 JS errors, correct `<html lang>`. Two defects the live host revealed and the export could not: the site published behind Netlify SSO (401 on every route) and the hashed assets were served `must-revalidate` rather than `immutable`. Both fixed and re-verified against the host. **AC 2's gate PASSES on production: 90 and 92, median of 5** (88 / 86 against the local harness). |
| 2026-08-25 | **Tasks 5.7-5.9, 6, 7, 8, 10 complete; 9.1-9.3 complete, 9.4-9.6 blocked on credentials.** SM-C2 on the Hub and L1504 taken (D15); the reflow matrix run and R2/D8 landed across SIX owners rather than three; axe driven to **0 violations across 32 cells** from 2 rules / 66 nodes; the four event logs given row headers; the ~25 unnamed tables given announcement identifiers; A13/A14/A15/A18/A29 implemented and A20 verified already-closed; R3's twelve pipeline edits applied with a **byte-identical** re-extract at a new `code_version`; and the ledger closed with a disposition for all 66 blocks. |
| 2026-08-25 | **D19 ruled by Juan: AC 2's Lighthouse floor — accept and record the gap.** 88 (86-91) and 86 (84-94) against a floor of 90, from 83/68 at the start of the story. The largest single movement in Task 5.9 came from finding that the measurement server had been serving everything UNCOMPRESSED (a harness rewrite wrote literal backspace bytes into its content-negotiation regexes): the same build measured 76/65 against it and 90/85 against a compressing one. |
| 2026-08-25 | Q2–Q5 ruled by Juan and folded in as D15–D18. Q5 → option 3: SM-C2 on the Hub **and** L1504 pulled back out of Partition C, so both gated routes go for Lighthouse ≥ 90 and bundle/code-split work is in scope. Q2 → take A29. Q3 → accept ES canonical. Q4 → take all three copy items. Tasks 5.7–5.9, 6.16, 7.8–7.9 added; 5.4/5.5 unblocked. |
| 2026-08-09 | Story context created. Ledger swept: 66 blocks partitioned (32 implement / 6 rulings / 9 re-defer / 7 already-closed). Viewport blocker solved and proven. Real-data census, payload budgets, collation and name-escaping measured at creation. R1–R4 ruled by Juan. Status → ready-for-dev. |

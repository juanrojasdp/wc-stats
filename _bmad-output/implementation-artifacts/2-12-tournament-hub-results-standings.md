---
baseline_commit: 74b1789f5f2b302c3abe601730ee514b4395ad02
---

# Story 2.12: Tournament Hub — Results & Standings

Status: done

## Story

As Mariana,
I want full results and standings by stage and group,
so that I can find any match and see how the tournament unfolded (FR-25, UJ-4 entry).

## Acceptance Criteria

> **Numbering note.** `epics.md:859-879` carries three *unnumbered* Given/When/Then blocks. The five ACs below split each `Then`/`And` clause into its own testable statement. This numbering is editorial, not quoted. Source text is reproduced verbatim under each.

**AC1 — Artifact order and `rank` verbatim.**
Given `tournament.json`, when `/` renders, then results and standings display by stage/group **in artifact order with the pipeline's explicit `rank` rendered verbatim — no client-side recomputation** (AR-5).

**AC2 — Reachability and cross-links.**
All 104 matches are reachable from the results listing, every result row links to its Match Dashboard, and standings rows link to Team Profiles (UX-DR22).

**AC3 — Result chips.**
Given result chips, when they render, then each shows **fill + letter** (V/E/D es, W/D/L en) — never colour-only — **inside the linked row** (UX-DR7 family, UX-DR19).

**AC4 — `<md` presentation.**
Given a `<md` viewport, when Hub tables render, then fewer default columns show behind a **"Más columnas"** disclosure with **sort still available on all columns via the sort menu** (UX-DR17).

**AC5 — Payload budget.**
The Hub loads **only** `tournament.json` + `leaderboards.json` within the combined 500 KB budget (FR-34 / NFR-1 / AD-4).

---

## Scope Boundary — read before writing code

**This story is `app/` + `app/src/locales/` ONLY.** Do not touch `pipeline/`, `data/`, or `contract/`. Stories 1-17 and 1-18 are in flight in `pipeline/` and will create `data/index/`. **Never `git add -A`** — stage only the files you wrote.

| In scope (2.12) | Out of scope | Owner |
|---|---|---|
| `/` route: results listing + standings tables | Leaderboards rendering, top-3 teaser, metric→label map | **2.13** |
| `tournament.json` consumption | `leaderboards.json` consumption | **2.13** |
| Result chips (first consumer) | `/teams/{slug}` page itself | **2.16** |
| `<md` column disclosure + sort menu (new) | `/players/{slug}` page itself | **2.15** |
| Minting standings/result locale keys | Real-data swap, 104-at-scale verification, Lighthouse | **2.19** |

**Boundary evidence (do not re-litigate):** 2.12's rendering AC is scoped `Given tournament.json` (`epics.md:867`); 2.13's is scoped `Given leaderboards.json` (`epics.md:889`). `leaderboards.json` appears in 2.12 exactly once, inside a *budget* clause. `contract/leaderboards.schema.json:5` states "**Story 2.13 maps each code to its locale label**". The top-3 teaser is explicitly 2.13's (`epics.md:891`).

**Leave a slot, do not build it.** UJ-4 step 2 taps into "Líderes del torneo" as a section *within* `/` (`EXPERIENCE.md:183`); there is no `/leaderboards` route in the IA table. Compose `/` so 2.13 can mount its section without restructuring your page.

---

## Ruled Decisions

These resolve every ambiguity found during context creation. **Follow them; do not re-derive.**

### D1 — Data path: build-time metadata, client fetch for the tables

AD-11 defines **exactly two data paths** and bans a third (`ARCHITECTURE-SPINE.md:110`). For `/`:

- **Build time** — `readTournament()` from `@/lib/build-data` for `<title>`/OG metadata only.
- **Runtime** — `fetchArtifact<Tournament>("/index/tournament.json")` from `@/lib/data` for the tables.

**Why:** the Hub's hero altitude is the leaderboards teaser (`EXPERIENCE.md:226`, 2.13's); results/standings are "everything below the Hero", which AD-11 assigns to the client fetch. AD-11 also bans "inlining full bundles into HTML" — the full-scale artifact is ~400 KB raw (measured below), which must not become HTML. FR-26's "**the initially loaded** Tournament Index" confirms the index is loaded as an artifact.

`data.ts:14`'s own docblock names `"/index/tournament.json"` as its example path.

> **Do not copy `MatchBundleRegion`'s comment literally.** `MatchBundleRegion.tsx:19` says "*FR-34: no tournament.json at runtime*" — that rule is scoped to the **match route**, which needs only its own bundle. It does not bar the Hub from fetching its own index.

**Mirror `MatchBundleRegion`'s status machine exactly:** `Status = "loading" | "loaded" | "error" | "invalid"`; validate `payload.schemaVersion !== SCHEMA_VERSION` → `"invalid"` (imported from `@/lib/contract/schema-version`, **never hardcoded**); `invalid` gets **no retry button** (re-fetching cannot change the answer); layout-shaped `skeleton` divs with `aria-busy` while loading; a persistent `aria-live="polite"` sr-only region.

### D2 — Standings rows **do** link to `/teams/{id}/`. This departs from 2.8/2.11c.

Ship `href={`/teams/${row.team.id}/`}` (note `trailingSlash: true`).

**Why this differs from the plain-text precedent:** 2.8 (`2-8-...md:360`) and 2.11c (ruling 8, `2-11c-...md:899`) ruled plain text for *player names in expert tables*, and their own code comments give the reason — `PassNetworksSection.tsx:383`: "*Plain text, never a link: /players/{slug} does not exist, **and UX-DR22's cross-link is scoped to LINEUP player names**.*" That second clause is the load-bearing half, and it **does not transfer**: UX-DR22 names "*match header teams → team profiles*", and standings→team is mandated by AC2 itself.

**The controlling precedent is `MatchHero.tsx:103,119`, which already ships `href={`/teams/${teamId}/`}` to this same non-existent route.** Story 2.4 ruled it deliberately (`2-4-...md:45`: "*route ships in 2.16; linking now is intended, UX-DR22*"). `LineupsDisclosure.tsx:34` does the same for `/players/`, and `app/src/app/matches/static-output.test.ts:266-267, 271` pins those hrefs green. (Note: that is the **matches** export test, not the root `app/src/app/static-output.test.ts` — which is the 162-line file Task 8.4 extends for `/`.)

**2.11b decision 12 already recorded this split and declined to resolve it** (`2-11b-...md:606-611`): "*Note the live inconsistency: `LineupsDisclosure.tsx:34` already ships `href={`/players/${playerId}/`}` … yet `src/app/` has no `players` route — a 404 in the static export. That is not this story's to fix.*"

So the repo carries **two contradictory, undeferred precedents**. 2.12's AC demands both link classes explicitly, so it follows the linking precedent — and it is the natural story to file the ledger entry nobody has filed.

**Consequence to accept, not fix:** these links 404 until 2.16. Known debt shared with 2.4 — record it in `deferred-work.md`, do not build a stub route.

Match links (`/matches/{matchId}/`) resolve today — Story 2.4 shipped the route.

### D3 — `rank` is a **column**, never a row index

- Render `row.rank` as a displayed value. Never `index + 1`.
- **Do not sort into rank order.** The array already arrives in rank order (`tournament.schema.json:151` "Rows in rank order").
- **Do not implement any tiebreak logic.** The FIFA cascade is the pipeline's (`tournament.schema.json:101`, `ARCHITECTURE-SPINE.md:68`). `common.schema.json:449` separately pins `Rank` as "*pipeline-computed … never derived from array position by the App*".
- **After a user re-sorts, the `rank` column still shows the pipeline value.** Rank does not renumber.
- `rank` is **not unique and not contiguous** — ties are real. `leaderboards.json` fixture proves the pattern: `rank: 7` appears five times, then jumps to `12`. **Never use `rank` as a React key.**

### D4 — Default sort = artifact order, discharged by the caption

`DataTable` has **no `defaultSort` prop**. `useState<SortState | null>(null)` and `sortRows(..., null)` returns `[...rows]` **verbatim** — `null` *is* artifact order (AD-5). This is exactly what AC1 needs: do nothing and you are compliant.

UX-DR12's "stated default sort per table" is discharged by the **caption string**, which never mutates. Precedent: `ExpertLayer.tsx:871` `caption={t("expert.tableCaption")}` = "Ordenado por equipo y dorsal."

Your captions must state the artifact order, e.g. standings → "Ordenado por posición." / results → "Ordenado por número de partido."

### D5 — 104 is designed for, not asserted against the fixture

**Measured:** the fixture carries **3 matches**, not 104 (see Measured Facts). Do **not** write `expect(matches).toHaveLength(104)` against a fixture that cannot carry it.

What to assert **now** (fixture-verifiable):
1. **Bijection** — the union of `groups[].results[].matchId` and `knockoutResults[].matchId` equals `entities.matches[].matchId`. Holds in the fixture; verified at 2.3 sign-off (`2-3-...md:216`).
2. **Every rendered result row emits a link** to `/matches/{matchId}/` — count links == count rows, for whatever N the artifact holds.
3. **Grouping is total** — unit-test the pure group-by over synthetic rows covering **all 7 `stage` values and all 12 `Group` letters**, asserting no row is dropped and section order is stable. The enums are closed, so this is exhaustive by construction.

Deferred to **2.19** (state this in the story's completion notes): the literal 104 count, real-data reachability, Lighthouse, and the at-scale `<md` behaviour.

### D6 — The App never measures the budget

AD-4 is explicit: "gzip -9 over the canonical serialized bytes, **measured by the Pipeline** (the App never re-measures)". **Do not add a client-side byte check** — it contradicts the architecture and will be reverted at review.

What AC5 obliges you to do is the "**loads only**" half, which is verifiable now:
- Assert the route issues **exactly one** artifact fetch (`/index/tournament.json`) and no others.
- Verify in-browser via DevTools Network that no additional JSON is requested.

> ⚠ **Correction to a widely-repeated claim — do not inherit it.** 2.6's Completion Notes attributed an eager `<script async>` chunk load to "Next's static export". **Its own code review overturned that** (`2-6-...md:668, 692`): the real cause was a **value** import (`CHART_HEIGHT_CLASS`) from a `next/dynamic`-imported module, creating a static module-graph edge that defeated the code split. After the const moved, "*the 316 kB recharts chunk is now referenced by no route's HTML at all*".
>
> **Standing rule: `import type` only across a `next/dynamic` boundary** (held explicitly by 2.10). If you see an eager chunk, look for a value import before blaming the framework.

JS chunks are not artifacts in any case — AD-4 scopes the 500 KB budget to **JSON payload only** ("app-shell weight is governed by the Lighthouse ≥90 budget"). Verify the *artifact* count; do not conflate chunks with payload.

**Measurement method (copy 2.6/2.10's, post-correction):** serve the **built** export — `python -m http.server` over `app/out/` — never `next dev`, which cannot serve `/data/fixtures` (only `copy-data` populates it). Hard-reload before every check: Turbopack reuses chunk filenames across builds here. Then verify in `out/` **which route HTML actually references which chunk**, and check the negative routes too.

**Known gap — now owned, so do NOT file it.** The combined `tournament.json + leaderboards.json` gate does not exist yet: `over_budget` measures exactly one string and `budget.py` is wired only into `emit_bundles`. **Story 1-17 owns building it** (its Task 4.1 appends a combined function reusing `BUDGET_BYTES`). It is already tracked there — do not duplicate the ledger entry.

### D7 — `<md` sort menu is NEW work; the sort *contract* is not

Story 2.11a **explicitly parked** this: "*The DropdownMenu clause is scoped to **Hub** tables — not this story*" (`2-11a-...md:638`). So you build the menu — but you **reuse** everything else.

**Reuse, do not re-mint:** `DataTable`, `TableColumn<Row>`, `table-sort.ts` (`sortRows`, `nextSortState`, `ariaSortFor`, `compareTextNullLast`, `compareNumberNullLast`), `SortAnnouncer`. There must be exactly one sort contract in this codebase.

`app/src/components/ui/dropdown-menu.tsx` **does not exist** — add it on the house pattern of `ui/popover.tsx`: `import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"` (radix-ui@^1.6.5 is **already installed — no new dependency**), `data-slot` attributes, `cn()`, `border-hairline`, **no `outline-none`** (focus comes from the global `:focus-visible` ring).

The menu must **mirror `aria-sort`** (`EXPERIENCE.md:76`) and drive the *same* sort state the header buttons drive — one state, two controls.

> 🔴 **`DataTable` cannot support that today, and this is AC4's blocker.** Sort state is **component-private**: `DataTable.tsx:188` holds `const [sortState, setSortState] = useState<SortState | null>(null)` and `DataTableProps` exposes only `caption`, `columns`, `rows`, `surface`, `sticky`, `tableName`. There is **no `sortState` prop, no `onSortChange`, no controlled mode**, and `SortAnnouncer` carries announcements, not state. An external DropdownMenu has nothing to drive.
>
> **Ruled: `DataTable` gains an optional controlled-sort API** — `sortState?: SortState | null` + `onSortChange?: (next: SortState | null) => void` — **defaulting to the existing uncontrolled path so all current call sites stay byte-identical.** This is an authorized, additive amendment to the 2.11a contract, made by the story AC4 assigns the Hub menu to. **Do not fork the component** — 2.11a decision 1 bans private copies, and a fork would mint the fourth sort contract D7 exists to prevent.
>
> **This also resolves the re-key conflict.** Hoisting the state to the caller means a remount no longer destroys it — see Task 6.5.

**`aria-pressed` — ruled, not inferred.** 2.11a **decision 10** (`2-11a-...md:206-208`), verbatim: "*No `aria-pressed` anywhere. A sortable header's state is `aria-sort` on the `<th>`; adding `aria-pressed` to the inner button would announce two competing states for one control. 2.9 decision 18 established the 'no selection ⇒ no `aria-pressed`' line and it holds here.*" Re-affirmed by 2.11c ruling 9. 2.11a verified **0 `aria-pressed` inside any table**. Your sort menu inherits this: `aria-sort` only.

**One live region only** (2.11a decision 9). Consume `useSortAnnounce()`; render no region of your own. No `role="status"`, no `role="alert"`.

**Pass `tableName` on every table.** The Hub renders many (results per stage/matchday + standings per group), and the ledger entry "*One polite live region serves twenty tables and cannot say which one moved*" notes the mechanism ships and "*the remaining work is copy, not mechanism*". An unnamed table in a multi-table route produces an ambiguous announcement.

**Do not reuse `viz.table.caption`** — it is literally "Ordenado por minuto."

### D8 — Mint the standings/result vocabulary; reuse `enums.stage`

**Reuse (already shipped, `es.ts:1269-1277` / `en.ts:742-750`):** `enums.stage.*` — all 7 codes, exactly the ruled Spanish including "Dieciseisavos de final". **Do not mint new stage names.**

**Mint — the COMPLETE list. Task 7.3's `const KEYS = [...] as const` sweep must cover every line:**

| Group | Keys |
|---|---|
| Chip letters | es `V/E/D`, en `W/D/L` — keyed off the `MatchResult` enum |
| Chip `sr-only` words | Victoria / Empate / Derrota — Win / Draw / Loss |
| Standings column heads | `PJ, G, E, P, GF, GC, DG, Pts` |
| **`headTitle` full terms** | one per abbreviated head — **8 more strings**, mandated by UX-DR17 and Task 3.1 |
| Other column heads | rank, team ("Equipo"), form |
| Surface + page | Hub `<h1>`; "Tabla de posiciones"; **a results-surface heading** |
| **`enums.matchdayRound.*`** | **all 9 codes — no key exists today** (verified: 0 hits in `es.ts`) |
| Disclosure | "Más columnas" **and its collapsed counterpart** — 6.2's two-key variable idiom needs both |
| Sort menu | trigger name, item labels, per-table disambiguator |
| `tableName` | one per table + the composition rule for 12 group tables |
| **Region states** | `hub.region.loading/error/retry/invalid/...` |
| **Zero states** | empty `results` / empty `standings` |

> ⚠ **Do NOT reuse `match.bundle.*` or `tactical.empty.*` — their copy is match-scoped and wrong on the Hub.** Verified: `match.bundle.loading` = "Cargando datos **del partido**" (`es.ts:512`); `match.bundle.invalid` = "Los datos **de este partido** no coinciden…" (`es.ts:519`); `tactical.empty.*` = "…**para este partido**". Mint Hub-scoped copy.

> **Two rows have no entry in `EXPERIENCE.md`'s per-term policy table** — the results-surface heading and `enums.matchdayRound.*`. Author them under the table's own extension procedure and **append them as new rows**; do not invent terminology silently.

**Retire the dead scaffold keys.** Task 1.1 removes the last consumer of `app.scaffold.heading`, `app.scaffold.body`, `app.scaffold.statLabel` and `a11y.scaffold.demoRegion` (`app/src/app/page.tsx` is their only call site). Delete them from both locale files in the same commit, or record why they stay — leaving them is the dead-key defect facing the other way.

`deferred-work.md:1376-1385` routed exactly these keys to "*the owning stories*", because minting keys for an absent surface is the dead-key defect. `app/src/lib/glossary.ts:24-35` records the same. **Strike/close those ledger entries as part of this story.**

> ⚠ **Two letter-system collisions — the most likely silent bug in this story.**
> 1. **`D` inverts across locales:** es `D` = *derrota* (**loss**); en `D` = **draw**. A shared key silently flips meaning on the language toggle.
> 2. **Chips and columns use different letters for the same concepts, in the same row:** chips are `V/E/D`, columns are `G/E/P`. Only `E` coincides.
>
> Key them off the `MatchResult` enum (`win|draw|loss`) — e.g. `enums.matchResult.win` → `"V"` / `"W"` — never off a letter. Pin both locales in `i18n.test.ts` with an explicit assertion that es `D` and en `D` map to **different** `MatchResult` codes.

### D9 — How a row actually becomes a link (the mechanism, not just the rule)

**`DataTable` cannot do this today.** It renders `<tr className={rowDividerClass}>` → `<th scope="row">` / `<td>{column.render(row)}` with **no `rowHref`, no `rowClass`, no `renderRow` override and no `position: relative`**. AC2 is unbuildable without an addition.

**Ruled:** the **row-header cell renders the single `<a href>`**, stretched over the row via `after:absolute after:inset-0`, with the `<tr>` carrying `relative`. Add the minimal hook to `DataTable` (a row-class or `relative`-by-default) as an **API addition** — a private copy of the component is banned by 2.11a decision 1.

**Exactly one `<a>` per row.** Consequences to accept and record:
- text selection inside the row is lost (inherent to stretched links);
- every other cell's content sits **outside** the anchor, so it does not contribute to the link's accessible name — which is why D9 requires an explicit name (below);
- **result-row team names are NOT links.** UX-DR22 scopes team cross-links to the *match header*, not the Hub. Linking them would add a second and third tab stop and nest interactive elements.

**Name every row link explicitly.** A stretched anchor wrapping only a team name yields 48 standings links named by team and 104 result links named by one team — ambiguous in a screen reader's link list. Compose an `sr-only` name at the anchor (`aria-label` is a **gated prop** — build the string into a `const` identifier at the call site) and **read it back out of the live DOM** to confirm it lands.

> ⚠ **This story is the first to put focusable content inside a `DataTable` body**, which activates `DataTable`'s `useLayoutEffect` focus-restore for the first time in the codebase — its own docblock anticipates this moment. UX-DR12's "sorting never loses row focus" therefore goes live here. Sort with focus on a row link and verify the restore, rather than trusting it.

### D10 — The results listing is unspecified anywhere; this story rules it

`EXPERIENCE.md` mentions the Hub results listing exactly once (`:44`, "*every Hub result row → its Match Dashboard*"). `DESIGN.md` describes no Hub results layout at all, and the Responsive table's Hub row (`:135`) is titled "Hub **standings/leaderboards**" — it does not name results. **There is no design to follow, so 2.12 authors one and records it.**

**The sectioning is RULED here, because the story otherwise described two incompatible pages.** Group results are nested *inside* each group in the artifact (`groups[].results[]`), while `matchdayRound` carries three group values (`group-md1/2/3`). "Section per matchday" would flatten 72 results across 12 groups and re-section them by matchday — a **cross-group merge whose ordering the artifact does not carry**, i.e. a derived order AD-5 forbids.

> **Ruled:** results are sectioned **per group, in `groups[]` order, each group's rows in its own `results[]` order**. `matchdayRound` is a **rendered label, never a sectioning key**. Knockout results form **one section per `stage`, in `knockoutResults[]` first-appearance order**. Nothing is sorted anywhere.

Rule and write down the rest, before building:
1. **Component** — `DataTable` or a list. If `DataTable`, D9's mechanism applies.
2. **Which of `MatchResultRow`'s 12 fields render.** `matchNumber`, `date`, `kickoff`, `venue`, `matchdayRound`, `group`, `stage` are all available and **none is currently assigned**.
3. **Row anatomy** — home/score/away order; reuse `match.hero.scoreSeparator` ("–") rather than a literal.
4. **Section headings** — per `stage` or per `matchdayRound`, and the heading string pattern.
5. **Whether result rows carry chips at all** — see D11.

### D11 — Do result rows get chips? Rule it; the AC is ambiguous and the data may not support it

AC3 says chips render "inside the linked row", and `EXPERIENCE.md:82` / `DESIGN.md:290` both scope chips to "standings**/results**". But **`MatchResultRow` carries no `MatchResult` field** — only `score`. A per-result chip would have to **derive** win/draw/loss per team from the score, which is a derivation AD-5 does not obviously bless.

**Choose one and record it:**
- **(i)** Hub chips appear **only** in the standings `form` column, and "results" in those two doc rows refers to the form strings. `form` is the schema's own stated chip source ("*The Hub renders result chips straight from it*"). **This is the lower-risk reading.**
- **(ii)** Rule the per-row derivation explicitly and justify it against AD-5 as a single-surface presentation mapping, not an aggregate.

Do not leave this to be discovered at review — as written, AC3 is satisfied by standings alone.

---

## Measured Facts

Measured directly at story creation against baseline `74b1789` (verified HEAD, clean tree). Trust these over assumptions.

### The fixture is a sample — exact contents of `data/fixtures/index/tournament.json`

| Element | Fixture holds | Real tournament | Fixture coverage |
|---|---|---|---|
| `groups[]` | **1** (group `a`) | 12 (`a`–`l`) | 8% |
| `groups[].standings[]` | **4** rows, `rank` 1–4 | 48 rows | 8% |
| `groups[].results[]` | **2** (both `group-md1`) | 72 | 3% |
| `knockoutResults[]` | **1** (`m074`, `r32`, `decidedBy: shootout`) | 32 | 3% |
| **Total reachable matches** | **3** | **104** | **2.9%** |
| `entities.matches` | 3 | 104 | |
| `entities.teams` | 1 | 48 | |
| `entities.players` | 1 | 1248 | |
| `stage` values exercised | **2 of 7** (`group`, `r32`) | 7 | |
| `matchdayRound` exercised | **2 of 9** (`group-md1`, `r32`) | 9 | |

**Design for the right shape:** iterate `groups[]` — never hardcode one group or 12. Handle all 7 stages and 9 rounds from the closed enums, not from what the fixture happens to show.

### Corpus ground truth (measured across all 104 bundles in `data/matches/`)

`data/matches/` **exists** and holds exactly **104 bundles**, `m001-mexico-south-africa` … `m104-spain-argentina`, no numbering gaps, committed (not gitignored). Story 1.16 emitted them at commit `04f886e`.

```
stage:         group=72  r32=16  r16=8  qf=4  sf=2  third-place=1  final=1   → 104 ✓
matchdayRound: group-md1=24  group-md2=24  group-md3=24  r32=16  r16=8  qf=4  sf=2  third-place=1  final=1
groups:        a b c d e f g h i j k l  (12)
```

`matchId` format is identical to the fixture's, so `/matches/{matchId}/` links are structurally correct today. **`data/index/` does not exist** — 1-17 is generating it.

### Payload budget — measured, with ample headroom

All gzip figures below are **canonical** — `gzip.compress(bytes, compresslevel=9, mtime=0)`, matching `pipeline/precompute/budget.py:47`. They are **15 B lower per file** than shell `gzip -9 <file>`, which writes the source filename into the FNAME header.

| Artifact | Raw | gzip -9 (canonical) |
|---|---|---|
| fixture `tournament.json` | 6,089 B | 1,034 B |
| fixture `leaderboards.json` | 10,927 B | 1,183 B |
| **fixture combined** (sum of gzips) | 17,016 B | **2,217 B** |
| **projected full-scale `tournament.json`** | **~400 KB** | **~34 KB** |

Full-scale projection method: fixture row shapes replicated to real cardinality (104 results, 12 groups × 4 standings rows, 48 teams, 1248 players) using **real** team/player identities harvested from the 104 bundles, so string entropy is realistic. The schema is `additionalProperties: false`, so the field set cannot grow — only string lengths vary.

**Independently corroborated.** Story 1-17's context (created 2026-08-06 against the same baseline) measured the real full corpus at **409,512 raw / 38,934 gzip-9** — within ~2% of the projection above, by a different method. Treat 1-17's figure as authoritative.

**`tournament.json` is not the breacher.** At 38,934 gzip-9 it is **7.8%** of the ceiling, with all 1,248 players listed. The adversarial review's H-3 concern that "`tournament.json` … is the likeliest breacher" (`review-rubric.md:45-48`) is **not borne out**.

> 🔴 **But the COMBINED budget currently FAILS — and the cause is `leaderboards.json`, not your artifact.** 1-17 measured a realistic 36-board full-roster leaderboards at 19,566 rows / **572,276 gzip-9**, giving **611,210 combined against a 500,000 ceiling — FAIL**. Capping player boards at 100 rows lands at **105,779 combined — PASS**.
>
> That cap is **1-17's DECISION D3/D5, left unruled for Juan.** It is not 2.12's to make and not 2.12's to fix. AC5's combined-budget clause is therefore **contingent on a pipeline decision this story does not own** — state that in your completion notes rather than claiming AC5 green on your own measurement.
>
> Also unruled in 1-17 (D3): the *measurement mode* — `gzip_bytes(a) + gzip_bytes(b)` (two HTTP responses, what the Hub actually downloads) versus `gzip_bytes(a + b)`. 1-17 recommends sum-of-gzips. Until it is ruled, do not quote a single combined number as authoritative.
>
> **Never truncate `entities` to save budget** — those lists are the route manifest, and truncating them deletes routes (1-17, explicit).

> Canonical measurement is `pipeline/precompute/budget.py`: `BUDGET_BYTES = 500_000` (**decimal**, not KiB), `gzip.compress(..., compresslevel=9, mtime=0)`. Note its docstring: this is **not** what shell `gzip -9 <file>` reports, because GNU gzip writes FNAME into the header.

---

## Tasks / Subtasks

- [x] **Task 1 — Route shell and data load (AC1, AC5) — D1**
  - [x] 1.1 Replace the Story 2.1 placeholder body in `app/src/app/page.tsx`. Keep it a server component; add `generateMetadata` using `readTournament()` for `<title>`/OG (UX-DR22 "meaningful `<title>`/OG per route").
  - [x] 1.2 Create a `"use client"` region component (e.g. `app/src/components/TournamentHubRegion.tsx`) modelled on `MatchBundleRegion.tsx`: `fetchArtifact<Tournament>("/index/tournament.json")`, the 4-state `Status` union, `schemaVersion` validation against the generated `SCHEMA_VERSION`, no retry on `invalid`, `aria-busy` skeletons, sr-only polite live region.
  - [x] 1.3 Mount **one** `SortAnnouncerProvider` for the route — nothing outside `MatchBundleRegion` mounts one today.
  - [x] 1.4 Leave a named, anchored slot for 2.13's "Líderes del torneo" section. Do not fetch `leaderboards.json`.
  - [x] 1.4b **2.13's context already exists and depends on three things you build here.** `2-13-tournament-leaderboards.md` was written concurrently, read this story, and adopted its seam verbatim: it mounts into your slot, does **not** restructure `page.tsx`, adds **no** `generateMetadata` (yours is authoritative), mirrors D1's status machine for `leaderboards.json`, and **consumes** your `SortAnnouncerProvider` rather than mounting a second one (2.11a decision 9 forbids two regions). So: name the anchor stably, mount the provider at a level that wraps the slot, and own `generateMetadata`. Changing any of the three silently breaks 2.13.

- [x] **Task 2 — Pure model module (AC1, AC2) — testability**
  - [x] 2.1 Create `app/src/lib/hub-model.ts` (pure, no JSX — the test runner is `environment: "node"` with **no jsdom**, so all assertable logic must live outside components).
  - [x] 2.2 Group-by producing ordered sections: the 12 group tables in artifact order, then knockout sections **sectioned by `stage`, preserving `knockoutResults[]`'s artifact order within and across sections — never sorted**. The schema already guarantees "*ordered by stage then match number*" (`tournament.schema.json:35`); re-sorting it is exactly the client-side re-ordering AC1/AD-5 forbid. **Selection and presentation only — never re-ordering, never aggregating.**
  - [x] 2.3 Row-key helper. **Use `matchId` / `team.id`, never `rank`, never array index** (D3 — ranks tie).
  - [x] 2.4 Score display. **`app/src/lib/match-hero.ts:115` already exports `decidedByCaption(knockoutScore)`** — a pure exhaustive switch with a `never` default and a fail-loud null-`shootoutScore` throw, pinned by `match-hero.test.ts`. **Reuse it. Do not write a second switch on `decidedBy`.** The Hub helper composes display strings *around* its result.
  - [x] 2.4b **Rule which score the row prints, and record the reasoning.** `MatchResultRow.score` has **no description in the schema**, and `TeamScore` says only "a home/away goal pair at one point in a match" — it does not say which point. The only knockout fixture (`m074`) has `score` == `scoreAfter90` == `scoreAfterET` == 1–1, so **the fixture cannot disambiguate** whether `score` is the 90' score or the final-including-ET score. For a 1–1 after 90 / 2–1 after ET tie the answer changes what renders. If it cannot be determined from the contract, **raise it to 1-17 as a contract question rather than guessing**.
  - [x] 2.4c Rule whether `winnerTeamId` marks the winner on a shootout row. It is currently unused by any task. Note `match.hero.extraTime` ("Definido en tiempo extra") and `match.hero.shootout` ("Penales:") are **hero-sized caption copy**, not inline row suffixes — if they do not fit a 390 px table row, mint Hub-scoped variants rather than stretching them.

- [x] **Task 3 — Standings tables (AC1, AC3) — D3, D4**
  - [x] 3.1 Build `TableColumn<StandingsRow>[]`: `rank`, team (**`rowHeader: true`**), `PJ, G, E, P, GF, GC, DG, Pts`, form chips. `align: "numeric"` for every count; `headTitle` set to the full term for every abbreviated head (UX-DR17). The Expert per-player table (`ExpertLayer.tsx:508`) is the **only** current consumer of `rowHeader`; the four event logs are not (`deferred-work.md:1877`). Standings are the second consumer.
  - [x] 3.1b **Record a ruling on row-header position.** The open ledger entry objects to `scope="row"` sitting on the *third* column. Here it lands **second**, after the `rank` ordinal, because rank-then-team is the universal standings convention and the ordinal is not a competing identity. State this explicitly; do not leave it to be re-discovered.
  - [x] 3.2 Sort on **semantic** values — raw numerics via `{ kind: "number" }`, team name via `{ kind: "text", valueOf: row => row.team.name }` (routes through `Intl.Collator('es', {sensitivity:'base'})`). Never sort on a formatted string.
  - [x] 3.3 Render `row.rank` as a value. **No initial `SortState`** — leave it `null` (D4).
  - [x] 3.4 Form-chip column: `sort: null` (a sequence has no meaningful order).
  - [x] 3.5 Caption states the artifact order (D4).
  - [x] 3.6 Group heading per group. Reuse the existing "Grupo" key (`es.ts:456`) — precedent pattern "Fase de grupos · Grupo A". Rule whether the group **letter** is copy or data (the contract enum is lowercase `"a"`…`"l"`), where the uppercase transform lives, and whether `match.hero.group` should be promoted to a shared namespace now a second surface consumes it.
  - [x] 3.7 **Every standings row links to `/teams/{team.id}/`** via D9's mechanism (trailing slash). *This lives here, not in the results task — a developer working Task 3 end-to-end must not ship unlinked standings rows.*
  - [x] 3.8 **Rule sticky headers.** UX-DR12 / `EXPERIENCE.md:76` specify a sticky header row for this pattern. `DataTable`'s `sticky` is opt-in and correct **only** inside a caller-rendered height-bounded scroll container, which `DataTable` never renders. Either opt in (and supply that wrapper plus `scroll-padding-top` equal to the header height) or declare a scoped departure with the reason. Do not leave it unstated.
  - [x] 3.9 **Zero rows ⇒ no live sort controls.** When a group's `standings`/`results` array is empty, render the zero state and **suppress the sortable header buttons**. This is an open ledger entry that fires here.

- [x] **Task 4 — Results listing (AC2) — D2**
  - [x] 4.1 Section **per group** then **per knockout stage**, exactly as D10 rules. `matchdayRound` is a label, not a sectioning key.
  - [x] 4.1b **Section anchors and heading hierarchy.** The Hub renders ~19 sections (12 groups + up to 7 knockout stages) plus 2.13's slot. UX-DR18 requires stable deep-link anchors for every section: give each a stable `id`, rule the heading levels (`<h1>` for the page, `<h2>`/`<h3>` per section) so the outline is not corrupted, and set **`scroll-padding-top`** (UX-DR12 / `EXPERIENCE.md:76`) so an anchored or focused section is never occluded by a sticky header.
  - [x] 4.2 Every result row links to `/matches/{matchId}/` (trailing slash).
  - [x] 4.3 Design the listing per **D10** and record the ruling before coding. Decide D11 (chips or not) in the same pass.
  - [x] 4.4 **The row is the link target, the chip is not** (`EXPERIENCE.md:82`) — implement via **D9**. Exactly one tab stop per row; the chip must never become a second; result-row team names are not links. Row target ≥44×44 px (`MIN_HIT_PX`, imported, never re-declared).
  - [x] 4.5 Format dates/kickoffs via `formatDate`/`formatKickoff` from `@/lib/format` — `Intl` only, never hand-formatted. Kickoff is venue-local; add the "hora local" clarifier (`es.ts:458` precedent).

- [x] **Task 5 — Result chip component (AC3) — first consumer**
  - [x] 5.1 Create the chip. **Tokens already exist and have zero consumers:** `bg-result-win|draw|loss` + `text-result-chip-ink`, defined for both themes in `globals.css:88-91` (dark) and `:213-216` (light). Do not invent colours.
  - [x] 5.2 Always **fill + letter**. Letter keyed off the `MatchResult` enum (D8). `{rounded.full}` pill, `type-label-caps`.
  - [x] 5.3 Non-interactive: no `tabIndex`, no handlers, not a button.
  - [x] 5.4 Give the chip an `sr-only` full word (Victoria/Empate/Derrota — Win/Draw/Loss) so the row's accessible name is not a bare letter. Precedent: the `líder` sr-only affix (`es.ts:469`, `StoryStatTiles.tsx`). *A spoken-form rule is not written in the spines — this is a ruled addition; record it as a decision.*

- [x] **Task 6 — `<md` disclosure + sort menu (AC4) — D7**
  - [x] 6.1 Add `app/src/components/ui/dropdown-menu.tsx` on the `ui/popover.tsx` pattern (no new dependency).
  - [x] 6.2 "Más columnas" disclosure. **Copy `ViewDataDisclosure.tsx`'s two hard-won fixes exactly:** (a) `aria-controls` set **only while the region is mounted** — a static one dangles when collapsed, already patched twice, do not break it a third time; (b) build the label key into a **variable**, because `{t(cond ? "a" : "b")}` trips the i18n gate. `min-h-11` for the 44px target.
  - [x] 6.3 Reduced default column set below `md`; **all** columns remain sortable via the menu (AC4). Disclosure **hides columns, never re-fetches and never removes data** (SM-C2; `leaderboards.schema.json:5` states the same rule). Use the existing `useMediaQuery` / `MD_MEDIA_QUERY` (`app/src/lib/use-media-query.ts`) — do not re-declare the breakpoint.
  - [x] 6.3b **Rule the scope and the multiplicity.** `EXPERIENCE.md:135` names *Hub standings/leaderboards*; AC4 says "Hub tables". Decide whether the results listing is in scope. Then decide whether the control is **per-table or per-surface** — 12 group standings tables at 390 px otherwise means **12 disclosures and 12 sort menus**. Record the choice. Scope 6.6's narrow-default ruling to **standings only**; the leaderboards' narrow default is 2.13's.
  - [x] 6.3c Menu items are controls: `min-h-11` (≥44×44, `MIN_HIT_PX`). The trigger takes a **disambiguating accessible name** composed with its table's name — the problem `ViewDataDisclosure`'s `panelTitle` already solves. `Esc` closes the topmost (Radix default — verify it survives your wrapper).
  - [x] 6.4 Menu mirrors `aria-sort` and drives the same `sortState` as the header buttons.
  - [x] 6.5 ⚠ **Do NOT blindly copy 2.11b's `key={isMd ? "wide" : "narrow"}` re-key idiom.** Re-keying **unmounts and remounts** `DataTable`, resetting its private `sortState` to `null` with no announcement — which is verbatim the open ledger defect Task 6.7 forbids. The 2.11b idiom is the *source* of that ledger entry, not a fix for it. With the controlled-sort API (D7) the state lives in the caller and survives a column-set change, so the re-key is unnecessary for correctness — React reconciles a changed `columns` array fine. Re-key only if you find a concrete class-churn reason, and record it.
  - [x] 6.6 Decide and document which columns are the narrow default. **The docs never specify them** — this is your ruling to make and record.
  - [x] 6.7 **Rule what happens to an active sort when the column set changes** (disclosure toggled, or the `md` breakpoint crossed while sorted on a now-hidden column). Two open ledger entries describe exactly this and neither is owned. Minimum bar: the sort must not silently vanish — either preserve it or announce the reversion through the existing polite region. Record the choice as a decision.

- [x] **Task 7 — i18n (AC3, AC4) — D8**
  - [x] 7.1 Mint keys in `es.ts` (canonical) and mirror into `en.ts` — a missing key is a **compile error**.
  - [x] 7.2 Take strings **verbatim** from `EXPERIENCE.md:264-265, 275`. Reuse `enums.stage`.
  - [x] 7.3 Pin the new key set in `i18n.test.ts` (the `const KEYS = [...] as const` sweep over `["es","en"]`), **plus** the es-`D`/en-`D` divergence assertion (D8).
  - [x] 7.4 Compose every multi-part string into a `const` identifier at the call site — `t()` has no interpolation. Separator glyphs are module consts. Use `logLabel`, not `label`, for developer-facing strings (`label` is a gated prop name).

- [x] **Task 8 — Tests**
  - [x] 8.1 `hub-model.test.ts`: group-by totality across all 7 stages / 12 groups on synthetic rows; artifact order preserved; bijection check; no row dropped.
  - [x] 8.2 Rank tests: ties do not collapse; `rank` survives a user re-sort unchanged; keys are not derived from rank or index.
  - [x] 8.3 Link tests: link count == row count; hrefs carry the trailing slash.
  - [x] 8.4 Extend `app/src/app/static-output.test.ts` for the exported `/` HTML, asserting against the **dictionary object** (house convention), under the existing `describe.skipIf(!anyBuilt)` guard.
  - [x] 8.5 Absence states: a group whose `results` is `[]`, a `standings` of `[]`, and the `undefined` path. Assert a real zero state renders and that **no live sort controls appear over zero rows**. `[]` and `null` are distinct states by contract; `undefined` is the third state prior stories forgot.
  - [x] 8.6 **Do not** assert 104 against the fixture (D5). Do not cast a constructible shape with `as unknown as` — build the real object.

- [x] **Task 9 — Verification (carry-forward)**
  - [x] 9.1 Verify **both themes**. 2.6/2.7/2.8/2.9 each found light-theme contrast failures from the first-consumer position, and this is the Hub's first render. Chip ink **inverts** between themes (`#0E1114` dark / `#FFFFFF` light) — confirm both. Expected chip-letter ratios: 10.68/6.35/6.66 dark, 5.36/5.61/5.55 light (`DESIGN.md:290`).
  - [x] 9.2 Verify at **390** and **320** CSS px, **in BOTH locales**. Chrome will not resize below ~500 px — use a **same-origin iframe** (the 2.8 technique). The measurement is **vacuous unless everything is expanded and every disclosure open** first. **Reproduce before attributing:** 2.6 proved the residual 320 px overflow belongs to Key Statistics' tile (2.9 and 2.11a each re-confirmed it, differentially, against a build without their work). At 320 px data tables keep their **internal-scroll** exception — but prove the scroll is on the container, not `<body>` (`EXPERIENCE.md:119`). **The 195 px case is 2.19's — do not attempt it.**
  - [x] 9.2b EN is the risk locale for width: ES standings heads (`PJ, G, E, P…`) are far shorter than their EN counterparts, and the one open `<md`-control overflow in the ledger was found in EN only.
  - [x] 9.3 DevTools Network: confirm no artifact is fetched outside the allow-list. **Write the test as an allow-list — `{/index/tournament.json, /index/leaderboards.json}` — never `toHaveLength(1)`**, which turns red the day 2.13 adds its fetch and tempts 2.13 to weaken it. State in the Completion Notes that **AC5 is partially satisfied**: the `leaderboards.json` half lands in 2.13, and the combined-budget half is contingent on 1-17's D3/D5.
  - [x] 9.6 **Verify the focus-restore that goes live here** (D9): sort a standings table with focus on a row link, then read the restored focus back out of the live DOM. Confirm the focus ring paints on the **row**, not on the anchor's inline text box — `DataTable` sets no `:focus-within` styling on `<tr>` today.
  - [x] 9.4 Confirm no `--ink-muted` on real content (restricted to ≥3:1 non-text/disabled), no zebra striping (hairline dividers only), focus visible on every row and header.
  - [x] 9.5 Browser cache defeats hard-reload on bundle data — override fetch with `no-store` **when verifying only**, never in shipped code.

- [x] **Task 10 — Ledger**
  - [x] 10.1 ⚠ **NARROW that ledger entry — do not close it.** `deferred-work.md:1374-1385` is a **single** CORRECTION covering **three** rows: `result letters & standings columns`, `standings / leaderboards` **and `fouls / duels`**. 2.12 discharges the first two only; `fouls / duels` is separately owned at `deferred-work.md:997` and is still undischarged. Closing the entry wholesale erases a live deferral — and would contradict Task 10.3. Narrow it to `fouls / duels`, and make the same narrowing in the `app/src/lib/glossary.ts:24-35` docblock.
  - [x] 10.2 File: `/teams/{slug}` dangling links pending 2.16 (D2) — the entry nobody has filed despite three stories hitting it; and 104-at-scale verification deferred to 2.19 (D5). **Do not** file the combined-budget gate — 1-17 owns it (D6).
  - [x] 10.3 Check `deferred-work.md:997` (fouls-surface owner, "*or the Tournament Hub*") — confirm 2.11b/c discharged it before assuming 2.12 inherits a fouls column.

### Review Findings

_Code review 2026-08-06. Three parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) over the 2.12-scoped diff against baseline `74b1789`, then triaged against the live tree. 3 decisions ruled, 17 patches applied, 6 dismissed as noise. Juan delegated the three decisions to the review._

**Decisions — ruled**

- [x] [Review][Decision] **Sorting a hidden column from the sort menu unmounted the menu mid-interaction** — `menuController.sortByColumn` called `onRevealColumns()` → the surface expanded → `hiddenKeys` emptied → `hasHiddenColumns` went false → `<TableSortMenu>` and its trigger left the DOM in the same commit Radix closed and tried to restore focus to that trigger. Focus landed on `<body>`, at the top of a 30-table document, on the exact path AC 4 exists for. **RULED (a): the menu is the NARROW-LAYOUT sort control and tracks the breakpoint (`showSortMenu={isNarrow}`), not the hidden-column count.** This reverses the file's first ruling, and the second half of that ruling's premise was also wrong: an expanded eleven-column table at 390 px sits inside `overflow-x-auto`, so reaching the `DG` header button means scrolling the table sideways to hunt for it — the menu is *more* useful expanded, not redundant. Recorded at `HubTable.tsx`.
- [x] [Review][Decision] **`aria-expanded` + `aria-controls` over a region that never collapses** — `#standings-content` / `#results-content` are always mounted and fully visible; only the column set inside them narrows. **RULED: keep `aria-expanded`, drop `aria-controls`.** `aria-expanded="false"` is *true* about the thing that actually toggles — the hidden columns really are `display: none` — while `aria-controls` pointing at a permanently visible div asserts that div is collapsed, which is false ("Más columnas, button, collapsed" over twelve populated tables). `aria-pressed` was the other candidate and is declined: 2.11a decision 10 and 2.11c ruling 9 bar it on this surface, and a button that reveals content is a disclosure before it is a toggle. Recorded at `TournamentHub.tsx`.
- [x] [Review][Decision] **Story 2.13's code rides inside 2.12-owned files** — `DataTable.tsx` (`headAccessibleName`, the unsortable-`<th>` `aria-label`), `static-output.test.ts`, `i18n.test.ts`, `es.ts`/`en.ts` (`leaderboards.*`), `glossary.ts`. **RULED: do not split.** These files are genuinely co-authored and untangling them by hunk is more likely to break both stories than to clarify ownership; both are in `review` and should land together. The File List already discloses the co-ownership. No code change.

**Patches — all applied**

- [x] [Review][Patch] `TableSortMenu.tsx` carried a raw NUL byte (`KEY_JOINER`), so git classified the whole 264-line file as **binary** — `Bin 0 -> 10393 bytes`, no diff, no blame, and skipped by every ripgrep/grep-based check including the i18n self-checks this story's own Dev Notes prescribe. Written as the escape `" "`; the joiner keeps its collision-proof semantics and the file is text again [app/src/components/TableSortMenu.tsx:56]
- [x] [Review][Patch] AC 5 / Task 9.3's fetch allow-list test **did not exist** while the Completion Notes claimed it shipped. Written as a transitive module walk from `src/app/page.tsx` over every `@/` import, asserting set equality with `{/index/leaderboards.json, /index/tournament.json}` — so a third `fetchArtifact` added anywhere under the Hub fails here. Plus a guard-the-guard case (`page.tsx` itself contains no `fetchArtifact`, so a broken walk fails loudly instead of passing vacuously) and a negative on the match-bundle path [app/src/app/static-output.test.ts]
- [x] [Review][Patch] Row links prefetched: four `/teams/*` route requests fired on load at fixture scale (48 + 104 at real scale, re-run on every re-order), all to a route that does not exist until 2.16. Measured and filed as 2.12's by 2.13, unfixed, while the notes claimed the route fetches nothing else. `prefetch={false}` [app/src/components/TournamentHub.tsx]
- [x] [Review][Patch] `row.form` was the one array path `listOf` never normalized, breaking the module's own three-absent-states promise — `row.form.map(...)` on a null/absent form threw and, with no boundary, took the whole route. Now normalized; `team` deliberately left to the boundary, with the reason recorded [app/src/lib/hub-model.ts]
- [x] [Review][Patch] No error boundary around `<TournamentHub>` — `MatchBundleRegion` wraps its payload render in `TacticalErrorBoundary` and this region mirrored everything except that. Wrapped, with Hub-scoped crash copy (`hub.region.crashed*` minted in both locales; the boundary's `match.bundle.crashed*` default reads "de este partido", false on a tournament-wide route) [app/src/components/TournamentHubRegion.tsx]
- [x] [Review][Patch] The kickoff column's `headTitle` re-stated its own head text, so `headAccessibleName` emitted `"Ordenar por Hora (Hora (hora local))"`. Now passes the bare clarifier [app/src/components/TournamentHub.tsx]
- [x] [Review][Patch] UX-DR18 deep-link anchors did not exist at load — every section id lives inside the client-fetched region, so the browser resolved `#results-r32` against a skeleton and never retried. Mount-time hash read plus `hashchange`, copied from `ExpertLayer` / `TacticalLayer` [app/src/components/TournamentHub.tsx]
- [x] [Review][Patch] `es.ts` claimed four newly authored terms were "appended to that table as new rows"; `EXPERIENCE.md` was untouched since 2.18. The rows are now appended under "Rows appended by Story 2.12" — Hub page title, results-surface heading, `enums.matchdayRound.*` (nine codes) and the EN standings abbreviations including the forced `MP` — and the comment corrected [EXPERIENCE.md, app/src/locales/es.ts]
- [x] [Review][Patch] `composeSortAnnouncement` was extracted so two controls could not diverge and shipped with zero tests. Six cases pinned: both directions, the cleared state naming no column, the `tableName` prefix on *both* states, and the bare pre-2.11b shape [app/src/lib/table-sort.test.ts]
- [x] [Review][Patch] `GROUPS`/`STAGES`/`MATCHDAY_ROUNDS`/`MATCH_RESULTS` claimed a compile-time exhaustiveness `readonly Code[]` does not provide — it catches a removed code, never an added one, which is the opposite of AD-2's need and quietly makes `hub-model.test.ts`'s "exhaustive by construction" totality proof partial. Derived from `Record<Code, true>` literals via a `codeList` helper, the shape `i18n.test.ts` already uses [app/src/lib/hub-model.ts]
- [x] [Review][Patch] Dead exports with docblocks asserting consumers that do not exist — `LEADERBOARDS_SLOT_ID` (zero references; `page.tsx` states there is no such slot because 2.13 renders the anchor itself) and `CONTROL_NAME_SEPARATOR` / `CONTROL_NAME_SPACE`. Removed, with the reasoning kept as a comment [app/src/lib/hub-model.ts, app/src/components/TableSortMenu.tsx]
- [x] [Review][Patch] Retry parked focus on the `aria-busy` skeleton, which unmounts when the fetch settles — deferring the caret drop by one round trip rather than preventing it. A settled-state wrapper now receives focus on the transition out, for all three settled branches [app/src/components/TournamentHubRegion.tsx]
- [x] [Review][Patch] A surface with no sections rendered its `<h2>` and a live "Más columnas" control over nothing; the minted zero-state copy is group-scoped and only fires inside a section that exists. Surface-level zero state added to both, and the disclosure suppressed [app/src/components/TournamentHub.tsx]
- [x] [Review][Patch] Comment arithmetic: five places said "nineteen tables" where the route renders **30** (12 group standings + 12 group results + up to 6 knockout stages). The sticky-header departure and the announcement-ambiguity argument both rest on that count [app/src/components/HubTable.tsx, TournamentHub.tsx, TableSortMenu.tsx, app/src/lib/table-sort.ts]
- [x] [Review][Patch] `glossary.ts`'s narrowed docblock contradicted itself in consecutive sentences — "FIVE of the six" then "All four are pinned" [app/src/lib/glossary.ts]
- [x] [Review][Patch] `/` dropped the top padding every other route carries (`pb-` for `py-`), leaving the `<h1>` flush against the sticky header, and both `<h2>`s rendered at `type-headline` — the same scale as the `<h1>` — against the `/about` outline of headline → title [app/src/app/page.tsx, app/src/components/TournamentHub.tsx]
- [x] [Review][Patch] The sort trigger used `type-label-caps`, which despite its name carries **no** `text-transform` (all twenty other consumers pass already-uppercase codes), so it rendered sentence-case beside the uppercase `type-stat-label` heads it drives. Moved to `type-stat-label`; the false claim in `es.ts` naming both classes as uppercasing is corrected. (`ColumnsDisclosure`'s `type-title` is NOT a defect — it is `ViewDataDisclosure`'s shipped button style) [app/src/components/TableSortMenu.tsx, app/src/locales/es.ts]

**Verification after patching.** `eslint . --max-warnings 0` clean; `tsc --noEmit` clean; `next build` → 9 pages exported; `copy-data` ok. Suite: **866 passed / 2 failed of 868**, 28 files — story-owned suites (`hub-model` 34, `table-sort` 28, `i18n` 120, `glossary` 22, `eslint-gate` 40, `static-output` 27) all green. **Neither failure is this story's, and both are filed:**

1. `assert-schema-version.test.ts > "passes on the current fixture tree"` — the known timeout, but the story's recorded mitigation ("passes 3/3 in isolation at 4,434 ms") is now **stale**: re-measured, it fails in isolation too, at **18,192 ms** against the 5,000 ms default, because the tree grew again after 1.17's `ae207ed` and 1.18's profiles. The gate itself is correct; both negative cases pass. It was also filed **twice with contradictory causes and owners** across the 2.12 and 2.13 ledger sections — reconciled in a new ledger entry (both causes real and additive; **owner: Story 1.19**, which owns the full-batch run).
2. `i18n.test.ts > "never nests a parenthetical a call site pre-composed"` — Story 2.13's own new test against Story 2.13's `composeHeadAccessibleName`, which guards `headText.includes(headTitle)` but not the reverse. **Not fixed here deliberately**: the function, the test and the file are 2.13's and that session was editing all three during this review. 2.12's exposure is closed at the call site instead (the kickoff patch above), so no shipped head reaches the unguarded branch. Filed with the one-condition fix and owner.

**Dismissed as noise** — the "Jornada" column sorting its resolved label (every results section holds at most `group-md1/2/3`, whose labels sort alphabetically *and* ordinally; knockout sections hold one value); a third polite live region on `/` (the project allows exactly three and the route has exactly three); duplicate `group` letters minting duplicate ids (not a contract-reachable state); out-of-enum values rendering raw dictionary keys (`DictionaryKey` guards the label-key helpers at compile time); `page.tsx` calling `readLeaderboards()` "against Task 1.4" (2.13 reached the file first and owns that call, disclosed at `page.tsx`); `kickoffSortValue` accepting strings `formatKickoff` rejects (a more permissive sort is not the defect — the missing boundary was, and it is patched).

**Dismissed as noise** — the "Jornada" column sorting its resolved label (every results section holds at most `group-md1/2/3`, whose labels sort alphabetically *and* ordinally; knockout sections hold one value); a third polite live region on `/` (the project allows exactly three and the route has exactly three); duplicate `group` letters minting duplicate ids (not a contract-reachable state); out-of-enum values rendering raw dictionary keys (`DictionaryKey` guards the label-key helpers at compile time); `page.tsx` calling `readLeaderboards()` "against Task 1.4" (2.13 reached the file first and owns that call, disclosed at `page.tsx:27-38`); `kickoffSortValue` accepting strings `formatKickoff` rejects (a more permissive sort is not the defect — the missing boundary is, and it is filed above).

---

## Dev Notes

### Reuse map — build none of these

| Need | Use | Path |
|---|---|---|
| Sortable table | `DataTable` (`surface="canvas"`) | `app/src/components/DataTable.tsx` |
| Column type + sort | `TableColumn<Row>`, `sortRows`, `nextSortState`, `ariaSortFor`, `compareTextNullLast`, `compareNumberNullLast` | `app/src/lib/table-sort.ts` |
| Sort announcements | `SortAnnouncerProvider`, `useSortAnnounce` | `app/src/components/SortAnnouncer.tsx` |
| Disclosure pattern | `ViewDataDisclosure` (copy its two fixes) | `app/src/components/ViewDataDisclosure.tsx` |
| Empty state | `EmptyStatePanel` | `app/src/components/EmptyStatePanel.tsx` |
| Numbers/dates | `formatInteger`, `formatDecimal`, `formatDate`, `formatKickoff` | `app/src/lib/format.ts` |
| `<md` breakpoint | `useMediaQuery`, `MD_MEDIA_QUERY` (`"(min-width: 48rem)"`) | `app/src/lib/use-media-query.ts:31,58` |
| `decidedBy` display branch | `decidedByCaption(knockoutScore)` — **do not write a second switch** | `app/src/lib/match-hero.ts:115` |
| 44 px hit floor | `MIN_HIT_PX` (= 44) — import, never re-declare | `app/src/viz/marker-layout.ts:18` |
| Score separator | `match.hero.scoreSeparator` ("–") | `app/src/locales/es.ts:461` |
| Types | `Tournament`, `GroupTable`, `StandingsRow`, `MatchResultRow`, `MatchResult`, `EntityRef` | `app/src/lib/contract/contract-types.d.ts` |
| Schema version | `SCHEMA_VERSION` (= 4) | `app/src/lib/contract/schema-version.ts` |
| Build read | `readTournament()` | `app/src/lib/build-data.ts:36` |
| Runtime fetch | `fetchArtifact<T>()` | `app/src/lib/data.ts:14` |

### `TableColumn<Row>` — exact shape

```ts
interface TableColumn<Row> {
  key: string;                    // stable identity, NEVER an index
  headText: string;               // t() resolved at the CALL SITE
  headTitle: string | null;       // required field; full term when abbreviated
  render: (row: Row) => ReactNode;
  align: "text" | "numeric" | "clock";
  rowHeader?: boolean;            // <th scope="row">, at most one per row
  cellClass?: string;
  headClass?: string;
  sort: { kind: "number"; valueOf: (row: Row) => number | null }
      | { kind: "text";   valueOf: (row: Row) => string | null }
      | null;                     // null = unsortable, no aria-sort emitted
}
```

`DataTable<Row extends { key: string }>` props: `caption`, `columns`, `rows`, `surface` (required); `sticky` (default `false`, **only** valid inside a caller-rendered height-bounded scroll container — `DataTable` never renders one), `tableName` (prefixes the sort announcement).

`sortRows` is called **during render, never memoised** — load-bearing so `t()`-resolved text columns re-collate on the EN toggle. **Do not "optimise" this into a `useMemo`**; the un-memoised path is deliberate and ledgered. Nulls sort to the array **end in both directions**.

Text sorting goes through **`compareText(a, b)`** at its `'es'` default — two arguments, no departure. Never `localeCompare`, never `<`/`>` on strings (2.11a decision 8).

> **Collation caveat, live for the first time here.** 2.11a's "es and en orders are identical" measurement rested on 96 **ASCII-only** fixture player names — "0 disagreements in 9,216 pairs". 2.12 sorts **real team names** from `tournament.json`. The ledger defers re-measurement to 2.19, but this story is where the premise first meets non-fixture strings. If a text sort looks wrong, that entry is why.

Header sort buttons are **≥44 px on the button itself**, which grew header rows from ~28 px to 44 px. That is expected (2.11a Task 7.2), not a defect to "tighten".

### Contract facts

- `StandingsRow` — all 11 fields required: `rank, team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points, form`. `goalDifference` is a **signed** integer (not a `Count`).
- `form: MatchResult[]` — `"win" | "draw" | "loss"`, **chronological**. Schema doc: "*The Hub renders result chips straight from it.*"
- `MatchResultRow` — 12 required fields. `group` is **nullable** (null on knockout rows). `knockoutScore` is present on **every** row including group rows.
- `EntityRef` = `{ id, name }`; `name` is a locale-neutral proper noun (AD-7) — **never translate team names**.
- `Tournament` has **five** required fields: `schemaVersion`, **`tournamentName`**, `groups`, `knockoutResults`, `entities`. `tournamentName` is the field `generateMetadata` needs for `<title>`/OG (Task 1.1) and is likewise "*a proper noun, not a translated label*" (`tournament.schema.json:23`) — pass it through, never key it.
- Enums are **closed by design** (AD-2): an unlisted value is a TypeScript compile error, and that is the intended mechanism.

### i18n gate

`react/jsx-no-literals` (`noStrings`, `ignoreProps`) plus `no-restricted-syntax` over **16 gated prop names**: `aria-label, aria-description, aria-placeholder, aria-roledescription, aria-braillelabel, aria-valuetext, title, alt, placeholder, label, message, text, description, caption, heading, tooltip`.

**Status correction:** the object-shaped-prop hole filed by 2.6 was **closed by 2.18 decision 8** (`deferred-work.md:891-923`, heading "RESOLVED"), for `{{ value: … }}` / `{{ children: … }}` on the sixteen gated names, plus `value` on `<Label>`/`<LabelList>`. Do not re-file it.

**Residual gaps the gate still will NOT catch — self-check by grep before committing:**
- a **computed object key** — `label={{ [K]: "hardcoded" }}` — is not statically reachable (pinned as a KNOWN LIMIT test);
- an **aliased import** — `import { Label as L }` — cannot be followed;
- object members **other than** `value`/`children` inside a gated prop;
- `value` is reachable **only** through `Label`/`LabelList` and must not be added to the shared name regex — `SiteHeader.tsx` passes `value="es"`/`"en"` to Radix `ToggleGroupItem` as **state tokens**. If your DropdownMenu items carry text-bearing object props, they need their own element-scoped selector.

### Open ledger entries that go live the moment you build the `<md` disclosure

These are **unowned and open**. Your disclosure is the shape they describe. Rule each one in the story record — do not discover them at review.

| Ledger anchor | Why it fires here |
|---|---|
| *"Sort state is silently destroyed by the disclosure toggle"* | "Más columnas" is exactly this control. |
| *"A gated column disappearing while active reverts rows with no announcement"* | The `<md` reduced set removes columns **while a sort may be active**. 2.11b rated the same thing a *decision*, not a defer. |
| *"Zero-row tables render live sort controls"* | A group with no played matches yet. |
| *"`scope="row"` sits on the THIRD column"* | Put the row header (team name) **first in DOM order**, or inherit the defect. |
| *"No log table sets `rowHeader`"* | Standings rows need a row header — set `rowHeader: true` on the team column. |
| *"`aria-sort` on unsortable heads"* (filed departure) | A `sort: null` head **deliberately omits `aria-sort` entirely**. Your form-chip column is the likely first consumer — **do not "fix" it back**. |
| *"The Expert Layer's `<md` ToggleGroup overflows the DOCUMENT"* | Open, owner 2.19. Any `<md` selector control must be measured **in EN**. |
| *"`<title>`/OG stay Spanish after an EN toggle"* | Owner Juan, open. `/` is affected. |

Sticky-column mechanics if you use `sticky`: **`min-w-*`, never `w-*`** (the ruled widths did not survive the layout), and note `truncate` **does not truncate inside a table cell — it widens the column**.

### Pre-empt the recurring review failures

Every story from 2.6 onward was patched for some of these. Cheaper to avoid than to fix.

1. **Never let the Dev Agent Record claim more than the code does.** Caught in essentially every review. Measure at the tree you will commit, re-measure after every patch, and say plainly what you did *not* verify.
2. **A comment stating a measured fact must cite where the measurement lives.** Multiple stories shipped docblocks that were simply false.
3. **Guard `null`, `[]` *and* `undefined`** at every entry point. The `null`-vs-`[]` conflation has been ruled four times and still shipped as a live defect; `undefined` is the third state nobody guards. Render a real zero state for `[]`.
4. **Assert literals, not re-derivations.** Never cast a constructible shape (`as unknown as X` on a legal shape suppresses real contract drift). Tests green by coincidence are a repeat finding.
5. **Type it instead of testing it** — type stage/group ids and match slugs against the contract enums so a typo is a compile error.
6. **Measure in both locales, both themes, both widths.** 2.11b's review measured ES only and missed a 37 px 390 px failure; ES standings heads are far shorter than EN.
7. **Read a11y attributes back out of the live DOM.** 2.11a's ruled focus-restore was dead code as written; 2.11c's `aria-describedby` never reached the accessible *name*.
8. **Never `git add -A` or `git add app/`.** Stage explicit paths; commit your slice early. Prior stories had their File List captured by another session's sweeping stage.

### Testing environment

Vitest 3.2.7, `environment: "node"`, **no jsdom, no axe, no Playwright, no @testing-library** — deliberate (Story 2.2). Nothing rendered is unit-testable, so **push every decision into a pure module**. Tests colocate as `foo.test.ts`. Exported-HTML tests stand in for E2E and read `app/out/**/index.html`.

Build chain: `npm run lint && npm run typecheck && npm run assert:schema-version && next build && node scripts/copy-data.mjs`. Lint runs at `--max-warnings 0`; `next build` never lints in Next 16.

### Concurrency and risk

**Stories 1-17 / 1-18 are in flight** in `pipeline/` and `data/index/`. Different lane — no file collision expected — but:

- **CS-3 risk (flag, do not pre-empt).** 1-17 is writing `tournament.json`'s producer against the same schema your fixture pins. CS-1 and CS-2 both arose when a story met a contract shape the corpus could not fill. If 1-17 needs a CS-3, your surface moves. **Note the dependency; do not try to pre-empt it.** A bump re-pins fixtures and regenerates App types, and CS-2's own spec warns a bump "*must not land while an Epic 2 session is in flight*" — coordinate rather than absorb.
- **Status as of 2026-08-06:** `1-17` is now **`ready-for-dev`** (context created against baseline `74b1789`); `1-18` and `1-19` remain `backlog`. `data/matches/` (104 bundles) is present and committed; **`data/index/` does not exist yet.**
- **Five decisions in 1-17 are surfaced but UNRULED.** Two touch this story:
  - **D1 — the FIFA tiebreaker cascade is bound by four sources and defined by none.** 2.12 is **insulated by design**: you render `rank` verbatim, so whichever cascade Juan rules changes the *values* in the artifact and nothing in your code. This is precisely why D3 forbids client-side re-derivation. Do not "help" by implementing a cascade.
  - **D4 — `TeamRecord.played` differs from `StandingsRow.played` for 32 of 48 teams.** Standings must read `StandingsRow.played`. **Never cross-source a standings figure from `entities.teams[].record`** — they are different semantics, not redundant copies.
- Another session's sweeping `git add` can capture your files. **Stage only your own paths and commit your slice early.**

### Project Structure Notes

New files land as: route in `app/src/app/page.tsx`; client region + chip + tables in `app/src/components/`; pure model in `app/src/lib/hub-model.ts`; primitive in `app/src/components/ui/dropdown-menu.tsx`; keys in `app/src/locales/{es,en}.ts`; tests colocated.

`app/src/lib/contract/**` is generated and globally ESLint-ignored — **never hand-edit**. `@/lib/build-data` and a direct `t` import are **barred by ESLint** from `src/components/**` and `src/viz/**`; client components use `useT()` / `useLocale()`.

`next.config.ts` is `output: "export"`, `trailingSlash: true`, `images.unoptimized`. `/` needs no `generateStaticParams`.

### Open question for the reviewer

AD-11 is cited on the capability map for the Match Dashboard (`:220`) and profiles (`:222`) but **not** on the Tournament Hub row (`ARCHITECTURE-SPINE.md:221`, which lists only AD-4, AD-5, AD-10).

**Counter-evidence that largely settles it, and why D1 stands:** AD-11's own **Binds** line (`ARCHITECTURE-SPINE.md:108`) reads "*Epic 2 routes, FR-21, **FR-33, FR-34**, §5 budgets, UJ-1*" — and **FR-34 is AC5's own FR**. The capability map's own `FR-33..34 static delivery` row (`:225`) is likewise governed by AD-11. So AD-11 binds the Hub through the very requirement AC5 cites, and its "exactly two data paths … no third path" is drafted universally.

The row-level omission therefore reads as an editorial gap, not a carve-out. **D1 stands.** Flagged so a reviewer can overturn it cheaply if the omission was in fact deliberate — in which case AC5's meaning changes with it.

### References

- Story ACs — `_bmad-output/planning-artifacts/epics.md:859-879`
- UX-DR catalogue — `epics.md:104-126` (**not** DESIGN.md/EXPERIENCE.md); AR-1..17 — `epics.md:82-98`
- FR-25 — `prd.md:295-299`; FR-34 — `prd.md:382-383`; NFR-1 (the KB/gzip/Hub-artifact trio) — `epics.md:67`
- AD-4 (rank, FIFA cascade, budget, route manifest) — `ARCHITECTURE-SPINE.md:64-68`
- AD-5 (aggregation, user-initiated re-ordering only) — `ARCHITECTURE-SPINE.md:70-74`
- AD-11 (two data paths) — `ARCHITECTURE-SPINE.md:106-110`; AD-12 (i18n) — `:112-116`; AD-13 (build chain) — `:118-122`
- `StandingsRow` / `MatchResultRow` / `EntityIndex` — `contract/tournament.schema.json:43-252`
- `Rank`, `MatchResult`, `Stage`, `Group`, `KnockoutScore`, `EntityRef` — `contract/common.schema.json`
- Result chip behaviour (row is the link target) — `EXPERIENCE.md:82`; chip visual + both-theme ratios — `DESIGN.md:290, 343`
- Sort contract — `EXPERIENCE.md:76`; `<md` Hub responsive row — `EXPERIENCE.md:135`; 320px reflow — `EXPERIENCE.md:119`
- Terminology rows — `EXPERIENCE.md:264-265, 275`
- 2.11a sort contract, decisions 1–11 — `2-11a-sortable-data-table-contract.md:95-212`; **decision 10 (no `aria-pressed`)** — `:206-208`; decision 5 (no `defaultSort`) — `:164-168`; decision 8 (`compareText` at `es`) — `:183-193`; the parked Hub DropdownMenu clause — `:637-638`
- Dead-link precedents — 2.8 `2-8-...md:360`; 2.11c ruling 8 `2-11c-...md:899`; **2.11b decision 12 (the recorded live inconsistency)** `2-11b-...md:606-611`; 2.4's linking ruling `2-4-...md:45`
- 2.6's eager-chunk attribution **and its overturn** — `2-6-momentum-timeline.md:544-551` (claim), `:668, :692` (correction)
- i18n object-shaped-prop hole, **RESOLVED by 2.18** — `deferred-work.md:891-923`
- Light-theme first-consumer failures — 2.7 `2-7-...md:274, :539`; 2.6 `2-6-...md:78-104, :487-504`; 2.9 decision 21 `2-9-...md:417-424`
- 320 px method and pre-existing attribution — `2-6-...md:512-516`; `2-11a-...md:794-800`
- F8 stage-sectioning NO-CHANGE ruling — `2-3-contract-v1-per-surface-sign-off.md:121, 216`; `deferred-work.md:25`
- Deferred standings vocabulary — `deferred-work.md:1376-1385`; `app/src/lib/glossary.ts:24-35`
- Budget gate — `pipeline/precompute/budget.py`

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context) — Claude Code CLI, `bmad-dev-story` workflow.

### Debug Log References

Verification was done against the **built** export (`python -m http.server` over `app/out/`, private
port 8912), never `next dev` — only `copy-data` populates `/data/fixtures`. All measurements below
were taken in the browser at the tree that is being committed, and re-taken after every patch.

- Full chain: `eslint . --max-warnings 0` → clean; `tsc --noEmit` → clean; `assert:schema-version` →
  1,409 artifacts at schemaVersion 4; `next build` → 8 pages exported; `copy-data` → ok.
- Suite: **845 passed / 1 failed of 846**, 28 files. The single failure is
  `assert-schema-version.test.ts` timing out at the 5,000 ms default — it passes **3/3 in isolation
  at 4,434 ms**, and it crossed the threshold because a concurrent Story 1.18 session emitted
  `data/index/{player,team}-profiles/` mid-session, taking the scanned tree from 111 to 1,409
  artifacts. Not this story's file, not this story's change, filed to the ledger with its owner.
- Story-owned suites re-run after the concurrent fixture regeneration: `hub-model` 34,
  `i18n` 120, `table-sort` 23 → **177/177 green**.

### Completion Notes List

**What shipped.** `/` is the Tournament Hub: a build-time `generateMetadata` read for `<title>`/OG,
a client-fetched runtime region for the tables (ruled D1, AD-11's two data paths), a standings
surface of one table per group and a results surface sectioned per group then per knockout stage,
result chips, a `<md` column disclosure with a per-table sort menu, and one `SortAnnouncerProvider`
for the whole route.

**AC-by-AC.**

- **AC 1 — artifact order and verbatim `rank`: MET.** Nothing sorts, ranks or re-orders.
  `sortState` starts `null`, which *is* artifact order, and the caption ("Ordenado por posición." /
  "Ordenado por número de partido.") is what states it — `DataTable` has no `defaultSort` by
  design. Verified in the browser: sorting a standings table by GF re-orders the rows to 2/2/2/6
  while the `rank` column still reads **2, 3, 4, 1** — the pipeline's numbers, not renumbered.
- **AC 2 — reachability and cross-links: MET at fixture scale, deferred at 104.** Link count equals
  row count in every rendered table; every result row links to `/matches/{matchId}/` and every
  standings row to `/teams/{team.id}/`, both with the trailing slash `trailingSlash: true`
  requires. The results/manifest bijection is asserted against the fixture. **The literal 104 is
  deliberately NOT asserted** — the fixture carries 3 (now 4) of 104 — so totality is proven instead
  over synthetic rows covering all 7 `Stage` values and all 12 `Group` letters, which is exhaustive
  because both enums are closed. Real-scale reachability is 2.19's and is filed.
- **AC 3 — result chips: MET.** Fill **and** letter, never colour-only, keyed off the `MatchResult`
  enum, inside the linked standings row. All six contrast ratios re-measured in the browser and they
  **reproduce DESIGN.md:290's published figures exactly** — 10.68 / 6.35 / 6.66 dark and
  5.36 / 5.61 / 5.55 light — which both validates the measurement method and confirms the chip ink
  inverts correctly between themes.
- **AC 4 — `<md` presentation: MET.** Below `md` the standings table paints 5 of 11 columns and the
  results table 2 of 6, behind a per-surface "Más columnas" disclosure, with a per-table sort menu
  (a vendored Radix `DropdownMenu`, no new dependency) listing **all** columns including the hidden
  ones. Verified: the menu opens on Enter, offers all 10 sortable standings columns, its items are
  44px, and sorting a hidden column announces, sorts, and reveals it. **Amended at code review:**
  the menu now renders whenever the layout is narrow, not only while a column is hidden — the
  original gating unmounted the menu (and the node Radix restores focus to) in the same commit as
  the reveal. **Task 6.3c's `Esc` clause was checked off without evidence** — the record covers Enter
  and the 44px items and never says Esc was pressed, and the wrapper portals, which is the change
  most likely to affect dismissal. It remains unverified.
- **AC 5 — payload budget: PARTIALLY satisfied, and the rest is not this story's to satisfy.** The
  "loads only" half is **verified**: the route issues exactly the two allow-listed artifact fetches
  (`/index/tournament.json`, `/index/leaderboards.json`) and nothing else, asserted as an
  ALLOW-LIST rather than `toHaveLength(1)` so 2.13's fetch does not turn it red. **CORRECTION, made
  at code review: this paragraph originally claimed that assertion had shipped, and it had not —
  it was verified in the browser only. The test now exists** (`static-output.test.ts`, a transitive
  module walk from `page.tsx`). The App does not
  and must not measure bytes (AD-4: measured by the Pipeline, "the App never re-measures"). The
  **combined-budget half is contingent on Story 1.17's still-unruled D3/D5**: full-roster
  leaderboards measure 572,276 gzip-9 against a 500,000 ceiling, so the combined figure FAILS today
  entirely because of leaderboards — `tournament.json` is 7.8% of the ceiling. **AC 5 is not claimed
  green on this story's own measurement.**

**The eleven ruled decisions were followed; the four the story left open are ruled here.**

- **D10 (the results listing had no design anywhere) — authored.** `DataTable`, so D9's row-link
  mechanism and the sort contract apply uniformly. Columns: `match` (row header, first in DOM
  order), `matchNumber`, `date`, `kickoff`, `venue`, `matchdayRound`. Row anatomy is
  `home {score} away` with the shipped en dash, plus a `decidedBy` suffix. `stage` and `group` are
  the sectioning keys and are therefore in the heading, not repeated per row; `matchdayRound` is a
  rendered label and never a sectioning key.
- **D11 (do result rows get chips?) — ruled (i): chips are standings-`form` ONLY.** The lower-risk
  reading, and the contract settles it: `MatchResultRow` carries no `MatchResult` field, so a
  per-result chip would need a derivation AD-5 does not bless — and a result row has *two* teams, so
  a single chip could not say whose result it is. `form` is the schema's own stated chip source
  ("The Hub renders result chips straight from it"). AC 3 is satisfied in full, because standings
  rows *are* linked rows.
- **Task 2.4b (which score `score` is) — ruled by contract inference, and raised to 1.17.** Ruled to
  be `MatchMetadata.score`'s quantity, because `MatchResultRow`'s own description says it carries
  what the `<title>`/OG needs "so neither has to fetch the Match Bundle" — only true if they agree.
  That is an inference, not a statement; filed as a contract question. **Nothing here depends on it**
  — the row prints `score` verbatim.
- **Task 2.4c (`winnerTeamId` on a shootout row) — ruled: not rendered.** The shoot-out scoreline
  already names the winner numerically, and marking one would need a visual channel no spine
  specifies. Row-sized suffixes were minted because `match.hero.extraTime` / `.shootout` are
  hero-sized; the full terms ride `sr-only` spans, and the extra-time full form **reuses** the
  shipped hero string.
- **Task 6.3b (scope and multiplicity) — ruled: disclosure per SURFACE, sort menu per TABLE.** A
  per-table disclosure would put twelve of them on one 390px screen for an obviously global
  preference; sort state is inherently per table, so the menu cannot be shared. Extended to the
  results surface too — EXPERIENCE.md's row names only standings/leaderboards, but AC 4 says "Hub
  tables" and a six-column results table at 390px in English has the same problem.
- **Tasks 3.1b, 3.6, 3.8, 6.6, 6.7** ruled and recorded inline in the code, at the decision.

**THREE THINGS THE BROWSER CAUGHT THAT NO TEST IN THIS HARNESS COULD.**

1. **A 237px document-level horizontal scroll at 390px (WCAG 1.4.10).** A grid item defaults to
   `min-width: auto`, so an eleven-column table made the *section* wider than the viewport and the
   `overflow-x-auto` wrapper inside it never became the scroller. Measured `body.scrollWidth` **612**
   against a 375 clientWidth; `min-w-0` on the section fixes it. This is the exact mechanism behind
   EXPERIENCE.md:119's internal-scroll exception, and it ships green in every unit test.
2. **AC 4's own clause would have silently un-sorted the table.** The sort menu offers hidden
   columns; `sortRows` resolves the active `columnKey` against the columns `DataTable` is given; so
   filtering hidden columns OUT of that list meant picking a hidden column fell back to artifact
   order instantly — verbatim the open ledger defect ("a gated column disappearing while active
   reverts rows with no announcement"), reached by the route AC 4 *requires*. **Ruled and rebuilt:
   a hidden column is hidden with `display: none`, never removed from the model.** It leaves the
   layout, the accessibility tree and the tab order together, the sort survives, and SM-C2's "hides
   columns, never removes data" becomes literally true. Sorting a hidden column also now *reveals*
   it, so the rows never re-order for a reason the reader cannot see.
3. **`kickoffSortValue` returned a confident midnight for unparseable input**, because `Number("")`
   is `0` and slicing past a short string yields `""`. Caught by this module's own "returns null,
   never 0" test — the `?? 0` defect class decision 3 closed elsewhere. Replaced with a regex.

**Verified in the browser rather than asserted.** UX-DR12's focus-restore **goes live in this story**
— 2.12 is the first surface to put focusable content in a `DataTable` body, and `DataTable`'s own
docblock anticipated the moment. With focus on the Mexico row link, sorting by GF moved that row from
position 1 to position 4 and **focus stayed on the same anchor, in the same table**. Also verified:
exactly **one tab stop per row** (the chips are not focusable and never become a second stop); the
announcement names its table ("Tabla de posiciones · Grupo A: Ordenado por GF, ascendente."), which
also proves 2.13's provider lift works; exactly **three** polite live regions page-wide with **zero**
`role="status"`/`role="alert"` and **zero** `aria-pressed` inside any table; `--ink-muted` on content
**zero**; no zebra striping (one transparent row background); the `sort: null` form column correctly
emits **no** `aria-sort` at all (the filed departure, not "fixed" back); and all nine abbreviated
standings heads carry their full term.

**Reflow measured at 390 AND 320, in BOTH locales, everything expanded** — and attributed
differentially before being reported, per the story's own instruction. **This story's surfaces are
clean in all four cases** (375==375 and 305==305). The residual overflow on the route belongs
entirely to Story 2.13's `#lideres`: hiding it alone returns the document to 375==375, while hiding
both of this story's surfaces leaves it at 457. **Filed, not fixed** — 2.13 was mid-implementation in
a concurrent session and has not run its own Task 9.

**One thing the story asked me to confirm came back the other way, and is recorded as such.** Task
9.6 expects the focus ring to paint on the ROW. It paints on the **anchor's own 44px block**
(measured 165×44 inside a 1104×57 row), because the row-wide hit area is a stretched `::after` with
no ink. It is visible, unobscured and passes 2.4.7/2.4.11 in both themes. A row-wide indicator was
prototyped and **not shipped**: it either doubles the indicator or needs `outline-none`, a house
prohibition that has already cost two review patches, and DESIGN.md rules no row-focus treatment for
this pattern. Filed for whoever rules the linked-row pattern.

**Concurrency — this was a genuinely shared tree, and it changed under the story three times.**
Story 2.13 was being implemented by another session throughout. (a) It reached `page.tsx` first and
left an explicit seam; this story took the file over exactly as that seam describes, keeping 2.13's
import, its `readLeaderboards()` call, its one `<LeaderboardsSection>` element and **its chosen page
position**, rather than re-litigating any of it. (b) It left the standing instruction "WHEN 2.12'S
PAGE LANDS, LIFT THIS PROVIDER TO THE PAGE and let both regions consume it — do NOT add a second
one"; that lift is done, and the nested provider removed, because two providers means two live
regions (2.11a decision 9) and it fails silently. (c) A concurrent session regenerated the fixtures
mid-run, adding a fourth match (`m082-belgium-senegal`, a second `r32` tie) — every one of this
story's assertions survived it untouched, and the second r32 tie now exercises the multi-row-per-
stage grouping against real fixture data rather than only synthetic. **`git add -A` and `git add
app/` were never used.**

**Deliberately NOT done.** No client-side byte measurement (AD-4 forbids it). No tiebreak or
cascade logic (the pipeline's; 1.17's D1 changes the artifact's values and nothing here). No
`/teams` stub route (known debt, filed). No combined-budget ledger entry (1.17 owns it). No fouls
column (neither contract row carries a fouls field — Task 10.3 checked, not assumed). No fix to
2.13's overflow or to the `assert-schema-version` timeout, both filed with owners.

**Flagged for Juan.** **FOUR** things were newly authored under EXPERIENCE.md's extension procedure
because no spine specifies them: `hub.title` ("El torneo" / "The tournament", the route's `<h1>`),
`hub.results.heading` ("Resultados" / "Results"), **`enums.matchdayRound.*` (all nine codes, which
had no key in either dictionary)** and the EN standings abbreviations — EXPERIENCE.md rules the
Spanish set and only the EN *chip* letters — where `played` is **"MP", never "P"**, because `P` is
already the Spanish *perdidos* column. **CORRECTION, made at code review: this paragraph originally
named only the first two, and the rows themselves were never appended to EXPERIENCE.md's table
despite `es.ts` stating they had been. All four rows are now appended there** under "Rows appended
by Story 2.12"; the two authored *strings* remain PROPOSED, not ruled, pending Juan. Also inherited rather than
introduced: `/` now has a `generateMetadata` export while `/about` and `/glossary` refuse one on the
open "`<title>` stays Spanish" ruling; the route already carried a title from the layout default, so
this changes the string, not the situation.

### File List

**New (Story 2.12):**

- `app/src/lib/hub-model.ts`
- `app/src/lib/hub-model.test.ts`
- `app/src/components/TournamentHubRegion.tsx`
- `app/src/components/TournamentHub.tsx`
- `app/src/components/HubTable.tsx`
- `app/src/components/TableSortMenu.tsx`
- `app/src/components/ResultChip.tsx`
- `app/src/components/ui/dropdown-menu.tsx`

**Modified (Story 2.12):**

- `app/src/app/page.tsx` — the Hub route; co-owned with Story 2.13's mount (see Completion Notes)
- `app/src/app/static-output.test.ts`
- `app/src/components/DataTable.tsx` — controlled-sort API + `rowClass`; also concurrently edited by
  Story 2.13 (its `headAccessibleName`)
- `app/src/components/LeaderboardsSection.tsx` — Story 2.13's file; the provider lift ONLY, at that
  story's own written instruction
- `app/src/lib/table-sort.ts` — `composeSortAnnouncement` moved here from `DataTable`
- `app/src/lib/glossary.ts` — docblock narrowed to one open scaffolding row
- `app/src/lib/i18n.test.ts` — Story 2.12 sweep; also concurrently edited by Story 2.13
- `app/src/lib/eslint-gate.test.ts` — retired-scaffold-key probes repointed
- `app/src/locales/es.ts`, `app/src/locales/en.ts` — `hub.*`, `enums.matchResult`,
  `enums.matchResultFull`, `enums.matchdayRound`; `app.scaffold.*` and `a11y.scaffold.*` retired
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended (append-only proven
  programmatically)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-12-tournament-hub-results-standings.md`

**NOT this story's** (present in the same working tree, owned by the concurrent Story 2.13 / 1.18
sessions): `app/src/components/Leaderboards*.tsx`, `app/src/lib/leaderboard-format.ts`,
`app/src/viz/leaderboard-model*.ts`, `app/src/lib/build-data.ts`, `app/src/lib/format*.ts`,
`app/src/lib/glossary.test.ts`, `app/src/viz/shot-map-model.ts`, and everything under `data/`.

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story 2.12 implemented. Tournament Hub `/`: results listing, standings tables, result chips, `<md` column disclosure + sort menu. `DataTable` gains an additive controlled-sort API and a `rowClass` hook (2.11a contract amendment, authorized by D7/D9). `composeSortAnnouncement` lifted to `table-sort.ts` so one announcement serves two controls. Scaffold keys retired with their only call site. Ledger appended; `glossary.ts` scaffolding-row docblock narrowed from three open rows to one. Status → review. |
| 2026-08-06 | Story 2.12 code review: 3 decisions ruled, 17 patches applied, 6 dismissed. Highest-value find was a raw NUL byte in `TableSortMenu.tsx` that made git treat the whole file as binary. Also: the AC 5 fetch allow-list test the notes claimed but never wrote; `prefetch={false}` on the row anchors (measured route fetches to an unbuilt `/teams/`); an error boundary and `form` normalization for the payload paths that could take the whole entry route; deep-link anchors made reachable post-fetch; the four authored terms actually appended to EXPERIENCE.md; `composeSortAnnouncement` pinned; the enum lists rebuilt on a mechanism that is genuinely exhaustive. Sort menu re-ruled to track the breakpoint (it was unmounting itself mid-interaction); `aria-controls` dropped from the column disclosure. Status → done. |

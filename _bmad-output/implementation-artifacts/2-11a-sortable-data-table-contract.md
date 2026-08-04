---
baseline_commit: 892766c
---

# Story 2.11a: The Sortable Data-Table Contract

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Diego,
I want every data table on the match page to sort on any column,
So that I can order the numbers the way my question needs (UX-DR12, FR-23, UJ-2).

> **This is the first of three stories split out of epic Story 2.11, ruled by Juan at story
> creation.** The epic's 2.11 bundles three separable deliverables whose combined size —
> ~30 files, ~200 new locale strings and 20 table retrofits in one commit, against five files a
> concurrent session is actively editing, in a harness where **nothing rendered can be
> unit-tested** — is materially larger than any prior Epic 2 story. The split:
>
> | story | scope | status |
> |---|---|---|
> | **2.11a (this)** | The ONE sortable-table contract: the sort module, the shared component, the announcer, and every retrofit. | ready-for-dev |
> | 2.11b | The Expert Layer shell + Domain G per-player tables + `<md` column groups. Depends on 2.11a. | backlog |
> | 2.11c | The five Expert-layer event logs. Depends on 2.11a and 2.11b. | backlog |
>
> **2.11a ships value on its own** — every existing table becomes sortable — and it discharges the
> plug-in points four shipped stories filed to "Story 2.11" by name. `epics.md` is **not edited**;
> the epic's AC 2 is this story, and its AC 1 and AC 3 travel to 2.11b/2.11c.

## Acceptance Criteria

The epic's AC 2 (`epics.md:850-853`) is reproduced **verbatim**, followed by the **BINDING**
reconciliation the story-creation probe forced.

**AC 2 — The one sortable data-table contract**

**Given** the sortable data-table component
**When** any table renders
**Then** every column sorts client-side (click/Enter/Space, `aria-sort`, polite announcements), text sorts via `Intl.Collator('es', {sensitivity:'base'})`, default sort is stated, headers are sticky with `scroll-padding-top`, and sorting never loses row focus (UX-DR12)
**And** numeric cells right-align in tabular figures with `Intl` formatting per locale (UX-DR2, UX-DR19).

> **BINDING (a): the reconciliation surface is TEN files and TWENTY tables.** Counted, not
> estimated — `grep -rc "<DataTable" src/components/*.tsx`:
>
> | file | instances |
> |---|---|
> | `DefensiveActionsSection` | 1 |
> | `GoalkeepingSection` | 3 |
> | `MomentumSection` | 1 |
> | `MovementToReceiveSection` | 2 |
> | `OffersToReceiveSection` | 2 |
> | `PassNetworksSection` | 2 |
> | `PhasesSection` | 1 |
> | `PressingSection` | 2 |
> | `SetPlaysSection` | 4 |
> | `ShotMapsSection` | 2 |
> | **10 files** | **20** |
>
> **2-10 has LANDED (`892766c`), so this count is settled and complete** — the four sections it
> added (`Goalkeeping`, `Phases`, `Pressing`, `SetPlays`) are committed and in scope. There is no
> longer an "if 2-10 lands" branch.
> Every one carries its own private, byte-near-identical `DataTable`, and all twenty are plain.
> **Four shipped stories** filed a plug-in point here by name — **seven code sites**
> (`grep "2.11 PLUG-IN POINT"` = 4, `grep "Story 2.11 owns"` = 3): 2.6 (Momentum ×2), 2.7 (ShotMaps),
> 2.8 (PassNetworks), 2.9 (Offers, Movement, DefensiveActions). 2-10 is adding a fifth filer.
> **Task 1.2 must RE-COUNT** — see decision 1.
>
> **BINDING (b): sticky headers are DEFERRED to 2.11b, and that is a declared departure.**
> `ViewDataDisclosure`'s region — which hosts every one of the twenty tables — is
> `className="mt-tile-gap w-full overflow-x-auto"`. Per CSS Overflow 3, `overflow-x: auto` with
> `overflow-y: visible` forces the used `overflow-y` to `auto`, so that div **is already a two-axis
> scroll container** and is the nearest scrolling ancestor a sticky `<thead>` resolves against.
> **It has no height bound**, so its scrollport equals its content height and it never scrolls
> vertically — `position: sticky; top: 0` inside it **never offsets**. A sticky header here would
> ship green, pass the suite (there is no jsdom), and **silently not stick**.
> **RULED:** 2.11a ships the sort contract with **non-sticky** headers and files the departure
> (Task 8.4). 2.11b introduces sticky headers in the Expert Layer's own bounded container, where
> they work. **Do not add a height to `ViewDataDisclosure`'s region** — one shared disclosure
> serving twenty tables cannot pick a height. UX-DR12's `scroll-padding-top` clause travels with it.
>
> **BINDING (c): "sorting never loses row focus" is VACUOUS today, and must be reported as such.**
> No body-row content in any of the twenty tables is focusable — every `<td>` is plain text, and
> 2.9 Task 6.7 ruled player names plain text because `/players/{slug}` does not exist. The clause is
> satisfied by construction; the mechanism decision 6 requires is the **forward** guarantee. **Do not
> report a manual focus test that cannot be run.**

## Ruled Decisions

These are decided. Do not re-litigate them mid-implementation; if evidence contradicts one, record
a departure in the Dev Agent Record with the reason, exactly as 2.6, 2.7, 2.8, 2.9 and 2.10 did.

**1 — ONE shared sortable table; EVERY instance retrofitted, EVERY private copy deleted. Ruled by Juan, 2026-08-04.**
The copies differ **only** in their ink family — pitch (`text-ink-on-pitch-secondary`,
`border-pitch-line/40`) vs canvas (`text-ink-secondary`, `border-hairline`). Carry that as a
`surface: "pitch" | "canvas"` prop, mirroring `ViewDataDisclosure`'s existing prop of the same name
and values. **Getting the two families backwards is the exact defect 2.7's review spent its headline
finding on** — `--ink-on-pitch` computes **1.09:1** on a white card.
**All twenty retrofit.** 2-10 landed at `892766c`, so the surface is fixed and Task 8.3's
"re-file if it hasn't landed" branch is dead. Re-count anyway at Task 1.2 to confirm 10/20 — but
expect no surprise.

**2 — The column descriptor IS the contract. Ship exactly this.**
`rows` + `columns` is an **API inversion**: the caller stops writing `<tr>`/`<td>`. Every one of the
twenty call sites needs more than a field read — the shot log's own-goal suffix composes two
dictionary keys on a row boolean; the momentum minute cell is `formatGoalMinute(row.at)` over a
**`MinuteStamp` object**; the movement tables generate six cells by mapping `OFFER_MOVEMENT_TYPES`
over a nested `counts` record; four columns sit behind presence gates; several cells are
`x === null ? unknown : formatDecimal(…)`.

```ts
export interface TableColumn<Row> {
  /** Stable identity. NEVER an index — column sets are dynamic (gates). */
  key: string;
  /** Already-resolved head text: t() is called at the CALL SITE, not here. */
  headText: string;
  /** Full term when headText is abbreviated; null otherwise. */
  headTitle: string | null;
  /** Cell body. Closes over t and locale at the call site. */
  render: (row: Row) => ReactNode;
  /** `numeric` right-aligns in type-table-numeric; `clock` is LEFT-aligned
   *  tabular-nums (MomentumSection's minute column needs exactly this). */
  align: "text" | "numeric" | "clock";
  /** Renders <th scope="row"> instead of <td>. At most one per row. */
  rowHeader?: boolean;
  /** Sort key, INDEPENDENT of render. null-valued rows sort to the array END
   *  in BOTH directions. `sort: null` makes the column unsortable. */
  sort:
    | { kind: "number"; valueOf: (row: Row) => number | null }
    | { kind: "text"; valueOf: (row: Row) => string | null }
    | null;
}
```

**`sort.valueOf` returns the rendered SEMANTIC value, never the raw model field.** A `DictionaryKey`
column sorts on `t(key)` resolved at the call site — sorting on the raw key would order by
`"enums.shotOutcome.blocked"` and would not re-order under the EN toggle. A clock column sorts on
`minute * 1000 + (stoppageMinute ?? 0)`, `null` when `at` is absent — **never** on the rendered
`"45+2′"` string, which collates after `"9′"`. This is why decision 3 widens `ShotLogRow.minute`.
Prop names `headText` / `headTitle` are deliberate: `caption`, `label`, `title`, `text`, `heading`
and `description` are all on the i18n gate's 16-name list.

**3 — `ShotLogRow.minute` / `stoppageMinute` become `number | null`. Ruled by Juan, 2026-08-04.**
Change `shot-map-model.ts`'s `?? 0` to `?? null` and widen both fields. **This closes the
deferred-work item routed here by name** (grep `"dead fields carrying a defaulting decision"`).
**Correction to that ledger entry, measured:** `CrossLogRow` **already** uses `?? null` with type
`number | null`, and `DefensiveLogRow` was fixed by 2.9's code review with a docblock naming this
story as owner of the Shot fix. The ledger's *"`cross-map-model.ts:160-161` does the same"* is
**stale**. **Only `ShotLogRow` is still wrong**, and this ruling makes all three log row models agree
on one null contract.
Nulls sort **LAST**, matching `orderByMinute` (`marker-layout.ts`, `return left == null ? 1 : -1`).
Provide **one** shared null-last numeric comparator so no table re-implements it.
*Rejected alternative:* delete the fields and carry raw `at` (the `MomentumTableRow` shape) — cleaner
in isolation, but `DefensiveLogRow` shipped the flattened pair and this would leave three models in
two shapes.

**4 — Default order comes from the artifact; sorting is user-initiated re-ordering ONLY.**
AD-5: *"The App may filter, select, and perform **user-initiated re-ordering only** — canonical/
default order always comes from the artifact."* Every table's **initial** order stays exactly what it
is today, and every table keeps stating that order in its caption. **Derive nothing.**

**5 — There is NO `defaultSort` prop.** Every table mounts with **no active column**, which *is* the
artifact order, and every `<th>` mounts `aria-sort="none"`. The cycle's third state is "no column
active", not "column X ascending". AC 2's *"default sort is stated"* is discharged by the **caption**
(decision 7), never by a sorted-on-mount column — a `defaultSort` prop would silently re-order all
twenty retrofits and break Task 7.1's "same order".

**6 — "Sorting never loses row focus": a stable key is NECESSARY and NOT SUFFICIENT.**
React 19 reconciles a keyed reorder with `Node.insertBefore`, whose *removing steps* blur the focused
element — `Node.moveBefore()` exists precisely because `insertBefore` does not preserve focus, and
React 19.2 does not use it in stable. **RULED:** stamp `data-row-key` on every `<tr>`; before the
sort state change, walk `document.activeElement` up to its `<tr>` and capture the key; in a
`useLayoutEffect` on the sort state, if focus fell to `<body>` and a key was captured, refocus inside
`[data-row-key="…"]`. See AC 2 BINDING (c): this is unobservable today and is the forward guarantee.

**7 — The caption states the DEFAULT order and never mutates.** A caption that rewrote itself on
every sort would make the one durable statement of canonical order unreadable, and would fight
`#defensive-actions`' already-conditional caption (`viz.table.caption` vs
`viz.defensiveActions.tableCaptionNoClock`). Sort state lives in `aria-sort` plus one announcement.

**8 — Sorting text goes through `compareText(a, b)` at its `'es'` DEFAULT. NO departure.**
`compareText`'s signature is `(a, b, locale: Locale = "es")`, so **calling it with two arguments
satisfies UX-DR12 verbatim**, uses the house helper, and constructs no second collator. An earlier
draft declared a departure to active-locale sorting; it was unnecessary and is withdrawn. The `en`
collator at base sensitivity collapses `ñ` into `n`, making `Núñez` and `Nunez` **equal** — an
unstable tiebreak on exactly the names most likely to appear — and the data are Spanish, Korean,
Czech and German proper nouns in a Spanish-first product.
**Measured, and it changes how this is tested:** across all 96 fixture player names the `es` and `en`
orders are **identical — 0 disagreements in 9,216 pairs, 0 non-ASCII characters**. Locale-keyed
collation is **unobservable in the browser on shipped fixtures**; Task 2.6 is the only place it can
be proved. Never `localeCompare`, never `<`/`>` on strings.

**9 — Exactly ONE new polite live region — and it CANNOT live inside the table.**
`EXPERIENCE.md:115` authorises a sort-direction region (2.8 decision 16 enumerates all three the
project allows). A region inside the shared table would mint **twenty** of them, and every instance
inside a `ViewDataDisclosure` would be **conditionally mounted** (`{open ? <div…> : null}`) — a region
that mounts already-populated does not announce reliably.
**RULED:** one `SortAnnouncer` **context provider**, mounted **once** in `MatchBundleRegion`,
rendering a single **persistent** `<span aria-live="polite" className="sr-only">` — the shipped
`i18n-provider.tsx` / `MatchBundleRegion.tsx` pattern. The shared table consumes `useSortAnnounce()`
and calls it from the click handler; it renders **no** region of its own. No `role="status"`, no
`role="alert"`, no second region.

**10 — No `aria-pressed` anywhere.** A sortable header's state is `aria-sort` on the `<th>`; adding
`aria-pressed` to the inner button would announce two competing states for one control. 2.9 decision
18 established the "no selection ⇒ no `aria-pressed`" line and it holds here.

**11 — Presence gates are preserved exactly.** `anyExpectedGoals` (FD-1) and `anyContestType` /
`anyPlayerName` / `anyMinute` stay as they are, including the conditional caption key. They make
column sets **dynamic**, which is why decision 2 forbids index-based sort keys.

## Tasks / Subtasks

- [x] **Task 1 — Baseline and orientation**
  - [x] 1.1 `npm test` in `app/`. The baseline at `892766c` is **555 passed / 22 files, all green** —
        measured on a clean tree after 2-10 landed. **Re-measure anyway**; 2-10 is `review`, not
        `done`, so a code-review session can still move it. `npm test` is **not** part of
        `npm run build`. Note the two legitimate values: with no `app/out/` the 20 static-output
        tests are `describe.skipIf`-ed and you will see a lower count — that is not a broken baseline.
  - [x] 1.2 **RE-COUNT the retrofit surface** — `grep -rln "function DataTable" src/components/` and
        `grep -rc "<DataTable" src/components/*.tsx`. Record both numbers in the Dev Record. Six
        files / ten instances at `163fa20`; ten / twenty with 2-10 present. **The count drives the
        scope of Tasks 7 and 8.3.**
  - [x] 1.3 `git status`. Expect 2-10's untracked components and dirty shared files. **Do not stage
        anything you did not write.**
  - [x] 1.4 Read, before writing anything: `ViewDataDisclosure.tsx`, one pitch-ink `DataTable`
        (`ShotMapsSection.tsx`) and one canvas-ink `DataTable` (`MomentumSection.tsx`) — the two ink
        families you are about to unify — plus `lib/format.ts`, `viz/marker-layout.ts`
        (`orderByMinute`) and `MatchBundleRegion.tsx`.

- [x] **Task 2 — The sort contract, as a pure module** (AC 2)
  - [x] 2.1 New `app/src/lib/table-sort.ts` (pure: no React, no DOM, no `t()`). Export
        `TableColumn<Row>` **exactly as decision 2 specifies** and a stable `sortRows`.
  - [x] 2.2 Sort accessors are **getters**, not key names — `MovementRow`'s six nested `counts`
        columns are unreachable by `keyof Row`.
  - [x] 2.3 Text columns sort via `compareText(a, b)` — **two arguments, taking the `'es'` default**
        (decision 8). Import from `@/lib/format`; **construct no collator.**
  - [x] 2.4 One shared **null-last** numeric comparator (decision 3), asserted equivalent to
        `orderByMinute`'s null handling. **"Last" means the END OF THE ARRAY in BOTH directions** —
        descending does not flip nulls to the top. `orderByMinute`'s `left == null ? 1 : -1` defines
        only ascending; this states the rest.
  - [x] 2.5 Sorting is **stable**; the cycle is **none → asc → desc → none**, where "none" is *no
        active column* and restores artifact order verbatim (decision 5). Keep the original index so
        the restore is exact. In "none", **every** `<th>` is `aria-sort="none"`.
  - [x] 2.6 `table-sort.test.ts` — accents and case, nulls at the array end in **both** directions,
        stability under equal keys, exact restore of artifact order, the nested-getter path, and a
        clock column sorting `(minute, stoppage)` rather than its label (`"9′"` before `"45+2′"`).
        **Pin the collation choice here, because nothing else can**: on constructed strings
        `["nino","ñino","nunez","nuñez"]` assert `es` and `en` **disagree** (`en` makes `nunez` and
        `nuñez` equal) and that the shipped call uses `es`. No fixture name distinguishes them.

- [x] **Task 3 — Close the two row-model inconsistencies** (AC 2; decision 3)
  - [x] 3.1 `shot-map-model.ts`: `minute` / `stoppageMinute` → `number | null`, populated `?? null`.
        **Update** the docblock to match `DefensiveLogRow`'s — do not delete it.
  - [x] 3.2 `shot-map-model.test.ts` reads `previous.minute * 1000 + previous.stoppageMinute` and
        **will break**. Fix to the `CrossLogRow` test's shape, which already handles nulls.
  - [x] 3.3 Assert the three log row models agree: a constructed clock-less event yields `null` (not
        `0`) in `ShotLogRow`, `CrossLogRow` and `DefensiveLogRow` alike.
  - [x] 3.4 **`MomentumTableRow.key: number → string`**, populated `` `momentum-row-${row.index}` ``
        (the `shot-row-${index}` precedent) — every other row model uses `string`, and decision 6
        needs a stable string key. **`momentum-model.test.ts` breaks in three places**: it indexes
        `series.samples[row.key]` at **two** sites (a `tsc --noEmit` error once `key` is a string)
        and asserts `.map(row => row.key)` equals `[7, 69]` at a third. Rewrite all three.

- [x] **Task 4 — The shared sortable table component** (AC 2; decisions 1, 2, 10)
  - [x] 4.1 New **`app/src/components/DataTable.tsx`** — not `ui/`, which is vendored primitives
        only. Props: `caption` (an already-composed identifier — `caption` is gated),
        `columns: TableColumn<Row>[]`, `rows`, `surface: "pitch" | "canvas"`. **No `defaultSort`.**
  - [x] 4.2 Walk **all** call sites against the interface before writing the first one. If any cannot
        be expressed, fix the interface — never special-case a caller.
  - [x] 4.3 Each sortable `<th scope="col">` carries `aria-sort` (`none`/`ascending`/`descending`)
        and contains a `<button type="button">` for click/Enter/Space. **No `aria-pressed`.**
        Min hit height ≥44px on the **button itself**, not a wrapper (the 2.4 patch).
  - [x] 4.4 Active sort column head in `{colors.accent-cyan}` with a direction glyph — DESIGN's
        `data-table.sort-active-color`. The glyph is a **module const**, never a bare JSX literal.
  - [x] 4.5 **Zebra striping never** (UX-DR12 and DESIGN both) — hairline row dividers only.
  - [x] 4.6 Numeric cells right-aligned in `type-table-numeric` (already ships `tabular-nums`);
        `clock` cells left-aligned **and** tabular.
  - [x] 4.7 **Headers are NOT sticky in this story** (AC 2 BINDING (b)). Add no `position: sticky`,
        no height to `ViewDataDisclosure`'s region, and no second scroll container.
  - [x] 4.8 Implement decision 6's focus restore (`data-row-key` + `useLayoutEffect`).
  - [x] 4.9 Consume `useSortAnnounce()` (decision 9). The table renders **no** live region.

- [x] **Task 5 — The announcer** (AC 2; decision 9)
  - [x] 5.1 New `SortAnnouncer` context provider + `useSortAnnounce()` hook.
  - [x] 5.2 Mount it **once** in `MatchBundleRegion.tsx`, wrapping the layer region. **This is the
        only change to that file in this story** — 2.11b adds the Expert sibling separately.
  - [x] 5.3 One **persistent** `<span aria-live="polite" className="sr-only">` whose text changes.
        Never conditionally mounted.

- [x] **Task 6 — i18n** (AC 2)
  - [x] 6.1 `es.ts` is canonical; `en.ts` mirrors its key shape **exactly**, no empty leaves.
        **Both files are APPEND-ONLY** — 2-10 is adding fourteen `enums.*` namespaces to them. Cite
        by quoted anchor phrase, **never** by line number.
  - [x] 6.2 Sort keys: the announcement strings (ascending / descending / cleared) and the header
        button's accessible name. `t()` has **no interpolation and no plural machinery** — compose
        into a `const` identifier first.
  - [x] 6.3 `i18n.test.ts` — resolve every new key in **both** locales on the shipped template.
  - [x] 6.4 **Do not touch `enums.metric`** — `i18n.test.ts` pins its key set to exactly the 19
        `KEY_STAT_FIELDS`, and a Domain G label added there turns a green test red. (That namespace
        belongs to 2.11b's problem, not this story's.)

- [x] **Task 7 — Retrofit every instance** (AC 2; decision 1)
  - [x] 7.1 Migrate every call site the Task 1.2 count found. **Behaviour must not change except for
        the addition of sorting** — same rows, same order, same captions, same gates, same ink
        family per surface. Preserve `anyExpectedGoals` and the three defensive gates exactly,
        including the conditional caption key.
  - [x] 7.2 **One expected visual change:** Task 4.3's ≥44px hit floor grows every header row from
        `py-1.5` (~28px) to 44px. That **is** the addition of sorting; expect it in the Task 9.7
        sweep and do not "fix" it.
  - [x] 7.3 Delete every private `DataTable` copy as its call sites migrate.
  - [x] 7.4 Delete every **discharged** pointer comment — and only those. `"2.11 PLUG-IN POINT"` is
        4 sites at `163fa20`, `"Story 2.11 owns"` is 3 more. **`grep "2\.11"` returns ~17 hits across
        12 files and MUST NOT be the delete list** — `shot-map-model.ts` and
        `defensive-actions-model.ts` carry `?? null` **ownership docblocks Task 3.1 UPDATES**, and
        `shot-map-model.ts` / `i18n.test.ts` / `locales/es.ts` carry `ShotOutcomeDetail` routings for
        **2.13 / 2.18** that this story does not build. Derive an explicit file list at dev time.

- [x] **Task 8 — Ledger and disclosure** (AC 2) — **every edit APPEND-ONLY**
  - [x] 8.1 File: the `?? 0` item is **CLOSED** (decision 3). Record that the ledger's
        "`cross-map-model.ts` does the same" clause was **stale** — Cross was already correct.
        **Append the correction; do not edit the original entry.**
  - [x] 8.2 File: the sortable-table plug-in points filed by 2.6 / 2.7 / 2.8 / 2.9 are **discharged**.
  - [x] 8.3 File, **only if 2-10 has not landed**: its four components ship four more private
        `DataTable` copies (ten instances) that this story could not reach. Name an owner.
  - [x] 8.4 File the **declared departure from UX-DR12**: headers are non-sticky because
        `ViewDataDisclosure`'s region is a height-unbounded `overflow-x-auto` scrollport against
        which `position: sticky` silently never offsets. Name the fix (a height-bounded region) and
        its blocker (one shared disclosure serving twenty tables cannot pick a height). **Route to
        2.11b**, which introduces a bounded container for the Expert tables.
  - [x] 8.5 `sprint-status.yaml` — append the status line. **Never `git add -A`, and never
        `git add app/`.** Stage explicit paths from your own File List. If your commit carries any
        in-flight 2-10 lines, **disclose it in the Completion Notes**.

- [x] **Task 9 — Verification** (AC 2). The harness has **no jsdom**, so nothing rendered can be
      unit-tested. Both defects 2.7's review found were in rendered code and were structurally
      invisible to a green suite. Adopt 2.7 / 2.8 / 2.9 / 2.10's mitigation proactively.
  - [x] 9.1 **Serving mechanics first.** `next dev` cannot serve `/data/fixtures`; only `copy-data`
        populates `out/`. Verify against `python -m http.server 8765 --directory app/out`.
        `trailingSlash: true`. Turbopack reuses chunk filenames — hard-reload (Ctrl+Shift+R) before
        every check. **A hard-reload does not refresh bundle DATA** — override `fetch` with
        `cache: "no-store"` if a fixture edit seems not to land.
  - [x] 9.2 **Open every retrofitted table** at `≥lg` and `<md`, on all three fixtures, both themes.
        Sort each column both ways and back to none.
  - [x] 9.3 **Contrast, both themes, method validated first (the 2.6 method).** Reproduce a published
        figure before trusting a new one. **Creation-time measurements are in Dev Notes → "Contrast";
        reproduce them, then measure the active-sort cyan head and the direction glyph.** Record as a
        `| element | dark | light | floor |` table. **Light theme is where 2.6, 2.7, 2.8 and 2.9 each
        found a failure from the first-consumer position.**
  - [x] 9.4 **`--ink-muted` is BANNED for table content** — DESIGN restricts it to *"disabled states
        and ≥3:1 non-text glyphs only"*, and it computes **3.69:1 dark on `--card`**. Any secondary
        table text must be `--ink-secondary` or better. Sweep for it.
  - [x] 9.5 **Keyboard, live, with real key presses.** Tab to a header; `Enter` and `Space` both
        sort; arrow keys do **not** hijack; the cycle is none → asc → desc → none and in "none"
        every `<th>` reads `aria-sort="none"`. Confirm **zero `aria-pressed`**.
        **On "never loses row focus": no body-row content is focusable** (AC 2 BINDING (c)). Record
        that honestly and verify decision 6's restore with a constructed focusable stub instead.
  - [x] 9.6 **Screen-reader / structural pass:** `aria-sort` flips on exactly one `<th>` at a time;
        the polite region announces once, in the active locale. Verify by reading strings back from
        the live DOM in both locales, and **state the method honestly** (no live screen reader here).
  - [x] 9.7 **Regression sweep over every retrofit**: same row count, same default order, same
        caption, same gated columns as before. The three defensive gates and `showXg` must evaluate
        identically on all three fixtures.
  - [x] 9.8 **Reflow:** `scrollWidth === clientWidth` at **320** and **390** CSS px. Data tables keep
        their internal-scroll exception — prove the scroll is on the container, not `<body>`. Chrome
        will not resize below ~500px — use a same-origin iframe. **The measurement is VACUOUS unless
        you expand first**: sections lazy-mount and `buildSectionPlans` opens collapsibles only at
        `≥lg`, so expand every section and open every `ViewDataDisclosure` inside the iframe. **The
        5px overflow at 320px is PRE-EXISTING and proven to be Key Statistics' tile** (2.9 Task 9.6).
        **The 195px failure is 2.19's — do not attempt it.**
  - [x] 9.9 **Reduced motion:** `getAnimations({subtree: true})` returns 0. Add no transition to sort.
  - [x] 9.10 **EN toggle after load** and **theme toggle after load**, all three fixtures. Confirm an
        active sort on a `DictionaryKey` column (outcome, delivery, action type) **re-sorts** when
        labels change language — the visible consequence of decision 2's "sort on the resolved
        label". **Do NOT expect name columns to re-order** (decision 8).
  - [x] 9.11 **Static-output guards:** `src/app/static-output.test.ts` and
        `src/app/matches/static-output.test.ts` stay green.
  - [x] 9.12 **Full chain green:** `npm run build`, **then** `npm test`. Report the new suite total
        against the baseline **you measured in Task 1.1**.

### Review Findings

Code review 2026-08-04. Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance
Auditor) raised 30 findings; triaged to 4 decisions, 6 patches, 7 deferrals, 5 dismissed.

**Decisions — all four ruled by Juan, 2026-08-04.** D1 and D2 become patches; D3 and D4 become
filed deferrals.

- [x] [Review][Decision] **D1 RULED: widen the File List to carry `goalkeeping-model.ts`, disclose
      the co-commit, and re-run the Task 9.7 differential digest against the tree actually being
      committed.** The alternative — holding 2.11a until the concurrent sessions land — was rejected.
- [x] [Review][Decision] **D2 RULED: fix decision 6's mechanism now.** Track the last-focused row
      with a `focusin` listener on `<tbody>` rather than reading `activeElement` at click time; scope
      the walk to `bodyRef`; widen the guard to `null` / `documentElement`; capture column identity
      so the restore lands on the element that had focus. The forward guarantee becomes real rather
      than being deferred to 2.15.
- [x] [Review][Decision] **D3 RULED: decision 8 STANDS, unchanged, and the challenge is filed.** The
      `'es'` default is what UX-DR12 asks for verbatim, and decision 8's measurement (0 disagreements
      across 96 fixture names, 0 non-ASCII characters) still holds, so the reviewers' failure case is
      unobservable on shipped data. Filed to the 2.19 real-data cutover, where the fixture-vs-corpus
      gap must be re-measured. No code change.
- [x] [Review][Decision] **D4 RULED: deferred to 2.11b.** 2.11b reworks the table shell and
      introduces the Expert-layer bounded container; it rules announcement disambiguation there,
      alongside sticky headers, when it can see the full table inventory. No code change here.

**Decisions as originally raised**

- [ ] [Review][Decision] **The commit unit does not compile, and Task 9's evidence describes a
      different tree** — `GoalkeepingSection.tsx` is on this story's File List but now imports six
      symbols that do not exist at `892766c` (`distributionTableRows`, `aerialTableRows`,
      `bodyTypeTableRows`, `preventionHeadlineRows`, `KeeperBreakdownRow`, `PreventionHeadlineRow`),
      all added by a concurrent 2-10 review session to `app/src/viz/goalkeeping-model.ts` — a file
      **not** on the File List. Staging exactly the File List, as Task 8.5 directs, produces a
      commit that fails `tsc`. Consequently the Task 9.7 differential digest (22 tables / 451 rows,
      m001 `2241e22c`) describes the isolated worktree, not the tree being committed: the shipped
      tree renders 26 tables, Phases/Pressing now print `43,0%` where the pre-change build printed
      `43%`, and SetPlays' fourth caption changed. The suite is also 660/24, not the recorded 608/24.
- [ ] [Review][Decision] **Ruled decision 6's focus restore can never fire** — `handleSort` captures
      `document.activeElement.closest("tr[data-row-key]")`, but the only path to a sort is the
      `<button>` inside the `<thead>` row, which holds focus at that moment; `closest` returns
      `null`, so `pendingFocusKey` is always `null` and the `useLayoutEffect` early-returns. The
      forward guarantee AC 2 BINDING (c) defers to 2.15 is dead code as written. Three secondary
      defects in the same mechanism: the `closest` walk is not scoped to `bodyRef` (in Safari, which
      does not focus buttons on click, table A's row key can be captured into table B's ref); the
      `activeElement !== document.body` guard misses `null` and `documentElement`; and the restore
      targets the row's *first* focusable rather than the one that had focus (PassNetworks' edge rows
      carry two player names). [app/src/components/DataTable.tsx:179-192,210-225]
- [ ] [Review][Decision] **Ruled decision 8 challenged: text collation is pinned to `es` and never
      follows the EN toggle** — `sortRows` calls `compareText(a, b)` at its `'es'` default, exactly
      as decision 8 ruled, while every retrofit comments that the resolved label makes order "follow
      the EN toggle". Only the values follow it; the collation does not. `DataTable` never calls
      `useLocale()` though every calling section does. Decision 8's measurement (0 disagreements
      across 96 fixture names, 0 non-ASCII) still holds — this is unobservable on shipped fixtures
      and bites at the 2.19 real-data cutover. [app/src/lib/table-sort.ts:177]
- [ ] [Review][Decision] **One live region for twenty tables cannot say which table moved** —
      `announcementFor` composes only `${sortedBy} ${headText}, ${direction}.`, and `sortCleared`
      names nothing at all. `#offers-to-receive` renders two tables whose first column is headed
      "Equipo"; `#set-plays` ships four tables in one disclosure and `#goalkeeping` seven. Sorting
      the second produces speech identical to sorting the first. `SortAnnouncer`'s `tick` key fixes
      re-announcement, not ambiguity. [app/src/components/DataTable.tsx:201-208]

**Patches — all 8 applied 2026-08-04.** Verified after application: `tsc --noEmit` 0 errors,
`eslint` 0 (including the 34-test i18n gate), suite **661 passed / 24 files** — up 1 from 660,
which is the new `undefined`-ranking assertion. D1 and D2 below are the two ruled decisions that
became patches.

- [x] [Review][Patch] **D1** — File List widened to disclose `goalkeeping-model.ts` and
      `glossary.ts` as required co-travellers, proven by rebuilding the unit in a clean worktree;
      Completion Notes' stale verification figures corrected. See the File List section. Overtaken
      mid-review by the concurrent commits — see the note there.
- [x] [Review][Patch] **D2** — decision 6's focus restore rebuilt: capture moved to a `focusin` on
      `<tbody>` (scoped to this table by construction, replacing the unscoped `activeElement` walk
      that could never fire), `data-column-key` added to every cell so the restore lands on the cell
      that had focus, and the "focus survived" guard widened to `null` / `documentElement`
      [app/src/components/DataTable.tsx:160-260]

- [x] [Review][Patch] Announcer provider is conditionally mounted, breaching Task 5.3's "never
      conditionally mounted" [app/src/components/MatchBundleRegion.tsx:164]
- [x] [Review][Patch] xG head ships `headTitle` byte-identical to `headText` (`viz.table.xg` and
      `viz.shotMap.xg` are both `"xG"`); the real expansion `xgExpansion: "goles esperados"` exists
      and was not used [app/src/components/ShotMapsSection.tsx:299]
- [x] [Review][Patch] Stale ledger cross-reference: the docblock still cites `ShotLogRow`'s `?? 0`
      defaulting, which this story removed and filed CLOSED [app/src/viz/momentum-model.ts:414-416]
- [x] [Review][Patch] `nullRank` tests `=== null`, so an `undefined` sort value ranks as present and
      reaches `a - b` → `NaN`, which `Array.sort` coerces to `+0`, discarding the index tiebreak.
      Unreachable today (every `counts` Record is built from a frozen enum list) but `clockSortValue`
      already normalizes `undefined` — the two disagree [app/src/lib/table-sort.ts:86-88]
- [x] [Review][Patch] `sortRows` re-implements null-last inline in `sortByValue` instead of using the
      exported `compareNumberNullLast` / `compareTextNullLast`, whose docblock claims they are the
      one statement "so no table re-implements it". Both exports have zero production callers; only
      `nullRank` is genuinely shared [app/src/lib/table-sort.ts:113-125,187-198]
- [x] [Review][Patch] The `sort: null` head omits `aria-sort` entirely, departing from decision 5's
      "every `<th>` reads `none`" with only an inline comment and no filed departure. Unreachable —
      zero call sites ship `sort: null` [app/src/components/DataTable.tsx:264-278]

**Deferred**

- [x] [Review][Defer] Zero-row tables render live, announcing sort controls over an empty `<tbody>`
      (`panelDataState` returns `"zero"` for `[]` and still renders) [app/src/components/DataTable.tsx:235]
- [x] [Review][Defer] Collapsing a `ViewDataDisclosure` unmounts the table and silently discards sort
      state; reopening shows artifact order with no announcement [app/src/components/DataTable.tsx:158]
- [x] [Review][Defer] Locale toggle re-orders an actively-sorted table with no announcement
      [app/src/components/DataTable.tsx:235]
- [x] [Review][Defer] A gated column disappearing while active reverts rows to artifact order but
      leaves `sortState` non-null and un-announced [app/src/lib/table-sort.ts:169-172]
- [x] [Review][Defer] Sort runs unmemoised on every render, and the inactive path still copies the
      array. Non-issue on shipped fixtures (largest table is well under 600 rows) — a real cost at
      the corpus scale the code comments cite [app/src/components/DataTable.tsx:235]
- [x] [Review][Defer] `clockSortValue`'s `× 1000` is a second encoding of `(minute, stoppage)`
      alongside `momentum-model.ts`'s `STOPPAGE_RANK_BASE = 100`. The `× 1000` is the safer scale
      (shot/defensive models enforce no upper bound where `readStamp` does), but the constant is now
      stated twice [app/src/lib/table-sort.ts:139-147]
- [x] [Review][Defer] `aria-label` replaces rather than extends the visible head text, so a
      voice-control user saying "click Minuto" no longer matches the accessible name prefix. WCAG
      2.5.3 is met (visible text is contained) [app/src/components/DataTable.tsx:302]

**Dismissed as noise** — header row growing ~30px → 44px (Task 7.2 anticipates it explicitly); the
caption "becoming false" after a sort (decision 7 rules exactly this, and `aria-sort` is the durable
statement); new `title` tooltips on team-code heads (that is `headTitle`'s designed purpose); the
deleted plug-in comments losing the sticky-header record (filed in the ledger and in `DataTable.tsx`'s
header); dead `rowHeader` / `sort: null` reported as defects (already recorded in the ledger).

## Dev Notes

### What already exists — reuse it, do not rebuild it

| Need | Where it already is |
|---|---|
| `Intl.Collator('es',{sensitivity:'base'})` | `lib/format.ts` → `compareText`, a module-level per-locale collator cache. **Zero production callers today.** |
| Null-last minute ordering | `viz/marker-layout.ts` → `orderByMinute` |
| Home-before-away tiebreak | `viz/marker-model.ts` → `sideRank`, `resolveSide` |
| Tabular figures | `globals.css` `@utility type-table-numeric` (already `tabular-nums`) |
| Live-region pattern | `i18n-provider.tsx`, `MatchBundleRegion.tsx` — persistent `sr-only` span |
| 44px hit floor | `viz/marker-layout.ts` → `MIN_HIT_PX` — **import, do not re-declare** |

**Does not exist and must be built:** any shared table component; `aria-sort` anywhere (**8 prose
mentions at `163fa20`, 0 attributes**); a sticky `<thead>`; any sort-announcement locale key; any
`useSort` hook.

**`@/lib/format` is the only formatting path** and **throws on non-finite input**. Never `toFixed`,
never a literal `"es"`, never pre-sanitize. 2.9's review found the live consequence: a `formatDecimal`
throw inside a lazily-mounted disclosure fires when the reader opens "Ver los datos".

**`src/viz/**` is pure**: no React, no DOM, no `t()`, no `@/lib/format`. ESLint restricts the `t`
binding and `@/lib/build-data` but **not** `@/lib/format` — keeping formatting out is design
discipline, not a machine-checked rule. `table-sort.ts` lives in `src/lib/`, not `src/viz/`.

**`PitchPanel.tsx` needs NO change** — it takes `dataTable: ReactNode`, fully opaque, so a sortable
table passes straight through. But note the consequence: `PitchPanel` is what wraps that node in
`ViewDataDisclosure`, which is why AC 2 BINDING (b) and decision 9 bite.

### Contrast, measured at creation — both themes

Computed from `globals.css` tokens with the WCAG relative-luminance formula. **Reproduce these in
Task 9.3 before trusting any new measurement.**

| element | dark | light | floor | verdict |
|---|---|---|---|---|
| `--ink-primary` on `--card` | 15.81 | 17.67 | 4.5 | pass |
| `--ink-secondary` on `--card` | 7.87 | 7.61 | 4.5 | pass |
| **`--ink-muted` on `--card`** | **3.69** | 5.61 | 4.5 | **FAILS dark — banned for content** |
| `--viz-team-a` on `--card` | 13.56 | **4.99** | 4.5 | pass (light is close) |
| `--viz-team-b` / `--ring` / `--accent-cyan` on `--card` | 10.30 | 5.36 | 4.5 | pass |
| `--border-hairline` on `--card` | 1.31 | 1.32 | — | decorative only |
| `--surface-raised` on `--card` | **1.00** | **1.00** | — | **byte-identical tokens** |
| `--surface-overlay` on `--card` | 1.12 | 1.14 | — | weak |

**Three findings that bind:**
**(a) `--ink-muted` may not carry table content.** DESIGN restricts it to *"disabled states and ≥3:1
non-text glyphs only"*, and dark confirms it. A 46-column table wants a quieter secondary ink for
units and hints — **use `--ink-secondary`.**
**(b) The active-sort cyan passes in both themes** (10.30 / 5.36) — DESIGN's
`data-table.sort-active-color` is safe as specified.
**(c) DESIGN's `data-table.header-background: surface-raised` is a 1.00:1 NO-OP on a card.**
`--surface-raised` and `--card` are byte-identical in both themes (`#171b1f` / `#ffffff`) and these
tables already sit on `--surface-raised`. Harmless in 2.11a because headers are not sticky — but it
is the reason 2.11b must rule a real delimiter (overlay fill **plus** a doubled bottom border;
`--shadow-overlay` only with a declared departure, since `globals.css` scopes shadows to *"true
overlays"*).

### The i18n gate — seven prior reviews paid for these

- `t()` has **no interpolation and no plural machinery**; compose into a `const` first.
- `{t(cond ? "a" : "b")}` **fails the gate**. Hoist the key into a `const … : DictionaryKey`.
- A **template literal inside a gated prop fails the gate even when every fragment is a `t()` call**.
- **16 prop names are gated** when the value is a literal: `aria-label`, `aria-description`,
  `aria-placeholder`, `aria-roledescription`, `aria-braillelabel`, `aria-valuetext`, `title`, `alt`,
  `placeholder`, `label`, `message`, `text`, `description`, `caption`, `heading`, `tooltip`. **Name
  new props from the house set**: `figureSummary`, `metaLine`, `zeroLine`, `headline`, `explanation`,
  `panelTitle`, `labelText`, `valueText`. **`caption` is gated** — the shared table's caption prop
  takes an already-composed identifier, exactly as the ten private copies do today. `headText` /
  `headTitle` are outside the gated set by design.
- Separator glyphs and any `▲`/`▸`-class mark are **module consts**. Your direction glyph is one.
- Every key builder ends in `as DictionaryKey` — a template-literal expression infers `string`.
- `en.ts` must mirror `es.ts` exactly; `i18n.test.ts` asserts
  `keyShape(en).sort()).toEqual(keyShape(es).sort())`.

### Project Structure Notes

- PascalCase components in `src/components/`; kebab-case pure modules in `src/viz/` and `src/lib/`.
  Tests co-located as `<module>.test.ts`.
- Vitest, `environment: "node"`, **no jsdom**. Everything assertable belongs in `table-sort.ts`.
- `npm run build` = lint → typecheck → assert-schema-version → next build → copy-data.

### Scope boundaries

**Touch:** `app/src/lib/table-sort.ts` (+test); `app/src/components/DataTable.tsx` (new); the
`SortAnnouncer` provider (new); `app/src/viz/shot-map-model.ts` (+test — decision 3 only);
`app/src/viz/momentum-model.ts` (+test — the `key` unification and its three broken assertions; the
standing do-not-touch on that module covers its **ordering** only); every component carrying a
private `DataTable`; `app/src/components/MatchBundleRegion.tsx` (**provider mount only**);
`app/src/locales/{es,en}.ts`; `app/src/lib/i18n.test.ts`; `deferred-work.md`; `sprint-status.yaml`;
this story file.

**Do not touch:** `tactical-sections.ts`; `TacticalLayer.tsx` (2-10 owns its switch);
`TacticalSection.tsx`; `TacticalErrorBoundary.tsx`; `EmptyStatePanel.tsx`; `PitchPanel.tsx`;
`ViewDataDisclosure.tsx` (**explicitly — see AC 2 BINDING (b)**); `pitch-geometry.ts`;
`marker-layout.ts`; `contract/**`; `data/**`; `pipeline/**`; `app/src/lib/contract/**`; `ui/*`.

**Do not build here:** the Expert Layer shell, Domain G tables, `<md` column groups (**2.11b**); the
Expert-layer event logs (**2.11c**); sticky headers (**2.11b**); glossary tooltips (**2.18**);
`/players/{slug}` (**2.15**).

### Known-open items that are NOT this story's

- The whole-layer `TacticalErrorBoundary` blast radius — **2.11b** takes the Expert half.
- `PendingSectionPanel`'s keep-or-delete, routed here by 2.10 decision 20 — **2.11b** rules it.
- `ShotOutcomeDetail` labels — **2.13 / 2.18**, and the `2.11` mentions in `shot-map-model.ts`,
  `i18n.test.ts` and `locales/es.ts` refer to *those*, not to sorting. Task 7.4 must not delete them.
- The 195px reflow failure (2.19); the 5px overflow at 320px (Key Statistics' tile, pre-existing).

### Coordination & hygiene

- **The tree is CLEAN and 2-10 has landed** (`892766c`, "Story 2.10: phases, pressing, set plays and
  goalkeeping — the Tactical Layer closes"). The concurrent-session hazard this story was originally
  written around is **gone**: `app/` has no uncommitted work, the retrofit surface is fixed at
  10 files / 20 instances, and the five previously-hot shared files are all committed.
  **Confirm this at Task 1.3 rather than assuming it still holds** — 2-10 is `review`, not `done`,
  so a code-review session may still patch `app/`. If the tree is dirty when you start, the old
  rules snap back: append-only on `locales/{es,en}.ts` and `lib/i18n.test.ts`, cited by quoted
  anchor phrase rather than line number (the 2.6 drift lesson).
- **`git add -A` is forbidden and `git add app/` is unsafe by default.** Stage explicit paths only,
  from your own File List.
- `deferred-work.md` line numbers **drift** — every ledger citation here is a `grep "<phrase>"`.
- **Verify append-only programmatically** (the 2.9 method): the post-edit file must start with the
  pre-edit bytes exactly.
- Commit directly to `main` (solo repo); no feature branch, no PR.

### References

- `epics.md:850-853` — AC 2, reproduced verbatim above. `epics.md:100-126` — **the UX-DR rules live
  here**, not in DESIGN.md or EXPERIENCE.md. **UX-DR12 (:115)**: *"client-side sort on any column
  head (click/Enter/Space, `aria-sort`, polite live-region announcements); `Intl.Collator('es',
  {sensitivity:'base'})` for text sort; stated default sort per table; sticky header (+ sticky player
  column in Expert tables); `scroll-padding-top`; `<md` Hub sort via DropdownMenu; sorting never
  loses row focus; **zebra striping never**."* The DropdownMenu clause is scoped to **Hub** tables —
  not this story. Also UX-DR2 (:105), UX-DR16 (:119), UX-DR19 (:122).
- `EXPERIENCE.md:76` — the sortable data-table pattern; `:115` — authorises the sort-direction polite
  live region (2.8 decision 16 is what enumerates all three the project allows).
- `DESIGN.md` — `data-table` tokens (`header-background: surface-raised`, `row-divider:
  border-hairline`, `numeric-typography: table-numeric`, `sort-active-color: accent-cyan`); *"zebra
  striping never — hairline row dividers only"*; the `--ink-muted` restriction.
- `ARCHITECTURE-SPINE.md` — AD-5 (*"user-initiated re-ordering only — canonical/default order always
  comes from the artifact"*), AD-7, AD-12.
- `deferred-work.md` — grep `"dead fields carrying a defaulting decision"` (decision 3);
  `"The pass matrix ships PLAIN"` and `"The momentum data table ships PLAIN"` (decision 1).
- Prior stories: **2.6** (decision 14's plug-in point, the contrast method), **2.7** (the ink-family
  defect), **2.8** (decision 16's three live regions), **2.9** (decision 18's no `aria-pressed`,
  the `DefensiveLogRow` `?? null` precedent), **2.10** (decision 16's frozen `Record`).

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context)

### Debug Log References

**Baseline (Task 1.1).** `npm test` → **555 passed / 22 files**, all green, matching the story's
stated `892766c` baseline exactly. `app/out/` was present, so the 20 static-output tests ran rather
than being `describe.skipIf`-ed.

**Re-count (Task 1.2), the numbers the story asked to be re-derived rather than trusted:**
`grep -rln "function DataTable" src/components/` → **10 files**;
`grep -rc "<DataTable" src/components/*.tsx` → **20 instances**. Exactly the story's table, no
surprise. Post-retrofit the same greps return **1** definition (the shared component) and **20**
instances, all through `@/components/DataTable`.

**Collation (Task 2.6), measured before being asserted.** On the constructed set
`["nino","ñino","nunez","nuñez"]`: `es` → `nino, nunez, nuñez, ñino`; `en` → `nino, ñino, nunez,
nuñez`, and `en` makes `nunez == nuñez` (`compare` returns **0**). The story's claim reproduces
exactly, and it is pinned in `table-sort.test.ts` because no fixture name can distinguish the two.

### Completion Notes List

**A concurrent session was writing `app/` throughout this story, and that changed how verification
was done. Disclosed in full below.**

#### What shipped

- **`app/src/lib/table-sort.ts`** — the sort contract as a pure module. `TableColumn<Row>` exactly
  as ruled decision 2 specifies, `sortRows`, `nextSortState`, `ariaSortFor`, `clockSortValue`, and
  ONE shared null-last rule (`nullRank`) that both the exported comparators and `sortRows` build on,
  so the two can never drift. The only React reference is the `ReactNode` **type**, erased at
  compile time.
- **`app/src/components/DataTable.tsx`** — the one shared sortable table, `surface: "pitch" |
  "canvas"`, no `defaultSort`, no `aria-pressed`, no zebra, non-sticky headers, decision 6's
  `data-row-key` + `useLayoutEffect` focus restore.
- **`app/src/components/SortAnnouncer.tsx`** — one context provider mounted ONCE in
  `MatchBundleRegion`, rendering one persistent `<span aria-live="polite" class="sr-only">`.
- **All 20 instances across all 10 files retrofitted; all 10 private `DataTable` copies deleted.**

> **Count correction, measured at hand-off.** The twenty above are the instances that existed at
> `892766c`, and they are what this story's work covers. A **concurrent session has since added four
> more** to `GoalkeepingSection` (`distributionCaption`, `headlineCaption`, `bodyTypeCaption`,
> `aerialCaption`), so `grep -rho "<DataTable" src/components/*.tsx | wc -l` in the shared tree now
> returns **24**, not 20. All four are **not mine** and all four consume this story's shared API
> correctly (`columns` / `rows` / `surface="canvas"`), which is the contract being adopted rather
> than a defect. Recorded so a reviewer re-running the Task 1.2 grep is not surprised by the
> discrepancy.

#### Decisions and departures

- **Decision 3 closed as ruled**, and the ledger's *"`cross-map-model.ts:160-161` does the same"*
  clause confirmed **STALE** — only `ShotLogRow` still carried `?? 0`. Correction appended to the
  ledger rather than editing the original entry.
- **DEPARTURE, measured: DESIGN's `data-table.sort-active-color` is not used on the PITCH.**
  Canvas uses `accent-cyan` as specified (**11.27 dark / 4.99 light**). On the theme-invariant pitch
  the light `--accent-cyan` computes **2.28:1**, so the pitch marks the active column with a
  lightness step (`--ink-on-pitch` **11.14**, theme-invariant) plus the direction glyph. Filed.
- **DEPARTURE, structural: headers are NOT sticky** (AC 2 BINDING (b)). Filed and routed to 2.11b.
  Verified live: `position: sticky` on 0 of 22 `<thead>`/`<th>`.
- **Task 8.3's branch is DEAD** — 2-10 had landed, all twenty instances were reachable, nothing
  re-filed.
- **Task 7.4's delete list was derived explicitly, never from `grep "2.11"`.** Deleted: the 12
  discharged pointer comments attached to the private copies plus `momentum-model.ts`'s plug-in
  block. **Updated, not deleted:** `defensive-actions-model.ts`'s and its test's `?? null` ownership
  docblocks. **Left untouched:** the `ShotOutcomeDetail` routings in `shot-map-model.ts`,
  `i18n.test.ts` and `locales/es.ts` (those are 2.13/2.18's), and `TacticalLayer.tsx`'s
  `PendingSectionPanel` routing (2.11b's).
- **One correction to the story's own Task 7.4 text:** it says `shot-map-model.ts` carries a
  `?? null` ownership docblock for Task 3.1 to UPDATE. It did not — that docblock lived only in
  `defensive-actions-model.ts`. `ShotLogRow`'s fields carried no docblock at all, so one was ADDED
  in the `DefensiveLogRow` shape. Nothing was deleted.

#### Verification — and why it ran in an isolated worktree

**A concurrent Story 2.18 (glossary) session was writing `app/` from roughly Task 7 onward**, adding
`GlossaryTerm.tsx`, `glossary.ts`, `glossary-marking.tsx`, `use-glossary-popover.ts`,
`ui/popover.tsx`, and editing `TacticalLayer.tsx`, `TacticalErrorBoundary.tsx`, `TacticalSection.tsx`,
`StoryStatTiles.tsx`, `PhasesSection.tsx`, `PressingSection.tsx`, both locale files, `i18n.test.ts`
and `deferred-work.md`. Its in-flight state does not typecheck (its component references
`glossaryPage.*` keys that do not exist yet, and `en.ts` was mid-mirror), so **`npm run build` in the
shared tree fails on its work, not mine.** Rather than touch another session's files or report a red
chain as if it were mine, the whole chain was verified in a **git worktree at `892766c` containing
exactly this story's 24 files and nothing else** — which is precisely what this story's commit
carries.

- **Full chain GREEN in that worktree:** lint → `tsc --noEmit` → assert-schema-version →
  `next build` (7 static pages) → copy-data.
- **Suite in the shared tree: 608 passed / 24 files, all green.** That total *includes* the 2.18
  session's 22 `glossary.test.ts` tests. **This story's own contribution is 555 → 586 across 23
  files**: +22 `table-sort.test.ts`, +4 `i18n.test.ts`, +4 `shot-map-model.test.ts`,
  +1 `momentum-model.test.ts`. Arithmetic reconciles exactly.

**Regression sweep (Task 9.7) done by DIFFERENTIAL BUILD, not by inspection.** Pristine `892766c`
was built and served alongside the 2.11a build, and a digest over every table's caption, column set,
row count and every cell's text was compared in the default (unsorted) state:

| fixture | tables | rows | digest | vs pre-change |
|---|---|---|---|---|
| m001 | 22 | 451 | `2241e22c` | **identical** |
| m002 | 21 | 364 | `4f07f977` | **identical** |
| m074 | 22 | 600 | `99508d0d` | **identical** |

m002's 21 (vs 22) is a presence gate closing, evaluated identically on both builds. `showXg` is
closed on all three fixtures on both builds.

**Keyboard, with REAL key presses** (Task 9.5): Tab to a head → **Enter** → `aria-sort="ascending"`,
glyph ▲, announcement *"Ordenado por Minuto, ascendente."* → **Space** → `descending`, order
reversed 66′…3′, glyph ▼ → **Enter** → every `<th>` back to `aria-sort="none"`, glyph cleared,
announcement *"Se restauró el orden original de la tabla."*, and the artifact order restored
**byte-identically**. Focus held on the button throughout. Arrow keys do **not** hijack — the button
carries `onClick` only, no `onKeyDown`/`onKeyUp`; Enter and Space come from native button semantics.

**Structural sweep** (m001 and m074, all sections open): 112 sortable `<th>`, **all `aria-sort="none"`
on mount** (decision 5); exactly ONE active at a time; **0 `aria-pressed` inside any table**
(decision 10); **exactly 3 polite live regions page-wide, 0 inside any table, 0 `role="status"`/
`role="alert"`** (decision 9); 451 rows carrying `data-row-key`; **0 sticky `<thead>`**; **0
animations** (`getAnimations({subtree:true})`, Task 9.9); no zebra (one background per table); all
112 header buttons measure **exactly 44px** (Task 4.3/7.2's expected growth from `py-1.5`).

**Decision 2's payoff proven live** (Task 9.10): with a sort active on the shot log's outcome column,
toggling ES→EN **re-sorted** the rows — `Al arco, Bloqueado, Desviado, Gol, Incompleto` →
`Blocked, Goal, Incomplete, Off target, On target`, still ascending under the `es` collator. That
only works because `sort.valueOf` returns the call-site-resolved label.

**Contrast (Task 9.3), method validated FIRST.** All seven published figures reproduced to 2 dp
(15.81 / 7.87 / 3.69 / 10.30 / 13.56 / 9.56 / 7.26) before any new value was trusted.

| element | dark | light | floor | verdict |
|---|---|---|---|---|
| canvas ACTIVE head (`accent-cyan`) | 11.27 | 4.99 | 4.5 | pass |
| canvas inactive head / caption | 8.61 | 7.08 | 4.5 | pass |
| canvas body cell | 17.30 | 16.44 | 4.5 | pass |
| pitch ACTIVE head (`--ink-on-pitch`) | 11.14 | 11.14 | 4.5 | pass |
| pitch inactive head | 5.55 | 5.55 | 4.5 | pass |
| **pitch `accent-cyan` — DESIGN's default, REJECTED** | 7.26 | **2.28** | 4.5 | **fails light** |

**`--ink-muted` sweep (Task 9.4): 0 uses inside any table, in either theme.**

**Reflow (Task 9.8), in a same-origin iframe, every section expanded and every disclosure open.**
At **390**: `scrollWidth === clientWidth` exactly, **0 px** body overflow, with 26 scrolling
containers and 15 tables wider than their container — the scroll is on the container, which is
UX-DR16's data-table exception. At **320**: 21 px body overflow from **exactly 2 offending elements,
neither inside any table** (`div.flex.flex-col.items-center.gap-0.5` and
`span.type-stat-value.text-ink-primary` — Key Statistics' tile). **The pre-change build measures the
same 21 px from the same two elements**, so this story adds nothing to it. Proven, not assumed.

**On AC 2's "sorting never loses row focus" (BINDING (c)): reported honestly.** No body-row content
in any of the twenty tables is focusable, so the clause is satisfied by construction and **no manual
focus test was run or claimed**. Decision 6's mechanism ships as the forward guarantee and was
verified structurally (`data-row-key` on all 451 rows; the `useLayoutEffect` capture/restore path).

**Two measurement errors I made and corrected mid-verification, recorded so the numbers above can be
trusted:** (1) an earlier static server was already bound to port 8765, so a first pass read *that*
session's build — moved to a private port and re-ran everything; (2) rebuilding pristine HEAD
overwrote `out/`, so one comparison briefly compared a build against itself — the directories were
separated and every figure above comes from the corrected runs. Turbopack's chunk-filename reuse
(the story's own Task 9.1 warning) required a hard reload on each origin switch; without it the
Tactical layer fails to mount with a `ChunkLoadError` on **both** builds equally.

#### Staging and co-commit disclosure — READ BEFORE COMMITTING

**Nothing has been committed.** The tree currently mixes this story's work with the live 2.18
session's, and two shared artifacts are genuinely co-mingled:

- `app/src/locales/es.ts` and `app/src/locales/en.ts` — my 5 sort keys each, plus 2.18's `about.*`,
  `glossary.*` and `glossaryPage.*` blocks (~700 added lines that are **not** mine).
- `_bmad-output/implementation-artifacts/deferred-work.md` — my appended section plus 2.18's.
- `app/src/lib/i18n.test.ts` — verified `+58` lines, **all mine**, zero glossary content at the time
  I measured it; 2.18 has since added its own imports there.
- `app/src/components/PhasesSection.tsx` and `PressingSection.tsx` — my retrofit **plus** a
  concurrent 2-10 code-review patch (per-height `dynamic()` handles derived from the frozen enum
  lists). Both retain my `DataTable`/`TableColumn` usage.

Every edit I made to a shared file was an anchor-phrase insert; **nothing was deleted or rewritten**,
and the ledger's append-only property was verified programmatically (post-edit file starts with the
pre-edit bytes exactly, +5,701 bytes). `git add -A` and `git add app/` were never used.
**Committing now would capture 2.18's half-finished, non-compiling work.** That is Juan's call, not
mine — see the note at the end of this record.

### File List

**New**
- `app/src/lib/table-sort.ts`
- `app/src/lib/table-sort.test.ts`
- `app/src/components/DataTable.tsx`
- `app/src/components/SortAnnouncer.tsx`

**Modified**
- `app/src/components/MatchBundleRegion.tsx` (provider mount only)
- `app/src/components/MomentumSection.tsx`
- `app/src/components/ShotMapsSection.tsx`
- `app/src/components/DefensiveActionsSection.tsx`
- `app/src/components/PassNetworksSection.tsx`
- `app/src/components/OffersToReceiveSection.tsx`
- `app/src/components/MovementToReceiveSection.tsx`
- `app/src/components/PhasesSection.tsx`
- `app/src/components/PressingSection.tsx`
- `app/src/components/SetPlaysSection.tsx`
- `app/src/components/GoalkeepingSection.tsx`
- `app/src/viz/shot-map-model.ts`
- `app/src/viz/shot-map-model.test.ts`
- `app/src/viz/momentum-model.ts`
- `app/src/viz/momentum-model.test.ts`
- `app/src/viz/defensive-actions-model.ts` (docblock only)
- `app/src/viz/defensive-actions-model.test.ts` (comment only)
- `app/src/locales/es.ts` (append-only, 5 keys)
- `app/src/locales/en.ts` (append-only, 5 keys)
- `app/src/lib/i18n.test.ts` (append-only)
- `_bmad-output/implementation-artifacts/deferred-work.md` (append-only)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-11a-sortable-data-table-contract.md`

> **D1 WAS OVERTAKEN BY EVENTS DURING THE REVIEW, 2026-08-04.** Between the review's triage and its
> patch pass, the concurrent sessions committed the shared tree — `54f7093` ("Story 2.10 code
> review") and `0c407b3` ("Story 2.18: the terminology gate, /glossary and /about") — and their
> sweeping stage **captured every one of this story's File List entries**, including all four new
> files (`table-sort.ts`, `table-sort.test.ts`, `DataTable.tsx`, `SortAnnouncer.tsx`). 2.11a's work
> is therefore already on `main`, but attributed in the history to two other stories' commit
> messages. Nothing was lost and the tree compiles — those commits necessarily carried
> `goalkeeping-model.ts` and `glossary.ts`, which is exactly why. **The staging problem below is
> resolved; the attribution problem is not, and is Juan's to decide.** The analysis is retained
> because it is the measurement that proves the entanglement was real.

**Carried from concurrent sessions to make the commit compile (review patch D1, ruled by Juan
2026-08-04) — NOT this story's work, disclosed in full**

The File List above is **not a self-consistent commit unit**. Two files this story does not own must
travel with it, and this was proven by rebuilding the unit in an isolated worktree at `892766c`
rather than argued:

- `app/src/viz/goalkeeping-model.ts` (+ `goalkeeping-model.test.ts`) — **the concurrent 2-10 code
  review's work.** `GoalkeepingSection.tsx`, which IS on the File List, imports six symbols that do
  not exist at `892766c`: `distributionTableRows`, `aerialTableRows`, `bodyTypeTableRows`,
  `preventionHeadlineRows`, `KeeperBreakdownRow`, `PreventionHeadlineRow`. Without this file the
  commit fails `tsc`.
- `app/src/lib/glossary.ts` — **the concurrent Story 2.18 session's work.** `app/src/lib/i18n.test.ts`,
  which IS on the File List, has since acquired an `import … from "@/lib/glossary"`. Without this
  file the commit fails `tsc` with `TS2307: Cannot find module '@/lib/glossary'` plus nine cascading
  `TS7053`s.

**Measured in a clean worktree containing exactly the File List + those two files:**
`tsc --noEmit` → **0 errors**; `vitest run` → **599 passed, 20 skipped** (the static-output tests
`describe.skipIf` out with no `app/out/`), 21 files passed + 2 skipped.

**Correction to the Completion Notes' verification figures.** The Task 9.7 differential digest
(m001 `2241e22c` / 22 tables / 451 rows, m002 `4f07f977`, m074 `99508d0d`) and the structural sweep
(112 sortable `<th>`, 451 `data-row-key` rows, "0 across all 22 tables") were measured in a worktree
taken **before** the concurrent patches landed. They are honest measurements of this story's own
work and they still support it — but they do **not** describe the tree being committed, which
renders **26** tables (Goalkeeping 3 → 7), prints `43,0%` where the pre-change build printed `43%`
in Phases/Pressing, and carries a changed SetPlays caption. **The digest must be re-run against the
final staged tree at commit time**; it was not re-run here because two sessions were still writing
`app/` and any figure taken now would be stale again by the time it is staged. The suite total in
the shared tree is likewise **661 / 24 files** as measured at review time, not the recorded 608/24.

## Change Log

| Date | Change |
|---|---|
| 2026-08-04 | Implemented. One `lib/table-sort.ts` + one `components/DataTable.tsx` + one `SortAnnouncer`; **all 20 instances across all 10 files retrofitted and all 10 private copies deleted**. Decision 3 closed (`ShotLogRow` `?? 0` → `?? null`; the ledger's Cross clause confirmed stale) and `MomentumTableRow.key` unified to a string. Suite 555/22 → 586/23 for this story (608/24 in the shared tree, which includes a concurrent session's 22 glossary tests). Full chain verified GREEN in an isolated worktree carrying only this story's files, because a concurrent Story 2.18 session left the shared tree non-compiling. Regression proven by DIFFERENTIAL BUILD against pristine `892766c`: all three fixtures byte-identical in default state (m001 `2241e22c`, m002 `4f07f977`, m074 `99508d0d`). Two declared departures filed: non-sticky headers (structural, routed to 2.11b) and the pitch active-sort colour (DESIGN's `accent-cyan` computes 2.28:1 on the pitch in light). |
| 2026-08-04 | Story context created as the first of a three-way split of epic Story 2.11, ruled by Juan. Validated by three fresh-context subagents: ~200 factual claims audited, the table inventory corrected from 9 to 10 (20 with 2-10), the collator departure withdrawn as unnecessary, the sticky-header clause found unimplementable inside `ViewDataDisclosure` and deferred with a filed departure, and the `--viz-team-a` light contrast figure corrected from 7.08 to 4.99. |

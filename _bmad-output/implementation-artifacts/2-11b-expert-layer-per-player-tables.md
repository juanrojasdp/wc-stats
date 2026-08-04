---
baseline_commit: 3d27ed0
---

# Story 2.11b: Expert Layer Shell & Domain G Per-Player Tables

Status: review

## Story

As Diego,
I want the Expert Layer to open in place with every per-player metric the report carries,
So that I can drill to complete depth without leaving the page (FR-23, UJ-2, SM-C2).

> **Depends on 2.11a** (status `done`), which shipped the shared sortable `DataTable`,
> `lib/table-sort.ts`, the `SortAnnouncer` provider and the `TableColumn<Row>` contract.
> This story consumes them and extends `DataTable` **additively** — it does not fork it.

## Acceptance Criteria

Verbatim from `epics.md:845-848` and `:855-857`. AC 2 (the sort contract) shipped in 2.11a
**except its sticky-header clause, which is this story's** — see AC 2 (residual) below.

**AC 1 (partial — the per-player half; the event-log half is 2.11c)**
**Given** the Expert Layer shell (`#expert`, EXPERTO/EXPERT pill)
**When** it is expanded (collapsed by default at all widths, expands in place)
**Then** per-player tables expose every Domain G field from the bundle — in-possession,
out-of-possession, physical — with no "lite" versions (FR-23, SM-C2)

**AC 2 (residual only — the sticky-header clause 2.11a deferred here)**
**Given** the Expert table inside its own bounded scrollport
**When** it scrolls
**Then** the header row is sticky with `scroll-padding-top` equal to the sticky-header height
(UX-DR12), which 2.11a shipped as a **declared departure** because `ViewDataDisclosure`'s region
is height-unbounded (`deferred-work.md:1124-1137`).

**AC 3**
**Given** a `<md` viewport
**When** Expert tables render
**Then** column groups tab as En posesión / Sin posesión / Físico with a sticky player column and
horizontal scroll inside the table container only — every field remains reachable (UX-DR17).

> **BINDING: the shell does not exist and this story builds it.** Re-verified at `3d27ed0`:
> `MatchBundleRegion.tsx:173-179`'s loaded branch renders
> `<SortAnnouncerProvider><TacticalErrorBoundary><TacticalLayer/></…></…>` and nothing else.
> There is no `ExpertLayer` component, no `#expert` section, and **zero `expert.*` locale keys**.
> AC 1's "Given" is a requirement to create, not a precondition.

---

## Tasks / Subtasks

### Task 1 — Extend `DataTable` for a bounded scrollport (AC 2, AC 3)

The default path must stay **byte-identical**: with the new props absent, every one of the 26
existing call sites renders exactly what it renders today.

- [x] **1.1** Add two optional fields to `TableColumn<Row>` in `app/src/lib/table-sort.ts`:
  ```ts
  /** Extra classes for this column's <th> AND <td>. The Expert Layer's sticky
   *  run supplies width + left offset + opaque fill here. */
  cellClass?: string;
  /** Extra classes for this column's <thead> cell only — the z-index ladder. */
  headClass?: string;
  ```
  Both are presentation-only and must not reach `sortRows`. `table-sort.test.ts` needs no change.
- [x] **1.2** Add one optional prop to `DataTableProps<Row>`: `sticky?: boolean`.
- [x] **1.3** In `DataTable.tsx`, when `sticky === true`:
  - root `<table>` class becomes `w-full border-separate border-spacing-0 text-left`
    (today: `w-full border-collapse text-left`, `DataTable.tsx:287`).
    **This is mandatory, not cosmetic** — under `border-collapse` the *table* paints cell borders,
    so a sticky `<th>`'s bottom border scrolls away underneath the rows.
  - `<thead><tr>` (`:290`) drops `border-b`; each `<th>` instead gains
    `sticky top-0 z-20 border-b-2 bg-surface-overlay` plus `column.headClass`.
  - `<tbody><tr>` (`:384`) drops `border-b`; each `<td>`/`<th scope="row">` gains `border-b` plus
    `column.cellClass`.
  - When `sticky` is falsy every one of those class strings is exactly today's. Use `cn()` so
    `undefined` extras are no-ops.
- [x] **1.4** **z-index ladder — get this exactly right or body cells paint over header cells on
  diagonal scroll.** Ruled: body sticky cells `z-10`, header cells `z-20`, header cells that are
  *also* in the sticky column run `z-30`. The `z-30` comes from the call site's `headClass`.
  A flat ladder fails: same `z` means later-in-DOM wins, and `<tbody>` is later than `<thead>`.
- [x] **1.5** `DataTable` renders **no scroll container** today and still must not. The bounded
  scrollport is the Expert Layer's own wrapper (Task 4.3). Do **not** add a height to
  `ViewDataDisclosure`'s region — `deferred-work.md:1124-1137` forbids it by name.
- [x] **1.6** Add optional `tableName?: string` to `DataTableProps`, prefixed to the polite
  announcement in `announcementFor` (`DataTable.tsx:255-262`) when present. `undefined` must
  produce today's exact string, byte for byte. This closes the *mechanism* half of the
  announcement-ambiguity deferral routed here (`deferred-work.md:1222-1232`); see decision 16.

### Task 2 — The pure column/row model (AC 1)

- [x] **2.1** Create `app/src/viz/expert-model.ts`. `src/viz/**` is locale-free and is inside the
  eslint client-import seam (`eslint.config.mjs:133`) — it may import `DictionaryKey` **type-only**
  and must never import `t`. Do **not** create a new top-level `src/` directory: it would silently
  escape that seam (the exact gap Story 2.7 filed).
- [x] **2.2** Export the frozen ordered field lists, driven off the generated types so a contract
  change is a compile error:
  ```ts
  const IN_POSSESSION_ORDER: Record<keyof PlayerInPossession, true> = { … };
  export const IN_POSSESSION_FIELDS: readonly (keyof PlayerInPossession)[] = …
  ```
  Same for `OUT_OF_POSSESSION_FIELDS` (15) and `PHYSICAL_FIELDS` (9). **The order is the contract's
  `required[]` order** (reproduced verbatim below) — never alphabetical, never `Object.keys` on a
  fixture (fixtures serialize alphabetically). This is the `OFFER_MOVEMENT_ORDER` pattern from
  `viz/receiving-model.ts:54-65`; copy it.
- [x] **2.3** Export `expertFieldKey(field): DictionaryKey` returning `` `expert.field.${field}` ``.
  Because it ends in an `as DictionaryKey` cast, the house convention (`i18n.test.ts:288-301`)
  **requires** a matching resolution sweep over its full domain — Task 6.3.
- [x] **2.4** Export `ExpertRow` and `buildExpertRows(bundle): ExpertRow[]`. One row per
  `PlayerRecord`, **artifact order preserved verbatim** (home team first, then shirt number —
  `PlayerRecords`' own schema description). `key` = `playerId` (`Row extends { key: string }` is
  mandatory). Resolve the team code via `resolveSide(teamId, home, away, "expert-model")` from
  `viz/marker-model.ts:196-223` — it throws naming the offending id; there is no `teamCode` on
  `PlayerRecord`. Build rows **eagerly** so a stray id fails on load, not on expand
  (`ShotMapsSection.tsx:188` precedent).
- [x] **2.5** Export the three physical-zone band descriptors for `headTitle` (Z1 0-7 km/h, Z2 7-15,
  Z3 15-20, Z4 20-25, Z5 25+) as `DictionaryKey`s, not prose.

### Task 3 — Locale keys: the new `expert.*` namespace (AC 1, AC 3)

- [x] **3.1** Mint `expert.*` in `app/src/locales/es.ts`, then mirror the **identical key tree** into
  `en.ts`. `es.ts` is the canonical source; `en: Dictionary` is the compile-time mirror gate.
  Treat both files as **append-only** — they are the two hottest files in the repo and a concurrent
  session is editing them.
- [x] **3.2** **`expert.field.*` is 40 keys, not 46.** The six `offersByMovementType` columns reuse
  `enums.offerMovement.*` through the shipped `OFFER_MOVEMENT_PROPERTY` bridge
  (`viz/receiving-model.ts:67-86`). **Do not add a seventh entry to `enums.offerMovement`** —
  `i18n.test.ts:238` pins its key set to `OFFER_MOVEMENT_TYPES` exactly.
- [x] **3.3** **Never add Domain G labels to `enums.metric`.** `i18n.test.ts:145` asserts
  `Object.keys(es.enums.metric).sort()` equals `KEY_STAT_FIELDS` (19 keys, all Domain B) exactly.
  One extra key turns a green test red.
- [x] **3.4** Mint the shell keys: `expert.pill` (EXPERTO / EXPERT), `expert.heading`
  ("Datos por jugador" — ruled by the mockup), `expert.summary`, `expert.tableCaption`,
  `expert.tableName`, `expert.group.{inPossession,outOfPossession,physical}`,
  `expert.group.label` (the ToggleGroup's `aria-label`), `expert.empty.headline`,
  `expert.empty.explanation`, and `viz.table.position` (the `viz.table.*` namespace already carries
  `team`, `player`, `shirt: "Dorsal"`, `unknown` — `position` is the only head missing).
- [x] **3.5** Mint `match.bundle.crashedExpert` / `match.bundle.crashedExpertExplanation`
  (decision 1). They must not equal the Tactical pair — `i18n.test.ts:915-932` already pins that
  shape for the section-level pair; follow it.
- [x] **3.6** **`expert.summary` must describe the per-player tables ONLY.** The mockup's copy is
  "En posesión · Sin posesión · Físico — tablas por jugador y registros completos"; the
  "registros completos" half is 2.11c's event logs and does not exist yet. Ship the tables-only
  form and record that 2.11c updates it. Shipping the full mockup string would be a false claim.
- [x] **3.7** **Every new Spanish string is swept by the forbidden-register regex**
  (`i18n.test.ts:675-721`): `/portero|parada|a puerta|fuera de juego|clasificaci|chute|córner|vosotros|usted|[¡!]/i`.
  Live landmines in this column set: `attemptsAtGoal` must **not** be "Intentos **a puerta**"; no
  exclamation marks anywhere.
- [x] **3.8** **Reuse the ruled Spanish already in the glossary** rather than inventing:
  `take-on` → **regate**, `step-in` → **irrupción** (FINAL, 2.18 decision 2, Juan),
  `speed-zones` → **zonas de velocidad**, `high-speed-run` → **carreras a alta velocidad**, whose
  definition ships the ruled table abbreviation **"CARR. ALTA VEL."** — use that as `headText` and
  the full term as `headTitle`. `enums.offerMovement["no-movement"]` = "Sin desmarque" fixes the
  house term for *offer* as **desmarque**, so `totalOffers`/`offersReceived` follow it.
  For any term with no ruled Spanish (`pushingOn`, `pushingOnIntoPressing`, `looseBallReceptions`),
  mint per the procedure at `EXPERIENCE.md:278` and record the choice in Completion Notes.

### Task 4 — The Expert Layer shell (AC 1)

- [x] **4.1** Create `app/src/components/ExpertLayer.tsx`. **Do not touch
  `app/src/lib/tactical-sections.ts` and do not reuse `TacticalSection`** — see decision 2.
  Copy `TacticalSection`'s focus/nonce contract (`TacticalSection.tsx:86-97`) rather than
  importing it.
- [x] **4.2** Structure, from the mockup (decision 3):
  `<section id="expert" aria-labelledby="expert-heading" className="mt-layer-gap border-t border-hairline pt-5">`
  → the EXPERTO pill (`type-label-caps text-ink-secondary bg-surface-overlay rounded-full px-3 py-1`,
  **above** the heading, not inline) → `<h2 ref id="expert-heading" tabIndex={-1} className="type-headline text-ink-primary">`
  wrapping `<button type="button" aria-expanded aria-controls={open ? "expert-content" : undefined}
  aria-describedby="expert-summary" className="flex min-h-11 w-full items-center justify-between gap-tile-gap text-left">`
  → chevron `▸` in an `aria-hidden` span, `rotate-90` when open → summary `<div>` (never `<p>`) →
  lazy-mounted content `{open ? <div id="expert-content" className="mt-4">…</div> : null}`.
  `aria-controls` must be **conditional** — a static one points at an absent id while collapsed.
  The chevron is a module-level `const`, never a bare JSX literal (i18n gate).
- [x] **4.3** The **bounded scrollport** wrapper around the table, and the reason AC 2 is reachable
  at all: `className="max-h-[70vh] overflow-auto scroll-pt-11"`. `scroll-pt-11` (44px) is
  UX-DR12's `scroll-padding-top` and equals the sticky header's `MIN_HIT_PX` floor.
- [x] **4.4** **Collapsed by default at every width** (UX-DR6, `EXPERIENCE.md:72`) — there is no
  `isLg` branch here, unlike `buildSectionPlans`. Content lazy-mounts on expand.
- [x] **4.5** Its **own** hash listener: read `window.location.hash` at mount **and** subscribe to
  `hashchange`; on `#expert`, set open, `scrollIntoView()` (no args), then focus the heading with
  `preventScroll: true`, driven by an incrementing nonce so it fires on anchor navigation and user
  toggle but never on first render. `TacticalLayer`'s `sectionIdFromHash` returns `null` for
  `#expert` **by design** (`TacticalLayer.tsx:58-62`) — do not extend it. Mount-time read is
  load-bearing: the layer is client-only under AR-11, so the browser has already abandoned the
  deep link by mount.
- [x] **4.6** Register `#expert` in no nav, TOC or skip-link — none exists. The app's only anchor is
  `SiteHeader`'s `#main-content`. Add none.

### Task 5 — The table (AC 1, AC 3)

- [x] **5.1** **One `<DataTable>` instance.** Columns = 4 identity + the data columns for the
  active scope. At `≥md`: all three groups concatenated (46 data → **50 rendered columns**).
  At `<md`: the selected group only (16 / 15 / 9). Rows are always all players, both teams.
  `EXPERIENCE.md:133` gives desktop "Full table, all column groups, internal horizontal scroll if
  needed" and `<md` the group tabs — this is the single code path that serves both.
- [x] **5.2** Identity columns, in this order:
  | key | headText | align | sort | notes |
  |---|---|---|---|---|
  | `team` | `viz.table.team` | text | text on `teamCode` | resolved team **code**, uppercased |
  | `shirt` | `viz.table.shirt` ("Dorsal") | numeric | number | |
  | `player` | `viz.table.player` | text | text on `playerName` | **`rowHeader: true`** |
  | `position` | `viz.table.position` | text | text on the **resolved** label | `` t(`enums.position.${row.position}`) `` — template literal, no cast needed (`LineupsDisclosure.tsx:40` precedent) |
  `playerId` is **not** a column — it is the join key and the React key only.
- [x] **5.3** The sticky run is `team` + `shirt` + `player`, in that order, via `cellClass`
  (decision 5). Ruled widths and offsets — a sticky run needs an explicit `left` per column and
  cannot compute one from a class string:
  - `team`: `sticky left-0 z-10 w-[3.5rem] bg-surface-raised` (+ `headClass: "z-30"`)
  - `shirt`: `sticky left-[3.5rem] z-10 w-[2.75rem] bg-surface-raised` (+ `headClass: "z-30"`)
  - `player`: `sticky left-[6.25rem] z-10 w-[7rem] truncate md:w-[12rem] bg-surface-raised`
    (+ `headClass: "z-30"`), with `title={row.playerName}` on the cell for the truncated case.
    `title` is a gated prop name but `row.playerName` is a **variable**, not a literal — the gate
    bans literals and template literals, so this passes.
  **The fill must be opaque** (`bg-surface-raised`, the surface these tables sit on) or the scrolled
  columns show through. `position` scrolls with the data.
- [x] **5.4** **MEASURE at 390px and record the number in Completion Notes**: viewport 390 − 32
  gutters = 358px content, minus a 212px sticky run leaves ~146px of data columns.
  **If fewer than two data columns are visible, the escape hatch is pre-authorised**: add a `<md`
  team `ToggleGroup` (exact precedent: `PitchPanel.tsx:1161-1188`), which drops the `team` column
  at `<md` and returns ~56px. Do not take the escape hatch pre-emptively; measure first.
- [x] **5.5** Data columns — one factory per scalar type, the `countColumn` pattern from
  `GoalkeepingSection.tsx:550-563`:
  - `Count` (37 fields) → `formatInteger(v, locale)`, `align: "numeric"`
  - `Percentage` (`passCompletion`, `lineBreakCompletion`) → `formatPercent(v, locale, 1)`,
    `align: "numeric"` — **stored, never recomputed** from attempted/completed (AD-5)
  - `Metres` (`totalDistance`, `distanceZone1..5`) → `formatDecimal(v, locale, 1)`,
    `align: "numeric"`, **unit in the column head**: `` `${label} (${t("enums.unit.m")})` ``
  - `KmPerHour` (`topSpeed`) → `formatDecimal(v, locale, 1)`, unit `enums.unit.kmh` in the head
  Per-cell units are banned — 46 columns of them at 11px is unreadable (decision 4).
- [x] **5.6** `sort.valueOf` returns the **raw numeric** for numeric columns and the **resolved
  label** for `position` (so the order follows the EN toggle — `DefensiveActionsSection.tsx` sets
  this precedent verbatim).
- [x] **5.7** `caption` = `expert.tableCaption`, stating the default order ("Ordenado por equipo
  local y dorsal.") and **never mutating** on sort (2.11a decision 7). Pass `sticky` and
  `tableName={t("expert.tableName")}`. `surface="canvas"` — these tables sit on the card, not on a
  pitch. Getting the surface backwards is the defect 2.7's review headlined.
- [x] **5.8** **No cell may ever render an em dash** and no presence gate applies — see the
  nullability census below. Zeros are dense and real. Print `0`.

### Task 6 — The `<md` column-group tabs (AC 3)

- [x] **6.1** Use the vendored `ui/toggle-group.tsx` with `type="single"`, **not** Radix `Tabs`
  (decision 6). Guard the empty string: Radix reports `""` when the active segment is re-clicked
  and the active group must not be deselectable (both existing call sites guard this).
- [x] **6.2** Labels are ruled **verbatim** in `EXPERIENCE.md:276`: **En posesión / Sin posesión /
  Físico**. Story 2.18 already moved the app off the rejected "Con balón / Sin balón" form —
  do not reintroduce it and do not reuse `viz.phases.*` (those are phase labels, not group labels).
- [x] **6.3** Render the ToggleGroup only below `md`. Use `useMediaQuery(MD_MEDIA_QUERY)` from
  `lib/use-media-query.ts:31` — it is `useSyncExternalStore`-based, so the first client render is
  already at the right breakpoint.

### Task 7 — Error boundary, empty state, and the routed-here calls

- [x] **7.1** Wrap `<ExpertLayer>` in a **second, sibling** `TacticalErrorBoundary` inside
  `MatchBundleRegion.tsx`'s loaded branch, inside the existing `<SortAnnouncerProvider>` (so the
  table's sort announcements reach the one live region). Two instances are structurally safe:
  `state` is a per-instance class field and there is no module-level state.
- [x] **7.2** **The copy-override props already exist** — pass
  `headlineKey="match.bundle.crashedExpert"` and `explanationKey="match.bundle.crashedExpertExplanation"`.
  Do **not** re-implement the parameterisation (decision 1).
- [x] **7.3** Add optional `logLabel?: string` to `TacticalErrorBoundary`, defaulting to today's
  `"TacticalLayer render failed"` (`TacticalErrorBoundary.tsx:76`). **Name it `logLabel`, not
  `label`** — `label` is on the i18n gate's sixteen gated prop names and would fight the rule at
  every call site. The Tactical mount stays byte-identical.
- [x] **7.4** Empty state: `bundle.players === null` → `<EmptyStatePanel headline={…} explanation={…}>`
  with **both** halves overridden to name Domain G (decision 10). `EmptyStatePanel` takes resolved
  **strings**, not keys, and both values must be hoisted to plain identifiers — a ternary inside
  `headline=` or `explanation=` trips the i18n gate (`TacticalLayer.tsx:383-390` records this).
  `players.length === 0` is **not** empty: it is `ready` with zero rows.
- [x] **7.5** `PendingSectionPanel`: **KEEP, re-route the delete** (decision 11). Record in the
  ledger that the Expert Layer declined the shell and re-file the keep-or-delete.

### Task 8 — Tests (there is no jsdom; push decisions into pure modules)

- [x] **8.1** Create `app/src/viz/expert-model.test.ts`. Assert: the three field lists equal the
  contract's `required[]` order **verbatim** (hard-code the expected arrays — this is the test that
  catches an alphabetical regression); 16 + 15 + 9 = 40 keyed fields plus 6 reused movement types
  = 46 data columns; `buildExpertRows` over all three fixtures yields **96 rows** (m001 31,
  m002 31, m074 34) in artifact order; `(teamId, shirtNumber)` is unique per bundle; every one of
  the 51 leaves is present and non-null on all 96 rows; `buildExpertRows` **throws** on a stray
  `teamId` (mutate a fixture clone).
- [x] **8.2** Extend `app/src/lib/i18n.test.ts` with an `expert.*` block: a **resolution sweep**
  over `expertFieldKey()`'s full 40-key domain in **both** locales (mandatory — the `as
  DictionaryKey` cast defeats tsc); the three group labels resolve and are distinct; the six
  movement columns resolve through `enums.offerMovement`; `match.bundle.crashedExpert*` are
  distinct from the Tactical pair. Add a regression assertion that
  `Object.keys(es.enums.metric)` still equals `KEY_STAT_FIELDS`.
- [x] **8.3** Extend `app/src/app/matches/static-output.test.ts` with an **AR-11 guard**: the
  exported HTML contains neither `id="expert"` nor the EXPERTO pill text. The existing guard at
  `:206-221` covers only the eleven `SectionId`s — `#expert` is currently unprotected.
- [x] **8.4** Confirm `app/src/lib/tactical-sections.test.ts:305` — `sectionDataState(m001, "expert"
  as SectionId)` **throws** — is still green. If it is red, `"expert"` was added to `SectionId` and
  decision 2 was violated.
- [x] **8.5** Run the full chain: `npm run lint && npm run typecheck && npm test`. Lint is the first
  step of `npm run build`, so an i18n-gate violation fails the build, not just a test.

### Task 9 — Verification and ledger

- [x] **9.1** Verify in the browser at 390px, 768px and 1280px: collapsed by default at all three;
  `#expert` deep link auto-expands and focuses the heading; sticky header actually offsets
  (`getComputedStyle(thead th).position === 'sticky'` **and** the header stays put while the body
  scrolls — the 2.11a departure was precisely a sticky rule that computed correctly and did
  nothing); the sticky run does not smear on diagonal scroll; the page itself never scrolls
  horizontally at 390px.
  **Bundle data is cached — override `fetch` with `no-store`; a hard reload is not enough.**
- [x] **9.2** Record in Completion Notes: measured data-column width at 390px (Task 5.4), whether
  the escape hatch was taken, and the contrast figures for the header delimiter.
- [x] **9.3** File to `deferred-work.md`: the **fixture zone-sum divergence** (below) routed to
  2.19 / 1.16; the `PendingSectionPanel` re-file; the ~23 remaining table identifiers for the
  announcement mechanism; the carried-forward open question on Expert-altitude tables; and close
  the sticky-header departure at `:1124-1137` and the `rowHeader` no-consumer entry at `:1158-1162`.
- [x] **9.4** Update `sprint-status.yaml`: `2-11b-expert-layer-per-player-tables: review`.

---

## Dev Notes

### THREE STALE CLAIMS FROM THE SPLIT — corrected here, do not act on the old form

1. **`TacticalErrorBoundary`'s copy-override parameterisation ALREADY SHIPPED.** Story 2.18 landed
   optional `headlineKey` / `explanationKey`, defaulted with `??` inside the fallback
   (`TacticalErrorBoundary.tsx:46-88`, `deferred-work.md:861-889`). Only the hardcoded
   `console.error("TacticalLayer render failed", …)` label remains — Task 7.3.
2. **`enums.unit.m` ALREADY EXISTS.** `es.ts` ships `unit: { km, m, kmh }`. Do not mint it; use it.
   The metres ruling itself stands (decision 4).
3. **There is no orphan-key or top-level-namespace test.** Adding `expert.*` is safe against the
   `enums`-scoped assertions. What actually binds a new namespace is the **AD-12 mirroring test**
   (`i18n.test.ts:936-961`: `keyShape(en).sort()` must equal `keyShape(es).sort()`, and every leaf
   must be a non-empty string — a non-string leaf **throws**) and the **forbidden-register sweep**
   (`:675-721`).

### The Expert Layer is a SIBLING, never a twelfth `SectionId`

`app/src/lib/tactical-sections.ts` must **not** be touched. `SectionId` is a closed union of eleven;
`sectionDataState`'s `default:` branch carries a `const unexpected: never = id` exhaustiveness check;
and **`tactical-sections.test.ts:305` already asserts `sectionDataState(m001, "expert" as SectionId)`
THROWS** — it literally uses `"expert"` as its out-of-union id. Adding `"expert"` to the registry
turns that green test red.

`TacticalSection` cannot be reused either: its `id` prop is typed `SectionId`
(`TacticalSection.tsx:41`), and `useGlossaryMarking`'s two functions are keyed on `SectionId` as
well. Build a separate shell; copy the focus/nonce contract rather than importing it.

### The mockup specifies this layer concretely — build from it

`ux-designs/ux-wc-stats-2026-07-21/mockups/key-match-dashboard-mobile.html` (the **desktop** mockup
has no Expert block):

```css
.layer-expert{margin-top:64px;border-top:1px solid var(--hairline);padding-top:20px}
.pill-expert{display:inline-block;font:600 11px/1.3 var(--font-ui);letter-spacing:.08em;
             color:var(--ink-secondary);background:var(--surface-overlay);
             border-radius:9999px;padding:4px 12px;margin-bottom:10px}
```
```html
<div class="layer-expert" id="expert">
  <span class="pill-expert">EXPERTO</span>
  <div class="row" role="button" aria-expanded="false">
    <h2>Datos por jugador</h2>
    <p class="sum">En posesión · Sin posesión · Físico — tablas por jugador y registros completos</p>
    <span class="chev" aria-hidden="true">▸</span>
```

So: a **hairline rule above** the 64px gap (not the gap alone); the pill **above** the heading row,
not inline; ruled copy `<h2>` = "Datos por jugador". `--ink-secondary` on `--surface-overlay` is
7.03 dark / 6.65 light — passes. `--spacing-layer-gap: 4rem` exists as `mt-layer-gap`
(`globals.css:306`); there is no `layer-gap` class. `role="button"` on a `<div>` in the mockup is
**not** to be copied — ship the real `<button>` (`TacticalSection`'s ruled decision 6).
Record any departure explicitly; `tactical-sections.ts` is the house precedent for departing from
this same mockup and saying so.

### Domain G in full — 51 leaves, 50 rendered columns, in contract `required[]` order

Re-verified against the working tree at `3d27ed0`. `PlayerRecord`'s schema description is the AC
restated: *"Every field the Expert Layer's per-player tables show is here — **there is no reduced
variant**."* Column order **is** the `required[]` order, which is the source page's print order.

- **Identity (5, of which 4 render):** `teamId`, `playerId`, `playerName`, `shirtNumber`, `position`
- **`inPossession` (17 props → 16 scalar columns + the nested block):** `passesAttempted`,
  `passesCompleted`, `passCompletion`\*, `switchesOfPlay`, `crossesAttempted`, `crossesCompleted`,
  `lineBreaksAttempted`, `lineBreaksCompleted`, `lineBreakCompletion`\*, `ballProgressions`,
  `takeOns`, `stepIns`, `attemptsAtGoal`, `goals`, `totalOffers`, `offersByMovementType` → nested,
  `offersReceived`
- **`offersByMovementType` (6):** `inFront`, `inBetween`, `outToIn`, `inToOut`, `inBehind`,
  `noMovement`
- **`outOfPossession` (15):** `tacklesMade`, `tacklesWon`, `blocks`, `interceptions`,
  `pressingDirect`, `pressingIndirect`, `duelsWonAerial`, `duelsWonPhysical`,
  `possessionContestsWon`, `clearances`, `looseBallReceptions`, `pushingOn`, `pushingOnIntoPressing`,
  `possessionRegains`, `possessionInterrupted`
- **`physical` (9):** `totalDistance`†, `distanceZone1..5`†, `highSpeedRuns`, `sprints`, `topSpeed`‡

\* `Percentage`, 0-100, **1 dp**, and **stored** — never recomputed.
† `Metres`, **1 dp**. Bands are the page's own: Z1 0-7 km/h, Z2 7-15, Z3 15-20, Z4 20-25, Z5 25+.
‡ `KmPerHour`, **1 dp**. Everything untagged is `Count` → `formatInteger`.

**51 leaves = 46 data + 5 identity; 50 RENDERED columns** (46 data + team-code, shirt, name,
position). `playerId` is the join key and React key. `teamId` renders as its **resolved team code**
(there is no `teamCode` on `PlayerRecord`). **FR-23 is fully satisfied**:
`pipeline/extract/domain_g.py` emits 3 identity + 46 metrics = 49, all rendered.

In TypeScript `Count`, `Percentage`, `Metres` and `KmPerHour` all erase to `number` — **the compiler
will not catch a unit or formatter mix-up.** Only the schema's `x-decimals` carries it. Drive the
formatter off the field lists, not off inspection.

**Nullability: there is none.** Zero `?`, zero `| null` anywhere inside `PlayerRecord` or its
sub-blocks; every object sets `additionalProperties: false`. The only nullable point is the
container, `Players = PlayerRecords | null`. **Fixture census: 96 rows (m001 31, m002 31, m074 34),
51/51 populated, 0 nulls, 0 missing keys.** `(teamId, shirtNumber)` is unique per bundle.
**So no Domain G cell may ever render an em dash and no presence gate applies.** Zeros are dense and
real — `goals` 0 on 90/96, `crossesCompleted` 0 on 68/96, `inBehind` 0 on 73/96, `noMovement` 0 on
64/96, `attemptsAtGoal` 0 on 60/96. **Print `0`.**

`@/lib/format`'s `assertFinite` **throws** on `null`/`undefined`/`NaN` — that is the guard rail, not
a bug. Because Domain G has no nulls, the throw is unreachable here by construction.

**There is no minutes-played, substitution or card data in Domain G** — those live in `Lineup` /
`LineupEntry`. If a column seems to need "minutes", it is not available here.

### The contract did not move under this story

`contract/version.json` is `2 → 3` in the working tree, but the entire Domain G subtree —
`PlayerRecord`, `PlayerInPossession`, `PlayerOutOfPossession`, `PlayerPhysical`,
`OfferMovementCounts` and the root `players` property — is **byte-identical to HEAD**. The v3 bump
carries `ShotOutcomeDetail` (CS-1) and a `GoalRecord.ownGoal` `$comment`. `Count`, `Percentage`,
`Metres`, `KmPerHour` are untouched. Domain G sits on a stable 51-leaf, fully-required shape.

### Rulings

1. **Error boundary — ruled by Juan.** A **second, sibling** `TacticalErrorBoundary` around
   `<ExpertLayer>` in `MatchBundleRegion`. The Tactical mount stays byte-identical. The shipped copy
   would be a **false statement** over an Expert crash — `match.bundle.crashed` is literally *"No
   pudimos mostrar el análisis táctico de este partido."* while eleven healthy Tactical sections
   render above. The override props exist; mint the two Expert keys and pass them. Add `logLabel`
   (Task 7.3). *Still open, re-filed:* `sectionContent()` is evaluated eagerly, so a throw during
   prop construction escapes the per-section boundary to the outer one.
2. **Sibling, not a twelfth section.** Above.
3. **The mockup is the spec for the shell.** Above.
4. **Distance unit — ruled by Juan: METRES, verbatim.** Do **not** convert to km: AD-7 keeps
   artifacts raw, a conversion is a derivation the contract never asks for, it loses a digit, and
   the zones collapse toward 0,0. **The unit goes in the COLUMN HEAD, never per-cell.** The Hero's
   Key-Statistics row says "Distancia (km)"; that is a different, team-level metric and the
   difference is intentional.
5. **The sticky run is `team` + `shirt` + `player`**, `player` carrying `scope="row"` via
   `rowHeader: true`. A sticky column must be a leftmost *run* — sticking `player` alone while
   `team` and `shirt` scroll under it is broken. `position` scrolls with the data. This makes 2.11b
   the **first consumer of `rowHeader`**, which `deferred-work.md:1158-1162` flagged as shipped
   without one. `sort: null` still has no consumer — every Expert column sorts.
6. **`<md` column groups are a `ToggleGroup`, not Radix `Tabs`** — 2.7 decision 7's *"'team tabs' in
   the AC names the affordance, not the ARIA role"*. `ui/toggle-group.tsx` is vendored with
   radiogroup semantics and roving focus.
7. **Sticky headers land HERE, and need a real scrollport.** Two mechanics that must be built, not
   assumed — `border-collapse` defeats a sticky header, and the corner cells need a strict z-ladder.
   Both are spelled out in Task 1.3-1.4. 2.11a's departure was a sticky rule that computed
   correctly and **silently did nothing**; verify behaviour, not computed style.
8. **The delimiter is ruled, not left to the browser.** DESIGN's
   `data-table.header-background: surface-raised` is a **1.00:1 NO-OP** here — `--surface-raised`
   and `--card` are byte-identical in both themes (`#171b1f` / `#ffffff`) and these tables sit on
   `--surface-raised`. A hairline is 1.31/1.32. **Use `--surface-overlay` fill (1.12/1.14) PLUS a
   doubled bottom border**; neither alone reads. `--shadow-overlay` is the fallback **only** with a
   declared departure, since `globals.css` scopes shadows to *"true overlays"*.
9. **Expert tables are PRIMARY content, not behind "Ver los datos"** — the layer is already
   collapsed by default; a disclosure would put them two taps deep. This is also why they get their
   own scrollport instead of `ViewDataDisclosure`'s.
10. **The empty state names DOMAIN G, not "the Expert Layer".** `players` is `PlayerRecords | null`,
    so the branch is reachable, and the generic *"El informe oficial no incluye esta sección."*
    would be a false statement over a report whose other pages are present. Override **both** copy
    halves. `[]` is **not** empty — it is `ready` with zero rows. **No fixture exercises the null
    branch**; build it, and say in Completion Notes that it could not be verified visually.
11. **`PendingSectionPanel`: KEEP, re-route the delete.** 2.10 decision 20 routed the call here on
    the grounds that *"the Expert Layer (2.11) may want the same shell"*. **It does not** — the
    absence state is a real `EmptyStatePanel`. But deleting a component plus live locale keys is a
    change three assertions in `tactical-sections.test.ts:108-125` must be reasoned about. Keep
    both; record that the Expert Layer declined it; re-file.
12. **Player names are plain text, never links.** UX-DR22's cross-link rule is scoped to **lineup**
    names, and `/players/{slug}` ships in 2.15. *Note the live inconsistency:*
    `LineupsDisclosure.tsx:34` already ships `href={`/players/${playerId}/`}` and
    `static-output.test.ts:252` pins it green, yet `src/app/` has no `players` route — a 404 in the
    static export. That is not this story's to fix, and it does not change the ruling for Expert
    tables.
13. **No leader treatment. Declared departure from UX-DR7** — 2.10 decision 11's structural
    argument: the accent-plus-glyph treatment is a **head-to-head tile** pattern, and a 34-row table
    is not two compared values. Do **not** import `resolveLeader`.
14. **`ExpertLayer` takes the whole `bundle` — a DECLARED exception** to the house rule that props
    are narrow and explicit (2.5 Task 5.1). It genuinely needs `players` and `metadata`. State it
    in the docblock. *(2.11c will add the five `events` slices.)*
15. **No skeleton and no `next/dynamic`.** The layer is collapsed at every width and lazy-mounts.
    `MomentumSection`'s is the codebase's only `next/dynamic` and is documented as its first.
16. **Announcement disambiguation (routed here by 2.11a review D4): the MECHANISM ships, the
    ~23 keys do not.** One polite live region serves the page's 26 tables and cannot say which one
    moved. 2.11b adds exactly **one** table, so it cannot verify the multi-table case — but it is
    the story touching `DataTable`, so it lands the additive `tableName?: string` prop (Task 1.6),
    mints the one key it owns, and re-files the remaining identifiers. Ruled decision 9 (one region)
    is **not** re-opened: the fix is in what the announcement says, not how many regions exist.
17. **`aria-sort` is omitted entirely on unsortable heads and that is deliberate**
    (`deferred-work.md:1234-1249`). No Expert column is unsortable, so this stays unreachable — do
    not "fix" it.

### The speed-zone claim — corrected, and a fixture defect worth filing

`pipeline/extract/domain_g.py` ships a self-validation check `domain-g-zone-sum` asserting the six
zones sum to `totalDistance` within `ZONE_SUM_TOLERANCE_M = 0.35`, **corpus-verified worst drift
0.200 m over 3,289 rows**. **But the three fixtures break it on 79 of 96 rows, worst 4.400 m.**
The fixtures are not corpus-faithful for Domain G physical data. Corroborated by
`deferred-work.md:179`: the committed m001 fixture's `physical.totalDistance` disagrees with the
printed value on 30 of 31 players.

**Render all seven values verbatim; derive nothing (AD-5); make no on-screen sum claim** while the
fixtures contradict the corpus. **File the fixture divergence** to 2.19 / 1.16 — it is a fixture
defect, not a rendering decision. (Also: `domain_g.py` records `goals <= attemptsAtGoal` as
corpus-FALSE on 4 of 104 reports — do not build a consistency affordance on it either.)

### Performance note

34 players × 50 columns ≈ **1,700 cells** in one layer. **AD-4's 500 KB is a JSON *payload* budget
measured pipeline-side** and does not constrain render; the binding one is **NFR-1** (Lighthouse
mobile ≥ 90), verified in a later story. The defence is real — the layer is collapsed at every width
and lazy-mounts, so none of this renders on first load. **Measure and record; do not gate.** If
NFR-1 later fails, the escape hatch is pre-authorised: `EXPERIENCE.md:107` bans infinite scroll
*because* *"the dataset is finite and **paginated/sectioned**"* — pagination is the sanctioned
alternative. Density moves behind disclosure, never deleted (SM-C2).

Note also that `DataTable` sorts **during render, unmemoised** (`DataTable.tsx:276-284`) — that is
load-bearing for the EN toggle and must not be "optimised" here. The ledger routes the memo question
to 2.19.

### Scope boundary — do NOT build here

The five event logs (shot, cross, pass matrix, receiving, defensive-actions) are **2.11c**, which
mounts into the shell this story builds and has its own unresolved duplication question. **Do not
remove or restructure any existing viz disclosure table** — 2.11c may need them intact.
Also not this story's: glossary tooltips on Expert headings (2.18 owns the term table),
`/players/{slug}` (2.15), the Tournament Hub tables (2.12).

---

## Project Structure Notes

**New files**
- `app/src/components/ExpertLayer.tsx`
- `app/src/viz/expert-model.ts` + `app/src/viz/expert-model.test.ts`

**Modified**
- `app/src/lib/table-sort.ts` — two optional presentation fields on `TableColumn<Row>`
- `app/src/components/DataTable.tsx` — `sticky`, `tableName`; sticky-mode class switching
- `app/src/components/TacticalErrorBoundary.tsx` — optional `logLabel`
- `app/src/components/MatchBundleRegion.tsx` — the sibling boundary + `<ExpertLayer>`
- `app/src/locales/es.ts`, `app/src/locales/en.ts` — the `expert.*` namespace, `viz.table.position`,
  the two `match.bundle.crashedExpert*` keys (**append-only**)
- `app/src/lib/i18n.test.ts`, `app/src/app/matches/static-output.test.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml`

**Must NOT be touched:** `app/src/lib/tactical-sections.ts`, `TacticalLayer.tsx`,
`TacticalSection.tsx`, `ViewDataDisclosure.tsx`, `app/src/components/ui/**` (vendored).

**Placement rule:** `DataTable.tsx` lives in `src/components/`, **not** `src/components/ui/` —
that directory is vendored shadcn primitives only. New code goes in `src/components/**` or
`src/viz/**`; a new top-level `src/` directory silently escapes the eslint client-import seam.

**Concurrent-session hazard.** `locales/{es,en}.ts` and `i18n.test.ts` are the three hottest files
in the repo and another session is editing `app/`. 2.11a's own record documents its work being
swept into another story's commit. **Commit your slice early**, and if `app/` will not compile,
verify in an isolated worktree on a private port rather than fighting the shared tree.

---

## References

`epics.md:837-857` (the story and its three ACs); UX-DR6 (`epics.md:109`), UX-DR12 (`:115`),
UX-DR17 (`:120`), UX-DR18 (`:121`), UX-DR2 (`:105`), UX-DR19 (`:122`); FR-23 (`:52`), NFR-3 (`:69`).
`EXPERIENCE.md:45` (`#expert` anchor), `:72` (collapsed-by-default, carries an `[ASSUMPTION]` tag),
`:76` (the data-table pattern incl. sticky player column), `:106` (horizontal scroll inside
containers only), `:133` (the Expert-tables Responsive row — **this story gets no "no row exists"
departure**), `:197`, `:207`, `:276` (the ruled group labels), `:278` (the per-term minting
procedure). `DESIGN.md:312` (layer-gap), `:314` (wide artifacts scroll inside their container),
`:335` (the EXPERTO pill), `:337` (data-table tokens).
`prd.md` FR-23, SM-C2, FR-22; `ARCHITECTURE-SPINE.md` AD-5, AD-7, AD-11, AD-12, AR-11.
`contract/match-bundle.schema.json` `$defs.PlayerRecord` (L1301), `PlayerInPossession` (L1189),
`OfferMovementCounts` (L1167), `PlayerOutOfPossession` (L1233), `PlayerPhysical` (L1273);
`contract/common.schema.json` `Count` (L440), `Percentage` (L454), `Metres` (L462),
`KmPerHour` (L476).
Code: `DataTable.tsx:119-148` (props), `:287-408` (markup), `lib/table-sort.ts:33-63`
(`TableColumn`), `SortAnnouncer.tsx:43-76`, `MatchBundleRegion.tsx:173-179`,
`TacticalSection.tsx:86-97` (the focus/nonce contract), `:184-188` (lazy mount),
`TacticalErrorBoundary.tsx:46-88`, `TacticalLayer.tsx:58-62` (`sectionIdFromHash`), `:75-99`
(the both-halves copy-override mechanism), `EmptyStatePanel.tsx:40-64`,
`viz/marker-model.ts:196-223` (`resolveSide`), `viz/receiving-model.ts:54-86`
(`OFFER_MOVEMENT_PROPERTY`), `lib/format.ts:26-55`, `lib/use-media-query.ts:28-31`,
`ui/toggle-group.tsx`, `PitchPanel.tsx:1161-1188` (the ToggleGroup precedent),
`GoalkeepingSection.tsx:550-563` (`countColumn`), `eslint.config.mjs:36-170` (the i18n gate).
Ledger: `deferred-work.md:179` (fixture totalDistance), `:753-763` (PendingSectionPanel),
`:861-889` (boundary, resolved-with-residual), `:1124-1137` (sticky departure, **owned here**),
`:1158-1162` (`rowHeader` no consumer), `:1222-1232` (announcement ambiguity, **owned here**),
`:1234-1249` (`aria-sort` on unsortable heads).

---

## Open Question (carried forward — filed, not answered)

**EXPERIENCE.md's Visualization Layering table (`:215`) assigns more at Expert altitude than AC 1
enumerates** — *"underlying series in data table"* (momentum), *"Exact percentages and per-match
splits in tables"* (phases/pressing/blocks), *"Set-play log"*. Those are 2.10's four sections, each
already carrying a Tactical-altitude table. AC 1's five-log enumeration controls for 2.11c; whether
these four **also** surface at Expert altitude is filed, not answered. Do not build them here.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context)

### Debug Log References

Verified against the STATIC EXPORT (`npm run build` + a local static server), not `next dev`: there
is no `app/public/`, so the dev server cannot serve `/data/fixtures/**` and the bundle fetch takes
the error branch — the Expert Layer never mounts. Anyone repeating this verification must build
first. Viewports were emulated with a same-origin iframe (media queries resolve against the iframe
viewport); `resize_window` had no effect on a maximized Chrome window.

### Completion Notes List

**What shipped.** The Expert Layer as a SIBLING of the Tactical Layer — `lib/tactical-sections.ts`
untouched, `tactical-sections.test.ts:305` (`sectionDataState(m001, "expert" as SectionId)` throws)
still green. 50 rendered columns (46 data + team/shirt/player/position) over 34 rows from one
`DataTable` instance, collapsed by default at 390 / 768 / 1280, lazy-mounted, with its own hash
listener and the focus/nonce contract copied from `TacticalSection` rather than imported.

**AC 1 — verified.** 50 columns and 34 rows at 768px and 1280px; the six `offersByMovementType`
columns render between `totalOffers` and `offersReceived`, the contract's own nesting position,
through the shipped `enums.offerMovement` bridge (no seventh key minted). 96 rows over the three
fixtures, artifact order verbatim, 51/51 leaves populated, zero em dashes by construction.

**AC 2 — verified BEHAVIOURALLY, which is the point.** 2.11a's departure was a sticky rule that
computed correctly and silently did nothing, so computed style is not evidence. Measured at 1280px:
the header pins to the scrollport's top edge to the pixel (574.09 vs 574.09) and HOLDS there while
the body scrolls 400px and then a further 145px. Scrollport `max-h-[70vh]` = 661.5px against 1192px
of content, so it genuinely scrolls; `scroll-padding-top` = 44px. z-ladder confirmed live: body
sticky cells 10, header cells 20, corner cells 30.

**AC 3 — verified.** At 390px: both toggle groups present, the ruled labels *En posesión / Sin
posesión / Físico*, 25 columns for the selected group, and the page itself never scrolls
horizontally (`scrollWidth === clientWidth`) at any of the three widths.

**Task 5.4 MEASUREMENT — the escape hatch was TAKEN.** At a 390px viewport the scrollport is 345px
and the three-column sticky run rendered **289px**, leaving **55.7px** — *less than one* data
column, because the Spanish heads run 102–126px wide. (The story estimated a 212px run and ~146px
of data; the gap is the head text, not the widths.) Dropping the `team` column at `<md` behind a
team `ToggleGroup` returns 88px: run **200px**, **145px of data**, one full column visible on open,
rows filtered to the selected side. Two data columns at 390px is not reachable at this type scale
without abbreviating the identity heads, which is a copy ruling this story does not have — filed.

**Task 9.2 CONTRAST, header delimiter.** Ruled decision 8 held exactly. Head fill (`--surface-
overlay`) against the body fill: **1.12 dark / 1.14 light** — which is why the fill alone does not
read and the doubled bottom border ships with it; the border against the body fill is **1.31 dark /
1.32 light**. Head ink on the head fill: **7.03 dark / 6.65 light**. Cell ink on the body: 15.81
dark. No `--shadow-overlay` fallback was needed, so no departure on that clause.

**THREE THINGS THE STORY RULED DID NOT SURVIVE THE BROWSER.** All three are in
`deferred-work.md` as declared departures, and all three fail SILENTLY, which is why they are
called out rather than quietly fixed:
1. **The sticky run's ruled widths (3.5 / 2.75 / 6.25rem).** Under auto table layout a cell `width`
   is only a suggestion — the used width may be the column's max-content in either direction. The
   run rendered 79 + 82 + 141px while `shirt` was pinned at 56px and `player` at 100px, so each
   sticky column overlapped and clipped the head before it; the columns still *were* sticky.
   `min-width` binds where `width` does not (verified: max-content 82px renders at exactly 88px
   under `min-w-[5.5rem]`), so the run ships as `min-w-*`. Measured exact in **both** locales:
   offsets 0 / 5.5rem / 11rem, widths 88 / 88 / 192, **gap 0.00px**.
2. **`truncate` inside a table cell WIDENS the column instead of truncating it** — it includes
   `white-space: nowrap`, which makes the cell's max-content the whole player name. That was the
   141px. Truncation moved into a fixed-width block inside the cell.
3. **The `<md` escape hatch**, above.

**Task 3.8 — one DEPARTURE and three MINTS.**
- *Departure:* the task says `enums.offerMovement["no-movement"]` = "Sin desmarque" fixes the house
  term for **offer** as *desmarque*, so `totalOffers`/`offersReceived` should follow it. They do
  not, and shipping that would contradict two things at once: EXPERIENCE.md's per-term table rules
  *offers to receive* → **ofrecimientos** and *movement to receive* → **desmarques** as FINAL
  (Story 2.18 decision 3), and Story 2.9 already ships these two exact fields as
  `viz.table.offersMade` = "Ofrecimientos" / `offersReceived` = "Recibidos". "Sin desmarque" labels
  the MOVEMENT type `no-movement`; it fixes the term for movement, not for offer. Shipped
  **"Ofrecimientos" / "Ofrecimientos recibidos"**.
- *Minted under EXPERIENCE.md:278:* `pushingOn` → **"Proyecciones"** (the established LatAm term
  for a defender advancing with the line; invents no direction the PMSR does not print),
  `pushingOnIntoPressing` → **"Proyecciones con presión"**, `looseBallReceptions` → **"Recepciones
  de balón suelto"** (reusing the glossary's *balón suelto* from the second-ball definition). Also
  newly worded, from existing house vocabulary rather than invented: `possessionContestsWon` →
  "Disputas ganadas" (*disputa* is already `viz.table.contestType`), `possessionInterrupted` →
  "Posesiones interrumpidas", `switchesOfPlay` → "Cambios de orientación".
- *Reused verbatim, not re-invented:* regate · irrupción · rupturas de líneas · progresión de balón
  · centro · presión · recuperaciones · sprint · **"CARR. ALTA VEL."** as `headText` with the full
  term in `headTitle`, exactly as the high-speed-run glossary definition already promises.
- `attemptsAtGoal` is **"Tiros"**, following the shipped `enums.metric.shots` for the same
  quantity. Never "Intentos a puerta" — "a puerta" is on the forbidden-register sweep.

**Not verifiable, and said so.** The `players === null` empty state is built but was never seen on
screen: no fixture exercises the branch (all three carry 31 / 31 / 34 players). Filed. The
announcement mechanism ships and was verified live — *"Tabla de datos por jugador: Ordenado por
Goles, descendente."* — but 2.11b adds exactly one table, so the multi-table disambiguation it is
meant to fix **cannot** be verified here; the ~25 remaining identifiers are re-filed.

**Performance, measured not gated.** 34 rows × 50 columns ≈ 1,700 cells, none of which render on
first load: the layer is collapsed at every width and lazy-mounts. No skeleton, no `next/dynamic`.
NFR-1 is a later story's gate.

**Full chain green:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — 703/703
across 25 files. Two failures seen mid-story in `src/app/static-output.test.ts` were a STALE `out/`
export against another session's `/about` copy edit, not this work; a rebuild cleared them.

### File List

**New**
- `app/src/components/ExpertLayer.tsx`
- `app/src/viz/expert-model.ts`
- `app/src/viz/expert-model.test.ts`

**Modified**
- `app/src/lib/table-sort.ts` — optional `cellClass` / `headClass` on `TableColumn<Row>`
- `app/src/components/DataTable.tsx` — `sticky` and `tableName` props; sticky-mode class switching
- `app/src/components/TacticalErrorBoundary.tsx` — optional `logLabel`
- `app/src/components/MatchBundleRegion.tsx` — the sibling boundary and `<ExpertLayer>`
- `app/src/locales/es.ts` — the `expert.*` namespace, `viz.table.position`, `match.bundle.crashedExpert*`
- `app/src/locales/en.ts` — the same key tree, mirrored
- `app/src/lib/i18n.test.ts` — the `expert.*` block
- `app/src/app/matches/static-output.test.ts` — the AR-11 guard for `#expert`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-08-04 — Story 2.11b implemented: Expert Layer shell (`#expert`), Domain G per-player tables,
  sticky headers and sticky column run behind `DataTable`'s opt-in `sticky` prop, the `<md` column-
  group tabs, the sibling error boundary and the `expert.*` locale namespace. Status → review.
- 2026-08-04 — Closed two ledger entries (the UX-DR12 sticky-header departure; `rowHeader` with no
  consumer, half) and half-closed the announcement-ambiguity entry (mechanism ships, identifiers
  re-filed). Filed the fixture zone-sum divergence, the `PendingSectionPanel` re-file, the unseen
  empty-state branch, the carried-forward Expert-altitude question and three measured departures.
